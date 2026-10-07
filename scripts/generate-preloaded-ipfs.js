const fs = require('fs');
const path = require('path');

const devIpfsDir = path.join(__dirname, '..', 'frontend', '.devipfs');
const jsonMap = {};
const binMap = {};

if (fs.existsSync(devIpfsDir)) {
  const files = fs.readdirSync(devIpfsDir);
  for (const f of files) {
    const fullPath = path.join(devIpfsDir, f);
    if (f.endsWith('.json')) {
      const cid = f.replace('.json', '');
      try {
        jsonMap[cid] = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
      } catch (e) {}
    } else if (f.endsWith('.bin')) {
      const cid = f.replace('.bin', '');
      try {
        binMap[cid] = fs.readFileSync(fullPath).toString('base64');
      } catch (e) {}
    }
  }
}

const outContent = `/**
 * @file preloadedIpfs.ts
 * @summary Bundled preloaded IPFS records and binary fallback assets for offline resilience and universal verification.
 */
import { CertificateMetadata } from '../types/certificate';

export const PRELOADED_IPFS_METADATA: Record<string, any> = ${JSON.stringify(jsonMap, null, 2)};

export const PRELOADED_IPFS_BINARY: Record<string, string> = ${JSON.stringify(binMap, null, 2)};

export function getPreloadedMetadata(cidOrUrl: string): CertificateMetadata | null {
  if (!cidOrUrl) return null;
  const clean = cidOrUrl
    .replace(/^https?:\\/\\/[^/]+\\/ipfs\\//, '')
    .replace('ipfs://', '')
    .replace(/^ipfs\\//, '')
    .split('?')[0]
    .split('#')[0]
    .trim();

  if (PRELOADED_IPFS_METADATA[clean]) {
    return PRELOADED_IPFS_METADATA[clean];
  }
  if (PRELOADED_IPFS_METADATA[cidOrUrl]) {
    return PRELOADED_IPFS_METADATA[cidOrUrl];
  }

  // Also check if any record matches by proofHash / certId
  for (const v of Object.values(PRELOADED_IPFS_METADATA)) {
    if (
      v.issuedProofHash?.toLowerCase() === clean.toLowerCase() ||
      v.issuedProofHash?.toLowerCase() === cidOrUrl.toLowerCase()
    ) {
      return v;
    }
  }

  return null;
}

export function getPreloadedBinary(cidOrUrl: string): string | null {
  if (!cidOrUrl) return null;
  const clean = cidOrUrl
    .replace(/^https?:\\/\\/[^/]+\\/ipfs\\//, '')
    .replace('ipfs://', '')
    .replace(/^ipfs\\//, '')
    .split('?')[0]
    .split('#')[0]
    .trim();

  return PRELOADED_IPFS_BINARY[clean] || PRELOADED_IPFS_BINARY[cidOrUrl] || null;
}
`;

const targetPath = path.join(__dirname, '..', 'frontend', 'src', 'lib', 'preloadedIpfs.ts');
fs.writeFileSync(targetPath, outContent, 'utf8');
console.log('Wrote preloadedIpfs.ts successfully with ' + Object.keys(jsonMap).length + ' JSON CIDs and ' + Object.keys(binMap).length + ' BIN CIDs');
