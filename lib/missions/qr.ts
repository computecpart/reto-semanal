import "server-only";

import QRCode from "qrcode";

// Error correction M and a 4-module quiet zone: reliable on projected screens.
const OPTIONS = { errorCorrectionLevel: "M" as const, margin: 4 };

export async function qrPngDataUrl(url: string, width = 640): Promise<string> {
  return QRCode.toDataURL(url, { ...OPTIONS, width });
}

export async function qrSvgDataUrl(url: string): Promise<string> {
  const svg = await QRCode.toString(url, { ...OPTIONS, type: "svg" });
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
