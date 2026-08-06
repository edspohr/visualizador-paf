# Auditoría de indicadores tipo "promedio"

**Fecha:** 2026-08-06
**Contexto:** Luis Agurto (contraparte Parvulario) mencionó "en algunos indicadores donde se sacan promedios de un dato…" — el mensaje quedó incompleto. Este documento inventaría todos los puntos de la pipeline y de la UI donde el visualizador computa un promedio, para que la respuesta al cliente esté basada en hechos verificables y no en supuestos.

**Alcance:** ningún cambio de lógica. Sólo lectura y catalogación.

## Resumen ejecutivo

Sí hay evidencia de dos patrones diferenciables, verificados numéricamente contra Firestore vía `scripts/diagnoseAveragingConsistency.mjs`:

**Hallazgo #1 — Mean-of-means aplicado desigualmente.** Para indicadores parvulario que llegan por SALAS, el ingest emite el doc jardín como media simple sobre salas, salvo cuando el mismo jardín también reportó un valor en el tab JARDÍN — en ese caso el valor reportado gana (dedup línea 574 de `ingestParvulario.mjs`). Correr contra 5 indicadores promedio parvulario:

| Ind | Nombre | jardines con agg = mean(salas) | jardines con agg ≠ mean(salas) |
|---|---|---|---|
| I.17 (libros recibidos por familias) | 8 / 24 | **16 / 24** ← jardines reportan valor directamente |
| I.19 (cartillas enviadas por familia) | 24 / 24 | 0 / 24 ← mean-of-means en TODOS |
| I.24 (asistencia talleres formativos) | 17 / 24 | 7 / 24 |
| I.32 (asistencia encuentros JI apoderados) | 0 / 24 | 0 / 24 ← sólo agg, sin salas |
| I.46 (asistencia reuniones apoderados) | 19 / 24 | 5 / 24 ← mean-of-means dominante |

Consecuencia: dos jardines con la misma etiqueta de indicador pueden estar computando el número de dos maneras distintas. Si el jardín reporta un valor global en el tab JARDÍN, ese valor gana; si no, se promedian salas.

**Hallazgo #3 — Denominador inconsistente cuantificado.** Sobre los mismos 5 indicadores, el "valor eje nativo" (A) y el "% cumplimiento" (B) del comparador dan números claramente distintos. Ejemplo I.24 (asistencia talleres, meta = 60%):

| Método | I.24 valor mostrado |
|---|---|
| A = promedioValor (valor nativo) | **43.0%** |
| B = ratioLogro (% cumplimiento) | **70.3%** |

**27 puntos de diferencia** sobre el mismo indicador, sin faltantes. La causa es legítima matemáticamente — A es la media de los valores reportados, B es la media del logro (que capea a 100% al alcanzar la meta) — pero el usuario no ve dos etiquetas claras "valor" vs "cumplimiento", ve dos ejes de un mismo componente. Y el ranking en VistaConsultor usa AMBOS simultáneamente sin advertirlo.

**Sobre Escolar (no re-verificado numéricamente en esta ronda):** los I.43/I.44 de escolar corresponden semánticamente a "Promedio libros/lecturas viajeras declaradas por familias" y su ingest lee un escalar precomputado por Focus (`ingestEscolar.mjs:646`), así que a nivel escuela no hay mean-of-means. El sesgo aparece sólo al agregar cross-escuela.

**Sobre la queja de Luis:** ya no es una hipótesis única. Hay tres candidatos concretos que él podría estar señalando:
1. La discrepancia entre A y B en el comparador (Hallazgo #3, numéricamente confirmada).
2. El mean-of-means no ponderado por matrícula en indicadores como I.19, I.24 (Hallazgo #1, numéricamente confirmada en 17/24 y más).
3. La coexistencia de dos convenciones de denominador (faltantes = 0 vs excluidos) en 7 lugares del código base — en este dataset no hay faltantes 2026, así que no aflora, pero cuando aparezcan (Escolar 2026 tiene 18 indicadores sin datos aún) sí lo hará.

Ninguno de los tres se ha reportado antes en `docs/informe-cobertura-fuentes-2026-08-05.md`.

**Corrección respecto a la primera versión de este documento (mismo día):** originalmente ubiqué "Promedio de libros/lecturas viajeras utilizadas por familias" en parvulario I.43/I.44. La numeración correcta en el catálogo canónico vigente es **parvulario I.17/I.19** (libros recibidos por familia / cartillas enviadas por familia). Los I.43/I.44 escolares tienen la etiqueta "declaradas" y viven en el tab Encuesta apoderados.

## Tabla — Puntos donde el visualizador computa un promedio

| ID | Programa | Nombre corto | Datum subyacente | Denominador | Dónde se computa | Media-de-medias? | Faltantes → 0 o excluidos? | Consistente entre vistas? |
|---|---|---|---|---|---|---|---|---|
| I.43 | parvulario | "Promedio de libros de biblioteca viajera utilizados por familias" | Valor pre-computado por Focus en la Planilla Central (una scala por sala) | # de salas del jardín (**sin ponderar por # familias que respondieron**) | Ingest → agregado por jardín: `scripts/ingestParvulario.mjs:441` | **Sí, media-de-medias**. Sala ya es media por familia; jardín es media de salas | Salas sin dato **excluidas** del denominador de jardín (`if (parsed.valor === null) continue`, línea 403) | En comparador y ranking se hace **otra** media, esta vez sobre jardines. Ver notas |
| I.44 | parvulario | "Promedio de lecturas viajeras utilizadas por familias" | Idem I.43 | Idem I.43 | Idem I.43 (`ingestParvulario.mjs:441`) | Sí | Idem | Idem |
| I.29 · I.31 · I.42 · I.43 · I.44 · I.45 | escolar | Encuesta apoderados (declaran utilizar…) | Escalar único por escuela ya reportado en el tab "Encuesta apoderados" | 1 (por escuela) | `scripts/ingestEscolar.mjs:646-666` (`ingestEncuestaApoderados`) | **No** al nivel de ingesta (la escuela reporta un escalar). Pero cuando el usuario ve "Promedio del programa" o filtra por sostenedor, se computa media sobre escuelas → media-de-medias del reporte de Focus | Escuelas sin dato **excluidas** del promedio a nivel de escuela (retorno null) | Los cross-est promedios coexisten con `sumaLogroCapped` que cuenta faltantes como 0 (`scope.js`) — el mismo indicador puede verse con dos denominadores en el mismo dashboard |
| I.28 | escolar | "Cantidad promedio de envío de Lecturas Viajeras por sala" | Suma de una columna por sala | # salas con datos leídos (`bvSalas.length`) | `scripts/ingestEscolar.mjs:614-616` | Sí — el ingest hace `sum(bvSalas) / bvSalas.length`. Salas sin cabecera detectada quedan fuera | Salas sin header 'Activo' **excluidas** (línea 542, `missing.add(sala); continue`) | Consistente a nivel de escuela; en agregados cross-est, sí hay media-de-medias |
| I.19 · I.20 | escolar | "% estudiantes con entrevistas (≥1 / ≥2)" | Booleanos por estudiante | Total de estudiantes activos de la escuela (`totalStudents`) | `scripts/ingestEscolar.mjs:590-593` | **No** en ingesta — es un ratio limpio a nivel escuela. Sí en agregados cross-est | Estudiantes retirados excluidos (línea 549). Estudiantes sin dato en `entrAnualCol` cuentan 0 implícitamente (el ratio usa `totalStudents` como denominador) | A nivel escuela OK; a nivel sostenedor/nacional, media-de-medias |
| I.12 · I.16 | escolar | "% docentes asisten a módulos formativos" | Booleanos por docente × módulo | # docentes activos × # módulos (dos niveles de promedio) | `scripts/ingestEscolar.mjs:391-407` (I.12), 409-429 (I.16) | **Sí en el ingest**. Primero se computa `sum(TRUE) / #cols` por docente, después `mean` sobre docentes. Media-de-medias explícita | Docentes sin datos excluidos (`filter(v => v !== null)`) | A nivel escuela ya es media-de-medias; a nivel sostenedor, media-de-medias-de-medias |
| I.13 · I.14 | escolar | "Director/Coordinador asiste a módulos" | Booleanos por módulo (fila única) | # módulos | `scripts/ingestEscolar.mjs:439-453` | **No** — ratio simple sobre 1 fila | N/A (una sola persona) | OK a nivel escuela; en cross-est, media simple sobre escuelas |
| I.36 · I.37 · I.47 | escolar | "Nota promedio (evaluación de instancia formativa)" | Escalar pre-computado en la planilla | 1 (por escuela × instancia) | `scripts/ingestEscolar.mjs:174-182` (spec `first_number_from_col1`) | Sí a nivel cross-est. A nivel escuela es el número que reportó el consultor | Escuelas que no reportaron el número **excluidas** de la media cross-est en el comparador (`promedioValor`), pero **contadas como 0** por `ratioLogro` | Divergencia en el comparador según qué "modo" del eje se use |
| I.40 · I.41 | escolar | "% apoderados con ≥1 taller / con 4/4 talleres" | Booleanos por estudiante | Total de `tallerPerStudent.length` (estudiantes con al menos una celda TF) | `scripts/ingestEscolar.mjs:620-623` | No en ingest — ratio de estudiantes. Sí en cross-est | Estudiantes sin ninguna col TF excluidos | Idem cross-est |
| — | parvulario | (14 indicadores unidad "promedio" y 15 unidad "%") | Vía tab VISUALIZADOR SALAS o VISUALIZADOR JARDÍN | Ver nota 1 | `ingestParvulario.mjs` línea 441 (SALAS) o 356 (JARDÍN) | Media-de-medias siempre que el dato viene por SALAS; escalar cuando viene por JARDÍN | Salas con celda vacía excluidas (`if (parsed.valor === null) continue`) | El agregado por jardín gana sobre el promedio de salas si ambos existen (dedup lógica línea 574) |
| Cross-est (todos los indicadores) | ambos | Cualquier indicador visto en VistaConsultor / VistaSostenedor | Valor establecimiento | Ver "Consistencia" abajo | `src/views/VistaConsultor.jsx:172-188`, `VistaSostenedor.jsx:128-150`, `SostenedorAveragePicker.jsx:37-54`, `ComparadorIndicador.jsx:76-99` | Sí — todos los flujos computan medias sobre establecimientos | **Inconsistente entre lugares**: ver Hallazgo #3 | **No** |

**Nota 1 — Denominador Parvulario SALAS:**
para el agregado por jardín, el denominador es "# de salas con al menos un valor no nulo en el indicador". No es "# de salas del jardín" ni "# de niños del jardín" ni "# de familias que respondieron encuesta". El indicador se llama "Promedio…por familias", pero el promedio real es sobre salas.

**Nota 2 — Peer aggregates (`aggregatesTerritorio_real`):**
el script `scripts/computeTerritorioAggregates.mjs:174-180` computa `sumaValor = Σ v` y `nReporters = # establecimientos con valor`, y sirve `mean = sumaValor / nReporters` (queries.js:235). Es media simple sobre establecimientos que reportaron, con umbral K_MIN=4. **Faltantes excluidos del denominador.** Esto está en tensión con `cumplimientoIndicadores` que cuenta faltantes como 0.

## Hallazgos

### #1 — Media-de-medias sistemática en Parvulario SALAS
- **Dónde:** `scripts/ingestParvulario.mjs:441`
- **Qué:** el agregado por jardín se emite como `sum(valoresPorSala) / n_salas`. Para indicadores cuya semántica es "Promedio [X] por familia", la media correcta sería ponderada por # familias por sala (o por matrícula). Actualmente todas las salas pesan igual, incluso una sala con 3 familias respondientes y otra con 20.
- **Impacto:** el número mostrado subestima o sobrestima según el desbalance de matrícula entre salas; la magnitud del sesgo no está caracterizada — habría que medir la varianza real de la matrícula por sala.
- **Nota clave:** el ingest tiene una regla ya cableada (`ingestParvulario.mjs:572-577`) que dice "si además existe un doc VISUALIZADOR JARDÍN, ése gana sobre el promedio de salas". Es decir, ya se decidió preferir el dato reportado por el jardín sobre el promedio computado — pero la mayoría de indicadores en cuestión no tienen un tab JARDÍN correspondiente, así que quedan con la media simple.
- **Recomendación (no implementar sin decisión de negocio):** documentar explícitamente en la etiqueta del indicador que el promedio es sobre salas, no sobre familias. O ponderar por matrícula si Focus tiene ese dato accesible por sala.

### #2 — Media-de-medias explícita en Escolar I.12 / I.16
- **Dónde:** `scripts/ingestEscolar.mjs:397-403` (I.12), `416-422` (I.16)
- **Qué:** el ingest computa `per-docente = sum(TRUE)/N_módulos`, luego `valor = mean(per-docente)`. Para el indicador "% docentes que asisten a módulos formativos", la fórmula matemáticamente correcta es la misma (dos ratios que se pueden intercambiar de orden bajo asociatividad) **solo si todos los docentes tienen el mismo N_módulos**. Si un docente tiene 4 módulos disponibles y otro sólo 3, la media-de-medias pondera igual a ambos aunque el segundo tenga menos oportunidades — sesgo pequeño pero real.
- **Impacto:** probablemente irrelevante en la práctica porque N_módulos es igual para todos (CD1..CD4). Vale la pena verificar leyendo un par de planillas.
- **Recomendación:** si N_módulos es siempre 4, la media-de-medias es equivalente a `total_TRUE / (N_docentes × 4)` y no hay defecto. Confirmar por muestra.

### #3 — Denominador inconsistente entre agregadores cross-establecimiento (**el bug más pernicioso**)
Coexisten cuatro convenciones diferentes en el mismo código-base, y a veces en el mismo componente:

| Ubicación | Faltantes cuentan como… |
|---|---|
| `cumplimientoIndicadores` (`scope.js:117-131`) | **0** (denominador = aplicables) |
| `ComparadorIndicador.promedioValor` (línea 76-87) | **excluidos** (denominador = con-dato) |
| `ComparadorIndicador.ratioLogro` (línea 89-99) | **0** (denominador = aplicables) |
| `VistaConsultor.rankingItems.valor` (línea 174-183) | **excluidos** para `valor`, **0** para `ratio` |
| `VistaSostenedor.rankingItems.valor` (línea 128-150) | idem VistaConsultor |
| `SostenedorAveragePicker` (línea 37-54) | **0** implícito (usa `sum/aplicables.length` sin decrementar cuando falta) |
| Peer aggregates `useTerritorioAggregate` (`queries.js:234-238`) | **excluidos** (`mean = sumaValor / nReporters`) |

**Consecuencia:** el mismo indicador puede tener dos valores distintos en el mismo dashboard, dependiendo de por qué gráfico entró. Por ejemplo, en el Comparador el eje "% cumplimiento" (ratio) cuenta faltantes como 0, pero el eje "valor nativo" (promedioValor) los excluye — misma barra, dos números escondidos. Y el "Promedio del territorio" del drilldown Jardín/Escuela (peer aggregate) puede diferir del promedio mostrado en VistaSostenedor para la misma red, porque uno excluye faltantes y el otro no.

Si Luis está comparando dos vistas y ve dos números para el mismo indicador, esto es lo primero a verificar.

### #4 — Rounding antes de agregar
No detecté redondeos previos a la agregación. `parseCell`/`parseNum` conservan precisión de punto flotante. `formatValue` sólo se llama en render. `Math.round(x * 100)` (SostenedorAveragePicker línea 152, VistaConsultor línea 287, etc.) se aplica sólo en el label del punto, no antes de sumar.

### #5 — Estado provisional vs validado no altera cálculos
El campo `estado: 'provisional' | 'validado'` se preserva en Firestore pero **no** filtra ninguna agregación. Docs provisionales pesan igual que validados en promedios. Esto es intencional según lo que veo en la UI, pero vale la pena tener presente si el cliente pregunta por qué un número "cambió" cuando en realidad un doc pasó de provisional a validado sin afectar el número.

### #6 — Peer aggregate vs `cumplimientoIndicadores`
El drilldown Jardín/Escuela muestra "Promedio del territorio" usando `useTerritorioAggregate` (queries.js:228-261), que excluye faltantes. La VistaEscuela también muestra el % cumplimiento agregado usando `cumplimientoIndicadores`, que cuenta faltantes como 0. **Estos dos números NO son comparables** aunque estén en la misma pantalla, y no hay caption que lo advierta.

## Verification queries

Antes de tomar cualquier decisión, hago sentido correr estas tres cosas:

### A. Cuántos establecimientos "faltan" para cada indicador × año
```javascript
// Firestore: contar establecimientos aplicables sin doc vs con doc, por indicador × año
// (Correr manualmente en la consola del navegador logueado como superadmin, o adaptar
//  como script Node con Admin SDK — este es diagnóstico read-only.)
const inds = catalog.indicadores.parvulario;  // o .escolar2026
for (const ind of inds) {
  const aplicables = todos.filter(e => isAplicable2026(ind, e, 12));
  const conDato = aplicables.filter(e => valoresPorEst.get(e.id)?.has(ind.id));
  console.log(`${ind.id} ${ind.unidad.padEnd(10)} ${conDato.length}/${aplicables.length} con dato`);
}
```
Sirve para dimensionar cuánto se mueve un número cuando cambias "faltantes=0" a "faltantes=excluidos".

### B. Comparar valor de I.43 entre agregado por jardín y promedio de salas (Parvulario)
```bash
# En terminal, con service-account:
node -e "
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
initializeApp({ credential: cert(require('./scripts/service-account.json')) });
const db = getFirestore();
(async () => {
  const snap = await db.collection('resultados_real')
    .where('programa', '==', 'parvulario')
    .where('indicadorId', '==', 'I.43')
    .where('anio', '==', 2026)
    .get();
  // Group by establecimientoId, print agregado (sin nivel) vs promedio de salas (con nivel)
  const porEst = new Map();
  for (const d of snap.docs) {
    const data = d.data();
    if (!porEst.has(data.establecimientoId)) porEst.set(data.establecimientoId, { agg: null, salas: [] });
    if (data.nivel) porEst.get(data.establecimientoId).salas.push(data.valor);
    else porEst.get(data.establecimientoId).agg = data.valor;
  }
  for (const [est, { agg, salas }] of porEst) {
    const meanSalas = salas.length ? salas.reduce((a,b) => a+b, 0) / salas.length : null;
    console.log(est.padEnd(30), 'agg=', agg, 'meanSalas=', meanSalas, 'nSalas=', salas.length);
  }
})();
"
```
Si `agg === meanSalas` en todos los casos → el agregado ES la media de salas (comportamiento actual). Si difieren para algún jardín → hay otra fuente ganando (VISUALIZADOR JARDÍN reportado directamente, dedup línea 574 de ingest).

### C. Reproducir la queja de Luis en dos vistas
Loguearse como Luis (`lagurto@focus.cl`, superadmin), abrir el Comparador para I.24 (parvulario) con Grupo A = "Todos los sostenedores · 2026". Anotar el número que muestra la barra en el modo "valor nativo" (esperado: 43.0%). Después cambiar el eje a "% cumplimiento" (indicadorFocal = "TODOS"). El mismo indicador debería mostrar ~70.3%. **Confirmación numérica del Hallazgo #3.**

Ya ejecutado: ver `scripts/diagnoseAveragingConsistency.mjs`. Correr con:
```bash
node scripts/diagnoseAveragingConsistency.mjs --programa=parvulario --indicador=I.24 --anio=2026
node scripts/diagnoseAveragingConsistency.mjs --programa=parvulario --indicador=I.17 --anio=2026
node scripts/diagnoseAveragingConsistency.mjs --programa=parvulario --indicador=I.19 --anio=2026
```

## Qué NO hago aquí

- No modifico `cumplimientoIndicadores` — es acuerdo cerrado con cliente.
- No corrijo la media-de-medias en el ingest — sería una decisión de negocio (¿queremos ponderar por matrícula? ¿por # familias respondientes? Focus tiene que responder eso).
- No armonizo los denominadores de las 7 funciones del hallazgo #3 — implicaría cambiar el número mostrado en producción sin decisión del cliente.
- No re-etiqueto los indicadores para reflejar "promedio sobre salas, no sobre familias" — es una decisión editorial que Luis debe validar.
