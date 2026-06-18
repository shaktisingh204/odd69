import React from 'react';

export const metadata = {
    title: 'API Reference | Developer Docs',
    description: 'Complete REST + WebSocket API reference for building client apps.',
    robots: { index: false, follow: false },
};

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'WS';
type Auth = 'Public' | 'JWT';

interface Endpoint {
    method: Method;
    path: string;
    auth: Auth;
    desc: string;
    body?: string;
}

interface Section {
    id: string;
    title: string;
    intro?: string;
    endpoints: Endpoint[];
    notes?: string[];
}

const METHOD_STYLES: Record<Method, string> = {
    GET: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    POST: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
    PATCH: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    DELETE: 'bg-red-500/15 text-red-400 border-red-500/30',
    WS: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
};

const SECTIONS: Section[] = [
    {
        id: 'auth',
        title: '1. Authentication & Onboarding',
        intro: 'Register, log in, and manage credentials. Login returns a JWT — send it as `Authorization: Bearer <token>` on every protected request.',
        endpoints: [
            { method: 'POST', path: '/auth/signup', auth: 'Public', desc: 'Create a new account', body: 'username, password, phone/email, referralCode?' },
            { method: 'POST', path: '/auth/login', auth: 'Public', desc: 'Login with password — returns JWT token + user object', body: 'identifier, password' },
            { method: 'POST', path: '/auth/login-otp', auth: 'Public', desc: 'Login with OTP code', body: 'identifier, code' },
            { method: 'POST', path: '/auth/refresh', auth: 'JWT', desc: 'Rotate / refresh the JWT before expiry' },
            { method: 'GET', path: '/auth/profile', auth: 'JWT', desc: 'Get current logged-in user profile' },
            { method: 'POST', path: '/auth/send-otp', auth: 'Public', desc: 'Send SMS OTP', body: 'phoneNumber, purpose (REGISTER | FORGOT_PASSWORD | BIND_MOBILE)' },
            { method: 'POST', path: '/auth/verify-otp', auth: 'Public', desc: 'Verify SMS OTP', body: 'phoneNumber, code, purpose' },
            { method: 'POST', path: '/auth/send-email-otp', auth: 'Public', desc: 'Send email OTP', body: 'email, purpose' },
            { method: 'POST', path: '/auth/verify-email-otp', auth: 'Public', desc: 'Verify email OTP', body: 'email, code, purpose' },
            { method: 'POST', path: '/auth/forgot-password-phone', auth: 'Public', desc: 'Start password reset via phone', body: 'phoneNumber' },
            { method: 'POST', path: '/auth/reset-password-phone', auth: 'Public', desc: 'Complete password reset via phone', body: 'phoneNumber, code, newPassword' },
            { method: 'POST', path: '/auth/forgot-password-email', auth: 'Public', desc: 'Start password reset via email', body: 'email' },
            { method: 'POST', path: '/auth/reset-password-email', auth: 'Public', desc: 'Complete password reset via email', body: 'email, code, newPassword' },
            { method: 'POST', path: '/auth/bind-mobile', auth: 'JWT', desc: 'Attach a verified phone to the account', body: 'phoneNumber, code' },
            { method: 'POST', path: '/auth/bind-email', auth: 'JWT', desc: 'Attach a verified email to the account', body: 'email, code' },
        ],
    },
    {
        id: 'user',
        title: '2. Profile & Wallet',
        intro: 'Balances, transaction history, and profile management. The wallet object contains fiat balance, crypto balance, bonus wallet, and the activeWallet flag.',
        endpoints: [
            { method: 'GET', path: '/user/wallet', auth: 'JWT', desc: 'Get all balances (fiat, crypto, bonus, activeWallet)' },
            { method: 'GET', path: '/user/transactions', auth: 'JWT', desc: 'Wallet transaction history' },
            { method: 'GET', path: '/user/casino-transactions', auth: 'JWT', desc: 'Casino ledger history', body: 'query: page?, limit?' },
            { method: 'PATCH', path: '/user/wallet-preference', auth: 'JWT', desc: 'Switch active wallet', body: "wallet ('fiat' | 'crypto')" },
            { method: 'PATCH', path: '/user/username', auth: 'JWT', desc: 'Change username', body: 'username' },
            { method: 'PATCH', path: '/user/profile', auth: 'JWT', desc: 'Update profile fields', body: 'firstName?, lastName?, country?, city?' },
            { method: 'PATCH', path: '/user/change-password', auth: 'JWT', desc: 'Change password', body: 'currentPassword, newPassword' },
        ],
    },
    {
        id: 'transactions',
        title: '3. Deposits & Withdrawals',
        intro: 'Generic transaction ledger plus the manual UPI deposit flow. For gateway deposits see the Payments section.',
        endpoints: [
            { method: 'POST', path: '/transactions/deposit', auth: 'JWT', desc: 'Submit a deposit request', body: 'amount, paymentMethod, utr, proof?, currency, type' },
            { method: 'POST', path: '/transactions/withdraw', auth: 'JWT', desc: 'Request a withdrawal', body: 'amount, paymentDetails' },
            { method: 'GET', path: '/transactions/pending-deposit', auth: 'JWT', desc: 'Get the user’s pending deposit, if any' },
            { method: 'GET', path: '/transactions/my/:userId', auth: 'JWT', desc: 'Get own transactions by user id' },
            { method: 'GET', path: '/manual-deposit/config', auth: 'Public', desc: 'Active UPI accounts / manual deposit configuration' },
            { method: 'POST', path: '/manual-deposit/submit', auth: 'JWT', desc: 'Submit manual UPI deposit with UTR', body: 'amount, utr, bonusCode?, upiId?, accountTag?' },
            { method: 'GET', path: '/manual-deposit/retry-state', auth: 'JWT', desc: 'Gateway retry state for the deposit chooser' },
        ],
    },
    {
        id: 'payments',
        title: '4. Payment Gateways',
        intro: 'Multiple UPI gateways exist (payment, payment0…payment9) — they share the same shape: POST create returns a checkout URL, the gateway calls notify (webhook, server-side only). Confirm with the team which gateway is live before wiring one. NOWPayments handles crypto and credits the crypto balance.',
        endpoints: [
            { method: 'POST', path: '/payment0/create', auth: 'JWT', desc: 'Create UPI deposit order (same shape for payment1…payment9)', body: 'orderNo, amount, bonusCode?, promoCode?, returnUrl?' },
            { method: 'GET', path: '/payment3/query', auth: 'JWT', desc: 'Query deposit order status (where supported: payment3/4/5/9)', body: 'query: orderNo' },
            { method: 'POST', path: '/nowpayments/create', auth: 'JWT', desc: 'Create crypto deposit', body: 'amount, payCurrency, priceCurrency? (usd), bonusCode?, promoCode?' },
            { method: 'GET', path: '/nowpayments/currencies', auth: 'JWT', desc: 'Supported crypto currencies' },
            { method: 'GET', path: '/nowpayments/estimate/:toCurrency/:amount', auth: 'JWT', desc: 'Estimate crypto amount for a fiat value' },
            { method: 'GET', path: '/nowpayments/status/:paymentId', auth: 'JWT', desc: 'Poll crypto payment status' },
        ],
        notes: [
            'Webhook endpoints (/paymentN/notify, /nowpayments/ipn) are called by the gateways — the app never calls them.',
            'After a successful deposit the wallet balance is pushed in real time via the walletUpdate socket event.',
        ],
    },
    {
        id: 'sports',
        title: '5. Sports — Catalogue & Live Data',
        intro: 'All sports reads are public. Live odds come from the Sportradar pipeline via Redis; for sub-second updates use the WebSocket (section 11) instead of polling.',
        endpoints: [
            { method: 'GET', path: '/sports/sidebar', auth: 'Public', desc: 'Sport → competition → event navigation tree' },
            { method: 'GET', path: '/sports/list', auth: 'Public', desc: 'All sports' },
            { method: 'GET', path: '/sports/live', auth: 'Public', desc: 'Live events', body: 'query: sportId?' },
            { method: 'GET', path: '/sports/upcoming', auth: 'Public', desc: 'Upcoming events', body: 'query: sportId?' },
            { method: 'GET', path: '/sports/all-events', auth: 'Public', desc: 'Combined live + upcoming', body: 'query: sportId?' },
            { method: 'GET', path: '/sports/top-events', auth: 'Public', desc: 'Trending events' },
            { method: 'GET', path: '/sports/home-events', auth: 'Public', desc: 'Featured events for the home screen' },
            { method: 'GET', path: '/sports/leagues', auth: 'Public', desc: 'Visible leagues with images' },
            { method: 'GET', path: '/sports/match-details/:sportId/:matchId', auth: 'Public', desc: 'Full match detail with markets & odds', body: 'query: userId? (applies per-user market locks)' },
            { method: 'GET', path: '/sports/scorecard/:matchId', auth: 'Public', desc: 'Live scorecard' },
            { method: 'GET', path: '/sports/tv-url/:sportId/:matchId', auth: 'Public', desc: 'Live stream URL' },
            { method: 'GET', path: '/sports/scorecard-tv/:sportId/:matchId', auth: 'Public', desc: 'Scorecard + TV combined' },
            { method: 'GET', path: '/sports/sportradar/sports', auth: 'Public', desc: 'Sportradar sports list (cached)' },
            { method: 'GET', path: '/sports/sportradar/inplay', auth: 'Public', desc: 'All in-play events across sports' },
            { method: 'GET', path: '/sports/sportradar/inplay/:sportId', auth: 'Public', desc: 'In-play events for one sport' },
            { method: 'GET', path: '/sports/sportradar/upcoming', auth: 'Public', desc: 'Upcoming, paginated', body: 'query: sportId, pageNo?' },
            { method: 'GET', path: '/sports/sportradar/event', auth: 'Public', desc: 'Full event snapshot', body: 'query: eventId (e.g. sr:match:123)' },
            { method: 'GET', path: '/sports/sportradar/market', auth: 'Public', desc: 'Full market blob for an event', body: 'query: sportId, eventId' },
            { method: 'GET', path: '/sports/sportradar/events-count', auth: 'Public', desc: 'Upcoming + inplay counts per sport' },
        ],
        notes: ['Sportradar ids are URL-encoded, e.g. sr%3Asport%3A1 for sr:sport:1.'],
    },
    {
        id: 'betting',
        title: '6. Sports — Placing Bets',
        intro: 'Validate odds first, then place. Bets debit the wallet immediately; settlement is pushed via walletUpdate on the socket.',
        endpoints: [
            { method: 'POST', path: '/sports/check-odds', auth: 'JWT', desc: 'Validate current odds before placing', body: '{ bets: [{ marketId, selectionId, odds }] }' },
            { method: 'POST', path: '/sports/bet/place', auth: 'JWT', desc: 'Place a sports bet', body: "matchId, marketId, selectionId, selectionName, marketName, eventName, rate, amount, type ('back'|'lay'), marketType" },
            { method: 'GET', path: '/sports/bets/:userId', auth: 'JWT', desc: 'Bets for a user' },
            { method: 'POST', path: '/bets', auth: 'JWT', desc: 'Place bet (unified bets module)' },
            { method: 'GET', path: '/bets/my-bets', auth: 'JWT', desc: 'Logged-in user’s bets' },
            { method: 'GET', path: '/bets/:id/cashout-offer', auth: 'JWT', desc: 'Cashout offer → status: AVAILABLE | SUSPENDED | UNAVAILABLE' },
            { method: 'POST', path: '/bets/:id/cashout', auth: 'JWT', desc: 'Execute full or partial cashout', body: 'fraction (0–1), clientExpectedValue, fullRefund?' },
        ],
    },
    {
        id: 'casino',
        title: '7. Casino Lobby & Launch',
        intro: 'Catalogue browsing is public; launching a game requires JWT and returns a provider game URL to open in a webview.',
        endpoints: [
            { method: 'GET', path: '/casino/categories', auth: 'Public', desc: 'Game categories', body: "query: type ('live' | 'casino')" },
            { method: 'GET', path: '/casino/providers-list', auth: 'Public', desc: 'Providers', body: 'query: category?' },
            { method: 'GET', path: '/casino/games', auth: 'Public', desc: 'Game catalogue, paginated', body: 'query: provider?, category?, search?, page?, limit?, type?' },
            { method: 'GET', path: '/casino/section/:section', auth: 'Public', desc: 'Curated sections: popular | new | slots | live | table | crash | home | top' },
            { method: 'POST', path: '/casino/launch', auth: 'JWT', desc: 'Launch a game → returns game URL', body: 'provider, gameId, isLobby?, walletMode?' },
            { method: 'GET', path: '/casino/my-bets', auth: 'JWT', desc: 'Casino bet history', body: 'query: limit?, gameCode?' },
        ],
    },
    {
        id: 'originals',
        title: '8. Originals (In-house Games)',
        intro: 'All gameplay endpoints require JWT. Stateful games (Mines, Hi-Lo, Towers) follow start → action → cashout, with /active to resume and /history for past rounds. Single-shot games (Keno, Wheel, Roulette, Coinflip, Color, Lotto, Jackpot) take the bet in one /play call and return the result + payout.',
        endpoints: [
            { method: 'GET', path: '/originals/games', auth: 'Public', desc: 'List of original games' },
            { method: 'GET', path: '/originals/games/:key', auth: 'Public', desc: 'Single game config by key' },
            { method: 'GET', path: '/originals/access/me', auth: 'JWT', desc: 'Player’s access flags for originals' },
            { method: 'POST', path: '/mines/start', auth: 'JWT', desc: 'Start a Mines round', body: 'betAmount, minesCount, …' },
            { method: 'POST', path: '/mines/reveal', auth: 'JWT', desc: 'Reveal a tile', body: 'tileIndex' },
            { method: 'POST', path: '/mines/cashout', auth: 'JWT', desc: 'Cash out the active Mines round' },
            { method: 'GET', path: '/mines/active', auth: 'JWT', desc: 'Resume active round' },
            { method: 'GET', path: '/mines/history', auth: 'JWT', desc: 'Past rounds' },
            { method: 'POST', path: '/originals/hilo/start', auth: 'JWT', desc: 'Start Hi-Lo', body: 'betAmount' },
            { method: 'POST', path: '/originals/hilo/action', auth: 'JWT', desc: 'Guess', body: "action ('higher' | 'lower')" },
            { method: 'POST', path: '/originals/hilo/cashout', auth: 'JWT', desc: 'Cash out Hi-Lo' },
            { method: 'POST', path: '/originals/towers/start', auth: 'JWT', desc: 'Start Towers', body: 'betAmount, riskLevel' },
            { method: 'POST', path: '/originals/towers/pick', auth: 'JWT', desc: 'Pick a tile', body: 'tileIndex' },
            { method: 'POST', path: '/originals/towers/cashout', auth: 'JWT', desc: 'Cash out Towers' },
            { method: 'GET', path: '/originals/wheel/preview', auth: 'JWT', desc: 'Wheel segments preview', body: 'query: risk (low|medium|high), segments (10–50)' },
            { method: 'POST', path: '/originals/wheel/play', auth: 'JWT', desc: 'Spin the wheel', body: 'betAmount, risk, segments' },
            { method: 'POST', path: '/originals/keno/play', auth: 'JWT', desc: 'Play Keno', body: 'selectedNumbers[], betAmount' },
            { method: 'POST', path: '/originals/roulette/play', auth: 'JWT', desc: 'Play Roulette', body: 'bets/selections, betAmount' },
            { method: 'POST', path: '/originals/coinflip/play', auth: 'JWT', desc: 'Flip', body: "choice ('heads' | 'tails'), betAmount" },
            { method: 'POST', path: '/originals/color/play', auth: 'JWT', desc: 'Play Color', body: 'selectedColor, betAmount' },
            { method: 'POST', path: '/originals/lotto/play', auth: 'JWT', desc: 'Play Lotto', body: 'selectedNumbers[], betAmount' },
            { method: 'POST', path: '/originals/jackpot/play', auth: 'JWT', desc: 'Enter Jackpot', body: 'betAmount' },
        ],
        notes: ['Every single-shot game also exposes GET …/history?limit= for past results (keno, wheel, roulette, coinflip, color, lotto, jackpot).'],
    },
    {
        id: 'bonus',
        title: '9. Bonuses, Promotions, Referral, VIP & Check-in',
        endpoints: [
            { method: 'POST', path: '/bonus/validate', auth: 'JWT', desc: 'Validate a bonus code', body: 'code, depositAmount?, depositCurrency? (INR | CRYPTO)' },
            { method: 'GET', path: '/bonus/active', auth: 'JWT', desc: 'Active bonuses + wagering progress' },
            { method: 'GET', path: '/bonus/history', auth: 'JWT', desc: 'Bonus history' },
            { method: 'POST', path: '/bonus/forfeit', auth: 'JWT', desc: 'Forfeit an active bonus', body: 'type (CASINO | SPORTS)' },
            { method: 'GET', path: '/bonus/signup-options', auth: 'Public', desc: 'Signup bonus options' },
            { method: 'POST', path: '/bonus/redeem-signup', auth: 'JWT', desc: 'Redeem signup bonus', body: 'bonusCode' },
            { method: 'GET', path: '/bonus/promotions', auth: 'Public', desc: 'Bonus promotions list' },
            { method: 'GET', path: '/promotions/app-home', auth: 'Public', desc: 'Promotions for the app home screen' },
            { method: 'GET', path: '/promotions', auth: 'Public', desc: 'All promotions', body: 'query: active?, category?' },
            { method: 'GET', path: '/promotions/:id', auth: 'Public', desc: 'Single promotion' },
            { method: 'GET', path: '/promo-cards', auth: 'Public', desc: 'Promo cards', body: 'query: active?' },
            { method: 'GET', path: '/match-cashback/promotions/active', auth: 'Public', desc: 'Active match-cashback promotions' },
            { method: 'GET', path: '/referral/stats', auth: 'JWT', desc: 'Referral stats for the user' },
            { method: 'POST', path: '/referral/generate', auth: 'JWT', desc: 'Generate referral code' },
            { method: 'POST', path: '/referral/apply', auth: 'JWT', desc: 'Apply a referral code', body: 'code' },
            { method: 'POST', path: '/vip/apply', auth: 'JWT', desc: 'Apply for VIP' },
            { method: 'GET', path: '/vip/my-status', auth: 'JWT', desc: 'Current VIP tier / status' },
            { method: 'GET', path: '/vip/my-application', auth: 'JWT', desc: 'VIP application status' },
            { method: 'GET', path: '/daily-checkin/config', auth: 'Public', desc: 'Check-in rewards configuration' },
            { method: 'GET', path: '/daily-checkin/status', auth: 'JWT', desc: 'Today’s check-in status + streak' },
            { method: 'POST', path: '/daily-checkin/claim', auth: 'JWT', desc: 'Claim daily reward', body: 'useSpinWheel?' },
            { method: 'GET', path: '/daily-checkin/history', auth: 'JWT', desc: 'Check-in history', body: 'query: page?, limit?' },
            { method: 'GET', path: '/daily-checkin/leaderboard', auth: 'Public', desc: 'Check-in leaderboard', body: 'query: limit?' },
        ],
    },
    {
        id: 'misc',
        title: '10. Notifications, Support & FAQ',
        endpoints: [
            { method: 'GET', path: '/notifications/my/:userId', auth: 'JWT', desc: 'In-app notifications' },
            { method: 'GET', path: '/notifications/unread-count/:userId', auth: 'JWT', desc: 'Unread badge count' },
            { method: 'PATCH', path: '/notifications/:id/read', auth: 'JWT', desc: 'Mark one as read' },
            { method: 'PATCH', path: '/notifications/mark-all-read/:userId', auth: 'JWT', desc: 'Mark all as read' },
            { method: 'POST', path: '/push-notifications/register-device', auth: 'JWT', desc: 'Register OneSignal device', body: 'playerId' },
            { method: 'GET', path: '/support/my-tickets', auth: 'JWT', desc: 'Support tickets for the user' },
            { method: 'POST', path: '/support/create', auth: 'JWT', desc: 'Open a ticket', body: 'subject, category?, message?' },
            { method: 'GET', path: '/support/ticket/:id', auth: 'JWT', desc: 'Ticket detail + messages' },
            { method: 'POST', path: '/support/message', auth: 'JWT', desc: 'Reply on a ticket', body: 'ticketId, message' },
            { method: 'GET', path: '/faq', auth: 'Public', desc: 'FAQ entries' },
        ],
    },
];

const SOCKET_CLIENT_EVENTS = [
    { event: 'join-match', payload: 'matchId: string', desc: 'Join a match room — server seeds current odds instantly' },
    { event: 'match-heartbeat', payload: 'matchId: string', desc: 'Keep-alive while watching a match (send periodically)' },
    { event: 'leave-match', payload: 'matchId: string', desc: 'Leave the match room' },
    { event: 'join-odds-sports', payload: '—', desc: 'Join the sports listing room (lobby odds)' },
    { event: 'subscribeToUserRoom', payload: '{ userId }', desc: 'Subscribe to wallet + notification events for the user' },
];

const SOCKET_SERVER_EVENTS = [
    { event: 'socket-data', payload: "{ messageType: 'odds' | 'market_status' | 'sportradar_odds', eventId, data[] }", desc: 'Live odds & market status updates' },
    { event: 'walletUpdate', payload: '{ userId, …balances }', desc: 'Balance changed (deposit, bet, settlement)' },
    { event: 'balanceUpdate', payload: '{ userId, balance }', desc: 'Lightweight balance push' },
    { event: 'newNotification', payload: '{ _id, title, body, createdAt }', desc: 'In-app notification toast' },
    { event: 'live-pulse', payload: '{ jackpotAmount, activities, onlineCount }', desc: 'Jackpot ticker + live activity feed' },
];

function MethodBadge({ method }: { method: Method }) {
    return (
        <span className={`inline-block w-[58px] text-center text-[10px] font-black tracking-wider rounded-md border px-1.5 py-1 ${METHOD_STYLES[method]}`}>
            {method}
        </span>
    );
}

function AuthBadge({ auth }: { auth: Auth }) {
    return auth === 'JWT' ? (
        <span className="inline-block text-[10px] font-bold rounded-full px-2 py-0.5 bg-brand-gold/10 text-brand-gold border border-brand-gold/25">JWT</span>
    ) : (
        <span className="inline-block text-[10px] font-bold rounded-full px-2 py-0.5 bg-white/[0.06] text-gray-400 border border-white/10">Public</span>
    );
}

function EndpointRow({ ep }: { ep: Endpoint }) {
    return (
        <div className="flex flex-col gap-1.5 px-4 py-3 border-b border-white/[0.04] last:border-b-0 hover:bg-white/[0.02] transition-colors">
            <div className="flex flex-wrap items-center gap-2.5">
                <MethodBadge method={ep.method} />
                <code className="text-[13px] font-semibold text-gray-100 break-all">/api{ep.path}</code>
                <AuthBadge auth={ep.auth} />
            </div>
            <p className="text-[13px] text-gray-400 pl-[70px] max-md:pl-0">{ep.desc}</p>
            {ep.body && (
                <p className="text-[12px] text-gray-500 pl-[70px] max-md:pl-0">
                    <span className="text-gray-400 font-semibold">{ep.body.startsWith('query:') ? '' : 'Body: '}</span>
                    <code className="text-emerald-300/70">{ep.body}</code>
                </p>
            )}
        </div>
    );
}

function CodeBlock({ children }: { children: string }) {
    return (
        <pre className="bg-[#0B0C10] border border-white/[0.06] rounded-xl p-4 overflow-x-auto text-[12.5px] leading-relaxed text-gray-300">
            <code>{children}</code>
        </pre>
    );
}

export default function ApiDocsPage() {
    return (
        <div className="min-h-[calc(100vh-64px)] bg-bg-zeero-3 text-white pb-32 overflow-y-auto">
            {/* Hero */}
            <div className="relative overflow-hidden bg-gradient-to-b from-brand-gold/6 via-[#0F1016] to-[#0C0D12] border-b border-white/[0.04]">
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_0%,rgba(139,92,246,0.06),transparent_60%)]" />
                <div className="relative max-w-5xl mx-auto px-4 pt-12 pb-10">
                    <div className="inline-flex items-center gap-2 bg-brand-gold/10 border border-brand-gold/20 rounded-full px-4 py-1.5 text-brand-gold text-xs font-black uppercase tracking-widest mb-5">
                        Developer Reference
                    </div>
                    <h1 className="text-3xl md:text-4xl font-black tracking-tight mb-3">Platform API Documentation</h1>
                    <p className="text-gray-400 text-sm md:text-base max-w-2xl">
                        Complete REST + WebSocket reference for building client applications — authentication, wallet,
                        deposits, sports betting, casino, originals, bonuses, and real-time events.
                    </p>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-4 flex gap-8 pt-8">
                {/* Sticky TOC */}
                <nav className="hidden lg:block w-56 shrink-0">
                    <div className="sticky top-6 space-y-1 text-[13px]">
                        <p className="text-gray-500 uppercase text-[10px] font-black tracking-widest mb-2 px-2">On this page</p>
                        <a href="#conventions" className="block px-2 py-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/[0.04]">Conventions</a>
                        {SECTIONS.map((s) => (
                            <a key={s.id} href={`#${s.id}`} className="block px-2 py-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/[0.04]">
                                {s.title.replace(/^\d+\.\s/, '')}
                            </a>
                        ))}
                        <a href="#websocket" className="block px-2 py-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/[0.04]">Real-time (WebSocket)</a>
                        <a href="#quickstart" className="block px-2 py-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/[0.04]">Quick Start</a>
                    </div>
                </nav>

                {/* Content */}
                <div className="flex-1 min-w-0 space-y-10">
                    {/* Conventions */}
                    <section id="conventions" className="scroll-mt-6">
                        <h2 className="text-xl font-black mb-4">Conventions</h2>
                        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 space-y-3 text-[13.5px] text-gray-300">
                            <p><span className="font-bold text-white">Base URL</span> — every path below is prefixed with <code className="text-brand-gold">/api</code>. Production: <code className="text-emerald-300/80">https://&lt;domain&gt;/api</code> · Local dev: <code className="text-emerald-300/80">http://localhost:9828/api</code></p>
                            <p><span className="font-bold text-white">Authentication</span> — endpoints marked <AuthBadge auth="JWT" /> require <code className="text-brand-gold">Authorization: Bearer &lt;token&gt;</code>. Get the token from <code>POST /api/auth/login</code>; refresh it via <code>POST /api/auth/refresh</code> before expiry.</p>
                            <p><span className="font-bold text-white">Validation</span> — request bodies are whitelisted server-side: unknown fields are silently dropped, so field names must match exactly. <code>?</code> marks optional fields.</p>
                            <p><span className="font-bold text-white">Errors</span> — standard NestJS shape: <code className="text-gray-400">{'{ statusCode, message, error }'}</code>. 401 means the token is missing/expired; 400 lists validation failures in <code>message</code>.</p>
                            <p><span className="font-bold text-white">Real-time</span> — live odds, balance updates and notifications are pushed over Socket.IO on the same host (see the WebSocket section). Prefer the socket over polling for odds.</p>
                        </div>
                    </section>

                    {/* Endpoint sections */}
                    {SECTIONS.map((section) => (
                        <section key={section.id} id={section.id} className="scroll-mt-6">
                            <h2 className="text-xl font-black mb-2">{section.title}</h2>
                            {section.intro && <p className="text-[13.5px] text-gray-400 mb-4 max-w-3xl">{section.intro}</p>}
                            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
                                {section.endpoints.map((ep) => (
                                    <EndpointRow key={`${ep.method}-${ep.path}`} ep={ep} />
                                ))}
                            </div>
                            {section.notes && (
                                <ul className="mt-3 space-y-1.5">
                                    {section.notes.map((n, i) => (
                                        <li key={i} className="text-[12.5px] text-amber-300/70 flex gap-2">
                                            <span className="shrink-0">⚠️</span>{n}
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </section>
                    ))}

                    {/* WebSocket */}
                    <section id="websocket" className="scroll-mt-6">
                        <h2 className="text-xl font-black mb-2">11. Real-time — Socket.IO</h2>
                        <p className="text-[13.5px] text-gray-400 mb-4 max-w-3xl">
                            Connect to the WebSocket host (same origin as the API, default namespace). Live odds use
                            match rooms; user events use the user room. Send a heartbeat while a match screen is open.
                        </p>

                        <h3 className="text-sm font-black text-gray-300 uppercase tracking-wider mb-2">Client → Server</h3>
                        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden mb-6">
                            {SOCKET_CLIENT_EVENTS.map((e) => (
                                <div key={e.event} className="flex flex-col gap-1 px-4 py-3 border-b border-white/[0.04] last:border-b-0">
                                    <div className="flex flex-wrap items-center gap-2.5">
                                        <MethodBadge method="WS" />
                                        <code className="text-[13px] font-semibold text-purple-300">{e.event}</code>
                                        <code className="text-[11.5px] text-gray-500">{e.payload}</code>
                                    </div>
                                    <p className="text-[13px] text-gray-400 pl-[70px] max-md:pl-0">{e.desc}</p>
                                </div>
                            ))}
                        </div>

                        <h3 className="text-sm font-black text-gray-300 uppercase tracking-wider mb-2">Server → Client</h3>
                        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden mb-6">
                            {SOCKET_SERVER_EVENTS.map((e) => (
                                <div key={e.event} className="flex flex-col gap-1 px-4 py-3 border-b border-white/[0.04] last:border-b-0">
                                    <div className="flex flex-wrap items-center gap-2.5">
                                        <MethodBadge method="WS" />
                                        <code className="text-[13px] font-semibold text-purple-300">{e.event}</code>
                                    </div>
                                    <p className="text-[13px] text-gray-400 pl-[70px] max-md:pl-0">{e.desc}</p>
                                    <p className="text-[12px] text-gray-500 pl-[70px] max-md:pl-0"><code className="text-emerald-300/70">{e.payload}</code></p>
                                </div>
                            ))}
                        </div>

                        <h3 className="text-sm font-black text-gray-300 uppercase tracking-wider mb-2">Odds payload shape</h3>
                        <CodeBlock>{`{
  messageType: 'odds' | 'sportradar_odds' | 'market_status',
  eventId: string,
  data: [{
    mid: string,      // market id
    eid: string,      // event id
    mname: string,    // market name
    ms: number,       // market status (1 = OPEN, 4 = SUSPENDED)
    rt: [{
      ri: string,     // runner / selection id
      ib: boolean,    // true = back odds, false = lay
      rt: number,     // odds rate
      bv: number,     // available volume
      nat: string     // runner name
    }]
  }],
  score?: { home: number, away: number }
}`}</CodeBlock>
                    </section>

                    {/* Quick start */}
                    <section id="quickstart" className="scroll-mt-6">
                        <h2 className="text-xl font-black mb-4">12. Quick Start — Login → Wallet → Bet</h2>
                        <CodeBlock>{`// 1. Login
const res = await fetch(BASE + '/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ identifier: 'player01', password: 'secret' }),
});
const { access_token } = await res.json();
const auth = { Authorization: 'Bearer ' + access_token };

// 2. Wallet
const wallet = await fetch(BASE + '/api/user/wallet', { headers: auth }).then(r => r.json());

// 3. Live odds via socket
import { io } from 'socket.io-client';
const socket = io(WS_URL);
socket.emit('subscribeToUserRoom', { userId: wallet.userId });
socket.emit('join-match', matchId);
socket.on('socket-data', (p) => updateOdds(p));
socket.on('walletUpdate', (w) => updateBalance(w));

// 4. Place a bet (validate odds first)
await fetch(BASE + '/api/sports/check-odds', {
  method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
  body: JSON.stringify({ bets: [{ marketId, selectionId, odds }] }),
});
await fetch(BASE + '/api/sports/bet/place', {
  method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
  body: JSON.stringify({ matchId, marketId, selectionId, selectionName,
    marketName, eventName, rate, amount, type: 'back', marketType }),
});`}</CodeBlock>
                    </section>
                </div>
            </div>
        </div>
    );
}
