// Supabase token hashes are hex digests, prefixed with "pkce_" when the reset
// was requested from the browser (PKCE flow); anything else is rejected unread.
const TOKEN_HASH = /^(?:pkce_)?[a-f0-9]{20,128}$/i;

export function isRecoveryTokenHash(value: unknown): value is string {
  return typeof value === "string" && TOKEN_HASH.test(value);
}
