/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CHAIN_ID?: string;
  readonly VITE_REGISTRY_ADDRESS?: string;
  readonly VITE_PINATA_GATEWAY?: string;
  readonly VITE_IPFS_FALLBACK_GATEWAY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
