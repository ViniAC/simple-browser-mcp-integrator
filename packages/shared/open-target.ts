export const openTargets = ["current", "new", "focused"] as const;

export type OpenTarget = (typeof openTargets)[number];

export function isOpenTarget(value: unknown): value is OpenTarget {
  return (
    typeof value === "string" &&
    (openTargets as readonly string[]).includes(value)
  );
}
