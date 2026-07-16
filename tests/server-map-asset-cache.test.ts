import { describe, expect, it } from "vitest";
import { versionMapAssetUrl } from "../assets/ts/server-map-viewer/map-asset-policy";

describe("server map asset cache versioning", () => {
  it("versions stable current-wipe paths with the terrain fingerprint", () => {
    expect(versionMapAssetUrl(
      "https://raidlands.net/assets/media/maps/raidlands-main/current-texture.jpg",
      "cb4a8f70",
    )).toBe(
      "https://raidlands.net/assets/media/maps/raidlands-main/current-texture.jpg?map_version=cb4a8f70",
    );
  });

  it("preserves existing queries and fragments", () => {
    expect(versionMapAssetUrl("/current-terrain.json?quality=full#map", "wipe 2"))
      .toBe("/current-terrain.json?quality=full&map_version=wipe%202#map");
  });

  it("leaves unversioned or missing assets unchanged", () => {
    expect(versionMapAssetUrl("/current-texture.jpg", "")).toBe("/current-texture.jpg");
    expect(versionMapAssetUrl("", "abc123")).toBe("");
    expect(versionMapAssetUrl("data:application/json,{}", "abc123"))
      .toBe("data:application/json,{}");
  });
});
