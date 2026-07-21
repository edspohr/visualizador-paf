# Informe de cambios · Visualizador PAF
**Ventana:** viernes 17-jul-2026 → hoy 21-jul-2026
**Baseline:** commit `6b9819a` (último de la sesión previa)
**Head:** commit `ab1801d`
**Repo:** https://github.com/edspohr/visualizador-paf

---

## 1. De dónde salió cada insight

| # | Fuente | Contenido | Ubicación |
|---|---|---|---|
| **F1** | Reunión Granola "Revisión Visualizador de datos PAF" · 17-jul-2026 10:00 GMT-4 · Luis Agurto (Focus) + Edmundo Spohr | Feedback sobre 5 frentes: matrícula congelada, comparador rediseñado, ranking, jerarquía visual, mapa de calor superadmin | Meeting ID `2d01fb68-a32d-4d12-93c7-7770b9084f7a` |
| **F2** | PDF adjunto por Edmundo: `Ajuste Visualizador de datos PAF.pdf` | Captura de pantallas anotadas + puntos por revisar (comparador sin mes, filtro por nivel, apertura por establecimiento, mapa de calor) | Adjunto sesión chat 20-jul-2026 |
| **F3** | Documento MD `referencias-fuentes-paf-parvulario.md` | Enlaces + Drive IDs de las 3 planillas centrales + 2 bases de identificación Parvulario, revisadas por Focus | Adjunto sesión chat 20-jul-2026 |
| **F4** | XLSX `Sistema indicadores PAF Parvulario.xlsx` (versión revisada por Focus) | 54 indicadores canónicos (34 estrategia + 20 producto) con metas actualizadas | `src/data/catalogs/Sistema indicadores PAF Parvulario.xlsx` |
| **F5** | Exploración directa de Google Sheets vía API | Descubrimiento del schema real de las pestañas `VISUALIZADOR JARDÍN` y `VISUALIZADOR SALAS`, y del desfase de numeración entre planillas y catálogo | Scripts efímeros durante la sesión de trabajo |
| **F6** | Firestore (`resultados_real`, `establecimientos_real`) — sondeo del estado backend actual | Confirmar que el pipeline apuntaba a las tabs viejas (`CONSOLIDADO JARDÍN`) y no distinguía nivel | Estado del código de `ingestParvulario.mjs` heredado |

---

## 2. Commits publicados

| Commit | Autor | Alcance |
|---|---|---|
| `de763a6` | de763a6 | UI transversal (bloques 3, 4, 5, 7) + matrícula CAP + heatmap + comparador rediseñado (bloque 2) |
| `8bc2bdd` | 8bc2bdd | Script `mapeoParvulario.mjs` + fix numeración I.6/I.29 + campo `desagregaNivel:true` en 26 indicadores del catálogo (⚠ corregido el 21-jul; ver §9) |
| `ab1801d` | ab1801d | Repunta `ingestParvulario.mjs` a `VISUALIZADOR JARDÍN`/`VISUALIZADOR SALAS` + persistencia por sala/nivel + hook `useValoresAnioNivel` + integración al comparador |

Total: **18 archivos** tocados (12 modificados + 6 creados), **+1718 / −493 LOC**.

---

## 3. Cambios por bloque

### Bloque 1 — Matrícula congelada CAP · fuente F1

**Motivación:** Fundación CAP quiere ver matrícula estable durante el año, no oscilando mes a mes. Corte mayo (jun–ago), corte agosto (sep–dic). Solo aplica a perfil CAP; el resto ve dato vivo.

**Archivos:**
- Creado: [src/data/matricula.js](../src/data/matricula.js) — helper `matriculaVisible(est, perfilId, mesEfectivo, anio) → {valor, fechaCorte, esSnapshot}`
- Creado: [scripts/snapshotMatricula.mjs](../scripts/snapshotMatricula.mjs) — pipeline idempotente
- Modificado: [src/views/VistaConsultor.jsx](../src/views/VistaConsultor.jsx) — `TotalCard` "Niñas y niños" con sub-label dinámico
- Modificado: [src/views/VistaSostenedor.jsx](../src/views/VistaSostenedor.jsx) — misma lógica en la red del sostenedor
- Modificado: [package.json](../package.json) — nuevo `npm run snapshot-matricula`

**Cómo verificar:**
1. Login CAP hoy → `TotalCard` "Niñas y niños" muestra `matrícula vigente` (aún sin snapshot escrito).
2. Correr `npm run snapshot-matricula -- --corte=mayo --anio=2026` desde terminal → nuevo campo `nNinosSnapshotMayo` en cada `establecimientos_real/{id}`.
3. Recargar CAP → sub-label pasa a `matrícula al {fecha}`.
4. Cambiar a perfil consultor → sub-label siempre dice `matrícula estimada` (dato vivo).
5. Correr el snapshot dos veces → segunda vez reporta `Saltados: N` (idempotencia).

---

### Bloque 2 — Comparador por indicador rediseñado · fuentes F1 + F2

**Motivación (Luis):** "Junio 2025 vs septiembre 2026 es una comparación absurda; los indicadores anuales/semestrales no tienen sentido a mes fino. Eliminar mes, comparar año contra año".

**Cambios:**
- Filtro **Mes eliminado** de ambos lados del comparador.
- Cada lado ahora tiene: `Año · Sostenedor · Cohorte · Comuna · Nivel · Ámbito`.
- Nuevo filtro **Nivel** (6 opciones fijas: sala cuna menor/mayor, medio menor/mayor, transición 1/2).
- Nuevo selector **Desglose**: `Agrupado` / `Por establecimiento` / `Por nivel (disabled)`.
- Bar chart muestra **nombre completo del indicador** (código + nombre truncado a 60 chars, YAxis ancho 220).
- **Unidad respetada**: `%`/`binario` → eje 0-100%; `conteo`/`promedio` → eje absoluto (`formatValue` de expectedValue.js). Modo "Todos los indicadores" con unidades mezcladas → ratio 0-100 normalizado con banner "Comparación normalizada".
- Snapshot al **mes efectivo** del perfil (consultor mes actual; CAP mes cerrado) — el usuario no lo elige.

**Archivo:** [src/views/VistaConsultor.jsx](../src/views/VistaConsultor.jsx#L376) — `ComparadorIndicador`, `SideSelector`, `computeSideData` (~250 líneas reescritas).

**Cómo verificar:**
1. Login consultor → expandir "Comparación por indicador".
2. Confirmar que no hay dropdown de mes en ningún lado.
3. Elegir indicador focal `%` (ej: I.3 % educadoras) → eje X en 0-100%.
4. Elegir indicador focal `conteo` (ej: I.1 N° reuniones directora, meta 11) → eje X con valores absolutos.
5. Volver a "Todos los indicadores" → aparece banner "Comparación normalizada" y eje vuelve a %.
6. Elegir sostenedor específico + indicador focal → habilita "Por establecimiento" en Desglose. Cambiar a "Por establecimiento" → barras por centro.
7. Elegir Nivel "Sala cuna menor" → los 27 indicadores marcados `desagregaNivel:true` se comparan al nivel; los otros 27 (incluidos los faltantes I.22/I.23) quedan como "—". Nota: I.54 tiene el flag pero hoy no trae datos por sala en ninguna planilla — es esperable.

---

### Bloque 3 — Ranking con color de logro · fuente F1

**Motivación (Luis):** "Distinguir con color diferente el valor que alcanza la meta en el ranking".

**Archivo:** [src/components/IndicatorRanking.jsx](../src/components/IndicatorRanking.jsx#L55)

**Regla:** `valor >= metaNum` → valor en `text-lime` + dot lime; si no → valor en `text-cyan` (default) o `text-gray-ui` (provisional).

**Cómo verificar:**
1. Login consultor → mirar tarjeta "Vista ejecutiva" (top-3 + bottom-3).
2. Cada ítem con `valor ≥ meta` debe verse en verde lime; el resto en cyan.
3. Provisionales (si los hay) siguen en gris con tooltip.

---

### Bloque 4 — Jerarquía visual (estrategia + logro juntos por ámbito) · fuente F1

**Motivación (Luis, nueva teoría del cambio):** "Nivel 1: gran titular. Nivel 2: 'Indicadores por ámbito'. Nivel 3: nombre del ámbito. Nivel 4: indicadores del ámbito + indicadores de logro asociados. Renombrar 'producto' → 'logro'".

**Antes:** El panel mostraba primero todos los ámbitos con sus estrategias, y al final una sección global "Indicadores de producto" con todos los productos agrupados por ámbito (dos veces la iteración de ámbitos).

**Después:** Cada ámbito colapsable contiene primero sus estrategias y, si tiene productos, un divisor `<hr>` con ícono Package magenta + texto "Indicadores de logro asociados" seguido de los productos del mismo ámbito. Una sola iteración por ámbito.

**Archivo:** [src/components/IndicatorPanel.jsx](../src/components/IndicatorPanel.jsx) (reescrito).

**El % del header del ámbito ahora agrega estrategia + logro** (antes solo estrategia).

**Cómo verificar:**
1. Login escuela o jardín → sección "Indicadores del programa".
2. Confirmar subtítulo "Indicadores por ámbito" arriba de las tarjetas.
3. Expandir el primer ámbito → ver estrategias y, si hay productos, la sub-sección "Indicadores de logro asociados" con divisor.
4. Confirmar que **no existe** ninguna sección global "Indicadores de producto" al final.
5. `grep -rn "Indicadores de producto" src/ | grep -v "^Binary"` → 0 líneas en UI.

---

### Bloque 5 — Mapa de calor superadmin · fuentes F1 + F2

**Motivación (Luis):** "Prueba de mapa de calor para superadmin; si no convence, se descarta".

**Archivos:**
- Creado: [src/lib/features.js](../src/lib/features.js) — feature flag `VITE_FEATURE_HEATMAP`
- Creado: [src/components/HeatmapEstablecimientosIndicadores.jsx](../src/components/HeatmapEstablecimientosIndicadores.jsx) — grid CSS establecimientos × indicadores, escala semáforo ternaria, filtro por ámbito, click celda → drilldown existente
- Modificado: [src/views/VistaConsultor.jsx](../src/views/VistaConsultor.jsx) — sección colapsable visible solo con `superadmin` + `FEATURES.heatmap`

**Cómo verificar:**
1. Sin flag → login superadmin → NO aparece la sección heatmap.
2. Crear `.env.local` con `VITE_FEATURE_HEATMAP=true`, reiniciar `npm run dev`.
3. Login superadmin → aparece sección colapsable "Mapa de calor · Establecimientos × Indicadores" con badge "experimento".
4. Cambiar a perfil consultor con el mismo flag → NO se ve (control de perfil).
5. Hover celda → tooltip `{est}\n{ind}\n{valor / meta}`.
6. Click celda → abre `IndicatorDrilldown` con el indicador y establecimiento correctos.

---

### Bloque 6 — Mapeo Parvulario contra planillas centrales · fuentes F3 + F5

**Motivación:** validar que el catálogo local está alineado con lo que Focus reporta en las planillas centrales. Producir reporte para Luis con mapeados/faltantes/huérfanos.

**Archivo:** [scripts/mapeoParvulario.mjs](../scripts/mapeoParvulario.mjs) — script Node ESM que lee las 3 planillas centrales + 2 bases de identificación via Google Sheets API, compara contra `catalog.json`, produce reporte markdown.

**Salida:** [docs/mapeo-parvulario-2026-07-21.md](mapeo-parvulario-2026-07-21.md) — reporta en **coordenadas de catálogo** (post-corrección 21-jul; ver §9). Resultado: **52/54 mapeados**, faltantes `I.22, I.23`, **1 huérfano** (planilla `I.1` "N° de visitas al jardín").

**Descubrimiento clave (F5):** los headers de las pestañas VISUALIZADOR tienen **numeración distinta** al catálogo. Ejemplos:
- Planilla `I.1 = "N° de visitas al jardín"` → no existe en catálogo.
- Planilla `I.2 = "N° reuniones directora"` → equivale a catálogo `I.1`.
- Toda la banda `I.2..I.22` en planilla → `I.1..I.21` en catálogo (offset −1).
- Banda `I.23..I.43` en planilla → `I.24..I.44` en catálogo (offset +1, saltando I.22 y I.23 del catálogo).
- Banda `I.45..I.54` idéntica.

La traducción vive en `scripts/lib/parvularioIds.mjs` y es compartida entre `mapeoParvulario.mjs` e `ingestParvulario.mjs`.

**Cómo verificar:**
1. Correr `npm run mapeo-parvulario -- --dry-run` → imprime en consola.
2. Correr `npm run mapeo-parvulario` → escribe `docs/mapeo-parvulario-YYYY-MM-DD.md`.
3. Abrir el reporte → tabla resumen + secciones por planilla + faltantes + huérfanos + desglose por sala.

---

### Bloque 7 — Consistencia cyan (valor vs meta) · fuentes F1 + iteración en sesión

**Motivación (Luis):** "En los indicadores del programa, diferenciar color entre valor y meta".

**Regla aplicada:** valor propio de un establecimiento (o agregado del conjunto propio) → **cyan**; peer/territorio → **gris oscuro**; meta → **gris muted (`text-gray-ui`)**.

**Archivos:**
- [src/components/Shared.jsx](../src/components/Shared.jsx) — `IndicatorProgress` (valor propio cyan), `KpiCard`, `formatValue` meta muted
- [src/components/IndicatorRanking.jsx](../src/components/IndicatorRanking.jsx) — valor cyan/lime, meta muted
- [src/components/IndicatorPanel.jsx](../src/components/IndicatorPanel.jsx) — % del header del ámbito en cyan
- [src/components/IndicatorDrilldown.jsx](../src/components/IndicatorDrilldown.jsx) — columnas de valor en tablas comparativas
- [src/views/VistaConsultor.jsx](../src/views/VistaConsultor.jsx) — `TotalCard` y % cumplimiento por establecimiento
- [src/views/VistaSostenedor.jsx](../src/views/VistaSostenedor.jsx) — mismo tratamiento

**Excepciones:** banners con fondo oscuro mantienen texto blanco. Peer values quedan en gris oscuro para diferenciarse. Estado provisional siempre en gris (no aplica cyan/lime, aviso visual prevalece).

**Cómo verificar:** login cualquier perfil → todos los valores propios visibles en cyan, todas las metas en gris muted.

---

### Bloque 8 — Ingesta Parvulario reapuntada a VISUALIZADOR · fuentes F3 + F5 + F6

**Motivación:** el pipeline actual leía `CONSOLIDADO JARDÍN`/`CONSOLIDADO SALAS`; Luis creó `VISUALIZADOR JARDÍN`/`VISUALIZADOR SALAS` **específicamente para el visualizador**. Todo lo que la UI mostraba venía del camino viejo.

**Archivo:** [scripts/ingestParvulario.mjs](../scripts/ingestParvulario.mjs) — reescrito completo.

**Cambios estructurales:**
- Detecta las tabs por nombre (`VISUALIZADOR JARDÍN`, `VISUALIZADOR SALAS`) con fallbacks tolerantes.
- Traduce numeración de planilla → catálogo con función `planillaToCatalog(planillaId)`.
- Extrae `Nivel General` + `Nivel Específico` de las tabs SALAS y los normaliza a 6 buckets (`sala_cuna_menor`, `sala_cuna_mayor`, `nivel_medio_menor`, `nivel_medio_mayor`, `transicion_1`, `transicion_2`).
- Escribe **dos formas del mismo dato** en `resultados_real`:
  1. **Agregado por jardín** (sin campo `nivel`): docId `parv_{est}_{ind}_{anio}`. Consumido por la UI actual (que no distingue nivel).
  2. **Por sala/nivel específico** (con `nivel`, `nivelEspecifico`, `nivelGeneral`): docId `parv_{est}_{ind}_{anio}_{nivelSlug}`. Consumido por el filtro Nivel del comparador.
- Cuando el mismo indicador aparece en JARDÍN y agregado desde SALAS, el de JARDÍN gana (dato reportado por la escuela vs promedio calculado).
- Reporta indicadores del catálogo sin datos + warnings de IDs sin equivalente.

**Ingesta ejecutada** (con `--purge` para eliminar los 1140 docs con numeración vieja):
- 24 establecimientos escritos en `establecimientos_real`
- **5119 docs** en `resultados_real` (1694 agregados por jardín + 3425 por sala)
- **48 de 54 indicadores** del catálogo con datos
- **5 de 6 niveles** detectados (falta `transicion_2` — no aparece en las planillas actuales)

**Indicadores sin datos (6):**
- `I.22` (comités comunales) y `I.23` (fiesta familia) — no están en las planillas VISUALIZADOR
- `I.36`, `I.37`, `I.38` (plan de acción / malla formativa) — columnas presentes pero puras celdas "SIN DATOS"
- `I.54` (ciclo talleres Entre Familias) — sin datos

**Cómo verificar:**
1. Terminal: `node scripts/ingestParvulario.mjs --dry-run` — reproduce el reporte sin escribir.
2. Firestore console → colección `resultados_real` → filtrar `programa == parvulario` → ver docs con y sin campo `nivel`.
3. En la UI (una vez desplegado): login jardín/sostenedor → ver valores que reflejan las nuevas planillas.
4. Reporte JSON en [reports/ingestParvulario-2026-07-21.json](../reports/ingestParvulario-2026-07-21.json).

---

### Bloque 9 — Filtro Nivel del comparador conectado al backend · fuentes F1 + Bloque 8

**Motivación:** cerrar el loop del filtro Nivel del Bloque 2, que estaba en modo passthrough.

**Cambios:**
- Nuevo hook [useValoresAnioNivel(anio, nivel)](../src/data/realQueries.js) — Firestore query con `where('nivel', '==', nivel)`; retorna `[]` si nivel es `TODOS` o `null`.
- `useValoresAnio` ahora **filtra** los docs con `nivel` para evitar doble conteo cuando se agrega por jardín.
- `ComparadorIndicador` dispara dos queries (A y B) para el nivel activo; construye `nivelMap` promediando salas del mismo nivel específico por jardín.
- `computeSideData` recibe `valoresNivel` y usa esa fuente cuando `filters.nivel !== 'TODOS'` **y** el indicador tiene `desagregaNivel: true`. Los que no desagregan siguen en "—".

**Archivos:**
- [src/data/realQueries.js](../src/data/realQueries.js) — `useValoresAnio` con filtro, `useValoresAnioNivel` nuevo
- [src/lib/queries.js](../src/lib/queries.js) — re-export del hook nuevo
- [src/views/VistaConsultor.jsx](../src/views/VistaConsultor.jsx) — integración en `ComparadorIndicador` + refactor `computeSideData`

**Cómo verificar:**
1. Login consultor con programa parvulario cargado.
2. Comparador por indicador → Grupo A: elegir Nivel "Sala cuna menor".
3. Los 27 indicadores marcados con `desagregaNivel:true` deben mostrar valores diferentes al modo "Todos los niveles" (reflejan solo salas cuna menor). I.54 puede quedar en "—" porque las planillas aún no cargan datos por sala para ese indicador.
4. Los 27 indicadores restantes (jardín-level + faltantes) siguen mostrando "—" para ese lado.
5. DevTools → Network → filtrar por `resultados_real` → verificar query con `where nivel == sala_cuna_menor`.

---

## 4. Fixes secundarios

| Fix | Fuente | Descripción |
|---|---|---|
| `I.6` e `I.29` en catálogo | Comparación con XLSX (F4) | Estaban marcados `unidad: binario` cuando el XLSX de Focus dice `conteo`. Corregidos en `catalog.json`. |
| `desagregaNivel: true` en 27 indicadores | Reporte mapeo (F3) — corregido 21-jul (§9) | Los indicadores del catálogo que aparecen como columna en `VISUALIZADOR SALAS` (traducidos a coordenadas de catálogo) reciben el flag para activar el filtro Nivel del comparador. Set final: `I.14–I.21` (sin I.22/I.23), `I.24–I.28`, `I.40–I.43`, `I.45–I.54`. |
| Auth del script `mapeoParvulario` | Iteración (F5) | Cambio de `google.auth.JWT` → `google.auth.GoogleAuth` para alinearse con el patrón que ya funciona en `syncPlanillasCentrales.mjs`. |
| Corrección de `computeLogro` en ingest | Iteración (F6) | El clamp `Math.min(1.2, r)` se conserva; la lógica de `estado: 'validado'` unificada para todos los docs. |

---

## 5. Preguntas abiertas pendientes con Luis

| # | Pregunta | Contexto |
|---|---|---|
| Q1 | ¿I.22 (comités comunales) e I.23 (fiesta familia) se sacan del catálogo o vienen de otra fuente? | No están en ninguna planilla VISUALIZADOR. Aparecen en `docs/mapeo-parvulario-2026-07-21.md` como **Faltantes** (2). Nota: la versión previa del reporte listaba erróneamente `I.20/I.44` — corregido en §9. |
| Q2 | ¿I.36, I.37, I.38 (plan de acción), I.54 (ciclo talleres) tienen datos pendientes o quedan sin reportar el año? | Columnas presentes en las planillas pero con puras celdas "SIN DATOS". |
| Q3 | ¿Corremos snapshot de matrícula ahora (mayo 2026) o esperamos? | Sin el snapshot, CAP ve "matrícula vigente" (dato vivo) — funcional pero no refleja el compromiso de reporte estable. |
| Q4 | ¿`transicion_2` no está reportado porque no hay salas de ese nivel, o falta cargar? | No apareció en ninguna de las 3 planillas. |
| Q5 | Feature flag heatmap: ¿lo activamos en el deploy productivo para que Luis lo pruebe, o queda solo local? | Hoy está detrás de `VITE_FEATURE_HEATMAP=true`. Sin activar. |
| Q6 | Reunión con SEBA para requerimientos Escolar (acción capturada en Granola). | Prerequisito para arrancar Escolar. |

---

## 6. Camino sugerido para verificación end-to-end

**Orden recomendado (mínimo 45 min):**

1. **UI transversal (10 min)**
   - Login como escuela, jardín, sostenedor, consultor, CAP, superadmin en secuencia.
   - Verificar cyan/meta consistente en `TotalCard`, `IndicatorProgress`, ranking, drilldown.
   - Verificar jerarquía "Indicadores por ámbito" con sub-sección "Indicadores de logro asociados".

2. **Comparador rediseñado (10 min)**
   - Sin dropdown de mes.
   - Cambiar entre indicador `%` / `conteo` → eje se adapta.
   - Desglose por establecimiento con sostenedor específico + indicador focal.
   - Filtro Nivel: `sala_cuna_menor` para un indicador con `desagregaNivel:true` (ej: I.15 semanas libros BV) muestra dato diferente que "Todos los niveles".

3. **Ranking (2 min)**
   - Confirmar valores en lime cuando alcanzan meta.

4. **Matrícula CAP (5 min)**
   - Sin snapshot: sub-label "matrícula vigente".
   - Correr `npm run snapshot-matricula -- --corte=mayo --anio=2026`.
   - Recargar CAP → sub-label "matrícula al 21 jul. 2026".

5. **Mapa de calor superadmin (5 min)**
   - Crear `.env.local` con `VITE_FEATURE_HEATMAP=true`, reiniciar dev.
   - Login superadmin → expandir sección → confirmar grid + click celda.

6. **Ingesta Parvulario (10 min)**
   - `node scripts/ingestParvulario.mjs --dry-run` → leer reporte.
   - Verificar en Firestore console que hay 5119 docs de `parvulario`.
   - Confirmar que I.1 catálogo tiene el valor de la planilla I.2 (traducción numeración).

7. **Mapeo (3 min)**
   - Abrir `docs/mapeo-parvulario-2026-07-21.md`.
   - Confirmar 52/54 mapeados, faltantes `I.22` y `I.23`, 1 huérfano (planilla `I.1`).
   - Confirmar sección "Desglose por sala" con 27 IDs de catálogo (`I.14–I.21` sin I.22/I.23, `I.24–I.28`, `I.40–I.43`, `I.45–I.54`).

---

## 7. Estado de despliegue

- **GitHub:** ✅ 3 commits pusheados a `main` (`de763a6`, `8bc2bdd`, `ab1801d`).
- **Firestore:** ✅ ingesta ejecutada — 5119 docs en `resultados_real` + 24 en `establecimientos_real`.
- **Firebase Hosting:** ⚠ pendiente `firebase login --reauth && npm run deploy` desde terminal local (sesión de Firebase CLI expirada).

---

## 8. Referencias

- Reporte de mapeo: [docs/mapeo-parvulario-2026-07-21.md](mapeo-parvulario-2026-07-21.md)
- Reporte de ingesta: [reports/ingestParvulario-2026-07-21.json](../reports/ingestParvulario-2026-07-21.json)
- Plan original: `/Users/espohr/.claude/plans/el-viernes-tuve-una-federated-wave.md`
- Notas Granola: meeting `2d01fb68-a32d-4d12-93c7-7770b9084f7a`

---

## 9. Corrección 21-jul-2026 (post-auditoría)

**Contexto:** revisando la primera versión del reporte `mapeo-parvulario-2026-07-21.md` se detectó que `mapeoParvulario.mjs` **no aplicaba la traducción planilla → catálogo** antes de comparar. Comparaba los IDs crudos de los headers contra el catálogo local, lo que produjo tres problemas:

1. **Faltantes mal identificados:** el reporte listaba `I.20, I.44` como faltantes, cuando los reales (en coordenadas de catálogo) son `I.22, I.23` — coincidente con `indicadoresNoCubiertos` de `reports/ingestParvulario-2026-07-21.json`.
2. **Huérfano invisibilizado:** el reporte declaraba 0 huérfanos, pero planilla `I.1` ("N° de visitas al jardín") sí es un huérfano real — se estaba matcheando silenciosamente contra el catálogo `I.1` (otro indicador).
3. **`desagregaNivel` con IDs equivocados:** el commit `8bc2bdd` aplicó el flag en `catalog.json` usando los IDs crudos del reporte (26 IDs, coordenadas de planilla). Traducidos, el conjunto correcto (header-driven, coordenadas de catálogo) tiene **27 IDs**. Diferencias respecto al set anterior: se **quitaron** `I.19, I.22, I.23, I.39` (que no correspondían) y se **agregaron** `I.14, I.20, I.28, I.43` (que sí llegan por sala). Además I.54 pasa a tener el flag (aparece como columna en SALAS aunque hoy sin datos).

**Cambios de esta corrección:**

- Nuevo `scripts/lib/parvularioIds.mjs`: `extractPlanillaId()` (regex tolerante al typo `"I.,20"`) + `planillaToCatalog()`. Compartido entre `ingestParvulario.mjs` y `mapeoParvulario.mjs`.
- `scripts/mapeoParvulario.mjs` reescrito para reportar en coordenadas de catálogo. La sección "Por planilla" muestra el ID de catálogo con el ID de planilla original entre paréntesis para trazabilidad. Nueva sección "Notas sobre la numeración" al final.
- `scripts/ingestParvulario.mjs` refactorizado para importar del módulo compartido. El reporte JSON ahora incluye `indicadoresConNivel` (fuente empírica del flag).
- `scripts/parseCatalogs.mjs` extendido: constante `PARVULARIO_DESAGREGA_NIVEL` con los 27 IDs; el flag se aplica al parsear el XLSX para que sobreviva a regeneraciones del catálogo.
- `src/data/catalog.json`: flags corregidos in-place para no requerir re-run de parseCatalogs (que necesita los XLSX). El set final coincide con el que `parseCatalogs.mjs` emitiría.
- `docs/mapeo-parvulario-2026-07-21.md` regenerado con los conteos correctos.

**Firestore NO se tocó.** La ingesta ya usaba la traducción correcta (via `planillaToCatalog` en `ingestParvulario.mjs`), así que los 5119 docs escritos el 21-jul están en coordenadas de catálogo. El bug era solo en la capa de reporte + en el flag `desagregaNivel` que se derivaba mal de ese reporte.

**Validación:**

- `node scripts/ingestParvulario.mjs --dry-run` → 48 cubiertos, 6 no cubiertos (mismos IDs que la ingesta real). Nuevo campo `indicadoresConNivel` con 26 IDs (data-driven).
- `npm run mapeo-parvulario` → 52 mapeados, faltantes `I.22, I.23`, 1 huérfano (planilla `I.1`), desglose por sala = 27 IDs (header-driven, incluye I.54).
- Los dos derivados difieren en `I.54` (headers sí lo listan, pero las celdas están vacías). Decisión de sesión: usar el conjunto header-driven, de modo que si en el futuro Focus carga datos por sala para I.54, el filtro Nivel funcione sin cambios de código.
