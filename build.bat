@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "EXT_DIR=extension"
set "BRIDGE_DIR=bridge"
set "CHROME_DIST=%EXT_DIR%\dist"
set "CHROME_COPY=%EXT_DIR%\dist-chrome"
set "FIREFOX_DIST=%EXT_DIR%\dist-firefox"

echo.
echo Extensible Discord Bridge build helper
echo.
echo 1. Build Chrome extension
echo 2. Build Firefox extension
echo 3. Build bridge
echo 4. Build all
echo 5. Install/update dependencies
echo.

set /p choice="Enter choice [1-5]: "

if "%choice%"=="1" ( call :build_extension chrome || exit /b 1 ) & goto done
if "%choice%"=="2" ( call :build_extension firefox || exit /b 1 ) & goto done
if "%choice%"=="3" ( call :build_bridge || exit /b 1 ) & goto done
if "%choice%"=="4" (
    call :build_extension chrome || exit /b 1
    call :build_extension firefox || exit /b 1
    call :build_bridge || exit /b 1
    goto done
)
if "%choice%"=="5" (
    call :install_extension_deps || exit /b 1
    call :install_bridge_deps || exit /b 1
    goto done
)

echo Invalid choice.
exit /b 1


:build_extension
set "BROWSER=%~1"

echo.
echo Building %BROWSER% extension...

if not exist "%EXT_DIR%\package.json" (
    echo Missing %EXT_DIR%\package.json
    echo This build script expects the README layout: one extension package in .\extension
    exit /b 1
)

call :install_extension_deps_if_missing || exit /b 1

pushd "%EXT_DIR%"

if /I "%BROWSER%"=="chrome" (
    call :has_script build:chrome
    if errorlevel 1 (
        call :run_extension_script build
    ) else (
        call :run_extension_script build:chrome
    )
) else (
    set "TARGET_BROWSER=firefox"
    set "BROWSER=firefox"

    call :has_script build:firefox
    if errorlevel 1 (
        call :has_script firefox
        if errorlevel 1 (
            call :run_extension_script build
        ) else (
            call :run_extension_script firefox
        )
    ) else (
        call :run_extension_script build:firefox
    )
)

set "ERR=%ERRORLEVEL%"
popd

if not "%ERR%"=="0" exit /b %ERR%

if not exist "%CHROME_DIST%\" (
    echo.
    echo Build finished, but %CHROME_DIST% was not found.
    echo Check your extension build output path.
    exit /b 1
)

if /I "%~1"=="chrome" (
    call :mirror_dir "%CHROME_DIST%" "%CHROME_COPY%" || exit /b 1
    echo Chrome extension output: %CHROME_DIST%
    echo Chrome backup output:    %CHROME_COPY%
) else (
    call :mirror_dir "%CHROME_DIST%" "%FIREFOX_DIST%" || exit /b 1
    echo Firefox extension output: %FIREFOX_DIST%

    if exist "%CHROME_COPY%\" (
        call :mirror_dir "%CHROME_COPY%" "%CHROME_DIST%" || exit /b 1
        echo Restored Chrome output back to: %CHROME_DIST%
    ) else (
        echo.
        echo Note: no %CHROME_COPY% exists yet, so %CHROME_DIST% still contains the last build.
        echo Build Chrome once to keep %CHROME_DIST% as the Chrome load-unpacked folder.
    )
)

exit /b 0


:build_bridge
echo.
echo Building bridge...

if not exist "%BRIDGE_DIR%\package.json" (
    echo Missing %BRIDGE_DIR%\package.json
    exit /b 1
)

call :install_bridge_deps_if_missing || exit /b 1

pushd "%BRIDGE_DIR%"
call :run_package_script build
set "ERR=%ERRORLEVEL%"
popd

exit /b %ERR%


:install_extension_deps_if_missing
if exist "%EXT_DIR%\node_modules\" exit /b 0
call :install_extension_deps
exit /b %ERRORLEVEL%


:install_bridge_deps_if_missing
if exist "%BRIDGE_DIR%\node_modules\" exit /b 0
call :install_bridge_deps
exit /b %ERRORLEVEL%


:install_extension_deps
echo.
echo Installing extension dependencies...
pushd "%EXT_DIR%"
call :install_package_deps
set "ERR=%ERRORLEVEL%"
popd
exit /b %ERR%


:install_bridge_deps
echo.
echo Installing bridge dependencies...
pushd "%BRIDGE_DIR%"
call :install_package_deps
set "ERR=%ERRORLEVEL%"
popd
exit /b %ERR%


:install_package_deps
if exist "pnpm-lock.yaml" (
    call pnpm install
    exit /b %ERRORLEVEL%
)

if exist "package-lock.json" (
    call npm install
    exit /b %ERRORLEVEL%
)

where pnpm >nul 2>nul
if "%ERRORLEVEL%"=="0" (
    call pnpm install
    exit /b %ERRORLEVEL%
)

call npm install
exit /b %ERRORLEVEL%


:run_extension_script
call :has_script "%~1"
if errorlevel 1 exit /b 1

if exist "pnpm-lock.yaml" (
    call pnpm run "%~1"
    exit /b %ERRORLEVEL%
)

if exist "package-lock.json" (
    call npm run "%~1"
    exit /b %ERRORLEVEL%
)

where pnpm >nul 2>nul
if "%ERRORLEVEL%"=="0" (
    call pnpm run "%~1"
    exit /b %ERRORLEVEL%
)

call npm run "%~1"
exit /b %ERRORLEVEL%


:run_package_script
call :has_script "%~1"
if errorlevel 1 (
    echo Missing npm script "%~1" in %CD%\package.json
    exit /b 1
)

if exist "pnpm-lock.yaml" (
    call pnpm run "%~1"
    exit /b %ERRORLEVEL%
)

if exist "package-lock.json" (
    call npm run "%~1"
    exit /b %ERRORLEVEL%
)

where pnpm >nul 2>nul
if "%ERRORLEVEL%"=="0" (
    call pnpm run "%~1"
    exit /b %ERRORLEVEL%
)

call npm run "%~1"
exit /b %ERRORLEVEL%


:has_script
node -e "const p=require('./package.json'); process.exit(p.scripts && p.scripts[process.argv[1]] ? 0 : 1)" "%~1" >nul 2>nul
exit /b %ERRORLEVEL%


:mirror_dir
set "SRC=%~1"
set "DST=%~2"

if not exist "%SRC%\" (
    echo Missing source directory: %SRC%
    exit /b 1
)

if not exist "%DST%\" mkdir "%DST%" >nul 2>nul

robocopy "%SRC%" "%DST%" /MIR /NFL /NDL /NJH /NJS /NP >nul
set "RC=%ERRORLEVEL%"

rem Robocopy returns 0-7 for success / non-fatal copy states.
if %RC% LEQ 7 exit /b 0

echo Robocopy failed with exit code %RC%.
exit /b %RC%


:done
echo.
echo Build complete.
exit /b 0
