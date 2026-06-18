import {
  calculatePotentialWinAmount,
  getRateFromSize,
} from './bet-pricing.util';

describe('bet pricing util', () => {
  it('uses decimal odds for odd-even markets even when the quote size is huge', () => {
    expect(getRateFromSize(800000)).toBe(8001);

    expect(
      calculatePotentialWinAmount({
        stake: 149,
        odds: 1.96,
        rate: getRateFromSize(800000),
        marketType: 'oddeven',
        marketName: '1st Inn 13 Over Run Odd Even',
      }),
    ).toBe(292.04);
  });

  it('uses rate-based payout for line markets such as session and fancy', () => {
    expect(
      calculatePotentialWinAmount({
        stake: 149,
        odds: 13,
        rate: 1.96,
        marketType: 'session',
        marketName: '13 Over Runs',
      }),
    ).toBe(292.04);
  });

  it('treats toss and winner-style markets as decimal odds even under fancy gtypes', () => {
    expect(getRateFromSize(500000)).toBe(5001);

    expect(
      calculatePotentialWinAmount({
        stake: 500,
        odds: 1.96,
        rate: getRateFromSize(500000),
        marketType: 'fancy',
        marketName: 'Will Win the Toss',
        selectionName: 'RC Bengaluru',
      }),
    ).toBe(980);
  });
});
