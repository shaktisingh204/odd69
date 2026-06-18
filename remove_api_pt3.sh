#!/bin/bash

FILE_PATH="newbackend/src/sports/sports.socket.service.ts"

# Replace connect
sed -i '' -e '/public connect() {/,/    private startHeartbeat() {/c\
    public connect() {\
        this.logger.log('\''Sports Socket Service connection disabled (provider changed)'\'');\
    }\
\
    private startHeartbeat() {\
' "$FILE_PATH"

# Replace subscribe
sed -i '' -e '/public subscribe(marketIds: string\[\]) {/,/    public resubscribe() {/c\
    public subscribe(marketIds: string[]) {\
        this.logger.log(`Subscribe disabled for markets: ${marketIds.length}`);\
    }\
\
    public resubscribe() {\
' "$FILE_PATH"

# Replace resubscribe
sed -i '' -e '/public resubscribe() {/,/    public unsubscribe(marketIds: string\[\]) {/c\
    public resubscribe() {\
        this.logger.log('\''Resubscribe disabled'\'');\
    }\
\
    public unsubscribe(marketIds: string[]) {\
' "$FILE_PATH"

# Replace unsubscribe
sed -i '' -e '/public unsubscribe(marketIds: string\[\]) {/,/    public getLiveOdds(marketId: string) {/c\
    public unsubscribe(marketIds: string[]) {\
        this.logger.log(`Unsubscribe disabled for markets: ${marketIds.length}`);\
    }\
\
    public getLiveOdds(marketId: string) {\
' "$FILE_PATH"

