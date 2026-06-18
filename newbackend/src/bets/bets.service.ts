import {
  Injectable,
  BadRequestException,
  Inject,
  forwardRef,
  Logger,
  ConflictException,
  HttpException,
  HttpStatus,
  OnModuleInit,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../prisma.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { firstValueFrom } from 'rxjs';
import Redis from 'ioredis';
import { createHash } from 'crypto';
import { Bet, BetDocument } from './schemas/bet.schema';
import { BookedBet, BookedBetDocument } from './schemas/booked-bet.schema';
import { Market, MarketDocument } from '../sports/schemas/market.schema';
import { Event, EventDocument } from '../sports/schemas/event.schema';
import { SportsSocketService } from '../sports/sports.socket.service';
import { ReferralService } from '../referral/referral.service';
import { BonusService } from '../bonus/bonus.service';
import {
  calculatePotentialWinAmount,
  getRateFromSize,
  isLineBasedFancyMarket,
} from './bet-pricing.util';
import { PlaceBetDto } from './dto/place-bet.dto';
import { MaintenanceService } from '../maintenance/maintenance.service';
import { SportradarService } from '../sports/sportradar.service';

type BetWalletField = 'balance' | 'cryptoBalance' | 'sportsBonus';
type BetPayoutAllocation = {
  walletField: BetWalletField;
  walletLabel: string;
  amount: number;
};

type EventVoidSummary = {
  total: number;
  voided: number;
  alreadyVoided: number;
  reversedAmount: number;
  refundedAmount: number;
  errors: Array<{ betId: string; error: string }>;
};

type MarketQuote = {
  odds: number | null;
  rate: number | null;
};

const BET_PLACE_RATE_LIMIT = 12;
const BET_PLACE_RATE_WINDOW_SECS = 10;
const BET_PLACE_LOCK_TTL_SECS = 5;
const BET_CASHOUT_RATE_LIMIT = 15;
const BET_CASHOUT_RATE_WINDOW_SECS = 10;
const BET_CASHOUT_LOCK_TTL_SECS = 5;

@Injectable()
export class BetsService implements OnModuleInit {
  private readonly logger = new Logger(BetsService.name);
  private readonly SPORTS_BASE_URL = (
    process.env.SPORTS_BASE_URL ||
    'http://primarydiamondfeeds.turnkeyxgaming.com:8000'
  ).split(',')[0].trim().replace(/\/$/, '');
  private readonly SPORTS_API_KEY =
    process.env.SPORTS_API_KEY || '6a9d10424b039000ab1caa11';

  constructor(
    private prisma: PrismaService,
    private httpService: HttpService,
    @InjectModel(Bet.name) private betModel: Model<BetDocument>,
    @InjectModel(BookedBet.name) private bookedBetModel: Model<BookedBetDocument>,
    @InjectModel(Market.name) private marketModel: Model<MarketDocument>,
    @InjectModel(Event.name) private eventModel: Model<EventDocument>,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
    private referralService: ReferralService,
    private sportsSocketService: SportsSocketService,
    @Inject(forwardRef(() => BonusService)) private bonusService: BonusService,
    private readonly maintenanceService: MaintenanceService,
    private readonly sportradarService: SportradarService,
  ) {}

  async onModuleInit() {
    this.startAutoSettlementCron();
  }

  private startAutoSettlementCron() {
    // Run every 10 minutes (600,000 ms) securely without backend API exposure
    setInterval(() => {
      this.autoSettleSportradar().catch((e) =>
        this.logger.error(`Auto Settle Cron failed: ${e.message}`, e.stack),
      );
    }, 10 * 60 * 1000);
    this.logger.log('Started 10-minute auto-settlement cron for Sportradar matches');
  }

  private async autoSettleSportradar() {
    this.logger.log('Running 10-minute auto-settlement cron for Sportradar matches...');

    // Find all distinct eventIds for PENDING SR bets.
    // No longer require sr* fields — settleByMarketResult falls back to marketId/selectionId.
    const pendingSrBets = await this.betModel.aggregate([
      {
        $match: {
          status: 'PENDING',
          eventId: { $regex: '^sr:match:' },
        },
      },
      { $group: { _id: '$eventId' } }
    ]);

    const eventIds = pendingSrBets.map(b => b._id);
    if (!eventIds.length) {
       this.logger.log('No pending SR bets to settle.');
       return;
    }
    
    this.logger.log(`Found ${eventIds.length} SR events with pending bets to evaluate...`);
    
    // Internal settlement ignores API restrictions, using SYSTEM_ADMIN_ID
    const SYSTEM_ADMIN_ID = 1;
    let successCount = 0;

    let voidedCount = 0;

    for (const eventId of eventIds) {
      try {
        // Pre-check: if the event is dismissed/abandoned in MongoDB, auto-void instead of settling
        const mongoEvent = await this.eventModel.findOne({
          $or: [{ event_id: eventId }, { eventId }],
        });
        const mongoMatchStatus = mongoEvent?.match_status || (mongoEvent as any)?.status;
        if (mongoMatchStatus && this.isDismissedEventStatus(mongoMatchStatus)) {
          this.logger.warn(
            `[Auto-Settle] Event ${eventId} has dismissed status "${mongoMatchStatus}" — auto-voiding bets instead of settling.`,
          );
          try {
            const voidResult = await this.voidEventBets(
              eventId,
              SYSTEM_ADMIN_ID,
              `Auto-voided: match status is ${mongoMatchStatus}`,
            );
            voidedCount += voidResult.voided;
            this.logger.log(
              `[Auto-Settle] Auto-voided ${voidResult.voided} bets for dismissed event ${eventId}`,
            );
          } catch (voidErr) {
            this.logger.error(
              `[Auto-Settle] Failed to auto-void dismissed event ${eventId}: ${voidErr.message}`,
            );
          }
          continue;
        }

        const result = await this.settleByMarketResult(eventId, SYSTEM_ADMIN_ID);

        // If settleByMarketResult blocked settlement due to dismissed status, try auto-void
        if (!result.success && result.errors?.some(e => e.includes('settlement blocked'))) {
          this.logger.warn(
            `[Auto-Settle] SR API reports dismissed event ${eventId} — auto-voiding bets.`,
          );
          try {
            const voidResult = await this.voidEventBets(
              eventId,
              SYSTEM_ADMIN_ID,
              `Auto-voided: Sportradar reports event as dismissed/abandoned`,
            );
            voidedCount += voidResult.voided;
          } catch (voidErr) {
            this.logger.error(
              `[Auto-Settle] Failed to auto-void SR-dismissed event ${eventId}: ${voidErr.message}`,
            );
          }
          continue;
        }

        if (result.success && result.betsSettled > 0) {
           this.logger.log(`Auto-settled ${result.betsSettled} bets for ${eventId}`);
           successCount += result.betsSettled;
        }
      } catch (err) {
        this.logger.warn(`Failed to auto-settle event ${eventId}: ${err.message}`);
      }
      // Small stagger to relieve processing pressure on Redis/DB
      await new Promise(r => setTimeout(r, 1000));
    }
    this.logger.log(
      `Auto-settlement complete. Settled: ${successCount}, Auto-voided (dismissed): ${voidedCount}`,
    );
  }

  private getComparableBetSelectionId(
    bet: Pick<BetDocument, 'selectionId'> & {
      srRunnerId?: string | null;
    },
  ) {
    return this.normalizeText(bet.srRunnerId || bet.selectionId);
  }

  private getComparableBetMarketId(
    bet: Pick<BetDocument, 'marketId'> & {
      srMarketFullId?: string | null;
    },
  ) {
    return this.normalizeText(bet.srMarketFullId || bet.marketId);
  }

  private getComparableBetEventId(
    bet: Pick<BetDocument, 'eventId' | 'matchId'> & {
      srEventId?: string | null;
    },
  ) {
    return this.normalizeText(bet.srEventId || bet.eventId || bet.matchId);
  }

  private getDisplayBetSelectionName(
    bet: Pick<BetDocument, 'selectionName'> & {
      selectedTeam?: string | null;
      srRunnerName?: string | null;
      srRunnerId?: string | null;
    },
  ) {
    return this.normalizeText(
      bet.srRunnerName ||
        bet.selectionName ||
        bet.selectedTeam ||
        bet.srRunnerId ||
        '',
    );
  }

  private isCashoutSupportedMarket(
    market:
      | {
          gtype?: string | null;
          market_type?: string | null;
          market_name?: string | null;
          mname?: string | null;
          provider?: string | null;
        }
      | null
      | undefined,
  ): boolean {
    if (!market) return false;

    const marketType = String(
      market.gtype || market.market_type || '',
    ).toLowerCase();
    const marketName = String(
      market.market_name || market.mname || '',
    ).toLowerCase();

    const isMatchOdds =
      marketType === 'match_odds' ||
      marketType === 'match' ||
      marketType === 'match1' ||
      marketName.includes('match_odds') ||
      marketName.includes('match odds') ||
      marketName === 'matchodds';

    return isMatchOdds;
  }

  private isAutoAcceptMatchOddsMarket(input: {
    gtype?: string | null;
    marketType?: string | null;
    marketName?: string | null;
    mname?: string | null;
  }): boolean {
    const marketType = String(
      input.gtype || input.marketType || '',
    ).toLowerCase();
    const marketName = String(
      input.marketName || input.mname || '',
    ).toLowerCase();

    return (
      marketType === 'match' ||
      marketType === 'match1' ||
      marketType === 'match_odds' ||
      marketName.includes('match odds') ||
      marketName.includes('match winner')
    );
  }

  async placeBet(userId: number, betData: PlaceBetDto) {
    await this.maintenanceService.assertScopeAvailable(
      'sports',
      'Sports betting is temporarily unavailable due to maintenance.',
      userId,
    );

    // ── Sportradar bets: entirely separate path ────────────────────────────
    // eventId like 'sr:match:69832142' → skip Diamond market lookup,
    // use decimal odds, compute potentialWin = stake × odds.
    if (String(betData.eventId || '').toLowerCase().startsWith('sr:')) {
      return this.placeSportradarBet(userId, betData);
    }
    // ──────────────────────────────────────────────────────────────────────

    const placementLockKey = this.buildPlacementLockKey(userId, betData);

    await this.enforceRateLimit(
      `bet_place_rl:${userId}`,
      BET_PLACE_RATE_LIMIT,
      BET_PLACE_RATE_WINDOW_SECS,
      `Too many bet placement attempts. Max ${BET_PLACE_RATE_LIMIT} per ${BET_PLACE_RATE_WINDOW_SECS}s.`,
    );
    await this.acquireActionLock(
      placementLockKey,
      BET_PLACE_LOCK_TTL_SECS,
      'Duplicate bet submission detected. Please wait a moment and try again.',
    );

    try {
      // ── LAY Bet Access Control ────────────────────────────────────────────
      // LAY betting is restricted to a whitelist of approved users only.
      const betTypeNormEarly = String(betData.betType || 'back').toLowerCase();
      if (betTypeNormEarly === 'lay') {
        const LAY_ALLOWED_USERNAMES = ['shakti', 'yatin'];
        const requestingUser = await this.prisma.user.findUnique({
          where: { id: userId },
          select: { username: true },
        });
        const username = String(requestingUser?.username || '').toLowerCase();
        if (!LAY_ALLOWED_USERNAMES.includes(username)) {
          throw new BadRequestException('Lay betting is not available for your account.');
        }
      }
      // ─────────────────────────────────────────────────────────────────────

      // --- 4-LAYER SECURITY VALIDATION ---

      // 1. Fetch Market from DB (Layer 1 & 2 Source)
      const market = await this.marketModel.findOne({
        market_id: betData.marketId,
      });
      if (!market) throw new BadRequestException('Market not found');

      const canonicalEventId = this.normalizeText(
        (market as any).event_id || betData.eventId,
      );
      if (!canonicalEventId) {
        throw new BadRequestException('Market event is unavailable');
      }

      const requestedEventId = this.normalizeText(betData.eventId);
      if (requestedEventId && requestedEventId !== canonicalEventId) {
        throw new BadRequestException(
          'Market does not belong to the requested event',
        );
      }

      const canonicalSelectionId = this.normalizeText(betData.selectionId);
      const runner = this.findRunnerBySelectionId(
        market as any,
        canonicalSelectionId,
      );
      const canonicalSelectionName = this.getRunnerDisplayName(runner);
      if (!canonicalSelectionName) {
        throw new BadRequestException('Selection not found in market');
      }

      const canonicalMarketName = this.normalizeText(
        (market as any).market_name || (market as any).mname || 'Market',
      );

      // Layer 1: Status Check
      if (!market.is_active || market.status !== 'OPEN') {
        // Allow 'OPEN' or specific internal status.
        // If local status is 'SUSPENDED', reject.
        if (market.status === 'SUSPENDED' || market.status === 'CLOSED') {
          throw new BadRequestException('Market is suspended or closed');
        }
      }

      // ── Layer 0: Bet Limits (mirrors kuber min/max logic) ─────────────────────
      const stake = Number(betData.stake);
      if (!stake || stake < 1) {
        throw new BadRequestException('Minimum bet stake is ₹1');
      }
      const marketType =
        (market as any).gtype || (market as any).market_type || 'match';
      const isSession =
        marketType.toLowerCase() === 'session' ||
        marketType.toLowerCase() === 'fancy';
      const isBookmaker =
        marketType.toLowerCase() === 'special' ||
        marketType.toLowerCase() === 'bookmaker';

      // Global minimum bet (SystemConfig) — applied as a floor when a market
      // has no per-market minlimit set. Prevents clients from bypassing the
      // displayed minimum by sending a small stake to the API directly.
      let globalMinBet = 100;
      try {
        const cfg = await (this.prisma as any).systemConfig.findUnique({
          where: { key: 'MIN_BET' },
        });
        const parsed = cfg ? parseFloat(cfg.value) : NaN;
        if (!isNaN(parsed) && parsed > 0) globalMinBet = parsed;
      } catch {
        /* use default */
      }

      // Read per-market limits stored on Market document
      const mktAny = market as any;
      let minBet = globalMinBet;
      let maxBet = 999999999;
      if (isSession) {
        if (mktAny.session_minlimit > 0) minBet = mktAny.session_minlimit;
        if (mktAny.session_maxlimit > 0) maxBet = mktAny.session_maxlimit;
      } else if (isBookmaker) {
        if (mktAny.bookmaker_minlimit > 0) minBet = mktAny.bookmaker_minlimit;
        if (mktAny.bookmaker_maxlimit > 0) maxBet = mktAny.bookmaker_maxlimit;
      } else {
        if (mktAny.machodds_minlimit > 0) minBet = mktAny.machodds_minlimit;
        if (mktAny.matchodd_maxlimit > 0) maxBet = mktAny.matchodd_maxlimit;
      }

      if (stake < minBet) {
        throw new BadRequestException(
          `Minimum bet for this market is ₹${minBet}`,
        );
      }
      if (stake > maxBet) {
        throw new BadRequestException(
          `Maximum bet for this market is ₹${maxBet}`,
        );
      }

      const betTypeNorm = (
        betData.betType ||
        betData.type ||
        'back'
      ).toLowerCase();
      const shouldAutoAcceptMatchOdds = this.isAutoAcceptMatchOddsMarket({
        gtype: marketType,
        marketName: canonicalMarketName,
        mname: (market as any).mname,
      });

      // Layer 1.5: Event Status Check
      const event = await this.eventModel.findOne({
        event_id: canonicalEventId,
      });
      const canonicalEventName = this.normalizeText(
        event?.event_name || (market as any).event_name || 'Event',
      );

      if (this.isClosedSportsEventStatus(event?.match_status)) {
        throw new BadRequestException(
          'Match is completed. Betting is suspended.',
        );
      }

      // Layer 2: DB Odds Validation (Optional but recommended)
      // Check if cached DB odds match requested odds within tolerance?
      // DB might be slightly stale compared to socket, so we leniency or skip if Socket is primary.
      // Let's rely on Socket for strictness, but DB for sanity check if Socket is empty.

      // Layer 3: Socket/Live Odds Validation & Layer 4: LTR/Best Price Check
      const liveData = this.sportsSocketService.getLiveOdds(betData.marketId);

      if (liveData) {
        // Check based on Market Type logic
        // 1. Match Odds (Back/Lay)
        if (betTypeNorm === 'back' || betTypeNorm === 'lay') {
          const isBack = betTypeNorm === 'back';
          const requestedOdds = Number(betData.odds);
          const selectionId = canonicalSelectionId;

          // Match Odds Logic (Runners in 'rt' or 'data')
          // liveData might be the update object itself or containing 'rt'.
          // Based on `SportsSocketService` cache logic: `this.marketCache.set(String(parsed.id), parsed);`
          // parsed usually has `rt`.

          let bestPrice = 0;
          let found = false;

          if (Array.isArray(liveData.rt)) {
            // Filter updates for this runner
            const runnerUpdates = liveData.rt.filter(
              (r: any) =>
                String(r.ri) === String(selectionId) ||
                String(r.id) === String(selectionId) ||
                String(r.selectionId) === String(selectionId),
            );

            if (runnerUpdates.length > 0) {
              found = true;
              // Sort to find best price
              // Backs: Higher is better. Lays: Lower is better.
              if (isBack) {
                const hacks = runnerUpdates.filter(
                  (r: any) => r.ib === true || r.type === 'back',
                );
                if (hacks.length > 0) {
                  // Sort descending
                  hacks.sort(
                    (a, b) => (a.rt || a.pr || 0) - (b.rt || b.pr || 0),
                  );
                  bestPrice = parseFloat(hacks[0].rt || hacks[0].pr || 0);
                }
              } else {
                const lays = runnerUpdates.filter(
                  (r: any) => !r.ib || r.type === 'lay',
                );
                if (lays.length > 0) {
                  // Sort ascending
                  lays.sort(
                    (a, b) => (a.rt || a.pr || 0) - (b.rt || b.pr || 0),
                  );
                  bestPrice = parseFloat(lays[0].rt || lays[0].pr || 0);
                }
              }
            }
          }
          // Session/Fancy Logic (b1, l1)
          else if (liveData.b1 !== undefined || liveData.l1 !== undefined) {
            // Assuming this is the market update itself (Session/Fancy)
            found = true;
            if (isBack) {
              bestPrice = parseFloat(liveData.b1 || liveData.BackPrice1 || 0);
            } else {
              bestPrice = parseFloat(liveData.l1 || liveData.LayPrice1 || 0);
            }
          }

          // VALIDATION
          if (found && bestPrice > 0) {
            // Tolerance check involves allowing small slip or checking strictly.
            // "LTR Check before bet placement":
            // If Backing: Requested <= BestPrice (You can match if you ask for less or equal)
            // If Laying: Requested >= BestPrice (You can match if you ask for more or equal)

            // However, users usually click the Best Price.
            // If price moved AGAINST them, reject.
            // Back: Price dropped below requested? REJECT.
            // Lay: Price rose above requested? REJECT.

            // Tolerance: 0 for now (Strict)
            if (!shouldAutoAcceptMatchOdds && isBack) {
              if (bestPrice < requestedOdds) {
                // E.g. Asked 2.0, Best is 1.9 -> Reject
                throw new BadRequestException(
                  `Odds changed. Best available: ${bestPrice}`,
                );
              }
            } else if (!shouldAutoAcceptMatchOdds) {
              if (bestPrice > requestedOdds) {
                // E.g. Asked 2.0, Best is 2.1 -> Reject
                throw new BadRequestException(
                  `Odds changed. Best available: ${bestPrice}`,
                );
              }
            }
          }
        }
      }

      const pricingMarketType =
        (market as any).gtype || (market as any).market_type;
      const pricingMarketName =
        (market as any).market_name ||
        (market as any).mname ||
        canonicalMarketName;
      const pricingSelectionName = canonicalSelectionName;
      const resolvedQuote =
        this.extractCurrentQuoteFromMarket(
          liveData,
          canonicalSelectionId,
          betTypeNorm,
        ) ??
        this.extractCurrentQuoteFromMarket(
          market as any,
          canonicalSelectionId,
          betTypeNorm,
        );
      const fallbackRate = this.parsePositiveOdds(betData.rate);
      const resolvedRate = resolvedQuote?.rate ?? fallbackRate;
      const acceptedOdds =
        shouldAutoAcceptMatchOdds && resolvedQuote?.odds
          ? resolvedQuote.odds
          : Number(betData.odds || 0);

      if (
        !shouldAutoAcceptMatchOdds &&
        resolvedQuote?.odds &&
        Math.abs(Number(betData.odds || 0) - resolvedQuote.odds) > 0.05
      ) {
        throw new BadRequestException(
          `Odds changed. Best available: ${resolvedQuote.odds}`,
        );
      }
      const isLineBased = isLineBasedFancyMarket({
        marketType: pricingMarketType,
        marketName: pricingMarketName,
        selectionName: pricingSelectionName,
      }) || ['MATCH1', 'KHADO', 'FANCY', 'METER', 'LAMBI'].includes(pricingMarketType?.toUpperCase() || '');

      // ── SECURITY: require server-side quote for line-based markets ──
      // For Fancy/Session/Line-based markets the backend MUST have a live
      // quote to validate payout. Accepting client-supplied odds without a
      // matching server quote would let an attacker send arbitrary odds
      // (e.g. 100.0 on a 2.5 market) and be paid out on the inflated value.
      if (isLineBased && !resolvedQuote?.odds) {
        throw new BadRequestException(
          'Market data temporarily unavailable. Please retry in a moment.',
        );
      }

      // Wallet deduction is ALWAYS the stake typed by the user — for both Back and Lay.
      // The difference between Back and Lay is only in the payout calculation, not deduction.
      if (betTypeNorm === 'lay' && stake < 1) {
        throw new BadRequestException('Lay stake must be at least ₹1');
      }

      const computedPotentialWin = calculatePotentialWinAmount({
        stake,
        odds: acceptedOdds,
        rate: resolvedRate,
        betType: betTypeNorm,
        marketType: pricingMarketType,
        marketName: pricingMarketName,
        selectionName: pricingSelectionName,
      });

      // Layer 4: Tolerance Check (commented out — using socket validation above)

      // --- END SECURITY CHECKS ---

      // ── Pre-compute market details for Diamond API result fetching ─────────
      // (must be outside Prisma transaction since it queries MongoDB)
      const _mktDoc = market as any; // mname/nat/gtype exist at runtime but not in typed Market schema
      const _rawGtype = (
        _mktDoc?.gtype ||
        _mktDoc?.market_type ||
        'match'
      ).toLowerCase();
      const _mname = _mktDoc?.mname || 'NORMAL';
      const _nat = _mktDoc?.nat || canonicalMarketName || '';
      const _section = _mktDoc?.runners_data || [];
      const _computedMarketName =
        this.getMarketNameFromGtype({
          mname: _mname,
          gtype: _rawGtype,
          nat: _nat,
          section: _section,
        }) || _nat;
      // ──────────────────────────────────────────────────────────────────────

      // ── SESSION/FANCY MAX PAYOUT GUARD ─────────────────────────────────────
      // Prevents exploitation via markets with abnormally high rate values.
      //
      // Root cause: Diamond API sends bs1/ls1 (liquidity volume) which the
      // frontend incorrectly passes as the payout rate. A tiny ls1=2 on OBO
      // markets creates a 50× LAY payout, enabling guaranteed arbitrage when
      // paired with a BHAV BACK bet on the same session line.
      //
      // Per-mname caps (admin-tunable via this constant map):
      //   NORMAL / OBO / standard sessions → max 3× total return (2× profit)
      //   BHAV                              → max 100× total return
      //   KHADO / LAMBI                     → max 20×  total return
      if (isLineBased) {
        const mnameLower = (_mname || 'normal').toLowerCase();
        let maxReturnMultiplier: number;
        if (mnameLower === 'bhav') {
          maxReturnMultiplier = 100; // Bhav markets legitimately have high multipliers
        } else if (mnameLower.includes('khado') || mnameLower.includes('lambi')) {
          maxReturnMultiplier = 20;
        } else {
          maxReturnMultiplier = 3; // Standard session / OBO — max 2× profit (3× total return)
        }
        const maxAllowedReturn = this.roundCurrency(stake * maxReturnMultiplier);
        if (computedPotentialWin > maxAllowedReturn) {
          throw new BadRequestException(
            `Session bet payout ₹${computedPotentialWin} exceeds the platform limit ` +
            `for ${_mname} markets (max ${maxReturnMultiplier}× stake = ₹${maxAllowedReturn}). ` +
            `Please reduce your stake.`,
          );
        }
      }
      // ──────────────────────────────────────────────────────────────────────

      // ── CROSS-MARKET HEDGE DETECTION ───────────────────────────────────────
      // Blocks placing an opposing BACK/LAY bet at the same session line within
      // the same event. This prevents guaranteed-profit arbitrage that exploits
      // asymmetric payout rates across "Normal" and "Over By Over" market
      // categories covering the same underlying cricket statistic.
      if (isLineBased && isSession) {
        const opposingType = betTypeNorm === 'lay' ? 'back' : 'lay';
        const existingOpposingBet = await this.betModel.findOne({
          userId,
          eventId: canonicalEventId,
          status: 'PENDING',
          odds: acceptedOdds,   // same session line
          betType: opposingType,
        }).lean();
        if (existingOpposingBet) {
          throw new BadRequestException(
            `Cross-market hedging detected: you already have a ${opposingType.toUpperCase()} ` +
            `bet at session line ${acceptedOdds} for this match. ` +
            `Opposing bets on the same line are not permitted.`,
          );
        }
      }
      // ──────────────────────────────────────────────────────────────────────

      // 1. Transactional Bet Placement
      const result = await this.prisma.$transaction(async (prisma) => {
        // A. Validate User & Balance
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new BadRequestException('User not found');

        // Wallet routing:
        //   If user has active sportsBonus → deduct stake from sportsBonus first,
        //   then fall back to main balance for any remainder.
        const rawWalletType = betData.walletType || 'fiat';
        const walletType: 'fiat' | 'crypto' = rawWalletType.startsWith('crypto') ? 'crypto' : 'fiat';
        const balanceField =
          walletType === 'crypto' ? 'cryptoBalance' : 'balance';
        const currentBalance =
          walletType === 'crypto'
            ? ((user as any).cryptoBalance ?? 0)
            : (user.balance ?? 0);
        const currentSportsBonus: number = (user as any).sportsBonus ?? 0;

        // Check if user has selected the sports bonus for betting (isEnabled=true)
        // Only look up DB if there's actually a sports bonus balance (avoid unnecessary query)
        const activeSportsBonusRow =
          currentSportsBonus > 0 && walletType === 'fiat'
            ? await (this.prisma as any).userBonus.findFirst({
                where: {
                  userId,
                  status: 'ACTIVE',
                  applicableTo: { in: ['SPORTS', 'BOTH'] },
                },
                select: { isEnabled: true },
              })
            : null;
        
        let isSportsBonusSelected = activeSportsBonusRow?.isEnabled !== false; // default true if no row

        // Explicit override from frontend wallet selector
        if (rawWalletType === 'fiat-sports' || rawWalletType === 'crypto-sports') {
           isSportsBonusSelected = true;
        } else if (rawWalletType === 'fiat-main' || rawWalletType === 'crypto-main') {
           isSportsBonusSelected = false;
        }

        // ── Bonus eligibility check ───────────────────────────────────────────
        // Sports bonus funds can only be wagered on Match Odds bets with odds >= 1.6.
        const BONUS_MIN_ODDS = 1.6;
        const acceptedOddsNum = parseFloat(String(acceptedOdds || 0));
        // Strictly only Match Odds markets (no Bookmaker, no Fancy)
        const isMatchOddsForBonus = ['match', 'match_odds', 'match1'].includes(_rawGtype);

        if (isSportsBonusSelected) {
          if (!isMatchOddsForBonus || acceptedOddsNum < BONUS_MIN_ODDS) {
             const explicitBonusSelection = rawWalletType === 'fiat-sports' || rawWalletType === 'crypto-sports';
             if (explicitBonusSelection) {
                 if (!isMatchOddsForBonus) {
                     throw new BadRequestException('Bonus bets can only be placed on Match Odds markets.');
                 }
                 if (acceptedOddsNum < BONUS_MIN_ODDS) {
                     throw new BadRequestException(`Bonus bets require minimum odds of ${BONUS_MIN_ODDS}.`);
                 }
             }
             // If implicit (just legacy 'fiat' wallet fallback), silently ignore bonus and use main balance
             isSportsBonusSelected = false;
          }
        }
        // ────────────────────────────────────────────────────────────────────

        // Determine how much to pull from sportsBonus vs main balance
        const stakeFromBonus =
          walletType === 'fiat' && isSportsBonusSelected
            ? Math.min(currentSportsBonus, stake)
            : 0;
        const stakeFromBalance = stake - stakeFromBonus;
        const betSource =
          stakeFromBonus > 0
            ? stakeFromBonus >= stake
              ? 'sportsBonus'
              : 'sportsBonus+balance'
            : 'balance';

        if (stakeFromBalance > currentBalance) {
          throw new BadRequestException(
            walletType === 'crypto'
              ? `Insufficient crypto balance ($${currentBalance.toFixed(2)} available)`
              : `Insufficient balance. Bonus: ₹${currentSportsBonus.toFixed(2)}, Main: ₹${currentBalance.toFixed(2)}. Needed: ₹${stake}`,
          );
        }

        const txRemarks =
          stakeFromBonus > 0
            ? `Bet on ${canonicalEventName} - ${canonicalSelectionName} [Bonus ₹${stakeFromBonus.toFixed(2)} + Balance ₹${stakeFromBalance.toFixed(2)}]`
            : `Bet on ${canonicalEventName} - ${canonicalSelectionName} [${walletType.toUpperCase()} wallet]`;
        const placeAllocations: BetPayoutAllocation[] = [];
        if (stakeFromBonus > 0) {
          placeAllocations.push({
            walletField: 'sportsBonus',
            walletLabel: this.getWalletFieldLabel('sportsBonus'),
            amount: this.roundCurrency(stakeFromBonus),
          });
        }
        if (stakeFromBalance > 0) {
          const primaryWalletField = this.getPrimaryWalletField(walletType);
          placeAllocations.push({
            walletField: primaryWalletField,
            walletLabel: this.getWalletFieldLabel(primaryWalletField),
            amount: this.roundCurrency(stakeFromBalance),
          });
        }
        const normalizedPlaceAllocations =
          this.sumAllocations(placeAllocations);
        const placePaymentMethod =
          normalizedPlaceAllocations.length === 1
            ? this.mapWalletFieldToPaymentMethod(
                normalizedPlaceAllocations[0].walletField,
              )
            : 'MULTI_WALLET';

        // B. Create Transaction Record (Deduction)
        await prisma.transaction.create({
          data: {
            userId,
            amount: stake,
            type: 'BET_PLACE',
            status: 'COMPLETED',
            paymentMethod: placePaymentMethod,
            paymentDetails: {
              source: 'BET_PLACE',
              walletField:
                normalizedPlaceAllocations.length === 1
                  ? normalizedPlaceAllocations[0].walletField
                  : null,
              allocations: normalizedPlaceAllocations,
            },
            remarks: txRemarks,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        // C. Deduct from sportsBonus first, then main balance; also update Exposure.
        //
        // SECURITY: the decrement is gated by a conditional WHERE so the update
        // only lands when the DB row still has sufficient balance at commit
        // time. Using findUnique + update would race against concurrent
        // bets/withdrawals from the same user (a parallel transaction could
        // both pass the check and then each decrement beyond the actual
        // balance). With updateMany + gte guard, at most one transaction
        // succeeds; losers see count === 0 and throw, rolling back the
        // enclosing prisma.$transaction.
        const deductData: any = { exposure: { increment: stake } };
        const deductWhere: any = { id: userId };
        if (stakeFromBonus > 0) {
          deductData.sportsBonus = { decrement: stakeFromBonus };
          deductWhere.sportsBonus = { gte: stakeFromBonus };
        }
        if (stakeFromBalance > 0) {
          deductData[balanceField] = { decrement: stakeFromBalance };
          deductWhere[balanceField] = { gte: stakeFromBalance };
        }
        const deduct = await prisma.user.updateMany({
          where: deductWhere,
          data: deductData,
        });
        if (deduct.count === 0) {
          throw new BadRequestException(
            'Insufficient balance (concurrent update detected). Please retry.',
          );
        }

        // D. Create Bet in MongoDB (store walletType for settlement)
        try {
          const bet = await new this.betModel({
            userId,
            eventId: canonicalEventId,
            matchId: canonicalEventId,
            eventName: canonicalEventName,
            marketId: betData.marketId,
            marketName: canonicalMarketName,
            selectionId: canonicalSelectionId,
            selectionName: canonicalSelectionName,
            selectedTeam: canonicalSelectionName,
            odds: acceptedOdds,
            stake,
            originalStake: stake,
            potentialWin: computedPotentialWin,
            originalPotentialWin: computedPotentialWin,
            status: 'PENDING',
            betType: (betData.betType || betData.type || 'back').toLowerCase(),
            walletType,
            betSource, // 'balance' | 'sportsBonus' | 'sportsBonus+balance'
            bonusStakeAmount: this.roundCurrency(stakeFromBonus),
            walletStakeAmount: this.roundCurrency(stakeFromBalance),
            cashoutEnabled: this.isCashoutSupportedMarket(market as any),
            partialCashoutValue: 0,
            partialCashoutCount: 0,
            placedAt: new Date(),
            // ── Diamond API market details (for result fetching) ──────
            gtype: _rawGtype,
            mname: _mname,
            nat: _nat,
            computedMarketName: _computedMarketName,
            // ─────────────────────────────────────────────────────────
          }).save();

          await this.redis.sadd(`active_bets:${userId}`, bet._id.toString());
          return { ...bet.toObject(), id: bet._id.toString() };
        } catch (mongoError) {
          throw new BadRequestException(
            'Failed to place bet record. Please try again.',
          );
        }
      });

      // 2. Referral Trigger (Fire and Forget or Await)
      try {
        // Calculate total volume for this user
        const aggregation = await this.prisma.transaction.aggregate({
          _sum: { amount: true },
          where: {
            userId,
            type: 'BET_PLACE',
            status: 'COMPLETED',
          },
        });
        const totalVolume = aggregation._sum.amount || 0;

        const today = new Date().toISOString().slice(0, 10);
        await this.referralService.checkAndAward(
          userId,
          'BET_VOLUME',
          totalVolume,
          `bet_vol_${userId}_${today}`,
        );
      } catch (e) {
        console.error('Referral check failed for bet', e);
      }

      // ── Real-time wagering turnover tracking ──────────────────────────────
      try {
        // betSource is stored on the bet doc inside the transaction — read it from the result
        const resolvedBetSource: string =
          (result as any).betSource || 'balance';
        const resolvedBonusStakeAmount = this.roundCurrency(
          Number((result as any).bonusStakeAmount ?? 0),
        );
        await this.bonusService.recordWagering(
          userId,
          stake,
          'SPORTS',
          resolvedBetSource,
          resolvedBonusStakeAmount,
        );
      } catch (e) {
        console.error('[BonusWagering] Failed for user', userId, e);
        this.bonusService.emitWalletRefresh(userId);
      }

      // 3. Notify Diamond API about this market (fire-and-forget — never blocks)
      this.postMarketToDiamond(
        {
          ...betData,
          eventId: canonicalEventId,
          eventName: canonicalEventName,
          marketName: canonicalMarketName,
          selectionId: canonicalSelectionId,
          selectionName: canonicalSelectionName,
        },
        event,
      ).catch(() => {
        /* already logged */
      });

      return result;
    } catch (error) {
      await this.releaseActionLock(placementLockKey);
      throw error;
    }
  }

  // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
  // SPORTRADAR BET PLACEMENT
  //
  // Flow:
  //   1. Rate-limit + dedup lock
  //   2. Fetch market-result from Redis (sportradar:market-result:{eventId})
  //      to validate marketId exists and status == OPEN
  //   3. Validate runnerId exists and runner is Active
  //   4. Wallet deduction (Prisma transaction)
  //   5. Save Bet doc with all SR fields:
  //      srEventId, srSportId, srMarketFullId, srRunnerId, srRunnerName, srMarketName
  //   6. These fields are used by the settlement worker which calls getRawMarketResult()
  //      and matches bets:  bet.srMarketFullId === settled.marketId
  //                     &&  bet.srRunnerId      === settled.runner.runnerId
  //
  // Market ID example (can be very long \u2014 MaxLength 512 in DTO):
  //   '1230:sp:overnr=15|total=152.5|inningnr=1|maxovers=20'
  //   '363:sp:overnr=8|total=1.5|inningnr=1|deliverynr=2'
  //   '340'  (Winner incl. super over)
  //   '342'  (Will there be a tie)
  //
  // Runner IDs:
  //   '12' \u2192 over   '13' \u2192 under
  //   '70' \u2192 odd    '72' \u2192 even
  //   '74' \u2192 yes    '76' \u2192 no
  //   '4'/'5' \u2192 team runners (Winner market)
  // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550

  private async placeSportradarBet(userId: number, betData: PlaceBetDto) {
    const lockKey = `sr_bet_lock:${userId}:${betData.eventId}:${betData.marketId}:${betData.selectionId}`;

    await this.enforceRateLimit(
      `bet_place_rl:${userId}`,
      BET_PLACE_RATE_LIMIT,
      BET_PLACE_RATE_WINDOW_SECS,
      `Too many bet placement attempts. Max ${BET_PLACE_RATE_LIMIT} per ${BET_PLACE_RATE_WINDOW_SECS}s.`,
    );
    await this.acquireActionLock(
      lockKey,
      BET_PLACE_LOCK_TTL_SECS,
      'Duplicate SR bet submission detected. Please wait a moment and try again.',
    );

    try {
      // \u2500\u2500 1. Resolve srMarketFullId \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
      // For SR bets: marketId passed by frontend IS the composite SR marketId
      // (e.g. '1230:sp:overnr=15|total=152.5|inningnr=1|maxovers=20')
      const srEventId  = betData.eventId;
      const srMarketFullId = betData.srMarketFullId || betData.marketId;
      const srRunnerId     = betData.srRunnerId     || betData.selectionId;
      const srSportId      = betData.srSportId      || '';
      const srRunnerName   = betData.srRunnerName   || betData.selectionName || '';
      const srMarketName   = betData.srMarketName   || betData.marketName    || '';

      if (!srMarketFullId) throw new BadRequestException('marketId is required');
      if (!srRunnerId)     throw new BadRequestException('selectionId (runnerId) is required');

      const stake = Number(betData.stake);
      if (!stake || stake < 1) throw new BadRequestException('Minimum bet stake is ₹1');

      const odds = Number(betData.odds);
      if (!odds || odds <= 1) throw new BadRequestException('Odds must be greater than 1.00');

      // \u2500\u2500 2. Validate against a fresh live Sportradar snapshot \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
      let resolvedMarketName  = srMarketName;
      let resolvedRunnerName  = srRunnerName;
      let marketStatusAtPlace = 'UNKNOWN';
      const liveSnapshot = await this.sportradarService.getListMarket(
        srSportId,
        srEventId,
        { fresh: true },
      );

      if (!liveSnapshot?.success || !liveSnapshot?.event) {
        throw new BadRequestException(
          'Unable to verify live market status right now. Please try again.',
        );
      }

      const liveEvent = liveSnapshot.event;
      if (this.isSportradarEventClosed(liveEvent)) {
        throw new BadRequestException('Match completed. Betting is closed.');
      }

      // Lenient ID matcher — handles both raw SR marketIds (e.g. "1") and
      // composite Mongo-stored IDs (e.g. "sr:match:69832142:1") so the
      // frontend can safely send either form.
      const srIdMatches = (candidateId: unknown, targetId: string): boolean => {
        if (candidateId === null || candidateId === undefined) return false;
        const c = String(candidateId);
        const t = String(targetId);
        if (!c || !t) return false;
        if (c === t) return true;
        if (t.endsWith(`:${c}`)) return true;
        if (c.endsWith(`:${t}`)) return true;
        return false;
      };

      const liveMarket = this.getSportradarEventMarkets(liveEvent).find(
        (market: any) => srIdMatches(market?.marketId, srMarketFullId),
      );
      if (!liveMarket) {
        throw new BadRequestException(
          'Market is no longer available for betting.',
        );
      }

      // Sports bonus is allowed on SR Match Odds (match-winner) markets.
      // Detection is intentionally multi-signal because SR winner markets
      // can live in either the `matchOdds` or `bookmakers` bucket, and
      // `marketId` format varies between raw ("1") and composite
      // ("sr:match:XXX:1") depending on where the frontend read it from:
      //   1. Bucket membership of the resolved liveMarket
      //   2. `marketType` field (SR sets "MATCH_ODDS" / "MATCH_WINNER")
      //   3. `marketName` pattern ("Match Odds" / "Match Winner" / "1x2")
      const srMatchOddsBucket = Array.isArray(liveEvent?.markets?.matchOdds)
        ? liveEvent.markets.matchOdds
        : [];
      const bucketHit =
        srMatchOddsBucket.includes(liveMarket) ||
        srMatchOddsBucket.some((m: any) =>
          srIdMatches(m?.marketId, srMarketFullId),
        );
      const liveMarketType = String(liveMarket?.marketType || '')
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, '');
      const marketTypeHit =
        liveMarketType === 'MATCHODDS' ||
        liveMarketType === 'MATCHWINNER' ||
        liveMarketType === 'WINNER' ||
        liveMarketType === '1X2';
      const liveMarketNameLower = String(liveMarket?.marketName || '')
        .toLowerCase()
        .trim();
      const marketNameHit =
        /\bmatch\s*(odds|winner)\b/.test(liveMarketNameLower) ||
        /\bto\s*win\s*(the\s*)?match\b/.test(liveMarketNameLower) ||
        liveMarketNameLower === '1x2' ||
        liveMarketNameLower === 'winner';
      const isSrMatchOdds = bucketHit || marketTypeHit || marketNameHit;

      marketStatusAtPlace = String(
        liveMarket.marketStatus || liveMarket.status || 'UNKNOWN',
      ).trim();

      if (!this.isSportradarMarketOpen(liveMarket)) {
        throw new BadRequestException(
          'Market is currently suspended or closed. Please try another selection.',
        );
      }

      const liveRunner = (liveMarket.runners ?? []).find(
        (runner: any) => String(runner.runnerId) === String(srRunnerId),
      );
      if (!liveRunner) {
        throw new BadRequestException(
          'Selection is no longer available in this market.',
        );
      }

      if (!this.isSportradarRunnerActive(liveRunner)) {
        throw new BadRequestException('This selection is suspended.');
      }

      const liveMarketName = String(liveMarket.marketName || '').trim();
      if (liveMarketName) {
        resolvedMarketName = liveMarketName;
      }

      const liveRunnerName = String(liveRunner.runnerName || '').trim();
      if (liveRunnerName) {
        resolvedRunnerName = liveRunnerName;
      }

      const acceptedOdds = Number(liveRunner.backPrices?.[0]?.price);
      if (!Number.isFinite(acceptedOdds) || acceptedOdds <= 1) {
        throw new BadRequestException(
          'Odds are unavailable for this selection right now.',
        );
      }

      if (Math.abs(acceptedOdds - odds) > 0.01) {
        throw new BadRequestException(
          `Odds changed. Best available: ${acceptedOdds.toFixed(2)}`,
        );
      }

      // \u2500\u2500 3. Potential win = decimal odds \u00d7 stake (SR uses decimal odds) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
      const potentialWin = this.roundCurrency(stake * acceptedOdds);

      // Event name for display
      const eventName = betData.eventName || liveEvent.eventName || srEventId;

      // \u2500\u2500 4. Wallet deduction + Bet creation (Prisma transaction) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
      const walletType: 'fiat' | 'crypto' =
        String(betData.walletType || 'fiat').startsWith('crypto') ? 'crypto' : 'fiat';
      const balanceField = walletType === 'crypto' ? 'cryptoBalance' : 'balance';

      const rawWalletType = String(betData.walletType || 'fiat');

      const result = await this.prisma.$transaction(async (prisma) => {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) throw new BadRequestException('User not found');

        const currentBalance =
          walletType === 'crypto'
            ? ((user as any).cryptoBalance ?? 0)
            : (user.balance ?? 0);
        const currentSportsBonus: number = (user as any).sportsBonus ?? 0;

        // ── Sports bonus routing (same semantics as Diamond placeBet) ─────
        // Only look up the UserBonus row if there's an actual sportsBonus
        // balance, to avoid unnecessary queries.
        const activeSportsBonusRow =
          currentSportsBonus > 0 && walletType === 'fiat'
            ? await (prisma as any).userBonus.findFirst({
                where: {
                  userId,
                  status: 'ACTIVE',
                  applicableTo: { in: ['SPORTS', 'BOTH'] },
                },
                select: { isEnabled: true },
              })
            : null;

        let isSportsBonusSelected = activeSportsBonusRow?.isEnabled !== false; // default true if no row

        // Explicit override from frontend wallet selector
        if (rawWalletType === 'fiat-sports' || rawWalletType === 'crypto-sports') {
          isSportsBonusSelected = true;
        } else if (rawWalletType === 'fiat-main' || rawWalletType === 'crypto-main') {
          isSportsBonusSelected = false;
        }

        // Sports bonus funds can only be wagered on SR Match Odds markets
        // with odds >= 1.6. Bookmaker / premium / fancy markets are rejected
        // for the bonus wallet; they silently fall back to main balance when
        // the user did not explicitly pick the bonus wallet.
        const BONUS_MIN_ODDS = 1.6;
        if (isSportsBonusSelected) {
          if (!isSrMatchOdds || acceptedOdds < BONUS_MIN_ODDS) {
            const explicitBonusSelection =
              rawWalletType === 'fiat-sports' ||
              rawWalletType === 'crypto-sports';
            if (explicitBonusSelection) {
              if (!isSrMatchOdds) {
                throw new BadRequestException(
                  'Bonus bets can only be placed on Match Odds markets.',
                );
              }
              if (acceptedOdds < BONUS_MIN_ODDS) {
                throw new BadRequestException(
                  `Bonus bets require minimum odds of ${BONUS_MIN_ODDS}.`,
                );
              }
            }
            isSportsBonusSelected = false;
          }
        }

        // Determine how much to pull from sportsBonus vs main balance.
        const stakeFromBonus =
          walletType === 'fiat' && isSportsBonusSelected
            ? Math.min(currentSportsBonus, stake)
            : 0;
        const stakeFromBalance = stake - stakeFromBonus;
        const betSource =
          stakeFromBonus > 0
            ? stakeFromBonus >= stake
              ? 'sportsBonus'
              : 'sportsBonus+balance'
            : 'balance';

        if (stakeFromBalance > currentBalance) {
          throw new BadRequestException(
            walletType === 'crypto'
              ? `Insufficient crypto balance ($${currentBalance.toFixed(2)} available)`
              : `Insufficient balance. Bonus: \u20b9${currentSportsBonus.toFixed(2)}, Main: \u20b9${currentBalance.toFixed(2)}. Needed: \u20b9${stake}`,
          );
        }

        // Build allocations + paymentMethod that mirror the Diamond path so
        // Transaction bookkeeping, settlement, and void-refunds stay generic.
        const placeAllocations: BetPayoutAllocation[] = [];
        if (stakeFromBonus > 0) {
          placeAllocations.push({
            walletField: 'sportsBonus',
            walletLabel: this.getWalletFieldLabel('sportsBonus'),
            amount: this.roundCurrency(stakeFromBonus),
          });
        }
        if (stakeFromBalance > 0) {
          const primaryWalletField = this.getPrimaryWalletField(walletType);
          placeAllocations.push({
            walletField: primaryWalletField,
            walletLabel: this.getWalletFieldLabel(primaryWalletField),
            amount: this.roundCurrency(stakeFromBalance),
          });
        }
        const normalizedPlaceAllocations =
          this.sumAllocations(placeAllocations);
        const placePaymentMethod =
          normalizedPlaceAllocations.length === 1
            ? this.mapWalletFieldToPaymentMethod(
                normalizedPlaceAllocations[0].walletField,
              )
            : 'MULTI_WALLET';

        const txRemarks =
          stakeFromBonus > 0
            ? `SR Bet on ${eventName} \u2014 ${resolvedMarketName || srMarketFullId} / ${resolvedRunnerName || srRunnerId} [Bonus \u20b9${stakeFromBonus.toFixed(2)} + Balance \u20b9${stakeFromBalance.toFixed(2)}]`
            : `SR Bet on ${eventName} \u2014 ${resolvedMarketName || srMarketFullId} / ${resolvedRunnerName || srRunnerId}`;

        // Transaction record
        await prisma.transaction.create({
          data: {
            userId,
            amount: stake,
            type: 'BET_PLACE',
            status: 'COMPLETED',
            paymentMethod: placePaymentMethod,
            paymentDetails: {
              source: 'BET_PLACE',
              provider: 'sportradar',
              srEventId,
              srMarketFullId,
              srRunnerId,
              walletField:
                normalizedPlaceAllocations.length === 1
                  ? normalizedPlaceAllocations[0].walletField
                  : null,
              allocations: normalizedPlaceAllocations,
            },
            remarks: txRemarks,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });

        // Race-safe split deduction. Using updateMany + gte guard so that
        // concurrent bets cannot double-spend either wallet slice.
        const deductData: any = { exposure: { increment: stake } };
        const deductWhere: any = { id: userId };
        if (stakeFromBonus > 0) {
          deductData.sportsBonus = { decrement: stakeFromBonus };
          deductWhere.sportsBonus = { gte: stakeFromBonus };
        }
        if (stakeFromBalance > 0) {
          deductData[balanceField] = { decrement: stakeFromBalance };
          deductWhere[balanceField] = { gte: stakeFromBalance };
        }
        const deduct = await prisma.user.updateMany({
          where: deductWhere,
          data: deductData,
        });
        if (deduct.count === 0) {
          throw new BadRequestException(
            'Insufficient balance (concurrent update detected). Please retry.',
          );
        }

        // \u2500\u2500 5. Save Bet doc \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
        try {
          const finalMarketName = resolvedMarketName || srMarketFullId;
          const finalRunnerName = resolvedRunnerName || srRunnerId;

          const bet = await new this.betModel({
            userId,
            eventId:        srEventId,
            matchId:        srEventId,
            eventName,
            marketId:       srMarketFullId,
            marketName:     finalMarketName,
            selectionId:    srRunnerId,
            selectionName:  finalRunnerName,
            selectedTeam:   finalRunnerName,
            odds: acceptedOdds,
            stake,
            originalStake:  stake,
            potentialWin,
            originalPotentialWin: potentialWin,
            status:         'PENDING',
            betType:        'back',
            walletType,
            betSource, // 'balance' | 'sportsBonus' | 'sportsBonus+balance'
            bonusStakeAmount: this.roundCurrency(stakeFromBonus),
            walletStakeAmount: this.roundCurrency(stakeFromBalance),
            cashoutEnabled: true,
            partialCashoutValue: 0,
            partialCashoutCount: 0,
            placedAt: new Date(),
            gtype: 'match_odds',
            mname: '',
            nat: finalMarketName,
            computedMarketName: finalMarketName,
            provider:        'sportradar',
            srEventId,
            srSportId,
            srMarketFullId,
            srRunnerId,
            srRunnerName:   finalRunnerName,
            srMarketName:   finalMarketName,
            srMarketStatus: marketStatusAtPlace,
          }).save();

          await this.redis.sadd(`active_bets:${userId}`, bet._id.toString());
          return { ...bet.toObject(), id: bet._id.toString() };
        } catch (mongoError) {
          this.logger.error(`[SR placeBet] MongoDB save failed: ${mongoError.message}`);
          throw new BadRequestException('Failed to save bet. Please try again.');
        }
      });

      // \u2500\u2500 6. Post-placement (fire-and-forget) \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
      try {
        const aggregation = await this.prisma.transaction.aggregate({
          _sum: { amount: true },
          where: { userId, type: 'BET_PLACE', status: 'COMPLETED' },
        });
        const totalVolume = aggregation._sum.amount || 0;
        const today = new Date().toISOString().slice(0, 10);
        await this.referralService.checkAndAward(userId, 'BET_VOLUME', totalVolume, `bet_vol_${userId}_${today}`);
      } catch { /* ignore \u2014 non-critical */ }

      try {
        const resolvedBetSource: string =
          (result as any).betSource || 'balance';
        const resolvedBonusStakeAmount = this.roundCurrency(
          Number((result as any).bonusStakeAmount ?? 0),
        );
        await this.bonusService.recordWagering(
          userId,
          stake,
          'SPORTS',
          resolvedBetSource,
          resolvedBonusStakeAmount,
        );
      } catch { this.bonusService.emitWalletRefresh(userId); }

      return result;
    } catch (error) {
      await this.releaseActionLock(lockKey);
      throw error;
    }
  }

  // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
  // ── Port of turnkeyxgaming's getMarketNameFromGtype ──────────────────────
  private getMarketNameFromGtype({
    mname,
    gtype,
    nat,
    section,
  }: {
    mname?: string;
    gtype?: string;
    nat?: string;
    section?: any[];
  }): string | null {
    if (!mname || !gtype) return null;

    // 1. MATCH / MATCH1 — join runner nat fields with " vs "
    if (gtype === 'match' || gtype === 'match1') {
      const sections = Array.isArray(section) ? section : [];
      const runnerNames = sections
        .map((s: any) => s?.nat?.trim())
        .filter(Boolean);
      if (runnerNames.length === 0) return null;
      return runnerNames.length > 1 ? runnerNames.join(' vs ') : runnerNames[0];
    }

    // 2. ALL OTHER TYPES — nat is the market name
    if (!nat || typeof nat !== 'string') return null;
    return nat.trim();
  }

  private normalizeText(value: unknown): string {
    return String(value ?? '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private findRunnerBySelectionId(
    market: any,
    selectionId: string,
  ): any | null {
    const normalizedSelectionId = this.normalizeText(selectionId);
    if (!normalizedSelectionId) return null;

    const runnerCollections = [
      market?.runners_data,
      market?.marketOdds,
      market?.section,
    ];

    for (const runners of runnerCollections) {
      if (!Array.isArray(runners)) continue;

      for (const runner of runners) {
        const runnerId = this.getRunnerSelectionId(runner);
        if (runnerId === normalizedSelectionId) {
          return runner;
        }
      }
    }

    return null;
  }

  private getRunnerDisplayName(runner: any): string | null {
    const candidate = this.normalizeText(
      runner?.nat ??
        runner?.RunnerName ??
        runner?.runnerName ??
        runner?.name ??
        runner?.oname,
    );

    return candidate || null;
  }

  private buildPlacementLockKey(userId: number, betData: PlaceBetDto): string {
    const fingerprint = createHash('sha256')
      .update(
        [
          userId,
          this.normalizeText(betData.clientRequestId),
          this.normalizeText(betData.eventId),
          this.normalizeText(betData.marketId),
          this.normalizeText(betData.selectionId),
          Number(betData.stake || 0).toFixed(2),
          Number(betData.odds || 0).toFixed(2),
          Number(betData.rate || 0).toFixed(2),
          this.normalizeText(betData.betType || betData.type || 'back'),
          this.normalizeText(betData.walletType || 'fiat'),
        ].join('|'),
      )
      .digest('hex');

    return `bet_place_lock:${userId}:${fingerprint}`;
  }

  private async enforceRateLimit(
    key: string,
    limit: number,
    windowSeconds: number,
    message: string,
  ) {
    const pipeline = this.redis.pipeline();
    pipeline.incr(key);
    pipeline.expire(key, windowSeconds);
    const results = await pipeline.exec();
    const currentCount = Number(results?.[0]?.[1] || 0);

    if (currentCount > limit) {
      throw new HttpException(message, HttpStatus.TOO_MANY_REQUESTS);
    }
  }

  private async acquireActionLock(
    key: string,
    ttlSeconds: number,
    message: string,
  ) {
    const result = await this.redis.set(key, '1', 'EX', ttlSeconds, 'NX');
    if (result !== 'OK') {
      throw new ConflictException(message);
    }
  }

  private async releaseActionLock(key?: string | null) {
    if (!key) return;

    try {
      await this.redis.del(key);
    } catch {
      // Best-effort cleanup only.
    }
  }

  private roundCurrency(value: number): number {
    return parseFloat(Number(value || 0).toFixed(2));
  }

  private resolveCashoutWalletField(
    bet: Pick<BetDocument, 'walletType' | 'betSource'>,
  ): BetWalletField {
    const betSource = String((bet as any).betSource || '');
    if (betSource.includes('sportsBonus')) {
      return 'sportsBonus';
    }

    return bet.walletType === 'crypto' ? 'cryptoBalance' : 'balance';
  }

  private getPrimaryWalletField(
    walletType: string | null | undefined,
  ): BetWalletField {
    return walletType === 'crypto' ? 'cryptoBalance' : 'balance';
  }

  private mapWalletFieldToPaymentMethod(walletField: BetWalletField) {
    if (walletField === 'sportsBonus') {
      return 'BONUS_WALLET';
    }

    return walletField === 'cryptoBalance' ? 'CRYPTO_WALLET' : 'MAIN_WALLET';
  }

  private getWalletFieldLabel(walletField: BetWalletField) {
    if (walletField === 'sportsBonus') {
      return 'Sports Bonus Wallet';
    }

    return walletField === 'cryptoBalance' ? 'Crypto Wallet' : 'Main Wallet';
  }

  private resolveWalletFieldFromTransaction(
    txn: Pick<any, 'paymentMethod' | 'paymentDetails'> | null | undefined,
  ): BetWalletField | null {
    const walletField = String(txn?.paymentDetails?.walletField || '').trim();
    if (
      walletField === 'balance' ||
      walletField === 'cryptoBalance' ||
      walletField === 'sportsBonus'
    ) {
      return walletField;
    }

    const paymentMethod = String(txn?.paymentMethod || '').toUpperCase();
    if (paymentMethod === 'CRYPTO_WALLET') return 'cryptoBalance';
    if (paymentMethod === 'BONUS_WALLET') return 'sportsBonus';
    if (paymentMethod === 'MAIN_WALLET' || paymentMethod === 'FIAT_WALLET') {
      return 'balance';
    }

    return null;
  }

  private sumAllocations(
    allocations: BetPayoutAllocation[],
  ): BetPayoutAllocation[] {
    const totals = new Map<BetWalletField, number>();

    for (const allocation of allocations) {
      if (!allocation.amount) continue;
      totals.set(
        allocation.walletField,
        this.roundCurrency(
          (totals.get(allocation.walletField) || 0) + allocation.amount,
        ),
      );
    }

    return Array.from(totals.entries()).map(([walletField, amount]) => ({
      walletField,
      walletLabel: this.getWalletFieldLabel(walletField),
      amount: this.roundCurrency(amount),
    }));
  }

  private getVoidRefundAllocations(bet: BetDocument): BetPayoutAllocation[] {
    const originalStake = this.getBetOriginalStake(bet);
    const bonusStakeAmount = this.roundCurrency(
      Number((bet as any).bonusStakeAmount || 0),
    );
    const walletStakeAmount = this.roundCurrency(
      Number((bet as any).walletStakeAmount || 0),
    );
    const primaryWalletField = this.getPrimaryWalletField(
      String(bet.walletType || ''),
    );

    const allocations: BetPayoutAllocation[] = [];

    if (bonusStakeAmount > 0) {
      allocations.push({
        walletField: 'sportsBonus',
        walletLabel: this.getWalletFieldLabel('sportsBonus'),
        amount: bonusStakeAmount,
      });
    }

    const primaryWalletAmount =
      walletStakeAmount > 0
        ? walletStakeAmount
        : Math.max(0, this.roundCurrency(originalStake - bonusStakeAmount));

    if (primaryWalletAmount > 0) {
      allocations.push({
        walletField: primaryWalletField,
        walletLabel: this.getWalletFieldLabel(primaryWalletField),
        amount: primaryWalletAmount,
      });
    }

    if (allocations.length === 0 && originalStake > 0) {
      allocations.push({
        walletField: primaryWalletField,
        walletLabel: this.getWalletFieldLabel(primaryWalletField),
        amount: originalStake,
      });
    }

    return this.sumAllocations(allocations);
  }

  private async getCashoutReversalAllocations(
    bet: BetDocument,
  ): Promise<BetPayoutAllocation[]> {
    const cashoutTransactions = await this.prisma.transaction.findMany({
      where: {
        userId: bet.userId,
        type: 'BET_CASHOUT',
        status: 'COMPLETED',
      },
      orderBy: { createdAt: 'asc' },
    });

    const relevantTransactions = cashoutTransactions.filter((txn) => {
      const paymentDetails = (txn.paymentDetails || {}) as Record<string, any>;
      return String(paymentDetails.betId || '') === String(bet._id);
    });

    const allocations: BetPayoutAllocation[] = [];

    for (const txn of relevantTransactions) {
      const paymentDetails = (txn.paymentDetails || {}) as Record<string, any>;
      const rawAllocations = Array.isArray(paymentDetails.allocations)
        ? paymentDetails.allocations
        : [];

      if (rawAllocations.length > 0) {
        for (const allocation of rawAllocations) {
          const walletField = this.resolveWalletFieldFromTransaction({
            paymentDetails: allocation,
            paymentMethod: null,
          });
          const amount = this.roundCurrency(Number(allocation?.amount || 0));
          if (!walletField || amount <= 0) continue;

          allocations.push({
            walletField,
            walletLabel: this.getWalletFieldLabel(walletField),
            amount,
          });
        }
        continue;
      }

      const fallbackWalletField =
        this.resolveWalletFieldFromTransaction(txn) ||
        this.resolveCashoutWalletField(bet);
      const fallbackAmount = this.roundCurrency(Number(txn.amount || 0));

      if (fallbackAmount > 0) {
        allocations.push({
          walletField: fallbackWalletField,
          walletLabel: this.getWalletFieldLabel(fallbackWalletField),
          amount: fallbackAmount,
        });
      }
    }

    return this.sumAllocations(allocations);
  }

  private async getWinReversalAllocations(
    bet: BetDocument,
  ): Promise<BetPayoutAllocation[]> {
    if (bet.status !== 'WON') {
      return [];
    }

    const winAmount = this.roundCurrency(Number(bet.potentialWin || 0));
    if (winAmount <= 0) {
      return [];
    }

    const winTransactions = await this.prisma.transaction.findMany({
      where: {
        userId: bet.userId,
        type: 'BET_WIN',
        status: 'COMPLETED',
        amount: winAmount,
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    });

    const matchedTransaction =
      winTransactions.find((txn) => {
        const paymentDetails = (txn.paymentDetails || {}) as Record<
          string,
          any
        >;
        if (String(paymentDetails.marketId || '') === String(bet.marketId)) {
          return true;
        }

        const remarks = String(txn.remarks || '');
        return (
          remarks.includes(String(bet.eventName || '')) &&
          remarks.includes(String(bet.selectionName || ''))
        );
      }) || winTransactions[0];

    const walletField =
      this.resolveWalletFieldFromTransaction(matchedTransaction) || 'balance';

    return [
      {
        walletField,
        walletLabel: this.getWalletFieldLabel(walletField),
        amount: winAmount,
      },
    ];
  }

  private getBetOriginalStake(
    bet: Pick<BetDocument, 'originalStake' | 'stake'>,
  ): number {
    return this.roundCurrency((bet as any).originalStake || bet.stake || 0);
  }

  private getBetOriginalPotentialWin(
    bet: Pick<BetDocument, 'originalPotentialWin' | 'potentialWin'>,
  ): number {
    return this.roundCurrency(
      (bet as any).originalPotentialWin ?? bet.potentialWin ?? 0,
    );
  }

  private getBetPartialCashoutValue(
    bet: Pick<BetDocument, 'partialCashoutValue'>,
  ): number {
    return this.roundCurrency((bet as any).partialCashoutValue ?? 0);
  }

  private normalizeCashoutValue(
    bet: Pick<BetDocument, 'potentialWin'>,
    proposedValue: number,
  ): number {
    return this.roundCurrency(
      Math.min(
        this.roundCurrency(Math.max(0, proposedValue)),
        this.roundCurrency(Math.max(0, Number(bet.potentialWin || 0))),
      ),
    );
  }

  private calculateBaseCashoutValue(
    bet: Pick<BetDocument, 'odds' | 'stake' | 'potentialWin'>,
    currentOdds: number,
  ): number {
    const originalOdds = Number(bet.odds || 0);
    const currentStake = this.roundCurrency(Number(bet.stake || 0));

    if (currentStake <= 0 || currentOdds <= 1 || originalOdds <= 1) {
      return 0;
    }

    // 30% odds move -> 10% cashout move, then apply a 5% house cut.
    // Examples:
    //   2.0 -> 1.4  => +10% cashout, then 5% cut
    //   2.0 -> 2.6  => -10% cashout, then 5% cut
    const oddsChangePercent = (currentOdds - originalOdds) / originalOdds;
    const cashoutAdjustmentPercent = -oddsChangePercent / 3;
    const houseCut = 0.95;

    return this.roundCurrency(
      currentStake * (1 + cashoutAdjustmentPercent) * houseCut,
    );
  }

  private getBetBonusStakeAmount(
    bet: Pick<BetDocument, 'betSource' | 'originalStake' | 'stake'>,
  ): number {
    const storedBonusStake = this.roundCurrency(
      Number((bet as any).bonusStakeAmount ?? 0),
    );
    if (storedBonusStake > 0) {
      return storedBonusStake;
    }

    const betSource = String((bet as any).betSource || '');
    return betSource.includes('sportsBonus')
      ? this.getBetOriginalStake(bet)
      : 0;
  }

  private buildBetPayoutAllocations(
    bet: Pick<
      BetDocument,
      'walletType' | 'betSource' | 'originalStake' | 'stake'
    >,
    amount: number,
  ): BetPayoutAllocation[] {
    const payoutAmount = this.roundCurrency(amount);
    if (payoutAmount <= 0) {
      return [];
    }

    const primaryWalletField = this.getPrimaryWalletField(bet.walletType);
    const originalStake = this.getBetOriginalStake(bet);
    const bonusStakeAmount = Math.min(
      originalStake,
      this.getBetBonusStakeAmount(bet),
    );
    const walletStakeAmount = this.roundCurrency(
      Math.max(0, originalStake - bonusStakeAmount),
    );

    if (bonusStakeAmount <= 0 || originalStake <= 0) {
      return [
        {
          walletField: primaryWalletField,
          walletLabel: this.getWalletFieldLabel(primaryWalletField),
          amount: payoutAmount,
        },
      ];
    }

    if (walletStakeAmount <= 0) {
      return [
        {
          walletField: 'sportsBonus',
          walletLabel: this.getWalletFieldLabel('sportsBonus'),
          amount: payoutAmount,
        },
      ];
    }

    const bonusPayout = this.roundCurrency(
      (payoutAmount * bonusStakeAmount) / originalStake,
    );
    const walletPayout = this.roundCurrency(payoutAmount - bonusPayout);

    const allocations: BetPayoutAllocation[] = [
      {
        walletField: 'sportsBonus',
        walletLabel: this.getWalletFieldLabel('sportsBonus'),
        amount: bonusPayout,
      },
      {
        walletField: primaryWalletField,
        walletLabel: this.getWalletFieldLabel(primaryWalletField),
        amount: walletPayout,
      },
    ];

    return allocations.filter((allocation) => allocation.amount > 0);
  }

  private isEventPreMatch(
    event: Pick<EventDocument, 'match_status'> | null | undefined,
  ): boolean {
    if (!event) return false;
    const status = this.normalizeSportsStatus(event?.match_status);
    return ![
      'INPLAY',
      'IN_PLAY',
      'LIVE',
      'COMPLETED',
      'ENDED',
      'FINISHED',
      'ABANDONED',
      'CLOSED',
      'SETTLED',
    ].includes(status);
  }

  private normalizeSportsStatus(value: unknown): string {
    return String(value ?? '')
      .trim()
      .toUpperCase()
      .replace(/[\s-]+/g, '_');
  }

  private isClosedSportsEventStatus(value: unknown): boolean {
    return [
      'CLOSED',
      'COMPLETED',
      'ENDED',
      'FINISHED',
      'ABANDONED',
      'SETTLED',
    ].includes(this.normalizeSportsStatus(value));
  }

  /**
   * Returns true if the event status indicates the match was dismissed,
   * abandoned, cancelled, postponed, or otherwise did not complete normally.
   * Bets on such events must be VOIDED, never settled as WON/LOST.
   */
  private isDismissedEventStatus(value: unknown): boolean {
    return [
      'ABANDONED',
      'DISMISSED',
      'CANCELLED',
      'CANCELED',
      'POSTPONED',
      'WALKOVER',
      'NO_RESULT',
      'VOID',
      'VOIDED',
      'RETIRED',
      'INTERRUPTED',
    ].includes(this.normalizeSportsStatus(value));
  }

  private isSportradarEventClosed(
    event:
      | { status?: string | null; eventStatus?: string | null }
      | null
      | undefined,
  ): boolean {
    return (
      this.isClosedSportsEventStatus(event?.status) ||
      this.isClosedSportsEventStatus(event?.eventStatus)
    );
  }

  private getSportradarEventMarkets(event: { markets?: any } | null | undefined): any[] {
    const markets = event?.markets || {};

    return [
      ...(Array.isArray(markets.matchOdds) ? markets.matchOdds : []),
      ...(Array.isArray(markets.premiumMarkets) ? markets.premiumMarkets : []),
      ...(Array.isArray(markets.bookmakers) ? markets.bookmakers : []),
      ...(Array.isArray(markets.fancyMarkets) ? markets.fancyMarkets : []),
    ];
  }

  private isSportradarMarketOpen(market: any): boolean {
    return (
      this.normalizeSportsStatus(market?.status) === 'ACTIVE' ||
      this.normalizeSportsStatus(market?.marketStatus) === 'OPEN'
    );
  }

  private isSportradarRunnerActive(runner: any): boolean {
    return this.normalizeSportsStatus(
      runner?.status ?? runner?.runnerStatus,
    ) === 'ACTIVE';
  }

  private matchesMarketId(candidateId: unknown, marketId: string): boolean {
    if (candidateId === null || candidateId === undefined) return false;
    const candidate = String(candidateId);
    return candidate === marketId || marketId.endsWith(`_${candidate}`);
  }

  private isExplicitOpenState(value: unknown): boolean {
    if (value === 1 || value === 9) return true;
    const normalized = String(value ?? '')
      .trim()
      .toUpperCase();
    return (
      normalized === '1' ||
      normalized === '9' ||
      normalized === 'OPEN' ||
      normalized === 'ACTIVE' ||
      normalized === 'BALL RUNNING'
    );
  }

  private isExplicitSuspendedState(value: unknown): boolean {
    if (value === 2 || value === 3 || value === 4) return true;
    const normalized = String(value ?? '')
      .trim()
      .toUpperCase();
    return ['2', '3', '4', 'SUSPENDED', 'CLOSED', 'INACTIVE'].includes(
      normalized,
    );
  }

  private isMarketSuspended(market: any): boolean {
    if (!market) return true;

    const status = market?.status ?? market?.market_status;
    const marketStatus =
      market?.marketStatus ?? market?.ms ?? market?.source_market_status_id;

    if (
      this.isExplicitSuspendedState(status) ||
      this.isExplicitSuspendedState(marketStatus)
    ) {
      return true;
    }

    if (market?.is_active === false) {
      const explicitlyOpen =
        this.isExplicitOpenState(status) ||
        this.isExplicitOpenState(marketStatus);
      if (!explicitlyOpen) {
        return true;
      }
    }

    return false;
  }

  private parsePositiveOdds(value: unknown): number | null {
    const parsed = parseFloat(String(value ?? ''));
    return Number.isFinite(parsed) && parsed > 1 ? parsed : null;
  }

  private parsePositiveSize(value: unknown): number | null {
    const parsed = parseFloat(String(value ?? ''));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  private pickBestQuote(entries: any[], betType: string): MarketQuote | null {
    if (!Array.isArray(entries) || entries.length === 0) return null;

    const wantsBack = betType !== 'lay';
    const quotes = entries
      .filter((entry: any) => {
        if (entry?.ib === true) return wantsBack;
        if (entry?.ib === false) return !wantsBack;

        const entryType = String(
          entry?.otype ?? entry?.type ?? entry?.side ?? '',
        ).toLowerCase();
        if (entryType === 'back') return wantsBack;
        if (entryType === 'lay') return !wantsBack;

        return false;
      })
      .map((entry: any, index: number) => {
        const odds = this.parsePositiveOdds(
          entry?.odds ?? entry?.rt ?? entry?.price,
        );
        if (!odds) return null;

        const size = this.parsePositiveSize(
          entry?.size ?? entry?.bv ?? entry?.amount ?? entry?.volume,
        );
        const levelCandidate =
          entry?.tno ?? entry?.pr ?? entry?.level ?? entry?.position;
        const level = Number.isFinite(Number(levelCandidate))
          ? Number(levelCandidate)
          : index;

        return { odds, rate: size, level };
      })
      .filter(Boolean) as Array<MarketQuote & { level: number }>;

    if (quotes.length === 0) return null;

    quotes.sort((a, b) => a.level - b.level);
    return {
      odds: quotes[0].odds,
      rate: quotes[0].rate,
    };
  }

  private pickBestBackOdds(entries: any[]): number | null {
    if (!Array.isArray(entries) || entries.length === 0) return null;

    const backs = entries
      .filter(
        (entry: any) =>
          entry?.ib === true ||
          entry?.otype === 'back' ||
          entry?.type === 'back',
      )
      .map((entry: any, index: number) => {
        const price = this.parsePositiveOdds(
          entry?.odds ?? entry?.rt ?? entry?.price,
        );
        const level = Number.isFinite(Number(entry?.pr))
          ? Number(entry.pr)
          : index;
        return price ? { price, level } : null;
      })
      .filter(Boolean) as { price: number; level: number }[];

    if (backs.length === 0) return null;

    backs.sort((a, b) => a.level - b.level);
    return backs[0].price;
  }

  private getRunnerSelectionId(runner: any): string | null {
    const rawId =
      runner?.sid ??
      runner?.selectionId ??
      runner?.selection_id ??
      runner?.id ??
      runner?.ri ??
      runner?.RunnerID;

    if (rawId === null || rawId === undefined || rawId === '') return null;
    return String(rawId);
  }

  private extractOddsFromRunner(runner: any): number | null {
    const oddsFromArray = this.pickBestBackOdds(
      Array.isArray(runner?.odds) ? runner.odds : [],
    );
    if (oddsFromArray) return oddsFromArray;

    const oddsFromBackArray = this.pickBestBackOdds(
      Array.isArray(runner?.back)
        ? runner.back.map((entry: any) => ({
            ...entry,
            otype: 'back',
          }))
        : [],
    );
    if (oddsFromBackArray) return oddsFromBackArray;

    const directBack =
      this.parsePositiveOdds(runner?.back1) ??
      this.parsePositiveOdds(runner?.b1) ??
      this.parsePositiveOdds(runner?.BackPrice1) ??
      this.parsePositiveOdds(runner?.back0_price) ??
      this.parsePositiveOdds(runner?.back1_price) ??
      this.parsePositiveOdds(runner?.back2_price);
    if (directBack) return directBack;

    return (
      this.parsePositiveOdds(runner?.ltp) ??
      this.parsePositiveOdds(runner?.LTP) ??
      this.parsePositiveOdds(runner?.LastPrice)
    );
  }

  private extractQuoteFromRunner(
    runner: any,
    betType: string,
  ): MarketQuote | null {
    const oddsQuote = this.pickBestQuote(
      Array.isArray(runner?.odds) ? runner.odds : [],
      betType,
    );
    if (oddsQuote) return oddsQuote;

    const directionalEntries = Array.isArray(
      betType === 'lay' ? runner?.lay : runner?.back,
    )
      ? (betType === 'lay' ? runner.lay : runner.back).map((entry: any) => ({
          ...entry,
          otype: betType,
        }))
      : [];
    const directionalQuote = this.pickBestQuote(directionalEntries, betType);
    if (directionalQuote) return directionalQuote;

    const price = [
      betType === 'lay' ? runner?.lay1 : runner?.back1,
      betType === 'lay' ? runner?.l1 : runner?.b1,
      betType === 'lay' ? runner?.LayPrice1 : runner?.BackPrice1,
      betType === 'lay' ? runner?.lay0_price : runner?.back0_price,
      betType === 'lay' ? runner?.lay1_price : runner?.back1_price,
      betType === 'lay' ? runner?.lay2_price : runner?.back2_price,
    ]
      .map((value) => this.parsePositiveOdds(value))
      .find(Boolean);

    if (!price) return null;

    const size = [
      betType === 'lay' ? runner?.ls1 : runner?.bs1,
      betType === 'lay' ? runner?.lay0_size : runner?.back0_size,
      betType === 'lay' ? runner?.lay1_size : runner?.back1_size,
      betType === 'lay' ? runner?.lay2_size : runner?.back2_size,
      betType === 'lay' ? runner?.ls : runner?.bs,
    ]
      .map((value) => this.parsePositiveSize(value))
      .find(Boolean);

    return {
      odds: price,
      rate: size,
    };
  }

  private extractCurrentOddsFromMarket(
    market: any,
    selectionId: string,
  ): number | null {
    if (!market) return null;

    if (Array.isArray(market?.rt)) {
      const matchingUpdates = (market.rt || []).filter((runner: any) => {
        const runnerId = this.getRunnerSelectionId(runner);
        return runnerId !== null && runnerId === String(selectionId);
      });

      const socketPrice = this.pickBestBackOdds(matchingUpdates);
      if (socketPrice) return socketPrice;
    }

    const runnerCollections = [
      market?.section,
      market?.runners_data,
      market?.marketOdds,
    ];
    for (const runners of runnerCollections) {
      if (!Array.isArray(runners)) continue;

      for (const runner of runners) {
        const runnerId = this.getRunnerSelectionId(runner);
        if (runnerId !== String(selectionId)) continue;

        const price = this.extractOddsFromRunner(runner);
        if (price) return price;
      }
    }

    return (
      this.parsePositiveOdds(market?.b1) ??
      this.parsePositiveOdds(market?.BackPrice1)
    );
  }

  private extractCurrentQuoteFromMarket(
    market: any,
    selectionId: string,
    betType: string,
  ): MarketQuote | null {
    if (!market) return null;

    if (Array.isArray(market?.rt)) {
      const matchingUpdates = (market.rt || []).filter((runner: any) => {
        const runnerId = this.getRunnerSelectionId(runner);
        return runnerId !== null && runnerId === String(selectionId);
      });

      const socketQuote = this.pickBestQuote(matchingUpdates, betType);
      if (socketQuote) return socketQuote;
    }

    const runnerCollections = [
      market?.section,
      market?.runners_data,
      market?.marketOdds,
    ];
    for (const runners of runnerCollections) {
      if (!Array.isArray(runners)) continue;

      for (const runner of runners) {
        const runnerId = this.getRunnerSelectionId(runner);
        if (runnerId !== String(selectionId)) continue;

        const quote = this.extractQuoteFromRunner(runner, betType);
        if (quote) return quote;
      }
    }

    const fallbackOdds =
      betType === 'lay'
        ? (this.parsePositiveOdds(market?.l1) ??
          this.parsePositiveOdds(market?.LayPrice1))
        : (this.parsePositiveOdds(market?.b1) ??
          this.parsePositiveOdds(market?.BackPrice1));

    if (!fallbackOdds) return null;

    const fallbackSize =
      betType === 'lay'
        ? this.parsePositiveSize(market?.ls1)
        : this.parsePositiveSize(market?.bs1);

    return {
      odds: fallbackOdds,
      rate: fallbackSize,
    };
  }

  private findMatchingMarket(markets: any[], marketId: string): any | null {
    if (!Array.isArray(markets)) return null;

    return (
      markets.find((market: any) => {
        const candidateIds = [
          market?.mid,
          market?.market_id,
          market?.id,
          market?.bmi,
        ];
        return candidateIds.some((candidateId) =>
          this.matchesMarketId(candidateId, marketId),
        );
      }) || null
    );
  }

  private async loadEventMarketsSnapshot(
    eventId: string,
  ): Promise<any[] | null> {
    if (!eventId) return null;

    try {
      const cached = await this.redis.get(`odds:${eventId}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Best-effort only: cashout should still work off MongoDB when Redis misses.
    }

    try {
      const event = (await this.eventModel
        .findOne({ event_id: eventId })
        .select('sport_id')
        .lean()) as any;
      const sportId = String(event?.sport_id || 4);
      const url = `${this.SPORTS_BASE_URL}/api/v1/sports/odds?gmid=${eventId}&sportsid=${sportId}`;
      const resp = await firstValueFrom(
        this.httpService.get(url, {
          headers: { 'x-turnkeyxgaming-key': this.SPORTS_API_KEY },
          timeout: 3000,
        }),
      );
      const oddsMap = resp.data?.data?.odds;
      const liveMarkets = oddsMap?.[eventId];
      return Array.isArray(liveMarkets) ? liveMarkets : null;
    } catch {
      return null;
    }
  }

  private async resolveCashoutMarketState(
    eventId: string,
    marketId: string,
    selectionId: string,
  ): Promise<{
    market: any | null;
    currentOdds: number | null;
    suspended: boolean;
  }> {
    if (String(eventId || '').toLowerCase().startsWith('sr:')) {
      try {
        // ── Try primary cache key (updated every ~1s by liveOddsTick) ──────
        let marketResult: any = null;
        const primaryCached = await this.redis.get(`sportradar:market:${eventId}`).catch(() => null);
        if (primaryCached) {
          try { marketResult = JSON.parse(primaryCached); } catch { /* ignore */ }
        }

        // ── Fallback: sportradar:odds:{eventId} (longer-lived) ────────────
        if (!marketResult) {
          const oddsCached = await this.redis.get(`sportradar:odds:${eventId}`).catch(() => null);
          if (oddsCached) {
            try {
              const parsed = JSON.parse(oddsCached);
              // This key stores the raw markets object (matchOdds, premiumMarkets, …)
              // Wrap it to match the marketResult shape expected below
              marketResult = { event: { markets: parsed } };
            } catch { /* ignore */ }
          }
        }

        if (marketResult?.event?.markets) {
          const markets = marketResult.event.markets;
          const allMarkets = [
            ...(markets.matchOdds     || []).map((m: any) => ({ ...m, _inferredType: 'match_odds' })),
            ...(markets.bookmakers    || []).map((m: any) => ({ ...m, _inferredType: 'bookmaker' })),
            ...(markets.fancyMarkets  || []).map((m: any) => ({ ...m, _inferredType: 'fancy' })),
            ...(markets.premiumMarkets || []).map((m: any) => ({ ...m, _inferredType: 'premium' })),
          ];

          const marketDoc = allMarkets.find((m: any) => String(m.marketId) === String(marketId));
          if (marketDoc) {
            const runner = (marketDoc.runners ?? []).find(
              (r: any) => String(r.runnerId) === String(selectionId),
            );

            // SR runners store current price in backPrices[0].price, NOT in .odds/.rt
            const backPrice = runner?.backPrices?.[0]?.price;
            const currentOdds = backPrice != null && Number(backPrice) > 1
              ? Number(backPrice)
              : null;

            const isMarketSuspended =
              marketDoc.marketStatus === 'SUSPENDED' ||
              marketDoc.status       === 'Suspended';
            const isRunnerSuspended =
              runner &&
              runner.runnerStatus !== undefined &&
              runner.runnerStatus !== 'Active';

            return {
              market: {
                ...marketDoc,
                market_type: marketDoc._inferredType || 'match_odds',
                provider:    'sportradar',
              },
              currentOdds,
              suspended: isMarketSuspended || isRunnerSuspended,
            };
          }
        }
      } catch (e) {
        this.logger.warn(`[SR CashOut] resolveCashoutMarketState error for ${eventId}: ${(e as any)?.message}`);
      }

      // Market not found in either cache key — treat as unavailable (not suspended)
      // so the UI shows "unavailable" rather than "suspended" (better UX)
      return { market: null, currentOdds: null, suspended: false };
    }

    const socketMarket = this.sportsSocketService.getLiveOdds(marketId);
    if (socketMarket) {
      const currentOdds = this.extractCurrentOddsFromMarket(
        socketMarket,
        selectionId,
      );
      const suspended = this.isMarketSuspended(socketMarket);
      if (currentOdds || suspended) {
        return { market: socketMarket, currentOdds, suspended };
      }
    }

    const liveMarkets = await this.loadEventMarketsSnapshot(eventId);
    const liveMarket = this.findMatchingMarket(liveMarkets || [], marketId);
    if (liveMarket) {
      const currentOdds = this.extractCurrentOddsFromMarket(
        liveMarket,
        selectionId,
      );
      const suspended = this.isMarketSuspended(liveMarket);
      if (currentOdds || suspended) {
        return { market: liveMarket, currentOdds, suspended };
      }
    }

    const dbMarket = await this.marketModel
      .findOne({ market_id: marketId })
      .lean();
    if (!dbMarket) {
      return { market: null, currentOdds: null, suspended: true };
    }

    return {
      market: dbMarket,
      currentOdds: this.extractCurrentOddsFromMarket(dbMarket, selectionId),
      suspended: this.isMarketSuspended(dbMarket),
    };
  }

  /**
   * POST to Diamond API /api/v1/post-market with 3 immediate retries.
   * Uses getMarketNameFromGtype (turnkeyxgaming spec) to build marketName.
   * If all retries fail, saves job to DiamondPostQueue for cron retry.
   */
  private async postMarketToDiamond(betData: any, event: any) {
    const sportsId = betData.sportsId || event?.sport_id || betData.sportId || 4;
    const market = (await this.marketModel
      .findOne({ market_id: betData.marketId })
      .lean()) as any;
    const rawGtype = (
      betData.gtype ||
      market?.gtype ||
      market?.market_type ||
      'match'
    ).toLowerCase();

    let mname = betData.mname || market?.mname || market?.market_name || betData.marketName || '';
    if (mname.toUpperCase() === 'NORMAL') {
        mname = betData.marketName || market?.market_name || betData.selectionName || '';
    }

    // For match/match1: build from runners_data (section)
    //   nat = betData.selectionName  ← this is the runner's nat value from Diamond API
    //   (market.nat doesn't exist at market level — nat is per-section in the API response)
    const isMatchType = rawGtype === 'match' || rawGtype === 'match1';
    const nat = isMatchType
      ? '' // not used for match — section provides the runner names
      : betData.selectionName || betData.marketName || '';
    const section = isMatchType ? market?.runners_data || [] : [];

    const computedName = this.getMarketNameFromGtype({
      mname,
      gtype: rawGtype,
      nat,
      section,
    });
    const marketName =
      computedName || betData.selectionName || betData.marketName || nat || '';

    const payload = {
      sportsid: Number(sportsId),
      gmid: String(betData.eventId),
      marketName,
      mname,
      gtype: rawGtype.toUpperCase(),
    };

    const url = `${this.SPORTS_BASE_URL}/api/v1/post-market`;
    const RETRIES = 3;

    for (let attempt = 1; attempt <= RETRIES; attempt++) {
      try {
        this.logger.log(
          `[postMarket] Attempt ${attempt}/${RETRIES} → ${url} ${JSON.stringify(payload)}`,
        );

        const resp = await firstValueFrom(
          this.httpService.post(url, payload, {
            headers: { 'x-turnkeyxgaming-key': this.SPORTS_API_KEY },
            timeout: 5000,
          }),
        );

        this.logger.log(
          `[postMarket] ✓ Success on attempt ${attempt}, gmid=${payload.gmid}, response=${JSON.stringify(resp.data)}`,
        );
        return; // success — done
      } catch (err) {
        const errMsg = err?.response?.data
          ? JSON.stringify(err.response.data).substring(0, 500)
          : err.message;

        this.logger.warn(`[postMarket] Attempt ${attempt} failed: ${errMsg}`);

        if (attempt < RETRIES) {
          // Short exponential back-off: 1s, 2s before next retry
          await new Promise((res) => setTimeout(res, attempt * 1000));
        } else {
          // All inline retries exhausted — persist to queue for cron retry
          try {
            await this.prisma.diamondPostQueue.create({
              data: {
                sportsid: payload.sportsid,
                gmid: payload.gmid,
                marketName: payload.marketName,
                mname: payload.mname,
                gtype: payload.gtype,
                attempts: RETRIES,
                status: 'PENDING',
                lastError: errMsg,
              },
            });
            this.logger.warn(
              `[postMarket] Saved to DiamondPostQueue for cron retry (gmid=${payload.gmid})`,
            );
          } catch (dbErr) {
            this.logger.error(
              `[postMarket] Failed to save to queue: ${dbErr.message}`,
            );
          }
        }
      }
    }
  }

  async getUserBets(userId: number) {
    const bets = await this.betModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .exec();
    return bets.map((b) => {
      const obj: any = { ...b.toObject(), id: b._id.toString() };
      // ── Flatten snapshot into oddsInfo for frontend display ───────────────
      // snapshot is set on Sportradar bets; Diamond bets won't have it.
      const snap = obj.snapshot;
      if (snap && typeof snap === 'object') {
        obj.oddsInfo = {
          provider:       snap.providerName ?? 'DIAMOND',
          acceptedOdds:   snap.odds         ?? obj.odds,
          submittedOdds:  snap.submittedOdds ?? null,   // null = no drift
          decimalOdds:    snap.decimalOdds   ?? obj.odds,
          profit:         snap.profit        ?? null,
          marketType:     snap.marketType    ?? null,
          oddsAdjusted:   snap.submittedOdds != null && snap.submittedOdds !== snap.odds,
        };
      } else {
        obj.oddsInfo = {
          provider:      'DIAMOND',
          acceptedOdds:  obj.odds,
          submittedOdds: null,
          oddsAdjusted:  false,
        };
      }
      return obj;
    });
  }

  // --- Admin Methods ---

  async getAllBets(page: number, limit: number, filters: any = {}) {
    const skip = (page - 1) * limit;
    const query: any = {};

    if (filters.search) {
      const searchTerm = String(filters.search).trim();
      const matchingUsers = searchTerm
        ? await this.prisma.user.findMany({
            where: {
              username: {
                contains: searchTerm,
              },
            },
            select: { id: true },
            take: 50,
          })
        : [];
      const matchingUserIds = matchingUsers.map((user) => user.id);

      // Can search by betId, username (if we join/store), or eventName
      // Storing username/email on bet would be better for performance, but until then
      // we resolve matching user ids from Prisma and blend that into the Mongo query.
      query.$or = [
        { eventName: { $regex: searchTerm, $options: 'i' } },
        { marketName: { $regex: searchTerm, $options: 'i' } },
        { selectionName: { $regex: searchTerm, $options: 'i' } },
        ...(matchingUserIds.length > 0
          ? [{ userId: { $in: matchingUserIds } }]
          : []),
      ];

      if (/^\d+$/.test(searchTerm)) {
        query.$or.push({ userId: Number(searchTerm) });
      }
    }

    if (Array.isArray(filters.statusIn) && filters.statusIn.length > 0) {
      query.status = { $in: filters.statusIn };
    } else if (filters.status && filters.status !== 'ALL') {
      query.status = filters.status;
    }

    if (filters.userId) {
      query.userId = Number(filters.userId);
    }

    const [bets, total] = await Promise.all([
      this.betModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.betModel.countDocuments(query),
    ]);

    const uniqueUserIds = Array.from(
      new Set(
        bets
          .map((bet) => Number(bet.userId))
          .filter((userId) => Number.isFinite(userId) && userId > 0),
      ),
    );

    const users = uniqueUserIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: uniqueUserIds } },
          select: { id: true, username: true },
        })
      : [];
    const usernameByUserId = new Map(
      users.map((user) => [user.id, user.username || null]),
    );

    return {
      bets: bets.map((b) => ({
        ...b.toObject(),
        id: b._id.toString(),
        username: usernameByUserId.get(Number(b.userId)) || null,
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async cancelBet(betId: string, adminId: number) {
    // ... (existing cancelBet code)
    // 1. Find Bet
    const bet = await this.betModel.findById(betId);
    if (!bet) throw new BadRequestException('Bet not found');
    if (bet.status !== 'PENDING')
      throw new BadRequestException('Can only cancel PENDING bets');

    const userId = bet.userId;
    const refundAllocations = this.getVoidRefundAllocations(bet);
    const refundAmount = this.roundCurrency(
      refundAllocations.reduce(
        (sum, allocation) => sum + allocation.amount,
        0,
      ),
    );
    const userUpdateData: Record<string, any> = {
      exposure: { decrement: refundAmount },
    };

    for (const allocation of refundAllocations) {
      userUpdateData[allocation.walletField] = { increment: allocation.amount };
    }

    const refundPaymentMethod =
      refundAllocations.length === 1
        ? this.mapWalletFieldToPaymentMethod(refundAllocations[0].walletField)
        : 'MULTI_WALLET';

    // 2. Transactional Refund
    return await this.prisma.$transaction(async (prisma) => {
      // A. Refund Balance & Reduce Exposure (use updateMany to tolerate missing user)
      const userUpdated = await prisma.user.updateMany({
        where: { id: userId },
        data: userUpdateData,
      });

      if (userUpdated.count === 0) {
        console.warn(`[BetCancel] User ${userId} not found — bet ${betId} voided but wallet not refunded`);
      }

      // B. Create Transaction Record (Refund) — only if user exists
      if (userUpdated.count > 0) {
        await prisma.transaction.create({
          data: {
            userId,
            amount: refundAmount,
            type: 'BET_REFUND',
            status: 'COMPLETED',
            paymentMethod: refundPaymentMethod,
            paymentDetails: {
              source: 'BET_CANCEL',
              walletField:
                refundAllocations.length === 1
                  ? refundAllocations[0].walletField
                  : null,
              allocations: refundAllocations,
              betId: String(bet._id),
            },
            remarks: `Bet Voided by Admin (ID: ${betId})`,
            adminId,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        });
      }

      // C. Update Bet Status in Mongo
      bet.status = 'VOID';
      // @ts-ignore
      bet.settledReason =
        'Bet was voided by admin and the full stake was refunded.';
      // @ts-ignore
      bet.settledAt = new Date();
      await bet.save();

      // D. Remove from Redis active bets
      await this.redis.srem(`active_bets:${userId}`, betId);

      return { ...bet.toObject(), id: bet._id.toString() };
    });
  }

  async voidEventBets(
    eventId: string,
    adminId: number,
    reason?: string,
  ): Promise<EventVoidSummary> {
    const normalizedEventId = this.normalizeText(eventId);
    if (!normalizedEventId) {
      throw new BadRequestException('eventId is required');
    }

    const normalizedReason = this.normalizeText(reason);
    if (!normalizedReason) {
      throw new BadRequestException(
        'A reason is required to super void an event',
      );
    }

    const bets = await this.betModel.find({
      $or: [{ eventId: normalizedEventId }, { matchId: normalizedEventId }],
    });

    if (bets.length === 0) {
      throw new BadRequestException('No bets found for this event');
    }

    const summary: EventVoidSummary = {
      total: bets.length,
      voided: 0,
      alreadyVoided: 0,
      reversedAmount: 0,
      refundedAmount: 0,
      errors: [],
    };

    for (const bet of bets) {
      if (bet.status === 'VOID') {
        summary.alreadyVoided += 1;
        continue;
      }

      try {
        const previousStatus = String(bet.status || 'PENDING');
        const originalStake = this.getBetOriginalStake(bet);
        const originalPotentialWin = this.getBetOriginalPotentialWin(bet);
        const remainingExposure =
          previousStatus === 'PENDING'
            ? this.roundCurrency(Number(bet.stake || 0))
            : 0;

        const [cashoutReversals, winReversals] = await Promise.all([
          this.getCashoutReversalAllocations(bet),
          this.getWinReversalAllocations(bet),
        ]);

        const reversalAllocations = this.sumAllocations([
          ...cashoutReversals,
          ...winReversals,
        ]);
        const refundAllocations = this.getVoidRefundAllocations(bet);
        const totalReversed = this.roundCurrency(
          reversalAllocations.reduce(
            (sum, allocation) => sum + allocation.amount,
            0,
          ),
        );
        const totalRefunded = this.roundCurrency(
          refundAllocations.reduce(
            (sum, allocation) => sum + allocation.amount,
            0,
          ),
        );

        const walletDeltas = new Map<BetWalletField, number>();
        for (const allocation of refundAllocations) {
          walletDeltas.set(
            allocation.walletField,
            this.roundCurrency(
              (walletDeltas.get(allocation.walletField) || 0) +
                allocation.amount,
            ),
          );
        }
        for (const allocation of reversalAllocations) {
          walletDeltas.set(
            allocation.walletField,
            this.roundCurrency(
              (walletDeltas.get(allocation.walletField) || 0) -
                allocation.amount,
            ),
          );
        }

        const userUpdateData: Record<string, any> = {};
        for (const [walletField, amount] of walletDeltas.entries()) {
          if (amount > 0) {
            userUpdateData[walletField] = { increment: amount };
          } else if (amount < 0) {
            userUpdateData[walletField] = { decrement: Math.abs(amount) };
          }
        }
        if (remainingExposure > 0) {
          userUpdateData.exposure = { decrement: remainingExposure };
        }

        const reasonForHistory = [
          `Event super void applied by admin.`,
          `Reason: ${normalizedReason}.`,
          `Previous status: ${previousStatus}.`,
          totalReversed > 0
            ? `Reversed previous returns ₹${totalReversed.toFixed(2)}.`
            : null,
          `Refunded original stake ₹${totalRefunded.toFixed(2)}.`,
        ]
          .filter(Boolean)
          .join(' ');

        await this.prisma.$transaction(async (prisma) => {
          let userExists = true;
          if (
            Object.keys(userUpdateData).length > 0 &&
            (totalRefunded > 0 || totalReversed > 0 || remainingExposure > 0)
          ) {
            const updated = await prisma.user.updateMany({
              where: { id: bet.userId },
              data: userUpdateData,
            });
            if (updated.count === 0) {
              console.warn(`[SuperVoid] User ${bet.userId} not found — bet ${bet._id} voided but wallet not updated`);
              userExists = false;
            }
          }

          if (!userExists) {
            // Still mark the bet as voided in Mongo (below), but skip transaction records
            bet.status = 'VOID';
            // @ts-ignore
            bet.settledReason = reasonForHistory;
            // @ts-ignore
            bet.settledAt = new Date();
            await bet.save();
            return;
          }

          for (const allocation of reversalAllocations) {
            await prisma.transaction.create({
              data: {
                userId: bet.userId,
                amount: allocation.amount,
                type: 'BET_VOID_DEBIT',
                status: 'COMPLETED',
                paymentMethod: this.mapWalletFieldToPaymentMethod(
                  allocation.walletField,
                ),
                paymentDetails: {
                  source: 'BET_EVENT_SUPER_VOID',
                  direction: 'DEBIT',
                  walletField: allocation.walletField,
                  walletLabel: allocation.walletLabel,
                  betId: String(bet._id),
                  eventId: normalizedEventId,
                  previousStatus,
                },
                remarks: `Super void reversal: ${bet.eventName} — ${bet.selectionName}. ${normalizedReason}`,
                adminId,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            });
          }

          for (const allocation of refundAllocations) {
            await prisma.transaction.create({
              data: {
                userId: bet.userId,
                amount: allocation.amount,
                type: 'BET_REFUND',
                status: 'COMPLETED',
                paymentMethod: this.mapWalletFieldToPaymentMethod(
                  allocation.walletField,
                ),
                paymentDetails: {
                  source: 'BET_EVENT_SUPER_VOID',
                  tag: 'EVENT_VOID_REFUND',
                  walletField: allocation.walletField,
                  walletLabel: allocation.walletLabel,
                  betId: String(bet._id),
                  eventId: normalizedEventId,
                  previousStatus,
                },
                remarks: `Super void refund: ${bet.eventName} — ${bet.selectionName}. ${normalizedReason}`,
                adminId,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            });
          }
        });

        bet.status = 'VOID';
        bet.originalStake = originalStake;
        bet.stake = originalStake;
        bet.originalPotentialWin = originalPotentialWin;
        bet.potentialWin = originalPotentialWin;
        (bet as any).partialCashoutValue = 0;
        (bet as any).partialCashoutCount = 0;
        (bet as any).lastPartialCashoutAt = undefined;
        bet.cashoutValue = undefined as any;
        bet.cashedOutAt = undefined as any;
        bet.settledReason = reasonForHistory;
        bet.settledAt = new Date();
        await bet.save();

        await this.redis.srem(`active_bets:${bet.userId}`, bet._id.toString());

        summary.voided += 1;
        summary.reversedAmount = this.roundCurrency(
          summary.reversedAmount + totalReversed,
        );
        summary.refundedAmount = this.roundCurrency(
          summary.refundedAmount + totalRefunded,
        );
        this.bonusService.emitWalletRefresh(bet.userId);
      } catch (error) {
        summary.errors.push({
          betId: String(bet._id),
          error:
            error instanceof Error
              ? error.message
              : 'Failed to void settled bet',
        });
      }
    }

    return summary;
  }

  async settleMarket(
    marketId: string,
    winningSelectionId: string,
    adminId: number,
    eventId?: string,
  ) {
    await this.maintenanceService.assertScopeAvailable(
      'sports',
      'Sports settlement is paused while maintenance mode is active.',
      adminId,
    );

    const marketFilters: Record<string, string>[] = [{ marketId }];
    if (eventId?.trim()) {
      marketFilters.push({ srMarketFullId: marketId });
    }

    const eventFilters: Record<string, string>[] = eventId?.trim()
      ? [{ eventId }, { matchId: eventId }, { srEventId: eventId }]
      : [];

    const bets = await this.betModel.find({
      status: 'PENDING',
      $and: [
        { $or: marketFilters },
        ...(eventFilters.length > 0 ? [{ $or: eventFilters }] : []),
      ],
    });
    return this.settlePendingBetsByWinner(
      bets,
      winningSelectionId,
      adminId,
      'Manual market settlement',
    );
  }

  async settleEventMatchOdds(
    eventId: string,
    winningSelectionId: string,
    adminId: number,
    winningSelectionName?: string,
  ) {
    await this.maintenanceService.assertScopeAvailable(
      'sports',
      'Sports settlement is paused while maintenance mode is active.',
      adminId,
    );

    // Guard: refuse to settle if the event was dismissed/abandoned/cancelled
    const mongoEvent = await this.eventModel.findOne({
      $or: [{ event_id: eventId }, { eventId }],
    });
    const mongoMatchStatus = mongoEvent?.match_status || (mongoEvent as any)?.status;
    if (mongoMatchStatus && this.isDismissedEventStatus(mongoMatchStatus)) {
      throw new BadRequestException(
        `Cannot settle event ${eventId} — match status is "${mongoMatchStatus}". Use void-event to refund bets on dismissed/abandoned matches.`,
      );
    }

    const bets = await this.betModel.find({
      $or: [{ eventId }, { matchId: eventId }],
      status: 'PENDING',
    });

    const matchOddsBets = bets.filter((bet) => this.isMatchOddsBet(bet as any));
    const resolvedWinner = await this.resolveEventMatchOddsWinner(
      eventId,
      winningSelectionId,
      winningSelectionName,
      matchOddsBets,
    );

    return this.settlePendingBetsByWinner(
      matchOddsBets,
      resolvedWinner.selectionId,
      adminId,
      'Manual event Match Odds settlement',
    );
  }

  private async resolveEventMatchOddsWinner(
    eventId: string,
    winningSelectionId: string,
    winningSelectionName: string | undefined,
    bets: Array<{
      selectionId?: string | null;
      selectionName?: string | null;
    }>,
  ): Promise<{ selectionId: string; selectionName: string | null }> {
    const normalizedSelectionId = this.normalizeText(winningSelectionId);
    const normalizedSelectionName = this.normalizeText(winningSelectionName);
    const normalizedSelectionNameLower = normalizedSelectionName.toLowerCase();

    if (normalizedSelectionId) {
      const matchingBet = bets.find(
        (bet) => String(bet.selectionId || '') === normalizedSelectionId,
      );
      if (matchingBet) {
        return {
          selectionId: normalizedSelectionId,
          selectionName:
            this.normalizeText(matchingBet.selectionName) ||
            normalizedSelectionName ||
            null,
        };
      }
    }

    const matchOddsMarkets = (await this.marketModel
      .find({ event_id: eventId })
      .select('market_name gtype mname runners_data marketOdds section')
      .lean()) as any[];

    for (const market of matchOddsMarkets) {
      if (
        !this.isMatchOddsBet({
          gtype: market?.gtype,
          marketName: market?.market_name,
          mname: market?.mname,
        })
      ) {
        continue;
      }

      if (normalizedSelectionId) {
        const runner = this.findRunnerBySelectionId(
          market,
          normalizedSelectionId,
        );
        if (runner) {
          return {
            selectionId: normalizedSelectionId,
            selectionName:
              this.getRunnerDisplayName(runner) ||
              normalizedSelectionName ||
              null,
          };
        }
      }

      if (normalizedSelectionNameLower) {
        const runnerCollections = [
          market?.runners_data,
          market?.marketOdds,
          market?.section,
        ];

        for (const runners of runnerCollections) {
          if (!Array.isArray(runners)) continue;

          for (const runner of runners) {
            const runnerName = this.normalizeText(
              this.getRunnerDisplayName(runner),
            );
            const runnerId = this.getRunnerSelectionId(runner);
            if (!runnerName || !runnerId) continue;

            if (runnerName.toLowerCase() === normalizedSelectionNameLower) {
              return {
                selectionId: runnerId,
                selectionName: runnerName,
              };
            }
          }
        }
      }
    }

    if (normalizedSelectionId) {
      return {
        selectionId: normalizedSelectionId,
        selectionName: normalizedSelectionName || null,
      };
    }

    throw new BadRequestException(
      `Unable to resolve Match Odds winner${normalizedSelectionName ? ` for "${normalizedSelectionName}"` : ''}.`,
    );
  }

  private isMatchOddsBet(bet: {
    gtype?: string | null;
    marketName?: string | null;
    computedMarketName?: string | null;
    mname?: string | null;
  }) {
    const gtype = String(bet.gtype || '').toLowerCase();
    const marketName = String(
      bet.marketName || bet.computedMarketName || '',
    ).toLowerCase();
    const mname = String(bet.mname || '').toLowerCase();

    if (
      [
        'session',
        'fancy',
        'fancy2',
        'khado',
        'meter',
        'oddeven',
        'other fancy',
      ].includes(gtype)
    ) {
      return false;
    }

    if (mname.includes('bookmaker') || mname.includes('fancy')) {
      return false;
    }

    return (
      marketName.includes('match odds') ||
      marketName.includes('match_odds') ||
      gtype === 'match'
    );
  }

  private async settlePendingBetsByWinner(
    bets: BetDocument[],
    winningSelectionId: string,
    adminId: number,
    settlementSource: string,
  ) {
    const winningBet = bets.find(
      (bet) =>
        this.getComparableBetSelectionId(bet as any) ===
        this.normalizeText(winningSelectionId),
    );
    const winningSelectionName = winningBet
      ? this.getDisplayBetSelectionName(winningBet as any)
      : winningSelectionId;

    const results = {
      total: bets.length,
      settled: 0,
      errors: 0,
    };

    for (const bet of bets) {
      try {
        const betSelectionId = this.getComparableBetSelectionId(bet as any);
        const betSelectionName = this.getDisplayBetSelectionName(bet as any);
        const isSelectionWinner =
          betSelectionId === this.normalizeText(winningSelectionId);

        const userWins = isSelectionWinner; // All bets are back-type: winner = your selection wins
        const settledReason = userWins
          ? `${settlementSource}. Winner: ${winningSelectionName}. Your selection "${betSelectionName}" was settled as WON.`
          : `${settlementSource}. Winner: ${winningSelectionName}. Your selection "${betSelectionName}" was settled as LOST.`;

        let payout = 0;
        let status = 'LOST';

        if (userWins) {
          status = 'WON';
          payout = bet.potentialWin;
        }

        await this.prisma.$transaction(async (prisma) => {
          const updateData: any = {
            exposure: { decrement: bet.stake },
          };
          const payoutAllocations = userWins
            ? this.buildBetPayoutAllocations(bet, payout)
            : [];
          const primaryAllocation = payoutAllocations[0];
          const paymentMethod =
            payoutAllocations.length === 1 && primaryAllocation
              ? this.mapWalletFieldToPaymentMethod(primaryAllocation.walletField)
              : 'MULTI_WALLET';

          if (userWins) {
            for (const allocation of payoutAllocations) {
              updateData[allocation.walletField] = {
                increment: allocation.amount,
              };
            }
          }

          // Use updateMany so a missing user row (P2025) does not crash
          // the entire settlement loop — the bet is still marked settled.
          const userUpdated = await prisma.user.updateMany({
            where: { id: bet.userId },
            data: updateData,
          });

          if (userUpdated.count === 0) {
            console.warn(
              `[Settlement] User ${bet.userId} not found in Postgres — bet ${bet._id} settled as ${status} but wallet not updated`,
            );
          }

          if (userWins && userUpdated.count > 0) {
            await prisma.transaction.create({
              data: {
                userId: bet.userId,
                amount: payout,
                type: 'BET_WIN',
                status: 'COMPLETED',
                paymentMethod,
                paymentDetails: {
                  source: 'SPORTS_SETTLEMENT',
                  walletField:
                    payoutAllocations.length === 1 && primaryAllocation
                      ? primaryAllocation.walletField
                      : null,
                  walletLabel:
                    payoutAllocations.length === 1 && primaryAllocation
                      ? primaryAllocation.walletLabel
                      : payoutAllocations
                          .map((allocation) => allocation.walletLabel)
                          .join(' + '),
                  allocations: payoutAllocations,
                  marketId: bet.marketId,
                  betId: String(bet._id),
                },
                remarks: `Won Bet on ${bet.eventName} (${bet.selectionName})`,
                adminId,
                createdAt: new Date(),
                updatedAt: new Date(),
              },
            });
          }

          bet.status = status;
          // @ts-ignore
          bet.settledReason = settledReason;
          // @ts-ignore
          bet.settledAt = new Date();
          await bet.save();

          await this.redis.srem(
            `active_bets:${bet.userId}`,
            bet._id.toString(),
          );
        });

        results.settled++;
        this.bonusService.emitWalletRefresh(bet.userId);
      } catch (error) {
        console.error(`Failed to settle bet ${bet._id}:`, error);
        results.errors++;
      }
    }

    return results;
  }

  // ── Sportradar: settle bets by market-result ──────────────────────────────

  /**
   * Fetches Sportradar market-result for an event, finds SETTLED markets
   * where at least one runner has result='won', and settles all PENDING bets
   * for those markets.
   *
   * @param eventId   - Sportradar event ID (sr:match:...)
   * @param marketId  - (optional) only settle this specific market
   * @param adminId   - admin performing the settlement
   */
  async settleByMarketResult(
    eventId: string,
    adminId: number,
    marketId?: string,
  ): Promise<{
    success: boolean;
    message: string;
    marketsProcessed: number;
    betsSettled: number;
    errors: string[];
  }> {
    await this.maintenanceService.assertScopeAvailable(
      'sports',
      'Sports settlement is paused while maintenance mode is active.',
      adminId,
    );

    // 1. Fetch settled market data from Sportradar
    const result = await this.sportradarService.getRawMarketResult('', eventId);

    // 1a. Guard: If the event was dismissed/abandoned/cancelled, refuse to settle.
    //     Bets on such events must be voided, not settled as WON/LOST.
    if (result.success && this.isDismissedEventStatus(result.eventStatus)) {
      this.logger.warn(
        `[SR Settlement] Event ${eventId} has dismissed/abandoned status "${result.eventStatus}" — refusing auto-settle. Use void-event instead.`,
      );
      return {
        success: false,
        message: `Event ${eventId} was ${result.eventStatus}. Bets must be voided, not settled. Use the void-event endpoint.`,
        marketsProcessed: 0,
        betsSettled: 0,
        errors: [`Event status is ${result.eventStatus} — settlement blocked to prevent incorrect payouts.`],
      };
    }

    // 1b. Also check the MongoDB event record for dismissed status
    const mongoEvent = await this.eventModel.findOne({
      $or: [{ event_id: eventId }, { eventId }],
    });
    const mongoMatchStatus = mongoEvent?.match_status || (mongoEvent as any)?.status;
    if (mongoMatchStatus && this.isDismissedEventStatus(mongoMatchStatus)) {
      this.logger.warn(
        `[SR Settlement] Event ${eventId} has dismissed/abandoned match_status "${mongoMatchStatus}" in MongoDB — refusing auto-settle.`,
      );
      return {
        success: false,
        message: `Event ${eventId} match status is "${mongoMatchStatus}". Bets must be voided, not settled.`,
        marketsProcessed: 0,
        betsSettled: 0,
        errors: [`MongoDB match_status is ${mongoMatchStatus} — settlement blocked.`],
      };
    }

    if (!result.success || !result.settledMarkets?.length) {
      return {
        success: false,
        message: `No settled markets found for event ${eventId}. Ensure the event has concluded and results are published.`,
        marketsProcessed: 0,
        betsSettled: 0,
        errors: [],
      };
    }

    const marketsToProcess = marketId
      ? result.settledMarkets.filter((m) => m.marketId === marketId)
      : result.settledMarkets;

    if (!marketsToProcess.length) {
      return {
        success: false,
        message: marketId
          ? `Market ${marketId} is not settled yet or not found in the result.`
          : `No settled markets found for event ${eventId}.`,
        marketsProcessed: 0,
        betsSettled: 0,
        errors: [],
      };
    }

    let totalSettled = 0;
    const errors: string[] = [];

    for (const market of marketsToProcess) {
      // Find PENDING bets for this event and narrow to the exact market id.
      const pendingBets = (await this.betModel.find({
        status: 'PENDING',
        $or: [{ eventId }, { matchId: eventId }, { srEventId: eventId }],
      })) as BetDocument[];

      const eligibleBets = pendingBets.filter((bet) => {
        const comparableEventId = this.getComparableBetEventId(bet as any);
        const comparableMarketId = this.getComparableBetMarketId(bet as any);
        const comparableSelectionId = this.getComparableBetSelectionId(
          bet as any,
        );

        if (!comparableEventId || !comparableMarketId || !comparableSelectionId) {
          this.logger.warn(
            `[SR Settlement] Skipping bet ${bet._id} because identifiers are incomplete.`,
          );
          return false;
        }

        if (comparableEventId !== this.normalizeText(eventId)) {
          return false;
        }

        return comparableMarketId === this.normalizeText(market.marketId);
      });

      if (!eligibleBets.length) {
        this.logger.log(
          `[SR Settlement] No eligible pending bets for event ${eventId} market ${market.marketId}`,
        );
        continue;
      }

      // ── VOIDED market: void all bets for this market ──────────────────────
      if (market.marketStatus === 'VOIDED') {
        for (const bet of eligibleBets) {
          try {
            const originalStake = this.getBetOriginalStake(bet);
            const refundAllocations = this.getVoidRefundAllocations(bet);
            const remainingExposure = this.roundCurrency(Number(bet.stake || 0));

            const walletUpdate: any = {};
            if (remainingExposure > 0) {
              walletUpdate.exposure = { decrement: remainingExposure };
            }
            for (const alloc of refundAllocations) {
              walletUpdate[alloc.walletField] = { increment: alloc.amount };
            }

            const totalRefunded = this.roundCurrency(
              refundAllocations.reduce((sum, a) => sum + a.amount, 0),
            );

            await this.prisma.$transaction(async (prisma) => {
              if (Object.keys(walletUpdate).length > 0) {
                await prisma.user.update({
                  where: { id: bet.userId },
                  data: walletUpdate,
                });
              }
              if (totalRefunded > 0) {
                await prisma.transaction.create({
                  data: {
                    userId: bet.userId,
                    amount: totalRefunded,
                    type: 'REFUND',
                    status: 'COMPLETED',
                    paymentMethod: refundAllocations.length === 1
                      ? this.mapWalletFieldToPaymentMethod(refundAllocations[0].walletField)
                      : 'MULTI_WALLET',
                    paymentDetails: {
                      source: 'SPORTS_SETTLEMENT',
                      reason: 'Market voided by provider',
                      eventId,
                      marketId: market.marketId,
                      betId: String(bet._id),
                    },
                    remarks: `Voided: ${bet.eventName} — ${market.marketName} (market dismissed)`,
                    adminId,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                  },
                });
              }
            });

            bet.status = 'VOID';
            bet.settledReason = `Market voided by provider. Market: ${market.marketName}. Stake refunded.`;
            bet.settledAt = new Date();
            await bet.save();
            totalSettled += 1;
          } catch (voidErr: any) {
            this.logger.error(
              `[SR Settlement] Failed to void bet ${bet._id} for voided market ${market.marketId}: ${voidErr.message}`,
            );
            errors.push(`Market ${market.marketId}: failed to void bet ${bet._id}`);
          }
        }
        this.logger.log(
          `[SR Settlement] Event ${eventId} market ${market.marketId}: voided ${eligibleBets.length} bet(s) (market VOIDED)`,
        );
        continue;
      }

      // ── SETTLED market: find winner and settle bets ───────────────────────
      const winnerRunner = market.runners.find(
        (r) => r.result?.toLowerCase() === 'won',
      );

      if (!winnerRunner) {
        this.logger.warn(
          `[SR Settlement] No won runner in market ${market.marketId} — skipping`,
        );
        continue;
      }

      // Settle: winner runnerId must match selectionId on the bet
      const settledResult = await this.settlePendingBetsByWinner(
        eligibleBets,
        winnerRunner.runnerId,
        adminId,
        `Official result settlement. Market: ${market.marketName}`,
      );

      totalSettled += settledResult.settled;

      if (settledResult.errors > 0) {
        errors.push(
          `Market ${market.marketId}: ${settledResult.errors} bet(s) failed to settle`,
        );
      }

      this.logger.log(
        `[SR Settlement] Event ${eventId} market ${market.marketId}: ${settledResult.settled}/${eligibleBets.length} bets settled. Winner: ${winnerRunner.runnerName} (${winnerRunner.runnerId})`,
      );
    }

    return {
      success: true,
      message: `Settled ${totalSettled} bet(s) across ${marketsToProcess.length} market(s) for event ${eventId}.`,
      marketsProcessed: marketsToProcess.length,
      betsSettled: totalSettled,
      errors,
    };
  }

  // ── Cash Out ─────────────────────────────────────────────────────────────

  /**
   * Returns the current cash out offer for a PENDING bet.
   * Does NOT settle anything — read-only.
   *
   * Security layers:
   *  1. Bet exists
   *  2. Caller owns the bet (userId match)
   *  3. Bet is still PENDING
   *  4. Cash out is enabled on this bet
   *  5. Market is not SUSPENDED / CLOSED
   *  6. Live odds are available
   *
   * Product rule:
   *  Cash out moves linearly with the live odds change from the entry price.
   */
  async getCashoutOffer(betId: string, userId: number) {
    await this.maintenanceService.assertScopeAvailable(
      'sports',
      'Sports cash out is temporarily unavailable due to maintenance.',
      userId,
    );

    // Layer 1: Bet exists
    const bet = await this.betModel.findById(betId);
    if (!bet) throw new BadRequestException('Bet not found');

    // Layer 2: Ownership check (prevents IDOR)
    if (bet.userId !== userId) {
      throw new BadRequestException('Bet not found'); // intentionally vague
    }

    // Layer 3: Must be PENDING
    if (bet.status !== 'PENDING') {
      return {
        betId,
        status: 'UNAVAILABLE',
        reason: `Bet is already ${bet.status}`,
      };
    }

    // Layer 4: Cash out enabled flag
    if (bet.cashoutEnabled === false) {
      return {
        betId,
        status: 'UNAVAILABLE',
        reason: 'Cash out not available for this bet',
      };
    }

    // Layer 5: Market status and live odds
    const marketState = await this.resolveCashoutMarketState(
      bet.eventId,
      bet.marketId,
      bet.selectionId,
    );
    // Market not found — for SR bets this means the Redis cache expired (1s TTL).
    // Return UNAVAILABLE (not SUSPENDED) so the UI shows a neutral "unavailable" state
    // rather than the alarming "Cash Out Suspended — Market not found" message.
    if (!marketState.market) {
      const isSrBet = String(bet.eventId || '').toLowerCase().startsWith('sr:');
      return {
        betId,
        status: isSrBet ? 'UNAVAILABLE' : 'SUSPENDED',
        reason: isSrBet
          ? 'Live odds not yet available — please try again in a moment'
          : 'Market not found',
      };
    }
    if (!this.isCashoutSupportedMarket(marketState.market)) {
      return {
        betId,
        status: 'UNAVAILABLE',
        reason:
          'Cash out is only available for Match Odds markets',
      };
    }
    if (marketState.suspended) {
      return { betId, status: 'SUSPENDED', reason: 'Market is suspended' };
    }

    const currentOdds = marketState.currentOdds;
    if (!currentOdds || currentOdds <= 1) {
      return { betId, status: 'SUSPENDED', reason: 'Live odds unavailable' };
    }

    // ── Calculate offer ───────────────────────────────────────────────────
    // Formula:
    //   stake * (1 - (((currentOdds - originalOdds) / originalOdds) / 3)) * 0.95
    // Example:
    //   100 @ 2.0 -> 1.4 = 104.50
    //   100 @ 2.0 -> 2.6 = 85.50
    const cashoutValue = this.normalizeCashoutValue(
      bet,
      this.calculateBaseCashoutValue(bet, currentOdds),
    );
    if (cashoutValue <= 0) {
      return {
        betId,
        status: 'UNAVAILABLE',
        reason: 'Cash out value is unavailable for this bet',
      };
    }

    return {
      betId,
      status: 'AVAILABLE',
      cashoutValue,
      currentOdds,
      originalOdds: bet.odds,
      stake: bet.stake,
      potentialWin: bet.potentialWin,
      fullRefundEligible: false,
      fullRefundValue: null,
    };
  }

  /**
   * Executes full or partial cash out for a PENDING bet.
   *
   * Stake.com-style features:
   *  1. Partial cash out — fraction 0 < f <= 1 (e.g. 0.5 = 50%)
   *     Partial cashout: reduces the remaining live stake on the bet
   *     and credits the realized cashout value immediately.
   *  2. Price-change tolerance band (2%):
   *     - If server re-computed value is within 2% of client's expectation → accept silently
   *     - If > 2% divergence → return PRICE_CHANGED with new value (frontend re-confirms)
   *  3. Cash out follows the odds-change percentage rule, then applies a 5% house haircut.
   *
   * Security: ALL values re-computed server-side. clientExpectedValue is only used for
   * tolerance comparison — it is NEVER credited to the user.
   *
   * @param betId           - MongoDB bet ID
   * @param userId          - from JWT
   * @param fraction        - 0 < fraction <= 1 (default 1 = full cashout)
   * @param clientExpectedValue - what the client UI showed the user (for tolerance check)
   * @param fullRefund      - deprecated legacy flag, no longer supported
   */
  async executeCashout(
    betId: string,
    userId: number,
    fraction = 1,
    clientExpectedValue?: number,
    fullRefund = false,
  ): Promise<any> {
    await this.maintenanceService.assertScopeAvailable(
      'sports',
      'Sports cash out is temporarily unavailable due to maintenance.',
      userId,
    );

    const cashoutLockKey = `bet_cashout_lock:${userId}:${this.normalizeText(
      betId,
    )}`;
    let keepLock = false;

    await this.enforceRateLimit(
      `bet_cashout_rl:${userId}`,
      BET_CASHOUT_RATE_LIMIT,
      BET_CASHOUT_RATE_WINDOW_SECS,
      `Too many cash out attempts. Max ${BET_CASHOUT_RATE_LIMIT} per ${BET_CASHOUT_RATE_WINDOW_SECS}s.`,
    );
    await this.acquireActionLock(
      cashoutLockKey,
      BET_CASHOUT_LOCK_TTL_SECS,
      'Cash out already in progress for this bet. Please wait a moment.',
    );

    try {
      // ── Validate fraction ───────────────────────────────────────────────
      if (fraction <= 0 || fraction > 1) {
        throw new BadRequestException(
          'Fraction must be between 0 (exclusive) and 1 (inclusive)',
        );
      }

      // ── Fetch & validate bet ────────────────────────────────────────────
      const bet = await this.betModel.findById(betId);
      if (!bet) throw new BadRequestException('Bet not found');

      // Ownership — prevents IDOR
      if (bet.userId !== userId) throw new BadRequestException('Bet not found');

      // Idempotency — prevents double cashout
      if (bet.status !== 'PENDING') {
        throw new BadRequestException(
          `Cannot cash out — bet is '${bet.status}'`,
        );
      }

      if (bet.cashoutEnabled === false) {
        throw new BadRequestException('Cash out is not available for this bet');
      }

      // ── Market status ───────────────────────────────────────────────────
      const marketState = await this.resolveCashoutMarketState(
        bet.eventId,
        bet.marketId,
        bet.selectionId,
      );
      if (!marketState.market) {
        const isSrBet = String(bet.eventId || '').toLowerCase().startsWith('sr:');
        throw new BadRequestException(
          isSrBet
            ? 'Live odds not yet synced — please try again in a moment'
            : 'Market not found',
        );
      }
      if (!this.isCashoutSupportedMarket(marketState.market)) {
        throw new BadRequestException(
          'Cash out is only available for Match Odds markets',
        );
      }
      if (marketState.suspended) {
        throw new BadRequestException('Market is suspended');
      }

      if (fullRefund) {
        throw new BadRequestException('Full refund cash out is not available');
      }

      // ── Re-compute live odds (NEVER trust client) ───────────────────────
      const currentOdds = marketState.currentOdds;
      if (!currentOdds || currentOdds <= 1) {
        throw new BadRequestException(
          'Live odds unavailable — market may be suspended',
        );
      }

      // ── Calculate server-side cashout value ─────────────────────────────
      const fullCashoutValue = this.normalizeCashoutValue(
        bet,
        this.calculateBaseCashoutValue(bet, currentOdds),
      );

      if (fullCashoutValue <= 0) {
        throw new BadRequestException('Cash out value is zero');
      }

      const requestedCashoutValue = this.roundCurrency(
        fullCashoutValue * fraction,
      );

      if (clientExpectedValue !== undefined && clientExpectedValue > 0) {
        const divergence =
          Math.abs(requestedCashoutValue - clientExpectedValue) /
          clientExpectedValue;
        const TOLERANCE = 0.02;
        if (divergence > TOLERANCE) {
          return {
            status: 'PRICE_CHANGED',
            newCashoutValue: requestedCashoutValue,
            fullCashoutValue,
            currentOdds,
            fraction,
          };
        }
      }

      const settlement = await this._settleCashout(
        bet,
        requestedCashoutValue,
        bet.stake,
        fraction,
        currentOdds,
        userId,
      );
      keepLock = true;
      return settlement;
    } finally {
      if (!keepLock) {
        await this.releaseActionLock(cashoutLockKey);
      }
    }
  }

  /**
   * Internal: atomically credit cashout value, update the live bet state,
   * and clean up Redis when the bet is fully exited.
   */
  private async _settleCashout(
    bet: BetDocument,
    cashoutValue: number,
    originalStake: number,
    fraction: number,
    currentOdds: number,
    userId: number,
  ): Promise<any> {
    const settledCashoutValue = this.normalizeCashoutValue(bet, cashoutValue);
    if (settledCashoutValue <= 0) {
      throw new BadRequestException(
        'Cash out value is unavailable for this bet',
      );
    }

    const payoutAllocations = this.buildBetPayoutAllocations(
      bet,
      settledCashoutValue,
    );
    const primaryAllocation = payoutAllocations[0];
    const paymentMethod =
      payoutAllocations.length === 1 && primaryAllocation
        ? this.mapWalletFieldToPaymentMethod(primaryAllocation.walletField)
        : 'MULTI_WALLET';
    const walletLabel =
      payoutAllocations.length === 1 && primaryAllocation
        ? primaryAllocation.walletLabel
        : payoutAllocations
            .map((allocation) => allocation.walletLabel)
            .join(' + ');
    const betOriginalStake = this.getBetOriginalStake(bet);
    const betOriginalPotentialWin = this.getBetOriginalPotentialWin(bet);
    const priorPartialCashoutValue = this.getBetPartialCashoutValue(bet);

    const cashedStake = this.roundCurrency(originalStake * fraction);
    const remainStake = this.roundCurrency(originalStake * (1 - fraction));
    const isPartial = fraction < 1 && remainStake > 0;

    // ── Atomic Prisma transaction ─────────────────────────────────────────
    await this.prisma.$transaction(async (prisma) => {
      const user = await prisma.user.findUnique({ where: { id: userId } });
      if (!user) throw new BadRequestException('User not found');

      const creditData = payoutAllocations.reduce<Record<string, any>>(
        (acc, allocation) => {
          acc[allocation.walletField] = { increment: allocation.amount };
          return acc;
        },
        {},
      );

      await prisma.user.update({
        where: { id: userId },
        data: {
          ...creditData,
          // Release exposure of the CASHED portion only
          exposure: { decrement: cashedStake },
        } as any,
      });

      await prisma.transaction.create({
        data: {
          userId,
          amount: settledCashoutValue,
          type: 'BET_CASHOUT',
          status: 'COMPLETED',
          paymentMethod,
          paymentDetails: {
            source: 'BET_CASHOUT',
            walletField:
              payoutAllocations.length === 1
                ? (primaryAllocation?.walletField ?? null)
                : null,
            walletLabel,
            allocations: payoutAllocations,
            betId: String(bet._id),
            marketId: bet.marketId,
          },
          remarks: isPartial
            ? `Partial Cash Out (${Math.round(fraction * 100)}%): ${bet.eventName} — ${bet.selectionName} @ ${currentOdds} (original ${bet.odds})`
            : `Cash Out: ${bet.eventName} — ${bet.selectionName} @ ${currentOdds} (original ${bet.odds})`,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
    });

    // ── MongoDB updates ───────────────────────────────────────────────────
    if (isPartial) {
      // Shrink the original bet to the remaining live portion while
      // preserving the immutable opening values for history/P&L.
      const remainPotentialWin = this.roundCurrency(
        bet.potentialWin * (1 - fraction),
      );
      const updatedPartialCashoutValue = this.roundCurrency(
        priorPartialCashoutValue + settledCashoutValue,
      );

      bet.originalStake = betOriginalStake;
      bet.originalPotentialWin = betOriginalPotentialWin;
      bet.stake = remainStake;
      bet.potentialWin = remainPotentialWin;
      (bet as any).partialCashoutValue = updatedPartialCashoutValue;
      (bet as any).partialCashoutCount =
        Number((bet as any).partialCashoutCount || 0) + 1;
      (bet as any).lastPartialCashoutAt = new Date();
      bet.settledReason = [
        bet.settledReason,
        `Partial cash out ${Math.round(fraction * 100)}% at odds ${currentOdds}: received ₹${settledCashoutValue}.`,
      ]
        .filter(Boolean)
        .join(' | ');
      await bet.save();
    } else {
      // Full cash out — mark bet as settled
      const totalCashoutValue = this.roundCurrency(
        priorPartialCashoutValue + settledCashoutValue,
      );

      bet.originalStake = betOriginalStake;
      bet.originalPotentialWin = betOriginalPotentialWin;
      bet.status = 'CASHED_OUT';
      bet.cashoutValue = totalCashoutValue;
      bet.cashedOutAt = new Date();
      bet.settledReason =
        priorPartialCashoutValue > 0
          ? `Final cash out at odds ${currentOdds} (original: ${bet.odds}). Received ₹${settledCashoutValue}. Total returned from cash outs ₹${totalCashoutValue}.`
          : `Cashed out at odds ${currentOdds} (original: ${bet.odds}). Received ₹${settledCashoutValue}.`;
      await bet.save();

      // Redis: remove from active bets only on full settle
      await this.redis.srem(`active_bets:${userId}`, bet._id.toString());
    }

    this.bonusService.emitWalletRefresh(userId);

    return {
      status: isPartial ? 'PARTIAL_CASHED_OUT' : 'CASHED_OUT',
      cashoutValue: settledCashoutValue,
      remainingStake: isPartial ? remainStake : 0,
      bet: { ...bet.toObject(), id: bet._id.toString() },
    };
  }
  // ─────────────────────────────────────────────────────────────────────────

  // ── Book Bet Feature for non-logged users ────────────────────────────────
  async bookBets(bets: any[]) {
    if (!bets || bets.length === 0) {
      throw new BadRequestException('No bets provided to book');
    }

    let bookingId = '';
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let isUnique = false;
    
    // Generate unique ID
    while (!isUnique) {
      bookingId = '0-';
      for (let i = 0; i < 6; i++) {
        bookingId += characters.charAt(Math.floor(Math.random() * characters.length));
      }
      const existing = await this.bookedBetModel.findOne({ bookingId }).lean();
      if (!existing) isUnique = true;
    }

    await new this.bookedBetModel({ bookingId, bets }).save();
    return { bookingId };
  }

  async getBookedBets(bookingId: string) {
    const booked = await this.bookedBetModel.findOne({ bookingId }).lean();
    if (!booked) {
      throw new BadRequestException('Booking code not found or expired');
    }
    return booked;
  }
  // ─────────────────────────────────────────────────────────────────────────
}
