import { describe, expect, it } from "vitest";
import { monumentPrimitiveKind } from "../assets/ts/server-map-viewer/monument-primitive-policy";

describe("server map monument primitive policy", () => {
  it.each([
    ["assets/bundled/prefabs/autospawn/monument/large/airfield_1.prefab", "airfield"],
    ["assets/bundled/prefabs/autospawn/monument/medium/powerplant_1.prefab", "power-plant"],
    ["assets/bundled/prefabs/autospawn/monument/medium/trainyard_1.prefab", "train-yard"],
    ["assets/bundled/prefabs/autospawn/monument/medium/military_tunnel_1.prefab", "military-tunnels"],
    ["assets/bundled/prefabs/autospawn/tunnel/entrance/entrance_bunker_b.prefab", "bunker"],
    ["assets/bundled/prefabs/autospawn/monument/roadside/gas_station_1.prefab", "gas-station"],
    ["assets/bundled/prefabs/autospawn/monument/roadside/supermarket_1.prefab", "supermarket"],
    ["assets/bundled/prefabs/autospawn/monument/roadside/warehouse.prefab", "warehouse"],
    ["assets/bundled/prefabs/autospawn/monument/mining_quarry_a.prefab", "quarry"],
  ])("routes %s to its own builder", (prefab, expected) => {
    expect(monumentPrimitiveKind({ prefab })).toBe(expected);
  });

  it("does not misroute Mining Outpost as a quarry", () => {
    expect(monumentPrimitiveKind({ name: "Mining Outpost", prefab: "mining_outpost.prefab" })).toBe("generic");
  });

  it("uses names and kinds when prefab metadata is sparse", () => {
    expect(monumentPrimitiveKind({ name: "Oxum's Gas Station" })).toBe("gas-station");
    expect(monumentPrimitiveKind({ kind: "Satellite Dish" })).toBe("satellite-dish");
    expect(monumentPrimitiveKind({ name: "Train Tunnel", kind: "military_tunnel" })).toBe("bunker");
  });
});
