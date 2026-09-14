package payharness

import (
	"testing"
	"time"
)

func TestWebhookSignature(t *testing.T) {
	secret := "whsec_test"
	body := `{"type":"payment.succeeded"}`
	timestamp := int64(1700000000)
	signature := CreateWebhookSignature(secret, timestamp, body)
	if signature[:2] != "t=" {
		t.Fatalf("unexpected signature: %s", signature)
	}
	now := time.Unix(timestamp, 0)
	if !VerifyWebhookSignature(secret, signature, body, now) {
		t.Fatal("expected valid signature")
	}
	if VerifyWebhookSignature(secret, signature, `{"type":"payment.failed"}`, now) {
		t.Fatal("expected modified body to fail")
	}
	if VerifyWebhookSignature(secret, signature, body, now.Add(301*time.Second)) {
		t.Fatal("expected stale signature to fail")
	}
	if VerifyWebhookSignature(secret, "invalid", body, now) {
		t.Fatal("expected malformed signature to fail")
	}
}
