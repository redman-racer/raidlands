import { describe, expect, it } from "vitest";
import {
  canonicalJson,
  quantizeCanonicalNumber,
  sha256Hex,
} from "../assets/ts/airstrike-animation-editor/index";

describe("airstrike canonical JSON", () => {
  it("sorts keys recursively, preserves arrays, and emits minimal quantized numbers", () => {
    expect(
      canonicalJson({
        z: -0,
        list: [{ beta: 2.0000004, alpha: 0.000001 }],
        a: 1.23456789,
      }),
    ).toBe('{"a":1.234568,"list":[{"alpha":0.000001,"beta":2}],"z":0}');
  });

  it("rejects non-finite values", () => {
    expect(() => canonicalJson({ value: Number.POSITIVE_INFINITY })).toThrow(/non-finite/);
    expect(() => canonicalJson({ value: Number.NaN })).toThrow(/non-finite/);
  });

  it("normalizes negative zero after quantization", () => {
    expect(Object.is(quantizeCanonicalNumber(-0.0000001), -0)).toBe(false);
    expect(quantizeCanonicalNumber(-0.0000001)).toBe(0);
  });
});

describe("browser-safe SHA-256", () => {
  it("matches standard vectors", () => {
    expect(sha256Hex("")).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(sha256Hex("Raidlands ✈")).toHaveLength(64);
  });
});
