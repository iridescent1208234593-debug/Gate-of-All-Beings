// Stored identity images keep their durable id, /assets/uploads/<name>. Huiguan never serves that
// path raw (it answers 404 so originals stay private); pages show it through Huiguan's preview
// route on the visitor's own root.
export const UPLOAD_PREFIX = '/assets/uploads/';

export function uploadDisplayUrl(asset: string, huiguanOrigin: string): string {
  if (!asset.startsWith(UPLOAD_PREFIX)) return asset;
  return `${huiguanOrigin}/api/uploads/preview?name=${encodeURIComponent(asset.slice(UPLOAD_PREFIX.length))}`;
}

// account_avatar_url arrives as the stored id (relative) or as an absolute URL; both carry the id
// in their path. A relative value needs a base, otherwise new URL() throws.
export function assetIdFromUrl(value: string, base: string): string {
  return new URL(value, base).pathname;
}
