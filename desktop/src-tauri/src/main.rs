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

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(MacosLauncher::LaunchAgent, None))
        .invoke_handler(tauri::generate_handler![get_idle_seconds])
        .setup(|app| {
            let open = MenuItem::with_id(app, "open", "Open Sobat", true, None::<&str>)?;
            let pause = MenuItem::with_id(app, "pause", "Pause breaks for an hour", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &pause, &quit])?;

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
