import { useEffect } from 'react';
import { useCurrentCompany } from '../contexts/useCurrentCompany';
import { useClinicServicesStore } from '../store/clinicServicesStore';

/** Carga el catálogo de la empresa activa (lo leen dueño, doctor y recepción) y devuelve los servicios activos. */
export function useClinicServices() {
  const { company } = useCurrentCompany();
  const companyId = company?.id;
  const canRead = company?.role === 'owner' || company?.role === 'office' || company?.role === 'technician';
  const services = useClinicServicesStore((s) => s.services);
  const load = useClinicServicesStore((s) => s.load);
  useEffect(() => {
    if (companyId && canRead) load(companyId);
  }, [companyId, canRead, load]);
  return services.filter((s) => s.active);
}
