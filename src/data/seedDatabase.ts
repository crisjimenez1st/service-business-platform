import { seedIfEmpty } from '../services/localDb';
import { TABLES } from '../services/tables';
import { seedCompany, seedUsers } from './seedCompany';
import { seedClients } from './seedClients';
import { seedEquipment } from './seedEquipment';
import { seedWarranties } from './seedWarranties';
import { seedJobs } from './seedJobs';
import { seedOpportunities } from './seedOpportunities';

/**
 * Inicializa localStorage con datos demo SOLO la primera vez que se
 * carga la app en un navegador (si la tabla ya existe, no se toca —
 * así los cambios del usuario en la demo persisten entre recargas).
 *
 * ⚠️ Clients y Opportunities YA NO se siembran aquí como fuente de
 * verdad para sus propias pantallas -- viven en Supabase real (ver
 * clientService.ts/opportunityService.ts). seedClients/seedOpportunities
 * siguen sembrando localDb únicamente porque Equipment/Jobs (todavía
 * mock) referencian esos mismos ids de cliente/oportunidad en sus
 * propios datos demo -- ver notas en seedOpportunities.ts.
 *
 * Quotes y JobDrafts ya no tienen seed local: ambos viven
 * exclusivamente en Supabase (quoteService.ts/jobDraftService.ts, vía
 * RPCs transaccionales) y no existe ningún patrón de "cotizaciones
 * demo pre-fabricadas en localStorage" -- crear datos de demostración
 * reales para esas tablas requeriría una empresa real en Supabase, no
 * un seed de frontend.
 */
export function seedDatabase(): void {
  seedIfEmpty(TABLES.companies, [seedCompany]);
  seedIfEmpty(TABLES.users, seedUsers);
  seedIfEmpty(TABLES.clients, seedClients);
  seedIfEmpty(TABLES.equipment, seedEquipment);
  seedIfEmpty(TABLES.warranties, seedWarranties);
  seedIfEmpty(TABLES.jobs, seedJobs);
  seedIfEmpty(TABLES.opportunities, seedOpportunities);
}
