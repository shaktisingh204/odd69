'use client';

import { useRef, type ReactNode } from 'react';
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  useReducedMotion,
} from 'framer-motion';

/**
 * Wraps content in a mouse-tracking 3D parallax tilt.
 * Continuous pointer values run on Motion values (off the React render loop)
 * and are smoothed with a spring, per Emil's pointer-physics guidance.
 * Collapses to a plain wrapper under prefers-reduced-motion.
 */
export default function TiltCard({
  children,
  className = '',
  max = 11,
  scale = 1.02,
  glare = true,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
  scale?: number;
  glare?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const sx = useSpring(px, { stiffness: 170, damping: 16, mass: 0.4 });
  const sy = useSpring(py, { stiffness: 170, damping: 16, mass: 0.4 });

  const rotateY = useTransform(sx, [0, 1], [-max, max]);
  const rotateX = useTransform(sy, [0, 1], [max, -max]);
  const glareX = useTransform(sx, [0, 1], [12, 88]);
  const glareY = useTransform(sy, [0, 1], [8, 92]);
  const glareBg = useTransform(
    [glareX, glareY],
    ([gx, gy]: number[]) =>
      `radial-gradient(150px 150px at ${gx}% ${gy}%, rgba(255,255,255,0.5), transparent 60%)`,
  );

  if (reduce) {
    return <div className={className}>{children}</div>;
  }

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    px.set((e.clientX - r.left) / r.width);
    py.set((e.clientY - r.top) / r.height);
  };
  const onLeave = () => {
    px.set(0.5);
    py.set(0.5);
  };

  return (
    <div className={className} style={{ perspective: 900 }}>
      <motion.div
        ref={ref}
        onPointerMove={onMove}
        onPointerLeave={onLeave}
        whileHover={{ scale }}
        transition={{ type: 'spring', stiffness: 220, damping: 20 }}
        style={{
          rotateX,
          rotateY,
          transformStyle: 'preserve-3d',
          willChange: 'transform',
        }}
        className="relative h-full w-full"
      >
        {children}
        {glare && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0 z-20 rounded-[inherit] mix-blend-soft-light"
            style={{ background: glareBg }}
          />
        )}
      </motion.div>
    </div>
  );
}
