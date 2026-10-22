import assert from "node:assert/strict"
import { test } from "node:test"
import {
  computeDeterministicGuide,
  entryPointType,
  moduleLabel,
  semanticModuleLabel,
  toGuidePayload,
  validateAIOutput,
} from "./guide.ts"
import { buildGraphModel } from "./graph.ts"

function makeGraph(files: { path: string; language: string }[], edges: { from: string; to: string }[]) {
  return buildGraphModel(
    files.map((f) => ({ ...f, lineCount: 10, partial: false, chunkCount: 1 })),
    edges.map((e) => ({ fromPath: e.from, toPath: e.to }))
  )
}

test("entryPointType detects Next.js App Router page", () => {
  const r = entryPointType("app/page.tsx")
  assert.equal(r?.type, "nextjs-page")
  assert.ok(r?.reason.includes("Next.js"))
})

test("entryPointType detects Next.js Pages Router index", () => {
  const r = entryPointType("pages/index.tsx")
  assert.equal(r?.type, "nextjs-pages-index")
})

test("entryPointType detects Go main", () => {
  const r = entryPointType("cmd/server/main.go")
  assert.equal(r?.type, "go-main")
})

test("entryPointType detects Python main", () => {
  assert.equal(entryPointType("main.py")?.type, "python-main")
  assert.equal(entryPointType("app.py")?.type, "python-main")
})

test("moduleLabel groups src/packages and src/apps", () => {
  assert.equal(moduleLabel("src/packages/auth/index.ts"), "packages/auth")
  assert.equal(moduleLabel("src/apps/dashboard/page.tsx"), "apps/dashboard")
})

test("semanticModuleLabel groups by keywords", () => {
  assert.equal(semanticModuleLabel("lib/auth.ts"), "auth")
  assert.equal(semanticModuleLabel("app/api/payments/route.ts"), "payments")
  assert.equal(semanticModuleLabel("components/ui/button.tsx"), "ui")
  assert.equal(semanticModuleLabel("lib/db.ts"), "database")
  assert.equal(semanticModuleLabel("cli/main.go"), "cli")
})

test("computeDeterministicGuide ranks entry points first", () => {
  const model = makeGraph(
    [
      { path: "app/page.tsx", language: "TypeScript" },
      { path: "lib/db.ts", language: "TypeScript" },
      { path: "lib/auth.ts", language: "TypeScript" },
    ],
    [
      { from: "app/page.tsx", to: "lib/db.ts" },
      { from: "app/page.tsx", to: "lib/auth.ts" },
    ]
  )
  const guide = computeDeterministicGuide(model, { description: "Test project" })
  assert.ok(guide.readingList[0].path === "app/page.tsx")
  assert.ok(guide.readingList[0].reason.includes("Entry point"))
})

test("computeDeterministicGuide reading list size 5-8", () => {
  const files = Array.from({ length: 10 }, (_, i) => ({ path: `lib/file${i}.ts`, language: "TypeScript" }))
  const edges = files.slice(1).map((f) => ({ from: "lib/file0.ts", to: f.path }))
  const model = makeGraph(files, edges)
  const guide = computeDeterministicGuide(model, {})
  assert.ok(guide.readingList.length >= 5)
  assert.ok(guide.readingList.length <= 8)
})

test("computeDeterministicGuide excludes test and config roles", () => {
  const model = makeGraph(
    [
      { path: "lib/main.ts", language: "TypeScript" },
      { path: "lib/utils.test.ts", language: "TypeScript" },
      { path: "tsconfig.json", language: "JSON" },
    ],
    [{ from: "lib/main.ts", to: "lib/utils.test.ts" }]
  )
  const guide = computeDeterministicGuide(model, {})
  const paths = guide.readingList.map((r) => r.path)
  assert.ok(!paths.includes("lib/utils.test.ts"))
  assert.ok(!paths.includes("tsconfig.json"))
})

test("validateAIOutput rejects unknown paths", () => {
  const candidates = ["lib/a.ts", "lib/b.ts"]
  const bad = {
    what_for: "test",
    modules: [{ name: "lib", purpose: "core" }],
    reading_list: [
      { path: "lib/unknown.ts", reason: "x" },
      { path: "lib/a.ts", reason: "y" },
      { path: "lib/b.ts", reason: "z" },
      { path: "lib/a.ts", reason: "w" },
      { path: "lib/b.ts", reason: "v" },
    ],
    flow: "a -> b",
    careful: [],
  }
  const r = validateAIOutput(bad, candidates)
  assert.equal(r.ok, false)
  assert.ok(r.error?.includes("not in candidates"))
})

test("validateAIOutput rejects reason too long", () => {
  const candidates = ["lib/a.ts"]
  const bad = {
    what_for: "test",
    modules: [{ name: "lib", purpose: "core" }],
    reading_list: [
      { path: "lib/a.ts", reason: "x".repeat(150) },
      { path: "lib/a.ts", reason: "y" },
      { path: "lib/a.ts", reason: "z" },
      { path: "lib/a.ts", reason: "w" },
      { path: "lib/a.ts", reason: "v" },
    ],
    flow: "a -> b",
    careful: [],
  }
  const r = validateAIOutput(bad, candidates)
  assert.equal(r.ok, false)
  assert.ok(r.error?.includes("140"))
})

test("validateAIOutput accepts valid output", () => {
  const candidates = ["lib/a.ts", "lib/b.ts"]
  const good = {
    what_for: "test project",
    modules: [{ name: "lib", purpose: "core library" }],
    reading_list: [
      { path: "lib/a.ts", reason: "Entry point" },
      { path: "lib/b.ts", reason: "Core module" },
      { path: "lib/a.ts", reason: "Shared types" },
      { path: "lib/b.ts", reason: "Utils" },
      { path: "lib/a.ts", reason: "Config" },
    ],
    flow: "lib -> lib",
    careful: [{ path: "lib/a.ts", advice: "Hotspot" }],
  }
  const r = validateAIOutput(good, candidates)
  assert.equal(r.ok, true)
})

test("toGuidePayload normalizes camelCase deterministic guide", () => {
  const guide = {
    whatFor: "A test project",
    modules: [{ name: "lib", fileCount: 3, topFiles: ["lib/a.ts"] }],
    readingList: [{ path: "lib/a.ts", reason: "Entry" }],
    flow: "lib -> lib",
    careful: [{ path: "lib/a.ts", advice: "Hotspot" }],
  }
  const payload = toGuidePayload(guide)
  assert.equal(payload.what_for, "A test project")
  assert.equal(payload.reading_list.length, 1)
  assert.equal(payload.reading_list[0].path, "lib/a.ts")
  assert.equal(payload.modules[0].purpose, "")
  assert.equal(payload.flow, "lib -> lib")
})

test("toGuidePayload accepts already snake_case payload", () => {
  const payload = toGuidePayload({
    what_for: "Already snake",
    modules: [{ name: "app", purpose: "UI", fileCount: 1, topFiles: [] }],
    reading_list: [{ path: "app/page.tsx", reason: "Entry" }],
    flow: "app",
    careful: [],
  })
  assert.equal(payload.what_for, "Already snake")
  assert.equal(payload.modules[0].purpose, "UI")
  assert.deepEqual(payload.careful, [])
})