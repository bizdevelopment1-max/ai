param([switch]$SkipLogin)

$ErrorActionPreference = "Continue"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$BundledRoot = Join-Path $env:USERPROFILE ".cache\codex-runtimes\codex-primary-runtime\dependencies"

function Find-Executable([string[]]$Candidates) {
  foreach ($Candidate in $Candidates) {
    if ([string]::IsNullOrWhiteSpace($Candidate)) { continue }
    if (Test-Path -LiteralPath $Candidate) { return (Resolve-Path -LiteralPath $Candidate).Path }
    $Command = Get-Command $Candidate -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($Command) { return $Command.Source }
  }
  return $null
}

$Node = Find-Executable @(
  "node",
  "C:\Program Files\nodejs\node.exe",
  (Join-Path $BundledRoot "node\bin\node.exe")
)
if (-not $Node) {
  Write-Error "Node.js 20 이상 설치 필요"
  Write-Host "https://nodejs.org/ko/download"
  exit 1
}

$NodeDir = Split-Path -Parent $Node
$env:Path = "$NodeDir;$env:Path"
$Pnpm = Find-Executable @(
  "pnpm.cmd",
  "pnpm",
  (Join-Path $BundledRoot "bin\fallback\pnpm.cmd")
)
$Npm = Find-Executable @("npm.cmd", "npm", (Join-Path $NodeDir "npm.cmd"))
if (-not $Pnpm -and -not $Npm) {
  Write-Error "pnpm 또는 npm 실행 파일 확인 필요"
  exit 1
}

Set-Location -LiteralPath $ProjectRoot
Write-Host "[1/3] Codex CLI 패키지 설치"
if ($Pnpm) {
  & $Pnpm install --frozen-lockfile
} else {
  & $Npm install --include=dev
}
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$CodexEntry = Join-Path $ProjectRoot "node_modules\@openai\codex\bin\codex.js"
Write-Host "[2/3] Codex CLI 버전 확인"
& $Node $CodexEntry --version
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "[3/3] ChatGPT 로그인 확인"
& $Node $CodexEntry login status
$LoginExit = $LASTEXITCODE
if ($LoginExit -ne 0 -and -not $SkipLogin) {
  Write-Host "브라우저 인증 시작"
  & $Node $CodexEntry login
  if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
}

Write-Host ""
Write-Host "설치 완료"
Write-Host "실행  .\Start-Site-Codex.cmd"
Write-Host "주소  http://127.0.0.1:4510"
