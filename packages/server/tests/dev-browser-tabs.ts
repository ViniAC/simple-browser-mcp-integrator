export type DevBrowserPage = {
  id: string;
  url: string;
  title: string;
};

type ChromeTarget = {
  id: string;
  type: string;
  url: string;
  title: string;
};

export function createDevBrowserTabs(port: number) {
  const origin = `http://127.0.0.1:${port}`;

  async function ready() {
    await waitUntil(async () => {
      try {
        const response = await fetch(`${origin}/json/version`);
        return response.ok;
      } catch {
        return false;
      }
    }, "Dev Browser debugger");
  }

  async function pages(): Promise<DevBrowserPage[]> {
    const targets = await json<ChromeTarget[]>("/json/list");
    return targets
      .filter((target) => target.type === "page")
      .map((target) => ({
        id: target.id,
        url: target.url,
        title: target.title,
      }));
  }

  async function openFocused(url: string) {
    const created = await json<ChromeTarget>(`/json/new?${url}`, "PUT");
    await json(`/json/activate/${created.id}`);
    await waitUntil(async () => {
      const page = (await pages()).find((candidate) => candidate.id === created.id);
      return page !== undefined && page.url.startsWith(url);
    }, `tab to load ${url}`);
    return created.id;
  }

  async function close(id: string) {
    await json(`/json/close/${id}`);
  }

  async function focus(id: string) {
    await json(`/json/activate/${id}`);
  }

  async function closeAll() {
    const deadline = Date.now() + 5_000;
    while (Date.now() < deadline) {
      const remaining = await pages().catch(() => []);
      if (remaining.length === 0) {
        return;
      }
      for (const page of remaining) {
        await close(page.id).catch(() => {});
      }
      await delay(50);
    }
    throw new Error("timed out closing Dev Browser tabs");
  }

  async function sleepExtensionWorker() {
    const before = (await json<ChromeTarget[]>("/json/list"))
      .filter((target) => target.type === "service_worker")
      .map((target) => target.id);
    const spare =
      (await pages()).find((page) => page.url.startsWith("about:blank")) ??
      { id: await openFocused("about:blank") };
    for (const id of before) {
      await json(`/json/close/${id}`);
    }
    const restarted = async () => {
      const workers = (await json<ChromeTarget[]>("/json/list")).filter(
        (target) => target.type === "service_worker",
      );
      return workers.some((worker) => !before.includes(worker.id));
    };
    if (!(await settled(restarted, 1_000))) {
      await close(spare.id).catch(() => {});
    }
    await waitUntil(restarted, "Extension service worker to restart");
  }

  async function json<T>(path: string, method = "GET"): Promise<T> {
    const response = await fetch(`${origin}${path}`, { method });
    if (!response.ok) {
      throw new Error(`${method} ${path} failed: ${response.status}`);
    }
    const text = await response.text();
    if (text === "" || (!text.startsWith("{") && !text.startsWith("["))) {
      return undefined as T;
    }
    return JSON.parse(text) as T;
  }

  return { ready, pages, openFocused, focus, close, closeAll, sleepExtensionWorker };
}

async function waitUntil(check: () => Promise<boolean>, label: string) {
  if (await settled(check, 30_000)) {
    return;
  }
  throw new Error(`timed out waiting for ${label}`);
}

async function settled(check: () => Promise<boolean>, ms: number) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (await check()) {
      return true;
    }
    await delay(100);
  }
  return false;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
