import { WebSocket } from "ws";
import { describe, expect, it } from "vitest";
import { parseToolJson } from "./agent-host.js";
import { startDevBrowserSession } from "./dev-browser-session.js";

describe("Extension Attach secret", () => {
  it("connections without the shared secret cannot become the attached Extension", async () => {
    const session = await startDevBrowserSession({
      async beforeExtensionLaunch(websocketUrl) {
        const sockets = await Promise.all([
          startUnauthorizedClient(websocketUrl),
          startUnauthorizedClient(`${websocketUrl}?token=wrong`),
        ]);
        return {
          close() {
            for (const socket of sockets) {
              socket.close();
            }
          },
        };
      },
    });

    try {
      const opened = parseToolJson(
        await session.host.callTool("open_page", { url: session.fixtureUrl }),
      );

      expect(opened.isError).toBe(false);
      expect(opened.body).toEqual({ url: session.fixtureUrl });
    } finally {
      await session.close();
    }
  }, 30_000);
});

function startUnauthorizedClient(url: string) {
  const socket = new WebSocket(url);
  socket.on("message", (data) => {
    const request = JSON.parse(String(data)) as { id: number };
    socket.send(
      JSON.stringify({ id: request.id, result: { url: "unauthorized" } }),
    );
  });
  return new Promise<WebSocket>((resolve, reject) => {
    socket.once("open", () => resolve(socket));
    socket.once("error", reject);
  });
}
