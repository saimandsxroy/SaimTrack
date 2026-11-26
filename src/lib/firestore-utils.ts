import type { TimeEntry } from "@/features/time-tracker/time-tracker-types";

/**
 * Recursively removes `undefined` properties (and `undefined` elements inside arrays)
 * so Firestore setDoc/runTransaction never fails with "Unsupported field value: undefined".
 * Preserves `null`, primitives (including `0`, `false`, `""`), `Date`, and non-plain
 * class instances (such as Firestore `Timestamp` or `FieldValue`).
 */
export function stripUndefined<T>(value: T): T {
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => stripUndefined(item)) as unknown as T;
  }
  if (value !== null && typeof value === "object") {
    if (value instanceof Date) {
      return value;
    }
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      return value;
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        out[k] = stripUndefined(v);
      }
    }
    return out as T;
  }
  return value;
}

export function measurePayloadBytes(payload: unknown): number {
  const serialized = JSON.stringify(payload);
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(serialized).length;
  }
  return serialized.length * 2;
}

/**
 * Deduplicate entries by stable session ID so duplicate writes/offline replays never inflate totals.
 */
export function deduplicateEntries(entries: TimeEntry[]): TimeEntry[] {
  const seen = new Set<string>();
  const result: TimeEntry[] = [];
  for (const entry of entries) {
    if (!entry?.id || seen.has(entry.id)) continue;
    seen.add(entry.id);
    result.push(entry);
  }
  return result;
}
