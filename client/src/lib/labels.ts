import QRCode from "qrcode";

/**
 * Payload printed as a QR code on every label. Kept short so the code stays
 * coarse and scans reliably from a small print.
 */
export const QR_PREFIX = "wv:cut:";

export function cutQrPayload(cutId: number): string {
  return `${QR_PREFIX}${cutId}`;
}

/** Returns the cut id encoded in a scanned QR code, or null if it isn't ours. */
export function parseCutQr(text: string): number | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith(QR_PREFIX)) return null;
  const id = Number(trimmed.slice(QR_PREFIX.length));
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function qrDataUrl(cutId: number): Promise<string> {
  return QRCode.toDataURL(cutQrPayload(cutId), {
    errorCorrectionLevel: "M",
    margin: 0,
    scale: 6,
    color: { dark: "#000000", light: "#ffffff" },
  });
}

/** Avery 3474 / Herma 4459: 70 × 37 mm, 3 columns × 8 rows on A4. */
export const LABEL_SHEET = {
  columns: 3,
  rows: 8,
  widthMm: 70,
  heightMm: 37,
};

export const LABELS_PER_SHEET = LABEL_SHEET.columns * LABEL_SHEET.rows;

export function addDays(isoDate: string, days: number): string {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}
