/**
 * Map artifacts intentionally use stable `current-*` paths. Add the terrain
 * fingerprint so browser and edge caches cannot mix different wipes.
 */
export function versionMapAssetUrl(url: string, fingerprint: string): string {
  const source = String(url || "").trim();
  const version = String(fingerprint || "").trim();

  if (source === "" || version === "" || /^(?:data|blob):/i.test(source)) return source;

  const fragmentIndex = source.indexOf("#");
  const base = fragmentIndex >= 0 ? source.slice(0, fragmentIndex) : source;
  const fragment = fragmentIndex >= 0 ? source.slice(fragmentIndex) : "";
  const separator = base.includes("?") ? "&" : "?";

  return `${base}${separator}map_version=${encodeURIComponent(version)}${fragment}`;
}
