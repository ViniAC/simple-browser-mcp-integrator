export type ActionErrorCode =
  | "not_found"
  | "ambiguous"
  | "disabled"
  | "not_connected";

export class ActionError extends Error {
  readonly code: ActionErrorCode;

  constructor(code: ActionErrorCode) {
    super(code);
    this.name = "ActionError";
    this.code = code;
  }
}
