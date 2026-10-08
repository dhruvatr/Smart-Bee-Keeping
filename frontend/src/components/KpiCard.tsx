import React, { useState } from 'react';
import { ResponsiveContainer, AreaChart, Area } from 'recharts';

interface KpiCardProps {
  title: string;
  value: string | number;
  unit: string;
  deltaText?: string;
  deltaPositive?: boolean;
  statusBandColor?: 'honey' | 'healthy' | 'warning' | 'critical' | 'neutral';
  formulaTooltip: string;
  sparklineData?: Array<{ val: number }>;
  sparklineColor?: string;
  subValue?: string;
  tabs?: Array<{ label: string; active: boolean; onClick: () => void }>;
  secondaryChannel?: {
    label: string;
    value: string;
  };
}

export const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  unit,
  deltaText,
  deltaPositive = true,
  statusBandColor = 'honey',
  formulaTooltip,
  sparklineData = [],
  sparklineColor = '#F2B705',
  subValue,
  tabs,
  secondaryChannel
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  const bandBorder = {
    honey: 'border-l-4 border-l-honey',
    healthy: 'border-l-4 border-l-healthy',
    warning: 'border-l-4 border-l-warning',
    critical: 'border-l-4 border-l-critical',
    neutral: 'border-l-4 border-l-charcoal-border',
  }[statusBandColor];

  return (
    <div className={`bg-charcoal-800 rounded-card p-5 border border-charcoal-border shadow-md flex flex-col justify-between transition-all duration-300 hover:border-charcoal-500 relative ${bandBorder}`}>
      {/* Card Header & Tooltip */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium uppercase tracking-wider text-slate-400">
            {title}
          </span>
          <div className="relative">
            <button
              type="button"
              onMouseEnter={() => setShowTooltip(true)}
              onMouseLeave={() => setShowTooltip(false)}
              onClick={() => setShowTooltip(!showTooltip)}
              className="text-slate-500 hover:text-slate-300 transition-colors p-0.5 rounded focus:outline-none"
              aria-label="Formula information"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
            {showTooltip && (
              <div className="absolute left-0 bottom-full mb-2 z-50 w-64 p-2.5 rounded-lg bg-charcoal-900 border border-charcoal-600 shadow-xl text-[11px] text-slate-300 leading-relaxed font-sans pointer-events-none">
                <div className="font-semibold text-honey mb-1">Scientific Formula & Logic</div>
                {formulaTooltip}
              </div>
            )}
          </div>
        </div>

        {/* Optional Tabs (e.g. today / 7d / total) */}
        {tabs && (
          <div className="flex items-center gap-1 bg-charcoal-700/80 p-0.5 rounded-lg border border-charcoal-600 text-[10px]">
            {tabs.map((tab) => (
              <button
                key={tab.label}
                onClick={tab.onClick}
                className={`px-1.5 py-0.5 rounded transition-colors ${
                  tab.active ? 'bg-charcoal-900 text-honey font-bold shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main KPI Value */}
      <div className="my-1">
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold font-numeric text-white tracking-tight">
            {value}
          </span>
          <span className="text-sm font-semibold text-slate-400">
            {unit}
          </span>
        </div>

        {subValue && (
          <div className="text-xs text-slate-400 mt-1 flex items-center gap-1">
            {subValue}
          </div>
        )}
      </div>

      {/* Secondary Channel (e.g. Bee Scale) */}
      {secondaryChannel && (
        <div className="my-1.5 px-2.5 py-1 rounded-lg bg-charcoal-700/60 border border-charcoal-600 flex items-center justify-between text-xs">
          <span className="text-slate-400 text-[11px]">{secondaryChannel.label}:</span>
          <span className="font-numeric font-semibold text-honey">{secondaryChannel.value}</span>
        </div>
      )}

      {/* Footer: Delta & Sparkline */}
      <div className="mt-3 pt-2 border-t border-charcoal-border/80 flex items-center justify-between gap-3">
        {deltaText ? (
          <div className={`text-xs font-mono font-medium flex items-center gap-1 ${
            deltaPositive ? 'text-healthy' : 'text-slate-400'
          }`}>
            <span>{deltaText}</span>
          </div>
        ) : <div />}

        {/* Sparkline (60 min) */}
        {sparklineData.length > 0 && (
          <div className="w-24 h-8 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={sparklineData}>
                <defs>
                  <linearGradient id={`spark-${title}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={sparklineColor} stopOpacity={0.4} />
                    <stop offset="100%" stopColor={sparklineColor} stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  dataKey="val"
                  stroke={sparklineColor}
                  strokeWidth={1.5}
                  fill={`url(#spark-${title})`}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};
