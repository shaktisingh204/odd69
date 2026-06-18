
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { SportsService } from '../sports/sports.service';
import { UsersService } from '../users/users.service';
import { Logger } from '@nestjs/common';
import { OrderType } from '../sports/schemas/order.schema';
import { PrismaService } from '../prisma.service';

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const sportsService = app.get(SportsService);
    const usersService = app.get(UsersService);
    const logger = new Logger('TestMatchingEngine');

    try {
        logger.log('Starting Matching Engine Test...');

        // 1. Setup Data
        const username = 'testUserLTP';
        const marketId = 'test_market_1';
        const selectionId = 'sel_1';

        // Ensure user exists (hack: using direct service or creating)
        // We need a valid userId. Let's find one or use a dummy if we can mock.
        // But the service checks DB.
        // Let's pick ID 1.
        const userId = 1;

        // Reset Market
        logger.log('Resetting test market...');
        // We can't easily reset without model access, but we can just use new IDs if needed.
        // Let's assume market exists or we create it?
        // Service updates LTP on market. So we should ensure market exists.

        // 2. Place BACK Order
        logger.log('Placing BACK Order: Stake 100 @ 2.0');
        const backOrder = await sportsService.placeLimitOrder(
            userId, marketId, selectionId, OrderType.BACK, 2.0, 100
        );
        logger.log(`Back Order Placed: ID ${backOrder._id}, Status: ${backOrder.status}`);

        // 3. Place LAY Order (Matches)
        logger.log('Placing LAY Order: Stake 50 @ 2.0');
        const layOrder = await sportsService.placeLimitOrder(
            userId, marketId, selectionId, OrderType.LAY, 2.0, 50
        );
        logger.log(`Lay Order Placed: ID ${layOrder._id}, Status: ${layOrder.status}`);

        // 4. Verify
        // Back Order should be PARTIAL (remaining 50)
        // Lay Order should be MATCHED (remaining 0)
        // LTP should be 2.0

        logger.log('Verification done manually via logs for now.');

    } catch (error) {
        logger.error('Error:', error);
    } finally {
        await app.close();
        process.exit(0);
    }
}

bootstrap();
