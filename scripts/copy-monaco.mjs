/**
 * Copies Monaco's browser build (node_modules/monaco-editor/min/vs) into
 * public/monaco/<version>/vs, so the app serves the editor itself instead of
 * loading it from the jsDelivr CDN. src/utils/monacoLoader.ts points the
 * loader at this folder. The version in the path makes a new Monaco version a
 * new URL, so browsers never mix cached files of two versions.
 *
 * Runs before `npm run dev` and `npm run build` (see package.json).
 */
import { cpSync, existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const packageDir = join(root, "node_modules", "monaco-editor");
const { version } = JSON.parse(readFileSync(join(packageDir, "package.json"), "utf8"));
const publicDir = join(root, "public", "monaco");
const target = join(publicDir, version, "vs");

// Remove the copies of other versions (this folder holds only generated files)
if (existsSync(publicDir)) {
  for (const entry of readdirSync(publicDir)) {
    if (entry !== version) rmSync(join(publicDir, entry), { recursive: true, force: true });
  }
}

if (existsSync(join(target, "loader.js"))) {
  console.log(`Monaco ${version} is already in public/monaco`);
} else {
  cpSync(join(packageDir, "min", "vs"), target, { recursive: true });
  console.log(`Copied Monaco ${version} to public/monaco/${version}/vs`);
}
