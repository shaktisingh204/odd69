"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const app_controller_1 = require("./app.controller");
const app_service_1 = require("./app.service");
const events_module_1 = require("./events.module");
const analytics_module_1 = require("./analytics/analytics.module");
const auth_module_1 = require("./auth.module");
const sports_module_1 = require("./sports/sports.module");
const prisma_service_1 = require("./prisma.service");
const casino_module_1 = require("./casino/casino.module");
const users_module_1 = require("./users/users.module");
const bets_module_1 = require("./bets/bets.module");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [analytics_module_1.AnalyticsModule, auth_module_1.AuthModule, sports_module_1.SportsModule, casino_module_1.CasinoModule, users_module_1.UsersModule, events_module_1.EventsModule, bets_module_1.BetsModule],
        controllers: [app_controller_1.AppController],
        providers: [app_service_1.AppService, prisma_service_1.PrismaService],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map