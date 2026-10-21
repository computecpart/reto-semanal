import "server-only";

import QRCode from "qrcode";

import { landingAssetUrl } from "@/lib/landing/assets";

import { detectImageMime } from "./image";

// Error correction M and a 4-module quiet zone: reliable on projected screens.
const OPTIONS = { errorCorrectionLevel: "M" as const, margin: 4 };
const MAX_LOGO_BYTES = 1024 * 1024;
// Logo side as a fraction of the QR side: 0.22² ≈ 5 % of the area (limit 20 %).
const LOGO_SIDE = 0.22;

export async function qrPngDataUrl(url: string, width = 640): Promise<string> {
  return QRCode.toDataURL(url, { ...OPTIONS, width });
}

export async function qrSvgDataUrl(url: string): Promise<string> {
  const svg = await QRCode.toString(url, { ...OPTIONS, type: "svg" });
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * QR with the campaign logo in the center (error correction H). The logo is
 * read from our own bucket path, validated and inlined, so the SVG has no
 * external references. Returns null when there is no usable logo.
 */
export async function qrSvgWithLogoDataUrl(url: string, logoPath: string | null | undefined): Promise<string | null> {
  const logoUrl = landingAssetUrl(logoPath);

  if (!logoUrl) {
    return null;
  }

  let bytes: Uint8Array;

  try {
    const response = await fetch(logoUrl, { cache: "force-cache" });

    if (!response.ok || Number(response.headers.get("content-length") ?? 0) > MAX_LOGO_BYTES) {
      return null;
    }

    bytes = new Uint8Array(await response.arrayBuffer());
  } catch {
    return null;
  }

  const mime = detectImageMime(bytes);

  if (!mime || bytes.byteLength > MAX_LOGO_BYTES) {
    return null;
  }

  const svg = await QRCode.toString(url, { errorCorrectionLevel: "H", margin: 4, type: "svg" });
  const size = Number(/viewBox="0 0 (\d+) \d+"/.exec(svg)?.[1] ?? 0);

  if (!size) {
    return null;
  }

  const side = size * LOGO_SIDE;
  const offset = (size - side) / 2;
  const pad = side * 0.08;
  const logo = `<rect x="${offset - pad}" y="${offset - pad}" width="${side + pad * 2}" height="${side + pad * 2}" fill="#ffffff"/><image href="data:${mime};base64,${Buffer.from(bytes).toString("base64")}" x="${offset}" y="${offset}" width="${side}" height="${side}" preserveAspectRatio="xMidYMid meet"/>`;
  const withLogo = svg.replace("</svg>", `${logo}</svg>`);

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(withLogo)}`;
}
