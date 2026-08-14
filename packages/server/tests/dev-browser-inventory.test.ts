import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseToolJson } from "./agent-host.js";
import { startDevBrowserSession } from "./dev-browser-session.js";

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
    expect(parsed.body).toEqual({
      title: "Fixture Page",
      url: session.fixtureUrl,
      inputLabels: [
        "Full name",
        "Password",
        "Notes",
        "Country",
        "Subscribe",
        "Result",
      ],
      elements: [
        { role: "textbox", name: "Full name", value: "", enabled: true },
        { role: "textbox", name: "Password", value: "empty", enabled: true },
        { role: "textbox", name: "Notes", value: "", enabled: true },
        { role: "combobox", name: "Country", value: "Choose", enabled: true },
        {
          role: "checkbox",
          name: "Subscribe",
          value: "unchecked",
          enabled: true,
        },
        { role: "button", name: "Submit", value: "", enabled: true },
        { role: "textbox", name: "Result", value: "Ready", enabled: true },
        { role: "link", name: "Continue", value: "", enabled: true },
        { role: "button", name: "Duplicate", value: "", enabled: true },
        { role: "button", name: "Duplicate", value: "", enabled: true },
        { role: "button", name: "Locked", value: "", enabled: false },
      ],
    });
  }, 30_000);
});
