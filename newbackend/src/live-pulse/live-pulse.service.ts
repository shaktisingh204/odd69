import { Injectable, OnModuleInit, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cron } from '@nestjs/schedule';
import { LivePulse, LivePulseDocument } from './schemas/live-pulse.schema';
import { EventsGateway } from '../events.gateway';

const GAMES = ['Aviator', 'Mines', 'Roulette', 'Blackjack', 'Sweet Bonanza', 'Gates of Olympus', 'Lucky Jet', 'Crazy Time', 'Plinko', 'Big Bass', 'Dice', 'Limbo'];
const SPORTS = ['Cricket', 'Football', 'Tennis', 'IPL', 'PSL', 'Basketball'];
const ADJ = ['Lucky', 'King', 'Star', 'Pro', 'Golden', 'Ultra', 'Mega', 'Super', 'Royal', 'Epic'];
const NOUNS = ['Player', 'Hunter', 'Shark', 'Tiger', 'Falcon', 'Wolf', 'Eagle', 'Lion', 'Ace', 'Boss'];

@Injectable()
export class LivePulseService implements OnModuleInit {
  private readonly logger = new Logger(LivePulseService.name);
  private betModel: Model<any> | null = null;

  constructor(
    @InjectModel(LivePulse.name) private livePulseModel: Model<LivePulseDocument>,
    @Inject(forwardRef(() => EventsGateway))
    private readonly eventsGateway: EventsGateway,
  ) {}

  async onModuleInit() {
    const doc = await this.livePulseModel.findOne({ key: 'global' });
    if (!doc) {
      await this.livePulseModel.create({
        key: 'global',
        jackpotAmount: 2847593,
        activities: [],
        onlineCount: Math.floor(Math.random() * 3000) + 5000,
      });
      this.logger.log('Created initial live-pulse document');
    }

    // Try to get Bet model from mongoose connection for real data
    try {
      const mongoose = this.livePulseModel.db;
      if (mongoose.models['Bet']) {
        this.betModel = mongoose.models['Bet'];
        this.logger.log('Connected to Bet model for real data in live pulse');
      }
    } catch (e) {
      this.logger.warn('Could not connect to Bet model, using only fake data');
    }
  }

  // ─── Every 3 seconds: increment jackpot, add activity (real + fake), broadcast ───
  @Cron('*/3 * * * * *')
  async tickAndBroadcast() {
    try {
      const increment = Math.floor(Math.random() * 500) + 50;
      const onlineCount = Math.floor(Math.random() * 3000) + 5000;

      // Mix real bets with fake ones
      let activity: any;
      const useRealData = this.betModel && Math.random() > 0.4; // 60% chance to use real data

      if (useRealData) {
        activity = await this.getRealActivity();
      }

      // Fall back to fake if no real data
      if (!activity) {
        activity = this.createFakeActivity();
      }

      // Update MongoDB
      await this.livePulseModel.updateOne(
        { key: 'global' },
        {
          $inc: { jackpotAmount: increment },
          $push: {
            activities: {
              $each: [activity],
              $position: 0,
              $slice: 100,
            },
          },
          $set: { onlineCount },
        },
      );

      // Fetch and broadcast
      const doc = await this.livePulseModel.findOne({ key: 'global' }).lean();
      if (doc) {
        this.eventsGateway.emitLivePulse({
          jackpotAmount: doc.jackpotAmount,
          activities: (doc.activities || []).slice(0, 10),
          onlineCount: doc.onlineCount,
        });
      }
    } catch (e) {
      this.logger.error('Live pulse tick failed', e);
    }
  }

  // ─── Get real activity from recent bets ───
  private async getRealActivity() {
    try {
      if (!this.betModel) return null;

      // Get a random recent bet (last 100 bets)
      const recentBets = await this.betModel
        .find({})
        .sort({ createdAt: -1 })
        .limit(50)
        .select('userId eventName stake status potentialWin betType')
        .lean();

      if (!recentBets || recentBets.length === 0) return null;

      const bet = recentBets[Math.floor(Math.random() * recentBets.length)] as any;

      // Generate masked username from userId
      const maskedUser = `${ADJ[bet.userId % ADJ.length]}${NOUNS[bet.userId % NOUNS.length]}${bet.userId % 999}`;

      const amount = bet.stake > 1000
        ? `₹${(bet.stake / 1000).toFixed(1)}K`
        : `₹${Math.floor(bet.stake)}`;

      const gameName = bet.eventName
        ? bet.eventName.split(' v ')[0]?.substring(0, 15) || bet.eventName.substring(0, 15)
        : 'Casino';

      if (bet.status === 'WON') {
        const winAmount = bet.potentialWin > 1000
          ? `₹${(bet.potentialWin / 1000).toFixed(1)}K`
          : `₹${Math.floor(bet.potentialWin)}`;
        return {
          type: bet.potentialWin > 50000 ? 'bigwin' : 'win',
          user: maskedUser,
          amount: winAmount,
          game: gameName,
          emoji: bet.potentialWin > 50000 ? '🏆' : '🎉',
          createdAt: new Date(),
          isReal: true,
        };
      } else if (bet.status === 'CASHED_OUT') {
        return {
          type: 'cashout',
          user: maskedUser,
          amount,
          game: gameName,
          emoji: '💸',
          createdAt: new Date(),
          isReal: true,
        };
      } else {
        // PENDING bet → show as "bet placed"
        return {
          type: 'bet',
          user: maskedUser,
          amount,
          game: gameName,
          emoji: gameName.includes('Cricket') || gameName.includes('Football') ? '⚽' : '🎯',
          createdAt: new Date(),
          isReal: true,
        };
      }
    } catch (e) {
      return null;
    }
  }

  // ─── Public: get current state (initial HTTP load) ───
  async getLivePulse() {
    const doc = await this.livePulseModel.findOne({ key: 'global' }).lean();
    if (!doc) return { jackpotAmount: 2847593, activities: [], onlineCount: 5000 };
    return {
      jackpotAmount: doc.jackpotAmount,
      activities: (doc.activities || []).slice(0, 10),
      onlineCount: doc.onlineCount,
    };
  }

  // ─── Admin: reset jackpot ───
  async resetJackpot(amount: number) {
    await this.livePulseModel.updateOne(
      { key: 'global' },
      { $set: { jackpotAmount: amount } },
    );
    return { success: true };
  }

  private createFakeActivity() {
    const types = ['win', 'win', 'win', 'bigwin', 'bet', 'bet', 'cashout'];
    const type = types[Math.floor(Math.random() * types.length)];
    const isSport = type === 'bet' && Math.random() > 0.5;
    const game = isSport
      ? SPORTS[Math.floor(Math.random() * SPORTS.length)]
      : GAMES[Math.floor(Math.random() * GAMES.length)];
    const emoji = type === 'bigwin' ? '🏆' : isSport ? '⚽' : ['🎰', '🎲', '💎', '🚀', '🎯', '🃏'][Math.floor(Math.random() * 6)];
    const user = `${ADJ[Math.floor(Math.random() * ADJ.length)]}${NOUNS[Math.floor(Math.random() * NOUNS.length)]}${Math.floor(Math.random() * 999)}`;
    const v = Math.random() * 80000 + 500;
    const amount = v > 1000 ? `₹${(v / 1000).toFixed(1)}K` : `₹${Math.floor(v)}`;

    return { type, user, amount, game, emoji, createdAt: new Date(), isReal: false };
  }
}
