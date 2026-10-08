export interface Reading {
  id?: number;
  hive_id: string;
  ts: string;
  gross_kg: number;
  raw_counts?: number;
  bee_scale_g?: number | null;
  freq_dom_hz: number;
  spl_db: number;
  freq_quality: number;
  band_hum: number;
  band_act: number;
  band_pip: number;
  band_rumble?: number;
  t_in_c: number;
  rh_in_pct: number;
  t_out_c: number;
  rh_out_pct: number;
  p_hpa: number;
  rssi_dbm: number;
  battery_pct: number;
  quality: number;
}

export interface DerivedMetrics {
  honey_mass_kg: number;
  is_negative_drift: boolean;
  honey_today_kg: number;
  baseline_kg: number;
  dew_point_in_c: number;
  dew_point_out_c: number;
  absolute_humidity_in_gm3: number;
  vpd_in_kpa: number;
  freq_band_key: string;
  freq_band_desc: string;
  activity_index: number;
  bees_estimate: number;
  quality_score: number;
}

export interface HoneyState {
  state: 'NECTAR_INTAKE' | 'RIPENING' | 'RAW' | 'COMPLETED' | 'HARVESTED';
  state_desc: string;
  confidence: number;
  is_estimated: boolean;
  moisture_est_pct: number;
  moisture_band: 'EXCELLENT' | 'GRADE_A' | 'RISKY' | 'FERMENTING';
  moisture_band_desc: string;
}

export interface Alert {
  id?: number;
  rule_id: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  value?: number;
  ts: string;
  why: string;
  acknowledged?: number;
}

export interface EventItem {
  id: number;
  hive_id: string;
  ts: string;
  kind: 'state' | 'alert' | 'calibration' | 'harvest';
  state?: string;
  moisture_est_pct?: number;
  confidence?: number;
  honey_mass_kg?: number;
  note?: string;
  rule_id?: string;
  severity?: string;
  message?: string;
  cal_kind?: string;
  operator?: string;
  honey_kg?: number;
  frames?: number;
  moisture_pct_lab?: number;
  batch_hash?: string;
  tx_hash?: string;
}

export interface SummaryData {
  hive_id: string;
  range: string;
  honey_collected_kg: number;
  honey_total_since_baseline_kg: number;
  nectar_income_kg: number;
  ripening_loss_kg: number;
  net_kg: number;
  avg_t_in_c: number;
  avg_rh_in_pct: number;
  avg_freq_hz: number;
  fanning_hours: number;
  uptime_pct: number;
}

export interface BlockchainRecord {
  id: number;
  hive_id: string;
  ts: string;
  batch_id: string;
  batch_name: string;
  honey_kg: number;
  moisture_pct: number;
  quality_grade: string;
  fssai_compliant: number;
  apiary_location: string;
  botanical_source: string;
  payload_hash: string;
  tx_hash: string;
  block_number: number;
  contract_address: string;
  qr_data: string;
  verified: number;
}

export interface SimStatus {
  running: boolean;
  scenario: string;
  speed: number;
  sim_time?: string;
}
