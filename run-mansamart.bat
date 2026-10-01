@echo off
setlocal EnableExtensions
title MansaMart Launcher
cd /d "%~dp0"

:menu
cls
echo =====================================================
echo                  MansaMart Launcher
echo =====================================================
echo.
echo  1. Customer mobile app
echo  2. Business mobile app
echo  3. Rider mobile app
echo  4. General website
echo  5. Administrator portal
echo  6. Start every app with Docker
echo  7. Run the full verification suite
echo  8. Stop Docker services
echo  9. Exit
echo.
choice /C 123456789 /N /M "Choose 1-9: "
if errorlevel 9 goto :end
if errorlevel 8 goto :stop
if errorlevel 7 goto :audit
if errorlevel 6 goto :all
if errorlevel 5 goto :admin
if errorlevel 4 goto :web
if errorlevel 3 goto :rider
if errorlevel 2 goto :business
if errorlevel 1 goto :customer

:customer
call run-customer.bat
goto :menu

:business
call run-business.bat
goto :menu

:rider
call run-rider.bat
goto :menu

:web
call run-web.bat
goto :menu

:admin
call run-admin.bat
goto :menu

:all
call start-docker.bat
goto :menu

:audit
call audit-all.bat
goto :menu

:stop
call stop-docker.bat
goto :menu

:end
endlocal
exit /b 0
