import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { RightRail } from './components/RightRail';
import { LiveOverview } from './pages/LiveOverview';
import { HoneyDeepDive } from './pages/HoneyDeepDive';
import { AcousticsPage } from './pages/AcousticsPage';
import { TrendsPage } from './pages/TrendsPage';
import { CalibrationPage } from './pages/CalibrationPage';
import { BlockchainPage } from './pages/BlockchainPage';
import { SettingsPage } from './pages/SettingsPage';
import { useLiveStore } from './store/liveStore';

export const App: React.FC = () => {
  const { connectWebSocket } = useLiveStore();

  useEffect(() => {
    connectWebSocket();
  }, [connectWebSocket]);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-charcoal-900 text-slate-100 flex flex-col font-sans">
        <Header />
        <div className="flex-1 flex overflow-hidden">
          <Sidebar />
          <main className="flex-1 p-6 overflow-y-auto max-h-[calc(100vh-73px)]">
            <Routes>
              <Route path="/" element={<LiveOverview />} />
              <Route path="/honey" element={<HoneyDeepDive />} />
              <Route path="/acoustics" element={<AcousticsPage />} />
              <Route path="/trends" element={<TrendsPage />} />
              <Route path="/calibration" element={<CalibrationPage />} />
              <Route path="/blockchain" element={<BlockchainPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
          <RightRail />
        </div>
      </div>
    </BrowserRouter>
  );
};

export default App;
