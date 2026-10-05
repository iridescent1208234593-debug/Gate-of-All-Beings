const assetBase = (import.meta.env.VITE_ASSET_BASE_URL || "").replace(/\/+$/, "");

export function asset(path) {
  const relativePath = String(path).replace(/^\/+/, "");
  return `${assetBase || "/assets"}/${relativePath}`;
}
