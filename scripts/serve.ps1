param([int]$Port = 8787, [string]$Root)
if (-not $Root) { $Root = $env:YEDIDIM_ROOT }
if (-not $Root) { $Root = (Get-Location).Path }
Add-Type -AssemblyName System.Net.HttpListener -ErrorAction SilentlyContinue
$ErrorActionPreference = 'Continue'
$l = New-Object System.Net.HttpListener
$l.Prefixes.Add("http://localhost:$Port/")
$l.Start()
Write-Host "Serving $Root on http://localhost:$Port/  (Ctrl-C to stop)"
$mime = @{
 ".html"="text/html; charset=utf-8"; ".css"="text/css; charset=utf-8";
 ".js"="application/javascript; charset=utf-8"; ".json"="application/json; charset=utf-8";
 ".svg"="image/svg+xml"; ".png"="image/png";
 ".webmanifest"="application/manifest+json; charset=utf-8"
}
while ($l.IsListening) {
  $ctx = $l.GetContext()
  $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
  if (-not $rel) { $rel = "index.html" }
  $path = Join-Path $Root $rel
  if (Test-Path $path -PathType Container) { $path = Join-Path $path "index.html" }
  if (Test-Path $path) {
    $ext = [IO.Path]::GetExtension($path).ToLower()
    $ctx.Response.ContentType = $mime[$ext]
    $bytes = [IO.File]::ReadAllBytes($path)
    $ctx.Response.ContentLength64 = $bytes.Length
    $ctx.Response.AddHeader("Cache-Control","no-cache")
    $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  } else {
    $ctx.Response.StatusCode = 404
    $msg = [Text.Encoding]::UTF8.GetBytes("404 " + $rel)
    $ctx.Response.OutputStream.Write($msg, 0, $msg.Length)
  }
  $ctx.Response.Close()
}
