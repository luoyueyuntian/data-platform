'use client';

interface StatCardProps {
  title: string;
  value: string | number;
  unit?: string;
  subtitle?: string;
  trend?: { value: number; positive?: boolean };
  color?: string;
}

/**
 * Stat card — single number display with optional trend indicator.
 */
export function StatCard({ title, value, unit, subtitle, trend, color }: StatCardProps) {
  return (
    <div style={{ textAlign: 'center', padding: 16 }}>
      <div className="card-title" style={{ marginBottom: 8, textAlign: 'center' }}>{title}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: color || 'var(--color-text)' }}>
        {value}
        {unit && <span style={{ fontSize: 14, fontWeight: 400, color: 'var(--color-text-secondary)', marginLeft: 4 }}>{unit}</span>}
      </div>
      {subtitle && (
        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4 }}>{subtitle}</div>
      )}
      {trend && (
        <div style={{
          fontSize: 12, marginTop: 4,
          color: trend.positive ? 'var(--color-success)' : 'var(--color-error)',
        }}>
          {trend.positive ? '↑' : '↓'} {Math.abs(trend.value).toFixed(1)}%
        </div>
      )}
    </div>
  );
}
