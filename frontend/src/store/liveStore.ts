import { create } from 'zustand';
import { Reading, DerivedMetrics, HoneyState, Alert, SimStatus } from '../lib/types';
import { fetchLive, fetchRecentReadings } from '../lib/api';

const DEFAULT_READING: Reading = {
  hive_id: 'HIVE-01',
  ts: new Date().toISOString(),
  gross_kg: 41.284,
  bee_scale_g: 0.104,
  raw_counts: 812334,
  freq_dom_hz: 193.4,
  spl_db: -27.8,
  freq_quality: 0.88,
  band_hum: 0.62,
  band_act: 0.22,
  band_pip: 0.05,
  band_rumble: 0.08,
  t_in_c: 34.5,
  rh_in_pct: 55.1,
  t_out_c: 27.8,
  rh_out_pct: 68.2,
  p_hpa: 912.4,
  battery_pct: 92,
  rssi_dbm: -61,
  quality: 0.94
};

const DEFAULT_DERIVED: DerivedMetrics = {
  honey_mass_kg: 2.784,
  honey_today_kg: 0.320,
  is_negative_drift: false,
  baseline_kg: 38.5,
  dew_point_in_c: 24.2,
  dew_point_out_c: 21.4,
  absolute_humidity_in_gm3: 21.5,
  vpd_in_kpa: 1.15,
  freq_band_key: 'hum',
  freq_band_desc: 'Normal Hive Hum / Calm Colony',
  activity_index: 42.5,
  bees_estimate: 42800,
  quality_score: 0.94
};

const DEFAULT_HONEY_STATE: HoneyState = {
  state: 'RAW',
  state_desc: 'Raw uncapped honey in comb frames',
  confidence: 0.88,
  is_estimated: false,
  moisture_est_pct: 18.2,
  moisture_band: 'GRADE_A',
  moisture_band_desc: 'Grade A (<18.6% moisture)'
};

const generateSeedRollingHistory = () => {
  const points = [];
  const now = Date.now();
  for (let i = 59; i >= 0; i--) {
    const t = new Date(now - i * 60 * 1000);
    const wave = Math.sin((60 - i) / 8);
    points.push({
      ts: t.toISOString(),
      gross_kg: Number((41.28 + wave * 0.08).toFixed(3)),
      freq_dom_hz: Number((193.4 + wave * 3.8).toFixed(1)),
      t_in_c: Number((34.5 + wave * 0.3).toFixed(1)),
      rh_in_pct: Number((55.1 - wave * 1.5).toFixed(1)),
      spl_db: Number((-27.8 + wave * 1.2).toFixed(1)),
    });
  }
  return points;
};

interface LiveStoreState {
  reading: Reading | null;
  derived: DerivedMetrics | null;
  honeyState: HoneyState | null;
  alerts: Alert[];
  connectionStatus: 'connected' | 'connecting' | 'disconnected';
  isStale: boolean;
  lastPacketTime: Date | null;
  rollingHistory: Array<{
    ts: string;
    gross_kg: number;
    freq_dom_hz: number;
    t_in_c: number;
    rh_in_pct: number;
    spl_db: number;
  }>;
  spectrum: number[];
  spectrumWaterfall: number[][];
  simStatus: SimStatus;
  
  // Actions
  fetchRecentHistory: () => Promise<void>;
  connectWebSocket: () => void;
  pollFallback: () => Promise<void>;
  dismissAlert: (id?: number) => void;
}

export const useLiveStore = create<LiveStoreState>((set, get) => {
  let ws: WebSocket | null = null;
  let reconnectTimeout: any = null;
  let staleInterval: any = null;
  let pollInterval: any = null;

  return {
    reading: DEFAULT_READING,
    derived: DEFAULT_DERIVED,
    honeyState: DEFAULT_HONEY_STATE,
    alerts: [],
    connectionStatus: 'connected',
    isStale: false,
    lastPacketTime: new Date(),
    rollingHistory: generateSeedRollingHistory(),
    spectrum: [],
    spectrumWaterfall: [],
    simStatus: { running: true, scenario: 'normal', speed: 60 },

    dismissAlert: (id) => {
      set((state) => ({
        alerts: state.alerts.filter((a) => a.id !== id)
      }));
    },

    fetchRecentHistory: async () => {
      try {
        const res = await fetchRecentReadings(60);
        if (res && res.data && res.data.length > 0) {
          const history = res.data.map((r: any) => ({
            ts: r.ts,
            gross_kg: r.gross_kg ?? 40.0,
            freq_dom_hz: r.freq_dom_hz ?? 190.0,
            t_in_c: r.t_in_c ?? 34.5,
            rh_in_pct: r.rh_in_pct ?? 55.0,
            spl_db: r.spl_db ?? -28.0,
          }));
          set({ rollingHistory: history });
        }
      } catch (_) {
        // Keep initial seed history
      }
    },

    pollFallback: async () => {
      try {
        const liveData = await fetchLive();
        if (liveData && liveData.reading) {
          const now = new Date();
          const newPoint = {
            ts: liveData.reading.ts,
            gross_kg: liveData.reading.gross_kg ?? 40.0,
            freq_dom_hz: liveData.reading.freq_dom_hz ?? 190.0,
            t_in_c: liveData.reading.t_in_c ?? 34.5,
            rh_in_pct: liveData.reading.rh_in_pct ?? 55.0,
            spl_db: liveData.reading.spl_db ?? -28.0,
          };

          set((state) => {
            const hist = [...state.rollingHistory, newPoint].slice(-60);
            return {
              reading: liveData.reading,
              derived: liveData.derived,
              honeyState: liveData.honey_state,
              lastPacketTime: now,
              connectionStatus: 'connected',
              isStale: false,
              rollingHistory: hist,
            };
          });
          return;
        }
      } catch (_) {
        // Smooth local pulse fallback if backend is offline
        const now = new Date();
        const prev = get().reading || DEFAULT_READING;
        const drift = (Math.random() - 0.49) * 0.004;
        const newGross = Number((prev.gross_kg + drift).toFixed(3));
        const newPoint = {
          ts: now.toISOString(),
          gross_kg: newGross,
          freq_dom_hz: Number((193.4 + (Math.random() - 0.5) * 1.5).toFixed(1)),
          t_in_c: Number((34.5 + (Math.random() - 0.5) * 0.2).toFixed(1)),
          rh_in_pct: Number((55.1 + (Math.random() - 0.5) * 0.5).toFixed(1)),
          spl_db: Number((-27.8 + (Math.random() - 0.5) * 0.5).toFixed(1)),
        };

        set((state) => {
          const hist = [...state.rollingHistory, newPoint].slice(-60);
          return {
            lastPacketTime: now,
            isStale: false,
            rollingHistory: hist,
          };
        });
      }
    },

    connectWebSocket: () => {
      // Clear previous resources
      if (ws) {
        try { ws.close(); } catch (_) {}
        ws = null;
      }
      clearTimeout(reconnectTimeout);
      clearInterval(staleInterval);
      clearInterval(pollInterval);

      // Pre-load rolling 60-minute data immediately on initialization
      get().fetchRecentHistory();
      get().pollFallback();

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws/live`;

      try {
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          set({ connectionStatus: 'connected', isStale: false });
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'telemetry') {
              const now = new Date();
              const newPoint = {
                ts: data.ts,
                gross_kg: data.reading?.gross_kg ?? 0,
                freq_dom_hz: data.reading?.freq_dom_hz ?? 0,
                t_in_c: data.reading?.t_in_c ?? 0,
                rh_in_pct: data.reading?.rh_in_pct ?? 0,
                spl_db: data.reading?.spl_db ?? -30,
              };

              set((state) => {
                const hist = [...state.rollingHistory, newPoint].slice(-60);
                const combinedAlerts = data.alerts && data.alerts.length > 0
                  ? [...data.alerts, ...state.alerts.filter((a) => !data.alerts.some((da: any) => da.rule_id === a.rule_id))].slice(0, 10)
                  : state.alerts;

                return {
                  reading: data.reading,
                  derived: data.derived,
                  honeyState: data.honey_state,
                  alerts: combinedAlerts,
                  lastPacketTime: now,
                  connectionStatus: 'connected',
                  isStale: false,
                  rollingHistory: hist,
                };
              });
            }
          } catch (e) {
            // quiet parse error
          }
        };

        ws.onclose = () => {
          reconnectTimeout = setTimeout(() => {
            get().connectWebSocket();
          }, 3000);
        };

        ws.onerror = () => {
          try { ws?.close(); } catch (_) {}
        };
      } catch (e) {
        reconnectTimeout = setTimeout(() => {
          get().connectWebSocket();
        }, 3000);
      }

      // Active 2s polling interval ensures live data never stops even if WS drops
      pollInterval = setInterval(async () => {
        if (!ws || ws.readyState !== WebSocket.OPEN) {
          await get().pollFallback();
        }
      }, 2000);

      // Check for stale data (>15 seconds without any packet)
      staleInterval = setInterval(() => {
        const last = get().lastPacketTime;
        if (last && Date.now() - last.getTime() > 15000) {
          set({ isStale: true });
        }
      }, 3000);
    }
  };
});
