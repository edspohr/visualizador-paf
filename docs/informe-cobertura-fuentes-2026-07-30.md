# Informe de cobertura de datos en las fuentes — Visualizador PAF

Fecha: 30 de julio de 2026.

Este documento describe, con nivel de detalle operativo, qué datos están efectivamente llegando desde las fuentes a la plataforma en cada uno de los dos programas del PAF, con el propósito de **cuadrar caso por caso** dónde hay datos, dónde no, y por qué. Al final de cada programa hay una sección con las definiciones o decisiones que faltan de parte de Focus para poder avanzar.

Los dos programas se tratan por separado: son instrumentos distintos, con planillas distintas, contrapartes distintas (Luis para Parvulario, Sebastián para Escolar) y cadencias de reporte distintas. Toda comparación cruzada entre las dos secciones debe evitarse.

---

# Parte A · Parvulario

## A.1 · Universo y fuentes

La plataforma cubre **24 jardines infantiles** distribuidos así:

| Cohorte | Jardines |
|---|---:|
| 2025-2026 (año 2 en 2026) | 15 |
| 2026-2027 (año 1 en 2026) | 9 |

Por sostenedor:

| SLEP | Jardines |
|---|---:|
| Santa Rosa | 15 |
| Del Pino | 5 |
| Santa Corina | 4 |

La fuente única y estable para Parvulario son las **3 Planillas Centrales** que administra Focus, una por cohorte-año:

1. Planilla Central cohorte 2025-2026 · año 1 (2025 calendario).
2. Planilla Central cohorte 2025-2026 · año 2 (2026 calendario).
3. Planilla Central cohorte 2026-2027 · año 1 (2026 calendario).

De cada una se leen dos pestañas específicas: `VISUALIZADOR JARDÍN` (agregado por jardín) y `VISUALIZADOR SALAS` (desglose por sala operativa).

## A.2 · Catálogo canónico

Vigente desde el 29 de julio: **53 indicadores (I.1 a I.53)** distribuidos en 3 ámbitos:

| Ámbito | Nombre display | Indicadores del ámbito | Indicadores de logro |
|---|---|---:|---:|
| A.1 | Gestión institucional | 8 (I.1–I.8) | 3 (I.34–I.36) |
| A.2 | Formación Equipos educativos | 6 (I.9–I.14) | 6 (I.37–I.42) |
| A.3 | Formación Apoderados | 19 (I.15–I.33) | 11 (I.43–I.53) |

## A.3 · Estado actual de la ingesta

En la última corrida de ingesta contra las 3 Planillas Centrales:

| Métrica | Valor |
|---|---:|
| Documentos escritos en la plataforma | 5.010 |
| Jardines efectivamente ingestados | 24 (100% del universo) |
| Documentos por año — 2025 | 1.878 |
| Documentos por año — 2026 | 3.132 |
| Indicadores del catálogo con al menos un dato | 49 / 53 |
| Indicadores sin ningún dato en Firestore | 4 |

Los 5.010 documentos se dividen en agregados por jardín (una fila por jardín × indicador × año) y desgloses por sala operativa (una fila por jardín × indicador × año × nivel), para los indicadores que se reportan a ese nivel de granularidad.

### Distribución por nivel de sala (docs desagregados)

| Nivel | Documentos |
|---|---:|
| Sala cuna mayor | 882 |
| Sala cuna menor | 650 |
| Nivel medio menor | 857 |
| Nivel medio mayor | 835 |
| Transición 1 | 44 |
| Transición 2 | 0 |

**Observación**: Transición 1 con sólo 44 documentos y Transición 2 con cero es una anomalía visible en las planillas. La mayoría de jardines infantiles no reportan sistemáticamente al nivel Transición, aunque el nivel exista en su matrícula.

### Distribución por ámbito × año (docs con valor)

| Ámbito | 2025 | 2026 |
|---|---:|---:|
| A.1 Gestión institucional | 120 | 216 |
| A.2 Formación Equipos educativos | 247 | 517 |
| A.3 Formación Apoderados | 1.511 | 2.399 |

La proporción refleja la estructura del catálogo (A.3 tiene 30 indicadores; A.1 tiene 11).

## A.4 · Indicadores sin ningún dato

Cuatro indicadores del catálogo canónico Parvulario no tienen **ningún** dato reportado en ninguna de las 3 Planillas Centrales. Todos son de logro (producto).

| Código | Ámbito | Nombre | Unidad | Meta | Notas |
|---|---|---|---|---|---|
| I.35 | A.1 | % de acciones implementadas del plan de acción | Porcentaje | 75% | Depende de que el plan de acción esté cargado y con seguimiento en la planilla del jardín. |
| I.36 | A.1 | % de metas logradas del plan de acción | Porcentaje | 75% | Idem. |
| I.37 | A.2 | % de agentes educativas con malla formativa completa | Porcentaje | 90% | La columna existe en la Planilla Central pero llega vacía en las 3 planillas. |
| I.53 | A.3 | % de familias que completan ciclo de formación de talleres Entre Familias | Porcentaje | 50% | Se reporta al cierre del ciclo formativo; probablemente esperable que llegue vacío mid-year. |

**Recomendación**: revisar caso por caso con las duplas consultora-jardín. Los dos de A.1 (I.35, I.36) dependen del avance del plan de acción, que sí se está trayendo estructuralmente pero sin datos numéricos. El de A.2 (I.37) tiene la columna presente pero vacía en todas las planillas. El de A.3 (I.53) puede ser una brecha de timing (aún no ha cerrado el ciclo).

## A.5 · Indicador I.1 recién agregado — pendiente de metadata

El 29 de julio se agregó al catálogo canónico un indicador nuevo:

- **I.1** — "N° de visitas al jardín infantil" (ámbito A.1, indicador del ámbito).

La planilla lo reporta y de hecho ya hay datos ingestados para él (por ejemplo, jardín Akun Pichiwentxu reportó 22 visitas en 2025 y 10 en 2026). **Sin embargo, aparece en el catálogo con "Sin meta reportable"** porque Focus todavía no confirmó su meta, unidad, frecuencia y fuente definitivas desde el sheet `Indicadores PAF Parvulario`.

Consecuencia práctica: el valor se ve en el detalle del indicador, pero **no entra en el porcentaje del ámbito A.1** hasta que Focus complete la metadata.

## A.6 · Cobertura del catálogo por ámbito (con datos)

Sobre los 49 indicadores con al menos un dato:

- **A.1 Gestión institucional**: 8 indicadores del ámbito + 3 logros = 11 en catálogo. Con dato: **10 de 11** (falta I.35). Con dato "parcial" (I.36): 10 de 11.

  Espera: 8 del ámbito reportados + 3 logros teóricos, 1 con dato solo si el plan de acción tiene números.

- **A.2 Formación Equipos educativos**: 6 + 6 = 12 en catálogo. Con dato: **11 de 12** (falta I.37).

- **A.3 Formación Apoderados**: 19 + 11 = 30 en catálogo. Con dato: **29 de 30** (falta I.53).

## A.7 · Sección Parvulario · definiciones que faltan de parte de Focus

Para poder avanzar con la cobertura Parvulario, necesitamos las siguientes definiciones concretas:

### 1. Metadata canónica del indicador I.1 "N° de visitas al jardín infantil"

De la planilla `Indicadores PAF Parvulario` (Google Drive), necesitamos:

- **Meta**: valor humano-legible (por ejemplo "12 visitas al año").
- **Meta numérica**: valor numérico contra el cual se calcula el logro.
- **Tipo de meta**: `porcentaje`, `numero`, `booleano` o `sin_meta`.
- **Unidad**: `%`, `conteo`, `promedio`, `booleano` o `sin_meta`.
- **Frecuencia de reporte**: mensual / trimestral / semestral / anual.
- **Fuente**: nombre del origen (por ejemplo "Consultor", "Registro jardín", "Planilla central").
- **Inicio**: desde qué semestre de la implementación aplica (`Sem 1`, `Sem 2`, `Primer año`, `Segundo año` o vacío si aplica desde el inicio).

Con estos siete campos, el indicador queda habilitado para agregarse al porcentaje del ámbito A.1 en los 24 jardines.

### 2. Confirmación sobre los 4 indicadores sin datos

Para cada uno de los cuatro indicadores que actualmente no tienen ningún dato, necesitamos que Focus confirme si:

- El indicador se debe reportar y aún no se ha hecho, en cuyo caso hay que coordinar con las duplas consultora-jardín; o
- El indicador se reporta al cierre de año y por eso llega vacío mid-year, en cuyo caso queda documentado como esperable y se retomará al cierre; o
- El indicador no aplica al ciclo 2026 en curso y conviene marcarlo como no vigente en la plataforma.

Los cuatro casos:

| Código | Nombre | Estado esperable | Decisión pendiente |
|---|---|---|---|
| I.35 | % de acciones implementadas del plan de acción | Depende del avance del plan | ¿reporte al cierre? ¿o problema de captura? |
| I.36 | % de metas logradas del plan de acción | Depende del avance del plan | idem |
| I.37 | % de agentes educativas con malla formativa completa | Columna vacía en las 3 planillas | ¿la malla se cierra al final del año? |
| I.53 | % de familias que completan ciclo Entre Familias | Al cierre del ciclo formativo | ¿está esperado que llegue vacío ahora? |

### 3. Reporte al nivel Transición

El nivel Transición 1 tiene solo 44 documentos ingestados (vs cientos en los otros niveles). Transición 2 tiene cero. Preguntas para Focus:

- ¿Los jardines del universo Parvulario tienen efectivamente matrícula Transición 1 y 2?
- Si la tienen, ¿por qué no se reporta a ese nivel de granularidad en las Planillas Centrales?
- ¿Debemos considerar el nivel Transición fuera del universo Parvulario y solo permitir el desglose por Sala Cuna Menor/Mayor y Nivel Medio Menor/Mayor?

### 4. Confirmación de la contraparte por SLEP

El roster que tenemos hoy indica tres SLEP: Santa Rosa (15 jardines), Del Pino (5) y Santa Corina (4). La documentación previa mencionaba también SLEP Los Parques para Parvulario, pero **ningún jardín Parvulario está registrado ahí**. Confirmar si Los Parques efectivamente no tiene jardines infantiles PAF, o si son casos que aún no están cargados en la Base de Datos de identificación.

---

# Parte B · Escolar

## B.1 · Universo y fuentes

La plataforma cubre **18 escuelas** en dos cohortes:

| Cohorte | Escuelas |
|---|---:|
| 2026-2028 (año 1 en 2026) | 13 |
| 2025-2027 (año 2 en 2026) | 5 |

Por sostenedor:

| SLEP | Escuelas |
|---|---:|
| Santa Rosa | 9 |
| Los Parques | 5 |
| Santa Corina | 4 |

**A diferencia de Parvulario, no existe una planilla central única para Escolar.** El programa opera con una planilla por escuela × año × arquetipo. Sebastián confirmó verbalmente que toda la información necesaria vive en las planillas que ya compartió. El detalle:

- Para cada escuela × año hay una planilla "Registro Coordinación" (o "Registro UTP" en 2025).
- Para cada escuela × año hay una planilla "Datos Consultor".
- Para cada curso × año que existe en la escuela hay una planilla individual por curso (PKA, PKB, KA, KB, 1A, 1B, ..., 8A, 8B, y adicionalmente 8C en 2025).

El total esperado es de **466 planillas** — 70 en el bloque 2025 (correspondientes a las 5 escuelas cohorte 2025-2027, año 1) y 396 en el bloque 2026 (las 18 escuelas del universo). Todo esto está declarado en el archivo `Planillas PAF Escolar` que Sebastián compartió; extrajimos el inventario a un artefacto interno de la plataforma y todos los conteos coinciden con las planillas verificables.

## B.2 · Catálogo canónico

Vigente desde el 29 de julio: **51 indicadores (I.1 a I.51)** distribuidos en 4 ámbitos:

| Ámbito | Nombre display | Indicadores del ámbito | Indicadores de logro |
|---|---|---:|---:|
| A.1 | Gestión institucional | 10 (I.1–I.10) | 3 (I.33–I.35) |
| A.2 | Formación Equipo educativo | 10 (I.11–I.20) | 3 (I.36–I.38) |
| A.3 | Formación Apoderados | 7 (I.21–I.27) | 9 (I.39–I.47) |
| A.4 | Formación Estudiantes | 5 (I.28–I.32) | 4 (I.48–I.51) |

## B.3 · Estado actual del harvest

El **harvest** (proceso automatizado que baja el contenido de las 466 planillas para procesarlo offline) se corrió por primera vez en su versión completa el 30 de julio. Resultado:

| Métrica | Valor |
|---|---:|
| Planillas intentadas | 466 |
| Planillas leídas exitosamente | 396 |
| Planillas inaccesibles (error permanente) | 69 |
| Duración total | 18 minutos |
| Valores personales redactados en vuelo | 37.773 |

Toda la barrera de datos personales de estudiantes (RUT + nombre) funcionó: cero registros con PII quedaron en la base de datos ni en los archivos intermedios (verificado con la aserción automática después del harvest).

### Las 69 planillas inaccesibles

Todas son errores permanentes; no son fallas transitorias.

**68 son del bloque 2025**, específicamente todas las planillas 2025 del SLEP Los Parques (las 5 escuelas cohorte 2025-2027). La cuenta de servicio que hace el harvest no tiene acceso concedido a ese bloque completo.

| Escuela | Planillas 2025 inaccesibles |
|---|---:|
| Escuela Inglaterra | 22 |
| Escuela Abate Molina | 12 |
| Escuela Gil de Castro | 12 |
| Escuela Platón | 12 |
| Escuela España | 10 |

Solo 2 planillas de todo el bloque 2025 fueron accesibles: cursos 1A y 2A de Escuela España.

**1 es un link roto en 2026**: la planilla de Escuela Básica Sendero del Saber, curso KA, apunta a un spreadsheet que ya no existe (probablemente eliminado o el ID en el índice está mal escrito).

## B.4 · Estado actual de la ingesta a la plataforma

Independientemente del harvest, hay una vía de ingesta más antigua (implementada en la etapa 5) que baja datos escuela × indicador × año para 2026. Su estado hoy:

| Métrica | Valor |
|---|---:|
| Documentos escritos en la plataforma | 502 |
| Escuelas efectivamente ingestadas | 18 (100% del universo) |
| Documentos por año — 2026 | 502 |
| Documentos por año — 2025 | 0 |
| Estado de los documentos | 169 validados, 333 provisionales |
| Indicadores del catálogo con al menos un dato | 30 / 51 |

El 66% de los documentos están marcados como **provisionales**. Esto significa que la semántica exacta de la columna que se está leyendo aún no está confirmada con Sebastián: el mapeo funciona pero el resultado puede necesitar revisión antes de ser tomado como cifra final.

## B.5 · Indicadores sin ningún dato

**21 de los 51 indicadores canónicos Escolar 2026 no tienen ningún dato** hoy en la plataforma:

### Por origen probable

**8 indicadores dependen de la Encuesta de Apoderados** — la pestaña existe estructurada en las planillas de las escuelas pero llega vacía mid-year. La expectativa es que se llene al cierre del año escolar. Son:

- I.22 (% asistencia anual a talleres para apoderados)
- I.29 (Libros de Biblioteca Viajera recibidos por estudiante)
- I.30 (Envío de Lecturas Viajeras por sala)
- I.31 (% de salas que envían Mantel de Palabras)
- I.42 (% apoderados que declaran haber descargado talleres)
- I.43 (Promedio de libros de BV que declaran usar las familias)
- I.44 (Promedio de Lecturas Viajeras que declaran usar)
- I.45 (% apoderados que declaran usar mantel de palabras)

**13 indicadores no tienen fuente identificada hoy** — necesitamos que Sebastián confirme en qué planilla individual de cada escuela se reportan, o si aún no se reportan. Son:

- I.10 (Existe plan de acción actualizado)
- I.13 (Director asiste a módulos formativos)
- I.14 (Coordinador asiste a módulos formativos)
- I.21 (Número de talleres para apoderados presenciales por sala)
- I.23 (Número de talleres digitales enviados por sala)
- I.24 (Visualizaciones promedio de talleres digitales)
- I.32 (Número de talleres para estudiantes por sala 1º–8º)
- I.34 (% cumplimiento del plan de acción familia escuela)
- I.39 (% Talleres liderados por dupla monitor-profesor)
- I.48 (Actividades de mediación Biblioteca Viajera)
- I.49 (Actividades de aula de Lecturas Viajeras)
- I.50 (% de salas que hacen mediación del Mantel de Palabras previo al envío)
- I.51 (Actividades de mediación del mantel post-envío)

## B.6 · Coincidencias entre catálogos 2025 y 2026

El catálogo 2025 tiene 50 indicadores; el canónico 2026 tiene 51. Son instrumentos distintos, no una simple renumeración: 34 de 50 indicadores 2025 tienen un equivalente reconocible en 2026, 16 no lo tienen (probablemente eliminados o fusionados), y 21 indicadores 2026 son nuevos.

Además, entre los 34 que sí coinciden por nombre, encontramos **25 discrepancias de meta** entre lo que dice el catálogo 2025 y lo que dice el catálogo canónico 2026 (por ejemplo, "Número de reuniones anuales del Equipo de Gestión" tenía meta 5 en 2025 y meta 10 en 2026). El detalle de las 25 vive en el reporte interno de discrepancias y necesita revisión caso por caso con Sebastián.

## B.7 · Cobertura del catálogo por ámbito (con datos)

Sobre los 30 indicadores con al menos un dato:

- **A.1 Gestión institucional**: 10 + 3 = 13 en catálogo. Con dato: **11 de 13** (falta I.10 y I.34).
- **A.2 Formación Equipo educativo**: 10 + 3 = 13 en catálogo. Con dato: **11 de 13** (falta I.13 y I.14).
- **A.3 Formación Apoderados**: 7 + 9 = 16 en catálogo. Con dato: **7 de 16** (faltan I.21, I.22, I.23, I.24, I.39, I.42, I.43, I.44, I.45).
- **A.4 Formación Estudiantes**: 5 + 4 = 9 en catálogo. Con dato: **1 de 9** (solo I.28; faltan I.29, I.30, I.31, I.32, I.48, I.49, I.50, I.51).

El ámbito A.4 Formación Estudiantes es el más golpeado: cerca del 90% de sus indicadores no tiene datos hoy, mayoritariamente por depender de la Encuesta de Apoderados y por falta de mapeo declarado.

## B.8 · Sección Escolar · definiciones que faltan de parte de Focus

Para poder avanzar con la cobertura Escolar, necesitamos las siguientes acciones o definiciones concretas:

### 1. Acceso a las 68 planillas 2025 de Los Parques

**Bloqueo operativo directo**: la cuenta de servicio que hace el harvest no tiene acceso a ninguna planilla 2025 de las 5 escuelas cohorte 2025-2027. Se necesita que Focus (o el sostenedor correspondiente) comparta esas 68 planillas con la cuenta de servicio en modo lectura. Sin este paso, el histórico 2025 de Escolar es imposible de ingestar y cualquier comparación año-a-año Escolar tiene el lado 2025 vacío.

Alternativa razonable: si compartir el bloque 2025 completo no es viable (por decisión de Focus o de Los Parques), Sebastián puede confirmar formalmente que 2025 histórico no se incorporará a la plataforma y ajustamos el comparador para no ofrecer esa comparación en Escolar.

### 2. Arreglar el link de la planilla Escuela Básica Sendero del Saber curso KA (2026)

En el índice `Planillas PAF Escolar`, la celda de esa planilla apunta a un spreadsheet que ya no existe en Drive. Sebastián debe verificar si:

- El spreadsheet fue eliminado y debe recuperarse desde papelera, o
- El curso KA no existe en Sendero del Saber y la celda debería estar en blanco o marcada "No aplica", o
- El link en el índice tiene un error de copiado y debe corregirse.

### 3. Identificar la fuente de los 13 indicadores sin mapeo

Para cada uno de los 13 indicadores listados en §B.5 sección "no tienen fuente identificada", necesitamos que Sebastián indique:

- En qué planilla específica se reporta (Registro Coordinación / Datos Consultor / planilla por curso / otra), o
- Que aún no se está reportando y no se prevé reportar en el ciclo 2026, en cuyo caso se marca como no vigente y sale del catálogo activo.

### 4. Confirmar las metas conflictivas del sheet `Indicadores PAF Escolar`

El sheet tiene tres pestañas con metas distintas para los mismos indicadores. Diferencias detectadas en:

| Indicador | Pestaña 1 | Pestaña 2 |
|---|---|---|
| I.9 (Existe plan de acción diseñado) | SI | — |
| I.10 (Existe plan actualizado) | — | SI |
| I.26 (Apoderados monitores formados) | 153 | 60 |
| I.29 (Libros de BV recibidos por estudiante) | 10 | 15 |
| I.43 (Libros de BV que declaran usar familias) | 7 | 10 |
| I.46 (Instrumentos de fomento lector) | 153 | 60 |

Necesitamos que Sebastián confirme cuál pestaña gobierna. La plataforma hoy usa la pestaña `Indicadores año 1, 2026`. Si esa no es la correcta, los porcentajes de logro de esos seis indicadores están calculados con la meta equivocada.

### 5. Definir cómo tratar los 66% de documentos marcados como provisionales

De los 502 documentos ingestados hoy, 333 (66%) están marcados como **provisionales**: el mapeo funciona pero la semántica exacta de la columna que se está leyendo no está confirmada con Sebastián. Necesitamos una sesión focalizada donde Sebastián revise, indicador por indicador provisional, si el resultado es correcto. Los que se validen pasan a "validados" y los que no, se corrigen en el código.

### 6. Decisión sobre la comparación año a año Escolar en el comparador

Como los catálogos 2025 y 2026 son instrumentos distintos, la comparación por identidad de código en el comparador puede estar mostrando resultados no comparables. Tres opciones:

- **Opción A**: deshabilitar la comparación 2025 vs 2026 en Escolar por completo.
- **Opción B**: mostrar una advertencia explícita en el comparador cuando el eje año se mueva a 2025 en Escolar, y esconder los indicadores sin match reconocido.
- **Opción C**: reestructurar el catálogo 2025 al mapa canónico 2026. Es una tarea grande (~50 indicadores caso por caso).

Necesitamos que Luis y Sebastián decidan cuál de las tres.

### 7. Definición del rol de "cumplimiento" que trae Focus vs el que calcula la plataforma

El consolidado 2025 que administra Focus incluye una columna `Cumplimiento` calculada en la propia planilla. La plataforma calcula su propio porcentaje con la fórmula validada con Luis. Los dos números pueden diferir. Necesitamos decisión editorial: ¿mostrar los dos side by side con explicación de por qué difieren, mostrar solo el de la plataforma, o solo el de Focus?

---

## Nota final

Toda esta información es reproducible en cualquier momento corriendo los scripts internos de la plataforma. El objetivo del informe es **cuadrar los números** en una sola instancia para que Focus y la contraparte técnica trabajen sobre la misma base al momento de resolver cada punto.

Las cifras aquí reportadas corresponden al estado desplegado en `https://visualizador-paf.web.app` al 30 de julio de 2026.
