import { fileURLToPath } from "node:url";
import {
  Browser,
  computeExecutablePath,
  detectBrowserPlatform,
  install,
  resolveBuildId,
} from "@puppeteer/browsers";

const cacheDir = fileURLToPath(new URL("../../../.browser-cache", import.meta.url));

export async function ensureDevBrowser() {
  const platform = detectBrowserPlatform();
  if (!platform) {
    throw new Error("unsupported platform for Dev Browser");
  }
  const buildId = await resolveBuildId(Browser.CHROMIUM, platform, "latest");
  await install({
    browser: Browser.CHROMIUM,
    buildId,
    cacheDir,
    platform,
  });
  return computeExecutablePath({
    browser: Browser.CHROMIUM,
    buildId,
    cacheDir,
    platform,
  });
}
