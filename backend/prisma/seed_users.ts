// seed_users.ts — Crea usuario admin inicial en SmileStudio
// Uso: npx tsx prisma/seed_users.ts
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const SALT_ROUNDS = 12;

const INITIAL_USERS = [
    {
        email: 'info@rubiogarciadental.com',
        password: '190582',
        name: 'Administrador',
        role: 'admin' as const,
    },
    {
        email: 'doctor@rubiogarciadental.com',
        password: 'Doctor2026!Smile',
        name: 'Dr. Rubio García',
        role: 'doctor' as const,
        specialty: 'Odontología General',
    },
    {
        email: 'recepcion@rubiogarciadental.com',
        password: 'Recep2026!Smile',
        name: 'Recepción',
        role: 'reception' as const,
    },
];

async function main() {
    console.log('Creando usuarios iniciales...\n');

    for (const u of INITIAL_USERS) {
        const existing = await prisma.user.findUnique({ where: { email: u.email } });
        if (existing) {
            console.log(`  ⚠️  Ya existe: ${u.email} — omitido`);
            continue;
        }

        const hashedPassword = await bcrypt.hash(u.password, SALT_ROUNDS);
        const created = await prisma.user.create({
            data: {
                email: u.email,
                password: hashedPassword,
                name: u.name,
                role: u.role,
                specialty: u.specialty ?? null,
            },
        });

        console.log(`  ✅  Creado: ${created.email} (${created.role})`);
    }

    console.log('\nCredenciales de acceso:');
    console.log('  Admin       → info@rubiogarciadental.com / 190582');
    console.log('  Doctor      → doctor@rubiogarciadental.com / Doctor2026!Smile');
    console.log('  Recepción   → recepcion@rubiogarciadental.com / Recep2026!Smile');
    console.log('\n⚠️  Cambia las contraseñas tras el primer login.\n');
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
