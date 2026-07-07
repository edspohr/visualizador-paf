# Fase A — Verificación de acceso e inventario

**Fecha:** 2026-07-07
**Modo:** Solo lectura. Sin escrituras a Firestore. Sin pipeline.
**Identidad autenticada:** `firebase-adminsdk-fbsvc@visualizador-paf.iam.gserviceaccount.com` (coincide con `client_email` del JSON local — verificado). El plumbing local queda validado.

Salida estructurada en [docs/fase-a-probe-output.json](fase-a-probe-output.json) para consulta rápida.

---

## 1. Estado de `ACCESSIBLE_ROOTS`

Ambos IDs entregados como "compartidos" respondieron **`File not found`** cuando la SA canónica intentó hacer `drive.files.get`:

| Carpeta | ID | Estado |
|---|---|---|
| Carpetas planillas de monitoreo 2026 | `1YNltv9ydzJk8lkpcf_xXtxfEMB-4tCcz` | ✗ File not found |
| Plataforma visualizador datos Buddies Growth | `1z2C1-nIt28DObLgn29c8PKgjA6THqLgn` | ✗ File not found |

Cuando Drive devuelve `File not found` en vez de "permission denied" a una SA autenticada, significa que la SA **no está en la ACL de esa carpeta** (Drive nivela el error para no filtrar existencia). El share que Focus pensó aplicar todavía no está en efecto.

**Consecuencia:** el walker recursivo no produjo ninguna entrada. La única información autoritativa que se pudo obtener vino de probar cada sheet crítico por su ID directamente — que se detalla abajo.

---

## 2. Sheets críticos — sonda directa

Probando cada uno con `spreadsheets.get`:

| Sheet | ID | Estado |
|---|---|---|
| Planillas PAF Escolar (índice maestro) | `1WGGVQ8UjUJjfbkZRZqLADmhZURMnwtc5ykpJsTfOSyk` | ✗ **The caller does not have permission** |
| Planillas PAF Parvulario (índice maestro) | `1fbMEafXImtwF50gjAQFrY55VLpkgruZqv0Kb-pf6GOw` | ✓ Legible |
| Sistema indicadores PAF Escolar 2026 (catálogo) | `1MA5DyvOYKYhCVX8G8i0M6K4liV0jOGRJQ7BBrN-v0Yg` | ✓ Legible |
| Sistema indicadores PAF Parvulario (catálogo) | `1jhU3pojBN1LaMUZTNcvP9gZ1QzaewkRebupCs5m9AcU` | ✓ Legible |

Ambos catálogos y el índice **Parvulario** ya estaban compartidos con la SA de una etapa anterior. **El índice Escolar sigue bloqueado.**

### 2.1 Headers reales del Índice Parvulario (evidencia)

```
COHORTE | SOSTENEDOR | COMUNA | Tipo establecimiento | SCJI |
URL Planilla monitoreo 2025 | URL Planilla monitoreo 2026
```

Ausencias confirmadas contra el modelo objetivo:
- No hay columna `Código JUNJI/INTEGRA` (o similar) → **todos los doc IDs de jardín usarán fallback slug** desde la primera corrida (decisión previa).
- No hay columna `CONSULTOR EMAIL` en el índice Parvulario. La debe crear Luis (`consultorEmail: null` para todos hasta entonces; el reader no debe fallar).

### 2.2 Headers del Índice Escolar

**Desconocidos.** El sheet sigue bloqueado. Cualquier confirmación de dimensiones para el track Escolar (RBD, columna consultor, etc.) queda pendiente hasta que se comparta.

---

## 3. Workbooks referenciados por el Índice Parvulario

El Índice Parvulario referencia **39 workbooks** por URL (algunas cohortes traen `No aplica`, no todos los años están presentes). Estado por SA canónica:

- ✓ **30 workbooks accesibles** (bloque cohorte 2025-2026 · Santa Rosa, ambos años).
- ✗ **9 workbooks bloqueados** (todo Del Pino y Santa Corina 2026-2027 + dos huérfanos de Santa Rosa).

Detalle de los 9 bloqueados:

| Cohorte | Nombre | Año | ID |
|---|---|---|---|
| 2026-2027 | Paula Jaraquemada | 2026 | `15--mp1gVXb1gbzj4rVA7TcUFxzUY5uqm0UakHnU2uOU` |
| 2026-2027 | Cedin | 2026 | `1W67r47qNiYFWWelemwm0r1A8JmHiICJ-EWEWSxacW-4` |
| 2026-2027 | Eluney | 2026 | `11vFzJ15Bsh-9TAyLRsicNDvnHnux-3Kf4OqBLx595Zk` |
| 2026-2027 | Sueño De Colores | 2026 | `1qDwOXl6aQjfl28lju6rl8c2u7JKy1BLGZhs6_ZT0Lsk` |
| 2026-2027 | Tierra De Angeles | 2026 | `1x24MjWrCzOYKcrJLMKApTMFy10ckaXUSL4cRK0vGiwk` |
| 2026-2027 | Salomón Sack | 2026 | `1-K7IopRI5eG_K8KkuVw1sOflXRMGKJU_JGXDk73TwlE` |
| 2026-2027 | El Tranque | 2026 | `1fpA8EpKB4M9qQdyfI4uK9sVXTBCq8_CSaJHaWrIXegM` |
| 2025-2026 | La Hormiguita | 2025 | `1mVS7jXolaUgS0-DFFt7ny2Fp7HfMd5syGiDlwJrrswY` |
| 2025-2026 | Caballito Feliz | 2026 | `1Fkogl71QzPWxwnNAxBzLIHloCUw6Y1-uDHphcZBVsYU` |

Patrón: los 7 primeros son el bloque entero **Del Pino + Santa Corina cohorte 2026-2027**, lo que sugiere que viven en una carpeta hermana que todavía no fue compartida. Los 2 últimos son huérfanos individuales (probablemente propiedad del consultor a cargo del jardín, guardados fuera de la carpeta canónica).

### 3.1 Workbooks Escolar

**Cero workbooks probados** — el Índice Escolar no es legible, por lo tanto no tenemos las URLs. La lista de 18 escuelas (13 cohorte 2026-2028 + 5 cohorte 2025-2027) mencionada en la carpeta `1YNltv9…` no se pudo verificar.

---

## 4. Todavía falta compartir (lista autoritativa)

Con **el `client_email` correcto** (`firebase-adminsdk-fbsvc@visualizador-paf.iam.gserviceaccount.com`), Focus tiene que hacer lo siguiente:

### 4.1 Prioridad 1 — desbloquear tracks completos

**a) La carpeta `1z2C1-nIt28DObLgn29c8PKgjA6THqLgn`** ("Plataforma visualizador datos Buddies Growth")
Contiene el **Índice Maestro Escolar** (`1WGGVQ8…`) y los docs "por usuario". Sin esto, Escolar entero queda fuera de scope.

**b) La carpeta `1YNltv9ydzJk8lkpcf_xXtxfEMB-4tCcz`** ("Carpetas planillas de monitoreo 2026")
Contiene los 18 workbooks Escolar 2026 según el input. Sin esto, aunque el índice Escolar sea legible, no habrá workbooks que leer.

**c) La(s) carpeta(s) Parvulario que contienen los 9 workbooks bloqueados** (§3, tabla)
Probablemente una carpeta "monitoreo Del Pino + Santa Corina 2026-2027". Si son 9 archivos sueltos, compartirlos individualmente.

Todos los shares deben hacerse **como Viewer**, con propagación a subcarpetas y archivos. Si algún workbook vive en un Drive personal (los 2 huérfanos de Santa Rosa lo sugieren), pedir a su dueño que lo comparta o lo mueva a la carpeta canónica.

### 4.2 Prioridad 2 — cuando existan

**d) La carpeta Parvulario 2025** — si se quiere comparación cross-year a nivel de ámbito para jardines (opcional según el prompt).

---

## 5. Gate — decisión de fases

El prompt indica: *"if the master indexes are not yet readable, STOP here and give me the share list. Do NOT half-build the model. If at least one full track (Escolar and/or Parvulario) is readable end-to-end — index + its workbooks — proceed to Phase B for that track only."*

Estado por track:

- **Escolar:** índice bloqueado → track **incompleto**. No procede Fase B.
- **Parvulario:** índice ✓ + catálogo ✓ + **30 de 39 workbooks referenciados**. Faltan 9 workbooks (todos Del Pino + Santa Corina 2026-2027 más 2 huérfanos). Track técnicamente **parcial**, no end-to-end completo.

**Decisión:** **STOP.** No se procede a Fase B ni C. Motivos:

1. Confirmar el modelo de datos (Fase B) sin poder abrir los workbooks 2026-2027 significa no poder validar la afirmación "cohortes 2026 usan Registro Coordinación consolidado en tabs" — precisamente el patrón nuevo que el reader tiene que tolerar. Confirmarlo solo contra 2025-2026 falseará conclusiones.
2. La prueba decisiva propuesta para verificar que el framework versiona por año y no por cohorte (Gil de Castro — un `año 2` cohorte 2025-2027 Escolar) requiere que la carpeta Escolar esté compartida. No se puede ejecutar hoy.
3. Confirmar el modelo con Parvulario 2025-2026 solamente cristalizaría un esquema que después habrá que revisar cuando entren los workbooks 2026-2027 y todo el bloque Escolar. Mejor esperar y hacerlo una sola vez.

---

## 6. Qué necesito de Focus (mensaje para pasarles)

> Compartir como **Lector** (Viewer), con propagación a subcarpetas y archivos, con:
> `firebase-adminsdk-fbsvc@visualizador-paf.iam.gserviceaccount.com`
>
> 1. Carpeta `Plataforma visualizador datos Buddies Growth`
>    (`1z2C1-nIt28DObLgn29c8PKgjA6THqLgn`) — contiene el Índice Maestro Escolar.
> 2. Carpeta `Carpetas planillas de monitoreo 2026`
>    (`1YNltv9ydzJk8lkpcf_xXtxfEMB-4tCcz`) — contiene los 18 workbooks Escolar 2026.
> 3. La(s) carpeta(s) que contienen los 9 workbooks Parvulario listados en §3 de este doc
>    (bloque Del Pino + Santa Corina 2026-2027 más La Hormiguita 2025 y Caballito Feliz 2026).
>    Si están fuera de una carpeta compartida, compartirlos individualmente.
>
> Además, en la próxima revisión de los Índices Maestros: **agregar la columna
> `CONSULTOR EMAIL`** en ambos (Luis para Parvulario, Sebastián para Escolar). El reader del
> pipeline la tratará como opcional; nada se rompe si queda vacía al principio.
>
> Cuando esté aplicado, corro nuevamente la sonda (5 minutos) y confirmo que quedó todo
> accesible antes de tocar código.

---

## 7. Qué sí quedó validado en esta corrida

- La identidad SA es correcta y el plumbing local funciona: la clave privada carga, `client_email` matchea, `spreadsheets.readonly` y `drive.readonly` funcionan cuando la ACL está presente.
- El Índice Parvulario tiene los 7 headers listados en §2.1 — la ausencia de columnas `código` y `consultor email` está **confirmada por evidencia directa**, no supuesta.
- Los 2 catálogos son legibles y los headers del Escolar (14 columnas incluyendo `Indicador`, `Meta`, `Fórmula de cálculo`, `Fuente`, `Temporalidad de reporte`, `Inicio`) y del Parvulario (11 columnas) ya son conocidos.
- Escala real Parvulario ya visible: 30 workbooks accesibles con 15-22 tabs cada uno (nomenclatura variada: `ASIST`, `Bib. Viaj.`, `EF-ENC`, `MFC-BV`, `RA`, `RES`, `Tall. Apod.`, etc.) — insumo para la taxonomía de la Fase 2 real.
- El comportamiento correcto ante el gate: no avanzar a modelo cuando la fuente no es completa.

---

## 8. Próxima acción

Cuando confirmes que Focus aplicó los 3 shares de §6, corro la misma sonda (regenera automáticamente `docs/fase-a-probe-output.json`), reporto el nuevo estado, y **si todo está accesible** procedo a Fase B (confirmación del modelo con evidencia workbook + tab + celdas) y Fase C (esquema Firestore, crosswalk de ámbitos 2025→2026, tabla de mapping draft). Todo sigue siendo read-only hasta que aprobés Fase C.
