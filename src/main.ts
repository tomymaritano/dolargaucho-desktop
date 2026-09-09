import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

/** Mirrors Rust `UiState` — snapshot-only blue quote for the tray spike. */
export interface UiState {
  trayTitle: string;
  venta: number | null;
  ventaLabel: string | null;
  compra: number | null;
  compraLabel: string | null;
  compraMissing: boolean;
  lastSuccessAt: number | null;
  lastError: string | null;
  isLoading: boolean;
  didSucceed: boolean;
}

const SNAPSHOT_ONLY_NOTE =
  "Esta lectura trae venta. Compra no está en el print, así que no se inventa.";

function formatDeviceClock(epochMs: number): string {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(epochMs));
}

function render(state: UiState): void {
  const status = document.querySelector<HTMLElement>("#status-line");
  const ventaEl = document.querySelector<HTMLElement>("#venta-value");
  const compraNote = document.querySelector<HTMLElement>("#compra-note");
  const clockBlock = document.querySelector<HTMLElement>("#clock-block");
  const clockValue = document.querySelector<HTMLElement>("#clock-value");

  if (!status || !ventaEl || !compraNote || !clockBlock || !clockValue) {
    return;
  }

  if (state.isLoading) {
    status.textContent = "Actualizando…";
    status.classList.remove("error");
  } else if (state.lastError) {
    status.textContent = state.lastError;
    status.classList.add("error");
  } else if (state.didSucceed) {
    status.textContent = "Blue · vivo";
    status.classList.remove("error");
  } else {
    status.textContent = "Sin lectura";
    status.classList.remove("error");
  }

  ventaEl.textContent = state.ventaLabel ?? "—";

  if (state.compraLabel) {
    compraNote.textContent = `Compra ${state.compraLabel}`;
    compraNote.classList.remove("muted");
  } else if (state.didSucceed) {
    compraNote.textContent = "Compra no viene en esta lectura";
    compraNote.title = SNAPSHOT_ONLY_NOTE;
    compraNote.classList.add("muted");
  } else {
    compraNote.textContent = "Esperando lectura…";
    compraNote.classList.add("muted");
  }

  if (state.lastSuccessAt != null && state.didSucceed) {
    clockBlock.classList.remove("hidden");
    clockValue.textContent = formatDeviceClock(state.lastSuccessAt);
  } else {
    clockBlock.classList.add("hidden");
    clockValue.textContent = "";
  }
}

async function bootstrap(): Promise<void> {
  const pulso = document.querySelector<HTMLButtonElement>("#pulso-btn");
  pulso?.addEventListener("click", async () => {
    await invoke("open_pulso");
  });

  try {
    const initial = await invoke<UiState>("get_ui_state");
    render(initial);
  } catch {
    // Running outside Tauri (vite-only) — show stub shell.
    render({
      trayTitle: "DólarGaucho",
      venta: null,
      ventaLabel: null,
      compra: null,
      compraLabel: null,
      compraMissing: true,
      lastSuccessAt: null,
      lastError: null,
      isLoading: false,
      didSucceed: false,
    });
  }

  await listen<UiState>("snapshot-updated", (event) => {
    render(event.payload);
  });
}

window.addEventListener("DOMContentLoaded", () => {
  void bootstrap();
});
