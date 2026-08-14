import { describe, expect, it } from "vitest";
import { parseToolJson, startSession } from "./agent-host.js";

describe("type and click", () => {
  it("type replaces the current value and a later inventory shows it", async () => {
    const host = await startSession({
      title: "Sign in",
      url: "https://example.test/form",
      inputLabels: ["Email"],
      elements: [
        { role: "textbox", name: "Email", value: "old@b.test", enabled: true },
      ],
    });

    const typed = parseToolJson(
      await host.callTool("type", {
        role: "textbox",
        name: "Email",
        value: "new@b.test",
      }),
    );
    const inventory = parseToolJson(await host.callTool("get_inventory"));

    expect(typed.isError).toBe(false);
    expect(typed.body).toEqual({ ok: true });
    expect(inventory.body).toEqual({
      title: "Sign in",
      url: "https://example.test/form",
      inputLabels: ["Email"],
      elements: [
        { role: "textbox", name: "Email", value: "new@b.test", enabled: true },
      ],
    });

    await host.close();
  });

  it("click activates the named Path on the fake page", async () => {
    const host = await startSession({
      title: "Sign in",
      url: "https://example.test/form",
      inputLabels: ["Remember me"],
      elements: [
        {
          role: "checkbox",
          name: "Remember me",
          value: "unchecked",
          enabled: true,
        },
      ],
    });

    const clicked = parseToolJson(
      await host.callTool("click", { role: "checkbox", name: "Remember me" }),
    );
    const inventory = parseToolJson(await host.callTool("get_inventory"));

    expect(clicked.isError).toBe(false);
    expect(clicked.body).toEqual({ ok: true });
    expect(inventory.body).toEqual({
      title: "Sign in",
      url: "https://example.test/form",
      inputLabels: ["Remember me"],
      elements: [
        {
          role: "checkbox",
          name: "Remember me",
          value: "checked",
          enabled: true,
        },
      ],
    });

    await host.close();
  });

  it("type into a password still reports filled, never the text", async () => {
    const host = await startSession({
      title: "Sign in",
      url: "https://example.test/form",
      inputLabels: ["Password"],
      elements: [
        {
          role: "textbox",
          name: "Password",
          value: "",
          enabled: true,
          password: true,
        },
      ],
    });

    await host.callTool("type", {
      role: "textbox",
      name: "Password",
      value: "s3cret",
    });
    const inventory = parseToolJson(await host.callTool("get_inventory"));

    expect(inventory.body).toEqual({
      title: "Sign in",
      url: "https://example.test/form",
      inputLabels: ["Password"],
      elements: [
        { role: "textbox", name: "Password", value: "filled", enabled: true },
      ],
    });

    await host.close();
  });
});
