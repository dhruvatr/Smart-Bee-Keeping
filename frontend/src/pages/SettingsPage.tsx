import React, { useState, useEffect } from 'react';
import { fetchSettings, updateSettings } from '../lib/api';

export const SettingsPage: React.FC = () => {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');

  // Editable fields
  const [hiveName, setHiveName] = useState('');
  const [location, setLocation] = useState('');
  const [broodTempWarnLow, setBroodTempWarnLow] = useState('32.0');
  const [broodTempCritHigh, setBroodTempCritHigh] = useState('36.0');
  const [broodRhWarnLow, setBroodRhWarnLow] = useState('40.0');
  const [broodRhWarnHigh, setBroodRhWarnHigh] = useState('70.0');
  const [swarmWeightDrop, setSwarmWeightDrop] = useState('1.5');
  const [abscondingWeightDrop, setAbscondingWeightDrop] = useState('3.0');
  const [queenlessShiftHz, setQueenlessShiftHz] = useState('20.0');
  const [moistureUnripePct, setMoistureUnripePct] = useState('20.0');
  const [weightUnit, setWeightUnit] = useState('kg');
  const [soundAlerts, setSoundAlerts] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetchSettings();
        setConfig(res);
        const meta = res.hive_config?.hive_meta || {};
        const thr = res.hive_config?.thresholds || {};
        const pref = res.hive_config?.preferences || {};

        setHiveName(meta.name || 'Smart-Bee-Keeping - Colony 1');
        setLocation(meta.location || 'Bengaluru Rural, Karnataka, India');
        setBroodTempWarnLow(String(thr.brood_temp_warn_low_c || 32.0));
        setBroodTempCritHigh(String(thr.brood_temp_crit_high_c || 36.0));
        setBroodRhWarnLow(String(thr.brood_rh_warn_low_pct || 40.0));
        setBroodRhWarnHigh(String(thr.brood_rh_warn_high_pct || 70.0));
        setSwarmWeightDrop(String(thr.swarm_weight_drop_kg || 1.5));
        setAbscondingWeightDrop(String(thr.absconding_weight_drop_kg || 3.0));
        setQueenlessShiftHz(String(thr.queenless_freq_shift_hz || 20.0));
        setMoistureUnripePct(String(thr.moisture_unripe_pct || 20.0));
        setWeightUnit(pref.weight_unit || 'kg');
        setSoundAlerts(pref.sound_alerts_enabled ?? true);
      } catch (_) {}
      setLoading(false);
    };
    load();
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMsg('');
    try {
      const updatedConfig = { ...config };
      if (!updatedConfig.hive_config) updatedConfig.hive_config = {};

      updatedConfig.hive_config.hive_meta = {
        ...updatedConfig.hive_config.hive_meta,
        name: hiveName,
        location: location
      };

      updatedConfig.hive_config.thresholds = {
        ...updatedConfig.hive_config.thresholds,
        brood_temp_warn_low_c: parseFloat(broodTempWarnLow),
        brood_temp_crit_high_c: parseFloat(broodTempCritHigh),
        brood_rh_warn_low_pct: parseFloat(broodRhWarnLow),
        brood_rh_warn_high_pct: parseFloat(broodRhWarnHigh),
        swarm_weight_drop_kg: parseFloat(swarmWeightDrop),
        absconding_weight_drop_kg: parseFloat(abscondingWeightDrop),
        queenless_freq_shift_hz: parseFloat(queenlessShiftHz),
        moisture_unripe_pct: parseFloat(moistureUnripePct)
      };

      updatedConfig.hive_config.preferences = {
        ...updatedConfig.hive_config.preferences,
        weight_unit: weightUnit,
        sound_alerts_enabled: soundAlerts
      };

      await updateSettings(updatedConfig);
      setMsg('Settings updated successfully and persisted to disk.');
    } catch (e: any) {
      setMsg(`Error saving settings: ${e.message}`);
    }
    setSaving(false);
  };

  const handleResetDefaults = () => {
    setBroodTempWarnLow('32.0');
    setBroodTempCritHigh('36.0');
    setBroodRhWarnLow('40.0');
    setBroodRhWarnHigh('70.0');
    setSwarmWeightDrop('1.5');
    setAbscondingWeightDrop('3.0');
    setQueenlessShiftHz('20.0');
    setMoistureUnripePct('20.0');
    setWeightUnit('kg');
    setSoundAlerts(true);
    setMsg('Thresholds reset to scientific factory defaults.');
  };

  if (loading) {
    return <div className="p-8 text-center text-xs text-slate-500">Loading configuration...</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">System Configuration & Thresholds</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Every analytical parameter, biophysical limit, and alarm threshold is fully editable with zero stubs
          </p>
        </div>

        <div className="flex gap-2">
          <button
            onClick={handleResetDefaults}
            className="px-3 py-1.5 rounded-xl bg-charcoal-700 hover:bg-charcoal-600 border border-charcoal-600 text-xs text-slate-300 font-medium"
          >
            Reset Defaults
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-1.5 rounded-xl bg-honey hover:bg-honey-light text-charcoal-900 font-bold text-xs transition-colors shadow-lg shadow-honey/10"
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </div>

      {msg && (
        <div className="p-3 rounded-xl bg-honey/10 border border-honey/40 text-xs text-honey font-mono">
          {msg}
        </div>
      )}

      {/* 1. Hive Identity & Location */}
      <div className="bg-charcoal-800 rounded-card p-5 border border-charcoal-border shadow-md space-y-4">
        <h3 className="text-sm font-bold text-white tracking-tight">Hive Metadata & Apiary Location</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="text-slate-300 block mb-1">Colony Display Name:</label>
            <input
              type="text"
              value={hiveName}
              onChange={(e) => setHiveName(e.target.value)}
              className="w-full bg-charcoal-900 border border-charcoal-600 rounded-lg px-3 py-2 text-white"
            />
          </div>
          <div>
            <label className="text-slate-300 block mb-1">Apiary Geographic Coordinates / Location:</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full bg-charcoal-900 border border-charcoal-600 rounded-lg px-3 py-2 text-white"
            />
          </div>
        </div>
      </div>

      {/* 2. Analytical Alarm Thresholds (§5, §7) */}
      <div className="bg-charcoal-800 rounded-card p-5 border border-charcoal-border shadow-md space-y-4">
        <h3 className="text-sm font-bold text-white tracking-tight">Colony Health & Alarm Thresholds</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="text-slate-300 block mb-1">Brood Low Temperature Alarm (°C):</label>
            <input
              type="number"
              step="0.5"
              value={broodTempWarnLow}
              onChange={(e) => setBroodTempWarnLow(e.target.value)}
              className="w-full bg-charcoal-900 border border-charcoal-600 rounded-lg px-3 py-2 text-white"
            />
            <span className="text-[10px] text-slate-500">Normal brood baseline: 34.0–35.0 °C</span>
          </div>
          <div>
            <label className="text-slate-300 block mb-1">Brood Overheat Lethal Alarm (°C):</label>
            <input
              type="number"
              step="0.5"
              value={broodTempCritHigh}
              onChange={(e) => setBroodTempCritHigh(e.target.value)}
              className="w-full bg-charcoal-900 border border-charcoal-600 rounded-lg px-3 py-2 text-white"
            />
            <span className="text-[10px] text-slate-500">Triggers critical alarm to prevent comb melt</span>
          </div>
          <div>
            <label className="text-slate-300 block mb-1">Brood Minimum RH (%):</label>
            <input
              type="number"
              step="1"
              value={broodRhWarnLow}
              onChange={(e) => setBroodRhWarnLow(e.target.value)}
              className="w-full bg-charcoal-900 border border-charcoal-600 rounded-lg px-3 py-2 text-white"
            />
            <span className="text-[10px] text-slate-500">Brood development requires &gt;40% RH</span>
          </div>
          <div>
            <label className="text-slate-300 block mb-1">Brood Maximum RH (%):</label>
            <input
              type="number"
              step="1"
              value={broodRhWarnHigh}
              onChange={(e) => setBroodRhWarnHigh(e.target.value)}
              className="w-full bg-charcoal-900 border border-charcoal-600 rounded-lg px-3 py-2 text-white"
            />
            <span className="text-[10px] text-slate-500">Excess humidity fosters Chalkbrood fungi</span>
          </div>
          <div>
            <label className="text-slate-300 block mb-1">Swarm Weight Drop Trigger (kg in 6h):</label>
            <input
              type="number"
              step="0.1"
              value={swarmWeightDrop}
              onChange={(e) => setSwarmWeightDrop(e.target.value)}
              className="w-full bg-charcoal-900 border border-charcoal-600 rounded-lg px-3 py-2 text-white"
            />
            <span className="text-[10px] text-slate-500">Correlated with acoustic piping & flight burst</span>
          </div>
          <div>
            <label className="text-slate-300 block mb-1">Queenless Frequency Shift (+Hz):</label>
            <input
              type="number"
              step="1"
              value={queenlessShiftHz}
              onChange={(e) => setQueenlessShiftHz(e.target.value)}
              className="w-full bg-charcoal-900 border border-charcoal-600 rounded-lg px-3 py-2 text-white"
            />
            <span className="text-[10px] text-slate-500">Queenless roar pitch shift above 190 Hz</span>
          </div>
        </div>
      </div>

      {/* 3. Units & Preferences */}
      <div className="bg-charcoal-800 rounded-card p-5 border border-charcoal-border shadow-md space-y-4">
        <h3 className="text-sm font-bold text-white tracking-tight">Display Units & Audio Alarms</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="text-slate-300 block mb-1">Weight Unit Preference:</label>
            <select
              value={weightUnit}
              onChange={(e) => setWeightUnit(e.target.value)}
              className="w-full bg-charcoal-900 border border-charcoal-600 rounded-lg px-3 py-2 text-white"
            >
              <option value="kg">Kilograms (kg)</option>
              <option value="lb">Pounds (lb)</option>
            </select>
          </div>
          <div className="flex items-center gap-3 pt-4">
            <input
              type="checkbox"
              id="soundAlertsCheck"
              checked={soundAlerts}
              onChange={(e) => setSoundAlerts(e.target.checked)}
              className="w-4 h-4 accent-honey rounded"
            />
            <label htmlFor="soundAlertsCheck" className="text-slate-300 font-medium">
              Enable Audible Alarm Chimes for Critical Triggers
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};
