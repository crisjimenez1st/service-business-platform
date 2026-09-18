import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
}

export default function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-12 px-4">
      {icon && <div className="text-slate-300 mb-3">{icon}</div>}
      <p className="text-slate-600 font-medium">{title}</p>
      {description && <p className="text-slate-500 text-sm mt-1 max-w-xs">{description}</p>}
    </div>
  );
}
