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
  - `features.js` — feature flags (por ej. `FEATURES.heatmap`, controlado por `VITE_FEATURE_HEATMAP`).

### Scripts

- **`scripts/parseCatalogs.mjs`** — reconstruye `catalog.json` desde los XLSX en `src/data/catalogs/`. Debe aplicar el mapa canónico al final (ver más abajo). No es idempotente en escritura: rompe cualquier edición manual del JSON.
- **`scripts/lib/parvularioIds.mjs`** — traducción entre numeración de planilla y numeración de catálogo (`extractPlanillaId`, `planillaToCatalog`). Tolera tipos como `"I.,20"`.
- **`scripts/ingestParvulario.mjs`** — ingesta desde Planillas Centrales (3 cohortes/años) → `establecimientos_real` + `resultados_real`. Escribe agregado por jardín y variantes por sala (`nivel`, `nivelEspecifico`, `nivelGeneral`).
- **`scripts/ingestEscolar.mjs`** — ingesta escolar desde 18 planillas de Google Drive. Marca `estado: 'validado' | 'provisional'`.
- **`scripts/ingestRosterEscolar.mjs`** — actualiza `nNinos`, `nAgentes`, `rbd` en `establecimientos_real`.
- **`scripts/ingestExtended.mjs`** — cierra huecos con `ZERO_FALLBACK` (emite `valor: 0` con `raw: "sin actividad reportada"` para columnas vacías en indicadores aplicables). **No confundir "reported zero" con "sin datos".**
- **`scripts/mapeoParvulario.mjs`** — reporte de cobertura → `docs/mapeo-parvulario-YYYY-MM-DD.md`.
- **`scripts/migrateEscolarIndicadorIds.mjs`** — ejemplo canónico de migración Firestore (dry-run, idempotente, con manejo de colisiones). Usarlo como plantilla para nuevas migraciones.
- **`scripts/checkColorTokens.mjs`** — guardián de tokens de color; corre antes de `vite build`.
- **`scripts/auditFill.mjs`** — auditoría de llenado.

### Firestore

Colecciones:

- **`establecimientos_real/{doc_id}`** — Doc IDs `jar-{slug}` (parvulario) o `esc-{slug}` (escolar).
- **`resultados_real/{doc_id}`** — dos formatos:
  - Agregado por establecimiento: `parv_${estId}_${indId}_${anio}` / `esc_${estId}_${indId}_${anio}`.
  - Por sala (parvulario): `parv_${estId}_${indId}_${anio}_${nivelSlug}` con campos `nivel`, `nivelEspecifico`, `nivelGeneral`.
  - Todos los IDs pasan por `sanitizeDocId(/[^a-zA-Z0-9_.-]/g → _)`.
- **`progresoTrimestral_real/{doc_id}`**.
- **`usuarios/{uid}`** — `email`, `nombre`, `perfilDefault` (`escuela | jardin | sostenedor | consultor | cap | superadmin | pendiente`), `establecimientoId`, `proveedor`.
- **`config/dataSource`**, **`config/mesCerrado`**, **`config/pipelineMetadata`**.

Índices: ver `firestore.indexes.json`. Cualquier nueva query compuesta requiere agregar el índice y deployar con `npm run deploy:rules` **antes** del hosting.

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
| A.3 | Formación Apoderados | I.21 – I.27 (7) | I.39 – I.47 (9) |
| A.4 | Formación Estudiantes | I.28 – I.32 (5) | I.48 – I.51 (4) |

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

- **2026-07-29** — Reescritura de este archivo. Ciclo de retroalimentación cliente: renumeración canónica de indicadores (Parvulario a 53, Escolar 2026 a 51), reasignación de ámbitos escolares, fix del comparador por año, jerarquía de títulos, ámbitos con nombres cortos, tratamiento explícito de "Sin datos", quita de "Focus" del pie de página. Plan en `docs/plan-implementacion-2026-07-29.md`.
- Versiones anteriores del archivo describían el proyecto como "mock" con datos sintéticos generados por PRNG. Esa fase terminó cuando se conectó Firestore y se cargaron los datos reales de ambas cohortes.
