import React, { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  X,
  Download,
  Copy,
  Check,
  QrCode as QrIcon,
  Share2,
  Loader2,
  Mail,
} from 'lucide-react';
import { RankedPlayerProfile } from '@/lib/rankedSync';

interface PlayerQrCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: RankedPlayerProfile;
  isDark: boolean;
}

export const PlayerQrCodeModal: React.FC<PlayerQrCodeModalProps> = ({
  isOpen,
  onClose,
  profile,
  isDark,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [shared, setShared] = useState<boolean>(false);
  const [renderedKey, setRenderedKey] = useState<string | null>(null);

  if (!isOpen && renderedKey !== null) {
    setRenderedKey(null);
  }

  const currentKey =
    isOpen && profile
      ? `${profile.id}_${profile.rating || 100}_${profile.qrData || ''}`
      : null;
  const isLoading = !currentKey || renderedKey !== currentKey;

  useEffect(() => {
    if (!isOpen || !profile || !currentKey) {
      return;
    }

    let isMounted = true;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const startTime = Date.now();

    // Construct clean, compact JSON payload
    const payload =
      profile.qrData ||
      JSON.stringify({
        app: 'billiard',
        type: 'player_profile',
        id: profile.id,
        tag: profile.tag || `${profile.username} #${profile.discriminator}`,
        username: profile.username || profile.name,
        discriminator: profile.discriminator || '1001',
        email: profile.email || '',
        rating: profile.rating || 100,
        createdAt: profile.createdAt || Date.now(),
      });

    // Generate high error correction (H) QR code allowing center logo
    QRCode.toCanvas(canvas, payload, {
      width: 320,
      margin: 2,
      errorCorrectionLevel: 'H',
      color: {
        dark: '#09090b',
        light: '#ffffff',
      },
    })
      .then(() => {
        if (!isMounted || !canvas) return;

        // Force responsive sizing override on canvas so it never overflows
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.maxWidth = '100%';
        canvas.style.maxHeight = '100%';
        canvas.style.display = 'block';

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        const radius = 32;

        // 1. Draw crisp white badge backing disk with subtle shadow
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 2;

        ctx.beginPath();
        ctx.arc(cx, cy, radius + 4, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        ctx.lineWidth = 3;
        ctx.strokeStyle = '#4f46e5'; // Indigo brand ring
        ctx.stroke();
        ctx.restore();

        // 2. Draw 3D Obsidian Billiard 8-Ball in center
        ctx.save();
        const ballGrad = ctx.createRadialGradient(
          cx - radius * 0.35,
          cy - radius * 0.35,
          radius * 0.1,
          cx,
          cy,
          radius
        );
        ballGrad.addColorStop(0, '#27272a');
        ballGrad.addColorStop(0.5, '#18181b');
        ballGrad.addColorStop(1, '#09090b');

        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fillStyle = ballGrad;
        ctx.fill();

        // Specular 3D highlight
        ctx.beginPath();
        ctx.arc(cx - radius * 0.3, cy - radius * 0.3, radius * 0.38, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
        ctx.fill();

        // Inner white circle for 8-ball numeral
        const innerRadius = radius * 0.48;
        ctx.beginPath();
        ctx.arc(cx, cy, innerRadius, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();

        // Numeral '8'
        ctx.fillStyle = '#09090b';
        ctx.font = '900 17px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('8', cx, cy + 1);

        ctx.restore();

        const finishLoading = () => {
          if (!isMounted) return;
          // Smart randomized duration between 2.5 and 3.0 seconds (2500ms - 3000ms)
          const targetDuration = Math.floor(Math.random() * (3000 - 2500 + 1)) + 2500;
          const elapsed = Date.now() - startTime;
          const delay = Math.max(0, targetDuration - elapsed);
          setTimeout(() => {
            if (isMounted) {
              setRenderedKey(currentKey);
            }
          }, delay);
        };

        // 3. Try overlaying app logo /icon-192.png if loaded
        const logoImg = new Image();
        logoImg.crossOrigin = 'anonymous';
        logoImg.onload = () => {
          if (!isMounted || !canvas) return;
          ctx.save();
          ctx.beginPath();
          ctx.arc(cx, cy, radius - 2, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(logoImg, cx - radius + 2, cy - radius + 2, (radius - 2) * 2, (radius - 2) * 2);
          ctx.restore();

          // Ensure canvas maintains responsive style attributes
          canvas.style.width = '100%';
          canvas.style.height = '100%';
          canvas.style.maxWidth = '100%';
          finishLoading();
        };
        logoImg.onerror = () => {
          // Fallback to our vector 8-ball is already drawn
          finishLoading();
        };
        logoImg.src = '/icon-192.png';
      })
      .catch((err) => {
        console.error('Error rendering QR code:', err);
        const targetDuration = Math.floor(Math.random() * (3000 - 2500 + 1)) + 2500;
        const elapsed = Date.now() - startTime;
        const delay = Math.max(0, targetDuration - elapsed);
        setTimeout(() => {
          if (isMounted) setRenderedKey(currentKey);
        }, delay);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, profile, currentKey]);

  if (!isOpen) return null;

  const playerTag = profile.tag || `${profile.username} #${profile.discriminator || '1001'}`;
  const playerColor = profile.color || '#6366F1';

  const handleCopyTag = async () => {
    try {
      await navigator.clipboard.writeText(playerTag);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy tag:', err);
    }
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `billiard-pass-${(profile.username || 'player').toLowerCase()}-${profile.discriminator || '1001'}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `Billiard Player Pass: ${playerTag}`,
          text: `Challenge ${playerTag} to a ranked match!`,
          url: window.location.href,
        });
        setShared(true);
        setTimeout(() => setShared(false), 2000);
        return;
      } catch {
        // User cancelled or unsupported
      }
    }
    handleCopyTag();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-zinc-950/80 backdrop-blur-sm animate-fadeIn"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-[340px] xs:max-w-[360px] max-h-[92vh] overflow-y-auto rounded-3xl border relative transition-all duration-200 shadow-2xl p-5 sm:p-6 space-y-4 ${
          isDark
            ? 'bg-zinc-900 border-zinc-800 text-zinc-100 shadow-black/80'
            : 'bg-white border-zinc-200 text-zinc-900 shadow-xl'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Soft Ambient Radial Glow from player color */}
        <div
          className="absolute -top-12 -right-12 w-44 h-44 rounded-full pointer-events-none blur-3xl opacity-20"
          style={{ backgroundColor: playerColor }}
        />

        {/* HEADER: Title & Close Button */}
        <div className="flex items-center justify-between pb-1">
          <div className="flex items-center gap-2">
            <div
              className={`p-1.5 rounded-xl ${
                isDark
                  ? 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30'
                  : 'bg-indigo-50 text-indigo-600 border border-indigo-200'
              }`}
            >
              <QrIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-tight leading-tight">
                Player QR Pass
              </h3>
              <p className={`text-[10px] font-semibold ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                Ranked Circuit Pass
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            aria-label="Close"
            className={`p-1.5 rounded-full transition-all active:scale-90 cursor-pointer ${
              isDark
                ? 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* PLAYER IDENTITY ROW */}
        <div
          className={`p-3 rounded-2xl border flex items-center gap-3 transition-colors ${
            isDark ? 'bg-zinc-950/60 border-zinc-800' : 'bg-zinc-50 border-zinc-200/80'
          }`}
        >
          {/* Avatar with initial & online dot */}
          <div className="relative flex-shrink-0">
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center text-white font-black text-base shadow-sm relative overflow-hidden ring-1 ring-white/20"
              style={{ backgroundColor: playerColor }}
            >
              <div className="absolute inset-0 bg-gradient-to-b from-white/25 via-transparent to-black/20 pointer-events-none" />
              <span className="relative drop-shadow-sm select-none">
                {profile.username
                  ? profile.username.charAt(0).toUpperCase()
                  : 'P'}
              </span>
            </div>
            <span
              className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 ${
                isDark ? 'border-zinc-900' : 'border-white'
              }`}
            />
          </div>

          {/* Player details */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className={`font-black text-sm leading-tight truncate ${
                  isDark ? 'text-white' : 'text-zinc-900'
                }`}
              >
                {profile.username}
              </span>
              <span
                className={`font-mono font-bold text-xs px-1.5 py-0.5 rounded-md border ${
                  isDark
                    ? 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30'
                    : 'bg-indigo-50 text-indigo-600 border-indigo-200'
                }`}
              >
                #{profile.discriminator || '1001'}
              </span>
            </div>

            {profile.email && (
              <div className="flex items-center gap-1.5 pt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                <Mail className="w-3 h-3 flex-shrink-0 text-zinc-400" />
                <span className="font-medium truncate max-w-[180px] xs:max-w-[200px]" title={profile.email}>
                  {profile.email}
                </span>
              </div>
            )}

            <div className="flex items-center gap-2 pt-0.5 text-[10px]">
              <span className="font-black text-amber-500">
                🏆 {profile.rating || 100} ELO
              </span>
              <span className={`font-semibold ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
                • {profile.wins || 0}W - {profile.losses || 0}L
              </span>
            </div>
          </div>
        </div>

        {/* RESPONSIVE QR CODE VIEWFINDER PAD */}
        <div className="space-y-2">
          <div className="w-full max-w-[240px] xs:max-w-[250px] aspect-square mx-auto p-3.5 bg-white rounded-2xl border border-zinc-200 shadow-sm relative flex items-center justify-center overflow-hidden">
            {/* Corner Viewfinder Reticle Brackets */}
            <div className="absolute top-2 left-2 w-3 h-3 border-t-2 border-l-2 border-indigo-600 rounded-tl pointer-events-none" />
            <div className="absolute top-2 right-2 w-3 h-3 border-t-2 border-r-2 border-indigo-600 rounded-tr pointer-events-none" />
            <div className="absolute bottom-2 left-2 w-3 h-3 border-b-2 border-l-2 border-indigo-600 rounded-bl pointer-events-none" />
            <div className="absolute bottom-2 right-2 w-3 h-3 border-b-2 border-r-2 border-indigo-600 rounded-br pointer-events-none" />

            {/* Dedicated Loading State Overlay */}
            {isLoading && (
              <div className="absolute inset-0 bg-white/95 backdrop-blur-xs flex flex-col items-center justify-center gap-2.5 z-10 animate-fadeIn">
                <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 text-indigo-600 flex items-center justify-center shadow-xs">
                  <Loader2 className="w-5 h-5 animate-spin" />
                </div>
                <div className="text-center space-y-0.5">
                  <p className="text-xs font-black text-zinc-900 tracking-tight">Fetching QR Pass...</p>
                  <p className="text-[10px] font-semibold text-zinc-500">Generating secure competitor pass</p>
                </div>
              </div>
            )}

            {/* QR Canvas strictly constrained to parent width and height */}
            <canvas
              ref={canvasRef}
              className={`w-full h-full object-contain block rounded-lg transition-opacity duration-300 ${
                isLoading ? 'opacity-0' : 'opacity-100'
              }`}
              style={{ width: '100%', height: '100%', maxWidth: '100%', maxHeight: '100%' }}
            />
          </div>

          {/* Optical Scanner Status Indicator */}
          <div className="text-center space-y-0.5">
            <div className="inline-flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              {isLoading ? (
                <>
                  <Loader2 className="w-2.5 h-2.5 animate-spin text-indigo-500" />
                  <span className="text-indigo-600 dark:text-indigo-400">Fetching QR Pass...</span>
                </>
              ) : (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span>Optical Scan Ready</span>
                </>
              )}
            </div>
            <p className={`text-[10px] font-medium ${isDark ? 'text-zinc-400' : 'text-zinc-500'}`}>
              {isLoading ? 'Encrypting digital competitor pass' : 'Scan with camera to connect'}
            </p>
          </div>
        </div>

        {/* ACTION BUTTONS (Copy Tag & Save Pass) */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          {/* Copy Tag Button */}
          <button
            onClick={handleCopyTag}
            type="button"
            className={`py-2.5 px-3 rounded-2xl font-black text-xs flex items-center justify-center gap-1.5 transition-all border active:scale-95 cursor-pointer ${
              copied
                ? 'bg-emerald-600 border-emerald-500 text-white shadow-emerald-600/30'
                : isDark
                ? 'bg-zinc-800 hover:bg-zinc-750 border-zinc-700 text-zinc-200 hover:text-white'
                : 'bg-zinc-100 hover:bg-zinc-200 border-zinc-200 text-zinc-800'
            }`}
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Tag</span>
              </>
            )}
          </button>

          {/* Save Image Button */}
          <button
            onClick={handleDownload}
            type="button"
            className={`py-2.5 px-3 rounded-2xl font-black text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 cursor-pointer shadow-sm ${
              isDark
                ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
                : 'bg-zinc-900 hover:bg-zinc-800 text-white shadow-zinc-900/20'
            }`}
          >
            <Download className="w-3.5 h-3.5" />
            <span>Save Pass</span>
          </button>
        </div>

        {/* Share Micro-Action */}
        <div className="text-center pt-0.5">
          <button
            type="button"
            onClick={handleShare}
            className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider transition-colors cursor-pointer ${
              isDark
                ? 'text-zinc-400 hover:text-indigo-400'
                : 'text-zinc-500 hover:text-indigo-600'
            }`}
          >
            {shared ? (
              <>
                <Check className="w-3 h-3 text-emerald-500" />
                <span className="text-emerald-500">Shared!</span>
              </>
            ) : (
              <>
                <Share2 className="w-3 h-3" />
                <span>Share with Opponent</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
