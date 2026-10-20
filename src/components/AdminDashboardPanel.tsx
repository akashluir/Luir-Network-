import React, { useEffect, useState } from 'react';
import {
  ShieldAlert,
  Sliders,
  Users,
  Plus,
  CheckCircle2,
  PauseCircle,
  PlayCircle,
  RefreshCw,
} from 'lucide-react';
import { AdminOverviewPayload, NodeTier } from '../types/nami.ts';

interface AdminDashboardPanelProps {
  token: string;
  onConfigUpdated: () => void;
}

export const AdminDashboardPanel: React.FC<AdminDashboardPanelProps> = ({
  token,
  onConfigUpdated,
}) => {
  const [overview, setOverview] = useState<AdminOverviewPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingConfig, setSavingConfig] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [subTab, setSubTab] = useState<'rules' | 'tasks' | 'security' | 'users'>('rules');

  // Editable config state
  const [basePoints, setBasePoints] = useState(120);
  const [sessionDuration, setSessionDuration] = useState(25200);
  const [cooldownSec, setCooldownSec] = useState(15);
  const [dailyLimit, setDailyLimit] = useState(2400);
  const [maxDailySessions, setMaxDailySessions] = useState(12);
  const [campaignPaused, setCampaignPaused] = useState(false);
  const [nodeTiers, setNodeTiers] = useState<NodeTier[]>([]);

  // New Task state
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDesc, setNewTaskDesc] = useState('');
  const [newTaskCategory, setNewTaskCategory] = useState<'daily' | 'social' | 'ecosystem'>('social');
  const [newTaskPoints, setNewTaskPoints] = useState(150);
  const [newTaskType, setNewTaskType] = useState<'url_visit' | 'social_handle' | 'share_link'>('social_handle');
  const [newTaskUrl, setNewTaskUrl] = useState('https://namiwallet.io');

  const fetchAdminOverview = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/overview', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load admin overview');
      setOverview(data);
      setBasePoints(data.config.basePointsPerSession);
      setSessionDuration(data.config.sessionDurationSeconds);
      setCooldownSec(data.config.cooldownSeconds);
      setDailyLimit(data.config.dailyPointLimit);
      setMaxDailySessions(data.config.maxDailySessions);
      setCampaignPaused(data.config.campaignPaused);
      setNodeTiers(data.config.nodeTiers);
    } catch (err: any) {
      setError(err.message || 'Could not load admin dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminOverview();
  }, [token]);

  const handleSaveConfig = async (e?: React.FormEvent, overridePaused?: boolean) => {
    if (e) e.preventDefault();
    setSavingConfig(true);
    setSaveMessage(null);
    try {
      const targetPaused = overridePaused !== undefined ? overridePaused : campaignPaused;
      const res = await fetch('/api/admin/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          basePointsPerSession: basePoints,
          sessionDurationSeconds: sessionDuration,
          cooldownSeconds: cooldownSec,
          dailyPointLimit: dailyLimit,
          maxDailySessions,
          campaignPaused: targetPaused,
          nodeTiers,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update config');
      setCampaignPaused(data.config.campaignPaused);
      setSaveMessage('Reward parameters and node tier upgrade costs saved.');
      onConfigUpdated();
      await fetchAdminOverview();
    } catch (err: any) {
      setError(err.message || 'Failed to save configuration.');
    } finally {
      setSavingConfig(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/tasks', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: newTaskTitle,
          description: newTaskDesc,
          category: newTaskCategory,
          points: newTaskPoints,
          verificationType: newTaskType,
          actionUrl: newTaskUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create task');
      setNewTaskTitle('');
      setNewTaskDesc('');
      onConfigUpdated();
      await fetchAdminOverview();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleToggleTask = async (taskId: string) => {
    try {
      await fetch(`/api/admin/tasks/${taskId}/toggle`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      onConfigUpdated();
      await fetchAdminOverview();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleResolveSuspicious = async (logId: string) => {
    try {
      await fetch(`/api/admin/suspicious/${logId}/resolve`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchAdminOverview();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const updateTierField = (index: number, field: keyof NodeTier, value: number | string) => {
    setNodeTiers((prev) =>
      prev.map((t, idx) => (idx === index ? { ...t, [field]: value } : t))
    );
  };

  if (loading && !overview) {
    return (
      <div className="rounded-3xl nami-glass p-8 text-center text-sm text-slate-400">
        Loading Administrator Command Console...
      </div>
    );
  }

  return (
    <div className="rounded-3xl nami-glass-elevated p-6 sm:p-8 space-y-6">
      {/* Top Admin Header + Campaign Pause Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
        <div>
          <div className="text-xs text-orange-400 font-semibold">
            Role-Protected Administrator Dashboard
          </div>
          <h3 className="text-xl font-bold text-white mt-0.5">
            NAMI Network Governance & Security Console
          </h3>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => handleSaveConfig(undefined, !campaignPaused)}
            disabled={savingConfig}
            className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 ${
              campaignPaused
                ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                : 'bg-amber-500/20 border border-amber-500/40 text-amber-200'
            }`}
          >
            {campaignPaused ? (
              <>
                <PlayCircle className="w-4 h-4" />
                <span>Resume Reward Campaigns</span>
              </>
            ) : (
              <>
                <PauseCircle className="w-4 h-4" />
                <span>Pause Reward Campaigns</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={fetchAdminOverview}
            className="min-h-[42px] px-3 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs text-slate-300 flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-red-500/15 border border-red-500/30 text-xs text-red-200">
          {error}
        </div>
      )}

      {saveMessage && (
        <div className="p-3.5 rounded-xl bg-orange-500/15 border border-orange-500/30 text-xs text-orange-200">
          {saveMessage}
        </div>
      )}

      {/* Admin Sub-Navigation */}
      <div className="flex items-center gap-1 p-1 bg-white/[0.04] rounded-xl overflow-x-auto">
        <button
          onClick={() => setSubTab('rules')}
          className={`px-3.5 py-2 text-xs font-medium rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
            subTab === 'rules'
              ? 'bg-orange-500 text-slate-950 font-semibold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Node Rules, Limits & Upgrades</span>
        </button>

        <button
          onClick={() => setSubTab('tasks')}
          className={`px-3.5 py-2 text-xs font-medium rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
            subTab === 'tasks'
              ? 'bg-orange-500 text-slate-950 font-semibold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Tasks Manager ({overview?.tasks.length || 0})</span>
        </button>

        <button
          onClick={() => setSubTab('security')}
          className={`px-3.5 py-2 text-xs font-medium rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
            subTab === 'security'
              ? 'bg-orange-500 text-slate-950 font-semibold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>
            Suspicious Activity ({overview?.suspiciousLogs.filter((l) => !l.resolved).length || 0})
          </span>
        </button>

        <button
          onClick={() => setSubTab('users')}
          className={`px-3.5 py-2 text-xs font-medium rounded-lg flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
            subTab === 'users'
              ? 'bg-orange-500 text-slate-950 font-semibold'
              : 'text-slate-400 hover:text-white'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Users, Sessions & Ledger</span>
        </button>
      </div>

      {/* SubTab 1: Node Rules, Limits & Upgrades */}
      {subTab === 'rules' && (
        <form onSubmit={(e) => handleSaveConfig(e)} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Base Points / Session
              </label>
              <input
                type="number"
                value={basePoints}
                onChange={(e) => setBasePoints(Number(e.target.value))}
                className="w-full px-3 py-2.5 text-sm font-mono-tabular rounded-xl bg-white/[0.05] border border-white/10 text-white"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Session Duration (s)
              </label>
              <input
                type="number"
                value={sessionDuration}
                onChange={(e) => setSessionDuration(Number(e.target.value))}
                className="w-full px-3 py-2.5 text-sm font-mono-tabular rounded-xl bg-white/[0.05] border border-white/10 text-white"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Cooldown Timer (s)
              </label>
              <input
                type="number"
                value={cooldownSec}
                onChange={(e) => setCooldownSec(Number(e.target.value))}
                className="w-full px-3 py-2.5 text-sm font-mono-tabular rounded-xl bg-white/[0.05] border border-white/10 text-white"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Base Daily Point Cap
              </label>
              <input
                type="number"
                value={dailyLimit}
                onChange={(e) => setDailyLimit(Number(e.target.value))}
                className="w-full px-3 py-2.5 text-sm font-mono-tabular rounded-xl bg-white/[0.05] border border-white/10 text-white"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1">
                Max Daily Sessions
              </label>
              <input
                type="number"
                value={maxDailySessions}
                onChange={(e) => setMaxDailySessions(Number(e.target.value))}
                className="w-full px-3 py-2.5 text-sm font-mono-tabular rounded-xl bg-white/[0.05] border border-white/10 text-white"
              />
            </div>
          </div>

          {/* Node Tier Upgrade Costs & Multipliers */}
          <div>
            <h4 className="text-sm font-semibold text-white mb-3">
              Node Upgrade Costs & Yield Multipliers
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {nodeTiers.map((tier, idx) => (
                <div
                  key={tier.level}
                  className="p-4 rounded-2xl bg-white/[0.03] border border-white/10 space-y-3"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-orange-400">Tier {tier.level}</span>
                    <span className="text-slate-400">{tier.name}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2.5">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Upgrade Cost (PTS)
                      </label>
                      <input
                        type="number"
                        value={tier.cost}
                        disabled={tier.level === 1}
                        onChange={(e) => updateTierField(idx, 'cost', Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 text-xs font-mono-tabular rounded-lg bg-white/[0.05] border border-white/10 text-white disabled:opacity-40"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Yield Multiplier
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={tier.multiplier}
                        onChange={(e) => updateTierField(idx, 'multiplier', Number(e.target.value))}
                        className="w-full px-2.5 py-1.5 text-xs font-mono-tabular rounded-lg bg-white/[0.05] border border-white/10 text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">
                        Daily Cap Bonus
                      </label>
                      <input
                        type="number"
                        value={tier.dailyLimitBonus}
                        onChange={(e) =>
                          updateTierField(idx, 'dailyLimitBonus', Number(e.target.value))
                        }
                        className="w-full px-2.5 py-1.5 text-xs font-mono-tabular rounded-lg bg-white/[0.05] border border-white/10 text-white"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={savingConfig}
            className="min-h-[44px] px-6 py-2.5 rounded-xl nami-btn-glow text-xs font-semibold"
          >
            {savingConfig ? 'Saving Parameters...' : 'Save Node Run & Upgrade Configuration'}
          </button>
        </form>
      )}

      {/* SubTab 2: Tasks Manager */}
      {subTab === 'tasks' && overview && (
        <div className="space-y-6">
          <form
            onSubmit={handleCreateTask}
            className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4"
          >
            <h4 className="text-sm font-semibold text-white">Create New Verification Task</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <input
                type="text"
                required
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="Task Title"
                className="px-3 py-2 text-xs rounded-xl bg-white/[0.05] border border-white/10 text-white"
              />
              <input
                type="text"
                required
                value={newTaskDesc}
                onChange={(e) => setNewTaskDesc(e.target.value)}
                placeholder="Task Description"
                className="px-3 py-2 text-xs rounded-xl bg-white/[0.05] border border-white/10 text-white"
              />
              <select
                value={newTaskCategory}
                onChange={(e) => setNewTaskCategory(e.target.value as any)}
                className="px-3 py-2 text-xs rounded-xl bg-[#141824] border border-white/10 text-white"
              >
                <option value="daily">Daily Task</option>
                <option value="social">Social Task</option>
                <option value="ecosystem">Ecosystem Task</option>
              </select>
              <input
                type="number"
                required
                value={newTaskPoints}
                onChange={(e) => setNewTaskPoints(Number(e.target.value))}
                placeholder="Points Reward"
                className="px-3 py-2 text-xs font-mono-tabular rounded-xl bg-white/[0.05] border border-white/10 text-white"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <select
                value={newTaskType}
                onChange={(e) => setNewTaskType(e.target.value as any)}
                className="px-3 py-2 text-xs rounded-xl bg-[#141824] border border-white/10 text-white"
              >
                <option value="social_handle">Require Social Handle Proof</option>
                <option value="share_link">Require Shared Link Proof</option>
                <option value="url_visit">Dwell-Verified Website Visit</option>
              </select>
              <input
                type="text"
                value={newTaskUrl}
                onChange={(e) => setNewTaskUrl(e.target.value)}
                placeholder="Target Action URL"
                className="px-3 py-2 text-xs rounded-xl bg-white/[0.05] border border-white/10 text-white"
              />
              <button
                type="submit"
                className="min-h-[40px] px-4 py-2 rounded-xl nami-btn-glow text-xs font-semibold"
              >
                Add Task to Network
              </button>
            </div>
          </form>

          <div className="divide-y divide-white/10 border border-white/10 rounded-2xl overflow-hidden">
            {overview.tasks.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between gap-4 px-4 py-3 bg-white/[0.01]"
              >
                <div>
                  <div className="text-sm font-medium text-white">{t.title}</div>
                  <div className="text-xs text-slate-400">
                    {t.category} · +{t.points} PTS · Verification: {t.verificationType}
                  </div>
                </div>
                <button
                  onClick={() => handleToggleTask(t.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium ${
                    t.active
                      ? 'bg-orange-500/20 text-orange-300 border border-orange-500/30'
                      : 'bg-white/[0.05] text-slate-400 border border-white/10'
                  }`}
                >
                  {t.active ? 'Active' : 'Disabled'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SubTab 3: Suspicious Activity Review */}
      {subTab === 'security' && overview && (
        <div className="space-y-3">
          {overview.suspiciousLogs.length === 0 ? (
            <div className="p-8 text-center text-xs text-slate-400">
              No suspicious reward claims or verification anomalies detected.
            </div>
          ) : (
            <div className="divide-y divide-white/10 border border-white/10 rounded-2xl overflow-hidden">
              {overview.suspiciousLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-white/[0.01]"
                >
                  <div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="font-semibold text-amber-300">{log.eventType}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono-tabular text-slate-300">{log.userEmail}</span>
                      <span aria-hidden="true">·</span>
                      <span className="text-slate-500">Severity: {log.severity}</span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1">{log.details}</p>
                  </div>

                  {log.resolved ? (
                    <span className="text-xs text-slate-500 flex items-center gap-1 shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Resolved
                    </span>
                  ) : (
                    <button
                      onClick={() => handleResolveSuspicious(log.id)}
                      className="min-h-[36px] px-3 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-xs text-white shrink-0"
                    >
                      Mark Reviewed
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SubTab 4: Users, Sessions & Points Transactions */}
      {subTab === 'users' && overview && (
        <div className="space-y-6">
          <div>
            <h4 className="text-sm font-semibold text-white mb-2.5">
              Registered Users ({overview.users.length})
            </h4>
            <div className="overflow-x-auto border border-white/10 rounded-2xl">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.02] text-slate-400">
                    <th className="py-2.5 px-4">UID</th>
                    <th className="py-2.5 px-4">User</th>
                    <th className="py-2.5 px-4">Role</th>
                    <th className="py-2.5 px-4">Node Tier</th>
                    <th className="py-2.5 px-4 text-right">Available PTS</th>
                    <th className="py-2.5 px-4 text-right">Lifetime PTS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {overview.users.map((u) => (
                    <tr key={u.id}>
                      <td className="py-2.5 px-4 font-mono-tabular text-slate-300">{u.uid}</td>
                      <td className="py-2.5 px-4 text-white">
                        {u.displayName} <span className="text-slate-500">({u.email})</span>
                      </td>
                      <td className="py-2.5 px-4 text-orange-400 font-medium">{u.role}</td>
                      <td className="py-2.5 px-4 font-mono-tabular">Tier {u.nodeLevel}</td>
                      <td className="py-2.5 px-4 font-mono-tabular text-right font-semibold text-orange-400">
                        {u.availablePoints.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-4 font-mono-tabular text-right text-slate-300">
                        {u.lifetimeEarned.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white mb-2.5">
              Recent Global Points Ledger ({overview.transactions.length})
            </h4>
            <div className="overflow-x-auto border border-white/10 rounded-2xl max-h-64">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/10 bg-white/[0.02] text-slate-400">
                    <th className="py-2.5 px-4">Tx ID</th>
                    <th className="py-2.5 px-4">User</th>
                    <th className="py-2.5 px-4">Activity</th>
                    <th className="py-2.5 px-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/10">
                  {overview.transactions.slice(0, 15).map((tx) => (
                    <tr key={tx.id}>
                      <td className="py-2 px-4 font-mono-tabular text-slate-400">{tx.id}</td>
                      <td className="py-2 px-4 text-slate-300">{tx.userEmail}</td>
                      <td className="py-2 px-4 text-white">{tx.title}</td>
                      <td
                        className={`py-2 px-4 font-mono-tabular text-right font-semibold ${
                          tx.amount >= 0 ? 'text-orange-400' : 'text-slate-400'
                        }`}
                      >
                        {tx.amount >= 0 ? `+${tx.amount}` : tx.amount} PTS
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
