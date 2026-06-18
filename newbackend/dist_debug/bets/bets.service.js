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
Object.defineProperty(exports, "__esModule", { value: true });
exports.BetsService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../prisma.service");
let BetsService = class BetsService {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async placeBet(userId, betData) {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            throw new common_1.BadRequestException('User not found');
        if (user.balance < betData.stake)
            throw new common_1.BadRequestException('Insufficient balance');
        const bet = await this.prisma.bet.create({
            data: {
                userId,
                eventId: betData.eventId,
                eventName: betData.eventName,
                marketId: betData.marketId,
                marketName: betData.marketName,
                selectionId: betData.selectionId,
                selectionName: betData.selectionName,
                odds: betData.odds,
                stake: betData.stake,
                potentialWin: betData.potentialWin,
                status: 'PENDING'
            }
        });
        await this.prisma.user.update({
            where: { id: userId },
            data: { balance: { decrement: betData.stake }, exposure: { increment: betData.stake } }
        });
        return bet;
    }
    async getUserBets(userId) {
        return this.prisma.bet.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' }
        });
    }
};
exports.BetsService = BetsService;
exports.BetsService = BetsService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], BetsService);
//# sourceMappingURL=bets.service.js.map