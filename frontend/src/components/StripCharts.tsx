import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

interface StripChartsProps {
  data: Array<{
    ts: string;
    gross_kg: number;
    freq_dom_hz: number;
    t_in_c: number;
    rh_in_pct: number;
  }>;
}

export const StripCharts: React.FC<StripChartsProps> = ({ data }) => {
  const chartData = data.map((d) => ({
    time: d.ts ? d.ts.slice(11, 19) : '',
    weight: d.gross_kg,
    freq: d.freq_dom_hz,
    temp: d.t_in_c,
    humidity: d.rh_in_pct,
  }));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-charcoal-900 border border-charcoal-600 p-2.5 rounded-lg shadow-xl text-xs font-mono">
          <div className="text-slate-400 mb-1">{label}</div>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-3" style={{ color: entry.color }}>
              <span>{entry.name}:</span>
              <span className="font-bold">{entry.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-charcoal-800 rounded-card p-5 border border-charcoal-border shadow-md space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-honey animate-pulse"></span>
            Live Telemetry Strip Charts (Rolling 60 min)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Synchronized sensor streams with diurnal daylight reference
          </p>
        </div>
        <span className="text-xs font-mono text-slate-400 px-2 py-1 rounded bg-charcoal-700 border border-charcoal-600">
          {data.length} frames logged
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Weight Strip */}
        <div className="bg-charcoal-900/60 p-3.5 rounded-xl border border-charcoal-border">
          <div className="flex items-center justify-between mb-2 text-xs">
            <span className="font-semibold text-slate-300">Hive Gross Weight</span>
            <span className="font-mono text-honey">kg</span>
          </div>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} syncId="hive-strip">
                <CartesianGrid stroke="#1C222B" strokeDasharray="3 3" />
                <XAxis dataKey="time" stroke="#475569" tick={{ fontSize: 10 }} />
                <YAxis domain={['auto', 'auto']} stroke="#475569" tick={{ fontSize: 10 }} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="weight" name="Gross (kg)" stroke="#F2B705" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Acoustic Frequency Strip */}
        <div className="bg-charcoal-900/60 p-3.5 rounded-xl border border-charcoal-border">
          <div className="flex items-center justify-between mb-2 text-xs">
            <span className="font-semibold text-slate-300">Dominant Acoustic Frequency</span>
            <span className="font-mono text-indigo-400">Hz</span>
          </div>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} syncId="hive-strip">
                <CartesianGrid stroke="#1C222B" strokeDasharray="3 3" />
                <XAxis dataKey="time" stroke="#475569" tick={{ fontSize: 10 }} />
                <YAxis domain={['auto', 'auto']} stroke="#475569" tick={{ fontSize: 10 }} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="freq" name="Freq (Hz)" stroke="#818CF8" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Temperature Strip */}
        <div className="bg-charcoal-900/60 p-3.5 rounded-xl border border-charcoal-border">
          <div className="flex items-center justify-between mb-2 text-xs">
            <span className="font-semibold text-slate-300">In-Hive Temperature</span>
            <span className="font-mono text-emerald-400">°C</span>
          </div>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} syncId="hive-strip">
                <CartesianGrid stroke="#1C222B" strokeDasharray="3 3" />
                <XAxis dataKey="time" stroke="#475569" tick={{ fontSize: 10 }} />
                <YAxis domain={['auto', 'auto']} stroke="#475569" tick={{ fontSize: 10 }} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="temp" name="T_in (°C)" stroke="#39D98A" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Humidity Strip */}
        <div className="bg-charcoal-900/60 p-3.5 rounded-xl border border-charcoal-border">
          <div className="flex items-center justify-between mb-2 text-xs">
            <span className="font-semibold text-slate-300">In-Hive Relative Humidity</span>
            <span className="font-mono text-cyan-400">%RH</span>
          </div>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} syncId="hive-strip">
                <CartesianGrid stroke="#1C222B" strokeDasharray="3 3" />
                <XAxis dataKey="time" stroke="#475569" tick={{ fontSize: 10 }} />
                <YAxis domain={['auto', 'auto']} stroke="#475569" tick={{ fontSize: 10 }} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="humidity" name="RH_in (%)" stroke="#38BDF8" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
