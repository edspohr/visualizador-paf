# Reporte de conexión Escolar — visualizador vs planillas fuente

Fecha: 2026-08-05. Programa: **Escolar** · Año: **2026**.

Este reporte responde a la pregunta: **para cada escuela e indicador del catálogo canónico 2026, ¿está el visualizador leyendo el dato desde la planilla fuente?**

El estado tiene cuatro valores:

- **Con dato**: la planilla fuente reportó un valor y llegó al visualizador.
- **Sin dato**: la planilla fuente se leyó correctamente, pero la celda está vacía. La conexión funciona.
- **Faltante**: la conexión está declarada en general pero no se registró un documento para esta escuela. Requiere revisar el pipeline.
- **Sin fuente**: no está declarada la coordenada de dónde leer este indicador. **Requiere que Sebastián indique la planilla / pestaña / columna.**

---

## Resumen general (18 escuelas × 51 indicadores = 918 tuplas para 2026)

| Estado | Tuplas | % |
|---|---:|---:|
| Con dato | 556 | 60.6% |
| Sin dato | 38 | 4.1% |
| Faltante | 0 | 0.0% |
| Sin fuente | 324 | 35.3% |
| **Total** | **918** | 100% |

## Indicadores conectados a fuente (33/51)

Estos indicadores tienen al menos un documento en Firestore para alguna escuela × año, lo que confirma que la coordenada de lectura está declarada:

| ID | Ámbito | Nombre |
|---|---|---|
| I.1 | A1 | Se conforma Equipo de Gestión |
| I.2 | A1 | Número de reuniones anuales del Equipo de Gestión |
| I.3 | A1 | % promedio de asistencia anual de directores a las reuniones del equipo de gestión |
| I.4 | A1 | % promedio de asistencia de coordinadores a las reuniones del equipo de gestión |
| I.5 | A1 | Número de reuniones de coordinación |
| I.6 | A1 | Director asiste a formación de liderazgo territorial |
| I.7 | A1 | Coordinador asiste a formación de liderazgo territorial |
| I.8 | A1 | Director asiste a formación de liderazgo, por escuela |
| I.9 | A1 | Existe plan de acción familia escuela diseñado |
| I.10 | A1 | Existe plan de acción familia escuela actualizado |
| I.11 | A2 | Número de módulos formativos realizados anualmente en la escuela |
| I.12 | A2 | % de profesores jefe que asisten a módulos formativos |
| I.13 | A2 | Director asiste a módulos formativos |
| I.14 | A2 | Coordinador asiste a módulos formativos |
| I.15 | A2 | Número de formaciones territoriales anuales para docentes y asistentes de la educación |
| I.16 | A2 | % de profesores jefe que asisten a formaciones territoriales |
| I.17 | A2 | Director asiste a formaciones territoriales |
| I.18 | A2 | Coordinador asiste a formaciones territoriales |
| I.19 | A2 | Porcentaje promedio de familias entrevistadas por profesor jefe al menos una vez en el año por sala |
| I.20 | A2 | Porcentaje promedio de familias entrevistadas por profesor jefe al menos dos veces en el año por sala |
| I.25 | A3 | Número de formaciones realizadas a apoderados monitores |
| I.26 | A3 | Número de apoderados monitores formados (que hayan asistido a al menos una instancia de formación) |
| I.27 | A3 | Número de salas cubiertas por apoderados monitores |
| I.28 | A4 | Cantidad de semanas de envío de Biblioteca Viajera por sala |
| I.33 | A1 | Director cumple la meta propuesta para su liderazgo, a partir de la revisión de estándares PAF |
| I.35 | A1 | Plan de acción diseñado e incorporado en PME y PEI |
| I.36 | A2 | Nota promedio que ponen los asistentes a los módulos formativos |
| I.37 | A2 | Nota promedio que ponen los asistentes las formaciones territoriales |
| I.38 | A2 | Existe en el establecimiento un sistema de planificación, pauta y monitoreo de entrevistas para apoderados que cumple con los estándares propuestos desde el PAF |
| I.40 | A3 | % promedio de apoderados que participan de al menos un taller para apoderados presencial |
| I.41 | A3 | % promedio de apoderados que participan del 100% de los Talleres para apoderados presencial |
| I.46 | A3 | Número de apoderados monitores que implementaron Taller de Apoderados (que hayan realizado al menos un taller) |
| I.47 | A3 | Nota promedio que ponen los asistentes a las formaciones de monitores |

## Indicadores sin fuente (18/51) — pendiente de Sebastián

Estos indicadores no tienen coordenada de lectura declarada en ninguna escuela. Necesitamos, para cada uno, la planilla / pestaña / columna donde se reporta — o marca "no vigente en 2026":

| ID | Ámbito | Nombre | Planilla de origen |
|---|---|---|---|
| I.21 | A3 | Número de talleres para apoderados presenciales realizados en promedio por sala | *(por definir)* |
| I.22 | A3 | %  promedio de asistencia anual de apoderados a taller para apoderados presenciales | *(por definir)* |
| I.23 | A3 | Número de Taller digitales para Apoderados enviados en promedio por sala | *(por definir)* |
| I.24 | A3 | Cantidad de visualizaciones promedio de los Talleres digitales para Apoderados | *(por definir)* |
| I.29 | A4 | Cantidad  promedio de libros de Bibliotecas Viajeras recibidos por estudiante por sala. | *(por definir)* |
| I.30 | A4 | Cantidad promedio de envío de Lecturas Viajeras por sala | *(por definir)* |
| I.31 | A4 | % de salas que envían Mantel de Palabras | *(por definir)* |
| I.32 | A4 | Número de talleres para estudiantes realizados por sala (1ro a 8vo) | *(por definir)* |
| I.34 | A1 | % de cumplimiento del plan de acción familia escuela | *(por definir)* |
| I.39 | A3 | Porcentaje de Talleres para Apoderados liderados por la dupla monitor profesor | *(por definir)* |
| I.42 | A3 | % de apoderados que responden la encuesta que declaran haber descargado y visualizado los dos Talleres digitales | *(por definir)* |
| I.43 | A4 | Promedio de libros de Biblioteca Viajera que declaran utilizar las familias que responden encuesta | *(por definir)* |
| I.44 | A4 | Promedio de Lecturas Viajeras que declaran utilizar las familias que responden la encuesta | *(por definir)* |
| I.45 | A4 | % de apoderados que contestan la encuesta y declaran utilizar el mantel de palabras | *(por definir)* |
| I.48 | A4 | Cantidad promedio de actividades  mediación Biblioteca Viajera realizadas por sala | *(por definir)* |
| I.49 | A4 | Cantidad promedio de actividades de aula de Lecturas Viajeras desarrolladas en salas | *(por definir)* |
| I.50 | A4 | % de salas que realizan actividad de mediación del Mantel de Palabras, previo al envío | *(por definir)* |
| I.51 | A4 | Cantidad promedio  de actividades de mediación del mantel post envío desarrollados en cada sala | *(por definir)* |

## Detalle por escuela — 2026

Conteo por escuela de las 51 tuplas indicador × 2026:

| Sostenedor | Escuela | Con dato | Sin dato | Faltante | Sin fuente |
|---|---|---:|---:|---:|---:|
| SLEP Los Parques | Escuela Abate Molina | 32 | 1 | 0 | 18 |
| SLEP Los Parques | Escuela España | 31 | 2 | 0 | 18 |
| SLEP Los Parques | Escuela Gil de Castro | 32 | 1 | 0 | 18 |
| SLEP Los Parques | Escuela Inglaterra | 31 | 2 | 0 | 18 |
| SLEP Los Parques | Escuela Platón | 31 | 2 | 0 | 18 |
| SLEP Santa Corina | Escuela Pedro Aguirre Cerda | 33 | 0 | 0 | 18 |
| SLEP Santa Corina | Escuela Profesor Ramón del Río | 33 | 0 | 0 | 18 |
| SLEP Santa Corina | Escuela Ramón Freire | 31 | 2 | 0 | 18 |
| SLEP Santa Corina | República de Austria | 32 | 1 | 0 | 18 |
| SLEP Santa Rosa | Escuela Básica Sendero del Saber | 24 | 9 | 0 | 18 |
| SLEP Santa Rosa | Escuela Ciudad de Barcelona | 32 | 1 | 0 | 18 |
| SLEP Santa Rosa | Escuela Esperanza Joven | 25 | 8 | 0 | 18 |
| SLEP Santa Rosa | Escuela La Victoria | 32 | 1 | 0 | 18 |
| SLEP Santa Rosa | Escuela Lo Valledor | 31 | 2 | 0 | 18 |
| SLEP Santa Rosa | Escuela República De Las Filipinas | 32 | 1 | 0 | 18 |
| SLEP Santa Rosa | Escuela Ricardo Latcham | 30 | 3 | 0 | 18 |
| SLEP Santa Rosa | Escuela Territorio Antártico | 32 | 1 | 0 | 18 |
| SLEP Santa Rosa | Escuela Villa San Miguel | 32 | 1 | 0 | 18 |

## Matriz escuela × indicador — 2026 (símbolos)

Leyenda: ✅ Con dato · ○ Sin dato · ⚠ Faltante · ✗ Sin fuente

| Escuela | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 | 32 | 33 | 34 | 35 | 36 | 37 | 38 | 39 | 40 | 41 | 42 | 43 | 44 | 45 | 46 | 47 | 48 | 49 | 50 | 51 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Escuela Abate Molina | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✗ | ✗ | ✗ | ✗ | ✅ | ✅ | ✅ | ✅ | ✗ | ✗ | ✗ | ✗ | ✅ | ✗ | ✅ | ✅ | ○ | ✅ | ✗ | ✅ | ✅ | ✗ | ✗ | ✗ | ✗ | ✅ | ✅ | ✗ | ✗ | ✗ | ✗ |
| Escuela España | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✗ | ✗ | ✗ | ✗ | ✅ | ✅ | ✅ | ✅ | ✗ | ✗ | ✗ | ✗ | ✅ | ✗ | ✅ | ✅ | ○ | ✅ | ✗ | ✅ | ✅ | ✗ | ✗ | ✗ | ✗ | ✅ | ○ | ✗ | ✗ | ✗ | ✗ |
| Escuela Gil de Castro | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✗ | ✗ | ✗ | ✗ | ✅ | ✅ | ✅ | ✅ | ✗ | ✗ | ✗ | ✗ | ✅ | ✗ | ✅ | ✅ | ○ | ✅ | ✗ | ✅ | ✅ | ✗ | ✗ | ✗ | ✗ | ✅ | ✅ | ✗ | ✗ | ✗ | ✗ |
| Escuela Inglaterra | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✗ | ✗ | ✗ | ✗ | ✅ | ✅ | ✅ | ✅ | ✗ | ✗ | ✗ | ✗ | ✅ | ✗ | ✅ | ✅ | ○ | ✅ | ✗ | ✅ | ✅ | ✗ | ✗ | ✗ | ✗ | ✅ | ○ | ✗ | ✗ | ✗ | ✗ |
| Escuela Platón | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✗ | ✗ | ✗ | ✗ | ✅ | ✅ | ✅ | ✅ | ✗ | ✗ | ✗ | ✗ | ✅ | ✗ | ✅ | ✅ | ○ | ✅ | ✗ | ✅ | ✅ | ✗ | ✗ | ✗ | ✗ | ✅ | ○ | ✗ | ✗ | ✗ | ✗ |
| Escuela Pedro Aguirre Cerda | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✗ | ✗ | ✗ | ✗ | ✅ | ✅ | ✅ | ✅ | ✗ | ✗ | ✗ | ✗ | ✅ | ✗ | ✅ | ✅ | ✅ | ✅ | ✗ | ✅ | ✅ | ✗ | ✗ | ✗ | ✗ | ✅ | ✅ | ✗ | ✗ | ✗ | ✗ |
| Escuela Profesor Ramón del Río | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✗ | ✗ | ✗ | ✗ | ✅ | ✅ | ✅ | ✅ | ✗ | ✗ | ✗ | ✗ | ✅ | ✗ | ✅ | ✅ | ✅ | ✅ | ✗ | ✅ | ✅ | ✗ | ✗ | ✗ | ✗ | ✅ | ✅ | ✗ | ✗ | ✗ | ✗ |
| Escuela Ramón Freire | ✅ | ✅ | ✅ | ○ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✗ | ✗ | ✗ | ✗ | ✅ | ○ | ✅ | ✅ | ✗ | ✗ | ✗ | ✗ | ✅ | ✗ | ✅ | ✅ | ✅ | ✅ | ✗ | ✅ | ✅ | ✗ | ✗ | ✗ | ✗ | ✅ | ✅ | ✗ | ✗ | ✗ | ✗ |
| República de Austria | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✗ | ✗ | ✗ | ✗ | ✅ | ○ | ✅ | ✅ | ✗ | ✗ | ✗ | ✗ | ✅ | ✗ | ✅ | ✅ | ✅ | ✅ | ✗ | ✅ | ✅ | ✗ | ✗ | ✗ | ✗ | ✅ | ✅ | ✗ | ✗ | ✗ | ✗ |
| Escuela Básica Sendero del Saber | ✅ | ✅ | ✅ | ○ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ○ | ○ | ✗ | ✗ | ✗ | ✗ | ✅ | ○ | ○ | ✅ | ✗ | ✗ | ✗ | ✗ | ✅ | ✗ | ✅ | ✅ | ○ | ✅ | ✗ | ○ | ○ | ✗ | ✗ | ✗ | ✗ | ○ | ✅ | ✗ | ✗ | ✗ | ✗ |
| Escuela Ciudad de Barcelona | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✗ | ✗ | ✗ | ✗ | ✅ | ✅ | ✅ | ✅ | ✗ | ✗ | ✗ | ✗ | ✅ | ✗ | ✅ | ✅ | ○ | ✅ | ✗ | ✅ | ✅ | ✗ | ✗ | ✗ | ✗ | ✅ | ✅ | ✗ | ✗ | ✗ | ✗ |
| Escuela Esperanza Joven | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ○ | ○ | ✗ | ✗ | ✗ | ✗ | ✅ | ○ | ○ | ✅ | ✗ | ✗ | ✗ | ✗ | ✅ | ✗ | ✅ | ✅ | ○ | ✅ | ✗ | ○ | ○ | ✗ | ✗ | ✗ | ✗ | ○ | ✅ | ✗ | ✗ | ✗ | ✗ |
| Escuela La Victoria | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✗ | ✗ | ✗ | ✗ | ✅ | ✅ | ✅ | ✅ | ✗ | ✗ | ✗ | ✗ | ✅ | ✗ | ✅ | ✅ | ○ | ✅ | ✗ | ✅ | ✅ | ✗ | ✗ | ✗ | ✗ | ✅ | ✅ | ✗ | ✗ | ✗ | ✗ |
| Escuela Lo Valledor | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✗ | ✗ | ✗ | ✗ | ✅ | ○ | ✅ | ✅ | ✗ | ✗ | ✗ | ✗ | ✅ | ✗ | ✅ | ✅ | ○ | ✅ | ✗ | ✅ | ✅ | ✗ | ✗ | ✗ | ✗ | ✅ | ✅ | ✗ | ✗ | ✗ | ✗ |
| Escuela República De Las Filipinas | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✗ | ✗ | ✗ | ✗ | ✅ | ✅ | ✅ | ✅ | ✗ | ✗ | ✗ | ✗ | ✅ | ✗ | ✅ | ✅ | ○ | ✅ | ✗ | ✅ | ✅ | ✗ | ✗ | ✗ | ✗ | ✅ | ✅ | ✗ | ✗ | ✗ | ✗ |
| Escuela Ricardo Latcham | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✗ | ✗ | ✗ | ✗ | ✅ | ✅ | ○ | ✅ | ✗ | ✗ | ✗ | ✗ | ✅ | ✗ | ✅ | ✅ | ○ | ✅ | ✗ | ✅ | ✅ | ✗ | ✗ | ✗ | ✗ | ○ | ✅ | ✗ | ✗ | ✗ | ✗ |
| Escuela Territorio Antártico | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✗ | ✗ | ✗ | ✗ | ✅ | ✅ | ✅ | ✅ | ✗ | ✗ | ✗ | ✗ | ✅ | ✗ | ✅ | ✅ | ○ | ✅ | ✗ | ✅ | ✅ | ✗ | ✗ | ✗ | ✗ | ✅ | ✅ | ✗ | ✗ | ✗ | ✗ |
| Escuela Villa San Miguel | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✗ | ✗ | ✗ | ✗ | ✅ | ✅ | ✅ | ✅ | ✗ | ✗ | ✗ | ✗ | ✅ | ✗ | ✅ | ✅ | ○ | ✅ | ✗ | ✅ | ✅ | ✗ | ✗ | ✗ | ✗ | ✅ | ✅ | ✗ | ✗ | ✗ | ✗ |
