# Contexto para Claude Code — Visualizador PAF Mock

## Qué es esto

Prototipo navegable de los dashboards del **Programa Aprender en Familia (PAF)** que opera Consultora Focus junto a Fundación CAP. Cliente: **Luis Agurto · Consultora Focus**. Reunión clave: **lunes 25 mayo en la tarde**.

El objetivo del mock NO es producto final. Es **validar look & feel, modelo de visualización y arquitectura de accesos** con el cliente antes de implementar en Superset + Supabase. Los datos son sintéticos pero consistentes con la estructura real de indicadores y establecimientos del programa.

## Stack

- **React 18 + Vite + Tailwind CSS + Recharts** — elegido para ser replicable 1:1 en Superset
- **Firebase Hosting** para deploy (CLI ya instalado localmente)
- **No hay backend** — datos en `src/data/*.js` con PRNG determinístico

## Estructura de datos clave

```
src/data/indicadores.js
  ├─ AMBITOS_ESCOLAR (4 ámbitos: Liderazgo, Formación, Participación, Fomento Lector)
  ├─ AMBITOS_PARVULARIO (3 ámbitos)
  ├─ INDICADORES_ESCOLAR (~27 indicadores subset de los 50 reales)
  └─ INDICADORES_PARVULARIO (~19 indicadores subset de los 53 reales)

src/data/establecimientos.js
  ├─ SLEPS (4: Los Parques, Santa Rosa, Del Pino, Santa Corina)
  ├─ ESCUELAS (5 de SLEP Los Parques, cohorte 2025-2027 — las que tienen URLs verificadas)
  ├─ JARDINES (13 distribuidos en Santa Rosa / Del Pino / Santa Corina)
  ├─ generarValorIndicador() — PRNG determinístico por (indicador, establecimiento, mes)
  ├─ calcularLogro() — valor/meta clamped [0, 1.2]
  ├─ colorSemaforo() — <60% rojo, <85% ámbar, >=85% verde (lime)
  └─ logroPorAmbito() / promedioSlepAmbito() / evolucionAmbito() — agregadores
```

## Modelo de los 5 perfiles (RLS)

Definidos en `src/lib/context.jsx → PERFILES`:

| Perfil | Vista | Alcance |
|---|---|---|
| `escuela` | VistaEscuela | 1 establecimiento (de ESCUELAS) |
| `jardin` | VistaEscuela | 1 establecimiento (de JARDINES) |
| `sostenedor` | VistaSostenedor | Toda su red de un SLEP |
| `consultor` | VistaConsultor | Vista nacional con filtros |
| `cap` | VistaConsultor | Vista nacional, mes cerrado, banner magenta |

El login es simulado (selector visual en `/src/views/Login.jsx`). El perfil se guarda en `localStorage` con clave `paf_perfil`. El header tiene un switcher que permite cambiar de perfil en cualquier momento (útil para demos).

## Paleta (NO cambiar sin avisar)

```
navy   #1A365D   — primario, títulos, header
sky    #5B9BD5   — banners, encabezados de sección
lime   #8CC63F   — accent, semáforo verde, infancia
ink    #333333   — texto principal
muted  #6B7280   — texto secundario
bg     #F4F6F7   — fondo de sección
border #E5E7EB   — bordes sutiles
```

Tailwind tiene estos colores configurados con escala 50-900 para navy/sky/lime.

## Mejoras realizadas (sesión pre-reunión 24 mayo)

1. ✅ **AmbitoCard semáforo** — punto interno centrado en `src/components/Shared.jsx`. Removido `leading-none` del contenedor flex y `block` del span; ahora usa solo `flex items-center justify-center` + `shrink-0`.
2. ✅ **Iconos del dropdown de perfil** — estandarizados a `text-navy bg-navy-50` para todos los perfiles. Antes `lime` y `sky` con `/10` opacity resultaban invisibles sobre fondo blanco.
3. ✅ **Bias sintético Del Pino y Santa Corina** — subido de `0.65/0.60` a `0.75/0.73`. Ahora aterrizan en amber ("En desarrollo") en lugar de rojo, consistente con ser cohorte más nueva (2026-2027).
4. ✅ **Vista móvil** — banner pills con `flex-wrap` en VistaEscuela y VistaSostenedor. Filas de indicadores en VistaEscuela pasan a `flex-col` en mobile y `flex-row` en `sm:` con metadata en `flex-wrap`.
5. ✅ **Logos integrados** — `logo-paf.png` en header (badge `w-20 h-20` blanco redondeado), Login (mismo badge con título a la derecha) y favicon. `logo-focus.svg` en footer con `opacity-40`.
6. ✅ **Firebase configurado y deployado** — proyecto `visualizador-paf`, URL: https://visualizador-paf.web.app. Archivos `.firebaserc` y `firebase.json` creados. Para redesployar: `npm run deploy`.
7. ✅ **"SLEP" → "Sostenedor" en UI** — todo texto visible renombrado (banners, subtítulos, leyendas de charts, KPI sublabels, dropdown de entidades). Campos internos `slep`, `idSlep`, `SLEPS` sin tocar. Patterns `.replace('SLEP ','')` actualizados a regex `/^SLEP\s+/` para display limpio.
8. ✅ **Etiqueta semáforo rojo** — `labelSemaforo` cambia `'Bajo lo esperado'` → `'En camino'` para la banda `< 0.6`. KPI card "Bajo lo esperado" en VistaConsultor actualizado a "En camino" también.
9. ✅ **Modelo de 5 perfiles** — añadido perfil `cap` (Fundación CAP, `icono: 'award'`) en `context.jsx`. Login muestra 5 cards en `lg:grid-cols-5`. `App.jsx` enruta `cap` → `VistaConsultor`. `Award` registrado en `ICONOS` de `Login.jsx` y `Layout.jsx`.
10. ✅ **Helpers temporales** — `currentMonth()` y `lastClosedMonth()` en `establecimientos.js`. `MES_ACTUAL` ahora llama `currentMonth()`. `evolucionAmbito` acepta `mesHasta` param.
12. ✅ **`IndicatorProgress` component** — `src/components/Shared.jsx`. Horizontal bar showing actual (filled, semáforo color), expected-to-date (vertical tick at computed position), and annual target (right label with Target icon). Bottom row: Actual / Esperado / Meta. Binary shows Sí/No; % formats as percentage; conteo/promedio rounds to 1 decimal. Hover `title` explains tick semantics. Used in VistaEscuela indicator detail replacing `ProgressBar`.
14. ✅ **`IndicatorDrilldown` modal** — `src/components/IndicatorDrilldown.jsx`. Click any indicator row in VistaEscuela to open. Contains: header (name, code, ámbito/tipo/semáforo badges, metadata), hero `IndicatorProgress` (large), monthly evolution LineChart (actual solid + expected dashed in gray), and sostenedor comparison table (consultor/cap only). Closes on Escape, backdrop click, or X. Mobile: full-screen, scrollable with bottom close button.
13. ✅ **`expectedValue.js`** — `src/data/expectedValue.js`. `expectedToDate(indicador, mes)` computes accrued expected value by frequency (mensual=linear, trimestral/semestral=step, anual=0 until Dec, binario=0 until midyear). `formatValue(indicador, v)` formats raw value by unit.
11. ✅ **Filtro temporal por perfil en VistaConsultor** — `effectiveMonth`: consultor → mes actual, CAP → mes cerrado anterior. Todas las agregaciones (`logroPorAmbito`) reciben `effectiveMonth`. Banner CAP: fondo magenta, título "Vista de cierre · Fundación CAP", subtítulo con "validados" en `text-lime-300`. Banner consultor: subtítulo muestra fecha dinámica del día.

## Mejoras realizadas (post-demo 25 mayo, CAP-ready)

15. ✅ **YoY toggle en VistaConsultor** — state `yoy` (boolean). Default: `true` para CAP, `false` para consultor. Toggle UI en sección de filtros. Cuando ON: ámbito cards muestran "2025: XX%" + delta en pp (cyan si positivo, red si negativo) en esquina inferior derecha. Bar chart de sostenedores agrega serie 2025 con `fillOpacity: 0.35`.
16. ✅ **Año en `generarValorIndicador`** — parámetro `anio` (default 2026) incluido en `hashSeed` para datos determinísticos por año. `biasBySlep(slep, anio)` resta 0.10 a todos los sostenedores cuando `anio === 2025`, produciendo resultados visiblemente menores. `logroPorAmbito`, `evolucionAmbito`, `promedioSlepAmbito` reciben `anio` opcional.
17. ✅ **Comparador side-by-side en VistaConsultor** — sección "Comparación entre períodos" con dos dropdowns (opciones Enero–Diciembre 2025 y 2026). Defaults: CAP → Abril 2025 vs Abril 2026; consultor → Mayo 2025 vs Mayo 2026. Layout: dos columnas de AmbitoCards + bar chart comparativo con ambos períodos como series.
18. ✅ **Decisiones no especificadas**: icono CAP = `Award` de lucide-react; comparador de períodos colocado antes de la tabla de establecimientos (mejor flujo narrativo: primero big picture → detalle); 2025 en bar chart usa mismo color con opacidad reducida (más limpio que barras de color distinto).

## Mejoras realizadas (sesión 6 — post-demo, sub-indicadores en todos los perfiles)

19. ✅ **Colores distintos por perfil** — Login usa `PERFIL_ACCENT` keyed by `p.id` (no `p.color`). Layout dropdown usa `PERFIL_ICON_STYLE` por `p.id`. Escuela=cyan, Jardín=yellow, Sostenedor=magenta, Consultor=purple-1, CAP=red.
20. ✅ **Consultor card corregida** — Nombre cambiado a `'Consultor'` (sin "/CAP"). Descripción: `'Coordinación Focus'`.
21. ✅ **YoY siempre visible** — Toggle eliminado. AmbitoCards en VistaConsultor siempre muestran "2025: XX%" + delta en pp en esquina inferior. Bar chart de sostenedores siempre incluye serie 2025.
22. ✅ **Comparador de períodos colapsable** — Envuelto en componente `Collapsible` (`defaultOpen=false`). Se expande/colapsa con chevron. Consultor y CAP pueden comparar cualquier mes/año contra otro.
23. ✅ **`IndicatorPanel` extraído a componente compartido** — `src/components/IndicatorPanel.jsx`. Props: `INDS, AMBITOS, establecimientoId, slep, mes, onDrilldown`. Cada ámbito es colapsable; cada indicador muestra metadata + `IndicatorProgress` y abre drilldown al hacer clic.
24. ✅ **Sub-indicadores en VistaConsultor y CAP** — `EstablecimientoList` renderiza cada establecimiento como fila colapsable; cuando se abre, muestra `IndicatorPanel` con el filtro correcto por establecimiento.
25. ✅ **Sub-indicadores en VistaSostenedor** — Ranking de establecimientos ahora colapsable. Al expandir cada fila, muestra `IndicatorPanel`. `drilldown` state es `{ ind, estId, slepId }`. `IndicatorDrilldown` renderizado al final.
26. ✅ **Sub-indicadores en VistaEscuela** — Inline loop reemplazado por `<IndicatorPanel>`. Imports `TipoBadge, IndicatorProgress` removidos de VistaEscuela (ahora están solo en IndicatorPanel y Shared).

## Mejoras realizadas (2026-06-21 — Phase 1: Data foundation)

27. ✅ **Enriquecimiento de establecimientos (1A)** — `src/data/establecimientos.js`. Cada `ESCUELA` y `JARDIN` ahora incluye: `comuna` (round-robin sobre las comunas del SLEP), `nNinos` (PRNG: escuelas 200–600, jardines 40–120), `nAgentes` (PRNG: 15–40 / 6–15), `consultorEmail` (uno de tres placeholders, PRNG determinístico). Función `anioImplementacion(est, anio)` exportada: retorna año de implementación 1-based clamped al rango de la cohorte. Agregado `JAR-014` (Jardín Los Alamos, SLEP-LP) para que Los Parques tenga ambos tipos y el toggle sostenedor escuela/jardín sea demostrativo en todos los SLEP. Guards `sin_meta` añadidos en `logroPorAmbito`, `evolucionAmbito` y `promedioSlepAmbito` (indicadores con `metaNum:null` se excluyen del ratio).
28. ✅ **Catálogo completo de indicadores (1B)** — `src/data/indicadores.js`. Reemplazado el subset por el catálogo completo: **50 escolar** (leídos de "Matriz Única" en `matriz_unica_PAF Escolar.xlsx`) y **54 parvulario** (leídos de `Sistema indicadores TDC PAF Parvulario.xlsx`). Schema nuevo: `{ id, ambito, actividad, nombre, tipo, meta, metaNum, unidad, frecuencia, fuente, clasificacion }`. `clasificacion ∈ {'estrategia','producto'}`. Nombres AMBITOS_ESCOLAR alineados a la matriz. Indicadores solo-2025 (E.5, E.6, E.18–E.22, E.48–E.50) marcados `unidad:'sin_meta', metaNum:null`. Parvulario: E1→A1, E2→A2, E3–E6→A3; Productos P1→A1, P2→A2, P3+P4→A3.

## Mejoras realizadas (2026-06-21 — Phase 2: Remove ámbito-aggregation UI)

29. ✅ **Eliminación de UI de agregación por ámbito** — Per instrucción del cliente (Luis): "eliminar los índices que agrupan por ámbito y el gráfico asociado". Removido de las tres vistas:
    - **VistaEscuela**: eliminados KpiCards "Mejor ámbito" y "Ámbito crítico"; eliminada la sección "Logro por ámbito" (AmbitoCard grid); eliminado LineChart de evolución mensual; eliminado BarChart comparativo vs sostenedor. Conservado: KpiCard "Logro global" + IndicatorPanel.
    - **VistaSostenedor**: eliminados KpiCards "Mejor ámbito" y "Ámbito crítico"; eliminada la sección "Logro por ámbito (red completa)" (AmbitoCard grid); eliminado RadarChart vs otros sostenedores. Conservados: KpiCards "Establecimientos" y "En meta" + lista de establecimientos colapsable.
    - **VistaConsultor**: eliminados KpiCards "Mejor ámbito", "Ámbito crítico" y "Mayor avance YoY"; eliminada sección "Logro nacional por ámbito" (AmbitoCard grid + YoY); eliminado BarChart comparativo entre sostenedores; eliminado Collapsible "Comparación entre períodos" (comparador de ámbitos). Conservados: KpiCard "Establecimientos" + filtros + lista de establecimientos colapsable.
    - Imports limpiados: `AmbitoCard`, `BarChart`, `LineChart`, `RadarChart` y componentes relacionados removidos de los tres archivos. `PageHeader`, `Collapsible`, `ProgressBar`, `PERIOD_OPTIONS`, `buildPeriodOptions`, `logrosNacionales`, `porSlep`, `ambitoColors` también eliminados.

## Mejoras realizadas (2026-06-22 — Phase 3: Indicator display, peer bars, glossary)

30. ✅ **`promedioTerritorioIndicador` helper (3A)** — `src/data/establecimientos.js`. Promedia el valor RAW de un indicador sobre los establecimientos del mismo `slep` Y `tipo` (Escuela vs Jardín), devuelve `null` para `sin_meta`. Escuelas comparan con escuelas, jardines con jardines, del mismo territorio.
31. ✅ **`IndicatorProgress` reescrito (3B)** — `src/components/Shared.jsx`. Nueva firma: `{ indicador, valor, promedioTerritorio, large }`. Dos barras horizontales en escala compartida (max = metaNum): barra 1 "Este establecimiento" (cyan), barra 2 "Promedio del territorio" (gray-light). Footer: "Meta anual" con ícono Target + "Actualización: {frecuencia}". Sin colores de semáforo, sin etiquetas de juicio ("en meta", etc.), sin tick "Esperado" ni uso de `expectedToDate`.
32. ✅ **`IndicatorPanel` actualizado (3C)** — `src/components/IndicatorPanel.jsx`. Computa `promedioTerritorioIndicador` por fila y lo pasa a `IndicatorProgress`. Removidos `TipoBadge` y `SemaforoBadge` a nivel de fila e indicador; encabezado de ámbito muestra solo `codigo + nombre + % redondeado`. Mantiene Actividad, Fuente, Frec.
33. ✅ **`IndicatorDrilldown` actualizado (3D)** — `src/components/IndicatorDrilldown.jsx`. Hero: `IndicatorProgress` con dos barras (peer territory average). LineChart: "Este establecimiento" (cyan sólido) vs "Promedio del territorio" (gray); removida línea "Esperado" y todo uso de `expectedToDate`. Removidos `TipoBadge` y `SemaforoBadge` del header. Tabla de sostenedores (consultor/cap): columnas Sostenedor | Promedio; removida columna "Esperado" y badges de estado.
34. ✅ **`Glosario` (3E)** — `src/components/Glosario.jsx`. Acordeón colapsable (expandible con ícono `BookOpen`). 12 siglas: pp, AE, BV, CAUE, EFE, IF, JI, MFC, MPC, PAF, PEI, PME. Renderizado al final de VistaEscuela, VistaSostenedor y VistaConsultor (cubre los 5 perfiles). Neutral, tokens de marca.

## Mejoras realizadas (2026-06-22 — Phase 4: Indicadores de producto section)

35. ✅ **Sección "Indicadores de producto" en `IndicatorPanel`** — `src/components/IndicatorPanel.jsx`. Los indicadores se dividen por `clasificacion`: primero los 32/34 de estrategia (agrupados por ámbito colapsable, igual que antes); luego una sección separada "Indicadores de producto" (encabezado con ícono `Package` magenta + línea divisora) con los 18/20 de producto agrupados del mismo modo por ámbito. La lógica de `AmbitoGroup` se extrajo a un componente interno para evitar duplicación. Las claves de estado para grupos producto llevan prefijo `prod-` para no colisionar con los de estrategia. Aplica a los 5 perfiles sin cambios en las vistas.

## Mejoras realizadas (2026-06-22 — Phase 5: Executive ranking + indicator picker)

36. ✅ **`IndicatorRanking` (5A)** — `src/components/IndicatorRanking.jsx`. Muestra top-3 ("Mayor desarrollo") y bottom-3 ("Menor desarrollo") indicadores por ratio de logro. Cada ítem: nombre, código ámbito, valor vs meta anual (`formatValue`), frecuencia. Sin colores de juicio. El llamador pre-computa `[{ indicador, valor, ratio }]` y excluye `sin_meta`.
37. ✅ **`IndicatorAveragePicker` (5B)** — `src/components/IndicatorAveragePicker.jsx`. Dropdown de indicadores elegibles + BarChart horizontal (recharts) en color cyan con el promedio por entidad. `breakdownBy='establecimiento'` promedia por establecimiento; `breakdownBy='sostenedor'` agrupa por SLEP. Muestra meta anual + frecuencia arriba del gráfico.
38. ✅ **Integración en las 3 vistas (5C)**:
    - **VistaEscuela**: `IndicatorRanking` entre el KPI global y el panel de detalle, calculado para el establecimiento actual.
    - **VistaSostenedor**: `IndicatorRanking` (promedio de la red) + `IndicatorAveragePicker breakdownBy='establecimiento'` antes de la lista de establecimientos. `useMemo` para `rankingItems`.
    - **VistaConsultor**: `IndicatorRanking` (promedio del conjunto filtrado) + `IndicatorAveragePicker` con `breakdownBy` dinámico: `'sostenedor'` cuando filtro TODOS, `'establecimiento'` cuando filtrado a un SLEP. `conLogros` también memoizado.

## Mejoras realizadas (2026-06-22 — Phase 6: Filters, toggle, single-color bars)

39. ✅ **Filtros ampliados en VistaConsultor (6A)** — `src/views/VistaConsultor.jsx`. Añadidos dos filtros nuevos: "Año de implementación" (opciones Año 1 / Año 2 según `anioImplementacion(est, anio)`, determinado por mes de cierre) y "Comuna" (valores distintos de `est.comuna` ordenados alfabéticamente). Los 4 filtros (Sostenedor, Cohorte, Año, Comuna) se combinan en AND dentro del `filtrados` useMemo. Layout del panel de filtros cambiado a `grid-cols-2 sm:grid-cols-4`. Import de `anioImplementacion` añadido.
40. ✅ **Toggle Escuela / Jardín en VistaSostenedor (6B)** — `src/views/VistaSostenedor.jsx`. Estado `tipoActivo` ('escolar'|'parvulario') inicializado en 'escolar'. Toggle de dos botones con fondo cyan activo aparece solo cuando el SLEP tiene ambos tipos (`tieneAmbos`). Cambiar tipo resetea `openEst`. AMBITOS/INDS/establecimientos derivados de `programaTipo`. Título de sección cambiado a "Detalle por escuela y/o jardín infantil". Todos los hooks llamados antes del early return.
41. ✅ **Barras de un solo color (6C)** — `VistaConsultor.jsx` y `VistaSostenedor.jsx`. `SemaforoBadge` removido de las filas de resumen de establecimientos en ambas vistas (badge semáforo tricolor eliminado). Import de `SemaforoBadge` removido de ambos archivos. El logro global se muestra solo como número, sin indicador de color.

## Mejoras realizadas (2026-06-22 — Phase 7: Per-indicator comparator)

42. ✅ **Comparador por indicador en VistaConsultor (7)** — `src/views/VistaConsultor.jsx`. Sección colapsable "Comparación por indicador" (`defaultOpen=false`, encabezado con ícono `GitCompareArrows` cyan). Dos grupos independientes A (cyan) y B (magenta) con 6 selectores cada uno: Mes, Año, Sostenedor, Cohorte, Año de implementación, Comuna, y control de ámbito ("Todos" o un ámbito específico). `computeSideData` promedia `calcularLogro` (0–100%) por indicador sobre los establecimientos que coinciden con los filtros del lado, usando `generarValorIndicador(ind, e.id, e.slep, mes, year)`. `chartData` fusiona las listas A y B por id de indicador (unión de ids, `null` si un lado no cubre ese indicador). Gráfico de barras agrupadas horizontal (recharts): dos barras por indicador, A=cyan, B=magenta, alturas dinámicas. Leyenda dinámica generada por `buildLabel`. Defaults: A → mes actual, año actual; B → mismo mes, año anterior. `filtrarEstablecimientos` y `buildLabel` son funciones module-level para evitar recreación. Todos los hooks dentro de `ComparadorIndicador` respetan las reglas. Aplica solo a perfiles consultor y CAP (ambos usan VistaConsultor).

## Mejoras realizadas (2026-06-22 — Phase 8: Fundación totals + coordinator grouping)

43. ✅ **Tira de totales (8A)** — `src/views/VistaConsultor.jsx`. Cuatro `TotalCard` (Establecimientos, Niños y niñas, Agentes educativos, Comunas) en grid 2×2 / 4-col que reemplazan el único `KpiCard`. Cada card: ícono en `bg-cyan-50`, valor grande, sublabel. Los valores se computan con `useMemo` sobre `filtrados` (reactivo a los 4 filtros). `TotalCard` es un componente local. Niños = suma `nNinos`; Agentes = suma `nAgentes`; Comunas = `Set` de `est.comuna`. Aplica a perfil consultor y CAP.
44. ✅ **Agrupación por consultor (8B)** — `src/views/VistaConsultor.jsx`. Estado `agruparConsultor` (boolean, default `false`). Botón toggle en el encabezado de la lista con íconos `ToggleLeft`/`ToggleRight` y borde cyan cuando activo. `EstablecimientoList` recibe `agruparConsultor`; cuando ON agrupa `conLogros` por `consultorEmail` (o 'Sin asignar'), ordena grupos por promedio descendente, y muestra un collapsible por grupo (encabezado: email + conteo + promedio del grupo). Dentro de cada grupo se renderizan las filas individuales vía `EstRowItem` (lógica de fila extraída para reutilización). El drilldown sigue funcionando a través del prop `onDrilldown`. El estado `openEst` (filas abiertas) se comparte entre vista plana y agrupada.

## Cosas pendientes

- **1-pager de modelo de datos** — Doc/PDF con las 3 tablas principales para llevar a la reunión (se trabaja en Claude chat por separado).

## Cosas que NO tocar sin pensar

- El cálculo del agregado por ámbito (`logroPorAmbito`) — es la fórmula que vamos a defender en la reunión: `AVG(min(1, valor/meta))` sobre los indicadores del ámbito.
- La distinción operativo/táctico — viene de la matriz_única real del cliente.
- La jerarquía Cohorte / Año implementación / SLEP / Establecimiento / Sala — es lo que pide Luis en su correo del 12 may.

## Cómo correr local

```bash
npm install
npm run dev          # http://localhost:5173
```

## Cómo deployar a Firebase Hosting

```bash
firebase login       # solo primera vez
npm run deploy       # build + firebase deploy --only hosting
```

**URL:** https://visualizador-paf.web.app — proyecto `visualizador-paf`, ya configurado.

## Roadmap del proyecto (contexto general)

- Hito 1 ✅ — Kickoff y arquitectura (22 abril)
- Sprint 1+2 (en curso retroactivo) — Auditoría de Sheets + modelo de datos
- **Sprint 3 (cierre 29 may)** — Dashboards funcionales + RLS configurado → Hito 2 cobrable
- Sprint 4 (2-13 jun) — Landing, QA, manuales
- Cierre (16-19 jun) — Capacitación + acta de cierre → Hito 3 cobrable

Este mock es para **anticipar la validación de Sprint 3 antes de la fecha contractual**.

## Stack productivo final (no este mock)

- **Supabase (PostgreSQL)** como BD operacional + RLS nativo
- **Apps Script + Cloud Run** como pipeline desde los ~149 Google Sheets activos
- **Superset en elest.io** como capa de visualización analítica
- **Hashing SHA-256 de RUTs** antes de cargar (decisión técnica de privacidad)

Decisiones que aún están abiertas con el cliente:
- Confirmación del enfoque "agregado por ámbito" como semáforo de portada (lo defendemos en la reunión)
- Validación de la matriz_única como mapeo RLS definitivo
- Aprobación del hashing de RUTs como solución a privacidad de menores
