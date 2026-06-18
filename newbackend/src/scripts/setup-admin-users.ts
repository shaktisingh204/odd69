
import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    const password = '123456'; // Default password for all admin users
    const saltOrRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltOrRounds);

    const adminUsers = [
        {
            username: 'techmaster',
            email: 'techmaster@admin.com',
            role: Role.TECH_MASTER,
        },
        {
            username: 'superadmin',
            email: 'superadmin@admin.com',
            role: Role.SUPER_ADMIN,
        },
        {
            username: 'manager',
            email: 'manager@admin.com',
            role: Role.MANAGER,
        },
    ];

    console.log('Seeding admin users...');

    for (const user of adminUsers) {
        try {
            const UpsertUser = await prisma.user.upsert({
                where: { username: user.username },
                update: {
                    role: user.role,
                    password: hashedPassword, // Ensure password is set/reset to known value
                },
                create: {
                    username: user.username,
                    email: user.email,
                    password: hashedPassword,
                    role: user.role,
                    balance: 0,
                    exposure: 0,
                },
            });
            console.log(`✅ User ${user.username} (${user.role}) ready.`);
        } catch (error) {
            console.error(`❌ Error seeding ${user.username}:`, error);
        }
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
