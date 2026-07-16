import { describe, expect, it } from "vitest";
import { selectLiveReplayEvents } from "../assets/ts/server-map-viewer/live-replay-policy";

type TestEvent = {
  eventKey: string;
  occurredAt: string;
  payload: Record<string, unknown>;
};

const referenceTime = Date.parse("2026-07-17T03:00:00Z");

function event(eventKey: string, occurredAt: string, kind = "world_vehicle", state = "active"): TestEvent {
  return { eventKey, occurredAt, payload: { kind, state } };
}

describe("current-wipe live replay selection", () => {
  it("keeps active vehicles from every fresh frame and prioritizes them over transient events", () => {
    const selected = selectLiveReplayEvents([
      { events: [event("cargo", "2026-07-17T02:48:00Z"), event("airstrike", "2026-07-17T02:49:00Z", "airstrike", "fired")] },
      { events: [event("bradley", "2026-07-17T02:59:30Z")] },
    ], referenceTime, 15 * 60 * 1000, 16);

    expect(selected.map((entry) => entry.eventKey)).toEqual(["bradley", "cargo", "airstrike"]);
  });

  it("keeps recently ended Cargo and F15 routes for one final live replay", () => {
    const selected = selectLiveReplayEvents([
      { events: [
        event("cargo-ended", "2026-07-17T02:59:00Z", "world_vehicle", "ended"),
        event("f15-ended", "2026-07-17T02:58:30Z", "world_vehicle", "destroyed"),
      ] },
    ], referenceTime, 15 * 60 * 1000, 16);

    expect(selected.map((entry) => entry.eventKey)).toEqual(["cargo-ended", "f15-ended"]);
  });

  it("drops stale prior activity and deduplicates updated entity rows", () => {
    const selected = selectLiveReplayEvents([
      { events: [event("cargo", "2026-07-17T02:30:00Z"), event("bradley", "2026-07-17T02:58:00Z")] },
      { events: [event("bradley", "2026-07-17T02:59:00Z")] },
    ], referenceTime, 15 * 60 * 1000, 16);

    expect(selected.map((entry) => entry.eventKey)).toEqual(["bradley"]);
    expect(selected[0]?.occurredAt).toBe("2026-07-17T02:59:00Z");
  });
});
