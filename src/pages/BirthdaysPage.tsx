import { useMemo, useState } from 'react';
import { Cake, MessageCircle } from 'lucide-react';
import { Badge, Card, EmptyState } from '../components/ui';
import FilterChips from '../components/clients/FilterChips';
import { useCurrentCompany } from '../contexts/useCurrentCompany';
import { useClientsById } from '../hooks/useClientsById';
import { useTerms } from '../hooks/useTerms';
import { nextBirthday } from '../utils/birthdays';
import { getTodayKeyInTimezone } from '../utils/timezone';
import { buildWhatsAppLink, toWhatsAppNumber } from '../utils/whatsapp';

type Range = 'today' | 'week' | 'month';

const RANGE_DAYS: Record<Range, number> = { today: 0, week: 7, month: 30 };

/** Pacientes que cumplen años pronto, con un WhatsApp de felicitación listo (solo dueño y recepción). */
export default function BirthdaysPage() {
  const { company } = useCurrentCompany();
  const terms = useTerms();
  const { clients } = useClientsById();
  const [range, setRange] = useState<Range>('week');
  const timezone = company?.timezone ?? 'America/Managua';

  const upcoming = useMemo(() => {
    const todayKey = getTodayKeyInTimezone(timezone);
    return clients
      .filter((c) => c.birthDate)
      .map((c) => ({ client: c, next: nextBirthday(c.birthDate as string, todayKey) }))
      .filter((x): x is { client: (typeof clients)[number]; next: NonNullable<typeof x.next> } => x.next !== null)
      .sort((a, b) => a.next.daysUntil - b.next.daysUntil);
  }, [clients, timezone]);

  const withoutDate = clients.filter((c) => !c.birthDate).length;
  const visible = upcoming.filter((x) => x.next.daysUntil <= RANGE_DAYS[range]);

  if (!company || (company.role !== 'owner' && company.role !== 'office')) {
    return <EmptyState title="Sin acceso" description="Los cumpleaños los ve el dueño o la recepción." />;
  }

  return (
    <div className="space-y-4 pb-4">
      <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">Cumpleaños</h1>

      <FilterChips
        active={range}
        onChange={setRange}
        options={[
          { value: 'today', label: 'Hoy' },
          { value: 'week', label: 'Próximos 7 días' },
          { value: 'month', label: 'Próximos 30 días' },
        ]}
      />

      {visible.length === 0 ? (
        <EmptyState
          icon={<Cake size={32} />}
          title={range === 'today' ? 'Hoy nadie cumple años' : 'Nadie cumple años en ese tiempo'}
          description={
            upcoming.length === 0
              ? `Agrega la fecha de nacimiento en la ficha de cada ${terms.client.toLowerCase()} (Editar) y aparecerá aquí.`
              : undefined
          }
        />
      ) : (
        <ul className="space-y-3">
          {visible.map(({ client, next }) => {
            const first = client.name.split(' ')[0];
            const canContact = client.contactConsent !== false;
            const wa = buildWhatsAppLink(
              toWhatsAppNumber(client.whatsapp || client.phone, timezone),
              `¡Feliz cumpleaños, ${first}! 🎂 De parte de todo el equipo de ${company.name} te deseamos un día lleno de alegría y salud. ¡Un abrazo!`,
            );
            return (
              <li key={client.id}>
                <Card className={next.daysUntil === 0 ? 'border-brand-200 bg-brand-50/60' : ''}>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900">{client.name}</p>
                      <p className="text-sm text-slate-500">Cumple {next.turning} años</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge>
                        {next.daysUntil === 0 ? '¡Hoy!' : next.daysUntil === 1 ? 'Mañana' : `En ${next.daysUntil} días`}
                      </Badge>
                      {canContact ? (
                        <a
                          href={wa}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center min-h-11 px-3 rounded-xl bg-brand-600 text-white text-sm font-medium hover:bg-brand-700"
                        >
                          <MessageCircle size={16} className="mr-1.5" /> Felicitar
                        </a>
                      ) : (
                        <span className="text-xs text-slate-500">No quiere avisos</span>
                      )}
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {withoutDate > 0 && (
        <p className="text-xs text-slate-500">
          {withoutDate} {withoutDate === 1 ? terms.client.toLowerCase() : terms.clients.toLowerCase()} sin fecha de nacimiento.
        </p>
      )}
    </div>
  );
}
