type Action =
  | { type: "type"; role: string; name: string; value: string }
  | { type: "click"; role: string; name: string };

type ActionResult =
  | { ok: true; open?: { url: string } }
  | { error: "not_found" | "ambiguous" | "disabled" | "no_match" };

export function performAction(action: Action): ActionResult {
  const nativeTextLikeTypes = new Set([
    "text",
    "search",
    "tel",
    "url",
    "email",
    "number",
    "date",
    "time",
    "month",
    "week",
    "password",
  ]);

  function isNativeTextLike(
    element: HTMLElement,
  ): element is HTMLInputElement | HTMLTextAreaElement {
    if (element instanceof HTMLTextAreaElement) {
      return true;
    }
    return (
      element instanceof HTMLInputElement &&
      nativeTextLikeTypes.has(element.type)
    );
  }

  function normalize(text: string) {
    return text.replace(/\s+/g, " ").trim();
  }

  function isVisible(element: Element) {
    const style = window.getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden") {
      return false;
    }
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  }

  function roleOf(element: HTMLElement) {
    const explicit = element.getAttribute("role");
    if (explicit) {
      return explicit;
    }
    const tag = element.tagName.toLowerCase();
    if (tag === "a") {
      return "link";
    }
    if (tag === "button") {
      return "button";
    }
    if (tag === "select") {
      return "combobox";
    }
    if (tag === "textarea") {
      return "textbox";
    }
    if (tag === "input") {
      const type = (element as HTMLInputElement).type;
      if (type === "checkbox") {
        return "checkbox";
      }
      if (type === "submit" || type === "button") {
        return "button";
      }
      return "textbox";
    }
    return tag;
  }

  function nameOf(element: HTMLElement) {
    const aria = element.getAttribute("aria-label");
    if (aria) {
      return normalize(aria);
    }
    if (element.id) {
      const label = document.querySelector(
        `label[for="${CSS.escape(element.id)}"]`,
      );
      if (label) {
        return normalize(label.textContent ?? "");
      }
    }
    const wrapping = element.closest("label");
    if (wrapping) {
      return normalize(wrapping.textContent ?? "");
    }
    return normalize(element.textContent ?? "");
  }

  function notifyChange(target: HTMLElement) {
    target.dispatchEvent(new Event("input", { bubbles: true }));
    target.dispatchEvent(new Event("change", { bubbles: true }));
  }

  const matches = [
    ...document.querySelectorAll("a[href], button, input, textarea, select"),
  ].filter(
    (element): element is HTMLElement =>
      element instanceof HTMLElement &&
      isVisible(element) &&
      roleOf(element) === action.role &&
      nameOf(element) === action.name,
  );

  if (matches.length === 0) {
    return { error: "not_found" };
  }
  if (matches.length > 1) {
    return { error: "ambiguous" };
  }
  const [element] = matches;
  if (!element) {
    return { error: "not_found" };
  }
  if ("disabled" in element && Boolean(element.disabled)) {
    return { error: "disabled" };
  }

  if (action.type === "click") {
    const open =
      element instanceof HTMLAnchorElement && element.href
        ? { url: element.href }
        : undefined;
    element.click();
    return open ? { ok: true, open } : { ok: true };
  }

  if (element instanceof HTMLSelectElement) {
    const option = [...element.options].find(
      (candidate) =>
        candidate.label === action.value || candidate.value === action.value,
    );
    if (!option) {
      return { error: "no_match" };
    }
    element.value = option.value;
    notifyChange(element);
    return { ok: true };
  }

  if (!isNativeTextLike(element)) {
    return { error: "not_found" };
  }

  element.focus();
  element.value = "";
  notifyChange(element);
  element.value = action.value;
  notifyChange(element);
  return { ok: true };
}
