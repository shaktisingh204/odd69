"use client";
/**
 * useOddsFlash
 * Returns a CSS class string that briefly flashes when the given price changes.
 * Green flash = price went up.  Red flash = price went down.
 *
 * Usage:
 *   const flashClass = useOddsFlash(odds);
 *   <span className={`odds-chip ${flashClass}`}>{odds}</span>
 *
 * Add these classes to globals.css (already included in Phase 0 CSS update):
 *   .odds-flash-up   { animation: oddsUp   0.55s ease-out; }
 *   .odds-flash-down { animation: oddsDown 0.55s ease-out; }
 */
import { useEffect, useRef, useState } from 'react';

export function useOddsFlash(value: number | string): string {
    const prevRef = useRef<number | string>(value);
    const [flashClass, setFlashClass] = useState('');

    useEffect(() => {
        const prev = prevRef.current;
        prevRef.current = value;
        if (prev === value) return;

        const numPrev = parseFloat(String(prev));
        const numCur  = parseFloat(String(value));
        if (isNaN(numPrev) || isNaN(numCur)) return;

        const cls = numCur > numPrev ? 'odds-flash-up' : 'odds-flash-down';
        setFlashClass(cls);
        const t = setTimeout(() => setFlashClass(''), 600);
        return () => clearTimeout(t);
    }, [value]);

    return flashClass;
}
