package cmd

import (
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/nebioudaniel/HULU_Code/cli/internal/config"
)

const testKey = "hulu_sk_0123456789012345678901234567890123456789"

func validationServer(t *testing.T) *httptest.Server {
	t.Helper()

	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		io.WriteString(w, `{"valid":true,"user_id":"user-1","plan_tier":"pro"}`)
	}))
}

func runLogin(t *testing.T, args ...string) error {
	t.Helper()

	root := NewRootCmd()
	root.SetArgs(append([]string{"auth", "login"}, args...))
	root.SetOut(io.Discard)
	root.SetErr(io.Discard)

	return root.Execute()
}

func readSavedConfig(t *testing.T, home string) *config.Config {
	t.Helper()

	path := filepath.Join(home, config.DirName, config.FileName)
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("could not read the config file: %v", err)
	}

	saved := &config.Config{}
	if err := json.Unmarshal(data, saved); err != nil {
		t.Fatalf("could not decode the config file: %v", err)
	}

	return saved
}

func TestLoginDoesNotPersistEnvironmentAPIURL(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)

	server := validationServer(t)
	defer server.Close()
	t.Setenv(config.EnvAPIURL, server.URL)

	if err := runLogin(t, "--key", testKey); err != nil {
		t.Fatalf("login returned an error: %v", err)
	}

	saved := readSavedConfig(t, home)
	if saved.APIKey != testKey {
		t.Error("the API key was not saved")
	}
	if saved.APIURL != "" {
		t.Errorf("api_url = %q, want it left empty when only the environment variable is set", saved.APIURL)
	}
}

func TestLoginKeepsExistingAPIURLWithoutFlag(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)

	server := validationServer(t)
	defer server.Close()
	t.Setenv(config.EnvAPIURL, server.URL)

	if err := (&config.Config{APIURL: "http://saved.example.test"}).Save(); err != nil {
		t.Fatalf("could not seed the config: %v", err)
	}

	if err := runLogin(t, "--key", testKey); err != nil {
		t.Fatalf("login returned an error: %v", err)
	}

	saved := readSavedConfig(t, home)
	if saved.APIURL != "http://saved.example.test" {
		t.Errorf("api_url = %q, want the previously saved value", saved.APIURL)
	}
}

func TestLoginPersistsExplicitAPIURL(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)

	server := validationServer(t)
	defer server.Close()
	t.Setenv(config.EnvAPIURL, "http://ignored.example.test")

	if err := runLogin(t, "--key", testKey, "--api-url", server.URL+"/"); err != nil {
		t.Fatalf("login returned an error: %v", err)
	}

	saved := readSavedConfig(t, home)
	if saved.APIURL != server.URL {
		t.Errorf("api_url = %q, want the explicit flag value without a trailing slash", saved.APIURL)
	}
}
