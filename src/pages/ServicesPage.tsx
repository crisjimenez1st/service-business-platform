import { useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { Badge, Button, Card, EmptyState, ErrorState, Sheet } from '../components/ui';
import { INPUT_CLASS } from '../components/payments/inputClasses';
import { useCurrentCompany } from '../contexts/useCurrentCompany';
import { useClinicServicesStore } from '../store/clinicServicesStore';
import { normalizeServiceKey } from '../services/serviceRulesService';
import { formatCurrency } from '../utils/currency';
import type { ClinicService, CurrencyCode } from '../types';

const NO_CATEGORY = 'Sin tipo';

interface Starter { name: string; category: string }
interface StarterPack { key: string; label: string; hint: string; types: ('dental' | 'medical')[]; items: Starter[] }

/** Servicios comunes por especialidad. Se cargan sin precio: el doctor los ajusta y borra lo que no ofrezca. */
const STARTER_PACKS: StarterPack[] = [
  {
    key: 'dentist',
    label: 'Dentista general',
    hint: 'Consulta, limpieza, resinas, extracciones, endodoncia, coronas…',
    types: ['dental'],
    items: [
      { name: 'Consulta y valoración', category: 'Diagnóstico' },
      { name: 'Radiografía periapical', category: 'Diagnóstico' },
      { name: 'Radiografía panorámica', category: 'Diagnóstico' },
      { name: 'Limpieza dental', category: 'Prevención' },
      { name: 'Aplicación de flúor', category: 'Prevención' },
      { name: 'Sellantes', category: 'Prevención' },
      { name: 'Resina (empaste)', category: 'Restauración' },
      { name: 'Corona', category: 'Rehabilitación' },
      { name: 'Prótesis removible', category: 'Rehabilitación' },
      { name: 'Extracción simple', category: 'Cirugía' },
      { name: 'Extracción de muela del juicio', category: 'Cirugía' },
      { name: 'Endodoncia', category: 'Endodoncia' },
      { name: 'Blanqueamiento', category: 'Estética' },
      { name: 'Urgencia dental', category: 'Urgencias' },
    ],
  },
  {
    key: 'ortho',
    label: 'Ortodoncia',
    hint: 'Estudio, brackets, alineadores, controles, retenedores…',
    types: ['dental'],
    items: [
      { name: 'Consulta y estudio de ortodoncia', category: 'Diagnóstico' },
      { name: 'Estudio fotográfico y radiográfico', category: 'Diagnóstico' },
      { name: 'Instalación de brackets metálicos', category: 'Instalación' },
      { name: 'Instalación de brackets estéticos', category: 'Instalación' },
      { name: 'Alineadores transparentes', category: 'Instalación' },
      { name: 'Control mensual de ortodoncia', category: 'Controles' },
      { name: 'Cambio de arco y ligas', category: 'Controles' },
      { name: 'Retiro de aparatos', category: 'Finalización' },
      { name: 'Retenedores', category: 'Finalización' },
      { name: 'Reparación de bracket', category: 'Urgencias' },
    ],
  },
  {
    key: 'medical',
    label: 'Médico general',
    hint: 'Consultas, certificados, curaciones, inyecciones, chequeo…',
    types: ['medical'],
    items: [
      { name: 'Consulta general', category: 'Consulta' },
      { name: 'Consulta de control', category: 'Consulta' },
      { name: 'Consulta de urgencia', category: 'Consulta' },
      { name: 'Chequeo general', category: 'Prevención' },
      { name: 'Certificado médico', category: 'Documentos' },
      { name: 'Constancia médica', category: 'Documentos' },
      { name: 'Curación', category: 'Procedimientos' },
      { name: 'Sutura', category: 'Procedimientos' },
      { name: 'Inyección intramuscular', category: 'Procedimientos' },
      { name: 'Nebulización', category: 'Procedimientos' },
      { name: 'Toma de presión y glucosa', category: 'Procedimientos' },
    ],
  },
];

/** Catálogo de servicios y precios: lo que ofrece el consultorio, por tipo de tratamiento (solo dueño y recepción). */
export default function ServicesPage() {
  const { company } = useCurrentCompany();
  const companyId = company?.id;
  const currency: CurrencyCode = company?.currency === 'USD' ? 'USD' : 'NIO';
  const services = useClinicServicesStore((s) => s.services);
  const loading = useClinicServicesStore((s) => s.loading);
  const loadError = useClinicServicesStore((s) => s.error);
  const load = useClinicServicesStore((s) => s.load);
  const create = useClinicServicesStore((s) => s.create);
  const update = useClinicServicesStore((s) => s.update);
  const remove = useClinicServicesStore((s) => s.remove);

  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<ClinicService | 'new' | null>(null);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState('');
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [packsOpen, setPacksOpen] = useState(false);
  const [packBusy, setPackBusy] = useState(false);
  const [packNotice, setPackNotice] = useState<string | null>(null);

  const canUse = company?.role === 'owner' || company?.role === 'office' || company?.role === 'technician';
  // Cada consultorio ofrece cosas distintas: lo define el dueño o el doctor. La recepción solo consulta.
  const canEdit = company?.role === 'owner' || company?.role === 'technician';

  useEffect(() => {
    if (companyId && canUse) load(companyId);
  }, [companyId, canUse, load]);

  const categories = useMemo(
    () => [...new Set(services.map((s) => s.category).filter((c): c is string => !!c))].sort((a, b) => a.localeCompare(b, 'es')),
    [services],
  );

  const groups = useMemo(() => {
    const q = normalizeServiceKey(query);
    const filtered = services.filter(
      (s) => !q || normalizeServiceKey(s.name).includes(q) || normalizeServiceKey(s.category ?? '').includes(q),
    );
    const map = new Map<string, ClinicService[]>();
    filtered.forEach((s) => {
      const key = s.category || NO_CATEGORY;
      map.set(key, [...(map.get(key) ?? []), s]);
    });
    return [...map.entries()].sort(([a], [b]) => (a === NO_CATEGORY ? 1 : b === NO_CATEGORY ? -1 : a.localeCompare(b, 'es')));
  }, [services, query]);

  if (!company || !canUse) {
    return <EmptyState title="Sin acceso" description="Los servicios y precios los ve el equipo de la clínica." />;
  }

  function openNew() {
    setEditing('new');
    setName('');
    setCategory('');
    setPrice('');
    setActive(true);
    setError(null);
  }

  function openEdit(s: ClinicService) {
    setEditing(s);
    setName(s.name);
    setCategory(s.category ?? '');
    setPrice(s.price !== undefined ? String(s.price) : '');
    setActive(s.active);
    setError(null);
  }

  async function handleSave() {
    if (!name.trim()) return setError('Escribe el nombre del servicio.');
    let priceNum: number | undefined;
    if (price.trim()) {
      priceNum = Number(price.replace(',', '.'));
      if (!Number.isFinite(priceNum) || priceNum < 0) return setError('El precio no es válido.');
    }
    setSaving(true);
    setError(null);
    const input = { name, category, price: priceNum, active };
    const err = editing === 'new' ? await create(input) : editing ? await update(editing.id, input) : null;
    setSaving(false);
    if (err) return setError(err.message);
    setEditing(null);
  }

  async function loadPack(pack: StarterPack) {
    setPackBusy(true);
    setPageError(null);
    const existing = new Set(services.map((s) => normalizeServiceKey(s.name)));
    let added = 0;
    for (const item of pack.items) {
      if (existing.has(normalizeServiceKey(item.name))) continue;
      const err = await create({ name: item.name, category: item.category });
      if (err) {
        setPageError(err.message);
        break;
      }
      added += 1;
    }
    setPackBusy(false);
    setPackNotice(added === 0 ? 'Ya tenías todos esos servicios.' : `Se agregaron ${added} servicios. Ahora ponles el precio y borra los que no ofrezcas.`);
    setPacksOpen(false);
  }

  async function handleDelete(s: ClinicService) {
    setPageError(null);
    const err = await remove(s.id);
    if (err) setPageError(err.message);
  }

  return (
    <div className="space-y-4 pb-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-slate-900">Servicios y precios</h1>
          <p className="text-sm text-slate-600 mt-1">
            Lo que ofrece el consultorio, por tipo de tratamiento. Al agendar una cita se elige el servicio y el precio se completa solo.
          </p>
          {!canEdit && <p className="text-xs text-slate-500 mt-1">Los servicios y precios los define el doctor.</p>}
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => { setPackNotice(null); setPacksOpen(true); }}>
              Cargar servicios comunes
            </Button>
            <Button onClick={openNew}>
              <Plus size={18} className="mr-1.5" />
              Nuevo servicio
            </Button>
          </div>
        )}
      </div>

      {services.length > 0 && (
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar servicio o tipo de tratamiento"
            aria-label="Buscar servicio"
            className={`${INPUT_CLASS} pl-9`}
          />
        </div>
      )}

      {packNotice && <p role="status" className="text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">{packNotice}</p>}
      {pageError && <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{pageError}</p>}

      {loadError ? (
        <ErrorState message={loadError.message} onRetry={() => companyId && load(companyId)} />
      ) : loading && services.length === 0 ? (
        <p className="text-sm text-slate-500">Cargando…</p>
      ) : services.length === 0 ? (
        <EmptyState
          title="Aún no tienes servicios"
          description={canEdit ? 'Agrega lo que ofreces con su precio. Así, al agendar solo lo buscas y eliges.' : 'Pídele al doctor que agregue los servicios y sus precios.'}
        />
      ) : groups.length === 0 ? (
        <EmptyState title="Sin resultados" description="Prueba con otra palabra." />
      ) : (
        groups.map(([cat, items]) => (
          <section key={cat} className="space-y-2">
            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">{cat}</h2>
            <Card className="!p-0 divide-y divide-slate-100">
              {items.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className={['text-sm font-medium truncate', s.active ? 'text-slate-900' : 'text-slate-400'].join(' ')}>{s.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-sm font-semibold text-brand-700">
                        {s.price !== undefined ? formatCurrency(s.price, currency) : <span className="text-slate-400 font-normal">Sin precio</span>}
                      </span>
                      {!s.active && <Badge>Desactivado</Badge>}
                    </div>
                  </div>
                  {canEdit && (
                  <div className="flex gap-1 shrink-0">
                    <button
                      type="button"
                      aria-label={`Editar ${s.name}`}
                      onClick={() => openEdit(s)}
                      className="min-h-10 min-w-10 inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                    >
                      <Pencil size={16} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Eliminar ${s.name}`}
                      onClick={() => handleDelete(s)}
                      className="min-h-10 min-w-10 inline-flex items-center justify-center rounded-lg text-red-500 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                  )}
                </div>
              ))}
            </Card>
          </section>
        ))
      )}

      {packsOpen && (
        <Sheet open onClose={() => !packBusy && setPacksOpen(false)} title="Cargar servicios comunes">
          <div className="space-y-3">
            <p className="text-sm text-slate-600">
              Elige tu especialidad. Se agregan los servicios más comunes, sin precio, y los que ya tengas no se repiten. Luego ajustas todo a lo que tú ofreces.
            </p>
            {STARTER_PACKS.filter((p) => company.businessType === 'dental' || company.businessType === 'medical' ? p.types.includes(company.businessType) : true).map((pack) => (
              <button
                key={pack.key}
                type="button"
                disabled={packBusy}
                onClick={() => loadPack(pack)}
                className="w-full text-left rounded-2xl border border-slate-200 bg-white px-4 py-3 hover:bg-slate-50 disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                <span className="block font-semibold text-slate-900">{pack.label} <span className="font-normal text-slate-500">· {pack.items.length} servicios</span></span>
                <span className="block text-sm text-slate-500 mt-0.5">{pack.hint}</span>
              </button>
            ))}
            {packBusy && <p className="text-sm text-slate-500">Agregando…</p>}
          </div>
        </Sheet>
      )}

      {editing && (
        <Sheet
          open
          onClose={() => !saving && setEditing(null)}
          title={editing === 'new' ? 'Nuevo servicio' : 'Editar servicio'}
          footer={
            <Button fullWidth onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando…' : 'Guardar'}
            </Button>
          }
        >
          <div className="space-y-4">
            <div>
              <label htmlFor="svc-name" className="block text-sm font-medium text-slate-700 mb-1.5">Servicio *</label>
              <input id="svc-name" type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={120} placeholder="Ej. Limpieza dental" className={INPUT_CLASS} autoFocus />
            </div>
            <div>
              <label htmlFor="svc-cat" className="block text-sm font-medium text-slate-700 mb-1.5">Tipo de tratamiento</label>
              {categories.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {categories.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCategory(c)}
                      className={[
                        'px-3 min-h-9 rounded-full border text-sm',
                        category === c ? 'bg-brand-600 border-brand-600 text-white' : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50',
                      ].join(' ')}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
              <input id="svc-cat" type="text" value={category} onChange={(e) => setCategory(e.target.value)} maxLength={60} placeholder="Ej. Prevención, Ortodoncia, Cirugía" className={INPUT_CLASS} />
            </div>
            <div>
              <label htmlFor="svc-price" className="block text-sm font-medium text-slate-700 mb-1.5">
                Precio ({currency === 'USD' ? 'US$' : 'C$'})
              </label>
              <input id="svc-price" type="text" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Puedes dejarlo vacío" className={INPUT_CLASS} />
            </div>
            <label className="flex items-start gap-3 min-h-11 cursor-pointer">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="mt-0.5 h-5 w-5 rounded border-slate-300 text-brand-600" />
              <span className="text-sm text-slate-700">Disponible para agendar (si lo desactivas, deja de aparecer en las listas)</span>
            </label>
            {error && <p role="alert" className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          </div>
        </Sheet>
      )}
    </div>
  );
}
