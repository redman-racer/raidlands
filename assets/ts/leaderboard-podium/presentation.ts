import type { Leader } from "./policy";
import { playerSignageText } from "./signage";

export type PodiumPresentation = {
  board: string;
  metric: string;
  leaders: Leader[];
};

export type PodiumPresentationSignatures = {
  characters: [string, string, string];
  signage: string;
  presentation: string;
};

export type PodiumPresentationDiff = {
  changedRanks: number[];
  removedRanks: number[];
  signageChanged: boolean;
  unchanged: boolean;
};

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.keys(value as Record<string, unknown>).sort().reduce<Record<string, unknown>>((result, key) => {
    result[key] = stableValue((value as Record<string, unknown>)[key]);
    return result;
  }, {});
}

function stableSignature(value: unknown): string {
  return JSON.stringify(stableValue(value));
}

export function podiumLeaderIdentity(leader: Leader | undefined, board: string): string {
  if (!leader) return "";
  const identity = board === "bots"
    ? leader.bot_key || leader.display_name
    : leader.steam_id64 || leader.display_name || leader.steam_display_name;
  if (identity !== undefined && String(identity).trim() !== "") return String(identity).trim();
  return leader.appearance ? "appearance-preview" : "";
}

export function podiumCharacterSignature(leader: Leader | undefined, board: string): string {
  const identity = podiumLeaderIdentity(leader, board);
  if (!identity) return "";
  return stableSignature({ identity, appearance: leader?.appearance || null });
}

export function podiumPresentationSignatures(presentation: PodiumPresentation): PodiumPresentationSignatures {
  const leaders = Array.from({ length: 3 }, (_, index) => presentation.leaders[index]);
  const characters = leaders.map((leader) => podiumCharacterSignature(leader, presentation.board)) as [string, string, string];
  const signage = stableSignature({
    board: presentation.board,
    metric: presentation.metric,
    signs: leaders.map((leader, index) => playerSignageText(leader, index + 1, presentation.board, presentation.metric)),
  });
  return {
    characters,
    signage,
    presentation: stableSignature({ characters, signage }),
  };
}

export function diffPodiumPresentations(
  previous: PodiumPresentation | undefined,
  next: PodiumPresentation,
): PodiumPresentationDiff {
  const previousSignatures = previous
    ? podiumPresentationSignatures(previous)
    : { characters: ["", "", ""] as [string, string, string], signage: "", presentation: "" };
  const nextSignatures = podiumPresentationSignatures(next);
  const changedRanks = nextSignatures.characters
    .map((signature, index) => signature !== previousSignatures.characters[index] ? index : -1)
    .filter((index) => index >= 0);
  const removedRanks = changedRanks.filter((index) => nextSignatures.characters[index] === "");
  const signageChanged = previousSignatures.signage !== nextSignatures.signage;
  return {
    changedRanks,
    removedRanks,
    signageChanged,
    unchanged: !signageChanged && changedRanks.length === 0,
  };
}
