import Anthropic from '@anthropic-ai/sdk';
import { activeServers } from './mcp-servers.js';

const anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY from env

const MODEL = process.env.CLAUDE_MODEL ?? 'claude-sonnet-4-6';
const MCP_BETA = 'mcp-client-2025-11-20';

const SYSTEM_PROMPT = `You are a design-to-code pipeline agent connecting Figma, Jira, and GitHub.

Typical workflows you handle:
- Read a Figma frame or component (figma tools) and describe what needs building.
- Create or update Jira issues (jira tools) with clear acceptance criteria derived from designs.
- Create branches, commit code, and open pull requests (github tools), linking back to the Jira issue key and Figma node URL.

Rules:
- Always confirm destructive or irreversible actions (deleting issues, force-pushing) before doing them.
- When you create something, report its identifier (issue key, PR number, branch name) back to the user.
- If a required tool/server is not connected, say so plainly and tell the user which env token is missing.`;

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ToolActivity {
  server: string;
  tool: string;
  input: unknown;
}

export interface AgentReply {
  text: string;
  toolActivity: ToolActivity[];
  connectedServers: string[];
}

/**
 * One agent turn. The MCP connector executes tool calls on Anthropic's side
 * (Claude <-> remote MCP servers), so a single Messages API call can contain
 * a full multi-tool workflow. We surface the tool activity so the Angular UI
 * can render the pipeline trace.
 */
export async function runAgentTurn(history: ChatMessage[]): Promise<AgentReply> {
  const { servers, toolsets } = activeServers();

  const response = await anthropic.beta.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: history.map((m) => ({ role: m.role, content: m.content })),
    // MCP connector: remote servers, executed server-side by Anthropic.
    ...(servers.length > 0 && {
      mcp_servers: servers as never,
      tools: toolsets as never,
    }),
    betas: [MCP_BETA],
  });

  const textParts: string[] = [];
  const toolActivity: ToolActivity[] = [];

  for (const block of response.content as unknown as Array<Record<string, unknown>>) {
    if (block['type'] === 'text') {
      textParts.push(block['text'] as string);
    } else if (block['type'] === 'mcp_tool_use') {
      toolActivity.push({
        server: (block['server_name'] as string) ?? 'unknown',
        tool: (block['name'] as string) ?? 'unknown',
        input: block['input'],
      });
    }
  }

  return {
    text: textParts.join('\n'),
    toolActivity,
    connectedServers: servers.map((s) => s.name),
  };
}
