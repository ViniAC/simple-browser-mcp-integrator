/// <reference types="chrome" />

import { isActionErrorCode } from "../../shared/action-error.js";

type Config = {
  websocketUrl: string;
  token: string;
};

export function startAttach<T extends { id: number }>(
  handle: (request: T) => Promise<unknown>,
) {
  let attached = false;
  let websocketUrl = "";
  let lastFailure = "";
  let config: Config | undefined;
  let socket: WebSocket | undefined;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let reconnecting = false;
  let backoffMs = 500;
  const maxBackoffMs = 30_000;

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "getAttach") {
      sendResponse({ attached, websocketUrl, lastFailure });
      return;
    }
    if (message?.type === "reconnect") {
      reconnect();
      sendResponse({ ok: true });
    }
  });

  void start();

  async function start() {
    config = (await fetch(chrome.runtime.getURL("config.json")).then(
      (response) => response.json(),
    )) as Config;
    websocketUrl = config.websocketUrl;
    connect();
  }

  function reconnect() {
    if (!config) {
      return;
    }
    clearTimeout(retryTimer);
    backoffMs = 500;
    reconnecting = true;
    setAttached(false);
    if (!socket || socket.readyState === WebSocket.CLOSED) {
      reconnecting = false;
      connect();
      return;
    }
    socket.close();
  }

  function connect() {
    if (!config) {
      return;
    }
    clearTimeout(retryTimer);
    const next = new WebSocket(
      `${config.websocketUrl}?token=${encodeURIComponent(config.token)}`,
    );
    socket = next;
    next.addEventListener("open", () => {
      if (socket !== next) {
        return;
      }
      lastFailure = "";
      backoffMs = 500;
      setAttached(true);
    });
    next.addEventListener("message", async (event) => {
      if (socket !== next) {
        return;
      }
      const request = JSON.parse(String(event.data)) as T;
      try {
        next.send(
          JSON.stringify({ id: request.id, result: await handle(request) }),
        );
      } catch (error) {
        const code =
          error instanceof Error && isActionErrorCode(error.message)
            ? error.message
            : "not_found";
        next.send(JSON.stringify({ id: request.id, error: code }));
      }
    });
    next.addEventListener("error", () => {
      if (socket === next) {
        lastFailure = "Attach failed";
      }
    });
    next.addEventListener("close", () => {
      if (socket !== next) {
        return;
      }
      socket = undefined;
      lastFailure = lastFailure || "Attach failed";
      setAttached(false);
      if (reconnecting) {
        reconnecting = false;
        connect();
        return;
      }
      retryTimer = setTimeout(connect, backoffMs);
      backoffMs = Math.min(backoffMs * 2, maxBackoffMs);
    });
  }

  function setAttached(next: boolean) {
    attached = next;
    const name = next ? "attached" : "not-attached";
    void chrome.action.setIcon({
      path: {
        16: `icons/${name}-16.png`,
        32: `icons/${name}-32.png`,
      },
    });
    void chrome.action.setTitle({
      title: next ? "Attached" : "Not attached",
    });
  }
}
