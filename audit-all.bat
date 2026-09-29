@echo off
setlocal EnableExtensions
title MansaMart Full Verification
cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 goto :missing_node
where corepack >nul 2>&1
if not errorlevel 1 (
  set "PNPM_CMD=corepack pnpm"
) else (
  where pnpm >nul 2>&1
  if errorlevel 1 goto :missing_pnpm
  set "PNPM_CMD=pnpm"
)

echo.
echo =====================================================
echo              MansaMart Full Verification
echo =====================================================
echo.

call :run "Install locked dependencies" install --frozen-lockfile
if errorlevel 1 goto :failed
call :run "Type-check all workspaces" typecheck
if errorlevel 1 goto :failed
call :run "Run automated tests" test
if errorlevel 1 goto :failed
call :run "Run lint checks" lint
if errorlevel 1 goto :failed
call :run "Build every application" build
if errorlevel 1 goto :failed
call :run "Block critical production dependency findings" audit --prod --audit-level critical
if errorlevel 1 goto :failed

echo.
echo SUCCESS: Every required MansaMart verification passed.
pause
exit /b 0

:run
echo.
echo [%~1]
shift
call %PNPM_CMD% %*
exit /b %errorlevel%

:missing_node
echo ERROR: Install Node.js 22.13 or later, then run this file again.
pause
exit /b 1

:missing_pnpm
echo ERROR: Enable Corepack or install pnpm 11.19.0.
pause
exit /b 1

:failed
echo.
echo FAILED: A verification step failed. Read the output above.
pause
exit /b 1
