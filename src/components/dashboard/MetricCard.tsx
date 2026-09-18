import type { ReactNode } from 'react';
import { Card, Badge } from '../ui';

interface MetricCardProps {
  label: string;
  value: string;
  icon: ReactNode;
  emphasis?: boolean;
  /** Insignia pequeña junto al valor -- usada para marcar métricas de origen mock/demo (ver services/dashboardService.ts, MetricValue). */
  badge?: string;
}

/**
 * `emphasis` resalta visualmente la métrica (usado para Oportunidades de
 * ingreso, que debe destacar sobre el resto según especificación de producto).
 */
export default function MetricCard({ label, value, icon, emphasis, badge }: MetricCardProps) {
  return (
    <Card
      className={emphasis ? 'border-brand-200 bg-brand-50/50' : ''}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-xs sm:text-sm font-medium text-slate-500 truncate">{label}</p>
            {badge && <Badge tone="neutral">{badge}</Badge>}
          </div>
          <p
            className={[
              'text-xl sm:text-2xl font-semibold mt-1 truncate',
              emphasis ? 'text-brand-700' : 'text-slate-900',
            ].join(' ')}
          >
            {value}
          </p>
        </div>
        <div
          className={[
            'w-9 h-9 rounded-lg flex items-center justify-center shrink-0',
            emphasis ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-500',
          ].join(' ')}
        >
          {icon}
        </div>
      </div>
    </Card>
  );
}
