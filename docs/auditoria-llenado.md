# Auditoría de llenado — ¿qué existe en la fuente vs qué mostramos?

**Fecha:** 2026-07-08
**Modo:** medición read-only. Cero escrituras a colecciones de datos, cero cambios en el
app, cero cambios de flags. La única entrada de Firestore es la lectura de `resultados_real`.
**Identidad:** `firebase-adminsdk-fbsvc@visualizador-paf.iam.gserviceaccount.com` — verificada contra `client_email` del JSON.
**Alcance:** cada celda `(programa × indicadorId × establecimientoId × año)` del catálogo
2026 (con 2025 donde el establecimiento tiene ese año). Total: 3.292 celdas.

## Definiciones (no re-interpretadas)

- **existe+mostrado** — el valor existe en la fuente Y está presente en `resultados_real`.
- **existe+no-mostrado** — el valor existe en la fuente pero NO está en `resultados_real`. ← la brecha real.
- **no-existe** — no hay valor en la fuente (celda vacía/ausente).
- **no-accesible** — la fuente no pudo leerse.
- **no-aplica-aun** — el indicador inicia en un semestre posterior al ejecutado por su
  cohorte (2025-2026 hasta Sem 3, 2026-2027 solo Sem 1). Aplica sólo a Parvulario.

La columna “existe” se hereda del estado de la matriz de cobertura Etapa 2:
`presente` → existe · `parcial` → existe · `ausente-mapeo` → existe (columna hallada,
esperando confirmación de mapeo) · `ausente-datos` → no-existe · `ausente-acceso` → no-accesible.

## Los tres números

| Estado | Global | % | Escolar | Parvulario |
|---|---:|---:|---:|---:|
| existe+mostrado | 1.669 | 50.7 % | 678 | 991 |
| **existe+no-mostrado** | **1.099** | **33.4 %** | **368** | **731** |
| no-existe | 245 | 7.4 % | 140 | 105 |
| no-accesible | 48 | 1.5 % | 0 | 48 |
| no-aplica-aun | 231 | 7.0 % | 0 | 231 |
| **Total** | **3.292** | 100.0 % | **1.186** | **2.106** |

> ⚠ Contradicciones (115): la matriz de cobertura marca la celda como `no-existe` o `no-accesible` pero `resultados_real` tiene un valor. Esto ocurre cuando la ingesta extrajo un valor de una columna que la auditoría Etapa 2 no reconoció, o cuando el pivote 2025 se ingresó pese a estar marcado `ausente-datos`. Revisar caso por caso:
>   - parvulario · I.14 · Paula Jaraquemada · 2026  (matriz=ausente-datos)
>   - parvulario · I.15 · Paula Jaraquemada · 2026  (matriz=ausente-datos)
>   - parvulario · I.16 · Paula Jaraquemada · 2026  (matriz=ausente-datos)
>   - parvulario · I.45 · Paula Jaraquemada · 2026  (matriz=ausente-datos)
>   - parvulario · I.46 · Paula Jaraquemada · 2026  (matriz=ausente-datos)
>   - parvulario · I.47 · Paula Jaraquemada · 2026  (matriz=ausente-datos)
>   - parvulario · I.50 · Paula Jaraquemada · 2026  (matriz=ausente-datos)
>   - parvulario · I.14 · Cedin · 2026  (matriz=ausente-datos)
>   - parvulario · I.15 · Cedin · 2026  (matriz=ausente-datos)
>   - parvulario · I.16 · Cedin · 2026  (matriz=ausente-datos)
>   … y 105 más (ver CSV)


## existe+no-mostrado — la brecha recuperable

Total: **1.099 celdas** en 80 combinaciones `(programa × indicador × año)`.

Agrupado por indicador × año, ordenado por cantidad de centros afectados:

| # | Programa | Indicador | Año | Centros | Fuente catálogo | Ubicación (workbook · tab · columnas) | Confianza | Estado cobertura |
|---:|---|---|---:|---:|---|---|---|---|
| 1 | parvulario | I.3 | 2026 | 24 | Consultor | 1Qr5QvnfJ-_F3hVRikFRWNy-RyruKBK7T37m-DY-obwk · Planilla Central (tab por jardín/consolidado) | confirmada | presente |
| 2 | parvulario | I.13 | 2026 | 24 | Consultor | 1Qr5QvnfJ-_F3hVRikFRWNy-RyruKBK7T37m-DY-obwk · Planilla Central (tab por jardín/consolidado) | confirmada | presente |
| 3 | parvulario | I.32 | 2026 | 24 | Consultor | 1Qr5QvnfJ-_F3hVRikFRWNy-RyruKBK7T37m-DY-obwk · Planilla Central (tab por jardín/consolidado) | confirmada | presente |
| 4 | parvulario | I.7 | 2026 | 23 | Consultor | 1Qr5QvnfJ-_F3hVRikFRWNy-RyruKBK7T37m-DY-obwk · Planilla Central (tab por jardín/consolidado) | confirmada | presente |
| 5 | parvulario | I.4 | 2026 | 22 | Consultor | 1Qr5QvnfJ-_F3hVRikFRWNy-RyruKBK7T37m-DY-obwk · Planilla Central (tab por jardín/consolidado) | confirmada | presente |
| 6 | parvulario | I.5 | 2026 | 22 | Consultor | 1Qr5QvnfJ-_F3hVRikFRWNy-RyruKBK7T37m-DY-obwk · Planilla Central (tab por jardín/consolidado) | confirmada | presente |
| 7 | parvulario | I.6 | 2026 | 22 | Consultor | 1Qr5QvnfJ-_F3hVRikFRWNy-RyruKBK7T37m-DY-obwk · Planilla Central (tab por jardín/consolidado) | confirmada | presente |
| 8 | parvulario | I.8 | 2026 | 22 | Consultor | 1Qr5QvnfJ-_F3hVRikFRWNy-RyruKBK7T37m-DY-obwk · Planilla Central (tab por jardín/consolidado) | confirmada | presente |
| 9 | parvulario | I.29 | 2026 | 22 | Consultor | 1Qr5QvnfJ-_F3hVRikFRWNy-RyruKBK7T37m-DY-obwk · Planilla Central (tab por jardín/consolidado) | confirmada | presente |
| 10 | escolar | I21 | 2026 | 18 | Consultor | 1J7wy5aeW4rRZodYjtz590LK0Wo-W9t6HzOhEdJWlHyM · Datos Consultor → Actividades / Reuniones equipo de Gestión / Consolidado | confirmada | presente |
| 11 | escolar | I22 | 2026 | 18 | Encuesta apoderados | 1J7wy5aeW4rRZodYjtz590LK0Wo-W9t6HzOhEdJWlHyM · Datos Consultor → Encuesta apoderados | confirmada | presente |
| 12 | escolar | I23 | 2026 | 18 | Registro establecimiento | 1m0GBH1xciC_gLvkJqV7XjMjsnLcahYbMe308IipKgp0 · Registro Coordinación → tabs por curso + Consolidado Establecimiento | confirmada | presente |
| 13 | escolar | I24 | 2026 | 18 | Registro establecimiento | 1m0GBH1xciC_gLvkJqV7XjMjsnLcahYbMe308IipKgp0 · Registro Coordinación → tabs por curso + Consolidado Establecimiento | confirmada | presente |
| 14 | escolar | I29 | 2026 | 18 | Encuesta apoderados | 1J7wy5aeW4rRZodYjtz590LK0Wo-W9t6HzOhEdJWlHyM · Datos Consultor → Encuesta apoderados | confirmada | presente |
| 15 | escolar | I30 | 2026 | 18 | Encuesta apoderados | 1J7wy5aeW4rRZodYjtz590LK0Wo-W9t6HzOhEdJWlHyM · Datos Consultor → Encuesta apoderados | confirmada | presente |
| 16 | escolar | I31 | 2026 | 18 | Encuesta apoderados | 1J7wy5aeW4rRZodYjtz590LK0Wo-W9t6HzOhEdJWlHyM · Datos Consultor → Encuesta apoderados | confirmada | presente |
| 17 | escolar | I32 | 2026 | 18 | Registro establecimiento | 1m0GBH1xciC_gLvkJqV7XjMjsnLcahYbMe308IipKgp0 · Registro Coordinación → tabs por curso + Consolidado Establecimiento | confirmada | presente |
| 18 | escolar | I34 | 2026 | 18 | Sin especificar | Datos Consultor > Actividades | inferida | ausente-mapeo |
| 19 | escolar | I42 | 2026 | 18 | Encuesta apoderados | 1J7wy5aeW4rRZodYjtz590LK0Wo-W9t6HzOhEdJWlHyM · Datos Consultor → Encuesta apoderados | confirmada | presente |
| 20 | escolar | I43 | 2026 | 18 | Encuesta apoderados | 1J7wy5aeW4rRZodYjtz590LK0Wo-W9t6HzOhEdJWlHyM · Datos Consultor → Encuesta apoderados | confirmada | presente |
| 21 | escolar | I44 | 2026 | 18 | Registro establecimiento | 1m0GBH1xciC_gLvkJqV7XjMjsnLcahYbMe308IipKgp0 · Registro Coordinación → tabs por curso + Consolidado Establecimiento | confirmada | presente |
| 22 | escolar | I45 | 2026 | 18 | Registro establecimiento | 1m0GBH1xciC_gLvkJqV7XjMjsnLcahYbMe308IipKgp0 · Registro Coordinación → tabs por curso + Consolidado Establecimiento | confirmada | presente |
| 23 | escolar | I46 | 2026 | 18 | Sin especificar | Datos Consultor > Encuesta apoderados | inferida | ausente-mapeo |
| 24 | escolar | I50 | 2026 | 18 | Registro establecimiento | 1m0GBH1xciC_gLvkJqV7XjMjsnLcahYbMe308IipKgp0 · Registro Coordinación → tabs por curso + Consolidado Establecimiento | confirmada | presente |
| 25 | escolar | I51 | 2026 | 18 | Registro establecimiento | 1m0GBH1xciC_gLvkJqV7XjMjsnLcahYbMe308IipKgp0 · Registro Coordinación → tabs por curso + Consolidado Establecimiento | confirmada | presente |
| 26 | escolar | I52 | 2026 | 18 | Registro establecimiento | 1m0GBH1xciC_gLvkJqV7XjMjsnLcahYbMe308IipKgp0 · Registro Coordinación → tabs por curso + Consolidado Establecimiento | confirmada | presente |
| 27 | parvulario | I.17 | 2026 | 16 | Jardín | 1xY_ELmzcXmrHV78SNkpW5dUllN2y183t8N859NlHRqc · tabs por curso (RA/EA/Bib. Viaj./Tall. Apod./Vol/Rol Ed./Exp.Ed./Ev. Ped./Narr. Baúl MFC/MFC-BV imp/Biblioteca/ASIST/RES/Ingreso talleres) | confirmada | presente |
| 28 | parvulario | I.24 | 2026 | 16 | Jardín | 1xY_ELmzcXmrHV78SNkpW5dUllN2y183t8N859NlHRqc · tabs por curso (RA/EA/Bib. Viaj./Tall. Apod./Vol/Rol Ed./Exp.Ed./Ev. Ped./Narr. Baúl MFC/MFC-BV imp/Biblioteca/ASIST/RES/Ingreso talleres) | confirmada | presente |
| 29 | parvulario | I.25 | 2026 | 16 | Jardín | 1xY_ELmzcXmrHV78SNkpW5dUllN2y183t8N859NlHRqc · tabs por curso (RA/EA/Bib. Viaj./Tall. Apod./Vol/Rol Ed./Exp.Ed./Ev. Ped./Narr. Baúl MFC/MFC-BV imp/Biblioteca/ASIST/RES/Ingreso talleres) | confirmada | presente |
| 30 | parvulario | I.26 | 2026 | 16 | Jardín | 1xY_ELmzcXmrHV78SNkpW5dUllN2y183t8N859NlHRqc · tabs por curso (RA/EA/Bib. Viaj./Tall. Apod./Vol/Rol Ed./Exp.Ed./Ev. Ped./Narr. Baúl MFC/MFC-BV imp/Biblioteca/ASIST/RES/Ingreso talleres) | confirmada | presente |
| 31 | parvulario | I.27 | 2026 | 16 | Jardín | 1xY_ELmzcXmrHV78SNkpW5dUllN2y183t8N859NlHRqc · tabs por curso (RA/EA/Bib. Viaj./Tall. Apod./Vol/Rol Ed./Exp.Ed./Ev. Ped./Narr. Baúl MFC/MFC-BV imp/Biblioteca/ASIST/RES/Ingreso talleres) | confirmada | presente |
| 32 | parvulario | I.28 | 2026 | 16 | Jardín | 1xY_ELmzcXmrHV78SNkpW5dUllN2y183t8N859NlHRqc · tabs por curso (RA/EA/Bib. Viaj./Tall. Apod./Vol/Rol Ed./Exp.Ed./Ev. Ped./Narr. Baúl MFC/MFC-BV imp/Biblioteca/ASIST/RES/Ingreso talleres) | confirmada | presente |
| 33 | parvulario | I.43 | 2026 | 16 | Jardín | 1xY_ELmzcXmrHV78SNkpW5dUllN2y183t8N859NlHRqc · tabs por curso (RA/EA/Bib. Viaj./Tall. Apod./Vol/Rol Ed./Exp.Ed./Ev. Ped./Narr. Baúl MFC/MFC-BV imp/Biblioteca/ASIST/RES/Ingreso talleres) | confirmada | presente |
| 34 | parvulario | I.53 | 2026 | 16 | Jardín | 1xY_ELmzcXmrHV78SNkpW5dUllN2y183t8N859NlHRqc · tabs por curso (RA/EA/Bib. Viaj./Tall. Apod./Vol/Rol Ed./Exp.Ed./Ev. Ped./Narr. Baúl MFC/MFC-BV imp/Biblioteca/ASIST/RES/Ingreso talleres) | confirmada | presente |
| 35 | parvulario | I.48 | 2025 | 15 | Consultor | 1KnApSDHVGh8tXzPYOQY957jvzEvw3ra5lwvxevL3s9A · Planilla Central (tab por jardín/consolidado) | confirmada | presente |
| 36 | parvulario | I.23 | 2026 | 15 | Consultor | 1oJQ8bUfoWy3q_ezzLnlGiLE7UvxhuHllRE27dzOEyYo · Planilla Central (tab por jardín/consolidado) | confirmada | presente |
| 37 | escolar | I37 | 2026 | 15 | Sin especificar | Datos Consultor > Actividades | inferida | ausente-mapeo |
| 38 | parvulario | I.14 | 2025 | 14 | Jardín | 1GXMOw489yWOM3JNiHUErxnwGMOXwauJV-U6425UrRaA · tabs por curso (RA/EA/Bib. Viaj./Tall. Apod./Vol/Rol Ed./Exp.Ed./Ev. Ped./Narr. Baúl MFC/MFC-BV imp/Biblioteca/ASIST/RES/Ingreso talleres) | confirmada | presente |
| 39 | parvulario | I.15 | 2025 | 14 | Jardín | 1GXMOw489yWOM3JNiHUErxnwGMOXwauJV-U6425UrRaA · tabs por curso (RA/EA/Bib. Viaj./Tall. Apod./Vol/Rol Ed./Exp.Ed./Ev. Ped./Narr. Baúl MFC/MFC-BV imp/Biblioteca/ASIST/RES/Ingreso talleres) | confirmada | presente |
| 40 | parvulario | I.17 | 2025 | 14 | Jardín | 1GXMOw489yWOM3JNiHUErxnwGMOXwauJV-U6425UrRaA · tabs por curso (RA/EA/Bib. Viaj./Tall. Apod./Vol/Rol Ed./Exp.Ed./Ev. Ped./Narr. Baúl MFC/MFC-BV imp/Biblioteca/ASIST/RES/Ingreso talleres) | confirmada | presente |
| 41 | parvulario | I.18 | 2025 | 14 | Jardín | 1GXMOw489yWOM3JNiHUErxnwGMOXwauJV-U6425UrRaA · tabs por curso (RA/EA/Bib. Viaj./Tall. Apod./Vol/Rol Ed./Exp.Ed./Ev. Ped./Narr. Baúl MFC/MFC-BV imp/Biblioteca/ASIST/RES/Ingreso talleres) | confirmada | presente |
| 42 | parvulario | I.19 | 2025 | 14 | Jardín | 1GXMOw489yWOM3JNiHUErxnwGMOXwauJV-U6425UrRaA · tabs por curso (RA/EA/Bib. Viaj./Tall. Apod./Vol/Rol Ed./Exp.Ed./Ev. Ped./Narr. Baúl MFC/MFC-BV imp/Biblioteca/ASIST/RES/Ingreso talleres) | confirmada | presente |
| 43 | parvulario | I.20 | 2025 | 14 | Jardín | 1GXMOw489yWOM3JNiHUErxnwGMOXwauJV-U6425UrRaA · tabs por curso (RA/EA/Bib. Viaj./Tall. Apod./Vol/Rol Ed./Exp.Ed./Ev. Ped./Narr. Baúl MFC/MFC-BV imp/Biblioteca/ASIST/RES/Ingreso talleres) | confirmada | presente |
| 44 | parvulario | I.21 | 2025 | 14 | Jardín | 1GXMOw489yWOM3JNiHUErxnwGMOXwauJV-U6425UrRaA · tabs por curso (RA/EA/Bib. Viaj./Tall. Apod./Vol/Rol Ed./Exp.Ed./Ev. Ped./Narr. Baúl MFC/MFC-BV imp/Biblioteca/ASIST/RES/Ingreso talleres) | confirmada | presente |
| 45 | parvulario | I.40 | 2025 | 14 | Jardín | 1GXMOw489yWOM3JNiHUErxnwGMOXwauJV-U6425UrRaA · tabs por curso (RA/EA/Bib. Viaj./Tall. Apod./Vol/Rol Ed./Exp.Ed./Ev. Ped./Narr. Baúl MFC/MFC-BV imp/Biblioteca/ASIST/RES/Ingreso talleres) | confirmada | presente |
| 46 | parvulario | I.49 | 2025 | 14 | Jardín | 1GXMOw489yWOM3JNiHUErxnwGMOXwauJV-U6425UrRaA · tabs por curso (RA/EA/Bib. Viaj./Tall. Apod./Vol/Rol Ed./Exp.Ed./Ev. Ped./Narr. Baúl MFC/MFC-BV imp/Biblioteca/ASIST/RES/Ingreso talleres) | confirmada | presente |
| 47 | parvulario | I.54 | 2025 | 14 | Jardín | 1GXMOw489yWOM3JNiHUErxnwGMOXwauJV-U6425UrRaA · tabs por curso (RA/EA/Bib. Viaj./Tall. Apod./Vol/Rol Ed./Exp.Ed./Ev. Ped./Narr. Baúl MFC/MFC-BV imp/Biblioteca/ASIST/RES/Ingreso talleres) | confirmada | presente |
| 48 | parvulario | I.10 | 2026 | 14 | Consultor | 1oJQ8bUfoWy3q_ezzLnlGiLE7UvxhuHllRE27dzOEyYo · Planilla Central (tab por jardín/consolidado) | confirmada | presente |
| 49 | parvulario | I.19 | 2026 | 14 | Jardín | 1PwPpF1CEWcjSLq9EFiGdQi7gT2sBwZezCAPfjyxatjk · tabs por curso (RA/EA/Bib. Viaj./Tall. Apod./Vol/Rol Ed./Exp.Ed./Ev. Ped./Narr. Baúl MFC/MFC-BV imp/Biblioteca/ASIST/RES/Ingreso talleres) | confirmada | presente |
| 50 | parvulario | I.20 | 2026 | 14 | Jardín | 1PwPpF1CEWcjSLq9EFiGdQi7gT2sBwZezCAPfjyxatjk · tabs por curso (RA/EA/Bib. Viaj./Tall. Apod./Vol/Rol Ed./Exp.Ed./Ev. Ped./Narr. Baúl MFC/MFC-BV imp/Biblioteca/ASIST/RES/Ingreso talleres) | confirmada | presente |
| 51 | parvulario | I.21 | 2026 | 14 | Jardín | 1PwPpF1CEWcjSLq9EFiGdQi7gT2sBwZezCAPfjyxatjk · tabs por curso (RA/EA/Bib. Viaj./Tall. Apod./Vol/Rol Ed./Exp.Ed./Ev. Ped./Narr. Baúl MFC/MFC-BV imp/Biblioteca/ASIST/RES/Ingreso talleres) | confirmada | presente |
| 52 | parvulario | I.40 | 2026 | 14 | Jardín | 1PwPpF1CEWcjSLq9EFiGdQi7gT2sBwZezCAPfjyxatjk · tabs por curso (RA/EA/Bib. Viaj./Tall. Apod./Vol/Rol Ed./Exp.Ed./Ev. Ped./Narr. Baúl MFC/MFC-BV imp/Biblioteca/ASIST/RES/Ingreso talleres) | confirmada | presente |
| 53 | parvulario | I.49 | 2026 | 14 | Jardín | 1PwPpF1CEWcjSLq9EFiGdQi7gT2sBwZezCAPfjyxatjk · tabs por curso (RA/EA/Bib. Viaj./Tall. Apod./Vol/Rol Ed./Exp.Ed./Ev. Ped./Narr. Baúl MFC/MFC-BV imp/Biblioteca/ASIST/RES/Ingreso talleres) | confirmada | presente |
| 54 | parvulario | I.54 | 2026 | 14 | Jardín | 1PwPpF1CEWcjSLq9EFiGdQi7gT2sBwZezCAPfjyxatjk · tabs por curso (RA/EA/Bib. Viaj./Tall. Apod./Vol/Rol Ed./Exp.Ed./Ev. Ped./Narr. Baúl MFC/MFC-BV imp/Biblioteca/ASIST/RES/Ingreso talleres) | confirmada | presente |
| 55 | parvulario | I.4 | 2025 | 14 | Consultor | 1KnApSDHVGh8tXzPYOQY957jvzEvw3ra5lwvxevL3s9A · Planilla Central (tab por jardín/consolidado) | confirmada | presente |
| 56 | parvulario | I.5 | 2025 | 14 | Consultor | 1KnApSDHVGh8tXzPYOQY957jvzEvw3ra5lwvxevL3s9A · Planilla Central (tab por jardín/consolidado) | confirmada | presente |
| 57 | parvulario | I.6 | 2025 | 14 | Consultor | 1KnApSDHVGh8tXzPYOQY957jvzEvw3ra5lwvxevL3s9A · Planilla Central (tab por jardín/consolidado) | confirmada | presente |
| 58 | parvulario | I.7 | 2025 | 14 | Consultor | 1KnApSDHVGh8tXzPYOQY957jvzEvw3ra5lwvxevL3s9A · Planilla Central (tab por jardín/consolidado) | confirmada | presente |
| 59 | parvulario | I.8 | 2025 | 14 | Consultor | 1KnApSDHVGh8tXzPYOQY957jvzEvw3ra5lwvxevL3s9A · Planilla Central (tab por jardín/consolidado) | confirmada | presente |
| 60 | parvulario | I.10 | 2025 | 14 | Consultor | 1KnApSDHVGh8tXzPYOQY957jvzEvw3ra5lwvxevL3s9A · Planilla Central (tab por jardín/consolidado) | confirmada | presente |
| 61 | parvulario | I.29 | 2025 | 14 | Consultor | 1KnApSDHVGh8tXzPYOQY957jvzEvw3ra5lwvxevL3s9A · Planilla Central (tab por jardín/consolidado) | confirmada | presente |
| 62 | parvulario | I.33 | 2025 | 10 | Consultor | 1KnApSDHVGh8tXzPYOQY957jvzEvw3ra5lwvxevL3s9A · Planilla Central (tab por jardín/consolidado) | confirmada | presente |
| 63 | parvulario | I.33 | 2026 | 9 | Consultor | 1Qr5QvnfJ-_F3hVRikFRWNy-RyruKBK7T37m-DY-obwk · Planilla Central (tab por jardín/consolidado) | confirmada | presente |
| 64 | parvulario | I.34 | 2026 | 9 | Consultor | 1Qr5QvnfJ-_F3hVRikFRWNy-RyruKBK7T37m-DY-obwk · Planilla Central (tab por jardín/consolidado) | confirmada | presente |
| 65 | escolar | I26 | 2026 | 7 | Evaluación final actividad | 1DLO9IDz45XCJB1tvt1C9Ho9jA3Fn6LEGnG37qbJOcYI · sub-workbook por curso → Actividades | confirmada | presente |
| 66 | escolar | I35 | 2025 | 5 | Encuesta apoderados | 1yxgC1v4q7dwq38uD8d678eNGCByhdrbNj_708jnblus · Resultados indicadores 2025 (pestaña pivote) — indicadores 2025 computados | confirmada | parcial |
| 67 | escolar | I37 | 2025 | 5 | Registro establecimiento | 1yxgC1v4q7dwq38uD8d678eNGCByhdrbNj_708jnblus · Resultados indicadores 2025 (pestaña pivote) — indicadores 2025 computados | confirmada | parcial |
| 68 | escolar | I40 | 2025 | 5 | Registro establecimiento | 1yxgC1v4q7dwq38uD8d678eNGCByhdrbNj_708jnblus · Resultados indicadores 2025 (pestaña pivote) — indicadores 2025 computados | confirmada | parcial |
| 69 | escolar | I43 | 2025 | 5 | Registro establecimiento | 1yxgC1v4q7dwq38uD8d678eNGCByhdrbNj_708jnblus · Resultados indicadores 2025 (pestaña pivote) — indicadores 2025 computados | confirmada | parcial |
| 70 | escolar | I27 | 2026 | 3 | Sin especificar | Registro Coordinación > PKA..8B (por curso) | inferida | ausente-mapeo |
| 71 | escolar | I47 | 2026 | 3 | Registro establecimiento | 1m0GBH1xciC_gLvkJqV7XjMjsnLcahYbMe308IipKgp0 · Registro Coordinación → tabs por curso + Consolidado Establecimiento | confirmada | presente |
| 72 | escolar | I48 | 2026 | 3 | Registro establecimiento | 1On3LCVfeHwCc9uqfljOjaImunENrrIIBe8cPB22yJaY · Registro Coordinación → tabs por curso + Consolidado Establecimiento | confirmada | presente |
| 73 | parvulario | I.30 | 2025 | 2 | Consultor | 1KnApSDHVGh8tXzPYOQY957jvzEvw3ra5lwvxevL3s9A · Planilla Central (tab por jardín/consolidado) | confirmada | presente |
| 74 | parvulario | I.23 | 2025 | 2 | Consultor | 1KnApSDHVGh8tXzPYOQY957jvzEvw3ra5lwvxevL3s9A · Planilla Central (tab por jardín/consolidado) | confirmada | presente |
| 75 | escolar | I19 | 2026 | 2 | Sin especificar | Registro Coordinación > PKA..8B (por curso) | inferida | ausente-mapeo |
| 76 | escolar | I20 | 2026 | 2 | Sin especificar | Registro Coordinación > PKA..8B (por curso) | inferida | ausente-mapeo |
| 77 | escolar | I40 | 2026 | 2 | Sin especificar | Registro Coordinación > PKA..8B | inferida | ausente-mapeo |
| 78 | escolar | I41 | 2026 | 2 | Sin especificar | Registro Coordinación > PKA..8B | inferida | ausente-mapeo |
| 79 | escolar | I4 | 2026 | 2 | Sin especificar | Datos Consultor > Reuniones equipo de Gestión | inferida | ausente-mapeo |
| 80 | escolar | I6 | 2025 | 1 | Consultor | 1yxgC1v4q7dwq38uD8d678eNGCByhdrbNj_708jnblus · Resultados indicadores 2025 (pestaña pivote) — indicadores 2025 computados | confirmada | parcial |

## Notas de método

- La medición usa `docs/task2-cobertura-matriz.json` como columna “existe” (auditoría de fuentes
  hecha en Etapa 2, no re-medida aquí para evitar dobles lecturas de Sheets y no volver a tocar
  PII). Cada fila de esa matriz representa una celda del cubo `(indicador × establecimiento × año)`.
- La medición usa `resultados_real` como columna “mostrado”. Se leen todos los documentos y se
  construye un set con la llave `(programa, establecimientoId, indicadorId, anio)`. Un cell se
  marca **existe+mostrado** ↔ la llave está en ese set y la matriz de cobertura reporta el valor
  como existente.
- **Confianza de ubicación**:
  - `confirmada`: la matriz de cobertura tiene `sourceTab` + `sourceColumns` poblados y estado
    `presente` o `parcial`; también `ausente-datos`/`ausente-acceso` cuya ubicación es conocida
    aunque el valor no exista/no sea leíble.
  - `inferida`: estado `ausente-mapeo` (Etapa 2 propuso una columna pero Sebastián debe
    confirmarla). Un `existe+no-mostrado` con confianza `inferida` requiere revisión antes de
    ser ingresado — la propuesta podría ser incorrecta.
- Se detectan documentos huérfanos en `resultados_real` que no calcen con ninguna fila de la
  matriz (typos de id, ediciones fuera de banda). Se listan pero no se cuentan como
  `existe+mostrado`.

## Archivos anexos

- `docs/auditoria-llenado.csv` — una fila por `(programa, indicadorId, establecimientoId, anio)`.
- `docs/auditoria-llenado.json` — misma información en JSON.

## Resumen ejecutivo

- **existe+mostrado**: 1.669 celdas (50.7 %).
- **existe+no-mostrado**: 1.099 celdas (33.4 %). Esta es la brecha recuperable.
- **no-existe**: 245 celdas (7.4 %).
- **no-accesible**: 48 celdas (1.5 %).

Top de `existe+no-mostrado` (primeros 5 por centros):

1. **parvulario · I.3 · 2026** — 24 centros · fuente: Consultor · ubicación: Planilla Central (tab por jardín/consolidado) (confirmada)
2. **parvulario · I.13 · 2026** — 24 centros · fuente: Consultor · ubicación: Planilla Central (tab por jardín/consolidado) (confirmada)
3. **parvulario · I.32 · 2026** — 24 centros · fuente: Consultor · ubicación: Planilla Central (tab por jardín/consolidado) (confirmada)
4. **parvulario · I.7 · 2026** — 23 centros · fuente: Consultor · ubicación: Planilla Central (tab por jardín/consolidado) (confirmada)
5. **parvulario · I.4 · 2026** — 22 centros · fuente: Consultor · ubicación: Planilla Central (tab por jardín/consolidado) (confirmada)
