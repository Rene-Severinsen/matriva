interface ImportMetaEnv {
  readonly VITE_MATRIVA_API_BASE_URL?: string;
  readonly VITE_MATRIVA_ADMIN_API_BASE_URL?: string;
  readonly VITE_MATRIVA_ADMIN_ALLOW_ENVIRONMENT_SWITCH?: string;
  readonly DEV: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.css";

declare module "react-dom/client" {
  import type { ReactNode } from "react";

  export function createRoot(container: Element | DocumentFragment): {
    render(children: ReactNode): void;
    unmount(): void;
  };
}
