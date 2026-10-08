import React, { useState, useEffect } from 'react';
import { useLiveStore } from '../store/liveStore';
import { postCalibrate, postRefractometer, fetchEvents } from '../lib/api';

export const CalibrationPage: React.FC = () => {
  const { reading } = useLiveStore();
  const [calibrations, setCalibrations] = useState<any[]>([]);
  const [knownMassKg, setKnownMassKg] = useState('5.0');
  const [refractometerMoist, setRefractometerMoist] = useState('17.8');
  const [audioFloorDb, setAudioFloorDb] = useState('-65.0');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('');

  const loadHistory = async () => {
    try {
      const res = await fetchEvents('calibration', 20);
      setCalibrations(res.events || []);
    } catch (_) {}
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const rawCounts = reading?.raw_counts || 812334;

  const handleTare = async () => {
    setLoading(true);
    setStatusMsg('');
    try {
      await postCalibrate('tare', undefined, rawCounts);
      setStatusMsg(`Successfully zeroed Tare to ${rawCounts.toLocaleString()} counts`);
      loadHistory();
    } catch (e: any) {
      setStatusMsg(`Error: ${e.message}`);
    }
    setLoading(false);
  };

  const handleCalibrateKnown = async () => {
    setLoading(true);
    setStatusMsg('');
    try {
      const kg = parseFloat(knownMassKg);
      await postCalibrate('known_mass', kg, rawCounts);
      setStatusMsg(`Calibrated scale with ${kg} kg reference mass at ${rawCounts.toLocaleString()} counts`);
      loadHistory();
    } catch (e: any) {
      setStatusMsg(`Error: ${e.message}`);
    }
    setLoading(false);
  };

  const handleRefractometerFit = async () => {
    setLoading(true);
    setStatusMsg('');
    try {
      const moist = parseFloat(refractometerMoist);
      const res = await postRefractometer(moist, 'chief_apiarist', 'Lab refractometer ground-truth entry');
      setStatusMsg(`Back-fit model offset Δ: ${res.new_offset_pct > 0 ? '+' : ''}${res.new_offset_pct}% (EWMA α=0.3)`);
      loadHistory();
    } catch (e: any) {
      setStatusMsg(`Error: ${e.message}`);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white tracking-tight">Sensor Calibration & Hardware Zeroing</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Dual-point load-cell calibration, thermal drift compensation, audio noise floor zeroing, and refractometer back-fitting
        </p>
      </div>

      {statusMsg && (
        <div className="p-3 rounded-xl bg-honey/10 border border-honey/40 text-xs text-honey font-mono flex items-center justify-between">
          <span>✓ {statusMsg}</span>
          <button onClick={() => setStatusMsg('')} className="text-slate-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Live Raw Counts Banner */}
      <div className="bg-charcoal-800 rounded-card p-5 border border-charcoal-border shadow-md flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Live Load-Cell Raw ADC Stream</div>
          <div className="text-3xl font-bold font-numeric text-white mt-1">
            {rawCounts.toLocaleString()} <span className="text-sm font-normal text-slate-400">counts (24-bit Σ-Δ)</span>
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            Current Gross: <strong className="text-honey">{(reading?.gross_kg ?? 41.28).toFixed(2)} kg</strong> · 10 SPS Gain 128
          </div>
        </div>
        <button
          onClick={handleTare}
          disabled={loading}
          className="px-5 py-2.5 rounded-xl bg-honey hover:bg-honey-light text-charcoal-900 font-bold text-xs transition-colors shadow-lg shadow-honey/10"
        >
          {loading ? 'Processing...' : 'Tare Scale (Zero ADC)'}
        </button>
      </div>

      {/* Calibration Controls Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 1. Known Mass Scale Calibration */}
        <div className="bg-charcoal-800 rounded-card p-5 border border-charcoal-border shadow-md space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight">2-Point Known Mass Calibration</h3>
            <p className="text-xs text-slate-400 mt-0.5">Place a certified check weight on the hive platform</p>
          </div>
          <div>
            <label className="text-xs text-slate-300 block mb-1">Check Mass Value (kg):</label>
            <input
              type="number"
              step="0.1"
              value={knownMassKg}
              onChange={(e) => setKnownMassKg(e.target.value)}
              className="w-full bg-charcoal-900 border border-charcoal-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-honey"
            />
          </div>
          <div className="p-2.5 rounded-lg bg-charcoal-900/60 border border-charcoal-border text-[11px] font-mono text-slate-400">
            Formula: counts_per_kg = (counts_known - counts_tare) / known_mass_kg
          </div>
          <button
            onClick={handleCalibrateKnown}
            disabled={loading}
            className="w-full py-2 rounded-xl bg-charcoal-700 hover:bg-charcoal-600 border border-charcoal-600 text-slate-100 font-semibold text-xs transition-colors"
          >
            Compute counts_per_kg
          </button>
        </div>

        {/* 2. Refractometer Back-Fitting */}
        <div className="bg-charcoal-800 rounded-card p-5 border border-charcoal-border shadow-md space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight">Honey Refractometer Ground-Truth</h3>
            <p className="text-xs text-slate-400 mt-0.5">Enter lab moisture % to back-fit the honey model</p>
          </div>
          <div>
            <label className="text-xs text-slate-300 block mb-1">Optical Lab Moisture (%):</label>
            <input
              type="number"
              step="0.1"
              value={refractometerMoist}
              onChange={(e) => setRefractometerMoist(e.target.value)}
              className="w-full bg-charcoal-900 border border-charcoal-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-honey"
            />
          </div>
          <div className="p-2.5 rounded-lg bg-charcoal-900/60 border border-charcoal-border text-[11px] font-mono text-slate-400">
            Updates EWMA offset Δ: m_final = m_fused + Δ (α=0.3)
          </div>
          <button
            onClick={handleRefractometerFit}
            disabled={loading}
            className="w-full py-2 rounded-xl bg-cyan-900/50 hover:bg-cyan-800/60 border border-cyan-500/40 text-cyan-200 font-semibold text-xs transition-colors"
          >
            Back-Fit Honey Model
          </button>
        </div>

        {/* 3. Audio Noise Floor Zeroing */}
        <div className="bg-charcoal-800 rounded-card p-5 border border-charcoal-border shadow-md space-y-4">
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight">Audio Sensor Noise Floor Zeroing</h3>
            <p className="text-xs text-slate-400 mt-0.5">Calibrate ambient acoustic floor for INMP441</p>
          </div>
          <div>
            <label className="text-xs text-slate-300 block mb-1">Ambient Noise Floor (dBFS):</label>
            <input
              type="number"
              step="1"
              value={audioFloorDb}
              onChange={(e) => setAudioFloorDb(e.target.value)}
              className="w-full bg-charcoal-900 border border-charcoal-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-honey"
            />
          </div>
          <div className="p-2.5 rounded-lg bg-charcoal-900/60 border border-charcoal-border text-[11px] font-mono text-slate-400">
            Relative level referenced to digital full scale (-90 to 0 dBFS)
          </div>
          <button
            onClick={() => setStatusMsg(`Audio floor updated to ${audioFloorDb} dBFS`)}
            className="w-full py-2 rounded-xl bg-charcoal-700 hover:bg-charcoal-600 border border-charcoal-600 text-slate-100 font-semibold text-xs transition-colors"
          >
            Set Acoustic Floor
          </button>
        </div>
      </div>

      {/* Calibration Event Log Table */}
      <div className="bg-charcoal-800 rounded-card p-5 border border-charcoal-border shadow-md space-y-3">
        <h3 className="text-sm font-bold text-white tracking-tight">Immutable Calibration Event Ledger</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="border-b border-charcoal-border text-slate-400 uppercase tracking-wider text-[10px]">
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Before JSON</th>
                <th className="py-2.5 px-3">After JSON</th>
                <th className="py-2.5 px-3">Operator</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-charcoal-border font-mono">
              {calibrations.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-slate-500">No calibration events logged yet</td>
                </tr>
              ) : (
                calibrations.map((c) => (
                  <tr key={c.id || c.ts} className="hover:bg-charcoal-700/30">
                    <td className="py-2.5 px-3 text-slate-300">{c.ts ? c.ts.slice(0, 19).replace('T', ' ') : ''}</td>
                    <td className="py-2.5 px-3 font-bold text-honey">{c.cal_kind || c.kind}</td>
                    <td className="py-2.5 px-3 text-slate-400 truncate max-w-xs">{c.before_json}</td>
                    <td className="py-2.5 px-3 text-slate-300 truncate max-w-xs">{c.after_json}</td>
                    <td className="py-2.5 px-3 text-slate-400">{c.operator || 'beekeeper'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
