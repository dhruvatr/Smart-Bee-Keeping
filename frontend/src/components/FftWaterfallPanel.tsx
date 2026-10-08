import React, { useEffect, useRef } from 'react';
import { fetchLatestSpectrum, fetchSpectrumHistory } from '../lib/api';

interface FftWaterfallPanelProps {
  domFreqHz?: number;
}

export const FftWaterfallPanel: React.FC<FftWaterfallPanelProps> = ({ domFreqHz = 193.4 }) => {
  const spectrumCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const waterfallCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    let animId: number;
    let isActive = true;

    const render = async () => {
      try {
        const [specData, histData] = await Promise.all([
          fetchLatestSpectrum(),
          fetchSpectrumHistory()
        ]);

        if (!isActive) return;

        const spectrum: number[] = specData.spectrum || [];
        const frames: number[][] = histData.frames || [];

        // 1. Draw Spectrum Canvas
        const specCanvas = spectrumCanvasRef.current;
        if (specCanvas && spectrum.length > 0) {
          const ctx = specCanvas.getContext('2d');
          if (ctx) {
            const w = specCanvas.width;
            const h = specCanvas.height;
            ctx.clearRect(0, 0, w, h);

            // Background grid
            ctx.fillStyle = '#0B0E11';
            ctx.fillRect(0, 0, w, h);

            // Highlight 150–250 Hz hum band
            // Frequency range 0 to 1000 Hz mapped across w
            const humXStart = (150.0 / 1000.0) * w;
            const humXEnd = (250.0 / 1000.0) * w;
            ctx.fillStyle = 'rgba(242, 183, 5, 0.12)';
            ctx.fillRect(humXStart, 0, humXEnd - humXStart, h);

            // Draw spectrum bars / line
            ctx.strokeStyle = '#F2B705';
            ctx.lineWidth = 1.5;
            ctx.beginPath();

            const numBins = spectrum.length;
            for (let i = 0; i < numBins; i++) {
              const x = (i / numBins) * w;
              const mag = spectrum[i];
              const y = h - mag * (h - 10);
              if (i === 0) ctx.moveTo(x, y);
              else ctx.lineTo(x, y);
            }
            ctx.stroke();

            // Gradient area fill under spectrum
            ctx.lineTo(w, h);
            ctx.lineTo(0, h);
            ctx.closePath();
            const grad = ctx.createLinearGradient(0, 0, 0, h);
            grad.addColorStop(0, 'rgba(242, 183, 5, 0.25)');
            grad.addColorStop(1, 'rgba(242, 183, 5, 0.0)');
            ctx.fillStyle = grad;
            ctx.fill();

            // Dominant Frequency Marker
            const markerX = (domFreqHz / 1000.0) * w;
            ctx.strokeStyle = '#FF5C5C';
            ctx.lineWidth = 2;
            ctx.setLineDash([4, 2]);
            ctx.beginPath();
            ctx.moveTo(markerX, 0);
            ctx.lineTo(markerX, h);
            ctx.stroke();
            ctx.setLineDash([]);

            // Marker text
            ctx.fillStyle = '#F8FAFC';
            ctx.font = '10px ui-monospace, monospace';
            ctx.fillText(`${domFreqHz.toFixed(1)} Hz Peak`, Math.min(w - 70, markerX + 4), 16);
          }
        }

        // 2. Draw Waterfall Spectrogram Canvas
        const wfCanvas = waterfallCanvasRef.current;
        if (wfCanvas && frames.length > 0) {
          const ctx = wfCanvas.getContext('2d');
          if (ctx) {
            const w = wfCanvas.width;
            const h = wfCanvas.height;
            const rowHeight = h / Math.max(1, frames.length);

            for (let f = 0; f < frames.length; f++) {
              const frame = frames[f];
              const y = f * rowHeight;
              const binWidth = w / frame.length;

              for (let b = 0; b < frame.length; b++) {
                const mag = frame[b];
                const x = b * binWidth;

                // Colormap: Charcoal -> Amber -> Gold -> Red
                let r = 11, g = 14, blue = 17;
                if (mag > 0.05) {
                  r = Math.min(255, Math.floor(mag * 255 * 1.4));
                  g = Math.min(200, Math.floor(mag * 180));
                  blue = Math.max(5, Math.floor((1.0 - mag) * 30));
                }

                ctx.fillStyle = `rgb(${r},${g},${blue})`;
                ctx.fillRect(x, y, binWidth + 0.5, rowHeight + 0.5);
              }
            }
          }
        }
      } catch (_) {}

      if (isActive) {
        animId = window.setTimeout(render, 1500);
      }
    };

    render();

    return () => {
      isActive = false;
      clearTimeout(animId);
    };
  }, [domFreqHz]);

  return (
    <div className="bg-charcoal-800 rounded-card p-5 border border-charcoal-border shadow-md space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-bold text-white tracking-tight flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-honey animate-pulse"></span>
            Acoustic FFT Spectrum & Spectrogram Waterfall
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            4096-sample Hann-windowed FFT (0–1000 Hz) with highlighted 150–250 Hz calm colony hum band
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono">
          <span className="flex items-center gap-1 text-honey">
            <span className="w-2.5 h-2.5 bg-honey/30 border border-honey inline-block rounded-sm"></span>
            150–250 Hz Hum
          </span>
          <span className="flex items-center gap-1 text-critical">
            <span className="w-2 h-0.5 bg-critical inline-block"></span>
            Peak Marker
          </span>
        </div>
      </div>

      <div className="space-y-2">
        {/* FFT Spectrum Curve */}
        <div className="relative bg-charcoal-900 rounded-xl overflow-hidden border border-charcoal-border">
          <canvas
            ref={spectrumCanvasRef}
            width={700}
            height={130}
            className="w-full h-32 block"
          />
          <div className="absolute bottom-1 right-2 text-[10px] text-slate-500 font-mono">
            0 Hz ---------------------------------------------------- 1000 Hz
          </div>
        </div>

        {/* 60-Frame Waterfall Spectrogram */}
        <div className="relative bg-charcoal-900 rounded-xl overflow-hidden border border-charcoal-border">
          <canvas
            ref={waterfallCanvasRef}
            width={700}
            height={100}
            className="w-full h-24 block"
          />
          <div className="absolute top-1 left-2 text-[10px] text-slate-400 font-mono bg-charcoal-900/80 px-1.5 py-0.5 rounded">
            60-Frame Waterfall (Gold → Red Intensity)
          </div>
        </div>
      </div>
    </div>
  );
};
