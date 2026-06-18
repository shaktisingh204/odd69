"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function check() {
    const events = await prisma.event.findMany({
        where: {
            event_name: 'India v Australia'
        },
        include: {
            markets: {
                include: {
                    marketOdds: true
                }
            }
        }
    });
    console.log(JSON.stringify(events, null, 2));
}
check().catch(e => console.error(e)).finally(() => prisma.$disconnect());
//# sourceMappingURL=check-odds.js.map