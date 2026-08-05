# Informe de cierre para producción — Visualizador PAF

Fecha: 5 de agosto de 2026 (tarde). Producción: `https://visualizador-paf.web.app`.

Este documento resume qué está listo para producción, qué acabamos de conectar en este cierre, y qué queda pendiente de definir con Focus.

---

## Qué acabamos de conectar

**Escolar — de 30 a 33 indicadores con datos leídos, más grilla completada:**

| Antes | Ahora |
|---|---|
| 502 documentos Escolar en Firestore | **594 documentos** |
| 30 indicadores conectados | **33 indicadores conectados** |
| 21 indicadores sin fuente | **18 indicadores sin fuente** |
| Grilla incompleta (algunas escuelas sin doc para indicadores que sí existían para otras) | **Grilla completa** para los 33 conectados (18 escuelas × 33 = 594) |

### Los 3 indicadores nuevos conectados

| ID | Indicador | Fuente conectada |
|---|---|---|
| I.10 | Existe plan de acción familia escuela actualizado | Datos Consultor · tab Actividades · misma celda que I.9 (según discovery del cache) |
| I.13 | Director asiste a módulos formativos | Datos Consultor · tab Datos docentes · fila con Cargo=Director/a × columnas CD1..CD4 (% asistencia) |
| I.14 | Coordinador asiste a módulos formativos | Datos Consultor · tab Datos docentes · fila con Cargo=Coordinador/a × columnas CD1..CD4 |

### Los 6 indicadores de encuesta apoderados (conectados pero vacíos)

Estos ahora sí se leen desde el tab "Encuesta apoderados" de Datos Consultor. Están conectados pero las celdas están vacías al 5 de agosto (esperado — la encuesta se aplica al cierre):

- **I.29** libros BV recibidos por estudiante
- **I.31** % salas que envían Mantel
- **I.42** % apoderados que descargaron talleres digitales
- **I.43** promedio libros BV declarados por familias
- **I.44** promedio Lecturas Viajeras declaradas
- **I.45** % apoderados que usan Mantel de Palabras

Cuando las escuelas llenen la encuesta, los valores aparecerán automáticamente en el visualizador sin intervención adicional.

---

## Otras correcciones aplicadas

1. **I.43, I.44, I.45 movidos de ámbito A.3 (Formación Apoderados) a A.4 (Formación Estudiantes)** — consistente con la homologación XLSX (columna "Estrategia: P3: Fomento lector").

2. **VistaSostenedor: cuenta de comunas corregida** — antes contaba `null`/`undefined` como comuna distinta; ahora sólo cuenta comunas efectivamente declaradas.

3. **Reporte `reporteConexionEscolar.mjs`** — nuevo. Muestra por escuela cuántos indicadores están conectados, cuántos sin dato, cuántos sin fuente. Se puede regenerar en cualquier momento con `npm run reporte:conexion-escolar`.

---

## Qué queda pendiente de tu lado (Sebastián)

**18 indicadores sin fuente cableada.** Los agrupé por dónde probablemente estén, según el discovery en el cache:

### Grupo 1 — 3 indicadores per-curso (Datos Consultor course-workbooks)

Encontramos que estos viven en las planillas por curso (PKA, PKB, KA, KB, 1A..8B) en el tab "Actividades" sección "Actividades con Apoderados/as". La lógica de agregación (promedio por sala) requiere código adicional. Confirmar si:

| ID | Indicador | Confirmación |
|---|---|---|
| I.21 | Nº talleres presenciales por sala | ¿La agregación es promedio de "Taller presencial: X" por curso? |
| I.30 | Envío de Lecturas Viajeras | ¿Es conteo de trues en rows "Envío Lecturas Viajeras" en cursos 2A-4B? |
| I.32 | Nº talleres para estudiantes por sala | ¿Igual a I.21 pero contando talleres para estudiantes? |

### Grupo 2 — 4 indicadores mediación (Datos Consultor course-workbooks)

Igual que grupo 1, viven en course-workbooks en sección "Actividades con Estudiantes":

- **I.48** Actividades mediación Biblioteca Viajera
- **I.49** Actividades aula Lecturas Viajeras
- **I.50** % salas mediación Mantel previo
- **I.51** Actividades mediación Mantel post-envío

### Grupo 3 — 4 indicadores sin ubicación clara

| ID | Indicador | Notas |
|---|---|---|
| I.22 | % asistencia a taller presencial (encuesta) | No encontrado en tab Encuesta apoderados. ¿Otra ubicación? |
| I.23 | Nº talleres digitales enviados por sala | Sin match en cache. Confirmar ubicación. |
| I.24 | Visualizaciones promedio talleres digitales | Sin match en cache. Confirmar ubicación. |
| I.39 | % talleres liderados por dupla monitor-profesor | Existe row "¿Quién lidera el taller?" en course-workbooks, pero el layout es libre-texto. ¿Cómo debe agregarse? |

---

## Preguntas más chicas (rápidas)

1. **Metas conflictivas 2025 vs 2026** — usamos 2026 como meta vigente para I.9, I.10, I.26, I.29, I.43, I.46, según tu confirmación. Si en algún caso no aplica, avisa.

2. **Comparación año-a-año** — está activada con banner explicativo y remapeo automático de indicadores 2025→2026 según tu tabla de homologación. Si prefieres desactivar del todo, es un cambio de línea.

3. **Cumplimiento propio vs plataforma** — la plataforma calcula solo el suyo hoy. ¿Sumamos el tuyo side-by-side para el consolidado 2025?

---

## Estado listo para producción

- ✅ Los 6 perfiles (jardin/escuela/sostenedor/consultor/CAP/superadmin) cargan sus datos correctamente
- ✅ Cero PII persistida en Firestore o cache (asserción automática pasa)
- ✅ 33 de 51 indicadores Escolar están conectados a fuente
- ✅ Los 51 slots aparecen en el panel con estado explícito ("Con dato" / "Sin datos" / "Sin fuente")
- ✅ Comparador entre años Escolar 2025 vs 2026 funciona con homologación automática
- ✅ Mapa territorial (superadmin, feature-flagged) muestra 42 establecimientos
- ✅ Auth y reglas Firestore probadas — jardin/escuela/sostenedor sólo ve sus datos
- ✅ Deploy 5 activo en producción

## Roadmap corto post-producción

- Cablear los 3 per-curso (I.21, I.30, I.32) y los 4 de mediación (I.48-I.51) — necesita tu confirmación de layout
- Sesión de validación indicador-por-indicador para pasar los 387 registros "provisionales" a "validado"
- Aplicación de la encuesta apoderados — los 6 indicadores conectados se llenarán solos cuando reporten

---

## Cómo trabajamos desde acá

Cuando confirmes cualquier item pendiente, mándanos la respuesta y en el próximo ciclo cableamos. Cada cablado es un commit atómico, un dry-run para verificar el efecto en producción, y luego el deploy. Ningún cambio destructivo sin tu OK primero.
