/** Formats worth looking for: our own QR codes plus the usual retail barcodes. */
export const SCAN_FORMATS = [
  "qr_code",
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "code_128",
  "code_39",
  "itf",
] as const;

export function hasNativeDetector(): boolean {
  return typeof (window as any).BarcodeDetector !== "undefined";
}

type Decoder = (image: ImageData) => string | null;

let decoderPromise: Promise<Decoder> | null = null;

/**
 * ZXing is only needed where the browser has no built-in BarcodeDetector —
 * notably Safari on iOS. It is a sizeable library, so it is fetched on demand
 * instead of riding along in the main bundle.
 */
async function loadZxingDecoder(): Promise<Decoder> {
  const {
    BarcodeFormat,
    BinaryBitmap,
    DecodeHintType,
    HybridBinarizer,
    MultiFormatReader,
    RGBLuminanceSource,
  } = await import("@zxing/library");

  const reader = new MultiFormatReader();
  const hints = new Map();
  hints.set(DecodeHintType.POSSIBLE_FORMATS, [
    BarcodeFormat.QR_CODE,
    BarcodeFormat.EAN_13,
    BarcodeFormat.EAN_8,
    BarcodeFormat.UPC_A,
    BarcodeFormat.UPC_E,
    BarcodeFormat.CODE_128,
    BarcodeFormat.CODE_39,
    BarcodeFormat.ITF,
  ]);
  hints.set(DecodeHintType.TRY_HARDER, true);
  reader.setHints(hints);

  return (image: ImageData) => {
    const rgba = image.data;
    const luminances = new Uint8ClampedArray(image.width * image.height);
    for (let i = 0, j = 0; i < rgba.length; i += 4, j++) {
      luminances[j] = (rgba[i] * 0.299 + rgba[i + 1] * 0.587 + rgba[i + 2] * 0.114) | 0;
    }

    const source = new RGBLuminanceSource(luminances, image.width, image.height);
    const bitmap = new BinaryBitmap(new HybridBinarizer(source));
    try {
      return reader.decode(bitmap).getText();
    } catch {
      // No code in this frame — normal while the camera is still being aimed.
      return null;
    } finally {
      reader.reset();
    }
  };
}

export function decoderReady(): Promise<Decoder> {
  if (!decoderPromise) decoderPromise = loadZxingDecoder();
  return decoderPromise;
}
