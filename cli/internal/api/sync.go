package api

import (
	"bytes"
	"compress/gzip"
	"context"
	"crypto/rand"
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

func NewSyncID() string {
	var b [16]byte
	_, _ = rand.Read(b[:])
	b[6] = (b[6] & 0x0f) | 0x40
	b[8] = (b[8] & 0x3f) | 0x80
	return fmt.Sprintf("%x-%x-%x-%x-%x", b[0:4], b[4:6], b[6:8], b[8:10], b[10:16])
}

func (c *Client) doSyncRequest(ctx context.Context, key string, payload any) (int, []byte, error) {
	body, err := json.Marshal(payload)
	if err != nil {
		return 0, nil, fmt.Errorf("could not encode the project: %w", err)
	}

	compressed, err := gzipBytes(body)
	if err != nil {
		return 0, nil, err
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
		return 0, nil, fmt.Errorf("could not build the request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+key)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Content-Encoding", "gzip")
	req.Header.Set("Accept", "application/json")

	client := &http.Client{Timeout: SyncTimeout}

	resp, err := client.Do(req)
	if err != nil {
		return 0, nil, &NetworkError{Err: err}
	}
	defer resp.Body.Close()

	responseBody, readErr := io.ReadAll(io.LimitReader(resp.Body, maxSyncResponse))
	if readErr != nil {
		return resp.StatusCode, responseBody, fmt.Errorf("could not read the response: %w", readErr)
	}

	return resp.StatusCode, responseBody, nil
}

func (c *Client) Sync(ctx context.Context, key string, payload any) (*SyncResult, error) {
	status, responseBody, err := c.doSyncRequest(ctx, key, payload)
	if err != nil {
		return nil, err
	}

	if status == http.StatusForbidden {
		decoded := limitResponse{}
		if json.Unmarshal(responseBody, &decoded) == nil && decoded.Error != "" {
			return nil, &LimitError{
				Message: decoded.Error,
				Limit:   decoded.Limit,
				Used:    decoded.Used,
				Plan:    decoded.Plan,
			}
		}
		return nil, &LimitError{Message: serverMessage(responseBody, status)}
	}

	if status != http.StatusOK {
		return nil, &APIError{
			StatusCode: status,
			Message:    serverMessage(responseBody, status),
		}
	}

	result := &SyncResult{}
	if err := json.Unmarshal(responseBody, result); err != nil {
		return nil, fmt.Errorf("the server sent a response this version cannot read")
	}

	return result, nil
}

func (c *Client) SyncBatch(ctx context.Context, key string, payload any) error {
	status, responseBody, err := c.doSyncRequest(ctx, key, payload)
	if err != nil {
		return err
	}

	if status != http.StatusOK {
		return &APIError{
			StatusCode: status,
			Message:    serverMessage(responseBody, status),
		}
	}

	return nil
}

func (c *Client) SyncCommit(ctx context.Context, key string, payload any) (*SyncResult, error) {
	status, responseBody, err := c.doSyncRequest(ctx, key, payload)
	if err != nil {
		return nil, err
	}

	if status == http.StatusForbidden {
		decoded := limitResponse{}
		if json.Unmarshal(responseBody, &decoded) == nil && decoded.Error != "" {
			return nil, &LimitError{
				Message: decoded.Error,
				Limit:   decoded.Limit,
				Used:    decoded.Used,
				Plan:    decoded.Plan,
			}
		}
		return nil, &LimitError{Message: serverMessage(responseBody, status)}
	}

	if status != http.StatusOK {
		return nil, &APIError{
			StatusCode: status,
			Message:    serverMessage(responseBody, status),
		}
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
