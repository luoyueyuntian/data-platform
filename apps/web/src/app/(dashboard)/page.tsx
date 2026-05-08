'use client';

import { useEffect, useState } from 'react';
import { apiJson } from '@/lib/api';

interface EntityStats {
  total: number;
  byStatus: Record<string, number>;
  byType: Record<string, number>;
}

export default function HomePage() {
  const [stats, setStats] = useState<EntityStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiJson<EntityStats>('/entities/stats')
      .then((res) => {
        if (res.code === 0) setStats(res.data ?? null);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">总览</h1>
      </div>

      <div className="grid-4" style={{ marginBottom: 24 }}>
        <div className="card stat-card">
          <div className="stat-value">{loading ? '...' : stats?.total ?? 0}</div>
          <div className="stat-label">实体总数</div>
        </div>
        <div className="card stat-card">
          <div className="stat-value" style={{ color: 'var(--color-success)' }}>
            {loading ? '...' : stats?.byStatus?.active ?? 0}
          </div>
          <div className="stat-label">活跃实体</div>
        </div>
        <div className="card stat-card">
          <div className="stat-value" style={{ color: 'var(--color-warning)' }}>
            {loading ? '...' : stats?.byStatus?.error ?? 0}
          </div>
          <div className="stat-label">异常实体</div>
        </div>
        <div className="card stat-card">
          <div className="stat-value">{loading ? '...' : Object.keys(stats?.byType ?? {}).length}</div>
          <div className="stat-label">实体类型</div>
        </div>
      </div>

      <div className="grid-3">
        <a href="/devices" className="card" style={{ textDecoration: 'none', display: 'block' }}>
          <div className="card-title">📡 实体管理</div>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>
            注册、配置和管理您的实体
          </p>
        </a>
        <a href="/data" className="card" style={{ textDecoration: 'none', display: 'block' }}>
          <div className="card-title">📈 事件查询</div>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>
            查看实体实时数据和历史趋势
          </p>
        </a>
        <a href="/alerts" className="card" style={{ textDecoration: 'none', display: 'block' }}>
          <div className="card-title">🔔 告警管理</div>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>
            配置告警规则，实时监控实体状态
          </p>
        </a>
      </div>
    </div>
  );
}
