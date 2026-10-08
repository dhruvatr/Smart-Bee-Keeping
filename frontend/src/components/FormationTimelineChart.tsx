import React, { useEffect, useState } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine
} from 'recharts';
import { fetchSeries } from '../lib/api';

export const FormationTimelineChart: React.FC = () => {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load72h = async () => {
      try {
        const res = await fetchSeries('gross_kg', '1h');
        const rows = res.data || [];
        // Synthesize twin-Y series with moisture and fanning markers
        const formatted = rows.map((r: any) => {
          const t = new Date(r.ts);
          const hr = t.getHours();
          const isNight = hr < 6 || hr >= 19;
          const gross = r.val || 40.0;
          // Invert/correlate moisture with dewatering
          const estMoisture = Math.max(16.5, Math.min(24.0, 24.0 - ((gross - 38.5) * 1.8) + (isNight ? -0.2 : 0.1)));

          return {
            time: r.ts ? r.ts.slice(5, 16).replace('T', ' ') : '',
            weight: Number(gross.toFixed(2)),
            moisture: Number(estMoisture.toFixed(1)),
            fanning: (r.band_act_mean >= 0.35 || isNight) ? 1.5 : 0,
            isNight,
          };
        });
        setData(formatted);
      } catch (_) {}
      setLoading(false);
    };

    load72h();
  }, []);

  const CustomTimelineTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-charcoal-900 border border-charcoal-600 p-3 rounded-xl shadow-xl text-xs font-mono">
          <div className="text-slate-400 font-semibold mb-2">{label}</div>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4 py-0.5" style={{ color: entry.color }}>
              <span>{entry.name}:</span>
              <span className="font-bold">{entry.value}</span>
            </div>
          ))}
          <div className="mt-2 pt-2 border-t border-charcoal-700 text-[11px] text-slate-400 font-sans">
            Threshold: &le;18.6% = Capped Grade A Honey
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-charcoal-800 rounded-card p-5 border border-charcoal-border shadow-md space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-honey animate-pulse"></span>
            Honey Formation Timeline (72-Hour Dewatering & Capping Profile)
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Correlating nocturnal fanning dewatering with mass balance and the 18.6% moisture capping threshold
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono">
          <span className="flex items-center gap-1.5 text-honey">
            <span className="w-3 h-0.5 bg-honey inline-block"></span>
            Weight (kg)
          </span>
          <span className="flex items-center gap-1.5 text-cyan-400">
            <span className="w-3 h-0.5 bg-cyan-400 inline-block"></span>
            Moisture Est (%)
          </span>
          <span className="flex items-center gap-1.5 text-emerald-400">
            <span className="w-2.5 h-2 bg-emerald-500/40 inline-block rounded-sm"></span>
            Fanning Peak
          </span>
          <span className="flex items-center gap-1.5 text-amber-400">
            <span className="w-3 border-t border-dashed border-amber-400 inline-block"></span>
            18.6% Capped Line
          </span>
        </div>
      </div>

      <div className="h-64 w-full bg-charcoal-900/50 p-2 rounded-xl border border-charcoal-border">
        {loading ? (
          <div className="h-full flex items-center justify-center text-xs text-slate-500">
            Loading 72-hour timeline history...
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="#1C222B" strokeDasharray="3 3" />
              <XAxis dataKey="time" stroke="#475569" tick={{ fontSize: 10 }} />
              <YAxis
                yAxisId="weight"
                stroke="#F2B705"
                domain={['auto', 'auto']}
                tick={{ fontSize: 10 }}
                unit="kg"
              />
              <YAxis
                yAxisId="moisture"
                orientation="right"
                stroke="#38BDF8"
                domain={[15, 26]}
                tick={{ fontSize: 10 }}
                unit="%"
              />
              <Tooltip content={<CustomTimelineTooltip />} />
              <ReferenceLine yAxisId="moisture" y={18.6} stroke="#F2B705" strokeDasharray="4 4" strokeWidth={2} label={{ value: "18.6% Ready", fill: "#F2B705", fontSize: 10, position: 'right' }} />
              
              {/* Active Fanning events bar overlay */}
              <Bar yAxisId="moisture" dataKey="fanning" fill="rgba(57, 217, 138, 0.25)" name="Fanning Event" isAnimationActive={false} />
              {/* Weight Curve */}
              <Line yAxisId="weight" type="monotone" dataKey="weight" name="Hive Weight (kg)" stroke="#F2B705" strokeWidth={2.5} dot={false} isAnimationActive={false} />
              {/* Moisture Curve */}
              <Line yAxisId="moisture" type="monotone" dataKey="moisture" name="Moisture Est (%)" stroke="#38BDF8" strokeWidth={2} dot={false} isAnimationActive={false} />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="p-2.5 rounded-lg bg-charcoal-900/80 border border-charcoal-border text-xs text-slate-400 flex items-center gap-2">
        <svg className="w-4 h-4 text-honey shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>
          <strong className="text-slate-200">Scientific Explainer:</strong> Capped honey stabilizes at ≈18% moisture. Fresh nectar begins at 80–95% water. Colony workers evaporate excess moisture at night via acoustic wing fanning (250–400 Hz) until the 18.6% threshold is achieved and cells are sealed with beeswax.
        </span>
      </div>
    </div>
  );
};
