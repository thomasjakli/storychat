param([int]$Port=8796,[string]$NodeExecutable='node')
$ErrorActionPreference='Stop'
$repositoryRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Push-Location -LiteralPath $repositoryRoot
try {
  $env:STORYCHAT_UX_PORT=[string]$Port
  & $NodeExecutable scripts/preview-ux.mjs
  if($LASTEXITCODE -ne 0){throw 'UX preview stopped with an error.'}
} finally { Pop-Location }
