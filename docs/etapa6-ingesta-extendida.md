# Etapa 6 — Ingesta extendida

**Fecha:** 2026-07-08
**Modo:** dry-run → escritura. Cero cambios en el app, cero cambios de flag,
cero PII persistida.
**Identidad:** `firebase-adminsdk-fbsvc@visualizador-paf.iam.gserviceaccount.com` — verificada.
**Script:** [scripts/ingestExtended.mjs](../scripts/ingestExtended.mjs).
**Idempotente:** doc IDs deterministas `prefix_<estId>_<indId>_<periodo>` + `merge:true`.

## Cierre del gap `existe+no-mostrado ∩ confirmada`

|                              | Antes de Etapa 6 | Después de Etapa 6 | Δ       |
|------------------------------|-----------------:|-------------------:|--------:|
| existe+mostrado              |              970 |          **1.493** | +523    |
| **existe+no-mostrado**       |            1.957 |          **1.434** | **−523**|
| no-existe                    |              315 |                315 | 0       |
| no-accesible                 |               50 |                 50 | 0       |
| **Total**                    |            3.292 |              3.292 | 0       |

**Cobertura del dato existente**: 33% → **51,7%** (existe+mostrado / (existe+mostrado + existe+no-mostrado)).

Por track:

| Track       | Antes | Después | Cobertura (mostrado/existente) |
|-------------|------:|--------:|-------------------------------:|
| Escolar     |   499 | **678** | 678 / 1.046 = **64,8%**        |
| Parvulario  |   471 | **815** | 815 / 1.881 = **43,3%**        |

## Qué se escribió

**770 documentos upserted a `resultados_real`**, todos idempotentes:

- **425 validado** — lectura directa 1-a-1 de la fuente.
- **345 provisional** — valor agregado (promedio sobre salas del jardín) desde `CONSOLIDADO SALAS` / `CONS NIVEL SALAS`. Marcados así para que la UI los muestre con el badge "provisional" que se activó en la etapa anterior.

**Distribución por ruta:**

- **Ruta A · Parvulario Centrales (extendido) — 549 docs**:
  - Central 2025-2026 · 2025 · INDICAD0RES CONSULTOR: 15
  - Central 2025-2026 · 2025 · INDICADORES COORDINADOR: 93
  - Central 2025-2026 · 2025 · CONSOLIDADO (salas, agregado): 90
  - Central 2025-2026 · 2026 · CONSOLIDADO JARDÍN (extendido): 49
  - Central 2025-2026 · 2026 · CONSOLIDADO SALAS (extendido, agregado): 165
  - Central 2026-2027 · 2026 · CONS. NIVEL JARDÍN (extendido): 23
  - Central 2026-2027 · 2026 · CONS NIVEL SALAS (extendido, agregado): 90
  - Central 2025-2026 · 2026 · COORDINADOR: 15
  - Central 2026-2027 · 2026 · COORDINADOR: 9
- **Ruta B · Escolar 2025 pivote (`Base Vertical`) — 221 docs**:
  - 5 escuelas cohorte 2025-2027 × ~44 indicadores, agregados por escuela × indicador (promedio sobre cursos).

**Delta neto en el gap**: 523 celdas pasaron de `existe+no-mostrado` a `existe+mostrado`. Las
247 restantes que emití eran re-escrituras idempotentes de cells que ya estaban en `resultados_real`
(mismo valor, `merge:true` los deja intactos).

## Qué NO se escribió y por qué

### 1.370 celdas siguen en `existe+no-mostrado ∩ confirmada`

| Origen                                                    | Rows | Diagnóstico                                                                                                                             |
|-----------------------------------------------------------|-----:|------------------------------------------------------------------------------------------------------------------------------------------|
| Parvulario · Planilla Central genérica                    |  588 | Indicadores como **I.3, I.13, I.33, I.34, I.36, I.37, I.38** que la matriz Etapa 2 asignó a "Planilla Central" **no aparecen como columna** en las Centrales 2026 (solo en la 2025 · INDICAD0RES CONSULTOR). La ubicación registrada por Etapa 2 fue genérica; en la práctica, la fuente 2026 no expone esos números. Requiere confirmación con Luis: ¿esos indicadores 2026 están en otra tab que no probamos, o el 2026 realmente no los reporta? |
| Parvulario · tabs por curso (Jardín-source)               |  478 | 25 indicadores × ~20 jardines. Los workbooks Jardín individuales existen y son accesibles (ver auditoría), pero ninguna ingesta los ha leído todavía. Los tabs contienen PII (RUT/nombre); el pipeline debe agregar en memoria por sala → jardín y descartar identificadores. **Pipeline nuevo pendiente.** |
| Escolar 2026 · Registro Coordinación tabs por curso       |  150 | El MAP existe en `ingestEscolar.mjs` (Etapa 5) — cubre I19, I20, I21, I26, I27, I28, I40, I41, I47. Los rows aparecen `existe+no-mostrado` porque las columnas están estructuradas pero **vacías** en las planillas actuales (semestre en curso). Re-correr no cambia nada; se llenan cuando Focus llene las planillas. |
| Escolar 2026 · Encuesta apoderados                        |  108 | Tab estructurada pero vacía por diseño: I22, I29–I31, I42–I46 se levantan en el 2° semestre. `ingestEscolar.mjs:594` (`ENCUESTA_INDS`) ya lo documenta. No se toca hasta que la encuesta se aplique. |
| Escolar 2025 · pivote (residuo)                           |   21 | Filas en `Base Vertical` con `Valor Numerico` vacío pero `Valor` con "SI"/texto no numérico para indicadores no binarios. `parseCell` los rechaza correctamente. |
| Escolar 2026 · Datos Consultor / sub-workbook por curso   |   25 | I48 (nota promedio formación), I26 (monitores formados) y variantes — `ingestEscolar.mjs` los lee pero devolvieron `null` en esta corrida. Fuente sin llenar. |

### 64 celdas en `existe+no-mostrado ∩ inferida` — sin cambio

Son los **22 indicadores Escolar 2026 "Sin especificar"** (§4 de [task2-mapeo-indicadores.md](task2-mapeo-indicadores.md))
× 18 escuelas = 396 celdas totales, de las cuales 332 ya se muestran (parcialmente ingresados por
Etapa 5) y 64 siguen sin mostrar. **NO se tocan en este run** por regla del prompt: la propuesta de
columna es inferida y espera confirmación de Sebastián.

### 315 no-existe / 50 no-accesible — sin cambio

- **175 Parvulario no-existe** = 7 workbooks Jardín cohorte 2026-2027 (Paula Jaraquemada, Cedin,
  Eluney, Sueño De Colores, Tierra De Angeles, Salomón Sack, El Tranque) que **no se han creado
  desde el template**. Luis los debe crear.
- **140 Escolar no-existe** = 5 indicadores genuinamente ausentes (I10, I13, I14, I39, I49)
  × 18 escuelas + 50 rows Escolar 2025 sin fuente cruda. Decisión producto de Sebastián + Focus.
- **50 Parvulario no-accesible** = 2 workbooks (La Hormiguita 2025, Caballito Feliz 2026) que
  Luis debe compartir con la SA.

## Verificación

Comando ejecutado:

```
node scripts/auditFill.mjs
```

Salida:

```
Global:
  existe+mostrado    1493   (+523)
  existe+no-mostrado 1434   (−523)
  no-existe           315   (0)
  no-accesible         50   (0)

Escolar:
  existe+mostrado    678   (+179)
Parvulario:
  existe+mostrado    815   (+344)
```

`existe+no-mostrado ∩ confirmada` = **1370** (era 1893) — bajó **523** en línea exacta con lo emitido.

## Distribución del trabajo restante

- **Luis (Parvulario)** —
  - Crear **7 workbooks Jardín** cohorte 2026-2027 desde template → cierra 175 rows `no-existe`.
  - **Compartir 2 workbooks Jardín** (La Hormiguita 2025, Caballito Feliz 2026) con la SA → cierra 50 rows `no-accesible`.
  - Confirmar si los indicadores I.3, I.13, I.33, I.34, I.36, I.37 tienen tab/columna en las
    Centrales 2026 fuera de las que ya se probaron → 588 rows Parvulario 2026 podrían cerrarse.
- **Focus (pipeline)** — implementar la ingesta Jardín-source (25 indicadores × 20 workbooks
  Jardín, agregación por sala → jardín con PII descartada) → cierra 478 rows Parvulario.
- **Sebastián (Escolar)** — confirmar 22 mapeos "Sin especificar" propuestos en §4 de la Etapa 2 →
  cierra 64 rows `existe+no-mostrado ∩ inferida`. Es una revisión, no una tarea de datos.
- **Focus (Escolar planillas)** — completar Registro Coordinación tabs por curso + Encuesta
  apoderados 2do semestre → cierra 258 rows Escolar `existe+no-mostrado ∩ confirmada` estructural.

## Seguridad y trazabilidad

- El flag `config/dataSource` NO se movió; los tracks siguen en `real`. Cada uno de los 770 docs
  entró en vivo al re-render de la app.
- Todas las escrituras usan `merge: true` con doc IDs deterministas
  (`{prefix}_{establecimientoId}_{indicadorId}_{periodo}`). Re-correr no duplica ni corrompe.
- Los 345 valores `provisional` (agregados sobre salas) se muestran con badge muted en la UI
  gracias al soporte P1 agregado en la sesión anterior.
- Cero PII persistida ni logueada. Este script no lee tabs con RUTs/nombres de estudiantes.

## Archivos

- [scripts/ingestExtended.mjs](../scripts/ingestExtended.mjs) — script (con `--dry-run`).
- [docs/etapa6-headers.md](etapa6-headers.md) — headers descubiertos por el probe de columnas.
- [docs/auditoria-llenado.md](auditoria-llenado.md), `.csv`, `.json` — matriz actualizada después de la escritura.
