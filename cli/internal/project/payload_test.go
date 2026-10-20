package project

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/nebioudaniel/HULU_Code/cli/internal/analyze"
	"github.com/nebioudaniel/HULU_Code/cli/internal/chunker"
	"github.com/nebioudaniel/HULU_Code/cli/internal/parser"
)

const secretSource = `func transfer(db *sql.DB) {
	password := "super-secret-password"
	apiKey := "hulu_sk_live_do_not_upload"
	_ = password
	_ = apiKey
}`

func sampleResult() *analyze.Result {
	return &analyze.Result{
		Files: []parser.File{
			{Path: "pkg/transfer.go", Language: "Go", Lines: 6, Partial: false},
			{Path: "web/app.tsx", Language: "TypeScript", Lines: 12, Partial: true},
		},
		Chunks: []chunker.Chunk{
			{
				ID:          "9f2c1b7a4e6d8c0a",
				Path:        "pkg/transfer.go",
				Language:    "Go",
				Kind:        "function",
				Name:        "transfer",
				StartLine:   1,
				EndLine:     6,
				Source:      secretSource,
				ContentHash: "f00dbabe12345678",
			},
		},
		Edges:          []analyze.Edge{{From: "web/app.tsx", To: "pkg/transfer.go"}},
		External:       []string{"database/sql", "react"},
		ExternalCounts: map[string]int{"database/sql": 3, "react": 1},
	}
}

func TestBuildNeverIncludesSource(t *testing.T) {
	payload := Build(sampleResult(), Meta{Name: "demo", RootHash: "aabbccddeeff0011"}, "0.1.0")

	encoded, err := json.Marshal(payload)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	text := string(encoded)

	for _, forbidden := range []string{
		"super-secret-password",
		"hulu_sk_live_do_not_upload",
		"func transfer",
		"password :=",
	} {
		if strings.Contains(text, forbidden) {
			t.Fatalf("payload leaked source text %q", forbidden)
		}
	}

	if !strings.Contains(text, "f00dbabe12345678") {
		t.Fatal("payload should include the content hash")
	}
}

func TestBuildCopiesStructure(t *testing.T) {
	payload := Build(sampleResult(), Meta{Name: "demo", RootHash: "aabbccddeeff0011"}, "0.1.0")

	if len(payload.Files) != 2 {
		t.Fatalf("files = %d, want 2", len(payload.Files))
	}
	if payload.Files[1].Partial != true {
		t.Error("partial flag was not copied")
	}
	if len(payload.Chunks) != 1 || payload.Chunks[0].Key != "9f2c1b7a4e6d8c0a" {
		t.Fatalf("chunks = %+v", payload.Chunks)
	}
	if len(payload.Edges) != 1 || payload.Edges[0].To != "pkg/transfer.go" {
		t.Fatalf("edges = %+v", payload.Edges)
	}
	if len(payload.External) != 2 {
		t.Fatalf("external = %+v", payload.External)
	}
	if payload.External[0].Name != "database" || payload.External[0].Count != 3 {
		t.Errorf("external[0] = %+v", payload.External[0])
	}
	if payload.External[1].Name != "react" || payload.External[1].Count != 1 {
		t.Errorf("external[1] = %+v", payload.External[1])
	}
	if payload.CLIVersion != "0.1.0" {
		t.Errorf("cli version = %q", payload.CLIVersion)
	}
}

func TestRootHashIsStableAndHidesPath(t *testing.T) {
	first, err := RootHash(".")
	if err != nil {
		t.Fatalf("root hash: %v", err)
	}
	second, err := RootHash(".")
	if err != nil {
		t.Fatalf("root hash: %v", err)
	}

	if first != second {
		t.Fatal("root hash should be stable for the same directory")
	}
	if len(first) != 64 {
		t.Fatalf("root hash length = %d, want 64", len(first))
	}
}

func TestNameFallsBack(t *testing.T) {
	if got := Name("."); got == "" {
		t.Fatal("name should not be empty")
	}
}
