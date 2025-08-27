# PowerShell script for JWT Auto-Rotation
# Can be scheduled using Windows Task Scheduler

param(
    [string]$LogPath = "$PSScriptRoot\jwt-rotation.log"
)

# Set up logging
function Write-Log {
    param([string]$Message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logMessage = "[$timestamp] $Message"
    Write-Host $logMessage
    Add-Content -Path $LogPath -Value $logMessage
}

Write-Log "Starting JWT Auto-Rotation Check"

try {
    # Change to project directory
    Set-Location "$PSScriptRoot\..\.."
    
    # Run the auto-rotation check
    $result = & node "src/utils/auto-jwt-manager.js" rotate 2>&1
    
    if ($LASTEXITCODE -eq 0) {
        Write-Log "JWT Auto-Rotation completed successfully"
        Write-Log "Output: $result"
    } else {
        Write-Log "JWT Auto-Rotation failed with exit code: $LASTEXITCODE"
        Write-Log "Error: $result"
    }
} catch {
    Write-Log "JWT Auto-Rotation failed with exception: $($_.Exception.Message)"
}

Write-Log "JWT Auto-Rotation Check finished"
Write-Log "========================================"
