package chunker

import (
	"strings"
	"testing"

	"github.com/nebioudaniel/HULU_Code/cli/internal/parser"
)

func parseOrFail(t *testing.T, path string, language string, source string) parser.File {
	t.Helper()

	file, err := parser.Parse(path, language, []byte(source))
	if err != nil {
		t.Fatalf("Parse(%s) returned an error: %v", path, err)
	}

	return *file
}

const smallTypeScript = `import { one } from "./one";

export class Tiny {}

export interface Empty {}

export type Alias = string;

export const nope = 1;
`

func TestBuildKeepsShortTypesAndSkipsShortSymbols(t *testing.T) {
	file := parseOrFail(t, "src/small.ts", "TypeScript", smallTypeScript)
	chunks := Build(file, []byte(smallTypeScript))

	got := []string{}
	for _, chunk := range chunks {
		got = append(got, chunk.Kind+" "+chunk.Name)
	}

	want := "class Tiny,interface Empty,type Alias"
	if strings.Join(got, ",") != want {
		t.Errorf("chunks = [%s], want [%s]", strings.Join(got, ","), want)
	}
	for _, chunk := range chunks {
		if strings.Join(chunk.Imports, ",") != "./one" {
			t.Errorf("%s: imports = %v, want [./one]", chunk.Name, chunk.Imports)
		}
	}
}

func TestBuildSplitsLargeSymbols(t *testing.T) {
	body := strings.Repeat("    x = 1\n", 250)
	source := "def big():\n" + body
	file := parseOrFail(t, "big.py", "Python", source)

	chunks := Build(file, []byte(source))
	if len(chunks) != 3 {
		t.Fatalf("got %d chunks, want 3 for a 251 line symbol", len(chunks))
	}

	for i, chunk := range chunks {
		if chunk.Part != i+1 || chunk.Parts != 3 {
			t.Errorf("chunk %d is part %d of %d, want part %d of 3", i, chunk.Part, chunk.Parts, i+1)
		}
		if chunk.Kind != parser.KindFunction || chunk.Name != "big" {
			t.Errorf("chunk %d = %s %q, want function big", i, chunk.Kind, chunk.Name)
		}
	}

	if chunks[0].StartLine != 1 || chunks[0].EndLine != 120 {
		t.Errorf("first part spans %d..%d, want 1..120", chunks[0].StartLine, chunks[0].EndLine)
	}
	if chunks[2].StartLine != 241 || chunks[2].EndLine != 251 {
		t.Errorf("last part spans %d..%d, want 241..251", chunks[2].StartLine, chunks[2].EndLine)
	}

	joined := []string{}
	for _, chunk := range chunks {
		joined = append(joined, chunk.Source)
	}
	if strings.Join(joined, "\n") != strings.TrimRight(source, "\n") {
		t.Error("the parts do not add up to the symbol source")
	}
}

func TestBuildWholeFileChunkWhenNoSymbols(t *testing.T) {
	source := "import \"./setup\";\n"
	file := parseOrFail(t, "src/setup.ts", "TypeScript", source)

	chunks := Build(file, []byte(source))
	if len(chunks) != 1 {
		t.Fatalf("got %d chunks, want one whole file chunk", len(chunks))
	}
	if chunks[0].Kind != KindFile || chunks[0].Name != "" {
		t.Errorf("chunk = %s %q, want file with no name", chunks[0].Kind, chunks[0].Name)
	}
	if chunks[0].Source != strings.TrimRight(source, "\n") {
		t.Errorf("source = %q, want the whole file", chunks[0].Source)
	}
}

func TestBuildSkipsLargeFileWithoutSymbols(t *testing.T) {
	source := strings.Repeat("// a comment line\n", 300)
	file := parseOrFail(t, "src/noise.ts", "TypeScript", source)

	if chunks := Build(file, []byte(source)); len(chunks) != 0 {
		t.Errorf("got %d chunks, want none for a large file without symbols", len(chunks))
	}
}

func TestChunkIDsAreStableAndDistinct(t *testing.T) {
	source := "export class One {}\n\nexport class Two {}\n"
	file := parseOrFail(t, "src/ids.ts", "TypeScript", source)

	first := Build(file, []byte(source))
	second := Build(file, []byte(source))

	if len(first) != 2 || first[0].ID != second[0].ID || first[1].ID != second[1].ID {
		t.Fatal("chunk ids are not stable between runs")
	}
	if first[0].ID == first[1].ID {
		t.Error("different symbols share a chunk id")
	}
	if len(first[0].ID) != idLength {
		t.Errorf("id %q is not %d characters", first[0].ID, idLength)
	}
	if first[0].ContentHash == "" || first[1].ContentHash == "" {
		t.Error("content hash must be set")
	}
}
