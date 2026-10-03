import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  X,
  Camera,
  Upload,
  AlertCircle,
  ScanLine,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import jsQR from 'jsqr';

export interface ScannedPlayerPayload {
  username?: string;
  discriminator?: string;
  tag?: string;
  id?: string;
  raw: string;
}

interface ScanPlayerQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlayerScanned: (player: ScannedPlayerPayload) => void;
  isDark?: boolean;
}

export const ScanPlayerQrModal: React.FC<ScanPlayerQrModalProps> = ({
  isOpen,
  onClose,
  onPlayerScanned,
  isDark = false,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const animationFrameId = useRef<number | null>(null);

  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState<boolean>(true);
  const [scannedResult, setScannedResult] = useState<ScannedPlayerPayload | null>(null);
  const [manualCode, setManualCode] = useState<string>('');

  // Stop camera tracks cleanly
  const stopCameraStream = useCallback(() => {
    if (animationFrameId.current) {
      cancelAnimationFrame(animationFrameId.current);
      animationFrameId.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
  }, []);

  // Parse QR content (JSON or text)
  const parseQrPayload = useCallback((raw: string): ScannedPlayerPayload => {
    const trimmed = raw.trim();
    try {
      const parsed = JSON.parse(trimmed);
      if (typeof parsed === 'object' && parsed !== null) {
        return {
          username: parsed.username || parsed.name || '',
          discriminator: parsed.discriminator || '',
          tag: parsed.tag || '',
          id: parsed.id || '',
          raw: trimmed,
        };
      }
    } catch {
      // Not JSON, parse text
    }

    // Check if format is "Username #XXXX"
    if (trimmed.includes('#')) {
      const parts = trimmed.split('#');
      return {
        username: parts[0]?.trim(),
        discriminator: parts[1]?.trim().replace(/[^0-9]/g, ''),
        tag: trimmed,
        raw: trimmed,
      };
    }

    return {
      username: trimmed,
      raw: trimmed,
    };
  }, []);

  const handleSuccessfulScan = useCallback(
    (payload: ScannedPlayerPayload) => {
      setIsScanning(false);
      setScannedResult(payload);
      stopCameraStream();

      // Haptic feedback if supported
      try {
        if (typeof window !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate?.(80);
        }
      } catch {
        // Ignore
      }

      // Small delay to show checkmark
      setTimeout(() => {
        onPlayerScanned(payload);
        onClose();
      }, 700);
    },
    [onClose, onPlayerScanned, stopCameraStream]
  );

  const scanFrameRef = useRef<() => void>(() => {});

  // Scan video frame using jsQR
  const scanFrame = useCallback(() => {
    if (!isScanning) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (ctx) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });

        if (code && code.data) {
          const parsed = parseQrPayload(code.data);
          handleSuccessfulScan(parsed);
          return;
        }
      }
    }

    animationFrameId.current = requestAnimationFrame(() => scanFrameRef.current());
  }, [handleSuccessfulScan, isScanning, parseQrPayload]);

  useEffect(() => {
    scanFrameRef.current = scanFrame;
  }, [scanFrame]);

  // Start camera stream on mount / retry
  const startCamera = useCallback(async () => {
    setCameraError(null);
    setHasCameraPermission(null);
    setIsScanning(true);
    setScannedResult(null);

    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraError('Camera access is not supported in this browser.');
      setHasCameraPermission(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 640 },
          height: { ideal: 640 },
        },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setHasCameraPermission(true);
        animationFrameId.current = requestAnimationFrame(() => scanFrameRef.current());
      }
    } catch (err: unknown) {
      console.warn('Camera stream error:', err);
      const message =
        err instanceof Error && err.name === 'NotAllowedError'
          ? 'Camera permission was denied. You can still upload a QR code image.'
          : 'Could not connect to camera. Please upload a photo of the QR code.';
      setCameraError(message);
      setHasCameraPermission(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) {
      stopCameraStream();
      return;
    }

    let isMounted = true;

    const initCamera = async () => {
      if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        if (isMounted) {
          setCameraError('Camera access is not supported in this browser.');
          setHasCameraPermission(false);
        }
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 640 },
            height: { ideal: 640 },
          },
        });

        if (!isMounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.setAttribute('playsinline', 'true');
          await videoRef.current.play();
          if (isMounted) {
            setHasCameraPermission(true);
            animationFrameId.current = requestAnimationFrame(() => scanFrameRef.current());
          }
        }
      } catch (err: unknown) {
        if (!isMounted) return;
        console.warn('Camera stream error:', err);
        const message =
          err instanceof Error && err.name === 'NotAllowedError'
            ? 'Camera permission was denied. You can still upload a QR code image.'
            : 'Could not connect to camera. Please upload a photo of the QR code.';
        setCameraError(message);
        setHasCameraPermission(false);
      }
    };

    void initCamera();

    return () => {
      isMounted = false;
      stopCameraStream();
    };
  }, [isOpen, stopCameraStream]);

  // Decode uploaded image file
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = canvasRef.current || document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const code = jsQR(imgData.data, imgData.width, imgData.height, {
          inversionAttempts: 'attemptBoth',
        });

        if (code && code.data) {
          const parsed = parseQrPayload(code.data);
          handleSuccessfulScan(parsed);
        } else {
          setCameraError('No valid QR code found in this image. Please try another photo.');
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
    // Reset file input
    e.target.value = '';
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualCode.trim()) return;
    const parsed = parseQrPayload(manualCode);
    handleSuccessfulScan(parsed);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className={`w-full max-w-sm rounded-3xl p-5 space-y-4 shadow-2xl border transition-all animate-scaleIn text-left relative overflow-hidden ${
          isDark
            ? 'bg-zinc-900 border-zinc-800 text-white shadow-black/90'
            : 'bg-white border-zinc-200 text-zinc-900 shadow-2xl'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-1 border-b border-zinc-200/60 dark:border-zinc-800/60">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-700 dark:text-zinc-200">
              <ScanLine className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black tracking-tight leading-tight">
                Scan Competitor Pass
              </h3>
              <p className="text-[10px] text-zinc-400 font-medium">
                Instant tournament player lookup
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
              isDark
                ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white'
                : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-500 hover:text-zinc-900'
            }`}
            aria-label="Close scanner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Viewfinder / Camera Window */}
        <div className="relative w-full aspect-square max-w-[260px] mx-auto rounded-2xl overflow-hidden bg-zinc-950 border border-zinc-800 flex items-center justify-center shadow-inner">
          {/* Hidden Canvas for Decoding */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Live Camera Video */}
          <video
            ref={videoRef}
            className={`w-full h-full object-cover transition-opacity duration-300 ${
              hasCameraPermission ? 'opacity-100' : 'opacity-0 absolute pointer-events-none'
            }`}
          />

          {/* Viewfinder Target Overlay */}
          {hasCameraPermission && isScanning && (
            <div className="absolute inset-0 pointer-events-none p-6">
              <div className="relative w-full h-full">
                {/* Corner brackets */}
                <div className="absolute top-0 left-0 w-6 h-6 border-t-2 border-l-2 border-white/90 rounded-tl-lg shadow-sm" />
                <div className="absolute top-0 right-0 w-6 h-6 border-t-2 border-r-2 border-white/90 rounded-tr-lg shadow-sm" />
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-2 border-l-2 border-white/90 rounded-bl-lg shadow-sm" />
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-2 border-r-2 border-white/90 rounded-br-lg shadow-sm" />

                {/* Animated Sweeping Laser Line with Radiant Glow Trail */}
                <div
                  className="absolute left-1 right-1 animate-qrLaser pointer-events-none"
                  style={{ willChange: 'top' }}
                >
                  {/* Soft Laser Glow Fan */}
                  <div className="absolute -top-3 left-0 right-0 h-6 bg-gradient-to-b from-rose-500/0 via-rose-500/25 to-rose-500/0 blur-[2px] pointer-events-none" />

                  {/* Intense Laser Core Line */}
                  <div className="relative h-[2px] w-full bg-gradient-to-r from-rose-500/20 via-rose-500 to-rose-500/20 rounded-full shadow-[0_0_12px_2.5px_rgba(244,63,94,0.95)]" />
                </div>
              </div>
            </div>
          )}

          {/* Success Overlay */}
          {scannedResult && (
            <div className="absolute inset-0 bg-zinc-950/90 flex flex-col items-center justify-center p-4 text-center space-y-2 animate-scaleIn">
              <CheckCircle2 className="w-12 h-12 text-emerald-400 animate-bounce" />
              <p className="text-xs font-black uppercase tracking-wider text-emerald-400">
                Player Found!
              </p>
              <p className="text-sm font-bold text-white truncate max-w-[200px]">
                {scannedResult.username || scannedResult.tag || 'Competitor'}
              </p>
              {scannedResult.discriminator && (
                <span className="font-mono text-xs text-zinc-400">
                  #{scannedResult.discriminator}
                </span>
              )}
            </div>
          )}

          {/* Fallback / Error State */}
          {!hasCameraPermission && !scannedResult && (
            <div className="p-4 text-center space-y-3">
              <Camera className="w-8 h-8 mx-auto text-zinc-500 animate-pulse" />
              <p className="text-xs text-zinc-400 font-medium leading-relaxed max-w-[200px] mx-auto">
                {cameraError || 'Initializing camera stream...'}
              </p>
              {cameraError && (
                <button
                  type="button"
                  onClick={startCamera}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs font-bold text-zinc-200 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Retry Camera</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Secondary Options: Photo Upload & Manual Search */}
        <div className="space-y-2.5 pt-1">
          {/* File Upload Button */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleImageUpload}
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={`w-full py-2.5 px-3 rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer ${
              isDark
                ? 'bg-zinc-850 hover:bg-zinc-800 border-zinc-750 text-zinc-200'
                : 'bg-zinc-50 hover:bg-zinc-100 border-zinc-200 text-zinc-700'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            <span>Upload or Photo of QR Code</span>
          </button>

          {/* Manual Tag or Code Input */}
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              type="text"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder="Or enter #code or name..."
              className={`flex-1 px-3 py-2 rounded-xl border text-xs font-medium outline-none transition-all ${
                isDark
                  ? 'bg-zinc-850 border-zinc-750 text-white placeholder-zinc-500 focus:border-zinc-500'
                  : 'bg-zinc-50 border-zinc-200 text-zinc-900 placeholder-zinc-400 focus:border-zinc-400'
              }`}
            />
            <button
              type="submit"
              disabled={!manualCode.trim()}
              className={`px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                isDark
                  ? 'bg-white hover:bg-zinc-100 text-zinc-900'
                  : 'bg-zinc-900 hover:bg-zinc-800 text-white'
              }`}
            >
              Search
            </button>
          </form>

          {cameraError && (
            <div className="flex items-center gap-1.5 text-[10px] text-amber-500 justify-center">
              <AlertCircle className="w-3 h-3 flex-shrink-0" />
              <span>You can upload a screenshot or type their code above</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
