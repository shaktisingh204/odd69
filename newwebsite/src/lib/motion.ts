/**
 * lib/motion.ts
 * ─────────────────────────────────────────────────────────────────────
 * Central Framer Motion variant library for the Zeero website.
 * Import from here — never define one-off transitions inline.
 *
 * Usage:
 *   import { fadeUp, stagger, springConfig } from '@/lib/motion';
 *   <motion.div variants={fadeUp} initial="hidden" animate="visible" />
 * ─────────────────────────────────────────────────────────────────────
 */

import type { Variants, Transition } from 'framer-motion';

// ─── Spring presets ────────────────────────────────────────────────────────────

export const springConfig: Transition = {
    type: 'spring',
    stiffness: 320,
    damping: 26,
};

export const softSpring: Transition = {
    type: 'spring',
    stiffness: 200,
    damping: 22,
};

export const bouncySpring: Transition = {
    type: 'spring',
    stiffness: 380,
    damping: 18,
};

export const snappySpring: Transition = {
    type: 'spring',
    stiffness: 500,
    damping: 32,
};

// ─── Easing ───────────────────────────────────────────────────────────────────

export const ease = [0.22, 1, 0.36, 1] as const;   // custom ease-out expo
export const easeIn = [0.4, 0, 1, 1] as const;
export const easeInOut = [0.4, 0, 0.2, 1] as const;

// ─── Base variants ────────────────────────────────────────────────────────────

export const fadeUp: Variants = {
    hidden:  { opacity: 0, y: 16 },
    visible: { opacity: 1, y: 0,  transition: { duration: 0.35, ease } },
    exit:    { opacity: 0, y: 8,  transition: { duration: 0.2,  ease: easeIn } },
};

export const fadeDown: Variants = {
    hidden:  { opacity: 0, y: -16 },
    visible: { opacity: 1, y: 0,   transition: { duration: 0.35, ease } },
    exit:    { opacity: 0, y: -8,  transition: { duration: 0.2,  ease: easeIn } },
};

export const fadeIn: Variants = {
    hidden:  { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.3, ease } },
    exit:    { opacity: 0, transition: { duration: 0.18 } },
};

export const fadeLeft: Variants = {
    hidden:  { opacity: 0, x: 24 },
    visible: { opacity: 1, x: 0,  transition: { duration: 0.35, ease } },
    exit:    { opacity: 0, x: 12, transition: { duration: 0.2,  ease: easeIn } },
};

export const fadeRight: Variants = {
    hidden:  { opacity: 0, x: -24 },
    visible: { opacity: 1, x: 0,   transition: { duration: 0.35, ease } },
    exit:    { opacity: 0, x: -12, transition: { duration: 0.2,  ease: easeIn } },
};

export const scaleIn: Variants = {
    hidden:  { opacity: 0, scale: 0.92 },
    visible: { opacity: 1, scale: 1,    transition: { ...springConfig } },
    exit:    { opacity: 0, scale: 0.94, transition: { duration: 0.18, ease: easeIn } },
};

export const scaleInBouncy: Variants = {
    hidden:  { opacity: 0, scale: 0.6 },
    visible: { opacity: 1, scale: 1,   transition: { ...bouncySpring } },
    exit:    { opacity: 0, scale: 0.8, transition: { duration: 0.15 } },
};

// Sheet / modal slide variants (mobile bottom-sheet)
export const slideUp: Variants = {
    hidden:  { y: '100%', opacity: 0 },
    visible: { y: 0,       opacity: 1, transition: { ...springConfig } },
    exit:    { y: '100%', opacity: 0,  transition: { duration: 0.28, ease: easeIn } },
};

// Desktop modal (center scale)
export const dialogScale: Variants = {
    hidden:  { opacity: 0, scale: 0.93, y: -12 },
    visible: { opacity: 1, scale: 1,    y: 0,   transition: { ...springConfig } },
    exit:    { opacity: 0, scale: 0.95, y: -6,  transition: { duration: 0.22, ease: easeIn } },
};

export const slideFromLeft: Variants = {
    hidden:  { x: '-100%', opacity: 0 },
    visible: { x: 0,        opacity: 1, transition: { ...springConfig } },
    exit:    { x: '-100%', opacity: 0,  transition: { duration: 0.25, ease: easeIn } },
};

export const slideFromRight: Variants = {
    hidden:  { x: '100%', opacity: 0 },
    visible: { x: 0,       opacity: 1, transition: { ...springConfig } },
    exit:    { x: '100%', opacity: 0,  transition: { duration: 0.25, ease: easeIn } },
};

export const slideFromTop: Variants = {
    hidden:  { y: '-100%', opacity: 0 },
    visible: { y: 0,        opacity: 1, transition: { ...springConfig } },
    exit:    { y: '-100%', opacity: 0,  transition: { duration: 0.22, ease: easeIn } },
};

// ─── Stagger containers ───────────────────────────────────────────────────────

/** Wrap children with this so they stagger 0.06s apart */
export const stagger: Variants = {
    hidden:  {},
    visible: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
    exit:    { transition: { staggerChildren: 0.04, staggerDirection: -1 } },
};

/** Faster stagger for dense grids (game cards etc.) */
export const fastStagger: Variants = {
    hidden:  {},
    visible: { transition: { staggerChildren: 0.04, delayChildren: 0.02 } },
    exit:    { transition: { staggerChildren: 0.025, staggerDirection: -1 } },
};

/** Slow stagger for dramatic reveals (VIP tiers, promo cards) */
export const slowStagger: Variants = {
    hidden:  {},
    visible: { transition: { staggerChildren: 0.1, delayChildren: 0.08 } },
};

// ─── Hover / tap micro-interactions ──────────────────────────────────────────

/** Standard card hover lift */
export const hoverLift = {
    whileHover: { y: -4, scale: 1.01, transition: { duration: 0.2, ease } },
    whileTap:   { scale: 0.97,        transition: { duration: 0.1 } },
};

/** Subtle hover lift for list items */
export const hoverSubtle = {
    whileHover: { y: -2, transition: { duration: 0.18, ease } },
    whileTap:   { scale: 0.98 },
};

/** Button press */
export const tapPress = {
    whileTap: { scale: 0.94, transition: { duration: 0.1 } },
};

/** Icon hover spin */
export const iconHover = {
    whileHover: { rotate: 12, scale: 1.15, transition: { duration: 0.2, ease } },
};

/** Social / icon lift */
export const iconLift = {
    whileHover: { y: -3, scale: 1.2, transition: { duration: 0.18, ease } },
    whileTap:   { scale: 0.9 },
};

// ─── Error shake ──────────────────────────────────────────────────────────────

export const errorShake: Variants = {
    hidden:  { x: 0 },
    visible: {
        x: [0, 10, -10, 8, -8, 5, -5, 0],
        transition: { duration: 0.5, ease: 'easeInOut' },
    },
};

// ─── Backdrop ─────────────────────────────────────────────────────────────────

export const backdrop: Variants = {
    hidden:  { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.28 } },
    exit:    { opacity: 0, transition: { duration: 0.22 } },
};

// ─── Accordion / collapse ─────────────────────────────────────────────────────

/** Use with layout prop and AnimatePresence for height expand/collapse */
export const accordionItem: Variants = {
    hidden:  { opacity: 0, height: 0, overflow: 'hidden' },
    visible: {
        opacity: 1,
        height: 'auto',
        transition: { height: { ...softSpring }, opacity: { duration: 0.2, delay: 0.05 } },
    },
    exit:    {
        opacity: 0,
        height: 0,
        transition: { height: { duration: 0.22, ease: easeIn }, opacity: { duration: 0.15 } },
    },
};

// ─── Page transition ──────────────────────────────────────────────────────────

export const pageVariants: Variants = {
    hidden:  { opacity: 0, y: 12 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.32, ease } },
    exit:    { opacity: 0, y: -6, transition: { duration: 0.2, ease: easeIn } },
};

// ─── Reduced motion ───────────────────────────────────────────────────────────

/**
 * Call this to get motion-safe variants.
 * If user prefers-reduced-motion, all transitions become instant opacity fades.
 *
 * Usage in component:
 *   const v = useMotionVariants(fadeUp);
 *   <motion.div variants={v} ... />
 */
export function getReducedVariants(variants: Variants): Variants {
    // Stripped versions — only opacity, no movement
    const reduced: Variants = {};
    for (const key of Object.keys(variants)) {
        const v = variants[key];
        if (typeof v === 'object' && v !== null) {
            reduced[key] = {
                opacity: (v as any).opacity ?? 1,
                transition: { duration: 0.15 },
            };
        }
    }
    return reduced;
}

// ─── Viewport defaults ────────────────────────────────────────────────────────

/** Standard viewport setting for useInView triggers */
export const viewportOnce = { once: true, margin: '-60px' };
export const viewportRepeat = { once: false, margin: '-80px' };

// ─── Number animation helper ──────────────────────────────────────────────────

export const counterTransition: Transition = {
    duration: 1.2,
    ease: [0.22, 1, 0.36, 1],
};
