import { Vector3 } from "three";
import { AirstrikeViewport } from "./editor/viewport";
import {
  firstWaypointId,
  findWaypoint,
  updateWaypointField,
  updateWaypointPositionFromThree,
  WAYPOINT_FIELDS,
  type EditableWaypointField,
} from "./editor/waypoint-source";
import type { EditorSourceProfile, VehiclePreviewMetadataFile } from "./types";

interface EditorConfig {
  profileKey?: string;
  csrf?: string;
  apiBase?: string;
  assetBase?: string;
  managementUrl?: string;
}

interface ProfileSummary {
  profileKey: string;
  displayName: string;
  vehicle: string;
  draftVersion: number;
}

interface EditorElements {
  root: HTMLElement;
  state: HTMLElement;
  dirty: HTMLElement;
  title: HTMLElement;
  source: HTMLTextAreaElement;
  key: HTMLInputElement;
  name: HTMLInputElement;
  vehicle: HTMLSelectElement;
  feedback: HTMLElement;
  output: HTMLElement;
  compileSummary: HTMLElement;
  list: HTMLElement;
  search: HTMLInputElement;
  viewport: HTMLElement;
  timeRange: HTMLInputElement;
  timeNumber: HTMLInputElement;
  timeReadout: HTMLElement;
  waypointList: HTMLElement;
  waypointTitle: HTMLElement;
  vehicleMeta: HTMLElement;
}

interface EditorState {
  profiles: ProfileSummary[];
  profile: EditorSourceProfile | null;
  profileKey: string;
  baseVersion: number;
  dirty: boolean;
  loading: boolean;
  selectedWaypointId: string;
  scrubTime: number;
}

function starterSource(): EditorSourceProfile {
  return {
    EditorSourceSchemaVersion: 1,
    ProfileKey: "new_airstrike_profile",
    DisplayName: "New Airstrike Profile",
    Vehicle: "f15",
    DurationSeconds: 8,
    FirstPayloadDelaySeconds: 3.5,
    RotationSmoothTimeSeconds: 0.12,
    StopAtWaypoints: false,
    MinimumTerrainClearance: 55,
    PositionInterpolation: "time_hermite",
    RotationMode: "follow_path_plus_offset",
    Waypoints: [
      { Id: "wp_001", Time: 0, X: 0, Y: 90, Z: -300, RotationX: 0, RotationY: 0, RotationZ: 0 },
      { Id: "wp_002", Time: 3.5, X: 0, Y: 60, Z: 0, RotationX: -15, RotationY: 0, RotationZ: 0 },
      { Id: "wp_003", Time: 8, X: 0, Y: 90, Z: 300, RotationX: 0, RotationY: 0, RotationZ: 0 },
    ],
    ReleaseSource: {
      Mode: "manual",
      LegacyDynamic: true,
      Events: [],
      FallbackIntervalSeconds: 0.5,
      Template: {
        Payload: "hv_rocket",
        Count: 1,
        CarrierOffsetX: 0,
        CarrierOffsetY: 0,
        CarrierOffsetZ: 0,
        TargetOffsetX: 0,
        TargetOffsetY: 0,
        TargetOffsetZ: 0,
        SpreadRadius: -1,
        LaunchSpeed: -1,
        FuseSeconds: -1,
        DamageScale: 1,
        VehicleDamageScale: -1,
        SplashRadius: -1,
        ImpactRadius: -1,
        MaxTrackingSeconds: -1,
        MaxTrackingDistance: -1,
        DamageScales: {},
      },
    },
    EditorMetadata: {
      Notes: "",
      Tags: [],
      VehiclePreviewOverrides: {},
    },
  };
}

function readConfig(): EditorConfig | null {
  const configNode = document.getElementById("airstrike-animation-editor-config");
  if (!configNode) {
    return null;
  }
  try {
    return JSON.parse(configNode.textContent || "{}") as EditorConfig;
  } catch {
    return null;
  }
}

function query<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Missing editor element: ${selector}`);
  }
  return element;
}

function parseProfileSource(value: string): EditorSourceProfile {
  const parsed = JSON.parse(value || "{}") as unknown;
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    throw new Error("Source JSON must be an object.");
  }
  return parsed as EditorSourceProfile;
}

function formatValidationEntry(entry: unknown): string {
  if (!entry || typeof entry !== "object") {
    return String(entry || "Validation failed");
  }
  const issue = entry as { path?: unknown; message?: unknown };
  const path = typeof issue.path === "string" && issue.path ? `${issue.path}: ` : "";
  return `${path}${String(issue.message || "Validation failed")}`;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

class AirstrikeEditorApp {
  private readonly config: EditorConfig;
  private readonly elements: EditorElements;
  private readonly state: EditorState = {
    profiles: [],
    profile: null,
    profileKey: "",
    baseVersion: 0,
    dirty: false,
    loading: false,
    selectedWaypointId: "",
    scrubTime: 0,
  };
  private readonly viewport: AirstrikeViewport;
  private metadata: VehiclePreviewMetadataFile | null = null;

  public constructor(config: EditorConfig, elements: EditorElements) {
    this.config = config;
    this.elements = elements;
    this.viewport = new AirstrikeViewport(elements.viewport, {
      assetBase: String(config.assetBase || "../assets/"),
      metadata: null,
      onSelectWaypoint: (waypointId) => this.selectWaypoint(waypointId),
      onWaypointMoved: (waypointId, position) => this.handleWaypointMoved(waypointId, position),
      onVehicleStatus: (status) => {
        const pieces = [status.modelState];
        if (status.prefabLabel) {
          pieces.push(status.prefabLabel);
        }
        this.elements.vehicleMeta.textContent = pieces.join(" | ");
      },
    });
    this.bindEvents();
  }

  public async initialize(): Promise<void> {
    try {
      this.metadata = await this.loadVehicleMetadata();
      this.viewport.updateMetadata(this.metadata);
      await this.loadList();
      if (this.config.profileKey) {
        await this.loadProfile(this.config.profileKey);
      } else {
        this.loadSource(starterSource(), "", 0);
      }
    } catch (error) {
      this.loadSource(starterSource(), "", 0);
      this.showFeedback(error instanceof Error ? error.message : String(error), "error");
      this.setStatus("Editor started without server profile list");
    }
  }

  private bindEvents(): void {
    this.elements.source.addEventListener("input", () => this.handleSourceInput());
    this.elements.key.addEventListener("change", () => this.syncIdentityIntoSource());
    this.elements.name.addEventListener("change", () => this.syncIdentityIntoSource());
    this.elements.vehicle.addEventListener("change", () => this.syncIdentityIntoSource());
    this.elements.search.addEventListener("input", () => this.renderProfiles());
    this.elements.timeRange.addEventListener("input", () => this.setScrubTime(Number(this.elements.timeRange.value)));
    this.elements.timeNumber.addEventListener("input", () => this.setScrubTime(Number(this.elements.timeNumber.value)));
    this.elements.root.querySelector("[data-editor-new]")?.addEventListener("click", () => this.createNewProfile());
    this.elements.root.querySelector("[data-editor-save]")?.addEventListener("click", () => void this.saveDraft());
    this.elements.root.querySelector("[data-editor-validate]")?.addEventListener("click", () => void this.validateSource());
    this.elements.root.querySelector("[data-editor-compile]")?.addEventListener("click", () => void this.compilePreview());
    this.elements.root.querySelectorAll<HTMLButtonElement>("[data-editor-publish]").forEach((button) => {
      button.addEventListener("click", () => void this.publish(button.dataset.editorPublish === "sync"));
    });
    this.elements.root.querySelectorAll<HTMLInputElement>("[data-editor-waypoint-field]").forEach((input) => {
      input.addEventListener("input", () => this.handleWaypointFieldInput(input));
    });
    document.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void this.saveDraft();
      }
    });
  }

  private async loadVehicleMetadata(): Promise<VehiclePreviewMetadataFile | null> {
    const assetBase = String(this.config.assetBase || "../assets/").replace(/\/?$/, "/");
    try {
      const response = await fetch(`${assetBase}airstrike-animation-editor/vehicle-preview.json`, {
        cache: "no-store",
        credentials: "same-origin",
      });
      if (!response.ok) {
        return null;
      }
      return (await response.json()) as VehiclePreviewMetadataFile;
    } catch {
      return null;
    }
  }

  private async request(path: string, options: RequestInit = {}): Promise<Record<string, unknown>> {
    const headers = new Headers(options.headers);
    headers.set("Accept", "application/json");
    headers.set("X-Raidlands-Admin-CSRF", String(this.config.csrf || ""));
    if (options.body) {
      headers.set("Content-Type", "application/json");
    }
    const response = await fetch(`${String(this.config.apiBase || "").replace(/\/$/, "")}/${path}`, {
      credentials: "same-origin",
      cache: "no-store",
      ...options,
      headers,
    });
    const payload = (await response.json().catch(() => ({
      ok: false,
      error: "The server returned an unreadable response.",
    }))) as Record<string, unknown>;
    if (!response.ok || payload.ok !== true) {
      throw new Error(String(payload.error || "The request failed."));
    }
    return payload;
  }

  private setStatus(message: string): void {
    this.elements.state.textContent = message;
  }

  private setDirty(dirty: boolean): void {
    this.state.dirty = dirty;
    this.elements.dirty.textContent = dirty ? "Unsaved" : "Clean";
    this.elements.dirty.classList.toggle("active", dirty);
  }

  private showFeedback(message: string, type: "" | "error" | "success"): void {
    this.elements.feedback.textContent = message;
    this.elements.feedback.classList.toggle("is-error", type === "error");
    this.elements.feedback.classList.toggle("is-success", type === "success");
  }

  private recoveryKey(): string {
    return `raidlands.airstrike-animation-recovery.${this.state.profileKey || this.elements.key.value || "new"}`;
  }

  private markEdited(): void {
    if (this.state.loading) {
      return;
    }
    this.setDirty(true);
    this.setStatus("Draft has local changes");
    try {
      window.localStorage.setItem(
        this.recoveryKey(),
        JSON.stringify({
          savedAt: new Date().toISOString(),
          source: this.elements.source.value,
        }),
      );
    } catch {
      // Local recovery is best-effort; server saves remain authoritative.
    }
  }

  private writeSource(profile: EditorSourceProfile): void {
    this.elements.source.value = JSON.stringify(profile, null, 2);
  }

  private loadSource(source: EditorSourceProfile, profileKey: string, version: number): void {
    this.state.loading = true;
    this.state.profile = source;
    this.state.profileKey = profileKey || "";
    this.state.baseVersion = Number(version || 0);
    this.state.selectedWaypointId = findWaypoint(source, this.state.selectedWaypointId)?.Id || firstWaypointId(source);
    this.state.scrubTime = clamp(this.state.scrubTime, 0, Number(source.DurationSeconds || 0));
    this.writeSource(source);
    this.syncControlsFromSource(source);
    this.renderWaypoints();
    this.renderWaypointInspector();
    this.renderTimeControls();
    this.viewport.updateProfile(source, this.state.selectedWaypointId, this.state.scrubTime);
    this.elements.output.textContent = "";
    this.elements.compileSummary.textContent = "No compiled track yet";
    this.showFeedback("Load or edit waypoints, then validate before publishing.", "");
    this.setDirty(false);
    this.setStatus(this.state.baseVersion > 0 ? `Draft v${this.state.baseVersion} loaded` : "New unsaved profile");
    this.state.loading = false;
  }

  private applyProfile(source: EditorSourceProfile, dirty: boolean, refreshViewport = true): void {
    this.state.profile = source;
    this.state.selectedWaypointId = findWaypoint(source, this.state.selectedWaypointId)?.Id || firstWaypointId(source);
    this.state.scrubTime = clamp(this.state.scrubTime, 0, Number(source.DurationSeconds || 0));
    this.writeSource(source);
    this.syncControlsFromSource(source);
    this.renderWaypoints();
    this.renderWaypointInspector();
    this.renderTimeControls();
    if (refreshViewport) {
      this.viewport.updateProfile(source, this.state.selectedWaypointId, this.state.scrubTime);
    }
    if (dirty) {
      this.markEdited();
    }
  }

  private syncControlsFromSource(source: EditorSourceProfile): void {
    this.elements.key.value = String(source.ProfileKey || "");
    this.elements.name.value = String(source.DisplayName || "");
    this.elements.vehicle.value = String(source.Vehicle || "f15");
    this.elements.key.disabled = this.state.baseVersion > 0;
    this.elements.title.textContent = String(source.DisplayName || source.ProfileKey || "New profile");
  }

  private readCurrentSource(): EditorSourceProfile {
    const source = parseProfileSource(this.elements.source.value);
    source.ProfileKey = String(this.elements.key.value || source.ProfileKey || "").trim().toLowerCase();
    source.DisplayName = String(this.elements.name.value || source.DisplayName || "").trim();
    source.Vehicle = String(this.elements.vehicle.value || source.Vehicle || "f15");
    this.state.profile = source;
    this.writeSource(source);
    return source;
  }

  private syncIdentityIntoSource(): void {
    if (!this.state.profile) {
      return;
    }
    try {
      const source = this.readCurrentSource();
      this.applyProfile(source, true);
    } catch (error) {
      this.showFeedback(error instanceof Error ? error.message : String(error), "error");
    }
  }

  private handleSourceInput(): void {
    this.markEdited();
    try {
      const source = parseProfileSource(this.elements.source.value);
      this.state.profile = source;
      this.state.selectedWaypointId = findWaypoint(source, this.state.selectedWaypointId)?.Id || firstWaypointId(source);
      this.syncControlsFromSource(source);
      this.renderWaypoints();
      this.renderWaypointInspector();
      this.renderTimeControls();
      this.viewport.updateProfile(source, this.state.selectedWaypointId, this.state.scrubTime);
    } catch (error) {
      this.setStatus("JSON edits pending");
      this.showFeedback(error instanceof Error ? error.message : String(error), "error");
    }
  }

  private renderProfiles(): void {
    const filter = String(this.elements.search.value || "").trim().toLowerCase();
    this.elements.list.textContent = "";
    this.state.profiles
      .filter((profile) => {
        return (
          !filter ||
          String(profile.profileKey || "").toLowerCase().includes(filter) ||
          String(profile.displayName || "").toLowerCase().includes(filter)
        );
      })
      .forEach((profile) => {
        const button = document.createElement("button");
        const label = document.createElement("strong");
        const detail = document.createElement("small");
        button.type = "button";
        button.className = `airstrike-editor-profile${profile.profileKey === this.state.profileKey ? " is-active" : ""}`;
        label.textContent = profile.displayName || profile.profileKey;
        detail.textContent = `${profile.profileKey} | ${profile.vehicle} | draft v${profile.draftVersion}`;
        button.append(label, detail);
        button.addEventListener("click", () => {
          if (this.state.dirty && !window.confirm(`Discard local unsaved changes and load ${profile.profileKey}?`)) {
            return;
          }
          void this.loadProfile(profile.profileKey);
        });
        this.elements.list.appendChild(button);
      });
  }

  private renderWaypoints(): void {
    this.elements.waypointList.textContent = "";
    const profile = this.state.profile;
    if (!profile) {
      return;
    }
    for (const waypoint of profile.Waypoints) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `airstrike-waypoint-row${waypoint.Id === this.state.selectedWaypointId ? " is-active" : ""}`;
      button.textContent = `${waypoint.Id}  ${waypoint.Time.toFixed(2)}s  X ${waypoint.X}  Y ${waypoint.Y}  Z ${waypoint.Z}`;
      button.addEventListener("click", () => this.selectWaypoint(waypoint.Id));
      this.elements.waypointList.appendChild(button);
    }
  }

  private renderWaypointInspector(): void {
    const profile = this.state.profile;
    const waypoint = profile ? findWaypoint(profile, this.state.selectedWaypointId) : undefined;
    this.elements.waypointTitle.textContent = waypoint ? waypoint.Id : "No waypoint selected";
    this.elements.root.querySelectorAll<HTMLInputElement>("[data-editor-waypoint-field]").forEach((input) => {
      const field = input.dataset.editorWaypointField as EditableWaypointField | undefined;
      input.disabled = !waypoint || !field;
      input.value = waypoint && field ? String(waypoint[field]) : "";
    });
  }

  private renderTimeControls(): void {
    const duration = Math.max(0.01, Number(this.state.profile?.DurationSeconds || 0.01));
    this.state.scrubTime = clamp(this.state.scrubTime, 0, duration);
    this.elements.timeRange.max = String(duration);
    this.elements.timeRange.value = String(this.state.scrubTime);
    this.elements.timeNumber.max = String(duration);
    this.elements.timeNumber.value = this.state.scrubTime.toFixed(2);
    this.elements.timeReadout.textContent = `${this.state.scrubTime.toFixed(2)}s / ${duration.toFixed(2)}s`;
  }

  private setScrubTime(time: number): void {
    const duration = Math.max(0, Number(this.state.profile?.DurationSeconds || 0));
    this.state.scrubTime = clamp(Number.isFinite(time) ? time : 0, 0, duration);
    this.renderTimeControls();
    this.viewport.updateTime(this.state.scrubTime);
  }

  private selectWaypoint(waypointId: string): void {
    this.state.selectedWaypointId = waypointId;
    this.renderWaypoints();
    this.renderWaypointInspector();
    this.viewport.updateSelectedWaypoint(waypointId);
  }

  private handleWaypointMoved(waypointId: string, position: Vector3): EditorSourceProfile | null {
    if (!this.state.profile) {
      return null;
    }
    const next = updateWaypointPositionFromThree(this.state.profile, waypointId, position);
    this.state.profile = next;
    this.writeSource(next);
    this.renderWaypoints();
    this.renderWaypointInspector();
    this.markEdited();
    return next;
  }

  private handleWaypointFieldInput(input: HTMLInputElement): void {
    if (!this.state.profile) {
      return;
    }
    const field = input.dataset.editorWaypointField as EditableWaypointField | undefined;
    if (!field || !WAYPOINT_FIELDS.includes(field)) {
      return;
    }
    const value = Number(input.value);
    if (!Number.isFinite(value)) {
      return;
    }
    const next = updateWaypointField(this.state.profile, this.state.selectedWaypointId, field, value);
    this.applyProfile(next, true);
    if (field === "Time") {
      this.setScrubTime(value);
    }
  }

  private async loadList(): Promise<void> {
    const payload = await this.request("list.php?include_archived=0", { method: "GET" });
    this.state.profiles = Array.isArray(payload.profiles) ? (payload.profiles as ProfileSummary[]) : [];
    this.renderProfiles();
  }

  private async loadProfile(profileKey: string): Promise<void> {
    this.setStatus(`Loading ${profileKey}...`);
    try {
      const payload = await this.request(`get.php?profile=${encodeURIComponent(profileKey)}`, { method: "GET" });
      const profile = payload.profile as { source?: EditorSourceProfile; profileKey?: string; draftVersion?: number };
      this.loadSource(profile.source ?? starterSource(), String(profile.profileKey || profileKey), Number(profile.draftVersion || 0));
      window.history.replaceState({}, "", `./airstrike-animation-editor.php?profile=${encodeURIComponent(profileKey)}`);
      this.renderProfiles();
    } catch (error) {
      this.showFeedback(error instanceof Error ? error.message : String(error), "error");
      this.setStatus("Load failed");
    }
  }

  private createNewProfile(): void {
    if (this.state.dirty && !window.confirm("Discard local unsaved changes and start a new profile?")) {
      return;
    }
    this.loadSource(starterSource(), "", 0);
    window.history.replaceState({}, "", "./airstrike-animation-editor.php");
    this.renderProfiles();
  }

  private async saveDraft(): Promise<void> {
    let source: EditorSourceProfile;
    try {
      source = this.readCurrentSource();
    } catch (error) {
      this.showFeedback(error instanceof Error ? error.message : String(error), "error");
      return;
    }

    this.setStatus("Saving draft...");
    try {
      const path = this.state.baseVersion > 0 ? "save.php" : "create.php";
      const body =
        this.state.baseVersion > 0
          ? { profileKey: this.state.profileKey, baseVersion: this.state.baseVersion, source }
          : { source };
      const payload = await this.request(path, { method: "POST", body: JSON.stringify(body) });
      const profile = payload.profile as { source?: EditorSourceProfile; profileKey?: string; draftVersion?: number };
      this.loadSource(profile.source ?? source, String(profile.profileKey || source.ProfileKey), Number(profile.draftVersion || 0));
      try {
        window.localStorage.removeItem(this.recoveryKey());
      } catch {
        // Best effort.
      }
      await this.loadList();
      window.history.replaceState(
        {},
        "",
        `./airstrike-animation-editor.php?profile=${encodeURIComponent(String(profile.profileKey || source.ProfileKey))}`,
      );
      this.showFeedback(`Draft v${profile.draftVersion} saved.`, "success");
    } catch (error) {
      this.showFeedback(error instanceof Error ? error.message : String(error), "error");
      this.setStatus("Save failed");
    }
  }

  private async validateSource(): Promise<void> {
    let source: EditorSourceProfile;
    try {
      source = this.readCurrentSource();
    } catch (error) {
      this.showFeedback(error instanceof Error ? error.message : String(error), "error");
      return;
    }
    this.setStatus("Validating...");
    try {
      const payload = await this.request("validate.php", {
        method: "POST",
        body: JSON.stringify({ source }),
      });
      const validation = (payload.validation || {}) as { ok?: boolean; errors?: unknown[]; warnings?: unknown[] };
      const errors = Array.isArray(validation.errors) ? validation.errors : [];
      const warnings = Array.isArray(validation.warnings) ? validation.warnings : [];
      if (!validation.ok) {
        this.showFeedback(errors.map(formatValidationEntry).join("\n"), "error");
        this.setStatus(`${errors.length} validation error(s)`);
        return;
      }
      this.showFeedback(`Profile is valid.${warnings.length ? `\n${warnings.map(String).join("\n")}` : ""}`, "success");
      this.setStatus("Validation passed");
    } catch (error) {
      this.showFeedback(error instanceof Error ? error.message : String(error), "error");
      this.setStatus("Validation failed");
    }
  }

  private async compilePreview(): Promise<void> {
    let source: EditorSourceProfile;
    try {
      source = this.readCurrentSource();
    } catch (error) {
      this.showFeedback(error instanceof Error ? error.message : String(error), "error");
      return;
    }
    this.setStatus("Compiling canonical track...");
    try {
      const payload = await this.request("compile-preview.php", {
        method: "POST",
        body: JSON.stringify({ source }),
      });
      const compiled = (payload.compiled || {}) as { runtime?: { CompiledTrack?: { Frames?: unknown[] }; CompiledReleaseEvents?: unknown[] } };
      const runtime = compiled.runtime || {};
      const frames = Array.isArray(runtime.CompiledTrack?.Frames) ? runtime.CompiledTrack.Frames : [];
      const releases = Array.isArray(runtime.CompiledReleaseEvents) ? runtime.CompiledReleaseEvents : [];
      this.elements.compileSummary.textContent = `${frames.length} frames | ${releases.length} compiled payload units`;
      this.elements.output.textContent = JSON.stringify(compiled, null, 2);
      this.showFeedback("Compiled preview matches server-side publication logic.", "success");
      this.setStatus("Compile preview ready");
    } catch (error) {
      this.showFeedback(error instanceof Error ? error.message : String(error), "error");
      this.setStatus("Compile failed");
    }
  }

  private async publish(sync: boolean): Promise<void> {
    if (this.state.dirty) {
      this.showFeedback("Save the current draft before publishing the complete profile set.", "error");
      return;
    }
    if (!window.confirm(sync ? "Publish all active drafts and request server sync?" : "Publish all active drafts?")) {
      return;
    }
    this.setStatus("Publishing immutable bundle...");
    try {
      const payload = await this.request("publish.php", {
        method: "POST",
        body: JSON.stringify({ sync }),
      });
      const publication = (payload.publication || {}) as { revision?: unknown; rcon?: { ok?: boolean; message?: string } };
      this.showFeedback(
        `Published revision ${String(publication.revision || "")}.\n${publication.rcon?.message || ""}`,
        publication.rcon?.ok ? "success" : "error",
      );
      this.setStatus(`Published revision ${String(publication.revision || "")}`);
    } catch (error) {
      this.showFeedback(error instanceof Error ? error.message : String(error), "error");
      this.setStatus("Publish failed");
    }
  }
}

function collectElements(root: HTMLElement): EditorElements {
  return {
    root,
    state: query(root, "[data-editor-state]"),
    dirty: query(root, "[data-editor-dirty]"),
    title: query(root, "[data-editor-title]"),
    source: query(root, "[data-editor-source]"),
    key: query(root, "[data-editor-key]"),
    name: query(root, "[data-editor-name]"),
    vehicle: query(root, "[data-editor-vehicle]"),
    feedback: query(root, "[data-editor-feedback]"),
    output: query(root, "[data-editor-output]"),
    compileSummary: query(root, "[data-editor-compile-summary]"),
    list: query(root, "[data-editor-profile-list]"),
    search: query(root, "[data-editor-search]"),
    viewport: query(root, "[data-editor-viewport]"),
    timeRange: query(root, "[data-editor-time-range]"),
    timeNumber: query(root, "[data-editor-time-number]"),
    timeReadout: query(root, "[data-editor-time-readout]"),
    waypointList: query(root, "[data-editor-waypoints]"),
    waypointTitle: query(root, "[data-editor-waypoint-title]"),
    vehicleMeta: query(root, "[data-editor-vehicle-meta]"),
  };
}

const root = document.querySelector<HTMLElement>("[data-airstrike-editor]");
const config = readConfig();

if (root && config) {
  const app = new AirstrikeEditorApp(config, collectElements(root));
  void app.initialize();
}
