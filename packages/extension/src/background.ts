/// <reference types="chrome" />

import { isOpenTarget, type OpenTarget } from "../../shared/open-target.js";
import { startAttach } from "./attach.js";
import { collectInventory } from "./collect-inventory.js";
import { boundTabId, tabForOpen, watchCurrentPage } from "./current-page.js";
import { performAction } from "./perform-action.js";

type Request =
  | { id: number; type: "open"; url: string; target?: OpenTarget }
  | { id: number; type: "inventory" }
  | { id: number; type: "click"; role: string; name: string }
  | { id: number; type: "type"; role: string; name: string; value: string };

watchCurrentPage();
void startAttach(handle);

async function handle(request: Request) {
  switch (request.type) {
    case "open":
      return openUrl(request.url, openTargetOf(request.target));
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
  const tabId = await boundTabId();
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
  const tabId = await boundTabId();
  const [injection] = await chrome.scripting.executeScript({
    target: { tabId },
    func: collectInventory,
  });
  return injection?.result;
}

async function openUrl(url: string, target: OpenTarget) {
  const tabId = await tabForOpen(target);
  const pendingOpen = waitUntilOpen(tabId, url, false);
  await chrome.tabs.update(tabId, { url });
  pendingOpen.poll();
  const tab = await pendingOpen.promise;
  if (!tab.url) {
    throw new Error("Open did not produce a URL");
  }
  return { url: tab.url };
}

function openTargetOf(value: unknown): OpenTarget {
  return isOpenTarget(value) ? value : "current";
}

function waitUntilOpen(tabId: number, url: string, pollImmediately = true) {
  let listener: (id: number, info: chrome.tabs.OnUpdatedInfo) => void;
  let settle: (tab: chrome.tabs.Tab) => void = () => {};
  const promise = new Promise<chrome.tabs.Tab>((resolve) => {
    settle = (tab) => {
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
    if (pollImmediately) {
      void chrome.tabs.get(tabId).then(settle);
    }
  });
  return {
    promise,
    poll() {
      void chrome.tabs.get(tabId).then(settle);
    },
    cancel() {
      chrome.tabs.onUpdated.removeListener(listener);
    },
  };
}
