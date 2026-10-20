import React, { useState } from 'react';
import {
  Play,
  Square,
  CheckCircle2,
  ArrowUpCircle,
  Flame,
  ShieldCheck,
  CalendarCheck,
  AlertCircle,
  Zap,
} from 'lucide-react';
import { DashboardPayload, formatDurationCompact, formatClockTimer } from '../types/nami.ts';
import { NodeReactor3D } from './IsometricNodeCore.tsx';
import { NodeDiagnosticsPanel } from './NodeDiagnosticsPanel.tsx';
import { NodePowerGaugePanel } from './NodePowerGaugePanel.tsx';

interface NodeRunViewProps {
  data: DashboardPayload;
  isDemoMode: boolean;
  remainingSessionSec: number;
  progressPercent: number;
  cooldownSec: number;
  boostRemainingSec: number;
  onStartNodeRun: () => Promise<void>;
  onStopOrClaimNodeRun: (mode: 'claim' | 'stop') => Promise<void>;
  onUpgradeNode: (targetLevel: number) => Promise<void>;
  onClaimDailyCheckIn: () => Promise<void>;
  onNamiBoostAction: (action: 'activate' | 'toggle') => Promise<void>;
  busyAction: string | null;
}

const NAMI_BOOST_COST = 250;

export const NodeRunView: React.FC<NodeRunViewProps> = ({
  data,
  isDemoMode,
  remainingSessionSec,
  progressPercent,
  cooldownSec,
  boostRemainingSec,
  onStartNodeRun,
  onStopOrClaimNodeRun,
  onUpgradeNode,
  onClaimDailyCheckIn,
  onNamiBoostAction,
  busyAction,
}) => {
  const { user, stats, activeSession, nodeHistory, config } = data;
  const [lastCompletedToast, setLastCompletedToast] = useState<string | null>(null);

  const currentTier =
    config.nodeTiers.find((t) => t.level === user.nodeLevel) || config.nodeTiers[0];
  const streakBonus = Math.min(user.streakDays * 5, 50);

  const hasUnexpiredBoostPass = boostRemainingSec > 0;
  const isNamiBoostActive = Boolean(hasUnexpiredBoostPass && user.namiBoostEnabled);
  const effectiveMultiplier = isNamiBoostActive
    ? currentTier.multiplier * 2
    : currentTier.multiplier;

  const expectedSessionReward = Math.round(
    config.basePointsPerSession * effectiveMultiplier + streakBonus
  );

  // Determine exact Node Status: Active, Completed, or Inactive
  const isSessionActive = Boolean(activeSession && activeSession.status === 'active');
  const isReadyToClaim = isSessionActive && remainingSessionSec <= 0;

  let displayStatus: 'Active' | 'Completed' | 'Inactive' = 'Inactive';
  if (isReadyToClaim) {
    displayStatus = 'Completed';
  } else if (isSessionActive) {
    displayStatus = 'Active';
  } else if (nodeHistory.length > 0 && nodeHistory[0].status === 'completed' && cooldownSec > 0) {
    displayStatus = 'Completed';
  }

  const dailyProgressPct = Math.min(
    100,
    Math.round((stats.todayEarned / Math.max(1, stats.effectiveDailyCap)) * 100)
  );

  const handleClaim = async () => {
    await onStopOrClaimNodeRun('claim');
    setLastCompletedToast(`Verified Node Run reward credited to your internal NAMI Points ledger.`);
    setTimeout(() => setLastCompletedToast(null), 5000);
  };

  const handleBoostToggleClick = async () => {
    if (hasUnexpiredBoostPass) {
      await onNamiBoostAction('toggle');
    } else {
      await onNamiBoostAction('activate');
    }
  };

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleString(undefined, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-8">
      {config.campaignPaused && (
        <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center gap-3 text-xs text-amber-200">
          <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
          <span>
            Reward distribution campaign is temporarily paused by administrators. Active node telemetry is on standby.
          </span>
        </div>
      )}

      {lastCompletedToast && (
        <div className="p-4 rounded-2xl bg-orange-500/15 border border-orange-500/40 flex items-center justify-between gap-3 text-xs text-orange-200">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-4 h-4 text-orange-400 shrink-0" />
            <span>{lastCompletedToast}</span>
          </div>
          <button
            onClick={() => setLastCompletedToast(null)}
            className="text-orange-300 hover:text-white font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Top 2-Column Split: 3D Node Run Reactor Console + Earnings & Nami Boost */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: Node Reactor Console */}
        <div className="lg:col-span-7 rounded-3xl nami-glass-elevated p-6 sm:p-8 flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs text-slate-400">
                <span>Node Telemetry Core</span>
                <span className="mx-1.5" aria-hidden="true">·</span>
                <span>Server-Verified Execution</span>
              </div>
              <h2 className="text-xl font-bold text-white mt-0.5 flex items-center gap-2">
                <span>{currentTier.name} (Tier {user.nodeLevel})</span>
                {isNamiBoostActive && (
                  <span className="text-xs font-mono-tabular font-bold px-2.5 py-0.5 rounded-lg bg-orange-500 text-slate-950">
                    2x NAMI BOOST
                  </span>
                )}
              </h2>
            </div>

            <div className="text-right">
              <div className="text-xs text-slate-400">Node Status</div>
              <div
                className={`text-sm font-semibold font-mono-tabular ${
                  displayStatus === 'Active'
                    ? 'text-orange-400'
                    : displayStatus === 'Completed'
                    ? 'text-amber-300'
                    : 'text-slate-300'
                }`}
              >
                {displayStatus}
              </div>
            </div>
          </div>

          {/* 3D Isometric Node Reactor */}
          <NodeReactor3D
            status={cooldownSec > 0 && !isSessionActive ? 'Cooldown' : displayStatus}
            progressPercent={isSessionActive ? progressPercent : displayStatus === 'Completed' ? 100 : 0}
            remainingSeconds={isSessionActive ? remainingSessionSec : cooldownSec}
            nodeLevel={user.nodeLevel}
            tierName={currentTier.name}
            multiplier={effectiveMultiplier}
          />

          {/* Nami Boost 2x Yield Activation Toggle Bar inside Node Run View */}
          <div
            className={`mb-5 p-4 rounded-2xl border transition-all ${
              isNamiBoostActive
                ? 'bg-orange-500/[0.12] border-orange-500/60'
                : 'bg-white/[0.03] border-white/10'
            }`}
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                    isNamiBoostActive
                      ? 'bg-orange-500 text-slate-950 shadow-[0_0_20px_rgba(255,107,0,0.45)]'
                      : 'bg-orange-500/15 text-orange-400'
                  }`}
                >
                  <Zap className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-bold text-white">
                      Nami Boost · Temporary 2x Yield Multiplier
                    </span>
                    <span className="text-xs font-mono-tabular text-orange-400 font-semibold">
                      {isNamiBoostActive
                        ? `ACTIVE (${formatClockTimer(boostRemainingSec)} left)`
                        : hasUnexpiredBoostPass
                        ? `PAUSED (${formatClockTimer(boostRemainingSec)} left)`
                        : `${NAMI_BOOST_COST} PTS / 24h Pass`}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {hasUnexpiredBoostPass
                      ? `Doubles your Node Run multiplier from ${currentTier.multiplier}x to ${currentTier.multiplier * 2}x (+${Math.round(config.basePointsPerSession * currentTier.multiplier * 2 + streakBonus)} PTS/session).`
                      : `Spend ${NAMI_BOOST_COST} NAMI Points to unlock a temporary 24-hour 2x yield multiplier (${currentTier.multiplier * 2}x total) on Node Runs.`}
                  </p>
                </div>
              </div>

              {/* Activation Toggle Control */}
              <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                {hasUnexpiredBoostPass && (
                  <button
                    type="button"
                    onClick={() => onNamiBoostAction('activate')}
                    disabled={busyAction === 'boost' || user.availablePoints < NAMI_BOOST_COST}
                    className="px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-[11px] font-mono-tabular text-slate-200 disabled:opacity-40 whitespace-nowrap"
                    title="Extend 2x Nami Boost by +24 hours"
                  >
                    +24h ({NAMI_BOOST_COST} PTS)
                  </button>
                )}

                <button
                  type="button"
                  role="switch"
                  aria-checked={isNamiBoostActive}
                  aria-label="Toggle Nami Boost 2x Yield Multiplier"
                  onClick={handleBoostToggleClick}
                  disabled={
                    busyAction === 'boost' ||
                    (!hasUnexpiredBoostPass && user.availablePoints < NAMI_BOOST_COST)
                  }
                  className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-all whitespace-nowrap shrink-0 disabled:opacity-40 ${
                    isNamiBoostActive
                      ? 'nami-btn-glow'
                      : 'bg-white/[0.06] hover:bg-white/[0.12] border border-white/15 text-white'
                  }`}
                >
                  <span
                    className={`w-8 h-4 rounded-full relative transition-colors flex items-center px-0.5 ${
                      isNamiBoostActive ? 'bg-slate-950/40' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      className={`w-3 h-3 rounded-full transition-transform ${
                        isNamiBoostActive
                          ? 'translate-x-4 bg-white'
                          : 'translate-x-0 bg-slate-300'
                      }`}
                    />
                  </span>
                  <span>
                    {busyAction === 'boost'
                      ? 'Updating...'
                      : isNamiBoostActive
                      ? '2x Boost ON'
                      : hasUnexpiredBoostPass
                      ? 'Toggle 2x ON'
                      : `Activate 2x (${NAMI_BOOST_COST} PTS)`}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Horizontal Progress Bar & Timer Details */}
          <div className="space-y-2 mb-6">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">
                {isReadyToClaim
                  ? 'Session cycle complete — ready for server verification'
                  : isSessionActive
                  ? 'Active Node Run Progress'
                  : cooldownSec > 0
                  ? `Cooldown active (${cooldownSec}s remaining)`
                  : `Cycle Duration: ${formatDurationCompact(config.sessionDurationSeconds)} per session`}
              </span>
              <span className="font-mono-tabular text-orange-400 font-semibold">
                {isSessionActive ? `${Math.round(progressPercent)}%` : '0%'}
              </span>
            </div>
            <div className="w-full h-2.5 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-orange-600 via-orange-500 to-amber-400 transition-all duration-300"
                style={{
                  width: `${isSessionActive ? Math.min(100, Math.max(2, progressPercent)) : 0}%`,
                }}
              />
            </div>
          </div>

          {/* Start / Stop / Claim Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {!isSessionActive ? (
              <button
                onClick={onStartNodeRun}
                disabled={
                  busyAction === 'start' ||
                  cooldownSec > 0 ||
                  config.campaignPaused ||
                  stats.todayEarned >= stats.effectiveDailyCap
                }
                className="sm:col-span-2 min-h-[48px] px-6 py-3.5 rounded-2xl nami-btn-glow font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap shrink-0"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>
                  {busyAction === 'start'
                    ? 'Initializing Server Session...'
                    : cooldownSec > 0
                    ? `Cooldown Active (${cooldownSec}s)`
                    : `Start Node Run (+${expectedSessionReward} PTS${isNamiBoostActive ? ' · 2x Boosted' : ''})`}
                </span>
              </button>
            ) : (
              <>
                <button
                  onClick={handleClaim}
                  disabled={!isReadyToClaim || busyAction === 'claim'}
                  className={`min-h-[48px] px-5 py-3.5 rounded-2xl font-semibold text-xs flex items-center justify-center gap-2 transition-all whitespace-nowrap shrink-0 ${
                    isReadyToClaim
                      ? 'nami-btn-glow'
                      : 'bg-white/[0.05] border border-white/10 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {busyAction === 'claim'
                      ? 'Verifying on Server...'
                      : isReadyToClaim
                      ? `Claim Verified +${expectedSessionReward} PTS`
                      : `Complete in ${formatClockTimer(remainingSessionSec)}`}
                  </span>
                </button>

                <button
                  onClick={() => onStopOrClaimNodeRun('stop')}
                  disabled={busyAction === 'stop'}
                  className="min-h-[48px] px-5 py-3.5 rounded-2xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-xs font-semibold text-red-200 flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0"
                >
                  <Square className="w-4 h-4 fill-current" />
                  <span>{busyAction === 'stop' ? 'Stopping...' : 'Stop Node Run'}</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Right: Session Reward Breakdown, Daily Limits, and Streak Bonus */}
        <div className="lg:col-span-5 rounded-3xl nami-glass p-6 sm:p-8 flex flex-col justify-between space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-white">Session Earning Rules & Limits</h3>
            <p className="text-xs text-slate-400 mt-1">
              Points are calculated and verified on the server upon session completion
            </p>

            <div className="mt-5 space-y-3 border border-white/10 rounded-2xl p-4 bg-white/[0.02]">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Points Earned Per Session</span>
                <span className="font-mono-tabular font-semibold text-orange-400">
                  +{expectedSessionReward} PTS
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">
                  Base Rate × Tier {user.nodeLevel}
                  {isNamiBoostActive ? ' × 2x Nami Boost' : ''}
                </span>
                <span className="font-mono-tabular text-slate-200">
                  {config.basePointsPerSession} × {effectiveMultiplier}x ={' '}
                  {Math.round(config.basePointsPerSession * effectiveMultiplier)} PTS
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Nami Boost Status</span>
                <span
                  className={`font-mono-tabular font-medium ${
                    isNamiBoostActive ? 'text-orange-400' : 'text-slate-400'
                  }`}
                >
                  {isNamiBoostActive ? '2.0x Active' : '1.0x Standard'}
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Active Streak Bonus ({user.streakDays}d)</span>
                <span className="font-mono-tabular text-orange-300">+{streakBonus} PTS</span>
              </div>
              <div className="pt-2.5 border-t border-white/10 flex items-center justify-between text-xs">
                <span className="text-slate-400">Total Points Earned (Node Runs)</span>
                <span className="font-mono-tabular font-semibold text-white">
                  {stats.totalNodePointsEarned.toLocaleString()} PTS
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Total Lifetime Points Earned</span>
                <span className="font-mono-tabular font-semibold text-white">
                  {user.lifetimeEarned.toLocaleString()} PTS
                </span>
              </div>
            </div>
          </div>

          {/* Daily Earning Limits & Cooldown */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Daily Earning Limit Progress</span>
              <span className="font-mono-tabular text-slate-200">
                {stats.todayEarned.toLocaleString()} / {stats.effectiveDailyCap.toLocaleString()} PTS
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className="h-full rounded-full bg-orange-500 transition-all"
                style={{ width: `${dailyProgressPct}%` }}
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 pt-1">
              <span>
                Sessions Today:{' '}
                <strong className="text-white font-mono-tabular">
                  {stats.sessionsCompletedToday}/{stats.maxDailySessions}
                </strong>
              </span>
              <span>
                Cooldown Timer:{' '}
                <strong className="text-white font-mono-tabular">{config.cooldownSeconds}s</strong>
              </span>
            </div>
          </div>

          {/* Daily Check-In & Streak Bonus Quick Card */}
          <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                <Flame className="w-4 h-4 text-orange-400 shrink-0" />
                <span>{user.streakDays}-Day Check-In Streak</span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {stats.checkedInToday
                  ? 'Daily streak bonus active on all Node Run sessions today.'
                  : `Check in now for +${config.dailyCheckInBasePoints + Math.min((user.streakDays + 1) * config.streakBonusPerDay, 150)} PTS`}
              </p>
            </div>

            <button
              onClick={onClaimDailyCheckIn}
              disabled={stats.checkedInToday || busyAction === 'checkin'}
              className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap shrink-0 ${
                stats.checkedInToday
                  ? 'bg-white/[0.05] text-slate-500 cursor-not-allowed'
                  : 'nami-btn-glow'
              }`}
            >
              <CalendarCheck className="w-4 h-4 inline mr-1.5" />
              {stats.checkedInToday ? 'Checked In' : 'Check In'}
            </button>
          </div>
        </div>
      </div>

      {/* Recharts Node Power Gauge & Comparative Yield Efficiency vs. Global Averages */}
      <NodePowerGaugePanel
        data={data}
        effectiveMultiplier={effectiveMultiplier}
        isNamiBoostActive={isNamiBoostActive}
      />

      {/* Node Diagnostics Panel (Ping Latency, Packet Loss, Push Alert Telemetry + Scrollable Maintenance Log) */}
      <NodeDiagnosticsPanel
        isNodeActive={isSessionActive}
        nodeLevel={user.nodeLevel}
        tierName={currentTier.name}
        bandwidthSpec={currentTier.bandwidthSpec}
        sessionAlertsEnabled={user.settings.sessionAlerts}
      />

      {/* Node Upgrades Section */}
      <div className="rounded-3xl nami-glass p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-lg font-semibold text-white">Upgrade Node Hardware Tiers</h3>
            <p className="text-xs text-slate-400">
              Spend internal NAMI Points to permanently increase your session yield multiplier and daily earning cap
            </p>
          </div>
          <div className="text-xs text-slate-300 font-mono-tabular">
            Available Balance:{' '}
            <strong className="text-orange-400">{user.availablePoints.toLocaleString()} PTS</strong>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {config.nodeTiers.map((tier) => {
            const isOwned = user.nodeLevel >= tier.level;
            const isCurrent = user.nodeLevel === tier.level;
            const isNextUpgrade = tier.level === user.nodeLevel + 1;
            const canAfford = user.availablePoints >= tier.cost;

            return (
              <div
                key={tier.level}
                className={`rounded-2xl p-5 flex flex-col justify-between border transition-all ${
                  isCurrent
                    ? 'bg-orange-500/[0.08] border-orange-500/50'
                    : isOwned
                    ? 'bg-white/[0.02] border-white/10 opacity-80'
                    : 'bg-white/[0.03] border-white/10'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Tier {tier.level}</span>
                    <span className="font-mono-tabular font-semibold text-orange-400">
                      {tier.multiplier}x Yield
                    </span>
                  </div>
                  <h4 className="mt-1.5 text-base font-bold text-white">{tier.name}</h4>
                  <p className="mt-1 text-xs text-slate-400 leading-relaxed">{tier.subtitle}</p>

                  <div className="mt-4 pt-3 border-t border-white/10 space-y-1.5 text-xs text-slate-300">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Session Yield:</span>
                      <span className="font-mono-tabular font-semibold">
                        +{Math.round(config.basePointsPerSession * tier.multiplier)} PTS
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Daily Cap Bonus:</span>
                      <span className="font-mono-tabular">
                        +{tier.dailyLimitBonus.toLocaleString()} PTS
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-5">
                  {isCurrent ? (
                    <div className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-orange-500/20 border border-orange-500/40 text-orange-300 text-xs font-semibold flex items-center justify-center gap-1.5">
                      <ShieldCheck className="w-4 h-4" />
                      <span>Active Tier</span>
                    </div>
                  ) : isOwned ? (
                    <div className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-white/[0.04] text-slate-400 text-xs font-medium flex items-center justify-center">
                      Unlocked
                    </div>
                  ) : isNextUpgrade ? (
                    <button
                      onClick={() => onUpgradeNode(tier.level)}
                      disabled={!canAfford || busyAction === `upgrade-${tier.level}`}
                      className={`w-full min-h-[42px] px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all whitespace-nowrap shrink-0 ${
                        canAfford
                          ? 'nami-btn-glow'
                          : 'bg-white/[0.05] border border-white/10 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      <ArrowUpCircle className="w-4 h-4" />
                      <span>
                        {busyAction === `upgrade-${tier.level}`
                          ? 'Upgrading...'
                          : `Upgrade (${tier.cost.toLocaleString()} PTS)`}
                      </span>
                    </button>
                  ) : (
                    <div className="w-full min-h-[42px] px-3 py-2 rounded-xl bg-white/[0.03] border border-white/5 text-slate-500 text-xs flex items-center justify-center font-mono-tabular">
                      Requires Tier {tier.level - 1} ({tier.cost.toLocaleString()} PTS)
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Node History & Completed Sessions */}
      <div className="rounded-3xl nami-glass p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <div>
            <h3 className="text-lg font-semibold text-white">
              Node Run History & Completed Sessions
              {isDemoMode ? ' (Demo Data)' : ''}
            </h3>
            <p className="text-xs text-slate-400">
              Complete log of your verified Node Run sessions and awarded NAMI Points
            </p>
          </div>
          <div className="text-xs text-slate-400 font-mono-tabular">
            Showing {nodeHistory.length} session{nodeHistory.length === 1 ? '' : 's'}
          </div>
        </div>

        {nodeHistory.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-white/[0.02] border border-white/10 text-xs text-slate-400">
            No completed Node Run sessions yet. Click "Start Node Run" above to begin earning NAMI Points.
          </div>
        ) : (
          <div className="overflow-x-auto border border-white/10 rounded-2xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/10 bg-white/[0.02] text-xs text-slate-400">
                  <th className="py-3 px-4 font-medium">Session ID</th>
                  <th className="py-3 px-4 font-medium">Node Tier</th>
                  <th className="py-3 px-4 font-medium">Status</th>
                  <th className="py-3 px-4 font-medium">Started At</th>
                  <th className="py-3 px-4 font-medium text-right">Duration</th>
                  <th className="py-3 px-4 font-medium text-right">Points Awarded</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10 text-xs">
                {nodeHistory.map((s) => (
                  <tr key={s.id} className="hover:bg-white/[0.02] transition-colors">
                    <td className="py-3.5 px-4 font-mono-tabular text-white font-medium">
                      #{s.id}
                    </td>
                    <td className="py-3.5 px-4 text-slate-300">
                      Tier {s.nodeLevel} ({s.multiplier}x{s.namiBoostActive ? ' · 2x Boost' : ''})
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`font-medium ${
                          s.status === 'completed'
                            ? 'text-orange-400'
                            : s.status === 'active'
                            ? 'text-amber-300'
                            : 'text-slate-400'
                        }`}
                      >
                        {s.status.charAt(0).toUpperCase() + s.status.slice(1)}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 font-mono-tabular text-slate-400">
                      {formatTime(s.startedAt)}
                    </td>
                    <td className="py-3.5 px-4 font-mono-tabular text-right text-slate-300">
                      {formatDurationCompact(s.durationSeconds)}
                    </td>
                    <td className="py-3.5 px-4 font-mono-tabular text-right font-semibold text-orange-400">
                      +{s.pointsAwarded.toLocaleString()} PTS
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
