import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1]))

from payharness import PayHarnessClient, PayHarnessError, create_webhook_signature, verify_webhook_signature


def test_webhook_signature():
    secret = "whsec_test"
    body = '{"type":"payment.succeeded"}'
    timestamp = 1700000000
    signature = create_webhook_signature(secret, timestamp, body)
    assert signature.startswith("t=")
    assert verify_webhook_signature(secret, signature, body, timestamp)
    assert not verify_webhook_signature(secret, signature, '{"type":"payment.failed"}', timestamp)
    assert not verify_webhook_signature(secret, signature, body, timestamp + 301)
    assert not verify_webhook_signature(secret, "invalid", body, timestamp)


def test_client_request(monkeypatch):
    client = PayHarnessClient("ph_sandbox_test", "https://example.test")
    captured = {}

    class Response:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def read(self):
            return b'{"success":true,"data":{"id":"pay_123"}}'

    def fake_urlopen(request, timeout):
        captured["method"] = request.method
        captured["url"] = request.full_url
        captured["auth"] = request.get_header("Authorization")
        captured["idempotency"] = request.get_header("Idempotency-key")
        return Response()

    monkeypatch.setattr("urllib.request.urlopen", fake_urlopen)
    result = client.create_payment({"amountCents": 1000}, "payment-test-1")
    assert result["success"] is True
    assert captured["method"] == "POST"
    assert captured["url"] == "https://example.test/payments"
    assert captured["auth"] == "Bearer ph_sandbox_test"
    assert captured["idempotency"] == "payment-test-1"


def test_structured_error():
    error = PayHarnessError("duplicate", 409, "req_123", {"code": "IDEMPOTENCY_CONFLICT"})
    assert error.status == 409
    assert error.request_id == "req_123"
    assert error.details["code"] == "IDEMPOTENCY_CONFLICT"
