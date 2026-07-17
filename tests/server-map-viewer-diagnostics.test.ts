import { describe, expect, it } from "vitest";
import { diagnosticPeak, diagnosticPercentile, mapViewerDiagnosticsEnabled } from "../assets/ts/server-map-viewer/viewer-diagnostics";

describe("map viewer diagnostics math", () => {
  it("calculates nearest-rank percentiles without mutating the input", () => {
    const values = [50, 10, 40, 20, 30];
    expect(diagnosticPercentile(values, 0.95)).toBe(50);
    expect(diagnosticPercentile(values, 0.5)).toBe(30);
    expect(values).toEqual([50, 10, 40, 20, 30]);
  });

  it("retains finite peaks and ignores invalid candidates", () => {
    expect(diagnosticPeak(120, 80)).toBe(120);
    expect(diagnosticPeak(120, 180)).toBe(180);
    expect(diagnosticPeak(120, Number.NaN)).toBe(120);
  });

  it("enables localhost and explicit debug sessions only", () => {
    expect(mapViewerDiagnosticsEnabled({ hostname: "localhost", search: "" } as Location)).toBe(true);
    expect(mapViewerDiagnosticsEnabled({ hostname: "raidlands.net", search: "?mapDebug=1" } as Location)).toBe(true);
    expect(mapViewerDiagnosticsEnabled({ hostname: "localhost", search: "?mapDebug=0" } as Location)).toBe(false);
    expect(mapViewerDiagnosticsEnabled({ hostname: "raidlands.net", search: "" } as Location)).toBe(false);
  });
});
