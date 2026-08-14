import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { launch, Launcher } from "chrome-launcher";
import { ensureDevBrowser } from "./ensure-dev-browser.js";

export async function launchDevBrowser(extensionDir: string) {
  const chromePath = await ensureDevBrowser();
  const userDataDir = await mkdtemp(path.join(tmpdir(), "browser-mcp-profile-"));
  const launched = await launch({
    chromePath,
    ignoreDefaultFlags: true,
    userDataDir,
    startingUrl: "about:blank",
    chromeFlags: [
      ...Launcher.defaultFlags().filter((flag) => flag !== "--disable-extensions"),
      `--load-extension=${extensionDir}`,
      `--disable-extensions-except=${extensionDir}`,
      "--headless=new",
      "--disable-gpu",
    ],
  });
  return {
    async close() {
      await launched.kill();
      await rm(userDataDir, { recursive: true, force: true }).catch(() => {
        // Windows can keep profile files locked briefly after kill.
      });
    },
  };
}
