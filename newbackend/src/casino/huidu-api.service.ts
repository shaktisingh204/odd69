import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { CasinoGame, CasinoGameDocument } from './schemas/casino-game.schema';
import { CasinoProvider, CasinoProviderDocument } from './schemas/casino-provider.schema';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class HuiduApiService implements OnModuleInit {
    private readonly logger = new Logger(HuiduApiService.name);

    // Config from user prompt
    public readonly AGENCY_UID = 'ab72cfab44395f7063c6f0c0f05b2325';
    public readonly AES_KEY = 'cf847d09b90ae11051a5f09769a96578';
    public readonly PLAYER_PREFIX = 'h9f5c4';
    public readonly BASE_URL = 'https://huidu.bet'; // Given API Game Domain

    constructor(
        private readonly httpService: HttpService,
        @InjectModel(CasinoGame.name) private casinoGameModel: Model<CasinoGameDocument>,
        @InjectModel(CasinoProvider.name) private casinoProviderModel: Model<CasinoProviderDocument>
    ) { }

    private gameIconMap: Record<string, string> = {};

    async onModuleInit() {
        this.logger.log('Loading adxwinimages.json...');
        try {
            const mapPath = path.join(process.cwd(), '../newwebsite/public/adxwinimages.json');
            if (fs.existsSync(mapPath)) {
                const data = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
                data.forEach((item: any) => {
                    if (item.fileName && item.relativePath) {
                        const baseName = item.fileName.split('.').slice(0, -1).join('.');
                        this.gameIconMap[baseName.toLowerCase()] = item.relativePath;

                        const parts = baseName.split('_');
                        if (parts.length > 1) {
                            let namePart = parts.slice(1).join('_').trim().toLowerCase();
                            namePart = namePart.replace(/-/g, ' ');
                            if (!this.gameIconMap[namePart]) {
                                this.gameIconMap[namePart] = item.relativePath;
                            }
                        } else {
                            let noHyphen = baseName.toLowerCase().replace(/-/g, ' ');
                            if (!this.gameIconMap[noHyphen]) {
                                this.gameIconMap[noHyphen] = item.relativePath;
                            }
                        }
                    }
                });
                this.logger.log(`Loaded ${Object.keys(this.gameIconMap).length} mapped keys from adxwinimages.json.`);
            } else {
                this.logger.warn(`adxwinimages.json not found at ${mapPath}`);
            }
        } catch (e) {
            this.logger.error('Failed to load adxwinimages.json', e.message);
        }

        this.logger.log('HUIDU Initial Sync on Startup is disabled. Will run at 12 PM daily.');
    }

    @Cron('0 12 * * *') // Runs every 24 hours at 12 PM
    async handleCron() {
        this.logger.log('Running Scheduled 24h HUIDU Sync at 12 PM...');
        await this.syncHuiduData();
    }

    async syncHuiduData() {
        try {
            this.logger.log('Starting HUIDU Providers Sync...');
            await this.syncProviders();

            this.logger.log('Starting HUIDU Games list Sync...');
            const providers = await this.casinoProviderModel.find({ isActive: true });

            let totalGamesAdded = 0;
            for (let i = 0; i < providers.length; i++) {
                const provider = providers[i];
                let success = false;
                let retries = 3;

                while (!success && retries > 0) {
                    const added = await this.syncGamesForProvider(provider.code, i + 1, providers.length);
                    if (added === -1) {
                        this.logger.warn(`[${i + 1}/${providers.length}] Rate limit hit on provider ${provider.code}. Retrying in 2 minutes... (${retries} retries left)`);
                        await new Promise(r => setTimeout(r, 120000));
                        retries--;
                    } else {
                        totalGamesAdded += added;
                        success = true;
                    }
                }

                // Rate limit: wait 2.5 seconds before fetching next provider's games
                await new Promise(r => setTimeout(r, 2500));
            }
            this.logger.log(`HUIDU Sync Completed. Synced ${providers.length} providers and ${totalGamesAdded} games total.`);
        } catch (error) {
            this.logger.error('Failed HUIDU data sync', error);
        }
    }

    private async syncProviders(): Promise<void> {
        try {
            const url = `${this.BASE_URL}/game/providers?agency_uid=${this.AGENCY_UID}`;

            const response = await firstValueFrom(this.httpService.get(url));
            const data = response.data;

            if (data.code !== 0 || !data.data) {
                this.logger.error(`Failed to fetch providers: ${data.msg}`);
                return;
            }

            const providers = data.data; // Array of { code, name, currency, lang, status }

            const operations = providers.map((p: any) => ({
                updateOne: {
                    filter: { code: p.code },
                    update: {
                        $set: {
                            name: p.name || p.code,
                            isActive: p.status === 1
                        },
                        $setOnInsert: {
                            priority: 0
                        }
                    },
                    upsert: true
                }
            }));

            if (operations.length > 0) {
                await this.casinoProviderModel.bulkWrite(operations);
                this.logger.log(`Synced ${operations.length} HUIDU providers`);
            }
        } catch (error) {
            this.logger.error('Error in syncProviders:', error.message);
        }
    }

    private async syncGamesForProvider(providerCode: string, currentIndex?: number, total?: number): Promise<number> {
        try {
            const url = `${this.BASE_URL}/game/list?agency_uid=${this.AGENCY_UID}&code=${providerCode}`;

            const response = await firstValueFrom(this.httpService.get(url));
            const data = response.data;

            if (data.code !== 0 || !data.data) {
                if (data.msg?.includes('Too many requests')) {
                    return -1;
                }
                this.logger.error(`[${currentIndex}/${total}] Failed to fetch games for provider ${providerCode}: ${data.msg}`);
                return 0;
            }

            const games = data.data; // Array of { game_uid, game_name, game_type, lang, status, currency }

            const operations: any[] = [];

            games.forEach((g: any) => {
                const gameName = g.game_name || g.game_uid;
                const cleanGameName = gameName.toLowerCase();

                const uidNameCombos = [
                    `${g.game_uid}_${g.game_name}`.toLowerCase(),
                    `${g.game_uid}_${g.game_name}`.replace(/\s+/g, '-').toLowerCase(),
                    `${g.game_uid}_ ${g.game_name}`.toLowerCase(),
                    cleanGameName
                ];

                let mappedIcon = null;
                for (const combo of uidNameCombos) {
                    if (this.gameIconMap[combo]) {
                        mappedIcon = this.gameIconMap[combo];
                        break;
                    }
                }

                if (mappedIcon) {
                    operations.push({
                        updateOne: {
                            filter: { gameCode: g.game_uid }, // Removed provider: providerCode to avoid E11000 duplicate index error
                            update: {
                                $set: {
                                    provider: providerCode,
                                    name: gameName,
                                    type: g.game_type || 'slot',
                                    isActive: g.status === 1
                                    // NOTE: icon is intentionally NOT updated here — icons are managed manually
                                },
                                $setOnInsert: {
                                    category: g.game_type || 'slots',
                                    playCount: 0,
                                    priority: 0,
                                    isPopular: false,
                                    isNewGame: true,
                                    icon: mappedIcon // Only set on first insert, never overwrite manual uploads
                                }
                            },
                            upsert: true
                        }
                    });
                } else {
                    // Game exists in HUIDU API but no image matches in adxwinimages.json
                    // Sync the game name and metadata but force isActive: false so it doesn't render
                    operations.push({
                        updateOne: {
                            filter: { gameCode: g.game_uid },
                            update: {
                                $set: {
                                    provider: providerCode,
                                    name: gameName,
                                    type: g.game_type || 'slot',
                                    isActive: false // Explicit hide globally
                                },
                                $setOnInsert: {
                                    category: g.game_type || 'slots',
                                    playCount: 0,
                                    priority: 0,
                                    isPopular: false,
                                    isNewGame: true,
                                    icon: ''
                                }
                            },
                            upsert: true
                        }
                    });
                }
            });

            if (operations.length > 0) {
                const res = await this.casinoGameModel.bulkWrite(operations);
                this.logger.log(`[${currentIndex}/${total}] Synced ${operations.length} games for provider ${providerCode}`);
                return operations.length; // Actually res.upsertedCount + res.modifiedCount
            }
            this.logger.log(`[${currentIndex}/${total}] No games to sync for provider ${providerCode}`);
            return 0;
        } catch (error) {
            if (error.response?.data?.msg?.includes('Too many requests') || error.message?.includes('Too many requests')) {
                return -1;
            }
            this.logger.error(`[${currentIndex}/${total}] Error in syncGamesForProvider ${providerCode}:`, error.message);
            return 0;
        }
    }
}
