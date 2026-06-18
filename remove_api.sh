#!/bin/bash

FILE_PATH="newbackend/src/sports/sports.service.ts"

# Replace properties and remove rate limit/API request
sed -i '' -e '/private readonly API_URL/,/private isSyncing = false;/c\
    // External API variables removed\
' "$FILE_PATH"

sed -i '' -e '/private async respectRateLimit() {/,/    async onModuleInit() {/c\
    async onModuleInit() {\
' "$FILE_PATH"

# Remove authenticate and refreshToken
sed -i '' -e '/private async authenticate(): Promise<string | null> {/,/    @Cron('\''20 10 \* \* \*'\'')/c\
    // Token refresh logic removed\
    // @Cron('\''20 10 * * *'\'')\
' "$FILE_PATH"

sed -i '' -e '/async refreshToken() {/,/    \/\/ --- Cron Jobs ---/c\
    // --- Cron Jobs ---\
' "$FILE_PATH"

# Disable syncAll
sed -i '' -e '/    @Cron('\''20 10 \* \* \*'\'')/,/    private async syncSports(token: string) {/c\
    // @Cron('\''20 10 * * *'\'')\
    async syncAll() {\
        this.logger.log('\''Sync all disabled - external API removed'\'');\
    }\
\
    private async syncSports(token: string) {\
' "$FILE_PATH"

# Empty syncSports
sed -i '' -e '/private async syncSports(token: string) {/,/    \/\/ Mapping helper/c\
    private async syncSports(token?: string) {\
        this.logger.log('\''Sync sports disabled'\'');\
    }\
\
    // Mapping helper\
' "$FILE_PATH"

# Empty syncTournaments & getTournamentsFromApi
sed -i '' -e '/private async syncTournaments(token: string, sportId: string, sourceId?: string) {/,/    private parseDate(dateStr: any): Date {/c\
    private async syncTournaments(token: string, sportId: string, sourceId?: string) {\
        this.logger.log('\''Sync tournaments disabled'\'');\
    }\
\
    public async getTournamentsFromApi(token: string, sportId: string, sourceId?: string) {\
        return { status: { code: 200 }, data: [] };\
    }\
\
    private parseDate(dateStr: any): Date {\
' "$FILE_PATH"

# Empty syncMatches & getMatchesFromApi
sed -i '' -e '/private async syncMatches(token: string, sportId: string, tournamentId: string, sourceId?: string) {/,/    public async ensureMarketImported(matchId: string) {/c\
    private async syncMatches(token: string, sportId: string, tournamentId: string, sourceId?: string) {\
        this.logger.log('\''Sync matches disabled'\'');\
    }\
\
    public async getMatchesFromApi(token: string, sportId: string, tournamentId: string, sourceId?: string) {\
        return { status: { code: 200 }, data: [] };\
    }\
\
    public async ensureMarketImported(matchId: string) {\
' "$FILE_PATH"

# Empty ensureMarketImported
sed -i '' -e '/public async ensureMarketImported(matchId: string) {/,/    @Cron('\''\*\/2 \* \* \* \*'\'') \/\/ Run every 2 minutes/c\
    public async ensureMarketImported(matchId: string) {\
        this.logger.log(`Market import disabled for ${matchId}`);\
    }\
\
    // @Cron('\''*/2 * * * *'\'') // Run every 2 minutes\
' "$FILE_PATH"

# Empty syncMarkets
sed -i '' -e '/public async syncMarkets() {/,/    public async importExchangeMarkets(token: string | undefined, sportId: string, tournamentId: string, matchId: string, setActive: boolean = true, importRemote: boolean = false) {/c\
    public async syncMarkets() {\
        return { message: '\''Sync markets disabled'\'' };\
    }\
\
    public async importExchangeMarkets(token: string | undefined, sportId: string, tournamentId: string, matchId: string, setActive: boolean = true, importRemote: boolean = false) {\
' "$FILE_PATH"

# Empty importExchangeMarkets
sed -i '' -e '/public async importExchangeMarkets(token: string | undefined, sportId: string, tournamentId: string, matchId: string, setActive: boolean = true, importRemote: boolean = false) {/,/    public async importSessionMarkets(token: string | undefined, sportId: string, tournamentId: string, matchId: string, setActive: boolean = true, importRemote: boolean = false) {/c\
    public async importExchangeMarkets(token: string | undefined, sportId: string, tournamentId: string, matchId: string, setActive: boolean = true, importRemote: boolean = false) {\
        return { message: '\''Import exchange markets disabled'\'' };\
    }\
\
    public async importSessionMarkets(token: string | undefined, sportId: string, tournamentId: string, matchId: string, setActive: boolean = true, importRemote: boolean = false) {\
' "$FILE_PATH"

# Empty importSessionMarkets
sed -i '' -e '/public async importSessionMarkets(token: string | undefined, sportId: string, tournamentId: string, matchId: string, setActive: boolean = true, importRemote: boolean = false) {/,/    public async activateMatchMarkets(matchId: string) {/c\
    public async importSessionMarkets(token: string | undefined, sportId: string, tournamentId: string, matchId: string, setActive: boolean = true, importRemote: boolean = false) {\
        return { message: '\''Import session markets disabled'\'' };\
    }\
\
    public async activateMatchMarkets(matchId: string) {\
' "$FILE_PATH"

# Modify activateMatchMarkets
sed -i '' -e '/public async activateMatchMarkets(matchId: string) {/,/    \/\/ --- Webhook Handlers ---/c\
    public async activateMatchMarkets(matchId: string) {\
        return { message: '\''Activate match markets disabled'\'' };\
    }\
\
    // --- Webhook Handlers ---\
' "$FILE_PATH"

