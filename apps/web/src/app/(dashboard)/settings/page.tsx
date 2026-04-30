'use client';

import { useEffect, useState } from 'react';
import { apiFetch, apiJson, authApi } from '@/lib/api';

interface UserInfo {
  id: string; email: string; name: string; role: string;
}

interface ApiKey {
  id: string; name: string; keyPreview: string;
  lastUsedAt: string | null; createdAt: string;
}

export default function SettingsPage() {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [showNewKey, setShowNewKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('ssas_token');
    if (token) {
      authApi.verify(token)
        .then((res) => { if (res.code === 0 && res.data) setUser(res.data as UserInfo); })
        .catch(console.error);
    }
    loadApiKeys();
  }, []);

  async function loadApiKeys() {
    try {
      const json = await apiJson<ApiKey[]>('/settings/api-keys');
      if (json.code === 0) setApiKeys(json.data || []);
    } catch (err) { console.error(err); }
  }

  async function handleCreateKey() {
    if (!newKeyName.trim()) return;
    try {
      const res = await apiJson<{ key: string }>('/settings/api-keys', {
        method: 'POST',
        body: JSON.stringify({ name: newKeyName }),
      });
      if (res.code === 0 && res.data) {
        setNewKeyValue(res.data.key);
        setShowNewKey(false);
        setNewKeyName('');
        loadApiKeys();
      }
    } catch (err) { console.error(err); }
  }

  async function handleDeleteKey(id: string) {
    if (!confirm('确定删除此 API Key？')) return;
    await apiFetch(`/settings/api-keys/${id}`, { method: 'DELETE' });
    loadApiKeys();
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">系统设置</h1>
      </div>

      {/* User Profile */}
      <div className="card">
        <div className="card-title">用户信息</div>
        {user ? (
          <table className="data-table">
            <tbody>
              <tr><td style={{ width: 120 }}>ID</td><td style={{ fontFamily: 'monospace' }}>{user.id}</td></tr>
              <tr><td>Email</td><td>{user.email}</td></tr>
              <tr><td>名称</td><td>{user.name}</td></tr>
              <tr><td>角色</td><td><span className="badge badge-active">{user.role}</span></td></tr>
            </tbody>
          </table>
        ) : (
          <p style={{ color: 'var(--color-text-secondary)' }}>未登录</p>
        )}
      </div>

      {/* API Keys */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div className="card-title" style={{ margin: 0 }}>API Keys</div>
          <button className="btn btn-sm btn-primary" onClick={() => setShowNewKey(true)}>+ 创建 Key</button>
        </div>

        {showNewKey && (
          <div style={{ marginBottom: 12, padding: 12, background: '#f8fafc', borderRadius: 8 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="form-input" value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="Key 名称" onKeyDown={(e) => e.key === 'Enter' && handleCreateKey()} />
              <button className="btn btn-sm btn-primary" onClick={handleCreateKey}>创建</button>
              <button className="btn btn-sm" onClick={() => setShowNewKey(false)}>取消</button>
            </div>
          </div>
        )}

        {/* New key display */}
        {newKeyValue && (
          <div style={{ marginBottom: 12, padding: 12, background: '#fef3c7', borderRadius: 8, border: '1px solid #fde68a' }}>
            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>⚠️ 新创建的 Key (请立即保存)</p>
            <code style={{ fontSize: 14, fontFamily: 'monospace', background: '#fff', padding: '4px 8px', borderRadius: 4, display: 'block' }}>
              {newKeyValue}
            </code>
            <button className="btn btn-sm" style={{ marginTop: 8 }}
              onClick={() => { navigator.clipboard.writeText(newKeyValue); alert('已复制'); }}>
              复制
            </button>
          </div>
        )}

        {apiKeys.length === 0 ? (
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>暂无 API Key</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>名称</th>
                <th>Key (前缀)</th>
                <th>最后使用</th>
                <th>创建时间</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {apiKeys.map((k) => (
                <tr key={k.id}>
                  <td>{k.name}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{k.keyPreview}...</td>
                  <td style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                    {k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleString() : '从未使用'}
                  </td>
                  <td style={{ fontSize: 13 }}>{new Date(k.createdAt).toLocaleDateString()}</td>
                  <td>
                    <button className="btn btn-sm" style={{ color: 'var(--color-error)' }}
                      onClick={() => handleDeleteKey(k.id)}>删除</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* System Info */}
      <div className="card">
        <div className="card-title">系统信息</div>
        <table className="data-table">
          <tbody>
            <tr><td style={{ width: 120 }}>版本</td><td>0.1.0</td></tr>
            <tr><td>运行时</td><td>Node.js + Next.js + Hono</td></tr>
            <tr><td>数据库</td><td>PostgreSQL + TimescaleDB</td></tr>
            <tr><td>消息队列</td><td>Kafka</td></tr>
            <tr><td>API 状态</td><td><span className="badge badge-online">运行中</span></td></tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
