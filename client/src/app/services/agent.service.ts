import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpClient, httpResource } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface ToolEvent {
  server: 'figma' | 'jira' | 'github' | string;
  tool: string;
  input: unknown;
  ok: boolean;
}

export interface TranscriptEntry {
  role: 'user' | 'assistant';
  content: string;
  toolEvents?: ToolEvent[];
}

interface AgentReply {
  text: string;
  toolEvents: ToolEvent[];
  connected: string[];
  missing: string[];
}

interface StatusReply {
  connected: string[];
  missing: string[];
}

@Injectable({ providedIn: 'root' })
export class AgentService {
  private http = inject(HttpClient);

  /** Signal-native GET — refetch with status.reload() after a turn. */
  readonly status = httpResource<StatusReply>(() => '/api/status');

  readonly transcript = signal<TranscriptEntry[]>([]);
  readonly busy = signal(false);
  readonly error = signal<string | null>(null);

  readonly connected = computed(() => this.status.value()?.connected ?? []);

  async send(prompt: string): Promise<void> {
    const text = prompt.trim();
    if (!text || this.busy()) return;

    this.error.set(null);
    this.transcript.update((t) => [...t, { role: 'user', content: text }]);
    this.busy.set(true);

    // API expects plain {role, content} pairs — strip UI-only fields.
    const messages = this.transcript().map(({ role, content }) => ({ role, content }));

    try {
      const reply = await firstValueFrom(
        this.http.post<AgentReply>('/api/agent', { messages }),
      );
      this.transcript.update((t) => [
        ...t,
        { role: 'assistant', content: reply.text, toolEvents: reply.toolEvents },
      ]);
    } catch (err) {
      const message =
        (err as { error?: { error?: string } })?.error?.error ?? 'Agent request failed';
      this.error.set(message);
      // Roll back the optimistic user turn so it can be retried.
      this.transcript.update((t) => t.slice(0, -1));
    } finally {
      this.busy.set(false);
    }
  }
}
