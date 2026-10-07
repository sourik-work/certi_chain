/**
 * @file pinErrors.ts
 * @summary Typed error codes and user-friendly mapping for IPFS pinning operations.
 */

export type PinErrorCode =
  | 'PIN_ROUTE_UNAVAILABLE'
  | 'PIN_UNAUTHORIZED'
  | 'PIN_NOT_ISSUER'
  | 'PIN_PAYLOAD_TOO_LARGE'
  | 'PIN_PAYLOAD_ESTIMATED_OVER_LIMIT'
  | 'PIN_UPSTREAM_FAILED'
  | 'PIN_CONFIG_MISSING'
  | 'PIN_NETWORK'
  | 'PIN_HASH_MISMATCH'
  | 'PIN_TIMEOUT';

export interface PinErrorDetails {
  readonly code: PinErrorCode;
  readonly message: string;
  readonly technicalDetail: string;
  readonly statusCode?: number;
  readonly requestId?: string;
  readonly recoverable: boolean;
}

export class PinError extends Error {
  readonly code: PinErrorCode;
  readonly statusCode?: number;
  readonly requestId?: string;
  readonly recoverable: boolean;
  readonly technicalDetail: string;

  constructor(details: PinErrorDetails) {
    super(details.message);
    this.name = 'PinError';
    this.code = details.code;
    this.statusCode = details.statusCode;
    this.requestId = details.requestId;
    this.recoverable = details.recoverable;
    this.technicalDetail = details.technicalDetail;
  }
}

export function createPinError(
  code: PinErrorCode,
  customMessage?: string,
  statusCode?: number,
  requestId?: string
): PinError {
  let message = customMessage;
  let technicalDetail = `Code: ${code}`;
  let recoverable = false;

  if (statusCode) technicalDetail += ` (HTTP ${statusCode})`;
  if (requestId) technicalDetail += ` [ReqId: ${requestId}]`;

  switch (code) {
    case 'PIN_ROUTE_UNAVAILABLE':
      message = message || 'The IPFS serverless pinning service (/api/pinFile) is unreachable or not running.';
      technicalDetail += ' — Serverless API routes must be served via Vercel CLI or Vite dev middleware.';
      recoverable = true;
      break;
    case 'PIN_UNAUTHORIZED':
      message = message || 'Issuer session authorization required. Please reconnect your wallet or sign the session nonce.';
      technicalDetail += ' — Missing or invalid X-Issuer-Session token.';
      recoverable = true;
      break;
    case 'PIN_NOT_ISSUER':
      message = message || 'Your connected wallet is not an authorized issuer on the active smart contract registry.';
      technicalDetail += ' — on-chain isIssuerAuthorized returned false.';
      recoverable = false;
      break;
    case 'PIN_PAYLOAD_TOO_LARGE':
      message = message || 'File size exceeds maximum serverless payload limit (Max 4.5 MB). Downscaling or optimization required.';
      technicalDetail += ' — Request entity too large for serverless execution.';
      recoverable = false;
      break;
    case 'PIN_PAYLOAD_ESTIMATED_OVER_LIMIT':
      message = message || 'Payload size exceeds safe serverless limit. Pre-flight check rejected request before network dispatch.';
      technicalDetail += ' — Client-side size budget exceeded.';
      recoverable = false;
      break;
    case 'PIN_UPSTREAM_FAILED':
      message = message || 'Upstream Pinata IPFS service rejected the upload or returned an error.';
      technicalDetail += ' — Pinata pinning API error or rate limit.';
      recoverable = true;
      break;
    case 'PIN_CONFIG_MISSING':
      message = message || 'Pinata IPFS credentials (PINATA_JWT) are not configured in the server environment.';
      technicalDetail += ' — Serverless environment variable PINATA_JWT is unset.';
      recoverable = false;
      break;
    case 'PIN_NETWORK':
      message = message || 'Network connection failed while uploading binary asset to IPFS proxy.';
      technicalDetail += ' — Failed to fetch / socket connection dropped.';
      recoverable = true;
      break;
    case 'PIN_HASH_MISMATCH':
      message = message || 'Integrity check failed: Re-fetched IPFS bytes do not match template SHA-256 hash.';
      technicalDetail += ' — Cryptographic mismatch between pinned asset and computed templateHash.';
      recoverable = true;
      break;
    case 'PIN_TIMEOUT':
      message = message || 'IPFS upload timed out. The network or gateway was too slow to respond.';
      technicalDetail += ' — Per-stage AbortController timeout triggered.';
      recoverable = true;
      break;
  }

  return new PinError({
    code,
    message: message || 'Unknown pinning error occurred.',
    technicalDetail,
    statusCode,
    requestId,
    recoverable,
  });
}
