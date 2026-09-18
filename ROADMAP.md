# Roadmap

## FASE 1 — Dashboard + Clientes + Oportunidades ✅ (esta entrega)

- Arquitectura completa (tipos, servicios, store, i18n, capa mock sobre localStorage)
- Layout responsive real (mobile-first: bottom nav / sidebar rail / sidebar completo)
- PWA instalable (manifest, meta tags; service worker deliberadamente pospuesto)
- Login demo
- Dashboard con métricas, trabajos de hoy y Oportunidades de ingreso
- Clientes: búsqueda, filtros, perfil con tabs (resumen, trabajos, equipos)
- Oportunidades: listar, filtrar por categoría, contactar, WhatsApp, posponer, descartar
- Multiempresa: `companyId` en todas las entidades, validado en cada lectura por id
- Auditoría de responsive, accesibilidad (contraste WCAG AA), duplicados y aislamiento
  multi-tenant completada sobre esta misma entrega

## FASE 2 — Cotizaciones ✅ (esta entrega)

- Modelo de datos completo: `Quote`, `QuoteItem`, `QuoteStatus` (draft, sent,
  viewed, accepted, rejected, expired, cancelled), `JobDraft`
- `quoteService` + `quoteStore`: numeración `COT-0001` aislada por empresa,
  cálculo de totales, CRUD, duplicar, cancelar, transiciones administrativas
  y transiciones vía token público (ver abajo)
- Listado `/quotes`: búsqueda, filtros por estado, tabla en desktop /
  cards en móvil (mismo componente, sin tabla horizontal gigante en móvil)
- Crear/editar `/quotes/new` y `/quotes/:id/edit`: selector de cliente,
  ítems como cards editables (no tabla), descuento/impuesto opcionales
  (impuesto en 0 por defecto — no se obliga IVA), notas, vencimiento
  (15 días por defecto)
- Detalle `/quotes/:id`: acciones según estado efectivo (editar/enviar/
  duplicar/eliminar en borrador; reenviar/copiar enlace/marcar aceptada
  o rechazada en enviada-vista-vencida; crear orden de trabajo en aceptada)
- Página pública `/q/:publicToken`: sin sidebar ni navegación
  administrativa, sin sesión — único control de acceso es el token
  (`crypto.randomUUID()`, nunca se expone `companyId`). Documento
  comercial profesional, aceptar/rechazar con motivo opcional,
  `viewed` automático al abrir por primera vez
- Envío por WhatsApp con mensaje profesional prellenado y enlace público real
- `QuoteDraft` (Oportunidad → Cotización, de Fase 1) ahora se consume de
  verdad: el formulario precarga sus datos y `markQuoteDraftConsumed` lo
  retira para evitar duplicados
- `JobDraft` (Cotización aceptada → Orden de trabajo): mismo patrón de
  borrador que `QuoteDraft`, listo para que Fase 3 lo recupere.
  `createJobDraft` es idempotente por `quoteId` — pulsar varias veces
  "Crear orden de trabajo" nunca genera duplicados
- **Auditoría final de Fase 2 (esta misma entrega):** las transiciones
  de estado ahora se validan dentro de `quoteService`, no solo en qué
  botón muestra la UI — `sendQuote` solo desde `draft`;
  `markAcceptedManually`/`markRejectedManually` permiten corrección
  administrativa entre sí (`accepted ↔ rejected`, además de
  `sent`/`viewed`); `acceptQuoteByToken`/`rejectQuoteByToken` (públicas)
  solo cuando el estado EFECTIVO es `sent` o `viewed` — nunca sobre
  `draft`, `accepted`, `rejected`, `cancelled` ni `expired`. Si la
  transición no es válida, no se modifica nada y la página pública
  vuelve a consultar el estado real por token en vez de mostrar éxito
  falso (antes asumía éxito incondicionalmente)
- Integrado en Dashboard (sección pequeña: pendientes de respuesta,
  aceptadas este mes, valor pendiente) y en el perfil del cliente (tab
  "Cotizaciones")
- Multiempresa: toda lectura/escritura administrativa exige `companyId`
  (incluidas las mutaciones antes descubiertas sin validar en la
  auditoría de Fase 1); la ruta pública valida solo por `publicToken`
- **Decisión de arquitectura:** `/quotes/:id` es el detalle de solo
  lectura; la edición de un borrador vive en `/quotes/:id/edit` (ruta
  separada, mismo componente `QuoteFormPage` que `/quotes/new`) — la
  spec original no distinguía explícitamente ambas rutas y esta
  separación evitaba la ambigüedad de una sola ruta sirviendo dos
  propósitos distintos
- **⚠️ Limitación deliberada de esta demo:** el enlace público
  `/q/:publicToken` no funciona entre dispositivos distintos, porque
  todo vive en el `localStorage` de cada navegador — una cotización
  creada en la computadora A no puede abrirse desde un teléfono B. No
  se intentó resolver con hacks de localStorage; se resuelve de raíz
  al conectar Supabase/backend (`getQuoteByPublicToken` pasará a
  consultar una base de datos compartida). Ver detalle completo en
  README, sección "Limitación deliberada de esta demo".
- **⚠️ Numeración no seguro con concurrencia real:** `generateQuoteNumber`
  (leer todas + tomar el máximo + 1) es correcto sobre `localStorage`
  pero tiene una condición de carrera clásica en una base de datos con
  escrituras concurrentes reales. Al migrar a Supabase/Postgres,
  sustituir por una `SEQUENCE` o una función transaccional por
  `companyId` — ver detalle en README.
- **Nota técnica (atomicidad):** `convertToQuoteDraft` (Oportunidad →
  QuoteDraft) sigue teniendo el mismo riesgo de atomicidad señalado al
  cerrar Fase 1 — ver README, sección "Cómo conectar Supabase más
  adelante". Aplica igual de aquí en adelante a cualquier flujo de dos
  escrituras encadenadas (p. ej. Cotización aceptada → JobDraft)

## FASE 3 — Órdenes de trabajo

- Vista lista + calendario de trabajos
- Estados completos (nuevo → programado → en camino → en progreso → completado)
- Asignación de técnico, cambio de fecha, recordatorios
- Conectar el botón "Crear orden de trabajo" de Cotizaciones (ya deja
  `JobDraft` preparado en `jobDraftService`, ver `getJobDraftByQuoteId`) a
  un formulario real

## FASE 4 — App/interfaz de técnicos

- Vista optimizada para celular: checklist, fotos (antes/durante/después),
  materiales utilizados, notas, firma del cliente, finalizar trabajo

## FASE 5 — Equipos + Garantías

- CRUD completo de equipos por cliente
- Vista de garantías (activas / próximas a vencer / vencidas)
- Generación automática de oportunidades por vencimiento (30/15/7 días)

## FASE 6 — Mantenimientos automáticos

- Motor de reglas que genera Oportunidades según periodicidad de equipo,
  garantía próxima, inactividad de cliente, fin de vida útil estimada

## FASE 7 — Cobros

- Registro de pagos, saldos, recordatorios, métodos de pago

## FASE 8 — WhatsApp Business

- Sustituir enlaces `wa.me` por integración real de WhatsApp Business API
- Plantillas de mensaje configurables desde Configuración

## FASE 9 — Reportes

- Ventas por mes, ticket promedio, dinero cobrado/pendiente, ingresos por
  mantenimiento, oportunidades convertidas, técnicos con más trabajos

## FASE 10 — IA para detectar oportunidades de ingresos

- Modelo/heurísticas más sofisticadas que las reglas fijas de Fase 6:
  patrones de uso, probabilidad de conversión, priorización automática

---

## Deuda técnica transversal (no ligada a una fase específica)

- **Backend real:** todo corre sobre `localStorage` vía `localDb.ts`.
  Ver README, "Cómo conectar Supabase más adelante", para el plan de
  migración manteniendo las mismas firmas de servicio.
- **Enlaces públicos no cruzan dispositivos:** consecuencia directa de
  no tener backend — `/q/:publicToken` solo funciona dentro del mismo
  navegador/dispositivo donde se creó la cotización. Se resuelve al
  conectar Supabase (ver README, sección de Cotizaciones).
- **Numeración no segura con concurrencia real:** `generateQuoteNumber`
  necesita una secuencia o función transaccional de base de datos al
  migrar — ver README.
- **Transacciones:** cualquier operación que encadene dos o más
  escrituras (Oportunidad → QuoteDraft, Cotización aceptada → JobDraft)
  debe volverse atómica al migrar a una base de datos real — hoy
  funciona porque `localStorage` no tiene concurrencia, pero eso deja
  de ser cierto con llamadas de red independientes.
- **WhatsApp Business API real:** hoy son enlaces `wa.me` con mensaje
  prellenado (el usuario los envía manualmente desde su WhatsApp). No
  hay envío automático, tracking de entrega/lectura del lado de
  WhatsApp, ni plantillas aprobadas por Meta.
- **Emails:** no hay envío de cotizaciones por correo — solo WhatsApp
  y enlace copiable.
- **Firma digital avanzada:** la "aceptación" de una cotización es un
  botón con confirmación, no una firma electrónica con validez legal
  ni verificación de identidad del firmante.
- **PDF:** no se genera un PDF descargable de la cotización — la
  página pública es el único "documento"; no hay versión imprimible
  ni adjunta a email.
- **Analytics/eventos:** no hay registro de eventos (cotización vista
  cuántas veces, tiempo hasta respuesta, tasa de conversión por
  categoría de oportunidad, etc.) más allá de los timestamps puntuales
  guardados en cada `Quote` (`sentAt`, `viewedAt`, `acceptedAt`,
  `rejectedAt`).

---

**No se avanza a la siguiente fase sin aprobación explícita.** Cada fase
se construye, se audita y se entrega antes de empezar la siguiente.
