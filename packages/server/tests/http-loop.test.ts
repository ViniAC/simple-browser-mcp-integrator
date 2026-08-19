import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildLoadableExtension } from "../../extension/build.js";
import { createAttachPageAccess } from "../lib/extension-page-access.js";
import { launchDevBrowser } from "../lib/launch-dev-browser.js";
import { listenMcpHttp } from "../lib/listen-http.js";
import { serveFixture } from "../lib/serve-fixture.js";
import { parseToolJson, startHttpAgentHost } from "./agent-host.js";
import { availablePort } from "./dev-browser-session.js";
import { fixtureInventory } from "./fixture-inventory.js";

const attachTimeoutMs = 250;

describe("HTTP Agent Host initialize does not require Attach", () => {
  it("connects when no User Browser is running and no Extension is attached", async () => {
    const pageAccess = await createAttachPageAccess({
      attachTimeoutMs,
      secret: "http-no-attach",
      port: await availablePort(),
    });
    const http = await listenMcpHttp({ pageAccess, port: 0 });
    const started = Date.now();

    try {
      const host = await startHttpAgentHost(http.url);
      expect(Date.now() - started).toBeLessThan(attachTimeoutMs);
      await host.close();
    } finally {
      await http.close();
      await pageAccess.close();
    }
  });
});

describe("HTTP Agent Host when nothing Attaches", () => {
  it("returns not_connected after the bounded wait", async () => {
    const pageAccess = await createAttachPageAccess({
      attachTimeoutMs,
      secret: "http-no-attach",
      port: await availablePort(),
    });
    const http = await listenMcpHttp({ pageAccess, port: 0 });
    const host = await startHttpAgentHost(http.url);

    try {
      const parsed = parseToolJson(
        await host.callTool({ name: "get_inventory", arguments: {} }),
      );
      expect(parsed).toEqual({
        isError: true,
        body: { error: "not_connected" },
      });
    } finally {
      await host.close();
      await http.close();
      await pageAccess.close();
    }
  }, 30_000);
});

describe("HTTP Agent Host loop", () => {
  let session: HttpLoopSession | undefined;

  beforeAll(async () => {
    session = await startHttpLoopSession();
    const notes = session.host.getInstructions() ?? "";
    expect(notes).toContain("Load unpacked");
    expect(notes).toContain(session.fixtureUrl);
  }, 180_000);

  afterAll(async () => {
    await session?.close();
  });

  it("opens the Fixture Page, Types, Clicks Submit, and re-reads the Result", async () => {
    const host = session?.host;
    const fixtureUrl = session?.fixtureUrl;
    if (!host || !fixtureUrl) {
      throw new Error("Agent Host did not attach over HTTP");
    }

    const opened = parseToolJson(
      await host.callTool({
        name: "open_page",
        arguments: { url: fixtureUrl },
      }),
    );
    const before = parseToolJson(
      await host.callTool({ name: "get_inventory", arguments: {} }),
    );
    const typed = parseToolJson(
      await host.callTool({
        name: "type",
        arguments: {
          role: "textbox",
          name: "Full name",
          value: "Ada Lovelace",
        },
      }),
    );
    const clicked = parseToolJson(
      await host.callTool({
        name: "click",
        arguments: { role: "button", name: "Submit" },
      }),
    );
    const after = parseToolJson(
      await host.callTool({ name: "get_inventory", arguments: {} }),
    );

    expect(opened).toEqual({ isError: false, body: { url: fixtureUrl } });
    expect(before.body).toEqual(fixtureInventory(fixtureUrl));
    expect(typed).toEqual({ isError: false, body: { ok: true } });
    expect(clicked).toEqual({ isError: false, body: { ok: true } });
    expect(after.body).toEqual(
      fixtureInventory(fixtureUrl, {
        fullName: "Ada Lovelace",
        result: "Submitted",
      }),
    );
  }, 180_000);
});

type HttpLoopSession = {
  host: Client;
  fixtureUrl: string;
  close(): Promise<void>;
};

async function startHttpLoopSession(): Promise<HttpLoopSession> {
  const extensionDir = await mkdtemp(
    path.join(tmpdir(), "browser-mcp-http-"),
  );
  const extension = await buildLoadableExtension({
    dir: extensionDir,
    port: await availablePort(),
  });
  const fixture = await serveFixture();
  const pageAccess = await createAttachPageAccess({
    secret: extension.secret,
    port: extension.port,
  });
  const http = await listenMcpHttp({
    pageAccess,
    fixtureUrl: fixture.url,
    port: 0,
  });
  try {
    const host = await startHttpAgentHost(http.url);
    const browser = await launchDevBrowser(extensionDir);
    return {
      host,
      fixtureUrl: fixture.url,
      async close() {
        await host.close();
        await http.close();
        await pageAccess.close();
        await browser.close();
        fixture.close();
        await rm(extensionDir, { recursive: true, force: true });
      },
    };
  } catch (error) {
    await http.close().catch(() => {});
    await pageAccess.close().catch(() => {});
    fixture.close();
    await rm(extensionDir, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}
