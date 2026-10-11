import { create } from 'zustand';
import { Reading, DerivedMetrics, HoneyState, Alert, SimStatus } from '../lib/types';
import { fetchLive, fetchRecentReadings } from '../lib/api';

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
    reading: null,
    derived: null,
    honeyState: null,
    alerts: [],
    connectionStatus: 'connecting',
    isStale: false,
    lastPacketTime: null,
    rollingHistory: [],
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
        // Quiet fallback
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
        }
      } catch (err) {
        const last = get().lastPacketTime;
        if (!last || Date.now() - last.getTime() > 10000) {
          set({ connectionStatus: 'disconnected' });
        }
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

      // Check for stale data (>10 seconds without any packet)
      staleInterval = setInterval(() => {
        const last = get().lastPacketTime;
        if (last && Date.now() - last.getTime() > 10000) {
          set({ isStale: true });
        }
      }, 2000);
    }
  };
});
