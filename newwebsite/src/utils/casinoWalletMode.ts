export type CasinoWalletMode = 'main' | 'crypto' | 'fiatbonus' | 'cryptobonus';
export type WebsiteWalletType = 'fiat' | 'crypto';
export type WebsiteSubWalletType =
    | 'fiat-main'
    | 'fiat-casino'
    | 'fiat-sports'
    | 'crypto-main'
    | 'crypto-casino'
    | 'crypto-sports';

export function getWalletTypeFromSubWallet(subWallet?: string | null): WebsiteWalletType {
    return String(subWallet || '').startsWith('crypto') ? 'crypto' : 'fiat';
}

export function getMainSubWalletForWallet(wallet: WebsiteWalletType): WebsiteSubWalletType {
    return wallet === 'crypto' ? 'crypto-main' : 'fiat-main';
}

export function getCasinoWalletModeFromSubWallet(subWallet?: string | null): CasinoWalletMode {
    switch (subWallet) {
        case 'crypto-main':
        case 'crypto-sports':
            return 'crypto';
        case 'crypto-casino':
            return 'cryptobonus';
        case 'fiat-casino':
            return 'fiatbonus';
        case 'fiat-main':
        case 'fiat-sports':
        default:
            return 'main';
    }
}
