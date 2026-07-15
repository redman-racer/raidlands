export const CAMERA_MODES = ["director", "action", "orbit", "top", "cinematic", "manual"] as const;

export type CameraMode = (typeof CAMERA_MODES)[number];
export type ManualCameraStyle = "orbit" | "fly";

export type CameraPreferences = {
  mode: CameraMode;
  manualStyle: ManualCameraStyle;
  browserFill: boolean;
  terrainFingerprint: string;
};

export const DEFAULT_CAMERA_PREFERENCES: CameraPreferences = {
  mode: "director",
  manualStyle: "orbit",
  browserFill: false,
  terrainFingerprint: "",
};

export function parseCameraMode(value: unknown, fallback: CameraMode = "director"): CameraMode {
  return typeof value === "string" && (CAMERA_MODES as readonly string[]).includes(value)
    ? value as CameraMode
    : fallback;
}

export function parseCameraPreferences(value: string | null): CameraPreferences {
  if (!value) return { ...DEFAULT_CAMERA_PREFERENCES };
  try {
    const parsed = JSON.parse(value) as Partial<CameraPreferences>;
    return {
      mode: parseCameraMode(parsed.mode),
      manualStyle: parsed.manualStyle === "fly" ? "fly" : "orbit",
      // Browser-fill is deliberately session-only. Persisting it can reload a
      // mobile user into a fixed viewport with no reliable escape path.
      browserFill: false,
      terrainFingerprint: typeof parsed.terrainFingerprint === "string" ? parsed.terrainFingerprint : "",
    };
  } catch {
    return { ...DEFAULT_CAMERA_PREFERENCES };
  }
}

export function clampMapCoordinate(value: number, worldSize: number, margin = 0): number {
  const half = Math.max(1, worldSize) / 2;
  return Math.min(half - margin, Math.max(-half + margin, value));
}

export function cameraHeightAboveTerrain(requestedY: number, terrainY: number, clearance = 12): number {
  return Math.max(requestedY, terrainY + clearance);
}

export function shouldResumeAutomaticCamera(now: number, pausedUntil: number): boolean {
  return pausedUntil > 0 && now >= pausedUntil;
}

export function transitionNeedsSafeWaypoint(
  from: { x: number; y: number; z: number },
  to: { x: number; y: number; z: number },
  terrainHeightAt: (x: number, z: number) => number,
  clearance: number,
  samples = 16,
): boolean {
  for (let index = 0; index <= samples; index += 1) {
    const progress = index / Math.max(1, samples);
    const x = from.x + (to.x - from.x) * progress;
    const y = from.y + (to.y - from.y) * progress;
    const z = from.z + (to.z - from.z) * progress;
    if (y < terrainHeightAt(x, z) + clearance) return true;
  }
  return false;
}
