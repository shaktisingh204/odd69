/**
 * @deprecated This REST-based service is deprecated.
 * All sports admin operations now use direct Server Actions in @/actions/sports.ts
 * which query MongoDB (betfair_sports, betfair_events, sport_leagues) directly.
 *
 * This file is kept for any remaining legacy references and will be removed in a
 * future cleanup pass.
 */
import api from './api';

/** @deprecated Use getSports() from @/actions/sports instead */
export const sportsService = {
    /** @deprecated */
    getSports: async () => {
        const response = await api.get('/sports/list');
        return response.data;
    },
    /** @deprecated */
    getCompetitions: async (sportId?: string) => {
        const response = await api.get(`/sports/competitions${sportId ? `?sportId=${sportId}` : ''}`);
        return response.data;
    },
};
