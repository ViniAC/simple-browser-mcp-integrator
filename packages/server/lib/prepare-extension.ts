import { copyFile, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";

const extensionRoot = fileURLToPath(
  new URL("../../extension/", import.meta.url),
);

export async function prepareExtension(config: {
  websocketUrl: string;
  token: string;
}) {
  const dir = await mkdtemp(path.join(tmpdir(), "browser-mcp-ext-"));
  await esbuild.build({
    entryPoints: [path.join(extensionRoot, "src/background.ts")],
    bundle: true,
    format: "iife",
    outfile: path.join(dir, "background.js"),
    platform: "browser",
    target: "chrome120",
  });
  await copyFile(
    path.join(extensionRoot, "manifest.json"),
    path.join(dir, "manifest.json"),
  );
  await writeFile(path.join(dir, "config.json"), JSON.stringify(config));
  return {
    dir,
    close() {
      return rm(dir, { recursive: true, force: true }).catch(() => {});
    },
  };
}
