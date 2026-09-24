/**
 * Serverless function proxy for Pinata IPFS pinning.
 * Ensures PINATA_JWT is never shipped in client bundles (NFR-1).
 * Uses standard Node.js Serverless runtime for maximum compatibility.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  // CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const pinataJwt = process.env.PINATA_JWT;
  if (!pinataJwt || !pinataJwt.trim()) {
    console.error('[pinJson] PINATA_JWT is missing or empty');
    res.status(500).json({
      error: 'PINATA_JWT server environment variable is not configured',
    });
    return;
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

    console.log('[pinJson] Pinning to Pinata...', {
      title: body.certificateTitle || 'unknown',
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const pinataResponse = await fetch(
      'https://api.pinata.cloud/pinning/pinJSONToIPFS',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${pinataJwt.trim()}`,
        },
        body: JSON.stringify({
          pinataContent: body,
          pinataMetadata: {
            name: `certichain-${body.certificateTitle || 'credential'}-${Date.now()}`,
          },
        }),
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);

    const responseText = await pinataResponse.text();
    console.log('[pinJson] Pinata response status:', pinataResponse.status);

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(responseText) as Record<string, unknown>;
    } catch {
      console.error('[pinJson] Failed to parse Pinata response:', responseText.slice(0, 500));
      res.status(502).json({
        error: `Pinata returned invalid JSON (HTTP ${pinataResponse.status})`,
      });
      return;
    }

    if (!pinataResponse.ok) {
      console.error('[pinJson] Pinata error:', pinataResponse.status, data);
      res.status(pinataResponse.status).json(data);
      return;
    }

    console.log('[pinJson] Pin successful, CID:', data.IpfsHash);
    res.status(200).json(data);
  } catch (err: unknown) {
    const message =
      err instanceof Error
        ? err.name === 'AbortError'
          ? 'Pinata request timed out after 15 seconds'
          : err.message
        : 'Unknown error pinning to IPFS';
    console.error('[pinJson] Error:', message);
    res.status(500).json({ error: message });
  }
}
