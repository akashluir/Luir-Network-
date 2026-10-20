import React, { useState } from 'react';
import { X, ArrowUpRight, ArrowDownRight, ShieldCheck, Search } from 'lucide-react';
import { PointsTransaction, UserProfile } from '../types/nami.ts';
import { NamiLogoMark } from './IsometricNodeCore.tsx';

interface PointsWalletSheetProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile;
  transactions: PointsTransaction[];
  isDemoMode: boolean;
}

export const PointsWalletSheet: React.FC<PointsWalletSheetProps> = ({
  isOpen,
  onClose,
  user,
  transactions,
  isDemoMode,
}) => {
  const [filterType, setFilterType] = useState<'all' | 'node_run' | 'task_reward' | 'daily_checkin' | 'node_upgrade'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const filteredTx = transactions.filter((tx) => {
    const matchesCategory = filterType === 'all' || tx.type === filterType;
    const matchesQuery =
      !searchQuery.trim() ||
      tx.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tx.referenceId.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesQuery;
  });

  const formatDate = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-t-3xl sm:rounded-3xl nami-glass-elevated overflow-hidden">
        {/* Top Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <NamiLogoMark size="sm" />
            <div>
              <h2 className="text-lg font-semibold text-white">NAMI Points Internal Ledger</h2>
              <p className="text-xs text-slate-400">
                Internal ecosystem reward ledger · Separate from external cryptocurrency balances
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors"
            aria-label="Close Points Wallet"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {isDemoMode && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200">
              Showing Demo Preview Ledger. Sign in to view and earn persistent server-verified NAMI Points.
            </div>
          )}

          {/* 3-Column Wallet Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10">
              <div className="text-xs text-slate-400">Available NAMI Points</div>
              <div className="mt-1 text-2xl font-bold font-mono-tabular text-orange-400">
                {user.availablePoints.toLocaleString()} <span className="text-xs font-normal text-slate-400">PTS</span>
              </div>
              <div className="mt-1 text-xs text-slate-500">Ready for node upgrades</div>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10">
              <div className="text-xs text-slate-400">Total Points Earned</div>
              <div className="mt-1 text-2xl font-bold font-mono-tabular text-white">
                {user.lifetimeEarned.toLocaleString()} <span className="text-xs font-normal text-slate-400">PTS</span>
              </div>
              <div className="mt-1 text-xs text-slate-500">Verified cumulative rewards</div>
            </div>

            <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10">
              <div className="text-xs text-slate-400">Points Spent on Upgrades</div>
              <div className="mt-1 text-2xl font-bold font-mono-tabular text-slate-200">
                {user.pointsSpent.toLocaleString()} <span className="text-xs font-normal text-slate-400">PTS</span>
              </div>
              <div className="mt-1 text-xs text-slate-500">Invested in Node Tier {user.nodeLevel}</div>
            </div>
          </div>

          {/* Compliance Note */}
          <div className="flex items-start gap-3 p-3.5 rounded-xl bg-white/[0.02] border border-white/10 text-xs text-slate-400">
            <ShieldCheck className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
            <span>
              NAMI Points are internal reward points tracked in the server-verified NAMI Ledger for account progression and node tier upgrades. They are distinct from on-chain AMI cryptocurrency tokens.
            </span>
          </div>

          {/* Filter & Search Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1 p-1 bg-white/[0.04] rounded-xl overflow-x-auto">
              {(
                [
                  { id: 'all', label: 'All Entries' },
                  { id: 'node_run', label: 'Node Run' },
                  { id: 'task_reward', label: 'Tasks' },
                  { id: 'daily_checkin', label: 'Check-In' },
                  { id: 'node_upgrade', label: 'Upgrades' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilterType(tab.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                    filterType === tab.id
                      ? 'bg-orange-500 text-slate-950 font-semibold'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search reference or activity..."
                className="w-full sm:w-56 pl-9 pr-3 py-2 text-xs rounded-xl bg-white/[0.04] border border-white/10 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500/60"
              />
            </div>
          </div>

          {/* Complete Transaction History List */}
          <div className="border border-white/10 rounded-2xl divide-y divide-white/10 overflow-hidden">
            {filteredTx.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-400">
                No ledger transactions match the current filter.
              </div>
            ) : (
              filteredTx.map((tx) => {
                const isPositive = tx.amount >= 0;
                return (
                  <div
                    key={tx.id}
                    className="flex items-center justify-between gap-4 px-4 py-3.5 bg-white/[0.01] hover:bg-white/[0.03] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                          isPositive
                            ? 'bg-orange-500/15 text-orange-400'
                            : 'bg-slate-800 text-slate-300'
                        }`}
                      >
                        {isPositive ? (
                          <ArrowUpRight className="w-4 h-4" />
                        ) : (
                          <ArrowDownRight className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-white truncate">{tx.title}</div>
                        <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5">
                          <span className="font-mono-tabular">{formatDate(tx.createdAt)}</span>
                          <span aria-hidden="true">·</span>
                          <span>Status: {tx.status}</span>
                          <span aria-hidden="true">·</span>
                          <span className="font-mono-tabular text-slate-500">Ref: {tx.referenceId}</span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div
                        className={`text-sm font-semibold font-mono-tabular ${
                          isPositive ? 'text-orange-400' : 'text-slate-300'
                        }`}
                      >
                        {isPositive ? `+${tx.amount.toLocaleString()}` : tx.amount.toLocaleString()} PTS
                      </div>
                      <div className="text-xs font-mono-tabular text-slate-500">
                        Bal: {tx.balanceAfter.toLocaleString()}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
