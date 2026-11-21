/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** The API's public address, set at build time. It is not a secret. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
