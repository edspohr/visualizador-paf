# Reporte de importación — consolidado Escolar 2025

Generado 2026-07-30. Fuente: hoja de cálculo "Resultados indicadores" (id `1yxgC1v4q7dwq38uD8d678eNGCByhdrbNj_708jnblus`), leída con permisos de Sebastián.

## Qué se importó

- **Catálogo 2025**: 50 indicadores (6 de tipo 2 / producto-logro, 44 de tipo 1 / estrategia-actividad). Los IDs van de I.1 a I.50. Sus nombres, metas, estrategia y actividad-producto quedan registrados.
- **Base Vertical**: 1112 filas en formato largo (una fila por combinación escuela × curso × indicador), con `Meta`, `Tipo Meta`, `Meta Numérica`, `Meta Cualitativa` y `Cumplimiento` calculados por ustedes. Se descartaron 61 filas cuyo campo Indicador no coincide con el patrón `I<n>` (notas, CD, comentarios) — su metadata está desalineada por la fórmula lookup de la planilla y sus valores no son confiables sin revisión manual.
- **RBD ↔ nombre escuela**: 5 equivalencias mapeadas, para validar identidad de establecimiento en próximas ingestas.

## Qué NO se importó

- **Pestaña "Estudiantes"**: contiene RUT y nombre por estudiante. No se lee ni se persiste desde esta plataforma, ni siquiera transitoriamente. Cualquier agregado a nivel sala debe pasar por un script separado que calcule el agregado sin exponer nunca las filas estudiante. Nota de compliance más abajo.

## Hallazgos

### 1. Los catálogos 2025 y 2026 son instrumentos distintos

El catálogo 2025 tiene 50 indicadores; el canónico 2026 tiene 51. Coinciden solo parcialmente en nombre e intención, difieren en granularidad y en la separación estrategia/logro (6 indicadores de logro en 2025 vs 19 en 2026). **La comparación año-a-año 2025 vs 2026 por identidad de código en Escolar no es semánticamente válida** — hay indicadores I.15 en ambos años que se refieren a cosas distintas. Es una decisión que necesitamos con Sebastián y Luis (ver sección "Decisiones abiertas").

### 2. Discrepancias de meta entre catálogo 2025 y canónico 2026

Comparando por nombre aproximado, encontramos 11 indicadores con metas distintas entre los dos catálogos. Los primeros 10:

- **I5 (Existe plan de acción familia escuela diseñado…)**: meta 2025 = `SI`, meta 2026 canónica = `Sí`
- **I6 (% de cumplimiento del plan de acción familia escuela…)**: meta 2025 = `0.8`, meta 2026 canónica = `70%`
- **I9 (Director asiste a formación de liderazgo…)**: meta 2025 = `SI`, meta 2026 canónica = `2`
- **I11 (Plan de acción diseñado e incorporado en PME y PEI…)**: meta 2025 = `SI`, meta 2026 canónica = `Sí`
- **I22 (Porcentaje promedio de familias entrevistadas por profesor j…)**: meta 2025 = `1`, meta 2026 canónica = `100%`
- **I23 (Porcentaje promedio de familias entrevistadas por profesor j…)**: meta 2025 = `0.5`, meta 2026 canónica = `100%`
- **I24 (Existe en el establecimiento un sistema de planificación, pa…)**: meta 2025 = `SI`, meta 2026 canónica = `Sí`
- **I34 (Cantidad  promedio de libros de bibliotecas viajeras recibid…)**: meta 2025 = `5`, meta 2026 canónica = `10`
- **I35 (Promedio de libros de biblioteca viajera utilizados por fami…)**: meta 2025 = `5`, meta 2026 canónica = `7`
- **I42 (% de salas que envían Mantel de Palabras…)**: meta 2025 = `1`, meta 2026 canónica = `100%`

Estas discrepancias esperables — el catálogo evolucionó — deben ser confirmadas caso por caso por Sebastián.

### 3. La pestaña enriquecida trae un valor de "Cumplimiento" calculado por ustedes

La Base Vertical incluye una columna `Cumplimiento` calculada en la propia planilla. La plataforma calcula su propio porcentaje de cumplimiento como AVG(min(1, valor/meta)) — que es la fórmula que se validó con Luis. **Los dos números pueden diferir.** Está pendiente decidir dónde y cómo mostrar el contraste (o si mostrarlo en la interfaz o solo en reportes internos).

## Nota de compliance sobre datos estudiantiles

La pestaña "Estudiantes" contiene identificadores personales (RUT, nombre completo) de menores. Nuestra manera de trabajar con esos datos:

- Se leen únicamente de forma transitoria en memoria cuando se necesita computar un agregado a nivel sala (por ejemplo, cobertura de entrevistas por sala). El agregado computado es lo único que se persiste.
- Ninguna identidad individual se escribe en la base de datos, en logs, en reportes generados, ni en el caché de datos crudos que usamos para re-procesamiento offline.
- El script de importación tiene una aserción defensiva que aborta la escritura de cualquier artifact si detecta un patrón de RUT chileno en los datos que va a persistir.

La instrucción operativa está alineada con lo que exige la Ley 21.719 sobre protección de datos personales. **Recomendamos que Focus valide este manejo con su asesor legal antes de que aparezca en cualquier documento de cara al cliente.**

## Decisiones abiertas para Sebastián

1. **Cross-year Escolar**: ¿deshabilitar la comparación 2025 vs 2026 en Escolar del comparador, mostrar una advertencia clara, o restructurar el catálogo 2025 para que sea comparable?
2. **Discrepancias de meta**: ¿cuál catálogo gobierna cuando difieren?
3. **Cumplimiento de Focus vs de la plataforma**: ¿se muestran ambos, o sólo el de la plataforma? Si se muestran ambos, ¿dónde?
