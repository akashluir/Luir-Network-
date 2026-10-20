import React, { useState } from 'react';
import { Trophy, Flame, Cpu, Users, Crown } from 'lucide-react';
import { DashboardPayload, LeaderboardEntry } from '../types/nami.ts';

interface GlobalLeaderboardPanelProps {
  data: DashboardPayload;
  isDemoMode: boolean;
}

export const GlobalLeaderboardPanel: React.FC<GlobalLeaderboardPanelProps> = ({
  data,
  isDemoMode,
}) => {
  const [sortMetric, setSortMetric] = useState<'lifetime' | 'available'>('lifetime');

  const rawLeaderboard: LeaderboardEntry[] = data.leaderboard || [];
  const sortedTop10 = [...rawLeaderboard]
    .sort((a, b) =>
      sortMetric === 'lifetime'
        ? b.lifetimeEarned - a.lifetimeEarned
        : b.availablePoints - a.availablePoints
    )
    .slice(0, 10)
    .map((entry, idx) => ({
      ...entry,
      rank: idx + 1,
      isCurrentUser: entry.id === data.user.id || Boolean(entry.isCurrentUser),
    }));

  const userRank =
    sortedTop10.find((e) => e.isCurrentUser)?.rank || data.userGlobalRank || 1;

  return (
    <div className="rounded-3xl nami-glass p-6 sm:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Trophy className="w-4 h-4 text-orange-400" />
            <span>Global Operator Rankings</span>
            <span aria-hidden="true">·</span>
            <span>
              Your Rank:{' '}
              <strong className="font-mono-tabular text-orange-400">#{userRank}</strong>
            </span>
          </div>
          <h3 className="text-lg font-semibold text-white mt-0.5">
            Global Top 10 NAMI Points Leaderboard
            {isDemoMode ? ' (Demo Data)' : ''}
          </h3>
        </div>

        <div className="flex items-center gap-1 p-1 bg-white/[0.04] rounded-xl">
          <button
            type="button"
            onClick={() => setSortMetric('lifetime')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              sortMetric === 'lifetime'
                ? 'bg-orange-500 text-slate-950 font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Lifetime Earned
          </button>
          <button
            type="button"
            onClick={() => setSortMetric('available')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
              sortMetric === 'available'
                ? 'bg-orange-500 text-slate-950 font-semibold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Available Balance
          </button>
        </div>
      </div>

      {/* Top 3 Podium Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {sortedTop10.slice(0, 3).map((leader) => {
          const isFirst = leader.rank === 1;
          return (
            <div
              key={leader.id}
              className={`rounded-2xl p-5 border flex flex-col justify-between nami-card-3d ${
                leader.isCurrentUser
                  ? 'bg-orange-500/[0.12] border-orange-500/60'
                  : isFirst
                  ? 'bg-gradient-to-br from-orange-500/[0.10] via-[#151824] to-[#0d1018] border-orange-500/40'
                  : 'bg-white/[0.03] border-white/10'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-9 h-9 rounded-xl font-mono-tabular text-xs font-bold flex items-center justify-center shrink-0 ${
                      leader.rank === 1
                        ? 'bg-orange-500 text-slate-950 shadow-[0_0_16px_rgba(255,107,0,0.45)]'
                        : leader.rank === 2
                        ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                        : 'bg-white/10 text-slate-200 border border-white/15'
                    }`}
                  >
                    #{leader.rank}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-white truncate flex items-center gap-1.5">
                      <span>{leader.displayName}</span>
                      {leader.rank === 1 && (
                        <Crown className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                      )}
                    </div>
                    <div className="text-[11px] font-mono-tabular text-slate-400">
                      {leader.uid}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-3 border-t border-white/10 flex items-end justify-between gap-2">
                <div className="text-xs text-slate-400">
                  <span>Tier {leader.nodeLevel}</span>
                  <span className="mx-1" aria-hidden="true">·</span>
                  <span>{leader.streakDays}d Streak</span>
                </div>
                <div className="text-right">
                  <div className="text-base font-bold font-mono-tabular text-orange-400">
                    {(sortMetric === 'lifetime'
                      ? leader.lifetimeEarned
                      : leader.availablePoints
                    ).toLocaleString()}{' '}
                    <span className="text-[11px] font-normal text-slate-400">PTS</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Full Top 10 Leaderboard Table */}
      <div className="overflow-x-auto border border-white/10 rounded-2xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-white/10 bg-white/[0.02] text-xs text-slate-400">
              <th className="py-3 px-4 font-medium">Rank</th>
              <th className="py-3 px-4 font-medium">Operator</th>
              <th className="py-3 px-4 font-medium">Node Tier</th>
              <th className="py-3 px-4 font-medium">Streak</th>
              <th className="py-3 px-4 font-medium">Referrals</th>
              <th className="py-3 px-4 font-medium text-right">Available PTS</th>
              <th className="py-3 px-4 font-medium text-right">Lifetime Earned</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/10 text-xs">
            {sortedTop10.map((entry) => (
              <tr
                key={entry.id}
                className={`transition-colors ${
                  entry.isCurrentUser
                    ? 'bg-orange-500/[0.10] hover:bg-orange-500/[0.14]'
                    : 'hover:bg-white/[0.02]'
                }`}
              >
                <td className="py-3.5 px-4 font-mono-tabular font-bold">
                  <span
                    className={
                      entry.rank <= 3 ? 'text-orange-400' : 'text-slate-400'
                    }
                  >
                    #{String(entry.rank).padStart(2, '0')}
                  </span>
                </td>
                <td className="py-3.5 px-4">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">
                      {entry.displayName}
                    </span>
                    {entry.isCurrentUser && (
                      <span className="text-[11px] text-orange-400 font-medium">
                        (You)
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] font-mono-tabular text-slate-500">
                    {entry.uid}
                  </div>
                </td>
                <td className="py-3.5 px-4 text-slate-300">
                  <span className="inline-flex items-center gap-1">
                    <Cpu className="w-3.5 h-3.5 text-orange-400" />
                    <span>Tier {entry.nodeLevel}</span>
                  </span>
                </td>
                <td className="py-3.5 px-4 font-mono-tabular text-slate-300">
                  <span className="inline-flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5 text-orange-400" />
                    <span>{entry.streakDays}d</span>
                  </span>
                </td>
                <td className="py-3.5 px-4 font-mono-tabular text-slate-300">
                  <span className="inline-flex items-center gap-1">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <span>{entry.referralCount}</span>
                  </span>
                </td>
                <td className="py-3.5 px-4 font-mono-tabular text-right text-slate-200">
                  {entry.availablePoints.toLocaleString()} PTS
                </td>
                <td className="py-3.5 px-4 font-mono-tabular text-right font-bold text-orange-400">
                  {entry.lifetimeEarned.toLocaleString()} PTS
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
