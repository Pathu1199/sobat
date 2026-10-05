# Sobat — full setup, start to finish

One file, in order. Work top to bottom and everything will be in place: the
Windows app, the AI, and the phone.

Every command in this guide runs **on the Windows PC** in **PowerShell**,
unless a step says otherwise.

**Time:** about an hour the first time, most of it waiting on downloads and on
Rust compiling. Nothing after that takes more than a minute or two.

---

## The order

| Part | What happens | Roughly |
| --- | --- | --- |
| [1](#part-1--copy-the-project-to-the-pc) | Copy the project to the PC | 5 min |
| [2](#part-2--install-the-three-tools) | Install Node, Rust, C++ build tools | 20 min |
| [3](#part-3--install-and-open-up-ollama) | Install Ollama and open it to the network | 15 min |
| [4](#part-4--build-the-exe) | Build the `.exe` | 15–30 min |
| [5](#part-5--install-and-run-it) | Install and run it | 2 min |
| [6](#part-6--connect-the-app-to-ollama) | Point the app at Ollama | 2 min |
| [7](#part-7--the-phone) | Put it on the phone | 5 min |

Parts 1, 2, 4 and 5 are only for the Windows app. If you only want the phone
app, skip straight to [Part 3](#part-3--install-and-open-up-ollama) then
[Part 7](#part-7--the-phone).

---

## Part 1 — Copy the project to the PC

This repository has **no git remote**, so there is nothing to `git clone` yet.

Copy the `sobat` folder from the Mac to the PC — USB drive, network share,
OneDrive, whatever is easiest. Put it somewhere with a short path and no
spaces:

```
C:\dev\sobat
```

**Do not copy these folders.** They are built on one machine and will break the
build on another:

```
node_modules
android
ios
dist
.expo
desktop\src-tauri\target
```

If you would rather use git, on the **Mac** run:

```bash
gh repo create sobat --private --source=. --push
```

then on the **PC**:

```powershell
git clone https://github.com/<your-username>/sobat.git C:\dev\sobat
```

---

## Part 2 — Install the three tools

### 2.1 Node

Download the **LTS** installer from <https://nodejs.org> and run it. Node 22 or
newer.

### 2.2 Rust

Download and run `rustup-init.exe` from <https://rustup.rs>. Accept the default
installation when it asks.

### 2.3 Visual Studio C++ build tools

**Do not skip this one.** Rust needs Microsoft's linker. Without it the build
runs for ten minutes and then dies on a missing `link.exe`. This is the single
most common way this setup fails.

Download **Build Tools for Visual Studio** from
<https://visualstudio.microsoft.com/visual-cpp-build-tools/> and run it. In the
installer, tick:

> **Desktop development with C++**

Leave the default components selected on the right, and install. Around 3 GB,
and the slowest download here. Reboot if it asks you to.

### 2.4 Check

Close **every** PowerShell window and open a fresh one — PATH does not update
in windows that were already open. Then:

```powershell
node --version
```

```powershell
cargo --version
```

Both must print a version. If `cargo` says "not recognized", you are still in
an old window, or Rust did not install.

---

## Part 3 — Install and open up Ollama

Sobat works fine without this. Logging, calorie targets, budgets, decisions,
reminders, the food database and the fitness plan are all plain code on the
device. Ollama only adds chat, the daily tip, the day review, the weekly
report, and reading food photos.

### 3.1 Install it

Download and run the installer from <https://ollama.com/download>.

### 3.2 Let it listen to the network

Out of the box Ollama only answers the PC itself, so the phone cannot reach it.
Open **PowerShell as Administrator** — right-click the Start button →
**Terminal (Admin)** — and run:

```powershell
setx OLLAMA_HOST 0.0.0.0
```

### 3.3 Open the port on the firewall

Still in the **Administrator** window:

```powershell
netsh advfirewall firewall add rule name="Ollama LAN" dir=in action=allow protocol=TCP localport=11434 profile=private
```

`profile=private` means this applies only on networks you have marked private,
i.e. your home Wi-Fi. It does not open the port on public networks.

### 3.4 Restart Ollama

Right-click the Ollama icon in the system tray → **Quit**, then start Ollama
again from the Start menu.

**This step is not optional.** `setx` only affects programs started *after* it
runs, so without the restart 3.2 has no effect and the phone will never
connect.

### 3.5 Pull the two models

Back in a normal (non-Administrator) PowerShell:

```powershell
ollama pull qwen3:8b
```

```powershell
ollama pull qwen2.5vl:7b
```

`qwen3:8b` is the text model — chat, tips, reviews. `qwen2.5vl:7b` is the
vision model — reading food photos. About 10 GB together.

### 3.6 Check it works

```powershell
ollama list
```

Both models should be listed. Then:

```powershell
curl http://localhost:11434/api/tags
```

A blob of JSON means it is answering properly.

### 3.7 Note the PC's address

```powershell
ipconfig
```

Find **IPv4 Address** under your active adapter (Wi-Fi or Ethernet). It looks
like `192.168.1.23`. Write it down — the phone needs it in Part 7.

---

## Part 4 — Build the `.exe`

```powershell
cd C:\dev\sobat
```

```powershell
npm install
```

```powershell
.\desktop\build-windows.ps1
```

That last command does everything: checks your tools, builds the app, compiles
the Rust shell and packages the installer.

**If PowerShell refuses to run the script** ("running scripts is disabled on
this system"), allow it for this window only, then run it again:

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
```

The first build compiles the whole Rust dependency tree — 15 to 30 minutes and
a great many `Compiling ...` lines. That is normal. Later builds reuse the
compiled crates and take about a minute.

### One architecture

The build is pinned to a single target, **x86_64-pc-windows-msvc**. Windows has
no fat or universal binary the way Android does — one `.exe`, one architecture.

It is pinned on purpose rather than left to the host machine. On a normal Intel
or AMD PC the result is the same either way, but on an ARM64 Windows laptop an
unpinned build quietly produces an ARM-only installer that runs nowhere else.
x64 runs on both, because ARM64 Windows emulates it.

---

## Part 5 — Install and run it

The script prints the path when it finishes. It is:

```
C:\dev\sobat\desktop\src-tauri\target\x86_64-pc-windows-msvc\release\bundle\nsis\Sobat_0.1.0_x64-setup.exe
```

To open that folder:

```powershell
explorer .\desktop\src-tauri\target\x86_64-pc-windows-msvc\release\bundle\nsis
```

Double-click the installer. It installs **for your user only**, so Windows will
not ask for an administrator password.

Windows SmartScreen will say the publisher is unknown — the app is not
code-signed, which costs money and is pointless for a personal build. Click
**More info** → **Run anyway**.

What you get is a normal Windows program, not a browser tab:

- it starts with Windows and sits in the system tray
- the break monitor runs whether or not the window is open
- it reads real system-wide idle time, so breaks skip themselves when you have
  already stepped away from the desk

---

## Part 6 — Connect the app to Ollama

Open Sobat → **Settings** → the **Ollama** section.

| Field | What to put |
| --- | --- |
| **Ollama address** | already `http://localhost:11434` — leave it |
| **Fallback (Tailscale)** | leave empty |
| **Text model** | `qwen3:8b` |
| **Vision model** | `qwen2.5vl:7b` |

Keep `localhost` here, **not** the LAN address from 3.7. The desktop app runs
on the same machine as Ollama, so it never needs to touch the network — and it
keeps working when your router hands the PC a different IP. The badge in the
sidebar reads **AI: PC** once it connects.

Press **Test connection**. You want:

```
Connected · 2 models · qwen3:8b, qwen2.5vl:7b
```

The badge at the top of the screen changes from **AI: offline** to **AI: PC**.

Done — the Windows side is complete.

---

## Part 7 — The phone

### 7.1 Install the APK

On the phone, open <https://sobat-a56c7.web.app> and tap **Download for
Android**. The file is `sobat.apk`, about 55 MB, built for any 64-bit phone
from roughly 2017 on. Android will ask you to allow installing from that
source — allow it, then install.

The same file is at `dist-apk/Sobat-0.2.0-arm64.apk` in the project if you
would rather copy it over USB.

It is signed with Sobat's own release key, so later versions install straight
over it and keep your data. The 0.1.0 builds were signed with the shared debug
key; if one of those is on the phone, **export your data first** (Settings →
Export), uninstall it, install this one, then import.

### 7.2 Connect the phone to Ollama

The phone and the PC must be on **the same Wi-Fi**.

Open Sobat → **Settings** → **Ollama**.

| Field | What to put |
| --- | --- |
| **Ollama address** | `http://192.168.1.23:11434` — the address from step 3.7 |
| **Fallback (Tailscale)** | leave empty, see 7.3 |
| **Text model** | `qwen3:8b` |
| **Vision model** | `qwen2.5vl:7b` |

Press **Test connection**. Same `Connected · 2 models` result, and the badge
becomes **AI: PC**.

> Your router may give the PC a different IP after a reboot. If Sobat suddenly
> says offline, run `ipconfig` again and update the address — or give the PC a
> DHCP reservation in your router settings so it never changes.

### 7.3 Using it away from home (optional)

Do **not** port-forward 11434 on your router. That puts an unauthenticated
model server on the open internet.

Use [Tailscale](https://tailscale.com). Install it on the PC and the phone and
sign in with the same account on both. On the PC:

```powershell
tailscale status
```

Put that machine name in the phone's **Fallback (Tailscale)** field:

```
http://varad-pc:11434
```

Sobat tries **Ollama address** first and falls back to this. At home it uses
the fast local network; away from home it goes over Tailscale automatically.
The badge reads **AI: PC remote** when the fallback is in use.

---

## When the PC is off

Nothing breaks. The badge says **AI: offline** and:

- logging, calorie targets, budgets and decisions — still work
- the food database, search and the fitness plan — still work
- reminders and breaks — still work
- chat is unavailable
- food photos are **queued**, and processed automatically next time the PC is
  reachable

---

## When something goes wrong

### Building the `.exe`

| What you see | What it means | Fix |
| --- | --- | --- |
| `cargo : The term 'cargo' is not recognized` | Rust is installed but PATH has not refreshed | Close every PowerShell window, open a new one |
| `error: linker 'link.exe' not found` | The C++ build tools are missing | Step 2.3 — tick **Desktop development with C++** |
| `running scripts is disabled on this system` | PowerShell's execution policy | `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` |
| `The web build did not produce dist/index.html` | `npm run export:web` failed | Scroll up for the first red error; usually `npm install` was skipped |
| Build finishes but no installer appears | Packaging failed after compiling | Scroll up to the **first** error, not the last |
| `EPERM` or locked files during `npm install` | Antivirus or OneDrive is holding files | Move the project out of OneDrive, to `C:\dev\sobat` |
| SmartScreen blocks the installer | The app is not code-signed | **More info** → **Run anyway** |
| The installer is named `..._arm64-setup.exe` | Built for ARM | See **One architecture** in Part 4 |

For a genuinely clean retry:

```powershell
Remove-Item -Recurse -Force .\desktop\src-tauri\target
```

That throws away the compiled Rust, so the next build is slow again.

### Connecting to Ollama

Work down this list in order.

| Symptom | Cause | Fix |
| --- | --- | --- |
| `Not connected` on the **PC** | Ollama is not running | Start it from the Start menu; check the tray icon |
| Works on the PC, not the phone | `OLLAMA_HOST` never took effect | You skipped step 3.4 — quit Ollama from the tray and start it again |
| Works on the PC, not the phone | Firewall | Re-run step 3.3 in an **Administrator** PowerShell |
| Works on the PC, not the phone | Wrong network | Phone on mobile data, or on a guest/5 GHz SSID isolated from the PC. Join the same Wi-Fi |
| Works on the PC, not the phone | Wrong IP | `ipconfig` again — the router probably reassigned it |
| Nothing connects anywhere | Address format | It needs the scheme and the port: `http://192.168.1.23:11434`, not `192.168.1.23` |
| `Connected · 0 models` | Ollama runs, nothing pulled | Step 3.5 |
| Chat works, photos fail | Vision model missing | `ollama pull qwen2.5vl:7b` |
| Connects, but replies take forever | An 8B model on CPU | Normal. Try `qwen3:4b` in **Text model** for faster, slightly worse replies |

**The quickest test:** open a browser **on the phone** and go to
`http://192.168.1.23:11434`. If it says `Ollama is running`, the network is
fine and the problem is in the app's settings. A timeout or a refusal means it
is the firewall, the Wi-Fi, or the missing restart in 3.4.

---

## Rebuilding after you change the code

The Tauri shell loads the exported web build, so that has to be rebuilt too.
The script does both:

```powershell
.\desktop\build-windows.ps1
```

To try a change without making an installer, run against the dev server
instead. Two PowerShell windows:

```powershell
npm run web
```

```powershell
npx --yes @tauri-apps/cli@^2 dev --config desktop/tauri.conf.json
```

### Doing the build by hand

The script is these three commands plus the tool checks:

```powershell
rustup target add x86_64-pc-windows-msvc
```

```powershell
npm run export:web
```

```powershell
npx --yes @tauri-apps/cli@^2 build --config desktop/tauri.conf.json --target x86_64-pc-windows-msvc
```

### Rebuilding the APK

You normally do not. Every push to `main` runs the **Deploy to Firebase**
workflow under the repo's Actions tab, which tests the code, builds the
signed APK, builds the website and deploys both — the APK is served at
`/downloads/sobat.apk` next to the site. The release key lives in the repo's
Actions secrets (`SOBAT_RELEASE_KEYSTORE_BASE64`, `SOBAT_RELEASE_KEY_ALIAS`,
`SOBAT_RELEASE_STORE_PASSWORD`, `SOBAT_RELEASE_KEY_PASSWORD`).

To build by hand you need the Android SDK and JDK 17:

```bash
npx expo prebuild -p android --clean
```

```bash
cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
```

Drop the `-PreactNativeArchitectures` flag for the universal build. The result
lands at `android/app/build/outputs/apk/release/app-release.apk`.

**Signing.** `plugins/withReleaseSigning.js` makes the release build use the
key named by four Gradle properties, `SOBAT_RELEASE_STORE_FILE`,
`SOBAT_RELEASE_KEY_ALIAS`, `SOBAT_RELEASE_STORE_PASSWORD` and
`SOBAT_RELEASE_KEY_PASSWORD`. On the Mac mini they are in
`~/.gradle/gradle.properties` and the key itself is
`~/.sobat/sobat-release.keystore`. **Back that file up.** Without it, no future
version can install over the current one. A machine without the properties
builds a debug-signed APK, which still runs but cannot update a release one.

---

## Paths worth remembering

| Thing | Where |
| --- | --- |
| Windows installer | `desktop\src-tauri\target\x86_64-pc-windows-msvc\release\bundle\nsis\Sobat_0.1.0_x64-setup.exe` |
| Phone APK | <https://sobat-a56c7.web.app/downloads/sobat.apk>, or `dist-apk\Sobat-0.2.0-arm64.apk` |
| Web build the shell loads | `dist\` |
| Ollama API | `http://127.0.0.1:11434` on the PC, `http://<pc-ip>:11434` from the phone |

---

## Using other models

Any model in the Ollama library works — type its exact tag into **Text model**
or **Vision model**. The vision one must be multimodal, or photos will fail.

```powershell
ollama pull qwen3:4b
```

Smaller is faster and worse. Sobat never lets the model do arithmetic, so a
weaker model costs you nicer wording, not wrong calories.

---

> Sobat is not a doctor or a counsellor. Get your blood pressure, sugar and
> thyroid checked before starting hard exercise, and talk to a real person when
> things feel heavy.
