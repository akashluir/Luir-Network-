import React, { useMemo, useState } from 'react';
import {
  User,
  Settings,
  Shield,
  LogOut,
  History,
  Check,
  Copy,
  KeyRound,
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
import { DashboardPayload, UserProfile } from '../types/nami.ts';
import { NamiLogoMark } from './IsometricNodeCore.tsx';
import { AdminDashboardPanel } from './AdminDashboardPanel.tsx';
import { AchievementsPanel } from './AchievementsPanel.tsx';
import { ReferralSystemPanel } from './ReferralSystemPanel.tsx';

interface ProfileViewProps {
  data: DashboardPayload;
  token: string | null;
  isDemoMode: boolean;
  onUpdateProfile: (displayName: string, settings: UserProfile['settings']) => Promise<void>;
  onOpenPointsLedger: () => void;
  onLogout: () => void;
  onQuickSwitchAccount: (preset: 'demo' | 'admin') => Promise<void>;
  onRefreshDashboard: () => void;
  onRegisterReferredFriend: (friendName: string, friendEmail: string) => Promise<void>;
  busyReferral: boolean;
  themeMode: 'dark' | 'light';
  onChangeThemeMode: (mode: 'dark' | 'light') => void;
}

interface MonthlyDailyPerformancePoint {
  dateKey: string;
  label: string;
  fullDate: string;
  weekLabel: string;
  dailyPoints: number;
  rolling7dAvg: number;
  nodePoints: number;
  bonusAndTaskPoints: number;
}

const MonthlyPerformanceTooltip: React.FC<{
  active?: boolean;
  payload?: any[];
}> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;
  const item: MonthlyDailyPerformancePoint = payload[0].payload;

  return (
    <div className="rounded-2xl bg-[#10131c]/95 border border-orange-500/40 p-3.5 shadow-xl backdrop-blur-md">
      <div className="flex items-center justify-between gap-4 text-xs text-slate-300">
        <span className="font-medium">{item.fullDate}</span>
        <span className="text-[11px] font-mono-tabular text-orange-300">{item.weekLabel}</span>
      </div>
      <div className="mt-1.5 flex items-baseline justify-between gap-6">
        <span className="text-xs text-slate-400">Daily Points Earned:</span>
        <span className="text-sm font-bold font-mono-tabular text-orange-400">
          +{item.dailyPoints.toLocaleString()} PTS
        </span>
      </div>
      <div className="mt-1 flex items-baseline justify-between gap-6">
        <span className="text-xs text-slate-400">7-Day Trend Avg:</span>
        <span className="text-xs font-semibold font-mono-tabular text-amber-300">
          +{item.rolling7dAvg.toLocaleString()} PTS/day
        </span>
      </div>
      <div className="mt-1.5 pt-1.5 border-t border-white/10 space-y-1 text-[11px]">
        <div className="flex items-center justify-between gap-4 text-slate-300">
          <span>Node Run Yield:</span>
          <span className="font-mono-tabular text-orange-300">
            +{item.nodePoints.toLocaleString()} PTS
          </span>
        </div>
        <div className="flex items-center justify-between gap-4 text-slate-300">
          <span>Tasks, Streak & Referrals:</span>
          <span className="font-mono-tabular text-slate-200">
            +{item.bonusAndTaskPoints.toLocaleString()} PTS
          </span>
        </div>
      </div>
    </div>
  );
};

export const ProfileView: React.FC<ProfileViewProps> = ({
  data,
  token,
  isDemoMode,
  onUpdateProfile,
  onOpenPointsLedger,
  onLogout,
  onQuickSwitchAccount,
  onRefreshDashboard,
  onRegisterReferredFriend,
  busyReferral,
  themeMode,
  onChangeThemeMode,
}) => {
  const { user, transactions } = data;
  const [displayName, setDisplayName] = useState(user.displayName);
  const [settings, setSettings] = useState(user.settings);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [copiedUid, setCopiedUid] = useState(false);
  const [showAdminConsole, setShowAdminConsole] = useState(user.role === 'admin');
  const [trendMode, setTrendMode] = useState<'trend' | 'sources'>('trend');

  // Build 30-day (last month) daily points dataset + 7-day rolling trend line
  const monthlyData: MonthlyDailyPerformancePoint[] = useMemo(() => {
    const baseNow = data.serverNow ? new Date(data.serverNow) : new Date();
    const rawDays: Omit<MonthlyDailyPerformancePoint, 'rolling7dAvg'>[] = [];

    for (let i = 29; i >= 0; i--) {
      const d = new Date(baseNow.getTime() - i * 86400000);
      const dateKey = d.toISOString().slice(0, 10);
      const label =
        i === 0
          ? 'Today'
          : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const fullDate = d.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
      const weekIndex = Math.floor((29 - i) / 7) + 1;
      const weekLabel = `Week ${Math.min(4, weekIndex)}`;

      let dailyPoints = 0;
      let nodePoints = 0;
      let bonusAndTaskPoints = 0;

      transactions.forEach((tx) => {
        if (tx.amount > 0 && tx.createdAt.slice(0, 10) === dateKey) {
          dailyPoints += tx.amount;
          if (tx.type === 'node_run') {
            nodePoints += tx.amount;
          } else {
            bonusAndTaskPoints += tx.amount;
          }
        }
      });

      rawDays.push({
        dateKey,
        label,
        fullDate,
        weekLabel,
        dailyPoints,
        nodePoints,
        bonusAndTaskPoints,
      });
    }

    return rawDays.map((day, idx) => {
      const windowSlice = rawDays.slice(Math.max(0, idx - 6), idx + 1);
      const sum = windowSlice.reduce((acc, item) => acc + item.dailyPoints, 0);
      const rolling7dAvg = Math.round(sum / windowSlice.length);
      return {
        ...day,
        rolling7dAvg,
      };
    });
  }, [transactions, data.serverNow]);

  const thirtyDayTotal = useMemo(
    () => monthlyData.reduce((sum, d) => sum + d.dailyPoints, 0),
    [monthlyData]
  );

  const thirtyDayDailyAvg = useMemo(
    () => Math.round(thirtyDayTotal / 30),
    [thirtyDayTotal]
  );

  const weeklyBuckets = useMemo(() => {
    return [0, 1, 2, 3].map((wIdx) => {
      const slice = monthlyData.slice(wIdx * 7, wIdx === 3 ? 30 : (wIdx + 1) * 7);
      const total = slice.reduce((acc, d) => acc + d.dailyPoints, 0);
      const avg = Math.round(total / Math.max(1, slice.length));
      return {
        label: wIdx === 3 ? 'Current Week' : `Week ${wIdx + 1}`,
        range:
          slice.length > 0
            ? `${slice[0].label} – ${slice[slice.length - 1].label}`
            : '',
        total,
        avg,
      };
    });
  }, [monthlyData]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedNotice(false);
    try {
      await onUpdateProfile(displayName, settings);
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 3500);
    } finally {
      setSaving(false);
    }
  };

  const copyUid = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(user.uid);
      setCopiedUid(true);
      setTimeout(() => setCopiedUid(false), 2000);
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Profile Identity & Account Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        <div className="lg:col-span-7 rounded-3xl nami-glass-elevated p-6 sm:p-8 flex flex-col justify-between">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <NamiLogoMark size="lg" />
              <div>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <span>Authenticated Operator</span>
                  <span aria-hidden="true">·</span>
                  <span className="text-orange-400 font-medium uppercase">{user.role}</span>
                </div>
                <h2 className="text-2xl font-bold text-white mt-0.5">{user.displayName}</h2>
                <div className="text-xs text-slate-400 mt-0.5">{user.email}</div>
              </div>
            </div>

            <button
              onClick={copyUid}
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs font-mono-tabular text-slate-200 flex items-center gap-2 transition-colors"
              title="Copy Unique User ID"
            >
              <span>ID: {user.uid}</span>
              {copiedUid ? (
                <Check className="w-3.5 h-3.5 text-orange-400" />
              ) : (
                <Copy className="w-3.5 h-3.5 text-slate-400" />
              )}
            </button>
          </div>

          <div className="grid grid-cols-3 gap-4 my-6 pt-6 border-t border-white/10">
            <div>
              <div className="text-xs text-slate-400">Available Points</div>
              <div className="mt-1 text-xl font-bold font-mono-tabular text-orange-400">
                {user.availablePoints.toLocaleString()} PTS
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Lifetime Earned</div>
              <div className="mt-1 text-xl font-bold font-mono-tabular text-white">
                {user.lifetimeEarned.toLocaleString()} PTS
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Upgrades Spent</div>
              <div className="mt-1 text-xl font-bold font-mono-tabular text-slate-300">
                {user.pointsSpent.toLocaleString()} PTS
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-white/10">
            <button
              onClick={onOpenPointsLedger}
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-medium text-white flex items-center gap-2 transition-colors"
            >
              <History className="w-4 h-4 text-orange-400" />
              <span>Open Full Points Ledger</span>
            </button>

            <div className="flex items-center gap-2">
              {user.role !== 'admin' && (
                <button
                  onClick={() => onQuickSwitchAccount('admin')}
                  className="min-h-[44px] px-3.5 py-2.5 rounded-xl bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/30 text-xs font-medium text-orange-300 flex items-center gap-1.5 transition-colors"
                >
                  <Shield className="w-4 h-4" />
                  <span>Switch to Admin Account</span>
                </button>
              )}

              <button
                onClick={onLogout}
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-xs font-semibold text-red-200 flex items-center gap-2 transition-colors"
              >
                <LogOut className="w-4 h-4" />
                <span>{isDemoMode ? 'Exit Demo Preview' : 'Sign Out'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Account Settings Panel (Inside Profile Menu) */}
        <div className="lg:col-span-5 rounded-3xl nami-glass p-6 sm:p-8 flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 text-xs text-orange-400 font-medium">
              <Settings className="w-4 h-4" />
              <span>Account Settings & Preferences</span>
            </div>
            <h3 className="text-lg font-semibold text-white mt-1">
              Profile & Wallet Configuration
            </h3>

            <form onSubmit={handleSave} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs text-slate-300 mb-1.5">
                  Operator Display Name
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    disabled={isDemoMode}
                    className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl bg-white/[0.04] border border-white/10 text-white focus:outline-none focus:border-orange-500 disabled:opacity-50"
                  />
                </div>
              </div>

              <div className="space-y-2.5 pt-2">
                {/* User-Controlled Theme Switcher */}
                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/10">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-medium text-white">Interface Theme Mode</div>
                      <div className="text-[11px] text-slate-400">
                        Switch between Futuristic Dark and High Contrast Light mode
                      </div>
                    </div>

                    <div className="flex items-center gap-1 p-1 bg-white/[0.04] rounded-xl border border-white/10">
                      <button
                        type="button"
                        onClick={() => {
                          onChangeThemeMode('dark');
                          setSettings((s) => ({ ...s, themeMode: 'dark' }));
                        }}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                          themeMode === 'dark'
                            ? 'bg-orange-500 text-slate-950 font-semibold'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <Moon className="w-3.5 h-3.5" />
                        <span>Futuristic Dark</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onChangeThemeMode('light');
                          setSettings((s) => ({ ...s, themeMode: 'light' }));
                        }}
                        className={`px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 ${
                          themeMode === 'light'
                            ? 'bg-orange-500 text-slate-950 font-semibold'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        <Sun className="w-3.5 h-3.5" />
                        <span>High Contrast Light</span>
                      </button>
                    </div>
                  </div>
                </div>

                <label className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/10 cursor-pointer">
                  <div>
                    <div className="text-xs font-medium text-white">Node Run Completion Alerts</div>
                    <div className="text-[11px] text-slate-400">
                      Notify when a Node Run session is ready to verify
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.sessionAlerts}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, sessionAlerts: e.target.checked }))
                    }
                    className="w-4 h-4 accent-orange-500"
                  />
                </label>

                <label className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/10 cursor-pointer">
                  <div>
                    <div className="text-xs font-medium text-white">3D Isometric Core Telemetry</div>
                    <div className="text-[11px] text-slate-400">
                      Enable subtle 3D perspective motion on active node core
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.telemetryOverlay}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, telemetryOverlay: e.target.checked }))
                    }
                    className="w-4 h-4 accent-orange-500"
                  />
                </label>
              </div>

              {savedNotice && (
                <div className="text-xs text-orange-300 flex items-center gap-1.5">
                  <Check className="w-4 h-4" />
                  <span>Profile and settings saved to server.</span>
                </div>
              )}

              <button
                type="submit"
                disabled={saving || isDemoMode}
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl nami-btn-glow text-xs font-semibold disabled:opacity-40"
              >
                {saving ? 'Saving Changes...' : 'Save Account Settings'}
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Recharts Weekly Performance Chart (Daily Trend Lines Over the Last Month / 30 Days) */}
      <div className="rounded-3xl nami-glass p-6 sm:p-8 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <TrendingUp className="w-4 h-4 text-orange-400" />
              <span>30-Day Operator Analytics</span>
              <span aria-hidden="true">·</span>
              <span>Daily & Weekly Trend Lines</span>
            </div>
            <h3 className="text-lg font-semibold text-white mt-0.5">
              Weekly Performance — Daily Points Earned Over the Last Month
              {isDemoMode ? ' (Demo Data)' : ''}
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-4 text-xs text-slate-400">
              <span>
                30d Total:{' '}
                <strong className="font-mono-tabular text-orange-400">
                  +{thirtyDayTotal.toLocaleString()} PTS
                </strong>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                30d Daily Avg:{' '}
                <strong className="font-mono-tabular text-white">
                  +{thirtyDayDailyAvg.toLocaleString()} PTS/day
                </strong>
              </span>
            </div>

            <div className="flex items-center gap-1 p-1 bg-white/[0.04] rounded-xl">
              <button
                type="button"
                onClick={() => setTrendMode('trend')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  trendMode === 'trend'
                    ? 'bg-orange-500 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Daily + 7d Trend Line
              </button>
              <button
                type="button"
                onClick={() => setTrendMode('sources')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                  trendMode === 'sources'
                    ? 'bg-orange-500 text-slate-950 font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Node vs Bonus Sources
              </button>
            </div>
          </div>
        </div>

        {/* 4 Weekly Summary Cards Across the Month */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {weeklyBuckets.map((wb) => (
            <div
              key={wb.label}
              className="p-4 rounded-2xl bg-white/[0.02] border border-white/10"
            >
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span className="font-medium text-slate-300">{wb.label}</span>
                <span className="text-[11px] font-mono-tabular">{wb.range}</span>
              </div>
              <div className="mt-1.5 text-lg font-bold font-mono-tabular text-orange-400">
                +{wb.total.toLocaleString()} PTS
              </div>
              <div className="mt-0.5 text-[11px] text-slate-400 font-mono-tabular">
                Avg: +{wb.avg.toLocaleString()} PTS/day
              </div>
            </div>
          ))}
        </div>

        {/* Recharts 30-Day Line Chart */}
        <div className="w-full h-72">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={monthlyData}
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
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                tickLine={false}
                interval={3}
                axisLine={{ stroke: 'rgba(255, 255, 255, 0.08)' }}
              />
              <YAxis
                stroke="#64748b"
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<MonthlyPerformanceTooltip />} />
              {trendMode === 'trend' ? (
                <>
                  <Line
                    type="monotone"
                    dataKey="dailyPoints"
                    name="Daily Earned Points"
                    stroke="#FF6B00"
                    strokeWidth={2.5}
                    dot={{
                      r: 3,
                      fill: '#07080c',
                      stroke: '#FF6B00',
                      strokeWidth: 2,
                    }}
                    activeDot={{
                      r: 5,
                      fill: '#FF9500',
                      stroke: '#ffffff',
                      strokeWidth: 2,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="rolling7dAvg"
                    name="7-Day Rolling Trend"
                    stroke="#FFB800"
                    strokeWidth={2.5}
                    strokeDasharray="5 4"
                    dot={false}
                    activeDot={{
                      r: 5,
                      fill: '#FFB800',
                      stroke: '#ffffff',
                      strokeWidth: 2,
                    }}
                  />
                </>
              ) : (
                <>
                  <Line
                    type="monotone"
                    dataKey="nodePoints"
                    name="Node Run Points"
                    stroke="#FF6B00"
                    strokeWidth={2.5}
                    dot={{ r: 2.5, fill: '#07080c', stroke: '#FF6B00', strokeWidth: 2 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="bonusAndTaskPoints"
                    name="Tasks, Streak & Referrals"
                    stroke="#38bdf8"
                    strokeWidth={2}
                    strokeDasharray="4 4"
                    dot={{ r: 2.5, fill: '#07080c', stroke: '#38bdf8', strokeWidth: 2 }}
                  />
                </>
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Referral Invite Link & Bonus NAMI Points System */}
      <ReferralSystemPanel
        data={data}
        isDemoMode={isDemoMode}
        onRegisterReferredFriend={onRegisterReferredFriend}
        busy={busyReferral}
      />

      {/* Operator Achievements & Milestones */}
      <AchievementsPanel data={data} />

      {/* Role-Based Admin Dashboard Section */}
      {user.role === 'admin' && token ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-orange-400 font-semibold">
              <KeyRound className="w-4 h-4" />
              <span>Authorized Administrator Access Verified ({user.email})</span>
            </div>
            <button
              onClick={() => setShowAdminConsole((prev) => !prev)}
              className="text-xs text-slate-300 hover:text-white underline"
            >
              {showAdminConsole ? 'Collapse Admin Console' : 'Expand Admin Console'}
            </button>
          </div>

          {showAdminConsole && (
            <AdminDashboardPanel token={token} onConfigUpdated={onRefreshDashboard} />
          )}
        </div>
      ) : null}
    </div>
  );
};
