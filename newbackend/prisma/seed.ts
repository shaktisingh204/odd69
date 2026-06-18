
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

// Role enum might not be exported if client generation is pending or weird.
// Defining it manually here to be safe for the script.
enum Role {
    TECH_MASTER = 'TECH_MASTER',
    SUPER_ADMIN = 'SUPER_ADMIN',
    MANAGER = 'MANAGER',
    USER = 'USER'
}

const prisma = new PrismaClient();

async function main() {
    console.log('Seeding database...');

    const techMasterEmail = 'techmaster@100xwins.com';
    const existingTechMaster = await prisma.user.findFirst({
        where: { email: techMasterEmail },
    });

    if (!existingTechMaster) {
        const hashedPassword = await bcrypt.hash('password123', 10);
        const techMaster = await prisma.user.create({
            data: {
                email: techMasterEmail,
                username: 'TechMaster',
                password: hashedPassword,
                role: Role.TECH_MASTER,
                balance: 1000000,
                currency: 'INR',
                phoneNumber: '0000000000',
            },
        });
        console.log('Created Tech Master:', techMaster.email);
    } else {
        console.log('Tech Master already exists.');
    }

    const superAdminEmail = 'superadmin@100xwins.com';
    const existingSuperAdmin = await prisma.user.findFirst({
        where: { email: superAdminEmail }
    });

    if (!existingSuperAdmin) {
        const hashedPassword = await bcrypt.hash('password123', 10);
        const superAdmin = await prisma.user.create({
            data: {
                email: superAdminEmail,
                username: 'SuperAdmin',
                password: hashedPassword,
                role: Role.SUPER_ADMIN,
                balance: 500000,
                currency: 'INR',
                phoneNumber: '0000000001'
            }
        });
        console.log('Created Super Admin:', superAdmin.email);
    } else {
        console.log('Super Admin already exists.');
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
