# Retro 2 · respuesta a la revisión de Focus (planilla de seguimiento, 09-10-2026)

Fecha: 15 de octubre de 2026 · Visualizador PAF · https://visualizador-paf.web.app

Resumen para pasar a la planilla `Seguimiento_Retro1_Visualizador_PAF_2026-09-28`
(columna "Resolución" de "Casos para validar" y "Estado" de "Pendientes Focus").
Las filas se citan por su número en la pestaña. "Hoy" = cargado en producción el 15-10;
"Reunión" = se decide el 16-10 y se despliega la semana siguiente.

## Casos para validar · Parvularia (Luis)

| Fila | Indicador | Qué pasaba | Qué se hizo | Estado |
|---|---|---|---|---|
| 5, 6, 27 | I.52 (Tierra de Ángeles, Eluney, todos) | La carga leía la columna I.53 ("SIN DATOS") como I.52. Las planillas centrales ya usan la numeración canónica y la plataforma seguía corriendo I.44–I.53 un lugar. | Traducción corregida y recarga completa de las 3 centrales. Tierra de Ángeles I.52 = 70 %, Eluney I.52 = 56 % (promedio de las salas con actividad de la planilla central). | Hoy |
| 10 | I.49 (Caballito Feliz, todos) | Mismo corrimiento: se mostraba el valor de I.50. | Caballito Feliz I.49 = 65,7 % (planilla central: 53,85 / 57,89 / 66,67 / 84,21). | Hoy |
| 20–24 | I.44, I.45, I.46, I.47, I.48 | Mismo corrimiento (cada uno mostraba el siguiente). | Corregidos. I.47 = 100 % en todos los jardines, como indica la planilla. | Hoy |
| 25 | I.50 | Corrimiento + nombre antiguo ("rol pedagógico"). | Valor corregido; nombre tomado del Excel nuevo: "% de familias que cumplen con rol educativo definido por el jardín infantil". | Hoy |
| 26 | I.51 | Corrimiento (mostraba I.52) + nombre. | Valor corregido. Nombre según el Excel: "% de familias que participan en actividades de narración basadas en el Baúl MFC" (la planilla central dice "actividades de Narración"; por D-05 manda el Excel, ver pendiente). | Hoy |
| — | I.53 | Nunca se cargaba. | Ahora se lee; las planillas traen "SIN DATOS" y el Excel lo marca como año 2, así que en jardines de año 1 aparece "Corresponde solo al año 2". | Hoy |
| 1–4, 7–9 | I.38, I.32, I.27, I.23, I.26, I.24 | Luis los marcó OK o corregidos en planilla. | Sin cambio en la plataforma; la carga nocturna toma las correcciones de planilla. | Cerrado |
| 11, 12 | I.12 2025, Backausse I.4 | Corregido en planilla central. | La recarga de hoy ya lo incluye. | Cerrado |

## Casos para validar · Básica (Sebastián)

| Fila | Indicador | Qué se hizo | Estado |
|---|---|---|---|
| 13, 14, 16, 17 | I.4 coordinador, Platón 10 salas, I.36 fechas, columna Activo | Corregido por Focus en las planillas; la carga de hoy lo refleja (Platón: meta de I.26/I.46 = salas activas). | Cerrado |
| 15 | I.39 talleres sin líder | Nueva fórmula (ver hilo resuelto): por curso, aplicaciones lideradas por la dupla sobre el máximo de aplicaciones (2 en PK/K, 3 en 1º–8º), promedio de cursos. Un taller sin líder registrado cuenta como no liderado por la dupla. | Hoy |
| 18 | Sendero del Saber kínder A | Error de fórmula en la planilla, de Focus. | Pendiente Focus |
| 28 | I.11–I.14 módulos realizados | "Realizado" = columna de Datos docentes con asistencia registrada (H sensibilización + K–N módulos). I.11 cuenta esas instancias; I.12 promedia asistencia solo sobre ellas. I.13/I.14 muestran "n de m realizadas" pero su meta sigue en 5: falta decidir si la meta pasa a ser los módulos realizados. | Hoy (I.11, I.12) · Reunión (I.13, I.14) |
| 29 | I.16 formaciones territoriales | Promedio de asistencia de profesores jefe solo sobre las formaciones realizadas (columnas I, J con asistencia). | Hoy |
| 30 | I.19 / I.20 | La fórmula ya contaba los checks de ambos semestres: al menos uno → I.19, los dos → I.20, igual que el criterio escrito. I.20 ahora visible desde año 1 (el Excel Escolar dice "Segundo año"; corregir allí). | Hoy |
| 31 | I.24 no está en el comparador | No tiene meta ni fuente conectada. Las filas "% de visualizaciones" existen solo en Datos Consultor de año 1 (Filipinas sí; Gil de Castro, Inglaterra, España no). Hay que definir meta y agregar las filas en año 2. | Reunión |
| 32–57 | Comparador en unidad nativa (I.2, I.5, I.11, …, I.51) | El modo "Todos los indicadores" muestra % de cumplimiento vs meta. Propuesta: media en la unidad del indicador (nota, cantidad, %) por defecto, con opción de ver el % de cumplimiento. | Reunión |
| 34, 35, 37, 39 | I.6, I.7, I.13, I.14, I.17, I.18 sobre lo realizado | Para módulos (I.13, I.14) ver fila 28. Para encuentros territoriales (I.6, I.7, I.17, I.18) no hay en Datos Consultor una marca de "encuentro realizado"; hay que definir dónde se registra. | Reunión |

## Pendientes Focus

| # | Tema | Estado |
|---|---|---|
| 1 | I.24 fuente y meta | Fuente identificada (filas 28/29 de Actividades, año 1). Meta por definir en la reunión. |
| 2 | "6 de 9 cursos" → I.27 | Cerrado. |
| 3 | Platón 10 salas | Cerrado (planilla corregida; la carga toma `nSalas` de Datos Consultor). |
| 4 | I.4 coordinador | Cerrado (planillas corregidas). |
| 5 | I.39 | Aplicado (ver fila 15). Verificar valores con Sebastián. |
| 6 | Vigencia | Cerrado: el Excel nuevo trae la columna VIGENCIA y la plataforma la lee. Nota: I.11 quedó "Ambos" en el Excel (en L-09 se habló de año 1); se aplica lo que dice el Excel. |
| 7 | Coordenadas | Cerrado: 42 establecimientos con ubicación real. |
| 8 | Nombres corregidos | Cerrado: catálogo regenerado desde el Excel nuevo. Dos detalles para Luis: la pestaña "Listado indicadores" tiene un I.54 sobrante, y el nombre de I.51 difiere entre Excel y planilla central. |
| 9 | Casos Parvularia | Cerrado (ver arriba). |
| 10 | Capturas sin datos personales | Protocolo de uso de Focus; sin cambio técnico. |

## Otros acuerdos de la reunión del 02-10

- Sebastián recibe el correo diario de estado desde el 16-10.
- Nombre de la plataforma ("Panel de Monitoreo PAF" u otro) y subdominio: a la espera de Focus y Fundación CAP. Cambiarlo toma minutos.
