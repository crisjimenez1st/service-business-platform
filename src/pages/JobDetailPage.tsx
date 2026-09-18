import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Calendar as CalendarIcon, Pencil, MapPin } from 'lucide-react';
import { Badge, Button, ErrorState, Card } from '../components/ui';
import JobStatusActions from '../components/jobs/JobStatusActions';
import CancelJobModal from '../components/jobs/CancelJobModal';
import AssignTechnicianSheet from '../components/calendar/AssignTechnicianSheet';
import ScheduleJobSheet from '../components/calendar/ScheduleJobSheet';
import { useCurrentCompany } from '../contexts/useCurrentCompany';
import { useClientsById } from '../hooks/useClientsById';
import { useJobStore } from '../store/jobStore';
import * as jobService from '../services/jobService';
import type { Job, CurrencyCode } from '../types';
import { JOB_STATUS_LABELS, JOB_STATUS_TONES } from '../utils/jobStatus';
import { formatTimeInTimezone, formatLongDateInTimezone } from '../utils/timezone';
import { formatCurrency } from '../utils/currency';
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
  const { company } = useCurrentCompany();
  const companyId = company?.id;
  const timezone = company?.timezone ?? 'America/Managua';
  const currency = (company?.currency ?? 'NIO') as CurrencyCode;

  const [job, setJob] = useState<Job | null | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<TabKey>('summary');
  const [assignOpen, setAssignOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [advancing, setAdvancing] = useState(false);

  const { clientsById } = useClientsById();
  const technicians = useJobStore((s) => s.technicians);
  const loadTechnicians = useJobStore((s) => s.loadTechnicians);
  const assignTechnician = useJobStore((s) => s.assignTechnician);
  const scheduleJobAction = useJobStore((s) => s.schedule);
  const advanceStatus = useJobStore((s) => s.advanceStatus);
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
    if (updated) setJob(updated);
  }

  async function handleCancel(reason: string, category?: string) {
    if (!job) return false;
    const updated = await cancel(job.id, reason, category);
    if (updated) setJob(updated);
    return updated !== null;
  }

  if (job === undefined) {
    return <p className="text-center text-sm text-slate-500 py-12">{t.common.loading}</p>;
  }

  if (job === null) {
    return <ErrorState message={t.jobDetail.notFound} onRetry={loadJob} />;
  }

  const tabs: { key: TabKey; label: string }[] = [
    { key: 'summary', label: t.jobDetail.tabSummary },
    { key: 'service', label: t.jobDetail.tabService },
    { key: 'schedule', label: t.jobDetail.tabSchedule },
    { key: 'evidence', label: t.jobDetail.tabEvidence },
    { key: 'materials', label: t.jobDetail.tabMaterials },
    { key: 'payments', label: t.jobDetail.tabPayments },
    { key: 'history', label: t.jobDetail.tabHistory },
  ];

  return (
    <div className="space-y-4 pb-8">
      <button
        onClick={() => navigate('/jobs')}
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700"
      >
        <ArrowLeft size={16} />
        {t.jobDetail.backToJobs}
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">{job.serviceType}</h1>
          <p className="text-sm text-slate-500 mt-0.5">{client?.name ?? '—'}</p>
        </div>
        <Badge tone={JOB_STATUS_TONES[job.status]}>{JOB_STATUS_LABELS[job.status]}</Badge>
      </div>

      {job.status !== 'completed' && job.status !== 'cancelled' && (
        <Card>
          <JobStatusActions job={job} onAdvance={handleAdvance} onCancel={() => setCancelOpen(true)} advancing={advancing} />
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
          <Card>
            <p className="text-xs text-slate-500">{t.calendar.client}</p>
            <p className="text-sm font-medium text-slate-900">{client?.name ?? '—'}</p>
            {client?.phone && <p className="text-sm text-slate-500 mt-1">{client.phone}</p>}
          </Card>
          {job.scheduledStartAt && (
            <Card>
              <p className="text-xs text-slate-500 mb-1">{t.jobDetail.tabSchedule}</p>
              <p className="text-sm text-slate-900">
                {formatLongDateInTimezone(job.scheduledStartAt, timezone)} · {formatTimeInTimezone(job.scheduledStartAt, timezone)}
              </p>
              <p className="text-sm text-slate-600 mt-1">{technicianName ?? t.calendar.unassigned}</p>
            </Card>
          )}
          {(job.total !== undefined || job.paidAmount !== undefined) && (
            <Card>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">{t.jobDetail.total}</span>
                <span className="font-medium text-slate-900">
                  {job.total !== undefined ? formatCurrency(job.total, currency) : '—'}
                </span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-slate-500">{t.jobDetail.paidAmount}</span>
                <span className="font-medium text-slate-900">
                  {job.paidAmount !== undefined ? formatCurrency(job.paidAmount, currency) : '—'}
                </span>
              </div>
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

      {(activeTab === 'evidence' || activeTab === 'materials' || activeTab === 'payments' || activeTab === 'history') && (
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
    </div>
  );
}
