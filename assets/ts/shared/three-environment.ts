import {
  ACESFilmicToneMapping,
  CanvasTexture,
  Color,
  EquirectangularReflectionMapping,
  LinearSRGBColorSpace,
  PMREMGenerator,
  Scene,
  SRGBColorSpace,
  Texture,
  WebGLRenderer,
} from "three";

export type RaidlandsEnvironmentPreset = "terrain" | "editor";

type EnvironmentOptions = {
  preset?: RaidlandsEnvironmentPreset;
  backgroundIntensity?: number;
  environmentIntensity?: number;
  exposure?: number;
};

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

  scene.background = skyTexture;
  scene.backgroundIntensity = options.backgroundIntensity ?? (preset === "editor" ? 0.82 : 0.96);
  scene.environment = environment;
  scene.environmentIntensity = options.environmentIntensity ?? (preset === "editor" ? 0.72 : 0.9);
}

function createRaidlandsSkyTexture(preset: RaidlandsEnvironmentPreset): Texture {
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
        zenith: new Color(0x0a1017),
        horizon: new Color(0x59646a),
        ground: new Color(0x1a1510),
        sun: new Color(0xff8a28),
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
      const haze = Math.max(0, elevation) ** 1.72 * 0.085;
      const color = base.clone()
        .lerp(palette.sun, sunGlow * 0.58 + emberGlow * 0.18)
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
}
