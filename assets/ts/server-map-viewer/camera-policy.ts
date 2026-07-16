export const CAMERA_MODES = ["director", "action", "orbit", "top", "cinematic", "manual"] as const;

export type CameraMode = (typeof CAMERA_MODES)[number];
export type ManualCameraStyle = "orbit" | "fly";

export type CameraBounds = {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
};

export type CameraBoundsFeature = {
  x: number;
  z: number;
  radius?: number;
};

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

/**
 * Rust can place offshore monuments outside the square sampled by the height
 * map. Keep a bounded, data-driven allowance for those real map features
 * while rejecting obviously invalid coordinates from an incoming payload.
 */
export function offshoreCameraCoordinateLimit(worldSize: number): number {
  const safeWorldSize = Math.max(1, worldSize);
  return safeWorldSize / 2 + Math.min(1400, Math.max(350, safeWorldSize * 0.35));
}

export function resolveCameraBounds(worldSize: number, features: CameraBoundsFeature[] = []): CameraBounds {
  const safeWorldSize = Math.max(1, worldSize);
  const half = safeWorldSize / 2;
  const coordinateLimit = offshoreCameraCoordinateLimit(safeWorldSize);
  const featurePadding = Math.min(280, Math.max(100, safeWorldSize * 0.055));
  const bounds: CameraBounds = { minX: -half, maxX: half, minZ: -half, maxZ: half };

  features.forEach((feature) => {
    if (!Number.isFinite(feature.x) || !Number.isFinite(feature.z)
      || Math.abs(feature.x) > coordinateLimit || Math.abs(feature.z) > coordinateLimit) {
      return;
    }

    const radius = Math.min(280, Math.max(0, Number(feature.radius) || 0));
    const reach = radius + featurePadding;
    bounds.minX = Math.min(bounds.minX, feature.x - reach);
    bounds.maxX = Math.max(bounds.maxX, feature.x + reach);
    bounds.minZ = Math.min(bounds.minZ, feature.z - reach);
    bounds.maxZ = Math.max(bounds.maxZ, feature.z + reach);
  });

  return bounds;
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
