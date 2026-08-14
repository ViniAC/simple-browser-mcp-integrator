import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseToolJson } from "./agent-host.js";
import { startDevBrowserSession } from "./dev-browser-session.js";
import { fixtureInventory } from "./fixture-inventory.js";

describe("Dev Browser Type and Click", () => {
  let session: Awaited<ReturnType<typeof startDevBrowserSession>>;

  beforeAll(async () => {
    session = await startDevBrowserSession();
  }, 180_000);

  afterAll(async () => {
    await session.close();
  });

  it("type replaces the Full name value; re-read shows the new value", async () => {
    await session.host.callTool("open_page", { url: session.fixtureUrl });
    await session.host.callTool("type", {
      role: "textbox",
      name: "Full name",
      value: "Someone",
    });
    const typed = parseToolJson(
      await session.host.callTool("type", {
        role: "textbox",
        name: "Full name",
        value: "Ada Lovelace",
      }),
    );
    const inventory = parseToolJson(
      await session.host.callTool("get_inventory"),
    );

    expect(typed.isError).toBe(false);
    expect(typed.body).toEqual({ ok: true });
    expect(inventory.body).toEqual(
      fixtureInventory(session.fixtureUrl, { fullName: "Ada Lovelace" }),
    );
  }, 30_000);

  it("type into Password still reports filled, never the text", async () => {
    await session.host.callTool("open_page", { url: session.fixtureUrl });
    const typed = parseToolJson(
      await session.host.callTool("type", {
        role: "textbox",
        name: "Password",
        value: "s3cret",
      }),
    );
    const inventory = parseToolJson(
      await session.host.callTool("get_inventory"),
    );

    expect(typed.isError).toBe(false);
    expect(typed.body).toEqual({ ok: true });
    expect(inventory.body).toEqual(
      fixtureInventory(session.fixtureUrl, { password: "filled" }),
    );
  }, 30_000);

  it("type replaces the Notes textarea contents", async () => {
    await session.host.callTool("open_page", { url: session.fixtureUrl });
    const typed = parseToolJson(
      await session.host.callTool("type", {
        role: "textbox",
        name: "Notes",
        value: "Bring the analytical engine",
      }),
    );
    const inventory = parseToolJson(
      await session.host.callTool("get_inventory"),
    );

    expect(typed.isError).toBe(false);
    expect(typed.body).toEqual({ ok: true });
    expect(inventory.body).toEqual(
      fixtureInventory(session.fixtureUrl, {
        notes: "Bring the analytical engine",
      }),
    );
  }, 30_000);

  it("type on Country chooses the option whose label equals the given string", async () => {
    await session.host.callTool("open_page", { url: session.fixtureUrl });
    const typed = parseToolJson(
      await session.host.callTool("type", {
        role: "combobox",
        name: "Country",
        value: "Brazil",
      }),
    );
    const inventory = parseToolJson(
      await session.host.callTool("get_inventory"),
    );

    expect(typed.isError).toBe(false);
    expect(typed.body).toEqual({ ok: true });
    expect(inventory.body).toEqual(
      fixtureInventory(session.fixtureUrl, { country: "Brazil" }),
    );
  }, 30_000);

  it("type on Country chooses the option whose value equals the given string", async () => {
    await session.host.callTool("open_page", { url: session.fixtureUrl });
    const typed = parseToolJson(
      await session.host.callTool("type", {
        role: "combobox",
        name: "Country",
        value: "us",
      }),
    );
    const inventory = parseToolJson(
      await session.host.callTool("get_inventory"),
    );

    expect(typed.isError).toBe(false);
    expect(typed.body).toEqual({ ok: true });
    expect(inventory.body).toEqual(
      fixtureInventory(session.fixtureUrl, { country: "United States" }),
    );
  }, 30_000);

  it("type on Country fails when no option matches; the previous value is unchanged", async () => {
    await session.host.callTool("open_page", { url: session.fixtureUrl });
    await session.host.callTool("type", {
      role: "combobox",
      name: "Country",
      value: "Brazil",
    });
    const typed = parseToolJson(
      await session.host.callTool("type", {
        role: "combobox",
        name: "Country",
        value: "Narnia",
      }),
    );
    const inventory = parseToolJson(
      await session.host.callTool("get_inventory"),
    );

    expect(typed).toEqual({ isError: true, body: { error: "not_found" } });
    expect(inventory.body).toEqual(
      fixtureInventory(session.fixtureUrl, { country: "Brazil" }),
    );
  }, 30_000);

  it("click Subscribe toggles the checkbox; re-read shows checked then unchecked", async () => {
    await session.host.callTool("open_page", { url: session.fixtureUrl });
    const checked = parseToolJson(
      await session.host.callTool("click", {
        role: "checkbox",
        name: "Subscribe",
      }),
    );
    const afterCheck = parseToolJson(
      await session.host.callTool("get_inventory"),
    );
    const unchecked = parseToolJson(
      await session.host.callTool("click", {
        role: "checkbox",
        name: "Subscribe",
      }),
    );
    const afterUncheck = parseToolJson(
      await session.host.callTool("get_inventory"),
    );

    expect(checked.isError).toBe(false);
    expect(checked.body).toEqual({ ok: true });
    expect(afterCheck.body).toEqual(
      fixtureInventory(session.fixtureUrl, { subscribe: "checked" }),
    );
    expect(unchecked.isError).toBe(false);
    expect(unchecked.body).toEqual({ ok: true });
    expect(afterUncheck.body).toEqual(
      fixtureInventory(session.fixtureUrl, { subscribe: "unchecked" }),
    );
  }, 30_000);

  it("click Continue loads the link target in the current page", async () => {
    await session.host.callTool("open_page", { url: session.fixtureUrl });
    const clicked = parseToolJson(
      await session.host.callTool("click", { role: "link", name: "Continue" }),
    );
    const inventory = parseToolJson(
      await session.host.callTool("get_inventory"),
    );
    const doneUrl = new URL("done.html", session.fixtureUrl).href;

    expect(clicked.isError).toBe(false);
    expect(clicked.body).toEqual({ ok: true });
    expect(inventory.body).toEqual({
      title: "Fixture Continue",
      url: doneUrl,
      inputLabels: [],
      elements: [],
    });
  }, 30_000);

  it("click Submit changes the Result region on a later inventory", async () => {
    await session.host.callTool("open_page", { url: session.fixtureUrl });
    await session.host.callTool("type", {
      role: "textbox",
      name: "Full name",
      value: "Ada Lovelace",
    });
    await session.host.callTool("type", {
      role: "textbox",
      name: "Password",
      value: "s3cret",
    });
    await session.host.callTool("type", {
      role: "textbox",
      name: "Notes",
      value: "Bring the analytical engine",
    });
    const before = parseToolJson(await session.host.callTool("get_inventory"));
    const clicked = parseToolJson(
      await session.host.callTool("click", { role: "button", name: "Submit" }),
    );
    const after = parseToolJson(await session.host.callTool("get_inventory"));

    expect(before.body).toEqual(
      fixtureInventory(session.fixtureUrl, {
        fullName: "Ada Lovelace",
        password: "filled",
        notes: "Bring the analytical engine",
        result: "Ready",
      }),
    );
    expect(clicked.isError).toBe(false);
    expect(clicked.body).toEqual({ ok: true });
    expect(after.body).toEqual(
      fixtureInventory(session.fixtureUrl, {
        fullName: "Ada Lovelace",
        password: "filled",
        notes: "Bring the analytical engine",
        result: "Submitted",
      }),
    );
  }, 30_000);
});
