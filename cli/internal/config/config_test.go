package config

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

const sampleKey = "hulu_sk_0000000000000000000000000000000000000000"

func isolateHome(t *testing.T) string {
	t.Helper()

	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv(EnvAPIURL, "")

	return home
}

func permissionOf(t *testing.T, path string) os.FileMode {
	t.Helper()

	info, err := os.Stat(path)
	if err != nil {
		t.Fatalf("could not stat %s: %v", path, err)
	}

	return info.Mode().Perm()
}

func TestSaveCreatesPrivateFiles(t *testing.T) {
	home := isolateHome(t)

	saved := &Config{APIKey: sampleKey, APIURL: "http://localhost:3000"}
	if err := saved.Save(); err != nil {
		t.Fatalf("Save() returned an error: %v", err)
	}

	dir := filepath.Join(home, DirName)
	path := filepath.Join(dir, FileName)

	if perm := permissionOf(t, dir); perm != 0o700 {
		t.Errorf("config directory permissions = %o, want 700", perm)
	}
	if perm := permissionOf(t, path); perm != 0o600 {
		t.Errorf("config file permissions = %o, want 600", perm)
	}
}

func TestSaveTightensExistingPermissions(t *testing.T) {
	home := isolateHome(t)

	dir := filepath.Join(home, DirName)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		t.Fatalf("could not create the config directory: %v", err)
	}

	path := filepath.Join(dir, FileName)
	if err := os.WriteFile(path, []byte(`{"api_key":"hulu_sk_old"}`), 0o644); err != nil {
		t.Fatalf("could not seed the config file: %v", err)
	}

	if err := (&Config{APIKey: sampleKey}).Save(); err != nil {
		t.Fatalf("Save() returned an error: %v", err)
	}

	if perm := permissionOf(t, dir); perm != 0o700 {
		t.Errorf("config directory permissions = %o, want 700", perm)
	}
	if perm := permissionOf(t, path); perm != 0o600 {
		t.Errorf("config file permissions = %o, want 600", perm)
	}
}

func TestLoadRoundTrip(t *testing.T) {
	isolateHome(t)

	if err := (&Config{APIKey: sampleKey, APIURL: "http://example.test"}).Save(); err != nil {
		t.Fatalf("Save() returned an error: %v", err)
	}

	loaded, err := Load()
	if err != nil {
		t.Fatalf("Load() returned an error: %v", err)
	}
	if loaded.APIKey != sampleKey {
		t.Errorf("APIKey = %q, want the saved key", loaded.APIKey)
	}
	if loaded.APIURL != "http://example.test" {
		t.Errorf("APIURL = %q, want http://example.test", loaded.APIURL)
	}
}

func TestLoadMissingFile(t *testing.T) {
	isolateHome(t)

	loaded, err := Load()
	if !errors.Is(err, ErrNotConfigured) {
		t.Fatalf("Load() error = %v, want ErrNotConfigured", err)
	}
	if loaded == nil {
		t.Fatal("Load() returned a nil config")
	}
	if loaded.APIKey != "" {
		t.Errorf("APIKey = %q, want empty", loaded.APIKey)
	}
}

func TestLoadRejectsBrokenJSON(t *testing.T) {
	home := isolateHome(t)

	dir := filepath.Join(home, DirName)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		t.Fatalf("could not create the config directory: %v", err)
	}
	if err := os.WriteFile(filepath.Join(dir, FileName), []byte("not json"), 0o600); err != nil {
		t.Fatalf("could not write the config file: %v", err)
	}

	if _, err := Load(); err == nil {
		t.Error("Load() on a broken config returned no error")
	}
}

func TestClearRemovesKey(t *testing.T) {
	isolateHome(t)

	if err := (&Config{APIKey: sampleKey}).Save(); err != nil {
		t.Fatalf("Save() returned an error: %v", err)
	}

	if err := Clear(); err != nil {
		t.Fatalf("Clear() returned an error: %v", err)
	}
	if _, err := Load(); !errors.Is(err, ErrNotConfigured) {
		t.Fatalf("Load() after Clear() error = %v, want ErrNotConfigured", err)
	}
	if err := Clear(); err != nil {
		t.Errorf("Clear() on a missing file returned an error: %v", err)
	}
}

func TestResolveAPIURLPriority(t *testing.T) {
	isolateHome(t)

	fromConfig := &Config{APIURL: "http://from-config.test"}
	if got := fromConfig.ResolveAPIURL(); got != "http://from-config.test" {
		t.Errorf("ResolveAPIURL() = %q, want the config value", got)
	}

	empty := &Config{}
	if got := empty.ResolveAPIURL(); got != DefaultAPIURL {
		t.Errorf("ResolveAPIURL() = %q, want %q", got, DefaultAPIURL)
	}

	t.Setenv(EnvAPIURL, "http://from-env.test/")
	if got := fromConfig.ResolveAPIURL(); got != "http://from-env.test" {
		t.Errorf("ResolveAPIURL() = %q, want the environment value without a trailing slash", got)
	}

	t.Setenv(EnvAPIURL, "   ")
	if got := fromConfig.ResolveAPIURL(); got != "http://from-config.test" {
		t.Errorf("ResolveAPIURL() = %q, want the config value when the environment value is blank", got)
	}
}

func TestMaskKey(t *testing.T) {
	if got := MaskKey(""); got != "(none)" {
		t.Errorf("MaskKey(\"\") = %q, want (none)", got)
	}

	masked := MaskKey(sampleKey)
	if masked != sampleKey[:12]+"..." {
		t.Errorf("MaskKey() = %q, want the first 12 characters followed by ...", masked)
	}
	if strings.Contains(sampleKey, masked) {
		t.Errorf("MaskKey() = %q, which appears inside the full key", masked)
	}

	short := MaskKey("hulu_sk_")
	if short != "hulu..." {
		t.Errorf("MaskKey() = %q, want hulu...", short)
	}
	if strings.Contains(short, "sk_") {
		t.Errorf("MaskKey() = %q, which exposes a short key", short)
	}
}
