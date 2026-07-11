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
        zenith: new Color(0x101b20),
        horizon: new Color(0x46636b),
        ground: new Color(0x201a14),
        sun: new Color(0xffd39a),
      }
    : {
        zenith: new Color(0x0e1a20),
        horizon: new Color(0x7f9288),
        ground: new Color(0x312a1f),
        sun: new Color(0xffc47c),
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
      const sunDistance = Math.hypot((u - 0.68) * 1.65, (v - 0.42) * 2.2);
      const sunGlow = Math.max(0, 1 - sunDistance) ** 3.2;
      const haze = Math.max(0, elevation) ** 1.85 * 0.11;
      const color = base.clone()
        .lerp(palette.sun, sunGlow * 0.62)
        .offsetHSL(0, 0, haze);
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
