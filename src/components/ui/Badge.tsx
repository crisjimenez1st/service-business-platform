import type { ReactNode } from 'react';

type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info' | 'brand';

interface BadgeProps {
  children: ReactNode;
  tone?: Tone;
}

const TONE_CLASSES: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-700',
  success: 'bg-emerald-100 text-emerald-800',
  warning: 'bg-amber-100 text-amber-800',
  danger: 'bg-red-100 text-red-700',
  info: 'bg-sky-100 text-sky-800',
  brand: 'bg-brand-100 text-brand-800',
};

export default function Badge({ children, tone = 'neutral' }: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap',
        TONE_CLASSES[tone],
      ].join(' ')}
    >
      {children}
    </span>
  );
}
