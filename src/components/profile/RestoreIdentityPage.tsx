import React, { useState, useEffect, useSyncExternalStore } from 'react';
import Image from 'next/image';
import {
  ArrowLeft,
  Mail,
  User,
  KeyRound,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  ShieldCheck,
  Check,
  Info,
  WifiOff,
  Wifi,
  RefreshCw,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { restorePlayerProfile, RankedPlayerProfile } from '@/lib/rankedSync';
import {
  subscribeNetworkHealth,
  getNetworkHealthSnapshot,
  checkRealInternetConnectivity,
} from '@/lib/networkReachability';

interface RestoreIdentityPageProps {
  isOpen: boolean;
  onBack: () => void;
  onComplete: (profile: RankedPlayerProfile) => void;
  isDark: boolean;
}

export const RestoreIdentityPage: React.FC<RestoreIdentityPageProps> = ({
  isOpen,
  onBack,
  onComplete,
  isDark,
}) => {
  const network = useSyncExternalStore(
    subscribeNetworkHealth,
    getNetworkHealthSnapshot,
    getNetworkHealthSnapshot
  );
  const [isCheckingNetwork, setIsCheckingNetwork] = useState<boolean>(false);

  const [identifier, setIdentifier] = useState<string>('');
  const [pin, setPin] = useState<string>('');
  const [showPin, setShowPin] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [restoredProfile, setRestoredProfile] = useState<RankedPlayerProfile | null>(null);

  // Loading state after slide-in animation before fields appear (2-3 seconds as requested)
  const [isPageLoading, setIsPageLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!isOpen) return;
    // Show spinner for 2.5s (2-3 seconds) to verify database sync before fields appear smoothly
    const timer = setTimeout(() => {
      setIsPageLoading(false);
    }, 2500);
    return () => clearTimeout(timer);
  }, [isOpen]);

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onBack();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onBack]);

  if (!isOpen) return null;

  // Real-time smart validator for email, player tag permutations, and usernames
  const getIdentifierFeedback = (raw: string) => {
    const val = raw.trim();
    if (!val) return null;

    // 1. Email detection (contains '@')
    if (val.includes('@')) {
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (emailRegex.test(val)) {
        return {
          status: 'valid' as const,
          message: 'Valid email address format',
        };
      }
      return {
        status: 'warning' as const,
        message: 'Incomplete email format (e.g. name@example.com)',
      };
    }

    // 2. Player Tag with '#' (e.g. "Dylen #1001", "Dylen#1001", "Dylen # 1001", "Dylen# 1001")
    if (val.includes('#')) {
      const parts = val.split('#');
      const name = parts[0].trim();
      const rawDigits = parts.slice(1).join('').replace(/[^0-9]/g, '').trim();

      if (!name) {
        return {
          status: 'warning' as const,
          message: 'Please enter username before # (e.g. Dylen #1001)',
        };
      }
      if (name.length < 2) {
        return {
          status: 'warning' as const,
          message: 'Username must be at least 2 characters',
        };
      }

      if (rawDigits.length === 4) {
        return {
          status: 'valid' as const,
          message: `Recognized Player Tag: ${name} #${rawDigits}`,
        };
      } else if (rawDigits.length > 0 && rawDigits.length < 4) {
        return {
          status: 'warning' as const,
          message: `Short code needs 4 digits (#${rawDigits.padEnd(4, '•')})`,
        };
      } else if (rawDigits.length > 4) {
        return {
          status: 'warning' as const,
          message: 'Short code cannot exceed 4 digits',
        };
      }
      return {
        status: 'warning' as const,
        message: 'Enter 4-digit code after # (e.g. #1001)',
      };
    }

    // 3. User spaced after name then input short number WITHOUT '#' (e.g. "Dylen 1001", "Dylen   1001")
    const spaceNumMatch = val.match(/^(.+?)\s+(\d+)$/);
    if (spaceNumMatch) {
      const name = spaceNumMatch[1].trim();
      const digits = spaceNumMatch[2];

      if (name.length < 2) {
        return {
          status: 'warning' as const,
          message: 'Username must be at least 2 characters',
        };
      }

      if (digits.length === 4) {
        return {
          status: 'valid' as const,
          message: `Detected Player Tag: ${name} #${digits} (auto-formatted)`,
        };
      } else if (digits.length < 4) {
        return {
          status: 'warning' as const,
          message: `Short code needs 4 digits (e.g. ${name} #${digits.padEnd(4, '•')})`,
        };
      } else {
        return {
          status: 'warning' as const,
          message: 'Short code cannot exceed 4 digits',
        };
      }
    }

    // 4. User typed name joined with 4 digits without space or '#' (e.g. "Dylen1001")
    const joinedNumMatch = val.match(/^([a-zA-Z_.-]{2,})(\d{4})$/);
    if (joinedNumMatch) {
      return {
        status: 'valid' as const,
        message: `Recognized Tag: ${joinedNumMatch[1]} #${joinedNumMatch[2]} (or name "${val}")`,
      };
    }

    // 5. User entered only their username without '#' or number (e.g. "Dylen")
    if (val.length < 2) {
      return {
        status: 'warning' as const,
        message: 'Username must be at least 2 characters',
      };
    }

    return {
      status: 'neutral' as const,
      message: `Username "${val}" — PIN will verify your account`,
    };
  };

  const validationFeedback = getIdentifierFeedback(identifier);

  const handlePinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
    setPin(val);
    if (errorMessage) setErrorMessage(null);
  };

  const handleIdentifierChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setIdentifier(e.target.value);
    if (errorMessage) setErrorMessage(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    const cleanId = identifier.trim();
    const cleanPin = pin.trim();

    if (!cleanId) {
      setErrorMessage('Please enter your Player Tag or Email address.');
      return;
    }

    if (cleanId.includes('@')) {
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      if (!emailRegex.test(cleanId)) {
        setErrorMessage('Please enter a valid email format (e.g., name@example.com).');
        return;
      }
    }

    if (cleanPin.length !== 4) {
      setErrorMessage('Please enter your 4-digit Security PIN.');
      return;
    }

    if (validationFeedback && validationFeedback.status === 'warning') {
      setErrorMessage(validationFeedback.message);
      return;
    }

    if (!network.hasInternet) {
      setErrorMessage('Internet connection required. Please reconnect to Wi-Fi or data to restore your profile.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const result = await restorePlayerProfile(cleanId, cleanPin);
    setIsSubmitting(false);

    if (result.success && result.profile) {
      setRestoredProfile(result.profile);
      try {
        confetti({
          particleCount: 70,
          spread: 60,
          origin: { y: 0.5 },
        });
      } catch {}

      // Brief moment for user to see the success card, then complete
      setTimeout(() => {
        onComplete(result.profile!);
      }, 1600);
    } else {
      setErrorMessage(result.error || 'Invalid credentials. Please verify your details.');
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className={`fixed inset-0 z-50 overflow-y-auto animate-slideInRight transition-colors ${
        isDark ? 'bg-[#121214] text-zinc-100' : 'bg-[#F4F2EC] text-[#1C1C1E]'
      }`}
    >
      <div className="w-full max-w-xl mx-auto min-h-screen flex flex-col p-4 sm:p-6 space-y-6">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={onBack}
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold transition active:scale-95 ${
              isDark
                ? 'bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700'
                : 'bg-white text-zinc-700 hover:text-zinc-900 hover:bg-zinc-100 border border-zinc-200'
            }`}
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Settings</span>
          </button>

          <div className="flex items-center gap-1.5">
            {network.hasInternet ? (
              <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                <Wifi className="w-2.5 h-2.5" />
                <span>Online</span>
              </span>
            ) : (
              <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-500 border border-rose-500/25 flex items-center gap-1">
                <WifiOff className="w-2.5 h-2.5" />
                <span>Offline</span>
              </span>
            )}
            <span
              className={`text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-full ${
                isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-200/80 text-zinc-600'
              }`}
            >
              Account Recovery
            </span>
          </div>
        </div>

        {/* Brand Header with Actual Favicon App Logo */}
        <div className="text-center space-y-2 pt-2">
          {/* Actual Favicon Logo Image */}
          <div className="mx-auto w-16 h-16 rounded-2xl bg-white/95 dark:bg-zinc-800/90 border border-zinc-200 dark:border-zinc-700 p-2 shadow-xl shadow-indigo-500/10 flex items-center justify-center">
            <Image
              src="/icon-192.png"
              alt="Billiard Favicon Logo"
              width={48}
              height={48}
              className="w-12 h-12 rounded-xl object-contain drop-shadow-sm select-none"
              priority
            />
          </div>

          <div className="space-y-0.5">
            <h1
              className={`text-2xl sm:text-3xl font-black italic tracking-widest bg-clip-text text-transparent font-serif uppercase ${
                isDark
                  ? 'bg-gradient-to-r from-red-500 via-blue-500 to-purple-400'
                  : 'bg-gradient-to-r from-red-600 via-black to-purple-600'
              }`}
            >
              BILLIARD
            </h1>
            <p className="text-[10px] font-extrabold uppercase tracking-widest text-indigo-500">
              SCOREKEEPER &amp; ARENA STANDINGS
            </p>
          </div>

          <div className="pt-1 max-w-md mx-auto">
            <h2 className="text-xl sm:text-2xl font-black uppercase font-serif tracking-tight">
              Restore Your Profile
            </h2>
            <p
              className={`text-xs font-medium leading-relaxed pt-1 ${
                isDark ? 'text-zinc-400' : 'text-zinc-600'
              }`}
            >
              Recover your cloud account, competitive ELO rating, tournament QR code, and career record on this device.
            </p>
          </div>
        </div>

        {/* Main Content Area: Loading state OR Smoothly loaded form/success */}
        <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full pb-8">
          {isPageLoading ? (
            /* Dedicated Loading State: loads after sliding animation before fields appear (2-3 seconds) */
            <div
              className={`p-6 sm:p-7 rounded-3xl border shadow-xl space-y-6 animate-fadeIn ${
                isDark
                  ? 'bg-zinc-900 border-zinc-800 text-zinc-100 shadow-black/40'
                  : 'bg-white border-zinc-200 text-zinc-900 shadow-xl'
              }`}
            >
              {/* Spinner & Cloud Connection Indicator */}
              {!network.hasInternet ? (
                /* Offline Alert State during load */
                <div className="flex flex-col items-center justify-center py-6 space-y-3.5 text-center">
                  <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-500 flex items-center justify-center shadow-lg shadow-rose-500/15">
                    <WifiOff className="w-6 h-6 stroke-[2.5]" />
                  </div>
                  <div className="space-y-1 max-w-xs">
                    <p className="text-xs font-black uppercase tracking-widest text-rose-500">
                      Internet Connection Required
                    </p>
                    <p className={`text-[11px] font-medium leading-relaxed ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                      Account restoration connects to the arena cloud database. Please reconnect to Wi-Fi or mobile data.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      setIsCheckingNetwork(true);
                      await checkRealInternetConnectivity();
                      setIsCheckingNetwork(false);
                    }}
                    disabled={isCheckingNetwork}
                    className="mt-1 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-rose-600 hover:bg-rose-500 text-white shadow-md active:scale-95 transition cursor-pointer"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${isCheckingNetwork ? 'animate-spin' : ''}`} />
                    <span>{isCheckingNetwork ? 'Testing Connection...' : 'Retry Connection'}</span>
                  </button>
                </div>
              ) : (
                /* Online Clean 360° Circular Spinner with continuous rotation */
                <div className="flex flex-col items-center justify-center py-5 space-y-3.5">
                  <div className="relative flex items-center justify-center w-12 h-12">
                    <div className="absolute inset-0 rounded-full bg-indigo-500/15 animate-ping opacity-60" />
                    <svg
                      className="w-10 h-10 animate-spin text-indigo-600 dark:text-indigo-400"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className={isDark ? 'text-zinc-800' : 'text-indigo-100'}
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="3.5"
                      />
                      <path
                        className="text-indigo-600 dark:text-indigo-400"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-xs font-black uppercase tracking-widest text-indigo-500 animate-pulseSubtle">
                      Loading Account Recovery…
                    </p>
                    <p className={`text-[11px] font-medium ${isDark ? 'text-zinc-500' : 'text-zinc-400'}`}>
                      Connecting to arena cloud &amp; preparing fields
                    </p>
                  </div>
                </div>
              )}

              {/* Skeleton fields mimicking the actual input layout */}
              <div className="space-y-4 animate-pulseSubtle">
                <div className="space-y-1.5">
                  <div className={`h-3 w-36 rounded-full ${isDark ? 'bg-zinc-800' : 'bg-zinc-200'}`} />
                  <div className={`h-11 w-full rounded-2xl ${isDark ? 'bg-zinc-950/70 border border-zinc-800' : 'bg-zinc-100 border border-zinc-200'}`} />
                </div>
                <div className="space-y-1.5">
                  <div className={`h-3 w-28 rounded-full ${isDark ? 'bg-zinc-800' : 'bg-zinc-200'}`} />
                  <div className={`h-11 w-full rounded-2xl ${isDark ? 'bg-zinc-950/70 border border-zinc-800' : 'bg-zinc-100 border border-zinc-200'}`} />
                </div>
                <div className={`h-12 w-full rounded-2xl ${isDark ? 'bg-indigo-950/40 border border-indigo-900/30' : 'bg-indigo-100/60 border border-indigo-200'}`} />
              </div>
            </div>
          ) : restoredProfile ? (
            /* Celebration Success Card */
            <div
              className={`p-6 sm:p-7 rounded-3xl border text-center space-y-4 animate-scaleUp shadow-xl ${
                isDark
                  ? 'bg-zinc-900 border-emerald-500/40 text-zinc-100'
                  : 'bg-white border-emerald-500/30 text-zinc-900'
              }`}
            >
              <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <CheckCircle2 className="w-8 h-8 stroke-[2.5]" />
              </div>

              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 inline-block">
                  Account Verified
                </span>
                <h3 className="text-xl font-black uppercase font-serif">
                  Welcome Back, {restoredProfile.username}!
                </h3>
                <p className={`text-xs font-medium ${isDark ? 'text-zinc-400' : 'text-zinc-600'}`}>
                  Your competitive profile and tournament QR pass have been restored to this device.
                </p>
              </div>

              {/* Restored Summary Pill */}
              <div
                className={`p-3 rounded-2xl border flex items-center justify-between text-xs font-bold ${
                  isDark
                    ? 'bg-zinc-950/70 border-zinc-800 text-zinc-300'
                    : 'bg-zinc-50 border-zinc-200 text-zinc-700'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: restoredProfile.color }}
                  />
                  <span>{restoredProfile.tag}</span>
                </div>
                <div className="flex items-center gap-1.5 font-extrabold text-amber-500">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{restoredProfile.rating} ELO</span>
                </div>
              </div>
            </div>
          ) : (
            /* Restoration Form Card — Smoothly fades in and glides up after page loading */
            <form
              onSubmit={handleSubmit}
              className={`p-6 sm:p-7 rounded-3xl border shadow-xl space-y-5 animate-smoothFadeUp transition-all ${
                isDark
                  ? 'bg-zinc-900 border-zinc-800 text-zinc-100 shadow-black/40'
                  : 'bg-white border-zinc-200 text-zinc-900 shadow-xl'
              }`}
            >
              {/* Offline Network Warning Banner */}
              {!network.hasInternet && (
                <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/25 flex items-center justify-between text-xs text-rose-500 font-semibold animate-fadeIn">
                  <div className="flex items-center gap-2">
                    <WifiOff className="w-4 h-4 flex-shrink-0" />
                    <span>You are offline. Connect to internet to restore.</span>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      setIsCheckingNetwork(true);
                      await checkRealInternetConnectivity();
                      setIsCheckingNetwork(false);
                    }}
                    disabled={isCheckingNetwork}
                    className="px-2.5 py-1 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 font-bold uppercase text-[10px] flex items-center gap-1 transition cursor-pointer"
                  >
                    <RefreshCw className={`w-3 h-3 ${isCheckingNetwork ? 'animate-spin' : ''}`} />
                    <span>Retry</span>
                  </button>
                </div>
              )}

              {/* Error Message Box */}
              {errorMessage && (
                <div className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/25 flex items-start gap-2.5 text-xs text-rose-500 font-medium animate-fadeIn">
                  <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                  <span className="leading-snug">{errorMessage}</span>
                </div>
              )}

              {/* Field 1: Player Tag or Email */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="restore-identifier"
                    className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5"
                  >
                    {identifier.includes('@') ? (
                      <Mail className="w-3.5 h-3.5 text-indigo-500" />
                    ) : (
                      <User className="w-3.5 h-3.5 text-indigo-500" />
                    )}
                    <span>Player Tag or Email</span>
                  </label>
                  {validationFeedback && (
                    <span
                      className={`text-[10px] font-bold flex items-center gap-1 ${
                        validationFeedback.status === 'valid'
                          ? 'text-emerald-500'
                          : validationFeedback.status === 'warning'
                          ? 'text-amber-500'
                          : 'text-indigo-400'
                      }`}
                    >
                      {validationFeedback.status === 'valid' ? (
                        <Check className="w-3 h-3" />
                      ) : validationFeedback.status === 'warning' ? (
                        <AlertCircle className="w-3 h-3" />
                      ) : (
                        <Info className="w-3 h-3" />
                      )}
                      <span>{validationFeedback.message}</span>
                    </span>
                  )}
                </div>

                <div className="relative">
                  <input
                    id="restore-identifier"
                    type="text"
                    value={identifier}
                    onChange={handleIdentifierChange}
                    autoFocus
                    placeholder="e.g. Dylen #1001, Dylen 1001, or name@example.com"
                    className={`w-full px-4 py-3 rounded-2xl border text-sm font-semibold transition focus:outline-none focus:ring-2 ${
                      validationFeedback?.status === 'warning'
                        ? 'border-amber-500/70 focus:ring-amber-500/40 focus:border-amber-500'
                        : validationFeedback?.status === 'valid'
                        ? 'border-emerald-500/60 focus:ring-emerald-500/40 focus:border-emerald-500'
                        : isDark
                        ? 'bg-zinc-950/70 border-zinc-800 text-white focus:ring-indigo-500/40 focus:border-indigo-500'
                        : 'bg-zinc-50 border-zinc-300 text-zinc-900 focus:ring-indigo-500/40 focus:border-indigo-500'
                    }`}
                  />
                </div>

                <p className={`text-[11px] font-medium ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>
                  Accepts <strong>Dylen #1001</strong>, <strong>Dylen#1001</strong>, <strong>Dylen 1001</strong>, <strong>Dylen</strong>, or registered <strong>Email</strong>.
                </p>
              </div>

              {/* Field 2: 4-Digit Security PIN */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="restore-pin"
                    className="text-xs font-black uppercase tracking-wider flex items-center gap-1.5"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-indigo-500" />
                    <span>4-Digit Security PIN</span>
                  </label>
                  <span className="text-[10px] font-bold text-zinc-400">
                    {pin.length}/4 digits
                  </span>
                </div>

                <div className="relative">
                  <input
                    id="restore-pin"
                    type={showPin ? 'text' : 'password'}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={4}
                    value={pin}
                    onChange={handlePinChange}
                    placeholder="••••"
                    className={`w-full px-4 py-3 pr-11 rounded-2xl border text-sm font-mono tracking-widest font-black transition focus:outline-none focus:ring-2 ${
                      isDark
                        ? 'bg-zinc-950/70 border-zinc-800 text-white focus:ring-indigo-500/40 focus:border-indigo-500'
                        : 'bg-zinc-50 border-zinc-300 text-zinc-900 focus:ring-indigo-500/40 focus:border-indigo-500'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-200 transition"
                  >
                    {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                <p className={`text-[11px] font-medium ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>
                  The 4-digit PIN you created during registration.
                </p>
              </div>

              {/* Cloud Security Guarantee */}
              <div
                className={`p-3 rounded-2xl border text-[11px] font-medium flex items-center gap-2 ${
                  isDark
                    ? 'bg-indigo-950/20 border-indigo-900/30 text-indigo-300'
                    : 'bg-indigo-50/60 border-indigo-200 text-indigo-800'
                }`}
              >
                <ShieldCheck className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                <span>
                  Your career ELO and QR code pass are synced in the cloud and will be restored immediately.
                </span>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={
                  !network.hasInternet ||
                  isSubmitting ||
                  !identifier.trim() ||
                  pin.trim().length !== 4 ||
                  (validationFeedback?.status === 'warning')
                }
                className="w-full py-3.5 px-6 rounded-2xl font-black text-xs uppercase tracking-wider text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-indigo-600/25 transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
              >
                {!network.hasInternet ? (
                  <>
                    <WifiOff className="w-4 h-4 text-zinc-300" />
                    <span>Offline — Internet Connection Required</span>
                  </>
                ) : isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Verifying Credentials...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Restore My Profile</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
