import assert from "node:assert/strict";

const delivery = await import("../apps/api/dist/guide-asset-delivery.js");

assert.equal(delivery.guideAssetVariantWidth("cover"), 1440);
assert.equal(delivery.guideAssetVariantWidth("inline"), 1440);
assert.equal(delivery.guideAssetVariantWidth("step"), 1024);
assert.equal(
  delivery.guideAssetVariantKey(
    "qa/guides/matriva-modern-2023/guides/tjek-fuger/wetroom.png",
    "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
    1024
  ),
  "qa/guides/matriva-modern-2023/guides/tjek-fuger/wetroom/variants/v1/1024w-q82-0123456789abcdef.webp"
);

const plan = delivery.guideAssetDeliveryPlan({
  storageKey: "qa/guides/a.png",
  checksumSha256: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
  mimeType: "image/png",
  placement: "step"
});
assert.equal(plan?.mimeType, "image/webp");
assert.equal(plan?.width, 1024);

const variant = Buffer.from("optimized");
const selected = await delivery.readGuideAssetWithFallback({
  plan,
  original: { key: "qa/guides/a.png", mimeType: "image/png" },
  read: async (key) => {
    if (key === plan.key) return variant;
    throw Object.assign(new Error("missing"), { status: 404 });
  }
});
assert.equal(selected.variant, true);
assert.equal(selected.mimeType, "image/webp");
assert.deepEqual(selected.content, variant);

const fallback = await delivery.readGuideAssetWithFallback({
  plan,
  original: { key: "qa/guides/a.png", mimeType: "image/png" },
  read: async (key) => {
    if (key === plan.key) throw Object.assign(new Error("missing"), { status: 404 });
    return Buffer.from("original");
  }
});
assert.equal(fallback.variant, false);
assert.equal(fallback.key, "qa/guides/a.png");
assert.equal(fallback.mimeType, "image/png");

await assert.rejects(
  () => delivery.readGuideAssetWithFallback({
    plan,
    original: { key: "qa/guides/a.png", mimeType: "image/png" },
    read: async () => { throw new Error("storage unavailable"); }
  }),
  /storage unavailable/
);

console.log("Guide asset delivery variant selection and original fallback validated.");
