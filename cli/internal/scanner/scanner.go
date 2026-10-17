package scanner

import (
	"bytes"
	"fmt"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"

	ignore "github.com/sabhiram/go-gitignore"
)

const (
	ReasonIgnored     = "ignored"
	ReasonSecret      = "secret"
	ReasonTooLarge    = "too_large"
	ReasonBinary      = "binary"
	ReasonUnsupported = "unsupported"
	ReasonSymlink     = "symlink"
)

var ReasonOrder = []string{
	ReasonIgnored,
	ReasonSecret,
	ReasonTooLarge,
	ReasonBinary,
	ReasonUnsupported,
	ReasonSymlink,
}

const (
	maxFileSize     = 1 << 20
	binaryProbeSize = 8 * 1024
)

var skippedDirs = map[string]bool{
	".git":         true,
	"node_modules": true,
	"vendor":       true,
	".next":        true,
	"dist":         true,
	"build":        true,
	"out":          true,
	"target":       true,
	"__pycache__":  true,
	".venv":        true,
	"venv":         true,
	".idea":        true,
	".vscode":      true,
	"coverage":     true,
}

var languageByExt = map[string]string{
	".go":  "Go",
	".ts":  "TypeScript",
	".tsx": "TypeScript",
	".js":  "JavaScript",
	".jsx": "JavaScript",
	".mjs": "JavaScript",
	".py":  "Python",
}

var secretNames = map[string]bool{
	".env":   true,
	".npmrc": true,
	".netrc": true,
}

var secretSuffixes = []string{
	".pem",
	".key",
	".p12",
	".pfx",
	".crt",
	".cer",
	".keystore",
}

var secretPrefixes = []string{
	"id_rsa",
	"id_ed25519",
	"credentials",
	"secrets",
}

type File struct {
	Path     string `json:"path"`
	Language string `json:"language"`
	Lines    int    `json:"lines"`
	Bytes    int64  `json:"bytes"`
}

type Report struct {
	Root       string         `json:"root"`
	Kept       int            `json:"kept"`
	TotalLines int            `json:"total_lines"`
	Languages  map[string]int `json:"languages"`
	Skipped    map[string]int `json:"skipped"`
	Files      []File         `json:"files"`
}

type ignoreLayer struct {
	base    string
	ignorer ignore.IgnoreParser
}

type walker struct {
	root   string
	report *Report
}

func Scan(root string) (*Report, error) {
	absRoot, err := filepath.Abs(root)
	if err != nil {
		return nil, fmt.Errorf("could not resolve %s: %w", root, err)
	}

	info, err := os.Stat(absRoot)
	if err != nil {
		return nil, fmt.Errorf("could not open %s: %w", root, err)
	}
	if !info.IsDir() {
		return nil, fmt.Errorf("%s is not a directory", root)
	}

	report := &Report{
		Root:      absRoot,
		Languages: map[string]int{},
		Skipped:   map[string]int{},
		Files:     []File{},
	}
	for _, reason := range ReasonOrder {
		report.Skipped[reason] = 0
	}

	w := &walker{root: absRoot, report: report}
	w.walk(absRoot, nil)
	sort.Slice(report.Files, func(i, j int) bool {
		return report.Files[i].Path < report.Files[j].Path
	})
	report.Kept = len(report.Files)

	return report, nil
}

func (w *walker) walk(dir string, layers []ignoreLayer) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return
	}

	current := layers
	if ignorer := loadIgnoreFile(filepath.Join(dir, ".gitignore")); ignorer != nil {
		current = append(append([]ignoreLayer{}, layers...), ignoreLayer{base: dir, ignorer: ignorer})
	}

	for _, entry := range entries {
		path := filepath.Join(dir, entry.Name())

		if entry.Type()&fs.ModeSymlink != 0 {
			w.skip(ReasonSymlink)
			continue
		}

		if entry.IsDir() {
			if skippedDirs[entry.Name()] || isIgnored(current, path) {
				continue
			}
			w.walk(path, current)
			continue
		}

		if !entry.Type().IsRegular() {
			continue
		}

		w.considerFile(path, entry, current)
	}
}

func (w *walker) considerFile(path string, entry fs.DirEntry, layers []ignoreLayer) {
	name := entry.Name()

	if IsSecretFile(name) {
		w.skip(ReasonSecret)
		return
	}
	if isIgnored(layers, path) {
		w.skip(ReasonIgnored)
		return
	}

	language, ok := LanguageFor(name)
	if !ok {
		w.skip(ReasonUnsupported)
		return
	}

	info, err := entry.Info()
	if err != nil {
		return
	}
	if info.Size() > maxFileSize {
		w.skip(ReasonTooLarge)
		return
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return
	}
	if IsBinary(data) {
		w.skip(ReasonBinary)
		return
	}

	relative, err := filepath.Rel(w.root, path)
	if err != nil {
		relative = path
	}

	w.report.Files = append(w.report.Files, File{
		Path:     filepath.ToSlash(relative),
		Language: language,
		Lines:    CountLines(data),
		Bytes:    int64(len(data)),
	})
	w.report.TotalLines += CountLines(data)
	w.report.Languages[language]++
}

func (w *walker) skip(reason string) {
	w.report.Skipped[reason]++
}

func loadIgnoreFile(path string) ignore.IgnoreParser {
	info, err := os.Stat(path)
	if err != nil || info.IsDir() {
		return nil
	}

	ignorer, err := ignore.CompileIgnoreFile(path)
	if err != nil {
		return nil
	}

	return ignorer
}

func isIgnored(layers []ignoreLayer, path string) bool {
	for i := len(layers) - 1; i >= 0; i-- {
		relative, err := filepath.Rel(layers[i].base, path)
		if err != nil || strings.HasPrefix(relative, "..") {
			continue
		}
		if layers[i].ignorer.MatchesPath(relative) {
			return true
		}
	}

	return false
}

func IsSecretFile(name string) bool {
	lower := strings.ToLower(name)

	if secretNames[lower] || strings.HasPrefix(lower, ".env.") {
		return true
	}
	for _, suffix := range secretSuffixes {
		if strings.HasSuffix(lower, suffix) {
			return true
		}
	}
	for _, prefix := range secretPrefixes {
		if strings.HasPrefix(lower, prefix) {
			return true
		}
	}

	return false
}

func LanguageFor(name string) (string, bool) {
	language, ok := languageByExt[strings.ToLower(filepath.Ext(name))]
	return language, ok
}

func IsBinary(data []byte) bool {
	probe := data
	if len(probe) > binaryProbeSize {
		probe = probe[:binaryProbeSize]
	}
	return bytes.IndexByte(probe, 0) >= 0
}

func CountLines(data []byte) int {
	if len(data) == 0 {
		return 0
	}

	lines := bytes.Count(data, []byte{'\n'})
	if data[len(data)-1] != '\n' {
		lines++
	}

	return lines
}
