import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Pause, Play, Square } from 'lucide-react';

import { api } from '@/lib/api';
import { Button, Spinner } from '@/components/ui';

/**
 * Màn hình soạn thảo — bố cục theo PTTK-02 mục 9.
 * M0 mới dựng khung; ba vùng bên dưới sẽ được lấp dần:
 *   M1 → Blockly, M2 → chạy từng bước, M3/M4 → viewport 3D.
 */
export default function EditorPage() {
  const { id = '' } = useParams();

  const { data, isLoading, error } = useQuery({
    queryKey: ['project', id],
    queryFn: () => api.projects.get(id),
    enabled: Boolean(id),
  });

  if (isLoading) return <Spinner />;
  if (error || !data) {
    return (
      <div className="p-10 text-center text-sm text-slate-500">
        Không mở được bài làm.{' '}
        <Link to="/" className="text-ino-600 hover:underline">
          Quay lại
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-2">
        <Link to="/">
          <Button variant="ghost">
            <ArrowLeft className="size-4" />
          </Button>
        </Link>
        <span className="font-medium">{data.project.name}</span>

        <div className="ml-auto flex items-center gap-1">
          <Button disabled>
            <Play className="size-4" />
            Chạy
          </Button>
          <Button variant="ghost" disabled>
            <Pause className="size-4" />
          </Button>
          <Button variant="ghost" disabled>
            <Square className="size-4" />
          </Button>
        </div>
      </header>

      <div className="grid flex-1 grid-cols-1 gap-px bg-slate-200 lg:grid-cols-[1fr_1fr]">
        <Placeholder title="Khu vực kéo thả khối lệnh" note="Sẽ làm ở mốc M1 — Blockly" />
        <div className="grid grid-rows-2 gap-px bg-slate-200">
          <Placeholder title="Robot ảo 3D" note="Sẽ làm ở mốc M3 — Three.js" />
          <Placeholder title="Mã C++" note="Sẽ làm ở mốc M1 — bộ sinh mã" />
        </div>
      </div>
    </div>
  );
}

function Placeholder({ title, note }: { title: string; note: string }) {
  return (
    <div className="flex flex-col items-center justify-center bg-white p-6 text-center">
      <span className="font-medium text-slate-600">{title}</span>
      <span className="mt-1 text-xs text-slate-400">{note}</span>
    </div>
  );
}
