import { useEffect } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';

import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { Spinner } from '@/components/ui';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import ProjectsPage from '@/pages/ProjectsPage';
import EditorPage from '@/pages/EditorPage';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);
  return user ? <>{children}</> : <Navigate to="/dang-nhap" replace />;
}

export default function App() {
  const ready = useAuthStore((s) => s.ready);
  const setReady = useAuthStore((s) => s.setReady);

  // Khôi phục phiên đăng nhập từ cookie refresh token khi mở trang
  useEffect(() => {
    api.auth.restore().finally(() => setReady(true));
  }, [setReady]);

  if (!ready) return <Spinner />;

  return (
    <Routes>
      <Route path="/dang-nhap" element={<LoginPage />} />
      <Route path="/dang-ky" element={<RegisterPage />} />
      <Route
        path="/"
        element={
          <RequireAuth>
            <ProjectsPage />
          </RequireAuth>
        }
      />
      <Route
        path="/bai-lam/:id"
        element={
          <RequireAuth>
            <EditorPage />
          </RequireAuth>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
