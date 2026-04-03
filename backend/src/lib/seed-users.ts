// ═══════════════════════════════════════════════════════════════════════════════
// Seed Users — Auto-initialize database with default admin users on startup
// ═══════════════════════════════════════════════════════════════════════════════

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

export async function ensureDefaultUsersExist() {
    try {
        let created = 0;
        let skipped = 0;

        for (const u of INITIAL_USERS) {
            const existing = await prisma.user.findUnique({ where: { email: u.email } });
            if (existing) {
                console.log(`[SEED] ⚠️  User already exists: ${u.email}`);
                skipped++;
                continue;
            }

            const hashedPassword = await bcrypt.hash(u.password, SALT_ROUNDS);
            await prisma.user.create({
                data: {
                    email: u.email,
                    password: hashedPassword,
                    name: u.name,
                    role: u.role,
                    specialty: u.specialty ?? null,
                },
            });

            console.log(`[SEED] ✅ Created user: ${u.email} (${u.role})`);
            created++;
        }

        if (created > 0) {
            console.log(`\n${'='.repeat(70)}`);
            console.log(`[SEED] ${created} new user(s) created`);
            console.log(`${'='.repeat(70)}`);
            console.log('[SEED] Login credentials:');
            INITIAL_USERS.forEach((u) => {
                const credStr = `${u.email} / ${u.password}`;
                console.log(`  • ${credStr}`);
            });
            console.log(`${'='.repeat(70)}\n`);
        } else if (skipped > 0) {
            console.log(`[SEED] All ${skipped} users already exist, skipping`);
        }

        return { created, skipped };
    } catch (error) {
        console.error('[SEED] Error seeding default users:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// For manual execution: npx ts-node src/lib/seed-users.ts
if (require.main === module) {
    ensureDefaultUsersExist()
        .then(({ created, skipped }) => {
            process.exit(0);
        })
        .catch((error) => {
            console.error(error);
            process.exit(1);
        });
}
