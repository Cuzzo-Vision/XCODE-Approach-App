/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_STRIPE_PUBLIC_KEY: string;
  readonly VITE_STRIPE_MEMBERSHIP_LINK: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
