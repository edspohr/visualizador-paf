# Visualizador PAF — Mock para Reunión Focus

Prototipo navegable de los dashboards del **Programa Aprender en Familia**.

**URL productiva:** https://visualizador-paf.web.app

> **Para Claude Code:** revisar primero `CLAUDE.md` — tiene el contexto completo del proyecto, decisiones de diseño y estado actual.

---

## Stack

**React 18 + Vite + Tailwind CSS + Recharts** · Deploy en **Firebase Hosting** (proyecto `visualizador-paf`).

Stack elegido específicamente para ser **replicable 1:1 en Superset** después: las visualizaciones de Recharts (Bar/Line/Radar) tienen equivalente directo en Superset, y el modelo de datos sintético sigue la estructura final de `fact_indicadores` / `dim_indicadores` / `dim_establecimientos`.

---

## Cómo correr local

```bash
npm install
npm run dev
# Abre http://localhost:5173
```

---

## Cómo deployar a Firebase Hosting

```bash
# Login (solo primera vez)
firebase login

# Build + Deploy
npm run deploy
```

`.firebaserc` y `firebase.json` ya están configurados para el proyecto `visualizador-paf`.

---

## Estructura del proyecto

```
paf-mock/
├── public/
│   ├── logo-paf.png                # Logo "Aprender en Familia" (favicon + header + login)
│   └── logo-focus.svg              # Logo Consultora Focus (footer)
├── src/
│   ├── data/
│   │   ├── indicadores.js          # Catálogo de ámbitos e indicadores
│   │   └── establecimientos.js     # SLEPs, escuelas, jardines + PRNG + bias por SLEP
│   ├── lib/
│   │   └── context.jsx             # AppProvider + PERFILES + RLS simulado
│   ├── components/
│   │   ├── Layout.jsx              # Header (h-24) + switcher de perfil
│   │   └── Shared.jsx              # AmbitoCard, KpiCard, ProgressBar, SemaforoBadge, etc.
│   ├── views/
│   │   ├── Login.jsx               # Selector de perfil con logo
│   │   ├── VistaEscuela.jsx        # Vista perfil escuela/jardín (mobile-optimized)
│   │   ├── VistaSostenedor.jsx     # Vista perfil SLEP
│   │   └── VistaConsultor.jsx      # Vista perfil consultor/CAP con filtros
│   ├── App.jsx                     # Router
│   ├── main.jsx                    # Entry point
│   └── index.css                   # Tailwind + estilos base
├── tailwind.config.js              # Paleta navy/sky/lime
├── firebase.json                   # Hosting: public=dist, SPA rewrite
├── .firebaserc                     # project: visualizador-paf
├── CLAUDE.md                       # Contexto para Claude Code
└── README.md                       # Este archivo
```

---

## Datos del mock

Los datos son **sintéticos pero consistentes con la realidad del programa**:

- **Indicadores:** subset de los 50 escolares (matriz_única) + 53 parvularios (Sistema_indicadores_TDC) con metas, frecuencias y fuentes reales.
- **Establecimientos:** nombres reales — 5 escuelas SLEP Los Parques + 13 jardines (Santa Rosa, Del Pino, Santa Corina).
- **PRNG determinístico:** mismo seed = mismos números siempre. La demo es reproducible.
- **Bias por SLEP:** Los Parques 0.88 · Santa Rosa 0.82 · Del Pino 0.75 · Santa Corina 0.73. Refleja antigüedad de cohorte.

---

## Paleta

| Color | HEX | Uso |
|---|---|---|
| Navy | `#1A365D` | Primario, títulos, header |
| Sky | `#5B9BD5` | Banners, secciones |
| Lime | `#8CC63F` | Accent, semáforo verde, infancia |
| Ink | `#333333` | Texto principal |
| Bg | `#F4F6F7` | Fondo de sección |

**NO cambiar paleta sin coordinarlo** — es la paleta Growth Buddies que se trasladará a Superset.

---

## Switcher de perfil

En la esquina superior derecha hay un menú que permite cambiar de perfil sin volver al login. Útil para la demo: muestra las 3 vistas en segundos sin perder estado. El estado se guarda en `localStorage` bajo la clave `paf_perfil`.
