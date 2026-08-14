/// <reference types="chrome" />

import { isActionErrorCode } from "../../shared/action-error.js";
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
  socket.addEventListener("open", () => {
    setAttached(true);
  });
  socket.addEventListener("message", async (event) => {
    const request = JSON.parse(String(event.data)) as Request;
    try {
      socket.send(
        JSON.stringify({ id: request.id, result: await handle(request) }),
      );
    } catch (error) {
      const code =
        error instanceof Error && isActionErrorCode(error.message)
          ? error.message
          : "not_found";
      socket.send(JSON.stringify({ id: request.id, error: code }));
    }
  });
  socket.addEventListener("close", () => {
    setAttached(false);
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
  const urlBefore = (await chrome.tabs.get(tabId)).url;
  try {
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId },
      world: "MAIN",
      func: performAction,
      args: [actionFrom(request)],
    });
    const result = injection?.result;
    if (!result || !("ok" in result)) {
      throw new Error(result && "error" in result ? result.error : "not_found");
    }
    if (result.open?.url) {
      await waitUntilOpen(tabId, result.open.url).promise;
    }
  } catch (error) {
    if (await finishOpenIfUrlChanged(tabId, urlBefore)) {
      return;
    }
    throw error;
  }
}

function actionFrom(request: Extract<Request, { type: "click" | "type" }>) {
  if (request.type === "type") {
    return {
      type: "type" as const,
      role: request.role,
      name: request.name,
      value: request.value,
    };
  }
  return { type: "click" as const, role: request.role, name: request.name };
}

async function finishOpenIfUrlChanged(
  tabId: number,
  urlBefore: string | undefined,
) {
  const tab = await chrome.tabs.get(tabId);
  if (!tab.url || tab.url === urlBefore) {
    return false;
  }
  if (tab.status !== "complete") {
    await waitUntilOpen(tabId, tab.url).promise;
  }
  return true;
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
  const pendingOpen = waitUntilComplete(tabId);
  await chrome.tabs.update(tabId, { url });
  const tab = await pendingOpen.promise;
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

function waitUntilOpen(tabId: number, url: string) {
  let listener: (id: number, info: chrome.tabs.OnUpdatedInfo) => void;
  const promise = new Promise<chrome.tabs.Tab>((resolve) => {
    const settle = (tab: chrome.tabs.Tab) => {
      if (tab.url !== url || tab.status !== "complete") {
        return;
      }
      chrome.tabs.onUpdated.removeListener(listener);
      resolve(tab);
    };
    listener = (id) => {
      if (id === tabId) {
        void chrome.tabs.get(tabId).then(settle);
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
    void chrome.tabs.get(tabId).then(settle);
  });
  return {
    promise,
    cancel() {
      chrome.tabs.onUpdated.removeListener(listener);
    },
  };
}

function waitUntilComplete(tabId: number) {
  let listener: (id: number, info: chrome.tabs.OnUpdatedInfo) => void;
  const promise = new Promise<chrome.tabs.Tab>((resolve) => {
    listener = (id, info) => {
      if (id !== tabId || info.status !== "complete") {
        return;
      }
      chrome.tabs.onUpdated.removeListener(listener);
      void chrome.tabs.get(tabId).then(resolve);
    };
    chrome.tabs.onUpdated.addListener(listener);
  });
  return {
    promise,
    cancel() {
      chrome.tabs.onUpdated.removeListener(listener);
    },
  };
}

function setAttached(attached: boolean) {
  const name = attached ? "attached" : "not-attached";
  void chrome.action.setIcon({
    path: {
      16: `icons/${name}-16.png`,
      32: `icons/${name}-32.png`,
    },
  });
  void chrome.action.setTitle({
    title: attached ? "Attached" : "Not attached",
  });
}
