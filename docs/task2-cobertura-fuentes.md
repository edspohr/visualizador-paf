# Task 2 — Cobertura de fuentes para los 106 indicadores PAF

**Fecha:** 2026-07-08 · última actualización tras Etapa 2 (mapeo celda-por-celda)
**Modo:** Solo lectura. Sin escrituras a Firestore ni cambios en el pipeline.
**Identidad autenticada:** `firebase-adminsdk-fbsvc@visualizador-paf.iam.gserviceaccount.com`
(verificada contra `client_email` del JSON local).

Este informe se **regeneró desde cero** después de aplicar los nuevos shares al service account.
La matriz correspondiente vive en:
- [docs/task2-cobertura-matriz.csv](task2-cobertura-matriz.csv) — 3 292 filas
- [docs/task2-cobertura-matriz.json](task2-cobertura-matriz.json)

---

## Δ Etapa 2 (mapeo celda-por-celda) — resumen ejecutivo

Tras leer las celdas reales de `0. Datos Consultor` y `0. Registro Coordinación` de dos
escuelas representativas (Gil de Castro cohorte 2025-2027, Esperanza Joven cohorte 2026-2028),
21 de los 26 indicadores Escolar 2026 marcados `Fuente = Sin especificar` **tienen columna
concreta identificada** en las planillas. Además I35 (`PME y PEI`) también resulta mapeado en
`Datos Consultor > Actividades` fila B22, no era externo.

Se introduce el estado **`ausente-mapeo`** (columna existe, sólo falta que Sebastián confirme
el mapeo propuesto — no requiere trabajo de datos). Detalle completo del mapeo y auditorías
en [docs/task2-mapeo-indicadores.md](task2-mapeo-indicadores.md).

**Distribución tras Etapa 2:**

| Estado             | Etapa 1 (2026-07-08) | Etapa 2 (2026-07-08) | Δ    |
|--------------------|--------------------:|---------------------:|-----:|
| presente           | 2 331               | 2 331                | 0    |
| parcial            | 200                 | 200                  | 0    |
| **ausente-mapeo**  | —                   | **396**              | +396 |
| ausente-datos      | 711                 | 315                  | −396 |
| ausente-acceso     | 50                  | 50                   | 0    |

**Bloques restantes por tipo:**
- **396 `ausente-mapeo`** = 22 indicadores × 18 escuelas → Sebastián confirma columnas → suben a presente.
- **315 `ausente-datos`** = 175 Parvulario (7 workbooks a crear · Luis) + 90 Escolar 2026 (5 indicadores genuinamente sin columna · producto) + 50 Escolar 2025 (catálogo 2025 sin auditar).
- **50 `ausente-acceso`** = 2 workbooks Parvulario individuales por compartir.

Auditoría de llenado (fill audit): sólo **1 tab genuinamente vacía** en todas las planillas
accesibles — `CONSOLIDADO CENTRAL JARDÍN` en la Central Parvulario 2026-2027 (no bloquea
ingesta; el reader debe usar `CONS. NIVEL JARDÍN`). Las tabs `Encuesta apoderados` en las 18
escuelas tienen estructura poblada pero ceros valores todavía (esperado a mitad de año).

---

## 0. Δ vs corrida anterior (2026-07-07 → 2026-07-08)

| Métrica                | Antes  | Ahora  | Δ         |
|------------------------|-------:|-------:|:----------|
| Filas totales          | 3 292  | 3 292  | 0 (mismo alcance) |
| **presente**           | 1 620  | 2 331  | **+711** (49 % → 71 %) |
| **parcial** *(nuevo)*  | 0      | 200    | +200 (5 % Escolar 2025 vía pivote) |
| **ausente-datos**      | 1 052  | 711    | −341 (Planilla Central cubre Consultor de las 7 cohorte 2026-2027 + tab `Encuesta apoderados` en `Datos Consultor`) |
| **ausente-acceso**     | 620    | 50     | −570 (Escolar entero desbloqueado; sólo quedan 2 workbooks Parvulario individuales) |
| Escolar cobertura      | 0 %    | 55 %   | (450 presente + 200 parcial de 1 186) |
| Parvulario cobertura   | 77 %   | 89 %   | (1 881 presente de 2 106) |

**Grandes desbloqueos:**
- **Escolar** (índice `1WGGVQ8…` + carpeta `1YNltv9…` compartidos): las **18 escuelas** están
  accesibles con árbol completo — cada una expone `0. Datos Consultor` (26 tabs), `0. Registro
  Coordinación` (22 tabs) y 20 sub-workbooks por curso (`PK-A` … `8º B`). 396 workbooks Escolar
  probados exitosamente (después de resolver 26 quota errors con re-probe).
- **Encuesta apoderados** existe como tab dedicada dentro de `0. Datos Consultor` en las 18
  escuelas (nomenclatura mixta: `Encuesta apoderados` en algunas, `Encuesta Apoderados` en
  otras — el reader debe normalizar). Reclasifica 108 filas de `ausente-datos` a `presente`.
- **Planillas Centrales Parvulario (3)** legibles: `1KnApSD…` (2025-2026 · 2025, 47 tabs),
  `1oJQ8bU…` (2025-2026 · 2026, 35 tabs), `1Qr5Qvn…` (2026-2027 · 2026, 27 tabs). Sus tabs por
  jardín cubren los indicadores **Fuente = Consultor** para todos los jardines de su
  cohorte/año, **incluyendo los 7 sin workbook propio y los 2 con workbook individual
  bloqueado**. Reclasifica 261 filas de `ausente-datos` y 116 de `ausente-acceso` a `presente`.
- **Base datos SCJI Cohorte 2025-2026** (`1mTQJdF…`) y **Cohorte 2026-2027** (`1yUWIdw…`)
  legibles: sirven para totales ejecutivos (matrícula, equipos, comunas) y contienen la roster
  de los 9 jardines de cohorte 2026-2027 incluidos los 7 sin planilla monitoreo.
- **Resultados indicadores 2025** (`1yxgC1v…`, "pivote") legible: 7 tabs (`Indicadores`,
  `Indicadores clasificación`, `Pivoteo Base`, `BBDD Colegios`, `Estudiantes`, `Base Vertical`,
  `Nombre escuelas`). Se usa como cross-check para los 250 rows Escolar 2025 (cohorte 2025-2027
  año 1), que quedan marcados **parcial** — no hay workbooks 2025 en la carpeta compartida, el
  pivote entrega valores derivados por indicador × escuela.
- **Resultados indicadores 2026** (`18uHUwx…`) legible: sus 3 tabs (`Indicadores año 1, 2025`,
  `Indicadores año 1, 2026`, `Indicadores año 2, 2026`) confirman el modelo de framework por año.

**No cambia:**
- La brecha estructural del **catálogo Escolar 2026**: 26 indicadores con `Fuente = Sin
  especificar` (508 filas) + 1 `PME y PEI` + 6 `Encuesta apoderados` (ahora `presente` por
  tab dedicada) + 1 `Registro focus` en Escolar 2025. Los `Sin especificar` siguen
  bloqueados hasta que Sebastián defina fuente.
- Los **7 workbooks Parvulario cohorte 2026-2027** siguen sin existir para el dueño (Paula
  Jaraquemada, Cedin, Eluney, Sueño De Colores, Tierra De Angeles, Salomón Sack, El Tranque).
  Su `Consultor` viene de la Planilla Central; el `Jardín` (25 indicadores) queda
  `ausente-datos` — hay que crearlos.
- Los **2 workbooks Parvulario individuales bloqueados** (La Hormiguita 2025 y Caballito
  Feliz 2026) siguen sin ACL para la SA. Su `Consultor` viene de la Planilla Central; el
  `Jardín` (25 indicadores × 2 casos) queda `ausente-acceso` — un par de shares
  individuales lo destraba.

---

## 1. Verificación del modelo asumido (corrida con evidencia)

1. **"Framework versionado por año calendario, no por cohorte" — CONFIRMADO.** Se abrió el
   workbook `Escuela Gil de Castro_0. Datos Consultor` (cohorte **2025-2027**, año **2** en
   2026). Su tab `Actividades` contiene vocabulario **2026** ("equipo de gestión", "PME y PEI",
   "estándares PAF") y **NO** el vocabulario 2025 ("Equipo Familia Escuela"). Cohorte
   2025-2027 en su año 2 usa el mismo framework 2026 que las escuelas cohorte 2026-2028 en su
   año 1. El delta 2025/2026 es únicamente por año calendario.
2. **"Layouts distintos por cohorte" — no aplica en Escolar como se pensaba.** Los 18
   workbooks Escolar 2026 usan el mismo layout: 22 sub-workbooks por escuela
   (`0. Datos Consultor` + `0. Registro Coordinación` + 20 per-course como
   `Escuela X_1º A`), sin importar cohorte.
3. **"Escolar índice trae URLs de workbooks" — CORREGIDO.** El Índice Maestro Escolar
   `1WGGVQ8…` tiene 1 solo tab (con nombre `Planillas PAF PARVULARIO` — typo del cliente) y
   sus columnas de "URL" son **etiquetas de referencia** ("Registro UTP\_Gil de Castro",
   "Datos Consultor\_Gil de Castro", "PK-A\_Gil de Castro"), NO URLs. Los workbooks reales se
   descubren por *carpeta*: subfolder por escuela dentro de `1lqf3gu…`
   (año 1, 13 escuelas cohorte 2026-2028) y `14M3Bo9…` (año 2, 5 escuelas cohorte
   2025-2027). El pipeline final tendrá que iterar Drive-list en vez de leer URLs.
4. **"Resultados indicadores 2025 como pivote" — CONFIRMADO.** Tiene tabs `Pivoteo Base`,
   `Base Vertical`, `Indicadores clasificación` y `Nombre escuelas`; puede servir de
   cross-check pero no es la fuente cruda del pipeline.
5. **"3 Planillas Centrales" — CONFIRMADO Y AMPLIADO.** Sus tabs son códigos por
   jardín (`AKUN`, `MOD`, `LA HOR`, `PJ`, `ETR`, `EAL`, `SSA`, `AF`, `CED`, `SDC`, `TDA`,
   `ELU`, etc.), más tabs consolidados (`RES *`, `NMON`, `IND PRODUCTOS`, `CONS. NIVEL JARDÍN`,
   `CONS NIVEL SALAS`, `MONXXX`, `LINKSPLANILLAS`). Cubre **el 100 % de indicadores Consultor
   Parvulario** para las 3 combinaciones cohorte × año.
6. **"9 workbooks Parvulario bloqueados = 7 datos + 2 acceso" — CONFIRMADO** (misma
   composición que la corrida anterior). El único descubrimiento nuevo es que la Planilla
   Central 2026-2027 ya trae tabs para todos ellos, con lo cual el pipeline puede alimentar
   Consultor aunque el workbook individual no exista todavía.
7. **Nomenclatura de tabs Escolar variable.** El tab de encuesta aparece como
   `Encuesta apoderados` en la mayoría (España, Inglaterra, Villa San Miguel, La Victoria,
   etc.) y como `Encuesta Apoderados` (mayúscula) en 3 casos (Esperanza Joven, Ramón Freire,
   República De Las Filipinas). El reader debe normalizar case.

---

## 2. Acceso — estado por recurso

| Recurso                                                                | ID                                       | Antes                 | Ahora    | Gap actual   |
|------------------------------------------------------------------------|------------------------------------------|-----------------------|----------|--------------|
| Índice Maestro Escolar                                                 | `1WGGVQ8…`                               | ✗ permission-denied   | ✓ OK     | —            |
| Carpeta *Planillas de monitoreo 2026* (raíz Escolar)                   | `1YNltv9…`                               | ✗ File not found      | ✓ OK     | —            |
| ↳ subfolder año 1 (13 escuelas cohorte 2026-2028)                      | `1lqf3gu…`                               | —                     | ✓ OK     | —            |
| ↳ subfolder año 2 (5 escuelas cohorte 2025-2027)                       | `14M3Bo9…`                               | —                     | ✓ OK     | —            |
| Carpeta *Plataforma visualizador datos Buddies Growth*                 | `1z2C1-nI…`                              | ✗ File not found      | ✗ File not found | acceso (no crítico si el índice ya está compartido) |
| Índice Maestro Parvulario                                              | `1fbMEaf…`                               | ✓                     | ✓        | —            |
| Catálogo Escolar 2026                                                  | `1MA5Dyv…`                               | ✓                     | ✓        | —            |
| Catálogo Parvulario                                                    | `1jhU3po…`                               | ✓                     | ✓        | —            |
| Planilla Central Parvulario 2025-2026 · 2025                           | `1KnApSD…`                               | (sin sondar)          | ✓ 47 tabs| —            |
| Planilla Central Parvulario 2025-2026 · 2026                           | `1oJQ8bU…`                               | (sin sondar)          | ✓ 35 tabs| —            |
| Planilla Central Parvulario 2026-2027 · 2026                           | `1Qr5Qvn…`                               | (sin sondar)          | ✓ 27 tabs| —            |
| Base datos SCJI Cohorte 2025-2026                                      | `1mTQJdF…`                               | —                     | ✓ 2 tabs | —            |
| Base datos SCJI Cohorte 2026-2027                                      | `1yUWIdw…`                               | —                     | ✓ 1 tab (9 jardines rostered) | — |
| Resultados indicadores 2025 ("pivote")                                 | `1yxgC1v…`                               | —                     | ✓ 7 tabs | —            |
| Resultados indicadores 2026                                            | `18uHUwx…`                               | —                     | ✓ 3 tabs | —            |
| **18 workbooks Escolar** = 396 archivos (18 × 22)                      | (folder tree)                            | ✗ carpeta bloqueada   | ✓ 396/396 accesibles | — |
| **24 workbooks Parvulario** (2025 + 2026 = 34 celdas cohorte-año)      | (índice Parvulario)                      | 30/34 legibles        | 30/34 legibles | 2 acceso · 7 datos |
| ↳ La Hormiguita 2025                                                   | `1mVS7jX…`                               | ✗ permission-denied   | ✗ permission-denied | **acceso** |
| ↳ Caballito Feliz 2026                                                 | `1Fkogl7…`                               | ✗ permission-denied   | ✗ permission-denied | **acceso** |
| ↳ 7 workbooks cohorte 2026-2027 (Del Pino + Salomón Sack + El Tranque) | (7 IDs)                                  | ✗ permission-denied → confirmado no-existe-para-dueño | ídem | **datos** |

---

## 3. Reglas de clasificación aplicadas

Aplicadas por par `(fuente × workbook/planilla)`:

| Fuente del catálogo         | Programa   | Regla actual                                                                                     |
|-----------------------------|------------|--------------------------------------------------------------------------------------------------|
| `Consultor`                 | Parvulario | **presente** para todos los 24 jardines vía Planilla Central de su cohorte/año (tab por jardín). |
| `Consultor`                 | Escolar 2026 | **presente**: tab `Actividades` / `Reuniones equipo de Gestión` / `Consolidado` del sub-workbook `0. Datos Consultor` de cada escuela. |
| `Consultor`                 | Escolar 2025 | **parcial**: no hay workbooks 2025 en la carpeta compartida; el pivote 2025 entrega valores derivados. |
| `Jardín`                    | Parvulario | **presente** si el workbook individual está accesible; **ausente-acceso** para La Hormiguita 2025 / Caballito Feliz 2026; **ausente-datos** para los 7 cohorte 2026-2027 sin workbook. |
| `Registro establecimiento`  | Escolar 2026 | **presente**: sub-workbook `0. Registro Coordinación` (tabs por curso + `Consolidado Establecimiento`). |
| `Registro establecimiento`  | Escolar 2025 | **parcial** vía pivote.                                                                          |
| `Encuesta apoderados`       | Escolar 2026 | **presente**: tab `Encuesta [Aa]poderados` en `0. Datos Consultor` (case normalizado). |
| `Encuesta apoderados`       | Escolar 2025 | **parcial** vía pivote.                                                                          |
| `Evaluación final actividad`| Escolar 2026 | **presente**: sub-workbook por curso → tab `Actividades`.                                        |
| `Evaluación final actividad`| Escolar 2025 | **parcial** vía pivote.                                                                          |
| `PME y PEI`                 | Escolar    | **ausente-datos** — no hay tab dedicada; documento institucional externo.                        |
| `Sin especificar`           | Escolar    | **ausente-datos** — 26 indicadores 2026 + 8 indicadores 2025 requieren decisión de Sebastián.    |
| `Registro focus`            | Escolar 2025 | **ausente-datos**.                                                                                |

---

## 4. Totales

### 4.1 Por estado

| Estado             | Filas   | %      |
|--------------------|--------:|-------:|
| **presente**       | 2 331   | 70.8 % |
| **parcial**        | 200     | 6.1 %  |
| **ausente-datos**  | 711     | 21.6 % |
| **ausente-acceso** | 50      | 1.5 %  |

### 4.2 Por programa

| Programa   | presente | parcial | ausente-datos | ausente-acceso | Total  |
|------------|---------:|--------:|--------------:|---------------:|-------:|
| Escolar    | 450      | 200     | 536           | 0              | 1 186  |
| Parvulario | 1 881    | 0       | 175           | 50             | 2 106  |

### 4.3 Por fuente

| Fuente                    | presente | parcial | ausente-datos | ausente-acceso |
|---------------------------|---------:|--------:|--------------:|---------------:|
| Consultor                 | 1 221    | 65      | 0             | 0              |
| Jardín                    | 750      | 0       | 175           | 50             |
| Registro establecimiento  | 234      | 100     | 0             | 0              |
| Encuesta apoderados       | 90       | 30      | 18            | 0              |
| Evaluación final actividad| 18       | 5       | 0             | 0              |
| Sin especificar           | 0        | 0       | 508           | 0              |
| PME y PEI                 | 0        | 0       | 23            | 0              |
| Registro focus            | 0        | 0       | 5             | 0              |

`Encuesta apoderados` = 18 ausente-datos corresponde a **1 indicador Escolar 2025**
(`Registro focus`-fuente en Escolar 2025 tiene 5) — el mismo indicador que en 2026 tiene tab,
en 2025 no está confirmado que el pivote lo cubra.

### 4.4 Por ámbito

| Ámbito | presente | parcial | ausente-datos | ausente-acceso |
|--------|---------:|--------:|--------------:|---------------:|
| A1     | 462      | 50      | 167           | 0              |
| A2     | 477      | 45      | 239           | 6              |
| A3     | 1 206    | 45      | 252           | 44             |
| A4     | 168      | 60      | 71            | 0              |

---

## 5. Vista por establecimiento

### 5.1 Parvulario (24)

- **Cobertura total** (todas sus filas `presente`): las **15 Santa Rosa** cohorte 2025-2026 en
  los 2 años (Pequeño Aymará, Enrique Backausse, Poetas de Chile, Ciudad de Barcelona,
  Ochagavía, La Marina, Llano Subercaseaux, Villa San Miguel, Andres Bello, Santa Fe, Akun
  Pichiwentxu, Príncipes del Reino, Modelo) más los 2 Santa Corina cohorte 2026-2027 con
  workbook (Angel Fantuzzi, Estación Alegría).
- **Cobertura parcial por acceso** (Jardín-fuente sin workbook individual pero Consultor OK):
  - La Hormiguita 2025 → 83 presente + 25 ausente-acceso.
  - Caballito Feliz 2026 → 83 presente + 25 ausente-acceso.
- **Cobertura parcial por datos** (los 7 sin workbook individual, cohorte 2026-2027):
  - Paula Jaraquemada, Cedin, Eluney, Sueño De Colores, Tierra De Angeles, Salomón Sack,
    El Tranque → cada uno **29 presente** (Consultor vía Planilla Central) **+ 25 ausente-datos**
    (Jardín, workbook por crear).

### 5.2 Escolar (18)

**Identidades ahora conocidas** (extraídas del índice `1WGGVQ8…`):

Cohorte **2026-2028** (año 1 en 2026, 13 escuelas):
- SLEP Santa Rosa (9): Esperanza Joven (La Cisterna), República De Las Filipinas (Lo Espejo),
  Ciudad de Barcelona (Pedro Aguirre Cerda), Ricardo Latcham (PAC), La Victoria (PAC),
  Lo Valledor (PAC), Territorio Antártico (San Miguel), Villa San Miguel (San Miguel),
  Básica Sendero del Saber (San Ramón).
- SLEP Santa Corina (4): Pedro Aguirre Cerda (Cerrillos), República de Austria (Estación
  Central), Profesor Ramón del Río (Estación Central), Ramón Freire (Maipú).

Cohorte **2025-2027** (año 2 en 2026, 5 escuelas, todas SLEP Los Parques, Quinta Normal):
Gil de Castro, Abate Molina, Inglaterra, España, Platón.

Cada cohorte 2026-2028: **25 presente + 27 ausente-datos** por escuela (los 27 son 26 `Sin
especificar` + 1 `PME y PEI`). Excepciones: Esperanza Joven, Ramón Freire, República De Las
Filipinas — **19 presente + 33 ausente-datos** ← el reader debe normalizar case en
`Encuesta [Aa]poderados`; ver §1.7 y §3.
Cada cohorte 2025-2027: **25 presente + 40 parcial + 37 ausente-datos** por escuela — los 40
parcial son las filas 2025 vía pivote; los 37 son 26 `Sin especificar` 2026 + 1 `PME y PEI`
2026 + 8 `Sin especificar` 2025 + 1 `PME y PEI` 2025 + 1 `Registro focus` 2025.

---

## 6. Brechas restantes

### 6.1 Falta por **acceso**

| Prioridad | Recurso                                                | Filas | Owner    |
|-----------|--------------------------------------------------------|------:|----------|
| P2        | Workbook `1mVS7jX…` — La Hormiguita 2025 (o su carpeta)| 25    | Luis     |
| P2        | Workbook `1Fkogl7…` — Caballito Feliz 2026 (o su carpeta)| 25    | Luis     |

**Cierra 50 filas (100 % del gap por acceso restante).**

### 6.2 Falta por **datos** (no se resuelve compartiendo)

| Prioridad | Brecha                                                                                                | Filas | Owner    |
|-----------|-------------------------------------------------------------------------------------------------------|------:|----------|
| P1        | Declarar Fuente para los **26 indicadores Escolar 2026 `Sin especificar`** (508 filas totales — 26 × 18 escuelas + 8 × 5 = 468 + 40 = 508) | 508 | Sebastián |
| P1        | Crear los **7 workbooks Parvulario cohorte 2026-2027** (Del Pino: Paula Jaraquemada, Cedin, Eluney, Sueño De Colores, Tierra De Angeles; Santa Corina: Salomón Sack, El Tranque) — Consultor ya está cubierto por Planilla Central, falta el `Jardín`-fuente per-course | 175 | Luis     |
| P2        | Confirmar mapeo de `PME y PEI` (23 filas: 18 Escolar 2026 + 5 Escolar 2025) — probablemente al tab `Consolidado` o a un tab por crear en `0. Datos Consultor` | 23 | Sebastián + Focus |
| P2        | Confirmar cobertura pivote 2025 para el `Encuesta apoderados` Escolar 2025 (18 filas actualmente `ausente-datos` a pesar del pivote) | 18 | Focus |
| P3        | Digitalizar el 1 indicador Escolar 2025 con `Registro focus` (5 filas)                                | 5    | Focus    |

**Cierra 729 filas.** Nada de esto lo destraba un share.

### 6.3 Consecuencia si se cierran todas las brechas

- Con **§6.1**: 2 331 → 2 381 presente (72 % → 72.3 %). El impacto por acceso es marginal.
- Con **§6.2 P1** (fuentes Escolar + workbooks Parvulario nuevos): 2 331 → 3 014 presente
  (72 % → **91.6 %**). La palanca está en las decisiones de modelo, no en pedir permisos.
- Cerrando también **§6.2 P2/P3**: 2 331 → 3 060 presente (**93 %**). El techo natural son
  los 250 rows Escolar 2025 que quedan como `parcial` (derivados vía pivote), a menos que se
  decida ingestar el pivote como una fuente adicional.

---

## 7. Próximas acciones — antes de conectar datos reales

1. **Compartir los 2 workbooks Parvulario individuales** (La Hormiguita 2025, Caballito Feliz 2026).
   Es el único gap por acceso restante.
2. **Reunión con Sebastián** (Escolar) para cerrar las 26 fuentes `Sin especificar` del catálogo
   Escolar 2026. Sin esto el track Escolar no llega al 91 %.
3. **Reunión con Luis** (Parvulario) para acordar quién y cuándo crea los 7 workbooks
   monitoreo cohorte 2026-2027 desde el template Angel Fantuzzi / Estación Alegría.
4. **Fase B — mapeo de celdas**: con la matriz ya alineada, abrir 3 workbooks representativos
   (uno Escolar 2026 año 1, uno Escolar 2026 año 2, uno Parvulario 2025-2026) y completar la
   columna `sourceColumns` del CSV con las celdas exactas por indicador. El reader debe
   tolerar la nomenclatura mixta observada (case, guiones, "Salón/Sala").
5. **Definir política del pivote 2025**: si `Resultados indicadores 2025` es aceptable como
   fuente para los 250 rows Escolar 2025 (cohorte 2025-2027 año 1), reclasificar de `parcial`
   a `presente` con una nota explícita en el pipeline. Si no, dejar los 250 rows como
   informativos.

---

## 8. Cierre

Con los shares aplicados este 8 de julio la cobertura pasa de **49 % → 71 %**, sin cambios
en el alcance de 3 292 filas. Escolar deja de estar en 0 % y llega a 55 % (450 filas
presente + 200 parcial); Parvulario sube de 77 % a 89 %.

Los dos bloqueos restantes son de **datos**, no de acceso:

1. **26 indicadores Escolar 2026 con Fuente `Sin especificar`** (508 filas) — le compete a
   Sebastián.
2. **7 workbooks Parvulario cohorte 2026-2027 aún no creados** (175 filas de Jardín-fuente) —
   le compete a Luis y su equipo.

Cerrando ambos, la cobertura sube al 91.6 % con evidencia directa; el 8 % restante son los
rows Escolar 2025 vía pivote (marcados `parcial` como corresponde) más gaps menores en
`PME y PEI`, `Registro focus` y `Encuesta apoderados` 2025.

Para Fase B (mapeo `indicador → tab → columnas`) ya no hay bloqueos de acceso: se puede
proceder a leer celdas de los 3 workbooks representativos y completar la columna
`sourceColumns` del CSV.
