import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padded?: boolean;
}

export default function Card({ children, padded = true, className = '', ...rest }: CardProps) {
  return (
    <div
      className={[
        'bg-white rounded-2xl border border-violet-100 shadow-[0_1px_2px_rgb(20_20_80/0.04),0_10px_28px_-14px_rgb(60_40_160/0.18)]',
        padded ? 'p-4 sm:p-5' : '',
        className,
      ].join(' ')}
      {...rest}
    >
      {children}
    </div>
  );
}
