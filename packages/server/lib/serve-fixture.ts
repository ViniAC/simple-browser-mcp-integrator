import http from "node:http";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const fixtureDir = fileURLToPath(new URL("../../fixture/", import.meta.url));

export const fixturePort = 7421;

export function serveFixture(port = 0) {
  return new Promise<{ url: string; close: () => void }>((resolve, reject) => {
    const listener = http.createServer((req, res) => {
      const file = req.url === "/done.html" ? "done.html" : "index.html";
      const body = readFileSync(path.join(fixtureDir, file));
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(body);
    });
    listener.once("error", reject);
    listener.listen(port, "127.0.0.1", () => {
      listener.removeListener("error", reject);
      const address = listener.address();
      if (!address || typeof address === "string") {
        reject(new Error("expected TCP address"));
        return;
      }
      resolve({
        url: `http://127.0.0.1:${address.port}/`,
        close: () => {
          listener.close();
        },
      });
    });
  });
}
