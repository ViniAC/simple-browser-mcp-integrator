import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseToolJson } from "./agent-host.js";
import { startDevBrowserSession } from "./dev-browser-session.js";
import { fixtureInventory } from "./fixture-inventory.js";

describe("Sticky current page", () => {
  let session: Awaited<ReturnType<typeof startDevBrowserSession>>;

  beforeAll(async () => {
    session = await startDevBrowserSession();
  }, 180_000);

  afterAll(async () => {
    await session.close();
  });

  it("get_inventory with no current page binds the focused tab without changing its URL", async () => {
    const beforeOpen = await session.tabs.pages();
    await session.tabs.openFocused(session.fixtureUrl);
    const afterOpen = await session.tabs.pages();

    const parsed = parseToolJson(await session.host.callTool("get_inventory"));
    const afterInventory = await session.tabs.pages();

    expect(parsed).toEqual({
      isError: false,
      body: fixtureInventory(session.fixtureUrl),
    });
    expect(afterOpen.length).toBe(beforeOpen.length + 1);
    expect(afterInventory).toHaveLength(afterOpen.length);
    expect(urlsOf(afterInventory)).toEqual(urlsOf(afterOpen));
  }, 30_000);

  it("inventory, Click, and Type stay on the bound tab when another tab is focused", async () => {
    await session.host.callTool("type", {
      role: "textbox",
      name: "Full name",
      value: "Ada Lovelace",
    });
    await session.tabs.openFocused(new URL("done.html", session.fixtureUrl).href);

    const typed = parseToolJson(
      await session.host.callTool("type", {
        role: "textbox",
        name: "Full name",
        value: "Grace Hopper",
      }),
    );
    const inventory = parseToolJson(await session.host.callTool("get_inventory"));
    const clicked = parseToolJson(
      await session.host.callTool("click", { role: "button", name: "Submit" }),
    );
    const after = parseToolJson(await session.host.callTool("get_inventory"));

    expect(typed).toEqual({ isError: false, body: { ok: true } });
    expect(inventory.body).toEqual(
      fixtureInventory(session.fixtureUrl, { fullName: "Grace Hopper" }),
    );
    expect(clicked).toEqual({ isError: false, body: { ok: true } });
    expect(after.body).toEqual(
      fixtureInventory(session.fixtureUrl, {
        fullName: "Grace Hopper",
        result: "Submitted",
      }),
    );
  }, 30_000);

  it("the current page is still the bound tab after the Extension service worker has slept", async () => {
    await session.tabs.sleepExtensionWorker();

    const parsed = await inventoryAfterAttach(session);
    expect(parsed).toEqual({
      isError: false,
      body: fixtureInventory(session.fixtureUrl, {
        fullName: "Grace Hopper",
        result: "Submitted",
      }),
    });
  }, 60_000);

  it("after the bound tab is closed, the next inventory returns not_connected", async () => {
    const bound = (await session.tabs.pages()).find(
      (page) => page.url === session.fixtureUrl,
    );
    if (!bound) {
      throw new Error("expected the bound Fixture Page tab");
    }
    await session.tabs.close(bound.id);

    const parsed = parseToolJson(await session.host.callTool("get_inventory"));
    expect(parsed).toEqual({
      isError: true,
      body: { error: "not_connected" },
    });
  }, 30_000);

  it("a later first tool after that binds the focused tab", async () => {
    const doneUrl = new URL("done.html", session.fixtureUrl).href;
    const parsed = parseToolJson(await session.host.callTool("get_inventory"));
    expect(parsed).toEqual({
      isError: false,
      body: {
        title: "Fixture Continue",
        url: doneUrl,
        inputLabels: [],
        elements: [],
      },
    });
  }, 30_000);
});

describe("Sticky current page with no focused tab", () => {
  let session: Awaited<ReturnType<typeof startDevBrowserSession>>;

  beforeAll(async () => {
    session = await startDevBrowserSession();
  }, 180_000);

  afterAll(async () => {
    await session.close();
  });

  it.each([
    ["get_inventory", undefined],
    ["click", { role: "button", name: "Submit" }],
    ["type", { role: "textbox", name: "Full name", value: "Ada" }],
  ] as const)(
    "%s returns not_connected and does not create a tab",
    async (name, args) => {
      await closeAllPages(session);
      const before = await session.tabs.pages();

      const parsed = parseToolJson(
        await session.host.callTool(name, args ? { ...args } : undefined),
      );
      const after = await session.tabs.pages();

      expect(parsed).toEqual({
        isError: true,
        body: { error: "not_connected" },
      });
      expect(after).toHaveLength(before.length);
    },
    30_000,
  );
});

function urlsOf(pages: Array<{ url: string }>) {
  return pages.map((page) => page.url).sort();
}

async function inventoryAfterAttach(
  session: Awaited<ReturnType<typeof startDevBrowserSession>>,
) {
  const deadline = Date.now() + 20_000;
  let parsed = parseToolJson(await session.host.callTool("get_inventory"));
  while (Date.now() < deadline) {
    if (!isNotConnected(parsed)) {
      return parsed;
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
    parsed = parseToolJson(await session.host.callTool("get_inventory"));
  }
  return parsed;
}

function isNotConnected(parsed: { isError: boolean; body: unknown }) {
  return (
    parsed.isError &&
    typeof parsed.body === "object" &&
    parsed.body !== null &&
    "error" in parsed.body &&
    parsed.body.error === "not_connected"
  );
}

async function closeAllPages(
  session: Awaited<ReturnType<typeof startDevBrowserSession>>,
) {
  for (const page of await session.tabs.pages()) {
    await session.tabs.close(page.id).catch(() => {});
  }
  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    const remaining = await session.tabs.pages().catch(() => []);
    if (remaining.length === 0) {
      return;
    }
    for (const page of remaining) {
      await session.tabs.close(page.id).catch(() => {});
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}
