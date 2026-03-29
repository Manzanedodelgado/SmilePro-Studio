@echo off
:: ─────────────────────────────────────────────────────────────
:: SmilePro · Romexis Agent — Instalador Windows
:: NO requiere compilar. Solo necesita Node.js instalado.
:: Ejecutar haciendo doble clic (no necesita ser Administrador)
:: ─────────────────────────────────────────────────────────────

setlocal
set AGENT_DIR=%~dp0
set AGENT_JS=%AGENT_DIR%agent.js
set STARTUP_KEY=HKCU\Software\Microsoft\Windows\CurrentVersion\Run
set SERVICE_NAME=SmileProRomexisAgent

echo.
echo  ╔════════════════════════════════════════════╗
echo  ║   SmilePro · Romexis Agent  v1.0          ║
echo  ║   Instalador Windows                       ║
echo  ╚════════════════════════════════════════════╝
echo.

:: ── 1. Comprobar Node.js ──────────────────────────────────────
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js no esta instalado.
    echo.
    echo  Instala Node.js LTS desde: https://nodejs.org
    echo  Despues vuelve a ejecutar este archivo.
    echo.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do set NODE_VER=%%i
echo [OK] Node.js %NODE_VER% encontrado.

:: ── 2. Comprobar agent.js ─────────────────────────────────────
if not exist "%AGENT_JS%" (
    echo [ERROR] No se encontro agent.js en: %AGENT_DIR%
    pause
    exit /b 1
)
echo [OK] agent.js encontrado.

:: ── 3. Instalar dependencias si hace falta ────────────────────
if not exist "%AGENT_DIR%node_modules" (
    echo [INFO] Instalando dependencias...
    cd /d "%AGENT_DIR%"
    npm install --omit=dev >nul 2>&1
    echo [OK] Dependencias instaladas.
)

:: ── 4. Buscar DxStart.exe ─────────────────────────────────────
set DXSTART_PATH=
if exist "%AGENT_DIR%DxStart.exe"              set DXSTART_PATH=%AGENT_DIR%DxStart.exe
if exist "C:\Romexis\DxStart.exe"              set DXSTART_PATH=C:\Romexis\DxStart.exe
if exist "C:\Program Files\Romexis\DxStart.exe" set DXSTART_PATH=C:\Program Files\Romexis\DxStart.exe
if exist "C:\Program Files (x86)\Romexis\DxStart.exe" set DXSTART_PATH=C:\Program Files (x86)\Romexis\DxStart.exe

if "%DXSTART_PATH%"=="" (
    echo [AVISO] DxStart.exe no encontrado automaticamente.
    set /p DXSTART_PATH="Introduce la ruta completa a DxStart.exe: "
)
echo [OK] DxStart: %DXSTART_PATH%

:: ── 5. Registrar inicio automatico con Windows ───────────────
echo.
echo [INFO] Registrando inicio automatico...
set START_CMD=cmd /c "start /min node \"%AGENT_JS%\""
if "%DXSTART_PATH%" neq "" (
    set START_CMD=cmd /c "start /min /D \"%AGENT_DIR%\" node \"%AGENT_JS%\" && exit"
)
reg add "%STARTUP_KEY%" /v "%SERVICE_NAME%" /t REG_SZ /d "cmd /c \"start /min /D \"%AGENT_DIR%\" node \"%AGENT_JS%\"\"" /f >nul 2>&1
echo [OK] Inicio automatico registrado.

:: ── 6. Crear acceso directo en el escritorio ─────────────────
powershell -Command "$ws = New-Object -ComObject WScript.Shell; $s = $ws.CreateShortcut([Environment]::GetFolderPath('Desktop') + '\Romexis Agent.lnk'); $s.TargetPath = 'node'; $s.Arguments = '\"%AGENT_JS%\"'; $s.WorkingDirectory = '%AGENT_DIR%'; $s.WindowStyle = 7; $s.Description = 'SmilePro Romexis Agent'; $s.Save()" >nul 2>&1
echo [OK] Acceso directo creado en el escritorio.

:: ── 7. Arrancar el agente ahora ──────────────────────────────
echo.
echo [INFO] Arrancando el agente...
set DXSTART_PATH_ENV=%DXSTART_PATH%
start /min "SmilePro Romexis Agent" cmd /c "cd /d "%AGENT_DIR%" && set DXSTART_PATH=%DXSTART_PATH_ENV% && node agent.js"
timeout /t 3 /nobreak >nul

:: ── 8. Verificar ─────────────────────────────────────────────
curl -s http://127.0.0.1:7893/health >nul 2>&1
if %errorlevel% equ 0 (
    echo [OK] Agente corriendo correctamente en http://127.0.0.1:7893
) else (
    echo [AVISO] El agente puede tardar unos segundos. Comprueba el log:
    echo         %AGENT_DIR%romexis-agent.log
)

echo.
echo  ─────────────────────────────────────────────
echo  Instalacion completada.
echo.
echo  Puerto:  7893
echo  DxStart: %DXSTART_PATH%
echo  Log:     %AGENT_DIR%romexis-agent.log
echo.
echo  Para verificar: abre el navegador y ve a
echo  http://127.0.0.1:7893/health
echo  ─────────────────────────────────────────────
echo.
pause
