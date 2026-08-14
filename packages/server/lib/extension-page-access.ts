import { randomBytes } from "node:crypto";
import { ActionError } from "../../shared/action-error.js";
import type { PageInventory } from "../../shared/page-inventory.js";
import { startExtensionSocket } from "./extension-socket.js";
import type { PageAccess } from "./page-access.js";

const defaultAttachTimeoutMs = 20_000;

export type ExtensionPageAccess = PageAccess & { close(): Promise<void> };
export type AttachPageAccess = ExtensionPageAccess & { readonly port: number };

type Session = {
  send<T>(type: string, payload?: Record<string, unknown>): Promise<T>;
};

export async function createAttachPageAccess(options?: {
  attachTimeoutMs?: number;
  secret?: string;
  port?: number;
}): Promise<AttachPageAccess> {
  const attachTimeoutMs = options?.attachTimeoutMs ?? defaultAttachTimeoutMs;
  const secret = options?.secret ?? randomBytes(16).toString("hex");
  const socket = await startExtensionSocket({
    secret,
    port: options?.port,
  });
  return Object.assign(
    pageAccessFromSession(
      () => startAttachSession(socket, attachTimeoutMs),
      socket.close,
    ),
    { port: socket.port },
  );
}

function pageAccessFromSession(
  start: () => Promise<Session>,
  closeResource: () => Promise<void>,
): ExtensionPageAccess {
  let session: Promise<Session> | undefined;

  async function ensure() {
    if (!session) {
      const starting = start();
      session = starting;
      void starting.catch(() => {
        if (session === starting) {
          session = undefined;
        }
      });
    }
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
      await closeResource();
    },
  };
}

async function startAttachSession(
  socket: Awaited<ReturnType<typeof startExtensionSocket>>,
  attachTimeoutMs: number,
): Promise<Session> {
  try {
    await socket.waitForExtension(attachTimeoutMs);
  } catch (error) {
    throw notConnected(error);
  }
  return {
    send: socket.send,
  };
}

function notConnected(error: unknown) {
  return error instanceof ActionError ? error : new ActionError("not_connected");
}
