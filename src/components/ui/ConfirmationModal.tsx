import React, { useEffect } from 'react';
import { Trash2, AlertTriangle, Info, X } from 'lucide-react';
import { useBackHandler } from '@/lib/backNavigation';

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  isDark?: boolean;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'danger',
  isDark = false,
}) => {
  // Mobile hardware/gesture back support
  useBackHandler('modal:confirmation', isOpen, onClose);

  // Close on Escape key press
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-sm rounded-3xl p-5 border shadow-2xl space-y-4 animate-scaleUp transition-colors ${
          isDark
            ? 'bg-zinc-900 border-zinc-800 text-zinc-100'
            : 'bg-white border-zinc-200 text-zinc-900'
        }`}
      >
        {/* Top Header with Icon */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 ${
                variant === 'danger'
                  ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                  : variant === 'warning'
                  ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                  : 'bg-indigo-500/10 text-indigo-500 border border-indigo-500/20'
              }`}
            >
              {variant === 'danger' ? (
                <Trash2 className="w-5 h-5" />
              ) : variant === 'warning' ? (
                <AlertTriangle className="w-5 h-5" />
              ) : (
                <Info className="w-5 h-5" />
              )}
            </div>

            <div>
              <h3 className="font-black text-sm sm:text-base leading-tight">
                {title}
              </h3>
              <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">
                Action Requires Confirmation
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={`p-1.5 rounded-full transition ${
              isDark
                ? 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Descriptive Message */}
        <p
          className={`text-xs font-medium leading-relaxed ${
            isDark ? 'text-zinc-400' : 'text-zinc-600'
          }`}
        >
          {message}
        </p>

        {/* 2-Step Action Buttons */}
        <div className="grid grid-cols-2 gap-2.5 pt-1">
          <button
            type="button"
            onClick={onClose}
            className={`py-2.5 px-3 rounded-xl border font-bold text-xs transition active:scale-[0.98] ${
              isDark
                ? 'border-zinc-700 bg-zinc-800/80 text-zinc-300 hover:bg-zinc-800 hover:text-white'
                : 'border-zinc-200 bg-zinc-100 text-zinc-700 hover:bg-zinc-200'
            }`}
          >
            {cancelText}
          </button>

          <button
            type="button"
            onClick={() => {
              onConfirm();
              onClose();
            }}
            className={`py-2.5 px-3 rounded-xl font-black text-xs uppercase tracking-wider text-white shadow-md transition active:scale-[0.98] flex items-center justify-center gap-1.5 ${
              variant === 'danger'
                ? 'bg-rose-600 hover:bg-rose-700 shadow-rose-600/20'
                : variant === 'warning'
                ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/20'
                : 'bg-indigo-600 hover:bg-indigo-700 shadow-indigo-600/20'
            }`}
          >
            <Trash2 className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>{confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
