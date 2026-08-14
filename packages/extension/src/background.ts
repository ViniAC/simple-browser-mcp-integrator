/// <reference types="chrome" />

import { collectInventory } from "./collect-inventory.js";

type Config = {
  websocketUrl: string;
  token: string;
};

type Request =
  | { id: number; type: "open"; url: string }
  | { id: number; type: "inventory" };

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
    throw new Error("open");
  }
  return { url: tab.url };
}

async function currentTabId() {
  const tabs = await chrome.tabs.query({});
  const existing = tabs.find((tab) => tab.id !== undefined);
  if (existing?.id !== undefined) {
    return existing.id;
  }
  const created = await chrome.tabs.create({ url: "about:blank" });
  if (created.id === undefined) {
    throw new Error("tab");
  }
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
