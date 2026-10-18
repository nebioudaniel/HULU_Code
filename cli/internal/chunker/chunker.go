package chunker

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"

	"github.com/nebioudaniel/HULU_Code/cli/internal/parser"
)

const (
	KindFile = "file"

	maxSymbolLines = 200
	partLines      = 120
	minSymbolLines = 3
	idLength       = 16
)

var keepShortKinds = map[string]bool{
	parser.KindStruct:    true,
	parser.KindInterface: true,
	parser.KindClass:     true,
	parser.KindType:      true,
}

type Chunk struct {
	ID          string   `json:"id"`
	Path        string   `json:"path"`
	Language    string   `json:"language"`
	Kind        string   `json:"kind"`
	Name        string   `json:"name"`
	Parent      string   `json:"parent,omitempty"`
	StartLine   int      `json:"start_line"`
	EndLine     int      `json:"end_line"`
	Part        int      `json:"part,omitempty"`
	Parts       int      `json:"parts,omitempty"`
	Imports     []string `json:"-"`
	Source      string   `json:"-"`
	ContentHash string   `json:"-"`
}

func Build(file parser.File, source []byte) []Chunk {
	lines := splitLines(source)

	if len(file.Symbols) == 0 {
		if file.Lines < 1 || file.Lines > maxSymbolLines {
			return nil
		}
		return []Chunk{wholeFileChunk(file, lines)}
	}

	chunks := []Chunk{}
	for i, sym := range file.Symbols {
		chunks = append(chunks, symbolChunks(file, sym, lines, i)...)
	}

	return chunks
}

func symbolChunks(file parser.File, sym parser.Symbol, lines []string, idx int) []Chunk {
	if sym.Name == "" {
		return nil
	}

	span := sym.EndLine - sym.StartLine + 1
	if span < 1 {
		return nil
	}
	if span < minSymbolLines && !keepShortKinds[sym.Kind] {
		return nil
	}

	if span <= maxSymbolLines {
		return []Chunk{newSymbolChunk(file, sym, sym.StartLine, sym.EndLine, 0, 0, lines, idx)}
	}

	total := (span + partLines - 1) / partLines
	chunks := []Chunk{}
	for offset := 0; offset < span; offset += partLines {
		start := sym.StartLine + offset
		end := start + partLines - 1
		if end > sym.EndLine {
			end = sym.EndLine
		}
		chunks = append(chunks, newSymbolChunk(file, sym, start, end, len(chunks)+1, total, lines, idx))
	}

	return chunks
}

func newSymbolChunk(file parser.File, sym parser.Symbol, start int, end int, part int, parts int, lines []string, idx int) Chunk {
	src := sourceRange(lines, start, end)
	return Chunk{
		ID:          chunkID(file.Path, sym.Kind, sym.Parent, sym.Name, idx, part),
		Path:        file.Path,
		Language:    file.Language,
		Kind:        sym.Kind,
		Name:        sym.Name,
		Parent:      sym.Parent,
		StartLine:   start,
		EndLine:     end,
		Part:        part,
		Parts:       parts,
		Imports:     file.Imports,
		Source:      src,
		ContentHash: sha256Hex(src),
	}
}

func wholeFileChunk(file parser.File, lines []string) Chunk {
	src := sourceRange(lines, 1, file.Lines)
	return Chunk{
		ID:           chunkID(file.Path, KindFile, "", "", 0, 0),
		Path:         file.Path,
		Language:     file.Language,
		Kind:         KindFile,
		StartLine:    1,
		EndLine:      file.Lines,
		Imports:      file.Imports,
		Source:       src,
		ContentHash:  sha256Hex(src),
	}
}

func chunkID(path string, kind string, parent string, name string, idx int, part int) string {
	sum := sha256.Sum256([]byte(fmt.Sprintf("%s\x00%s\x00%s\x00%s\x00%d\x00%d", path, kind, parent, name, idx, part)))

	return hex.EncodeToString(sum[:])[:idLength]
}

func sha256Hex(s string) string {
	sum := sha256.Sum256([]byte(s))

	return hex.EncodeToString(sum[:])
}

func sourceRange(lines []string, start int, end int) string {
	if start < 1 {
		start = 1
	}
	if end > len(lines) {
		end = len(lines)
	}
	if start > end {
		return ""
	}

	return strings.Join(lines[start-1:end], "\n")
}

func splitLines(source []byte) []string {
	if len(source) == 0 {
		return nil
	}

	lines := strings.Split(strings.ReplaceAll(string(source), "\r\n", "\n"), "\n")
	if len(lines) > 0 && lines[len(lines)-1] == "" {
		lines = lines[:len(lines)-1]
	}

	return lines
}
