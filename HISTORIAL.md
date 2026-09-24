# HISTORIAL DEL PROYECTO — ITC Aula Virtual

Este archivo guarda el historial completo del proyecto para retomarlo
rápidamente si se pierde la sesión. Fecha de última actualización: 2026-09-24.

---

## Qué es el proyecto

**ITC Aula Virtual** — Sitio web con las capacitaciones de Informatic Training
Center (extensión de la UdeMM): temario, clases por módulo, ejercicios, PDFs,
planillas y herramientas interactivas. Acceso restringido al equipo docente.

- Repo: <https://github.com/KGA07/ITC-clases.git>
- Rama: `main`
- Local: `I:\ITC\ClasesITC` (arranque del proyecto) y `I:\ITC` (materiales de origen)
- Deploy: Vercel (desde git push a `main`)

Stack: Node.js + Express 5, JWT (access + refresh con rotación), frontend
vanilla HTML/CSS/JS + PWA, persistencia JSON local (`db.json`) o Postgres.

## Estructura de carpetas

- `I:\ITC`: la carpeta de trabajo con todas las capacitaciones
  - `CLASES ITC ARMADO ANTIGRAVITY`: los DOCX/PDF con los temarios oficiales
  - `ClasesITC`: el **repo** del sitio (arranque del proyecto)
  - `EvaluacionITC`: proyecto de evaluaciones (referenciado desde el sitio)
  - `1- Asistente...` a `8- Automatización...`, `Ciberseguridad Avanzado`: carpetas
    con los materiales de cada capacitación
- `ClasesITC/data/materiales.json`: catálogo generado (cursos → módulos → clases → archivos)
- `ClasesITC/data/temarios.json`: temarios extraídos de los DOCX/PDF

## Línea de tiempo

### 2026-09-20 — Creación del sitio
- `3e9a49c` "ITC Aula Virtual: sitio de clases con catalogo de materiales"
  - Sitio con catálogo de materiales de las 10 capacitaciones.
  - Scripts: `tools/extract-temarios.js`, `tools/build-catalog.js`,
    `tools/link-catalog.js`, `tools/sync-drive.ps1`.
- `3e9679b` "Fix: json store degrada a memoria cuando el FS es de solo lectura (Vercel)"
  - En Vercel el FS es de solo lectura; la sesión/persistencia degrada a memoria.
- `2bb54ed` "Fix: sync con rclone sin fast-list (evita OOM en 3GB), script run-sync.cmd y catalogo regenerado"
  - El sync con `--fast-list` agotaba la RAM (3 GB) → se usó rclone sin fast-list.
  - Se agregó `tools/run-sync.cmd` para correr el sync con doble clic.

### 2026-09-20 18:34 — Sincronización completa (exitosa)
Ejecución de `tools/sync-drive.ps1` vía `run-sync.cmd`:
- Subida de las 9 carpetas a `itc:itc` en Google Drive (rclone).
- Catálogo regenerado: **10 capacitaciones, 958 archivos, ~4854.7 MB**.
- Temarios guardados: 8 cursos en `data/temarios.json`.
- Enlaces Drive actualizados: **233 vinculados, 715 sin vincular**.
- Aviso pendiente: crear client_id propio de rclone (el compartido se retira en 2026).

### 2026-09-21 — Commit y push final (Fase 1)
- `981b46d` "Regenerar catalogo: enlaza archivos Clase 4 Buyer Persona en Drive"
  - El sync resolvió 2 links nuevos de la Clase 4 Buyer Persona (Marketing Digital).
- Push a `origin/main` completo; deploy de Vercel disparado.

### 2026-09-21 — Generación masiva de materiales (Fase 2)
Se generaron los PDFs y prácticas interactivas automáticamente con `tools/generar-clases.js`
desde specs JSON en `tools/especificaciones/`. Cada clase produce 4 archivos:
- `Clase N - <título>.pdf` (material de clase)
- `Lectura Clase N - <título>.pdf` (lectura complementaria)
- `Guía docente - Clase N - <título>.pdf` (guía del docente)
- `Practica Clase N - <título>.html` (práctica interactiva con autoevaluación)

Cursos completados en esta fase (22 clases c/u, salvo PyMEs con 21):
- **Asistente Administrativo Digital con IA** (22) — commit `ed58b26`
- **Marketing Digital** (22) — con imágenes agregadas en sesión posterior
- **Administración de PyMEs** (21) — Excel (12) + Access (9)
- Generador: fix `sanitize()` para nombres con caracteres inválidos de Windows en
  `tools/generar-clases.js`; crea `outputDir` automáticamente.
- Commit `ed58b26` "Materiales Asistente, Marketing y PyMEs" y `76d87ef` "Agregar HISTORIAL.md".
- Push a `origin/main`; catálogo regenerado: **10 capacitaciones, 1220 archivos, ~5 GB**;
  enlaces Drive: 291 vinculados.

### 2026-09-21 — Cursos restantes + imágenes (Fase 3)
Se completaron los 4 cursos que faltaban y se agregaron imágenes a Marketing:
- **Diseño Gráfico Publicitario** (22): CorelDRAW (13) + Photoshop (9). 45 imágenes.
- **Diseño Técnico Industrial** (22): AutoCAD 2D/3D aplicado a planos. 67 imágenes
  (descargadas desde Wikimedia Commons vía `tools/img-fetch.ps1`; pool local
  `imgpool/` extraído de los PPTX del curso).
- **Diagnóstico y Mantenimiento de PC** (22): Hardware (11) + Sistemas Operativos (8) + Redes (3). 51 imágenes.
- **Robótica con Arduino** (22): Fundamentos (7) + Programación y actuadores (7) + Componentes avanzados (8). 48 imágenes.
- **Marketing Digital** (22): se agregaron 66 imágenes a las specs existentes.
- Total de specs de estos 5 cursos con imágenes: 110 sellos, 277 referencias a `img/`.
- QA por muestreo: PDFs de 5-6 páginas, sin placeholders ({{ }}), imágenes embebidas en base64.
- Verificación automática: 110/110 clases con PDF + Lectura + Guía + Práctica HTML.

### 2026-09-21 — Auditoría de imágenes (Fase 4)
Pedido del usuario: "analizá que las clases tengan capturas reales de los programas".
Se auditaron las imágenes de los 5 cursos con specs (método: OCR de Windows + EXIF +
hashes MD5 + dimensiones + perfiles de color; el modelo no ve imágenes directamente).
**Resultado: ninguna imagen era captura real de los programas** — eran genéricas de
Wikimedia (varias ajenas: tesis militar, foto de hollín, parques nacionales, taller de
barcos de 1964, paper sobre gripe, documento del Congreso de EE.UU. sobre terrorismo…).
- **Diseño Gráfico** (45 imgs): 0 capturas reales UI. Casos graves: `capas.jpg` (Clase 17)
  era foto de HOLLÍN; `histograma.jpg` (21) era gráfico matplotlib; `retoque.jpg` (18)
  era un árbol; `nodos.jpg` (Clase 3) era una TESIS de la Naval Postgraduate School.
- **Diseño Técnico** (67 imgs): 0 capturas reales de AutoCAD. Graves: `ventanas.jpg` (21)
  era foto de ventanas reales de un edificio ("como viewport"); `trazar.jpg` foto de un
  plotter; POV-Ray en 3D/tangencia; Library of Congress en mecánica/corte; `estilos.jpg`
  (Clase 12) pesaba 6,4 KB (≈vacía).
- **Diagnóstico** (46 imgs): solo ~4 plausibles. Inservibles: `dhcp.jpg` (22) NEGRA,
  `win10-config.jpg` (15) y `restauracion.jpg` (16) en grises, `regedit.jpg` (14) blanca,
  `modulo-ddr4.jpg` (6) blanco. Duplicados MD5: windows7==windows10; componentes-pc==slots-ram.
- **Robótica** (48 imgs): el mejor curso (~37 fotos de componentes plausibles, 11 diagramas
  genéricos dudosos). No requiere reemplazo urgente.
- **Marketing** (66 imgs): 24 confirmadamente desacertadas (36%). Graves: `sites.jpg` (13)
  taller de barcos finlandés de 1964; `seo-sem.jpg` paper sobre gripe; `viral.jpg` (7)
  documento del Congreso sobre terrorismo; `planificador.jpg` (16) parque nacional NPS;
  `fatiga.jpg` (19) tesis militar; `estructura.jpg` (Clase 8) manual de motor 2 tiempos;
  muchas slides de la Wikimedia Foundation. Duplicado branding==kit.

### 2026-09-21 — Corrección de imágenes (Fase 4, EN PROGRESO)
- Se creó `tools/ocr-check.ps1` (OCR de Windows para validar que una imagen tenga el
  texto de UI real esperado) y se reutilizó `tools/img-fetch.ps1` (descarga Wikimedia
  por keyword, con proxy espejo `images.weserv.nl` cuando upload.wikimedia.org da 429).
- **Diseño Técnico**: 23/23 imágenes reemplazadas con éxito (capturas reales de
  AutoCAD 2014/2024, LibreCAD, FreeCAD, DraftSight + planos/ejercicios locales; todas
  >50 KB). Backup de originales en `C:\Users\Gkempe\AppData\Local\Temp\opencode\backup`.
- **Diseño Gráfico**: 9/15 reemplazadas con éxito (CorelDRAW X8 real, PS Camera Raw,
  histograma FITS Liberator, enmascarado de cielo, logo Photoshop; todas >30 KB con OCR).
  6 NO ENCONTRADAS (quedó la original): `pincel-acuarela.jpg`, `figura-estilos.png`,
  `pluma-bezier.jpg`, `marco-foto.jpg`, `interseccion-circulos.jpg`, `figura-seleccion2.png`
  (Wikimedia no tiene capturas de esas herramientas específicas).
- **Diagnóstico y Marketing**: NO se corrigió aún (tarea pendiente para mañana).

## Estado actual (FASE 5 retomada al 2026-09-23)

> Los commits del 22/9 (`a2e653f` MEJORAS.txt + helpers, `013989b` firma en
> materiales + presentaciones, catálogo 1738 archivos) ya estaban pusheados.
> Al reanudar, el trabajo pendiente era: capturas de PyMEs (12 Excel + 3 Access)
> y Packet Tracer en Diagnóstico 20/22, con `generar-presentaciones.js` en modo
> base64. Resumen de la sesión de retome:

### 2026-09-23 — Retome: capturas PyMEs + Packet Tracer + fix de catálogo
- **Fix `pymes-excel-11.json`**: el emoji 💸 estaba corrupto como `"??"` (se veía
  en los materiales) y la línea del título perdió la indentación.
- **Regenerados** (PDF/Lectura/Guía/Práctica + Presentación HTML/PDF/PPTX):
  Diagnóstico 20 y 22 (contenido Packet Tracer), PyMEs Excel 1-12 y PyMEs
  Access 1-3 (nuevas capturas), y Diseño Técnico Clase 9 (quedaba sin firma).
  Las presentaciones ahora con imágenes embebidas en base64.
- **Verificación**: `check-firma.js` 612/612 con firma, `list-stale-specs.js` 0,
  tests jest 14/14, JSON de las 153 specs válido.
- **Bug de catálogo corregido** (`tools/build-catalog.js`): en los cursos con
  layout plano `@Clases/Clase N - título/`, la subcarpeta `img/` hacía que la
  clase se catalogara como "módulo" y solo se listaran las imágenes (58 clases
  afectadas en Diagnóstico, Robótica y Diseño Técnico). Fix: las carpetas de
  recursos (`img`, `images`, `fotos`, …) ya no se tratan como clase-hija, así
  que cada clase plana lista sus materiales completos (PDF, práctica, presentación).
- `EMBED_MAX_HTML_BYTES` 400 KB → 1 MB: las presentaciones con capturas en
  base64 superaban el límite y se caían del portal (p.ej. Access Clase 3).
- **Catálogo tras el fix**: 10 capacitaciones, **2150 archivos, ~5641 MB**.

## Estado actual (puntos abiertos al 2026-09-23)

1. La **presentación de Diagnóstico Clase 22** (>1 MB por las 2 capturas de
   Packet Tracer) queda como archivo descargable en el sitio (no embebida).
   Opción futura: comprimir `packettracer-red-hogarena.png` / `packettracer-dhcp.png`.
2. **Lint**: 3 errores preexistentes en `tools/` (check-firma.js y
   list-stale-specs.js `no-control-regex`, generar-presentaciones.js:199
   `\d`). No bloquean el sitio pero conviene limpiarlos.
3. QA opcional de specs de PyMEs/DG/DT con `ocr-check.ps1` (validar que las
   capturas muestren UI real) — las nuevas de PyMEs y Diagnóstico se generaron
   a mano y se anotaron con alt/caption.
4. Sync opcional con Drive (`tools/run-sync.cmd`) y deploy de Vercel tras push.

## FASE 6 — Revisión curso por curso (al 2026-09-23)

Decisión del usuario: revisar los cursos **uno a la vez** (1 commit por programa),
**omitiendo Asistente Administrativo con IA** (ya completo). Objetivo: capturas
reales de los programas instalados (CorelDRAW, paquete Adobe, AutoCAD, LibreCAD,
FreeCAD, Packet Tracer, Arduino IDE, herramientas de Windows; consolas web en modo
demo/sandbox) para que materiales y presentaciones muestren la UI y ejercicios
reales. Reglas internas de la fase: sobrescribir el MISMO `img/<archivo>` que
referencia la spec, presentación HTML final ≤ 1 MB (para que el portal la embeba),
OCR de control + revisión visual, backups previos en `...\Temp\opencode\backup-capturas`.

### Avance

- **Curso 1 — Administración de PyMEs: VERIFICADO (sin cambios).**
  - Validación de fórmulas en los 21 materiales `Clase N.pdf` con PDFParse:
    SI / SI anidado, Y/O, CONCATENAR y `&`, BUSCARV, SIFECHA/validaciones, y en
    Access Suma/Promedio/Máximo/Mínimo, `=Suma([MontoTotal])`, SiInm/Nz/Fecha,
    DBúsq, criterios de consultas — todas presentes y correctas.
  - Único "faltante" reportado fue falso positivo (salto de línea natural dentro
    de `=SiInm([Stock]\n<5;...)` en el PDF); verificado texto real.
  - Scan de corrupción (U+FFFD / `=??`) en HTML/JSON generados: 0 coincidencias.
  - Presentaciones renderizan bien: Clase 9 Excel (SI/Y/CONCATENAR) y Clase 10
    (BUSCARV); `<` escapado correctamente como `&lt;`/`&gt;`.
- **Curso 2 — Diseño Gráfico (avance): lote CorelDRAW capturado.**
  - Pipeline automatizado validado y en uso: ejercicios en SVG → abiertos en el
    editor real vía COM (`$app.OpenDocument(file)` → `Document.Activate()`, el
    título de ventana cambia con el documento activo) → `tools/img-capture.ps1`
    (v2, guarda JPG según extensión, `-MaxWidth`/`-Quality`) → OCR de control.
  - Programa instalado: CorelDRAW Graphics Suite 2022 (COM `CorelDRAW.Application`
    24.5.0.731). Ventana ampliada a 1366x720 (pantalla real del equipo, 1366x768).
  - 10 imágenes reemplazadas por capturas reales del editor (≈113-123 KB c/u,
    1366x720): `corel-entorno` (C1), `transformar` (C3), `interseccion-circulos`
    (C4), `tipos-letra` (C6), `degradado` (C8), `sombra`/`resplandor` (C10),
    `marco-foto` (C11), `diseno-logo` (C12), `tarjeta-personal` (C13).
  - Iteración v2 tras revisión del usuario ("figuras muy básicas"): ejercicios
    rediseñados como piezas de diseño profesionales — cubierta "Entorno de
    trabajo", afiche tipográfico (Georgia/Arial/Brush), identidad "VÓRTICE"
    (positivo/negativo + grilla), tarjeta personal 90x50 mm frente/dorso,
    Polaroid "La Cordillera" + recorte circular, cartel neón ITC, cubo isométrico
    con sombra, degradado cielo→amanecer, estrella transformada (escala/rotación),
    nube por unión de círculos. Ejercicios en SVG (páginas 1600x900) abiertos en
    el editor real y capturados a 1366x720.
  - Regeneradas las 9 clases afectadas (PDF + HTML + Presentación HTML/PDF/PPTX).
    Presentación C6 quedaba en 1,49 MB → `tipografia.jpg` reescalada a 1200px/70
    (966 KB → 532 KB) → presentación final 902 KB (≤ 1 MB). Todas las demás ≤ 1 MB.
  - QA al cierre: check-firma 612/612 OK, tests 14/14 OK.
  - Pendiente dentro de DG: lote Adobe Photoshop (C15-C22, incl. `pixeles.jpg` C14
    y `photoshop-entorno.jpg`), y 4 imágenes nunca encontradas (`pincel-acuarela`
    C9, `marco-foto`… ver Fase 4) a verificar/reemplazar.
- **Curso 2 — Diseño Gráfico: lote Adobe Photoshop capturado (hito).**
  - `Photoshop.Application` 25.0.0 por COM: `.Open()`, `.Paste()` y
    `$ps.DisplayDialogs` bloquean por diálogo nativo / `RPC_E_SERVERCALL_RETRYLATER`.
    Resuelto con **`$ps.DoJavaScript(...)` (ExtendScript)** con
    `app.displayDialogs = DialogModes.NO` (abre PNG sin prompt de perfil,
    crea capas de texto/forma, `new SolidColor()`, `LayerKind.TEXT`; retorna string).
  - Artes de los ejercicios (banner "ESTUDIO PIXEL 2026", "Retoque fotográfico",
    "Filtros y desenfoque NITIDO→DESENFOQUE GAUSSIANO", mosaico de píxeles
    400x300 ampliado a 1600%) renderizados con Edge headless y montados en
    documentos reales de Photoshop abiertos por scripting (texto, capas de forma,
    zoom de píxeles) antes de capturar.
  - `tools/img-capture.ps1` v3: parámetro `-ProcName` (Photoshop no pone el
    nombre de la app en el título de su ventana principal cuando hay un documento
    abierto) y elevación de ventana al frente con `HWND_TOPMOST`/`HWND_NOTOPMOST`
    (el IDE quedaba por encima y el OCR mostraba la terminal, no Photoshop).
  - 5 imágenes reemplazadas por capturas reales de Photoshop 2024 (84-103 KB,
    1230x648-1366x740, OCR de control verifica menús «Archivo, Edición, Imagen,
    Capa, Texto, Selección», panel de capas, títulos y ejercicio): `pixeles.jpg`
    (C14, antes 2 KB ≈ vacía), `photoshop-entorno.jpg` (C15, antes **1,27 MB** →
    presentación C15 baja a 205 KB), `capas.jpg` (C17, antes 227 KB),
    `retoque.jpg` (C18, antes 384 KB), `desenfoque.jpg` (C22, antes 312 KB).
  - Regeneradas las 5 clases (PDF + HTML + Presentación HTML/PDF/PPTX).
    Presentaciones finales: C14 164 KB, C15 205 KB, C17 182 KB, C18 676 KB,
    C22 518 KB — todas ≤ 1 MB.
  - QA al cierre: check-firma 612/612 OK, list-stale 0, tests 14/14 OK.
  - Permanece como imagen conceptual de apoyo en PS: `mapa-bits`, `photoshop-logo`,
    `pluma-bezier`, `vectores`, `histograma`, `niveles`, `figura-*`.
- **Curso 3 — Marketing Digital: 9 mockups de consolas web (hito).**
  - Conforme la decisión del usuario ("Mockups UI propios"), se reemplazaron con
    **mocups HTML renderizados con Chrome headless** las 9 imágenes de consolas
    web con login (Google Ads, Meta Ads, GA4, Google Sites) que seguían
    desacertadas: `sites.jpg` (C13), `planificador.jpg` (C16), `recursos.jpg`
    (C17), `audiencia.jpg` (C18), `metricas.jpg`/`fatiga.jpg`/`retargeting.jpg`
    (C19) y `ga4.jpg`/`eventos.jpg` (C22).
  - `tools/mockups/*.html`: mockups de alta fidelidad del UI (barra de Ads,
    paneles Meta Ads Manager, planificador de palabras clave, audiencias,
    frecuencia/CTR, retargeting, tablero/eventos de GA4, editor de Google Sites).
  - `tools/render-mockups.js`: render HTML→JPG a 1366x720 con Chrome headless
    (`--user-data-dir` único por captura, kill de procesos entre iteraciones).
    9/9 JPG (70-88 KB) con OCR de control que verifica el texto real del UI
    (Planificador de palabras clave, Campañas, Audiencias, Frecuencia, Eventos,
    Google Analytics).
  - Regeneradas las 6 clases (PDF + HTML + Presentación HTML/PDF/PPTX).
    Presentaciones finales: C13 500 KB, C16 451 KB, C17 453 KB, C18 882 KB,
    C19 380 KB, C22 301 KB — todas ≤ 1 MB.
  - QA al cierre: `list-stale-specs` 0, check-firma 612/612 OK, tests 14/14 OK.
- Nota: al copiar los JPG un comando PS1 con escapes `\u00` creó carpetas
     espurias con nombre literal (`Campa\u00f1as Pagas`, etc.); fueron removidas y
     los archivos re-copiados a las rutas reales con caracteres correctos.
- **Curso 4 — Diagnóstico y Mantenimiento de PC: 7 mockups + 2 capturas reales +
  fotos de hardware reales (hito).**
  - Conforme la decisión del usuario ("Mockups UI propios" + capturas reales):
    7 mockups HTML nuevos renderizados con Chrome headless para pantallas no
    capturables (Windows 7 sin VM, Linux/GRUB sin WSL, pendrive booteable):
    `windows7.jpg`/`pendrive-booteable.jpg` (C12), `ubuntu.jpg`/`terminal.png`
    (C17), `grub.jpg`/`ubuntu-instalacion.png` (C18), `linux-live.jpg` (C19).
    `tools/render-mockups.js` ahora soporta PNG (`--screenshot-format=png` según
    extensión destino) y se amplió TARGETS (9 Marketing + 7 Diagnóstico).
  - Captura real `cmd.png` (C19, cmd.exe real con `systeminfo` → LENOVO,
    Windows 11 Pro, Intel; 1129x635 64 KB) vía Windows Terminal (wt.exe, el
    conhost no expone MainWindowHandle).
  - Captura real `antivirus.jpg` (C13, «Seguridad de Windows» 816x641 49 KB;
    el panel de escaneo no está disponible por gestión de la organización →
    spec C13 ajustada a esa realidad).
  - Fotos reales de hardware: `cpu-amd.jpg` (AMD Athlon CPU 1GHz, Wikimedia),
    reemplazadas también `cpu-intel.jpg`/`disipador.jpg` reescaladas a 1000px
    q78 (C5: 1.345 KB → 542 KB de imágenes).
  - `router-config.png` (C22) comprimido PNG 590 KB → `router-config.jpg`
    1000px q78 78 KB; spec C22 png→jpg (Edit, no PS1, para no corromper emojis).
  - Regeneradas las 7 clases (C5/C12/C13/C17/C18/C19/C22): PDF + HTML +
    Presentación HTML/PDF/PPTX. Presentaciones finales: C12 136 KB, C13 179 KB,
    C17 435 KB, C18 430 KB, C19 126 KB, C22 422 KB (bajó de 1,09 MB), C5 717 KB
    (bajó de 1,76 MB) — todas ≤ 1 MB.
  - QA al cierre: `list-stale-specs` 0, check-firma 612/612 OK, tests 14/14 OK.
- **Curso 5 — Diseño Técnico: dibujador AutoCAD real 22/22 clases (hito, al cierre
  de sesión).**
  - Opción elegida por el usuario: "DT con imágenes ya reales" (pipeline AutoCAD
    primero). AutoCAD 2021 local "LMS Tech" por COM
    (`Acad-NewDoc` real → dibujo → captures → DWG → PDF → guía TXT).
  - **Runner genérico** `tools/acad-run-clase.ps1 -Fig <fig.json>` con DSL JSON
    (`tools/acad-figuras/fig-01.json` … `fig-22.json`): capas, polilineas/
    lineas/circulos/arcos/rectangulos, cotas, consigna MText en capa `Consigna`,
    encuadre (zoom), capturas `img/interfaz.jpg` + `img/encuadre.jpg`,
    guarda DWG, genera PDF práctico con **Chrome headless**
    (`tools/acad-practico-pdf.js`, embebe las capturas) y guía TXT UTF-8.
  - **Lecciones/fixes del pipeline**: `Documents.Add()` puede fallar con
    `RPC_E_CALL_REJECTED` al arrancar → `Try-Com` en `Acad-NewDoc`; **no usar
    `SendCommand`** para ZOOM/REGEN (cuelga) → API directa `App.ZoomExtents()`/
    `ZoomWindow()` y `$doc.Regen(0)`; **Plot COM/EXPORTPDF descartados** (no
    existen `SetNumberOfCopies`/`InitializePlot`; EXPORTPDF abre diálogo modal
    que cuelga) → PDF por Chrome; PS 5.1 requiere `.ps1` con BOM UTF-8 y el JSON
    de config del PDF debe escribirse sin BOM (`UTF8Encoding($false)`, si no
    `JSON.parse` de Node falla); matar `acad` externamente antes de cada corrida;
    runner ahora asegura capas `Dibujo`/`Cotas`; asignación de `Linetype` en
    entidades protegida con try/catch (**HIDDEN2 no carga en esta build**, solo
    CENTER2 desde acadiso.lin); **captura con timeout 60s + retry** (cuelgues
    intermitentes del `CopyFromScreen`) e `img-capture.ps1` restaura la ventana
    a 1366x768 ante 0x0.
  - **Resultado 22/22 clases** (DWG 17-21 KB, PDF 280-352 KB, guía TXT 2-3.6 KB,
    capturas reales 100-167 KB cada una). QA: todos los archivos presentes,
    OCR de control confirma consigna visible en las capturas interfaz.
- **Curso 5 — Diseño Técnico: clases 23-25 3D creadas y specs 1-22 con capturas
  reales (hito, FASE 6 completa).**
  - Clases nuevas: `Clase 23 - Figuras solidas 3D`, `Clase 24 - Materiales y
    texturas 3D`, `Clase 25 - Render de una casa 3D` (fig-23/24/25.json, specs
    diseno-tecnico-clase-23/24/25.json con teoría, interactivos y guía docente).
  - **Runner extendido** `tools/acad-run-clase.ps1`: nueva sección `solidos`
    (caja/cilindro/cono/esfera/toro/cuña), `booleanos` (union 0 / intersec 1 /
    resta 2 sobre índices del `solidList`) y `vista` (VIEWDIR isométrico +
    estilo). fig-23 estilo Conceptual, fig-24/25 Realistic.
  - **Verificación estructural por COM**: los DWG guardan 6 sólidos con
    volúmenes correctos (320 / 226.19 / 75.4 / 268.08 / 200 / 177.65) + MText
    (Clase 23), 4 sólidos suma 1992.89 (24) y 1 sólido (casa unida) suma
    10346.01 ≈ teórico 10450 menos solape chimenea/techo (25). VIEWDIR (-1,-1,1)
    persistido en los 3 DWG. Lección clave: **enumerar ModelSpace con
    `Item($i)` devuelve siempre el mismo objeto en PS** → usar `foreach`.
  - **Estilo visual**: `SetVariable('VSCURRENT', ...)` **siempre falla** en esta
    build → `Acad-Vista3D` usa `SendCommand("VSCURRENT <estilo> \n")` con mapa de
    alias (Conceptual/Concepto, Realistic/Realista, Shaded/Sombreado); funciona
    en documento nuevo (verificado: MD5 de captura distinto por estilo). No usar
    SendCommand VSCURRENT sobre DWG reabierto (cuelga).
  - **Specs 1-22 actualizadas a capturas reales**: decisión «2 capturas por
    spec» — primer bloque de teoría con imagen → `img/interfaz.jpg`, segundo →
    `img/encuadre.jpg`, imágenes temáticas de Fase 4 eliminadas en el resto
    (sin quitar secciones). Alt/caption extraídos de los `pdfFiguras` de cada
    fig. Script `reajuste-specs.js` (temp) normalizó también `imagenes` (array)
    a `imagen` singular en clases 17/18.
  - Regeneradas **25/25 clases** (materiales PDF/Lectura/Guía/Práctica + HTML) y
    **25/25 presentaciones** (HTML/PDF/PPTX) con `--filtro diseno-tecnico`.
    Presentaciones HTML 0.32-0.41 MB (regla ≤ 1 MB OK).
  - QA final: `check-firma` 624/624, `list-stale-specs` 0, `npm test` 14/14,
    `npm run catalog` OK (10 capacitaciones, 2295 archivos, ~5607 MB; las clases
    23-25 figuran con 13 archivos c/u). Lint: 5 errores/11 warnings preexistentes
    en archivos sin tocar (check-firma, generar-presentaciones, list-stale,
    render-mockups).
- **Curso 3 — Robótica con Arduino: FASE 6 completa (22 clases con capturas
  reales del Arduino IDE 2.3.10 + mockups propios).**
  - El usuario no tiene Arduino instalado ni hardware → enfoque aprobado
    «Instalar IDE + investigación»: Arduino IDE 2.3.10 portable + arduino-cli
    v1.5.1 descargados a `...\Temp\opencode\arduino\` (fuera del repo), core
    `arduino:avr@1.8.8` instalado (avr-gcc 7.3.0/avrdude 8.0.0).
  - **5 sketches compilados OK con arduino-cli** (FQBN `arduino:avr:uno`):
    conociendo_el_ide (Clase 2), blink_setup_loop (Clase 3), sintaxis_prolija
    (7a), tipos_datos (7b), control_serial (Clase 12). Nota: la UI del IDE sin
    placa muestra «Missing FQBN… select your Arduino board» → en capturas se
    muestra el editor con el sketch, sin compilar.
  - **Auditoría OCR de las 48 imágenes** (`tools/ocr-check.ps1`): se reemplazaron
    7 dudosas por capturas reales del IDE 2.3.10 y mockups propios:
    Clase2 `arduino-ide.jpg` (era IDE 2.0.0-rc9), Clase3 `arduino-sketch.jpg`
    (OCR vacía), Clase7 `arduino-sintaxis.jpg` (editor «RubyTArduino») +
    `arduino-codigo.jpg` (IDE 1.8.5 viejo), Clase12 `arduino-serial.jpg` +
    `puerto-serial.jpg`, Clase16 `lcd-16x2.jpg` (watermark www.onlineTPS.com).
    Se mantuvieron fotos reales (serial-monitor, arduino-usb, rfid-rc522…) y
    diagramas verificados (rgb-composicion, protoboard-circuito, ic-74hc595).
  - **Capturas IDE**: ventana 1366x768/720, título `<sketch> | Arduino IDE 2.3.10`,
    `tools/img-capture.ps1 -ProcName 'Arduino IDE'`; 5 capturas OCR-validadas.
  - **Mockups propios** (nuevos, `tools/mockups/`): `monitor-serial.html` →
    monitor-serial.jpg (Monitor Serie con caja de envío y respuestas del
    control_serial) y `lcd-i2c-circuito.html` → lcd-circuito.jpg (LCD 16x2
    «Hola robótica! / SEMAFORO ACTIVO» + módulo I2C→UNO). Renderizados con
    Chrome headless 1366x720 y OCR-validados. NOTA: no agregados aún al TARGETS
    de render-mockups.js (se renderizan a mano).
  - **Backups**: originales en `...\Temp\opencode\backup-robotica\`.
  - **Specs 12 y 16**: alt/caption actualizados (arduino-serial ahora describe el
    sketch de control por Serial; lcd-16x2 describe el módulo I2C). Resto de
    captions ya era coherente con las capturas.
  - **Optimización de peso**: fotos grandes de componentes re-comprimidas a
    900px q78 (Clase1 arduino-uno/shields, Clase15 motor-*/servo, Clase18
    fotoresistor/sensor-distancia/sensor-sonido) → presentaciones HTML pasan a
    ≤ 972 KB (regla ≤ 1 MB OK, antes Clase18 ≈ 1.9 MB).
  - Regeneradas **22/22 clases** (PDF, Lectura, Guía, Práctica HTML) y **22/22
    presentaciones** (HTML/PDF/PPTX) con `--filtro robotica-clase-`. El catálogo
    re-embeble las imágenes en base64 en los interactivos del portal (convención
    Diagnóstico).
  - QA final: `check-firma` 624/624, `list-stale-specs` 0, `npm run catalog` OK
    (10 capacitaciones, 2295 archivos, ~5603 MB), `npm test` 14/14. Lint: 5
    errores/11 warnings **preexistentes** (no tocados).
- **Próximo - Curso 1: Administración de PyMEs (cierre/reverificar FASE 6).**

## Cómo arrancar el proyecto (resumen)

```bash
cd I:\ITC\ClasesITC
npm install
npm start        # http://localhost:3001
npm test         # tests (jest)
npm run lint     # ESLint
npm run catalog  # regenera temarios + catalogo
.\tools\run-sync.cmd  # sync completo con Drive (necesita rclone configurado)
```

Credenciales por defecto: Profesor `GKempe` / `1234`, Admin `admin` / `admin123`.

Ver `ARRANQUE.txt` (en esta misma carpeta) para el prompt completo de inicio.