'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/', label: '总览', icon: '📊' },
  { href: '/devices', label: '实体管理', icon: '📡' },
  { href: '/data', label: '事件查询', icon: '📈' },
  { href: '/analytics', label: '分析模型', icon: '🔍' },
  { href: '/alerts', label: '告警管理', icon: '🔔' },
  { href: '/dashboards', label: '可视化看板', icon: '📋' },
  { href: '/settings', label: '系统设置', icon: '⚙️' },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="sidebar">
      <div className="sidebar-header">SSAS Platform</div>
      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const isActive = item.href === '/'
            ? pathname === '/'
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-item ${isActive ? 'active' : ''}`}
            >
              <span className="icon">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--color-border)' }}>
        <a
          href="/login"
          className="nav-item"
          onClick={() => {
            localStorage.removeItem('ssas_token');
          }}
        >
          <span className="icon">🚪</span>
          退出登录
        </a>
      </div>
    </aside>
  );
}
