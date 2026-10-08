// A workspace PIN: 6 digits, the typed fallback when someone can't scan the QR code.

export const PIN_LENGTH = 6;

export function formatPin(n: number): string {
  return String(n).padStart(PIN_LENGTH, "0");
}

// "482913" → "482 913": easier to read off a projector.
export function displayPin(pin: string): string {
  return `${pin.slice(0, 3)} ${pin.slice(3)}`;
}

// People type PINs with spaces ("482 913", as the header shows it); store and compare without.
export function normalizePin(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const digits = input.replace(/\s+/g, "");
  return new RegExp(`^\\d{${PIN_LENGTH}}$`).test(digits) ? digits : null;
}
