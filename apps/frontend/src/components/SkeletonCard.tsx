/**
 * Skeleton loading states — used when data is loading for the first time.
 * Maintains layout stability and reduces perceived wait time.
 */

function SkeletonPulse({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`rounded-xl animate-pulse ${className ?? ''}`}
      style={{ background: 'rgba(0,0,0,0.06)', ...style }}
      aria-hidden="true"
    />
  );
}

/** Skeleton for a single prediction card */
export function SkeletonPredictionCard() {
  return (
    <div className="card pl-5" aria-hidden="true">
      <div className="flex items-start gap-3">
        <SkeletonPulse style={{ width: 32, height: 32, borderRadius: 12, flexShrink: 0 }} />
        <div className="flex-1 flex flex-col gap-2">
          <SkeletonPulse style={{ height: 10, width: '40%' }} />
          <SkeletonPulse style={{ height: 14, width: '90%' }} />
          <SkeletonPulse style={{ height: 14, width: '70%' }} />
        </div>
      </div>
    </div>
  );
}

/** Skeleton for a checkin page before user data loads */
export function SkeletonCheckin() {
  return (
    <div className="page" aria-label="Загрузка..." aria-busy="true">
      <div className="mb-6 flex flex-col gap-2">
        <SkeletonPulse style={{ height: 12, width: 120 }} />
        <SkeletonPulse style={{ height: 28, width: 200 }} />
      </div>
      <div className="flex flex-col gap-5">
        <div className="card flex flex-col gap-3">
          <SkeletonPulse style={{ height: 16, width: 120 }} />
          <div className="flex gap-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <SkeletonPulse key={i} style={{ flex: 1, height: 68, borderRadius: 16 }} />
            ))}
          </div>
        </div>
        <div className="card flex flex-col gap-3">
          <SkeletonPulse style={{ height: 16, width: 160 }} />
          <div className="grid grid-cols-3 gap-2">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <SkeletonPulse key={i} style={{ height: 42, borderRadius: 12 }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/** Skeleton for history list items */
export function SkeletonHistoryItem() {
  return (
    <div className="card" aria-hidden="true">
      <div className="flex items-center gap-3">
        <SkeletonPulse style={{ width: 28, height: 28, borderRadius: 999 }} />
        <div className="flex-1 flex flex-col gap-1.5">
          <SkeletonPulse style={{ height: 14, width: '60%' }} />
          <SkeletonPulse style={{ height: 11, width: '35%' }} />
        </div>
        <SkeletonPulse style={{ width: 28, height: 14 }} />
      </div>
    </div>
  );
}
