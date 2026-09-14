package payharness

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"strconv"
	"strings"
	"time"
)

const WebhookTolerance = 5 * time.Minute

// CreateWebhookSignature creates a PayHarness webhook signature.
func CreateWebhookSignature(secret string, timestamp int64, rawBody string) string {
	keyHash := sha256.Sum256([]byte(secret))
	message := strconv.FormatInt(timestamp, 10) + "." + rawBody
	mac := hmac.New(sha256.New, keyHash[:])
	_, _ = mac.Write([]byte(message))
	return "t=" + strconv.FormatInt(timestamp, 10) + ",v1=" + hex.EncodeToString(mac.Sum(nil))
}

// VerifyWebhookSignature verifies a signature and rejects timestamps outside the tolerance window.
func VerifyWebhookSignature(secret, signature, rawBody string, now time.Time) bool {
	parts := strings.Split(signature, ",")
	if len(parts) != 2 || !strings.HasPrefix(parts[0], "t=") || !strings.HasPrefix(parts[1], "v1=") {
		return false
	}

	timestamp, err := strconv.ParseInt(strings.TrimPrefix(parts[0], "t="), 10, 64)
	if err != nil {
		return false
	}
	digest, err := hex.DecodeString(strings.TrimPrefix(parts[1], "v1="))
	if err != nil || len(digest) != sha256.Size {
		return false
	}

	when := time.Unix(timestamp, 0)
	if now.Sub(when) > WebhookTolerance || when.Sub(now) > WebhookTolerance {
		return false
	}

	expected := CreateWebhookSignature(secret, timestamp, rawBody)
	expectedDigest, _ := hex.DecodeString(strings.SplitN(expected, ",v1=", 2)[1])
	return hmac.Equal(expectedDigest, digest)
}
