import http from "node:http";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createExtensionPageAccess } from "../lib/extension-page-access.js";
import { startAgentHost } from "./agent-host.js";

const fixtureDir = fileURLToPath(new URL("../../fixture/", import.meta.url));

export async function startDevBrowserSession() {
  const { url, close: closeHttp } = await serveFixture();
  const pageAccess = await createExtensionPageAccess();
  const host = await startAgentHost(pageAccess);
  return {
    host,
    fixtureUrl: url,
    async close() {
      await host.close();
      await pageAccess.close();
      closeHttp();
    },
  };
}

function serveFixture() {
  return new Promise<{ url: string; close: () => void }>((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const file = req.url === "/done.html" ? "done.html" : "index.html";
      const body = readFileSync(path.join(fixtureDir, file));
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(body);
    });
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("expected TCP address"));
        return;
      }
      resolve({
        url: `http://127.0.0.1:${address.port}/`,
        close: () => {
          server.close();
        },
      });
    });
  });
}
