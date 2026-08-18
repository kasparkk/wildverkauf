export interface LabelScan {
  species: string | null;
  cut_name: string | null;
  weight_kg: number | null;
  price_per_kg: number | null;
  fixed_price: number | null;
  harvested_on: string | null;
  packed_on: string | null;
  best_before: string | null;
  raw_text: string;
}

const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.8;

/**
 * Phone photos are several megabytes, which would blow the request limit of the
 * serverless function, so the image is scaled down and re-encoded before upload.
 */
export async function downscaleToBase64(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Bild konnte nicht verarbeitet werden.");
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
  return dataUrl.slice(dataUrl.indexOf(",") + 1);
}
