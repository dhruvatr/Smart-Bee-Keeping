import React, { useState } from 'react';
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

export const TrendsPage: React.FC = () => {
  const [range, setRange] = useState<'24h' | '7d' | '30d'>('7d');

  // Scatter correlation data synthesized with realistic regression
  const scatterWeightVpd = Array.from({ length: 40 }).map((_, i) => {
    const vpd = 0.6 + (i * 0.04) + (Math.random() * 0.1);
    // Negative correlation: higher VPD -> faster night dewatering loss
    const slope = -0.015 - (vpd * 0.02) + ((Math.random() - 0.5) * 0.008);
    return { x: Number(vpd.toFixed(2)), y: Number(slope.toFixed(3)) };
  });

  const scatterFreqTemp = Array.from({ length: 40 }).map((_, i) => {
    const temp = 33.5 + (i * 0.05) + (Math.random() * 0.1);
    // Slight upward pitch as temp rises
    const freq = 185 + (temp - 33.5) * 8 + ((Math.random() - 0.5) * 4);
    return { x: Number(temp.toFixed(1)), y: Number(freq.toFixed(1)) };
  });

  // 30-day calendar gain heatmap mock data
  const heatmapDays = Array.from({ length: 30 }).map((_, i) => {
    const gain = (Math.sin(i / 4.0) * 0.45) + 0.35 + (Math.random() * 0.1);
    return { day: i + 1, gain: Number(gain.toFixed(2)) };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Long-Term Biometric Trends & Correlation Matrix</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Cross-channel regression analytics · Statistical regression coefficients · Seasonal gain heatmap
          </p>
        </div>

        {/* Range Buttons & CSV Export */}
        <div className="flex items-center gap-2">
          <div className="bg-charcoal-800 p-1 rounded-xl border border-charcoal-border flex items-center gap-1 text-xs">
            {(['24h', '7d', '30d'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-colors ${
                  range === r ? 'bg-charcoal-700 text-honey font-bold shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                {r.toUpperCase()}
              </button>
            ))}
          </div>

          <a
            href="/api/export.csv"
            download="hive_telemetry.csv"
            className="px-3 py-2 rounded-xl bg-charcoal-800 hover:bg-charcoal-700 border border-charcoal-border text-xs text-slate-200 font-medium flex items-center gap-1.5 transition-colors"
          >
            <svg className="w-4 h-4 text-honey" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Export CSV
          </a>
        </div>
      </div>

      {/* 30-Day Gain Calendar Heatmap */}
      <div className="bg-charcoal-800 rounded-card p-5 border border-charcoal-border shadow-md space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-white tracking-tight">30-Day Colony Net Daily Mass Gain Heatmap (kg/day)</h3>
          <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
            <span>&lt;0 kg (Loss)</span>
            <span className="w-3 h-3 rounded bg-rose-500/40 inline-block"></span>
            <span className="w-3 h-3 rounded bg-charcoal-700 inline-block"></span>
            <span className="w-3 h-3 rounded bg-emerald-500/40 inline-block"></span>
            <span className="w-3 h-3 rounded bg-emerald-500 inline-block"></span>
            <span>&gt;+0.8 kg (Major Gain)</span>
          </div>
        </div>

        <div className="grid grid-cols-6 sm:grid-cols-10 md:grid-cols-15 gap-2 pt-2">
          {heatmapDays.map((d) => {
            const isLoss = d.gain < 0;
            const isHigh = d.gain > 0.6;
            const bg = isLoss
              ? 'bg-rose-500/30 text-rose-300 border-rose-500/40'
              : isHigh
              ? 'bg-emerald-500/40 text-emerald-200 border-emerald-500/60 font-bold'
              : 'bg-emerald-950/40 text-emerald-400 border-emerald-500/20';
            return (
              <div
                key={d.day}
                className={`p-2 rounded-lg border text-center transition-transform hover:scale-105 ${bg}`}
                title={`Day ${d.day}: ${d.gain > 0 ? '+' : ''}${d.gain} kg`}
              >
                <div className="text-[10px] opacity-70">D{d.day}</div>
                <div className="text-xs font-mono font-semibold mt-0.5">{d.gain > 0 ? '+' : ''}{d.gain}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cross-Channel Correlation Scatter Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Scatter 1: Night Weight Loss vs VPD */}
        <div className="bg-charcoal-800 rounded-card p-5 border border-charcoal-border shadow-md space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">Night Dewatering Rate vs In-Hive VPD</h3>
              <p className="text-xs text-slate-400">Shows moisture loss acceleration under high Vapor Pressure Deficit</p>
            </div>
            <div className="text-right">
              <span className="text-xs font-mono font-bold text-honey">r² = 0.84</span>
              <div className="text-[10px] text-slate-500">Strong Negative Slope</div>
            </div>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: -10 }}>
                <CartesianGrid stroke="#1C222B" />
                <XAxis dataKey="x" name="VPD" unit=" kPa" stroke="#475569" tick={{ fontSize: 10 }} />
                <YAxis dataKey="y" name="Rate" unit=" kg/h" stroke="#475569" tick={{ fontSize: 10 }} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                <Scatter name="Observations" data={scatterWeightVpd} fill="#38BDF8" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Scatter 2: Frequency vs In-Hive Temperature */}
        <div className="bg-charcoal-800 rounded-card p-5 border border-charcoal-border shadow-md space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">Dominant Frequency vs In-Hive Temperature</h3>
              <p className="text-xs text-slate-400">Thermal regulation acoustic wingbeat resonance relationship</p>
            </div>
            <div className="text-right">
              <span className="text-xs font-mono font-bold text-emerald-400">r² = 0.76</span>
              <div className="text-[10px] text-slate-500">Positive Regression</div>
            </div>
          </div>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 10, right: 10, bottom: 10, left: -10 }}>
                <CartesianGrid stroke="#1C222B" />
                <XAxis dataKey="x" name="Temp" unit=" °C" stroke="#475569" tick={{ fontSize: 10 }} />
                <YAxis dataKey="y" name="Pitch" unit=" Hz" stroke="#475569" tick={{ fontSize: 10 }} />
                <Tooltip cursor={{ strokeDasharray: '3 3' }} />
                <Scatter name="Observations" data={scatterFreqTemp} fill="#F2B705" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
