import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';

import { api, ApiError } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { Button, Card, ErrorBanner, Field } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { Mascot } from '@/components/Logo';

export default function LoginPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const setSession = useAuthStore((s) => s.setSession);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await api.auth.login({ email, password });
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
        <div className="flex h-14 items-center justify-between px-6 md:px-12">
          <span className="flex items-center gap-2">
            <span className="flex size-8 items-center justify-center rounded-lg bg-brand text-white shadow-sm">
              <Icon name="smart_toy" />
            </span>
            <span className="text-[16px] font-semibold tracking-tight">INO Robot</span>
            <span className="rounded bg-brand-200 px-1.5 py-0.5 text-[12px] font-semibold tracking-wide text-brand uppercase">
              Studio
            </span>
          </span>

          <span className="flex items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-1 text-[13px] font-medium text-ink-2">
            <Icon name="language" size={18} className="text-brand" />
            Tiếng Việt
          </span>
        </div>
      </header>

      <main className="relative flex w-full flex-1 flex-col items-center justify-center px-4 py-8">
        <div className="pointer-events-none absolute top-1/4 -z-10 size-96 rounded-full bg-brand-400/20 blur-3xl" />
        <div className="pointer-events-none absolute bottom-10 -z-10 size-80 rounded-full bg-teal-glow/15 blur-3xl" />

        <div className="flex w-full max-w-[430px] flex-col items-center">
          <div className="mb-6 flex flex-col items-center text-center">
            <div className="relative">
              <div className="flex size-24 items-center justify-center rounded-2xl bg-brand-50 p-2 shadow-sm">
                <Mascot size={76} />
              </div>
              <span className="absolute -right-1 -bottom-1 flex items-center justify-center rounded-full bg-teal-light p-1 text-teal-ink shadow-sm">
                <Icon name="bolt" size={14} />
              </span>
            </div>

            <h1 className="mt-3 mb-1 text-[28px] font-bold tracking-tight md:text-[32px]">
              INO Robot Studio
            </h1>
            <p className="max-w-[340px] text-[15px] leading-relaxed text-ink-2">
              Lập trình robot, xem robot chạy thử ngay trên màn hình
            </p>
          </div>

          <Card className="w-full p-6 shadow-lg md:p-8">
            <div className="mb-5">
              <h2 className="text-[20px] font-semibold">Đăng nhập</h2>
              <span className="text-[12px] text-ink-2">Dành cho học sinh &amp; giáo viên</span>
            </div>

            {error && <div className="mb-5"><ErrorBanner title="Đăng nhập không thành công">{error}</ErrorBanner></div>}

            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              <Field
                label="Email học tập"
                labelRight={<span className="text-[11px] font-normal text-ink-2">Học sinh / Giáo viên</span>}
                type="email"
                icon="alternate_email"
                placeholder="hocsinh@stemrobot.vn"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                invalid={Boolean(error)}
                required
                autoComplete="email"
              />

              <Field
                label="Mật khẩu"
                type={showPassword ? 'text' : 'password'}
                icon="lock"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                invalid={Boolean(error)}
                required
                autoComplete="current-password"
                trailing={
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                    className="cursor-pointer text-ink-3 transition-colors hover:text-ink"
                  >
                    <Icon name={showPassword ? 'visibility_off' : 'visibility'} />
                  </button>
                }
              />

              <Button type="submit" size="lg" disabled={busy} className="mt-2 w-full">
                <span>{busy ? 'Đang đăng nhập…' : 'Đăng nhập'}</span>
                {!busy && <Icon name="arrow_forward" />}
              </Button>
            </form>

            <div className="mt-6 flex items-center justify-center gap-1.5 border-t border-brand-100 pt-4 text-xs">
              <span className="text-ink-2">Chưa có tài khoản?</span>
              <Link to="/dang-ky" className="font-semibold text-brand hover:underline">
                Đăng ký
              </Link>
            </div>
          </Card>
        </div>
      </main>

      <footer className="w-full border-t border-slate-100/60 py-4">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-6 text-[12px] text-ink-2 sm:flex-row">
          <span>© {new Date().getFullYear()} INO Robot Studio. Hệ thống giáo dục STEM thông minh.</span>
          <span>Nền tảng lập trình STEM cho học sinh Việt Nam</span>
        </div>
      </footer>
    </div>
  );
}
