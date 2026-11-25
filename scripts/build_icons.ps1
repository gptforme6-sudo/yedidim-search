# Builds icons/icon-192.png and icons/icon-512.png from icons/logo-source.png
# (the official Yedidim logo) using System.Drawing.
# Run: powershell -File scripts/build_icons.ps1

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$root = Split-Path $PSScriptRoot -Parent
$src  = Join-Path $root "icons\logo-source.png"
if (-not (Test-Path $src)) { Write-Error "Missing $src"; exit 1 }

$source = [System.Drawing.Image]::FromFile($src)

foreach ($size in 192, 512) {
  $out = Join-Path $root "icons\icon-$size.png"
  Write-Host "Rendering $size x $size -> $out"
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $gfx = [System.Drawing.Graphics]::FromImage($bmp)
  $gfx.InterpolationMode   = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $gfx.SmoothingMode       = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $gfx.PixelOffsetMode     = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $gfx.CompositingQuality  = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $gfx.Clear([System.Drawing.Color]::White)
  # Letterbox the logo inside the square, with a little padding for the
  # home-screen "safe area" that iOS uses for maskable icons.
  $pad = [int]($size * 0.08)
  $inner = $size - 2 * $pad
  $scale = [Math]::Min($inner / $source.Width, $inner / $source.Height)
  $w = [int]($source.Width  * $scale)
  $h = [int]($source.Height * $scale)
  $x = [int](($size - $w) / 2)
  $y = [int](($size - $h) / 2)
  $gfx.DrawImage($source, $x, $y, $w, $h)
  $gfx.Dispose()
  $bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}
$source.Dispose()
Write-Host "Done."
