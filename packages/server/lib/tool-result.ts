import { ActionError } from "../../shared/action-error.js";

export function jsonResult(body: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(body) }] };
}

export async function runJson(work: () => Promise<unknown>) {
  try {
    return jsonResult(await work());
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
