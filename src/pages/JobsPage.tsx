import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { ErrorState, EmptyState } from '../components/ui';
import JobAgendaCard from '../components/calendar/JobAgendaCard';
import CancelJobModal from '../components/jobs/CancelJobModal';
import { useCurrentCompany } from '../contexts/useCurrentCompany';
import { useClientsById } from '../hooks/useClientsById';
import { useJobStore } from '../store/jobStore';
import type { JobStatus } from '../types';
import { t } from '../i18n/es';

type StatusFilter = 'all' | JobStatus;
type TechnicianFilter = 'all' | 'unassigned' | string;

/**
 * Centro de operaciones de Jobs (Fase B2B, Bloque 5). No es una tabla
 * técnica plana -- agrupa por categoría de negocio (Sin programar /
 * Programados / En curso / Completados / Cancelados) para que
 * owner/office vea de un vistazo qué requiere atención.
 */
export default function JobsPage() {
  const navigate = useNavigate();
  const { company } = useCurrentCompany();
  const companyId = company?.id;
  const timezone = company?.timezone ?? 'America/Managua';

  const allJobs = useJobStore((s) => s.allJobs);
  const allJobsLoading = useJobStore((s) => s.allJobsLoading);
  const error = useJobStore((s) => s.error);
  const loadAll = useJobStore((s) => s.loadAll);
  const technicians = useJobStore((s) => s.technicians);
  const loadTechnicians = useJobStore((s) => s.loadTechnicians);
  const cancel = useJobStore((s) => s.cancel);

  const { clientsById } = useClientsById();

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [technicianFilter, setTechnicianFilter] = useState<TechnicianFilter>('all');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);

  useEffect(() => {
    if (companyId) {
      loadAll(companyId);
      loadTechnicians(companyId);
    }
  }, [companyId, loadAll, loadTechnicians]);

  const technicianNamesById = useMemo(() => {
    const map: Record<string, string> = {};
    technicians.forEach((tech) => {
      map[tech.userId] = tech.displayName;
    });
    return map;
  }, [technicians]);

  const filteredJobs = useMemo(() => {
    return allJobs.filter((job) => {
      if (statusFilter !== 'all' && job.status !== statusFilter) return false;

      if (technicianFilter === 'unassigned' && job.assignedTechnicianId) return false;
      if (
        technicianFilter !== 'all' &&
        technicianFilter !== 'unassigned' &&
        job.assignedTechnicianId !== technicianFilter
      )
        return false;

      if (search.trim()) {
        const clientName = clientsById[job.clientId]?.name?.toLowerCase() ?? '';
        const serviceType = job.serviceType.toLowerCase();
        const q = search.trim().toLowerCase();
        if (!clientName.includes(q) && !serviceType.includes(q)) return false;
      }

      // Un Job sin fecha nunca se oculta por el filtro de rango --
      // solo se compara cuando sí tiene scheduledStartAt.
      if (dateFrom && job.scheduledStartAt && job.scheduledStartAt.slice(0, 10) < dateFrom) return false;
      if (dateTo && job.scheduledStartAt && job.scheduledStartAt.slice(0, 10) > dateTo) return false;

      return true;
    });
  }, [allJobs, statusFilter, technicianFilter, search, dateFrom, dateTo, clientsById]);

  const sections = useMemo(() => {
    const unscheduled = filteredJobs.filter((j) => j.status === 'new');
    const scheduled = filteredJobs.filter((j) => j.status === 'scheduled');
    const active = filteredJobs.filter((j) => ['en_route', 'in_progress', 'paused'].includes(j.status));
    const completed = filteredJobs.filter((j) => j.status === 'completed');
    const cancelled = filteredJobs.filter((j) => j.status === 'cancelled');
    return [
      { key: 'unscheduled', label: t.jobsPage.sectionUnscheduled, jobs: unscheduled },
      { key: 'scheduled', label: t.jobsPage.sectionScheduled, jobs: scheduled },
      { key: 'active', label: t.jobsPage.sectionActive, jobs: active },
      { key: 'completed', label: t.jobsPage.sectionCompleted, jobs: completed },
      { key: 'cancelled', label: t.jobsPage.sectionCancelled, jobs: cancelled },
    ].filter((s) => s.jobs.length > 0);
  }, [filteredJobs]);

  function clearFilters() {
    setStatusFilter('all');
    setTechnicianFilter('all');
    setSearch('');
    setDateFrom('');
    setDateTo('');
  }

  async function handleCancel(reason: string, category?: string) {
    if (!cancelTargetId) return false;
    const result = await cancel(cancelTargetId, reason, category);
    return result !== null;
  }

  const hasActiveFilters =
    statusFilter !== 'all' || technicianFilter !== 'all' || search.trim() !== '' || dateFrom !== '' || dateTo !== '';

  if (error) {
    return <ErrorState message={error.message} onRetry={() => companyId && loadAll(companyId)} />;
  }

  return (
    <div className="space-y-4 pb-4">
      <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">{t.jobsPage.title}</h1>

      <div className="bg-white rounded-2xl border border-slate-200 p-3 sm:p-4 space-y-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t.jobsPage.searchPlaceholder}
            className="w-full pl-9 pr-3 min-h-10 rounded-xl border border-slate-300 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:border-brand-500"
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="min-h-10 px-2 rounded-xl border border-slate-300 text-sm bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <option value="all">{t.jobsPage.allStatuses}</option>
            <option value="new">{t.calendar.unscheduled}</option>
            <option value="scheduled">{t.jobsPage.sectionScheduled}</option>
            <option value="en_route">En camino</option>
            <option value="in_progress">En progreso</option>
            <option value="paused">Pausado</option>
            <option value="completed">Completado</option>
            <option value="cancelled">Cancelado</option>
          </select>

          <select
            value={technicianFilter}
            onChange={(e) => setTechnicianFilter(e.target.value)}
            className="min-h-10 px-2 rounded-xl border border-slate-300 text-sm bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          >
            <option value="all">{t.jobsPage.allTechnicians}</option>
            <option value="unassigned">{t.jobsPage.unassignedFilter}</option>
            {technicians.map((tech) => (
              <option key={tech.userId} value={tech.userId}>
                {tech.displayName}
              </option>
            ))}
          </select>

          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            aria-label={t.jobsPage.dateFrom}
            className="min-h-10 px-2 rounded-xl border border-slate-300 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            aria-label={t.jobsPage.dateTo}
            className="min-h-10 px-2 rounded-xl border border-slate-300 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
          />
        </div>

        {hasActiveFilters && (
          <button onClick={clearFilters} className="text-sm text-brand-600 font-medium hover:underline">
            {t.jobsPage.clearFilters}
          </button>
        )}
      </div>

      {allJobsLoading ? (
        <p className="text-center text-sm text-slate-500 py-12">{t.common.loading}</p>
      ) : sections.length === 0 ? (
        <EmptyState title={t.jobsPage.noResults} />
      ) : (
        <div className="space-y-6">
          {sections.map((section) => (
            <div key={section.key}>
              <h2 className="text-sm font-semibold text-slate-700 mb-2">
                {section.label} ({section.jobs.length})
              </h2>
              <div className="space-y-2">
                {section.jobs.map((job) => (
                  <div key={job.id} className="relative">
                    <JobAgendaCard
                      mode="admin"
                      job={job}
                      clientName={clientsById[job.clientId]?.name}
                      technicianName={
                        job.assignedTechnicianId ? technicianNamesById[job.assignedTechnicianId] : undefined
                      }
                      timezone={timezone}
                      onClick={() => navigate(`/jobs/${job.id}`)}
                    />
                    {['scheduled', 'en_route', 'in_progress', 'paused'].includes(job.status) && (
                      <div className="px-4 pb-3 -mt-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setCancelTargetId(job.id);
                          }}
                          disabled={cancelTargetId === job.id}
                          className="text-xs text-red-600 font-medium hover:underline"
                        >
                          {t.jobsPage.cancelJob}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <CancelJobModal open={cancelTargetId !== null} onClose={() => setCancelTargetId(null)} onConfirm={handleCancel} />
    </div>
  );
}
