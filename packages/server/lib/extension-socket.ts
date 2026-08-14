import type { AddressInfo } from "node:net";
import { WebSocketServer, type WebSocket } from "ws";
import { ActionError, type ActionErrorCode } from "../../shared/action-error.js";

type Pending = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

export async function startExtensionSocket(token: string) {
  const pending = new Map<number, Pending>();
  let nextId = 1;
  let extension: WebSocket | undefined;
  let resolveExtension!: (socket: WebSocket) => void;
  const extensionConnected = new Promise<WebSocket>((resolve) => {
    resolveExtension = resolve;
  });

  const wss = new WebSocketServer({ host: "127.0.0.1", port: 0 });
  wss.on("connection", (socket, request) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    if (url.searchParams.get("token") !== token) {
      socket.close();
      return;
    }
    if (extension) {
      socket.close();
      return;
    }
    extension = socket;
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
    resolveExtension(socket);
  });

  await new Promise<void>((resolve) => wss.once("listening", resolve));
  const address = wss.address() as AddressInfo;

  return {
    port: address.port,
    waitForExtension(ms: number) {
      let timer: ReturnType<typeof setTimeout>;
      return Promise.race([
        extensionConnected.finally(() => clearTimeout(timer)),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new ActionError("not_connected")), ms);
        }),
      ]);
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
      extension?.close();
      return new Promise<void>((resolve) => wss.close(() => resolve()));
    },
  };
}
