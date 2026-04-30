'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { authApi } from '@/lib/api';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('ssas_token');
    if (!token) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }

    authApi.verify(token)
      .then((res) => {
        if (res.code !== 0) {
          localStorage.removeItem('ssas_token');
          router.replace('/login');
          return;
        }
        setReady(true);
      })
      .catch(() => {
        localStorage.removeItem('ssas_token');
        router.replace('/login');
      });
  }, [pathname, router]);

  if (!ready) {
    return <div className="loading">认证中...</div>;
  }

  return <>{children}</>;
}
