import {
  ACESFilmicToneMapping,
  BackSide,
  CanvasTexture,
  Color,
  EquirectangularReflectionMapping,
  LinearSRGBColorSpace,
  MathUtils,
  Mesh,
  PMREMGenerator,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  Texture,
  Vector3,
  WebGLRenderer,
} from "three";
import { getSharedCanvasTexture, loadSharedTexture } from "./three-asset-cache";

export type RaidlandsEnvironmentPreset = "terrain" | "editor";

type EnvironmentOptions = {
  preset?: RaidlandsEnvironmentPreset;
  backgroundIntensity?: number;
  environmentIntensity?: number;
  exposure?: number;
  skyboxUrl?: string;
};

export type RaidlandsEnvironmentState = {
  sunDirection: Vector3;
  sunColor: Color;
  sunIntensity: number;
  cloudCoverage?: number | null;
  fogIntensity?: number | null;
  rainIntensity?: number | null;
  thunderIntensity?: number | null;
  rainbowIntensity?: number | null;
  atmosphereRayleigh?: number | null;
  atmosphereMie?: number | null;
  atmosphereBrightness?: number | null;
  atmosphereContrast?: number | null;
  atmosphereDirectionality?: number | null;
  cloudOpacity?: number | null;
  cloudSharpness?: number | null;
  cloudAttenuation?: number | null;
  cloudScattering?: number | null;
  cloudBrightness?: number | null;
  timeSeconds?: number;
  cameraPosition?: Vector3;
};

type RaidlandsSkyUniforms = {
  uZenithColor: { value: Color };
  uHorizonColor: { value: Color };
  uGroundColor: { value: Color };
  uSunColor: { value: Color };
  uSunDirection: { value: Vector3 };
  uDaylight: { value: number };
  uCloudCoverage: { value: number };
  uCloudPhase: { value: number };
  uSunVisibility: { value: number };
  uCloudOpacity: { value: number };
  uCloudSharpness: { value: number };
  uCloudAttenuation: { value: number };
  uCloudBrightness: { value: number };
  uRainbowIntensity: { value: number };
  uFogIntensity: { value: number };
  uRainIntensity: { value: number };
};

const raidlandsSkyUserDataKey = "raidlandsSkyDome";

export function applyRaidlandsEnvironment(
  scene: Scene,
  renderer: WebGLRenderer,
  options: EnvironmentOptions = {},
): void {
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = options.exposure ?? 1.08;

  const preset = options.preset ?? "terrain";
  const skyTexture = createRaidlandsSkyTexture(preset);
  skyTexture.mapping = EquirectangularReflectionMapping;
  skyTexture.colorSpace = SRGBColorSpace;
  skyTexture.needsUpdate = true;

  const pmrem = new PMREMGenerator(renderer);
  const environment = pmrem.fromEquirectangular(skyTexture).texture;
  pmrem.dispose();

  const previousSkyDome = scene.userData[raidlandsSkyUserDataKey] as Mesh | undefined;
  if (previousSkyDome) {
    scene.remove(previousSkyDome);
    previousSkyDome.geometry.dispose();
    (previousSkyDome.material as ShaderMaterial).dispose();
  }

  const skyDome = createRaidlandsSkyDome(preset);
  scene.add(skyDome);
  scene.userData[raidlandsSkyUserDataKey] = skyDome;
  scene.background = new Color(0x040812);
  scene.backgroundIntensity = options.backgroundIntensity ?? (preset === "editor" ? 0.82 : 0.96);
  scene.environment = environment;
  scene.environmentIntensity = options.environmentIntensity ?? (preset === "editor" ? 0.72 : 0.9);

  updateRaidlandsEnvironment(scene, {
    sunDirection: new Vector3(0.5, 0.78, 0.36).normalize(),
    sunColor: preset === "editor" ? new Color(0xffc47a) : new Color(0xfff1cf),
    sunIntensity: preset === "editor" ? 1.78 : 1.58,
    cloudCoverage: preset === "editor" ? 0.24 : 0.22,
    timeSeconds: 0,
  });

  if (options.skyboxUrl) {
    void loadSharedTexture(options.skyboxUrl).then(
      (loadedSky) => {
        loadedSky.mapping = EquirectangularReflectionMapping;
        loadedSky.colorSpace = SRGBColorSpace;
        loadedSky.needsUpdate = true;

        const loadedPmrem = new PMREMGenerator(renderer);
        const loadedEnvironment = loadedPmrem.fromEquirectangular(loadedSky).texture;
        loadedPmrem.dispose();

        scene.background = loadedSky;
        scene.environment = loadedEnvironment;
      },
      () => {
        // Keep the procedural Raidlands sky when an optional published skybox is missing.
      },
    );
  }
}

export function updateRaidlandsEnvironment(scene: Scene, state: RaidlandsEnvironmentState): void {
  const skyDome = scene.userData[raidlandsSkyUserDataKey] as Mesh | undefined;
  const material = skyDome?.material as ShaderMaterial | undefined;
  const uniforms = material?.uniforms as RaidlandsSkyUniforms | undefined;

  if (!skyDome || !uniforms) {
    return;
  }

  if (state.cameraPosition) {
    skyDome.position.copy(state.cameraPosition);
  }

  const direction = state.sunDirection.clone().normalize();
  const sunHeight = MathUtils.clamp(direction.y, -0.28, 0.92);
  const daylight = MathUtils.smoothstep(sunHeight, -0.08, 0.5);
  const twilight = MathUtils.clamp(1 - Math.abs(sunHeight - 0.12) / 0.34, 0, 1);
  const cloudCoverageValue = state.cloudCoverage === null || state.cloudCoverage === undefined
    ? 0
    : Number(state.cloudCoverage);
  const rawCloudCoverage = MathUtils.clamp(Number.isFinite(cloudCoverageValue) ? cloudCoverageValue : 0, 0, 1);
  const cloudOpacity = MathUtils.clamp(finiteEnvironmentValue(state.cloudOpacity, 1), 0, 1);
  // Coverage is the fraction of sky Rust reports as covered. Opacity affects
  // the rendered cloud material below, not how much sky is considered cloudy.
  const cloudCoverage = rawCloudCoverage;
  const rayleigh = MathUtils.clamp(finiteEnvironmentValue(state.atmosphereRayleigh, 0.25), 0, 4);
  const mie = MathUtils.clamp(finiteEnvironmentValue(state.atmosphereMie, 1.55), 0, 4);
  const atmosphereBrightness = MathUtils.clamp(finiteEnvironmentValue(state.atmosphereBrightness, 0.95), 0.05, 3);
  const atmosphereContrast = MathUtils.clamp(finiteEnvironmentValue(state.atmosphereContrast, 0.65), 0.05, 3);
  const directionality = MathUtils.clamp(finiteEnvironmentValue(state.atmosphereDirectionality, 0.75), 0, 1);
  const fogIntensity = MathUtils.clamp(finiteEnvironmentValue(state.fogIntensity, 0), 0, 1);
  const rainIntensity = MathUtils.clamp(finiteEnvironmentValue(state.rainIntensity, 0), 0, 1);
  const sunIntensityValue = Number(state.sunIntensity);
  const sunVisibility = MathUtils.smoothstep(sunHeight, -0.16, 0.12)
    * MathUtils.clamp((Number.isFinite(sunIntensityValue) ? sunIntensityValue : 0) / 1.7, 0.18, 1.2)
    * MathUtils.lerp(0.72, 1.28, directionality)
    * MathUtils.lerp(1, 0.54, Math.max(fogIntensity * 0.65, rainIntensity * 0.42));

  const atmosphereSunColor = state.sunColor.clone().lerp(
    new Color(0xffc18c),
    MathUtils.lerp(0.38, 0.64, MathUtils.clamp(mie / 4, 0, 1)),
  );
  const zenith = new Color(0x07101c)
    .lerp(new Color(0x78b6e6), daylight)
    .lerp(atmosphereSunColor, twilight * 0.3)
    .lerp(new Color(0x4f78b5), MathUtils.clamp(rayleigh / 4, 0, 1) * daylight * 0.18)
    .multiplyScalar(MathUtils.lerp(0.72, 1.18, atmosphereBrightness / 1.4));
  const horizon = new Color(0x132333)
    .lerp(new Color(0xd7edf4), daylight)
    .lerp(atmosphereSunColor, twilight * 0.36)
    .lerp(new Color(0xffb28f), MathUtils.clamp(mie / 4, 0, 1) * twilight * 0.48)
    .lerp(new Color(0xf28b78), twilight * MathUtils.clamp(mie / 4, 0, 1) * 0.16)
    .multiplyScalar(MathUtils.lerp(0.72, 1.2, atmosphereBrightness / 1.4));
  const ground = new Color(0x05080c)
    .lerp(new Color(0x5b6d72), daylight)
    .lerp(atmosphereSunColor, twilight * 0.22)
    .multiplyScalar(MathUtils.lerp(0.78, 1.12, atmosphereContrast / 1.4));

  uniforms.uZenithColor.value.copy(zenith);
  uniforms.uHorizonColor.value.copy(horizon);
  uniforms.uGroundColor.value.copy(ground);
  uniforms.uSunColor.value.copy(state.sunColor);
  uniforms.uSunDirection.value.copy(direction);
  uniforms.uDaylight.value = daylight;
  uniforms.uCloudCoverage.value = cloudCoverage;
  uniforms.uCloudPhase.value = Number(state.timeSeconds) || 0;
  uniforms.uSunVisibility.value = sunVisibility;
  uniforms.uCloudOpacity.value = cloudOpacity;
  uniforms.uCloudSharpness.value = MathUtils.clamp(finiteEnvironmentValue(state.cloudSharpness, 1), 0, 1);
  uniforms.uCloudAttenuation.value = MathUtils.clamp(finiteEnvironmentValue(state.cloudAttenuation, 0.25), 0, 1);
  uniforms.uCloudBrightness.value = MathUtils.clamp(finiteEnvironmentValue(state.cloudBrightness, 0.55), 0, 2);
  uniforms.uRainbowIntensity.value = MathUtils.clamp(finiteEnvironmentValue(state.rainbowIntensity, 0), 0, 1);
  uniforms.uFogIntensity.value = fogIntensity;
  uniforms.uRainIntensity.value = rainIntensity;
}

function finiteEnvironmentValue(value: unknown, fallback: number): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function createRaidlandsSkyDome(preset: RaidlandsEnvironmentPreset): Mesh {
  const material = new ShaderMaterial({
    uniforms: {
      uZenithColor: { value: new Color(preset === "editor" ? 0x15253a : 0x78b6e6) },
      uHorizonColor: { value: new Color(preset === "editor" ? 0x7a9ba9 : 0xd7edf4) },
      uGroundColor: { value: new Color(preset === "editor" ? 0x211813 : 0x5b6d72) },
      uSunColor: { value: new Color(preset === "editor" ? 0xffc47a : 0xfff1cf) },
      uSunDirection: { value: new Vector3(0.5, 0.78, 0.36).normalize() },
      uDaylight: { value: 1 },
      uCloudCoverage: { value: preset === "editor" ? 0.24 : 0.32 },
      uCloudPhase: { value: 0 },
      uSunVisibility: { value: 1 },
      uCloudOpacity: { value: 1 },
      uCloudSharpness: { value: 1 },
      uCloudAttenuation: { value: 0.25 },
      uCloudBrightness: { value: 0.55 },
      uRainbowIntensity: { value: 0 },
      uFogIntensity: { value: 0 },
      uRainIntensity: { value: 0 },
    },
    vertexShader: `
      varying vec3 vDirection;

      void main() {
        vDirection = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;

      varying vec3 vDirection;

      uniform vec3 uZenithColor;
      uniform vec3 uHorizonColor;
      uniform vec3 uGroundColor;
      uniform vec3 uSunColor;
      uniform vec3 uSunDirection;
      uniform float uDaylight;
      uniform float uCloudCoverage;
      uniform float uCloudPhase;
      uniform float uSunVisibility;
      uniform float uCloudOpacity;
      uniform float uCloudSharpness;
      uniform float uCloudAttenuation;
      uniform float uCloudBrightness;
      uniform float uRainbowIntensity;
      uniform float uFogIntensity;
      uniform float uRainIntensity;

      float hash(vec2 position) {
        return fract(sin(dot(position, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float noise(vec2 position) {
        vec2 cell = floor(position);
        vec2 local = fract(position);
        local = local * local * (3.0 - 2.0 * local);
        float lower = mix(hash(cell), hash(cell + vec2(1.0, 0.0)), local.x);
        float upper = mix(hash(cell + vec2(0.0, 1.0)), hash(cell + vec2(1.0, 1.0)), local.x);
        return mix(lower, upper, local.y);
      }

      float cloudNoise(vec2 position) {
        float value = 0.0;
        float amplitude = 0.55;
        for (int octave = 0; octave < 4; octave += 1) {
          value += noise(position) * amplitude;
          position = position * 2.03 + vec2(11.7, 4.3);
          amplitude *= 0.5;
        }
        return value;
      }

      float celestialDisc(vec3 direction, vec3 targetDirection, float angularRadius, float softness) {
        float targetDot = dot(direction, normalize(targetDirection));
        float edge = cos(angularRadius);
        return smoothstep(edge - softness, edge + softness, targetDot);
      }

      void main() {
        vec3 direction = normalize(vDirection);
        float height = clamp(direction.y * 0.5 + 0.5, 0.0, 1.0);
        float horizon = 1.0 - smoothstep(0.0, 0.34, abs(direction.y));
        vec3 skyColor = direction.y < 0.0
          ? mix(uGroundColor, uHorizonColor, smoothstep(0.0, 0.42, height))
          : mix(uHorizonColor, uZenithColor, smoothstep(0.44, 1.0, height));

        float sunDot = max(dot(direction, normalize(uSunDirection)), 0.0);
        float lowSun = 1.0 - smoothstep(-0.08, 0.42, uSunDirection.y);
        float clearAtmosphere = 1.0 - clamp(uCloudCoverage * 0.55 + uFogIntensity * 0.52 + uRainIntensity * 0.34, 0.0, 0.9);
        float sunDisc = celestialDisc(direction, uSunDirection, 0.026, 0.00135) * uSunVisibility;
        float sunCore = celestialDisc(direction, uSunDirection, 0.015, 0.0009) * uSunVisibility;
        float sunGlow = pow(sunDot, 12.0) * (0.22 + lowSun * 0.32) * uSunVisibility;
        float sunHalo = pow(sunDot, 42.0) * (0.22 + lowSun * 0.48) * uSunVisibility;
        float horizonScatter = pow(max(dot(direction, normalize(vec3(uSunDirection.x, 0.08, uSunDirection.z))), 0.0), 5.0)
          * horizon * lowSun * clearAtmosphere;
        float twilight = (1.0 - smoothstep(-0.12, 0.54, uSunDirection.y)) * horizon;
        vec3 warmHorizon = mix(vec3(1.0, 0.42, 0.28), vec3(1.0, 0.72, 0.52), uDaylight);
        skyColor += uSunColor * (sunDisc * 0.82 + sunHalo * 0.9 + sunGlow * 0.7);
        skyColor += warmHorizon * (horizonScatter * 0.34 + twilight * 0.1);
        skyColor += vec3(1.0, 0.97, 0.88) * sunCore * 2.15;

        vec2 cloudPosition = direction.xz / max(direction.y + 0.36, 0.42);
        cloudPosition = cloudPosition * 2.2 + vec2(uCloudPhase * 0.0018, uCloudPhase * 0.0007);
        float clouds = cloudNoise(cloudPosition);
        float cloudCoverage = clamp(uCloudCoverage, 0.0, 1.0);
        float cloudAlpha = smoothstep(0.005, 0.04, cloudCoverage);
        float cloudThreshold = 1.0 - cloudCoverage;
        float cloudWave = 0.5 + 0.5 * sin(cloudPosition.x * 0.62 + sin(cloudPosition.y * 1.18) + clouds * 3.4);
        float cloudBand = 0.5 + 0.5 * sin(
          cloudPosition.x * 0.38 + cloudPosition.y * 0.24 + sin(cloudPosition.y * 0.7) * 1.8
        );
        float cloudField = clamp(clouds * 0.72 + cloudWave * 0.18 + cloudBand * 0.1, 0.0, 1.0);
        float cloudEdge = mix(0.08, 0.018, clamp(uCloudSharpness, 0.0, 1.0));
        float cloudMask = smoothstep(cloudThreshold - cloudEdge, cloudThreshold + cloudEdge, cloudField)
          * cloudAlpha
          * clamp(uCloudOpacity, 0.0, 1.0)
          * smoothstep(-0.02, 0.32, direction.y)
          * (0.72 + height * 0.28);
        vec3 cloudColor = mix(vec3(0.18, 0.22, 0.28), vec3(0.82, 0.9, 0.96), uDaylight)
          * mix(0.76, 1.32, clamp(uCloudBrightness, 0.0, 2.0) * 0.5);
        cloudColor = mix(cloudColor, vec3(0.08, 0.09, 0.11), clamp(uCloudAttenuation, 0.0, 1.0) * cloudCoverage * 0.42);
        skyColor = mix(skyColor, cloudColor, cloudMask * (0.1 + cloudCoverage * 0.66));

        float rainbowBand = (1.0 - smoothstep(0.0, 0.012, abs(length(direction.xz - vec2(0.08, -0.24)) - 0.64)))
          * smoothstep(0.08, 0.54, direction.y)
          * smoothstep(0.1, 0.62, cloudCoverage)
          * clamp(uRainbowIntensity, 0.0, 1.0);
        vec3 rainbowColor = vec3(
          0.8 + 0.2 * sin(direction.x * 12.0),
          0.55 + 0.35 * sin(direction.x * 12.0 + 2.1),
          0.72 + 0.25 * sin(direction.x * 12.0 + 4.2)
        );
        skyColor = mix(skyColor, rainbowColor, rainbowBand * 0.32);

        vec3 moonDirection = normalize(vec3(-uSunDirection.x, max(-uSunDirection.y, 0.18), -uSunDirection.z));
        float moonVisibility = (1.0 - smoothstep(-0.02, 0.34, uSunDirection.y)) * smoothstep(0.02, 0.24, moonDirection.y);
        float moonDisc = celestialDisc(direction, moonDirection, 0.032, 0.0016) * moonVisibility;
        float moonGlow = pow(max(dot(direction, moonDirection), 0.0), 44.0) * 0.34 * moonVisibility;
        vec3 moonTangent = normalize(cross(moonDirection, vec3(0.0, 1.0, 0.0)) + vec3(0.001, 0.0, 0.0));
        vec3 moonBitangent = normalize(cross(moonDirection, moonTangent));
        vec2 moonUv = vec2(dot(direction, moonTangent), dot(direction, moonBitangent)) / 0.032;
        float craterA = 1.0 - smoothstep(0.12, 0.3, length(moonUv - vec2(0.28, 0.18))) * 0.18;
        float craterB = 1.0 - smoothstep(0.1, 0.24, length(moonUv + vec2(0.22, 0.08))) * 0.14;
        float moonShade = clamp(0.72 + dot(moonUv, vec2(-0.2, 0.08)), 0.44, 1.0) * craterA * craterB;
        skyColor += vec3(0.64, 0.72, 0.86) * moonGlow;
        skyColor = mix(skyColor, vec3(0.86, 0.9, 0.98) * moonShade, moonDisc);

        float starVisibility = (1.0 - smoothstep(0.18, 0.74, uDaylight)) * smoothstep(0.12, 0.6, direction.y);
        float starA = step(0.9948, hash(direction.xz * 180.0 + direction.y * 23.0));
        float starB = step(0.9982, hash(direction.zx * 320.0 + direction.y * 67.0));
        float starTwinkle = 0.72 + 0.28 * sin(uCloudPhase * 0.55 + hash(direction.xz * 36.0) * 6.28318);
        float stars = (starA * 0.62 + starB * 1.15) * starVisibility * starTwinkle;
        skyColor += vec3(0.62, 0.76, 1.0) * stars;
        skyColor += uHorizonColor * horizon * (0.06 + uDaylight * 0.08);

        gl_FragColor = vec4(max(skyColor, vec3(0.0)), 1.0);
      }
    `,
    side: BackSide,
    depthWrite: false,
    depthTest: false,
    fog: false,
  });

  const skyDome = new Mesh(new SphereGeometry(9000, 48, 24), material);
  skyDome.name = "raidlands-dynamic-sky-dome";
  skyDome.renderOrder = -1000;
  skyDome.frustumCulled = false;
  skyDome.userData[raidlandsSkyUserDataKey] = material;
  return skyDome;
}

function createRaidlandsSkyTexture(preset: RaidlandsEnvironmentPreset): Texture {
  return getSharedCanvasTexture(`raidlands-sky:${preset}`, () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 512;
    const context = canvas.getContext("2d");

    if (!context) {
      const fallback = new CanvasTexture(canvas);
      fallback.colorSpace = LinearSRGBColorSpace;
      return fallback;
    }

    const palette = preset === "editor"
      ? {
          zenith: new Color(0x111820),
          horizon: new Color(0x5d6b70),
          ground: new Color(0x211813),
          sun: new Color(0xffc27a),
        }
      : {
          zenith: new Color(0x78b6e6),
          horizon: new Color(0xd7edf4),
          ground: new Color(0x5b6d72),
          sun: new Color(0xfff1cf),
        };

    const image = context.createImageData(canvas.width, canvas.height);
    for (let y = 0; y < canvas.height; y += 1) {
      const v = y / (canvas.height - 1);
      const elevation = 1 - Math.abs(v * 2 - 1);
      const base = v < 0.54
        ? palette.zenith.clone().lerp(palette.horizon, Math.pow(v / 0.54, 0.72))
        : palette.horizon.clone().lerp(palette.ground, Math.pow((v - 0.54) / 0.46, 0.86));

      for (let x = 0; x < canvas.width; x += 1) {
        const u = x / (canvas.width - 1);
        const sunDistance = Math.hypot((u - 0.72) * 1.55, (v - 0.46) * 2.05);
        const emberDistance = Math.hypot((u - 0.74) * 2.8, (v - 0.58) * 4.2);
        const sunGlow = Math.max(0, 1 - sunDistance) ** 2.85;
        const emberGlow = Math.max(0, 1 - emberDistance) ** 2.4;
        const haze = Math.max(0, elevation) ** 1.72 * (preset === "editor" ? 0.085 : 0.028);
        const color = base.clone()
          .lerp(palette.sun, sunGlow * (preset === "editor" ? 0.58 : 0.42) + emberGlow * (preset === "editor" ? 0.18 : 0.12))
          .offsetHSL(-0.012, -0.025, haze);
        const offset = (y * canvas.width + x) * 4;
        image.data[offset] = Math.round(color.r * 255);
        image.data[offset + 1] = Math.round(color.g * 255);
        image.data[offset + 2] = Math.round(color.b * 255);
        image.data[offset + 3] = 255;
      }
    }
    context.putImageData(image, 0, 0);

    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return texture;
  });
}
