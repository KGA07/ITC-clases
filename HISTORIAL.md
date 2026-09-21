# Historial de cambios del proyecto

> Registro de los trabajos realizados sobre el sitio ITC Aula Virtual y el
> pipeline de generación de materiales de clase.

## 2026-09-21 — Materiales completos para 3 cursos (65 clases)

- **Asistente Administrativo Digital con IA**: completadas las Clases 1 a 22.
- **Marketing Digital**: completadas las Clases 1 a 22 (numeración según temario 2025; se crearon las carpetas de Módulos 4 a 7 que faltaban).
- **Administración de PyMEs**: completadas Excel (Clases 1 a 12) y Access (Clases 1 a 9).
- Por cada clase se generan **4 documentos**: clase (PDF), material de lectura (PDF), guía docente (PDF) y práctica interactiva (HTML).
- El catálogo (`data/materiales.json`) fue regenerado y re-vinculado con los enlaces de Google Drive (291 vinculados).

### Pipeline de generación (`tools/`)

- `tools/generar-clases.js`: generador de los 4 documentos por clase a partir de una spec JSON (portada con logotipos ITC/UDEM en SVG, teoría con imágenes embebidas, ejercicio interactivo, lectura y guía docente). Se sanitizan los nombres de archivo (caracteres inválidos de Windows).
- `tools/especificaciones/`: 65 specs JSON (una por clase) con objetivos, teoría, ejercicios, lectura y plan docente.

### Fixes previos incluidos

- `tools/sync-drive.ps1`: sync con rclone **sin** `--fast-list` y con baja concurrencia (`--transfers 2 --checkers 4`) para evitar OOM en máquinas con ~3GB de RAM. Agregado `tools/run-sync.cmd`.
- `public/…`: soporte de catálogo con degradación a memoria cuando el FS es de solo lectura (Vercel).
- Portada de clase rediseñada (gradiente + halos decorativos, tarjetas de meta, mini-etiquetas y banda inferior).
- Logotipos inyectados en crudo (SVG inline) reemplazando `{{logo-itc}}` / `{{logo-udemm}}`.
- Imágenes por sección (`t.imagen` simple o `t.imagenes` en grilla) embebidas en base64.