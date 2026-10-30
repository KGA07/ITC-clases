'use strict';
/*
 * Controlador del Gestor Docente (/gestor, /api/gestor*).
 *
 *  - GET  /api/gestor        → estado por curso del catálogo (Drive, archivos) + info del sistema.
 *  - GET  /api/gestor/accion → estado de la acción en curso (polling del frontend).
 *  - POST /api/gestor/accion → lanza una acción local: catalogo | drive.
 *
 * Las acciones ejecutan los builders de catálogo en ESTA máquina. En Vercel
 * están deshabilitadas (no hay carpeta local ni rclone): responden 403.
 */

const { execFile } = require('child_process');
const path = require('path');
const fs = require('fs');
const config = require('../config');
const catalogo = require('../data/catalog');
const { getCatalog } = catalogo;

const REPO_ROOT = path.join(__dirname, '..');
const ROWS_FILE = path.join(process.env.TEMP || REPO_ROOT, 'gestor-drive-lsjson.json');

function resolverRclone() {
  // 1) dado por variable de entorno (RCLONE_EXE); 2) en PATH; 3) carpeta de winget.
  if (process.env.RCLONE_EXE && fs.existsSync(process.env.RCLONE_EXE)) return process.env.RCLONE_EXE;
  const wingetDir = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Packages');
  if (fs.existsSync(wingetDir)) {
    for (const pkg of fs.readdirSync(wingetDir)) {
      if (!pkg.startsWith('Rclone.Rclone_')) continue;
      const base = path.join(wingetDir, pkg);
      for (const sub of fs.readdirSync(base)) {
        const exe = path.join(base, sub, 'rclone.exe');
        if (fs.existsSync(exe)) return exe;
      }
    }
  }
  return 'rclone'; // último recurso: PATH del proceso
}

// Una sola acción en vuelo a la vez (el gestor es monousuario docente).
const job = { accion: null, estado: 'idle', started: null, ended: null, log: [], exit: null };

function log(s) {
  job.log.push(String(s));
  if (job.log.length > 200) job.log.splice(0, job.log.length - 200);
}

function pipe(child) {
  const grab = (buf) => String(buf || '').split(/\r?\n/).forEach((l) => l.trim() && log(l));
  child.stdout && child.stdout.on('data', grab);
  child.stderr && child.stderr.on('data', grab);
  child.on('close', (code) => {
    job.exit = code;
    job.ended = Date.now();
    job.estado = code === 0 ? 'ok' : 'error';
    log(`→ fin (${code === 0 ? 'OK' : 'código ' + code}) en ${Math.round((job.ended - job.started) / 1000)}s`);
    if (code === 0) {
      try {
        catalogo.reload();
        log('✓ catálogo recargado en memoria (sin reiniciar el servidor)');
      } catch (e) {
        log('⚠ el catálogo no se pudo recargar: ' + e.message);
      }
    }
  });
}

function lanzarCatalogo() {
  log('Regenerando catálogo (npm run catalog)...');
  job.estado = 'running';
  const child = execFile('npm', ['run', 'catalog'], { cwd: REPO_ROOT, shell: true, timeout: 10 * 60 * 1000 },
    (err) => { if (job.estado === 'running' && err) { job.exit = 1; job.estado = 'error'; log('ERROR: ' + err.message); } }
  );
  pipe(child);
}

function lanzarDrive() {
  const exe = resolverRclone();
  log(`1/2 · Listando Drive: rclone lsjson "itc:ITC" -R ... (${path.dirname(exe)})`);
  const p1 = execFile(`"${exe}" lsjson itc:ITC -R`,
    { cwd: REPO_ROOT, shell: true, timeout: 10 * 60 * 1000, maxBuffer: 64 * 1024 * 1024 },
    (err, stdout) => {
      if (err) {
        job.exit = 1; job.estado = 'error'; job.ended = Date.now();
        if (err.code === 'ENOENT') log('✕ rclone no está disponible en el PATH de este proceso. Instalalo con `winget install Rclone.Rclone` o ejecutá el servidor desde una terminal normal.');
        else log('✕ rclone falló: ' + (err.message || err).split('\n')[0]);
        return;
      }
      try {
        fs.writeFileSync(ROWS_FILE, stdout, 'utf8');
        log(`  ↳ ${JSON.parse(stdout).length} rutas · guardadas en cache temporal`);
      } catch (e) {
        job.exit = 1; job.estado = 'error'; job.ended = Date.now();
        log('✕ salida de rclone inválida: ' + e.message);
        return;
      }
      log('2/2 · Enlazando catálogo: link-catalog --map drive-map.json ...');
      const p2 = execFile('node', ['tools/link-catalog.js', '--root', 'itc:ITC', '--map', 'tools/drive-map.json', '--rows-file', ROWS_FILE, '--out', 'data/materiales.json'],
        { cwd: REPO_ROOT, timeout: 5 * 60 * 1000 },
        (err2) => { if (job.estado === 'running' && err2) { job.exit = 1; job.estado = 'error'; job.ended = Date.now(); log('✕ link-catalog: ' + err2.message.split('\n')[0]); } }
      );
      pipe(p2);
    });
  p1.stderr && p1.stderr.on('data', (d) => {
    String(d).split(/\r?\n/).forEach((l) => { if (l.trim() && !l.includes('NOTICE')) log('  ' + l.trim()); });
  });
}

function estado(req, res) {
  let cursos = [];
  try {
    const c = getCatalog();
    const driveMap = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'tools', 'drive-map.json'), 'utf8'));
    cursos = c.capacitaciones
      .filter((x) => driveMap[x.id])
      .map((x) => {
        let archivos = 0, conDrive = 0, embebidos = 0, faltantes = [];
        for (const m of x.modulos || []) {
          for (const cl of m.clases || []) {
            for (const f of cl.archivos || []) {
              archivos++;
              if (f.url) conDrive++;
              else faltantes.push({ clase: cl.titulo, archivo: f.nombre, tipo: f.tipo });
              if (f.embebible) embebidos++;
            }
          }
        }
        return {
          id: x.id,
          nombre: x.nombre,
          emoji: x.emoji,
          color: x.color,
          modulos: (x.modulos || []).length,
          clases: (x.modulos || []).reduce((a, m) => a + (m.clases || []).length, 0),
          archivos,
          conDrive,
          embebidos,
          faltantes: faltantes.slice(0, 15),
          faltantesTotal: faltantes.length
        };
      });
  } catch (e) {
    return res.status(503).json({ error: 'Catálogo no disponible', detalle: e.message });
  }

  res.json({
    generado: (getCatalog() || {}).generado || null,
    local: !config.isVercel,
    alta: {
      version: require('../package.json').version || '',
      rcloneRows: fs.existsSync(ROWS_FILE) ? 'cache previo' : 'sin cache'
    },
    cursos
  });
}

function estadoAccion(req, res) {
  res.json({
    accion: job.accion,
    estado: job.estado,
    exit: job.exit,
    started: job.started,
    ended: job.ended,
    log: job.log.slice(-40)
  });
}

function accion(req, res) {
  if (config.isVercel) {
    return res.status(403).json({ error: 'Las acciones de regeneración corren solo en la máquina local (node server.js).' });
  }
  const { accion: cual } = req.body || {};
  if (job.estado === 'running') {
    return res.status(409).json({ error: `Ya hay una acción corriendo (${job.accion}). Esperá que termine.` });
  }
  if (cual !== 'catalogo' && cual !== 'drive') {
    return res.status(400).json({ error: 'Acciones válidas: catalogo | drive' });
  }
  job.accion = cual;
  job.estado = 'running';
  job.started = Date.now();
  job.ended = null;
  job.exit = null;
  job.log = [`▶ ${cual} @ ${new Date().toLocaleTimeString('es-AR')}`];
  if (cual === 'catalogo') lanzarCatalogo();
  else lanzarDrive();
  res.json({ ok: true, accion: cual, estado: job.estado });
}

module.exports = { estado, estadoAccion, accion };
