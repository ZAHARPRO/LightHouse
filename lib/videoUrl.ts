/** Extracts Google Drive file ID from share/view/edit/thumbnail URLs */
function getGDriveId(url: string): string | null {
  // /file/d/ID/...
  const m1 = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (m1) return m1[1];
  // ?id=ID or &id=ID
  const m2 = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  return m2 ? m2[1] : null;
}

export function isGDriveEmbed(url: string): boolean {
  return url.includes("drive.google.com") && url.includes("/preview");
}

/**
 * Converts a Google Drive share URL to an embeddable preview URL.
 * Returns the original URL unchanged for non-Drive links.
 */
export function normalizeVideoUrl(url: string): string {
  if (!url.includes("drive.google.com")) return url;
  const id = getGDriveId(url);
  if (!id) return url;
  return `https://drive.google.com/file/d/${id}/preview`;
}

/**
 * Converts a Google Drive share/view URL to a direct image thumbnail URL.
 * Returns the original URL unchanged for non-Drive links.
 */
export function normalizeThumbnailUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (!url.includes("drive.google.com")) return url;
  const id = getGDriveId(url);
  if (!id) return url;
  return `https://drive.google.com/thumbnail?id=${id}&sz=w640`;
}
