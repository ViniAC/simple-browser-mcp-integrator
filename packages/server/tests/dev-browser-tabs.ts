import { WebSocket } from "ws";

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
  webSocketDebuggerUrl?: string;
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

  async function extensionId() {
    let id = "";
    await waitUntil(async () => {
      const worker = (await json<ChromeTarget[]>("/json/list")).find(
        (target) =>
          target.type === "service_worker" &&
          target.url.startsWith("chrome-extension://"),
      );
      if (!worker) {
        return false;
      }
      id = new URL(worker.url).hostname;
      return id.length > 0;
    }, "Extension service worker");
    return id;
  }

  async function inspectPage(pageId: string) {
    const target = (await json<ChromeTarget[]>("/json/list")).find(
      (candidate) => candidate.id === pageId,
    );
    if (!target?.webSocketDebuggerUrl) {
      throw new Error(`Dev Browser page ${pageId} has no debugger`);
    }
    return connectDebugger(target.webSocketDebuggerUrl);
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

  return {
    ready,
    pages,
    openFocused,
    focus,
    close,
    closeAll,
    extensionId,
    inspectPage,
    sleepExtensionWorker,
  };
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

async function connectDebugger(url: string) {
  const socket = new WebSocket(url);
  await opened(socket);
  let nextId = 0;
  const pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (error: Error) => void }
  >();
  socket.on("message", (data) => {
    const message = JSON.parse(String(data)) as {
      id?: number;
      result?: unknown;
      error?: { message?: string };
    };
    if (message.id === undefined) {
      return;
    }
    const waiter = pending.get(message.id);
    if (!waiter) {
      return;
    }
    pending.delete(message.id);
    if (message.error) {
      waiter.reject(new Error(message.error.message ?? "CDP error"));
      return;
    }
    waiter.resolve(message.result);
  });
  socket.on("close", () => {
    for (const waiter of pending.values()) {
      waiter.reject(new Error("Dev Browser debugger closed"));
    }
    pending.clear();
  });

  async function send(method: string, params?: Record<string, unknown>) {
    const id = ++nextId;
    const result = new Promise<unknown>((resolve, reject) => {
      pending.set(id, { resolve, reject });
    });
    socket.send(JSON.stringify({ id, method, params }));
    return result;
  }

  await send("Runtime.enable");

  return {
    async evaluate<T>(expression: string) {
      const result = (await send("Runtime.evaluate", {
        expression,
        returnByValue: true,
        awaitPromise: true,
      })) as {
        result?: { value?: T };
        exceptionDetails?: { text?: string };
      };
      if (result.exceptionDetails) {
        throw new Error(result.exceptionDetails.text ?? expression);
      }
      return result.result?.value as T;
    },
    close() {
      socket.close();
    },
  };
}

function opened(socket: WebSocket) {
  return new Promise<void>((resolve, reject) => {
    socket.once("open", () => resolve());
    socket.once("error", reject);
  });
}
