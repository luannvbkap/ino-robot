import { useMemo, useState } from 'react';
import { Icon } from '@/components/Icon';
import { useToast } from '@/components/ui';

export type CodeTheme = 'light' | 'dark';

/**
 * Tô màu cú pháp cho mã C++ — đủ dùng, không cần kéo cả thư viện highlight về.
 *
 * Quét MỘT lượt duy nhất bằng một biểu thức gộp. Nếu thay thế nhiều lượt chồng
 * nhau thì lượt sau sẽ khớp nhầm vào tên lớp CSS mà lượt trước vừa chèn
 * (ví dụ "text-sky-400" bị quy tắc bắt số ăn mất "400").
 */
const TOKEN =
  /(\/\/[^\n]*)|(#include\s+&lt;[^&\n]*&gt;)|\b(void|int|float|bool|true|false|while|for|if|else|return|delay|pow|random)\b|\b(setup|loop|ino)\b|\b(\d+)\b/g;

/** Thứ tự: ghi chú · #include · từ khoá · tên hàm và đối tượng · số */
const PALETTE: Record<CodeTheme, string[]> = {
  dark: [
    'text-slate-500 italic',
    'text-fuchsia-400',
    'text-sky-400',
    'text-amber-300',
    'text-emerald-300',
  ],
  light: [
    'text-slate-400 italic',
    'text-fuchsia-700',
    'text-sky-700',
    'text-amber-700',
    'text-emerald-700',
  ],
};

const SKIN: Record<CodeTheme, Record<string, string>> = {
  dark: {
    body: 'bg-[#0c1322] text-slate-200',
    bar: 'border-slate-800 bg-[#080d18]',
    tab: 'border-brand bg-[#0c1322] text-brand-400',
    button: 'text-slate-400 hover:bg-slate-800 hover:text-slate-100',
    gutter: 'bg-[#080d18] text-slate-600',
  },
  light: {
    body: 'bg-white text-ink',
    bar: 'border-brand-100 bg-brand-50',
    tab: 'border-brand bg-white text-brand',
    button: 'text-ink-2 hover:bg-brand-100 hover:text-ink',
    gutter: 'bg-brand-50 text-ink-3/70',
  },
};

function highlight(code: string, theme: CodeTheme) {
  const classes = PALETTE[theme];
  const escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  return escaped.replace(TOKEN, (match, ...groups) => {
    const index = groups.findIndex((g) => g !== undefined);
    return index === -1 ? match : `<span class="${classes[index]}">${match}</span>`;
  });
}

export function CodePanel({
  code,
  theme,
  onToggleTheme,
}: {
  code: string;
  theme: CodeTheme;
  onToggleTheme: () => void;
}) {
  const notify = useToast();
  const [copied, setCopied] = useState(false);
  const lines = useMemo(() => code.split('\n'), [code]);
  const html = useMemo(() => highlight(code, theme), [code, theme]);
  const skin = SKIN[theme];

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      notify('Đã sao chép mã nguồn');
      setTimeout(() => setCopied(false), 1500);
    } catch {
      notify('Trình duyệt không cho phép sao chép');
    }
  }

  return (
    <div className={`flex min-h-0 flex-1 flex-col overflow-hidden ${skin.body}`}>
      <div className={`flex h-10 shrink-0 items-center justify-between border-b pr-2 pl-3 ${skin.bar}`}>
        <span className={`flex items-center gap-1.5 rounded-t-md border-t-2 px-3 py-1 text-[12px] font-bold ${skin.tab}`}>
          <Icon name="code" size={15} />
          Mã C++ (Arduino)
        </span>

        <span className="flex items-center gap-1">
          <button
            onClick={onToggleTheme}
            title={theme === 'dark' ? 'Chuyển sang nền sáng' : 'Chuyển sang nền tối'}
            className={`flex cursor-pointer items-center rounded-lg p-1.5 transition-colors ${skin.button}`}
          >
            <Icon name={theme === 'dark' ? 'light_mode' : 'dark_mode'} size={16} />
          </button>

          <button
            onClick={copy}
            title="Sao chép mã nguồn"
            className={`flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-medium transition-colors ${skin.button}`}
          >
            <Icon name={copied ? 'check' : 'content_copy'} size={15} />
            {copied ? 'Đã chép' : 'Sao chép'}
          </button>
        </span>
      </div>

      <div className="custom-scrollbar min-h-0 flex-1 overflow-auto">
        <div className="flex min-w-max font-mono text-[12px] leading-[1.55]">
          <div className={`sticky left-0 shrink-0 px-2 py-3 text-right select-none ${skin.gutter}`}>
            {lines.map((_, i) => (
              <div key={i}>{i + 1}</div>
            ))}
          </div>
          <pre className="flex-1 py-3 pr-4 pl-3" dangerouslySetInnerHTML={{ __html: html }} />
        </div>
      </div>
    </div>
  );
}
