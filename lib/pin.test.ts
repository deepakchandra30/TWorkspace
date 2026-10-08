import { describe, expect, it } from "vitest";
import { PIN_LENGTH, formatPin, normalizePin } from "./pin";

describe("formatPin", () => {
  it.each([0, 7, 4821, 999_999])("pads %i to a fixed-length digit string", (n) => {
    const pin = formatPin(n);
    expect(pin).toMatch(new RegExp(`^\\d{${PIN_LENGTH}}$`));
    expect(Number(pin)).toBe(n);
  });
});

describe("normalizePin", () => {
  it("accepts a PIN typed with spaces, as the header shows it", () => {
    const pin = formatPin(482_913);
    const spaced = `${pin.slice(0, 3)} ${pin.slice(3)}`;
    expect(normalizePin(spaced)).toBe(pin);
  });

  it.each(["", "12345", "1234567", "12a456", "------", null, undefined, 482913])("rejects %j", (input) => {
    expect(normalizePin(input)).toBeNull();
  });
});
