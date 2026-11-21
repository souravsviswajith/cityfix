import React, { useState } from 'react';
import { MessageSquare, Phone, ShieldCheck, X } from 'lucide-react';
import type { AuthChannel, CitizenSession } from '../types/civic';

interface CitizenAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthenticated: (session: CitizenSession) => void;
  currentSession: CitizenSession | null;
  onSignOut: () => void;
}

export const CitizenAuthModal: React.FC<CitizenAuthModalProps> = ({
  isOpen,
  onClose,
  onAuthenticated,
  currentSession,
  onSignOut,
}) => {
  const [channel, setChannel] = useState<AuthChannel>('WhatsApp');
  const [name, setName] = useState('');
  const [contact, setContact] = useState('+1 (555) 234-8910');
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [previewCode, setPreviewCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/request-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact, channel, name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Could not send verification code.');
      } else {
        setOtpSent(true);
        setPreviewCode(data.verificationPreviewCode ?? null);
      }
    } catch {
      setError('Network error while requesting verification code.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contact, code: otpCode, name }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Verification failed.');
      } else if (data.session) {
        onAuthenticated(data.session);
        setOtpSent(false);
        setOtpCode('');
        setPreviewCode(null);
        onClose();
      }
    } catch {
      setError('Network error while verifying code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="citizen-auth-title"
    >
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-5 w-5 text-[#0f4c81]" />
            <h2 id="citizen-auth-title" className="text-base font-semibold text-slate-900">
              Citizen Verification
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
            aria-label="Close authentication modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-6">
          {currentSession?.authenticated ? (
            <div className="space-y-4">
              <div className="rounded-md border border-emerald-200 bg-emerald-50/60 p-4">
                <p className="text-xs font-medium text-emerald-800">Verified Citizen Session</p>
                <p className="mt-1 text-base font-semibold text-slate-900">
                  {currentSession.name}
                </p>
                <p className="mt-1 font-mono text-xs text-slate-600 tabular-nums">
                  {currentSession.contact} · {currentSession.channel}
                </p>
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    onSignOut();
                    onClose();
                  }}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
                >
                  Sign Out
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md bg-[#0f4c81] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0c3d68] whitespace-nowrap shrink-0"
                >
                  Continue
                </button>
              </div>
            </div>
          ) : !otpSent ? (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <p className="text-sm text-slate-600 leading-relaxed">
                Verify your mobile number or WhatsApp account so municipal officials can attach your
                contact details to formal civic complaints.
              </p>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1.5">
                  Verification Channel
                </label>
                <div className="grid grid-cols-2 gap-2 rounded-md bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => setChannel('WhatsApp')}
                    className={`flex items-center justify-center gap-2 rounded px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                      channel === 'WhatsApp'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <MessageSquare className="h-3.5 w-3.5" />
                    WhatsApp
                  </button>
                  <button
                    type="button"
                    onClick={() => setChannel('Mobile SMS')}
                    className={`flex items-center justify-center gap-2 rounded px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap ${
                      channel === 'Mobile SMS'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Phone className="h-3.5 w-3.5" />
                    Mobile SMS
                  </button>
                </div>
              </div>

              <div>
                <label htmlFor="citizen-name" className="block text-xs font-medium text-slate-700 mb-1">
                  Full Name
                </label>
                <input
                  id="citizen-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Jordan Patel"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0f4c81] focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/15"
                />
              </div>

              <div>
                <label htmlFor="citizen-phone" className="block text-xs font-medium text-slate-700 mb-1">
                  {channel === 'WhatsApp' ? 'WhatsApp Phone Number' : 'Mobile Phone Number'}
                </label>
                <input
                  id="citizen-phone"
                  type="tel"
                  required
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                  placeholder="+1 (555) 234-8910"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0f4c81] focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/15"
                />
              </div>

              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-md bg-[#0f4c81] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0c3d68] disabled:opacity-60 whitespace-nowrap"
                >
                  {loading ? 'Sending Code...' : `Send ${channel} Code`}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <p className="text-sm text-slate-600">
                Enter the 6-digit verification code sent via <strong className="text-slate-900">{channel}</strong> to{' '}
                <span className="font-mono text-slate-900">{contact}</span>.
              </p>

              {previewCode && (
                <div className="flex items-center justify-between rounded-md border border-sky-200 bg-sky-50 px-3 py-2.5 text-xs text-sky-900">
                  <span>
                    Preview Verification Code: <strong className="font-mono text-sm">{previewCode}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => setOtpCode(previewCode)}
                    className="font-medium text-[#0f4c81] underline hover:text-[#0c3d68]"
                  >
                    Auto-fill
                  </button>
                </div>
              )}

              <div>
                <label htmlFor="otp-code" className="block text-xs font-medium text-slate-700 mb-1">
                  6-Digit Code
                </label>
                <input
                  id="otp-code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  required
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="000000"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-center font-mono text-lg tracking-widest text-slate-900 focus:border-[#0f4c81] focus:outline-none focus:ring-2 focus:ring-[#0f4c81]/15"
                />
              </div>

              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setOtpSent(false);
                    setError(null);
                  }}
                  className="text-xs font-medium text-slate-600 hover:text-slate-900"
                >
                  Change number
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="rounded-md bg-[#0f4c81] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#0c3d68] disabled:opacity-60 whitespace-nowrap"
                >
                  {loading ? 'Verifying...' : 'Verify & Sign In'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
