import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bot, LogOut, Plus, Trash2 } from 'lucide-react';

import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { Button, Field, Spinner } from '@/components/ui';

export default function ProjectsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);

  const [newName, setNewName] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['projects'],
    queryFn: () => api.projects.list(),
  });

  const create = useMutation({
    mutationFn: () => api.projects.create({ name: newName.trim() || 'Bài làm mới' }),
    onSuccess: (res) => {
      setNewName('');
      navigate(`/bai-lam/${res.project.id}`);
    },
  });

  const remove = useMutation({
    mutationFn: (id: string) => api.projects.remove(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['projects'] }),
  });

  async function onLogout() {
    await api.auth.logout().catch(() => {});
    clear();
    navigate('/dang-nhap', { replace: true });
  }

  return (
    <div className="mx-auto max-w-5xl p-6">
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="size-7 text-ino-600" />
          <span className="text-lg font-semibold">INO Robot Studio</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-slate-500">{user?.displayName}</span>
          <Button variant="ghost" onClick={onLogout}>
            <LogOut className="size-4" />
            Đăng xuất
          </Button>
        </div>
      </header>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
        className="mb-8 flex items-end gap-3 rounded-xl bg-white p-4 shadow-sm"
      >
        <div className="flex-1">
          <Field
            label="Tạo bài làm mới"
            placeholder="Ví dụ: Robot dò line"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            maxLength={80}
          />
        </div>
        <Button type="submit" disabled={create.isPending}>
          <Plus className="size-4" />
          Tạo
        </Button>
      </form>

      <h2 className="mb-3 text-sm font-semibold text-slate-500 uppercase">Bài làm của tôi</h2>

      {isLoading ? (
        <Spinner />
      ) : !data?.projects.length ? (
        <p className="rounded-xl bg-white p-10 text-center text-sm text-slate-400 shadow-sm">
          Chưa có bài làm nào. Tạo bài đầu tiên ở trên nhé.
        </p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.projects.map((p) => (
            <li key={p.id} className="group rounded-xl bg-white p-4 shadow-sm transition-shadow hover:shadow-md">
              <Link to={`/bai-lam/${p.id}`} className="block">
                <div className="mb-3 flex aspect-video items-center justify-center rounded-lg bg-slate-50">
                  {p.thumbnail ? (
                    <img src={p.thumbnail} alt="" className="h-full w-full rounded-lg object-cover" />
                  ) : (
                    <Bot className="size-8 text-slate-300" />
                  )}
                </div>
                <div className="truncate font-medium">{p.name}</div>
                <div className="text-xs text-slate-400">
                  Sửa lần cuối {new Date(p.updatedAt).toLocaleString('vi-VN')}
                </div>
              </Link>
              <div className="mt-2 flex justify-end opacity-0 transition-opacity group-hover:opacity-100">
                <Button
                  variant="danger"
                  onClick={() => {
                    if (confirm(`Xoá "${p.name}"?`)) remove.mutate(p.id);
                  }}
                >
                  <Trash2 className="size-4" />
                  Xoá
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
