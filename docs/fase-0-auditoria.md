# Fase 0 — Auditoría del repositorio y de la ruta de datos

**Alcance:** entender por qué la app no muestra datos reales y qué de lo existente sirve para llegar al objetivo (pipeline diaria e idempotente que alimente los 106 indicadores del programa PAF sin PII).

Este documento es **read-only**: no se modificó ningún archivo. Es el insumo para acordar el esquema y el plan de Fase 1.

---

## 1. Arquitectura actual (lo que hay)

### 1.1 Stack

- **Frontend:** React 18 + Vite + Tailwind + Recharts + TanStack Query v5 + Firebase Web SDK v12. Rutas con `react-router-dom` v6.
- **Backend:** Firebase (proyecto `visualizador-paf`).
  - **Firestore** (rules v2, indexes definidos).
  - **Firebase Hosting** para el SPA.
  - **Cloud Functions v2** en `us-central1`, Node 20, con `firebase-functions` v6.
  - **Cloud Scheduler** conectado a la función `syncPlanillasCentrales` (`0 2 * * 0-4`, TZ `America/Santiago`).
- **Auth:** Firebase Auth con Google + email/password; whitelist de superadmins hardcoded en `src/lib/firebase.js` (Luis, Sebastián, Edmundo).
- **Package manager:** npm. Dos workspaces implícitos (raíz + `functions/`), sin monorepo tooling.
- **Deploy:** `npm run deploy` (Hosting), `functions/npm run deploy` (Functions), `npm run seed` (script local que puebla Firestore desde `src/data/*.js`), `npm run sync-planillas` (mismo pipeline que la Cloud Function pero local).

### 1.2 Colecciones Firestore ya en uso

Definidas en `firestore.rules` y consumidas por `src/lib/queries.js`:

| Colección | Escritor | Doc ID | Contenido |
|---|---|---|---|
| `usuarios/{uid}` | cliente en login | `uid` de Auth | `email, nombre, perfilDefault, establecimientoId, slepId` |
| `sostenedores/{slepId}` | `seed.mjs` | `SLEP-LP` etc. | 4 SLEPs mock |
| `establecimientos/{estId}` | `seed.mjs` + pipeline | `ESC-001`, `JAR-014`… | Nombre, tipo, slep, cohorte, comuna, `nSalas`, `nNinos`, `nAgentes`, `consultorEmail` (todos sintéticos) |
| `indicadores/{programa_id}` | `seed.mjs` | `escolar_E.1`, `parvulario_P1.1`… | Catálogo (nombre, meta, `metaNum`, unidad, frecuencia, fuente, `clasificacion`) |
| `ambitos/{programa_id}` | `seed.mjs` | `escolar_A1`… | Ámbitos por programa |
| `progresoTrimestral/{docId}` | Cloud Function | `{estId}_{ambitoId}_{anio}_T{n}` | % por (est × ámbito × trimestre), fuente Planillas Centrales |
| `valoresIndicador/{docId}` | Cloud Function | `{estId}_{indId}_{anio}` | Valor atómico por indicador/año (fase C recién estrenada) |
| `metadata/mesCerrado` | `seed.mjs` | fijo | Último mes cerrado para vista CAP |
| `metadata/pipeline` | Cloud Function | fijo | Última ejecución del sync |
| `progresoTrimestral` y `valoresIndicador` | **cliente NO escribe** | — | `allow write: false` en rules |

Índices ya declarados en `firestore.indexes.json` cubren queries por `programa/ambito`, `slep/tipo`, `tipo/cohorte`, `programa/id`, `establecimientoId/anio` — coinciden con lo que consultan las vistas.

### 1.3 Ingesta actual

Existen **dos rutas idénticas** de sincronización (comparten heurísticas y catálogo hardcodeado):

- **`scripts/syncPlanillasCentrales.mjs`** — invocable localmente vía `npm run sync-planillas [-- --dry-run]`. Usa `scripts/service-account.json` (Firebase Admin + Sheets API).
- **`functions/src/index.mjs`** — Cloud Function `syncPlanillasCentrales` (scheduled) + `syncManual` (HTTPS con header `X-Sync-Token`). Usa **ADC** (Application Default Credentials) del runtime, es decir la SA del proyecto GCP `visualizador-paf`.

Ambas rutas:

1. Leen **3 spreadsheets hardcoded** (los "Planillas Centrales" de parvulario):
   - `1KnApSDHVGh8tXzPYOQY957jvzEvw3ra5lwvxevL3s9A` — Cohorte 2025-2026 Año 1
   - `1oJQ8bUfoWy3q_ezzLnlGiLE7UvxhuHllRE27dzOEyYo` — Cohorte 2025-2026 Año 2
   - `1Qr5QvnfJ-_F3hVRikFRWNy-RyruKBK7T37m-DY-obwk` — Cohorte 2026-2027 Año 1
2. Para cada tab, ejecutan **dos parsers**:
   - `parsearHoja` — extrae % de progreso por trimestre y ámbito (heurística por palabras clave del texto del objetivo). Escribe en `progresoTrimestral`.
   - `parsearHojaIndicadores` (`functions/src/parserIndicadores.mjs`) — cuando el título de la hoja matchea `INDICAD0RES CONSULTOR|IND PRODUCTOS|INDICADORES COORDINADOR|EXTRAS` extrae valores por indicador y actualiza atributos del establecimiento (`nSalas`, `nNinos`, `nAgentes`). Escribe en `valoresIndicador`.
3. Matching de establecimiento: por **nombre del tab** (mapa `TAB_ABREV` hardcoded con ~35 abreviaturas), fallback a fuzzy match sobre `establecimientos.nombre` en Firestore.
4. Matching de indicador: fuzzy sobre `indicadores.nombre` (exact / include / 65% de overlap de tokens).
5. Idempotencia: `set({...}, { merge: true })` por doc ID determinístico.

### 1.4 Ruta de datos del frontend

- El `AppProvider` (`src/lib/context.jsx`) escucha `onAuthStateChanged`, lee `/usuarios/{uid}` y arma el `perfil` (`escuela | jardin | sostenedor | consultor | cap | superadmin | pendiente`). Sin sesión → Login (solo Google, sin modo demo).
- Cada vista consulta el catálogo con hooks React Query (`useEscuelas`, `useJardines`, `useSleps`, `useIndicadores(programa)`, `useAmbitos(programa)`).
- **Sobre esos catálogos las vistas calculan los valores mostrados con `generarValorIndicador()`**, que es una **PRNG determinística sintética** definida en `src/data/establecimientos.js`. `logroPorAmbito`, `promedioTerritorioIndicador`, `promedioSlepAmbito`, el ranking, el comparador por indicador, el `IndicatorAveragePicker` y el `IndicatorDrilldown` **todos consumen esta PRNG**.
- **Excepción:** `VistaEscuela` sí llama `useValoresIndicador(establecimientoId, ANIO_ACTUAL)`, arma un `Map(indicadorId → valor)` y lo pasa como prop `valoresReales` a `IndicatorPanel`. `IndicatorPanel` prefiere el valor real si existe (badge "real" con Sparkles) y cae en la PRNG si no.
- `VistaSostenedor` y `VistaConsultor` **no** consumen `valoresIndicador` en ninguna forma. Toda su información numérica sale de la PRNG.
- `ProgresoTrimestralPanel` sí lee `progresoTrimestral` real, y `PipelineStatusBanner` lee `metadata/pipeline`.

### 1.5 Regla de RLS y perfiles

Rules v2 se apoyan en `/usuarios/{uid}.perfilDefault`. Los perfiles `consultor|cap|superadmin` leen todo; `escuela|jardin` solo su `establecimientoId`; `sostenedor` solo los `establecimientos.slep == usuarios.slepId`. `progresoTrimestral` y `valoresIndicador` tienen la misma lógica. Las escrituras son solo por Admin SDK (write: false para clientes).

### 1.6 Credenciales y secretos

- `scripts/service-account.json` presente localmente (`project_id: visualizador-paf`, `client_email: firebase-adminsdk-fbsvc@visualizador-paf.iam.gserviceaccount.com`). Correctamente ignorado por `.gitignore`.
- La Cloud Function usa **ADC del runtime**, es decir la SA que Firebase asigna a la función. No hay `.env` con `SYNC_TOKEN` en el repo — se asume seteado como variable de entorno en el despliegue.
- Las claves de Firebase Web (config en `firebase.js`) son públicas por diseño.

---

## 2. Causa raíz — por qué no se ve data real

En orden de impacto:

### 2.1 CAUSA PRINCIPAL: el pipeline nunca escribe datos para Escolar y solo escribe fragmentos para Parvulario

- Las 3 planillas hardcoded son **todas** `programa: 'parvulario'`. **No hay ninguna spreadsheet Escolar en el pipeline** — los 52 indicadores Escolares no se sincronizan jamás.
- Aun para Parvulario, no se leen los 24 workbooks por jardín (Registro Coordinación / UTP) que el prompt define como fuente real. Se leen 3 planillas de agregación intermedia ("Planillas Centrales") que Focus mantiene manualmente. Esto es exactamente lo que Fase 1 pide **evitar**.
- Los **Índices Maestros** (`1WGGVQ8UjUJjfbkZRZqLADmhZURMnwtc5ykpJsTfOSyk` Escolar, `1fbMEafXImtwF50gjAQFrY55VLpkgruZqv0Kb-pf6GOw` Parvulario) **no aparecen en el código** — el pipeline no descubre workbooks por establecimiento; los ignora.
- Los **catálogos oficiales** (`1MA5DyvOYKYhCVX8G8i0M6K4liV0jOGRJQ7BBrN-v0Yg` Escolar, `1jhU3pojBN1LaMUZTNcvP9gZ1QzaewkRebupCs5m9AcU` Parvulario) tampoco se leen desde Sheets; el catálogo vive congelado en `src/data/indicadores.js`.

### 2.2 CAUSA SECUNDARIA: el catálogo en `src/data/indicadores.js` está vacío

Post-Fase A el archivo se dejó como placeholders (exports vacíos: `INDICADORES_ESCOLAR = []`, etc.) para no romper el `import` de `seed.mjs`. El comentario en el archivo lo dice explícitamente:

> "Si alguna vez se reseedea hay que restaurar los arrays temporalmente."

Consecuencia: **si alguien ejecutó `npm run seed` después del cambio a placeholders, las colecciones `indicadores` y `ambitos` quedaron vacías** — y el frontend queda mostrando 0 indicadores.

Se debe verificar en la consola de Firestore cuántos docs hay hoy en `/indicadores` y `/ambitos`. Si están vacíos, ese solo hecho apagó la app.

### 2.3 CAUSA TERCIARIA: dos de las tres vistas ignoran los valores reales

Aunque el pipeline dejara algo escrito en `valoresIndicador`, **`VistaSostenedor` y `VistaConsultor` nunca hacen la query** — usan la PRNG. El único perfil que hoy vería datos reales por indicador es `escuela|jardin` sobre parvulario, y solo para los indicadores que el fuzzy matching haya conseguido mapear.

### 2.4 Causas menores / riesgos

- **Compartir con la SA:** la Cloud Function corre con ADC. Si la SA del runtime **no** es la misma que la SA que Focus compartió con las Planillas (`firebase-adminsdk-fbsvc@…`), la lectura falla en producción aunque el `syncPlanillasCentrales.mjs` local sí funcione. Hay que verificar cuál SA usa la función en `functions/us-central1/syncPlanillasCentrales` y confirmar que está compartida como Viewer con **cada** spreadsheet fuente.
- **Idempotencia con schema evolutivo:** `metadata/pipeline` se sobrescribe con éxito solo si `erroresPorPlanilla.length === 0`. Si un solo spreadsheet falla, la métrica dice `ultimoSyncExitoso: false` pero sin distinguir causas por planilla — el banner del frontend puede pintarse en rojo aunque el 90% haya cargado bien.
- **PII:** el parser de `INDICADORES COORDINADOR` lee `matricula` y actualiza `establecimientos.nNinos`. Esto es agregado y no PII. Pero **no se ha inspeccionado ninguna hoja tipo `RA / EA / VOL`** (marcadas como "saltar") ni las hojas de curso PKA/KA/1A, que **sí traen RUT y nombres de menores**. La arquitectura actual las salta, lo cual es correcto para el estado actual, pero el paso a leer Registros Coordinación directamente (Fase 2) va a chocar con esas hojas. Hay que definir dónde se corta la PII **antes** de tocar esos archivos.
- **Grain de `valoresIndicador`:** el doc ID es `{est}_{ind}_{anio}` — no hay `periodo` ni `mes`. Un indicador mensual solo puede tener **un** valor por año, lo que impide comparar meses o mostrar evolución real. La decisión del prompt es "solo current value per period", pero el "periodo" del ID debe reflejar la `frecuencia` del indicador (mensual → `2026-07`, trimestral → `2026-T3`, semestral → `2026-S1`, anual → `2026`). Hoy no se hace.
- **Datos sintéticos filtrados por diseño en las vistas:** rankings, top/bottom, comparador, promedios por territorio y ámbito → **todos** basados en PRNG. Incluso si el pipeline llena `valoresIndicador` completo, las vistas de sostenedor y consultor van a seguir mostrando números fabricados hasta que se cablee la lectura real ahí también.
- **`slepId` en `usuarios`:** las rules requieren `getUsuario().slepId` para perfil sostenedor, pero el flujo de asignación (panel superadmin) hay que revisar que lo esté seteando; no se validó en esta auditoría.
- **`consultorEmail` es sintético:** el prompt dice que el cliente lo va a poblar. Hoy `seed.mjs` lo genera con una PRNG round-robin sobre 3 placeholders. Cualquier filtro/agrupación por consultor está mintiendo.

---

## 3. Inventario — qué sirve y qué falta

### 3.1 Reutilizable tal cual

- Autenticación, whitelist de superadmins y modelo de perfiles/RLS en Firestore rules — **sólido, no tocar**.
- Firestore indexes y schema base de `sostenedores`, `establecimientos`, `usuarios`, `metadata` — buen punto de partida.
- Layout, Login, componentes de visualización (`IndicatorPanel`, `IndicatorProgress`, `IndicatorDrilldown`, `IndicatorRanking`, `IndicatorAveragePicker`, `PipelineStatusBanner`, `ProgresoTrimestralPanel`, `Glosario`) — la UI sirve; solo hay que redirigir su fuente de datos.
- Cloud Function scheduled + trigger HTTPS con token — la infra de ejecución diaria ya está.
- Hook `useValoresIndicador` y branch de `IndicatorPanel` que prefiere valores reales — el patrón "prefiere real, fallback PRNG" es el correcto y solo hay que extenderlo.

### 3.2 Reutilizable con cambios chicos

- `parserIndicadores.mjs`: la lógica de mapeo columna→indicador por overlap de tokens es correcta para hojas con nombres de indicador en el header. Se puede usar contra los Registros Coordinación reales una vez que se generalice el descubrimiento de tabs.
- `TAB_ABREV`: mapeo de abreviaturas de tab a nombres — útil para el estado actual pero **no** debería ser la fuente de matching. La fuente correcta es el Índice Maestro (que ya tiene columna nombre por establecimiento).

### 3.3 Reemplazar

- El "descubrimiento" de spreadsheets: hoy son 3 IDs hardcoded, tiene que pasar a leer los dos Índices Maestros y descubrir los ~42 workbooks reales.
- La resolución de establecimientos: hoy es fuzzy sobre nombre, tiene que pasar a matching por RBD/código o por el `establecimientoId` derivado de la fila del Índice Maestro.
- `src/data/indicadores.js`: hoy vacío. El catálogo debe reseedearse desde los Sistemas de Indicadores (Sheets), no desde JS.
- El modelo `progresoTrimestral` + `valoresIndicador` (dos colecciones con grain distinto): se puede consolidar en una sola `resultados` con `periodo` y `frecuencia` explícitos (ver Fase 1). La `progresoTrimestral` puede quedar como vista derivada.

### 3.4 Faltan

- Lectura del Índice Maestro Escolar + Índice Maestro Parvulario (dos spreadsheets).
- Descubrimiento y lectura de 18 workbooks Escolar + 24 workbooks Parvulario.
- Motor de fórmulas por indicador (hoy solo se extrae el valor si el header de la columna matchea el nombre del indicador; los 106 indicadores requieren **calcular** a partir de columnas crudas de Registros Coordinación / UTP).
- Frontera de PII: filtro y hash (o descarte) de RUT/nombre en el `normalize()` antes de agregar.
- Bandera `estado ∈ {validado, provisional}` por indicador para poder mostrar los que aún no están mapeados con confianza (con badge en el UI).
- Cableado de `valoresIndicador` en las vistas Sostenedor y Consultor.
- Purga o marcado del uso restante de `generarValorIndicador` en el frontend, para que cuando falte un valor real se muestre "sin dato" en vez de un número sintético.
- `resultados` (o el nombre que se acuerde) con doc ID determinístico que incluya `periodo`.

---

## 4. Ruta que se tiene que romper y volver a armar

```
Fuente real (42 workbooks + 2 índices + 2 catálogos)   ← HOY IGNORADA
                        │
                        ▼
        (nada)  ← el pipeline hoy va a otras 3 planillas de agregación intermedia
                        │
                        ▼
Firestore /valoresIndicador (parcial, solo parvulario, solo indicadores cuyo nombre matchea)
Firestore /progresoTrimestral (parcial, solo parvulario)
                        │
                        ▼
Frontend usa PRNG sintética para todo excepto VistaEscuela → valoresIndicador
```

Tres puntos de ruptura simultáneos: (a) el pipeline no lee las fuentes correctas, (b) no cubre Escolar, (c) las vistas Sostenedor y Consultor ni siquiera consultan lo que sí hay. Corregir cualquiera de los tres en aislado no basta.

---

## 5. Preguntas abiertas para Fase 1

1. **Confirmar la SA del runtime de la Cloud Function** — ¿es la misma cuenta con la que Focus compartió las planillas? Si no, se corrige antes de tocar código.
2. **¿Se conservan `progresoTrimestral` y `valoresIndicador` como colecciones separadas, o se colapsan en `resultados`?** Se propone en Fase 1 colapsar y dejar `progresoTrimestral` como vista opcional derivada al momento de leer.
3. **PII de menores**: ¿la política definitiva es descartar RUT/nombre en normalización o hashear con SHA-256 como plantea CLAUDE.md? Para agregados no se necesita el RUT — descarte simple es más seguro.
4. **`consultorEmail`**: el prompt dice que Luis lo poblará en el Índice Maestro. Se debe confirmar la columna exacta antes de escribir el lector.
5. **Frecuencia y "periodo" en el doc ID**: se propone `mensual→YYYY-MM`, `trimestral→YYYY-Tn`, `semestral→YYYY-Sn`, `anual→YYYY`. Confirmar con Sebastián/Luis en Fase 1 antes de codificarlo.
6. **Cadencia diaria vs. frecuencia del indicador**: el pipeline corre diario, pero un indicador anual solo se compara contra su meta en su periodo. ¿Se recomputa igual todos los días (idempotente) y se guarda `updatedAt` sin generar nuevos docs? Esa es la lectura que se propone.

Con estas seis preguntas resueltas se puede armar Fase 1 en firme.
