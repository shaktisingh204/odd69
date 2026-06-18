import { BetsService } from './bets.service';

describe('BetsService', () => {
  let service: BetsService;
  let marketModel: { findOne: jest.Mock };
  let eventModel: { findOne: jest.Mock };
  let redis: {
    pipeline: jest.Mock;
    set: jest.Mock;
    del: jest.Mock;
  };

  beforeEach(() => {
    marketModel = {
      findOne: jest.fn(),
    };
    eventModel = {
      findOne: jest.fn(),
    };
    redis = {
      pipeline: jest.fn(() => ({
        incr: jest.fn().mockReturnThis(),
        expire: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, 1],
          [null, 1],
        ]),
      })),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    };

    service = new BetsService(
      {} as any,
      {} as any,
      {} as any,
      marketModel as any,
      eventModel as any,
      redis as any,
      {} as any,
      { getLiveOdds: jest.fn() } as any,
      {
        recordWagering: jest.fn(),
        emitWalletRefresh: jest.fn(),
      } as any,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('rejects event ids that do not match the market event', async () => {
    marketModel.findOne.mockResolvedValue({
      market_id: 'market-1',
      event_id: 'event-server',
      is_active: true,
      status: 'OPEN',
      gtype: 'match',
      market_name: 'Match Odds',
      runners_data: [{ sid: 'selection-1', nat: 'KK' }],
    });

    await expect(
      service.placeBet(99, {
        eventId: 'event-client',
        marketId: 'market-1',
        selectionId: 'selection-1',
        odds: 1.96,
        stake: 149,
        betType: 'back',
      }),
    ).rejects.toThrow('Market does not belong to the requested event');
  });

  it('rejects selection ids that do not belong to the market', async () => {
    marketModel.findOne.mockResolvedValue({
      market_id: 'market-1',
      event_id: 'event-1',
      is_active: true,
      status: 'OPEN',
      gtype: 'match',
      market_name: 'Match Odds',
      runners_data: [{ sid: 'selection-1', nat: 'KK' }],
    });

    await expect(
      service.placeBet(99, {
        eventId: 'event-1',
        marketId: 'market-1',
        selectionId: 'selection-missing',
        odds: 1.96,
        stake: 149,
        betType: 'back',
      }),
    ).rejects.toThrow('Selection not found in market');
  });
});
