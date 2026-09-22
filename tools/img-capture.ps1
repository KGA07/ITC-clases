param(
  [Parameter(Mandatory=$true)][string]$Title,
  [Parameter(Mandatory=$true)][string]$OutPath,
  [int]$DelaySec = 3,
  [string]$Exe = ""
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class WinCap {
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hWnd);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT lpRect);
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr hWnd, IntPtr after, int X, int Y, int cx, int cy, uint flags);
  [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);
  [DllImport("user32.dll")] public static extern bool MoveWindow(IntPtr hWnd, int X, int Y, int cx, int cy, bool repaint);
  [DllImport("user32.dll")] public static extern int GetSystemMetrics(int nIndex);
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
}
"@

if ($Exe) {
  Start-Process -FilePath $Exe | Out-Null
  Start-Sleep -Seconds $DelaySec
}

$proc = Get-Process | Where-Object { $_.MainWindowTitle -and $_.MainWindowTitle -like "*$Title*" } | Select-Object -First 1
if (-not $proc) { Write-Error "No se encontro ventana con titulo: $Title" }

[WinCap]::ShowWindow($proc.MainWindowHandle, 9) | Out-Null
Start-Sleep -Milliseconds 400
[WinCap]::SetForegroundWindow($proc.MainWindowHandle) | Out-Null
Start-Sleep -Milliseconds 800

$rect = New-Object WinCap+RECT
[WinCap]::GetWindowRect($proc.MainWindowHandle, [ref]$rect) | Out-Null
$w = $rect.Right - $rect.Left
$h = $rect.Bottom - $rect.Top
$maxW = [WinCap]::GetSystemMetrics(0); $maxH = [WinCap]::GetSystemMetrics(1)
if ($w -gt $maxW -or $h -gt $maxH) {
  $w = [Math]::Min($w, $maxW); $h = [Math]::Min($h, $maxH)
  [WinCap]::MoveWindow($proc.MainWindowHandle, 0, 0, $w, $h, $true) | Out-Null
  Start-Sleep -Milliseconds 300
  [WinCap]::GetWindowRect($proc.MainWindowHandle, [ref]$rect) | Out-Null
}
$w = $rect.Right - $rect.Left
$h = $rect.Bottom - $rect.Top
if ($w -lt 100 -or $h -lt 50) { Write-Error ("Ventana muy pequena/oculta: {0}x{1}" -f $w, $h) }

$bmp = New-Object System.Drawing.Bitmap($w, $h)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.CopyFromScreen($rect.Left, $rect.Top, 0, 0, $bmp.Size)
$dir = Split-Path -Parent $OutPath
if ($dir -and -not (Test-Path -LiteralPath $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
$bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
Write-Output ("OK {0} | {1}x{2} | {3} bytes | win='{4}'" -f $OutPath, $w, $h, (Get-Item $OutPath).Length, $proc.MainWindowTitle)
$g.Dispose(); $bmp.Dispose()