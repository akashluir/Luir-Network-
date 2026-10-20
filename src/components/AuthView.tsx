import React, { useState, useEffect } from 'react';
import { ShieldCheck, Lock, Mail, User, ArrowRight, Eye, Gift } from 'lucide-react';
import { NamiLogoMark } from './IsometricNodeCore.tsx';
import { UserProfile } from '../types/nami.ts';

interface AuthViewProps {
  onAuthSuccess: (user: UserProfile, token: string) => void;
  onEnterDemoPreview: () => void;
}

export const AuthView: React.FC<AuthViewProps> = ({ onAuthSuccess, onEnterDemoPreview }) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const refParam = params.get('ref');
      if (refParam) {
        setReferralCode(refParam.trim().toUpperCase());
        setMode('signup');
      }
    } catch {
      // Ignore URL parsing issues
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const endpoint = mode === 'login' ? '/api/auth/login' : '/api/auth/signup';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          displayName,
          referralCode: mode === 'signup' ? referralCode : undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }
      onAuthSuccess(data.user, data.token);
    } catch (err: any) {
      setError(err.message || 'Could not authenticate.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickPreset = async (preset: 'demo' | 'admin') => {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quickPreset: preset }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Quick login failed');
      }
      onAuthSuccess(data.user, data.token);
    } catch (err: any) {
      setError(err.message || 'Quick login failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#07080c] text-slate-100 flex flex-col justify-center items-center px-4 py-12 relative overflow-hidden">
      {/* Subtle Ambient Orange Glow */}
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[520px] h-[520px] rounded-full bg-orange-500/15 blur-[130px] pointer-events-none" />

      <div className="w-full max-w-5xl grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch relative z-10">
        {/* Left Column: Futuristic 3D Brand Showcase */}
        <div className="lg:col-span-6 rounded-3xl nami-glass-elevated p-8 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-3.5">
              <NamiLogoMark size="lg" />
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-white">NAMI WALLET</h1>
                <p className="text-xs text-slate-400">
                  Node Run Points System · Internal Reward Ledger
                </p>
              </div>
            </div>

            <h2 className="mt-8 text-3xl sm:text-4xl font-bold text-white leading-tight">
              Run Verified Nodes. Complete Ecosystem Tasks. Earn NAMI Points.
            </h2>
            <p className="mt-4 text-sm text-slate-300 leading-relaxed">
              Experience a futuristic Web3-style dashboard with server-verified Node Run sessions, atomic points accounting, global leaderboards, and referral rewards.
            </p>
          </div>

          <div className="mt-8 pt-6 border-t border-white/10 space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-xs text-slate-400">Verification</div>
                <div className="mt-0.5 text-sm font-semibold text-white">Server Atomic</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Node Tiers</div>
                <div className="mt-0.5 text-sm font-semibold font-mono-tabular text-orange-400">Up to 3.5x</div>
              </div>
              <div>
                <div className="text-xs text-slate-400">Invite Bonus</div>
                <div className="mt-0.5 text-sm font-semibold font-mono-tabular text-orange-400">+250 PTS</div>
              </div>
            </div>

            <p className="text-xs text-slate-400">
              NAMI Points are internal reward points credited to your authenticated NAMI WALLET profile and are separate from external cryptocurrency balances.
            </p>
          </div>
        </div>

        {/* Right Column: Auth Card */}
        <div className="lg:col-span-6 rounded-3xl nami-glass p-8 flex flex-col justify-between">
          <div>
            {/* Mode Switcher */}
            <div className="flex items-center gap-1 p-1 bg-white/[0.04] rounded-xl mb-6">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setError(null);
                }}
                className={`flex-1 py-2.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  mode === 'login'
                    ? 'bg-orange-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Sign In to Account
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setError(null);
                }}
                className={`flex-1 py-2.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  mode === 'signup'
                    ? 'bg-orange-500 text-slate-950'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Create New Wallet Account
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3.5 rounded-xl bg-red-500/15 border border-red-500/30 text-xs text-red-200">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === 'signup' && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Operator Display Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      required
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="e.g. Aria Solaris"
                      className="w-full pl-10 pr-4 py-3 text-sm rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="operator@namiwallet.io"
                    className="w-full pl-10 pr-4 py-3 text-sm rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full pl-10 pr-4 py-3 text-sm rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                  />
                </div>
              </div>

              {mode === 'signup' && (
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">
                    Referral Invite Code (Optional · +150 Welcome PTS)
                  </label>
                  <div className="relative">
                    <Gift className="w-4 h-4 text-orange-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={referralCode}
                      onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                      placeholder="e.g. NAMI-01AD-99FF"
                      className="w-full pl-10 pr-4 py-2.5 text-sm font-mono-tabular rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full min-h-[48px] px-5 py-3 rounded-xl font-semibold text-sm nami-btn-glow flex items-center justify-center gap-2 disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                <span>
                  {loading
                    ? 'Authenticating...'
                    : mode === 'login'
                    ? 'Sign In to NAMI WALLET'
                    : referralCode
                    ? 'Create Account & Claim +150 Referral PTS'
                    : 'Create Account & Claim +100 PTS'}
                </span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>
          </div>

          {/* Instant Test & Demo Options */}
          <div className="mt-6 pt-6 border-t border-white/10 space-y-3">
            <div className="text-xs text-slate-400">Instant Authenticated Access & Demo Preview</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={loading}
                onClick={() => handleQuickPreset('demo')}
                className="min-h-[44px] px-3.5 py-2.5 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs font-medium text-slate-200 flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0"
              >
                <ShieldCheck className="w-4 h-4 text-orange-400" />
                <span>Login as Operator</span>
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={() => handleQuickPreset('admin')}
                className="min-h-[44px] px-3.5 py-2.5 rounded-xl bg-orange-500/10 hover:bg-orange-500/20 border border-orange-500/30 text-xs font-medium text-orange-300 flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0"
              >
                <ShieldCheck className="w-4 h-4 text-orange-400" />
                <span>Login as Admin</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onEnterDemoPreview}
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-transparent hover:bg-white/[0.04] border border-white/10 text-xs text-slate-400 hover:text-white flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0"
            >
              <Eye className="w-4 h-4" />
              <span>Preview Dashboard with Clearly Labeled Demo Data</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
