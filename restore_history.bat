@echo off
title Antigravity IDE Cache Cleaner and History Restorer
echo =================================================================
echo        Antigravity IDE Cache Cleaner and History Restorer
echo =================================================================
echo.

echo [1/4] Closing Antigravity IDE...
taskkill /IM "Antigravity IDE.exe" /F >nul 2>&1
timeout /t 2 /nobreak >nul

echo [2/4] Clearing cache and GPU data...
if exist "%APPDATA%\Antigravity IDE\Cache" (
    rmdir /s /q "%APPDATA%\Antigravity IDE\Cache"
    echo   - Cleared Cache
)
if exist "%APPDATA%\Antigravity IDE\CachedData" (
    rmdir /s /q "%APPDATA%\Antigravity IDE\CachedData"
    echo   - Cleared CachedData
)
if exist "%APPDATA%\Antigravity IDE\Code Cache" (
    rmdir /s /q "%APPDATA%\Antigravity IDE\Code Cache"
    echo   - Cleared Code Cache
)
if exist "%APPDATA%\Antigravity IDE\GPUCache" (
    rmdir /s /q "%APPDATA%\Antigravity IDE\GPUCache"
    echo   - Cleared GPU Cache
)
if exist "%APPDATA%\Antigravity IDE\User\workspaceStorage" (
    rmdir /s /q "%APPDATA%\Antigravity IDE\User\workspaceStorage"
    echo   - Cleared Workspace Storage
)

echo [3/4] Syncing chat conversations...
set "OLD_CONVS=%USERPROFILE%\.gemini\antigravity\conversations"
set "NEW_CONVS=%USERPROFILE%\.gemini\antigravity-ide\conversations"

if exist "%OLD_CONVS%" (
    if not exist "%NEW_CONVS%" mkdir "%NEW_CONVS%"
    echo   - Syncing conversation history from old directory to new directory...
    robocopy "%OLD_CONVS%" "%NEW_CONVS%" *.pb /XO /NJH /NJS /NDL /NC /NS >nul 2>&1
    echo   - Sync complete.
) else (
    echo   - Old conversation directory not found, skipping sync.
)

echo [4/4] Restarting Antigravity IDE...
if exist "%LOCALAPPDATA%\Programs\Antigravity IDE\Antigravity IDE.exe" (
    start "" "%LOCALAPPDATA%\Programs\Antigravity IDE\Antigravity IDE.exe" --ignore-certificate-errors
    echo   - Restarted Antigravity IDE.
) else (
    echo   - Executable not found at default location. Please restart manually.
)

echo.
echo =================================================================
echo Recovery and Cache Clear Complete!
echo =================================================================
echo.
pause
