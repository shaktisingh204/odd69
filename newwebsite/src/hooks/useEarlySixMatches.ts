import { useState, useEffect } from 'react';
import { promotionApi } from '@/services/promotions';

let cachedIds: Set<string> | null = null;
let fetchPromise: Promise<Set<string>> | null = null;

export function useEarlySixMatches() {
    const [earlySixIds, setEarlySixIds] = useState<Set<string>>(cachedIds || new Set());

    useEffect(() => {
        if (cachedIds) return;

        if (!fetchPromise) {
            fetchPromise = promotionApi.getPromoTeamDeals().then(deals => {
                const ids = new Set(
                    deals
                        .filter(d => d.promotionType === 'FIRST_OVER_SIX_CASHBACK')
                        .map(d => String(d.eventId))
                );
                cachedIds = ids;
                return ids;
            }).catch(() => {
                fetchPromise = null;
                return new Set<string>();
            });
        }

        fetchPromise.then(ids => {
            setEarlySixIds(new Set(ids));
        });
    }, []);

    return earlySixIds;
}
