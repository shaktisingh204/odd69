"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function seed() {
    console.log("Seeding test cricket match...");
    const comp = await prisma.competition.upsert({
        where: { competition_id: 'COMP_TEST_001' },
        update: {},
        create: {
            competition_id: 'COMP_TEST_001',
            competition_name: 'International • Test Series',
            sport_id: 4
        }
    });
    const openDate = new Date();
    openDate.setHours(openDate.getHours() + 1);
    const event = await prisma.event.upsert({
        where: { event_id: 'EVT_TEST_001' },
        update: { open_date: openDate },
        create: {
            event_id: 'EVT_TEST_001',
            event_name: 'India v Australia',
            competition_id: comp.competition_id,
            open_date: openDate,
            timezone: 'UTC'
        }
    });
    const market = await prisma.market.upsert({
        where: { market_id: 'MKT_TEST_001' },
        update: {},
        create: {
            market_id: 'MKT_TEST_001',
            market_name: 'Winner',
            event_id: event.event_id,
            runner1: 'India',
            runner2: 'Australia',
            draw: 'Draw'
        }
    });
    await prisma.marketOdd.upsert({
        where: { market_id: market.market_id },
        update: {
            back0_price: 1.85,
            back1_price: 2.10,
            back2_price: 15.0
        },
        create: {
            market_id: market.market_id,
            event_id: event.event_id,
            back0_price: 1.85,
            back1_price: 2.10,
            back2_price: 15.0
        }
    });
    const marketToss = await prisma.market.upsert({
        where: { market_id: 'MKT_TEST_002' },
        update: {},
        create: {
            market_id: 'MKT_TEST_002',
            market_name: 'Toss',
            event_id: event.event_id,
            runner1: 'India',
            runner2: 'Australia'
        }
    });
    await prisma.marketOdd.upsert({
        where: { market_id: marketToss.market_id },
        update: {
            back0_price: 1.9,
            back1_price: 1.9
        },
        create: {
            market_id: marketToss.market_id,
            event_id: event.event_id,
            back0_price: 1.9,
            back1_price: 1.9
        }
    });
    console.log("Seeding complete. Event: India v Australia created.");
}
seed().catch(console.error).finally(() => prisma.$disconnect());
//# sourceMappingURL=seed-sports.js.map