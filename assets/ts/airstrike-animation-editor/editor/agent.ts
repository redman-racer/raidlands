import { canonicalJson } from "../canonical-json";
import { sha256Hex } from "../sha256";
import type { EditorSourceProfile } from "../types";

export type AgentMode = "plan" | "regular";
export type AgentWorkspaceScope = "full" | "profile" | "flight-path" | "ordnance" | "view-validation";

interface AgentThread {
  id: number;
  profileKey: string;
  title: string;
  mode: AgentMode;
  pinnedPlan?: string;
}

interface AgentItem {
  id: number;
  type: string;
  role: string;
  content: string;
  inActiveContext?: boolean;
}

export interface AgentProposal {
  id: number;
  baseSourceHash: string;
  candidateSourceHash: string;
  candidateSource: EditorSourceProfile;
  diff: Array<{ area?: string; id?: string; action?: string }>;
  validation: { ok?: boolean; errors?: unknown[] };
  compileSummary?: Record<string, unknown>;
  status: string;
}

export interface AgentEditorContext {
  source: EditorSourceProfile;
  draftVersion: number;
  dirty: boolean;
  scrubTime: number;
  selectedWaypointId: string;
  selectedReleaseId: string;
  selectedRepeatedGroupId: string;
  viewport: Record<string, boolean | string | number>;
  activeWorkspace: AgentWorkspaceScope;
  allowedMutationAreas: string[];
}

interface AgentControllerOptions {
  apiBase: string;
  csrf: string;
  enabled: boolean;
  configured: boolean;
  storageReady: boolean;
  getContext: () => AgentEditorContext | null;
  applySource: (source: EditorSourceProfile, proposalId: number | null) => void;
  previewSource: (source: EditorSourceProfile | null) => void;
  workspaceScope: () => AgentWorkspaceScope;
  navigateDiff: (area: string, id: string) => void;
  openFullAgent: () => void | Promise<void>;
}

interface AgentElements {
  inspectorPanel: HTMLElement;
  agentPanel: HTMLElement;
  thread: HTMLSelectElement;
  newThread: HTMLButtonElement;
  deleteThread: HTMLButtonElement;
  unavailable: HTMLElement;
  messages: HTMLElement;
  proposal: HTMLElement;
  proposalStatus: HTMLElement;
  proposalSummary: HTMLElement;
  apply: HTMLButtonElement;
  discard: HTMLButtonElement;
  undo: HTMLButtonElement;
  rerun: HTMLButtonElement;
  form: HTMLFormElement;
  input: HTMLTextAreaElement;
  send: HTMLButtonElement;
  usePlan: HTMLButtonElement;
  runStatus: HTMLElement;
}

interface ParsedSseEvent {
  event: string;
  data: unknown;
}

export function parseSseBlocks(buffer: string): { events: ParsedSseEvent[]; remainder: string } {
  const normalized = buffer.replace(/\r\n/g, "\n");
  const pieces = normalized.split("\n\n");
  const remainder = pieces.pop() ?? "";
  const events: ParsedSseEvent[] = [];
  for (const block of pieces) {
    let event = "message";
    const data: string[] = [];
    for (const line of block.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      if (line.startsWith("data:")) data.push(line.slice(5).trimStart());
    }
    if (data.length === 0) continue;
    const text = data.join("\n");
    try {
      events.push({ event, data: JSON.parse(text) });
    } catch {
      events.push({ event, data: { message: text } });
    }
  }
  return { events, remainder };
}

function query<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Missing airstrike agent element ${selector}.`);
  return element;
}

function cloneProfile(profile: EditorSourceProfile): EditorSourceProfile {
  return JSON.parse(JSON.stringify(profile)) as EditorSourceProfile;
}

function profileHash(profile: EditorSourceProfile): string {
  return sha256Hex(canonicalJson(profile));
}

export class AirstrikeAgentController {
  private readonly root: HTMLElement;
  private readonly options: AgentControllerOptions;
  private readonly elements: AgentElements;
  private threads: AgentThread[] = [];
  private threadId = 0;
  private profileKey = "";
  private mode: AgentMode = "plan";
  private running = false;
  private currentProposal: AgentProposal | null = null;
  private appliedProposalId: number | null = null;
  private undoSource: EditorSourceProfile | null = null;
  private latestAssistantText = "";
  private streamAssistant: HTMLElement | null = null;
  private lastUserRequest = "";
  private workspace: AgentWorkspaceScope = "full";
  private workspaceStaged = false;
  private contextStatus = "Ready";
  private readonly contextRails: HTMLElement[];

  public constructor(root: HTMLElement, options: AgentControllerOptions) {
    this.root = root;
    this.options = options;
    this.elements = {
      inspectorPanel: query(root, "[data-editor-inspector-panel]"),
      agentPanel: query(root, "[data-editor-agent-panel]"),
      thread: query(root, "[data-agent-thread]"),
      newThread: query(root, "[data-agent-new]"),
      deleteThread: query(root, "[data-agent-delete]"),
      unavailable: query(root, "[data-agent-unavailable]"),
      messages: query(root, "[data-agent-messages]"),
      proposal: query(root, "[data-agent-proposal]"),
      proposalStatus: query(root, "[data-agent-proposal-status]"),
      proposalSummary: query(root, "[data-agent-proposal-summary]"),
      apply: query(root, "[data-agent-apply]"),
      discard: query(root, "[data-agent-discard]"),
      undo: query(root, "[data-agent-undo]"),
      rerun: query(root, "[data-agent-rerun]"),
      form: query(root, "[data-agent-form]"),
      input: query(root, "[data-agent-input]"),
      send: query(root, "[data-agent-send]"),
      usePlan: query(root, "[data-agent-use-plan]"),
      runStatus: query(root, "[data-agent-run-status]"),
    };
    this.contextRails = Array.from(root.querySelectorAll<HTMLElement>("[data-agent-context-rail]"));
    this.initializeContextRails();
    this.bind();
    this.updateAvailability();
  }

  public async initialize(profileKey: string): Promise<void> {
    this.profileKey = profileKey;
    await this.loadThreads();
  }

  public async profileChanged(profileKey: string): Promise<void> {
    if (profileKey === this.profileKey) return;
    this.profileKey = profileKey;
    this.threadId = 0;
    this.clearProposal();
    this.elements.messages.textContent = "";
    await this.loadThreads();
  }

  public proposalIdForSave(): number | null {
    const context = this.options.getContext();
    if (!this.appliedProposalId || !this.currentProposal || !context) return null;
    return profileHash(context.source) === this.currentProposal.candidateSourceHash ? this.appliedProposalId : null;
  }

  public workspaceChanged(scope: AgentWorkspaceScope): void {
    this.workspace = scope;
    this.renderContextRails();
  }

  public showAgentTab(): void {
    this.showTab("agent");
  }

  public async commitWorkspaceProposal(source: EditorSourceProfile): Promise<void> {
    if (!this.workspaceStaged || !this.currentProposal) return;
    this.workspaceStaged = false;
    if (profileHash(source) === this.currentProposal.candidateSourceHash) {
      this.appliedProposalId = this.currentProposal.id;
      this.elements.proposalStatus.textContent = "Applied to unsaved draft";
      await this.setProposalStatus("applied");
    } else {
      this.appliedProposalId = null;
      this.elements.proposalStatus.textContent = "Proposal changed after staging";
      await this.setProposalStatus("discarded");
      this.currentProposal = null;
      this.undoSource = null;
      this.elements.proposal.hidden = true;
    }
    this.renderProposalActions();
    this.renderContextRails();
  }

  public async cancelWorkspaceProposal(): Promise<void> {
    if (!this.workspaceStaged || !this.currentProposal) return;
    this.workspaceStaged = false;
    this.undoSource = null;
    this.appliedProposalId = null;
    this.elements.proposalStatus.textContent = this.currentProposal.validation?.ok ? "Valid" : "Invalid";
    this.options.previewSource(this.currentProposal.candidateSource);
    this.renderProposalActions();
    this.renderContextRails();
  }

  public async profileSaved(profileKey: string): Promise<void> {
    if (this.threadId > 0 && profileKey) {
      await this.request("attach.php", { method: "POST", body: JSON.stringify({ threadId: this.threadId, profileKey }) }).catch(() => null);
    }
    this.profileKey = profileKey;
    if (this.appliedProposalId) {
      this.currentProposal = null;
      this.undoSource = null;
      this.appliedProposalId = null;
      this.elements.proposal.hidden = true;
      this.options.previewSource(null);
    }
    await this.loadThreads();
  }

  private initializeContextRails(): void {
    const labels: Record<string, string> = {
      profile: "Profile AI",
      "flight-path": "Flight Path AI",
      ordnance: "Ordnance AI",
      "view-validation": "Review AI",
    };
    const suggestions: Record<string, string[]> = {
      profile: ["Improve the profile name and notes", "Check whether this vehicle fits the intent"],
      "flight-path": ["Smooth this route", "Check timing and terrain clearance"],
      ordnance: ["Design a balanced payload schedule", "Check release timing and hardpoints"],
      "view-validation": ["Validate and explain any issues", "Summarize the compiled profile"],
    };
    for (const rail of this.contextRails) {
      const scope = String(rail.dataset.agentScope || "full") as AgentWorkspaceScope;
      rail.innerHTML = `
        <div class="airstrike-context-agent-head"><strong>${labels[scope] || "Airstrike AI"}</strong><button type="button" data-agent-context-toggle aria-label="Collapse AI help">AI</button></div>
        <div class="airstrike-context-agent-mode"><button type="button" data-agent-context-mode="plan">Plan</button><button type="button" data-agent-context-mode="regular">Regular</button><button type="button" data-agent-context-full>Full conversation</button></div>
        <div class="airstrike-context-agent-suggestions"></div>
        <div class="airstrike-context-agent-status" data-agent-context-status></div>
        <div class="airstrike-context-agent-output" data-agent-context-output></div>
        <div class="airstrike-context-agent-proposal" data-agent-context-proposal></div>
        <div class="airstrike-context-agent-actions"><button type="button" data-agent-context-stage>Stage</button><button type="button" data-agent-context-discard>Discard</button><button type="button" data-agent-context-unstage>Unstage</button><button type="button" data-agent-context-rerun>Rerun</button><button type="button" data-agent-context-use-plan>Use plan</button></div>
        <form class="airstrike-context-agent-form" data-agent-context-form><textarea maxlength="12000" placeholder="Ask for help in this workspace…"></textarea><div><span></span><button type="submit" data-agent-context-send>Send</button></div></form>`;
      const suggestionHost = query<HTMLElement>(rail, ".airstrike-context-agent-suggestions");
      for (const text of suggestions[scope] || []) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = text;
        button.addEventListener("click", () => {
          query<HTMLTextAreaElement>(rail, "textarea").value = text;
          query<HTMLTextAreaElement>(rail, "textarea").focus();
        });
        suggestionHost.appendChild(button);
      }
      query<HTMLButtonElement>(rail, "[data-agent-context-toggle]").addEventListener("click", () => rail.classList.toggle("is-collapsed"));
      rail.querySelectorAll<HTMLButtonElement>("[data-agent-context-mode]").forEach((button) => button.addEventListener("click", () => this.setMode(button.dataset.agentContextMode === "regular" ? "regular" : "plan")));
      query<HTMLButtonElement>(rail, "[data-agent-context-full]").addEventListener("click", () => void this.options.openFullAgent());
      query<HTMLFormElement>(rail, "[data-agent-context-form]").addEventListener("submit", (event) => {
        event.preventDefault();
        const input = query<HTMLTextAreaElement>(rail, "textarea");
        const message = input.value.trim();
        if (!message) return;
        input.value = "";
        void this.send(message, scope);
      });
      query<HTMLButtonElement>(rail, "[data-agent-context-stage]").addEventListener("click", () => void this.applyProposal());
      query<HTMLButtonElement>(rail, "[data-agent-context-discard]").addEventListener("click", () => void this.discardProposal());
      query<HTMLButtonElement>(rail, "[data-agent-context-unstage]").addEventListener("click", () => void this.undoProposal());
      query<HTMLButtonElement>(rail, "[data-agent-context-rerun]").addEventListener("click", () => void this.rerunProposal());
      query<HTMLButtonElement>(rail, "[data-agent-context-use-plan]").addEventListener("click", () => void this.usePlan());
      query<HTMLElement>(rail, "[data-agent-context-proposal]").addEventListener("click", (event) => {
        const target = event.target instanceof HTMLElement ? event.target.closest<HTMLButtonElement>("button[data-agent-diff-area]") : null;
        if (target) this.options.navigateDiff(String(target.dataset.agentDiffArea || ""), String(target.dataset.agentDiffId || ""));
      });
    }
    this.renderContextRails();
  }

  private renderProposalActions(): void {
    const proposed = Boolean(this.currentProposal && !this.workspaceStaged && !this.appliedProposalId);
    this.elements.apply.hidden = !proposed;
    this.elements.discard.hidden = !proposed;
    this.elements.undo.hidden = !this.appliedProposalId;
    this.elements.rerun.hidden = proposed || !this.currentProposal;
  }

  private renderContextRails(): void {
    const scopeLabels: Record<string, string> = { profile: "Profile only", "flight-path": "Route and waypoints", ordnance: "Ordnance only", "view-validation": "Read-only review" };
    for (const rail of this.contextRails) {
      const scope = String(rail.dataset.agentScope || "full") as AgentWorkspaceScope;
      rail.querySelectorAll<HTMLButtonElement>("[data-agent-context-mode]").forEach((button) => button.classList.toggle("is-active", button.dataset.agentContextMode === this.mode));
      const status = query<HTMLElement>(rail, "[data-agent-context-status]");
      status.textContent = `${scopeLabels[scope] || "Full profile"} · ${this.threadId > 0 ? `Conversation ${this.threadId}` : "New conversation"} · ${this.contextStatus}`;
      const output = query<HTMLElement>(rail, "[data-agent-context-output]");
      output.textContent = this.latestAssistantText || (scope === "view-validation" ? "Ask AI to inspect, validate, or compile this profile." : "Describe the change you want, or ask for a plan first.");
      const proposalHost = query<HTMLElement>(rail, "[data-agent-context-proposal]");
      proposalHost.textContent = "";
      if (this.currentProposal) {
        const summary = document.createElement("strong");
        const compile = this.currentProposal.compileSummary || {};
        summary.textContent = `${this.currentProposal.validation?.ok ? "Valid" : "Invalid"} proposal · ${this.currentProposal.diff?.length || 0} changes · ${String(compile.manualUnits ?? 0)} manual + ${String(compile.generatedUnits ?? 0)} generated`;
        proposalHost.appendChild(summary);
        const list = document.createElement("ul");
        for (const change of this.currentProposal.diff || []) {
          const item = document.createElement("li");
          const button = document.createElement("button");
          button.type = "button";
          button.dataset.agentDiffArea = String(change.area || "profile");
          button.dataset.agentDiffId = String(change.id || "");
          button.textContent = `${change.action || "updated"} ${change.area || "profile"} ${change.id || ""}`.trim();
          item.appendChild(button);
          list.appendChild(item);
        }
        proposalHost.appendChild(list);
      }
      const stage = query<HTMLButtonElement>(rail, "[data-agent-context-stage]");
      stage.hidden = !this.currentProposal || this.workspaceStaged || Boolean(this.appliedProposalId);
      stage.disabled = !this.currentProposal?.validation?.ok || scope === "view-validation";
      query<HTMLButtonElement>(rail, "[data-agent-context-discard]").hidden = !this.currentProposal || this.workspaceStaged || Boolean(this.appliedProposalId);
      query<HTMLButtonElement>(rail, "[data-agent-context-unstage]").hidden = !this.workspaceStaged && !this.appliedProposalId;
      query<HTMLButtonElement>(rail, "[data-agent-context-rerun]").hidden = !this.currentProposal;
      query<HTMLButtonElement>(rail, "[data-agent-context-use-plan]").hidden = this.mode !== "plan" || this.latestAssistantText === "";
      const input = query<HTMLTextAreaElement>(rail, "textarea");
      input.disabled = this.running || !this.options.enabled || !this.options.configured || !this.options.storageReady;
      query<HTMLButtonElement>(rail, "[data-agent-context-send]").disabled = input.disabled;
    }
  }

  private bind(): void {
    this.root.querySelectorAll<HTMLButtonElement>("[data-editor-right-tab]").forEach((button) => {
      button.addEventListener("click", () => this.showTab(button.dataset.editorRightTab === "agent" ? "agent" : "inspector"));
    });
    this.root.querySelectorAll<HTMLButtonElement>("[data-agent-mode]").forEach((button) => {
      button.addEventListener("click", () => this.setMode(button.dataset.agentMode === "regular" ? "regular" : "plan"));
    });
    this.elements.thread.addEventListener("change", () => void this.selectThread(Number(this.elements.thread.value || 0)));
    this.elements.newThread.addEventListener("click", () => void this.newThread());
    this.elements.deleteThread.addEventListener("click", () => void this.deleteThread());
    this.elements.form.addEventListener("submit", (event) => {
      event.preventDefault();
      void this.send();
    });
    this.elements.input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        void this.send();
      }
    });
    this.elements.usePlan.addEventListener("click", () => void this.usePlan());
    this.elements.apply.addEventListener("click", () => void this.applyProposal());
    this.elements.discard.addEventListener("click", () => void this.discardProposal());
    this.elements.undo.addEventListener("click", () => void this.undoProposal());
    this.elements.rerun.addEventListener("click", () => void this.rerunProposal());
  }

  private showTab(tab: "inspector" | "agent"): void {
    this.elements.inspectorPanel.hidden = tab !== "inspector";
    this.elements.agentPanel.hidden = tab !== "agent";
    this.root.querySelectorAll<HTMLButtonElement>("[data-editor-right-tab]").forEach((button) => {
      const active = button.dataset.editorRightTab === tab;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
    });
  }

  private setMode(mode: AgentMode): void {
    this.mode = mode;
    this.root.querySelectorAll<HTMLButtonElement>("[data-agent-mode]").forEach((button) => {
      button.classList.toggle("is-active", button.dataset.agentMode === mode);
    });
    if (this.threadId > 0) {
      void this.request("thread.php", { method: "POST", body: JSON.stringify({ threadId: this.threadId, mode }) });
    }
    this.renderContextRails();
  }

  private updateAvailability(): void {
    let message = "";
    if (!this.options.enabled) message = "The airstrike agent feature flag is disabled.";
    else if (!this.options.storageReady) message = "Agent storage is not ready. Run migration 067_airstrike_animation_agent.sql.";
    else if (!this.options.configured) message = "The OpenAI API key is not configured for the airstrike agent.";
    this.elements.unavailable.hidden = message === "";
    this.elements.unavailable.textContent = message;
    this.elements.input.disabled = message !== "";
    this.elements.send.disabled = message !== "";
    this.contextStatus = message || "Ready";
    this.renderContextRails();
  }

  private async request(path: string, options: RequestInit = {}): Promise<Record<string, unknown>> {
    const headers = new Headers(options.headers);
    headers.set("Accept", "application/json");
    headers.set("X-Raidlands-Admin-CSRF", this.options.csrf);
    if (options.body) headers.set("Content-Type", "application/json");
    const response = await fetch(`${this.options.apiBase.replace(/\/$/, "")}/${path}`, {
      credentials: "same-origin",
      cache: "no-store",
      ...options,
      headers,
    });
    const payload = (await response.json().catch(() => ({ ok: false, error: "Unreadable server response." }))) as Record<string, unknown>;
    if (!response.ok || payload.ok !== true) throw new Error(String(payload.error || "Agent request failed."));
    return payload;
  }

  private async loadThreads(): Promise<void> {
    if (!this.options.storageReady) return;
    try {
      const queryString = this.profileKey ? `?profile=${encodeURIComponent(this.profileKey)}` : "";
      const payload = await this.request(`threads.php${queryString}`, { method: "GET" });
      this.threads = Array.isArray(payload.threads) ? (payload.threads as unknown as AgentThread[]) : [];
      this.renderThreads();
      if (this.threadId && this.threads.some((thread) => thread.id === this.threadId)) return;
      if (this.threads[0]) await this.selectThread(this.threads[0].id);
    } catch (error) {
      this.setRunStatus(error instanceof Error ? error.message : String(error), true);
    }
  }

  private renderThreads(): void {
    this.elements.thread.textContent = "";
    this.elements.thread.appendChild(new Option("New conversation", ""));
    for (const thread of this.threads) this.elements.thread.appendChild(new Option(thread.title, String(thread.id)));
    this.elements.thread.value = this.threadId ? String(this.threadId) : "";
    this.elements.deleteThread.disabled = this.threadId <= 0;
  }

  private async selectThread(threadId: number): Promise<void> {
    this.threadId = threadId;
    this.clearProposal();
    this.elements.messages.textContent = "";
    if (threadId <= 0) {
      this.renderThreads();
      return;
    }
    try {
      const payload = await this.request(`thread.php?id=${threadId}`, { method: "GET" });
      const thread = payload.thread as unknown as AgentThread;
      this.setMode(thread.mode === "regular" ? "regular" : "plan");
      let activeContextLabelAdded = false;
      for (const item of (Array.isArray(payload.items) ? payload.items : []) as unknown as AgentItem[]) {
        if (item.inActiveContext && !activeContextLabelAdded && (payload.items as AgentItem[]).some((entry) => entry.inActiveContext === false)) {
          this.addMessage("tool", "Active model context starts here", "is-context-boundary");
          activeContextLabelAdded = true;
        }
        if (item.type === "message") this.addMessage(item.role, item.content);
        else if (item.type === "tool_call") this.addMessage("tool", `Tool: ${item.content}`);
      }
      const proposal = payload.proposal as AgentProposal | null;
      if (proposal?.status === "proposed") this.setProposal(proposal);
      this.elements.thread.value = String(threadId);
      this.elements.deleteThread.disabled = false;
    } catch (error) {
      this.setRunStatus(error instanceof Error ? error.message : String(error), true);
    }
  }

  private async newThread(): Promise<void> {
    this.threadId = 0;
    this.clearProposal();
    this.elements.messages.textContent = "";
    this.renderThreads();
    this.elements.input.focus();
  }

  private async deleteThread(): Promise<void> {
    if (this.threadId <= 0 || !window.confirm("Delete this agent conversation and its proposals?")) return;
    try {
      await this.request(`thread.php?id=${this.threadId}`, { method: "DELETE", body: "{}" });
      this.threadId = 0;
      this.elements.messages.textContent = "";
      this.clearProposal();
      await this.loadThreads();
    } catch (error) {
      this.setRunStatus(error instanceof Error ? error.message : String(error), true);
    }
  }

  private addMessage(role: string, content: string, extraClass = ""): HTMLElement {
    const message = document.createElement("div");
    message.className = `airstrike-agent-message is-${role === "user" ? "user" : role === "tool" ? "tool" : "assistant"}${extraClass ? ` ${extraClass}` : ""}`;
    message.textContent = content;
    this.elements.messages.appendChild(message);
    this.elements.messages.scrollTop = this.elements.messages.scrollHeight;
    return message;
  }

  private setRunStatus(message: string, error = false): void {
    this.elements.runStatus.textContent = message;
    this.elements.runStatus.style.color = error ? "#fca5a5" : "";
    this.contextStatus = message;
    this.renderContextRails();
  }

  private async send(messageOverride = "", scopeOverride: AgentWorkspaceScope = "full"): Promise<void> {
    if (this.running) return;
    const context = this.options.getContext();
    const message = messageOverride.trim() || this.elements.input.value.trim();
    if (!context || !message) return;
    context.activeWorkspace = scopeOverride === "full" ? context.activeWorkspace : scopeOverride;
    this.running = true;
    this.elements.send.disabled = true;
    this.elements.input.disabled = true;
    this.elements.usePlan.hidden = true;
    this.latestAssistantText = "";
    this.streamAssistant = null;
    this.addMessage("user", message);
    this.lastUserRequest = message;
    if (!messageOverride) this.elements.input.value = "";
    this.setRunStatus("Starting…");
    try {
      const response = await fetch(`${this.options.apiBase.replace(/\/$/, "")}/chat.php`, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream", "X-Raidlands-Admin-CSRF": this.options.csrf },
        body: JSON.stringify({ threadId: this.threadId || null, mode: this.mode, message, editorContext: context }),
      });
      if (!response.ok || !response.body) throw new Error(`Agent stream failed with HTTP ${response.status}.`);
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const parsed = parseSseBlocks(buffer);
        buffer = parsed.remainder;
        for (const event of parsed.events) this.handleStreamEvent(event);
        if (done) break;
      }
      await this.loadThreads();
    } catch (error) {
      const messageText = error instanceof Error ? error.message : String(error);
      this.addMessage("assistant", messageText);
      this.setRunStatus(messageText, true);
    } finally {
      this.running = false;
      this.elements.send.disabled = false;
      this.elements.input.disabled = false;
      if (!messageOverride) this.elements.input.focus();
      this.renderContextRails();
    }
  }

  private handleStreamEvent(event: ParsedSseEvent): void {
    const data = event.data && typeof event.data === "object" ? (event.data as Record<string, unknown>) : {};
    if (event.event === "thread") {
      this.threadId = Number(data.threadId || 0);
      return;
    }
    if (event.event === "status") {
      this.setRunStatus(String(data.message || "Working…"));
      return;
    }
    if (event.event === "text_delta") {
      if (!this.streamAssistant) this.streamAssistant = this.addMessage("assistant", "");
      const delta = String(data.delta || "");
      this.latestAssistantText += delta;
      this.streamAssistant.textContent = this.latestAssistantText;
      this.elements.messages.scrollTop = this.elements.messages.scrollHeight;
      this.renderContextRails();
      return;
    }
    if (event.event === "tool_started") {
      const toolName = String(data.name || "tool");
      this.addMessage("tool", `Running ${toolName}…`);
      this.setRunStatus(`Running ${toolName}…`);
      return;
    }
    if (event.event === "tool_finished") {
      this.setRunStatus(`${String(data.name || "Tool")} ${data.ok ? "completed" : "failed"}`);
      return;
    }
    if (event.event === "proposal") {
      this.setProposal(data as unknown as AgentProposal);
      return;
    }
    if (event.event === "completed") {
      const finalMessage = String(data.message || "");
      const availableTools = Array.isArray(data.availableTools) ? data.availableTools.map(String) : [];
      const completedScope = String(data.workspaceScope || this.workspace);
      if (!this.streamAssistant && finalMessage) this.streamAssistant = this.addMessage("assistant", finalMessage);
      this.latestAssistantText = finalMessage || this.latestAssistantText;
      this.elements.usePlan.hidden = this.mode !== "plan" || this.latestAssistantText === "";
      this.setRunStatus(availableTools.length > 0 ? `Complete · ${completedScope} · ${availableTools.length} tools` : "Complete");
      this.renderContextRails();
      return;
    }
    if (event.event === "error") {
      const error = String(data.message || "Agent request failed.");
      this.addMessage("assistant", error);
      this.setRunStatus(error, true);
    }
  }

  private setProposal(proposal: AgentProposal): void {
    this.currentProposal = proposal;
    this.appliedProposalId = null;
    this.undoSource = null;
    this.elements.proposal.hidden = false;
    this.elements.proposalStatus.textContent = proposal.validation?.ok ? "Valid" : "Invalid";
    this.elements.proposalSummary.textContent = "";
    const summary = document.createElement("p");
    const compile = proposal.compileSummary || {};
    summary.textContent = `${proposal.diff?.length || 0} changes · ${String(compile.frameCount ?? 0)} frames · ${String(compile.manualUnits ?? 0)} manual + ${String(compile.generatedUnits ?? 0)} generated units`;
    this.elements.proposalSummary.appendChild(summary);
    const list = document.createElement("ul");
    for (const change of proposal.diff || []) {
      const item = document.createElement("li");
      item.textContent = `${change.action || "updated"} ${change.area || "profile"} ${change.id || ""}`.trim();
      list.appendChild(item);
    }
    this.elements.proposalSummary.appendChild(list);
    this.elements.apply.disabled = !proposal.validation?.ok;
    this.workspaceStaged = false;
    this.renderProposalActions();
    this.options.previewSource(proposal.candidateSource);
    this.renderContextRails();
  }

  private async applyProposal(): Promise<void> {
    const proposal = this.currentProposal;
    const context = this.options.getContext();
    if (!proposal || !context || !proposal.validation?.ok) return;
    if (profileHash(context.source) !== proposal.baseSourceHash) {
      this.setRunStatus("The draft changed after this proposal. Ask the agent to rerun against the current draft.", true);
      this.elements.rerun.hidden = false;
      return;
    }
    this.undoSource = cloneProfile(context.source);
    this.options.applySource(cloneProfile(proposal.candidateSource), proposal.id);
    this.options.previewSource(null);
    if (this.options.workspaceScope() !== "full") {
      this.workspaceStaged = true;
      this.appliedProposalId = null;
      this.elements.proposalStatus.textContent = "Staged in workspace";
      this.renderProposalActions();
      this.renderContextRails();
      return;
    }
    this.appliedProposalId = proposal.id;
    this.elements.apply.hidden = true;
    this.elements.discard.hidden = true;
    this.elements.undo.hidden = false;
    this.elements.rerun.hidden = true;
    this.elements.proposalStatus.textContent = "Applied to unsaved draft";
    await this.setProposalStatus("applied");
    this.renderContextRails();
  }

  private async discardProposal(): Promise<void> {
    if (!this.currentProposal) return;
    this.options.previewSource(null);
    await this.setProposalStatus("discarded");
    this.clearProposal();
  }

  private async undoProposal(): Promise<void> {
    if (!this.currentProposal || !this.undoSource) return;
    const context = this.options.getContext();
    if (!context || profileHash(context.source) !== this.currentProposal.candidateSourceHash) {
      this.setRunStatus("The draft changed after the agent edit, so undo was not applied over newer work.", true);
      return;
    }
    this.options.applySource(cloneProfile(this.undoSource), null);
    if (this.workspaceStaged) {
      this.workspaceStaged = false;
      this.appliedProposalId = null;
      this.undoSource = null;
      this.options.previewSource(this.currentProposal.candidateSource);
      this.elements.proposalStatus.textContent = this.currentProposal.validation?.ok ? "Valid" : "Invalid";
      this.renderProposalActions();
      this.renderContextRails();
      return;
    }
    this.options.previewSource(null);
    await this.setProposalStatus("undone");
    this.clearProposal();
  }

  private async rerunProposal(): Promise<void> {
    const request = this.lastUserRequest || "Rebuild the latest proposal against the current draft while preserving the same intent.";
    this.elements.rerun.hidden = true;
    await this.send(request, this.options.workspaceScope());
  }

  private async setProposalStatus(status: string): Promise<void> {
    if (!this.currentProposal) return;
    await this.request("proposal.php", { method: "POST", body: JSON.stringify({ proposalId: this.currentProposal.id, status }) }).catch(() => null);
  }

  private clearProposal(): void {
    this.currentProposal = null;
    this.undoSource = null;
    this.appliedProposalId = null;
    this.workspaceStaged = false;
    this.elements.proposal.hidden = true;
    this.elements.rerun.hidden = true;
    this.options.previewSource(null);
    this.renderProposalActions();
    this.renderContextRails();
  }

  private async usePlan(): Promise<void> {
    if (!this.latestAssistantText || this.threadId <= 0) return;
    try {
      await this.request("thread.php", {
        method: "POST",
        body: JSON.stringify({ threadId: this.threadId, mode: "regular", pinnedPlan: this.latestAssistantText }),
      });
      this.setMode("regular");
      this.elements.usePlan.hidden = true;
      this.setRunStatus("Plan pinned. Regular mode can now execute it.");
      this.elements.input.value = "Implement the pinned plan against the current draft.";
      this.elements.input.focus();
      for (const rail of this.contextRails) {
        if (rail.dataset.agentScope === this.options.workspaceScope()) {
          query<HTMLTextAreaElement>(rail, "textarea").value = "Implement the pinned plan against the current workspace.";
        }
      }
      this.renderContextRails();
    } catch (error) {
      this.setRunStatus(error instanceof Error ? error.message : String(error), true);
    }
  }
}
