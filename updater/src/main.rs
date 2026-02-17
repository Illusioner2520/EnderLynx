use fs_extra::dir::{CopyOptions, TransitProcess, copy_with_progress};
use std::{env, process::Command, thread, time::Duration};

fn sleep(ms: u64) {
    thread::sleep(Duration::from_millis(ms));
}

fn wait_for_process_exit(pid: &str) {
    if pid.is_empty() {
        return;
    }
    let pid: u32 = match pid.parse() {
        Ok(n) => n,
        Err(_) => return,
    };

    loop {
        #[cfg(target_os = "windows")]
        {
            use windows_sys::Win32::Foundation::{CloseHandle, STILL_ACTIVE};
            use windows_sys::Win32::System::Threading::{
                OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION,
            };
            let handle = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid) };
            if handle == 0 {
                break;
            }
            let active = STILL_ACTIVE as u32;
            let mut code = 0u32;
            let status = unsafe {
                windows_sys::Win32::System::Threading::GetExitCodeProcess(handle, &mut code)
            };
            unsafe { CloseHandle(handle) };
            if status == 0 || code != active {
                break;
            }
        }

        sleep(100);
    }
}

fn copy_update(source: &str, target: &str) -> anyhow::Result<()> {
    println!("[Updater] Copying from {source} -> {target}");
    let (tx, rx) = std::sync::mpsc::channel();

    #[cfg(target_os = "windows")]
    std::thread::spawn(move || {
        progress_window::run(rx);
    });

    let options = CopyOptions {
        overwrite: true,
        copy_inside: true,
        content_only: true,
        ..Default::default()
    };

    copy_with_progress(source, target, &options, |p: TransitProcess| {
        let percent = ((p.copied_bytes as f64 / p.total_bytes as f64) * 1000.0) as usize;
        let _ = tx.send(percent as u64);
        fs_extra::dir::TransitProcessResult::ContinueOrAbort
    })?;

    Ok(())
}

fn relaunch_app(exe: &str) {
    println!("[Updater] Relaunching {exe}");
    Command::new(exe).spawn().ok();
}

fn remove_temp(source: &str) {
    println!("[Updater] Removing temp {source}");
    std::fs::remove_dir_all(source).ok();
}

fn main() -> anyhow::Result<()> {
    let args: Vec<String> = env::args().collect();
    if args.len() < 5 {
        println!("Usage: updater.exe <sourceDir> <targetDir> <exeToLaunch> <oldPid>");
        return Ok(());
    }

    let source = &args[1];
    let target = &args[2];
    let exe = &args[3];
    let pid = &args[4];

    println!("[Updater] Waiting for old process...");
    wait_for_process_exit(pid);
    println!("[Updater] Windows catch-up sleep...");
    sleep(1000);

    copy_update(source, target)?;
    relaunch_app(exe);
    remove_temp(source);

    println!("[Updater] Done.");
    Ok(())
}

#[cfg(target_os = "windows")]
mod progress_window {
    use std::{ptr, sync::mpsc::Receiver};
    use windows_sys::Win32::{
        Foundation::*,
        Graphics::Dwm::{DWMWA_USE_IMMERSIVE_DARK_MODE, DwmSetWindowAttribute},
        Graphics::Gdi::*,
        System::LibraryLoader::GetModuleHandleW,
        UI::Controls::*,
        UI::WindowsAndMessaging::*,
    };

    fn center_child(parent: isize, child: isize, width: i32, height: i32) {
        unsafe {
            let mut rc: RECT = std::mem::zeroed();
            GetClientRect(parent, &mut rc);

            let x = (rc.right - width) / 2;
            let y = (rc.bottom - height) / 2;

            SetWindowPos(child, 0, x, y, width, height, 0);
        }
    }

    pub fn run(rx: Receiver<u64>) {
        unsafe {
            let hinstance = GetModuleHandleW(ptr::null());

            let class_name = widestr("UpdaterProgress");

            let wc = WNDCLASSW {
                style: CS_HREDRAW | CS_VREDRAW,
                lpfnWndProc: Some(wndproc),
                hInstance: hinstance,
                lpszClassName: class_name.as_ptr(),
                hCursor: LoadCursorW(0, IDC_ARROW),
                hbrBackground: CreateSolidBrush(0x0A0A0A),
                ..std::mem::zeroed()
            };

            let class_name_2 = widestr("FlatProgressBar");

            let wc2 = WNDCLASSW {
                lpfnWndProc: Some(progproc),
                hInstance: hinstance,
                lpszClassName: class_name_2.as_ptr(),
                hCursor: LoadCursorW(0, IDC_ARROW),
                ..std::mem::zeroed()
            };

            RegisterClassW(&wc);
            RegisterClassW(&wc2);

            let hwnd = CreateWindowExW(
                0,
                class_name.as_ptr(),
                widestr("Updating...").as_ptr(),
                WS_OVERLAPPED | WS_CAPTION | WS_SYSMENU,
                CW_USEDEFAULT,
                CW_USEDEFAULT,
                400,
                120,
                0,
                0,
                hinstance,
                ptr::null_mut(),
            );

            let dark_mode = 1i32;
            DwmSetWindowAttribute(
                hwnd,
                DWMWA_USE_IMMERSIVE_DARK_MODE as u32,
                &dark_mode as *const _ as *const _,
                std::mem::size_of::<i32>() as u32,
            );

            fn make_int_resource(id: u16) -> *const u16 {
                id as usize as *const u16
            }

            let hicon_small = LoadImageW(
                hinstance,
                make_int_resource(1),
                IMAGE_ICON,
                16,
                16,
                LR_DEFAULTSIZE,
            );
            let hicon_big = LoadImageW(
                hinstance,
                make_int_resource(1),
                IMAGE_ICON,
                32,
                32,
                LR_DEFAULTSIZE,
            );

            SendMessageW(hwnd, WM_SETICON, ICON_SMALL as usize, hicon_small);
            SendMessageW(hwnd, WM_SETICON, ICON_BIG as usize, hicon_big);

            let menu = GetSystemMenu(hwnd, 0);
            EnableMenuItem(menu, SC_CLOSE, MF_BYCOMMAND | MF_GRAYED);

            let width = 400;
            let height = 120;

            let screen_w = GetSystemMetrics(SM_CXSCREEN);
            let screen_h = GetSystemMetrics(SM_CYSCREEN);

            let x = (screen_w - width) / 2;
            let y = (screen_h - height) / 2;

            SetWindowPos(hwnd, 0, x, y, 0, 0, SWP_NOSIZE | SWP_NOZORDER);

            BringWindowToTop(hwnd);
            SetForegroundWindow(hwnd);

            let progress = CreateWindowExW(
                0,
                class_name_2.as_ptr(),
                ptr::null(),
                WS_CHILD | WS_VISIBLE,
                0,
                0,
                350,
                25,
                hwnd,
                0,
                hinstance,
                ptr::null_mut(),
            );
            center_child(hwnd, progress, 350, 25);
            SetWindowTheme(progress, std::ptr::null(), std::ptr::null());

            let progress_bar_color = 0xD47800;
            let progress_bar_background = 0x1D1D1D;

            SendMessageW(progress, PBM_SETBARCOLOR, 0, progress_bar_color as isize);
            SendMessageW(
                progress,
                PBM_SETBKCOLOR,
                0,
                progress_bar_background as isize,
            );

            SendMessageW(progress, PBM_SETRANGE32, 0, 1000);

            ShowWindow(hwnd, SW_SHOW);

            loop {
                let mut msg = std::mem::zeroed();
                while PeekMessageW(&mut msg, 0, 0, 0, PM_REMOVE) != 0 {
                    if msg.message == WM_QUIT {
                        return;
                    }
                    TranslateMessage(&msg);
                    DispatchMessageW(&msg);
                }

                if let Ok(value) = rx.try_recv() {
                    SendMessageW(progress, WM_USER, value as usize, 0);
                }
            }
        }
    }

    unsafe extern "system" fn wndproc(
        hwnd: HWND,
        msg: u32,
        wparam: WPARAM,
        lparam: LPARAM,
    ) -> LRESULT {
        match msg {
            WM_DESTROY => {
                unsafe { PostQuitMessage(0) };
                0
            }
            _ => unsafe { DefWindowProcW(hwnd, msg, wparam, lparam) },
        }
    }

    unsafe extern "system" fn progproc(
        hwnd: HWND,
        msg: u32,
        wparam: WPARAM,
        lparam: LPARAM,
    ) -> LRESULT {
        static mut PROGRESS_POS: f32 = 0.5;

        match msg {
            WM_PAINT => unsafe {
                let mut ps = std::mem::zeroed();
                let hdc = BeginPaint(hwnd, &mut ps);
                let mut rect = std::mem::zeroed();
                GetClientRect(hwnd, &mut rect);

                let bg_brush = CreateSolidBrush(0x1D1D1D);
                FillRect(hdc, &rect, bg_brush);
                DeleteObject(bg_brush);

                let total_width = rect.right - rect.left;
                let progress_width = (total_width as f32 * PROGRESS_POS) as i32;

                let mut progress_rect = rect;
                progress_rect.right = rect.left + progress_width;

                let bar_brush = CreateSolidBrush(0xD47800);
                FillRect(hdc, &progress_rect, bar_brush);
                DeleteObject(bar_brush);

                EndPaint(hwnd, &ps);
                0
            },

            WM_USER => unsafe {
                PROGRESS_POS = (wparam as f32) / 1000.0;
                InvalidateRect(hwnd, std::ptr::null(), 0);
                0
            },
            _ => unsafe { DefWindowProcW(hwnd, msg, wparam, lparam) },
        }
    }

    fn widestr(s: &str) -> Vec<u16> {
        s.encode_utf16().chain(Some(0)).collect()
    }
}
