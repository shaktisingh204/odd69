import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../prisma.service';

@Injectable()
export class DiamondPostQueueService {
    private readonly logger = new Logger(DiamondPostQueueService.name);
    private readonly SPORTS_BASE_URL = (process.env.SPORTS_BASE_URL || 'http://primarydiamondfeeds.turnkeyxgaming.com:8000').split(',')[0].trim().replace(/\/$/, '');
    private readonly SPORTS_API_KEY = process.env.SPORTS_API_KEY || '6a9d10424b039000ab1caa11';
    private isRunning = false;

    constructor(
        private prisma: PrismaService,
        private httpService: HttpService,
    ) { }

    /**
     * Retry all PENDING jobs every 30 seconds.
     * Stops retrying a job after 20 total attempts (marks as FAILED permanently).
     */
    @Cron('*/30 * * * * *')
    async retryPendingJobs() {
        if (this.isRunning) return;
        this.isRunning = true;

        try {
            const jobs = await this.prisma.diamondPostQueue.findMany({
                where: { status: 'PENDING', attempts: { lt: 20 } },
                take: 50,
                orderBy: { createdAt: 'asc' },
            });

            if (jobs.length === 0) return;

            this.logger.log(`[PostQueue] Retrying ${jobs.length} pending job(s)...`);

            for (const job of jobs) {
                await this.prisma.diamondPostQueue.update({
                    where: { id: job.id },
                    data: { attempts: { increment: 1 } },
                });

                try {
                    const url = `${this.SPORTS_BASE_URL}/api/v1/post-market`;
                    const payload = {
                        sportsid: job.sportsid,
                        gmid: job.gmid,
                        marketName: job.marketName,
                        mname: job.mname,
                        gtype: job.gtype,
                    };

                    const resp = await firstValueFrom(
                        this.httpService.post(url, payload, {
                            headers: { 'x-turnkeyxgaming-key': this.SPORTS_API_KEY },
                            timeout: 8000,
                        })
                    );

                    // Success — save response and mark DONE
                    await this.prisma.diamondPostQueue.update({
                        where: { id: job.id },
                        data: {
                            status: 'DONE',
                            apiResponse: resp.data ?? {},
                            lastError: null,
                        },
                    });

                    this.logger.log(`[PostQueue] ✓ Job #${job.id} (gmid=${job.gmid}) succeeded`);

                } catch (err) {
                    const errMsg = err?.response?.data
                        ? JSON.stringify(err.response.data).substring(0, 500)
                        : err.message;

                    const newAttempts = (job.attempts || 0) + 1;

                    await this.prisma.diamondPostQueue.update({
                        where: { id: job.id },
                        data: {
                            lastError: errMsg,
                            // Permanently fail after 20 attempts
                            ...(newAttempts >= 20 ? { status: 'FAILED' } : {}),
                        },
                    });

                    this.logger.warn(`[PostQueue] ✗ Job #${job.id} attempt ${newAttempts} failed: ${errMsg}`);
                }
            }
        } catch (e) {
            this.logger.error(`[PostQueue] Cron error: ${e.message}`);
        } finally {
            this.isRunning = false;
        }
    }
}
