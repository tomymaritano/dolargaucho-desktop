/**
 * Snapshot-only contract stub (mirrors Mac + Rust).
 * Live path in the tray spike is Rust `fetch_snapshot` — this module
 * documents the shape and can be used for pure-frontend tests.
 */

export const SNAPSHOT_URL =
  "https://dolargauchoapi-production.up.railway.app/snapshot";
export const PULSO_URL = "https://www.dolargaucho.com";

export interface SnapshotIndicator {
  amount?: number | null;
  compra?: number | null;
  venta?: number | null;
  isMock?: boolean | null;
}

export interface SnapshotPayload {
  indicators?: {
    dolar_blue?: SnapshotIndicator | null;
  } | null;
}

export interface BlueQuote {
  venta: number | null;
  compra: number | null;
}

/** Sell side = venta ?? amount. Compra only if present — never invented. */
export function blueFromIndicator(
  ind: SnapshotIndicator | null | undefined,
): BlueQuote {
  if (!ind || ind.isMock === true) {
    return { venta: null, compra: null };
  }
  return {
    venta: ind.venta ?? ind.amount ?? null,
    compra: ind.compra ?? null,
  };
}

/** Live GET /snapshot. Caller must drop previous on failure (no stale-as-live). */
export async function fetchSnapshotLive(
  url: string = SNAPSHOT_URL,
): Promise<SnapshotPayload> {
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "Cache-Control": "no-cache",
    },
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`snapshot HTTP ${res.status}`);
  }
  const body = await res.text();
  if (!body.trim()) {
    throw new Error("snapshot empty body");
  }
  return JSON.parse(body) as SnapshotPayload;
}

/** es_AR-ish amount like Mac DisplayFormatting.amount — `$1.545` / `$1.545,50`. */
export function formatAmountEsAr(value: number): string {
  const nf = new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `$${nf.format(value)}`;
}
