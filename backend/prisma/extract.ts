// @ts-nocheck
/**
 * ─── GELITE Extraction Script ─────────────────────────────────────────
 *  Extrae datos de GELITE (SQL Server) → PostgreSQL local (Prisma).
 *  Filtro: tablas transaccionales desde 2025-12-01. Catálogos: todo.
 *  Uso:  npx ts-node prisma/extract.ts
 * ──────────────────────────────────────────────────────────────────────
 */
import { PrismaClient } from '@prisma/client';
import sql from 'mssql';

const prisma = new PrismaClient();

const GELITE: sql.config = {
  user: 'SmileStudio',
  password: 'SmileStudio2026!',
  server: 'bbddsql.servemp3.com',
  database: 'GELITE',
  options: { encrypt: true, trustServerCertificate: true },
  requestTimeout: 300_000,
  pool: { max: 5, min: 1 },
};

// ── Fecha de corte ───────────────────────────────────────────────────
const CUTOFF_ISO = '2025-12-01';
const CUTOFF_OLE = Math.floor(
  (new Date(CUTOFF_ISO).getTime() - new Date(1899, 11, 30).getTime()) / 86_400_000
);

// ── Helpers ──────────────────────────────────────────────────────────
const BINARY_TYPES = new Set(['varbinary', 'binary', 'image', 'timestamp']);
/** Prisma @map("_col") → field name es "col" (sin underscore) */
const safe = (col: string) => (col.startsWith('_') ? col.substring(1) : col);

function mapRow(row: any, cols: { name: string; safeName: string; binary: boolean }[]) {
  const out: any = {};
  for (const c of cols) {
    const v = row[c.name];
    if (v === null || v === undefined) { out[c.safeName] = null; continue; }
    out[c.safeName] = c.binary ? Buffer.from([]) : v;
  }
  return out;
}

async function chunked(accessor: string, rows: any[], sz = 5000) {
  for (let i = 0; i < rows.length; i += sz) {
    const chunk = rows.slice(i, i + sz);
    try {
      await (prisma as any)[accessor].createMany({ data: chunk, skipDuplicates: true });
    } catch (e: any) {
      if (e.message?.includes("Can't reach database server")) {
        await new Promise(r => setTimeout(r, 5000));
        await (prisma as any)[accessor].createMany({ data: chunk, skipDuplicates: true });
      } else {
        console.error(`    ❌ chunk ${i}-${i + chunk.length}: ${e.message?.slice(0, 200)}`);
      }
    }
  }
}

async function getCols(pool: sql.ConnectionPool, table: string) {
  const r = await pool.request()
    .input('t', sql.VarChar, table)
    .query(`SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = @t ORDER BY ORDINAL_POSITION`);
  return r.recordset.map((c: any) => ({
    name: c.COLUMN_NAME as string,
    safeName: safe(c.COLUMN_NAME),
    binary: BINARY_TYPES.has((c.DATA_TYPE as string).toLowerCase()),
  }));
}

// ── Table definitions ────────────────────────────────────────────────
// [sqlTable, prismaAccessor, dateCol?, 'ole'?]
type TDef = [string, string] | [string, string, string] | [string, string, string, 'ole'];

const TABLES: TDef[] = [
  // ── Catálogos / referencia (sin filtro) ────────────────────────────
  ['AgdNotas', 'agdNotas'],
  ['CajaFuerteDia', 'cajaFuerteDia'],
  ['TAuxPaseTarjeta', 'tAuxPaseTarjeta'],
  ['TProte', 'tProte'],
  ['Centros_TProte', 'centros_TProte'],
  ['CajaFuerte', 'cajaFuerte'],
  ['ContFormato', 'contFormato'],
  ['OrigenCita', 'origenCita'],
  ['GDPRProfiles', 'gDPRProfiles'],
  ['Bancos', 'bancos'],
  ['PlanEco', 'planEco'],
  ['TAuxTipoExpComp', 'tAuxTipoExpComp'],
  ['GDPR_FTX_Fichas', 'gDPR_FTX_Fichas'],
  ['DCitasPeriod', 'dCitasPeriod'],
  ['TMotivoIncidencia', 'tMotivoIncidencia'],
  ['Dispositivo', 'dispositivo'],
  ['TxtPrede', 'txtPrede'],
  ['TSubFams', 'tSubFams'],
  ['TAlmacen', 'tAlmacen'],
  ['TPaises', 'tPaises'],
  ['AgrupacionesFormaPago', 'agrupacionesFormaPago'],
  ['TTipoColab', 'tTipoColab'],
  ['TPluggin', 'tPluggin'],
  ['TReclamaPago', 'tReclamaPago'],
  ['TEstados', 'tEstados'],
  ['TGrpColab', 'tGrpColab'],
  ['Emisores', 'emisores'],
  ['Centros_TUsers_S1_Roles', 'centros_TUsers_S1_Roles'],
  ['EdGrupos', 'edGrupos'],
  ['TipoOrtoCasos_Intervenciones', 'tipoOrtoCasos_Intervenciones'],
  ['Centros', 'centros'],
  ['PacMensajes', 'pacMensajes'],
  ['ATMT_Protocolos', 'aTMT_Protocolos'],
  ['GDPR_FTX_Fichas_Consentimientos', 'gDPR_FTX_Fichas_Consentimientos'],
  ['TipoControlRecall', 'tipoControlRecall'],
  ['TECivil', 'tECivil'],
  ['TRRecall', 'tRRecall'],
  ['GDPR_FTX_Consentimientos', 'gDPR_FTX_Consentimientos'],
  ['Tarifas', 'tarifas'],
  ['Centros_Tarifas', 'centros_Tarifas'],
  ['DCitasTto', 'dCitasTto'],
  ['TTipoParametros', 'tTipoParametros'],
  ['TipoOrtoCasos_EstadosCaso', 'tipoOrtoCasos_EstadosCaso'],
  ['TipoOrtoCasos_ConceptosHigiene', 'tipoOrtoCasos_ConceptosHigiene'],
  ['TipoOrtoCasos_ConceptosColaboracion', 'tipoOrtoCasos_ConceptosColaboracion'],
  ['SeriesOficiales', 'seriesOficiales'],
  ['Centros_Conectores', 'centros_Conectores'],
  ['Desktops', 'desktops'],
  ['TiposPresupuestos', 'tiposPresupuestos'],
  ['PlanEcoL', 'planEcoL'],
  ['TUsuAOpcTtosSugeridos', 'tUsuAOpcTtosSugeridos'],
  ['Contadores', 'contadores'],
  ['TransaccionTratamiento', 'transaccionTratamiento'],
  ['TUPerfil', 'tUPerfil'],
  ['FormasPago', 'formasPago'],
  ['TSitCalH', 'tSitCalH'],
  ['TSitCal', 'tSitCal'],
  ['UserEspec', 'userEspec'],
  ['TTipoIVA', 'tTipoIVA'],
  ['TTipoAntecedentes', 'tTipoAntecedentes'],
  ['TUCentros', 'tUCentros'],
  ['Idioma', 'idioma'],
  ['TCalCa', 'tCalCa'],
  ['TSitCita', 'tSitCita'],
  ['TMRecall', 'tMRecall'],
  ['TUsers', 'tUsers'],
  ['TPacPlan', 'tPacPlan'],
  ['TCtasGen', 'tCtasGen'],
  ['TUsuAgd', 'tUsuAgd'],
  ['TForPago', 'tForPago'],
  ['TalonReceta', 'talonReceta'],
  ['TRegApun', 'tRegApun'],
  ['UserCola', 'userCola'],
  ['IconoTratAgenda', 'iconoTratAgenda'],
  ['TiposFormaPago', 'tiposFormaPago'],
  ['TColabos', 'tColabos'],
  ['Centros_TColabos', 'centros_TColabos'],
  ['ATMT_Plantillas_ConectoresParams', 'aTMT_Plantillas_ConectoresParams'],
  ['TGrupos', 'tGrupos'],
  ['PacPerio', 'pacPerio'],
  ['PresuTipo', 'presuTipo'],
  ['TCalHor', 'tCalHor'],
  ['TMotivoAsignacion', 'tMotivoAsignacion'],
  ['FTX_00000088_Dental', 'fTX_00000088_Dental'],
  ['GDPR_FTX_00000001', 'gDPR_FTX_00000001'],
  ['TProfesi', 'tProfesi'],
  ['ATMT_Tareas', 'aTMT_Tareas'],
  ['TTipoOdg', 'tTipoOdg'],
  ['Widgets', 'widgets'],
  ['TtosMed_PagoCli', 'ttosMed_PagoCli'],
  ['TConectores', 'tConectores'],
  ['TRRecall_TMRecall', 'tRRecall_TMRecall'],
  ['ATMT_Plantillas', 'aTMT_Plantillas'],
  ['TSeries', 'tSeries'],
  ['TProvin', 'tProvin'],
  ['TEspecOMC', 'tEspecOMC'],
  ['AgdAccesos', 'agdAccesos'],
  ['TUsuAOpc', 'tUsuAOpc'],
  ['PacientesPublic', 'pacientesPublic'],
  ['TConectorParams', 'tConectorParams'],
  ['EdSubGrp', 'edSubGrp'],
  ['TSubTipoAntecedentes', 'tSubTipoAntecedentes'],
  ['DocsFirmados', 'docsFirmados'],
  ['EdDocs', 'edDocs'],
  ['TPoblaci', 'tPoblaci'],
  ['EdMail', 'edMail'],
  ['EdMailL', 'edMailL'],
  ['RptTempl', 'rptTempl'],
  ['PresuTipoTto', 'presuTipoTto'],
  ['CPPoblacio', 'cPPoblacio'],
  ['TCalDias', 'tCalDias'],
  ['DispositivoPac', 'dispositivoPac'],
  ['RptDefec', 'rptDefec'],
  ['Tratamientos', 'tratamientos'],
  ['TratamientosFases', 'tratamientosFases'],
  ['Tratamientos_Tarifas_Precios', 'tratamientos_Tarifas_Precios'],
  ['Tratamientos_Tarifas', 'tratamientos_Tarifas'],
  ['CfgDatos', 'cfgDatos'],
  ['TTratamientos', 'tTratamientos'],
  ['ExplPerio', 'explPerio'],
  ['AlertPac', 'alertPac'],
  ['Recalls', 'recalls'],
  ['RecallsLog', 'recallsLog'],
  ['TalonRecetaCVE', 'talonRecetaCVE'],
  ['TDocumentosPac', 'tDocumentosPac'],
  ['RecetasDet', 'recetasDet'],
  ['RecetasCab', 'recetasCab'],
  ['DCitasLogSit', 'dCitasLogSit'],
  ['Accesos', 'accesos'],
  ['TAuxFarmacos', 'tAuxFarmacos'],
  ['TICD9', 'tICD9'],
  // ── Master data (sin filtro — necesario para JOINs) ────────────────
  ['Pacientes', 'pacientes'],
  ['PacCli', 'pacCli'],
  ['Clientes', 'clientes'],
  ['Pacientes_Tarifas', 'pacientes_Tarifas'],
  ['PresuTto', 'presuTto'],
  ['DCitasOp', 'dCitasOp'],
  // ── Transaccionales GRANDES (filtro >= 2025-12-01) ─────────────────
  ['DCitas', 'dCitas', 'Fecha', 'ole'],
  ['DCitasF', 'dCitasF', 'Fecha', 'ole'],
  ['TtosMed', 'ttosMed', '_fechareg'],
  ['TtosMedFases', 'ttosMedFases', '_fechareg'],
  ['Presu', 'presu', 'FecPresup'],
  ['DocAdmin', 'docAdmin', 'FecDoc'],
  ['LinAdmin', 'linAdmin', '_fechareg'],
  ['PagoCli', 'pagoCli', 'FecPago'],
  ['DeudaCli', 'deudaCli', '_fechareg'],
  ['DeudaPago', 'deudaPago', 'FecPago'],
  ['RegApun', 'regApun', 'FecReg'],
  ['BancoMov', 'bancoMov', 'Fecha'],
  ['PacientesLog', 'pacientesLog', '_fechaReg'],
  ['LogErrores', 'logErrores', '_FechaReg'],
  ['Pacientes_Tarifas_log', 'pacientes_Tarifas_log', '_fechareg'],
];

// ── Main ─────────────────────────────────────────────────────────────
async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  GELITE → PostgreSQL Extraction');
  console.log(`  Fecha corte: ${CUTOFF_ISO}  (OLE int: ${CUTOFF_OLE})`);
  console.log('═══════════════════════════════════════════════════\n');

  console.log('🔗 Connecting to GELITE SQL Server...');
  const pool = await sql.connect(GELITE);
  console.log('✅ Connected!\n');

  // Desactivar FK constraints para poder truncar en cualquier orden
  await prisma.$executeRawUnsafe(`SET session_replication_role = 'replica'`);

  let ok = 0, fail = 0;

  for (const t of TABLES) {
    const [sqlTable, prismaAcc, dateCol, dateType] = t;
    try {
      const cols = await getCols(pool, sqlTable);
      if (cols.length === 0) { console.log(`⚠️  ${sqlTable}: no columns, skip`); fail++; continue; }

      let query = `SELECT * FROM [${sqlTable}]`;
      let label = '(todo)';
      if (dateCol) {
        if (dateType === 'ole') {
          query += ` WHERE [${dateCol}] >= ${CUTOFF_OLE}`;
        } else {
          query += ` WHERE [${dateCol}] >= '${CUTOFF_ISO}'`;
        }
        label = `(>= ${CUTOFF_ISO})`;
      }

      process.stdout.write(`📋 ${sqlTable} ${label}...`);
      const res = await pool.request().query(query);
      const rows = res.recordset.map((r: any) => mapRow(r, cols));

      await (prisma as any)[prismaAcc].deleteMany({});
      await chunked(prismaAcc, rows);

      console.log(` ✅ ${rows.length} rows`);
      ok++;
    } catch (e: any) {
      console.log(` ❌ ${e.message?.slice(0, 150)}`);
      fail++;
    }
  }

  await prisma.$executeRawUnsafe(`SET session_replication_role = 'origin'`);
  await pool.close();
  await prisma.$disconnect();

  console.log('\n═══════════════════════════════════════════════════');
  console.log(`  ✅ ${ok} tablas OK   ❌ ${fail} errores`);
  console.log('═══════════════════════════════════════════════════');
}

main().catch(e => { console.error('💥 Fatal:', e); process.exit(1); });
