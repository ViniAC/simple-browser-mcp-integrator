import type { AddressInfo } from "node:net";
import { WebSocketServer, type WebSocket } from "ws";
import { ActionError, type ActionErrorCode } from "../../shared/action-error.js";

type Pending = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

type AttachWaiter = {
  resolve: (socket: WebSocket) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

export async function startExtensionSocket(options: {
  secret: string;
  port?: number;
}) {
  const pending = new Map<number, Pending>();
  const attachWaiters = new Set<AttachWaiter>();
  let nextId = 1;
  let extension: WebSocket | undefined;
  let closePromise: Promise<void> | undefined;

  const wss = new WebSocketServer({
    host: "127.0.0.1",
    port: options.port ?? 0,
  });
  wss.on("connection", (socket, request) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (url.searchParams.get("token") !== options.secret) {
      socket.close();
      return;
    }
    if (extension) {
      socket.close();
      return;
    }
    extension = socket;
    socket.on("close", () => {
      if (extension === socket) {
        extension = undefined;
      }
      rejectPending(pending);
    });
    socket.on("message", (data) => {
      const message = JSON.parse(String(data)) as {
        id: number;
        result?: unknown;
        error?: ActionErrorCode;
      };
      const waiter = pending.get(message.id);
      if (!waiter) {
        return;
      }
      pending.delete(message.id);
      if (message.error) {
        waiter.reject(new ActionError(message.error));
        return;
      }
      waiter.resolve(message.result);
    });
    resolveAttachWaiters(attachWaiters, socket);
  });

  await waitUntilListening(wss);
  const address = wss.address() as AddressInfo;

  return {
    port: address.port,
    waitForExtension(ms: number) {
      if (extension && extension.readyState === extension.OPEN) {
        return Promise.resolve(extension);
      }
      return waitForAttach(attachWaiters, ms);
    },
    send<T>(type: string, payload: Record<string, unknown> = {}) {
      const socket = extension;
      if (!socket || socket.readyState !== socket.OPEN) {
        return Promise.reject(new ActionError("not_connected"));
      }
      const id = nextId++;
      return new Promise<T>((resolve, reject) => {
        pending.set(id, {
          resolve: (value) => resolve(value as T),
          reject,
        });
        socket.send(JSON.stringify({ id, type, ...payload }));
      });
    },
    close() {
      closePromise ??= closeSocketServer(wss, extension, attachWaiters, pending);
      return closePromise;
    },
  };
}

function waitUntilListening(wss: WebSocketServer) {
  return new Promise<void>((resolve, reject) => {
    wss.once("listening", resolve);
    wss.once("error", reject);
  });
}

function waitForAttach(waiters: Set<AttachWaiter>, ms: number) {
  return new Promise<WebSocket>((resolve, reject) => {
    const waiter: AttachWaiter = {
      resolve,
      reject,
      timer: setTimeout(() => {
        waiters.delete(waiter);
        reject(new ActionError("not_connected"));
      }, ms),
    };
    waiters.add(waiter);
  });
}

function resolveAttachWaiters(
  waiters: Set<AttachWaiter>,
  socket: WebSocket,
) {
  for (const waiter of waiters) {
    clearTimeout(waiter.timer);
    waiter.resolve(socket);
  }
  waiters.clear();
}

function rejectAttachWaiters(waiters: Set<AttachWaiter>) {
  for (const waiter of waiters) {
    clearTimeout(waiter.timer);
    waiter.reject(new ActionError("not_connected"));
  }
  waiters.clear();
}

function rejectPending(pending: Map<number, Pending>) {
  for (const waiter of pending.values()) {
    waiter.reject(new ActionError("not_connected"));
  }
  pending.clear();
}

function closeSocketServer(
  wss: WebSocketServer,
  extension: WebSocket | undefined,
  attachWaiters: Set<AttachWaiter>,
  pending: Map<number, Pending>,
) {
  rejectAttachWaiters(attachWaiters);
  rejectPending(pending);
  extension?.close();
  return new Promise<void>((resolve) => wss.close(() => resolve()));
}
