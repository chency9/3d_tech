param(
  [string]$Blender = 'C:\Program Files\Blender Foundation\Blender 5.2\blender.exe',
  [string]$BlendFile = (Join-Path $PSScriptRoot 'biomech-specimens.blend')
)
$ErrorActionPreference = 'Stop'
if (-not (Test-Path -LiteralPath $Blender)) { throw "Blender executable missing: $Blender" }
if (-not (Test-Path -LiteralPath $BlendFile)) { throw "Blender source missing: $BlendFile" }
& $Blender --background $BlendFile --python (Join-Path $PSScriptRoot 'export_models.py')
if ($LASTEXITCODE -ne 0) { throw 'Model export failed. See Blender output above.' }
Write-Host 'Models exported. Refresh the site; run npm run build to update dist.'
