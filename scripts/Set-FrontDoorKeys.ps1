#Requires -Version 5.1
<#
.SYNOPSIS
    Configures API keys for the Front Door secure AI gateway.

.DESCRIPTION
    Prompts the sysadmin for the Google Gemini API key that Front Door uses, writes
    it to the project .env file, and optionally persists it as a Windows machine-level
    environment variable so it survives reboots and is available to all users on the
    workstation.

.PARAMETER EnvFile
    Path to the .env file. Defaults to .env in the same directory as this script's
    parent folder (the project root).

.PARAMETER Persist
    If specified, also writes keys to the Windows machine environment (requires
    administrator privileges).

.EXAMPLE
    .\Set-FrontDoorKeys.ps1

.EXAMPLE
    .\Set-FrontDoorKeys.ps1 -Persist
#>

[CmdletBinding()]
param (
    [string]$EnvFile = (Join-Path (Split-Path $PSScriptRoot -Parent) ".env"),
    [switch]$Persist
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

# ── Helpers ─────────────────────────────────────────────────────────────────

function Write-Header {
    param([string]$Text)
    Write-Host ""
    Write-Host "  $Text" -ForegroundColor Cyan
    Write-Host ("  " + ("─" * $Text.Length)) -ForegroundColor DarkCyan
}

function Read-ApiKey {
    param([string]$Provider, [string]$EnvVar, [string]$Hint)
    Write-Host ""
    Write-Host "  $Provider" -ForegroundColor White
    Write-Host "  Env var : $EnvVar" -ForegroundColor DarkGray
    Write-Host "  Format  : $Hint" -ForegroundColor DarkGray
    $key = Read-Host "  Enter key (leave blank to skip)"
    return $key.Trim()
}

function Update-EnvFile {
    param(
        [string]$Path,
        [hashtable]$Values
    )

    # Read existing content or start fresh from the example
    $example = Join-Path (Split-Path $Path -Parent) ".env.example"
    if (-not (Test-Path $Path)) {
        if (Test-Path $example) {
            Copy-Item $example $Path
            Write-Host "  Created $Path from .env.example" -ForegroundColor DarkGray
        } else {
            "" | Set-Content $Path -Encoding utf8
        }
    }

    $lines = Get-Content $Path -Encoding utf8

    foreach ($key in $Values.Keys) {
        $val = $Values[$key]
        $pattern = "^$key\s*=.*$"
        $replacement = "$key=$val"

        if ($lines -match $pattern) {
            $lines = $lines -replace $pattern, $replacement
        } else {
            $lines += $replacement
        }
    }

    $lines | Set-Content $Path -Encoding utf8
}

# ── Elevation check for -Persist ────────────────────────────────────────────

if ($Persist) {
    $isAdmin = ([Security.Principal.WindowsPrincipal] `
        [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
        [Security.Principal.WindowsBuiltInRole]::Administrator)

    if (-not $isAdmin) {
        Write-Host ""
        Write-Host "  [!] -Persist requires administrator privileges." -ForegroundColor Yellow
        Write-Host "      Re-run this script as Administrator, or omit -Persist to" -ForegroundColor Yellow
        Write-Host "      write to the .env file only." -ForegroundColor Yellow
        exit 1
    }
}

# ── Banner ───────────────────────────────────────────────────────────────────

Clear-Host
Write-Host ""
Write-Host "  ╔══════════════════════════════════════════════╗" -ForegroundColor DarkCyan
Write-Host "  ║       Front Door — API Key Configuration     ║" -ForegroundColor Cyan
Write-Host "  ╚══════════════════════════════════════════════╝" -ForegroundColor DarkCyan
Write-Host ""
Write-Host "  This script writes API keys to:" -ForegroundColor Gray
Write-Host "    • $EnvFile" -ForegroundColor Gray
if ($Persist) {
    Write-Host "    • Windows machine environment variables (persisted)" -ForegroundColor Gray
}
Write-Host ""
Write-Host "  Front Door uses Google Gemini. Enter your Gemini API key below." -ForegroundColor DarkYellow

# ── Collect key ──────────────────────────────────────────────────────────────

Write-Header "Google (Gemini)"
$geminiKey = Read-ApiKey `
    -Provider "Google Gemini" `
    -EnvVar "GEMINI_API_KEY" `
    -Hint "AIza..."

# ── Validate a key was provided ──────────────────────────────────────────────

if ($geminiKey -eq "") {
    Write-Host ""
    Write-Host "  [!] No key entered. Nothing was saved." -ForegroundColor Red
    exit 1
}

# ── Build update table ────────────────────────────────────────────────────────

$updates = @{}
$updates["GEMINI_API_KEY"] = $geminiKey

# ── Write .env ────────────────────────────────────────────────────────────────

Write-Header "Saving"

try {
    Update-EnvFile -Path $EnvFile -Values $updates
    Write-Host "  [OK] .env updated: $EnvFile" -ForegroundColor Green
} catch {
    Write-Host "  [!] Failed to write .env: $_" -ForegroundColor Red
    exit 1
}

# ── Persist to Windows environment (optional) ─────────────────────────────────

if ($Persist) {
    foreach ($key in $updates.Keys) {
        [System.Environment]::SetEnvironmentVariable($key, $updates[$key], "Machine")
        Write-Host "  [OK] Machine env var set: $key" -ForegroundColor Green
    }
}

# ── Summary ───────────────────────────────────────────────────────────────────

Write-Host ""
Write-Host "  ╔══════════════════════════════════════════════╗" -ForegroundColor DarkCyan
Write-Host "  ║               Configuration saved            ║" -ForegroundColor Cyan
Write-Host "  ╚══════════════════════════════════════════════╝" -ForegroundColor DarkCyan
Write-Host ""

Write-Host ("  {0,-22} {1}" -f "Google Gemini", "Configured ✓") -ForegroundColor Green

Write-Host ""
Write-Host "  Next step: restart the Front Door server to pick up the new key." -ForegroundColor DarkYellow
Write-Host "  From the project root, run:  npm run dev" -ForegroundColor White
Write-Host ""
