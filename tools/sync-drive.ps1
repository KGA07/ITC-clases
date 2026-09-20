<#
.SYNOPSIS
  Sincroniza los materiales de I:\ITC a Google Drive y enlaza el catalogo.

.DESCRIPTION
  1) Verifica rclone y el remote configurado.
  2) Sube cada capacitacion a  DRIVE:<Dest>  (por defecto la carpeta "itc:itc/Aula",
     siendo "itc" el nombre del remote apuntando a tu cuenta con la carpeta "itc").
  3) Regenera el catalogo local (npm run catalog).
  4) Ejecuta rclone lsjson y vincula cada archivo del catalogo con su enlace de Drive.

  IMPORTANTE (una sola vez):
    - Instalar rclone (https://rclone.org) y configurar el remote:
        rclone config  ->  nuevo remote tipo "drive", nombre "itc",
        oauth "tu cuenta de itc", y en opciones avanzadas puedes fijar
        root_folder_id = <id de la carpeta "itc">.
    - Compartir la carpeta <Dest> en Drive como "Cualquier persona con el enlace
      puede ver" para que los alumnos/el navegador puedan descargar los archivos.

.PARAMETER Remote    Nombre del remote de rclone (default: itc).
.PARAMETER Dest      Carpeta destino bajo el remote (default: itc/Aula).
.PARAMETER Root      Carpeta local de materiales (default: I:\ITC).
.PARAMETER Sync      Si $false, solo regenera y vincula (sin subir).
.EXAMPLE
  .\sync-drive.ps1
#>
param(
  [string]$Remote = "itc",
  [string]$Dest = "itc",
  [string]$Root = "I:\ITC",
  [switch]$SkipSync = $false
)

$ErrorActionPreference = "Stop"
$proyecto = Split-Path -Parent $PSScriptRoot

if (-not (Get-Command rclone -ErrorAction SilentlyContinue)) {
  Write-Host "`n  FATAL: rclone no esta instalado. Bajalo de https://rclone.org y agrega rclone.exe al PATH." -ForegroundColor Red
  exit 1
}

Write-Host "`n  ITC Clases - Sincronizacion con Google Drive`n" -ForegroundColor Cyan

# 1) Verificar remote
rclone listremotes | Out-Null
$remotes = (rclone listremotes) -replace ":", ""
if ($remotes -notcontains $Remote) {
  Write-Host "  El remote '$Remote' no existe. Creamos el remote de Google Drive..." -ForegroundColor Yellow
  rclone config create $Remote drive config_is_local false
  Write-Host "  Una vez autorizado, fija en opciones avanzadas el root_folder_id de tu carpeta 'itc' si queres." -ForegroundColor Yellow
}

$destino = "$Remote`:$Dest"

# 2) Subir cada capacitacion
# Memoria: la maquina tiene ~3 GB de RAM y `--fast-list` + `-v` + 4 transfers
# provocaban "out of memory allocating heap arena map". Sin fast-list y con poca
# concurrencia rclone es mucho mas liviano.
$errores = @()
$memopts = @("--transfers", "2", "--checkers", "4", "--retries", "3", "--retries-sleep", "5s")

function Invoke-Rclone {
  param([string]$Op, [string]$Origen, [string]$DestinoRc, [string]$Etiqueta)
  try {
    & rclone $Op $Origen $DestinoRc @excluir @memopts
    if ($LASTEXITCODE -ne 0) { throw "exit $LASTEXITCODE" }
  } catch {
    Write-Host "  [error] '$Etiqueta' fallo: $($_.Exception.Message). Sigo con el resto." -ForegroundColor Red
    $script:errores += $Etiqueta
  }
}

if (-not $SkipSync) {
  $cursos = @(
    "1- Asistente Administrativo Digital con IA",
    "2- Administracion de Pymes",
    "3- Diseño Grafico",
    "4- Diseño Tecnico",
    "5- Marketing Digital",
    "6- Diagnostico y Mantenimiento",
    "7- Robotica Arduino",
    "8- Automatización con IA",
    "Ciberseguridad Avanzado"
  )

  $excluir = @(
    "--exclude", "desktop.ini",
    "--exclude", "Thumbs.db",
    "--exclude", ".DS_Store",
    "--exclude", "Otros/**",
    "--exclude", "Nueva carpeta/**",
    "--exclude", "*_files/**",   # paginas web guardadas: sus recursos van con su html de todos modos
    "--min-size", "1"
  )

  foreach ($c in $cursos) {
    $origen = Join-Path $Root $c
    if (-not (Test-Path -LiteralPath $origen)) { Write-Host "  [skip] sin carpeta local: $c" -ForegroundColor DarkGray; continue }
    Write-Host "  [sync] $c" -ForegroundColor Green
    Invoke-Rclone -Op sync -Origen $origen -DestinoRc "$destino/$c" -Etiqueta $c
  }

  Write-Host "  [sync] Herramientas y temarios" -ForegroundColor Green
  $herramientas = @(
    "Generador de Gemini.html",
    "Generador de Prompts para gemini.html",
    "Generador de clasesNotebooklm.html",
    "ServidoresConfigAvanzado.html",
    "Todos Los Atajos.pdf"
  )
  foreach ($h in $herramientas) {
    $origen = Join-Path $Root $h
    if (-not (Test-Path -LiteralPath $origen)) { continue }
    Invoke-Rclone -Op copy -Origen $origen -DestinoRc "$destino/HERRAMIENTAS" -Etiqueta "HERRAMIENTAS/$h"
  }
}

# 3) Regenerar catalogo local
Write-Host "`n  [catalog] regenerando catálogo..." -ForegroundColor Cyan
Push-Location $proyecto
try {
  npm run --silent catalog
} finally {
  Pop-Location
}

# 4) Vincular enlaces de Drive
Write-Host "`n  [link] vinculando archivos del catalogo con Drive..." -ForegroundColor Cyan
$catalogo = Join-Path $proyecto "data\materiales.json"
try {
  rclone lsjson --recursive "$destino" | node (Join-Path $proyecto "tools\link-catalog.js") --root "$destino" --out $catalogo
  if ($LASTEXITCODE -ne 0) { throw "exit $LASTEXITCODE al vincular" }
} catch {
  Write-Host "  [error] no se pudieron vincular los enlaces de Drive: $($_.Exception.Message)" -ForegroundColor Red
  $script:errores += "vinculacion-de-enlaces"
}

if ($errores.Count -gt 0) {
  Write-Host "`n  Se reportaron errores en:" -ForegroundColor Yellow
  $errores | Sort-Object -Unique | ForEach-Object { Write-Host "    - $_" -ForegroundColor Yellow }
}

Write-Host "`n  Listo. No olvides compartir '$destino' en Drive como 'cualquiera con el enlace'."
Write-Host "  Para que el sitio vea los cambios, regenera con: npm run catalog`n" -ForegroundColor Green