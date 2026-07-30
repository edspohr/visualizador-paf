# Índice de documentación · docs/

Convención: **los archivos vigentes** describen el estado actual de la plataforma y son fuentes confiables. **Los archivos históricos** conservan la memoria del proceso pero pueden describir estructuras ya reemplazadas — leerlos con la fecha en mente.

Referencia rápida en el `README.md` de la raíz.

---

## Vigentes · leer estos primero

### Estado de la plataforma

- **`informe-cobertura-fuentes-2026-07-30.md`** — informe único con secciones separadas Parvulario y Escolar. Describe qué datos están efectivamente llegando desde las fuentes, con las definiciones que faltan de parte de Focus al final de cada sección. **Es el documento operativo actual para cuadrar información con el cliente.**

### Ciclo cliente 2026-07-29 (Parvulario)

- **`informe-revision-2026-07-29.md`** — informe para Luis Agurto sobre las mejoras del ciclo del 29 de julio. Cubre las 7 solicitudes atendidas, hallazgos, criterios distintos aplicados, y decisiones abiertas.
- **`mapeo-parvulario-2026-07-21.md`** — reporte de mapeo Parvulario original del 21 de julio, actualizado con revisión header + crosswalk antiguo→canónico. Sirve para leer el reporte original contra la numeración actual de indicadores.

### Ciclo Escolar addendum 2026-07-30 (Escolar)

- **`informe-revision-escolar-2026-07-30.md`** — informe para Sebastián Peters sobre el addendum Escolar (E1-E10 del plan). Cubre inventario de las 466 planillas, cobertura, PII, y las 3 decisiones abiertas para Focus.
- **`escolar-coverage-manifest.md`** (y `.json`) — manifiesto de cobertura con los 5 estados por tupla (escuela × año × indicador × curso). Regenerable con `node scripts/generateEscolarCoverageManifest.mjs --with-firestore`.
- **`escolar-metas-discrepancy.md`** — 25 discrepancias de meta entre catálogo 2025 y canónico 2026, por revisar con Sebastián.
- **`escolar-2025-consolidated-import.md`** (y `.json`) — resumen de la importación del consolidado 2025 (Base Vertical, RBD ↔ nombre escuela, catálogo 2025). Incluye la nota de compliance sobre datos estudiantiles.
- **`mapeo-escolar-2026-07-29.md`** — snapshot del análisis inicial Escolar. Superado en detalle por el manifiesto de cobertura, se conserva como referencia del proceso.

### Referencias externas del cliente (checked in)

- **`references-paf.docx`** — documento del cliente con las precedencias declaradas para la numeración canónica (2026-07-29).
- **`Planillas PAF Escolar.xlsx`** — índice de las 466 planillas individuales Escolar, con hyperlinks a los spreadsheets. Fuente del artefacto `src/data/escolarPlanillaIndex.json`.

---

## Histórico · registro del proceso

Todos los archivos siguientes son de fases previas al estado actual (mayo–julio 2026). **No confiar como estado vigente.** Útiles como memoria del "por qué" ciertas decisiones se tomaron.

### Era mock inicial (mayo-junio 2026)

- **`parvulario-cierre.md`** — cierre del análisis inicial Parvulario.
- **`fase-0-auditoria.md`** — auditoría inicial del proyecto.
- **`fase-a-verificacion-acceso.md`** — verificación de accesos a las planillas.
- **`fase-a-probe-output.json`** — output del probe de acceso inicial.
- **`task2-cobertura-fuentes.md`** — cobertura de fuentes en la etapa 2.
- **`task2-cobertura-matriz.md`** (`.csv`, `.json`) — matriz de cobertura pre-canonical.
- **`task2-mapeo-indicadores.md`** — mapeo inicial de indicadores.

### Etapas 3-6 de construcción del pipeline (junio-julio 2026)

- **`etapa3-ingesta-parvulario.md`** (`.json`) — primera versión de la ingesta Parvulario.
- **`etapa4-5-flip.md`** — transición entre etapas 4 y 5.
- **`etapa5-ingesta-escolar.json`** — primera versión de la ingesta Escolar (base del ingest actual).
- **`etapa6-ingesta-extendida.md`** — extensión de la ingesta para cerrar huecos (fuente del `ZERO_FALLBACK`).
- **`etapa6-bases-scji.md`** — bases de datos SCJI.
- **`etapa6-headers.md`** — análisis de headers por planilla.
- **`etapa6-indices-scan.md`** (`etapa6-indices.md`) — scan de índices Firestore.
- **`etapa6-probe-ext.md`** — probe adicional.
- **`auditoria-llenado.md`** (`.csv`, `.json`) — auditoría de llenado, base para el ingest extendido.

### Ciclo cliente 21-julio 2026 (registro histórico del ciclo de julio)

- **`informe-cambios-2026-07-21.md`** — registro de cambios del 21 de julio. Numeración pre-canonical; leer con el crosswalk del `mapeo-parvulario-2026-07-21.md` actualizado.
- **`hallazgos-cliente-2026-07-21.csv`** — hallazgos del cliente en la ronda del 21 de julio.

---

## Cómo mantener este índice

Al agregar un nuevo documento a `docs/`:

- Si es del estado actual de la plataforma (informe cliente, manifiesto, reporte de discrepancia vigente), agregarlo bajo "Vigentes".
- Si es de una fase que ya se superó (etapa X que se reemplazó, snapshot que dejó de ser referencia), agregarlo bajo "Histórico" con la fecha para que el lector sepa cuánto tiempo tiene.
- Cualquier archivo generado por script (con timestamp o hash en el nombre) puede quedar sin listar acá; los scripts que los producen ya están documentados en `CLAUDE.md`.
