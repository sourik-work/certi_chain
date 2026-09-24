/**
 * Normalized Error Types & Parser
 * Ensures raw ethers/RPC errors are sanitized and formatted nicely before reaching UI.
 */

export interface AppError {
  readonly title: string;
  readonly message: string;
  readonly details?: string;
  readonly code?: string | number;
}

export function normalizeError(err: unknown, fallbackTitle = 'Action Failed'): AppError {
  if (!err) {
    return { title: fallbackTitle, message: 'An unknown error occurred.' };
  }

  if (typeof err === 'string') {
    return { title: fallbackTitle, message: err };
  }

  const errorObj = err as Record<string, unknown>;

  // Check for custom Solidity / Ethers error names
  if (typeof errorObj.reason === 'string') {
    return { title: fallbackTitle, message: errorObj.reason };
  }

  if (typeof errorObj.shortMessage === 'string') {
    return { title: fallbackTitle, message: errorObj.shortMessage };
  }

  if (typeof errorObj.message === 'string') {
    const msg = errorObj.message;
    // Check for common metamask/rpc rejection
    if (msg.includes('user rejected') || msg.includes('ACTION_REJECTED')) {
      return { title: 'Transaction Cancelled', message: 'You rejected the transaction in your wallet.' };
    }
    if (msg.includes('NotAuthorizedIssuer')) {
      return { title: 'Unauthorized Issuer', message: 'Your connected wallet is not whitelisted to issue certificates.' };
    }
    if (msg.includes('CertificateAlreadyExists')) {
      return { title: 'Duplicate Certificate', message: 'A certificate with this proof hash has already been registered on-chain.' };
    }
    if (msg.includes('CertificateNotFound')) {
      return { title: 'Certificate Not Found', message: 'No certificate matching this identifier exists on-chain.' };
    }
    if (msg.includes('CertificateAlreadyRevoked')) {
      return { title: 'Already Revoked', message: 'This certificate has already been revoked.' };
    }
    if (msg.includes('NotIssuerOrOwner')) {
      return { title: 'Unauthorized', message: 'Only the original issuing address or contract owner can revoke this certificate.' };
    }
    if (msg.includes('InvalidProofHash')) {
      return { title: 'Invalid Hash', message: 'The proof hash cannot be empty or zero.' };
    }
    if (msg.includes('EmptyMetadataUrl')) {
      return { title: 'Invalid Metadata URL', message: 'The IPFS metadata URL cannot be empty.' };
    }
    if (msg.includes('EnforcedPause')) {
      return { title: 'Contract Paused', message: 'The Certificate Registry is currently paused by the administrator.' };
    }

    // Truncate long JSON-RPC error messages
    if (msg.length > 200) {
      return {
        title: fallbackTitle,
        message: 'Transaction failed on-chain or network request error.',
        details: msg.slice(0, 300) + '...',
      };
    }

    return { title: fallbackTitle, message: msg };
  }

  return { title: fallbackTitle, message: 'An unexpected error occurred.' };
}
