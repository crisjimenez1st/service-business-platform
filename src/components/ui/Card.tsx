import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padded?: boolean;
}

export default function Card({ children, padded = true, className = '', ...rest }: CardProps) {
  return (
    <div
      className={[
        'bg-white rounded-2xl border border-slate-200 shadow-sm',
        padded ? 'p-4 sm:p-5' : '',
        className,
      ].join(' ')}
      {...rest}
    >
      {children}
    </div>
  );
}
