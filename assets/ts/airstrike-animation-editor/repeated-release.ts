import {
  DEFAULT_PAYLOAD_EVENT,
  type PayloadEventFields,
  type RepeatedReleaseGroup,
  type RepeatedReleaseSource,
  type MixedReleaseSource,
} from "./types";

function clonePayload(fields: PayloadEventFields): PayloadEventFields {
  return {
    ...fields,
    DamageScales: { ...fields.DamageScales },
  };
}

export function cloneRepeatedReleaseGroup(group: RepeatedReleaseGroup): RepeatedReleaseGroup {
  return {
    ...group,
    Template: clonePayload(group.Template),
    HardpointSequence: [...group.HardpointSequence],
  };
}

export function hasGroupedRepeatedReleases(release: RepeatedReleaseSource | MixedReleaseSource): boolean {
  return Array.isArray(release.Groups) && release.Groups.length > 0;
}

/**
 * Resolves both the new grouped source shape and the original single repeated
 * sequence. The synthetic ID lets old drafts enter the grouped UI without a
 * migration or destructive save-time rewrite.
 */
export function repeatedReleaseGroups(release: RepeatedReleaseSource | MixedReleaseSource): RepeatedReleaseGroup[] {
  if (release.Mode === "mixed") {
    return release.Groups;
  }
  if (hasGroupedRepeatedReleases(release)) {
    return release.Groups!;
  }
  return [
    {
      Id: "automatic_001",
      Name: "Automatic group 1",
      StartTime: Number(release.StartTime ?? 0),
      IntervalSeconds: Number(release.IntervalSeconds ?? 0.5),
      UnitIntervalSeconds: 0,
      UnitsPerRelease: Math.max(1, Number(release.UnitsPerRelease ?? release.Template?.Count ?? 1)),
      MaximumUnits: Math.max(0, Number(release.MaximumUnits ?? 0)),
      Template: clonePayload(release.Template ?? DEFAULT_PAYLOAD_EVENT),
      HardpointSequence: [...(release.HardpointSequence ?? [])],
    },
  ];
}

export function firstRepeatedReleaseTime(release: RepeatedReleaseSource): number {
  return Math.min(...repeatedReleaseGroups(release).map((group) => group.StartTime));
}
