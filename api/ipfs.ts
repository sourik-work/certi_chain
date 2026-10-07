/**
 * Serverless function for IPFS Gateway proxy and fallback resolution.
 * Note: Maintained at repo root api/ipfs.ts for Vercel serverless root route discovery.
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
): Promise<void> {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const { cid } = req.query;
  if (!cid || typeof cid !== 'string') {
    res.status(400).json({ error: 'Missing CID parameter' });
    return;
  }

  const cleanCid = cid
    .replace(/^https?:\/\/[^/]+\/ipfs\//, '')
    .replace('ipfs://', '')
    .replace(/^ipfs\//, '')
    .split('?')[0]
    .split('#')[0]
    .trim();

  const pinataJwt = process.env.PINATA_JWT;
  const gateways = [
    `https://gateway.pinata.cloud/ipfs/${cleanCid}`,
    `https://cloudflare-ipfs.com/ipfs/${cleanCid}`,
    `https://ipfs.io/ipfs/${cleanCid}`,
    `https://dweb.link/ipfs/${cleanCid}`,
  ];

  for (const url of gateways) {
    try {
      const headers: Record<string, string> = {};
      if (pinataJwt && url.includes('pinata')) {
        headers['Authorization'] = `Bearer ${pinataJwt.trim()}`;
      }

      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 4000);
      const upstreamRes = await fetch(url, { headers, signal: controller.signal });
      clearTimeout(tid);

      if (upstreamRes.ok) {
        const contentType = upstreamRes.headers.get('content-type') || 'application/json';
        res.setHeader('Content-Type', contentType);
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        const buffer = await upstreamRes.arrayBuffer();
        res.status(200).send(Buffer.from(buffer));
        return;
      }
    } catch {
      // Continue to next gateway
    }
  }

  res.status(404).json({ error: `CID ${cleanCid} not found across IPFS gateways.` });
}
