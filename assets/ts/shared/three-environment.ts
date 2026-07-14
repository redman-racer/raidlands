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
import {
  normalizeRaidlandsCloudCoverage,
  parseRaidlandsCloudDetail,
  raidlandsCloudProfile,
  type RaidlandsCloudDetail,
} from "./three-cloud-detail";

export type { RaidlandsCloudDetail } from "./three-cloud-detail";

export type RaidlandsEnvironmentPreset = "terrain" | "editor";

type EnvironmentOptions = {
  preset?: RaidlandsEnvironmentPreset;
  backgroundIntensity?: number;
  environmentIntensity?: number;
  exposure?: number;
  skyboxUrl?: string;
  cloudDetail?: RaidlandsCloudDetail;
  worldSize?: number;
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
  cloudSize?: number | null;
  cloudColoring?: number | null;
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
  uCloudSize: { value: number };
  uCloudColoring: { value: number };
  uCloudSharpness: { value: number };
  uCloudAttenuation: { value: number };
  uCloudScattering: { value: number };
  uCloudBrightness: { value: number };
  uAtmosphereRayleigh: { value: number };
  uAtmosphereMie: { value: number };
  uAtmosphereDirectionality: { value: number };
  uRainbowIntensity: { value: number };
  uFogIntensity: { value: number };
  uRainIntensity: { value: number };
  uCameraPosition: { value: Vector3 };
  uWorldSize: { value: number };
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
  const cloudDetail = parseRaidlandsCloudDetail(options.cloudDetail, "low");
  const worldSize = Math.max(100, Number(options.worldSize) || 4500);
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

  const skyDome = createRaidlandsSkyDome(preset, cloudDetail, worldSize);
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
  const sunHeight = MathUtils.clamp(direction.y, -0.32, 0.92);
  const daylight = MathUtils.smoothstep(sunHeight, -0.08, 0.5);
  const twilight = MathUtils.smoothstep(sunHeight, -0.2, -0.04)
    * (1 - MathUtils.smoothstep(sunHeight, 0.3, 0.56));
  const cloudCoverageValue = state.cloudCoverage === null || state.cloudCoverage === undefined
    ? 0
    : Number(state.cloudCoverage);
  const rawCloudCoverage = normalizeRaidlandsCloudCoverage(cloudCoverageValue);
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
  const sunVisibility = MathUtils.smoothstep(sunHeight, -0.055, 0.018)
    * MathUtils.clamp((Number.isFinite(sunIntensityValue) ? sunIntensityValue : 0) / 1.7, 0.18, 1.2)
    * MathUtils.lerp(0.72, 1.28, directionality)
    * MathUtils.lerp(1, 0.54, Math.max(fogIntensity * 0.65, rainIntensity * 0.42));

  const atmosphereSunColor = state.sunColor.clone().lerp(
    new Color(0xffc18c),
    MathUtils.lerp(0.38, 0.64, MathUtils.clamp(mie / 4, 0, 1)),
  );
  const zenith = new Color(0x07101c)
    .lerp(new Color(0x78b6e6), daylight)
    .lerp(new Color(0x514b68), twilight * 0.32)
    .lerp(new Color(0x4f78b5), MathUtils.clamp(rayleigh / 4, 0, 1) * daylight * 0.18)
    .multiplyScalar(MathUtils.lerp(0.72, 1.18, atmosphereBrightness / 1.4));
  const horizon = new Color(0x132333)
    .lerp(new Color(0xd7edf4), daylight)
    .lerp(atmosphereSunColor, twilight * 0.22)
    .lerp(new Color(0xffb28f), MathUtils.clamp(mie / 4, 0, 1) * twilight * 0.3)
    .lerp(new Color(0xf28b78), twilight * MathUtils.clamp(mie / 4, 0, 1) * 0.08)
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
  uniforms.uCloudSize.value = MathUtils.clamp(finiteEnvironmentValue(state.cloudSize, 3.35), 0.2, 8);
  uniforms.uCloudColoring.value = MathUtils.clamp(finiteEnvironmentValue(state.cloudColoring, 0.65), 0, 1);
  uniforms.uCloudSharpness.value = MathUtils.clamp(finiteEnvironmentValue(state.cloudSharpness, 1), 0, 1);
  uniforms.uCloudAttenuation.value = MathUtils.clamp(finiteEnvironmentValue(state.cloudAttenuation, 0.25), 0, 1);
  uniforms.uCloudScattering.value = MathUtils.clamp(finiteEnvironmentValue(state.cloudScattering, 0.65), 0, 1);
  uniforms.uCloudBrightness.value = MathUtils.clamp(finiteEnvironmentValue(state.cloudBrightness, 0.55), 0, 2);
  uniforms.uAtmosphereRayleigh.value = rayleigh;
  uniforms.uAtmosphereMie.value = mie;
  uniforms.uAtmosphereDirectionality.value = directionality;
  uniforms.uRainbowIntensity.value = MathUtils.clamp(finiteEnvironmentValue(state.rainbowIntensity, 0), 0, 1);
  uniforms.uFogIntensity.value = fogIntensity;
  uniforms.uRainIntensity.value = rainIntensity;
  uniforms.uCameraPosition.value.copy(state.cameraPosition || skyDome.position);
}

function finiteEnvironmentValue(value: unknown, fallback: number): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function createRaidlandsSkyDome(
  preset: RaidlandsEnvironmentPreset,
  cloudDetail: RaidlandsCloudDetail,
  worldSize: number,
): Mesh {
  const cloudProfile = raidlandsCloudProfile(cloudDetail);
  const material = new ShaderMaterial({
    defines: {
      RAIDLANDS_CLOUD_DETAIL: cloudProfile.useVolumetricClouds ? (cloudDetail === "max" ? 2 : 1) : 0,
      RAIDLANDS_CLOUD_VIEW_SAMPLES: Math.max(1, cloudProfile.viewSamples),
      RAIDLANDS_CLOUD_LIGHT_SAMPLES: Math.max(1, cloudProfile.lightSamples),
    },
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
      uCloudSize: { value: 3.35 },
      uCloudColoring: { value: 0.65 },
      uCloudSharpness: { value: 1 },
      uCloudAttenuation: { value: 0.25 },
      uCloudScattering: { value: 0.65 },
      uCloudBrightness: { value: 0.55 },
      uAtmosphereRayleigh: { value: 0.25 },
      uAtmosphereMie: { value: 1.55 },
      uAtmosphereDirectionality: { value: 0.75 },
      uRainbowIntensity: { value: 0 },
      uFogIntensity: { value: 0 },
      uRainIntensity: { value: 0 },
      uCameraPosition: { value: new Vector3() },
      uWorldSize: { value: worldSize },
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
      uniform float uCloudSize;
      uniform float uCloudColoring;
      uniform float uCloudSharpness;
      uniform float uCloudAttenuation;
      uniform float uCloudScattering;
      uniform float uCloudBrightness;
      uniform float uAtmosphereRayleigh;
      uniform float uAtmosphereMie;
      uniform float uAtmosphereDirectionality;
      uniform float uRainbowIntensity;
      uniform float uFogIntensity;
      uniform float uRainIntensity;
      uniform vec3 uCameraPosition;
      uniform float uWorldSize;

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

      float hash3(vec3 position) {
        return fract(sin(dot(position, vec3(127.1, 311.7, 74.7))) * 43758.5453123);
      }

      float noise3(vec3 position) {
        vec3 cell = floor(position);
        vec3 local = fract(position);
        local = local * local * (3.0 - 2.0 * local);
        float lowerA = mix(hash3(cell), hash3(cell + vec3(1.0, 0.0, 0.0)), local.x);
        float lowerB = mix(hash3(cell + vec3(0.0, 1.0, 0.0)), hash3(cell + vec3(1.0, 1.0, 0.0)), local.x);
        float upperA = mix(hash3(cell + vec3(0.0, 0.0, 1.0)), hash3(cell + vec3(1.0, 0.0, 1.0)), local.x);
        float upperB = mix(hash3(cell + vec3(0.0, 1.0, 1.0)), hash3(cell + vec3(1.0, 1.0, 1.0)), local.x);
        return mix(mix(lowerA, lowerB, local.y), mix(upperA, upperB, local.y), local.z);
      }

      float cloudVolumeNoise(vec3 position) {
        float value = noise3(position) * 0.56;
        value += noise3(position * 2.03 + vec3(7.1, 3.7, 11.3)) * 0.28;
        value += noise3(position * 4.11 + vec3(-5.4, 9.2, 2.8)) * 0.12;
#if RAIDLANDS_CLOUD_DETAIL > 1
        value += noise3(position * 8.23 + vec3(13.7, -4.1, 8.6)) * 0.06;
#endif
        return value;
      }

      float cloudDensityAt(vec3 worldPosition, float cloudBase, float cloudTop, float cloudCoverage) {
        float layerHeight = max(cloudTop - cloudBase, 1.0);
        float heightFraction = (worldPosition.y - cloudBase) / layerHeight;
        float verticalShape = smoothstep(0.0, 0.16, heightFraction)
          * (1.0 - smoothstep(0.66, 1.0, heightFraction));
        float sizeFraction = clamp((uCloudSize - 0.2) / 7.8, 0.0, 1.0);
        float cloudScale = uWorldSize * mix(0.035, 0.13, sizeFraction);
        vec3 samplePosition = vec3(
          worldPosition.x / cloudScale + uCloudPhase * 0.0032,
          heightFraction * mix(2.8, 1.65, sizeFraction),
          worldPosition.z / cloudScale + uCloudPhase * 0.00135
        );
        float field = cloudVolumeNoise(samplePosition);
        float threshold = mix(0.82, 0.27, sqrt(clamp(cloudCoverage, 0.0, 1.0)));
        float edge = mix(0.085, 0.018, clamp(uCloudSharpness, 0.0, 1.0));
        float density = smoothstep(threshold - edge, threshold + edge, field) * verticalShape;
#if RAIDLANDS_CLOUD_DETAIL > 1
        float erosion = noise3(samplePosition * 5.7 + vec3(4.2, -7.6, 2.1));
        density *= smoothstep(0.08, 0.72, density + erosion * 0.22);
#endif
        return density * smoothstep(0.005, 0.04, cloudCoverage) * clamp(uCloudOpacity, 0.0, 1.0);
      }

      vec4 raymarchCloudVolume(vec3 rayDirection, float cloudCoverage, float daylight) {
#if RAIDLANDS_CLOUD_DETAIL > 0
        if (cloudCoverage <= 0.001 || abs(rayDirection.y) <= 0.004) {
          return vec4(0.0);
        }
        float sizeFraction = clamp((uCloudSize - 0.2) / 7.8, 0.0, 1.0);
        float cloudBase = uWorldSize * (0.115 - uRainIntensity * 0.016);
        float cloudTop = cloudBase + uWorldSize * mix(0.055, 0.105, sizeFraction);
        float baseDistance = (cloudBase - uCameraPosition.y) / rayDirection.y;
        float topDistance = (cloudTop - uCameraPosition.y) / rayDirection.y;
        float enterDistance = max(0.0, min(baseDistance, topDistance));
        float exitDistance = min(uWorldSize * 2.4, max(baseDistance, topDistance));
        if (exitDistance <= enterDistance) {
          return vec4(0.0);
        }
        float stepLength = (exitDistance - enterDistance) / float(RAIDLANDS_CLOUD_VIEW_SAMPLES);
        float transmittance = 1.0;
        vec3 accumulatedColor = vec3(0.0);
        float jitter = hash(gl_FragCoord.xy + vec2(uCloudPhase * 0.07));
        vec3 sunDirection = normalize(uSunDirection);

        for (int sampleIndex = 0; sampleIndex < RAIDLANDS_CLOUD_VIEW_SAMPLES; sampleIndex += 1) {
          float sampleDistance = enterDistance + (float(sampleIndex) + jitter) * stepLength;
          vec3 samplePosition = uCameraPosition + rayDirection * sampleDistance;
          float density = cloudDensityAt(samplePosition, cloudBase, cloudTop, cloudCoverage);
          if (density > 0.002) {
            float lightTransmittance = 1.0;
            float lightStep = (cloudTop - cloudBase) * 0.16 / float(RAIDLANDS_CLOUD_LIGHT_SAMPLES);
            for (int lightIndex = 0; lightIndex < RAIDLANDS_CLOUD_LIGHT_SAMPLES; lightIndex += 1) {
              vec3 lightPosition = samplePosition + sunDirection * lightStep * (float(lightIndex) + 1.0);
              lightTransmittance *= exp(-cloudDensityAt(lightPosition, cloudBase, cloudTop, cloudCoverage)
                * mix(0.72, 1.48, clamp(uCloudAttenuation, 0.0, 1.0)));
            }
            float viewSun = clamp(dot(rayDirection, sunDirection), -1.0, 1.0);
            float forwardScatter = pow(max(viewSun, 0.0), mix(3.0, 11.0, clamp(uCloudScattering, 0.0, 1.0)));
            float powder = 1.0 - exp(-density * 2.4);
            vec3 ambientCloud = mix(vec3(0.16, 0.19, 0.24), vec3(0.7, 0.79, 0.86), daylight);
            vec3 sunCloud = mix(vec3(1.0), uSunColor, clamp(uCloudColoring, 0.0, 1.0));
            vec3 sampleColor = ambientCloud * mix(0.42, 1.2, clamp(uCloudBrightness, 0.0, 2.0) * 0.5);
            sampleColor += sunCloud * lightTransmittance
              * (0.22 + powder * 0.5 + forwardScatter * mix(0.25, 1.05, uCloudScattering))
              * mix(0.2, 1.0, daylight);
            sampleColor = mix(sampleColor, vec3(0.045, 0.052, 0.07), uRainIntensity * density * 0.58);
            float extinction = 1.0 - exp(-density * stepLength / max(uWorldSize * 0.022, 1.0));
            accumulatedColor += transmittance * sampleColor * extinction;
            transmittance *= 1.0 - extinction;
            if (transmittance < 0.02) {
              break;
            }
          }
        }
        return vec4(accumulatedColor, 1.0 - transmittance);
#else
        return vec4(0.0);
#endif
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
        float mie = clamp(uAtmosphereMie * 0.25, 0.0, 1.0);
        float rayleigh = clamp(uAtmosphereRayleigh * 0.25, 0.0, 1.0);
        float cloudWeather = clamp(
          uCloudCoverage * mix(0.42, 0.7, uCloudAttenuation) + uRainIntensity * 0.48 + uFogIntensity * 0.42,
          0.0,
          0.92
        );
        float clearAtmosphere = 1.0 - cloudWeather;
        float directionality = mix(0.72, 1.34, clamp(uAtmosphereDirectionality, 0.0, 1.0));
        float sunDisc = celestialDisc(direction, uSunDirection, 0.03, 0.000022) * uSunVisibility;
        float sunCore = celestialDisc(direction, uSunDirection, 0.0255, 0.000014) * uSunVisibility;
        float sunOuter = max(sunDisc - sunCore, 0.0);
        float sunGlow = pow(sunDot, mix(9.0, 15.0, directionality * 0.5))
          * (0.16 + lowSun * mix(0.32, 0.58, mie)) * uSunVisibility;
        float sunHalo = pow(sunDot, mix(28.0, 56.0, directionality * 0.5))
          * (0.2 + lowSun * mix(0.42, 0.76, mie)) * uSunVisibility;
        vec3 horizonSunDirection = normalize(vec3(uSunDirection.x, 0.075, uSunDirection.z));
        float horizonSunDot = max(dot(direction, horizonSunDirection), 0.0);
        float twilightVisibility = smoothstep(-0.2, -0.04, uSunDirection.y);
        float twilightUpperFade = 1.0 - smoothstep(0.3, 0.56, uSunDirection.y);
        float horizonScatter = pow(horizonSunDot, mix(3.0, 7.0, directionality * 0.5))
          * horizon * lowSun * clearAtmosphere * twilightVisibility;
        float horizonNear = exp(-abs(direction.y) * mix(13.0, 21.0, mie));
        float horizonWide = exp(-abs(direction.y) * mix(4.0, 8.0, rayleigh));
        float twilight = twilightVisibility * twilightUpperFade * horizon;
        vec3 orangeScatter = mix(uSunColor, vec3(1.0, 0.34, 0.18), 0.58 + mie * 0.24);
        vec3 peachScatter = mix(vec3(1.0, 0.34, 0.2), vec3(1.0, 0.7, 0.48), uDaylight);
        skyColor += orangeScatter * (sunOuter * 1.18 + sunHalo * 0.82 + sunGlow * 0.56) * clearAtmosphere;
        skyColor += peachScatter * horizonScatter * (horizonNear * (0.2 + mie * 0.34) + horizonWide * 0.12);
        skyColor += vec3(0.92, 0.17, 0.1) * horizonScatter * horizonNear * mie * 0.18;
        skyColor += peachScatter * twilight * (horizonNear * 0.1 + horizonWide * 0.045) * clearAtmosphere;

        vec2 cloudPosition = direction.xz / max(direction.y + 0.34, 0.38);
        float cloudSizeFraction = clamp((uCloudSize - 0.2) / 7.8, 0.0, 1.0);
        cloudPosition = cloudPosition * mix(3.1, 1.55, cloudSizeFraction)
          + vec2(uCloudPhase * 0.0018, uCloudPhase * 0.0007);
        float clouds = cloudNoise(cloudPosition);
        float broadClouds = cloudNoise(cloudPosition * 0.42 + vec2(3.7, -2.1));
        float cloudDetail = cloudNoise(cloudPosition * 2.18 + vec2(-5.2, 4.6));
        float cloudCoverage = clamp(uCloudCoverage, 0.0, 1.0);
        float cloudAlpha = smoothstep(0.005, 0.04, cloudCoverage);
        float cloudThreshold = mix(0.82, 0.27, sqrt(cloudCoverage));
        float cloudWave = 0.5 + 0.5 * sin(cloudPosition.x * 0.54 + sin(cloudPosition.y * 1.04) + clouds * 3.8);
        float cloudBand = 0.5 + 0.5 * sin(
          cloudPosition.x * 0.31 + cloudPosition.y * 0.22 + sin(cloudPosition.y * 0.64) * 1.9
        );
        float cloudField = clamp(clouds * 0.45 + broadClouds * 0.3 + cloudDetail * 0.11 + cloudWave * 0.075 + cloudBand * 0.065, 0.0, 1.0);
        float cloudEdge = mix(0.08, 0.018, clamp(uCloudSharpness, 0.0, 1.0));
        float cloudMask = smoothstep(cloudThreshold - cloudEdge, cloudThreshold + cloudEdge, cloudField)
          * cloudAlpha
          * clamp(uCloudOpacity, 0.0, 1.0)
          * smoothstep(-0.08, 0.12, direction.y)
          * (0.82 + height * 0.18);
        float cloudInterior = smoothstep(cloudThreshold + cloudEdge * 0.2, cloudThreshold + cloudEdge * 2.4, cloudField);
        float stormBase = smoothstep(cloudThreshold - cloudEdge * 1.8, cloudThreshold + cloudEdge * 0.5, broadClouds)
          * cloudMask * uRainIntensity;
        float cloudRim = clamp(cloudMask - cloudInterior * cloudMask, 0.0, 1.0);
        float cloudSunFacing = pow(max(dot(direction, normalize(uSunDirection)), 0.0), 3.0);
        float cloudTwilight = lowSun * twilightVisibility * twilightUpperFade;
        vec3 cloudColor = mix(vec3(0.18, 0.22, 0.28), vec3(0.82, 0.9, 0.96), uDaylight)
          * mix(0.76, 1.32, clamp(uCloudBrightness, 0.0, 2.0) * 0.5);
        float cloudUnderside = cloudInterior * (0.28 + cloudCoverage * 0.34)
          * mix(0.62, 1.0, clamp(uCloudAttenuation, 0.0, 1.0));
        cloudColor = mix(cloudColor, vec3(0.065, 0.07, 0.085), cloudUnderside * (0.42 + uRainIntensity * 0.38));
        cloudColor = mix(cloudColor, vec3(0.035, 0.045, 0.065), stormBase * (0.34 + cloudDetail * 0.28));
        vec3 warmCloudEdge = mix(vec3(1.0), mix(uSunColor, vec3(1.0, 0.38, 0.2), 0.48 + mie * 0.28), uCloudColoring);
        cloudColor = mix(
          cloudColor,
          warmCloudEdge,
          (cloudRim * 0.82 + cloudMask * cloudSunFacing * 0.18)
            * cloudTwilight * (0.28 + cloudSunFacing * 0.68) * mix(0.58, 1.0, uCloudScattering)
        );
        float distantCloudMask = cloudMask * (0.12 + cloudCoverage * 0.7 + uRainIntensity * 0.12);
#if RAIDLANDS_CLOUD_DETAIL > 0
        distantCloudMask *= 1.0 - smoothstep(0.08, 0.5, direction.y);
#endif
        skyColor = mix(skyColor, cloudColor, distantCloudMask);
        vec4 volumeCloud = raymarchCloudVolume(direction, cloudCoverage, uDaylight);
        skyColor = skyColor * (1.0 - volumeCloud.a) + volumeCloud.rgb;
        float combinedCloudMask = max(distantCloudMask, volumeCloud.a);
        float sunTransmission = max(0.72, 1.0 - combinedCloudMask * mix(0.72, 0.98, cloudInterior));
        skyColor = mix(
          skyColor,
          vec3(1.0),
          clamp(sunCore * sunTransmission * mix(0.86, 1.0, clearAtmosphere), 0.0, 1.0)
        );

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

        float starVisibility = (1.0 - smoothstep(-0.12, -0.02, uSunDirection.y)) * smoothstep(0.12, 0.6, direction.y);
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
  material.customProgramCacheKey = () => `raidlands-sky-cloud-${cloudDetail}-v3`;

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
