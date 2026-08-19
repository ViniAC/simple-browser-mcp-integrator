import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { parseToolJson } from "./agent-host.js";
import { startDevBrowserSession } from "./dev-browser-session.js";
import type { createDevBrowserTabs } from "./dev-browser-tabs.js";

type Tabs = ReturnType<typeof createDevBrowserTabs>;

describe("Attach popup", () => {
  describe("while the Server is up", () => {
    let session: Awaited<ReturnType<typeof startDevBrowserSession>>;

    beforeAll(async () => {
      session = await startDevBrowserSession();
    }, 180_000);

    afterAll(async () => {
      await session.close();
    });

    it("shows Attached and the Server WebSocket URL without the token", async () => {
      const popup = await openAttachPopup(session.tabs);
      try {
        const text = await waitForPopupText(
          popup,
          (value) => value.includes("Attached") && !value.includes("Not attached"),
        );
        expect(text).toContain("Attached");
        expect(text).toMatch(/ws:\/\/127\.0\.0\.1:\d+/);
        expect(text).not.toMatch(/\?token=/);
      } finally {
        popup.close();
      }
    }, 180_000);

    it("Reconnect is enabled while Attached and Attaches again without a new token", async () => {
      const popup = await openAttachPopup(session.tabs);
      try {
        await waitForPopupText(
          popup,
          (value) =>
            value.includes("Attached") && !value.includes("Not attached"),
        );
        const enabled = await popup.evaluate<boolean>(`(() => {
          const button = [...document.querySelectorAll("button")].find(
            (candidate) => candidate.textContent === "Reconnect",
          );
          return Boolean(button) && !button.disabled;
        })()`);
        expect(enabled).toBe(true);
        await clickReconnect(popup);
        await waitForPopupText(popup, (value) => value.includes("Not attached"));
        await waitForPopupText(
          popup,
          (value) =>
            value.includes("Attached") && !value.includes("Not attached"),
        );
      } finally {
        popup.close();
      }

      const opened = parseToolJson(
        await session.host.callTool("open_page", { url: session.fixtureUrl }),
      );
      expect(opened.isError).toBe(false);
      expect(opened.body).toEqual({ url: session.fixtureUrl });
    }, 180_000);
  });

  it("shows Not attached and the last Attach failure when the Server is down", async () => {
    const session = await startDevBrowserSession();
    try {
      await session.host.close();
      const popup = await openAttachPopup(session.tabs);
      try {
        const text = await waitForPopupText(
          popup,
          (value) =>
            value.includes("Not attached") && value.includes("Attach failed"),
        );
        expect(text).toContain("Not attached");
        expect(text).toContain("Attach failed");
      } finally {
        popup.close();
      }
    } finally {
      await session.close();
    }
  }, 180_000);

  it("Reconnect retries while the Server is down and still shows the last Attach failure", async () => {
    const session = await startDevBrowserSession();
    try {
      await session.host.close();
      const popup = await openAttachPopup(session.tabs);
      try {
        await waitForPopupText(
          popup,
          (value) =>
            value.includes("Not attached") && value.includes("Attach failed"),
        );
        await clickReconnect(popup);
        const text = await waitForPopupText(
          popup,
          (value) =>
            value.includes("Not attached") && value.includes("Attach failed"),
        );
        expect(text).toContain("Not attached");
        expect(text).toContain("Attach failed");
      } finally {
        popup.close();
      }
    } finally {
      await session.close();
    }
  }, 180_000);
});

async function openAttachPopup(tabs: Tabs) {
  const id = await tabs.extensionId();
  const pageId = await tabs.openFocused(`chrome-extension://${id}/popup.html`);
  return tabs.inspectPage(pageId);
}

async function clickReconnect(
  popup: Awaited<ReturnType<Tabs["inspectPage"]>>,
) {
  await popup.evaluate(`[...document.querySelectorAll("button")]
    .find((candidate) => candidate.textContent === "Reconnect")
    ?.click()`);
}

async function waitForPopupText(
  popup: Awaited<ReturnType<Tabs["inspectPage"]>>,
  match: (text: string) => boolean,
) {
  const deadline = Date.now() + 30_000;
  let text = "";
  while (Date.now() < deadline) {
    text = (await popup.evaluate<string>("document.body.innerText")) ?? "";
    if (match(text)) {
      return text;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`timed out waiting for Attach popup text; last saw: ${text}`);
}
