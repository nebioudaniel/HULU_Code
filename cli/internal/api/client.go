package api

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

const (
	KeyPrefix      = "hulu_sk_"
	ValidatePath   = "/api/v1/auth/validate"
	RequestTimeout = 10 * time.Second
	maxResponse    = 64 * 1024
)

type Validation struct {
	Valid    bool   `json:"valid"`
	UserID   string `json:"user_id"`
	PlanTier string `json:"plan_tier"`
}

type ErrorResponse struct {
	Error string `json:"error"`
}

type APIError struct {
	StatusCode int
	Message    string
}

func (e *APIError) Error() string {
	return e.Message
}

type NetworkError struct {
	Err error
}

func (e *NetworkError) Error() string {
	return e.Err.Error()
}

func (e *NetworkError) Unwrap() error {
	return e.Err
}

type Client struct {
	BaseURL string
	HTTP    *http.Client
}

func NewClient(baseURL string) *Client {
	return &Client{
		BaseURL: strings.TrimRight(baseURL, "/"),
		HTTP:    &http.Client{Timeout: RequestTimeout},
	}
}

func ValidKeyFormat(key string) bool {
	return strings.HasPrefix(key, KeyPrefix)
}

func (c *Client) Validate(ctx context.Context, key string) (*Validation, error) {
	req, err := http.NewRequestWithContext(
		ctx,
		http.MethodPost,
		c.BaseURL+ValidatePath,
		bytes.NewReader([]byte("{}")),
	)
	if err != nil {
		return nil, fmt.Errorf("could not build the request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+key)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := c.HTTP.Do(req)
	if err != nil {
		return nil, &NetworkError{Err: err}
	}
	defer resp.Body.Close()

	payload, readErr := io.ReadAll(io.LimitReader(resp.Body, maxResponse))

	if resp.StatusCode != http.StatusOK {
		return nil, &APIError{
			StatusCode: resp.StatusCode,
			Message:    serverMessage(payload, resp.StatusCode),
		}
	}

	if readErr != nil {
		return nil, fmt.Errorf("could not read the response: %w", readErr)
	}

	result := &Validation{}
	if err := json.Unmarshal(payload, result); err != nil {
		return nil, errors.New("the server sent a response this version cannot read")
	}
	if !result.Valid {
		return nil, errors.New("the server did not accept that key")
	}

	return result, nil
}

func serverMessage(payload []byte, status int) string {
	decoded := ErrorResponse{}
	if err := json.Unmarshal(payload, &decoded); err == nil {
		if message := strings.TrimSpace(decoded.Error); message != "" {
			return message
		}
	}
	return fmt.Sprintf("The server returned status %d.", status)
}
