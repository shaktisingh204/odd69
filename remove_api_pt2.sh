#!/bin/bash

FILE_PATH="newbackend/src/sports/sports.service.ts"

# Empty getScorecard
sed -i '' -e '/async getScorecard(matchId: string) {/,/    async updateSportLimits(sportId: string, minBet: number, maxBet: number) {/c\
    async getScorecard(matchId: string) {\
        return null;\
    }\
\
    async updateSportLimits(sportId: string, minBet: number, maxBet: number) {\
' "$FILE_PATH"

# Replace placeBet
sed -i '' -e '/async placeBet(/,/async getUserBets(userId: number) {/c\
    async placeBet(\
        userId: number,\
        matchId: string,\
        marketId: string,\
        selectionId: string,\
        selectionName: string,\
        marketName: string,\
        eventName: string,\
        rate: number,\
        amount: number,\
        type: '\''back'\'' | '\''lay'\'',\
        marketType: string\
    ) {\
        throw new Error('\''Bet placement disabled (provider changed)'\'');\
    }\
\
    async getUserBets(userId: number) {\
' "$FILE_PATH"

