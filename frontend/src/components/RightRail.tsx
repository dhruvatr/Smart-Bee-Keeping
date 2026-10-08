import React, { useState, useEffect } from 'react';
import { useLiveStore } from '../store/liveStore';
import {
  fetchEvents,
  postBaseline,
  postHarvest,
  postRefractometer,
  postSimControl
} from '../lib/api';

export const RightRail: React.FC = () => {
  const { alerts, dismissAlert, simStatus } = useLiveStore();
  const [events, setEvents] = useState<any[]>([]);
  const [expandedWhy, setExpandedWhy] = useState<Record<string, boolean>>({});
  const [actionModal, setActionModal] = useState<string | null>(null);

  // Modal forms state
  const [baselineInput, setBaselineInput] = useState('');
  const [harvestKg, setHarvestKg] = useState('10.5');
  const [harvestFrames, setHarvestFrames] = useState('8');
  const [harvestMoist, setHarvestMoist] = useState('17.8');
  const [refractometerMoist, setRefractometerMoist] = useState('18.2');
  const [currentScenario, setCurrentScenario] = useState('normal');

  const loadEvents = async () => {
    try {
      const res = await fetchEvents('all', 15);
      setEvents(res.events || []);
    } catch (_) {}
  };

  useEffect(() => {
    loadEvents();
    const interval = setInterval(loadEvents, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleBaselineSubmit = async () => {
    const val = baselineInput ? parseFloat(baselineInput) : undefined;
    await postBaseline(val, 'Manual baseline reset');
    setActionModal(null);
    setBaselineInput('');
    loadEvents();
  };

  const handleHarvestSubmit = async () => {
    await postHarvest(parseFloat(harvestKg), parseInt(harvestFrames), parseFloat(harvestMoist), 'Logged via dashboard');
    setActionModal(null);
    loadEvents();
  };

  const handleRefractometerSubmit = async () => {
    await postRefractometer(parseFloat(refractometerMoist), 'chief_apiarist', 'Lab refractometer reading');
    setActionModal(null);
    loadEvents();
  };

  const handleScenarioChange = async (sc: string) => {
    setCurrentScenario(sc);
    await postSimControl('scenario', sc);
  };

  const toggleSimRun = async () => {
    const action = simStatus.running ? 'stop' : 'start';
    await postSimControl(action);
  };

  return (
    <aside className="w-80 bg-charcoal-800 border-l border-charcoal-border p-4 space-y-5 shrink-0 overflow-y-auto max-h-[calc(100vh-73px)]">
      {/* 1. Quick Action Buttons */}
      <div className="space-y-2">
        <div className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase flex items-center justify-between">
          <span>Quick Actions</span>
          <span className="text-[10px] text-honey font-mono">SIM ENGINE</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <button
            onClick={() => setActionModal('baseline')}
            className="px-2.5 py-2 rounded-xl bg-charcoal-700 hover:bg-charcoal-600 border border-charcoal-600 text-slate-200 font-medium transition-colors text-left flex items-center gap-1.5"
          >
            <span className="text-honey font-bold">⌖</span> Set Baseline
          </button>
          <button
            onClick={() => setActionModal('harvest')}
            className="px-2.5 py-2 rounded-xl bg-charcoal-700 hover:bg-charcoal-600 border border-charcoal-600 text-slate-200 font-medium transition-colors text-left flex items-center gap-1.5"
          >
            <span className="text-emerald-400 font-bold">🍯</span> Log Harvest
          </button>
          <button
            onClick={() => setActionModal('refractometer')}
            className="px-2.5 py-2 rounded-xl bg-charcoal-700 hover:bg-charcoal-600 border border-charcoal-600 text-slate-200 font-medium transition-colors text-left flex items-center gap-1.5"
          >
            <span className="text-cyan-400 font-bold">💧</span> Refractometer
          </button>
          <button
            onClick={toggleSimRun}
            className={`px-2.5 py-2 rounded-xl border font-medium transition-colors text-left flex items-center gap-1.5 ${
              simStatus.running
                ? 'bg-amber-950/60 border-amber-600/50 text-amber-300'
                : 'bg-emerald-950/60 border-emerald-600/50 text-emerald-300'
            }`}
          >
            <span>{simStatus.running ? '⏸ Pause Sim' : '▶ Resume Sim'}</span>
          </button>
        </div>

        {/* Simulator Scenario Picker */}
        <div className="pt-1">
          <label className="text-[10px] text-slate-400 block mb-1">Physics Simulator Scenario:</label>
          <select
            value={currentScenario}
            onChange={(e) => handleScenarioChange(e.target.value)}
            className="w-full bg-charcoal-900 border border-charcoal-600 rounded-lg px-2 py-1 text-xs text-slate-200 focus:outline-none focus:border-honey"
          >
            <option value="normal">Normal Day/Night (Calm Colony)</option>
            <option value="nectar_flow">Heavy Nectar Flow (+1.2 kg/day)</option>
            <option value="heavy_fanning">Intense Night Dewatering Fanning</option>
            <option value="swarm">Swarm Departure (Sudden -1.5 kg Drop)</option>
            <option value="queenless">Queenless Disturbance (+25 Hz Pitch)</option>
            <option value="rain">Monsoon Rain (High Ambient RH, Foraging Stop)</option>
            <option value="sensor_fault">Sensor Disconnect Fault (0 Hz / NaN)</option>
          </select>
        </div>
      </div>

      {/* 2. Alert Feed (§7) */}
      <div className="space-y-2 pt-2 border-t border-charcoal-border">
        <div className="flex items-center justify-between text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
          <span>Active Alerts</span>
          <span className="px-1.5 py-0.2 rounded bg-charcoal-700 text-slate-300 font-mono text-[10px]">
            {alerts.length}
          </span>
        </div>

        {alerts.length === 0 ? (
          <div className="p-3 rounded-xl bg-charcoal-900/60 border border-charcoal-border text-center text-xs text-slate-500">
            ✓ All parameters healthy · No active alarms
          </div>
        ) : (
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {alerts.map((al, idx) => {
              const key = `${al.rule_id}-${idx}`;
              const isCrit = al.severity === 'critical';
              const isWarn = al.severity === 'warning';
              return (
                <div
                  key={key}
                  className={`p-3 rounded-xl border text-xs space-y-1.5 ${
                    isCrit ? 'bg-critical/10 border-critical/40 text-rose-200' :
                    isWarn ? 'bg-warning/10 border-warning/40 text-amber-200' :
                    'bg-cyan-950/40 border-cyan-500/30 text-cyan-200'
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span className="font-mono text-[11px]">{al.rule_id}</span>
                    <button
                      onClick={() => dismissAlert(al.id)}
                      className="text-[10px] text-slate-400 hover:text-white px-1.5 py-0.5 rounded bg-charcoal-900/80 border border-charcoal-700"
                    >
                      Ack
                    </button>
                  </div>
                  <p className="text-[11px] leading-snug">{al.message}</p>
                  
                  {/* Expandable "Why?" section */}
                  {al.why && (
                    <div>
                      <button
                        onClick={() => setExpandedWhy(prev => ({ ...prev, [key]: !prev[key] }))}
                        className="text-[10px] text-honey hover:underline flex items-center gap-1 font-mono"
                      >
                        <span>{expandedWhy[key] ? '▼ Hide Numbers' : '▶ Why did this trip?'}</span>
                      </button>
                      {expandedWhy[key] && (
                        <div className="mt-1.5 p-2 rounded bg-charcoal-900/90 border border-charcoal-700 text-[10px] text-slate-300 font-mono leading-relaxed">
                          {al.why}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Event Timeline */}
      <div className="space-y-2 pt-2 border-t border-charcoal-border">
        <div className="text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
          Colony Event Log
        </div>
        <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
          {events.length === 0 ? (
            <div className="text-xs text-slate-500 text-center py-2">No events recorded</div>
          ) : (
            events.map((ev) => (
              <div key={ev.id || `${ev.ts}-${ev.kind}`} className="p-2.5 rounded-lg bg-charcoal-900/70 border border-charcoal-border text-xs space-y-1">
                <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                  <span>{ev.kind.toUpperCase()}</span>
                  <span>{ev.ts ? ev.ts.slice(11, 16) : ''}</span>
                </div>
                <div className="font-medium text-slate-200">
                  {ev.state || ev.rule_id || (ev.cal_kind ? `Cal: ${ev.cal_kind}` : '') || (ev.honey_kg ? `Harvest: ${ev.honey_kg} kg` : '')}
                </div>
                {ev.note && <p className="text-[11px] text-slate-400 line-clamp-2">{ev.note}</p>}
                {ev.message && <p className="text-[11px] text-slate-400 line-clamp-2">{ev.message}</p>}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Action Modals */}
      {actionModal === 'baseline' && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-charcoal-800 border border-charcoal-border rounded-card p-6 w-full max-w-sm space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white">Set Colony Tare Baseline</h3>
            <p className="text-xs text-slate-400">
              Zeroes out hive structure, frames, and comb weight so Honey Collected reflects net honey yield.
            </p>
            <div>
              <label className="text-xs text-slate-300 block mb-1">Baseline Weight (kg) - Leave empty for current:</label>
              <input
                type="number"
                step="0.01"
                placeholder="Current gross weight"
                value={baselineInput}
                onChange={(e) => setBaselineInput(e.target.value)}
                className="w-full bg-charcoal-900 border border-charcoal-600 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-honey"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setActionModal(null)} className="px-3 py-1.5 text-xs text-slate-400 hover:text-white">Cancel</button>
              <button onClick={handleBaselineSubmit} className="px-4 py-1.5 text-xs bg-honey text-charcoal-900 font-bold rounded-lg hover:bg-honey-light">Apply Baseline</button>
            </div>
          </div>
        </div>
      )}

      {actionModal === 'harvest' && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-charcoal-800 border border-charcoal-border rounded-card p-6 w-full max-w-sm space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white">Log Honey Extraction Harvest</h3>
            <div className="space-y-3 text-xs">
              <div>
                <label className="text-slate-300 block mb-1">Harvested Honey Mass (kg):</label>
                <input
                  type="number"
                  step="0.1"
                  value={harvestKg}
                  onChange={(e) => setHarvestKg(e.target.value)}
                  className="w-full bg-charcoal-900 border border-charcoal-600 rounded-lg px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="text-slate-300 block mb-1">Capped Frames Extracted:</label>
                <input
                  type="number"
                  value={harvestFrames}
                  onChange={(e) => setHarvestFrames(e.target.value)}
                  className="w-full bg-charcoal-900 border border-charcoal-600 rounded-lg px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="text-slate-300 block mb-1">Lab Moisture (%) [Refractometer]:</label>
                <input
                  type="number"
                  step="0.1"
                  value={harvestMoist}
                  onChange={(e) => setHarvestMoist(e.target.value)}
                  className="w-full bg-charcoal-900 border border-charcoal-600 rounded-lg px-3 py-2 text-white"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setActionModal(null)} className="px-3 py-1.5 text-xs text-slate-400">Cancel</button>
              <button onClick={handleHarvestSubmit} className="px-4 py-1.5 text-xs bg-emerald-500 text-charcoal-900 font-bold rounded-lg hover:bg-emerald-400">Confirm Harvest</button>
            </div>
          </div>
        </div>
      )}

      {actionModal === 'refractometer' && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-charcoal-800 border border-charcoal-border rounded-card p-6 w-full max-w-sm space-y-4 shadow-2xl">
            <h3 className="text-sm font-bold text-white">Log Honey Refractometer Reading</h3>
            <p className="text-xs text-slate-400">
              Ground-truth entry. The backend will compute an EWMA offset to back-fit the honey model.
            </p>
            <div>
              <label className="text-xs text-slate-300 block mb-1">Measured Moisture %:</label>
              <input
                type="number"
                step="0.1"
                value={refractometerMoist}
                onChange={(e) => setRefractometerMoist(e.target.value)}
                className="w-full bg-charcoal-900 border border-charcoal-600 rounded-lg px-3 py-2 text-sm text-white"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setActionModal(null)} className="px-3 py-1.5 text-xs text-slate-400">Cancel</button>
              <button onClick={handleRefractometerSubmit} className="px-4 py-1.5 text-xs bg-cyan-500 text-charcoal-900 font-bold rounded-lg hover:bg-cyan-400">Update Model</button>
            </div>
          </div>
        </div>
      )}
    </aside>
  );
};
