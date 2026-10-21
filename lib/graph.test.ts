import assert from "node:assert/strict"
import { test } from "node:test"

import {
  buildGraphModel,
  fileRole,
  folderColorClass,
  impactAnalysis,
  paginate,
  parseURLState,
  riskScore,
  roleColorClass,
  writeURLState,
} from "./graph.ts"

test("fileRole identifies api-route", () => {
  assert.equal(fileRole("app/api/route.ts"), "api-route")
  assert.equal(fileRole("app/api/route.js"), "api-route")
})

test("fileRole identifies page/layout", () => {
  assert.equal(fileRole("app/page.tsx"), "page")
  assert.equal(fileRole("app/page.jsx"), "page")
  assert.equal(fileRole("app/layout.ts"), "layout")
})

test("fileRole identifies hook/component/ui-primitive/test", () => {
  assert.equal(fileRole("components/use-hook.ts"), "hook")
  assert.equal(fileRole("components/button.tsx"), "component")
  assert.equal(fileRole("components/ui/button.tsx"), "ui-primitive")
  assert.equal(fileRole("components/button.test.ts"), "test")
  assert.equal(fileRole("components/_test/helper.ts"), "test")
})

test("fileRole identifies config/cli/backend/other", () => {
  assert.equal(fileRole("package.json"), "config")
  assert.equal(fileRole("tsconfig.json"), "config")
  assert.equal(fileRole("cli/main.go"), "cli")
  assert.equal(fileRole("backend/service.go"), "backend")
  assert.equal(fileRole("README.md"), "other")
})

test("buildGraphModel computes degrees and hotspots", () => {
  const files = [
    { path: "a.ts", language: "TypeScript", lineCount: 10, partial: false, chunkCount: 1 },
    { path: "b.ts", language: "TypeScript", lineCount: 10, partial: false, chunkCount: 1 },
    { path: "c.ts", language: "TypeScript", lineCount: 10, partial: false, chunkCount: 1 },
  ]
  const edges = [
    { fromPath: "a.ts", toPath: "b.ts" },
    { fromPath: "b.ts", toPath: "c.ts" },
    { fromPath: "a.ts", toPath: "c.ts" },
  ]
  const model = buildGraphModel(files, edges)
  assert.equal(model.totalFiles, 3)
  assert.equal(model.totalImports, 3)
  assert.equal(model.nodes.get("a.ts")!.outDegree, 2)
  assert.equal(model.nodes.get("c.ts")!.inDegree, 2)
  assert.equal(model.nodes.get("c.ts")!.inDegree, 2)
  assert.equal(model.nodes.get("c.ts")!.outDegree, 0)
  assert.equal(model.orphans.length, 0)
})

test("buildGraphModel detects orphans and cycles", () => {
  const files = [
    { path: "a.ts", language: "TypeScript", lineCount: 1, partial: false, chunkCount: 1 },
    { path: "b.ts", language: "TypeScript", lineCount: 1, partial: false, chunkCount: 1 },
    { path: "c.ts", language: "TypeScript", lineCount: 1, partial: false, chunkCount: 1 },
    { path: "orphan.ts", language: "TypeScript", lineCount: 1, partial: false, chunkCount: 1 },
  ]
  const edges = [
    { fromPath: "a.ts", toPath: "b.ts" },
    { fromPath: "b.ts", toPath: "a.ts" },
  ]
  const model = buildGraphModel(files, edges)
  assert.equal(model.sccs.length, 1)
  assert.deepEqual(model.sccs[0], ["a.ts", "b.ts"])
  assert.equal(model.orphans.length, 2)
  assert.ok(model.orphans.includes("c.ts"))
  assert.ok(model.orphans.includes("orphan.ts"))
})

test("impactAnalysis BFS depth and risk buckets", () => {
  const files = [
    { path: "a.ts", language: "TypeScript", lineCount: 1, partial: false, chunkCount: 1 },
    { path: "b.ts", language: "TypeScript", lineCount: 1, partial: false, chunkCount: 1 },
    { path: "c.ts", language: "TypeScript", lineCount: 1, partial: false, chunkCount: 1 },
    { path: "d.ts", language: "TypeScript", lineCount: 1, partial: false, chunkCount: 1 },
  ]
  const edges = [
    { fromPath: "b.ts", toPath: "a.ts" },
    { fromPath: "c.ts", toPath: "b.ts" },
    { fromPath: "d.ts", toPath: "c.ts" },
  ]
  const model = buildGraphModel(files, edges)
  const result = impactAnalysis(model, ["a.ts"], 4)
  assert.equal(result.total, 3)
  assert.equal(result.direct, 1) // b
  assert.equal(result.indirect, 2) // c, d
  assert.equal(result.affected[0].id, "b.ts")
  assert.equal(result.affected[1].id, "c.ts")
  assert.equal(result.affected[2].id, "d.ts")
  assert.equal(result.affected[2].depth, 3)

  // depth 1 should stop at b
  const result1 = impactAnalysis(model, ["a.ts"], 1)
  assert.equal(result1.total, 1)
})

test("riskScore levels and formula", () => {
  const files = [
    { path: "a.ts", language: "TypeScript", lineCount: 1, partial: false, chunkCount: 1 },
    { path: "b.ts", language: "TypeScript", lineCount: 1, partial: false, chunkCount: 1 },
    { path: "c.ts", language: "TypeScript", lineCount: 1, partial: false, chunkCount: 1 },
  ]
  const edges = [
    { fromPath: "b.ts", toPath: "a.ts" },
    { fromPath: "c.ts", toPath: "a.ts" },
  ]
  const model = buildGraphModel(files, edges)

  // a has 2 direct dependents -> 5 points, not hotspot (only 3 nodes)
  const r = riskScore(model, ["a.ts"], 4)
  assert.equal(r.level, "Low")
  assert.ok(r.score < 30)
  assert.equal(r.reasons[0].label, "Direct dependents")
  assert.equal(r.reasons[0].points, 5)

  // make a a hotspot by adding more nodes so a is top
  const manyFiles = [
    { path: "a.ts", language: "TypeScript", lineCount: 1, partial: false, chunkCount: 1 },
    { path: "z1.ts", language: "TypeScript", lineCount: 1, partial: false, chunkCount: 1 },
    { path: "z2.ts", language: "TypeScript", lineCount: 1, partial: false, chunkCount: 1 },
  ]
  const manyEdges = [
    { fromPath: "z1.ts", toPath: "a.ts" },
    { fromPath: "z2.ts", toPath: "a.ts" },
  ]
  const model2 = buildGraphModel(manyFiles, manyEdges)
  const r2 = riskScore(model2, ["a.ts"], 4)
  assert.ok(r2.reasons.some((r) => r.label === "Top-10 hotspot"))
})

test("paginate math", () => {
  const p = paginate(144, 3, 25)
  assert.equal(p.total, 144)
  assert.equal(p.page, 3)
  assert.equal(p.totalPages, 6)
  assert.equal(p.start, 51)
  assert.equal(p.end, 75)
  assert.ok(p.hasPrev)
  assert.ok(p.hasNext)

  const pLast = paginate(144, 6, 25)
  assert.equal(pLast.end, 144)
  assert.ok(!pLast.hasNext)

  const pEmpty = paginate(0, 1, 25)
  assert.equal(pEmpty.start, 0)
  assert.equal(pEmpty.end, 0)
  assert.equal(pEmpty.totalPages, 1)
})

test("URL state parse and write round-trip", () => {
  const params = new URLSearchParams(
    "tab=graph&page=2&pageSize=50&search=foo&filter=lang&sort=lines&selected=app/page.tsx&changeSet=a.ts,b.ts"
  )
  const state = parseURLState(params)
  assert.equal(state.tab, "graph")
  assert.equal(state.page, 2)
  assert.equal(state.pageSize, 50)
  assert.equal(state.search, "foo")
  assert.equal(state.filter, "lang")
  assert.equal(state.sort, "lines")
  assert.equal(state.selected, "app/page.tsx")
  assert.deepEqual(state.changeSet, ["a.ts", "b.ts"])

  const url = writeURLState("/dashboard/projects/x", {
    tab: state.tab,
    page: state.page,
    pageSize: state.pageSize,
    search: state.search,
    filter: state.filter,
    sort: state.sort,
    selected: state.selected,
    changeSet: state.changeSet,
  })
  const roundTrip = parseURLState(new URLSearchParams(url.split("?")[1]))
  assert.deepEqual(roundTrip, state)
})

test("folderColorClass and roleColorClass return graph colors", () => {
  assert.ok(folderColorClass("app").startsWith("--graph-"))
  assert.ok(roleColorClass("api-route").startsWith("--graph-"))
})
