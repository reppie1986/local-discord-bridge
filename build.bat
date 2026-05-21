@echo off
setlocal

set "ROOT=%~dp0"
set "EXT_DIR=%ROOT%extension"
set "BRIDGE_DIR=%ROOT%bridge"

echo.
echo Gremy Build Menu
echo =================
echo 1. Build Firefox extension
echo 2. Build bridge
echo 3. Build both
echo.

set /p choice="Choose option 1, 2, or 3: "

if "%choice%"=="1" goto build_extension
if "%choice%"=="2" goto build_bridge
if "%choice%"=="3" goto build_both

echo Invalid choice.
pause
exit /b 1

:build_extension
echo.
echo Building Firefox extension...
cd /d "%EXT_DIR%" || exit /b 1
call pnpm install
call pnpm run build:firefox
if errorlevel 1 goto failed
goto done

:build_bridge
echo.
echo Building bridge...
cd /d "%BRIDGE_DIR%" || exit /b 1
call npm install
call npm run build
if errorlevel 1 goto failed
goto done

:build_both
echo.
echo Building Firefox extension...
cd /d "%EXT_DIR%" || exit /b 1
call pnpm install
call pnpm run build:firefox
if errorlevel 1 goto failed

echo.
echo Building bridge...
cd /d "%BRIDGE_DIR%" || exit /b 1
call npm install
call npm run build
if errorlevel 1 goto failed
goto done

:done
echo.
echo Build finished successfully.
pause
exit /b 0

:failed
echo.
echo Build failed. Check the error above, the goblin left fingerprints.
pause
exit /b 1