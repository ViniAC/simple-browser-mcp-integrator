/// <reference types="chrome" />

import { collectInventory } from "./collect-inventory.js";
import { performAction } from "./perform-action.js";

type Config = {
  websocketUrl: string;
  token: string;
};

type Request =
  | { id: number; type: "open"; url: string }
  | { id: number; type: "inventory" }
  | { id: number; type: "click"; role: string; name: string }
  | { id: number; type: "type"; role: string; name: string; value: string };

void start();

async function start() {
  const config = (await fetch(chrome.runtime.getURL("config.json")).then(
    (response) => response.json(),
  )) as Config;
  connect(config);
}

function connect(config: Config) {
  const socket = new WebSocket(
    `${config.websocketUrl}?token=${encodeURIComponent(config.token)}`,
  );
  socket.addEventListener("message", async (event) => {
    const request = JSON.parse(String(event.data)) as Request;
    try {
      socket.send(
        JSON.stringify({ id: request.id, result: await handle(request) }),
      );
    } catch {
      socket.send(JSON.stringify({ id: request.id, error: "not_found" }));
    }
  });
  socket.addEventListener("close", () => {
    setTimeout(() => connect(config), 500);
  });
}

async function handle(request: Request) {
  switch (request.type) {
    case "open":
      return openUrl(request.url);
    case "inventory":
      return readInventory();
    case "click":
    case "type":
      return runAction(request);
  }
}

async function runAction(
  request: Extract<Request, { type: "click" | "type" }>,
) {
  const tabId = await currentTabId();
  const [injection] = await chrome.scripting.executeScript({
    target: { tabId },
    func: performAction,
    args: [
      request.type === "type"
        ? {
            type: "type" as const,
            role: request.role,
            name: request.name,
            value: request.value,
          }
        : { type: "click" as const, role: request.role, name: request.name },
    ],
  });
  const result = injection?.result;
  if (!result || !("ok" in result)) {
    throw new Error(result && "error" in result ? result.error : "not_found");
  }
}

async function readInventory() {
  const tabId = await currentTabId();
  const [injection] = await chrome.scripting.executeScript({
    target: { tabId },
    func: collectInventory,
  });
  return injection?.result;
}

async function openUrl(url: string) {
  const tabId = await currentTabId();
  const loaded = waitForComplete(tabId);
  await chrome.tabs.update(tabId, { url });
  await loaded;
  const tab = await chrome.tabs.get(tabId);
  if (!tab.url) {
    throw new Error("Open did not produce a URL");
  }
  return { url: tab.url };
}

let currentPageTabId: number | undefined;

async function currentTabId() {
  if (currentPageTabId !== undefined) {
    try {
      await chrome.tabs.get(currentPageTabId);
      return currentPageTabId;
    } catch {
      currentPageTabId = undefined;
    }
  }
  const tabs = await chrome.tabs.query({});
  const existing = tabs.find((tab) => tab.id !== undefined);
  if (existing?.id !== undefined) {
    currentPageTabId = existing.id;
    return existing.id;
  }
  const created = await chrome.tabs.create({ url: "about:blank" });
  if (created.id === undefined) {
    throw new Error("Dev Browser has no current page");
  }
  currentPageTabId = created.id;
  return created.id;
}

function waitForComplete(tabId: number) {
  return new Promise<void>((resolve) => {
    const listener = (id: number, info: chrome.tabs.OnUpdatedInfo) => {
      if (id === tabId && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
}
