import { ActionError } from "../../shared/action-error.js";

export function jsonResult(body: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(body) }] };
}

export async function runJson(read: () => Promise<unknown>) {
  try {
    return jsonResult(await read());
  } catch (error) {
    if (error instanceof ActionError) {
      return { isError: true, ...jsonResult({ error: error.code }) };
    }
    throw error;
  }
}

export async function runAction(action: () => Promise<void>) {
  return runJson(async () => {
    await action();
    return { ok: true };
  });
}
