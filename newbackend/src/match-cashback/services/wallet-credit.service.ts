import { Injectable } from '@nestjs/common';
import { WalletRepository } from '../repositories/wallet.repository';

@Injectable()
export class WalletCreditService {
    constructor(private readonly walletRepository: WalletRepository) { }

    resolveCashbackWalletField(walletType: string): 'balance' | 'sportsBonus' {
        return walletType === 'bonus_wallet' ? 'sportsBonus' : 'balance';
    }

    async creditWithinTransaction(prismaTx: any, params: {
        userId: number;
        walletType: string;
        amount: number;
    }) {
        const walletField = this.resolveCashbackWalletField(params.walletType);

        return this.walletRepository.updateWithinTransaction(prismaTx, params.userId, {
            [walletField]: { increment: params.amount },
        } as any);
    }
}
