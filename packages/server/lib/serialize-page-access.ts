import { ActionError } from "../../shared/action-error.js";
import type { PageAccess } from "./page-access.js";

export const defaultBusyTimeoutMs = 20_000;

type Waiter = {
  grant: () => void;
  fail: () => void;
};

export function serializePageAccess(
  inner: PageAccess,
  options?: { busyTimeoutMs?: number },
): PageAccess {
  const busyTimeoutMs = options?.busyTimeoutMs ?? defaultBusyTimeoutMs;
  let running = false;
  const queue: Waiter[] = [];

  async function runExclusive<T>(work: () => Promise<T>): Promise<T> {
    await acquire();
    try {
      return await work();
    } finally {
      release();
    }
  }

  function acquire() {
    if (!running) {
      running = true;
      return Promise.resolve();
    }
    return new Promise<void>((resolve, reject) => {
      let settled = false;
      const waiter: Waiter = {
        grant() {
          if (settled) {
            return;
          }
          settled = true;
          clearTimeout(timer);
          resolve();
        },
        fail() {
          if (settled) {
            return;
          }
          settled = true;
          reject(new ActionError("busy"));
        },
      };
      const timer = setTimeout(() => {
        const index = queue.indexOf(waiter);
        if (index >= 0) {
          queue.splice(index, 1);
        }
        waiter.fail();
      }, busyTimeoutMs);
      queue.push(waiter);
    });
  }

  function release() {
    const next = queue.shift();
    if (!next) {
      running = false;
      return;
    }
    next.grant();
  }

  return {
    open: (url, target) => runExclusive(() => inner.open(url, target)),
    getInventory: () => runExclusive(() => inner.getInventory()),
    click: (path) => runExclusive(() => inner.click(path)),
    type: (path, value) => runExclusive(() => inner.type(path, value)),
  };
}
