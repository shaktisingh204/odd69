type PricePoint = {
  price: number;
  size: number;
};

type RunnerLike = {
  runnerId: string;
  runnerName: string;
  status?: string;
  backPrices: PricePoint[];
  layPrices: PricePoint[];
};

type MarketLike = {
  marketId: string;
  marketName?: string;
  status: string;
  runners: RunnerLike[];
};

type EventWithMarkets<TMarket extends MarketLike> = {
  homeScore?: number;
  awayScore?: number;
  markets?: {
    matchOdds?: TMarket[];
    premiumMarkets?: TMarket[];
    bookmakers?: TMarket[];
    fancyMarkets?: TMarket[];
  };
};

const ODDS_MESSAGE_TYPES = new Set([
  'sportradar_odds',
  'odds',
  'match_odds',
  'bookmaker_odds',
  'bm_odds',
]);

function normalizeLabel(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function normalizeStatus(status: unknown): string | null {
  if (typeof status === 'number') {
    return status === 4 ? 'Suspended' : status === 1 ? 'Active' : null;
  }

  const normalized = String(status ?? '').trim().toUpperCase();
  if (!normalized) return null;
  if (['4', 'SUSPENDED', 'SUSPEND', 'CLOSED'].includes(normalized)) return 'Suspended';
  if (['1', 'ACTIVE', 'OPEN'].includes(normalized)) return 'Active';
  return null;
}

function sortPricePoints(points: Array<PricePoint & { level: number }>): PricePoint[] {
  return points
    .sort((left, right) => left.level - right.level)
    .map(({ price, size }) => ({ price, size }));
}

function buildRunnerUpdateMap(rt: any[]): Map<string, Partial<RunnerLike>> {
  const grouped = new Map<
    string,
    {
      runnerId: string;
      runnerName: string;
      backPrices: Array<PricePoint & { level: number }>;
      layPrices: Array<PricePoint & { level: number }>;
    }
  >();

  rt.forEach((entry: any, index) => {
    const runnerId = String(entry?.ri ?? entry?.id ?? '').trim();
    if (!runnerId) return;

    const price = Number(entry?.rt ?? entry?.price);
    if (!Number.isFinite(price) || price <= 0) return;

    const size = Number(entry?.bv ?? entry?.size ?? 0);
    const level = Number.isFinite(Number(entry?.pr)) ? Number(entry.pr) : index;
    const runnerName = String(entry?.nat ?? '').trim();

    const bucket = grouped.get(runnerId) ?? {
      runnerId,
      runnerName,
      backPrices: [],
      layPrices: [],
    };

    const pricePoint = {
      price,
      size: Number.isFinite(size) ? size : 0,
      level,
    };

    if (entry?.ib) {
      bucket.backPrices.push(pricePoint);
    } else {
      bucket.layPrices.push(pricePoint);
    }

    if (runnerName && !bucket.runnerName) {
      bucket.runnerName = runnerName;
    }

    grouped.set(runnerId, bucket);
  });

  return new Map(
    Array.from(grouped.entries()).map(([runnerId, bucket]) => [
      runnerId,
      {
        runnerId,
        runnerName: bucket.runnerName,
        backPrices: sortPricePoints(bucket.backPrices),
        layPrices: sortPricePoints(bucket.layPrices),
      },
    ]),
  );
}

function buildRunnerUpdateMapFromSection(section: any[]): Map<string, Partial<RunnerLike>> {
  const grouped = new Map<
    string,
    {
      runnerId: string;
      runnerName: string;
      backPrices: Array<PricePoint & { level: number }>;
      layPrices: Array<PricePoint & { level: number }>;
    }
  >();

  section.forEach((runner: any, runnerIndex: number) => {
    const runnerId = String(
      runner?.sid ?? runner?.selectionId ?? runner?.selection_id ?? runner?.id ?? '',
    ).trim();
    if (!runnerId) return;

    const bucket = grouped.get(runnerId) ?? {
      runnerId,
      runnerName: String(runner?.nat ?? runner?.runnerName ?? runner?.name ?? '').trim(),
      backPrices: [],
      layPrices: [],
    };

    const odds = Array.isArray(runner?.odds) ? runner.odds : [];
    odds.forEach((entry: any, oddsIndex: number) => {
      const price = Number(entry?.odds ?? entry?.rt ?? entry?.price);
      if (!Number.isFinite(price) || price <= 0) return;

      const size = Number(entry?.size ?? entry?.bv ?? 0);
      const level = Number.isFinite(Number(entry?.pr))
        ? Number(entry.pr)
        : runnerIndex * 10 + oddsIndex;
      const pricePoint = {
        price,
        size: Number.isFinite(size) ? size : 0,
        level,
      };

      const type = String(entry?.otype ?? (entry?.ib ? 'back' : 'lay')).trim().toLowerCase();
      if (type === 'back') {
        bucket.backPrices.push(pricePoint);
      } else {
        bucket.layPrices.push(pricePoint);
      }
    });

    grouped.set(runnerId, bucket);
  });

  return new Map(
    Array.from(grouped.entries()).map(([runnerId, bucket]) => [
      runnerId,
      {
        runnerId,
        runnerName: bucket.runnerName,
        backPrices: sortPricePoints(bucket.backPrices),
        layPrices: sortPricePoints(bucket.layPrices),
      },
    ]),
  );
}

function getIncomingMarketName(incoming: any): string {
  return String(incoming?.mname ?? incoming?.marketName ?? incoming?.name ?? '').trim();
}

function getIncomingRunnerNames(incoming: any): Set<string> {
  const names = new Set<string>();

  if (Array.isArray(incoming?.runners)) {
    incoming.runners.forEach((runner: any) => {
      const name = normalizeLabel(runner?.runnerName);
      if (name) names.add(name);
    });
  }

  if (Array.isArray(incoming?.rt)) {
    incoming.rt.forEach((runner: any) => {
      const name = normalizeLabel(runner?.nat);
      if (name) names.add(name);
    });
  }

  if (Array.isArray(incoming?.section)) {
    incoming.section.forEach((runner: any) => {
      const name = normalizeLabel(runner?.nat ?? runner?.runnerName ?? runner?.name);
      if (name) names.add(name);
    });
  }

  return names;
}

function doesIncomingMatchMarket<TMarket extends MarketLike>(market: TMarket, incoming: any): boolean {
  const incomingName = normalizeLabel(getIncomingMarketName(incoming));
  const marketName = normalizeLabel(market.marketName);
  if (!incomingName || !marketName || incomingName !== marketName) {
    return false;
  }

  const marketRunnerNames = new Set(
    market.runners
      .map((runner) => normalizeLabel(runner.runnerName))
      .filter(Boolean),
  );
  if (marketRunnerNames.size === 0) return true;

  const incomingRunnerNames = getIncomingRunnerNames(incoming);
  if (incomingRunnerNames.size === 0) return true;

  return Array.from(marketRunnerNames).some((runnerName) => incomingRunnerNames.has(runnerName));
}

function getIncomingMarketIds(incoming: any, eventId?: string): Set<string> {
  const ids = new Set<string>();
  const rawIds = [incoming?.bmi, incoming?.mid, incoming?.id]
    .map((value) => String(value ?? '').trim())
    .filter(Boolean);

  rawIds.forEach((id) => {
    ids.add(id);

    if (eventId && id.startsWith(`${eventId}:`)) {
      ids.add(id.slice(eventId.length + 1));
    }

    if (eventId && !id.startsWith(`${eventId}:`)) {
      ids.add(`${eventId}:${id}`);
    }
  });

  return ids;
}

function doesIncomingTargetEvent(incoming: any, payload: any, eventId: string): boolean {
  const incomingEventId = String(incoming?.eid ?? payload?.eventId ?? '').trim();
  if (incomingEventId) return incomingEventId === eventId;

  return Array.from(getIncomingMarketIds(incoming, eventId)).some(
    (id) => id === eventId || id.startsWith(`${eventId}:`),
  );
}

function findIncomingRunner(
  runner: RunnerLike,
  runnerMap: Map<string, Partial<RunnerLike>>,
): Partial<RunnerLike> | undefined {
  const byId = runnerMap.get(String(runner.runnerId));
  if (byId) return byId;

  const runnerName = runner.runnerName.trim().toLowerCase();
  if (!runnerName) return undefined;

  return Array.from(runnerMap.values()).find(
    (candidate) => candidate.runnerName?.trim().toLowerCase() === runnerName,
  );
}

function mergeRunner(
  runner: RunnerLike,
  incomingRunner: Partial<RunnerLike> | undefined,
  marketStatus: string,
): RunnerLike {
  if (!incomingRunner) {
    if (marketStatus === runner.status) return runner;
    return {
      ...runner,
      status: marketStatus,
    };
  }

  const nextStatus = marketStatus === 'Suspended'
    ? 'Suspended'
    : incomingRunner.status ?? runner.status ?? 'Active';
  const nextBackPrices = incomingRunner.backPrices?.length
    ? incomingRunner.backPrices
    : runner.backPrices;
  const nextLayPrices = incomingRunner.layPrices?.length
    ? incomingRunner.layPrices
    : runner.layPrices;
  const nextRunnerName = incomingRunner.runnerName || runner.runnerName;

  const didChange = (
    nextStatus !== runner.status ||
    nextRunnerName !== runner.runnerName ||
    JSON.stringify(nextBackPrices) !== JSON.stringify(runner.backPrices) ||
    JSON.stringify(nextLayPrices) !== JSON.stringify(runner.layPrices)
  );

  if (!didChange) return runner;

  return {
    ...runner,
    ...incomingRunner,
    runnerName: nextRunnerName,
    status: nextStatus,
    backPrices: nextBackPrices,
    layPrices: nextLayPrices,
  };
}

function mergeIncomingMarket<TMarket extends MarketLike>(
  market: TMarket,
  incoming: any,
): TMarket {
  const marketStatus = normalizeStatus(incoming?.ms ?? incoming?.status) ?? market.status;

  let runnerMap = new Map<string, Partial<RunnerLike>>();
  if (Array.isArray(incoming?.runners) && incoming.runners.length > 0) {
    runnerMap = new Map(
      incoming.runners.map((runner: any) => [
        String(runner?.runnerId ?? '').trim(),
        {
          ...runner,
          runnerId: String(runner?.runnerId ?? '').trim(),
          runnerName: String(runner?.runnerName ?? '').trim(),
          backPrices: Array.isArray(runner?.backPrices) ? runner.backPrices : [],
          layPrices: Array.isArray(runner?.layPrices) ? runner.layPrices : [],
        },
      ]),
    );
  } else if (Array.isArray(incoming?.rt) && incoming.rt.length > 0) {
    runnerMap = buildRunnerUpdateMap(incoming.rt);
  } else if (Array.isArray(incoming?.section) && incoming.section.length > 0) {
    runnerMap = buildRunnerUpdateMapFromSection(incoming.section);
  }

  const nextRunners = market.runners.map((runner) =>
    mergeRunner(runner, findIncomingRunner(runner, runnerMap), marketStatus),
  );

  const hasRunnerChanges = nextRunners.some((runner, index) => runner !== market.runners[index]);
  if (!hasRunnerChanges && marketStatus === market.status) {
    return market;
  }

  return {
    ...market,
    status: marketStatus,
    runners: nextRunners,
  };
}

export function getSocketPayloadEventIds(payload: any): string[] {
  const ids = new Set<string>();
  const eventId = String(payload?.eventId ?? '').trim();
  if (eventId) ids.add(eventId);

  if (Array.isArray(payload?.data)) {
    payload.data.forEach((incoming: any) => {
      const incomingEventId = String(incoming?.eid ?? '').trim();
      if (incomingEventId) {
        ids.add(incomingEventId);
        return;
      }

      [incoming?.bmi, incoming?.mid, incoming?.id].forEach((value: unknown) => {
        const raw = String(value ?? '').trim();
        if (!raw) return;
        const prefixedMatch = raw.match(/^(sr:[^:]+:\d+|vci:[^:]+:\d+):/);
        if (prefixedMatch?.[1]) {
          ids.add(prefixedMatch[1]);
        }
      });
    });
  }

  return Array.from(ids);
}

export function applySocketPayloadToMarketList<TMarket extends MarketLike>(
  markets: TMarket[],
  payload: any,
  eventId?: string,
): TMarket[] {
  if (!Array.isArray(markets) || markets.length === 0 || !payload) {
    return markets;
  }

  if (payload?.messageType === 'market_status' && payload?.id) {
    const targetIds = getIncomingMarketIds({ id: payload.id }, eventId);
    let didChange = false;

    const nextMarkets = markets.map((market) => {
      const marketIds = new Set([String(market.marketId), eventId ? `${eventId}:${market.marketId}` : '']);
      const matchesTarget = Array.from(targetIds).some((id) => marketIds.has(id));
      if (!matchesTarget) return market;

      const marketStatus = normalizeStatus(payload.ms) ?? market.status;
      const nextMarket = mergeIncomingMarket(market, { ms: payload.ms });
      if (nextMarket !== market || marketStatus !== market.status) {
        didChange = true;
      }
      return nextMarket;
    });

    return didChange ? nextMarkets : markets;
  }

  if (!ODDS_MESSAGE_TYPES.has(String(payload?.messageType ?? '')) || !Array.isArray(payload?.data)) {
    return markets;
  }

  const incomingById = new Map<string, any>();
  const incomingByName = new Map<string, any[]>();
  payload.data.forEach((incoming: any) => {
    if (!incoming) return;
    if (eventId && !doesIncomingTargetEvent(incoming, payload, eventId)) return;

    getIncomingMarketIds(incoming, eventId).forEach((id) => {
      incomingById.set(id, incoming);
    });

    const nameKey = normalizeLabel(getIncomingMarketName(incoming));
    if (nameKey) {
      const existing = incomingByName.get(nameKey) ?? [];
      existing.push(incoming);
      incomingByName.set(nameKey, existing);
    }
  });

  if (incomingById.size === 0 && incomingByName.size === 0) return markets;

  let didChange = false;
  const nextMarkets = markets.map((market) => {
    const incoming = incomingById.get(String(market.marketId))
      ?? (eventId ? incomingById.get(`${eventId}:${market.marketId}`) : undefined)
      ?? (incomingByName.get(normalizeLabel(market.marketName)) ?? []).find((candidate) =>
        doesIncomingMatchMarket(market, candidate),
      );
    if (!incoming) return market;

    const nextMarket = mergeIncomingMarket(market, incoming);
    if (nextMarket !== market) {
      didChange = true;
    }
    return nextMarket;
  });

  return didChange ? nextMarkets : markets;
}

export function applySocketPayloadToEvent<TMarket extends MarketLike, TEvent extends EventWithMarkets<TMarket>>(
  event: TEvent,
  payload: any,
  eventId?: string,
): TEvent {
  if (!event) return event;

  const matchOdds = applySocketPayloadToMarketList(event.markets?.matchOdds ?? [], payload, eventId);
  const premiumMarkets = applySocketPayloadToMarketList(event.markets?.premiumMarkets ?? [], payload, eventId);
  const bookmakers = applySocketPayloadToMarketList(event.markets?.bookmakers ?? [], payload, eventId);
  const fancyMarkets = applySocketPayloadToMarketList(event.markets?.fancyMarkets ?? [], payload, eventId);
  const nextHomeScore = payload?.score?.home ?? event.homeScore;
  const nextAwayScore = payload?.score?.away ?? event.awayScore;

  const didMarketChange = (
    matchOdds !== (event.markets?.matchOdds ?? []) ||
    premiumMarkets !== (event.markets?.premiumMarkets ?? []) ||
    bookmakers !== (event.markets?.bookmakers ?? []) ||
    fancyMarkets !== (event.markets?.fancyMarkets ?? [])
  );

  if (!didMarketChange && nextHomeScore === event.homeScore && nextAwayScore === event.awayScore) {
    return event;
  }

  return {
    ...event,
    homeScore: nextHomeScore,
    awayScore: nextAwayScore,
    markets: {
      ...event.markets,
      matchOdds,
      premiumMarkets,
      bookmakers,
      fancyMarkets,
    },
  };
}
