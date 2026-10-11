import { useEffect } from 'react';
import { useCurrentCompany } from '../contexts/useCurrentCompany';
import { useClinicServicesStore } from '../store/clinicServicesStore';

/** Carga el catálogo de la empresa activa (solo dueño y recepción lo pueden leer) y devuelve los servicios activos. */
export function useClinicServices() {
  const { company } = useCurrentCompany();
  const companyId = company?.id;
  const canRead = company?.role === 'owner' || company?.role === 'office';
  const services = useClinicServicesStore((s) => s.services);
  const load = useClinicServicesStore((s) => s.load);
  useEffect(() => {
    if (companyId && canRead) load(companyId);
  }, [companyId, canRead, load]);
  return services.filter((s) => s.active);
}
