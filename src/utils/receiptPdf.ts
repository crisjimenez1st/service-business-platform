import type { PublicReceipt } from '../types';
import { formatCurrency } from './currency';
import { formatLongDateInTimezone, formatTimeInTimezone } from './timezone';
import { PAYMENT_METHOD_LABELS } from './paymentStatus';

/** Genera el PDF del recibo (carga jsPDF solo al descargar, para no pesar en el resto de la app). */
export async function downloadReceiptPdf(r: PublicReceipt): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a5' });
  const w = doc.internal.pageSize.getWidth();
  const money = (n: number) => formatCurrency(n, r.currency);
  const method = PAYMENT_METHOD_LABELS[r.method as keyof typeof PAYMENT_METHOD_LABELS] ?? r.method;

  doc.setFillColor(0, 102, 255);
  doc.rect(0, 0, w, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(r.companyName, 12, 17);

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(13);
  doc.text('RECIBO DE PAGO', 12, 42);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139);
  doc.text(`N.º ${r.receiptCode}`, w - 12, 42, { align: 'right' });

  const rows: [string, string][] = [
    ['Paciente', r.clientFirstName],
    ['Servicio', r.serviceName],
    ['Fecha', `${formatLongDateInTimezone(r.paidAt, r.timezone)}, ${formatTimeInTimezone(r.paidAt, r.timezone)}`],
    ['Forma de pago', method],
  ];
  let y = 56;
  for (const [label, value] of rows) {
    doc.setTextColor(100, 116, 139);
    doc.text(label, 12, y);
    doc.setTextColor(30, 41, 59);
    doc.text(value, w - 12, y, { align: 'right' });
    y += 8;
  }

  y += 4;
  doc.setDrawColor(226, 232, 240);
  doc.line(12, y, w - 12, y);
  y += 12;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(30, 41, 59);
  doc.text('Monto recibido', 12, y);
  doc.setFontSize(16);
  doc.setTextColor(0, 102, 255);
  doc.text(r.amount !== undefined ? money(r.amount) : '—', w - 12, y, { align: 'right' });

  if (r.balance !== undefined) {
    y += 12;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text('Saldo pendiente del servicio', 12, y);
    doc.setTextColor(30, 41, 59);
    doc.text(money(r.balance), w - 12, y, { align: 'right' });
  }

  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184);
  doc.text('Gracias por su confianza.', w / 2, doc.internal.pageSize.getHeight() - 14, { align: 'center' });
  if (r.companyPhone) {
    doc.text(`Contacto: ${r.companyPhone}`, w / 2, doc.internal.pageSize.getHeight() - 9, { align: 'center' });
  }

  doc.save(`Recibo-${r.receiptCode}.pdf`);
}
