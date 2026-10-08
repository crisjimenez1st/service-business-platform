import { useMemo } from 'react';
import { useCurrentCompany } from '../contexts/useCurrentCompany';
import { buildNavItems, type NavItems } from '../components/layout/navConfig';
import { getBusinessTerms } from '../i18n/businessTerms';

/** Menú de la empresa activa, según su tipo de negocio. */
export function useNavItems(): NavItems {
  const { company } = useCurrentCompany();
  const businessType = company?.businessType ?? 'technical_services';
  return useMemo(() => buildNavItems(businessType, getBusinessTerms(businessType)), [businessType]);
}
