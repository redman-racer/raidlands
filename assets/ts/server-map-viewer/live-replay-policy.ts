export type LiveReplaySelectionEvent = {
  eventKey?: string;
  occurredAt?: string;
  payload?: Record<string, unknown>;
};

export type LiveReplaySelectionFrame<T extends LiveReplaySelectionEvent> = {
  events?: T[];
};

function isWorldVehicle(event: LiveReplaySelectionEvent): boolean {
  return String(event.payload?.kind || "").trim().toLowerCase() === "world_vehicle";
}

function isActiveWorldVehicle(event: LiveReplaySelectionEvent): boolean {
  if (!isWorldVehicle(event)) return false;
  const state = String(event.payload?.state || "active").trim().toLowerCase();
  return state !== "ended" && state !== "destroyed";
}

function eventTime(event: LiveReplaySelectionEvent): number {
  const timestamp = Date.parse(String(event.occurredAt || ""));
  return Number.isFinite(timestamp) ? timestamp : Number.NaN;
}

export function selectLiveReplayEvents<T extends LiveReplaySelectionEvent>(
  frames: LiveReplaySelectionFrame<T>[],
  referenceTime: number,
  maxAgeMs: number,
  limit = 16,
): T[] {
  const candidates = frames.flatMap((frame) => Array.isArray(frame.events) ? frame.events : [])
    .filter((event) => {
      const timestamp = eventTime(event);
      return !Number.isFinite(timestamp)
        || (referenceTime - timestamp <= maxAgeMs && timestamp - referenceTime <= 60_000);
    })
    .sort((left, right) => {
      const leftTime = eventTime(left);
      const rightTime = eventTime(right);
      if (!Number.isFinite(leftTime)) return Number.isFinite(rightTime) ? 1 : 0;
      if (!Number.isFinite(rightTime)) return -1;
      return rightTime - leftTime;
    });

  const seen = new Set<string>();
  const activeWorldVehicles: T[] = [];
  const transientEvents: T[] = [];

  candidates.forEach((event, index) => {
    const key = String(event.eventKey || `live-event-${event.occurredAt || "unknown"}-${index}`);
    if (seen.has(key)) return;
    seen.add(key);

    if (isActiveWorldVehicle(event)) {
      activeWorldVehicles.push(event);
    } else {
      // Recently ended world vehicles remain visible as one final route replay.
      transientEvents.push(event);
    }
  });

  return [...activeWorldVehicles, ...transientEvents].slice(0, Math.max(1, limit));
}
