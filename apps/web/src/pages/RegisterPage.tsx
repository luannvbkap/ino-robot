import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Bot } from 'lucide-react';

import { api, ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { Alert, Button, Field } from '@/components/ui';

export default function RegisterPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const setSession = useAuthStore((s) => s.setSession);

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api.auth.register({ displayName, email, password });
      setSession(res.accessToken, res.user);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không kết nối được máy chủ');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center p-4">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4 rounded-2xl bg-white p-8 shadow-sm">
        <div className="mb-2 flex flex-col items-center gap-2">
          <Bot className="size-10 text-ino-600" />
          <h1 className="text-xl font-semibold">Tạo tài khoản</h1>
        </div>

        {error && <Alert>{error}</Alert>}

        <Field
          label="Tên hiển thị"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          required
          maxLength={60}
        />
        <Field
          label="Email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
        />
        <Field
          label="Mật khẩu"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          autoComplete="new-password"
        />

        <Button type="submit" disabled={busy} className="w-full">
          {busy ? 'Đang tạo…' : 'Đăng ký'}
        </Button>

        <p className="text-center text-sm text-slate-500">
          Đã có tài khoản?{' '}
          <Link to="/dang-nhap" className="font-medium text-ino-600 hover:underline">
            Đăng nhập
          </Link>
        </p>
      </form>
    </div>
  );
}
