/**
 * Formats a timestamp for logging
 * Returns ISO timestamp in format: YYYY-MM-DD HH:MM:SS
 */
export function getTimestamp(): string {
  const now = new Date();
  return now.toISOString().replace('T', ' ').substring(0, 19);
}
