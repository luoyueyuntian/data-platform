/**
 * SSAS Frontend API Client
 * Type-safe wrapper around fetch for the backend API.
 */

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1').replace(/\/$/, '');

interface ApiResponse<T> {
  code: number;
  message: string;
  data?: T;
  total?: number;
  page?: number;
  pageSize?: number;
  totalPages?: number;
}

class ApiError extends Error {
  code: number;
  constructor(code: number, message: string) {
    super(message);
    this.code = code;
  }
}

export function buildApiUrl(path: string): string {
  if (/^https?:\/\//.test(path)) {
    return path;
  }

  const normalizedPath = path.startsWith('/api/v1')
    ? path.slice('/api/v1'.length)
    : path;
  const suffix = normalizedPath.startsWith('/') ? normalizedPath : `/${normalizedPath}`;
  return `${API_BASE}${suffix}`;
}

export function getToken(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const stored = localStorage.getItem('ssas_token');
  return stored || undefined;
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  const token = getToken();

  if (!headers.has('Content-Type') && init.body && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  return fetch(buildApiUrl(path), {
    ...init,
    headers,
  });
}

export async function apiJson<T>(path: string, init: RequestInit = {}): Promise<ApiResponse<T>> {
  const res = await apiFetch(path, init);
  return res.json() as Promise<ApiResponse<T>>;
}

async function request<T>(method: string, path: string, body?: unknown, token?: string): Promise<ApiResponse<T>> {
  const headers = new Headers();
  if (body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(buildApiUrl(path), {
    method,
    headers: Object.fromEntries(headers.entries()),
    body: body ? JSON.stringify(body) : undefined,
  });

  const json: ApiResponse<T> = await res.json();

  if (json.code !== 0 && json.code !== 201) {
    throw new ApiError(json.code, json.message || 'Unknown error');
  }

  return json;
}

// ======================
// Auth API
// ======================

export const authApi = {
  login: (email: string, password: string) =>
    request<{ token: string; refreshToken: string; user: Record<string, unknown> }>(
      'POST', '/auth/login', { email, password }
    ),
  verify: (token: string) =>
    request<{ id: string; tenantId: string; email: string; name: string; role: string; status: string }>(
      'POST', '/auth/verify', undefined, token,
    ),
};

// ======================
// Device API
// ======================

export interface DeviceListItem {
  id: string;
  name: string;
  deviceKey: string;
  type: string;
  status: string;
  phase: string;
  group: { id: string; name: string } | null;
  lastSeenAt: string | null;
  createdAt: string;
  _count: { sensors: number; tags: number };
}

export interface DeviceDetail {
  id: string;
  name: string;
  deviceKey: string;
  type: string;
  status: string;
  phase: string;
  group: { id: string; name: string } | null;
  location: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  lastSeenAt: string | null;
  sensors: Array<{ id: string; name: string; type: string; unit: string }>;
  tags: Array<{ id: string; key: string; value: string; source: string }>;
  createdAt: string;
  updatedAt: string;
}

export const deviceApi = {
  list: (params?: { page?: number; pageSize?: number; search?: string; status?: string; type?: string }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.pageSize) q.set('pageSize', String(params.pageSize));
    if (params?.search) q.set('search', params.search);
    if (params?.status) q.set('status', params.status);
    if (params?.type) q.set('type', params.type);
    return request<DeviceListItem[]>('GET', `/devices?${q}`, undefined, getToken());
  },
  get: (id: string) =>
    request<DeviceDetail>('GET', `/devices/${id}`, undefined, getToken()),
  create: (data: { name: string; deviceKey: string; type?: string; groupId?: string }) =>
    request<DeviceDetail>('POST', '/devices', data, getToken()),
  update: (id: string, data: Record<string, unknown>) =>
    request<DeviceDetail>('PUT', `/devices/${id}`, data, getToken()),
  delete: (id: string) =>
    request<void>('DELETE', `/devices/${id}`, undefined, getToken()),
};

// ======================
// Data API
// ======================

export interface DataQueryParams {
  deviceIds: string;
  metricNames?: string;
  startTime: string;
  endTime: string;
  granularity?: string;
  aggregation?: string;
}

export const dataApi = {
  ingest: (data: { deviceId: string; metricName: string; value: number; time?: string }) =>
    request('POST', '/data/ingest', data, getToken()),
  query: (params: DataQueryParams) => {
    const q = new URLSearchParams(params as unknown as Record<string, string>);
    return request<unknown[]>('GET', `/data/query?${q}`, undefined, getToken());
  },
  latest: (deviceId: string, metricName?: string) => {
    const q = metricName ? `?metricName=${metricName}` : '';
    return request<unknown[]>('GET', `/data/latest/${deviceId}${q}`, undefined, getToken());
  },
};

// ======================
// Alert API
// ======================

export const alertApi = {
  listRules: () =>
    request('GET', '/alerts/rules', undefined, getToken()),
  createRule: (data: Record<string, unknown>) =>
    request('POST', '/alerts/rules', data, getToken()),
  listRecords: (params?: { page?: number; status?: string }) => {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', String(params.page));
    if (params?.status) q.set('status', params.status);
    return request('GET', `/alerts/records?${q}`, undefined, getToken());
  },
};

// ======================
// Dashboard API
// ======================

export const dashboardApi = {
  list: () =>
    request('GET', '/dashboards', undefined, getToken()),
  get: (id: string) =>
    request('GET', `/dashboards/${id}`, undefined, getToken()),
  create: (data: { name: string; description?: string }) =>
    request('POST', '/dashboards', data, getToken()),
};
