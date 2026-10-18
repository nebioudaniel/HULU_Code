package analyze

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/nebioudaniel/HULU_Code/cli/internal/parser"
)

var scriptExtensions = []string{".ts", ".tsx", ".js", ".jsx", ".mjs"}

type Edge struct {
	From string `json:"from"`
	To   string `json:"to"`
}

type indexedFile struct {
	path     string
	language string
}

type fileIndex struct {
	byPath map[string]string
	byDir  map[string][]indexedFile
}

type pathMapping struct {
	prefix  string
	suffix  string
	hasStar bool
	targets []string
}

type aliasResolver struct {
	baseURL  string
	mappings []pathMapping
}

type tsconfig struct {
	CompilerOptions struct {
		BaseURL string              `json:"baseUrl"`
		Paths   map[string][]string `json:"paths"`
	} `json:"compilerOptions"`
	Extends string `json:"extends"`
}

func buildEdges(root string, files []parser.File) ([]Edge, []string) {
	index := newFileIndex(files)
	modulePath := readModulePath(root)
	aliases := readAliases(root)

	edges := []Edge{}
	external := []string{}
	seenEdge := map[string]bool{}
	seenExternal := map[string]bool{}

	for _, file := range files {
		for _, spec := range file.Imports {
			targets, isExternal := resolveImport(file, spec, index, modulePath, aliases)
			if isExternal {
				if !seenExternal[spec] {
					seenExternal[spec] = true
					external = append(external, spec)
				}
				continue
			}

			for _, target := range targets {
				if target == file.Path || seenEdge[file.Path+"\x00"+target] {
					continue
				}
				seenEdge[file.Path+"\x00"+target] = true
				edges = append(edges, Edge{From: file.Path, To: target})
			}
		}
	}

	sort.Slice(edges, func(i, j int) bool {
		if edges[i].From != edges[j].From {
			return edges[i].From < edges[j].From
		}

		return edges[i].To < edges[j].To
	})
	sort.Strings(external)

	return edges, external
}

func resolveImport(file parser.File, spec string, index *fileIndex, modulePath string, aliases *aliasResolver) ([]string, bool) {
	switch file.Language {
	case "Go":
		return resolveGo(spec, index, modulePath)
	case "TypeScript", "JavaScript":
		return resolveScript(file.Path, spec, index, aliases)
	case "Python":
		return resolvePython(file.Path, spec, index)
	}

	return nil, true
}

func resolveGo(spec string, index *fileIndex, modulePath string) ([]string, bool) {
	if modulePath == "" {
		return nil, true
	}
	if spec != modulePath && !strings.HasPrefix(spec, modulePath+"/") {
		return nil, true
	}

	dir := strings.TrimPrefix(strings.TrimPrefix(spec, modulePath), "/")

	return index.filesInDir(dir, "Go"), false
}

func resolveScript(filePath string, spec string, index *fileIndex, aliases *aliasResolver) ([]string, bool) {
	if strings.HasPrefix(spec, "./") || strings.HasPrefix(spec, "../") || spec == "." || spec == ".." {
		base := normalizeDir(filepath.Join(filepath.Dir(filePath), spec))

		return lookupScript(base, index), false
	}

	if aliases != nil {
		if base, ok := aliases.resolve(spec); ok {
			return lookupScript(base, index), false
		}
	}

	return nil, true
}

func lookupScript(base string, index *fileIndex) []string {
	if _, ok := index.byPath[base]; ok {
		return []string{base}
	}
	for _, extension := range scriptExtensions {
		if _, ok := index.byPath[base+extension]; ok {
			return []string{base + extension}
		}
	}
	for _, extension := range scriptExtensions {
		candidate := filepath.Join(base, "index"+extension)
		if _, ok := index.byPath[candidate]; ok {
			return []string{candidate}
		}
	}

	return nil
}

func resolvePython(filePath string, spec string, index *fileIndex) ([]string, bool) {
	if strings.HasPrefix(spec, ".") {
		return resolvePythonRelative(filePath, spec, index), false
	}

	targets := lookupPython(strings.ReplaceAll(spec, ".", "/"), index)
	if len(targets) == 0 {
		return nil, true
	}

	return targets, false
}

func resolvePythonRelative(filePath string, spec string, index *fileIndex) []string {
	level := 0
	for level < len(spec) && spec[level] == '.' {
		level++
	}

	dir := normalizeDir(filepath.Dir(filePath))
	for i := 1; i < level; i++ {
		dir = normalizeDir(filepath.Join(dir, ".."))
	}

	rest := strings.ReplaceAll(spec[level:], ".", "/")
	if rest == "" {
		return index.filesInDir(dir, "Python")
	}

	if found := lookupPython(filepath.Join(dir, rest), index); len(found) > 0 {
		return found
	}

	init := "__init__.py"
	if dir != "" {
		init = filepath.Join(dir, "__init__.py")
	}
	if _, ok := index.byPath[init]; ok {
		return []string{init}
	}

	return nil
}

func lookupPython(base string, index *fileIndex) []string {
	if _, ok := index.byPath[base+".py"]; ok {
		return []string{base + ".py"}
	}

	return index.filesInDir(base, "Python")
}

func newFileIndex(files []parser.File) *fileIndex {
	index := &fileIndex{byPath: map[string]string{}, byDir: map[string][]indexedFile{}}
	for _, file := range files {
		index.byPath[file.Path] = file.Language
		dir := normalizeDir(filepath.Dir(file.Path))
		index.byDir[dir] = append(index.byDir[dir], indexedFile{path: file.Path, language: file.Language})
	}

	for dir, entries := range index.byDir {
		sort.Slice(entries, func(i, j int) bool { return entries[i].path < entries[j].path })
		index.byDir[dir] = entries
	}

	return index
}

func (f *fileIndex) filesInDir(dir string, language string) []string {
	found := []string{}
	for _, entry := range f.byDir[normalizeDir(dir)] {
		if entry.language == language {
			found = append(found, entry.path)
		}
	}

	return found
}

func normalizeDir(dir string) string {
	dir = filepath.Clean(dir)
	if dir == "." || dir == "/" {
		return ""
	}

	return strings.TrimPrefix(dir, "./")
}

func readModulePath(root string) string {
	data, err := os.ReadFile(filepath.Join(root, "go.mod"))
	if err != nil {
		return ""
	}

	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if strings.HasPrefix(line, "module ") {
			return strings.Trim(strings.TrimSpace(strings.TrimPrefix(line, "module ")), "\"")
		}
	}

	return ""
}

func readAliases(root string) *aliasResolver {
	pathToConfig := filepath.Join(root, "tsconfig.json")
	data, err := os.ReadFile(pathToConfig)
	if err != nil {
		return nil
	}

	config := tsconfig{}
	if err := json.Unmarshal(data, &config); err != nil {
		return nil
	}

	configDir := filepath.Dir(pathToConfig)
	baseDir := configDir
	baseDirResolved := false
	visited := map[string]bool{pathToConfig: true}
	for config.Extends != "" && !visited[filepath.Clean(config.Extends)] {
		extendsPath := config.Extends
		if !filepath.IsAbs(extendsPath) {
			extendsPath = filepath.Join(configDir, extendsPath)
		}
		extendsPath = filepath.Clean(extendsPath)
		visited[extendsPath] = true
		more, err := os.ReadFile(extendsPath)
		if err != nil {
			break
		}
		var moreCfg tsconfig
		if json.Unmarshal(more, &moreCfg) != nil {
			break
		}
		configDir = filepath.Dir(extendsPath)
		for key, targets := range moreCfg.CompilerOptions.Paths {
			if _, ok := config.CompilerOptions.Paths[key]; !ok {
				config.CompilerOptions.Paths[key] = targets
			}
		}
		if config.CompilerOptions.BaseURL == "" && moreCfg.CompilerOptions.BaseURL != "" {
			config.CompilerOptions.BaseURL = moreCfg.CompilerOptions.BaseURL
			baseDir = configDir
			baseDirResolved = true
		}
		config.Extends = moreCfg.Extends
	}

	if len(config.CompilerOptions.Paths) == 0 {
		return nil
	}

	mappings := []pathMapping{}
	for key, targets := range config.CompilerOptions.Paths {
		prefix, suffix, hasStar := splitPattern(key)
		mappings = append(mappings, pathMapping{prefix: prefix, suffix: suffix, hasStar: hasStar, targets: targets})
	}
	sort.Slice(mappings, func(i, j int) bool { return len(mappings[i].prefix) > len(mappings[j].prefix) })

	if config.CompilerOptions.BaseURL != "" && !baseDirResolved {
		baseDir = filepath.Join(baseDir, config.CompilerOptions.BaseURL)
	}
	rel, err := filepath.Rel(root, baseDir)
	if err != nil {
		rel = "."
	}
	baseURL := normalizeDir(rel)

	return &aliasResolver{baseURL: baseURL, mappings: mappings}
}

func splitPattern(key string) (string, string, bool) {
	index := strings.Index(key, "*")
	if index < 0 {
		return key, "", false
	}

	return key[:index], key[index+1:], true
}

func (a *aliasResolver) resolve(spec string) (string, bool) {
	for _, mapping := range a.mappings {
		star, ok := mapping.match(spec)
		if !ok {
			continue
		}
		for _, target := range mapping.targets {
			replaced := target
			if strings.Contains(target, "*") {
				replaced = strings.Replace(target, "*", star, 1)
			}
			return normalizeDir(filepath.Join(a.baseURL, replaced)), true
		}
	}

	return "", false
}

func (m pathMapping) match(spec string) (string, bool) {
	if !m.hasStar {
		return "", spec == m.prefix
	}
	if !strings.HasPrefix(spec, m.prefix) || !strings.HasSuffix(spec, m.suffix) {
		return "", false
	}
	if len(spec) < len(m.prefix)+len(m.suffix) {
		return "", false
	}

	return spec[len(m.prefix) : len(spec)-len(m.suffix)], true
}
