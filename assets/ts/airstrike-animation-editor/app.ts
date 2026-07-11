import { Vector3 } from "three";
import {
  AirstrikeViewport,
  type TerrainReferencePayload,
  type ViewOrientation,
  type ViewOrientationState,
  type WorldReference,
} from "./editor/viewport";
import {
  addManualRelease,
  availableHardpoints,
  deleteManualRelease,
  duplicateManualRelease,
  getReleasePreviewEvents,
  payloadOptions,
  PAYLOAD_ADVANCED_FIELDS,
  PAYLOAD_COMMON_FIELDS,
  updateManualPayloadField,
  updateManualReleaseHardpoint,
  updateManualReleaseTime,
  updateReleaseMode,
  updateRepeatedField,
  updateRepeatedHardpointSequence,
  updateRepeatedTemplateField,
  type PayloadField,
} from "./editor/release-source";
import {
  DEFAULT_TARGET_SPEED_METERS_PER_SECOND,
  formatMilesPerHour,
  inferWaypointSpeeds,
  normalizeWaypointTimes,
  setGlobalTargetSpeed,
  setWaypointTargetSpeed,
} from "./editor/speed-normalization";
import {
  addWaypointAtTime,
  deleteWaypoint,
  duplicateWaypoint,
  firstWaypointId,
  findWaypoint,
  updateWaypointField,
  updateWaypointPositionFromThree,
  WAYPOINT_FIELDS,
  type EditableWaypointField,
} from "./editor/waypoint-source";
import type { EditorSourceProfile, PayloadEventFields, SourcePayloadEvent, VehiclePreviewMetadataFile } from "./types";

interface EditorConfig {
  profileKey?: string;
  csrf?: string;
  apiBase?: string;
  assetBase?: string;
  serverStatusUrl?: string;
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
  waypointSpeed: HTMLInputElement;
  waypointSpeedMph: HTMLElement;
  addWaypoint: HTMLButtonElement;
  duplicateWaypoint: HTMLButtonElement;
  deleteWaypoint: HTMLButtonElement;
  globalSpeed: HTMLInputElement;
  globalSpeedMph: HTMLElement;
  releaseMode: HTMLSelectElement;
  manualReleaseList: HTMLElement;
  manualReleaseEditor: HTMLElement;
  repeatedReleaseEditor: HTMLElement;
  releaseTimeline: HTMLElement;
  vehicleMeta: HTMLElement;
  normalizeTimes: HTMLButtonElement;
  inferSpeeds: HTMLButtonElement;
  play: HTMLButtonElement;
  stepBack: HTMLButtonElement;
  stepForward: HTMLButtonElement;
  loop: HTMLInputElement;
  followVehicle: HTMLInputElement;
  rideVehicle: HTMLInputElement;
  sceneExtras: HTMLInputElement;
  terrainReference: HTMLInputElement;
  groundGrid: HTMLInputElement;
  releaseVisibility: HTMLSelectElement;
  addRelease: HTMLButtonElement;
  duplicateRelease: HTMLButtonElement;
  deleteRelease: HTMLButtonElement;
  frameRoute: HTMLButtonElement;
  frameVehicle: HTMLButtonElement;
  frameTarget: HTMLButtonElement;
}

interface EditorState {
  profiles: ProfileSummary[];
  profile: EditorSourceProfile | null;
  profileKey: string;
  baseVersion: number;
  dirty: boolean;
  loading: boolean;
  selectedWaypointId: string;
  selectedReleaseId: string;
  scrubTime: number;
  playing: boolean;
}

type PanelName = "left" | "right" | "bottom";

interface NumericControlRange {
  minimum: number;
  maximum: number;
}

interface PaletteLayout {
  collapsed?: Record<string, boolean>;
  zones?: Record<string, string[]>;
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
      {
        Id: "wp_001",
        Time: 0,
        X: 0,
        Y: 90,
        Z: -300,
        RotationX: 0,
        RotationY: 0,
        RotationZ: 0,
        TargetSpeedMetersPerSecond: DEFAULT_TARGET_SPEED_METERS_PER_SECOND,
      },
      {
        Id: "wp_002",
        Time: 3.5,
        X: 0,
        Y: 60,
        Z: 0,
        RotationX: -15,
        RotationY: 0,
        RotationZ: 0,
        TargetSpeedMetersPerSecond: DEFAULT_TARGET_SPEED_METERS_PER_SECOND,
      },
      {
        Id: "wp_003",
        Time: 8,
        X: 0,
        Y: 90,
        Z: 300,
        RotationX: 0,
        RotationY: 0,
        RotationZ: 0,
        TargetSpeedMetersPerSecond: DEFAULT_TARGET_SPEED_METERS_PER_SECOND,
      },
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
      GlobalTargetSpeedMetersPerSecond: DEFAULT_TARGET_SPEED_METERS_PER_SECOND,
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
    selectedReleaseId: "",
    scrubTime: 0,
    playing: false,
  };
  private readonly viewport: AirstrikeViewport;
  private metadata: VehiclePreviewMetadataFile | null = null;
  private playbackFrame = 0;
  private playbackStartedAt = 0;
  private playbackStartedTime = 0;
  private playbackRunId = 0;
  private paletteDragId = "";

  public constructor(config: EditorConfig, elements: EditorElements) {
    this.config = config;
    this.elements = elements;
    this.viewport = new AirstrikeViewport(elements.viewport, {
      assetBase: String(config.assetBase || "../assets/"),
      metadata: null,
      onSelectWaypoint: (waypointId) => this.selectWaypoint(waypointId),
      onWaypointMoved: (waypointId, position) => this.handleWaypointMoved(waypointId, position),
      onSelectRelease: (releaseId) => this.selectRelease(releaseId),
      onVehicleStatus: (status) => {
        const pieces = [status.modelState];
        if (status.prefabLabel) {
          pieces.push(status.prefabLabel);
        }
        this.elements.vehicleMeta.textContent = pieces.join(" | ");
      },
      onViewOrientation: (orientation) => this.updateOrientationWidget(orientation),
    });
    this.bindEvents();
    this.bindMenus();
    this.restorePanelState();
    this.initializePaletteDock();
    this.enhanceNumericControls();
  }

  public async initialize(): Promise<void> {
    try {
      this.metadata = await this.loadVehicleMetadata();
      this.viewport.updateMetadata(this.metadata);
      void this.loadWorldReference();
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
    this.elements.addWaypoint.addEventListener("click", () => this.handleAddWaypoint());
    this.elements.duplicateWaypoint.addEventListener("click", () => this.handleDuplicateWaypoint());
    this.elements.deleteWaypoint.addEventListener("click", () => this.handleDeleteWaypoint());
    this.elements.normalizeTimes.addEventListener("click", () => this.handleNormalizeTimes());
    this.elements.inferSpeeds.addEventListener("click", () => this.handleInferSpeeds());
    this.elements.play.addEventListener("click", () => this.togglePlayback());
    this.elements.stepBack.addEventListener("click", () => this.stepPlayback(-0.1));
    this.elements.stepForward.addEventListener("click", () => this.stepPlayback(0.1));
    this.elements.followVehicle.addEventListener("change", () => {
      if (this.elements.followVehicle.checked) {
        this.elements.rideVehicle.checked = false;
        this.viewport.setVehicleRideEnabled(false);
      }
      this.viewport.setVehicleFollowEnabled(this.elements.followVehicle.checked);
    });
    this.elements.rideVehicle.addEventListener("change", () => {
      if (this.elements.rideVehicle.checked) {
        this.elements.followVehicle.checked = false;
        this.viewport.setVehicleFollowEnabled(false);
      }
      this.viewport.setVehicleRideEnabled(this.elements.rideVehicle.checked);
    });
    this.elements.sceneExtras.addEventListener("change", () => {
      this.viewport.setSceneExtrasEnabled(this.elements.sceneExtras.checked);
    });
    this.elements.terrainReference.addEventListener("change", () => {
      this.viewport.setTerrainReferenceEnabled(this.elements.terrainReference.checked);
    });
    this.elements.groundGrid.addEventListener("change", () => {
      this.viewport.setGroundGridEnabled(this.elements.groundGrid.checked);
    });
    this.elements.releaseVisibility.addEventListener("change", () => this.handleReleaseVisibilityChange());
    this.elements.globalSpeed.addEventListener("input", () => this.handleGlobalSpeedInput());
    this.elements.waypointSpeed.addEventListener("input", () => this.handleWaypointSpeedInput());
    this.elements.releaseMode.addEventListener("change", () => this.handleReleaseModeChange());
    this.elements.addRelease.addEventListener("click", () => this.handleAddRelease());
    this.elements.duplicateRelease.addEventListener("click", () => this.handleDuplicateRelease());
    this.elements.deleteRelease.addEventListener("click", () => this.handleDeleteRelease());
    this.elements.frameRoute.addEventListener("click", () => this.viewport.frameRoute());
    this.elements.frameVehicle.addEventListener("click", () => this.viewport.frameVehicle());
    this.elements.frameTarget.addEventListener("click", () => this.viewport.frameTarget());
    this.elements.root.querySelectorAll<HTMLButtonElement>("[data-editor-orientation]").forEach((button) => {
      button.addEventListener("click", () => this.setViewportOrientation(String(button.dataset.editorOrientation || "")));
    });
    this.elements.root.querySelectorAll<HTMLButtonElement>("[data-editor-toggle-panel]").forEach((button) => {
      button.addEventListener("click", () => this.togglePanel(String(button.dataset.editorTogglePanel || "")));
    });
    this.elements.root.querySelectorAll("[data-editor-new]").forEach((button) => {
      button.addEventListener("click", () => this.createNewProfile());
    });
    this.elements.root.querySelectorAll("[data-editor-save]").forEach((button) => {
      button.addEventListener("click", () => void this.saveDraft());
    });
    this.elements.root.querySelectorAll("[data-editor-validate]").forEach((button) => {
      button.addEventListener("click", () => void this.validateSource());
    });
    this.elements.root.querySelectorAll("[data-editor-compile]").forEach((button) => {
      button.addEventListener("click", () => void this.compilePreview());
    });
    this.elements.root.querySelectorAll<HTMLButtonElement>("[data-editor-publish]").forEach((button) => {
      button.addEventListener("click", () => void this.publish(button.dataset.editorPublish === "sync"));
    });
    this.elements.root.querySelectorAll<HTMLButtonElement>("[data-editor-focus-palette]").forEach((button) => {
      button.addEventListener("click", () => this.focusPalette(String(button.dataset.editorFocusPalette || "")));
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

  private enhanceNumericControls(root: ParentNode = this.elements.root): void {
    root.querySelectorAll<HTMLInputElement>(".airstrike-editor-right input[type='number']").forEach((input) => {
      if (input.dataset.editorSliderEnhanced === "1") {
        this.syncNumericControl(input);
        return;
      }
      const parent = input.parentNode;
      if (!parent) {
        return;
      }
      const wrapper = document.createElement("div");
      const range = document.createElement("input");
      const stepDown = document.createElement("button");
      const stepUp = document.createElement("button");

      wrapper.className = "airstrike-number-control";
      range.type = "range";
      range.className = "airstrike-number-control-slider";
      stepDown.type = "button";
      stepDown.className = "airstrike-number-step airstrike-number-step-down";
      stepDown.textContent = "-";
      stepDown.title = "Decrease";
      stepDown.setAttribute("aria-label", "Decrease value");
      stepUp.type = "button";
      stepUp.className = "airstrike-number-step airstrike-number-step-up";
      stepUp.textContent = "+";
      stepUp.title = "Increase";
      stepUp.setAttribute("aria-label", "Increase value");

      parent.insertBefore(wrapper, input);
      wrapper.append(input, range, stepDown, stepUp);
      input.dataset.editorSliderEnhanced = "1";

      input.addEventListener("input", () => this.syncNumericControl(input));
      range.addEventListener("input", () => {
        input.value = range.value;
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
      stepDown.addEventListener("click", () => this.stepNumericInput(input, -1));
      stepUp.addEventListener("click", () => this.stepNumericInput(input, 1));
      this.syncNumericControl(input);
    });
  }

  private syncNumericControl(input: HTMLInputElement): void {
    const wrapper = input.closest<HTMLElement>(".airstrike-number-control");
    const range = wrapper?.querySelector<HTMLInputElement>(".airstrike-number-control-slider");
    const rangeBounds = this.numericRangeForInput(input);
    if (!range) {
      return;
    }
    const step = this.numericStep(input);
    range.min = String(rangeBounds.minimum);
    range.max = String(rangeBounds.maximum);
    range.step = String(step);
    range.disabled = input.disabled;
    const value = Number(input.value);
    if (Number.isFinite(value)) {
      range.value = String(clamp(value, rangeBounds.minimum, rangeBounds.maximum));
    }
    wrapper?.querySelectorAll<HTMLButtonElement>(".airstrike-number-step").forEach((button) => {
      button.disabled = input.disabled;
    });
  }

  private stepNumericInput(input: HTMLInputElement, direction: -1 | 1): void {
    if (input.disabled) {
      return;
    }
    const step = this.numericStep(input);
    const range = this.numericRangeForInput(input);
    const current = Number(input.value);
    const baseline = Number.isFinite(current) ? current : 0;
    const next = clamp(this.roundForStep(baseline + direction * step, step), range.minimum, range.maximum);
    input.value = String(next);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.focus();
  }

  private numericStep(input: HTMLInputElement): number {
    const step = Number(input.step);
    return Number.isFinite(step) && step > 0 ? step : 0.1;
  }

  private roundForStep(value: number, step: number): number {
    const decimals = Math.max(0, String(step).split(".")[1]?.length ?? 0);
    return Number(value.toFixed(Math.min(6, decimals + 1)));
  }

  private numericRangeForInput(input: HTMLInputElement): NumericControlRange {
    const explicitMinimum = Number(input.min);
    const explicitMaximum = Number(input.max);
    if (Number.isFinite(explicitMinimum) && Number.isFinite(explicitMaximum) && explicitMinimum < explicitMaximum) {
      return { minimum: explicitMinimum, maximum: explicitMaximum };
    }
    const waypointField = input.dataset.editorWaypointField;
    const current = Number(input.value);
    const duration = Math.max(0.01, Number(this.state.profile?.DurationSeconds ?? 30));
    const waypointRanges: Record<string, NumericControlRange> = {
      Time: { minimum: 0, maximum: Math.max(duration, Number.isFinite(current) ? current : 0) },
      X: { minimum: -500, maximum: 500 },
      Y: { minimum: 0, maximum: 500 },
      Z: { minimum: -500, maximum: 500 },
      RotationX: { minimum: -180, maximum: 180 },
      RotationY: { minimum: -180, maximum: 180 },
      RotationZ: { minimum: -180, maximum: 180 },
    };
    if (waypointField && waypointRanges[waypointField]) {
      return waypointRanges[waypointField];
    }
    const labelText = input.closest("label")?.querySelector("span")?.textContent?.trim() ?? "";
    const releaseRanges: Record<string, NumericControlRange> = {
      Time: { minimum: 0, maximum: duration },
      StartTime: { minimum: 0, maximum: duration },
      IntervalSeconds: { minimum: 0.01, maximum: 30 },
      UnitsPerRelease: { minimum: 1, maximum: 40 },
      MaximumUnits: { minimum: 1, maximum: 120 },
      Count: { minimum: 1, maximum: 40 },
      CarrierOffsetX: { minimum: -250, maximum: 250 },
      CarrierOffsetY: { minimum: -250, maximum: 250 },
      CarrierOffsetZ: { minimum: -250, maximum: 250 },
      TargetOffsetX: { minimum: -500, maximum: 500 },
      TargetOffsetY: { minimum: -500, maximum: 500 },
      TargetOffsetZ: { minimum: -500, maximum: 500 },
      SpreadRadius: { minimum: -1, maximum: 250 },
      LaunchSpeed: { minimum: -1, maximum: 350 },
      FuseSeconds: { minimum: -1, maximum: 120 },
      DamageScale: { minimum: 0, maximum: 10 },
      VehicleDamageScale: { minimum: -1, maximum: 10 },
      SplashRadius: { minimum: -1, maximum: 100 },
      ImpactRadius: { minimum: -1, maximum: 100 },
      MaxTrackingSeconds: { minimum: -1, maximum: 120 },
      MaxTrackingDistance: { minimum: -1, maximum: 2500 },
    };
    if (releaseRanges[labelText]) {
      return releaseRanges[labelText];
    }
    const fallback = Number.isFinite(current) ? current : 0;
    return { minimum: Math.min(-100, fallback - 100), maximum: Math.max(100, fallback + 100) };
  }

  private bindMenus(): void {
    const menus = Array.from(this.elements.root.querySelectorAll<HTMLDetailsElement>(".airstrike-editor-menu"));
    if (menus.length === 0) {
      return;
    }

    const closeMenus = (except?: HTMLDetailsElement): void => {
      menus.forEach((menu) => {
        if (menu !== except) {
          menu.open = false;
        }
      });
    };

    menus.forEach((menu) => {
      menu.addEventListener("toggle", () => {
        if (menu.open) {
          closeMenus(menu);
        }
      });
      menu.querySelectorAll<HTMLButtonElement | HTMLAnchorElement>("button, a").forEach((control) => {
        control.addEventListener("click", () => {
          window.setTimeout(() => closeMenus(), 0);
        });
      });
    });

    document.addEventListener("pointerdown", (event) => {
      const target = event.target;
      if (!(target instanceof Node) || menus.some((menu) => menu.contains(target))) {
        return;
      }
      closeMenus();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeMenus();
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
    this.ensureSelectedRelease(source);
    this.state.scrubTime = clamp(this.state.scrubTime, 0, Number(source.DurationSeconds || 0));
    this.writeSource(source);
    this.syncControlsFromSource(source);
    this.renderWaypoints();
    this.renderWaypointInspector();
    this.renderSpeedControls();
    this.renderReleaseControls();
    this.renderTimeControls();
    this.viewport.updateProfile(source, this.state.selectedWaypointId, this.state.scrubTime);
    this.handleReleaseVisibilityChange();
    this.viewport.updateSelectedRelease(this.state.selectedReleaseId);
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
    this.ensureSelectedRelease(source);
    this.state.scrubTime = clamp(this.state.scrubTime, 0, Number(source.DurationSeconds || 0));
    this.writeSource(source);
    this.syncControlsFromSource(source);
    this.renderWaypoints();
    this.renderWaypointInspector();
    this.renderSpeedControls();
    this.renderReleaseControls();
    this.renderTimeControls();
    if (refreshViewport) {
      this.viewport.updateProfile(source, this.state.selectedWaypointId, this.state.scrubTime);
      this.viewport.updateSelectedRelease(this.state.selectedReleaseId);
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
      const normalizedSource = inferWaypointSpeeds(source, false);
      this.state.profile = normalizedSource;
      this.state.selectedWaypointId = findWaypoint(source, this.state.selectedWaypointId)?.Id || firstWaypointId(source);
      this.ensureSelectedRelease(normalizedSource);
      this.writeSource(normalizedSource);
      this.syncControlsFromSource(normalizedSource);
      this.renderWaypoints();
      this.renderWaypointInspector();
      this.renderSpeedControls();
      this.renderReleaseControls();
      this.renderTimeControls();
      this.viewport.updateProfile(normalizedSource, this.state.selectedWaypointId, this.state.scrubTime);
      this.viewport.updateSelectedRelease(this.state.selectedReleaseId);
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
    this.elements.duplicateWaypoint.disabled = !waypoint;
    this.elements.deleteWaypoint.disabled = !waypoint || !profile || profile.Waypoints.length <= 2;
    this.elements.root.querySelectorAll<HTMLInputElement>("[data-editor-waypoint-field]").forEach((input) => {
      const field = input.dataset.editorWaypointField as EditableWaypointField | undefined;
      input.disabled = !waypoint || !field;
      input.value = waypoint && field ? String(waypoint[field]) : "";
    });
    this.enhanceNumericControls(this.elements.root.querySelector(".airstrike-waypoint-inspector") ?? this.elements.root);
  }

  private renderSpeedControls(): void {
    const profile = this.state.profile;
    const globalSpeed =
      profile?.EditorMetadata.GlobalTargetSpeedMetersPerSecond ?? DEFAULT_TARGET_SPEED_METERS_PER_SECOND;
    this.elements.globalSpeed.value = profile ? String(globalSpeed) : "";
    this.elements.globalSpeedMph.textContent = profile ? `${formatMilesPerHour(globalSpeed)} mph` : "";

    const waypoint = profile ? findWaypoint(profile, this.state.selectedWaypointId) : undefined;
    const waypointSpeed = waypoint?.TargetSpeedMetersPerSecond ?? globalSpeed;
    this.elements.waypointSpeed.disabled = !waypoint;
    this.elements.waypointSpeed.value = waypoint ? String(waypointSpeed) : "";
    this.elements.waypointSpeedMph.textContent = waypoint ? `${formatMilesPerHour(waypointSpeed)} mph` : "";
    this.enhanceNumericControls(this.elements.root);
  }

  private ensureSelectedRelease(profile: EditorSourceProfile): void {
    const releases = getReleasePreviewEvents(profile, this.metadata);
    if (!releases.some((release) => release.id === this.state.selectedReleaseId)) {
      this.state.selectedReleaseId = releases[0]?.id ?? "";
    }
  }

  private selectedManualRelease(): SourcePayloadEvent | undefined {
    const profile = this.state.profile;
    if (!profile || profile.ReleaseSource.Mode !== "manual") {
      return undefined;
    }
    return profile.ReleaseSource.Events.find((event) => event.Id === this.state.selectedReleaseId);
  }

  private renderReleaseControls(): void {
    const profile = this.state.profile;
    this.elements.releaseMode.value = profile?.ReleaseSource.Mode ?? "manual";
    this.elements.manualReleaseList.textContent = "";
    this.elements.manualReleaseEditor.textContent = "";
    this.elements.repeatedReleaseEditor.textContent = "";
    this.elements.addRelease.disabled = !profile;
    this.elements.duplicateRelease.disabled = !this.selectedManualRelease();
    this.elements.deleteRelease.disabled = !this.selectedManualRelease();
    if (!profile) {
      return;
    }
    if (profile.ReleaseSource.Mode === "manual") {
      this.renderManualReleaseList(profile);
      this.renderManualReleaseEditor(profile);
    } else {
      this.renderRepeatedReleaseEditor(profile);
    }
    this.enhanceNumericControls(this.elements.root);
  }

  private renderManualReleaseList(profile: EditorSourceProfile): void {
    if (profile.ReleaseSource.Mode !== "manual") {
      return;
    }
    if (profile.ReleaseSource.Events.length === 0) {
      const empty = document.createElement("p");
      empty.className = "airstrike-editor-muted";
      empty.textContent = "Legacy dynamic release path";
      this.elements.manualReleaseList.appendChild(empty);
      return;
    }
    for (const event of profile.ReleaseSource.Events) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `airstrike-release-row${event.Id === this.state.selectedReleaseId ? " is-active" : ""}`;
      button.textContent = `${event.Id}  ${event.Time.toFixed(2)}s  ${event.Payload || "payload"} x${event.Count}`;
      button.addEventListener("click", () => this.selectRelease(event.Id));
      this.elements.manualReleaseList.appendChild(button);
    }
  }

  private renderManualReleaseEditor(profile: EditorSourceProfile): void {
    const event = this.selectedManualRelease();
    if (!event) {
      return;
    }
    const title = document.createElement("h3");
    title.textContent = event.Id;
    this.elements.manualReleaseEditor.appendChild(title);

    const timeInput = this.createNumberInput(event.Time, 0.01, (value) => {
      const next = updateManualReleaseTime(profile, event.Id, value);
      this.applyProfile(next, true);
      this.selectRelease(event.Id);
    });
    this.elements.manualReleaseEditor.appendChild(this.fieldWrapper("Time", timeInput));

    const hardpointSelect = document.createElement("select");
    hardpointSelect.appendChild(new Option("Raw carrier offset", ""));
    for (const hardpoint of availableHardpoints(profile, this.metadata)) {
      hardpointSelect.appendChild(new Option(hardpoint.id, hardpoint.id));
    }
    hardpointSelect.value = event.HardpointId ?? "";
    hardpointSelect.addEventListener("change", () => {
      const next = updateManualReleaseHardpoint(profile, event.Id, hardpointSelect.value);
      this.applyProfile(next, true);
      this.selectRelease(event.Id);
    });
    this.elements.manualReleaseEditor.appendChild(this.fieldWrapper("Hardpoint", hardpointSelect));

    this.renderPayloadFieldGroup(this.elements.manualReleaseEditor, event, PAYLOAD_COMMON_FIELDS, (field, value) => {
      const next = updateManualPayloadField(profile, event.Id, field, value);
      this.applyProfile(next, true);
      this.selectRelease(event.Id);
    });

    const advanced = document.createElement("details");
    advanced.className = "airstrike-editor-advanced";
    const summary = document.createElement("summary");
    summary.textContent = "Advanced payload fields";
    advanced.appendChild(summary);
    this.renderPayloadFieldGroup(advanced, event, PAYLOAD_ADVANCED_FIELDS, (field, value) => {
      const next = updateManualPayloadField(profile, event.Id, field, value);
      this.applyProfile(next, true);
      this.selectRelease(event.Id);
    });
    this.elements.manualReleaseEditor.appendChild(advanced);
  }

  private renderRepeatedReleaseEditor(profile: EditorSourceProfile): void {
    if (profile.ReleaseSource.Mode !== "repeated") {
      return;
    }
    const release = profile.ReleaseSource;
    for (const [field, step] of [
      ["StartTime", 0.01],
      ["IntervalSeconds", 0.01],
      ["UnitsPerRelease", 1],
      ["MaximumUnits", 1],
    ] as const) {
      const input = this.createNumberInput(release[field], step, (value) => {
        this.applyProfile(updateRepeatedField(profile, field, value), true);
      });
      this.elements.repeatedReleaseEditor.appendChild(this.fieldWrapper(field, input));
    }

    const sequence = document.createElement("input");
    sequence.type = "text";
    sequence.value = release.HardpointSequence.join(", ");
    sequence.placeholder = availableHardpoints(profile, this.metadata).map((hardpoint) => hardpoint.id).join(", ");
    sequence.addEventListener("change", () => {
      this.applyProfile(
        updateRepeatedHardpointSequence(
          profile,
          sequence.value.split(",").map((entry) => entry.trim()).filter(Boolean),
        ),
        true,
      );
    });
    this.elements.repeatedReleaseEditor.appendChild(this.fieldWrapper("Hardpoint sequence", sequence));

    this.renderPayloadFieldGroup(this.elements.repeatedReleaseEditor, release.Template, PAYLOAD_COMMON_FIELDS, (field, value) => {
      this.applyProfile(updateRepeatedTemplateField(profile, field, value), true);
    });

    const advanced = document.createElement("details");
    advanced.className = "airstrike-editor-advanced";
    const summary = document.createElement("summary");
    summary.textContent = "Advanced payload fields";
    advanced.appendChild(summary);
    this.renderPayloadFieldGroup(advanced, release.Template, PAYLOAD_ADVANCED_FIELDS, (field, value) => {
      this.applyProfile(updateRepeatedTemplateField(profile, field, value), true);
    });
    this.elements.repeatedReleaseEditor.appendChild(advanced);
  }

  private renderPayloadFieldGroup(
    parent: HTMLElement,
    fields: PayloadEventFields,
    fieldNames: readonly PayloadField[],
    onChange: (field: PayloadField, value: string | number | Record<string, number>) => void,
  ): void {
    const grid = document.createElement("div");
    grid.className = "airstrike-payload-field-grid";
    for (const field of fieldNames) {
      if (field === "Payload") {
        const select = document.createElement("select");
        for (const payload of payloadOptions()) {
          select.appendChild(new Option(payload, payload));
        }
        select.value = fields.Payload;
        select.addEventListener("change", () => onChange(field, select.value));
        grid.appendChild(this.fieldWrapper(field, select));
      } else if (field === "DamageScales") {
        const input = document.createElement("textarea");
        input.rows = 3;
        input.spellcheck = false;
        input.value = JSON.stringify(fields.DamageScales ?? {});
        input.addEventListener("change", () => {
          try {
            const parsed = JSON.parse(input.value || "{}") as Record<string, number>;
            onChange(field, parsed);
          } catch {
            this.showFeedback("DamageScales must be valid JSON.", "error");
          }
        });
        grid.appendChild(this.fieldWrapper(field, input));
      } else {
        const input = this.createNumberInput(Number(fields[field]), field === "Count" ? 1 : 0.1, (value) => {
          onChange(field, value);
        });
        grid.appendChild(this.fieldWrapper(field, input));
      }
    }
    parent.appendChild(grid);
  }

  private createNumberInput(value: number, step: number, onInput: (value: number) => void): HTMLInputElement {
    const input = document.createElement("input");
    input.type = "number";
    input.step = String(step);
    input.value = String(value);
    input.addEventListener("input", () => {
      const next = Number(input.value);
      if (Number.isFinite(next)) {
        onInput(next);
      }
    });
    return input;
  }

  private fieldWrapper(labelText: string, control: HTMLElement): HTMLLabelElement {
    const label = document.createElement("label");
    label.className = "admin-field";
    const text = document.createElement("span");
    text.textContent = labelText;
    label.append(text, control);
    return label;
  }

  private renderReleaseTimeline(): void {
    const profile = this.state.profile;
    this.elements.releaseTimeline.textContent = "";
    if (!profile) {
      return;
    }
    const track = document.createElement("div");
    track.className = "airstrike-release-track";
    const cursor = document.createElement("span");
    cursor.className = "airstrike-release-cursor";
    cursor.style.left = `${(this.state.scrubTime / Math.max(0.01, profile.DurationSeconds)) * 100}%`;
    track.appendChild(cursor);
    for (const release of getReleasePreviewEvents(profile, this.metadata)) {
      const marker = document.createElement("button");
      marker.type = "button";
      marker.className = `airstrike-release-marker${release.id === this.state.selectedReleaseId ? " is-active" : ""}`;
      marker.style.left = `${(release.time / Math.max(0.01, profile.DurationSeconds)) * 100}%`;
      marker.title = `${release.id} ${release.time.toFixed(2)}s`;
      marker.addEventListener("click", () => this.selectRelease(release.id));
      if (release.editable && release.sourceId) {
        marker.addEventListener("pointerdown", (event) => {
          event.preventDefault();
          const move = (moveEvent: PointerEvent): void => {
            const source = this.state.profile ?? profile;
            const bounds = track.getBoundingClientRect();
            const progress = clamp((moveEvent.clientX - bounds.left) / Math.max(1, bounds.width), 0, 1);
            const next = updateManualReleaseTime(source, release.sourceId!, progress * source.DurationSeconds);
            this.applyProfile(next, true);
            this.selectRelease(release.sourceId!);
          };
          const stop = (): void => {
            window.removeEventListener("pointermove", move);
            window.removeEventListener("pointerup", stop);
            window.removeEventListener("pointercancel", stop);
          };
          window.addEventListener("pointermove", move);
          window.addEventListener("pointerup", stop);
          window.addEventListener("pointercancel", stop);
        });
      }
      track.appendChild(marker);
    }
    this.elements.releaseTimeline.appendChild(track);
  }

  private renderTimeControls(): void {
    const duration = Math.max(0.01, Number(this.state.profile?.DurationSeconds || 0.01));
    this.state.scrubTime = clamp(this.state.scrubTime, 0, duration);
    this.elements.timeRange.max = String(duration);
    this.elements.timeRange.value = String(this.state.scrubTime);
    this.elements.timeNumber.max = String(duration);
    this.elements.timeNumber.value = this.state.scrubTime.toFixed(2);
    this.elements.timeReadout.textContent = `${this.state.scrubTime.toFixed(2)}s / ${duration.toFixed(2)}s`;
    this.elements.play.textContent = this.state.playing ? "Pause" : "Play";
    this.elements.play.dataset.icon = this.state.playing ? "Ⅱ" : "▶";
    this.elements.play.ariaLabel = this.state.playing ? "Pause" : "Play";
    this.elements.play.title = this.state.playing ? "Pause" : "Play";
    this.renderReleaseTimeline();
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
    this.renderSpeedControls();
    this.viewport.updateSelectedWaypoint(waypointId);
  }

  private selectRelease(releaseId: string): void {
    this.state.selectedReleaseId = releaseId;
    this.renderReleaseControls();
    this.renderReleaseTimeline();
    this.viewport.updateSelectedRelease(releaseId);
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

  private handleAddWaypoint(): void {
    if (!this.state.profile) {
      return;
    }
    const result = addWaypointAtTime(this.state.profile, this.state.scrubTime);
    this.applyProfile(result.profile, true);
    this.selectWaypoint(result.waypointId);
  }

  private handleDuplicateWaypoint(): void {
    if (!this.state.profile || !this.state.selectedWaypointId) {
      return;
    }
    const result = duplicateWaypoint(this.state.profile, this.state.selectedWaypointId);
    this.applyProfile(result.profile, true);
    if (result.waypointId) {
      this.selectWaypoint(result.waypointId);
      const duplicated = findWaypoint(result.profile, result.waypointId);
      if (duplicated) {
        this.setScrubTime(duplicated.Time);
      }
    }
  }

  private handleDeleteWaypoint(): void {
    if (!this.state.profile || !this.state.selectedWaypointId) {
      return;
    }
    if (this.state.profile.Waypoints.length <= 2) {
      this.showFeedback("A route needs at least two waypoints.", "error");
      return;
    }
    const deletedId = this.state.selectedWaypointId;
    const next = deleteWaypoint(this.state.profile, deletedId);
    this.applyProfile(next, true);
    this.selectWaypoint(this.state.selectedWaypointId);
  }

  private handleNormalizeTimes(): void {
    if (!this.state.profile) {
      return;
    }
    this.applyProfile(normalizeWaypointTimes(this.state.profile), true);
  }

  private handleInferSpeeds(): void {
    if (!this.state.profile) {
      return;
    }
    this.applyProfile(inferWaypointSpeeds(this.state.profile), true);
    this.showFeedback("Waypoint speeds were inferred from current route times.", "success");
  }

  private togglePlayback(): void {
    if (this.state.playing) {
      this.stopPlayback();
      return;
    }
    this.startPlayback();
  }

  private startPlayback(): void {
    if (!this.state.profile) {
      return;
    }
    this.playbackRunId += 1;
    const runId = this.playbackRunId;
    this.state.playing = true;
    this.viewport.setPlaybackActive(true);
    this.playbackStartedAt = performance.now();
    this.playbackStartedTime = this.state.scrubTime;
    this.renderTimeControls();
    const tick = (now: number): void => {
      if (!this.state.playing || runId !== this.playbackRunId || !this.state.profile) {
        return;
      }
      const duration = Math.max(0.01, this.state.profile.DurationSeconds);
      let next = this.playbackStartedTime + (now - this.playbackStartedAt) / 1000;
      if (next >= duration) {
        if (this.elements.loop.checked) {
          next %= duration;
          this.playbackStartedAt = now;
          this.playbackStartedTime = next;
        } else {
          next = duration;
          this.setScrubTime(next);
          this.stopPlayback();
          return;
        }
      }
      this.setScrubTime(next);
      if (this.state.playing && runId === this.playbackRunId) {
        this.playbackFrame = window.requestAnimationFrame(tick);
      }
    };
    this.playbackFrame = window.requestAnimationFrame(tick);
  }

  private stopPlayback(): void {
    this.playbackRunId += 1;
    this.state.playing = false;
    this.viewport.setPlaybackActive(false);
    if (this.playbackFrame) {
      window.cancelAnimationFrame(this.playbackFrame);
      this.playbackFrame = 0;
    }
    this.renderTimeControls();
  }

  private stepPlayback(deltaSeconds: number): void {
    this.stopPlayback();
    this.setScrubTime(this.state.scrubTime + deltaSeconds);
  }

  private handleReleaseVisibilityChange(): void {
    const mode = this.elements.releaseVisibility.value;
    this.viewport.updateReleaseVisibilityMode(
      mode === "all" || mode === "selected" || mode === "current" ? mode : "near",
    );
  }

  private setViewportOrientation(value: string): void {
    const orientations: ViewOrientation[] = ["iso", "top", "bottom", "front", "back", "left", "right"];
    if (orientations.includes(value as ViewOrientation)) {
      this.viewport.setOrientation(value as ViewOrientation);
    }
  }

  private updateOrientationWidget(orientation: ViewOrientationState): void {
    const widget = this.elements.root.querySelector<HTMLElement>(".airstrike-editor-orientation");
    if (!widget) {
      return;
    }
    const labels: Record<ViewOrientation, string> = {
      iso: "Home",
      top: "Top",
      bottom: "Bottom",
      front: "Front",
      back: "Back",
      left: "Left",
      right: "Right",
    };
    const sideTargets = this.orientationSideTargets(orientation.current);
    widget.style.setProperty("--orientation-yaw", `${orientation.yawDegrees.toFixed(1)}deg`);
    widget.style.setProperty("--orientation-pitch", `${orientation.pitchDegrees.toFixed(1)}deg`);
    widget.dataset.currentOrientation = orientation.current;
    widget.dataset.currentLabel = labels[orientation.current];
    const cube = widget.querySelector<HTMLButtonElement>(".airstrike-editor-orientation-cube");
    if (cube) {
      cube.dataset.currentLabel = labels[orientation.current];
    }
    for (const [position, target] of Object.entries(sideTargets)) {
      const button = widget.querySelector<HTMLButtonElement>(`.airstrike-editor-orientation-face-${position}`);
      if (!button) {
        continue;
      }
      button.dataset.editorOrientation = target;
      button.textContent = labels[target];
      button.setAttribute("aria-label", `${labels[target]} view`);
      button.setAttribute("title", `${labels[target]} view`);
    }
  }

  private orientationSideTargets(current: Exclude<ViewOrientation, "iso">): Record<string, Exclude<ViewOrientation, "iso">> {
    const targets: Record<Exclude<ViewOrientation, "iso">, Record<string, Exclude<ViewOrientation, "iso">>> = {
      front: { top: "top", left: "left", right: "right", front: "front", bottom: "bottom", back: "back" },
      back: { top: "top", left: "right", right: "left", front: "back", bottom: "bottom", back: "front" },
      right: { top: "top", left: "front", right: "back", front: "right", bottom: "bottom", back: "left" },
      left: { top: "top", left: "back", right: "front", front: "left", bottom: "bottom", back: "right" },
      top: { top: "back", left: "left", right: "right", front: "top", bottom: "front", back: "bottom" },
      bottom: { top: "front", left: "left", right: "right", front: "bottom", bottom: "back", back: "top" },
    };
    return targets[current];
  }

  private handleGlobalSpeedInput(): void {
    if (!this.state.profile) {
      return;
    }
    const value = Number(this.elements.globalSpeed.value);
    if (!Number.isFinite(value) || value <= 0) {
      return;
    }
    this.applyProfile(setGlobalTargetSpeed(this.state.profile, value), true);
  }

  private handleWaypointSpeedInput(): void {
    if (!this.state.profile || !this.state.selectedWaypointId) {
      return;
    }
    const value = Number(this.elements.waypointSpeed.value);
    if (!Number.isFinite(value) || value <= 0) {
      return;
    }
    this.applyProfile(setWaypointTargetSpeed(this.state.profile, this.state.selectedWaypointId, value), true);
  }

  private handleReleaseModeChange(): void {
    if (!this.state.profile) {
      return;
    }
    const mode = this.elements.releaseMode.value === "repeated" ? "repeated" : "manual";
    this.applyProfile(updateReleaseMode(this.state.profile, mode), true);
  }

  private handleAddRelease(): void {
    if (!this.state.profile) {
      return;
    }
    const result = addManualRelease(this.state.profile, this.state.scrubTime);
    this.applyProfile(result.profile, true);
    this.selectRelease(result.releaseId);
  }

  private handleDuplicateRelease(): void {
    if (!this.state.profile || !this.state.selectedReleaseId) {
      return;
    }
    const result = duplicateManualRelease(this.state.profile, this.state.selectedReleaseId);
    this.applyProfile(result.profile, true);
    this.selectRelease(result.releaseId);
  }

  private handleDeleteRelease(): void {
    if (!this.state.profile || !this.state.selectedReleaseId) {
      return;
    }
    this.applyProfile(deleteManualRelease(this.state.profile, this.state.selectedReleaseId), true);
  }

  private togglePanel(panel: string): void {
    if (!this.isPanelName(panel)) {
      return;
    }
    this.setPanelCollapsed(panel, !this.elements.root.classList.contains(`is-${panel}-collapsed`));
    this.savePanelState();
  }

  private isPanelName(panel: string): panel is PanelName {
    return panel === "left" || panel === "right" || panel === "bottom";
  }

  private panelStateStorageKey(): string {
    return "raidlands.airstrike-animation-editor.panels";
  }

  private paletteLayoutStorageKey(): string {
    return "raidlands.airstrike-animation-editor.palette-layout";
  }

  private restorePanelState(): void {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(this.panelStateStorageKey()) || "{}") as Record<string, unknown>;
      for (const panel of ["left", "right", "bottom"] as const) {
        this.setPanelCollapsed(panel, parsed[panel] === true, false);
      }
    } catch {
      for (const panel of ["left", "right", "bottom"] as const) {
        this.updatePanelToggleButtons(panel);
      }
    }
  }

  private savePanelState(): void {
    try {
      window.localStorage.setItem(
        this.panelStateStorageKey(),
        JSON.stringify({
          left: this.elements.root.classList.contains("is-left-collapsed"),
          right: this.elements.root.classList.contains("is-right-collapsed"),
          bottom: this.elements.root.classList.contains("is-bottom-collapsed"),
        }),
      );
    } catch {
      // Panel preferences are helpful but not required for editing.
    }
  }

  private setPanelCollapsed(panel: PanelName, collapsed: boolean, resize = true): void {
    this.elements.root.classList.toggle(`is-${panel}-collapsed`, collapsed);
    this.updatePanelToggleButtons(panel);
    if (resize) {
      window.setTimeout(() => window.dispatchEvent(new Event("resize")), 210);
    }
  }

  private updatePanelToggleButtons(panel: PanelName): void {
    const collapsed = this.elements.root.classList.contains(`is-${panel}-collapsed`);
    this.elements.root.querySelectorAll<HTMLButtonElement>(`[data-editor-toggle-panel="${panel}"]`).forEach((button) => {
      button.setAttribute("aria-pressed", collapsed ? "true" : "false");
      button.classList.toggle("is-active", !collapsed);
    });
  }

  private initializePaletteDock(): void {
    this.applyStoredPaletteLayout();
    const palettes = this.paletteElements();
    const zones = this.paletteZones();

    palettes.forEach((palette) => {
      palette.draggable = false;
      palette.addEventListener("dragstart", (event) => this.handlePaletteDragStart(event, palette));
      palette.addEventListener("dragend", () => this.handlePaletteDragEnd(palette));
      palette.querySelector<HTMLElement>("[data-editor-palette-drag]")?.addEventListener("pointerdown", (event) => {
        this.handlePalettePointerDown(event, palette);
      });
      palette.addEventListener("toggle", () => {
        this.updatePaletteCollapseButton(palette);
        this.savePaletteLayout();
      });
      palette.querySelector<HTMLButtonElement>("[data-editor-palette-collapse]")?.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        palette.open = !palette.open;
      });
      this.updatePaletteCollapseButton(palette);
    });

    zones.forEach((zone) => {
      zone.addEventListener("dragover", (event) => this.handlePaletteDragOver(event, zone));
      zone.addEventListener("dragleave", () => zone.classList.remove("is-palette-over"));
      zone.addEventListener("drop", (event) => {
        event.preventDefault();
        zone.classList.remove("is-palette-over");
        this.savePaletteLayout();
      });
    });
  }

  private paletteElements(): HTMLDetailsElement[] {
    return Array.from(this.elements.root.querySelectorAll<HTMLDetailsElement>("[data-editor-palette]"));
  }

  private paletteZones(): HTMLElement[] {
    return Array.from(this.elements.root.querySelectorAll<HTMLElement>("[data-editor-palette-zone]"));
  }

  private paletteId(palette: HTMLElement): string {
    return String(palette.dataset.editorPalette || "");
  }

  private applyStoredPaletteLayout(): void {
    const layout = this.readStoredPaletteLayout();
    const paletteById = new Map(this.paletteElements().map((palette) => [this.paletteId(palette), palette]));
    const zoneById = new Map(this.paletteZones().map((zone) => [String(zone.dataset.editorPaletteZone || ""), zone]));

    for (const [zoneId, paletteIds] of Object.entries(layout.zones || {})) {
      const zone = zoneById.get(zoneId);
      if (!zone || !Array.isArray(paletteIds)) {
        continue;
      }
      for (const paletteId of paletteIds) {
        const palette = paletteById.get(String(paletteId));
        if (palette) {
          zone.appendChild(palette);
        }
      }
    }

    for (const palette of this.paletteElements()) {
      const id = this.paletteId(palette);
      if (id && layout.collapsed && Object.prototype.hasOwnProperty.call(layout.collapsed, id)) {
        palette.open = layout.collapsed[id] !== true;
      }
    }
  }

  private readStoredPaletteLayout(): PaletteLayout {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(this.paletteLayoutStorageKey()) || "{}") as PaletteLayout;
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  private savePaletteLayout(): void {
    const collapsed: Record<string, boolean> = {};
    const zones: Record<string, string[]> = {};

    for (const palette of this.paletteElements()) {
      const id = this.paletteId(palette);
      if (id) {
        collapsed[id] = !palette.open;
      }
    }

    for (const zone of this.paletteZones()) {
      const zoneId = String(zone.dataset.editorPaletteZone || "");
      if (!zoneId) {
        continue;
      }
      zones[zoneId] = Array.from(zone.children)
        .filter((child): child is HTMLElement => child instanceof HTMLElement && child.matches("[data-editor-palette]"))
        .map((child) => this.paletteId(child))
        .filter(Boolean);
    }

    try {
      window.localStorage.setItem(this.paletteLayoutStorageKey(), JSON.stringify({ collapsed, zones }));
    } catch {
      // Palette layout persistence is optional.
    }
  }

  private updatePaletteCollapseButton(palette: HTMLDetailsElement): void {
    const button = palette.querySelector<HTMLButtonElement>("[data-editor-palette-collapse]");
    if (!button) {
      return;
    }
    button.setAttribute("aria-expanded", palette.open ? "true" : "false");
    button.setAttribute("title", palette.open ? "Minimize panel" : "Open panel");
  }

  private handlePaletteDragStart(event: DragEvent, palette: HTMLDetailsElement): void {
    const id = this.paletteId(palette);
    if (!id) {
      event.preventDefault();
      return;
    }
    this.paletteDragId = id;
    palette.classList.add("is-dragging");
    event.dataTransfer?.setData("text/plain", id);
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "move";
    }
  }

  private handlePaletteDragEnd(palette: HTMLDetailsElement): void {
    palette.classList.remove("is-dragging");
    this.paletteDragId = "";
    this.paletteZones().forEach((zone) => zone.classList.remove("is-palette-over"));
    this.savePaletteLayout();
  }

  private handlePaletteDragOver(event: DragEvent, zone: HTMLElement): void {
    const dragged = this.elements.root.querySelector<HTMLDetailsElement>(
      `[data-editor-palette="${CSS.escape(this.paletteDragId)}"]`,
    );
    if (!dragged) {
      return;
    }
    event.preventDefault();
    zone.classList.add("is-palette-over");
    const after = this.paletteAfterPointer(zone, event.clientY);
    if (after) {
      zone.insertBefore(dragged, after);
    } else {
      zone.appendChild(dragged);
    }
  }

  private handlePalettePointerDown(event: PointerEvent, palette: HTMLDetailsElement): void {
    const id = this.paletteId(palette);
    if (!id || event.button !== 0) {
      return;
    }
    event.preventDefault();
    this.paletteDragId = id;
    palette.classList.add("is-dragging");

    const move = (moveEvent: PointerEvent): void => {
      moveEvent.preventDefault();
      const zone = this.paletteZoneAtPointer(moveEvent.clientX, moveEvent.clientY);
      this.paletteZones().forEach((candidate) => candidate.classList.toggle("is-palette-over", candidate === zone));
      if (!zone) {
        return;
      }
      const after = this.paletteAfterPointer(zone, moveEvent.clientY);
      if (after) {
        zone.insertBefore(palette, after);
      } else {
        zone.appendChild(palette);
      }
    };

    const stop = (): void => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
      palette.classList.remove("is-dragging");
      this.paletteDragId = "";
      this.paletteZones().forEach((zone) => zone.classList.remove("is-palette-over"));
      this.savePaletteLayout();
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
  }

  private paletteZoneAtPointer(clientX: number, clientY: number): HTMLElement | null {
    return (
      this.paletteZones().find((zone) => {
        const box = zone.getBoundingClientRect();
        return clientX >= box.left && clientX <= box.right && clientY >= box.top && clientY <= box.bottom;
      }) || null
    );
  }

  private paletteAfterPointer(zone: HTMLElement, clientY: number): HTMLElement | null {
    const palettes = Array.from(zone.children).filter((child): child is HTMLElement => {
      return child instanceof HTMLElement && child.matches("[data-editor-palette]:not(.is-dragging)");
    });
    let closest: { offset: number; element: HTMLElement | null } = { offset: Number.NEGATIVE_INFINITY, element: null };
    for (const palette of palettes) {
      const box = palette.getBoundingClientRect();
      const offset = clientY - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        closest = { offset, element: palette };
      }
    }
    return closest.element;
  }

  private focusPalette(paletteId: string): void {
    if (!paletteId) {
      return;
    }
    this.setPanelCollapsed("right", false);
    const palette = this.elements.root.querySelector<HTMLDetailsElement>(`[data-editor-palette="${CSS.escape(paletteId)}"]`);
    if (!palette) {
      return;
    }
    palette.open = true;
    palette.scrollIntoView({ behavior: "smooth", block: "nearest" });
    palette.classList.add("is-focused");
    window.setTimeout(() => palette.classList.remove("is-focused"), 900);
  }

  private async loadList(): Promise<void> {
    const payload = await this.request("list.php?include_archived=0", { method: "GET" });
    this.state.profiles = Array.isArray(payload.profiles) ? (payload.profiles as ProfileSummary[]) : [];
    this.renderProfiles();
  }

  private async loadWorldReference(): Promise<void> {
    const statusUrl = String(this.config.serverStatusUrl || "../api/server-status.php");
    try {
      const response = await fetch(statusUrl, {
        headers: { Accept: "application/json" },
        credentials: "same-origin",
      });
      if (!response.ok) {
        return;
      }
      const payload = (await response.json()) as {
        seed?: unknown;
        worldSize?: unknown;
        mapName?: unknown;
        mapImageUrl?: unknown;
        mapImage?: { url?: unknown; publicUrl?: unknown; textureUrl?: unknown; terrainUrl?: unknown; heightmapUrl?: unknown };
      };
      const terrainUrl =
        typeof payload.mapImage?.terrainUrl === "string"
          ? payload.mapImage.terrainUrl
          : typeof payload.mapImage?.heightmapUrl === "string"
            ? payload.mapImage.heightmapUrl
            : "";
      const reference: Partial<WorldReference> = {
        seed: Number(payload.seed || 0),
        worldSize: Number(payload.worldSize || 0),
        mapName: typeof payload.mapName === "string" ? payload.mapName : "",
        mapImageUrl:
          typeof payload.mapImage?.textureUrl === "string"
            ? payload.mapImage.textureUrl
            : typeof payload.mapImageUrl === "string"
            ? payload.mapImageUrl
            : typeof payload.mapImage?.url === "string"
              ? payload.mapImage.url
              : typeof payload.mapImage?.publicUrl === "string"
                ? payload.mapImage.publicUrl
                : "",
        terrainUrl,
        heightmapUrl: terrainUrl,
      };
      if (terrainUrl) {
        const terrain = await this.loadTerrainReference(terrainUrl);
        if (terrain) {
          reference.terrain = terrain;
          reference.worldSize = terrain.worldSize || reference.worldSize;
          reference.seed = terrain.seed || reference.seed;
        }
      }
      this.viewport.updateWorldReference(reference);
    } catch {
      // Offline/local editor sessions keep the default deterministic terrain.
    }
  }

  private async loadTerrainReference(url: string): Promise<TerrainReferencePayload | null> {
    try {
      const response = await fetch(url, {
        cache: "no-store",
        headers: { Accept: "application/json" },
        credentials: "same-origin",
      });
      if (!response.ok) {
        return null;
      }
      const payload = (await response.json()) as Partial<TerrainReferencePayload>;
      const resolution = Math.max(2, Math.min(257, Math.floor(Number(payload.resolution) || 0)));
      const heights = Array.isArray(payload.heights) ? payload.heights.map((height) => Number(height)) : [];
      const expected = resolution * resolution;
      if (resolution < 2 || heights.length !== expected || heights.some((height) => !Number.isFinite(height))) {
        return null;
      }
      const worldSize = Number(payload.worldSize);
      if (!Number.isFinite(worldSize) || worldSize <= 0) {
        return null;
      }
      const colors =
        Array.isArray(payload.colors) && payload.colors.length === expected
          ? payload.colors.map((color) => String(color))
          : undefined;
      return {
        resolution,
        worldSize,
        seed: Number(payload.seed) || 0,
        waterLevel: Number(payload.waterLevel) || 0,
        minHeight: Number.isFinite(Number(payload.minHeight)) ? Number(payload.minHeight) : Math.min(...heights),
        maxHeight: Number.isFinite(Number(payload.maxHeight)) ? Number(payload.maxHeight) : Math.max(...heights),
        heights,
        colors,
      };
    } catch {
      return null;
    }
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
    waypointSpeed: query(root, "[data-editor-waypoint-speed]"),
    waypointSpeedMph: query(root, "[data-editor-waypoint-speed-mph]"),
    addWaypoint: query(root, "[data-editor-waypoint-add]"),
    duplicateWaypoint: query(root, "[data-editor-waypoint-duplicate]"),
    deleteWaypoint: query(root, "[data-editor-waypoint-delete]"),
    globalSpeed: query(root, "[data-editor-global-speed]"),
    globalSpeedMph: query(root, "[data-editor-global-speed-mph]"),
    releaseMode: query(root, "[data-editor-release-mode]"),
    manualReleaseList: query(root, "[data-editor-manual-releases]"),
    manualReleaseEditor: query(root, "[data-editor-manual-editor]"),
    repeatedReleaseEditor: query(root, "[data-editor-repeated-editor]"),
    releaseTimeline: query(root, "[data-editor-release-timeline]"),
    vehicleMeta: query(root, "[data-editor-vehicle-meta]"),
    normalizeTimes: query(root, "[data-editor-normalize-times]"),
    inferSpeeds: query(root, "[data-editor-infer-speeds]"),
    play: query(root, "[data-editor-play]"),
    stepBack: query(root, "[data-editor-step-back]"),
    stepForward: query(root, "[data-editor-step-forward]"),
    loop: query(root, "[data-editor-loop]"),
    followVehicle: query(root, "[data-editor-follow-vehicle]"),
    rideVehicle: query(root, "[data-editor-ride-vehicle]"),
    sceneExtras: query(root, "[data-editor-scene-extras]"),
    terrainReference: query(root, "[data-editor-terrain-reference]"),
    groundGrid: query(root, "[data-editor-ground-grid]"),
    releaseVisibility: query(root, "[data-editor-release-visibility]"),
    addRelease: query(root, "[data-editor-release-add]"),
    duplicateRelease: query(root, "[data-editor-release-duplicate]"),
    deleteRelease: query(root, "[data-editor-release-delete]"),
    frameRoute: query(root, "[data-editor-frame-route]"),
    frameVehicle: query(root, "[data-editor-frame-vehicle]"),
    frameTarget: query(root, "[data-editor-frame-target]"),
  };
}

const root = document.querySelector<HTMLElement>("[data-airstrike-editor]");
const config = readConfig();

if (root && config) {
  const app = new AirstrikeEditorApp(config, collectElements(root));
  void app.initialize();
}
