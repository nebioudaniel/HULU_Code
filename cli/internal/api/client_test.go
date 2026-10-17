package api

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestValidateSuccess(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			t.Errorf("method = %s, want POST", r.Method)
		}
		if r.URL.Path != ValidatePath {
			t.Errorf("path = %s, want %s", r.URL.Path, ValidatePath)
		}
		if got := r.Header.Get("Authorization"); got != "Bearer hulu_sk_example" {
			t.Errorf("Authorization header = %q, want the bearer key", got)
		}

		w.Header().Set("Content-Type", "application/json")
		fmt.Fprint(w, `{"valid":true,"user_id":"user-1","plan_tier":"pro"}`)
	}))
	defer server.Close()

	result, err := NewClient(server.URL).Validate(context.Background(), "hulu_sk_example")
	if err != nil {
		t.Fatalf("Validate() returned an error: %v", err)
	}
	if !result.Valid {
		t.Error("Valid = false, want true")
	}
	if result.UserID != "user-1" {
		t.Errorf("UserID = %q, want user-1", result.UserID)
	}
	if result.PlanTier != "pro" {
		t.Errorf("PlanTier = %q, want pro", result.PlanTier)
	}
}

func TestValidateUnauthorized(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusUnauthorized)
		fmt.Fprint(w, `{"error":"Invalid API key"}`)
	}))
	defer server.Close()

	_, err := NewClient(server.URL).Validate(context.Background(), "hulu_sk_bad")

	apiErr := &APIError{}
	if !errors.As(err, &apiErr) {
		t.Fatalf("Validate() error = %v, want an APIError", err)
	}
	if apiErr.StatusCode != http.StatusUnauthorized {
		t.Errorf("StatusCode = %d, want 401", apiErr.StatusCode)
	}
	if apiErr.Message != "Invalid API key" {
		t.Errorf("Message = %q, want the server message", apiErr.Message)
	}
}

func TestValidateUsesFallbackMessage(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		fmt.Fprint(w, "<html>boom</html>")
	}))
	defer server.Close()

	_, err := NewClient(server.URL).Validate(context.Background(), "hulu_sk_example")

	apiErr := &APIError{}
	if !errors.As(err, &apiErr) {
		t.Fatalf("Validate() error = %v, want an APIError", err)
	}
	if apiErr.Message != "The server returned status 500." {
		t.Errorf("Message = %q, want the fallback message", apiErr.Message)
	}
}

func TestValidateUnreachable(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(http.ResponseWriter, *http.Request) {}))
	url := server.URL
	server.Close()

	_, err := NewClient(url).Validate(context.Background(), "hulu_sk_example")

	networkErr := &NetworkError{}
	if !errors.As(err, &networkErr) {
		t.Fatalf("Validate() error = %v, want a NetworkError", err)
	}
}

func TestValidKeyFormat(t *testing.T) {
	if !ValidKeyFormat("hulu_sk_abc") {
		t.Error("ValidKeyFormat() rejected a valid prefix")
	}
	if ValidKeyFormat("sk_abc") {
		t.Error("ValidKeyFormat() accepted a key without the prefix")
	}
	if ValidKeyFormat("") {
		t.Error("ValidKeyFormat() accepted an empty key")
	}
}
