import http from "node:http";
import { describe, expect, it } from "vitest";
import { createFakePageAccess } from "../fake-page-access.js";
import { listenMcpHttp } from "../lib/listen-http.js";

describe("MCP HTTP Host header", () => {
  it("rejects a request whose Host is not the loopback listener", async () => {
    const server = await listenMcpHttp({
      pageAccess: createFakePageAccess({
        title: "x",
        url: "https://example.test/",
        inputLabels: [],
        elements: [],
      }),
      port: 0,
    });

    try {
      const status = await postMcp(server.port, "evil.example:7423");
      expect(status).toBe(403);
    } finally {
      await server.close();
    }
  });
});

function postMcp(port: number, host: string) {
  return new Promise<number>((resolve, reject) => {
    const body = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "test", version: "0.0.0" },
      },
    });
    const req = http.request(
      {
        hostname: "127.0.0.1",
        port,
        path: "/mcp",
        method: "POST",
        headers: {
          host,
          "content-type": "application/json",
          accept: "application/json, text/event-stream",
          "content-length": Buffer.byteLength(body),
        },
      },
      (res) => {
        res.resume();
        res.on("end", () => resolve(res.statusCode ?? 0));
      },
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}
