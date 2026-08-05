# Visualizador PAF

Plataforma de monitoreo en producción del **Programa Aprender en Familia** (PAF), operado por Consultora Focus junto a Fundación CAP. Cubre las dos vertientes del programa: **Escolar** (18 escuelas en 2 cohortes) y **Parvulario** (24 jardines infantiles en 2 cohortes), sirviendo a los perfiles Jardín / Escuela / Sostenedor / Consultor / CAP / Superadmin.

- **Producción:** https://visualizador-paf.web.app
- **Repositorio:** https://github.com/edspohr/visualizador-paf
- **Proyecto Firebase:** `visualizador-paf`
- **Contacto cliente (Parvulario):** Luis Agurto — lagurto@focus.cl
- **Contacto cliente (Escolar):** Sebastián Peters — speters@focus.cl

> **Para agentes / colaboradores nuevos:** leer primero `CLAUDE.md`, que documenta la arquitectura, convenciones activas, catálogos canónicos, perfiles y qué NO tocar sin coordinar.

---

## Estado actual (5 de agosto de 2026)

- **Catálogo Parvulario:** 53 indicadores canónicos (I.1–I.53), 3 ámbitos.
- **Catálogo Escolar 2026:** 51 indicadores canónicos (I.1–I.51), 4 ámbitos.
- **Datos en Firestore:** 5.010 documentos Parvulario + 502 documentos Escolar.
- **Cobertura de indicadores con datos:** Parvulario 49/53 · Escolar 30/51.
- **Cobertura de fuentes** (planillas efectivamente leídas): Parvulario 3/3 Planillas Centrales · Escolar 465/466 planillas individuales (1 link roto permanente: Sendero del Saber KA — ver informe de cobertura).
- **Perfiles funcionando:** jardin, escuela, sostenedor (queries estrechas que pasan las reglas Firestore), consultor, cap, superadmin.
- **Homologación 2025↔2026 (Escolar):** 29 pares de indicadores mapeados; el comparador alinea años automáticamente.
- **Estados de cobertura en UI:** cada fila de indicador Escolar muestra el estado del manifiesto (sin fuente, sin dato, con dato).

El estado detallado y las definiciones pendientes de Focus están en `docs/informe-cobertura-fuentes-2026-08-05.md`.

---

## Stack

- **Frontend:** React 18 · Vite · Tailwind CSS · Recharts.
- **Estado remoto:** `@tanstack/react-query` sobre Firestore.
- **Auth:** Firebase Auth (Google OAuth + email/password).
- **Persistencia:** Firestore (colecciones `resultados_real`, `progresoTrimestral_real`, `establecimientos_real`, `usuarios`, `config/*`).
- **Ingesta:** scripts Node ESM en `scripts/` que leen Google Sheets y XLSX.
- **Deploy:** Firebase Hosting.

Sin backend propio: el navegador consulta Firestore directamente con reglas RLS por perfil.

---

## Cómo correr

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # incluye guardián de tokens de color
```

## Cómo deployar

```bash
npm run deploy:rules # solo si cambió firestore.indexes.json o rules
npm run deploy       # build + firebase deploy --only hosting
```

## Cómo ingestar

```bash
npm run ingest:parvulario -- --dry-run     # dry-run desde las 3 Planillas Centrales
npm run ingest:parvulario                  # escribe a Firestore
npm run ingest:escolar -- --dry-run
npm run ingest:escolar
node scripts/harvestEscolar.mjs            # baja las 466 planillas individuales al cache
node scripts/generateEscolarCoverageManifest.mjs --with-firestore  # refresca manifiesto de cobertura
node scripts/piiAssertion.mjs --cache      # verifica que no haya PII en cache ni en Firestore
```

Todos los scripts que escriben soportan `--dry-run` y son idempotentes.

---

## Perfiles

Definidos en `src/lib/context.jsx`:

| Perfil | Vista | Alcance |
|---|---|---|
| `escuela` | VistaEscuela | 1 escuela del programa Escolar |
| `jardin` | VistaEscuela | 1 jardín infantil del programa Parvulario |
| `sostenedor` | VistaSostenedor | Red completa de un SLEP, con toggle escolar/parvulario cuando hay ambos |
| `consultor` | VistaConsultor | Nacional, mes en curso |
| `cap` | VistaConsultor | Nacional, mes cerrado (banner distintivo) |
| `superadmin` | Layout + admin | Todo + `/usuarios` + `/dashboard-consultores` |

Existe además `pendiente` para usuarios nuevos sin perfil asignado.

Los correos en whitelist (`espohr@gmail.com`, `lagurto@focus.cl`, `speters@focus.cl`) se autopromueven a `superadmin` en el primer login.

---

## Datos

Todo el detalle de arquitectura, fuentes, catálogos canónicos, colecciones Firestore y reglas de agregación vive en `CLAUDE.md`. Resumen operativo:

- **Fuente Parvulario:** 3 Planillas Centrales (una por cohorte-año). Ingesta vía `scripts/ingestParvulario.mjs`.
- **Fuente Escolar:** 466 planillas individuales por escuela × arquetipo × año, declaradas en `docs/Planillas PAF Escolar.xlsx`. Ingesta vía dos rutas: `scripts/ingestEscolar.mjs` (ingesta directa) y `scripts/harvestEscolar.mjs` (harvest offline resumible).
- **Catálogo:** `src/data/catalog.json`, generado por `scripts/parseCatalogs.mjs` desde XLSX en `src/data/catalogs/` + mapa canónico en `scripts/lib/canonicalIds.mjs`. **No editar `catalog.json` a mano.**
- **Fórmula de cumplimiento:** `AVG(min(1, valor/meta))` sobre indicadores aplicables con meta. Un aplicable sin valor cuenta como 0. Definida en `src/data/scope.js → cumplimientoIndicadores`.

---

## Convenciones

- **Idioma:** todo lo visible al usuario en español (es-CL). Código, comentarios y docs internos en inglés.
- **Commits:** convencionales y atómicos (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`).
- **Tokens de color:** solo via CSS custom properties (`src/index.css`). Prohibido hex crudo. `scripts/checkColorTokens.mjs` corre en `npm run build` y falla si aparecen tokens no definidos.
- **Data migrations y ingestas:** siempre `--dry-run` primero, siempre idempotentes, siempre con reporte en `reports/`.
- **PII:** ningún dato personal de estudiantes (RUT, nombre) se persiste en Firestore ni en el cache. `scripts/piiAssertion.mjs` verifica y falla si detecta cualquier fuga.
- **UI:** verificar en `npm run dev` en los 6 perfiles y en **ambas cohortes** (2025-2026 y 2026-2027 en Parvulario; 2025-2027 y 2026-2028 en Escolar) porque el scope-gating difiere.

---

## Documentación

**Vigente (leer estos primero):**

- `CLAUDE.md` — arquitectura, convenciones, catálogos canónicos, qué NO tocar.
- `docs/informe-cobertura-fuentes-2026-08-05.md` — estado actualizado de cobertura de datos al 5 de agosto (re-harvest 465/466, correcciones territoriales, W3–W4).
- `docs/informe-cobertura-fuentes-2026-07-30.md` — estado base del 30 de julio (referencia histórica).
- `docs/informe-revision-2026-07-29.md` — informe para Luis (Parvulario) del ciclo cliente de julio.
- `docs/informe-revision-escolar-2026-07-30.md` — informe para Sebastián (Escolar) del addendum de julio.
- `docs/mapeo-parvulario-2026-07-21.md` — mapeo Parvulario con crosswalk antiguo→canónico (para leer el reporte de julio contra la numeración actual).
- `docs/escolar-coverage-manifest.md` — manifiesto de cobertura Escolar en los 5 estados (NO_CORRESPONDE_AUN, SIN_FUENTE_MAPEADA, FUENTE_NO_ACCESIBLE, SIN_DATO_REPORTADO, CON_DATO_REPORTADO).
- `docs/escolar-metas-discrepancy.md` — 25 discrepancias de meta entre catálogo 2025 y canónico 2026.
- `docs/escolar-2025-consolidated-import.md` — importación del consolidado 2025 de Sebastián, con la nota de compliance sobre datos estudiantiles.
- `docs/mapeo-escolar-2026-07-29.md` — snapshot del análisis inicial Escolar (superado por el manifiesto pero conservado).

**Histórico (archivo de fases previas — no confiar como estado actual):**

- `docs/etapa*.md`, `docs/fase-*.md`, `docs/task2-*.md`, `docs/auditoria-*.md`, `docs/informe-cambios-2026-07-21.md`, `docs/hallazgos-cliente-2026-07-21.csv`, `docs/parvulario-cierre.md` — registro del proceso de construcción (mayo-julio 2026, era mock + primera ingesta real). Útiles como memoria del "por qué" pero pueden describir estructuras ya reemplazadas.

Ver `docs/README.md` para un índice más detallado.

---

## Cosas que NO tocar sin coordinar

- `src/data/scope.js → isAplicable2026` y `cumplimientoIndicadores` — son las fórmulas defendidas frente al cliente.
- La distinción `estrategia` / `producto` (indicador de ámbito vs indicador de logro) — viene del catálogo canónico.
- La numeración canónica de indicadores (ver `CLAUDE.md`) — cualquier renumeración exige migrar Firestore o re-ingestar.
- La jerarquía Cohorte / Año de implementación / SLEP / Establecimiento / Sala/Curso.
- Los overrides de nombre de ámbito en `src/lib/labels.js` — vienen de los documentos del cliente.
- La barrera de PII (`scripts/piiAssertion.mjs`) — no debilitar bajo ninguna presión de tiempo.

---

## Roadmap corto

Ver `docs/informe-cobertura-fuentes-2026-08-05.md` para el listado exacto de acciones pendientes. Puntos operativos más grandes:

- **Parvulario:** completar metadata de I.1 con Focus; resolver los 4 indicadores sin datos.
- **Escolar:** arreglar link de Sendero del Saber KA (Sebastián); identificar fuente de los 13 indicadores sin mapeo; revisar los 333 documentos marcados como provisionales; definir tratamiento comparación año-a-año.
- **Validación de perfiles:** confirmar con cuentas reales de jardin/escuela/sostenedor que las vistas cargan correctamente tras el fix de auth (W1).
