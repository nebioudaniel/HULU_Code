package analyze

import (
	"encoding/json"
	"fmt"
	"io"
	"sort"
	"strings"
	"text/tabwriter"

	"github.com/nebioudaniel/HULU_Code/cli/internal/chunker"
	"github.com/nebioudaniel/HULU_Code/cli/internal/parser"
)

type jsonReport struct {
	Root       string         `json:"root"`
	Kept       int            `json:"kept"`
	Parsed     int            `json:"parsed"`
	Partial    int            `json:"partial"`
	Failed     int            `json:"failed"`
	TotalLines int            `json:"total_lines"`
	Languages  map[string]int `json:"languages"`
	Skipped    map[string]int `json:"skipped"`
	Symbols    jsonSymbols    `json:"symbols"`
	Files      []parser.File  `json:"files"`
	Chunks     []jsonChunk    `json:"chunks"`
	Edges      []Edge         `json:"edges"`
	External   []string       `json:"external_dependencies"`
}

type jsonSymbols struct {
	Total  int            `json:"total"`
	ByKind map[string]int `json:"by_kind"`
}

type jsonChunk struct {
	ID        string `json:"id"`
	Path      string `json:"path"`
	Language  string `json:"language"`
	Kind      string `json:"kind"`
	Name      string `json:"name"`
	Parent    string `json:"parent,omitempty"`
	StartLine int    `json:"start_line"`
	EndLine   int    `json:"end_line"`
	Part      int    `json:"part,omitempty"`
	Parts     int    `json:"parts,omitempty"`
	Source    string `json:"source,omitempty"`
}

func (r *Result) WriteJSON(w io.Writer, includeCode bool) error {
	report := jsonReport{
		Root:       r.Report.Root,
		Kept:       r.Report.Kept,
		Parsed:     len(r.Files),
		Partial:    r.Partial(),
		Failed:     len(r.Failures),
		TotalLines: r.Report.TotalLines,
		Languages:  r.Report.Languages,
		Skipped:    r.Report.Skipped,
		Symbols:    jsonSymbols{Total: r.Symbols, ByKind: r.ByKind},
		Files:      r.Files,
		Chunks:     chunksForJSON(r.Chunks, includeCode),
		Edges:      r.Edges,
		External:   r.External,
	}

	encoder := json.NewEncoder(w)
	encoder.SetIndent("", "  ")

	return encoder.Encode(report)
}

func chunksForJSON(chunks []chunker.Chunk, includeCode bool) []jsonChunk {
	out := make([]jsonChunk, 0, len(chunks))
	for _, chunk := range chunks {
		item := jsonChunk{
			ID:        chunk.ID,
			Path:      chunk.Path,
			Language:  chunk.Language,
			Kind:      chunk.Kind,
			Name:      chunk.Name,
			Parent:    chunk.Parent,
			StartLine: chunk.StartLine,
			EndLine:   chunk.EndLine,
			Part:      chunk.Part,
			Parts:     chunk.Parts,
		}
		if includeCode {
			item.Source = chunk.Source
		}
		out = append(out, item)
	}

	return out
}

func (r *Result) WriteText(w io.Writer, verbose bool) {
	r.Report.WriteText(w, false)

	details := []string{}
	if partial := r.Partial(); partial > 0 {
		details = append(details, fmt.Sprintf("%d partial", partial))
	}
	if len(r.Failures) > 0 {
		details = append(details, fmt.Sprintf("%d failed", len(r.Failures)))
	}

	summary := fmt.Sprintf("Parsed %d %s", len(r.Files), plural(len(r.Files), "file", "files"))
	if len(details) > 0 {
		summary += " (" + strings.Join(details, ", ") + ")"
	}

	fmt.Fprintln(w)
	fmt.Fprintln(w, summary)
	fmt.Fprintln(w)

	tw := tabwriter.NewWriter(w, 0, 0, 2, ' ', 0)
	if len(r.ByKind) > 0 {
		fmt.Fprintln(tw, "Symbols\tCount")
		for _, kind := range sortedKeys(r.ByKind) {
			fmt.Fprintf(tw, "%s\t%d\n", kind, r.ByKind[kind])
		}
		fmt.Fprintf(tw, "total\t%d\n\n", r.Symbols)
	}
	fmt.Fprintf(tw, "Chunks\t%d\n", len(r.Chunks))
	fmt.Fprintf(tw, "Dependencies\t%d edges, %d external\n", len(r.Edges), len(r.External))
	tw.Flush()

	if len(r.Largest) > 0 {
		fmt.Fprintln(w)
		fmt.Fprintln(w, "Largest symbols")
		tw := tabwriter.NewWriter(w, 0, 0, 2, ' ', 0)
		for _, item := range r.Largest {
			fmt.Fprintf(tw, "%s\t%s\t%s\t%d %s\n", item.Path, item.Kind, item.Name, item.Lines, plural(item.Lines, "line", "lines"))
		}
		tw.Flush()
	}

	if len(r.Failures) > 0 {
		fmt.Fprintln(w)
		fmt.Fprintln(w, "Failed files")
		tw := tabwriter.NewWriter(w, 0, 0, 2, ' ', 0)
		for _, failure := range r.Failures {
			fmt.Fprintf(tw, "%s\t%s\n", failure.Path, failure.Reason)
		}
		tw.Flush()
	}

	if !verbose {
		return
	}

	fmt.Fprintln(w)
	if len(r.Files) == 0 {
		fmt.Fprintln(w, "No files were parsed.")
		return
	}

	fmt.Fprintln(w, "Files parsed")
	tw = tabwriter.NewWriter(w, 0, 0, 2, ' ', 0)
	fmt.Fprintln(tw, "Path\tSymbols\tChunks\tLines")
	for _, file := range r.Files {
		fmt.Fprintf(tw, "%s\t%d\t%d\t%d\n", file.Path, len(file.Symbols), countChunks(r.Chunks, file.Path), file.Lines)
	}
	tw.Flush()
}

func (r *Result) WriteSymbols(w io.Writer) {
	fmt.Fprintln(w)
	if len(r.Files) == 0 {
		fmt.Fprintln(w, "No symbols were found.")
		return
	}

	fmt.Fprintln(w, "Symbols by file")
	for _, file := range r.Files {
		fmt.Fprintf(w, "\n%s\n", file.Path)
		if len(file.Symbols) == 0 {
			fmt.Fprintln(w, "  (no symbols)")
			continue
		}

		tw := tabwriter.NewWriter(w, 0, 0, 2, ' ', 0)
		for _, sym := range file.Symbols {
			name := sym.Name
			if sym.Parent != "" {
				name = sym.Parent + "." + sym.Name
			}
			fmt.Fprintf(tw, "  %s\t%s\t%d-%d\n", sym.Kind, name, sym.StartLine, sym.EndLine)
		}
		tw.Flush()
	}
}

func countChunks(chunks []chunker.Chunk, path string) int {
	count := 0
	for _, chunk := range chunks {
		if chunk.Path == path {
			count++
		}
	}

	return count
}

func sortedKeys(counts map[string]int) []string {
	keys := make([]string, 0, len(counts))
	for key := range counts {
		keys = append(keys, key)
	}
	sort.Strings(keys)

	return keys
}

func plural(count int, singular string, multiple string) string {
	if count == 1 {
		return singular
	}

	return multiple
}
