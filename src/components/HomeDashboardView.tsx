import React, { useMemo, useState } from 'react';
import {
  Cpu,
  ListChecks,
  History,
  UserCheck,
  Flame,
  ArrowUpRight,
  ArrowDownRight,
  CalendarCheck,
  Sparkles,
  ChevronRight,
  TrendingUp,
  Sun,
  Moon,
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts';
import { DashboardPayload, MainTab, formatClockTimer } from '../types/nami.ts';
import { NamiLogoMark } from './IsometricNodeCore.tsx';
import { AchievementsPanel } from './AchievementsPanel.tsx';
import { GlobalLeaderboardPanel } from './GlobalLeaderboardPanel.tsx';
import { ReferralSystemPanel } from './ReferralSystemPanel.tsx';
import { WeeklyContributionHeatmap } from './WeeklyContributionHeatmap.tsx';

interface HomeDashboardViewProps {
  data: DashboardPayload;
  isDemoMode: boolean;
  remainingSessionSec: number;
  onNavigateTab: (tab: MainTab) => void;
  onOpenPointsLedger: () => void;
  onClaimDailyCheckIn: () => void;
  checkingIn: boolean;
  onRegisterReferredFriend: (friendName: string, friendEmail: string) => Promise<void>;
  busyReferral: boolean;
  themeMode: 'dark' | 'light';
  onToggleThemeMode: () => void;
}

interface DailyPointsChartPoint {
  dateKey: string;
  label: string;
  fullDate: string;
  totalPoints: number;
  nodePoints: number;
  taskAndCheckinPoints: number;
}

const CustomChartTooltip: React.FC<{
  active?: boolean;
  payload?: any[];
}> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;
  const item: DailyPointsChartPoint = payload[0].payload;

  return (
    <div className="rounded-2xl bg-[#10131c]/95 border border-orange-500/40 p-3.5 shadow-xl backdrop-blur-md">
      <div className="text-xs font-medium text-slate-300">{item.fullDate}</div>
      <div className="mt-1.5 flex items-baseline justify-between gap-6">
        <span className="text-xs text-slate-400">Total Earned:</span>
        <span className="text-sm font-bold font-mono-tabular text-orange-400">
          +{item.totalPoints.toLocaleString()} PTS
        </span>
      </div>
      <div className="mt-1 pt-1.5 border-t border-white/10 space-y-1 text-[11px]">
        <div className="flex items-center justify-between gap-4 text-slate-300">
          <span>Node Run Yield:</span>
          <span className="font-mono-tabular text-orange-300">
            +{item.nodePoints.toLocaleString()} PTS
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 text-slate-300">
          <span>Tasks & Check-In:</span>
          <span className="font-mono-tabular text-amber-300">
            +{item.taskAndCheckinPoints.toLocaleString()} PTS
          </span>
        </div>
      </div>
    </div>
  );
};

export const HomeDashboardView: React.FC<HomeDashboardViewProps> = ({
  data,
  isDemoMode,
  remainingSessionSec,
  onNavigateTab,
  onOpenPointsLedger,
  onClaimDailyCheckIn,
  checkingIn,
  onRegisterReferredFriend,
  busyReferral,
  themeMode,
  onToggleThemeMode,
}) => {
  const { user, stats, activeSession, transactions, config } = data;
  const [chartView, setChartView] = useState<'total' | 'breakdown'>('total');

  const currentTier =
    config.nodeTiers.find((t) => t.level === user.nodeLevel) || config.nodeTiers[0];

  const isNodeActive = activeSession && activeSession.status === 'active';
  const recentTx = transactions.slice(0, 6);

  // Build 7-day NAMI points earnings dataset from user's verified transactions
  const sevenDayData: DailyPointsChartPoint[] = useMemo(() => {
    const baseNow = data.serverNow ? new Date(data.serverNow) : new Date();
    const days: DailyPointsChartPoint[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(baseNow.getTime() - i * 86400000);
      const dateKey = d.toISOString().slice(0, 10);
      const label =
        i === 0
          ? 'Today'
          : d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' });
      const fullDate = d.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });

      let totalPoints = 0;
      let nodePoints = 0;
      let taskAndCheckinPoints = 0;

      transactions.forEach((tx) => {
        if (tx.amount > 0 && tx.createdAt.slice(0, 10) === dateKey) {
          totalPoints += tx.amount;
          if (tx.type === 'node_run') {
            nodePoints += tx.amount;
          } else {
            taskAndCheckinPoints += tx.amount;
          }
        }
      });

      days.push({
        dateKey,
        label,
        fullDate,
        totalPoints,
        nodePoints,
        taskAndCheckinPoints,
      });
    }

    return days;
  }, [transactions, data.serverNow]);

  const sevenDayTotal = useMemo(
    () => sevenDayData.reduce((acc, d) => acc + d.totalPoints, 0),
    [sevenDayData]
  );
  const sevenDayAvg = useMemo(
    () => Math.round(sevenDayTotal / 7),
    [sevenDayTotal]
  );
  const peakDayPoints = useMemo(
    () => Math.max(0, ...sevenDayData.map((d) => d.totalPoints)),
    [sevenDayData]
  );

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString(undefined, {
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
    <div className="space-y-8">
      {/* Top Hero Split: 3D NAMI Points Balance Card + Daily Streak & Check-In Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Main Futuristic 3D Wallet Card */}
        <div className="lg:col-span-8 rounded-3xl nami-glass-elevated p-6 sm:p-8 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-orange-500/15 blur-3xl pointer-events-none" />

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <NamiLogoMark size="md" />
              <div>
                <div className="text-xs text-slate-400">
                  <span>NAMI WALLET</span>
                  <span className="mx-1.5" aria-hidden="true">·</span>
                  <span className="font-mono-tabular">{user.uid}</span>
                </div>
                <h2 className="text-lg font-semibold text-white">{user.displayName}</h2>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onToggleThemeMode}
                className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-medium text-slate-200 flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
                title="Switch between Futuristic Dark and High Contrast Light mode"
              >
                {themeMode === 'light' ? (
                  <>
                    <Moon className="w-4 h-4 text-orange-400" />
                    <span>Futuristic Dark</span>
                  </>
                ) : (
                  <>
                    <Sun className="w-4 h-4 text-orange-400" />
                    <span>High Contrast Light</span>
                  </>
                )}
              </button>

              <button
                onClick={onOpenPointsLedger}
                className="min-h-[44px] px-4 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-medium text-orange-300 flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
              >
                <History className="w-4 h-4" />
                <span>Open Points Ledger</span>
              </button>
            </div>
          </div>

          <div className="my-8">
            <div className="text-xs text-slate-400">Total Available NAMI Points Balance</div>
            <div className="mt-1 flex items-baseline gap-3">
              <span className="text-4xl sm:text-5xl font-bold font-mono-tabular tracking-tight text-white">
                {user.availablePoints.toLocaleString()}
              </span>
              <span className="text-base font-semibold text-orange-400 font-mono-tabular">
                NAMI PTS
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span>Lifetime Earned: {user.lifetimeEarned.toLocaleString()} PTS</span>
              <span aria-hidden="true">·</span>
              <span>Upgrades Spent: {user.pointsSpent.toLocaleString()} PTS</span>
              <span aria-hidden="true">·</span>
              <span>Internal Reward Points</span>
            </div>
          </div>

          {/* Quick Actions Bar */}
          <div>
            <div className="text-xs text-slate-400 mb-2.5">Quick Actions</div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <button
                onClick={() => onNavigateTab('noderun')}
                className="min-h-[48px] px-4 py-3 rounded-2xl nami-btn-glow font-semibold text-xs flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
              >
                <Cpu className="w-4 h-4" />
                <span>Node Run</span>
              </button>

              <button
                onClick={() => onNavigateTab('tasks')}
                className="min-h-[48px] px-4 py-3 rounded-2xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 font-medium text-xs text-white flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0"
              >
                <ListChecks className="w-4 h-4 text-orange-400" />
                <span>Tasks</span>
              </button>

              <button
                onClick={onOpenPointsLedger}
                className="min-h-[48px] px-4 py-3 rounded-2xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 font-medium text-xs text-white flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0"
              >
                <History className="w-4 h-4 text-orange-400" />
                <span>Points History</span>
              </button>

              <button
                onClick={() => onNavigateTab('profile')}
                className="min-h-[48px] px-4 py-3 rounded-2xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 font-medium text-xs text-white flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0"
              >
                <UserCheck className="w-4 h-4 text-orange-400" />
                <span>Profile</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Card: Daily Streak & Node Run Status */}
        <div className="lg:col-span-4 rounded-3xl nami-glass p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">Daily Operator Check-In</span>
              <Flame className="w-5 h-5 text-orange-400" />
            </div>

            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-3xl font-bold font-mono-tabular text-white">
                {user.streakDays}
              </span>
              <span className="text-sm text-slate-300">Day Streak</span>
            </div>

            <p className="mt-2 text-xs text-slate-400 leading-relaxed">
              Check in once per day to earn +{config.dailyCheckInBasePoints} base points plus +{config.streakBonusPerDay} PTS per streak day.
            </p>

            <button
              onClick={onClaimDailyCheckIn}
              disabled={stats.checkedInToday || checkingIn}
              className={`mt-4 w-full min-h-[48px] px-4 py-3 rounded-2xl text-xs font-semibold flex items-center justify-center gap-2 transition-all whitespace-nowrap shrink-0 ${
                stats.checkedInToday
                  ? 'bg-white/[0.05] border border-white/10 text-slate-400 cursor-not-allowed'
                  : 'nami-btn-glow'
              }`}
            >
              <CalendarCheck className="w-4 h-4" />
              <span>
                {stats.checkedInToday
                  ? 'Daily Check-In Verified Today'
                  : checkingIn
                  ? 'Verifying Check-In...'
                  : 'Claim Daily Check-In Bonus'}
              </span>
            </button>
          </div>

          <div className="mt-6 pt-5 border-t border-white/10">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>Current Node Hardware</span>
              <span className="font-mono-tabular text-orange-400">{currentTier.multiplier}x Yield</span>
            </div>
            <div className="mt-1 text-sm font-semibold text-white">
              Tier {user.nodeLevel}: {currentTier.name}
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-xs text-slate-400">
                Status:{' '}
                <strong className={isNodeActive ? 'text-orange-400' : 'text-slate-200'}>
                  {isNodeActive ? `Active (${formatClockTimer(remainingSessionSec)} left)` : 'Inactive · Ready'}
                </strong>
              </span>
              <button
                onClick={() => onNavigateTab('noderun')}
                className="text-xs font-medium text-orange-400 hover:text-orange-300 flex items-center gap-1 whitespace-nowrap shrink-0"
              >
                <span>Open Node</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 4-Column Core KPI Metrics Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl nami-glass p-5 nami-card-3d">
          <div className="text-xs text-slate-400">Today's Earned Points</div>
          <div className="mt-2 text-2xl font-bold font-mono-tabular text-white">
            +{stats.todayEarned.toLocaleString()}{' '}
            <span className="text-xs font-normal text-slate-400">PTS</span>
          </div>
          <div className="mt-1.5 text-xs text-slate-400 font-mono-tabular">
            Daily Cap: {stats.effectiveDailyCap.toLocaleString()} PTS
          </div>
        </div>

        <div className="rounded-2xl nami-glass p-5 nami-card-3d">
          <div className="text-xs text-slate-400">Active Nodes</div>
          <div className="mt-2 text-2xl font-bold font-mono-tabular text-white">
            {isNodeActive ? '1 Active' : '0 Active'}
          </div>
          <div className="mt-1.5 text-xs text-slate-400">
            Tier {user.nodeLevel} · {stats.sessionsCompletedToday}/{stats.maxDailySessions} runs today
          </div>
        </div>

        <div className="rounded-2xl nami-glass p-5 nami-card-3d">
          <div className="text-xs text-slate-400">Daily Streak</div>
          <div className="mt-2 text-2xl font-bold font-mono-tabular text-orange-400">
            {user.streakDays} Days
          </div>
          <div className="mt-1.5 text-xs text-slate-400">
            +{Math.min(user.streakDays * 5, 50)} PTS session bonus
          </div>
        </div>

        <div className="rounded-2xl nami-glass p-5 nami-card-3d">
          <div className="text-xs text-slate-400">Total Completed Tasks</div>
          <div className="mt-2 text-2xl font-bold font-mono-tabular text-white">
            {stats.completedTasksCount}
          </div>
          <div className="mt-1.5 text-xs text-slate-400">
            Verified ecosystem & daily tasks
          </div>
        </div>
      </div>

      {/* 7-Day NAMI Points Earnings Line Graph Section */}
      <div className="rounded-3xl nami-glass p-6 sm:p-8">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <TrendingUp className="w-4 h-4 text-orange-400" />
              <span>7-Day Performance Analytics</span>
              <span aria-hidden="true">·</span>
              <span>Internal Points Ledger</span>
            </div>
            <h3 className="text-lg font-semibold text-white mt-0.5">
              NAMI Points Earnings (Last 7 Days)
              {isDemoMode ? ' — Demo Data' : ''}
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-4 text-xs text-slate-400">
              <span>
                7d Total:{' '}
                <strong className="font-mono-tabular text-orange-400">
                  +{sevenDayTotal.toLocaleString()} PTS
                </strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Daily Avg:{' '}
                <strong className="font-mono-tabular text-white">
                  +{sevenDayAvg.toLocaleString()} PTS
                </strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Peak:{' '}
                <strong className="font-mono-tabular text-white">
                  +{peakDayPoints.toLocaleString()} PTS
                </strong>
              </span>
            </div>

            <div className="flex items-center gap-1 p-1 bg-white/[0.04] rounded-xl">
              <button
                type="button"
                onClick={() => setChartView('total')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  chartView === 'total'
                    ? 'bg-orange-500 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Total Points
              </button>
              <button
                type="button"
                onClick={() => setChartView('breakdown')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  chartView === 'breakdown'
                    ? 'bg-orange-500 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Node vs Tasks
              </button>
            </div>
          </div>
        </div>

        <div className="w-full h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={sevenDayData}
              margin={{ top: 12, right: 16, left: -12, bottom: 4 }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(255, 255, 255, 0.06)"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 12 }}
                tickLine={false}
                axisLine={{ stroke: 'rgba(255, 255, 255, 0.08)' }}
              />
              <YAxis
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => `${val}`}
              />
              <Tooltip content={<CustomChartTooltip />} />
              {chartView === 'total' ? (
                <Line
                  type="monotone"
                  dataKey="totalPoints"
                  name="Total NAMI Points"
                  stroke="#FF6B00"
                  strokeWidth={3}
                  dot={{
                    r: 4,
                    fill: '#07080c',
                    stroke: '#FF6B00',
                    strokeWidth: 2.5,
                  }}
                  activeDot={{
                    r: 6,
                    fill: '#FF9500',
                    stroke: '#ffffff',
                    strokeWidth: 2,
                  }}
                />
              ) : (
                <>
                  <Line
                    type="monotone"
                    dataKey="nodePoints"
                    name="Node Run Points"
                    stroke="#FF6B00"
                    strokeWidth={2.5}
                    dot={{
                      r: 4,
                      fill: '#07080c',
                      stroke: '#FF6B00',
                      strokeWidth: 2,
                    }}
                    activeDot={{ r: 6, fill: '#FF6B00', stroke: '#ffffff', strokeWidth: 2 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="taskAndCheckinPoints"
                    name="Tasks & Check-In"
                    stroke="#FFB800"
                    strokeWidth={2.5}
                    strokeDasharray="4 4"
                    dot={{
                      r: 4,
                      fill: '#07080c',
                      stroke: '#FFB800',
                      strokeWidth: 2,
                    }}
                    activeDot={{ r: 6, fill: '#FFB800', stroke: '#ffffff', strokeWidth: 2 }}
                  />
                </>
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* D3 Weekly Contribution, Node Uptime & Check-In Heatmap */}
      <WeeklyContributionHeatmap
        data={data}
        isDemoMode={isDemoMode}
        themeMode={themeMode}
      />

      {/* Global Top 10 NAMI Points Leaderboard */}
      <GlobalLeaderboardPanel data={data} isDemoMode={isDemoMode} />

      {/* Operator Referral Invite Link & Bonus Points System */}
      <ReferralSystemPanel
        data={data}
        isDemoMode={isDemoMode}
        onRegisterReferredFriend={onRegisterReferredFriend}
        busy={busyReferral}
      />

      {/* Visual Achievements & Milestone Badges */}
      <AchievementsPanel data={data} />

      {/* Recent Points Earning Activity Section */}
      <div className="rounded-3xl nami-glass p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
          <div>
            <h3 className="text-lg font-semibold text-white">
              Recent Points Earning Activity
              {isDemoMode ? ' (Demo Data)' : ''}
            </h3>
            <p className="text-xs text-slate-400">
              Server-verified internal NAMI Points ledger entries for your account
            </p>
          </div>

          <button
            onClick={onOpenPointsLedger}
            className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 text-xs font-medium text-slate-200 transition-colors whitespace-nowrap shrink-0"
          >
            View Complete History ({transactions.length})
          </button>
        </div>

        {recentTx.length === 0 ? (
          <div className="p-8 text-center rounded-2xl bg-white/[0.02] border border-white/10">
            <Sparkles className="w-6 h-6 text-orange-400 mx-auto mb-2" />
            <div className="text-sm font-medium text-white">No points activity recorded yet</div>
            <p className="text-xs text-slate-400 mt-1">
              Start your first Node Run session or complete a Daily Check-In to earn NAMI Points.
            </p>
            <button
              onClick={() => onNavigateTab('noderun')}
              className="mt-4 px-4 py-2 rounded-xl text-xs font-semibold nami-btn-glow"
            >
              Start First Node Run
            </button>
          </div>
        ) : (
          <div className="divide-y divide-white/10 border border-white/10 rounded-2xl overflow-hidden">
            {recentTx.map((tx) => {
              const isEarn = tx.amount >= 0;
              return (
                <div
                  key={tx.id}
                  className="flex items-center justify-between gap-4 px-4 py-3.5 bg-white/[0.01] hover:bg-white/[0.03] transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        isEarn ? 'bg-orange-500/15 text-orange-400' : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {isEarn ? (
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
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div
                      className={`text-sm font-semibold font-mono-tabular ${
                        isEarn ? 'text-orange-400' : 'text-slate-300'
                      }`}
                    >
                      {isEarn ? `+${tx.amount.toLocaleString()}` : tx.amount.toLocaleString()} PTS
                    </div>
                    <div className="text-xs font-mono-tabular text-slate-500">
                      Bal: {tx.balanceAfter.toLocaleString()}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
