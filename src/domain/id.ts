/** Generate a 10-character uppercase hex id, matching the prototype's id style. */
export function genId(): string {
  const bytes =
    typeof crypto !== 'undefined' && crypto.getRandomValues
      ? Array.from(crypto.getRandomValues(new Uint8Array(5)))
      : Array.from({ length: 5 }, () => Math.floor(Math.random() * 256));
  return bytes.map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}
