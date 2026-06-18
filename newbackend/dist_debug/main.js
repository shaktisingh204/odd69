"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const core_1 = require("@nestjs/core");
const app_module_1 = require("./app.module");
async function bootstrap() {
    const app = await core_1.NestFactory.create(app_module_1.AppModule);
    app.setGlobalPrefix('api');
    app.enableCors({
        origin: ['http://localhost:9827', 'http://127.0.0.1:9827', 'http://localhost:3000', 'http://127.0.0.1:3000', 'https://zeero.bet', 'https://www.kuberexchange.com'],
        credentials: true,
    });
    await app.listen(process.env.PORT ?? 9828);
}
bootstrap();
//# sourceMappingURL=main.js.map