import { Injectable, Logger, HttpException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma.service';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UsersService } from '../users/users.service';
import { v4 as uuidv4 } from 'uuid';
import {
  PROVIDERS_MAP,
  LKR_PROVIDERS,
  INR_PROVIDERS,
} from '../config/casino.config';
import axios from 'axios';
import { EventsGateway } from '../events.gateway';
import { Casino, CasinoDocument } from './schemas/casino.schema';
import { CasinoGame, CasinoGameDocument } from './schemas/casino-game.schema';
import * as qs from 'qs';
import {
  CasinoProvider,
  CasinoProviderDocument,
} from './schemas/casino-provider.schema';
import {
  CasinoCategory,
  CasinoCategoryDocument,
} from './schemas/casino-category.schema';
import {
  CasinoSectionGame,
  CasinoSectionGameDocument,
} from './schemas/casino-section-game.schema';
import { HuiduApiService } from './huidu-api.service';
import { HuiduCryptoService } from './huidu-crypto.service';
import { BonusService } from '../bonus/bonus.service';
import { MaintenanceService } from '../maintenance/maintenance.service';

@Injectable()
export class CasinoService {
  private readonly logger = new Logger(CasinoService.name);
  private readonly CASINO_AUTH_URL =
    'https://auth.worldcasinoonline.com/api/auth';
  private readonly PARTNER_KEY_LKR = process.env.CASINO_PARTNER_KEY_LKR;
  private readonly PARTNER_KEY_INR = process.env.CASINO_PARTNER_KEY_INR;

  // HUIDU API Configuration loaded directly from .env at runtime
  private readonly HUIDU_AGENCY_UID =
    process.env.HUIDU_AGENCY_UID || 'ab72cfab44395f7063c6f0c0f05b2325';
  private readonly HUIDU_AES_KEY =
    process.env.HUIDU_AES_KEY || 'cf847d09b90ae11051a5f09769a96578';
  private readonly HUIDU_PLAYER_PREFIX =
    process.env.HUIDU_PLAYER_PREFIX || 'h9f5c4';
  private readonly HUIDU_BASE_URL =
    process.env.HUIDU_BASE_URL || 'https://huidu.bet';

  constructor(
    private usersService: UsersService,
    private prisma: PrismaService,
    private configService: ConfigService,
    private eventsGateway: EventsGateway,
    @InjectModel(Casino.name) private casinoModel: Model<CasinoDocument>,
    @InjectModel(CasinoGame.name)
    private casinoGameModel: Model<CasinoGameDocument>,
    @InjectModel(CasinoProvider.name)
    private casinoProviderModel: Model<CasinoProviderDocument>,
    @InjectModel(CasinoCategory.name)
    private casinoCategoryModel: Model<CasinoCategoryDocument>,
    @InjectModel(CasinoSectionGame.name)
    private casinoSectionGameModel: Model<CasinoSectionGameDocument>,
    private huiduApiService: HuiduApiService,
    private huiduCryptoService: HuiduCryptoService,
    private bonusService: BonusService,
    private readonly maintenanceService: MaintenanceService,
  ) {}

  // ─── Section-pinned games (used by home page + casino tabs) ──────────────

  /**
   * Returns full game objects for games pinned to a section, in pinned order.
   * Sections: popular | new | slots | live | table | crash | home | top
   */
  async getSectionGames(section: string) {
    try {
      const pinned = await this.casinoSectionGameModel
        .find({ section })
        .sort({ order: 1 })
        .lean()
        .exec();

      if (!pinned.length) return [];

      const codes = pinned.map((p) => p.gameCode);
      const games = await this.casinoGameModel
        .find({ gameCode: { $in: codes }, isActive: true })
        .lean()
        .exec();

      // Preserve pinned order
      const gameMap = new Map(games.map((g) => [g.gameCode, g]));
      return codes
        .map((code) => {
          const g = gameMap.get(code);
          if (!g) return null;
          const iconNoExt = (g.icon || '').replace(/\.[^.]+$/, '');
          const iconPath = iconNoExt.includes('/')
            ? iconNoExt
                .split('/')
                .map((s: string) => encodeURIComponent(s))
                .join('/')
            : iconNoExt
              ? `${encodeURIComponent(g.provider)}/${encodeURIComponent(iconNoExt)}`
              : '';
          const banner = iconPath
            ? `https://imagedelivery.net/l7vrHxYm1V8kfxard9QBnQ/${iconPath}/public`
            : (g as any).image || '';
          return {
            id: (g as any)._id.toString(),
            gameCode: g.gameCode || (g as any).gameId || '',
            gameId: (g as any).gameId || '',
            gameName: g.name,
            providerCode: g.provider,
            providerSlug: this.getProviderSlug(g.provider),
            gameType: g.subType || g.type || g.category || 'SLOT',
            banner,
          };
        })
        .filter(Boolean);
    } catch (error) {
      this.logger.error('getSectionGames error:', error.message);
      return [];
    }
  }

  private readonly PROVIDER_FOLDERS = [
    '100HP',
    '7 Mojo',
    'AWC',
    'Aman&Aura Casino',
    'BetRadar',
    'BollyGaming RNG',
    'BollyTech',
    'CreedRoomz',
    'Darwin',
    'Dream Casino',
    'Evolution',
    'Ezugi',
    'Galaxsys',
    'InOut',
    'JackTop',
    'Marbles',
    'Ncasino',
    'Onlyplay',
    'PragmaticPlay',
    'Qtech',
    'RTG (NGP)',
    'SmartSoft',
    'SpinLogic',
    'Spribe(Aviator)',
    'SuperSpade',
    'Supernowa',
    'TVBET',
    'XProGaming',
  ];

  private getProviderSlug(providerName: string): string {
    if (!providerName) return '';
    const normProvider = providerName.toLowerCase().replace(/[^a-z0-9]/g, '');

    for (const folder of this.PROVIDER_FOLDERS) {
      const normFolder = folder.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normProvider === normFolder) return folder;
    }

    for (const folder of this.PROVIDER_FOLDERS) {
      const normFolder = folder.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (normProvider.includes(normFolder)) return folder;
      if (normFolder.includes(normProvider)) return folder;
    }
    return providerName;
  }

  expandCategorySearch(category: string): any {
    const cat = category.toLowerCase().replace(/_/g, ' ');
    // Regex logic for Mongo
    if (cat === 'slots' || cat === 'slot') {
      return {
        $or: [
          { sub_category: { $regex: 'slot', $options: 'i' } },
          { sub_category: { $regex: 'reels', $options: 'i' } },
          { game_sub_type: { $regex: 'slot', $options: 'i' } },
        ],
      };
    }
    if (cat === 'live casino' || cat === 'live') {
      return {
        $or: [
          { sub_category: { $regex: 'live', $options: 'i' } },
          { category: { $regex: 'live', $options: 'i' } },
          { type: { $regex: 'live', $options: 'i' } },
          { game_tag: { $regex: 'LIVE', $options: 'i' } },
          { game_tag: { $regex: 'Live Dealer', $options: 'i' } },
          { sub_category: { $regex: 'casino', $options: 'i' } },
        ],
      };
    }
    if (cat === 'table games') {
      return {
        $or: [
          { sub_category: { $regex: 'table', $options: 'i' } },
          { game_tag: { $regex: 'table', $options: 'i' } },
        ],
      };
    }
    return { sub_category: { $regex: cat, $options: 'i' } };
  }

  async getProvidersHub(category?: string) {
    try {
      const matchStage: any = {
        provider: { $ne: null },
        isActive: true,
        icon: { $exists: true, $nin: [null, ''] },
      };

      if (category && category !== 'all') {
        const catSearch = this.expandCategorySearch(category);
        Object.assign(matchStage, catSearch);
      }

      // Fetch active providers directly from the DB so only synced HUIDU studios are seen
      const dbProviders = await this.casinoProviderModel
        .find({ isActive: true })
        .sort({ priority: -1, name: 1 });

      // Fetch grouped counts from CasinoGame to know how many games per provider
      const gameCounts = await this.casinoGameModel.aggregate([
        { $match: matchStage },
        { $group: { _id: '$provider', count: { $sum: 1 } } },
      ]);

      const countMap = new Map<string, number>();
      gameCounts.forEach((g) => {
        if (g._id) countMap.set(g._id, g.count);
      });

      // Map and filter active providers
      const result = dbProviders.map((dp, index) => {
        const count = countMap.get(dp.code) || countMap.get(dp.name) || 0;
        return {
          id: index + 1,
          name: dp.name,
          provider: dp.code,
          code: dp.code,
          image: dp.image || '',
          count: count,
        };
      });

      // Fallback: If any provider has active games but somehow missed the sync in ProviderModel
      const providerCodesSet = new Set(dbProviders.map((p) => p.code));
      gameCounts.forEach((g) => {
        if (g._id && !providerCodesSet.has(g._id)) {
          // Make sure it doesn't match legacy "igtech" explicitly as a backup safety net
          if (g._id.toLowerCase() !== 'igtech') {
            result.push({
              id: result.length + 1,
              name: g._id,
              provider: g._id,
              code: g._id,
              image: '',
              count: g.count,
            });
          }
        }
      });

      // Only return providers that actually have games
      return result.filter(
        (p) => p.count > 0 && p.provider.toLowerCase() !== 'igtech',
      );
    } catch (error) {
      console.error('getProvidersHub error:', error.message);
      throw new HttpException('Failed to fetch providers', 500);
    }
  }

  async getGamesByProviderHub(
    provider: string,
    category?: string,
    search?: string,
    page: number = 1,
    limit: number = 60,
    type?: string,
  ) {
    try {
      const query: any = {
        isActive: true,
        icon: { $exists: true, $nin: [null, ''] },
      };
      let sort: any = { playCount: -1, createdAt: -1 };

      // Collect $and conditions to avoid $or clobbering
      const andConditions: any[] = [];

      // Type filter (e.g. live dealers page)
      if (type === 'live') {
        andConditions.push(this.expandCategorySearch('live casino'));
      }

      if (search) {
        query.name = { $regex: search, $options: 'i' };
      }

      if (provider && provider !== 'all') {
        let searchTerm = provider;
        if (provider.includes('Pragmatic')) searchTerm = 'Pragmatic';
        else if (provider.includes('Spribe')) searchTerm = 'Spribe';
        else if (provider.includes("Play'n GO")) searchTerm = "Play'n GO";
        else
          searchTerm = provider
            .replace(/\(.*\)/, '')
            .replace(/Live|Slot/gi, '')
            .trim();

        query.provider = { $regex: searchTerm, $options: 'i' };
      }

      // ── Section shorthand keys — serve admin-pinned games ──────────
      const SECTION_KEYS = [
        'popular',
        'new',
        'slots',
        'live',
        'table',
        'crash',
        'top-slots',
        'home',
        'top',
        'exclusive',
        'trending',
      ];
      if (category && SECTION_KEYS.includes(category)) {
        const sectionGames = await this.getSectionGames(category);
        if (sectionGames.length > 0) {
          const totalCount = sectionGames.length;
          return {
            games: sectionGames,
            total_pages: 1,
            total_count: totalCount,
          };
        }
        // Fallback: no pinned games — use old heuristic for this section
        if (category === 'popular') {
          sort = { playCount: -1 };
          limit = 50;
        } else if (category === 'new') {
          sort = { createdAt: -1 };
          limit = 50;
        } else {
          andConditions.push(this.expandCategorySearch(category));
        }
      } else if (category && category !== 'all') {
        // Search by category, subType, type, AND game name for specific categories like baccarat, roulette, etc.
        const cat = category.toLowerCase();
        andConditions.push({
          $or: [
            { category: { $regex: cat, $options: 'i' } },
            { subType: { $regex: cat, $options: 'i' } },
            { type: { $regex: cat, $options: 'i' } },
            { sub_category: { $regex: cat, $options: 'i' } },
            { name: { $regex: cat, $options: 'i' } },
            { game_tag: { $regex: cat, $options: 'i' } },
          ],
        });
      }

      // Merge all $and conditions into the query
      if (andConditions.length > 0) {
        query.$and = [...(query.$and || []), ...andConditions];
      }

      const totalCount = await this.casinoGameModel.countDocuments(query);
      let q = this.casinoGameModel.find(query).sort(sort);

      if (page && limit) {
        q = q.skip((page - 1) * limit).limit(limit);
      } else if (limit) {
        q = q.limit(limit);
      }

      const games = await q.exec();

      const mappedGames = games.map((g: any) => ({
        id: g._id.toString(),
        gameCode: g.gameCode || g.gameId || '',
        gameId: g.gameId || '',
        gameName: g.name,
        providerCode: g.provider,
        providerSlug: this.getProviderSlug(g.provider),
        gameType: g.subType || g.type || g.category || 'SLOT',
        banner: (() => {
          if (!g.icon)
            return (
              g.image ||
              `https://images.unsplash.com/photo-1605218427306-022ba8c15661?q=80&w=600&auto=format&fit=crop`
            );
          // icon is stored as '{provider}/{filename}.ext' or just '{filename}.ext'
          const iconNoExt = g.icon.replace(/\.[^.]+$/, '');
          // If it already contains '/', encode each segment; otherwise prepend provider
          const iconPath = iconNoExt.includes('/')
            ? iconNoExt
                .split('/')
                .map((s: string) => encodeURIComponent(s))
                .join('/')
            : `${encodeURIComponent(g.provider)}/${encodeURIComponent(iconNoExt)}`;
          return `https://imagedelivery.net/l7vrHxYm1V8kfxard9QBnQ/${iconPath}/public`;
        })(),
      }));

      if (mappedGames.length > 0) {
        this.logger.debug(
          `[CF Image Debug] First game: ${mappedGames[0].gameName} | provider: ${mappedGames[0].providerCode} | banner: ${mappedGames[0].banner}`,
        );
      }

      return {
        games: mappedGames,
        total_pages: limit ? Math.ceil(totalCount / limit) : 1,
        total_count: totalCount,
      };
    } catch (error) {
      console.error('getGamesByProviderHub error:', error.message);
      throw new HttpException('Failed to fetch games', 500);
    }
  }

  async getCategoriesHub(type?: 'live' | 'casino') {
    try {
      const popularCount = await this.casinoGameModel.countDocuments({
        playCount: { $gt: 100 },
      });
      const newCount = 50;
      const totalGames = await this.casinoGameModel.countDocuments({
        isActive: true,
      });

      // Aggregate categories from CasinoGame
      const matchStage: any = {
        category: { $ne: null },
        isActive: true,
        icon: { $exists: true, $nin: [null, ''] },
      };

      if (type === 'live') {
        matchStage.$or = [
          { sub_category: { $regex: 'live', $options: 'i' } },
          { category: { $regex: 'live', $options: 'i' } },
          { type: { $regex: 'live', $options: 'i' } },
          { game_tag: { $regex: 'LIVE', $options: 'i' } },
          { game_tag: { $regex: 'Live Dealer', $options: 'i' } },
        ];
      }

      const categories = await this.casinoGameModel.aggregate([
        { $match: matchStage },
        { $group: { _id: '$category', count: { $sum: 1 } } },
      ]);

      const categoryMap = new Map<
        string,
        { count: number; originalNames: Set<string> }
      >();

      const normalize = (cat: string) => {
        let n = cat.toLowerCase().trim();
        if (
          n === 'slot' ||
          n === 'slot game' ||
          n === 'slot games' ||
          n.includes('reels') ||
          n.includes('video slot')
        )
          return 'slots';
        if (
          n === 'live' ||
          n === 'live dealer' ||
          n === 'live casino' ||
          n === 'live popular' ||
          n === 'live games'
        )
          return 'live casino';
        if (n === 'table game' || n === 'table games') return 'table games';
        if (n === 'virtual' || n.includes('virtual')) return 'virtual sports';
        if (n === 'turbo' || n.includes('turbo')) return 'turbo games';
        if (n === 'crash' || n.includes('crash')) return 'crash games';
        if (n.includes('lucky') || n.includes('lotto') || n.includes('lottery'))
          return 'lottery';
        return n;
      };

      const displayNames: Record<string, string> = {
        slots: 'Slots',
        'live casino': 'Live Casino',
        'table games': 'Table Games',
        'virtual sports': 'Virtual Sports',
        'turbo games': 'Turbo Games',
        'crash games': 'Crash Games',
        blackjack: 'Blackjack',
        roulette: 'Roulette',
        baccarat: 'Baccarat',
        poker: 'Poker',
        'teen patti': 'Teen Patti',
        'andar bahar': 'Andar Bahar',
        'dragon tiger': 'Dragon Tiger',
        lottery: 'Lottery & Lucky Numbers',
        bingo: 'Bingo',
        keno: 'Keno',
        'scratch cards': 'Scratch Cards',
        fishing: 'Fishing',
      };

      categories.forEach((c) => {
        if (!c._id) return;
        const normalized = normalize(c._id);
        const existing = categoryMap.get(normalized) || {
          count: 0,
          originalNames: new Set(),
        };
        existing.count += c.count;
        existing.originalNames.add(c._id);
        categoryMap.set(normalized, existing);
      });

      const sortedCategories = Array.from(categoryMap.entries())
        .filter(([key, value]) => value.count > 0)
        .map(([key, value]) => ({
          id: key.replace(/\s+/g, '_'),
          name: displayNames[key] || key.charAt(0).toUpperCase() + key.slice(1),
          count: value.count,
          originalNames: Array.from(value.originalNames),
        }))
        .sort((a, b) => {
          const priority: Record<string, number> = {
            slots: 100,
            live_casino: 90,
            blackjack: 80,
            roulette: 70,
            baccarat: 60,
            poker: 50,
            table_games: 40,
            video_poker: 35,
            scratch_cards: 30,
            bingo: 20,
            keno: 10,
          };
          const scoreA = priority[a.id] || 0;
          const scoreB = priority[b.id] || 0;
          if (scoreA !== scoreB) return scoreB - scoreA;
          return b.count - a.count;
        });

      if (popularCount > 0) {
        sortedCategories.unshift({
          id: 'popular',
          name: 'Popular',
          count: popularCount > 100 ? 100 : popularCount,
          originalNames: [],
        });
      }
      if (newCount > 0) {
        sortedCategories.unshift({
          id: 'new',
          name: 'New',
          count: newCount,
          originalNames: [],
        });
      }
      sortedCategories.unshift({
        id: 'all',
        name: 'All Games',
        count: totalGames,
        originalNames: [],
      });

      return sortedCategories;
    } catch (error) {
      console.error('getCategoriesHub error:', error.message);
      throw new HttpException('Failed to fetch categories', 500);
    }
  }

  async getGameUrlHub(
    username: string,
    provider: string,
    gameId: string,
    isLobby: boolean = false,
    walletMode?: string,
  ) {
    const user = await this.usersService.findOne(username);
    if (!user) throw new HttpException('User not found', 404);

    await this.maintenanceService.assertScopeAvailable(
      'casino',
      'Casino is temporarily unavailable due to maintenance.',
      user.id,
    );

    try {

      // ── Wallet mode routing ──────────────────────────────────────────────
      // walletMode selects which of the 4 sub-wallets to fund the casino session:
      //   'main'        → {prefix}{id}_main        → user.balance (INR)
      //   'crypto'      → {prefix}{id}_usd         → user.cryptoBalance (USD)
      //   'fiatbonus'   → {prefix}{id}_fiatbonus   → user.casinoBonus (INR bonus)
      //   'cryptobonus' → {prefix}{id}_cryptobonus → user.cryptoBonus (crypto bonus)
      // Auto-routing: if no walletMode passed, check if casino bonus is selected (isEnabled)
      const activeWallet = (user as any).activeWallet || 'fiat';

      // Auto-detect: if user has an active, isEnabled casino bonus → use fiatbonus wallet
      const casinoUserBonus = !walletMode
        ? await (this.prisma as any).userBonus.findFirst({
            where: {
              userId: user.id,
              status: 'ACTIVE',
              applicableTo: { in: ['CASINO', 'BOTH'] },
              isEnabled: true,
            },
            select: { id: true },
          })
        : null;

      // Resolve final wallet mode:
      // 1. Explicit walletMode from request
      // 2. Auto: casino bonus selected → fiatbonus
      // 3. Auto: crypto wallet preference → crypto
      // 4. Fallback: main fiat
      const resolvedMode =
        walletMode ||
        (casinoUserBonus ? 'fiatbonus' : null) ||
        (activeWallet === 'crypto' ? 'crypto' : 'main');

      let walletSuffix: string;
      let walletBalance: number;
      let walletCurrency: string;

      if (resolvedMode === 'cryptobonus') {
        walletSuffix = '_cryptobonus';
        walletBalance = (user as any).cryptoBonus ?? 0;
        walletCurrency = 'USD';
      } else if (resolvedMode === 'fiatbonus') {
        walletSuffix = '_fiatbonus';
        // Include legacy fiatBonus in casinoBonus display (for old data)
        walletBalance =
          ((user as any).casinoBonus ?? 0) + ((user as any).fiatBonus ?? 0);
        walletCurrency = 'INR';
      } else if (resolvedMode === 'crypto') {
        walletSuffix = '_usd';
        walletBalance = (user as any).cryptoBalance ?? 0;
        walletCurrency = 'USD';
      } else {
        walletSuffix = '_main';
        walletBalance = user.balance ?? 0;
        walletCurrency = 'INR';
      }

      // Generate a dynamic callback URL to our backend webhook
      const backendDomain =
        process.env.NEXT_PUBLIC_API_URL || 'https://zeero.bet/api';
      const callbackUrl = `${backendDomain}/casino/huidu/wallet/callback`;

      // ── Sanitize member_account: some providers (e.g. SEXY) reject any
      //    non-alphanumeric characters including hyphens and underscores.
      //    Strategy: encode wallet suffix as a letter suffix instead of _xxx.
      //    Raw: h9f5c4{userId}_{walletSuffix}  →  clean: h9f5c4{userId}{suffixCode}
      const walletSuffixCode =
        walletSuffix === '_main'
          ? 'm'
          : walletSuffix === '_usd'
            ? 'u'
            : walletSuffix === '_fiatbonus'
              ? 'f'
              : walletSuffix === '_cryptobonus'
                ? 'c'
                : 'm';
      const memberAccount =
        `${this.HUIDU_PLAYER_PREFIX}${user.id}${walletSuffixCode}`.replace(
          /[^a-zA-Z0-9]/g,
          '',
        );
      const gameUid = gameId;

      const parametersObj = {
        agency_uid: this.HUIDU_AGENCY_UID,
        member_account: memberAccount,
        game_uid: gameUid,
        currency_code: walletCurrency,
        credit_amount: walletBalance, // balance of the selected sub-wallet
        callback_url: callbackUrl,
        language: 'en-US',
      };

      // Encrypt parameters
      const encryptedPayload = this.huiduCryptoService.encrypt(
        parametersObj,
        this.HUIDU_AES_KEY,
      );

      // Construct outer request payload as standard JSON Object
      const requestPayload = {
        agency_uid: this.HUIDU_AGENCY_UID,
        payload: encryptedPayload,
        timestamp: Date.now().toString(),
      };

      const launchUrl = `${this.HUIDU_BASE_URL}/game/v1`;

      this.logger.log(
        `[HUIDU Launch DEBUG] Requesting game ${gameUid} with agency_uid ${this.HUIDU_AGENCY_UID}`,
      );

      // Send strictly as application/json
      const response = await axios.post(launchUrl, requestPayload, {
        headers: { 'Content-Type': 'application/json' },
      });

      const data = response.data;
      if (data.code === 0 && data.payload && data.payload.game_launch_url) {
        return { url: data.payload.game_launch_url };
      } else {
        this.logger.error('HUIDU Game Launch Error:', JSON.stringify(data));
        throw new HttpException(
          data.msg || 'Failed to launch game (HUIDU rejected)',
          400,
        );
      }
    } catch (error) {
      this.logger.error(
        `getGameUrlHub error for user = ${username}, gameId = ${gameId}, provider = ${provider}: ${error.message}`,
      );
      if (error.response?.data) {
        this.logger.error(
          `HUIDU Detailed Response Error: ${JSON.stringify(error.response.data)}`,
        );
      }
      throw new HttpException(
        error.response?.data?.msg ||
          error.message ||
          'Internal casino launch error',
        error.response?.status || 500,
      );
    }
  }

  async huiduWalletCallbackHub(body: any) {
    try {
      const { agency_uid, payload } = body;

      if (agency_uid !== this.HUIDU_AGENCY_UID) {
        this.logger.error(`Webhook Agency UID mismatch: ${agency_uid} `);
        return { code: 1, msg: 'Invalid agency_uid' };
      }

      if (!payload) {
        return { code: 1, msg: 'Missing payload' };
      }

      // Decrypt the payload
      const data = this.huiduCryptoService.decrypt(payload, this.HUIDU_AES_KEY);

      // Log the full decrypted payload once so operators can confirm which
      // fields Huidu is actually sending (serial_number scheme, timestamps,
      // round ids, etc.) — invaluable when diagnosing idempotency mismatches.
      this.logger.log(`HUIDU webhook payload: ${JSON.stringify(data)}`);

      // Payload structure from HUIDU Seamless docs:
      // { member_account, game_uid, serial_number, bet_amount, win_amount, amount_type, ... }
      const {
        member_account,
        game_uid,
        serial_number,
        bet_amount,
        win_amount,
      } = data;

      // Two-account scheme:
      //   {prefix}{id}_main → fiat wallet
      //   {prefix}{id}_usd  → crypto wallet
      // Parse suffix first, then strip it along with the prefix to get userId.
      const prefix = this.HUIDU_PLAYER_PREFIX;
      if (!member_account || !member_account.startsWith(prefix)) {
        this.logger.error(`Invalid member_account prefix: ${member_account}`);
        return { code: 1, msg: 'Invalid member_account' };
      }

      // Determine wallet type from suffix.
      //
      // NEW format (alphanumeric-safe, no underscores):
      //   {prefix}{id}m  → fiat   (main)
      //   {prefix}{id}u  → crypto (usd)
      //   {prefix}{id}f  → fiatbonus
      //   {prefix}{id}c  → cryptobonus
      //
      // LEGACY format (kept for backward-compat with sessions launched before the fix):
      //   {prefix}{id}_main / _usd / _fiatbonus / _cryptobonus
      type WalletMode = 'main' | 'usd' | 'fiatbonus' | 'cryptobonus';
      let detectedMode: WalletMode = 'main';
      let accountWithoutPrefix = member_account.slice(prefix.length);

      // ── Legacy underscore-based suffixes (backward compat) ─────────
      if (accountWithoutPrefix.endsWith('_cryptobonus')) {
        detectedMode = 'cryptobonus';
        accountWithoutPrefix = accountWithoutPrefix.slice(0, -12);
      } else if (accountWithoutPrefix.endsWith('_fiatbonus')) {
        detectedMode = 'fiatbonus';
        accountWithoutPrefix = accountWithoutPrefix.slice(0, -10);
      } else if (accountWithoutPrefix.endsWith('_usd')) {
        detectedMode = 'usd';
        accountWithoutPrefix = accountWithoutPrefix.slice(0, -4);
      } else if (accountWithoutPrefix.endsWith('_main')) {
        detectedMode = 'main';
        accountWithoutPrefix = accountWithoutPrefix.slice(0, -5);
      }
      // ── New single-letter suffixes (alphanumeric-safe) ─────────────
      else if (accountWithoutPrefix.endsWith('c')) {
        detectedMode = 'cryptobonus';
        accountWithoutPrefix = accountWithoutPrefix.slice(0, -1);
      } else if (accountWithoutPrefix.endsWith('f')) {
        detectedMode = 'fiatbonus';
        accountWithoutPrefix = accountWithoutPrefix.slice(0, -1);
      } else if (accountWithoutPrefix.endsWith('u')) {
        detectedMode = 'usd';
        accountWithoutPrefix = accountWithoutPrefix.slice(0, -1);
      } else if (accountWithoutPrefix.endsWith('m')) {
        detectedMode = 'main';
        accountWithoutPrefix = accountWithoutPrefix.slice(0, -1);
      }
      // ── Fallback: pure numeric → assume fiat main ──────────────────

      // Map detected mode → legacy walletType for transaction records
      const walletType: 'fiat' | 'crypto' =
        detectedMode === 'usd' || detectedMode === 'cryptobonus'
          ? 'crypto'
          : 'fiat';

      const userIdStr = accountWithoutPrefix;
      const userId = parseInt(userIdStr, 10);

      if (isNaN(userId)) {
        return { code: 1, msg: 'Invalid user ID' };
      }

      // Determine operation type up-front.
      const betNum = parseFloat(bet_amount || '0');
      const winNum = parseFloat(win_amount || '0');
      const opType: 'WIN' | 'BET' | 'UPDATE' =
        winNum > betNum ? 'WIN' : betNum > 0 ? 'BET' : 'UPDATE';

      // NO idempotency on serial_number. Per product requirement: Huidu
      // may send multiple webhooks with the same serial_number for
      // distinct bets within a round — every callback must debit/credit.
      //
      // The `txn_id` column still has a DB-level @unique constraint, so
      // we generate a globally-unique ledger id per call. The raw
      // serial_number is preserved alongside (stored into game_name's
      // metadata is wrong; we just embed it into the txn_id itself so
      // the original value stays queryable via LIKE).
      const ledgerId = `${serial_number}:${opType}:${Date.now()}:${uuidv4()}`;

      // Route to the correct DB field based on the detected member_account suffix.
      // Each sub-wallet is completely separate — no cross-wallet fallback.
      let balanceField: 'balance' | 'cryptoBalance' | 'casinoBonus' | 'cryptoBonus';
      if (detectedMode === 'cryptobonus') balanceField = 'cryptoBonus';
      else if (detectedMode === 'fiatbonus') balanceField = 'casinoBonus';
      else if (detectedMode === 'usd') balanceField = 'cryptoBalance';
      else balanceField = 'balance';

      // Perform an atomic database transaction using Prisma
      const result = await this.prisma.$transaction(async (prisma) => {
        // 1. Check if the user exists
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
          throw new Error('User not found');
        }

        let gameName: string | null = null;
        try {
          const gameDoc = await this.casinoGameModel
            .findOne({ gameCode: game_uid })
            .select('name')
            .lean();
          if (gameDoc) gameName = (gameDoc as any).name;
        } catch {
          /* non-critical, ignore */
        }

        // 2. Atomic balance mutation FIRST. Postgres handles the
        // arithmetic in a single UPDATE so two concurrent BET webhooks
        // can't both read the pre-deduction balance and write the same
        // value.
        const netDelta = winNum - betNum;

        if (betNum > 0 && winNum === 0) {
          // Pure debit: conditional decrement guarantees non-negative
          // balance atomically. updateMany returns { count: 0 } when the
          // gte check fails, which we surface as insufficient-balance.
          const { count } = await prisma.user.updateMany({
            where: {
              id: userId,
              [balanceField]: { gte: betNum },
            } as any,
            data: { [balanceField]: { decrement: betNum } } as any,
          });
          if (count === 0) {
            throw new Error('Insufficient balance');
          }
        } else if (netDelta !== 0) {
          // Pure credit OR mixed bet+win in one webhook: atomic increment
          // by net. Preserves existing behaviour of proceeding even when
          // the explicit bet exceeds balance as long as an offsetting win
          // is included in the same payload.
          await prisma.user.update({
            where: { id: userId },
            data: { [balanceField]: { increment: netDelta } } as any,
          });
        }

        // Re-read the authoritative post-update balance for the response.
        const updatedUser = await prisma.user.findUnique({
          where: { id: userId },
        });
        const newBalance = Number((updatedUser as any)?.[balanceField] ?? 0);

        // 3. Record the ledger row with a unique ledger id (raw
        // serial_number is prefixed onto it so it stays queryable).
        await prisma.casinoTransaction.create({
          data: {
            user_id: user.id,
            username: user.username || `user_${user.id}`,
            game_code: game_uid,
            game_name: gameName,
            provider: data.provider_code || 'HUIDU',
            amount: winNum > 0 ? winNum : betNum,
            txn_id: ledgerId,
            type: opType,
            wallet_type: walletType, // "fiat" | "crypto"
            timestamp: new Date(),
          } as any,
        });

        return {
          balance: newBalance,
          updatedUser,
          alreadyProcessed: false,
          activeWallet: walletType,
          detectedMode,
        };
      });

      // 5. Emit socket event for real-time balance update frontend
      if (!result.alreadyProcessed && result.updatedUser) {
        // ── Real-time wagering turnover tracking ───────────────────────
        // `betNum` is scoped inside the transaction closure, so we re-derive from
        // the already-decrypted `data` object (not from raw `body` which is encrypted).
        const wagerAmount = parseFloat(data.bet_amount || '0');
        if (wagerAmount > 0) {
          const bonusWagerAmount =
            detectedMode === 'fiatbonus' || detectedMode === 'cryptobonus'
              ? wagerAmount
              : 0;
          this.bonusService
            .recordWagering(
              userId,
              wagerAmount,
              'CASINO',
              detectedMode,
              bonusWagerAmount,
            )
            .catch((e) => {
              this.logger.error(
                `[BonusWagering] Casino failed for user ${userId}: ${e.message}`,
              );
              this.eventsGateway.emitUserWalletUpdate(userId);
            });
        } else {
          this.eventsGateway.emitUserWalletUpdate(result.updatedUser.id, {
            balance: result.balance,
          });
        }
      }

      // 6. Return the success payload to HUIDU
      // Return the remaining balance in this specific sub-wallet to HUIDU
      const responseObj = {
        member_account: member_account,
        credit_amount: result.balance,
      };

      const encryptedResponse = this.huiduCryptoService.encrypt(
        responseObj,
        this.HUIDU_AES_KEY,
      );

      this.logger.log(
        `Processed Huidu Bet: user ${userId}, bet: ${bet_amount}, win: ${win_amount} -> new balance: ${result.balance} `,
      );

      return {
        code: 0,
        msg: 'success',
        payload: encryptedResponse,
      };
    } catch (error) {
      this.logger.error(`Webhook processing error: `, error.message);

      // HUIDU typically expects { code, msg } for failure
      // If it's insufficient funds, some APIs expect specific error codes.
      // We use code: 1 as general error. HUIDU Seamless docs may have specific error codes e.g. code: 1004 for insufficient balance.
      if (error.message === 'Insufficient balance') {
        return { code: 1004, msg: 'Insufficient balance' };
      }
      if (error.message === 'User not found') {
        return { code: 1002, msg: 'User not found' };
      }

      return { code: 1, msg: error.message || 'Internal error' };
    }
  }

  async getUserBets(userId: number, limit: number = 20, gameCode?: string) {
    const where: any = { user_id: userId };
    if (gameCode) where.game_code = gameCode;
    return this.prisma.casinoTransaction.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: limit,
    });
  }

  async updateGame(id: string, data: any) {
    return this.casinoGameModel.findByIdAndUpdate(id, data, {
      returnDocument: 'after',
    });
  }

  async getAllCategories() {
    return this.casinoGameModel.aggregate([
      { $match: { category: { $ne: null } } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $project: { name: '$_id', count: 1, _id: 0 } },
    ]);
  }

  async syncGames() {
    this.logger.log('Manual HUIDU sync triggered by Admin');
    this.huiduApiService
      .syncHuiduData()
      .catch((e) => this.logger.error('Manual sync failed', e));
    return { message: 'Casino sync initiated in the background.' };
  }

  // ─── HUIDU Direct Query (Admin) ─────────────────────────────────────────────
  // Hits HUIDU's /game/transaction/list endpoint directly so admins can audit
  // bet/win history straight from the provider (not relying on our local mirror
  // in CasinoTransaction, which only gets written when the callback succeeds).

  /**
   * Build the four HUIDU member_account variants for a given userId.
   * HUIDU stores each sub-wallet as a separate player account, so one
   * local user maps to up to four HUIDU IDs.
   */
  getHuiduMemberAccountsForUser(userId: number) {
    const prefix = this.HUIDU_PLAYER_PREFIX;
    return {
      prefix,
      main: `${prefix}${userId}m`,
      crypto: `${prefix}${userId}u`,
      fiatBonus: `${prefix}${userId}f`,
      cryptoBonus: `${prefix}${userId}c`,
      // Legacy (underscore) variants that older sessions used
      legacy: {
        main: `${prefix}${userId}_main`,
        crypto: `${prefix}${userId}_usd`,
        fiatBonus: `${prefix}${userId}_fiatbonus`,
        cryptoBonus: `${prefix}${userId}_cryptobonus`,
      },
    };
  }

  /**
   * Call HUIDU's /game/transaction/list endpoint with an encrypted payload.
   * HUIDU enforces `from_date` and `to_date` MUST be the same UTC day and
   * only the last 60 days are queryable (error 10029 / 10031).
   */
  async queryHuiduTransactions(params: {
    fromDate: number; // ms UTC
    toDate: number; // ms UTC
    pageNo?: number;
    pageSize?: number;
  }) {
    const pageNo = params.pageNo ?? 1;
    const pageSize = Math.min(params.pageSize ?? 100, 5000);

    const parametersObj = {
      timestamp: Date.now().toString(),
      agency_uid: this.HUIDU_AGENCY_UID,
      from_date: params.fromDate,
      to_date: params.toDate,
      page_no: pageNo,
      page_size: pageSize,
    };

    const encryptedPayload = this.huiduCryptoService.encrypt(
      parametersObj,
      this.HUIDU_AES_KEY,
    );

    const requestPayload = {
      agency_uid: this.HUIDU_AGENCY_UID,
      timestamp: Date.now().toString(),
      payload: encryptedPayload,
    };

    const url = `${this.HUIDU_BASE_URL}/game/transaction/list`;
    this.logger.log(
      `[HUIDU TxList] from=${params.fromDate} to=${params.toDate} page=${pageNo}/${pageSize}`,
    );

    try {
      const response = await axios.post(url, requestPayload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 30000,
      });

      const data = response.data;
      if (data.code !== 0) {
        this.logger.error(
          `HUIDU tx list error code=${data.code} msg=${data.msg}`,
        );
        throw new HttpException(
          data.msg || `HUIDU error ${data.code}`,
          400,
        );
      }

      // Response payload may itself be encrypted (base64 string) OR already
      // a JSON object depending on endpoint. /game/transaction/list returns
      // an unencrypted object directly. Handle both defensively.
      let payload: any = data.payload;
      if (typeof payload === 'string') {
        try {
          payload = this.huiduCryptoService.decrypt(payload, this.HUIDU_AES_KEY);
        } catch (_) {
          // Not encrypted — fall through with raw string (shouldn't happen)
        }
      }

      return {
        success: true,
        records: payload?.records ?? [],
        totalCount: payload?.total_count ?? 0,
        totalPage: payload?.total_page ?? 0,
        currentPage: payload?.current_page ?? pageNo,
        pageSize: payload?.page_size ?? pageSize,
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      const detail = error.response?.data
        ? JSON.stringify(error.response.data)
        : error.message;
      this.logger.error(`HUIDU tx list request failed: ${detail}`);
      throw new HttpException(
        error.response?.data?.msg || error.message || 'HUIDU request failed',
        error.response?.status || 500,
      );
    }
  }

  /**
   * Admin: fetch a single user's HUIDU game history for a given day.
   * Calls the same /game/transaction/list endpoint and then filters the
   * records to those whose member_account matches any of the user's
   * known HUIDU wallet variants (main/crypto/fiatbonus/cryptobonus).
   */
  async queryHuiduUserHistory(
    userId: number,
    params: { fromDate: number; toDate: number; pageNo?: number; pageSize?: number },
  ) {
    const res = await this.queryHuiduTransactions({
      ...params,
      pageSize: params.pageSize ?? 5000,
    });

    const accounts = this.getHuiduMemberAccountsForUser(userId);
    const wanted = new Set<string>([
      accounts.main,
      accounts.crypto,
      accounts.fiatBonus,
      accounts.cryptoBonus,
      accounts.legacy.main,
      accounts.legacy.crypto,
      accounts.legacy.fiatBonus,
      accounts.legacy.cryptoBonus,
    ]);

    const records = (res.records as any[]).filter((r) =>
      wanted.has(r.member_account),
    );

    // Annotate each record with wallet_type derived from member_account
    const annotated = records.map((r) => ({
      ...r,
      wallet_type: this.walletTypeFromMemberAccount(r.member_account),
    }));

    return {
      success: true,
      userId,
      accounts,
      records: annotated,
      totalMatched: annotated.length,
      totalFetched: res.records.length,
      totalPage: res.totalPage,
      totalCount: res.totalCount,
    };
  }

  private walletTypeFromMemberAccount(memberAccount: string):
    | 'main'
    | 'crypto'
    | 'fiatbonus'
    | 'cryptobonus'
    | 'unknown' {
    if (!memberAccount) return 'unknown';
    if (memberAccount.endsWith('_cryptobonus') || memberAccount.endsWith('c'))
      return 'cryptobonus';
    if (memberAccount.endsWith('_fiatbonus') || memberAccount.endsWith('f'))
      return 'fiatbonus';
    if (memberAccount.endsWith('_usd') || memberAccount.endsWith('u'))
      return 'crypto';
    if (memberAccount.endsWith('_main') || memberAccount.endsWith('m'))
      return 'main';
    return 'unknown';
  }

  // --- Admin Management Methods ---

  // Categories
  async getAdminCategories() {
    return this.casinoCategoryModel
      .find()
      .sort({ priority: -1, name: 1 })
      .exec();
  }

  async createCategory(data: any) {
    const slug = data.name.toLowerCase().replace(/ /g, '_');
    return this.casinoCategoryModel.create({ ...data, slug });
  }

  async updateCategory(id: string, data: any) {
    if (data.name) {
      data.slug = data.name.toLowerCase().replace(/ /g, '_');
    }
    return this.casinoCategoryModel.findByIdAndUpdate(id, data, {
      returnDocument: 'after',
    });
  }

  async deleteCategory(id: string) {
    return this.casinoCategoryModel.findByIdAndDelete(id);
  }

  async reorderCategories(items: { id: string; priority: number }[]) {
    const ops = items.map((item) => ({
      updateOne: {
        filter: { _id: item.id },
        update: { priority: item.priority },
      },
    }));
    return this.casinoCategoryModel.bulkWrite(ops);
  }

  // Providers
  async getAdminProviders() {
    return this.casinoProviderModel
      .find()
      .sort({ priority: -1, name: 1 })
      .exec();
  }

  async createProvider(data: any) {
    return this.casinoProviderModel.create(data);
  }

  async updateProvider(id: string, data: any) {
    return this.casinoProviderModel.findByIdAndUpdate(id, data, {
      returnDocument: 'after',
    });
  }

  async deleteProvider(id: string) {
    return this.casinoProviderModel.findByIdAndDelete(id);
  }

  async reorderProviders(items: { id: string; priority: number }[]) {
    const ops = items.map((item) => ({
      updateOne: {
        filter: { _id: item.id },
        update: { priority: item.priority },
      },
    }));
    return this.casinoProviderModel.bulkWrite(ops);
  }

  // Games
  async getAdminAllGames(
    page: number = 1,
    limit: number = 20,
    search?: string,
    provider?: string,
    category?: string,
  ) {
    const query: any = { isActive: true };
    if (search) query.name = { $regex: search, $options: 'i' };
    if (provider && provider !== 'all')
      query.provider = { $regex: provider, $options: 'i' };
    if (category && category !== 'all')
      query.category = { $regex: category, $options: 'i' };

    const total = await this.casinoGameModel.countDocuments(query);
    const games = await this.casinoGameModel
      .find(query)
      .sort({ priority: -1, isPopular: -1, isNewGame: -1, name: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .exec();

    return {
      games: games.map((g) => ({ ...g.toObject(), id: g._id.toString() })),
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
    };
  }

  async createGame(data: any) {
    return this.casinoGameModel.create(data);
  }

  // updateGame is already defined above, but for clarity/grouping in admin section,
  // I will NOT duplicate it. The one above serves both purposes or I should move it here.
  // I'll leave the one above and NOT add it here to avoid duplicate.

  async deleteGame(id: string) {
    // Soft delete
    return this.casinoGameModel.findByIdAndUpdate(
      id,
      { isActive: false },
      { returnDocument: 'after' },
    );
  }
}
