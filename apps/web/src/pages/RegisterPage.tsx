import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';

import { api, ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { Button, Card, ErrorBanner, Field } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { Mascot, Wordmark } from '@/components/Logo';

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
    <div className="flex min-h-full flex-col justify-between">
      <header className="z-50 w-full bg-white/80 shadow-[0_1px_8px_rgba(0,0,0,0.04)] backdrop-blur-xl">
        <div className="flex h-14 items-center px-6 md:px-12">
          <Wordmark />
        </div>
      </header>

      <main className="flex w-full flex-1 flex-col items-center justify-center px-4 py-8">
        <div className="flex w-full max-w-[400px] flex-col items-center">
          <div className="mb-6 flex flex-col items-center text-center">
            <Mascot size={64} />
            <h1 className="mt-3 mb-1 text-[26px] font-semibold">Tạo tài khoản</h1>
            <p className="max-w-[340px] text-[15px] leading-relaxed text-ink-2">
              Bắt đầu lập trình con robot đầu tiên của em
            </p>
          </div>

          <Card className="w-full p-6 md:p-7">
            {error && <div className="mb-5"><ErrorBanner title="Không tạo được tài khoản">{error}</ErrorBanner></div>}

            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              <Field
                label="Tên hiển thị"
                icon="person"
                placeholder="Nguyễn Văn A"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                maxLength={60}
              />
              <Field
                label="Email học tập"
                type="email"
                icon="alternate_email"
                placeholder="hocsinh@stemrobot.vn"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
              <Field
                label="Mật khẩu"
                labelRight={<span className="text-[11px] font-normal text-ink-2">tối thiểu 6 ký tự</span>}
                type="password"
                icon="lock"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />

              <Button type="submit" size="lg" disabled={busy} className="mt-2 w-full">
                <span>{busy ? 'Đang tạo…' : 'Đăng ký'}</span>
                {!busy && <Icon name="arrow_forward" />}
              </Button>
            </form>

            <div className="mt-6 flex items-center justify-center gap-1.5 border-t border-brand-100 pt-4 text-xs">
              <span className="text-ink-2">Đã có tài khoản?</span>
              <Link to="/dang-nhap" className="font-semibold text-brand hover:underline">
                Đăng nhập
              </Link>
            </div>
          </Card>
        </div>
      </main>

      <footer className="w-full border-t border-slate-100/60 py-4 text-center text-[12px] text-ink-2">
        © {new Date().getFullYear()} INO Robot Studio. Hệ thống giáo dục STEM thông minh.
      </footer>
    </div>
  );
}
