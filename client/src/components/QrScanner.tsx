import { useEffect, useRef, useState } from "react";
import { SCAN_FORMATS, decoderReady, hasNativeDetector } from "../lib/barcode";

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
    let stream: MediaStream | null = null;
    let frame = 0;
    let stopped = false;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        const video = videoRef.current;
        if (!video || stopped) return;
        video.srcObject = stream;
        await video.play();

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
                const canvas = canvasRef.current!;
                canvas.width = v.videoWidth;
                canvas.height = v.videoHeight;
                const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
                ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
                const found = decode(ctx.getImageData(0, 0, canvas.width, canvas.height));
                if (found) {
                  onScan(found);
                  return;
                }
              }
            } catch {
              // A single unreadable frame is normal; keep scanning.
            }
          }
          frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      } catch (err: any) {
        setError(
          err?.name === "NotAllowedError"
            ? "Kein Kamerazugriff. Bitte in den Browser-Einstellungen erlauben."
            : "Kamera konnte nicht gestartet werden."
        );
      }
    }

    start();
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
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
