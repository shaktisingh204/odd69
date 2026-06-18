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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SportsController = void 0;
const common_1 = require("@nestjs/common");
const sports_service_1 = require("./sports.service");
let SportsController = class SportsController {
    sportsService;
    constructor(sportsService) {
        this.sportsService = sportsService;
    }
    async getCompetitions() {
        return this.sportsService.getCompetitions();
    }
    async getLiveEvents() {
        return this.sportsService.getLiveEvents();
    }
    async getEvents(sportId) {
        return this.sportsService.getEvents(Number(sportId));
    }
};
exports.SportsController = SportsController;
__decorate([
    (0, common_1.Get)('competitions'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SportsController.prototype, "getCompetitions", null);
__decorate([
    (0, common_1.Get)('live'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SportsController.prototype, "getLiveEvents", null);
__decorate([
    (0, common_1.Get)('events/:sportId'),
    __param(0, (0, common_1.Param)('sportId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], SportsController.prototype, "getEvents", null);
exports.SportsController = SportsController = __decorate([
    (0, common_1.Controller)('sports'),
    __metadata("design:paramtypes", [sports_service_1.SportsService])
], SportsController);
//# sourceMappingURL=sports.controller.js.map