import json
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from .errors import PayHarnessError


class PayHarnessClient:
    API_VERSION = "0.1.0"
    DEFAULT_BASE_URL = "https://harness-1.onrender.com"

    def __init__(self, api_key, base_url=DEFAULT_BASE_URL, timeout=30):
        if not api_key:
            raise ValueError("PayHarness API key is required.")
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    def create_payment(self, payload, idempotency_key=None):
        return self._request("POST", "/payments", payload, idempotency_key)

    def get_payment(self, payment_id):
        return self._request("GET", f"/payments/{payment_id}")

    def query_payment(self, payment_id, params=None):
        return self._request("GET", f"/payments/{payment_id}/query", params=params)

    def create_refund(self, payload, idempotency_key=None):
        return self._request("POST", "/refunds", payload, idempotency_key)

    def create_payout(self, payload, idempotency_key=None):
        return self._request("POST", "/payouts", payload, idempotency_key)

    def get_payout(self, payout_id):
        return self._request("GET", f"/payouts/{payout_id}")

    def list_payouts(self, params=None):
        return self._request("GET", "/payouts", params=params)

    def execute_payout(self, payout_id, idempotency_key=None):
        return self._request("POST", f"/payouts/{payout_id}/execute", idempotency_key=idempotency_key)

    def _request(self, method, path, payload=None, idempotency_key=None, params=None):
        url = self.base_url + path
        if params:
            from urllib.parse import urlencode
            url += "?" + urlencode(params)
        headers = {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
            "X-PayHarness-Api-Version": self.API_VERSION,
        }
        if idempotency_key:
            headers["Idempotency-Key"] = idempotency_key
        body = None if payload is None else json.dumps(payload).encode()
        request = Request(url, data=body, headers=headers, method=method)
        try:
            with urlopen(request, timeout=self.timeout) as response:
                raw = response.read().decode()
                return json.loads(raw)
        except HTTPError as exc:
            raw = exc.read().decode(errors="replace")
            try:
                details = json.loads(raw)
            except json.JSONDecodeError:
                details = {"message": raw}
            message = details.get("message") or details.get("error") or "PayHarness request failed."
            raise PayHarnessError(message, exc.code, None, details) from exc
        except URLError as exc:
            raise PayHarnessError(str(exc.reason)) from exc
