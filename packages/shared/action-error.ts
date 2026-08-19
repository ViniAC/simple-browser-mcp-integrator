export const actionErrorCodes = [
  "not_found",
  "ambiguous",
  "disabled",
  "not_connected",
  "no_match",
  "busy",
] as const;

export type ActionErrorCode = (typeof actionErrorCodes)[number];

export function isActionErrorCode(value: unknown): value is ActionErrorCode {
  return (
    typeof value === "string" &&
    (actionErrorCodes as readonly string[]).includes(value)
  );
}

export class ActionError extends Error {
  readonly code: ActionErrorCode;

  constructor(code: ActionErrorCode) {
    super(code);
    this.name = "ActionError";
    this.code = code;
  }
}
