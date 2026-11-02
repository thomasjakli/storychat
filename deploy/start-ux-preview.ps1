param([int]$Port=8796,[string]$NodeExecutable='node',[string]$BindAddress='127.0.0.1')
$ErrorActionPreference='Stop'
$repositoryRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
Push-Location -LiteralPath $repositoryRoot
try {
  $env:STORYCHAT_UX_PORT=[string]$Port
  $env:STORYCHAT_UX_BIND_ADDRESS=$BindAddress
  & $NodeExecutable scripts/preview-ux.mjs
  if($LASTEXITCODE -ne 0){throw 'UX preview stopped with an error.'}
} finally { Pop-Location }
