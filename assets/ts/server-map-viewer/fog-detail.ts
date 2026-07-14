export type FogDetail = "low" | "medium" | "max";

export type FogCapabilities = {
  depthTexture: boolean;
  floatTexture: boolean;
  highPrecisionFragment: boolean;
  webgl2: boolean;
};

export function parseFogDetail(value: unknown, fallback: FogDetail = "max"): FogDetail {
  const normalized = String(value ?? "").trim().toLowerCase();
  return normalized === "low" || normalized === "medium" || normalized === "max"
    ? normalized
    : fallback;
}

export function resolveFogDetail(requested: FogDetail, capabilities: FogCapabilities): FogDetail {
  const supportsMedium = capabilities.depthTexture && capabilities.floatTexture;
  const supportsMax = supportsMedium && capabilities.webgl2 && capabilities.highPrecisionFragment;
  if (requested === "max" && supportsMax) return "max";
  if (requested !== "low" && supportsMedium) return "medium";
  return "low";
}

export function fogRayMarchSamples(detail: FogDetail): number {
  return detail === "max" ? 44 : detail === "medium" ? 24 : 0;
}

export function lowDetailFogNearVisibility(fogStrength: number, normalizedDistance: number): number {
  const strength = Math.min(1, Math.max(0, fogStrength));
  const distance = Math.min(1, Math.max(0, normalizedDistance));
  const denseAmount = smoothstep(0.62, 0.9, strength);
  const closeFade = smoothstep(0.015, 0.085, distance);
  return 1 - denseAmount * (1 - closeFade) * 0.72;
}

function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - edge0) / Math.max(0.000001, edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
