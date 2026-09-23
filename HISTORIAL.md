# HISTORIAL DEL PROYECTO — ITC Aula Virtual

Este archivo guarda el historial completo del proyecto para retomarlo
rápidamente si se pierde la sesión. Fecha de última actualización: 2026-09-23.

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
- **Próximo — Curso 2 (Diseño Gráfico) continua: lote Adobe Photoshop** (COM
  `Photoshop.Application` 25.0 OK). Orden siguiente: Marketing (web demo) →
  Diagnóstico (Windows/hardware/Packet Tracer, incl. C22 <1MB) → Diseño Técnico
  (reverificar 23 con AutoCAD) → Robótica (Arduino IDE) → PyMEs (cierre/reverificar).

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