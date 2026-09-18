/**
 * localDb: motor de persistencia genérico sobre localStorage.
 *
 * IMPORTANTE — ARQUITECTURA:
 * Esta capa existe para que los servicios (clientService, opportunityService...)
 * nunca toquen localStorage directamente. El día que conectemos Supabase,
 * solo se reescribe este archivo (o se reemplazan los servicios uno por uno)
 * y ningún componente de UI se entera del cambio.
 *
 * Cada "tabla" es una key de localStorage con un array JSON.
 * Todas las consultas relevantes deben filtrar por companyId — aquí se
 * expone `getAllForCompany` para forzar ese hábito desde ya.
 */

const STORAGE_PREFIX = 'camsaas_v1_';

function readTable<T>(table: string): T[] {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + table);
    if (!raw) return [];
    return JSON.parse(raw) as T[];
  } catch {
    return [];
  }
}

function writeTable<T>(table: string, data: T[]): void {
  localStorage.setItem(STORAGE_PREFIX + table, JSON.stringify(data));
}

/** Inicializa una tabla con datos semilla SOLO si aún no existe (primera carga). */
export function seedIfEmpty<T>(table: string, seedData: T[]): void {
  const existing = localStorage.getItem(STORAGE_PREFIX + table);
  if (existing === null) {
    writeTable(table, seedData);
  }
}

export function getAll<T>(table: string): T[] {
  return readTable<T>(table);
}

export function getAllForCompany<T extends { companyId: string }>(
  table: string,
  companyId: string
): T[] {
  return readTable<T>(table).filter((row) => row.companyId === companyId);
}

export function getById<T extends { id: string }>(
  table: string,
  id: string
): T | undefined {
  return readTable<T>(table).find((row) => row.id === id);
}

export function insert<T extends { id: string }>(table: string, item: T): T {
  const rows = readTable<T>(table);
  rows.push(item);
  writeTable(table, rows);
  return item;
}

export function update<T extends { id: string }>(
  table: string,
  id: string,
  patch: Partial<T>
): T | undefined {
  const rows = readTable<T>(table);
  const idx = rows.findIndex((row) => row.id === id);
  if (idx === -1) return undefined;
  rows[idx] = { ...rows[idx], ...patch };
  writeTable(table, rows);
  return rows[idx];
}

/**
 * Igual que `update`, pero rechaza la escritura si el registro no
 * pertenece a `companyId`. Este es el que deben usar los servicios de
 * negocio para cualquier mutación — evita que conocer un `id` alcance
 * para modificar datos de otra empresa (aislamiento multi-tenant).
 */
export function updateForCompany<T extends { id: string; companyId: string }>(
  table: string,
  id: string,
  companyId: string,
  patch: Partial<T>
): T | undefined {
  const rows = readTable<T>(table);
  const idx = rows.findIndex((row) => row.id === id && row.companyId === companyId);
  if (idx === -1) return undefined;
  rows[idx] = { ...rows[idx], ...patch };
  writeTable(table, rows);
  return rows[idx];
}

export function remove(table: string, id: string): void {
  const rows = readTable<{ id: string }>(table);
  writeTable(
    table,
    rows.filter((row) => row.id !== id)
  );
}

/** Utilidad de desarrollo: borra todas las tablas de la app (no otras keys del dominio). */
export function resetAllTables(tableNames: string[]): void {
  tableNames.forEach((t) => localStorage.removeItem(STORAGE_PREFIX + t));
}

export function generateId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
