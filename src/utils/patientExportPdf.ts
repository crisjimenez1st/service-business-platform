import type { Client, Job, MedicalProfile, TreatmentPlan, VisitRecord } from '../types';
import { formatCurrency } from './currency';
import { JOB_STATUS_LABELS } from './jobStatus';
import { formatLongDateInTimezone } from './timezone';

export interface PatientExportData {
  companyName: string;
  timezone: string;
  client: Client;
  jobs: Job[];
  records: Record<string, VisitRecord>;
  medical: MedicalProfile | null;
  plans: TreatmentPlan[] | null;
  includeClinical: boolean;
}

/** Expediente completo del paciente en PDF (carga jsPDF solo al descargar). */
export async function downloadPatientPdf(d: PatientExportData): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 16;
  let y = M;

  const ensure = (h: number) => {
    if (y + h > H - M) {
      doc.addPage();
      y = M;
    }
  };
  const heading = (text: string) => {
    ensure(14);
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(0, 82, 204);
    doc.text(text, M, y);
    y += 2;
    doc.setDrawColor(220, 215, 255);
    doc.line(M, y, W - M, y);
    y += 5;
  };
  const line = (label: string, value?: string) => {
    if (!value) return;
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    const lines = doc.splitTextToSize(`${label ? label + ': ' : ''}${value}`, W - 2 * M);
    ensure(lines.length * 5);
    doc.setFont('helvetica', label ? 'normal' : 'normal');
    doc.text(lines, M, y);
    y += lines.length * 5;
  };
  const date = (iso?: string) => (iso ? formatLongDateInTimezone(iso, d.timezone) : 'Sin fecha');

  doc.setFillColor(11, 20, 55);
  doc.rect(0, 0, W, 30, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Expediente del paciente', M, 14);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`${d.companyName} · generado el ${date(new Date().toISOString())}`, M, 22);
  y = 38;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42);
  doc.text(d.client.name, M, y);
  y += 6;

  heading('Datos de contacto');
  line('Teléfono', d.client.phone);
  line('WhatsApp', d.client.whatsapp);
  line('Correo', d.client.email);
  line('Dirección', d.client.address);
  line('Fecha de nacimiento', d.client.birthDate);
  line('Paciente desde', date(d.client.createdAt));
  line('Notas', d.client.notes);

  if (d.includeClinical) {
    heading('Historial médico');
    if (d.medical) {
      line('Alergias', d.medical.allergies);
      line('Antecedentes', d.medical.medicalHistory);
      line('Medicamentos', d.medical.medications);
      line('Notas importantes', d.medical.importantNotes);
    } else {
      line('', 'Sin historial médico registrado.');
    }
  }

  heading('Citas y atenciones');
  const jobs = [...d.jobs].sort((a, b) => (a.scheduledStartAt ?? a.createdAt).localeCompare(b.scheduledStartAt ?? b.createdAt));
  if (jobs.length === 0) line('', 'Sin citas.');
  jobs.forEach((j) => {
    ensure(12);
    y += 2;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(15, 23, 42);
    doc.text(`${date(j.scheduledStartAt)} · ${j.serviceType} · ${JOB_STATUS_LABELS[j.status] ?? j.status}`, M, y);
    y += 5;
    if (j.total !== undefined && j.status !== 'cancelled') {
      line('', `Precio ${formatCurrency(j.total, j.currency)} · Pagado ${formatCurrency(j.paidAmount ?? 0, j.currency)}`);
    }
    const r = d.records[j.id];
    if (d.includeClinical && r) {
      line('Motivo', r.reason);
      line('Diagnóstico', r.diagnosis);
      line('Tratamiento', r.treatment);
      line('Receta', r.prescription);
      line('Próximos pasos', r.nextSteps);
    }
    line('Notas', j.notes);
  });

  if (d.plans && d.plans.length > 0) {
    heading('Planes de tratamiento');
    d.plans.forEach((p) => {
      ensure(12);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(`${p.name} · ${formatCurrency(p.total, p.currency)} (pagado ${formatCurrency(p.paidAmount, p.currency)})`, M, y);
      y += 5;
      p.payments
        .filter((x) => !x.voidedAt)
        .forEach((x) => line('', `Abono ${date(x.paidAt)}: ${formatCurrency(x.amount, p.currency)}${x.note ? ' · ' + x.note : ''}`));
    });
  }

  const safe = d.client.name.replace(/[^\p{L}\p{N}]+/gu, '_');
  doc.save(`Expediente_${safe}.pdf`);
}
