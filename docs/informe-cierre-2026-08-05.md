# Informe de cierre — Visualizador PAF

Fecha: 5 de agosto de 2026.

Este documento resume las mejoras y correcciones implementadas en el ciclo del 4 y 5 de agosto de 2026, destinado a Luis y Sebastián. No contiene jerga técnica; todo se describe en términos de lo que cambia para el usuario.

---

## Resumen ejecutivo

En este ciclo se resolvieron cinco problemas que impedían el uso pleno de la plataforma por parte de los usuarios de jardín, escuela y sostenedor. Adicionalmente se hicieron mejoras en la comparación de datos entre años y en la visibilidad del estado de cada indicador.

---

## 1. Acceso restaurado para todos los perfiles

**Problema:** Los usuarios con perfil Jardín, Escuela y Sostenedor no podían ingresar a la plataforma. Al hacer clic en su indicador o en el panel de su establecimiento, la aplicación quedaba en blanco o mostraba un error de carga.

**Solución:** Se corrigió la forma en que la plataforma consulta los datos para cada perfil. Ahora:
- Un usuario de **Jardín** ve únicamente los datos de su propio jardín.
- Un usuario de **Escuela** ve únicamente los datos de su propia escuela.
- Un usuario de **Sostenedor** ve los datos de todos los establecimientos de su SLEP, y solo los de su SLEP.

El usuario Consultor y el usuario CAP no se ven afectados — tenían acceso completo antes y lo siguen teniendo.

---

## 2. Correcciones de datos territoriales

**Problema 1 — Escuela Ramón del Río no aparecía en el filtro de Santa Corina:** La escuela estaba registrada en la base de datos sin la información de su sostenedor (SLEP Santa Corina), su comuna (Estación Central) ni su nombre formal. Por eso no aparecía en los filtros del panel del Consultor.

**Corrección:** Se actualizaron esos campos con los valores correctos. La escuela ya aparece correctamente bajo SLEP Santa Corina y en la comuna Estación Central.

**Problema 2 — Comunas de jardines Parvulario en mayúsculas o abreviadas:** 15 jardines tenían el campo de comuna en mayúsculas sostenidas (por ejemplo `"CERRILLOS"` en lugar de `"Cerrillos"`) o con la abreviatura "PAC" en lugar del nombre completo "Pedro Aguirre Cerda". Esto hacía que el filtro por comuna no funcionara correctamente para esos jardines.

**Corrección:** Se normalizaron los 15 jardines afectados al formato canónico. El listado completo está en `docs/informe-cobertura-fuentes-2026-08-05.md`.

---

## 3. Planillas Escolar de Los Parques (año 2025) — acceso confirmado

**Problema:** En el ciclo anterior (30 de julio), 68 planillas de las 5 escuelas del SLEP Los Parques correspondientes al año 2025 estaban inaccesibles para la plataforma.

**Situación actual:** El acceso fue otorgado y todas las planillas fueron leídas. El resultado es que las 68 planillas están vacías para los indicadores del PAF al 5 de agosto — es decir, las escuelas aún no han llenado esas columnas del año 2025. Esto es coherente con el avance del programa: los datos se irán reportando a medida que avanzan las actividades.

**Planilla con acceso imposible:** La planilla de la Escuela Básica Sendero del Saber, curso KA, apunta a una planilla que ya no existe en Google Drive. Sebastián debe verificar si fue eliminada por error, si el curso KA no existe en esa escuela, o si hay un error de copiado en el índice. Mientras tanto, esa entrada figura como "sin acceso" en la plataforma.

---

## 4. Comparación de indicadores entre los años 2025 y 2026

**Contexto:** El catálogo de indicadores 2025 y el catálogo 2026 son instrumentos distintos. Muchos indicadores cambiaron de nombre, de numeración o de definición entre un año y el otro.

**Problema:** El comparador mostraba el año 2025 sin datos porque los códigos de indicador de 2025 (por ejemplo `I.7`) no coincidían con los del 2026 (por ejemplo `I.1`), incluso cuando ambos medían lo mismo.

**Solución:** Se cargó la tabla de homologación provista por Focus (`homologacion-indicadores-escolar-2025-206.xlsx`) y se usó para alinear automáticamente los indicadores equivalentes entre años. El resultado:
- **29 pares de indicadores** tienen un equivalente reconocido en ambos años y se comparan correctamente.
- **21 indicadores** del catálogo 2025 no tienen equivalente en 2026 (fueron descontinuados) y no aparecen en el comparador.
- **22 indicadores** del catálogo 2026 son nuevos y tampoco aparecen en el comparador cuando se selecciona 2025.

Cuando se activa la comparación 2025 vs 2026 en Escolar, aparece un aviso explicativo en la parte superior del gráfico.

---

## 5. Estado de cada indicador visible en el panel

**Contexto:** La plataforma lee los datos de Escolar desde 466 planillas individuales. Para algunos indicadores, todavía no se ha identificado en cuál planilla se encuentra el dato, o la planilla reporta esa columna vacía.

**Mejora:** En el panel de indicadores de cada escuela (y en las vistas de sostenedor y consultor), ahora se distingue visualmente entre tres situaciones:

| Estado | Qué se ve en pantalla | Significado |
|---|---|---|
| Con dato | Barra de progreso normal | El valor llegó correctamente desde la planilla |
| Sin dato reportado | Barra con patrón rayado | La planilla fue leída, pero esa columna estaba vacía |
| Sin fuente | Línea punteada gris | Aún no tenemos identificado en qué planilla buscar ese indicador |

La fórmula de cumplimiento por ámbito no cambia: un indicador sin dato sigue contando como 0 en el denominador, exactamente como se acordó.

---

## 6. Mapa territorial (superadmin)

**Descripción:** Los usuarios con perfil superadmin tienen ahora acceso a una vista de mapa que muestra los 42 establecimientos del programa (18 escuelas + 24 jardines) sobre el mapa del Gran Santiago. Cada marcador está coloreado según el nivel de cumplimiento de la escuela o jardín, y su tamaño refleja la matrícula aproximada. Un clic sobre el marcador muestra el nombre, SLEP, comuna y porcentaje de cumplimiento.

Esta vista es de uso interno (solo superadmin) y está desactivada por defecto en producción. Se activa con una variable de configuración.

**Nota sobre las coordenadas:** Las posiciones en el mapa corresponden al centroide de la comuna del establecimiento, con un pequeño desplazamiento aleatorio (fijo, no cambia entre sesiones) para que los establecimientos de la misma comuna no queden apilados. No representan la dirección exacta de cada escuela o jardín — eso requeriría un listado de coordenadas reales que Focus puede proveer en cualquier momento.

---

## 7. Comparación entre pares (perfil Jardín y Escuela)

**Contexto:** En la ficha detallada de cada indicador aparece un valor de referencia llamado "Promedio del territorio" — el promedio del mismo indicador entre jardines o escuelas del mismo SLEP.

**Cambio:** Los perfiles Jardín y Escuela ya cuentan con esta comparación (antes solo la veían Consultor, CAP, Sostenedor y Superadmin). Para respetar la privacidad de los centros según la Ley 21.719, el promedio del territorio se muestra únicamente cuando hay al menos 4 centros del mismo tipo reportando ese indicador en el SLEP, y cuando la comparación año a año no permitiría aislar el valor de un centro individual. Cuando el promedio del territorio no puede publicarse por alguna de esas dos razones, la ficha muestra en su lugar el "Promedio del programa" — el promedio de todos los jardines o todas las escuelas del PAF completo (24 y 18 respectivamente) — con una nota que lo explica.

**Cómo se calcula:** Los promedios están precomputados y viven en una colección aparte (`aggregatesTerritorio_real`). El pipeline se recalcula automáticamente después de cada ingesta; el promedio del programa está garantizado siempre (los universos de 24/18 superan holgadamente el mínimo de 4).

---

## Elementos que siguen abiertos

Los siguientes puntos requieren decisión o acción de parte de Focus para avanzar. Se detallan en `docs/informe-cobertura-fuentes-2026-08-05.md`.

**Parvulario:**
1. Completar la metadata del indicador I.1 "N° de visitas al jardín infantil" (meta, unidad, frecuencia, fuente, inicio).
2. Confirmar qué se hace con los 4 indicadores que no tienen ningún dato: I.35, I.36, I.37 y I.53.
3. Definir si el nivel Transición (1 y 2) está dentro del universo de reporte por sala o se excluye.

**Escolar:**
1. Arreglar el link de la planilla de Escuela Básica Sendero del Saber · curso KA (Sebastián).
2. Identificar la fuente (qué planilla) de los 13 indicadores sin mapeo.
3. Confirmar cuál pestaña del sheet `Indicadores PAF Escolar` tiene las metas correctas para los 6 indicadores con metas conflictivas entre pestañas.
4. Revisar los 333 documentos marcados como "provisionales" con Sebastián (sesión focalizada indicador por indicador).
5. Decidir cómo tratar la comparación año a año Escolar en el comparador (tres opciones descritas en el informe de cobertura).
6. Definir si el cumplimiento que calcula la plataforma y el que calcula Focus en su planilla deben mostrarse side by side o solo uno de los dos.

---

## Próximos pasos

1. **Validación de acceso con cuentas reales:** Pedimos a Luis o Sebastián que confirmen que las cuentas de jardín, escuela y sostenedor que tienen asignadas pueden entrar y ver sus datos correctamente.
2. **Resolver los puntos abiertos de Parvulario y Escolar** (listados arriba) para mejorar la cobertura de datos y la precisión del comparador.
3. **Ingesta de datos 2025 de Los Parques (Escolar):** una vez que Focus tome la decisión sobre la comparación año a año (punto 5 de Escolar arriba), se procede con la ingesta de los datos históricos.

Las cifras de esta plataforma corresponden al estado desplegado en `https://visualizador-paf.web.app` al 5 de agosto de 2026.
