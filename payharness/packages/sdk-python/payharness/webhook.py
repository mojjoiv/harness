import hashlib
import hmac
import time

TOLERANCE_SECONDS = 300


def create_webhook_signature(secret, timestamp, raw_body):
    key = hashlib.sha256(secret.encode()).digest()
    message = f"{timestamp}.{raw_body}".encode()
    digest = hmac.new(key, message, hashlib.sha256).hexdigest()
    return f"t={timestamp},v1={digest}"


def verify_webhook_signature(secret, signature_header, raw_body, now_seconds=None, tolerance_seconds=TOLERANCE_SECONDS):
    parts = signature_header.strip().split(",")
    if len(parts) != 2 or not parts[0].startswith("t=") or not parts[1].startswith("v1="):
        return False
    try:
        timestamp = int(parts[0][2:])
    except ValueError:
        return False
    digest = parts[1][3:]
    if len(digest) != 64 or any(c not in "0123456789abcdef" for c in digest):
        return False
    now = int(time.time()) if now_seconds is None else now_seconds
    if abs(now - timestamp) > tolerance_seconds:
        return False
    expected = create_webhook_signature(secret, timestamp, raw_body).split(",", 1)[1][3:]
    return hmac.compare_digest(expected, digest)
