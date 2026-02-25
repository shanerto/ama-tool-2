/**
 * Stable anonymous voter ID stored in a cookie.
 * Generated once per browser, persisted server-side in every response.
 */

export const VOTER_COOKIE = "ama_voter_id";

export function generateVoterId(): string {
  // Crypto-random UUID — unique enough for MVP voter dedup
  return crypto.randomUUID();
}
