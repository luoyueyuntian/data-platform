'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { LineChart, GaugeChart, StatCard } from '@ssas/ui';
import { apiFetch, apiJson } from '@/lib/api';

interface PanelQuery {
  metricNames: string[];
  aggregation: string;
  granularity: string;
  timeRange: string;
}

interface Panel {
  id: string;
  title: string;
  type: string;
  query: PanelQuery;
  position: { x: number; y: number; w: number; h: number };
}

interface Dashboard {
  id: string;
  name: string;
  description: string | null;
  panels: Panel[];
}

type ChartType = 'line' | 'bar' | 'pie' | 'gauge' | 'table' | 'stat' | 'area';

export default function DashboardDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAddPanel, setShowAddPanel] = useState(false);

  const loadDashboard = useCallback(async () => {
    try {
      const json = await apiJson<Dashboard>(`/dashboards/${id}`);
      if (json.code === 0) setDashboard(json.data ?? null);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  if (loading) return <div className="loading">加载中...</div>;
  if (!dashboard) return <div className="loading">看板未找到</div>;

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{dashboard.name}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={() => setShowAddPanel(true)}>+ 添加面板</button>
          <button className="btn" onClick={() => window.location.reload()}>刷新数据</button>
        </div>
      </div>

      {showAddPanel && (
        <AddPanelForm
          dashboardId={dashboard.id}
          onClose={() => setShowAddPanel(false)}
          onAdded={() => { setShowAddPanel(false); loadDashboard(); }}
        />
      )}

      {dashboard.panels.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 60 }}>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 12, fontSize: 16 }}>此看板暂无面板</p>
          <button className="btn btn-primary" onClick={() => setShowAddPanel(true)}>+ 添加第一个面板</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          {dashboard.panels.map((panel) => (
            <PanelCard key={panel.id} panel={panel} dashboardId={dashboard.id} onDeleted={loadDashboard} />
          ))}
        </div>
      )}
    </div>
  );
}

// ======================
// Panel Card
// ======================

function PanelCard({ panel, dashboardId, onDeleted }: { panel: Panel; dashboardId: string; onDeleted: () => void }) {
  const [data, setData] = useState<Array<{ time: string; avg?: number }>>([]);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [latest, setLatest] = useState<Array<{ metricName: string; last: number }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const now = new Date();
        const start = new Date(now.getTime() - parseTimeRange(panel.query.timeRange));
        const metricNames = panel.query.metricNames.join(',');

        const q = new URLSearchParams({
          deviceIds: '*',
          metricNames,
          startTime: start.toISOString(),
          endTime: now.toISOString(),
          granularity: panel.query.granularity || '1h',
          aggregation: panel.query.aggregation || 'avg',
        });

        const json = await apiJson<Array<{ time: string; avg?: number }>>(`/data/query?${q}`);
        if (json.code === 0) setData(json.data || []);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [panel]);

  const series = panel.query.metricNames.map((mn) => ({
    name: mn,
    data: data.filter((d) => d.avg !== undefined).map((d) => ({ time: d.time, value: d.avg ?? 0 })),
  }));

  return (
    <div className="card" style={{ padding: panel.type === 'stat' ? 16 : 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className="card-title">{panel.title}</div>
        <button className="btn btn-sm" style={{ color: 'var(--color-error)', border: 'none' }}
          onClick={async () => {
            if (confirm('确定删除此面板？')) {
              await apiFetch(`/dashboards/${dashboardId}/panels/${panel.id}`, { method: 'DELETE' });
              onDeleted();
            }
          }}
        >✕</button>
      </div>

      {panel.type === 'line' || panel.type === 'area' ? (
        <LineChart series={series} loading={loading} height={panel.position.h * 60} />
      ) : panel.type === 'gauge' ? (
        <GaugeChart value={latest[0]?.last ?? 0} height={panel.position.h * 50} />
      ) : panel.type === 'stat' ? (
        <StatCard title={panel.query.metricNames.join(', ')} value={latest[0]?.last?.toFixed(2) ?? '—'}
          subtitle={`${panel.query.aggregation} · ${panel.query.granularity}`} />
      ) : (
        <LineChart series={series} loading={loading} height={200} />
      )}
    </div>
  );
}

// ======================
// Add Panel Form
// ======================

function AddPanelForm({ dashboardId, onClose, onAdded }: {
  dashboardId: string; onClose: () => void; onAdded: () => void;
}) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState<ChartType>('line');
  const [metricNames, setMetricNames] = useState('temperature');
  const [aggregation, setAggregation] = useState('avg');
  const [granularity, setGranularity] = useState('1h');
  const [timeRange, setTimeRange] = useState('last_24h');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    try {
      const query = { metricNames: metricNames.split(',').map((s) => s.trim()), aggregation, granularity, timeRange };
      const json = await apiJson(`/dashboards/${dashboardId}/panels`, {
        method: 'POST',
        body: JSON.stringify({ title, type, query, position: { x: 0, y: 0, w: type === 'stat' ? 1 : 2, h: type === 'stat' ? 1 : 2 } }),
      });
      if (json.code === 0) onAdded();
    } catch (err) { console.error(err); } finally { setSaving(false); }
  }

  return (
    <div className="card" style={{ marginBottom: 16, borderColor: 'var(--color-primary)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600 }}>添加面板</h3>
        <button className="btn btn-sm" onClick={onClose}>取消</button>
      </div>
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
          <div className="form-group"><label className="form-label">标题</label>
            <input className="form-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="温度趋势" required /></div>
          <div className="form-group"><label className="form-label">图表类型</label>
            <select className="form-select" value={type} onChange={(e) => setType(e.target.value as ChartType)}>
              <option value="line">折线图</option><option value="area">面积图</option>
              <option value="gauge">仪表盘</option><option value="stat">统计数值</option>
            </select></div>
          <div className="form-group"><label className="form-label">指标</label>
            <input className="form-input" value={metricNames} onChange={(e) => setMetricNames(e.target.value)} placeholder="temperature,humidity" /></div>
          <div className="form-group"><label className="form-label">聚合</label>
            <select className="form-select" value={aggregation} onChange={(e) => setAggregation(e.target.value)}>
              <option value="avg">avg</option><option value="max">max</option><option value="min">min</option></select></div>
          <div className="form-group"><label className="form-label">粒度</label>
            <select className="form-select" value={granularity} onChange={(e) => setGranularity(e.target.value)}>
              <option value="1m">1分钟</option><option value="5m">5分钟</option><option value="1h">1小时</option></select></div>
          <div className="form-group"><label className="form-label">时间</label>
            <select className="form-select" value={timeRange} onChange={(e) => setTimeRange(e.target.value)}>
              <option value="last_1h">1小时</option><option value="last_6h">6小时</option>
              <option value="last_24h">24小时</option><option value="last_7d">7天</option></select></div>
        </div>
        <button type="submit" className="btn btn-primary" disabled={saving} style={{ marginTop: 12 }}>
          {saving ? '保存中...' : '添加面板'}
        </button>
      </form>
    </div>
  );
}

function parseTimeRange(range: string): number {
  switch (range) {
    case 'last_1h': return 3600000;
    case 'last_6h': return 21600000;
    case 'last_24h': return 86400000;
    case 'last_7d': return 604800000;
    case 'last_30d': return 2592000000;
    default: return 86400000;
  }
}
