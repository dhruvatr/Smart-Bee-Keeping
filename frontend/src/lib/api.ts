const API_BASE = '/api';

export async function fetchLive(hiveId = 'HIVE-01') {
  const res = await fetch(`${API_BASE}/live?hive_id=${hiveId}`);
  if (!res.ok) throw new Error('Failed to fetch live telemetry');
  return res.json();
}

export async function fetchSeries(metric: string, res = '1m', from?: string, to?: string, hiveId = 'HIVE-01') {
  let url = `${API_BASE}/series?metric=${metric}&res=${res}&hive_id=${hiveId}`;
  if (from) url += `&from=${encodeURIComponent(from)}`;
  if (to) url += `&to=${encodeURIComponent(to)}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch series for ${metric}`);
  return response.json();
}

export async function fetchSummary(range = 'today', hiveId = 'HIVE-01') {
  const res = await fetch(`${API_BASE}/summary?range=${range}&hive_id=${hiveId}`);
  if (!res.ok) throw new Error('Failed to fetch summary');
  return res.json();
}

export async function fetchLatestSpectrum() {
  const res = await fetch(`${API_BASE}/spectrum/latest`);
  if (!res.ok) throw new Error('Failed to fetch spectrum');
  return res.json();
}

export async function fetchSpectrumHistory() {
  const res = await fetch(`${API_BASE}/spectrum/history`);
  if (!res.ok) throw new Error('Failed to fetch spectrum history');
  return res.json();
}

export async function fetchEvents(type = 'all', limit = 50, hiveId = 'HIVE-01') {
  const res = await fetch(`${API_BASE}/events?type=${type}&limit=${limit}&hive_id=${hiveId}`);
  if (!res.ok) throw new Error('Failed to fetch events');
  return res.json();
}

export async function postBaseline(baselineKg?: number, note = '', hiveId = 'HIVE-01') {
  const res = await fetch(`${API_BASE}/baseline`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hive_id: hiveId, baseline_kg: baselineKg, note })
  });
  return res.json();
}

export async function postHarvest(honeyKg: number, frames: number, moistureLab?: number, note = '', hiveId = 'HIVE-01') {
  const res = await fetch(`${API_BASE}/events/harvest`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hive_id: hiveId, honey_kg: honeyKg, frames, moisture_pct_lab: moistureLab, note })
  });
  return res.json();
}

export async function postRefractometer(moisturePct: number, operator = 'beekeeper', note = '', hiveId = 'HIVE-01') {
  const res = await fetch(`${API_BASE}/refractometer`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hive_id: hiveId, moisture_pct: moisturePct, operator, note })
  });
  return res.json();
}

export async function postCalibrate(kind: string, knownMassKg?: number, rawCounts?: number, hiveId = 'HIVE-01') {
  const res = await fetch(`${API_BASE}/calibrate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hive_id: hiveId, kind, known_mass_kg: knownMassKg, raw_counts: rawCounts })
  });
  return res.json();
}

export async function postSimControl(action: 'start' | 'stop' | 'scenario' | 'speed', val?: string | number) {
  if (action === 'start' || action === 'stop') {
    const res = await fetch(`${API_BASE}/sim/${action}`, { method: 'POST' });
    return res.json();
  }
  if (action === 'scenario') {
    const res = await fetch(`${API_BASE}/sim/scenario`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario: val })
    });
    return res.json();
  }
  if (action === 'speed') {
    const res = await fetch(`${API_BASE}/sim/speed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ speed: Number(val) })
    });
    return res.json();
  }
}

export async function fetchSimStatus() {
  const res = await fetch(`${API_BASE}/sim/status`);
  return res.json();
}

export async function fetchBlockchainBatches(hiveId = 'HIVE-01') {
  const res = await fetch(`${API_BASE}/blockchain/batches?hive_id=${hiveId}`);
  return res.json();
}

export async function postMintBatch(batch: {
  batch_name: string;
  honey_kg: number;
  moisture_pct: number;
  apiary_location?: string;
  botanical_source?: string;
  hive_id?: string;
}) {
  const res = await fetch(`${API_BASE}/blockchain/mint`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hive_id: 'HIVE-01', ...batch })
  });
  return res.json();
}

export async function verifyBlockchainBatch(batchId: string) {
  const res = await fetch(`${API_BASE}/blockchain/verify/${batchId}`);
  return res.json();
}

export async function fetchSettings() {
  const res = await fetch(`${API_BASE}/settings`);
  return res.json();
}

export async function updateSettings(payload: any) {
  const res = await fetch(`${API_BASE}/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  return res.json();
}
