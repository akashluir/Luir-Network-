import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import {
  withTransaction,
  readDb,
  hashPassword,
  generateUid,
  getTodayKey,
  UserRecord,
  DatabaseSchema,
} from './src/server/db.ts';

const PORT = 3000;

interface AuthedRequest extends Request {
  user?: UserRecord;
  token?: string;
}

function sanitizeUser(user: UserRecord) {
  const { passwordHash, ...safe } = user;
  return safe;
}

function getEffectiveDailyCap(db: DatabaseSchema, user: UserRecord): number {
  const tier = db.config.nodeTiers.find((t) => t.level === user.nodeLevel);
  return db.config.dailyPointLimit + (tier ? tier.dailyLimitBonus : 0);
}

function getTodayEarnedPoints(db: DatabaseSchema, userId: string, todayKey: string): number {
  return db.transactions
    .filter(
      (tx) =>
        tx.userId === userId &&
        tx.amount > 0 &&
        tx.createdAt.slice(0, 10) === todayKey
    )
    .reduce((sum, tx) => sum + tx.amount, 0);
}

function getTodayCompletedSessions(db: DatabaseSchema, userId: string, todayKey: string): number {
  return db.nodeSessions.filter(
    (s) =>
      s.userId === userId &&
      s.status === 'completed' &&
      (s.completedAt || s.startedAt).slice(0, 10) === todayKey
  ).length;
}

function getCooldownRemainingSeconds(db: DatabaseSchema, userId: string, nowMs: number): number {
  const userSessions = db.nodeSessions
    .filter((s) => s.userId === userId && (s.status === 'completed' || s.status === 'stopped') && s.completedAt)
    .sort((a, b) => new Date(b.completedAt!).getTime() - new Date(a.completedAt!).getTime());

  if (userSessions.length === 0) return 0;
  const lastCompletedMs = new Date(userSessions[0].completedAt!).getTime();
  const elapsedSec = (nowMs - lastCompletedMs) / 1000;
  const remaining = Math.ceil(db.config.cooldownSeconds - elapsedSec);
  return remaining > 0 ? remaining : 0;
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // Authentication middleware
  const requireAuth = (req: AuthedRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authentication required. Please sign in to your NAMI WALLET account.' });
      return;
    }
    const token = authHeader.slice(7).trim();
    const db = readDb();
    const session = db.sessions.find((s) => s.token === token);
    if (!session) {
      res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
      return;
    }
    const user = db.users.find((u) => u.id === session.userId);
    if (!user) {
      res.status(401).json({ error: 'User account not found.' });
      return;
    }
    req.user = user;
    req.token = token;
    next();
  };

  const requireAdmin = (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user || req.user.role !== 'admin') {
      res.status(403).json({ error: 'Administrator authorization required for this operation.' });
      return;
    }
    next();
  };

  // --- AUTH ROUTES ---

  app.post('/api/auth/signup', async (req: Request, res: Response) => {
    try {
      const { email, password, displayName, referralCode } = req.body;
      if (!email || typeof email !== 'string' || !email.includes('@')) {
        res.status(400).json({ error: 'Please provide a valid email address.' });
        return;
      }
      if (!password || typeof password !== 'string' || password.length < 6) {
        res.status(400).json({ error: 'Password must be at least 6 characters long.' });
        return;
      }

      const normalizedEmail = email.trim().toLowerCase();
      const cleanName = (displayName || normalizedEmail.split('@')[0]).trim().slice(0, 40);
      const cleanRef = referralCode ? String(referralCode).trim().toUpperCase() : '';

      const result = await withTransaction((db) => {
        const existing = db.users.find((u) => u.email.toLowerCase() === normalizedEmail);
        if (existing) {
          throw new Error('An account with this email already exists.');
        }

        const isAdminEmail =
          normalizedEmail === 'akashluir@gmail.com' || normalizedEmail === 'admin@namiwallet.io';

        const referrer = cleanRef
          ? db.users.find(
              (u) =>
                (u.referralCode && u.referralCode.toUpperCase() === cleanRef) ||
                u.uid.toUpperCase() === cleanRef
            )
          : undefined;

        const welcomeBonus = referrer ? 150 : 100;
        const newUid = generateUid();

        const newUser: UserRecord = {
          id: `usr-${crypto.randomBytes(4).toString('hex')}`,
          uid: newUid,
          email: normalizedEmail,
          passwordHash: hashPassword(password),
          displayName: cleanName,
          role: isAdminEmail ? 'admin' : 'user',
          availablePoints: welcomeBonus,
          lifetimeEarned: welcomeBonus,
          pointsSpent: 0,
          nodeLevel: 1,
          streakDays: 1,
          lastCheckInDate: null,
          createdAt: new Date().toISOString(),
          referralCode: newUid,
          referredBy: referrer ? referrer.referralCode || referrer.uid : null,
          referralCount: 0,
          referralPointsEarned: 0,
          settings: {
            sessionAlerts: true,
            compactLedger: false,
            telemetryOverlay: true,
            themeGlow: 'orange',
          },
        };

        db.users.push(newUser);

        db.transactions.unshift({
          id: `tx-${crypto.randomBytes(4).toString('hex')}`,
          userId: newUser.id,
          userEmail: newUser.email,
          type: referrer ? 'referral_bonus' : 'task_reward',
          title: referrer
            ? `Welcome + Referral Invite Bonus (Invited by ${referrer.displayName})`
            : 'Welcome NAMI Wallet Activation Bonus',
          amount: welcomeBonus,
          balanceAfter: welcomeBonus,
          status: 'verified',
          referenceId: referrer ? `REF-JOIN-${referrer.uid}` : 'WELCOME-BONUS',
          createdAt: new Date().toISOString(),
        });

        // Award +250 NAMI Points to referring operator
        if (referrer) {
          const referralAward = 250;
          referrer.availablePoints += referralAward;
          referrer.lifetimeEarned += referralAward;
          referrer.referralCount = (referrer.referralCount || 0) + 1;
          referrer.referralPointsEarned = (referrer.referralPointsEarned || 0) + referralAward;

          db.transactions.unshift({
            id: `tx-${crypto.randomBytes(4).toString('hex')}`,
            userId: referrer.id,
            userEmail: referrer.email,
            type: 'referral_bonus',
            title: `Referral Bonus: ${newUser.displayName} Joined via Invite Link`,
            amount: referralAward,
            balanceAfter: referrer.availablePoints,
            status: 'verified',
            referenceId: `REF-${newUser.uid}`,
            createdAt: new Date().toISOString(),
          });
        }

        const token = crypto.randomBytes(24).toString('hex');
        db.sessions.push({
          token,
          userId: newUser.id,
          createdAt: new Date().toISOString(),
        });

        return { user: sanitizeUser(newUser), token };
      });

      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Sign-up failed.' });
    }
  });

  app.post('/api/auth/login', async (req: Request, res: Response) => {
    try {
      const { email, password, quickPreset } = req.body;

      const result = await withTransaction((db) => {
        let user: UserRecord | undefined;

        if (quickPreset === 'admin') {
          user = db.users.find((u) => u.role === 'admin');
        } else if (quickPreset === 'demo') {
          user = db.users.find((u) => u.email === 'operator@namiwallet.io') || db.users[0];
        } else {
          if (!email || !password) {
            throw new Error('Email and password are required.');
          }
          const normalizedEmail = String(email).trim().toLowerCase();
          user = db.users.find((u) => u.email.toLowerCase() === normalizedEmail);
          if (!user || user.passwordHash !== hashPassword(String(password))) {
            throw new Error('Invalid email or password.');
          }
        }

        if (!user) {
          throw new Error('Account not found.');
        }

        const token = crypto.randomBytes(24).toString('hex');
        db.sessions.push({
          token,
          userId: user.id,
          createdAt: new Date().toISOString(),
        });

        return { user: sanitizeUser(user), token };
      });

      res.json(result);
    } catch (err: any) {
      res.status(401).json({ error: err.message || 'Login failed.' });
    }
  });

  app.post('/api/auth/logout', requireAuth, async (req: AuthedRequest, res: Response) => {
    await withTransaction((db) => {
      db.sessions = db.sessions.filter((s) => s.token !== req.token);
    });
    res.json({ ok: true });
  });

  // --- DASHBOARD & STATE ---

  app.get('/api/dashboard', requireAuth, (req: AuthedRequest, res: Response) => {
    const db = readDb();
    const user = db.users.find((u) => u.id === req.user!.id)!;
    const now = new Date();
    const todayKey = getTodayKey();

    const todayEarned = getTodayEarnedPoints(db, user.id, todayKey);
    const effectiveDailyCap = getEffectiveDailyCap(db, user);
    const sessionsCompletedToday = getTodayCompletedSessions(db, user.id, todayKey);
    const cooldownRemainingSeconds = getCooldownRemainingSeconds(db, user.id, now.getTime());

    const activeSession =
      db.nodeSessions.find((s) => s.userId === user.id && s.status === 'active') || null;

    const userNodeSessions = db.nodeSessions
      .filter((s) => s.userId === user.id)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .slice(0, 25);

    const userTransactions = db.transactions
      .filter((tx) => tx.userId === user.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const userTaskRecords = db.userTasks.filter(
      (ut) =>
        ut.userId === user.id &&
        (ut.dateKey === 'ONCE' || ut.dateKey === todayKey)
    );

    const completedTasksCount = db.userTasks.filter(
      (ut) => ut.userId === user.id && ut.status === 'verified'
    ).length;

    const totalNodePointsEarned = db.transactions
      .filter((tx) => tx.userId === user.id && tx.type === 'node_run' && tx.amount > 0)
      .reduce((sum, tx) => sum + tx.amount, 0);

    // Compute Global Leaderboard (Top 10 by lifetimeEarned)
    const sortedUsers = [...db.users].sort((a, b) => b.lifetimeEarned - a.lifetimeEarned);
    const userGlobalRank = sortedUsers.findIndex((u) => u.id === user.id) + 1;
    const leaderboard = sortedUsers.slice(0, 10).map((u, idx) => ({
      rank: idx + 1,
      id: u.id,
      uid: u.uid,
      displayName: u.displayName,
      nodeLevel: u.nodeLevel,
      streakDays: u.streakDays,
      lifetimeEarned: u.lifetimeEarned,
      availablePoints: u.availablePoints,
      referralCount: u.referralCount || 0,
      isCurrentUser: u.id === user.id,
    }));

    const userRefCode = user.referralCode || user.uid;
    const referredUsers = db.users
      .filter((u) => u.referredBy === userRefCode || u.referredBy === user.uid)
      .map((u) => ({
        id: u.id,
        uid: u.uid,
        displayName: u.displayName,
        createdAt: u.createdAt,
        nodeLevel: u.nodeLevel,
        bonusAwarded: 250,
      }));

    res.json({
      serverNow: now.toISOString(),
      user: sanitizeUser(user),
      stats: {
        todayEarned,
        effectiveDailyCap,
        sessionsCompletedToday,
        maxDailySessions: db.config.maxDailySessions,
        cooldownRemainingSeconds,
        completedTasksCount,
        totalNodePointsEarned,
        checkedInToday: user.lastCheckInDate === todayKey,
      },
      leaderboard,
      userGlobalRank,
      referrals: {
        referralCode: userRefCode,
        referralCount: user.referralCount ?? referredUsers.length,
        referralPointsEarned: user.referralPointsEarned ?? referredUsers.length * 250,
        bonusPerInvite: 250,
        referredUsers,
      },
      activeSession,
      nodeHistory: userNodeSessions,
      transactions: userTransactions,
      tasks: db.tasks.filter((t) => t.active),
      userTaskRecords,
      config: db.config,
    });
  });

  // --- REFERRAL INVITE REGISTRATION ---

  app.post('/api/referrals/register-friend', requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const { friendName, friendEmail } = req.body;
      const cleanName = String(friendName || '').trim().slice(0, 40);
      const cleanEmail = String(friendEmail || '').trim().toLowerCase();

      if (!cleanName || cleanName.length < 2) {
        res.status(400).json({ error: 'Please provide your invited friend’s display name.' });
        return;
      }
      if (!cleanEmail || !cleanEmail.includes('@')) {
        res.status(400).json({ error: 'Please provide a valid email address for the invited friend.' });
        return;
      }

      const result = await withTransaction((db) => {
        if (db.config.campaignPaused) {
          throw new Error('Reward campaigns are temporarily paused by administrators.');
        }

        const referrer = db.users.find((u) => u.id === req.user!.id)!;
        const existing = db.users.find((u) => u.email.toLowerCase() === cleanEmail);
        if (existing) {
          throw new Error('This friend email is already registered on NAMI WALLET.');
        }

        const newUid = generateUid();
        const refCode = referrer.referralCode || referrer.uid;
        const referralBonus = 250;

        const invitedUser: UserRecord = {
          id: `usr-${crypto.randomBytes(4).toString('hex')}`,
          uid: newUid,
          email: cleanEmail,
          passwordHash: hashPassword('InvitedFriend2026!'),
          displayName: cleanName,
          role: 'user',
          availablePoints: 150,
          lifetimeEarned: 150,
          pointsSpent: 0,
          nodeLevel: 1,
          streakDays: 1,
          lastCheckInDate: null,
          createdAt: new Date().toISOString(),
          referralCode: newUid,
          referredBy: refCode,
          referralCount: 0,
          referralPointsEarned: 0,
          settings: {
            sessionAlerts: true,
            compactLedger: false,
            telemetryOverlay: true,
            themeGlow: 'orange',
          },
        };

        db.users.push(invitedUser);

        referrer.availablePoints += referralBonus;
        referrer.lifetimeEarned += referralBonus;
        referrer.referralCount = (referrer.referralCount || 0) + 1;
        referrer.referralPointsEarned = (referrer.referralPointsEarned || 0) + referralBonus;

        db.transactions.unshift({
          id: `tx-${crypto.randomBytes(4).toString('hex')}`,
          userId: referrer.id,
          userEmail: referrer.email,
          type: 'referral_bonus',
          title: `Referral Bonus: ${invitedUser.displayName} Joined via Invite Link`,
          amount: referralBonus,
          balanceAfter: referrer.availablePoints,
          status: 'verified',
          referenceId: `REF-${invitedUser.uid}`,
          createdAt: new Date().toISOString(),
        });

        return {
          pointsAwarded: referralBonus,
          invitedFriend: {
            uid: invitedUser.uid,
            displayName: invitedUser.displayName,
          },
        };
      });

      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Referral registration failed.' });
    }
  });

  // --- DAILY CHECK-IN ---

  app.post('/api/checkin', requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const result = await withTransaction((db) => {
        if (db.config.campaignPaused) {
          throw new Error('Reward distribution is temporarily paused by administrators.');
        }

        const user = db.users.find((u) => u.id === req.user!.id)!;
        const todayKey = getTodayKey();
        const yesterdayKey = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

        if (user.lastCheckInDate === todayKey) {
          db.suspiciousLogs.unshift({
            id: `sec-${crypto.randomBytes(3).toString('hex')}`,
            userId: user.id,
            userEmail: user.email,
            eventType: 'duplicate_claim_attempt',
            severity: 'low',
            details: `Duplicate daily check-in request on ${todayKey}.`,
            createdAt: new Date().toISOString(),
            resolved: false,
          });
          throw new Error('Daily check-in already claimed today. Come back tomorrow!');
        }

        const newStreak =
          user.lastCheckInDate === yesterdayKey ? user.streakDays + 1 : Math.max(1, user.streakDays + 1);
        const streakBonus = Math.min(newStreak * db.config.streakBonusPerDay, 150);
        const totalAward = db.config.dailyCheckInBasePoints + streakBonus;

        user.lastCheckInDate = todayKey;
        user.streakDays = newStreak;
        user.availablePoints += totalAward;
        user.lifetimeEarned += totalAward;

        const txId = `tx-${crypto.randomBytes(4).toString('hex')}`;
        db.transactions.unshift({
          id: txId,
          userId: user.id,
          userEmail: user.email,
          type: 'daily_checkin',
          title: `Daily Operator Check-In (${newStreak}-Day Streak Bonus)`,
          amount: totalAward,
          balanceAfter: user.availablePoints,
          status: 'verified',
          referenceId: `CHECKIN-${todayKey}`,
          createdAt: new Date().toISOString(),
        });

        // Also mark the daily check-in task as verified for today
        const checkinTask = db.tasks.find((t) => t.verificationType === 'checkin');
        if (checkinTask) {
          const existingUt = db.userTasks.find(
            (ut) => ut.userId === user.id && ut.taskId === checkinTask.id && ut.dateKey === todayKey
          );
          if (!existingUt) {
            db.userTasks.push({
              id: `ut-${crypto.randomBytes(4).toString('hex')}`,
              userId: user.id,
              taskId: checkinTask.id,
              status: 'verified',
              initiatedAt: new Date().toISOString(),
              verifiedAt: new Date().toISOString(),
              proofInput: `STREAK-${newStreak}`,
              dateKey: todayKey,
              pointsAwarded: totalAward,
            });
          }
        }

        return {
          pointsAwarded: totalAward,
          streakDays: newStreak,
          availablePoints: user.availablePoints,
        };
      });

      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Check-in failed.' });
    }
  });

  // --- NODE RUN SYSTEM ---

  app.post('/api/node/start', requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const result = await withTransaction((db) => {
        if (db.config.campaignPaused) {
          throw new Error('Node Run rewards campaign is currently paused by system administrators.');
        }

        const user = db.users.find((u) => u.id === req.user!.id)!;
        const now = new Date();
        const todayKey = getTodayKey();

        const existingActive = db.nodeSessions.find(
          (s) => s.userId === user.id && s.status === 'active'
        );
        if (existingActive) {
          throw new Error('A Node Run session is already active for your account.');
        }

        const cooldownLeft = getCooldownRemainingSeconds(db, user.id, now.getTime());
        if (cooldownLeft > 0) {
          throw new Error(`Node core cooling down. Please wait ${cooldownLeft}s before starting next session.`);
        }

        const sessionsToday = getTodayCompletedSessions(db, user.id, todayKey);
        if (sessionsToday >= db.config.maxDailySessions) {
          throw new Error(`Daily limit of ${db.config.maxDailySessions} Node Run sessions reached.`);
        }

        const todayEarned = getTodayEarnedPoints(db, user.id, todayKey);
        const effectiveCap = getEffectiveDailyCap(db, user);
        if (todayEarned >= effectiveCap) {
          db.suspiciousLogs.unshift({
            id: `sec-${crypto.randomBytes(3).toString('hex')}`,
            userId: user.id,
            userEmail: user.email,
            eventType: 'daily_limit_reached',
            severity: 'low',
            details: `Attempted to start node run after reaching daily cap (${todayEarned}/${effectiveCap}).`,
            createdAt: now.toISOString(),
            resolved: false,
          });
          throw new Error(`Daily NAMI Points cap (${effectiveCap} PTS) reached. Upgrade your node or return tomorrow.`);
        }

        const tier = db.config.nodeTiers.find((t) => t.level === user.nodeLevel) || db.config.nodeTiers[0];
        const durationSeconds = db.config.sessionDurationSeconds;
        const targetEndAt = new Date(now.getTime() + durationSeconds * 1000).toISOString();
        const streakBonus = Math.min(user.streakDays * 5, 50);

        const hasValidBoost = Boolean(
          user.namiBoostEnabled &&
            user.namiBoostExpiresAt &&
            new Date(user.namiBoostExpiresAt).getTime() > now.getTime()
        );
        const effectiveMultiplier = hasValidBoost ? tier.multiplier * 2 : tier.multiplier;

        const session = {
          id: `ns-${crypto.randomBytes(3).toString('hex')}`,
          userId: user.id,
          userEmail: user.email,
          nodeLevel: user.nodeLevel,
          status: 'active' as const,
          startedAt: now.toISOString(),
          targetEndAt,
          completedAt: null,
          durationSeconds,
          baseReward: db.config.basePointsPerSession,
          multiplier: effectiveMultiplier,
          namiBoostActive: hasValidBoost,
          streakBonus,
          pointsAwarded: 0,
        };

        db.nodeSessions.unshift(session);
        return { session, serverNow: now.toISOString() };
      });

      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Could not start Node Run session.' });
    }
  });

  app.post('/api/node/boost', requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const { action } = req.body; // 'activate' | 'toggle'
      const BOOST_COST = 250;
      const BOOST_DURATION_MS = 24 * 3600 * 1000; // 24 hours temporary 2x multiplier pass

      const result = await withTransaction((db) => {
        const user = db.users.find((u) => u.id === req.user!.id)!;
        const now = new Date();
        const hasUnexpiredPass = Boolean(
          user.namiBoostExpiresAt && new Date(user.namiBoostExpiresAt).getTime() > now.getTime()
        );

        let message = '';

        if (action === 'toggle' && hasUnexpiredPass) {
          user.namiBoostEnabled = !user.namiBoostEnabled;
          message = user.namiBoostEnabled
            ? 'Nami Boost (2x Yield Multiplier) toggled ON for your Node Runs.'
            : 'Nami Boost (2x Yield Multiplier) paused. Toggle back ON anytime before expiry.';
        } else {
          // Purchase / activate or extend 24h Nami Boost pass for 250 PTS
          if (user.availablePoints < BOOST_COST) {
            throw new Error(
              `Insufficient NAMI Points to activate Nami Boost. Need ${BOOST_COST} PTS, you have ${user.availablePoints.toLocaleString()} PTS.`
            );
          }

          user.availablePoints -= BOOST_COST;
          user.pointsSpent += BOOST_COST;

          const baseStartMs = hasUnexpiredPass
            ? new Date(user.namiBoostExpiresAt!).getTime()
            : now.getTime();
          user.namiBoostExpiresAt = new Date(baseStartMs + BOOST_DURATION_MS).toISOString();
          user.namiBoostEnabled = true;

          db.transactions.unshift({
            id: `tx-${crypto.randomBytes(4).toString('hex')}`,
            userId: user.id,
            userEmail: user.email,
            type: 'nami_boost',
            title: 'Activated Nami Boost (Temporary 2x Node Run Yield · 24h Pass)',
            amount: -BOOST_COST,
            balanceAfter: user.availablePoints,
            status: 'spent',
            referenceId: 'NAMI-BOOST-2X',
            createdAt: now.toISOString(),
          });

          message = `Nami Boost activated! 2x Node Run yield multiplier unlocked for 24 hours (-${BOOST_COST} PTS).`;
        }

        // Sync any currently active session with the user's Nami Boost toggle state
        const activeSession = db.nodeSessions.find(
          (s) => s.userId === user.id && s.status === 'active'
        );
        if (activeSession) {
          const tier =
            db.config.nodeTiers.find((t) => t.level === activeSession.nodeLevel) ||
            db.config.nodeTiers[0];
          const boostNowActive = Boolean(
            user.namiBoostEnabled &&
              user.namiBoostExpiresAt &&
              new Date(user.namiBoostExpiresAt).getTime() > now.getTime()
          );
          activeSession.namiBoostActive = boostNowActive;
          activeSession.multiplier = boostNowActive ? tier.multiplier * 2 : tier.multiplier;
        }

        return {
          user: sanitizeUser(user),
          message,
        };
      });

      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Could not update Nami Boost.' });
    }
  });

  app.post('/api/node/complete', requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const { sessionId, mode } = req.body; // mode: 'claim' | 'stop'
      const result = await withTransaction((db) => {
        const user = db.users.find((u) => u.id === req.user!.id)!;
        const now = new Date();
        const todayKey = getTodayKey();

        const session = db.nodeSessions.find(
          (s) => s.id === sessionId && s.userId === user.id
        );

        if (!session) {
          throw new Error('Node Run session not found.');
        }

        if (session.status !== 'active') {
          db.suspiciousLogs.unshift({
            id: `sec-${crypto.randomBytes(3).toString('hex')}`,
            userId: user.id,
            userEmail: user.email,
            eventType: 'duplicate_claim_attempt',
            severity: 'medium',
            details: `Duplicate completion request for already-${session.status} session ${session.id}.`,
            createdAt: now.toISOString(),
            resolved: false,
          });
          throw new Error('This Node Run session has already been processed.');
        }

        const startedMs = new Date(session.startedAt).getTime();
        const targetEndMs = new Date(session.targetEndAt).getTime();
        const elapsedSeconds = Math.max(0, (now.getTime() - startedMs) / 1000);
        const progressRatio = Math.min(1, elapsedSeconds / session.durationSeconds);

        const todayEarned = getTodayEarnedPoints(db, user.id, todayKey);
        const effectiveCap = getEffectiveDailyCap(db, user);
        const remainingCap = Math.max(0, effectiveCap - todayEarned);

        const fullCalculatedPoints = Math.round(
          session.baseReward * session.multiplier + session.streakBonus
        );

        // If user clicked 'claim' (expecting full completion), verify server clock!
        if (mode !== 'stop') {
          // Allow 1.5s tolerance for network jitter
          if (now.getTime() < targetEndMs - 1500) {
            const secondsLeft = Math.ceil((targetEndMs - now.getTime()) / 1000);
            db.suspiciousLogs.unshift({
              id: `sec-${crypto.randomBytes(3).toString('hex')}`,
              userId: user.id,
              userEmail: user.email,
              eventType: 'early_completion_attempt',
              severity: 'medium',
              details: `Premature claim on session ${session.id} with ${secondsLeft}s remaining on server clock.`,
              createdAt: now.toISOString(),
              resolved: false,
            });
            throw new Error(`Node Run still in progress on server (${secondsLeft}s remaining).`);
          }

          const awarded = Math.min(fullCalculatedPoints, remainingCap);
          session.status = 'completed';
          session.completedAt = now.toISOString();
          session.pointsAwarded = awarded;

          if (awarded > 0) {
            user.availablePoints += awarded;
            user.lifetimeEarned += awarded;

            db.transactions.unshift({
              id: `tx-${crypto.randomBytes(4).toString('hex')}`,
              userId: user.id,
              userEmail: user.email,
              type: 'node_run',
              title: `Node Run Session #${session.id} Verified (${session.multiplier}x Tier ${session.nodeLevel}${session.namiBoostActive ? ' · 2x Nami Boost' : ''})`,
              amount: awarded,
              balanceAfter: user.availablePoints,
              status: 'verified',
              referenceId: session.id,
              createdAt: now.toISOString(),
            });
          }

          return {
            session,
            pointsAwarded: awarded,
            availablePoints: user.availablePoints,
            message: `Session verified! +${awarded} NAMI Points credited to your internal ledger.`,
          };
        } else {
          // User explicitly stopped the Node Run early
          const partialPoints =
            progressRatio >= 0.25
              ? Math.min(Math.floor(fullCalculatedPoints * progressRatio * 0.6), remainingCap)
              : 0;

          session.status = 'stopped';
          session.completedAt = now.toISOString();
          session.pointsAwarded = partialPoints;

          if (partialPoints > 0) {
            user.availablePoints += partialPoints;
            user.lifetimeEarned += partialPoints;

            db.transactions.unshift({
              id: `tx-${crypto.randomBytes(4).toString('hex')}`,
              userId: user.id,
              userEmail: user.email,
              type: 'node_run',
              title: `Node Run #${session.id} Stopped Early (${Math.round(progressRatio * 100)}% cycle)`,
              amount: partialPoints,
              balanceAfter: user.availablePoints,
              status: 'completed',
              referenceId: session.id,
              createdAt: now.toISOString(),
            });
          }

          return {
            session,
            pointsAwarded: partialPoints,
            availablePoints: user.availablePoints,
            message:
              partialPoints > 0
                ? `Node Run stopped early. +${partialPoints} partial NAMI Points awarded.`
                : 'Node Run stopped early before minimum verification threshold (0 points awarded).',
          };
        }
      });

      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to complete Node Run session.' });
    }
  });

  // --- NODE UPGRADE ---

  app.post('/api/node/upgrade', requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const { targetLevel } = req.body;
      const result = await withTransaction((db) => {
        const user = db.users.find((u) => u.id === req.user!.id)!;
        const nextLevel = Number(targetLevel);

        if (nextLevel !== user.nodeLevel + 1) {
          throw new Error('Nodes must be upgraded sequentially one tier at a time.');
        }

        const tierConfig = db.config.nodeTiers.find((t) => t.level === nextLevel);
        if (!tierConfig) {
          throw new Error('Target node upgrade tier does not exist.');
        }

        if (user.availablePoints < tierConfig.cost) {
          throw new Error(
            `Insufficient NAMI Points. Need ${tierConfig.cost.toLocaleString()} PTS, you have ${user.availablePoints.toLocaleString()} PTS.`
          );
        }

        user.availablePoints -= tierConfig.cost;
        user.pointsSpent += tierConfig.cost;
        user.nodeLevel = nextLevel;

        db.transactions.unshift({
          id: `tx-${crypto.randomBytes(4).toString('hex')}`,
          userId: user.id,
          userEmail: user.email,
          type: 'node_upgrade',
          title: `Upgraded to Tier ${nextLevel}: ${tierConfig.name}`,
          amount: -tierConfig.cost,
          balanceAfter: user.availablePoints,
          status: 'spent',
          referenceId: `TIER-${nextLevel}-UPGRADE`,
          createdAt: new Date().toISOString(),
        });

        return {
          user: sanitizeUser(user),
          tier: tierConfig,
        };
      });

      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Node upgrade failed.' });
    }
  });

  // --- TASKS & VERIFICATION ---

  app.post('/api/tasks/initiate', requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const { taskId } = req.body;
      const result = await withTransaction((db) => {
        const user = db.users.find((u) => u.id === req.user!.id)!;
        const task = db.tasks.find((t) => t.id === taskId && t.active);
        if (!task) {
          throw new Error('Task not found or inactive.');
        }

        const dateKey = task.category === 'daily' ? getTodayKey() : 'ONCE';
        let record = db.userTasks.find(
          (ut) => ut.userId === user.id && ut.taskId === task.id && ut.dateKey === dateKey
        );

        if (record && record.status === 'verified') {
          throw new Error('Task has already been verified and claimed.');
        }

        if (!record) {
          record = {
            id: `ut-${crypto.randomBytes(4).toString('hex')}`,
            userId: user.id,
            taskId: task.id,
            status: 'initiated',
            initiatedAt: new Date().toISOString(),
            verifiedAt: null,
            proofInput: null,
            dateKey,
            pointsAwarded: 0,
          };
          db.userTasks.push(record);
        } else {
          record.initiatedAt = new Date().toISOString();
        }

        return { record };
      });

      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Could not initiate task.' });
    }
  });

  app.post('/api/tasks/verify', requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const { taskId, proofInput } = req.body;
      const result = await withTransaction((db) => {
        if (db.config.campaignPaused) {
          throw new Error('Reward campaigns are currently paused by administrators.');
        }

        const user = db.users.find((u) => u.id === req.user!.id)!;
        const task = db.tasks.find((t) => t.id === taskId && t.active);
        if (!task) {
          throw new Error('Task not found or inactive.');
        }

        const now = new Date();
        const todayKey = getTodayKey();
        const dateKey = task.category === 'daily' ? todayKey : 'ONCE';

        let record = db.userTasks.find(
          (ut) => ut.userId === user.id && ut.taskId === task.id && ut.dateKey === dateKey
        );

        if (record && record.status === 'verified') {
          db.suspiciousLogs.unshift({
            id: `sec-${crypto.randomBytes(3).toString('hex')}`,
            userId: user.id,
            userEmail: user.email,
            eventType: 'duplicate_claim_attempt',
            severity: 'low',
            details: `Duplicate task claim request for ${task.title} (${task.id}).`,
            createdAt: now.toISOString(),
            resolved: false,
          });
          throw new Error('Task reward already claimed.');
        }

        // Verification logic per type
        if (task.verificationType === 'checkin') {
          throw new Error('Please use the Daily Check-In button to claim check-in streak rewards.');
        }

        if (task.verificationType === 'node_session_count') {
          const completedToday = getTodayCompletedSessions(db, user.id, todayKey);
          const needed = task.requiredCount || 1;
          if (completedToday < needed) {
            throw new Error(
              `Verification failed: You have completed ${completedToday}/${needed} Node Run sessions today.`
            );
          }
        } else {
          // Must have initiated the task first
          if (!record) {
            throw new Error('Please open and complete the task action first before verifying.');
          }

          const dwellSeconds = (now.getTime() - new Date(record.initiatedAt).getTime()) / 1000;
          const minDwell = task.minDwellSeconds ?? 4;
          if (dwellSeconds < minDwell) {
            db.suspiciousLogs.unshift({
              id: `sec-${crypto.randomBytes(3).toString('hex')}`,
              userId: user.id,
              userEmail: user.email,
              eventType: 'rapid_task_verify',
              severity: 'medium',
              details: `User attempted to verify "${task.title}" only ${dwellSeconds.toFixed(1)}s after initiating (min ${minDwell}s).`,
              createdAt: now.toISOString(),
              resolved: false,
            });
            throw new Error(
              `Verification rejected: Please complete the task action thoroughly before claiming (wait at least ${Math.ceil(minDwell - dwellSeconds)}s).`
            );
          }

          if (task.verificationType === 'social_handle') {
            const cleanProof = String(proofInput || '').trim();
            if (cleanProof.length < 3) {
              db.suspiciousLogs.unshift({
                id: `sec-${crypto.randomBytes(3).toString('hex')}`,
                userId: user.id,
                userEmail: user.email,
                eventType: 'invalid_proof',
                severity: 'low',
                details: `Empty or invalid social handle submitted for "${task.title}".`,
                createdAt: now.toISOString(),
                resolved: false,
              });
              throw new Error('Please enter your valid social username/handle (e.g. @username) to verify completion.');
            }
          }

          if (task.verificationType === 'share_link') {
            const cleanProof = String(proofInput || '').trim();
            if (cleanProof.length < 6) {
              throw new Error('Please provide your shared post URL or confirmation ID to verify.');
            }
          }
        }

        if (!record) {
          record = {
            id: `ut-${crypto.randomBytes(4).toString('hex')}`,
            userId: user.id,
            taskId: task.id,
            status: 'verified',
            initiatedAt: now.toISOString(),
            verifiedAt: now.toISOString(),
            proofInput: proofInput ? String(proofInput).trim().slice(0, 120) : 'VERIFIED',
            dateKey,
            pointsAwarded: task.points,
          };
          db.userTasks.push(record);
        } else {
          record.status = 'verified';
          record.verifiedAt = now.toISOString();
          record.proofInput = proofInput ? String(proofInput).trim().slice(0, 120) : 'VERIFIED';
          record.pointsAwarded = task.points;
        }

        user.availablePoints += task.points;
        user.lifetimeEarned += task.points;

        db.transactions.unshift({
          id: `tx-${crypto.randomBytes(4).toString('hex')}`,
          userId: user.id,
          userEmail: user.email,
          type: 'task_reward',
          title: `Task Verified: ${task.title}`,
          amount: task.points,
          balanceAfter: user.availablePoints,
          status: 'verified',
          referenceId: task.id,
          createdAt: now.toISOString(),
        });

        return {
          record,
          pointsAwarded: task.points,
          availablePoints: user.availablePoints,
        };
      });

      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Task verification failed.' });
    }
  });

  // --- PROFILE & SETTINGS ---

  app.put('/api/profile', requireAuth, async (req: AuthedRequest, res: Response) => {
    try {
      const { displayName, settings } = req.body;
      const result = await withTransaction((db) => {
        const user = db.users.find((u) => u.id === req.user!.id)!;
        if (typeof displayName === 'string' && displayName.trim().length >= 2) {
          user.displayName = displayName.trim().slice(0, 40);
        }
        if (settings && typeof settings === 'object') {
          user.settings = {
            ...user.settings,
            sessionAlerts: Boolean(settings.sessionAlerts ?? user.settings.sessionAlerts),
            compactLedger: Boolean(settings.compactLedger ?? user.settings.compactLedger),
            telemetryOverlay: Boolean(settings.telemetryOverlay ?? user.settings.telemetryOverlay),
            themeGlow: settings.themeGlow === 'amber' ? 'amber' : 'orange',
            themeMode: settings.themeMode === 'light' ? 'light' : 'dark',
          };
        }
        return { user: sanitizeUser(user) };
      });
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Could not update profile.' });
    }
  });

  // --- ADMIN ROUTES ---

  app.get('/api/admin/overview', requireAuth, requireAdmin, (_req: AuthedRequest, res: Response) => {
    const db = readDb();
    res.json({
      config: db.config,
      users: db.users.map(sanitizeUser),
      nodeSessions: db.nodeSessions.slice(0, 50),
      transactions: db.transactions.slice(0, 100),
      tasks: db.tasks,
      suspiciousLogs: db.suspiciousLogs,
    });
  });

  app.put('/api/admin/config', requireAuth, requireAdmin, async (req: AuthedRequest, res: Response) => {
    try {
      const updates = req.body;
      const result = await withTransaction((db) => {
        if (typeof updates.basePointsPerSession === 'number') {
          db.config.basePointsPerSession = Math.max(10, Math.min(5000, Math.round(updates.basePointsPerSession)));
        }
        if (typeof updates.sessionDurationSeconds === 'number') {
          db.config.sessionDurationSeconds = Math.max(10, Math.min(86400, Math.round(updates.sessionDurationSeconds)));
        }
        if (typeof updates.cooldownSeconds === 'number') {
          db.config.cooldownSeconds = Math.max(0, Math.min(3600, Math.round(updates.cooldownSeconds)));
        }
        if (typeof updates.dailyPointLimit === 'number') {
          db.config.dailyPointLimit = Math.max(100, Math.min(100000, Math.round(updates.dailyPointLimit)));
        }
        if (typeof updates.maxDailySessions === 'number') {
          db.config.maxDailySessions = Math.max(1, Math.min(100, Math.round(updates.maxDailySessions)));
        }
        if (typeof updates.campaignPaused === 'boolean') {
          db.config.campaignPaused = updates.campaignPaused;
        }
        if (Array.isArray(updates.nodeTiers)) {
          db.config.nodeTiers = updates.nodeTiers.map((t: any, idx: number) => ({
            level: idx + 1,
            name: String(t.name || `Tier ${idx + 1}`).slice(0, 40),
            subtitle: String(t.subtitle || '').slice(0, 100),
            cost: Math.max(0, Number(t.cost) || 0),
            multiplier: Math.max(1, Number(t.multiplier) || 1),
            dailyLimitBonus: Math.max(0, Number(t.dailyLimitBonus) || 0),
            bandwidthSpec: String(t.bandwidthSpec || `${t.multiplier}x Multiplier`).slice(0, 60),
          }));
        }
        return { config: db.config };
      });
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to update configuration.' });
    }
  });

  app.post('/api/admin/tasks', requireAuth, requireAdmin, async (req: AuthedRequest, res: Response) => {
    try {
      const { title, description, category, points, verificationType, actionUrl } = req.body;
      if (!title || !points) {
        res.status(400).json({ error: 'Task title and points reward are required.' });
        return;
      }
      const result = await withTransaction((db) => {
        const newTask = {
          id: `task-${crypto.randomBytes(3).toString('hex')}`,
          title: String(title).trim().slice(0, 60),
          description: String(description || 'Complete verification to earn NAMI Points.').trim().slice(0, 160),
          category: (['daily', 'social', 'ecosystem'].includes(category) ? category : 'social') as 'daily' | 'social' | 'ecosystem',
          points: Math.max(5, Math.min(5000, Math.round(Number(points)))),
          verificationType: (['url_visit', 'social_handle', 'share_link', 'node_session_count'].includes(verificationType)
            ? verificationType
            : 'social_handle') as any,
          actionUrl: actionUrl ? String(actionUrl).trim() : 'https://namiwallet.io',
          minDwellSeconds: 4,
          active: true,
        };
        db.tasks.push(newTask);
        return { tasks: db.tasks };
      });
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to create task.' });
    }
  });

  app.patch('/api/admin/tasks/:id/toggle', requireAuth, requireAdmin, async (req: AuthedRequest, res: Response) => {
    try {
      const taskId = req.params.id;
      const result = await withTransaction((db) => {
        const task = db.tasks.find((t) => t.id === taskId);
        if (!task) throw new Error('Task not found.');
        task.active = !task.active;
        return { tasks: db.tasks };
      });
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Failed to toggle task.' });
    }
  });

  app.post('/api/admin/suspicious/:id/resolve', requireAuth, requireAdmin, async (req: AuthedRequest, res: Response) => {
    try {
      const logId = req.params.id;
      const result = await withTransaction((db) => {
        const item = db.suspiciousLogs.find((l) => l.id === logId);
        if (!item) throw new Error('Log entry not found.');
        item.resolved = true;
        return { suspiciousLogs: db.suspiciousLogs };
      });
      res.json(result);
    } catch (err: any) {
      res.status(400).json({ error: err.message || 'Could not resolve log.' });
    }
  });

  app.get('/api/ping', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      serverTimestamp: new Date().toISOString(),
      relayRegion: 'ap-east-1 · NAMI Orbital Core',
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`NAMI WALLET server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
