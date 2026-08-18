import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AgentService } from './services/agent.service';
import { PipelineStatus } from './components/pipeline-status';

@Component({
  selector: 'app-root',
  imports: [FormsModule, PipelineStatus],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="shell">
      <header>
        <h1>Design-to-Code Agent</h1>
        <app-pipeline-status />
      </header>

      <main aria-live="polite">
        @if (agent.transcript().length === 0) {
          <section class="empty">
            <p>Wire a Figma frame to a Jira ticket to a GitHub PR in one instruction.</p>
            <div class="starters">
              @for (s of starters; track s) {
                <button type="button" (click)="draft.set(s)">{{ s }}</button>
              }
            </div>
          </section>
        }

        @for (entry of agent.transcript(); track $index) {
          <article class="turn" [class.user]="entry.role === 'user'">
            <span class="who">{{ entry.role === 'user' ? 'you' : 'agent' }}</span>
            @if (entry.toolEvents?.length) {
              <div class="tools">
                @for (ev of entry.toolEvents; track $index) {
                  <span class="chip" [class.err]="!ev.ok" [style.--c]="'var(--' + ev.server + ')'">
                    {{ ev.server }} · {{ ev.tool }}
                  </span>
                }
              </div>
            }
            <p class="body">{{ entry.content }}</p>
          </article>
        }

        @if (agent.busy()) {
          <p class="working">agent is working — calling tools as needed…</p>
        }
        @if (agent.error(); as err) {
          <p class="error">{{ err }} — adjust your instruction and resend.</p>
        }
      </main>

      <footer>
        <textarea
          rows="2"
          [(ngModel)]="draft"
          [disabled]="agent.busy()"
          (keydown.enter)="onEnter($event)"
          placeholder="e.g. Review Figma file ABC123, file Jira bugs for spacing issues, open a GitHub branch for the fix"
          aria-label="Instruction for the agent"
        ></textarea>
        <button type="button" class="send" [disabled]="agent.busy() || !draft().trim()" (click)="send()">
          Run
        </button>
      </footer>
    </div>
  `,
  styles: `
    .shell { max-width: 860px; margin: 0 auto; min-height: 100dvh; display: flex; flex-direction: column; padding: 24px 20px; gap: 16px; }
    header { display: flex; flex-direction: column; gap: 14px; border-bottom: 1px solid var(--line); padding-bottom: 18px; }
    h1 { font-family: var(--font-display); font-size: 22px; font-weight: 700; letter-spacing: -0.01em; margin: 0; }
    main { flex: 1; display: flex; flex-direction: column; gap: 14px; padding: 8px 0; }
    .empty p { color: var(--muted); margin: 24px 0 14px; }
    .starters { display: flex; flex-direction: column; gap: 8px; align-items: flex-start; }
    .starters button { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 10px 14px; text-align: left; cursor: pointer; color: var(--text); }
    .starters button:hover { border-color: var(--muted); }
    .turn { background: var(--surface); border: 1px solid var(--line); border-radius: 12px; padding: 12px 16px; }
    .turn.user { background: var(--surface-2); margin-left: 15%; }
    .who { font-family: var(--font-mono); font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--muted); }
    .body { margin: 6px 0 0; white-space: pre-wrap; }
    .tools { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
    .chip { font-family: var(--font-mono); font-size: 11.5px; padding: 3px 9px; border-radius: 999px; border: 1px solid color-mix(in srgb, var(--c, var(--muted)) 55%, var(--line)); color: color-mix(in srgb, var(--c, var(--muted)) 75%, var(--text)); }
    .chip.err { border-color: #d05c5c; color: #e29a9a; text-decoration: line-through; }
    .working { color: var(--muted); font-family: var(--font-mono); font-size: 13px; }
    .error { color: #e29a9a; }
    footer { display: flex; gap: 10px; border-top: 1px solid var(--line); padding-top: 16px; }
    textarea { flex: 1; resize: vertical; background: var(--surface); border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; min-height: 52px; }
    .send { font-family: var(--font-display); font-weight: 700; background: var(--text); color: var(--bg); border: 0; border-radius: 10px; padding: 0 22px; cursor: pointer; }
    .send:disabled { opacity: 0.45; cursor: default; }
    @media (max-width: 640px) { .turn.user { margin-left: 0; } }
  `,
})
export class App {
  protected agent = inject(AgentService);
  protected draft = signal('');

  protected starters = [
    'What tools do you have from Figma, Jira, and GitHub?',
    'Summarize open Jira issues in project WEB and link related GitHub PRs',
    'Inspect Figma file <key> and propose Jira tickets for the new checkout flow',
  ];

  protected send(): void {
    const text = this.draft();
    this.draft.set('');
    void this.agent.send(text).then(() => this.agent.status.reload());
  }

  protected onEnter(event: Event): void {
    const e = event as KeyboardEvent;
    if (e.shiftKey) return; // shift+enter = newline
    e.preventDefault();
    this.send();
  }
}
