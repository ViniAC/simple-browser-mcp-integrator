# Browser MCP Integrator

An MCP server plus a Chrome/Chromium extension so an AI agent can Open a page, read a **Page Inventory** (title, URL, input labels, interactive elements and values), and perform **Actions** (Click / Type). The Extension is the only thing that touches the page.

The Agent Host drives the **User Browser**. Automated tests still use a dedicated **Dev Browser**.

## Status

The four MCP tools (`open_page`, `get_inventory`, `click`, `type`) wait for the unpacked Extension to Attach, then act on the **current page**. `npm run mcp` serves Streamable HTTP on `127.0.0.1:7423/mcp` and does not launch a Dev Browser. If nothing Attaches, tools return `not_connected`.

## Cursor (first Agent Host)

1. From the repo root, run `npm install`.
2. In a terminal, start the Server with `npm run mcp`. It listens on `http://127.0.0.1:7423/mcp` and waits for Attach.
3. In Chrome, **Load unpacked** `packages/extension/dist` (the Server builds that directory on start if needed). Load unpacked once — Attach survives Server restart.
4. Enable **browser-mcp-integrator** in Cursor MCP settings. This repo already points Cursor at that URL via [`.cursor/mcp.json`](./.cursor/mcp.json) (`url` only — the Agent Host does not spawn the Server).
5. To prove the loop locally, copy [`.env.example`](./.env.example) to `.env` so `BROWSER_MCP_SERVE_FIXTURE=1`. The Server then serves the Fixture Page at `http://127.0.0.1:7421/`. Without that flag, the Fixture HTTP server does not start. Ask the agent to Open that URL.
6. Call `get_inventory`.
7. `type` into **Full name** and `click` **Submit**.
8. Call `get_inventory` again and check that **Result** is `Submitted`.

The Extension icon shows **Attached** when the Server is connected and **Not attached** when it is not. Clicking the icon opens the Attach popup (Reconnect is always available). Clicking the icon does not bind the current page.

## Current page and Open

Tools act on one **current page**: a tab bound at the first tool if none is bound, and kept until that tab closes. Looking at another tab does not move it. Closing the bound tab leaves no current page until the next Open or first tool binds again. Clicking the Extension icon does not bind the current page.

`open_page` always loads the URL. Optional `target`:

- `current` (default) — load in the current page. With none bound, bind the focused tab, or create a tab if the User Browser has none.
- `new` — create a tab, load, rebind the current page; the previous tab stays open.
- `focused` — load in the focused tab and rebind. With no focused tab, returns `not_connected` and does not create a tab.

## Any other Agent Host

Start the Server in a terminal with `npm run mcp` (from the repo root). Load unpacked `packages/extension/dist` in Chrome. Point the Agent Host at `http://127.0.0.1:7423/mcp` (VS Code: [`.vscode/mcp.json`](./.vscode/mcp.json) uses `type: "http"` and the same URL). With `BROWSER_MCP_SERVE_FIXTURE=1` in `.env`, Open `http://127.0.0.1:7421/`.

Stdio remains a separate command for tests and hosts that only spawn:

```
npm run mcp:stdio
```

or:

```
node --import tsx packages/server/stdio.ts
```

Stdio is the MCP protocol, so that command must not print to stdout.

## Fixture Page loop

1. Start the Server in a terminal. Agent Hosts connect over Streamable HTTP via mcp.json.
2. The unpacked Extension in the User Browser Attaches to the Server.
3. Agent Opens the Fixture Page, reads the Page Inventory, performs Actions, reads again.

## Repo

- Remote: [ViniAC/browser_mcp_integrator](https://github.com/ViniAC/browser_mcp_integrator)
- License: [MIT](./LICENSE)
- Skills toolchain: `.agents/skills/`
