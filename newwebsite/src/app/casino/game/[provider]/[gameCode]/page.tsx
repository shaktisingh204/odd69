'use client';

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

// Redirect legacy /casino/game/[provider]/[gameCode] URLs to the correct /casino/play/[gameCode]?provider= format
export default function LegacyGameRedirectPage() {
    const params = useParams();
    const router = useRouter();

    useEffect(() => {
        const provider = params.provider as string;
        const gameCode = params.gameCode as string;
        router.replace(`/casino/play/${gameCode}?provider=${encodeURIComponent(provider)}`);
    }, [params, router]);

    return (
        <div className="min-h-screen bg-bg-zeero-2 flex items-center justify-center">
            <div className="text-white/40 text-sm animate-pulse">Loading game…</div>
        </div>
    );
}
