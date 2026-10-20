import React, { useState } from 'react';
import { NAMI_LOGO_PATH, formatClockTimer } from '../types/nami.ts';

interface NamiLogoMarkProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

export const NamiLogoMark: React.FC<NamiLogoMarkProps> = ({ size = 'md', className = '' }) => {
  const [imgFailed, setImgFailed] = useState(false);

  const dims = {
    sm: 'w-8 h-8 rounded-lg',
    md: 'w-10 h-10 rounded-xl',
    lg: 'w-14 h-14 rounded-2xl',
    xl: 'w-20 h-20 rounded-2xl',
  }[size];

  return (
    <div
      className={`relative overflow-hidden bg-[#12100b] border border-orange-500/40 shadow-[0_0_20px_rgba(255,107,0,0.28)] flex items-center justify-center shrink-0 ${dims} ${className}`}
    >
      {!imgFailed ? (
        <img
          src={NAMI_LOGO_PATH}
          alt="NAMI WALLET Official Isometric Logo"
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <svg viewBox="0 0 64 64" className="w-3/4 h-3/4 text-orange-400" fill="none">
          <path
            d="M16 24L36 12C40 10 44 13 44 17C44 21 40 24 36 26L16 38C12 40 8 37 8 33C8 29 12 26 16 24Z"
            stroke="currentColor"
            strokeWidth="3"
          />
          <path
            d="M24 34L48 20C52 18 56 21 56 25C56 29 52 32 48 34L24 48C20 50 16 47 16 43C16 39 20 36 24 34Z"
            stroke="currentColor"
            strokeWidth="3"
          />
          <path
            d="M16 46L38 34C42 32 46 35 46 39C46 43 42 46 38 48L16 60C12 62 8 59 8 55C8 51 12 48 16 46Z"
            stroke="currentColor"
            strokeWidth="3"
          />
        </svg>
      )}
    </div>
  );
};

interface NodeReactor3DProps {
  status: 'Active' | 'Inactive' | 'Completed' | 'Cooldown';
  progressPercent: number;
  remainingSeconds: number;
  nodeLevel: number;
  tierName: string;
  multiplier: number;
}

export const NodeReactor3D: React.FC<NodeReactor3DProps> = ({
  status,
  progressPercent,
  remainingSeconds,
  nodeLevel,
  tierName,
  multiplier,
}) => {
  const isRunning = status === 'Active';
  const isCompleted = status === 'Completed';
  const isCooldown = status === 'Cooldown';

  const radius = 92;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, progressPercent)) / 100) * circumference;

  return (
    <div className="relative flex flex-col items-center justify-center py-6 select-none">
      {/* Ambient 3D Perspective Glow */}
      <div
        className={`absolute w-64 h-64 rounded-full blur-3xl pointer-events-none transition-opacity duration-500 ${
          isRunning
            ? 'bg-orange-500/25 opacity-100'
            : isCompleted
            ? 'bg-amber-400/25 opacity-95'
            : 'bg-orange-500/10 opacity-50'
        }`}
      />

      {/* Circular SVG Progress + Isometric Core */}
      <div className="relative w-60 h-60 flex items-center justify-center">
        <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 220 220">
          {/* Outer Subtle Track */}
          <circle
            cx="110"
            cy="110"
            r={radius}
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth="8"
            fill="transparent"
          />
          {/* Inner Technical Ring */}
          <circle
            cx="110"
            cy="110"
            r="76"
            stroke="rgba(255, 115, 0, 0.16)"
            strokeWidth="1.5"
            strokeDasharray="4 6"
            fill="transparent"
          />
          {/* Active Neon Progress Arc */}
          <circle
            cx="110"
            cy="110"
            r={radius}
            stroke="url(#namiOrangeGradient)"
            strokeWidth="8"
            strokeLinecap="round"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-300"
          />
          <defs>
            <linearGradient id="namiOrangeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#FF6B00" />
              <stop offset="50%" stopColor="#FF9500" />
              <stop offset="100%" stopColor="#FFD000" />
            </linearGradient>
          </defs>
        </svg>

        {/* Center 3D Isometric Core Housing */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
          <div className={`mb-2 ${isRunning ? 'animate-float-3d' : ''}`}>
            <NamiLogoMark size="lg" />
          </div>

          <div className="font-mono-tabular text-2xl font-semibold tracking-tight text-white">
            {isRunning || isCooldown ? formatClockTimer(remainingSeconds) : isCompleted ? 'READY' : 'STANDBY'}
          </div>

          <div className="mt-1 text-xs text-slate-400">
            <span>Tier {nodeLevel}</span>
            <span className="mx-1.5" aria-hidden="true">·</span>
            <span className="text-orange-400 font-mono-tabular">{multiplier}x Yield</span>
          </div>
        </div>
      </div>

      {/* Unboxed Status Metadata Line */}
      <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
        <span className="font-medium text-slate-200">{tierName}</span>
        <span aria-hidden="true">·</span>
        <span>Status: {status}</span>
        <span aria-hidden="true">·</span>
        <span className="font-mono-tabular">{Math.round(progressPercent)}% Cycle</span>
      </div>
    </div>
  );
};
