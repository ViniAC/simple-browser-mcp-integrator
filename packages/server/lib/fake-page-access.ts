import { ActionError } from "../../shared/action-error.js";
import type { Path } from "../../shared/path.js";
import type { PageAccess } from "./page-access.js";

export type FakePageSeed = {
  title: string;
  url: string;
  inputLabels: string[];
  elements: Array<{
    role: string;
    name: string;
    value: string;
    enabled: boolean;
    password?: boolean;
  }>;
};

export function createFakePageAccess(seed: FakePageSeed): PageAccess {
  return {
    async open(url) {
      seed.url = url;
      return { url };
    },
    async getInventory() {
      return {
        title: seed.title,
        url: seed.url,
        inputLabels: seed.inputLabels,
        elements: seed.elements.map(
          ({ role, name, value, enabled, password }) => ({
            role,
            name,
            value: password ? (value === "" ? "empty" : "filled") : value,
            enabled,
          }),
        ),
      };
    },
    async click(path) {
      const element = resolveElement(seed, path);
      if (element.role === "checkbox") {
        element.value = element.value === "checked" ? "unchecked" : "checked";
      }
    },
    async type(path, value) {
      resolveElement(seed, path).value = value;
    },
  };
}

function resolveElement(seed: FakePageSeed, path: Path) {
  const matches = seed.elements.filter(
    (candidate) => candidate.role === path.role && candidate.name === path.name,
  );
  if (matches.length === 0) {
    throw new ActionError("not_found");
  }
  if (matches.length > 1) {
    throw new ActionError("ambiguous");
  }
  const [element] = matches;
  if (!element) {
    throw new ActionError("not_found");
  }
  if (!element.enabled) {
    throw new ActionError("disabled");
  }
  return element;
}
