import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import {
  type GlanceQuote,
  type SnapshotPayload,
  GLANCE_LABELS,
  GLANCE_QUOTES,
  formatAmount,
  formatDeviceClock,
  formatPercent,
  formatScore,
  indicatorFor,
  liveCompra,
  liveDate,
  liveSpark,
  liveVenta,
  moveTone,
  severityWord,
  stressTone,
} from "./lib/snapshot";
import {
  type DeskPrefs,
  loadPrefs,
  savePrefs,
  setShown,
  toTrayPrefs,
} from "./lib/prefs";

export interface UiState {
  trayTitle: string;
  snapshot: SnapshotPayload | null;
  lastSuccessAt: number | null;
  lastError: string | null;
  isLoading: boolean;
  didSucceed: boolean;
}

type Screen = "board" | "settings";

const GAUCHO_MARK = `<svg class="mark" viewBox="0 0 138.163 138.135" aria-hidden="true" focusable="false"><path fill="currentColor" d="M94.9749 4.9965C86.721 1.6839 77.9978 0 69.0676 0C50.6137 0 33.264 7.19109 20.2068 20.2344C7.17729 33.2778 0 50.6137 0 69.0676C0 87.5215 7.19109 104.871 20.2344 117.901C33.2916 130.958 50.6413 138.135 69.0952 138.135C87.5491 138.135 104.899 130.944 117.928 117.901C130.986 104.83 138.163 87.4801 138.163 69.0676C138.163 53.388 132.269 41.09 132.269 41.09H96.714V5.78324L94.9887 5.0103L94.9749 4.9965ZM126.003 50.2962L126.155 50.7793C128.046 56.6454 129.012 62.8151 129.012 69.1228C129.012 85.1199 122.773 100.165 111.455 111.483L110.779 112.159L110.751 112.104C99.5159 122.994 84.7472 128.984 69.0676 128.984C53.388 128.984 38.0258 122.745 26.7078 111.427C15.3898 100.109 9.15105 85.0647 9.15105 69.0676C9.15105 53.0705 15.3898 38.0258 26.7078 26.7078C38.0258 15.3898 53.0705 9.15105 69.0676 9.15105C80.9378 9.15105 87.77 12.1324 87.77 12.1324V41.1038H69.0676C61.7523 41.1038 54.8649 43.9747 49.6337 49.192C44.4026 54.4094 41.5455 61.3106 41.5455 68.6259C41.5455 75.9413 44.4164 82.8287 49.6337 88.0598C54.8511 93.2772 61.7523 96.1481 69.0676 96.1481C76.3829 96.1481 83.16 93.2772 88.5015 88.046C95.9411 80.7859 96.6588 73.7191 96.6036 65.9483H87.4939C87.9218 71.9385 86.0861 77.1835 82.042 81.5451C78.7984 85.0371 74.2021 86.9694 69.0952 86.9694C63.9883 86.9694 59.6543 85.0509 56.1623 81.5589C52.6703 78.0668 50.7517 73.4844 50.7517 68.6259C50.7517 63.7675 52.6703 59.185 56.1623 55.693C59.6543 52.201 64.2368 50.2824 69.0952 50.2824H126.003V50.2962Z"/></svg>`;

let prefs: DeskPrefs = loadPrefs();
let screen: Screen = "board";
let ui: UiState = {
  trayTitle: "DólarGaucho",
  snapshot: null,
  lastSuccessAt: null,
  lastError: null,
  isLoading: false,
  didSucceed: false,
};
let inTauri = false;

async function syncPrefsToRust(): Promise<void> {
  if (!inTauri) return;
  try {
    ui = await invoke<UiState>("set_tray_prefs", { prefs: toTrayPrefs(prefs) });
  } catch {
    // ignore outside runtime
  }
}

function persistPrefs(next: DeskPrefs): void {
  prefs = next;
  savePrefs(prefs);
  void syncPrefsToRust();
  render();
}

function toneClass(tone: string): string {
  return tone;
}

function sparkSvg(values: number[]): string {
  const w = 320;
  const h = 92;
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = Math.max(high - low, 0.0001);
  const points = values.map((v, i) => {
    const x = (w * i) / Math.max(values.length - 1, 1);
    const y = h - (h * (v - low)) / span;
    return `${x},${y}`;
  });
  const last = values[values.length - 1];
  const first = values[0];
  const delta = last - first;
  const tone = moveTone(delta);
  const fill =
    tone === "positive"
      ? "#e8f5ee"
      : tone === "negative"
        ? "#f8ecea"
        : "#e8f1fb";
  const stroke =
    tone === "positive" ? "#1b7a4e" : tone === "negative" ? "#c23b2e" : "#0082fe";
  const firstPt = points[0];
  const lastPt = points[points.length - 1];
  const [lx] = lastPt.split(",");
  const [fx] = firstPt.split(",");
  const area = `${fx},${h} ${points.join(" ")} ${lx},${h}`;
  return `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
    <polygon points="${area}" fill="${fill}" />
    <polyline points="${points.join(" ")}" fill="none" stroke="${stroke}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
  </svg>`;
}

function renderBoard(): string {
  const snap = ui.snapshot;
  const print = indicatorFor(prefs.glance, snap);
  const venta = liveVenta(print);
  const compra = liveCompra(print);
  const move = print?.variations?.dod ?? null;
  const edgeTone = moveTone(move);
  const edgeColor =
    edgeTone === "positive"
      ? "#1b7a4e"
      : edgeTone === "negative"
        ? "#c23b2e"
        : "#0082fe";

  let heroBody: string;
  if (venta != null) {
    const pill =
      prefs.showVariations && move != null
        ? `<span class="pill ${toneClass(moveTone(move))}">${formatPercent(move)}</span>`
        : "";
    const compraNote =
      compra != null
        ? `<p class="compra-note">Compra ${formatAmount(compra)}</p>`
        : `<p class="compra-note muted">Compra no viene en esta lectura</p>`;
    const date = liveDate(print);
    heroBody = `
      <p class="venta">${formatAmount(venta)}</p>
      <div class="hero-meta">${pill}${compraNote}</div>
      ${date ? `<p class="live-date">${date}</p>` : ""}
    `;
  } else {
    heroBody = `<p class="empty-note">La cotización de la barra no está en esta lectura.</p>`;
  }

  const chartInd = indicatorFor(prefs.chartQuote, snap);
  const series = liveSpark(chartInd);
  let chartBody: string;
  if (series) {
    const low = Math.min(...series);
    const high = Math.max(...series);
    chartBody = `
      <div class="spark-wrap">${sparkSvg(series)}</div>
      <div class="spark-range"><span>${formatAmount(low)}</span><span>${formatAmount(high)}</span></div>
    `;
  } else {
    chartBody = `<p class="empty-note">Sin serie para graficar en esta lectura.</p>`;
  }

  const visible = GLANCE_QUOTES.filter((q) => prefs.shown.includes(q));
  let tableBody: string;
  if (visible.length === 0) {
    tableBody = `<p class="empty-note">Ninguna cotización visible.</p>`;
  } else {
    tableBody = visible
      .map((quote) => {
        const ind = indicatorFor(quote, snap);
        const selected = quote === prefs.glance;
        const dod = ind?.variations?.dod ?? null;
        const rowVenta = liveVenta(ind);
        const varHtml =
          prefs.showVariations && dod != null
            ? `<span class="quote-var ${toneClass(moveTone(dod))}">${formatPercent(dod)}</span>`
            : "";
        const ventaHtml =
          rowVenta != null
            ? `<span class="quote-venta">${formatAmount(rowVenta)}</span>`
            : `<span class="quote-missing">Sin datos</span>`;
        return `<div class="quote-row">
          <span class="dot ${selected ? "on" : ""}"></span>
          <span class="quote-name ${selected ? "selected" : ""}">${GLANCE_LABELS[quote]}</span>
          ${varHtml}
          ${ventaHtml}
        </div>`;
      })
      .join("");
  }

  let stressHtml = "";
  if (prefs.showStress) {
    const score = snap?.analysis?.stress?.score ?? null;
    const word = severityWord(snap?.analysis?.stress?.severity ?? null);
    const tone = stressTone(word);
    let inner: string;
    if (score == null && word == null) {
      inner = `<p class="empty-note">Sin lectura de estrés.</p>`;
    } else {
      const pill = word
        ? `<span class="pill ${toneClass(tone)}">${word}</span>`
        : "";
      const scoreEl =
        score != null
          ? `<span class="stress-score">${formatScore(score)}</span>`
          : "";
      const bar =
        score != null
          ? `<div class="stress-bar"><span style="width:${Math.min(Math.max(score, 0), 100)}%;background:${
              tone === "positive"
                ? "#1b7a4e"
                : tone === "negative"
                  ? "#c23b2e"
                  : tone === "warning"
                    ? "#c47a12"
                    : "#0082fe"
            }"></span></div>`
          : "";
      inner = `<div class="stress-row">${pill}${scoreEl}</div>${bar}`;
    }
    stressHtml = `<section class="section">
      <p class="kicker">Estrés</p>
      ${inner}
    </section>`;
  }

  let headlineHtml = "";
  if (prefs.showHeadline) {
    const headline = snap?.analysis?.narrative?.headline?.trim();
    headlineHtml = `<section class="section">
      <p class="kicker">Lectura</p>
      ${
        headline
          ? `<p class="headline">${escapeHtml(headline)}</p>`
          : `<p class="empty-note">Sin titular en esta lectura.</p>`
      }
    </section>`;
  }

  const banner =
    !ui.isLoading && ui.lastError
      ? `<p class="status-banner">${escapeHtml(ui.lastError)}</p>`
      : "";

  const clock =
    ui.lastSuccessAt != null && ui.snapshot != null
      ? `<section class="clock">
          <p class="kicker">Última lectura exitosa (reloj del dispositivo)</p>
          <p class="clock-value">${formatDeviceClock(ui.lastSuccessAt)}</p>
        </section>`
      : "";

  return `
    <main class="desk" data-screen="board">
      <header class="header">
        ${GAUCHO_MARK}
        <div class="brand-block">
          <p class="brand">DólarGaucho</p>
          <p class="live-label">${ui.isLoading ? "Leyendo" : "Lectura en vivo"}</p>
        </div>
        <button type="button" class="btn-ghost" data-action="open-settings">Ajustes</button>
      </header>
      ${banner}
      <section class="hero" aria-label="Ahora">
        <span class="hero-edge" style="background:${edgeColor}"></span>
        <div class="hero-top">
          <p class="kicker">${GLANCE_LABELS[prefs.glance]}</p>
          <span class="venta-label">Venta</span>
        </div>
        ${heroBody}
      </section>
      <section class="section">
        <div class="section-head">
          <p class="kicker">Gráfico</p>
          <span class="section-sub">${GLANCE_LABELS[prefs.chartQuote]}</span>
        </div>
        ${chartBody}
      </section>
      <section class="section">
        <div class="section-head">
          <p class="kicker">Cotizaciones</p>
          <p class="kicker">Venta</p>
        </div>
        ${tableBody}
      </section>
      ${stressHtml}
      ${headlineHtml}
      ${clock}
      <button type="button" class="pulso" data-action="pulso">Abrir Pulso</button>
    </main>
  `;
}

function chipRow(selection: GlanceQuote, action: string): string {
  const items = GLANCE_QUOTES.filter((q) => prefs.shown.includes(q));
  return `<div class="chip-row">${items
    .map(
      (q) =>
        `<button type="button" class="chip ${q === selection ? "on" : ""}" data-action="${action}" data-quote="${q}">${GLANCE_LABELS[q]}</button>`,
    )
    .join("")}</div>`;
}

function toggleRow(label: string, on: boolean, action: string): string {
  return `<button type="button" class="toggle-row" data-action="${action}">
    <span>${label}</span>
    <span class="toggle-state ${on ? "on" : ""}">${on ? "Visible" : "Oculto"}</span>
  </button>`;
}

function renderSettings(): string {
  const shownToggles = GLANCE_QUOTES.map((q) =>
    toggleRow(GLANCE_LABELS[q], prefs.shown.includes(q), `toggle-shown:${q}`),
  ).join("");

  return `
    <main class="desk" data-screen="settings">
      <div class="settings-head">
        <button type="button" class="btn-text" data-action="back-board">Volver</button>
        <p class="title">Ajustes</p>
      </div>
      <section class="settings-group">
        <p class="kicker">En la barra</p>
        ${chipRow(prefs.glance, "set-glance")}
      </section>
      <section class="settings-group">
        <p class="kicker">Gráfico</p>
        ${chipRow(prefs.chartQuote, "set-chart")}
        <p class="hint">La serie es la de esta lectura. No hay otra historia.</p>
      </section>
      <section class="settings-group">
        <p class="kicker">Qué se ve</p>
        ${shownToggles}
        <div class="hairline"></div>
        ${toggleRow("Variación", prefs.showVariations, "toggle-variations")}
        ${toggleRow("Titular", prefs.showHeadline, "toggle-headline")}
        ${toggleRow("Estrés", prefs.showStress, "toggle-stress")}
      </section>
      <p class="settings-note">Esta lectura trae venta. Compra no está en el print, así que no se inventa.</p>
    </main>
  `;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function render(): void {
  const root = document.querySelector<HTMLElement>("#app");
  if (!root) return;
  root.innerHTML = screen === "board" ? renderBoard() : renderSettings();
}

function onClick(ev: Event): void {
  const target = (ev.target as HTMLElement | null)?.closest<HTMLElement>(
    "[data-action]",
  );
  if (!target) return;
  const action = target.dataset.action;
  if (!action) return;

  if (action === "open-settings") {
    screen = "settings";
    render();
    return;
  }
  if (action === "back-board") {
    screen = "board";
    render();
    return;
  }
  if (action === "pulso") {
    void invoke("open_pulso").catch(() => {
      window.open("https://www.dolargaucho.com", "_blank");
    });
    return;
  }
  if (action === "set-glance") {
    const q = target.dataset.quote as GlanceQuote | undefined;
    if (q) persistPrefs({ ...prefs, glance: q });
    return;
  }
  if (action === "set-chart") {
    const q = target.dataset.quote as GlanceQuote | undefined;
    if (q) persistPrefs({ ...prefs, chartQuote: q });
    return;
  }
  if (action.startsWith("toggle-shown:")) {
    const q = action.slice("toggle-shown:".length) as GlanceQuote;
    persistPrefs(setShown(prefs, q, !prefs.shown.includes(q)));
    return;
  }
  if (action === "toggle-variations") {
    persistPrefs({ ...prefs, showVariations: !prefs.showVariations });
    return;
  }
  if (action === "toggle-headline") {
    persistPrefs({ ...prefs, showHeadline: !prefs.showHeadline });
    return;
  }
  if (action === "toggle-stress") {
    persistPrefs({ ...prefs, showStress: !prefs.showStress });
    return;
  }
}

async function bootstrap(): Promise<void> {
  document.addEventListener("click", onClick);
  render();

  try {
    const initial = await invoke<UiState>("get_ui_state");
    inTauri = true;
    ui = initial;
    await syncPrefsToRust();
    render();
  } catch {
    inTauri = false;
    render();
  }

  if (inTauri) {
    await listen<UiState>("snapshot-updated", (event) => {
      ui = event.payload;
      render();
    });
  }
}

window.addEventListener("DOMContentLoaded", () => {
  void bootstrap();
});
