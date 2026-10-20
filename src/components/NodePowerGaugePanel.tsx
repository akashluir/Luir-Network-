import React, { useMemo } from 'react';
import { Gauge, Zap, Globe, TrendingUp, Cpu } from 'lucide-react';
import {
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import { DashboardPayload } from '../types/nami.ts';

interface NodePowerGaugePanelProps {
  data: DashboardPayload;
  effectiveMultiplier: number;
  isNamiBoostActive: boolean;
}

interface BenchmarkBarItem {
  name: string;
  multiplier: number;
  sessionPoints: number;
  efficiencyIndex: number;
  isCurrent: boolean;
  isGlobalAvg: boolean;
}

const CustomPowerTooltip: React.FC<{
  active?: boolean;
  payload?: any[];
}> = ({ active, payload }) => {
  if (!active || !payload || payload.length === 0) return null;
  const item: BenchmarkBarItem = payload[0].payload;

  return (
    <div className="rounded-2xl bg-[#10131c]/95 border border-orange-500/40 p-3.5 shadow-xl backdrop-blur-md">
      <div className="text-xs font-bold text-white">{item.name}</div>
      <div className="mt-1.5 space-y-1 text-xs">
        <div className="flex items-center justify-between gap-5">
          <span className="text-slate-400">Yield Multiplier:</span>
          <span className="font-mono-tabular font-bold text-orange-400">
            {item.multiplier.toFixed(2)}x
          </span>
        </div>
        <div className="flex items-center justify-between gap-5">
          <span className="text-slate-400">Yield per 7h Cycle:</span>
          <span className="font-mono-tabular font-semibold text-white">
            +{item.sessionPoints.toLocaleString()} PTS
          </span>
        </div>
        <div className="flex items-center justify-between gap-5">
          <span className="text-slate-400">Efficiency vs Global:</span>
          <span className="font-mono-tabular text-amber-300">
            {item.efficiencyIndex}% of Global Avg
          </span>
        </div>
      </div>
    </div>
  );
};

export const NodePowerGaugePanel: React.FC<NodePowerGaugePanelProps> = ({
  data,
  effectiveMultiplier,
  isNamiBoostActive,
}) => {
  const { user, config, leaderboard } = data;
  const currentTier =
    config.nodeTiers.find((t) => t.level === user.nodeLevel) || config.nodeTiers[0];
  const streakBonus = Math.min(user.streakDays * 5, 50);

  // Compute global network average multiplier across leaderboard operators
  const globalAvgMultiplier = useMemo(() => {
    if (!leaderboard || leaderboard.length === 0) return 1.85;
    const sumMultipliers = leaderboard.reduce((acc, entry) => {
      const tier = config.nodeTiers.find((t) => t.level === entry.nodeLevel);
      return acc + (tier ? tier.multiplier : 1.5);
    }, 0);
    return Number((sumMultipliers / leaderboard.length).toFixed(2));
  }, [leaderboard, config.nodeTiers]);

  const maxTierMultiplier = useMemo(() => {
    return Math.max(3.5, ...config.nodeTiers.map((t) => t.multiplier));
  }, [config.nodeTiers]);

  // Max gauge scale accounts for Nami Boost (up to 7.0x) or standard max tier (3.5x)
  const gaugeMaxMultiplier = isNamiBoostActive ? maxTierMultiplier * 2 : maxTierMultiplier;

  const userSessionYield = Math.round(
    config.basePointsPerSession * effectiveMultiplier + streakBonus
  );
  const globalAvgSessionYield = Math.round(
    config.basePointsPerSession * globalAvgMultiplier + 25
  );

  // Comparative efficiency index where Global Average = 100%
  const comparativeEfficiencyPct = Math.round(
    (effectiveMultiplier / Math.max(0.1, globalAvgMultiplier)) * 100
  );
  const deltaVsGlobalPct = comparativeEfficiencyPct - 100;

  // Radial gauge percentage (0 - 100)
  const userGaugeScore = Math.min(
    100,
    Math.round((effectiveMultiplier / gaugeMaxMultiplier) * 100)
  );
  const globalGaugeScore = Math.min(
    100,
    Math.round((globalAvgMultiplier / gaugeMaxMultiplier) * 100)
  );

  // RadialBarChart rings: outer ring = User Node Power, inner ring = Global Average Benchmark
  const radialGaugeData = useMemo(
    () => [
      {
        name: 'Global Network Avg',
        value: globalGaugeScore,
        fill: '#38bdf8',
      },
      {
        name: 'Your Node Power',
        value: userGaugeScore,
        fill: '#FF6B00',
      },
    ],
    [globalGaugeScore, userGaugeScore]
  );

  // Comparative benchmark bars across tiers + global average
  const benchmarkBars: BenchmarkBarItem[] = useMemo(() => {
    const items: BenchmarkBarItem[] = [
      {
        name: 'Tier 1 Entry',
        multiplier: 1.0,
        sessionPoints: Math.round(config.basePointsPerSession * 1.0 + streakBonus),
        efficiencyIndex: Math.round((1.0 / globalAvgMultiplier) * 100),
        isCurrent: !isNamiBoostActive && user.nodeLevel === 1,
        isGlobalAvg: false,
      },
      {
        name: 'Global Avg',
        multiplier: globalAvgMultiplier,
        sessionPoints: globalAvgSessionYield,
        efficiencyIndex: 100,
        isCurrent: false,
        isGlobalAvg: true,
      },
      {
        name: `Your Node (${effectiveMultiplier}x)`,
        multiplier: effectiveMultiplier,
        sessionPoints: userSessionYield,
        efficiencyIndex: comparativeEfficiencyPct,
        isCurrent: true,
        isGlobalAvg: false,
      },
      {
        name: 'Tier 4 Quantum',
        multiplier: maxTierMultiplier,
        sessionPoints: Math.round(
          config.basePointsPerSession * maxTierMultiplier + streakBonus
        ),
        efficiencyIndex: Math.round((maxTierMultiplier / globalAvgMultiplier) * 100),
        isCurrent: !isNamiBoostActive && user.nodeLevel === 4,
        isGlobalAvg: false,
      },
    ];
    return items;
  }, [
    config.basePointsPerSession,
    streakBonus,
    globalAvgMultiplier,
    globalAvgSessionYield,
    effectiveMultiplier,
    userSessionYield,
    comparativeEfficiencyPct,
    maxTierMultiplier,
    isNamiBoostActive,
    user.nodeLevel,
  ]);

  return (
    <div className="rounded-3xl nami-glass p-6 sm:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Gauge className="w-4 h-4 text-orange-400" />
            <span>Node Power & Yield Efficiency Telemetry</span>
            <span aria-hidden="true">·</span>
            <span>Global Network Benchmark</span>
          </div>
          <h3 className="text-lg font-semibold text-white mt-0.5">
            Node Power Gauge — Comparative Yield Efficiency vs. Global Average
          </h3>
        </div>

        {/* Efficiency Delta Status Badge */}
        <div className="flex flex-wrap items-center gap-3">
          <div
            className={`px-3.5 py-2 rounded-xl border text-xs font-mono-tabular font-semibold flex items-center gap-2 ${
              deltaVsGlobalPct >= 0
                ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-400'
                : 'bg-amber-500/15 border-amber-500/35 text-amber-300'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5" />
            <span>
              {deltaVsGlobalPct >= 0
                ? `+${deltaVsGlobalPct}% Above Global Average`
                : `${deltaVsGlobalPct}% vs Global Avg (Upgrade or Boost for +2x)`}
            </span>
          </div>
        </div>
      </div>

      {/* Main 2-Column Split: Recharts Radial Power Gauge + Comparative Benchmark Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left: Recharts Radial Bar Power Gauge */}
        <div className="lg:col-span-5 p-5 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="font-medium text-slate-300">
              Real-Time Node Power Index
            </span>
            <span className="font-mono-tabular text-orange-400 font-semibold">
              Tier {user.nodeLevel} {isNamiBoostActive ? '· 2x Boosted' : ''}
            </span>
          </div>

          <div className="relative w-full h-56 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                cx="50%"
                cy="62%"
                innerRadius="52%"
                outerRadius="95%"
                barSize={14}
                data={radialGaugeData}
                startAngle={205}
                endAngle={-25}
              >
                <PolarAngleAxis
                  type="number"
                  domain={[0, 100]}
                  angleAxisId={0}
                  tick={false}
                />
                <RadialBar
                  background={{ fill: 'rgba(255, 255, 255, 0.06)' }}
                  dataKey="value"
                  cornerRadius={10}
                />
              </RadialBarChart>
            </ResponsiveContainer>

            {/* Center Gauge Readout Overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pt-6 pointer-events-none">
              <div className="text-[11px] uppercase tracking-wider text-slate-400">
                Efficiency Index
              </div>
              <div className="text-3xl font-bold font-mono-tabular text-white mt-0.5">
                {comparativeEfficiencyPct}%
              </div>
              <div className="text-xs font-mono-tabular text-orange-400 font-semibold mt-0.5">
                {effectiveMultiplier.toFixed(2)}x Yield Power
              </div>
            </div>
          </div>

          {/* Gauge Legend & Comparison Metrics */}
          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-white/10 text-xs">
            <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
              <div className="flex items-center gap-1.5 text-slate-400">
                <span className="w-2.5 h-2.5 rounded-full bg-orange-500 inline-block" />
                <span>Your Node Yield</span>
              </div>
              <div className="mt-1 text-sm font-bold font-mono-tabular text-white">
                {effectiveMultiplier.toFixed(2)}x ({userSessionYield} PTS)
              </div>
            </div>

            <div className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
              <div className="flex items-center gap-1.5 text-slate-400">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-400 inline-block" />
                <span>Global Network Avg</span>
              </div>
              <div className="mt-1 text-sm font-bold font-mono-tabular text-slate-200">
                {globalAvgMultiplier.toFixed(2)}x ({globalAvgSessionYield} PTS)
              </div>
            </div>
          </div>
        </div>

        {/* Right: Recharts Comparative Yield Efficiency Bar Chart & Tier Breakdown */}
        <div className="lg:col-span-7 p-5 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col justify-between space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="text-xs font-semibold text-white">
                Comparative Cycle Output (Points per 7h Session)
              </div>
              <div className="text-[11px] text-slate-400">
                Comparing your active {currentTier.name} against network peers and hardware tiers
              </div>
            </div>
            <div className="text-xs font-mono-tabular text-slate-300">
              Hourly Rate:{' '}
              <strong className="text-orange-400">
                +{(userSessionYield / 7).toFixed(1)} PTS/hr
              </strong>
            </div>
          </div>

          <div className="w-full h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={benchmarkBars}
                margin={{ top: 10, right: 12, left: -14, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255, 255, 255, 0.06)"
                  vertical={false}
                />
                <XAxis
                  dataKey="name"
                  stroke="#64748b"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: 'rgba(255, 255, 255, 0.08)' }}
                />
                <YAxis
                  stroke="#64748b"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<CustomPowerTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="sessionPoints" radius={[8, 8, 0, 0]} maxBarSize={48}>
                  {benchmarkBars.map((entry, idx) => (
                    <Cell
                      key={`cell-${idx}`}
                      fill={
                        entry.isCurrent
                          ? '#FF6B00'
                          : entry.isGlobalAvg
                          ? '#38bdf8'
                          : 'rgba(148, 163, 184, 0.35)'
                      }
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Bottom Summary Strip */}
          <div className="grid grid-cols-3 gap-3 pt-3 border-t border-white/10 text-xs">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-orange-400 shrink-0" />
              <div>
                <div className="text-[11px] text-slate-400">Hardware Tier</div>
                <div className="font-mono-tabular font-semibold text-white">
                  Tier {user.nodeLevel} ({currentTier.multiplier}x)
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-sky-400 shrink-0" />
              <div>
                <div className="text-[11px] text-slate-400">Global Avg Tier</div>
                <div className="font-mono-tabular font-semibold text-white">
                  {globalAvgMultiplier}x Multiplier
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400 shrink-0" />
              <div>
                <div className="text-[11px] text-slate-400">Boost Potential</div>
                <div className="font-mono-tabular font-semibold text-orange-400">
                  {(currentTier.multiplier * 2).toFixed(1)}x w/ Nami Boost
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
