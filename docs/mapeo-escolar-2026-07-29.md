# Mapeo Escolar 2026 — cobertura vs numeración canónica (2026-07-29)

> Generado tras la renumeración canónica del catálogo Escolar 2026 (51 indicadores, I.1–I.51). Este reporte es la lectura estática del código de `scripts/ingestEscolar.mjs` — no ejecuta la ingesta en vivo.

## Contexto

El cliente confirmó el 2026-07-29 que no existe una planilla centralizada Escolar equivalente a las Planillas Centrales de Parvulario. La cobertura se construye a partir de las planillas individuales de las 18 escuelas (talleres, registros, encuestas, plan de acción, etc.) que Focus ya ha compartido, y de las adiciones de Etapa 5. Sebastián confirmó verbalmente que **toda la información necesaria está presente en las planillas ya compartidas** — este reporte muestra qué está enganchado en el código y qué no.

## Fuentes de la ingesta

`scripts/ingestEscolar.mjs` procesa 18 workbooks bajo dos carpetas Drive:

- **Cohorte 2025-2027** (año 2, 2026) — 13 escuelas.
- **Cohorte 2026-2028** (año 1, 2026) — 5 escuelas.

Por escuela lee:

- `Reuniones equipo de Gestión` → I.1, I.2, I.3, I.4, I.5.
- `Datos docentes` → I.12, I.16.
- `Formación de líderes` → I.6, I.7, I.8, I.17, I.18.
- `Modulos formativos` → I.11.
- `Formación territorial docentes` → I.15.
- `Formación apoderados monitores` → I.25.
- `Nota evaluación` (varios tabs) → I.36, I.37, I.47.
- `Plan de acción` → I.9, I.33, I.34, I.35, I.38.
- `Registro Coordinación · PKA..8B` → I.19, I.20, I.26, I.27, I.28, I.40, I.41, I.46.

Etapa 5 añade `Encuesta apoderados`, cuyas columnas para I.22, I.29, I.30, I.31, I.42, I.43, I.44, I.45 están estructuradas pero llegan mid-year sin dato, así que se documentan como "sin dato" y no como error de mapeo.

## Notas sobre la renumeración 2026-07-29

- **Eliminado**: canonical **I.46 antiguo** ("Cantidad promedio de instrumentos de fomento lector"). El catálogo bajó de 52 a 51.
- **Shift −1**: antiguos I.47–I.52 → canónicos I.46–I.51. Los IDs que aparecen abajo son ya canónicos.
- **Reclasificaciones**: I.29, I.40, I.41, I.42 cambian de `estrategia`/`producto`; I.43, I.44, I.45 se movieron de A.4 a A.3; I.48 (antiguo I.49) pasa a `producto`. Los IDs siguen coincidiendo con lo que el ingest escribe salvo los dos casos abajo.
- **Renombres aplicados en `scripts/ingestEscolar.mjs`** (para que la escritura en Firestore quede ya en canónico):
  - `'I48' → 'I47'` (nota promedio formaciones de monitores).
  - `'I47' → 'I46'` (monitores activos totales).
  - Se removió `'I46'` de `ENCUESTA_INDS` (era el antiguo indicador eliminado).

## Cobertura por indicador (canónico)

Marca `sí` en "Cubierto" cuando el indicador tiene un mapeo activo en el código de ingesta. `estructurado, sin dato` cuando la columna existe pero llega vacía (Encuesta apoderados). `—` cuando no está enganchado hoy.

| ID | Ámbito | Clasif. | Declarado | Cubierto | Nombre |
|---|---|---|---|---|---|
| I.1 | A.1 | estrategia | sí | sí | Se conforma Equipo de Gestión |
| I.2 | A.1 | estrategia | sí | sí | Número de reuniones anuales del Equipo de Gestión |
| I.3 | A.1 | estrategia | sí | sí | % asistencia anual de directores a las reuniones |
| I.4 | A.1 | estrategia | sí | sí | % asistencia de coordinadores a las reuniones de gestión |
| I.5 | A.1 | estrategia | sí | sí | Número de reuniones de coordinación |
| I.6 | A.1 | estrategia | sí | sí | Director asiste a formación de liderazgo territorial |
| I.7 | A.1 | estrategia | sí | sí | Coordinador asiste a formación de liderazgo territorial |
| I.8 | A.1 | estrategia | sí | sí | Director asiste a formación de liderazgo, por escuela |
| I.9 | A.1 | estrategia | sí | sí | Existe plan de acción familia escuela diseñado |
| I.10 | A.1 | estrategia | — | — | Existe plan de acción familia escuela actualizado |
| I.11 | A.2 | estrategia | sí | sí | Número de módulos formativos anuales en la escuela |
| I.12 | A.2 | estrategia | sí | sí | % de profesores jefe que asisten a módulos formativos |
| I.13 | A.2 | estrategia | — | — | Director asiste a módulos formativos |
| I.14 | A.2 | estrategia | — | — | Coordinador asiste a módulos formativos |
| I.15 | A.2 | estrategia | sí | sí | Número de formaciones territoriales anuales para docentes |
| I.16 | A.2 | estrategia | sí | sí | % de profesores jefe que asisten a formaciones territoriales |
| I.17 | A.2 | estrategia | sí | sí | Director asiste a formaciones territoriales |
| I.18 | A.2 | estrategia | sí | sí | Coordinador asiste a formaciones territoriales |
| I.19 | A.2 | estrategia | sí | sí | % promedio de familias entrevistadas al menos una vez |
| I.20 | A.2 | estrategia | sí | sí | % promedio de familias entrevistadas al menos dos veces |
| I.21 | A.3 | estrategia | — | — | Número de talleres para apoderados presenciales por sala |
| I.22 | A.3 | estrategia | — | estructurado, sin dato | % asistencia anual a talleres para apoderados |
| I.23 | A.3 | estrategia | — | — | Número de talleres digitales enviados por sala |
| I.24 | A.3 | estrategia | — | — | Cantidad de visualizaciones de talleres digitales |
| I.25 | A.3 | estrategia | sí | sí | Número de formaciones a apoderados monitores |
| I.26 | A.3 | estrategia | sí | sí | Número de apoderados monitores formados |
| I.27 | A.3 | estrategia | sí | sí | Número de salas cubiertas por apoderados monitores |
| I.28 | A.4 | estrategia | sí | sí | Cantidad de semanas de envío de Biblioteca Viajera por sala |
| I.29 | A.4 | estrategia | — | estructurado, sin dato | Cantidad promedio de libros de BV recibidos por estudiante |
| I.30 | A.4 | estrategia | — | estructurado, sin dato | Cantidad promedio de envío de Lecturas Viajeras por sala |
| I.31 | A.4 | estrategia | — | estructurado, sin dato | % de salas que envían Mantel de Palabras |
| I.32 | A.4 | estrategia | — | — | Número de talleres para estudiantes realizados por sala |
| I.33 | A.1 | producto | sí | sí | Director cumple meta propuesta para su liderazgo |
| I.34 | A.1 | producto | sí | sí | % de cumplimiento del plan de acción familia escuela |
| I.35 | A.1 | producto | sí | sí | Plan de acción diseñado e incorporado en PME y PEI |
| I.36 | A.2 | producto | sí | sí | Nota promedio módulos formativos |
| I.37 | A.2 | producto | sí | sí | Nota promedio formaciones territoriales |
| I.38 | A.2 | producto | sí | sí | Sistema de planificación y monitoreo de entrevistas |
| I.39 | A.3 | producto | — | — | % de Talleres para Apoderados liderados por dupla monitor-profesor |
| I.40 | A.3 | producto | sí | sí | % apoderados que participan al menos en un taller |
| I.41 | A.3 | producto | sí | sí | % apoderados que participan del 100% de los talleres |
| I.42 | A.3 | producto | — | estructurado, sin dato | % apoderados que declaran haber descargado y visualizado |
| I.43 | A.3 | producto | — | estructurado, sin dato | Promedio de libros de BV que declaran utilizar las familias |
| I.44 | A.3 | producto | — | estructurado, sin dato | Promedio de Lecturas Viajeras que declaran utilizar |
| I.45 | A.3 | producto | — | estructurado, sin dato | % apoderados que declaran utilizar el mantel de palabras |
| I.46 | A.3 | producto | sí | sí | Número de apoderados monitores que implementaron taller |
| I.47 | A.3 | producto | sí | sí | Nota promedio evaluación formación a apoderados monitores |
| I.48 | A.4 | producto | — | — | Cantidad promedio de actividades mediación BV por sala |
| I.49 | A.4 | producto | — | — | Cantidad promedio de actividades aula de Lecturas Viajeras |
| I.50 | A.4 | producto | — | — | % de salas que realizan actividad mediación Mantel de Palabras |
| I.51 | A.4 | producto | — | — | Cantidad promedio de actividades mediación post-envío mantel |

## Resumen

- **Cubiertos** (con dato o mapeo activo): **31 / 51**.
- **Estructurados sin dato** (Encuesta apoderados, tab presente pero vacía): **8**.
- **No enganchados** (indicadores del catálogo canónico sin mapeo declarado hoy): **12** — I.10, I.13, I.14, I.21, I.23, I.24, I.32, I.39, I.48, I.49, I.50, I.51.

## Hallazgos para Focus

1. Los **12 no enganchados** son en su mayoría indicadores A.4 de Fomento Lector (I.48–I.51 y I.32) y A.3 (I.21, I.23, I.24, I.39). Corresponde revisar con Sebastián:
   - Si estos indicadores existen ya en alguna planilla individual y solo falta agregar el mapeo,
   - O si se reportan por otra vía (encuesta, planilla anual, etc.).
2. Los **8 estructurados sin dato** son de la Encuesta apoderados. La expectativa es que se llenen al cierre del año escolar.
3. **I.10** ("Existe plan de acción familia escuela actualizado") es un producto que probablemente se puede derivar del mismo tab de "Plan de acción" del que hoy salen I.9, I.33, I.34, I.35, I.38 — a discutir con Sebastián.
4. Con la reasignación de I.43, I.44, I.45 al ámbito A.3, el ámbito A.4 quedó con solo 5 estrategia + 4 logro; conviene confirmar que ese conteo se sostiene en la vista Consultor con datos reales.

---

Generado a partir de una lectura estática de `scripts/ingestEscolar.mjs` en `HEAD` al 2026-07-29. Regenerable como parte de una futura pasada automatizada equivalente a `scripts/mapeoParvulario.mjs`, aún pendiente.
