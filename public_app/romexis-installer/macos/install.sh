#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# install.sh — Registra el protocolo romexis:// en macOS
#
# Crea una mini .app que captura URLs romexis:// y lanza el Romexis Viewer
#
# Uso: bash install.sh /ruta/a/Romexis_Viewer_OS_X.app
# ─────────────────────────────────────────────────────────────────────────────

ROMEXIS_DATA="${1:-/Applications/Romexis_Viewer_OS_X.app/../data}"
APP_NAME="RomexisProtocolHandler"
mkdir -p "$HOME/Applications"
APP_PATH="$HOME/Applications/${APP_NAME}.app"

echo "Creando ${APP_PATH}..."
mkdir -p "${APP_PATH}/Contents/MacOS"
mkdir -p "${APP_PATH}/Contents/Resources"

# ── AppleScript handler ───────────────────────────────────────────────────────
cat > /tmp/romexis_handler.applescript << 'APPLESCRIPT'
on open location theURL
    set filePath to theURL
    -- Quitar el prefijo "romexis:///"
    if filePath starts with "romexis:///" then
        set filePath to text 12 thru -1 of filePath
    end if

    -- URL-decode básico
    set filePath to do shell script "python3 -c \"import urllib.parse, sys; print(urllib.parse.unquote(sys.argv[1]))\" " & quoted form of filePath

    -- Crear lista temporal
    set listFile to "/tmp/smilePro_romexis_list.txt"
    do shell script "echo " & quoted form of filePath & " > " & listFile

    -- Lanzar Romexis Viewer
    set romexisData to (system attribute "ROMEXIS_DATA")
    do shell script "cd " & quoted form of romexisData & " && bash start.sh 2048 en " & quoted form of listFile & " &"
end open location
APPLESCRIPT

# Compilar AppleScript a app
osacompile -o "${APP_PATH}" /tmp/romexis_handler.applescript

# ── Info.plist con el URL scheme ──────────────────────────────────────────────
cat > "${APP_PATH}/Contents/Info.plist" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>applet</string>
    <key>CFBundleIdentifier</key>
    <string>com.smilepro.romexis-handler</string>
    <key>CFBundleName</key>
    <string>RomexisProtocolHandler</string>
    <key>CFBundleVersion</key>
    <string>1.0</string>
    <key>CFBundleURLTypes</key>
    <array>
        <dict>
            <key>CFBundleURLName</key>
            <string>Planmeca Romexis Viewer</string>
            <key>CFBundleURLSchemes</key>
            <array>
                <string>romexis</string>
            </array>
        </dict>
    </array>
    <key>LSBackgroundOnly</key>
    <true/>
    <key>NSAppleEventsUsageDescription</key>
    <string>SmilePro necesita abrir Planmeca Romexis Viewer</string>
</dict>
</plist>
PLIST

# Variable de entorno con la ruta de datos de Romexis
defaults write "${APP_PATH}/Contents/Info" ROMEXIS_DATA "${ROMEXIS_DATA}"

# Registrar en Launch Services
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister \
    -f "${APP_PATH}"

echo ""
echo "✓ Protocolo romexis:// registrado correctamente."
echo "  Handler: ${APP_PATH}"
echo "  Datos Romexis: ${ROMEXIS_DATA}"
echo ""
echo "Prueba: abre Safari y ve a  romexis:///ruta/al/archivo.dcm"
