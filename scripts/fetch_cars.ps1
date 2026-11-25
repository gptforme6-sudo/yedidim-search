# Fetches the full Israeli Ministry of Transport vehicle-models reference dataset
# and produces data/cars.json. The Hebrew-to-English brand map lives in app.js,
# so this script stays free of Hebrew string literals (safer for Windows PS 5.1).
#
# Run:  pwsh -File scripts/fetch_cars.ps1
#   or: powershell -File scripts/fetch_cars.ps1

$ErrorActionPreference = "Stop"
$ResourceId = "142afde2-6228-49f9-8a29-9b6c3a0cbe40"
$BaseUrl    = "https://data.gov.il/api/3/action/datastore_search"
$PageSize   = 1000

[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

Write-Host "Fetching metadata..."
$meta  = Invoke-RestMethod "$BaseUrl`?resource_id=$ResourceId&limit=1"
$total = [int]$meta.result.total
Write-Host "Total records: $total"

$all = New-Object System.Collections.ArrayList
$offset = 0
while ($offset -lt $total) {
  if (($offset % 5000) -eq 0) { Write-Host "  page $offset / $total" }
  $url = "$BaseUrl`?resource_id=$ResourceId&limit=$PageSize&offset=$offset"
  $retry = 0
  while ($true) {
    try { $resp = Invoke-RestMethod $url -TimeoutSec 60; break }
    catch {
      $retry++
      if ($retry -ge 5) { throw }
      Start-Sleep -Seconds (2 * $retry)
    }
  }
  foreach ($r in $resp.result.records) { [void]$all.Add($r) }
  $offset += $PageSize
}

Write-Host "Downloaded $($all.Count) rows. Aggregating..."

$agg = @{}
foreach ($r in $all) {
  $year = 0; if ($r.shnat_yitzur) { $year = [int]$r.shnat_yitzur }
  if ($year -le 0) { continue }

  $tozar      = if ($r.tozar) { ("" + $r.tozar).Trim() } else { "" }
  $tozeret_nm = if ($r.tozeret_nm) { ("" + $r.tozeret_nm).Trim() } else { "" }
  $kinuy      = if ($r.kinuy_mishari) { ("" + $r.kinuy_mishari).Trim() } else { "" }
  $degem_nm   = if ($r.degem_nm) { ("" + $r.degem_nm).Trim() } else { "" }
  $trim       = if ($r.ramat_gimur) { ("" + $r.ramat_gimur).Trim() } else { "" }
  $cc         = 0; if ($r.nefah_manoa) { $cc = [int]$r.nefah_manoa }
  $fuel       = if ($r.delek_nm) { ("" + $r.delek_nm).Trim() } else { "" }
  $hp         = 0; if ($r.koah_sus) { $hp = [int]$r.koah_sus }
  $body       = if ($r.merkav) { ("" + $r.merkav).Trim() } else { "" }
  $sugDegem   = if ($r.sug_degem) { ("" + $r.sug_degem).Trim() } else { "" }

  $brand = $tozar
  if (-not $brand) { $brand = $tozeret_nm }
  if (-not $brand) { continue }

  $modelName = $kinuy
  if (-not $modelName) { $modelName = $degem_nm }
  if (-not $modelName) { continue }

  $key = "$brand||$modelName||$year"
  if (-not $agg.ContainsKey($key)) {
    $agg[$key] = [ordered]@{
      brand    = $brand
      brand_full = $tozeret_nm
      model    = $modelName
      year     = $year
      variants = New-Object System.Collections.ArrayList
    }
  }

  $variantKey = "$cc|$fuel|$body|$sugDegem"
  $exists = $false
  foreach ($v in $agg[$key].variants) {
    if ($v._k -eq $variantKey) { $exists = $true; break }
  }
  if (-not $exists) {
    [void]$agg[$key].variants.Add([ordered]@{
      _k    = $variantKey
      cc    = $cc
      fuel  = $fuel
      hp    = $hp
      body  = $body
      sug   = $sugDegem
      trim  = $trim
    })
  }
}

Write-Host "Aggregated to $($agg.Count) (brand, model, year) rows. Writing..."

# strip _k before writing
foreach ($row in $agg.Values) {
  foreach ($v in $row.variants) { $v.Remove("_k") }
}

$out = [ordered]@{
  generated_at = (Get-Date).ToString("o")
  rows         = @($agg.Values | Sort-Object brand, model, year)
}
$outPath = Join-Path (Split-Path $PSScriptRoot -Parent) "data\cars.json"
$json    = $out | ConvertTo-Json -Depth 8 -Compress
[System.IO.File]::WriteAllText($outPath, $json, (New-Object System.Text.UTF8Encoding $false))
Write-Host "Wrote $outPath"
