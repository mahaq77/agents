import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AgentService } from '../services/agent.service';

/** Figma → Jira → GitHub connection strip. Lit nodes have a token configured. */
@Component({
  selector: 'app-pipeline-status',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="strip" role="status" aria-label="MCP connection status">
      @for (node of nodes(); track node.id; let last = $last) {
        <span class="node" [class.on]="node.on" [style.--c]="'var(--' + node.id + ')'">
          <span class="dot" aria-hidden="true"></span>
          {{ node.label }}
          <span class="state">{{ node.on ? 'connected' : 'no token' }}</span>
        </span>
        @if (!last) {
          <span class="wire" aria-hidden="true"></span>
        }
      }
    </div>
  `,
  styles: `
    .strip { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
    .node {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 6px 12px; border: 1px solid var(--line); border-radius: 999px;
      background: var(--surface); color: var(--muted);
      font-family: var(--font-mono); font-size: 12.5px;
    }
    .node.on { color: var(--text); border-color: color-mix(in srgb, var(--c) 55%, var(--line)); }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--line); }
    .node.on .dot { background: var(--c); box-shadow: 0 0 8px var(--c); }
    .state { color: var(--muted); }
    .node.on .state { color: color-mix(in srgb, var(--c) 70%, var(--text)); }
    .wire { width: 26px; height: 1px; background: var(--line); }
  `,
})
export class PipelineStatus {
  private agent = inject(AgentService);

  readonly nodes = computed(() => {
    const connected = new Set(this.agent.connected());
    return [
      { id: 'figma', label: 'Figma' },
      { id: 'jira', label: 'Jira' },
      { id: 'github', label: 'GitHub' },
    ].map((n) => ({ ...n, on: connected.has(n.id) }));
  });
}
