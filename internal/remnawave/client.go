// Package remnawave is a minimal client for the Remnawave panel's REST API.
// Endpoints and JSON shapes are hand-ported from the zod schemas in
// @remnawave/backend-contract@3.4.15 (users are addressed by numeric id).
package remnawave

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

type Client struct {
	baseURL string
	token   string
	apiKey  string
	http    *http.Client
}

func NewClient(baseURL, token, apiKey string) *Client {
	return &Client{
		baseURL: baseURL,
		token:   token,
		apiKey:  apiKey,
		http:    &http.Client{Timeout: 20 * time.Second},
	}
}

// APIError is a non-2xx panel response.
type APIError struct {
	Status  int
	Message string
	Body    string
}

func (e *APIError) Error() string {
	if e.Message != "" {
		return fmt.Sprintf("panel returned %d: %s", e.Status, e.Message)
	}
	return fmt.Sprintf("panel returned %d: %s", e.Status, e.Body)
}

// IsNotFound reports whether err is a panel 404.
func IsNotFound(err error) bool {
	var apiErr *APIError
	return errors.As(err, &apiErr) && apiErr.Status == http.StatusNotFound
}

// envelope is the panel's {"response": ...} wrapper.
type envelope[T any] struct {
	Response T `json:"response"`
}

// call does a request with the panel token and unwraps {"response": out}.
func call[T any](ctx context.Context, c *Client, method, path string, query url.Values, body any) (T, error) {
	var out envelope[T]
	err := c.do(ctx, method, path, query, body, c.token, &out)
	return out.Response, err
}

func (c *Client) do(ctx context.Context, method, path string, query url.Values, body any, token string, out any) error {
	var bodyReader io.Reader
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("marshal request: %w", err)
		}
		bodyReader = bytes.NewReader(b)
	}

	u := c.baseURL + path
	if len(query) > 0 {
		u += "?" + query.Encode()
	}
	req, err := http.NewRequestWithContext(ctx, method, u, bodyReader)
	if err != nil {
		return fmt.Errorf("build request: %w", err)
	}
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	if token != "" {
		req.Header.Set("Authorization", "Bearer "+token)
	}
	if c.apiKey != "" {
		req.Header.Set("X-Api-Key", c.apiKey)
	}
	// Outside development mode the backend drops connections that lack
	// these (proxy-check middleware) — they're normally set by the reverse
	// proxy, but we talk to it directly inside the docker network.
	req.Header.Set("X-Forwarded-For", "127.0.0.1")
	req.Header.Set("X-Forwarded-Proto", "https")

	resp, err := c.http.Do(req)
	if err != nil {
		return fmt.Errorf("%s %s: %w", method, path, err)
	}
	defer func() { _ = resp.Body.Close() }()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("read response: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		apiErr := &APIError{Status: resp.StatusCode, Body: truncate(string(respBody), 500)}
		var e struct {
			Message string `json:"message"`
		}
		if json.Unmarshal(respBody, &e) == nil {
			apiErr.Message = e.Message
		}
		return apiErr
	}

	if out == nil || len(respBody) == 0 {
		return nil
	}
	if err := json.Unmarshal(respBody, out); err != nil {
		return fmt.Errorf("decode response: %w", err)
	}
	return nil
}

func truncate(s string, n int) string {
	if len(s) <= n {
		return s
	}
	return s[:n] + "…"
}
