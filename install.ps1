# install.ps1 -- Cyberpunk Windows Installer
# Downloads and installs the cyberpunk CLI for Windows.
# Requirements: PowerShell 5.1+ or PowerShell 7+, Windows x64 or ARM64.

$ErrorActionPreference = "Stop"

# --- Configuration ---

$Repo = "kevin15011/cyberpunk-plugin"
$InstallDir = Join-Path $env:USERPROFILE ".local" "bin"
$InstallPath = Join-Path $InstallDir "cyberpunk.exe"

# --- Header ---

Write-Host ">> CYBERPUNK WINDOWS INSTALLER"
Write-Host ""

# --- Execution Policy Check ---

$policy = Get-ExecutionPolicy -Scope CurrentUser
if ($policy -eq "Restricted" -or $policy -eq "AllSigned") {
    Write-Host ">> ERROR: PowerShell execution policy is '$policy'."
    Write-Host "   This prevents running downloaded scripts and binaries."
    Write-Host ""
    Write-Host "   Remediation: Run the following command to allow local scripts:"
    Write-Host "   Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned"
    Write-Host ""
    Write-Host "   Alternative: Download the binary manually from:"
    Write-Host "   https://github.com/$Repo/releases/latest/download/cyberpunk-windows-x64.exe"
    exit 1
}

# --- Architecture Detection ---

$Arch = "x64"
if ($env:PROCESSOR_ARCHITECTURE -eq "ARM64") {
    $Arch = "arm64"
}

$BinaryName = "cyberpunk-windows-$Arch.exe"
$DownloadUrl = "https://github.com/$Repo/releases/latest/download/$BinaryName"

# --- Download ---

Write-Host ">> Downloading cyberpunk binary for windows/$Arch..."

if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
}

try {
    Invoke-WebRequest -Uri $DownloadUrl -OutFile $InstallPath -UseBasicParsing
} catch {
    Write-Host ">> ERROR: Failed to download binary for windows/$Arch."
    Write-Host "   $($_.Exception.Message)"
    Write-Host ""
    Write-Host "   Remediation: Download manually from:"
    Write-Host "   $DownloadUrl"
    Write-Host ""
    Write-Host "   Alternative: Build from source:"
    Write-Host "   git clone https://github.com/$Repo.git"
    Write-Host "   cd cyberpunk-plugin"
    Write-Host "   bun install; bun run build -- --target-platform windows"
    exit 1
}

# Verify download succeeded
if (-not (Test-Path $InstallPath)) {
    Write-Host ">> ERROR: Download completed but binary not found at $InstallPath."
    Write-Host "   The installation cannot continue."
    Write-Host "   Remediation: Check available releases at:"
    Write-Host "   https://github.com/$Repo/releases"
    exit 1
}

Write-Host "   Binary installed at $InstallPath"

# --- Config Initialization ---

try {
    & $InstallPath config init
    & $InstallPath config installMode binary
} catch {
    Write-Host ">> ERROR: Failed to initialize cyberpunk config."
    Write-Host "   Binary install mode could not be persisted."
    Write-Host "   Remediation: Run manually:"
    Write-Host "   $InstallPath config init"
    exit 1
}

# --- PATH Setup ---

$pathParts = $env:PATH -split ";" | Where-Object { $_ -ne "" }
$inPath = $false
foreach ($part in $pathParts) {
    if ($part -ieq $InstallDir) {
        $inPath = $true
        break
    }
}

if ($inPath) {
    Write-Host ">> PATH ready: $InstallDir is already available in this shell."
} else {
    $userPath = [Environment]::GetEnvironmentVariable("PATH", "User")
    if ($userPath -notlike "*$InstallDir*") {
        [Environment]::SetEnvironmentVariable("PATH", "$userPath;$InstallDir", "User")
        Write-Host ">> Added $InstallDir to user PATH."
    } else {
        Write-Host ">> PATH export already exists in user environment."
    }
    Write-Host "   Restart your terminal for PATH changes to take effect."
}

# --- Install Summary ---

Write-Host ""
Write-Host ">> INSTALL SUMMARY"
Write-Host "   Installed binary: $InstallPath"
Write-Host "   Verify install: cyberpunk help"

# --- Launch TUI ---

Write-Host ""
Write-Host ">> Launching cyberpunk TUI..."
& $InstallPath tui
