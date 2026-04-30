'use client';

interface GaugeChartProps {
  title?: string;
  value: number;
  unit?: string;
  min?: number;
  max?: number;
  thresholds?: { warn: number; critical: number };
  height?: number;
}

/**
 * Gauge chart — displays a single value with color thresholds.
 */
export function GaugeChart({
  title, value, unit = '', min = 0, max = 100,
  thresholds = { warn: 60, critical: 80 },
  height = 150,
}: GaugeChartProps) {
  const pct = Math.min(100, Math.max(0, ((value - min) / (max - min)) * 100));

  const color = pct >= thresholds.critical
    ? 'var(--color-error)'
    : pct >= thresholds.warn
      ? 'var(--color-warning)'
      : 'var(--color-success)';

  const angle = (pct / 100) * 180;

  return (
    <div style={{ textAlign: 'center' }}>
      {title && <div className="card-title" style={{ marginBottom: 8, textAlign: 'center' }}>{title}</div>}

      <svg width="200" height={height} viewBox="0 0 200 130" style={{ display: 'inline-block' }}>
        {/* Background arc */}
        <path
          d="M 20 110 A 80 80 0 0 1 180 110"
          fill="none"
          stroke="#e2e8f0"
          strokeWidth="12"
          strokeLinecap="round"
        />
        {/* Value arc */}
        <path
          d="M 20 110 A 80 80 0 0 1 180 110"
          fill="none"
          stroke={color}
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${(pct / 100) * 251} 251`}
          style={{ transition: 'stroke-dasharray 0.5s' }}
        />
        {/* Value text */}
        <text x="100" y="80" textAnchor="middle" fontSize="28" fontWeight="700" fill="var(--color-text)">
          {value.toFixed(1)}
        </text>
        <text x="100" y="100" textAnchor="middle" fontSize="12" fill="var(--color-text-secondary)">
          {unit}
        </text>
      </svg>

      {/* Threshold indicators */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 4, fontSize: 11, color: 'var(--color-text-secondary)' }}>
        <span>● 良好</span>
        <span style={{ color: 'var(--color-warning)' }}>● 警告 ({thresholds.warn})</span>
        <span style={{ color: 'var(--color-error)' }}>● 危险 ({thresholds.critical})</span>
      </div>
    </div>
  );
}
