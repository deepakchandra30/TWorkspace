import { describe, expect, it } from "vitest";
import { MAX_HOURS, MIN_HOURS, clampLifetimeHours, expiresAtFrom } from "./expiry";

describe("clampLifetimeHours", () => {
  it("keeps a value inside the allowed range", () => {
    const inside = Math.floor((MIN_HOURS + MAX_HOURS) / 2);
    expect(clampLifetimeHours(inside)).toBe(inside);
  });

  it("clamps below the minimum and above the maximum", () => {
    expect(clampLifetimeHours(MIN_HOURS - 1)).toBe(MIN_HOURS);
    expect(clampLifetimeHours(-100)).toBe(MIN_HOURS);
    expect(clampLifetimeHours(MAX_HOURS + 1)).toBe(MAX_HOURS);
  });

  it("accepts numeric strings from a form and rounds fractions", () => {
    expect(clampLifetimeHours(String(MIN_HOURS + 1))).toBe(MIN_HOURS + 1);
    expect(clampLifetimeHours(MIN_HOURS + 1.4)).toBe(MIN_HOURS + 1);
  });

  it.each([NaN, Infinity, "abc", "", null, undefined, {}])("rejects %j", (input) => {
    expect(clampLifetimeHours(input)).toBeNull();
  });
});

describe("expiresAtFrom", () => {
  it("adds the hours to the start time", () => {
    const now = new Date("2026-10-03T12:00:00Z");
    expect(expiresAtFrom(now, 3).getTime() - now.getTime()).toBe(3 * 60 * 60 * 1000);
  });
});
