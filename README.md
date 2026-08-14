# Browser MCP Integrator

An MCP server plus a Chrome/Chromium extension so an AI agent can open a page, read a **Page Inventory** (title, URL, input labels, interactive elements and values), and perform **Actions** (Click / Type). The Extension is the only thing that touches the page.

The Agent Host drives the **User Browser**. Automated tests still use a dedicated **Dev Browser**.

## Status

The four MCP tools (`open_page`, `get_inventory`, `click`, `type`) wait for the unpacked Extension to Attach. The stdio Server does not launch a Dev Browser.

## Cursor (first Agent Host)

1. From the repo root, run `npm install`.
2. Enable **browser-mcp-integrator** in Cursor MCP settings. This repo already points Cursor at the stdio Server via [`.cursor/mcp.json`](./.cursor/mcp.json). Starting the Server does not launch a Dev Browser; it waits for Attach.
3. In Chrome, **Load unpacked** `packages/extension/dist` (the Server builds that directory on start if needed). Load unpacked once — Attach survives Server restart.
4. Ask the agent to Open `http://127.0.0.1:7421/` (the Fixture Page; the Server serves it as soon as it starts).
5. Call `get_inventory`.
6. `type` into **Full name** and `click` **Submit**.
7. Call `get_inventory` again and check that **Result** is `Submitted`.

The Extension icon shows **Attached** when the Server is connected and **Not attached** when it is not. Clicking the icon does not bind the current page. Stdio is the MCP protocol, so the Server must not print to stdout.

## Any other Agent Host

Start the same stdio Server with `npm run mcp` (from the repo root), or:

```
node --import tsx packages/server/stdio.ts
```

Load unpacked `packages/extension/dist` in Chrome. Any Agent Host that speaks stdio can attach the same way. Open `http://127.0.0.1:7421/`.

## v1 loop

1. Agent Host (Cursor first) calls the Server over stdio.
2. The unpacked Extension in the User Browser Attaches to the Server.
3. Agent opens the Fixture Page, reads the Page Inventory, performs Actions, reads again.

No screenshots, JS eval, network sniffing, or multi-tab until that loop works.

## Repo

- Remote: [ViniAC/browser_mcp_integrator](https://github.com/ViniAC/browser_mcp_integrator)
- Skills toolchain: `.agents/skills/`
