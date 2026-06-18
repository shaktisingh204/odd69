"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
const popularGames = [
    "Starburst", "Book of Dead", "Mega Moolah", "Fire Joker", "Gonzo's Quest",
    "Bonanza", "Sweet Bonanza", "Gates of Olympus", "Reactoonz", "Legacy of Dead",
    "Razor Shark", "Money Train", "Jammin' Jars", "Wolf Gold", "Big Bass Bonanza",
    "Moon Princess", "Rise of Merlin", "Dead or Alive", "Immortal Romance", "Divine Fortune",
    "Lightning Roulette", "Crazy Time", "Monopoly Live", "Dream Catcher", "Mega Ball",
    "Cash or Crash", "Deal or No Deal", "Blackjack", "Roulette", "Baccarat",
    "Poker", "Craps", "Sic Bo", "Dragon Tiger"
];
const newGames = [
    "72 Fortunes", "Ra’s Golden Loot", "Hot Lucky 7’s", "Precious Panda", "Triple Irish",
    "Magic Fusion", "Ultimate Fire Link", "Double Diamonds 50", "Sparky & Shortz",
    "Alohawaii", "Candy Combo", "Cash Volt", "Hollywood Murder Mystery", "Rise of Ymir",
    "Triple Gold Bars", "Sugar Rush 1000", "Curse of the Werewolf", "The Dog House Megaways",
    "Zeus vs Hades", "Cowboy Coins", "Lightning Storm", "Red Door Roulette", "Balloon Race",
    "Stock Market", "Crazy Pachinko", "Imperial Quest", "Treasure Island"
];
async function main() {
    console.log("Starting tagging process...");
    let popularCount = 0;
    for (const game of popularGames) {
        const games = await prisma.casinoGame.findMany({
            where: {
                name: { contains: game, mode: 'insensitive' },
                isActive: true
            },
            take: 5
        });
        for (const g of games) {
            await prisma.casinoGame.update({
                where: { id: g.id },
                data: { type: 'POPULAR' }
            });
            popularCount++;
        }
    }
    console.log(`Tagged ${popularCount} games as POPULAR.`);
    let newCount = 0;
    for (const game of newGames) {
        const games = await prisma.casinoGame.findMany({
            where: {
                name: { contains: game, mode: 'insensitive' },
                isActive: true
            }
        });
        for (const g of games) {
            await prisma.casinoGame.update({
                where: { id: g.id },
                data: { type: 'NEW' }
            });
            newCount++;
        }
    }
    console.log(`Tagged ${newCount} games as NEW.`);
}
main()
    .catch(e => console.error(e))
    .finally(async () => {
    await prisma.$disconnect();
});
//# sourceMappingURL=tag-games.js.map