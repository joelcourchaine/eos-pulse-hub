/**
 * Normalize Google Drive share links into direct, embeddable URLs.
 *
 * Supports:
 * - https://drive.google.com/file/d/<FILE_ID>/view?...
 * - https://drive.google.com/open?id=<FILE_ID>
 * - https://drive.google.com/uc?id=<FILE_ID>
 * - https://drive.google.com/uc?export=view&id=<FILE_ID>
 */
export function normalizeGoogleDriveImageUrl(input?: string | null): string | null {
  const raw = (input ?? "").trim();
  if (!raw) return null;

  // Only attempt to normalize Drive URLs; otherwise return as-is.
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return raw;
  }

  if (url.hostname !== "drive.google.com") return raw;

  // 1) /file/d/<id>/...
  const fileMatch = url.pathname.match(/\/file\/d\/([^/]+)/);
  const fileIdFromPath = fileMatch?.[1];

  // 2) ?id=<id>
  const fileIdFromQuery = url.searchParams.get("id") || undefined;

  const fileId = fileIdFromPath || fileIdFromQuery;
  if (!fileId) return raw;

  // Use the most reliable direct render URL.
  return `https://drive.google.com/uc?export=view&id=${encodeURIComponent(fileId)}`;
}

export function extractGoogleDriveFileId(input?: string | null): string | null {
  const raw = (input ?? "").trim();
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.hostname !== "drive.google.com") return null;
  const fileMatch = url.pathname.match(/\/file\/d\/([^/]+)/);
  const fileIdFromPath = fileMatch?.[1];
  const fileIdFromQuery = url.searchParams.get("id") || undefined;
  return fileIdFromPath || fileIdFromQuery || null;
}

/**
 * Returns a same-origin URL (backend function) that proxies the Drive file as an image.
 * This avoids Drive hotlink/CORS/redirect issues.
 */
export function getDriveThumbnailProxyUrl(fileId: string): string {
  const base = import.meta.env.VITE_SUPABASE_URL;
  const qs = new URLSearchParams({ id: fileId });
  return `${base}/functions/v1/thumbnail-proxy?${qs.toString()}`;
}

/**
 * Decide what to actually use in <img src>.
 * - For Drive links: use the proxy URL
 * - For everything else: use the raw URL
 */
export function getThumbnailSrc(input?: string | null): string | null {
  const raw = (input ?? "").trim();
  if (!raw) return null;
  const driveId = extractGoogleDriveFileId(raw);
  if (driveId) return getDriveThumbnailProxyUrl(driveId);
  return raw;
}
