param(
  [Parameter(Mandatory=$true)][string]$Keyword,
  [int]$Limit = 8
)
$ErrorActionPreference = 'Stop'
$api = 'https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=' + [uri]::EscapeDataString($Keyword) + '&gsrnamespace=6&gsrlimit=' + $Limit + '&prop=imageinfo&iiprop=url|size|extmetadata&iiurlwidth=1200&format=json&origin=*'
$json = Invoke-RestMethod -Uri $api -TimeoutSec 30 -Headers @{ 'User-Agent' = 'UDEM-Materiales/1.0' }
$pages = @($json.query.pages.PSObject.Properties | ForEach-Object { $_.Value } | Where-Object { $_.imageinfo })
$i = 0
foreach ($p in ($pages | Sort-Object { $_.imageinfo[0].width } -Descending)) {
  $i++
  $ii = $p.imageinfo[0]
  $desc = $ii.extmetadata.ImageDescription.value
  $license = $ii.extmetadata.LicenseShortName.value
  $coords = $ii.extmetadata.Coordinates.value
  $desc = ($desc -replace '<[^>]+>', ' ' -replace '\s+', ' ').Trim()
  Write-Output ("[{0}] {1} | {2} x {3} | {4} bytes" -f $i, $p.title, $ii.width, $ii.height, $ii.size)
  Write-Output ("    desc: " + ([string]$desc).Substring(0, [Math]::Min(220, ([string]$desc).Length)))
  Write-Output ("    lic: $license")
  if ($coords) { Write-Output "    coords: $coords" }
}