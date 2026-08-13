export const GUIDE_ASSET_VARIANT_VERSION = "v1";
export const GUIDE_ASSET_VARIANT_FORMAT = "webp";
export const GUIDE_ASSET_VARIANT_MIME_TYPE = "image/webp";
export const GUIDE_ASSET_VARIANT_QUALITY = 82;
export const GUIDE_ASSET_LARGE_WIDTH = 1440;
export const GUIDE_ASSET_STEP_WIDTH = 1024;

const largePlacements = new Set(["cover", "inline", "before", "after", "print_appendix"]);

function withoutExtension(storageKey) {
  return storageKey.replace(/\.[^/.]+$/, "");
}

export function guideAssetVariantWidth(placement) {
  return largePlacements.has(placement) ? GUIDE_ASSET_LARGE_WIDTH : GUIDE_ASSET_STEP_WIDTH;
}

export function guideAssetVariantKey(storageKey, checksumSha256, width, quality = GUIDE_ASSET_VARIANT_QUALITY) {
  return `${withoutExtension(storageKey)}/variants/${GUIDE_ASSET_VARIANT_VERSION}/${width}w-q${quality}-${checksumSha256.slice(0, 16)}.${GUIDE_ASSET_VARIANT_FORMAT}`;
}
