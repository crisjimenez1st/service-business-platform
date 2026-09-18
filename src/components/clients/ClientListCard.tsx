import { useNavigate } from 'react-router-dom';
import { Phone, MapPin } from 'lucide-react';
import { Card, Badge } from '../ui';
import type { Client } from '../../types';
import { formatCurrency } from '../../utils/currency';
import { formatRelativeToToday } from '../../utils/dates';
import { t } from '../../i18n/es';

interface ClientListCardProps {
  client: Client;
  hasOpportunity: boolean;
}

export default function ClientListCard({ client, hasOpportunity }: ClientListCardProps) {
  const navigate = useNavigate();
  const hasBalance = (client.pendingBalance ?? 0) > 0;

  return (
    <button
      onClick={() => navigate(`/clients/${client.id}`)}
      className="w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 rounded-2xl"
    >
      <Card className="hover:border-brand-200 active:bg-slate-50 transition-colors">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-900 truncate">{client.name}</h3>
            <div className="flex items-center gap-1 text-sm text-slate-500 mt-0.5">
              <Phone size={13} className="shrink-0" />
              <span className="truncate">{client.phone}</span>
            </div>
            <div className="flex items-center gap-1 text-sm text-slate-500 mt-0.5">
              <MapPin size={13} className="shrink-0" />
              <span className="truncate">{client.address}</span>
            </div>
          </div>
          {hasOpportunity && <Badge tone="brand">Oportunidad</Badge>}
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 pt-3 border-t border-slate-100 text-sm">
          {client.lastServiceDate && (
            <span className="text-slate-500">
              {t.clients.lastService}: <span className="text-slate-700">{formatRelativeToToday(client.lastServiceDate)}</span>
            </span>
          )}
          {hasBalance && (
            <span className="text-amber-700 font-medium">
              {t.clients.balance}: {formatCurrency(client.pendingBalance ?? 0)}
            </span>
          )}
        </div>
      </Card>
    </button>
  );
}
