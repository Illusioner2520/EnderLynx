const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const RPC = require('discord-rpc');
const windowStateKeeper = require('electron-window-state');
const fs = require('fs');
const AdmZip = require('adm-zip');

let userDataPath = path.resolve(app.getPath('userData'), "EnderLynx");

let pathPath = path.resolve(app.getPath('userData'), "path.json");
let user_path;

if (!fs.existsSync(pathPath)) {
    user_path = userDataPath;
    fs.writeFileSync(pathPath, JSON.stringify({ user_path }), 'utf8');
} else {
    try {
        const data = fs.readFileSync(pathPath, 'utf8');
        const json = JSON.parse(data);
        user_path = json.user_path;
        if (json.old_path) {
            if (fs.existsSync(json.old_path)) {
                fs.rmSync(json.old_path, { recursive: true, force: true });
            }
            delete json.old_path;
            fs.writeFileSync(pathPath, JSON.stringify(json), 'utf8');
        }
    } catch (err) {
        user_path = userDataPath;
        fs.writeFileSync(pathPath, JSON.stringify({ user_path }), 'utf8');
    }
}

if (!fs.existsSync(user_path)) user_path = userDataPath;

let win;

const isDev = !app.isPackaged;

let args = process.argv.slice(1);
let enableDev = args.includes("--debug") || isDev;

let additionalArguments = [`--userDataPath=${user_path}`].concat(args);
if (isDev) additionalArguments.push('--dev');

let argsFromUrl = args.find(arg => arg.startsWith('enderlynx://'));
if (argsFromUrl) argsFromUrl = argsFromUrl.split("/").slice(2);
else argsFromUrl = [];
if (argsFromUrl.includes("debug")) {
    enableDev = true;
}

const createWindow = () => {
    let state = windowStateKeeper({
        defaultWidth: 1000,
        defaultHeight: 600,
    });
    win = new BrowserWindow({
        x: state.x,
        y: state.y,
        width: state.width,
        height: state.height,
        minWidth: 1000,
        minHeight: 600,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            sandbox: false,
            devTools: enableDev,
            additionalArguments: additionalArguments
        },
        backgroundColor: "#0a0a0a",
        icon: path.join(__dirname, 'icon.ico')
    });
    win.loadFile('index.html');

    win.webContents.on('did-finish-load', () => {
        if (openedFile) {
            win.webContents.send('open-file', openedFile);
        }
    });

    state.manage(win);
    if (!enableDev) {
        Menu.setApplicationMenu(null);
    }
}

let openedFile = null;

const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', (event, commandLine, workingDirectory) => {
        if (win) {
            if (win.isMinimized()) win.restore();
            win.focus();
        }

        const fileArg = commandLine.find(arg => arg.endsWith('.elpack'));
        if (fileArg) {
            openedFile = fileArg;
            if (win) {
                win.webContents.send('open-file', openedFile);
            }
        }
        win.webContents.send('new-args', commandLine);
    });

    app.whenReady().then(() => {
        app.setAppUserModelId('me.illusioner.enderlynx');
        createWindow();
        rpc.login({ clientId }).catch(console.error);
        if (!app.isDefaultProtocolClient('enderlynx') && !isDev) {
            app.setAsDefaultProtocolClient('enderlynx', process.execPath, []);
        }
        const fileArg = process.argv.find(arg => arg.endsWith('.elpack'));
        if (fileArg) {
            openedFile = fileArg;
        }
    });
}

app.on('open-file', (event, path) => {
    event.preventDefault();
    openedFile = path;
    if (win) {
        win.webContents.send('open-file', openedFile);
    }
});

ipcMain.handle('set-user-path', (event, new_path, old_path) => {
    user_path = new_path;
    fs.writeFileSync(pathPath, JSON.stringify({ user_path, old_path }), 'utf8');
    return true;
});

ipcMain.on('progress-update', (event, title, progress, desc) => {
    win.webContents.send('progress-update', title, progress, desc);
});

ipcMain.on('display-error', (event, message) => {
    win.webContents.send('display-error', message);
});

ipcMain.handle('show-open-dialog', async (event, options) => {
    const result = await dialog.showOpenDialog(win, options);
    return result;
});

ipcMain.handle('show-save-dialog', async (event, options) => {
    const result = await dialog.showSaveDialog(win, options);
    return result;
});

ipcMain.handle('get-app-metrics', (event) => {
    return app.getAppMetrics();
});

ipcMain.handle('get-desktop', (_) => {
    return app.getPath("desktop");
});

ipcMain.handle('quit', (_) => {
    return app.quit();
});

const clientId = '1392227892594999368';

RPC.register(clientId);
const rpc = new RPC.Client({ transport: 'ipc' });

rpc.on('ready', () => {
    ipcMain.on('set-discord-activity', (_, activity) => {
        rpc.setActivity(activity);
    });

    ipcMain.on('remove-discord-activity', (_) => {
        rpc.clearActivity().catch(console.error);
    })
});

ipcMain.handle('create-elpack', async (event, instance_id, name, manifest, overrides) => {
    win.webContents.send('progress-update', `Creating .elpack`, 0, `Creating manifest...`);
    const tempDir = path.resolve(user_path, "temp");
    fs.mkdirSync(tempDir, { recursive: true });
    const zipPath = path.join(tempDir, `${name.replace(/[<>:"/\\|?*]/g, '_')}_${Date.now()}.elpack`);

    const zip = new AdmZip();

    zip.addFile("manifest.json", Buffer.from(JSON.stringify(manifest, null, 2), "utf-8"));

    for (let i = 0; i < overrides.length; i++) {
        win.webContents.send('progress-update', `Creating .elpack`, (i + 1) / overrides.length * 95, `Moving Override ${i + 1} of ${overrides.length}`);
        let override = overrides[i];
        const srcPath = path.resolve(user_path, "minecraft", "instances", instance_id, override);
        const destPath = "overrides/" + override;
        if (fs.existsSync(srcPath)) {
            const stat = fs.statSync(srcPath);
            if (stat.isDirectory()) {
                function addDirToZip(dir, zipPath) {
                    const entries = fs.readdirSync(dir, { withFileTypes: true });
                    for (const entry of entries) {
                        const entrySrc = path.join(dir, entry.name);
                        const entryDest = path.join(zipPath, entry.name);
                        if (entry.isDirectory()) {
                            addDirToZip(entrySrc, entryDest);
                        } else {
                            zip.addFile(entryDest.replace(/\\/g, "/"), fs.readFileSync(entrySrc));
                        }
                    }
                }
                addDirToZip(srcPath, destPath);
            } else {
                zip.addFile(destPath.replace(/\\/g, "/"), fs.readFileSync(srcPath));
            }
        }
    }

    zip.writeZip(zipPath);

    win.webContents.send('progress-update', `Creating .elpack`, 100, `Done`);
    win.webContents.send('open-file-share', zipPath);
});
ipcMain.handle('create-mrpack', async (event, instance_id, name, manifest, overrides) => {
    win.webContents.send('progress-update', `Creating .mrpack`, 0, `Creating manifest...`);
    const tempDir = path.resolve(user_path, "temp");
    fs.mkdirSync(tempDir, { recursive: true });
    const zipPath = path.join(tempDir, `${name.replace(/[<>:"/\\|?*]/g, '_')}_${Date.now()}.mrpack`);

    const zip = new AdmZip();

    zip.addFile("modrinth.index.json", Buffer.from(JSON.stringify(manifest, null, 2), "utf-8"));

    for (let i = 0; i < overrides.length; i++) {
        win.webContents.send('progress-update', `Creating .mrpack`, (i + 1) / overrides.length * 95, `Moving Override ${i + 1} of ${overrides.length}`);
        let override = overrides[i];
        const srcPath = path.resolve(user_path, "minecraft", "instances", instance_id, override);
        const destPath = "overrides/" + override;
        if (fs.existsSync(srcPath)) {
            const stat = fs.statSync(srcPath);
            if (stat.isDirectory()) {
                function addDirToZip(dir, zipPath) {
                    const entries = fs.readdirSync(dir, { withFileTypes: true });
                    for (const entry of entries) {
                        const entrySrc = path.join(dir, entry.name);
                        const entryDest = path.join(zipPath, entry.name);
                        if (entry.isDirectory()) {
                            addDirToZip(entrySrc, entryDest);
                        } else {
                            zip.addFile(entryDest.replace(/\\/g, "/"), fs.readFileSync(entrySrc));
                        }
                    }
                }
                addDirToZip(srcPath, destPath);
            } else {
                zip.addFile(destPath.replace(/\\/g, "/"), fs.readFileSync(srcPath));
            }
        }
    }

    zip.writeZip(zipPath);

    win.webContents.send('progress-update', `Creating .mrpack`, 100, `Done`);
    win.webContents.send('open-file-share', zipPath);
});
ipcMain.handle('create-cfzip', async (event, instance_id, name, manifest, overrides) => {
    win.webContents.send('progress-update', `Creating .zip`, 0, `Creating manifest...`);
    const tempDir = path.resolve(user_path, "temp");
    fs.mkdirSync(tempDir, { recursive: true });
    const zipPath = path.join(tempDir, `${name.replace(/[<>:"/\\|?*]/g, '_')}_${Date.now()}.zip`);

    const zip = new AdmZip();

    zip.addFile("manifest.json", Buffer.from(JSON.stringify(manifest, null, 2), "utf-8"));

    for (let i = 0; i < overrides.length; i++) {
        win.webContents.send('progress-update', `Creating .zip`, (i + 1) / overrides.length * 95, `Moving Override ${i + 1} of ${overrides.length}`);
        let override = overrides[i];
        const srcPath = path.resolve(user_path, "minecraft", "instances", instance_id, override);
        const destPath = "overrides/" + override;
        if (fs.existsSync(srcPath)) {
            const stat = fs.statSync(srcPath);
            if (stat.isDirectory()) {
                function addDirToZip(dir, zipPath) {
                    const entries = fs.readdirSync(dir, { withFileTypes: true });
                    for (const entry of entries) {
                        const entrySrc = path.join(dir, entry.name);
                        const entryDest = path.join(zipPath, entry.name);
                        if (entry.isDirectory()) {
                            addDirToZip(entrySrc, entryDest);
                        } else {
                            zip.addFile(entryDest.replace(/\\/g, "/"), fs.readFileSync(entrySrc));
                        }
                    }
                }
                addDirToZip(srcPath, destPath);
            } else {
                zip.addFile(destPath.replace(/\\/g, "/"), fs.readFileSync(srcPath));
            }
        }
    }

    zip.writeZip(zipPath);

    win.webContents.send('progress-update', `Creating .zip`, 100, `Done`);
    win.webContents.send('open-file-share', zipPath);
});