import type { Path } from "../../shared/path.js";
import type { PageInventory } from "../../shared/page-inventory.js";

export type PageAccess = {
  open(url: string): Promise<{ url: string }>;
  getInventory(): Promise<PageInventory>;
  click(path: Path): Promise<void>;
  type(path: Path, value: string): Promise<void>;
};
