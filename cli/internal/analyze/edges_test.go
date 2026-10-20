package analyze

import (
	"os"
	"path/filepath"
	"sort"
	"strings"
	"testing"
)

func writeFile(t *testing.T, path string, content string) {
	t.Helper()

	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatalf("could not create %s: %v", filepath.Dir(path), err)
	}
	if err := os.WriteFile(path, []byte(content), 0o644); err != nil {
		t.Fatalf("could not write %s: %v", path, err)
	}
}

func fixtureProject(t *testing.T) string {
	t.Helper()

	root := t.TempDir()
	writeFile(t, filepath.Join(root, "go.mod"), "module example.com/demo\n\ngo 1.22\n")
	writeFile(t, filepath.Join(root, "main.go"), `package main

import (
	"fmt"

	"example.com/demo/internal/helper"
)

func main() { fmt.Println(helper.Name()) }
`)
	writeFile(t, filepath.Join(root, "internal/helper/helper.go"), "package helper\n\nfunc Name() string { return \"x\" }\n")

	writeFile(t, filepath.Join(root, "tsconfig.json"), `{"compilerOptions":{"baseUrl":".","paths":{"@/*":["./*"]}}}`)
	writeFile(t, filepath.Join(root, "src/app.tsx"), `import React from "react";
import { helper } from "./lib/helper";
import Button from "@/components/button";

export function App() {
  return <div>{helper()}<Button /></div>;
}
`)
	writeFile(t, filepath.Join(root, "src/lib/helper.ts"), "export function helper() { return 1; }\n")
	writeFile(t, filepath.Join(root, "components/button.tsx"), "export function Button() { return <button />; }\n")

	writeFile(t, filepath.Join(root, "pkg/service.py"), `import os
from . import util
from .models import Thing


def run():
    return os.getcwd()
`)
	writeFile(t, filepath.Join(root, "pkg/util.py"), "def util():\n    return 1\n")
	writeFile(t, filepath.Join(root, "pkg/models.py"), "class Thing:\n    pass\n")

	return root
}

func TestRunResolvesFileEdges(t *testing.T) {
	result, err := Run(fixtureProject(t), Options{})
	if err != nil {
		t.Fatalf("Run returned an error: %v", err)
	}

	got := []string{}
	for _, edge := range result.Edges {
		got = append(got, edge.From+" -> "+edge.To)
	}

	want := []string{
		"main.go -> internal/helper/helper.go",
		"pkg/service.py -> pkg/models.py",
		"pkg/service.py -> pkg/util.py",
		"src/app.tsx -> components/button.tsx",
		"src/app.tsx -> src/lib/helper.ts",
	}
	sort.Strings(want)
	if strings.Join(got, ",") != strings.Join(want, ",") {
		t.Errorf("edges =\n  %s\nwant\n  %s", strings.Join(got, "\n  "), strings.Join(want, "\n  "))
	}

	if strings.Join(result.External, ",") != "react" {
		t.Errorf("external = %v, want [react]", result.External)
	}
}

func TestStandardLibraryIsNotExternal(t *testing.T) {
	cases := []struct {
		language string
		spec     string
		want     bool
	}{
		{"Go", "fmt", true},
		{"Go", "encoding/json", true},
		{"Go", "net/http", true},
		{"Go", "github.com/gin-gonic/gin", false},
		{"Go", "gopkg.in/yaml.v3", false},
		{"Go", "golang.org/x/text", false},
		{"TypeScript", "node:crypto", true},
		{"TypeScript", "fs", true},
		{"TypeScript", "fs/promises", true},
		{"TypeScript", "path", true},
		{"TypeScript", "react", false},
		{"TypeScript", "next/link", false},
		{"TypeScript", "@/lib/db", false},
		{"JavaScript", "node:zlib", true},
		{"JavaScript", "chalk", false},
		{"Python", "os", true},
		{"Python", "os.path", true},
		{"Python", "collections.abc", true},
		{"Python", "requests", false},
		{"Python", "flask.views", false},
		{"Python", ".models", false},
	}

	for _, tc := range cases {
		if got := isStandardLibrary(tc.language, tc.spec); got != tc.want {
			t.Errorf("isStandardLibrary(%q, %q) = %v, want %v", tc.language, tc.spec, got, tc.want)
		}
	}
}

func TestRunFiltersLanguages(t *testing.T) {
	result, err := Run(fixtureProject(t), Options{Languages: []string{"Go"}})
	if err != nil {
		t.Fatalf("Run returned an error: %v", err)
	}

	if len(result.Files) != 2 {
		t.Fatalf("parsed %d files, want only the two Go files", len(result.Files))
	}
	for _, file := range result.Files {
		if file.Language != "Go" {
			t.Errorf("%s has language %q, want Go", file.Path, file.Language)
		}
	}
}

func TestParseLanguages(t *testing.T) {
	languages, err := ParseLanguages("go, ts,py,ts")
	if err != nil {
		t.Fatalf("ParseLanguages returned an error: %v", err)
	}
	if strings.Join(languages, ",") != "Go,TypeScript,Python" {
		t.Errorf("languages = %v, want [Go TypeScript Python]", languages)
	}

	if _, err := ParseLanguages("ruby"); err == nil {
		t.Error("expected an error for an unknown language")
	}
}

func TestRunNeverParsesSecretFiles(t *testing.T) {
	root := fixtureProject(t)
	writeFile(t, filepath.Join(root, "credentials.json"), `{"token":"super-secret"}`)
	writeFile(t, filepath.Join(root, "secrets.yaml"), "token: super-secret\n")

	result, err := Run(root, Options{})
	if err != nil {
		t.Fatalf("Run returned an error: %v", err)
	}

	for _, file := range result.Files {
		if strings.HasPrefix(file.Path, "credentials") || strings.HasPrefix(file.Path, "secrets") {
			t.Errorf("%s should never be parsed", file.Path)
		}
	}
	for _, chunk := range result.Chunks {
		if strings.Contains(chunk.Source, "super-secret") {
			t.Errorf("secret content leaked into chunk %s", chunk.ID)
		}
	}
	if result.Report.Skipped["secret"] != 2 {
		t.Errorf("skipped secrets = %d, want 2", result.Report.Skipped["secret"])
	}
}

func TestSubfolderGoModuleIsInternal(t *testing.T) {
	t.Helper()

	root := t.TempDir()
	writeFile(t, filepath.Join(root, "go.mod"), "module example.com/demo\n\ngo 1.22\n")
	writeFile(t, filepath.Join(root, "cli", "go.mod"), "module example.com/demo/cli\n\ngo 1.22\n")
	writeFile(t, filepath.Join(root, "cli", "internal", "parser", "parser.go"), "package parser\n\nfunc Parse() {}\n")
	writeFile(t, filepath.Join(root, "cli", "main.go"), `package main

import (
	"fmt"

	"example.com/demo/cli/internal/parser"
)

func main() { fmt.Println(parser.Parse()) }
`)

	result, err := Run(root, Options{})
	if err != nil {
		t.Fatalf("Run returned an error: %v", err)
	}

	got := []string{}
	for _, edge := range result.Edges {
		got = append(got, edge.From+" -> "+edge.To)
	}
	sort.Strings(got)

	want := []string{"cli/main.go -> cli/internal/parser/parser.go"}
	sort.Strings(want)
	if strings.Join(got, ",") != strings.Join(want, ",") {
		t.Errorf("edges =\n  %s\nwant\n  %s", strings.Join(got, "\n  "), strings.Join(want, "\n  "))
	}
}
