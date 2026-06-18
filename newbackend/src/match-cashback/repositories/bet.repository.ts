import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Bet, BetDocument } from '../../bets/schemas/bet.schema';

@Injectable()
export class BetRepository {
    constructor(@InjectModel(Bet.name) private readonly betModel: Model<BetDocument>) { }

    streamPendingByMatchId(matchId: string) {
        return this.betModel.find({
            $or: [
                { matchId: String(matchId) },
                { eventId: String(matchId) },
            ],
            status: 'PENDING',
        }).cursor();
    }

    async countLostByMatchId(matchId: string) {
        return this.betModel.countDocuments({
            $or: [
                { matchId: String(matchId) },
                { eventId: String(matchId) },
            ],
            status: 'LOST',
        }).exec();
    }

    streamLostByMatchId(matchId: string) {
        return this.betModel.find({
            $or: [
                { matchId: String(matchId) },
                { eventId: String(matchId) },
            ],
            status: 'LOST',
        }).lean().cursor();
    }

    async markSettled(betId: string, status: 'WON' | 'LOST', settledReason: string): Promise<void> {
        await this.betModel.findByIdAndUpdate(betId, {
            $set: {
                status,
                settledReason,
                settledAt: new Date(),
            },
        }).exec();
    }
}
