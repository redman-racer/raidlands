export type DirectorMode = "director" | "action" | "cinematic";
export type DirectorPerformanceTier = "healthy" | "constrained" | "low";
export type DirectorShotKind = "scenic" | "action" | "hero";

export type DirectorPoint = { x: number; y: number; z: number };

export type DirectorEnvironment = {
  sunDirection: DirectorPoint;
  fogIntensity: number;
  rainIntensity: number;
  cloudCoverage: number;
};

export type DirectorLandscapeFeature = {
  id: string;
  kind: "peak" | "ridge" | "coast" | "monument" | "center";
  position: DirectorPoint;
  radius: number;
  prominence: number;
};

export type DirectorActionSubject = {
  id: string;
  kind: "overlay" | "event" | "vehicle";
  position: DirectorPoint;
  radius: number;
  weight: number;
  updatedAt: number;
  vehicle?: string;
  destroyed?: boolean;
  route?: DirectorPoint[];
};

export type DirectorFpsState = {
  smoothedFps: number;
  tier: DirectorPerformanceTier;
};

export type DirectorShotTiming = {
  transitionMs: number;
  holdMs: number;
  motionScale: number;
};

export type DirectorShotPlan = DirectorShotTiming & {
  id: string;
  kind: DirectorShotKind;
  position: DirectorPoint;
  target: DirectorPoint;
  fov: number;
  score: number;
  subjectId?: string;
  heroRoute?: DirectorPoint[];
};

export type DirectorShotInput = {
  mode: DirectorMode;
  worldSize: number;
  waterLevel: number;
  environment: DirectorEnvironment;
  features: DirectorLandscapeFeature[];
  actions: DirectorActionSubject[];
  performanceTier: DirectorPerformanceTier;
  recentShotIds: string[];
  shotSequence: number;
  lastHeroSequence: number;
};

const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value));
const lerp = (from: number, to: number, amount: number): number => from + (to - from) * amount;

export function updateDirectorFpsState(
  state: DirectorFpsState,
  frameMs: number,
  smoothing = 0.08,
): DirectorFpsState {
  if (!(frameMs > 0) || frameMs > 250) return state;
  const fps = clamp(1000 / frameMs, 1, 120);
  const smoothedFps = lerp(state.smoothedFps || fps, fps, clamp(smoothing, 0.01, 1));
  let tier = state.tier;
  if (tier === "healthy") {
    if (smoothedFps < 28) tier = "low";
    else if (smoothedFps < 43) tier = "constrained";
  } else if (tier === "constrained") {
    if (smoothedFps < 26) tier = "low";
    else if (smoothedFps > 47) tier = "healthy";
  } else if (smoothedFps > 32) {
    tier = smoothedFps > 47 ? "healthy" : "constrained";
  }
  return { smoothedFps, tier };
}

export function directorShotTiming(tier: DirectorPerformanceTier, sequence = 0): DirectorShotTiming {
  const variation = ((sequence * 37) % 5) * 350;
  if (tier === "low") return { transitionMs: 6000 + variation, holdMs: 21000 + variation, motionScale: 0.12 };
  if (tier === "constrained") return { transitionMs: 4600 + variation, holdMs: 17000 + variation, motionScale: 0.48 };
  return { transitionMs: 3400 + variation, holdMs: 13500 + variation, motionScale: 1 };
}

export function cameraYForTerrainSightline(
  requestedY: number,
  from: Pick<DirectorPoint, "x" | "z">,
  target: DirectorPoint,
  terrainHeightAt: (x: number, z: number) => number,
  clearance = 12,
  samples = 12,
): number {
  let requiredY = requestedY;
  for (let index = 1; index < samples; index += 1) {
    const progress = index / samples;
    const x = lerp(from.x, target.x, progress);
    const z = lerp(from.z, target.z, progress);
    const requiredAtSample = terrainHeightAt(x, z) + clearance;
    requiredY = Math.max(requiredY, (requiredAtSample - target.y * progress) / Math.max(0.001, 1 - progress));
  }
  return requiredY;
}

export function selectDirectorShot(input: DirectorShotInput): DirectorShotPlan {
  const worldSize = Math.max(100, input.worldSize);
  const timing = directorShotTiming(input.performanceTier, input.shotSequence);
  const features = input.features.length > 0 ? input.features : [{
    id: "map-center",
    kind: "center" as const,
    position: { x: 0, y: input.waterLevel + 32, z: 0 },
    radius: worldSize * 0.12,
    prominence: 0.5,
  }];
  const action = selectAction(input.actions);
  const wantsAction = input.mode !== "cinematic" && action !== null;
  const heroAllowed = wantsAction
    && action?.kind === "vehicle"
    && (action.route?.length || 0) >= 3
    && input.performanceTier !== "low"
    && input.shotSequence > 0
    && input.shotSequence % 5 === 0
    && input.shotSequence - input.lastHeroSequence >= 5;

  if (heroAllowed && action) {
    return heroShot(input, action, timing);
  }

  const recent = new Set(input.recentShotIds);
  const sunHeight = clamp(input.environment.sunDirection.y, -0.32, 0.92);
  const twilight = clamp(1 - Math.abs(sunHeight - 0.02) / 0.34, 0, 1);
  const fog = clamp(input.environment.fogIntensity, 0, 1);
  const rain = clamp(input.environment.rainIntensity, 0, 1);
  const candidates = features.flatMap((feature, featureIndex) => [0, 1].map((side) => {
    const sunAzimuth = Math.atan2(input.environment.sunDirection.z, input.environment.sunDirection.x);
    const baseAngle = sunAzimuth + Math.PI + (side === 0 ? -0.48 : 0.48) + featureIndex * 0.71;
    const closeWeather = Math.max(fog, rain * 0.7);
    const distance = clamp(
      Math.max(feature.radius * 2.4, worldSize * lerp(0.31, 0.2, closeWeather)),
      worldSize * 0.16,
      worldSize * 0.4,
    );
    const maxCoordinate = worldSize * 0.47;
    const scenicPosition = {
      x: clamp(feature.position.x + Math.cos(baseAngle) * distance, -maxCoordinate, maxCoordinate),
      y: feature.position.y + worldSize * lerp(0.105, 0.065, closeWeather),
      z: clamp(feature.position.z + Math.sin(baseAngle) * distance, -maxCoordinate, maxCoordinate),
    };
    const actionPull = wantsAction ? (input.mode === "action" ? 0.4 : 0.25) : 0;
    const position = action && actionPull > 0 ? {
      x: lerp(scenicPosition.x, action.position.x + (scenicPosition.x - feature.position.x) * 0.7, actionPull),
      y: lerp(scenicPosition.y, action.position.y + worldSize * 0.075, actionPull),
      z: lerp(scenicPosition.z, action.position.z + (scenicPosition.z - feature.position.z) * 0.7, actionPull),
    } : scenicPosition;
    position.x = clamp(position.x, -maxCoordinate, maxCoordinate);
    position.z = clamp(position.z, -maxCoordinate, maxCoordinate);
    const targetPull = action ? (input.mode === "action" ? 0.9 : input.mode === "director" ? 0.68 : 0) : 0;
    const target = action && targetPull > 0 ? {
      x: lerp(feature.position.x, action.position.x, targetPull),
      y: lerp(feature.position.y, action.position.y + Math.max(24, action.radius * 0.12), targetPull),
      z: lerp(feature.position.z, action.position.z, targetPull),
    } : { ...feature.position };
    const id = `${feature.id}:${side}:${wantsAction ? action?.id || "action" : "scenic"}`;
    const dx = target.x - position.x;
    const dz = target.z - position.z;
    const viewLength = Math.max(1, Math.hypot(dx, dz));
    const sunLength = Math.max(0.001, Math.hypot(input.environment.sunDirection.x, input.environment.sunDirection.z));
    const sunFacing = clamp((dx * input.environment.sunDirection.x + dz * input.environment.sunDirection.z) / (viewLength * sunLength) * 0.5 + 0.5, 0, 1);
    const scenicScore = feature.prominence * 1.8
      + twilight * sunFacing * 2.4
      + fog * (feature.kind === "ridge" || feature.kind === "peak" ? 1.25 : 0.35)
      + (feature.kind === "monument" ? 0.45 : 0)
      - rain * (1 - closeWeather) * 0.2;
    const actionScore = wantsAction && action ? clamp(action.weight, 0, 12) * (input.mode === "action" ? 0.9 : 0.48) : 0;
    return {
      id,
      position,
      target,
      fov: wantsAction ? 43 : feature.kind === "monument" ? 44 : 47,
      score: scenicScore + actionScore - (recent.has(id) ? 4 : 0),
    };
  }));

  candidates.sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));
  const selected = candidates[0]!;
  return {
    ...selected,
    ...timing,
    kind: wantsAction ? "action" : "scenic",
    subjectId: wantsAction ? action?.id : undefined,
  };
}

function selectAction(actions: DirectorActionSubject[]): DirectorActionSubject | null {
  if (actions.length === 0) return null;
  const now = Math.max(...actions.map((action) => action.updatedAt));
  return [...actions].sort((left, right) => {
    const leftFreshness = clamp(1 - (now - left.updatedAt) / 900_000, 0.15, 1);
    const rightFreshness = clamp(1 - (now - right.updatedAt) / 900_000, 0.15, 1);
    return right.weight * rightFreshness - left.weight * leftFreshness;
  })[0]!;
}

function heroShot(
  input: DirectorShotInput,
  action: DirectorActionSubject,
  timing: DirectorShotTiming,
): DirectorShotPlan {
  const route = action.route || [];
  const usableRoute = action.destroyed && route.length > 4 ? route.slice(Math.floor(route.length * 0.58)) : route;
  const first = usableRoute[0] || action.position;
  const next = usableRoute[Math.min(1, usableRoute.length - 1)] || action.position;
  const dx = next.x - first.x;
  const dz = next.z - first.z;
  const length = Math.max(1, Math.hypot(dx, dz));
  const sideX = -dz / length;
  const sideZ = dx / length;
  const distance = Math.max(action.radius * 1.8, input.worldSize * 0.085);
  return {
    id: `hero:${action.id}:${input.shotSequence}`,
    kind: "hero",
    position: {
      x: first.x + sideX * distance - dx / length * distance * 0.45,
      y: first.y + input.worldSize * 0.055,
      z: first.z + sideZ * distance - dz / length * distance * 0.45,
    },
    target: { ...first },
    fov: 42,
    score: action.weight + 5,
    subjectId: action.id,
    heroRoute: usableRoute,
    ...timing,
    holdMs: Math.min(timing.holdMs, input.performanceTier === "healthy" ? 12000 : 14500),
    motionScale: timing.motionScale * 0.72,
  };
}
