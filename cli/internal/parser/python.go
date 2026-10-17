package parser

import (
	"strings"

	sitter "github.com/smacker/go-tree-sitter"
)

func parsePython(root *sitter.Node, src []byte, file *File) {
	seenImports := map[string]bool{}

	walk(root, func(node *sitter.Node) bool {
		switch node.Type() {
		case "import_statement":
			collectPythonImport(node, src, file, seenImports)
			return false
		case "import_from_statement":
			collectPythonFromImport(node, src, file, seenImports)
			return false
		case "decorated_definition":
			handlePythonDecorated(node, src, file)
			return false
		case "function_definition":
			addPythonFunction(node, src, file, "", nil)
			return false
		case "class_definition":
			addPythonClass(node, src, file, nil)
			return false
		}

		return true
	})
}

func handlePythonDecorated(node *sitter.Node, src []byte, file *File) {
	definition := node.ChildByFieldName("definition")
	if definition == nil {
		return
	}

	decorators := pythonDecorators(node, src)
	switch definition.Type() {
	case "function_definition":
		addPythonFunction(definition, src, file, "", decorators)
	case "class_definition":
		addPythonClass(definition, src, file, decorators)
	}
}

func addPythonFunction(node *sitter.Node, src []byte, file *File, parent string, decorators []string) {
	name := node.ChildByFieldName("name")
	if name == nil {
		return
	}

	kind := KindFunction
	if parent != "" {
		kind = KindMethod
	}

	sym := newSymbol(node, name.Content(src), kind)
	sym.Parent = parent
	sym.Async = hasDirectChild(node, "async")
	sym.Decorators = decorators
	file.Symbols = append(file.Symbols, sym)
}

func addPythonClass(node *sitter.Node, src []byte, file *File, decorators []string) {
	name := node.ChildByFieldName("name")
	if name == nil {
		return
	}

	className := name.Content(src)
	sym := newSymbol(node, className, KindClass)
	sym.Bases = pythonBases(node, src)
	sym.Decorators = decorators
	file.Symbols = append(file.Symbols, sym)

	body := node.ChildByFieldName("body")
	if body == nil {
		return
	}

	walk(body, func(child *sitter.Node) bool {
		switch child.Type() {
		case "function_definition":
			addPythonFunction(child, src, file, className, nil)
			return false
		case "decorated_definition":
			definition := child.ChildByFieldName("definition")
			if definition != nil && definition.Type() == "function_definition" {
				addPythonFunction(definition, src, file, className, pythonDecorators(child, src))
			}
			return false
		case "class_definition":
			addPythonClass(child, src, file, nil)
			return false
		}

		return true
	})
}

func pythonBases(node *sitter.Node, src []byte) []string {
	superclasses := node.ChildByFieldName("superclasses")
	if superclasses == nil {
		return nil
	}

	bases := []string{}
	for i := 0; i < int(superclasses.ChildCount()); i++ {
		child := superclasses.Child(i)
		if child.IsNamed() {
			bases = append(bases, child.Content(src))
		}
	}

	return bases
}

func pythonDecorators(node *sitter.Node, src []byte) []string {
	decorators := []string{}
	for i := 0; i < int(node.ChildCount()); i++ {
		child := node.Child(i)
		if child.Type() == "decorator" {
			decorators = append(decorators, trimDecorator(child.Content(src)))
		}
	}

	return decorators
}

func trimDecorator(text string) string {
	return strings.TrimSpace(strings.TrimPrefix(strings.TrimSpace(text), "@"))
}

func collectPythonImport(node *sitter.Node, src []byte, file *File, seen map[string]bool) {
	walk(node, func(child *sitter.Node) bool {
		switch child.Type() {
		case "dotted_name":
			appendUnique(&file.Imports, seen, child.Content(src))
			return false
		case "aliased_import":
			if name := child.ChildByFieldName("name"); name != nil {
				appendUnique(&file.Imports, seen, name.Content(src))
			}
			return false
		}

		return true
	})
}

func collectPythonFromImport(node *sitter.Node, src []byte, file *File, seen map[string]bool) {
	module := node.ChildByFieldName("module_name")
	if module == nil {
		return
	}

	appendUnique(&file.Imports, seen, module.Content(src))
}
