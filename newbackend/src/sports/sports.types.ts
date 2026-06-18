export interface MyZoshLoginResponse {
    status: {
        code: number;
        message: string;
    };
    data: {
        access_token: string;
        agent_code: string;
    };
}

export interface MyZoshSport {
    sport_id: string;
    sport_name: string;
    market_count?: number;
}

export interface MyZoshSportsResponse {
    status: {
        code: number;
        message: string;
    };
    data: MyZoshSport[];
}

export interface MyZoshTournament {
    tournament_id: string;
    tournament_name: string;
    market_count?: number;
}

export interface MyZoshTournamentsResponse {
    status: {
        code: number;
        message: string;
    };
    data: MyZoshTournament[];
}

export interface MyZoshMatch {
    match_id: string;
    match_name: string;
    match_date?: string;
    match_open_date?: string;
    match_status?: string;
    match_country_code?: string;
}

export interface MyZoshMatchesResponse {
    status: {
        code: number;
        message: string;
    };
    data: MyZoshMatch[];
}

export interface MyZoshMarketRunner {
    selection_id: string;
    runner_name: string;
}

export interface MyZoshExchangeMarket {
    market_id: string;
    market_name: string;
    runners: MyZoshMarketRunner[];
    is_market_data_delayed?: boolean;
    description?: any;
}

export interface MyZoshExchangeMarketsResponse {
    status: {
        code: number;
        message: string;
    };
    data: MyZoshExchangeMarket[];
}

export interface MyZoshSessionMarket {
    market_id: string;
    market_name: string;
    selection_id: string;
}

export interface MyZoshSessionMarketsResponse {
    status: {
        code: number;
        message: string;
    };
    data: MyZoshSessionMarket[];
}

export interface MyZoshImportedMarket {
    sys_market_id: number;
    market_id?: string; // Added as optional as it might be present in response
    market_name: string;
}

export interface MyZoshImportSessionResponse {
    status: {
        code: number;
        message: string;
    };
    data: MyZoshImportedMarket[];
}

export interface MyZoshImportExchangeResponse {
    status: {
        code: number;
        message: string;
    };
    data: any;
}

export interface MyZoshScorecardResponse {
    status: {
        code: number;
        message: string;
    };
    data: any; // Structure not fully clear from doc summary, presumably object
}

export interface MyZoshBetPlaceRequest {
    access_token: string;
    match_id: string;
    market_id: string;
    selection_id: string;
    rate: string;
    amount: string;
    bet_type: 'back' | 'lay';
    market_type: string; // 'match_odds', etc.
}

export interface MyZoshBetPlaceResponse {
    status: {
        code: number;
        message: string;
    };
    data: any;
}

export interface MyZoshGetTournamentsRequest {
    access_token: string;
    sport_id: string;
    source_id?: string;
}

export interface MyZoshGetMatchesRequest {
    access_token: string;
    sport_id: string;
    tournament_id: string;
    source_id?: string;
}

export interface MyZoshSyncTokenResponse {
    status: {
        code: number;
        message: string;
    };
    data: {
        sync_token: string;
    };
}

export interface DiamondSport {
    eid: number;
    ename: string;
    active: boolean;
    tab: boolean;
    isdefault: boolean;
    oid: number;
}

export interface DiamondSportsResponse {
    success: boolean;
    msg: string;
    status: number;
    data: DiamondSport[];
}

export interface DiamondMatchOdds {
    sid: number;
    psid: number;
    odds: number;
    otype: string; // 'back' | 'lay'
    oname: string;
    tno: number;
    size: number;
}

export interface DiamondMatchSection {
    sid: number;
    sno: number;
    gstatus: string;
    gscode: number;
    nat: string;
    odds: DiamondMatchOdds[];
}

export interface DiamondMatch {
    gmid: number;
    ename: string;
    etid: number; // sport_id
    cid: number; // competition_id
    cname: string; // competition_name
    iplay: boolean;
    stime: string;
    tv: boolean;
    bm: boolean;
    f: boolean;
    f1: boolean;
    iscc: number;
    mid: number;
    mname: string;
    status: string;
    rc: number;
    gscode: number;
    m: number;
    oid: number;
    gtype: string;
    section: DiamondMatchSection[];
}

export interface DiamondMatchesResponse {
    success: boolean;
    msg: string;
    status: number;
    data: {
        t1: DiamondMatch[]; // Future/Live matches
        t2: DiamondMatch[]; // Suspended matches usually
    };
}

export interface DiamondMatchOddsResponseData {
    gmid: number;
    mid: number;
    pmid: number | null;
    mname: string;
    rem: string;
    gtype: string;
    status: string;
    rc: number;
    visible: boolean;
    pid: number;
    gscode: number;
    maxb: number;
    sno: number;
    dtype: number;
    ocnt: number;
    m: number;
    max: number;
    min: number;
    biplay: boolean;
    umaxbof: number;
    boplay: boolean;
    iplay: boolean;
    btcnt: number;
    company: string | null;
    section: DiamondMatchSection[];
}

export interface DiamondMarketOddsResponse {
    success: boolean;
    msg: string;
    status: number;
    data: DiamondMatchOddsResponseData[];
}

export interface DiamondSidebarChild {
    gmid?: string;
    cid?: string;
    name: string;
    etid: number;
    iscc?: number;
    children?: DiamondSidebarChild[] | null;
}

export interface DiamondSidebarItem {
    etid: number;
    name: string;
    oid: number;
    children: DiamondSidebarChild[] | null;
}

export interface DiamondSidebarResponse {
    success: boolean;
    msg: string;
    status: number;
    data: {
        t1: DiamondSidebarItem[];
    };
}

export interface DiamondMatchDetailsData {
    gmid: number;
    etid: number;
    m: number;
    gtv: number;
    ename: string;
    cid: number;
    cname: string;
    iplay: boolean;
    gtype: string;
    f1: boolean;
    f: boolean;
    bm: boolean;
    tv: boolean;
    scard: number;
    iscc: number;
    stime: string;
    mod: number;
    mname: string | null;
    oldgmid: number | null;
    port: number;
}

export interface DiamondMatchDetailsResponse {
    success: boolean;
    msg: string;
    status: number;
    data: DiamondMatchDetailsData[];
}

export interface DiamondScorecardTvData {
    diamond_score_one?: string;
    diamond_tv_one?: string;
}

export interface DiamondScorecardTvResponse {
    status: boolean;
    data: DiamondScorecardTvData;
}

export interface DiamondTopEventData {
    name: string;
    sportId: number;
    id: string;
    lid: string;
}

export interface DiamondTopEventsResponse {
    success: boolean;
    msg: string;
    status: number;
    data: DiamondTopEventData[];
}
