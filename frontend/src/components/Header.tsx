import React, { useState, useEffect } from 'react';
import { useLiveStore } from '../store/liveStore';

export const Header: React.FC = () => {
  const { honeyState, connectionStatus, isStale, lastPacketTime, simStatus } = useLiveStore();
  const [secondsAgo, setSecondsAgo] = useState<number>(0);

  useEffect(() => {
    const timer = setInterval(() => {
      if (lastPacketTime) {
        setSecondsAgo(Math.floor((Date.now() - lastPacketTime.getTime()) / 1000));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [lastPacketTime]);

  const now = new Date();
  const hour = now.getHours();
  const isDaylight = hour >= 6 && hour < 19;

  const stateColors: Record<string, string> = {
    NECTAR_INTAKE: 'bg-blue-900/60 text-blue-300 border-blue-500/40',
    RIPENING: 'bg-amber-900/60 text-amber-300 border-amber-500/40',
    RAW: 'bg-yellow-900/60 text-yellow-300 border-yellow-500/40',
    COMPLETED: 'bg-emerald-900/60 text-emerald-300 border-emerald-500/40',
    HARVESTED: 'bg-purple-900/60 text-purple-300 border-purple-500/40',
  };

  const currState = honeyState?.state || 'RAW';
  const confidence = honeyState?.confidence ?? 0.85;
  const isEstimated = honeyState?.is_estimated || confidence < 0.6;

  return (
    <header className="bg-charcoal-800 border-b border-charcoal-border px-6 py-4 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-40">
      {/* Left: Hive Meta & Status */}
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-honey/10 border border-honey/30 flex items-center justify-center text-honey text-xl font-bold shadow-inner">
          <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
            <path d="M12 2L4 7v10l8 5 8-5V7l-8-5zm0 2.2l6 3.75v7.1L12 18.8 6 15.05v-7.1l6-3.75z" />
          </svg>
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold tracking-tight text-white">Smart-Bee-Keeping</h1>
            <span className="text-xs px-2 py-0.5 rounded bg-charcoal-700 text-slate-300 border border-charcoal-600 font-mono">
              HIVE-01
            </span>
          </div>
          <p className="text-xs text-slate-400 flex items-center gap-1.5 mt-0.5">
            <svg className="w-3.5 h-3.5 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Bengaluru Rural, Karnataka, India · Asia/Kolkata
          </p>
        </div>

        {/* Big Honey Formation Status Chip */}
        <div className={`ml-3 px-3.5 py-1.5 rounded-full border text-xs font-semibold flex items-center gap-2 transition-all ${stateColors[currState] || 'bg-charcoal-700 text-slate-300 border-charcoal-600'}`}>
          <span className="w-2 h-2 rounded-full bg-current animate-pulse"></span>
          <span>{currState.replace('_', ' ')}</span>
          <span className="text-[11px] opacity-80 font-mono">
            {isEstimated ? '≈' : ''}{(confidence * 100).toFixed(0)}% conf
          </span>
        </div>
      </div>

      {/* Right: Telemetry Health, Time, Simulator, Stale Warning */}
      <div className="flex items-center gap-4 text-xs">
        {/* Stale Warning Indicator */}
        {isStale && (
          <div className="px-2.5 py-1 rounded bg-amber-950/80 border border-amber-600 text-amber-300 flex items-center gap-1.5 animate-pulse">
            <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>STALE TELEMETRY (&gt;10s)</span>
          </div>
        )}

        {/* Connection Dot */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-charcoal-700/80 border border-charcoal-600 text-slate-300">
          <span className={`w-2.5 h-2.5 rounded-full ${
            connectionStatus === 'connected' ? 'bg-healthy glow-healthy animate-ping' :
            connectionStatus === 'connecting' ? 'bg-warning animate-pulse' : 'bg-critical'
          }`} style={{ animationIterationCount: 1 }}></span>
          <span className="capitalize font-mono">
            {connectionStatus === 'connected' ? 'WS Live' : connectionStatus}
          </span>
          <span className="text-slate-500 text-[11px]">· {secondsAgo}s ago</span>
        </div>

        {/* Diurnal Day / Night Indicator */}
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-charcoal-700/80 border border-charcoal-600 text-slate-300">
          {isDaylight ? (
            <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-indigo-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
          <span className="font-mono text-slate-200">
            {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>

        {/* Simulator Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-honey/10 border border-honey/30 text-honey font-mono font-medium">
          <span className="w-1.5 h-1.5 rounded-full bg-honey animate-pulse"></span>
          <span>SIM {simStatus.speed}x · {simStatus.scenario.replace('_', ' ')}</span>
        </div>
      </div>
    </header>
  );
};
