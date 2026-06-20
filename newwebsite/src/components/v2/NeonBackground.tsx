"use client";

// Fixed, non-interactive neon canvas behind the whole v2 page.
// Three drifting aurora blobs (magenta / violet / cyan) + a faint grid +
// a static grain layer. Grain is on a fixed pointer-events-none element so
// it never repaints during scroll (perf rule 6.E).
export default function NeonBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#08060f]">
      {/* aurora blobs */}
      <div className="v2-aurora absolute -top-[20%] -left-[10%] h-[55vmax] w-[55vmax] rounded-full opacity-50 blur-[90px]"
           style={{ background: "radial-gradient(circle, #ff2e9a 0%, transparent 62%)" }} />
      <div className="v2-aurora absolute top-[30%] right-[-15%] h-[50vmax] w-[50vmax] rounded-full opacity-45 blur-[100px]"
           style={{ background: "radial-gradient(circle, #22d3ee 0%, transparent 62%)", animationDelay: "-7s" }} />
      <div className="v2-aurora absolute bottom-[-25%] left-[25%] h-[48vmax] w-[48vmax] rounded-full opacity-40 blur-[110px]"
           style={{ background: "radial-gradient(circle, #b14dff 0%, transparent 64%)", animationDelay: "-13s" }} />

      {/* faint grid */}
      <div className="absolute inset-0 opacity-[0.06]"
           style={{
             backgroundImage:
               "linear-gradient(#ffffff 1px, transparent 1px), linear-gradient(90deg, #ffffff 1px, transparent 1px)",
             backgroundSize: "64px 64px",
             maskImage: "radial-gradient(ellipse 80% 60% at 50% 30%, #000 30%, transparent 80%)",
             WebkitMaskImage: "radial-gradient(ellipse 80% 60% at 50% 30%, #000 30%, transparent 80%)",
           }} />

      {/* grain */}
      <div className="absolute inset-0 opacity-[0.18] mix-blend-soft-light"
           style={{
             backgroundImage:
               "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
           }} />

      {/* deepen the bottom for footer legibility */}
      <div className="absolute inset-x-0 bottom-0 h-[40vh] bg-gradient-to-t from-[#08060f] to-transparent" />
    </div>
  );
}
