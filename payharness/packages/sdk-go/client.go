package payharness

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
)

const (
	APIVersion    = "0.1.0"
	DefaultBaseURL = "https://harness-1.onrender.com"
)

type Client struct {
	APIKey    string
	BaseURL   string
	HTTP      *http.Client
	APIVersion string
}

func NewClient(apiKey string) *Client {
	return &Client{APIKey: apiKey, BaseURL: DefaultBaseURL, HTTP: http.DefaultClient, APIVersion: APIVersion}
}

type RequestOptions struct {
	IdempotencyKey string
}

func (c *Client) CreatePayment(payload map[string]any, opts *RequestOptions) (map[string]any, error) {
	return c.request(http.MethodPost, "/payments", payload, opts, nil)
}

func (c *Client) GetPayment(paymentID string) (map[string]any, error) {
	return c.request(http.MethodGet, "/payments/"+url.PathEscape(paymentID), nil, nil, nil)
}

func (c *Client) QueryPayment(paymentID string, params map[string]string) (map[string]any, error) {
	return c.request(http.MethodGet, "/payments/"+url.PathEscape(paymentID)+"/query", nil, nil, params)
}

func (c *Client) CreateRefund(payload map[string]any, opts *RequestOptions) (map[string]any, error) {
	return c.request(http.MethodPost, "/refunds", payload, opts, nil)
}

func (c *Client) CreatePayout(payload map[string]any, opts *RequestOptions) (map[string]any, error) {
	return c.request(http.MethodPost, "/payouts", payload, opts, nil)
}

func (c *Client) GetPayout(payoutID string) (map[string]any, error) {
	return c.request(http.MethodGet, "/payouts/"+url.PathEscape(payoutID), nil, nil, nil)
}

func (c *Client) ListPayouts(params map[string]string) (map[string]any, error) {
	return c.request(http.MethodGet, "/payouts", nil, nil, params)
}

func (c *Client) ExecutePayout(payoutID string, opts *RequestOptions) (map[string]any, error) {
	return c.request(http.MethodPost, "/payouts/"+url.PathEscape(payoutID)+"/execute", nil, opts, nil)
}

func (c *Client) request(method, path string, payload map[string]any, opts *RequestOptions, params map[string]string) (map[string]any, error) {
	if strings.TrimSpace(c.APIKey) == "" {
		return nil, fmt.Errorf("PayHarness API key is required")
	}
	base := strings.TrimRight(c.BaseURL, "/")
	u, err := url.Parse(base + path)
	if err != nil {
		return nil, err
	}
	if len(params) > 0 {
		q := u.Query()
		for key, value := range params {
			q.Set(key, value)
		}
		u.RawQuery = q.Encode()
	}

	var body io.Reader
	if payload != nil {
		encoded, err := json.Marshal(payload)
		if err != nil {
			return nil, err
		}
		body = bytes.NewReader(encoded)
	}
	request, err := http.NewRequest(method, u.String(), body)
	if err != nil {
		return nil, err
	}
	request.Header.Set("Accept", "application/json")
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Authorization", "Bearer "+c.APIKey)
	request.Header.Set("X-PayHarness-Api-Version", c.APIVersion)
	if opts != nil && opts.IdempotencyKey != "" {
		request.Header.Set("Idempotency-Key", opts.IdempotencyKey)
	}

	httpClient := c.HTTP
	if httpClient == nil {
		httpClient = http.DefaultClient
	}
	response, err := httpClient.Do(request)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	responseBody, err := io.ReadAll(response.Body)
	if err != nil {
		return nil, err
	}

	var result map[string]any
	if len(responseBody) > 0 {
		if err := json.Unmarshal(responseBody, &result); err != nil {
			return nil, fmt.Errorf("invalid PayHarness response: %w", err)
		}
	}
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		requestID := response.Header.Get("X-Request-Id")
		if meta, ok := result["meta"].(map[string]any); ok {
			if value, ok := meta["requestId"].(string); ok {
				requestID = value
			}
		}
		message := "PayHarness request failed"
		if value, ok := result["message"].(string); ok && value != "" {
			message = value
		} else if value, ok := result["error"].(string); ok && value != "" {
			message = value
		}
		return nil, &Error{Status: response.StatusCode, RequestID: requestID, Details: result, Message: message}
	}
	return result, nil
}

func IntParam(value int) string { return strconv.Itoa(value) }
