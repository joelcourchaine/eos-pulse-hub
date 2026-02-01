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
