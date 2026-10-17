package analyze

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"sync"

	"github.com/nebioudaniel/HULU_Code/cli/internal/chunker"
	"github.com/nebioudaniel/HULU_Code/cli/internal/parser"
	"github.com/nebioudaniel/HULU_Code/cli/internal/scanner"
)

const largestCount = 5

var languageAliases = map[string]string{
	"go": "Go",
	"ts": "TypeScript",
	"js": "JavaScript",
	"py": "Python",
}

type Options struct {
	Languages []string
	Workers   int
}

type Failure struct {
	Path   string `json:"path"`
	Reason string `json:"reason"`
}

type Largest struct {
	Path  string `json:"path"`
	Kind  string `json:"kind"`
	Name  string `json:"name"`
	Lines int    `json:"lines"`
}

type Result struct {
	Report   *scanner.Report
	Files    []parser.File
	Chunks   []chunker.Chunk
	Failures []Failure
	Symbols  int
	ByKind   map[string]int
	Largest  []Largest
}

type parsedFile struct {
	file    parser.File
	chunks  []chunker.Chunk
	failure *Failure
}

func ParseLanguages(value string) ([]string, error) {
	languages := []string{}
	seen := map[string]bool{}

	for _, part := range strings.Split(value, ",") {
		alias := strings.ToLower(strings.TrimSpace(part))
		if alias == "" {
			continue
		}

		language, ok := languageAliases[alias]
		if !ok {
			return nil, fmt.Errorf("unknown language %q, use a comma separated list of go, ts, js, py", part)
		}
		if !seen[language] {
			seen[language] = true
			languages = append(languages, language)
		}
	}

	return languages, nil
}

func Run(root string, opts Options) (*Result, error) {
	report, err := scanner.Scan(root)
	if err != nil {
		return nil, err
	}

	parsed, failures := parseAll(report.Root, selectFiles(report.Files, opts.Languages), opts.Workers)

	result := &Result{
		Report:   report,
		Files:    []parser.File{},
		Chunks:   []chunker.Chunk{},
		Failures: failures,
		ByKind:   map[string]int{},
	}

	for _, item := range parsed {
		result.Files = append(result.Files, item.file)
		result.Chunks = append(result.Chunks, item.chunks...)
		result.Symbols += len(item.file.Symbols)
		for _, sym := range item.file.Symbols {
			result.ByKind[sym.Kind]++
		}
	}

	sortChunks(result.Chunks)
	result.Largest = largestSymbols(result.Files)

	return result, nil
}

func (r *Result) Partial() int {
	count := 0
	for _, file := range r.Files {
		if file.Partial {
			count++
		}
	}

	return count
}

func selectFiles(files []scanner.File, languages []string) []scanner.File {
	if len(languages) == 0 {
		return files
	}

	allowed := map[string]bool{}
	for _, language := range languages {
		allowed[language] = true
	}

	selected := []scanner.File{}
	for _, file := range files {
		if allowed[file.Language] {
			selected = append(selected, file)
		}
	}

	return selected
}

func parseAll(root string, files []scanner.File, workers int) ([]parsedFile, []Failure) {
	if len(files) == 0 {
		return nil, []Failure{}
	}
	if workers < 1 {
		workers = runtime.NumCPU()
	}
	if workers > len(files) {
		workers = len(files)
	}

	jobs := make(chan scanner.File)
	out := make(chan parsedFile)

	var wg sync.WaitGroup
	for i := 0; i < workers; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for file := range jobs {
				out <- parseFile(root, file)
			}
		}()
	}

	go func() {
		for _, file := range files {
			jobs <- file
		}
		close(jobs)
		wg.Wait()
		close(out)
	}()

	results := []parsedFile{}
	failures := []Failure{}
	for item := range out {
		if item.failure != nil {
			failures = append(failures, *item.failure)
			continue
		}
		results = append(results, item)
	}

	sort.Slice(results, func(i, j int) bool { return results[i].file.Path < results[j].file.Path })
	sort.Slice(failures, func(i, j int) bool { return failures[i].Path < failures[j].Path })

	return results, failures
}

func parseFile(root string, file scanner.File) parsedFile {
	data, err := os.ReadFile(filepath.Join(root, file.Path))
	if err != nil {
		return parsedFile{failure: &Failure{Path: file.Path, Reason: err.Error()}}
	}

	parsed, err := parser.Parse(file.Path, file.Language, data)
	if err != nil {
		return parsedFile{failure: &Failure{Path: file.Path, Reason: err.Error()}}
	}

	return parsedFile{file: *parsed, chunks: chunker.Build(*parsed, data)}
}

func sortChunks(chunks []chunker.Chunk) {
	sort.Slice(chunks, func(i, j int) bool {
		if chunks[i].Path != chunks[j].Path {
			return chunks[i].Path < chunks[j].Path
		}
		if chunks[i].StartLine != chunks[j].StartLine {
			return chunks[i].StartLine < chunks[j].StartLine
		}

		return chunks[i].Name < chunks[j].Name
	})
}

func largestSymbols(files []parser.File) []Largest {
	all := []Largest{}
	for _, file := range files {
		for _, sym := range file.Symbols {
			all = append(all, Largest{
				Path:  file.Path,
				Kind:  sym.Kind,
				Name:  sym.Name,
				Lines: sym.EndLine - sym.StartLine + 1,
			})
		}
	}

	sort.Slice(all, func(i, j int) bool {
		if all[i].Lines != all[j].Lines {
			return all[i].Lines > all[j].Lines
		}
		if all[i].Path != all[j].Path {
			return all[i].Path < all[j].Path
		}

		return all[i].Name < all[j].Name
	})

	if len(all) > largestCount {
		return all[:largestCount]
	}

	return all
}
