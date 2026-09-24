# Librería COM para AutoCAD 2021 (versión 24.0).
# Uso: . .\tools\acad-com.ps1  →  funciones Acad-*
# Requiere AutoCAD instalado y con acceso programático habilitado.

$script:AcadApp = $null

function Try-Com {
  # reintenta una llamada COM que el servidor haya rechazado por estar ocupado
  param([scriptblock]$Action, [int]$Attempts = 20, [int]$WaitMs = 1000)
  for ($i = 0; $i -lt $Attempts; $i++) {
    try { return & $Action }
    catch {
      if ($i -lt ($Attempts - 1)) { Start-Sleep -Milliseconds $WaitMs } else { throw }
    }
  }
}

function Acad-Connect([switch]$StartNew) {
  $script:AcadApp = $null
  if ($StartNew) {
    Get-Process -Name acad -ErrorAction SilentlyContinue | Stop-Process -Force
    Start-Sleep -Seconds 2
  }
  try { $script:AcadApp = [Runtime.InteropServices.Marshal]::GetActiveObject('AutoCAD.Application') } catch { }
  if (-not $script:AcadApp) {
    # New-Object lanza AutoCAD y espera a que la instancia OLE exista (sin carrera)
    try { $script:AcadApp = New-Object -ComObject 'AutoCAD.Application' }
    catch { throw "No se pudo crear AutoCAD.Application: $($_.Exception.Message)" }
    Start-Sleep -Seconds 12
  }
  Try-Com { $script:AcadApp.Visible = $true } -Attempts 40 | Out-Null
  return $script:AcadApp
}

function Acad-NewDoc($App, [string]$TemplatePath = '') {
  if ($TemplatePath -and (Test-Path -LiteralPath $TemplatePath)) {
    $doc = Try-Com { $App.Documents.Open($TemplatePath) }
  } else {
    $doc = Try-Com { $App.Documents.Add() }
  }
  [void](Acad-WaitDoc $doc)
  return $doc
}

function Acad-SaveAs($Doc, [string]$Path) {
  Add-Type -AssemblyName Microsoft.VisualBasic
  $ext = ([System.IO.Path]::GetExtension($Path) -replace '^\.','').ToLower()
  $ver = switch ($ext) { 'dwg' { 24 }; 'dxf' { 36 }; default { 24 } }
  if (-not $Doc.Saved) { }
  $Doc.SaveAs($Path)
  Start-Sleep -Milliseconds 400
}

function Acad-SetVar($Doc, $Name, $Value) {
  try { Try-Com { $Doc.SetVariable($Name, $Value) } | Out-Null }
  catch { throw "SetVariable $Name = $Value falló: $($_.Exception.Message)" }
}

function Acad-WaitDoc($Doc, [int]$Attempts = 40) {
  for ($i = 0; $i -lt $Attempts; $i++) {
    try { $n = $Doc.Name; if ($n) { return $n } } catch { }
    try { $c = $Doc.ModelSpace.Count; return $n } catch { }
    Start-Sleep -Milliseconds 750
  }
  throw 'Acad-WaitDoc: el documento no quedó lista'
}

function Acad-WaitIdle($Doc, [int]$Attempts = 90) {
  for ($i = 0; $i -lt $Attempts; $i++) {
    try { $Doc.SetVariable('CMDECHO', 0); return $true } catch { }
    Start-Sleep -Milliseconds 800
  }
  return $false
}

function Acad-Cmd($Doc, [string]$Text) {
  Try-Com { $Doc.SendCommand($Text) } | Out-Null
}

function Acad-Regen($Doc, [int]$Type = 0) {
  # 0 = acActiveViewport (regenera la vista activa sin SendCommand)
  Try-Com { $Doc.Regen($Type) } | Out-Null
  Start-Sleep -Milliseconds 300
}

function Acad-Pt($v) {
  # Normaliza un punto: @(x,y) o @(@(x,y)) -> array [double] de 3 componentes (x,y,0).
  # Write-Output -NoEnumerate: preserva el tipo Double[] (si no, PowerShell lo
  # convierte a Object[] y AutoCAD rechaza AddLine/AddCircle con "valor fuera de rango").
  $inner = $v
  if ($v -is [System.Array] -and $v.Count -eq 1 -and $v[0] -is [System.Array]) { $inner = $v[0] }
  $d = [System.Array]::CreateInstance([double], 3)
  $d[0] = [double]$inner[0]
  $d[1] = if ($inner.Count -gt 1) { [double]$inner[1] } else { 0.0 }
  $d[2] = if ($inner.Count -gt 2) { [double]$inner[2] } else { 0.0 }
  Write-Output -NoEnumerate $d
}

function Acad-Pline($Doc, $pts, [bool]$Closed = $true) {
  $flat = New-Object System.Collections.ArrayList
  foreach ($p in $pts) {
    $pt = Acad-Pt $p
    [void]$flat.Add($pt[0]); [void]$flat.Add($pt[1]); [void]$flat.Add(0.0)
  }
  $arr = [System.Array]::CreateInstance([double], $flat.Count)
  for ($i = 0; $i -lt $flat.Count; $i++) { $arr.SetValue([double]$flat[$i], $i) }
  $ent = $Doc.ModelSpace.AddPolyline($arr)
  if ($Closed) { $ent.Closed = $true }
  return $ent
}

function Acad-Line($Doc, $p1, $p2) {
  return $Doc.ModelSpace.AddLine((Acad-Pt $p1), (Acad-Pt $p2))
}

function Acad-Circle($Doc, $c, $r) {
  return $Doc.ModelSpace.AddCircle((Acad-Pt $c), [double]$r)
}

function Acad-Arc($Doc, $c, $r, $a1, $a2) {
  return $Doc.ModelSpace.AddArc((Acad-Pt $c), [double]$r, [double]$a1, [double]$a2)
}

function Acad-Rect($Doc, $x1, $y1, $x2, $y2) {
  $pts = @(,@($x1,$y1), @($x2,$y1), @($x2,$y2), @($x1,$y2))
  return Acad-Pline $Doc $pts
}

function Acad-DimAligned($Doc, $p1, $p2, $loc) {
  return $Doc.ModelSpace.AddDimAligned((Acad-Pt $p1), (Acad-Pt $p2), (Acad-Pt $loc))
}

function Acad-DimLinear($Doc, $p1, $p2, $loc) {
  return $Doc.ModelSpace.AddDimLinear((Acad-Pt $p1), (Acad-Pt $p2), (Acad-Pt $loc))
}

function Acad-DimRadius($Doc, $arc, $loc) {
  return $Doc.ModelSpace.AddDimRadius($arc, (Acad-Pt $loc))
}

function Acad-DimDiametric($Doc, $chord1, $chord2, $loc) {
  return $Doc.ModelSpace.AddDimDiametric((Acad-Pt $chord1), (Acad-Pt $chord2), (Acad-Pt $loc))
}

function Acad-MText($Doc, $pt, $width, $text) {
  $ent = $Doc.ModelSpace.AddMText((Acad-Pt $pt), [double]$width, [string]$text)
  $ent.Height = 3.5
  return $ent
}

# ---- Primitivas 3D (sólidos) ------------------------------------------------
function Acad-Box3D($Doc, $o, $l, $w, $h) {
  return $Doc.ModelSpace.AddBox((Acad-Pt $o), [double]$l, [double]$w, [double]$h)
}

function Acad-Cylinder3D($Doc, $c, $r, $h) {
  return $Doc.ModelSpace.AddCylinder((Acad-Pt $c), [double]$r, [double]$h)
}

function Acad-Cone3D($Doc, $c, $r, $h) {
  return $Doc.ModelSpace.AddCone((Acad-Pt $c), [double]$r, [double]$h)
}

function Acad-Sphere3D($Doc, $c, $r) {
  return $Doc.ModelSpace.AddSphere((Acad-Pt $c), [double]$r)
}

function Acad-Torus3D($Doc, $c, $rToro, $rTubo) {
  return $Doc.ModelSpace.AddTorus((Acad-Pt $c), [double]$rToro, [double]$rTubo)
}

function Acad-Wedge3D($Doc, $o, $l, $w, $h) {
  return $Doc.ModelSpace.AddWedge((Acad-Pt $o), [double]$l, [double]$w, [double]$h)
}

# ---- Vista 3D isométrica -----------------------------------------------------
function Acad-Vista3D($Doc, $dirVec, [string]$Estilo = '') {
  # Cambia el punto de vista del viewport activo (esquina isométrica) sin SendCommand.
  try {
    $vp = $Doc.ActiveViewport
    try { $vp.Target = (Acad-Pt @(0.0, 0.0, 0.0)) } catch { }
    $vp.Direction = (Acad-Pt $dirVec)
    $Doc.ActiveViewport = $vp
    Start-Sleep -Milliseconds 500
  } catch {
    Write-Warning "Acad-Vista3D dirección falló: $($_.Exception.Message)"
  }
  if ($Estilo) {
    # VSCURRENT no acepta SetVariable en esta build; SendCommand sí (probado sin colgar).
    $map = @{ 'Conceptual' = @('Conceptual', 'Concepto'); 'Realistic' = @('Realistic', 'Realista'); 'Shaded' = @('Shaded', 'Sombreado') }
    $aliases = if ($map.ContainsKey($Estilo)) { $map[$Estilo] } else { @($Estilo) }
    foreach ($n in ($aliases | Select-Object -Unique)) {
      if (-not $n) { continue }
      try {
        Try-Com { $Doc.SendCommand("VSCURRENT $n `n") } | Out-Null
        Start-Sleep -Milliseconds 600
        return
      } catch { }
    }
  }
  Start-Sleep -Milliseconds 300
}

function Acad-Layer($Doc, $Name, [string]$Color = '7') {
  try { $ly = $Doc.Layers.Add($Name) } catch { $ly = $Doc.Layers.Item($Name) }
  try { $ly.Color = [System.Convert]::ToInt16($Color) } catch { }
  return $ly
}

function Acad-LinetypeLoad($Doc, $Name) {
  # Intenta cargar el linetype desde archivos LIN conocidos (no da error si falla)
  $appData = Join-Path $env:APPDATA 'Autodesk\AutoCAD 2021\R24.0\esp\Support'
  $files = @(
    (Join-Path $appData 'acadiso.lin'),
    (Join-Path $appData 'acad.lin'),
    (Join-Path $appData 'acadlt.lin'),
    'acadiso.lin',
    'acad.lin'
  )
  foreach ($f in $files) {
    if (-not (Test-Path -LiteralPath $f)) { continue }
    try { $Doc.Linetypes.Load($Name, $f) | Out-Null; return $true } catch { }
  }
  return $false
}

function Acad-WaitQuiescent($App, [int]$Attempts = 60) {
  try {
    for ($i = 0; $i -lt $Attempts; $i++) {
      try { if ($App.GetAcadState().IsQuiescent) { return $true } } catch { }
      Start-Sleep -Milliseconds 300
    }
  } catch { }
  return $false
}

function Acad-Cancel($Doc) {
  try { $Doc.SendCommand([string][char]27) } catch { }
  Start-Sleep -Milliseconds 200
}

function Acad-ZoomExt($App, $Doc) {
  # API directa: confiable en la build LMS Tech (SendCommand ZOOM colgaba)
  Try-Com { $App.ZoomExtents() } | Out-Null
  Start-Sleep -Milliseconds 400
}

function Acad-ZoomWin($App, $Doc, $pmin, $pmax) {
  # acZoomWindow sobre la vista actual
  Try-Com { $App.ZoomWindow((Acad-Pt $pmin), (Acad-Pt $pmax)) } | Out-Null
  Start-Sleep -Milliseconds 400
}

function Acad-PdfExtents($Doc, [string]$OutPdf, [string]$Paper = 'ISO full bleed A3 (420.00 x 297.00 MM)') {
  try {
    $plot = $Doc.Plot
    $plot.QuietErrorMode = $true
    $plot.SetNumberOfCopies(1)
    $plotConfig = 'DWG To PDF.pc3'
    $plot.InitializePlot($false, $plotConfig)
    $layout = $Doc.Layouts.Item('Model')
    $Doc.ActiveLayout = $layout
    $layout.PlotType = [System.Convert]::ToInt16(6) # acExtents
    $plot.UseStandardScale = $true
    $plot.StandardScale = [System.Convert]::ToInt16(27) # 1:1 scale = acScaleToFit? (usar 0: ScaledToFit? no)
    for ($i = 0; $i -lt $plot.PaperSizesCount; $i++) {
      $plot.paperSize = $i
      if ($plot.GetPaperSize() -contains $Paper) { break }
    }
    $plot.PlotType = [System.Convert]::ToInt16(6)
    $plot.PlotToFile($OutPdf)
  } catch {
    Write-Warning "Acad-PdfExtents falló con COM Plot: $($_.Exception.Message) → probando EXPORTPDF"
    Acad-PdfExport $Doc $OutPdf
  }
}

function Acad-PdfExport($Doc, [string]$OutPdf) {
  $doc.SendCommand(("EXPORTPDF `"{0}`"`n`n" -f $OutPdf))
  Start-Sleep -Seconds 3
}

function Acad-Capture($App, [string]$OutImg, [string]$TitleMask = 'AutoCAD', [string]$ProcName = 'acad', [int]$MaxWidth = 1600) {
  # Ejecuta img-capture.ps1 en un proceso hijo con tope de 60s: nunca puede colgar al runner.
  $cap = Join-Path $PSScriptRoot 'img-capture.ps1'
  $res = 'FAIL(sin intentos)'
  for ($i = 1; $i -le 3; $i++) {
    $tmp = Join-Path $env:TEMP ("cap-" + [guid]::NewGuid().ToString('N') + '.txt')
    $argLine = "-NoProfile -ExecutionPolicy Bypass -File `"$cap`" -OutPath `"$OutImg`" -MaxWidth $MaxWidth -Quality 85 -ProcName `"$ProcName`""
    $p = Start-Process -FilePath 'powershell.exe' -ArgumentList $argLine -PassThru -RedirectStandardOutput $tmp -WindowStyle Hidden
    if (-not $p.WaitForExit(60000)) {
      try { $p.Kill() } catch { }
      Start-Sleep -Milliseconds 800
      $res = "TIMEOUT captura (intento $i)"
    } else {
      try { $res = ((Get-Content -LiteralPath $tmp -Raw -ErrorAction Stop) -replace "`r?`n", ' ') } catch { $res = '' }
      $res = [string]$res
      if ($res -match '^OK ') { Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue; Write-Output $res; return }
    }
    Remove-Item -LiteralPath $tmp -Force -ErrorAction SilentlyContinue
    Start-Sleep -Seconds 3
  }
  Write-Output $res
}