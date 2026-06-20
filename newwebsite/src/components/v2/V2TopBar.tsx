"use client";

import Link from "next/link";
import { useModal } from "@/context/ModalContext";

const NAV = [
  { label: "Casino", href: "/casino" },
  { label: "Live", href: "/live-dealers" },
  { label: "Sports", href: "/sports" },
  { label: "Originals", href: "/odd69-games" },
];

export default function V2TopBar() {
  const { openLogin, openRegister } = useModal();

  return (
    <header className="sticky top-0 z-40">
      <div className="mx-auto flex h-[64px] max-w-[1240px] items-center justify-between gap-4 px-4 md:px-6">
        <div className="flex items-center gap-8">
          <Link href="/v2" className="text-2xl font-extrabold tracking-tight">
            <span className="v2-grad-text">ODD</span>
            <span className="text-white">69</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <Link
                key={n.label}
                href={n.href}
                className="rounded-full px-3.5 py-2 text-sm font-semibold text-white/55 transition-colors hover:bg-white/[0.06] hover:text-white"
              >
                {n.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={openLogin}
            className="rounded-full px-4 py-2 text-sm font-semibold text-white/80 transition-colors hover:text-white active:scale-[0.97]"
          >
            Sign in
          </button>
          <button
            onClick={openRegister}
            className="rounded-full px-5 py-2 text-sm font-bold text-[#0b0712] shadow-[0_8px_30px_-8px_rgba(255,46,154,0.7)] transition-transform active:scale-[0.97]"
            style={{ backgroundImage: "linear-gradient(108deg,#ff2e9a,#b14dff 55%,#22d3ee)" }}
          >
            Join free
          </button>
        </div>
      </div>
      <div className="mx-auto h-px max-w-[1240px] bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </header>
  );
}
