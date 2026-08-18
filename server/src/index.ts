import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { runAgentTurn, type ChatMessage } from './agent.js';
import { activeServers } from './mcp-servers.js';

const app = express();
app.use(cors({ origin: process.env.CLIENT_ORIGIN ?? 'http://localhost:4200' }));
app.use(express.json({ limit: '1mb' }));

/** Which of the three MCP servers are configured (tokens present). */
app.get('/api/status', (_req, res) => {
  const { servers, missing } = activeServers();
  res.json({ connected: servers.map((s) => s.name), missing });
});

/** One agent turn. Body: { messages: [{ role, content }, ...] } */
app.post('/api/chat', async (req, res) => {
  const messages = req.body?.messages as ChatMessage[] | undefined;
  if (!Array.isArray(messages) || messages.length === 0) {
    res.status(400).json({ error: 'Body must include a non-empty messages array.' });
    return;
  }
  try {
    const reply = await runAgentTurn(messages);
    res.json(reply);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Agent call failed';
    console.error('[agent]', message);
    res.status(502).json({ error: message });
  }
});

const port = Number(process.env.PORT ?? 3000);
app.listen(port, () => {
  const { servers } = activeServers();
  console.log(`Agent backend on http://localhost:${port}`);
  console.log(`MCP servers configured: ${servers.map((s) => s.name).join(', ') || 'none (set tokens in .env)'}`);
});
