import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildLoadableExtension } from "../../extension/build.js";
import { createAttachPageAccess } from "./extension-page-access.js";
import { fixturePort, serveFixture } from "./serve-fixture.js";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));

export async function startProductRuntime() {
  loadDotEnv();
  const fixture = envFlag("BROWSER_MCP_SERVE_FIXTURE")
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

function loadDotEnv() {
  try {
    process.loadEnvFile(path.join(repoRoot, ".env"));
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return;
    }
    throw error;
  }
}

function envFlag(name: string) {
  const raw = process.env[name];
  return raw === "1" || raw === "true";
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
