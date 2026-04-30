'use client';

import { useEffect, useRef } from 'react';

interface DataSeries {
  name: string;
  data: Array<{ time: string; value: number }>;
}

interface LineChartProps {
  title?: string;
  series: DataSeries[];
  loading?: boolean;
  height?: number;
  xLabel?: string;
  yLabel?: string;
}

/**
 * Line chart component — rendered with pure CSS/SVG (no ECharts dependency needed at runtime).
 * Replace with echarts-for-react when ECharts is properly installed.
 */
export function LineChart({ title, series, loading, height = 250, xLabel, yLabel }: LineChartProps) {
  if (loading) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)', fontSize: 14 }}>
        加载中...
      </div>
    );
  }

  if (!series.length || series.every((s) => s.data.length === 0)) {
    return (
      <div style={{ height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)', fontSize: 14 }}>
        暂无数据
      </div>
    );
  }

  // Find global min/max for scaling
  const allValues = series.flatMap((s) => s.data.map((d) => d.value));
  const minVal = Math.min(...allValues);
  const maxVal = Math.max(...allValues);
  const range = maxVal - minVal || 1;
  const padding = range * 0.1;

  // Collect all time points
  const allTimes = [...new Set(series.flatMap((s) => s.data.map((d) => d.time)))].sort();
  const maxPoints = Math.min(allTimes.length, 100);

  // Sample if too many points
  const step = Math.max(1, Math.floor(allTimes.length / maxPoints));
  const sampledTimes = allTimes.filter((_, i) => i % step === 0).slice(-maxPoints);

  // Color palette
  const colors = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#06b6d4'];

  return (
    <div>
      {title && <div className="card-title" style={{ marginBottom: 12 }}>{title}</div>}
      <svg width="100%" height={height} viewBox={`0 0 ${sampledTimes.length * 10} ${height}`} preserveAspectRatio="xMidYMid meet">
        {series.map((s, si) => {
          const color = colors[si % colors.length];
          const dataMap = new Map(s.data.map((d) => [d.time, d.value]));
          const points = sampledTimes
            .map((t, i) => {
              const val = dataMap.get(t);
              if (val === undefined) return null;
              const x = i * 10;
              const y = height - 20 - ((val - minVal + padding) / (range + 2 * padding)) * (height - 40);
              return `${x},${y}`;
            })
            .filter(Boolean);

          if (points.length < 2) return null;

          return (
            <g key={s.name}>
              {/* Line */}
              <polyline
                points={points.join(' ')}
                fill="none"
                stroke={color}
                strokeWidth="2"
                strokeLinejoin="round"
              />
              {/* Dots */}
              {points.map((p, i) => {
                const [x, y] = p!.split(',');
                return <circle key={i} cx={x} cy={y} r="3" fill={color} />;
              })}
            </g>
          );
        })}
      </svg>

      {/* Legend */}
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 8, flexWrap: 'wrap' }}>
        {series.map((s, i) => (
          <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: colors[i % colors.length], display: 'inline-block' }} />
            {s.name}
          </div>
        ))}
      </div>
    </div>
  );
}
