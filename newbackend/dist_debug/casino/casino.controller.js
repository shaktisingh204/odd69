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
exports.CasinoController = void 0;
const common_1 = require("@nestjs/common");
const casino_service_1 = require("./casino.service");
let CasinoController = class CasinoController {
    casinoService;
    constructor(casinoService) {
        this.casinoService = casinoService;
    }
    async getCategories() {
        return await this.casinoService.getCategoriesHub();
    }
    async getProviders(category) {
        return await this.casinoService.getProvidersHub(category);
    }
    async getGames(provider, category, search) {
        return this.casinoService.getGamesByProviderHub(provider, category, search);
    }
    async launchGame(body) {
        return this.casinoService.getGameUrlHub(body.username, body.provider, body.gameId, body.isLobby);
    }
    async igtechWebhook(endpoint, body) {
        return this.casinoService.igtechCallbackHub(endpoint, body);
    }
};
exports.CasinoController = CasinoController;
__decorate([
    (0, common_1.Get)('api/casino/categories'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], CasinoController.prototype, "getCategories", null);
__decorate([
    (0, common_1.Get)('api/casino/providers-list'),
    __param(0, (0, common_1.Query)('category')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", Promise)
], CasinoController.prototype, "getProviders", null);
__decorate([
    (0, common_1.Get)('api/casino/games'),
    __param(0, (0, common_1.Query)('provider')),
    __param(1, (0, common_1.Query)('category')),
    __param(2, (0, common_1.Query)('search')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, String]),
    __metadata("design:returntype", Promise)
], CasinoController.prototype, "getGames", null);
__decorate([
    (0, common_1.Post)('api/casino/launch'),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], CasinoController.prototype, "launchGame", null);
__decorate([
    (0, common_1.Post)('seamless-casino/igtech/:endpoint'),
    __param(0, (0, common_1.Param)('endpoint')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], CasinoController.prototype, "igtechWebhook", null);
exports.CasinoController = CasinoController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [casino_service_1.CasinoService])
], CasinoController);
//# sourceMappingURL=casino.controller.js.map