'use client';

import { useRef, useEffect, type ReactNode } from 'react';
import { gsap } from 'gsap';

/**
 * GSAP entrance: on mount, the direct children gently rise + rotate into place
 * in 3D, staggered. Transform-only — it NEVER animates opacity, so content is
 * always visible (no flash-of-invisible, no "appears on hover" bug). GSAP only
 * touches these wrapper elements and clears its inline transform when done, so
 * the per-card Motion tilt is never in conflict. Respects reduced-motion.
 */
export default function RevealOnMount({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;

    const items = Array.from(el.children) as HTMLElement[];
    const ctx = gsap.context(() => {
      gsap.from(items, {
        y: 34,
        rotateX: 9,
        scale: 0.98,
        transformOrigin: '50% 100%',
        duration: 0.6,
        ease: 'power3.out',
        stagger: 0.08,
        clearProps: 'transform', // never touches opacity — content stays visible
      });
    }, el);

    return () => ctx.revert();
  }, []);

  return (
    <div ref={ref} className={className} style={{ perspective: 1200 }}>
      {children}
    </div>
  );
}
