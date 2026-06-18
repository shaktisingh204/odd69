"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    const username = '8955823066';
    const existingUser = await prisma.user.findUnique({ where: { username } });
    if (existingUser) {
        console.log(`User ${username} already exists.`);
    }
    else {
        await prisma.user.create({
            data: {
                username: username,
                password: 'password123',
                balance: 10000.0,
                exposure: 0,
                bonus: 0,
                currency: 'INR'
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
//# sourceMappingURL=create-test-user.js.map