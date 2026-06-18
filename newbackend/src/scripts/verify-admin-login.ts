
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    const username = 'techmaster';
    const password = '123456';

    console.log(`Checking user: ${username}`);

    const user = await prisma.user.findUnique({
        where: { username },
    });

    if (!user) {
        console.log('❌ User not found in database.');
        return;
    }

    console.log(`✅ User found: ID ${user.id}, Role: ${user.role}`);

    const isMatch = await bcrypt.compare(password, user.password);

    if (isMatch) {
        console.log('✅ Password "123456" is VALID.');
    } else {
        console.log('❌ Password "123456" is INVALID.');

        // Optional: Reset it
        console.log('Reseting password to "123456"...');
        const hashedPassword = await bcrypt.hash(password, 10);
        await prisma.user.update({
            where: { username },
            data: { password: hashedPassword }
        });
        console.log('✅ Password reset complete.');
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
