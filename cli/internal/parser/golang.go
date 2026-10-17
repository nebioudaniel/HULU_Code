package parser

import (
	"unicode"
	"unicode/utf8"

	sitter "github.com/smacker/go-tree-sitter"
)

func parseGo(root *sitter.Node, src []byte, file *File) {
	seenImports := map[string]bool{}

	walk(root, func(node *sitter.Node) bool {
		switch node.Type() {
		case "package_clause":
			if name := firstChildOfType(node, "package_identifier"); name != nil {
				file.Symbols = append(file.Symbols, newSymbol(name, name.Content(src), KindPackage))
			}
		case "import_declaration":
			collectGoImports(node, src, file, seenImports)
		case "function_declaration":
			addGoFunction(node, src, file)
		case "method_declaration":
			addGoMethod(node, src, file)
		case "type_spec", "type_alias":
			addGoType(node, src, file)
		}

		return true
	})
}

func addGoFunction(node *sitter.Node, src []byte, file *File) {
	name := node.ChildByFieldName("name")
	if name == nil {
		return
	}

	sym := newSymbol(node, name.Content(src), KindFunction)
	sym.Exported = isExportedGo(sym.Name)
	sym.UsesGoroutines = findDescendant(node, "go_statement") != nil
	file.Symbols = append(file.Symbols, sym)
}

func addGoMethod(node *sitter.Node, src []byte, file *File) {
	name := node.ChildByFieldName("name")
	if name == nil {
		return
	}

	sym := newSymbol(node, name.Content(src), KindMethod)
	sym.Parent = goReceiverType(node, src)
	sym.Exported = isExportedGo(sym.Name)
	sym.UsesGoroutines = findDescendant(node, "go_statement") != nil
	file.Symbols = append(file.Symbols, sym)
}

func addGoType(node *sitter.Node, src []byte, file *File) {
	name := node.ChildByFieldName("name")
	if name == nil {
		return
	}

	kind := KindType
	if typeNode := node.ChildByFieldName("type"); typeNode != nil {
		switch typeNode.Type() {
		case "struct_type":
			kind = KindStruct
		case "interface_type":
			kind = KindInterface
		}
	}

	sym := newSymbol(node, name.Content(src), kind)
	sym.Exported = isExportedGo(sym.Name)
	file.Symbols = append(file.Symbols, sym)
}

func collectGoImports(node *sitter.Node, src []byte, file *File, seen map[string]bool) {
	walk(node, func(spec *sitter.Node) bool {
		if spec.Type() != "import_spec" {
			return true
		}
		if path := spec.ChildByFieldName("path"); path != nil {
			appendUnique(&file.Imports, seen, unquote(path.Content(src)))
		}

		return false
	})
}

func goReceiverType(node *sitter.Node, src []byte) string {
	receiver := node.ChildByFieldName("receiver")
	if receiver == nil {
		return ""
	}

	found := findDescendant(receiver, "type_identifier")
	if found == nil {
		return ""
	}

	return found.Content(src)
}

func isExportedGo(name string) bool {
	if name == "" {
		return false
	}

	first, _ := utf8.DecodeRuneInString(name)

	return unicode.IsUpper(first)
}
