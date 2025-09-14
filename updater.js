const fs = require("fs-extra");
const { spawn } = require("child_process");

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForProcessToExit(pid) {
    if (!pid) return;
    while (true) {
        try {
            process.kill(parseInt(pid, 10), 0);
            await sleep(500);
        } catch {
            break;
        }
    }
}

async function copyUpdate(sourceDir, targetDir) {
    console.log(`[Updater] Copying from ${sourceDir} to ${targetDir}`);
    await fs.copy(sourceDir, targetDir, { overwrite: true, errorOnExist: false });
}

function relaunchApp(exePath) {
    console.log(`[Updater] Launching: ${exePath}`);
    spawn(exePath, [], {
        detached: true,
        stdio: "ignore"
    }).unref();
}

async function main() {
    const [, , sourceDir, targetDir, exeToLaunch, oldPid] = process.argv;

    if (!sourceDir || !targetDir || !exeToLaunch) {
        console.error("Usage: updater.exe <sourceDir> <targetDir> <exeToLaunch> <oldPid>");
        process.exit(1);
    }

    console.log("[Updater] Waiting for old process to exit...");
    await waitForProcessToExit(oldPid);

    console.log("[Updater] Waiting a second for Windows to catch up...");
    await sleep(1000);

    console.log("[Updater] Starting copy...");
    await copyUpdate(sourceDir, targetDir);

    console.log("[Updater] Relaunching app...");
    relaunchApp(exeToLaunch);
    
    console.log("[Updater] Removing temporary files...");
    fs.rmSync(sourceDir, { recursive: true, force: true });

    console.log("[Updater] Done.");
    process.exit(0);
}

main().catch(err => {
    console.error("[Updater] Failed:", err);
    process.exit(1);
});
