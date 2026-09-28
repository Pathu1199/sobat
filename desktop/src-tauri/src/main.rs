#![cfg_attr(all(not(debug_assertions), target_os = "windows"), windows_subsystem = "windows")]

use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Manager, WindowEvent,
};
use tauri_plugin_autostart::MacosLauncher;

/// Seconds since the last keyboard or mouse input anywhere on the machine.
///
/// The web app can only see activity inside its own window, so without this it
/// thinks you are away the moment you switch to another program, and never
/// interrupts. Reading real system idle time is what makes the break monitor
/// behave correctly on a PC.
#[tauri::command]
fn get_idle_seconds() -> u64 {
    #[cfg(windows)]
    {
        use windows_sys::Win32::System::SystemInformation::GetTickCount;
        use windows_sys::Win32::UI::Input::KeyboardAndMouse::{GetLastInputInfo, LASTINPUTINFO};

        unsafe {
            let mut info = LASTINPUTINFO {
                cbSize: std::mem::size_of::<LASTINPUTINFO>() as u32,
                dwTime: 0,
            };
            if GetLastInputInfo(&mut info) == 0 {
                return 0;
            }
            let now = GetTickCount();
            // GetTickCount wraps roughly every 49 days; saturating_sub keeps
            // that from turning into a nonsense idle time.
            now.saturating_sub(info.dwTime) as u64 / 1000
        }
    }

    #[cfg(not(windows))]
    {
        0
    }
}

/// What the window in front is doing, so the break monitor can stay quiet
/// through a film or a call. Every failure reads as "nothing special", which
/// means a break still happens — the safe direction to fail in.
#[derive(serde::Serialize, Default)]
struct ForegroundState {
    fullscreen: bool,
    exe: String,
    #[serde(rename = "onCall")]
    on_call: bool,
}

#[tauri::command]
fn foreground_state() -> ForegroundState {
    #[cfg(windows)]
    {
        use windows_sys::Win32::Foundation::{HWND, RECT};
        use windows_sys::Win32::Graphics::Gdi::{GetMonitorInfoW, MonitorFromWindow, MONITORINFO, MONITOR_DEFAULTTONEAREST};
        use windows_sys::Win32::System::ProcessStatus::GetModuleBaseNameW;
        use windows_sys::Win32::System::Threading::{OpenProcess, PROCESS_QUERY_INFORMATION, PROCESS_VM_READ};
        use windows_sys::Win32::UI::WindowsAndMessaging::{GetForegroundWindow, GetWindowRect, GetWindowThreadProcessId};

        unsafe {
            let hwnd: HWND = GetForegroundWindow();
            if hwnd.is_null() {
                return ForegroundState::default();
            }

            // Fullscreen: the window covers its whole monitor.
            let mut win: RECT = std::mem::zeroed();
            let mut fullscreen = false;
            if GetWindowRect(hwnd, &mut win) != 0 {
                let monitor = MonitorFromWindow(hwnd, MONITOR_DEFAULTTONEAREST);
                let mut mi: MONITORINFO = std::mem::zeroed();
                mi.cbSize = std::mem::size_of::<MONITORINFO>() as u32;
                if GetMonitorInfoW(monitor, &mut mi) != 0 {
                    let m = mi.rcMonitor;
                    fullscreen = win.left <= m.left && win.top <= m.top && win.right >= m.right && win.bottom >= m.bottom;
                }
            }

            // The process image name, e.g. "chrome.exe".
            let mut pid: u32 = 0;
            GetWindowThreadProcessId(hwnd, &mut pid);
            let mut exe = String::new();
            if pid != 0 {
                let handle = OpenProcess(PROCESS_QUERY_INFORMATION | PROCESS_VM_READ, 0, pid);
                if !handle.is_null() {
                    let mut buf = [0u16; 260];
                    let len = GetModuleBaseNameW(handle, std::ptr::null_mut(), buf.as_mut_ptr(), buf.len() as u32);
                    if len > 0 {
                        exe = String::from_utf16_lossy(&buf[..len as usize]);
                    }
                    windows_sys::Win32::Foundation::CloseHandle(handle);
                }
            }

            ForegroundState { fullscreen, exe, on_call: microphone_in_use() }
        }
    }

    #[cfg(not(windows))]
    {
        ForegroundState::default()
    }
}

/// Windows records a stop time for every app that has used the microphone.
/// A zero stop time means it is using it right now, which is as close to
/// "on a call" as we can get without asking for permissions of our own.
#[cfg(windows)]
fn microphone_in_use() -> bool {
    use windows_sys::Win32::System::Registry::{
        RegCloseKey, RegEnumKeyExW, RegOpenKeyExW, RegQueryValueExW, HKEY, HKEY_CURRENT_USER, KEY_READ, REG_QWORD,
    };

    const ROOT: &str = r"Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\microphone";

    unsafe fn wide(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(std::iter::once(0)).collect()
    }

    unsafe {
        let mut root: HKEY = std::ptr::null_mut();
        if RegOpenKeyExW(HKEY_CURRENT_USER, wide(ROOT).as_ptr(), 0, KEY_READ, &mut root) != 0 {
            return false;
        }
        let mut in_use = false;
        let mut index = 0u32;
        loop {
            let mut name = [0u16; 512];
            let mut len = name.len() as u32;
            if RegEnumKeyExW(root, index, name.as_mut_ptr(), &mut len, std::ptr::null_mut(), std::ptr::null_mut(), std::ptr::null_mut(), std::ptr::null_mut()) != 0 {
                break;
            }
            index += 1;

            let mut sub: HKEY = std::ptr::null_mut();
            if RegOpenKeyExW(root, name.as_ptr(), 0, KEY_READ, &mut sub) == 0 {
                let mut value: u64 = 0;
                let mut size = std::mem::size_of::<u64>() as u32;
                let mut kind: u32 = 0;
                let ok = RegQueryValueExW(
                    sub,
                    wide("LastUsedTimeStop").as_ptr(),
                    std::ptr::null_mut(),
                    &mut kind,
                    &mut value as *mut u64 as *mut u8,
                    &mut size,
                );
                RegCloseKey(sub);
                // Zero means "still running".
                if ok == 0 && kind == REG_QWORD && value == 0 {
                    in_use = true;
                    break;
                }
            }
        }
        RegCloseKey(root);
        in_use
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .invoke_handler(tauri::generate_handler![get_idle_seconds, foreground_state])
        .setup(|app| {
            let open = MenuItem::with_id(app, "open", "Open Sobat", true, None::<&str>)?;
            let take = MenuItem::with_id(app, "take", "Take a break now", true, None::<&str>)?;
            let pause = MenuItem::with_id(app, "pause", "Pause breaks for an hour", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &take, &pause, &quit])?;

            TrayIconBuilder::with_id("sobat-tray")
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .tooltip("Sobat")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => {
                        if let Some(w) = app.get_webview_window("main") {
                            let _ = w.show();
                            let _ = w.set_focus();
                        }
                    }
                    "take" => {
                        if let Some(w) = app.get_webview_window("main") {
                            // The web app owns break state; the tray only asks.
                            let _ = w.eval("window.dispatchEvent(new CustomEvent('sobat:take-break'))");
                        }
                    }
                    "pause" => {
                        if let Some(w) = app.get_webview_window("main") {
                            // The web app owns break state; the tray only asks.
                            let _ = w.eval("window.dispatchEvent(new CustomEvent('sobat:pause-breaks'))");
                        }
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;

            // Three keys that work anywhere, because the point of a break
            // reminder is that you are not looking at this window.
            {
                use tauri_plugin_global_shortcut::GlobalShortcutExt;
                let handle = app.handle().clone();
                let fire = move |event: &str| {
                    if let Some(w) = handle.get_webview_window("main") {
                        let _ = w.eval(&format!("window.dispatchEvent(new CustomEvent('{}'))", event));
                    }
                };
                let f1 = fire.clone();
                let _ = app.global_shortcut().on_shortcut("CmdOrCtrl+Alt+B", move |_, _, _| f1("sobat:take-break"));
                let f2 = fire.clone();
                let _ = app.global_shortcut().on_shortcut("CmdOrCtrl+Alt+P", move |_, _, _| f2("sobat:pause-breaks"));
                let f3 = fire.clone();
                let _ = app.global_shortcut().on_shortcut("CmdOrCtrl+Alt+W", move |_, _, _| f3("sobat:add-water"));
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            // Closing the window should leave the break monitor running, not
            // kill it. Quitting is done from the tray menu on purpose.
            if let WindowEvent::CloseRequested { api, .. } = event {
                api.prevent_close();
                let _ = window.hide();
            }
        })
        .run(tauri::generate_context!())
        .expect("failed to start Sobat");
}
