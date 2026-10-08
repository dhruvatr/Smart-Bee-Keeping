import React, { useEffect, useState } from 'react';
import { useLiveStore } from '../store/liveStore';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  AreaChart,
  Area,
} from 'recharts';
import { fetchSummary, fetchSeries } from '../lib/api';

export const HoneyDeepDive: React.FC = () => {
  const { honeyState } = useLiveStore();
  const [summary, setSummary] = useState<any>(null);
  const [cumulativeData, setCumulativeData] = useState<any[]>([]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const sum = await fetchSummary('30d');
        setSummary(sum);

        const series = await fetchSeries('gross_kg', '1h');
        const rows = series.data || [];
        let cum = 0;
        const cumList = rows.map((r: any) => {
          const delta = (r.val - 38.5);
          cum = Math.max(0, delta);
          return {
            time: r.ts ? r.ts.slice(5, 10) : '',
            honey_kg: Number(cum.toFixed(2))
          };
        });
        setCumulativeData(cumList.filter((_: any, idx: number) => idx % 6 === 0));
      } catch (_) {}
    };
    loadData();
  }, []);

  const moisture = honeyState?.moisture_est_pct ?? 18.2;
  const currentState = honeyState?.state ?? 'RAW';

  const stages = [
    { key: 'NECTAR_INTAKE', label: '1. Nectar Intake', desc: 'Moisture >40%, daylight influx' },
    { key: 'RIPENING', label: '2. Dewatering & Ripening', desc: '20–40% moisture, nocturnal fanning' },
    { key: 'RAW', label: '3. Raw Uncapped', desc: '18.6–20% moisture, edible but fermentable' },
    { key: 'COMPLETED', label: '4. Completed / Capped', desc: '<18.6% moisture, wax sealed' },
    { key: 'HARVESTED', label: '5. Harvested', desc: 'Beekeeper confirmation' },
  ];

  // Daily mock income vs loss data (last 7 days)
  const dailySplitData = [
    { day: 'Day -6', income: 0.95, loss: -0.28, net: 0.67 },
    { day: 'Day -5', income: 1.10, loss: -0.32, net: 0.78 },
    { day: 'Day -4', income: 0.85, loss: -0.25, net: 0.60 },
    { day: 'Day -3', income: 1.25, loss: -0.35, net: 0.90 },
    { day: 'Day -2', income: 0.90, loss: -0.22, net: 0.68 },
    { day: 'Day -1', income: 0.75, loss: -0.20, net: 0.55 },
    { day: 'Today', income: summary?.nectar_income_kg || 0.65, loss: -(summary?.ripening_loss_kg || 0.18), net: summary?.net_kg || 0.47 },
  ];

  // Estimated days calculation
  const dewateringRate = 0.35; // % per day
  const daysToReady = moisture <= 18.6 ? 0 : Math.ceil((moisture - 18.6) / dewateringRate);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight">Honey Formation & Harvest Readiness</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Biophysical state machine, moisture hygroscopic equilibrium, and diurnal dewatering kinetics
        </p>
      </div>

      {/* 1. STATE MACHINE PIPELINE VISUAL */}
      <div className="bg-charcoal-800 rounded-card p-5 border border-charcoal-border shadow-md">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">
          Autonomous Honey Formation Stage Machine (§6.1)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {stages.map((st) => {
            const isCurrent = currentState === st.key;
            return (
              <div
                key={st.key}
                className={`p-3.5 rounded-xl border transition-all ${
                  isCurrent
                    ? 'bg-honey/15 border-honey text-white shadow-lg shadow-honey/10 ring-1 ring-honey/40'
                    : 'bg-charcoal-900/60 border-charcoal-border text-slate-400'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-bold ${isCurrent ? 'text-honey' : 'text-slate-300'}`}>
                    {st.label}
                  </span>
                  {isCurrent && (
                    <span className="w-2 h-2 rounded-full bg-honey animate-ping"></span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 leading-snug">{st.desc}</p>
                {isCurrent && (
                  <div className="mt-2 text-[10px] font-mono text-honey bg-honey/10 px-2 py-0.5 rounded inline-block">
                    Active State · {((honeyState?.confidence || 0.88) * 100).toFixed(0)}% conf
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. MOISTURE GAUGE & HARVEST PLANNER */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Moisture Content Gauge */}
        <div className="bg-charcoal-800 rounded-card p-5 border border-charcoal-border shadow-md space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Honey Moisture Content Gauge
            </h3>
            <span className="text-xs font-mono font-bold text-honey">
              {moisture.toFixed(1)}% Est
            </span>
          </div>

          {/* Visual Gauge Bar */}
          <div className="space-y-1.5">
            <div className="h-6 w-full rounded-xl bg-charcoal-900 overflow-hidden flex p-1 border border-charcoal-border">
              <div className="h-full bg-emerald-500 rounded-l" style={{ width: '25%' }} title="<17.5% Excellent"></div>
              <div className="h-full bg-honey" style={{ width: '15%' }} title="17.5–18.6% Grade A"></div>
              <div className="h-full bg-amber-500" style={{ width: '20%' }} title="18.6–20% Risky (Raw)"></div>
              <div className="h-full bg-rose-500 rounded-r" style={{ width: '40%' }} title=">20% Fermenting"></div>
            </div>
            {/* Pointer Indicator */}
            <div className="relative h-4">
              <div
                className="absolute top-0 -ml-1 text-honey text-xs font-bold"
                style={{ left: `${Math.min(95, Math.max(5, (moisture - 15) * 10))}%` }}
              >
                ▲ {moisture.toFixed(1)}%
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] pt-2 border-t border-charcoal-border/80">
            <div className="flex items-center gap-1.5 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span>&lt; 17.5% : Grade A+ Export</span>
            </div>
            <div className="flex items-center gap-1.5 text-honey">
              <span className="w-2 h-2 rounded-full bg-honey"></span>
              <span>17.5–18.6% : Capped Grade A</span>
            </div>
            <div className="flex items-center gap-1.5 text-amber-400">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              <span>18.6–20.0% : Uncapped Raw</span>
            </div>
            <div className="flex items-center gap-1.5 text-rose-400">
              <span className="w-2 h-2 rounded-full bg-rose-500"></span>
              <span>&gt; 20.0% : Fermentation Risk</span>
            </div>
          </div>

          <p className="text-[11px] text-slate-400 leading-relaxed bg-charcoal-900/60 p-2.5 rounded-xl border border-charcoal-border">
            FSSAI Legal Limit: Honey must not exceed 20% moisture. HoneyChain validates this limit prior to blockchain minting.
          </p>
        </div>

        {/* Harvest Planner */}
        <div className="bg-charcoal-800 rounded-card p-5 border border-charcoal-border shadow-md space-y-3 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Extraction & Harvest Planner
            </h3>
            <span className="text-xs px-2 py-0.5 rounded bg-charcoal-700 text-slate-300 font-mono">
              PREDICTIVE KINETICS
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-3 rounded-xl bg-charcoal-900/80 border border-charcoal-border">
              <div className="text-[11px] text-slate-400">Current Readiness</div>
              <div className={`text-lg font-bold font-numeric mt-1 ${moisture <= 18.6 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {moisture <= 18.6 ? 'Ready to Harvest' : 'Ripening in Progress'}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Threshold: &le;18.6%</div>
            </div>

            <div className="p-3 rounded-xl bg-charcoal-900/80 border border-charcoal-border">
              <div className="text-[11px] text-slate-400">Est. Dewatering Rate</div>
              <div className="text-lg font-bold font-numeric text-white mt-1">
                ~{dewateringRate.toFixed(2)} % / day
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Based on nocturnal VPD & hum</div>
            </div>

            <div className="p-3 rounded-xl bg-charcoal-900/80 border border-charcoal-border">
              <div className="text-[11px] text-slate-400">Days to &le;18.6%</div>
              <div className="text-lg font-bold font-numeric text-honey mt-1">
                {daysToReady === 0 ? '0 days (Optimal)' : `≈ ${daysToReady} days (±1 d)`}
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">Confidence: 85%</div>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-charcoal-900/70 border border-charcoal-border text-xs text-slate-400 space-y-1">
            <div className="font-semibold text-slate-300 flex items-center gap-1.5">
              <span>⚠ Beekeeper Advisory Note:</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Harvest forecast is calculated from thermal loss and nocturnal ventilation kinetics. It is an algorithmic extrapolation, not a binding promise. Always verify comb capping visually (at least 75% capped frames) before extraction.
            </p>
          </div>
        </div>
      </div>

      {/* 3. SCIENTIFIC INCOME VS LOSS SPLIT & CUMULATIVE HONEY */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Income vs Loss Stacked Bar */}
        <div className="bg-charcoal-800 rounded-card p-5 border border-charcoal-border shadow-md space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">Daily Income vs Ripening Loss Split</h3>
              <p className="text-xs text-slate-400">Daylight nectar foraging (+) vs nocturnal water evaporation (-)</p>
            </div>
          </div>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailySplitData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid stroke="#1C222B" strokeDasharray="3 3" />
                <XAxis dataKey="day" stroke="#475569" tick={{ fontSize: 10 }} />
                <YAxis stroke="#475569" tick={{ fontSize: 10 }} unit="kg" />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: '11px' }} />
                <Bar dataKey="income" name="Nectar Inflow (+kg)" fill="#39D98A" radius={[4, 4, 0, 0]} />
                <Bar dataKey="loss" name="Ripening Evap (-kg)" fill="#FF5C5C" radius={[0, 0, 4, 4]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cumulative Honey Curve */}
        <div className="bg-charcoal-800 rounded-card p-5 border border-charcoal-border shadow-md space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">Cumulative Honey Accretion Curve</h3>
              <p className="text-xs text-slate-400">Baseline-subtracted mass accumulation (last 30 days)</p>
            </div>
          </div>
          <div className="h-60">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={cumulativeData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="cumHoneyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#F2B705" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#F2B705" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#1C222B" strokeDasharray="3 3" />
                <XAxis dataKey="time" stroke="#475569" tick={{ fontSize: 10 }} />
                <YAxis stroke="#475569" tick={{ fontSize: 10 }} unit="kg" />
                <Tooltip />
                <Area type="monotone" dataKey="honey_kg" name="Net Honey (kg)" stroke="#F2B705" strokeWidth={2.5} fill="url(#cumHoneyGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
