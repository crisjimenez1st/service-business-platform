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

/** Prefijos telefónicos por zona horaria (Centroamérica) para números locales de 8 dígitos. */
const COUNTRY_CODE_BY_TIMEZONE: Record<string, string> = {
  'America/Managua': '505',
  'America/Costa_Rica': '506',
  'America/Guatemala': '502',
  'America/Tegucigalpa': '504',
  'America/El_Salvador': '503',
  'America/Panama': '507',
};

/**
 * Número listo para wa.me. wa.me exige código de país: si el número
 * viene con "+" o ya es largo se respeta; si es local de 8 dígitos se le
 * antepone el prefijo del país de la empresa (según su zona horaria).
 * Otros formatos se envían tal cual -- el usuario puede corregir el
 * número en el cliente.
 */
export function toWhatsAppNumber(phone: string, timezone: string): string {
  const hasPlus = phone.trim().startsWith('+');
  let digits = phone.replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (!hasPlus && digits.length === 8) {
    const code = COUNTRY_CODE_BY_TIMEZONE[timezone];
    if (code) digits = code + digits;
  }
  return digits;
}
