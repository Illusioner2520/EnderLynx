use std::{env, thread, time::Duration, process::Command};

fn sleep(ms: u64) {
    thread::sleep(Duration::from_millis(ms));
}

fn wait_for_process_exit(pid: &str) {
    if pid.is_empty() { return; }
    let pid: u32 = match pid.parse() {
        Ok(n) => n,
        Err(_) => return,
    };

    loop {
        #[cfg(target_os = "windows")]
        {
            use windows_sys::Win32::System::Threading::{OpenProcess, PROCESS_QUERY_LIMITED_INFORMATION};
            use windows_sys::Win32::Foundation::{STILL_ACTIVE, CloseHandle};
            let handle = unsafe { OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, 0, pid) };
            if handle == 0 { break; }
            let active = STILL_ACTIVE as u32;
            let mut code = 0u32;
            let status = unsafe { windows_sys::Win32::System::Threading::GetExitCodeProcess(handle, &mut code) };
            unsafe { CloseHandle(handle) };
            if status == 0 || code != active { break; }
        }

        #[cfg(not(target_os = "windows"))]
        {
            if nix::sys::signal::kill(nix::unistd::Pid::from_raw(pid as i32), None).is_err() {
                break;
            }
        }

        sleep(500);
    }
}

fn copy_update(source: &str, target: &str) -> anyhow::Result<()> {
    println!("[Updater] Copying from {source} -> {target}");
    fs_extra::dir::copy(
        source,
        target,
        &fs_extra::dir::CopyOptions {
            overwrite: true,
            copy_inside: true,
            content_only: true,
            ..Default::default()
        }
    )?;
    Ok(())
}

fn relaunch_app(exe: &str) {
    println!("[Updater] Relaunching {exe}");
    Command::new(exe)
        .spawn()
        .ok();
}

fn remove_temp(source: &str) {
    println!("[Updater] Removing temp {source}");
    std::fs::remove_dir_all(source).ok();
}

fn main() -> anyhow::Result<()> {
    let args: Vec<String> = env::args().collect();
    if args.len() < 4 {
        println!("Usage: updater.exe <sourceDir> <targetDir> <exeToLaunch> <oldPid>");
        return Ok(());
    }

    let source = &args[1];
    let target = &args[2];
    let exe = &args[3];
    let pid = if args.len() >= 5 { &args[4] } else { "" };

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
