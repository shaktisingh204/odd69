"use client";
/**
 * useScrollReveal
 * Single-import wrapper around Framer Motion's useInView.
 * Returns { ref, isInView } — attach ref to your container,
 * then use isInView to toggle variants.
 *
 * Usage (simple):
 *   const { ref, isInView } = useScrollReveal();
 *   <motion.div ref={ref} variants={fadeUp} initial="hidden" animate={isInView ? "visible" : "hidden"}>
 *
 * Usage (with stagger container):
 *   const { ref, isInView } = useScrollReveal({ margin: '-80px' });
 *   <motion.ul ref={ref} variants={stagger} initial="hidden" animate={isInView ? "visible" : "hidden"}>
 *     {items.map(i => <motion.li key={i} variants={fadeUp} />)}
 *   </motion.ul>
 */
import { useRef } from 'react';
import { useInView } from 'framer-motion';

interface ScrollRevealOptions {
    /** IntersectionObserver margin (default: '-60px' = triggers 60px before entering viewport) */
    margin?: string;
    /** If true, fires every time element enters viewport. Default: false (fires once only). */
    repeat?: boolean;
    /** Fraction of element that must be visible before triggering. Default: 0 */
    amount?: number | 'some' | 'all';
}

export function useScrollReveal(options: ScrollRevealOptions = {}) {
    const { margin = '-60px', repeat = false, amount = 0 } = options;
    const ref = useRef<HTMLElement>(null);
    const isInView = useInView(ref as any, {
        once: !repeat,
        margin: margin as any,
        amount,
    });

    return { ref, isInView };
}

// ─── Typed convenience aliases ─────────────────────────────────────────────────

export function useSectionReveal() {
    return useScrollReveal({ margin: '-80px', repeat: false });
}

export function useCardReveal() {
    return useScrollReveal({ margin: '-40px', repeat: false });
}
