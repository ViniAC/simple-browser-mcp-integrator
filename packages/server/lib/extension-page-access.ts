import { randomBytes } from "node:crypto";
import { rm } from "node:fs/promises";
import { ActionError } from "../../shared/action-error.js";
import type { PageInventory } from "../../shared/page-inventory.js";
import { startExtensionSocket } from "./extension-socket.js";
import { launchDevBrowser } from "./launch-dev-browser.js";
import type { PageAccess } from "./page-access.js";
import { prepareExtension } from "./prepare-extension.js";

const defaultAttachTimeoutMs = 20_000;

export type ExtensionPageAccess = PageAccess & { close(): Promise<void> };

type Session = {
  send<T>(type: string, payload?: Record<string, unknown>): Promise<T>;
  close(): Promise<void>;
};

export function createExtensionPageAccess(): ExtensionPageAccess {
  return pageAccessFromSession(startLaunchSession);
}

export function createAttachPageAccess(options?: {
  attachTimeoutMs?: number;
}): ExtensionPageAccess {
  const attachTimeoutMs = options?.attachTimeoutMs ?? defaultAttachTimeoutMs;
  return pageAccessFromSession(() => startAttachSession(attachTimeoutMs));
}

function pageAccessFromSession(
  start: () => Promise<Session>,
): ExtensionPageAccess {
  let session: Promise<Session> | undefined;

  async function ensure() {
    session ??= start();
    return session;
  }

  return {
    async open(url) {
      return (await ensure()).send<{ url: string }>("open", { url });
    },
    async getInventory() {
      return (await ensure()).send<PageInventory>("inventory");
    },
    async click(path) {
      await (await ensure()).send("click", {
        role: path.role,
        name: path.name,
      });
    },
    async type(path, value) {
      await (await ensure()).send("type", {
        role: path.role,
        name: path.name,
        value,
      });
    },
    async close() {
      if (!session) {
        return;
      }
      try {
        await (await session).close();
      } catch {
        // Session start already closed its resources.
      }
    },
  };
}

async function startAttachSession(attachTimeoutMs: number): Promise<Session> {
  const token = randomBytes(16).toString("hex");
  const socket = await startExtensionSocket(token);
  try {
    await socket.waitForExtension(attachTimeoutMs);
  } catch (error) {
    await socket.close();
    throw notConnected(error);
  }
  return {
    send: socket.send,
    close: socket.close,
  };
}

async function startLaunchSession(): Promise<Session> {
  const token = randomBytes(16).toString("hex");
  const socket = await startExtensionSocket(token);
  const extensionDir = await prepareExtension({
    websocketUrl: `ws://127.0.0.1:${socket.port}`,
    token,
  });
  const browser = await launchDevBrowser(extensionDir);
  try {
    await socket.waitForExtension(defaultAttachTimeoutMs);
  } catch (error) {
    await browser.close();
    await socket.close();
    await removeTemp(extensionDir);
    throw notConnected(error);
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

function notConnected(error: unknown) {
  return error instanceof ActionError ? error : new ActionError("not_connected");
}

function removeTemp(dir: string) {
  return rm(dir, { recursive: true, force: true }).catch(() => {});
}
