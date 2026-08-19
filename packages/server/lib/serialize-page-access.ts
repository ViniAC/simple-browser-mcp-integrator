import { ActionError } from "../../shared/action-error.js";
import type { PageAccess } from "./page-access.js";

export function serializePageAccess(
  inner: PageAccess,
  waitMs: number,
): PageAccess {
  let locked = false;
  const waiters: Array<{
    resume: () => void;
    timer: ReturnType<typeof setTimeout>;
  }> = [];

  async function runExclusive<T>(work: () => Promise<T>): Promise<T> {
    await acquire();
    try {
      return await work();
    } finally {
      release();
    }
  }

  function acquire() {
    if (!locked) {
      locked = true;
      return Promise.resolve();
    }
    return new Promise<void>((resolve, reject) => {
      const waiter = {
        resume: () => resolve(),
        timer: setTimeout(() => {
          const index = waiters.indexOf(waiter);
          if (index >= 0) {
            waiters.splice(index, 1);
          }
          reject(new ActionError("busy"));
        }, waitMs),
      };
      waiters.push(waiter);
    });
  }

  function release() {
    const next = waiters.shift();
    if (!next) {
      locked = false;
      return;
    }
    clearTimeout(next.timer);
    next.resume();
  }

  return {
    open: (url, target) => runExclusive(() => inner.open(url, target)),
    getInventory: () => runExclusive(() => inner.getInventory()),
    click: (path) => runExclusive(() => inner.click(path)),
    type: (path, value) => runExclusive(() => inner.type(path, value)),
  };
}
