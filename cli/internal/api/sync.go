package api

import (
	"bytes"
	"compress/gzip"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

const (
	SyncPath        = "/api/v1/projects/sync"
	SyncTimeout     = 60 * time.Second
	maxSyncResponse = 64 * 1024
)

type SyncResult struct {
	ProjectID string `json:"project_id"`
	Files     int    `json:"files"`
	Chunks    int    `json:"chunks"`
	Edges     int    `json:"edges"`
	URL       string `json:"url"`
}

type limitResponse struct {
	Error string `json:"error"`
	Limit int    `json:"limit"`
	Used  int    `json:"used"`
	Plan  string `json:"plan"`
}

type LimitError struct {
	Message string
	Limit   int
	Used    int
	Plan    string
}

func (e *LimitError) Error() string {
	return e.Message
}

func (c *Client) Sync(ctx context.Context, key string, payload any) (*SyncResult, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		return nil, fmt.Errorf("could not encode the project: %w", err)
	}

	compressed, err := gzipBytes(body)
	if err != nil {
		return nil, err
	}

	requestCtx, cancel := context.WithTimeout(ctx, SyncTimeout)
	defer cancel()

	req, err := http.NewRequestWithContext(
		requestCtx,
		http.MethodPost,
		c.BaseURL+SyncPath,
		bytes.NewReader(compressed),
	)
	if err != nil {
		return nil, fmt.Errorf("could not build the request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+key)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Content-Encoding", "gzip")
	req.Header.Set("Accept", "application/json")

	client := &http.Client{Timeout: SyncTimeout}

	resp, err := client.Do(req)
	if err != nil {
		return nil, &NetworkError{Err: err}
	}
	defer resp.Body.Close()

	responseBody, readErr := io.ReadAll(io.LimitReader(resp.Body, maxSyncResponse))

	if resp.StatusCode == http.StatusForbidden {
		decoded := limitResponse{}
		if json.Unmarshal(responseBody, &decoded) == nil && decoded.Error != "" {
			return nil, &LimitError{
				Message: decoded.Error,
				Limit:   decoded.Limit,
				Used:    decoded.Used,
				Plan:    decoded.Plan,
			}
		}
		return nil, &LimitError{Message: serverMessage(responseBody, resp.StatusCode)}
	}

	if resp.StatusCode != http.StatusOK {
		return nil, &APIError{
			StatusCode: resp.StatusCode,
			Message:    serverMessage(responseBody, resp.StatusCode),
		}
	}

	if readErr != nil {
		return nil, fmt.Errorf("could not read the response: %w", readErr)
	}

	result := &SyncResult{}
	if err := json.Unmarshal(responseBody, result); err != nil {
		return nil, fmt.Errorf("the server sent a response this version cannot read")
	}

	return result, nil
}

func gzipBytes(body []byte) ([]byte, error) {
	var compressed bytes.Buffer

	writer := gzip.NewWriter(&compressed)
	if _, err := writer.Write(body); err != nil {
		return nil, fmt.Errorf("could not compress the project: %w", err)
	}
	if err := writer.Close(); err != nil {
		return nil, fmt.Errorf("could not compress the project: %w", err)
	}

	return compressed.Bytes(), nil
}

func CompressedSize(payload any) (int, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		return 0, fmt.Errorf("could not encode the project: %w", err)
	}

	compressed, err := gzipBytes(body)
	if err != nil {
		return 0, err
	}

	return len(compressed), nil
}
