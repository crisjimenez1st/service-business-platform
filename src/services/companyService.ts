import type { Company } from '../types';
import * as db from './localDb';
import { TABLES } from './tables';

/**
 * companyService: lecturas de la propia empresa. `getCompanyById` no
 * exige sesión — se usa desde la página pública de cotización
 * (/q/:publicToken) para mostrar nombre/logo de la empresa, sin que el
 * cliente final tenga companyId ni login. El único control de acceso a
 * esa ruta es el publicToken de la Quote, no este servicio.
 */
export function getCompanyById(id: string): Company | undefined {
  return db.getById<Company>(TABLES.companies, id);
}
