package project

import (
	"crypto/sha256"
	"encoding/hex"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/nebioudaniel/HULU_Code/cli/internal/analyze"
)

type Meta struct {
	Name     string `json:"name"`
	RootHash string `json:"root_hash"`
}

type File struct {
	Path      string `json:"path"`
	Language  string `json:"language"`
	LineCount int    `json:"line_count"`
	Partial   bool   `json:"partial"`
}

type Chunk struct {
	Key         string `json:"key"`
	FilePath    string `json:"file_path"`
	Language    string `json:"language"`
	Kind        string `json:"kind"`
	Name        string `json:"name"`
	Parent      string `json:"parent"`
	StartLine   int    `json:"start_line"`
	EndLine     int    `json:"end_line"`
	ContentHash string `json:"content_hash"`
}

type Edge struct {
	From string `json:"from"`
	To   string `json:"to"`
}

type External struct {
	Name  string `json:"name"`
	Count int    `json:"count"`
}

type Payload struct {
	Project    Meta       `json:"project"`
	Files      []File     `json:"files"`
	Chunks     []Chunk    `json:"chunks"`
	Edges      []Edge     `json:"edges"`
	External   []External `json:"external_dependencies"`
	CLIVersion string     `json:"cli_version"`
}

func Name(root string) string {
	abs, err := filepath.Abs(root)
	if err != nil {
		return "project"
	}

	name := filepath.Base(abs)
	if name == "" || name == "." || name == string(filepath.Separator) {
		return "project"
	}

	return name
}

func RootHash(root string) (string, error) {
	abs, err := filepath.Abs(root)
	if err != nil {
		return "", err
	}

	source := gitOrigin(abs)
	if source == "" {
		source = filepath.ToSlash(abs)
	}

	sum := sha256.Sum256([]byte(source))

	return hex.EncodeToString(sum[:]), nil
}

func Build(result *analyze.Result, meta Meta, version string) Payload {
	payload := Payload{
		Project:    meta,
		Files:      make([]File, 0, len(result.Files)),
		Chunks:     make([]Chunk, 0, len(result.Chunks)),
		Edges:      make([]Edge, 0, len(result.Edges)),
		External:   make([]External, 0, len(result.External)),
		CLIVersion: version,
	}

	for _, file := range result.Files {
		payload.Files = append(payload.Files, File{
			Path:      file.Path,
			Language:  file.Language,
			LineCount: file.Lines,
			Partial:   file.Partial,
		})
	}

	for _, chunk := range result.Chunks {
		payload.Chunks = append(payload.Chunks, Chunk{
			Key:         chunk.ID,
			FilePath:    chunk.Path,
			Language:    chunk.Language,
			Kind:        chunk.Kind,
			Name:        chunk.Name,
			Parent:      chunk.Parent,
			StartLine:   chunk.StartLine,
			EndLine:     chunk.EndLine,
			ContentHash: chunk.ContentHash,
		})
	}

	for _, edge := range result.Edges {
		payload.Edges = append(payload.Edges, Edge{From: edge.From, To: edge.To})
	}

	for _, name := range result.External {
		count := result.ExternalCounts[name]
		if count < 1 {
			count = 1
		}
		payload.External = append(payload.External, External{Name: name, Count: count})
	}

	return payload
}

func gitOrigin(dir string) string {
	out, err := exec.Command("git", "-C", dir, "config", "--get", "remote.origin.url").Output()
	if err != nil {
		return ""
	}

	return strings.TrimSpace(string(out))
}
