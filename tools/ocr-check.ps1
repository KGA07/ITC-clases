param(
  [Parameter(Mandatory=$true)][string[]]$Path
)
# OCR de Windows: imprime el texto detectado en cada imagen (para validar capturas de UI reales).
Add-Type -AssemblyName System.Runtime.WindowsRuntime -ErrorAction Stop
# Cargar tipos WinRT de Windows.Media.Ocr
$null = [Windows.Media.Ocr.OcrEngine,Windows.Foundation,ContentType=WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder,Windows.Foundation,ContentType=WindowsRuntime]
$null = [Windows.Storage.StorageFile,Windows.Foundation,ContentType=WindowsRuntime]
$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object { $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1' })[0]
function Await($AsyncTask, $ResultType) {
  $asTask = $asTaskGeneric.MakeGenericMethod($ResultType)
  $netTask = $asTask.Invoke($null, @($AsyncTask))
  $netTask.Wait(-1) | Out-Null
  $netTask.Result
}
foreach ($p in $Path) {
  if (-not (Test-Path -LiteralPath $p)) { Write-Output "[MISSING] $p"; continue }
  try {
    $file = Await ([Windows.Storage.StorageFile]::GetFileFromPathAsync((Resolve-Path -LiteralPath $p).Path)) ([Windows.Storage.StorageFile])
    $stream = Await ($file.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
    $decoder = Await ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
    $bitmap = Await ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
    $engine = [Windows.Media.Ocr.OcrEngine]::TryCreateFromUserProfileLanguages()
    if (-not $engine) { Write-Output "[NO-OCR-ENGINE] $p"; continue }
    $result = Await ($engine.RecognizeAsync($bitmap)) ([Windows.Media.Ocr.OcrResult])
    $txt = ($result.Lines.Text -join ' ')
    Write-Output "=== $([System.IO.Path]::GetFileName($p)) ==="
    Write-Output ([string]$txt)
  } catch {
    Write-Output "[ERROR] $p :: $($_.Exception.Message)"
  }
}