$ErrorActionPreference = "Stop"

function Invoke-Checked {
  param(
    [Parameter(Mandatory = $true)][scriptblock]$Action,
    [Parameter(Mandatory = $true)][string]$Label
  )

  & $Action
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed with exit code ${LASTEXITCODE}: $Label"
  }
}

$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ProjectRoot

Write-Host "1/7 Verifying project..." -ForegroundColor Cyan
Invoke-Checked -Label "npm test" -Action { npm test }

Write-Host "2/7 Building static site..." -ForegroundColor Cyan
Invoke-Checked -Label "npm run build" -Action { npm run build }

Write-Host "3/7 Installing Firebase Functions dependencies..." -ForegroundColor Cyan
Invoke-Checked -Label "npm config set registry" -Action { npm config set registry https://registry.npmjs.org/ }
Invoke-Checked -Label "npm --prefix functions ci" -Action { npm --prefix functions ci --no-audit --no-fund }
Invoke-Checked -Label "npm --prefix functions ls" -Action { npm --prefix functions ls firebase-functions firebase-admin }

Write-Host "4/7 Deploying Firebase Functions..." -ForegroundColor Cyan
Invoke-Checked -Label "firebase deploy functions" -Action { npx --yes firebase-tools@latest deploy --project saad-ewida-science-platform --only functions }

Write-Host "5/7 Deploying Firebase rules and indexes..." -ForegroundColor Cyan
Invoke-Checked -Label "firebase deploy rules and indexes" -Action { npx --yes firebase-tools@latest deploy --project saad-ewida-science-platform --only "firestore:rules,firestore:indexes,storage" }

Write-Host "6/7 Checking Git repository..." -ForegroundColor Cyan
if (-not (Test-Path (Join-Path $ProjectRoot ".git"))) {
  Write-Host "Firebase deployment completed, but this extracted folder is not connected to GitHub." -ForegroundColor Yellow
  Write-Host "Run .\prepare-github-folder.ps1, then run npm run deploy:production from the new folder." -ForegroundColor Yellow
  exit 0
}

Write-Host "7/7 Pushing production source to GitHub..." -ForegroundColor Cyan
Invoke-Checked -Label "git add" -Action { git add -A }
$changes = git status --porcelain
if ($changes) {
  Invoke-Checked -Label "git commit" -Action { git commit -m "Fix Firebase background worker and CSP V63.3.3" }
  Invoke-Checked -Label "git push" -Action { git push origin main }
} else {
  Write-Host "No Git changes to push." -ForegroundColor Yellow
}

Write-Host "Done. Wait for the Vercel Production deployment to become Ready." -ForegroundColor Green
