[CmdletBinding()]
param(
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-zA-Z0-9][a-zA-Z0-9_.@-]{0,127}$')][string]$HostAlias,
  [Parameter(Mandatory=$true)][ValidatePattern('^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$')][string]$Container,
  [ValidateRange(1024,65535)][int]$Port=1455,
  [ValidatePattern('^(new|[a-f0-9]{16})?$')][string]$Account=''
)
$ErrorActionPreference='Stop'
if (-not (Get-Command ssh -ErrorAction SilentlyContinue)) { throw 'Install the Windows OpenSSH client first.' }
# Only validated arguments enter the remote command. No credentials are copied.
$remote = 'set -eu; umask 077; d=$(mktemp -d); trap ''rm -f "$d/connect.sh"; rmdir "$d"'' EXIT; docker cp ' + $Container + ':/app/deploy/connect-chatgpt.sh "$d/connect.sh" >/dev/null; bash "$d/connect.sh" ' + $Container + ' ' + $Port
if ($Account) { $remote += ' ' + $Account }
Write-Host 'Keep this terminal open. Open the printed OpenAI link on this PC, then select a model.'
& ssh -tt -o ExitOnForwardFailure=yes -o ForwardAgent=no -L "127.0.0.1:${Port}:127.0.0.1:${Port}" $HostAlias $remote
if ($LASTEXITCODE -ne 0) { throw 'Connection setup did not complete. Read the safe error above and verify the app restarted in Portainer.' }
