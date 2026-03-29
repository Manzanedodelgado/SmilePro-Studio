@ECHO OFF
:: ─────────────────────────────────────────────────────────────────────────────
:: launch_romexis.bat
:: Lanzador del protocolo romexis:// para SmilePro
::
:: Recibe: romexis:///ruta/al/archivo.dcm
:: Acción: crea lista temporal de imágenes y lanza Planmeca Romexis Viewer
::
:: CONFIGURAR ROMEXIS_PATH con la ruta donde está instalado el visor
:: ─────────────────────────────────────────────────────────────────────────────

:: ── CONFIGURA AQUÍ LA RUTA DE INSTALACIÓN ────────────────────────────────────
SET ROMEXIS_PATH=C:\Romexis\data
:: ─────────────────────────────────────────────────────────────────────────────

:: Extraer la ruta del URI (quitar "romexis:///")
SET URI=%~1
SET URI=%URI:"=%

:: Usar PowerShell para URL-decode la ruta (maneja %20, %5C, etc.)
FOR /F "delims=" %%A IN ('powershell -NoProfile -Command "[System.Uri]::UnescapeDataString('%URI%' -replace '^romexis:///', '')"') DO SET FILEPATH=%%A

IF "%FILEPATH%"=="" (
    ECHO Error: no se recibio ruta de archivo.
    PAUSE
    EXIT /B 1
)

:: Crear archivo de lista temporal
SET LISTFILE=%TEMP%\smilePro_romexis_list.txt
ECHO %FILEPATH% > "%LISTFILE%"

:: Lanzar Romexis Viewer en segundo plano
START "" /D "%ROMEXIS_PATH%" "%ROMEXIS_PATH%\jre_x64\bin\java.exe" ^
    -Xmx2048m ^
    -Djogamp.gluegen.UseTempJarCache=false ^
    -Dsun.java2d.d3d=true ^
    -Djava.library.path=.\lib64\;.; ^
    -jar "%ROMEXIS_PATH%\RomexisViewer.jar" ^
    en "%LISTFILE%"

EXIT /B 0
