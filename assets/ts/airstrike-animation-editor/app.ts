import { Vector3 } from "three";
import {
  AirstrikeViewport,
  type MonumentReferencePayload,
  type TerrainReferencePayload,
  type ViewOrientation,
  type ViewOrientationState,
  type WorldReference,
} from "./editor/viewport";
import {
  addManualRelease,
  addRepeatedReleaseGroup,
  availableHardpoints,
  deleteManualRelease,
  deleteRepeatedReleaseGroup,
  duplicateManualRelease,
  duplicateRepeatedReleaseGroup,
  effectiveAccuracyRadius,
  getReleasePreviewEvents,
  getRepeatedReleaseGroups,
  payloadOptions,
  PAYLOAD_ADVANCED_TARGET_FIELDS,
  PAYLOAD_ADVANCED_FIELDS,
  PAYLOAD_COMMON_FIELDS,
  PAYLOAD_SIMPLE_TARGET_FIELDS,
  normalizeProfilePayloadTargeting,
  updateManualPayloadField,
  updateManualReleaseHardpoint,
  updateManualReleaseTime,
  updateReleaseMode,
  updateRepeatedGroupField,
  updateRepeatedGroupFollowVehiclePath,
  updateRepeatedGroupHardpointSequence,
  updateRepeatedGroupName,
  updateRepeatedGroupTemplateField,
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
import {
  SUPPORTED_AUDIO_CUES,
  type AudioSource,
  type EditorSourceProfile,
  type PayloadEventFields,
  type SourceAudioEvent,
  type SourceAudioGroup,
  type SourcePayloadEvent,
  type VehiclePreviewMetadataFile,
} from "./types";
import { payloadCatalogEntry } from "./payload-catalog";
import { canonicalJson } from "./canonical-json";
import { AirstrikeAgentController, type AgentEditorContext, type AgentWorkspaceScope } from "./editor/agent";

interface EditorConfig {
  profileKey?: string;
  csrf?: string;
  apiBase?: string;
  assetBase?: string;
  serverStatusUrl?: string;
  managementUrl?: string;
  agentApiBase?: string;
  featureFlags?: {
    airstrikeAgent?: boolean;
    airstrikeAgentConfigured?: boolean;
    airstrikeAgentStorageReady?: boolean;
  };
}

interface ProfileSummary {
  profileKey: string;
  displayName: string;
  vehicle: string;
  draftVersion: number;
  updatedAt?: string | null;
  lastPublishedProfileRevision?: number | null;
  validation?: { ok?: boolean };
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
  notes: HTMLTextAreaElement;
  feedback: HTMLElement;
  feedbackSummary: HTMLElement;
  output: HTMLElement;
  outputReview: HTMLElement;
  compileSummary: HTMLElement;
  compileSummaryReview: HTMLElement;
  list: HTMLElement;
  search: HTMLInputElement;
  profileFilter: HTMLSelectElement;
  profileSort: HTMLSelectElement;
  profileTabs: HTMLElement;
  profileCount: HTMLElement;
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
  rotationMode: HTMLSelectElement;
  releaseMode: HTMLSelectElement;
  manualReleaseList: HTMLElement;
  repeatedReleaseList: HTMLElement;
  manualReleaseEditor: HTMLElement;
  repeatedReleaseEditor: HTMLElement;
  audioEditor: HTMLElement;
  releaseTimeline: HTMLElement;
  workspaceReleaseTimeline: HTMLElement;
  ordnanceScheduleSummary: HTMLElement;
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
  selectedRepeatedGroupId: string;
  selectedOrdnanceKind: "event" | "group";
  scrubTime: number;
  playing: boolean;
  vehicleFilter: string;
}

type PanelName = "left" | "right" | "bottom";
type ToolId = Exclude<AgentWorkspaceScope, "full">;

interface ToolSession {
  tool: ToolId;
  profile: EditorSourceProfile;
  dirty: boolean;
  selectedWaypointId: string;
  selectedReleaseId: string;
  selectedRepeatedGroupId: string;
  selectedOrdnanceKind: "event" | "group";
  scrubTime: number;
  opener: HTMLElement | null;
}

interface ToolWindowPosition {
  left: number;
  top: number;
}

interface ValidationState {
  status: "not-run" | "running" | "passed" | "failed";
  errors: number;
  warnings: number;
}

interface RecoveryDraft {
  savedAt: string;
  source: string;
}

class EditorRequestError extends Error {
  public readonly status: number;

  public constructor(message: string, status: number) {
    super(message);
    this.name = "EditorRequestError";
    this.status = status;
  }
}

interface NumericControlRange {
  minimum: number;
  maximum: number;
}

type NumberInputCommitMode = "live" | "deferred";

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
        TargetingMode: "simple",
        AccuracyPercent: 75,
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
    AudioSource: { Mode: "automatic", Events: [], Groups: [] },
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
  return normalizeProfilePayloadTargeting(parsed as EditorSourceProfile);
}

function updateProfileAudio(profile: EditorSourceProfile, mutate: (audio: AudioSource) => void): EditorSourceProfile {
  const next = JSON.parse(JSON.stringify(profile)) as EditorSourceProfile;
  const audio: AudioSource = next.AudioSource ?? { Mode: "automatic", Events: [], Groups: [] };
  audio.Events = Array.isArray(audio.Events) ? audio.Events : [];
  audio.Groups = Array.isArray(audio.Groups) ? audio.Groups : [];
  mutate(audio);
  next.AudioSource = audio;
  return next;
}

function nextStableId(prefix: string, existing: readonly string[]): string {
  let index = existing.length + 1;
  let candidate = `${prefix}_${String(index).padStart(3, "0")}`;
  while (existing.includes(candidate)) {
    index += 1;
    candidate = `${prefix}_${String(index).padStart(3, "0")}`;
  }
  return candidate;
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
    selectedRepeatedGroupId: "",
    selectedOrdnanceKind: "event",
    scrubTime: 0,
    playing: false,
    vehicleFilter: "all",
  };
  private readonly viewport: AirstrikeViewport;
  private readonly agent: AirstrikeAgentController;
  private toolSession: ToolSession | null = null;
  private activeTool: ToolId | null = null;
  private activeToolOpener: HTMLElement | null = null;
  private readonly toolWindowPositions = new Map<ToolId, ToolWindowPosition>();
  private validationState: ValidationState = { status: "not-run", errors: 0, warnings: 0 };
  private ordnanceTab: "basic" | "targeting" | "advanced" | "audio" = "basic";
  private metadata: VehiclePreviewMetadataFile | null = null;
  private playbackFrame = 0;
  private playbackStartedAt = 0;
  private playbackStartedTime = 0;
  private playbackRunId = 0;
  private suppressNextPlayClick = false;
  // Legacy palette helpers remain inert for compatibility with stored layouts.
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
    this.agent = new AirstrikeAgentController(elements.root, {
      apiBase: String(config.agentApiBase || "../api/admin/airstrike-agent"),
      csrf: String(config.csrf || ""),
      enabled: Boolean(config.featureFlags?.airstrikeAgent),
      configured: Boolean(config.featureFlags?.airstrikeAgentConfigured),
      storageReady: Boolean(config.featureFlags?.airstrikeAgentStorageReady),
      getContext: () => this.agentEditorContext(),
      applySource: (source) => this.applyProfile(source, true),
      previewSource: (source) => this.viewport.updateProposalProfile(source),
      workspaceScope: () => this.activeTool ?? "full",
      navigateDiff: (area, id) => this.navigateAgentDiff(area, id),
      openFullAgent: () => void this.openFullAgentFromWorkspace(),
    });
    this.bindEvents();
    this.bindMenus();
    this.restorePanelState();
    this.enhanceNumericControls();
    this.initializeToolWorkspaces();
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
      this.offerRecoveryDraft();
    } catch (error) {
      this.loadSource(starterSource(), "", 0);
      this.offerRecoveryDraft();
      this.showFeedback(error instanceof Error ? error.message : String(error), "error");
      this.setStatus("Editor started without server profile list");
    }
    await this.agent.initialize(String(this.state.profile?.ProfileKey || this.config.profileKey || ""));
  }

  private agentEditorContext(): AgentEditorContext | null {
    if (!this.state.profile) {
      return null;
    }
    return {
      source: JSON.parse(JSON.stringify(this.state.profile)) as EditorSourceProfile,
      draftVersion: this.state.baseVersion,
      dirty: this.state.dirty,
      scrubTime: this.state.scrubTime,
      selectedWaypointId: this.state.selectedWaypointId,
      selectedReleaseId: this.state.selectedReleaseId,
      selectedRepeatedGroupId: this.state.selectedRepeatedGroupId,
      activeWorkspace: this.activeTool ?? "full",
      allowedMutationAreas: this.allowedMutationAreas(this.activeTool ?? "full"),
      viewport: {
        sceneExtras: this.elements.sceneExtras.checked,
        terrainReference: this.elements.terrainReference.checked,
        groundGrid: this.elements.groundGrid.checked,
        followVehicle: this.elements.followVehicle.checked,
        rideVehicle: this.elements.rideVehicle.checked,
        releaseVisibility: this.elements.releaseVisibility.value,
      },
    };
  }

  private bindEvents(): void {
    this.elements.source.addEventListener("input", () => this.handleSourceInput());
    this.elements.key.addEventListener("change", () => this.syncIdentityIntoSource());
    this.elements.name.addEventListener("change", () => this.syncIdentityIntoSource());
    this.elements.vehicle.addEventListener("change", () => this.syncIdentityIntoSource());
    this.elements.notes.addEventListener("change", () => this.syncIdentityIntoSource());
    this.elements.rotationMode.addEventListener("change", () => this.handleRotationModeChange());
    this.elements.search.addEventListener("input", () => this.renderProfiles());
    this.elements.profileFilter.addEventListener("change", () => this.renderProfiles());
    this.elements.profileSort.addEventListener("change", () => this.renderProfiles());
    this.elements.timeRange.addEventListener("input", () => this.setScrubTime(Number(this.elements.timeRange.value)));
    this.elements.timeNumber.addEventListener("input", () => this.setScrubTime(Number(this.elements.timeNumber.value)));
    this.elements.addWaypoint.addEventListener("click", () => this.handleAddWaypoint());
    this.elements.duplicateWaypoint.addEventListener("click", () => this.handleDuplicateWaypoint());
    this.elements.deleteWaypoint.addEventListener("click", () => this.handleDeleteWaypoint());
    this.elements.normalizeTimes.addEventListener("click", () => this.handleNormalizeTimes());
    this.elements.inferSpeeds.addEventListener("click", () => this.handleInferSpeeds());
    this.elements.play.addEventListener("pointerdown", (event) => this.handlePlaybackPointerDown(event));
    this.elements.play.addEventListener("click", () => {
      if (this.suppressNextPlayClick) {
        this.suppressNextPlayClick = false;
        return;
      }
      this.togglePlayback();
    });
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
      this.renderInspectorSummaries();
    });
    this.elements.terrainReference.addEventListener("change", () => {
      this.viewport.setTerrainReferenceEnabled(this.elements.terrainReference.checked);
      this.renderInspectorSummaries();
    });
    this.elements.groundGrid.addEventListener("change", () => {
      this.viewport.setGroundGridEnabled(this.elements.groundGrid.checked);
      this.renderInspectorSummaries();
    });
    this.elements.releaseVisibility.addEventListener("change", () => this.handleReleaseVisibilityChange());
    this.elements.globalSpeed.addEventListener("input", () => this.handleGlobalSpeedInput());
    this.elements.waypointSpeed.addEventListener("input", () => this.handleWaypointSpeedInput());
    this.elements.releaseMode.addEventListener("change", () => this.handleReleaseModeChange());
    this.elements.addRelease.addEventListener("click", () => this.handleAddRelease());
    this.elements.duplicateRelease.addEventListener("click", () => this.handleDuplicateRelease());
    this.elements.deleteRelease.addEventListener("click", () => this.handleDeleteRelease());
    this.elements.root.querySelectorAll<HTMLButtonElement>("[data-editor-add-manual-release]").forEach((button) => button.addEventListener("click", () => this.handleAddManualRelease()));
    this.elements.root.querySelectorAll<HTMLButtonElement>("[data-editor-add-repeated-group]").forEach((button) => button.addEventListener("click", () => this.handleAddRepeatedGroup()));
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
    this.elements.root.querySelectorAll("[data-editor-duplicate]").forEach((button) => {
      button.addEventListener("click", () => void this.duplicateCurrentProfile());
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
    this.elements.root.querySelectorAll<HTMLButtonElement>("[data-editor-step-selection]").forEach((button) => button.addEventListener("click", () => this.stepInspectorSelection(String(button.dataset.editorStepSelection || ""))));
    this.elements.root.querySelectorAll<HTMLInputElement>("[data-editor-waypoint-field]").forEach((input) => {
      input.addEventListener("input", () => this.handleWaypointFieldInput(input));
    });
    document.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void (async () => {
          if (this.toolSession) await this.applyActiveTool();
          await this.saveDraft();
        })();
      }
    });
  }

  private enhanceNumericControls(root: ParentNode = this.elements.root): void {
    root.querySelectorAll<HTMLInputElement>(".airstrike-tool-dialog input[type='number']").forEach((input) => {
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
      const updateFromSlider = (): void => {
        if (input.value === range.value) {
          this.syncNumericControl(input);
          return;
        }
        input.value = range.value;
        // Use the same native event path as keyboard entry so permanent and generated inputs
        // both update the profile and viewport while the slider is moving.
        input.dispatchEvent(new Event("input", { bubbles: true }));
      };
      range.addEventListener("input", updateFromSlider);
      range.addEventListener("change", updateFromSlider);
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
      RotationX: { minimum: -100_000, maximum: 100_000 },
      RotationY: { minimum: -100_000, maximum: 100_000 },
      RotationZ: { minimum: -100_000, maximum: 100_000 },
    };
    if (waypointField && waypointRanges[waypointField]) {
      return waypointRanges[waypointField];
    }
    const labelText = input.closest("label")?.querySelector("span")?.textContent?.trim() ?? "";
    const releaseRanges: Record<string, NumericControlRange> = {
      Time: { minimum: 0, maximum: duration },
      StartTime: { minimum: 0, maximum: duration },
      IntervalSeconds: { minimum: 0.01, maximum: 30 },
      UnitsPerRelease: { minimum: 1, maximum: 200 },
      UnitIntervalSeconds: { minimum: 0, maximum: 30 },
      MaximumUnits: { minimum: 1, maximum: 2000 },
      Count: { minimum: 1, maximum: 40 },
      CarrierOffsetX: { minimum: -250, maximum: 250 },
      CarrierOffsetY: { minimum: -250, maximum: 250 },
      CarrierOffsetZ: { minimum: -250, maximum: 250 },
      TargetOffsetX: { minimum: -500, maximum: 500 },
      TargetOffsetY: { minimum: -500, maximum: 500 },
      TargetOffsetZ: { minimum: -500, maximum: 500 },
      SpreadRadius: { minimum: -1, maximum: 250 },
      "Spread radius": { minimum: -1, maximum: 250 },
      "Accuracy %": { minimum: 0, maximum: 100 },
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
      error:
        response.status === 401 || response.status === 403 || response.status === 419
          ? "Your admin session expired or no longer has access. The browser kept a local recovery copy; sign back in before saving again."
          : "The server returned an unreadable response.",
    }))) as Record<string, unknown>;
    if (!response.ok || payload.ok !== true) {
      throw new EditorRequestError(String(payload.error || "The request failed."), response.status);
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
    this.elements.feedbackSummary.textContent = message;
    this.elements.feedbackSummary.classList.toggle("is-error", type === "error");
    this.elements.feedbackSummary.classList.toggle("is-success", type === "success");
  }

  private recoveryKey(): string {
    return `raidlands.airstrike-animation-recovery.${this.state.profileKey || this.elements.key.value || "new"}`;
  }

  private readRecoveryDraft(key = this.recoveryKey()): RecoveryDraft | null {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(key) || "null") as Partial<RecoveryDraft> | null;
      if (!parsed || typeof parsed.source !== "string" || parsed.source.trim() === "") {
        return null;
      }
      return {
        savedAt: typeof parsed.savedAt === "string" ? parsed.savedAt : "",
        source: parsed.source,
      };
    } catch {
      return null;
    }
  }

  private offerRecoveryDraft(): void {
    const draft = this.readRecoveryDraft();
    if (!draft || draft.source === this.elements.source.value) {
      return;
    }
    const savedAt = draft.savedAt ? new Date(draft.savedAt).toLocaleString() : "an earlier local edit";
    const shouldRestore = window.confirm(
      `A local recovery draft from ${savedAt} exists for this profile. Restore it now?\n\nChoose Cancel to keep the server copy loaded; the recovery draft will remain in this browser.`,
    );
    if (!shouldRestore) {
      this.showFeedback(`Local recovery draft from ${savedAt} is still stored in this browser.`, "error");
      this.setStatus("Recovery draft available");
      return;
    }
    this.elements.source.value = draft.source;
    this.handleSourceInput();
    this.showFeedback(`Restored local recovery draft from ${savedAt}. Save it to make the recovered changes server-side.`, "success");
    this.setStatus("Recovered local draft");
  }

  private persistRecoveryDraft(sourceText: string): void {
    try {
      window.localStorage.setItem(
        this.recoveryKey(),
        JSON.stringify({
          savedAt: new Date().toISOString(),
          source: sourceText,
        }),
      );
    } catch {
      // Local recovery is best-effort; server saves remain authoritative.
    }
  }

  private markEdited(): void {
    if (this.state.loading) {
      return;
    }
    this.validationState = { status: "not-run", errors: 0, warnings: 0 };
    if (this.toolSession) {
      this.setStatus("Previewing workspace changes");
      this.updateToolSessionStatus();
      this.renderInspectorSummaries();
      return;
    }
    this.setDirty(true);
    this.setStatus("Draft has local changes");
    this.persistRecoveryDraft(this.elements.source.value);
    this.renderInspectorSummaries();
  }

  private writeSource(profile: EditorSourceProfile): void {
    this.elements.source.value = JSON.stringify(profile, null, 2);
  }

  private loadSource(source: EditorSourceProfile, profileKey: string, version: number): void {
    source = normalizeProfilePayloadTargeting(source);
    this.validationState = { status: "not-run", errors: 0, warnings: 0 };
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
    this.renderInspectorSummaries();
    this.viewport.updateProfile(source, this.state.selectedWaypointId, this.state.scrubTime);
    this.handleReleaseVisibilityChange();
    this.viewport.updateSelectedRelease(this.state.selectedReleaseId);
    this.elements.output.textContent = "";
    this.elements.outputReview.textContent = "";
    this.elements.compileSummary.textContent = "No compiled track yet";
    this.elements.compileSummaryReview.textContent = "No compiled track yet";
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
    this.renderInspectorSummaries();
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
    this.elements.notes.value = String(source.EditorMetadata?.Notes || "");
    this.elements.rotationMode.value = source.RotationMode || "follow_path_plus_offset";
    this.elements.key.disabled = this.state.baseVersion > 0;
    this.elements.title.textContent = String(source.DisplayName || source.ProfileKey || "New profile");
  }

  private handleRotationModeChange(): void {
    if (!this.state.profile) {
      return;
    }
    const source = JSON.parse(JSON.stringify(this.state.profile)) as EditorSourceProfile;
    source.RotationMode =
      this.elements.rotationMode.value === "authored_orientation"
        ? "authored_orientation"
        : "follow_path_plus_offset";
    this.previewProfileUpdate(source, true);
  }

  private readCurrentSource(): EditorSourceProfile {
    const source = parseProfileSource(this.elements.source.value);
    source.ProfileKey = String(this.elements.key.value || source.ProfileKey || "").trim().toLowerCase();
    source.DisplayName = String(this.elements.name.value || source.DisplayName || "").trim();
    source.Vehicle = String(this.elements.vehicle.value || source.Vehicle || "f15");
    source.EditorMetadata = source.EditorMetadata || { Notes: "", Tags: [], VehiclePreviewOverrides: {} };
    source.EditorMetadata.Notes = String(this.elements.notes.value || "").trim();
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
    const search = String(this.elements.search.value || "").trim().toLowerCase();
    const status = this.elements.profileFilter.value;
    const sort = this.elements.profileSort.value;
    const vehicles = Array.from(new Set(this.state.profiles.map((profile) => profile.vehicle || "other"))).sort((a, b) =>
      a.localeCompare(b),
    );

    if (this.state.vehicleFilter !== "all" && !vehicles.includes(this.state.vehicleFilter)) {
      this.state.vehicleFilter = "all";
    }

    this.elements.profileTabs.textContent = "";
    for (const vehicle of ["all", ...vehicles]) {
      const button = document.createElement("button");
      const count = vehicle === "all"
        ? this.state.profiles.length
        : this.state.profiles.filter((profile) => (profile.vehicle || "other") === vehicle).length;
      button.type = "button";
      button.role = "tab";
      button.className = `airstrike-editor-profile-tab${vehicle === this.state.vehicleFilter ? " is-active" : ""}`;
      button.setAttribute("aria-selected", String(vehicle === this.state.vehicleFilter));
      button.textContent = `${vehicle === "all" ? "All" : this.formatVehicle(vehicle)} ${count}`;
      button.addEventListener("click", () => {
        this.state.vehicleFilter = vehicle;
        this.renderProfiles();
      });
      this.elements.profileTabs.appendChild(button);
    }

    this.elements.list.textContent = "";
    const profiles = this.state.profiles
      .filter((profile) => {
        const matchesSearch =
          !search ||
          String(profile.profileKey || "").toLowerCase().includes(search) ||
          String(profile.displayName || "").toLowerCase().includes(search) ||
          String(profile.vehicle || "").toLowerCase().includes(search);
        const isValid = profile.validation?.ok !== false;
        const isPublished = Boolean(profile.lastPublishedProfileRevision);
        return (
          matchesSearch &&
          (this.state.vehicleFilter === "all" || (profile.vehicle || "other") === this.state.vehicleFilter) &&
          (status === "all" ||
            (status === "valid" && isValid) ||
            (status === "invalid" && !isValid) ||
            (status === "published" && isPublished) ||
            (status === "unpublished" && !isPublished))
        );
      })
      .sort((a, b) => {
        if (sort === "name-desc") return this.profileName(b).localeCompare(this.profileName(a));
        if (sort === "updated-desc") return String(b.updatedAt || "").localeCompare(String(a.updatedAt || ""));
        if (sort === "draft-desc") return b.draftVersion - a.draftVersion || this.profileName(a).localeCompare(this.profileName(b));
        return this.profileName(a).localeCompare(this.profileName(b));
      });

    this.elements.profileCount.textContent = `${profiles.length} of ${this.state.profiles.length} profiles`;
    if (profiles.length === 0) {
      const empty = document.createElement("p");
      empty.className = "airstrike-editor-profile-empty";
      empty.textContent = "No profiles match these filters.";
      this.elements.list.appendChild(empty);
      return;
    }

    profiles.forEach((profile) => {
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

  private profileName(profile: ProfileSummary): string {
    return String(profile.displayName || profile.profileKey || "");
  }

  private formatVehicle(vehicle: string): string {
    return vehicle.replace(/[_-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
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

  private ensureSelectedRepeatedGroup(profile: EditorSourceProfile): void {
    if (profile.ReleaseSource.Mode !== "repeated" && profile.ReleaseSource.Mode !== "mixed") {
      this.state.selectedRepeatedGroupId = "";
      return;
    }
    const groups = getRepeatedReleaseGroups(profile);
    if (!groups.some((group) => group.Id === this.state.selectedRepeatedGroupId)) {
      this.state.selectedRepeatedGroupId = groups[0]?.Id ?? "";
    }
  }

  private selectedManualRelease(): SourcePayloadEvent | undefined {
    const profile = this.state.profile;
    if (!profile || (profile.ReleaseSource.Mode !== "manual" && profile.ReleaseSource.Mode !== "mixed")) {
      return undefined;
    }
    return profile.ReleaseSource.Events.find((event) => event.Id === this.state.selectedReleaseId);
  }

  private renderReleaseControls(): void {
    const profile = this.state.profile;
    this.elements.releaseMode.value = profile?.ReleaseSource.Mode ?? "manual";
    this.elements.manualReleaseList.textContent = "";
    this.elements.repeatedReleaseList.textContent = "";
    this.elements.manualReleaseEditor.textContent = "";
    this.elements.repeatedReleaseEditor.textContent = "";
    this.elements.audioEditor.textContent = "";
    if (!profile) {
      this.elements.addRelease.disabled = true;
      this.elements.duplicateRelease.disabled = true;
      this.elements.deleteRelease.disabled = true;
      return;
    }
    if (profile.ReleaseSource.Mode === "manual") {
      this.state.selectedOrdnanceKind = "event";
      this.elements.addRelease.textContent = "Add event";
      this.elements.duplicateRelease.textContent = "Duplicate event";
      this.elements.deleteRelease.textContent = "Delete event";
      this.elements.addRelease.disabled = false;
      this.elements.duplicateRelease.disabled = !this.selectedManualRelease();
      this.elements.deleteRelease.disabled = !this.selectedManualRelease();
      this.renderManualReleaseList(profile);
      this.renderManualReleaseEditor(profile);
    } else if (profile.ReleaseSource.Mode === "repeated") {
      this.state.selectedOrdnanceKind = "group";
      this.ensureSelectedRepeatedGroup(profile);
      const groups = getRepeatedReleaseGroups(profile);
      const selected = groups.some((group) => group.Id === this.state.selectedRepeatedGroupId);
      this.elements.addRelease.textContent = "Add group";
      this.elements.duplicateRelease.textContent = "Duplicate group";
      this.elements.deleteRelease.textContent = "Delete group";
      this.elements.addRelease.disabled = false;
      this.elements.duplicateRelease.disabled = !selected;
      this.elements.deleteRelease.disabled = !selected || groups.length <= 1;
      this.renderRepeatedReleaseList(profile);
      this.renderRepeatedReleaseEditor(profile);
    } else {
      this.ensureSelectedRepeatedGroup(profile);
      const selectedGroup = getRepeatedReleaseGroups(profile).some((group) => group.Id === this.state.selectedRepeatedGroupId);
      const editingGroup = this.state.selectedOrdnanceKind === "group";
      this.elements.addRelease.textContent = editingGroup ? "Add group" : "Add event";
      this.elements.duplicateRelease.textContent = editingGroup ? "Duplicate group" : "Duplicate event";
      this.elements.deleteRelease.textContent = editingGroup ? "Delete group" : "Delete event";
      this.elements.addRelease.disabled = false;
      this.elements.duplicateRelease.disabled = editingGroup ? !selectedGroup : !this.selectedManualRelease();
      this.elements.deleteRelease.disabled = editingGroup ? !selectedGroup : !this.selectedManualRelease();
      this.renderManualReleaseList(profile);
      this.renderRepeatedReleaseList(profile);
      if (editingGroup) this.renderRepeatedReleaseEditor(profile);
      else this.renderManualReleaseEditor(profile);
    }
    const manualCollection = this.elements.root.querySelector<HTMLElement>("[data-editor-manual-collection]");
    const repeatedCollection = this.elements.root.querySelector<HTMLElement>("[data-editor-repeated-collection]");
    if (manualCollection) manualCollection.hidden = profile.ReleaseSource.Mode === "repeated";
    if (repeatedCollection) repeatedCollection.hidden = profile.ReleaseSource.Mode === "manual";
    this.renderAudioEditor(profile);
    this.renderOrdnanceTab();
    this.renderOrdnanceScheduleSummary();
    this.enhanceNumericControls(this.elements.root);
  }

  private renderManualReleaseList(profile: EditorSourceProfile): void {
    if (profile.ReleaseSource.Mode !== "manual" && profile.ReleaseSource.Mode !== "mixed") {
      return;
    }
    if (profile.ReleaseSource.Events.length === 0) {
      const empty = document.createElement("p");
      empty.className = "airstrike-editor-muted";
      empty.textContent = profile.ReleaseSource.Mode === "mixed" ? "No manual events" : "Legacy dynamic release path";
      this.elements.manualReleaseList.appendChild(empty);
      return;
    }
    for (const event of profile.ReleaseSource.Events) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `airstrike-release-row${this.state.selectedOrdnanceKind === "event" && event.Id === this.state.selectedReleaseId ? " is-active" : ""}`;
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
    const basic = document.createElement("section");
    basic.className = "airstrike-ordnance-field-section";
    basic.dataset.ordnanceSection = "basic";
    const targeting = document.createElement("section");
    targeting.className = "airstrike-ordnance-field-section";
    targeting.dataset.ordnanceSection = "targeting";
    this.elements.manualReleaseEditor.append(basic, targeting);

    const timeInput = this.createNumberInput(event.Time, 0.01, (value, mode) => {
      const next = updateManualReleaseTime(this.state.profile ?? profile, event.Id, value);
      if (mode === "deferred") {
        this.previewProfileUpdate(next, true);
      } else {
        this.applyProfile(next, true);
        this.selectRelease(event.Id);
      }
    });
    basic.appendChild(this.fieldWrapper("Time", timeInput));

    const hardpointSelect = document.createElement("select");
    hardpointSelect.appendChild(new Option("Raw carrier offset", ""));
    for (const hardpoint of availableHardpoints(profile, this.metadata)) {
      hardpointSelect.appendChild(new Option(hardpoint.id, hardpoint.id));
    }
    hardpointSelect.value = event.HardpointId ?? "";
    hardpointSelect.addEventListener("change", () => {
      const next = updateManualReleaseHardpoint(this.state.profile ?? profile, event.Id, hardpointSelect.value);
      this.applyProfile(next, true);
      this.selectRelease(event.Id);
    });
    basic.appendChild(this.fieldWrapper("Hardpoint", hardpointSelect));

    this.renderPayloadFieldGroup(basic, event, PAYLOAD_COMMON_FIELDS, (field, value, mode) => {
      const next = updateManualPayloadField(this.state.profile ?? profile, event.Id, field, value);
      if (mode === "deferred") {
        this.previewProfileUpdate(next, true);
      } else {
        this.applyProfile(next, true);
        this.selectRelease(event.Id);
      }
    });

    this.renderTargetingControls(targeting, event, (field, value, mode) => {
      const next = updateManualPayloadField(this.state.profile ?? profile, event.Id, field, value);
      if (mode === "deferred") {
        this.previewProfileUpdate(next, true);
      } else {
        this.applyProfile(next, true);
        this.selectRelease(event.Id);
      }
    });

    const advanced = document.createElement("details");
    advanced.className = "airstrike-editor-advanced airstrike-ordnance-field-section";
    advanced.dataset.ordnanceSection = "advanced";
    advanced.open = true;
    const summary = document.createElement("summary");
    summary.textContent = "Advanced payload fields";
    advanced.appendChild(summary);
    this.renderPayloadFieldGroup(advanced, event, PAYLOAD_ADVANCED_FIELDS, (field, value, mode) => {
      const next = updateManualPayloadField(this.state.profile ?? profile, event.Id, field, value);
      if (mode === "deferred") {
        this.previewProfileUpdate(next, true);
      } else {
        this.applyProfile(next, true);
        this.selectRelease(event.Id);
      }
    });
    this.elements.manualReleaseEditor.appendChild(advanced);

    const summaryLine = document.createElement("p");
    summaryLine.className = "airstrike-editor-muted";
    summaryLine.textContent = `${Math.max(1, event.Count)} total units | 1 burst | ends ${event.Time.toFixed(3)}s`;
    basic.appendChild(summaryLine);
  }

  private renderRepeatedReleaseEditor(profile: EditorSourceProfile): void {
    if (profile.ReleaseSource.Mode !== "repeated" && profile.ReleaseSource.Mode !== "mixed") {
      return;
    }
    const group = getRepeatedReleaseGroups(profile).find((entry) => entry.Id === this.state.selectedRepeatedGroupId);
    if (!group) {
      return;
    }
    const title = document.createElement("h3");
    title.textContent = group.Name;
    this.elements.repeatedReleaseEditor.appendChild(title);
    const basic = document.createElement("section");
    basic.className = "airstrike-ordnance-field-section";
    basic.dataset.ordnanceSection = "basic";
    const targeting = document.createElement("section");
    targeting.className = "airstrike-ordnance-field-section";
    targeting.dataset.ordnanceSection = "targeting";
    this.elements.repeatedReleaseEditor.append(basic, targeting);

    const name = document.createElement("input");
    name.type = "text";
    name.maxLength = 100;
    name.value = group.Name;
    name.addEventListener("change", () => {
      this.applyProfile(updateRepeatedGroupName(this.state.profile ?? profile, group.Id, name.value), true);
    });
    basic.appendChild(this.fieldWrapper("Group name", name));

    for (const [field, step] of [
      ["StartTime", 0.01],
      ["IntervalSeconds", 0.01],
      ["UnitIntervalSeconds", 0.001],
      ["UnitsPerRelease", 1],
      ["MaximumUnits", 1],
    ] as const) {
      const input = this.createNumberInput(field === "UnitIntervalSeconds" ? group.UnitIntervalSeconds ?? 0 : group[field], step, (value, mode) => {
        const next = updateRepeatedGroupField(this.state.profile ?? profile, group.Id, field, value);
        if (mode === "deferred") {
          this.previewProfileUpdate(next, true);
        } else {
          this.applyProfile(next, true);
        }
      });
      const label = field === "UnitIntervalSeconds" ? "Round spacing" : field;
      basic.appendChild(this.fieldWrapper(label, input));
    }

    const sequence = document.createElement("input");
    sequence.type = "text";
    sequence.value = group.HardpointSequence.join(", ");
    sequence.placeholder = availableHardpoints(profile, this.metadata).map((hardpoint) => hardpoint.id).join(", ");
    sequence.addEventListener("change", () => {
      this.applyProfile(
        updateRepeatedGroupHardpointSequence(
          this.state.profile ?? profile,
          group.Id,
          sequence.value.split(",").map((entry) => entry.trim()).filter(Boolean),
        ),
        true,
      );
    });
    basic.appendChild(this.fieldWrapper("Hardpoint sequence", sequence));

    const targetingSource = document.createElement("div");
    targetingSource.className = "airstrike-targeting-switch";
    targetingSource.setAttribute("role", "group");
    targetingSource.setAttribute("aria-label", "Automatic group target source");
    const isHoming = group.Template.Payload === "homing_missile";
    const targetingOptions = isHoming
      ? [["Native homing", false]] as const
      : [["Target ping", false], ["Follow vehicle path", true]] as const;
    for (const [label, followsPath] of targetingOptions) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.disabled = isHoming;
      const active = isHoming || (group.FollowVehiclePath === true) === followsPath;
      button.className = active ? "is-active" : "";
      button.setAttribute("aria-pressed", active ? "true" : "false");
      button.addEventListener("click", () => {
        this.applyProfile(
          updateRepeatedGroupFollowVehiclePath(this.state.profile ?? profile, group.Id, followsPath),
          true,
        );
      });
      targetingSource.appendChild(button);
    }
    const targetingSourceWrapper = this.fieldWrapper("Target behavior", targetingSource);
    const targetingSourceHelp = document.createElement("small");
    targetingSourceHelp.className = "airstrike-payload-detail";
    targetingSourceHelp.textContent = isHoming
      ? "Automatic homing missiles always retain Rust's native vehicle tracking."
      : group.FollowVehiclePath === true
        ? "Launches from the selected hardpoint along the live vehicle trajectory. The 3D ray previews direction only; ordnance continues under Rust physics."
        : "Aims at the stored ping using the targeting controls below.";
    targetingSourceWrapper.appendChild(targetingSourceHelp);
    basic.appendChild(targetingSourceWrapper);

    this.renderPayloadFieldGroup(basic, group.Template, PAYLOAD_COMMON_FIELDS.filter((field) => field !== "Count"), (field, value, mode) => {
      const next = updateRepeatedGroupTemplateField(this.state.profile ?? profile, group.Id, field, value);
      if (mode === "deferred") {
        this.previewProfileUpdate(next, true);
      } else {
        this.applyProfile(next, true);
      }
    });

    this.renderTargetingControls(targeting, group.Template, (field, value, mode) => {
      const next = updateRepeatedGroupTemplateField(this.state.profile ?? profile, group.Id, field, value);
      if (mode === "deferred") {
        this.previewProfileUpdate(next, true);
      } else {
        this.applyProfile(next, true);
      }
    });

    const bursts = Math.ceil(group.MaximumUnits / Math.max(1, group.UnitsPerRelease));
    const lastBurstUnits = group.MaximumUnits - Math.max(0, bursts - 1) * group.UnitsPerRelease;
    const endTime = group.StartTime + Math.max(0, bursts - 1) * group.IntervalSeconds
      + Math.max(0, lastBurstUnits - 1) * (group.UnitIntervalSeconds ?? 0);
    const summaryLine = document.createElement("p");
    summaryLine.className = "airstrike-editor-muted";
    summaryLine.textContent = `${group.MaximumUnits} total units | ${bursts} bursts | ends ${endTime.toFixed(3)}s`;
    basic.appendChild(summaryLine);

    const advanced = document.createElement("details");
    advanced.className = "airstrike-editor-advanced airstrike-ordnance-field-section";
    advanced.dataset.ordnanceSection = "advanced";
    advanced.open = true;
    const summary = document.createElement("summary");
    summary.textContent = "Advanced payload fields";
    advanced.appendChild(summary);
    this.renderPayloadFieldGroup(advanced, group.Template, PAYLOAD_ADVANCED_FIELDS, (field, value, mode) => {
      const next = updateRepeatedGroupTemplateField(this.state.profile ?? profile, group.Id, field, value);
      if (mode === "deferred") {
        this.previewProfileUpdate(next, true);
      } else {
        this.applyProfile(next, true);
      }
    });
    this.elements.repeatedReleaseEditor.appendChild(advanced);
  }

  private renderAudioEditor(profile: EditorSourceProfile): void {
    const audio = profile.AudioSource ?? { Mode: "automatic" as const, Events: [], Groups: [] };
    const heading = document.createElement("h3");
    heading.textContent = "Vehicle and weapon audio";
    const help = document.createElement("p");
    help.className = "airstrike-editor-muted";
    help.textContent = "Authored mode replaces generic flyover cues. One-shot events and repeating groups are evaluated against the live carrier position at playback time.";
    this.elements.audioEditor.append(heading, help);

    const mode = document.createElement("select");
    mode.append(new Option("Automatic legacy cues", "automatic"), new Option("Authored timeline cues", "authored"));
    mode.value = audio.Mode;
    mode.addEventListener("change", () => this.applyProfile(updateProfileAudio(this.state.profile ?? profile, (next) => {
      next.Mode = mode.value === "authored" ? "authored" : "automatic";
    }), true));
    this.elements.audioEditor.appendChild(this.fieldWrapper("Audio mode", mode));

    if (audio.Mode !== "authored") {
      const note = document.createElement("p");
      note.className = "airstrike-editor-muted";
      note.textContent = "Switch to authored mode to place repeatable F-15 passes, cannon bursts, and other curated cues.";
      this.elements.audioEditor.appendChild(note);
      return;
    }

    const actions = document.createElement("div");
    actions.className = "airstrike-editor-inline-actions";
    const addEvent = document.createElement("button");
    addEvent.type = "button";
    addEvent.textContent = "Add one-shot cue";
    addEvent.addEventListener("click", () => this.applyProfile(updateProfileAudio(this.state.profile ?? profile, (next) => {
      const event: SourceAudioEvent = {
        Id: nextStableId("audio_event", next.Events.map((entry) => entry.Id)),
        Time: Math.min(profile.DurationSeconds, this.state.scrubTime),
        Cue: "f15_pass",
        Anchor: "carrier",
        OffsetX: 0,
        OffsetY: 0,
        OffsetZ: 0,
      };
      next.Events.push(event);
    }), true));
    const addGroup = document.createElement("button");
    addGroup.type = "button";
    addGroup.textContent = "Add repeating cue group";
    addGroup.addEventListener("click", () => this.applyProfile(updateProfileAudio(this.state.profile ?? profile, (next) => {
      const start = Math.min(profile.DurationSeconds, this.state.scrubTime);
      const group: SourceAudioGroup = {
        Id: nextStableId("audio_group", next.Groups.map((entry) => entry.Id)),
        Name: "Flyover pass",
        StartTime: start,
        EndTime: Math.min(profile.DurationSeconds, start + 2),
        IntervalSeconds: 0.75,
        MaximumCues: 8,
        Cue: "f15_pass",
        Anchor: "carrier",
        OffsetX: 0,
        OffsetY: 0,
        OffsetZ: 0,
      };
      next.Groups.push(group);
    }), true));
    actions.append(addEvent, addGroup);
    this.elements.audioEditor.appendChild(actions);

    const cueSelect = (selected: string, onChange: (value: string) => void): HTMLSelectElement => {
      const select = document.createElement("select");
      SUPPORTED_AUDIO_CUES.forEach((cue) => select.appendChild(new Option(cue.replace(/_/g, " "), cue)));
      select.value = selected;
      select.addEventListener("change", () => onChange(select.value));
      return select;
    };
    const anchorSelect = (selected: string, onChange: (value: "carrier" | "target") => void): HTMLSelectElement => {
      const select = document.createElement("select");
      select.append(new Option("Live carrier", "carrier"), new Option("Strike target", "target"));
      select.value = selected;
      select.addEventListener("change", () => onChange(select.value === "target" ? "target" : "carrier"));
      return select;
    };
    const commitEvent = (id: string, mutate: (entry: SourceAudioEvent) => void): void => {
      this.applyProfile(updateProfileAudio(this.state.profile ?? profile, (next) => {
        const entry = next.Events.find((candidate) => candidate.Id === id);
        if (entry) mutate(entry);
      }), true);
    };
    const commitGroup = (id: string, mutate: (entry: SourceAudioGroup) => void): void => {
      this.applyProfile(updateProfileAudio(this.state.profile ?? profile, (next) => {
        const entry = next.Groups.find((candidate) => candidate.Id === id);
        if (entry) mutate(entry);
      }), true);
    };
    const offsetFields = <T extends SourceAudioEvent | SourceAudioGroup>(container: HTMLElement, entry: T, commit: (mutate: (target: T) => void) => void): void => {
      for (const key of ["OffsetX", "OffsetY", "OffsetZ"] as const) {
        container.appendChild(this.fieldWrapper(key, this.createNumberInput(entry[key], 0.1, (value, mode) => {
          if (mode === "live") commit((target) => { target[key] = value; });
        })));
      }
    };

    const eventSection = document.createElement("section");
    eventSection.className = "airstrike-workspace-section";
    const eventHeading = document.createElement("h3");
    eventHeading.textContent = `One-shot cues (${audio.Events.length})`;
    eventSection.appendChild(eventHeading);
    audio.Events.forEach((event) => {
      const row = document.createElement("article");
      row.className = "airstrike-editor-advanced";
      const title = document.createElement("strong");
      title.textContent = event.Id;
      row.appendChild(title);
      row.appendChild(this.fieldWrapper("Time", this.createNumberInput(event.Time, 0.01, (value, mode) => {
        if (mode === "live") commitEvent(event.Id, (entry) => { entry.Time = value; });
      })));
      row.appendChild(this.fieldWrapper("Cue", cueSelect(event.Cue, (value) => commitEvent(event.Id, (entry) => { entry.Cue = value as SourceAudioEvent["Cue"]; }))));
      row.appendChild(this.fieldWrapper("Anchor", anchorSelect(event.Anchor, (value) => commitEvent(event.Id, (entry) => { entry.Anchor = value; }))));
      offsetFields(row, event, (mutate) => commitEvent(event.Id, mutate));
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "Delete cue";
      remove.addEventListener("click", () => this.applyProfile(updateProfileAudio(this.state.profile ?? profile, (next) => {
        next.Events = next.Events.filter((entry) => entry.Id !== event.Id);
      }), true));
      row.appendChild(remove);
      eventSection.appendChild(row);
    });
    this.elements.audioEditor.appendChild(eventSection);

    const groupSection = document.createElement("section");
    groupSection.className = "airstrike-workspace-section";
    const groupHeading = document.createElement("h3");
    groupHeading.textContent = `Repeating cue groups (${audio.Groups.length})`;
    groupSection.appendChild(groupHeading);
    audio.Groups.forEach((group) => {
      const row = document.createElement("article");
      row.className = "airstrike-editor-advanced";
      const name = document.createElement("input");
      name.type = "text";
      name.maxLength = 100;
      name.value = group.Name;
      name.addEventListener("change", () => commitGroup(group.Id, (entry) => { entry.Name = name.value; }));
      row.appendChild(this.fieldWrapper("Group name", name));
      for (const [key, step] of [["StartTime", 0.01], ["EndTime", 0.01], ["IntervalSeconds", 0.01], ["MaximumCues", 1]] as const) {
        row.appendChild(this.fieldWrapper(key, this.createNumberInput(group[key], step, (value, mode) => {
          if (mode === "live") commitGroup(group.Id, (entry) => { entry[key] = key === "MaximumCues" ? Math.max(1, Math.round(value)) : value; });
        })));
      }
      row.appendChild(this.fieldWrapper("Cue", cueSelect(group.Cue, (value) => commitGroup(group.Id, (entry) => { entry.Cue = value as SourceAudioGroup["Cue"]; }))));
      row.appendChild(this.fieldWrapper("Anchor", anchorSelect(group.Anchor, (value) => commitGroup(group.Id, (entry) => { entry.Anchor = value; }))));
      offsetFields(row, group, (mutate) => commitGroup(group.Id, mutate));
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "Delete group";
      remove.addEventListener("click", () => this.applyProfile(updateProfileAudio(this.state.profile ?? profile, (next) => {
        next.Groups = next.Groups.filter((entry) => entry.Id !== group.Id);
      }), true));
      row.appendChild(remove);
      groupSection.appendChild(row);
    });
    this.elements.audioEditor.appendChild(groupSection);
  }

  private renderTargetingControls(
    parent: HTMLElement,
    fields: PayloadEventFields,
    onChange: (field: PayloadField, value: string | number | string[] | Record<string, number>, mode: NumberInputCommitMode) => void,
  ): void {
    const mode = fields.TargetingMode === "advanced" ? "advanced" : "simple";
    const section = document.createElement("section");
    section.className = `airstrike-targeting-panel is-${mode}`;

    const heading = document.createElement("div");
    heading.className = "airstrike-targeting-heading";
    const title = document.createElement("strong");
    title.textContent = "Targeting";
    const switcher = document.createElement("div");
    switcher.className = "airstrike-targeting-switch";
    switcher.setAttribute("role", "group");
    switcher.setAttribute("aria-label", "Payload targeting mode");
    for (const targetMode of ["simple", "advanced"] as const) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = targetMode === "simple" ? "Simple" : "Advanced";
      button.className = targetMode === mode ? "is-active" : "";
      button.setAttribute("aria-pressed", targetMode === mode ? "true" : "false");
      button.addEventListener("click", () => onChange("TargetingMode", targetMode, "live"));
      switcher.appendChild(button);
    }
    heading.append(title, switcher);
    section.appendChild(heading);

    const help = document.createElement("p");
    help.className = "airstrike-editor-muted airstrike-targeting-help";
    help.textContent = mode === "simple"
      ? "Accuracy scales the miss radius. Stored target offsets are preserved but ignored."
      : "Authored target offsets define the aim center and the full spread remains active.";
    section.appendChild(help);

    this.renderPayloadFieldGroup(
      section,
      fields,
      mode === "simple" ? PAYLOAD_SIMPLE_TARGET_FIELDS : PAYLOAD_ADVANCED_TARGET_FIELDS,
      onChange,
    );

    if (mode === "simple") {
      const result = document.createElement("p");
      result.className = "airstrike-targeting-result";
      const maximumMiss = effectiveAccuracyRadius(fields);
      result.textContent = maximumMiss === null
        ? "Maximum miss: inherits strike spread"
        : `Maximum miss: ${maximumMiss.toFixed(2)} m`;
      section.appendChild(result);
    }
    parent.appendChild(section);
  }

  private renderPayloadFieldGroup(
    parent: HTMLElement,
    fields: PayloadEventFields,
    fieldNames: readonly PayloadField[],
    onChange: (field: PayloadField, value: string | number | string[] | Record<string, number>, mode: NumberInputCommitMode) => void,
  ): void {
    const grid = document.createElement("div");
    grid.className = "airstrike-payload-field-grid";
    for (const field of fieldNames) {
      if (field === "Payload") {
        const select = document.createElement("select");
        const groups = new Map<string, HTMLOptGroupElement>();
        for (const payload of payloadOptions()) {
          let group = groups.get(payload.category);
          if (!group) {
            group = document.createElement("optgroup");
            group.label = payload.category;
            groups.set(payload.category, group);
            select.appendChild(group);
          }
          const option = new Option(payload.label, payload.id);
          option.title = [payload.nativeSource, payload.restriction].filter(Boolean).join(" — ");
          group.appendChild(option);
        }
        const selectedPayload = payloadCatalogEntry(fields.Payload);
        if (fields.Payload && selectedPayload?.deprecated) {
          const legacyGroup = document.createElement("optgroup");
          legacyGroup.label = "Legacy — existing profiles only";
          legacyGroup.appendChild(new Option(`${selectedPayload.label} (deprecated)`, selectedPayload.id));
          select.insertBefore(legacyGroup, select.firstChild);
        }
        select.value = fields.Payload;
        select.addEventListener("change", () => onChange(field, select.value, "live"));
        const wrapper = this.fieldWrapper(field, select);
        const descriptor = selectedPayload;
        if (descriptor) {
          const detail = document.createElement("small");
          detail.className = descriptor.deprecated ? "airstrike-payload-detail is-warning" : "airstrike-payload-detail";
          detail.textContent = descriptor.deprecated
            ? `Deprecated; use ${descriptor.replacementId}. Existing value is preserved until you change it.`
            : `${descriptor.nativeSource}${descriptor.restriction ? ` · ${descriptor.restriction}` : ""}`;
          wrapper.appendChild(detail);
        }
        grid.appendChild(wrapper);
      } else if (field === "AmmoSequence") {
        const presets: Record<string, string[]> = {
          legacy: [],
          combat_mix: ["gau8_api", "gau8_hei", "gau8_api"],
          urban_mix: ["gau8_hei", "gau8_tp", "gau8_hei"],
          api_only: ["gau8_api"],
          hei_only: ["gau8_hei"],
          training_only: ["gau8_tp"],
          incendiary_tracer_only: ["incendiary_tracer"],
        };
        const current = fields.AmmoSequence ?? [];
        const preset = Object.entries(presets).find(([, sequence]) => JSON.stringify(sequence) === JSON.stringify(current))?.[0] ?? "custom";
        const container = document.createElement("div");
        const select = document.createElement("select");
        select.append(
          new Option("Legacy/default behavior", "legacy"),
          new Option("GAU-8 combat mix (2 API : 1 HEI)", "combat_mix"),
          new Option("GAU-8 urban mix (2 HEI : 1 TP)", "urban_mix"),
          new Option("API only", "api_only"),
          new Option("HEI only", "hei_only"),
          new Option("Training/practice only", "training_only"),
          new Option("Incendiary tracer only (gameplay)", "incendiary_tracer_only"),
          new Option("Custom deterministic sequence", "custom"),
        );
        select.value = preset;
        const custom = document.createElement("input");
        custom.type = "text";
        custom.value = current.join(", ");
        custom.placeholder = "gau8_api, gau8_hei, gau8_api";
        custom.hidden = preset !== "custom";
        select.addEventListener("change", () => {
          custom.hidden = select.value !== "custom";
          if (select.value !== "custom") onChange(field, presets[select.value] ?? [], "live");
        });
        custom.addEventListener("change", () => onChange(field, custom.value.split(",").map((entry) => entry.trim()).filter(Boolean), "live"));
        const detail = document.createElement("small");
        detail.className = "airstrike-payload-detail";
        detail.textContent = "The sequence cycles deterministically across every logical round; no damage rounds are sampled or discarded.";
        container.append(select, custom, detail);
        grid.appendChild(this.fieldWrapper("Ammo mix", container));
      } else if (field === "DamageScales") {
        const input = document.createElement("textarea");
        input.rows = 3;
        input.spellcheck = false;
        input.value = JSON.stringify(fields.DamageScales ?? {});
        input.addEventListener("change", () => {
          try {
            const parsed = JSON.parse(input.value || "{}") as Record<string, number>;
            onChange(field, parsed, "live");
          } catch {
            this.showFeedback("DamageScales must be valid JSON.", "error");
          }
        });
        grid.appendChild(this.fieldWrapper(field, input));
      } else {
        const input = this.createNumberInput(Number(fields[field]), field === "Count" ? 1 : 0.1, (value, mode) => {
          onChange(field, value, mode);
        });
        const label = field === "AccuracyPercent" ? "Accuracy %" : field === "SpreadRadius" ? "Spread radius" : field;
        grid.appendChild(this.fieldWrapper(label, input));
      }
    }
    parent.appendChild(grid);
  }

  private createNumberInput(value: number, step: number, onInput: (value: number, mode: NumberInputCommitMode) => void): HTMLInputElement {
    const input = document.createElement("input");
    input.type = "number";
    input.step = String(step);
    input.value = String(value);
    const commit = (mode: NumberInputCommitMode): void => {
      if (input.value.trim() === "" || input.validity.badInput) {
        return;
      }
      const next = Number(input.value);
      if (Number.isFinite(next)) {
        onInput(next, mode);
      }
    };
    input.addEventListener("input", () => {
      commit("deferred");
    });
    // While typing, avoid rebuilding the control that currently owns focus.
    // Once the edit is committed, rebuild the workspace so collection rows and
    // schedule totals immediately reflect the accepted numeric value.
    input.addEventListener("change", () => commit("live"));
    return input;
  }

  private renderRepeatedReleaseList(profile: EditorSourceProfile): void {
    for (const group of getRepeatedReleaseGroups(profile)) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `airstrike-release-row${this.state.selectedOrdnanceKind === "group" && group.Id === this.state.selectedRepeatedGroupId ? " is-active" : ""}`;
      button.textContent = `${group.Name}  ${group.StartTime.toFixed(2)}s  ${group.Template.Payload || "payload"} x${group.MaximumUnits}`;
      button.addEventListener("click", () => this.selectRepeatedGroup(group.Id));
      this.elements.repeatedReleaseList.appendChild(button);
    }
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
    this.elements.workspaceReleaseTimeline.replaceChildren(track.cloneNode(true));
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
    this.renderInspectorSummaries();
  }

  private selectRelease(releaseId: string): void {
    this.state.selectedReleaseId = releaseId;
    this.state.selectedOrdnanceKind = "event";
    this.renderReleaseControls();
    this.renderReleaseTimeline();
    this.viewport.updateSelectedRelease(releaseId);
    this.renderInspectorSummaries();
  }

  private selectRepeatedGroup(groupId: string): void {
    this.state.selectedRepeatedGroupId = groupId;
    this.state.selectedOrdnanceKind = "group";
    this.renderReleaseControls();
    this.renderInspectorSummaries();
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
    if (input.value.trim() === "" || input.validity.badInput) {
      return;
    }
    const value = Number(input.value);
    if (!Number.isFinite(value)) {
      return;
    }
    const next = updateWaypointField(this.state.profile, this.state.selectedWaypointId, field, value);
    this.previewProfileUpdate(next, true);
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

  private handlePlaybackPointerDown(event: PointerEvent): void {
    if (event.button !== 0) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    this.suppressNextPlayClick = true;
    this.togglePlayback();
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
    this.previewProfileUpdate(setGlobalTargetSpeed(this.state.profile, value), true);
  }

  private handleWaypointSpeedInput(): void {
    if (!this.state.profile || !this.state.selectedWaypointId) {
      return;
    }
    const value = Number(this.elements.waypointSpeed.value);
    if (!Number.isFinite(value) || value <= 0) {
      return;
    }
    this.previewProfileUpdate(setWaypointTargetSpeed(this.state.profile, this.state.selectedWaypointId, value), true);
  }

  private handleReleaseModeChange(): void {
    if (!this.state.profile) {
      return;
    }
    const selectedMode = this.elements.releaseMode.value;
    const mode = selectedMode === "repeated" || selectedMode === "mixed" ? selectedMode : "manual";
    const next = updateReleaseMode(this.state.profile, mode);
    if (mode === "repeated" || mode === "mixed") {
      this.state.selectedRepeatedGroupId = getRepeatedReleaseGroups(next)[0]?.Id ?? "";
    }
    const mixedHasEvents = next.ReleaseSource.Mode === "mixed" && next.ReleaseSource.Events.length > 0;
    this.state.selectedOrdnanceKind = mode === "repeated" || (mode === "mixed" && !mixedHasEvents) ? "group" : "event";
    this.applyProfile(next, true);
  }

  private handleAddRelease(): void {
    if (!this.state.profile) {
      return;
    }
    if (this.state.profile.ReleaseSource.Mode === "repeated") {
      const result = addRepeatedReleaseGroup(this.state.profile, this.state.selectedRepeatedGroupId);
      this.state.selectedRepeatedGroupId = result.groupId;
      this.applyProfile(result.profile, true);
      return;
    }
    const result = addManualRelease(this.state.profile, this.state.scrubTime);
    this.applyProfile(result.profile, true);
    this.selectRelease(result.releaseId);
  }

  private handleAddManualRelease(): void {
    if (!this.state.profile || this.state.profile.ReleaseSource.Mode === "repeated") return;
    const result = addManualRelease(this.state.profile, this.state.scrubTime);
    this.state.selectedOrdnanceKind = "event";
    this.applyProfile(result.profile, true);
    this.selectRelease(result.releaseId);
  }

  private handleAddRepeatedGroup(): void {
    if (!this.state.profile || this.state.profile.ReleaseSource.Mode === "manual") return;
    const result = addRepeatedReleaseGroup(this.state.profile, this.state.selectedRepeatedGroupId);
    this.state.selectedRepeatedGroupId = result.groupId;
    this.state.selectedOrdnanceKind = "group";
    this.applyProfile(result.profile, true);
    this.selectRepeatedGroup(result.groupId);
  }

  private handleDuplicateRelease(): void {
    if (!this.state.profile) {
      return;
    }
    if (this.state.profile.ReleaseSource.Mode === "repeated" || (this.state.profile.ReleaseSource.Mode === "mixed" && this.state.selectedOrdnanceKind === "group")) {
      if (!this.state.selectedRepeatedGroupId) {
        return;
      }
      const result = duplicateRepeatedReleaseGroup(this.state.profile, this.state.selectedRepeatedGroupId);
      this.state.selectedRepeatedGroupId = result.groupId;
      this.applyProfile(result.profile, true);
      return;
    }
    if (!this.state.selectedReleaseId) {
      return;
    }
    const result = duplicateManualRelease(this.state.profile, this.state.selectedReleaseId);
    this.applyProfile(result.profile, true);
    this.selectRelease(result.releaseId);
  }

  private handleDeleteRelease(): void {
    if (!this.state.profile) {
      return;
    }
    if (this.state.profile.ReleaseSource.Mode === "repeated" || (this.state.profile.ReleaseSource.Mode === "mixed" && this.state.selectedOrdnanceKind === "group")) {
      if (!this.state.selectedRepeatedGroupId) {
        return;
      }
      const next = deleteRepeatedReleaseGroup(this.state.profile, this.state.selectedRepeatedGroupId);
      this.state.selectedRepeatedGroupId = getRepeatedReleaseGroups(next)[0]?.Id ?? "";
      this.applyProfile(next, true);
      return;
    }
    if (!this.state.selectedReleaseId) {
      return;
    }
    this.applyProfile(deleteManualRelease(this.state.profile, this.state.selectedReleaseId), true);
  }

  private initializeToolWorkspaces(): void {
    this.elements.root.querySelectorAll<HTMLButtonElement>("[data-editor-tool-open]").forEach((button) => {
      button.addEventListener("click", () => this.openTool(String(button.dataset.editorToolOpen || ""), false, button));
    });
    this.elements.root.querySelectorAll<HTMLButtonElement>("[data-editor-tool-ai]").forEach((button) => {
      button.addEventListener("click", () => this.openTool(String(button.dataset.editorToolAi || ""), true, button));
    });
    this.elements.root.querySelectorAll<HTMLDialogElement>("[data-editor-tool-dialog]").forEach((dialog) => {
      this.initializeToolColumns(dialog);
      dialog.addEventListener("cancel", (event) => {
        event.preventDefault();
        void this.requestToolClose();
      });
      dialog.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          void this.requestToolClose();
        }
      });
      dialog.querySelectorAll<HTMLButtonElement>("[data-editor-tool-close]").forEach((button) => button.addEventListener("click", () => void this.requestToolClose()));
      dialog.querySelector<HTMLButtonElement>("[data-editor-tool-minimize]")?.addEventListener("click", () => this.toggleToolMinimized(dialog));
      dialog.querySelector<HTMLButtonElement>("[data-editor-tool-cancel]")?.addEventListener("click", () => void this.cancelActiveTool());
      dialog.querySelector<HTMLButtonElement>("[data-editor-tool-apply]")?.addEventListener("click", () => void this.applyActiveTool());
      const head = dialog.querySelector<HTMLElement>(".airstrike-tool-head");
      head?.addEventListener("pointerdown", (event) => this.startToolDrag(dialog, event));
      head?.addEventListener("dblclick", (event) => {
        if (!(event.target instanceof Element) || !event.target.closest("button, input, select, textarea, a")) {
          this.toggleToolMinimized(dialog);
        }
      });
    });
    window.addEventListener("resize", () => this.constrainOpenToolWindow());
    this.elements.root.querySelectorAll<HTMLButtonElement>("[data-editor-ordnance-tab]").forEach((button) => {
      button.addEventListener("click", () => {
        const tab = String(button.dataset.editorOrdnanceTab || "basic");
        this.ordnanceTab = tab === "targeting" || tab === "advanced" || tab === "audio" ? tab : "basic";
        this.renderOrdnanceTab();
      });
    });
  }

  private isToolId(value: string): value is ToolId {
    return value === "profile" || value === "flight-path" || value === "ordnance" || value === "view-validation";
  }

  private initializeToolColumns(dialog: HTMLDialogElement): void {
    const tool = String(dialog.dataset.editorToolDialog || "");
    if (!this.isToolId(tool)) return;
    const storedState = this.loadToolColumnState(tool);
    dialog.querySelectorAll<HTMLElement>("[data-editor-tool-column]").forEach((column) => {
      const columnId = String(column.dataset.editorToolColumn || "");
      const label = String(column.dataset.editorToolColumnLabel || columnId || "Editor column");
      if (storedState[columnId] === true) column.classList.add("is-collapsed");

      const bar = document.createElement("div");
      const title = document.createElement("strong");
      const button = document.createElement("button");
      bar.className = "airstrike-tool-column-bar";
      title.textContent = label;
      button.type = "button";
      button.className = "airstrike-tool-column-toggle";
      button.dataset.editorToolColumnToggle = columnId;
      bar.append(title, button);
      column.prepend(bar);
      button.addEventListener("click", () => this.toggleToolColumn(dialog, column));
      this.updateToolColumnState(column);
    });
  }

  private toggleToolColumn(dialog: HTMLDialogElement, column: HTMLElement): void {
    column.classList.toggle("is-collapsed");
    this.updateToolColumnState(column);
    this.saveToolColumnState(dialog);
    window.requestAnimationFrame(() => {
      this.constrainToolWindow(dialog);
      this.rememberToolWindowPosition(dialog);
    });
  }

  private updateToolColumnState(column: HTMLElement): void {
    const collapsed = column.classList.contains("is-collapsed");
    const label = String(column.dataset.editorToolColumnLabel || "Editor column");
    const button = column.querySelector<HTMLButtonElement>(":scope > .airstrike-tool-column-bar .airstrike-tool-column-toggle");
    if (!button) return;
    button.textContent = collapsed ? "+" : "\u2212";
    button.setAttribute("aria-expanded", String(!collapsed));
    button.setAttribute("aria-label", `${collapsed ? "Expand" : "Collapse"} ${label}`);
    button.title = `${collapsed ? "Expand" : "Collapse"} ${label}`;
  }

  private toolColumnStorageKey(tool: ToolId): string {
    return `raidlands.airstrike-animation-editor.tool-columns.${tool}`;
  }

  private loadToolColumnState(tool: ToolId): Record<string, boolean> {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(this.toolColumnStorageKey(tool)) || "{}") as unknown;
      if (parsed && !Array.isArray(parsed) && typeof parsed === "object") {
        return Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key, value === true]));
      }
    } catch {
      // Tool columns remain usable when saved preferences are unavailable.
    }
    return {};
  }

  private saveToolColumnState(dialog: HTMLDialogElement): void {
    const tool = String(dialog.dataset.editorToolDialog || "");
    if (!this.isToolId(tool)) return;
    const state: Record<string, boolean> = {};
    dialog.querySelectorAll<HTMLElement>("[data-editor-tool-column]").forEach((column) => {
      const columnId = String(column.dataset.editorToolColumn || "");
      if (columnId) state[columnId] = column.classList.contains("is-collapsed");
    });
    try {
      window.localStorage.setItem(this.toolColumnStorageKey(tool), JSON.stringify(state));
    } catch {
      // Tool columns remain usable when saved preferences are unavailable.
    }
  }

  private openTool(value: string, aiExpanded: boolean, opener: HTMLElement | null = null): void {
    if (!this.isToolId(value) || this.activeTool) return;
    const dialog = this.elements.root.querySelector<HTMLDialogElement>(`[data-editor-tool-dialog="${value}"]`);
    if (!dialog || !this.state.profile) return;
    this.activeTool = value;
    this.activeToolOpener = opener;
    if (value !== "view-validation") {
      this.toolSession = {
        tool: value,
        profile: JSON.parse(JSON.stringify(this.state.profile)) as EditorSourceProfile,
        dirty: this.state.dirty,
        selectedWaypointId: this.state.selectedWaypointId,
        selectedReleaseId: this.state.selectedReleaseId,
        selectedRepeatedGroupId: this.state.selectedRepeatedGroupId,
        selectedOrdnanceKind: this.state.selectedOrdnanceKind,
        scrubTime: this.state.scrubTime,
        opener,
      };
    }
    const rail = dialog.querySelector<HTMLElement>("[data-agent-context-rail]");
    rail?.classList.toggle("is-collapsed", !aiExpanded);
    if (rail) this.updateToolColumnState(rail);
    this.agent.workspaceChanged(value);
    this.updateToolSessionStatus();
    this.renderInspectorSummaries();
    dialog.classList.remove("is-minimized");
    this.updateToolMinimizeButton(dialog, false);
    dialog.show();
    window.requestAnimationFrame(() => this.positionToolWindow(dialog, value));
  }

  private positionToolWindow(dialog: HTMLDialogElement, tool: ToolId): void {
    const saved = this.toolWindowPositions.get(tool) ?? this.loadToolWindowPosition(tool);
    const rect = dialog.getBoundingClientRect();
    const requested = saved ?? {
      left: (window.innerWidth - rect.width) / 2,
      top: Math.max(16, (window.innerHeight - rect.height) / 2),
    };
    this.setToolWindowPosition(dialog, requested.left, requested.top);
  }

  private startToolDrag(dialog: HTMLDialogElement, event: PointerEvent): void {
    if (event.button !== 0 || (event.target instanceof Element && event.target.closest("button, input, select, textarea, a"))) {
      return;
    }
    const head = event.currentTarget as HTMLElement;
    const rect = dialog.getBoundingClientRect();
    const originX = event.clientX;
    const originY = event.clientY;
    dialog.classList.add("is-dragging");
    head.setPointerCapture(event.pointerId);
    event.preventDefault();

    const move = (moveEvent: PointerEvent): void => {
      if (moveEvent.pointerId !== event.pointerId) return;
      this.setToolWindowPosition(dialog, rect.left + moveEvent.clientX - originX, rect.top + moveEvent.clientY - originY);
    };
    const finish = (finishEvent: PointerEvent): void => {
      if (finishEvent.pointerId !== event.pointerId) return;
      head.removeEventListener("pointermove", move);
      head.removeEventListener("pointerup", finish);
      head.removeEventListener("pointercancel", finish);
      if (head.hasPointerCapture(event.pointerId)) head.releasePointerCapture(event.pointerId);
      dialog.classList.remove("is-dragging");
      this.rememberToolWindowPosition(dialog);
    };
    head.addEventListener("pointermove", move);
    head.addEventListener("pointerup", finish);
    head.addEventListener("pointercancel", finish);
  }

  private toggleToolMinimized(dialog: HTMLDialogElement): void {
    const minimized = !dialog.classList.contains("is-minimized");
    dialog.classList.toggle("is-minimized", minimized);
    this.updateToolMinimizeButton(dialog, minimized);
    window.requestAnimationFrame(() => {
      this.constrainToolWindow(dialog);
      this.rememberToolWindowPosition(dialog);
    });
  }

  private updateToolMinimizeButton(dialog: HTMLDialogElement, minimized: boolean): void {
    const button = dialog.querySelector<HTMLButtonElement>("[data-editor-tool-minimize]");
    if (!button) return;
    button.textContent = minimized ? "\u25a1" : "\u2212";
    button.setAttribute("aria-label", minimized ? "Restore tool window" : "Minimize tool window");
    button.title = minimized ? "Restore" : "Minimize";
    button.setAttribute("aria-expanded", String(!minimized));
  }

  private setToolWindowPosition(dialog: HTMLDialogElement, left: number, top: number): void {
    const rect = dialog.getBoundingClientRect();
    const edge = 8;
    const maximumLeft = Math.max(edge, window.innerWidth - rect.width - edge);
    const maximumTop = Math.max(edge, window.innerHeight - rect.height - edge);
    dialog.style.left = `${Math.round(clamp(left, edge, maximumLeft))}px`;
    dialog.style.top = `${Math.round(clamp(top, edge, maximumTop))}px`;
  }

  private constrainToolWindow(dialog: HTMLDialogElement): void {
    if (!dialog.open) return;
    const rect = dialog.getBoundingClientRect();
    this.setToolWindowPosition(dialog, rect.left, rect.top);
  }

  private constrainOpenToolWindow(): void {
    const dialog = this.activeDialog();
    if (dialog) this.constrainToolWindow(dialog);
  }

  private toolWindowStorageKey(tool: ToolId): string {
    return `raidlands.airstrike-animation-editor.tool-window.${tool}`;
  }

  private loadToolWindowPosition(tool: ToolId): ToolWindowPosition | null {
    try {
      const parsed = JSON.parse(window.localStorage.getItem(this.toolWindowStorageKey(tool)) || "null") as Partial<ToolWindowPosition> | null;
      if (parsed && Number.isFinite(parsed.left) && Number.isFinite(parsed.top)) {
        const position = { left: Number(parsed.left), top: Number(parsed.top) };
        this.toolWindowPositions.set(tool, position);
        return position;
      }
    } catch {
      // A remembered position is convenient, but never required to use a tool window.
    }
    return null;
  }

  private rememberToolWindowPosition(dialog: HTMLDialogElement): void {
    const tool = String(dialog.dataset.editorToolDialog || "");
    if (!this.isToolId(tool)) return;
    const rect = dialog.getBoundingClientRect();
    const position = { left: Math.round(rect.left), top: Math.round(rect.top) };
    this.toolWindowPositions.set(tool, position);
    try {
      window.localStorage.setItem(this.toolWindowStorageKey(tool), JSON.stringify(position));
    } catch {
      // Editing remains fully functional when storage is disabled.
    }
  }

  private activeDialog(): HTMLDialogElement | null {
    return this.activeTool ? this.elements.root.querySelector<HTMLDialogElement>(`[data-editor-tool-dialog="${this.activeTool}"]`) : null;
  }

  private toolProfileChanged(): boolean {
    return Boolean(this.toolSession && this.state.profile && canonicalJson(this.toolSession.profile) !== canonicalJson(this.state.profile));
  }

  private updateToolSessionStatus(): void {
    const dialog = this.activeDialog();
    const status = dialog?.querySelector<HTMLElement>("[data-editor-tool-session-status]");
    if (status) status.textContent = this.toolProfileChanged() ? "Preview changes are not applied" : "No unapplied changes";
  }

  private async requestToolClose(): Promise<void> {
    if (!this.activeTool) return;
    if (this.toolSession && this.toolProfileChanged() && !window.confirm("Discard the preview changes in this workspace?")) return;
    if (this.toolSession) await this.cancelActiveTool();
    else this.closeActiveTool();
  }

  private async applyActiveTool(): Promise<void> {
    const session = this.toolSession;
    if (!session || !this.state.profile) return;
    const changed = this.toolProfileChanged();
    await this.agent.commitWorkspaceProposal(this.state.profile);
    this.toolSession = null;
    if (changed) this.markEdited();
    this.closeActiveTool(session.opener);
  }

  private async cancelActiveTool(): Promise<void> {
    const session = this.toolSession;
    if (!session) {
      this.closeActiveTool();
      return;
    }
    this.state.selectedWaypointId = session.selectedWaypointId;
    this.state.selectedReleaseId = session.selectedReleaseId;
    this.state.selectedRepeatedGroupId = session.selectedRepeatedGroupId;
    this.state.selectedOrdnanceKind = session.selectedOrdnanceKind;
    this.state.scrubTime = session.scrubTime;
    this.applyProfile(JSON.parse(JSON.stringify(session.profile)) as EditorSourceProfile, false);
    this.setDirty(session.dirty);
    await this.agent.cancelWorkspaceProposal();
    this.toolSession = null;
    this.setStatus(session.dirty ? "Draft has local changes" : "Workspace changes discarded");
    this.closeActiveTool(session.opener);
  }

  private closeActiveTool(opener: HTMLElement | null = null): void {
    const dialog = this.activeDialog();
    if (dialog?.open) {
      this.rememberToolWindowPosition(dialog);
      dialog.close();
      dialog.classList.remove("is-minimized", "is-dragging");
    }
    this.activeTool = null;
    this.agent.workspaceChanged("full");
    this.renderInspectorSummaries();
    (opener ?? this.activeToolOpener)?.focus();
    this.activeToolOpener = null;
  }

  private allowedMutationAreas(scope: AgentWorkspaceScope): string[] {
    if (scope === "profile") return ["profile"];
    if (scope === "flight-path") return ["route", "waypoint"];
    if (scope === "ordnance") return ["ordnance"];
    if (scope === "view-validation") return [];
    return ["profile", "route", "waypoint", "ordnance"];
  }

  private renderInspectorSummaries(): void {
    const profile = this.state.profile;
    if (!profile) return;
    const set = (selector: string, value: string): void => {
      const element = this.elements.root.querySelector<HTMLElement>(selector);
      if (element) element.textContent = value;
    };
    set("[data-editor-summary-profile]", profile.DisplayName || profile.ProfileKey || "New profile");
    set("[data-editor-summary-profile-detail]", `${profile.ProfileKey || "unsaved"} · ${profile.Vehicle}`);
    set("[data-editor-summary-flight]", `${profile.Waypoints.length} waypoints · ${profile.DurationSeconds.toFixed(2)}s`);
    const waypoint = findWaypoint(profile, this.state.selectedWaypointId);
    set("[data-editor-summary-flight-detail]", waypoint ? `${waypoint.Id} at ${waypoint.Time.toFixed(2)}s · Y ${waypoint.Y}` : "No waypoint selected.");
    const events = profile.ReleaseSource.Mode === "repeated" ? [] : profile.ReleaseSource.Events;
    const groups = getRepeatedReleaseGroups(profile);
    const manualUnits = events.reduce((sum, event) => sum + Math.max(1, Number(event.Count || 1)), 0);
    const generatedUnits = groups.reduce((sum, group) => sum + Math.max(0, Number(group.MaximumUnits || 0)), 0);
    set("[data-editor-summary-ordnance]", `${events.length} events · ${groups.length} groups · ${manualUnits + generatedUnits} units`);
    const selected = this.state.selectedOrdnanceKind === "group"
      ? groups.find((group) => group.Id === this.state.selectedRepeatedGroupId)?.Name
      : events.find((event) => event.Id === this.state.selectedReleaseId)?.Id;
    set("[data-editor-summary-ordnance-detail]", `${profile.ReleaseSource.Mode} mode${selected ? ` · ${selected}` : ""}`);
    const validation = this.validationState.status === "passed" ? `Valid${this.validationState.warnings ? ` · ${this.validationState.warnings} warnings` : ""}` : this.validationState.status === "failed" ? `${this.validationState.errors} validation errors` : this.validationState.status === "running" ? "Validating…" : "Not validated";
    set("[data-editor-summary-validation]", validation);
    const visibleLayers = [this.elements.terrainReference.checked, this.elements.groundGrid.checked, this.elements.sceneExtras.checked].filter(Boolean).length;
    set("[data-editor-summary-validation-detail]", `${visibleLayers} of 3 reference layers visible.`);
  }

  private renderOrdnanceScheduleSummary(): void {
    const profile = this.state.profile;
    if (!profile) return;
    const releases = getReleasePreviewEvents(profile, this.metadata);
    const last = releases.reduce((maximum, release) => Math.max(maximum, release.time), 0);
    this.elements.ordnanceScheduleSummary.textContent = `${releases.length} preview releases · final release ${last.toFixed(3)}s · flight ${profile.DurationSeconds.toFixed(2)}s`;
  }

  private renderOrdnanceTab(): void {
    this.elements.root.querySelectorAll<HTMLButtonElement>("[data-editor-ordnance-tab]").forEach((button) => button.classList.toggle("is-active", button.dataset.editorOrdnanceTab === this.ordnanceTab));
    this.elements.root.querySelectorAll<HTMLElement>("[data-ordnance-section]").forEach((section) => {
      section.hidden = section.dataset.ordnanceSection !== this.ordnanceTab;
    });
  }

  private stepInspectorSelection(specification: string): void {
    if (!this.state.profile) return;
    const [kind, directionText] = specification.split(":");
    const direction = Number(directionText) < 0 ? -1 : 1;
    if (kind === "waypoint") {
      const ids = this.state.profile.Waypoints.map((waypoint) => waypoint.Id);
      if (!ids.length) return;
      const index = Math.max(0, ids.indexOf(this.state.selectedWaypointId));
      this.selectWaypoint(ids[(index + direction + ids.length) % ids.length]!);
      this.renderInspectorSummaries();
      return;
    }
    const events = this.state.profile.ReleaseSource.Mode === "repeated" ? [] : this.state.profile.ReleaseSource.Events.map((event) => ({ kind: "event" as const, id: event.Id }));
    const groups = getRepeatedReleaseGroups(this.state.profile).map((group) => ({ kind: "group" as const, id: group.Id }));
    const items = [...events, ...groups];
    if (!items.length) return;
    const current = items.findIndex((item) => item.kind === this.state.selectedOrdnanceKind && item.id === (item.kind === "event" ? this.state.selectedReleaseId : this.state.selectedRepeatedGroupId));
    const item = items[((current < 0 ? 0 : current) + direction + items.length) % items.length]!;
    if (item.kind === "event") this.selectRelease(item.id);
    else this.selectRepeatedGroup(item.id);
    this.renderInspectorSummaries();
  }

  private navigateAgentDiff(area: string, id: string): void {
    if (!this.state.profile) return;
    if (area === "waypoint" && id) this.selectWaypoint(id);
    if ((area === "ordnance" || area === "ordnance event" || area === "ordnance group") && id && id !== "mode") {
      const isGroup = area === "ordnance group" || getRepeatedReleaseGroups(this.state.profile).some((entry) => entry.Id === id);
      if (isGroup) this.selectRepeatedGroup(id);
      else this.selectRelease(id);
    }
    this.renderInspectorSummaries();
  }

  private async openFullAgentFromWorkspace(): Promise<void> {
    if (this.activeTool) await this.requestToolClose();
    if (!this.activeTool) this.agent.showAgentTab();
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
        mapImage?: {
          url?: unknown;
          publicUrl?: unknown;
          textureUrl?: unknown;
          terrainUrl?: unknown;
          heightmapUrl?: unknown;
          skyboxUrl?: unknown;
          skyboxPublicUrl?: unknown;
        };
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
        skyboxUrl:
          typeof payload.mapImage?.skyboxUrl === "string"
            ? payload.mapImage.skyboxUrl
            : typeof payload.mapImage?.skyboxPublicUrl === "string"
              ? payload.mapImage.skyboxPublicUrl
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

  private previewProfileUpdate(source: EditorSourceProfile, dirty: boolean, refreshViewport = true): void {
    this.state.profile = source;
    this.state.selectedWaypointId = findWaypoint(source, this.state.selectedWaypointId)?.Id || firstWaypointId(source);
    this.ensureSelectedRelease(source);
    this.state.scrubTime = clamp(this.state.scrubTime, 0, Number(source.DurationSeconds || 0));
    this.writeSource(source);
    this.syncControlsFromSource(source);
    this.renderWaypoints();
    this.renderSpeedControls();
    this.renderTimeControls();
    if (refreshViewport) {
      this.viewport.updateProfile(source, this.state.selectedWaypointId, this.state.scrubTime);
      this.viewport.updateSelectedRelease(this.state.selectedReleaseId);
    }
    if (dirty) {
      this.markEdited();
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
      const monuments = Array.isArray(payload.monuments)
        ? payload.monuments
            .map((entry): MonumentReferencePayload | null => {
              const monument = entry && typeof entry === "object" ? (entry as Partial<MonumentReferencePayload>) : {};
              const x = Number(monument.x);
              const y = Number(monument.y);
              const z = Number(monument.z);
              if (![x, y, z].every(Number.isFinite)) {
                return null;
              }
              return {
                name: String(monument.name || "Monument").slice(0, 80),
                prefab: String(monument.prefab || "").slice(0, 160),
                kind: String(monument.kind || monument.name || monument.prefab || "monument").slice(0, 80),
                x,
                y,
                z,
                radius: Math.max(18, Math.min(280, Number(monument.radius) || 55)),
                rotationY: Number.isFinite(Number(monument.rotationY)) ? Number(monument.rotationY) : 0,
              };
            })
            .filter((entry): entry is MonumentReferencePayload => entry !== null)
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
        monuments,
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
      await this.agent.profileChanged(profileKey);
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
    void this.agent.profileChanged("new_airstrike_profile");
  }

  private async duplicateCurrentProfile(): Promise<void> {
    if (!this.state.profileKey || this.state.baseVersion <= 0) {
      this.showFeedback("Save this profile before duplicating it.", "error");
      this.setStatus("Duplicate needs a saved profile");
      return;
    }
    if (this.state.dirty) {
      this.showFeedback("Save or discard local changes before duplicating this profile.", "error");
      this.setStatus("Duplicate blocked by unsaved changes");
      return;
    }

    const currentName = String(this.state.profile?.DisplayName || this.state.profileKey);
    const defaultName = `${currentName} Copy`;
    const displayName = window.prompt("Name for the duplicated airstrike profile:", defaultName);
    if (displayName === null) {
      return;
    }

    const defaultKey = this.nextCopyProfileKey(this.state.profileKey);
    const enteredKey = window.prompt("ProfileKey for the duplicated airstrike profile:", defaultKey);
    if (enteredKey === null) {
      return;
    }
    const newProfileKey = this.cleanProfileKey(enteredKey);
    if (!newProfileKey) {
      this.showFeedback("ProfileKey must start with a letter or number and use only letters, numbers, dots, dashes, or underscores.", "error");
      return;
    }

    const sourceProfileKey = this.state.profileKey;
    this.setStatus(`Duplicating ${sourceProfileKey}...`);
    try {
      const payload = await this.request("duplicate.php", {
        method: "POST",
        body: JSON.stringify({
          profileKey: sourceProfileKey,
          newProfileKey,
          displayName: displayName.trim() || defaultName,
        }),
      });
      const profile = payload.profile as { source?: EditorSourceProfile; profileKey?: string; draftVersion?: number };
      const loadedKey = String(profile.profileKey || newProfileKey);
      this.loadSource(profile.source ?? starterSource(), loadedKey, Number(profile.draftVersion || 0));
      await this.loadList();
      window.history.replaceState({}, "", `./airstrike-animation-editor.php?profile=${encodeURIComponent(loadedKey)}`);
      this.showFeedback(`Duplicated ${sourceProfileKey} as ${loadedKey}.`, "success");
      this.setStatus(`Duplicated draft v${String(profile.draftVersion || 1)} loaded`);
      await this.agent.profileChanged(loadedKey);
    } catch (error) {
      this.showFeedback(error instanceof Error ? error.message : String(error), "error");
      this.setStatus("Duplicate failed");
    }
  }

  private nextCopyProfileKey(profileKey: string): string {
    const base = this.cleanProfileKey(`${profileKey}-copy`) || "airstrike-copy";
    const existing = new Set(this.state.profiles.map((profile) => profile.profileKey));
    if (!existing.has(base)) {
      return base;
    }
    for (let index = 2; index < 1000; index += 1) {
      const candidate = `${base}-${index}`;
      if (!existing.has(candidate)) {
        return candidate;
      }
    }
    return `${base}-${Date.now()}`;
  }

  private cleanProfileKey(value: string): string {
    const key = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, "-")
      .replace(/^[^a-z0-9]+/, "")
      .slice(0, 100);
    return /^[a-z0-9][a-z0-9._-]{0,99}$/.test(key) ? key : "";
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
    this.persistRecoveryDraft(JSON.stringify(source, null, 2));
    try {
      const path = this.state.baseVersion > 0 ? "save.php" : "create.php";
      const body =
        this.state.baseVersion > 0
          ? { profileKey: this.state.profileKey, baseVersion: this.state.baseVersion, source, agentProposalId: this.agent.proposalIdForSave() }
          : { source, agentProposalId: this.agent.proposalIdForSave() };
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
      await this.agent.profileSaved(String(profile.profileKey || source.ProfileKey));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const recoveryGuidance = error instanceof EditorRequestError && [401, 403, 419].includes(error.status)
        ? "A local recovery copy was kept in this browser. Sign back in, reload this editor, and restore the recovery draft if prompted."
        : error instanceof EditorRequestError && error.status === 422
          ? "A local recovery copy was kept in this browser. Correct the reported value and save again; reloading or signing in is not required."
          : "A local recovery copy was kept in this browser. You can retry without reloading; sign back in only if your admin session expired.";
      this.showFeedback(`${message}\n\n${recoveryGuidance}`, "error");
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
    this.validationState = { status: "running", errors: 0, warnings: 0 };
    this.renderInspectorSummaries();
    try {
      const payload = await this.request("validate.php", {
        method: "POST",
        body: JSON.stringify({ source }),
      });
      const validation = (payload.validation || {}) as { ok?: boolean; errors?: unknown[]; warnings?: unknown[] };
      const errors = Array.isArray(validation.errors) ? validation.errors : [];
      const warnings = Array.isArray(validation.warnings) ? validation.warnings : [];
      if (!validation.ok) {
        this.validationState = { status: "failed", errors: errors.length, warnings: warnings.length };
        this.showFeedback(errors.map(formatValidationEntry).join("\n"), "error");
        this.setStatus(`${errors.length} validation error(s)`);
        this.renderInspectorSummaries();
        return;
      }
      this.validationState = { status: "passed", errors: 0, warnings: warnings.length };
      this.showFeedback(`Profile is valid.${warnings.length ? `\n${warnings.map(String).join("\n")}` : ""}`, "success");
      this.setStatus("Validation passed");
      this.renderInspectorSummaries();
    } catch (error) {
      this.validationState = { status: "failed", errors: 1, warnings: 0 };
      this.showFeedback(error instanceof Error ? error.message : String(error), "error");
      this.setStatus("Validation failed");
      this.renderInspectorSummaries();
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
      const compiled = (payload.compiled || {}) as { runtime?: { CompiledTrack?: { Frames?: unknown[] }; PayloadEvents?: Array<{ Count?: number }>; GeneratedReleaseGroups?: Array<{ MaximumUnits?: number }> } };
      const runtime = compiled.runtime || {};
      const frames = Array.isArray(runtime.CompiledTrack?.Frames) ? runtime.CompiledTrack.Frames : [];
      const manualUnits = Array.isArray(runtime.PayloadEvents) ? runtime.PayloadEvents.reduce((sum, event) => sum + Number(event.Count || 1), 0) : 0;
      const generatedUnits = Array.isArray(runtime.GeneratedReleaseGroups) ? runtime.GeneratedReleaseGroups.reduce((sum, group) => sum + Number(group.MaximumUnits || 0), 0) : 0;
      this.elements.compileSummary.textContent = `${frames.length} frames | ${manualUnits} manual + ${generatedUnits} generated payload units`;
      this.elements.output.textContent = JSON.stringify(compiled, null, 2);
      this.elements.compileSummaryReview.textContent = this.elements.compileSummary.textContent;
      this.elements.outputReview.textContent = this.elements.output.textContent;
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
    notes: query(root, "[data-editor-notes]"),
    feedback: query(root, "[data-editor-feedback]"),
    feedbackSummary: query(root, "[data-editor-feedback-summary]"),
    output: query(root, "[data-editor-output]"),
    outputReview: query(root, "[data-editor-output-review]"),
    compileSummary: query(root, "[data-editor-compile-summary]"),
    compileSummaryReview: query(root, "[data-editor-compile-summary-review]"),
    list: query(root, "[data-editor-profile-list]"),
    search: query(root, "[data-editor-search]"),
    profileFilter: query(root, "[data-editor-profile-filter]"),
    profileSort: query(root, "[data-editor-profile-sort]"),
    profileTabs: query(root, "[data-editor-profile-tabs]"),
    profileCount: query(root, "[data-editor-profile-count]"),
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
    rotationMode: query(root, "[data-editor-rotation-mode]"),
    releaseMode: query(root, "[data-editor-release-mode]"),
    manualReleaseList: query(root, "[data-editor-manual-releases]"),
    repeatedReleaseList: query(root, "[data-editor-repeated-releases]"),
    manualReleaseEditor: query(root, "[data-editor-manual-editor]"),
    repeatedReleaseEditor: query(root, "[data-editor-repeated-editor]"),
    audioEditor: query(root, "[data-editor-audio-editor]"),
    releaseTimeline: query(root, "[data-editor-release-timeline]"),
    workspaceReleaseTimeline: query(root, "[data-editor-workspace-release-timeline]"),
    ordnanceScheduleSummary: query(root, "[data-editor-ordnance-schedule-summary]"),
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
