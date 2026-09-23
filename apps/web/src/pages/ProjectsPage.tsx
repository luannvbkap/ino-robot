import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import type { ProjectSummary } from '@ino/shared';
import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { Button, Card, Dot, Field, Spinner, useToast } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { Mascot, Wordmark } from '@/components/Logo';
import { Thumbnail } from '@/components/Thumbnail';

const GOI_Y = [
  'Robot dò line',
  'Robot tránh vật cản',
  'Mê cung xe thông minh',
  'Cảm biến khoảng cách siêu âm',
];

export default function ProjectsPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const notify = useToast();
  const user = useAuthStore((s) => s.user);
  const clear = useAuthStore((s) => s.clear);

  const [newName, setNewName] = useState('');
  const [keyword, setKeyword] = useState('');
  const [tab, setTab] = useState<'mine' | 'templates'>('mine');

  const mine = useQuery({ queryKey: ['projects'], queryFn: () => api.projects.list() });
  const templates = useQuery({ queryKey: ['templates'], queryFn: () => api.templates() });
  const scenarios = useQuery({ queryKey: ['scenarios'], queryFn: () => api.scenarios() });

  const scenarioName = useMemo(() => {
    const map = new Map(scenarios.data?.scenarios.map((s) => [s.id, s.name]));
    return (id: string) => map.get(id) ?? id;
  }, [scenarios.data]);

  const create = useMutation({
    mutationFn: (name: string) => api.projects.create({ name: name.trim() }),
    onSuccess: (res) => navigate(`/bai-lam/${res.project.id}`),
  });

  const duplicate = useMutation({
    mutationFn: (p: ProjectSummary) => api.projects.duplicate(p.id),
    onSuccess: (_res, p) => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      setTab('mine');
      notify(`Đã nhân bản "${p.name}"`);
    },
  });

  const remove = useMutation({
    mutationFn: (p: ProjectSummary) => api.projects.remove(p.id),
    onSuccess: (_res, p) => {
      qc.invalidateQueries({ queryKey: ['projects'] });
      notify(`Đã xoá "${p.name}"`);
    },
  });

  async function onLogout() {
    await api.auth.logout().catch(() => {});
    clear();
    navigate('/dang-nhap', { replace: true });
  }

  const source = tab === 'mine' ? mine.data?.projects : templates.data?.templates;
  const list = (source ?? []).filter((p) =>
    p.name.toLowerCase().includes(keyword.trim().toLowerCase()),
  );
  const loading = tab === 'mine' ? mine.isLoading : templates.isLoading;

  return (
    <div className="flex min-h-full flex-col justify-between">
      {/* ----------------------------- Thanh trên ---------------------------- */}
      <header className="sticky top-0 z-50 bg-white/95 shadow-[0_1px_8px_rgba(0,0,0,0.04)] backdrop-blur-md">
        <div className="flex h-16 w-full items-center justify-between px-6 md:px-8">
          <div className="flex items-center gap-6">
            <Link to="/">
              <Wordmark />
            </Link>

            <nav className="hidden items-center gap-2 md:flex">
              <NavItem active={tab === 'mine'} onClick={() => setTab('mine')}>
                Dự án của tôi
              </NavItem>
              <NavItem active={tab === 'templates'} onClick={() => setTab('templates')}>
                Thư viện mẫu
              </NavItem>
            </nav>
          </div>

          <div className="flex items-center gap-4">
            <span className="flex items-center gap-2.5 pr-2">
              <span className="flex size-8 items-center justify-center rounded-full bg-brand text-[13px] font-bold text-white">
                {user?.displayName.trim().slice(0, 1).toUpperCase()}
              </span>
              <span className="hidden text-[14px] font-medium sm:inline">{user?.displayName}</span>
            </span>
            <button
              onClick={onLogout}
              className="flex cursor-pointer items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium text-ink-2 transition-colors hover:bg-danger-bg/50 hover:text-danger"
            >
              <Icon name="logout" size={18} />
              <span className="hidden sm:inline">Đăng xuất</span>
            </button>
          </div>
        </div>
      </header>

      <main className="w-full flex-1 pt-8 pb-10">
        <div className="mx-auto max-w-[1100px] px-6">
          <div className="mb-6">
            <div className="mb-1 flex items-center gap-2">
              <Dot />
              <span className="text-[12px] font-semibold tracking-wider text-ink-2 uppercase">
                Không gian học sinh
              </span>
            </div>
            <h1 className="text-[28px] font-bold tracking-tight md:text-[32px]">
              Bảng điều khiển • Bài làm của tôi
            </h1>
          </div>

          {/* -------------------------- Tạo bài làm mới ------------------------- */}
          <Card className="relative mb-8 overflow-hidden p-6 sm:p-7">
            <div className="pointer-events-none absolute -top-16 -right-16 size-56 rounded-full bg-brand/5 blur-2xl" />

            <div className="relative z-10 flex flex-col gap-5">
              <div>
                <div className="mb-1 flex items-center gap-2.5">
                  <span className="flex size-8 items-center justify-center rounded-lg bg-brand-hover text-white shadow-sm">
                    <Icon name="add_circle" />
                  </span>
                  <h2 className="text-[20px] font-semibold">Tạo bài làm mới</h2>
                </div>
                <p className="text-[14px] text-ink-2">
                  Lập trình robot bằng các khối lệnh trực quan và xem robot chạy thử trong mô phỏng 3D.
                </p>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (newName.trim()) create.mutate(newName);
                }}
                className="flex flex-col items-stretch gap-3 sm:flex-row"
              >
                <div className="flex-1">
                  <Field
                    icon="smart_toy"
                    placeholder="Ví dụ: Robot dò line"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    maxLength={80}
                  />
                </div>
                <Button type="submit" size="lg" disabled={create.isPending || !newName.trim()}>
                  <Icon name="add" />
                  <span>Tạo</span>
                </Button>
              </form>

              <div className="flex flex-wrap items-center gap-2">
                <span className="mr-1 flex items-center gap-1 text-[12px] text-ink-2">
                  <Icon name="lightbulb" size={16} />
                  Gợi ý nhanh:
                </span>
                {GOI_Y.map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setNewName(g)}
                    className="cursor-pointer rounded-lg bg-brand-50 px-3 py-1.5 text-[12px] text-ink-2 transition-colors hover:bg-brand-100 hover:text-brand"
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
          </Card>

          {/* ------------------------------ Bộ lọc ------------------------------ */}
          <div className="mb-6 flex flex-col items-stretch justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-2 rounded-xl bg-brand-50 p-1">
              <TabPill active={tab === 'mine'} onClick={() => setTab('mine')} count={mine.data?.projects.length}>
                Bài làm của tôi
              </TabPill>
              <TabPill
                active={tab === 'templates'}
                onClick={() => setTab('templates')}
                count={templates.data?.templates.length}
              >
                Bài mẫu
              </TabPill>
            </div>

            <div className="sm:w-72">
              <Field
                icon="search"
                placeholder="Tìm kiếm bài làm..."
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
            </div>
          </div>

          {/* ------------------------------- Lưới ------------------------------- */}
          {loading ? (
            <Spinner />
          ) : list.length === 0 ? (
            <Card className="my-6 flex flex-col items-center justify-center p-12 text-center">
              <div className="relative mb-6">
                <div className="flex size-28 items-center justify-center rounded-full bg-brand-50 p-3 shadow-inner">
                  <Mascot size={80} />
                </div>
                <span className="absolute -right-1 -bottom-1 flex size-8 items-center justify-center rounded-full bg-teal text-white shadow-md">
                  <Icon name="smart_toy" size={18} />
                </span>
              </div>
              <h3 className="mb-2 text-[22px] font-bold">
                {keyword ? 'Không tìm thấy bài làm nào' : 'Chưa có bài làm nào'}
              </h3>
              <p className="mx-auto mb-8 max-w-md text-[14px] leading-relaxed text-ink-2">
                {keyword
                  ? 'Thử tìm bằng từ khoá khác xem sao.'
                  : 'Tạo bài đầu tiên của em nhé! Khám phá thế giới lập trình robot thật dễ dàng với thư viện khối lệnh trực quan.'}
              </p>
              {!keyword && (
                <Button
                  size="lg"
                  onClick={() => {
                    setNewName('Robot đầu tiên của tôi');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                >
                  <Icon name="add" />
                  Tạo bài làm ngay bây giờ
                </Button>
              )}
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {list.map((p) => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  scenarioName={scenarioName(p.scenarioId)}
                  onDuplicate={() => duplicate.mutate(p)}
                  onDelete={
                    tab === 'mine'
                      ? () => {
                          if (confirm(`Xoá bài làm "${p.name}"?`)) remove.mutate(p);
                        }
                      : undefined
                  }
                />
              ))}
            </div>
          )}

          <div className="mt-12 flex flex-col items-center justify-between gap-4 rounded-xl border border-brand-200 bg-brand-50 p-4 text-[13px] text-ink-2 sm:flex-row">
            <span className="flex items-center gap-3">
              <Dot />
              Bài làm được lưu tự động trên máy chủ
            </span>
            <span className="flex items-center gap-1">
              <Icon name="info" size={16} />
              Phiên bản mô phỏng — chưa hỗ trợ nạp code xuống robot thật
            </span>
          </div>
        </div>
      </main>

      <footer className="w-full border-t border-brand-100 bg-white">
        <div className="mx-auto flex max-w-[1100px] flex-col items-center justify-between gap-3 px-6 py-4 text-[13px] text-ink-2 sm:flex-row">
          <span>
            © {new Date().getFullYear()} INO Robot Studio • Nền tảng lập trình STEM cho học sinh Việt Nam
          </span>
        </div>
      </footer>
    </div>
  );
}

/* ------------------------------ Mảnh phụ ------------------------------ */

function NavItem({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`cursor-pointer rounded-lg px-3 py-1.5 text-[13px] transition-colors ${
        active
          ? 'bg-brand-200 font-semibold text-brand'
          : 'font-medium text-ink-2 hover:bg-brand-50 hover:text-ink'
      }`}
    >
      {children}
    </button>
  );
}

function TabPill({
  active,
  count,
  onClick,
  children,
}: {
  active: boolean;
  count?: number;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-[14px] font-semibold transition-all ${
        active ? 'bg-white text-brand shadow-sm' : 'text-ink-2 hover:text-ink'
      }`}
    >
      <span>{children}</span>
      {count !== undefined && (
        <span
          className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
            active ? 'bg-brand/10 text-brand' : 'bg-brand-200 text-ink-2'
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

function ProjectCard({
  project,
  scenarioName,
  onDuplicate,
  onDelete,
}: {
  project: ProjectSummary;
  scenarioName: string;
  onDuplicate: () => void;
  onDelete?: () => void;
}) {
  /** Số khối lệnh đọc từ nội dung thật của bài làm, chưa có thì bằng 0 */
  const blockCount = 0;

  return (
    <div className="group relative flex flex-col overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md">
      <Link to={`/bai-lam/${project.id}`} className="block">
        <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden border-b border-brand-100 bg-[#f0f4fd]">
          <Thumbnail scenarioId={project.scenarioId} src={project.thumbnail} />

          <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
            <button
              type="button"
              title="Nhân bản bài làm"
              onClick={(e) => {
                e.preventDefault();
                onDuplicate();
              }}
              className="cursor-pointer rounded-lg bg-white/95 p-1.5 text-ink-2 shadow-sm backdrop-blur transition-colors hover:text-brand"
            >
              <Icon name="content_copy" size={18} />
            </button>
            {onDelete && (
              <button
                type="button"
                title="Xoá bài làm"
                onClick={(e) => {
                  e.preventDefault();
                  onDelete();
                }}
                className="cursor-pointer rounded-lg bg-white/95 p-1.5 text-ink-2 shadow-sm backdrop-blur transition-colors hover:text-danger"
              >
                <Icon name="delete" size={18} />
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-1 flex-col justify-between p-5">
          <div>
            <span className="mb-2 inline-block rounded-md bg-teal/10 px-2.5 py-0.5 text-[11px] font-semibold text-teal">
              {scenarioName}
            </span>
            <h3 className="line-clamp-1 text-[16px] font-semibold transition-colors group-hover:text-brand">
              {project.name}
            </h3>
            <div className="mt-2 flex items-center gap-1.5 text-[13px] text-ink-2">
              <Icon name="schedule" size={16} />
              <span>Sửa lần cuối {new Date(project.updatedAt).toLocaleString('vi-VN')}</span>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-brand-50 pt-4">
            <span className="flex items-center gap-1.5 text-[13px] font-medium text-ink-2">
              <Icon name="extension" size={18} className="text-brand" />
              {blockCount} khối lệnh
            </span>
            <span className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand transition-transform group-hover:translate-x-0.5">
              <span>Mở bài làm</span>
              <Icon name="arrow_forward" size={16} />
            </span>
          </div>
        </div>
      </Link>
    </div>
  );
}
