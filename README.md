# ITC Aula Virtual — Clases y materiales

Sitio web con todas las capacitaciones de **Informatic Training Center** (extensión de la **UdeMM**): temario, clases organizadas por módulo, ejercicios, PDFs, planillas y herramientas interactivas. Acceso restringido al equipo docente.

Incluye: Asistente Administrativo Digital con IA, Administración de PyMEs, Diseño Gráfico, Diseño Técnico Industrial, Marketing Digital, Diagnóstico y Mantenimiento de PC, Robótica con Arduino, Automatización con IA (N8N), Ciberseguridad Avanzado y las herramientas docentes.

## Stack

- Node.js + Express 5, JWT (access + refresh con rotación)
- Frontend vanilla (HTML/CSS/JS), PWA (manifest + service worker), tema claro/oscuro
- ESLint + Prettier, Jest + Supertest
- Persistencia: **JSON (`db.json`) local** o **Postgres** vía `DATABASE_URL`

## Correr local

```bash
npm install
npm start        # http://localhost:3001
```

Opcional:

```bash
npm test         # suite de tests (14)
npm run lint     # ESLint
npm run catalog  # regenera catálogo + temarios desde I:\ITC
```

### Credenciales por defecto

| Rol | Usuario | Contraseña |
| --- | --- | --- |
| Profesor | `GKempe` | `1234` |
| Admin | `admin` | `admin123` |

> Cámbialas desde `.env` (ver `.env.example`).

## Cómo funciona el catálogo de materiales

Los 5 GB de materiales viven en `I:\ITC`. Este repo no los copia: genera un **catálogo** (`data/materiales.json`) que describe cada capacitación → módulo → clase → archivo, y cada archivo queda **enlazado a Google Drive**.

1. **`npm run catalog`** → `tools/extract-temarios.js` (convierte los DOCX/PDF de `CLASES ITC ARMADO ANTIGRAVITY` a `data/temarios.json`) + `tools/build-catalog.js` (recorre la estructura local y genera `data/materiales.json`).
   - Los **HTML interactivos autocontenidos** (simuladores, quizzes, TPs) se copian a `public/html/interactivos/` para mostrarse embebidos en el sitio.
2. **`tools/sync-drive.ps1`** → sincroniza las carpetas de `I:\ITC` a tu Drive (rclone), regenera el catálogo y ejecuta `tools/link-catalog.js`, que matchea cada archivo con su elemento de Drive y escribe la `url` de descarga directa.

### Sincronizar con Google Drive (una sola vez de configuración)

```powershell
# 1. Instalar rclone (https://rclone.org) y configurar el remote:
rclone config          # drive, nombre "itc", iniciar sesión con la cuenta de ITC
# 2. Compartir en Drive la carpeta destino como "cualquier persona con el enlace"
# 3. Ejecutar:
.\tools\sync-drive.ps1
```

El script sube cada capacitación a `itc:itc` (carpeta `itc` de tu Drive), exclude archivos basura (`desktop.ini`, `Thumbs.db`, `Otros/**`, `Nueva carpeta/**`) y luego vincula el catálogo. Los archivos sin vincular quedan marcados **"Próximamente"** en el sitio.

> Credenciales de la cuenta: quedan en rclone en tu PC, nunca entran al repo.

## API

Endpoints (todos protegidos con JWT de profesor/admin):

- `POST /api/login`, `POST /api/refresh`, `POST /api/logout`
- `GET /api/catalogo` — vista liviana del catálogo (cursos → módulos → clases)
- `GET /api/curso/:id` — curso completo con temario y módulos
- `GET /api/clase/:id` — detalle de una clase con sus archivos (url de Drive + marca embebible)
- `GET /api/buscar?q=...` — búsqueda global de clases/archivos

## Desplegar en Vercel

El repo incluye `vercel.json` (serverless) y `.env.example`. Pasos:

1. Importá el repo a Vercel.
2. Agregá en **Environment Variables**: `JWT_SECRET`, `REFRESH_SECRET`, `ADMIN_PASSWORD`.
3. Opcional: `DATABASE_URL` (Postgres/Neon) para persistir sesiones entre instancias; sin ella la app usa `db.json` en memoria (el catálogo es estático, no se pierde).
4. Tras el deploy, editá `public/config.js` con la URL real del proyecto EvaluacionITC (botón "📝 Evaluaciones").

## Estructura

```
public/           frontend (HTML, CSS, JS, PWA)
config/           configuración por entorno
controllers/      lógica (auth + catálogo)
middleware/       auth, rate limit, errores, seguridad
routes/           endpoint de la API
data/             persistencia (db.json / Postgres) + materiales.json + temarios.json
tools/            extract-temarios.js, build-catalog.js, link-catalog.js, sync-drive.ps1
tests/            suite de integración
```