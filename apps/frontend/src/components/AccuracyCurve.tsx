import { motion } from 'framer-motion';
import type { AccuracyPoint, AccuracyTrend } from '@predictor/contracts';
import { formatDateShortRu } from '../lib/date';

const TREND_CONFIG: Record<AccuracyTrend, { label: string; color: string }> = {
  improving:        { label: '↑', color: '#3DAB7A' },
  stable:           { label: '→', color: '#C09A50' },
  declining:        { label: '↓', color: '#D07848' },
  insufficient_data:{ label: '',  color: '#AEAEB2' },
};

interface AccuracyCurveProps {
  points: AccuracyPoint[];
  trend: AccuracyTrend;
  totalReviews: number;
}

export function AccuracyCurve({ points, trend, totalReviews }: AccuracyCurveProps) {
  const trendCfg = TREND_CONFIG[trend];

  if (points.length < 3) {
    return (
      <div className="card">
        <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--color-text-tertiary)' }}>
          Точность прогнозов
        </p>
        <div className="flex flex-col items-center py-6 gap-2">
          <p className="text-sm text-center" style={{ color: 'var(--color-text-secondary)' }}>
            Нужно ещё несколько дней
          </p>
          {totalReviews > 0 && (
            <div className="flex gap-1 mt-1">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  className="w-2 h-2 rounded-full"
                  style={{ background: i < totalReviews ? 'var(--color-accent)' : 'var(--color-border)' }}
                />
              ))}
            </div>
          )}
          <p className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
            ещё {3 - totalReviews} {3 - totalReviews === 1 ? 'день' : 'дня'} — и график появится
          </p>
        </div>
      </div>
    );
  }

  // SVG dimensions
  const W = 320;
  const H = 80;
  const PAD = { x: 12, top: 8, bottom: 20 };
  const innerW = W - PAD.x * 2;
  const innerH = H - PAD.top - PAD.bottom;

  const xs = points.map((_, i) =>
    PAD.x + (points.length === 1 ? innerW / 2 : (i / (points.length - 1)) * innerW),
  );
  const ys = points.map((p) => PAD.top + (1 - p.accuracy) * innerH);

  const linePath = xs.map((x, i) => `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${ys[i].toFixed(1)}`).join(' ');
  const areaPath = `${linePath} L ${xs[xs.length - 1].toFixed(1)} ${(PAD.top + innerH).toFixed(1)} L ${PAD.x} ${(PAD.top + innerH).toFixed(1)} Z`;

  // points[0] is the synthetic 0% origin (date: null) — skip it for labels
  const firstRealDate = points.find((p) => p.date)?.date ?? null;
  const lastDate = points[points.length - 1].date;
  const lastAccuracy = Math.round(points[points.length - 1].accuracy * 100);

  return (
    <div className="card">
      <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-tertiary)' }}>
        Точность прогнозов
      </p>

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          preserveAspectRatio="none"
          style={{ height: H, display: 'block' }}
        >
          <defs>
            <linearGradient id="ac-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.18" />
              <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* 50% and 75% guide lines */}
          {[0.5, 0.75].map((level) => {
            const y = PAD.top + (1 - level) * innerH;
            return (
              <line
                key={level}
                x1={PAD.x} y1={y}
                x2={W - PAD.x} y2={y}
                stroke="var(--color-border)"
                strokeWidth="0.5"
                strokeDasharray="3 3"
              />
            );
          })}

          {/* Area fill */}
          <path d={areaPath} fill="url(#ac-fill)" />

          {/* Line */}
          <motion.path
            d={linePath}
            stroke="var(--color-accent)"
            strokeWidth="1.8"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />

          {/* Dots — only last and every 5th to avoid clutter */}
          {points.map((_p, i) => {
            const isLast = i === points.length - 1;
            const show = isLast || i === 0 || i % 5 === 0;
            if (!show) return null;
            return (
              <circle
                key={i}
                cx={xs[i]}
                cy={ys[i]}
                r={isLast ? 4 : 2.5}
                fill="var(--color-accent)"
              />
            );
          })}
        </svg>

        {/* Date labels — skip the synthetic null origin point */}
        <div className="flex justify-between mt-1">
          <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
            {firstRealDate ? formatDateShortRu(firstRealDate) : ''}
          </span>
          <span className="text-xs font-medium" style={{ color: 'var(--color-accent)' }}>
            {trendCfg.label && <span style={{ color: trendCfg.color }}>{trendCfg.label} </span>}
            Сейчас {lastAccuracy}%
          </span>
          <span className="text-xs" style={{ color: 'var(--color-text-tertiary)' }}>
            {lastDate ? formatDateShortRu(lastDate) : ''}
          </span>
        </div>
      </div>
    </div>
  );
}
