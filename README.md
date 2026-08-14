# Browser MCP Integrator

An MCP server plus a Chrome/Chromium extension so an AI agent can Open a page, read a **Page Inventory** (title, URL, input labels, interactive elements and values), and perform **Actions** (Click / Type). The Extension is the only thing that touches the page.

The Agent Host drives the **User Browser**. Automated tests still use a dedicated **Dev Browser**.

## Status

The four MCP tools (`open_page`, `get_inventory`, `click`, `type`) wait for the unpacked Extension to Attach, then act on the **current page**. The stdio Server does not launch a Dev Browser. If nothing Attaches, tools return `not_connected`.

## Cursor (first Agent Host)

1. From the repo root, run `npm install`.
2. Enable **browser-mcp-integrator** in Cursor MCP settings. This repo already points Cursor at the stdio Server via [`.cursor/mcp.json`](./.cursor/mcp.json). Starting the Server does not launch a Dev Browser; it waits for Attach.
3. In Chrome, **Load unpacked** `packages/extension/dist` (the Server builds that directory on start if needed). Load unpacked once — Attach survives Server restart.
4. To prove the loop locally, copy [`.env.example`](./.env.example) to `.env` so `BROWSER_MCP_SERVE_FIXTURE=1`. The Server then serves the Fixture Page at `http://127.0.0.1:7421/`. Without that flag, the HTTP server does not start. Ask the agent to Open that URL.
5. Call `get_inventory`.
6. `type` into **Full name** and `click` **Submit**.
7. Call `get_inventory` again and check that **Result** is `Submitted`.

The Extension icon shows **Attached** when the Server is connected and **Not attached** when it is not. Stdio is the MCP protocol, so the Server must not print to stdout.

## Current page and Open

Tools act on one **current page**: a tab bound at the first tool if none is bound, and kept until that tab closes. Looking at another tab does not move it. Closing the bound tab leaves no current page until the next Open or first tool binds again. Clicking the Extension icon does not bind the current page.

`open_page` always loads the URL. Optional `target`:

- `current` (default) — load in the current page. With none bound, bind the focused tab, or create a tab if the User Browser has none.
- `new` — create a tab, load, rebind the current page; the previous tab stays open.
- `focused` — load in the focused tab and rebind. With no focused tab, returns `not_connected` and does not create a tab.

## Any other Agent Host

Start the same stdio Server with `npm run mcp` (from the repo root), or:

```
node --import tsx packages/server/stdio.ts
```

Load unpacked `packages/extension/dist` in Chrome. Any Agent Host that speaks stdio can attach the same way. With `BROWSER_MCP_SERVE_FIXTURE=1` in `.env`, Open `http://127.0.0.1:7421/`.

## Fixture Page loop

1. Agent Host (Cursor first) calls the Server over stdio.
2. The unpacked Extension in the User Browser Attaches to the Server.
3. Agent Opens the Fixture Page, reads the Page Inventory, performs Actions, reads again.

## Repo

- Remote: [ViniAC/browser_mcp_integrator](https://github.com/ViniAC/browser_mcp_integrator)
- License: [MIT](./LICENSE)
- Skills toolchain: `.agents/skills/`
