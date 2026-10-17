package parser

import (
	"strings"
	"testing"
)

func parseOrFail(t *testing.T, path string, language string, source string) *File {
	t.Helper()

	file, err := Parse(path, language, []byte(source))
	if err != nil {
		t.Fatalf("Parse(%s) returned an error: %v", path, err)
	}

	return file
}

func findSymbol(file *File, kind string, name string) *Symbol {
	for i := range file.Symbols {
		if file.Symbols[i].Kind == kind && file.Symbols[i].Name == name {
			return &file.Symbols[i]
		}
	}

	return nil
}

func requireSymbol(t *testing.T, file *File, kind string, name string) *Symbol {
	t.Helper()

	sym := findSymbol(file, kind, name)
	if sym == nil {
		t.Fatalf("%s: missing %s %q, found %s", file.Path, kind, name, describeSymbols(file))
	}

	return sym
}

func describeSymbols(file *File) string {
	parts := make([]string, 0, len(file.Symbols))
	for _, sym := range file.Symbols {
		parts = append(parts, sym.Kind+" "+sym.Name)
	}

	return "[" + strings.Join(parts, ", ") + "]"
}

func requireImports(t *testing.T, file *File, want []string) {
	t.Helper()

	if strings.Join(file.Imports, ",") != strings.Join(want, ",") {
		t.Errorf("%s: imports = %v, want %v", file.Path, file.Imports, want)
	}
}

const goSample = `package demo

import (
	"fmt"
	ex "example.com/ext"
)

type Point struct {
	X int
}

type Shape interface {
	Area() float64
}

type Alias = Point

func Add(a, b int) int {
	go fmt.Println("hi")
	return a + b
}

func (p *Point) Move(dx int) {
	ex.Use()
}

func hidden() {}
`

func TestParseGo(t *testing.T) {
	file := parseOrFail(t, "internal/demo/demo.go", "Go", goSample)

	if file.Partial {
		t.Error("a valid file should not be partial")
	}
	if file.Lines != strings.Count(goSample, "\n") {
		t.Errorf("lines = %d, want %d", file.Lines, strings.Count(goSample, "\n"))
	}
	requireImports(t, file, []string{"fmt", "example.com/ext"})

	if sym := requireSymbol(t, file, KindPackage, "demo"); sym.StartLine != 1 {
		t.Errorf("package symbol on line %d, want 1", sym.StartLine)
	}
	requireSymbol(t, file, KindStruct, "Point")
	requireSymbol(t, file, KindInterface, "Shape")
	requireSymbol(t, file, KindType, "Alias")

	add := requireSymbol(t, file, KindFunction, "Add")
	if !add.Exported || !add.UsesGoroutines {
		t.Errorf("Add = exported %v goroutines %v, want both true", add.Exported, add.UsesGoroutines)
	}
	if add.StartLine != 18 || add.EndLine != 21 {
		t.Errorf("Add spans %d..%d, want 18..21", add.StartLine, add.EndLine)
	}

	move := requireSymbol(t, file, KindMethod, "Move")
	if move.Parent != "Point" {
		t.Errorf("Move parent = %q, want Point", move.Parent)
	}
	if move.UsesGoroutines {
		t.Error("Move should not use goroutines")
	}

	if requireSymbol(t, file, KindFunction, "hidden").Exported {
		t.Error("hidden should not be exported")
	}
}

const tsxSample = `import React from "react";
import { useState } from "./hooks";
import type { Foo } from "../types";

export const COUNT = 3;
export const add = (a: number, b: number) => a + b;

export function Widget(props: {}) {
  return <div>{props.x}</div>;
}

export const Card = () => <section />;

export class Store {
  get(id: string) {
    return id;
  }
}

export interface Shape { area: number; }
export type Size = "s" | "m";

export { add, COUNT };
export * from "./extra";

const local = function () { return 1; };
`

func TestParseTypeScript(t *testing.T) {
	file := parseOrFail(t, "src/widget.tsx", "TypeScript", tsxSample)

	if file.Partial {
		t.Error("a valid file should not be partial")
	}
	requireImports(t, file, []string{"react", "./hooks", "../types", "./extra"})

	if sym := requireSymbol(t, file, KindExport, "COUNT"); !sym.Exported {
		t.Error("COUNT should be exported")
	}
	if sym := requireSymbol(t, file, KindArrow, "add"); !sym.Exported {
		t.Error("add should be exported")
	}
	requireSymbol(t, file, KindComponent, "Widget")
	requireSymbol(t, file, KindComponent, "Card")

	store := requireSymbol(t, file, KindClass, "Store")
	if !store.Exported {
		t.Error("Store should be exported")
	}
	if sym := requireSymbol(t, file, KindMethod, "get"); sym.Parent != "Store" {
		t.Errorf("get parent = %q, want Store", sym.Parent)
	}

	requireSymbol(t, file, KindInterface, "Shape")
	requireSymbol(t, file, KindType, "Size")

	local := requireSymbol(t, file, KindArrow, "local")
	if local.Exported {
		t.Error("local should not be exported")
	}
}

const pySample = `import os
import os.path as p
from . import sibling
from .mod import thing
from pkg.sub import other as o

@decorator
def plain(a, b):
    return a

@one
@two
async def fetch(url):
    return url

class Base:
    pass

class Child(Base, Mixin):
    @property
    def name(self):
        return "x"

    async def run(self):
        pass
`

func TestParsePython(t *testing.T) {
	file := parseOrFail(t, "pkg/service.py", "Python", pySample)

	if file.Partial {
		t.Error("a valid file should not be partial")
	}
	requireImports(t, file, []string{"os", "os.path", ".", ".mod", "pkg.sub"})

	plain := requireSymbol(t, file, KindFunction, "plain")
	if plain.Async || strings.Join(plain.Decorators, ",") != "decorator" {
		t.Errorf("plain = async %v decorators %v", plain.Async, plain.Decorators)
	}

	fetch := requireSymbol(t, file, KindFunction, "fetch")
	if !fetch.Async || strings.Join(fetch.Decorators, ",") != "one,two" {
		t.Errorf("fetch = async %v decorators %v", fetch.Async, fetch.Decorators)
	}

	if len(requireSymbol(t, file, KindClass, "Base").Bases) != 0 {
		t.Error("Base should have no base classes")
	}
	child := requireSymbol(t, file, KindClass, "Child")
	if strings.Join(child.Bases, ",") != "Base,Mixin" {
		t.Errorf("Child bases = %v, want [Base Mixin]", child.Bases)
	}

	name := requireSymbol(t, file, KindMethod, "name")
	if name.Parent != "Child" || strings.Join(name.Decorators, ",") != "property" {
		t.Errorf("name = parent %q decorators %v", name.Parent, name.Decorators)
	}
	run := requireSymbol(t, file, KindMethod, "run")
	if run.Parent != "Child" || !run.Async {
		t.Errorf("run = parent %q async %v", run.Parent, run.Async)
	}
}

const brokenTypeScript = `import x from "./a";

export function ok() {
  return 1;
`

func TestParseBrokenFileIsPartial(t *testing.T) {
	file := parseOrFail(t, "src/broken.ts", "TypeScript", brokenTypeScript)

	if !file.Partial {
		t.Error("a file with a syntax error should be partial")
	}
	requireSymbol(t, file, KindFunction, "ok")
	requireImports(t, file, []string{"./a"})
}

func TestParseUnknownLanguage(t *testing.T) {
	if _, err := Parse("main.rb", "Ruby", []byte("puts 1")); err == nil {
		t.Error("expected an error for an unsupported language")
	}
}

func TestParseEmptyFile(t *testing.T) {
	for _, sample := range []struct {
		path     string
		language string
	}{
		{"main.go", "Go"},
		{"main.ts", "TypeScript"},
		{"main.py", "Python"},
	} {
		file := parseOrFail(t, sample.path, sample.language, "")
		if file.Partial || len(file.Symbols) != 0 {
			t.Errorf("%s: partial %v symbols %v, want an empty parse", sample.path, file.Partial, describeSymbols(file))
		}
	}
}
