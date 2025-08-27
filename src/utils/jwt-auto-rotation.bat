@echo off
REM Windows Task Scheduler Batch File for JWT Auto-Rotation
REM This file can be used to set up automatic JWT rotation on Windows

SET SCRIPT_DIR=%~dp0
SET NODE_SCRIPT=%SCRIPT_DIR%auto-jwt-manager.js

echo Starting JWT Auto-Rotation Check...
echo Current Time: %date% %time%

cd /d "%SCRIPT_DIR%..\..\"
node "%NODE_SCRIPT%" rotate

echo JWT Auto-Rotation Check Completed
echo =====================================
