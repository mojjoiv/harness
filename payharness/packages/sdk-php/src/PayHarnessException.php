<?php

declare(strict_types=1);

namespace PayHarness;

use RuntimeException;

final class PayHarnessException extends RuntimeException
{
    /** @param array<string, mixed> $details */
    public function __construct(
        string $message,
        public readonly int $status,
        public readonly ?string $requestId,
        public readonly array $details = [],
    ) {
        parent::__construct($message, $status);
    }
}
