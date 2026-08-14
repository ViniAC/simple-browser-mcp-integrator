import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fixturePort } from "../lib/serve-fixture.js";
import { parseToolJson } from "./agent-host.js";
import { fixtureInventory } from "./fixture-inventory.js";

const repoRoot = fileURLToPath(new URL("../../..", import.meta.url));
const stdioEntry = path.join(repoRoot, "packages", "server", "stdio.ts");
const fixtureUrl = `http://127.0.0.1:${fixturePort}/`;

describe("stdio Agent Host loop", () => {
  let agentHost: Client | undefined;

  beforeAll(async () => {
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ["--import", "tsx", stdioEntry],
      cwd: repoRoot,
      env: inheritedEnv(),
      stderr: "pipe",
    });
    const stderr: string[] = [];
    transport.stderr?.on("data", (chunk) => {
      stderr.push(String(chunk));
    });
    const host = new Client({ name: "test-agent-host", version: "0.0.0" });
    try {
      await host.connect(transport);
    } catch (error) {
      throw new Error(`${String(error)}\n${stderr.join("")}`);
    }
    agentHost = host;
    expect(host.getInstructions()).toContain(fixtureUrl);
  }, 180_000);

  afterAll(async () => {
    await agentHost?.close();
  });

  it("opens the Fixture Page, Types, Clicks Submit, and re-reads the Result", async () => {
    const host = agentHost;
    if (!host) {
      throw new Error("Agent Host did not attach over stdio");
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

function inheritedEnv() {
  return Object.fromEntries(
    Object.entries(process.env).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  );
}
