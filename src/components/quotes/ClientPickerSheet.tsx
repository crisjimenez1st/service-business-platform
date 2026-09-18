import { useMemo, useState } from 'react';
import { Search, ChevronRight, User } from 'lucide-react';
import { Sheet } from '../ui';
import type { Client } from '../../types';
import { searchClientsLocal } from '../../services/clientService';
import { t } from '../../i18n/es';

interface ClientPickerSheetProps {
  open: boolean;
  onClose: () => void;
  clients: Client[];
  onSelect: (client: Client) => void;
}

/**
 * No crea clientes nuevos aquí (spec: "no crear todavía un CRM nuevo
 * desde esta pantalla") — solo busca y selecciona entre los existentes,
 * filtrando localmente sobre los `clients` ya cargados por el caller
 * (QuoteFormPage vía useClientsById) — evita una consulta a Supabase
 * por cada tecla mientras el usuario escribe.
 */
export default function ClientPickerSheet({ open, onClose, clients, onSelect }: ClientPickerSheetProps) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => searchClientsLocal(clients, query), [clients, query]);

  function handleSelect(client: Client) {
    onSelect(client);
    setQuery('');
    onClose();
  }

  return (
    <Sheet open={open} onClose={onClose} title={t.quotes.selectClient}>
      <div className="relative mb-3">
        <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="search"
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t.quotes.searchClient}
          className="w-full pl-10 pr-3 min-h-11 rounded-xl border border-slate-300 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:border-brand-500"
        />
      </div>
      <div className="space-y-1 max-h-80 overflow-y-auto -mx-1 px-1">
        {filtered.map((client) => (
          <button
            key={client.id}
            onClick={() => handleSelect(client)}
            className="w-full flex items-center gap-3 rounded-xl px-3 py-3 min-h-11 text-left hover:bg-slate-50 active:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center shrink-0">
              <User size={16} className="text-slate-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-900 truncate">{client.name}</p>
              <p className="text-xs text-slate-500 truncate">{client.phone}</p>
            </div>
            <ChevronRight size={16} className="text-slate-500 shrink-0" />
          </button>
        ))}
      </div>
    </Sheet>
  );
}
