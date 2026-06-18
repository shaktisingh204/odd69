"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
async function seed() {
    console.log("Seeding live cricket match with scores...");
    const comp = await prisma.competition.upsert({
        where: { competition_id: 'COMP_T20_001' },
        update: {},
        create: {
            competition_id: 'COMP_T20_001',
            competition_name: 'International • T20 World Cup',
            sport_id: 4
        }
    });
    const openDate = new Date();
    const event = await prisma.event.upsert({
        where: { event_id: 'EVT_LIVE_001' },
        update: {
            score1: '0/0',
            score2: '26/0',
            match_info: '1 INN, 4.0 OV',
            match_status: 'Live',
            home_team: 'New Zealand',
            away_team: 'Afghanistan'
        },
        create: {
            event_id: 'EVT_LIVE_001',
            event_name: 'New Zealand v Afghanistan',
            competition_id: comp.competition_id,
            open_date: openDate,
            timezone: 'UTC',
            score1: '0/0',
            score2: '26/0',
            match_info: '1 INN, 4.0 OV',
            match_status: 'Live',
            home_team: 'New Zealand',
            away_team: 'Afghanistan'
        }
    });
    const markets = [
        {
            name: 'Winner (incl. super over)',
            id: 'MKT_WIN_001',
            odds: { b0: 1.42, b1: 2.85, l0: '1', l1: '2' }
        },
        {
            name: 'First innings - New Zealand total',
            id: 'MKT_FIRST_NZ_001',
            odds: { b0: 1.85, b1: 1.85, l0: 'over 150.5', l1: 'under 150.5' }
        },
        {
            name: 'First innings - Afghanistan total',
            id: 'MKT_FIRST_AFG_001',
            odds: { b0: 1.85, b1: 1.85, l0: 'over 158.5', l1: 'under 158.5' }
        },
        {
            name: 'First innings over 6 - Afghanistan total',
            id: 'MKT_OVER_6_AFG_001',
            odds: { b0: 1.75, b1: 1.92, l0: 'over 8.5', l1: 'under 8.5' }
        },
        {
            name: 'First innings - 4.2 delivery Afghanistan runs',
            id: 'MKT_DEL_AFG_001',
            odds: { b0: 2.05, b1: 2.75, b2: 7.25, l0: '0', l1: '1', l2: '2' }
        }
    ];
    for (const m of markets) {
        const market = await prisma.market.upsert({
            where: { market_id: m.id },
            update: {},
            create: {
                market_id: m.id,
                market_name: m.name,
                event_id: event.event_id,
                runner1: m.odds.l0,
                runner2: m.odds.l1,
            }
        });
        await prisma.marketOdd.upsert({
            where: { market_id: market.market_id },
            update: {
                back0_price: m.odds.b0,
                back1_price: m.odds.b1,
                back2_price: m.odds.b2 || null,
            },
            create: {
                market_id: market.market_id,
                event_id: event.event_id,
                back0_price: m.odds.b0,
                back1_price: m.odds.b1,
                back2_price: m.odds.b2 || null,
            }
        });
    }
    console.log("Seeding complete. New Zealand v Afghanistan created with scores.");
}
seed().catch(console.error).finally(() => prisma.$disconnect());
//# sourceMappingURL=seed-live-score.js.map