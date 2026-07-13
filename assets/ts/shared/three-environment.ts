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
  const rawCloudCoverage = MathUtils.clamp(Number.isFinite(cloudCoverageValue) ? cloudCoverageValue : 0, 0, 0.92);
  const cloudCoverage = rawCloudCoverage;
  const sunIntensityValue = Number(state.sunIntensity);
  const sunVisibility = MathUtils.smoothstep(sunHeight, -0.16, 0.12)
    * MathUtils.clamp((Number.isFinite(sunIntensityValue) ? sunIntensityValue : 0) / 1.7, 0.18, 1.2);

  const twilightWarmth = twilight * 0.24;
  const zenith = new Color(0x07101c)
    .lerp(new Color(0x78b6e6), daylight)
    .lerp(new Color(0x29415f), twilight * 0.24);
  const horizon = new Color(0x132333)
    .lerp(new Color(0xd7edf4), daylight)
    .lerp(new Color(0xf1a06b), twilightWarmth);
  const ground = new Color(0x05080c)
    .lerp(new Color(0x5b6d72), daylight)
    .lerp(new Color(0x342827), twilight * 0.18);

  uniforms.uZenithColor.value.copy(zenith);
  uniforms.uHorizonColor.value.copy(horizon);
  uniforms.uGroundColor.value.copy(ground);
  uniforms.uSunColor.value.copy(state.sunColor);
  uniforms.uSunDirection.value.copy(direction);
  uniforms.uDaylight.value = daylight;
  uniforms.uCloudCoverage.value = cloudCoverage;
  uniforms.uCloudPhase.value = Number(state.timeSeconds) || 0;
  uniforms.uSunVisibility.value = sunVisibility;
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

      void main() {
        vec3 direction = normalize(vDirection);
        float height = clamp(direction.y * 0.5 + 0.5, 0.0, 1.0);
        float horizon = 1.0 - smoothstep(0.0, 0.34, abs(direction.y));
        vec3 skyColor = direction.y < 0.0
          ? mix(uGroundColor, uHorizonColor, smoothstep(0.0, 0.42, height))
          : mix(uHorizonColor, uZenithColor, smoothstep(0.44, 1.0, height));

        float sunDot = max(dot(direction, normalize(uSunDirection)), 0.0);
        float sunDisc = smoothstep(0.9991, 0.99982, sunDot) * uSunVisibility;
        float sunGlow = pow(sunDot, 7.0) * 0.34 * uSunVisibility;
        float twilight = smoothstep(0.54, -0.12, uSunDirection.y) * horizon;
        skyColor += uSunColor * (sunDisc * 1.18 + sunGlow * 0.74 + twilight * 0.12);

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
        float cloudMask = smoothstep(cloudThreshold - 0.045, cloudThreshold + 0.045, cloudField)
          * cloudAlpha
          * smoothstep(-0.02, 0.32, direction.y)
          * (0.72 + height * 0.28);
        vec3 cloudColor = mix(vec3(0.18, 0.22, 0.28), vec3(0.82, 0.9, 0.96), uDaylight);
        skyColor = mix(skyColor, cloudColor, cloudMask * (0.1 + cloudCoverage * 0.66));

        float starField = step(0.9972, hash(direction.xz * 180.0 + direction.y * 23.0));
        float stars = starField * (1.0 - uDaylight) * smoothstep(0.18, 0.72, direction.y);
        skyColor += vec3(0.56, 0.72, 1.0) * stars * 0.92;
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
