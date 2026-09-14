class PayHarnessError(RuntimeError):
    def __init__(self, message, status=None, request_id=None, details=None):
        super().__init__(message)
        self.status = status
        self.request_id = request_id
        self.details = details or {}
