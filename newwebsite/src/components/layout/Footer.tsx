"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowUp,
  ChevronDown,
  Headphones,
  Shield,
  Wallet,
  Zap,
} from "lucide-react";
import { FaFacebookF, FaInstagram, FaPinterestP, FaWhatsapp } from "react-icons/fa";
import { FaXTwitter } from "react-icons/fa6";
import { SiTelegram, SiThreads } from "react-icons/si";
import type { IconType } from "react-icons";
import type { LucideIcon } from "lucide-react";
import api from "@/services/api";

type FooterLink = {
  label: string;
  href: string;
};

type SocialKey = "whatsapp" | "telegram" | "instagram" | "facebook" | "x" | "pinterest" | "threads";

type SocialItem = {
  key: SocialKey;
  label: string;
  Icon: IconType;
  bgClassName: string;
};

type FooterSocialEntry = { url: string; imageUrl: string };
type FooterSocials = Record<SocialKey, FooterSocialEntry>;
type FooterHighlightIcons = Record<HighlightKey, string>;
type FooterSettings = {
  businessEmail: string;
  partnersEmail: string;
  socials: FooterSocials;
  highlightIcons: FooterHighlightIcons;
};

const DEFAULT_FOOTER_SETTINGS: FooterSettings = {
  businessEmail: "business@zeero.bet",
  partnersEmail: "partners@zeero.bet",
  socials: {
    whatsapp:  { url: "", imageUrl: "" },
    telegram:  { url: "", imageUrl: "" },
    instagram: { url: "", imageUrl: "" },
    facebook:  { url: "", imageUrl: "" },
    x:         { url: "", imageUrl: "" },
    pinterest: { url: "", imageUrl: "" },
    threads:   { url: "", imageUrl: "" },
  },
  highlightIcons: {
    provablyFair: "",
    fastAssistance: "",
    secureWallet: "",
    vipBenefits: "",
  },
};

function parseFooterSettings(raw?: string): FooterSettings {
  if (!raw) return DEFAULT_FOOTER_SETTINGS;
  try {
    const parsed = JSON.parse(raw) as Partial<FooterSettings>;
    const socials: FooterSocials = { ...DEFAULT_FOOTER_SETTINGS.socials };
    if (parsed.socials) {
      for (const k of Object.keys(DEFAULT_FOOTER_SETTINGS.socials) as SocialKey[]) {
        const entry = (parsed.socials as Partial<FooterSocials>)[k];
        socials[k] = {
          url: entry?.url || "",
          imageUrl: entry?.imageUrl || "",
        };
      }
    }
    const highlightIcons: FooterHighlightIcons = { ...DEFAULT_FOOTER_SETTINGS.highlightIcons };
    if (parsed.highlightIcons) {
      for (const k of Object.keys(DEFAULT_FOOTER_SETTINGS.highlightIcons) as HighlightKey[]) {
        const val = (parsed.highlightIcons as Partial<FooterHighlightIcons>)[k];
        if (typeof val === "string") highlightIcons[k] = val;
      }
    }
    return {
      businessEmail: parsed.businessEmail || DEFAULT_FOOTER_SETTINGS.businessEmail,
      partnersEmail: parsed.partnersEmail || DEFAULT_FOOTER_SETTINGS.partnersEmail,
      socials,
      highlightIcons,
    };
  } catch {
    return DEFAULT_FOOTER_SETTINGS;
  }
}

type CertificationItem = {
  id: string;
  imageUrl: string;
  alt: string;
  href: string;
  visible: boolean;
};

type FooterCertifications = {
  enabled: boolean;
  awardsTitle: string;
  partnersTitle: string;
  awards: CertificationItem[];
  partners: CertificationItem[];
};

const DEFAULT_FOOTER_CERTIFICATIONS: FooterCertifications = {
  enabled: false,
  awardsTitle: "",
  partnersTitle: "",
  awards: [],
  partners: [],
};

function parseFooterCertifications(raw?: string): FooterCertifications {
  if (!raw) return DEFAULT_FOOTER_CERTIFICATIONS;
  try {
    const parsed = JSON.parse(raw) as Partial<FooterCertifications>;
    const normalize = (arr: unknown): CertificationItem[] => {
      if (!Array.isArray(arr)) return [];
      return arr
        .filter((x) => x && typeof (x as { imageUrl?: unknown }).imageUrl === "string")
        .map((x, i) => {
          const obj = x as Partial<CertificationItem>;
          return {
            id: String(obj.id || `cert-${i}`),
            imageUrl: String(obj.imageUrl || ""),
            alt: String(obj.alt || ""),
            href: String(obj.href || ""),
            visible: obj.visible !== false,
          };
        });
    };
    return {
      enabled: Boolean(parsed.enabled),
      awardsTitle: typeof parsed.awardsTitle === "string" ? parsed.awardsTitle : "",
      partnersTitle: typeof parsed.partnersTitle === "string" ? parsed.partnersTitle : "",
      awards: normalize(parsed.awards),
      partners: normalize(parsed.partners),
    };
  } catch {
    return DEFAULT_FOOTER_CERTIFICATIONS;
  }
}

type HighlightKey = "provablyFair" | "fastAssistance" | "secureWallet" | "vipBenefits";

type HighlightCard = {
  id: HighlightKey;
  title: string;
  description: string;
  href: string;
  Icon: LucideIcon;
  iconClassName: string;
};

const informationLinks: FooterLink[] = [
  { label: "Rules", href: "/legal/rules" },
  { label: "Promotions", href: "/promotions" },
  { label: "Partner program", href: "/referral" },
];

const categoryColumns: FooterLink[][] = [
  [
    { label: "Live Dealers", href: "/live-dealers" },
    { label: "Sports", href: "/sports" },
    { label: "Zeero Games", href: "/zeero-games" },
    { label: "Bonuses", href: "/promotions" },
  ],
  [
    { label: "Casino", href: "/casino" },
    { label: "VIP", href: "/vip" },
    { label: "Support", href: "/support" },
    { label: "Help Center", href: "/support/help-center" },
  ],
];

const socialItems: SocialItem[] = [
  { key: "whatsapp",  label: "WhatsApp",  Icon: FaWhatsapp,   bgClassName: "bg-[#25D366]" },
  { key: "telegram",  label: "Telegram",  Icon: SiTelegram,   bgClassName: "bg-[#27A5E7]" },
  {
    key: "instagram",
    label: "Instagram",
    Icon: FaInstagram,
    bgClassName: "bg-[linear-gradient(135deg,#F9CE34_0%,#EE2A7B_52%,#6228D7_100%)]",
  },
  { key: "facebook",  label: "Facebook",  Icon: FaFacebookF,  bgClassName: "bg-[#1877F2]" },
  { key: "x",         label: "X",         Icon: FaXTwitter,   bgClassName: "bg-[#FFFFFF] text-[#111214]" },
  { key: "pinterest", label: "Pinterest", Icon: FaPinterestP, bgClassName: "bg-[#BD081C]" },
  { key: "threads",   label: "Threads",   Icon: SiThreads,    bgClassName: "bg-[#FFFFFF] text-[#111214]" },
];

const highlightCards: HighlightCard[] = [
  {
    id: "provablyFair",
    title: "Provably fair",
    description: "See how Zeero keeps outcomes transparent and verifiable.",
    href: "/fairness",
    Icon: Shield,
    iconClassName: "text-brand-gold bg-brand-alpha-12",
  },
  {
    id: "fastAssistance",
    title: "Fast assistance",
    description: "Browse guides or reach our team without leaving the footer.",
    href: "/support/help-center",
    Icon: Headphones,
    iconClassName: "text-brand-gold bg-brand-alpha-12",
  },
  {
    id: "secureWallet",
    title: "Secure wallet",
    description: "Manage deposits, withdrawals, and balances with confidence.",
    href: "/profile",
    Icon: Wallet,
    iconClassName: "text-brand-gold bg-brand-alpha-12",
  },
  {
    id: "vipBenefits",
    title: "VIP benefits",
    description: "Explore elevated rewards, perks, and premium account care.",
    href: "/vip",
    Icon: Zap,
    iconClassName: "text-brand-gold bg-brand-alpha-12",
  },
];

function FooterLinkItem({ href, label }: FooterLink) {
  return (
    <Link
      href={href}
      className="block w-fit text-[15px] leading-6 text-white/58 transition-colors hover:text-white"
    >
      {label}
    </Link>
  );
}

function UtilityBar() {
  return (
    <div className="flex items-center gap-3 md:gap-4">
      <button
        type="button"
        className="inline-flex h-10 items-center gap-2 rounded-[14px] bg-white/[0.06] px-3 text-sm font-semibold text-white/86 transition-colors hover:bg-white/[0.1]"
      >
        <span className="text-base">🇬🇧</span>
        <span>EN</span>
        <ChevronDown className="h-4 w-4 text-white/50" />
      </button>

      <button
        type="button"
        aria-label="Scroll to top"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        className="inline-flex h-10 w-10 items-center justify-center rounded-[14px] bg-white/[0.06] text-white/82 transition-colors hover:bg-white/[0.1]"
      >
        <ArrowUp className="h-4 w-4" />
      </button>
    </div>
  );
}

function SupportAvatar({ mobile = false }: { mobile?: boolean }) {
  return (
    <div
      className={`absolute ${
        mobile ? "bottom-0 right-3 h-[88px] w-[72px] pointer-events-none" : "bottom-0 right-[67px] h-[132px] w-[82px]"
      }`}
      style={{ zIndex: 20 }}
    >
      {/* Glow */}
      <div className={`pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(139,92,246,0.45)_0%,rgba(139,92,246,0.10)_55%,transparent_74%)] ${mobile ? "h-[62px] w-[62px]" : "h-[88px] w-[88px]"}`} />
      {/* Head */}
      <div className={`pointer-events-none absolute left-1/2 -translate-x-1/2 rounded-full bg-[linear-gradient(180deg,#f3d7bf_0%,#d6a482_100%)] shadow-[0_8px_20px_rgba(0,0,0,0.26)] ${mobile ? "bottom-[16px] h-[28px] w-[28px]" : "bottom-[20px] h-[40px] w-[40px]"}`} />
      {/* Face */}
      <div className={`pointer-events-none absolute left-1/2 flex -translate-x-1/2 items-center justify-between text-text-inverse ${mobile ? "bottom-[37px] h-[12px] w-[38px]" : "bottom-[52px] h-[18px] w-[54px]"}`}>
        <span className={`${mobile ? "h-3 w-1.5" : "h-4 w-2"} rounded-full bg-text-inverse`} />
        <span className={`${mobile ? "h-1.5 w-6" : "h-2 w-8"} rounded-full bg-text-inverse`} />
        <span className={`${mobile ? "h-3 w-1.5" : "h-4 w-2"} rounded-full bg-text-inverse`} />
      </div>
      {/* Body — overflow-visible so the button can extend left */}
      <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 overflow-visible bg-[linear-gradient(180deg,#8B5CF6_0%,#7C3AED_100%)] shadow-[0_16px_36px_rgba(200,136,12,0.35)] ${mobile ? "h-[58px] w-[58px] rounded-t-[22px]" : "h-[78px] w-[82px] rounded-t-[30px]"}`}>
        <div className={`absolute rounded-full border border-white/16 ${mobile ? "inset-x-2 top-3 h-5" : "inset-x-3 top-4 h-8"}`} />
        {/* Contact support button — anchored to the body, extends left */}
        {!mobile && (
          <div className="absolute right-[calc(100%+12px)] top-1/2 -translate-y-1/2 pointer-events-auto">
            <Link
              href="/support"
              className="inline-flex h-10 items-center justify-center rounded-[12px] bg-white/[0.08] border border-white/[0.10] backdrop-blur-md px-6 text-[13px] font-black text-white whitespace-nowrap transition-all hover:bg-white/[0.14] hover:scale-[1.02]"
            >
              Contact support
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function SupportCard({ mobile = false }: { mobile?: boolean }) {
  return (
    <div
      className={`relative rounded-[26px] border border-white/[0.04] bg-[linear-gradient(135deg,#12141C_0%,#0F1016_54%,#141620_100%)] ${
        mobile ? "overflow-hidden rounded-[20px] px-4 pb-4 pt-4" : "overflow-visible min-h-[122px] px-5 py-5 md:px-6"
      }`}
    >
      {/* Clipped gradient background */}
      <div className="absolute inset-0 overflow-hidden rounded-[26px]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_48%_100%,rgba(139,92,246,0.20),transparent_36%)]" />
      </div>
      <div className={`relative z-10 ${mobile ? "pr-[74px]" : "pr-[240px]"}`}>
        <div className={mobile ? "" : "max-w-[255px]"}>
          <div className="flex items-center gap-2">
            <span className={`${mobile ? "text-[13px]" : "text-[15px]"} font-bold text-white`}>Support</span>
            <span className={`rounded-full bg-brand-gold font-black text-text-white ${mobile ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[12px]"}`}>
              24/7
            </span>
          </div>
          <p className={`mt-2 max-w-[240px] text-white/56 ${mobile ? "text-[12px] leading-[18px]" : "text-[15px] leading-6"}`}>
            Contact us if you still have questions
          </p>
        </div>
      </div>

      <SupportAvatar mobile={mobile} />

      {mobile && (
        <div className="relative z-10 mt-3">
          <Link
            href="/support"
            className="inline-flex h-9 w-full items-center justify-center rounded-[12px] bg-brand-gold px-4 text-[13px] font-black text-text-white transition-transform hover:scale-[1.01]"
          >
            Contact support
          </Link>
        </div>
      )}
    </div>
  );
}

function EmailCard({
  title,
  email,
}: {
  title: string;
  email: string;
}) {
  return (
    <a
      href={`mailto:${email}`}
      className="flex h-full min-h-[88px] flex-col justify-center rounded-[18px] border border-white/[0.04] bg-white/[0.03] px-4 py-4 transition-colors hover:bg-white/[0.05] hover:border-white/[0.06] md:min-h-[122px] md:rounded-[24px] md:px-5 md:py-6"
    >
      <p className="text-[12px] text-white/36 md:text-[15px]">{title}</p>
      <p className="mt-1 text-[14px] font-medium leading-5 text-white/82 md:mt-2 md:text-[16px]">{email}</p>
    </a>
  );
}

function HighlightCardItem({
  title,
  description,
  href,
  Icon,
  iconClassName,
  iconUrl,
}: HighlightCard & { iconUrl?: string }) {
  return (
    <Link
      href={href}
      className="group relative flex h-full min-h-[124px] flex-col justify-between overflow-hidden rounded-[18px] border border-white/[0.04] bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] p-3 transition-all hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.05),rgba(255,255,255,0.03))] hover:border-white/[0.06] hover:shadow-[0_8px_24px_rgba(0,0,0,0.3)] md:min-h-[156px] md:rounded-[24px] md:p-5"
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent_34%)] opacity-70" />
      <div className="relative z-10">
        {iconUrl ? (
          <div className="inline-flex h-8 w-8 items-center justify-center overflow-hidden rounded-[10px] bg-white/[0.04] md:h-11 md:w-11 md:rounded-[14px]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={iconUrl}
              alt={title}
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <div className={`inline-flex h-8 w-8 items-center justify-center rounded-[10px] ${iconClassName} md:h-11 md:w-11 md:rounded-[14px]`}>
            <Icon className="h-3.5 w-3.5 md:h-5 md:w-5" />
          </div>
        )}
        <h4 className="mt-2.5 text-[13px] font-black leading-[18px] text-white md:mt-4 md:text-[18px] md:leading-6">{title}</h4>
        <p className="mt-1.5 max-w-[240px] text-[10px] leading-4 text-white/58 md:mt-2 md:text-[14px] md:leading-6">{description}</p>
      </div>

      <span className="relative z-10 mt-3 text-[8px] font-black uppercase tracking-[0.14em] text-white/34 transition-colors group-hover:text-white/48 md:mt-5 md:text-[12px] md:tracking-[0.18em]">
        Explore
      </span>
    </Link>
  );
}

function MobileSection({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-white/[0.08] py-5">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-[17px] font-bold text-white">{title}</span>
        <ChevronDown
          className={`h-5 w-5 text-white/54 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && <div className="pt-4">{children}</div>}
    </div>
  );
}

function CertificationsBar({ data }: { data: FooterCertifications }) {
  if (!data.enabled) return null;
  const awards = data.awards.filter((a) => a.visible && a.imageUrl);
  const partners = data.partners.filter((p) => p.visible && p.imageUrl);
  if (awards.length === 0 && partners.length === 0) return null;

  const renderItem = (item: CertificationItem, variant: "award" | "partner") => {
    const sizeClass =
      variant === "award"
        ? "h-[68px] w-[112px] md:h-[84px] md:w-[132px]"
        : "h-[52px] w-[112px] md:h-[64px] md:w-[140px]";
    const inner = (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={item.imageUrl}
        alt={item.alt || "certification"}
        className="max-h-full max-w-full object-contain"
      />
    );
    const wrapperClass = `flex ${sizeClass} shrink-0 items-center justify-center rounded-[14px] border border-white/[0.05] bg-white/[0.03] px-3 py-2 transition-colors hover:bg-white/[0.06]`;
    if (item.href) {
      return (
        <a
          key={item.id}
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          className={wrapperClass}
        >
          {inner}
        </a>
      );
    }
    return (
      <div key={item.id} className={wrapperClass}>
        {inner}
      </div>
    );
  };

  return (
    <div className="border-t border-white/[0.03] bg-bg-deep">
      <div className="mx-auto max-w-[1520px] px-4 py-6 md:px-8 md:py-8">
        {awards.length > 0 && (
          <div>
            {data.awardsTitle && (
              <p className="mb-3 text-[11px] font-black uppercase tracking-[0.18em] text-white/40">
                {data.awardsTitle}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-center gap-3 md:justify-start md:gap-4">
              {awards.map((a) => renderItem(a, "award"))}
            </div>
          </div>
        )}
        {partners.length > 0 && (
          <div className={awards.length > 0 ? "mt-6" : ""}>
            {data.partnersTitle && (
              <p className="mb-3 text-[11px] font-black uppercase tracking-[0.18em] text-white/40">
                {data.partnersTitle}
              </p>
            )}
            <div className="flex flex-wrap items-center justify-center gap-3 md:justify-start md:gap-6">
              {partners.map((p) => renderItem(p, "partner"))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function Footer() {
  const [openMobileSection, setOpenMobileSection] = useState<"information" | "categories" | null>(null);
  const [footerSettings, setFooterSettings] = useState<FooterSettings>(DEFAULT_FOOTER_SETTINGS);
  const [certifications, setCertifications] = useState<FooterCertifications>(DEFAULT_FOOTER_CERTIFICATIONS);

  useEffect(() => {
    api
      .get("/settings/public")
      .then((res) => {
        setFooterSettings(parseFooterSettings(res.data?.FOOTER_SETTINGS));
        setCertifications(parseFooterCertifications(res.data?.FOOTER_CERTIFICATIONS));
      })
      .catch(() => {
        /* keep defaults */
      });
  }, []);

  return (
    <footer className="border-t border-white/[0.03] bg-bg-deep text-text-white">
      <CertificationsBar data={certifications} />
      <div className="mx-auto max-w-[1520px] px-4 pb-24 pt-7 md:px-8 md:pb-10 md:pt-8">
        <div className="flex items-center gap-4">
          <Link href="/" className="shrink-0 text-[32px] font-extrabold italic tracking-[-0.06em] text-white md:text-[34px]">
            Zeero
          </Link>
          <div className="hidden h-px flex-1 bg-white/[0.04] md:block" />
          <div className="ml-auto">
            <UtilityBar />
          </div>
        </div>

        <div className="md:hidden">
          <MobileSection
            title="Information"
            open={openMobileSection === "information"}
            onToggle={() =>
              setOpenMobileSection((current) => (current === "information" ? null : "information"))
            }
          >
            <div className="space-y-3">
              {informationLinks.map((link) => (
                <FooterLinkItem key={link.label} {...link} />
              ))}
            </div>
          </MobileSection>

          <MobileSection
            title="Categories"
            open={openMobileSection === "categories"}
            onToggle={() =>
              setOpenMobileSection((current) => (current === "categories" ? null : "categories"))
            }
          >
            <div className="grid grid-cols-2 gap-4">
              {categoryColumns.map((column, index) => (
                <div key={index} className="space-y-3">
                  {column.map((link) => (
                    <FooterLinkItem key={link.label} {...link} />
                  ))}
                </div>
              ))}
            </div>
          </MobileSection>

          <div className="mt-5 space-y-4">
            <SupportCard mobile />
            <EmailCard title="Commercial offers" email={footerSettings.businessEmail} />
            <EmailCard title="Partner program" email={footerSettings.partnersEmail} />
            <div className="grid grid-cols-2 gap-3 sm:gap-4">
              {highlightCards.map((card) => (
                <HighlightCardItem key={card.title} {...card} iconUrl={footerSettings.highlightIcons[card.id]} />
              ))}
            </div>
          </div>
        </div>

        <div className="hidden md:block">
          <div className="mt-10 grid grid-cols-12 items-stretch gap-4">
            <div className="col-span-12 xl:col-span-6">
              <SupportCard />
            </div>
            <div className="col-span-6 xl:col-span-3">
              <EmailCard title="Commercial offers" email={footerSettings.businessEmail} />
            </div>
            <div className="col-span-6 xl:col-span-3">
              <EmailCard title="Partner program" email={footerSettings.partnersEmail} />
            </div>
          </div>

          <div className="mt-10 grid grid-cols-12 items-start gap-8">
            <div className="col-span-12 lg:col-span-6 xl:col-span-6">
              <div className="grid grid-cols-[180px_1fr] gap-8 xl:gap-12">
                <div>
                  <h4 className="text-[18px] font-black text-white">Information</h4>
                  <div className="mt-5 space-y-4">
                    {informationLinks.map((link) => (
                      <FooterLinkItem key={link.label} {...link} />
                    ))}
                  </div>
                </div>

                <div>
                  <h4 className="text-[18px] font-black text-white">Categories</h4>
                  <div className="mt-5 grid grid-cols-2 gap-8">
                    {categoryColumns.map((column, index) => (
                      <div key={index} className="space-y-4">
                        {column.map((link) => (
                          <FooterLinkItem key={link.label} {...link} />
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="col-span-12 lg:col-span-6 xl:col-span-6">
              <div className="grid grid-cols-2 gap-4">
                {highlightCards.map((card) => (
                  <HighlightCardItem key={card.title} {...card} iconUrl={footerSettings.highlightIcons[card.id]} />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 border-t border-white/[0.08] pt-7">
          <div className="flex flex-wrap items-center gap-3">
            {socialItems.map(({ key, label, Icon, bgClassName }) => {
              const entry = footerSettings.socials[key];
              const hasCustomImage = Boolean(entry.imageUrl);
              const sharedClasses = `inline-flex h-10 w-10 items-center justify-center rounded-xl text-[17px] text-white shadow-[0_4px_16px_rgba(0,0,0,0.3)] transition-all hover:scale-[1.08] hover:-translate-y-0.5 ${
                hasCustomImage ? "overflow-hidden bg-white/[0.04]" : bgClassName
              }`;
              const inner = hasCustomImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={entry.imageUrl}
                  alt={label}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              ) : (
                <Icon />
              );

              if (entry.url) {
                return (
                  <a
                    key={label}
                    href={entry.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    title={label}
                    className={sharedClasses}
                  >
                    {inner}
                  </a>
                );
              }

              return (
                <button
                  key={label}
                  type="button"
                  aria-label={label}
                  title={label}
                  className={sharedClasses}
                >
                  {inner}
                </button>
              );
            })}
          </div>

          <div className="mt-8 flex items-end justify-between gap-4 text-sm text-white/38">
            <p>&copy; 2026 Zeero.</p>
            <p className="text-[32px] font-bold leading-none text-white/34">18+</p>
          </div>
        </div>
      </div>
    </footer>
  );
}
