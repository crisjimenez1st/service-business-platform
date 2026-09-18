/**
 * Construye la URL pública absoluta de una cotización a partir de su
 * publicToken. Usa window.location.origin (no una URL hardcodeada) para
 * que funcione igual en desarrollo, producción o cualquier dominio
 * futuro sin tocar este archivo.
 */
export function buildQuotePublicLink(publicToken: string): string {
  return `${window.location.origin}/q/${publicToken}`;
}
