import { Controller, Get, All, Query, UseGuards, BadRequestException, Param, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { Public } from '../auth/public.decorator';
import { ExternalApiTokenGuard } from '../auth/external-api-token.guard';
import { SportsService } from '../sports/sports.service';

/**
 * TurnkeyReplicaController
 * ------------------------
 * Acts as a 1:1 exact replica of the Turnkey Gaming API.
 * This allows external partners (like odd69) to drop-in replace their
 * existing Turnkey integration without changing any parsing logic.
 *
 * It intercepts requests to `/api/v1/...` and serves raw
 * upstream data straight from Redis, falling back to real Turnkey for
 * results and unhandled routes.
 */
@Public()
@UseGuards(ExternalApiTokenGuard)
@Controller('v1')
export class TurnkeyReplicaController {
    constructor(private readonly sportsService: SportsService) {}

    /**
     * GET /api/v1/sports
     * Replicates: The main sports list returned by Turnkey.
     * We return the cached raw sports array.
     */
    @Get('sports')
    async getSports() {
        const res = await this.sportsService.getRawSports();
        return res.data || [];
    }
    
    @Get('sports/list')
    async getSportsList() {
        const res = await this.sportsService.getRawSports();
        return res.data || [];
    }

    /**
     * GET /api/v1/sports/matches?sportsid=4
     * Replicates: Flat array of matches or object of arrays.
     * We return the flat array straight from Redis.
     */
    @Get('sports/matches')
    async getMatches(@Query('sportsid') sportsId: string) {
        if (!sportsId) throw new BadRequestException('sportsid query param is required');
        const res = await this.sportsService.getRawEvents(sportsId);
        // Return exactly the raw array to mimic Turnkey
        return res.data || [];
    }

    /**
     * GET /api/v1/embed?url=...
     * Renders a odd69.com hosted page containing the original URL in a full-screen iframe.
     * This ensures the frontend doesn't directly hit primarydiamondfeeds in the URL bar
     * while giving them a reliable embed.
     */
    @Public()
    @Get('embed')
    async getEmbed(@Query('url') targetUrl: string, @Req() req: Request, @Res() res: Response) {
        if (!targetUrl) return res.send('');

        // SECURITY: validate URL against allowed streaming domains to prevent open redirect
        const ALLOWED_HOSTS = [
            'primarydiamondfeeds.com',
            'turnkeyxgaming.com',
            'dpmatka.in',
            'crictv.in',
            'crfreed.com',
            '365cric.com',
            'cfreedstream.xyz',
            'cricstream.me',
            'sqr7.xyz',
        ];
        try {
            const parsed = new URL(targetUrl);
            const hostname = parsed.hostname.toLowerCase();
            const isAllowed = ALLOWED_HOSTS.some(
                (h) => hostname === h || hostname.endsWith('.' + h),
            );
            if (!isAllowed) {
                return res.status(403).json({ message: 'Host not allowed' });
            }
        } catch {
            return res.status(400).json({ message: 'Invalid URL' });
        }

        // We use our internal stream-proxy inside the iframe to avoid upstream CSP blocks
        const host = req.get('host') || 'odd69.com';
        const protocol = host.includes('localhost') ? 'http' : 'https';
        const proxyUrl = `${protocol}://${host}/api/sports/stream-proxy?url=${encodeURIComponent(targetUrl)}`;

        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Stream Viewer</title>
    <style>
        body, html { margin: 0; padding: 0; width: 100%; height: 100%; overflow: hidden; background-color: #000; }
        iframe { width: 100%; height: 100%; border: none; }
    </style>
</head>
<body>
    <!-- The Turnkey stream loads here via stream-proxy to safely strip restrictive CSP headers -->
    <iframe src="${proxyUrl}" allowfullscreen="true" scrolling="no" allow="autoplay; fullscreen"></iframe>
</body>
</html>`;

        res.set('Content-Type', 'text/html');
        return res.send(html);
    }

    /**
     * GET /api/v1/sports/odds?gmid=31005885&sportsid=4
     * Replicates Turnkey response: { data: { odds: { "gmid": [markets] } } }
     */
    @Get('sports/odds')
    async getOdds(@Query('gmid') gmidsParam: string) {
        if (!gmidsParam) return { data: { odds: {} } };
        const gmids = gmidsParam.split(',').map(g => g.trim()).filter(Boolean);
        if (gmids.length === 0) return { data: { odds: {} } };

        const res = await this.sportsService.getRawOddsBatch(gmids);
        return {
            data: {
                odds: res.odds || {}
            }
        };
    }

    /**
     * GET /api/v1/sports/tv?gmid=31005885&sportsid=4
     * Replicates Turnkey response: { success: true, data: { tv_one: "url" } }
     */
    @Get('sports/tv')
    async getTv(@Query('gmid') gmid: string, @Query('sportsid') sportsId: string, @Req() req: Request) {
        if (!gmid || !sportsId) throw new BadRequestException('gmid and sportsid are required');
        const url = await this.sportsService.getTvUrl(sportsId, gmid);
        
        // Wrap the remote Turnkey streaming URL with our internal stream-proxy to strip iframe-ancestors
        const host = req.get('host') || 'odd69.com';
        // Ensure https for production domains, but allow http for localhost dev
        const protocol = host.includes('localhost') ? 'http' : 'https';
        const proxiedUrl = url ? `${protocol}://${host}/api/v1/embed?url=${encodeURIComponent(url)}` : '';
        
        return {
            success: true,
            data: {
                tv_one: proxiedUrl
            }
        };
    }

    /**
     * GET /api/v1/sports/score?gmid=31005885&sportsid=4
     * Replicates Turnkey response: { success: true, data: { scorecard: "url" } }
     */
    @Get('sports/score')
    async getScore(@Query('gmid') gmid: string, @Query('sportsid') sportsId: string, @Req() req: Request) {
        if (!gmid || !sportsId) throw new BadRequestException('gmid and sportsid are required');
        const url = await this.sportsService.getScoreUrl(sportsId, gmid);
        
        // Wrap the remote Turnkey scorecard URL with our internal stream-proxy to strip iframe-ancestors
        const host = req.get('host') || 'odd69.com';
        const protocol = host.includes('localhost') ? 'http' : 'https';
        const proxiedUrl = url ? `${protocol}://${host}/api/v1/embed?url=${encodeURIComponent(url)}` : '';

        return {
            success: true,
            data: {
                scorecard: proxiedUrl
            }
        };
    }

    /**
     * ALL /api/v1/* (WILDCARD PROXY - INCLUDING RESULTS/SETTLEMENT)
     * Catches any other request (like /api/v1/result, /api/v1/settlement)
     * and forwards it directly to the real Turnkey Gaming API so odd69 
     * loses absolutely zero functionality by using odd69.com as a drop-in.
     */
    @All('*path')
    async turnkeyWildcardProxy(@Param('path') path: string, @Req() req: Request) {
        // path contains everything after /v1/ (e.g., 'result' or 'sports/virtual')
        return this.sportsService.passthroughToTurnkey(
            `/api/v1/${path}`, 
            req.query, 
            req.method, 
            req.body
        );
    }
}
