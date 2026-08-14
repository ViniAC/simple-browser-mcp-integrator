import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseToolJson } from "./agent-host.js";
import { startDevBrowserSession } from "./dev-browser-session.js";
import { fixtureInventory } from "./fixture-inventory.js";

describe("Dev Browser Path failures", () => {
  let session: Awaited<ReturnType<typeof startDevBrowserSession>>;

  beforeAll(async () => {
    session = await startDevBrowserSession();
  }, 180_000);

  afterAll(async () => {
    await session.close();
  });

  it("click and type fail with not_found when the Path matches no element", async () => {
    await session.host.callTool("open_page", { url: session.fixtureUrl });
    const missing = { role: "button", name: "Missing" };

    const clicked = parseToolJson(await session.host.callTool("click", missing));
    const typed = parseToolJson(
      await session.host.callTool("type", { ...missing, value: "x" }),
    );
    const inventory = parseToolJson(
      await session.host.callTool("get_inventory"),
    );

    expect(clicked).toEqual({ isError: true, body: { error: "not_found" } });
    expect(typed).toEqual({ isError: true, body: { error: "not_found" } });
    expect(inventory.body).toEqual(fixtureInventory(session.fixtureUrl));
  }, 30_000);

  it("click and type fail with ambiguous when the Path matches the duplicate pair", async () => {
    await session.host.callTool("open_page", { url: session.fixtureUrl });
    const duplicate = { role: "button", name: "Duplicate" };

    const clicked = parseToolJson(
      await session.host.callTool("click", duplicate),
    );
    const typed = parseToolJson(
      await session.host.callTool("type", { ...duplicate, value: "x" }),
    );
    const inventory = parseToolJson(
      await session.host.callTool("get_inventory"),
    );

    expect(clicked).toEqual({ isError: true, body: { error: "ambiguous" } });
    expect(typed).toEqual({ isError: true, body: { error: "ambiguous" } });
    expect(inventory.body).toEqual(fixtureInventory(session.fixtureUrl));
  }, 30_000);

  it("click and type fail with disabled when the Path is the locked control", async () => {
    await session.host.callTool("open_page", { url: session.fixtureUrl });
    const locked = { role: "button", name: "Locked" };

    const clicked = parseToolJson(await session.host.callTool("click", locked));
    const typed = parseToolJson(
      await session.host.callTool("type", { ...locked, value: "x" }),
    );
    const inventory = parseToolJson(
      await session.host.callTool("get_inventory"),
    );

    expect(clicked).toEqual({ isError: true, body: { error: "disabled" } });
    expect(typed).toEqual({ isError: true, body: { error: "disabled" } });
    expect(inventory.body).toEqual(fixtureInventory(session.fixtureUrl));
  }, 30_000);
});
