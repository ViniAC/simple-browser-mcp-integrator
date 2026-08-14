import type { OpenTarget } from "../../shared/open-target.js";
import type { PageInventory } from "../../shared/page-inventory.js";
import type { Path } from "../../shared/path.js";

export type PageAccess = {
  open(url: string, target: OpenTarget): Promise<{ url: string }>;
  getInventory(): Promise<PageInventory>;
  click(path: Path): Promise<void>;
  type(path: Path, value: string): Promise<void>;
};
