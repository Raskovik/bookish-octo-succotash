// The exact strings assert_clean_text() raises in 0077_content_filter.sql
// — kept in sync by hand since Postgres and TypeScript can't share a
// literal. Used to show the real "that's not allowed" message instead of
// a generic fallback written for a different failure mode (e.g. a DM
// blocked by the recipient), without blindly surfacing every possible
// Postgres error message to the player.
const FILTER_MESSAGES = [
  "That text contains a word or phrase that isn't allowed.",
  "That text contains a link that isn't allowed.",
];

export function friendlyWriteError(message: string, fallback: string): string {
  return FILTER_MESSAGES.includes(message) ? message : fallback;
}
