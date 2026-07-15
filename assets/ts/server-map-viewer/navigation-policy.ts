export type NavigationMonument = { name: string; x: number; z: number };
export type NavigationEvent = { eventKey?: string; occurredAt?: string };

export function monumentNavigationLabels(monuments: NavigationMonument[]): Map<NavigationMonument, string> {
  const counts = new Map<string, number>();
  monuments.forEach((monument) => counts.set(monument.name, (counts.get(monument.name) || 0) + 1));
  return new Map(monuments.map((monument) => [
    monument,
    (counts.get(monument.name) || 0) > 1
      ? `${monument.name} · ${Math.round(monument.x)}, ${Math.round(monument.z)}`
      : monument.name,
  ]));
}

export function recentUniqueNavigationEvents<T extends NavigationEvent>(events: T[], limit = 50): T[] {
  const unique = new Map<string, T>();
  events.forEach((event, index) => unique.set(event.eventKey || `${event.occurredAt || "event"}-${index}`, event));
  return [...unique.values()]
    .sort((a, b) => Date.parse(String(b.occurredAt || "")) - Date.parse(String(a.occurredAt || "")))
    .slice(0, Math.max(0, limit));
}

export function validNavigationCoordinate(value: unknown): number | null {
  const coordinate = typeof value === "string" && value.trim() === "" ? Number.NaN : Number(value);
  return Number.isFinite(coordinate) ? coordinate : null;
}
