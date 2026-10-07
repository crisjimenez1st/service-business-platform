import { useId } from 'react';

/** Isotipo de OneFlow: anillo con degradado azul → turquesa → violeta. */
export default function OneFlowMark({ size = 36, className }: { size?: number; className?: string }) {
  const id = useId();
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="6" y1="8" x2="42" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#0066FF" />
          <stop offset="0.5" stopColor="#00D1C1" />
          <stop offset="1" stopColor="#8A3FFC" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="15" stroke={`url(#${id})`} strokeWidth="8" />
    </svg>
  );
}
