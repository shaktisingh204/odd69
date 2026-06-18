'use client';

import toast from 'react-hot-toast';

const toastStyle = {
    borderRadius: '12px',
    background: '#12141C',
    color: '#fff',
} as const;

export function showBetPlacedToast(options?: {
    activeSymbol?: string;
    stake?: number;
    selectionName?: string;
}) {
    const detail = [
        options?.selectionName,
        options?.stake ? `${options.activeSymbol ? `${options.activeSymbol}${options.stake}` : `Stake ${options.stake}`}` : null,
    ].filter(Boolean).join(' • ');

    toast.success(detail || 'Bet placed successfully!', {
        style: {
            ...toastStyle,
            border: '1px solid rgba(59,193,23,0.3)',
        },
    });
}

export function showBetErrorToast(error: any) {
    const message = error?.response?.data?.message || error?.message || 'Failed to place bet';

    if (message.includes('Suspended') || message.includes('suspended')) {
        toast.error('Market Suspended — please remove this selection and try another.', {
            style: {
                ...toastStyle,
                border: '1px solid rgba(255,80,80,0.3)',
            },
        });
        return;
    }

    if (message.includes('Odds changed') || message.includes('Prices Updated') || message.includes('please review')) {
        toast.error('Prices Updated — please review the new odds and place again.', {
            style: {
                ...toastStyle,
                border: '1px solid rgba(255,170,0,0.4)',
            },
        });
        return;
    }

    if (
        message.includes('Match completed') ||
        message.includes('Betting is closed') ||
        message.includes('betting is closed') ||
        message.includes('Market is already settled')
    ) {
        toast.error('Betting closed — this match has already finished.', {
            style: {
                ...toastStyle,
                border: '1px solid rgba(255,80,80,0.3)',
            },
        });
        return;
    }

    toast.error(message, {
        style: {
            ...toastStyle,
            border: '1px solid rgba(255,80,80,0.3)',
        },
    });
}
