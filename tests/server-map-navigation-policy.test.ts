import { describe, expect, it } from "vitest";
import { monumentNavigationLabels, recentUniqueNavigationEvents, validNavigationCoordinate } from "../assets/ts/server-map-viewer/navigation-policy";

describe("server map navigation policy", () => {
  it("qualifies duplicate monument names with coordinates", () => {
    const monuments = [{ name: "Harbor", x: 10, z: 20 }, { name: "Harbor", x: -30, z: 40 }, { name: "Launch Site", x: 1, z: 2 }];
    const labels = monumentNavigationLabels(monuments);
    expect(labels.get(monuments[0]!)).toBe("Harbor · 10, 20");
    expect(labels.get(monuments[2]!)).toBe("Launch Site");
  });

  it("deduplicates events and orders newest first", () => {
    const events = recentUniqueNavigationEvents([
      { eventKey: "a", occurredAt: "2026-07-14T10:00:00Z" },
      { eventKey: "b", occurredAt: "2026-07-14T11:00:00Z" },
      { eventKey: "a", occurredAt: "2026-07-14T10:00:00Z" },
    ]);
    expect(events.map((event) => event.eventKey)).toEqual(["b", "a"]);
  });

  it("accepts finite coordinates and rejects empty or invalid input", () => {
    expect(validNavigationCoordinate("-123.5")).toBe(-123.5);
    expect(validNavigationCoordinate(0)).toBe(0);
    expect(validNavigationCoordinate("")).toBeNull();
    expect(validNavigationCoordinate("north")).toBeNull();
  });
});
