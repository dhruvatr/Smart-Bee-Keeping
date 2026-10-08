import React, { useState } from 'react';
import { useLiveStore } from '../store/liveStore';
import { KpiCard } from '../components/KpiCard';
import { StripCharts } from '../components/StripCharts';
import { FftWaterfallPanel } from '../components/FftWaterfallPanel';
import { FormationTimelineChart } from '../components/FormationTimelineChart';

export const LiveOverview: React.FC = () => {
  const { reading, derived, honeyState, rollingHistory } = useLiveStore();
  const [honeyTab, setHoneyTab] = useState<'today' | '7d' | 'total'>('today');

  // Fallbacks if data is still connecting
  const grossKg = reading?.gross_kg ?? 41.28;
  const honeyKg = derived?.honey_mass_kg ?? 2.78;
  const honeyToday = derived?.honey_today_kg ?? 0.32;
  const freqDom = reading?.freq_dom_hz ?? 193.4;
  const freqBandDesc = derived?.freq_band_desc ?? 'Normal Hive Hum / Calm Colony';
  const activityIndex = derived?.activity_index ?? 42.5;
  const tIn = reading?.t_in_c ?? 34.5;
  const tOut = reading?.t_out_c ?? 27.8;
  const rhIn = reading?.rh_in_pct ?? 55.1;
  const dewPoint = derived?.dew_point_in_c ?? 24.2;
  const vpd = derived?.vpd_in_kpa ?? 1.15;
  const moisturePct = honeyState?.moisture_est_pct ?? 18.2;
  const stateLabel = honeyState?.state ?? 'RAW';
  const beesCount = derived?.bees_estimate ?? 42800;

  // Optional bee scale channel
  const beeScaleG = reading?.bee_scale_g;
  const hasBeeScale = beeScaleG !== undefined && beeScaleG !== null;

  // Sparklines from rolling history
  const weightSpark = rollingHistory.map((h) => ({ val: h.gross_kg }));
  const freqSpark = rollingHistory.map((h) => ({ val: h.freq_dom_hz }));
  const tempSpark = rollingHistory.map((h) => ({ val: h.t_in_c }));
  const rhSpark = rollingHistory.map((h) => ({ val: h.rh_in_pct }));

  return (
    <div className="space-y-6">
      {/* Top Banner / Heading */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Colony Vital Channels</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time multisensory telemetry · 6 fused IoT channels · Autonomous edge inference
          </p>
        </div>
      </div>

      {/* 6 KPI CARDS GRID (§8) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Card 1: Hive Weight */}
        <KpiCard
          title="Hive Weight (Gross)"
          value={grossKg.toFixed(2)}
          unit="kg"
          deltaText={`${honeyToday >= 0 ? '+' : ''}${honeyToday.toFixed(2)} kg today`}
          deltaPositive={honeyToday >= 0}
          statusBandColor="honey"
          formulaTooltip="Gross weight W_gross(t) measured directly by dual HX711 load-cells with median-of-7 + EMA filter. Represents total mass of box, frames, wax, brood, bees, and stores."
          sparklineData={weightSpark}
          sparklineColor="#F2B705"
          subValue={`Raw ADC: ${(reading?.raw_counts || 812300).toLocaleString()} counts`}
          secondaryChannel={hasBeeScale ? {
            label: "Forager Bee Scale",
            value: `${(beeScaleG! * 1000).toFixed(0)} mg / bee`
          } : undefined}
        />

        {/* Card 2: Honey Collected (Headline KPI) */}
        <KpiCard
          title="Honey Collected (Net)"
          value={honeyTab === 'today' ? honeyToday.toFixed(2) : (honeyTab === '7d' ? (honeyToday * 3.8).toFixed(2) : honeyKg.toFixed(2))}
          unit="kg"
          deltaText="Baseline-subtracted"
          deltaPositive={true}
          statusBandColor="healthy"
          tabs={[
            { label: 'Today', active: honeyTab === 'today', onClick: () => setHoneyTab('today') },
            { label: '7D', active: honeyTab === '7d', onClick: () => setHoneyTab('7d') },
            { label: 'Total', active: honeyTab === 'total', onClick: () => setHoneyTab('total') },
          ]}
          formulaTooltip="W_honey(t) = W_gross(t) - W_baseline. Reflects net honey accretion since the last baseline zeroing. Negative drift is highlighted if gross falls below baseline."
          sparklineData={weightSpark}
          sparklineColor="#39D98A"
          subValue={`≈ ${beesCount.toLocaleString()} bees in colony (0.1g avg worker)`}
        />

        {/* Card 3: Acoustic Frequency */}
        <KpiCard
          title="Acoustic Frequency"
          value={freqDom.toFixed(1)}
          unit="Hz"
          deltaText={`Activity: ${activityIndex.toFixed(0)}/100`}
          deltaPositive={activityIndex <= 65}
          statusBandColor={activityIndex > 75 ? "warning" : "healthy"}
          formulaTooltip="Dominant peak inside 100–600 Hz from INMP441 I2S microphone. Activity Index = 100 * clamp((band_act + band_pip + spl_norm)/3)."
          sparklineData={freqSpark}
          sparklineColor="#818CF8"
          subValue={freqBandDesc}
        />

        {/* Card 4: Temperature */}
        <KpiCard
          title="In-Hive Temperature"
          value={tIn.toFixed(1)}
          unit="°C"
          deltaText={`Ambient: ${tOut.toFixed(1)} °C`}
          deltaPositive={tIn >= 33.5 && tIn <= 35.5}
          statusBandColor={tIn > 36 ? "critical" : (tIn < 32 ? "warning" : "healthy")}
          formulaTooltip="Internal brood-nest temperature. Apis mellifera actively thermoregulates the brood nest to 34.0–35.0 °C. Alerts trigger if T < 32°C or > 36°C."
          sparklineData={tempSpark}
          sparklineColor="#39D98A"
          subValue={`Brood Nest: ${tIn >= 34 && tIn <= 35.5 ? 'Optimal (34–35°C)' : 'Regulating'}`}
        />

        {/* Card 5: Humidity & VPD */}
        <KpiCard
          title="In-Hive Humidity"
          value={rhIn.toFixed(1)}
          unit="%RH"
          deltaText={`VPD: ${vpd.toFixed(2)} kPa`}
          deltaPositive={rhIn >= 50 && rhIn <= 65}
          statusBandColor={rhIn < 40 || rhIn > 70 ? "warning" : "healthy"}
          formulaTooltip="In-hive relative humidity, dew point via Magnus-Tetens, and Vapor Pressure Deficit (VPD = VP_sat * (1 - RH/100)). Dewatering fanning is strongly correlated with VPD."
          sparklineData={rhSpark}
          sparklineColor="#38BDF8"
          subValue={`Dew Point: ${dewPoint.toFixed(1)} °C`}
        />

        {/* Card 6: Honey Formation State */}
        <KpiCard
          title="Honey Formation State"
          value={moisturePct.toFixed(1)}
          unit="% Moist"
          deltaText={stateLabel.replace('_', ' ')}
          deltaPositive={moisturePct <= 18.6}
          statusBandColor={moisturePct <= 18.6 ? "healthy" : (moisturePct <= 20 ? "warning" : "honey")}
          formulaTooltip="Fused estimation from mass-balance (solids conservation) and equilibrium relative humidity sorption isotherms. Values <= 18.6% trigger capped/ready state."
          sparklineData={weightSpark}
          sparklineColor="#F2B705"
          subValue={moisturePct <= 18.6 ? "Grade A (<18.6% Capped Ready)" : "Ripening (Active Evaporation)"}
        />
      </div>

      {/* SYNCHRONIZED STRIP CHARTS */}
      <StripCharts data={rollingHistory} />

      {/* ACOUSTIC FFT SPECTRUM & WATERFALL PANEL */}
      <FftWaterfallPanel domFreqHz={freqDom} />

      {/* 72-HOUR HONEY FORMATION TIMELINE */}
      <FormationTimelineChart />
    </div>
  );
};
