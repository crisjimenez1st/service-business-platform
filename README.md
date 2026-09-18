# ServiFlow — Gestión de Servicios Técnicos B2B

SaaS mobile-first para empresas de servicios técnicos (instalación y
mantenimiento de CCTV / seguridad electrónica, y otros rubros de
servicio de campo). Producto B2B dirigido a empresas con equipo propio
(dueño/oficina + técnicos), no a técnicos independientes.

Flujo de producto: **Cliente → Oportunidad → Cotización → Venta → Job
→ Cobro → Mantenimiento → Nueva oportunidad** — cada trabajo realizado
alimenta la siguiente oportunidad de ingreso (mantenimientos,
garantías, clientes inactivos, ampliaciones, ventas adicionales).

## Estado actual

Backend real sobre **Supabase** (Postgres + Auth + RLS) desde Fase 2.5.
Multiempresa con aislamiento real por Row Level Security (no solo
validación de aplicación) y tres roles: `owner`, `office`, `technician`
— cada uno con su propia superficie de datos y acciones, aplicada en
el servidor, no solo ocultada en la UI.

Completado: Auth, Clientes, Oportunidades, Cotizaciones (con enlace
público de aceptación/rechazo), y Fase 3 completa — Jobs reales
(esquema con integridad multiempresa vía FKs compuestas), acceso de
técnicos (RPCs limitadas, nunca SELECT directo sobre columnas
administrativas), conversión JobDraft → Job, asignación y programación
de técnicos, y Calendario real (Mes/Semana/Día para admin, agenda
diaria para técnico), con manejo explícito de zona horaria por
empresa.

## Cómo ejecutar el proyecto

```bash
npm install
npm run dev       # servidor de desarrollo, http://localhost:5173
npm run build     # build de producción a /dist (incluye tsc -b)
npm run lint      # oxlint
npm run preview   # sirve el build de producción localmente
```

### Variables de entorno (obligatorias)

Este proyecto requiere un proyecto real de Supabase — ya no usa datos
simulados. Copia `.env.example` a `.env` y completa:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Ambos valores se obtienen en el dashboard de Supabase, **Project
Settings → API**, de tu propio proyecto. `VITE_SUPABASE_ANON_KEY` es la
clave pública ("anon"), segura para el navegador — la protección real
vive en las políticas de Row Level Security de cada tabla (ver
`supabase/migrations/`), no en mantener esta clave en secreto. La
`service_role key` **nunca** debe usarse en este proyecto ni en ningún
código que corra en el navegador — no aparece, y no debe añadirse.

Sin estas variables, `npm run build` genera un bundle que falla
inmediatamente al cargar en el navegador (ver `src/lib/supabase.ts`) —
Vite incrusta su valor en el JavaScript final en tiempo de build, así
que también deben estar disponibles ahí donde se ejecute el build (por
ejemplo, en las variables de entorno del sitio en Netlify), no solo en
tu máquina local.

Este repositorio nunca debe llevar un `.env` con valores reales — está
excluido vía `.gitignore`.

## Stack

- React 19 + TypeScript + Vite 8
- Tailwind CSS v4 (tokens de marca en `src/index.css` vía `@theme`)
- React Router v7 (rutas protegidas por sesión)
- Zustand (estado global por dominio: auth, clientes, oportunidades,
  cotizaciones, jobs)
- Supabase (`@supabase/supabase-js`): Auth, Postgres, RLS, RPCs
  transaccionales para operaciones que necesitan validación o
  atomicidad en el servidor
- lucide-react (iconografía)

## Arquitectura de carpetas

```
src/
  components/
    ui/            Button, Card, Badge, Sheet, EmptyState, ErrorState — primitivos reutilizables
    layout/         Sidebar, BottomNav, MoreSheet, ProtectedRoute, navConfig
    dashboard/      MetricCard, TodayJobCard (aún mock, ver deuda técnica), OpportunityCard
    clients/        ClientListCard, FilterChips, Tabs, EquipmentCard, JobHistoryCard, NewClientSheet, EditClientSheet
    opportunities/  PostponeModal, DiscardModal, ContactSheet, NewOpportunitySheet
    quotes/         ClientPickerSheet, QuoteItemEditor, QuoteTotalsEditor,
                     QuoteRow, QuoteSummaryCard, QuoteItemsList,
                     QuoteTotalsSummary, DeleteQuoteModal, JobDraftSheet
    calendar/       CalendarNav, MonthView, WeekView, DayView, JobEventChip,
                     MobileAgendaView, JobAgendaCard, JobDetailSheet,
                     AssignTechnicianSheet, ScheduleJobSheet, UnscheduledJobsRow
  layouts/          AppLayout (estructura responsive compartida)
  pages/            Una página por ruta; ensamblan componentes + hooks + servicios
                     (incluye QuotesPage, QuoteFormPage, QuoteDetailPage,
                     QuotePublicPage — fuera de AppLayout, sin sesión —
                     y CalendarPage, que bifurca por rol internamente)
  contexts/         AuthContext, CompanyContext (empresa activa + rol + timezone del usuario autenticado)
  hooks/            useClientsById (lógica de UI reutilizable)
  services/         Única puerta de entrada a datos — ver "Cómo se administran los datos"
    mappers/        snake_case (Supabase) <-> camelCase (dominio), por entidad
  store/            Zustand: authStore, clientStore, opportunityStore, quoteStore, jobStore, myJobsStore
  types/            Interfaces de dominio (Company, Client, Job, MyAssignedJob,
                     CompanyTechnician, Opportunity, Quote, QuoteItem, JobDraft...)
                     + database.types.ts (shape real de las tablas/RPCs de Supabase)
  utils/            currency, dates, timezone (agrupación/presentación de fechas
                     por zona horaria de empresa, ver Calendario), whatsapp,
                     jobStatus, quoteStatus, quoteLink
  i18n/             Strings en español, preparado para inglés futuro

supabase/
  migrations/       Migraciones SQL numeradas secuencialmente (001-010 al momento
                     de este README) — esquema, RLS, RPCs. Ver cada archivo para
                     el razonamiento de diseño de seguridad, documentado inline.
```

**Principio de separación:** los componentes de página (`pages/`) nunca
llaman a Supabase directamente — siempre pasan por `services/`. Cada
servicio administrativo (`clientService`, `jobService`, ...) hace
lectura directa protegida por RLS y escritura vía RPC cuando la
operación necesita validación transaccional (ver más abajo). El
servicio de técnico (`technicianJobService`) es una superficie
deliberadamente más estrecha: solo puede llamar a las RPCs limitadas
que el backend expone para ese rol, nunca una consulta directa sobre
tablas con columnas administrativas.

## Cómo se administran los datos

Cada entidad tiene su propio servicio (`clientService.ts`,
`opportunityService.ts`, `jobService.ts`, `quoteService.ts`,
`technicianJobService.ts`) con funciones específicas de negocio, sobre
el cliente de Supabase (`src/lib/supabase.ts`). Los mappers en
`services/mappers/` traducen entre las columnas `snake_case` de
Postgres y los tipos de dominio `camelCase` que usa el resto de la
app.

**Lectura vs. escritura:** las lecturas administrativas son queries
directas (`supabase.from('tabla').select(...)`), protegidas por las
políticas RLS de cada tabla — nunca por lógica de aplicación. Las
escrituras que necesitan validación de negocio, transacciones, o
idempotencia (crear un Job desde un borrador, cambiar el estado de un
Job, asignar un técnico) pasan por **RPCs de Postgres**
(`supabase.rpc('nombre_funcion', {...})`) definidas en
`supabase/migrations/` — la validación real vive en el servidor, el
frontend nunca es la última autoridad sobre si una operación es
válida.

**Multiempresa y roles:** cada tabla de negocio lleva `company_id`, y
las políticas RLS filtran por la empresa activa del usuario
autenticado — reforzado, donde aplica, con foreign keys compuestas que
impiden a nivel de esquema que una fila referencie una entidad de otra
empresa (ver comentarios en `supabase/migrations/007_jobs_schema.sql`
en particular). El rol `technician` tiene una superficie de datos
deliberadamente distinta a `owner`/`office`: sin acceso de lectura
directo a la tabla `jobs` (para no exponer columnas administrativas
como montos), solo a través de RPCs que devuelven exactamente los
campos operativos necesarios (`get_my_assigned_jobs`,
`get_my_job_photos`, `get_my_job_materials`).

## Calendario y zona horaria

El calendario (`CalendarPage` y `components/calendar/`) agrupa y
presenta fechas usando la zona horaria de la empresa
(`companies.timezone`, columna IANA — ej. `America/Managua`), nunca
UTC ni la zona horaria del navegador de quien lo mira. Ver
`src/utils/timezone.ts` para el razonamiento completo y por qué esto
importa (agrupar por `toISOString().slice(0,10)` colocaría citas
nocturnas en el día incorrecto para una empresa fuera de UTC).

## Cómo añadir una nueva página

1. Crear el componente en `src/pages/NuevaPagina.tsx`.
2. Si necesita datos, crear o extender un servicio en `src/services/`
   (nunca llamar a Supabase directamente desde la página).
3. Añadir la ruta en `src/App.tsx` dentro del bloque
   `<Route element={<AppLayout />}>` si requiere navegación/sesión.
4. Si es una sección del menú "Más", ya existe su entrada en
   `src/components/layout/navConfig.ts` (`SECONDARY_NAV`) — solo hay
   que reemplazar su `ComingSoonPage` por la página real en `App.tsx`.
5. Añadir los textos necesarios a `src/i18n/es.ts` en vez de escribirlos
   directamente en el JSX.
6. Si la página necesita una operación nueva de backend, evaluar si es
   una lectura simple (query directa + RLS) o si necesita validación/
   transacción (RPC nueva, como migración SQL siguiente en
   `supabase/migrations/`).

## Deployment

Este proyecto se despliega en Netlify (`netlify.toml` en la raíz:
`npm run build` → publica `dist/`, con fallback SPA a `/index.html`).
Netlify debe ejecutar el build él mismo (conectado a este repositorio
Git) para que las variables de entorno `VITE_SUPABASE_URL` /
`VITE_SUPABASE_ANON_KEY` configuradas en su dashboard (Site settings →
Environment variables) se incrusten correctamente en el bundle — un
deploy manual de una carpeta `dist/` ya construida en otro lugar no
usa esas variables de Netlify en absoluto, porque el build ya ocurrió
antes de subirla.

## Deuda técnica conocida

- **Dashboard ("Trabajos de hoy") sigue usando datos mock** sobre
  `localStorage` (`services/mockJobService.ts`, tipo `MockJob` en
  `types/jobs.ts`) — no migrado todavía a Supabase. Igual
  `ClientProfilePage` (pestaña de historial de trabajos) y
  `TodayJobCard`/`JobHistoryCard`. Se resolverá cuando esa pantalla se
  aborde explícitamente en el roadmap.
- **Sin Storage de fotos, materiales UI, checklist, firma,
  notificaciones, integración de WhatsApp API, ni motor de
  mantenimiento automático** — todo fuera de alcance de los bloques
  completados hasta ahora, mencionado explícitamente donde aplica en
  los comentarios de cada migración SQL.
- Ver comentarios `⚠️` dentro de `supabase/migrations/*.sql` para
  limitaciones de diseño puntuales documentadas en el momento de cada
  decisión (ej. `notes` sin historial de auditoría por entrada).

## Cómo convertir la PWA en app móvil (iOS/Android)

La app ya es instalable como PWA (`public/manifest.json`,
`display: standalone`). Para empaquetarla como app nativa sin
reescribir:

1. Instalar Capacitor (`@capacitor/core`, `@capacitor/cli`) sobre este
   mismo proyecto Vite.
2. `npx cap init` y `npx cap add ios` / `npx cap add android`.
3. Capacitor envuelve el build de `dist/` en un WebView nativo — la
   lógica de React/servicios no cambia.
4. Añadir plugins nativos según se necesiten (cámara para fotos de
   trabajo, geolocalización, notificaciones push) — la capa de
   `services/` es el lugar natural para envolver esas llamadas nativas
   detrás de la misma interfaz que ya usan los componentes.

## Iconos PWA pendientes

Ver `public/icons/README.md` — faltan generar los archivos PNG reales
(192×192, 512×512, 512×512 maskable) antes de una instalación pulida
en producción.

## Idioma

100% español por ahora. Todos los textos de UI están centralizados en
`src/i18n/es.ts`. Para añadir inglés: crear `src/i18n/en.ts` con las
mismas keys y un selector de idioma que elija el diccionario activo
(no implementado todavía).
