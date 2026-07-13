import {
  CanvasTexture,
  SRGBColorSpace,
  Texture,
  TextureLoader,
} from "three";

const loadedTextureCache = new Map<string, Promise<Texture>>();
const canvasTextureCache = new Map<string, CanvasTexture>();

export function markSharedThreeAsset(texture: Texture): Texture {
  texture.userData.preserveSharedAsset = true;
  return texture;
}

export function isSharedThreeAsset(value: unknown): boolean {
  return Boolean(value && typeof value === "object" && (value as { userData?: { preserveSharedAsset?: boolean } }).userData?.preserveSharedAsset === true);
}

export async function loadSharedTexture(url: string): Promise<Texture> {
  let cached = loadedTextureCache.get(url);
  if (!cached) {
    cached = new TextureLoader().loadAsync(url).then((texture) => markSharedThreeAsset(texture));
    loadedTextureCache.set(url, cached);
  }
  return cached;
}

export function getSharedCanvasTexture(key: string, factory: () => CanvasTexture): CanvasTexture {
  const cached = canvasTextureCache.get(key);
  if (cached) {
    return cached;
  }
  const texture = markSharedThreeAsset(factory()) as CanvasTexture;
  texture.colorSpace = texture.colorSpace || SRGBColorSpace;
  canvasTextureCache.set(key, texture);
  return texture;
}
