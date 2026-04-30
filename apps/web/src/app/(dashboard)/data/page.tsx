'use client';

import { useState } from 'react';
import { apiJson, buildApiUrl } from '@/lib/api';

interface DataPoint {
  time: string;
  deviceId: string;
  metricName: string;
  avg?: number;
  count: number;
}

export default function DataQueryPage() {
  const [deviceIds, setDeviceIds] = useState('');
  const [metricName, setMetricName] = useState('temperature');
  const [granularity, setGranularity] = useState('1h');
  const [aggregation, setAggregation] = useState('avg');
  const [hours, setHours] = useState('24');
  const [data, setData] = useState<DataPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleQuery(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    const end = new Date().toISOString();
    const start = new Date(Date.now() - Number(hours) * 3600000).toISOString();

    try {
      const q = new URLSearchParams({
        deviceIds,
        startTime: start,
        endTime: end,
        granularity,
        aggregation,
      });
      if (metricName) q.set('metricNames', metricName);

      const json = await apiJson<DataPoint[]>(`/data/query?${q}`);

      if (json.code === 0) {
        setData(json.data || []);
      } else {
        setError(json.message);
      }
    } catch {
      setError('Query failed — is the API server running?');
    } finally {
      setLoading(false);
    }
  }

  function handleExport() {
    const end = new Date().toISOString();
    const start = new Date(Date.now() - Number(hours) * 3600000).toISOString();
    const q = new URLSearchParams({
      deviceIds, startTime: start, endTime: end, format: 'csv',
    });
    if (metricName) q.set('metricNames', metricName);
    window.open(buildApiUrl(`/data/export?${q}`), '_blank');
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">数据查询</h1>
      </div>

      {/* Query form */}
      <div className="card">
        <form onSubmit={handleQuery} style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">设备 ID (逗号分隔)</label>
            <input
              className="form-input"
              style={{ width: 280 }}
              value={deviceIds}
              onChange={(e) => setDeviceIds(e.target.value)}
              placeholder="00000000-0000-0000-0000-000000000100"
              required
            />
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">指标</label>
            <select className="form-select" value={metricName} onChange={(e) => setMetricName(e.target.value)}>
              <option value="temperature">temperature</option>
              <option value="humidity">humidity</option>
              <option value="pressure">pressure</option>
              <option value="vibration">vibration</option>
            </select>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">聚合</label>
            <select className="form-select" value={aggregation} onChange={(e) => setAggregation(e.target.value)}>
              <option value="avg">avg</option>
              <option value="sum">sum</option>
              <option value="max">max</option>
              <option value="min">min</option>
              <option value="count">count</option>
            </select>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">粒度</label>
            <select className="form-select" value={granularity} onChange={(e) => setGranularity(e.target.value)}>
              <option value="1m">1 分钟</option>
              <option value="5m">5 分钟</option>
              <option value="1h">1 小时</option>
              <option value="1d">1 天</option>
            </select>
          </div>
          <div className="form-group" style={{ margin: 0 }}>
            <label className="form-label">时间范围</label>
            <select className="form-select" value={hours} onChange={(e) => setHours(e.target.value)}>
              <option value="1">最近 1 小时</option>
              <option value="6">最近 6 小时</option>
              <option value="24">最近 24 小时</option>
              <option value="168">最近 7 天</option>
              <option value="720">最近 30 天</option>
            </select>
          </div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? '查询中...' : '查询'}
          </button>
          <button type="button" className="btn" onClick={handleExport} disabled={data.length === 0}>
            导出 CSV
          </button>
        </form>
      </div>

      {error && (
        <div className="card" style={{ borderColor: 'var(--color-error)' }}>
          <p style={{ color: 'var(--color-error)' }}>{error}</p>
        </div>
      )}

      {/* Results table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="loading">查询中...</div>
        ) : data.length === 0 ? (
          <div className="loading">暂无数据，请调整查询条件</div>
        ) : (
          <div>
            <table className="data-table">
              <thead>
                <tr>
                  <th>时间</th>
                  <th>设备</th>
                  <th>指标</th>
                  <th>值 ({aggregation})</th>
                  <th>样本数</th>
                </tr>
              </thead>
              <tbody>
                {data.slice(0, 50).map((d, i) => (
                  <tr key={i}>
                    <td>{new Date(d.time).toLocaleString()}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{d.deviceId.slice(0, 8)}...</td>
                    <td>{d.metricName}</td>
                    <td>{(d.avg ?? 0).toFixed(2)}</td>
                    <td>{d.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.length > 50 && (
              <p style={{ textAlign: 'center', padding: 12, color: 'var(--color-text-secondary)', fontSize: 13 }}>
                显示前 50 条，共 {data.length} 条
              </p>
            )}
          </div>
        )}
      </div>

      {/* Simple chart using CSS bars */}
      {data.length > 0 && (
        <div className="card">
          <div className="card-title">趋势图</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 200, padding: '20px 0' }}>
            {data.slice(0, 60).map((d, i) => {
              const maxVal = Math.max(...data.map((x) => x.avg ?? 0));
              const h = maxVal > 0 ? ((d.avg ?? 0) / maxVal) * 160 : 0;
              return (
                <div
                  key={i}
                  title={`${new Date(d.time).toLocaleString()}: ${(d.avg ?? 0).toFixed(2)}`}
                  style={{
                    flex: 1,
                    height: `${Math.max(h, 2)}px`,
                    background: 'var(--color-primary)',
                    borderRadius: '2px 2px 0 0',
                    opacity: 0.7 + (h / 160) * 0.3,
                    minWidth: 4,
                  }}
                />
              );
            })}
          </div>
          <p style={{ fontSize: 12, color: 'var(--color-text-secondary)', textAlign: 'center' }}>
            时间 → (每列 = 1 个时间点)
          </p>
        </div>
      )}
    </div>
  );
}
