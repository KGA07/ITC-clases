'use strict';
/*
 * Renderiza los mockups UI en tools/mockups/*.html a JPG (1366x720) con Chrome headless.
 * Uso: node tools/render-mockups.js
 * Cada mock usa un user-data-dir unico y luego se matan SOLO los procesos chrome
 * cuyo command line referencia esa carpeta (no toca el Chrome del usuario).
 */
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

const CHROME =
  process.env.CHROME_PATH ||
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const MOCK_DIR = path.join(__dirname, 'mockups');
const TMP = 'C:\\Users\\Gkempe\\AppData\\Local\\Temp\\opencode\\mockcap';

const TARGETS = {
  'sites.html': path.join(
    'I:\\ITC\\5- Marketing Digital\\@Clases',
    'Modulo 4 - Directorios Locales , Publicidad y Campa\u00f1as Pagas',
    'Clase 12 Google Sites - Direcci\u00f3n Local',
    'img', 'sites.jpg'
  ),
  'planificador.html': path.join(
    'I:\\ITC\\5- Marketing Digital\\@Clases',
    'Modulo 5 - Automatizaci\u00f3n y Email Marketing',
    'Clase 16 Google Ads',
    'img', 'planificador.jpg'
  ),
  'recursos.html': path.join(
    'I:\\ITC\\5- Marketing Digital\\@Clases',
    'Modulo 5 - Automatizaci\u00f3n y Email Marketing',
    'Clase 17 - Concordancia de Palabras Clave',
    'img', 'recursos.jpg'
  ),
  'audiencia.html': path.join(
    'I:\\ITC\\5- Marketing Digital\\@Clases',
    'Modulo 5 - Automatizaci\u00f3n y Email Marketing',
    'Clase 18 - Facebook Ads e Instagram Ads',
    'img', 'audiencia.jpg'
  ),
  'metricas.html': path.join(
    'I:\\ITC\\5- Marketing Digital\\@Clases',
    'Modulo 5 - Automatizaci\u00f3n y Email Marketing',
    'Clase 19 - Facebook Ads 2',
    'img', 'metricas.jpg'
  ),
  'fatiga.html': path.join(
    'I:\\ITC\\5- Marketing Digital\\@Clases',
    'Modulo 5 - Automatizaci\u00f3n y Email Marketing',
    'Clase 19 - Facebook Ads 2',
    'img', 'fatiga.jpg'
  ),
  'retargeting.html': path.join(
    'I:\\ITC\\5- Marketing Digital\\@Clases',
    'Modulo 5 - Automatizaci\u00f3n y Email Marketing',
    'Clase 19 - Facebook Ads 2',
    'img', 'retargeting.jpg'
  ),
  'ga4.html': path.join(
    'I:\\ITC\\5- Marketing Digital\\@Clases',
    'Modulo 7 - An\u00e1lisis de Resultados',
    'Clase 22 - GA4 y M\u00e9tricas',
    'img', 'ga4.jpg'
  ),
  'eventos.html': path.join(
    'I:\\ITC\\5- Marketing Digital\\@Clases',
    'Modulo 7 - An\u00e1lisis de Resultados',
    'Clase 22 - GA4 y M\u00e9tricas',
    'img', 'eventos.jpg'
  ),
  'windows7.html': path.join(
    'I:\\ITC\\6- Diagnostico y Mantenimiento\\@Clases',
    'Clase 12 - Windows 7',
    'img', 'windows7.jpg'
  ),
  'pendrive-booteable.html': path.join(
    'I:\\ITC\\6- Diagnostico y Mantenimiento\\@Clases',
    'Clase 12 - Windows 7',
    'img', 'pendrive-booteable.jpg'
  ),
  'ubuntu.html': path.join(
    'I:\\ITC\\6- Diagnostico y Mantenimiento\\@Clases',
    'Clase 17 - Linux',
    'img', 'ubuntu.jpg'
  ),
  'terminal.html': path.join(
    'I:\\ITC\\6- Diagnostico y Mantenimiento\\@Clases',
    'Clase 17 - Linux',
    'img', 'terminal.png'
  ),
  'grub.html': path.join(
    'I:\\ITC\\6- Diagnostico y Mantenimiento\\@Clases',
    'Clase 18 - Instalacion dual',
    'img', 'grub.jpg'
  ),
  'ubuntu-instalacion.html': path.join(
    'I:\\ITC\\6- Diagnostico y Mantenimiento\\@Clases',
    'Clase 18 - Instalacion dual',
    'img', 'ubuntu-instalacion.png'
  ),
  'linux-live.html': path.join(
    'I:\\ITC\\6- Diagnostico y Mantenimiento\\@Clases',
    'Clase 19 - Recuperacion',
    'img', 'linux-live.jpg'
  )
};

function killChromeOfProfile(profileDir) {
  try {
    const out = execSync(
      `powershell -NoProfile -Command "Get-CimInstance Win32_Process -Filter \\"Name='chrome.exe'\\" | Where-Object { $_.CommandLine -match '${profileDir.replace(/\//g, '\\\\')}' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"`,
      { stdio: 'ignore', timeout: 30000 }
    );
  } catch (e) { /* noop */ }
}

function renderOne(mock, profileDir, outJpg, url, usePng) {
  const args = [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--hide-scrollbars',
    '--user-data-dir=' + profileDir,
    '--screenshot=' + outJpg,
    '--window-size=1366,720',
    usePng ? '--screenshot-format=png' : '--screenshot-format=jpeg'
  ];
  if (!usePng) args.push('--screenshot-quality=88');
  args.push(url);
  return new Promise((resolve) => {
    const child = spawn(CHROME, args, { detached: true, stdio: 'ignore' });
    child.unref();
    const to = setTimeout(() => { try { child.kill('SIGKILL'); } catch (e) {} resolve(false); }, 45000);
    child.on('exit', () => { clearTimeout(to); resolve(true); });
  });
}

async function renderWithRetry(mock, pick, usePng) {
  const src = path.join(MOCK_DIR, mock);
  if (!fs.existsSync(src)) { console.log('SKIP (no mockup): ' + mock); return; }
  const outJpg = path.join(TMP, mock.replace('.html', '.try' + (usePng ? '.png' : '.jpg')));
  const url = 'file:///' + src.replace(/\\/g, '/');
  for (let attempt = 1; attempt <= 3; attempt++) {
    const profileDir = path.join(TMP, 'prof-' + path.basename(mock, '.html') + '-a' + attempt);
    try { if (fs.existsSync(outJpg)) fs.unlinkSync(outJpg); } catch (e) {}
    await renderOne(mock, profileDir, outJpg, url, usePng);
    // Esperar a que aparezca el archivo (Chrome puede tardar)
    let ok = false;
    for (let i = 0; i < 40; i++) {
      if (fs.existsSync(outJpg) && fs.statSync(outJpg).size > 0) { ok = true; break; }
      await new Promise((r) => setTimeout(r, 400));
    }
    killChromeOfProfile(profileDir);
    if (ok) { pick(outJpg, fs.statSync(outJpg).size); return; }
    console.log('  reintento ' + attempt + ' para ' + mock);
  }
  console.log('ERROR render: ' + mock);
}

(async () => {
  fs.mkdirSync(TMP, { recursive: true });
  for (const [mock, dest] of Object.entries(TARGETS)) {
    const usePng = String(dest).toLowerCase().endsWith('.png');
    await renderWithRetry(mock, (outJpg, written) => {
      fs.copyFileSync(outJpg, dest);
      console.log('OK  ' + mock.padEnd(18) + written.toLocaleString().padStart(9) + ' B  -> ' + dest.replace(/^.*?@Clases\\/, ''));
    }, usePng);
  }
  console.log('DONE');
})();