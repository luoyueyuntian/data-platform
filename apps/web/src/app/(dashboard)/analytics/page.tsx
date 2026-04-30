'use client';

import { useState } from 'react';
import { LineChart, StatCard } from '@ssas/ui';
import { apiJson } from '@/lib/api';

type AnalysisMode = 'event' | 'trend' | 'distribution' | 'funnel' | 'retention' | 'attribution';

export default function AnalyticsPage() {
  const [mode, setMode] = useState<AnalysisMode>('event');
  const [metricName, setMetricName] = useState('temperature');
  const [aggregation, setAggregation] = useState('avg');
  const [granularity, setGranularity] = useState('1h');
  const [hours, setHours] = useState('24');
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Funnel-specific params
  const [funnelSteps, setFunnelSteps] = useState('temperature\npressure\nhumidity');
  // Attribution-specific params
  const [targetMetric, setTargetMetric] = useState('alarm');
  const [sourceMetrics, setSourceMetrics] = useState('temperature,pressure');
  const [attributionModel, setAttributionModel] = useState('last');
  // Retention-specific params
  const [returnMetric, setReturnMetric] = useState('temperature');
  const [period, setPeriod] = useState('day');

  const modes: Array<{ id: AnalysisMode; label: string }> = [
    { id: 'event', label: '事件分析' },
    { id: 'trend', label: '趋势分析' },
    { id: 'distribution', label: '分布分析' },
    { id: 'funnel', label: '漏斗分析' },
    { id: 'retention', label: '留存分析' },
    { id: 'attribution', label: '归因分析' },
  ];

  async function handleQuery() {
    setLoading(true);
    setError('');
    setResult(null);

    const timeRange = {
      start: new Date(Date.now() - Number(hours) * 3600000).toISOString(),
      end: new Date().toISOString(),
    };

    try {
      let path: string;
      let body: unknown;

      switch (mode) {
        case 'event':
          path = '/api/v1/analytics/event';
          body = { metricName, aggregation, granularity, timeRange };
          break;
        case 'trend':
          path = '/api/v1/analytics/trend';
          body = { metricName, aggregation, granularity, timeRange, compareWith: 'prev_period' };
          break;
        case 'distribution':
          path = '/api/v1/analytics/distribution';
          body = { metricName, timeRange };
          break;
        case 'funnel':
          path = '/api/v1/analytics/funnel';
          body = {
            steps: funnelSteps.split('\n').filter(Boolean).map((s, i) => ({
              name: `Step ${i + 1}`, metricName: s.trim(),
            })),
            windowSeconds: 3600,
            timeRange,
          };
          break;
        case 'retention':
          path = '/api/v1/analytics/retention';
          body = { initialMetric: metricName, returnMetric, period, timeRange };
          break;
        case 'attribution':
          path = '/api/v1/analytics/attribution';
          body = {
            targetMetric,
            attributionMetrics: sourceMetrics.split(',').map((s) => s.trim()),
            lookbackSeconds: 3600,
            model: attributionModel,
            timeRange,
          };
          break;
      }

      const json = await apiJson(path!, {
        method: 'POST',
        body: JSON.stringify(body),
      });

      if (json.code === 0) {
        setResult(json.data);
      } else {
        setError(json.message || 'Query failed');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">分析模型</h1>
      </div>

      {/* Mode selector */}
      <div className="card">
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {modes.map((m) => (
            <button key={m.id} className={`btn ${mode === m.id ? 'btn-primary' : ''}`} onClick={() => setMode(m.id)}>
              {m.label}
            </button>
          ))}
        </div>

        {/* Parameters */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
          <div className="form-group">
            <label className="form-label">指标</label>
            <input className="form-input" value={metricName} onChange={(e) => setMetricName(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">聚合</label>
            <select className="form-select" value={aggregation} onChange={(e) => setAggregation(e.target.value)}>
              <option value="avg">avg</option><option value="sum">sum</option>
              <option value="max">max</option><option value="min">min</option><option value="count">count</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">粒度</label>
            <select className="form-select" value={granularity} onChange={(e) => setGranularity(e.target.value)}>
              <option value="1m">1分钟</option><option value="5m">5分钟</option>
              <option value="1h">1小时</option><option value="1d">1天</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">时间范围</label>
            <select className="form-select" value={hours} onChange={(e) => setHours(e.target.value)}>
              <option value="1">1小时</option><option value="6">6小时</option>
              <option value="24">24小时</option><option value="168">7天</option>
              <option value="720">30天</option>
            </select>
          </div>

          {/* Mode-specific params */}
          {mode === 'funnel' && (
            <div className="form-group" style={{ gridColumn: 'span 2' }}>
              <label className="form-label">漏斗步骤 (每行一个 metric)</label>
              <textarea className="form-input" rows={3} value={funnelSteps} onChange={(e) => setFunnelSteps(e.target.value)} />
            </div>
          )}
          {mode === 'retention' && (
            <>
              <div className="form-group">
                <label className="form-label">回访指标</label>
                <input className="form-input" value={returnMetric} onChange={(e) => setReturnMetric(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">周期</label>
                <select className="form-select" value={period} onChange={(e) => setPeriod(e.target.value)}>
                  <option value="day">天</option><option value="week">周</option><option value="month">月</option>
                </select>
              </div>
            </>
          )}
          {mode === 'attribution' && (
            <>
              <div className="form-group">
                <label className="form-label">目标指标</label>
                <input className="form-input" value={targetMetric} onChange={(e) => setTargetMetric(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">来源指标 (逗号分隔)</label>
                <input className="form-input" value={sourceMetrics} onChange={(e) => setSourceMetrics(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">归因模型</label>
                <select className="form-select" value={attributionModel} onChange={(e) => setAttributionModel(e.target.value)}>
                  <option value="first">首次触点</option><option value="last">末次触点</option>
                  <option value="linear">线性归因</option><option value="position">位置归因</option>
                  <option value="time_decay">时间衰减</option>
                </select>
              </div>
            </>
          )}
        </div>

        <button className="btn btn-primary" onClick={handleQuery} disabled={loading}>
          {loading ? '查询中...' : '执行查询'}
        </button>
      </div>

      {/* Error */}
      {error && <div className="card" style={{ borderColor: 'var(--color-error)' }}><p style={{ color: 'var(--color-error)' }}>{error}</p></div>}

      {/* Results */}
      {result && (
        <ResultDisplay mode={mode} data={result} metricName={metricName} />
      )}
    </div>
  );
}

// ======================
// Result Display
// ======================

function ResultDisplay({ mode, data, metricName }: { mode: AnalysisMode; data: any; metricName: string }) {
  // Event analysis: show line chart
  if (mode === 'event' && data.series) {
    const seriesData = {
      name: metricName,
      data: (data.series as Array<{ time: string; avg?: number }>).map((d) => ({
        time: d.time, value: d.avg ?? 0,
      })),
    };
    return (
      <div className="card">
        <LineChart title={`${metricName} (${data.aggregation || 'avg'})`} series={[seriesData]} />
        <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', textAlign: 'center', marginTop: 8 }}>
          共 {data.total} 个数据点
        </p>
      </div>
    );
  }

  // Trend: show comparison
  if (mode === 'trend' && data.current) {
    const currentSeries = { name: '当前', data: (data.current as Array<{ time: string; avg?: number }>).map((d) => ({
      time: d.time, value: d.avg ?? 0,
    })) };
    const previousSeries = { name: '上一期', data: (data.previous as Array<{ time: string; avg?: number }>).map((d) => ({
      time: d.time, value: d.avg ?? 0,
    })) };
    return (
      <div>
        <div className="card">
          <LineChart title="趋势对比" series={[currentSeries, previousSeries]} />
        </div>
        <div className="grid-3">
          <StatCard title="变化率" value={`${(data.changePercent ?? 0).toFixed(1)}%`}
            trend={{ value: data.changePercent ?? 0, positive: (data.changePercent ?? 0) >= 0 }} />
          <StatCard title="当前均值" value={average(currentSeries.data).toFixed(2)} />
          <StatCard title="上期均值" value={average(previousSeries.data).toFixed(2)} />
        </div>
      </div>
    );
  }

  // Distribution
  if (mode === 'distribution' && data.buckets) {
    const barData = (data.buckets as Array<{ bucketMin: number; bucketMax: number; count: number }>).map((b) => ({
      label: `${b.bucketMin.toFixed(0)}-${b.bucketMax.toFixed(0)}`,
      count: b.count,
    }));
    return (
      <div className="card">
        <div className="card-title">分布 (共 {data.total} 条)</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 150, padding: '10px 0' }}>
          {barData.map((b, i) => {
            const maxCount = Math.max(...barData.map((x) => x.count));
            const h = maxCount > 0 ? (b.count / maxCount) * 130 : 0;
            return (
              <div key={i} style={{ flex: 1, textAlign: 'center' }}>
                <div style={{ fontSize: 10, color: 'var(--color-text-secondary)' }}>{b.count}</div>
                <div style={{ height: `${Math.max(h, 2)}px`, background: 'var(--color-primary)', borderRadius: '2px 2px 0 0', marginTop: 2 }} />
                <div style={{ fontSize: 9, color: 'var(--color-text-secondary)', marginTop: 4, transform: 'rotate(-45deg)', whiteSpace: 'nowrap' }}>{b.label}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Funnel
  if (mode === 'funnel' && data.steps) {
    const steps = data.steps as Array<{ name: string; deviceCount: number; conversionRate: number; dropRate: number }>;
    const maxCount = Math.max(...steps.map((s) => s.deviceCount));
    return (
      <div className="card">
        <div className="card-title">漏斗转化</div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '20px 0' }}>
          {steps.map((s, i) => {
            const widthPct = maxCount > 0 ? (s.deviceCount / maxCount) * 100 : 0;
            return (
              <div key={i} style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{
                  width: `${Math.max(widthPct, 10)}%`, background: 'var(--color-primary)',
                  padding: '8px 16px', borderRadius: 8, textAlign: 'center', color: 'white', fontSize: 13,
                  opacity: i === 0 ? 1 : 0.9 - i * 0.12,
                }}>
                  {s.name}: {s.deviceCount} 台 ({s.conversionRate}%)
                </div>
                {i < steps.length - 1 && (
                  <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', padding: '2px 0' }}>
                    流失 {s.dropRate}%
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', textAlign: 'center' }}>
          整体转化率: {data.overallConversion ?? 0}%
        </p>
      </div>
    );
  }

  // Retention
  if (mode === 'retention' && data.periods) {
    const periods = data.periods as Array<{ period: number; label: string; retentionRate: number }>;
    return (
      <div className="card">
        <div className="card-title">留存分析 — 共 {data.totalCohort} 台设备</div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 150, padding: '10px 0' }}>
          {periods.map((p, i) => (
            <div key={i} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: 'var(--color-text-secondary)' }}>{p.retentionRate}%</div>
              <div style={{
                height: `${p.retentionRate * 1.5}px`,
                background: p.retentionRate > 50 ? 'var(--color-success)' : p.retentionRate > 20 ? 'var(--color-warning)' : 'var(--color-error)',
                borderRadius: '2px 2px 0 0',
                marginTop: 2,
              }} />
              <div style={{ fontSize: 9, color: 'var(--color-text-secondary)', marginTop: 4 }}>{p.label}</div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // Attribution
  if (mode === 'attribution' && data.contributions) {
    const maxWeight = Math.max(...data.contributions.map((c: any) => c.weight));
    return (
      <div className="card">
        <div className="card-title">归因分析 — {data.model} 模型</div>
        <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 12 }}>
          目标指标: {data.targetMetric} · 总事件: {data.totalTargetEvents || 0}
        </p>
        {(data.contributions as Array<{ sourceMetric: string; weight: number; cooccurrenceCount: number }>).map((c, i) => (
          <div key={i} style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 2 }}>
              <span>{c.sourceMetric}</span>
              <span>{(c.weight * 100).toFixed(1)}% (共现 {c.cooccurrenceCount} 次)</span>
            </div>
            <div style={{ height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                height: '100%',
                width: `${(c.weight / (maxWeight || 1)) * 100}%`,
                background: 'var(--color-primary)',
                borderRadius: 4,
              }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Fallback: JSON display
  return (
    <div className="card">
      <div className="card-title">查询结果 (JSON)</div>
      <pre style={{ fontSize: 13, maxHeight: 400, overflow: 'auto' }}>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}

function average(data: Array<{ value: number }>): number {
  if (data.length === 0) return 0;
  return data.reduce((s, d) => s + d.value, 0) / data.length;
}
