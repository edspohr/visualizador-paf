# Etapa 3 — Switch scaffolding + Ingesta Parvulario

**Fecha:** 2026-07-08
**Modo:** ejecución. Flag permanece `synthetic` para ambos tracks; la app no cambia de
comportamiento. Los cambios efectivos son (a) infraestructura del switch en `queries.js` y
(b) ingesta Parvulario a `resultados_real` + `establecimientos_real` en Firestore.

Deliverables:
- Código: [src/data/dataSource.js](../src/data/dataSource.js), [src/data/realQueries.js](../src/data/realQueries.js), [src/lib/queries.js](../src/lib/queries.js) (dispatcher).
- Script: [scripts/ingestParvulario.mjs](../scripts/ingestParvulario.mjs), atajo `npm run ingest:parvulario`.
- Reporte JSON: [docs/etapa3-ingesta-parvulario.json](etapa3-ingesta-parvulario.json).

---

## 1. Flag de datos por track — scaffolding

**`src/data/dataSource.js`** expone `DATA_SOURCE = { escolar: 'synthetic', parvulario: 'synthetic' }`
y helpers `sourceFor(track)` / `isReal(track)`. Es la fuente única de verdad del switch.
El valor se mantiene estático en Etapa 3; Etapa 4 lo va a reemplazar por una lectura al doc
`config/dataSource` (mismo shape).

**`src/lib/queries.js`** ahora es un dispatcher:
- Hooks cross-cutting (`useSleps`, `useSlep`, `useAmbitos`, `useMesCerrado`,
  `usePipelineMetadata`, `useIndicadores`) → siempre desde `syntheticQueries.js` mientras el
  catálogo local siga siendo la fuente de indicadores.
- Hooks track-específicos (`useEscuelas`, `useJardines`, `useEstablecimientos`,
  `useEstablecimiento`, `useEstablecimientosPorSlep`, `useProgresoTrimestral`,
  `useProgresoAnio`, `useValoresIndicador`, `useValoresAnio`) → routing por track según
  `sourceFor`. Con el flag actual (`synthetic` en ambos) el routing devuelve exactamente lo
  mismo que la Etapa 2.

**`src/data/realQueries.js`** implementa los mismos hooks contra Firestore (`establecimientos_real`,
`resultados_real`, `progresoTrimestral_real`). Los hooks del catálogo (`useIndicadores`,
`useAmbitos`, `useSleps`) devuelven arrays vacíos porque queries.js los sirve siempre desde
`synth` — están declarados para completar la interfaz.

`npm run build` compila limpio (2417 módulos, sin errores).

**Doc `config/dataSource` en Firestore:** creado por el script de ingesta con
`{escolar: 'synthetic', parvulario: 'synthetic'}` (write-once, `merge:true`). El flag se
podrá cambiar por consola cuando corresponda; nada en Etapa 3 lo flipa.

---

## 2. Ingesta Parvulario — arquitectura

### 2.1 Fuentes

**3 Planillas Centrales** (sólo sección `indicadores estrategia + productos`):

| Central                       | ID          | Tabs `jardín` leídos                              | Tabs `salas` leídos          |
|-------------------------------|-------------|----------------------------------------------------|------------------------------|
| 2025-2026 · **2025**          | `1KnApSD…`  | `INDICAD0RES CONSULTOR`, `IND PRODUCTOS`           | *(2025 no expone `SALAS` consolidado)* |
| 2025-2026 · **2026**          | `1oJQ8bU…`  | `CONSOLIDADO JARDÍN`                               | `CONSOLIDADO SALAS`          |
| 2026-2027 · **2026**          | `1Qr5Qvn…`  | **`CONS. NIVEL JARDÍN`** *(NO `CONSOLIDADO CENTRAL JARDÍN`, que la fill audit dio vacía)* | `CONS NIVEL SALAS`           |

**Bases datos SCJI** para el roster (matrícula + equipo educativo, sin PII):
- `1mTQJdF…` — Cohorte 2025-2026 (15 jardines Santa Rosa; header en fila 2).
- `1yUWIdw…` — Cohorte 2026-2027 (9 jardines Del Pino + Santa Corina; header en fila 1).

Base 2025-2026 no tiene columna `SOSTENEDOR` — se completa con `SLEP Santa Rosa` como
fallback determinístico por cohorte. Base 2026-2027 sí la trae. La matrícula total no se
lee del student-roster (fuera de scope) sino de las columnas agregadas `TOTAL MATRÍCULAS` /
`MAT TOTAL JARDÍN`.

### 2.2 Reglas del prompt aplicadas

- **NO se lee** la sección "progreso por ámbito / objetivo / porcentaje de progreso" (las
  columnas `Objetivos`, `Porcentaje de progreso`, `T1..T4`, `PERIODOS DE IMPLEMENTACIÓN` de
  las pestañas per-jardín tipo `AKUN`, `MODE`, `PJ`, `PA`). El script consume únicamente los
  tabs consolidados listados en §2.1.
- **Sin PII**: nunca se persisten RUTs, nombres de funcionario, apoderado ni estudiante. El
  script sólo lee cabeceras y agrega. Los tabs por curso `PKA..8B` no se leen en este pipeline.
- **Cohorte 2026-2027**: se usa `CONS. NIVEL JARDÍN` (26 cols) y NO `CONSOLIDADO CENTRAL JARDÍN`
  (0 filas — confirmado por la fill audit).
- **Celdas sin fuente**: 175 filas Jardín-fuente (7 workbooks inexistentes) y 50 filas
  Jardín-fuente (2 workbooks bloqueados por acceso) se **omiten silenciosamente**. La UI
  mostrará "sin dato" para esas combinaciones — no se inventa.
- **Idempotencia**: doc IDs deterministas `parv_{establecimientoId}_{indicadorId}_{periodo}`
  con `set(..., { merge: true })`. Re-correr el script no duplica ni degrada.

### 2.3 Estado por columna

- `estado: 'validado'` cuando la columna de la Central mapea 1-a-1 con un indicador del
  catálogo (todos los tabs jardín-level de §2.1).
- `estado: 'provisional'` cuando el valor viene de agregar sala-level a jardín-level (mean
  sobre salas del jardín), o cuando el nombre de columna no es idéntico al del catálogo. Se
  usa para los 5 indicadores derivados de `CONSOLIDADO SALAS` / `CONS NIVEL SALAS`
  (I.45, I.46, I.47, I.50, I.51).

### 2.4 Parsing de celdas

Valores string en las Centrales conviven en formatos mixtos. El parser normaliza:
- `SI`/`Sí`/`TRUE` → 1; `NO`/`FALSE` → 0; para `unidad: 'binario'`.
- `'73,33333333'` → 73.33 (coma decimal).
- `'100,00%'` → 1.0 (porcentaje a fracción).
- `'#DIV/0!'`, `'#VALUE!'`, `'#REF!'`, `SIN DATOS`, `No aplica`, vacío → omitido (no se
  escribe el doc). No se rellena con valor por default.

### 2.5 Períodos

Los tabs consolidados son snapshots anuales. Se emite `periodo = String(anio)` (formato
`YYYY`) en todos los docs, independientemente de la `frecuencia` del catálogo. Cuando se
ingesten tabs de granularidad mensual/semestral (futura etapa), el mismo pipeline agregará
`YYYY-MM` y `YYYY-Sn` como formatos alternativos.

### 2.6 Schema del doc `resultados_real/{id}`

```
{
  programa: 'parvulario',
  establecimientoId: 'jar-pequeno-aymara',
  establecimientoNombre: 'Pequeño Aymará',
  indicadorId: 'I.1',
  ambito: 'A1',
  cohorte: '2025-2026',
  anio: 2025,
  periodo: '2025',
  valor: 9,
  raw: '9',
  meta: '11',
  metaNum: 11,
  unidad: 'conteo',
  logro: 0.82,
  estado: 'validado',
  fuente: {
    workbookId: '1KnApSD…',
    workbookLabel: 'Central 2025-2026 · 2025',
    tab: 'INDICAD0RES CONSULTOR',
    col: 'N° de reuniones desarrolladas con directora…',
    row: 2,
  },
  updatedAt: serverTimestamp,
}
```

Doc ID: `parv_jar-pequeno-aymara_I.1_2025` (deterministic, idempotente).

---

## 3. Reporte de verificación

Corrida efectiva `2026-07-08` (writes reales a Firestore).

### 3.1 Totales

| Métrica                | Valor |
|------------------------|------:|
| Roster (establecimientos_real) | 24    |
| Resultados totales     | 513   |
| ‑ validado             | 393   |
| ‑ provisional          | 120   |
| Jardines cubiertos     | 24    |
| Indicadores cubiertos  | 24    |
| Cohorte 2025-2026      | 412   |
| Cohorte 2026-2027      | 101   |
| Año 2025               | 245   |
| Año 2026               | 268   |

### 3.2 Indicadores cubiertos (24 de 54 Parvulario)

`I.1, I.2, I.3, I.4, I.5, I.12, I.13, I.32, I.33, I.34, I.35, I.36, I.37, I.38, I.39, I.41,
I.42, I.43, I.44, I.45, I.46, I.47, I.50, I.51`.

- **10 desde `CONSOLIDADO JARDÍN` (2026) + `CONS. NIVEL JARDÍN` (2026)**: I.1, I.2, I.4, I.5, I.12,
  I.35, I.36, I.37, I.39, I.44.
- **13 desde `INDICAD0RES CONSULTOR` (2025)** + **5 desde `IND PRODUCTOS` (2025)**: I.1, I.2,
  I.3, I.12, I.13, I.32, I.33, I.34, I.35, I.36, I.37, I.38, I.39, I.40, I.41, I.42, I.43, I.44.
- **5 provisional desde SALAS** (aggregate mean por sala→jardín): I.45, I.46, I.47, I.50, I.51.

**Los 30 indicadores restantes** del catálogo Parvulario **no se ingestan en esta etapa**
porque su Fuente es `Jardín` (25 indicadores per-course) y viven en los workbooks
individuales, que hoy están: 17 accesibles + 7 sin crear + 2 sin compartir. La ingesta
per-jardín es Etapa 4+.

### 3.3 Distribución por jardín

Cada uno de los 24 jardines tiene entre **9 y 33** valores según cohorte/años que aplican:

- **15 Santa Rosa** (cohorte 2025-2026, cubren 2025 y 2026): ~29-33 valores c/u.
- **9 Del Pino + Santa Corina** (cohorte 2026-2027, sólo 2026): ~11 valores c/u.

### 3.4 Muestra

```
jar-pequeno-aymara       · I.1  · 2025 · valor=9  · logro=0.82 · validado · INDICAD0RES CONSULTOR
jar-enrique-backausse    · I.1  · 2025 · valor=2  · logro=0.18 · validado · INDICAD0RES CONSULTOR
jar-poetas-de-chile      · I.1  · 2025 · valor=5  · logro=0.45 · validado · INDICAD0RES CONSULTOR
jar-ciudad-de-barcelona  · I.1  · 2025 · valor=3  · logro=0.27 · validado · INDICAD0RES CONSULTOR
jar-ochagavia            · I.1  · 2025 · valor=0  · logro=0.00 · validado · INDICAD0RES CONSULTOR
```

### 3.5 Sanity checks

- **Roster sin gaps**: 0 jardines en Centrales sin match en Base SCJI (después de normalizar
  `Cedin (Centro Educacional…)` → `jar-cedin`).
- **Ninguna celda inventada**: los 175+50 rows Jardín-fuente sin fuente disponible NO se
  emitieron (skipped en el pipeline).
- **Errores de fórmula tolerados**: cualquier `#DIV/0!`, `#VALUE!`, `#REF!` se salta sin
  romper la corrida.
- **`config/dataSource`** creado con `{escolar: synthetic, parvulario: synthetic}` — flag
  intacto, la app sigue en sintético.

---

## 4. Cómo correr

```bash
npm run ingest:parvulario                # escribe a Firestore
npm run ingest:parvulario -- --dry-run   # sólo lectura + reporte
npm run ingest:parvulario -- --purge     # borra resultados_real Parvulario antes de reescribir
```

El script es idempotente: correr N veces produce el mismo estado en Firestore. Es seguro
correr en cualquier momento (no toca colecciones fuera de `establecimientos_real`,
`resultados_real`, `config/dataSource`).

---

## 5. Estado — STOP para revisión

- **Flag sigue en synthetic** en `src/data/dataSource.js` y en `config/dataSource`. La app
  se comporta idéntica al día antes de Etapa 3.
- **Firestore tiene 24 establecimientos + 513 resultados Parvulario** listos para ser
  consumidos cuando alguien flippee el flag Parvulario a `firestore`. Antes de flipar,
  próxima etapa debe:
  1. Ampliar la ingesta a los tabs per-jardín donde los workbooks estén accesibles (17 de 24
     jardines), para cubrir los 25 indicadores Jardín-fuente.
  2. Consensuar con Luis la creación de los 7 workbooks cohorte 2026-2027 y los 2 shares
     pendientes (La Hormiguita 2025, Caballito Feliz 2026).
  3. Renderizar los 393 valores validados en la UI Parvulario detrás de un feature flag por
     usuario para pruebas antes del flip global.
