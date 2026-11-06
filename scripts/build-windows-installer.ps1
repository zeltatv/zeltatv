# ZeltaTV Windows installer (Inno Setup)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
Push-Location $root
try {
    npm.cmd run build:win-dir
    $candidates = @(
        "$env:LOCALAPPDATA\Programs\Inno Setup 6\ISCC.exe",
        "${env:ProgramFiles(x86)}\Inno Setup 6\ISCC.exe",
        "$env:ProgramFiles\Inno Setup 6\ISCC.exe"
    )
    $iscc = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
    if (-not $iscc) {
        throw 'Inno Setup 6 not found. Install it from https://jrsoftware.org/isdl.php.'
    }
    $version = (Get-Content package.json | ConvertFrom-Json).version
    & $iscc "/DMyAppVersion=$version" 'installer\zeltatv.iss'
    Write-Host "[ok] release\ZeltaTV-$version-Setup.exe"
} finally {
    Pop-Location
}
