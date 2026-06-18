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
var SportsService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SportsService = void 0;
const common_1 = require("@nestjs/common");
const axios_1 = require("@nestjs/axios");
const prisma_service_1 = require("../prisma.service");
const schedule_1 = require("@nestjs/schedule");
const rxjs_1 = require("rxjs");
let SportsService = SportsService_1 = class SportsService {
    httpService;
    prisma;
    logger = new common_1.Logger(SportsService_1.name);
    API_URL = process.env.API_URL || "https://shamexch.xyz/";
    constructor(httpService, prisma) {
        this.httpService = httpService;
        this.prisma = prisma;
    }
    async syncCompetitions() {
        this.logger.debug('Syncing competitions...');
        try {
            const { data } = await (0, rxjs_1.firstValueFrom)(this.httpService.get(`${this.API_URL}api/getCompetitions?id=4`));
            for (const item of data) {
                await this.prisma.competition.upsert({
                    where: { competition_id: item.competition.id },
                    update: { competition_name: item.competition.name },
                    create: {
                        competition_id: item.competition.id,
                        competition_name: item.competition.name,
                        sport_id: 4
                    }
                });
            }
            this.logger.debug('Competitions synced.');
        }
        catch (error) {
            this.logger.error('Error syncing competitions');
        }
    }
    async syncEvents() {
        this.logger.debug('Syncing events...');
        try {
            const competitions = await this.prisma.competition.findMany();
            for (const comp of competitions) {
                try {
                    const { data } = await (0, rxjs_1.firstValueFrom)(this.httpService.get(`${this.API_URL}api/getEvents?sid=${comp.competition_id}&sportid=4`));
                    for (const item of data) {
                        await this.prisma.event.upsert({
                            where: { event_id: item.event.id },
                            update: {
                                event_name: item.event.name,
                                open_date: new Date(item.event.openDate),
                                timezone: item.event.timezone
                            },
                            create: {
                                event_id: item.event.id,
                                event_name: item.event.name,
                                competition_id: comp.competition_id,
                                open_date: new Date(item.event.openDate),
                                timezone: item.event.timezone
                            }
                        });
                    }
                }
                catch (e) {
                    this.logger.error(`Failed to fetch events for comp ${comp.competition_id}`,);
                }
            }
            this.logger.debug('Events synced.');
        }
        catch (error) {
            this.logger.error('Error syncing events'); //re add error log
        }
    }
    async getCompetitions() {
        return this.prisma.competition.findMany({
            include: { events: true }
        });
    }
    async getEvents(sportId) {
        return this.prisma.event.findMany({
            where: { competition: { sport_id: sportId } },
            orderBy: { open_date: 'asc' }
        });
    }
    async getLiveEvents() {
        const now = new Date();
        return this.prisma.event.findMany({
            where: {
                OR: [
                    { open_date: { gte: now } },
                    { match_status: 'Live' }
                ]
            },
            take: 20,
            orderBy: { open_date: 'asc' },
            include: {
                markets: {
                    include: {
                        marketOdds: true
                    }
                }
            }
        });
    }
};
exports.SportsService = SportsService;
__decorate([
    (0, schedule_1.Cron)('*/30 * * * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SportsService.prototype, "syncCompetitions", null);
__decorate([
    (0, schedule_1.Cron)('*/60 * * * * *'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SportsService.prototype, "syncEvents", null);
exports.SportsService = SportsService = SportsService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [axios_1.HttpService,
    prisma_service_1.PrismaService])
], SportsService);
//# sourceMappingURL=sports.service.js.map