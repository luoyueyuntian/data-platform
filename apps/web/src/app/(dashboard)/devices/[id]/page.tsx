'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiJson, type DeviceDetail } from '@/lib/api';

export default function DeviceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [device, setDevice] = useState<DeviceDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiJson<DeviceDetail>(`/devices/${id}`)
      .then((res) => {
        if (res.code === 0) setDevice(res.data ?? null);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="loading">加载中...</div>;
  if (!device) return <div className="loading">设备未找到</div>;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">{device.name}</h1>
          <p style={{ fontFamily: 'monospace', fontSize: 13, color: 'var(--color-text-secondary)' }}>
            {device.deviceKey}
          </p>
        </div>
        <span className={`badge badge-${device.status}`} style={{ fontSize: 14, padding: '4px 12px' }}>
          {device.status}
        </span>
      </div>

      <div className="grid-2">
        {/* Device Info */}
        <div className="card">
          <div className="card-title">基本信息</div>
          <table className="data-table">
            <tbody>
              <tr><td style={{ width: 120 }}>类型</td><td>{device.type}</td></tr>
              <tr><td>阶段</td><td>{device.phase}</td></tr>
              <tr><td>分组</td><td>{device.group?.name || '—'}</td></tr>
              <tr><td>位置</td><td>{device.location?.name as string || '—'}</td></tr>
              <tr><td>创建时间</td><td>{new Date(device.createdAt).toLocaleString()}</td></tr>
              <tr><td>更新时间</td><td>{new Date(device.updatedAt).toLocaleString()}</td></tr>
              <tr><td>最后在线</td><td>{device.lastSeenAt ? new Date(device.lastSeenAt).toLocaleString() : '从未上线'}</td></tr>
            </tbody>
          </table>
        </div>

        {/* Sensors */}
        <div className="card">
          <div className="card-title">传感器 ({device.sensors.length})</div>
          {device.sensors.length === 0 ? (
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>暂无传感器</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr><th>名称</th><th>类型</th><th>单位</th></tr>
              </thead>
              <tbody>
                {device.sensors.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td>{s.type}</td>
                    <td>{s.unit}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Tags */}
      <div className="card">
        <div className="card-title">标签 ({device.tags.length})</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {device.tags.map((t) => (
            <span key={t.id} className="badge badge-active" style={{ fontSize: 13, padding: '4px 10px' }}>
              {t.key}: {t.value}
            </span>
          ))}
          {device.tags.length === 0 && (
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>暂无标签</p>
          )}
        </div>
      </div>

      {/* Latest Data */}
      <div className="card">
        <div className="card-title">实时数据</div>
        <LatestData deviceId={id} />
      </div>
    </div>
  );
}

function LatestData({ deviceId }: { deviceId: string }) {
  const [data, setData] = useState<Array<{ metricName: string; last: number }>>([]);

  useEffect(() => {
    apiJson<Array<{ metricName: string; last: number }>>(`/data/latest/${deviceId}`)
      .then((res) => {
        if (res.code === 0) setData(res.data || []);
      })
      .catch(console.error);
  }, [deviceId]);

  if (data.length === 0) {
    return <p style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>暂无数据</p>;
  }

  return (
    <div className="grid-4">
      {data.map((d) => (
        <div key={d.metricName} className="stat-card" style={{ background: '#f8fafc', borderRadius: 8, padding: 16 }}>
          <div className="stat-label">{d.metricName}</div>
          <div className="stat-value" style={{ fontSize: 24 }}>{d.last?.toFixed(2)}</div>
        </div>
      ))}
    </div>
  );
}
