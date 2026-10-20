import React, { useState } from 'react';
import {
  Award,
  Flame,
  Cpu,
  ShieldCheck,
  Zap,
  Crown,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { DashboardPayload } from '../types/nami.ts';

interface AchievementsPanelProps {
  data: DashboardPayload;
  compact?: boolean;
}

export interface AchievementBadge {
  id: string;
  title: string;
  subtitle: string;
  requirementText: string;
  pointsMilestone: number;
  currentValue: number;
  targetValue: number;
  unitLabel: string;
  unlocked: boolean;
  iconType: 'early' | 'pioneer' | 'streak' | 'validator' | 'centurion' | 'genesis';
  tierTag: string;
}

export const AchievementsPanel: React.FC<AchievementsPanelProps> = ({
  data,
  compact = false,
}) => {
  const { user, nodeHistory } = data;
  const [filter, setFilter] = useState<'all' | 'unlocked' | 'locked'>('all');

  const completedSessionsCount = nodeHistory.filter((s) => s.status === 'completed').length;

  const achievements: AchievementBadge[] = [
    {
      id: 'ach-early-adopter',
      title: 'Early Adopter',
      subtitle: 'Activated a NAMI WALLET operator identity and earned your first 100 NAMI Points.',
      requirementText: 'Reach 100+ Lifetime NAMI Points',
      pointsMilestone: 100,
      currentValue: Math.min(100, user.lifetimeEarned),
      targetValue: 100,
      unitLabel: 'PTS',
      unlocked: user.lifetimeEarned >= 100,
      iconType: 'early',
      tierTag: 'Milestone I',
    },
    {
      id: 'ach-node-pioneer',
      title: 'Node Pioneer',
      subtitle: 'Completed verified Node Run telemetry cycles and crossed 500 lifetime points.',
      requirementText: '500+ Lifetime Points & 1+ Verified Session',
      pointsMilestone: 500,
      currentValue: Math.min(500, user.lifetimeEarned),
      targetValue: 500,
      unitLabel: 'PTS',
      unlocked: user.lifetimeEarned >= 500 && completedSessionsCount >= 1,
      iconType: 'pioneer',
      tierTag: 'Milestone II',
    },
    {
      id: 'ach-streak-master',
      title: 'Streak Master',
      subtitle: 'Maintained a 5-day operator check-in streak while accumulating 1,000+ NAMI Points.',
      requirementText: '5-Day Streak & 1,000+ Lifetime Points',
      pointsMilestone: 1000,
      currentValue: Math.min(5, user.streakDays),
      targetValue: 5,
      unitLabel: 'Days',
      unlocked: user.streakDays >= 5 && user.lifetimeEarned >= 1000,
      iconType: 'streak',
      tierTag: 'Milestone III',
    },
    {
      id: 'ach-flux-validator',
      title: 'Flux Validator',
      subtitle: 'Upgraded hardware to Tier 2 Flux Validator and earned 1,500+ NAMI Points.',
      requirementText: 'Tier 2+ Node & 1,500+ Lifetime Points',
      pointsMilestone: 1500,
      currentValue: Math.min(1500, user.lifetimeEarned),
      targetValue: 1500,
      unitLabel: 'PTS',
      unlocked: user.nodeLevel >= 2 && user.lifetimeEarned >= 1500,
      iconType: 'validator',
      tierTag: 'Milestone IV',
    },
    {
      id: 'ach-point-centurion',
      title: 'Point Centurion',
      subtitle: 'Accumulated 2,500+ verified NAMI Points in the internal reward ledger.',
      requirementText: 'Reach 2,500+ Lifetime NAMI Points',
      pointsMilestone: 2500,
      currentValue: Math.min(2500, user.lifetimeEarned),
      targetValue: 2500,
      unitLabel: 'PTS',
      unlocked: user.lifetimeEarned >= 2500,
      iconType: 'centurion',
      tierTag: 'Milestone V',
    },
    {
      id: 'ach-genesis-overlord',
      title: 'Genesis Mainframe',
      subtitle: 'Reached Tier 4 NAMI Genesis Mainframe and 5,000+ lifetime NAMI Points.',
      requirementText: 'Tier 4 Node & 5,000+ Lifetime Points',
      pointsMilestone: 5000,
      currentValue: Math.min(5000, user.lifetimeEarned),
      targetValue: 5000,
      unitLabel: 'PTS',
      unlocked: user.nodeLevel >= 4 && user.lifetimeEarned >= 5000,
      iconType: 'genesis',
      tierTag: 'Milestone VI',
    },
  ];

  const unlockedCount = achievements.filter((a) => a.unlocked).length;

  const filteredList = achievements.filter((a) => {
    if (filter === 'unlocked') return a.unlocked;
    if (filter === 'locked') return !a.unlocked;
    return true;
  });

  const renderBadgeIcon = (type: AchievementBadge['iconType'], unlocked: boolean) => {
    const colorClass = unlocked ? 'text-orange-400' : 'text-slate-500';
    switch (type) {
      case 'early':
        return <Zap className={`w-5 h-5 ${colorClass}`} />;
      case 'pioneer':
        return <Cpu className={`w-5 h-5 ${colorClass}`} />;
      case 'streak':
        return <Flame className={`w-5 h-5 ${colorClass}`} />;
      case 'validator':
        return <ShieldCheck className={`w-5 h-5 ${colorClass}`} />;
      case 'centurion':
        return <Award className={`w-5 h-5 ${colorClass}`} />;
      case 'genesis':
        return <Crown className={`w-5 h-5 ${colorClass}`} />;
    }
  };

  return (
    <div className="rounded-3xl nami-glass p-6 sm:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Award className="w-4 h-4 text-orange-400" />
            <span>Operator Recognition</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tabular text-orange-400">
              {unlockedCount}/{achievements.length} Badges Unlocked
            </span>
          </div>
          <h3 className="text-lg font-semibold text-white mt-0.5">
            NAMI Points Milestone Achievements
          </h3>
        </div>

        {!compact && (
          <div className="flex items-center gap-1 p-1 bg-white/[0.04] rounded-xl">
            {(
              [
                { id: 'all', label: `All (${achievements.length})` },
                { id: 'unlocked', label: `Unlocked (${unlockedCount})` },
                {
                  id: 'locked',
                  label: `In Progress (${achievements.length - unlockedCount})`,
                },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  filter === tab.id
                    ? 'bg-orange-500 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredList.map((badge) => {
          const pct = Math.min(
            100,
            Math.round((badge.currentValue / Math.max(1, badge.targetValue)) * 100)
          );

          return (
            <div
              key={badge.id}
              className={`rounded-2xl p-5 flex flex-col justify-between border transition-all nami-card-3d ${
                badge.unlocked
                  ? 'bg-gradient-to-br from-orange-500/[0.11] via-[#141722] to-[#0d1018] border-orange-500/45 shadow-[0_0_24px_-6px_rgba(255,107,0,0.22)]'
                  : 'bg-white/[0.02] border-white/10 opacity-85'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-3">
                  <div
                    className={`w-11 h-11 rounded-2xl flex items-center justify-center border shrink-0 ${
                      badge.unlocked
                        ? 'bg-orange-500/20 border-orange-500/40'
                        : 'bg-white/[0.04] border-white/10'
                    }`}
                  >
                    {renderBadgeIcon(badge.iconType, badge.unlocked)}
                  </div>

                  <div className="text-right">
                    <div className="text-xs text-slate-400">
                      <span>{badge.tierTag}</span>
                      <span className="mx-1" aria-hidden="true">·</span>
                      <span
                        className={
                          badge.unlocked ? 'text-orange-400 font-semibold' : 'text-slate-500'
                        }
                      >
                        {badge.unlocked ? 'Unlocked' : 'Locked'}
                      </span>
                    </div>
                    <div className="text-xs font-mono-tabular text-slate-300 mt-0.5">
                      {badge.pointsMilestone.toLocaleString()} PTS Tier
                    </div>
                  </div>
                </div>

                <h4 className="mt-3.5 text-base font-bold text-white flex items-center gap-2">
                  <span>{badge.title}</span>
                  {badge.unlocked ? (
                    <CheckCircle2 className="w-4 h-4 text-orange-400 shrink-0" />
                  ) : (
                    <Lock className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  )}
                </h4>
                <p className="mt-1 text-xs text-slate-400 leading-relaxed">
                  {badge.subtitle}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-white/10 space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-400 truncate pr-2">
                    {badge.requirementText}
                  </span>
                  <span className="font-mono-tabular text-slate-200 shrink-0">
                    {badge.currentValue.toLocaleString()}/{badge.targetValue.toLocaleString()}{' '}
                    {badge.unitLabel}
                  </span>
                </div>
                <div className="w-full h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      badge.unlocked
                        ? 'bg-gradient-to-r from-orange-500 to-amber-400'
                        : 'bg-slate-600'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
