import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import { Button } from '../ui';
import NewAppointmentSheet from './NewAppointmentSheet';
import { useCurrentCompany } from '../../contexts/useCurrentCompany';
import { useClientsById } from '../../hooks/useClientsById';
import { useTerms } from '../../hooks/useTerms';
import { useClientStore } from '../../store/clientStore';
import { useServiceRulesStore } from '../../store/serviceRulesStore';
import { createAppointment } from '../../services/appointmentService';

/** Botón "Nueva cita" + formulario. Solo para owner/office. `onCreated` recarga la vista que lo usa. */
export default function NewAppointmentButton({ onCreated }: { onCreated: () => void }) {
  const { company } = useCurrentCompany();
  const companyId = company?.id;
  const terms = useTerms();
  const { clients } = useClientsById();
  const createClient = useClientStore((s) => s.createClient);
  const rules = useServiceRulesStore((s) => s.rules);
  const loadRules = useServiceRulesStore((s) => s.load);
  const [open, setOpen] = useState(false);

  const canCreate = company?.role === 'owner' || company?.role === 'office';

  useEffect(() => {
    if (companyId && canCreate) loadRules(companyId);
  }, [companyId, canCreate, loadRules]);

  if (!companyId || !canCreate) return null;

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus size={18} className="mr-1.5" />
        Nueva cita
      </Button>
      {open && (
        <NewAppointmentSheet
          open
          clients={clients}
          clientLabel={terms.client}
          serviceOptions={rules.map((r) => r.serviceName)}
          timezone={company?.timezone ?? 'America/Managua'}
          currency={company?.currency === 'USD' ? 'USD' : 'NIO'}
          onClose={() => setOpen(false)}
          onCreateClient={async ({ name, phone }) => (await createClient({ name, phone }))?.id ?? null}
          onSave={async (input) => {
            const result = await createAppointment(companyId, input);
            if (result.error) return result.error.message;
            onCreated();
            return null;
          }}
        />
      )}
    </>
  );
}
