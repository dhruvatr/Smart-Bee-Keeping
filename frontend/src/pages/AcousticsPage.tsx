import React, { useState, useEffect } from 'react';
import { useLiveStore } from '../store/liveStore';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import { fetchSummary } from '../lib/api';

export const AcousticsPage: React.FC = () => {
  const { reading, derived } = useLiveStore();
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioCtx, setAudioCtx] = useState<AudioContext | null>(null);
  const [summary, setSummary] = useState<any>(null);

  useEffect(() => {
    fetchSummary('today').then(setSummary).catch(() => {});
  }, []);

  const freqDom = reading?.freq_dom_hz ?? 193.4;
  const splDb = reading?.spl_db ?? -27.8;
  const actIndex = derived?.activity_index ?? 42.0;

  // Stacked band power mock history (last 12 hours)
  const bandHistoryData = [
    { time: '04:00', rumble: 0.08, hum: 0.70, act: 0.15, pip: 0.04 },
    { time: '06:00', rumble: 0.07, hum: 0.65, act: 0.22, pip: 0.05 },
    { time: '08:00', rumble: 0.09, hum: 0.58, act: 0.28, pip: 0.04 },
    { time: '10:00', rumble: 0.08, hum: 0.55, act: 0.32, pip: 0.05 },
    { time: '12:00', rumble: 0.07, hum: 0.54, act: 0.34, pip: 0.06 },
    { time: '14:00', rumble: 0.08, hum: 0.52, act: 0.36, pip: 0.05 },
    { time: '16:00', rumble: 0.08, hum: 0.56, act: 0.31, pip: 0.04 },
    { time: '18:00', rumble: 0.09, hum: 0.60, act: 0.26, pip: 0.04 },
    { time: '20:00', rumble: 0.08, hum: 0.62, act: 0.25, pip: 0.05 },
    { time: '22:00', rumble: 0.08, hum: 0.65, act: 0.21, pip: 0.04 },
    { time: 'Now', rumble: 0.08, hum: 0.64, act: 0.22, pip: 0.04 },
  ];

  // Frequency distribution histogram (last 24 hours)
  const freqHistogram = [
    { bin: '80-120 Hz', count: 12 },
    { bin: '120-160 Hz', count: 45 },
    { bin: '160-200 Hz (Hum)', count: 285 },
    { bin: '200-240 Hz (Active)', count: 180 },
    { bin: '240-280 Hz (Fanning)', count: 95 },
    { bin: '280-350 Hz', count: 32 },
    { bin: '350-450 Hz (Agitation)', count: 8 },
    { bin: '>450 Hz (Piping)', count: 3 },
  ];

  // Web Audio API synthesizer for listening to live hive hum
  const togglePlayHum = () => {
    if (isPlaying && audioCtx) {
      audioCtx.close();
      setAudioCtx(null);
      setIsPlaying(false);
      return;
    }

    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(freqDom, ctx.currentTime);

      // Harmonic 2x
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(freqDom * 2, ctx.currentTime);

      gain.gain.setValueAtTime(0.08, ctx.currentTime);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ctx.destination);

      osc1.start();
      osc2.start();

      setAudioCtx(ctx);
      setIsPlaying(true);
    } catch (_) {}
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Colony Acoustic & Bio-Vibrational Analysis</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Wingbeat audio processing, spectral band power division, and queen piping disturbance tracking
          </p>
        </div>

        {/* Live Audio Synthesizer Button */}
        <button
          onClick={togglePlayHum}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 shadow-lg ${
            isPlaying
              ? 'bg-critical text-white glow-critical animate-pulse'
              : 'bg-honey text-charcoal-900 hover:bg-honey-light'
          }`}
        >
          <span>{isPlaying ? '⏹ Stop Audio Synthesizer' : '▶ Synthesize Live Colony Hum'}</span>
          <span className="font-mono text-[11px] opacity-80">({freqDom.toFixed(1)} Hz)</span>
        </button>
      </div>

      {/* Top Counters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-charcoal-800 rounded-card p-4 border border-charcoal-border">
          <div className="text-xs text-slate-400 font-medium uppercase">Dominant Frequency</div>
          <div className="text-2xl font-bold font-numeric text-white mt-1">{freqDom.toFixed(1)} Hz</div>
          <div className="text-[11px] text-indigo-400 mt-0.5">Normal Hive Hum (150–250 Hz)</div>
        </div>

        <div className="bg-charcoal-800 rounded-card p-4 border border-charcoal-border">
          <div className="text-xs text-slate-400 font-medium uppercase">Relative Sound Level</div>
          <div className="text-2xl font-bold font-numeric text-white mt-1">{splDb.toFixed(1)} dBFS</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Uncalibrated relative acoustic level</div>
        </div>

        <div className="bg-charcoal-800 rounded-card p-4 border border-charcoal-border">
          <div className="text-xs text-slate-400 font-medium uppercase">Fanning Work Hours</div>
          <div className="text-2xl font-bold font-numeric text-emerald-400 mt-1">
            {summary?.fanning_hours ?? 4.2} hrs
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Active ventilation signature today</div>
        </div>

        <div className="bg-charcoal-800 rounded-card p-4 border border-charcoal-border">
          <div className="text-xs text-slate-400 font-medium uppercase">Activity Index</div>
          <div className="text-2xl font-bold font-numeric text-honey mt-1">{actIndex.toFixed(0)} / 100</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Rolling p5–p95 normalized</div>
        </div>
      </div>

      {/* Spectral Band Power Over Time */}
      <div className="bg-charcoal-800 rounded-card p-5 border border-charcoal-border shadow-md space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight">Spectral Energy Distribution by Behavioral Band</h3>
            <p className="text-xs text-slate-400">Rumble (20–100Hz), Normal Hum (150–250Hz), Fanning (250–400Hz), Agitation Piping (400–600Hz)</p>
          </div>
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={bandHistoryData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid stroke="#1C222B" strokeDasharray="3 3" />
              <XAxis dataKey="time" stroke="#475569" tick={{ fontSize: 10 }} />
              <YAxis stroke="#475569" tick={{ fontSize: 10 }} domain={[0, 1.0]} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: '11px' }} />
              <Area type="monotone" dataKey="rumble" stackId="1" name="Rumble (20–100Hz)" stroke="#64748B" fill="#475569" />
              <Area type="monotone" dataKey="hum" stackId="1" name="Calm Hum (150–250Hz)" stroke="#F2B705" fill="#F2B705" />
              <Area type="monotone" dataKey="act" stackId="1" name="Active Fanning (250–400Hz)" stroke="#39D98A" fill="#39D98A" />
              <Area type="monotone" dataKey="pip" stackId="1" name="Piping / Alarm (400–600Hz)" stroke="#FF5C5C" fill="#FF5C5C" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Dominant Frequency Distribution Histogram */}
      <div className="bg-charcoal-800 rounded-card p-5 border border-charcoal-border shadow-md space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight">Dominant Frequency Peak Histogram (Last 24 Hours)</h3>
            <p className="text-xs text-slate-400">Colony spectral resonance distribution showing calm hum stability</p>
          </div>
        </div>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={freqHistogram} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid stroke="#1C222B" strokeDasharray="3 3" />
              <XAxis dataKey="bin" stroke="#475569" tick={{ fontSize: 10 }} />
              <YAxis stroke="#475569" tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="count" name="Recorded Frames" fill="#818CF8" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};
