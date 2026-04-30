'use client';

import { useEffect, useState } from 'react';
import { apiFetch, apiJson } from '@/lib/api';

interface AlertCondition {
  metricName: string; operator: string; threshold: number; duration?: number; window?: string;
}

interface AlertChannel {
  type: string; config: Record<string, string>;
}

interface AlertRule {
  id: string; name: string; description: string | null;
  conditions: AlertCondition[]; conditionLogic: string;
  channels: AlertChannel[]; silenceSeconds: number;
  enabled: boolean; createdAt: string;
}

interface AlertRecord {
  id: string; ruleName: string; severity: string;
  status: string; message: string; triggeredValue: number; triggeredAt: string;
}

type PageTab = 'rules' | 'records' | 'create';

export default function AlertsPage() {
  const [activeTab, setActiveTab] = useState<PageTab>('rules');
  const [rules, setRules] = useState<AlertRule[]>([]);
  const [records, setRecords] = useState<AlertRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRule, setExpandedRule] = useState<string | null>(null);

  function loadData(tab: PageTab) {
    if (tab === 'create') return;
    setLoading(true);
    setActiveTab(tab);

    const endpoint = tab === 'rules' ? '/api/v1/alerts/rules' : '/api/v1/alerts/records';
    apiJson(endpoint)
      .then((res) => {
        if (res.code === 0) {
          if (tab === 'rules') setRules((res.data as AlertRule[]) || []);
          else setRecords((res.data as AlertRecord[]) || []);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadData('rules'); }, []);

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">告警管理</h1>
        {activeTab !== 'create' && (
          <button className="btn btn-primary" onClick={() => setActiveTab('create')}>+ 创建规则</button>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 20, borderBottom: '2px solid var(--color-border)' }}>
        {(['rules', 'records'] as PageTab[]).map((tab) => (
          <button key={tab} className="btn"
            style={{
              borderRadius: 0, border: 'none',
              borderBottom: activeTab === tab ? '2px solid var(--color-primary)' : '2px solid transparent',
              color: activeTab === tab ? 'var(--color-primary)' : undefined,
              fontWeight: activeTab === tab ? 600 : undefined, marginBottom: -2,
            }}
            onClick={() => loadData(tab)}
          >{tab === 'rules' ? '告警规则' : '告警记录'}</button>
        ))}
        {activeTab === 'create' && (
          <button className="btn" style={{ borderRadius: 0, border: 'none', borderBottom: '2px solid var(--color-primary)', color: 'var(--color-primary)', fontWeight: 600, marginBottom: -2 }}>
            创建规则
          </button>
        )}
      </div>

      {activeTab === 'create' ? (
        <CreateRuleForm onCreated={() => loadData('rules')} onCancel={() => loadData('rules')} />
      ) : loading ? (
        <div className="loading">加载中...</div>
      ) : activeTab === 'rules' ? (
        <RulesList rules={rules} expandedRule={expandedRule} setExpandedRule={setExpandedRule} onToggle={loadData} />
      ) : (
        <RecordsList records={records} />
      )}
    </div>
  );
}

// ======================
// Rules List
// ======================

function RulesList({ rules, expandedRule, setExpandedRule, onToggle }: {
  rules: AlertRule[]; expandedRule: string | null;
  setExpandedRule: (id: string | null) => void; onToggle: (tab: PageTab) => void;
}) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _onToggle = onToggle;
  if (rules.length === 0) {
    return <div className="card"><p style={{ color: 'var(--color-text-secondary)', textAlign: 'center', padding: 20 }}>暂无告警规则</p></div>;
  }

  return (
    <div>
      {rules.map((rule) => (
        <div key={rule.id} className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
            onClick={() => setExpandedRule(expandedRule === rule.id ? null : rule.id)}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <strong>{rule.name}</strong>
                <span className={`badge ${rule.enabled ? 'badge-online' : 'badge-offline'}`}>
                  {rule.enabled ? '已启用' : '已禁用'}
                </span>
              </div>
              {rule.description && (
                <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginTop: 4 }}>{rule.description}</p>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                {rule.conditions?.length || 0} 个条件
              </span>
              <button className="btn btn-sm"
                onClick={async (e) => { e.stopPropagation();
                  await apiFetch(`/alerts/rules/${rule.id}`, {
                    method: 'PUT',
                    body: JSON.stringify({ enabled: !rule.enabled }),
                  });
                  onToggle('rules');
                }}>
                {rule.enabled ? '禁用' : '启用'}
              </button>
              <button className="btn btn-sm" style={{ color: 'var(--color-error)' }}
                onClick={async (e) => { e.stopPropagation();
                  if (confirm(`确定删除规则"${rule.name}"？`)) {
                    await apiFetch(`/alerts/rules/${rule.id}`, { method: 'DELETE' });
                    onToggle('rules');
                  }
                }}>
                删除
              </button>
              <span style={{ fontSize: 16, color: 'var(--color-text-secondary)' }}>
                {expandedRule === rule.id ? '▼' : '▶'}
              </span>
            </div>
          </div>

          {expandedRule === rule.id && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--color-border)' }}>
              <table className="data-table">
                <tbody>
                  <tr><td style={{ width: 120 }}>条件逻辑</td><td>{rule.conditionLogic === 'all' ? '全部满足 (AND)' : '任一满足 (OR)'}</td></tr>
                  <tr><td>静默期</td><td>{rule.silenceSeconds} 秒</td></tr>
                  <tr><td>通知渠道</td><td>{rule.channels?.map((c) => c.type).join(', ') || '无'}</td></tr>
                  <tr><td>创建时间</td><td>{new Date(rule.createdAt).toLocaleString()}</td></tr>
                </tbody>
              </table>

              <div style={{ marginTop: 8 }}>
                <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>条件明细</p>
                {rule.conditions?.map((c, i) => (
                  <div key={i} style={{ fontSize: 13, padding: '4px 8px', background: '#f8fafc', borderRadius: 4, marginBottom: 4 }}>
                    {c.metricName} {c.operator} {c.threshold}
                    {c.window ? ` (窗口: ${c.window})` : ''}
                    {c.duration ? ` (持续: ${c.duration} 次)` : ''}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ======================
// Records List
// ======================

function RecordsList({ records }: { records: AlertRecord[] }) {
  if (records.length === 0) {
    return <div className="card"><p style={{ color: 'var(--color-text-secondary)', textAlign: 'center', padding: 20 }}>暂无告警记录</p></div>;
  }

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <table className="data-table">
        <thead>
          <tr>
            <th>规则</th><th>级别</th><th>状态</th><th>消息</th><th>触发值</th><th>时间</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={r.id}>
              <td><strong>{r.ruleName}</strong></td>
              <td><span className={`badge ${r.severity === 'critical' ? 'badge-error' : r.severity === 'warn' ? 'badge-online' : 'badge-active'}`}>{r.severity}</span></td>
              <td><span className={`badge badge-${r.status}`}>{r.status}</span></td>
              <td style={{ fontSize: 13, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.message}</td>
              <td style={{ fontFamily: 'monospace' }}>{r.triggeredValue?.toFixed(2)}</td>
              <td style={{ fontSize: 13, whiteSpace: 'nowrap' }}>{new Date(r.triggeredAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ======================
// Create Rule Form
// ======================

function CreateRuleForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [conditionLogic, setConditionLogic] = useState<'all' | 'any'>('all');
  const [silenceSeconds, setSilenceSeconds] = useState(300);
  const [enabled, setEnabled] = useState(true);
  const [webhookUrl, setWebhookUrl] = useState('');
  const [conditions, setConditions] = useState([{ metricName: 'temperature', operator: '>', threshold: 80, window: '5m' }]);
  const [saving, setSaving] = useState(false);

  function addCondition() {
    setConditions([...conditions, { metricName: '', operator: '>', threshold: 0, window: '5m' }]);
  }

  function updateCondition(i: number, field: string, value: string | number) {
    const updated = conditions.map((c, idx) => idx === i ? { ...c, [field]: value } : c);
    setConditions(updated);
  }

  function removeCondition(i: number) {
    setConditions(conditions.filter((_, idx) => idx !== i));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);

    try {
      const channels = webhookUrl
        ? [{ type: 'webhook', config: { url: webhookUrl } }]
        : [];

      const json = await apiJson('/alerts/rules', {
        method: 'POST',
        body: JSON.stringify({ name, description, conditions, conditionLogic, channels, silenceSeconds, enabled }),
      });
      if (json.code === 0) onCreated();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="card" style={{ borderColor: 'var(--color-primary)' }}>
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>创建告警规则</h3>
      <form onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
          <div className="form-group">
            <label className="form-label">规则名称</label>
            <input className="form-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="高温告警" required />
          </div>
          <div className="form-group">
            <label className="form-label">描述</label>
            <input className="form-input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="当温度超过 80°C 时触发" />
          </div>
          <div className="form-group">
            <label className="form-label">条件逻辑</label>
            <select className="form-select" value={conditionLogic} onChange={(e) => setConditionLogic(e.target.value as 'all' | 'any')}>
              <option value="all">全部满足 (AND)</option>
              <option value="any">任一满足 (OR)</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">静默期 (秒)</label>
            <input className="form-input" type="number" value={silenceSeconds} onChange={(e) => setSilenceSeconds(Number(e.target.value))} />
          </div>
          <div className="form-group">
            <label className="form-label">Webhook URL (可选)</label>
            <input className="form-input" value={webhookUrl} onChange={(e) => setWebhookUrl(e.target.value)} placeholder="https://hooks.example.com/alert" />
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
              <span style={{ fontSize: 14 }}>创建后立即启用</span>
            </label>
          </div>
        </div>

        {/* Conditions */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>触发条件</span>
            <button type="button" className="btn btn-sm" onClick={addCondition}>+ 添加条件</button>
          </div>
          {conditions.map((c, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <input className="form-input" style={{ width: 160 }} placeholder="metric" value={c.metricName}
                onChange={(e) => updateCondition(i, 'metricName', e.target.value)} />
              <select className="form-select" style={{ width: 80 }} value={c.operator}
                onChange={(e) => updateCondition(i, 'operator', e.target.value)}>
                <option value=">">{'>'}</option><option value=">=">{'>='}</option>
                <option value="<">{'<'}</option><option value="<=">{'<='}</option>
                <option value="==">==</option>
              </select>
              <input className="form-input" style={{ width: 100 }} type="number" value={c.threshold}
                onChange={(e) => updateCondition(i, 'threshold', Number(e.target.value))} />
              <select className="form-select" style={{ width: 80 }} value={c.window}
                onChange={(e) => updateCondition(i, 'window', e.target.value)}>
                <option value="1m">1分钟</option><option value="5m">5分钟</option>
                <option value="15m">15分钟</option><option value="1h">1小时</option>
              </select>
              {conditions.length > 1 && (
                <button type="button" className="btn btn-sm" style={{ color: 'var(--color-error)' }}
                  onClick={() => removeCondition(i)}>✕</button>
              )}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? '保存中...' : '创建规则'}
          </button>
          <button type="button" className="btn" onClick={onCancel}>取消</button>
        </div>
      </form>
    </div>
  );
}
