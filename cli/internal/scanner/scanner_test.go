package scanner

import (
	"bytes"
	"os"
	"path/filepath"
	"sort"
	"testing"
)

func writeFile(t *testing.T, path string, data []byte) {
	t.Helper()

	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatalf("could not create directory for %s: %v", path, err)
	}
	if err := os.WriteFile(path, data, 0o644); err != nil {
		t.Fatalf("could not write %s: %v", path, err)
	}
}

func keptPaths(t *testing.T, report *Report) []string {
	t.Helper()

	paths := make([]string, 0, len(report.Files))
	for _, file := range report.Files {
		paths = append(paths, file.Path)
	}
	sort.Strings(paths)

	return paths
}

func scanOrFail(t *testing.T, root string) *Report {
	t.Helper()

	report, err := Scan(root)
	if err != nil {
		t.Fatalf("Scan(%q) returned an error: %v", root, err)
	}

	return report
}

func TestIsSecretFile(t *testing.T) {
	secret := []string{
		".env", ".env.local", ".env.production", ".env.go",
		"server.pem", "server.KEY", "tls.p12", "app.pfx", "cert.crt", "cert.cer",
		"id_rsa", "id_rsa.pub", "id_rsa.go", "id_ed25519", "id_ed25519_backup",
		"release.keystore", "credentials.json", "credentials", "credentials.yml",
		"secrets", "secrets.json", "secrets.yaml", "Secrets.TOML",
		".npmrc", ".netrc",
	}
	for _, name := range secret {
		if !IsSecretFile(name) {
			t.Errorf("IsSecretFile(%q) = false, want true", name)
		}
	}

	plain := []string{
		"main.go", "app.ts", ".gitignore", "environment.go", "keyboard.js",
		"certs.md", "secret_santa.py", "id.go", "key.pem.txt",
		"secrets.go", "credentials.ts", "credentials.py", "secrets.tsx", "Secrets.JS",
	}
	for _, name := range plain {
		if IsSecretFile(name) {
			t.Errorf("IsSecretFile(%q) = true, want false", name)
		}
	}
}

func TestSourcePrefixSecretRuleKeepsSourceFiles(t *testing.T) {
	for _, name := range []string{"secrets.go", "credentials.ts", "secrets.py"} {
		if !IsSourceFile(name) {
			t.Errorf("IsSourceFile(%q) = false, want true", name)
		}
		if IsSecretFile(name) {
			t.Errorf("IsSecretFile(%q) = true, want the source file to be scanned", name)
		}
	}

	for _, name := range []string{"secrets.json", "credentials.yml", "secrets"} {
		if IsSourceFile(name) {
			t.Errorf("IsSourceFile(%q) = true, want false", name)
		}
		if !IsSecretFile(name) {
			t.Errorf("IsSecretFile(%q) = false, want true", name)
		}
	}
}

func TestLanguageFor(t *testing.T) {
	wanted := map[string]string{
		"main.go":      "Go",
		"app.ts":       "TypeScript",
		"page.tsx":     "TypeScript",
		"index.js":     "JavaScript",
		"widget.jsx":   "JavaScript",
		"module.mjs":   "JavaScript",
		"script.py":    "Python",
		"MAIN.GO":      "Go",
		"component.TS": "TypeScript",
	}
	for name, want := range wanted {
		got, ok := LanguageFor(name)
		if !ok || got != want {
			t.Errorf("LanguageFor(%q) = (%q, %v), want (%q, true)", name, got, ok, want)
		}
	}

	unsupported := []string{"README.md", "style.css", "data.json", "archive.mjsx", "Makefile", "noextension", "app.ts.map"}
	for _, name := range unsupported {
		if language, ok := LanguageFor(name); ok {
			t.Errorf("LanguageFor(%q) = (%q, true), want unsupported", name, language)
		}
	}
}

func TestIsBinary(t *testing.T) {
	if IsBinary([]byte("package main\n\nfunc main() {}\n")) {
		t.Error("plain source was reported as binary")
	}
	if !IsBinary([]byte("PK\x03\x04\x00\x00binary")) {
		t.Error("data containing a NUL byte was not reported as binary")
	}

	late := append(bytes.Repeat([]byte{'a'}, binaryProbeSize+512), 0)
	if IsBinary(late) {
		t.Error("a NUL byte after the first 8 KB must not mark a file as binary")
	}
	if !IsBinary(append(bytes.Repeat([]byte{'a'}, binaryProbeSize-1), 0)) {
		t.Error("a NUL byte inside the first 8 KB must mark a file as binary")
	}
}

func TestCountLines(t *testing.T) {
	cases := []struct {
		data  string
		lines int
	}{
		{"", 0},
		{"a", 1},
		{"a\n", 1},
		{"a\nb\n", 2},
		{"a\nb", 2},
		{"a\nb\nc", 3},
		{"\n", 1},
	}
	for _, testCase := range cases {
		if got := CountLines([]byte(testCase.data)); got != testCase.lines {
			t.Errorf("CountLines(%q) = %d, want %d", testCase.data, got, testCase.lines)
		}
	}
}

func TestScanSkipsNoiseDirectories(t *testing.T) {
	root := t.TempDir()
	writeFile(t, filepath.Join(root, "src", "main.go"), []byte("package main\n"))

	for _, dir := range []string{
		".git", "node_modules", "vendor", ".next", "dist", "build", "out",
		"target", "__pycache__", ".venv", "venv", ".idea", ".vscode", "coverage",
	} {
		writeFile(t, filepath.Join(root, dir, "noise.go"), []byte("package noise\n"))
	}

	report := scanOrFail(t, root)

	got := keptPaths(t, report)
	if len(got) != 1 || got[0] != "src/main.go" {
		t.Errorf("kept %v, want [src/main.go]", got)
	}
}

func TestScanRespectsGitignore(t *testing.T) {
	root := t.TempDir()
	writeFile(t, filepath.Join(root, ".gitignore"), []byte("skipped.go\nnested/also_skipped.ts\n"))
	writeFile(t, filepath.Join(root, "kept.go"), []byte("package main\n"))
	writeFile(t, filepath.Join(root, "skipped.go"), []byte("package main\n"))
	writeFile(t, filepath.Join(root, "nested", ".gitignore"), []byte("local_skip.go\n"))
	writeFile(t, filepath.Join(root, "nested", "also_skipped.ts"), []byte("export {}\n"))
	writeFile(t, filepath.Join(root, "nested", "local_skip.go"), []byte("package nested\n"))
	writeFile(t, filepath.Join(root, "nested", "nested_kept.go"), []byte("package nested\n"))

	report := scanOrFail(t, root)

	want := []string{"kept.go", "nested/nested_kept.go"}
	got := keptPaths(t, report)
	if len(got) != len(want) {
		t.Fatalf("kept %v, want %v", got, want)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("kept %v, want %v", got, want)
		}
	}

	if report.Skipped[ReasonIgnored] != 3 {
		t.Errorf("ignored count = %d, want 3", report.Skipped[ReasonIgnored])
	}
}

func TestScanSkipsSecrets(t *testing.T) {
	root := t.TempDir()
	writeFile(t, filepath.Join(root, "main.go"), []byte("package main\n"))
	writeFile(t, filepath.Join(root, ".env"), []byte("TOKEN=super-secret-value\n"))
	writeFile(t, filepath.Join(root, "server.pem"), []byte("-----BEGIN KEY-----\n"))
	writeFile(t, filepath.Join(root, "secrets.json"), []byte("{}\n"))
	writeFile(t, filepath.Join(root, "credentials.yml"), []byte("user: x\n"))
	writeFile(t, filepath.Join(root, "nested", "id_rsa"), []byte("private\n"))

	report := scanOrFail(t, root)

	got := keptPaths(t, report)
	if len(got) != 1 || got[0] != "main.go" {
		t.Errorf("kept %v, want [main.go]", got)
	}
	if report.Skipped[ReasonSecret] != 5 {
		t.Errorf("secret count = %d, want 5", report.Skipped[ReasonSecret])
	}
}

func TestScanScansSecretNamedSourceFiles(t *testing.T) {
	root := t.TempDir()
	writeFile(t, filepath.Join(root, "secrets.go"), []byte("package secrets\n"))
	writeFile(t, filepath.Join(root, "credentials.ts"), []byte("export const a = 1\n"))

	report := scanOrFail(t, root)

	got := keptPaths(t, report)
	if len(got) != 2 {
		t.Fatalf("kept %v, want source files named secrets/credentials to be scanned", got)
	}
	if report.Skipped[ReasonSecret] != 0 {
		t.Errorf("secret count = %d, want 0", report.Skipped[ReasonSecret])
	}
}

func TestScanFiltersUnsupportedExtensions(t *testing.T) {
	root := t.TempDir()
	writeFile(t, filepath.Join(root, "main.go"), []byte("package main\n"))
	writeFile(t, filepath.Join(root, "README.md"), []byte("# hi\n"))
	writeFile(t, filepath.Join(root, "style.css"), []byte("body{}\n"))
	writeFile(t, filepath.Join(root, "data.json"), []byte("{}\n"))

	report := scanOrFail(t, root)

	got := keptPaths(t, report)
	if len(got) != 1 || got[0] != "main.go" {
		t.Errorf("kept %v, want [main.go]", got)
	}
	if report.Skipped[ReasonUnsupported] != 3 {
		t.Errorf("unsupported count = %d, want 3", report.Skipped[ReasonUnsupported])
	}
}

func TestScanSkipsBinaryFiles(t *testing.T) {
	root := t.TempDir()
	writeFile(t, filepath.Join(root, "main.go"), []byte("package main\n"))
	writeFile(t, filepath.Join(root, "blob.go"), []byte("package main\x00\x01\n"))

	report := scanOrFail(t, root)

	got := keptPaths(t, report)
	if len(got) != 1 || got[0] != "main.go" {
		t.Errorf("kept %v, want [main.go]", got)
	}
	if report.Skipped[ReasonBinary] != 1 {
		t.Errorf("binary count = %d, want 1", report.Skipped[ReasonBinary])
	}
}

func TestScanSkipsLargeFiles(t *testing.T) {
	root := t.TempDir()
	writeFile(t, filepath.Join(root, "main.go"), []byte("package main\n"))
	writeFile(t, filepath.Join(root, "big.go"), bytes.Repeat([]byte{'a'}, maxFileSize+1))
	writeFile(t, filepath.Join(root, "edge.go"), bytes.Repeat([]byte{'a'}, maxFileSize))

	report := scanOrFail(t, root)

	got := keptPaths(t, report)
	want := []string{"edge.go", "main.go"}
	if len(got) != len(want) || got[0] != want[0] || got[1] != want[1] {
		t.Errorf("kept %v, want %v", got, want)
	}
	if report.Skipped[ReasonTooLarge] != 1 {
		t.Errorf("too_large count = %d, want 1", report.Skipped[ReasonTooLarge])
	}
}

func TestScanDoesNotFollowSymlinks(t *testing.T) {
	root := t.TempDir()
	writeFile(t, filepath.Join(root, "main.go"), []byte("package main\n"))

	if err := os.Symlink(filepath.Join(root, "main.go"), filepath.Join(root, "linked.go")); err != nil {
		t.Skipf("this system does not support symlinks: %v", err)
	}

	report := scanOrFail(t, root)

	got := keptPaths(t, report)
	if len(got) != 1 || got[0] != "main.go" {
		t.Errorf("kept %v, want [main.go]", got)
	}
	if report.Skipped[ReasonSymlink] != 1 {
		t.Errorf("symlink count = %d, want 1", report.Skipped[ReasonSymlink])
	}
}

func TestScanCountsLanguagesAndLines(t *testing.T) {
	root := t.TempDir()
	writeFile(t, filepath.Join(root, "main.go"), []byte("package main\n\nfunc main() {}\n"))
	writeFile(t, filepath.Join(root, "app.ts"), []byte("export const a = 1\nexport const b = 2\n"))
	writeFile(t, filepath.Join(root, "page.tsx"), []byte("export default function Page() {}\n"))
	writeFile(t, filepath.Join(root, "script.py"), []byte("print('hi')\n"))

	report := scanOrFail(t, root)

	if report.Kept != 4 {
		t.Errorf("kept = %d, want 4", report.Kept)
	}
	if report.Languages["Go"] != 1 {
		t.Errorf("Go count = %d, want 1", report.Languages["Go"])
	}
	if report.Languages["TypeScript"] != 2 {
		t.Errorf("TypeScript count = %d, want 2", report.Languages["TypeScript"])
	}
	if report.Languages["Python"] != 1 {
		t.Errorf("Python count = %d, want 1", report.Languages["Python"])
	}
	if report.TotalLines != 3+2+1+1 {
		t.Errorf("total lines = %d, want %d", report.TotalLines, 3+2+1+1)
	}
}

func TestScanRejectsNonDirectories(t *testing.T) {
	root := t.TempDir()
	file := filepath.Join(root, "main.go")
	writeFile(t, file, []byte("package main\n"))

	if _, err := Scan(file); err == nil {
		t.Error("Scan() on a file returned no error")
	}
	if _, err := Scan(filepath.Join(root, "missing")); err == nil {
		t.Error("Scan() on a missing directory returned no error")
	}
}

func TestScanReportsEverySkipReason(t *testing.T) {
	report := scanOrFail(t, t.TempDir())

	for _, reason := range ReasonOrder {
		if _, ok := report.Skipped[reason]; !ok {
			t.Errorf("skip reason %q is missing from the report", reason)
		}
	}
	if report.Languages == nil || report.Files == nil {
		t.Error("the report contains nil maps or slices")
	}
}
