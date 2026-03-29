// ─── Seed: Pacientes realistas ──────────────────────────────────
// Ejecuta: npx tsx prisma/seed_patients.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PACIENTES = [
  { NumPac: '00000001', Nombre: 'María', Apellidos: 'García López', NIF: '12345678A', TelMovil: '612345678', Email: 'maria.garcia@gmail.com', Sexo: 'M', FecNacim: new Date('1985-03-15'), Direccion: 'Calle Mayor 12, 3ºB', CP: '30001' },
  { NumPac: '00000002', Nombre: 'Antonio', Apellidos: 'Martínez Ruiz', NIF: '23456789B', TelMovil: '623456789', Email: 'antonio.mruiz@hotmail.com', Sexo: 'H', FecNacim: new Date('1978-07-22'), Direccion: 'Av. de la Libertad 45', CP: '30002' },
  { NumPac: '00000003', Nombre: 'Carmen', Apellidos: 'Fernández Torres', NIF: '34567890C', TelMovil: '634567890', Email: 'carmen.ftorres@gmail.com', Sexo: 'M', FecNacim: new Date('1990-11-08'), Direccion: 'Plaza de España 7', CP: '30003' },
  { NumPac: '00000004', Nombre: 'José', Apellidos: 'López Navarro', NIF: '45678901D', TelMovil: '645678901', Email: 'jose.lopez@yahoo.es', Sexo: 'H', FecNacim: new Date('1965-02-28'), Direccion: 'Calle del Pino 23', CP: '30004' },
  { NumPac: '00000005', Nombre: 'Ana', Apellidos: 'Sánchez Moreno', NIF: '56789012E', TelMovil: '656789012', Email: 'ana.sanchez@gmail.com', Sexo: 'M', FecNacim: new Date('1995-06-14'), Direccion: 'Calle Rosalía de Castro 8', CP: '30005' },
  { NumPac: '00000006', Nombre: 'Francisco', Apellidos: 'Hernández Gil', NIF: '67890123F', TelMovil: '667890123', Email: 'fran.hernandez@outlook.es', Sexo: 'H', FecNacim: new Date('1972-09-03'), Direccion: 'Av. Juan Carlos I, 56', CP: '30006' },
  { NumPac: '00000007', Nombre: 'Laura', Apellidos: 'Díaz Romero', NIF: '78901234G', TelMovil: '678901234', Email: 'laura.diaz@icloud.com', Sexo: 'M', FecNacim: new Date('1988-12-20'), Direccion: 'Calle de la Paz 14', CP: '30007' },
  { NumPac: '00000008', Nombre: 'Manuel', Apellidos: 'Muñoz Jiménez', NIF: '89012345H', TelMovil: '689012345', Email: 'manuel.munoz@gmail.com', Sexo: 'H', FecNacim: new Date('1945-04-17'), Direccion: 'Paseo de la Castellana 120', CP: '30008' },
  { NumPac: '00000009', Nombre: 'Isabel', Apellidos: 'Álvarez Martín', NIF: '90123456J', TelMovil: '690123456', Email: 'isabel.alvarez@gmail.com', Sexo: 'M', FecNacim: new Date('2000-01-30'), Direccion: 'Calle Cervantes 5', CP: '30009' },
  { NumPac: '00000010', Nombre: 'Pedro', Apellidos: 'Romero Castro', NIF: '01234567K', TelMovil: '601234567', Email: 'pedro.romero@live.com', Sexo: 'H', FecNacim: new Date('1982-08-11'), Direccion: 'Av. de la Constitución 33', CP: '30010' },
  { NumPac: '00000011', Nombre: 'Elena', Apellidos: 'Ruiz Flores', NIF: '11223344L', TelMovil: '611223344', Email: 'elena.ruiz@gmail.com', Sexo: 'M', FecNacim: new Date('1993-05-25'), Direccion: 'Calle Olmo 9', CP: '30011' },
  { NumPac: '00000012', Nombre: 'David', Apellidos: 'Torres Blanco', NIF: '22334455M', TelMovil: '622334455', Email: 'david.torres@gmail.com', Sexo: 'H', FecNacim: new Date('1970-10-06'), Direccion: 'Calle del Sol 18', CP: '30012' },
  { NumPac: '00000013', Nombre: 'Lucía', Apellidos: 'Navarro Pérez', NIF: '33445566N', TelMovil: '633445566', Email: 'lucia.navarro@outlook.es', Sexo: 'M', FecNacim: new Date('2005-03-12'), Direccion: 'Plaza Mayor 2', CP: '30013' },
  { NumPac: '00000014', Nombre: 'Carlos', Apellidos: 'Moreno Vidal', NIF: '44556677P', TelMovil: '644556677', Email: 'carlos.moreno@gmail.com', Sexo: 'H', FecNacim: new Date('1958-12-01'), Direccion: 'Av. de Murcia 67', CP: '30014' },
  { NumPac: '00000015', Nombre: 'Sofía', Apellidos: 'Castaño Reyes', NIF: '55667788Q', TelMovil: '655667788', Email: 'sofia.castano@icloud.com', Sexo: 'M', FecNacim: new Date('1997-07-19'), Direccion: 'Calle Lorca 22', CP: '30015' },
  { NumPac: '00000016', Nombre: 'Javier', Apellidos: 'Ortega Serrano', NIF: '66778899R', TelMovil: '666778899', Email: 'javier.ortega@gmail.com', Sexo: 'H', FecNacim: new Date('1980-04-05'), Direccion: 'Calle Gran Vía 40', CP: '30016' },
  { NumPac: '00000017', Nombre: 'Patricia', Apellidos: 'Medina Ibáñez', NIF: '77889900S', TelMovil: '677889900', Email: 'patricia.medina@yahoo.es', Sexo: 'M', FecNacim: new Date('1992-09-28'), Direccion: 'Paseo Marítimo 15', CP: '30017' },
  { NumPac: '00000018', Nombre: 'Alejandro', Apellidos: 'Santos Domínguez', NIF: '88990011T', TelMovil: '688990011', Email: 'alejandro.santos@hotmail.com', Sexo: 'H', FecNacim: new Date('1975-01-14'), Direccion: 'Calle Real 31', CP: '30018' },
  { NumPac: '00000019', Nombre: 'Marta', Apellidos: 'Guerrero Ramos', NIF: '99001122U', TelMovil: '699001122', Email: 'marta.guerrero@gmail.com', Sexo: 'M', FecNacim: new Date('1987-06-07'), Direccion: 'Av. de los Pinos 9', CP: '30019' },
  { NumPac: '00000020', Nombre: 'Fernando', Apellidos: 'Crespo Herrera', NIF: '10203040V', TelMovil: '610203040', Email: 'fernando.crespo@live.com', Sexo: 'H', FecNacim: new Date('1968-11-23'), Direccion: 'Calle Nueva 55', CP: '30020' },
  { NumPac: '00000021', Nombre: 'Rosa', Apellidos: 'Peña Cortés', NIF: '20304050W', TelMovil: '620304050', Email: 'rosa.pena@gmail.com', Sexo: 'M', FecNacim: new Date('1955-08-16'), Direccion: 'Calle Alicante 3', CP: '30021' },
  { NumPac: '00000022', Nombre: 'Miguel', Apellidos: 'Iglesias León', NIF: '30405060X', TelMovil: '630405060', Email: 'miguel.iglesias@outlook.es', Sexo: 'H', FecNacim: new Date('2001-02-10'), Direccion: 'Av. del Mediterráneo 88', CP: '30022' },
  { NumPac: '00000023', Nombre: 'Cristina', Apellidos: 'Vega Pascual', NIF: '40506070Y', TelMovil: '640506070', Email: 'cristina.vega@icloud.com', Sexo: 'M', FecNacim: new Date('1983-10-31'), Direccion: 'Calle Quevedo 12', CP: '30023' },
  { NumPac: '00000024', Nombre: 'Ángel', Apellidos: 'Prieto Calvo', NIF: '50607080Z', TelMovil: '650607080', Email: 'angel.prieto@gmail.com', Sexo: 'H', FecNacim: new Date('1960-05-20'), Direccion: 'Plaza del Carmen 6', CP: '30024' },
  { NumPac: '00000025', Nombre: 'Paula', Apellidos: 'Mora Delgado', NIF: '60708090A', TelMovil: '660708090', Email: 'paula.mora@gmail.com', Sexo: 'M', FecNacim: new Date('1998-12-03'), Direccion: 'Calle Buenavista 27', CP: '30025' },
  { NumPac: '00000026', Nombre: 'Luis', Apellidos: 'Giménez Rubio', NIF: '70809010B', TelMovil: '670809010', Email: 'luis.gimenez@hotmail.com', Sexo: 'H', FecNacim: new Date('1973-03-09'), Direccion: 'Av. de la Fama 44', CP: '30026' },
  { NumPac: '00000027', Nombre: 'Beatriz', Apellidos: 'Herrero Campos', NIF: '80901020C', TelMovil: '680901020', Email: 'beatriz.herrero@gmail.com', Sexo: 'M', FecNacim: new Date('1991-07-15'), Direccion: 'Calle del Río 16', CP: '30027' },
  { NumPac: '00000028', Nombre: 'Alberto', Apellidos: 'Fuentes Aguilar', NIF: '90102030D', TelMovil: '690102030', Email: 'alberto.fuentes@yahoo.es', Sexo: 'H', FecNacim: new Date('1986-04-26'), Direccion: 'Paseo Alfonso X 10', CP: '30028' },
  { NumPac: '00000029', Nombre: 'Raquel', Apellidos: 'Vargas Molina', NIF: '01020304E', TelMovil: '601020304', Email: 'raquel.vargas@gmail.com', Sexo: 'M', FecNacim: new Date('2008-09-18'), Direccion: 'Calle Princesa 21', CP: '30029' },
  { NumPac: '00000030', Nombre: 'Adrián', Apellidos: 'Roldán Marín', NIF: '02030405F', TelMovil: '602030405', Email: 'adrian.roldan@live.com', Sexo: 'H', FecNacim: new Date('1977-11-04'), Direccion: 'Av. Primero de Mayo 35', CP: '30030' },
];

async function main() {
  console.log('🦷 Seeding pacientes...');

  const now = new Date();

  for (const p of PACIENTES) {
    await prisma.pacientes.upsert({
      where: { IdPac: parseInt(p.NumPac) },
      update: {},
      create: {
        NumPac:                p.NumPac,
        Nombre:                p.Nombre,
        Apellidos:             p.Apellidos,
        NIF:                   p.NIF,
        TelMovil:              p.TelMovil,
        Email:                 p.Email,
        Sexo:                  p.Sexo,
        FecNacim:              p.FecNacim,
        Direccion:             p.Direccion,
        CP:                    p.CP,
        FecAlta:               now,
        Mailing:               true,
        AceptaInfo:            true,
        AceptaSMS:             true,
        TipoDocIdent:          1,
        version:               1,
        fechaModif:            now,
        idUserModif:           1,
        LecturaDocIdentEstado: 0,
        LecturaDocIdentFecha:  now,
        LecturaDocIdentIdUser: 0,
        IdTipoDireccion:       0,
        NoContactable:         false,
        Derivado:              false,
        ExternalId:            '',
        Guid_Tenant:           '',
        AceptaBots:            true,
        AceptaWhatsApp:        true,
      },
    });
    console.log(`  ✓ ${p.NumPac} — ${p.Nombre} ${p.Apellidos}`);
  }

  const count = await prisma.pacientes.count();
  console.log(`\n✅ Total pacientes en BD: ${count}`);
}

main()
  .catch(e => { console.error('❌ Error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
