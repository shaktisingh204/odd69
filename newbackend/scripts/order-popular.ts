
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const desiredOrder = [
    "Aviator",
    "Ice Fishing",
    "CosmoX",
    "Tower Rush",
    "Aviatrix",
    "JetX",
    "3 Super Hot Chillies",
    "Skyward Deluxe",
    "Super Andar Bahar",
    "Maestro",
    "Mines",
    "Play Limbo",
    "Vortex",
    "Crazy Time",
    "Cricket Duel",
    "Special Fruits",
    "Aviajet",
    "Fire Roulette",
    "Wild Bounty Showdown",
    "Burning Chilli X",
    "Hi-Lo Western Live",
    "Diamonds Power: Hold and Win",
    "Sky of Olympus",
    "Royalty of Olympus Extreme",
    "Red Door Roulette",
    "Cricket Road",
    "Jurassic Kingdom",
    "Funky Time",
    "Peru Spin A Win Wild Live",
    "Bumba Meu Boi Coin",
    "Lightning Roulette",
    "Fortune Gems 3",
    "Joker Winpot",
    "Who Wants To Be A Millionaire Roulette",
    "Alibaba's Cave of Fortune",
    "Chicken Plinko",
    "Coin Era: Hold to Win",
    "Voltage Blitz Rapid",
    "Live Dragon Tiger",
    "Turbo Mines",
    "Cash Of Egypt",
    "Chicken Road 2",
    "The Greatest Show",
    "BalloniX",
    "Chicken Road",
    "Mines",
    "Phoenix DuelReels",
    "Le Pharaoh",
    "Glass Bridge",
    "Bob Marlin Goes Deep",
    "Bet on Teen Patti",
    "Andar Bahar",
    "Shoot Happens",
    "Pray for Three",
    "Zeus Winpot",
    "Its Shark Time 2",
    "Flame Fruits Frenzy",
    "M Andar Bahar",
    "Squid Gamebler",
    "Treasures of Aztec",
    "Ganesha Fortune",
    "Fortune Tiger",
    "M Dragon Tiger",
    "M Sic Bo",
    "Baccarat D01",
    "Shaolin Master",
    "Dragon's Domain",
    "Skyward",
    "Aloha King Elvis",
    "Aero",
    "SweetShop",
    "Cricket Crash",
    "Rocket Dice XY",
    "Space XY",
    "Fruit Towers",
    "Hi-Lo",
    "Wicket Blast",
    "Beach Life",
    "Bonus Mania",
    "Fortuna TRUEWAYS",
    "Crazy Balls",
    "Crazy Coin Flip",
    "Crazy Pachinko",
    "Crazy Time A",
    "Emperor Speed Baccarat D",
    "Extra Chilli Epic Spins",
    "Extreme Texas Hold'em",
    "Fan Tan",
    "First Person Bac Bo",
    "First Person Baccarat",
    "First Person Blackjack",
    "First Person Craps",
    "First Person Dragon Tiger",
    "First Person Dream Catcher",
    "First Person Golden Wealth Baccarat",
    "First Person HiLo",
    "First Person Lightning Baccarat",
    "First Person Lightning Blackjack",
    "First Person Mega Ball",
    "First Person Prosperity Tree Baccarat",
    "First Person Super Sic Bo",
    "First Person Top Card",
    "First Person Video Poker",
    "First Person XXXtreme Lightning Baccarat",
    "Football Studio",
    "Football Studio Dice",
    "Lightning Bac Bo",
    "Lightning Baccarat",
    "Lightning Ball",
    "Lightning Blackjack",
    "Lightning Dice",
    "Lightning Dragon Tiger",
    "Lightning Sic Bo",
    "Lightning Storm",
    "Vortex Halloween",
    "Its Shark Time!",
    "Vikings Wild Cash",
    "Cash Of Gods",
    "Bandidos Bang!",
    "Muay Thai Champion",
    "Ninja vs Samurai",
    "Leprechaun Riches",
    "The Great Icescape",
    "Ganesha Gold",
    "Gem Saviour Sword",
    "Legend of Hou Yi",
    "Dragon Legend",
    "Win Win Won",
    "Gem Saviour",
    "Captain's Bounty",
    "Emperor's Favour",
    "Jungle Delight",
    "Symbols of Egypt",
    "Piggy Gold",
    "Santa's Gift Rush",
    "Hip Hop Panda",
    "Prosperity Lion",
    "Mr. Hallow-Win",
    "Hood vs Wolf",
    "Plushie Frenzy",
    "Medusa 1",
    "Medusa 2",
    "Tree of Fortune",
    "Honey Trap of Diao Chan",
    "Fortune Gods",
    "M Pok Deng",
    "M Teen Patti 20-20",
    "M Thai HiLo",
    "M Fish Prawn Crab",
    "Legendary Monkey King",
    "Lucky Neko",
    "Thai River Wonders",
    "Circus Delight",
    "Vampire's Charm",
    "Genie's 3 Wishes",
    "Journey to the Wealth",
    "Dreams of Macau",
    "Wild Fireworks",
    "Mahjong Ways II",
    "Double Fortune",
    "Phoenix Rises",
    "Egypt's Book of Mystery",
    "Bikini Paradise",
    "Caishen Wins",
    "Candy Burst",
    "Shaolin Soccer",
    "Reel Love",
    "Fortune Mouse",
    "Dragon Hatch",
    "Mahjong Ways",
    "Gem Saviour Conquest",
    "Dragon Tiger Luck",
    "Flirting Scholar",
    "Le Viking",
    "Merlin's Alchemy",
    "Piggy Cluster Hun",
    "Shadow Strike",
    "SixSixSix",
    "Super Twins",
    "Temple of Torment",
    "Wanted: Dead or a Wild",
    "Wild Dojo Strike",
    "Xpander",
    "2 Wild 2 Die",
    "Barrel Bonanza",
    "Beast Below",
    "Cash Quest",
    "Commander of Trident",
    "Fist of Destruction",
    "Le Bandit",
    "Fortune Gems",
    "Super Ace",
    "Joker’s Million",
    "Boxing King",
    "Starburst XXXtreme",
    "Hot & Spicy JACKPOT",
    "Aztec Magic Bonanza",
    "Taxi Ride",
    "Pilot",
    "3x3: Hold The Spin",
    "Brilliant Gems",
    "Coin Win: Hold The Spin",
    "Super Niubi Deluxe",
    "9 Coins 1000x Edition",
    "Millionaire",
    "Kraken Coins",
    "Farm Hunt",
    "Devils Treasures",
    "Fish and Spins",
    "Wild 4RABET Tiger",
    "Money Booster",
    "Coin Era 2: Hold to Win",
    "Panda Bao",
    "Hot Slot: 777 Cash Out Burning Board",
    "Fortune Spin",
    "Twist",
    "3 Spirit Volcanoes",
    "4rabet Mania",
    "Auto Roulette",
    "Speed Auto Roulette",
    "Dragon Tiger",
    "Burning Wins: classic 5 lines",
    "Joker Expand",
    "Legend of Cleopatra",
    "Sevens&Fruits",
    "Fruits & Jokers: 40 lines",
    "100 Joker Staxx",
    "Sevens & Fruits: 20 lines",
    "Imperial Fruits: 5 lines",
    "Fruits & Jokers: 20 Lines",
    "Super Burning Wins",
    "Rise of Egypt",
    "Book of Gold: Double Chance",
    "Fruits & Jokers: 100 Lines",
    "3 Fruits Win: 10 lines",
    "Book of Gold: Classic",
    "Solar Queen",
    "Imperial Fruits: 100 lines",
    "2020 Hit Slot",
    "Sunny Fruits: Hold and Win",
    "Solar Temple",
    "Buffalo Power: Hold and Win",
    "Chance Machine 100",
    "Diamond Wins: Hold and Win",
    "Book of Gold: Multichance",
    "Solar King",
    "Chance Machine 40",
    "Wolf Power: Hold and Win",
    "Hot Coins: Hold and Win",
    "Hell Hot 100",
    "Joker Stoker",
    "Hot Burning Wins",
    "5 Fortunator",
    "Royal Coins: Hold and Win",
    "Burning Wins x2",
    "Buffalo Power: Christmas",
    "Diamond Fortunator: Hold and Win",
    "Joker’s Coins: Hold and Win",
    "Burning Fortunator",
    "Lion Gems: Hold and Win",
    "Book del Sol: Multiplier",
    "Luxor Gold: Hold and Win",
    "Ruby Hit: Hold and Win",
    "Treasures of Fire: Scatter Pays",
    "Pirate Chest: Hold and Win",
    "Mammoth Peak: Hold and Win",
    "Royal Joker: Hold and Win",
    "Giza Nights: Hold and Win",
    "Coin Strike: Hold and Win",
    "Buffalo Power 2: Hold and Win",
    "Royal Fortunator: Hold and Win",
    "Empire Gold: Hold and Win",
    "3 Pots Riches: Hold and Win",
    "Wolf Land: Hold and Win",
    "Crown and Diamonds: Hold and Win",
    "Energy Coins: Hold and Win",
    "777 Sizzling Wins: 5 Lines",
    "Fire Coins: Hold and Win",
    "Sherwood Coins: Hold and Win",
    "Fire Temple: Hold and Win",
    "Power Crown: Hold and Win",
    "3 Pots Riches Extra: Hold and Win",
    "3 MAGIC LAMPS: HOLD AND WIN",
    "Sunny Fruits 2: Hold and Win",
    "Clover Charm: Hit the Bonus",
    "Arizona Heist: Hold and Win",
    "Energy Joker: Hold and Win",
    "Thunder Coins: Hold and Win",
    "3 Carts of Gold: Hold and Win",
    "Supercharged Clovers: Hold and Win",
    "Piggy Power: Hit the Bonus",
    "3 Pirate Barrels: Hold and Win",
    "Pink Joker: Hold and Win",
    "Lightning Clovers: Hit the Bonus",
    "Merry Giftmas: Hold and Win",
    "Jingle Coins: Hold and Win",
    "25 Cookies: Hit the Bonus",
    "3 Luxor Pots: Hold and Win",
    "3 Chillies and Joker: Hold and Win",
    "Charge the Clovers",
    "Royal Express: Hold and Win",
    "King of the Sky: Hit the Bonus",
    "3x Catch",
    "Thunder Coins XXL: Hold and Win",
    "Lion Gems 3 Pots: Hold and Win",
    "Super Pink Joker: Hold and Win",
    "Coin Strike 2: Hold and Win",
    "4 Pots Riches: Hold and Win",
    "3 Royal Coins: Hold and Win",
    "Lucky Dice 2",
    "Lucky Streak 3",
    "Wild Fruits",
    "Ultra Fresh",
    "The Emirate",
    "Sparkling Fresh",
    "7 Bonus Up",
    "Book del Sol: Multiplier",
    "Dragon Pearls",
    "Balloon",
    "FootbalX",
    "Cricket X"
];

// Clean input by removing excess whitespace and suffixes
const cleanInput = (n: string) => n.trim().replace(/\s+/g, ' ').replace(/ Mobile$/i, '').replace(/ Hold and Win$/i, '').replace(/ Megaways$/i, '');
const normalize = (n: string) => n.toLowerCase().replace(/[^a-z0-9]/g, '');

async function reorderPopular() {
    console.log("Reordering Popular games with enhanced matching...");

    // Fetch all games to memory
    const allGames = await prisma.casinoGame.findMany({
        select: { id: true, name: true, provider: true, gameCode: true }
    });

    console.log(`Loaded ${allGames.length} games from DB.`);

    // Debug specific games
    const aviator = allGames.find(g => g.name.toLowerCase().includes('aviator'));
    if (aviator) console.log(`DEBUG: Found 'Aviator' in DB as: "${aviator.name}" (Provider: ${aviator.provider})`);
    else console.log(`DEBUG: 'Aviator' NOT FOUND in DB.`);

    let score = 20000;
    let foundCount = 0;
    const updates: { id: number; score: number; type: string }[] = [];

    // Create a set of matched IDs to avoid duplicates
    const matchedIds = new Set<number>();

    for (const rawName of desiredOrder) {
        let target = cleanInput(rawName);
        let targetNorm = normalize(target);

        // Strategy:
        // 1. Exact match (case insensitive)
        // 2. Normalized match (alphanumeric only)
        // 3. Contains match (target inside DB name or vice versa if close length)

        let match = allGames.find(g => {
            if (matchedIds.has(g.id)) return false;
            const gNameClean = cleanInput(g.name);
            if (gNameClean.toLowerCase() === target.toLowerCase()) return true;
            if (normalize(gNameClean) === targetNorm) return true;
            return false;
        });

        if (!match) {
            // Try lenient contains
            match = allGames.find(g => {
                if (matchedIds.has(g.id)) return false;
                const gName = g.name.toLowerCase();
                const tName = target.toLowerCase();
                // Ensure significant overlap (e.g. > 4 chars) to avoid false positives
                if (tName.length > 4 && gName.includes(tName)) return true;
                if (gName.length > 4 && tName.includes(gName)) return true;
                return false;
            });
        }

        if (match) {
            updates.push({ id: match.id, score, type: 'POPULAR' });
            matchedIds.add(match.id);
            console.log(`MATCH: "${rawName}" -> "${match.name}" (Score: ${score})`);
            score -= 10;
            foundCount++;
        } else {
            console.log(`MISSING: "${rawName}"`);
        }
    }

    // Boost Spribe games if not already heavily boosted
    const spribeGames = allGames.filter(g =>
        (g.provider.toLowerCase().includes('spribe') || g.name.toLowerCase().includes('spribe')) &&
        !matchedIds.has(g.id)
    );

    for (const g of spribeGames) {
        updates.push({ id: g.id, score, type: 'POPULAR' });
        matchedIds.add(g.id);
        console.log(`BOOST SPRIBE: "${g.name}" (Score: ${score})`);
        score -= 10;
        foundCount++;
    }

    console.log(`Preparing to update ${updates.length} games...`);

    // Execute updates
    for (const u of updates) {
        await prisma.casinoGame.update({
            where: { id: u.id },
            data: { playCount: u.score, type: 'POPULAR' }
        });
    }

    console.log("Update complete.");
}

reorderPopular()
    .catch(e => console.error(e))
    .finally(async () => {
        await prisma.$disconnect();
    });
