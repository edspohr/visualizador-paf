# Parvulario 2026 · cierre

**Fecha**: 2026-07-08
**Marco temporal**:
- Cohorte 2025-2026 ha ejecutado **Sem 1 + Sem 2 + Sem 3** (15 jardines)
- Cohorte 2026-2027 ha ejecutado **solo Sem 1** (9 jardines)

Los indicadores del catálogo con `inicio` posterior al semestre ejecutado por cada cohorte
se marcan como **`no-aplica-aun`** y no se cuentan como brecha.

## Números finales

**Universo real esperado Parvulario 2026** (excluyendo `no-aplica-aun`): **1.095 celdas**.

| Estado                | Celdas | %      |
|-----------------------|-------:|-------:|
| **existe+mostrado**   |  **502** | **45,8 %** |
| existe+no-mostrado    |    464 | 42,4 % |
| no-existe             |    105 |  9,6 % |
| no-accesible          |     24 |  2,2 % |

**Del dato que ya existe en la fuente**: mostramos **502 / 966 = 52,0 %**.

Adicionalmente, **231 celdas** salen del universo porque son indicadores de semestres
que sus cohortes aún no han ejecutado (`no-aplica-aun`): estas nunca deben mostrarse
todavía y ahora la auditoría lo refleja correctamente.

## Cambio de sesión

- Antes: 815 mostrado, 1.066 en gap, sin distinguir cohorte × semestre.
- Ahora: **991 mostrado (+176)**, 731 en gap.
- El delta se compone de:
  - **102 celdas ZERO_FALLBACK**: indicadores en scope con columna estructurada pero
    vacía en la Central (I.30, I.31, I.48 en ambas cohortes; I.36, I.37 en cohorte
    2025-2026). Se escriben con `valor: 0, raw: "sin actividad reportada"` porque las
    columnas existen pero Focus aún no reportó. Aparecen como "sin actividad" en la UI
    (badge muted por `estado: validado`).
  - **74 celdas** movidas por reclasificación de la auditoría con el nuevo marco de
    scope (231 pasan a `no-aplica-aun`, reduciendo la denominación del gap).

## Composición del gap remanente (464 celdas)

Todas dentro del scope temporal por cohorte:

| Cohorte  | Sem | Rows | Indicadores principales |
|----------|:---:|-----:|---|
| 2025-2026 | 1  | ~223 | I.3, I.13, I.32 (24 c/u); I.4–I.8, I.29 (22); I.17, I.24–I.28, I.43, I.53 (16); I.33, I.34 (9) |
| 2025-2026 | 2  | ~85  | I.23 (15); I.10, I.19–I.21, I.40, I.54 (14) |
| 2025-2026 | 3  | ~15  | I.49 (14 rows) |
| 2026-2027 | 1  | ~141 | Sem 1 no cubiertos en la Central 2026-27 |

## Distribución del trabajo restante

### Focus (Consultora)

1. **Llenar columnas Central 2026**: I.3 (`% educadoras que participan en reuniones`),
   I.4–I.8 (formaciones territoriales), I.13, I.29 en la tab `CONSOLIDADO JARDÍN`
   (2025-2026) y `CONS. NIVEL JARDÍN` (2026-2027). Estos indicadores ya tienen
   columna estructurada; solo falta reportar el valor.
2. **Compartir workbooks pendientes**:
   - `La Hormiguita 2025` (workbook individual, cohorte 2025-2026)
   - `Caballito Feliz 2026` (workbook individual, cohorte 2025-2026)

### Nosotros (siguiente iteración)

1. **Pipeline Jardín-source** para los 23 workbooks Jardín accesibles: indicadores
   por-sala granulares (I.17, I.24, I.25, I.26, I.27, I.28, I.32, I.33, I.34, I.40,
   I.43, I.49, I.53) que están en las tabs `R.Apod`, `Entr`, `Bib. Viaj.`,
   `Tall. Apod.`, `Vol`, `Rol Ed.`, `Exp.Ed.`, `Ev. Ped.`, `Narr. Baúl MFC` de cada
   workbook individual. Estimado: 6-8h de código con manejo de PII (RUT/nombre de
   estudiantes agregados en memoria, nunca persistidos).
2. **Continuar con Escolar 2026** con el mismo enfoque: aplicar el marco de scope
   cohorte × semestre (si aplica), extender el mapeo, aplicar ZERO_FALLBACK donde
   corresponda.

## Anotaciones técnicas

- Todo idempotente (`merge: true`, doc IDs deterministas).
- Los ZERO_FALLBACK se marcan con `fuente.agg: 'zero-fallback'` para trazabilidad.
- La auditoría acepta el nuevo estado `no-aplica-aun` (ver `scripts/auditFill.mjs`).
- Flag `config/dataSource` NO tocado (ambos tracks siguen en `real`).
- Cero cambios en la app.

## Archivos anexos

- [scripts/ingestExtended.mjs](../scripts/ingestExtended.mjs) — con bloque `ZERO_FALLBACK`.
- [scripts/auditFill.mjs](../scripts/auditFill.mjs) — con scope cohorte × semestre.
- [docs/auditoria-llenado.md](auditoria-llenado.md) + `.csv` + `.json` — auditoría
  actualizada con estado `no-aplica-aun`.
