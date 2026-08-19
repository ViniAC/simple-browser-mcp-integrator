import { describe, expect, it } from "vitest";
import { createFakePageAccess, type FakePageSeed } from "../fake-page-access.js";
import { listenMcpHttp } from "../lib/listen-http.js";
import type { PageAccess } from "../lib/page-access.js";
import { parseToolJson, startHttpAgentHost } from "./agent-host.js";

const busyTimeoutMs = 250;

describe("many HTTP Agent Hosts share one current page", () => {
  it("Open from one is the current page the other inventories", async () => {
    const session = await startManyHosts(createFakePageAccess(seed()));
    try {
      const opened = parseToolJson(
        await session.a.callTool({
          name: "open_page",
          arguments: { url: "https://example.test/opened" },
        }),
      );
      const inventory = parseToolJson(
        await session.b.callTool({ name: "get_inventory", arguments: {} }),
      );

      expect(opened).toEqual({
        isError: false,
        body: { url: "https://example.test/opened" },
      });
      expect(inventory).toEqual({
        isError: false,
        body: {
          title: "Sign in",
          url: "https://example.test/opened",
          inputLabels: ["Email"],
          elements: [
            {
              role: "textbox",
              name: "Email",
              value: "old@b.test",
              enabled: true,
            },
          ],
        },
      });
    } finally {
      await session.close();
    }
  });

  it("overlapping Type waits, then the second runs", async () => {
    let releaseFirst!: () => void;
    const firstHold = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const inner = heldFirstType(seed(), firstHold);
    const session = await startManyHosts(inner);

    try {
      const first = session.a.callTool({
        name: "type",
        arguments: { role: "textbox", name: "Email", value: "ada@b.test" },
      });
      await inner.started;
      const second = session.b.callTool({
        name: "type",
        arguments: { role: "textbox", name: "Email", value: "grace@b.test" },
      });
      await delay(50);
      releaseFirst();
      expect(parseToolJson(await first)).toEqual({
        isError: false,
        body: { ok: true },
      });
      expect(parseToolJson(await second)).toEqual({
        isError: false,
        body: { ok: true },
      });
      const inventory = parseToolJson(
        await session.b.callTool({ name: "get_inventory", arguments: {} }),
      );
      expect(inventory).toEqual({
        isError: false,
        body: {
          title: "Sign in",
          url: "https://example.test/form",
          inputLabels: ["Email"],
          elements: [
            {
              role: "textbox",
              name: "Email",
              value: "grace@b.test",
              enabled: true,
            },
          ],
        },
      });
    } finally {
      releaseFirst();
      await session.close();
    }
  });

  it("fails busy if the in-flight tool holds past the bound, then a later tool still runs", async () => {
    let releaseFirst!: () => void;
    const firstHold = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const inner = heldFirstType(seed(), firstHold);
    const session = await startManyHosts(inner, busyTimeoutMs);

    try {
      const first = session.a.callTool({
        name: "type",
        arguments: { role: "textbox", name: "Email", value: "ada@b.test" },
      });
      await inner.started;
      const second = parseToolJson(
        await session.b.callTool({
          name: "type",
          arguments: { role: "textbox", name: "Email", value: "grace@b.test" },
        }),
      );
      expect(second).toEqual({ isError: true, body: { error: "busy" } });

      releaseFirst();
      expect(parseToolJson(await first)).toEqual({
        isError: false,
        body: { ok: true },
      });
      const inventory = parseToolJson(
        await session.b.callTool({ name: "get_inventory", arguments: {} }),
      );
      expect(inventory).toEqual({
        isError: false,
        body: {
          title: "Sign in",
          url: "https://example.test/form",
          inputLabels: ["Email"],
          elements: [
            {
              role: "textbox",
              name: "Email",
              value: "ada@b.test",
              enabled: true,
            },
          ],
        },
      });
    } finally {
      releaseFirst();
      await session.close();
    }
  });
});

function seed(): FakePageSeed {
  return {
    title: "Sign in",
    url: "https://example.test/form",
    inputLabels: ["Email"],
    elements: [
      { role: "textbox", name: "Email", value: "old@b.test", enabled: true },
    ],
  };
}

function heldFirstType(page: FakePageSeed, hold: Promise<void>) {
  const inner = createFakePageAccess(page);
  let pending = true;
  let started!: () => void;
  const startedPromise = new Promise<void>((resolve) => {
    started = resolve;
  });
  const access: PageAccess & { started: Promise<void> } = {
    started: startedPromise,
    open: (url, target) => inner.open(url, target),
    getInventory: () => inner.getInventory(),
    click: (path) => inner.click(path),
    async type(path, value) {
      if (pending) {
        pending = false;
        started();
        await hold;
      }
      return inner.type(path, value);
    },
  };
  return access;
}

async function startManyHosts(pageAccess: PageAccess, busyTimeoutMs?: number) {
  const http = await listenMcpHttp({ pageAccess, port: 0, busyTimeoutMs });
  const a = await startHttpAgentHost(http.url);
  const b = await startHttpAgentHost(http.url);
  return {
    a,
    b,
    async close() {
      await a.close();
      await b.close();
      await http.close();
    },
  };
}

function delay(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
