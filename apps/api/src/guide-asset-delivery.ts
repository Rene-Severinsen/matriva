export const GUIDE_ASSET_VARIANT_VERSION = "v1";
export const GUIDE_ASSET_VARIANT_FORMAT = "webp" as const;
export const GUIDE_ASSET_VARIANT_MIME_TYPE = "image/webp" as const;
export const GUIDE_ASSET_VARIANT_QUALITY = 82;
export const GUIDE_ASSET_LARGE_WIDTH = 1440;
export const GUIDE_ASSET_STEP_WIDTH = 1024;

const largePlacements = new Set([
  "cover",
  "inline",
  "before",
  "after",
  "print_appendix"
]);

export type GuideAssetDeliveryPlacement =
  | "cover"
  | "inline"
  | "step"
  | "before"
  | "after"
  | "print_appendix";

export type GuideAssetDeliveryPlan = {
  width: number;
  quality: number;
  key: string;
  mimeType: typeof GUIDE_ASSET_VARIANT_MIME_TYPE;
};

function withoutExtension(storageKey: string) {
  return storageKey.replace(/\.[^/.]+$/, "");
}

export function guideAssetVariantWidth(placement: GuideAssetDeliveryPlacement | string) {
  return largePlacements.has(placement) ? GUIDE_ASSET_LARGE_WIDTH : GUIDE_ASSET_STEP_WIDTH;
}

export function guideAssetVariantKey(
  storageKey: string,
  checksumSha256: string,
  width: number,
  quality = GUIDE_ASSET_VARIANT_QUALITY
) {
  const checksum = checksumSha256.slice(0, 16);
  return `${withoutExtension(storageKey)}/variants/${GUIDE_ASSET_VARIANT_VERSION}/${width}w-q${quality}-${checksum}.${GUIDE_ASSET_VARIANT_FORMAT}`;
}

export function guideAssetDeliveryPlan(input: {
  storageKey: string;
  checksumSha256: string | null;
  mimeType: string;
  placement?: GuideAssetDeliveryPlacement | string | null;
  preferredWidth?: number | null;
}): GuideAssetDeliveryPlan | null {
  if (!input.checksumSha256 || input.mimeType === "image/svg+xml") return null;

  const width = input.preferredWidth ?? guideAssetVariantWidth(input.placement ?? "step");
  return {
    width,
    quality: GUIDE_ASSET_VARIANT_QUALITY,
    key: guideAssetVariantKey(input.storageKey, input.checksumSha256, width),
    mimeType: GUIDE_ASSET_VARIANT_MIME_TYPE
  };
}

export function isStorageObjectNotFound(error: unknown) {
  return (
    (typeof error === "object" && error !== null && "status" in error && error.status === 404) ||
    (typeof error === "object" && error !== null && "code" in error && error.code === "ENOENT")
  );
}

export async function readGuideAssetWithFallback<T>(input: {
  plan: GuideAssetDeliveryPlan | null;
  original: { key: string; mimeType: string };
  read: (key: string, mimeType: string) => Promise<T>;
}) {
  if (input.plan) {
    try {
      return {
        content: await input.read(input.plan.key, input.plan.mimeType),
        key: input.plan.key,
        mimeType: input.plan.mimeType,
        variant: true as const
      };
    } catch (error) {
      if (!isStorageObjectNotFound(error)) throw error;
    }
  }

  return {
    content: await input.read(input.original.key, input.original.mimeType),
    key: input.original.key,
    mimeType: input.original.mimeType,
    variant: false as const
  };
}
