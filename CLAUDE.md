# Contexto para Claude Code — Visualizador PAF Mock

## Qué es esto

Prototipo navegable de los dashboards del **Programa Aprender en Familia (PAF)** que opera Consultora Focus con financiamiento de Fundación CAP. Cliente: **Luis Agurto · Consultora Focus**. Reunión clave: **lunes 25 mayo en la tarde**.

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

## Modelo de los 4 perfiles (RLS)

Definidos en `src/lib/context.jsx → PERFILES`:

| Perfil | Vista | Alcance |
|---|---|---|
| `escuela` | VistaEscuela | 1 establecimiento (de ESCUELAS) |
| `jardin` | VistaEscuela | 1 establecimiento (de JARDINES) |
| `sostenedor` | VistaSostenedor | Toda su red de un SLEP |
| `consultor` | VistaConsultor | Vista nacional con filtros |

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

## Cosas pendientes

- **1-pager de modelo de datos** — Doc/PDF con las 3 tablas principales para llevar a la reunión (se trabaja en Claude chat por separado).
- **VistaConsultor filtro a 1 SLEP** — el BarChart queda solitario pero se decidió dejarlo así: en un mock es mejor mostrar el dato que ocultar el chart.

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
