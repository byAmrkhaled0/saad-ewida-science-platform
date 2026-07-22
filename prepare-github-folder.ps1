param(
  [string]$RepositoryUrl = "https://github.com/byAmrkhaled0/saad-ewida-science-platform.git",
  [string]$TargetFolder = "saad-ewida-production-v63.3.2"
)

$ErrorActionPreference = "Stop"

function Invoke-Checked {
  param(
    [Parameter(Mandatory = $true)][string]$Executable,
    [string[]]$CommandArguments = @()
  )

  & $Executable @CommandArguments
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed with exit code ${LASTEXITCODE}: $Executable $($CommandArguments -join ' ')"
  }
}

$SourceRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$Parent = Split-Path -Parent $SourceRoot
$TargetRoot = Join-Path $Parent $TargetFolder

if (Test-Path $TargetRoot) {
  throw "Target folder already exists: $TargetRoot"
}

Write-Host "Cloning the existing GitHub repository..." -ForegroundColor Cyan
Invoke-Checked -Executable "git" -CommandArguments @("clone", $RepositoryUrl, $TargetRoot)

Write-Host "Replacing repository files with V63.3.2 while preserving .git..." -ForegroundColor Cyan
Get-ChildItem -LiteralPath $TargetRoot -Force |
  Where-Object { $_.Name -ne ".git" } |
  Remove-Item -Recurse -Force

Get-ChildItem -LiteralPath $SourceRoot -Force |
  Where-Object { $_.Name -notin @(".git", "node_modules", "dist") } |
  Copy-Item -Destination $TargetRoot -Recurse -Force

Write-Host "Prepared Git folder:" -ForegroundColor Green
Write-Host $TargetRoot -ForegroundColor Green
Write-Host "Open that folder and run: npm run deploy:production" -ForegroundColor Yellow
