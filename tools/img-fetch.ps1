param(
  [Parameter(Mandatory=$true)][string]$Keyword,
  [Parameter(Mandatory=$true)][string]$OutPath,
  [string]$MinWidth = "800"
)
$ErrorActionPreference = 'Stop'
$api = 'https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=' + [uri]::EscapeDataString($Keyword) + '&gsrnamespace=6&gsrlimit=8&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1200&format=json&origin=*'
$json = Invoke-RestMethod -Uri $api -TimeoutSec 30 -Headers @{ 'User-Agent' = 'UDEM-Materiales/1.0' }
$pages = @($json.query.pages.PSObject.Properties | ForEach-Object { $_.Value })
if (-not $pages.Count) { Write-Error "Sin resultados para: $Keyword" }
$cands = @($pages | Where-Object { $_.imageinfo -and $_.imageinfo[0].thumburl } | Sort-Object { $_.imageinfo[0].width } -Descending)
if (-not $cands.Count) { Write-Error "Sin imagen descargable para: $Keyword" }
$best = $cands[0].imageinfo[0]
$dir = Split-Path -Parent $OutPath
if ($dir -and -not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
$tmp = $OutPath + '.tmp'
Invoke-WebRequest -Uri $best.thumburl -OutFile $tmp -TimeoutSec 60 -Headers @{ 'User-Agent' = 'UDEM-Materiales/1.0' }
if ((Get-Item -LiteralPath $tmp).Length -lt 500) { Remove-Item -LiteralPath $tmp -Force; Write-Error "Archivo demasiado pequeno: $Keyword" }
Move-Item -LiteralPath $tmp -Destination $OutPath -Force
Write-Output ("OK {0} | {1} bytes | w={2}" -f $OutPath, (Get-Item -LiteralPath $OutPath).Length, $best.width)