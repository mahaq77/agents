/**
 * Registry of the three official remote MCP servers used by the agent.
 *
 * The Claude API's MCP connector (beta: mcp-client-2025-11-20) takes:
 *   - `mcp_servers`: connection details (URL + OAuth bearer token)
 *   - `tools`: one `mcp_toolset` entry per server, which enables its tools
 *     and optionally allowlists/denylists specific ones.
 *
 * Only remote (URL) servers are supported by the connector — local stdio
 * servers (e.g. Figma Dev Mode MCP running in the desktop app) can't be
 * attached here. See README for the local-server alternative.
 */

export interface McpServerDef {
  type: 'url';
  url: string;
  name: string;
  authorization_token?: string;
}

export interface McpToolset {
  type: 'mcp_toolset';
  mcp_server_name: string;
  // Optional: restrict which tools Claude may call, e.g.
  // configuration: { allowed_tools: ['get_file', 'create_issue'] }
}

interface ServerSpec {
  name: string;
  url: string;
  envToken: string; // env var holding the OAuth bearer token
}

const SPECS: ServerSpec[] = [
  { name: 'figma', url: 'https://mcp.figma.com/mcp', envToken: 'FIGMA_MCP_TOKEN' },
  { name: 'jira', url: 'https://mcp.atlassian.com/v1/sse', envToken: 'JIRA_MCP_TOKEN' },
  { name: 'github', url: 'https://api.githubcopilot.com/mcp/', envToken: 'GITHUB_MCP_TOKEN' },
];

/** Servers that actually have a token configured. */
export function activeServers(): { servers: McpServerDef[]; toolsets: McpToolset[]; missing: string[] } {
  const servers: McpServerDef[] = [];
  const toolsets: McpToolset[] = [];
  const missing: string[] = [];

  for (const spec of SPECS) {
    const token = process.env[spec.envToken];
    if (!token) {
      missing.push(spec.name);
      continue;
    }
    servers.push({ type: 'url', url: spec.url, name: spec.name, authorization_token: token });
    toolsets.push({ type: 'mcp_toolset', mcp_server_name: spec.name });
  }
  return { servers, toolsets, missing };
}
