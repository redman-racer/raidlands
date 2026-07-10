const CANONICAL_PRECISION = 1_000_000;

export type CanonicalJsonValue =
  | null
  | boolean
  | number
  | string
  | CanonicalJsonValue[]
  | { [key: string]: CanonicalJsonValue };

export function quantizeCanonicalNumber(value: number): number {
  if (!Number.isFinite(value)) {
    throw new TypeError(`Canonical JSON cannot encode non-finite number ${String(value)}.`);
  }

  const quantized = Math.round((value + Number.EPSILON) * CANONICAL_PRECISION) / CANONICAL_PRECISION;
  return Object.is(quantized, -0) ? 0 : quantized;
}

function compareOrdinal(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

export function normalizeCanonicalValue(value: unknown, path = "$root"): CanonicalJsonValue {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return quantizeCanonicalNumber(value);
  }

  if (Array.isArray(value)) {
    return value.map((entry, index) => {
      if (entry === undefined) {
        throw new TypeError(`Canonical JSON cannot encode undefined at ${path}[${index}].`);
      }
      return normalizeCanonicalValue(entry, `${path}[${index}]`);
    });
  }

  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    const normalized: Record<string, CanonicalJsonValue> = {};
    for (const key of Object.keys(record).sort(compareOrdinal)) {
      if (record[key] === undefined) {
        continue;
      }
      normalized[key] = normalizeCanonicalValue(record[key], `${path}.${key}`);
    }
    return normalized;
  }

  throw new TypeError(`Canonical JSON cannot encode ${typeof value} at ${path}.`);
}

/**
 * Canonical contract shared with PHP:
 * - recursively ordinal-sort object keys;
 * - preserve array order;
 * - quantize numbers to 1e-6 and normalize negative zero;
 * - use minimal JSON number spelling and no insignificant whitespace.
 */
export function canonicalJson(value: unknown): string {
  return JSON.stringify(normalizeCanonicalValue(value));
}
