/**
 * Server-side helpers for embed / kiosk URLs (see docs/EMBEDDED-CAST.md).
 */

export function isEmbedSearchParam(embed: string | string[] | undefined): boolean {
  if (embed == null) return false;
  const v = Array.isArray(embed) ? embed[0] : embed;
  return v === "1" || v === "true" || v === "yes";
}
