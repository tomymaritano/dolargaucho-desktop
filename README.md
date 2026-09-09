# DólarGaucho Desktop (Windows / Linux)

**ES** · Spike de bandeja del sistema (system tray) para Windows y Linux con **Tauri 2**.  
**EN** · Windows/Linux system-tray spike built with **Tauri 2**.

Mac vive en otro repo: [`tomymaritano/dolargaucho-bar`](https://github.com/tomymaritano/dolargaucho-bar) (Swift). **No hay Swift acá.**

---

## Purpose / Propósito

Mostrar la **venta blue** en vivo desde el print público, con un popover mínimo al estilo del desk Mac:

- Título / tooltip del tray: venta blue formateada (`es_AR`, p. ej. `$1.545`) o `DólarGaucho` si no hay lectura
- Popover: kicker **Venta**, nota si **compra** no viene, **Abrir Pulso** → https://www.dolargaucho.com
- Reloj del dispositivo: *Última lectura exitosa (reloj del dispositivo)*
- Tokens desk: paper `#f3efe6`, ink `#1c1915`, accent `#0082fe`, positive `#1b7a4e`, negative `#c23b2e`

## Snapshot-only contract

Única ruta de red:

```
GET https://dolargauchoapi-production.up.railway.app/snapshot
```

Reglas alineadas al Mac:

- Live: sin cache “como vivo”; **si falla, se tira el payload anterior** (no stale-as-live)
- Blue: `venta ?? amount` (el amount guardado es la punta venta)
- `compra` solo si viene en el JSON — **no se inventa**
- Sin history ni rutas API extra

Stub tipado: `src/lib/snapshot.ts` · cliente live en Rust: `src-tauri/src/snapshot.rs`

## How to run / Cómo correr

Requisitos: Node 20+, Rust stable, y el toolchain Tauri de tu SO  
([prerequisites](https://v2.tauri.app/start/prerequisites/)).

```bash
npm install
npm run tauri dev
```

Build de release (host actual):

```bash
npm run tauri build
```

Targets de bundle previstos: Windows (`msi` / `nsis`) y Linux (`deb` / `AppImage` / `rpm`).  
Compilar instaladores nativos de Windows/Linux desde Mac requiere CI o una máquina del SO destino.

## Qué ya está / What’s in

- Scaffold Tauri 2 + Vite + TypeScript
- Cliente `/snapshot` (Rust) + stub TS
- Tray icon + menú (Mostrar / Actualizar / Salir)
- Popover desk (venta, nota compra, Abrir Pulso, reloj)
- Poll cada 60s + refresh al abrir el popover
- Título/tooltip del tray con venta blue

## Qué queda para el spike de tray / Left for tray spike

- Posicionar el popover bajo el icono del tray (coords del click)
- Icono tray dedicado (template / mono) por plataforma
- Autostart opcional (Win/Linux)
- Empaquetado CI (GitHub Actions) para MSI/NSIS + deb/AppImage
- Ajuste fino Linux (AppIndicator / StatusNotifier según DE)
- Tooltips / título de tray más ricos donde el SO lo permita (Win suele ser solo tooltip)
- Tests de integración del fetch + drop-on-failure

## Licencia / License

Privado al proyecto DólarGaucho salvo que el repo indique lo contrario.
