# Task 2 — Etapa 2 · Mapeo `indicador → tab → columnas` + auditorías

**Fecha:** 2026-07-08
**Modo:** read-only / exploración. Cero escrituras a colecciones de datos. Cero flip de flags. El
único write que hubo fue el `config/_authcheck` que se borró en la misma corrida (§0).
**Identidad:** `firebase-adminsdk-fbsvc@visualizador-paf.iam.gserviceaccount.com` — verificada
contra `client_email` del JSON.

Este documento acompaña a la matriz de cobertura ([docs/task2-cobertura-matriz.csv](task2-cobertura-matriz.csv))
y al informe ejecutivo ([docs/task2-cobertura-fuentes.md](task2-cobertura-fuentes.md)). Su alcance:

1. Confirmar autenticación end-to-end (Sheets read + Firestore write).
2. Documentar cómo obtiene datos hoy el front-end (para el switch de etapas posteriores).
3. Mapeo detallado `indicador → workbook → tab → columnas o rango` para cada uno de los 106
   indicadores, aterrizado sobre lo que efectivamente se leyó.
4. Auditoría **"Sin especificar"** (26 indicadores Escolar 2026): `mapeable` (con propuesta de
   columna concreta) vs `genuinamente-ausente`.
5. Auditoría de llenado: por planilla × tab, marcado como `poblada`, `parcial` o `vacía`, con
   lista explícita de tabs vacías.
6. Reclasificación de la cobertura con el nuevo estado `ausente-mapeo` (columna existe pero
   fuente aún no declarada) vs `ausente-datos` (genuinamente sin fuente en la planilla).

---

## 0. Autenticación end-to-end (verificada)

Corrida el 2026-07-08 con `scripts/_authcheck.mjs` (temporal, borrado). Salida:

```
SA client_email OK: firebase-adminsdk-fbsvc@visualizador-paf.iam.gserviceaccount.com
project_id: visualizador-paf
Sheets read OK. Title: Planillas PAF Parvulario
Firestore write OK: config/_authcheck
Firestore read-back OK. exists: true
Firestore delete OK. Authcheck complete.
```

La misma SA puede (a) leer Sheets vía `google.sheets({...auth})` y (b) escribir Firestore vía
Admin SDK con `cert(sa)`. El único doc creado (`config/_authcheck`) se borró en la misma
corrida antes de terminar, dejando cero residuo en Firestore.

---

## 1. Cómo se sirven los datos hoy (para el switch de etapas posteriores)

- El front-end usa **datos sintéticos**, no Firestore.
- El punto de entrada es [src/lib/queries.js](../src/lib/queries.js) (24 líneas). Todo lo que
  exporta re-exporta desde [src/data/syntheticQueries.js](../src/data/syntheticQueries.js).
- `syntheticQueries.js` construye hooks sync (`useEstablecimientos`, `useIndicadores`,
  `useValoresIndicador`, `useProgresoTrimestral`, etc.) que leen de:
  - `src/data/establecimientos.js` — SLEPS, ESCUELAS, JARDINES con PRNG determinístico.
  - `src/data/indicadores.js` — AMBITOS + INDICADORES.
  - `src/data/catalog.json` — catálogo maestro comprometido.
- **Firestore hoy sólo se usa para `usuarios`** (auth y perfil), no para los indicadores.
  El bootstrap está en [src/lib/firebase.js](../src/lib/firebase.js) con `apiKey` pública.
- **Switch previsto:** cuando la ingesta llegue, se reemplaza el contenido de
  `src/lib/queries.js` (una sola línea de re-export) por la implementación Firestore-backed
  que existió antes del 2026-07-07. Un feature-flag opcional (`import.meta.env.VITE_DATA=synth|firestore`)
  puede convivir mientras se valida.

**Colecciones esperadas al reactivar Firestore** (según el pipeline previo y
[scripts/syncPlanillasCentrales.mjs](../scripts/syncPlanillasCentrales.mjs)):

- `establecimientos/{id}` — roster con `sostenedor`, `comuna`, `cohorte`, `nNinos`,
  `nAgentes`, `consultorEmail`.
- `indicadores/{id}` — catálogo por programa/versión.
- `valoresIndicador/{est}_{ind}_{anio}_{mes}` — hechos por indicador × establecimiento × período.
- `progresoTrimestral/{est}_{amb}_{anio}_{trim}` — agregado por ámbito × trimestre.
- `config/*` — meta (mes cerrado, últimoSync).

Nada de lo anterior se toca en esta etapa.

---

## 2. Fuentes efectivamente leídas

Todas las lecturas de esta etapa son *aggregate / count / column-header*; **no persistimos ni
loguemos ningún RUT o nombre de estudiante** (el PII de las pestañas por curso se descartó
en memoria).

### 2.1 Parvulario — 3 Planillas Centrales

| Workbook | ID | Tabs | Tabs clave leídos |
|---|---|---:|---|
| Central 2025-2026 · **2025** (Año 1) | `1KnApSD…` | 47 | `INDICAD0RES CONSULTOR`, `IND PRODUCTOS`, `CONSOLIDADO`, `INDICADORES EXTRAS JARDÍN`, `INDICADORES COORDINADOR`, `RESUMEN INDICADORES CUANTITATIVO`, `RESUMEN METAS`, per-jardín (`AKUN`, `MODE`, `LA HOR`, `ENRIQ`, `PRINCIP`, `CABALL`, `ANDRÉS B`, `PEQUEÑO AY`, `LLANO S`, `VILLA SAN`, `POETAS`, `CIUDAD B`, `SANTA FE`, `OCHAGAVÍA`, `LA MARINA`), 15 `RES XX` |
| Central 2025-2026 · **2026** (Año 2) | `1oJQ8bU…` | 35 | `CONSOLIDADO JARDÍN`, `CONSOLIDADO SALAS`, `COORDINADOR`, per-jardín (`AP`, `MOD`, `PR`, `EB`, `LH`, `SF`, `VSM`, `CF`, `AB`, `PA`, `CB`, `PCH`, `LLS`, `LM`, `OCH`), 15 `RES XX` |
| Central 2026-2027 · **2026** (Año 1) | `1Qr5Qvn…` | 27 | `CONS. NIVEL JARDÍN`, `CONS NIVEL SALAS`, `COORDINADOR`, `Consolidado Mon SCJI`, `Reporte Cualitativo Mensual`, `Act. Territoriales`, per-jardín (`PJ`, `ELU`, `ETR`, `TDA`, `CED`, `SDC`, `EAL`, `SSA`, `AF`), 9 `MONXXX`, `CONSOLIDADO CENTRAL JARDÍN` (**VACÍA — ver §5**) |

Se OMITIÓ, tal como pide el prompt, la sección **"progreso por ámbito / objetivo / porcentaje
de progreso"** (visible en las pestañas per-jardín tipo `AKUN`, `MODE`, `PJ`… en las columnas
`Objetivos`, `Porcentaje de progreso`, `T1..T4`). Esa vista es el resumen ejecutivo que Focus
mantiene manualmente y no es la fuente atómica del indicador. Se usa exclusivamente la sección
**indicadores de estrategia + productos** (columnas por indicador nombrado en
`INDICAD0RES CONSULTOR` / `IND PRODUCTOS` / `CONSOLIDADO JARDÍN` / `CONSOLIDADO SALAS` /
`CONS. NIVEL JARDÍN` / `CONS NIVEL SALAS`).

### 2.2 Escolar — 2 escuelas representativas

| Escuela | Cohorte | Workbooks leídos |
|---|---|---|
| Gil de Castro (SLEP Los Parques) | 2025-2027 (año 2 en 2026) | `0. Datos Consultor` (26 tabs) + `0. Registro Coordinación` (22 tabs) + 20 sub-workbooks per-course (headers) |
| Esperanza Joven (SLEP Santa Rosa) | 2026-2028 (año 1 en 2026) | ídem |

Ambas exponen la misma estructura y las mismas tabs. Confirma que **los 18 workbooks Escolar
comparten layout** (aunque las columnas por curso pueden variar en orden y case, ver §5).

**Verificación de framework 2026 en cohorte 2025-2027**: `Gil de Castro · Datos Consultor ·
Actividades` contiene `Módulos formativos`, `Encuentro territorial I / II`, `Reunión
director/a`, `Plan de acción diseñado e incorporado en PME y PEI`, `Se conforma Equipo de
Gestión`. No aparece `Equipo Familia Escuela` (vocabulario 2025). Cohorte 2025-2027 en año 2
**usa el mismo framework que 2026-2028 en año 1**: confirmado.

---

## 3. Mapeo `indicador → tab → columnas`

### 3.1 Parvulario (54 indicadores) — mapeo por Fuente

**Fuente = `Consultor` (29 indicadores).** Se resuelven todos por:
- Central de la cohorte/año → tab principal según el bloque (nivel jardín vs nivel salas):
  - **Nivel jardín/coordinador** (indicadores I.1–I.13, I.22, I.29–I.34, I.35–I.41, I.44, I.48):
    - Año 2025 en Central 2025-2026·2025 → `INDICAD0RES CONSULTOR` (fila por jardín, col por
      indicador con nombre casi textual del catálogo — 24 cols)
    - Año 2026 en Central 2025-2026·2026 → `CONSOLIDADO JARDÍN` (fila por jardín, 26 cols
      incluyendo `N° visitas TOTALES jardín infantil`, `N° reuniones con directoras`,
      `Tiempo promedio de reuniones con directoras`, `N° reuniones con coordinadora(s)`,
      `N° reuniones territoriales con directoras desarrolladas`, `% de directoras que
      participan en reuniones territoriales`, etc.)
    - Año 2026 en Central 2026-2027·2026 → `CONS. NIVEL JARDÍN` (fila por jardín, 26 cols
      idénticas)
  - **Nivel salas** (para indicadores I.30–I.32, I.41, I.48 y afines):
    - `CONSOLIDADO SALAS` / `CONS NIVEL SALAS` — 1 fila por (jardín × sala), 24 cols con
      métricas mensuales `Reunión apoderados marzo`…`diciembre`, `Promedio anual`,
      `Cobertura entrevistas`, `Cobertura Voluntariado`, `Cobertura Rol Educativo SEM 1/2`
- **Productos Consultor** (subset): en `IND PRODUCTOS` (11 cols por jardín — año 2025) y en
  `CONSOLIDADO JARDÍN` (mismas columnas, año 2026).

**Fuente = `Jardín` (25 indicadores).** Se resuelven por:
- Workbook individual del jardín → tabs por sala (`RA`, `EA`, `Bib. Viaj.`, `Tall. Apod.`,
  `Vol`, `Rol Ed.`, `Exp.Ed.`, `Ev. Ped.`, `Narr. Baúl MFC`, `MFC-BV imp`, `Biblioteca`,
  `ASIST`, `RES`, `Ingreso talleres`) según nomenclatura del año (2025 usa códigos cortos
  `RA/RP/EA/VOL/MFC-BV/MFC-RF/EF-TALL/EF-ENC`; 2026 usa nombres largos
  `R.Apod / Tall. Apod. / Rol Ed. / Exp.Ed. / Ev. Ped. / Bib. Viaj. / Narr. Baúl MFC / Vol`).
- El paso final `Consolidado CEDEP` de cada workbook agrega esas hojas a nivel jardín. El
  pipeline puede leer los tabs atómicos (más robusto) o el consolidado (más rápido pero
  depende de fórmulas del cliente).

Para los **7 jardines cohorte 2026-2027 sin workbook individual** (§5), el Consultor sigue
disponible en `CONS. NIVEL JARDÍN` de la Central. El Jardín-fuente (25 indicadores × 7 =
175 filas) queda `ausente-datos` hasta que se creen los workbooks.

### 3.2 Escolar 2026 (52 indicadores) — mapeo por Fuente

Todos los tabs viven en cada `Escuela X_0. Datos Consultor` o `Escuela X_0. Registro
Coordinación`; los sub-workbooks por curso `Escuela X_YY` (20 por escuela) alimentan a los
tabs por curso.

- **Fuente = `Registro establecimiento` (13 indicadores):**
  - I1 `Se conforma Equipo de Gestión` → `Datos Consultor > Actividades` fila **B25**
    (`Se conforma Equipo de Gestión` TRUE/FALSE).
  - I2 `Número de reuniones anuales del Equipo de Gestión` → `Datos Consultor > Reuniones
    equipo de Gestión`; contar sesiones (columnas 1-13) con al menos 1 asistente TRUE.
  - I12 `% de profesores jefe que asisten a módulos formativos` → `Datos Consultor > Datos
    docentes`; columnas `Consejos de Profesores CD1..CD4`; filtrar Cargo IN
    (`Docente`, `Prof. jefe`).
  - I21 `Número de talleres para apoderados presenciales realizados en promedio por sala`
    → `Registro Coordinación > PKA..8B`; columnas `Asistencia de Apoderado/a Taller Entre
    Familias TF1..TF4`; contar salas con TF>0.
  - I23 `Número de Talleres digitales para Apoderados enviados en promedio por sala` →
    `Registro Coordinación > PKA..8B` (columna a confirmar — no visible en el header
    principal; puede estar en un rango extendido).
  - I24 `Cantidad de visualizaciones promedio de los Talleres digitales para Apoderados`
    → columna a confirmar; posiblemente en `Consolidado`.
  - I25 `Número de formaciones realizadas a apoderados monitores` → `Datos Consultor >
    Actividades` fila **B10**–**F11** (`Instancia de formación para apoderados monitores`
    × 5 columnas `Forrmación inicial / Encuentro por escuela I..III / Encuentro de cierre`).
  - I26 `Número de apoderados monitores formados` → `Registro Coordinación > PKA..8B`;
    columna `Monitores formado (asisten a al menos una formación)`.
  - I32 `Número de talleres para estudiantes realizados por sala (1ro a 8vo)` → sub-workbook
    por curso `Escuela X_1º A..8º B` tab `Actividades`.
  - I44 `Promedio de Lecturas Viajeras que declaran utilizar las familias…` → `Datos
    Consultor > Encuesta apoderados` fila 4.
  - I45 `% de apoderados que contestan la encuesta y declaran utilizar el mantel de palabras`
    → `Datos Consultor > Encuesta apoderados` fila 5.
  - I47 `Número de apoderados monitores que implementaron Taller de Apoderados` → `Registro
    Coordinación > PKA..8B` columna `Monitores activos`.
  - I48 `Nota promedio que ponen los asistentes a las formaciones de monitores` → `Datos
    Consultor > Actividades` fila **B12** (`Nota promedio de la evaluación de formación a
    apoderados monitores`).
  - I50 `Cantidad promedio de actividades de aula de Lecturas Viajeras desarrolladas en sala`
    → sub-workbook por curso.
  - I51 `% de salas que realizan actividad de mediación del Mantel de Palabras` →
    sub-workbook por curso.
  - I52 `Cantidad promedio de actividades de mediación del mantel post envío desarrolladas`
    → sub-workbook por curso.

- **Fuente = `Consultor` (5 indicadores):**
  - I6 `Director asiste a formación de liderazgo territorial` → `Datos Consultor >
    Actividades` fila **B16** (`Director asiste` × col `Encuentro territorial I` +
    `Encuentro territorial II`).
  - I12 (también) `% de profesores jefe que asisten a módulos formativos` — ver arriba.
  - I21 `Número de talleres para apoderados presenciales realizados` — ver arriba.
  - I33 `Director cumple la meta propuesta para su liderazgo` → `Datos Consultor >
    Actividades` fila **B21** (`Director cumple meta de liderazgo planificada`).
  - I36 `Nota promedio que ponen los asistentes a los módulos formativos` → `Datos
    Consultor > Actividades` fila **B7** (`Nota promedio de la evaluación de consejo de
    profesores`).

- **Fuente = `Encuesta apoderados` (6 indicadores):** tab dedicada
  `Datos Consultor > Encuesta [Aa]poderados` (case normalizado):
  - Fila 2 → I22 (indirectamente) / I42 `% de apoderados que contestan la encuesta y
    declaran haber descargado y visualizado los Talleres digitales`.
  - Fila 3 → I29 / I43 `Promedio de libros de Biblioteca Viajera`.
  - Fila 4 → I30 / I44 `Promedio de Lecturas Viajeras`.
  - Fila 5 → I31 / I45 `% mantel de palabras`.
  - Fila 6 → I46 `Cantidad promedio de instrumentos de fomento lector` (era
    `Sin especificar`; se reclasifica a `ausente-mapeo` — ver §4).
  El 6º indicador Encuesta apoderados del catálogo (I42) puede o no calzar 1-a-1 con la fila
  6; a confirmar con Sebastián qué indicador ocupa qué fila exacta.

- **Fuente = `Evaluación final actividad` (1 indicador):** I26 `Número de apoderados
  monitores formados`. Fila en `Datos Consultor > Actividades` (`Instancia de formación
  para apoderados monitores` TRUE/FALSE por encuentro) + `Registro Coordinación > PKA..8B`
  columna `Monitores formado`.

- **Fuente = `PME y PEI` (1 indicador):** I35 `Plan de acción diseñado e incorporado en PME
  y PEI` — **columna encontrada** en `Datos Consultor > Actividades` fila **B22**
  (`Plan de acción diseñado e incorporado en PME y PEI ` TRUE/FALSE). Se reclasifica a
  `ausente-mapeo` (era `ausente-datos`).

### 3.3 Escolar 2025 (50 indicadores)

- 5 escuelas cohorte 2025-2027; no hay workbooks 2025 en la carpeta compartida (`1YNltv9…`
  contiene sólo 2026).
- Los valores derivados están en `Resultados indicadores 2025` (`1yxgC1v…`, tabs
  `Indicadores`, `Pivoteo Base`, `Base Vertical`, `Indicadores clasificación`,
  `Nombre escuelas`).
- Se mantiene el estado **`parcial`** para las 250 filas: el pivote entrega el valor
  derivado por escuela × indicador, pero no la fuente cruda para re-derivar. Decisión
  operativa: si se acepta el pivote como fuente, se sube a `presente` con nota. Si no,
  quedan como referencia informativa.

---

## 4. Auditoría "Sin especificar" (26 indicadores Escolar 2026)

Regla: `mapeable` = columna concreta identificada en las planillas actuales, con propuesta de
tab + celda/rango que Sebastián sólo debe **confirmar** (no definir desde cero).
`genuinamente-ausente` = ninguna columna existe en ninguna de las 26 pestañas de `0. Datos
Consultor`, ni en las 22 de `0. Registro Coordinación`, ni en los 20 sub-workbooks por curso.

| # | Indicador | Nombre corto | Estado | Mapeo propuesto (tab · celda o rango) |
|---|---|---|---|---|
| 1 | I3 | % asistencia directores a reuniones equipo gestión | mapeable | `Datos Consultor > Reuniones equipo de Gestión` — filtrar filas Cargo='Directora'; promediar TRUE en cols sesiones 1-13 |
| 2 | I4 | % asistencia coordinadores a reuniones equipo gestión | mapeable | ídem, Cargo='Coordinador' |
| 3 | I5 | N° reuniones de coordinación | mapeable | `Datos Consultor > Reuniones equipo de Gestión` — count sesiones (cols 1-13) con ≥1 asistente TRUE. **Confirmar semántica** con Sebastián (¿es lo mismo que reunión de gestión o distinto?) |
| 4 | I7 | Coordinador asiste a formación de liderazgo territorial | mapeable | `Datos Consultor > Actividades` — fila `Coordinador asiste` × cols `Encuentro territorial I` + `Encuentro territorial II` |
| 5 | I8 | Director asiste a formación de liderazgo, por escuela | mapeable | `Datos Consultor > Actividades` — fila `Director asiste` × col `Reunión director/a` |
| 6 | I9 | Existe plan de acción familia escuela diseñado | mapeable | `Datos Consultor > Actividades` fila **B20** (`Existe plan de acción familia escuela diseñado `) TRUE/FALSE |
| 7 | I10 | Existe plan de acción familia escuela actualizado | **genuinamente-ausente** | no hay col separada "actualizado" distinta de "diseñado" (I9). Meta=—. Decisión: (a) eliminar I10 del catálogo o (b) agregar columna en `Actividades` |
| 8 | I11 | N° módulos formativos anuales | mapeable | `Datos Consultor > Actividades` fila `Módulos formativos` × 5 cols `Módulo I..V`; count TRUE |
| 9 | I13 | Director asiste a módulos formativos | **genuinamente-ausente** | `Datos docentes` tiene `Consejos de Profesores CD1..CD4` pero NO marca cargo Director/Coordinador. Requiere columna nueva o filtro derivado |
| 10 | I14 | Coordinador asiste a módulos formativos | **genuinamente-ausente** | mismo caso que I13 |
| 11 | I15 | N° formaciones territoriales para docentes | mapeable | `Datos Consultor > Actividades` fila `Instancias de formación territorial para docentes` × 2 cols `1`, `2`; count TRUE |
| 12 | I16 | % profesores jefe que asisten a formaciones territoriales | mapeable | `Datos Consultor > Datos docentes` cols `Instancias de formación 1`, `2`; filtrar Cargo IN ('Docente','Prof. jefe') |
| 13 | I17 | Director asiste a formaciones territoriales | mapeable | `Datos Consultor > Actividades` fila `Director asiste` × cols `Encuentro territorial I` + `II` |
| 14 | I18 | Coordinador asiste a formaciones territoriales | mapeable | `Datos Consultor > Actividades` fila `Coordinador asiste` × cols `Encuentro territorial I` + `II` — **es el mismo dato que I7. Consolidar con Sebastián.** |
| 15 | I19 | % familias entrevistadas al menos una vez | mapeable | `Registro Coordinación > PKA..8B` cols `Entrevistas de apoderados: 1er Semestre / 2do Semestre / anual`; % de RUTs con anual ≥ 1 |
| 16 | I20 | % familias entrevistadas al menos dos veces | mapeable | mismas cols; % con anual ≥ 2 |
| 17 | I27 | N° salas cubiertas por apoderados monitores | mapeable | `Registro Coordinación > PKA..8B` col `Monitores activos`; count salas con ≥1 monitor activo |
| 18 | I28 | Cantidad de semanas de envío de Biblioteca Viajera por sala | mapeable | `Registro Coordinación > PKA..8B` col `Número de Bibliotecas Viajeras enviadas` |
| 19 | I34 | % cumplimiento plan de acción familia escuela | mapeable | `Datos Consultor > Actividades` fila **B24** (`Porcentaje de cumplimiento del plan de acción familia escuela`) |
| 20 | I37 | Nota promedio evaluación formaciones territoriales | mapeable | `Datos Consultor > Actividades` fila **B3** (`Nota promedio de la evaluación de la instancia de formación docente`) |
| 21 | I38 | Sistema planificación entrevistas apoderados | mapeable | `Datos Consultor > Actividades` fila **B23** TRUE/FALSE |
| 22 | I39 | % Talleres liderados por dupla monitor-profesor | **genuinamente-ausente** | no hay col que registre "dupla monitor + profesor jefe" por taller; requiere col nueva |
| 23 | I40 | % apoderados en al menos 1 taller | mapeable | `Registro Coordinación > PKA..8B` cols `Asistencia Taller TF1..TF4`; % con ≥1 TRUE |
| 24 | I41 | % apoderados en 100% talleres | mapeable | mismas cols TF1..TF4; % con 4 TRUE |
| 25 | I46 | Cantidad promedio instrumentos fomento lector (encuesta) | mapeable | `Datos Consultor > Encuesta apoderados` fila 6 |
| 26 | I49 | Cantidad promedio actividades de mediación BV por sala | **genuinamente-ausente** | no hay tab dedicada a "actividades de mediación de Biblioteca Viajera"; sólo hay `N° BV enviadas`. Requiere columna nueva |

**Resumen:** 21 mapeables + 5 genuinamente-ausentes = 26. Adicional: **I35 `PME y PEI`**
también resulta mapeable (fila B22 de `Actividades`), aunque no era `Sin especificar`. Total
reclasificado a `ausente-mapeo`: **22 indicadores** × 18 escuelas × 1 año = **396 filas**.

Genuinamente-ausentes (5 indicadores × 18 escuelas = **90 filas**) requieren decisión de
producto:

| Indicador | Acción posible |
|---|---|
| I10 (plan actualizado) | eliminar (redundante con I9) o crear columna |
| I13 (director asiste módulos) | agregar filtro por cargo en `Datos docentes` o columna dedicada |
| I14 (coordinador asiste módulos) | ídem |
| I39 (% talleres dupla monitor-profesor) | crear columna en `Registro Coordinación > PKA..8B` |
| I49 (mediación BV promedio) | crear tab/columnas o reusar el sub-workbook por curso |

---

## 5. Auditoría de llenado

Regla: para cada tab accesible se cuenta densidad `filled / cells` sobre el rango leído (típicamente
A1:Z400). Umbrales:

- `poblada` = densidad ≥ 30 % (tabs de encabezado corto se consideran pobladas si tienen ≥1 fila de
  datos poblada).
- `parcial` = 5–30 % con al menos algunas filas de datos no-header.
- `vacía` = 0 % o sólo header, sin datos.

### 5.1 Tabs con estado `vacía` (por nombre)

| Workbook | ID | Tab | Motivo |
|---|---|---|---|
| Planilla Central Parvulario 2026-2027 · 2026 | `1Qr5Qvn…` | `CONSOLIDADO CENTRAL JARDÍN` | 0 filas leídas. Es una tab consolidadora que aún no se activa; se llena por fórmula desde `CONS. NIVEL JARDÍN`. **No bloquea la ingesta** porque el pipeline debe leer `CONS. NIVEL JARDÍN`, no esta tab. Marcarlo con Luis para saber si se elimina o se activa. |
| Escuela Gil de Castro · Datos Consultor · `Encuesta apoderados` | (per escuela) | (tab) | 6 filas de header + 0 valores en las cols de dato. La estructura está lista pero **los consultores aún no la llenaron** (mediados de julio, encuesta prevista para 2do semestre). Aplica igual a las 18 escuelas — no es bug, es estado esperado del año en curso. |

Ningún otro tab accesible resultó vacío. Los tabs consolidadores con `#VALUE!` o `#DIV/0!`
en algunas celdas (p. ej. `Registro Coordinación > Consolidado Establecimiento` fila 3,
`Central 2026 > CONSOLIDADO JARDÍN` col `Tiempo promedio de reuniones CAUE`) son
**parciales de cálculo**, no vacías estructuralmente.

### 5.2 Tabs `parcial` relevantes

- **Cálculos con `#DIV/0!` o `#VALUE!`**: cuando el consolidado necesita todas las filas
  poblados para calcular un promedio y aún faltan datos. Se observa en la Central 2025-2026
  · 2026 (todos los tabs `RES *` con densidad 0.63-0.69) y en algunas cols de
  `CONSOLIDADO JARDÍN`. El reader debe tolerar valores string tipo `SIN DATOS`, `#REF!`,
  `#DIV/0!`, `#VALUE!`, `100.00%` (punto en vez de coma).

### 5.3 Errores transitorios de quota

Durante la corrida, la cuota `sheets.googleapis.com Read requests per minute` bloqueó
temporalmente ~15 lecturas (`Registro Coordinación PKA..2B` de Gil de Castro, `LLS/LM` de
Central 2025-2026·2026, `Consolidado` de Datos Consultor de Gil de Castro). **Los tabs son
accesibles y están poblados**: en un re-probe con 26 tabs reintentados todos devolvieron
OK. En un pipeline productivo hay que agregar back-off exponencial (típicamente 60s de
reset).

---

## 6. Reclasificación de la cobertura

Estados usados en la matriz actualizada:

- **`presente`**: fuente cruda accesible + columna identificada → pipeline puede leer hoy.
- **`parcial`**: valor accesible en el pivote 2025 pero no la fuente cruda (aplica a los 250 rows
  Escolar 2025 cohorte 2025-2027).
- **`ausente-mapeo`** *(nuevo)*: fuente cruda accesible + **columna encontrada en las
  planillas actuales**, pero el catálogo dice `Fuente: Sin especificar` o similar. Está a la
  espera de que Sebastián confirme el mapeo propuesto. **No requiere trabajo de datos, sólo
  una decisión.**
- **`ausente-datos`**: ni la fuente cruda ni columna correspondiente existen en las
  planillas actuales; hay que crearla al origen.
- **`ausente-acceso`**: la fuente existe pero no está compartida con la SA; un share la
  destraba.

### 6.1 Distribución nueva

| Estado           | Antes (Etapa 1 v2) | Ahora (Etapa 2) | Δ |
|------------------|-------------------:|----------------:|--:|
| presente         | 2 331              | 2 331           | 0 |
| parcial          | 200                | 200             | 0 |
| **ausente-mapeo**| —                  | **396**         | +396 (**del 21.6 % previo de ausente-datos**) |
| ausente-datos    | 711                | 315             | −396 |
| ausente-acceso   | 50                 | 50              | 0 |
| **Total**        | 3 292              | 3 292           | 0 |

### 6.2 Distribución por programa

| Programa   | presente | parcial | ausente-mapeo | ausente-datos | ausente-acceso |
|------------|---------:|--------:|--------------:|--------------:|---------------:|
| Escolar    | 450      | 200     | 396           | 140           | 0              |
| Parvulario | 1 881    | 0       | 0             | 175           | 50             |

Interpretación:

- **Escolar 2026** tenía 486 rows `ausente-datos` — se reduce a **90** (5 indicadores × 18
  escuelas: I10, I13, I14, I39, I49). El resto (396) pasa a `ausente-mapeo` y sólo requiere
  confirmación de Sebastián para volverse `presente`.
- **Escolar 2025** mantiene sus 50 rows `ausente-datos` (Sin especificar + PME/PEI + Registro
  focus en el catálogo 2025 — no se auditaron celda-por-celda porque los workbooks 2025 no
  están en la carpeta compartida).
- **Parvulario** no cambia: sus 175 `ausente-datos` son los 7 workbooks Del Pino + Santa
  Corina 2026-2027 sin crear, y los 50 `ausente-acceso` los 2 workbooks individuales
  bloqueados (La Hormiguita 2025 · Caballito Feliz 2026).

---

## 7. Distribución del trabajo restante

### 7.1 Para **Sebastián** (Consultora Focus, track Escolar) — 396 rows por confirmar

Revisar §4 y confirmar la propuesta columna-por-columna para los **22 indicadores mapeables**
(21 Sin especificar + I35 PME y PEI). Una vez confirmado, el pipeline puede alimentarlos y
suben a `presente`.

### 7.2 Para **Sebastián + Focus** — 90 rows genuinamente-ausentes (Escolar)

Los 5 indicadores I10, I13, I14, I39, I49 requieren decisión producto:
- eliminarlos del catálogo si son redundantes (candidato claro: **I10**, plan actualizado vs
  diseñado); o
- crear la columna al origen en la planilla base (`0. Datos Consultor` o `0. Registro
  Coordinación`) y propagar a los 18 workbooks.

### 7.3 Para **Luis** (Consultora Focus, track Parvulario) — 175 rows

Crear los 7 workbooks Parvulario cohorte 2026-2027 (Paula Jaraquemada, Cedin, Eluney, Sueño De
Colores, Tierra De Angeles, Salomón Sack, El Tranque) desde el template Angel Fantuzzi /
Estación Alegría. El Consultor-fuente ya se cubre desde la Central; sólo falta el
Jardín-fuente per-course.

### 7.4 Genuinamente externo (no planillas)

Ninguno queda pendiente después de la auditoría. **I35 `PME y PEI`** — que en Etapa 1 se
había marcado como "documento institucional externo" — resultó **estar mapeado en las
planillas** (`Datos Consultor > Actividades` fila B22). Sale del rubro externo.

### 7.5 Sólo shares (Luis) — 50 rows

- Workbook `1mVS7jX…` (La Hormiguita 2025) — 25 rows Jardín-fuente.
- Workbook `1Fkogl7…` (Caballito Feliz 2026) — 25 rows Jardín-fuente.

Con eso Parvulario llega al 100 % (salvo los 175 rows de datos por los 7 workbooks a crear).

---

## 8. Estado — STOP para revisión

Esta etapa fue **exclusivamente exploración**. Los cambios efectivos son:

1. **Reclasificación de la matriz de cobertura** (`docs/task2-cobertura-matriz.{csv,json}`)
   con el nuevo estado `ausente-mapeo` y la nueva columna `mapeoPropuesto` que registra
   la propuesta de columna por cada mapeable.
2. **Actualización del informe ejecutivo** (`docs/task2-cobertura-fuentes.md`) con la
   distribución nueva.
3. **Este documento nuevo** (`docs/task2-mapeo-indicadores.md`) con el mapeo detallado y las
   dos auditorías.

**Sin colecciones de datos escritas. Sin ingesta. Sin flip de flags. Sin cambios en el
front-end.** El único write fue el `config/_authcheck` que se borró en la misma corrida.

Cuando Sebastián confirme el bloque §4 (idealmente en una reunión de 30 min pasando fila por
fila), la próxima etapa puede:
- eliminar los estados `ausente-mapeo` reclasificándolos a `presente` con `sourceColumns`
  ya establecido, y
- proceder a la ingesta real hacia `valoresIndicador` en Firestore.
