# PLAN DE MEJORAS — AULA VIRTUAL ITC (itc-clases.vercel.app)

> Modo análisis. Nada de esto se implementa sin OK del docente.
> Estado del sistema al 30/10/2026: commit `5d9c3a5` (sw v16). 10 cursos, 216 clases, ~2610 archivos.
>
> **Progreso:** Fase 1 ✓ (commit `c440bf2`, sw v17); Panel General iterado (commits `7c0a9e9`, `8de6161`, `edd4f10`, sw v18-v20); Aula alumno Moodle-style (commit `d9f0c47`, sw v21); Miniaturas de cursos con SVG placeholder (commit pendiente, sw v22). Fase 2 en adelante pendientes.

---

## 1) Diagnóstico por eje

### A. Catálogo / contenido (clase por clase)

| Curso | Clases | Archivos | Embebidos | Problemas detectados |
|---|---|---|---|---|
| asistente-administrativo | 28 | 241 | 56 | Salta M6→M7→M9 (falta Módulo 8); "Material general" absorbe muuuchos PDFs; **Presentación Clase 1 sin embedUrl** (no se puede proyectar directo, solo la práctica) |
| administracion-pymes | 25 | 327 | 29 | Poco embebido (29/327); mucho PDF |
| diseno-grafico | 29 | 365 | 61 | Módulos basura ("Practicas", "DISEÑO GRAF" con @Clases, clase 20, DGP); "CLASE 15 - FOLLETO Y TARJETAS" con formato especial; 1 sinUrl |
| diseno-tecnico | 26 | 620 | 132 | Bien de contenido; 620 archivos implica carga pesada en vistas completas |
| marketing-digital | 30 | 201 | 47 | **Desorden/duplicados**: Clase 8 x2, Clase 9 x2, 3 inputs llamados "Clase 12", Clase 17 y 19 duplicadas, "Clase Whatsapp" sin número, falta Clase 14, orden roto |
| diagnostico-mantenimiento | 42 | 409 | 95 | "Clase 1/NO" con solo imágenes; carpetas sueltas "REDES", "Software", "Hardware"; clases 3-30 sin las 1-2 completas; 1 sinUrl |
| robotica-arduino | 27 | 391 | 75 | "Clase 22" duplicada (Integración 1 y 2); módulos de carpeta-only |
| automatizacion-ia | 1 + general | 10 | 1 | Solo 1 clase interactiva (Clase N8N); material general de 6 |
| ciberseguridad | 6 | 35 | 5 | **30 de 35 archivos sin URL** → material ciego para el alumno |
| herramientas-docentes | 1 | 5 | 0 | **Los 5 archivos sin URL** → material ciego |

**Problema transversal**: regenerar el catálogo (`npm run catalog`) **borra las URLs de Drive** cargadas a mano → hay que resolver el mecanismo antes de tocar módulos.

**Solución de material ciego (ciberseguridad / herramientas-docentes)**: subir esos archivos a Drive y completar `url`/`embedUrl`, o excluirlos del catálogo hasta tenerlos. Decisión del docente.

### B. UX del alumno

- **Performance real**: el aula hace **1 fetch por clase** (N+1). En asistente-administrativo son ~28 fetches encadenados; en diagnostico son ~42. Cada uno abre `loadData()` en el backend.
- **Sin indicador de progreso**: el alumno no ve cuántas clases tiene habilitadas ni cuáles ya vio.
- **Sin búsqueda dentro de su aula** (la búsqueda `/buscar` existe pero solo para admin/docente).
- **Clases colapsadas por defecto** en `<details>`: razonable con 42 clases, pero no hay forma de abrir directo una clase (no hay deep-link ni anclas).
- Modal de visualización reutilizado bien; acción "⏳ Proximamente" solo existe en la vista admin (`clase.js`), el alumno no la ve (bien).
- **Evaluaciones**: el botón del header apunta a `evaluacionesUrl: '/'` (placeholder) → para el alumno lleva a la home("/"), que le re-bota a /alumno. Confuso.

### C. UX del docente

- Panel pro, con Ver/Presentar recién agregados (v16).
- **Sin "✏️ Editar"**: docentes/alumnos se crean pero no se corrigen datos (el backend PUT ya existe completo; falta el front).
- La lista de clases del panel muestra count de materiales del catálogo **sin indicar cuántos de esos pudo habilitar** por permisos (menor).
- **Presentar ordena bien** (presentación > no-práctica > práctica) pero si la clase solo tiene práctica HTML, presenta la práctica (caso Clase 1 asistente) — mejoraría regenerando esa pieza.

### D. Admin (gestor)

- **Sin "✏️ Editar"** en alumnos ni docentes (mismo pendiente C).
- Modal de permisos funciona para ambos (bonito generalizado).
- Búsqueda de alumnos en lista no hay con muchos alumnos ( scroll); menor.
- Catálogo: el resumen de curso muestra "X con Drive / Y archivos" — útil ya.

### E. Infra / performance / PWA

- SW cache-first v16 con bump manual — proceso conocido.
- `/alumno/catalogo` + N× `/alumno/clase/:id` cada uno re-lee DB (**loadData por pedido**) → el bulk fix también aliviana backend.
- No hay paginación ni payload reducido para diseno-tecnico (620 archivos) en vistas admin — menor, es JSON liviano igual.

---

## 2) Plan de implementación (por fases)

### FASE 1 — Aula del alumno (sin tocar contenido) ⭐ recomendada para arrancar
1. **Endpoint bulk**: extender `GET /alumno/catalogo` para incluir, por cada clase visible, los **archivos permitidos** ya filtrados (hint: reusar `contextoSesion`, filtro `ctx.set.has(f.fid)`). `alumno.js` pasa a **1 solo fetch** (mantener `/alumno/clase/:id` por compat).
2. **Barra de progreso**: en cada encabezado de curso "X clases habilitadas · N materiales" + detalle "completadas" opcional si guardamos "visto" (para eso: checkbox "✔ Visto" local en localStorage del cliente — sin tocar backend en esta fase).
3. **Búsqueda local del aula**: input filtro por nombre de clase/material sobre el catálogo ya cargado (client-side, igual que el admin tiene `buscar`).
4. **Evaluaciones real**: si el docente da la URL del proyecto EvaluacionITC, se completa `config.js` (deploy env o literal). Si no: esconda el botón cuando la URL es placeholder ("/").
5. Bump sw → **v17**. Verificación e2e local + prod.

### FASE 2 — Admin / docente: editar personas
6. **"✏️ Editar" reutilizando el modal de alta** en Alumnos y Docentes: precarga datos, `PUT /alumnos/:id` o `/docentes/:id` ya existen. Incluye cambiar cursos multi.
7. En vista previa del panel, refrescar el modal tras editar.
8. Bump sw **v18**. e2e.

### FASE 3 — Contenido (requiere decisiones del docente)
9. Definir mecanismo para **no romper URLs de Drive** al regenerar catálogo (ej.: merge de urls durante regeneración por fid, o generador que preserve campo `url` de materiales.json actual).
10. Limpieza de módulos/cases: `marketing-digital` (duplicados/orden), `diseno-grafico` (módulos basura), `diagnostico-mantenimiento` (carpetas sueltas), `robotica-arduino` (Clase 22 x2), `asistente-administrativo` (Material general).
11. Material ciego (`ciberseguridad`, `herramientas-docentes`): subir a Drive + completar URLs, o ocultar.
12. Regenerar **Presentación Clase 1** asistente (drive-only) para que se pueda proyectar.

### FASE 4 — Pulidos menores (opcional)
13. Contadores del panel docente con desglose "de N archivos, M habilitados para vos".
14. Anclas/deep-links por clase en el aula (`/alumno#clase=...`).
15. Paginación/limites si el catálogo crece.

---

## 3) Decisiones que el docente tiene que tomar

- (1) ¿Arrancamos por Fase 1 (aula alumno) o tenés otra prioridad?
- (2) **Evaluaciones**: ¿existe URL real del proyecto EvaluacionITC, o escondemos el botón hasta tenerla?
- (3) **Material ciego** (ciberseguridad / herramientas-docentes 35+5 archivos): ¿los subo a Drive yo, los dejás para más adelante, u ocultamos esos materiales?
- (4) **Regeneración del catálogo**: ¿aprobás arreglar el generador para que conserve URLs de Drive ya cargadas? (sin eso, tocar catálogo es riesgoso).
- (5) ¿Puedo tocar `materiales.json` para la limpieza de marketing/diagnóstico/diseño/robotica? (no son archivos prohibidos pero implican reorganizar módulos — prefiero permiso explícito).
- (6) Queda el otro pendiente previo: **✏️ Editar** (Fase 2) y regenerar Presentación Clase 1 asistente (Fase 3, item 12).

---

## 4) Cómo se verifica cada fase

- e2e API local (node, igual que siempre) + UI por Playwright con capturas.
- Bump de sw por fase; verificación de prod (fetch de `/sw.js`, endpoints reales).
- Sin tocar: `tools\generar-clases.js`, `tools\generar-presentaciones.js`, `robotica-*`, `tools/assets/`, clases fuente.
