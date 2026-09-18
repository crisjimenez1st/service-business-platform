import { useContext } from 'react';
import { CompanyContext, type CompanyContextValue } from './companyContextDefinition';

export function useCurrentCompany(): CompanyContextValue {
  const ctx = useContext(CompanyContext);
  if (!ctx) {
    throw new Error('useCurrentCompany debe usarse dentro de <CompanyProvider>');
  }
  return ctx;
}
