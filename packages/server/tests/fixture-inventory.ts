export function fixtureInventory(
  url: string,
  values: {
    fullName?: string;
    notes?: string;
    password?: string;
    result?: string;
    subscribe?: string;
    country?: string;
  } = {},
) {
  return {
    title: "Fixture Page",
    url,
    inputLabels: [
      "Full name",
      "Password",
      "Notes",
      "Country",
      "Subscribe",
      "Result",
    ],
    elements: [
      {
        role: "textbox",
        name: "Full name",
        value: values.fullName ?? "",
        enabled: true,
      },
      {
        role: "textbox",
        name: "Password",
        value: values.password ?? "empty",
        enabled: true,
      },
      {
        role: "textbox",
        name: "Notes",
        value: values.notes ?? "",
        enabled: true,
      },
      {
        role: "combobox",
        name: "Country",
        value: values.country ?? "Choose",
        enabled: true,
      },
      {
        role: "checkbox",
        name: "Subscribe",
        value: values.subscribe ?? "unchecked",
        enabled: true,
      },
      { role: "button", name: "Submit", value: "", enabled: true },
      {
        role: "textbox",
        name: "Result",
        value: values.result ?? "Ready",
        enabled: true,
      },
      { role: "link", name: "Continue", value: "", enabled: true },
      { role: "button", name: "Duplicate", value: "", enabled: true },
      { role: "button", name: "Duplicate", value: "", enabled: true },
      { role: "button", name: "Locked", value: "", enabled: false },
    ],
  };
}
