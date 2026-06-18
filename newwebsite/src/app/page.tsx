import { getSliderConfig } from "@/lib/siteConfig";
import HomeShell from "./HomeShell";

// ─── Homepage ─────────────────────────────────────────────────────────────────
//
// This is an async server component — it fetches the hero slider config
// from the backend during SSR so the rendered HTML can include the
// first slide directly. Without this, the page renders a loading
// spinner that gets replaced by the real slider after hydration + a
// separate client-side fetch, which accounted for most of the desktop
// FCP → LCP gap (2.9 s in CrUX data).
//
// The fetch is wrapped in React.cache() + Next.js Data Cache, so
// multiple renders within the 60 s revalidate window hit memory, not
// origin.
//
// All interactivity lives in HomeShell (a client component that
// receives initialSliderConfig as a prop and forwards it to
// DynamicHeroSlider). This split is what lets the SSR of the client
// subtree emit real HTML for the hero instead of a spinner.

type HomePageSearchParams =
  | Promise<{ sport_id?: string | string[] }>
  | { sport_id?: string | string[] }
  | undefined;

export default async function Home({
  searchParams,
}: {
  searchParams?: HomePageSearchParams;
}) {
  const [sliderConfig, resolvedSearchParams] = await Promise.all([
    getSliderConfig("HOME"),
    Promise.resolve(searchParams),
  ]);

  const rawSportId = (await resolvedSearchParams)?.sport_id;
  const initialSportId = Array.isArray(rawSportId)
    ? (rawSportId[0] ?? null)
    : (rawSportId ?? null);

  return (
    <HomeShell
      initialSliderConfig={sliderConfig}
      initialSportId={initialSportId}
    />
  );
}
