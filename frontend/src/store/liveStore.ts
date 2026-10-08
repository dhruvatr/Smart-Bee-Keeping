import { create } from 'zustand';
import { Reading, DerivedMetrics, HoneyState, Alert, SimStatus } from '../lib/types';
import { fetchLive } from '../lib/api';

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
  connectWebSocket: () => void;
  pollFallback: () => Promise<void>;
  dismissAlert: (id?: number) => void;
}

export const useLiveStore = create<LiveStoreState>((set, get) => {
  let ws: WebSocket | null = null;
  let reconnectTimeout: any = null;
  let staleInterval: any = null;

  return {
    reading: null,
    derived: null,
    honeyState: null,
    alerts: [],
    connectionStatus: 'disconnected',
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

    pollFallback: async () => {
      try {
        const liveData = await fetchLive();
        if (liveData && liveData.reading) {
          const now = new Date();
          const newPoint = {
            ts: liveData.reading.ts,
            gross_kg: liveData.reading.gross_kg,
            freq_dom_hz: liveData.reading.freq_dom_hz,
            t_in_c: liveData.reading.t_in_c,
            rh_in_pct: liveData.reading.rh_in_pct,
            spl_db: liveData.reading.spl_db,
          };

          set((state) => {
            const hist = [...state.rollingHistory, newPoint].slice(-60);
            return {
              reading: liveData.reading,
              derived: liveData.derived,
              honeyState: liveData.honey_state,
              lastPacketTime: now,
              isStale: false,
              rollingHistory: hist,
            };
          });
        }
      } catch (err) {
        // quiet fallback
      }
    },

    connectWebSocket: () => {
      // Clear existing
      if (ws) {
        try { ws.close(); } catch (_) {}
      }
      clearTimeout(reconnectTimeout);
      clearInterval(staleInterval);

      set({ connectionStatus: 'connecting' });

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
                  isStale: false,
                  rollingHistory: hist,
                };
              });
            }
          } catch (e) {
            console.error('Failed to parse websocket message', e);
          }
        };

        ws.onclose = () => {
          set({ connectionStatus: 'disconnected' });
          // Auto reconnect with 2.5s backoff
          reconnectTimeout = setTimeout(() => {
            get().connectWebSocket();
          }, 2500);
        };

        ws.onerror = () => {
          try { ws?.close(); } catch (_) {}
        };
      } catch (e) {
        set({ connectionStatus: 'disconnected' });
        reconnectTimeout = setTimeout(() => {
          get().connectWebSocket();
        }, 3000);
      }

      // Check for stale data (>10 seconds without updates)
      staleInterval = setInterval(() => {
        const last = get().lastPacketTime;
        if (last && Date.now() - last.getTime() > 10000) {
          set({ isStale: true });
        }
      }, 2000);

      // Also trigger initial REST poll to populate instantly
      get().pollFallback();
    }
  };
});
