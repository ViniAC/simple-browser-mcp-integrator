export type InventoryElement = {
  role: string;
  name: string;
  value: string;
  enabled: boolean;
};

export type PageInventory = {
  title: string;
  url: string;
  inputLabels: string[];
  elements: InventoryElement[];
};
