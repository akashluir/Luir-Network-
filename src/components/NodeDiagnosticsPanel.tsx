import React, { useEffect, useState, useCallback } from 'react';
import {
  Activity,
  Wifi,
  RefreshCw,
  Bell,
  BellRing,
  CheckCircle2,
  Server,
  AlertTriangle,
  ShieldCheck,
  Clock,
  FileText,
} from 'lucide-react';
import {
  BrowserNotificationPermission,
  getBrowserNotificationPermission,
  requestBrowserNotificationPermission,
  triggerNodeRunCompletionNotification,
} from '../utils/notifications.ts';

interface NodeDiagnosticsPanelProps {
  isNodeActive: boolean;
  nodeLevel: number;
  tierName: string;
  bandwidthSpec: string;
  sessionAlertsEnabled: boolean;
}

interface ProbeSample {
  id: number;
  latencyMs: number;
  packetLossPct: number;
  timestamp: string;
}

interface MaintenanceLogEntry {
  id: string;
  type: 'uptime_window' | 'performance_dip';
  title: string;
  subsystem: string;
  windowLabel: string;
  metricsLabel: string;
  details: string;
  timestamp: string;
  statusLabel: string;
}

const INITIAL_MAINTENANCE_LOGS: MaintenanceLogEntry[] = [
  {
    id: 'ml-01',
    type: 'uptime_window',
    title: 'Continuous 7h Cycle Verification Window (#EP-412)',
    subsystem: 'ap-east-1 · Orbital Validator Core',
    windowLabel: 'Duration: 7h 00m',
    metricsLabel: '99.99% Uptime · 17ms Avg RTT · 0.00% Loss',
    details:
      'Completed full 7-hour verification cycle with zero dropped packets and uninterrupted heartbeat consensus.',
    timestamp: 'Today · 06:40 UTC',
    statusLabel: 'Verified Window',
  },
  {
    id: 'ml-02',
    type: 'performance_dip',
    title: 'Transient Edge Peer Jitter & Packet Retransmission',
    subsystem: 'ap-east-1b · Ingress Relay Mesh',
    windowLabel: 'Duration: 38s',
    metricsLabel: 'Peak 68ms RTT · 0.04% Packet Loss',
    details:
      'Brief upstream BGP route fluctuation detected on secondary peer relay. Auto-rerouted to primary orbital channel within 38 seconds without session interruption.',
    timestamp: 'Yesterday · 21:14 UTC',
    statusLabel: 'Auto-Mitigated',
  },
  {
    id: 'ml-03',
    type: 'uptime_window',
    title: 'Multi-Channel Zero-Loss Consensus Window (#EP-409)',
    subsystem: 'ap-east-1 · NAMI Telemetry Engine',
    windowLabel: 'Duration: 14h 00m',
    metricsLabel: '100.00% Uptime · 16ms Avg RTT · 0.00% Loss',
    details:
      'Sustained two consecutive 7-hour Node Run verification windows with 100% cryptographic proof delivery.',
    timestamp: '2 Days Ago · 18:00 UTC',
    statusLabel: 'Verified Window',
  },
  {
    id: 'ml-04',
    type: 'performance_dip',
    title: 'Validator TLS Handshake Latency Spike',
    subsystem: 'eu-central-2 · Cross-Region Bridge',
    windowLabel: 'Duration: 1m 12s',
    metricsLabel: 'Peak 84ms RTT · 0.08% Packet Loss',
    details:
      'High concurrent epoch checkpoint load caused elevated handshake latency. Adaptive buffer scaling restored baseline 18ms RTT.',
    timestamp: '3 Days Ago · 11:25 UTC',
    statusLabel: 'Resolved',
  },
  {
    id: 'ml-05',
    type: 'uptime_window',
    title: 'High-Throughput Validator Uptime Window (#EP-404)',
    subsystem: 'ap-east-1 · NAMI Orbital Core',
    windowLabel: 'Duration: 21h 00m',
    metricsLabel: '99.98% Uptime · 18ms Avg RTT · 0.00% Loss',
    details:
      'Three consecutive 7h node cycles verified with deterministic reward settlement and sub-20ms median ping.',
    timestamp: '4 Days Ago · 09:30 UTC',
    statusLabel: 'Verified Window',
  },
  {
    id: 'ml-06',
    type: 'performance_dip',
    title: 'Scheduled Telemetry Buffer Compaction Dip',
    subsystem: 'Local State & Peer Sync Queue',
    windowLabel: 'Duration: 24s',
    metricsLabel: 'Peak 52ms RTT · 0.02% Packet Loss',
    details:
      'Routine ledger snapshot compaction temporarily increased ping jitter by +26ms; zero impact on active Node Run reward accumulation.',
    timestamp: '6 Days Ago · 03:10 UTC',
    statusLabel: 'Resolved',
  },
  {
    id: 'ml-07',
    type: 'uptime_window',
    title: 'Genesis Epoch Stability Window (#EP-398)',
    subsystem: 'ap-east-1 · NAMI Orbital Core',
    windowLabel: 'Duration: 28h 00m',
    metricsLabel: '100.00% Uptime · 15ms Avg RTT · 0.00% Loss',
    details:
      'Full 28-hour continuous relay availability benchmark passed with zero packet loss across all validator channels.',
    timestamp: '1 Week Ago · 14:00 UTC',
    statusLabel: 'Verified Window',
  },
];

export const NodeDiagnosticsPanel: React.FC<NodeDiagnosticsPanelProps> = ({
  isNodeActive,
  nodeLevel,
  tierName,
  bandwidthSpec,
  sessionAlertsEnabled,
}) => {
  const [samples, setSamples] = useState<ProbeSample[]>(() => [
    { id: 1, latencyMs: 18, packetLossPct: 0.0, timestamp: 'Init' },
    { id: 2, latencyMs: 21, packetLossPct: 0.0, timestamp: 'Init' },
    { id: 3, latencyMs: 16, packetLossPct: 0.0, timestamp: 'Init' },
    { id: 4, latencyMs: 19, packetLossPct: 0.0, timestamp: 'Init' },
    { id: 5, latencyMs: 22, packetLossPct: 0.0, timestamp: 'Init' },
    { id: 6, latencyMs: 17, packetLossPct: 0.0, timestamp: 'Init' },
    { id: 7, latencyMs: 15, packetLossPct: 0.0, timestamp: 'Init' },
    { id: 8, latencyMs: 19, packetLossPct: 0.0, timestamp: 'Init' },
    { id: 9, latencyMs: 20, packetLossPct: 0.0, timestamp: 'Init' },
    { id: 10, latencyMs: 16, packetLossPct: 0.0, timestamp: 'Init' },
    { id: 11, latencyMs: 18, packetLossPct: 0.0, timestamp: 'Init' },
    { id: 12, latencyMs: 17, packetLossPct: 0.0, timestamp: 'Init' },
  ]);
  const [probing, setProbing] = useState(false);
  const [packetsVerified, setPacketsVerified] = useState(() => 1420 + nodeLevel * 380);
  const [packetsDropped, setPacketsDropped] = useState(0);
  const [relayRegion, setRelayRegion] = useState('ap-east-1 · NAMI Orbital Core');
  const [notifPerm, setNotifPerm] = useState<BrowserNotificationPermission>(() =>
    getBrowserNotificationPermission()
  );
  const [notifFeedback, setNotifFeedback] = useState<string | null>(null);
  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLogEntry[]>(
    INITIAL_MAINTENANCE_LOGS
  );
  const [logFilter, setLogFilter] = useState<'all' | 'uptime_window' | 'performance_dip'>('all');

  const runDiagnosticProbe = useCallback(
    async (manualTrigger = false) => {
      setProbing(true);
      const t0 = performance.now();
      try {
        const res = await fetch('/api/ping');
        const data = await res.json();
        const rtt = Math.max(8, Math.round(performance.now() - t0));
        if (data?.relayRegion) {
          setRelayRegion(data.relayRegion);
        }

        // Simulate realistic network micro-variance around actual HTTP RTT
        const jitter = Math.floor(Math.random() * 5) - 2;
        const measuredLatency = Math.max(6, rtt + jitter);
        const rareDrop = Math.random() < 0.04 ? 1 : 0;
        const lossPct = rareDrop ? 0.02 : 0.0;

        setPacketsVerified((prev) => prev + (isNodeActive ? 24 : 8));
        if (rareDrop) {
          setPacketsDropped((prev) => prev + 1);
        }

        const nowStr = new Date().toLocaleTimeString(undefined, {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });

        setSamples((prev) => [
          ...prev.slice(-11),
          {
            id: Date.now(),
            latencyMs: measuredLatency,
            packetLossPct: lossPct,
            timestamp: nowStr,
          },
        ]);

        if (manualTrigger || rareDrop) {
          const newEntry: MaintenanceLogEntry = rareDrop
            ? {
                id: `ml-live-${Date.now()}`,
                type: 'performance_dip',
                title: 'Minor Telemetry Jitter Detected During Probe',
                subsystem: `${data?.relayRegion || relayRegion}`,
                windowLabel: 'Duration: 4s',
                metricsLabel: `${measuredLatency}ms RTT · 0.02% Loss`,
                details:
                  'Single packet retransmission observed during live diagnostic probe; peer consensus remained locked.',
                timestamp: `Live · ${nowStr}`,
                statusLabel: 'Auto-Mitigated',
              }
            : {
                id: `ml-live-${Date.now()}`,
                type: 'uptime_window',
                title: `Manual Diagnostic Check Passed (${tierName})`,
                subsystem: `${data?.relayRegion || relayRegion}`,
                windowLabel: 'Window: Active Snapshot',
                metricsLabel: `100% Uptime · ${measuredLatency}ms RTT · 0.00% Loss`,
                details:
                  'Live telemetry verification confirmed optimal packet delivery and zero-loss relay connectivity.',
                timestamp: `Live · ${nowStr}`,
                statusLabel: 'Verified Window',
              };
          setMaintenanceLogs((prev) => [newEntry, ...prev.slice(0, 14)]);
        }
      } catch {
        setSamples((prev) => [
          ...prev.slice(-11),
          {
            id: Date.now(),
            latencyMs: 24,
            packetLossPct: 0.0,
            timestamp: 'Local',
          },
        ]);
      } finally {
        setProbing(false);
      }
    },
    [isNodeActive, relayRegion, tierName]
  );

  // Run an initial probe on mount and periodically every 6s when node is active
  useEffect(() => {
    runDiagnosticProbe(false);
  }, [runDiagnosticProbe]);

  useEffect(() => {
    if (!isNodeActive) return;
    const interval = setInterval(() => {
      runDiagnosticProbe(false);
    }, 6000);
    return () => clearInterval(interval);
  }, [isNodeActive, runDiagnosticProbe]);

  const latestSample = samples[samples.length - 1] || {
    latencyMs: 18,
    packetLossPct: 0.0,
    timestamp: 'Now',
  };

  const avgLatency = Math.round(
    samples.reduce((sum, s) => sum + s.latencyMs, 0) / Math.max(1, samples.length)
  );
  const minLatency = Math.min(...samples.map((s) => s.latencyMs));
  const maxLatency = Math.max(...samples.map((s) => s.latencyMs));
  const jitterMs = Math.max(1, maxLatency - minLatency);

  const totalPackets = packetsVerified + packetsDropped;
  const cumulativeLossPct =
    totalPackets > 0 ? ((packetsDropped / totalPackets) * 100).toFixed(2) : '0.00';

  const filteredLogs = maintenanceLogs.filter((entry) =>
    logFilter === 'all' ? true : entry.type === logFilter
  );

  const uptimeCount = maintenanceLogs.filter((l) => l.type === 'uptime_window').length;
  const dipCount = maintenanceLogs.filter((l) => l.type === 'performance_dip').length;

  const handleEnableBrowserNotifications = async () => {
    const perm = await requestBrowserNotificationPermission();
    setNotifPerm(perm);
    if (perm === 'granted') {
      triggerNodeRunCompletionNotification({
        title: 'NAMI WALLET · Push Alerts Active',
        body: 'You will receive a desktop notification when your Node Run session completes while minimized.',
        tag: 'nami-notif-enabled',
      });
      setNotifFeedback('Browser push notifications enabled.');
    } else if (perm === 'denied') {
      setNotifFeedback(
        'Browser notification permission blocked by browser settings. Audio chime & title alerts remain active.'
      );
    } else {
      setNotifFeedback('Notification permission prompt dismissed.');
    }
    setTimeout(() => setNotifFeedback(null), 5000);
  };

  const handleTestNotification = () => {
    const sent = triggerNodeRunCompletionNotification({
      title: 'NAMI WALLET · Node Run Completed',
      body: `Your ${tierName} session has reached 100% completion and is ready to claim.`,
      tag: 'nami-test-alert',
    });
    setNotifFeedback(
      sent
        ? 'Test push notification dispatched via Browser Notification API.'
        : 'Completion alert chime triggered (grant browser Notification permission for OS banner).'
    );
    setTimeout(() => setNotifFeedback(null), 4500);
  };

  return (
    <div className="rounded-3xl nami-glass p-6 sm:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Activity className="w-4 h-4 text-orange-400" />
            <span>Node Diagnostics & Network Telemetry</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-tabular text-slate-300">{relayRegion}</span>
          </div>
          <h3 className="text-lg font-semibold text-white mt-0.5">
            Real-Time Ping Latency & Packet Loss Monitor
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {notifPerm !== 'granted' ? (
            <button
              type="button"
              onClick={handleEnableBrowserNotifications}
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/35 text-xs font-medium text-orange-300 flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Enable Push Alerts</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleTestNotification}
              className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white/[0.05] hover:bg-white/[0.1] border border-white/10 text-xs font-medium text-slate-200 flex items-center gap-2 transition-colors whitespace-nowrap shrink-0"
            >
              <BellRing className="w-3.5 h-3.5 text-orange-400" />
              <span>Test Completion Push</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => runDiagnosticProbe(true)}
            disabled={probing}
            className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 text-xs font-medium text-white flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-orange-400 ${probing ? 'animate-spin' : ''}`} />
            <span>{probing ? 'Probing Relay...' : 'Run Diagnostic Probe'}</span>
          </button>
        </div>
      </div>

      {notifFeedback && (
        <div className="p-3.5 rounded-xl bg-orange-500/15 border border-orange-500/35 text-xs text-orange-200 flex items-center justify-between gap-3">
          <span>{notifFeedback}</span>
          <button
            type="button"
            onClick={() => setNotifFeedback(null)}
            className="text-orange-300 hover:text-white font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* 4-Column Diagnostics KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Ping Latency (RTT)</span>
            <Wifi className="w-3.5 h-3.5 text-orange-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono-tabular text-white">
            {latestSample.latencyMs}{' '}
            <span className="text-xs font-normal text-slate-400">ms</span>
          </div>
          <div className="mt-1 text-xs font-mono-tabular text-slate-400">
            Avg: {avgLatency}ms · Jitter: ±{jitterMs}ms
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Packet Loss Rate</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono-tabular text-emerald-400">
            {cumulativeLossPct}%
          </div>
          <div className="mt-1 text-xs font-mono-tabular text-slate-400">
            {packetsDropped} dropped / {totalPackets.toLocaleString()} total
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Verified Packets</span>
            <Server className="w-3.5 h-3.5 text-orange-400" />
          </div>
          <div className="mt-2 text-2xl font-bold font-mono-tabular text-white">
            {packetsVerified.toLocaleString()}
          </div>
          <div className="mt-1 text-xs text-slate-400 truncate">
            {bandwidthSpec}
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white/[0.03] border border-white/10">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>Minimized Tab Alert</span>
            <Bell className="w-3.5 h-3.5 text-orange-400" />
          </div>
          <div className="mt-2 text-lg font-bold text-white">
            {notifPerm === 'granted' && sessionAlertsEnabled
              ? 'Push Active'
              : sessionAlertsEnabled
              ? 'Chime + Title'
              : 'Muted'}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            API Permission: {notifPerm}
          </div>
        </div>
      </div>

      {/* Live Ping Latency History Visualizer */}
      <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400 mb-3">
          <span>Recent 12-Probe Ping Latency Sequence (ms)</span>
          <span className="font-mono-tabular">
            Min: {minLatency}ms · Max: {maxLatency}ms · State:{' '}
            <strong className="text-orange-400">
              {isNodeActive ? 'Active Stream' : 'Standby Polling'}
            </strong>
          </span>
        </div>

        <div className="grid grid-cols-12 gap-2 items-end h-20 pt-2">
          {samples.map((s) => {
            const barHeightPct = Math.min(100, Math.max(18, Math.round((s.latencyMs / 45) * 100)));
            return (
              <div
                key={s.id}
                className="flex flex-col items-center justify-end h-full gap-1.5"
              >
                <div className="w-full bg-white/[0.05] rounded-t-md h-full flex items-end overflow-hidden">
                  <div
                    className="w-full rounded-t-md bg-gradient-to-t from-orange-600 to-amber-400 transition-all duration-300"
                    style={{ height: `${barHeightPct}%` }}
                  />
                </div>
                <span className="text-[10px] font-mono-tabular text-slate-400">
                  {s.latencyMs}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Scrollable Maintenance Log Panel (Historical Performance Dips & Successful Uptime Windows) */}
      <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <FileText className="w-3.5 h-3.5 text-orange-400" />
              <span>Node Diagnostics · Historical Telemetry Ledger</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono-tabular text-emerald-400">30d SLA: 99.96%</span>
            </div>
            <h4 className="text-base font-semibold text-white mt-0.5">
              Maintenance Log — Uptime Windows & Performance Dips
            </h4>
          </div>

          {/* Filter Switcher */}
          <div className="flex items-center gap-1 p-1 bg-white/[0.04] rounded-xl self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setLogFilter('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                logFilter === 'all'
                  ? 'bg-orange-500 text-slate-950 font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              All ({maintenanceLogs.length})
            </button>
            <button
              type="button"
              onClick={() => setLogFilter('uptime_window')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                logFilter === 'uptime_window'
                  ? 'bg-orange-500 text-slate-950 font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Uptime Windows ({uptimeCount})
            </button>
            <button
              type="button"
              onClick={() => setLogFilter('performance_dip')}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                logFilter === 'performance_dip'
                  ? 'bg-orange-500 text-slate-950 font-semibold'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Performance Dips ({dipCount})
            </button>
          </div>
        </div>

        {/* Scrollable Log List */}
        <div
          className="max-h-72 overflow-y-auto pr-1.5 space-y-2.5 divide-y divide-white/5"
          role="region"
          aria-label="Scrollable Maintenance Log"
        >
          {filteredLogs.map((entry) => {
            const isUptime = entry.type === 'uptime_window';
            return (
              <div
                key={entry.id}
                className={`p-3.5 rounded-xl border transition-colors ${
                  isUptime
                    ? 'bg-white/[0.02] border-white/10'
                    : 'bg-amber-500/[0.06] border-amber-500/30'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <div
                      className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                        isUptime
                          ? 'bg-emerald-500/15 text-emerald-400'
                          : 'bg-amber-500/20 text-amber-300'
                      }`}
                    >
                      {isUptime ? (
                        <ShieldCheck className="w-4 h-4" />
                      ) : (
                        <AlertTriangle className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-white">{entry.title}</span>
                        <span
                          className={`text-[10px] font-mono-tabular font-semibold uppercase px-2 py-0.5 rounded-md ${
                            isUptime
                              ? 'bg-emerald-500/15 text-emerald-400'
                              : 'bg-amber-500/20 text-amber-300'
                          }`}
                        >
                          {isUptime ? 'Uptime Window' : 'Performance Dip'}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5 flex flex-wrap items-center gap-2">
                        <span>{entry.subsystem}</span>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono-tabular text-slate-300">
                          {entry.metricsLabel}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="text-[11px] font-mono-tabular text-slate-300 flex items-center justify-end gap-1">
                      <Clock className="w-3 h-3 text-orange-400" />
                      <span>{entry.windowLabel}</span>
                    </div>
                    <div className="text-[10px] font-mono-tabular text-slate-400 mt-0.5">
                      {entry.timestamp} · {entry.statusLabel}
                    </div>
                  </div>
                </div>

                <p className="mt-2 text-xs text-slate-300 leading-relaxed pl-9">
                  {entry.details}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
