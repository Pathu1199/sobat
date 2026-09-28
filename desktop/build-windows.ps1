# Builds the Sobat Windows installer.
#
# Run this on the PC, from the repository root, in PowerShell:
#
#     .\desktop\build-windows.ps1
#
# It produces an installer you can double-click, at
#     desktop\src-tauri\target\release\bundle\nsis\Sobat_<version>_x64-setup.exe
#
# The installer needs no administrator rights: it installs for the current
# user only. Nothing is uploaded and nothing phones home.

$ErrorActionPreference = 'Stop'

function Need($name, $hint) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    Write-Host ""
    Write-Host "Missing: $name" -ForegroundColor Red
    Write-Host $hint
    Write-Host ""
    exit 1
  }
}

Write-Host "Checking what is installed..." -ForegroundColor Cyan

Need 'node' 'Install Node 22 or newer from https://nodejs.org and open a new terminal.'
Need 'npm'  'npm ships with Node. Install Node from https://nodejs.org.'
Need 'cargo' @'
Install Rust from https://rustup.rs, then open a NEW terminal so PATH updates.
Rust also needs the Visual Studio C++ build tools: run the Visual Studio
Installer and tick "Desktop development with C++". Without them the linker
(link.exe) is missing and the build stops part-way through.
'@

Write-Host "  node   $(node --version)"
Write-Host "  npm    $(npm --version)"
Write-Host "  cargo  $(cargo --version)"

# The repository root is the parent of this script's folder.
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
Write-Host "Building in $root" -ForegroundColor Cyan

if (-not (Test-Path 'node_modules')) {
  Write-Host ""
  Write-Host "Installing dependencies (a few minutes the first time)..." -ForegroundColor Cyan
  npm install
}

# The Tauri shell loads this folder; it must be rebuilt whenever the app changes.
Write-Host ""
Write-Host "Building the app..." -ForegroundColor Cyan
npm run export:web

if (-not (Test-Path 'dist/index.html')) {
  Write-Host "The web build did not produce dist/index.html. Stopping." -ForegroundColor Red
  exit 1
}

# The Tauri command line is a dev dependency rather than a global install, so
# the same version is used on every machine.
Write-Host ""
Write-Host "Packaging the installer (the first run compiles Rust and takes a while)..." -ForegroundColor Cyan
npx --yes @tauri-apps/cli@^2 build --config desktop/tauri.conf.json

$bundle = Join-Path $root 'desktop\src-tauri\target\release\bundle\nsis'
$installer = Get-ChildItem -Path $bundle -Filter '*-setup.exe' -ErrorAction SilentlyContinue |
             Sort-Object LastWriteTime -Descending | Select-Object -First 1

Write-Host ""
if ($installer) {
  Write-Host "Done." -ForegroundColor Green
  Write-Host "Installer: $($installer.FullName)"
  Write-Host "Double-click it to install Sobat. It will start with Windows and sit in the tray."
} else {
  Write-Host "The build finished but no installer was found under $bundle." -ForegroundColor Yellow
  Write-Host "Look further up this output for the first error."
}
