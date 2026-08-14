/// <reference types="chrome" />

const tabIdKey = "currentPageTabId";
const lostKey = "lostCurrentPage";

let currentPageTabId: number | undefined;

export function watchCurrentPage() {
  chrome.tabs.onRemoved.addListener((tabId) => {
    void forgetIf(tabId);
  });
}

export async function boundTabId() {
  const existing = await liveBoundTab();
  if (existing !== undefined) {
    return existing;
  }
  if (await consumeLost()) {
    throw new Error("not_connected");
  }
  const focused = await bindFocusedTab();
  if (focused === undefined) {
    throw new Error("not_connected");
  }
  return focused;
}

export async function tabForOpen() {
  const existing = await liveBoundTab();
  if (existing !== undefined) {
    return existing;
  }
  await consumeLost();
  const focused = await bindFocusedTab();
  if (focused !== undefined) {
    return focused;
  }
  const created = await chrome.tabs.create({ url: "about:blank" });
  if (created.id === undefined) {
    throw new Error("not_connected");
  }
  await remember(created.id);
  return created.id;
}

async function bindFocusedTab() {
  const [focused] = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true,
  });
  if (focused?.id === undefined) {
    return undefined;
  }
  await remember(focused.id);
  return focused.id;
}

async function liveBoundTab() {
  const id = currentPageTabId ?? (await storedTabId());
  if (id === undefined) {
    return undefined;
  }
  try {
    await chrome.tabs.get(id);
    currentPageTabId = id;
    return id;
  } catch {
    await forget();
    await markLost();
    return undefined;
  }
}

async function storedTabId() {
  const stored = await chrome.storage.session.get(tabIdKey);
  const id = stored[tabIdKey];
  return typeof id === "number" ? id : undefined;
}

async function remember(tabId: number) {
  currentPageTabId = tabId;
  await chrome.storage.session.set({ [tabIdKey]: tabId });
  await chrome.storage.session.remove(lostKey);
}

async function forget() {
  currentPageTabId = undefined;
  await chrome.storage.session.remove(tabIdKey);
}

async function forgetIf(tabId: number) {
  if ((currentPageTabId ?? (await storedTabId())) === tabId) {
    await forget();
    await markLost();
  }
}

async function markLost() {
  await chrome.storage.session.set({ [lostKey]: true });
}

async function consumeLost() {
  const stored = await chrome.storage.session.get(lostKey);
  if (stored[lostKey] !== true) {
    return false;
  }
  await chrome.storage.session.remove(lostKey);
  return true;
}
