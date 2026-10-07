import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.query;
  const figmaToken = (req.headers['x-figma-token'] as string) || process.env.FIGMA_ACCESS_TOKEN;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing target url parameter' });
  }

  if (!figmaToken) {
    return res.status(401).json({ error: 'Missing Figma Access Token' });
  }

  try {
    const fRes = await fetch(url, {
      headers: {
        'X-Figma-Token': figmaToken.trim(),
        'Content-Type': 'application/json',
      },
    });

    const data = await fRes.json();
    return res.status(fRes.status).json(data);
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Figma API proxy request failed' });
  }
}
