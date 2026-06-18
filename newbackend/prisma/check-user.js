"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function main() {
    const users = await prisma.user.findMany({ take: 1 });
    console.log(users);
}
main().finally(() => prisma.$disconnect());
//# sourceMappingURL=check-user.js.map