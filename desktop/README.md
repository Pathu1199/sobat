# Sobat for Windows

The desktop app is a thin [Tauri 2](https://tauri.app) shell around the same
React Native Web build that runs in the browser. Tauri only adds what a browser
cannot do:

- start with Windows, so the break monitor is running the moment the PC boots
- live in the system tray instead of the taskbar
- show the break overlay as a real always-on-top window
- read how long the keyboard and mouse have been idle

**This has to be built on the Windows PC.** Tauri does not cross-compile from
macOS to Windows. Everything else in this repository builds anywhere.

> Step-by-step, with every command, Ollama, the phone, and the things that
> go wrong: [`../SETUP.md`](../SETUP.md).

## The short version

On the PC, from the repository root in PowerShell:

```powershell
.\desktop\build-windows.ps1
```

That checks your tools, builds the app, and produces an installer at
`desktop\src-tauri\target\release\bundle\nsis\Sobat_<version>_x64-setup.exe`.
Double-click it. It installs for your user only, so Windows will not ask for an
administrator password.

The result is a normal Windows program, not a browser tab and not an Expo app.
It starts with Windows, lives in the system tray, and keeps the break monitor
running whether or not its window is open.

**It has to be built on the PC.** Tauri cannot cross-compile a Windows binary
from a Mac, so no `.exe` can be produced anywhere else.

## One-time setup on the PC

1. Install [Rust](https://rustup.rs) and the Visual Studio C++ build tools.
2. Install Node 22 or newer.
3. From the repository root:

```powershell
npm install
npm install -D @tauri-apps/cli
```

## Build

```powershell
npm run export:web
npx tauri build --config desktop/tauri.conf.json
```

The installer lands in `desktop/src-tauri/target/release/bundle/`.

## Run it while developing

```powershell
npm run web
npx tauri dev --config desktop/tauri.conf.json
```

## What the shell does

| Behaviour | Where |
| --- | --- |
| Autostart at login | `tauri-plugin-autostart`, enabled on first run |
| Tray icon and menu | `main.rs`, with Open, Pause breaks, Quit |
| Close means minimise | window close is intercepted and hides instead |
| Idle seconds | `get_idle_seconds` command, via the Win32 `GetLastInputInfo` API |
| Break overlay | the web app draws it; the shell just makes the window fullscreen and on top |

The idle command matters. In a browser the app can only see activity inside its
own window, so it thinks you are away whenever you are working in another
program. On Windows the shell reports real system-wide idle time, which is what
makes "skip the break because they already stepped away" correct.

## Wiring the idle command into the web app

`src/services/useBreakMonitor.ts` reads idle time from `platform.idleSeconds()`.
Add a Tauri implementation in `src/services/platform.web.ts`:

```ts
export async function idleSeconds(): Promise<number> {
  if (!('__TAURI__' in globalThis)) return browserIdleSeconds();
  const { invoke } = await import('@tauri-apps/api/core');
  return invoke<number>('get_idle_seconds');
}
```

## What the shell adds to breaks

- **Real system idle time**, so switching to another program still counts as
  being at the desk.
- **Smart pause**: the app stays quiet during a fullscreen window and while the
  microphone is in use. Both are read best-effort; if either lookup fails the
  break happens anyway.
- **Global shortcuts**: Ctrl+Alt+B takes a break now, Ctrl+Alt+P pauses breaks
  for an hour, Ctrl+Alt+W is reserved for water.
- **Tray**: "Take a break now" and "Pause breaks for an hour".

None of this compiles on macOS. Build on the PC as described above.
