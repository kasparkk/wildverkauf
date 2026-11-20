import { useEffect, useRef, useState } from "react";
import { SCAN_FORMATS, decoderReady, hasNativeDetector } from "../lib/barcode";
import { kamera } from "bausteine/kamera";

const DECODE_INTERVAL_MS = 100;
const MAX_DECODE_WIDTH = 960;
// Region of the square preview that is decoded: slightly larger than the white frame.
const ROI = { x: 0.05, y: 0.25, w: 0.9, h: 0.5 };

/**
 * Scans QR codes and common retail barcodes from the rear camera. Uses the
 * browser's native BarcodeDetector where available and falls back to ZXing
 * everywhere else — Safari on iOS has no BarcodeDetector.
 */
export default function QrScanner({
  onScan,
  onClose,
  title = "Etikett scannen",
}: {
  onScan: (text: string) => void;
  onClose: () => void;
  title?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let frame = 0;
    let stopped = false;
    let schleife = false; // Erkennung nur einmal starten, auch nach einem Kamera-Neustart
    let lastDecode = 0;

    async function erkennen() {
      const Detector = (window as any).BarcodeDetector;
      const detector = hasNativeDetector() ? new Detector({ formats: [...SCAN_FORMATS] }) : null;
      // Fetched only where the browser brings no detector of its own.
      const decode = detector ? null : await decoderReady();
      if (stopped) return;

      const tick = async () => {
        if (stopped || !videoRef.current) return;
        const v = videoRef.current;

        if (v.readyState === v.HAVE_ENOUGH_DATA) {
          try {
            if (detector) {
              const codes = await detector.detect(v);
              if (codes.length > 0 && codes[0].rawValue) {
                onScan(codes[0].rawValue);
                return;
              }
            } else if (decode) {
              // ZXing is slow on full frames, so decode only the part of the
              // picture inside the frame the user sees (a little larger), scaled
              // down, and only about 10 times per second.
              const now = performance.now();
              if (now - lastDecode >= DECODE_INTERVAL_MS) {
                lastDecode = now;
                const side = Math.min(v.videoWidth, v.videoHeight); // the preview is a centred square
                const sx = (v.videoWidth - side) / 2 + side * ROI.x;
                const sy = (v.videoHeight - side) / 2 + side * ROI.y;
                const sw = side * ROI.w;
                const sh = side * ROI.h;
                const scale = Math.min(1, MAX_DECODE_WIDTH / sw);
                const canvas = canvasRef.current!;
                canvas.width = Math.round(sw * scale);
                canvas.height = Math.round(sh * scale);
                const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
                ctx.drawImage(v, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
                const found = decode(ctx.getImageData(0, 0, canvas.width, canvas.height));
                if (found) {
                  onScan(found);
                  return;
                }
              }
            }
          } catch {
            // A single unreadable frame is normal; keep scanning.
          }
        }
        frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    }

    // Kamera ueber den Baustein "kamera": Rueckkamera, sauberes Ausschalten,
    // Neustart nach dem Hintergrund (Android).
    const sucher = kamera(() => videoRef.current, {
      aenderung: (zustand, fehler) => {
        if (zustand === "nein") {
          setError(
            fehler?.name === "NotAllowedError"
              ? "Kein Kamerazugriff. Bitte in den Browser-Einstellungen erlauben."
              : "Kamera konnte nicht gestartet werden."
          );
          return;
        }
        if (!schleife) {
          schleife = true;
          erkennen().catch(() => setError("Kamera konnte nicht gestartet werden."));
        }
      },
    });

    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      sucher.stop();
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex flex-col items-center justify-center p-4">
      <div className="bg-white rounded-lg overflow-hidden w-full max-w-md">
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-200">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-stone-700 text-xl" aria-label="Schließen">
            ×
          </button>
        </div>
        <div className="relative bg-black">
          <video ref={videoRef} playsInline muted className="w-full aspect-square object-cover" />
          <canvas ref={canvasRef} className="hidden" />
          {!error && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-4/5 h-1/3 border-2 border-white/80 rounded-lg" />
            </div>
          )}
        </div>
        <div className="p-4">
          {error ? (
            <p className="text-sm text-red-600">{error}</p>
          ) : (
            <p className="text-sm text-stone-500">
              QR-Code oder Strichcode in den Rahmen halten.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
