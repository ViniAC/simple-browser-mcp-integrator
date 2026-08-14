import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseToolJson } from "./agent-host.js";
import { startDevBrowserSession } from "./dev-browser-session.js";
import { fixtureInventory } from "./fixture-inventory.js";

describe("Dev Browser Page Inventory", () => {
  let session: Awaited<ReturnType<typeof startDevBrowserSession>>;

  beforeAll(async () => {
    session = await startDevBrowserSession();
  }, 180_000);

  afterAll(async () => {
    await session.close();
  });

  it("open_page returns the Fixture Page URL now loaded", async () => {
    const parsed = parseToolJson(
      await session.host.callTool("open_page", { url: session.fixtureUrl }),
    );

    expect(parsed.isError).toBe(false);
    expect(parsed.body).toEqual({ url: session.fixtureUrl });
  }, 180_000);

  it("get_inventory returns the Fixture Page title, URL, labels, and interactive elements", async () => {
    await session.host.callTool("open_page", { url: session.fixtureUrl });
    const parsed = parseToolJson(await session.host.callTool("get_inventory"));

    expect(parsed.isError).toBe(false);
    expect(parsed.body).toEqual(fixtureInventory(session.fixtureUrl));
  }, 30_000);

  it("the same loaded Extension Attaches after the Server restarts", async () => {
    await session.host.callTool("open_page", { url: session.fixtureUrl });

    await session.restartServer();

    const parsed = parseToolJson(await session.host.callTool("get_inventory"));
    expect(parsed.isError).toBe(false);
    expect(parsed.body).toEqual(fixtureInventory(session.fixtureUrl));
  }, 30_000);
});
