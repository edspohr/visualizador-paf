# Manifiesto de cobertura Escolar

Generado 2026-08-05 (con estado de Firestore).

Total de tuplas (escuela × indicador × curso × año) declaradas: **1836**.

## Distribución por estado

| Estado | Cantidad | Porcentaje | Dueño |
|---|---:|---:|---|
| NO_CORRESPONDE_AUN | 681 | 37.1% | Nadie (diseño del programa) |
| NO_CORRESPONDE | 0 | 0.0% | Nadie (estructura) |
| SIN_FUENTE_MAPEADA | 466 | 25.4% | **Nosotros** |
| FUENTE_NO_ACCESIBLE | 0 | 0.0% | **Nosotros** |
| SIN_DATO_REPORTADO | 658 | 35.8% | Focus |
| CON_DATO_REPORTADO | 31 | 1.7% | — |
| CERO_REPORTADO | 0 | 0.0% | — |
| MAPEADO_NO_VERIFICADO | 0 | 0.0% | Correr con `--with-firestore` |

## Indicadores con estado SIN_FUENTE_MAPEADA

- **I.1 · Se conforma Equipo de Gestión**: 5 tuplas — 
- **I.2 · Número de reuniones anuales del Equipo de Gestión**: 5 tuplas — 
- **I.3 · % promedio de asistencia anual de directores a las reuniones del equip**: 5 tuplas — 
- **I.4 · % promedio de asistencia de coordinadores a las reuniones del equipo d**: 5 tuplas — 
- **I.5 · Número de reuniones de coordinación**: 5 tuplas — 
- **I.6 · Director asiste a formación de liderazgo territorial**: 5 tuplas — 
- **I.7 · Coordinador asiste a formación de liderazgo territorial**: 5 tuplas — 
- **I.8 · Director asiste a formación de liderazgo, por escuela**: 5 tuplas — 
- **I.9 · Existe plan de acción familia escuela diseñado**: 5 tuplas — 
- **I.10 · Existe plan de acción familia escuela actualizado**: 5 tuplas — 
- **I.11 · Número de módulos formativos realizados anualmente en la escuela**: 5 tuplas — 
- **I.12 · % de profesores jefe que asisten a módulos formativos**: 5 tuplas — 
- **I.13 · Director asiste a módulos formativos**: 5 tuplas — 
- **I.14 · Coordinador asiste a módulos formativos**: 5 tuplas — 
- **I.15 · Número de formaciones territoriales anuales para docentes y asistentes**: 5 tuplas — 
- **I.16 · % de profesores jefe que asisten a formaciones territoriales**: 5 tuplas — 
- **I.17 · Director asiste a formaciones territoriales**: 5 tuplas — 
- **I.18 · Coordinador asiste a formaciones territoriales**: 5 tuplas — 
- **I.19 · Porcentaje promedio de familias entrevistadas por profesor jefe al men**: 5 tuplas — 
- **I.21 · Número de talleres para apoderados presenciales realizados en promedio**: 23 tuplas — Nº talleres presenciales por sala. Discovery 2026-08-05: viven en course-workbooks (arquetipo=curso) en tab Actividades, sección "Actividades con Apoderados/as", rows con "Taller presencial: ...". Requiere ingest per-curso agregando por escuela (promedio conteo por sala). Follow-up.
- **I.22 · %  promedio de asistencia anual de apoderados a taller para apoderados**: 23 tuplas — Asistencia a taller presencial. No encontrado en Encuesta apoderados (discovery 2026-08-05) — Sebastián debe confirmar dónde se reporta.
- **I.23 · Número de Taller digitales para Apoderados enviados en promedio por sa**: 23 tuplas — Nº talleres digitales enviados por sala. Sin fuente declarada. Confirmar con Sebastián.
- **I.24 · Cantidad de visualizaciones promedio de los Talleres digitales para Ap**: 23 tuplas — Visualizaciones de talleres digitales. Sin fuente declarada. Confirmar con Sebastián.
- **I.25 · Número de formaciones realizadas a apoderados monitores**: 5 tuplas — 
- **I.26 · Número de apoderados monitores formados (que hayan asistido a al menos**: 5 tuplas — 
- **I.27 · Número de salas cubiertas por apoderados monitores**: 5 tuplas — 
- **I.28 · Cantidad de semanas de envío de Biblioteca Viajera por sala**: 5 tuplas — 
- **I.29 · Cantidad  promedio de libros de Bibliotecas Viajeras recibidos por est**: 5 tuplas — 
- **I.30 · Cantidad promedio de envío de Lecturas Viajeras por sala**: 23 tuplas — Envío de Lecturas Viajeras. Discovery 2026-08-05: en course-workbooks (2A-4B) tab Actividades sección Biblioteca Viajera / Lecturas Viajeras. Follow-up per-curso.
- **I.31 · % de salas que envían Mantel de Palabras**: 5 tuplas — 
- **I.32 · Número de talleres para estudiantes realizados por sala (1ro a 8vo)**: 23 tuplas — Nº talleres para estudiantes. Discovery 2026-08-05: course-workbooks 1A-8B tab Actividades sección "Actividades con Estudiantes" (rows Mantel/Biblioteca por sala). Follow-up per-curso.
- **I.33 · Director cumple la meta propuesta para su liderazgo, a partir de la re**: 5 tuplas — 
- **I.34 · % de cumplimiento del plan de acción familia escuela**: 23 tuplas — La regex del ingest actual coincide con "porcentaje de cumplimiento del plan de acción" pero la celda llega vacía en todas las escuelas hoy. Estructurado pero sin datos.
- **I.35 · Plan de acción diseñado e incorporado en PME y PEI**: 5 tuplas — 
- **I.36 · Nota promedio que ponen los asistentes a los módulos formativos**: 5 tuplas — 
- **I.37 · Nota promedio que ponen los asistentes las formaciones territoriales**: 5 tuplas — 
- **I.38 · Existe en el establecimiento un sistema de planificación, pauta y moni**: 5 tuplas — 
- **I.39 · Porcentaje de Talleres para Apoderados liderados por la dupla monitor **: 23 tuplas — % Talleres liderados por dupla monitor-profesor. Discovery 2026-08-05: course-workbooks tab Actividades tiene row "¿Quién lidera el taller?" (R18) — el layout es libre-texto, requiere parseo custom. Follow-up.
- **I.40 · % promedio de apoderados que participan de al menos un taller para apo**: 5 tuplas — 
- **I.41 · % promedio de apoderados que participan del 100% de los Talleres para **: 5 tuplas — 
- **I.42 · % de apoderados que responden la encuesta que declaran haber descargad**: 5 tuplas — 
- **I.43 · Promedio de libros de Biblioteca Viajera que declaran utilizar las fam**: 5 tuplas — 
- **I.44 · Promedio de Lecturas Viajeras que declaran utilizar las familias que r**: 5 tuplas — 
- **I.45 · % de apoderados que contestan la encuesta y declaran utilizar el mante**: 5 tuplas — 
- **I.46 · Número de apoderados monitores que implementaron Taller de Apoderados **: 5 tuplas — 
- **I.47 · Nota promedio que ponen los asistentes a las formaciones de monitores**: 5 tuplas — 
- **I.48 · Cantidad promedio de actividades  mediación Biblioteca Viajera realiza**: 23 tuplas — Mediación BV. Discovery 2026-08-05: course-workbooks tab Actividades "Actividad de aula Biblioteca viajera" rows (bools per actividad). Follow-up per-curso.
- **I.49 · Cantidad promedio de actividades de aula de Lecturas Viajeras desarrol**: 23 tuplas — Mediación LV. Discovery 2026-08-05: course-workbooks tab Actividades sección Lecturas Viajeras. Follow-up per-curso.
- **I.50 · % de salas que realizan actividad de mediación del Mantel de Palabras,**: 23 tuplas — Mediación Mantel previo. Discovery 2026-08-05: course-workbooks tab Actividades "Mediación Mantel de Palabras" row. Follow-up per-curso.
- **I.51 · Cantidad promedio  de actividades de mediación del mantel post envío d**: 23 tuplas — Mediación Mantel post-envío. Discovery 2026-08-05: course-workbooks tab Actividades "Monitoreo Mantel de Palabras" rows. Follow-up per-curso.

## Planillas inaccesibles desde el harvest

Total: **1 planillas** que no se pudieron leer.

Por tipo de error:
- permanent (no encontrado): 1

Por escuela × año:
- Escuela Básica Sendero del Saber · 2026: 1 planillas

Estas planillas están declaradas en el índice pero el service account que hace el harvest no las pudo abrir. Casi todas son planillas del bloque 2025 de escuelas cohorte 2025-2027 — la cuenta de servicio no tiene acceso concedido a ese bloque. Es una acción de permisos que Focus debe resolver antes de que la plataforma pueda ingestar datos históricos 2025 de Escolar.

## Nota

Este manifiesto declara qué se espera y qué se tiene declarado como fuente.
No cambia agregaciones. Un indicador aplicable sin valor sigue contando 0 en
el porcentaje del ámbito, exactamente como hoy. El manifiesto cambia lo que
se muestra y se reporta, no lo que se computa.
