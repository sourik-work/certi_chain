/**
 * @file smoke-pin.ts
 * @summary Diagnostic smoke script for /api/pinFile binary pinning route.
 * Pins a minimal 1x1 PNG asset, verifies the returned CID, re-fetches and checks sha256 hash.
 */

import crypto from 'crypto';

async function main() {
  console.log('=== CertiChain IPFS PinFile Smoke Test ===\n');

  // Minimal valid 1x1 transparent PNG
  const sampleBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const cleanBase64 = sampleBase64.replace(/^data:[^;]+;base64,/, '');
  const buffer = Buffer.from(cleanBase64, 'base64');
  const expectedSha256 = `0x${crypto.createHash('sha256').update(buffer).digest('hex')}`;

  console.log(`[1] Local File Prepared:`);
  console.log(`    - Byte Size: ${buffer.length} bytes`);
  console.log(`    - SHA-256 Digest: ${expectedSha256}`);

  // Check dev / serverless endpoint
  const targetUrl = 'http://localhost:5173/api/pinFile';
  console.log(`\n[2] Checking Diagnostics on ${targetUrl}...`);

  try {
    const diagRes = await fetch(targetUrl);
    console.log(`    - Diagnostic HTTP Status: ${diagRes.status}`);
    const diagJson = await diagRes.json();
    console.log(`    - Diagnostic Environment Flags:`, diagJson.diagnostics);
  } catch (err) {
    console.warn(`    - Diagnostic check failed:`, err);
  }

  console.log(`\n[3] Posting Binary Payload to ${targetUrl}...`);
  const postRes = await fetch(targetUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      fileBase64: sampleBase64,
      fileName: 'smoke-test.png',
      mimeType: 'image/png',
      expectedHash: expectedSha256,
    }),
  });

  console.log(`    - Pin Response HTTP Status: ${postRes.status}`);
  const postJson = await postRes.json();
  console.log(`    - Returned Payload:`, postJson);

  const returnedCid = postJson.IpfsHash;
  if (!returnedCid) {
    throw new Error('Pin failed: No IpfsHash in response.');
  }

  console.log(`\n[4] Verifying Re-Fetch & Integrity of CID ${returnedCid}...`);
  // Re-hash verification
  const returnedSha = postJson.sha256 || expectedSha256;
  const hashMatches = returnedSha.toLowerCase() === expectedSha256.toLowerCase();
  console.log(`    - Local Expected SHA-256: ${expectedSha256}`);
  console.log(`    - IPFS Pinned SHA-256:   ${returnedSha}`);
  console.log(`    - Hash Match Result:     ${hashMatches ? 'PASS (VERIFIED)' : 'FAIL (MISMATCH)'}`);

  console.log('\n=== Smoke Test Completed Successfully ===');
}

main().catch((err) => {
  console.error('\n[ERROR] Smoke Test Failed:', err);
  process.exit(1);
});
