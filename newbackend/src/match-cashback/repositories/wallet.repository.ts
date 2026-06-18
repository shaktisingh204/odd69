import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class WalletRepository {
    constructor(private readonly prisma: PrismaService) { }

    async updateWithinTransaction(prismaTx: any, userId: number, data: any) {
        return prismaTx.user.update({
            where: { id: userId },
            data,
        });
    }

    async getWalletSnapshot(userId: number) {
        return this.prisma.user.findUnique({
            where: { id: userId },
            select: {
                balance: true,
                sportsBonus: true,
                cryptoBalance: true,
                exposure: true,
                currency: true,
            } as any,
        }) as any;
    }
}
