'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

/**
 * AuthGuard only checks that a token exists in localStorage.
 * Actual token verification happens server-side on every API request.
 * If any API call returns 401, the apiFetch interceptor redirects to login.
 */
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
    setReady(true);
  }, [pathname, router]);

  if (!ready) {
    return <div className="loading">Loading...</div>;
  }

  return <>{children}</>;
}
