<?php

declare(strict_types=1);

namespace PayHarness;

use Closure;
use RuntimeException;

final class Client
{
    public const API_VERSION = '0.1.0';
    public const DEFAULT_BASE_URL = 'https://harness-1.onrender.com';

    public function __construct(
        private readonly string $apiKey,
        private readonly string $baseUrl = self::DEFAULT_BASE_URL,
        private readonly ?Closure $transport = null,
    ) {
        if ($apiKey === '') {
            throw new RuntimeException('PayHarness API key is required.');
        }
    }

    /** @return array<string, mixed> */
    public function createPayment(array $input, ?string $idempotencyKey = null): array
    {
        return $this->request('POST', '/payments', $input, $idempotencyKey);
    }

    /** @return array<string, mixed> */
    public function getPayment(string $paymentId): array
    {
        return $this->request('GET', '/payments/' . rawurlencode($paymentId));
    }

    /** @return array<string, mixed> */
    public function queryPayment(string $paymentId, array $query = []): array
    {
        return $this->request('GET', '/payments/' . rawurlencode($paymentId) . '/query', null, null, $query);
    }

    /** @return array<string, mixed> */
    public function createRefund(array $input, ?string $idempotencyKey = null): array
    {
        return $this->request('POST', '/refunds', $input, $idempotencyKey);
    }

    /** @return array<string, mixed> */
    public function createPayout(array $input, ?string $idempotencyKey = null): array
    {
        return $this->request('POST', '/payouts', $input, $idempotencyKey);
    }

    /** @return array<string, mixed> */
    public function getPayout(string $payoutId): array
    {
        return $this->request('GET', '/payouts/' . rawurlencode($payoutId));
    }

    /** @return array<string, mixed> */
    public function listPayouts(array $query = []): array
    {
        return $this->request('GET', '/payouts', null, null, $query);
    }

    /** @return array<string, mixed> */
    public function executePayout(string $payoutId, ?string $idempotencyKey = null): array
    {
        return $this->request('POST', '/payouts/' . rawurlencode($payoutId) . '/execute', null, $idempotencyKey);
    }

    /** @return array<string, mixed> */
    private function request(
        string $method,
        string $path,
        ?array $body = null,
        ?string $idempotencyKey = null,
        array $query = [],
    ): array {
        $url = rtrim($this->baseUrl, '/') . $path;
        if ($query !== []) {
            $url .= '?' . http_build_query($query);
        }

        $headers = [
            'Accept: application/json',
            'Content-Type: application/json',
            'Authorization: Bearer ' . $this->apiKey,
            'X-PayHarness-Api-Version: ' . self::API_VERSION,
        ];
        if ($idempotencyKey !== null) {
            $headers[] = 'Idempotency-Key: ' . $idempotencyKey;
        }

        $payload = $body === null ? null : json_encode($body, JSON_THROW_ON_ERROR);

        if ($this->transport !== null) {
            $response = ($this->transport)($method, $url, $headers, $payload);
            return $this->decodeResponse($response);
        }

        $handle = curl_init($url);
        if ($handle === false) {
            throw new RuntimeException('Unable to initialize HTTP client.');
        }
        curl_setopt_array($handle, [
            CURLOPT_CUSTOMREQUEST => $method,
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_HTTPHEADER => $headers,
            CURLOPT_TIMEOUT => 30,
            CURLOPT_FOLLOWLOCATION => false,
        ]);
        if ($payload !== null) {
            curl_setopt($handle, CURLOPT_POSTFIELDS, $payload);
        }

        $rawBody = curl_exec($handle);
        $status = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
        $error = curl_error($handle);
        curl_close($handle);

        if ($rawBody === false) {
            throw new RuntimeException($error !== '' ? $error : 'PayHarness request failed.');
        }

        return $this->decodeResponse(['status' => $status, 'body' => $rawBody]);
    }

    /** @param array{status:int,body:string,requestId?:string|null} $response */
    private function decodeResponse(array $response): array
    {
        $decoded = json_decode($response['body'], true);
        if (!is_array($decoded)) {
            throw new RuntimeException('PayHarness returned an invalid JSON response.');
        }

        if ($response['status'] < 200 || $response['status'] >= 300) {
            $message = (string) ($decoded['message'] ?? $decoded['error'] ?? 'PayHarness request failed.');
            throw new PayHarnessException($message, $response['status'], $response['requestId'] ?? null, $decoded);
        }

        return $decoded;
    }
}
