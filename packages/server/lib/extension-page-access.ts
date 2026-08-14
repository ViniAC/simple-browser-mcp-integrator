import { randomBytes } from "node:crypto";
import { rm } from "node:fs/promises";
import { ActionError } from "../../shared/action-error.js";
import type { Path } from "../../shared/path.js";
import type { PageInventory } from "../../shared/page-inventory.js";
import { startExtensionSocket } from "./extension-socket.js";
import { launchDevBrowser } from "./launch-dev-browser.js";
import type { PageAccess } from "./page-access.js";
import { prepareExtension } from "./prepare-extension.js";

export type ExtensionPageAccess = PageAccess & { close(): Promise<void> };

type Session = {
  send<T>(type: string, payload?: Record<string, unknown>): Promise<T>;
  close(): Promise<void>;
};

export function createExtensionPageAccess(): ExtensionPageAccess {
  let session: Promise<Session> | undefined;

  async function ensure() {
    session ??= startSession();
    return session;
  }

  return {
    async open(url) {
      return (await ensure()).send<{ url: string }>("open", { url });
    },
    async getInventory() {
      return (await ensure()).send<PageInventory>("inventory");
    },
    async click(_path: Path) {
      await ensure();
      throw new ActionError("not_found");
    },
    async type(_path: Path, _value: string) {
      await ensure();
      throw new ActionError("not_found");
    },
    async close() {
      if (session) {
        await (await session).close();
      }
    },
  };
}

async function startSession(): Promise<Session> {
  const token = randomBytes(16).toString("hex");
  const socket = await startExtensionSocket(token);
  const extensionDir = await prepareExtension({
    websocketUrl: `ws://127.0.0.1:${socket.port}`,
    token,
  });
  const browser = await launchDevBrowser(extensionDir);
  try {
    await socket.waitForExtension(20_000);
  } catch (error) {
    await browser.close();
    await socket.close();
    await removeTemp(extensionDir);
    throw error instanceof ActionError
      ? error
      : new ActionError("not_connected");
  }
  return {
    send: socket.send,
    async close() {
      await browser.close();
      await socket.close();
      await removeTemp(extensionDir);
    },
  };
}

function removeTemp(dir: string) {
  return rm(dir, { recursive: true, force: true }).catch(() => {});
}
