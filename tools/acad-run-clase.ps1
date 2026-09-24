# FASE 6 - runner genérico: dibuja una figura definida en JSON + capture + DWG + PDF + guía TXT.
param(
  [Parameter(Mandatory = $true)][string]$Fig,
  [switch]$NoKill
)
. .\tools\acad-com.ps1
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms

if (-not (Test-Path -LiteralPath $Fig)) { throw "No existe figura: $Fig" }
$F = Get-Content -LiteralPath $Fig -Raw -Encoding UTF8 | ConvertFrom-Json
$dir = $F.carpeta
if (-not (Test-Path -LiteralPath $dir)) { throw "No existe carpeta: $dir" }
$img = Join-Path $dir 'img'
$dwg = Join-Path $dir $F.archivo.dwg
$pdf = Join-Path $dir $F.archivo.pdf
$txt = Join-Path $dir $F.archivo.txt

function Log($m) { Write-Output ("[c{0}] {1}" -f $F.numero, $m) }

Log "conectando..."
if (-not $NoKill) { Get-Process -Name acad -ErrorAction SilentlyContinue | Stop-Process -Force; Start-Sleep -Seconds 3 }
$app = Acad-Connect
$doc = Acad-NewDoc $app
Acad-WaitDoc $doc | Out-Null
Acad-WaitIdle $doc | Out-Null
Log "documento nuevo: $($doc.Name)"

Log "variables..."
Acad-SetVar $doc 'LUNITS' 2
Acad-SetVar $doc 'LUPREC' 0
Acad-SetVar $doc 'DIMDEC' 0
Acad-SetVar $doc 'DIMTXT' 3.5
Acad-SetVar $doc 'DIMASZ' 2.5
Acad-SetVar $doc 'DIMEXO' 0.625
Acad-SetVar $doc 'DIMEXE' 1.25
Acad-SetVar $doc 'DIMCEN' 2.5
Acad-SetVar $doc 'ORTHOMODE' 1
Acad-SetVar $doc 'OSMODE' 47

Log "capas..."
foreach ($ly in $F.capas) {
  $obj = Acad-Layer $doc $ly.n $ly.c
  if ($ly.lt) { Acad-LinetypeLoad $doc $ly.lt }
}
$lyDib = Acad-Layer $doc 'Dibujo' '7'
$doc.ActiveLayer = $doc.Layers.Item('Dibujo')
$lyConsig = Acad-Layer $doc 'Consigna' '7'

Log "dibujando ($(($F.dibujo | Get-Member -MemberType NoteProperty).Count) grupos)..."
$entCount = 0

if ($F.dibujo.pline) {
  foreach ($p in $F.dibujo.pline) {
    $e = Try-Com { Acad-Pline $doc $p.pts }
    $e.Layer = if ($p.capa) { $p.capa } else { 'Dibujo' }
    $entCount++
  }
}

if ($F.dibujo.polilineas) {
  foreach ($p in $F.dibujo.polilineas) {
    $cer = $true
    if ($null -ne $p.cerrado) { $cer = [bool]$p.cerrado }
    $e = Try-Com { Acad-Pline $doc $p.pts $cer }
    $e.Layer = if ($p.capa) { $p.capa } else { 'Dibujo' }
    if ($p.lt) { try { $e.Linetype = $p.lt } catch { } }
    $entCount++
  }
}

if ($F.dibujo.lineas) {
  foreach ($l in $F.dibujo.lineas) {
    $e = Try-Com { Acad-Line $doc (,@($l.x1,$l.y1)) (,@($l.x2,$l.y2)) }
    $e.Layer = if ($l.capa) { $l.capa } else { 'Dibujo' }
    if ($l.lt) { try { $e.Linetype = $l.lt } catch { } }
    $entCount++
  }
}

if ($F.dibujo.circulos) {
  foreach ($c in $F.dibujo.circulos) {
    $e = Try-Com { Acad-Circle $doc (,@($c.x,$c.y)) $c.r }
    $e.Layer = if ($c.capa) { $c.capa } else { 'Dibujo' }
    if ($c.lt) { try { $e.Linetype = $c.lt } catch { } }
    $entCount++
  }
}

if ($F.dibujo.arcos) {
  foreach ($a in $F.dibujo.arcos) {
    $e = Try-Com { Acad-Arc $doc (,@($a.x,$a.y)) $a.r $a.a1 $a.a2 }
    $e.Layer = if ($a.capa) { $a.capa } else { 'Dibujo' }
    $entCount++
  }
}

if ($F.dibujo.rectangulos) {
  foreach ($r in $F.dibujo.rectangulos) {
    $e = Try-Com { Acad-Rect $doc $r.x1 $r.y1 $r.x2 $r.y2 }
    $e.Layer = if ($r.capa) { $r.capa } else { 'Dibujo' }
    $entCount++
  }
}

Log "solidos 3D ($(($F.dibujo | Get-Member -MemberType NoteProperty).Count) grupos)..."
$solidList = New-Object System.Collections.ArrayList
if ($F.dibujo.solidos) {
  foreach ($s in $F.dibujo.solidos) {
    $e = $null
    switch ($s.tipo) {
      'caja' { $e = Try-Com { Acad-Box3D $doc (,@($s.cx, $s.cy, $s.cz)) $s.l $s.w $s.h } }
      'cilindro' { $e = Try-Com { Acad-Cylinder3D $doc (,@($s.cx, $s.cy, $s.cz)) $s.r $s.h } }
      'cono' { $e = Try-Com { Acad-Cone3D $doc (,@($s.cx, $s.cy, $s.cz)) $s.r $s.h } }
      'esfera' { $e = Try-Com { Acad-Sphere3D $doc (,@($s.cx, $s.cy, $s.cz)) $s.r } }
      'toro' { $e = Try-Com { Acad-Torus3D $doc (,@($s.cx, $s.cy, $s.cz)) $s.rToro $s.rTubo } }
      'cuña' { $e = Try-Com { Acad-Wedge3D $doc (,@($s.cx, $s.cy, $s.cz)) $s.l $s.w $s.h } }
    }
    if ($e) {
      try { $e.Layer = if ($s.capa) { $s.capa } else { 'Dibujo' } } catch { }
      [void]$solidList.Add($e)
      $entCount++
    }
  }
}

if ($F.dibujo.booleanos) {
  foreach ($b in $F.dibujo.booleanos) {
    $op = switch ($b.op) { 'union' { 0 } 'intersec' { 1 } 'resta' { 2 } default { 0 } }
    $aObj = $solidList[$b.a]
    $bObj = $solidList[$b.b]
    try { $aObj.Boolean($op, $bObj) | Out-Null; $entCount++ } catch {
      Write-Warning "boolean falló ($($b.op)): $($_.Exception.Message)"
    }
  }
}

Log "cotas..."
Acad-Layer $doc 'Cotas' '2'
$doc.ActiveLayer = $doc.Layers.Item('Cotas')
foreach ($d in $F.dibujo.cotas) {
  try {
    $dim = Try-Com { Acad-DimLinear $doc (,@($d.x1,$d.y1)) (,@($d.x2,$d.y2)) (,@($d.lx,$d.ly)) }
    $dim.Layer = 'Cotas'
  } catch {
    Try-Com { Acad-DimAligned $doc (,@($d.x1,$d.y1)) (,@($d.x2,$d.y2)) (,@($d.lx,$d.ly)) } | Out-Null
  }
}

if ($F.dibujo.radios) {
  foreach ($r in $F.dibujo.radios) {
    $c = Try-Com { Acad-Circle $doc (,@($r.x,$r.y)) $r.r }
    $c.Layer = if ($r.capa) { $r.capa } else { 'Dibujo' }
    try { $dim = Try-Com { Acad-DimRadius $doc $c (,@($r.lx,$r.ly)) }; $dim.Layer = 'Cotas' } catch { }
  }
}

Log "consigna MText..."
if ($F.consigna) {
  $consig = @()
  foreach ($linea in $F.consigna.lineas) { $consig += $linea }
  $mtext = Try-Com { Acad-MText $doc (,@($F.consigna.x,$F.consigna.y)) $F.consigna.ancho ($consig -join '\P') }
  $mtext.Height = if ($F.consigna.alto) { $F.consigna.alto } else { 4.0 }
  $mtext.Layer = 'Consigna'
}

Acad-Regen $doc

Log "vista..."
# Vista 3D opcional (isométrica) o 2D estándar.
if ($F.vista) {
  $dv = if ($F.vista.direccion) { $F.vista.direccion } else { @(-1, -1, 1) }
  $estilo = if ($F.vista.estilo) { $F.vista.estilo } else { 'Conceptual' }
  Acad-Vista3D $doc $dv $estilo
  Acad-ZoomExt $app $doc
  Acad-Regen $doc
} else {
  Acad-ZoomExt $app $doc
  Acad-Regen $doc
}
Start-Sleep -Seconds 1

Log "captura interfaz..."
Acad-Capture $app (Join-Path $img 'interfaz.jpg') -MaxWidth 1560

if ($F.dibujo.encuadre) {
  Log "zoom encuadre..."
  $en = $F.dibujo.encuadre
  Acad-ZoomWin $app $doc (,@($en.x1,$en.y1)) (,@($en.x2,$en.y2))
  Acad-Regen $doc
  Start-Sleep -Seconds 1
  Log "captura encuadre..."
  Acad-Capture $app (Join-Path $img 'encuadre.jpg') -MaxWidth 1560
}

Log "capturas listas"
Log "guardando DWG..."
if (Test-Path -LiteralPath $dwg) { Remove-Item -LiteralPath $dwg -Force }
$doc.SaveAs($dwg)
Log "dwg ok: $([math]::Round((Get-Item -LiteralPath $dwg).Length/1KB,1)) KB"

Log "PDF práctico..."
$cfg = @{
  outPdf   = $pdf
  title    = $F.pdfTitulo
  subtitle = $F.pdfSubtitulo
  consigna = $F.consigna.lineas
  figures  = @()
}
foreach ($fi in $F.pdfFiguras) {
  $cfg.figures += @{
    img     = (Join-Path $dir $fi.img)
    caption = $fi.caption
  }
}
$cfgJ = Join-Path $env:TEMP ("practico-c$($F.numero)-" + [guid]::NewGuid().ToString('N') + '.json')
[System.IO.File]::WriteAllText($cfgJ, ($cfg | ConvertTo-Json -Depth 6), (New-Object System.Text.UTF8Encoding $false))
& node (Join-Path $PSScriptRoot 'acad-practico-pdf.js') $cfgJ
Remove-Item -LiteralPath $cfgJ -Force -ErrorAction SilentlyContinue

Log "guía TXT..."
$lines = @()
$lines += '='*72
$lines += "ITC - AULA VIRTUAL | Diseño Técnico | Clase $($F.numero)"
$lines += $F.titulo.ToUpper()
$lines += $F.guia.subtitulo
$lines += ('='*72).Substring(0, [Math]::Min(72, $F.guia.subtitulo.Length + 40))
$lines += ''
$lines += 'OBJETIVO'
$lines += $F.guia.objetivo
$lines += ''
$lines += '-'*72
$lines += 'GUÍA PASO A PASO'
$lines += '-'*72
$lines += ''
$i = 0
foreach ($p in $F.guia.pasos) {
  $i++
  $lines += "PASO $i - $($p.titulo.ToUpper())"
  foreach ($det in $p.detalle) { $lines += " $det" }
  $lines += ''
}
$lines += '-'*72
$lines += 'COTAS DE LA PIEZA (resumen para el plano)'
$lines += '-'*72
foreach ($c in $F.guia.cotas) { $lines += (' {0,-42} {1}' -f $c.label, $c.valor) }
$lines += ''
$lines += '-'*72
$lines += 'CONSEJOS'
$lines += '-'*72
foreach ($c in $F.guia.consejos) { $lines += " - $c" }
$lines += '='*72
$lines += ''
$lines += "FIN DEL PRÁCTICO $($F.numero)"
$lines += '='*72
[System.IO.File]::WriteAllLines($txt, $lines, (New-Object System.Text.UTF8Encoding $false))
Write-Output ("[c{0}] txt ok: {1} líneas" -f $F.numero, $lines.Count)

Log 'OK'
Get-Process -Name acad -ErrorAction SilentlyContinue | Where-Object MainWindowHandle -ne 0 | Stop-Process -Force
Write-Output 'DONE'