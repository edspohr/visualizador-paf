# Informe de revisión Escolar — Visualizador PAF

Documento para revisión con Sebastián Peters, Consultora Focus.
Fecha: 30 de julio de 2026.

---

## 1 · Qué se trabajó en esta ronda para Escolar

En paralelo al ciclo Parvulario del 29 de julio (informe separado para Luis), se ejecutó una tanda de trabajo enfocada 100% en Escolar. Los objetivos:

1. Construir el inventario completo de las 466 planillas de las 18 escuelas del programa, alineado al orden y numeración canónicos que compartiste en tu documento.
2. Leer el consolidado "Resultados indicadores" que administras, reconciliar sus datos con lo que la plataforma calcula, e identificar qué tan alineados están los dos catálogos (2025 y 2026).
3. Levantar un manifiesto de cobertura que distinga entre "trabajo nuestro pendiente" y "reporte pendiente por parte de las escuelas", para que cada brecha tenga dueño claro.
4. Establecer una barrera de seguridad para que ningún dato personal de estudiantes (RUT, nombre) quede persistido en la plataforma ni en nuestros archivos intermedios.

Todo el trabajo se preparó pero **no** se ha desplegado todavía en la plataforma en vivo salvo lo que se comparte con Parvulario. El motivo: los cambios que Escolar necesita son mayoritariamente estructurales (inventario, mapeo, cobertura) y benefician primero al proceso de ingesta y a los reportes internos; sólo entonces se pueden mostrar al usuario final con confianza.

---

## 2 · Lo que quedó listo

### 2.1 · Inventario completo de las 466 planillas

Se leyó el archivo "Planillas PAF Escolar" y se generó un inventario máquina-legible que declara, por escuela, año, arquetipo (Registro Coordinación / Registro UTP / Datos Consultor / planilla por curso) y curso, la identidad exacta de cada planilla esperada. Confirmamos los siguientes números contra tu archivo:

| Fact | Esperado | Actual |
|---|---:|---:|
| Escuelas totales | 18 | 18 |
| Cohorte 2026-2028 | 13 | 13 |
| Cohorte 2025-2027 | 5 | 5 |
| SLEP Santa Rosa | 9 | 9 |
| SLEP Los Parques | 5 | 5 |
| SLEP Santa Corina | 4 | 4 |
| Enlaces a planillas en el bloque 2025 | 70 | 70 |
| Enlaces a planillas en el bloque 2026 | 396 | 396 |
| Celdas "No aplica" en bloque 2025 | 260 | 260 |
| Celdas vacías en bloque 2025 | 84 | 84 |

Adicionalmente detectamos 2 enlaces al final del archivo (a los consolidados "Resultados indicadores 2025" y "Resultados indicadores 2026") que se registraron aparte.

### 2.2 · Lectura del consolidado 2025

Se leyó el consolidado "Resultados indicadores" (año 2025). Contiene 7 pestañas. Reconocimos:

- **Catálogo 2025**: 50 indicadores (6 de tipo producto/logro, 44 de tipo estrategia/actividad).
- **Base Vertical**: 1112 filas útiles en formato largo — una fila por escuela × curso × indicador, con Meta, Tipo Meta, Meta Numérica, Meta Cualitativa y Cumplimiento calculados por ustedes. Se descartaron 61 filas cuyo campo Indicador no corresponde a un código estándar (notas, CD, comentarios): esas filas traen metadata desalineada por la fórmula lookup de la planilla y sus valores no son confiables sin revisión manual.
- **Mapeo RBD ↔ nombre escuela**: 5 equivalencias (las 5 escuelas de cohorte 2025-2027 que reportaron en 2025).

### 2.3 · Manifiesto de cobertura con estados explícitos

Para cada combinación (escuela × año × indicador × curso cuando aplica) se resuelve exactamente uno de cinco estados:

| Estado | Significado | Dueño |
|---|---|---|
| No corresponde aún | Fuera del universo por año de implementación | Nadie (diseño) |
| No corresponde | Fuera del universo estructural (curso o nivel que no aplica) | Nadie |
| Cobertura pendiente | Sabemos que el indicador aplica pero no tenemos declarada la fuente | **Nuestro** |
| Revisión pendiente | Tenemos declarada la fuente pero la lectura falló | **Nuestro** |
| Sin datos | Fuente mapeada, leída OK, celda vacía o "SIN DATOS" | Focus |

El manifiesto se genera desde el inventario (2.1), el catálogo canónico y la definición de mapeo. Es máquina-legible y se refresca al vuelo. La primera versión sobre las 18 escuelas × 51 indicadores × cursos aplicables produjo 1836 tuplas, con esta distribución antes de correr el harvest completo:

- 681 tuplas fuera de scope (cohortes 2026-2028 en el año 2025 — no estaban en el programa).
- 628 tuplas con cobertura pendiente (mayoritariamente indicadores que se reportan por la Encuesta de Apoderados y por planillas para las que aún no declaramos coordenada exacta).
- 527 tuplas mapeadas — pendientes de verificar contra Firestore.
- Con verificación contra Firestore, hoy hay 28 tuplas con dato reportado y 499 sin dato reportado.

Este manifiesto **no cambia** cómo se calcula el porcentaje del ámbito. Sigue siendo AVG(mín(1, valor/meta)) sobre los aplicables con meta, contando 0 los faltantes. Lo que cambia es que ahora podemos reportar caso por caso qué escuela / qué indicador / qué año le corresponde a Focus resolver y qué le corresponde a nosotros.

### 2.4 · Barrera de datos personales de estudiantes

La pestaña `Estudiantes` del consolidado 2025 contiene RUT + nombre + curso por estudiante. Establecimos:

- Esa pestaña **no se lee ni se persiste** desde la plataforma. Ningún RUT, nombre o hash de estudiante llega a la base de datos.
- Cualquier agregado a nivel sala que se necesite (por ejemplo, cobertura de entrevistas por sala) se calcula en un script separado que trabaja con las filas estudiante sólo en memoria y sólo escribe el agregado.
- El harvest incremental de las planillas individuales tiene un filtro defensivo que redacta RUTs y nombres completos en mayúsculas sostenidas antes de cachear cualquier dato a disco. En la corrida de prueba con 5 planillas se redactaron 1434 valores identificables como PII.
- Existe un chequeo automatizado que puede correrse en cualquier momento sobre la base de datos y sobre los archivos intermedios; corta cualquier despliegue si encuentra PII persistida.

Esta manera de trabajar está alineada con lo que exige la Ley 21.719 sobre protección de datos personales. **Recomendamos que Focus valide este manejo con asesor legal antes de que aparezca en cualquier documento de cara al cliente.**

---

## 3 · Hallazgos que levantamos

### 3.1 · Los catálogos 2025 y 2026 son instrumentos distintos

El catálogo 2025 tiene 50 indicadores; el canónico 2026 tiene 51. Coinciden parcialmente en nombre e intención, pero difieren en granularidad y en la separación estrategia/logro (6 indicadores de logro en 2025 vs 19 en 2026). Comparados por nombre aproximado, **34 de 50 indicadores 2025 tienen un equivalente reconocible en 2026, 16 no lo tienen, y 21 indicadores 2026 son nuevos sin correspondencia clara en 2025**.

Consecuencia práctica: **la comparación año-a-año en Escolar dentro del comparador de la plataforma, cuando se hace por identidad de código, no es semánticamente válida** — hay indicadores I.15 en ambos años que se refieren a cosas distintas. Es una decisión que necesitamos con ustedes (ver §7).

### 3.2 · Discrepancias de meta entre 2025 y 2026

Comparando los 34 indicadores que sí matchean por nombre aproximado, encontramos **25 discrepancias de meta**. Un ejemplo típico: "Número de reuniones anuales del Equipo de Gestión" tiene meta 5 en el catálogo 2025 y meta 10 en el canónico 2026. Estas diferencias son esperables — el instrumento evolucionó — pero cada caso necesita confirmación tuya para saber si la meta 2026 refleja lo que ustedes efectivamente aplicaron en las escuelas.

El reporte completo con los 25 casos vive en el archivo interno `docs/escolar-metas-discrepancy.md`.

### 3.3 · Inconsistencias `No aplica` vs blank en el índice

En el bloque 2025 del archivo "Planillas PAF Escolar" hay 260 celdas explícitas con "No aplica" y 84 celdas simplemente vacías. Buena parte de las 84 vacías corresponden a escuelas de cohorte 2026-2028 en el año 2025 — categóricamente no estaban en el programa, deberían decir "No aplica". No modificamos tu archivo; sólo lo derivamos por cohorte + año en nuestra lógica interna. Vale la pena uniformarlo cuando tengas tiempo.

### 3.4 · Cobertura declarada por el código actual: 31 de 51 indicadores canónicos

El código que lee las planillas hoy tiene mapeo declarado para 31 indicadores del catálogo canónico 2026. Los 20 restantes se dividen en dos grupos:

- **8 indicadores** cuya fuente es la `Encuesta Apoderados`: tab estructurada pero llega vacía mid-year. La expectativa es que se llene al cierre del año escolar.
- **12 indicadores** sin fuente declarada: mayoritariamente de A.4 Fomento Lector (Biblioteca Viajera, Lecturas Viajeras, Mantel de Palabras — actividades de mediación, talleres para estudiantes) y algunos de A.3 (talleres presenciales/digitales para apoderados). Necesitamos identificar contigo en qué planilla individual de cada escuela se reportan hoy o si aún no se reportan.

### 3.5 · Pestaña enriquecida trae un valor de "Cumplimiento" calculado por ustedes

La `Base Vertical` del consolidado 2025 incluye una columna `Cumplimiento` calculada en la propia planilla. La plataforma calcula su propio porcentaje de cumplimiento (AVG(mín(1, valor/meta))) — que es la fórmula que se validó con Luis en Parvulario y se mantiene simétrica en Escolar. **Los dos números pueden diferir** cuando la meta canónica y la meta de la Base Vertical no coinciden, o cuando alguna definición cambió. Está pendiente decidir dónde y cómo mostrar el contraste (o si sólo aparece en reportes internos, no en la interfaz).

---

## 4 · Dónde aplicamos un criterio distinto

**Cinco estados de cobertura → tres tonos visuales.** El diseño pedía distinguir cinco estados en la interfaz. Optamos por agrupar en tres tonos: "no aplica" (para "no corresponde" y "no corresponde aún"), "pendiente nuestro" (para "cobertura pendiente" y "revisión pendiente") y "pendiente reporte" (para "sin datos"). La distinción fina entre las cinco quedaba sobrecargando cada fila del panel. El manifiesto interno sí mantiene los cinco estados separados — donde importa es al ejecutar el trabajo pendiente, y ahí la lista es máquina-legible con detalle. Si prefieres que la interfaz muestre los cinco separados, es una decisión reversible.

**Indicador nuevo I.1 Parvulario.** Aparte, para tu contexto: en Parvulario se agregó un indicador canónico I.1 "N° de visitas al jardín infantil" que aparece en las Planillas Centrales pero no estaba en el catálogo. Se agregó con placeholder de "Sin meta reportable" hasta que Focus confirme meta, frecuencia y unidad desde el sheet `Indicadores PAF Parvulario`. Este punto se cubre en el informe para Luis; se menciona aquí porque el mismo `Indicadores PAF Escolar` que compartiste tiene metas conflictivas entre pestañas y necesitamos tu confirmación de cuál es la vigente.

---

## 5 · Lo que no se hizo

**No se corrió el harvest completo contra las 466 planillas.** El script está construido, probado con 5 planillas de muestra (Escuela Esperanza Joven, año 2026, arquetipos Coordinación / Consultor / cursos PKA/PKB/KA), y funciona: baja los datos, cachea a disco, redacta RUTs y nombres, escribe el reporte de la corrida. Faltó ejecutarlo overnight contra las 466 completas. Cuando se corra, va a producir el estado real de cobertura sin las lagunas actuales.

**No se restructuró el catálogo Escolar 2025.** Mantiene su numeración original (50 indicadores). Esto significa que las comparaciones año-a-año 2025 vs 2026 dentro del comparador de la plataforma pueden estar mostrando resultados no comparables para algunos indicadores. Diferimos esta decisión — ver §7.

**No se cambió la fórmula de agregación del ámbito.** Es exactamente la que se defendió con Luis: AVG(mín(1, valor/meta)) sobre los aplicables con meta, contando 0 los faltantes. Este manifiesto de cobertura describe el estado pero no cambia el cálculo.

---

## 6 · Lo que está detenido y qué necesitamos para avanzar

### 6.1 · Correr el harvest completo overnight

- **Qué lo detiene**: decisión operativa de programar la corrida y validar el resultado. El script está listo y probado.
- **Qué necesitamos, de nosotros**: agendar la ejecución (unos 15-25 minutos con el retry configurado) y revisar el reporte de errores por planilla para clasificarlos entre transitorios y permanentes.
- **Qué está detenido mientras tanto**: el manifiesto de cobertura muestra 527 tuplas como "mapeadas no verificadas" — números que se resuelven a "sin datos" o "con dato" al correr el harvest.

### 6.2 · Confirmar la fuente de los 12 indicadores sin mapeo

- **Qué lo detiene**: no sabemos en qué planilla individual (o si en la Encuesta de Apoderados agregada, o si en una fuente que aún no existe) se reportan estos 12 indicadores canónicos: I.13 y I.14 (asistencia de director y coordinador a módulos formativos), I.21, I.23, I.24 (talleres para apoderados presenciales y digitales), I.32 (talleres para estudiantes), I.39 (talleres liderados por dupla monitor-profesor), y I.48, I.49, I.50, I.51 (actividades de mediación en A.4).
- **Qué necesitamos, de ti**: por cada uno de esos 12 indicadores, la coordenada (planilla, pestaña, columna aproximada) donde se reporta, o la confirmación explícita de que aún no se reporta.
- **Qué está detenido mientras tanto**: esos 12 indicadores aparecen en el manifiesto y en la interfaz como "cobertura pendiente (nuestra)" — señalando correctamente que la brecha es de nuestro lado.

### 6.3 · Resolver las metas conflictivas del sheet `Indicadores PAF Escolar`

- **Qué lo detiene**: el sheet tiene tres pestañas (año 1 2025, año 1 2026, año 2 2026) con metas distintas para los mismos indicadores. Las diferencias específicas están en I.9, I.10, I.26, I.29, I.43, I.46.
- **Qué necesitamos, de ti**: confirmación de cuál pestaña es la vigente. Es un mensaje corto por Slack o correo con "usar pestaña X" y opcionalmente los seis casos revisados uno por uno.
- **Qué está detenido mientras tanto**: la plataforma está usando la pestaña `Indicadores año 1, 2026`. Si esa no es la correcta, los porcentajes de logro de esos seis indicadores están calculados con la meta equivocada.

### 6.4 · Confirmar cómo mostrar (o no) el "Cumplimiento de Focus" vs el "Cumplimiento de la plataforma"

- **Qué lo detiene**: la Base Vertical trae una columna `Cumplimiento` calculada por ustedes. La plataforma calcula el suyo con la fórmula que se defiende con Luis. Los dos pueden diferir.
- **Qué necesitamos, de ti**: decisión editorial. Opciones: (a) sólo mostramos el nuestro; (b) mostramos los dos side by side, con explicación de por qué difieren; (c) reportamos el contraste en un documento interno sin exponerlo en la interfaz.
- **Qué está detenido mientras tanto**: la interfaz sólo muestra el porcentaje canónico de la plataforma. La discrepancia queda visible sólo en reportes internos.

---

## 7 · Decisiones que necesitamos de ustedes

### 7.1 · Comparación año-a-año Escolar 2025 vs 2026 en el comparador

Los dos catálogos son instrumentos distintos (34 de 50 indicadores 2025 tienen match en 2026, con 25 discrepancias de meta entre ellos). Comparar por ID en el comparador puede estar mostrando resultados no comparables. Opciones:

- **Opción A**: Deshabilitar la comparación 2025 vs 2026 en Escolar. Menos ruido, pero pierden capacidad de contrastar.
- **Opción B**: Mostrar una advertencia clara en el comparador cuando el eje año se mueve a 2025 en Escolar, explicando que sólo son comparables los indicadores con match reconocido, y esconder los otros.
- **Opción C**: Restructurar el catálogo Escolar 2025 al mapa canónico 2026 para que sea comparable. Requiere revisar los 50 indicadores caso por caso y decidir qué se conserva, qué se descarta y qué se renombra.

### 7.2 · Metas conflictivas

Ver §6.3.

### 7.3 · Indicadores que probablemente deben retirarse del catálogo

Al mapear el código actual encontramos 4 indicadores Escolar que no tienen ninguna vía de reporte identificable: I.13, I.14 (asistencia director/coordinador a módulos), y probablemente los cuatro de mediación (I.48-I.51). Si estos indicadores no se van a reportar en el ciclo 2026 en curso, conviene marcarlos como "no vigentes" en la interfaz — sale más honesto que dejarlos como "sin datos" indefinidamente. Necesitamos tu confirmación caso por caso.

---

## 8 · Estado de los indicadores sin datos (Escolar)

Ver la sección 8 del informe para Luis (`docs/informe-revision-2026-07-29.md`) que ya lista los 19 indicadores Escolar sin datos hoy. La lectura corta: 8 son de la Encuesta de Apoderados (esperados vacíos mid-year), 11 necesitan que identifiquemos su fuente contigo.
