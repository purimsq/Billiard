import React, { useState, useRef, useEffect, useCallback, useSyncExternalStore } from 'react';
import {
  X,
  ArrowRight,
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  Loader2,
  Mail,
  User,
  AlertCircle,
  Camera,
  QrCode,
  Trophy,
  ShieldCheck,
  Sparkles,
  CheckCircle2,
  WifiOff,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import QRCode from 'qrcode';
import {
  allocateUniqueDiscriminator,
  registerPlayerProfile,
  RankedPlayerProfile,
} from '@/lib/rankedSync';
import {
  subscribeNetworkHealth,
  getNetworkHealthSnapshot,
} from '@/lib/networkReachability';

interface OnlineIdentitySetupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: (profile: RankedPlayerProfile) => void;
  onOpenRestore?: () => void;
  isDark: boolean;
}

const STEP_TITLES = {
  1: 'Username Selection',
  2: 'Player Tag Confirmation',
  3: 'Security PIN',
  4: 'Verify PIN',
  5: 'Contact & Customization',
  6: 'Review & Activate',
};

export const OnlineIdentitySetupModal: React.FC<OnlineIdentitySetupModalProps> = ({
  isOpen,
  onClose,
  onComplete,
  onOpenRestore,
  isDark,
}) => {
  const network = useSyncExternalStore(
    subscribeNetworkHealth,
    getNetworkHealthSnapshot,
    getNetworkHealthSnapshot
  );

  // Step state (1 through 6)
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5 | 6>(1);

  // Form Fields
  const [username, setUsername] = useState<string>('');
  const [discriminator, setDiscriminator] = useState<string>('1001');
  const [isAllocatingNumber, setIsAllocatingNumber] = useState<boolean>(false);
  const [pin, setPin] = useState<string>('');
  const [showPin, setShowPin] = useState<boolean>(false);
  const [confirmPin, setConfirmPin] = useState<string>('');
  const [showConfirmPin, setShowConfirmPin] = useState<boolean>(false);
  const [email, setEmail] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('#6366F1');

  // Camera Access State (for tournament QR pass scanning)
  const [cameraStatus, setCameraStatus] = useState<'idle' | 'granted' | 'denied' | 'prompt'>('idle');
  const [isRequestingCamera, setIsRequestingCamera] = useState<boolean>(false);

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Post-Registration Onboarding / Confirmation State
  const [createdProfile, setCreatedProfile] = useState<RankedPlayerProfile | null>(null);
  const [hasUnderstood, setHasUnderstood] = useState<boolean>(false);
  const [confirmError, setConfirmError] = useState<boolean>(false);
  const [isQrLoading, setIsQrLoading] = useState<boolean>(true);
  const qrCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Debounced discriminator allocator for Step 1
  const allocationTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Check initial camera permission status on mount
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'camera' as PermissionName })
        .then((result) => {
          setCameraStatus(result.state as 'granted' | 'denied' | 'prompt');
          result.onchange = () => {
            setCameraStatus(result.state as 'granted' | 'denied' | 'prompt');
          };
        })
        .catch(() => {
          // Ignore
        });
    }
  }, []);

  // Generate QR Code preview on the post-creation confirmation screen
  useEffect(() => {
    if (!createdProfile || !qrCanvasRef.current) {
      setIsQrLoading(true);
      return;
    }
    setIsQrLoading(true);
    const canvas = qrCanvasRef.current;
    const payload =
      createdProfile.qrData ||
      JSON.stringify({
        app: 'billiard',
        type: 'player_profile',
        id: createdProfile.id,
        tag: createdProfile.tag || `${createdProfile.username} #${createdProfile.discriminator}`,
        username: createdProfile.username,
        discriminator: createdProfile.discriminator,
        email: createdProfile.email || '',
        rating: createdProfile.rating || 100,
        createdAt: createdProfile.createdAt || Date.now(),
      });

    QRCode.toCanvas(canvas, payload, {
      width: 280,
      margin: 2,
      errorCorrectionLevel: 'H',
      color: {
        dark: '#09090b',
        light: '#ffffff',
      },
    })
      .then(() => {
        if (!canvas) return;
        canvas.style.width = '100%';
        canvas.style.height = '100%';
        canvas.style.maxWidth = '130px';
        canvas.style.maxHeight = '130px';
        canvas.style.display = 'block';

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const cx = canvas.width / 2;
        const cy = canvas.height / 2;
        const radius = 26;

        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, radius + 3, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = createdProfile.color || '#6366f1';
        ctx.stroke();
        ctx.restore();

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

        // Specular highlight
        ctx.beginPath();
        ctx.arc(cx - radius * 0.3, cy - radius * 0.3, radius * 0.25, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.fill();

        // Number 8
        ctx.font = `900 ${radius * 0.9}px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('8', cx, cy + 1);
        ctx.restore();

        setIsQrLoading(false);
      })
      .catch((err) => {
        console.warn('Failed to draw QR preview on confirmation screen:', err);
        setIsQrLoading(false);
      });
  }, [createdProfile]);

  const requestCameraAccess = useCallback(async (): Promise<boolean> => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setCameraStatus('denied');
      return false;
    }
    setIsRequestingCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      stream.getTracks().forEach((track) => track.stop());
      setCameraStatus('granted');
      return true;
    } catch (err: unknown) {
      console.warn('Camera permission denied or dismissed:', err);
      setCameraStatus('denied');
      return false;
    } finally {
      setIsRequestingCamera(false);
    }
  }, []);

  const handleModalClose = () => {
    setStep(1);
    setUsername('');
    setDiscriminator('1001');
    setPin('');
    setConfirmPin('');
    setEmail('');
    setShowPin(false);
    setShowConfirmPin(false);
    setIsSubmitting(false);
    setErrorMessage(null);
    setCreatedProfile(null);
    setHasUnderstood(false);
    setConfirmError(false);
    onClose();
  };

  const handleDismiss = () => {
    if (createdProfile) {
      onComplete(createdProfile);
    }
    handleModalClose();
  };

  const handleFinishSetup = () => {
    if (!createdProfile) return;
    if (!hasUnderstood) {
      setConfirmError(true);
      return;
    }
    onComplete(createdProfile);
    handleModalClose();
  };

  // When username changes, allocate a unique short number
  const handleUsernameChange = (val: string) => {
    // Only allow letters, numbers, spaces, underscores, hyphens
    const sanitized = val.replace(/[^a-zA-Z0-9_\-\s]/g, '').slice(0, 20);
    setUsername(sanitized);
    setErrorMessage(null);

    if (allocationTimerRef.current) {
      clearTimeout(allocationTimerRef.current);
    }

    if (sanitized.trim().length >= 2) {
      setIsAllocatingNumber(true);
      allocationTimerRef.current = setTimeout(async () => {
        try {
          const num = await allocateUniqueDiscriminator(sanitized);
          setDiscriminator(num);
        } catch (err) {
          console.error('Failed to allocate discriminator:', err);
        } finally {
          setIsAllocatingNumber(false);
        }
      }, 350);
    }
  };

  if (!isOpen) return null;

  // RFC 5322 compatible email format validator requiring valid domain and minimum 2-letter TLD
  const isValidEmailFormat = (val: string): boolean => {
    const clean = val.trim();
    if (!clean || clean.length > 254) return false;
    const emailRegex =
      /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z]{2,})+$/;
    return emailRegex.test(clean);
  };

  // Validation checks per step
  const isStep1Valid = username.trim().length >= 2 && !isAllocatingNumber;
  const isStep3Valid = /^\d{4}$/.test(pin);
  const isStep4Valid = /^\d{4}$/.test(confirmPin) && confirmPin === pin;
  const isEmailValid = isValidEmailFormat(email);
  const isStep5Valid = isEmailValid;

  // Step 6 Submit handler
  const handleFinalSubmit = async () => {
    if (!isEmailValid) {
      setErrorMessage('Please enter a valid email address (e.g. name@domain.com).');
      return;
    }

    // Prompt for camera access if not yet granted so user is ready for tournament QR scanning
    if (cameraStatus !== 'granted') {
      try {
        await requestCameraAccess();
      } catch (e) {
        // Non-blocking: continue even if camera access is dismissed or denied
        console.warn('Camera permission request bypassed or denied:', e);
      }
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const profile = await registerPlayerProfile({
        username: username.trim(),
        discriminator,
        pin: pin.trim(),
        email: email.trim().toLowerCase(),
        color: selectedColor,
      });

      // Celebrate success
      try {
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.5 },
          colors: ['#6366f1', '#10b981', '#f59e0b', '#3b82f6'],
        });
      } catch {
        // Confetti ignore error
      }

      // Transition to Onboarding Confirmation Briefing
      setCreatedProfile(profile);
      setHasUnderstood(false);
      setConfirmError(false);
    } catch (err: unknown) {
      console.error('Failed to save profile to database:', err);
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'Could not connect to database. Please check your internet connection.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const formattedTag = `${username.trim()} #${discriminator}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-sm animate-fadeIn">
      {/* Modal Card - Google Style with Sticky Header, Scrollable Body, and Sticky Footer */}
      <div
        className={`w-full max-w-md sm:max-w-lg max-h-[92vh] sm:max-h-[88vh] flex flex-col rounded-[24px] sm:rounded-[28px] border shadow-2xl overflow-hidden transition-all ${
          isDark
            ? 'bg-zinc-900 border-zinc-800 text-zinc-100 shadow-black/60'
            : 'bg-white border-zinc-200/90 text-zinc-900 shadow-2xl'
        }`}
      >
        {/* ================= GOOGLE-STYLE MODAL HEADER ================= */}
        <div
          className={`px-5 sm:px-7 pt-5 pb-3 border-b flex-shrink-0 ${
            isDark ? 'border-zinc-800 bg-zinc-900/90' : 'border-zinc-100 bg-white'
          }`}
        >
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              {/* Google-like Circular Brand Badge */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-white font-black text-xs shadow-md ${
                  createdProfile
                    ? 'bg-gradient-to-tr from-emerald-600 to-teal-500 shadow-emerald-600/30'
                    : 'bg-emerald-600 shadow-emerald-600/30'
                } flex-shrink-0`}
              >
                {createdProfile ? <Sparkles className="w-4 h-4 text-white" /> : '8'}
              </div>
              <div>
                <h3
                  className={`text-sm sm:text-base font-black tracking-tight leading-tight ${
                    isDark ? 'text-white' : 'text-zinc-900'
                  }`}
                >
                  {createdProfile ? 'Welcome to the Arena!' : 'Billiard Identity'}
                </h3>
                <p
                  className={`text-[11px] font-semibold ${
                    createdProfile
                      ? 'text-emerald-500'
                      : isDark
                      ? 'text-zinc-400'
                      : 'text-zinc-500'
                  }`}
                >
                  {createdProfile
                    ? 'Account Created Successfully • Player Briefing'
                    : `Step ${step} of 6 • ${STEP_TITLES[step]}`}
                </p>
              </div>
            </div>

            <button
              onClick={handleDismiss}
              disabled={isSubmitting}
              aria-label="Close"
              className={`p-2 rounded-full transition-all active:scale-90 ${
                isDark
                  ? 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                  : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Stepper Track OR Completion Confirmation Bar */}
          {createdProfile ? (
            <div className="mt-3 py-1.5 px-3 rounded-full bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-center gap-2 text-emerald-500 font-extrabold text-[11px]">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Official Competitor Pass Generated • Base 100 ELO Assigned</span>
            </div>
          ) : (
            <div className="mt-4 px-1 select-none">
              <div className="relative flex items-center justify-between">
                {/* Connector Track spanning from circle 1 center to circle 6 center */}
                <div className="absolute left-3.5 sm:left-4 right-3.5 sm:right-4 top-1/2 -translate-y-1/2 h-1.5 overflow-hidden pointer-events-none rounded-full">
                  {/* Background Track Line */}
                  <div className={`w-full h-full rounded-full ${isDark ? 'bg-zinc-800' : 'bg-zinc-200'}`} />
                  {/* Active Green Fill Line - Smooth & moderate fluid animation */}
                  <div
                    className="absolute top-0 left-0 h-full bg-emerald-500 rounded-full transition-all duration-700 ease-in-out"
                    style={{ width: `${((step - 1) / 5) * 100}%` }}
                  />
                </div>

                {/* 6 Step Circles with Step Number Inside */}
                {[1, 2, 3, 4, 5, 6].map((s) => {
                  const isCompleted = s < step;
                  const isCurrent = s === step;

                  return (
                    <div
                      key={s}
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center font-mono font-black text-xs relative z-10 transition-all duration-500 ease-in-out ${
                        isCurrent
                          ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30 ring-4 ring-emerald-500/25 scale-110'
                          : isCompleted
                          ? 'bg-emerald-600 text-white shadow-sm'
                          : isDark
                          ? 'bg-zinc-800 text-zinc-400 border border-zinc-700'
                          : 'bg-zinc-100 text-zinc-500 border border-zinc-300'
                      }`}
                    >
                      {s}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ================= SCROLLABLE CONTENT BODY ================= */}
        <div className="flex-1 overflow-y-auto px-5 sm:px-7 py-5 space-y-5 overscroll-contain">
          {/* Error Message */}
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-600 dark:text-rose-400 text-xs font-bold flex items-center gap-2 animate-fadeIn">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* ================= POST-REGISTRATION ONBOARDING BRIEFING ================= */}
          {createdProfile ? (
            <div className="space-y-4 animate-fadeIn">
              {/* Congratulations Hero Banner */}
              <div
                className={`p-4 rounded-2xl border text-center space-y-2 relative overflow-hidden ${
                  isDark
                    ? 'bg-gradient-to-b from-emerald-950/30 to-zinc-900 border-emerald-800/40'
                    : 'bg-gradient-to-b from-emerald-50 to-white border-emerald-200'
                }`}
              >
                <div className="flex items-center justify-center gap-2">
                  <span className="text-xl">🎉</span>
                  <h4
                    className={`text-base sm:text-lg font-black tracking-tight ${
                      isDark ? 'text-white' : 'text-zinc-900'
                    }`}
                  >
                    You are in the Tournament!
                  </h4>
                  <span className="text-xl">🏆</span>
                </div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-xs font-black">
                  <span>{createdProfile.tag || `${createdProfile.username} #${createdProfile.discriminator}`}</span>
                  <span>•</span>
                  <span>100 ELO Starting Rating</span>
                </div>
                <p
                  className={`text-xs font-medium leading-relaxed ${
                    isDark ? 'text-zinc-400' : 'text-zinc-600'
                  }`}
                >
                  Your profile is officially registered in the cloud database. Please review how your personal QR code and matches work before entering the arena.
                </p>
              </div>

              {/* CARD 1: Personal Competitor QR Pass & Why It Was Generated */}
              <div
                className={`p-4 rounded-2xl border space-y-3 ${
                  isDark ? 'bg-zinc-800/50 border-zinc-700/80' : 'bg-white border-zinc-200 shadow-sm'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center flex-shrink-0">
                    <QrCode className="w-4 h-4" />
                  </div>
                  <div>
                    <h5
                      className={`text-xs font-black uppercase tracking-wider ${
                        isDark ? 'text-zinc-200' : 'text-zinc-800'
                      }`}
                    >
                      Your Personal QR Pass
                    </h5>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-semibold">
                      Instant match pairing &amp; competitor identity
                    </p>
                  </div>
                </div>

                {/* QR Canvas Display */}
                <div className="flex flex-col sm:flex-row items-center gap-4 p-3 rounded-xl bg-zinc-100 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800">
                  <div className="w-28 h-28 sm:w-32 sm:h-32 bg-white rounded-xl p-1.5 shadow-md flex items-center justify-center flex-shrink-0 relative overflow-hidden">
                    {isQrLoading && (
                      <div className="absolute inset-0 bg-white/95 backdrop-blur-xs flex flex-col items-center justify-center gap-1.5 z-10 animate-fadeIn">
                        <Loader2 className="w-4 h-4 animate-spin text-indigo-600" />
                        <span className="text-[10px] font-bold text-zinc-600">Loading QR...</span>
                      </div>
                    )}
                    <canvas
                      ref={qrCanvasRef}
                      className={`w-full h-full rounded-lg transition-opacity duration-300 ${
                        isQrLoading ? 'opacity-0' : 'opacity-100'
                      }`}
                    />
                  </div>
                  <div className="space-y-1.5 text-left text-xs">
                    <p
                      className={`font-bold leading-tight ${
                        isDark ? 'text-zinc-200' : 'text-zinc-800'
                      }`}
                    >
                      Why was this generated?
                    </p>
                    <p
                      className={`text-[11px] leading-relaxed ${
                        isDark ? 'text-zinc-400' : 'text-zinc-600'
                      }`}
                    >
                      This QR code is your verified player pass. Opponents or tournament referees simply scan it with their camera at pool tables to instantly link you into official <strong>Ranked Matches</strong>—no typing usernames or IDs.
                    </p>
                    <p className="text-[10px] font-semibold text-indigo-500 dark:text-indigo-400 flex items-center gap-1">
                      <span>💡 Re-open anytime from your Profile or the QR icon on top.</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* CARD 2: How Ranked Mode Works (100 ELO & Smart Engine) */}
              <div
                className={`p-4 rounded-2xl border space-y-3 ${
                  isDark ? 'bg-zinc-800/50 border-zinc-700/80' : 'bg-white border-zinc-200 shadow-sm'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center flex-shrink-0">
                    <Trophy className="w-4 h-4" />
                  </div>
                  <div>
                    <h5
                      className={`text-xs font-black uppercase tracking-wider ${
                        isDark ? 'text-zinc-200' : 'text-zinc-800'
                      }`}
                    >
                      How Ranked Mode Works (100 ELO)
                    </h5>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-semibold">
                      Official competitive tournament matches
                    </p>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-start gap-2">
                    <span className="text-amber-500 font-bold mt-0.5">•</span>
                    <p className={isDark ? 'text-zinc-300' : 'text-zinc-700'}>
                      <strong>100 ELO Starting Rating:</strong> You start on the Tournament Standings table at <strong>100 ELO</strong> alongside all contenders.
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-amber-500 font-bold mt-0.5">•</span>
                    <p className={isDark ? 'text-zinc-300' : 'text-zinc-700'}>
                      <strong>Smart ELO Engine:</strong> Wins increase your rating, but our smart system also evaluates your <strong>Points-Per-Game efficiency</strong>, <strong>high breaks</strong>, and <strong>foul discipline</strong> (clean games earn bonus rating; high fouls deduct points).
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-amber-500 font-bold mt-0.5">•</span>
                    <p className={isDark ? 'text-zinc-300' : 'text-zinc-700'}>
                      <strong>Live Cloud Ledger:</strong> Every shot, foul, and victory is permanently recorded in the cloud and instantly updates the live tournament table.
                    </p>
                  </div>
                </div>
              </div>

              {/* CARD 3: How Casual Mode Works */}
              <div
                className={`p-4 rounded-2xl border space-y-3 ${
                  isDark ? 'bg-zinc-800/50 border-zinc-700/80' : 'bg-white border-zinc-200 shadow-sm'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center flex-shrink-0">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <h5
                      className={`text-xs font-black uppercase tracking-wider ${
                        isDark ? 'text-zinc-200' : 'text-zinc-800'
                      }`}
                    >
                      How Casual Mode Works
                    </h5>
                    <p className="text-[10px] text-zinc-500 dark:text-zinc-400 font-semibold">
                      Relaxed local play &amp; practice
                    </p>
                  </div>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex items-start gap-2">
                    <span className="text-blue-500 font-bold mt-0.5">•</span>
                    <p className={isDark ? 'text-zinc-300' : 'text-zinc-700'}>
                      <strong>Zero ELO Risk:</strong> Casual games are for friendly rounds or drills. They <strong>never affect</strong> your official tournament ELO or ranking.
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-blue-500 font-bold mt-0.5">•</span>
                    <p className={isDark ? 'text-zinc-300' : 'text-zinc-700'}>
                      <strong>Personal Stat Records:</strong> You can still link your profile in casual matches to track personal high breaks, shots, and practice history.
                    </p>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-blue-500 font-bold mt-0.5">•</span>
                    <p className={isDark ? 'text-zinc-300' : 'text-zinc-700'}>
                      <strong>Local Device Memory:</strong> Casual history stays privately on this device with customizable retention (10 to 50 games in Settings).
                    </p>
                  </div>
                </div>
              </div>

              {/* CARD 4: Mandatory Understanding Confirmation */}
              <div
                onClick={() => {
                  setHasUnderstood((prev) => !prev);
                  setConfirmError(false);
                }}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer select-none ${
                  hasUnderstood
                    ? isDark
                      ? 'bg-emerald-950/30 border-emerald-500 shadow-md shadow-emerald-500/10'
                      : 'bg-emerald-50/90 border-emerald-500 shadow-sm'
                    : confirmError
                    ? isDark
                      ? 'bg-rose-950/20 border-rose-500'
                      : 'bg-rose-50 border-rose-500'
                    : isDark
                    ? 'bg-zinc-800/40 border-zinc-700 hover:border-zinc-500'
                    : 'bg-zinc-50 border-zinc-300 hover:border-zinc-400'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${
                      hasUnderstood
                        ? 'bg-emerald-500 text-white shadow-sm'
                        : confirmError
                        ? 'border-2 border-rose-500 bg-rose-500/10'
                        : isDark
                        ? 'border-2 border-zinc-600 bg-zinc-800'
                        : 'border-2 border-zinc-400 bg-white'
                    }`}
                  >
                    {hasUnderstood && <Check className="w-4 h-4 stroke-[3]" />}
                  </div>
                  <div className="space-y-1">
                    <p
                      className={`text-xs font-black tracking-tight ${
                        hasUnderstood
                          ? 'text-emerald-600 dark:text-emerald-400'
                          : confirmError
                          ? 'text-rose-600 dark:text-rose-400'
                          : isDark
                          ? 'text-zinc-200'
                          : 'text-zinc-900'
                      }`}
                    >
                      I have read and understand how Ranked &amp; Casual work
                    </p>
                    <p
                      className={`text-[11px] leading-relaxed font-medium ${
                        isDark ? 'text-zinc-400' : 'text-zinc-600'
                      }`}
                    >
                      I confirm that my 100 ELO rating updates only through verified Ranked Matches using my QR Pass, and Casual games are for local practice.
                    </p>
                  </div>
                </div>
                {confirmError && !hasUnderstood && (
                  <p className="mt-2 text-[11px] font-bold text-rose-500 text-center animate-fadeIn">
                    ⚠️ Please tap the box above to confirm you understand before continuing.
                  </p>
                )}
              </div>
            </div>
          ) : (
            <>
              {/* ================= STEP 1: UNIQUE USERNAME ================= */}
              {step === 1 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="space-y-1">
                <h4
                  className={`text-lg sm:text-xl font-black tracking-tight ${
                    isDark ? 'text-white' : 'text-zinc-900'
                  }`}
                >
                  Create your ranked username
                </h4>
                <p
                  className={`text-xs font-medium leading-relaxed ${
                    isDark ? 'text-zinc-400' : 'text-zinc-600'
                  }`}
                >
                  Choose a handle for competitive play. We will reserve a unique 4-digit short
                  number for you.
                </p>
              </div>

              {/* Username Input Field */}
              <div className="space-y-1.5">
                <label
                  className={`text-[11px] font-black uppercase tracking-wider block ${
                    isDark ? 'text-zinc-400' : 'text-zinc-600'
                  }`}
                >
                  Username
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    autoFocus
                    value={username}
                    onChange={(e) => handleUsernameChange(e.target.value)}
                    placeholder="e.g. Dave"
                    className={`w-full pl-10 pr-4 py-3 rounded-2xl border font-bold text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition ${
                      isDark
                        ? 'bg-zinc-800/80 border-zinc-700 text-white placeholder:text-zinc-500 focus:bg-zinc-800 focus:border-indigo-500'
                        : 'bg-zinc-50 border-zinc-300 text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:border-indigo-600'
                    }`}
                  />
                </div>
              </div>

              {/* Dynamic Tag Allocation Banner */}
              <div
                className={`p-4 rounded-2xl border transition-all ${
                  username.trim().length >= 2
                    ? isDark
                      ? 'bg-emerald-950/25 border-emerald-800/60'
                      : 'bg-emerald-50/80 border-emerald-200'
                    : isDark
                    ? 'bg-zinc-950/40 border-zinc-800 text-zinc-500'
                    : 'bg-zinc-50 border-zinc-200 text-zinc-500'
                }`}
              >
                <div className="flex items-center justify-between text-xs">
                  <span
                    className={`font-extrabold uppercase tracking-wider text-[10px] ${
                      isDark ? 'text-emerald-400' : 'text-emerald-700'
                    }`}
                  >
                    Reserved Tag Preview
                  </span>
                  {isAllocatingNumber ? (
                    <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Verifying...
                    </span>
                  ) : username.trim().length >= 2 ? (
                    <span className="text-[10px] font-black text-emerald-600 flex items-center gap-1">
                      <Check className="w-3 h-3" /> Unique Available
                    </span>
                  ) : null}
                </div>

                <div className="mt-2">
                  {username.trim().length >= 2 ? (
                    <div className="font-mono font-black text-lg sm:text-xl flex items-center gap-1.5 flex-wrap">
                      <span className={isDark ? 'text-white' : 'text-zinc-900'}>
                        {username.trim()}
                      </span>
                      <span className={isDark ? 'text-emerald-400' : 'text-emerald-600'}>
                        #{discriminator}
                      </span>
                    </div>
                  ) : (
                    <span
                      className={`text-xs font-medium italic ${
                        isDark ? 'text-zinc-500' : 'text-zinc-400'
                      }`}
                    >
                      Enter at least 2 characters to allocate your unique short number.
                    </span>
                  )}
                </div>
              </div>

              {/* Option to Restore / Sign In */}
              {onOpenRestore && (
                <div className="pt-2 text-center border-t border-zinc-200/60 dark:border-zinc-800/60">
                  <button
                    type="button"
                    onClick={() => {
                      if (network.hasInternet) {
                        onClose();
                        onOpenRestore();
                      }
                    }}
                    disabled={!network.hasInternet}
                    className={`text-xs font-bold transition flex items-center justify-center gap-1.5 mx-auto ${
                      !network.hasInternet
                        ? 'text-zinc-400 dark:text-zinc-600 cursor-not-allowed opacity-60'
                        : isDark
                        ? 'text-indigo-400 hover:text-indigo-300 hover:underline underline-offset-4 cursor-pointer'
                        : 'text-indigo-600 hover:text-indigo-700 hover:underline underline-offset-4 cursor-pointer'
                    }`}
                  >
                    {!network.hasInternet ? (
                      <>
                        <WifiOff className="w-3.5 h-3.5 text-zinc-500" />
                        <span>Restore Profile (Internet Required)</span>
                      </>
                    ) : (
                      <span>Already registered? Restore existing profile →</span>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ================= STEP 2: USERNAME & SHORT NUMBER KEEP IN MIND ================= */}
          {step === 2 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="space-y-1">
                <h4
                  className={`text-lg sm:text-xl font-black tracking-tight ${
                    isDark ? 'text-white' : 'text-zinc-900'
                  }`}
                >
                  Keep your player tag in mind
                </h4>
                <p
                  className={`text-xs font-medium leading-relaxed ${
                    isDark ? 'text-zinc-400' : 'text-zinc-600'
                  }`}
                >
                  This tag is your permanent identity in Billiard Ranked play.
                </p>
              </div>

              {/* High-Contrast Google ID Card */}
              <div
                className={`p-6 rounded-2xl border text-center space-y-4 transition-all shadow-sm ${
                  isDark
                    ? 'bg-zinc-950/70 border-zinc-800'
                    : 'bg-zinc-50/90 border-zinc-200'
                }`}
              >
                {/* Center Avatar Badge */}
                <div
                  className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center text-white font-black text-2xl shadow-md"
                  style={{ backgroundColor: selectedColor }}
                >
                  {username ? username.charAt(0).toUpperCase() : 'P'}
                </div>

                {/* Tag Display - GUARANTEED HIGH CONTRAST (NEVER WHITE ON LIGHT) */}
                <div>
                  <div className="font-mono font-black text-2xl sm:text-3xl tracking-tight">
                    <span className={isDark ? 'text-white' : 'text-zinc-900'}>
                      {username.trim()}{' '}
                    </span>
                    <span className={isDark ? 'text-emerald-400' : 'text-emerald-600'}>
                      #{discriminator}
                    </span>
                  </div>
                  <p
                    className={`text-[10px] font-black uppercase tracking-wider mt-1 ${
                      isDark ? 'text-emerald-400' : 'text-emerald-600'
                    }`}
                  >
                    Official Competitor Identifier
                  </p>
                </div>

                {/* Friendly Reassurance Box */}
                <div
                  className={`p-3.5 rounded-xl text-xs font-medium leading-relaxed border text-left ${
                    isDark
                      ? 'bg-zinc-900 border-zinc-800 text-zinc-300'
                      : 'bg-white border-zinc-200 text-zinc-700'
                  }`}
                >
                  <p>
                    Keep this tag in mind when inviting opponents or searching leaderboards! Don&apos;t
                    worry too much though — your tag and personal QR code are always saved in your
                    Settings page for quick access anytime.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ================= STEP 3: SET 4-DIGIT PIN ================= */}
          {step === 3 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="space-y-1">
                <h4
                  className={`text-lg sm:text-xl font-black tracking-tight ${
                    isDark ? 'text-white' : 'text-zinc-900'
                  }`}
                >
                  Set your 4-digit security PIN
                </h4>
                <p
                  className={`text-xs font-medium leading-relaxed ${
                    isDark ? 'text-zinc-400' : 'text-zinc-600'
                  }`}
                >
                  Used to confirm your match results and protect your player rating during offline play.
                </p>
              </div>

              {/* Segmented PIN Display */}
              <div className="space-y-3">
                <div className="flex justify-center gap-2.5 sm:gap-3 py-2">
                  {[0, 1, 2, 3].map((idx) => {
                    const digit = pin[idx] || '';
                    const isFilled = digit.length > 0;
                    return (
                      <div
                        key={idx}
                        className={`w-12 h-14 sm:w-14 sm:h-16 rounded-2xl border-2 flex items-center justify-center font-mono font-black text-2xl transition-all ${
                          isFilled
                            ? 'border-indigo-600 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                            : isDark
                            ? 'border-zinc-700 bg-zinc-800 text-zinc-400'
                            : 'border-zinc-300 bg-zinc-50 text-zinc-700'
                        }`}
                      >
                        {isFilled ? (showPin ? digit : '•') : ''}
                      </div>
                    );
                  })}
                </div>

                {/* Real Input with Show/Hide Toggle */}
                <div className="relative max-w-xs mx-auto">
                  <input
                    type={showPin ? 'text' : 'password'}
                    autoFocus
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    value={pin}
                    onChange={(e) => {
                      const clean = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
                      setPin(clean);
                    }}
                    placeholder="Enter 4 digits"
                    className={`w-full px-4 py-2.5 rounded-xl border text-center font-mono font-bold text-sm tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition ${
                      isDark
                        ? 'bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600'
                        : 'bg-zinc-100 border-zinc-300 text-zinc-900 placeholder:text-zinc-400'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className={`absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition ${
                      isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-500 hover:text-zinc-900'
                    }`}
                    title={showPin ? 'Hide PIN' : 'Show PIN'}
                  >
                    {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <p
                  className={`text-center text-[11px] font-medium ${
                    isDark ? 'text-zinc-400' : 'text-zinc-500'
                  }`}
                >
                  PIN must be exactly 4 numeric digits.
                </p>
              </div>
            </div>
          )}

          {/* ================= STEP 4: CONFIRM 4-DIGIT PIN ================= */}
          {step === 4 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="space-y-1">
                <h4
                  className={`text-lg sm:text-xl font-black tracking-tight ${
                    isDark ? 'text-white' : 'text-zinc-900'
                  }`}
                >
                  Confirm your 4-digit PIN
                </h4>
                <p
                  className={`text-xs font-medium leading-relaxed ${
                    isDark ? 'text-zinc-400' : 'text-zinc-600'
                  }`}
                >
                  Re-enter your 4-digit PIN to ensure it was entered correctly.
                </p>
              </div>

              {/* Segmented PIN Display */}
              <div className="space-y-3">
                <div className="flex justify-center gap-2.5 sm:gap-3 py-2">
                  {[0, 1, 2, 3].map((idx) => {
                    const digit = confirmPin[idx] || '';
                    const isFilled = digit.length > 0;
                    const isMatch = confirmPin.length === 4 && confirmPin === pin;
                    const isMismatch = confirmPin.length === 4 && confirmPin !== pin;

                    return (
                      <div
                        key={idx}
                        className={`w-12 h-14 sm:w-14 sm:h-16 rounded-2xl border-2 flex items-center justify-center font-mono font-black text-2xl transition-all ${
                          isMatch
                            ? 'border-emerald-500 bg-emerald-500/10 text-emerald-500'
                            : isMismatch
                            ? 'border-rose-500 bg-rose-500/10 text-rose-500'
                            : isFilled
                            ? 'border-indigo-600 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400'
                            : isDark
                            ? 'border-zinc-700 bg-zinc-800 text-zinc-400'
                            : 'border-zinc-300 bg-zinc-50 text-zinc-700'
                        }`}
                      >
                        {isFilled ? (showConfirmPin ? digit : '•') : ''}
                      </div>
                    );
                  })}
                </div>

                {/* Real Input with Show/Hide Toggle */}
                <div className="relative max-w-xs mx-auto">
                  <input
                    type={showConfirmPin ? 'text' : 'password'}
                    autoFocus
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    value={confirmPin}
                    onChange={(e) => {
                      const clean = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
                      setConfirmPin(clean);
                    }}
                    placeholder="Confirm 4 digits"
                    className={`w-full px-4 py-2.5 rounded-xl border text-center font-mono font-bold text-sm tracking-widest focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition ${
                      isDark
                        ? 'bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600'
                        : 'bg-zinc-100 border-zinc-300 text-zinc-900 placeholder:text-zinc-400'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPin(!showConfirmPin)}
                    className={`absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition ${
                      isDark ? 'text-zinc-400 hover:text-white' : 'text-zinc-500 hover:text-zinc-900'
                    }`}
                    title={showConfirmPin ? 'Hide PIN' : 'Show PIN'}
                  >
                    {showConfirmPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {/* Match Status Feedback */}
                {confirmPin.length === 4 && (
                  <div className="flex justify-center">
                    {confirmPin === pin ? (
                      <span className="text-xs font-black text-emerald-600 flex items-center gap-1.5 animate-fadeIn">
                        <Check className="w-4 h-4 stroke-[3]" /> PINs match perfectly!
                      </span>
                    ) : (
                      <span className="text-xs font-black text-rose-500 flex items-center gap-1.5 animate-fadeIn">
                        <AlertCircle className="w-4 h-4" /> PIN does not match. Please re-enter.
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= STEP 5: EMAIL ADDRESS & CUSTOMIZATION ================= */}
          {step === 5 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="space-y-1">
                <h4
                  className={`text-lg sm:text-xl font-black tracking-tight ${
                    isDark ? 'text-white' : 'text-zinc-900'
                  }`}
                >
                  Notification email & avatar color
                </h4>
                <p
                  className={`text-xs font-medium leading-relaxed ${
                    isDark ? 'text-zinc-400' : 'text-zinc-600'
                  }`}
                >
                  Used for match alerts, tournament invitations, and account security.
                </p>
              </div>

              {/* Email Input */}
              <div className="space-y-1.5">
                <label
                  className={`text-[11px] font-black uppercase tracking-wider block ${
                    isDark ? 'text-zinc-400' : 'text-zinc-600'
                  }`}
                >
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400">
                    <Mail className="w-4 h-4" />
                  </div>
                  <input
                    type="email"
                    autoFocus
                    inputMode="email"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      if (errorMessage) setErrorMessage(null);
                    }}
                    placeholder="e.g. dave@example.com"
                    className={`w-full pl-10 pr-10 py-3 rounded-2xl border font-bold text-sm sm:text-base focus:outline-none focus:ring-2 transition ${
                      email.trim().length === 0
                        ? isDark
                          ? 'bg-zinc-800/80 border-zinc-700 text-white placeholder:text-zinc-500 focus:bg-zinc-800 focus:border-emerald-500 focus:ring-emerald-500/40'
                          : 'bg-zinc-50 border-zinc-300 text-zinc-900 placeholder:text-zinc-400 focus:bg-white focus:border-emerald-600 focus:ring-emerald-500/40'
                        : isEmailValid
                        ? 'border-emerald-500 focus:ring-emerald-500/40 bg-emerald-500/5 text-emerald-950 dark:text-emerald-100'
                        : 'border-rose-400 focus:ring-rose-500/40 bg-rose-500/5 text-rose-950 dark:text-rose-100'
                    }`}
                  />
                  {email.trim().length > 0 && (
                    <div className="absolute right-3.5 top-1/2 -translate-y-1/2">
                      {isEmailValid ? (
                        <Check className="w-4 h-4 text-emerald-500 stroke-[3]" />
                      ) : (
                        <AlertCircle className="w-4 h-4 text-rose-500" />
                      )}
                    </div>
                  )}
                </div>

                {/* Real-time Email Format Feedback */}
                {email.trim().length > 0 && (
                  <div className="pt-0.5">
                    {isEmailValid ? (
                      <span className="text-[11px] font-black text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 animate-fadeIn">
                        <Check className="w-3.5 h-3.5 stroke-[3]" /> Valid email format
                      </span>
                    ) : (
                      <span className="text-[11px] font-black text-rose-500 flex items-center gap-1.5 animate-fadeIn">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" /> Please enter a valid email format (e.g. name@example.com)
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Color Swatches */}
              <div className="space-y-2 pt-1">
                <label
                  className={`text-[11px] font-black uppercase tracking-wider block ${
                    isDark ? 'text-zinc-400' : 'text-zinc-600'
                  }`}
                >
                  Player Avatar Accent
                </label>
                <div className="flex items-center gap-3">
                  {['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#EC4899', '#8B5CF6'].map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setSelectedColor(c)}
                      className={`w-9 h-9 rounded-2xl transition-all ${
                        selectedColor === c
                          ? 'ring-2 ring-indigo-600 ring-offset-2 scale-110 shadow-md'
                          : 'opacity-70 hover:opacity-100 hover:scale-105'
                      }`}
                      style={{ backgroundColor: c }}
                      title={`Select ${c}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ================= STEP 6: CONFIRM EVERY DETAIL & BUILD PROFILE ================= */}
          {step === 6 && (
            <div className="space-y-4 animate-fadeIn">
              <div className="space-y-1">
                <h4
                  className={`text-lg sm:text-xl font-black tracking-tight ${
                    isDark ? 'text-white' : 'text-zinc-900'
                  }`}
                >
                  Confirm profile details
                </h4>
                <p
                  className={`text-xs font-medium leading-relaxed ${
                    isDark ? 'text-zinc-400' : 'text-zinc-600'
                  }`}
                >
                  Please review your details before saving your online identity.
                </p>
              </div>

              {/* Google-Tier Profile Review Card (100% High Contrast Everywhere) */}
              <div
                className={`p-4 sm:p-5 rounded-2xl border space-y-3.5 transition-colors ${
                  isDark
                    ? 'bg-zinc-950/70 border-zinc-800'
                    : 'bg-zinc-50/90 border-zinc-200'
                }`}
              >
                {/* Row 1: Player Tag */}
                <div
                  className={`flex items-center justify-between pb-3 border-b ${
                    isDark ? 'border-zinc-800' : 'border-zinc-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-base shadow-sm"
                      style={{ backgroundColor: selectedColor }}
                    >
                      {username ? username.charAt(0).toUpperCase() : 'P'}
                    </div>
                    <div>
                      <span
                        className={`text-[10px] font-black uppercase tracking-wider block ${
                          isDark ? 'text-zinc-400' : 'text-zinc-500'
                        }`}
                      >
                        Player Tag
                      </span>
                      {/* CRITICAL FIX: Explicit dark/light text color */}
                      <span
                        className={`font-mono font-black text-base ${
                          isDark ? 'text-white' : 'text-zinc-900'
                        }`}
                      >
                        {formattedTag}
                      </span>
                    </div>
                  </div>

                  <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    Unique #
                  </span>
                </div>

                {/* Row 2: Security PIN */}
                <div
                  className={`flex items-center justify-between pb-3 border-b text-xs ${
                    isDark ? 'border-zinc-800' : 'border-zinc-200'
                  }`}
                >
                  <span
                    className={`font-bold ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}
                  >
                    4-Digit Security PIN
                  </span>
                  <span
                    className={`font-mono font-black tracking-widest ${
                      isDark ? 'text-white' : 'text-zinc-900'
                    }`}
                  >
                    ••••
                  </span>
                </div>

                {/* Row 3: Email */}
                <div
                  className={`flex items-center justify-between pb-3 border-b text-xs ${
                    isDark ? 'border-zinc-800' : 'border-zinc-200'
                  }`}
                >
                  <span
                    className={`font-bold ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}
                  >
                    Email Address
                  </span>
                  <span
                    className={`font-bold truncate max-w-[200px] ${
                      isDark ? 'text-white' : 'text-zinc-900'
                    }`}
                  >
                    {email.trim()}
                  </span>
                </div>

                {/* Row 4: Initial ELO Rating & QR Pass */}
                <div
                  className={`flex items-center justify-between pb-3 border-b text-xs ${
                    isDark ? 'border-zinc-800' : 'border-zinc-200'
                  }`}
                >
                  <span
                    className={`font-bold ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}
                  >
                    Starting Rank & QR Pass
                  </span>
                  <span className="font-black text-amber-500">
                    ⚔️ 1,000 ELO (QR Generated)
                  </span>
                </div>

                {/* Row 5: Camera Access for Tournament QR Scanner */}
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Camera className="w-3.5 h-3.5 text-zinc-400" />
                    <span
                      className={`font-bold ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}
                    >
                      Camera Access for QR
                    </span>
                  </div>

                  {cameraStatus === 'granted' ? (
                    <span className="font-bold text-emerald-500 flex items-center gap-1">
                      <Check className="w-3.5 h-3.5" />
                      Access Granted
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={requestCameraAccess}
                      disabled={isRequestingCamera}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition flex items-center gap-1 active:scale-95 ${
                        cameraStatus === 'denied'
                          ? isDark
                            ? 'bg-rose-950/40 text-rose-400 border border-rose-800/50 hover:bg-rose-900/40'
                            : 'bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100'
                          : isDark
                          ? 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700'
                          : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border border-zinc-300'
                      }`}
                    >
                      {isRequestingCamera ? (
                        <>
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>Requesting...</span>
                        </>
                      ) : cameraStatus === 'denied' ? (
                        <span>Blocked (Tap to Retry)</span>
                      ) : (
                        <span>Allow Camera</span>
                      )}
                    </button>
                  )}
                </div>
              </div>

              {/* Tournament QR Scanning & Camera Permission Notice */}
              <div
                className={`p-3.5 rounded-2xl border text-xs flex items-start gap-3 transition-colors ${
                  cameraStatus === 'granted'
                    ? isDark
                      ? 'bg-emerald-950/20 border-emerald-800/40 text-emerald-300'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : isDark
                    ? 'bg-zinc-800/40 border-zinc-800 text-zinc-300'
                    : 'bg-zinc-100/80 border-zinc-200 text-zinc-700'
                }`}
              >
                <div
                  className={`w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                    cameraStatus === 'granted'
                      ? 'bg-emerald-500/20 text-emerald-500'
                      : isDark
                      ? 'bg-zinc-800 text-zinc-400'
                      : 'bg-white text-zinc-600 shadow-xs'
                  }`}
                >
                  <Camera className="w-4 h-4" />
                </div>
                <div className="space-y-1">
                  <p className="font-bold text-[11px] tracking-wide uppercase">
                    {cameraStatus === 'granted'
                      ? 'Camera Enabled for QR Scans'
                      : 'Camera Permission Prompt'}
                  </p>
                  <p className="text-[11px] opacity-85 leading-relaxed">
                    {cameraStatus === 'granted'
                      ? 'All set! You can instantly scan opponent player QR codes at pool tables to check stats and start ranked games.'
                      : 'When you activate your profile, your browser will prompt you to grant camera access so you can scan player QR badges at the tables.'}
                  </p>
                </div>
              </div>
            </div>
          )}
            </>
          )}
        </div>

        {/* ================= GOOGLE-STYLE STICKY FOOTER ================= */}
        <div
          className={`px-5 sm:px-7 py-4 border-t flex items-center justify-between gap-3 flex-shrink-0 ${
            isDark ? 'border-zinc-800 bg-zinc-900/90' : 'border-zinc-100 bg-white'
          }`}
        >
          {createdProfile ? (
            <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">
                {hasUnderstood ? (
                  <span className="text-emerald-500 font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Ready to enter the arena
                  </span>
                ) : (
                  <span className="text-amber-500 font-bold flex items-center gap-1.5">
                    Tap the confirmation box above to proceed
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={handleFinishSetup}
                className={`w-full sm:w-auto py-3 px-6 rounded-full font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-md transition-all active:scale-95 cursor-pointer ${
                  hasUnderstood
                    ? 'bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-emerald-600/30'
                    : 'bg-zinc-200 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500 border border-zinc-300 dark:border-zinc-700'
                }`}
              >
                <span>Enter Arena &amp; View Standings</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <>
              {/* Back or Cancel Button */}
              {step === 1 ? (
                <button
                  type="button"
                  onClick={handleModalClose}
                  className={`py-2.5 px-4 rounded-full font-bold text-xs transition active:scale-95 ${
                    isDark
                      ? 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                      : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
                  }`}
                >
                  Cancel
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3 | 4 | 5)}
                  disabled={isSubmitting}
                  className={`py-2.5 px-4 rounded-full font-bold text-xs flex items-center gap-1.5 transition active:scale-95 ${
                    isDark
                      ? 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                      : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
                  }`}
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
              )}

              {/* Primary Action Button */}
              {step === 1 && (
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  disabled={!isStep1Valid}
                  className={`py-3 px-6 rounded-full font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-md transition-all ${
                    isStep1Valid
                      ? 'bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white shadow-emerald-600/30 cursor-pointer'
                      : 'bg-zinc-200 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500 cursor-not-allowed opacity-60'
                  }`}
                >
                  <span>Continue</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}

              {step === 2 && (
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="py-3 px-6 rounded-full font-black text-xs uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white shadow-md shadow-emerald-600/30 flex items-center gap-2 cursor-pointer transition-all"
                >
                  <span>Got It, Next</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}

              {step === 3 && (
                <button
                  type="button"
                  onClick={() => setStep(4)}
                  disabled={!isStep3Valid}
                  className={`py-3 px-6 rounded-full font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-md transition-all ${
                    isStep3Valid
                      ? 'bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white shadow-emerald-600/30 cursor-pointer'
                      : 'bg-zinc-200 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500 cursor-not-allowed opacity-60'
                  }`}
                >
                  <span>Next</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}

              {step === 4 && (
                <button
                  type="button"
                  onClick={() => setStep(5)}
                  disabled={!isStep4Valid}
                  className={`py-3 px-6 rounded-full font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-md transition-all ${
                    isStep4Valid
                      ? 'bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white shadow-emerald-600/30 cursor-pointer'
                      : 'bg-zinc-200 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500 cursor-not-allowed opacity-60'
                  }`}
                >
                  <span>Next</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}

              {step === 5 && (
                <button
                  type="button"
                  onClick={() => setStep(6)}
                  disabled={!isStep5Valid}
                  className={`py-3 px-6 rounded-full font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-md transition-all ${
                    isStep5Valid
                      ? 'bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white shadow-emerald-600/30 cursor-pointer'
                      : 'bg-zinc-200 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500 cursor-not-allowed opacity-60'
                  }`}
                >
                  <span>Review & Confirm</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}

              {step === 6 && (
                <button
                  type="button"
                  onClick={handleFinalSubmit}
                  disabled={isSubmitting || isRequestingCamera}
                  className="py-3 px-6 rounded-full font-black text-xs uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 active:scale-95 text-white shadow-md shadow-emerald-600/30 flex items-center gap-2 cursor-pointer transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isRequestingCamera ? (
                    <>
                      <Camera className="w-4 h-4 animate-pulse" />
                      <span>Prompting Camera...</span>
                    </>
                  ) : isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Activating...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4 stroke-[3]" />
                      <span>Confirm & Activate</span>
                    </>
                  )}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
