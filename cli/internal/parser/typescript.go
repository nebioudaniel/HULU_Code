package parser

import (
	"unicode"
	"unicode/utf8"

	sitter "github.com/smacker/go-tree-sitter"
)

var scriptDeclarations = map[string]bool{
	"function_declaration":   true,
	"class_declaration":      true,
	"interface_declaration":  true,
	"type_alias_declaration": true,
	"lexical_declaration":    true,
	"variable_declaration":   true,
}

func parseScript(root *sitter.Node, src []byte, file *File) {
	seenImports := map[string]bool{}

	walk(root, func(node *sitter.Node) bool {
		switch node.Type() {
		case "import_statement":
			collectScriptSource(node, src, file, seenImports)
			return false
		case "export_statement":
			collectScriptSource(node, src, file, seenImports)
			handleScriptExport(node, src, file)
			return false
		}

		if scriptDeclarations[node.Type()] {
			handleScriptDeclaration(node, src, file, false)
			return false
		}

		return true
	})
}

func collectScriptSource(node *sitter.Node, src []byte, file *File, seen map[string]bool) {
	source := node.ChildByFieldName("source")
	if source == nil {
		return
	}

	appendUnique(&file.Imports, seen, unquote(source.Content(src)))
}

func handleScriptExport(node *sitter.Node, src []byte, file *File) {
	if declaration := node.ChildByFieldName("declaration"); declaration != nil {
		handleScriptDeclaration(declaration, src, file, true)
		return
	}

	clause := firstChildOfType(node, "export_clause")
	if clause == nil {
		return
	}
	for i := 0; i < int(clause.ChildCount()); i++ {
		spec := clause.Child(i)
		if spec.Type() != "export_specifier" {
			continue
		}
		if name := spec.ChildByFieldName("name"); name != nil {
			addExportName(file, name.Content(src), spec)
		}
	}
}

func addExportName(file *File, name string, node *sitter.Node) {
	for _, existing := range file.Symbols {
		if existing.Name == name {
			return
		}
	}

	sym := newSymbol(node, name, KindExport)
	sym.Exported = true
	file.Symbols = append(file.Symbols, sym)
}

func handleScriptDeclaration(node *sitter.Node, src []byte, file *File, exported bool) {
	switch node.Type() {
	case "function_declaration":
		addScriptFunction(node, src, file, "", exported)
	case "class_declaration":
		addScriptClass(node, src, file, exported)
	case "interface_declaration":
		addScriptNamed(node, src, file, KindInterface, exported)
	case "type_alias_declaration":
		addScriptNamed(node, src, file, KindType, exported)
	case "lexical_declaration", "variable_declaration":
		addScriptVariables(node, src, file, exported)
	}
}

func addScriptNamed(node *sitter.Node, src []byte, file *File, kind string, exported bool) {
	name := node.ChildByFieldName("name")
	if name == nil {
		return
	}

	sym := newSymbol(node, name.Content(src), kind)
	sym.Exported = exported
	file.Symbols = append(file.Symbols, sym)
}

func addScriptFunction(node *sitter.Node, src []byte, file *File, parent string, exported bool) {
	name := node.ChildByFieldName("name")
	if name == nil {
		return
	}

	sym := newSymbol(node, name.Content(src), KindFunction)
	if isComponentName(sym.Name) && returnsJSX(node) {
		sym.Kind = KindComponent
	}
	sym.Parent = parent
	sym.Exported = exported
	file.Symbols = append(file.Symbols, sym)
}

func addScriptClass(node *sitter.Node, src []byte, file *File, exported bool) {
	className := ""
	if name := node.ChildByFieldName("name"); name != nil {
		className = name.Content(src)
		sym := newSymbol(node, className, KindClass)
		sym.Exported = exported
		file.Symbols = append(file.Symbols, sym)
	}

	body := node.ChildByFieldName("body")
	if body == nil {
		return
	}

	walk(body, func(child *sitter.Node) bool {
		if child.Type() != "method_definition" {
			return true
		}
		if name := child.ChildByFieldName("name"); name != nil {
			sym := newSymbol(child, name.Content(src), KindMethod)
			sym.Parent = className
			file.Symbols = append(file.Symbols, sym)
		}

		return false
	})
}

func addScriptVariables(node *sitter.Node, src []byte, file *File, exported bool) {
	walk(node, func(decl *sitter.Node) bool {
		if decl.Type() != "variable_declarator" {
			return true
		}

		name := decl.ChildByFieldName("name")
		if name == nil {
			return false
		}

		symbolName := name.Content(src)
		kind, ok := scriptVariableKind(symbolName, decl.ChildByFieldName("value"), exported)
		if !ok {
			return false
		}

		sym := newSymbol(decl, symbolName, kind)
		sym.Exported = exported
		file.Symbols = append(file.Symbols, sym)

		return false
	})
}

func scriptVariableKind(name string, value *sitter.Node, exported bool) (string, bool) {
	if value != nil {
		switch value.Type() {
		case "arrow_function", "function_expression":
			if isComponentName(name) && returnsJSX(value) {
				return KindComponent, true
			}
			return KindArrow, true
		}
	}

	if exported {
		return KindExport, true
	}

	return "", false
}

func returnsJSX(node *sitter.Node) bool {
	return findDescendant(node, "jsx_element", "jsx_self_closing_element", "jsx_fragment") != nil
}

func isComponentName(name string) bool {
	if name == "" {
		return false
	}

	first, _ := utf8.DecodeRuneInString(name)

	return unicode.IsUpper(first)
}
