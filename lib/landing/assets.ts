import { ASSET_PATH_PATTERN, LANDING_ASSET_BUCKET } from "./schema";

const EXTENSIONS: Readonly<Record<string, string>> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** Public URL for a validated storage path; anything else yields null. */
export function landingAssetUrl(path: string | null | undefined): string | null {
  if (!path || !ASSET_PATH_PATTERN.test(path)) {
    return null;
  }

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!base) {
    return null;
  }

  return `${base.replace(/\/$/, "")}/storage/v1/object/public/${LANDING_ASSET_BUCKET}/${path}`;
}

export function buildLandingAssetPath(campaignId: string, mimeType: string): string | null {
  const extension = EXTENSIONS[mimeType];

  if (!extension) {
    return null;
  }

  const path = `campaigns/${campaignId}/${globalThis.crypto.randomUUID()}.${extension}`;
  return ASSET_PATH_PATTERN.test(path) ? path : null;
}
