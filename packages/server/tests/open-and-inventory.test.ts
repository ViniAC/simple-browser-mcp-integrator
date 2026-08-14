import { describe, expect, it } from "vitest";
import { parseToolJson, startSession } from "./agent-host.js";

describe("open_page and get_inventory", () => {
  it("open_page returns the URL now loaded", async () => {
    const host = await startSession({
      title: "Start",
      url: "https://example.test/start",
      inputLabels: [],
      elements: [],
    });

    const parsed = parseToolJson(
      await host.callTool("open_page", { url: "https://example.test/form" }),
    );

    expect(parsed.isError).toBe(false);
    expect(parsed.body).toEqual({ url: "https://example.test/form" });

    await host.close();
  });

  it("get_inventory returns title, URL, input labels, and interactive elements", async () => {
    const host = await startSession({
      title: "Sign in",
      url: "https://example.test/start",
      inputLabels: ["Email", "Password"],
      elements: [
        { role: "textbox", name: "Email", value: "a@b.test", enabled: true },
        { role: "button", name: "Submit", value: "", enabled: false },
      ],
    });

    await host.callTool("open_page", { url: "https://example.test/form" });
    const parsed = parseToolJson(await host.callTool("get_inventory"));

    expect(parsed.isError).toBe(false);
    expect(parsed.body).toEqual({
      title: "Sign in",
      url: "https://example.test/form",
      inputLabels: ["Email", "Password"],
      elements: [
        { role: "textbox", name: "Email", value: "a@b.test", enabled: true },
        { role: "button", name: "Submit", value: "", enabled: false },
      ],
    });

    await host.close();
  });

  it("get_inventory reports password values as filled or empty, never the text", async () => {
    const host = await startSession({
      title: "Sign in",
      url: "https://example.test/form",
      inputLabels: ["Password"],
      elements: [
        {
          role: "textbox",
          name: "Password",
          value: "s3cret",
          enabled: true,
          password: true,
        },
        {
          role: "textbox",
          name: "Confirm",
          value: "",
          enabled: true,
          password: true,
        },
      ],
    });

    const parsed = parseToolJson(await host.callTool("get_inventory"));

    expect(parsed.isError).toBe(false);
    expect(parsed.body).toEqual({
      title: "Sign in",
      url: "https://example.test/form",
      inputLabels: ["Password"],
      elements: [
        { role: "textbox", name: "Password", value: "filled", enabled: true },
        { role: "textbox", name: "Confirm", value: "empty", enabled: true },
      ],
    });

    await host.close();
  });
});
