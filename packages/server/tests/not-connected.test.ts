import { describe, expect, it } from "vitest";
import { createAttachPageAccess } from "../lib/extension-page-access.js";
import { parseToolJson, startAgentHost } from "./agent-host.js";

const attachTimeoutMs = 250;

describe("not_connected when nothing Attaches", () => {
  it("MCP initialize succeeds when no User Browser is running and no Extension is attached", async () => {
    const pageAccess = createAttachPageAccess({ attachTimeoutMs });
    const started = Date.now();
    const host = await startAgentHost(pageAccess);

    try {
      expect(Date.now() - started).toBeLessThan(attachTimeoutMs);
    } finally {
      await host.close();
      await pageAccess.close();
    }
  });

  it.each([
    ["get_inventory", undefined],
    ["open_page", { url: "http://127.0.0.1:7421/" }],
    ["click", { role: "button", name: "Submit" }],
    ["type", { role: "textbox", name: "Full name", value: "Ada" }],
  ] as const)(
    "%s waits a bounded time then returns not_connected",
    async (name, args) => {
      const pageAccess = createAttachPageAccess({ attachTimeoutMs });
      const host = await startAgentHost(pageAccess);

      try {
        const started = Date.now();
        const parsed = parseToolJson(
          await host.callTool(name, args ? { ...args } : undefined),
        );
        const elapsed = Date.now() - started;

        expect(elapsed).toBeGreaterThanOrEqual(attachTimeoutMs - 50);
        expect(parsed).toEqual({
          isError: true,
          body: { error: "not_connected" },
        });
      } finally {
        await host.close();
        await pageAccess.close();
      }
    },
  );
});
