import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildLoadableExtension } from "../../extension/build.js";
import { createAttachPageAccess } from "./extension-page-access.js";
import { fixturePort, serveFixture } from "./serve-fixture.js";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));

export async function startProductRuntime() {
  await loadDotEnv();
  const fixture = shouldServeFixture()
    ? await serveFixture(envInt("BROWSER_MCP_FIXTURE_PORT") ?? fixturePort)
    : undefined;
  const pageAccess = await createAttachPageAccess(await resolveAttach());
  return {
    pageAccess,
    fixtureUrl: fixture?.url,
    async close() {
      await pageAccess.close();
      fixture?.close();
    },
  };
}

export async function loadDotEnv() {
  let text: string;
  try {
    text = await readFile(path.join(repoRoot, ".env"), "utf8");
  } catch (error) {
    if (isEnoent(error)) {
      return;
    }
    throw error;
  }
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    if (process.env[key] !== undefined) {
      continue;
    }
    process.env[key] = unquote(trimmed.slice(eq + 1).trim());
  }
}

export function envInt(name: string) {
  const raw = process.env[name];
  if (raw === undefined || raw === "") {
    return undefined;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

async function resolveAttach() {
  const secret = process.env.BROWSER_MCP_ATTACH_SECRET;
  const port = envInt("BROWSER_MCP_ATTACH_PORT");
  const attachTimeoutMs = envInt("BROWSER_MCP_ATTACH_TIMEOUT_MS");
  if (secret && port !== undefined) {
    return { secret, port, attachTimeoutMs };
  }
  const extension = await buildLoadableExtension();
  return {
    secret: extension.secret,
    port: extension.port,
    attachTimeoutMs,
  };
}

function shouldServeFixture() {
  const raw = process.env.BROWSER_MCP_SERVE_FIXTURE;
  if (raw === undefined || raw === "") {
    return true;
  }
  return raw !== "0" && raw.toLowerCase() !== "false";
}

function unquote(value: string) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function isEnoent(error: unknown): error is NodeJS.ErrnoException {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as NodeJS.ErrnoException).code === "ENOENT"
  );
}
