export function collectInventory() {
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

  function valueOf(element: HTMLElement) {
    if (element instanceof HTMLInputElement) {
      if (element.type === "password") {
        return element.value === "" ? "empty" : "filled";
      }
      if (element.type === "checkbox") {
        return element.checked ? "checked" : "unchecked";
      }
      return element.value;
    }
    if (element instanceof HTMLTextAreaElement) {
      return element.value;
    }
    if (element instanceof HTMLSelectElement) {
      return element.selectedOptions[0]?.text ?? "";
    }
    return "";
  }

  function isEnabled(element: HTMLElement) {
    return !("disabled" in element && Boolean(element.disabled));
  }

  const inputLabels = [...document.querySelectorAll("label")]
    .filter(isVisible)
    .map((label) => normalize(label.textContent ?? ""))
    .filter(Boolean);

  const elements = [
    ...document.querySelectorAll("a[href], button, input, textarea, select"),
  ]
    .filter(
      (element): element is HTMLElement =>
        element instanceof HTMLElement && isVisible(element),
    )
    .map((element) => ({
      role: roleOf(element),
      name: nameOf(element),
      value: valueOf(element),
      enabled: isEnabled(element),
    }));

  return {
    title: document.title,
    url: location.href,
    inputLabels,
    elements,
  };
}
