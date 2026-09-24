/**
 * Serverless function proxy for Pinata IPFS pinning.
 * Ensures PINATA_JWT is never shipped in client bundles (NFR-1).
 */
export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const pinataJwt = process.env.PINATA_JWT;
  if (!pinataJwt) {
    return new Response(
      JSON.stringify({
        error: 'PINATA_JWT server environment variable is not configured',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await req.json();

    const pinataResponse = await fetch(
      'https://api.pinata.cloud/pinning/pinJSONToIPFS',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${pinataJwt}`,
        },
        body: JSON.stringify({
          pinataContent: body,
          pinataMetadata: {
            name: `certichain-${body.certificateTitle || 'credential'}-${Date.now()}`,
          },
        }),
      }
    );

    const data = await pinataResponse.json();
    if (!pinataResponse.ok) {
      return new Response(JSON.stringify(data), {
        status: pinataResponse.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error pinning to IPFS';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
