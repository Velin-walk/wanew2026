import React, { useState } from 'react';
import { X, ShieldCheck, Compass, Sparkles, User, AlertTriangle, Copy, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const AuthModal: React.FC = () => {
  const { authModalOpen, authModalReason, closeAuthModal, signInWithGoogle, signInWithDevAccount } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [isUnauthorizedDomain, setIsUnauthorizedDomain] = useState(false);
  const [copiedDomain, setCopiedDomain] = useState(false);
  const [fallbackEmail, setFallbackEmail] = useState('');
  const [fallbackName, setFallbackName] = useState('');

  if (!authModalOpen) return null;

  const handleGoogleSignIn = async () => {
    try {
      setLoading(true);
      setError('');
      setIsUnauthorizedDomain(false);
      await signInWithGoogle();
    } catch (err: any) {
      console.warn('Google Auth notice:', err?.code || err?.message || err);
      const isDomainErr =
        err?.code === 'auth/unauthorized-domain' ||
        (err?.message && err.message.includes('unauthorized-domain'));

      if (isDomainErr) {
        setIsUnauthorizedDomain(true);
        if (!fallbackEmail && authModalReason.toLowerCase().includes('admin')) {
          setFallbackEmail('walknepalwalk@gmail.com');
          setFallbackName('WNW Admin');
        }
        setError(`Firebase Auth: The domain "${window.location.hostname}" is not authorized in your Firebase console settings.`);
      } else {
        setError(err.message || 'Failed to sign in with Google');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFallbackSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = fallbackEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setError('Please enter a valid email address.');
      return;
    }
    signInWithDevAccount(
      cleanEmail,
      fallbackName.trim() || cleanEmail.split('@')[0]
    );
  };

  // Determine modal icon and header color based on context
  let icon = <Sparkles className="w-6 h-6 text-[#E08828]" />;
  let badgeText = 'Sign In to Continue';
  let badgeBg = 'bg-[#E08828]/10 text-[#E08828] border-[#E08828]/20';

  if (authModalReason.toLowerCase().includes('admin')) {
    icon = <ShieldCheck className="w-6 h-6 text-[#E08828]" />;
    badgeText = 'Admin Access Required';
    badgeBg = 'bg-amber-100 text-[#E08828] border-amber-200';
  } else if (authModalReason.toLowerCase().includes('map miners') || authModalReason.toLowerCase().includes('trail')) {
    icon = <Compass className="w-6 h-6 text-[#7ABA42]" />;
    badgeText = 'Map Miners Community';
    badgeBg = 'bg-[#7ABA42]/10 text-[#7ABA42] border-[#7ABA42]/20';
  } else if (authModalReason.toLowerCase().includes('booking') || authModalReason.toLowerCase().includes('register')) {
    icon = <User className="w-6 h-6 text-[#E08828]" />;
    badgeText = 'Hiker Account';
    badgeBg = 'bg-orange-100 text-[#E08828] border-orange-200';
  }

  const currentHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl border border-[#EFEAE4] overflow-hidden flex flex-col">
        {/* Header decoration */}
        <div className="bg-gradient-to-r from-[#FAF6F0] via-white to-[#FAF6F0] p-6 text-center border-b border-[#EFEAE4] relative">
          <button
            type="button"
            onClick={closeAuthModal}
            className="absolute top-4 right-4 p-2 text-[#8B8680] hover:text-[#1F1F1F] hover:bg-black/5 rounded-full transition-colors cursor-pointer"
            aria-label="Close auth dialog"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="w-12 h-12 mx-auto rounded-2xl bg-white border border-[#E5E1DB] p-2 flex items-center justify-center shadow-xs mb-3">
            {icon}
          </div>

          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border mb-2 ${badgeBg}`}>
            <span>{badgeText}</span>
          </div>

          <h3 className="text-xl font-extrabold text-[#1F1F1F] tracking-tight">
            Welcome to Walk Nepal Walk
          </h3>
          <p className="text-xs text-[#8B8680] mt-1 max-w-xs mx-auto">
            {authModalReason || 'Sign in with Google to sync bookings, map uploads, and admin access across all screens.'}
          </p>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-center">
          {/* Unauthorized Domain Callout */}
          {isUnauthorizedDomain && (
            <div className="p-4 bg-amber-50 border border-amber-300 rounded-2xl text-left space-y-2.5">
              <div className="flex items-center gap-2 text-amber-900 font-extrabold text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>Unauthorized Firebase Domain</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Google Auth popup requires adding your domain <strong className="font-bold underline">{currentHost}</strong> to your Firebase Console under <em>Authentication &gt; Settings &gt; Authorized Domains</em>.
              </p>
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(currentHost);
                  setCopiedDomain(true);
                  setTimeout(() => setCopiedDomain(false), 2000);
                }}
                className="w-full py-2 px-3 bg-white border border-amber-300 rounded-xl text-amber-900 font-bold text-xs flex items-center justify-center gap-1.5 hover:bg-amber-100 transition-colors cursor-pointer shadow-2xs"
              >
                {copiedDomain ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-amber-700" />}
                <span>{copiedDomain ? 'Domain Copied!' : `Copy Hostname (${currentHost})`}</span>
              </button>

              <form onSubmit={handleFallbackSignIn} className="pt-2 border-t border-amber-200/80 space-y-2">
                <p className="text-[11px] font-bold text-amber-950">
                  Or continue in preview mode with your email:
                </p>
                <input
                  type="email"
                  value={fallbackEmail}
                  onChange={(e) => setFallbackEmail(e.target.value)}
                  placeholder="Enter your email (e.g. walknepalwalk@gmail.com)"
                  className="w-full px-3 py-2 bg-white border border-amber-300 rounded-xl text-xs font-semibold text-[#1F1F1F] focus:outline-none focus:border-[#E08828]"
                  required
                />
                <button
                  type="submit"
                  className="w-full py-2 px-3 bg-[#E08828] hover:bg-[#cc781f] text-white font-bold text-xs rounded-xl transition-colors cursor-pointer shadow-xs"
                >
                  Continue with Email
                </button>
              </form>
            </div>
          )}

          {error && !isUnauthorizedDomain && (
            <div className="p-3 text-xs font-semibold text-rose-700 bg-rose-50 border border-rose-200 rounded-xl text-left">
              {error}
            </div>
          )}

          {/* Google Sign-In */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full min-h-[50px] px-5 py-3 bg-white hover:bg-[#F9F7F5] border border-[#D8D2C9] text-[#1F1F1F] font-extrabold text-sm rounded-2xl shadow-xs hover:shadow-md transition-all flex items-center justify-center gap-3 cursor-pointer active:scale-[0.99]"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>{loading ? 'Signing in with Google...' : 'Sign In with Google'}</span>
          </button>

          <p className="text-[10px] text-[#8B8680] leading-relaxed pt-1">
            One-click authentication powered by Google &amp; Firebase Auth.
          </p>
        </div>
      </div>
    </div>
  );
};
