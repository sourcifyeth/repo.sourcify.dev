import { loader } from "@monaco-editor/react";

/**
 * Loads Monaco from this app (public/monaco/<version>/vs, copied by
 * scripts/copy-monaco.mjs), in the version that package.json installs.
 * next.config.ts sets NEXT_PUBLIC_MONACO_VERSION. Without this setting,
 * @monaco-editor/react loads its own default version (0.52.2) from the
 * jsDelivr CDN. Import this module in every component that shows an editor:
 * the setting must run before the first editor mounts.
 */
loader.config({ paths: { vs: `/monaco/${process.env.NEXT_PUBLIC_MONACO_VERSION}/vs` } });
