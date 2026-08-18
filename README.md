# Design-to-Code Agent — Figma × Jira × GitHub via MCP

An agentic pipeline that connects Figma, Jira, and GitHub through their official
remote MCP servers, orchestrated by Claude via the Claude API's MCP connector,
with an Angular 22 console in front.

```
┌─────────────────┐      ┌──────────────────────┐      ┌─────────────────────────────┐
│  Angular 22 UI  │ ───► │  Node agent backend  │ ───► │  Claude API (MCP connector) │
│  (zoneless,     │ HTTP │  Express + Anthropic │      │   ├── Figma MCP  (remote)   │
│   signals)      │      │  TypeScript SDK      │      │   ├── Jira MCP   (remote)   │
└─────────────────┘      └──────────────────────┘      │   └── GitHub MCP (remote)   │
                                                       └─────────────────────────────┘
```

Claude runs the agent loop server-side: it discovers each MCP server's tools,
decides which to call, and chains them — e.g. *read a Figma frame → create a
Jira issue → open a GitHub branch/PR* — returning text plus a trace of every
tool call, which the UI renders as per-service chips.

## Prerequisites

- Node.js 20+
- A Claude API key — https://platform.claude.com
- OAuth/bearer tokens for the three MCP servers (below)

## Setup

### 1. Backend

```bash
cd server
cp .env.example .env   # fill in ANTHROPIC_API_KEY + MCP tokens
npm install
npm run dev            # http://localhost:3000
```

The server starts even with zero MCP tokens — `/api/status` reports which
services are connected, and the UI's pipeline strip reflects it live.

### 2. Frontend

```bash
cd client
npm install
npm start              # http://localhost:4200, proxies /api → :3000
```

## Getting the MCP tokens

| Service | Server URL | How to authenticate |
|---|---|---|
| Figma  | `https://mcp.figma.com/mcp` | OAuth via Figma account |
| Jira   | `https://mcp.atlassian.com/v1/sse` | OAuth via Atlassian account |
| GitHub | `https://api.githubcopilot.com/mcp/` | PAT (`repo` scope) for testing, OAuth for prod |

The MCP connector expects **you** to complete the OAuth flow and pass the
access token as `authorization_token`; it does not run the flow for you. For
local testing, the MCP inspector walks you through each flow and prints a
token you can paste into `.env`:

```bash
npx @modelcontextprotocol/inspector
# Transport: "Streamable HTTP" (or SSE) → enter server URL → Quick OAuth Flow
```

In production, implement the OAuth flow in the backend and refresh tokens
before they expire. **Never put these tokens in the Angular app** — the
browser should only ever talk to your backend.

## How the MCP connector wiring works

`server/src/agent.ts` sends one beta Messages API request per turn:

- header `anthropic-beta: mcp-client-2025-11-20`
- `mcp_servers`: `[{ type: "url", url, name, authorization_token }]` per service
- `tools`: `[{ type: "mcp_toolset", mcp_server_name: "figma" }, ...]`

The response interleaves `text`, `mcp_tool_use`, and `mcp_tool_result` blocks;
the backend flattens tool activity into `toolEvents` for the UI. To restrict
what the agent may do, add an allowlist to a toolset in `mcp-servers.ts`
(e.g. read-only Figma tools, no `create_pull_request` until you're ready).

Reference: https://platform.claude.com/docs/en/agents-and-tools/mcp-connector

## Notes and limits

- **Local Figma Dev Mode MCP**: the connector only accepts remote URL servers.
  If you want the *local* Dev Mode server (`http://127.0.0.1:3845/mcp` from the
  Figma desktop app), run an MCP client in the backend instead — the Anthropic
  TypeScript SDK ships MCP helpers for exactly that hybrid setup.
- **Angular 22**: standalone components, signals, zoneless change detection,
  and `httpResource` for the status endpoint. New control flow (`@if`/`@for`)
  throughout.
- **Safety**: the system prompt tells the agent to confirm before creating
  issues/branches/PRs. Keep that, and prefer tool allowlists over trust.
- **CORS** is wide open for dev; restrict origins before deploying.
