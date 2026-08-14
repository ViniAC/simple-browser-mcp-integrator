import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  buildConfiguredExtension,
  type ExtensionConfig,
} from "../../extension/build.js";

export async function prepareExtension(config: ExtensionConfig) {
  const dir = await mkdtemp(path.join(tmpdir(), "browser-mcp-ext-"));
  await buildConfiguredExtension(dir, config);
  return {
    dir,
    close() {
      return rm(dir, { recursive: true, force: true }).catch(() => {});
    },
  };
}
