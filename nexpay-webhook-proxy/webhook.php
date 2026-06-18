<?php
/**
 * NexPay Payout Webhook Proxy
 *
 * Receives callbacks from NexPay and forwards them securely to the NestJS backend.
 * Deploy this on a publicly accessible PHP host (e.g., anyleson.com or similar).
 *
 * NexPay sends POST with JSON body:
 *   { type, externalTxnId, status, amount, utr, message }
 *
 * This proxy:
 *   1. Validates the incoming request (POST, JSON, required fields)
 *   2. Logs the callback for audit
 *   3. Forwards to the NestJS backend with a shared webhook secret header
 *   4. Returns NexPay's expected response
 *
 * Configuration: Edit the constants below or set via environment variables.
 */

// ─── Configuration ───────────────────────────────────────────────────────────

// The NestJS backend webhook endpoint
define('BACKEND_WEBHOOK_URL', 'https://zeero.bet/api/payment7/payout/notify');

// Shared secret — must match NEXPAY_WEBHOOK_SECRET in .env on the backend
define('WEBHOOK_SECRET', 'khfdcdiudh34ewhdis9389hfdi28NexPayd');

// Optional: restrict to NexPay IP ranges (comma-separated). Leave empty to skip IP check.
define('ALLOWED_IPS', '');

// Log file path
define('LOG_FILE', __DIR__ . '/webhook.log');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function logEntry(string $level, string $message): void {
    $ts = date('Y-m-d H:i:s');
    $line = "[$ts] [$level] $message\n";
    @file_put_contents(LOG_FILE, $line, FILE_APPEND | LOCK_EX);
}

function jsonResponse(int $httpCode, array $data): void {
    http_response_code($httpCode);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

// ─── IP Allowlist ────────────────────────────────────────────────────────────

function isIpAllowed(): bool {
    $allowed = trim(ALLOWED_IPS);
    if ($allowed === '') return true; // no restriction

    $clientIp = $_SERVER['HTTP_X_FORWARDED_FOR']
        ?? $_SERVER['HTTP_X_REAL_IP']
        ?? $_SERVER['REMOTE_ADDR']
        ?? '';
    // X-Forwarded-For may contain comma-separated list; take first
    $clientIp = trim(explode(',', $clientIp)[0]);

    $whitelist = array_map('trim', explode(',', $allowed));
    return in_array($clientIp, $whitelist, true);
}

// ─── Main ────────────────────────────────────────────────────────────────────

// Only accept POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    logEntry('WARN', 'Non-POST request rejected: ' . $_SERVER['REQUEST_METHOD']);
    jsonResponse(405, ['error' => 'Method not allowed']);
}

// IP check
if (!isIpAllowed()) {
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    logEntry('WARN', "IP not allowed: $ip");
    jsonResponse(403, ['error' => 'Forbidden']);
}

// Read raw body
$rawBody = file_get_contents('php://input');
if (empty($rawBody)) {
    logEntry('WARN', 'Empty request body');
    jsonResponse(400, ['error' => 'Empty body']);
}

// Parse JSON
$payload = json_decode($rawBody, true);
if (!is_array($payload)) {
    logEntry('WARN', 'Invalid JSON body');
    jsonResponse(400, ['error' => 'Invalid JSON']);
}

// Validate required fields
$requiredFields = ['externalTxnId', 'status'];
foreach ($requiredFields as $field) {
    if (empty($payload[$field])) {
        logEntry('WARN', "Missing required field: $field | Body: $rawBody");
        jsonResponse(400, ['error' => "Missing field: $field"]);
    }
}

// Log the incoming callback
logEntry('INFO', "NexPay callback received | externalTxnId: {$payload['externalTxnId']} | status: {$payload['status']} | amount: " . ($payload['amount'] ?? 'n/a') . " | utr: " . ($payload['utr'] ?? 'n/a'));

// Forward to NestJS backend with webhook secret header
$ch = curl_init(BACKEND_WEBHOOK_URL);
curl_setopt_array($ch, [
    CURLOPT_POST           => true,
    CURLOPT_POSTFIELDS     => $rawBody,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 15,
    CURLOPT_CONNECTTIMEOUT => 5,
    CURLOPT_HTTPHEADER     => [
        'Content-Type: application/json',
        'X-Webhook-Secret: ' . WEBHOOK_SECRET,
    ],
    // Verify SSL in production
    CURLOPT_SSL_VERIFYPEER => true,
    CURLOPT_SSL_VERIFYHOST => 2,
]);

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);
curl_close($ch);

if ($curlError) {
    logEntry('ERROR', "Backend forward failed: $curlError");
    // Still return 200 to NexPay so they don't retry endlessly
    // The manual sync endpoint can reconcile later
    jsonResponse(200, ['status' => 'received', 'note' => 'backend_unreachable']);
}

logEntry('INFO', "Backend responded HTTP $httpCode | Body: $response");

// Return success to NexPay
jsonResponse(200, ['status' => 'received']);
