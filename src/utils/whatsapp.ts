/**
 * Genera enlaces wa.me con mensaje prellenado.
 * Fase 1: solo enlaces (sin API real de WhatsApp Business).
 * La arquitectura permite sustituir `buildWhatsAppLink` por una llamada
 * a WhatsApp Business API más adelante sin tocar los componentes que la usan.
 */

export function buildWhatsAppLink(phone: string, message: string): string {
  const cleanPhone = phone.replace(/[^\d+]/g, '').replace('+', '');
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
}

export function opportunityWhatsAppMessage(clientName: string, title: string, value: string): string {
  return `Hola ${clientName} 👋\n\n${title}.\nPrecio estimado: ${value}.\n\n¿Deseas agendar?`;
}

export function jobReminderWhatsAppMessage(clientName: string, date: string, time: string): string {
  return `Hola ${clientName} 👋\n\nTe recordamos tu cita programada para ${date} a las ${time}.\n\n¡Nos vemos pronto!`;
}

export function quoteWhatsAppMessage(
  clientName: string,
  quoteNumber: string,
  total: string,
  publicLink: string
): string {
  return `Hola ${clientName} 👋\n\nTe compartimos la cotización ${quoteNumber} por el servicio solicitado.\n\nTotal: ${total}\n\nPuedes verla aquí:\n${publicLink}\n\nQuedamos atentos a cualquier consulta.`;
}
