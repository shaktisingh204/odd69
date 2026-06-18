# Match-Based Sports Promotion System

This backend uses the existing NestJS app and adds MongoDB-backed collections for:

- `matches`
- `match_cashback_promotions`
- `match_cashback_refunds`

Wallet balances and user-visible transactions continue to use the existing relational wallet layer already present in the project.

## Supported Promotion Types

- `MATCH_LOSS_CASHBACK`
- `FIRST_OVER_SIX_CASHBACK`
- `LEAD_MARGIN_PAYOUT`
- `LATE_LEAD_REFUND`
- `PERIOD_LEAD_PAYOUT`

The newer types are Stake-style sportsbook promos:

- early payout if the selected team leads by a configurable margin
- bad beat refund if the selected team is still leading at a configured minute
- period payout if the selected team leads at half-time / quarter / period end

## Endpoints

### `POST /api/admin/promotions`

Headers:

- `x-admin-token: <ADMIN_API_TOKEN>`

Request:

```json
{
  "matchId": "10002451",
  "promotionType": "LEAD_MARGIN_PAYOUT",
  "refundPercentage": 100,
  "walletType": "main_wallet",
  "maxRefundAmount": 5000,
  "showOnPromotionsPage": true,
  "triggerConfig": {
    "eventType": "TEAM_LEAD_MARGIN",
    "triggerMode": "ANY_STAGE_LEAD",
    "leadThreshold": 2,
    "isTriggered": false
  }
}
```

Response:

```json
{
  "id": "67e16e5d3b3a511f3d83090d",
  "matchId": "10002451",
  "promotionType": "LEAD_MARGIN_PAYOUT",
  "benefitType": "PAYOUT_AS_WIN",
  "refundPercentage": 100,
  "walletType": "main_wallet",
  "maxRefundAmount": 5000,
  "isActive": true,
  "refundedBetCount": 0,
  "totalRefundAmount": 0,
  "createdAt": "2026-03-24T14:40:21.204Z",
  "updatedAt": "2026-03-24T14:40:21.204Z",
  "match": {
    "matchId": "10002451",
    "teamA": "India",
    "teamB": "Australia",
    "matchDate": "2026-03-26T13:00:00.000Z",
    "status": "upcoming",
    "winningTeam": null
  }
}
```

### `POST /api/admin/promotions/:id/trigger-condition`

Headers:

- `x-admin-token: <ADMIN_API_TOKEN>`

Request:

```json
{
  "isTriggered": true,
  "leadThreshold": 2,
  "qualifyingSelections": ["Liverpool"],
  "scoreSnapshot": "2-0 at 63'",
  "triggerNote": "Early payout confirmed by trading team"
}
```

Use this when the trigger event is confirmed.

- For `FIRST_OVER_SIX_CASHBACK`, set `oversWindow` and `isTriggered`.
- For selection-based Stake-style promos, pass the team(s) that actually hit the condition in `qualifyingSelections`.

### `GET /api/match-cashback/promotions/active`

Public endpoint used by the website promotions page.

### `GET /api/admin/promotions`

Headers:

- `x-admin-token: <ADMIN_API_TOKEN>`

Response:

```json
[
  {
    "id": "67e16e5d3b3a511f3d83090d",
    "matchId": "10002451",
    "promotionType": "LATE_LEAD_REFUND",
    "benefitType": "REFUND",
    "refundPercentage": 50,
    "walletType": "bonus_wallet",
    "maxRefundAmount": 500,
    "triggerConfig": {
      "triggerMode": "AT_MINUTE",
      "minuteThreshold": 80,
      "qualifyingSelections": ["Real Madrid"],
      "isTriggered": true
    },
    "isActive": true,
    "refundedBetCount": 12,
    "totalRefundAmount": 2400,
    "createdAt": "2026-03-24T14:40:21.204Z",
    "updatedAt": "2026-03-24T15:20:01.011Z",
    "match": {
      "matchId": "10002451",
      "teamA": "India",
      "teamB": "Australia",
      "matchDate": "2026-03-26T13:00:00.000Z",
      "status": "finished",
      "winningTeam": "India"
    }
  }
]
```

### `GET /api/user/wallet`

Headers:

- `Authorization: Bearer <JWT>`

Response:

```json
{
  "fiatBalance": 1450,
  "fiatCurrency": "INR",
  "exposure": 0,
  "sportsBonus": 300,
  "mainWalletBalance": 1450,
  "bonusWalletBalance": 300,
  "main_wallet_balance": 1450,
  "bonus_wallet_balance": 300
}
```

### `GET /api/user/transactions`

Headers:

- `Authorization: Bearer <JWT>`

Response:

```json
[
  {
    "id": 4412,
    "userId": 71,
    "amount": 1200,
    "type": "PROMO_PAYOUT",
    "status": "COMPLETED",
    "paymentMethod": "MAIN_WALLET",
    "paymentDetails": {
      "source": "LEAD_MARGIN_PAYOUT",
      "benefitType": "PAYOUT_AS_WIN",
      "walletType": "main_wallet",
      "referenceId": "67e16f38f6206e14f7bd3201",
      "promotionId": "67e16e5d3b3a511f3d83090d",
      "matchId": "10002451",
      "qualifyingSelections": ["Liverpool"]
    },
    "remarks": "Early lead payout promotion"
  }
]
```

### `POST /api/match/settle`

Headers:

- `x-admin-token: <ADMIN_API_TOKEN>`

Request:

```json
{
  "matchId": "10002451",
  "winningTeam": "India",
  "note": "Official result declared"
}
```

Response:

```json
{
  "matchId": "10002451",
  "winningTeam": "India",
  "totalBets": 34,
  "wonBets": 12,
  "lostBets": 22,
  "refundSummary": {
    "matchId": "10002451",
    "promotionIds": ["67e16e5d3b3a511f3d83090d"],
    "eligibleLosingBets": 22,
    "refundedBetCount": 4,
    "totalRefundAmount": 4400,
    "skippedDuplicates": 0,
    "processedPromotions": [
      {
        "promotionId": "67e16e5d3b3a511f3d83090d",
        "promotionType": "LEAD_MARGIN_PAYOUT",
        "benefitType": "PAYOUT_AS_WIN",
        "refundedBetCount": 4,
        "totalRefundAmount": 4400
      }
    ]
  }
}
```

## Notes

- Promotions are processed only for finally losing bets.
- Promo credits are idempotent per bet per promotion through the `match_cashback_refunds` collection.
- Duplicate settlement/promo runs skip already completed entries.
- `bonus_wallet` maps to the sports bonus balance for this sports promotion flow.
- `FIRST_OVER_SIX_CASHBACK` is admin-configurable with a variable overs window and an admin-managed trigger state.
- Stake-style early payout / bad beat / period payout promos are selection-aware and use admin-managed trigger confirmation today.
- The engine already supports both `REFUND` and `PAYOUT_AS_WIN` benefit types, so more sportsbook promo templates can be added without changing settlement flow again.
