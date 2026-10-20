import React, { useState } from 'react';
import {
  UserPlus,
  Copy,
  Check,
  Link2,
  Gift,
  Users,
  ArrowRight,
} from 'lucide-react';
import { DashboardPayload } from '../types/nami.ts';

interface ReferralSystemPanelProps {
  data: DashboardPayload;
  isDemoMode: boolean;
  onRegisterReferredFriend: (friendName: string, friendEmail: string) => Promise<void>;
  busy: boolean;
}

export const ReferralSystemPanel: React.FC<ReferralSystemPanelProps> = ({
  data,
  isDemoMode,
  onRegisterReferredFriend,
  busy,
}) => {
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [friendName, setFriendName] = useState('');
  const [friendEmail, setFriendEmail] = useState('');

  const referralCode =
    data.referrals?.referralCode || data.user.referralCode || data.user.uid;
  const referralCount =
    data.referrals?.referralCount ?? data.user.referralCount ?? 0;
  const referralPointsEarned =
    data.referrals?.referralPointsEarned ?? data.user.referralPointsEarned ?? 0;
  const bonusPerInvite = data.referrals?.bonusPerInvite ?? 250;
  const referredUsers = data.referrals?.referredUsers || [];

  const origin =
    typeof window !== 'undefined' ? window.location.origin : 'https://namiwallet.io';
  const inviteLink = `${origin}/?ref=${encodeURIComponent(referralCode)}`;

  const handleCopyLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(inviteLink);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  const handleCopyCode = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(referralCode);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2500);
    }
  };

  const handleSubmitInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!friendName.trim() || !friendEmail.trim()) return;
    await onRegisterReferredFriend(friendName.trim(), friendEmail.trim());
    setFriendName('');
    setFriendEmail('');
  };

  return (
    <div className="rounded-3xl nami-glass p-6 sm:p-8 space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Gift className="w-4 h-4 text-orange-400" />
            <span>Operator Referral Network</span>
            <span aria-hidden="true">·</span>
            <span className="text-orange-400 font-semibold">
              +{bonusPerInvite} NAMI PTS per Friend
            </span>
          </div>
          <h3 className="text-lg font-semibold text-white mt-0.5">
            Invite Friends & Earn Bonus NAMI Points
          </h3>
          <p className="text-xs text-slate-400 mt-1">
            Share your unique referral invite link. When a friend signs up using your link or referral code, you earn +{bonusPerInvite} NAMI Points and your friend receives +150 Welcome Points.
          </p>
        </div>

        {/* Referral KPIs */}
        <div className="flex items-center gap-6 shrink-0 border-t lg:border-t-0 pt-4 lg:pt-0 border-white/10">
          <div>
            <div className="text-xs text-slate-400">Invited Friends</div>
            <div className="text-2xl font-bold font-mono-tabular text-white mt-0.5">
              {referralCount}
            </div>
          </div>
          <div className="h-10 w-px bg-white/10" />
          <div>
            <div className="text-xs text-slate-400">Referral Bonus Earned</div>
            <div className="text-2xl font-bold font-mono-tabular text-orange-400 mt-0.5">
              +{referralPointsEarned.toLocaleString()} PTS
            </div>
          </div>
        </div>
      </div>

      {/* Invite Link & Code Copy Box + Direct Friend Invite Registration */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: Unique Invite Link & Code */}
        <div className="lg:col-span-7 p-5 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div>
              <label className="block text-xs text-slate-400 mb-1.5">
                Your Unique Referral Invite Link
              </label>
              <div className="flex items-center gap-2">
                <div className="flex-1 flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-[#0b0d14] border border-white/10 min-w-0">
                  <Link2 className="w-4 h-4 text-orange-400 shrink-0" />
                  <span className="text-xs font-mono-tabular text-slate-200 truncate">
                    {inviteLink}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="min-h-[42px] px-4 py-2 rounded-xl nami-btn-glow text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-3.5 h-3.5" />
                      <span>Copied Link</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Invite Link</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="text-xs text-slate-400">
                Referral Code:{' '}
                <strong className="font-mono-tabular text-white">{referralCode}</strong>
              </div>
              <button
                type="button"
                onClick={handleCopyCode}
                className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1 font-medium"
              >
                {copiedCode ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Code Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy Code Only</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Referred Users List */}
          <div className="pt-3 border-t border-white/10">
            <div className="text-xs font-medium text-slate-300 mb-2 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-orange-400" />
              <span>Recently Referred Operators ({referredUsers.length})</span>
            </div>
            {referredUsers.length === 0 ? (
              <div className="text-xs text-slate-500">
                No referred friends registered yet. Share your link or register an invited friend on the right.
              </div>
            ) : (
              <div className="space-y-1.5 max-h-28 overflow-y-auto pr-1">
                {referredUsers.map((ru) => (
                  <div
                    key={ru.id}
                    className="flex items-center justify-between text-xs py-1.5 px-3 rounded-lg bg-white/[0.02] border border-white/5"
                  >
                    <div className="truncate">
                      <span className="font-medium text-white">{ru.displayName}</span>
                      <span className="mx-1.5 text-slate-600" aria-hidden="true">·</span>
                      <span className="font-mono-tabular text-slate-400">{ru.uid}</span>
                    </div>
                    <span className="font-mono-tabular font-semibold text-orange-400 shrink-0">
                      +{ru.bonusAwarded} PTS
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: Instant Friend Referral Registration Form */}
        <div className="lg:col-span-5 p-5 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-white">
              <UserPlus className="w-4 h-4 text-orange-400" />
              <span>Register Invited Friend (+{bonusPerInvite} PTS)</span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Onboard a friend directly with your referral code ({referralCode}) to credit +{bonusPerInvite} NAMI Points to your internal ledger.
            </p>

            <form onSubmit={handleSubmitInvite} className="mt-4 space-y-3">
              <div>
                <input
                  type="text"
                  required
                  value={friendName}
                  onChange={(e) => setFriendName(e.target.value)}
                  disabled={isDemoMode || busy}
                  placeholder="Friend's Display Name (e.g. Elena Rostova)"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-[#0b0d14] border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 disabled:opacity-50"
                />
              </div>
              <div>
                <input
                  type="email"
                  required
                  value={friendEmail}
                  onChange={(e) => setFriendEmail(e.target.value)}
                  disabled={isDemoMode || busy}
                  placeholder="Friend's Email (e.g. elena@namiwallet.io)"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-[#0b0d14] border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500 disabled:opacity-50"
                />
              </div>
              <button
                type="submit"
                disabled={isDemoMode || busy}
                className="w-full min-h-[42px] px-4 py-2.5 rounded-xl nami-btn-glow text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-40 whitespace-nowrap shrink-0"
              >
                <span>
                  {busy
                    ? 'Verifying Referral...'
                    : `Complete Friend Sign-Up (+${bonusPerInvite} PTS)`}
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};
