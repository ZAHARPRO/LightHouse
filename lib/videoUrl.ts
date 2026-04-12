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

/** Extracts YouTube video ID from watch, short, embed, and youtu.be URLs */
function getYouTubeId(url: string): string | null {
  // youtu.be/ID
  const m1 = url.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
  if (m1) return m1[1];
  // youtube.com/shorts/ID
  const m2 = url.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
  if (m2) return m2[1];
  // youtube.com/embed/ID
  const m3 = url.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
  if (m3) return m3[1];
  // youtube.com/watch?v=ID or /v/ID
  const m4 = url.match(/(?:[?&]v=|\/v\/)([a-zA-Z0-9_-]{11})/);
  if (m4) return m4[1];
  return null;
}

export function isYouTubeEmbed(url: string): boolean {
  return (url.includes("youtube.com") || url.includes("youtu.be")) &&
    url.includes("/embed/");
}

/**
 * Converts Google Drive and YouTube share URLs to embeddable URLs.
 * Returns the original URL unchanged for other links.
 */
export function normalizeVideoUrl(url: string): string {
  if (url.includes("drive.google.com")) {
    const id = getGDriveId(url);
    if (!id) return url;
    return `https://drive.google.com/file/d/${id}/preview`;
  }
  if (url.includes("youtube.com") || url.includes("youtu.be")) {
    const id = getYouTubeId(url);
    if (!id) return url;
    return `https://www.youtube.com/embed/${id}`;
  }
  return url;
}

/**
 * Converts Google Drive and YouTube URLs to thumbnail image URLs.
 * Returns the original URL unchanged for other links.
 */
export function normalizeThumbnailUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.includes("drive.google.com")) {
    const id = getGDriveId(url);
    if (!id) return url;
    return `https://drive.google.com/thumbnail?id=${id}&sz=w640`;
  }
  if (url.includes("youtube.com") || url.includes("youtu.be")) {
    const id = getYouTubeId(url);
    if (!id) return url;
    return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
  }
  return url;
}
