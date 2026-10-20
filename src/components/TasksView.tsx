import React, { useState } from 'react';
import {
  CheckCircle2,
  ExternalLink,
  ShieldCheck,
  CalendarCheck,
  Cpu,
  Globe,
  Share2,
  MessageSquare,
} from 'lucide-react';
import { DashboardPayload, TaskItem } from '../types/nami.ts';

interface TasksViewProps {
  data: DashboardPayload;
  isDemoMode: boolean;
  onClaimDailyCheckIn: () => Promise<void>;
  onInitiateTask: (taskId: string) => Promise<void>;
  onVerifyTask: (taskId: string, proofInput?: string) => Promise<void>;
  busyTaskId: string | null;
}

export const TasksView: React.FC<TasksViewProps> = ({
  data,
  isDemoMode,
  onClaimDailyCheckIn,
  onInitiateTask,
  onVerifyTask,
  busyTaskId,
}) => {
  const { tasks, userTaskRecords, stats } = data;
  const [filterCategory, setFilterCategory] = useState<'all' | 'daily' | 'social' | 'ecosystem'>('all');
  const [proofInputs, setProofInputs] = useState<Record<string, string>>({});
  const [activePortalPreview, setActivePortalPreview] = useState<TaskItem | null>(null);

  const filteredTasks = tasks.filter(
    (t) => filterCategory === 'all' || t.category === filterCategory
  );

  const getTaskRecord = (taskId: string) =>
    userTaskRecords.find((r) => r.taskId === taskId);

  const handleOpenAction = async (task: TaskItem) => {
    await onInitiateTask(task.id);
    setActivePortalPreview(task);
  };

  const renderTaskIcon = (task: TaskItem) => {
    switch (task.verificationType) {
      case 'checkin':
        return <CalendarCheck className="w-5 h-5 text-orange-400" />;
      case 'node_session_count':
        return <Cpu className="w-5 h-5 text-orange-400" />;
      case 'url_visit':
        return <Globe className="w-5 h-5 text-orange-400" />;
      case 'share_link':
        return <Share2 className="w-5 h-5 text-orange-400" />;
      default:
        return <MessageSquare className="w-5 h-5 text-orange-400" />;
    }
  };

  return (
    <div className="space-y-8">
      {/* Header & Verification Notice */}
      <div className="rounded-3xl nami-glass-elevated p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        <div className="max-w-2xl">
          <div className="text-xs text-slate-400">
            <span>NAMI Ecosystem Missions</span>
            <span className="mx-1.5" aria-hidden="true">·</span>
            <span>Server Verification Protocol</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mt-1">
            Daily & Social Verification Tasks
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed">
            Complete daily operations and community tasks to earn internal NAMI Points. All tasks require server-side verification of activity or social proof before points are credited.
          </p>
        </div>

        <div className="flex items-center gap-6 shrink-0 border-t lg:border-t-0 pt-4 lg:pt-0 border-white/10">
          <div>
            <div className="text-xs text-slate-400">Verified Tasks</div>
            <div className="text-2xl font-bold font-mono-tabular text-white mt-0.5">
              {stats.completedTasksCount}
            </div>
          </div>
          <div className="h-10 w-px bg-white/10" />
          <div>
            <div className="text-xs text-slate-400">Available Tasks</div>
            <div className="text-2xl font-bold font-mono-tabular text-orange-400 mt-0.5">
              {tasks.length}
            </div>
          </div>
        </div>
      </div>

      {/* In-App External Task Action & Verification Banner */}
      {activePortalPreview && (
        <div className="rounded-2xl bg-orange-500/10 border border-orange-500/40 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-orange-300">
              Task Action Initiated: {activePortalPreview.title}
            </div>
            <p className="text-xs text-slate-300 mt-1">
              Target Destination:{' '}
              <span className="font-mono-tabular text-white">
                {activePortalPreview.actionUrl || 'https://namiwallet.io'}
              </span>{' '}
              — Server dwell timer started. Complete the action and submit your verification below.
            </p>
          </div>
          <button
            onClick={() => setActivePortalPreview(null)}
            className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-xs font-medium text-white shrink-0"
          >
            Acknowledge
          </button>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-1 p-1 bg-white/[0.04] rounded-xl">
          {(
            [
              { id: 'all', label: 'All Tasks' },
              { id: 'daily', label: 'Daily Tasks' },
              { id: 'social', label: 'Social & Community' },
              { id: 'ecosystem', label: 'Ecosystem' },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilterCategory(tab.id)}
              className={`px-3.5 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                filterCategory === tab.id
                  ? 'bg-orange-500 text-slate-950 font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {isDemoMode && (
          <div className="text-xs text-amber-300">
            Demo Preview Mode · Sign in to verify tasks on backend
          </div>
        )}
      </div>

      {/* Tasks Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {filteredTasks.map((task) => {
          const record = getTaskRecord(task.id);
          const isCheckinTask = task.verificationType === 'checkin';
          const isVerified =
            (isCheckinTask && stats.checkedInToday) ||
            (record && record.status === 'verified');
          const isInitiated = Boolean(record && record.status === 'initiated');
          const isBusy = busyTaskId === task.id;

          const needsProofInput =
            task.verificationType === 'social_handle' ||
            task.verificationType === 'share_link';

          return (
            <div
              key={task.id}
              className={`rounded-3xl p-6 flex flex-col justify-between nami-glass transition-all ${
                isVerified ? 'border-orange-500/30 bg-orange-500/[0.03]' : ''
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-orange-500/15 border border-orange-500/30 flex items-center justify-center shrink-0">
                      {renderTaskIcon(task)}
                    </div>
                    <div>
                      <div className="text-xs text-slate-400">
                        <span>{task.category.charAt(0).toUpperCase() + task.category.slice(1)} Task</span>
                        <span className="mx-1.5" aria-hidden="true">·</span>
                        <span>{isVerified ? 'Verified' : isInitiated ? 'Pending Verification' : 'Unverified'}</span>
                      </div>
                      <h3 className="text-base font-bold text-white mt-0.5">{task.title}</h3>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-base font-bold font-mono-tabular text-orange-400">
                      +{task.points} PTS
                    </div>
                    <div className="text-xs text-slate-500">Reward</div>
                  </div>
                </div>

                <p className="mt-3.5 text-xs text-slate-300 leading-relaxed">
                  {task.description}
                </p>

                {/* Proof Input if Task is Initiated and requires Social Handle / Share URL */}
                {!isVerified && isInitiated && needsProofInput && (
                  <div className="mt-4 pt-4 border-t border-white/10">
                    <label className="block text-xs text-slate-300 mb-1.5">
                      {task.verificationType === 'social_handle'
                        ? 'Enter your username/handle for verification (e.g. @nami_user):'
                        : 'Enter your shared update URL or confirmation reference:'}
                    </label>
                    <input
                      type="text"
                      value={proofInputs[task.id] || ''}
                      onChange={(e) =>
                        setProofInputs((prev) => ({ ...prev, [task.id]: e.target.value }))
                      }
                      placeholder={
                        task.verificationType === 'social_handle'
                          ? '@your_handle'
                          : 'https://x.com/your_handle/status/123456'
                      }
                      className="w-full px-3.5 py-2.5 text-xs rounded-xl bg-white/[0.05] border border-white/15 text-white placeholder-slate-500 focus:outline-none focus:border-orange-500"
                    />
                  </div>
                )}
              </div>

              {/* Action Controls */}
              <div className="mt-6 pt-4 border-t border-white/10">
                {isVerified ? (
                  <div className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-orange-500/15 border border-orange-500/30 text-orange-300 text-xs font-semibold flex items-center justify-center gap-2">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Verified & Reward Credited</span>
                  </div>
                ) : isCheckinTask ? (
                  <button
                    onClick={onClaimDailyCheckIn}
                    disabled={isBusy}
                    className="w-full min-h-[44px] px-4 py-2.5 rounded-xl nami-btn-glow text-xs font-semibold flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
                  >
                    <CalendarCheck className="w-4 h-4" />
                    <span>{isBusy ? 'Verifying Check-In...' : 'Verify Daily Check-In'}</span>
                  </button>
                ) : task.verificationType === 'node_session_count' ? (
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-slate-400 font-mono-tabular">
                      Progress: {stats.sessionsCompletedToday}/{task.requiredCount || 1} Sessions Today
                    </span>
                    <button
                      onClick={() => onVerifyTask(task.id, 'SESSION-COUNT-CHECK')}
                      disabled={isBusy}
                      className="min-h-[44px] px-4 py-2.5 rounded-xl nami-btn-glow text-xs font-semibold flex items-center justify-center gap-2 whitespace-nowrap shrink-0"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>{isBusy ? 'Checking...' : 'Verify & Claim'}</span>
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      onClick={() => handleOpenAction(task)}
                      disabled={isBusy}
                      className="min-h-[44px] px-3.5 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-medium text-white flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-orange-400" />
                      <span>{isInitiated ? '1. Re-open Task' : '1. Perform Task'}</span>
                    </button>

                    <button
                      onClick={() => onVerifyTask(task.id, proofInputs[task.id] || '')}
                      disabled={!isInitiated || isBusy}
                      className={`min-h-[44px] px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all whitespace-nowrap shrink-0 ${
                        isInitiated
                          ? 'nami-btn-glow'
                          : 'bg-white/[0.03] border border-white/10 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>{isBusy ? 'Verifying...' : '2. Verify & Claim'}</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
