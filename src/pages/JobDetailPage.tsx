import ScheduleFollowupSheet from '../components/followups/ScheduleFollowupSheet';
import { createFollowup } from '../services/followupService';
import { useTerms } from '../hooks/useTerms';
import { useServiceRulesStore } from '../store/serviceRulesStore';
import { findRuleForService } from '../services/serviceRulesService';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Calendar as CalendarIcon, MapPin, MessageCircle, Pencil, Phone, UserRound, Wallet } from 'lucide-react';
import { buildWhatsAppLink } from '../utils/whatsapp';
import { Badge, Button, ErrorState, Card } from '../components/ui';
import JobStatusActions from '../components/jobs/JobStatusActions';
import CancelJobModal from '../components/jobs/CancelJobModal';
import JobPaymentsTab from '../components/payments/JobPaymentsTab';
import AssignTechnicianSheet from '../components/calendar/AssignTechnicianSheet';
import ScheduleJobSheet from '../components/calendar/ScheduleJobSheet';
import { getAppointmentResponses } from '../services/appointmentService';
import type { AppointmentResponse } from '../types';
import { useCurrentCompany } from '../contexts/useCurrentCompany';
import { useClientsById } from '../hooks/useClientsById';
import { useJobStore } from '../store/jobStore';
import * as jobService from '../services/jobService';
import type { Job } from '../types';
import { JOB_STATUS_LABELS, JOB_STATUS_TONES } from '../utils/jobStatus';
import { formatTimeInTimezone, formatLongDateInTimezone } from '../utils/timezone';
import { formatCurrency } from '../utils/currency';
import { getJobFinancials, PAYMENT_STATUS_LABELS, PAYMENT_STATUS_TONES } from '../utils/paymentStatus';
import { formatCalendarDate } from '../utils/timezone';
import { t } from '../i18n/es';

type TabKey = 'summary' | 'service' | 'schedule' | 'evidence' | 'materials' | 'payments' | 'history';

/**
 * Detalle completo de un Job (/jobs/:id, Fase B2B Bloque 5). Página
 * dedicada, no un Sheet -- pensada para crecer con evidencias,
 * materiales/equipos, cobros e historial en bloques futuros (ver los
 * placeholders de esas pestañas, marcados explícitamente como
 * "próximamente", nunca con datos inventados).
 *
 * Se llega aquí desde JobDetailSheet ("Ver trabajo completo") o
 * directo desde JobsPage.
 */
export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { company } = useCurrentCompany();
  const companyId = company?.id;
  const timezone = company?.timezone ?? 'America/Managua';

  const [job, setJob] = useState<Job | null | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<TabKey>(searchParams.get('tab') === 'payments' ? 'payments' : 'summary');
  const [assignOpen, setAssignOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [followupOpen, setFollowupOpen] = useState(false);
  const [freedSlot, setFreedSlot] = useState<string | null>(null);
  const [apptResponse, setApptResponse] = useState<AppointmentResponse | null>(null);

  const { clientsById } = useClientsById();
  const isClinic = company?.businessType !== 'technical_services';
  const canManage = company?.role === 'owner' || company?.role === 'office';
  const technicians = useJobStore((s) => s.technicians);
  const loadTechnicians = useJobStore((s) => s.loadTechnicians);
  const assignTechnician = useJobStore((s) => s.assignTechnician);
  const scheduleJobAction = useJobStore((s) => s.schedule);
  const advanceStatus = useJobStore((s) => s.advanceStatus);
  const terms = useTerms();
  const serviceRules = useServiceRulesStore((s) => s.rules);
  const loadServiceRules = useServiceRulesStore((s) => s.load);
  const cancel = useJobStore((s) => s.cancel);

  async function loadJob() {
    if (!companyId || !id) return;
    const result = await jobService.getJobById(companyId, id);
    setJob(result.error ? null : result.data);
  }

  useEffect(() => {
    loadJob();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [companyId, id]);

  useEffect(() => {
    const canFollowUp = company?.role === 'owner' || company?.role === 'office';
    if (companyId && canFollowUp && company?.businessType !== 'technical_services') loadServiceRules(companyId);
  }, [companyId, company?.role, company?.businessType, loadServiceRules]);

  const scheduledStartAt = job?.scheduledStartAt;
  useEffect(() => {
    if (!companyId || !id || !scheduledStartAt) return;
    let cancelled = false;
    (async () => {
      const r = await getAppointmentResponses(companyId, [id]);
      if (!cancelled) setApptResponse(r.error ? null : (r.data[0] ?? null));
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, id, scheduledStartAt]);

  useEffect(() => {
    if (companyId) loadTechnicians(companyId);
  }, [companyId, loadTechnicians]);

  const technicianName = useMemo(() => {
    if (!job?.assignedTechnicianId) return undefined;
    return technicians.find((t2) => t2.userId === job.assignedTechnicianId)?.displayName;
  }, [job, technicians]);

  const client = job ? clientsById[job.clientId] : undefined;

  async function handleAdvance(newStatus: string) {
    if (!job) return;
    setAdvancing(true);
    const updated = await advanceStatus(job.id, newStatus);
    setAdvancing(false);
    if (updated) {
      setJob(updated);
      // Clínicas y similares: al terminar la cita se pregunta cuándo debe volver.
      const canFollowUp = company?.role === 'owner' || company?.role === 'office';
      if (newStatus === 'completed' && canFollowUp && company?.businessType !== 'technical_services') {
        setFollowupOpen(true);
      }
    }
  }

  async function handleCancel(reason: string, category?: string) {
    if (!job) return false;
    const slot = job.scheduledStartAt;
    const updated = await cancel(job.id, reason, category);
    if (updated) {
      setJob(updated);
      // Se liberó un espacio futuro: ofrecer avisar a la lista de espera.
      const canOffer = company?.role === 'owner' || company?.role === 'office';
      if (slot && new Date(slot).getTime() > Date.now() && canOffer && company?.businessType !== 'technical_services') {
        setFreedSlot(slot);
      }
    }
    return updated !== null;
  }

  if (job === undefined) {
    return <p className="text-center text-sm text-slate-500 py-12">{t.common.loading}</p>;
  }

  if (job === null) {
    return <ErrorState message={t.jobDetail.notFound} onRetry={loadJob} />;
  }

  const financials = getJobFinancials(job, timezone);

  const allTabs: { key: TabKey; label: string }[] = [
    { key: 'summary', label: t.jobDetail.tabSummary },
    { key: 'service', label: t.jobDetail.tabService },
    { key: 'schedule', label: t.jobDetail.tabSchedule },
    { key: 'evidence', label: t.jobDetail.tabEvidence },
    { key: 'materials', label: t.jobDetail.tabMaterials },
    { key: 'payments', label: t.jobDetail.tabPayments },
    { key: 'history', label: t.jobDetail.tabHistory },
  ];
  // Consultorio: solo la cita y sus pagos. El historial clínico vive en la ficha del paciente.
  const tabs = isClinic ? allTabs.filter((tab) => tab.key === 'summary' || tab.key === 'payments') : allTabs;
  const canEditSchedule = canManage && job.status !== 'completed' && job.status !== 'cancelled';

  return (
    <div className="space-y-4 pb-8">
      <button
        onClick={() => navigate(isClinic ? '/calendar' : '/jobs')}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 min-h-9"
      >
        <ArrowLeft size={16} />
        {t.jobDetail.backToJobs}
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">{isClinic ? (client?.name ?? '—') : job.serviceType}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{isClinic ? job.serviceType : (client?.name ?? '—')}</p>
        </div>
        <Badge tone={JOB_STATUS_TONES[job.status]}>{JOB_STATUS_LABELS[job.status]}</Badge>
      </div>

      {job.status !== 'completed' && job.status !== 'cancelled' && (
        <Card>
          <JobStatusActions job={job} onAdvance={handleAdvance} onCancel={() => setCancelOpen(true)} advancing={advancing} />
        </Card>
      )}

      {job.status === 'cancelled' && freedSlot && (
        <Card className="bg-brand-50 border-brand-200">
          <p className="text-sm font-medium text-slate-900">Se liberó un espacio</p>
          <p className="text-sm text-slate-600 mt-1">¿Quieres avisar a quienes están en la lista de espera?</p>
          <Button
            size="sm"
            className="mt-3"
            onClick={() => navigate(`/followups?tab=waitlist&slot=${encodeURIComponent(freedSlot)}`)}
          >
            Avisar a la lista de espera
          </Button>
        </Card>
      )}

      {job.status === 'cancelled' && job.cancellationReason && (
        <Card className="bg-red-50 border-red-200">
          <p className="text-sm font-medium text-red-800">{t.jobDetail.cancellationReason}</p>
          <p className="text-sm text-red-700 mt-1">{job.cancellationReason}</p>
          {job.cancelledAt && (
            <p className="text-xs text-red-600 mt-2">
              {t.jobDetail.cancelledAt} {formatLongDateInTimezone(job.cancelledAt, timezone)}
            </p>
          )}
        </Card>
      )}

      <div className="border-b border-slate-200 overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={[
                'px-3 py-2 text-sm font-medium border-b-2 whitespace-nowrap',
                'focus-visible:outline-none',
                activeTab === tab.key
                  ? 'border-brand-600 text-brand-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700',
              ].join(' ')}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {activeTab === 'summary' && (
        <div className="space-y-3">
          {isClinic && (
            <>
              <Card>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500">{t.calendar.client}</p>
                    <p className="text-base font-semibold text-slate-900 truncate">{client?.name ?? '—'}</p>
                    {client?.phone && <p className="text-sm text-slate-500 mt-0.5">{client.phone}</p>}
                  </div>
                  <UserRound size={28} className="text-brand-600 shrink-0" />
                </div>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  {client?.phone && (
                    <a
                      href={`tel:${client.phone.replace(/\s/g, '')}`}
                      className="inline-flex items-center justify-center gap-1.5 min-h-11 text-sm rounded-xl bg-slate-100 text-slate-700 hover:bg-slate-200 font-medium"
                    >
                      <Phone size={18} /> Llamar
                    </a>
                  )}
                  {client?.whatsapp && (
                    <a
                      href={buildWhatsAppLink(client.whatsapp, `Hola ${client.name.split(/\s+/)[0]} 👋`)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 min-h-11 text-sm rounded-xl bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-medium"
                    >
                      <MessageCircle size={18} /> WhatsApp
                    </a>
                  )}
                </div>
                <Button variant="secondary" className="mt-2" fullWidth onClick={() => navigate(`/clients/${job.clientId}`)}>
                  {t.calendar.viewClientProfile}
                </Button>
              </Card>

              <Card>
                <p className="text-xs text-slate-500 mb-1">Fecha y hora</p>
                <p className="text-base font-semibold text-slate-900">
                  {job.scheduledStartAt
                    ? `${formatLongDateInTimezone(job.scheduledStartAt, timezone)} · ${formatTimeInTimezone(job.scheduledStartAt, timezone)}`
                    : 'Todavía sin fecha'}
                </p>
                <p className="text-sm text-slate-600 mt-1">
                  {t.calendar.technician}: {technicianName ?? t.calendar.unassigned}
                </p>
                {apptResponse?.response && (
                  <div className="mt-2">
                    <Badge tone={apptResponse.response === 'confirmed' ? 'success' : 'warning'}>
                      {apptResponse.response === 'confirmed'
                        ? apptResponse.responseSource === 'patient' ? 'Confirmó su cita' : 'Cita confirmada'
                        : apptResponse.responseSource === 'patient' ? 'Avisó que no podrá asistir' : 'No podrá asistir'}
                    </Badge>
                  </div>
                )}
                {canEditSchedule && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Button variant="secondary" size="sm" icon={<CalendarIcon size={16} />} onClick={() => setScheduleOpen(true)}>
                      {job.status === 'scheduled' ? t.calendar.reschedule : t.calendar.schedule}
                    </Button>
                    {technicians.length > 0 && (
                      <Button variant="secondary" size="sm" icon={<Pencil size={16} />} onClick={() => setAssignOpen(true)}>
                        {t.calendar.assignTechnician}
                      </Button>
                    )}
                  </div>
                )}
              </Card>

              {job.notes && (
                <Card>
                  <p className="text-xs text-slate-500 mb-1">Notas de la cita</p>
                  <p className="text-sm text-slate-700 whitespace-pre-line">{job.notes}</p>
                </Card>
              )}
            </>
          )}
          {!isClinic && <Card>
            <p className="text-xs text-slate-500">{t.calendar.client}</p>
            <p className="text-sm font-medium text-slate-900">{client?.name ?? '—'}</p>
            {client?.phone && <p className="text-sm text-slate-500 mt-1">{client.phone}</p>}
          </Card>}
          {!isClinic && job.scheduledStartAt && (
            <Card>
              <p className="text-xs text-slate-500 mb-1">{t.jobDetail.tabSchedule}</p>
              <p className="text-sm text-slate-900">
                {formatLongDateInTimezone(job.scheduledStartAt, timezone)} · {formatTimeInTimezone(job.scheduledStartAt, timezone)}
              </p>
              <p className="text-sm text-slate-600 mt-1">{technicianName ?? t.calendar.unassigned}</p>
              {apptResponse?.response && (
                <div className="mt-2">
                  <Badge tone={apptResponse.response === 'confirmed' ? 'success' : 'warning'}>
                    {apptResponse.response === 'confirmed'
                      ? apptResponse.responseSource === 'patient' ? 'Confirmó su cita' : 'Cita confirmada'
                      : apptResponse.responseSource === 'patient' ? 'Avisó que no podrá asistir' : 'No podrá asistir'}
                  </Badge>
                </div>
              )}
            </Card>
          )}
          {financials.hasTotal && (
            <Card>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">{t.jobDetail.total}</span>
                <span className="font-medium text-slate-900">{formatCurrency(financials.total, job.currency)}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-slate-500">{t.jobDetail.paidAmount}</span>
                <span className="font-medium text-slate-900">{formatCurrency(financials.paidAmount, job.currency)}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-slate-500">{t.jobDetail.balance}</span>
                <span className="font-medium text-slate-900">{formatCurrency(financials.balance, job.currency)}</span>
              </div>
              {job.dueDate && (
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-slate-500">{t.jobDetail.dueDate}</span>
                  <span className={financials.isOverdue ? 'font-medium text-red-700' : 'text-slate-700'}>
                    {formatCalendarDate(job.dueDate)}
                  </span>
                </div>
              )}
              <div className="flex flex-wrap gap-2 mt-3">
                <Badge tone={PAYMENT_STATUS_TONES[financials.paymentStatus]}>
                  {PAYMENT_STATUS_LABELS[financials.paymentStatus]}
                </Badge>
                {financials.isOverdue && <Badge tone="danger">{t.payments.overdueBadge}</Badge>}
              </div>
              {isClinic && canManage && job.status !== 'cancelled' && financials.balance > 0 && (
                <Button className="mt-3" fullWidth icon={<Wallet size={18} />} onClick={() => setActiveTab('payments')}>
                  Registrar pago
                </Button>
              )}
            </Card>
          )}
          {isClinic && canManage && !financials.hasTotal && job.status !== 'cancelled' && (
            <Card>
              <p className="text-sm font-medium text-slate-900">Esta cita no tiene precio</p>
              <p className="text-sm text-slate-500 mt-1">Ponle un precio para poder registrar los pagos del paciente.</p>
              <Button className="mt-3" variant="secondary" onClick={() => setActiveTab('payments')}>
                Definir precio
              </Button>
            </Card>
          )}
          {job.jobDraftId && <p className="text-xs text-slate-400">{t.jobDetail.createdFrom}</p>}
        </div>
      )}

      {activeTab === 'service' && (
        <div className="space-y-3">
          <Card>
            <p className="text-xs text-slate-500 mb-1">{t.calendar.service}</p>
            <p className="text-sm text-slate-900">{job.serviceType}</p>
          </Card>
          {job.description && (
            <Card>
              <p className="text-xs text-slate-500 mb-1">Descripción</p>
              <p className="text-sm text-slate-700 whitespace-pre-line">{job.description}</p>
            </Card>
          )}
          {job.notes && (
            <Card>
              <p className="text-xs text-slate-500 mb-1">Notas</p>
              <p className="text-sm text-slate-700 whitespace-pre-line">{job.notes}</p>
            </Card>
          )}
          {job.address && (
            <Card>
              <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                <MapPin size={12} /> Dirección
              </p>
              <p className="text-sm text-slate-700">{job.address}</p>
            </Card>
          )}
        </div>
      )}

      {activeTab === 'schedule' && (
        <div className="space-y-3">
          <Card>
            <p className="text-xs text-slate-500 mb-1">{t.calendar.technician}</p>
            <p className="text-sm text-slate-900 mb-3">{technicianName ?? t.calendar.unassigned}</p>
            <Button variant="secondary" icon={<Pencil size={16} />} onClick={() => setAssignOpen(true)}>
              {t.calendar.assignTechnician}
            </Button>
          </Card>
          <Card>
            <p className="text-xs text-slate-500 mb-1">{t.calendar.schedule}</p>
            <p className="text-sm text-slate-900 mb-3">
              {job.scheduledStartAt
                ? `${formatLongDateInTimezone(job.scheduledStartAt, timezone)} · ${formatTimeInTimezone(job.scheduledStartAt, timezone)}`
                : t.calendar.unscheduled}
            </p>
            <Button variant="secondary" icon={<CalendarIcon size={16} />} onClick={() => setScheduleOpen(true)}>
              {job.status === 'scheduled' ? t.calendar.reschedule : t.calendar.schedule}
            </Button>
          </Card>
        </div>
      )}

      {activeTab === 'payments' && <JobPaymentsTab
          job={job}
          timezone={timezone}
          client={client ? { name: client.name, phone: client.phone, whatsapp: client.whatsapp } : undefined}
          onJobChange={setJob}
        />}

      {(activeTab === 'evidence' || activeTab === 'materials' || activeTab === 'history') && (
        <Card>
          <p className="text-sm text-slate-500 text-center py-6">{t.jobDetail.comingSoon}</p>
        </Card>
      )}

      <AssignTechnicianSheet
        key={`${job.id}-assign-${assignOpen}`}
        open={assignOpen}
        onClose={() => setAssignOpen(false)}
        technicians={technicians}
        currentTechnicianId={job.assignedTechnicianId}
        onAssign={async (technicianId) => {
          const updated = await assignTechnician(job.id, technicianId);
          if (updated) setJob(updated);
          return updated !== null;
        }}
      />

      <ScheduleJobSheet
        key={`${job.id}-schedule-${scheduleOpen}`}
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        timezone={timezone}
        currentStartAt={job.scheduledStartAt}
        currentEndAt={job.scheduledEndAt}
        isCurrentlyScheduled={job.status === 'scheduled'}
        onSchedule={async (startAtIso, endAtIso) => {
          const updated = await scheduleJobAction(job.id, startAtIso, endAtIso);
          if (updated) setJob(updated);
          return updated !== null;
        }}
      />

      <CancelJobModal open={cancelOpen} onClose={() => setCancelOpen(false)} onConfirm={handleCancel} />
      {followupOpen && (
        <ScheduleFollowupSheet
          open
          question={terms.whenReturn}
          timezone={timezone}
          suggestion={(() => {
            const rule = findRuleForService(serviceRules, job.serviceType);
            return rule ? { serviceName: rule.serviceName, months: rule.months, reason: rule.reason } : undefined;
          })()}
          onClose={() => setFollowupOpen(false)}
          onSave={async (f) => {
            if (!companyId) return false;
            const result = await createFollowup(companyId, { clientId: job.clientId, ...f });
            return !result.error;
          }}
        />
      )}
    </div>
  );
}
