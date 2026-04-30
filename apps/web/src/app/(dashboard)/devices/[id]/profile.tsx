'use client';

import { useEffect, useState } from 'react';
import { apiJson } from '@/lib/api';

interface DeviceProfile {
  deviceId: string;
  onlineRate: number;
  dataCompleteness: number;
  anomalyRate: number;
  totalDataPoints: number;
  healthScore: number;
  firstSeen: string | null;
  lastSeen: string | null;
  scoreBreakdown: {
    onlineScore: number;
    completenessScore: number;
    anomalyScore: number;
  };
}

interface DeviceScore {
  deviceId: string;
  healthScore: number;
  level: string;
  breakdown: {
    onlineScore: number;
    completenessScore: number;
    anomalyScore: number;
  };
  suggestions: string[];
}

export function DeviceProfilePanel({ deviceId }: { deviceId: string }) {
  const [profile, setProfile] = useState<DeviceProfile | null>(null);
  const [score, setScore] = useState<DeviceScore | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiJson<DeviceProfile>(`/cdp/profile/${deviceId}`),
      apiJson<DeviceScore>(`/cdp/profile/${deviceId}/score`),
    ])
      .then(([profileRes, scoreRes]) => {
        if (profileRes.code === 0) setProfile(profileRes.data ?? null);
        if (scoreRes.code === 0) setScore(scoreRes.data ?? null);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [deviceId]);

  if (loading) return <div className="loading" style={{ padding: 20 }}>加载画像中...</div>;
  if (!profile) return null;

  return (
    <div>
      <div className="card-title">设备画像 & CDP</div>

      {/* Health Score */}
      <div style={{ textAlign: 'center', padding: '20px 0' }}>
        <div style={{
          fontSize: 48, fontWeight: 700,
          color: profile.healthScore >= 80 ? 'var(--color-success)'
            : profile.healthScore >= 60 ? 'var(--color-warning)'
            : 'var(--color-error)',
        }}>
          {profile.healthScore}
        </div>
        <div style={{ color: 'var(--color-text-secondary)', fontSize: 13, marginTop: 4 }}>
          健康度评分 {score?.level === 'healthy' ? '✅ 健康' : score?.level === 'normal' ? '⚠️ 一般' : score?.level === 'warning' ? '🔴 警告' : '🚨 危险'}
        </div>
      </div>

      {/* Score breakdown bar */}
      <div style={{ marginBottom: 16 }}>
        <ScoreBar label="在线率" score={profile.scoreBreakdown.onlineScore} max={40} pct={profile.onlineRate} />
        <ScoreBar label="数据完整率" score={profile.scoreBreakdown.completenessScore} max={30} pct={profile.dataCompleteness} />
        <ScoreBar label="异常率" score={profile.scoreBreakdown.anomalyScore} max={30} pct={1 - profile.anomalyRate} invert />
      </div>

      {/* Stats */}
      <table className="data-table">
        <tbody>
          <tr><td>总数据量</td><td>{profile.totalDataPoints.toLocaleString()} 条</td></tr>
          <tr><td>在线率</td><td>{(profile.onlineRate * 100).toFixed(0)}%</td></tr>
          <tr><td>数据完整率</td><td>{(profile.dataCompleteness * 100).toFixed(0)}%</td></tr>
          <tr><td>异常率</td><td>{(profile.anomalyRate * 100).toFixed(1)}%</td></tr>
          <tr><td>首次上报</td><td>{profile.firstSeen ? new Date(profile.firstSeen).toLocaleString() : '—'}</td></tr>
          <tr><td>最后上报</td><td>{profile.lastSeen ? new Date(profile.lastSeen).toLocaleString() : '—'}</td></tr>
        </tbody>
      </table>

      {/* Suggestions */}
      {score && score.suggestions.length > 0 && (
        <div style={{ marginTop: 12, padding: 12, background: '#fff7ed', borderRadius: 8, border: '1px solid #fed7aa' }}>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>💡 建议</p>
          {score.suggestions.map((s, i) => (
            <p key={i} style={{ fontSize: 13, color: '#9a3412', marginBottom: 2 }}>· {s}</p>
          ))}
        </div>
      )}
    </div>
  );
}

function ScoreBar({ label, score, max, pct, invert }: {
  label: string; score: number; max: number; pct: number; invert?: boolean;
}) {
  const barPct = invert ? (1 - pct) * 100 : pct * 100;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 2 }}>
        <span>{label}</span>
        <span>{score.toFixed(0)}/{max} ({barPct.toFixed(0)}%)</span>
      </div>
      <div style={{ height: 6, background: '#e2e8f0', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: `${Math.min(100, barPct)}%`,
          background: barPct > 80 ? 'var(--color-success)' : barPct > 50 ? 'var(--color-warning)' : 'var(--color-error)',
          borderRadius: 3,
          transition: 'width 0.5s',
        }} />
      </div>
    </div>
  );
}
