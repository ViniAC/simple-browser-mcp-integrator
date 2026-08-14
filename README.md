# Browser MCP Integrator

An MCP server plus a Chrome/Chromium extension so an AI agent can open a page, read a **Page Inventory** (title, URL, input labels, interactive elements and values), and perform **Actions** (Click / Type). The Extension is the only thing that touches the page.

v1 is proven against a local **Fixture Page** in a dedicated **Dev Browser** (Chromium). Attaching the same Extension to a **User Browser** comes after that loop is green.

## Status

The four MCP tools (`open_page`, `get_inventory`, `click`, `type`) run against the Dev Browser.

## Cursor (first Agent Host)

1. From the repo root, run `npm install`.
2. Enable **browser-mcp-integrator** in Cursor MCP settings. This repo already points Cursor at the stdio Server via [`.cursor/mcp.json`](./.cursor/mcp.json).
3. Ask the agent to Open `http://127.0.0.1:7421/` (the Fixture Page; the Server serves it as soon as it starts).
4. Call `get_inventory`.
5. `type` into **Full name** and `click` **Submit**.
6. Call `get_inventory` again and check that **Result** is `Submitted`.

The first Open, inventory, Click, or Type launches a headless Dev Browser and may download Chromium, which can take a few minutes. Stdio is the MCP protocol, so the Server must not print to stdout.

## Any other Agent Host

Start the same stdio Server with `npm run mcp` (from the repo root), or:

```
node --import tsx packages/server/stdio.ts
```

Any Agent Host that speaks stdio can attach the same way. Open `http://127.0.0.1:7421/`.

## v1 loop

1. Agent Host (Cursor first) calls the Server over stdio.
2. Server drives a Dev Browser with the Extension loaded.
3. Agent opens the Fixture Page, reads the Page Inventory, performs Actions, reads again.

No screenshots, JS eval, network sniffing, or multi-tab until that loop works.

## Repo

- Remote: [ViniAC/browser_mcp_integrator](https://github.com/ViniAC/browser_mcp_integrator)
- Skills toolchain: `.agents/skills/`
