# DólarGaucho Desktop (Windows / Linux)

**ES** · Desk + bandeja del sistema para Windows y Linux con **Tauri 2**, alineado al desk Mac.  
**EN** · Windows/Linux system-tray desk built with **Tauri 2**, matching the Mac bar desk.

Mac vive en otro repo: [`tomymaritano/dolargaucho-bar`](https://github.com/tomymaritano/dolargaucho-bar) (Swift, PR #9 desk + icon work). **No hay Swift acá.**

> **Installers:** CI publica assets en [Releases](https://github.com/tomymaritano/dolargaucho-desktop/releases) (Windows NSIS/MSI + Linux AppImage/`.deb`). **Sin firma de código** — SmartScreen / avisos del SO son esperables. Ver notas del release.

---

## Parity with Mac desk / Paridad con el desk Mac

Misma UI y comportamiento que `DeskView` en `dolargaucho-bar` (board vs settings separados):

| Board | Settings |
| --- | --- |
| Header + Ajustes | En la barra (glance quote) |
| Ahora — Venta serif grande, Compra o “no viene” | Gráfico (chart quote) |
| Gráfico — spark fill desde el print | Qué se ve (quotes + variación/titular/estrés) |
| Cotizaciones — una columna venta, variaciones coloreadas | Nota: compra ausente, no se inventa |
| Estrés + Lectura (opcionales) | |
| Reloj del dispositivo + Abrir Pulso | |

Tokens desk (light forzados, hex web):

`bg #f3efe6` · `surface #faf7f0` · `raised #ebe6da` · `ink #1c1915` · `secondary #5b564c` · `muted #8a8478` · `border #d4cec2` · `accent #0082fe` · `positive #1b7a4e` · `negative #c23b2e` · `warning #c47a12`

Menú / tray title: **venta de la cotización elegida**, si falta otra visible, si no `DólarGaucho`. **Nunca** el score de estrés.

Preferencias: `localStorage` en el front + sync a Rust para el título del tray.

## Snapshot-only contract

Única ruta de red:

```
GET https://dolargauchoapi-production.up.railway.app/snapshot
```

Reglas (igual que Mac):

- Live GET; **si falla, se tira el payload anterior** (no last-good-as-live)
- Venta = `venta ?? amount`; **compra solo si viene** — no se inventa
- Spark / variaciones / estrés / titular **solo del snapshot**
- Sin history ni rutas API extra

Cliente live: `src-tauri/src/snapshot.rs` · tipos UI: `src/lib/snapshot.ts`

## How to run / Cómo correr

Requisitos: Node 20+, Rust stable, toolchain Tauri  
([prerequisites](https://v2.tauri.app/start/prerequisites/)).

```bash
npm install
npm run tauri dev
```

Build de release (host actual):

```bash
npm run tauri build
```

Targets de bundle: Windows (`msi` / `nsis`) y Linux (`deb` / `AppImage` / `rpm`).  
Los instaladores nativos se construyen en **GitHub Actions** (`.github/workflows/release.yml`) al pushear un tag `v*` o con `workflow_dispatch` — no desde esta Mac.

```bash
git tag v0.1.0 && git push origin v0.1.0
# o: Actions → Release → Run workflow
```

Assets quedan en el GitHub Release correspondiente. **Unsigned OK** (sin secretos de firma).

## What’s in / Qué ya está

- Desk board + settings (paridad visual/funcional con Mac PR #9)
- Cliente `/snapshot` completo (blue / oficial / MEP / CCL + analysis)
- Tray icon + menú (Mostrar / Actualizar / Salir)
- Título/tooltip del tray: glance venta → fallback → `DólarGaucho`
- Preferencias persistentes + sync al tray
- Poll cada 120s + refresh al abrir el popover
- Tokens light desk exactos

## Remaining gaps / Qué queda

- Posicionar el popover bajo el icono del tray (coords del click)
- Icono tray dedicado (template / mono) por plataforma
- Autostart opcional (Win/Linux)
- Banner sitio + `/descargas`: cablear solo con URLs reales del release (no inventar)
- Firmar instaladores (opcional; hoy unsigned a propósito)
- Ajuste fino Linux (AppIndicator / StatusNotifier según DE)
- En Windows el tray suele ser solo tooltip (sin title text como en macOS)
- Tests de integración del fetch + drop-on-failure

## Licencia / License

Privado al proyecto DólarGaucho salvo que el repo indique lo contrario.
