# Contexto para Claude Code — Visualizador PAF

## Qué es esto

Plataforma **en producción** de monitoreo del **Programa Aprender en Familia (PAF)** que opera Consultora Focus junto a Fundación CAP. Cubre las dos vertientes del programa: **Escolar** (2025–2027, 2026–2028) y **Parvulario** (2025–2026, 2026–2027).

Los datos son reales: provienen de planillas de trabajo mantenidas por Focus y se ingestan en Firestore. El deploy vive en Firebase Hosting.

- **URL producción:** https://visualizador-paf.web.app
- **Proyecto Firebase:** `visualizador-paf`
- **Contacto cliente principal:** Luis Agurto (lagurto@focus.cl). No técnico. Todo lo que él vea debe estar libre de código y jerga.
- **Contacto técnico Focus:** Sebastián Peters (speters@focus.cl).

Este archivo describe la arquitectura y las convenciones activas. **Reescribir cuando cambien.** Fue reescrito el 2026-07-29 tras la retroalimentación del cliente sobre el modelo canónico de indicadores.

---

## Stack

- **Frontend:** React 18 + Vite + Tailwind CSS + Recharts.
- **Estado remoto:** `@tanstack/react-query` sobre Firestore.
- **Auth:** Firebase Auth (Google OAuth + email/password).
- **Datos:** Firestore (colección `resultados_real`, `progresoTrimestral_real`, `establecimientos_real`, `usuarios`, `config/*`).
- **Ingesta:** scripts Node ESM en `scripts/` que leen planillas Google Sheets y XLSX en `scripts/datos/`.
- **Deploy:** Firebase Hosting (`npm run deploy`) y reglas/índices Firestore (`npm run deploy:rules`).

No hay backend propio: el navegador consulta Firestore directamente con reglas RLS por perfil.

---

## Mapa del código

### Datos

- **`src/data/catalog.json`** — catálogo persistido de ámbitos e indicadores por programa y año. Generado por `scripts/parseCatalogs.mjs`. **No editar a mano**: cualquier corrección debe pasar por el pipeline de parseo + mapa canónico (ver "Numeración canónica" abajo).
  - `indicadores.escolar2025` — 50 indicadores (histórico, ver "Comparación entre años").
  - `indicadores.escolar2026` — indicadores vigentes escolares.
  - `indicadores.parvulario` — indicadores vigentes parvulario.
  - Campos por indicador: `id`, `programa`, `version`, `estrategiaId`, `estrategiaNombre`, `ambito`, `actividadNombre`, `nombre`, `meta`, `metaNum`, `tipoMeta`, `unidad`, `tipo`, `fuente`, `frecuencia`, `inicio`, `clasificacion` (`'estrategia'` = indicador de ámbito, `'producto'` = indicador de logro), `desagregaNivel` (parvulario, opcional).
- **`src/data/catalogs/`** — planillas fuente del catálogo (`Sistema indicadores PAF Escolar 2026.xlsx`, `Sistema indicadores PAF Parvulario.xlsx`).
- **`src/data/establecimientos.js`** — helpers puros de dominio: `calcularLogro`, `estadoValor` (`'sin_meta' | 'sin_dato' | 'con_dato'`), `colorSemaforo`, `labelSemaforo`, `currentMonth`, `lastClosedMonth`, `capClosedPeriod`.
- **`src/data/scope.js`** — reglas de universo:
  - Año base = **2026**.
  - `isAplicable2026(indicador, est, mes)`: el indicador aplica cuando el semestre acumulado del establecimiento en 2026 (según cohorte) alcanza el semestre mínimo requerido por `indicador.inicio`.
  - `cumplimientoIndicadores`: promedio de `min(1, calcularLogro)` sobre los indicadores aplicables **con meta**. Un indicador aplicable **sin valor** cuenta como **0**.
- **`src/data/expectedValue.js`** — `formatValue(indicador, valor)` para display por unidad.
- **`src/data/matricula.js`** — reglas de visibilidad de matrícula por perfil.

### Consultas y hooks

- **`src/lib/queries.js` / `src/data/realQueries.js`** — todos los hooks de datos. Los más usados:
  - `useEstablecimientos`, `useEscuelas`, `useJardines`, `useSleps`.
  - `useIndicadores(programa)`, `useAmbitos(programa)` — leen `catalog.json`.
  - `useValoresAnio(anio)` — todos los `resultados_real` de un año (excluye docs con campo `nivel` para no doblecontar).
  - `useValoresAnioNivel(anio, nivel)`.
  - `useValoresAnioNiveles(anio, enabled)` — todos los niveles operativos en una sola query (`where nivel in [...]`), usado por el comparador en modo "por nivel".
  - `useValoresIndicador(estId, anio)`, `useProgresoTrimestral`, `useMesCerrado`, `usePipelineMetadata`.

### Vistas y componentes

- **`src/views/`**
  - `Login.jsx` — Google OAuth + email/password.
  - `PendienteAsignacion.jsx` — placeholder para usuarios sin perfil.
  - `VistaEscuela.jsx` — vista de un establecimiento (escuela o jardín).
  - `VistaSostenedor.jsx` — vista de un SLEP con toggle escolar/parvulario cuando hay ambos.
  - `VistaConsultor.jsx` — vista nacional para consultor y CAP. Filtros por sostenedor / cohorte / año de implementación / comuna. Contiene el comparador.
  - `VistaGeografia.jsx` — mapa Leaflet de los 42 establecimientos (superadmin, feature-flagged `VITE_FEATURE_GEOGRAFIA`). CircleMarkers coloreados por cumplimiento, tamaño por matrícula.
  - `GestionUsuarios.jsx`, `DashboardConsultores.jsx` — solo `superadmin`.
- **`src/views/comparador/ComparadorIndicador.jsx`** — comparador A/B por indicador. Soporta desgloses "agrupado", "por establecimiento" y "por nivel" (parvulario).
- **`src/components/`**
  - `IndicatorPanel.jsx` — grilla de indicadores agrupados por ámbito, colapsables. Separa estrategia (indicadores del ámbito) de producto (indicadores de logro).
  - `IndicatorDrilldown.jsx` — modal de detalle de un indicador para un establecimiento.
  - `IndicatorRanking.jsx` — top/bottom 3 por ratio de logro.
  - `IndicatorAveragePicker.jsx`, `SostenedorAveragePicker.jsx`, `SostenedorVsPromedio.jsx`, `HeatmapEstablecimientosIndicadores.jsx`.
  - `Shared.jsx` — `IndicatorProgress`, `KpiCard`, `SemaforoBadge`, `AmbitoCard`, primitivos.
  - `Glosario.jsx` — acordeón de siglas.
  - `Layout.jsx` — header + switcher de perfil + footer.
- **`src/lib/`**
  - `context.jsx` — `AppProvider`, `useApp`, definición de perfiles, listener de Firebase Auth y sincronización de `usuarios`.
  - `firebase.js` — cliente Firebase.
  - `labels.js` — `indicadorCodigo`, `ambitoCodigo`, `ambitoNombre`. Contiene `AMBITO_NAME_OVERRIDES` (mapa `${programa}:${ambitoId}` → nombre display) para renombrar ámbitos en UI sin tocar los datos almacenados.
  - `features.js` — feature flags: `FEATURES.heatmap` (`VITE_FEATURE_HEATMAP`), `FEATURES.geografia` (`VITE_FEATURE_GEOGRAFIA`). Ambos off por defecto en producción.

### Scripts

Ingesta y catálogo:

- **`scripts/parseCatalogs.mjs`** — reconstruye `catalog.json` desde los XLSX en `src/data/catalogs/`. Aplica el mapa canónico + assert de completitud del mapping Escolar (E4). No es idempotente en escritura: rompe cualquier edición manual del JSON.
- **`scripts/lib/canonicalIds.mjs`** — mapa canónico (adiciones, renombres, eliminaciones, overrides de ámbito/clasificación). Fuente única para el catálogo Y para migraciones Firestore.
- **`scripts/lib/parvularioIds.mjs`** — traducción entre numeración de planilla y numeración canónica (`extractPlanillaId`, `planillaToCanonical`). Tolera typos como `"I.,20"`.
- **`scripts/lib/escolarMapping.mjs`** — mapeo declarativo (año × arquetipo × indicador canónico × niveles aplicables) para Escolar. `assertMappingCompleto()` corre en `parseCatalogs.mjs` y falla si algún indicador canónico no tiene entrada (mapeada o explícitamente `NO_MAPEADO`).
- **`scripts/ingestParvulario.mjs`** — ingesta desde 3 Planillas Centrales → `establecimientos_real` + `resultados_real`. Escribe agregado por jardín y variantes por sala.
- **`scripts/ingestEscolar.mjs`** — ingesta escolar desde 18 workbooks de Google Drive. Marca `estado: 'validado' | 'provisional'`.
- **`scripts/ingestRosterEscolar.mjs`** — actualiza `nNinos`, `nAgentes`, `rbd` en `establecimientos_real`.
- **`scripts/ingestExtended.mjs`** — cierra huecos con `ZERO_FALLBACK` (emite `valor: 0` con `raw: "sin actividad reportada"`). **No confundir "reported zero" con "sin datos".**
- **`scripts/mapeoParvulario.mjs`** — reporte de cobertura → `docs/mapeo-parvulario-YYYY-MM-DD.md`.

Escolar addendum (ciclo 2026-07-30):

- **`scripts/parseEscolarIndex.mjs`** — parsea `docs/Planillas PAF Escolar.xlsx` → `src/data/escolarPlanillaIndex.json` (inventario de las 466 planillas esperadas por escuela × año × arquetipo × curso, con IDs de spreadsheet normalizados).
- **`scripts/harvestEscolar.mjs`** — baja las 466 planillas Escolar al cache `.cache/harvest/` con checkpoint resumible, retry con backoff/jitter, y redacción PII en vuelo (RUTs + nombres completos). `--dry-run`, `--resume`, `--sample=N`, `--only=<id>[,<id>...]`.
- **`scripts/generateEscolarCoverageManifest.mjs`** — resuelve, por cada tupla (escuela × año × indicador × curso), uno de 5 estados de cobertura (NO_CORRESPONDE_AUN / NO_CORRESPONDE / SIN_FUENTE_MAPEADA / FUENTE_NO_ACCESIBLE / SIN_DATO_REPORTADO). Emite `docs/escolar-coverage-manifest.{json,md}`. `--with-firestore` agrega CON_DATO / CERO_REPORTADO.
- **`scripts/importConsolidated2025.mjs`** — lee el workbook consolidado 2025 de Sebastián (Base Vertical + Indicadores + Nombre escuelas), importa metas/cumplimiento como capa de contraste (E6). **No lee la pestaña `Estudiantes`** (PII).
- **`scripts/metasDiscrepancyReport.mjs`** — cruza catálogo 2025 vs canónico 2026 por nombre aproximado. Emite `docs/escolar-metas-discrepancy.md`.
- **`scripts/piiAssertion.mjs`** — barrera de última milla. Escanea Firestore (`--all` cubre roster + progreso + usuarios) y opcionalmente `.cache/harvest/` (`--cache`) buscando patrones RUT, nombres completos en mayúsculas sostenidas, y campos prohibidos (`rut`, `nombreEstudiante`, etc.). Exit 1 en cualquier hit.
- **`scripts/diagnoseComparador.mjs`** — dump side-by-side de `resultados_real` por indicador × sostenedor × años. Usado para el fix del comparador en Bloque F.
- **`scripts/diagnoseAuthResolution.mjs`** — diagnóstico de assignments de usuarios (read-only). Verifica que cada `usuarios` doc con perfil limitado apunte a un establecimiento existente. Emite `reports/diagnoseAuthResolution-YYYY-MM-DD.json`.
- **`scripts/diagnoseTerritorial.mjs`** — diagnóstico de campos territoriales en `establecimientos_real` (slep, comuna, programa). Detecta nulos, variantes de acento/mayúsculas. Read-only.

Migraciones y utilidades:

- **`scripts/migrateEscolarIndicadorIds.mjs`** — normaliza `indicadorId` de la forma `I1` → `I.1`. Idempotente.
- **`scripts/migrateCanonicalIndicadorIds.mjs`** — **DEPRECADO** tras el incidente del 2026-07-29 (dos bugs: throttling sequential + non-injective rename map). Ver header del archivo. Para futuras renumeraciones canónicas: prefiere re-ingestar desde la fuente en vez de migrar Firestore in-place.
- **`scripts/checkColorTokens.mjs`** — guardián de tokens de color; corre antes de `vite build`.
- **`scripts/auditFill.mjs`** — auditoría de llenado (etapa 6).
- **`scripts/backfillSlepOnResultados.mjs`** — backfill one-shot: escribe campo `slep` en `resultados_real` y `progresoTrimestral_real` derivándolo de `establecimientos_real[establecimientoId].slep`. Requerido para la regla Firestore W1(d). Idempotente, `--dry-run`.
- **`scripts/backfillSlepIdOnUsuarios.mjs`** — backfill one-shot: escribe `slepId` en `usuarios` para perfiles jardin/escuela derivándolo del establecimiento asignado. Idempotente, `--dry-run`.
- **`scripts/validateUserAssignments.mjs`** — pre-deploy gate. Verifica assignments de usuarios y presencia del campo `slep` en resultados. Exit 1 en errores. `npm run validate:users`.
- **`scripts/repairTerritorial.mjs`** — repair one-shot: corrige `slep`, `comuna`, `sostenedor` en `establecimientos_real` con valores canónicos confirmados. `--dry-run`. Idempotente.
- **`scripts/coverageDiff.mjs`** — compara dos manifiestos de cobertura Escolar (`--before=`, `--after=`). Reporta transiciones por estado y mejoras/regresiones. Escribe `reports/coverageDiff-YYYY-MM-DD.{md,json}`.
- **`scripts/parseHomologacion.mjs`** — parsea `docs/homologacion-indicadores-escolar-2025-206.xlsx` → `src/data/homologacionEscolar.json`. 29 pares 2025↔2026, 21 descontinuados, 22 nuevos en 2026. `--dry-run`. `npm run parse:homologacion`.
- **`scripts/reporteConexionEscolar.mjs`** — reporte por escuela: qué (escuela × indicador × 2026) tuplas están conectadas a la planilla fuente vs. sin fuente. Emite `reports/reporteConexionEscolar-YYYY-MM-DD.{md,csv}`. `npm run reporte:conexion-escolar`.
- **`scripts/backfillEscolarNullDocs.mjs`** — backfill: para (escuela × indicador conectado × 2026) sin doc en Firestore, escribe doc con `valor=null estado='sin_dato_reportado'`. Idempotente. `--dry-run`. `npm run backfill:escolar-null`. Requerimiento Sebastián 2026-08-05.
- **`scripts/computeTerritorioAggregates.mjs`** — regenera `aggregatesTerritorio_real` (W1(peer)). Lee toda `resultados_real` (excluye docs con `nivel`) y produce dos tiers de agregados por indicador. Enforcea `K_MIN=4` en primary + gate YoY composition-delta. Idempotente. `--dry-run`. Correr después de cada ingesta. Reporte en `reports/computeTerritorioAggregates-YYYY-MM-DD.json`.

Datos generados:

- **`src/data/homologacionEscolar.json`** — mapa de homologación de indicadores Escolar 2025↔2026 en notación canónica (`I.1`). Usado por el comparador para alinear IDs entre años. No editar a mano; regenerar con `parse:homologacion`.
- **`src/data/escolarCoverageManifest.json`** — espejo de `docs/escolar-coverage-manifest.json` para import en runtime. Regenerar con `generateEscolarCoverageManifest.mjs` (dual-write automático).
- **`src/data/coverage.js`** — `getCoberturaEscolar(estId, anio, indId)` → estado de cobertura del manifiesto. `getCoberturaParvulario()` devuelve null (Parvulario no necesita este lookup). Buildea el lookup a nivel de módulo.

### Firestore

Colecciones:

- **`establecimientos_real/{doc_id}`** — Doc IDs `jar-{slug}` (parvulario) o `esc-{slug}` (escolar).
- **`resultados_real/{doc_id}`** — dos formatos:
  - Agregado por establecimiento: `parv_${estId}_${indId}_${anio}` / `esc_${estId}_${indId}_${anio}`.
  - Por sala (parvulario): `parv_${estId}_${indId}_${anio}_${nivelSlug}` con campos `nivel`, `nivelEspecifico`, `nivelGeneral`.
  - Todos los IDs pasan por `sanitizeDocId(/[^a-zA-Z0-9_.-]/g → _)`.
  - Campo `slep` denormalizado (backfill 2026-08-04): requerido para la regla Firestore de sostenedor. Todo nuevo doc de ingesta debe incluir `slep`.
- **`progresoTrimestral_real/{doc_id}`** — campo `slep` denormalizado igual que `resultados_real`.
- **`usuarios/{uid}`** — `email`, `nombre`, `perfilDefault` (`escuela | jardin | sostenedor | consultor | cap | superadmin | pendiente`), `establecimientoId` (jardin/escuela), `slepId` (jardin/escuela/sostenedor), `proveedor`.
  - `slepId` es obligatorio para jardin/escuela/sostenedor: lo usan las reglas Firestore y el hook `useEntidadDelPerfil` para peer-averages.
- **`config/dataSource`**, **`config/mesCerrado`**, **`config/pipelineMetadata`**.
- **`aggregatesTerritorio_real/{docId}`** — derivada, precomputada por `scripts/computeTerritorioAggregates.mjs`. Peer averages para el drilldown de perfiles Jardín/Escuela (W1(peer), shipped 2026-08-05).
  - Dos tiers: `aggregateKind='slep-tipo'` (primary, uno por `programa × slep × tipo × anio × indicadorId`) y `aggregateKind='programa'` (fallback, sin slep).
  - Doc ID: `agg_${programa}_${slep}_${tipo}_${anio}_${indId}` (primary) / `agg_${programa}_${tipo}_${anio}_${indId}` (fallback), pasado por `sanitizeDocId(/[^a-zA-Z0-9_.-]/g → _)`. La "í" de "Jardín" queda como `_`.
  - Campos: `nReporters`, `sumaValor`, `sumaLogroCapped`, `publishable`, `publishableReason` (`'ok'|'below_k_min'|'yoy_composition_leak'`), `computedAt`, `unidad`, `metaNum`, `slep` (solo primary).
  - Privacidad: solo docs con `publishable=true` son legibles por perfiles limitados. `K_MIN=4` reporters en primary; si el par `G_2025 / G_2026` difiere por exactamente 1 establecimiento, AMBOS años quedan `publishable=false`. Fallback siempre publishable (universo ≥ 18 por construcción).
  - **Excepción explícita al "no borrar Firestore":** esta colección se regenera con write-new-then-delete-orphans en ese orden (ver script). No aplicar a colecciones de fuente-de-verdad. Correr después de cada ingesta: `node scripts/computeTerritorioAggregates.mjs`.

Índices: ver `firestore.indexes.json`. Cualquier nueva query compuesta requiere agregar el índice y deployar con `npm run deploy:rules` **antes** del hosting.

---

## Cobertura de fuentes Escolar (addendum 2026-07-30)

Escolar no tiene una planilla central única como Parvulario. El programa opera con **466 planillas individuales** — para cada escuela × año, una planilla "Registro Coordinación" (o "Registro UTP" en 2025), una "Datos Consultor", y una por cada curso existente (PKA/PKB/KA/KB/1A/1B/…/8A/8B, +8C en 2025).

El inventario canónico de esas 466 planillas vive en `src/data/escolarPlanillaIndex.json`, generado por `scripts/parseEscolarIndex.mjs` a partir del archivo `docs/Planillas PAF Escolar.xlsx` que compartió Sebastián. Nunca inferir la lista de planillas — leerla siempre desde el índice.

### Flujo Escolar

1. **Índice** (`parseEscolarIndex.mjs`) declara las 466 planillas esperadas.
2. **Harvest** (`harvestEscolar.mjs`) baja los rangos crudos al cache `.cache/harvest/`, con checkpoint resumible. Toda la PII (RUTs, nombres completos) se redacta al vuelo antes de escribir a disco.
3. **Mapeo** (`scripts/lib/escolarMapping.mjs`) declara, por indicador canónico, dónde buscar el valor en el cache (tab, columna/rango, transformación). `NO_MAPEADO` es un estado explícito con razón.
4. **Manifiesto** (`generateEscolarCoverageManifest.mjs`) resuelve cada tupla (escuela × año × indicador × curso) a uno de 5 estados:

| Estado | Significado | Dueño |
|---|---|---|
| `NO_CORRESPONDE_AUN` | Fuera del universo por año de implementación | Nadie (diseño) |
| `NO_CORRESPONDE` | Fuera del universo estructural (curso no existe; nivel no aplica) | Nadie |
| `SIN_FUENTE_MAPEADA` | No hay coordenada declarada en el mapeo | **Nosotros** |
| `FUENTE_NO_ACCESIBLE` | Coordenada declarada, harvest falló (permisos, tab renombrado) | **Nosotros** |
| `SIN_DATO_REPORTADO` | Leído OK, celda vacía o sentinel | Focus |

Plus `CON_DATO_REPORTADO` y `CERO_REPORTADO` (para ZERO_FALLBACK) cuando se corre con `--with-firestore`.

Este manifiesto **no cambia** la fórmula de agregación. Un `SIN_DATO_REPORTADO` aplicable sigue contando 0 en el denominador del ámbito. El manifiesto cambia qué se **muestra y reporta**, no qué se **computa**.

---

## Disciplina de PII

Los workbooks Escolar contienen datos personales de estudiantes (RUT, nombre completo, curso) especialmente en la pestaña `Estudiantes` del consolidado 2025 y en las planillas por curso. Reglas absolutas:

- **La pestaña `Estudiantes` del consolidado 2025 NO se lee** desde ningún script que persista datos. Cualquier agregado a nivel sala (por ejemplo cobertura de entrevistas) debe computarse en un script separado que sostenga los datos personales solo en memoria y escriba únicamente el agregado.
- **`harvestEscolar.mjs` redacta al vuelo** cualquier RUT (`\b\d{1,2}\.?\d{3}\.?\d{3}[-\s]?[0-9kK]\b`) y cualquier secuencia de 4+ palabras en MAYÚSCULA SOSTENIDA (patrón del tab Estudiantes) antes de escribir al cache. Nombres institucionales ("Escuela Villa San Miguel") están whitelisted.
- **`scripts/piiAssertion.mjs`** es la barrera de última milla: exit code 1 si detecta cualquier fuga en Firestore o en el cache. Correr después de cada ingesta / harvest y antes de cada deploy.
- **`.cache/`** está gitignored. Nunca commitear snapshots del harvest.
- **Compliance framing:** Ley 21.719 (Chile) sobre protección de datos personales. La instrucción operativa está en `docs/informe-revision-escolar-2026-07-30.md`. Cualquier framing legal formal debe validarse con asesor antes de aparecer en documentos de cara al cliente.

---

## Numeración canónica de indicadores

**Fuente de verdad** (en orden de precedencia, según instrucción del cliente 2026-07-29):

1. `Orden de indicadores para visualizador` (documentos separados Parvulario y Escolar). Manda para numeración, pertenencia a ámbito, nombres de ámbito y separación ámbito/logro.
2. `Indicadores PAF Escolar` / `Indicadores PAF Parvulario`. Manda para metas, frecuencias y fuentes.
3. Planillas centrales. Manda para valores.

Toda numeración previa (subset "mock", numeraciones de planilla) es subordinada. Los mapeos históricos viven en `scripts/lib/parvularioIds.mjs` y deben actualizarse cuando cambia el canónico.

Estructura canónica vigente:

**Parvulario — 53 indicadores (I.1–I.53) en 3 ámbitos:**

| Ámbito | Nombre display | Indicadores del ámbito | Indicadores de logro |
|---|---|---|---|
| A.1 | Gestión institucional | I.1 – I.8 (8) | I.34 – I.36 (3) |
| A.2 | Formación Equipos educativos | I.9 – I.14 (6) | I.37 – I.42 (6) |
| A.3 | Formación Apoderados | I.15 – I.33 (19) | I.43 – I.53 (11) |

**Escolar 2026 — 51 indicadores (I.1–I.51) en 4 ámbitos:**

| Ámbito | Nombre display | Indicadores del ámbito | Indicadores de logro |
|---|---|---|---|
| A.1 | Gestión institucional | I.1 – I.10 (10) | I.33 – I.35 (3) |
| A.2 | Formación Equipo educativo | I.11 – I.20 (10) | I.36 – I.38 (3) |
| A.3 | Formación Apoderados | I.21 – I.27 (7) | I.39, I.40, I.41, I.42, I.46, I.47 (6) |
| A.4 | Formación Estudiantes | I.28 – I.32 (5) | I.43, I.44, I.45, I.48, I.49, I.50, I.51 (7) |

Nota: I.43/I.44/I.45 (fomento lector declarado por familias) están en A.4 desde 2026-08-05 por indicación explícita de Sebastián y consistente con la homologación XLSX (columna "Estrategia: P3: Fomento lector").

Los overrides de nombre de ámbito viven en `src/lib/labels.js → AMBITO_NAME_OVERRIDES`, no en Firestore.

---

## Perfiles

Seis perfiles activos, definidos en `src/lib/context.jsx → PERFILES`:

| Perfil | Vista | Alcance |
|---|---|---|
| `escuela` | VistaEscuela | 1 establecimiento escolar |
| `jardin` | VistaEscuela | 1 jardín |
| `sostenedor` | VistaSostenedor | Red completa de un SLEP |
| `consultor` | VistaConsultor | Nacional, mes en curso |
| `cap` | VistaConsultor | Nacional, mes cerrado (banner distintivo) |
| `superadmin` | Layout + admin | Todo + `/usuarios` + `/dashboard-consultores` |

Además existe `pendiente` para usuarios nuevos sin perfil asignado.

El perfil se resuelve por `usuarios.perfilDefault`. Los correos en whitelist (`espohr@gmail.com`, `lagurto@focus.cl`, `speters@focus.cl`) se autopromueven a `superadmin` en el primer login.

---

## Paleta y tokens (NO cambiar sin coordinación)

Todos los colores vienen de custom properties CSS definidas en `src/index.css`. Nunca introducir hex crudos: `scripts/checkColorTokens.mjs` corre antes de `vite build` y falla si aparecen tokens no definidos.

Tokens principales:

```
--color-cyan       rgb(0, 138, 201)     — primario
--color-magenta    rgb(228, 21, 105)    — logros / acento
--color-yellow     rgb(255, 220, 0)
--color-red        rgb(229, 53, 23)
--color-purple-1   rgb(179, 67, 120)
--color-purple-2   rgb(142, 69, 112)
--color-teal       rgb(20, 130, 130)
--color-lime       rgb(101, 163, 13)    — semáforo verde
--color-gray-light rgb(160, 165, 169)
--color-gray-ui    rgb(160, 165, 169)
--color-gray-dark  rgb(51, 51, 51)
--color-bg         #F5F6F8
```

Existen alias legacy (`tag-navy`, `tag-sky`, `tag-lime`) que mapean a cyan.

---

## Estado del valor y agregación

`src/data/establecimientos.js → estadoValor(valor, indicador)` distingue tres estados:

- `'sin_meta'` — el indicador no tiene meta reportable (`tipoMeta === 'sin_meta'` o `metaNum` nulo).
- `'sin_dato'` — tiene meta pero no hay valor en Firestore.
- `'con_dato'` — hay valor.

Regla de agregación (`scope.js → cumplimientoIndicadores`): sobre indicadores **aplicables y con meta**, promedio de `min(1, logro)`. Un `sin_dato` aplicable cuenta como **0**. Un `sin_meta` no entra en el denominador.

`ZERO_FALLBACK` (en `ingestExtended.mjs`) es **distinto** de `sin_dato`: significa "sin actividad reportada" y se persiste como `valor: 0` con `raw: "sin actividad reportada"`. No colapsar los dos casos en la UI.

---

## Cómo correr

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # incluye check de tokens
```

## Cómo deployar

```bash
npm run deploy:rules # reglas + índices Firestore (si cambiaron)
npm run deploy       # build + firebase deploy --only hosting
```

## Cómo ingestar / mapear

```bash
npm run ingest:parvulario -- --dry-run
npm run ingest:escolar    -- --dry-run
npm run mapeo-parvulario                # regenera docs/mapeo-parvulario-YYYY-MM-DD.md
```

Todas las migraciones nuevas deben soportar `--dry-run`, ser idempotentes y escribir un reporte en `reports/`. Ver `scripts/migrateEscolarIndicadorIds.mjs` como plantilla.

---

## Convenciones

- **Idioma:** todo lo visible al usuario en español (es-CL). Código, comentarios, commits y docs internos en inglés.
- **Commits:** convencionales y atómicos (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`).
- **Tokens de color:** solo via CSS custom properties. Prohibido hex.
- **Data migrations:** siempre `--dry-run` primero, siempre idempotentes, siempre con reporte.
- **Cambios de UI:** verificar en `npm run dev` en los 6 perfiles y en **ambas cohortes** (2025-2026 y 2026-2027 en parvulario; 2025-2027 y 2026-2028 en escolar) porque el scope-gating difiere.

## Cosas que no tocar sin pensar

- `src/data/scope.js → isAplicable2026` y `cumplimientoIndicadores`: son las fórmulas defendidas frente al cliente.
- La distinción `estrategia` / `producto` (indicador de ámbito vs indicador de logro): viene del catálogo canónico.
- La numeración canónica (ver arriba): cualquier renumeración exige migrar Firestore.
- La jerarquía Cohorte / Año implementación / SLEP / Establecimiento / Sala.

---

## Historial breve

- **2026-08-05 (noche)** — Post-cierre fixes. (1) Superadmin "viendo como" perfiles limitados ya carga la grilla completa de establecimientos en el dropdown del header y VistaEscuela/VistaSostenedor resuelve el centro seleccionado (bug: `PERFILES` sembraba ids placeholder `ESC-001`/`JAR-001`/`SLEP-LP` que no existen en Firestore). Fix client-side sin tocar reglas. (2) W1(peer) — la feature "Promedio del territorio" en el drilldown del perfil Jardín/Escuela — implementada como estaba diseñada en el plan pero nunca cableada. Nueva colección `aggregatesTerritorio_real` con 393 docs (270 primary + 123 fallback), `K_MIN=4`, gate YoY composition-delta, hook `useTerritorioAggregate` y caption dinámico "Promedio del territorio" / "Promedio del programa". Deploy 6.
- **2026-08-05 (tarde)** — Cierre PAF Escolar para producción. Discovery en cache del harvest ubicó 13 indicadores previamente NO_MAPEADO. Cableados 9: I.10 (misma celda que I.9 en Actividades), I.13/I.14 (Datos docentes rows Director/Coordinador × cols CD1..CD4), I.29/I.31/I.42/I.43/I.44/I.45 (tab Encuesta apoderados). Ingesta produce 556 docs (vs 502) cubriendo 33/51 indicadores. Backfill `backfillEscolarNullDocs.mjs` agrega 38 slots con valor=null para completar la grilla en indicadores conectados. Firestore ahora tiene 594 docs Escolar = 18 escuelas × 33 indicadores. I.43/I.44/I.45 movidos de A.3 a A.4 (fomento lector). Fix VistaSostenedor: comuna count no cuenta null. Deploy 5: `https://visualizador-paf.web.app`. Pendiente: 18 indicadores sin fuente cableada (los 8 no encontrados por Explore + los 3 per-curso complejos + I.30 + los 6 de mediación). Reporte: `reports/reporteConexionEscolar-2026-08-05.md`.
- **2026-08-05** — Ciclo de cierre W1–W4. (1) Auth fix: perfiles jardin/escuela/sostenedor ahora tienen queries estrechas que pasan las reglas Firestore; campo `slep` denormalizado en `resultados_real`; `slepId` en `usuarios`. (2) Territorial: Ramón del Río reparado (slep/comuna/sostenedor); 15 jardines parvulario con comunas ALLCAPS/PAC corregidos. (3) W2: re-harvest de 68 planillas Los Parques (465/466 OK); 1 link roto permanente (Sendero del Saber KA). (4) W3: homologación Escolar 2025↔2026 (29 pares, `homologacionEscolar.json`); comparador alinea IDs 2025 a 2026 con banner explicativo. (5) W4: `getCoberturaEscolar` wired en `IndicatorPanel`; estados SIN_FUENTE_MAPEADA/FUENTE_NO_ACCESIBLE visibles en cada fila de indicador; chip "N sin fuente" en header de ámbito; `escolarCoverageManifest.json` dual-write para import en runtime. Deploy 2: `https://visualizador-paf.web.app`. Estado: docs/informe-cobertura-fuentes-2026-08-05.md.
- **2026-07-30** — Addendum Escolar. Se agregó infraestructura para el track Escolar completa: inventario de las 466 planillas individuales (`escolarPlanillaIndex.json`), harvest resumible con checkpoint y redacción PII en vuelo (`harvestEscolar.mjs`), mapping declarativo por arquetipo (`escolarMapping.mjs`) con assert de completitud, manifiesto de cobertura con 5 estados (`generateEscolarCoverageManifest.mjs`), import del consolidado 2025 de Sebastián como capa de contraste (`importConsolidated2025.mjs`), reporte de discrepancias de metas 2025 vs 2026, aserción PII ejecutable (`piiAssertion.mjs`), tratamiento UI de los 5 estados de cobertura en `IndicatorProgress`. Harvest completo ejecutado: 396/466 OK, 69 permanentemente inaccesibles (68 planillas 2025 de Los Parques sin acceso + 1 link roto). 37.773 valores PII redactados al vuelo, 0 hits en Firestore o cache. Ciclo cerrado con tag `cycle-2026-07-30-escolar-addendum`. Estado detallado en `docs/informe-cobertura-fuentes-2026-07-30.md`.
- **2026-07-29** — Ciclo de retroalimentación cliente: renumeración canónica de indicadores (Parvulario a 53, Escolar 2026 a 51), reasignación de ámbitos escolares, fix del comparador por año, jerarquía de títulos, ámbitos con nombres cortos, tratamiento explícito de "Sin datos", quita de "Focus" del pie de página. Reescritura de este archivo también. Plan en `/Users/espohr/.claude/plans/master-prompt-quirky-hanrahan.md` (fuera del repo, en el harness de plan-mode).
- Versiones anteriores del archivo describían el proyecto como "mock" con datos sintéticos generados por PRNG. Esa fase terminó cuando se conectó Firestore y se cargaron los datos reales de ambas cohortes.
