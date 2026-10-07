import { useCurrentCompany } from '../contexts/useCurrentCompany';
import { getBusinessTerms, type BusinessTerms } from '../i18n/businessTerms';

/** Lenguaje de la empresa activa (Paciente/Cita/Doctor, Cliente/Trabajo/Técnico...). */
export function useTerms(): BusinessTerms {
  const { company } = useCurrentCompany();
  return getBusinessTerms(company?.businessType);
}
