# Informe de cobertura de datos en las fuentes — Visualizador PAF

Fecha: 5 de agosto de 2026.

Este documento es la actualización del informe del 30 de julio de 2026. Describe el estado de cobertura de datos al 5 de agosto y los cambios respecto a la entrega anterior. La estructura de secciones es idéntica al informe anterior; solo se actualiza el texto donde hay cambios de fondo.

Los dos programas se tratan por separado: son instrumentos distintos, con planillas distintas, contrapartes distintas (Luis para Parvulario, Sebastián para Escolar) y cadencias de reporte distintas.

---

## Cambios respecto al 30 de julio

| Área | Cambio |
|---|---|
| Harvest Escolar | 68 planillas 2025 de Los Parques ahora accesibles (total: 465/466 OK) |
| Cobertura manifest | Sin cambios — las planillas recién accesibles llegan vacías mid-year (esperado) |
| Territorial | Ramón del Río reparado (slep/comuna/sostenedor ya no nulos) |
| Territorial Parvulario | 15 jardines con comunas en MAYÚSCULAS o "PAC" corregidos a formato canónico |
| Auth / perfiles | Perfiles jardin, escuela y sostenedor ahora leen solo sus propios datos (sin fuga) |
| Planilla sin acceso | 1 link roto permanente: Sendero del Saber · 2026 · curso KA (sin cambios) |

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

Sin cambios respecto al 30 de julio. La última corrida de ingesta contra las 3 Planillas Centrales:

| Métrica | Valor |
|---|---:|
| Documentos escritos en la plataforma | 5.010 |
| Jardines efectivamente ingestados | 24 (100% del universo) |
| Documentos por año — 2025 | 1.878 |
| Documentos por año — 2026 | 3.132 |
| Indicadores del catálogo con al menos un dato | 49 / 53 |
| Indicadores sin ningún dato en Firestore | 4 |

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

## A.4 · Indicadores sin ningún dato

Sin cambios respecto al 30 de julio. Cuatro indicadores del catálogo canónico Parvulario no tienen ningún dato reportado en ninguna de las 3 Planillas Centrales.

| Código | Ámbito | Nombre | Unidad | Meta | Notas |
|---|---|---|---|---|---|
| I.35 | A.1 | % de acciones implementadas del plan de acción | Porcentaje | 75% | Depende de que el plan de acción esté cargado y con seguimiento en la planilla del jardín. |
| I.36 | A.1 | % de metas logradas del plan de acción | Porcentaje | 75% | Idem. |
| I.37 | A.2 | % de agentes educativas con malla formativa completa | Porcentaje | 90% | La columna existe en la Planilla Central pero llega vacía en las 3 planillas. |
| I.53 | A.3 | % de familias que completan ciclo de formación de talleres Entre Familias | Porcentaje | 50% | Se reporta al cierre del ciclo formativo; probablemente esperable que llegue vacío mid-year. |

## A.5 · Indicador I.1 recién agregado — pendiente de metadata

Sin cambios respecto al 30 de julio. El indicador I.1 ("N° de visitas al jardín infantil") tiene datos ingestados pero aparece con "Sin meta reportable" porque Focus aún no confirmó su meta, unidad, frecuencia y fuente definitivas. No entra en el porcentaje del ámbito A.1 hasta que se complete esa metadata.

## A.6 · Cobertura del catálogo por ámbito (con datos)

Sin cambios respecto al 30 de julio:

- **A.1 Gestión institucional**: Con dato: **10 de 11** (falta I.35).
- **A.2 Formación Equipos educativos**: Con dato: **11 de 12** (falta I.37).
- **A.3 Formación Apoderados**: Con dato: **29 de 30** (falta I.53).

## A.7 · Territorial — correcciones aplicadas el 5 de agosto

Se detectaron y repararon 15 jardines con datos territoriales incorrectos:

**Problema 1 — Comunas en MAYÚSCULAS**: 9 jardines tenían el campo `comuna` en mayúsculas sostenidas (p. ej. `"CERRILLOS"` en lugar de `"Cerrillos"`). Afectaba al filtro por comuna en VistaConsultor.

**Problema 2 — Abreviatura "PAC"**: 6 jardines usaban `"PAC"` como abreviatura de "Pedro Aguirre Cerda". Corregido al nombre completo.

Todos los jardines afectados:

| Jardín | Campo corregido | Antes | Ahora |
|---|---|---|---|
| jar-angel-fantuzzi | comuna | CERRILLOS | Cerrillos |
| jar-cedin | comuna | LA PINTANA | La Pintana |
| jar-ciudad-de-barcelona | comuna | PAC | Pedro Aguirre Cerda |
| jar-el-tranque | comuna | MAIPU | Maipú |
| jar-eluney | comuna | SAN BERNARDO | San Bernardo |
| jar-enrique-backausse | comuna | PAC | Pedro Aguirre Cerda |
| jar-estacion-alegria | comuna | ESTACION CENTRAL | Estación Central |
| jar-la-marina | comuna | PAC | Pedro Aguirre Cerda |
| jar-ochagavia | comuna | PAC | Pedro Aguirre Cerda |
| jar-paula-jaraquemada | comuna | EL BOSQUE | El Bosque |
| jar-pequeno-aymara | comuna | PAC | Pedro Aguirre Cerda |
| jar-poetas-de-chile | comuna | PAC | Pedro Aguirre Cerda |
| jar-salomon-sack | comuna | CERRILLOS | Cerrillos |
| jar-sueno-de-colores | comuna | SAN BERNARDO | San Bernardo |
| jar-tierra-de-angeles | comuna | SAN BERNARDO | San Bernardo |

## A.8 · Sección Parvulario · definiciones que faltan de parte de Focus

Sin cambios respecto al 30 de julio. Ver ese informe para el detalle de los cuatro puntos abiertos: (1) metadata de I.1, (2) confirmación sobre los 4 indicadores sin datos, (3) reporte al nivel Transición, (4) confirmación de contraparte por SLEP.

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

El total de planillas esperadas es **466** — 70 en el bloque 2025 (las 5 escuelas cohorte 2025-2027, año 1) y 396 en el bloque 2026.

**Corrección territorial aplicada el 5 de agosto**: la Escuela Básica Profesor Ramón del Río (SLEP Santa Corina) tenía los campos `slep`, `comuna` y `sostenedor` vacíos en la base de datos. Corregidos a `SLEP-SC`, `Estación Central` y `SLEP Santa Corina` respectivamente. La escuela ya aparece correctamente bajo Santa Corina en los filtros.

## B.2 · Catálogo canónico

Sin cambios respecto al 30 de julio. **51 indicadores (I.1 a I.51)** en 4 ámbitos:

| Ámbito | Nombre display | Indicadores del ámbito | Indicadores de logro |
|---|---|---:|---:|
| A.1 | Gestión institucional | 10 (I.1–I.10) | 3 (I.33–I.35) |
| A.2 | Formación Equipo educativo | 10 (I.11–I.20) | 3 (I.36–I.38) |
| A.3 | Formación Apoderados | 7 (I.21–I.27) | 9 (I.39–I.47) |
| A.4 | Formación Estudiantes | 5 (I.28–I.32) | 4 (I.48–I.51) |

## B.3 · Estado actual del harvest

El re-harvest del 5 de agosto completó el acceso a las **68 planillas 2025 de Los Parques** que estaban inaccesibles el 30 de julio. Resultado actualizado:

| Métrica | 30 jul | 5 ago |
|---|---:|---:|
| Planillas intentadas | 466 | 466 |
| Planillas leídas exitosamente | 396 | **465** |
| Planillas inaccesibles (error permanente) | 69 | **1** |
| Valores personales redactados en vuelo | 37.773 | 37.773 + nuevas |

La **única planilla aún inaccesible** es Escuela Básica Sendero del Saber · 2026 · curso KA: el spreadsheet ya no existe en Drive (link roto en el índice de Sebastián). Esta no es resoluble por nosotros — requiere acción de Focus.

### Resultado de las 68 planillas recién accesibles

Las 68 planillas 2025 de Los Parques estaban vacías para los indicadores PAF: las escuelas no habían llenado esas columnas al 5 de agosto. Resultado: los 68 slots pasaron de `FUENTE_NO_ACCESIBLE` implícito a `SIN_DATO_REPORTADO` — mismo estado que ya tenían en el manifiesto del 30 de julio (el manifiesto anterior los asignó a ese estado al no encontrar el archivo de cache). El manifiesto de cobertura **no cambió numéricamente**.

Este resultado es operacionalmente correcto: confirma que el dato simplemente no existe aún, no que hubiera un problema de acceso.

## B.4 · Manifiesto de cobertura — estado actual

| Estado | Tuplas |
|---|---:|
| NO_CORRESPONDE_AUN | 681 |
| SIN_FUENTE_MAPEADA | 628 |
| SIN_DATO_REPORTADO | 499 |
| CON_DATO_REPORTADO | 28 |
| **Total** | **1.836** |

El estado `FUENTE_NO_ACCESIBLE` ya no tiene ninguna entrada — todas las planillas accesibles están en cache y la única inaccesible permanente (Sendero del Saber KA) está documentada.

## B.5 · Estado actual de la ingesta a la plataforma

Sin cambios respecto al 30 de julio:

| Métrica | Valor |
|---|---:|
| Documentos escritos en la plataforma | 502 |
| Escuelas efectivamente ingestadas | 18 (100% del universo) |
| Documentos por año — 2026 | 502 |
| Documentos por año — 2025 | 0 |
| Estado de los documentos | 169 validados, 333 provisionales |
| Indicadores del catálogo con al menos un dato | 30 / 51 |

**Observación**: los datos 2025 de Los Parques (ahora accesibles en cache) aún no se han ingestado a Firestore. La ingesta 2025 depende de la decisión sobre la comparación año-a-año Escolar (§B.8, punto 6), ya que los catálogos 2025 y 2026 son instrumentos distintos.

## B.6 · Indicadores sin ningún dato

Sin cambios respecto al 30 de julio. 21 de los 51 indicadores canónicos Escolar 2026 no tienen ningún dato. Ver §B.5 del informe anterior para la lista completa por origen probable.

## B.7 · Cobertura del catálogo por ámbito (con datos)

Sin cambios respecto al 30 de julio:

- **A.1 Gestión institucional**: Con dato: **11 de 13** (falta I.10 y I.34).
- **A.2 Formación Equipo educativo**: Con dato: **11 de 13** (falta I.13 y I.14).
- **A.3 Formación Apoderados**: Con dato: **7 de 16** (faltan I.21, I.22, I.23, I.24, I.39, I.42, I.43, I.44, I.45).
- **A.4 Formación Estudiantes**: Con dato: **1 de 9** (solo I.28).

## B.8 · Sección Escolar · definiciones que faltan de parte de Focus

Los puntos 2–7 del informe del 30 de julio siguen abiertos. El punto 1 (acceso a las 68 planillas 2025 de Los Parques) queda resuelto: el acceso fue otorgado y el harvest está completo.

**Puntos aún abiertos:**

1. ~~Acceso a las 68 planillas 2025 de Los Parques~~ ✓ **Resuelto** (5 de agosto).
2. **Arreglar el link** de Escuela Básica Sendero del Saber · curso KA (Sebastián debe verificar).
3. **Identificar la fuente** de los 13 indicadores sin mapeo (reunión focalizada con Sebastián).
4. **Confirmar las metas conflictivas** del sheet `Indicadores PAF Escolar` (6 indicadores con valores distintos entre pestañas).
5. **Definir el tratamiento** de los 333 documentos provisionales (sesión de validación con Sebastián).
6. **Decisión sobre la comparación año a año Escolar** en el comparador (opciones A, B o C — requiere decisión de Luis y Sebastián).
7. **Rol del "cumplimiento" de Focus** vs el que calcula la plataforma (decisión editorial).

---

## Nota final

Toda esta información es reproducible en cualquier momento corriendo los scripts internos de la plataforma. El objetivo del informe es **cuadrar los números** en una sola instancia para que Focus y la contraparte técnica trabajen sobre la misma base al momento de resolver cada punto.

Las cifras de harvest aquí reportadas corresponden al estado tras el ciclo de re-harvest del 5 de agosto de 2026. Las cifras de Firestore corresponden al estado desplegado en `https://visualizador-paf.web.app` al 5 de agosto de 2026.
