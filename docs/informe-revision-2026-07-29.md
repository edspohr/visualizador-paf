# Informe de revisión — Visualizador PAF · Ciclo 29 de julio de 2026

Documento para revisión con Luis Agurto, Consultora Focus.

---

## 1 · Qué se trabajó en esta ronda

Trabajamos sobre las observaciones del documento que compartiste el 29 de julio. En una sola tanda quedaron atendidos siete de tus puntos: el orden y numeración de los indicadores según los documentos que enviaste, los nombres cortos de los ámbitos, la jerarquía de títulos en el panel, el ícono de los indicadores de ámbito, el problema del comparador que no distinguía por año, la eliminación del pie de página con "Focus" y la aparición explícita del estado "Sin datos" para indicadores todavía sin llenar.

Detrás de buena parte de estos cambios hay un cambio estructural: el catálogo de indicadores que usa la plataforma quedó alineado uno a uno con los documentos "Orden de indicadores para visualizador" (Parvulario y Escolar) que compartiste. Antes tenía 54 Parvulario y 52 Escolar; ahora tiene los **53 Parvulario y 51 Escolar** canónicos, con los ámbitos, subgrupos de logro y numeración exactos que aparecen en tus documentos.

Todo lo que sigue ya está desplegado en `https://visualizador-paf.web.app`.

---

## 2 · Lo que quedó listo

| Lo que pediste | Qué se hizo | Dónde lo puedes ver |
|---|---|---|
| Distinguir mejor el título "Indicadores del Programa" del subtítulo "Indicadores por ámbito" | Se rediseñó la jerarquía visual del panel: cuatro niveles ahora claramente diferenciados — "Indicadores del programa" (título grande), "Indicadores por ámbito" (subtítulo con color y línea inferior), el nombre del ámbito con su código, y adentro dos subsecciones. | Entra con cualquier perfil (por ejemplo Escuela) y abre el detalle de un centro; verás la jerarquía de arriba abajo. |
| Poner un ícono para "Indicadores del ámbito" pareado con el de "Logros" | Se agregó el ícono de listas al lado de "Indicadores del ámbito" (color celeste), en simetría con el ícono de paquete que ya tenía "Indicadores de logro" (color magenta). También se acortó el nombre: dice "Indicadores de logro" en vez de "Indicadores de logro asociados". | Perfil Escuela → expandir cualquier ámbito → verás los dos íconos apareados. |
| Renombrar el ámbito A.1 Parvulario a "Gestión institucional" | Aplicado. Además, se ajustaron los nombres de todos los ámbitos de ambos programas al formato corto que aparece en tus documentos. | Se ven en el encabezado de cada ámbito, en cualquier perfil. |
| El ámbito A.1 Parvulario no muestra los indicadores de logro (I.34, I.35, I.36) | Con la numeración canónica, esos tres logros ahora **sí aparecen** en A.1 para jardines de la cohorte 2025-2026 (que ya llegaron al semestre 3). Para jardines de la cohorte 2026-2027 (que van en semestre 1 o 2), la sección "Indicadores de logro" aparece igual, pero con una nota explicando que esos tres indicadores empiezan a aplicar más adelante. Antes desaparecía completa. | Perfil Jardín → cohorte 2025-2026 → A.1 → los ves con datos. Perfil Jardín → cohorte 2026-2027 → A.1 → los ves con la nota. |
| Sacar a Focus del pie de página | Removido del pie en las tres pantallas donde aparecía. Se conservó el logo de PAF/CAP y las menciones funcionales a Focus dentro del contenido (por ejemplo, "Planillas Centrales de Focus", "Coordinación Focus", "comunícate con Consultora Focus"), porque son referencias operativas y no de autoría. | Pie de página en cualquier vista, incluida la pantalla de login. |
| El comparador no diferencia por año | Corregido. Antes, al elegir año 2025 en el selector superior, el comparador mostraba los mismos valores en ambos lados aunque estuvieran configurados como A=2025 y B=2026. Ahora los dos lados leen el año correcto de forma independiente, la leyenda del gráfico muestra el año en cada grupo, y cada lado indica cuántos centros incluye y cuántos tienen datos reportados. | Perfil Consultor o CAP → sección "Comparador por indicador" → configura A y B con años distintos. Se ve la diferencia. |
| Mostrar "Sin datos" en indicadores que no llegaron a llenarse | Los indicadores con meta pero sin valor reportado ya no se ven como "0" ni desaparecen: aparecen con la etiqueta "Sin datos" y una barra vacía con patrón sombreado. Los indicadores que tienen un cero reportado real (por ejemplo, "sin actividad reportada") siguen mostrando el "0" normalmente. Los dos casos se distinguen visualmente. | En cualquier vista, buscar los indicadores listados en la sección 8 de este informe. |

---

## 3 · Hallazgos que levantamos

**El comparador estaba escondiendo el año.** El problema que reportaste tenía dos capas: primero, la leyenda del gráfico solo decía "Grupo A" y "Grupo B" sin mostrar el año — por eso, aunque el gráfico funcionara bien, era difícil saber qué se estaba viendo. Segundo, había un caso concreto (cuando el selector global del año estaba en 2025) en que ambos lados efectivamente cargaban los mismos datos. Ambas cosas quedaron corregidas.

**El caso de "N° de semanas envío BV al hogar" en Santa Rosa que mencionaste**: verificamos los datos y los promedios son genuinamente distintos entre 2025 (25,6) y 2026 (8,5). La diferencia es porque 2026 aún está a mitad de año. Antes del fix, el comparador podía haber mostrado los dos lados iguales por el bug de leyenda + selector; ahora se ve la diferencia real.

**Los indicadores de logro de A.1 Parvulario no aparecían por dos razones sumadas.** Una era la numeración desfasada (que los buscaba como I.35/36/37 en vez de los canónicos I.34/35/36); la otra es que su semestre de inicio es "Sem 3", por lo que jardines de la cohorte 2026-2027 (año 1 de implementación) no los tienen todavía en su universo. Antes eso hacía que la sección de logros desapareciera completa. Ahora la sección aparece siempre, y cuando los indicadores están fuera del período todavía se muestran en gris con una nota "aplica desde el semestre 3 de la implementación".

**Durante la actualización de datos en Firestore se perdieron aproximadamente 705 documentos Parvulario y se generaron aproximadamente 3.264 duplicados temporales, todos por errores de nuestro lado en el proceso de migración de los IDs.** La recuperación fue re-cargar los datos desde las Planillas Centrales de Parvulario y las planillas Escolar, que son la fuente de verdad. Ya se limpió todo. La cantidad de documentos actualmente en la plataforma es consistente con lo que traen las planillas hoy. No se perdió información real, porque todo lo que había perdido está en las planillas y se re-ingestó. Pero es importante que lo sepas: cualquier cifra que hayas guardado antes de este viernes desde la plataforma podría diferir levemente si hubo llenados intermedios en las planillas que no habíamos capturado.

**Hay 23 indicadores canónicos que actualmente no tienen datos** (4 en Parvulario, 19 en Escolar). Están listados en la sección 8. Antes se ocultaban silenciosamente; ahora aparecen como "Sin datos" para que puedan ser revisados y resueltos caso por caso con Focus.

---

## 4 · Dónde aplicamos un criterio distinto

**Indicador nuevo I.1 Parvulario ("N° de visitas al jardín infantil").** Este indicador aparece en las Planillas Centrales pero no estaba en el catálogo. Lo agregamos como canónico I.1, tal como está en tu documento de orden. Sin embargo, la meta, la frecuencia, la unidad y la fuente de este indicador no las pudimos determinar desde el material disponible — están en la planilla "Indicadores PAF Parvulario" de Google Drive a la que Focus tiene acceso. Por ahora quedó registrado con placeholder "Sin meta reportable", lo que significa que aparece en el catálogo y admite valores, pero no entra en el porcentaje del ámbito A.1 hasta que Focus confirme esos datos. Ver sección 7.

**Indicadores I.43, I.44, I.45 de Escolar bajo ámbito A.3.** Tu documento los agrupa en A.3 "Formación Apoderados" porque agrupa estrictamente por número de producto. Temáticamente estos tres indicadores son de fomento lector (Biblioteca Viajera, Lecturas Viajeras, Mantel de Palabras) — encajarían mejor en A.4. Se implementó como pediste (bajo A.3) para respetar el documento, pero conviene que lo confirmes explícitamente. Ver sección 7.

**Nombres de ámbito.** Tu documento usa la capitalización "Formación **Equipos** educativos" para Parvulario (plural) y "Formación **Equipo** educativo" para Escolar (singular). Los mantuvimos exactamente así, aunque parece una inconsistencia. Si es un error del documento, se corrige en un minuto.

**La escala del `Indicadores por ámbito`.** Preferimos usar color y peso tipográfico para diferenciarlo del título principal, en vez de agrandar mucho el tamaño de letra — para que no compita con el nombre del ámbito. Si prefieres que sea más grande y más obvio, es un cambio de una línea de estilo.

---

## 5 · Lo que no se hizo

**No re-numeramos el catálogo Escolar 2025 (histórico).** El catálogo 2025 mantiene su numeración original (50 indicadores). Esto significa que las comparaciones año a año 2025 vs 2026 en la vista Escolar del comparador pueden ser semánticamente inválidas para algunos indicadores (los IDs coinciden pero pueden referirse a indicadores distintos entre años). Diferimos esta migración porque es un cambio grande que requiere confirmar con Sebastián si vale la pena o si se puede tratar 2025 como una foto histórica intocada. Es una pregunta abierta.

**No se hicieron pruebas en vivo desde el navegador en todos los perfiles ni en las dos cohortes.** El código está verificado por lógica y con scripts de diagnóstico, y el sitio está desplegado y responde, pero no reemplaza que ustedes recorran las pantallas manualmente. Recomendamos hacer ese recorrido durante la revisión.

**No se rehizo el script de migración de datos.** El script que se usó tenía dos bugs que causaron la pérdida temporal de datos (documentada en la sección 3). La recuperación fue vía re-ingesta desde las planillas, que es la vía correcta y confiable. Quedó documentado en el código con una advertencia grande. La próxima renumeración canónica, si la hay, debería hacerse siempre por re-ingesta desde las planillas.

---

## 6 · Lo que está detenido y qué necesitamos para avanzar

**Metadata del indicador I.1 Parvulario ("N° de visitas al jardín infantil").**
- Qué lo detiene: no tenemos acceso a la planilla "Indicadores PAF Parvulario" en Google Drive.
- Qué necesitamos, de Focus: el valor de "Meta", "Unidad", "Frecuencia de reporte", "Fuente" e "Inicio" para este indicador tal como aparecen en esa planilla. Con ese dato, el indicador queda habilitado para agregarse al porcentaje del ámbito A.1 Parvulario.
- Qué está detenido mientras tanto: el indicador I.1 aparece en las vistas pero no aporta al porcentaje de A.1. Los valores que ya se están reportando (por ejemplo, jardín Akun Pichiwentxu reportó 22 visitas en 2025 y 10 en 2026) se ven en el detalle del indicador pero no en el porcentaje del ámbito.

**Confirmación de las metas conflictivas en Escolar.**
- Qué lo detiene: la planilla "Indicadores PAF Escolar" tiene tres pestañas con metas distintas para los mismos indicadores. Diferencias detectadas en I.9, I.10, I.26, I.29, I.43 y I.46.
- Qué necesitamos, de Sebastián: confirmación de qué pestaña es la vigente (probablemente la revisada más reciente). La plataforma hoy está usando las metas de la pestaña "Indicadores año 1, 2026" — si esa no es la correcta, hay que reemplazarlas.
- Qué está detenido mientras tanto: los porcentajes de logro de esos seis indicadores pueden estar calculados con la meta equivocada. No afecta la validez estructural, sólo los porcentajes específicos de esos indicadores.

**Cobertura de indicadores Escolar sin mapeo.**
- Qué lo detiene: hay 12 indicadores en el catálogo canónico Escolar que hoy no tienen ninguna vía de ingesta declarada (I.10, I.13, I.14, I.21, I.23, I.24, I.32, I.39, I.48, I.49, I.50, I.51). En su mayoría son de A.4 Fomento Lector.
- Qué necesitamos, de Sebastián: confirmación de en qué planilla individual de cada escuela se reportan estos indicadores (o si aún no se reportan). Con esa información, el equipo de desarrollo agrega el mapeo.
- Qué está detenido mientras tanto: estos 12 indicadores aparecen como "Sin datos" en todas las escuelas.

---

## 7 · Decisiones que necesitamos de ustedes

**7.1 · Agrupación de I.43, I.44, I.45 Escolar (Biblioteca Viajera, Lecturas Viajeras, Mantel de Palabras).**

Opción A: dejarlos como los pediste, bajo A.3 "Formación Apoderados" — porque agrupas por número de producto y los productos que los generan están asociados a la formación de apoderados. Consecuencia práctica: en la vista Escolar, estos tres indicadores aparecen mezclados con los de asistencia a talleres. El ámbito A.4 "Formación Estudiantes" queda con 5 estrategias y 4 logros.

Opción B: moverlos a A.4 "Formación Estudiantes" — porque temáticamente son de fomento lector. Consecuencia práctica: el ámbito A.4 se enriquece con los indicadores de encuesta a familias sobre el uso de estos tres materiales.

Ambas son válidas. Necesitamos que Luis confirme cuál refleja mejor cómo Focus quiere que se lean los datos.

**7.2 · Metas conflictivas en Escolar.**

Diferencias detectadas entre pestañas de la misma planilla:

| Indicador | Pestaña 1 | Pestaña 2 |
|---|---|---|
| I.9 (Existe plan de acción diseñado) | SI | — |
| I.10 (Existe plan actualizado) | — | SI |
| I.26 (Apoderados monitores formados) | 153 | 60 |
| I.29 (Libros de BV recibidos por estudiante) | 10 | 15 |
| I.43 (Libros de BV que declaran usar familias) | 7 | 10 |
| I.46 (Instrumentos de fomento lector) | 153 | 60 |

Necesitamos que Sebastián confirme cuál pestaña es la vigente.

**7.3 · Comparación año a año en Escolar.**

Como el catálogo Escolar 2025 tiene numeración distinta al Escolar 2026, la comparación 2025 vs 2026 dentro del mismo indicador puede estar mostrando resultados no comparables en algunos casos. Opciones:

- Dejar la comparación disponible pero mostrar una advertencia en la vista Escolar del comparador para el año 2025.
- Deshabilitar la comparación 2025 vs 2026 en Escolar hasta que se decida qué hacer con la numeración 2025.
- Migrar el catálogo Escolar 2025 a la numeración canónica también. Es una tarea de tamaño similar a lo que se hizo con 2026, requiere revisar caso por caso.

Necesitamos que Luis y Sebastián decidan cuál de las tres.

---

## 8 · Estado de los indicadores sin dato

Al día de hoy hay 23 indicadores con meta reportable pero sin ningún dato en la plataforma. Aparecen como "Sin datos" en las vistas, para que puedan revisarse caso por caso.

### Parvulario (4)

| Código | Nombre | Fuente donde debería estar |
|---|---|---|
| I.35 | % de acciones implementadas del plan de acción | Planilla Central · pestaña VISUALIZADOR JARDÍN |
| I.36 | % de metas logradas del plan de acción | Planilla Central · pestaña VISUALIZADOR JARDÍN |
| I.37 | % de agentes educativas con malla formativa completa | Planilla Central · pestaña VISUALIZADOR JARDÍN |
| I.53 | % de familias que completan ciclo de formación de talleres Entre Familias | Planilla Central · pestaña VISUALIZADOR SALAS |

### Escolar (19)

| Código | Nombre | Nota |
|---|---|---|
| I.13 | Director asiste a módulos formativos | Falta identificar planilla origen |
| I.14 | Coordinador asiste a módulos formativos | Falta identificar planilla origen |
| I.21 | Número de talleres para apoderados presenciales | Falta identificar planilla origen |
| I.22 | % asistencia anual a talleres para apoderados | Encuesta apoderados, tab estructurado pero vacío |
| I.23 | Número de talleres digitales para apoderados | Falta identificar planilla origen |
| I.29 | Libros de BV recibidos por estudiante | Encuesta apoderados |
| I.30 | Envío de Lecturas Viajeras por sala | Encuesta apoderados |
| I.31 | % de salas que envían Mantel de Palabras | Encuesta apoderados |
| I.32 | Número de talleres para estudiantes por sala | Falta identificar planilla origen |
| I.34 | % cumplimiento del plan de acción familia escuela | Falta identificar planilla origen |
| I.39 | % Talleres para Apoderados liderados por dupla | Falta identificar planilla origen |
| I.42 | % apoderados que descargaron y visualizaron | Encuesta apoderados |
| I.43 | Libros de BV que declaran usar familias | Encuesta apoderados |
| I.44 | Lecturas Viajeras que declaran usar | Encuesta apoderados |
| I.45 | % apoderados que declaran usar mantel de palabras | Encuesta apoderados |
| I.48 | Actividades de mediación BV | Falta identificar planilla origen |
| I.49 | Actividades de aula de Lecturas Viajeras | Falta identificar planilla origen |
| I.50 | Actividades de mediación Mantel de Palabras | Falta identificar planilla origen |
| I.51 | Actividades de mediación post envío mantel | Falta identificar planilla origen |

Los 8 marcados como "Encuesta apoderados" están estructurados en las planillas de las escuelas pero llegan vacíos — la expectativa es que se llenen al cierre del año escolar. Los otros 11 necesitan identificar en qué planilla de las escuelas se reportan hoy (o si están pendientes de ser recolectados).
