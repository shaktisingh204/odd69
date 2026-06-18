export function getSubWalletLabel(subWallet: string) {
    switch (subWallet) {
        case 'fiat-main': return 'Fiat Main';
        case 'fiat-casino': return 'Fiat Casino Bonus';
        case 'fiat-sports': return 'Fiat Sports Bonus';
        case 'crypto-main': return 'Crypto Main';
        case 'crypto-casino': return 'Crypto Casino Bonus';
        case 'crypto-sports': return 'Crypto Sports Bonus';
        default: return 'Main';
    }
}
