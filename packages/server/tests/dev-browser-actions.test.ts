import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseToolJson } from "./agent-host.js";
import { startDevBrowserSession } from "./dev-browser-session.js";

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

function fixtureInventory(
  url: string,
  values: { fullName?: string; notes?: string; password?: string; result?: string } = {},
) {
  return {
    title: "Fixture Page",
    url,
    inputLabels: [
      "Full name",
      "Password",
      "Notes",
      "Country",
      "Subscribe",
      "Result",
    ],
    elements: [
      {
        role: "textbox",
        name: "Full name",
        value: values.fullName ?? "",
        enabled: true,
      },
      {
        role: "textbox",
        name: "Password",
        value: values.password ?? "empty",
        enabled: true,
      },
      {
        role: "textbox",
        name: "Notes",
        value: values.notes ?? "",
        enabled: true,
      },
      { role: "combobox", name: "Country", value: "Choose", enabled: true },
      {
        role: "checkbox",
        name: "Subscribe",
        value: "unchecked",
        enabled: true,
      },
      { role: "button", name: "Submit", value: "", enabled: true },
      {
        role: "textbox",
        name: "Result",
        value: values.result ?? "Ready",
        enabled: true,
      },
      { role: "link", name: "Continue", value: "", enabled: true },
      { role: "button", name: "Duplicate", value: "", enabled: true },
      { role: "button", name: "Duplicate", value: "", enabled: true },
      { role: "button", name: "Locked", value: "", enabled: false },
    ],
  };
}
