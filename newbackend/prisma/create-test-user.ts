
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
    const username = '8955823066';
    const existingUser = await prisma.user.findUnique({ where: { username } });

    if (existingUser) {
        console.log(`User ${username} already exists.`);
    } else {
        await prisma.user.create({
            data: {
                username: username,
                password: 'password123', // Demo password
                balance: 10000.0,
                exposure: 0,
                bonus: 0,
                currency: 'INR'
                // role: 'user' // Removed as not in schema
            }
        });
        console.log(`User ${username} created with 10000 balance.`);
    }
}

main()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
