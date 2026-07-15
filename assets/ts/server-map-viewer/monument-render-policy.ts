import { monumentModelMetadata, monumentPrefabId } from "./monument-model-registry";

export type MonumentRenderClass = "surface-entrance" | "recipe-lod" | "procedural-fallback";

export function monumentRenderClass(prefab: string): MonumentRenderClass {
  const id = monumentPrefabId(prefab);
  if (!monumentModelMetadata(id)) return "procedural-fallback";
  return monumentModelMetadata(id)?.surfaceOnly ? "surface-entrance" : "recipe-lod";
}

// Compatibility helper for callers outside the shared viewer. Major landmarks
// are no longer pinned to Map in Auto; every approved recipe can promote.
export function monumentUsesMapProxyInAuto(prefab: string): boolean {
  return monumentRenderClass(prefab) === "procedural-fallback";
}
