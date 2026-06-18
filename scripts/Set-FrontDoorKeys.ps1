#Requires -Version 5.1
<#
.SYNOPSIS
    Configures API keys for the Front Door secure AI gateway.

.DESCRIPTION
    Prompts the sysadmin for API keys for any combination of OpenAI, Google Gemini,
    and Anthropic (Claude). Writes the keys to the project .env file and optionally
    persists them as Windows machine-level environment variables so they survive
    reboots and are available to all users on the workstation.

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
Write-Host "  You only need at least ONE provider key to use Front Door." -ForegroundColor DarkYellow
Write-Host "  Press Enter to skip any provider you don't want to configure." -ForegroundColor DarkGray

# ── Collect keys ─────────────────────────────────────────────────────────────

Write-Header "OpenAI (ChatGPT)"
$openaiKey = Read-ApiKey `
    -Provider "OpenAI" `
    -EnvVar "OPENAI_API_KEY" `
    -Hint "sk-..."

Write-Header "Google (Gemini)"
$geminiKey = Read-ApiKey `
    -Provider "Google Gemini" `
    -EnvVar "GEMINI_API_KEY" `
    -Hint "AIza..."

Write-Header "Anthropic (Claude)"
$anthropicKey = Read-ApiKey `
    -Provider "Anthropic" `
    -EnvVar "ANTHROPIC_API_KEY" `
    -Hint "sk-ant-..."

# ── Validate at least one key provided ───────────────────────────────────────

$provided = @($openaiKey, $geminiKey, $anthropicKey) | Where-Object { $_ -ne "" }
if ($provided.Count -eq 0) {
    Write-Host ""
    Write-Host "  [!] No keys entered. Nothing was saved." -ForegroundColor Red
    exit 1
}

# ── Build update table ────────────────────────────────────────────────────────

$updates = @{}
if ($openaiKey)    { $updates["OPENAI_API_KEY"]    = $openaiKey }
if ($geminiKey)    { $updates["GEMINI_API_KEY"]     = $geminiKey }
if ($anthropicKey) { $updates["ANTHROPIC_API_KEY"]  = $anthropicKey }

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

$labels = @{
    "OPENAI_API_KEY"    = "OpenAI (ChatGPT)"
    "GEMINI_API_KEY"    = "Google Gemini"
    "ANTHROPIC_API_KEY" = "Anthropic (Claude)"
}

foreach ($key in $labels.Keys) {
    $status = if ($updates.ContainsKey($key)) { "Configured ✓" } else { "Skipped" }
    $color  = if ($updates.ContainsKey($key)) { "Green" } else { "DarkGray" }
    Write-Host ("  {0,-22} {1}" -f $labels[$key], $status) -ForegroundColor $color
}

Write-Host ""
Write-Host "  Next step: restart the Front Door server to pick up the new keys." -ForegroundColor DarkYellow
Write-Host "  From the project root, run:  npm run dev" -ForegroundColor White
Write-Host ""
