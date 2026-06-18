#!/bin/bash

FILE_PATH="newbackend/src/sports/sports.service.ts"

# Replace syncSports logic
sed -i '' -e '/    private async syncSports(token?: string) {/,/        this.logger.log('\''Sync sports disabled'\'');/c\
    private readonly DIAMOND_API_URL = "https://diamond-sports-api-d247-sky-exchange-betfair.p.rapidapi.com";\
    private readonly DIAMOND_API_HOST = "diamond-sports-api-d247-sky-exchange-betfair.p.rapidapi.com";\
    private readonly DIAMOND_API_KEY = "fdaa78ee08mshb866b2d82236d8cp18a100jsn764d59a3c2a1";\
\
    @Cron('\''0 0 * * *'\'') // Sync daily\
    public async syncSports() {\
        this.logger.log('\''Starting Diamond Sports API sync...'\'');\
        try {\
            const response = await firstValueFrom(\
                this.httpService.get<DiamondSportsResponse>(`${this.DIAMOND_API_URL}/sports/allSportid`, {\
                    headers: {\
                        '\''x-rapidapi-host'\'': this.DIAMOND_API_HOST,\
                        '\''x-rapidapi-key'\'': this.DIAMOND_API_KEY\
                    }\
                })\
            );\
\
            const { data } = response.data;\
\
            if (response.data.success && data && Array.isArray(data)) {\
                for (const sport of data) {\
                    await this.sportModel.updateOne(\
                        { sport_id: sport.eid.toString() },\
                        {\
                            $set: {\
                                sport_name: sport.ename,\
                                isVisible: sport.active,\
                            }\
                        },\
                        { upsert: true }\
                    );\
                }\
                this.logger.log(`Successfully synced ${data.length} sports from Diamond API.`);\
            } else {\
                this.logger.warn(`Failed to sync sports: Invalid response format.`);\
            }\
        } catch (error) {\
            this.logger.error(`Error syncing sports from Diamond API: ${error.message}`);\
        }\
    }\
' "$FILE_PATH"

# Replace onModuleInit startup call
sed -i '' -e '/        \/\/ Initial sync on startup to get sports and then cricket data/,/        \/\/ this.syncAll();/c\
        // Initial sync on startup to get sports\
        this.syncSports();\
' "$FILE_PATH"

