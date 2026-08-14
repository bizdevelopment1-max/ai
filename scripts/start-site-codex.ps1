$ErrorActionPreference = "Continue"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$BundledNode = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe"
$NodeCommand = Get-Command node -ErrorAction SilentlyContinue | Select-Object -First 1
$Node = if ($NodeCommand) { $NodeCommand.Source } elseif (Test-Path -LiteralPath $BundledNode) { $BundledNode } else { $null }

if (-not $Node) {
  Write-Error "Node.js 20 이상 설치 필요"
  exit 1
}

$CodexEntry = Join-Path $ProjectRoot "node_modules\@openai\codex\bin\codex.js"
if (-not (Test-Path -LiteralPath $CodexEntry)) {
  & (Join-Path $PSScriptRoot "install-site-codex.ps1")
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Set-Location -LiteralPath $ProjectRoot
Write-Host "브라우저 주소  http://127.0.0.1:4510"
Write-Host "콘솔 종료     Ctrl+C"
& $Node (Join-Path $PSScriptRoot "site-codex-bridge.mjs")
