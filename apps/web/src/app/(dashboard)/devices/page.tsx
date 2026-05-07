'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiJson, type EntityListItem } from '@/lib/api';

export default function EntityListPage() {
  const [entities, setEntities] = useState<EntityListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const pageSize = 20;

  async function loadEntities() {
    setLoading(true);
    try {
      const q = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (search) q.set('search', search);
      if (statusFilter) q.set('status', statusFilter);

      const data = await apiJson<EntityListItem[]>(`/entities?${q}`);

      if (data.code === 0) {
        setEntities(data.data ?? []);
        setTotal(data.total ?? 0);
      }
    } catch (err) {
      console.error('Failed to load entities:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadEntities(); }, [page, statusFilter]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setPage(1);
    loadEntities();
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">实体管理</h1>
        <Link href="/devices/new" className="btn btn-primary">+ 添加实体</Link>
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: '16px 20px' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <input
            className="form-input"
            style={{ maxWidth: 300 }}
            placeholder="搜索实体名称 / entityKey..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="form-select"
            style={{ maxWidth: 160 }}
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          >
            <option value="">全部状态</option>
            <option value="active">活跃</option>
            <option value="inactive">不活跃</option>
            <option value="error">异常</option>
            <option value="disabled">禁用</option>
            <option value="maintenance">维护</option>
          </select>
          <button type="submit" className="btn">搜索</button>
        </form>
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div className="loading">加载中...</div>
        ) : entities.length === 0 ? (
          <div className="loading">暂无实体数据</div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>名称</th>
                <th>Entity Key</th>
                <th>类型</th>
                <th>状态</th>
                <th>阶段</th>
                <th>标签</th>
                <th>最后在线</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {entities.map((d) => (
                <tr key={d.id}>
                  <td><strong>{d.name}</strong></td>
                  <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{d.entityKey}</td>
                  <td>{d.type}</td>
                  <td><span className={`badge badge-${d.status}`}>{d.status}</span></td>
                  <td>{d.phase}</td>
                  <td>{d._count.tags}</td>
                  <td style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                    {d.lastSeenAt ? new Date(d.lastSeenAt).toLocaleString() : '—'}
                  </td>
                  <td>
                    <Link href={`/devices/${d.id}`} className="btn btn-sm">详情</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="pagination">
          <button disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</button>
          {Array.from({ length: Math.min(totalPages, 10) }, (_, i) => i + 1).map((p) => (
            <button key={p} className={p === page ? 'current' : ''} onClick={() => setPage(p)}>
              {p}
            </button>
          ))}
          <button disabled={page >= totalPages} onClick={() => setPage(page + 1)}>下一页</button>
          <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>共 {total} 条</span>
        </div>
      )}
    </div>
  );
}
