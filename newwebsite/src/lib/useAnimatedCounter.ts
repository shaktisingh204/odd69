"use client";
/**
 * useAnimatedCounter
 * Smoothly animates a numeric value from its previous state to the new one.
 * Uses Framer Motion's animate() for GPU-composited number interpolation.
 *
 * Usage:
 *   const display = useAnimatedCounter(balance, { duration: 1.2, prefix: '$' });
 *   <span>{display}</span>
 */
import { useEffect, useRef, useState } from 'react';
import { animate } from 'framer-motion';

interface CounterOptions {
    duration?: number;        // seconds (default 1.0)
    decimals?: number;        // decimal places (default 0)
    prefix?: string;          // e.g. '$', '$'
    suffix?: string;          // e.g. '%', 'x'
    ease?: string | number[]; // easing (default expo out)
    startFrom?: number;       // override start value (default 0 on first render)
}

export function useAnimatedCounter(
    value: number,
    options: CounterOptions = {},
): string {
    const {
        duration = 1.0,
        decimals = 0,
        prefix = '',
        suffix = '',
        ease = [0.22, 1, 0.36, 1],
        startFrom,
    } = options;

    const prevRef   = useRef<number>(startFrom ?? 0);
    const [display, setDisplay] = useState<string>(
        `${prefix}${(startFrom ?? 0).toFixed(decimals)}${suffix}`,
    );

    useEffect(() => {
        if (value === prevRef.current) return;
        const from = prevRef.current;
        prevRef.current = value;

        const controls = animate(from, value, {
            duration,
            ease: ease as any,
            onUpdate(latest) {
                setDisplay(
                    `${prefix}${latest.toFixed(decimals)}${suffix}`,
                );
            },
        });

        return () => controls.stop();
    }, [value, duration, decimals, prefix, suffix, ease]);

    return display;
}

// ─── Variant: count from 0 on first mount ─────────────────────────────────────

export function useCountUp(
    target: number,
    options: CounterOptions = {},
): string {
    return useAnimatedCounter(target, { startFrom: 0, ...options });
}
