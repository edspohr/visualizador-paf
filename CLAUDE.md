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
