import { PrismaClient } from '@prisma/client';
import sql from 'mssql';

const prisma = new PrismaClient();
const gesdenConfig = {
  user: 'SmileStudio',
  password: 'SmileStudio2026!',
  server: 'bbddsql.servemp3.com',
  database: 'GELITE',
  options: { encrypt: true, trustServerCertificate: true }
};

async function chunkedInsert(accessor, rows, chunkSize = 5000) {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    try {
      await prisma[accessor].createMany({ data: chunk, skipDuplicates: true });
    } catch(err) {
      if (err.message.includes('Can\'t reach database server')) {
         console.error('DB Connection error, waiting and retrying...');
         await new Promise(r => setTimeout(r, 5000));
         await prisma[accessor].createMany({ data: chunk, skipDuplicates: true });
      } else {
         console.error(`Error inserting chunk ${i} - ${i+chunk.length}:`, err.message);
      }
    }
  }
}

async function mapRow(row, cols) {
  const out = {};
  for (const c of cols) {
    let val = row[c.name];
    if (val === null || val === undefined) { out[c.safeName] = null; continue; }
    if (c.type === 'varbinary' || c.type === 'binary' || c.type === 'image' || c.type === 'timestamp') {
      out[c.safeName] = Buffer.from([]);
    } else {
      out[c.safeName] = val;
    }
  }
  return out;
}

async function main() {
  console.log('Connecting to GELITE SQL Server...');
  const pool = await sql.connect(gesdenConfig);
  console.log('Connected!');

  console.log('Migrating AgdNotas (1 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [AgdNotas]');
    const cols = [{ name: 'IdNota', safeName: 'IdNota', type: 'int' }, { name: 'Nota', safeName: 'Nota', type: 'text' }, { name: 'Fecha', safeName: 'Fecha', type: 'int' }, { name: 'IdUsu', safeName: 'IdUsu', type: 'int' }, { name: 'IdCentro', safeName: 'IdCentro', type: 'int' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('agdnotas', mapped);
    console.log(` ✅ AgdNotas complete!`);
  } catch (e) { console.error(` ❌ Error in AgdNotas:`, e.message); }

  console.log('Migrating CajaFuerteDia (1 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [CajaFuerteDia]');
    const cols = [{ name: 'IdCajaFuerteDia', safeName: 'IdCajaFuerteDia', type: 'int' }, { name: 'IdCajaFuerte', safeName: 'IdCajaFuerte', type: 'int' }, { name: 'FechaApertura', safeName: 'FechaApertura', type: 'datetime' }, { name: 'FechaCierre', safeName: 'FechaCierre', type: 'datetime' }, { name: 'SaldoInicialEfectivo', safeName: 'SaldoInicialEfectivo', type: 'numeric' }, { name: 'SaldoFinalEfectivo', safeName: 'SaldoFinalEfectivo', type: 'numeric' }, { name: 'SaldoInicialTalon', safeName: 'SaldoInicialTalon', type: 'numeric' }, { name: 'SaldoFinalTalon', safeName: 'SaldoFinalTalon', type: 'numeric' }, { name: 'SaldoInicialRecepcion', safeName: 'SaldoInicialRecepcion', type: 'numeric' }, { name: 'SaldoFinalRecepcion', safeName: 'SaldoFinalRecepcion', type: 'numeric' }, { name: '_fechareg', safeName: 'f_fechareg', type: 'datetime' }, { name: '_version', safeName: 'f_version', type: 'int' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('cajafuertedia', mapped);
    console.log(` ✅ CajaFuerteDia complete!`);
  } catch (e) { console.error(` ❌ Error in CajaFuerteDia:`, e.message); }

  console.log('Migrating TAuxPaseTarjeta (1 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [TAuxPaseTarjeta]');
    const cols = [{ name: 'Id', safeName: 'Id', type: 'int' }, { name: 'Codigo', safeName: 'Codigo', type: 'varchar' }, { name: 'MascTarjeta', safeName: 'MascTarjeta', type: 'varchar' }, { name: 'FormatoTitular', safeName: 'FormatoTitular', type: 'varchar' }, { name: 'SeparadorTitular', safeName: 'SeparadorTitular', type: 'varchar' }, { name: 'REXP_Dato', safeName: 'REXP_Dato', type: 'varchar' }, { name: 'REXP_Control', safeName: 'REXP_Control', type: 'varchar' }, { name: 'POS_Texto', safeName: 'POS_Texto', type: 'varchar' }, { name: 'POS_Nombre', safeName: 'POS_Nombre', type: 'varchar' }, { name: 'POS_Tarjeta', safeName: 'POS_Tarjeta', type: 'varchar' }, { name: 'POS_FInicio', safeName: 'POS_FInicio', type: 'varchar' }, { name: 'POS_FExp', safeName: 'POS_FExp', type: 'varchar' }, { name: 'POS_Cobertura', safeName: 'POS_Cobertura', type: 'varchar' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('tauxpasetarjeta', mapped);
    console.log(` ✅ TAuxPaseTarjeta complete!`);
  } catch (e) { console.error(` ❌ Error in TAuxPaseTarjeta:`, e.message); }

  console.log('Migrating TProte (1 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [TProte]');
    const cols = [{ name: 'IdProte', safeName: 'IdProte', type: 'int' }, { name: 'Nombre', safeName: 'Nombre', type: 'varchar' }, { name: 'Apellidos', safeName: 'Apellidos', type: 'varchar' }, { name: 'Laboratori', safeName: 'Laboratori', type: 'varchar' }, { name: 'NIF', safeName: 'NIF', type: 'char' }, { name: 'Direccion', safeName: 'Direccion', type: 'varchar' }, { name: 'IdPoblacio', safeName: 'IdPoblacio', type: 'int' }, { name: 'Tel1', safeName: 'Tel1', type: 'varchar' }, { name: 'Tel2', safeName: 'Tel2', type: 'varchar' }, { name: 'TelMovil', safeName: 'TelMovil', type: 'varchar' }, { name: 'Fax', safeName: 'Fax', type: 'varchar' }, { name: 'Email', safeName: 'Email', type: 'varchar' }, { name: 'Web', safeName: 'Web', type: 'varchar' }, { name: 'CP', safeName: 'CP', type: 'char' }, { name: 'InformeRPT', safeName: 'InformeRPT', type: 'int' }, { name: 'LimitArt', safeName: 'LimitArt', type: 'varchar' }, { name: 'FechaBaja', safeName: 'FechaBaja', type: 'datetime' }, { name: 'TipoDocIdent', safeName: 'TipoDocIdent', type: 'int' }, { name: 'IdPaisIdent', safeName: 'IdPaisIdent', type: 'int' }, { name: 'GuidCentroDentBox', safeName: 'GuidCentroDentBox', type: 'varchar' }, { name: 'DescLaboratorioDentBox', safeName: 'DescLaboratorioDentBox', type: 'varchar' }, { name: 'DescClienteLaboratorioDentBox', safeName: 'DescClienteLaboratorioDentBox', type: 'varchar' }, { name: 'NIFClienteLaboratorioDentBox', safeName: 'NIFClienteLaboratorioDentBox', type: 'varchar' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('tprote', mapped);
    console.log(` ✅ TProte complete!`);
  } catch (e) { console.error(` ❌ Error in TProte:`, e.message); }

  console.log('Migrating Centros_TProte (1 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [Centros_TProte]');
    const cols = [{ name: 'IdCentro', safeName: 'IdCentro', type: 'int' }, { name: 'IdProte', safeName: 'IdProte', type: 'int' }, { name: 'FechaBaja', safeName: 'FechaBaja', type: 'datetime' }, { name: 'Inactivo', safeName: 'Inactivo', type: 'char' }, { name: '_fechareg', safeName: 'f_fechareg', type: 'datetime' }, { name: 'Id', safeName: 'Id', type: 'int' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('centrosTprote', mapped);
    console.log(` ✅ Centros_TProte complete!`);
  } catch (e) { console.error(` ❌ Error in Centros_TProte:`, e.message); }

  console.log('Migrating CajaFuerte (1 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [CajaFuerte]');
    const cols = [{ name: 'IdCajaFuerte', safeName: 'IdCajaFuerte', type: 'int' }, { name: 'IdCentro', safeName: 'IdCentro', type: 'int' }, { name: 'Descripcio', safeName: 'Descripcio', type: 'varchar' }, { name: 'SaldoEfectivo', safeName: 'SaldoEfectivo', type: 'numeric' }, { name: 'SaldoTalon', safeName: 'SaldoTalon', type: 'numeric' }, { name: '_version', safeName: 'f_version', type: 'int' }, { name: '_fechareg', safeName: 'f_fechareg', type: 'datetime' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('cajafuerte', mapped);
    console.log(` ✅ CajaFuerte complete!`);
  } catch (e) { console.error(` ❌ Error in CajaFuerte:`, e.message); }

  console.log('Migrating ContFormato (1 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [ContFormato]');
    const cols = [{ name: 'IdFormato', safeName: 'IdFormato', type: 'int' }, { name: 'Descripcio', safeName: 'Descripcio', type: 'varchar' }, { name: 'Formato', safeName: 'Formato', type: 'varchar' }, { name: 'Contador', safeName: 'Contador', type: 'char' }, { name: 'IdCentro', safeName: 'IdCentro', type: 'int' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('contformato', mapped);
    console.log(` ✅ ContFormato complete!`);
  } catch (e) { console.error(` ❌ Error in ContFormato:`, e.message); }

  console.log('Migrating OrigenCita (1 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [OrigenCita]');
    const cols = [{ name: 'Id', safeName: 'Id', type: 'int' }, { name: '_fechaReg', safeName: 'f_fechaReg', type: 'datetime' }, { name: 'OrigenExt', safeName: 'OrigenExt', type: 'nvarchar' }, { name: 'Descripcion', safeName: 'Descripcion', type: 'nvarchar' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('origencita', mapped);
    console.log(` ✅ OrigenCita complete!`);
  } catch (e) { console.error(` ❌ Error in OrigenCita:`, e.message); }

  console.log('Migrating GDPRProfiles (1 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [GDPRProfiles]');
    const cols = [{ name: 'Id', safeName: 'Id', type: 'int' }, { name: '_version', safeName: 'f_version', type: 'int' }, { name: '_fechaReg', safeName: 'f_fechaReg', type: 'datetime' }, { name: '_idUserReg', safeName: 'f_idUserReg', type: 'int' }, { name: '_fechaModif', safeName: 'f_fechaModif', type: 'datetime' }, { name: '_idUserModif', safeName: 'f_idUserModif', type: 'int' }, { name: 'Description', safeName: 'Description', type: 'nvarchar' }, { name: 'CodExt', safeName: 'CodExt', type: 'nvarchar' }, { name: 'LegalName', safeName: 'LegalName', type: 'nvarchar' }, { name: 'Address', safeName: 'Address', type: 'nvarchar' }, { name: 'CommercialName', safeName: 'CommercialName', type: 'nvarchar' }, { name: 'HealthURL', safeName: 'HealthURL', type: 'nvarchar' }, { name: 'GDPRURL', safeName: 'GDPRURL', type: 'nvarchar' }, { name: 'HCCWarn', safeName: 'HCCWarn', type: 'nvarchar' }, { name: 'ShowIC', safeName: 'ShowIC', type: 'bit' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('gdprprofiles', mapped);
    console.log(` ✅ GDPRProfiles complete!`);
  } catch (e) { console.error(` ❌ Error in GDPRProfiles:`, e.message); }

  console.log('Migrating Bancos (1 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [Bancos]');
    const cols = [{ name: 'IdBanco', safeName: 'IdBanco', type: 'int' }, { name: 'Descripcio', safeName: 'Descripcio', type: 'varchar' }, { name: 'IdPoblacio', safeName: 'IdPoblacio', type: 'int' }, { name: 'CP', safeName: 'CP', type: 'char' }, { name: 'Direccion', safeName: 'Direccion', type: 'varchar' }, { name: 'Tel1', safeName: 'Tel1', type: 'varchar' }, { name: 'Tel2', safeName: 'Tel2', type: 'varchar' }, { name: 'TelMovil', safeName: 'TelMovil', type: 'varchar' }, { name: 'Fax', safeName: 'Fax', type: 'varchar' }, { name: 'Email', safeName: 'Email', type: 'varchar' }, { name: 'Web', safeName: 'Web', type: 'varchar' }, { name: 'Notas', safeName: 'Notas', type: 'text' }, { name: 'Entidad', safeName: 'Entidad', type: 'char' }, { name: 'Oficina', safeName: 'Oficina', type: 'char' }, { name: 'DC', safeName: 'DC', type: 'char' }, { name: 'Cuenta', safeName: 'Cuenta', type: 'varchar' }, { name: 'Clinica', safeName: 'Clinica', type: 'bit' }, { name: 'SCCodSCta', safeName: 'SCCodSCta', type: 'varchar' }, { name: 'SCCodDept', safeName: 'SCCodDept', type: 'varchar' }, { name: 'SCCodProd', safeName: 'SCCodProd', type: 'varchar' }, { name: 'SCCodProy', safeName: 'SCCodProy', type: 'varchar' }, { name: 'IdCentro', safeName: 'IdCentro', type: 'int' }, { name: 'CodIBAN', safeName: 'CodIBAN', type: 'varchar' }, { name: 'CodBIC', safeName: 'CodBIC', type: 'varchar' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('bancos', mapped);
    console.log(` ✅ Bancos complete!`);
  } catch (e) { console.error(` ❌ Error in Bancos:`, e.message); }

  console.log('Migrating PlanEco (1 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [PlanEco]');
    const cols = [{ name: 'IdPac', safeName: 'IdPac', type: 'int' }, { name: 'NumPlan', safeName: 'NumPlan', type: 'int' }, { name: 'Titulo', safeName: 'Titulo', type: 'varchar' }, { name: 'Importe', safeName: 'Importe', type: 'float' }, { name: 'Entrada', safeName: 'Entrada', type: 'float' }, { name: 'Cuotas', safeName: 'Cuotas', type: 'tinyint' }, { name: 'CuotaImpor', safeName: 'CuotaImpor', type: 'float' }, { name: 'Periodo', safeName: 'Periodo', type: 'tinyint' }, { name: 'DiscoBanco', safeName: 'DiscoBanco', type: 'bit' }, { name: 'IdForPago', safeName: 'IdForPago', type: 'int' }, { name: 'IdEmisor', safeName: 'IdEmisor', type: 'int' }, { name: 'Serie', safeName: 'Serie', type: 'char' }, { name: 'IdBanco', safeName: 'IdBanco', type: 'int' }, { name: 'IdCol', safeName: 'IdCol', type: 'int' }, { name: 'GenerarDoc', safeName: 'GenerarDoc', type: 'char' }, { name: 'IdCli', safeName: 'IdCli', type: 'int' }, { name: 'FecEntrada', safeName: 'FecEntrada', type: 'smalldatetime' }, { name: 'FecInicio', safeName: 'FecInicio', type: 'smalldatetime' }, { name: 'FecActiva', safeName: 'FecActiva', type: 'smalldatetime' }, { name: 'Notas', safeName: 'Notas', type: 'text' }, { name: 'GenAdeudo', safeName: 'GenAdeudo', type: 'bit' }, { name: 'IdTto', safeName: 'IdTto', type: 'int' }, { name: 'Estado', safeName: 'Estado', type: 'int' }, { name: 'FirmadoSEPA', safeName: 'FirmadoSEPA', type: 'bit' }, { name: 'Id', safeName: 'Id', type: 'int' }, { name: '_version', safeName: 'f_version', type: 'int' }, { name: '_fechaReg', safeName: 'f_fechaReg', type: 'datetime' }, { name: '_idUserReg', safeName: 'f_idUserReg', type: 'int' }, { name: '_fechaModif', safeName: 'f_fechaModif', type: 'datetime' }, { name: '_idUserModif', safeName: 'f_idUserModif', type: 'int' }, { name: 'Id_TtoEntrada', safeName: 'Id_TtoEntrada', type: 'int' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('planeco', mapped);
    console.log(` ✅ PlanEco complete!`);
  } catch (e) { console.error(` ❌ Error in PlanEco:`, e.message); }

  console.log('Migrating TAuxTipoExpComp (1 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [TAuxTipoExpComp]');
    const cols = [{ name: 'IdTipoEC', safeName: 'IdTipoEC', type: 'int' }, { name: 'Descripcion', safeName: 'Descripcion', type: 'varchar' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('tauxtipoexpcomp', mapped);
    console.log(` ✅ TAuxTipoExpComp complete!`);
  } catch (e) { console.error(` ❌ Error in TAuxTipoExpComp:`, e.message); }

  console.log('Migrating GDPR_FTX_Fichas (1 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [GDPR_FTX_Fichas]');
    const cols = [{ name: 'Id', safeName: 'Id', type: 'int' }, { name: 'Titulo', safeName: 'Titulo', type: 'varchar' }, { name: 'TextoLegal', safeName: 'TextoLegal', type: 'text' }, { name: 'SQLInforme', safeName: 'SQLInforme', type: 'text' }, { name: '_version', safeName: 'f_version', type: 'int' }, { name: '_fechaReg', safeName: 'f_fechaReg', type: 'datetime' }, { name: '_idUserReg', safeName: 'f_idUserReg', type: 'int' }, { name: '_fechaModif', safeName: 'f_fechaModif', type: 'datetime' }, { name: '_idUserModif', safeName: 'f_idUserModif', type: 'int' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('gdprFtxFichas', mapped);
    console.log(` ✅ GDPR_FTX_Fichas complete!`);
  } catch (e) { console.error(` ❌ Error in GDPR_FTX_Fichas:`, e.message); }

  console.log('Migrating DCitasPeriod (1 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [DCitasPeriod]');
    const cols = [{ name: 'IdCitasP', safeName: 'IdCitasP', type: 'int' }, { name: 'IdUsu', safeName: 'IdUsu', type: 'int' }, { name: 'IdOpc', safeName: 'IdOpc', type: 'varchar' }, { name: 'FechaInicio', safeName: 'FechaInicio', type: 'datetime' }, { name: 'FechaFinal', safeName: 'FechaFinal', type: 'datetime' }, { name: 'Inactiva', safeName: 'Inactiva', type: 'bit' }, { name: 'Hora', safeName: 'Hora', type: 'int' }, { name: 'Duracion', safeName: 'Duracion', type: 'int' }, { name: 'Texto', safeName: 'Texto', type: 'varchar' }, { name: 'Contacto', safeName: 'Contacto', type: 'varchar' }, { name: 'Movil', safeName: 'Movil', type: 'varchar' }, { name: 'IdPac', safeName: 'IdPac', type: 'int' }, { name: 'IdBox', safeName: 'IdBox', type: 'int' }, { name: 'Box', safeName: 'Box', type: 'varchar' }, { name: 'Notas', safeName: 'Notas', type: 'text' }, { name: 'NumPac', safeName: 'NumPac', type: 'varchar' }, { name: 'FecAlta', safeName: 'FecAlta', type: 'smalldatetime' }, { name: 'Frecuencia', safeName: 'Frecuencia', type: 'int' }, { name: 'Periodicidad', safeName: 'Periodicidad', type: 'int' }, { name: 'DiaSem', safeName: 'DiaSem', type: 'varchar' }, { name: 'DiaMes', safeName: 'DiaMes', type: 'tinyint' }, { name: 'Mes', safeName: 'Mes', type: 'tinyint' }, { name: 'DCitasGrp', safeName: 'DCitasGrp', type: 'char' }, { name: 'CantIntegGrp', safeName: 'CantIntegGrp', type: 'int' }, { name: 'NumeroCitas', safeName: 'NumeroCitas', type: 'int' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('dcitasperiod', mapped);
    console.log(` ✅ DCitasPeriod complete!`);
  } catch (e) { console.error(` ❌ Error in DCitasPeriod:`, e.message); }

  console.log('Migrating TMotivoIncidencia (1 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [TMotivoIncidencia]');
    const cols = [{ name: 'IdMotivo', safeName: 'IdMotivo', type: 'int' }, { name: 'IdTipoIncidencia', safeName: 'IdTipoIncidencia', type: 'int' }, { name: 'Descripcio', safeName: 'Descripcio', type: 'varchar' }, { name: '_version', safeName: 'f_version', type: 'int' }, { name: '_fechaReg', safeName: 'f_fechaReg', type: 'datetime' }, { name: '_idUserReg', safeName: 'f_idUserReg', type: 'int' }, { name: '_fechaModif', safeName: 'f_fechaModif', type: 'datetime' }, { name: '_idUserModif', safeName: 'f_idUserModif', type: 'int' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('tmotivoincidencia', mapped);
    console.log(` ✅ TMotivoIncidencia complete!`);
  } catch (e) { console.error(` ❌ Error in TMotivoIncidencia:`, e.message); }

  console.log('Migrating Dispositivo (1 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [Dispositivo]');
    const cols = [{ name: 'IdDisp', safeName: 'IdDisp', type: 'int' }, { name: 'TipoDisp', safeName: 'TipoDisp', type: 'tinyint' }, { name: 'Descripcio', safeName: 'Descripcio', type: 'varchar' }, { name: 'GID', safeName: 'GID', type: 'varchar' }, { name: 'KeyDisp', safeName: 'KeyDisp', type: 'int' }, { name: 'IdPac', safeName: 'IdPac', type: 'int' }, { name: 'FecAsig', safeName: 'FecAsig', type: 'datetime' }, { name: 'IdCentro', safeName: 'IdCentro', type: 'int' }, { name: 'IdApp', safeName: 'IdApp', type: 'varchar' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('dispositivo', mapped);
    console.log(` ✅ Dispositivo complete!`);
  } catch (e) { console.error(` ❌ Error in Dispositivo:`, e.message); }

  console.log('Migrating TxtPrede (1 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [TxtPrede]');
    const cols = [{ name: 'IdTxt', safeName: 'IdTxt', type: 'int' }, { name: 'Texto', safeName: 'Texto', type: 'text' }, { name: 'TextoRich', safeName: 'TextoRich', type: 'text' }, { name: 'Tipo', safeName: 'Tipo', type: 'int' }, { name: 'Titulo', safeName: 'Titulo', type: 'varchar' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('txtprede', mapped);
    console.log(` ✅ TxtPrede complete!`);
  } catch (e) { console.error(` ❌ Error in TxtPrede:`, e.message); }

  console.log('Migrating TSubFams (1 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [TSubFams]');
    const cols = [{ name: 'IdFamilia', safeName: 'IdFamilia', type: 'int' }, { name: 'IdSubFamilia', safeName: 'IdSubFamilia', type: 'int' }, { name: 'Descripcio', safeName: 'Descripcio', type: 'varchar' }, { name: '_version', safeName: 'f_version', type: 'int' }, { name: '_fechaReg', safeName: 'f_fechaReg', type: 'datetime' }, { name: '_idUserReg', safeName: 'f_idUserReg', type: 'int' }, { name: '_fechaModif', safeName: 'f_fechaModif', type: 'datetime' }, { name: '_idUserModif', safeName: 'f_idUserModif', type: 'int' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('tsubfams', mapped);
    console.log(` ✅ TSubFams complete!`);
  } catch (e) { console.error(` ❌ Error in TSubFams:`, e.message); }

  console.log('Migrating TAlmacen (1 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [TAlmacen]');
    const cols = [{ name: 'IdAlmacen', safeName: 'IdAlmacen', type: 'int' }, { name: 'Descripcio', safeName: 'Descripcio', type: 'varchar' }, { name: 'IdCentro', safeName: 'IdCentro', type: 'int' }, { name: 'AceptaPedidos', safeName: 'AceptaPedidos', type: 'int' }, { name: 'Inventariable', safeName: 'Inventariable', type: 'int' }, { name: 'DeDeposito', safeName: 'DeDeposito', type: 'int' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('talmacen', mapped);
    console.log(` ✅ TAlmacen complete!`);
  } catch (e) { console.error(` ❌ Error in TAlmacen:`, e.message); }

  console.log('Migrating TPaises (1 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [TPaises]');
    const cols = [{ name: 'IdPais', safeName: 'IdPais', type: 'int' }, { name: 'Descripcio', safeName: 'Descripcio', type: 'varchar' }, { name: 'IsoAlfa2', safeName: 'IsoAlfa2', type: 'char' }, { name: 'IsoAlfa3', safeName: 'IsoAlfa3', type: 'char' }, { name: 'IsoNum3', safeName: 'IsoNum3', type: 'char' }, { name: '_version', safeName: 'f_version', type: 'int' }, { name: '_fechaReg', safeName: 'f_fechaReg', type: 'datetime' }, { name: '_idUserReg', safeName: 'f_idUserReg', type: 'int' }, { name: '_fechaModif', safeName: 'f_fechaModif', type: 'datetime' }, { name: '_idUserModif', safeName: 'f_idUserModif', type: 'int' }, { name: 'Normalizado', safeName: 'Normalizado', type: 'bit' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('tpaises', mapped);
    console.log(` ✅ TPaises complete!`);
  } catch (e) { console.error(` ❌ Error in TPaises:`, e.message); }

  console.log('Migrating AgrupacionesFormaPago (1 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [AgrupacionesFormaPago]');
    const cols = [{ name: 'Id', safeName: 'Id', type: 'int' }, { name: 'Descripcion', safeName: 'Descripcion', type: 'varchar' }, { name: '_version', safeName: 'f_version', type: 'int' }, { name: '_fechaReg', safeName: 'f_fechaReg', type: 'datetime' }, { name: '_idUserReg', safeName: 'f_idUserReg', type: 'int' }, { name: '_fechaModif', safeName: 'f_fechaModif', type: 'datetime' }, { name: '_idUserModif', safeName: 'f_idUserModif', type: 'int' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('agrupacionesformapago', mapped);
    console.log(` ✅ AgrupacionesFormaPago complete!`);
  } catch (e) { console.error(` ❌ Error in AgrupacionesFormaPago:`, e.message); }

  console.log('Migrating TTipoColab (1 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [TTipoColab]');
    const cols = [{ name: 'IdTipoColab', safeName: 'IdTipoColab', type: 'int' }, { name: 'Descripcio', safeName: 'Descripcio', type: 'varchar' }, { name: 'RolPpal', safeName: 'RolPpal', type: 'bit' }, { name: 'RolSec', safeName: 'RolSec', type: 'bit' }, { name: 'RolAux', safeName: 'RolAux', type: 'bit' }, { name: 'RolAlumno', safeName: 'RolAlumno', type: 'bit' }, { name: 'RolProfesor', safeName: 'RolProfesor', type: 'bit' }, { name: '_version', safeName: 'f_version', type: 'int' }, { name: '_fechaReg', safeName: 'f_fechaReg', type: 'datetime' }, { name: '_idUserReg', safeName: 'f_idUserReg', type: 'int' }, { name: '_fechaModif', safeName: 'f_fechaModif', type: 'datetime' }, { name: '_idUserModif', safeName: 'f_idUserModif', type: 'int' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('ttipocolab', mapped);
    console.log(` ✅ TTipoColab complete!`);
  } catch (e) { console.error(` ❌ Error in TTipoColab:`, e.message); }

  console.log('Migrating TPluggin (2 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [TPluggin]');
    const cols = [{ name: 'IdPluggin', safeName: 'IdPluggin', type: 'int' }, { name: 'Descripcio', safeName: 'Descripcio', type: 'varchar' }, { name: 'Fichero', safeName: 'Fichero', type: 'varchar' }, { name: 'TipoPlg', safeName: 'TipoPlg', type: 'varchar' }, { name: 'Area', safeName: 'Area', type: 'varchar' }, { name: 'Codigo', safeName: 'Codigo', type: 'varchar' }, { name: 'Version', safeName: 'Version', type: 'varchar' }, { name: 'FecAlta', safeName: 'FecAlta', type: 'smalldatetime' }, { name: 'Nombre_RTM', safeName: 'Nombre_RTM', type: 'varchar' }, { name: 'SQL_RTM', safeName: 'SQL_RTM', type: 'text' }, { name: 'Tabla', safeName: 'Tabla', type: 'varchar' }, { name: 'CampoFecha', safeName: 'CampoFecha', type: 'varchar' }, { name: 'Layout', safeName: 'Layout', type: 'int' }, { name: 'IdTipoEspec', safeName: 'IdTipoEspec', type: 'int' }, { name: 'PlazoValidez', safeName: 'PlazoValidez', type: 'int' }, { name: 'Estructura', safeName: 'Estructura', type: 'text' }, { name: 'Idioma', safeName: 'Idioma', type: 'varchar' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('tpluggin', mapped);
    console.log(` ✅ TPluggin complete!`);
  } catch (e) { console.error(` ❌ Error in TPluggin:`, e.message); }

  console.log('Migrating TReclamaPago (2 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [TReclamaPago]');
    const cols = [{ name: 'IdTipo', safeName: 'IdTipo', type: 'int' }, { name: 'Descripcio', safeName: 'Descripcio', type: 'varchar' }, { name: '_version', safeName: 'f_version', type: 'int' }, { name: '_fechaReg', safeName: 'f_fechaReg', type: 'datetime' }, { name: '_idUserReg', safeName: 'f_idUserReg', type: 'int' }, { name: '_fechaModif', safeName: 'f_fechaModif', type: 'datetime' }, { name: '_idUserModif', safeName: 'f_idUserModif', type: 'int' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('treclamapago', mapped);
    console.log(` ✅ TReclamaPago complete!`);
  } catch (e) { console.error(` ❌ Error in TReclamaPago:`, e.message); }

  console.log('Migrating TEstados (2 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [TEstados]');
    const cols = [{ name: 'IdEstado', safeName: 'IdEstado', type: 'int' }, { name: 'Descripcio', safeName: 'Descripcio', type: 'varchar' }, { name: 'EstadoFiliacion', safeName: 'EstadoFiliacion', type: 'int' }, { name: 'EstadoPizarra', safeName: 'EstadoPizarra', type: 'int' }, { name: '_version', safeName: 'f_version', type: 'int' }, { name: '_fechaReg', safeName: 'f_fechaReg', type: 'datetime' }, { name: '_idUserReg', safeName: 'f_idUserReg', type: 'int' }, { name: '_fechaModif', safeName: 'f_fechaModif', type: 'datetime' }, { name: '_idUserModif', safeName: 'f_idUserModif', type: 'int' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('testados', mapped);
    console.log(` ✅ TEstados complete!`);
  } catch (e) { console.error(` ❌ Error in TEstados:`, e.message); }

  console.log('Migrating TGrpColab (2 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [TGrpColab]');
    const cols = [{ name: 'IdGrpColab', safeName: 'IdGrpColab', type: 'int' }, { name: 'Descripcio', safeName: 'Descripcio', type: 'varchar' }, { name: '_version', safeName: 'f_version', type: 'int' }, { name: '_fechaReg', safeName: 'f_fechaReg', type: 'datetime' }, { name: '_idUserReg', safeName: 'f_idUserReg', type: 'int' }, { name: '_fechaModif', safeName: 'f_fechaModif', type: 'datetime' }, { name: '_idUserModif', safeName: 'f_idUserModif', type: 'int' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('tgrpcolab', mapped);
    console.log(` ✅ TGrpColab complete!`);
  } catch (e) { console.error(` ❌ Error in TGrpColab:`, e.message); }

  console.log('Migrating Emisores (2 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [Emisores]');
    const cols = [{ name: 'IdEmisor', safeName: 'IdEmisor', type: 'int' }, { name: 'Descripcio', safeName: 'Descripcio', type: 'varchar' }, { name: 'SubNombre1', safeName: 'SubNombre1', type: 'varchar' }, { name: 'SubNombre2', safeName: 'SubNombre2', type: 'varchar' }, { name: 'Serie', safeName: 'Serie', type: 'char' }, { name: 'Direccion', safeName: 'Direccion', type: 'varchar' }, { name: 'IdPoblacio', safeName: 'IdPoblacio', type: 'int' }, { name: 'CP', safeName: 'CP', type: 'char' }, { name: 'Tel1', safeName: 'Tel1', type: 'varchar' }, { name: 'Tel2', safeName: 'Tel2', type: 'varchar' }, { name: 'TelMovil', safeName: 'TelMovil', type: 'varchar' }, { name: 'Fax', safeName: 'Fax', type: 'varchar' }, { name: 'Email', safeName: 'Email', type: 'varchar' }, { name: 'Web', safeName: 'Web', type: 'varchar' }, { name: 'NIF', safeName: 'NIF', type: 'char' }, { name: 'SerieAF', safeName: 'SerieAF', type: 'char' }, { name: 'SerieR', safeName: 'SerieR', type: 'char' }, { name: 'SerieAR', safeName: 'SerieAR', type: 'char' }, { name: 'IdCol', safeName: 'IdCol', type: 'int' }, { name: 'IdCentro', safeName: 'IdCentro', type: 'int' }, { name: 'CodSubCta', safeName: 'CodSubCta', type: 'varchar' }, { name: '_version', safeName: 'f_version', type: 'int' }, { name: '_fechaReg', safeName: 'f_fechaReg', type: 'datetime' }, { name: '_idUserReg', safeName: 'f_idUserReg', type: 'int' }, { name: '_fechaModif', safeName: 'f_fechaModif', type: 'datetime' }, { name: '_idUserModif', safeName: 'f_idUserModif', type: 'int' }, { name: 'SerieFRect', safeName: 'SerieFRect', type: 'char' }, { name: 'SerieAFRect', safeName: 'SerieAFRect', type: 'char' }, { name: 'TipoDocIdent', safeName: 'TipoDocIdent', type: 'int' }, { name: 'IdPaisIdent', safeName: 'IdPaisIdent', type: 'int' }, { name: 'TipoEntidad', safeName: 'TipoEntidad', type: 'int' }, { name: 'Inactivo', safeName: 'Inactivo', type: 'datetime' }, { name: 'Capital_Social', safeName: 'Capital_Social', type: 'varchar' }, { name: 'IBAN', safeName: 'IBAN', type: 'varchar' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('emisores', mapped);
    console.log(` ✅ Emisores complete!`);
  } catch (e) { console.error(` ❌ Error in Emisores:`, e.message); }

  console.log('Migrating Centros_TUsers_S1_Roles (3 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [Centros_TUsers_S1_Roles]');
    const cols = [{ name: 'Id', safeName: 'Id', type: 'int' }, { name: 'Guid_Centro', safeName: 'Guid_Centro', type: 'uniqueidentifier' }, { name: 'Guid_Usuario', safeName: 'Guid_Usuario', type: 'uniqueidentifier' }, { name: 'Guid_Rol', safeName: 'Guid_Rol', type: 'uniqueidentifier' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('centrosTusersS1Roles', mapped);
    console.log(` ✅ Centros_TUsers_S1_Roles complete!`);
  } catch (e) { console.error(` ❌ Error in Centros_TUsers_S1_Roles:`, e.message); }

  console.log('Migrating EdGrupos (3 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [EdGrupos]');
    const cols = [{ name: 'IdGrupo', safeName: 'IdGrupo', type: 'int' }, { name: 'Titulo', safeName: 'Titulo', type: 'varchar' }, { name: 'IdCentro', safeName: 'IdCentro', type: 'int' }, { name: 'Id', safeName: 'Id', type: 'int' }, { name: '_idUserReg', safeName: 'f_idUserReg', type: 'int' }, { name: '_fechaReg', safeName: 'f_fechaReg', type: 'datetime' }, { name: '_idUserModif', safeName: 'f_idUserModif', type: 'int' }, { name: '_fechaModif', safeName: 'f_fechaModif', type: 'datetime' }, { name: '_version', safeName: 'f_version', type: 'int' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('edgrupos', mapped);
    console.log(` ✅ EdGrupos complete!`);
  } catch (e) { console.error(` ❌ Error in EdGrupos:`, e.message); }

  console.log('Migrating TipoOrtoCasos_Intervenciones (3 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [TipoOrtoCasos_Intervenciones]');
    const cols = [{ name: 'Id', safeName: 'Id', type: 'int' }, { name: 'Descripcion', safeName: 'Descripcion', type: 'varchar' }, { name: '_version', safeName: 'f_version', type: 'int' }, { name: '_fechaReg', safeName: 'f_fechaReg', type: 'datetime' }, { name: '_idUserReg', safeName: 'f_idUserReg', type: 'int' }, { name: '_fechaModif', safeName: 'f_fechaModif', type: 'datetime' }, { name: '_idUserModif', safeName: 'f_idUserModif', type: 'int' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('tipoortocasosIntervenciones', mapped);
    console.log(` ✅ TipoOrtoCasos_Intervenciones complete!`);
  } catch (e) { console.error(` ❌ Error in TipoOrtoCasos_Intervenciones:`, e.message); }

  console.log('Migrating Centros (3 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [Centros]');
    const cols = [{ name: 'IdCentro', safeName: 'IdCentro', type: 'int' }, { name: 'CodCentro', safeName: 'CodCentro', type: 'varchar' }, { name: 'Descripcio', safeName: 'Descripcio', type: 'varchar' }, { name: 'Direccion', safeName: 'Direccion', type: 'varchar' }, { name: 'IdPoblacio', safeName: 'IdPoblacio', type: 'int' }, { name: 'CP', safeName: 'CP', type: 'char' }, { name: 'Tel1', safeName: 'Tel1', type: 'varchar' }, { name: 'Tel2', safeName: 'Tel2', type: 'varchar' }, { name: 'Fax', safeName: 'Fax', type: 'varchar' }, { name: 'Email', safeName: 'Email', type: 'varchar' }, { name: 'Web', safeName: 'Web', type: 'varchar' }, { name: 'CIF', safeName: 'CIF', type: 'char' }, { name: 'Fecha_Corte', safeName: 'Fecha_Corte', type: 'smalldatetime' }, { name: 'CodSerie', safeName: 'CodSerie', type: 'varchar' }, { name: 'ExpConta', safeName: 'ExpConta', type: 'int' }, { name: 'Delegacion', safeName: 'Delegacion', type: 'varchar' }, { name: 'DescCorta', safeName: 'DescCorta', type: 'varchar' }, { name: 'Comodin1', safeName: 'Comodin1', type: 'varchar' }, { name: 'Comodin2', safeName: 'Comodin2', type: 'varchar' }, { name: 'Comodin3', safeName: 'Comodin3', type: 'varchar' }, { name: 'Comodin4', safeName: 'Comodin4', type: 'varchar' }, { name: 'Comodin5', safeName: 'Comodin5', type: 'varchar' }, { name: 'Comodin6', safeName: 'Comodin6', type: 'varchar' }, { name: 'RutaFichMutuas', safeName: 'RutaFichMutuas', type: 'varchar' }, { name: 'IdClasificacionCentro', safeName: 'IdClasificacionCentro', type: 'int' }, { name: 'CodigoEmpresaPedidos', safeName: 'CodigoEmpresaPedidos', type: 'varchar' }, { name: 'RutFichPedidos', safeName: 'RutFichPedidos', type: 'varchar' }, { name: '_version', safeName: 'f_version', type: 'int' }, { name: '_fechaReg', safeName: 'f_fechaReg', type: 'datetime' }, { name: '_idUserReg', safeName: 'f_idUserReg', type: 'int' }, { name: '_fechaModif', safeName: 'f_fechaModif', type: 'datetime' }, { name: '_idUserModif', safeName: 'f_idUserModif', type: 'int' }, { name: 'AOAgdGUID', safeName: 'AOAgdGUID', type: 'varchar' }, { name: 'ActivacionLiqTrabajosProtesis', safeName: 'ActivacionLiqTrabajosProtesis', type: 'datetime' }, { name: 'Guid', safeName: 'Guid', type: 'uniqueidentifier' }, { name: 'TipoDocIdent', safeName: 'TipoDocIdent', type: 'int' }, { name: 'Id_GDPRProfile', safeName: 'Id_GDPRProfile', type: 'int' }, { name: 'Id_UserDirector', safeName: 'Id_UserDirector', type: 'int' }, { name: 'Gestionable', safeName: 'Gestionable', type: 'int' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('centros', mapped);
    console.log(` ✅ Centros complete!`);
  } catch (e) { console.error(` ❌ Error in Centros:`, e.message); }

  console.log('Migrating PacMensajes (4 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [PacMensajes]');
    const cols = [{ name: 'IdMsg', safeName: 'IdMsg', type: 'int' }, { name: 'IdPac', safeName: 'IdPac', type: 'int' }, { name: 'FechaHoraCreacion', safeName: 'FechaHoraCreacion', type: 'datetime' }, { name: 'IdUsuDe', safeName: 'IdUsuDe', type: 'int' }, { name: 'Mensaje', safeName: 'Mensaje', type: 'text' }, { name: 'Leido', safeName: 'Leido', type: 'char' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('pacmensajes', mapped);
    console.log(` ✅ PacMensajes complete!`);
  } catch (e) { console.error(` ❌ Error in PacMensajes:`, e.message); }

  console.log('Migrating ATMT_Protocolos (4 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [ATMT_Protocolos]');
    const cols = [{ name: 'Id', safeName: 'Id', type: 'int' }, { name: 'Nombre', safeName: 'Nombre', type: 'varchar' }, { name: '_fechaReg', safeName: 'f_fechaReg', type: 'datetime' }, { name: '_idUserReg', safeName: 'f_idUserReg', type: 'int' }, { name: '_fechaModif', safeName: 'f_fechaModif', type: 'datetime' }, { name: '_idUserModif', safeName: 'f_idUserModif', type: 'int' }, { name: '_version', safeName: 'f_version', type: 'int' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('atmtProtocolos', mapped);
    console.log(` ✅ ATMT_Protocolos complete!`);
  } catch (e) { console.error(` ❌ Error in ATMT_Protocolos:`, e.message); }

  console.log('Migrating GDPR_FTX_Fichas_Consentimientos (4 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [GDPR_FTX_Fichas_Consentimientos]');
    const cols = [{ name: 'Id', safeName: 'Id', type: 'int' }, { name: 'IdFicha', safeName: 'IdFicha', type: 'int' }, { name: 'IdConsentimiento', safeName: 'IdConsentimiento', type: 'int' }, { name: 'Orden', safeName: 'Orden', type: 'int' }, { name: '_version', safeName: 'f_version', type: 'int' }, { name: '_fechaReg', safeName: 'f_fechaReg', type: 'datetime' }, { name: '_idUserReg', safeName: 'f_idUserReg', type: 'int' }, { name: '_fechaModif', safeName: 'f_fechaModif', type: 'datetime' }, { name: '_idUserModif', safeName: 'f_idUserModif', type: 'int' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('gdprFtxFichasConsentimientos', mapped);
    console.log(` ✅ GDPR_FTX_Fichas_Consentimientos complete!`);
  } catch (e) { console.error(` ❌ Error in GDPR_FTX_Fichas_Consentimientos:`, e.message); }

  console.log('Migrating TipoControlRecall (4 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [TipoControlRecall]');
    const cols = [{ name: 'IdTipoControlRecall', safeName: 'IdTipoControlRecall', type: 'int' }, { name: 'Descripcion', safeName: 'Descripcion', type: 'varchar' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('tipocontrolrecall', mapped);
    console.log(` ✅ TipoControlRecall complete!`);
  } catch (e) { console.error(` ❌ Error in TipoControlRecall:`, e.message); }

  console.log('Migrating TECivil (4 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [TECivil]');
    const cols = [{ name: 'IdECivil', safeName: 'IdECivil', type: 'int' }, { name: 'Descripcio', safeName: 'Descripcio', type: 'varchar' }, { name: '_version', safeName: 'f_version', type: 'int' }, { name: '_fechaReg', safeName: 'f_fechaReg', type: 'datetime' }, { name: '_idUserReg', safeName: 'f_idUserReg', type: 'int' }, { name: '_fechaModif', safeName: 'f_fechaModif', type: 'datetime' }, { name: '_idUserModif', safeName: 'f_idUserModif', type: 'int' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('tecivil', mapped);
    console.log(` ✅ TECivil complete!`);
  } catch (e) { console.error(` ❌ Error in TECivil:`, e.message); }

  console.log('Migrating TRRecall (4 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [TRRecall]');
    const cols = [{ name: 'IdTRRecall', safeName: 'IdTRRecall', type: 'int' }, { name: 'Descripcion', safeName: 'Descripcion', type: 'varchar' }, { name: 'RealizarRecall', safeName: 'RealizarRecall', type: 'bit' }, { name: 'IdTipoAccion', safeName: 'IdTipoAccion', type: 'int' }, { name: 'Inactivo', safeName: 'Inactivo', type: 'datetime' }, { name: 'ParaTodosMotivos', safeName: 'ParaTodosMotivos', type: 'bit' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('trrecall', mapped);
    console.log(` ✅ TRRecall complete!`);
  } catch (e) { console.error(` ❌ Error in TRRecall:`, e.message); }

  console.log('Migrating GDPR_FTX_Consentimientos (4 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [GDPR_FTX_Consentimientos]');
    const cols = [{ name: 'Id', safeName: 'Id', type: 'int' }, { name: 'Descripcion', safeName: 'Descripcion', type: 'varchar' }, { name: 'TextoAyuda', safeName: 'TextoAyuda', type: 'varchar' }, { name: '_version', safeName: 'f_version', type: 'int' }, { name: '_fechaReg', safeName: 'f_fechaReg', type: 'datetime' }, { name: '_idUserReg', safeName: 'f_idUserReg', type: 'int' }, { name: '_fechaModif', safeName: 'f_fechaModif', type: 'datetime' }, { name: '_idUserModif', safeName: 'f_idUserModif', type: 'int' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('gdprFtxConsentimientos', mapped);
    console.log(` ✅ GDPR_FTX_Consentimientos complete!`);
  } catch (e) { console.error(` ❌ Error in GDPR_FTX_Consentimientos:`, e.message); }

  console.log('Migrating Tarifas (4 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [Tarifas]');
    const cols = [{ name: 'IdTarifa', safeName: 'IdTarifa', type: 'int' }, { name: 'Codigo', safeName: 'Codigo', type: 'varchar' }, { name: 'Descripcion', safeName: 'Descripcion', type: 'varchar' }, { name: 'Notas', safeName: 'Notas', type: 'text' }, { name: 'Sistema', safeName: 'Sistema', type: 'varchar' }, { name: 'CodCli', safeName: 'CodCli', type: 'varchar' }, { name: 'DiasCaducidad', safeName: 'DiasCaducidad', type: 'int' }, { name: 'IdCli', safeName: 'IdCli', type: 'int' }, { name: 'IdTarifaBase', safeName: 'IdTarifaBase', type: 'int' }, { name: 'IdTarifaComparativa', safeName: 'IdTarifaComparativa', type: 'int' }, { name: 'IdTipoTarifa', safeName: 'IdTipoTarifa', type: 'int' }, { name: 'IdFamiliaTarifa', safeName: 'IdFamiliaTarifa', type: 'int' }, { name: 'Inactivo', safeName: 'Inactivo', type: 'datetime' }, { name: '_fechareg', safeName: 'f_fechareg', type: 'datetime' }, { name: '_version', safeName: 'f_version', type: 'int' }, { name: 'LiqInmediata', safeName: 'LiqInmediata', type: 'bit' }, { name: 'RequiereValidacion', safeName: 'RequiereValidacion', type: 'bit' }, { name: 'TipoValidacion', safeName: 'TipoValidacion', type: 'int' }, { name: 'IdGestionTarifa', safeName: 'IdGestionTarifa', type: 'int' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('tarifas', mapped);
    console.log(` ✅ Tarifas complete!`);
  } catch (e) { console.error(` ❌ Error in Tarifas:`, e.message); }

  console.log('Migrating Centros_Tarifas (4 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [Centros_Tarifas]');
    const cols = [{ name: 'IdCentroTarifa', safeName: 'IdCentroTarifa', type: 'int' }, { name: 'IdCentro', safeName: 'IdCentro', type: 'int' }, { name: 'IdTarifa', safeName: 'IdTarifa', type: 'int' }, { name: 'Inactivo', safeName: 'Inactivo', type: 'datetime' }, { name: 'Desde', safeName: 'Desde', type: 'datetime' }, { name: 'Hasta', safeName: 'Hasta', type: 'datetime' }, { name: '_fechareg', safeName: 'f_fechareg', type: 'datetime' }, { name: '_version', safeName: 'f_version', type: 'int' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }, { name: '_idUserReg', safeName: 'f_idUserReg', type: 'int' }, { name: '_fechaModif', safeName: 'f_fechaModif', type: 'datetime' }, { name: '_idUserModif', safeName: 'f_idUserModif', type: 'int' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('centrosTarifas', mapped);
    console.log(` ✅ Centros_Tarifas complete!`);
  } catch (e) { console.error(` ❌ Error in Centros_Tarifas:`, e.message); }

  console.log('Migrating DCitasTto (4 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [DCitasTto]');
    const cols = [{ name: 'IdCitasTto', safeName: 'IdCitasTto', type: 'int' }, { name: 'IdUsu', safeName: 'IdUsu', type: 'int' }, { name: 'IdOrden', safeName: 'IdOrden', type: 'int' }, { name: 'IdentTM', safeName: 'IdentTM', type: 'int' }, { name: 'IdTto', safeName: 'IdTto', type: 'int' }, { name: 'IdTipoOdg', safeName: 'IdTipoOdg', type: 'int' }, { name: 'Realizado', safeName: 'Realizado', type: 'char' }, { name: '_fechareg', safeName: 'f_fechareg', type: 'smalldatetime' }, { name: 'IdCol', safeName: 'IdCol', type: 'int' }, { name: 'IdProced', safeName: 'IdProced', type: 'int' }, { name: 'IdRef', safeName: 'IdRef', type: 'int' }, { name: 'Notas', safeName: 'Notas', type: 'text' }, { name: 'Duracion', safeName: 'Duracion', type: 'int' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('dcitastto', mapped);
    console.log(` ✅ DCitasTto complete!`);
  } catch (e) { console.error(` ❌ Error in DCitasTto:`, e.message); }

  console.log('Migrating TTipoParametros (4 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [TTipoParametros]');
    const cols = [{ name: 'IdTipoParam', safeName: 'IdTipoParam', type: 'int' }, { name: 'Descripcio', safeName: 'Descripcio', type: 'varchar' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('ttipoparametros', mapped);
    console.log(` ✅ TTipoParametros complete!`);
  } catch (e) { console.error(` ❌ Error in TTipoParametros:`, e.message); }

  console.log('Migrating TipoOrtoCasos_EstadosCaso (4 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [TipoOrtoCasos_EstadosCaso]');
    const cols = [{ name: 'Id', safeName: 'Id', type: 'int' }, { name: 'Descripcion', safeName: 'Descripcion', type: 'varchar' }, { name: 'Posicion', safeName: 'Posicion', type: 'int' }, { name: 'Inactivo', safeName: 'Inactivo', type: 'datetime' }, { name: '_version', safeName: 'f_version', type: 'int' }, { name: '_fechaReg', safeName: 'f_fechaReg', type: 'datetime' }, { name: '_idUserReg', safeName: 'f_idUserReg', type: 'int' }, { name: '_fechaModif', safeName: 'f_fechaModif', type: 'datetime' }, { name: '_idUserModif', safeName: 'f_idUserModif', type: 'int' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('tipoortocasosEstadoscaso', mapped);
    console.log(` ✅ TipoOrtoCasos_EstadosCaso complete!`);
  } catch (e) { console.error(` ❌ Error in TipoOrtoCasos_EstadosCaso:`, e.message); }

  console.log('Migrating TipoOrtoCasos_ConceptosHigiene (5 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [TipoOrtoCasos_ConceptosHigiene]');
    const cols = [{ name: 'Id', safeName: 'Id', type: 'int' }, { name: 'Codigo', safeName: 'Codigo', type: 'varchar' }, { name: 'Descripcion', safeName: 'Descripcion', type: 'varchar' }, { name: 'Posicion', safeName: 'Posicion', type: 'int' }, { name: 'Valoracion', safeName: 'Valoracion', type: 'int' }, { name: 'Inactivo', safeName: 'Inactivo', type: 'datetime' }, { name: '_version', safeName: 'f_version', type: 'int' }, { name: '_fechaReg', safeName: 'f_fechaReg', type: 'datetime' }, { name: '_idUserReg', safeName: 'f_idUserReg', type: 'int' }, { name: '_fechaModif', safeName: 'f_fechaModif', type: 'datetime' }, { name: '_idUserModif', safeName: 'f_idUserModif', type: 'int' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('tipoortocasosConceptoshigiene', mapped);
    console.log(` ✅ TipoOrtoCasos_ConceptosHigiene complete!`);
  } catch (e) { console.error(` ❌ Error in TipoOrtoCasos_ConceptosHigiene:`, e.message); }

  console.log('Migrating TipoOrtoCasos_ConceptosColaboracion (5 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [TipoOrtoCasos_ConceptosColaboracion]');
    const cols = [{ name: 'Id', safeName: 'Id', type: 'int' }, { name: 'Codigo', safeName: 'Codigo', type: 'varchar' }, { name: 'Descripcion', safeName: 'Descripcion', type: 'varchar' }, { name: 'Posicion', safeName: 'Posicion', type: 'int' }, { name: 'Valoracion', safeName: 'Valoracion', type: 'int' }, { name: 'Inactivo', safeName: 'Inactivo', type: 'datetime' }, { name: '_version', safeName: 'f_version', type: 'int' }, { name: '_fechaReg', safeName: 'f_fechaReg', type: 'datetime' }, { name: '_idUserReg', safeName: 'f_idUserReg', type: 'int' }, { name: '_fechaModif', safeName: 'f_fechaModif', type: 'datetime' }, { name: '_idUserModif', safeName: 'f_idUserModif', type: 'int' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('tipoortocasosConceptoscolaboracion', mapped);
    console.log(` ✅ TipoOrtoCasos_ConceptosColaboracion complete!`);
  } catch (e) { console.error(` ❌ Error in TipoOrtoCasos_ConceptosColaboracion:`, e.message); }

  console.log('Migrating SeriesOficiales (5 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [SeriesOficiales]');
    const cols = [{ name: 'IdSerieOficial', safeName: 'IdSerieOficial', type: 'int' }, { name: 'SerieOficial', safeName: 'SerieOficial', type: 'varchar' }, { name: 'Descripcion', safeName: 'Descripcion', type: 'varchar' }, { name: 'Formato', safeName: 'Formato', type: 'varchar' }, { name: 'IdCentro', safeName: 'IdCentro', type: 'int' }, { name: 'TipoSerie', safeName: 'TipoSerie', type: 'int' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('seriesoficiales', mapped);
    console.log(` ✅ SeriesOficiales complete!`);
  } catch (e) { console.error(` ❌ Error in SeriesOficiales:`, e.message); }

  console.log('Migrating Centros_Conectores (6 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [Centros_Conectores]');
    const cols = [{ name: 'Id', safeName: 'Id', type: 'int' }, { name: 'IdCentro', safeName: 'IdCentro', type: 'int' }, { name: 'IdCentroConector', safeName: 'IdCentroConector', type: 'varchar' }, { name: 'IdConector', safeName: 'IdConector', type: 'int' }, { name: 'IdUser', safeName: 'IdUser', type: 'int' }, { name: '_fechareg', safeName: 'f_fechareg', type: 'datetime' }, { name: '_fechamod', safeName: 'f_fechamod', type: 'datetime' }, { name: 'Inactivo', safeName: 'Inactivo', type: 'datetime' }, { name: 'Comodin', safeName: 'Comodin', type: 'varchar' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('centrosConectores', mapped);
    console.log(` ✅ Centros_Conectores complete!`);
  } catch (e) { console.error(` ❌ Error in Centros_Conectores:`, e.message); }

  console.log('Migrating Desktops (6 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [Desktops]');
    const cols = [{ name: 'Id', safeName: 'Id', type: 'int' }, { name: '_version', safeName: 'f_version', type: 'int' }, { name: '_fechaReg', safeName: 'f_fechaReg', type: 'datetime' }, { name: '_idUserReg', safeName: 'f_idUserReg', type: 'int' }, { name: '_fechaModif', safeName: 'f_fechaModif', type: 'datetime' }, { name: '_idUserModif', safeName: 'f_idUserModif', type: 'int' }, { name: 'JsonProperties', safeName: 'JsonProperties', type: 'ntext' }, { name: 'JsonVersion', safeName: 'JsonVersion', type: 'int' }, { name: 'ExternalId', safeName: 'ExternalId', type: 'uniqueidentifier' }, { name: 'Custom', safeName: 'Custom', type: 'bit' }, { name: 'Description', safeName: 'Description', type: 'nvarchar' }, { name: 'Orden', safeName: 'Orden', type: 'int' }, { name: 'Restorable', safeName: 'Restorable', type: 'bit' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('desktops', mapped);
    console.log(` ✅ Desktops complete!`);
  } catch (e) { console.error(` ❌ Error in Desktops:`, e.message); }

  console.log('Migrating TiposPresupuestos (6 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [TiposPresupuestos]');
    const cols = [{ name: 'IdTipoPresupuesto', safeName: 'IdTipoPresupuesto', type: 'int' }, { name: 'Descripcion', safeName: 'Descripcion', type: 'varchar' }, { name: 'IdTipoEspec', safeName: 'IdTipoEspec', type: 'int' }, { name: '_fechareg', safeName: 'f_fechareg', type: 'datetime' }, { name: '_version', safeName: 'f_version', type: 'int' }, { name: 'LiqEnCurso', safeName: 'LiqEnCurso', type: 'bit' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('tipospresupuestos', mapped);
    console.log(` ✅ TiposPresupuestos complete!`);
  } catch (e) { console.error(` ❌ Error in TiposPresupuestos:`, e.message); }

  console.log('Migrating PlanEcoL (6 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [PlanEcoL]');
    const cols = [{ name: 'IdPac', safeName: 'IdPac', type: 'int' }, { name: 'NumPlan', safeName: 'NumPlan', type: 'int' }, { name: 'NumCuota', safeName: 'NumCuota', type: 'tinyint' }, { name: 'FecAdeudo', safeName: 'FecAdeudo', type: 'smalldatetime' }, { name: 'FecPago', safeName: 'FecPago', type: 'smalldatetime' }, { name: 'Importe', safeName: 'Importe', type: 'float' }, { name: 'Id', safeName: 'Id', type: 'int' }, { name: '_version', safeName: 'f_version', type: 'int' }, { name: '_fechaReg', safeName: 'f_fechaReg', type: 'datetime' }, { name: '_idUserReg', safeName: 'f_idUserReg', type: 'int' }, { name: '_fechaModif', safeName: 'f_fechaModif', type: 'datetime' }, { name: '_idUserModif', safeName: 'f_idUserModif', type: 'int' }, { name: 'Id_PlanEco', safeName: 'Id_PlanEco', type: 'int' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('planecol', mapped);
    console.log(` ✅ PlanEcoL complete!`);
  } catch (e) { console.error(` ❌ Error in PlanEcoL:`, e.message); }

  console.log('Migrating TUsuAOpcTtosSugeridos (6 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [TUsuAOpcTtosSugeridos]');
    const cols = [{ name: 'Id', safeName: 'Id', type: 'int' }, { name: 'IdOpc', safeName: 'IdOpc', type: 'varchar' }, { name: 'IdTratamiento', safeName: 'IdTratamiento', type: 'int' }, { name: '_version', safeName: 'f_version', type: 'int' }, { name: '_fechaReg', safeName: 'f_fechaReg', type: 'datetime' }, { name: '_idUserReg', safeName: 'f_idUserReg', type: 'int' }, { name: '_fechaModif', safeName: 'f_fechaModif', type: 'datetime' }, { name: '_idUserModif', safeName: 'f_idUserModif', type: 'int' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('tusuaopcttossugeridos', mapped);
    console.log(` ✅ TUsuAOpcTtosSugeridos complete!`);
  } catch (e) { console.error(` ❌ Error in TUsuAOpcTtosSugeridos:`, e.message); }

  console.log('Migrating Contadores (7 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [Contadores]');
    const cols = [{ name: 'Tabla', safeName: 'Tabla', type: 'char' }, { name: 'Valor', safeName: 'Valor', type: 'int' }, { name: 'Ciclico', safeName: 'Ciclico', type: 'char' }, { name: 'MinValor', safeName: 'MinValor', type: 'int' }, { name: 'MaxValor', safeName: 'MaxValor', type: 'int' }, { name: 'MaxAviso', safeName: 'MaxAviso', type: 'int' }, { name: 'IdCentro', safeName: 'IdCentro', type: 'int' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('contadores', mapped);
    console.log(` ✅ Contadores complete!`);
  } catch (e) { console.error(` ❌ Error in Contadores:`, e.message); }

  console.log('Migrating TransaccionTratamiento (7 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [TransaccionTratamiento]');
    const cols = [{ name: 'Id', safeName: 'Id', type: 'int' }, { name: 'IdPac', safeName: 'IdPac', type: 'int' }, { name: 'IdCli', safeName: 'IdCli', type: 'int' }, { name: 'IdCentro', safeName: 'IdCentro', type: 'int' }, { name: 'IdEstado', safeName: 'IdEstado', type: 'int' }, { name: '_fechaReg', safeName: 'f_fechaReg', type: 'datetime' }, { name: '_idUserReg', safeName: 'f_idUserReg', type: 'int' }, { name: '_fechaModif', safeName: 'f_fechaModif', type: 'datetime' }, { name: '_idUserModif', safeName: 'f_idUserModif', type: 'int' }, { name: '_version', safeName: 'f_version', type: 'int' }, { name: 'IdMotivoAnulacion', safeName: 'IdMotivoAnulacion', type: 'int' }, { name: 'ObsMotivoAnulacion', safeName: 'ObsMotivoAnulacion', type: 'varchar' }, { name: 'NumBoleta', safeName: 'NumBoleta', type: 'int' }, { name: 'IdTarifa', safeName: 'IdTarifa', type: 'int' }, { name: 'IdCol', safeName: 'IdCol', type: 'int' }, { name: 'Importe', safeName: 'Importe', type: 'numeric' }, { name: 'Devuelto', safeName: 'Devuelto', type: 'numeric' }, { name: 'IdCCDiagnostico', safeName: 'IdCCDiagnostico', type: 'int' }, { name: 'Id_UserAutorizaAnulacion', safeName: 'Id_UserAutorizaAnulacion', type: 'int' }, { name: 'FechaLimiteAnulacion', safeName: 'FechaLimiteAnulacion', type: 'datetime' }, { name: 'NumBoletaAfecta', safeName: 'NumBoletaAfecta', type: 'int' }, { name: 'TipoTransaccion', safeName: 'TipoTransaccion', type: 'int' }, { name: 'IdForPago', safeName: 'IdForPago', type: 'int' }, { name: 'NumReferencia', safeName: 'NumReferencia', type: 'varchar' }, { name: 'TransaccionOrderId', safeName: 'TransaccionOrderId', type: 'varchar' }, { name: 'AuthNumber_OLD', safeName: 'AuthNumber_OLD', type: 'varchar' }, { name: 'Currency', safeName: 'Currency', type: 'varchar' }, { name: 'Metadata_OLD', safeName: 'Metadata_OLD', type: 'text' }, { name: 'Timestamp_OLD', safeName: 'Timestamp_OLD', type: 'varchar' }, { name: 'PayerReference_OLD', safeName: 'PayerReference_OLD', type: 'varchar' }, { name: 'CardReference_OLD', safeName: 'CardReference_OLD', type: 'varchar' }, { name: 'AmountDCC_OLD', safeName: 'AmountDCC_OLD', type: 'varchar' }, { name: 'CurrencyDCC_OLD', safeName: 'CurrencyDCC_OLD', type: 'varchar' }, { name: 'Exchange_OLD', safeName: 'Exchange_OLD', type: 'numeric' }, { name: 'ResponseCode', safeName: 'ResponseCode', type: 'varchar' }, { name: 'ResponseStatus', safeName: 'ResponseStatus', type: 'varchar' }, { name: 'paymentMethod', safeName: 'paymentMethod', type: 'varchar' }, { name: 'merchantParameters', safeName: 'merchantParameters', type: 'varchar' }, { name: 'paymentProductId', safeName: 'paymentProductId', type: 'varchar' }, { name: 'fraudServiceResult', safeName: 'fraudServiceResult', type: 'varchar' }, { name: 'payment_id', safeName: 'payment_id', type: 'varchar' }, { name: 'payment_status', safeName: 'payment_status', type: 'varchar' }, { name: 'statusCategory', safeName: 'statusCategory', type: 'varchar' }, { name: 'statusCode', safeName: 'statusCode', type: 'int' }, { name: 'isCancellable', safeName: 'isCancellable', type: 'bit' }, { name: 'isAuthorized', safeName: 'isAuthorized', type: 'bit' }, { name: 'isRefundable', safeName: 'isRefundable', type: 'bit' }, { name: 'paymentStatusCategory', safeName: 'paymentStatusCategory', type: 'varchar' }, { name: 'status', safeName: 'status', type: 'varchar' }, { name: 'RETURNMAC', safeName: 'RETURNMAC', type: 'varchar' }, { name: 'invalidTokens', safeName: 'invalidTokens', type: 'text' }, { name: 'redirectUrl', safeName: 'redirectUrl', type: 'varchar' }, { name: 'partialRedirectUrl', safeName: 'partialRedirectUrl', type: 'varchar' }, { name: 'Resp_AID', safeName: 'Resp_AID', type: 'varchar' }, { name: 'Resp_ARC', safeName: 'Resp_ARC', type: 'varchar' }, { name: 'Resp_ATC', safeName: 'Resp_ATC', type: 'varchar' }, { name: 'Resp_PSN', safeName: 'Resp_PSN', type: 'varchar' }, { name: 'Resp_Authorization', safeName: 'Resp_Authorization', type: 'varchar' }, { name: 'Resp_CardBank', safeName: 'Resp_CardBank', type: 'varchar' }, { name: 'Resp_CardHolder', safeName: 'Resp_CardHolder', type: 'varchar' }, { name: 'Resp_CardIssuer', safeName: 'Resp_CardIssuer', type: 'varchar' }, { name: 'Resp_CardNumber', safeName: 'Resp_CardNumber', type: 'varchar' }, { name: 'Resp_CardTechnology', safeName: 'Resp_CardTechnology', type: 'int' }, { name: 'Resp_CardType', safeName: 'Resp_CardType', type: 'varchar' }, { name: 'Resp_Date', safeName: 'Resp_Date', type: 'varchar' }, { name: 'Resp_Time', safeName: 'Resp_Time', type: 'varchar' }, { name: 'Resp_Language', safeName: 'Resp_Language', type: 'varchar' }, { name: 'Resp_Location', safeName: 'Resp_Location', type: 'varchar' }, { name: 'Resp_MerchantId', safeName: 'Resp_MerchantId', type: 'varchar' }, { name: 'Resp_MerchantName', safeName: 'Resp_MerchantName', type: 'varchar' }, { name: 'Resp_OriginalTransactionId', safeName: 'Resp_OriginalTransactionId', type: 'varchar' }, { name: 'Resp_OriginalTransactionDate', safeName: 'Resp_OriginalTransactionDate', type: 'varchar' }, { name: 'Resp_PinIndicator', safeName: 'Resp_PinIndicator', type: 'int' }, { name: 'Resp_SignatureIndicator', safeName: 'Resp_SignatureIndicator', type: 'int' }, { name: 'Resp_SignatureImage', safeName: 'Resp_SignatureImage', type: 'text' }, { name: 'Resp_TerminalId', safeName: 'Resp_TerminalId', type: 'varchar' }, { name: 'Resp_Type', safeName: 'Resp_Type', type: 'varchar' }, { name: 'Terminal', safeName: 'Terminal', type: 'varchar' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('transacciontratamiento', mapped);
    console.log(` ✅ TransaccionTratamiento complete!`);
  } catch (e) { console.error(` ❌ Error in TransaccionTratamiento:`, e.message); }

  console.log('Migrating TUPerfil (7 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [TUPerfil]');
    const cols = [{ name: 'IdPerfil', safeName: 'IdPerfil', type: 'int' }, { name: 'Descripcio', safeName: 'Descripcio', type: 'varchar' }, { name: 'IdCentro', safeName: 'IdCentro', type: 'int' }, { name: 'CodInt', safeName: 'CodInt', type: 'varchar' }, { name: 'PersonalExterno', safeName: 'PersonalExterno', type: 'bit' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('tuperfil', mapped);
    console.log(` ✅ TUPerfil complete!`);
  } catch (e) { console.error(` ❌ Error in TUPerfil:`, e.message); }

  console.log('Migrating FormasPago (7 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [FormasPago]');
    const cols = [{ name: 'IDFPago', safeName: 'IDFPago', type: 'int' }, { name: 'Codigo', safeName: 'Codigo', type: 'varchar' }, { name: 'Nombre', safeName: 'Nombre', type: 'varchar' }, { name: 'FormaPago', safeName: 'FormaPago', type: 'varchar' }, { name: 'DescFormaPago', safeName: 'DescFormaPago', type: 'varchar' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('formaspago', mapped);
    console.log(` ✅ FormasPago complete!`);
  } catch (e) { console.error(` ❌ Error in FormasPago:`, e.message); }

  console.log('Migrating TSitCalH (8 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [TSitCalH]');
    const cols = [{ name: 'IdSit', safeName: 'IdSit', type: 'int' }, { name: 'HIni', safeName: 'HIni', type: 'int' }, { name: 'HFin', safeName: 'HFin', type: 'int' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('tsitcalh', mapped);
    console.log(` ✅ TSitCalH complete!`);
  } catch (e) { console.error(` ❌ Error in TSitCalH:`, e.message); }

  console.log('Migrating TSitCal (8 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [TSitCal]');
    const cols = [{ name: 'IdSit', safeName: 'IdSit', type: 'int' }, { name: 'Descripcio', safeName: 'Descripcio', type: 'varchar' }, { name: 'Color', safeName: 'Color', type: 'int' }, { name: 'FlgLab', safeName: 'FlgLab', type: 'varchar' }, { name: 'Inactivo', safeName: 'Inactivo', type: 'datetime' }, { name: 'AOOnline', safeName: 'AOOnline', type: 'datetime' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('tsitcal', mapped);
    console.log(` ✅ TSitCal complete!`);
  } catch (e) { console.error(` ❌ Error in TSitCal:`, e.message); }

  console.log('Migrating UserEspec (8 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [UserEspec]');
    const cols = [{ name: 'IdTipoEspec', safeName: 'IdTipoEspec', type: 'int' }, { name: 'IdUser', safeName: 'IdUser', type: 'int' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('userespec', mapped);
    console.log(` ✅ UserEspec complete!`);
  } catch (e) { console.error(` ❌ Error in UserEspec:`, e.message); }

  console.log('Migrating TTipoIVA (8 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [TTipoIVA]');
    const cols = [{ name: 'Descripcio', safeName: 'Descripcio', type: 'varchar' }, { name: 'IVA', safeName: 'IVA', type: 'real' }, { name: 'Inactivo', safeName: 'Inactivo', type: 'smalldatetime' }, { name: 'SCCodSCtaFRA', safeName: 'SCCodSCtaFRA', type: 'varchar' }, { name: 'SCCodSCtaGAS', safeName: 'SCCodSCtaGAS', type: 'varchar' }, { name: '_version', safeName: 'f_version', type: 'int' }, { name: '_fechaReg', safeName: 'f_fechaReg', type: 'datetime' }, { name: '_idUserReg', safeName: 'f_idUserReg', type: 'int' }, { name: '_fechaModif', safeName: 'f_fechaModif', type: 'datetime' }, { name: '_idUserModif', safeName: 'f_idUserModif', type: 'int' }, { name: 'IdTipoIVA', safeName: 'IdTipoIVA', type: 'int' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('ttipoiva', mapped);
    console.log(` ✅ TTipoIVA complete!`);
  } catch (e) { console.error(` ❌ Error in TTipoIVA:`, e.message); }

  console.log('Migrating TTipoAntecedentes (9 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [TTipoAntecedentes]');
    const cols = [{ name: 'IdTipoAnt', safeName: 'IdTipoAnt', type: 'int' }, { name: 'Descripcion', safeName: 'Descripcion', type: 'varchar' }, { name: 'Orden', safeName: 'Orden', type: 'int' }, { name: '_version', safeName: 'f_version', type: 'int' }, { name: '_fechaReg', safeName: 'f_fechaReg', type: 'datetime' }, { name: '_idUserReg', safeName: 'f_idUserReg', type: 'int' }, { name: '_fechaModif', safeName: 'f_fechaModif', type: 'datetime' }, { name: '_idUserModif', safeName: 'f_idUserModif', type: 'int' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('ttipoantecedentes', mapped);
    console.log(` ✅ TTipoAntecedentes complete!`);
  } catch (e) { console.error(` ❌ Error in TTipoAntecedentes:`, e.message); }

  console.log('Migrating TUCentros (9 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [TUCentros]');
    const cols = [{ name: 'IdUser', safeName: 'IdUser', type: 'int' }, { name: 'IdPerfil', safeName: 'IdPerfil', type: 'int' }, { name: '_fechareg', safeName: 'f_fechareg', type: 'datetime' }, { name: 'Inactiva', safeName: 'Inactiva', type: 'char' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('tucentros', mapped);
    console.log(` ✅ TUCentros complete!`);
  } catch (e) { console.error(` ❌ Error in TUCentros:`, e.message); }

  console.log('Migrating Idioma (10 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [Idioma]');
    const cols = [{ name: 'IdIdioma', safeName: 'IdIdioma', type: 'int' }, { name: 'Codi', safeName: 'Codi', type: 'varchar' }, { name: 'Descripcio', safeName: 'Descripcio', type: 'varchar' }, { name: 'Actiu', safeName: 'Actiu', type: 'int' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('idioma', mapped);
    console.log(` ✅ Idioma complete!`);
  } catch (e) { console.error(` ❌ Error in Idioma:`, e.message); }

  console.log('Migrating TCalCa (10 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [TCalCa]');
    const cols = [{ name: 'IdCal', safeName: 'IdCal', type: 'int' }, { name: 'Descripcio', safeName: 'Descripcio', type: 'varchar' }, { name: 'Inactivo', safeName: 'Inactivo', type: 'char' }, { name: 'IdCentro', safeName: 'IdCentro', type: 'int' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('tcalca', mapped);
    console.log(` ✅ TCalCa complete!`);
  } catch (e) { console.error(` ❌ Error in TCalCa:`, e.message); }

  console.log('Migrating TSitCita (10 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [TSitCita]');
    const cols = [{ name: 'IdSitC', safeName: 'IdSitC', type: 'int' }, { name: 'Descripcio', safeName: 'Descripcio', type: 'varchar' }, { name: 'Color', safeName: 'Color', type: 'int' }, { name: 'FlgPizarra', safeName: 'FlgPizarra', type: 'varchar' }, { name: 'FlgHoraLlegada', safeName: 'FlgHoraLlegada', type: 'char' }, { name: 'FlgHoraConsulta', safeName: 'FlgHoraConsulta', type: 'char' }, { name: 'FlgHoraFinal', safeName: 'FlgHoraFinal', type: 'char' }, { name: 'FlgFallo', safeName: 'FlgFallo', type: 'char' }, { name: 'FlgAnulada', safeName: 'FlgAnulada', type: 'char' }, { name: 'FlgVisible', safeName: 'FlgVisible', type: 'char' }, { name: 'Orden', safeName: 'Orden', type: 'int' }, { name: 'DuracMaxEstanc', safeName: 'DuracMaxEstanc', type: 'int' }, { name: 'FlgColorFont', safeName: 'FlgColorFont', type: 'varchar' }, { name: 'FlgColorShape', safeName: 'FlgColorShape', type: 'varchar' }, { name: 'IdSitCNueva', safeName: 'IdSitCNueva', type: 'int' }, { name: 'TiempoTransicion', safeName: 'TiempoTransicion', type: 'int' }, { name: 'IdTipoSitCita', safeName: 'IdTipoSitCita', type: 'int' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('tsitcita', mapped);
    console.log(` ✅ TSitCita complete!`);
  } catch (e) { console.error(` ❌ Error in TSitCita:`, e.message); }

  console.log('Migrating TMRecall (10 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [TMRecall]');
    const cols = [{ name: 'IdMotivo', safeName: 'IdMotivo', type: 'int' }, { name: 'Descripcio', safeName: 'Descripcio', type: 'varchar' }, { name: 'IdTipoControlRecall', safeName: 'IdTipoControlRecall', type: 'int' }, { name: 'Inactivo', safeName: 'Inactivo', type: 'datetime' }, { name: 'TratAgdOblig', safeName: 'TratAgdOblig', type: 'bit' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }, { name: 'TipoComunicaciones', safeName: 'TipoComunicaciones', type: 'int' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('tmrecall', mapped);
    console.log(` ✅ TMRecall complete!`);
  } catch (e) { console.error(` ❌ Error in TMRecall:`, e.message); }

  console.log('Migrating TUsers (11 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [TUsers]');
    const cols = [{ name: 'IdUser', safeName: 'IdUser', type: 'int' }, { name: 'Login', safeName: 'Login', type: 'varchar' }, { name: 'Pass', safeName: 'Pass', type: 'varchar' }, { name: 'Nombre', safeName: 'Nombre', type: 'varchar' }, { name: 'Apellidos', safeName: 'Apellidos', type: 'varchar' }, { name: 'NIF', safeName: 'NIF', type: 'varchar' }, { name: 'Email', safeName: 'Email', type: 'varchar' }, { name: 'Telef', safeName: 'Telef', type: 'varchar' }, { name: 'UsrRido', safeName: 'UsrRido', type: 'varchar' }, { name: 'DirRptExp', safeName: 'DirRptExp', type: 'varchar' }, { name: 'RptGeneral', safeName: 'RptGeneral', type: 'bit' }, { name: 'FecPass', safeName: 'FecPass', type: 'smalldatetime' }, { name: 'IdPerfil', safeName: 'IdPerfil', type: 'int' }, { name: 'OcultarPac', safeName: 'OcultarPac', type: 'bit' }, { name: 'OcultarPa2', safeName: 'OcultarPa2', type: 'bit' }, { name: 'IdCol', safeName: 'IdCol', type: 'int' }, { name: 'FecDActiva', safeName: 'FecDActiva', type: 'smalldatetime' }, { name: 'FecHActiva', safeName: 'FecHActiva', type: 'smalldatetime' }, { name: 'UsrBloq', safeName: 'UsrBloq', type: 'bit' }, { name: 'IdTipoEspec', safeName: 'IdTipoEspec', type: 'int' }, { name: 'IdEmisor', safeName: 'IdEmisor', type: 'int' }, { name: 'IdGrupo', safeName: 'IdGrupo', type: 'int' }, { name: 'AdmGrupo', safeName: 'AdmGrupo', type: 'char' }, { name: '_fechareg', safeName: 'f_fechareg', type: 'datetime' }, { name: 'CodInt', safeName: 'CodInt', type: 'varchar' }, { name: 'PendienteResetear', safeName: 'PendienteResetear', type: 'bit' }, { name: 'Guid', safeName: 'Guid', type: 'uniqueidentifier' }, { name: 'TipoDocIdent', safeName: 'TipoDocIdent', type: 'int' }, { name: 'IdPaisIdent', safeName: 'IdPaisIdent', type: 'int' }, { name: 'Password', safeName: 'Password', type: 'nvarchar' }, { name: 'Guid_DefaultCenter', safeName: 'Guid_DefaultCenter', type: 'uniqueidentifier' }, { name: 'Custom', safeName: 'Custom', type: 'bit' }, { name: 'Guid_ExternalUserDomain', safeName: 'Guid_ExternalUserDomain', type: 'uniqueidentifier' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }, { name: 'BannerDentIANoMostrar', safeName: 'BannerDentIANoMostrar', type: 'datetime' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('tusers', mapped);
    console.log(` ✅ TUsers complete!`);
  } catch (e) { console.error(` ❌ Error in TUsers:`, e.message); }

  console.log('Migrating TPacPlan (11 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [TPacPlan]');
    const cols = [{ name: 'DescPlan', safeName: 'DescPlan', type: 'varchar' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('tpacplan', mapped);
    console.log(` ✅ TPacPlan complete!`);
  } catch (e) { console.error(` ❌ Error in TPacPlan:`, e.message); }

  console.log('Migrating TCtasGen (11 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [TCtasGen]');
    const cols = [{ name: 'IdCta', safeName: 'IdCta', type: 'char' }, { name: 'Descripcio', safeName: 'Descripcio', type: 'varchar' }, { name: 'Id', safeName: 'Id', type: 'int' }, { name: '_version', safeName: 'f_version', type: 'int' }, { name: '_fechaReg', safeName: 'f_fechaReg', type: 'datetime' }, { name: '_idUserReg', safeName: 'f_idUserReg', type: 'int' }, { name: '_fechaModif', safeName: 'f_fechaModif', type: 'datetime' }, { name: '_idUserModif', safeName: 'f_idUserModif', type: 'int' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('tctasgen', mapped);
    console.log(` ✅ TCtasGen complete!`);
  } catch (e) { console.error(` ❌ Error in TCtasGen:`, e.message); }

  console.log('Migrating TUsuAgd (12 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [TUsuAgd]');
    const cols = [{ name: 'IdUsu', safeName: 'IdUsu', type: 'int' }, { name: 'Descripcio', safeName: 'Descripcio', type: 'varchar' }, { name: 'CodExt', safeName: 'CodExt', type: 'varchar' }, { name: 'MinFrac', safeName: 'MinFrac', type: 'int' }, { name: 'IdCal', safeName: 'IdCal', type: 'int' }, { name: 'IdGrUsu', safeName: 'IdGrUsu', type: 'int' }, { name: 'Status', safeName: 'Status', type: 'int' }, { name: 'BOX', safeName: 'BOX', type: 'varchar' }, { name: 'IdOpcDef', safeName: 'IdOpcDef', type: 'varchar' }, { name: 'Nota', safeName: 'Nota', type: 'text' }, { name: 'IdBox', safeName: 'IdBox', type: 'int' }, { name: 'IdCol', safeName: 'IdCol', type: 'int' }, { name: 'IdTipoEspec', safeName: 'IdTipoEspec', type: 'int' }, { name: 'AOOnLine', safeName: 'AOOnLine', type: 'char' }, { name: 'AOFecPubDesde', safeName: 'AOFecPubDesde', type: 'smalldatetime' }, { name: 'AOFecPubHasta', safeName: 'AOFecPubHasta', type: 'smalldatetime' }, { name: 'AOAgdGUID', safeName: 'AOAgdGUID', type: 'varchar' }, { name: 'AODescripcio', safeName: 'AODescripcio', type: 'varchar' }, { name: 'IdOpcDefWeb', safeName: 'IdOpcDefWeb', type: 'varchar' }, { name: 'IdCentro', safeName: 'IdCentro', type: 'int' }, { name: 'IdTipoAgenda', safeName: 'IdTipoAgenda', type: 'int' }, { name: 'ActivarControlAgenda', safeName: 'ActivarControlAgenda', type: 'int' }, { name: 'ColMan', safeName: 'ColMan', type: 'int' }, { name: 'ColTar', safeName: 'ColTar', type: 'int' }, { name: 'AOTipoTratamiento', safeName: 'AOTipoTratamiento', type: 'int' }, { name: 'VentanaCitacion', safeName: 'VentanaCitacion', type: 'int' }, { name: 'BloqueosAutomaticos', safeName: 'BloqueosAutomaticos', type: 'bit' }, { name: 'DuracionBloqueos', safeName: 'DuracionBloqueos', type: 'int' }, { name: 'Id_MotivoBloqueos', safeName: 'Id_MotivoBloqueos', type: 'int' }, { name: 'EnviarRecordatorio', safeName: 'EnviarRecordatorio', type: 'datetime' }, { name: 'EnviarConfirmacion', safeName: 'EnviarConfirmacion', type: 'datetime' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('tusuagd', mapped);
    console.log(` ✅ TUsuAgd complete!`);
  } catch (e) { console.error(` ❌ Error in TUsuAgd:`, e.message); }

  console.log('Migrating TForPago (15 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [TForPago]');
    const cols = [{ name: 'IdForPago', safeName: 'IdForPago', type: 'int' }, { name: 'Tipo', safeName: 'Tipo', type: 'int' }, { name: 'Descripcio', safeName: 'Descripcio', type: 'varchar' }, { name: 'Inactivo', safeName: 'Inactivo', type: 'datetime' }, { name: '_version', safeName: 'f_version', type: 'int' }, { name: '_fechaReg', safeName: 'f_fechaReg', type: 'datetime' }, { name: '_idUserReg', safeName: 'f_idUserReg', type: 'int' }, { name: '_fechaModif', safeName: 'f_fechaModif', type: 'datetime' }, { name: '_idUserModif', safeName: 'f_idUserModif', type: 'int' }, { name: 'IdAgrupacionFormaPago', safeName: 'IdAgrupacionFormaPago', type: 'int' }, { name: 'ModoFinanciacion', safeName: 'ModoFinanciacion', type: 'int' }, { name: 'TPVVirtual', safeName: 'TPVVirtual', type: 'bit' }, { name: 'TPVFisico', safeName: 'TPVFisico', type: 'bit' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('tforpago', mapped);
    console.log(` ✅ TForPago complete!`);
  } catch (e) { console.error(` ❌ Error in TForPago:`, e.message); }

  console.log('Migrating TalonReceta (15 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [TalonReceta]');
    const cols = [{ name: 'IdTalonReceta', safeName: 'IdTalonReceta', type: 'int' }, { name: 'IdCol', safeName: 'IdCol', type: 'int' }, { name: 'IdCentro', safeName: 'IdCentro', type: 'int' }, { name: 'NumeroLote', safeName: 'NumeroLote', type: 'varchar' }, { name: 'TipoDoc', safeName: 'TipoDoc', type: 'varchar' }, { name: 'NIF', safeName: 'NIF', type: 'varchar' }, { name: 'Nombre', safeName: 'Nombre', type: 'varchar' }, { name: 'Apellido1', safeName: 'Apellido1', type: 'varchar' }, { name: 'Apellido2', safeName: 'Apellido2', type: 'varchar' }, { name: 'NumColegiado', safeName: 'NumColegiado', type: 'varchar' }, { name: 'DirCP', safeName: 'DirCP', type: 'varchar' }, { name: 'DirPostal', safeName: 'DirPostal', type: 'varchar' }, { name: 'DirMunicipio', safeName: 'DirMunicipio', type: 'varchar' }, { name: 'DirPais', safeName: 'DirPais', type: 'varchar' }, { name: 'DirProvinica', safeName: 'DirProvinica', type: 'varchar' }, { name: 'DirTipoVia', safeName: 'DirTipoVia', type: 'varchar' }, { name: 'IdColegio', safeName: 'IdColegio', type: 'varchar' }, { name: 'TrabCentro', safeName: 'TrabCentro', type: 'varchar' }, { name: 'TrabCIF', safeName: 'TrabCIF', type: 'varchar' }, { name: 'TrabPrincipal', safeName: 'TrabPrincipal', type: 'int' }, { name: '_FechaReg', safeName: 'f_FechaReg', type: 'datetime' }, { name: 'Libres', safeName: 'Libres', type: 'int' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('talonreceta', mapped);
    console.log(` ✅ TalonReceta complete!`);
  } catch (e) { console.error(` ❌ Error in TalonReceta:`, e.message); }

  console.log('Migrating TRegApun (15 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [TRegApun]');
    const cols = [{ name: 'IdTRegApun', safeName: 'IdTRegApun', type: 'tinyint' }, { name: 'Descripcio', safeName: 'Descripcio', type: 'varchar' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('tregapun', mapped);
    console.log(` ✅ TRegApun complete!`);
  } catch (e) { console.error(` ❌ Error in TRegApun:`, e.message); }

  console.log('Migrating UserCola (19 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [UserCola]');
    const cols = [{ name: 'IdCol', safeName: 'IdCol', type: 'int' }, { name: 'IdUser', safeName: 'IdUser', type: 'int' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('usercola', mapped);
    console.log(` ✅ UserCola complete!`);
  } catch (e) { console.error(` ❌ Error in UserCola:`, e.message); }

  console.log('Migrating IconoTratAgenda (19 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [IconoTratAgenda]');
    const cols = [{ name: 'IdIcono', safeName: 'IdIcono', type: 'int' }, { name: 'Descripcion', safeName: 'Descripcion', type: 'varchar' }, { name: 'ImagenTxt', safeName: 'ImagenTxt', type: 'text' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('iconotratagenda', mapped);
    console.log(` ✅ IconoTratAgenda complete!`);
  } catch (e) { console.error(` ❌ Error in IconoTratAgenda:`, e.message); }

  console.log('Migrating TiposFormaPago (20 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [TiposFormaPago]');
    const cols = [{ name: 'Id', safeName: 'Id', type: 'int' }, { name: 'Descripcion', safeName: 'Descripcion', type: 'varchar' }, { name: 'Bonificable', safeName: 'Bonificable', type: 'bit' }, { name: '_fechaReg', safeName: 'f_fechaReg', type: 'datetime' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('tiposformapago', mapped);
    console.log(` ✅ TiposFormaPago complete!`);
  } catch (e) { console.error(` ❌ Error in TiposFormaPago:`, e.message); }

  console.log('Migrating TColabos (24 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [TColabos]');
    const cols = [{ name: 'IdCol', safeName: 'IdCol', type: 'int' }, { name: 'Codigo', safeName: 'Codigo', type: 'varchar' }, { name: 'Alias', safeName: 'Alias', type: 'varchar' }, { name: 'Apellidos', safeName: 'Apellidos', type: 'varchar' }, { name: 'Nombre', safeName: 'Nombre', type: 'varchar' }, { name: 'IdPoblacio', safeName: 'IdPoblacio', type: 'int' }, { name: 'CP', safeName: 'CP', type: 'char' }, { name: 'Direccion', safeName: 'Direccion', type: 'varchar' }, { name: 'NIF', safeName: 'NIF', type: 'char' }, { name: 'Tel1', safeName: 'Tel1', type: 'varchar' }, { name: 'Tel2', safeName: 'Tel2', type: 'varchar' }, { name: 'TelMovil', safeName: 'TelMovil', type: 'varchar' }, { name: 'Fax', safeName: 'Fax', type: 'varchar' }, { name: 'EMail', safeName: 'EMail', type: 'varchar' }, { name: 'Web', safeName: 'Web', type: 'varchar' }, { name: 'FecBaja', safeName: 'FecBaja', type: 'smalldatetime' }, { name: 'Activo', safeName: 'Activo', type: 'char' }, { name: 'Horario', safeName: 'Horario', type: 'varchar' }, { name: 'Notas', safeName: 'Notas', type: 'text' }, { name: 'Comision', safeName: 'Comision', type: 'tinyint' }, { name: 'ReComision', safeName: 'ReComision', type: 'char' }, { name: 'Cobro', safeName: 'Cobro', type: 'char' }, { name: 'CodInt', safeName: 'CodInt', type: 'varchar' }, { name: 'FecAlta', safeName: 'FecAlta', type: 'smalldatetime' }, { name: 'ReGastos', safeName: 'ReGastos', type: 'char' }, { name: 'TpcGastos', safeName: 'TpcGastos', type: 'tinyint' }, { name: 'Gasto', safeName: 'Gasto', type: 'char' }, { name: 'PrecioFijo', safeName: 'PrecioFijo', type: 'char' }, { name: 'TpcPFijo', safeName: 'TpcPFijo', type: 'tinyint' }, { name: 'IdTipoColab', safeName: 'IdTipoColab', type: 'int' }, { name: 'NumColeg', safeName: 'NumColeg', type: 'varchar' }, { name: 'CobPropios', safeName: 'CobPropios', type: 'char' }, { name: 'TipoRealizado', safeName: 'TipoRealizado', type: 'char' }, { name: 'IdGrpColab', safeName: 'IdGrpColab', type: 'int' }, { name: 'IRPF', safeName: 'IRPF', type: 'int' }, { name: 'TipoComision', safeName: 'TipoComision', type: 'char' }, { name: 'JefeGrupo', safeName: 'JefeGrupo', type: 'tinyint' }, { name: 'IdColJefeGrupo', safeName: 'IdColJefeGrupo', type: 'int' }, { name: 'IdRef', safeName: 'IdRef', type: 'int' }, { name: 'IdProced', safeName: 'IdProced', type: 'int' }, { name: 'IdEmisor', safeName: 'IdEmisor', type: 'int' }, { name: 'PIN', safeName: 'PIN', type: 'varchar' }, { name: 'FechaPIN', safeName: 'FechaPIN', type: 'datetime' }, { name: 'InicioEspecCM', safeName: 'InicioEspecCM', type: 'datetime' }, { name: 'TipoContrato', safeName: 'TipoContrato', type: 'int' }, { name: 'TipoDocIdent', safeName: 'TipoDocIdent', type: 'int' }, { name: 'IdPaisIdent', safeName: 'IdPaisIdent', type: 'int' }, { name: 'ExternalId', safeName: 'ExternalId', type: 'uniqueidentifier' }, { name: 'ExternalLogin', safeName: 'ExternalLogin', type: 'nvarchar' }, { name: 'ExternalPwd', safeName: 'ExternalPwd', type: 'nvarchar' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('tcolabos', mapped);
    console.log(` ✅ TColabos complete!`);
  } catch (e) { console.error(` ❌ Error in TColabos:`, e.message); }

  console.log('Migrating Centros_TColabos (24 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [Centros_TColabos]');
    const cols = [{ name: 'IdCentro', safeName: 'IdCentro', type: 'int' }, { name: 'IdCol', safeName: 'IdCol', type: 'int' }, { name: 'FechaBaja', safeName: 'FechaBaja', type: 'datetime' }, { name: 'Inactivo', safeName: 'Inactivo', type: 'char' }, { name: '_fechareg', safeName: 'f_fechareg', type: 'datetime' }, { name: 'isRegisteredInClinipad', safeName: 'isRegisteredInClinipad', type: 'bit' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('centrosTcolabos', mapped);
    console.log(` ✅ Centros_TColabos complete!`);
  } catch (e) { console.error(` ❌ Error in Centros_TColabos:`, e.message); }

  console.log('Migrating ATMT_Plantillas_ConectoresParams (25 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [ATMT_Plantillas_ConectoresParams]');
    const cols = [{ name: 'Id', safeName: 'Id', type: 'int' }, { name: '_version', safeName: 'f_version', type: 'int' }, { name: '_fechaReg', safeName: 'f_fechaReg', type: 'datetime' }, { name: '_idUserReg', safeName: 'f_idUserReg', type: 'int' }, { name: '_fechaModif', safeName: 'f_fechaModif', type: 'datetime' }, { name: '_idUserModif', safeName: 'f_idUserModif', type: 'int' }, { name: 'Id_Plantilla', safeName: 'Id_Plantilla', type: 'int' }, { name: 'Id_ConectorParam', safeName: 'Id_ConectorParam', type: 'int' }, { name: 'Comodin', safeName: 'Comodin', type: 'varchar' }, { name: 'Inactivo', safeName: 'Inactivo', type: 'datetime' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('atmtPlantillasConectoresparams', mapped);
    console.log(` ✅ ATMT_Plantillas_ConectoresParams complete!`);
  } catch (e) { console.error(` ❌ Error in ATMT_Plantillas_ConectoresParams:`, e.message); }

  console.log('Migrating TGrupos (29 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [TGrupos]');
    const cols = [{ name: 'IdGrupo', safeName: 'IdGrupo', type: 'int' }, { name: 'Descripcio', safeName: 'Descripcio', type: 'varchar' }, { name: 'Imputable', safeName: 'Imputable', type: 'bit' }, { name: 'SCCodSCta', safeName: 'SCCodSCta', type: 'varchar' }, { name: 'SCCodDept', safeName: 'SCCodDept', type: 'varchar' }, { name: 'SCCodProd', safeName: 'SCCodProd', type: 'varchar' }, { name: 'SCCodProy', safeName: 'SCCodProy', type: 'varchar' }, { name: 'Antecedent', safeName: 'Antecedent', type: 'char' }, { name: 'SCCodSCDto', safeName: 'SCCodSCDto', type: 'varchar' }, { name: '_version', safeName: 'f_version', type: 'int' }, { name: '_fechaReg', safeName: 'f_fechaReg', type: 'datetime' }, { name: '_idUserReg', safeName: 'f_idUserReg', type: 'int' }, { name: '_fechaModif', safeName: 'f_fechaModif', type: 'datetime' }, { name: '_idUserModif', safeName: 'f_idUserModif', type: 'int' }, { name: 'EsControl', safeName: 'EsControl', type: 'int' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('tgrupos', mapped);
    console.log(` ✅ TGrupos complete!`);
  } catch (e) { console.error(` ❌ Error in TGrupos:`, e.message); }

  console.log('Migrating PacPerio (30 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [PacPerio]');
    const cols = [{ name: 'IdPac', safeName: 'IdPac', type: 'int' }, { name: 'IdExplPer', safeName: 'IdExplPer', type: 'int' }, { name: 'Fecha', safeName: 'Fecha', type: 'smalldatetime' }, { name: 'NotasSup', safeName: 'NotasSup', type: 'text' }, { name: 'NotasInf', safeName: 'NotasInf', type: 'text' }, { name: 'Id', safeName: 'Id', type: 'int' }, { name: '_version', safeName: 'f_version', type: 'int' }, { name: '_fechaReg', safeName: 'f_fechaReg', type: 'datetime' }, { name: '_idUserReg', safeName: 'f_idUserReg', type: 'int' }, { name: '_fechaModif', safeName: 'f_fechaModif', type: 'datetime' }, { name: '_idUserModif', safeName: 'f_idUserModif', type: 'int' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('pacperio', mapped);
    console.log(` ✅ PacPerio complete!`);
  } catch (e) { console.error(` ❌ Error in PacPerio:`, e.message); }

  console.log('Migrating PresuTipo (30 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [PresuTipo]');
    const cols = [{ name: 'IdPresuTipo', safeName: 'IdPresuTipo', type: 'int' }, { name: 'Titulo', safeName: 'Titulo', type: 'varchar' }, { name: 'Notas', safeName: 'Notas', type: 'text' }, { name: 'IdCol', safeName: 'IdCol', type: 'int' }, { name: 'Emisor', safeName: 'Emisor', type: 'int' }, { name: 'IdTipoPresupuesto', safeName: 'IdTipoPresupuesto', type: 'int' }, { name: '_version', safeName: 'f_version', type: 'int' }, { name: '_fechaReg', safeName: 'f_fechaReg', type: 'datetime' }, { name: '_idUserReg', safeName: 'f_idUserReg', type: 'int' }, { name: '_fechaModif', safeName: 'f_fechaModif', type: 'datetime' }, { name: '_idUserModif', safeName: 'f_idUserModif', type: 'int' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }, { name: 'TipoHallazgo', safeName: 'TipoHallazgo', type: 'nvarchar' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('presutipo', mapped);
    console.log(` ✅ PresuTipo complete!`);
  } catch (e) { console.error(` ❌ Error in PresuTipo:`, e.message); }

  console.log('Migrating TCalHor (32 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [TCalHor]');
    const cols = [{ name: 'IdCal', safeName: 'IdCal', type: 'int' }, { name: 'IdDia', safeName: 'IdDia', type: 'int' }, { name: 'HIni', safeName: 'HIni', type: 'int' }, { name: 'HFin', safeName: 'HFin', type: 'int' }, { name: 'AOOnLine', safeName: 'AOOnLine', type: 'char' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('tcalhor', mapped);
    console.log(` ✅ TCalHor complete!`);
  } catch (e) { console.error(` ❌ Error in TCalHor:`, e.message); }

  console.log('Migrating TMotivoAsignacion (32 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [TMotivoAsignacion]');
    const cols = [{ name: 'MotivoAsignacion', safeName: 'MotivoAsignacion', type: 'varchar' }, { name: 'Tipo', safeName: 'Tipo', type: 'int' }, { name: 'Ident', safeName: 'Ident', type: 'int' }, { name: 'ObligarTexto', safeName: 'ObligarTexto', type: 'bit' }, { name: 'ImputableCentro', safeName: 'ImputableCentro', type: 'int' }, { name: 'Codigo', safeName: 'Codigo', type: 'varchar' }, { name: '_version', safeName: 'f_version', type: 'int' }, { name: '_fechaReg', safeName: 'f_fechaReg', type: 'datetime' }, { name: '_idUserReg', safeName: 'f_idUserReg', type: 'int' }, { name: '_fechaModif', safeName: 'f_fechaModif', type: 'datetime' }, { name: '_idUserModif', safeName: 'f_idUserModif', type: 'int' }, { name: 'InternalId', safeName: 'InternalId', type: 'int' }, { name: 'TipoAccion', safeName: 'TipoAccion', type: 'int' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('tmotivoasignacion', mapped);
    console.log(` ✅ TMotivoAsignacion complete!`);
  } catch (e) { console.error(` ❌ Error in TMotivoAsignacion:`, e.message); }

  console.log('Migrating FTX_00000088_Dental (36 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [FTX_00000088_Dental]');
    const cols = [{ name: 'Guid', safeName: 'Guid', type: 'varchar' }, { name: 'IdPac', safeName: 'IdPac', type: 'int' }, { name: 'IdFicha', safeName: 'IdFicha', type: 'int' }, { name: 'fecha', safeName: 'fecha', type: 'datetime' }, { name: 'recomendo', safeName: 'recomendo', type: 'varchar' }, { name: 'representante', safeName: 'representante', type: 'varchar' }, { name: 'tratpsi', safeName: 'tratpsi', type: 'varchar' }, { name: 'trapsi_text', safeName: 'trapsi_text', type: 'varchar' }, { name: 'medicamento', safeName: 'medicamento', type: 'varchar' }, { name: 'antibioticos', safeName: 'antibioticos', type: 'varchar' }, { name: 'hormonas', safeName: 'hormonas', type: 'varchar' }, { name: 'aspirina', safeName: 'aspirina', type: 'varchar' }, { name: 'insulina', safeName: 'insulina', type: 'varchar' }, { name: 'anticoagulantes', safeName: 'anticoagulantes', type: 'varchar' }, { name: 'tension', safeName: 'tension', type: 'varchar' }, { name: 'corazon', safeName: 'corazon', type: 'varchar' }, { name: 'bifosfonatos', safeName: 'bifosfonatos', type: 'varchar' }, { name: 'anticonceptivos', safeName: 'anticonceptivos', type: 'varchar' }, { name: 'tranquilizantes', safeName: 'tranquilizantes', type: 'varchar' }, { name: 'cortisona', safeName: 'cortisona', type: 'varchar' }, { name: 'medica_otros', safeName: 'medica_otros', type: 'varchar' }, { name: 'medica_otros_text', safeName: 'medica_otros_text', type: 'varchar' }, { name: 'hospitalizado', safeName: 'hospitalizado', type: 'varchar' }, { name: 'hospitalizado_text', safeName: 'hospitalizado_text', type: 'varchar' }, { name: 'cardiacos', safeName: 'cardiacos', type: 'varchar' }, { name: 'cardi_corazon', safeName: 'cardi_corazon', type: 'varchar' }, { name: 'cardi_sangre_baja', safeName: 'cardi_sangre_baja', type: 'varchar' }, { name: 'cardi_sangre_alta', safeName: 'cardi_sangre_alta', type: 'varchar' }, { name: 'cardi_dolor_pecho', safeName: 'cardi_dolor_pecho', type: 'varchar' }, { name: 'cardi_angina', safeName: 'cardi_angina', type: 'varchar' }, { name: 'cardi_infarto', safeName: 'cardi_infarto', type: 'varchar' }, { name: 'cardi_soplo', safeName: 'cardi_soplo', type: 'varchar' }, { name: 'cardi_respi', safeName: 'cardi_respi', type: 'varchar' }, { name: 'cardi_otros', safeName: 'cardi_otros', type: 'varchar' }, { name: 'cardi_otros_text', safeName: 'cardi_otros_text', type: 'varchar' }, { name: 'enfermedad_contagios', safeName: 'enfermedad_contagios', type: 'varchar' }, { name: 'hepatitis', safeName: 'hepatitis', type: 'varchar' }, { name: 'tuberculosis', safeName: 'tuberculosis', type: 'varchar' }, { name: 'sifilis', safeName: 'sifilis', type: 'varchar' }, { name: 'vih', safeName: 'vih', type: 'varchar' }, { name: 'alteraciones', safeName: 'alteraciones', type: 'varchar' }, { name: 'cerebral', safeName: 'cerebral', type: 'varchar' }, { name: 'pulmonares', safeName: 'pulmonares', type: 'varchar' }, { name: 'cancer', safeName: 'cancer', type: 'varchar' }, { name: 'ictericia', safeName: 'ictericia', type: 'varchar' }, { name: 'tos', safeName: 'tos', type: 'varchar' }, { name: 'epilepsia', safeName: 'epilepsia', type: 'varchar' }, { name: 'anemia', safeName: 'anemia', type: 'varchar' }, { name: 'artritis', safeName: 'artritis', type: 'varchar' }, { name: 'depresiones', safeName: 'depresiones', type: 'varchar' }, { name: 'glaucoma', safeName: 'glaucoma', type: 'varchar' }, { name: 'diabetes', safeName: 'diabetes', type: 'varchar' }, { name: 'ulcera', safeName: 'ulcera', type: 'varchar' }, { name: 'mareos', safeName: 'mareos', type: 'varchar' }, { name: 'higado', safeName: 'higado', type: 'varchar' }, { name: 'rinones', safeName: 'rinones', type: 'varchar' }, { name: 'dolores_cabeza', safeName: 'dolores_cabeza', type: 'varchar' }, { name: 'radio_quimio', safeName: 'radio_quimio', type: 'varchar' }, { name: 'radio_quimio_text', safeName: 'radio_quimio_text', type: 'varchar' }, { name: 'sangrado', safeName: 'sangrado', type: 'varchar' }, { name: 'transfusion_sangre', safeName: 'transfusion_sangre', type: 'varchar' }, { name: 'fecha_transfusion', safeName: 'fecha_transfusion', type: 'datetime' }, { name: 'alergico', safeName: 'alergico', type: 'varchar' }, { name: 'penicilina', safeName: 'penicilina', type: 'varchar' }, { name: 'calmantes_sedantes', safeName: 'calmantes_sedantes', type: 'varchar' }, { name: 'tetraciclinas', safeName: 'tetraciclinas', type: 'varchar' }, { name: 'anestesia_dental', safeName: 'anestesia_dental', type: 'varchar' }, { name: 'codeina', safeName: 'codeina', type: 'varchar' }, { name: 'aler_aspirina', safeName: 'aler_aspirina', type: 'varchar' }, { name: 'otros_antibioticos', safeName: 'otros_antibioticos', type: 'varchar' }, { name: 'otros_antibioticos2', safeName: 'otros_antibioticos2', type: 'varchar' }, { name: 'otros_anti_text', safeName: 'otros_anti_text', type: 'varchar' }, { name: 'otros_anti_text2', safeName: 'otros_anti_text2', type: 'varchar' }, { name: 'alergia_a', safeName: 'alergia_a', type: 'varchar' }, { name: 'asma', safeName: 'asma', type: 'varchar' }, { name: 'urticaria', safeName: 'urticaria', type: 'varchar' }, { name: 'polen', safeName: 'polen', type: 'varchar' }, { name: 'sinusitis', safeName: 'sinusitis', type: 'varchar' }, { name: 'alergia_a_otros', safeName: 'alergia_a_otros', type: 'varchar' }, { name: 'alergia_a_otros_text', safeName: 'alergia_a_otros_text', type: 'varchar' }, { name: 'familia_enfermedad', safeName: 'familia_enfermedad', type: 'varchar' }, { name: 'familia_cardiacas', safeName: 'familia_cardiacas', type: 'varchar' }, { name: 'familia_diabetes', safeName: 'familia_diabetes', type: 'varchar' }, { name: 'familia_cancer', safeName: 'familia_cancer', type: 'varchar' }, { name: 'familia_alergias', safeName: 'familia_alergias', type: 'varchar' }, { name: 'familia_otras', safeName: 'familia_otras', type: 'varchar' }, { name: 'familia_otras_text', safeName: 'familia_otras_text', type: 'varchar' }, { name: 'embarazada', safeName: 'embarazada', type: 'varchar' }, { name: 'embarazada_mes', safeName: 'embarazada_mes', type: 'varchar' }, { name: 'lactancia', safeName: 'lactancia', type: 'varchar' }, { name: 'gravemente_enfermo', safeName: 'gravemente_enfermo', type: 'varchar' }, { name: 'sulfamidas', safeName: 'sulfamidas', type: 'varchar' }, { name: 'EsFumador', safeName: 'EsFumador', type: 'varchar' }, { name: 'NumCigarrillos', safeName: 'NumCigarrillos', type: 'int' }, { name: 'TxtMotivoDent', safeName: 'TxtMotivoDent', type: 'varchar' }, { name: 'TxtFechDentista', safeName: 'TxtFechDentista', type: 'varchar' }, { name: 'TxtAspectoDientes', safeName: 'TxtAspectoDientes', type: 'varchar' }, { name: 'CkRegular', safeName: 'CkRegular', type: 'varchar' }, { name: 'CkIntermitente', safeName: 'CkIntermitente', type: 'varchar' }, { name: 'CkInfrecuente', safeName: 'CkInfrecuente', type: 'varchar' }, { name: 'CkHigiene1', safeName: 'CkHigiene1', type: 'varchar' }, { name: 'CkHigiene2', safeName: 'CkHigiene2', type: 'varchar' }, { name: 'CkHigiene3', safeName: 'CkHigiene3', type: 'varchar' }, { name: 'CkHigieneNunca', safeName: 'CkHigieneNunca', type: 'varchar' }, { name: 'CkRevision1', safeName: 'CkRevision1', type: 'varchar' }, { name: 'CkRevision2', safeName: 'CkRevision2', type: 'varchar' }, { name: 'CkRevision3', safeName: 'CkRevision3', type: 'varchar' }, { name: 'CkRevisionNunca', safeName: 'CkRevisionNunca', type: 'varchar' }, { name: 'CkAfec1', safeName: 'CkAfec1', type: 'varchar' }, { name: 'CkAfec2', safeName: 'CkAfec2', type: 'varchar' }, { name: 'CkAfec3', safeName: 'CkAfec3', type: 'varchar' }, { name: 'CkAfec4', safeName: 'CkAfec4', type: 'varchar' }, { name: 'CkAfec5', safeName: 'CkAfec5', type: 'varchar' }, { name: 'CkAfec6', safeName: 'CkAfec6', type: 'varchar' }, { name: 'CkAfec7', safeName: 'CkAfec7', type: 'varchar' }, { name: 'CkAfec8', safeName: 'CkAfec8', type: 'varchar' }, { name: 'CkEncia1', safeName: 'CkEncia1', type: 'varchar' }, { name: 'CkEncia2', safeName: 'CkEncia2', type: 'varchar' }, { name: 'CkEncia3', safeName: 'CkEncia3', type: 'varchar' }, { name: 'CkEncia4', safeName: 'CkEncia4', type: 'varchar' }, { name: 'CkSens1', safeName: 'CkSens1', type: 'varchar' }, { name: 'CkSens2', safeName: 'CkSens2', type: 'varchar' }, { name: 'CkSens3', safeName: 'CkSens3', type: 'varchar' }, { name: 'CkSens4', safeName: 'CkSens4', type: 'varchar' }, { name: 'CkCepilla1', safeName: 'CkCepilla1', type: 'varchar' }, { name: 'CkCepilla2', safeName: 'CkCepilla2', type: 'varchar' }, { name: 'CkCepilla3', safeName: 'CkCepilla3', type: 'varchar' }, { name: 'CkCepilla4', safeName: 'CkCepilla4', type: 'varchar' }, { name: 'CkUsoHigiene1', safeName: 'CkUsoHigiene1', type: 'varchar' }, { name: 'CkUsoHigiene2', safeName: 'CkUsoHigiene2', type: 'varchar' }, { name: 'CkUsoHigiene3', safeName: 'CkUsoHigiene3', type: 'varchar' }, { name: 'CkUsoHigiene4', safeName: 'CkUsoHigiene4', type: 'varchar' }, { name: 'CkUsoHigiene5', safeName: 'CkUsoHigiene5', type: 'varchar' }, { name: 'CkUsoHigiene6', safeName: 'CkUsoHigiene6', type: 'varchar' }, { name: 'CkUsoHigiene7', safeName: 'CkUsoHigiene7', type: 'varchar' }, { name: 'CkUsoHigiene8', safeName: 'CkUsoHigiene8', type: 'varchar' }, { name: 'CkTrat1', safeName: 'CkTrat1', type: 'varchar' }, { name: 'CkTrat2', safeName: 'CkTrat2', type: 'varchar' }, { name: 'CkTrat3', safeName: 'CkTrat3', type: 'varchar' }, { name: 'CkTrat4', safeName: 'CkTrat4', type: 'varchar' }, { name: 'RadProt', safeName: 'RadProt', type: 'varchar' }, { name: 'RadFerula', safeName: 'RadFerula', type: 'varchar' }, { name: 'RadRonca', safeName: 'RadRonca', type: 'varchar' }, { name: 'RadAprieta', safeName: 'RadAprieta', type: 'varchar' }, { name: 'RadBlanqueo', safeName: 'RadBlanqueo', type: 'varchar' }, { name: 'RadOrto', safeName: 'RadOrto', type: 'varchar' }, { name: 'RadAspecto', safeName: 'RadAspecto', type: 'varchar' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('ftx00000088Dental', mapped);
    console.log(` ✅ FTX_00000088_Dental complete!`);
  } catch (e) { console.error(` ❌ Error in FTX_00000088_Dental:`, e.message); }

  console.log('Migrating GDPR_FTX_00000001 (37 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [GDPR_FTX_00000001]');
    const cols = [{ name: 'IdPac', safeName: 'IdPac', type: 'int' }, { name: 'IdFicha', safeName: 'IdFicha', type: 'int' }, { name: 'Fecha', safeName: 'Fecha', type: 'datetime' }, { name: 'CONS_001', safeName: 'CONS_001', type: 'varchar' }, { name: 'CONS_002', safeName: 'CONS_002', type: 'varchar' }, { name: 'CONS_003', safeName: 'CONS_003', type: 'varchar' }, { name: 'CONS_004', safeName: 'CONS_004', type: 'varchar' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('gdprFtx00000001', mapped);
    console.log(` ✅ GDPR_FTX_00000001 complete!`);
  } catch (e) { console.error(` ❌ Error in GDPR_FTX_00000001:`, e.message); }

  console.log('Migrating TProfesi (37 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [TProfesi]');
    const cols = [{ name: 'IdProfesio', safeName: 'IdProfesio', type: 'int' }, { name: 'Descripcio', safeName: 'Descripcio', type: 'varchar' }, { name: '_version', safeName: 'f_version', type: 'int' }, { name: '_fechaReg', safeName: 'f_fechaReg', type: 'datetime' }, { name: '_idUserReg', safeName: 'f_idUserReg', type: 'int' }, { name: '_fechaModif', safeName: 'f_fechaModif', type: 'datetime' }, { name: '_idUserModif', safeName: 'f_idUserModif', type: 'int' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('tprofesi', mapped);
    console.log(` ✅ TProfesi complete!`);
  } catch (e) { console.error(` ❌ Error in TProfesi:`, e.message); }

  console.log('Migrating ATMT_Tareas (38 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [ATMT_Tareas]');
    const cols = [{ name: 'IdTarea', safeName: 'IdTarea', type: 'int' }, { name: 'IdMotivo', safeName: 'IdMotivo', type: 'int' }, { name: 'IdTipoControlRecall', safeName: 'IdTipoControlRecall', type: 'int' }, { name: 'IdMotivoRecall', safeName: 'IdMotivoRecall', type: 'int' }, { name: 'IgnorarSiCita', safeName: 'IgnorarSiCita', type: 'int' }, { name: 'PrgCantidad', safeName: 'PrgCantidad', type: 'int' }, { name: 'PrgUnidad', safeName: 'PrgUnidad', type: 'int' }, { name: 'PrgCuando', safeName: 'PrgCuando', type: 'int' }, { name: 'IdMedio', safeName: 'IdMedio', type: 'int' }, { name: 'IdPlantilla', safeName: 'IdPlantilla', type: 'int' }, { name: '_fechareg', safeName: 'f_fechareg', type: 'smalldatetime' }, { name: 'Descripcion', safeName: 'Descripcion', type: 'varchar' }, { name: 'Inactivo', safeName: 'Inactivo', type: 'datetime' }, { name: 'Pausado', safeName: 'Pausado', type: 'bit' }, { name: '_version', safeName: 'f_version', type: 'int' }, { name: 'IdProtocolo', safeName: 'IdProtocolo', type: 'int' }, { name: 'IdTareaDefault', safeName: 'IdTareaDefault', type: 'varchar' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('atmtTareas', mapped);
    console.log(` ✅ ATMT_Tareas complete!`);
  } catch (e) { console.error(` ❌ Error in ATMT_Tareas:`, e.message); }

  console.log('Migrating TTipoOdg (39 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [TTipoOdg]');
    const cols = [{ name: 'IdTipoOdg', safeName: 'IdTipoOdg', type: 'int' }, { name: 'Tipo', safeName: 'Tipo', type: 'int' }, { name: 'Descripcio', safeName: 'Descripcio', type: 'varchar' }, { name: 'IdGrupo', safeName: 'IdGrupo', type: 'int' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('ttipoodg', mapped);
    console.log(` ✅ TTipoOdg complete!`);
  } catch (e) { console.error(` ❌ Error in TTipoOdg:`, e.message); }

  console.log('Migrating Widgets (39 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [Widgets]');
    const cols = [{ name: 'Id', safeName: 'Id', type: 'int' }, { name: '_version', safeName: 'f_version', type: 'int' }, { name: '_fechaReg', safeName: 'f_fechaReg', type: 'datetime' }, { name: '_idUserReg', safeName: 'f_idUserReg', type: 'int' }, { name: '_fechaModif', safeName: 'f_fechaModif', type: 'datetime' }, { name: '_idUserModif', safeName: 'f_idUserModif', type: 'int' }, { name: 'ExternalId', safeName: 'ExternalId', type: 'uniqueidentifier' }, { name: 'Name', safeName: 'Name', type: 'nvarchar' }, { name: 'Description', safeName: 'Description', type: 'nvarchar' }, { name: 'JsonProperties', safeName: 'JsonProperties', type: 'ntext' }, { name: 'JsonVersion', safeName: 'JsonVersion', type: 'int' }, { name: 'Custom', safeName: 'Custom', type: 'bit' }, { name: 'Activo', safeName: 'Activo', type: 'bit' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('widgets', mapped);
    console.log(` ✅ Widgets complete!`);
  } catch (e) { console.error(` ❌ Error in Widgets:`, e.message); }

  console.log('Migrating TtosMed_PagoCli (39 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [TtosMed_PagoCli]');
    const cols = [{ name: 'Id', safeName: 'Id', type: 'int' }, { name: 'IdPagoCli', safeName: 'IdPagoCli', type: 'int' }, { name: 'IdTtosMed', safeName: 'IdTtosMed', type: 'int' }, { name: 'Reservado', safeName: 'Reservado', type: 'numeric' }, { name: 'Consumido', safeName: 'Consumido', type: 'numeric' }, { name: '_fechareg', safeName: 'f_fechareg', type: 'datetime' }, { name: '_version', safeName: 'f_version', type: 'int' }, { name: '_iduser', safeName: 'f_iduser', type: 'int' }, { name: 'NumTransaccion', safeName: 'NumTransaccion', type: 'int' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('ttosmedPagocli', mapped);
    console.log(` ✅ TtosMed_PagoCli complete!`);
  } catch (e) { console.error(` ❌ Error in TtosMed_PagoCli:`, e.message); }

  console.log('Migrating TConectores (40 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [TConectores]');
    const cols = [{ name: 'IdConector', safeName: 'IdConector', type: 'int' }, { name: 'Descrip', safeName: 'Descrip', type: 'varchar' }, { name: 'Timeout', safeName: 'Timeout', type: 'int' }, { name: 'Log_Request', safeName: 'Log_Request', type: 'bit' }, { name: 'Log_Response', safeName: 'Log_Response', type: 'bit' }, { name: 'Demo', safeName: 'Demo', type: 'bit' }, { name: 'Demo_ContadorNRef', safeName: 'Demo_ContadorNRef', type: 'int' }, { name: 'Frecuencia', safeName: 'Frecuencia', type: 'int' }, { name: '_version', safeName: 'f_version', type: 'int' }, { name: '_fechaReg', safeName: 'f_fechaReg', type: 'datetime' }, { name: '_idUserReg', safeName: 'f_idUserReg', type: 'int' }, { name: '_fechaModif', safeName: 'f_fechaModif', type: 'datetime' }, { name: '_idUserModif', safeName: 'f_idUserModif', type: 'int' }, { name: 'Inactivo', safeName: 'Inactivo', type: 'datetime' }, { name: 'Comodin', safeName: 'Comodin', type: 'varchar' }, { name: 'UsarProxy', safeName: 'UsarProxy', type: 'bit' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('tconectores', mapped);
    console.log(` ✅ TConectores complete!`);
  } catch (e) { console.error(` ❌ Error in TConectores:`, e.message); }

  console.log('Migrating TRRecall_TMRecall (40 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [TRRecall_TMRecall]');
    const cols = [{ name: 'Id', safeName: 'Id', type: 'int' }, { name: 'Id_TRRecall', safeName: 'Id_TRRecall', type: 'int' }, { name: 'Id_TMRecall', safeName: 'Id_TMRecall', type: 'int' }, { name: '_version', safeName: 'f_version', type: 'int' }, { name: '_fechaReg', safeName: 'f_fechaReg', type: 'datetime' }, { name: '_idUserReg', safeName: 'f_idUserReg', type: 'int' }, { name: '_fechaModif', safeName: 'f_fechaModif', type: 'datetime' }, { name: '_idUserModif', safeName: 'f_idUserModif', type: 'int' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('trrecallTmrecall', mapped);
    console.log(` ✅ TRRecall_TMRecall complete!`);
  } catch (e) { console.error(` ❌ Error in TRRecall_TMRecall:`, e.message); }

  console.log('Migrating ATMT_Plantillas (47 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [ATMT_Plantillas]');
    const cols = [{ name: 'IdPlantilla', safeName: 'IdPlantilla', type: 'int' }, { name: 'Descripcion', safeName: 'Descripcion', type: 'varchar' }, { name: 'IdMotivo', safeName: 'IdMotivo', type: 'int' }, { name: 'IdFormato', safeName: 'IdFormato', type: 'int' }, { name: 'PlantillaSMS', safeName: 'PlantillaSMS', type: 'text' }, { name: 'IdDoc', safeName: 'IdDoc', type: 'int' }, { name: '_fechareg', safeName: 'f_fechareg', type: 'smalldatetime' }, { name: 'AsuntoEmail', safeName: 'AsuntoEmail', type: 'varchar' }, { name: 'MarcarCitaRecordada', safeName: 'MarcarCitaRecordada', type: 'bit' }, { name: 'NombrePlantillaMeta', safeName: 'NombrePlantillaMeta', type: 'varchar' }, { name: 'URLImagen', safeName: 'URLImagen', type: 'varchar' }, { name: 'IdPlantillaDefault', safeName: 'IdPlantillaDefault', type: 'varchar' }, { name: 'Inactiva', safeName: 'Inactiva', type: 'datetime' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('atmtPlantillas', mapped);
    console.log(` ✅ ATMT_Plantillas complete!`);
  } catch (e) { console.error(` ❌ Error in ATMT_Plantillas:`, e.message); }

  console.log('Migrating TSeries (58 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [TSeries]');
    const cols = [{ name: 'Doc', safeName: 'Doc', type: 'char' }, { name: 'IdEmisor', safeName: 'IdEmisor', type: 'int' }, { name: 'Serie', safeName: 'Serie', type: 'char' }, { name: 'Anyo', safeName: 'Anyo', type: 'int' }, { name: 'Ultimo', safeName: 'Ultimo', type: 'int' }, { name: 'Activo', safeName: 'Activo', type: 'char' }, { name: 'Id', safeName: 'Id', type: 'int' }, { name: 'CodigoValidacion', safeName: 'CodigoValidacion', type: 'varchar' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('tseries', mapped);
    console.log(` ✅ TSeries complete!`);
  } catch (e) { console.error(` ❌ Error in TSeries:`, e.message); }

  console.log('Migrating TProvin (62 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [TProvin]');
    const cols = [{ name: 'IdProvin', safeName: 'IdProvin', type: 'int' }, { name: 'Descripcio', safeName: 'Descripcio', type: 'varchar' }, { name: 'CodPro', safeName: 'CodPro', type: 'varchar' }, { name: 'IdPais', safeName: 'IdPais', type: 'int' }, { name: '_version', safeName: 'f_version', type: 'int' }, { name: '_fechaReg', safeName: 'f_fechaReg', type: 'datetime' }, { name: '_idUserReg', safeName: 'f_idUserReg', type: 'int' }, { name: '_fechaModif', safeName: 'f_fechaModif', type: 'datetime' }, { name: '_idUserModif', safeName: 'f_idUserModif', type: 'int' }, { name: 'Normalizado', safeName: 'Normalizado', type: 'bit' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('tprovin', mapped);
    console.log(` ✅ TProvin complete!`);
  } catch (e) { console.error(` ❌ Error in TProvin:`, e.message); }

  console.log('Migrating TEspecOMC (66 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [TEspecOMC]');
    const cols = [{ name: 'IdTipoEspec', safeName: 'IdTipoEspec', type: 'int' }, { name: 'CodigoOMC', safeName: 'CodigoOMC', type: 'varchar' }, { name: 'Descripcio', safeName: 'Descripcio', type: 'varchar' }, { name: 'Dental', safeName: 'Dental', type: 'int' }, { name: '_version', safeName: 'f_version', type: 'int' }, { name: '_fechaReg', safeName: 'f_fechaReg', type: 'datetime' }, { name: '_idUserReg', safeName: 'f_idUserReg', type: 'int' }, { name: '_fechaModif', safeName: 'f_fechaModif', type: 'datetime' }, { name: '_idUserModif', safeName: 'f_idUserModif', type: 'int' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('tespecomc', mapped);
    console.log(` ✅ TEspecOMC complete!`);
  } catch (e) { console.error(` ❌ Error in TEspecOMC:`, e.message); }

  console.log('Migrating AgdAccesos (84 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [AgdAccesos]');
    const cols = [{ name: 'IdPerfil', safeName: 'IdPerfil', type: 'int' }, { name: 'IdUsu', safeName: 'IdUsu', type: 'int' }, { name: 'Acceso', safeName: 'Acceso', type: 'int' }, { name: 'Permiso', safeName: 'Permiso', type: 'varchar' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('agdaccesos', mapped);
    console.log(` ✅ AgdAccesos complete!`);
  } catch (e) { console.error(` ❌ Error in AgdAccesos:`, e.message); }

  console.log('Migrating TUsuAOpc (93 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [TUsuAOpc]');
    const cols = [{ name: 'IdUsu', safeName: 'IdUsu', type: 'int' }, { name: 'IdOpc', safeName: 'IdOpc', type: 'varchar' }, { name: 'Descripcio', safeName: 'Descripcio', type: 'varchar' }, { name: 'Imagen', safeName: 'Imagen', type: 'image' }, { name: 'Duracion', safeName: 'Duracion', type: 'int' }, { name: 'LIMITADO', safeName: 'LIMITADO', type: 'varchar' }, { name: 'LIMMATI', safeName: 'LIMMATI', type: 'int' }, { name: 'LIMTARDA', safeName: 'LIMTARDA', type: 'int' }, { name: 'ImagenTxt', safeName: 'ImagenTxt', type: 'text' }, { name: 'DCitasGrp', safeName: 'DCitasGrp', type: 'char' }, { name: 'CantIntegGrp', safeName: 'CantIntegGrp', type: 'int' }, { name: 'Color', safeName: 'Color', type: 'int' }, { name: 'NotaTto', safeName: 'NotaTto', type: 'varchar' }, { name: 'AOOnLine', safeName: 'AOOnLine', type: 'char' }, { name: 'TipoLimitacion', safeName: 'TipoLimitacion', type: 'int' }, { name: 'IdIcono', safeName: 'IdIcono', type: 'int' }, { name: 'Disponible', safeName: 'Disponible', type: 'datetime' }, { name: 'SinBloqueosAutomaticos', safeName: 'SinBloqueosAutomaticos', type: 'bit' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('tusuaopc', mapped);
    console.log(` ✅ TUsuAOpc complete!`);
  } catch (e) { console.error(` ❌ Error in TUsuAOpc:`, e.message); }

  console.log('Migrating PacientesPublic (97 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [PacientesPublic]');
    const cols = [{ name: 'IdPac', safeName: 'IdPac', type: 'int' }, { name: 'FecCreacion', safeName: 'FecCreacion', type: 'datetime' }, { name: 'FecModificacion', safeName: 'FecModificacion', type: 'datetime' }, { name: 'Direccion', safeName: 'Direccion', type: 'varchar' }, { name: 'CP', safeName: 'CP', type: 'varchar' }, { name: 'Poblacion', safeName: 'Poblacion', type: 'varchar' }, { name: 'Provincia', safeName: 'Provincia', type: 'varchar' }, { name: 'Tel1', safeName: 'Tel1', type: 'varchar' }, { name: 'Tel2', safeName: 'Tel2', type: 'varchar' }, { name: 'TelMovil', safeName: 'TelMovil', type: 'varchar' }, { name: 'Fax', safeName: 'Fax', type: 'varchar' }, { name: 'Email', safeName: 'Email', type: 'varchar' }, { name: 'FecNacim', safeName: 'FecNacim', type: 'smalldatetime' }, { name: 'Sexo', safeName: 'Sexo', type: 'varchar' }, { name: 'EstadoCivil', safeName: 'EstadoCivil', type: 'varchar' }, { name: 'Profesion', safeName: 'Profesion', type: 'varchar' }, { name: 'NumHijos', safeName: 'NumHijos', type: 'tinyint' }, { name: 'NIF', safeName: 'NIF', type: 'char' }, { name: 'RefOriTxt', safeName: 'RefOriTxt', type: 'varchar' }, { name: 'Nombre', safeName: 'Nombre', type: 'varchar' }, { name: 'Apellidos', safeName: 'Apellidos', type: 'varchar' }, { name: 'Mailing', safeName: 'Mailing', type: 'bit' }, { name: 'AceptaLOPD', safeName: 'AceptaLOPD', type: 'bit' }, { name: 'AceptaInfo', safeName: 'AceptaInfo', type: 'bit' }, { name: 'AceptaSMS', safeName: 'AceptaSMS', type: 'bit' }, { name: 'Comodin1', safeName: 'Comodin1', type: 'varchar' }, { name: 'Comodin2', safeName: 'Comodin2', type: 'varchar' }, { name: 'Comodin3', safeName: 'Comodin3', type: 'varchar' }, { name: 'Comodin4', safeName: 'Comodin4', type: 'varchar' }, { name: 'Comodin5', safeName: 'Comodin5', type: 'varchar' }, { name: 'Comodin6', safeName: 'Comodin6', type: 'varchar' }, { name: 'Comodin7', safeName: 'Comodin7', type: 'varchar' }, { name: 'AceptaEmail', safeName: 'AceptaEmail', type: 'bit' }, { name: 'AceptaPostal', safeName: 'AceptaPostal', type: 'bit' }, { name: 'AceptaGDPR', safeName: 'AceptaGDPR', type: 'bit' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('pacientespublic', mapped);
    console.log(` ✅ PacientesPublic complete!`);
  } catch (e) { console.error(` ❌ Error in PacientesPublic:`, e.message); }

  console.log('Migrating TConectorParams (98 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [TConectorParams]');
    const cols = [{ name: 'Id', safeName: 'Id', type: 'int' }, { name: 'IdConector', safeName: 'IdConector', type: 'int' }, { name: 'IdEmisor', safeName: 'IdEmisor', type: 'int' }, { name: 'IdCol', safeName: 'IdCol', type: 'int' }, { name: 'Area', safeName: 'Area', type: 'int' }, { name: 'Servicio', safeName: 'Servicio', type: 'int' }, { name: 'Descrip', safeName: 'Descrip', type: 'varchar' }, { name: 'Terminal', safeName: 'Terminal', type: 'varchar' }, { name: 'Usuario', safeName: 'Usuario', type: 'varchar' }, { name: 'LoginPass', safeName: 'LoginPass', type: 'varchar' }, { name: 'URL_WS', safeName: 'URL_WS', type: 'varchar' }, { name: 'Path_XSD', safeName: 'Path_XSD', type: 'varchar' }, { name: '_version', safeName: 'f_version', type: 'int' }, { name: '_fechaReg', safeName: 'f_fechaReg', type: 'datetime' }, { name: '_idUserReg', safeName: 'f_idUserReg', type: 'int' }, { name: '_fechaModif', safeName: 'f_fechaModif', type: 'datetime' }, { name: '_idUserModif', safeName: 'f_idUserModif', type: 'int' }, { name: 'IdCentro', safeName: 'IdCentro', type: 'int' }, { name: 'Comodin1', safeName: 'Comodin1', type: 'varchar' }, { name: 'PathCertificado', safeName: 'PathCertificado', type: 'varchar' }, { name: 'PreShared_Key', safeName: 'PreShared_Key', type: 'varchar' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('tconectorparams', mapped);
    console.log(` ✅ TConectorParams complete!`);
  } catch (e) { console.error(` ❌ Error in TConectorParams:`, e.message); }

  console.log('Migrating EdSubGrp (104 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [EdSubGrp]');
    const cols = [{ name: 'IdGrupo', safeName: 'IdGrupo', type: 'int' }, { name: 'IdSubGrupo', safeName: 'IdSubGrupo', type: 'int' }, { name: 'Titulo', safeName: 'Titulo', type: 'varchar' }, { name: 'Id', safeName: 'Id', type: 'int' }, { name: '_idUserReg', safeName: 'f_idUserReg', type: 'int' }, { name: '_fechaReg', safeName: 'f_fechaReg', type: 'datetime' }, { name: '_idUserModif', safeName: 'f_idUserModif', type: 'int' }, { name: '_fechaModif', safeName: 'f_fechaModif', type: 'datetime' }, { name: '_version', safeName: 'f_version', type: 'int' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('edsubgrp', mapped);
    console.log(` ✅ EdSubGrp complete!`);
  } catch (e) { console.error(` ❌ Error in EdSubGrp:`, e.message); }

  console.log('Migrating TSubTipoAntecedentes (111 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [TSubTipoAntecedentes]');
    const cols = [{ name: 'IdSubTipoAnt', safeName: 'IdSubTipoAnt', type: 'int' }, { name: 'IdTipoAnt', safeName: 'IdTipoAnt', type: 'int' }, { name: 'Descripcion', safeName: 'Descripcion', type: 'varchar' }, { name: 'Agrupado', safeName: 'Agrupado', type: 'bit' }, { name: 'VDM_Id', safeName: 'VDM_Id', type: 'int' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('tsubtipoantecedentes', mapped);
    console.log(` ✅ TSubTipoAntecedentes complete!`);
  } catch (e) { console.error(` ❌ Error in TSubTipoAntecedentes:`, e.message); }

  console.log('Migrating DocsFirmados (135 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [DocsFirmados]');
    const cols = [{ name: 'IdDocFirma', safeName: 'IdDocFirma', type: 'int' }, { name: 'FechaDoc', safeName: 'FechaDoc', type: 'datetime' }, { name: 'FechaIns', safeName: 'FechaIns', type: 'datetime' }, { name: 'TipoDoc', safeName: 'TipoDoc', type: 'int' }, { name: 'TipoFirma', safeName: 'TipoFirma', type: 'int' }, { name: 'Descripcion', safeName: 'Descripcion', type: 'varchar' }, { name: 'Original', safeName: 'Original', type: 'varchar' }, { name: 'Firmado', safeName: 'Firmado', type: 'smalldatetime' }, { name: 'FirmaIdUsu', safeName: 'FirmaIdUsu', type: 'int' }, { name: 'IdOrigen', safeName: 'IdOrigen', type: 'int' }, { name: 'IdPac', safeName: 'IdPac', type: 'int' }, { name: 'IdColFirma', safeName: 'IdColFirma', type: 'int' }, { name: 'Estado', safeName: 'Estado', type: 'int' }, { name: 'FechaPublicado', safeName: 'FechaPublicado', type: 'datetime' }, { name: 'NumRefPublicado', safeName: 'NumRefPublicado', type: 'varchar' }, { name: 'Id_Pluggin', safeName: 'Id_Pluggin', type: 'int' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }, { name: 'FirmadoColaborador', safeName: 'FirmadoColaborador', type: 'datetime' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('docsfirmados', mapped);
    console.log(` ✅ DocsFirmados complete!`);
  } catch (e) { console.error(` ❌ Error in DocsFirmados:`, e.message); }

  console.log('Migrating EdDocs (149 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [EdDocs]');
    const cols = [{ name: 'IdDoc', safeName: 'IdDoc', type: 'int' }, { name: 'IdGrupo', safeName: 'IdGrupo', type: 'int' }, { name: 'IdSubGrupo', safeName: 'IdSubGrupo', type: 'int' }, { name: 'FecCreado', safeName: 'FecCreado', type: 'datetime' }, { name: 'FecModific', safeName: 'FecModific', type: 'datetime' }, { name: 'Titulo', safeName: 'Titulo', type: 'varchar' }, { name: 'IdUsu', safeName: 'IdUsu', type: 'int' }, { name: 'IdTipoEspec', safeName: 'IdTipoEspec', type: 'int' }, { name: 'Publico', safeName: 'Publico', type: 'char' }, { name: 'Firmado', safeName: 'Firmado', type: 'smalldatetime' }, { name: 'FirmaIdUsu', safeName: 'FirmaIdUsu', type: 'int' }, { name: 'IdentTM', safeName: 'IdentTM', type: 'int' }, { name: 'IdCol', safeName: 'IdCol', type: 'int' }, { name: 'IdIdioma', safeName: 'IdIdioma', type: 'int' }, { name: 'IdCentro', safeName: 'IdCentro', type: 'int' }, { name: 'Estado', safeName: 'Estado', type: 'int' }, { name: 'CamposVariablesUsados', safeName: 'CamposVariablesUsados', type: 'varchar' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('eddocs', mapped);
    console.log(` ✅ EdDocs complete!`);
  } catch (e) { console.error(` ❌ Error in EdDocs:`, e.message); }

  console.log('Migrating TPoblaci (181 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [TPoblaci]');
    const cols = [{ name: 'IdPoblacio', safeName: 'IdPoblacio', type: 'int' }, { name: 'Descripcio', safeName: 'Descripcio', type: 'varchar' }, { name: 'IdProvin', safeName: 'IdProvin', type: 'int' }, { name: 'IdPais', safeName: 'IdPais', type: 'int' }, { name: 'CodINE', safeName: 'CodINE', type: 'varchar' }, { name: '_version', safeName: 'f_version', type: 'int' }, { name: '_fechaReg', safeName: 'f_fechaReg', type: 'datetime' }, { name: '_idUserReg', safeName: 'f_idUserReg', type: 'int' }, { name: '_fechaModif', safeName: 'f_fechaModif', type: 'datetime' }, { name: '_idUserModif', safeName: 'f_idUserModif', type: 'int' }, { name: 'Normalizado', safeName: 'Normalizado', type: 'bit' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('tpoblaci', mapped);
    console.log(` ✅ TPoblaci complete!`);
  } catch (e) { console.error(` ❌ Error in TPoblaci:`, e.message); }

  console.log('Migrating EdMail (196 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [EdMail]');
    const cols = [{ name: 'IdRun', safeName: 'IdRun', type: 'int' }, { name: 'FecPrintI', safeName: 'FecPrintI', type: 'smalldatetime' }, { name: 'FecPrintF', safeName: 'FecPrintF', type: 'smalldatetime' }, { name: 'IdUser', safeName: 'IdUser', type: 'int' }, { name: 'IdDoc', safeName: 'IdDoc', type: 'int' }, { name: 'Notas', safeName: 'Notas', type: 'text' }, { name: 'Filtro', safeName: 'Filtro', type: 'text' }, { name: 'IdCentro', safeName: 'IdCentro', type: 'int' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('edmail', mapped);
    console.log(` ✅ EdMail complete!`);
  } catch (e) { console.error(` ❌ Error in EdMail:`, e.message); }

  console.log('Migrating EdMailL (196 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [EdMailL]');
    const cols = [{ name: 'Contador', safeName: 'Contador', type: 'int' }, { name: 'IdRun', safeName: 'IdRun', type: 'int' }, { name: 'IdPac', safeName: 'IdPac', type: 'int' }, { name: 'IdCli', safeName: 'IdCli', type: 'int' }, { name: 'IdUsu', safeName: 'IdUsu', type: 'int' }, { name: 'IdOrden', safeName: 'IdOrden', type: 'int' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('edmaill', mapped);
    console.log(` ✅ EdMailL complete!`);
  } catch (e) { console.error(` ❌ Error in EdMailL:`, e.message); }

  console.log('Migrating RptTempl (225 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [RptTempl]');
    const cols = [{ name: 'IdTemplate', safeName: 'IdTemplate', type: 'int' }, { name: 'IdInforme', safeName: 'IdInforme', type: 'int' }, { name: 'Descripcio', safeName: 'Descripcio', type: 'varchar' }, { name: 'Modificado', safeName: 'Modificado', type: 'smalldatetime' }, { name: 'IdCentro', safeName: 'IdCentro', type: 'int' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('rpttempl', mapped);
    console.log(` ✅ RptTempl complete!`);
  } catch (e) { console.error(` ❌ Error in RptTempl:`, e.message); }

  console.log('Migrating PresuTipoTto (243 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [PresuTipoTto]');
    const cols = [{ name: 'IdPresuTipo', safeName: 'IdPresuTipo', type: 'int' }, { name: 'IdTto', safeName: 'IdTto', type: 'int' }, { name: 'IdCol', safeName: 'IdCol', type: 'int' }, { name: 'Notas', safeName: 'Notas', type: 'text' }, { name: 'Id', safeName: 'Id', type: 'int' }, { name: 'Orden', safeName: 'Orden', type: 'int' }, { name: '_version', safeName: 'f_version', type: 'int' }, { name: '_fechaReg', safeName: 'f_fechaReg', type: 'datetime' }, { name: '_idUserReg', safeName: 'f_idUserReg', type: 'int' }, { name: '_fechaModif', safeName: 'f_fechaModif', type: 'datetime' }, { name: '_idUserModif', safeName: 'f_idUserModif', type: 'int' }, { name: 'LinPre', safeName: 'LinPre', type: 'int' }, { name: 'Actos', safeName: 'Actos', type: 'int' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('presutipotto', mapped);
    console.log(` ✅ PresuTipoTto complete!`);
  } catch (e) { console.error(` ❌ Error in PresuTipoTto:`, e.message); }

  console.log('Migrating CPPoblacio (342 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [CPPoblacio]');
    const cols = [{ name: 'CP', safeName: 'CP', type: 'varchar' }, { name: 'IdPoblacio', safeName: 'IdPoblacio', type: 'int' }, { name: 'Id', safeName: 'Id', type: 'int' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('cppoblacio', mapped);
    console.log(` ✅ CPPoblacio complete!`);
  } catch (e) { console.error(` ❌ Error in CPPoblacio:`, e.message); }

  console.log('Migrating TCalDias (408 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [TCalDias]');
    const cols = [{ name: 'IdCal', safeName: 'IdCal', type: 'int' }, { name: 'IdDia', safeName: 'IdDia', type: 'int' }, { name: 'IdUsu', safeName: 'IdUsu', type: 'int' }, { name: 'IdSit', safeName: 'IdSit', type: 'int' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('tcaldias', mapped);
    console.log(` ✅ TCalDias complete!`);
  } catch (e) { console.error(` ❌ Error in TCalDias:`, e.message); }

  console.log('Migrating DispositivoPac (452 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [DispositivoPac]');
    const cols = [{ name: 'IdPac', safeName: 'IdPac', type: 'int' }, { name: 'Tipo', safeName: 'Tipo', type: 'int' }, { name: 'IdTipo', safeName: 'IdTipo', type: 'varchar' }, { name: 'AFirmar', safeName: 'AFirmar', type: 'bit' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('dispositivopac', mapped);
    console.log(` ✅ DispositivoPac complete!`);
  } catch (e) { console.error(` ❌ Error in DispositivoPac:`, e.message); }

  console.log('Migrating RptDefec (612 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [RptDefec]');
    const cols = [{ name: 'IdCentro', safeName: 'IdCentro', type: 'int' }, { name: 'IdUser', safeName: 'IdUser', type: 'int' }, { name: 'IdAccionRp', safeName: 'IdAccionRp', type: 'int' }, { name: 'IdInforme', safeName: 'IdInforme', type: 'int' }, { name: 'IdTemplate', safeName: 'IdTemplate', type: 'int' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('rptdefec', mapped);
    console.log(` ✅ RptDefec complete!`);
  } catch (e) { console.error(` ❌ Error in RptDefec:`, e.message); }

  console.log('Migrating Tratamientos (628 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [Tratamientos]');
    const cols = [{ name: 'IdTratamiento', safeName: 'IdTratamiento', type: 'int' }, { name: 'Codigo', safeName: 'Codigo', type: 'varchar' }, { name: 'DescripMed', safeName: 'DescripMed', type: 'varchar' }, { name: 'DescripPac', safeName: 'DescripPac', type: 'varchar' }, { name: 'DescripAgd', safeName: 'DescripAgd', type: 'varchar' }, { name: 'CodInt', safeName: 'CodInt', type: 'varchar' }, { name: 'IdTipoODG', safeName: 'IdTipoODG', type: 'int' }, { name: 'IdTipoEspec', safeName: 'IdTipoEspec', type: 'int' }, { name: 'IdEspecOMC', safeName: 'IdEspecOMC', type: 'int' }, { name: 'IdGrupo', safeName: 'IdGrupo', type: 'int' }, { name: 'IdTipoStd', safeName: 'IdTipoStd', type: 'int' }, { name: 'NumFases', safeName: 'NumFases', type: 'tinyint' }, { name: 'Duracion', safeName: 'Duracion', type: 'int' }, { name: 'Piezas', safeName: 'Piezas', type: 'tinyint' }, { name: 'Guia', safeName: 'Guia', type: 'bit' }, { name: 'Actos', safeName: 'Actos', type: 'int' }, { name: 'LimitNDias', safeName: 'LimitNDias', type: 'int' }, { name: 'LimitNActos', safeName: 'LimitNActos', type: 'int' }, { name: 'TipoLimitacion', safeName: 'TipoLimitacion', type: 'int' }, { name: 'SoloPresupuestos', safeName: 'SoloPresupuestos', type: 'int' }, { name: 'NoPlanificable', safeName: 'NoPlanificable', type: 'int' }, { name: 'AgdPrimeraVisita', safeName: 'AgdPrimeraVisita', type: 'int' }, { name: 'DesglosaFases', safeName: 'DesglosaFases', type: 'int' }, { name: 'ConGarantia', safeName: 'ConGarantia', type: 'int' }, { name: 'PrecioReferencia', safeName: 'PrecioReferencia', type: 'numeric' }, { name: 'IdIcono', safeName: 'IdIcono', type: 'int' }, { name: 'Inactivo', safeName: 'Inactivo', type: 'datetime' }, { name: 'Desde', safeName: 'Desde', type: 'datetime' }, { name: 'Hasta', safeName: 'Hasta', type: 'datetime' }, { name: '_fechareg', safeName: 'f_fechareg', type: 'datetime' }, { name: '_version', safeName: 'f_version', type: 'int' }, { name: 'GeneraTrabajoProtesis', safeName: 'GeneraTrabajoProtesis', type: 'int' }, { name: 'AgdOnline', safeName: 'AgdOnline', type: 'int' }, { name: 'NoDesglosarPresu', safeName: 'NoDesglosarPresu', type: 'int' }, { name: 'Cuotas', safeName: 'Cuotas', type: 'int' }, { name: 'TipoCalcFase', safeName: 'TipoCalcFase', type: 'int' }, { name: 'GUID', safeName: 'GUID', type: 'varchar' }, { name: 'Id_VisitReason', safeName: 'Id_VisitReason', type: 'int' }, { name: 'Id_ResourcePlan', safeName: 'Id_ResourcePlan', type: 'int' }, { name: 'Id_TipoPresupuesto', safeName: 'Id_TipoPresupuesto', type: 'int' }, { name: 'TipoEnvioProtesico', safeName: 'TipoEnvioProtesico', type: 'int' }, { name: 'Id_TipoColab', safeName: 'Id_TipoColab', type: 'int' }, { name: 'PlanEcoTratamInicial', safeName: 'PlanEcoTratamInicial', type: 'bit' }, { name: 'PlanEcoTratamCuota', safeName: 'PlanEcoTratamCuota', type: 'bit' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }, { name: 'Id_TMRecall', safeName: 'Id_TMRecall', type: 'int' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('tratamientos', mapped);
    console.log(` ✅ Tratamientos complete!`);
  } catch (e) { console.error(` ❌ Error in Tratamientos:`, e.message); }

  console.log('Migrating TratamientosFases (628 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [TratamientosFases]');
    const cols = [{ name: 'IdTratamientoFase', safeName: 'IdTratamientoFase', type: 'int' }, { name: 'IdTratamiento', safeName: 'IdTratamiento', type: 'int' }, { name: 'DescripMed', safeName: 'DescripMed', type: 'varchar' }, { name: 'Observaciones', safeName: 'Observaciones', type: 'text' }, { name: 'Duracion', safeName: 'Duracion', type: 'int' }, { name: 'TpcFacturar', safeName: 'TpcFacturar', type: 'numeric' }, { name: 'MinDias', safeName: 'MinDias', type: 'int' }, { name: 'MaxDias', safeName: 'MaxDias', type: 'int' }, { name: 'OrdenEjecucion', safeName: 'OrdenEjecucion', type: 'int' }, { name: '_fechareg', safeName: 'f_fechareg', type: 'datetime' }, { name: '_version', safeName: 'f_version', type: 'int' }, { name: 'DuracionBase', safeName: 'DuracionBase', type: 'int' }, { name: 'DuracionPorRango', safeName: 'DuracionPorRango', type: 'bit' }, { name: 'IdIcono', safeName: 'IdIcono', type: 'int' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('tratamientosfases', mapped);
    console.log(` ✅ TratamientosFases complete!`);
  } catch (e) { console.error(` ❌ Error in TratamientosFases:`, e.message); }

  console.log('Migrating Tratamientos_Tarifas_Precios (639 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [Tratamientos_Tarifas_Precios]');
    const cols = [{ name: 'IdTratamientoTarifaPrecio', safeName: 'IdTratamientoTarifaPrecio', type: 'int' }, { name: 'Fecha', safeName: 'Fecha', type: 'datetime' }, { name: 'IdTratamientoTarifa', safeName: 'IdTratamientoTarifa', type: 'int' }, { name: 'PrecioPrivado', safeName: 'PrecioPrivado', type: 'numeric' }, { name: 'PrecioVariable', safeName: 'PrecioVariable', type: 'tinyint' }, { name: 'PrecioMutua', safeName: 'PrecioMutua', type: 'numeric' }, { name: 'PrecioColaborador', safeName: 'PrecioColaborador', type: 'numeric' }, { name: 'CargoMutua', safeName: 'CargoMutua', type: 'int' }, { name: 'Inactivo', safeName: 'Inactivo', type: 'datetime' }, { name: '_fechareg', safeName: 'f_fechareg', type: 'datetime' }, { name: '_version', safeName: 'f_version', type: 'int' }, { name: 'PrecioMinimo', safeName: 'PrecioMinimo', type: 'numeric' }, { name: '_idUserReg', safeName: 'f_idUserReg', type: 'int' }, { name: '_fechaModif', safeName: 'f_fechaModif', type: 'datetime' }, { name: '_idUserModif', safeName: 'f_idUserModif', type: 'int' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('tratamientosTarifasPrecios', mapped);
    console.log(` ✅ Tratamientos_Tarifas_Precios complete!`);
  } catch (e) { console.error(` ❌ Error in Tratamientos_Tarifas_Precios:`, e.message); }

  console.log('Migrating Tratamientos_Tarifas (646 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [Tratamientos_Tarifas]');
    const cols = [{ name: 'IdTratamientoTarifa', safeName: 'IdTratamientoTarifa', type: 'int' }, { name: 'IdTratamiento', safeName: 'IdTratamiento', type: 'int' }, { name: 'IdTarifa', safeName: 'IdTarifa', type: 'int' }, { name: 'IdTipoEspec', safeName: 'IdTipoEspec', type: 'int' }, { name: 'IdGrupo', safeName: 'IdGrupo', type: 'int' }, { name: 'CodTto', safeName: 'CodTto', type: 'varchar' }, { name: 'CodInt', safeName: 'CodInt', type: 'varchar' }, { name: 'Autoriz', safeName: 'Autoriz', type: 'char' }, { name: 'Inactivo', safeName: 'Inactivo', type: 'datetime' }, { name: '_fechareg', safeName: 'f_fechareg', type: 'datetime' }, { name: '_version', safeName: 'f_version', type: 'int' }, { name: 'IdCCGrupo', safeName: 'IdCCGrupo', type: 'int' }, { name: 'IdCCBeneficioAdicional', safeName: 'IdCCBeneficioAdicional', type: 'int' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('tratamientosTarifas', mapped);
    console.log(` ✅ Tratamientos_Tarifas complete!`);
  } catch (e) { console.error(` ❌ Error in Tratamientos_Tarifas:`, e.message); }

  console.log('Migrating CfgDatos (694 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [CfgDatos]');
    const cols = [{ name: 'IdCentro', safeName: 'IdCentro', type: 'int' }, { name: 'IdCfg', safeName: 'IdCfg', type: 'int' }, { name: 'Valor', safeName: 'Valor', type: 'varchar' }, { name: 'IdCfgDatos', safeName: 'IdCfgDatos', type: 'int' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }, { name: '_version', safeName: 'f_version', type: 'int' }, { name: '_fechaReg', safeName: 'f_fechaReg', type: 'datetime' }, { name: '_idUserReg', safeName: 'f_idUserReg', type: 'int' }, { name: '_fechaModif', safeName: 'f_fechaModif', type: 'datetime' }, { name: '_idUserModif', safeName: 'f_idUserModif', type: 'int' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('cfgdatos', mapped);
    console.log(` ✅ CfgDatos complete!`);
  } catch (e) { console.error(` ❌ Error in CfgDatos:`, e.message); }

  console.log('Migrating TTratamientos (956 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [TTratamientos]');
    const cols = [{ name: 'IdPac', safeName: 'IdPac', type: 'int' }, { name: 'IdTrat', safeName: 'IdTrat', type: 'int' }, { name: 'Dosificacion', safeName: 'Dosificacion', type: 'text' }, { name: 'FecIns', safeName: 'FecIns', type: 'datetime' }, { name: 'Fecha', safeName: 'Fecha', type: 'datetime' }, { name: 'IdUsu', safeName: 'IdUsu', type: 'int' }, { name: 'Publico', safeName: 'Publico', type: 'char' }, { name: 'IdFarmaco', safeName: 'IdFarmaco', type: 'int' }, { name: 'DescFarmaco', safeName: 'DescFarmaco', type: 'varchar' }, { name: 'FecFin', safeName: 'FecFin', type: 'datetime' }, { name: 'IdTipoEspec', safeName: 'IdTipoEspec', type: 'int' }, { name: 'Observac', safeName: 'Observac', type: 'varchar' }, { name: 'IdCentro', safeName: 'IdCentro', type: 'int' }, { name: 'IdVisita', safeName: 'IdVisita', type: 'int' }, { name: 'Tipo', safeName: 'Tipo', type: 'int' }, { name: 'Dosis', safeName: 'Dosis', type: 'varchar' }, { name: 'ViaAdmin', safeName: 'ViaAdmin', type: 'varchar' }, { name: 'Frecuencia', safeName: 'Frecuencia', type: 'varchar' }, { name: 'CId', safeName: 'CId', type: 'nvarchar' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }, { name: '_version', safeName: 'f_version', type: 'int' }, { name: '_fechaReg', safeName: 'f_fechaReg', type: 'datetime' }, { name: '_idUserReg', safeName: 'f_idUserReg', type: 'int' }, { name: '_fechaModif', safeName: 'f_fechaModif', type: 'datetime' }, { name: '_idUserModif', safeName: 'f_idUserModif', type: 'int' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('ttratamientos', mapped);
    console.log(` ✅ TTratamientos complete!`);
  } catch (e) { console.error(` ❌ Error in TTratamientos:`, e.message); }

  console.log('Migrating ExplPerio (960 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [ExplPerio]');
    const cols = [{ name: 'IdPac', safeName: 'IdPac', type: 'int' }, { name: 'IdExplPer', safeName: 'IdExplPer', type: 'int' }, { name: 'NDent', safeName: 'NDent', type: 'tinyint' }, { name: 'borsa1', safeName: 'borsa1', type: 'tinyint' }, { name: 'borsa2', safeName: 'borsa2', type: 'tinyint' }, { name: 'borsa3', safeName: 'borsa3', type: 'tinyint' }, { name: 'borsa4', safeName: 'borsa4', type: 'tinyint' }, { name: 'borsa5', safeName: 'borsa5', type: 'tinyint' }, { name: 'borsa6', safeName: 'borsa6', type: 'tinyint' }, { name: 'recessio1', safeName: 'recessio1', type: 'tinyint' }, { name: 'recessio2', safeName: 'recessio2', type: 'tinyint' }, { name: 'recessio3', safeName: 'recessio3', type: 'tinyint' }, { name: 'recessio4', safeName: 'recessio4', type: 'tinyint' }, { name: 'recessio5', safeName: 'recessio5', type: 'tinyint' }, { name: 'recessio6', safeName: 'recessio6', type: 'tinyint' }, { name: 'sangrat1', safeName: 'sangrat1', type: 'char' }, { name: 'sangrat2', safeName: 'sangrat2', type: 'char' }, { name: 'sangrat3', safeName: 'sangrat3', type: 'char' }, { name: 'sangrat4', safeName: 'sangrat4', type: 'char' }, { name: 'placa1', safeName: 'placa1', type: 'char' }, { name: 'placa2', safeName: 'placa2', type: 'char' }, { name: 'placa3', safeName: 'placa3', type: 'char' }, { name: 'placa4', safeName: 'placa4', type: 'char' }, { name: 'movilitat1', safeName: 'movilitat1', type: 'int' }, { name: 'movilitat2', safeName: 'movilitat2', type: 'char' }, { name: 'Id', safeName: 'Id', type: 'int' }, { name: '_version', safeName: 'f_version', type: 'int' }, { name: '_fechaReg', safeName: 'f_fechaReg', type: 'datetime' }, { name: '_idUserReg', safeName: 'f_idUserReg', type: 'int' }, { name: '_fechaModif', safeName: 'f_fechaModif', type: 'datetime' }, { name: '_idUserModif', safeName: 'f_idUserModif', type: 'int' }, { name: 'Id_PacPerio', safeName: 'Id_PacPerio', type: 'int' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('explperio', mapped);
    console.log(` ✅ ExplPerio complete!`);
  } catch (e) { console.error(` ❌ Error in ExplPerio:`, e.message); }

  console.log('Migrating AlertPac (1053 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [AlertPac]');
    const cols = [{ name: 'IdCentro', safeName: 'IdCentro', type: 'int' }, { name: 'IdPac', safeName: 'IdPac', type: 'int' }, { name: 'NumAlerta', safeName: 'NumAlerta', type: 'int' }, { name: 'Texto', safeName: 'Texto', type: 'varchar' }, { name: 'Marcado', safeName: 'Marcado', type: 'bit' }, { name: 'Id', safeName: 'Id', type: 'int' }, { name: '_version', safeName: 'f_version', type: 'int' }, { name: '_fechaReg', safeName: 'f_fechaReg', type: 'datetime' }, { name: '_idUserReg', safeName: 'f_idUserReg', type: 'int' }, { name: '_fechaModif', safeName: 'f_fechaModif', type: 'datetime' }, { name: '_idUserModif', safeName: 'f_idUserModif', type: 'int' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('alertpac', mapped);
    console.log(` ✅ AlertPac complete!`);
  } catch (e) { console.error(` ❌ Error in AlertPac:`, e.message); }

  console.log('Migrating Recalls (1147 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [Recalls]');
    const cols = [{ name: 'IdPac', safeName: 'IdPac', type: 'int' }, { name: 'NumRec', safeName: 'NumRec', type: 'int' }, { name: 'Fecha', safeName: 'Fecha', type: 'smalldatetime' }, { name: 'IdMotivo', safeName: 'IdMotivo', type: 'int' }, { name: 'Comentario', safeName: 'Comentario', type: 'varchar' }, { name: 'Hora', safeName: 'Hora', type: 'smalldatetime' }, { name: 'Telefono', safeName: 'Telefono', type: 'bit' }, { name: 'Carta', safeName: 'Carta', type: 'bit' }, { name: 'EMail', safeName: 'EMail', type: 'bit' }, { name: 'SMS', safeName: 'SMS', type: 'bit' }, { name: 'Asistido', safeName: 'Asistido', type: 'bit' }, { name: 'IdCol', safeName: 'IdCol', type: 'int' }, { name: 'Citado', safeName: 'Citado', type: 'bit' }, { name: 'IdCentro', safeName: 'IdCentro', type: 'int' }, { name: 'FechaContacto', safeName: 'FechaContacto', type: 'datetime' }, { name: 'IdColRevisa', safeName: 'IdColRevisa', type: 'int' }, { name: 'IdEstado', safeName: 'IdEstado', type: 'int' }, { name: 'Observaciones', safeName: 'Observaciones', type: 'varchar' }, { name: 'IdResultado', safeName: 'IdResultado', type: 'int' }, { name: 'IdUsuRealiza', safeName: 'IdUsuRealiza', type: 'int' }, { name: '_iduser', safeName: 'f_iduser', type: 'int' }, { name: '_fechareg', safeName: 'f_fechareg', type: 'datetime' }, { name: 'IdOpc', safeName: 'IdOpc', type: 'varchar' }, { name: 'Id', safeName: 'Id', type: 'int' }, { name: '_version', safeName: 'f_version', type: 'int' }, { name: '_fechaModif', safeName: 'f_fechaModif', type: 'datetime' }, { name: '_idUserModif', safeName: 'f_idUserModif', type: 'int' }, { name: 'IdUsuCita', safeName: 'IdUsuCita', type: 'int' }, { name: 'IdOrdenCita', safeName: 'IdOrdenCita', type: 'int' }, { name: 'IdRecallOrigen', safeName: 'IdRecallOrigen', type: 'int' }, { name: 'IdUsuCitaOrigen', safeName: 'IdUsuCitaOrigen', type: 'int' }, { name: 'IdOrdenCitaOrigen', safeName: 'IdOrdenCitaOrigen', type: 'int' }, { name: 'Id_Presu', safeName: 'Id_Presu', type: 'int' }, { name: 'Id_Sch_Appointments', safeName: 'Id_Sch_Appointments', type: 'int' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }, { name: 'Id_TtosMed', safeName: 'Id_TtosMed', type: 'int' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('recalls', mapped);
    console.log(` ✅ Recalls complete!`);
  } catch (e) { console.error(` ❌ Error in Recalls:`, e.message); }

  console.log('Migrating RecallsLog (1159 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [RecallsLog]');
    const cols = [{ name: 'Id', safeName: 'Id', type: 'int' }, { name: '_version', safeName: 'f_version', type: 'int' }, { name: '_fechaReg', safeName: 'f_fechaReg', type: 'datetime' }, { name: '_idUserReg', safeName: 'f_idUserReg', type: 'int' }, { name: '_fechaModif', safeName: 'f_fechaModif', type: 'datetime' }, { name: '_idUserModif', safeName: 'f_idUserModif', type: 'int' }, { name: 'IdRecall', safeName: 'IdRecall', type: 'int' }, { name: 'Fecha', safeName: 'Fecha', type: 'smalldatetime' }, { name: 'IdMotivo', safeName: 'IdMotivo', type: 'int' }, { name: 'Comentario', safeName: 'Comentario', type: 'varchar' }, { name: 'Hora', safeName: 'Hora', type: 'smalldatetime' }, { name: 'Telefono', safeName: 'Telefono', type: 'bit' }, { name: 'Carta', safeName: 'Carta', type: 'bit' }, { name: 'EMail', safeName: 'EMail', type: 'bit' }, { name: 'SMS', safeName: 'SMS', type: 'bit' }, { name: 'Asistido', safeName: 'Asistido', type: 'bit' }, { name: 'IdCol', safeName: 'IdCol', type: 'int' }, { name: 'Citado', safeName: 'Citado', type: 'bit' }, { name: 'IdCentro', safeName: 'IdCentro', type: 'int' }, { name: 'FechaContacto', safeName: 'FechaContacto', type: 'datetime' }, { name: 'IdColRevisa', safeName: 'IdColRevisa', type: 'int' }, { name: 'IdEstado', safeName: 'IdEstado', type: 'int' }, { name: 'Observaciones', safeName: 'Observaciones', type: 'varchar' }, { name: 'IdResultado', safeName: 'IdResultado', type: 'int' }, { name: 'IdUsuRealiza', safeName: 'IdUsuRealiza', type: 'int' }, { name: 'IdOpc', safeName: 'IdOpc', type: 'varchar' }, { name: 'IdUsuCita', safeName: 'IdUsuCita', type: 'int' }, { name: 'IdOrdenCita', safeName: 'IdOrdenCita', type: 'int' }, { name: 'IdRecallOrigen', safeName: 'IdRecallOrigen', type: 'int' }, { name: 'Id_Presu', safeName: 'Id_Presu', type: 'int' }, { name: 'Id_Sch_Appointments', safeName: 'Id_Sch_Appointments', type: 'int' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }, { name: 'Id_TtosMed', safeName: 'Id_TtosMed', type: 'int' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('recallslog', mapped);
    console.log(` ✅ RecallsLog complete!`);
  } catch (e) { console.error(` ❌ Error in RecallsLog:`, e.message); }

  console.log('Migrating TalonRecetaCVE (1202 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [TalonRecetaCVE]');
    const cols = [{ name: 'IdTalonRecetaCVE', safeName: 'IdTalonRecetaCVE', type: 'int' }, { name: 'IdTalonReceta', safeName: 'IdTalonReceta', type: 'int' }, { name: 'Numero', safeName: 'Numero', type: 'varchar' }, { name: 'CVE', safeName: 'CVE', type: 'varchar' }, { name: 'Utilizado', safeName: 'Utilizado', type: 'int' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('talonrecetacve', mapped);
    console.log(` ✅ TalonRecetaCVE complete!`);
  } catch (e) { console.error(` ❌ Error in TalonRecetaCVE:`, e.message); }

  console.log('Migrating TDocumentosPac (1217 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [TDocumentosPac]');
    const cols = [{ name: 'IdDocPac', safeName: 'IdDocPac', type: 'int' }, { name: 'IdPac', safeName: 'IdPac', type: 'int' }, { name: 'FechaDoc', safeName: 'FechaDoc', type: 'datetime' }, { name: 'FechaIns', safeName: 'FechaIns', type: 'datetime' }, { name: 'Descripcion', safeName: 'Descripcion', type: 'varchar' }, { name: 'Original', safeName: 'Original', type: 'varchar' }, { name: 'Notas', safeName: 'Notas', type: 'text' }, { name: 'IdUsu', safeName: 'IdUsu', type: 'int' }, { name: 'TipoDoc', safeName: 'TipoDoc', type: 'int' }, { name: 'Firmado', safeName: 'Firmado', type: 'smalldatetime' }, { name: 'FirmaIdUsu', safeName: 'FirmaIdUsu', type: 'int' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('tdocumentospac', mapped);
    console.log(` ✅ TDocumentosPac complete!`);
  } catch (e) { console.error(` ❌ Error in TDocumentosPac:`, e.message); }

  console.log('Migrating RecetasDet (1258 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [RecetasDet]');
    const cols = [{ name: 'IdPac', safeName: 'IdPac', type: 'int' }, { name: 'IdReceta', safeName: 'IdReceta', type: 'int' }, { name: 'IdTrat', safeName: 'IdTrat', type: 'int' }, { name: 'DescFarmaco', safeName: 'DescFarmaco', type: 'varchar' }, { name: 'DispPrev', safeName: 'DispPrev', type: 'datetime' }, { name: 'Duracion', safeName: 'Duracion', type: 'varchar' }, { name: 'Envases', safeName: 'Envases', type: 'int' }, { name: 'OrdenDisp', safeName: 'OrdenDisp', type: 'int' }, { name: 'Pauta', safeName: 'Pauta', type: 'varchar' }, { name: 'Posologia', safeName: 'Posologia', type: 'varchar' }, { name: 'Unidades', safeName: 'Unidades', type: 'varchar' }, { name: 'IdRecetaDet', safeName: 'IdRecetaDet', type: 'int' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('recetasdet', mapped);
    console.log(` ✅ RecetasDet complete!`);
  } catch (e) { console.error(` ❌ Error in RecetasDet:`, e.message); }

  console.log('Migrating RecetasCab (1258 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [RecetasCab]');
    const cols = [{ name: 'IdPac', safeName: 'IdPac', type: 'int' }, { name: 'IdUsu', safeName: 'IdUsu', type: 'int' }, { name: 'IdTipoEspec', safeName: 'IdTipoEspec', type: 'int' }, { name: 'Fecha', safeName: 'Fecha', type: 'datetime' }, { name: 'Descripcio', safeName: 'Descripcio', type: 'varchar' }, { name: 'FecIns', safeName: 'FecIns', type: 'datetime' }, { name: 'IdEmisor', safeName: 'IdEmisor', type: 'int' }, { name: 'IdCol', safeName: 'IdCol', type: 'int' }, { name: 'Publico', safeName: 'Publico', type: 'char' }, { name: 'FechaImpresion', safeName: 'FechaImpresion', type: 'datetime' }, { name: 'Notas', safeName: 'Notas', type: 'text' }, { name: 'IdCentro', safeName: 'IdCentro', type: 'int' }, { name: 'IdVisita', safeName: 'IdVisita', type: 'int' }, { name: 'IdTalonRecetaCVE', safeName: 'IdTalonRecetaCVE', type: 'int' }, { name: 'NotasFarmaceutico', safeName: 'NotasFarmaceutico', type: 'text' }, { name: 'Diagnostico', safeName: 'Diagnostico', type: 'varchar' }, { name: 'TipoReceta', safeName: 'TipoReceta', type: 'int' }, { name: 'IdRecetaIdent', safeName: 'IdRecetaIdent', type: 'int' }, { name: 'CVE', safeName: 'CVE', type: 'varchar' }, { name: 'Dispensada', safeName: 'Dispensada', type: 'datetime' }, { name: 'NumImpresiones', safeName: 'NumImpresiones', type: 'int' }, { name: 'Anulada', safeName: 'Anulada', type: 'datetime' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('recetascab', mapped);
    console.log(` ✅ RecetasCab complete!`);
  } catch (e) { console.error(` ❌ Error in RecetasCab:`, e.message); }

  console.log('Migrating DCitasLogSit (1265 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [DCitasLogSit]');
    const cols = [{ name: 'IdCitasLogSit', safeName: 'IdCitasLogSit', type: 'int' }, { name: 'IdUsu', safeName: 'IdUsu', type: 'int' }, { name: 'IdOrden', safeName: 'IdOrden', type: 'int' }, { name: 'IdSitC', safeName: 'IdSitC', type: 'int' }, { name: 'HorSitCita', safeName: 'HorSitCita', type: 'datetime' }, { name: 'HorFinSit', safeName: 'HorFinSit', type: 'datetime' }, { name: 'IdUserLog', safeName: 'IdUserLog', type: 'int' }, { name: 'IdMotivoAnulacion', safeName: 'IdMotivoAnulacion', type: 'int' }, { name: 'MotivoAnulacion', safeName: 'MotivoAnulacion', type: 'varchar' }, { name: '_fechaReg', safeName: 'f_fechaReg', type: 'datetime' }, { name: 'IdOrigenSitCita', safeName: 'IdOrigenSitCita', type: 'int' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('dcitaslogsit', mapped);
    console.log(` ✅ DCitasLogSit complete!`);
  } catch (e) { console.error(` ❌ Error in DCitasLogSit:`, e.message); }

  console.log('Migrating DCitasF (1681 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [DCitasF]');
    const cols = [{ name: 'IdUsu', safeName: 'IdUsu', type: 'int' }, { name: 'IdOrden', safeName: 'IdOrden', type: 'int' }, { name: 'IdOpc', safeName: 'IdOpc', type: 'varchar' }, { name: 'IdPac', safeName: 'IdPac', type: 'int' }, { name: 'Fecha', safeName: 'Fecha', type: 'int' }, { name: 'Hora', safeName: 'Hora', type: 'int' }, { name: 'Notas', safeName: 'Notas', type: 'text' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('dcitasf', mapped);
    console.log(` ✅ DCitasF complete!`);
  } catch (e) { console.error(` ❌ Error in DCitasF:`, e.message); }

  console.log('Migrating PacientesLog (1930 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [PacientesLog]');
    const cols = [{ name: 'Id', safeName: 'Id', type: 'int' }, { name: '_fechaReg', safeName: 'f_fechaReg', type: 'datetime' }, { name: '_idUserReg', safeName: 'f_idUserReg', type: 'int' }, { name: 'IdPac', safeName: 'IdPac', type: 'int' }, { name: 'AceptaGDPR', safeName: 'AceptaGDPR', type: 'bit' }, { name: 'Derivado', safeName: 'Derivado', type: 'bit' }, { name: 'NoContactable', safeName: 'NoContactable', type: 'bit' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('pacienteslog', mapped);
    console.log(` ✅ PacientesLog complete!`);
  } catch (e) { console.error(` ❌ Error in PacientesLog:`, e.message); }

  console.log('Migrating Accesos (2718 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [Accesos]');
    const cols = [{ name: 'IdPerfil', safeName: 'IdPerfil', type: 'int' }, { name: 'Accion', safeName: 'Accion', type: 'varchar' }, { name: 'Acceso', safeName: 'Acceso', type: 'tinyint' }, { name: 'Limitador', safeName: 'Limitador', type: 'int' }, { name: 'Permiso', safeName: 'Permiso', type: 'varchar' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('accesos', mapped);
    console.log(` ✅ Accesos complete!`);
  } catch (e) { console.error(` ❌ Error in Accesos:`, e.message); }

  console.log('Migrating LogErrores (2881 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [LogErrores]');
    const cols = [{ name: 'IdLog', safeName: 'IdLog', type: 'int' }, { name: 'ApplicationName', safeName: 'ApplicationName', type: 'varchar' }, { name: 'VersionInfo', safeName: 'VersionInfo', type: 'text' }, { name: 'ExceptClassName', safeName: 'ExceptClassName', type: 'varchar' }, { name: 'ExceptMenssage', safeName: 'ExceptMenssage', type: 'text' }, { name: 'LogException', safeName: 'LogException', type: 'text' }, { name: 'LogAdicional', safeName: 'LogAdicional', type: 'text' }, { name: '_FechaReg', safeName: 'f_FechaReg', type: 'datetime' }, { name: 'ScreenShot', safeName: 'ScreenShot', type: 'image' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('logerrores', mapped);
    console.log(` ✅ LogErrores complete!`);
  } catch (e) { console.error(` ❌ Error in LogErrores:`, e.message); }

  console.log('Migrating Pacientes (6117 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [Pacientes]');
    const cols = [{ name: 'IdPac', safeName: 'IdPac', type: 'int' }, { name: 'IdCli', safeName: 'IdCli', type: 'int' }, { name: 'IdCliPac', safeName: 'IdCliPac', type: 'int' }, { name: 'NumPac', safeName: 'NumPac', type: 'varchar' }, { name: 'IdMutDefec', safeName: 'IdMutDefec', type: 'int' }, { name: 'IdCliDefec', safeName: 'IdCliDefec', type: 'int' }, { name: 'Nombre', safeName: 'Nombre', type: 'varchar' }, { name: 'Apellidos', safeName: 'Apellidos', type: 'varchar' }, { name: 'NIF', safeName: 'NIF', type: 'char' }, { name: 'Direccion', safeName: 'Direccion', type: 'varchar' }, { name: 'IdPoblacio', safeName: 'IdPoblacio', type: 'int' }, { name: 'CP', safeName: 'CP', type: 'varchar' }, { name: 'Tel1', safeName: 'Tel1', type: 'varchar' }, { name: 'Tel2', safeName: 'Tel2', type: 'varchar' }, { name: 'TelMovil', safeName: 'TelMovil', type: 'varchar' }, { name: 'Fax', safeName: 'Fax', type: 'varchar' }, { name: 'Email', safeName: 'Email', type: 'varchar' }, { name: 'Web', safeName: 'Web', type: 'varchar' }, { name: 'FecNacim', safeName: 'FecNacim', type: 'smalldatetime' }, { name: 'Comodin1', safeName: 'Comodin1', type: 'varchar' }, { name: 'Comodin2', safeName: 'Comodin2', type: 'varchar' }, { name: 'Comodin3', safeName: 'Comodin3', type: 'varchar' }, { name: 'Comodin4', safeName: 'Comodin4', type: 'varchar' }, { name: 'Comodin5', safeName: 'Comodin5', type: 'varchar' }, { name: 'Comodin6', safeName: 'Comodin6', type: 'varchar' }, { name: 'IdRefOri', safeName: 'IdRefOri', type: 'int' }, { name: 'RefOriTxt', safeName: 'RefOriTxt', type: 'varchar' }, { name: 'IdRefDes', safeName: 'IdRefDes', type: 'int' }, { name: 'Descuento', safeName: 'Descuento', type: 'tinyint' }, { name: 'IdProfesio', safeName: 'IdProfesio', type: 'int' }, { name: 'IdEcivil', safeName: 'IdEcivil', type: 'int' }, { name: 'NumHijos', safeName: 'NumHijos', type: 'tinyint' }, { name: 'Sexo', safeName: 'Sexo', type: 'varchar' }, { name: 'IdTrato', safeName: 'IdTrato', type: 'int' }, { name: 'Foto', safeName: 'Foto', type: 'int' }, { name: 'IdEstado', safeName: 'IdEstado', type: 'int' }, { name: 'Mailing', safeName: 'Mailing', type: 'bit' }, { name: 'Notas', safeName: 'Notas', type: 'text' }, { name: 'FecAlta', safeName: 'FecAlta', type: 'datetime' }, { name: 'TipoOdg', safeName: 'TipoOdg', type: 'tinyint' }, { name: 'AceptaLOPD', safeName: 'AceptaLOPD', type: 'bit' }, { name: 'AceptaInfo', safeName: 'AceptaInfo', type: 'bit' }, { name: 'AceptaSMS', safeName: 'AceptaSMS', type: 'bit' }, { name: 'IdCol', safeName: 'IdCol', type: 'int' }, { name: 'IdColAux', safeName: 'IdColAux', type: 'int' }, { name: 'AgNumVis', safeName: 'AgNumVis', type: 'int' }, { name: 'AgTpoTotE', safeName: 'AgTpoTotE', type: 'int' }, { name: 'AgTpoTotR', safeName: 'AgTpoTotR', type: 'int' }, { name: 'AgTpoTotAt', safeName: 'AgTpoTotAt', type: 'int' }, { name: '_fechareg', safeName: 'f_fechareg', type: 'datetime' }, { name: 'IdProced', safeName: 'IdProced', type: 'int' }, { name: 'CIP', safeName: 'CIP', type: 'varchar' }, { name: 'AgNumFallos', safeName: 'AgNumFallos', type: 'int' }, { name: 'Comodin7', safeName: 'Comodin7', type: 'varchar' }, { name: 'IdIdioma', safeName: 'IdIdioma', type: 'int' }, { name: 'GrupoSanguineo', safeName: 'GrupoSanguineo', type: 'varchar' }, { name: 'IdCentro', safeName: 'IdCentro', type: 'int' }, { name: 'TipoDocIdent', safeName: 'TipoDocIdent', type: 'int' }, { name: 'NumSS', safeName: 'NumSS', type: 'varchar' }, { name: 'Exitus', safeName: 'Exitus', type: 'smalldatetime' }, { name: 'ExitusObs', safeName: 'ExitusObs', type: 'varchar' }, { name: 'Inactivo', safeName: 'Inactivo', type: 'smalldatetime' }, { name: 'MotivoInactivo', safeName: 'MotivoInactivo', type: 'varchar' }, { name: 'IdPacReferidor', safeName: 'IdPacReferidor', type: 'int' }, { name: 'AceptaEmail', safeName: 'AceptaEmail', type: 'bit' }, { name: 'AceptaPostal', safeName: 'AceptaPostal', type: 'bit' }, { name: 'IdPaisIdent', safeName: 'IdPaisIdent', type: 'int' }, { name: 'IdCliTutor', safeName: 'IdCliTutor', type: 'int' }, { name: '_version', safeName: 'f_version', type: 'int' }, { name: '_fechaModif', safeName: 'f_fechaModif', type: 'datetime' }, { name: '_idUserModif', safeName: 'f_idUserModif', type: 'int' }, { name: 'LecturaDocIdentEstado', safeName: 'LecturaDocIdentEstado', type: 'int' }, { name: 'LecturaDocIdentFecha', safeName: 'LecturaDocIdentFecha', type: 'datetime' }, { name: 'LecturaDocIdentIdUser', safeName: 'LecturaDocIdentIdUser', type: 'int' }, { name: 'IdUserAsesor', safeName: 'IdUserAsesor', type: 'int' }, { name: 'AceptaGDPR', safeName: 'AceptaGDPR', type: 'bit' }, { name: 'IdTipoDireccion', safeName: 'IdTipoDireccion', type: 'int' }, { name: 'SeccionCensal', safeName: 'SeccionCensal', type: 'varchar' }, { name: 'CoordenadasX', safeName: 'CoordenadasX', type: 'varchar' }, { name: 'CoordenadasY', safeName: 'CoordenadasY', type: 'varchar' }, { name: 'NoContactable', safeName: 'NoContactable', type: 'bit' }, { name: 'Derivado', safeName: 'Derivado', type: 'bit' }, { name: 'ExternalId', safeName: 'ExternalId', type: 'uniqueidentifier' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }, { name: 'AceptaBots', safeName: 'AceptaBots', type: 'bit' }, { name: 'AceptaWhatsApp', safeName: 'AceptaWhatsApp', type: 'bit' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('pacientes', mapped);
    console.log(` ✅ Pacientes complete!`);
  } catch (e) { console.error(` ❌ Error in Pacientes:`, e.message); }

  console.log('Migrating PacCli (6129 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [PacCli]');
    const cols = [{ name: 'IdPac', safeName: 'IdPac', type: 'int' }, { name: 'IdCli', safeName: 'IdCli', type: 'int' }, { name: 'Poliza', safeName: 'Poliza', type: 'varchar' }, { name: 'Tarjeta', safeName: 'Tarjeta', type: 'varchar' }, { name: 'Comodin1', safeName: 'Comodin1', type: 'int' }, { name: 'Comodin2', safeName: 'Comodin2', type: 'varchar' }, { name: 'FecAlta', safeName: 'FecAlta', type: 'smalldatetime' }, { name: 'FecCaduc', safeName: 'FecCaduc', type: 'smalldatetime' }, { name: 'Inactivo', safeName: 'Inactivo', type: 'char' }, { name: 'FecBaja', safeName: 'FecBaja', type: 'smalldatetime' }, { name: 'Texto', safeName: 'Texto', type: 'varchar' }, { name: 'FecUltPase', safeName: 'FecUltPase', type: 'smalldatetime' }, { name: 'Version_TS', safeName: 'Version_TS', type: 'varchar' }, { name: 'Tarjeta24', safeName: 'Tarjeta24', type: 'varchar' }, { name: 'Certificado', safeName: 'Certificado', type: 'int' }, { name: 'NOrden', safeName: 'NOrden', type: 'int' }, { name: 'IdProdModTarifa', safeName: 'IdProdModTarifa', type: 'int' }, { name: 'MotivoAsignacion', safeName: 'MotivoAsignacion', type: 'varchar' }, { name: 'IdUser', safeName: 'IdUser', type: 'int' }, { name: 'Pista1', safeName: 'Pista1', type: 'varchar' }, { name: 'Pista2', safeName: 'Pista2', type: 'varchar' }, { name: 'Cobertura', safeName: 'Cobertura', type: 'varchar' }, { name: 'Localizador', safeName: 'Localizador', type: 'varchar' }, { name: 'FechaLocalizador', safeName: 'FechaLocalizador', type: 'datetime' }, { name: 'Id', safeName: 'Id', type: 'int' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('paccli', mapped);
    console.log(` ✅ PacCli complete!`);
  } catch (e) { console.error(` ❌ Error in PacCli:`, e.message); }

  console.log('Migrating Clientes (6154 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [Clientes]');
    const cols = [{ name: 'IdCli', safeName: 'IdCli', type: 'int' }, { name: 'TipoCli', safeName: 'TipoCli', type: 'char' }, { name: 'Nombre', safeName: 'Nombre', type: 'varchar' }, { name: 'Apellidos', safeName: 'Apellidos', type: 'varchar' }, { name: 'Direccion', safeName: 'Direccion', type: 'varchar' }, { name: 'IdPoblacio', safeName: 'IdPoblacio', type: 'int' }, { name: 'CP', safeName: 'CP', type: 'varchar' }, { name: 'NIF', safeName: 'NIF', type: 'char' }, { name: 'Antecedent', safeName: 'Antecedent', type: 'char' }, { name: 'Tel1', safeName: 'Tel1', type: 'varchar' }, { name: 'Tel2', safeName: 'Tel2', type: 'varchar' }, { name: 'TelMovil', safeName: 'TelMovil', type: 'varchar' }, { name: 'Fax', safeName: 'Fax', type: 'varchar' }, { name: 'Email', safeName: 'Email', type: 'varchar' }, { name: 'Web', safeName: 'Web', type: 'varchar' }, { name: 'Comodin1', safeName: 'Comodin1', type: 'varchar' }, { name: 'Comodin2', safeName: 'Comodin2', type: 'varchar' }, { name: 'IdTrato', safeName: 'IdTrato', type: 'int' }, { name: 'Cuenta', safeName: 'Cuenta', type: 'varchar' }, { name: 'Mailing', safeName: 'Mailing', type: 'bit' }, { name: 'Notas', safeName: 'Notas', type: 'text' }, { name: 'Entidad', safeName: 'Entidad', type: 'char' }, { name: 'Oficina', safeName: 'Oficina', type: 'char' }, { name: 'DC', safeName: 'DC', type: 'char' }, { name: 'IdBanco', safeName: 'IdBanco', type: 'int' }, { name: 'FecAlta', safeName: 'FecAlta', type: 'smalldatetime' }, { name: 'SISTEMA', safeName: 'SISTEMA', type: 'varchar' }, { name: 'TARIFA', safeName: 'TARIFA', type: 'varchar' }, { name: 'FecTarifa', safeName: 'FecTarifa', type: 'smalldatetime' }, { name: 'Inactivo', safeName: 'Inactivo', type: 'char' }, { name: 'FecBaja', safeName: 'FecBaja', type: 'smalldatetime' }, { name: 'CodCli', safeName: 'CodCli', type: 'varchar' }, { name: '_fechareg', safeName: 'f_fechareg', type: 'datetime' }, { name: 'IdEmisor', safeName: 'IdEmisor', type: 'int' }, { name: 'IdCIA', safeName: 'IdCIA', type: 'int' }, { name: 'IdAuxPTarj', safeName: 'IdAuxPTarj', type: 'int' }, { name: 'DiaFact', safeName: 'DiaFact', type: 'int' }, { name: 'Modelo', safeName: 'Modelo', type: 'int' }, { name: 'ModoFact', safeName: 'ModoFact', type: 'int' }, { name: 'OrdenFactura', safeName: 'OrdenFactura', type: 'int' }, { name: 'DesglosarModalidad', safeName: 'DesglosarModalidad', type: 'char' }, { name: 'RazonSocial', safeName: 'RazonSocial', type: 'varchar' }, { name: 'DiasCaducidad', safeName: 'DiasCaducidad', type: 'int' }, { name: 'SCCodSCta', safeName: 'SCCodSCta', type: 'varchar' }, { name: 'SCCodDept', safeName: 'SCCodDept', type: 'varchar' }, { name: 'SCCodProd', safeName: 'SCCodProd', type: 'varchar' }, { name: 'SCCodProy', safeName: 'SCCodProy', type: 'varchar' }, { name: 'SCCodSCtaANT', safeName: 'SCCodSCtaANT', type: 'varchar' }, { name: 'DiaFactTalon', safeName: 'DiaFactTalon', type: 'int' }, { name: 'IdCentro', safeName: 'IdCentro', type: 'int' }, { name: 'TipoDocIdent', safeName: 'TipoDocIdent', type: 'int' }, { name: 'CodIBAN', safeName: 'CodIBAN', type: 'varchar' }, { name: 'CodTar', safeName: 'CodTar', type: 'int' }, { name: 'CodImgRC', safeName: 'CodImgRC', type: 'varchar' }, { name: 'IdIdioma', safeName: 'IdIdioma', type: 'int' }, { name: 'FecNacim', safeName: 'FecNacim', type: 'datetime' }, { name: 'TipoEntidad', safeName: 'TipoEntidad', type: 'int' }, { name: 'IdentPS', safeName: 'IdentPS', type: 'varchar' }, { name: 'IdPaisIdent', safeName: 'IdPaisIdent', type: 'int' }, { name: 'LecturaDocIdentEstado', safeName: 'LecturaDocIdentEstado', type: 'int' }, { name: 'LecturaDocIdentFecha', safeName: 'LecturaDocIdentFecha', type: 'datetime' }, { name: 'LecturaDocIdentIdUser', safeName: 'LecturaDocIdentIdUser', type: 'int' }, { name: 'ExternalId', safeName: 'ExternalId', type: 'uniqueidentifier' }, { name: 'Id_TipoCliente', safeName: 'Id_TipoCliente', type: 'int' }, { name: '_version', safeName: 'f_version', type: 'int' }, { name: '_idUserReg', safeName: 'f_idUserReg', type: 'int' }, { name: '_fechaModif', safeName: 'f_fechaModif', type: 'datetime' }, { name: '_idUserModif', safeName: 'f_idUserModif', type: 'int' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('clientes', mapped);
    console.log(` ✅ Clientes complete!`);
  } catch (e) { console.error(` ❌ Error in Clientes:`, e.message); }

  console.log('Migrating Pacientes_Tarifas (6215 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [Pacientes_Tarifas]');
    const cols = [{ name: 'IdPacienteTarifa', safeName: 'IdPacienteTarifa', type: 'int' }, { name: 'IdPac', safeName: 'IdPac', type: 'int' }, { name: 'IdTarifa', safeName: 'IdTarifa', type: 'int' }, { name: 'Poliza', safeName: 'Poliza', type: 'varchar' }, { name: 'Tarjeta', safeName: 'Tarjeta', type: 'varchar' }, { name: 'FecAlta', safeName: 'FecAlta', type: 'datetime' }, { name: 'FecCaduc', safeName: 'FecCaduc', type: 'datetime' }, { name: 'FecUltPase', safeName: 'FecUltPase', type: 'datetime' }, { name: 'Texto', safeName: 'Texto', type: 'varchar' }, { name: 'Version_TS', safeName: 'Version_TS', type: 'varchar' }, { name: 'Tarjeta24', safeName: 'Tarjeta24', type: 'varchar' }, { name: 'Certificado', safeName: 'Certificado', type: 'int' }, { name: 'NOrden', safeName: 'NOrden', type: 'int' }, { name: 'MotivoAsignacion', safeName: 'MotivoAsignacion', type: 'varchar' }, { name: 'IdProdModTarifa', safeName: 'IdProdModTarifa', type: 'int' }, { name: 'IdUser', safeName: 'IdUser', type: 'int' }, { name: 'Comodin1', safeName: 'Comodin1', type: 'int' }, { name: 'Comodin2', safeName: 'Comodin2', type: 'varchar' }, { name: 'Inactivo', safeName: 'Inactivo', type: 'datetime' }, { name: '_fechareg', safeName: 'f_fechareg', type: 'datetime' }, { name: '_version', safeName: 'f_version', type: 'int' }, { name: 'Localizador', safeName: 'Localizador', type: 'varchar' }, { name: 'FechaLocalizador', safeName: 'FechaLocalizador', type: 'datetime' }, { name: 'Pista1', safeName: 'Pista1', type: 'varchar' }, { name: 'Pista2', safeName: 'Pista2', type: 'varchar' }, { name: 'Cobertura', safeName: 'Cobertura', type: 'varchar' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('pacientesTarifas', mapped);
    console.log(` ✅ Pacientes_Tarifas complete!`);
  } catch (e) { console.error(` ❌ Error in Pacientes_Tarifas:`, e.message); }

  console.log('Migrating Pacientes_Tarifas_log (6215 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [Pacientes_Tarifas_log]');
    const cols = [{ name: 'IdLog', safeName: 'IdLog', type: 'int' }, { name: 'Accion', safeName: 'Accion', type: 'int' }, { name: 'IdPacienteTarifa', safeName: 'IdPacienteTarifa', type: 'int' }, { name: 'IdPac', safeName: 'IdPac', type: 'int' }, { name: 'IdTarifa', safeName: 'IdTarifa', type: 'int' }, { name: 'MotivoAsignacion', safeName: 'MotivoAsignacion', type: 'varchar' }, { name: '_fechareg', safeName: 'f_fechareg', type: 'datetime' }, { name: '_iduser', safeName: 'f_iduser', type: 'int' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('pacientesTarifasLog', mapped);
    console.log(` ✅ Pacientes_Tarifas_log complete!`);
  } catch (e) { console.error(` ❌ Error in Pacientes_Tarifas_log:`, e.message); }

  console.log('Migrating BancoMov (7366 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [BancoMov]');
    const cols = [{ name: 'Apunte', safeName: 'Apunte', type: 'int' }, { name: 'IdBanco', safeName: 'IdBanco', type: 'int' }, { name: 'Fecha', safeName: 'Fecha', type: 'smalldatetime' }, { name: 'Importe', safeName: 'Importe', type: 'float' }, { name: 'Concepto', safeName: 'Concepto', type: 'varchar' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('bancomov', mapped);
    console.log(` ✅ BancoMov complete!`);
  } catch (e) { console.error(` ❌ Error in BancoMov:`, e.message); }

  console.log('Migrating Presu (10518 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [Presu]');
    const cols = [{ name: 'IdPac', safeName: 'IdPac', type: 'int' }, { name: 'NumSerie', safeName: 'NumSerie', type: 'int' }, { name: 'NumPre', safeName: 'NumPre', type: 'int' }, { name: 'Titulo', safeName: 'Titulo', type: 'varchar' }, { name: 'Notas', safeName: 'Notas', type: 'text' }, { name: 'Direccion', safeName: 'Direccion', type: 'varchar' }, { name: 'IdPoblacio', safeName: 'IdPoblacio', type: 'int' }, { name: 'CP', safeName: 'CP', type: 'char' }, { name: 'Tel1', safeName: 'Tel1', type: 'varchar' }, { name: 'Tel2', safeName: 'Tel2', type: 'varchar' }, { name: 'TelMovil', safeName: 'TelMovil', type: 'varchar' }, { name: 'Fax', safeName: 'Fax', type: 'varchar' }, { name: 'Email', safeName: 'Email', type: 'varchar' }, { name: 'Web', safeName: 'Web', type: 'varchar' }, { name: 'FecPresup', safeName: 'FecPresup', type: 'smalldatetime' }, { name: 'FecAcepta', safeName: 'FecAcepta', type: 'smalldatetime' }, { name: 'IdCol', safeName: 'IdCol', type: 'int' }, { name: 'Emisor', safeName: 'Emisor', type: 'int' }, { name: 'Ident', safeName: 'Ident', type: 'int' }, { name: 'FecRechaz', safeName: 'FecRechaz', type: 'smalldatetime' }, { name: 'ObsRechaz', safeName: 'ObsRechaz', type: 'varchar' }, { name: 'IdUserElabora', safeName: 'IdUserElabora', type: 'int' }, { name: 'IdCentro', safeName: 'IdCentro', type: 'int' }, { name: 'IdUserPresentacion', safeName: 'IdUserPresentacion', type: 'int' }, { name: 'UniqueID', safeName: 'UniqueID', type: 'int' }, { name: 'IdPresuOrigen', safeName: 'IdPresuOrigen', type: 'int' }, { name: 'IdTipoPresupuesto', safeName: 'IdTipoPresupuesto', type: 'int' }, { name: 'Estado', safeName: 'Estado', type: 'int' }, { name: 'AceptadoFueraValidez', safeName: 'AceptadoFueraValidez', type: 'int' }, { name: 'Financiacion', safeName: 'Financiacion', type: 'int' }, { name: '_fechareg', safeName: 'f_fechareg', type: 'datetime' }, { name: '_version', safeName: 'f_version', type: 'int' }, { name: 'RechazadoPorAlternativa', safeName: 'RechazadoPorAlternativa', type: 'bit' }, { name: 'AlternativaDe', safeName: 'AlternativaDe', type: 'int' }, { name: 'EsAlternativa', safeName: 'EsAlternativa', type: 'int' }, { name: 'IdCanastaDiagnostico', safeName: 'IdCanastaDiagnostico', type: 'int' }, { name: 'Id_UserDesbloqueo', safeName: 'Id_UserDesbloqueo', type: 'int' }, { name: 'FechaDesbloqueo', safeName: 'FechaDesbloqueo', type: 'datetime' }, { name: 'Id_UserResponsable', safeName: 'Id_UserResponsable', type: 'int' }, { name: 'ContratoFinanciacion', safeName: 'ContratoFinanciacion', type: 'varchar' }, { name: 'Id_MotivoRechaz', safeName: 'Id_MotivoRechaz', type: 'int' }, { name: 'Id_UserRechaz', safeName: 'Id_UserRechaz', type: 'int' }, { name: 'Id_PresuOriginal', safeName: 'Id_PresuOriginal', type: 'int' }, { name: 'FechaEntregaDigitalmente', safeName: 'FechaEntregaDigitalmente', type: 'datetime' }, { name: 'FechaRecibidoCliente', safeName: 'FechaRecibidoCliente', type: 'datetime' }, { name: 'RecibidoDigitalmente', safeName: 'RecibidoDigitalmente', type: 'bit' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }, { name: 'Serie', safeName: 'Serie', type: 'varchar' }, { name: 'NumSeriePresu', safeName: 'NumSeriePresu', type: 'int' }, { name: 'Hash', safeName: 'Hash', type: 'varchar' }, { name: 'HashControl', safeName: 'HashControl', type: 'int' }, { name: 'CodigoATCUD', safeName: 'CodigoATCUD', type: 'varchar' }, { name: 'CodigoQR', safeName: 'CodigoQR', type: 'varchar' }, { name: 'FechaAceptadoDigitalmente', safeName: 'FechaAceptadoDigitalmente', type: 'datetime' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('presu', mapped);
    console.log(` ✅ Presu complete!`);
  } catch (e) { console.error(` ❌ Error in Presu:`, e.message); }

  console.log('Migrating DocAdmin (11640 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [DocAdmin]');
    const cols = [{ name: 'Doc', safeName: 'Doc', type: 'char' }, { name: 'IdEmisor', safeName: 'IdEmisor', type: 'int' }, { name: 'Serie', safeName: 'Serie', type: 'char' }, { name: 'NumDoc', safeName: 'NumDoc', type: 'int' }, { name: 'Anyo', safeName: 'Anyo', type: 'int' }, { name: 'FecDoc', safeName: 'FecDoc', type: 'smalldatetime' }, { name: 'IdCli', safeName: 'IdCli', type: 'int' }, { name: 'Nombre', safeName: 'Nombre', type: 'varchar' }, { name: 'Apellidos', safeName: 'Apellidos', type: 'varchar' }, { name: 'Direccion', safeName: 'Direccion', type: 'varchar' }, { name: 'NIF', safeName: 'NIF', type: 'varchar' }, { name: 'Modelo', safeName: 'Modelo', type: 'tinyint' }, { name: 'FecExpoCP', safeName: 'FecExpoCP', type: 'smalldatetime' }, { name: 'ConceptoG', safeName: 'ConceptoG', type: 'varchar' }, { name: 'FecImpreso', safeName: 'FecImpreso', type: 'smalldatetime' }, { name: 'NumImpres', safeName: 'NumImpres', type: 'int' }, { name: 'Ident', safeName: 'Ident', type: 'int' }, { name: 'IdUser', safeName: 'IdUser', type: 'int' }, { name: 'Abonado', safeName: 'Abonado', type: 'int' }, { name: 'Abono', safeName: 'Abono', type: 'int' }, { name: '_fechareg', safeName: 'f_fechareg', type: 'datetime' }, { name: 'Hash', safeName: 'Hash', type: 'varchar' }, { name: 'HashControl', safeName: 'HashControl', type: 'int' }, { name: 'RazonSocial', safeName: 'RazonSocial', type: 'varchar' }, { name: 'ContabSC', safeName: 'ContabSC', type: 'varchar' }, { name: 'IdIdioma', safeName: 'IdIdioma', type: 'int' }, { name: 'IdSerieOficial', safeName: 'IdSerieOficial', type: 'int' }, { name: 'SerieOficial', safeName: 'SerieOficial', type: 'varchar' }, { name: 'NumDocOficial', safeName: 'NumDocOficial', type: 'int' }, { name: 'IdMotivo', safeName: 'IdMotivo', type: 'int' }, { name: '_version', safeName: 'f_version', type: 'int' }, { name: 'NIFTutor', safeName: 'NIFTutor', type: 'varchar' }, { name: 'IdCliTutor', safeName: 'IdCliTutor', type: 'int' }, { name: 'IdTalon', safeName: 'IdTalon', type: 'int' }, { name: 'TipoDocumento', safeName: 'TipoDocumento', type: 'int' }, { name: 'NumTransaccion', safeName: 'NumTransaccion', type: 'int' }, { name: 'IdDevolucionTransaccion', safeName: 'IdDevolucionTransaccion', type: 'int' }, { name: 'IdDocAdminOrigen', safeName: 'IdDocAdminOrigen', type: 'int' }, { name: 'NumDocExenta', safeName: 'NumDocExenta', type: 'int' }, { name: 'NumDocAfecta', safeName: 'NumDocAfecta', type: 'int' }, { name: 'IdTalonAfecta', safeName: 'IdTalonAfecta', type: 'int' }, { name: 'CId', safeName: 'CId', type: 'nvarchar' }, { name: 'IdPaisIdent', safeName: 'IdPaisIdent', type: 'int' }, { name: 'TipoDocIdent', safeName: 'TipoDocIdent', type: 'int' }, { name: 'TipoFactura', safeName: 'TipoFactura', type: 'varchar' }, { name: 'CP', safeName: 'CP', type: 'varchar' }, { name: 'CodigoQR', safeName: 'CodigoQR', type: 'varchar' }, { name: 'CodigoATCUD', safeName: 'CodigoATCUD', type: 'varchar' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }, { name: '_origen', safeName: 'f_origen', type: 'varchar' }, { name: 'Anulacion', safeName: 'Anulacion', type: 'bit' }, { name: '_Type', safeName: 'f_Type', type: 'varchar' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('docadmin', mapped);
    console.log(` ✅ DocAdmin complete!`);
  } catch (e) { console.error(` ❌ Error in DocAdmin:`, e.message); }

  console.log('Migrating PagoCli (13604 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [PagoCli]');
    const cols = [{ name: 'IdPagoCli', safeName: 'IdPagoCli', type: 'int' }, { name: 'IdCli', safeName: 'IdCli', type: 'int' }, { name: 'Pagado', safeName: 'Pagado', type: 'float' }, { name: 'FecPago', safeName: 'FecPago', type: 'smalldatetime' }, { name: 'IdForPago', safeName: 'IdForPago', type: 'int' }, { name: 'Oficina', safeName: 'Oficina', type: 'char' }, { name: 'Entidad', safeName: 'Entidad', type: 'char' }, { name: 'NumIngre', safeName: 'NumIngre', type: 'varchar' }, { name: 'IdBanco', safeName: 'IdBanco', type: 'int' }, { name: 'IdUser', safeName: 'IdUser', type: 'int' }, { name: 'Docs', safeName: 'Docs', type: 'char' }, { name: 'NRecibo', safeName: 'NRecibo', type: 'varchar' }, { name: 'NCPago', safeName: 'NCPago', type: 'varchar' }, { name: 'FecExpoCP', safeName: 'FecExpoCP', type: 'smalldatetime' }, { name: 'IdAnulado', safeName: 'IdAnulado', type: 'int' }, { name: '_fechareg', safeName: 'f_fechareg', type: 'datetime' }, { name: 'ContabSC', safeName: 'ContabSC', type: 'varchar' }, { name: 'IdCentro', safeName: 'IdCentro', type: 'int' }, { name: 'CodIBAN', safeName: 'CodIBAN', type: 'varchar' }, { name: 'IdMotivo', safeName: 'IdMotivo', type: 'int' }, { name: 'NoDisponible', safeName: 'NoDisponible', type: 'datetime' }, { name: 'Cuotas', safeName: 'Cuotas', type: 'int' }, { name: 'FechaCuota', safeName: 'FechaCuota', type: 'smalldatetime' }, { name: 'IdentTM', safeName: 'IdentTM', type: 'int' }, { name: 'NFactura', safeName: 'NFactura', type: 'varchar' }, { name: 'Tipo', safeName: 'Tipo', type: 'int' }, { name: 'IdentPS', safeName: 'IdentPS', type: 'int' }, { name: 'FP_Codigo1', safeName: 'FP_Codigo1', type: 'varchar' }, { name: 'FP_Codigo2', safeName: 'FP_Codigo2', type: 'varchar' }, { name: 'FP_Codigo3', safeName: 'FP_Codigo3', type: 'varchar' }, { name: 'IdLiqComisionDet', safeName: 'IdLiqComisionDet', type: 'int' }, { name: 'Automatico', safeName: 'Automatico', type: 'bit' }, { name: 'NumTransaccion', safeName: 'NumTransaccion', type: 'int' }, { name: 'IdDevolucionTransaccion', safeName: 'IdDevolucionTransaccion', type: 'int' }, { name: 'IdPasarelaPago', safeName: 'IdPasarelaPago', type: 'int' }, { name: 'IdRemesaBancaria', safeName: 'IdRemesaBancaria', type: 'int' }, { name: 'IdPlanEcoCuota', safeName: 'IdPlanEcoCuota', type: 'int' }, { name: 'IdPagoCliRelacionado', safeName: 'IdPagoCliRelacionado', type: 'int' }, { name: 'FechaImport', safeName: 'FechaImport', type: 'datetime' }, { name: 'CId', safeName: 'CId', type: 'nvarchar' }, { name: 'Id_SolicitudDevolucion', safeName: 'Id_SolicitudDevolucion', type: 'int' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('pagocli', mapped);
    console.log(` ✅ PagoCli complete!`);
  } catch (e) { console.error(` ❌ Error in PagoCli:`, e.message); }

  console.log('Migrating TAuxFarmacos (15844 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [TAuxFarmacos]');
    const cols = [{ name: 'IdFarmaco', safeName: 'IdFarmaco', type: 'int' }, { name: 'CodFarmaco', safeName: 'CodFarmaco', type: 'varchar' }, { name: 'Descripcion', safeName: 'Descripcion', type: 'varchar' }, { name: 'Presentacion', safeName: 'Presentacion', type: 'varchar' }, { name: 'VD_IdEspec', safeName: 'VD_IdEspec', type: 'int' }, { name: 'VD_IdPack', safeName: 'VD_IdPack', type: 'int' }, { name: 'VD_CodATC', safeName: 'VD_CodATC', type: 'varchar' }, { name: 'VD_NomATC', safeName: 'VD_NomATC', type: 'varchar' }, { name: 'VD_Precio', safeName: 'VD_Precio', type: 'float' }, { name: 'VD_PrecioLab', safeName: 'VD_PrecioLab', type: 'float' }, { name: 'Posologia', safeName: 'Posologia', type: 'varchar' }, { name: 'Composicion', safeName: 'Composicion', type: 'varchar' }, { name: 'Indicacion', safeName: 'Indicacion', type: 'varchar' }, { name: 'Inactivo', safeName: 'Inactivo', type: 'char' }, { name: 'VD_CodNal', safeName: 'VD_CodNal', type: 'varchar' }, { name: 'VD_NomLab', safeName: 'VD_NomLab', type: 'varchar' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('tauxfarmacos', mapped);
    console.log(` ✅ TAuxFarmacos complete!`);
  } catch (e) { console.error(` ❌ Error in TAuxFarmacos:`, e.message); }

  console.log('Migrating TICD9 (18928 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [TICD9]');
    const cols = [{ name: 'IdICD9', safeName: 'IdICD9', type: 'int' }, { name: 'CodICD9', safeName: 'CodICD9', type: 'varchar' }, { name: 'Descripcion', safeName: 'Descripcion', type: 'varchar' }, { name: 'ClonDe', safeName: 'ClonDe', type: 'varchar' }, { name: 'Visible', safeName: 'Visible', type: 'tinyint' }, { name: 'VD_IdICD9', safeName: 'VD_IdICD9', type: 'int' }, { name: 'VD_CodICD9', safeName: 'VD_CodICD9', type: 'varchar' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('ticd9', mapped);
    console.log(` ✅ TICD9 complete!`);
  } catch (e) { console.error(` ❌ Error in TICD9:`, e.message); }

  console.log('Migrating LinAdmin (21301 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [LinAdmin]');
    const cols = [{ name: 'NumLinea', safeName: 'NumLinea', type: 'int' }, { name: 'IdDeudaCli', safeName: 'IdDeudaCli', type: 'int' }, { name: 'IdPagoCli', safeName: 'IdPagoCli', type: 'int' }, { name: 'Importe', safeName: 'Importe', type: 'float' }, { name: 'Concepto', safeName: 'Concepto', type: 'varchar' }, { name: 'IdPac', safeName: 'IdPac', type: 'int' }, { name: 'Abonado', safeName: 'Abonado', type: 'int' }, { name: 'Abono', safeName: 'Abono', type: 'int' }, { name: '_fechareg', safeName: 'f_fechareg', type: 'datetime' }, { name: 'BaseImponible', safeName: 'BaseImponible', type: 'float' }, { name: 'IdTipoIVA', safeName: 'IdTipoIVA', type: 'int' }, { name: 'TpcIVA', safeName: 'TpcIVA', type: 'real' }, { name: 'ImporteIVA', safeName: 'ImporteIVA', type: 'float' }, { name: 'identTM', safeName: 'identTM', type: 'int' }, { name: 'IdLinAdmin', safeName: 'IdLinAdmin', type: 'int' }, { name: 'IdDocAdmin', safeName: 'IdDocAdmin', type: 'int' }, { name: 'IdDeudaPago', safeName: 'IdDeudaPago', type: 'int' }, { name: '_version', safeName: 'f_version', type: 'int' }, { name: 'IdRegPendContab', safeName: 'IdRegPendContab', type: 'int' }, { name: 'Actos', safeName: 'Actos', type: 'tinyint' }, { name: 'Dto', safeName: 'Dto', type: 'int' }, { name: 'ImporteDto', safeName: 'ImporteDto', type: 'numeric' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('linadmin', mapped);
    console.log(` ✅ LinAdmin complete!`);
  } catch (e) { console.error(` ❌ Error in LinAdmin:`, e.message); }

  console.log('Migrating DeudaPago (28283 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [DeudaPago]');
    const cols = [{ name: 'IdDeudaCli', safeName: 'IdDeudaCli', type: 'int' }, { name: 'IdPagoCli', safeName: 'IdPagoCli', type: 'int' }, { name: 'Pagado', safeName: 'Pagado', type: 'float' }, { name: 'FecPago', safeName: 'FecPago', type: 'smalldatetime' }, { name: 'EditTtos', safeName: 'EditTtos', type: 'int' }, { name: 'FecExpoCP', safeName: 'FecExpoCP', type: 'smalldatetime' }, { name: '_fechareg', safeName: 'f_fechareg', type: 'datetime' }, { name: 'IdDeudaPago', safeName: 'IdDeudaPago', type: 'int' }, { name: 'IdDocAdminDeuda', safeName: 'IdDocAdminDeuda', type: 'int' }, { name: 'SubTipoPago', safeName: 'SubTipoPago', type: 'int' }, { name: 'IdLiqComisionDet', safeName: 'IdLiqComisionDet', type: 'int' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }, { name: 'CId', safeName: 'CId', type: 'nvarchar' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('deudapago', mapped);
    console.log(` ✅ DeudaPago complete!`);
  } catch (e) { console.error(` ❌ Error in DeudaPago:`, e.message); }

  console.log('Migrating DeudaCli (39664 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [DeudaCli]');
    const cols = [{ name: 'IdDeudaCli', safeName: 'IdDeudaCli', type: 'int' }, { name: 'IdCli', safeName: 'IdCli', type: 'int' }, { name: 'IdPac', safeName: 'IdPac', type: 'int' }, { name: 'NumTto', safeName: 'NumTto', type: 'int' }, { name: 'NumFase', safeName: 'NumFase', type: 'tinyint' }, { name: 'FecPlazo', safeName: 'FecPlazo', type: 'smalldatetime' }, { name: 'Adeudo', safeName: 'Adeudo', type: 'float' }, { name: 'Liquidado', safeName: 'Liquidado', type: 'bit' }, { name: 'Docs', safeName: 'Docs', type: 'char' }, { name: 'NFactura', safeName: 'NFactura', type: 'varchar' }, { name: 'NNotaTto', safeName: 'NNotaTto', type: 'varchar' }, { name: '_fechareg', safeName: 'f_fechareg', type: 'datetime' }, { name: 'Modalidad', safeName: 'Modalidad', type: 'tinyint' }, { name: 'IdAnulado', safeName: 'IdAnulado', type: 'int' }, { name: 'SCFecExpo', safeName: 'SCFecExpo', type: 'smalldatetime' }, { name: 'IdCentro', safeName: 'IdCentro', type: 'int' }, { name: 'Incobrable', safeName: 'Incobrable', type: 'smalldatetime' }, { name: 'Pendiente', safeName: 'Pendiente', type: 'float' }, { name: 'IdentTM', safeName: 'IdentTM', type: 'int' }, { name: 'IdMotivoIncobrable', safeName: 'IdMotivoIncobrable', type: 'int' }, { name: 'DescMotivoIncobrable', safeName: 'DescMotivoIncobrable', type: 'varchar' }, { name: 'IdLiqComisionDet', safeName: 'IdLiqComisionDet', type: 'int' }, { name: 'FechaImport', safeName: 'FechaImport', type: 'datetime' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('deudacli', mapped);
    console.log(` ✅ DeudaCli complete!`);
  } catch (e) { console.error(` ❌ Error in DeudaCli:`, e.message); }

  console.log('Migrating RegApun (42993 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [RegApun]');
    const cols = [{ name: 'IdRegApun', safeName: 'IdRegApun', type: 'int' }, { name: 'FecReg', safeName: 'FecReg', type: 'datetime' }, { name: 'IdUser', safeName: 'IdUser', type: 'int' }, { name: 'FecOperaci', safeName: 'FecOperaci', type: 'smalldatetime' }, { name: 'IdTRegApun', safeName: 'IdTRegApun', type: 'tinyint' }, { name: 'IdForPago', safeName: 'IdForPago', type: 'int' }, { name: 'Importe', safeName: 'Importe', type: 'float' }, { name: 'IdPac', safeName: 'IdPac', type: 'int' }, { name: 'IdCli', safeName: 'IdCli', type: 'int' }, { name: 'IdProveed', safeName: 'IdProveed', type: 'int' }, { name: 'IdCol', safeName: 'IdCol', type: 'int' }, { name: 'Notas', safeName: 'Notas', type: 'varchar' }, { name: 'IdCentro', safeName: 'IdCentro', type: 'int' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('regapun', mapped);
    console.log(` ✅ RegApun complete!`);
  } catch (e) { console.error(` ❌ Error in RegApun:`, e.message); }

  console.log('Migrating TtosMedFases (46035 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [TtosMedFases]');
    const cols = [{ name: 'IdTtosMedFase', safeName: 'IdTtosMedFase', type: 'int' }, { name: 'IdTtosMed', safeName: 'IdTtosMed', type: 'int' }, { name: 'IdTratamientoFase', safeName: 'IdTratamientoFase', type: 'int' }, { name: 'NumFase', safeName: 'NumFase', type: 'int' }, { name: 'Estado', safeName: 'Estado', type: 'int' }, { name: 'Fecha', safeName: 'Fecha', type: 'datetime' }, { name: 'Notas', safeName: 'Notas', type: 'text' }, { name: 'TpcFacturar', safeName: 'TpcFacturar', type: 'numeric' }, { name: '_fechareg', safeName: 'f_fechareg', type: 'datetime' }, { name: '_version', safeName: 'f_version', type: 'int' }, { name: 'IdLiqComisionDet', safeName: 'IdLiqComisionDet', type: 'int' }, { name: 'IdCol', safeName: 'IdCol', type: 'int' }, { name: 'IdColAux', safeName: 'IdColAux', type: 'int' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('ttosmedfases', mapped);
    console.log(` ✅ TtosMedFases complete!`);
  } catch (e) { console.error(` ❌ Error in TtosMedFases:`, e.message); }

  console.log('Migrating DCitasOp (46845 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [DCitasOp]');
    const cols = [{ name: 'IdUsu', safeName: 'IdUsu', type: 'int' }, { name: 'IdOrden', safeName: 'IdOrden', type: 'int' }, { name: 'IdOpc', safeName: 'IdOpc', type: 'varchar' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('dcitasop', mapped);
    console.log(` ✅ DCitasOp complete!`);
  } catch (e) { console.error(` ❌ Error in DCitasOp:`, e.message); }

  console.log('Migrating DCitas (47712 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [DCitas]');
    const cols = [{ name: 'IdUsu', safeName: 'IdUsu', type: 'int' }, { name: 'IdOrden', safeName: 'IdOrden', type: 'int' }, { name: 'Fecha', safeName: 'Fecha', type: 'int' }, { name: 'Hora', safeName: 'Hora', type: 'int' }, { name: 'Duracion', safeName: 'Duracion', type: 'int' }, { name: 'IdSitC', safeName: 'IdSitC', type: 'int' }, { name: 'Texto', safeName: 'Texto', type: 'varchar' }, { name: 'FlgBloqueo', safeName: 'FlgBloqueo', type: 'varchar' }, { name: 'Contacto', safeName: 'Contacto', type: 'varchar' }, { name: 'Movil', safeName: 'Movil', type: 'varchar' }, { name: 'IdPac', safeName: 'IdPac', type: 'int' }, { name: 'HorLlegada', safeName: 'HorLlegada', type: 'int' }, { name: 'Retraso', safeName: 'Retraso', type: 'int' }, { name: 'BOX', safeName: 'BOX', type: 'varchar' }, { name: 'HorConsul', safeName: 'HorConsul', type: 'int' }, { name: 'HorFinal', safeName: 'HorFinal', type: 'int' }, { name: 'NOTAS', safeName: 'NOTAS', type: 'text' }, { name: 'NUMPAC', safeName: 'NUMPAC', type: 'varchar' }, { name: 'AgStats', safeName: 'AgStats', type: 'char' }, { name: 'FecAlta', safeName: 'FecAlta', type: 'smalldatetime' }, { name: 'Recordada', safeName: 'Recordada', type: 'tinyint' }, { name: 'Confirmada', safeName: 'Confirmada', type: 'tinyint' }, { name: 'IdBox', safeName: 'IdBox', type: 'int' }, { name: 'IdCitasP', safeName: 'IdCitasP', type: 'int' }, { name: 'NumOcur', safeName: 'NumOcur', type: 'int' }, { name: 'DCitasGrp', safeName: 'DCitasGrp', type: 'char' }, { name: 'CantIntegGrp', safeName: 'CantIntegGrp', type: 'int' }, { name: 'Gratuita', safeName: 'Gratuita', type: 'bit' }, { name: 'IdUserIns', safeName: 'IdUserIns', type: 'int' }, { name: 'IdCli', safeName: 'IdCli', type: 'int' }, { name: 'MotivoAnulacion', safeName: 'MotivoAnulacion', type: 'text' }, { name: 'NumAuto', safeName: 'NumAuto', type: 'varchar' }, { name: 'IdRef', safeName: 'IdRef', type: 'int' }, { name: 'IdProced', safeName: 'IdProced', type: 'int' }, { name: 'IdPartner', safeName: 'IdPartner', type: 'int' }, { name: 'FecNacim', safeName: 'FecNacim', type: 'smalldatetime' }, { name: 'NIF', safeName: 'NIF', type: 'char' }, { name: 'IdPacExt', safeName: 'IdPacExt', type: 'nvarchar' }, { name: 'IdOpc', safeName: 'IdOpc', type: 'varchar' }, { name: 'Email', safeName: 'Email', type: 'varchar' }, { name: 'IdCita', safeName: 'IdCita', type: 'bigint' }, { name: 'IdCia', safeName: 'IdCia', type: 'int' }, { name: 'IdTipoEspec', safeName: 'IdTipoEspec', type: 'int' }, { name: 'IdCol', safeName: 'IdCol', type: 'int' }, { name: 'IdCentro', safeName: 'IdCentro', type: 'int' }, { name: 'Comodin1', safeName: 'Comodin1', type: 'varchar' }, { name: 'Comodin2', safeName: 'Comodin2', type: 'varchar' }, { name: 'Aceptada', safeName: 'Aceptada', type: 'smalldatetime' }, { name: 'IdCitaConector', safeName: 'IdCitaConector', type: 'varchar' }, { name: 'HorSitCita', safeName: 'HorSitCita', type: 'smalldatetime' }, { name: 'IdGrAgdOpc', safeName: 'IdGrAgdOpc', type: 'int' }, { name: 'IdMotivoAnulacion', safeName: 'IdMotivoAnulacion', type: 'int' }, { name: 'IdIcono', safeName: 'IdIcono', type: 'int' }, { name: 'NumActos1Tto', safeName: 'NumActos1Tto', type: 'int' }, { name: 'IdTarifa', safeName: 'IdTarifa', type: 'int' }, { name: 'OrigenExt', safeName: 'OrigenExt', type: 'nvarchar' }, { name: 'SolicitanteNUMPAC', safeName: 'SolicitanteNUMPAC', type: 'varchar' }, { name: 'SolicitanteDesc', safeName: 'SolicitanteDesc', type: 'varchar' }, { name: 'TipoDocIdent', safeName: 'TipoDocIdent', type: 'int' }, { name: 'IdPaisIdent', safeName: 'IdPaisIdent', type: 'int' }, { name: 'Id_MotivoCitacion', safeName: 'Id_MotivoCitacion', type: 'int' }, { name: 'IdOrigenIns', safeName: 'IdOrigenIns', type: 'int' }, { name: 'IdOrden_Bloqueado', safeName: 'IdOrden_Bloqueado', type: 'int' }, { name: 'EnviarRecordatorio', safeName: 'EnviarRecordatorio', type: 'datetime' }, { name: 'EnviarConfirmacion', safeName: 'EnviarConfirmacion', type: 'datetime' }, { name: 'OrigenAnulacion', safeName: 'OrigenAnulacion', type: 'int' }, { name: 'AnulacionGestionada', safeName: 'AnulacionGestionada', type: 'datetime' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('dcitas', mapped);
    console.log(` ✅ DCitas complete!`);
  } catch (e) { console.error(` ❌ Error in DCitas:`, e.message); }

  console.log('Migrating TtosMed (56775 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [TtosMed]');
    const cols = [{ name: 'IdPac', safeName: 'IdPac', type: 'int' }, { name: 'NumTto', safeName: 'NumTto', type: 'int' }, { name: 'IdTto', safeName: 'IdTto', type: 'int' }, { name: 'ZonasBoca', safeName: 'ZonasBoca', type: 'tinyint' }, { name: 'PiezasAdu', safeName: 'PiezasAdu', type: 'numeric' }, { name: 'PiezasLec', safeName: 'PiezasLec', type: 'numeric' }, { name: 'PiezasNum', safeName: 'PiezasNum', type: 'numeric' }, { name: 'ZonasPieza', safeName: 'ZonasPieza', type: 'numeric' }, { name: 'DespX', safeName: 'DespX', type: 'int' }, { name: 'DespY', safeName: 'DespY', type: 'int' }, { name: 'Rotacion', safeName: 'Rotacion', type: 'int' }, { name: 'StaTto', safeName: 'StaTto', type: 'tinyint' }, { name: 'FecIni', safeName: 'FecIni', type: 'smalldatetime' }, { name: 'FecFin', safeName: 'FecFin', type: 'smalldatetime' }, { name: 'IdCol', safeName: 'IdCol', type: 'int' }, { name: 'Notas', safeName: 'Notas', type: 'text' }, { name: 'Importe', safeName: 'Importe', type: 'numeric' }, { name: 'Dto', safeName: 'Dto', type: 'int' }, { name: 'Pendiente', safeName: 'Pendiente', type: 'float' }, { name: 'IdTipoOdg', safeName: 'IdTipoOdg', type: 'int' }, { name: 'Actos', safeName: 'Actos', type: 'tinyint' }, { name: 'Tiempo', safeName: 'Tiempo', type: 'int' }, { name: 'IdCli', safeName: 'IdCli', type: 'int' }, { name: 'Ident', safeName: 'Ident', type: 'int' }, { name: 'Autoriz', safeName: 'Autoriz', type: 'varchar' }, { name: 'NumFinan', safeName: 'NumFinan', type: 'varchar' }, { name: 'IdUser', safeName: 'IdUser', type: 'int' }, { name: 'Comodin1', safeName: 'Comodin1', type: 'varchar' }, { name: 'IdColAux', safeName: 'IdColAux', type: 'int' }, { name: 'Edu10', safeName: 'Edu10', type: 'tinyint' }, { name: 'Edu11', safeName: 'Edu11', type: 'tinyint' }, { name: 'Edu12', safeName: 'Edu12', type: 'tinyint' }, { name: 'Edu13', safeName: 'Edu13', type: 'tinyint' }, { name: 'Edu14', safeName: 'Edu14', type: 'tinyint' }, { name: 'Edu20', safeName: 'Edu20', type: 'tinyint' }, { name: 'Edu21', safeName: 'Edu21', type: 'tinyint' }, { name: 'Edu22', safeName: 'Edu22', type: 'tinyint' }, { name: 'Edu23', safeName: 'Edu23', type: 'tinyint' }, { name: 'Edu24', safeName: 'Edu24', type: 'tinyint' }, { name: 'TipoOperac', safeName: 'TipoOperac', type: 'int' }, { name: 'CampoAux1', safeName: 'CampoAux1', type: 'varchar' }, { name: 'CampoAux2', safeName: 'CampoAux2', type: 'varchar' }, { name: 'CampoAux3', safeName: 'CampoAux3', type: 'varchar' }, { name: 'CampoAux4', safeName: 'CampoAux4', type: 'varchar' }, { name: 'CampoAux5', safeName: 'CampoAux5', type: 'varchar' }, { name: 'CampoAux6', safeName: 'CampoAux6', type: 'varchar' }, { name: 'SesRealiz', safeName: 'SesRealiz', type: 'int' }, { name: 'FechaCaduc', safeName: 'FechaCaduc', type: 'smalldatetime' }, { name: '_fechareg', safeName: 'f_fechareg', type: 'datetime' }, { name: 'IdRef', safeName: 'IdRef', type: 'int' }, { name: 'IdProced', safeName: 'IdProced', type: 'int' }, { name: 'IdTipoEspec', safeName: 'IdTipoEspec', type: 'int' }, { name: 'NumDocUnico', safeName: 'NumDocUnico', type: 'varchar' }, { name: 'IdCentro', safeName: 'IdCentro', type: 'int' }, { name: 'IdEmisor', safeName: 'IdEmisor', type: 'int' }, { name: 'ImporteDto', safeName: 'ImporteDto', type: 'numeric' }, { name: 'IdColValida', safeName: 'IdColValida', type: 'int' }, { name: 'FechaValida', safeName: 'FechaValida', type: 'datetime' }, { name: 'UniqueID', safeName: 'UniqueID', type: 'int' }, { name: '_version', safeName: 'f_version', type: 'int' }, { name: 'IdPresuTto', safeName: 'IdPresuTto', type: 'int' }, { name: 'DescTarifaConector', safeName: 'DescTarifaConector', type: 'varchar' }, { name: 'ImportePrivado', safeName: 'ImportePrivado', type: 'numeric' }, { name: 'ImporteMutua', safeName: 'ImporteMutua', type: 'numeric' }, { name: 'IdUserEdit', safeName: 'IdUserEdit', type: 'int' }, { name: '_fecharegEdit', safeName: 'f_fecharegEdit', type: 'datetime' }, { name: 'NFacturaEl', safeName: 'NFacturaEl', type: 'varchar' }, { name: 'NumTransaccion', safeName: 'NumTransaccion', type: 'int' }, { name: 'IdDevolucionTransaccion', safeName: 'IdDevolucionTransaccion', type: 'int' }, { name: 'IdPlanEcoCuota', safeName: 'IdPlanEcoCuota', type: 'int' }, { name: 'IdCCDiagnostico', safeName: 'IdCCDiagnostico', type: 'int' }, { name: 'Cuadrantes', safeName: 'Cuadrantes', type: 'numeric' }, { name: 'Arcadas', safeName: 'Arcadas', type: 'numeric' }, { name: 'FecExpoCp', safeName: 'FecExpoCp', type: 'datetime' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }, { name: 'CId', safeName: 'CId', type: 'nvarchar' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('ttosmed', mapped);
    console.log(` ✅ TtosMed complete!`);
  } catch (e) { console.error(` ❌ Error in TtosMed:`, e.message); }

  console.log('Migrating PresuTto (117256 rows)...');
  try {
    const res = await pool.request().query('SELECT * FROM [PresuTto]');
    const cols = [{ name: 'IdPac', safeName: 'IdPac', type: 'int' }, { name: 'NumSerie', safeName: 'NumSerie', type: 'int' }, { name: 'NumPre', safeName: 'NumPre', type: 'int' }, { name: 'LinPre', safeName: 'LinPre', type: 'int' }, { name: 'IdTto', safeName: 'IdTto', type: 'int' }, { name: 'ZonasBoca', safeName: 'ZonasBoca', type: 'tinyint' }, { name: 'PiezasAdu', safeName: 'PiezasAdu', type: 'numeric' }, { name: 'PiezasLec', safeName: 'PiezasLec', type: 'numeric' }, { name: 'PiezasNum', safeName: 'PiezasNum', type: 'numeric' }, { name: 'ZonasPieza', safeName: 'ZonasPieza', type: 'numeric' }, { name: 'DespX', safeName: 'DespX', type: 'int' }, { name: 'DespY', safeName: 'DespY', type: 'int' }, { name: 'Rotacion', safeName: 'Rotacion', type: 'int' }, { name: 'StaTto', safeName: 'StaTto', type: 'tinyint' }, { name: 'FecIni', safeName: 'FecIni', type: 'smalldatetime' }, { name: 'FecFin', safeName: 'FecFin', type: 'smalldatetime' }, { name: 'IdCol', safeName: 'IdCol', type: 'int' }, { name: 'IdCli', safeName: 'IdCli', type: 'int' }, { name: 'Unidades', safeName: 'Unidades', type: 'int' }, { name: 'ImportePre', safeName: 'ImportePre', type: 'float' }, { name: 'Dto', safeName: 'Dto', type: 'int' }, { name: 'Notas', safeName: 'Notas', type: 'text' }, { name: 'IdTipoOdg', safeName: 'IdTipoOdg', type: 'int' }, { name: 'Tiempo', safeName: 'Tiempo', type: 'int' }, { name: 'FecAcepta', safeName: 'FecAcepta', type: 'smalldatetime' }, { name: 'BaseImponible', safeName: 'BaseImponible', type: 'float' }, { name: 'IdTipoIVA', safeName: 'IdTipoIVA', type: 'int' }, { name: 'TpcIVA', safeName: 'TpcIVA', type: 'real' }, { name: 'ImporteIVA', safeName: 'ImporteIVA', type: 'float' }, { name: 'ImporteUni', safeName: 'ImporteUni', type: 'float' }, { name: 'IdColAux', safeName: 'IdColAux', type: 'int' }, { name: 'ImporteDto', safeName: 'ImporteDto', type: 'float' }, { name: 'Ident', safeName: 'Ident', type: 'int' }, { name: 'Orden', safeName: 'Orden', type: 'int' }, { name: 'IdTratamiento', safeName: 'IdTratamiento', type: 'int' }, { name: '_version', safeName: 'f_version', type: 'int' }, { name: 'IdTtoMedOrig', safeName: 'IdTtoMedOrig', type: 'int' }, { name: 'Cuadrantes', safeName: 'Cuadrantes', type: 'numeric' }, { name: 'Arcadas', safeName: 'Arcadas', type: 'numeric' }, { name: 'Id_Presu', safeName: 'Id_Presu', type: 'int' }, { name: 'Guid_Tenant', safeName: 'Guid_Tenant', type: 'uniqueidentifier' }];
    const mapped = [];
    for(const r of res.recordset) mapped.push(await mapRow(r, cols));
    await chunkedInsert('presutto', mapped);
    console.log(` ✅ PresuTto complete!`);
  } catch (e) { console.error(` ❌ Error in PresuTto:`, e.message); }

  await pool.close();
  await prisma.$disconnect();
}

main().catch(console.error);
