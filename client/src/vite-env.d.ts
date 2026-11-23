/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_APP_EDITION?: "FULL" | "ATTENDANCE";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare const __ECS_ATTENDANCE_INBOX_CODE_READY__: boolean;
