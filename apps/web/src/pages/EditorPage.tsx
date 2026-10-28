import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { api } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { useFullscreen } from '@/lib/use-fullscreen';
import { Button, Spinner, useToast } from '@/components/ui';
import { Icon } from '@/components/Icon';
import { Mascot } from '@/components/Logo';
import { ResizeHandle, clamp, usePersistedLayout } from '@/components/Resizer';
import {
  BlocklyCanvas,
  type BlocklyApi,
  type WorkspaceChange,
} from '@/features/blockly/BlocklyCanvas';
import { useRunner } from '@/features/run/useRunner';
import { RunPanel } from '@/features/run/RunPanel';
import { CodePanel, type CodeTheme } from '@/features/blockly/CodePanel';
import { BlocklyDialogs } from '@/features/blockly/BlocklyDialogs';
import { specOf, startPoseOf } from '@/features/simulator/scenario';
import { trackSave, waitForSaves } from '@/lib/pending-saves';
import type { UpdateProjectInput } from '@ino/shared';

/** Nhóm khối lệnh — màu và biểu tượng lấy từ thiết kế */
const CATEGORIES = [
  { id: 'motion', label: 'Chuyển động', icon: 'directions_run', chip: 'bg-brand/10 text-brand', dot: 'bg-brand' },
  { id: 'sensors', label: 'Cảm biến', icon: 'sensors', chip: 'bg-teal/10 text-teal', dot: 'bg-teal' },
  { id: 'control', label: 'Điều khiển', icon: 'repeat', chip: 'bg-amber-500 text-white', dot: 'bg-amber-500' },
  { id: 'logic', label: 'Logic', icon: 'alt_route', chip: 'bg-emerald-600/10 text-emerald-700', dot: 'bg-emerald-600' },
  { id: 'math', label: 'Toán', icon: 'calculate', chip: 'bg-grape/10 text-grape', dot: 'bg-grape' },
  { id: 'variables', label: 'Biến số', icon: 'data_object', chip: 'bg-orange-500/10 text-orange-600', dot: 'bg-orange-500' },
  { id: 'serial', label: 'Hiển thị', icon: 'terminal', chip: 'bg-slate-600/10 text-slate-600', dot: 'bg-slate-600' },
] as const;

/** Kích thước mặc định của các khung, tính bằng pixel */
const DEFAULTS = {
  right: 430,
  toolsOpen: true,
  rightOpen: true,
  /** true = cột phải hiện mã C++, false = cột phải hiện robot ảo */
  codeOpen: true,
  /** true = khung mã nguồn nền tối */
  codeDark: false,
};

const LIMITS = {
  right: [300, 820],
} as const;

type SaveState = 'idle' | 'saving' | 'saved';

export default function EditorPage() {
  const { id = '' } = useParams();
  const user = useAuthStore((s) => s.user);
  const notify = useToast();

  const [activeCategory, setActiveCategory] = useState<string>('control');
  const [title, setTitle] = useState('');
  const [editingTitle, setEditingTitle] = useState(false);
  const [save, setSave] = useState<SaveState>('idle');
  const { isFull, toggle: toggleFullscreen } = useFullscreen();

  /** Nội dung khối lệnh và mã C++ sinh ra, cập nhật mỗi khi kéo thả */
  const [cpp, setCpp] = useState('');
  const [blockCount, setBlockCount] = useState(0);
  const [blocklyApi, setBlocklyApi] = useState<BlocklyApi | null>(null);
  const firstChange = useRef(true);

  /** Bố cục do người dùng kéo chỉnh, nhớ lại ở lần mở sau */
  const [layout, setLayout] = usePersistedLayout('ino.editor.layout', DEFAULTS);

  const { data, isLoading, error } = useQuery({
    queryKey: ['project', id],
    // Đợi lần lưu đang gửi dở (nếu vừa rời trang rồi quay lại ngay) xong rồi
    // mới tải, nếu không sẽ nhận về bản cũ
    queryFn: async () => {
      await waitForSaves(id);
      return api.projects.get(id);
    },
    enabled: Boolean(id),
    // KHÔNG giữ bài làm trong bộ nhớ đệm. Blockly chỉ nạp nội dung một lần lúc
    // mở; nếu mở bằng bản đệm cũ thì bản mới tải về sau đó bị bỏ qua — học sinh
    // thấy bài lưu của lần trước nữa, sửa tiếp là ghi đè mất bản mới.
    gcTime: 0,
    // Bài làm chỉ được sửa ở đây; tải lại lúc quay về tab có thể đè lên tên đang gõ
    refetchOnWindowFocus: false,
  });

  /** Cấu hình robot và kịch bản là file tĩnh trên máy chủ, tải một lần là đủ */
  const robots = useQuery({ queryKey: ['robots'], queryFn: api.robots, staleTime: Infinity });
  const scenarios = useQuery({ queryKey: ['scenarios'], queryFn: api.scenarios, staleTime: Infinity });
  const robot = robots.data?.robots.find((r) => r.id === data?.project.robotId);
  const scenario = scenarios.data?.scenarios.find((s) => s.id === data?.project.scenarioId);

  const setup = useMemo(() => ({ spec: specOf(robot), start: startPoseOf(scenario) }), [robot, scenario]);
  const run = useRunner(blocklyApi, setup);

  /* ---------------- Ảnh thu nhỏ cho thẻ bài làm ---------------- */

  const qc = useQueryClient();

  /* ------------------------------ Tự động lưu ------------------------------ */

  /** Thay đổi chưa gửi lên máy chủ — gom lại để gửi chung một lần */
  const unsaved = useRef<UpdateProjectInput>({});
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Gửi NGAY mọi thay đổi đang chờ. Dùng cả lúc rời trang nên không đụng tới
   * state của React. Gửi lỗi thì trả thay đổi về hàng chờ để lần sau gửi lại.
   */
  const flush = useCallback(() => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
      saveTimer.current = null;
    }
    const changes = unsaved.current;
    if (Object.keys(changes).length === 0) return null;
    unsaved.current = {};

    const sending = api.projects.update(id, changes).catch((err: unknown) => {
      unsaved.current = { ...changes, ...unsaved.current };
      throw err;
    });
    return trackSave(id, sending);
  }, [id]);

  /** Xếp thay đổi vào hàng chờ, gửi sau `delay` ms kể từ thao tác cuối cùng */
  function queueSave(changes: UpdateProjectInput, delay: number) {
    unsaved.current = { ...unsaved.current, ...changes };
    setSave('saving');
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      const sending = flush();
      if (!sending) return;
      try {
        await sending;
        setSave('saved');
        void qc.invalidateQueries({ queryKey: ['projects'] });
      } catch {
        setSave('idle');
        notify('Không lưu được bài làm, kiểm tra lại kết nối');
      }
    }, delay);
  }

  // Rời trang soạn thảo (về trang chủ, sang bài khác) mà còn thay đổi chưa
  // gửi thì gửi ngay — trước đây lần lưu bị huỷ luôn
  useEffect(
    () => () => {
      void flush()
        ?.then(() => qc.invalidateQueries({ queryKey: ['projects'] }))
        .catch(() => {});
    },
    [flush, qc],
  );

  // Đóng tab hoặc tải lại trang khi còn thay đổi chưa lưu: gửi ngay và hỏi lại
  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (Object.keys(unsaved.current).length === 0) return;
      void flush()?.catch(() => {});
      e.preventDefault();
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [flush]);

  /* ------------------------ Ảnh thu nhỏ cho thẻ bài làm ------------------------ */

  const capture = useRef<(() => string | null) | null>(null);
  const onCaptureReady = useCallback((fn: (() => string | null) | null) => {
    capture.current = fn;
  }, []);

  /** Chụp sa bàn lúc robot vừa chạy xong rồi lưu làm ảnh của bài làm */
  const saveThumbnail = useCallback(async () => {
    const image = capture.current?.();
    if (!image) return;
    try {
      await trackSave(id, api.projects.update(id, { thumbnail: image }));
      void qc.invalidateQueries({ queryKey: ['projects'] });
    } catch {
      // Ảnh thu nhỏ chỉ để trang trí — lưu không được thì lần chạy sau lưu lại
    }
  }, [id, qc]);

  useEffect(() => {
    if (run.status === 'finished' || run.status === 'error') void saveThumbnail();
  }, [run.status, saveThumbnail]);

  /** Bấm dừng: chụp trước, vì dừng xong robot về lại chỗ xuất phát */
  function onStop() {
    void saveThumbnail();
    run.stop();
  }

  useEffect(() => {
    if (data) setTitle(data.project.name);
  }, [data]);

  /** Đổi tên bài làm — tự lưu sau khi ngừng gõ 800ms */
  function onRename(value: string) {
    setTitle(value);
    if (value.trim()) queueSave({ name: value.trim() }, 800);
  }

  /**
   * Bấm Chạy mà cột phải đang hiện mã nguồn (hoặc đang bị ẩn) thì học sinh
   * không thấy robot chạy — mở sẵn khung mô phỏng rồi mới chạy.
   */
  function onRun() {
    setLayout((l) => ({ ...l, rightOpen: true, codeOpen: false }));
    run.start();
  }

  /**
   * Lưu khối lệnh — chờ 2 giây sau khi ngừng thao tác rồi mới gửi lên máy chủ,
   * để một lần kéo thả không bắn hàng chục request.
   */
  function onWorkspaceChange({ workspace, cpp: code, blockCount: n }: WorkspaceChange) {
    setCpp(code);
    setBlockCount(n);

    // Lần đầu là lúc vừa nạp bài làm lên, chưa có gì thay đổi để lưu
    if (firstChange.current) {
      firstChange.current = false;
      return;
    }

    queueSave({ workspace }, 2000);
  }

  if (isLoading) return <Spinner />;
  if (error || !data) {
    return (
      <div className="p-10 text-center text-sm text-ink-2">
        Không mở được bài làm.{' '}
        <Link to="/" className="font-semibold text-brand hover:underline">
          Quay lại danh sách
        </Link>
      </div>
    );
  }

  const scenarioLabel =
    scenario?.name ?? (data.project.scenarioId === 'line-follow' ? 'Dò vạch kẻ' : 'Tránh vật cản');

  return (
    <div className="flex h-full flex-col overflow-hidden select-none">
      <BlocklyDialogs />
      {/* ------- Thanh điều hướng toàn cục — ẩn khi vào toàn màn hình ------- */}
      {!isFull && (
        <header className="z-40 flex h-14 shrink-0 items-center justify-between border-b border-brand-100 bg-white/95 px-4 shadow-[0_1px_8px_rgba(0,0,0,0.04)] backdrop-blur-md">
          <Link to="/" className="flex items-center gap-2" title="Quay về Bảng điều khiển">
            <Mascot size={32} />
            <span className="text-[16px] font-bold tracking-tight text-brand">INO Robot Studio</span>
          </Link>

          <nav className="hidden items-center gap-1 rounded-xl bg-brand-50 p-1 lg:flex">
            <span className="rounded-lg bg-white px-3 py-1 text-[13px] font-semibold text-brand shadow-sm">
              Trình soạn thảo
            </span>
            <button
              onClick={() => setLayout((l) => ({ ...l, rightOpen: true }))}
              className="cursor-pointer rounded-lg px-3 py-1 text-[13px] font-medium text-ink-2 transition-colors hover:bg-white/60 hover:text-ink"
            >
              Mô phỏng 3D
            </button>
          </nav>

          <div className="flex items-center gap-3">
            <span
              className="flex items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-[12px] font-medium text-ink-2"
              title="Phiên bản này chạy mô phỏng, chưa nối với robot thật"
            >
              <span className="size-2 animate-pulse rounded-full bg-teal" />
              <span>Chế độ mô phỏng</span>
            </span>

            <span className="flex size-8 items-center justify-center rounded-full bg-brand text-[13px] font-bold text-white shadow-sm">
              {user?.displayName.trim().slice(0, 1).toUpperCase()}
            </span>
          </div>
        </header>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* ------------------------ Cột công cụ bên trái ----------------------- */}
        {layout.toolsOpen && (
          <aside className="z-20 flex w-56 shrink-0 flex-col justify-between border-r border-brand-100 bg-white">
            <div>
              <div className="flex items-center justify-between border-b border-brand-50 p-3.5">
                <span className="text-[11px] font-bold tracking-wider text-ink-2 uppercase">
                  Cụm lệnh &amp; Công cụ
                </span>
                <Icon name="category" size={18} className="text-ink-3" />
              </div>

              <nav className="flex flex-col gap-1 p-2">
                <span className="flex items-center gap-2.5 rounded-xl bg-brand-200 px-3 py-2 text-[13px] font-semibold text-brand">
                  <Icon name="smart_toy" size={19} />
                  Không gian lập trình
                </span>
                <button
                  onClick={() => setLayout((l) => ({ ...l, rightOpen: true }))}
                  className="flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[13px] font-medium text-ink-2 transition-colors hover:bg-brand-50 hover:text-ink"
                >
                  <Icon name="view_in_ar" size={19} className="text-teal" />
                  Đấu trường mô phỏng
                </button>
              </nav>
            </div>

            <div className="m-2.5 rounded-xl border border-brand-200 bg-brand-50 p-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[11px] font-medium text-ink-2">Bo mạch mô phỏng</span>
                <span className="text-[11px] font-bold text-teal">ESP32</span>
              </div>
              <p className="text-[10px] leading-snug text-ink-3">
                Chương trình chạy hoàn toàn trên trình duyệt. Chức năng nạp xuống robot thật sẽ có ở
                phiên bản sau.
              </p>
            </div>
          </aside>
        )}

        {/* ------------------------- Cột giữa: làm việc ------------------------ */}
        <div className="flex min-w-0 flex-1 flex-col bg-page">
          {/* Thanh công cụ */}
          <div className="z-30 flex h-14 shrink-0 items-center justify-between gap-3 border-b border-brand-100 bg-white px-4 shadow-sm">
            <div className="flex min-w-0 items-center gap-3">
              <Link
                to="/"
                title="Quay lại danh sách dự án"
                className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-ink transition-colors hover:bg-brand-200"
              >
                <Icon name="arrow_back" />
              </Link>

              <button
                onClick={() => setLayout((l) => ({ ...l, toolsOpen: !l.toolsOpen }))}
                title={layout.toolsOpen ? 'Thu gọn cột công cụ' : 'Mở cột công cụ'}
                className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-ink-2 transition-colors hover:bg-brand-50"
              >
                <Icon name={layout.toolsOpen ? 'left_panel_close' : 'left_panel_open'} />
              </button>

              <div className="flex min-w-0 items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-1">
                <Icon name="smart_toy" size={18} className="shrink-0 text-brand" />
                {editingTitle ? (
                  <input
                    autoFocus
                    value={title}
                    maxLength={80}
                    onChange={(e) => onRename(e.target.value)}
                    onBlur={() => setEditingTitle(false)}
                    onKeyDown={(e) => e.key === 'Enter' && setEditingTitle(false)}
                    className="w-40 rounded border border-brand bg-white px-1.5 py-0.5 text-[14px] font-semibold outline-none"
                  />
                ) : (
                  <span
                    onClick={() => setEditingTitle(true)}
                    className="max-w-[180px] cursor-pointer truncate text-[14px] font-semibold hover:text-brand"
                  >
                    {title}
                  </span>
                )}
                <button
                  onClick={() => setEditingTitle((v) => !v)}
                  className="shrink-0 cursor-pointer text-ink-3 hover:text-brand"
                  title="Đổi tên bài làm"
                >
                  <Icon name="edit" size={15} />
                </button>
              </div>

              <SaveIndicator state={save} />
            </div>

            {/* Cụm nút điều khiển chạy */}
            <div className="flex shrink-0 items-center rounded-lg border border-brand-200 bg-brand-50 p-1">
              <Button
                variant="success"
                size="sm"
                onClick={run.isPaused ? run.resume : onRun}
                disabled={!run.canRun}
                title={
                  run.canRun
                    ? run.isPaused
                      ? 'Chạy tiếp'
                      : 'Chạy chương trình'
                    : 'Hãy kéo khối lệnh vào vùng lập trình trước'
                }
              >
                <Icon name="play_arrow" size={18} />
                {run.isPaused ? 'Tiếp' : 'Chạy'}
              </Button>

              <button
                onClick={run.pause}
                disabled={!run.isRunning}
                title="Tạm dừng"
                className="flex h-8 w-9 cursor-pointer items-center justify-center rounded-md text-ink-2 transition-colors hover:bg-brand-200 disabled:cursor-not-allowed disabled:text-ink-3/40 disabled:hover:bg-transparent"
              >
                <Icon name="pause" />
              </button>

              <button
                onClick={onStop}
                disabled={run.status === 'idle'}
                title="Dừng và đưa robot về vị trí xuất phát"
                className="flex h-8 w-9 cursor-pointer items-center justify-center rounded-md text-danger transition-colors hover:bg-danger-bg/60 disabled:cursor-not-allowed disabled:text-ink-3/40 disabled:hover:bg-transparent"
              >
                <Icon name="stop" size={18} />
              </button>

              <span className="mx-1 h-5 w-px bg-brand-300" />

              {(
                [
                  ['slow', '🐢', 'Chậm'],
                  ['normal', '🚗', 'Vừa'],
                  ['fast', '⚡', 'Nhanh'],
                ] as const
              ).map(([value, icon, label]) => (
                <button
                  key={value}
                  onClick={() => run.setSpeed(value)}
                  title={`Tốc độ ${label.toLowerCase()}`}
                  className={`cursor-pointer rounded-md px-2 py-1 text-[12px] font-medium transition-colors ${
                    run.speed === value
                      ? 'bg-white text-ink shadow-sm'
                      : 'text-ink-2 hover:bg-brand-200'
                  }`}
                >
                  {icon} {label}
                </button>
              ))}
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <span className="hidden items-center gap-1.5 rounded-lg bg-brand-50 px-3 py-1.5 text-[13px] font-medium md:flex">
                <Icon name="alt_route" size={17} className="text-teal" />
                Kịch bản: {scenarioLabel}
              </span>

              {/* Nhóm nút bố cục — luôn nằm ở đây để khi ẩn thanh trên vẫn bấm được */}
              <span className="flex items-center gap-1 border-l border-brand-100 pl-2">
                <button
                  onClick={() => setLayout((l) => ({ ...l, codeOpen: !l.codeOpen }))}
                  title={layout.codeOpen ? 'Ẩn mã nguồn, xem robot ảo' : 'Xem mã C++ toàn cột'}
                  className={`flex size-8 cursor-pointer items-center justify-center rounded-lg transition-colors ${
                    layout.codeOpen ? 'bg-brand-100 text-brand' : 'text-ink-2 hover:bg-brand-50'
                  }`}
                >
                  <Icon name="code" />
                </button>

                <button
                  onClick={() => setLayout((l) => ({ ...l, rightOpen: !l.rightOpen }))}
                  title={
                    layout.rightOpen ? 'Ẩn khung mô phỏng và mã nguồn' : 'Hiện khung mô phỏng và mã nguồn'
                  }
                  className="flex size-8 cursor-pointer items-center justify-center rounded-lg text-ink-2 transition-colors hover:bg-brand-50"
                >
                  <Icon name={layout.rightOpen ? 'right_panel_close' : 'right_panel_open'} />
                </button>

                <button
                  onClick={async () => {
                    const entering = !isFull;
                    await toggleFullscreen();
                    if (entering) notify('Toàn màn hình — nhấn Esc để thoát');
                  }}
                  title={isFull ? 'Thoát toàn màn hình (Esc)' : 'Toàn màn hình'}
                  className={`flex size-8 cursor-pointer items-center justify-center rounded-lg transition-colors ${
                    isFull ? 'bg-brand text-white' : 'text-ink-2 hover:bg-brand-50'
                  }`}
                >
                  <Icon name={isFull ? 'fullscreen_exit' : 'fullscreen'} />
                </button>
              </span>
            </div>
          </div>

          {/* Thân: ngăn kéo khối + canvas + mô phỏng */}
          <div className="flex flex-1 overflow-hidden">
            {/* Cột biểu tượng nhóm khối — luôn hiện */}
            <div className="z-10 flex w-[68px] shrink-0 flex-col items-center gap-1 overflow-y-auto border-r border-brand-100 bg-brand-50 py-2">
              {CATEGORIES.map((c) => {
                const active = activeCategory === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setActiveCategory(c.id)}
                    className={`flex w-14 cursor-pointer flex-col items-center gap-1 rounded-xl py-2 transition-colors ${
                      active ? 'bg-white shadow-sm' : 'text-ink-2 hover:bg-brand-200/60'
                    }`}
                  >
                    <span className={`flex size-7 items-center justify-center rounded-lg ${c.chip}`}>
                      <Icon name={c.icon} size={18} />
                    </span>
                    <span className={`text-[10px] leading-none ${active ? 'font-bold' : 'font-medium'}`}>
                      {c.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Vùng lắp khối lệnh — Blockly, ngăn kéo nằm luôn bên trong */}
            <div className="ino-blockly relative flex min-w-0 flex-1 flex-col overflow-hidden">
              <div className="pointer-events-none absolute top-3 right-3 z-10 flex items-center gap-2 rounded-full border border-brand-100 bg-white/95 px-3 py-1.5 shadow-sm backdrop-blur">
                <Icon name="extension" size={16} className="text-brand" />
                <span className="text-[12px] font-semibold text-ink-2">{blockCount} khối lệnh</span>
              </div>

              <BlocklyCanvas
                initial={data.project.workspace}
                categoryIndex={CATEGORIES.findIndex((c) => c.id === activeCategory)}
                onChange={onWorkspaceChange}
                onReady={setBlocklyApi}
              />
            </div>

            {/* Mô phỏng + mã nguồn — kéo rộng hẹp được, ẩn được */}
            {layout.rightOpen ? (
              <>
                <ResizeHandle
                  axis="x"
                  title="Kéo để chỉnh rộng khung mô phỏng · Bấm đúp để đặt lại"
                  onResize={(d) => setLayout((l) => ({ ...l, right: clamp(l.right - d, ...LIMITS.right) }))}
                  onReset={() => setLayout((l) => ({ ...l, right: DEFAULTS.right }))}
                />

                {/* Cột phải chỉ có một trong hai: mã nguồn HOẶC robot ảo */}
                <aside
                  className={`z-20 flex shrink-0 flex-col overflow-hidden border-l ${
                    layout.codeOpen && layout.codeDark
                      ? 'border-slate-700 bg-[#0c1322]'
                      : 'border-brand-100 bg-white'
                  }`}
                  style={{ width: layout.right }}
                >
                  {layout.codeOpen ? (
                    <CodePanel
                      code={cpp}
                      theme={(layout.codeDark ? 'dark' : 'light') as CodeTheme}
                      onToggleTheme={() => setLayout((l) => ({ ...l, codeDark: !l.codeDark }))}
                    />
                  ) : (
                    <RunPanel
                      scenario={scenario}
                      state={run.robotState}
                      liveState={run.liveState}
                      running={run.isRunning}
                      output={run.output}
                      onCaptureReady={onCaptureReady}
                    />
                  )}
                </aside>
              </>
            ) : (
              <button
                onClick={() => setLayout((l) => ({ ...l, rightOpen: true }))}
                title="Hiện khung mô phỏng và mã nguồn"
                className="z-20 flex w-9 shrink-0 cursor-pointer flex-col items-center gap-2 border-l border-brand-100 bg-white py-3 text-ink-2 transition-colors hover:bg-brand-50"
              >
                <Icon name="right_panel_open" size={18} />
                <span className="text-[11px] font-medium [writing-mode:vertical-rl]">Mô phỏng</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === 'idle') return null;
  const saving = state === 'saving';
  return (
    <span
      className={`hidden shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium sm:flex ${
        saving ? 'bg-brand-50 text-ink-2' : 'bg-teal-light/30 text-teal-ink'
      }`}
    >
      <span className={`size-1.5 rounded-full ${saving ? 'bg-ink-3' : 'animate-pulse bg-teal'}`} />
      {saving ? 'Đang lưu…' : 'Đã lưu tự động'}
    </span>
  );
}
