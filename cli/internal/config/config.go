package config

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

const (
	DirName       = ".hulucode"
	FileName      = "config.json"
	EnvAPIURL     = "HULUCODE_API_URL"

	dirPerm  os.FileMode = 0o700
	filePerm os.FileMode = 0o600

	maskVisible    = 12
	maskShortLimit = 4
)

var DefaultAPIURL = "http://localhost:3000"

var ErrNotConfigured = errors.New("not configured")

type Config struct {
	APIKey      string `json:"api_key"`
	APIURL      string `json:"api_url"`
	SyncConsent bool   `json:"sync_consent"`
}

func Dir() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", fmt.Errorf("could not find your home directory: %w", err)
	}
	return filepath.Join(home, DirName), nil
}

func Path() (string, error) {
	dir, err := Dir()
	if err != nil {
		return "", err
	}
	return filepath.Join(dir, FileName), nil
}

func Load() (*Config, error) {
	path, err := Path()
	if err != nil {
		return nil, err
	}

	data, err := os.ReadFile(path)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return &Config{}, ErrNotConfigured
		}
		return nil, fmt.Errorf("could not read %s: %w", path, err)
	}

	cfg := &Config{}
	if err := json.Unmarshal(data, cfg); err != nil {
		return nil, fmt.Errorf("%s is not valid JSON: %w", path, err)
	}

	return cfg, nil
}

func (c *Config) Save() error {
	dir, err := Dir()
	if err != nil {
		return err
	}

	if err := os.MkdirAll(dir, dirPerm); err != nil {
		return fmt.Errorf("could not create %s: %w", dir, err)
	}
	if err := os.Chmod(dir, dirPerm); err != nil {
		return fmt.Errorf("could not secure %s: %w", dir, err)
	}

	data, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return fmt.Errorf("could not encode the config: %w", err)
	}

	path := filepath.Join(dir, FileName)
	if err := os.WriteFile(path, data, filePerm); err != nil {
		return fmt.Errorf("could not write %s: %w", path, err)
	}
	if err := os.Chmod(path, filePerm); err != nil {
		return fmt.Errorf("could not secure %s: %w", path, err)
	}

	return nil
}

func Clear() error {
	path, err := Path()
	if err != nil {
		return err
	}

	if err := os.Remove(path); err != nil && !errors.Is(err, os.ErrNotExist) {
		return fmt.Errorf("could not remove %s: %w", path, err)
	}

	return nil
}

func (c *Config) ResolveAPIURL() string {
	if value := strings.TrimSpace(os.Getenv(EnvAPIURL)); value != "" {
		return strings.TrimRight(value, "/")
	}
	if value := strings.TrimSpace(c.APIURL); value != "" {
		return strings.TrimRight(value, "/")
	}
	return DefaultAPIURL
}

func MaskKey(key string) string {
	if key == "" {
		return "(none)"
	}

	visible := maskVisible
	if len(key) <= visible {
		visible = maskShortLimit
	}
	if visible > len(key) {
		visible = len(key)
	}

	return key[:visible] + "..."
}
