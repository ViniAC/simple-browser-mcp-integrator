import { ActionError } from "../../shared/action-error.js";

export function jsonResult(body: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(body) }] };
}

export async function runAction(action: () => Promise<void>) {
  try {
    await action();
    return jsonResult({ ok: true });
  } catch (error) {
    if (error instanceof ActionError) {
      return { isError: true, ...jsonResult({ error: error.code }) };
    }
    throw error;
  }
}
