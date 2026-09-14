package payharness

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestClientCreatePayment(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost || r.URL.Path != "/payments" {
			t.Fatalf("unexpected request: %s %s", r.Method, r.URL.Path)
		}
		if got := r.Header.Get("Authorization"); got != "Bearer ph_sandbox_test" {
			t.Fatalf("unexpected auth header: %s", got)
		}
		if got := r.Header.Get("Idempotency-Key"); got != "payment-test-1" {
			t.Fatalf("unexpected idempotency key: %s", got)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"success":true,"data":{"id":"pay_123"}}`))
	}))
	defer server.Close()

	client := NewClient("ph_sandbox_test")
	client.BaseURL = server.URL
	result, err := client.CreatePayment(map[string]any{"amountCents": 1000}, &RequestOptions{IdempotencyKey: "payment-test-1"})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result["success"] != true {
		t.Fatalf("expected successful response: %#v", result)
	}
}

func TestClientStructuredError(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusConflict)
		_, _ = w.Write([]byte(`{"message":"duplicate","meta":{"requestId":"req_123"},"code":"IDEMPOTENCY_CONFLICT"}`))
	}))
	defer server.Close()

	client := NewClient("ph_sandbox_test")
	client.BaseURL = server.URL
	_, err := client.GetPayment("pay_123")
	if err == nil {
		t.Fatal("expected error")
	}
	apiErr, ok := err.(*Error)
	if !ok {
		t.Fatalf("expected *Error, got %T", err)
	}
	if apiErr.Status != http.StatusConflict || apiErr.RequestID != "req_123" || apiErr.Message != "duplicate" {
		t.Fatalf("unexpected error: %#v", apiErr)
	}
}
