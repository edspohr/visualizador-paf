# Etapa 4 + 5 — Flip a real y cierre

**Fecha:** 2026-07-08
**Modo:** ejecución. Flags **`escolar: real`** + **`parvulario: real`** en producción
(`https://visualizador-paf.web.app`). Ingesta de las **18 escuelas** completada.

Deliverables:
- Código: [src/data/dataSource.js](../src/data/dataSource.js) ahora lee `config/dataSource` desde Firestore y recarga la app al cambiar el flag.
- Script: [scripts/ingestEscolar.mjs](../scripts/ingestEscolar.mjs), atajo `npm run ingest:escolar`.
- Script: [scripts/setDataSourceFlag.mjs](../scripts/setDataSourceFlag.mjs), atajo `npm run set-flag`.
- Rules: [firestore.rules](../firestore.rules) expuestas para `/config`, `/establecimientos_real`, `/resultados_real`, `/progresoTrimestral_real`.
- Reporte JSON Escolar: [docs/etapa5-ingesta-escolar.json](etapa5-ingesta-escolar.json).

---

## 1. Etapa 4 — flip Parvulario a real

### 1.1 Cambios estructurales

- **`dataSource.js`** ahora se suscribe a `config/dataSource` vía `onSnapshot`. El
  módulo expone `loadDataSource()` → promesa que resuelve al primer snapshot. `main.jsx`
  bloquea el render hasta entonces. Cualquier cambio posterior del doc dispara
  `window.location.reload()` — **rollback instantáneo desde consola**, sin redeploy.
- **`main.jsx`** ahora `await loadDataSource().then(render)`.
- **`firestore.rules`** con nuevas reglas:
  - `/config/{docId}` — read público, write superadmin. (El cliente lo consulta ANTES del
    login para decidir qué fuente usar; no revela información sensible.)
  - `/establecimientos_real/{estId}` — mismo modelo de visibilidad que `/establecimientos`.
  - `/resultados_real/{docId}` — mismo modelo que `/valoresIndicador`.
  - `/progresoTrimestral_real/{docId}` — idem.
  - Todas las writes cerradas — sólo el pipeline (Admin SDK) escribe.

### 1.2 Rollback de una línea

```bash
npm run set-flag parvulario synthetic     # rollback → sintético (todos los usuarios recargan)
npm run set-flag parvulario real          # forward   → real
```

El comando actualiza `config/dataSource.parvulario` en Firestore. Los clientes abiertos
detectan el cambio via `onSnapshot` y recargan la página automáticamente; los clientes
nuevos ya arrancan en el modo actualizado.

### 1.3 Ensayo de rollback (2026-07-08)

```
Antes: {"escolar":"synthetic","parvulario":"synthetic"}   ← estado Etapa 3
Ahora: {"escolar":"synthetic","parvulario":"real"}        ← flip a real
Antes: {"escolar":"synthetic","parvulario":"real"}
Ahora: {"escolar":"synthetic","parvulario":"synthetic"}   ← rollback drill: OK
Antes: {"escolar":"synthetic","parvulario":"synthetic"}
Ahora: {"escolar":"synthetic","parvulario":"real"}        ← re-flip: OK
```

**Duración observada**: cada write al doc + reload del cliente sucede en <1 s. En la práctica
un cliente que tenga la app abierta ve el cambio en 1-2 segundos (tiempo de Firestore push +
recarga).

### 1.4 Deploy

- `firebase deploy --only firestore:rules` — OK.
- `npm run deploy` (hosting) — OK. El bundle `index-BM0qOvpr.js` está en producción con la
  nueva lógica de `dataSource.js`.

---

## 2. Etapa 5 — ingesta Escolar

### 2.1 Descubrimiento

El script itera las carpetas Drive del índice Escolar:
- `1lqf3guMNkX5Dy_A8MaDpXIfTi0fZnKQ4` — `Planillas de monitoreo año 1, 2026` (13 escuelas cohorte 2026-2028)
- `14M3Bo96abZQ5rcOgJwPqDoNpIR7kizIw` — `Planillas de monitoreo año 2, 2026` (5 escuelas cohorte 2025-2027)

Para cada escuela, ubica el sub-workbook `Escuela X_0. Datos Consultor` y
`Escuela X_0. Registro Coordinación`. **18/18 escuelas con ambos workbooks accesibles**.

### 2.2 Tabs consumidos

| Tab                                       | Fuente workbook           | Indicadores obtenidos           |
|-------------------------------------------|---------------------------|---------------------------------|
| `Actividades`                             | 0. Datos Consultor        | I1, I6, I7, I8, I9, I11, I15, I17, I18, I25, I33, I34, I35, I36, I37, I38, I48 |
| `Reuniones equipo de Gestión`             | 0. Datos Consultor        | I2, I3, I4, I5                  |
| `Datos docentes`                          | 0. Datos Consultor        | I12, I16                        |
| `PKA..8B` (agregado sobre 20 sub-workbooks)| 0. Registro Coordinación  | I19, I20, I26, I27, I28, I40, I41, I47 |
| `Encuesta [Aa]poderados`                  | 0. Datos Consultor        | *(sin dato — mid-year)*         |

**No se leen** los sub-workbooks per-course de `Datos Consultor`, ni los sub-workbooks base
(carpeta `Planillas base`), ni los tabs `Consolidado` (que dependen de fórmulas y en Gil de
Castro tienen `#VALUE!`).

### 2.3 Reglas del prompt implementadas

- **Header matching por patrón (regex normalizado), NUNCA por posición**. Ejemplo: la fila
  de `Módulos formativos` se encuentra scanneando col 0 con `/^modulos formativos$/`; la
  columna `Reunión director/a` se encuentra scanneando el sub-header con
  `/reunion director\/?a/`. Si el patrón falla, **NO se calcula un valor mal — se emite log
  ruidoso y se omite el emit**.
- **5 genuinamente-ausentes NO se intentan**: I10, I13, I14, I39, I49 no están en el mapping.
- **PII descartada**: los tabs `Reuniones equipo de Gestión` y `PKA..8B` contienen RUT/nombres
  de personas. El pipeline sólo usa cargo (agregado) y booleanos (agregados). Ninguna fila
  con nombre o RUT se persiste; se agregan en memoria y se descartan los identificadores
  antes del emit.
- **Retirados excluidos**: en `PKA..8B` se filtra por columna `Activo` (sólo se cuentan
  estudiantes con `SI/Sí/1`).
- **Encuesta apoderados → sin dato**: las tabs existen estructuradas pero sin valores; el
  pipeline las ignora silenciosamente (no error).

### 2.4 Ejecución

```
1) Descubriendo escuelas…
   18 escuelas encontradas
2) Descubriendo workbooks Datos Consultor + Registro Coordinación…
   18/18 escuelas con ambos workbooks
3) Leyendo tabs por escuela…
   [18 escuelas × (Actividades + Reuniones + Datos docentes + RC per-course)]
7) Reporte de verificación
   Total resultados: 499
   Por estado: {"validado":167,"provisional":332}
   Escuelas cubiertas: 18
   Indicadores cubiertos: 30
   Reads a Sheets: 72
   Header mismatches: 40
```

### 2.5 Flip Escolar → real

```
Antes: {"escolar":"synthetic","parvulario":"real"}
Ahora: {"escolar":"real","parvulario":"real"}
```

Estado final `config/dataSource` en producción:
`{"escolar":"real","parvulario":"real"}`.

Los clientes con la app abierta detectan el cambio en <1 s vía `onSnapshot` y recargan.
No requirió re-deploy: el bundle deployado en §1.4 ya conoce el modo real.

---

## 3. Cobertura real por track y estado

Combinando lo ingestado en Etapa 3 (Parvulario) y Etapa 5 (Escolar):

| Track       | Establecimientos | Docs `resultados_real` | validado | provisional | Indicadores cubiertos |
|-------------|-----------------:|-----------------------:|---------:|------------:|----------------------:|
| Parvulario  | 24               | 513                    | 393      | 120         | 24 / 54               |
| Escolar     | 18               | 499                    | 167      | 332         | 30 / 52               |
| **Total**   | **42**           | **1 012**              | **560**  | **452**     | **54 / 106**          |

Los 452 provisionales suben a `validado` cambiando **sólo el campo `estado`** en Firestore
(no requiere re-ingesta) cuando Luis / Sebastián confirmen la semántica.

---

## 4. Lista de provisionales — Escolar (para que Sebastián confirme)

Los 22 mapeos propuestos en Etapa 2 más los agregados de reuniones/talleres/entrevistas ya
están ingestados como `estado: 'provisional'`. Sebastián sólo debe confirmar la semántica
por fila.

### 4.1 Mapeados en `Datos Consultor > Actividades`

| Indicador | Fila (label) | Columnas usadas | Agregación                    |
|-----------|--------------|------------------|-------------------------------|
| I7  | `Coordinador asiste` | `Encuentro territorial I`, `Encuentro territorial II` | count(TRUE) |
| I8  | `Director asiste`    | `Reunión director/a` (col única) | first(TRUE→1) |
| I9  | `Existe plan de acción familia escuela diseñado` | (col 1) | first(TRUE→1) |
| I11 | `Módulos formativos` | `Módulo I`..`Módulo V` (5 cols) | count(TRUE) |
| I15 | `Instancias de formación territorial para docentes` | `1`, `2` (2 cols) | count(TRUE) |
| I17 | `Director asiste`    | `Encuentro territorial I`, `Encuentro territorial II` | count(TRUE) *(mismo dato que I6 — I17 posiblemente redundante)* |
| I18 | `Coordinador asiste` | `Encuentro territorial I`, `Encuentro territorial II` | count(TRUE) *(mismo dato que I7 — I18 posiblemente redundante)* |
| I34 | `Porcentaje de cumplimiento del plan de acción familia escuela` | (col 1) | first(num) *(actualmente vacío en las 18)* |
| I35 | `Plan de acción diseñado e incorporado en PME y PEI` | (col 1) | first(TRUE→1) |
| I37 | `Nota promedio de la evaluación de la instancia de formación docente` | (col 1) | first(num) *(actualmente vacío en 15/18 escuelas)* |
| I38 | `Existe en el establecimiento un sistema de planificación…` | (col 1) | first(TRUE→1) |

### 4.2 Mapeados en `Datos Consultor > Reuniones equipo de Gestión`

| Indicador | Semántica interpretada | Nota |
|-----------|------------------------|------|
| I3  | mean(TRUE) sobre filas cargo=Director/a, cols sesiones 1..N | provisional |
| I4  | mean(TRUE) sobre filas cargo=Coordinador, cols sesiones 1..N | provisional; 2 escuelas sin cargo=Coordinador (Básica Sendero del Saber, Ramón Freire) |
| I5  | count de sesiones con ≥1 asistente TRUE (mismo cálculo que I2) | **confirmar semántica** — ¿es distinta de I2? |

### 4.3 Mapeados en `Datos Consultor > Datos docentes`

| Indicador | Semántica | Nota |
|-----------|-----------|------|
| I16 | mean sobre filas Cargo `Docente`/`Prof. jefe`, cols "1", "2" (instancias de formación) | provisional; fallback a "docentes" cuando no hay explícito "Prof. jefe" |

### 4.4 Agregados desde `Registro Coordinación > PKA..8B`

| Indicador | Semántica |
|-----------|-----------|
| I19 | % estudiantes activos con `Entrevistas anual ≥ 1` (agregado sobre 20 salas) |
| I20 | % estudiantes activos con `Entrevistas anual ≥ 2` |
| I27 | # salas con al menos 1 apoderado monitor activo |
| I28 | promedio # Bibliotecas Viajeras enviadas por sala |
| I40 | % apoderados con al menos 1 taller TF asistido |
| I41 | % apoderados con las 4 TF asistidas |

---

## 5. Log de header mismatches por escuela

Total: **40 mismatches** = 36 "celda vacía" (esperado mid-year) + 4 "estructura falta".

### 5.1 "Celda vacía" — no es error de mapeo, dato aún no digitalizado

| Indicador | # escuelas | Motivo |
|-----------|-----------:|--------|
| I34 (Porcentaje cumplimiento plan de acción) | 18 | fila existe, valor vacío — plan aún no evaluado |
| I37 (Nota promedio formación docente) | 15 | fila existe, valor vacío — formaciones territoriales aún no realizadas (0 TRUE en I15) |
| I48 (Nota promedio formación monitores) | 3 | fila existe, valor vacío — sólo las escuelas España, Inglaterra, Platón sin formaciones aún |

Ninguna requiere acción del pipeline — se llenarán solas cuando los consultores marquen el dato.

### 5.2 "Estructura falta" — a revisar con Sebastián o Focus

| Escuela | Indicador | Detalle |
|---------|-----------|---------|
| Escuela Básica Sendero del Saber | I4 | Sin fila cargo=`Coordinador` en `Reuniones equipo de Gestión`. ¿Sin Coordinador PIE registrado? |
| Escuela Básica Sendero del Saber | I19 | `PKA..8B` sin estudiantes con `Activo=SI`. Revisar carga inicial de estudiantes |
| Escuela Ramón Freire | I4 | Sin fila cargo=`Coordinador` |
| Escuela Esperanza Joven | I19 | `PKA..8B` sin estudiantes activos |

Estos son casos concretos donde el header/valor está fuera del patrón esperado. El script
no forzó cálculo — emitió "sin dato" + log noisily.

### 5.3 Encuesta apoderados — sin dato consistente

Las 18 escuelas tienen la tab `Encuesta [Aa]poderados` con las 5 filas de labels pero sin
valores. El pipeline lo trata como esperado: **no se emite ningún indicador**.
Reclasifica cuando los consultores empiecen a llenar la encuesta (previsto 2do semestre).
Afecta a I22, I29, I30, I31, I42, I43, I44, I45, I46 en las 18 escuelas.

---

## 6. Cómo correr

```bash
# Ingesta
npm run ingest:parvulario                          # Etapa 3 (idempotente)
npm run ingest:escolar                             # Etapa 5 (idempotente)
npm run ingest:escolar -- --schools=Gil,España     # subset por nombre
npm run ingest:escolar -- --purge                  # borra Escolar antes de reescribir

# Flag
npm run set-flag parvulario real                   # flip
npm run set-flag escolar real
npm run set-flag parvulario synthetic              # rollback instantáneo
```

Estado actual en producción: `{escolar: 'real', parvulario: 'real'}`.

---

## 7. STOP para revisión

- **Ambos tracks en real** en producción, respaldados por 1 012 docs en `resultados_real` y
  42 docs en `establecimientos_real`.
- **Rollback verificado**: cambiar el flag en Firestore recarga los clientes automáticamente
  en <2 s.
- **PII intacta**: 0 RUTs, 0 nombres de estudiante ni funcionario persistidos.
- **No se inventó ningún valor** ante un mismatch — 40 casos fueron logueados y omitidos.
- **560 valores `validado`** están 1-a-1 con la fuente Focus; los **452 `provisional`**
  esperan la reunión de confirmación con Sebastián para promoverse (cambio de un solo
  campo `estado` en Firestore, sin re-ingesta).

Próximo paso natural: reunión de 30-45 min con Sebastián para revisar las tablas §4.1–§4.4
y decidir I17/I18/I5 (¿redundantes con I6/I7/I2 o son otra cosa?).
