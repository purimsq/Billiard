import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { restorePlayerProfile, RankedPlayerProfile } from '@/lib/rankedSync';

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
  const [identifier, setIdentifier] = useState<string>('');
  const [pin, setPin] = useState<string>('');
  const [showPin, setShowPin] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [restoredProfile, setRestoredProfile] = useState<RankedPlayerProfile | null>(null);

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

  // Email format validation checker
  const isEmailInput = identifier.includes('@');
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  const isEmailValid = isEmailInput ? emailRegex.test(identifier.trim()) : true;
  const showEmailFormatError = isEmailInput && identifier.trim().length > 3 && !isEmailValid;

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

    if (isEmailInput && !isEmailValid) {
      setErrorMessage('Please enter a valid email format (e.g., name@example.com).');
      return;
    }

    if (cleanPin.length !== 4) {
      setErrorMessage('Please enter your 4-digit Security PIN.');
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
      setErrorMessage(result.error || 'Unable to verify credentials. Please verify your details.');
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

          <span
            className={`text-[10px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-full ${
              isDark ? 'bg-zinc-800 text-zinc-400' : 'bg-zinc-200/80 text-zinc-600'
            }`}
          >
            Account Recovery
          </span>
        </div>

        {/* Brand Header */}
        <div className="text-center space-y-2 pt-2">
          {/* Logo badge */}
          <div className="mx-auto w-14 h-14 rounded-3xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center text-white text-2xl shadow-xl shadow-indigo-500/25 select-none">
            🎱
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

        {/* Main Content Form / Success State */}
        <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full pb-8">
          {restoredProfile ? (
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
            /* Restoration Form Card */
            <form
              onSubmit={handleSubmit}
              className={`p-6 sm:p-7 rounded-3xl border shadow-xl space-y-5 transition-all ${
                isDark
                  ? 'bg-zinc-900 border-zinc-800 text-zinc-100 shadow-black/40'
                  : 'bg-white border-zinc-200 text-zinc-900 shadow-xl'
              }`}
            >
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
                    {isEmailInput ? (
                      <Mail className="w-3.5 h-3.5 text-indigo-500" />
                    ) : (
                      <User className="w-3.5 h-3.5 text-indigo-500" />
                    )}
                    <span>Player Tag or Email</span>
                  </label>
                  {isEmailInput && isEmailValid && (
                    <span className="text-[10px] font-bold text-emerald-500 flex items-center gap-1">
                      <Check className="w-3 h-3" /> Valid email format
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
                    placeholder="e.g. Dylen #1001 or dylen@example.com"
                    className={`w-full px-4 py-3 rounded-2xl border text-sm font-semibold transition focus:outline-none focus:ring-2 ${
                      showEmailFormatError
                        ? 'border-amber-500/70 focus:ring-amber-500/40'
                        : isDark
                        ? 'bg-zinc-950/70 border-zinc-800 text-white focus:ring-indigo-500/40 focus:border-indigo-500'
                        : 'bg-zinc-50 border-zinc-300 text-zinc-900 focus:ring-indigo-500/40 focus:border-indigo-500'
                    }`}
                  />
                </div>

                {/* Email Format Warning Checker */}
                {showEmailFormatError && (
                  <p className="text-[11px] font-semibold text-amber-500 flex items-center gap-1 pt-0.5">
                    <AlertCircle className="w-3 h-3 flex-shrink-0" />
                    <span>Please enter a valid email format (e.g., name@example.com)</span>
                  </p>
                )}
                <p className={`text-[11px] font-medium ${isDark ? 'text-zinc-500' : 'text-zinc-500'}`}>
                  Enter either your registered public tag (e.g., <strong>Dylen #1001</strong>) or your account email address.
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
                  isSubmitting ||
                  !identifier.trim() ||
                  pin.trim().length !== 4 ||
                  (isEmailInput && !isEmailValid)
                }
                className="w-full py-3.5 px-6 rounded-2xl font-black text-xs uppercase tracking-wider text-white bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-indigo-600/25 transition-all active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer"
              >
                {isSubmitting ? (
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
