import { useEffect, useRef } from 'react';
import * as Blockly from 'blockly/core';
import * as Vi from 'blockly/msg/vi';
import {
  CATEGORY_ORDER,
  flyoutContents,
  generateCpp,
  initialToolbox,
  registerInoBlocks,
} from '@ino/blocks';
import { useToast } from '@/components/ui';

// Giao diện Blockly tiếng Việt có sẵn, không phải tự dịch
Blockly.setLocale(Vi as unknown as Record<string, string>);
registerInoBlocks();

/** Bảng màu Blockly khớp với hệ màu của ứng dụng */
const INO_THEME = Blockly.Theme.defineTheme('ino', {
  name: 'ino',
  base: Blockly.Themes.Classic,
  // Khối tiêu chuẩn của Blockly dùng bảng màu riêng — kéo về đúng màu nhóm của INO
  blockStyles: {
    logic_blocks: { colourPrimary: '#16a34a' },
    loop_blocks: { colourPrimary: '#f59e0b' },
    math_blocks: { colourPrimary: '#632ecd' },
    variable_blocks: { colourPrimary: '#ea580c' },
    variable_dynamic_blocks: { colourPrimary: '#ea580c' },
  },
  componentStyles: {
    workspaceBackgroundColour: '#f5f8ff',
    toolboxBackgroundColour: '#ffffff',
    flyoutBackgroundColour: '#ffffff',
    flyoutOpacity: 1,
    scrollbarColour: '#94a3b8',
    insertionMarkerColour: '#004ac6',
    insertionMarkerOpacity: 0.4,
    cursorColour: '#004ac6',
  },
  fontStyle: { family: "'Be Vietnam Pro', system-ui, sans-serif", size: 11 },
});

export interface WorkspaceChange {
  /** Nội dung khối lệnh, lưu xuống cơ sở dữ liệu */
  workspace: object;
  /** Mã C++ sinh ra từ khối lệnh */
  cpp: string;
  blockCount: number;
}

export function BlocklyCanvas({
  initial,
  categoryIndex,
  onChange,
  onReady,
}: {
  initial: unknown;
  categoryIndex: number;
  onChange: (change: WorkspaceChange) => void;
  onReady?: () => void;
}) {
  const host = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<Blockly.WorkspaceSvg | null>(null);
  const latest = useRef(onChange);
  latest.current = onChange;
  const currentCategory = useRef(categoryIndex);
  currentCategory.current = categoryIndex;
  const notify = useToast();
  const notifyRef = useRef(notify);
  notifyRef.current = notify;

  /* ------------------------- Khởi tạo một lần ------------------------- */
  useEffect(() => {
    if (!host.current) return;

    const ws = Blockly.inject(host.current, {
      // Ngăn kéo không có cột nhóm — cột nhóm là phần biểu tượng riêng của app,
      // nội dung ngăn kéo do effect bên dưới bơm vào theo nhóm đang chọn.
      toolbox: initialToolbox(),
      theme: INO_THEME,
      renderer: 'zelos', // kiểu khối bo tròn giống Scratch, hợp với học sinh
      grid: { spacing: 24, length: 3, colour: '#dbe3f5', snap: true },
      zoom: { controls: false, wheel: true, startScale: 0.9, minScale: 0.5, maxScale: 1.6 },
      move: { scrollbars: true, drag: true, wheel: true },
      trashcan: true,
      sounds: false,
      // Chương trình chỉ có một điểm bắt đầu; kéo ra cái thứ hai sẽ bị chặn
      maxInstances: { ino_on_start: 1 },
    });
    wsRef.current = ws;

    // Chỉ ở chế độ phát triển: mở lối vào Blockly từ console trình duyệt,
    // dùng để gỡ lỗi và cho kiểm thử tự động. Bản phát hành không có.
    if (import.meta.env.DEV) {
      (window as unknown as { Blockly: typeof Blockly }).Blockly = Blockly;
    }

    // Nạp bài làm đã lưu; bài mới thì đặt sẵn khối "khi bấm vào nút Chạy"
    try {
      const saved = initial as { blocks?: { blocks?: unknown[] } } | null;
      if (saved?.blocks?.blocks?.length) {
        Blockly.serialization.workspaces.load(saved, ws);
      } else {
        seedStartBlock(ws);
      }
    } catch {
      seedStartBlock(ws);
    }

    const emit = () => {
      if (ws.isDragging()) return;
      latest.current({
        workspace: Blockly.serialization.workspaces.save(ws),
        cpp: generateCpp(ws),
        blockCount: ws.getAllBlocks(false).length,
      });
    };

    ws.addChangeListener((e: Blockly.Events.Abstract) => {
      if (e.isUiEvent) return;

      // Ngăn kéo do app tự bơm nội dung nên Blockly không tự làm mới nó.
      // Khi học sinh tạo/xoá/đổi tên biến, phải vẽ lại nhóm Biến số.
      const VAR_EVENTS: string[] = [
        Blockly.Events.VAR_CREATE,
        Blockly.Events.VAR_DELETE,
        Blockly.Events.VAR_RENAME,
      ];
      if (VAR_EVENTS.includes(e.type)) {
        // Nếu đang mở nhóm Biến số thì vẽ lại ngăn kéo cho có khối mới
        if (CATEGORY_ORDER[currentCategory.current] === 'variables') {
          showCategory(ws, currentCategory.current);
        }

        // Báo cho học sinh biết đã tạo được, kèm chỉ dẫn tìm khối ở đâu
        if (e.type === Blockly.Events.VAR_CREATE) {
          const name = (e as Blockly.Events.VarCreate).varName;
          notifyRef.current(
            CATEGORY_ORDER[currentCategory.current] === 'variables'
              ? `Đã tạo biến "${name}" — khối mới đã có trong ngăn kéo`
              : `Đã tạo biến "${name}" — xem trong nhóm Biến số`,
          );
        }
      }

      emit();
    });

    emit();
    onReady?.();

    // Lúc inject xong, khung chứa có thể chưa có kích thước cuối cùng
    // (ngăn kéo chưa bơm khối, bố cục flex còn đang dàn).
    // Đợi một khung hình rồi mới đo lại và đưa chương trình vào giữa tầm nhìn.
    requestAnimationFrame(() => {
      Blockly.svgResize(ws);
      ws.scrollCenter();
    });

    const resize = () => Blockly.svgResize(ws);
    window.addEventListener('resize', resize);
    // Khung có thể bị kéo rộng hẹp mà không đổi kích thước cửa sổ
    const observer = new ResizeObserver(resize);
    observer.observe(host.current);

    return () => {
      window.removeEventListener('resize', resize);
      observer.disconnect();
      ws.dispose();
      wsRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* --------- Bơm khối của nhóm đang chọn vào ngăn kéo --------- */
  useEffect(() => {
    if (wsRef.current) showCategory(wsRef.current, categoryIndex);
  }, [categoryIndex]);

  return <div ref={host} className="h-full w-full" />;
}

/** Bơm khối của một nhóm vào ngăn kéo */
function showCategory(ws: Blockly.WorkspaceSvg, index: number) {
  const flyout = ws.getFlyout();
  if (!flyout) return;

  const category = CATEGORY_ORDER[index] ?? CATEGORY_ORDER[0]!;
  flyout.show(flyoutContents(category) as never);

  // Ngăn kéo đổi chiều rộng thì vùng làm việc phải tính lại kích thước
  Blockly.svgResize(ws);
}

/** Bài làm mới luôn có sẵn khối bắt đầu để học sinh biết ghép vào đâu */
function seedStartBlock(ws: Blockly.WorkspaceSvg) {
  const block = ws.newBlock('ino_on_start');
  block.initSvg();
  block.moveBy(40, 40);
  block.render();
}
