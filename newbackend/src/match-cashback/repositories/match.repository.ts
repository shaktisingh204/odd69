import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Event, EventDocument } from '../../sports/schemas/event.schema';
import { Match, MatchDocument } from '../schemas/match.schema';

@Injectable()
export class MatchRepository {
    constructor(
        @InjectModel(Match.name) private readonly matchModel: Model<MatchDocument>,
        @InjectModel(Event.name) private readonly eventModel: Model<EventDocument>,
    ) { }

    async findByMatchId(matchId: string): Promise<MatchDocument | null> {
        return this.matchModel.findOne({ matchId: String(matchId) }).exec();
    }

    async findManyByMatchIds(matchIds: string[]): Promise<MatchDocument[]> {
        if (matchIds.length === 0) {
            return [];
        }

        return this.matchModel.find({ matchId: { $in: matchIds.map((id) => String(id)) } }).exec();
    }

    async ensureMatch(params: {
        matchId: string;
        teamA?: string;
        teamB?: string;
        matchDate?: Date;
    }): Promise<MatchDocument | null> {
        const existing = await this.findByMatchId(params.matchId);
        if (existing) {
            return existing;
        }

        const event = await this.eventModel.findOne({ event_id: String(params.matchId) }).lean();
        if (event) {
            const teams = this.extractTeams(event);
            return this.matchModel.findOneAndUpdate(
                { matchId: String(params.matchId) },
                {
                    $set: {
                        matchId: String(params.matchId),
                        teamA: teams.teamA,
                        teamB: teams.teamB,
                        matchDate: event.open_date ? new Date(event.open_date) : new Date(),
                        status: this.mapEventStatus(event.match_status),
                    },
                },
                { upsert: true, returnDocument: 'after' },
            ).exec();
        }

        if (params.teamA && params.teamB && params.matchDate) {
            return this.matchModel.create({
                matchId: String(params.matchId),
                teamA: params.teamA,
                teamB: params.teamB,
                matchDate: params.matchDate,
                status: 'upcoming',
            });
        }

        return null;
    }

    async markFinished(matchId: string, winningTeam: string): Promise<void> {
        await this.matchModel.findOneAndUpdate(
            { matchId: String(matchId) },
            {
                $set: {
                    status: 'finished',
                    winningTeam,
                    settledAt: new Date(),
                },
            },
            { upsert: false },
        ).exec();
    }

    private mapEventStatus(matchStatus?: string): string {
        const normalized = String(matchStatus || '').toLowerCase();

        if (normalized.includes('complete') || normalized.includes('finished')) {
            return 'finished';
        }

        if (normalized.includes('play') || normalized.includes('live')) {
            return 'live';
        }

        return 'upcoming';
    }

    /**
     * Returns the match_status from the underlying Event document for a given matchId.
     * Used to check if the event was dismissed/abandoned before settling.
     */
    async getEventMatchStatus(matchId: string): Promise<string | null> {
        const event = await this.eventModel.findOne({ event_id: String(matchId) }).lean();
        return (event?.match_status as string) || (event as any)?.status || null;
    }

    private extractTeams(event: any): { teamA: string; teamB: string } {
        if (event?.home_team && event?.away_team) {
            return {
                teamA: event.home_team,
                teamB: event.away_team,
            };
        }

        const eventName = String(event?.event_name || '');
        const parts = eventName.split(/\s+vs\s+|\s+v\s+/i).map((part) => part.trim()).filter(Boolean);

        return {
            teamA: parts[0] || 'Team A',
            teamB: parts[1] || 'Team B',
        };
    }
}
