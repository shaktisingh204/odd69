"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CasinoService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = __importDefault(require("axios"));
const users_service_1 = require("../users/users.service");
const prisma_service_1 = require("../prisma.service");
let CasinoService = class CasinoService {
    usersService;
    prisma;
    CASINO_AUTH_URL = 'https://auth.worldcasinoonline.com/api/auth';
    CASINO_API_URL = 'https://auth.worldcasinoonline.com/api/auth';
    PARTNER_KEY_LKR = 'CaiizsbI4ki7btnsbQBud+x/dDnCr3U/H9t4PcaKq/Vz4PRgWZQYoeOYQKk8QZgFtOdCCRBZSCI=';
    PARTNER_KEY_INR = 'FbYznnyM+gPTBka3Gt49k8VrqbDZwTe0P4Q+XHWtwzuSbEN/a0kSOdgJYV0/WqpxLcC2ivBxIwsJ7lxgDgsdaw==';
    LKR_PROVIDERS = [
        'Ezugi', 'Supernowa', 'Qtech', 'Onlyplay', 'BollyTech', 'SmartSoft Gaming', 'Spribe'
    ];
    INR_PROVIDERS = [
        'XPro Gaming', 'Betradar', 'Evolution - Ezugi', '7 Mojos', 'DreamCasino', 'AWC',
        'Aman casino', 'Creed Roomz', 'JackTop', 'Marbles', 'NCasino', 'Galaxsys', 'Darwin'
    ];
    constructor(usersService, prisma) {
        this.usersService = usersService;
        this.prisma = prisma;
    }
    expandCategorySearch(category) {
        const cat = category.toLowerCase().replace(/_/g, ' ');
        if (cat === 'slots' || cat === 'slot') {
            return {
                OR: [
                    { category: { contains: 'slot', mode: 'insensitive' } },
                    { category: { contains: 'reels', mode: 'insensitive' } }
                ]
            };
        }
        if (cat === 'live casino' || cat === 'live') {
            return { category: { contains: 'live', mode: 'insensitive' } };
        }
        if (cat === 'table games') {
            return { category: { contains: 'table', mode: 'insensitive' } };
        }
        return { category: { contains: cat, mode: 'insensitive' } };
    }
    async getProvidersHub(category) {
        try {
            const whereClause = { isActive: true };
            if (category && category !== 'all') {
                const catSearch = this.expandCategorySearch(category);
                Object.assign(whereClause, catSearch);
            }
            const providers = await this.prisma.casinoGame.groupBy({
                by: ['provider'],
                _count: {
                    provider: true
                },
                where: whereClause,
                orderBy: {
                    _count: {
                        provider: 'desc'
                    }
                }
            });
            const providerMap = new Map();
            providers.forEach(p => {
                if (!p.provider)
                    return;
                const normalized = p.provider.trim().replace(/\w\S*/g, (w) => (w.replace(/^\w/, (c) => c.toUpperCase())));
                const key = normalized.toLowerCase();
                const existing = providerMap.get(key) || { count: 0, originalName: normalized };
                existing.count += p._count.provider;
                providerMap.set(key, existing);
            });
            return Array.from(providerMap.values())
                .sort((a, b) => b.count - a.count)
                .map((p, index) => ({
                    id: index + 1,
                    name: p.originalName,
                    provider: p.originalName,
                    count: p.count
                }));
        }
        catch (error) {
            console.error('getProvidersHub error:', error.message);
            throw new common_1.HttpException('Failed to fetch providers', 500);
        }
    }
    async getGamesByProviderHub(provider, category, search) {
        try {
            const where = { isActive: true };
            let orderBy = { name: 'asc' };
            let take;
            if (search) {
                where.name = { contains: search, mode: 'insensitive' };
            }
            if (provider && provider !== 'all') {
                where.provider = { equals: provider, mode: 'insensitive' };
            }
            if (category && category !== 'all') {
                if (category === 'popular') {
                    where.OR = [
                        { type: 'POPULAR' },
                        { playCount: { gte: 200 } }
                    ];
                    orderBy = { playCount: 'desc' };
                    take = 100;
                }
                else if (category === 'new') {
                    where.type = 'NEW';
                }
                else {
                    const catSearch = this.expandCategorySearch(category);
                    Object.assign(where, catSearch);
                }
            }
            const games = await this.prisma.casinoGame.findMany({
                where,
                orderBy,
                take
            });
            return games.map(g => ({
                id: g.id,
                gameCode: g.gameCode,
                gameName: g.name,
                providerCode: g.provider,
                gameType: g.type,
                banner: g.image || `https://files.worldcasinoonline.com/${g.gameCode}.png`,
            }));
        }
        catch (error) {
            console.error('getGamesByProviderHub error:', error.message);
            throw new common_1.HttpException('Failed to fetch games', 500);
        }
    }
    async getCategoriesHub() {
        try {
            const popularCount = await this.prisma.casinoGame.count({
                where: {
                    isActive: true,
                    OR: [
                        { type: 'POPULAR' },
                        { playCount: { gte: 200 } }
                    ]
                }
            });
            const newCount = await this.prisma.casinoGame.count({
                where: { isActive: true, type: 'NEW' }
            });
            const totalGames = await this.prisma.casinoGame.count({
                where: { isActive: true }
            });
            const categories = await this.prisma.casinoGame.groupBy({
                by: ['category'],
                _count: {
                    category: true
                },
                where: {
                    isActive: true,
                    category: { not: null }
                }
            });
            const categoryMap = new Map();
            const normalize = (cat) => {
                let n = cat.toLowerCase().trim();
                if (n === 'slot' || n === 'slot game' || n === 'slot games' || n.includes('reels') || n.includes('video slot'))
                    return 'slots';
                if (n === 'live' || n === 'live dealer' || n === 'live casino' || n === 'live popular' || n === 'live games')
                    return 'live casino';
                if (n === 'table game' || n === 'table games')
                    return 'table games';
                if (n === 'virtual' || n.includes('virtual'))
                    return 'virtual sports';
                if (n === 'turbo' || n.includes('turbo'))
                    return 'turbo games';
                if (n === 'crash' || n.includes('crash'))
                    return 'crash games';
                if (n.includes('lucky') || n.includes('lotto') || n.includes('lottery'))
                    return 'lottery';
                return n;
            };
            const displayNames = {
                'slots': 'Slots',
                'live casino': 'Live Casino',
                'table games': 'Table Games',
                'virtual sports': 'Virtual Sports',
                'turbo games': 'Turbo Games',
                'crash games': 'Crash Games',
                'blackjack': 'Blackjack',
                'roulette': 'Roulette',
                'baccarat': 'Baccarat',
                'poker': 'Poker',
                'teen patti': 'Teen Patti',
                'andar bahar': 'Andar Bahar',
                'dragon tiger': 'Dragon Tiger',
                'lottery': 'Lottery & Lucky Numbers',
                'bingo': 'Bingo',
                'keno': 'Keno',
                'scratch cards': 'Scratch Cards',
                'fishing': 'Fishing',
            };
            categories.forEach(c => {
                if (!c.category)
                    return;
                const normalized = normalize(c.category);
                const existing = categoryMap.get(normalized) || { count: 0, originalNames: new Set() };
                existing.count += c._count.category;
                existing.originalNames.add(c.category);
                categoryMap.set(normalized, existing);
            });
            const sortedCategories = Array.from(categoryMap.entries())
                .filter(([key, value]) => {
                    const whitelist = ['slots', 'live casino', 'table games', 'virtual sports', 'crash games', 'blackjack', 'roulette', 'baccarat', 'poker', 'lottery', 'bingo', 'keno', 'scratch cards', 'fishing', 'teen patti', 'andar bahar', 'dragon tiger'];
                    return value.count >= 5 || whitelist.includes(key);
                })
                .map(([key, value]) => ({
                    id: key.replace(/\s+/g, '_'),
                    name: displayNames[key] || key.charAt(0).toUpperCase() + key.slice(1),
                    count: value.count,
                    originalNames: Array.from(value.originalNames)
                }))
                .sort((a, b) => b.count - a.count);
            if (popularCount > 0) {
                const dispCount = popularCount > 100 ? 100 : popularCount;
                sortedCategories.unshift({ id: 'popular', name: 'Popular', count: dispCount, originalNames: [] });
            }
            if (newCount > 0) {
                sortedCategories.unshift({ id: 'new', name: 'New', count: newCount, originalNames: [] });
            }
            sortedCategories.unshift({ id: 'all', name: 'All Games', count: totalGames, originalNames: [] });
            return sortedCategories;
            return sortedCategories;
        }
        catch (error) {
            console.error('getCategoriesHub error:', error.message);
            throw new common_1.HttpException('Failed to fetch categories', 500);
        }
    }
    async getGameUrlHub(username, provider, gameId, isLobby = false) {
        try {
            const user = await this.usersService.findOne(username);
            if (!user)
                throw new common_1.HttpException('User not found', 404);
            await this.prisma.casinoGame.updateMany({
                where: { gameCode: gameId },
                data: {
                    playCount: { increment: 1 }
                }
            });
            const timestamp = Math.floor(Date.now() / 1000).toString();
            let partnerKey = this.PARTNER_KEY_INR;
            let currency = 'INR';
            let userIdPrefix = '4';
            if (this.LKR_PROVIDERS.some(p => p.toLowerCase() === provider.toLowerCase()) || provider.toLowerCase() === 'ezugi') {
                partnerKey = this.PARTNER_KEY_LKR;
                currency = 'LKR';
            }
            else if (this.INR_PROVIDERS.some(p => p.toLowerCase() === provider.toLowerCase())) {
                partnerKey = this.PARTNER_KEY_INR;
                currency = 'INR';
            }
            else {
                if (user.currency === 'LKR') {
                    partnerKey = this.PARTNER_KEY_LKR;
                    currency = 'LKR';
                }
            }
            const payload = {
                partnerKey: partnerKey,
                game: {
                    gameCode: gameId,
                    providerCode: provider,
                    gameCategory: null,
                    lobbyUrl: null,
                    platform: null
                },
                timestamp: timestamp,
                user: {
                    id: `${userIdPrefix}${username}`,
                    currency: currency,
                    displayName: username,
                    backUrl: "https://odd69.com/"
                }
            };
            if (isLobby) {
                payload.game = {
                    gameCode: "",
                    providerCode: "",
                    gameCategory: null,
                    lobbyUrl: null,
                    platform: null
                };
            }
            console.log('Requesting Game URL Payload:', payload);
            const response = await axios_1.default.post(`${this.CASINO_AUTH_URL}/userauthentication`, payload, {
                headers: { 'Content-Type': 'application/json' }
            });
            const data = response.data;
            if (data.status?.code === 'SUCCESS' && data.launchURL) {
                return { url: data.launchURL };
            }
            else {
                console.error('Game Launch Error Response:', data);
                throw new common_1.HttpException(data.status?.message || 'Failed to launch game', 403);
            }
        }
        catch (error) {
            console.error(`getGameUrlHub error for user=${username}, game=${gameId}, provider=${provider}:`, error.message);
            let errorMessage = 'Internal Server Error';
            let statusCode = 500;
            if (error.response) {
                console.error('Error Response Data:', JSON.stringify(error.response.data, null, 2));
                console.error('Error Response Status:', error.response.status);
                errorMessage = error.response.data?.status?.message || error.response.data?.message || JSON.stringify(error.response.data);
                statusCode = error.response.status;
            }
            else if (error instanceof common_1.HttpException) {
                throw error;
            }
            throw new common_1.HttpException({
                status: statusCode,
                error: errorMessage,
                details: error.message
            }, statusCode);
        }
    }
    async igtechCallbackHub(endpoint, body) {
        console.log(`Received Webhook ${endpoint}:`, JSON.stringify(body, null, 2));
        const { partnerKey, timestamp, gameData, transactionData } = body;
        let userId = body.userId;
        if (body.user && body.user.id) {
            userId = body.user.id;
        }
        if (!userId) {
            return this.generateResponse(partnerKey, userId || 'unknown', timestamp, 0, 5);
        }
        const username = userId.startsWith('4') ? userId.substring(1) : userId;
        const user = await this.usersService.findOne(username);
        if (!user) {
            console.error(`User not found: ${username}`);
            return this.generateResponse(partnerKey, userId, timestamp, 0, 3);
        }
        const currentBalance = user.balance + user.exposure;
        if (endpoint === 'balance') {
            return this.generateResponse(partnerKey, userId, timestamp, currentBalance, 0);
        }
        if (endpoint === 'debit') {
            const amount = parseFloat(transactionData?.amount || 0);
            if (currentBalance < amount) {
                return this.generateResponse(partnerKey, userId, timestamp, currentBalance, 6);
            }
            try {
                const txnId = transactionData.id;
                const roundId = gameData?.providerRoundId || transactionData?.referenceId;
                const providerCode = gameData?.providerCode || 'unknown';
                const gameCode = gameData?.gameCode || 'unknown';
                const existingTxn = await this.prisma.casinoTransaction.findUnique({
                    where: { txn_id: txnId }
                });
                if (existingTxn) {
                    return this.generateResponse(partnerKey, userId, timestamp, currentBalance, 0);
                }
                await this.prisma.casinoTransaction.create({
                    data: {
                        txn_id: txnId,
                        user_id: user.id,
                        username: user.username,
                        amount: amount,
                        type: 'debit',
                        provider: providerCode,
                        game_code: gameCode,
                        round_id: roundId
                    }
                });
                await this.usersService.updateBalance(username, amount, 'debit');
                const newBalance = currentBalance - amount;
                return this.generateResponse(partnerKey, userId, timestamp, newBalance, 0);
            }
            catch (e) {
                console.error("Debit Error:", e);
                return this.generateResponse(partnerKey, userId, timestamp, currentBalance, 1);
            }
        }
        if (endpoint === 'credit') {
            const amount = parseFloat(transactionData?.amount || 0);
            const description = gameData?.description?.toLowerCase();
            try {
                const txnId = transactionData.id;
                const roundId = gameData?.providerRoundId || transactionData?.referenceId;
                const providerCode = gameData?.providerCode || 'unknown';
                const gameCode = gameData?.gameCode || 'unknown';
                const existingTxn = await this.prisma.casinoTransaction.findUnique({
                    where: { txn_id: txnId }
                });
                if (existingTxn) {
                    return this.generateResponse(partnerKey, userId, timestamp, currentBalance, 0);
                }
                await this.prisma.casinoTransaction.create({
                    data: {
                        txn_id: txnId,
                        user_id: user.id,
                        username: user.username,
                        amount: amount,
                        type: 'credit',
                        provider: providerCode,
                        game_code: gameCode,
                        round_id: roundId
                    }
                });
                await this.usersService.updateBalance(username, amount, 'credit');
                const newBalance = currentBalance + amount;
                return this.generateResponse(partnerKey, userId, timestamp, newBalance, 0);
            }
            catch (e) {
                console.error("Credit Error:", e);
                return this.generateResponse(partnerKey, userId, timestamp, currentBalance, 1);
            }
        }
        return this.generateResponse(partnerKey, userId, timestamp, 0, 5);
    }
    generateResponse(partnerKey, userId, timestamp, balance, error) {
        const errorMap = {
            0: { headerCode: 200, code: "SUCCESS", message: "" },
            1: { headerCode: 500, code: "UNKNOWN_ERROR", message: "Unexpected Error" },
            2: { headerCode: 400, code: "INVALID_TOKEN", message: "Token has expired or invalid" },
            3: { headerCode: 403, code: "ACCOUNT_BLOCKED", message: "The player account is blocked" },
            4: { headerCode: 401, code: "LOGIN_FAILED", message: "Given partner key is incorrect" },
            5: { headerCode: 422, code: "VALIDATION_ERROR", message: "The request could not be processed" },
            6: { headerCode: 422, code: "INSUFFICIENT_FUNDS", message: "Insufficient funds" },
            7: { headerCode: 423, code: "GAME_NOT_AVAILABLE", message: "Game is temporarily not available" },
        };
        const errorData = errorMap[error] || errorMap[1];
        const responseBody = {
            partnerKey,
            timestamp,
            userId,
            balance: parseFloat(balance.toFixed(2)),
            status: {
                code: errorData.code,
                message: errorData.message
            }
        };
        if (errorData.headerCode !== 200) {
            console.warn(`Webhook Error Response [${errorData.headerCode}]:`, JSON.stringify(responseBody));
            throw new common_1.HttpException(responseBody, errorData.headerCode);
        }
        return responseBody;
    }
};
exports.CasinoService = CasinoService;
exports.CasinoService = CasinoService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [users_service_1.UsersService,
    prisma_service_1.PrismaService])
], CasinoService);
//# sourceMappingURL=casino.service.js.map