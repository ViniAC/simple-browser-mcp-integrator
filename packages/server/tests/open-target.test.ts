import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseToolJson } from "./agent-host.js";
import { startDevBrowserSession } from "./dev-browser-session.js";
import { fixtureInventory } from "./fixture-inventory.js";

describe("Open target", () => {
  let session: Awaited<ReturnType<typeof startDevBrowserSession>>;

  beforeAll(async () => {
    session = await startDevBrowserSession();
  }, 180_000);

  afterAll(async () => {
    await session.close();
  });

  it("open_page accepts an optional Open target and the Agent Host still has only four tools", async () => {
    const tools = await session.host.listTools();
    const names = tools.tools.map((tool) => tool.name).sort();
    const openPage = tools.tools.find((tool) => tool.name === "open_page");
    const schema = openPage?.inputSchema as {
      properties?: Record<string, unknown>;
      required?: string[];
    };

    expect(names).toEqual(["click", "get_inventory", "open_page", "type"]);
    expect(schema.properties).toEqual(
      expect.objectContaining({
        url: expect.objectContaining({ type: "string" }),
        target: expect.objectContaining({
          type: "string",
          enum: ["current", "new", "focused"],
        }),
      }),
    );
    expect(schema.required).toEqual(["url"]);
  }, 30_000);

  it("default Open with no current page binds the focused tab, loads there, and returns the URL", async () => {
    const doneUrl = continueUrl(session.fixtureUrl);
    await session.tabs.openFocused(doneUrl);
    const before = await session.tabs.pages();

    const opened = parseToolJson(
      await session.host.callTool("open_page", { url: session.fixtureUrl }),
    );
    const after = await session.tabs.pages();
    const inventory = parseToolJson(await session.host.callTool("get_inventory"));

    expect(opened).toEqual({
      isError: false,
      body: { url: session.fixtureUrl },
    });
    expect(after).toHaveLength(before.length);
    expect(urlsOf(after)).toContain(session.fixtureUrl);
    expect(urlsOf(after)).not.toContain(doneUrl);
    expect(inventory).toEqual({
      isError: false,
      body: fixtureInventory(session.fixtureUrl),
    });
  }, 30_000);

  it("target current with a current page loads the URL in that page and returns it", async () => {
    const doneUrl = continueUrl(session.fixtureUrl);
    const before = await session.tabs.pages();

    const opened = parseToolJson(
      await session.host.callTool("open_page", {
        url: doneUrl,
        target: "current",
      }),
    );
    const after = await session.tabs.pages();
    const inventory = parseToolJson(await session.host.callTool("get_inventory"));

    expect(opened).toEqual({ isError: false, body: { url: doneUrl } });
    expect(after).toHaveLength(before.length);
    expect(urlsOf(after)).toContain(doneUrl);
    expect(urlsOf(after)).not.toContain(session.fixtureUrl);
    expect(inventory).toEqual({
      isError: false,
      body: continueInventory(doneUrl),
    });
  }, 30_000);

  it("target new creates a tab, loads, rebinds the current page, and leaves the previous tab open", async () => {
    const doneUrl = continueUrl(session.fixtureUrl);
    const before = await session.tabs.pages();

    const opened = parseToolJson(
      await session.host.callTool("open_page", {
        url: session.fixtureUrl,
        target: "new",
      }),
    );
    const after = await session.tabs.pages();
    const inventory = parseToolJson(await session.host.callTool("get_inventory"));

    expect(opened).toEqual({
      isError: false,
      body: { url: session.fixtureUrl },
    });
    expect(after).toHaveLength(before.length + 1);
    expect(urlsOf(after)).toContain(doneUrl);
    expect(urlsOf(after)).toContain(session.fixtureUrl);
    expect(inventory).toEqual({
      isError: false,
      body: fixtureInventory(session.fixtureUrl),
    });
  }, 30_000);

  it("target focused binds the focused tab, loads there, and rebinds the current page", async () => {
    const doneUrl = continueUrl(session.fixtureUrl);
    const blank = (await session.tabs.pages()).find((page) =>
      page.url.startsWith("about:blank"),
    );
    if (!blank) {
      throw new Error("expected an about:blank tab to focus");
    }
    await session.tabs.focus(blank.id);

    const opened = parseToolJson(
      await session.host.callTool("open_page", {
        url: doneUrl,
        target: "focused",
      }),
    );
    const after = await session.tabs.pages();
    const previous = after.find((page) => page.url === session.fixtureUrl);
    if (!previous) {
      throw new Error("expected the previous Fixture Page tab to stay open");
    }
    await session.tabs.focus(previous.id);
    const inventory = parseToolJson(await session.host.callTool("get_inventory"));

    expect(opened).toEqual({ isError: false, body: { url: doneUrl } });
    expect(urlsOf(after)).toContain(session.fixtureUrl);
    expect(urlsOf(after)).toContain(doneUrl);
    expect(urlsOf(after)).not.toContain(blank.url);
    expect(inventory).toEqual({
      isError: false,
      body: continueInventory(doneUrl),
    });
  }, 30_000);

  it("default Open with no tabs creates a tab, loads, binds it, and returns the URL", async () => {
    await session.tabs.closeAll();
    const before = await session.tabs.pages();

    const opened = parseToolJson(
      await session.host.callTool("open_page", { url: session.fixtureUrl }),
    );
    const after = await session.tabs.pages();
    const inventory = parseToolJson(await session.host.callTool("get_inventory"));

    expect(before).toHaveLength(0);
    expect(opened).toEqual({
      isError: false,
      body: { url: session.fixtureUrl },
    });
    expect(after.length).toBeGreaterThan(0);
    expect(inventory).toEqual({
      isError: false,
      body: fixtureInventory(session.fixtureUrl),
    });
  }, 30_000);

  it("target focused with no focused tab returns not_connected and does not create a tab", async () => {
    await session.tabs.closeAll();
    const before = await session.tabs.pages();

    const opened = parseToolJson(
      await session.host.callTool("open_page", {
        url: session.fixtureUrl,
        target: "focused",
      }),
    );
    const after = await session.tabs.pages();

    expect(opened).toEqual({
      isError: true,
      body: { error: "not_connected" },
    });
    expect(after).toHaveLength(before.length);
  }, 30_000);
});

function continueUrl(fixtureUrl: string) {
  return new URL("done.html", fixtureUrl).href;
}

function continueInventory(url: string) {
  return {
    title: "Fixture Continue",
    url,
    inputLabels: [],
    elements: [],
  };
}

function urlsOf(pages: Array<{ url: string }>) {
  return pages.map((page) => page.url);
}
