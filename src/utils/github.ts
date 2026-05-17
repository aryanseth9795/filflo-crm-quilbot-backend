import crypto from 'crypto';

/**
 * Verify GitHub webhook HMAC-SHA256 signature
 */
export const verifyGitHubSignature = (
  payload: Buffer,
  signature: string | undefined,
  secret: string
): boolean => {
  if (!signature) return false;
  const expected = `sha256=${crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')}`;
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
};

/**
 * Extract all ticket numbers from a PR title.
 * Matches brand-prefixed IDs of the form `LETTERS-DIGITS` (e.g. FILFLO-001, MY-BRAND-003)
 * appearing either bare or wrapped in brackets/parens — all of these work:
 *   "FILFLO-001 fix login"          → ["FILFLO-001"]
 *   "[FILFLO-001] fix login"        → ["FILFLO-001"]
 *   "Hotfix FILFLO-001 and ACME-42" → ["FILFLO-001", "ACME-42"]
 *
 * Loose matching can produce false positives (e.g. version strings like "v2-1"),
 * but downstream `Ticket.findOne({ ticketNumber })` filters them out as `not_found`.
 */
export const extractTicketNumbers = (prTitle: string): string[] => {
  const regex = /\b([A-Z][A-Z0-9-]*-\d+)\b/gi;
  const ids: string[] = [];
  let match: RegExpExecArray | null;
  while ((match = regex.exec(prTitle)) !== null) {
    ids.push(match[1].toUpperCase());
  }
  return [...new Set(ids)]; // deduplicate
};

/**
 * @deprecated Use extractTicketNumbers instead
 */
export const extractTicketIds = extractTicketNumbers;

/**
 * Generate a cryptographically secure webhook secret
 */
export const generateWebhookSecret = (): string => {
  return `sk_whk_${crypto.randomBytes(24).toString('hex')}`;
};
