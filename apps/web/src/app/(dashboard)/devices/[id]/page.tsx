'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiJson, type EntityDetail } from '@/lib/api';

export default function EntityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [entity, setEntity] = useState<EntityDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiJson<EntityDetail>(`/entities/${id}`)
      .then((res) => {
        if (res.code === 0) setEntity(res.data ?? null);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="loading">加载中...</div>;
  if (!entity) return <div className="loading">实体未找到</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{entity.name}</h1>
          <p style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--color-text-secondary)' }}>
            {entity.entityKey}
          </p>
        </div>
        <span className={`badge badge-${entity.status}`} style={{ fontSize: 14, padding: '4px 12px' }}>
          {entity.status}
        </span>
      </div>

      <div className="grid-2">
        {/* Entity Info */}
        <div className="card">
          <div className="card-title">基本信息</div>
          <table className="data-table">
            <tbody>
              <tr><td style={{ width: 120 }}>类型</td><td>{entity.type}</td></tr>
              <tr><td>阶段</td><td>{entity.phase}</td></tr>
              <tr><td>分组</td><td>{entity.group?.name || '—'}</td></tr>
              <tr><td>位置</td><td>{entity.location?.name as string || '—'}</td></tr>
              <tr><td>创建时间</td><td>{new Date(entity.createdAt).toLocaleString()}</td></tr>
              <tr><td>更新时间</td><td>{new Date(entity.updatedAt).toLocaleString()}</td></tr>
              <tr><td>最后在线</td><td>{entity.lastSeenAt ? new Date(entity.lastSeenAt).toLocaleString() : '从未上线'}</td></tr>
            </tbody>
          </table>
        </div>

        {/* Metadata */}
        <div className="card">
          <div className="card-title">元数据</div>
          {entity.metadata ? (
            <pre style={{ fontSize: 13, background: '#f8fafc', padding: 12, borderRadius: 8, overflow: 'auto' }}>
              {JSON.stringify(entity.metadata, null, 2)}
            </pre>
          ) : (
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>暂无元数据</p>
          )}
        </div>
      </div>

      {/* Tags */}
      <div className="card">
        <div className="card-title">标签 ({entity.tags.length})</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {entity.tags.map((t) => (
            <span key={t.id} className="badge badge-active" style={{ fontSize: 13, padding: '4px 10px' }}>
              {t.key}: {t.value}
            </span>
          ))}
          {entity.tags.length === 0 && (
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>暂无标签</p>
          )}
        </div>
      </div>

      {/* Latest Events */}
      <div className="card">
        <div className="card-title">实时数据</div>
        <LatestEvents entityId={id} />
      </div>
    </div>
  );
}

function LatestEvents({ entityId }: { entityId: string }) {
  const [data, setData] = useState<Array<{ eventName: string; last: number }>>([]);

  useEffect(() => {
    apiJson<Array<{ eventName: string; last: number }>>(`/events/latest/${entityId}`)
      .then((res) => {
        if (res.code === 0) setData(res.data || []);
      })
      .catch(console.error);
  }, [entityId]);

  if (data.length === 0) {
    return <p style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>暂无数据</p>;
  }

  return (
    <div className="grid-4">
      {data.map((d) => (
        <div key={d.eventName} className="stat-card" style={{ background: '#f8fafc', borderRadius: 8, padding: 16 }}>
          <div className="stat-label">{d.eventName}</div>
          <div className="stat-value" style={{ fontSize: 24 }}>{d.last?.toFixed(2)}</div>
        </div>
      ))}
    </div>
  );
}
