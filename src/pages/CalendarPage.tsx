import { useEffect, useMemo, useState } from 'react';
import { ErrorState } from '../components/ui';
import CalendarNav, { type CalendarViewMode } from '../components/calendar/CalendarNav';
import MonthView from '../components/calendar/MonthView';
import WeekView from '../components/calendar/WeekView';
import DayView from '../components/calendar/DayView';
import MobileAgendaView from '../components/calendar/MobileAgendaView';
import UnscheduledJobsRow from '../components/calendar/UnscheduledJobsRow';
import JobDetailSheet from '../components/calendar/JobDetailSheet';
import { useCurrentCompany } from '../contexts/useCurrentCompany';
import { useClientsById } from '../hooks/useClientsById';
import { useJobStore } from '../store/jobStore';
import { useMyJobsStore } from '../store/myJobsStore';
import {
  formatLongDateInTimezone,
  getDayKeyInTimezone,
  getMonthRangeLabel,
  getWeekRangeLabel,
  startOfWeekMonday,
} from '../utils/timezone';
import type { JobStatus } from '../types';
import { t } from '../i18n/es';

/**
 * Página de calendario (Fase 3, Bloque 4). Bifurca por rol en un único
 * componente en vez de dos páginas separadas -- comparten la misma
 * navegación de fecha, solo cambian los datos (jobStore vs
 * myJobsStore) y las acciones disponibles.
 *
 * owner/office: Month/Week/Day en desktop (>= sm), MobileAgendaView en
 * móvil -- ambos vía jobStore (Job completo, lectura directa protegida
 * por RLS). technician: SIEMPRE agenda diaria con navegación
 * ← Anterior | Hoy | Siguiente →, en cualquier viewport -- vía
 * myJobsStore, que solo puede llamar a get_my_assigned_jobs() y
 * update_job_as_technician() (nunca una consulta directa sobre jobs).
 */
export default function CalendarPage() {
  const { company } = useCurrentCompany();
  const companyId = company?.id;
  const role = company?.role;
  const timezone = company?.timezone ?? 'America/Managua';
  const isTechnician = role === 'technician';

  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [anchorDate, setAnchorDate] = useState(new Date());
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [pendingJobId, setPendingJobId] = useState<string | null>(null);

  const { clientsById } = useClientsById();

  const jobsInRange = useJobStore((s) => s.jobsInRange);
  const unscheduledJobs = useJobStore((s) => s.unscheduledJobs);
  const technicians = useJobStore((s) => s.technicians);
  const jobLoading = useJobStore((s) => s.loading);
  const jobError = useJobStore((s) => s.error);
  const loadRange = useJobStore((s) => s.loadRange);
  const loadTechnicians = useJobStore((s) => s.loadTechnicians);
  const assignTechnician = useJobStore((s) => s.assignTechnician);
  const scheduleJobAction = useJobStore((s) => s.schedule);

  const technicianNamesById = useMemo(() => {
    const map: Record<string, string> = {};
    technicians.forEach((tech) => {
      map[tech.userId] = tech.displayName;
    });
    return map;
  }, [technicians]);

  const { rangeStart, rangeEnd } = useMemo(() => {
    if (viewMode === 'month') {
      const start = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1);
      const gridStart = startOfWeekMonday(start);
      const end = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 1);
      const gridEnd = new Date(end);
      gridEnd.setDate(gridEnd.getDate() + 7);
      return { rangeStart: gridStart, rangeEnd: gridEnd };
    }
    if (viewMode === 'week') {
      const start = startOfWeekMonday(anchorDate);
      const end = new Date(start);
      end.setDate(end.getDate() + 7);
      return { rangeStart: start, rangeEnd: end };
    }
    const start = new Date(anchorDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return { rangeStart: start, rangeEnd: end };
  }, [viewMode, anchorDate]);

  useEffect(() => {
    if (!companyId || isTechnician) return;
    loadRange(companyId, rangeStart.toISOString(), rangeEnd.toISOString());
  }, [companyId, isTechnician, rangeStart, rangeEnd, loadRange]);

  useEffect(() => {
    if (!companyId || isTechnician) return;
    loadTechnicians(companyId);
  }, [companyId, isTechnician, loadTechnicians]);

  const myJobs = useMyJobsStore((s) => s.jobs);
  const myJobsLoading = useMyJobsStore((s) => s.loading);
  const myJobsError = useMyJobsStore((s) => s.error);
  const loadMyJobs = useMyJobsStore((s) => s.load);
  const updateMyJobStatus = useMyJobsStore((s) => s.updateStatus);

  useEffect(() => {
    if (isTechnician) loadMyJobs();
  }, [isTechnician, loadMyJobs]);

  const myJobsForSelectedDay = useMemo(() => {
    if (!isTechnician) return [];
    const dayKey = getDayKeyInTimezone(anchorDate.toISOString(), timezone);
    return myJobs.filter((j) => j.scheduledStartAt && getDayKeyInTimezone(j.scheduledStartAt, timezone) === dayKey);
  }, [isTechnician, myJobs, anchorDate, timezone]);

  const myUnscheduledJobs = useMemo(() => myJobs.filter((j) => !j.scheduledStartAt), [myJobs]);

  async function handleTechnicianStatusUpdate(jobId: string, newStatus: JobStatus) {
    setPendingJobId(jobId);
    await updateMyJobStatus(jobId, newStatus);
    setPendingJobId(null);
  }

  function goToPrevious() {
    const d = new Date(anchorDate);
    if (isTechnician || viewMode === 'day') d.setDate(d.getDate() - 1);
    else if (viewMode === 'week') d.setDate(d.getDate() - 7);
    else d.setMonth(d.getMonth() - 1);
    setAnchorDate(d);
  }
  function goToNext() {
    const d = new Date(anchorDate);
    if (isTechnician || viewMode === 'day') d.setDate(d.getDate() + 1);
    else if (viewMode === 'week') d.setDate(d.getDate() + 7);
    else d.setMonth(d.getMonth() + 1);
    setAnchorDate(d);
  }
  function goToToday() {
    setAnchorDate(new Date());
  }

  const rangeLabel = isTechnician
    ? formatLongDateInTimezone(anchorDate.toISOString(), timezone)
    : viewMode === 'month'
      ? getMonthRangeLabel(anchorDate, timezone)
      : viewMode === 'week'
        ? getWeekRangeLabel(anchorDate, timezone)
        : formatLongDateInTimezone(anchorDate.toISOString(), timezone);

  const selectedJob = jobsInRange.find((j) => j.id === selectedJobId) ?? unscheduledJobs.find((j) => j.id === selectedJobId);

  if (isTechnician) {
    return (
      <div className="space-y-4 pb-4">
        <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">{t.calendar.title}</h1>
        <CalendarNav
          viewMode="day"
          onViewModeChange={() => {}}
          hideViewSwitcher
          rangeLabel={rangeLabel}
          onPrevious={goToPrevious}
          onToday={goToToday}
          onNext={goToNext}
        />
        {myJobsError ? (
          <ErrorState message={myJobsError.message} onRetry={loadMyJobs} />
        ) : myJobsLoading ? (
          <p className="text-center text-sm text-slate-500 py-12">{t.common.loading}</p>
        ) : (
          <MobileAgendaView
            mode="technician"
            jobs={[...myJobsForSelectedDay, ...myUnscheduledJobs]}
            timezone={timezone}
            onUpdateStatus={handleTechnicianStatusUpdate}
            pendingJobId={pendingJobId}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-4">
      <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">{t.calendar.title}</h1>

      <CalendarNav
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        rangeLabel={rangeLabel}
        onPrevious={goToPrevious}
        onToday={goToToday}
        onNext={goToNext}
      />

      {jobError ? (
        <ErrorState
          message={jobError.message}
          onRetry={() => companyId && loadRange(companyId, rangeStart.toISOString(), rangeEnd.toISOString())}
        />
      ) : (
        <>
          <UnscheduledJobsRow
            jobs={unscheduledJobs}
            clientsById={clientsById}
            timezone={timezone}
            onSelectJob={setSelectedJobId}
          />

          {jobLoading ? (
            <p className="text-center text-sm text-slate-500 py-12">{t.common.loading}</p>
          ) : (
            <>
              <div className="hidden sm:block">
                {viewMode === 'month' && (
                  <MonthView
                    anchorDate={anchorDate}
                    jobs={jobsInRange}
                    clientsById={clientsById}
                    timezone={timezone}
                    onSelectJob={setSelectedJobId}
                    onSelectDay={(date) => {
                      setAnchorDate(date);
                      setViewMode('day');
                    }}
                  />
                )}
                {viewMode === 'week' && (
                  <WeekView
                    anchorDate={anchorDate}
                    jobs={jobsInRange}
                    clientsById={clientsById}
                    timezone={timezone}
                    onSelectJob={setSelectedJobId}
                  />
                )}
                {viewMode === 'day' && (
                  <DayView
                    jobs={jobsInRange.filter((j) => {
                      if (!j.scheduledStartAt) return false;
                      return (
                        getDayKeyInTimezone(j.scheduledStartAt, timezone) ===
                        getDayKeyInTimezone(anchorDate.toISOString(), timezone)
                      );
                    })}
                    clientsById={clientsById}
                    timezone={timezone}
                    onSelectJob={setSelectedJobId}
                  />
                )}
              </div>

              <div className="sm:hidden">
                <MobileAgendaView
                  mode="admin"
                  jobs={jobsInRange}
                  clientsById={clientsById}
                  technicianNamesById={technicianNamesById}
                  timezone={timezone}
                  onSelectJob={setSelectedJobId}
                />
              </div>
            </>
          )}
        </>
      )}

      <JobDetailSheet
        open={selectedJobId !== null}
        onClose={() => setSelectedJobId(null)}
        job={selectedJob}
        client={selectedJob ? clientsById[selectedJob.clientId] : undefined}
        technicianName={selectedJob?.assignedTechnicianId ? technicianNamesById[selectedJob.assignedTechnicianId] : undefined}
        technicians={technicians}
        timezone={timezone}
        onAssignTechnician={async (technicianId) => {
          if (!selectedJobId) return false;
          const result = await assignTechnician(selectedJobId, technicianId);
          return result !== null;
        }}
        onSchedule={async (startAtIso, endAtIso) => {
          if (!selectedJobId) return false;
          const result = await scheduleJobAction(selectedJobId, startAtIso, endAtIso);
          return result !== null;
        }}
      />
    </div>
  );
}
