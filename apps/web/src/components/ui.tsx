import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react';

/* Vài component cơ bản. Khi cần nhiều hơn thì thay bằng shadcn/ui. */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger';
};

export function Button({ variant = 'primary', className = '', ...props }: ButtonProps) {
  const styles = {
    primary: 'bg-ino-600 text-white hover:bg-ino-700 disabled:bg-slate-300',
    ghost: 'bg-transparent text-slate-700 hover:bg-slate-100',
    danger: 'bg-transparent text-red-600 hover:bg-red-50',
  }[variant];

  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed ${styles} ${className}`}
    />
  );
}

type FieldProps = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string };

export function Field({ label, error, className = '', ...props }: FieldProps) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      <input
        {...props}
        className={`w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-ino-500 focus:ring-2 focus:ring-ino-100 ${className}`}
      />
      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}

export function Alert({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
      {children}
    </div>
  );
}

export function Spinner() {
  return (
    <div className="flex h-full items-center justify-center p-10 text-sm text-slate-400">
      Đang tải…
    </div>
  );
}
