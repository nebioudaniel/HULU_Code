package parser

import (
	"bytes"
	"fmt"
	"path/filepath"
	"strings"

	sitter "github.com/smacker/go-tree-sitter"
	"github.com/smacker/go-tree-sitter/golang"
	"github.com/smacker/go-tree-sitter/javascript"
	"github.com/smacker/go-tree-sitter/python"
	"github.com/smacker/go-tree-sitter/typescript/tsx"
	"github.com/smacker/go-tree-sitter/typescript/typescript"
)

const (
	KindPackage   = "package"
	KindFunction  = "function"
	KindMethod    = "method"
	KindStruct    = "struct"
	KindInterface = "interface"
	KindType      = "type"
	KindClass     = "class"
	KindArrow     = "arrow"
	KindComponent = "component"
	KindExport    = "export"
)

type Symbol struct {
	Name           string   `json:"name"`
	Kind           string   `json:"kind"`
	StartLine      int      `json:"start_line"`
	EndLine        int      `json:"end_line"`
	Parent         string   `json:"parent,omitempty"`
	Exported       bool     `json:"exported,omitempty"`
	UsesGoroutines bool     `json:"uses_goroutines,omitempty"`
	Async          bool     `json:"async,omitempty"`
	Bases          []string `json:"bases,omitempty"`
	Decorators     []string `json:"decorators,omitempty"`
}

type File struct {
	Path     string   `json:"path"`
	Language string   `json:"language"`
	Lines    int      `json:"lines"`
	Imports  []string `json:"imports"`
	Symbols  []Symbol `json:"symbols"`
	Partial  bool     `json:"partial"`
}

func Parse(path string, language string, source []byte) (*File, error) {
	lang, err := grammarFor(path, language)
	if err != nil {
		return nil, err
	}

	treeParser := sitter.NewParser()
	defer treeParser.Close()
	treeParser.SetLanguage(lang)

	tree := treeParser.Parse(nil, source)
	if tree == nil {
		return nil, fmt.Errorf("could not parse %s", path)
	}
	defer tree.Close()

	root := tree.RootNode()
	file := &File{
		Path:     filepath.ToSlash(path),
		Language: language,
		Lines:    countLines(source),
		Imports:  []string{},
		Symbols:  []Symbol{},
		Partial:  root.HasError(),
	}

	switch language {
	case "Go":
		parseGo(root, source, file)
	case "TypeScript", "JavaScript":
		parseScript(root, source, file)
	case "Python":
		parsePython(root, source, file)
	default:
		return nil, fmt.Errorf("no parser available for %s", path)
	}

	return file, nil
}

func grammarFor(path string, language string) (*sitter.Language, error) {
	switch language {
	case "Go":
		return golang.GetLanguage(), nil
	case "JavaScript":
		return javascript.GetLanguage(), nil
	case "TypeScript":
		if strings.EqualFold(filepath.Ext(path), ".tsx") {
			return tsx.GetLanguage(), nil
		}
		return typescript.GetLanguage(), nil
	case "Python":
		return python.GetLanguage(), nil
	}

	return nil, fmt.Errorf("no parser available for %s", path)
}

func lineRange(node *sitter.Node) (int, int) {
	start := int(node.StartPoint().Row) + 1
	end := int(node.EndPoint().Row) + 1
	if node.EndPoint().Column == 0 && end > start {
		end--
	}

	return start, end
}

func newSymbol(node *sitter.Node, name string, kind string) Symbol {
	start, end := lineRange(node)

	return Symbol{Name: name, Kind: kind, StartLine: start, EndLine: end}
}

func walk(node *sitter.Node, visit func(*sitter.Node) bool) {
	if node == nil {
		return
	}
	if !visit(node) {
		return
	}
	for i := 0; i < int(node.ChildCount()); i++ {
		walk(node.Child(i), visit)
	}
}

func findDescendant(node *sitter.Node, nodeTypes ...string) *sitter.Node {
	if node == nil {
		return nil
	}
	for i := 0; i < int(node.ChildCount()); i++ {
		child := node.Child(i)
		for _, wanted := range nodeTypes {
			if child.Type() == wanted {
				return child
			}
		}
		if found := findDescendant(child, nodeTypes...); found != nil {
			return found
		}
	}

	return nil
}

func firstChildOfType(node *sitter.Node, nodeType string) *sitter.Node {
	for i := 0; i < int(node.ChildCount()); i++ {
		if node.Child(i).Type() == nodeType {
			return node.Child(i)
		}
	}

	return nil
}

func hasDirectChild(node *sitter.Node, nodeType string) bool {
	return firstChildOfType(node, nodeType) != nil
}

func appendUnique(list *[]string, seen map[string]bool, value string) {
	if value == "" || seen[value] {
		return
	}
	seen[value] = true
	*list = append(*list, value)
}

func unquote(text string) string {
	if len(text) < 2 {
		return text
	}

	first, last := text[0], text[len(text)-1]
	if first == last && (first == '"' || first == '\'' || first == '`') {
		return text[1 : len(text)-1]
	}

	return text
}

func countLines(data []byte) int {
	if len(data) == 0 {
		return 0
	}

	lines := bytes.Count(data, []byte{'\n'})
	if data[len(data)-1] != '\n' {
		lines++
	}

	return lines
}
