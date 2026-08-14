import { describe, expect, it } from "vitest";
import { parseToolJson, startSession } from "./agent-host.js";

describe("typed Action errors", () => {
  it("click and type fail with not_found when the Path matches no element", async () => {
    const host = await startSession({
      title: "Sign in",
      url: "https://example.test/form",
      inputLabels: ["Email"],
      elements: [{ role: "textbox", name: "Email", value: "", enabled: true }],
    });
    const missing = { role: "button", name: "Submit" };

    const clicked = parseToolJson(await host.callTool("click", missing));
    const typed = parseToolJson(
      await host.callTool("type", { ...missing, value: "x" }),
    );

    expect(clicked).toEqual({ isError: true, body: { error: "not_found" } });
    expect(typed).toEqual({ isError: true, body: { error: "not_found" } });

    await host.close();
  });

  it("click and type fail with ambiguous when the Path matches more than one element", async () => {
    const host = await startSession({
      title: "Sign in",
      url: "https://example.test/form",
      inputLabels: ["Email"],
      elements: [
        { role: "textbox", name: "Email", value: "one", enabled: true },
        { role: "textbox", name: "Email", value: "two", enabled: true },
      ],
    });
    const duplicate = { role: "textbox", name: "Email" };

    const clicked = parseToolJson(await host.callTool("click", duplicate));
    const typed = parseToolJson(
      await host.callTool("type", { ...duplicate, value: "x" }),
    );

    expect(clicked).toEqual({ isError: true, body: { error: "ambiguous" } });
    expect(typed).toEqual({ isError: true, body: { error: "ambiguous" } });

    await host.close();
  });

  it("click and type fail with disabled when the Path is not enabled", async () => {
    const host = await startSession({
      title: "Sign in",
      url: "https://example.test/form",
      inputLabels: ["Email"],
      elements: [
        { role: "textbox", name: "Email", value: "", enabled: false },
        { role: "button", name: "Submit", value: "", enabled: false },
      ],
    });

    const clicked = parseToolJson(
      await host.callTool("click", { role: "button", name: "Submit" }),
    );
    const typed = parseToolJson(
      await host.callTool("type", { role: "textbox", name: "Email", value: "x" }),
    );

    expect(clicked).toEqual({ isError: true, body: { error: "disabled" } });
    expect(typed).toEqual({ isError: true, body: { error: "disabled" } });

    await host.close();
  });
});
