export interface UserProfile {
  id: string;
  uid: string;
  email: string;
  displayName: string;
  role: 'user' | 'admin';
  availablePoints: number;
  lifetimeEarned: number;
  pointsSpent: number;
  nodeLevel: number;
  streakDays: number;
  lastCheckInDate: string | null;
  createdAt: string;
  referralCode?: string;
  referredBy?: string | null;
  referralCount?: number;
  referralPointsEarned?: number;
  namiBoostExpiresAt?: string | null;
  namiBoostEnabled?: boolean;
  settings: {
    sessionAlerts: boolean;
    compactLedger: boolean;
    telemetryOverlay: boolean;
    themeGlow: 'orange' | 'amber';
    themeMode?: 'dark' | 'light';
  };
}

export interface NodeSession {
  id: string;
  userId: string;
  userEmail: string;
  nodeLevel: number;
  status: 'active' | 'completed' | 'stopped';
  startedAt: string;
  targetEndAt: string;
  completedAt: string | null;
  durationSeconds: number;
  baseReward: number;
  multiplier: number;
  namiBoostActive?: boolean;
  streakBonus: number;
  pointsAwarded: number;
}

export interface PointsTransaction {
  id: string;
  userId: string;
  userEmail: string;
  type:
    | 'node_run'
    | 'task_reward'
    | 'daily_checkin'
    | 'node_upgrade'
    | 'admin_adjustment'
    | 'referral_bonus'
    | 'nami_boost';
  title: string;
  amount: number;
  balanceAfter: number;
  status: 'verified' | 'completed' | 'spent';
  referenceId: string;
  createdAt: string;
}

export interface TaskItem {
  id: string;
  title: string;
  description: string;
  category: 'daily' | 'social' | 'ecosystem';
  points: number;
  verificationType: 'checkin' | 'node_session_count' | 'url_visit' | 'social_handle' | 'share_link';
  actionUrl?: string;
  requiredCount?: number;
  minDwellSeconds?: number;
  active: boolean;
}

export interface UserTaskRecord {
  id: string;
  userId: string;
  taskId: string;
  status: 'initiated' | 'verified';
  initiatedAt: string;
  verifiedAt: string | null;
  proofInput: string | null;
  dateKey: string;
  pointsAwarded: number;
}

export interface NodeTier {
  level: number;
  name: string;
  subtitle: string;
  cost: number;
  multiplier: number;
  dailyLimitBonus: number;
  bandwidthSpec: string;
}

export interface SystemConfig {
  basePointsPerSession: number;
  sessionDurationSeconds: number;
  cooldownSeconds: number;
  dailyPointLimit: number;
  maxDailySessions: number;
  dailyCheckInBasePoints: number;
  streakBonusPerDay: number;
  campaignPaused: boolean;
  nodeTiers: NodeTier[];
}

export interface LeaderboardEntry {
  rank: number;
  id: string;
  uid: string;
  displayName: string;
  nodeLevel: number;
  streakDays: number;
  lifetimeEarned: number;
  availablePoints: number;
  referralCount: number;
  isCurrentUser?: boolean;
}

export interface ReferredUserEntry {
  id: string;
  uid: string;
  displayName: string;
  createdAt: string;
  nodeLevel: number;
  bonusAwarded: number;
}

export interface ReferralSummary {
  referralCode: string;
  referralCount: number;
  referralPointsEarned: number;
  bonusPerInvite: number;
  referredUsers: ReferredUserEntry[];
}

export interface DashboardPayload {
  serverNow: string;
  user: UserProfile;
  stats: {
    todayEarned: number;
    effectiveDailyCap: number;
    sessionsCompletedToday: number;
    maxDailySessions: number;
    cooldownRemainingSeconds: number;
    completedTasksCount: number;
    totalNodePointsEarned: number;
    checkedInToday: boolean;
  };
  leaderboard?: LeaderboardEntry[];
  userGlobalRank?: number;
  referrals?: ReferralSummary;
  activeSession: NodeSession | null;
  nodeHistory: NodeSession[];
  transactions: PointsTransaction[];
  tasks: TaskItem[];
  userTaskRecords: UserTaskRecord[];
  config: SystemConfig;
}

export interface SuspiciousLog {
  id: string;
  userId: string;
  userEmail: string;
  eventType: string;
  severity: 'low' | 'medium' | 'high';
  details: string;
  createdAt: string;
  resolved: boolean;
}

export interface AdminOverviewPayload {
  config: SystemConfig;
  users: UserProfile[];
  nodeSessions: NodeSession[];
  transactions: PointsTransaction[];
  tasks: TaskItem[];
  suspiciousLogs: SuspiciousLog[];
}

export type MainTab = 'home' | 'noderun' | 'tasks' | 'profile';

export const NAMI_LOGO_PATH = '/assets/aistudio/file_00000000fd6c81fab0f540355b189b4a_75d0c2f6.png';

/**
 * Clearly labeled demo preview state when viewing dashboard in Demo Preview Mode
 */
export const DEMO_PREVIEW_DATA: DashboardPayload = {
  serverNow: new Date().toISOString(),
  user: {
    id: 'demo-preview',
    uid: 'NAMI-DEMO-0001',
    email: 'demo.preview@namiwallet.io',
    displayName: 'Demo Preview Operator',
    role: 'user',
    availablePoints: 1850,
    lifetimeEarned: 2300,
    pointsSpent: 450,
    nodeLevel: 2,
    streakDays: 4,
    lastCheckInDate: null,
    createdAt: new Date(Date.now() - 28 * 86400000).toISOString(),
    referralCode: 'NAMI-DEMO-0001',
    referredBy: null,
    referralCount: 2,
    referralPointsEarned: 500,
    settings: {
      sessionAlerts: true,
      compactLedger: false,
      telemetryOverlay: true,
      themeGlow: 'orange',
    },
  },
  stats: {
    todayEarned: 380,
    effectiveDailyCap: 3000,
    sessionsCompletedToday: 2,
    maxDailySessions: 12,
    cooldownRemainingSeconds: 0,
    completedTasksCount: 3,
    totalNodePointsEarned: 1120,
    checkedInToday: false,
  },
  leaderboard: [
    { rank: 1, id: 'lb-1', uid: 'NAMI-99FA-01E2', displayName: 'Solaris Prime', nodeLevel: 4, streakDays: 19, lifetimeEarned: 10270, availablePoints: 5820, referralCount: 7 },
    { rank: 2, id: 'lb-2', uid: 'NAMI-44C1-88B7', displayName: 'Nyx Valkyrie', nodeLevel: 4, streakDays: 14, lifetimeEarned: 8640, availablePoints: 4190, referralCount: 5 },
    { rank: 3, id: 'lb-3', uid: 'NAMI-3D09-71AA', displayName: 'Zephyr Kurosawa', nodeLevel: 3, streakDays: 11, lifetimeEarned: 6260, availablePoints: 4610, referralCount: 4 },
    { rank: 4, id: 'lb-4', uid: 'NAMI-82E4-19F0', displayName: 'Lyra Thorne', nodeLevel: 3, streakDays: 9, lifetimeEarned: 5140, availablePoints: 3490, referralCount: 3 },
    { rank: 5, id: 'lb-5', uid: 'NAMI-55A8-63D2', displayName: 'Orion Mercer', nodeLevel: 3, streakDays: 7, lifetimeEarned: 4280, availablePoints: 2630, referralCount: 2 },
    { rank: 6, id: 'lb-6', uid: 'NAMI-01AD-99FF', displayName: 'Akash Operator', nodeLevel: 2, streakDays: 5, lifetimeEarned: 3930, availablePoints: 3480, referralCount: 2 },
    { rank: 7, id: 'lb-7', uid: 'NAMI-12F7-40C9', displayName: 'Vesper Lin', nodeLevel: 2, streakDays: 6, lifetimeEarned: 3040, availablePoints: 2590, referralCount: 1 },
    { rank: 8, id: 'lb-8', uid: 'NAMI-67B3-92E1', displayName: 'Cassian Holt', nodeLevel: 2, streakDays: 4, lifetimeEarned: 2390, availablePoints: 1940, referralCount: 1 },
    { rank: 9, id: 'demo-preview', uid: 'NAMI-DEMO-0001', displayName: 'Demo Preview Operator', nodeLevel: 2, streakDays: 4, lifetimeEarned: 2300, availablePoints: 1850, referralCount: 2, isCurrentUser: true },
    { rank: 10, id: 'lb-10', uid: 'NAMI-29D4-81C5', displayName: 'Soren Lindqvist', nodeLevel: 2, streakDays: 4, lifetimeEarned: 1940, availablePoints: 1490, referralCount: 0 },
  ],
  userGlobalRank: 9,
  referrals: {
    referralCode: 'NAMI-DEMO-0001',
    referralCount: 2,
    referralPointsEarned: 500,
    bonusPerInvite: 250,
    referredUsers: [
      { id: 'ref-1', uid: 'NAMI-7B3E-22C0', displayName: 'Kaelen Vance', createdAt: new Date(Date.now() - 5 * 86400000).toISOString(), nodeLevel: 1, bonusAwarded: 250 },
      { id: 'ref-2', uid: 'NAMI-55A8-63D2', displayName: 'Orion Mercer', createdAt: new Date(Date.now() - 12 * 86400000).toISOString(), nodeLevel: 3, bonusAwarded: 250 },
    ],
  },
  activeSession: null,
  nodeHistory: [
    {
      id: 'demo-ns-01',
      userId: 'demo-preview',
      userEmail: 'demo.preview@namiwallet.io',
      nodeLevel: 2,
      status: 'completed',
      startedAt: new Date(Date.now() - 3600000).toISOString(),
      targetEndAt: new Date(Date.now() - 3555000).toISOString(),
      completedAt: new Date(Date.now() - 3554000).toISOString(),
      durationSeconds: 25200,
      baseReward: 120,
      multiplier: 1.5,
      streakBonus: 20,
      pointsAwarded: 200,
    },
  ],
  transactions: [
    {
      id: 'demo-tx-01',
      userId: 'demo-preview',
      userEmail: 'demo.preview@namiwallet.io',
      type: 'node_run',
      title: '[DEMO] Node Run Session #demo-ns-01 Verified (1.5x Tier 2)',
      amount: 200,
      balanceAfter: 1850,
      status: 'verified',
      referenceId: 'demo-ns-01',
      createdAt: new Date(Date.now() - 3554000).toISOString(),
    },
    {
      id: 'demo-tx-02',
      userId: 'demo-preview',
      userEmail: 'demo.preview@namiwallet.io',
      type: 'task_reward',
      title: '[DEMO] Follow Official NAMI Account on X',
      amount: 180,
      balanceAfter: 1650,
      status: 'verified',
      referenceId: 'task-follow-x',
      createdAt: new Date(Date.now() - 7200000).toISOString(),
    },
    {
      id: 'demo-tx-03',
      userId: 'demo-preview',
      userEmail: 'demo.preview@namiwallet.io',
      type: 'node_upgrade',
      title: '[DEMO] Upgraded to Tier 2: NAMI Flux Validator',
      amount: -450,
      balanceAfter: 1470,
      status: 'spent',
      referenceId: 'TIER-2-UPGRADE',
      createdAt: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: 'demo-tx-04',
      userId: 'demo-preview',
      userEmail: 'demo.preview@namiwallet.io',
      type: 'node_run',
      title: '[DEMO] Node Run Session Verified (1.5x Tier 2)',
      amount: 310,
      balanceAfter: 1920,
      status: 'verified',
      referenceId: 'demo-ns-00',
      createdAt: new Date(Date.now() - 1 * 86400000 - 3600000).toISOString(),
    },
    {
      id: 'demo-tx-05',
      userId: 'demo-preview',
      userEmail: 'demo.preview@namiwallet.io',
      type: 'daily_checkin',
      title: '[DEMO] Daily Operator Check-In + Node Session',
      amount: 265,
      balanceAfter: 1610,
      status: 'verified',
      referenceId: 'CHECKIN-DEMO-2',
      createdAt: new Date(Date.now() - 2 * 86400000 - 3600000).toISOString(),
    },
    {
      id: 'demo-tx-06',
      userId: 'demo-preview',
      userEmail: 'demo.preview@namiwallet.io',
      type: 'node_run',
      title: '[DEMO] Node Run Session Verified',
      amount: 220,
      balanceAfter: 1345,
      status: 'verified',
      referenceId: 'demo-ns-d3',
      createdAt: new Date(Date.now() - 3 * 86400000 - 3600000).toISOString(),
    },
    {
      id: 'demo-tx-07',
      userId: 'demo-preview',
      userEmail: 'demo.preview@namiwallet.io',
      type: 'task_reward',
      title: '[DEMO] Joined Official NAMI Telegram Community',
      amount: 250,
      balanceAfter: 1125,
      status: 'verified',
      referenceId: 'task-join-telegram',
      createdAt: new Date(Date.now() - 4 * 86400000 - 3600000).toISOString(),
    },
    {
      id: 'demo-tx-08',
      userId: 'demo-preview',
      userEmail: 'demo.preview@namiwallet.io',
      type: 'node_run',
      title: '[DEMO] Node Run Session Verified',
      amount: 195,
      balanceAfter: 875,
      status: 'verified',
      referenceId: 'demo-ns-d5',
      createdAt: new Date(Date.now() - 5 * 86400000 - 3600000).toISOString(),
    },
    {
      id: 'demo-tx-09',
      userId: 'demo-preview',
      userEmail: 'demo.preview@namiwallet.io',
      type: 'task_reward',
      title: '[DEMO] Genesis Operator Activation Bonus',
      amount: 160,
      balanceAfter: 680,
      status: 'verified',
      referenceId: 'GENESIS-DEMO',
      createdAt: new Date(Date.now() - 6 * 86400000 - 3600000).toISOString(),
    },
    ...Array.from({ length: 23 }, (_, idx) => {
      const daysAgo = idx + 7;
      const pts = 120 + ((daysAgo * 37) % 190);
      return {
        id: `demo-tx-hist-${daysAgo}`,
        userId: 'demo-preview',
        userEmail: 'demo.preview@namiwallet.io',
        type: (daysAgo % 3 === 0 ? 'task_reward' : 'node_run') as 'task_reward' | 'node_run',
        title: `[DEMO] Historical Day -${daysAgo} Verified Node & Ecosystem Yield`,
        amount: pts,
        balanceAfter: 500 + pts,
        status: 'verified' as const,
        referenceId: `DEMO-HIST-${daysAgo}`,
        createdAt: new Date(Date.now() - daysAgo * 86400000 - 7200000).toISOString(),
      };
    }),
  ],
  tasks: [
    {
      id: 'task-daily-checkin',
      title: 'Daily Operator Check-In',
      description: 'Verify your daily presence in the NAMI network to claim base points and increment your streak multiplier.',
      category: 'daily',
      points: 75,
      verificationType: 'checkin',
      active: true,
    },
    {
      id: 'task-daily-node-run',
      title: 'Complete a Verified Node Run Session',
      description: 'Run and complete at least 1 full Node Run session today with server-side telemetry verification.',
      category: 'daily',
      points: 150,
      verificationType: 'node_session_count',
      requiredCount: 1,
      active: true,
    },
  ],
  userTaskRecords: [],
  config: {
    basePointsPerSession: 120,
    sessionDurationSeconds: 25200,
    cooldownSeconds: 15,
    dailyPointLimit: 2400,
    maxDailySessions: 12,
    dailyCheckInBasePoints: 75,
    streakBonusPerDay: 15,
    campaignPaused: false,
    nodeTiers: [
      {
        level: 1,
        name: 'NAMI Light Relay',
        subtitle: 'Standard entry node with baseline telemetry verification',
        cost: 0,
        multiplier: 1.0,
        dailyLimitBonus: 0,
        bandwidthSpec: '1.0x Base Yield · Standard Cooldown',
      },
      {
        level: 2,
        name: 'NAMI Flux Validator',
        subtitle: 'Dual-channel packet verification with elevated session yield',
        cost: 450,
        multiplier: 1.5,
        dailyLimitBonus: 600,
        bandwidthSpec: '1.5x Yield Multiplier · +600 Daily Cap',
      },
    ],
  },
};

export function formatDurationCompact(seconds: number): string {
  if (seconds >= 3600 && seconds % 3600 === 0) {
    return `${seconds / 3600}h`;
  }
  if (seconds >= 3600) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    if (m === 0 && s === 0) return `${h}h`;
    if (s === 0) return `${h}h ${m}m`;
    return `${h}h ${m}m ${s}s`;
  }
  if (seconds >= 60 && seconds % 60 === 0) {
    return `${seconds / 60}m`;
  }
  if (seconds >= 60) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}m ${s}s`;
  }
  return `${Math.ceil(seconds)}s`;
}

export function formatClockTimer(sec: number): string {
  const safeSec = Math.max(0, Math.floor(sec));
  const h = Math.floor(safeSec / 3600);
  const m = Math.floor((safeSec % 3600) / 60);
  const s = safeSec % 60;
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

