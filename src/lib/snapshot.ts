/**
 * Snapshot-only contract (mirrors Mac DeskView + Rust).
 * Live path is Rust `fetch_snapshot` — this module types the signed print
 * and helpers for the desk UI. Never invent compra; spark only from snapshot.
 */

export const SNAPSHOT_URL =
  "https://dolargauchoapi-production.up.railway.app/snapshot";
export const PULSO_URL = "https://www.dolargaucho.com";

export type GlanceQuote = "blue" | "oficial" | "mep" | "ccl";

export const GLANCE_QUOTES: GlanceQuote[] = ["blue", "oficial", "mep", "ccl"];

export const GLANCE_LABELS: Record<GlanceQuote, string> = {
  blue: "Blue",
  oficial: "Oficial",
  mep: "MEP",
  ccl: "CCL",
};

export interface SnapshotVariations {
  dod?: number | null;
  wow?: number | null;
  mom?: number | null;
}

export interface SnapshotIndicator {
  amount?: number | null;
  compra?: number | null;
  venta?: number | null;
  previous?: number | null;
  date?: string | null;
  isMock?: boolean | null;
  spark?: number[] | null;
  variations?: SnapshotVariations | null;
}

export interface SnapshotIndicators {
  dolar_blue?: SnapshotIndicator | null;
  dolar_oficial?: SnapshotIndicator | null;
  dolar_mep?: SnapshotIndicator | null;
  dolar_ccl?: SnapshotIndicator | null;
}

export interface SnapshotStress {
  score?: number | null;
  severity?: string | null;
}

export interface SnapshotNarrative {
  headline?: string | null;
}

export interface SnapshotAnalysis {
  stress?: SnapshotStress | null;
  narrative?: SnapshotNarrative | null;
}

export interface SnapshotPayload {
  analysis?: SnapshotAnalysis | null;
  indicators?: SnapshotIndicators | null;
}

/** Sell side = venta ?? amount. Compra only if present — never invented. */
export function liveVenta(ind: SnapshotIndicator | null | undefined): number | null {
  if (!ind || ind.isMock === true) return null;
  return ind.venta ?? ind.amount ?? null;
}

export function liveCompra(ind: SnapshotIndicator | null | undefined): number | null {
  if (!ind || ind.isMock === true) return null;
  return ind.compra ?? null;
}

export function liveDate(ind: SnapshotIndicator | null | undefined): string | null {
  if (!ind || ind.isMock === true) return null;
  const d = ind.date?.trim();
  return d ? d : null;
}

export function liveSpark(ind: SnapshotIndicator | null | undefined): number[] | null {
  if (!ind || ind.isMock === true) return null;
  const spark = ind.spark;
  if (!spark || spark.length < 2) return null;
  return spark;
}

export function indicatorFor(
  quote: GlanceQuote,
  snapshot: SnapshotPayload | null | undefined,
): SnapshotIndicator | null {
  const indicators = snapshot?.indicators;
  if (!indicators) return null;
  switch (quote) {
    case "blue":
      return indicators.dolar_blue ?? null;
    case "oficial":
      return indicators.dolar_oficial ?? null;
    case "mep":
      return indicators.dolar_mep ?? null;
    case "ccl":
      return indicators.dolar_ccl ?? null;
  }
}

/** es_AR amount like Mac DisplayFormatting.amount — `$1.545` / `$1.545,50`. */
export function formatAmount(value: number): string {
  const nf = new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `$${nf.format(value)}`;
}

export function formatPercent(value: number): string {
  const nf = new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
    signDisplay: "exceptZero",
  });
  return `${nf.format(value)}%`;
}

export function formatScore(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value);
}

/** Site words for signed severity keys. Unknown values stay blank. */
export function severityWord(raw: string | null | undefined): string | null {
  if (!raw) return null;
  switch (raw.trim().toLowerCase()) {
    case "low":
      return "Estable";
    case "medium":
      return "Transición";
    case "high":
      return "Estrés";
    case "critical":
      return "Crisis";
    default:
      return null;
  }
}

export function formatDeviceClock(epochMs: number): string {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(epochMs));
}

/** AR FX convention: up = bad (negative/red), down = good (positive/green). */
export function moveTone(value: number | null | undefined): "accent" | "positive" | "negative" {
  if (value == null || value === 0) return "accent";
  return value > 0 ? "negative" : "positive";
}

export function stressTone(word: string | null): "accent" | "positive" | "negative" | "warning" {
  switch (word) {
    case "Estable":
      return "positive";
    case "Transición":
      return "warning";
    case "Estrés":
    case "Crisis":
      return "negative";
    default:
      return "accent";
  }
}
