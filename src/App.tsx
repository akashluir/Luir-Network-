/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useCallback } from 'react';
import { Home, Cpu, ListChecks, User, AlertCircle, CheckCircle2 } from 'lucide-react';
import {
  DashboardPayload,
  DEMO_PREVIEW_DATA,
  MainTab,
  UserProfile,
} from './types/nami.ts';
import { AuthView } from './components/AuthView.tsx';
import { HomeDashboardView } from './components/HomeDashboardView.tsx';
import { NodeRunView } from './components/NodeRunView.tsx';
import { TasksView } from './components/TasksView.tsx';
import { ProfileView } from './components/ProfileView.tsx';
import { PointsWalletSheet } from './components/PointsWalletSheet.tsx';
import {
  requestBrowserNotificationPermission,
  triggerNodeRunCompletionNotification,
} from './utils/notifications.ts';

const STORAGE_TOKEN_KEY = 'nami_wallet_session_token_v1';
const STORAGE_THEME_KEY = 'nami_wallet_theme_mode_v1';

export default function App() {
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(STORAGE_TOKEN_KEY)
  );
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>(() => {
    const saved = localStorage.getItem(STORAGE_THEME_KEY);
    return saved === 'light' ? 'light' : 'dark';
  });
  const [isDemoPreview, setIsDemoPreview] = useState<boolean>(false);
  const [dashboardData, setDashboardData] = useState<DashboardPayload | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<MainTab>('home');
  const [isLedgerOpen, setIsLedgerOpen] = useState<boolean>(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [bannerAlert, setBannerAlert] = useState<{
    type: 'error' | 'success';
    text: string;
  } | null>(null);

  // Live 1-second ticker synchronized with server timestamps
  const [serverOffsetMs, setServerOffsetMs] = useState<number>(0);
  const [nowTickMs, setNowTickMs] = useState<number>(() => Date.now());
  const [localCooldownEndMs, setLocalCooldownEndMs] = useState<number>(0);
  const [notifiedSessionIds, setNotifiedSessionIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    localStorage.setItem(STORAGE_THEME_KEY, themeMode);
    if (themeMode === 'light') {
      document.body.classList.add('theme-high-contrast-light');
    } else {
      document.body.classList.remove('theme-high-contrast-light');
    }
  }, [themeMode]);

  const handleChangeThemeMode = useCallback((mode: 'dark' | 'light') => {
    setThemeMode(mode);
  }, []);

  const handleToggleThemeMode = useCallback(() => {
    setThemeMode((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const showBanner = (type: 'error' | 'success', text: string) => {
    setBannerAlert({ type, text });
    setTimeout(() => {
      setBannerAlert((prev) => (prev?.text === text ? null : prev));
    }, 5000);
  };

  const fetchDashboard = useCallback(
    async (overrideToken?: string | null) => {
      const activeToken = overrideToken !== undefined ? overrideToken : token;
      if (!activeToken) {
        setLoading(false);
        return;
      }

      try {
        const res = await fetch('/api/dashboard', {
          headers: { Authorization: `Bearer ${activeToken}` },
        });
        if (res.status === 401) {
          localStorage.removeItem(STORAGE_TOKEN_KEY);
          setToken(null);
          setDashboardData(null);
          setLoading(false);
          return;
        }
        const data: DashboardPayload = await res.json();
        if (!res.ok) {
          throw new Error((data as any).error || 'Failed to load dashboard');
        }

        const serverTimeMs = new Date(data.serverNow).getTime();
        const clientNowMs = Date.now();
        setServerOffsetMs(serverTimeMs - clientNowMs);
        setNowTickMs(clientNowMs);

        if (data.stats.cooldownRemainingSeconds > 0) {
          setLocalCooldownEndMs(
            clientNowMs + data.stats.cooldownRemainingSeconds * 1000
          );
        } else {
          setLocalCooldownEndMs(0);
        }

        setDashboardData(data);
      } catch (err: any) {
        showBanner('error', err.message || 'Unable to sync with NAMI server.');
      } finally {
        setLoading(false);
      }
    },
    [token]
  );

  useEffect(() => {
    if (token) {
      fetchDashboard(token);
    } else {
      setLoading(false);
    }
  }, [token, fetchDashboard]);

  // 1-second timer interval for active node runs or cooldowns
  useEffect(() => {
    const timer = setInterval(() => {
      setNowTickMs(Date.now());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const handleAuthSuccess = ( _user: UserProfile, newToken: string) => {
    localStorage.setItem(STORAGE_TOKEN_KEY, newToken);
    setIsDemoPreview(false);
    setToken(newToken);
    setLoading(true);
    fetchDashboard(newToken);
  };

  const handleLogout = async () => {
    if (token) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        // Ignore network errors on logout
      }
    }
    localStorage.removeItem(STORAGE_TOKEN_KEY);
    setToken(null);
    setDashboardData(null);
    setIsDemoPreview(false);
    setActiveTab('home');
  };

  const handleQuickSwitchAccount = async (preset: 'demo' | 'admin') => {
    try {
      setBusyAction('switch');
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quickPreset: preset }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Switch failed');
      handleAuthSuccess(data.user, data.token);
      showBanner('success', `Switched to ${data.user.displayName} (${data.user.role}).`);
    } catch (err: any) {
      showBanner('error', err.message);
    } finally {
      setBusyAction(null);
    }
  };

  const requireLiveAuth = (): boolean => {
    if (isDemoPreview || !token) {
      showBanner(
        'error',
        'Demo Preview Mode active. Please sign in to execute server-verified reward operations.'
      );
      return false;
    }
    return true;
  };

  // --- ACTIONS ---

  const handleClaimDailyCheckIn = async () => {
    if (!requireLiveAuth()) return;
    setBusyAction('checkin');
    try {
      const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Check-in failed');
      showBanner(
        'success',
        `Daily check-in verified! +${data.pointsAwarded} NAMI Points added (${data.streakDays}-day streak).`
      );
      await fetchDashboard();
    } catch (err: any) {
      showBanner('error', err.message);
    } finally {
      setBusyAction(null);
    }
  };

  const handleStartNodeRun = async () => {
    if (!requireLiveAuth()) return;
    setBusyAction('start');
    try {
      // Request browser Notification API permission when starting a Node Run
      if (dashboardData?.user?.settings?.sessionAlerts !== false) {
        requestBrowserNotificationPermission().catch(() => {});
      }

      const res = await fetch('/api/node/start', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to start Node Run');
      showBanner('success', 'Node Run session started! Server telemetry timer active.');
      await fetchDashboard();
    } catch (err: any) {
      showBanner('error', err.message);
    } finally {
      setBusyAction(null);
    }
  };

  const handleStopOrClaimNodeRun = async (mode: 'claim' | 'stop') => {
    if (!requireLiveAuth()) return;
    const activeSessionId = dashboardData?.activeSession?.id;
    if (!activeSessionId) return;

    setBusyAction(mode);
    try {
      const res = await fetch('/api/node/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ sessionId: activeSessionId, mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to process Node Run');
      showBanner('success', data.message || 'Node Run session processed.');
      await fetchDashboard();
    } catch (err: any) {
      showBanner('error', err.message);
    } finally {
      setBusyAction(null);
    }
  };

  const handleUpgradeNode = async (targetLevel: number) => {
    if (!requireLiveAuth()) return;
    setBusyAction(`upgrade-${targetLevel}`);
    try {
      const res = await fetch('/api/node/upgrade', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ targetLevel }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upgrade failed');
      showBanner(
        'success',
        `Upgraded to Tier ${targetLevel}: ${data.tier.name} (${data.tier.multiplier}x Yield)!`
      );
      await fetchDashboard();
    } catch (err: any) {
      showBanner('error', err.message);
    } finally {
      setBusyAction(null);
    }
  };

  const handleNamiBoostAction = async (action: 'activate' | 'toggle') => {
    if (!requireLiveAuth()) return;
    setBusyAction('boost');
    try {
      const res = await fetch('/api/node/boost', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not update Nami Boost');
      showBanner('success', data.message || 'Nami Boost updated.');
      await fetchDashboard();
    } catch (err: any) {
      showBanner('error', err.message);
    } finally {
      setBusyAction(null);
    }
  };

  const handleInitiateTask = async (taskId: string) => {
    if (!requireLiveAuth()) return;
    setBusyAction(taskId);
    try {
      const res = await fetch('/api/tasks/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ taskId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to initiate task');
      await fetchDashboard();
    } catch (err: any) {
      showBanner('error', err.message);
    } finally {
      setBusyAction(null);
    }
  };

  const handleVerifyTask = async (taskId: string, proofInput?: string) => {
    if (!requireLiveAuth()) return;
    setBusyAction(taskId);
    try {
      const res = await fetch('/api/tasks/verify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ taskId, proofInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Task verification failed');
      showBanner(
        'success',
        `Task verified! +${data.pointsAwarded} NAMI Points credited to your internal ledger.`
      );
      await fetchDashboard();
    } catch (err: any) {
      showBanner('error', err.message);
    } finally {
      setBusyAction(null);
    }
  };

  const handleUpdateProfile = async (
    displayName: string,
    settings: UserProfile['settings']
  ) => {
    if (!requireLiveAuth()) return;
    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ displayName, settings }),
    });
    const data = await res.json();
    if (!res.ok) {
      showBanner('error', data.error || 'Failed to update profile');
      throw new Error(data.error);
    }
    await fetchDashboard();
  };

  const handleRegisterReferredFriend = async (
    friendName: string,
    friendEmail: string
  ) => {
    if (!requireLiveAuth()) return;
    setBusyAction('referral');
    try {
      const res = await fetch('/api/referrals/register-friend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ friendName, friendEmail }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Referral registration failed');
      showBanner(
        'success',
        `Referral verified! ${data.invitedFriend.displayName} (${data.invitedFriend.uid}) joined — +${data.pointsAwarded} NAMI Points credited!`
      );
      await fetchDashboard();
    } catch (err: any) {
      showBanner('error', err.message);
    } finally {
      setBusyAction(null);
    }
  };

  const effectiveData: DashboardPayload = isDemoPreview
    ? DEMO_PREVIEW_DATA
    : dashboardData || DEMO_PREVIEW_DATA;

  const isUsingDemoFallback = isDemoPreview || !dashboardData;

  // Compute live session timer & progress from server clock
  const syncedServerNowMs = nowTickMs + serverOffsetMs;
  let remainingSessionSec = 0;
  let progressPercent = 0;

  if (effectiveData.activeSession && effectiveData.activeSession.status === 'active') {
    const startMs = new Date(effectiveData.activeSession.startedAt).getTime();
    const endMs = new Date(effectiveData.activeSession.targetEndAt).getTime();
    const totalMs = Math.max(1000, endMs - startMs);
    const elapsedMs = Math.max(0, syncedServerNowMs - startMs);
    remainingSessionSec = Math.max(0, Math.ceil((endMs - syncedServerNowMs) / 1000));
    progressPercent = Math.min(100, (elapsedMs / totalMs) * 100);
  }

  const cooldownSec = Math.max(
    0,
    Math.ceil((localCooldownEndMs - nowTickMs) / 1000)
  );

  const boostRemainingSec = effectiveData.user.namiBoostExpiresAt
    ? Math.max(
        0,
        Math.ceil(
          (new Date(effectiveData.user.namiBoostExpiresAt).getTime() - syncedServerNowMs) / 1000
        )
      )
    : 0;

  // Trigger Browser Notification API alert when an active Node Run reaches completion (especially when tab is minimized/hidden)
  useEffect(() => {
    const active = dashboardData?.activeSession;
    if (!active || active.status !== 'active') {
      document.title = 'NAMI WALLET — Web3 Node Run & Points System';
      return;
    }

    if (remainingSessionSec <= 0 && !notifiedSessionIds[active.id]) {
      setNotifiedSessionIds((prev) => ({ ...prev, [active.id]: true }));

      const expectedPts = Math.round(
        active.baseReward * active.multiplier + active.streakBonus
      );
      const isTabMinimized = document.hidden || document.visibilityState === 'hidden';

      if (dashboardData?.user?.settings?.sessionAlerts !== false) {
        triggerNodeRunCompletionNotification({
          title: isTabMinimized
            ? 'NAMI WALLET · Background Node Run Complete!'
            : 'NAMI WALLET · Node Run Cycle Complete!',
          body: `Session #${active.id} reached 100%. Return to NAMI WALLET to verify & claim +${expectedPts} NAMI Points.`,
          tag: `node-complete-${active.id}`,
          onFocusClick: () => setActiveTab('noderun'),
        });
      }

      if (isTabMinimized) {
        document.title = `(1) Node Ready (+${expectedPts} PTS) — NAMI WALLET`;
      }

      showBanner(
        'success',
        `Node Run session #${active.id} reached 100%! Click "Claim Verified +${expectedPts} PTS" to credit your ledger.`
      );
    } else if (remainingSessionSec > 0 && (document.hidden || document.visibilityState === 'hidden')) {
      document.title = `[Running] NAMI WALLET Node Run`;
    } else if (remainingSessionSec > 0) {
      document.title = 'NAMI WALLET — Web3 Node Run & Points System';
    }
  }, [
    remainingSessionSec,
    dashboardData?.activeSession,
    dashboardData?.user?.settings?.sessionAlerts,
    notifiedSessionIds,
  ]);

  // --- RENDER AUTH SCREEN IF NOT LOGGED IN AND NOT IN DEMO PREVIEW ---
  if (!token && !isDemoPreview) {
    return (
      <AuthView
        onAuthSuccess={handleAuthSuccess}
        onEnterDemoPreview={() => {
          setIsDemoPreview(true);
          setActiveTab('home');
        }}
      />
    );
  }

  return (
    <div
      className={`min-h-screen bg-[#07080c] text-slate-100 pb-24 relative ${
        themeMode === 'light' ? 'theme-high-contrast-light' : ''
      }`}
    >
      {/* Ambient Futuristic Orange Glow */}
      <div className="fixed -top-40 left-1/2 -translate-x-1/2 w-[640px] h-[360px] rounded-full bg-orange-500/10 blur-[140px] pointer-events-none z-0" />

      {/* 3-Zone Top Bar Contract */}
      <header className="sticky top-0 z-30 h-14 flex items-center justify-between gap-8 px-4 sm:px-8 nami-glass border-b border-white/10">
        {/* Zone 1: Single text element wordmark */}
        <button
          onClick={() => setActiveTab('home')}
          className="text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0 font-display"
        >
          NAMI WALLET
        </button>

        {/* Zone 2: 4 clean single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
          {(
            [
              { id: 'home', label: 'Home' },
              { id: 'noderun', label: 'Node Run' },
              { id: 'tasks', label: 'Tasks' },
              { id: 'profile', label: 'Profile' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`hover:text-white transition-colors whitespace-nowrap shrink-0 py-1 ${
                activeTab === item.id
                  ? 'text-orange-400 underline underline-offset-8 decoration-2 decoration-orange-500'
                  : ''
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          {isDemoPreview ? (
            <button
              onClick={() => setIsDemoPreview(false)}
              className="px-4 py-2 text-xs font-semibold rounded-xl nami-btn-glow whitespace-nowrap shrink-0"
            >
              Sign In to Live Wallet
            </button>
          ) : (
            <button
              onClick={() => setIsLedgerOpen(true)}
              className="px-3.5 py-1.5 text-xs font-semibold font-mono-tabular rounded-xl nami-btn-glow whitespace-nowrap shrink-0"
            >
              {effectiveData.user.availablePoints.toLocaleString()} NAMI PTS
            </button>
          )}
        </div>
      </header>

      {/* Main Content Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-8 pt-6 space-y-6 relative z-10">
        {/* Demo Data Banner if in Demo Preview Mode */}
        {isUsingDemoFallback && (
          <div className="p-4 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex flex-wrap items-center justify-between gap-3 text-xs text-amber-200">
            <div className="flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />
              <span>
                <strong>DEMO PREVIEW DATA:</strong> You are viewing clearly labeled demo data. Sign in to connect to your live server-verified NAMI Points account.
              </span>
            </div>
            <button
              onClick={() => setIsDemoPreview(false)}
              className="px-3.5 py-1.5 rounded-lg bg-amber-400 text-slate-950 font-semibold whitespace-nowrap shrink-0"
            >
              Sign In Now
            </button>
          </div>
        )}

        {/* Toast / Feedback Banner */}
        {bannerAlert && (
          <div
            className={`p-4 rounded-2xl border flex items-center justify-between gap-3 text-xs ${
              bannerAlert.type === 'error'
                ? 'bg-red-500/15 border-red-500/35 text-red-200'
                : 'bg-orange-500/15 border-orange-500/40 text-orange-200'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {bannerAlert.type === 'error' ? (
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              ) : (
                <CheckCircle2 className="w-4 h-4 text-orange-400 shrink-0" />
              )}
              <span>{bannerAlert.text}</span>
            </div>
            <button
              onClick={() => setBannerAlert(null)}
              className="text-slate-300 hover:text-white font-medium"
            >
              Close
            </button>
          </div>
        )}

        {loading && !dashboardData && !isDemoPreview ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 h-64 rounded-3xl bg-white/[0.03] border border-white/10 animate-pulse" />
            <div className="lg:col-span-4 h-64 rounded-3xl bg-white/[0.03] border border-white/10 animate-pulse" />
          </div>
        ) : (
          <>
            {activeTab === 'home' && (
              <HomeDashboardView
                data={effectiveData}
                isDemoMode={isUsingDemoFallback}
                remainingSessionSec={remainingSessionSec}
                onNavigateTab={setActiveTab}
                onOpenPointsLedger={() => setIsLedgerOpen(true)}
                onClaimDailyCheckIn={handleClaimDailyCheckIn}
                checkingIn={busyAction === 'checkin'}
                onRegisterReferredFriend={handleRegisterReferredFriend}
                busyReferral={busyAction === 'referral'}
                themeMode={themeMode}
                onToggleThemeMode={handleToggleThemeMode}
              />
            )}

            {activeTab === 'noderun' && (
              <NodeRunView
                data={effectiveData}
                isDemoMode={isUsingDemoFallback}
                remainingSessionSec={remainingSessionSec}
                progressPercent={progressPercent}
                cooldownSec={cooldownSec}
                boostRemainingSec={boostRemainingSec}
                onStartNodeRun={handleStartNodeRun}
                onStopOrClaimNodeRun={handleStopOrClaimNodeRun}
                onUpgradeNode={handleUpgradeNode}
                onClaimDailyCheckIn={handleClaimDailyCheckIn}
                onNamiBoostAction={handleNamiBoostAction}
                busyAction={busyAction}
              />
            )}

            {activeTab === 'tasks' && (
              <TasksView
                data={effectiveData}
                isDemoMode={isUsingDemoFallback}
                onClaimDailyCheckIn={handleClaimDailyCheckIn}
                onInitiateTask={handleInitiateTask}
                onVerifyTask={handleVerifyTask}
                busyTaskId={busyAction}
              />
            )}

            {activeTab === 'profile' && (
              <ProfileView
                data={effectiveData}
                token={token}
                isDemoMode={isUsingDemoFallback}
                onUpdateProfile={handleUpdateProfile}
                onOpenPointsLedger={() => setIsLedgerOpen(true)}
                onLogout={handleLogout}
                onQuickSwitchAccount={handleQuickSwitchAccount}
                onRefreshDashboard={() => fetchDashboard()}
                onRegisterReferredFriend={handleRegisterReferredFriend}
                busyReferral={busyAction === 'referral'}
                themeMode={themeMode}
                onChangeThemeMode={handleChangeThemeMode}
              />
            )}
          </>
        )}
      </main>

      {/* Internal NAMI Points Ledger Modal / Drawer */}
      <PointsWalletSheet
        isOpen={isLedgerOpen}
        onClose={() => setIsLedgerOpen(false)}
        user={effectiveData.user}
        transactions={effectiveData.transactions}
        isDemoMode={isUsingDemoFallback}
      />

      {/* Premium Fixed Bottom Navigation Bar with EXACTLY 4 tabs: Home, Node Run, Tasks, Profile */}
      <nav
        aria-label="Primary Bottom Navigation"
        className="fixed bottom-0 left-0 right-0 z-40 h-16 nami-glass border-t border-white/10"
      >
        <div className="max-w-lg mx-auto h-full grid grid-cols-4 items-center px-2">
          <button
            onClick={() => setActiveTab('home')}
            className={`min-h-[44px] flex flex-col items-center justify-center transition-colors ${
              activeTab === 'home'
                ? 'text-orange-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Home className="w-5 h-5" />
            <span className="text-[11px] font-medium tracking-tight mt-1 whitespace-nowrap">
              Home
            </span>
          </button>

          <button
            onClick={() => setActiveTab('noderun')}
            className={`min-h-[44px] flex flex-col items-center justify-center transition-colors ${
              activeTab === 'noderun'
                ? 'text-orange-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-5 h-5" />
            <span className="text-[11px] font-medium tracking-tight mt-1 whitespace-nowrap">
              Node Run
            </span>
          </button>

          <button
            onClick={() => setActiveTab('tasks')}
            className={`min-h-[44px] flex flex-col items-center justify-center transition-colors ${
              activeTab === 'tasks'
                ? 'text-orange-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ListChecks className="w-5 h-5" />
            <span className="text-[11px] font-medium tracking-tight mt-1 whitespace-nowrap">
              Tasks
            </span>
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`min-h-[44px] flex flex-col items-center justify-center transition-colors ${
              activeTab === 'profile'
                ? 'text-orange-400'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <User className="w-5 h-5" />
            <span className="text-[11px] font-medium tracking-tight mt-1 whitespace-nowrap">
              Profile
            </span>
          </button>
        </div>
      </nav>
    </div>
  );
}
