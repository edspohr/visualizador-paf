# Hallazgos del cliente, soluciones aplicadas y estado actual

Fecha: 5 de agosto de 2026 · Visualizador PAF · https://visualizador-paf.web.app

Este documento consolida en una sola vista los hallazgos que Luis (Focus) y Sebastián (Focus) levantaron durante el ciclo, la solución que se aplicó a cada uno, más dos secciones al cierre: mejoras adicionales (mapa territorial, comparador entre pares, etc.) y cobertura actual de datos.

---

## Hallazgos levantados por el cliente y solución aplicada

| # | Hallazgo (cliente) | Solución aplicada |
|---|---|---|
| 1 | Los usuarios con perfil Jardín, Escuela y Sostenedor no podían ingresar a la plataforma. Al abrir la vista aparecía en blanco o con un error de carga (reportado por c.manriquez@edudelpino.gob.cl). | Se reescribió cómo la plataforma consulta datos para cada perfil. Jardín ve solo su jardín, Escuela solo su escuela, Sostenedor todos los establecimientos de su SLEP. Consultor y CAP se mantienen sin cambios. Detrás de esto: reglas Firestore endurecidas + hooks estrechos + campo `slep` denormalizado en 5.530 documentos + `slepId` en usuarios. |
| 2 | La Escuela Ramón del Río no aparecía en el filtro de "SLEP Santa Corina" en la vista del Consultor. | El registro de esa escuela en la base tenía los campos SLEP, sostenedor y comuna vacíos. Se corrigieron a "SLEP Santa Corina", "SLP Santa Corina" y "Estación Central" respectivamente. |
| 3 | La vista del Consultor mostraba "10 comunas" en Escolar, cuando el programa cubre 9. | El conteo se hacía por texto crudo del campo comuna; 15 jardines de Parvulario tenían la comuna en mayúsculas sostenidas (por ejemplo `"CERRILLOS"`) o abreviada (`"PAC"` en vez de `"Pedro Aguirre Cerda"`), lo que rompía el filtro. Se normalizaron los 15 jardines afectados al formato canónico. |
| 4 | El comparador entre 2025 y 2026 en Escolar mostraba el año 2025 casi vacío, aun cuando los indicadores medían lo mismo. | Los códigos de indicador cambiaron entre catálogos (por ejemplo `I.7` en 2025 pasó a ser `I.1` en 2026). Se cargó la tabla de homologación provista por Focus (`homologacion-indicadores-escolar-2025-206.xlsx`) y se usa para alinear indicadores equivalentes: 29 pares se comparan correctamente, 21 indicadores 2025 no tienen equivalente y 22 indicadores 2026 son nuevos. Aparece un aviso explicativo al activar la comparación. |
| 5 | En el panel de indicadores de una escuela no se distinguía entre "aún no llegó el dato" y "no tenemos identificada la planilla fuente". Todo aparecía como cero o vacío. | Se agregó una distinción visual en la fila de cada indicador: barra normal (con dato), barra rayada (sin dato reportado), línea punteada gris (sin fuente mapeada aún). También un chip en la cabecera del ámbito indica cuántos indicadores están sin fuente. La fórmula de cumplimiento no cambia. |
| 6 | Las 68 planillas Escolar del año 2025 del SLEP Los Parques estaban inaccesibles para la plataforma. | Sebastián otorgó el acceso. Se re-corrieron las 68 planillas: 465/466 leyeron OK, están vacías al 5 de agosto (consistente con el avance del programa). La única inaccesible es la planilla del curso KA de Escuela Básica Sendero del Saber, cuyo link ya no existe en Google Drive; Sebastián debe verificar si fue eliminada por error o si el curso no existe. |
| 7 | El comparador entre pares (Promedio del territorio) no aparecía en el drilldown de los perfiles Jardín y Escuela. Solo se veía como Consultor, CAP o Sostenedor. | Se construyó el pipeline de agregados territoriales (`aggregatesTerritorio_real`, 393 documentos regenerables después de cada ingesta). Cada agregado guarda solo valores promedio, jamás datos individuales. Para respetar la Ley 21.719 solo se publican agregados que cumplen dos condiciones: al menos 4 centros del mismo tipo reportando el indicador en el SLEP, y que la comparación año a año no permita aislar el valor de un centro individual. Cuando la comparación local no puede publicarse, se muestra en su lugar "Promedio del programa" (24 jardines / 18 escuelas del PAF completo) con una nota que lo explica. |
| 8 | El superadministrador podía elegir "Ver como Escuela / Jardín / Sostenedor" desde el menú del perfil, pero al hacerlo la vista quedaba vacía: no aparecía el selector de establecimiento y no cargaba data. | El menú "Ver como" apuntaba a identificadores placeholder (`ESC-001`, `JAR-001`, `SLEP-LP`) que quedaron de una fase previa y no corresponden a ningún registro real. Se ajustó el header para que un superadmin viendo-como muestre la lista completa de establecimientos del tipo elegido y auto-seleccione uno real al inicio. Los perfiles limitados reales siguen intactos: solo ven su propio establecimiento. |

---

## Extras — mejoras adicionales entregadas en el ciclo

Estas mejoras no fueron levantadas como hallazgos por Focus, pero se agregaron durante el mismo ciclo:

- **Mapa territorial (perfil Superadmin, activable por bandera):** vista Leaflet en `/geografia` que muestra los 42 establecimientos del programa (18 escuelas + 24 jardines) sobre el mapa del Gran Santiago. Cada marcador está coloreado según el nivel de cumplimiento del centro y su tamaño refleja la matrícula aproximada. Un clic sobre el marcador muestra nombre, SLEP, comuna y % de cumplimiento. Las coordenadas son centroides de comuna con un desplazamiento fijo por establecimiento; no son direcciones reales (Focus puede proveer coordenadas exactas cuando lo requiera).
- **Backfill de la grilla Escolar:** para los indicadores conectados a fuente donde la planilla estaba vacía, se agregaron 38 documentos con `valor=null estado='sin_dato_reportado'` para que la grilla del panel se vea completa (18 escuelas × 33 indicadores = 594 slots). Sin este backfill algunas celdas aparecían simplemente ausentes en lugar de "sin dato reportado".
- **9 indicadores Escolar recién cableados:** durante el ciclo se identificó la coordenada de fuente para 9 indicadores previamente marcados como `SIN_FUENTE_MAPEADA`, específicamente I.10, I.13, I.14, I.29, I.31, I.42, I.43, I.44, I.45.
- **Reubicación de I.43/I.44/I.45:** por indicación explícita de Sebastián y consistente con la homologación, estos tres indicadores de fomento lector declarado por familias se movieron del ámbito A.3 (Formación Apoderados) al ámbito A.4 (Formación Estudiantes).
- **Corrección de conteo de comunas en la vista de Sostenedor:** los establecimientos con comuna nula ya no se cuentan como comuna adicional.
- **Endurecimiento de las reglas Firestore:** el perfil Sostenedor antes podía leer datos de establecimientos fuera de su red. Ya no. Ahora los perfiles limitados solo pueden leer lo que corresponde a su propio contexto (Ley 21.719).
- **Barrera anti-PII operativa:** el script `piiAssertion.mjs` recorre Firestore y la caché de planillas Escolar buscando RUTs y nombres completos, y bloquea el deploy si detecta alguna fuga. En el ciclo se redactaron al vuelo 37.773 valores personales durante la ingesta Escolar y ninguno persistió a base de datos.
- **Precomputación de agregados territoriales:** el script `computeTerritorioAggregates.mjs` puede correrse después de cada ingesta para mantener actualizados los promedios que ve el perfil Jardín/Escuela. La operación es idempotente (se puede re-correr sin efectos secundarios) y regenera 393 documentos.

---

## Cobertura actual de datos (al 5 de agosto de 2026)

Snapshot leído directamente desde Firestore de producción.

### Parvulario

- **Establecimientos activos:** 24 jardines infantiles.
- **Indicadores canónicos:** 53 (I.1 a I.53).
- **Indicadores con al menos un dato reportado:** 49 de 53 (~92%).
- **Documentos en Firestore (agregado por jardín):** 1.742, todos con valor.
- **Indicadores sin ningún dato hoy:** I.35, I.36, I.37 y I.53. Requieren decisión de Focus (Luis) sobre si son reporte al cierre, problema de captura o no vigentes en 2026.
- **Indicador con metadata incompleta:** I.1 "N° de visitas al jardín infantil" tiene datos pero le faltan meta / unidad / frecuencia / fuente / inicio.

### Escolar

- **Establecimientos activos:** 18 escuelas.
- **Indicadores canónicos:** 51 (I.1 a I.51).
- **Indicadores con al menos un dato reportado:** 34 de 51 (~67%).
- **Documentos en Firestore (agregado por escuela):** 612 (574 con dato + 38 slots vacíos del backfill).
- **Documentos marcados como provisionales:** 405. Requieren sesión de revisión con Sebastián indicador por indicador para pasarlos a "validado".
- **Cobertura de fuentes (tupla escuela × año × indicador × curso):**
  - CON_DATO_REPORTADO: 31
  - SIN_DATO_REPORTADO: 658 (planilla leída, columna vacía)
  - SIN_FUENTE_MAPEADA: 466 (aún no identificamos en qué planilla vive)
  - NO_CORRESPONDE_AUN: 681 (fuera del universo por año de implementación)
- **Indicadores sin fuente mapeada hoy (17):** I.21, I.22, I.23, I.24, I.30, I.32, I.34, I.39, I.48, I.49, I.50, I.51, más los per-curso pendientes. Sebastián debe indicar en qué planilla vive cada uno (Registro Coordinación / Datos Consultor / planilla por curso) o confirmar que no se reporta.
- **Planilla inaccesible:** 1 sola (Sendero del Saber, curso KA). El link apunta a un archivo que ya no existe.

### Comparación entre pares (drilldown del perfil Jardín / Escuela)

- **Agregados precomputados:** 393 documentos en `aggregatesTerritorio_real`.
  - 270 primarios (por SLEP × tipo × año × indicador).
  - 123 fallback (por tipo × año × indicador, todo el programa).
- **Publicables al perfil Jardín / Escuela:** 387 de 393 (98,5%).
- **Bloqueados por privacidad (Ley 21.719):**
  - 4 agregados por estar bajo el mínimo de 4 centros reportando.
  - 2 agregados por riesgo de aislamiento en la comparación año a año.
- En los 6 casos bloqueados, el drilldown muestra automáticamente el "Promedio del programa" (fallback) con una nota que lo explica al usuario.

### Universo territorial

- **4 SLEPs:** Los Parques (SLEP-LP), Santa Rosa (SLEP-SR), Santa Corina (SLEP-SC), Del Pino (SLEP-DP).
- **Distribución Escolar:** SLEP-LP 5 escuelas, SLEP-SR 9, SLEP-SC 4 (18 total).
- **Distribución Parvulario:** SLEP-SR 15 jardines, SLEP-DP 5, SLEP-SC 4 (24 total).
- **9 comunas cubiertas en Escolar** (canónicas, sin variantes).

---

## Notas de operación

- Toda la información de este documento corresponde al estado desplegado en `https://visualizador-paf.web.app` al 5 de agosto de 2026.
- Los detalles técnicos y las decisiones de arquitectura viven en `CLAUDE.md`; los abiertos operativos en `docs/informe-cierre-2026-08-05.md` y `docs/informe-cobertura-fuentes-2026-08-05.md`.
- El pipeline de agregados territoriales (`node scripts/computeTerritorioAggregates.mjs`) debe correrse después de cada ingesta para que el drilldown del perfil Jardín/Escuela se mantenga actualizado.
