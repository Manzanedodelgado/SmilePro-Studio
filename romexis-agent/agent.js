/**
 * SmilePro · Romexis Agent
 * ─────────────────────────────────────────────────────────────
 * Agente local que corre en la máquina Windows con Romexis.
 * Escucha en http://localhost:7893
 *
 * Endpoints:
 *   GET  /health                   → estado del agente
 *   POST /dxstart                  → abre paciente en Romexis vía DxStart
 *   GET  /images/:patientId        → miniaturas RX del paciente (desde SQL + disco)
 *   GET  /image-file/:filename     → sirve imagen original por nombre de archivo
 *
 * Variables de entorno opcionales:
 *   DXSTART_PATH      Ruta a DxStart.exe
 *   AGENT_PORT        Puerto HTTP (defecto 7893)
 *   ROMEXIS_IMG_DIR   Carpeta de imágenes (defecto C:\romexis_images)
 *   SQL_SERVER        Instancia SQL Server (defecto localhost\ROMEXIS)
 *   SQL_DATABASE      Base de datos (defecto ROMEXIS)
 *   SQL_USER          Usuario SQL (vacío = Windows Auth)
 *   SQL_PASSWORD      Contraseña SQL
 * ─────────────────────────────────────────────────────────────
 */

const http   = require('http');
const path   = require('path');
const fs     = require('fs');
const { spawn } = require('child_process');

let sql, sharp;
try { sql   = require('mssql');  } catch(_) { sql   = null; }
try { sharp = require('sharp');  } catch(_) { sharp = null; }

// ── Configuración ─────────────────────────────────────────────

const PORT    = parseInt(process.env.AGENT_PORT   ?? '7893', 10);
const ORIGIN  = process.env.ALLOWED_ORIGIN ?? '*';

// DxStart.exe: busca en orden hasta encontrar uno que exista
const DXSTART = (() => {
    const candidates = [
        (process.env.DXSTART_PATH ?? '').trim(),           // variable de entorno
        path.join(__dirname, 'DxStart.exe'),               // misma carpeta que agent.js
        path.join(path.dirname(process.execPath), 'DxStart.exe'), // junto al .exe compilado
        'C:\\Romexis\\DxStart.exe',
        'C:\\Program Files\\Romexis\\DxStart.exe',
        'C:\\Program Files (x86)\\Romexis\\DxStart.exe',
    ].filter(Boolean);
    return candidates.find(p => fs.existsSync(p)) ?? candidates[1];
})();

// ── Configuración SQL Server ──────────────────────────────────

const IMG_DIR = (process.env.ROMEXIS_IMG_DIR ?? 'C:\\romexis_images').trim();

const SQL_CFG = {
    server:   (process.env.SQL_SERVER   ?? 'SERVIDOR\\ROMEXIS').trim(),
    database: (process.env.SQL_DATABASE ?? 'romexis').trim(),
    user:     process.env.SQL_USER     ?? '',
    password: process.env.SQL_PASSWORD ?? '',
    options: {
        encrypt:              false,
        trustServerCertificate: true,
        enableArithAbort:     true,
        // Windows Auth si no hay usuario
        trustedConnection:    !(process.env.SQL_USER),
    },
    pool: { max: 5, min: 0, idleTimeoutMillis: 15000 },
    connectionTimeout: 8000,
    requestTimeout:    10000,
};

let sqlPool = null;

async function getSqlPool() {
    if (sqlPool) return sqlPool;
    if (!sql) throw new Error('mssql no instalado — ejecuta npm install');
    sqlPool = await sql.connect(SQL_CFG);
    return sqlPool;
}

// ── Logger simple a archivo ───────────────────────────────────

const LOG_FILE = path.join(path.dirname(process.execPath), 'romexis-agent.log');

function log(level, msg) {
    const line = `[${new Date().toISOString()}] [${level}] ${msg}`;
    console.log(line);
    try { fs.appendFileSync(LOG_FILE, line + '\n'); } catch (_) { /* no-op */ }
}

// ── Helpers ───────────────────────────────────────────────────

function cors(res) {
    res.setHeader('Access-Control-Allow-Origin',  ORIGIN);
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function json(res, code, body) {
    cors(res);
    res.writeHead(code, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
}

function readBody(req) {
    return new Promise((resolve, reject) => {
        let raw = '';
        req.on('data', chunk => { raw += chunk; });
        req.on('end',  ()    => {
            try { resolve(JSON.parse(raw || '{}')); }
            catch (e) { reject(e); }
        });
        req.on('error', reject);
    });
}

// ── DxStart launcher ──────────────────────────────────────────

function launchDxStart({ patientId, familyName, firstName, birthDate, doctor }) {
    return new Promise((resolve, reject) => {
        if (!fs.existsSync(DXSTART)) {
            return reject(new Error(`DxStart no encontrado en: ${DXSTART}`));
        }

        // Spec Planmeca: "PatientID" "FamilyName" "FirstName" "BirthDate" ["Doctor"]
        const args = [patientId, familyName, firstName, birthDate];
        if (doctor) args.push(doctor);

        log('INFO', `Lanzando: ${DXSTART} ${args.map(a => `"${a}"`).join(' ')}`);

        const child = spawn(DXSTART, args, {
            detached:    true,
            stdio:       'ignore',
            windowsHide: false,
        });

        child.on('error', err => {
            log('ERROR', `DxStart falló: ${err.message}`);
            reject(err);
        });

        // DxStart arranca Romexis y termina rápido — no esperamos
        child.unref();
        resolve({ launched: true, patientId });
    });
}

// ── Servidor HTTP ─────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
    const url = req.url.split('?')[0];

    // Preflight CORS
    if (req.method === 'OPTIONS') {
        cors(res);
        res.writeHead(204);
        res.end();
        return;
    }

    // Health check
    if (req.method === 'GET' && url === '/health') {
        json(res, 200, {
            status:   'ok',
            dxstart:  DXSTART,
            exists:   fs.existsSync(DXSTART),
            port:     PORT,
            version:  '1.0.0',
        });
        return;
    }

    // Lanzar DxStart
    if (req.method === 'POST' && url === '/dxstart') {
        let body;
        try { body = await readBody(req); }
        catch (_) {
            json(res, 400, { success: false, error: 'JSON inválido' });
            return;
        }

        const { patientId, familyName, firstName, birthDate, doctor } = body;

        if (!patientId || !familyName || !firstName || !birthDate) {
            json(res, 400, { success: false, error: 'Campos obligatorios: patientId, familyName, firstName, birthDate' });
            return;
        }

        try {
            const result = await launchDxStart({ patientId, familyName, firstName, birthDate, doctor });
            log('INFO', `Paciente abierto en Romexis: ${patientId} (${familyName}, ${firstName})`);
            json(res, 200, { success: true, data: result });
        } catch (err) {
            json(res, 500, { success: false, error: err.message, dxstartPath: DXSTART });
        }
        return;
    }

    // ── GET /images/:patientId — miniaturas RX del paciente ──────
    // Consulta SQL Server para obtener rutas de imágenes y las devuelve
    // como thumbnails en base64 (JPEG 200x200).
    const imagesMatch = url.match(/^\/images\/(.+)$/);
    if (req.method === 'GET' && imagesMatch) {
        const patientId = decodeURIComponent(imagesMatch[1]);
        try {
            const pool = await getSqlPool();
            // Consulta las imágenes del paciente en la BD de Romexis.
            // Las columnas exactas se ajustan según el esquema real de la BD.
            const result = await pool.request()
                .input('pid', sql.NVarChar, patientId)
                .query(`
                    SELECT TOP 50
                        i.ImageID,
                        i.FileName,
                        i.ImageDate,
                        i.ImageType,
                        i.Description
                    FROM Images i
                    INNER JOIN Patients p ON p.PatientID = i.PatientID
                    WHERE p.PatientID = @pid
                       OR p.ExternalID = @pid
                    ORDER BY i.ImageDate DESC
                `);

            const images = [];
            for (const row of result.recordset) {
                const filePath = path.join(IMG_DIR, row.FileName);
                if (!fs.existsSync(filePath)) continue;

                let thumbBase64 = null;
                try {
                    if (sharp) {
                        // Genera miniatura 200x200
                        const buf = await sharp(filePath)
                            .resize(200, 200, { fit: 'inside', withoutEnlargement: true })
                            .jpeg({ quality: 75 })
                            .toBuffer();
                        thumbBase64 = buf.toString('base64');
                    } else {
                        // Sin sharp: devuelve la imagen original en base64
                        thumbBase64 = fs.readFileSync(filePath).toString('base64');
                    }
                } catch (_) { /* imagen corrupta, la omitimos */ }

                if (thumbBase64) {
                    images.push({
                        id:          row.ImageID,
                        fileName:    row.FileName,
                        date:        row.ImageDate,
                        type:        row.ImageType,
                        description: row.Description,
                        thumb:       `data:image/jpeg;base64,${thumbBase64}`,
                    });
                }
            }

            log('INFO', `Imágenes devueltas para paciente ${patientId}: ${images.length}`);
            json(res, 200, { success: true, data: images });
        } catch (err) {
            log('ERROR', `Error obteniendo imágenes: ${err.message}`);
            json(res, 500, { success: false, error: err.message });
        }
        return;
    }

    // ── GET /image-file/:filename — sirve imagen original ────────
    const fileMatch = url.match(/^\/image-file\/(.+)$/);
    if (req.method === 'GET' && fileMatch) {
        const fileName = decodeURIComponent(fileMatch[1]);
        // Seguridad: no permitir path traversal
        const filePath = path.resolve(IMG_DIR, path.basename(fileName));
        if (!filePath.startsWith(path.resolve(IMG_DIR))) {
            json(res, 403, { success: false, error: 'Ruta no permitida' });
            return;
        }
        if (!fs.existsSync(filePath)) {
            json(res, 404, { success: false, error: 'Archivo no encontrado' });
            return;
        }
        const ext = path.extname(fileName).toLowerCase();
        const mime = ext === '.png' ? 'image/png'
                   : ext === '.bmp' ? 'image/bmp'
                   : 'image/jpeg';
        cors(res);
        res.writeHead(200, { 'Content-Type': mime });
        fs.createReadStream(filePath).pipe(res);
        return;
    }

    json(res, 404, { success: false, error: 'Ruta no encontrada' });
});

server.listen(PORT, '127.0.0.1', async () => {
    log('INFO', `SmilePro Romexis Agent arrancado en http://127.0.0.1:${PORT}`);
    log('INFO', `DxStart path: ${DXSTART} (existe: ${fs.existsSync(DXSTART)})`);
    log('INFO', `Imágenes dir: ${IMG_DIR} (existe: ${fs.existsSync(IMG_DIR)})`);
    log('INFO', `SQL Server: ${SQL_CFG.server} / DB: ${SQL_CFG.database}`);
    // Intento de conexión SQL al arrancar (no bloquea si falla)
    try {
        await getSqlPool();
        log('INFO', 'SQL Server conectado correctamente');
    } catch (e) {
        log('WARN', `SQL Server no disponible aún: ${e.message}`);
    }
});

server.on('error', err => {
    log('ERROR', `Error en el servidor: ${err.message}`);
    if (err.code === 'EADDRINUSE') {
        log('ERROR', `Puerto ${PORT} ya en uso. Cambia AGENT_PORT o cierra el proceso que lo usa.`);
    }
    process.exit(1);
});

// Cierre limpio
process.on('SIGINT',  () => { log('INFO', 'Agente detenido.'); process.exit(0); });
process.on('SIGTERM', () => { log('INFO', 'Agente detenido.'); process.exit(0); });
