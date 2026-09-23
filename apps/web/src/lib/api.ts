import type {
  AuthResponse,
  CreateProjectInput,
  LoginInput,
  ProjectDetail,
  ProjectSummary,
  PublicUser,
  RegisterInput,
  RobotConfig,
  ScenarioConfig,
  UpdateProjectInput,
} from '@ino/shared';
import { useAuthStore } from './auth-store';

const BASE = '/api/v1';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

let refreshing: Promise<boolean> | null = null;

/** Gọi /auth/refresh, gộp nhiều lời gọi cùng lúc thành một */
async function tryRefresh(): Promise<boolean> {
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'include' });
      if (!res.ok) return false;
      const data = (await res.json()) as AuthResponse;
      useAuthStore.getState().setSession(data.accessToken, data.user);
      return true;
    } catch {
      return false;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

async function request<T>(path: string, init: RequestInit = {}, retry = true): Promise<T> {
  const { accessToken } = useAuthStore.getState();

  const headers = new Headers(init.headers);
  if (init.body) headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);

  const res = await fetch(`${BASE}${path}`, { ...init, headers, credentials: 'include' });

  // Access token hết hạn -> xin token mới rồi gọi lại đúng một lần
  if (res.status === 401 && retry && !path.startsWith('/auth/')) {
    if (await tryRefresh()) return request<T>(path, init, false);
    useAuthStore.getState().clear();
  }

  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string; message?: string } | null;
    throw new ApiError(res.status, body?.error ?? 'ERROR', body?.message ?? 'Đã có lỗi xảy ra');
  }

  return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
}

const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) });

export const api = {
  auth: {
    register: (input: RegisterInput) => post<AuthResponse>('/auth/register', input),
    login: (input: LoginInput) => post<AuthResponse>('/auth/login', input),
    logout: () => post<{ ok: true }>('/auth/logout'),
    me: () => request<{ user: PublicUser }>('/auth/me'),
    restore: tryRefresh,
  },
  projects: {
    list: () => request<{ projects: ProjectSummary[] }>('/projects'),
    get: (id: string) => request<{ project: ProjectDetail }>(`/projects/${id}`),
    create: (input: CreateProjectInput) => post<{ project: ProjectSummary }>('/projects', input),
    update: (id: string, input: UpdateProjectInput) =>
      request<{ project: ProjectSummary }>(`/projects/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      }),
    remove: (id: string) => request<{ ok: true }>(`/projects/${id}`, { method: 'DELETE' }),
    duplicate: (id: string) => post<{ project: ProjectSummary }>(`/projects/${id}/duplicate`),
  },
  templates: () => request<{ templates: ProjectSummary[] }>('/templates'),
  robots: () => request<{ robots: RobotConfig[] }>('/robots'),
  scenarios: () => request<{ scenarios: ScenarioConfig[] }>('/scenarios'),
};
