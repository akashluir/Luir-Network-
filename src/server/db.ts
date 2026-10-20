import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface UserRecord {
  id: string;
  uid: string; // e.g. NAMI-8F92-4C1A
  email: string;
  passwordHash: string;
  displayName: string;
  role: 'user' | 'admin';
  availablePoints: number;
  lifetimeEarned: number;
  pointsSpent: number;
  nodeLevel: number;
  streakDays: number;
  lastCheckInDate: string | null; // YYYY-MM-DD
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

export interface NodeSessionRecord {
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

export interface TransactionRecord {
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
  amount: number; // positive for earn, negative for spend
  balanceAfter: number;
  status: 'verified' | 'completed' | 'spent';
  referenceId: string;
  createdAt: string;
}

export interface TaskDefinition {
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

export interface UserTaskVerification {
  id: string;
  userId: string;
  taskId: string;
  status: 'initiated' | 'verified';
  initiatedAt: string;
  verifiedAt: string | null;
  proofInput: string | null;
  dateKey: string; // YYYY-MM-DD for daily tasks, 'ONCE' for one-time tasks
  pointsAwarded: number;
}

export interface NodeTierConfig {
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
  sessionDurationSeconds: number; // Default 60s for responsive real-time testing
  cooldownSeconds: number;
  dailyPointLimit: number;
  maxDailySessions: number;
  dailyCheckInBasePoints: number;
  streakBonusPerDay: number;
  campaignPaused: boolean;
  nodeTiers: NodeTierConfig[];
}

export interface SuspiciousActivityRecord {
  id: string;
  userId: string;
  userEmail: string;
  eventType: 'duplicate_claim_attempt' | 'early_completion_attempt' | 'rapid_task_verify' | 'daily_limit_reached' | 'invalid_proof';
  severity: 'low' | 'medium' | 'high';
  details: string;
  createdAt: string;
  resolved: boolean;
}

export interface DatabaseSchema {
  users: UserRecord[];
  sessions: { token: string; userId: string; createdAt: string }[];
  nodeSessions: NodeSessionRecord[];
  transactions: TransactionRecord[];
  tasks: TaskDefinition[];
  userTasks: UserTaskVerification[];
  suspiciousLogs: SuspiciousActivityRecord[];
  config: SystemConfig;
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'nami_wallet_db.json');

export function hashPassword(password: string): string {
  const salt = 'nami_wallet_v1_salt_9c4d8469';
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

export function generateUid(): string {
  const part1 = crypto.randomBytes(2).toString('hex').toUpperCase();
  const part2 = crypto.randomBytes(2).toString('hex').toUpperCase();
  return `NAMI-${part1}-${part2}`;
}

export function getTodayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

const INITIAL_CONFIG: SystemConfig = {
  basePointsPerSession: 120,
  sessionDurationSeconds: 25200, // 7 hours (7h per session)
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
    {
      level: 3,
      name: 'NAMI Hyperion Core',
      subtitle: 'High-throughput isometric compute array for dedicated operators',
      cost: 1200,
      multiplier: 2.25,
      dailyLimitBonus: 1600,
      bandwidthSpec: '2.25x Yield Multiplier · +1,600 Daily Cap',
    },
    {
      level: 4,
      name: 'NAMI Genesis Mainframe',
      subtitle: 'Maximum tier orbital node cluster with priority reward routing',
      cost: 2800,
      multiplier: 3.5,
      dailyLimitBonus: 3600,
      bandwidthSpec: '3.5x Yield Multiplier · +3,600 Daily Cap',
    },
  ],
};

const INITIAL_TASKS: TaskDefinition[] = [
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
  {
    id: 'task-visit-website',
    title: 'Explore NAMI Protocol Documentation',
    description: 'Visit the official NAMI ecosystem portal and review the internal points ledger architecture.',
    category: 'ecosystem',
    points: 100,
    verificationType: 'url_visit',
    actionUrl: 'https://namiwallet.io/docs',
    minDwellSeconds: 5,
    active: true,
  },
  {
    id: 'task-follow-x',
    title: 'Follow Official NAMI Account on X',
    description: 'Follow @NamiWalletHQ on X and submit your handle for community verification.',
    category: 'social',
    points: 200,
    verificationType: 'social_handle',
    actionUrl: 'https://x.com',
    minDwellSeconds: 4,
    active: true,
  },
  {
    id: 'task-join-telegram',
    title: 'Join Official NAMI Telegram Community',
    description: 'Connect with global Node Run operators in the official Telegram channel and enter your username.',
    category: 'social',
    points: 250,
    verificationType: 'social_handle',
    actionUrl: 'https://t.me',
    minDwellSeconds: 4,
    active: true,
  },
  {
    id: 'task-share-update',
    title: 'Share Node Run Milestone Update',
    description: 'Share your NAMI Node Run status with your network and submit the post URL or confirmation code.',
    category: 'social',
    points: 180,
    verificationType: 'share_link',
    actionUrl: 'https://x.com/intent/post?text=Running+my+node+on+NAMI+WALLET',
    minDwellSeconds: 4,
    active: true,
  },
];

function createInitialDb(): DatabaseSchema {
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();
  const oneHourAgo = new Date(now.getTime() - 1 * 60 * 60 * 1000).toISOString();
  const thirtyMinsAgo = new Date(now.getTime() - 30 * 60 * 1000).toISOString();

  const adminUser: UserRecord = {
    id: 'usr-admin-1',
    uid: 'NAMI-01AD-99FF',
    email: 'akashluir@gmail.com',
    passwordHash: hashPassword('NamiAdmin2026!'),
    displayName: 'Akash Operator (Admin)',
    role: 'admin',
    availablePoints: 3480,
    lifetimeEarned: 3930,
    pointsSpent: 450,
    nodeLevel: 2,
    streakDays: 5,
    lastCheckInDate: yesterday,
    createdAt: new Date(now.getTime() - 30 * 86400000).toISOString(),
    referralCode: 'NAMI-01AD-99FF',
    referredBy: null,
    referralCount: 2,
    referralPointsEarned: 500,
    settings: {
      sessionAlerts: true,
      compactLedger: false,
      telemetryOverlay: true,
      themeGlow: 'orange',
    },
  };

  const demoUser: UserRecord = {
    id: 'usr-demo-2',
    uid: 'NAMI-7B3E-22C0',
    email: 'operator@namiwallet.io',
    passwordHash: hashPassword('NamiUser2026!'),
    displayName: 'Kaelen Vance',
    role: 'user',
    availablePoints: 1625,
    lifetimeEarned: 1625,
    pointsSpent: 0,
    nodeLevel: 1,
    streakDays: 3,
    lastCheckInDate: yesterday,
    createdAt: new Date(now.getTime() - 28 * 86400000).toISOString(),
    referralCode: 'NAMI-7B3E-22C0',
    referredBy: 'NAMI-01AD-99FF',
    referralCount: 1,
    referralPointsEarned: 250,
    settings: {
      sessionAlerts: true,
      compactLedger: false,
      telemetryOverlay: true,
      themeGlow: 'orange',
    },
  };

  const leaderboardPeers: UserRecord[] = [
    {
      id: 'usr-lb-1',
      uid: 'NAMI-99FA-01E2',
      email: 'solaris.core@namiwallet.io',
      passwordHash: hashPassword('NamiPeer2026!'),
      displayName: 'Solaris Prime',
      role: 'user',
      availablePoints: 5820,
      lifetimeEarned: 10270,
      pointsSpent: 4450,
      nodeLevel: 4,
      streakDays: 19,
      lastCheckInDate: yesterday,
      createdAt: new Date(now.getTime() - 40 * 86400000).toISOString(),
      referralCode: 'NAMI-99FA-01E2',
      referredBy: null,
      referralCount: 7,
      referralPointsEarned: 1750,
      settings: { sessionAlerts: true, compactLedger: false, telemetryOverlay: true, themeGlow: 'orange' },
    },
    {
      id: 'usr-lb-2',
      uid: 'NAMI-44C1-88B7',
      email: 'nyx.quantum@namiwallet.io',
      passwordHash: hashPassword('NamiPeer2026!'),
      displayName: 'Nyx Valkyrie',
      role: 'user',
      availablePoints: 4190,
      lifetimeEarned: 8640,
      pointsSpent: 4450,
      nodeLevel: 4,
      streakDays: 14,
      lastCheckInDate: yesterday,
      createdAt: new Date(now.getTime() - 35 * 86400000).toISOString(),
      referralCode: 'NAMI-44C1-88B7',
      referredBy: null,
      referralCount: 5,
      referralPointsEarned: 1250,
      settings: { sessionAlerts: true, compactLedger: false, telemetryOverlay: true, themeGlow: 'orange' },
    },
    {
      id: 'usr-lb-3',
      uid: 'NAMI-3D09-71AA',
      email: 'zephyr.node@namiwallet.io',
      passwordHash: hashPassword('NamiPeer2026!'),
      displayName: 'Zephyr Kurosawa',
      role: 'user',
      availablePoints: 4610,
      lifetimeEarned: 6260,
      pointsSpent: 1650,
      nodeLevel: 3,
      streakDays: 11,
      lastCheckInDate: yesterday,
      createdAt: new Date(now.getTime() - 32 * 86400000).toISOString(),
      referralCode: 'NAMI-3D09-71AA',
      referredBy: null,
      referralCount: 4,
      referralPointsEarned: 1000,
      settings: { sessionAlerts: true, compactLedger: false, telemetryOverlay: true, themeGlow: 'orange' },
    },
    {
      id: 'usr-lb-4',
      uid: 'NAMI-82E4-19F0',
      email: 'lyra.hyperion@namiwallet.io',
      passwordHash: hashPassword('NamiPeer2026!'),
      displayName: 'Lyra Thorne',
      role: 'user',
      availablePoints: 3490,
      lifetimeEarned: 5140,
      pointsSpent: 1650,
      nodeLevel: 3,
      streakDays: 9,
      lastCheckInDate: yesterday,
      createdAt: new Date(now.getTime() - 29 * 86400000).toISOString(),
      referralCode: 'NAMI-82E4-19F0',
      referredBy: null,
      referralCount: 3,
      referralPointsEarned: 750,
      settings: { sessionAlerts: true, compactLedger: false, telemetryOverlay: true, themeGlow: 'orange' },
    },
    {
      id: 'usr-lb-5',
      uid: 'NAMI-55A8-63D2',
      email: 'orion.relay@namiwallet.io',
      passwordHash: hashPassword('NamiPeer2026!'),
      displayName: 'Orion Mercer',
      role: 'user',
      availablePoints: 2630,
      lifetimeEarned: 4280,
      pointsSpent: 1650,
      nodeLevel: 3,
      streakDays: 7,
      lastCheckInDate: yesterday,
      createdAt: new Date(now.getTime() - 25 * 86400000).toISOString(),
      referralCode: 'NAMI-55A8-63D2',
      referredBy: 'NAMI-01AD-99FF',
      referralCount: 2,
      referralPointsEarned: 500,
      settings: { sessionAlerts: true, compactLedger: false, telemetryOverlay: true, themeGlow: 'orange' },
    },
    {
      id: 'usr-lb-6',
      uid: 'NAMI-12F7-40C9',
      email: 'vesper.flux@namiwallet.io',
      passwordHash: hashPassword('NamiPeer2026!'),
      displayName: 'Vesper Lin',
      role: 'user',
      availablePoints: 2590,
      lifetimeEarned: 3040,
      pointsSpent: 450,
      nodeLevel: 2,
      streakDays: 6,
      lastCheckInDate: yesterday,
      createdAt: new Date(now.getTime() - 22 * 86400000).toISOString(),
      referralCode: 'NAMI-12F7-40C9',
      referredBy: null,
      referralCount: 1,
      referralPointsEarned: 250,
      settings: { sessionAlerts: true, compactLedger: false, telemetryOverlay: true, themeGlow: 'orange' },
    },
    {
      id: 'usr-lb-7',
      uid: 'NAMI-67B3-92E1',
      email: 'cassian.node@namiwallet.io',
      passwordHash: hashPassword('NamiPeer2026!'),
      displayName: 'Cassian Holt',
      role: 'user',
      availablePoints: 1940,
      lifetimeEarned: 2390,
      pointsSpent: 450,
      nodeLevel: 2,
      streakDays: 4,
      lastCheckInDate: yesterday,
      createdAt: new Date(now.getTime() - 18 * 86400000).toISOString(),
      referralCode: 'NAMI-67B3-92E1',
      referredBy: null,
      referralCount: 1,
      referralPointsEarned: 250,
      settings: { sessionAlerts: true, compactLedger: false, telemetryOverlay: true, themeGlow: 'orange' },
    },
    {
      id: 'usr-lb-8',
      uid: 'NAMI-29D4-81C5',
      email: 'soren.flux@namiwallet.io',
      passwordHash: hashPassword('NamiPeer2026!'),
      displayName: 'Soren Lindqvist',
      role: 'user',
      availablePoints: 1490,
      lifetimeEarned: 1940,
      pointsSpent: 450,
      nodeLevel: 2,
      streakDays: 4,
      lastCheckInDate: yesterday,
      createdAt: new Date(now.getTime() - 15 * 86400000).toISOString(),
      referralCode: 'NAMI-29D4-81C5',
      referredBy: null,
      referralCount: 0,
      referralPointsEarned: 0,
      settings: { sessionAlerts: true, compactLedger: false, telemetryOverlay: true, themeGlow: 'orange' },
    },
    {
      id: 'usr-lb-9',
      uid: 'NAMI-88E0-14A3',
      email: 'mira.light@namiwallet.io',
      passwordHash: hashPassword('NamiPeer2026!'),
      displayName: 'Mira Al-Mansoor',
      role: 'user',
      availablePoints: 1210,
      lifetimeEarned: 1210,
      pointsSpent: 0,
      nodeLevel: 1,
      streakDays: 2,
      lastCheckInDate: yesterday,
      createdAt: new Date(now.getTime() - 11 * 86400000).toISOString(),
      referralCode: 'NAMI-88E0-14A3',
      referredBy: 'NAMI-7B3E-22C0',
      referralCount: 0,
      referralPointsEarned: 0,
      settings: { sessionAlerts: true, compactLedger: false, telemetryOverlay: true, themeGlow: 'orange' },
    },
  ];

  const initialNodeSessions: NodeSessionRecord[] = [
    {
      id: 'ns-1001',
      userId: adminUser.id,
      userEmail: adminUser.email,
      nodeLevel: 2,
      status: 'completed',
      startedAt: twoHoursAgo,
      targetEndAt: new Date(new Date(twoHoursAgo).getTime() + 25200000).toISOString(),
      completedAt: new Date(new Date(twoHoursAgo).getTime() + 25200000).toISOString(),
      durationSeconds: 25200,
      baseReward: 120,
      multiplier: 1.5,
      streakBonus: 25,
      pointsAwarded: 205,
    },
    {
      id: 'ns-1002',
      userId: adminUser.id,
      userEmail: adminUser.email,
      nodeLevel: 2,
      status: 'completed',
      startedAt: oneHourAgo,
      targetEndAt: new Date(new Date(oneHourAgo).getTime() + 25200000).toISOString(),
      completedAt: new Date(new Date(oneHourAgo).getTime() + 25200000).toISOString(),
      durationSeconds: 25200,
      baseReward: 120,
      multiplier: 1.5,
      streakBonus: 25,
      pointsAwarded: 205,
    },
    {
      id: 'ns-1003',
      userId: demoUser.id,
      userEmail: demoUser.email,
      nodeLevel: 1,
      status: 'completed',
      startedAt: thirtyMinsAgo,
      targetEndAt: new Date(new Date(thirtyMinsAgo).getTime() + 25200000).toISOString(),
      completedAt: new Date(new Date(thirtyMinsAgo).getTime() + 25200000).toISOString(),
      durationSeconds: 25200,
      baseReward: 120,
      multiplier: 1.0,
      streakBonus: 15,
      pointsAwarded: 135,
    },
  ];

  const dayMinus = (d: number) => new Date(now.getTime() - d * 86400000 - 3600000).toISOString();

  const initialTransactions: TransactionRecord[] = [
    {
      id: 'tx-8995',
      userId: adminUser.id,
      userEmail: adminUser.email,
      type: 'task_reward',
      title: 'Genesis Operator Onboarding Grant',
      amount: 320,
      balanceAfter: 320,
      status: 'verified',
      referenceId: 'GENESIS-GRANT',
      createdAt: dayMinus(6),
    },
    {
      id: 'tx-8996',
      userId: adminUser.id,
      userEmail: adminUser.email,
      type: 'node_run',
      title: 'Node Run Session #ns-0995 Verified (1.0x Tier 1)',
      amount: 185,
      balanceAfter: 505,
      status: 'verified',
      referenceId: 'ns-0995',
      createdAt: dayMinus(5),
    },
    {
      id: 'tx-8997',
      userId: adminUser.id,
      userEmail: adminUser.email,
      type: 'daily_checkin',
      title: 'Daily Operator Check-In (2-Day Streak Bonus)',
      amount: 105,
      balanceAfter: 610,
      status: 'verified',
      referenceId: 'CHECKIN-D5',
      createdAt: dayMinus(5),
    },
    {
      id: 'tx-8998',
      userId: adminUser.id,
      userEmail: adminUser.email,
      type: 'node_run',
      title: 'Node Run Session #ns-0998 Verified (1.5x Tier 2)',
      amount: 240,
      balanceAfter: 850,
      status: 'verified',
      referenceId: 'ns-0998',
      createdAt: dayMinus(4),
    },
    {
      id: 'tx-8999',
      userId: adminUser.id,
      userEmail: adminUser.email,
      type: 'task_reward',
      title: 'Explore NAMI Protocol Documentation',
      amount: 150,
      balanceAfter: 1000,
      status: 'verified',
      referenceId: 'task-visit-website',
      createdAt: dayMinus(3),
    },
    {
      id: 'tx-9000',
      userId: adminUser.id,
      userEmail: adminUser.email,
      type: 'node_run',
      title: 'Node Run Session #ns-0999 Verified (1.5x Tier 2)',
      amount: 270,
      balanceAfter: 1270,
      status: 'verified',
      referenceId: 'ns-0999',
      createdAt: dayMinus(2),
    },
    {
      id: 'tx-9002',
      userId: adminUser.id,
      userEmail: adminUser.email,
      type: 'node_upgrade',
      title: 'Upgraded to Tier 2: NAMI Flux Validator',
      amount: -450,
      balanceAfter: 820,
      status: 'spent',
      referenceId: 'TIER-2-UPGRADE',
      createdAt: dayMinus(2),
    },
    {
      id: 'tx-9003',
      userId: adminUser.id,
      userEmail: adminUser.email,
      type: 'task_reward',
      title: 'Joined Official NAMI Telegram Community',
      amount: 250,
      balanceAfter: 1070,
      status: 'verified',
      referenceId: 'task-join-telegram',
      createdAt: dayMinus(1),
    },
    {
      id: 'tx-9004',
      userId: adminUser.id,
      userEmail: adminUser.email,
      type: 'node_run',
      title: 'Node Run Session #ns-1001 Verified (1.5x Tier 2)',
      amount: 205,
      balanceAfter: 1275,
      status: 'verified',
      referenceId: 'ns-1001',
      createdAt: twoHoursAgo,
    },
    {
      id: 'tx-9005',
      userId: adminUser.id,
      userEmail: adminUser.email,
      type: 'node_run',
      title: 'Node Run Session #ns-1002 Verified (1.5x Tier 2)',
      amount: 205,
      balanceAfter: 1480,
      status: 'verified',
      referenceId: 'ns-1002',
      createdAt: oneHourAgo,
    },
    {
      id: 'tx-9006-d6',
      userId: demoUser.id,
      userEmail: demoUser.email,
      type: 'task_reward',
      title: 'Initial Node Operator Activation',
      amount: 110,
      balanceAfter: 110,
      status: 'verified',
      referenceId: 'OPERATOR-INIT',
      createdAt: dayMinus(5),
    },
    {
      id: 'tx-9006-d4',
      userId: demoUser.id,
      userEmail: demoUser.email,
      type: 'node_run',
      title: 'Node Run Session #ns-0990 Verified (1.0x Tier 1)',
      amount: 135,
      balanceAfter: 245,
      status: 'verified',
      referenceId: 'ns-0990',
      createdAt: dayMinus(3),
    },
    {
      id: 'tx-9006',
      userId: demoUser.id,
      userEmail: demoUser.email,
      type: 'task_reward',
      title: 'Followed Official NAMI Account on X',
      amount: 245,
      balanceAfter: 490,
      status: 'verified',
      referenceId: 'task-follow-x',
      createdAt: dayMinus(1),
    },
    {
      id: 'tx-9007',
      userId: demoUser.id,
      userEmail: demoUser.email,
      type: 'node_run',
      title: 'Node Run Session #ns-1003 Verified (1.0x Tier 1)',
      amount: 135,
      balanceAfter: 625,
      status: 'verified',
      referenceId: 'ns-1003',
      createdAt: thirtyMinsAgo,
    },
  ];

  // Generate 28 days of prior monthly transactions so the 30-day / 4-week Profile Performance chart is rich
  const monthlyHistoricalTx: TransactionRecord[] = [];
  const adminDailyPattern = [
    95, 120, 80, 140, 110, 160, 130, // Week 1
    105, 145, 125, 175, 150, 190, 165, // Week 2
    130, 170, 155, 200, 180, 215, 195, // Week 3
  ];
  adminDailyPattern.forEach((pts, idx) => {
    const daysAgo = 27 - idx; // Days 27 down to 7
    monthlyHistoricalTx.push({
      id: `tx-m-adm-${daysAgo}`,
      userId: adminUser.id,
      userEmail: adminUser.email,
      type: idx % 3 === 0 ? 'referral_bonus' : idx % 2 === 0 ? 'node_run' : 'task_reward',
      title:
        idx % 3 === 0
          ? 'Referral Invite Bonus Verified'
          : idx % 2 === 0
          ? `Node Run Session #ns-09${daysAgo} Verified`
          : 'Daily Operator Check-In & Ecosystem Mission',
      amount: pts,
      balanceAfter: 1000 + idx * 90,
      status: 'verified',
      referenceId: `HIST-D${daysAgo}`,
      createdAt: dayMinus(daysAgo),
    });
  });

  const demoDailyPattern = [
    40, 65, 50, 85, 70, 95, 60,
    55, 90, 75, 110, 80, 105, 95,
    70, 100, 85, 125, 90, 115, 105,
  ];
  demoDailyPattern.forEach((pts, idx) => {
    const daysAgo = 27 - idx;
    monthlyHistoricalTx.push({
      id: `tx-m-dem-${daysAgo}`,
      userId: demoUser.id,
      userEmail: demoUser.email,
      type: idx % 2 === 0 ? 'node_run' : 'daily_checkin',
      title: idx % 2 === 0 ? `Node Run Session Verified` : 'Daily Operator Check-In',
      amount: pts,
      balanceAfter: 300 + idx * 45,
      status: 'verified',
      referenceId: `DEMO-HIST-D${daysAgo}`,
      createdAt: dayMinus(daysAgo),
    });
  });

  const initialSuspicious: SuspiciousActivityRecord[] = [
    {
      id: 'sec-501',
      userId: demoUser.id,
      userEmail: demoUser.email,
      eventType: 'early_completion_attempt',
      severity: 'low',
      details: 'Client requested full session reward 18s prior to targetEndAt timestamp; backend rejected full payout.',
      createdAt: new Date(now.getTime() - 55 * 60 * 1000).toISOString(),
      resolved: false,
    },
  ];

  return {
    users: [adminUser, demoUser, ...leaderboardPeers],
    sessions: [],
    nodeSessions: initialNodeSessions,
    transactions: [...initialTransactions, ...monthlyHistoricalTx],
    tasks: INITIAL_TASKS,
    userTasks: [
      {
        id: 'ut-1',
        userId: adminUser.id,
        taskId: 'task-join-telegram',
        status: 'verified',
        initiatedAt: new Date(now.getTime() - 86450000).toISOString(),
        verifiedAt: new Date(now.getTime() - 86400000).toISOString(),
        proofInput: '@akash_nami',
        dateKey: 'ONCE',
        pointsAwarded: 250,
      },
    ],
    suspiciousLogs: initialSuspicious,
    config: INITIAL_CONFIG,
  };
}

let memoryDb: DatabaseSchema | null = null;
let txChain: Promise<unknown> = Promise.resolve();

function loadDb(): DatabaseSchema {
  if (memoryDb) return memoryDb;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      memoryDb = JSON.parse(raw) as DatabaseSchema;
      let dirty = false;
      if (memoryDb.config && memoryDb.config.sessionDurationSeconds === 45) {
        memoryDb.config.sessionDurationSeconds = 25200;
        memoryDb.nodeSessions.forEach((s) => {
          if (s.durationSeconds === 45) {
            s.durationSeconds = 25200;
            if (s.status === 'active') {
              s.targetEndAt = new Date(new Date(s.startedAt).getTime() + 25200 * 1000).toISOString();
            }
          }
        });
        dirty = true;
      }
      // Migrate leaderboard peers & 30-day transactions if not yet present
      if (!memoryDb.users.some((u) => u.id === 'usr-lb-1') || !memoryDb.transactions.some((t) => t.id === 'tx-m-adm-27')) {
        const fresh = createInitialDb();
        fresh.users.forEach((fu) => {
          if (!memoryDb!.users.some((u) => u.id === fu.id)) {
            memoryDb!.users.push(fu);
          }
        });
        memoryDb.users.forEach((u) => {
          if (!u.referralCode) u.referralCode = u.uid;
          if (u.referralCount === undefined) u.referralCount = u.role === 'admin' ? 2 : 0;
          if (u.referralPointsEarned === undefined) u.referralPointsEarned = (u.referralCount || 0) * 250;
        });
        fresh.transactions.forEach((ft) => {
          if (!memoryDb!.transactions.some((t) => t.id === ft.id)) {
            memoryDb!.transactions.push(ft);
          }
        });
        dirty = true;
      }
      if (dirty) {
        saveDbSync(memoryDb);
      }
      return memoryDb;
    }
  } catch (err) {
    console.error('Error loading DB, initializing fresh schema:', err);
  }
  memoryDb = createInitialDb();
  saveDbSync(memoryDb);
  return memoryDb;
}

function saveDbSync(data: DatabaseSchema) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tmpFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmpFile, DB_FILE);
  } catch (err) {
    console.error('Error persisting DB:', err);
  }
}

/**
 * Serialized atomic transaction runner.
 * Prevents race conditions, duplicate claims, and concurrent balance manipulation.
 */
export async function withTransaction<T>(fn: (db: DatabaseSchema) => T | Promise<T>): Promise<T> {
  const next = txChain.then(async () => {
    const db = loadDb();
    // Deep clone snapshot for rollback safety if fn throws
    const snapshot = JSON.stringify(db);
    try {
      const result = await fn(db);
      saveDbSync(db);
      return result;
    } catch (err) {
      memoryDb = JSON.parse(snapshot) as DatabaseSchema;
      throw err;
    }
  });
  txChain = next.catch(() => {});
  return next;
}

export function readDb(): DatabaseSchema {
  return loadDb();
}
