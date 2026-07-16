import React from 'react';

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ');
}

export function Panel({
  children,
  className,
}: React.PropsWithChildren<{ className?: string }>) {
  return <div className={cx('rounded-2xl border border-line bg-panel shadow-soft', className)}>{children}</div>;
}

export function SectionTitle({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <h1 className="text-xl font-semibold text-ink">{title}</h1>
        {description ? <p className="mt-1 text-sm text-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function Button({
  children,
  variant = 'primary',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
}) {
  const styles = {
    primary: 'bg-brand text-white hover:bg-blue-700',
    secondary: 'bg-panelAlt text-ink hover:bg-slate-100 border border-line',
    ghost: 'bg-transparent text-ink hover:bg-slate-100',
    danger: 'bg-rose-600 text-white hover:bg-rose-700',
  };

  return (
    <button
      className={cx(
        'inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60',
        styles[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input(props, ref) {
    return (
      <input
        {...props}
        ref={ref}
        className={cx('w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-brand', props.className)}
      />
    );
  },
);

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea(props, ref) {
    return (
      <textarea
        {...props}
        ref={ref}
        className={cx('w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-brand', props.className)}
      />
    );
  },
);

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function Select(props, ref) {
    return (
      <select
        {...props}
        ref={ref}
        className={cx('w-full rounded-xl border border-line bg-white px-3 py-2 text-sm outline-none ring-0 focus:border-brand', props.className)}
      />
    );
  },
);

export function Label({ children }: React.PropsWithChildren) {
  return <label className="mb-1 block text-sm font-medium text-ink">{children}</label>;
}

export function StatCard({ label, value, subtext }: { label: string; value: React.ReactNode; subtext?: React.ReactNode }) {
  return (
    <Panel className="p-4">
      <div className="text-sm text-muted">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-ink">{value}</div>
      {subtext ? <div className="mt-2 text-sm text-muted">{subtext}</div> : null}
    </Panel>
  );
}

export function Badge({ children, tone = 'neutral' }: React.PropsWithChildren<{ tone?: 'neutral' | 'green' | 'red' | 'blue' }>) {
  const tones = {
    neutral: 'bg-slate-100 text-slate-700',
    green: 'bg-emerald-100 text-emerald-700',
    red: 'bg-rose-100 text-rose-700',
    blue: 'bg-blue-100 text-blue-700',
  };
  return <span className={cx('inline-flex rounded-full px-2 py-1 text-xs font-medium', tones[tone])}>{children}</span>;
}

export function CopyButton({
  value,
  label = 'Copy',
}: {
  value: string;
  label?: string;
}) {
  const [copied, setCopied] = React.useState(false);
  return (
    <button
      type="button"
      className="rounded-xl border border-line bg-white px-3 py-2 text-sm hover:bg-slate-50"
      onClick={async () => {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? 'Copied' : label}
    </button>
  );
}
