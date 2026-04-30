'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiJson } from '@/lib/api';

interface DashboardItem {
  id: string;
  name: string;
  description: string | null;
  _count: { panels: number };
  updatedAt: string;
}

export default function DashboardsPage() {
  const [dashboards, setDashboards] = useState<DashboardItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');

  async function loadDashboards() {
    setLoading(true);
    try {
      const json = await apiJson<DashboardItem[]>('/dashboards');
      if (json.code === 0) setDashboards(json.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadDashboards(); }, []);

  async function handleCreate() {
    if (!newName.trim()) return;
    try {
      const json = await apiJson('/dashboards', {
        method: 'POST',
        body: JSON.stringify({ name: newName }),
      });
      if (json.code === 0) {
        setShowCreate(false);
        setNewName('');
        loadDashboards();
      }
    } catch (err) {
      console.error(err);
    }
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">可视化看板</h1>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ 创建看板</button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="card">
          <div className="form-group">
            <label className="form-label">看板名称</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                className="form-input"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="My Dashboard"
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
              />
              <button className="btn btn-primary" onClick={handleCreate}>创建</button>
              <button className="btn" onClick={() => setShowCreate(false)}>取消</button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading">加载中...</div>
      ) : dashboards.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 12 }}>暂无看板</p>
          <p style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>点击"创建看板"开始构建您的第一个可视化仪表盘</p>
        </div>
      ) : (
        <div className="grid-3">
          {dashboards.map((d) => (
            <Link
              key={d.id}
              href={`/dashboards/${d.id}`}
              className="card"
              style={{ textDecoration: 'none', display: 'block' }}
            >
              <div className="card-title">{d.name}</div>
              {d.description && <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 8 }}>{d.description}</p>}
              <div style={{ display: 'flex', gap: 16, fontSize: 13, color: 'var(--color-text-secondary)' }}>
                <span>{d._count.panels} 个面板</span>
                <span>{new Date(d.updatedAt).toLocaleDateString()}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
