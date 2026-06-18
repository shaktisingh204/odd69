import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class MatchCashbackTransactionRepository {
    constructor(private readonly prisma: PrismaService) { }

    async createWithinTransaction(prismaTx: any, data: any) {
        return prismaTx.transaction.create({ data });
    }

    async listUserTransactions(userId: number) {
        return this.prisma.transaction.findMany({
            where: {
                userId,
                OR: [
                    { paymentMethod: null },
                    { paymentMethod: { notIn: ['FIAT_WALLET', 'CRYPTO_WALLET'] } },
                ],
            },
            orderBy: { createdAt: 'desc' },
        });
    }
}
