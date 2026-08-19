import { randomBytes } from "node:crypto";
import {
  copyFile,
  mkdir,
  readFile,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as esbuild from "esbuild";
import { pngCircle } from "./png.js";

const extensionRoot = fileURLToPath(new URL("./", import.meta.url));
export const loadableExtensionDir = path.join(extensionRoot, "dist");
export const defaultExtensionSocketPort = 7422;

export type ExtensionConfig = {
  websocketUrl: string;
  token: string;
};

export async function buildLoadableExtension(options?: {
  dir?: string;
  port?: number;
}) {
  const dir = options?.dir ?? loadableExtensionDir;
  const configPath = path.join(dir, "config.json");
  const existing = await readConfig(configPath);
  const port =
    existing === undefined
      ? (options?.port ?? defaultExtensionSocketPort)
      : portFrom(existing);
  if (options?.port !== undefined && options.port !== port) {
    throw new Error(
      `Extension at ${dir} is already configured for port ${port}`,
    );
  }
  const config =
    existing ??
    ({
      websocketUrl: `ws://127.0.0.1:${port}`,
      token: randomBytes(16).toString("hex"),
    } satisfies ExtensionConfig);
  await buildConfiguredExtension(dir, config);
  return {
    dir,
    port,
    secret: config.token,
    websocketUrl: config.websocketUrl,
  };
}

export async function buildConfiguredExtension(
  dir: string,
  config: ExtensionConfig,
) {
  await mkdir(dir, { recursive: true });
  await esbuild.build({
    entryPoints: [
      path.join(extensionRoot, "src/background.ts"),
      path.join(extensionRoot, "src/popup.ts"),
    ],
    bundle: true,
    format: "iife",
    outdir: dir,
    platform: "browser",
    target: "chrome120",
  });
  await copyFile(
    path.join(extensionRoot, "manifest.json"),
    path.join(dir, "manifest.json"),
  );
  await copyFile(
    path.join(extensionRoot, "src/popup.html"),
    path.join(dir, "popup.html"),
  );
  await writeFile(path.join(dir, "config.json"), JSON.stringify(config));
  await writeExtensionIcons(dir);
}

async function readConfig(configPath: string) {
  try {
    const parsed = JSON.parse(await readFile(configPath, "utf8")) as unknown;
    if (!isExtensionConfig(parsed)) {
      throw new Error(`Invalid Extension config at ${configPath}`);
    }
    return parsed;
  } catch (error) {
    if (isMissingFile(error)) {
      return undefined;
    }
    throw error;
  }
}

function isExtensionConfig(value: unknown): value is ExtensionConfig {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    typeof record.websocketUrl === "string" &&
    typeof record.token === "string" &&
    record.token.length > 0
  );
}

function portFrom(config: ExtensionConfig) {
  const url = new URL(config.websocketUrl);
  const port = Number(url.port);
  if (url.protocol !== "ws:" || url.hostname !== "127.0.0.1" || !port) {
    throw new Error(`Invalid Extension WebSocket URL: ${config.websocketUrl}`);
  }
  return port;
}

function isMissingFile(error: unknown): error is NodeJS.ErrnoException {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}

async function writeExtensionIcons(dir: string) {
  const iconsDir = path.join(dir, "icons");
  await mkdir(iconsDir, { recursive: true });
  const colors = {
    attached: [22, 163, 74],
    "not-attached": [107, 114, 128],
  } as const;
  for (const [name, rgb] of Object.entries(colors)) {
    for (const size of [16, 32] as const) {
      await writeFile(
        path.join(iconsDir, `${name}-${size}.png`),
        pngCircle(size, rgb[0], rgb[1], rgb[2]),
      );
    }
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const extension = await buildLoadableExtension();
  console.log(extension.dir);
}
