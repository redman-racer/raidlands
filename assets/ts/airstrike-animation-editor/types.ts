export const EDITOR_SOURCE_SCHEMA_VERSION = 1 as const;
export const RUNTIME_SCHEMA_VERSION = 2 as const;
export const DEFAULT_COMPILER_VERSION = "raidlands-airanim-1";
export const RUNTIME_COORDINATE_SYSTEM = "unity-target-relative-local-v1";
export const DEFAULT_SAMPLE_RATE_HZ = 30;

export const SUPPORTED_VEHICLES = [
  "drone",
  "cargo_plane",
  "f15",
  "a10",
  "attack_heli",
] as const;

export type SupportedVehicle = (typeof SUPPORTED_VEHICLES)[number];

export const SUPPORTED_PAYLOADS = [
  "bee_grenade",
  "bee_catapult_bomb",
  "beancan",
  "f1_grenade",
  "smoke",
  "flashbang",
  "he_40mm",
  "molotov",
  "firebomb",
  "propane_bomb",
  "hv_rocket",
  "rocket",
  "incendiary_rocket",
  "mortar_he_payload",
  "mortar_frag_payload",
  "bradley_longbarrel_burst",
  "homing_missile",
  "mlrs_rocket",
] as const;

export type SupportedPayload = (typeof SUPPORTED_PAYLOADS)[number];

export interface Vector3Value {
  x: number;
  y: number;
  z: number;
}

export interface QuaternionValue {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface SourceWaypoint {
  Id: string;
  Time: number;
  X: number;
  Y: number;
  Z: number;
  RotationX: number;
  RotationY: number;
  RotationZ: number;
  TargetSpeedMetersPerSecond?: number;
}

export interface PayloadEventFields {
  Payload: string;
  Count: number;
  CarrierOffsetX: number;
  CarrierOffsetY: number;
  CarrierOffsetZ: number;
  TargetOffsetX: number;
  TargetOffsetY: number;
  TargetOffsetZ: number;
  SpreadRadius: number;
  LaunchSpeed: number;
  FuseSeconds: number;
  DamageScale: number;
  VehicleDamageScale: number;
  SplashRadius: number;
  ImpactRadius: number;
  MaxTrackingSeconds: number;
  MaxTrackingDistance: number;
  DamageScales: Record<string, number>;
}

export interface SourcePayloadEvent extends PayloadEventFields {
  Id: string;
  Time: number;
  HardpointId?: string;
}

export interface ManualReleaseSource {
  Mode: "manual";
  Events: SourcePayloadEvent[];
  /**
   * Imported schema-1 profiles may intentionally have no explicit events. In
   * that mode the Rust executor supplies its own requested payload count and
   * the compiler must omit CompiledReleaseEvents.
   */
  LegacyDynamic?: boolean;
  MaximumUnits?: number;
  FallbackIntervalSeconds?: number;
  Template?: PayloadEventFields;
}

export interface RepeatedReleaseSource {
  Mode: "repeated";
  /** New grouped authoring shape. Older saved profiles use the legacy fields below. */
  Groups?: RepeatedReleaseGroup[];
  StartTime?: number;
  IntervalSeconds?: number;
  UnitsPerRelease?: number;
  MaximumUnits?: number;
  Template?: PayloadEventFields;
  HardpointSequence?: string[];
  LegacyDynamic?: boolean;
}

export interface RepeatedReleaseGroup {
  Id: string;
  Name: string;
  StartTime: number;
  IntervalSeconds: number;
  UnitsPerRelease: number;
  MaximumUnits: number;
  Template: PayloadEventFields;
  HardpointSequence: string[];
}

export type ReleaseSource = ManualReleaseSource | RepeatedReleaseSource;

export interface SourceHardpointOverride {
  Id: string;
  X: number;
  Y: number;
  Z: number;
}

export interface VehiclePreviewOverrides {
  Scale?: number;
  PositionCorrection?: { X: number; Y: number; Z: number };
  RotationCorrection?: { X: number; Y: number; Z: number };
  Hardpoints?: SourceHardpointOverride[];
}

export interface EditorMetadata {
  Notes: string;
  Tags: string[];
  VehiclePreviewOverrides: VehiclePreviewOverrides;
  GlobalTargetSpeedMetersPerSecond?: number;
}

export interface EditorSourceProfile {
  EditorSourceSchemaVersion: 1;
  ProfileKey: string;
  DisplayName: string;
  Vehicle: string;
  DurationSeconds: number;
  FirstPayloadDelaySeconds: number;
  RotationSmoothTimeSeconds: number;
  StopAtWaypoints: boolean;
  MinimumTerrainClearance: number;
  PositionInterpolation: "time_hermite";
  RotationMode: "follow_path_plus_offset" | "authored_orientation";
  Waypoints: SourceWaypoint[];
  ReleaseSource: ReleaseSource;
  EditorMetadata: EditorMetadata;
}

export interface EditorSourceBundle {
  EditorSourceSchemaVersion: 1;
  AllowDangerousPayloadPreview: boolean;
  Profiles: Record<string, EditorSourceProfile>;
}

export interface RuntimeWaypoint {
  Time: number;
  X: number;
  Y: number;
  Z: number;
  RotationX: number;
  RotationY: number;
  RotationZ: number;
}

export interface RuntimePayloadEvent extends PayloadEventFields {
  Time: number;
  Index: number;
}

export interface CompiledVisualFrame {
  Time: number;
  X: number;
  Y: number;
  Z: number;
  Qx: number;
  Qy: number;
  Qz: number;
  Qw: number;
}

export interface CompiledVisualTrack {
  CompilerVersion: string;
  SourceHash: string;
  CoordinateSystem: typeof RUNTIME_COORDINATE_SYSTEM;
  SampleRateHz: number;
  SampleIntervalSeconds: number;
  DurationSeconds: number;
  Frames: CompiledVisualFrame[];
}

export interface RuntimeVisualProfile {
  Vehicle: string;
  DurationSeconds: number;
  FirstPayloadDelaySeconds: number;
  PayloadReleaseMode: "manual" | "generated";
  MaxPayloadCount: number;
  PayloadReleaseIntervalSeconds: number;
  ReleaseTemplate: RuntimePayloadEvent;
  RotationSmoothTimeSeconds: number;
  StopAtWaypoints: boolean;
  MinimumTerrainClearance: number;
  Waypoints: RuntimeWaypoint[];
  PayloadEvents: RuntimePayloadEvent[];
  CompiledTrack: CompiledVisualTrack;
  CompiledReleaseEvents?: RuntimePayloadEvent[];
}

export interface RuntimeVisualProfileFile {
  SchemaVersion: 2;
  CompilerVersion: string;
  PublishedRevision: number;
  AllowDangerousPayloadPreview: boolean;
  Profiles: Record<string, RuntimeVisualProfile>;
}

export interface LegacyVisualProfileFile {
  SchemaVersion?: number;
  AllowDangerousPayloadPreview?: boolean;
  Profiles?: Record<string, Partial<RuntimeVisualProfile>>;
}

export interface VehicleHardpointMetadata {
  id: string;
  x: number;
  y: number;
  z: number;
}

export interface VehiclePreviewMetadata {
  vehicle: string;
  modelUrl: string;
  prefabLabel?: string;
  scale: number;
  positionCorrection: Vector3Value;
  rotationCorrection: Vector3Value;
  bounds: Vector3Value;
  mapDisplaySize?: number;
  visualOriginY?: number;
  proxy?: "drone" | "plane" | "helicopter" | "ground" | "ship";
  hardpoints: VehicleHardpointMetadata[];
}

export interface VehiclePreviewMetadataFile {
  schemaVersion: 1;
  vehicles: Record<string, VehiclePreviewMetadata>;
}

export interface CompileOptions {
  publishedRevision: number;
  compilerVersion?: string;
  sampleRateHz?: number;
  vehicleMetadata?: VehiclePreviewMetadataFile;
}

export interface CompiledProfileResult {
  profile: RuntimeVisualProfile;
  sourceHash: string;
}

export interface CompiledBundleResult {
  bundle: RuntimeVisualProfileFile;
  canonicalJson: string;
  sha256: string;
  sourceHashes: Record<string, string>;
}

export interface ValidationIssue {
  path: string;
  code: string;
  message: string;
}

export class SourceValidationError extends Error {
  public readonly issues: ValidationIssue[];

  public constructor(issues: ValidationIssue[]) {
    super(issues.map((issue) => `${issue.path}: ${issue.message}`).join("\n"));
    this.name = "SourceValidationError";
    this.issues = issues;
  }
}

export const DEFAULT_PAYLOAD_EVENT: PayloadEventFields = {
  Payload: "",
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
};
