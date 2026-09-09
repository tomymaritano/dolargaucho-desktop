mod snapshot;

use std::sync::Mutex;
use std::time::Duration;

use snapshot::{fetch_snapshot, menu_title, SnapshotPayload, TrayPrefs};
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager, State, WindowEvent};
use tauri_plugin_opener::OpenerExt;

const SNAPSHOT_URL: &str = "https://dolargauchoapi-production.up.railway.app/snapshot";
const PULSO_URL: &str = "https://www.dolargaucho.com";
const FALLBACK_TITLE: &str = "DólarGaucho";
/// Background poll; Mac refreshes every 2 min while the extra is open.
const POLL_SECS: u64 = 120;
const TRAY_ID: &str = "main-tray";

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UiState {
    pub tray_title: String,
    /// Full live payload, or null after drop-on-failure / before first success.
    pub snapshot: Option<SnapshotPayload>,
    /// Device-clock epoch ms of last successful live GET (None after drop-on-failure).
    pub last_success_at: Option<i64>,
    pub last_error: Option<String>,
    pub is_loading: bool,
    pub did_succeed: bool,
}

impl Default for UiState {
    fn default() -> Self {
        Self {
            tray_title: FALLBACK_TITLE.to_string(),
            snapshot: None,
            last_success_at: None,
            last_error: None,
            is_loading: false,
            did_succeed: false,
        }
    }
}

struct AppState {
    ui: Mutex<UiState>,
    prefs: Mutex<TrayPrefs>,
    /// Generation counter so overlapping refreshes don't resurrect a stale success.
    generation: Mutex<u64>,
}

fn chrono_like_now() -> i64 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as i64)
        .unwrap_or(0)
}

fn set_tray_title(app: &AppHandle, title: &str) {
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let _ = tray.set_title(Some(title));
        let _ = tray.set_tooltip(Some(title));
    }
}

fn emit_ui(app: &AppHandle, ui: &UiState) {
    let _ = app.emit("snapshot-updated", ui);
}

fn recompute_tray(app: &AppHandle, state: &AppState) {
    let prefs = state.prefs.lock().expect("prefs").clone();
    let mut ui = state.ui.lock().expect("ui");
    ui.tray_title = menu_title(ui.did_succeed, ui.snapshot.as_ref(), &prefs);
    set_tray_title(app, &ui.tray_title);
    emit_ui(app, &ui);
}

fn apply_success(ui: &mut UiState, payload: SnapshotPayload, stamp: i64, prefs: &TrayPrefs) {
    ui.is_loading = false;
    ui.last_error = None;
    ui.did_succeed = true;
    ui.snapshot = Some(payload);
    ui.last_success_at = Some(stamp);
    ui.tray_title = menu_title(true, ui.snapshot.as_ref(), prefs);
}

fn apply_failure(ui: &mut UiState, message: &str) {
    ui.is_loading = false;
    ui.did_succeed = false;
    ui.snapshot = None;
    ui.last_success_at = None;
    ui.last_error = if message.is_empty() {
        None
    } else {
        Some(message.to_string())
    };
    ui.tray_title = FALLBACK_TITLE.to_string();
}

async fn refresh_live(app: &AppHandle) {
    let state = app.state::<AppState>();
    let generation = {
        let mut g = state.generation.lock().expect("generation");
        *g += 1;
        *g
    };

    {
        let mut ui = state.ui.lock().expect("ui");
        // Drop previous as live — miss must not look like a live quote.
        apply_failure(&mut ui, "");
        ui.is_loading = true;
        ui.last_error = None;
        set_tray_title(app, &ui.tray_title);
        emit_ui(app, &ui);
    }

    let result = fetch_snapshot(SNAPSHOT_URL).await;

    {
        let current = *state.generation.lock().expect("generation");
        if current != generation {
            return;
        }
        let prefs = state.prefs.lock().expect("prefs").clone();
        let mut ui = state.ui.lock().expect("ui");
        match result {
            Ok(payload) => {
                apply_success(&mut ui, payload, chrono_like_now(), &prefs);
            }
            Err(_) => {
                apply_failure(&mut ui, "No se pudo actualizar");
            }
        }
        set_tray_title(app, &ui.tray_title);
        emit_ui(app, &ui);
    }
}

fn toggle_main_window(app: &AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            let _ = window.show();
            let _ = window.set_focus();
            let handle = app.clone();
            tauri::async_runtime::spawn(async move {
                refresh_live(&handle).await;
            });
        }
    }
}

#[tauri::command]
fn get_ui_state(state: State<'_, AppState>) -> UiState {
    state.ui.lock().expect("ui").clone()
}

#[tauri::command]
fn get_tray_prefs(state: State<'_, AppState>) -> TrayPrefs {
    state.prefs.lock().expect("prefs").clone()
}

#[tauri::command]
fn set_tray_prefs(app: AppHandle, state: State<'_, AppState>, prefs: TrayPrefs) -> UiState {
    {
        let mut locked = state.prefs.lock().expect("prefs");
        *locked = prefs;
    }
    recompute_tray(&app, &state);
    state.ui.lock().expect("ui").clone()
}

#[tauri::command]
async fn refresh_snapshot(app: AppHandle) -> Result<UiState, String> {
    refresh_live(&app).await;
    Ok(app.state::<AppState>().ui.lock().expect("ui").clone())
}

#[tauri::command]
fn open_pulso(app: AppHandle) -> Result<(), String> {
    app.opener()
        .open_url(PULSO_URL, None::<&str>)
        .map_err(|e| e.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(AppState {
            ui: Mutex::new(UiState::default()),
            prefs: Mutex::new(TrayPrefs::default()),
            generation: Mutex::new(0),
        })
        .invoke_handler(tauri::generate_handler![
            get_ui_state,
            get_tray_prefs,
            set_tray_prefs,
            refresh_snapshot,
            open_pulso
        ])
        .setup(|app| {
            let quit = MenuItem::with_id(app, "quit", "Salir", true, None::<&str>)?;
            let show = MenuItem::with_id(app, "show", "Mostrar", true, None::<&str>)?;
            let refresh = MenuItem::with_id(app, "refresh", "Actualizar", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &refresh, &quit])?;

            let icon = app
                .default_window_icon()
                .cloned()
                .expect("default window icon");

            let _tray = TrayIconBuilder::with_id(TRAY_ID)
                .icon(icon)
                .menu(&menu)
                .show_menu_on_left_click(false)
                .tooltip(FALLBACK_TITLE)
                .title(FALLBACK_TITLE)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "quit" => app.exit(0),
                    "show" => toggle_main_window(app),
                    "refresh" => {
                        let handle = app.clone();
                        tauri::async_runtime::spawn(async move {
                            refresh_live(&handle).await;
                        });
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        toggle_main_window(tray.app_handle());
                    }
                })
                .build(app)?;

            let handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                refresh_live(&handle).await;
                loop {
                    tokio::time::sleep(Duration::from_secs(POLL_SECS)).await;
                    refresh_live(&handle).await;
                }
            });

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running DólarGaucho desktop");
}
