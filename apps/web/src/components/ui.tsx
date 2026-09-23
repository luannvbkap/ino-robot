import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';
import { Icon } from './Icon';

/* ------------------------------- Nút bấm ------------------------------- */

type Variant = 'primary' | 'tonal' | 'ghost' | 'success' | 'danger';
type Size = 'sm' | 'md' | 'lg';

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-hover shadow-sm hover:shadow active:scale-[0.98] disabled:bg-slate-300 disabled:shadow-none disabled:active:scale-100',
  tonal: 'bg-brand-50 text-ink hover:bg-brand-100 disabled:text-ink-3',
  ghost: 'text-ink-2 hover:bg-brand-50 hover:text-ink disabled:text-ink-3/50',
  success: 'bg-teal text-white hover:brightness-110 shadow-sm disabled:bg-slate-300 disabled:shadow-none',
  danger: 'text-danger hover:bg-danger-bg/60 disabled:text-ink-3/50',
};

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-2.5 text-[12px] rounded-lg gap-1.5',
  md: 'h-10 px-4 text-[13px] rounded-xl gap-2',
  lg: 'h-12 px-6 text-[15px] rounded-xl gap-2',
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size };

export function Button({ variant = 'primary', size = 'md', className = '', ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={`inline-flex cursor-pointer items-center justify-center font-semibold whitespace-nowrap transition-all disabled:cursor-not-allowed ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
    />
  );
}

/* -------------------------------- Ô nhập ------------------------------- */

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string;
  labelRight?: ReactNode;
  icon?: string;
  trailing?: ReactNode;
  invalid?: boolean;
};

export function Field({
  label,
  labelRight,
  icon,
  trailing,
  invalid,
  className = '',
  ...props
}: FieldProps) {
  return (
    <label className="block text-left">
      {(label || labelRight) && (
        <span className="mb-1 flex items-center justify-between">
          {label && <span className="text-[13px] font-medium text-ink">{label}</span>}
          {labelRight}
        </span>
      )}
      <span className="relative flex items-center">
        {icon && (
          <Icon
            name={icon}
            className={`pointer-events-none absolute left-3.5 ${invalid ? 'text-danger' : 'text-ink-3'}`}
          />
        )}
        <input
          {...props}
          className={`w-full rounded-xl py-2.5 text-[14px] outline-none transition-all placeholder:text-ink-3 ${
            icon ? 'pl-11' : 'pl-4'
          } ${trailing ? 'pr-11' : 'pr-4'} ${
            invalid
              ? 'border-2 border-danger/60 bg-danger-bg/25 text-danger'
              : 'border border-transparent bg-brand-50 text-ink focus:border-brand focus:bg-white focus:ring-2 focus:ring-brand/20'
          } ${className}`}
        />
        {trailing && <span className="absolute right-3.5 flex items-center">{trailing}</span>}
      </span>
    </label>
  );
}

/* ------------------------------- Mảnh nhỏ ------------------------------ */

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-brand-100 bg-white shadow-sm ${className}`}>{children}</div>
  );
}

export function Dot({ className = 'bg-teal' }: { className?: string }) {
  return <span className={`inline-block size-2.5 shrink-0 animate-pulse rounded-full ${className}`} />;
}

export function ErrorBanner({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 rounded-xl bg-danger-bg p-3 text-left">
      <Icon name="error" className="mt-0.5 shrink-0 text-danger" />
      <div className="flex-1 text-xs">
        <p className="font-semibold text-danger">{title}</p>
        {children && <p className="mt-0.5 text-danger-ink">{children}</p>}
      </div>
    </div>
  );
}

export function Spinner({ label = 'Đang tải…' }: { label?: string }) {
  return <div className="flex h-full items-center justify-center p-10 text-sm text-ink-3">{label}</div>;
}

/** Nhãn cho vùng chưa làm, kèm mốc phát triển — để demo không bị hiểu nhầm là lỗi */
export function Placeholder({
  icon = 'construction',
  title,
  note,
  dark = false,
}: {
  icon?: string;
  title: string;
  note: string;
  dark?: boolean;
}) {
  return (
    <div
      className={`flex h-full flex-col items-center justify-center gap-1.5 p-6 text-center ${
        dark ? 'text-slate-500' : 'text-ink-3'
      }`}
    >
      <Icon name={icon} size={26} className="opacity-50" />
      <span className={`text-[13px] font-semibold ${dark ? 'text-slate-300' : 'text-ink-2'}`}>{title}</span>
      <span className="text-[11px] opacity-80">{note}</span>
    </div>
  );
}

/* -------------------------- Thông báo nổi (toast) ---------------------- */

const ToastCtx = createContext<(msg: string) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null);

  const notify = useCallback((text: string) => {
    setMsg(text);
    setTimeout(() => setMsg((m) => (m === text ? null : m)), 2500);
  }, []);

  const value = useMemo(() => notify, [notify]);

  return (
    <ToastCtx.Provider value={value}>
      {children}
      {msg && (
        <div className="fixed top-20 right-6 z-50 flex items-center gap-2 rounded-xl bg-ink px-4 py-2.5 text-xs font-medium text-white shadow-lg">
          <Icon name="check_circle" size={16} className="text-teal-light" />
          <span>{msg}</span>
        </div>
      )}
    </ToastCtx.Provider>
  );
}
