import React, { useState } from 'react';
import { LogOut, ShieldCheck, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { GoogleSignInButton } from './GoogleSignInButton';

interface CitizenAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CitizenAuthModal: React.FC<CitizenAuthModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { session, signInWithGoogle, signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGoogleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Google Sign-In popup was cancelled or blocked.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="citizen-auth-title"
    >
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-5 w-5 text-[#0f4c81]" />
            <h2 id="citizen-auth-title" className="text-base font-semibold text-slate-900">
              Citizen Identity & Account
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

        <div className="p-6 space-y-4">
          {session?.authenticated ? (
            <>
              <div className="rounded-md border border-emerald-200 bg-emerald-50/70 p-4 space-y-1.5">
                <p className="text-xs font-semibold text-emerald-800">
                  Verified Google Identity
                </p>
                <p className="text-base font-semibold text-slate-900">{session.name}</p>
                <p className="font-mono text-xs text-slate-600">{session.email}</p>
                <p className="text-xs text-slate-600">
                  Authority Tier:{' '}
                  <strong className="uppercase font-mono text-slate-900">
                    {session.role ?? 'citizen'}
                  </strong>
                </p>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Authenticated via Firebase Auth with Cloud SQL PostgreSQL persistence and
                Firestore workspace sync.
              </p>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={async () => {
                    await signOut();
                    onClose();
                  }}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md bg-[#0f4c81] px-4 py-2 text-sm font-medium text-white hover:bg-[#0c3d68]"
                >
                  Continue
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-slate-600 leading-relaxed">
                Sign in with your Google account to submit persistent civic reports to Cloud
                SQL, sync bookmarked wards in Firestore, and reconcile offline CEMN emergency
                mesh logs.
              </p>

              {error && (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                  {error}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <GoogleSignInButton
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  label={loading ? 'Signing In...' : 'Sign in with Google'}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
