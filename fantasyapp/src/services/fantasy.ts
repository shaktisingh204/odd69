import api from './api';

// ── Matches ────────────────────────────────────────────────
export const getMatches = (status: number, page = 1, limit = 30, managed?: boolean) =>
  api.get('/fantasy/matches', { params: { status, page, limit, ...(managed ? { managed: true } : {}) } });

export const getMatch = (id: string | number) =>
  api.get(`/fantasy/matches/${id}`);

export const getMatchSquads = (id: string | number) =>
  api.get(`/fantasy/matches/${id}/squads`);

export const getMatchContests = (id: string | number) =>
  api.get(`/fantasy/matches/${id}/contests`);

export const getMatchLive = (id: string | number) =>
  api.get(`/fantasy/matches/${id}/live`);

export const getMatchPoints = (id: string | number) =>
  api.get(`/fantasy/matches/${id}/points`);

export const getMatchScorecard = (id: string | number) =>
  api.get(`/fantasy/matches/${id}/scorecard`);

// ── Teams ──────────────────────────────────────────────────
export const createTeam = (data: {
  matchId: string | number;
  playerIds: number[];
  captainId: number;
  viceCaptainId: number;
}) => api.post('/fantasy/teams', data);

export const getMyTeams = (matchId: string | number) =>
  api.get(`/fantasy/my-teams/${matchId}`);

export const cloneTeam = (teamId: string, matchId: string | number) =>
  api.post('/fantasy/teams/clone', { teamId, matchId });

// ── Contests ───────────────────────────────────────────────
export const joinContest = (data: {
  contestId: string;
  teamId: string;
  promocode?: string;
}) => api.post('/fantasy/join-contest', data);

export const getContestLeaderboard = (contestId: string, page = 1) =>
  api.get(`/fantasy/contests/${contestId}/leaderboard`, { params: { page } });

export const joinByInvite = (code: string, teamId: string) =>
  api.post('/fantasy/join-by-invite', { code, teamId });

// ── Profile / History ──────────────────────────────────────
export const getProfile = () => api.get('/auth/profile');

export const getHistory = (page = 1, limit = 20) =>
  api.get('/fantasy/history', { params: { page, limit } });

export const getMyRank = () => api.get('/fantasy/my-rank');

// ── Streak & Powerups ──────────────────────────────────────
export const getStreak = () => api.get('/fantasy/streak');

export const claimStreak = () => api.post('/fantasy/streak/claim');

export const getPowerups = () => api.get('/fantasy/powerups');

// ── Leaderboard ────────────────────────────────────────────
export const getSeasonLeaderboard = () => api.get('/fantasy/season-leaderboard');

// ── Notifications ──────────────────────────────────────────
export const getNotifications = () => api.get('/fantasy/notifications');

export const markNotificationsRead = (ids: string[]) =>
  api.post('/fantasy/notifications/read', { ids });

// ── Auth ───────────────────────────────────────────────────
export const login = (phone: string, password: string) =>
  api.post('/auth/login', { phone, password });

export const register = (data: {
  phone: string;
  password: string;
  name: string;
  referralCode?: string;
}) => api.post('/auth/register', data);
