import type { GlanceQuote } from "./snapshot";
import { GLANCE_QUOTES } from "./snapshot";

const STORAGE_KEY = "dg.desk.prefs.v1";

export interface DeskPrefs {
  glance: GlanceQuote;
  chartQuote: GlanceQuote;
  shown: GlanceQuote[];
  showVariations: boolean;
  showHeadline: boolean;
  showStress: boolean;
}

export function defaultPrefs(): DeskPrefs {
  return {
    glance: "blue",
    chartQuote: "blue",
    shown: [...GLANCE_QUOTES],
    showVariations: true,
    showHeadline: true,
    showStress: true,
  };
}

function isQuote(v: unknown): v is GlanceQuote {
  return v === "blue" || v === "oficial" || v === "mep" || v === "ccl";
}

export function loadPrefs(): DeskPrefs {
  const base = defaultPrefs();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<DeskPrefs>;
    const glance = isQuote(parsed.glance) ? parsed.glance : base.glance;
    const chartQuote = isQuote(parsed.chartQuote) ? parsed.chartQuote : base.chartQuote;
    const shown = Array.isArray(parsed.shown)
      ? (parsed.shown.filter(isQuote) as GlanceQuote[])
      : base.shown;
    return {
      glance,
      chartQuote,
      shown: shown.length > 0 ? shown : base.shown,
      showVariations:
        typeof parsed.showVariations === "boolean"
          ? parsed.showVariations
          : base.showVariations,
      showHeadline:
        typeof parsed.showHeadline === "boolean"
          ? parsed.showHeadline
          : base.showHeadline,
      showStress:
        typeof parsed.showStress === "boolean" ? parsed.showStress : base.showStress,
    };
  } catch {
    return base;
  }
}

export function savePrefs(prefs: DeskPrefs): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

/** Hide a quote; keep at least one. Retarget glance/chart if needed. */
export function setShown(prefs: DeskPrefs, quote: GlanceQuote, on: boolean): DeskPrefs {
  const next = { ...prefs, shown: [...prefs.shown] };
  if (on) {
    if (!next.shown.includes(quote)) next.shown.push(quote);
    return next;
  }
  if (next.shown.length <= 1) return prefs;
  next.shown = next.shown.filter((q) => q !== quote);
  if (next.glance === quote) {
    next.glance = GLANCE_QUOTES.find((q) => next.shown.includes(q)) ?? next.shown[0];
  }
  if (next.chartQuote === quote) {
    next.chartQuote =
      GLANCE_QUOTES.find((q) => next.shown.includes(q)) ?? next.shown[0];
  }
  return next;
}

/** Shape sent to Rust for tray title (never stress). */
export function toTrayPrefs(prefs: DeskPrefs) {
  return {
    glance: prefs.glance,
    shown: prefs.shown,
    chartQuote: prefs.chartQuote,
    showVariations: prefs.showVariations,
    showHeadline: prefs.showHeadline,
    showStress: prefs.showStress,
  };
}
