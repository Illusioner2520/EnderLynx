const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const RPC = require('discord-rpc');
const windowStateKeeper = require('electron-window-state');
const fs = require('fs');
const AdmZip = require('adm-zip');
const nbt = require('prismarine-nbt');
const zlib = require('zlib');
const toml = require('toml');
const pLimit = require('p-limit').default;
const { Minecraft, Java, Fabric, urlToFile, urlToFolder, Forge, NeoForge, Quilt, setUserPath, setWindow } = require('./launch.js');
const { queryServer } = require('./servers.js');
const { Auth } = require('msmc');
const querystring = require('querystring');
const https = require('https');
const stringArgv = require('string-argv').default;
const axios = require('axios');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { version } = require('./package.json');
const os = require('os');

app.userAgentFallback = `EnderLynx/${version}`;

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

if (!fs.existsSync(user_path)) {
    fs.mkdirSync(user_path);
}

setUserPath(user_path);

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
    let iconExt = "png";
    if (os.platform() == 'win32') iconExt = "ico";
    if (os.platform() == 'darwin') iconExt = "icns";
    win = new BrowserWindow({
        x: state.x,
        y: state.y,
        title: "EnderLynx",
        width: state.width,
        height: state.height,
        minWidth: 500,
        minHeight: 300,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            sandbox: false,
            devTools: enableDev,
            additionalArguments: additionalArguments
        },
        backgroundColor: "#0a0a0a",
        icon: path.join(__dirname, 'resources/icons/icon.' + iconExt)
    });
    win.loadFile('index.html');

    const ses = win.webContents.session;

    ses.webRequest.onBeforeSendHeaders((details, callback) => {
        if (
            details.url.startsWith("https://www.youtube.com/") ||
            details.url.startsWith("https://www.youtube-nocookie.com/") ||
            details.url.startsWith("https://googleads.g.doubleclick.net/")
        ) {
            details.requestHeaders["Referer"] = "https://illusioner.me/";
        }

        callback({ requestHeaders: details.requestHeaders });
    });

    win.webContents.on('did-finish-load', () => {
        if (openedFile) {
            win.webContents.send('open-file', openedFile);
        }
    });

    win.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: "deny" };
    });

    state.manage(win);
    setWindow(win);
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

        let fileArg = commandLine.find(arg => arg.endsWith('.elpack'));
        if (!fileArg) fileArg = commandLine.find(arg => arg.endsWith('.mrpack'));
        if (!fileArg) fileArg = commandLine.find(arg => arg.endsWith('.zip'));
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
        let fileArg = process.argv.find(arg => arg.endsWith('.elpack'));
        if (!fileArg) fileArg = process.argv.find(arg => arg.endsWith('.mrpack'));
        if (!fileArg) fileArg = process.argv.find(arg => arg.endsWith('.zip'));
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

function setUserPathMain(new_path, old_path) {
    user_path = new_path;
    fs.writeFileSync(pathPath, JSON.stringify({ user_path, old_path }), 'utf8');
    setUserPath(new_path);
    return true;
}

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
    let processId = generateNewProcessId();
    let cancelId = generateNewCancelId();
    let abortController = new AbortController();
    cancelFunctions[cancelId] = abortController;
    retryFunctions[cancelId] = () => { }
    let signal = abortController.signal;
    try {
        win.webContents.send('progress-update', `Creating .elpack`, 0, `Creating manifest...`, processId, "good", cancelId);
        const tempDir = path.resolve(user_path, "out");
        fs.mkdirSync(tempDir, { recursive: true });
        const zipPath = path.join(tempDir, `${name.replace(/[<>:"/\\|?*]/g, '_')}_${Date.now()}.elpack`);

        const zip = new AdmZip();

        zip.addFile("manifest.json", Buffer.from(JSON.stringify(manifest, null, 2), "utf-8"));

        for (let i = 0; i < overrides.length; i++) {
            signal.throwIfAborted();
            win.webContents.send('progress-update', `Creating .elpack`, (i + 1) / overrides.length * 100, `Moving Override ${i + 1} of ${overrides.length}`, processId, "good", cancelId);
            let override = overrides[i];
            const srcPath = path.resolve(user_path, "minecraft", "instances", instance_id, override);
            const destPath = "overrides/" + override;
            if (fs.existsSync(srcPath)) {
                const stat = fs.statSync(srcPath);
                if (stat.isDirectory()) {
                    async function addDirToZip(dir, zipPath) {
                        const entries = fs.readdirSync(dir, { withFileTypes: true });
                        for (const entry of entries) {
                            const entrySrc = path.join(dir, entry.name);
                            const entryDest = path.join(zipPath, entry.name);
                            if (entry.isDirectory()) {
                                await addDirToZip(entrySrc, entryDest);
                            } else {
                                zip.addFile(entryDest.replace(/\\/g, "/"), await fs.promises.readFile(entrySrc));
                            }
                        }
                    }
                    addDirToZip(srcPath, destPath);
                } else {
                    zip.addFile(destPath.replace(/\\/g, "/"), await fs.promises.readFile(srcPath));
                }
            }
        }
        signal.throwIfAborted();

        zip.writeZip(zipPath);
        signal.throwIfAborted();

        win.webContents.send('progress-update', `Creating .elpack`, 100, `Done`, processId, "done", cancelId);
        win.webContents.send('open-file-share', zipPath);
    } catch (err) {
        win.webContents.send('progress-update', `Creating .elpack`, 100, err, processId, "error", cancelId);
    }
});
ipcMain.handle('create-mrpack', async (event, instance_id, name, manifest, overrides) => {
    let processId = generateNewProcessId();
    let cancelId = generateNewCancelId();
    let abortController = new AbortController();
    cancelFunctions[cancelId] = abortController;
    retryFunctions[cancelId] = () => { }
    let signal = abortController.signal;
    try {
        win.webContents.send('progress-update', `Creating .mrpack`, 0, `Creating manifest...`, processId, "good", cancelId);
        const tempDir = path.resolve(user_path, "out");
        fs.mkdirSync(tempDir, { recursive: true });
        const zipPath = path.join(tempDir, `${name.replace(/[<>:"/\\|?*]/g, '_')}_${Date.now()}.mrpack`);

        const zip = new AdmZip();

        zip.addFile("modrinth.index.json", Buffer.from(JSON.stringify(manifest, null, 2), "utf-8"));
        signal.throwIfAborted();

        for (let i = 0; i < overrides.length; i++) {
            signal.throwIfAborted();
            win.webContents.send('progress-update', `Creating .mrpack`, (i + 1) / overrides.length * 100, `Moving Override ${i + 1} of ${overrides.length}`, processId, "good", cancelId);
            let override = overrides[i];
            const srcPath = path.resolve(user_path, "minecraft", "instances", instance_id, override);
            const destPath = "overrides/" + override;
            if (fs.existsSync(srcPath)) {
                const stat = fs.statSync(srcPath);
                if (stat.isDirectory()) {
                    async function addDirToZip(dir, zipPath) {
                        const entries = fs.readdirSync(dir, { withFileTypes: true });
                        for (const entry of entries) {
                            const entrySrc = path.join(dir, entry.name);
                            const entryDest = path.join(zipPath, entry.name);
                            if (entry.isDirectory()) {
                                await addDirToZip(entrySrc, entryDest);
                            } else {
                                zip.addFile(entryDest.replace(/\\/g, "/"), await fs.promises.readFile(entrySrc));
                            }
                        }
                    }
                    addDirToZip(srcPath, destPath);
                } else {
                    zip.addFile(destPath.replace(/\\/g, "/"), await fs.promises.readFile(srcPath));
                }
            }
        }
        signal.throwIfAborted();

        zip.writeZip(zipPath);
        signal.throwIfAborted();

        win.webContents.send('progress-update', `Creating .mrpack`, 100, `Done`, processId, "done", cancelId);
        win.webContents.send('open-file-share', zipPath);
    } catch (err) {
        win.webContents.send('progress-update', `Creating .mrpack`, 100, err, processId, "error", cancelId);
    }
});
ipcMain.handle('create-cfzip', async (event, instance_id, name, manifest, overrides) => {
    let processId = generateNewProcessId();
    let cancelId = generateNewCancelId();
    let abortController = new AbortController();
    cancelFunctions[cancelId] = abortController;
    retryFunctions[cancelId] = () => { }
    let signal = abortController.signal;
    try {
        win.webContents.send('progress-update', `Creating .zip`, 0, `Creating manifest...`, processId, "good", cancelId);
        const tempDir = path.resolve(user_path, "out");
        fs.mkdirSync(tempDir, { recursive: true });
        const zipPath = path.join(tempDir, `${name.replace(/[<>:"/\\|?*]/g, '_')}_${Date.now()}.zip`);

        const zip = new AdmZip();

        zip.addFile("manifest.json", Buffer.from(JSON.stringify(manifest, null, 2), "utf-8"));
        signal.throwIfAborted();

        for (let i = 0; i < overrides.length; i++) {
            signal.throwIfAborted();
            win.webContents.send('progress-update', `Creating .zip`, (i + 1) / overrides.length * 100, `Moving Override ${i + 1} of ${overrides.length}`, processId, "good", cancelId);
            let override = overrides[i];
            const srcPath = path.resolve(user_path, "minecraft", "instances", instance_id, override);
            const destPath = "overrides/" + override;
            if (fs.existsSync(srcPath)) {
                const stat = fs.statSync(srcPath);
                if (stat.isDirectory()) {
                    async function addDirToZip(dir, zipPath) {
                        const entries = fs.readdirSync(dir, { withFileTypes: true });
                        for (const entry of entries) {
                            const entrySrc = path.join(dir, entry.name);
                            const entryDest = path.join(zipPath, entry.name);
                            if (entry.isDirectory()) {
                                await addDirToZip(entrySrc, entryDest);
                            } else {
                                zip.addFile(entryDest.replace(/\\/g, "/"), await fs.promises.readFile(entrySrc));
                            }
                        }
                    }
                    addDirToZip(srcPath, destPath);
                } else {
                    zip.addFile(destPath.replace(/\\/g, "/"), await fs.promises.readFile(srcPath));
                }
            }
        }
        signal.throwIfAborted();

        zip.writeZip(zipPath);
        signal.throwIfAborted();

        win.webContents.send('progress-update', `Creating .zip`, 100, `Done`, processId, "done", cancelId);
        win.webContents.send('open-file-share', zipPath);
    } catch (err) {
        win.webContents.send('progress-update', `Creating .zip`, 100, err, processId, "error", cancelId)
    }
});

let serverIndexList = [];

ipcMain.handle('get-all-servers', async (_, instance_ids) => {
    if (!Array.isArray(instance_ids) || instance_ids.length === 0) return [];
    let allServers = [];
    for (const instanceId of instance_ids) {
        const servers = (await getMultiplayerWorlds(instanceId)).map(server => ({
            ...server,
            instance_id: instanceId
        }));
        allServers = allServers.concat(servers);
    }
    return allServers;
});
ipcMain.handle('get-multiplayer-worlds', async (_, instance_id) => {
    return await getMultiplayerWorlds(instance_id);
});

ipcMain.handle('delete-server', async (_, instance_id, ip, index) => {
    let instancePath = path.resolve(user_path, `minecraft/instances/${instance_id}`);
    let serversDatPath = path.resolve(instancePath, 'servers.dat');

    if (!fs.existsSync(serversDatPath)) return false;
    try {
        const buffer = fs.readFileSync(serversDatPath);
        const data = await nbt.parse(buffer);
        let servers = data.parsed.value.servers.value.value || [];
        let completed = false;
        for (let i = 0; i < ip.length; i++) {
            if (servers[serverIndexList[index[i]]].ip?.value == ip[i]) {
                servers[serverIndexList[index[i]]] = null;
                serverIndexList[index[i]] = null;
                completed = true;
            }
        }
        if (!completed) return false;
        servers = servers.filter(e => e);
        let currentNum = 0;
        for (let i = 0; i < serverIndexList.length; i++) {
            if (serverIndexList[i] === null) continue;
            serverIndexList[i] = currentNum;
            currentNum++;
        }

        data.parsed.value.servers.value.value = servers;

        const newBuffer = nbt.writeUncompressed(data.parsed);
        fs.writeFileSync(serversDatPath, newBuffer);
        return true;
    } catch (e) {
        console.error("Failed to delete server from servers.dat:", e);
        return false;
    }
})

async function getMultiplayerWorlds(instance_id) {
    let instancePath = path.resolve(user_path, `minecraft/instances/${instance_id}`);
    fs.mkdirSync(instancePath, { recursive: true });
    let serversDatPath = path.resolve(instancePath, 'servers.dat');
    let worlds = [];

    if (!fs.existsSync(serversDatPath)) {
        return worlds;
    }

    try {
        const buffer = fs.readFileSync(serversDatPath);
        const data = await nbt.parse(buffer);
        const servers = data.parsed?.value?.servers?.value?.value || [];

        let i = 0;
        for (const server of servers) {
            worlds.push({
                name: server.name?.value || "Unknown",
                ip: server.ip?.value || "",
                icon: server.icon?.value ? "data:image/png;base64," + server.icon?.value : "",
                acceptTextures: server.acceptTextures?.value ?? false,
                hideAddress: server.hideAddress?.value ?? false,
                last_played: server.lastOnline?.value ? Number(server.lastOnline.value) : null,
                index: i
            });
            i++;
        }
    } catch (e) {
        console.error(`Failed to parse servers.dat:`, e);
        return [];
    }

    serverIndexList = [];
    worlds.forEach((e, i) => {
        serverIndexList[i] = i;
    });

    return worlds;
}

ipcMain.handle('get-recently-played-worlds', async (_, instance_ids) => {
    if (!Array.isArray(instance_ids) || instance_ids.length === 0) return [];
    const instancesPath = path.resolve(user_path, "minecraft/instances");
    let allWorlds = [];
    for (const instanceId of instance_ids) {
        const savesPath = path.join(instancesPath, instanceId, "saves");
        if (!fs.existsSync(savesPath)) continue;
        const worlds = (await getWorlds(savesPath)).map(world => ({
            ...world,
            instance_id: instanceId
        }));
        allWorlds = allWorlds.concat(worlds);
    }
    allWorlds.sort((a, b) => (b.last_played || 0) - (a.last_played || 0));
    return allWorlds;
});

ipcMain.handle('get-worlds', async (_, savesPath) => {
    return await getWorlds(savesPath);
});

ipcMain.handle('get-world', async (_, levelDatPath) => {
    return await getWorld(levelDatPath);
});

async function getWorlds(savesPath) {
    fs.mkdirSync(savesPath, { recursive: true });
    let worldDirs = fs.opendirSync(savesPath);
    let worlds = [];

    let dir;
    while ((dir = worldDirs.readSync()) !== null) {
        if (!dir.isDirectory()) continue;
        const levelDatPath = path.resolve(savesPath, dir.name, 'level.dat');

        try {
            worlds.push(await getWorld(levelDatPath));
        } catch (e) { }
    }
    worldDirs.closeSync();
    return worlds;
}

async function getWorld(levelDatPath) {
    const buffer = fs.readFileSync(levelDatPath);
    const decompressed = zlib.gunzipSync(buffer);

    const data = nbt.parseUncompressed(decompressed);
    const levelData = data.value.Data.value;

    const parentFolder = path.basename(path.dirname(levelDatPath));
    const grandparentFolder = path.dirname(path.dirname(levelDatPath));

    let seed = null;
    try {
        if (levelData.WorldGenSettings?.value?.seed?.value !== undefined && levelData.WorldGenSettings?.value?.seed?.value !== null) {
            seed = BigInt(levelData.WorldGenSettings.value.seed.value);
        }
    } catch (e) {
        seed = null;
    }
    return ({
        name: levelData.LevelName.value,
        id: parentFolder,
        seed: seed,
        last_played: Number(levelData.LastPlayed.value),
        icon: fs.existsSync(path.resolve(grandparentFolder, parentFolder, "icon.png"))
            ? path.resolve(grandparentFolder, `${parentFolder}/icon.png`)
            : null,
        mode: (() => {
            const modeId = levelData.GameType?.value ?? 0;
            switch (modeId) {
                case 0: return "survival";
                case 1: return "creative";
                case 2: return "adventure";
                case 3: return "spectator";
                default: return "unknown";
            }
        })(),
        hardcore: !!levelData.hardcore?.value,
        commands: !!levelData.allowCommands?.value,
        flat: levelData?.WorldGenSettings?.value?.dimensions?.value["minecraft:overworld"]?.value?.generator?.value?.type?.value == "minecraft:flat",
        difficulty: (() => {
            const diffId = levelData.Difficulty?.value ?? 2;
            switch (diffId) {
                case 0: return "peaceful";
                case 1: return "easy";
                case 2: return "normal";
                case 3: return "hard";
                default: return "unknown";
            }
        })()
    })
}

ipcMain.handle('get-instance-content', async (_, loader, instance_id, old_content, link_with_modrinth) => {
    let old_files = old_content.map((e) => e.file_name);
    let patha = path.resolve(user_path, `minecraft/instances/${instance_id}/mods`);
    let pathb = path.resolve(user_path, `minecraft/instances/${instance_id}/resourcepacks`);
    let pathc = path.resolve(user_path, `minecraft/instances/${instance_id}/shaderpacks`);
    fs.mkdirSync(patha, { recursive: true });
    fs.mkdirSync(pathb, { recursive: true });
    fs.mkdirSync(pathc, { recursive: true });
    let all_hashes = [];
    let mods = [];
    if (loader != "vanilla") mods = fs.readdirSync(patha).map(file => {
        if (old_files.includes(file)) {
            old_files[old_files.indexOf(file)] = null;
            return null;
        }
        const filePath = path.resolve(patha, file);
        if (path.extname(file).toLowerCase() !== '.jar' && (path.extname(file).toLowerCase() !== '.disabled' || !file.includes(".jar.disabled"))) {
            return null;
        }
        let sha512 = null;
        let modJson = {};
        try {
            const zip = fs.readFileSync(filePath);
            try {
                sha512 = crypto.createHash('sha512').update(zip).digest('hex');
                all_hashes.push(sha512);
            } catch (e) { }

            const admZip = new AdmZip(zip);
            const entry2 = admZip.getEntry('quilt.mod.json');
            if (entry2) {
                modJson = JSON.parse(entry2.getData().toString('utf-8'));
                modJson.name = modJson.quilt_loader.metadata.name;
                modJson.authors = []
                modJson.authors[0] = Object.keys(modJson.quilt_loader.metadata.contributors)[0];
                if (modJson.quilt_loader.metadata.icon) {
                    let iconPath = Array.isArray(modJson.quilt_loader.metadata.icon) ? modJson.quilt_loader.metadata.icon[0] : modJson.quilt_loader.metadata.icon;
                    const iconEntry = admZip.getEntry(iconPath);
                    if (iconEntry) {
                        const iconBuffer = iconEntry.getData();
                        let mime = 'image/png';
                        if (iconPath.endsWith('.jpg') || iconPath.endsWith('.jpeg')) mime = 'image/jpeg';
                        else if (iconPath.endsWith('.gif')) mime = 'image/gif';
                        modJson.icon = `data:${mime};base64,${iconBuffer.toString('base64')}`;
                    }
                }
            }
            const entry = admZip.getEntry('fabric.mod.json');
            if (entry) {
                modJson = JSON.parse(entry.getData().toString('utf-8'));
                if (modJson.icon) {
                    let iconPath = Array.isArray(modJson.icon) ? modJson.icon[0] : modJson.icon;
                    const iconEntry = admZip.getEntry(iconPath);
                    if (iconEntry) {
                        const iconBuffer = iconEntry.getData();
                        let mime = 'image/png';
                        if (iconPath.endsWith('.jpg') || iconPath.endsWith('.jpeg')) mime = 'image/jpeg';
                        else if (iconPath.endsWith('.gif')) mime = 'image/gif';
                        modJson.icon = `data:${mime};base64,${iconBuffer.toString('base64')}`;
                    }
                }
            }
            const entry_forge = admZip.getEntry("META-INF/mods.toml");
            if (entry_forge) {
                const modsTomlData = entry_forge.getData().toString('utf-8');
                let forgeModJson = {};
                try {
                    forgeModJson = toml.parse(modsTomlData);
                    if (Array.isArray(forgeModJson.mods) && forgeModJson.mods.length > 0) {
                        const mod = forgeModJson.mods[0];
                        if (mod.logoFile || forgeModJson.logoFile) {
                            let logoFile = mod.logoFile;
                            if (!mod.logoFile) logoFile = forgeModJson.logoFile;
                            let iconPath = Array.isArray(logoFile) ? logoFile[0] : logoFile;
                            const iconEntry = admZip.getEntry(iconPath);
                            if (iconEntry) {
                                const iconBuffer = iconEntry.getData();
                                let mime = 'image/png';
                                if (iconPath.endsWith('.jpg') || iconPath.endsWith('.jpeg')) mime = 'image/jpeg';
                                else if (iconPath.endsWith('.gif')) mime = 'image/gif';
                                // Resize icon to max 40x40
                                let resizedBuffer = iconBuffer;
                                try {
                                    resizedBuffer = sharp(iconBuffer).resize({ width: 40, height: 40, fit: "inside" }).toBufferSync();
                                } catch (e) {
                                    // fallback to original if sharp fails
                                    resizedBuffer = iconBuffer;
                                }
                                modJson.icon = `data:${mime};base64,${resizedBuffer.toString('base64')}`;
                            }
                        }
                        modJson = {
                            ...modJson,
                            name: mod.displayName ? mod.displayName : mod.modId ? mod.modId : file.replace(".jar.disabled", ".jar"),
                            version: (!mod.version?.includes("$") && mod.version) ? mod.version : "",
                            authors: mod.authors ? [mod.authors] : [],
                            description: mod.description || "",
                        };
                    }
                } catch (e) {
                    console.log(e);
                }
            }
        } catch (e) { }
        return {
            type: 'mod',
            name: modJson?.name ?? file.replace(".jar.disabled", ".jar"),
            source: "player_install",
            file_name: file,
            version: modJson?.version ?? "",
            disabled: file.includes(".jar.disabled"),
            author: modJson?.authors && modJson?.authors[0] ? (modJson?.authors[0]?.name ? modJson.authors[0].name : modJson.authors[0]) : "",
            image: modJson?.icon ?? "",
            hash: sha512
        };
    }).filter(Boolean);
    let resourcepacks = fs.readdirSync(pathb).map(file => {
        if (old_files.includes(file)) {
            old_files[old_files.indexOf(file)] = null;
            return null;
        }
        const filePath = path.resolve(pathb, file);
        if (path.extname(file).toLowerCase() !== '.zip' && (path.extname(file).toLowerCase() !== '.disabled' || !file.includes(".zip.disabled"))) {
            return null;
        }
        let sha512 = null;
        let packMcMeta = null;
        try {
            const zip = fs.readFileSync(filePath);
            try {
                sha512 = crypto.createHash('sha512').update(zip).digest('hex');
                all_hashes.push(sha512);
            } catch (e) { }

            const admZip = new AdmZip(zip);
            const entry = admZip.getEntry('pack.mcmeta');
            if (entry) {
                packMcMeta = JSON.parse(entry.getData().toString('utf-8'));
            }
            const iconEntry = admZip.getEntry("pack.png");
            if (iconEntry) {
                const iconBuffer = iconEntry.getData();
                let mime = 'image/png';
                packMcMeta.icon = `data:${mime};base64,${iconBuffer.toString('base64')}`;
            }
        } catch (e) { }
        let name = file.replace(".zip.disabled", ".zip");
        if (packMcMeta?.pack?.description) name = packMcMeta.pack.description;
        if (packMcMeta?.pack?.description.fallback) name = packMcMeta.pack.description.fallback;
        if (typeof name !== "string") name = file.replace(".zip.disabled", ".zip");
        return {
            type: 'resource_pack',
            name: name,
            source: "player_install",
            file_name: file,
            version: "",
            disabled: file.includes(".zip.disabled"),
            author: "",
            image: packMcMeta?.icon ?? "",
            hash: sha512
        };
    });
    let shaderpacks = [];
    if (loader != "vanilla") shaderpacks = fs.readdirSync(pathc).map(file => {
        if (old_files.includes(file)) {
            old_files[old_files.indexOf(file)] = null;
            return null;
        }
        if (path.extname(file).toLowerCase() !== '.zip' && (path.extname(file).toLowerCase() !== '.disabled' || !file.includes(".zip.disabled"))) {
            return null;
        }
        let sha512 = null;
        try {
            const buf = fs.readFileSync(filePath);
            sha512 = crypto.createHash('sha512').update(buf).digest('hex');
            all_hashes.push(sha512);
        } catch (e) { }
        return {
            type: 'shader',
            name: file.replace(".zip.disabled", ".zip"),
            source: "player_install",
            file_name: file,
            version: "",
            disabled: file.includes(".zip.disabled"),
            author: "",
            image: "",
            hash: sha512
        };
    });
    let deleteFromContent = old_files.filter(e => e);
    let content = [...mods, ...resourcepacks, ...shaderpacks].filter(e => e);
    let project_ids = [];
    let team_ids = [];
    let team_to_project_ids = {};

    try {
        if (link_with_modrinth && all_hashes.length > 0) {
            let res_1 = await fetch(`https://api.modrinth.com/v2/version_files`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    "hashes": all_hashes,
                    "algorithm": "sha512"
                })
            });
            let res_json_1 = await res_1.json();
            all_hashes.forEach(e => {
                if (res_json_1[e]) {
                    content.forEach(f => {
                        if (f.hash == e) {
                            f.source = "modrinth";
                            f.version = res_json_1[e].version_number;
                            f.version_id = res_json_1[e].id;
                            f.source_id = res_json_1[e].project_id;
                            project_ids.push(res_json_1[e].project_id);
                        }
                    });
                }
            });
        }

        if (link_with_modrinth && project_ids.length > 0) {
            let res = await fetch(`https://api.modrinth.com/v2/projects?ids=["${project_ids.join('","')}"]`);
            let res_json = await res.json();
            res_json.forEach(e => {
                content.forEach(item => {
                    if (item.source_id == e.id) {
                        item.name = e.title;
                        item.image = e.icon_url;
                        item.type = e.project_type === "resourcepack" ? "resource_pack" : e.project_type;
                        team_ids.push(e.team);
                        if (!team_to_project_ids[e.team]) team_to_project_ids[e.team] = [e.id];
                        else team_to_project_ids[e.team].push(e.id);
                    }
                });
            });
            let res_2 = await fetch(`https://api.modrinth.com/v2/teams?ids=["${team_ids.join('","')}"]`);
            let res_json_2 = await res_2.json();
            res_json_2.forEach(e => {
                if (Array.isArray(e)) {
                    let authors = e.map(m => m.user?.username || m.user?.name || "");
                    let author = authors.join(", ");
                    if (!team_to_project_ids[e[0].team_id]) return;
                    team_to_project_ids[e[0].team_id].forEach(f => {
                        content.forEach(item => {
                            if (item.source_id == f) {
                                item.author = author;
                            }
                        });
                    });
                }
            });
        }
    } catch (e) {

    }

    content = content.map(e => {
        if (!e.source_id) e.source_id = "";
        return e;
    });

    return {
        "newContent": content.filter(e => e),
        "deleteContent": deleteFromContent
    }
});

ipcMain.handle('process-cf-zip-without-id', async (_, instance_id, zip_path, cf_id, title, max_downloads) => {
    return await processCfZipWithoutID(instance_id, zip_path, title, max_downloads);
});
ipcMain.handle('process-mr-pack', async (_, instance_id, mrpack_path, loader, title, max_downloads) => {
    return await processMrPack(instance_id, mrpack_path, loader, title, max_downloads);
});
ipcMain.handle('process-el-pack', async (_, instance_id, elpack_path, loader, title, max_downloads) => {
    return await processElPack(instance_id, elpack_path, title, max_downloads);
});
ipcMain.handle('process-cf-zip', async (_, instance_id, zip_path, cf_id, title, max_downloads) => {
    return await processCfZip(instance_id, zip_path, cf_id, title, max_downloads);
});

async function processCfZipWithoutID(instance_id, zip_path, title = ".zip file", max_downloads) {
    let processId = generateNewProcessId();
    let cancelId = generateNewCancelId();
    let abortController = new AbortController();
    cancelFunctions[cancelId] = abortController;
    retryFunctions[cancelId] = () => {
        processCfZipWithoutID(instance_id, zip_path, title, max_downloads);
    }
    let signal = abortController.signal;
    try {
        win.webContents.send('progress-update', `Installing ${title}`, 0, "Beginning install...", processId, "good", cancelId);
        const zip = new AdmZip(zip_path);

        let extractToPath = path.resolve(user_path, `minecraft/instances/${instance_id}`);

        if (!fs.existsSync(extractToPath)) {
            fs.mkdirSync(extractToPath, { recursive: true });
        }
        signal.throwIfAborted();

        await new Promise((resolve) => zip.extractAllToAsync(extractToPath, true, false, (v) => {
            resolve(v);
        }));

        let srcDir = path.resolve(user_path, `minecraft/instances/${instance_id}/overrides`);
        let destDir = path.resolve(user_path, `minecraft/instances/${instance_id}`);

        fs.mkdirSync(srcDir, { recursive: true });
        fs.mkdirSync(destDir, { recursive: true });

        const files = fs.readdirSync(srcDir);

        for (const file of files) {
            signal.throwIfAborted();
            win.webContents.send('progress-update', `Installing ${title}`, 5, `Moving override ${file}`, processId, "good", cancelId);
            const srcPath = path.join(srcDir, file);
            const destPath = path.join(destDir, file);

            if (fs.existsSync(destPath)) {
                const stats = fs.lstatSync(destPath);
                if (stats.isDirectory()) {
                    fs.rmSync(destPath, { recursive: true, force: true });
                } else {
                    fs.unlinkSync(destPath);
                }
            }
            try {
                await new Promise((resolve) => fs.cp(srcPath, destPath, { recursive: true }, (v) => {
                    resolve(v);
                }));
                await new Promise((resolve) => fs.rm(srcPath, { recursive: true, force: true }, (v) => {
                    resolve(v);
                }));
            } catch (err) {
                return "Unable to enable overrides for folder " + file;
            }
        }

        let manifest_json = fs.readFileSync(path.resolve(extractToPath, "manifest.json"));
        manifest_json = JSON.parse(manifest_json);

        let content = [];
        let project_ids = [];

        const limit = pLimit(max_downloads);

        let allocated_ram = manifest_json.minecraft?.recommendedRam;

        signal.throwIfAborted();
        win.webContents.send('progress-update', `Installing ${title}`, 10, `Downloading file 1 of ${manifest_json.files.length}`, processId, "good", cancelId);

        let count = 0;

        const downloadPromises = manifest_json.files.map((file, i) => limit(async () => {
            signal.throwIfAborted();
            win.webContents.send('progress-update', `Installing ${title}`, ((i + 1) / manifest_json.files.length) * 84 + 10, `Downloading file ${i + 1} of ${manifest_json.files.length}`, processId, "good", cancelId);

            let project_id = file.projectID;
            let file_id = file.fileID;

            project_ids.push(project_id);

            try {
                file_name = await urlToFolder(`https://www.curseforge.com/api/v1/mods/${project_id}/files/${file_id}/download`, path.resolve(extractToPath, "temp"));
            } catch (e) {
                let res = await fetch(`https://api.curse.tools/v1/cf/mods/${project_id}/files/${file_id}`);
                let res_json = await res.json();
                file_name = await urlToFolder(res_json.data.downloadUrl, path.resolve(extractToPath, "temp"));
            }

            const tempFilePath = path.resolve(extractToPath, "temp", file_name);
            let destFolder = "mods";
            let project_type = "mod";

            try {
                if (file_name.endsWith(".jar")) {
                    destFolder = "mods";
                } else if (file_name.endsWith(".zip")) {
                    const tempZip = new AdmZip(tempFilePath);
                    if (tempZip.getEntry("pack.mcmeta")) {
                        project_type = "resource_pack";
                        destFolder = "resourcepacks";
                    } else if (tempZip.getEntry("shaders/")) {
                        destFolder = "shaderpacks";
                        project_type = "shader";
                    } else {
                        destFolder = "resourcepacks";
                        project_type = "resource_pack";
                    }
                }
            } catch (e) {
                destFolder = "mods";
            }


            const finalPath = path.resolve(extractToPath, destFolder, file_name);
            fs.mkdirSync(path.dirname(finalPath), { recursive: true });
            fs.renameSync(tempFilePath, finalPath);

            content.push({
                "source": "curseforge",
                "source_id": project_id,
                "version_id": file_id,
                "disabled": false,
                "type": project_type,
                "version": "",
                "file_name": path.basename(finalPath)
            });

            signal.throwIfAborted();
            if (count == manifest_json.files.length - 1) {
                win.webContents.send('progress-update', `Installing ${title}`, 95, "Finishing metadata...", processId, "good", cancelId);
            } else {
                win.webContents.send('progress-update', `Installing ${title}`, ((count + 2) / manifest_json.files.length) * 84 + 10, `Downloading file ${count + 1} of ${manifest_json.files.length}`, processId, "good", cancelId);
            }
            count++;
        }));
        await Promise.all(downloadPromises);

        let cfData = [];
        try {
            const response = await fetch("https://api.curse.tools/v1/cf/mods", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ modIds: project_ids, filterPcOnly: false })
            }, { signal });
            if (response.ok) {
                const json = await response.json();
                cfData = json.data || [];
            }
        } catch (e) {
            cfData = [];
        }

        cfData.forEach(e => {
            content.forEach(item => {
                if (item.source === "curseforge" && Number(item.source_id) == Number(e.id)) {
                    item.name = e.name;
                    item.image = e.logo.thumbnailUrl;
                    item.author = e.authors.map(e => e.name).join(", ");
                }
            });
        });

        signal.throwIfAborted();
        win.webContents.send('progress-update', `Installing ${title}`, 100, "Done!", processId, "done", cancelId);
        return ({
            "loader_version": manifest_json.minecraft.modLoaders[0].id.split("-")[1],
            "content": cfData.length ? content : [],
            "loader": manifest_json.minecraft.modLoaders[0].id.split("-")[0],
            "vanilla_version": manifest_json.minecraft.version,
            "allocated_ram": allocated_ram,
            "name": manifest_json.name
        });
    } catch (err) {
        win.webContents.send('progress-update', `Installing ${title}`, 100, err, processId, "error", cancelId);
        return { "error": true };
    }
}
async function processMrPack(instance_id, mrpack_path, loader, title = ".mrpack file", max_downloads) {
    let processId = generateNewProcessId();
    let cancelId = generateNewCancelId();
    let abortController = new AbortController();
    cancelFunctions[cancelId] = abortController;
    retryFunctions[cancelId] = () => {
        processMrPack(instance_id, mrpack_path, loader, title, max_downloads);
    }
    let signal = abortController.signal;
    try {
        win.webContents.send('progress-update', `Installing ${title}`, 0, "Beginning install...", processId, "good", cancelId);
        const zip = new AdmZip(mrpack_path);

        let extractToPath = path.resolve(user_path, `minecraft/instances/${instance_id}`);

        if (!fs.existsSync(extractToPath)) {
            fs.mkdirSync(extractToPath, { recursive: true });
        }
        signal.throwIfAborted();

        await new Promise((resolve) => zip.extractAllToAsync(extractToPath, true, false, (v) => {
            resolve(v);
        }));
        signal.throwIfAborted();

        let srcDir = path.resolve(user_path, `minecraft/instances/${instance_id}/overrides`);
        let destDir = path.resolve(user_path, `minecraft/instances/${instance_id}`);

        fs.mkdirSync(srcDir, { recursive: true });
        fs.mkdirSync(destDir, { recursive: true });
        signal.throwIfAborted();

        const files = fs.readdirSync(srcDir);

        for (const file of files) {
            win.webContents.send('progress-update', `Installing ${title}`, 5, `Moving override ${file}`, processId, "good", cancelId);
            const srcPath = path.join(srcDir, file);
            const destPath = path.join(destDir, file);

            if (fs.existsSync(destPath)) {
                const stats = fs.lstatSync(destPath);
                if (stats.isDirectory()) {
                    fs.rmSync(destPath, { recursive: true, force: true });
                } else {
                    fs.unlinkSync(destPath);
                }
            }

            try {
                await new Promise((resolve) => fs.cp(srcPath, destPath, { recursive: true }, (v) => {
                    resolve(v);
                }));
                await new Promise((resolve) => fs.rm(srcPath, { recursive: true, force: true }, (v) => {
                    resolve(v);
                }));
            } catch (err) {
                return "Unable to enable overrides for folder " + file;
            }
            signal.throwIfAborted();
        }

        let modrinth_index_json = fs.readFileSync(path.resolve(extractToPath, "modrinth.index.json"));
        modrinth_index_json = JSON.parse(modrinth_index_json);

        let content = [];

        let project_ids = [];
        let version_hashes = [];
        let team_ids = [];
        let team_to_project_ids = {};

        const limit = pLimit(max_downloads);
        signal.throwIfAborted();

        win.webContents.send('progress-update', `Installing ${title}`, 10, `Downloading file 1 of ${modrinth_index_json.files.length}`, processId, "good", cancelId);

        let count = 0;

        const downloadPromises = modrinth_index_json.files.map((file, i) =>
            limit(async () => {
                signal.throwIfAborted();
                await urlToFile(file.downloads[0], path.resolve(extractToPath, file.path), { signal });
                version_hashes.push(file.hashes.sha512);
                content.push({
                    "disabled": false,
                    "file_name": path.basename(file.path),
                    "version_hash": file.hashes.sha512
                });
                signal.throwIfAborted();
                if (count == modrinth_index_json.files.length - 1) {
                    win.webContents.send('progress-update', `Installing ${title}`, 95, "Finishing metadata...", processId, "good", cancelId);
                } else {
                    win.webContents.send('progress-update', `Installing ${title}`, ((count + 2) / modrinth_index_json.files.length) * 84 + 10, `Downloading file ${count + 1} of ${modrinth_index_json.files.length}`, processId, "good", cancelId);
                }
                count++;
            })
        );

        await Promise.all(downloadPromises);
        signal.throwIfAborted();
        let res_1 = await fetch(`https://api.modrinth.com/v2/version_files`, {
            signal,
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "hashes": version_hashes,
                "algorithm": "sha512"
            })
        });
        let res_json_1 = await res_1.json();
        version_hashes.forEach(e => {
            if (res_json_1[e]) {
                content.forEach(f => {
                    if (f.version_hash == e) {
                        f.source_id = res_json_1[e].project_id;
                        project_ids.push(res_json_1[e].project_id);
                        f.version_id = res_json_1[e].id;
                        f.version = res_json_1[e].version_number;
                        f.source = "modrinth";
                    }
                });
            }
        });
        signal.throwIfAborted();

        content = content.filter(e => e.source);

        let res = await fetch(`https://api.modrinth.com/v2/projects?ids=["${project_ids.join('","')}"]`, { signal });
        let res_json = await res.json();
        res_json.forEach(e => {
            content.forEach(item => {
                if (item.source_id == e.id) {
                    item.name = e.title;
                    item.image = e.icon_url;
                    item.type = e.project_type === "resourcepack" ? "resource_pack" : e.project_type;
                    team_ids.push(e.team);
                    if (!team_to_project_ids[e.team]) team_to_project_ids[e.team] = [e.id];
                    else team_to_project_ids[e.team].push(e.id);
                }
            });
        });
        signal.throwIfAborted();
        let res_2 = await fetch(`https://api.modrinth.com/v2/teams?ids=["${team_ids.join('","')}"]`, { signal });
        let res_json_2 = await res_2.json();
        res_json_2.forEach(e => {
            if (Array.isArray(e)) {
                let authors = e.map(m => m.user?.username || m.user?.name || "");
                let author = authors.join(", ");
                if (!team_to_project_ids[e[0].team_id]) return;
                team_to_project_ids[e[0].team_id].forEach(f => {
                    content.forEach(item => {
                        if (item.source_id == f) {
                            item.author = author;
                        }
                    });
                });
            }
        });

        if (!loader) {
            loader = "vanilla";
            let loaders = ["forge", "fabric-loader", "neoforge", "quilt-loader"];
            let keys = Object.keys(modrinth_index_json.dependencies)
            for (const key of keys) {
                if (loaders.includes(key)) {
                    loader = key;
                    break;
                }
            }
        } else {
            if (loader == "fabric") loader = "fabric-loader";
            if (loader == "quilt") loader = "quilt-loader";
        }
        signal.throwIfAborted();
        win.webContents.send('progress-update', `Installing ${title}`, 100, "Done!", processId, "done", cancelId);
        return ({
            "loader_version": modrinth_index_json.dependencies[loader],
            "content": content,
            "loader": loader.replace("-loader", ""),
            "vanilla_version": modrinth_index_json.dependencies["minecraft"],
            "name": modrinth_index_json.name
        })
    } catch (err) {
        console.log(err);
        win.webContents.send('progress-update', `Installing ${title}`, 100, err, processId, "error", cancelId);
        return { "error": true };
    }
}
async function processElPack(instance_id, elpack_path, title = ".elpack file", max_downloads) {
    let processId = generateNewProcessId();
    let cancelId = generateNewCancelId();
    let abortController = new AbortController();
    cancelFunctions[cancelId] = abortController;
    retryFunctions[cancelId] = () => {
        processElPack(instance_id, elpack_path, title, max_downloads);
    }
    let signal = abortController.signal;
    try {
        win.webContents.send('progress-update', `Installing ${title}`, 0, "Beginning install...", processId, "good", cancelId);
        const zip = new AdmZip(elpack_path);

        let extractToPath = path.resolve(user_path, `minecraft/instances/${instance_id}`);

        if (!fs.existsSync(extractToPath)) {
            fs.mkdirSync(extractToPath, { recursive: true });
        }
        signal.throwIfAborted();

        await new Promise((resolve) => zip.extractAllToAsync(extractToPath, true, false, (v) => {
            resolve(v);
        }));

        let srcDir = path.resolve(user_path, `minecraft/instances/${instance_id}/overrides`);
        let destDir = path.resolve(user_path, `minecraft/instances/${instance_id}`);

        fs.mkdirSync(srcDir, { recursive: true });
        fs.mkdirSync(destDir, { recursive: true });

        const files = fs.readdirSync(srcDir);

        for (const file of files) {
            signal.throwIfAborted();
            win.webContents.send('progress-update', `Installing ${title}`, 5, `Moving override ${file}`, processId, "good", cancelId);
            const srcPath = path.join(srcDir, file);
            const destPath = path.join(destDir, file);

            if (fs.existsSync(destPath)) {
                const stats = fs.lstatSync(destPath);
                if (stats.isDirectory()) {
                    fs.rmSync(destPath, { recursive: true, force: true });
                } else {
                    fs.unlinkSync(destPath);
                }
            }

            try {
                await new Promise((resolve) => fs.cp(srcPath, destPath, { recursive: true }, (v) => {
                    resolve(v);
                }));
                await new Promise((resolve) => fs.rm(srcPath, { recursive: true, force: true }, (v) => {
                    resolve(v);
                }));
            } catch (err) {
                return "Unable to enable overrides for folder " + file;
            }
        }

        let manifest_json = fs.readFileSync(path.resolve(extractToPath, "manifest.json"));
        manifest_json = JSON.parse(manifest_json);

        let content = [];

        let mr_project_ids = [];
        let cf_project_ids = [];
        let mr_version_ids = [];
        let cf_version_ids = [];
        let mr_team_ids = [];
        let mr_team_to_project_ids = {};

        const limit = pLimit(max_downloads);

        signal.throwIfAborted();
        win.webContents.send('progress-update', `Installing ${title}`, 10, `Downloading file 1 of ${manifest_json.files.length}`, processId, "good", cancelId);

        let count = 0;

        const downloadPromises = manifest_json.files.map((file, i) =>
            limit(async () => {
                signal.throwIfAborted();
                let install_path = "";
                if (file.type == "mod") install_path = "mods/";
                if (file.type == "resource_pack") install_path = "resourcepacks/";
                if (file.type == "shader") install_path = "shaderpacks/";
                install_path += file.file_name;
                let url = "";
                if (file.source === "modrinth") {
                    url = `https://cdn.modrinth.com/data/${file.source_info}/versions/${file.version_id}/${file.file_name.replace(".disabled", "")}`;
                } else if (file.source === "curseforge") {
                    url = `https://www.curseforge.com/api/v1/mods/${Number(file.source_info)}/files/${Number(file.version_id)}/download`;
                } else if (file.source === "vanilla_tweaks") {
                    url = await getVanillaTweaksResourcePackLink(JSON.parse(file.source_info), manifest_json.game_version);
                }
                try {
                    await urlToFile(url, path.resolve(extractToPath, install_path), { signal });
                } catch (e) {
                    if (file.source === "modrinth") {
                        let url = `https://api.modrinth.com/v2/project/${file.source_info}/version/${file.version_id}`;
                        let res_pre_json = await fetch(url, { signal });
                        let res = await res_pre_json.json();
                        await urlToFile(res.files[0].url, path.resolve(extractToPath, install_path), { signal });
                    } else {
                        throw e;
                    }
                }
                content.push({
                    "author": file.source == "vanilla_tweaks" ? "Vanilla Tweaks" : "",
                    "disabled": file.disabled,
                    "file_name": file.file_name,
                    "image": file.source == "vanilla_tweaks" ? "https://vanillatweaks.net/assets/images/logo.png" : "",
                    "source": file.source,
                    "source_id": file.source_info,
                    "type": file.type,
                    "version": "",
                    "version_id": file.version_id,
                    "name": file.source == "vanilla_tweaks" ? "Vanilla Tweaks Resource Pack" : ""
                });
                if (file.source == "modrinth") {
                    mr_project_ids.push(file.source_info);
                    mr_version_ids.push(file.version_id);
                } else if (file.source == "curseforge") {
                    cf_project_ids.push(Number(file.source_info));
                    cf_version_ids.push(Number(file.version_id));
                }
                signal.throwIfAborted();
                if (count == manifest_json.files.length - 1) {
                    win.webContents.send('progress-update', `Installing ${title}`, 95, "Finishing metadata...", processId, "good", cancelId);
                } else {
                    win.webContents.send('progress-update', `Installing ${title}`, ((count + 2) / manifest_json.files.length) * 84 + 10, `Downloading file ${count + 1} of ${manifest_json.files.length}`, processId, "good", cancelId);
                }
                count++;
            })
        );

        await Promise.all(downloadPromises);

        if (mr_project_ids.length) {
            try {
                const res = await fetch(`https://api.modrinth.com/v2/projects?ids=["${mr_project_ids.join('","')}"]`, { signal });
                const res_json = await res.json();
                res_json.forEach(e => {
                    // Find all content items with matching source and source_info
                    content.forEach((item, idx) => {
                        if (item.source === "modrinth" && item.source_id === e.id) {
                            item.name = e.title;
                            item.image = e.icon_url;
                            item.type = e.project_type === "resourcepack" ? "resource_pack" : e.project_type;
                            if (!mr_team_to_project_ids[e.team]) mr_team_to_project_ids[e.team] = [];
                            mr_team_to_project_ids[e.team].push(e.id);
                            if (!mr_team_ids.includes(e.team)) mr_team_ids.push(e.team);
                        }
                    });
                });
            } catch (e) { }
        }
        signal.throwIfAborted();

        if (mr_version_ids.length) {
            try {
                const res = await fetch(`https://api.modrinth.com/v2/versions?ids=["${mr_version_ids.join('","')}"]`, { signal });
                const res_json = await res.json();
                res_json.forEach(e => {
                    content.forEach(item => {
                        if (item.source === "modrinth" && item.version_id === e.id) {
                            item.version = e.version_number;
                        }
                    });
                });
            } catch (e) { }
        }
        signal.throwIfAborted();

        if (mr_team_ids.length) {
            try {
                const res = await fetch(`https://api.modrinth.com/v2/teams?ids=["${mr_team_ids.join('","')}"]`, { signal });
                const res_json = await res.json();
                res_json.forEach(e => {
                    if (Array.isArray(e)) {
                        let authors = e.map(m => m.user?.username || m.user?.name || "");
                        let author = authors.join(", ");
                        if (!mr_team_to_project_ids[e[0].team_id]) return;
                        mr_team_to_project_ids[e[0].team_id].forEach(projectId => {
                            content.forEach(item => {
                                if (item.source === "modrinth" && item.source_id === projectId) {
                                    item.author = author;
                                }
                            });
                        });
                    }
                });
            } catch (e) { }
        }
        signal.throwIfAborted();

        if (cf_project_ids.length) {
            try {
                const response = await fetch("https://api.curse.tools/v1/cf/mods", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ modIds: cf_project_ids, filterPcOnly: false }),
                    signal
                });
                if (response.ok) {
                    const json = await response.json();
                    const cfData = json.data || [];
                    cfData.forEach(e => {
                        content.forEach(item => {
                            if (item.source === "curseforge" && item.source_id == e.id + ".0") {
                                item.name = e.name;
                                item.image = e.logo.thumbnailUrl;
                                item.author = e.authors.map(e => e.name).join(", ");
                            }
                        });
                    });
                }
            } catch (e) { }
        }

        signal.throwIfAborted();
        win.webContents.send('progress-update', `Installing ${title}`, 100, "Done!", processId, "done", cancelId);
        return ({
            "loader_version": manifest_json.loader_version,
            "content": content,
            "loader": manifest_json.loader,
            "vanilla_version": manifest_json.game_version,
            "allocated_ram": manifest_json.allocated_ram,
            "image": manifest_json.icon,
            "name": manifest_json.name
        })
    } catch (err) {
        console.error(err);
        win.webContents.send('progress-update', `Installing ${title}`, 100, err, processId, "error", cancelId);
        return { "error": true };
    }
}
async function processCfZip(instance_id, zip_path, cf_id, title = ".zip file", max_downloads) {
    let processId = generateNewProcessId();
    let cancelId = generateNewCancelId();
    let abortController = new AbortController();
    cancelFunctions[cancelId] = abortController;
    retryFunctions[cancelId] = () => {
        processCfZip(instance_id, zip_path, cf_id, title, max_downloads);
    }
    let signal = abortController.signal;
    try {
        win.webContents.send('progress-update', `Installing ${title}`, 0, "Beginning install...", processId, "good", cancelId);
        const zip = new AdmZip(zip_path);

        let extractToPath = path.resolve(user_path, `minecraft/instances/${instance_id}`);

        if (!fs.existsSync(extractToPath)) {
            fs.mkdirSync(extractToPath, { recursive: true });
        }
        signal.throwIfAborted();

        await new Promise((resolve) => zip.extractAllToAsync(extractToPath, true, false, (v) => {
            resolve(v);
        }));

        let srcDir = path.resolve(user_path, `minecraft/instances/${instance_id}/overrides`);
        let destDir = path.resolve(user_path, `minecraft/instances/${instance_id}`);

        fs.mkdirSync(srcDir, { recursive: true });
        fs.mkdirSync(destDir, { recursive: true });

        const files = fs.readdirSync(srcDir);

        for (const file of files) {
            signal.throwIfAborted();
            win.webContents.send('progress-update', `Installing ${title}`, 5, `Moving override ${file}`, processId, "good", cancelId);
            const srcPath = path.join(srcDir, file);
            const destPath = path.join(destDir, file);

            if (fs.existsSync(destPath)) {
                const stats = fs.lstatSync(destPath);
                if (stats.isDirectory()) {
                    fs.rmSync(destPath, { recursive: true, force: true });
                } else {
                    fs.unlinkSync(destPath);
                }
            }
            try {
                await new Promise((resolve) => fs.cp(srcPath, destPath, { recursive: true }, (v) => {
                    resolve(v);
                }));
                await new Promise((resolve) => fs.rm(srcPath, { recursive: true, force: true }, (v) => {
                    resolve(v);
                }));
            } catch (err) {
                return "Unable to enable overrides for folder " + file;
            }
        }

        let manifest_json = fs.readFileSync(path.resolve(extractToPath, "manifest.json"));
        manifest_json = JSON.parse(manifest_json);

        let dependency_res;
        if (cf_id) dependency_res = await fetch(`https://www.curseforge.com/api/v1/mods/${cf_id}/dependencies?index=0&pageSize=1000`)
        let dependency_json;
        if (cf_id) dependency_json = await dependency_res.json()

        let content = [];
        let project_ids = [];

        const limit = pLimit(max_downloads);

        let allocated_ram = manifest_json.minecraft?.recommendedRam;

        signal.throwIfAborted();
        win.webContents.send('progress-update', `Installing ${title}`, 10, `Downloading file 1 of ${manifest_json.files.length}`, processId, "good", cancelId);

        let count = 0;

        const downloadPromises = manifest_json.files.map((file, i) => limit(async () => {
            signal.throwIfAborted();
            let dependency_item = cf_id ? dependency_json.data.find(dep => dep.id === file.projectID) : null;

            let folder = "mods";
            if (dependency_item?.categoryClass?.slug == "texture-packs") folder = "resourcepacks";
            else if (dependency_item?.categoryClass?.slug == "shaders") folder = "shaderpacks";
            let type = "mod";
            if (dependency_item?.categoryClass?.slug == "texture-packs") type = "resource_pack";
            else if (dependency_item?.categoryClass?.slug == "shaders") type = "shader";
            let file_name = "";
            try {
                file_name = await urlToFolder(`https://www.curseforge.com/api/v1/mods/${file.projectID}/files/${file.fileID}/download`, path.resolve(extractToPath, folder));
            } catch (e) {
                let res = await fetch(`https://api.curse.tools/v1/cf/mods/${file.projectID}/files/${file.fileID}`);
                let res_json = await res.json();
                file_name = await urlToFolder(res_json.data.downloadUrl, path.resolve(extractToPath, folder));
            }

            if (cf_id && dependency_item) {
                project_ids.push(null);
                content.push({
                    "author": dependency_item?.authorName ?? "",
                    "disabled": false,
                    "file_name": file_name,
                    "image": dependency_item?.logoUrl ?? "",
                    "source": "curseforge",
                    "source_id": file.projectID,
                    "type": type,
                    "version": "",
                    "version_id": file.fileID,
                    "name": dependency_item?.name ?? file_name
                })
            } else {
                project_ids.push(file.projectID);
                content.push({
                    "source": "curseforge",
                    "source_id": file.projectID,
                    "version_id": file.fileID,
                    "disabled": false,
                    "type": type,
                    "version": "",
                    "file_name": file_name
                });
            }
            signal.throwIfAborted();
            if (count == manifest_json.files.length - 1) {
                win.webContents.send('progress-update', `Installing ${title}`, 95, "Finishing metadata...", processId, "good", cancelId);
            } else {
                win.webContents.send('progress-update', `Installing ${title}`, ((count + 2) / manifest_json.files.length) * 84 + 10, `Downloading file ${count + 2} of ${manifest_json.files.length}`, processId, "good", cancelId);
            }
            count++;
        }));
        await Promise.all(downloadPromises);

        if (project_ids.filter(e => e).length) {
            let cfData = [];
            try {
                const response = await fetch("https://api.curse.tools/v1/cf/mods", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ modIds: project_ids.filter(e => e), filterPcOnly: false }),
                    signal
                });
                if (response.ok) {
                    const json = await response.json();
                    cfData = json.data || [];
                }
            } catch (e) {
                cfData = [];
            }

            cfData.forEach(e => {
                content.forEach(item => {
                    if (Number(item.source_id) == Number(e.id)) {
                        item.name = e.name;
                        item.image = e.logo.thumbnailUrl;
                        item.author = e.authors.map(e => e.name).join(", ");
                    }
                });
            });
        }

        signal.throwIfAborted();
        win.webContents.send('progress-update', `Installing ${title}`, 100, "Done!", processId, "done", cancelId);
        return ({
            "loader_version": manifest_json.minecraft.modLoaders[0].id.split("-")[1],
            "content": content,
            "loader": manifest_json.minecraft.modLoaders[0].id.split("-")[0],
            "vanilla_version": manifest_json.minecraft.version,
            "allocated_ram": allocated_ram,
            "name": manifest_json.name
        })
    } catch (err) {
        win.webContents.send('progress-update', `Installing ${title}`, 100, err, processId, "error", cancelId);
        return { "error": true };
    }
}

ipcMain.handle('play-minecraft', async (_, loader, version, loaderVersion, instance_id, player_info, quickPlay, customResolution, allocatedRam, javaPath, javaArgs, envVars, preLaunch, postLaunch, wrapper, postExit, globalEnvVars, globalPreLaunch, globalPostLaunch, globalWrapper, globalPostExit, name) => {
    return await playMinecraft(loader, version, loaderVersion, instance_id, player_info, quickPlay, customResolution, allocatedRam, javaPath, javaArgs, envVars, preLaunch, postLaunch, wrapper, postExit, globalEnvVars, globalPreLaunch, globalPostLaunch, globalWrapper, globalPostExit, name);
});

async function playMinecraft(loader, version, loaderVersion, instance_id, player_info, quickPlay, customResolution, allocatedRam, javaPath, javaArgs, envVars, preLaunch, postLaunch, wrapper, postExit, globalEnvVars, globalPreLaunch, globalPostLaunch, globalWrapper, globalPostExit, name) {
    if (!player_info) throw new Error("Please sign in to your Microsoft account to play Minecraft.");

    let date = new Date();
    date.setHours(date.getHours() - 1);
    if (new Date(player_info.expires) < date) {
        try {
            player_info = await getNewAccessToken(player_info.refresh_token);
        } catch (err) {
            win.webContents.send('display-error', "Unable to update access token. Launching Minecraft in offline mode.");
        }
    }
    let mc = new Minecraft(instance_id, name);
    try {
        return {
            "minecraft": await mc.launchGame(loader, version, loaderVersion, player_info.name, player_info.uuid, {
                "accessToken": player_info.access_token,
                "xuid": player_info.xuid,
                "clientId": player_info.client_id
            }, customResolution, quickPlay, false, allocatedRam, javaPath, parseJavaArgs(javaArgs), {...parseEnvString(globalEnvVars), ...parseEnvString(envVars)}, preLaunch, postLaunch, parseJavaArgs(wrapper), postExit, globalPreLaunch, globalPostLaunch, parseJavaArgs(globalWrapper), globalPostExit), "player_info": player_info
        };
    } catch (err) {
        console.error(err);
        throw new Error("Unable to launch Minecraft");
    }
}

ipcMain.handle('fabric-vanilla-versions', async (_) => {
    return await Fabric.getSupportedVanillaVersions();
});

ipcMain.handle('forge-vanilla-versions', async (_) => {
    return await Forge.getSupportedVanillaVersions();
});

ipcMain.handle('neoforge-vanilla-versions', async (_) => {
    return await NeoForge.getSupportedVanillaVersions();
});

ipcMain.handle('quilt-vanilla-versions', async (_) => {
    return await Quilt.getSupportedVanillaVersions();
});

ipcMain.handle('fabric-loader-versions', async (_, v) => {
    return await Fabric.getVersions(v);
});

ipcMain.handle('forge-loader-versions', async (_, v) => {
    return await Forge.getVersions(v);
});

ipcMain.handle('neoforge-loader-versions', async (_, v) => {
    return await NeoForge.getVersions(v);
});

ipcMain.handle('quilt-loader-versions', async (_, v) => {
    return await Quilt.getVersions(v);
});

ipcMain.handle('download-minecraft', async (_, instance_id, loader, vanilla_version, loader_version) => {
    return await downloadMinecraft(instance_id, loader, vanilla_version, loader_version);
});

ipcMain.handle('repair-minecraft', async (_, instance_id, loader, vanilla_version, loader_version, whatToRepair) => {
    return await repairMinecraft(instance_id, loader, vanilla_version, loader_version, whatToRepair);
});

async function downloadMinecraft(instance_id, loader, vanilla_version, loader_version) {
    try {
        let mc = new Minecraft(instance_id);
        let r = await mc.downloadGame(loader, vanilla_version);
        if (loader == "fabric") {
            await mc.installFabric(vanilla_version, loader_version);
        } else if (loader == "forge") {
            await mc.installForge(vanilla_version, loader_version);
        } else if (loader == "neoforge") {
            await mc.installNeoForge(vanilla_version, loader_version);
        } else if (loader == "quilt") {
            await mc.installQuilt(vanilla_version, loader_version);
        }
        return { java_installation: r.java_installation.replaceAll("\\", "/"), java_version: r.java_version, java_args: r.java_args };
    } catch (err) {
        return { "error": true };
    }
}

async function repairMinecraft(instance_id, loader, vanilla_version, loader_version, whatToRepair) {
    try {
        let mc = new Minecraft(instance_id);
        let r = await mc.downloadGame(loader, vanilla_version, true, whatToRepair);
        if (whatToRepair.includes("mod_loader")) {
            if (loader == "fabric") {
                await mc.installFabric(vanilla_version, loader_version, true);
            } else if (loader == "forge") {
                await mc.installForge(vanilla_version, loader_version, true);
            } else if (loader == "neoforge") {
                await mc.installNeoForge(vanilla_version, loader_version, true);
            } else if (loader == "quilt") {
                await mc.installQuilt(vanilla_version, loader_version, true);
            }
        }
        return { "java_installation": r.java_installation ? r.java_installation.replaceAll("\\", "/") : r.java_installation, "java_version": r.java_version, "java_args": r.java_args };
    } catch (err) {
        return { "error": true }
    }
}

async function getNewAccessToken(refresh_token) {
    let date = new Date();
    date.setHours(date.getHours() + 1);
    const authManager = new Auth("select_account");
    const xboxManager = await authManager.refresh(refresh_token);
    const token = await xboxManager.getMinecraft();
    return {
        "access_token": token.mcToken,
        "uuid": token.profile.id,
        "refresh_token": token.parent.msToken.refresh_token,
        "capes": token.profile.capes,
        "skins": token.profile.skins,
        "name": token.profile.name,
        "is_demo": token.profile.demo,
        "xuid": token.xuid,
        "client_id": getUUID(),
        "expires": date
    }
}

function getUUID() {
    var result = "";
    for (var i = 0; i <= 4; i++) {
        result += (Math.floor(Math.random() * 16777216) + 1048576).toString(16);
        if (i < 4) result += "-";
    }
    return result;
}

function parseJavaArgs(input) {
    if (!input) return [];
    return stringArgv(input);
}

function parseEnvString(input) {
    const env = {};

    if (!input) return env;

    // Supports both space-separated or newline-separated input
    const lines = input.split(/\s+|\n/);

    for (const line of lines) {
        if (!line || !line.includes('=')) continue;
        const [key, ...rest] = line.split('=');
        const value = rest.join('='); // Rejoin in case value had '='
        env[key.trim()] = value.trim();
    }

    return env;
}

ipcMain.handle('download-modrinth-pack', async (_, instance_id, url, title) => {
    return await downloadModrinthPack(instance_id, url, title);
});

ipcMain.handle('download-curseforge-pack', async (_, instance_id, url, title) => {
    return await downloadCurseforgePack(instance_id, url, title);
});

async function downloadModrinthPack(instance_id, url, title) {
    let processId = generateNewProcessId();
    let cancelId = generateNewCancelId();
    let abortController = new AbortController();
    cancelFunctions[cancelId] = abortController;
    retryFunctions[cancelId] = () => {
        downloadModrinthPack(instance_id, url, title);
    }
    let signal = abortController.signal;
    win.webContents.send('progress-update', `Downloading ${title}`, 0, "Beginning download...", processId, "good", cancelId);
    try {
        await urlToFile(url, path.resolve(user_path, `minecraft/instances/${instance_id}/pack.mrpack`), {
            signal, onProgress: (v) => {
                win.webContents.send('progress-update', `Downloading ${title}`, v, "Downloading...", processId, "good", cancelId);
            }
        });
        win.webContents.send('progress-update', `Downloading ${title}`, 100, "Done!", processId, "done", cancelId);
    } catch (err) {
        win.webContents.send('progress-update', `Downloading ${title}`, 100, err, processId, "error", cancelId);
        throw err;
    }
}

async function downloadCurseforgePack(instance_id, url, title) {
    let processId = generateNewProcessId();
    let cancelId = generateNewCancelId();
    let abortController = new AbortController();
    cancelFunctions[cancelId] = abortController;
    retryFunctions[cancelId] = () => {
        downloadCurseforgePack(instance_id, url, title);
    }
    let signal = abortController.signal;
    win.webContents.send('progress-update', `Downloading ${title}`, 0, "Beginning download...", processId, "good", cancelId);
    try {
        await urlToFile(url, path.resolve(user_path, `minecraft/instances/${instance_id}/pack.zip`), {
            signal, onProgress: (v) => {
                win.webContents.send('progress-update', `Downloading ${title}`, v, "Downloading...", processId, "good", cancelId);
            }
        });
        win.webContents.send('progress-update', `Downloading ${title}`, 100, "Done!", processId, "done", cancelId);
    } catch (err) {
        win.webContents.send('progress-update', `Downloading ${title}`, 100, err, processId, "error", cancelId);
        throw err;
    }
}

ipcMain.handle('process-pack-file', async (_, file_path, instance_id, title, max_downloads) => {
    return await processPackFile(file_path, instance_id, title, max_downloads);
});

async function processPackFile(file_path, instance_id, title, max_downloads) {
    if (/^https?:\/\//.test(file_path)) {
        await downloadCurseforgePack(instance_id, file_path, title);
    }
    let extension = path.extname(file_path);
    if (extension == ".mrpack") {
        return await processMrPack(instance_id, file_path, null, title, max_downloads);
    } else if (extension == ".zip") {
        return await processCfZipWithoutID(instance_id, file_path, title, max_downloads);
    } else if (extension == ".elpack") {
        return await processElPack(instance_id, file_path, title, max_downloads);
    } else if (extension == "") {
        return;
    }
}

let vt_rp = {}, vt_dp = {}, vt_ct = {};

async function getVanillaTweaksResourcePackLink(packs, version) {
    if (version.split(".").length > 2) {
        version = version.split(".").splice(0, 2).join(".");
    }
    let data_json = vt_rp[version];
    if (!vt_rp[version]) {
        let data = await fetch(`https://vanillatweaks.net/assets/resources/json/${version}/rpcategories.json?${(new Date()).getTime()}`);
        data_json = await data.json();
        vt_rp[version] = data_json;
    }
    let pack_info = {};

    let process_category = (category, previous_categories = []) => {
        previous_categories.push(category.category);
        let id = previous_categories.join(".").toLowerCase().replaceAll(" ", "-").replaceAll("'", "-");
        let packs = category.packs.map(e => e.name);
        packs.forEach(e => {
            pack_info[e] = id;
        });
        if (category.categories) {
            category.categories.forEach(e => {
                process_category(e, structuredClone(previous_categories));
            })
        }
    }
    for (let i = 0; i < data_json.categories.length; i++) {
        process_category(data_json.categories[i]);
    }

    let packs_send = {};
    for (let i = 0; i < packs.length; i++) {
        if (!packs_send[pack_info[packs[i].id]]) {
            packs_send[pack_info[packs[i].id]] = [packs[i].id]
        } else {
            packs_send[pack_info[packs[i].id]].push(packs[i].id);
        }
    }

    let h = querystring.stringify({
        "packs": JSON.stringify(packs_send),
        "version": version
    });

    const options = {
        hostname: 'vanillatweaks.net',
        path: '/assets/server/zipresourcepacks.php',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': h.length
        }
    };
    let data_vt = await new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                resolve(data);
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.write(h);
        req.end();
    });
    data_vt = JSON.parse(data_vt);
    if (data_vt.link) return "https://vanillatweaks.net" + data_vt.link;
    return null;
}

ipcMain.handle('download-vanilla-tweaks-data-packs', async (_, packs, version, instance_id, world_id) => {
    return await downloadVanillaTweaksDataPacks(packs, version, instance_id, world_id);
});

async function downloadVanillaTweaksDataPacks(packs, version, instance_id, world_id) {
    if (version.split(".").length > 2) {
        version = version.split(".").splice(0, 2).join(".");
    }
    let data_json = vt_dp[version];
    let data_ct_json = vt_ct[version];
    if (!vt_dp[version]) {
        let data = await fetch(`https://vanillatweaks.net/assets/resources/json/${version}/dpcategories.json`);
        data_json = await data.json();
        vt_dp[version] = data_json;
    }
    if (!vt_ct[version]) {
        let data_ct = await fetch(`https://vanillatweaks.net/assets/resources/json/${version}/ctcategories.json`);
        data_ct_json = await data_ct.json();
        vt_ct[version] = data_ct_json;
    }
    let pack_info = {};
    let pack_ct_info = {};

    let process_category = (category, previous_categories = [], type) => {
        previous_categories.push(category.category);
        let id = previous_categories.join(".").toLowerCase().replaceAll(" ", "-").replaceAll("'", "-");
        let packs = category.packs.map(e => e.name);
        packs.forEach(e => {
            if (type == "dp") pack_info[e] = id;
            if (type == "ct") pack_ct_info[e] = id;
        });
        if (category.categories) {
            category.categories.forEach(e => {
                process_category(e, structuredClone(previous_categories), type);
            })
        }
    }
    for (let i = 0; i < data_json.categories.length; i++) {
        process_category(data_json.categories[i], [], "dp");
    }
    for (let i = 0; i < data_ct_json.categories.length; i++) {
        process_category(data_ct_json.categories[i], [], "ct");
    }

    let useDatapacks = false;
    let useCraftingTweaks = false;

    let packs_send = {};
    let packs_ct_send = {};
    for (let i = 0; i < packs.length; i++) {
        if (packs[i].type == "ct") {
            useCraftingTweaks = true;
            let info = pack_ct_info[packs[i].id];
            if (!packs_ct_send[info]) {
                packs_ct_send[info] = [packs[i].id]
            } else {
                packs_ct_send[info].push(packs[i].id);
            }
        } else {
            useDatapacks = true;
            let info = pack_info[packs[i].id];
            if (!packs_send[info]) {
                packs_send[info] = [packs[i].id]
            } else {
                packs_send[info].push(packs[i].id);
            }
        }
    }

    let h = querystring.stringify({
        "packs": JSON.stringify(packs_send),
        "version": version
    });
    let h_ct = querystring.stringify({
        "packs": JSON.stringify(packs_ct_send),
        "version": version
    });

    const options = (type) => ({
        hostname: 'vanillatweaks.net',
        path: type == "dp" ? '/assets/server/zipdatapacks.php' : '/assets/server/zipcraftingtweaks.php',
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Content-Length': type == "dp" ? h.length : h_ct.length
        }
    });
    let data_vt = "{}";
    let data_ct_vt = "{}";
    if (useDatapacks) data_vt = await new Promise((resolve, reject) => {
        const req = https.request(options("dp"), (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                resolve(data);
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.write(h);
        req.end();
    });

    if (useCraftingTweaks) data_ct_vt = await new Promise((resolve, reject) => {
        const req = https.request(options("ct"), (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                resolve(data);
            });
        });

        req.on('error', (error) => {
            reject(error);
        });

        req.write(h_ct);
        req.end();
    });

    data_vt = JSON.parse(data_vt);
    data_ct_vt = JSON.parse(data_ct_vt);

    const datapacksDir = path.resolve(user_path, `minecraft/instances/${instance_id}/saves/${world_id}/datapacks`);
    if (data_ct_vt.link) {
        fs.mkdirSync(datapacksDir, { recursive: true });
        let baseName = "vanilla_tweaks.zip";
        let filePath = path.join(datapacksDir, baseName);
        let counter = 1;
        while (fs.existsSync(filePath)) {
            baseName = `vanilla_tweaks_${counter}.zip`;
            filePath = path.join(datapacksDir, baseName);
            counter++;
        }
        await urlToFile("https://vanillatweaks.net" + data_ct_vt.link, filePath);
    }
    if (data_vt.link) {
        const tempDir = path.resolve(user_path, `minecraft/instances/${instance_id}/temp_datapacks`);
        fs.mkdirSync(tempDir, { recursive: true });
        let baseName = "vanilla_tweaks.zip";
        let filePath = path.join(tempDir, baseName);
        let counter = 1;
        while (fs.existsSync(filePath)) {
            baseName = `vanilla_tweaks_${counter}.zip`;
            filePath = path.join(tempDir, baseName);
            counter++;
        }
        await urlToFile("https://vanillatweaks.net" + data_vt.link, filePath);

        const zip = new AdmZip(filePath);
        const entries = zip.getEntries();

        for (const entry of entries) {
            let entryName = entry.entryName;
            let destPath = path.join(datapacksDir, entryName);

            if (fs.existsSync(destPath)) {
                let ext = path.extname(entryName);
                let base = path.basename(entryName, ext);
                let dir = path.dirname(destPath);
                let i = 1;
                let newName;
                do {
                    newName = ext
                        ? `${base}_${i}${ext}`
                        : `${base}_${i}`;
                    destPath = path.join(dir, newName);
                    i++;
                } while (fs.existsSync(destPath));
            }

            if (entry.isDirectory) {
                fs.mkdirSync(destPath, { recursive: true });
            } else {
                fs.mkdirSync(path.dirname(destPath), { recursive: true });
                fs.writeFileSync(destPath, entry.getData());
            }
        }

        fs.unlinkSync(filePath);
    }

    return true;
}

ipcMain.handle('download-vanilla-tweaks-resource-packs', async (_, packs, version, instance_id, file_path) => {
    return await downloadVanillaTweaksResourcePacks(packs, version, instance_id, file_path);
});

async function downloadVanillaTweaksResourcePacks(packs, version, instance_id, file_path) {
    let link = await getVanillaTweaksResourcePackLink(packs, version);
    if (link) {
        const resourcepacksDir = path.resolve(user_path, `minecraft/instances/${instance_id}/resourcepacks`);
        fs.mkdirSync(resourcepacksDir, { recursive: true });
        let baseName = "vanilla_tweaks.zip";
        let filePath = path.join(resourcepacksDir, baseName);
        if (file_path) {
            filePath = path.join(resourcepacksDir, file_path);
        } else {
            let counter = 1;
            while (fs.existsSync(filePath)) {
                baseName = `vanilla_tweaks_${counter}.zip`;
                filePath = path.join(resourcepacksDir, baseName);
                counter++;
            }
        }
        await urlToFile(link, filePath);

        return baseName;
    } else {
        return false;
    }
}

ipcMain.handle('add-content', async (_, instance_id, project_type, project_url, filename, data_pack_world, content_id) => {
    return await addContent(instance_id, project_type, project_url, filename, data_pack_world, content_id);
});

ipcMain.handle('add-server', async (_, instance_id, ip, name) => {
    return await addServer(instance_id, ip, name, await getServerImage(ip));
});

async function getServerImage(ip) {
    let ipSplit = ip.split(":");
    let info;
    try {
        info = await queryServer(ipSplit[0], ipSplit[1] ? ipSplit[1] : 25565);
    } catch (e) {
        return null;
    }
    return info.favicon;
}

async function addContent(instance_id, project_type, project_url, filename, data_pack_world, content_id) {
    if (project_type == "server") {
        let v = await addServer(instance_id, project_url, filename, data_pack_world);
        return v;
    }

    let stop_installing_dependencies = false;

    let install_path = "";
    if (project_type == "mod") {
        install_path = path.resolve(user_path, `minecraft/instances/${instance_id}/mods`, filename);
    } else if (project_type == "resourcepack" || project_type == "resource_pack") {
        install_path = path.resolve(user_path, `minecraft/instances/${instance_id}/resourcepacks`, filename);
    } else if (project_type == "shader") {
        install_path = path.resolve(user_path, `minecraft/instances/${instance_id}/shaderpacks`, filename);
    } else if (project_type == "world") {
        install_path = path.resolve(user_path, `minecraft/instances/${instance_id}/temp_worlds`, filename);
    } else if (project_type == "datapack" || project_type == "data_pack") {
        install_path = path.resolve(user_path, `minecraft/instances/${instance_id}/saves/${data_pack_world}/datapacks`, filename);
    }

    console.log("Installing", project_url, "to", install_path);

    if (fs.existsSync(install_path)) {
        stop_installing_dependencies = true;
    }

    await urlToFile(project_url, install_path, {
        onProgress: (p) => {
            win.webContents.send('content-install-update', content_id, p);
        }
    });

    win.webContents.send('content-install-update', content_id, 100);

    if (project_type === "world") {
        const savesPath = path.resolve(user_path, `minecraft/instances/${instance_id}/saves`);
        fs.mkdirSync(savesPath, { recursive: true });
        const zip = new AdmZip(install_path);

        // Get all top-level folders in the zip
        const entries = zip.getEntries();
        const topLevelFolders = new Set();
        entries.forEach(entry => {
            const parts = entry.entryName.split('/');
            if (parts.length > 1) {
                topLevelFolders.add(parts[0]);
            }
        });

        // For each top-level folder, check for conflicts and rename if needed
        const folderRenameMap = {};
        for (const folder of topLevelFolders) {
            let targetFolder = folder;
            let counter = 1;
            while (fs.existsSync(path.join(savesPath, targetFolder))) {
                targetFolder = `${folder}_${counter}`;
                counter++;
            }
            folderRenameMap[folder] = targetFolder;
        }

        // Extract each entry, renaming top-level folders if needed
        for (let i = 0; i < entries.length; i++) {
            let entry = entries[i];
            let entryName = entry.entryName;
            const parts = entryName.split('/');
            if (parts.length > 1 && folderRenameMap[parts[0]]) {
                parts[0] = folderRenameMap[parts[0]];
                entryName = parts.join('/');
            }
            const destPath = path.join(savesPath, entryName);
            if (entry.isDirectory) {
                fs.mkdirSync(destPath, { recursive: true });
            } else {
                fs.mkdirSync(path.dirname(destPath), { recursive: true });
                await fs.promises.writeFile(destPath, entry.getData());
            }
        }

        // Optionally delete the temp world zip after extraction
        fs.unlinkSync(install_path);
        const tempWorldPath = path.resolve(user_path, `minecraft/instances/${instance_id}/temp_worlds`);
        if (fs.existsSync(tempWorldPath)) {
            fs.rmSync(tempWorldPath, { recursive: true, force: true });
        }
    }

    let type_convert = {
        "mod": "mod",
        "resourcepack": "resource_pack",
        "shader": "shader",
        "world": "world",
        "datapack": "data_pack"
    }

    return {
        type: type_convert[project_type],
        file_name: filename,
        stop_installing_dependencies
    };
}

ipcMain.handle('download-cape', async (_, url, id) => {
    if (!url.includes("textures.minecraft.net")) throw new Error("Attempted XSS");
    await urlToFile(url, path.resolve(user_path, `minecraft/capes/${id}.png`));
});

ipcMain.handle('query-server', async (_, host, port) => {
    return await queryServer(host, port);
});

async function addServer(instance_id, ip, title, image) {
    if (!title) title = "Minecraft Server";
    let patha = path.resolve(user_path, `minecraft/instances/${instance_id}`);
    let serversDatPath = path.resolve(patha, 'servers.dat');
    let data = {};
    let serversDatExists = fs.existsSync(serversDatPath);
    if (!serversDatExists) {
        data.parsed = {
            "name": "",
            "type": "compound",
            "value": {
                "servers": {
                    "type": "list",
                    "value": {
                        "type": "compound",
                        "value": []
                    }
                }
            }
        }
    }
    try {
        if (serversDatExists) {
            const buffer = fs.readFileSync(serversDatPath);
            data = await nbt.parse(buffer);
        }
        let servers = data.parsed?.value?.servers?.value?.value || [];

        let iconBase64 = "";
        if (image) {
            let imageBuffer;
            if (image.startsWith('data:image/')) {
                iconBase64 = image.replace(/^data:image\/png;base64,/, '').replace(/^data:image\/[a-zA-Z]+;base64,/, '');
            } else if (image.startsWith('http://') || image.startsWith('https://')) {
                const response = await axios.get(image, { responseType: "arraybuffer" });
                imageBuffer = Buffer.from(response.data);
                iconBase64 = imageBuffer.toString('base64');
            } else if (fs.existsSync(image)) {
                imageBuffer = fs.readFileSync(image);
                iconBase64 = imageBuffer.toString('base64');
            }
        }

        servers.push({
            "icon": {
                "type": "string",
                "value": iconBase64
            },
            "name": {
                "type": "string",
                "value": title
            },
            "ip": {
                "type": "string",
                "value": ip
            },
            "hidden": {
                "type": "byte",
                "value": 0
            }
        });

        data.parsed.value.servers.value.value = servers;

        const newBuffer = nbt.writeUncompressed(data.parsed);
        fs.writeFileSync(serversDatPath, newBuffer);
        return true;
    } catch (e) {
        console.error("Failed to add server to servers.dat:", e);
        return false;
    }
}

ipcMain.handle('get-java-installation', async (_, v) => {
    return await getJavaInstallation(v).replaceAll("\\", "/");
})

async function getJavaInstallation(v) {
    let java = new Java();
    return await java.getJavaInstallation(v);
}

ipcMain.handle('set-java-installation', async (_, v, f) => {
    return await setJavaInstallation(v, f);
})

async function setJavaInstallation(v, f) {
    let java = new Java();
    return await java.setJavaInstallation(v, f);
}

let cancelFunctions = {};
let retryFunctions = {};

function generateNewCancelId() {
    let id = 0;
    do {
        id = Math.floor(Math.random() * 1000000)
    } while (cancelFunctions[id]);
    return id;
}

function generateNewProcessId() {
    return Math.floor(Math.random() * 10000000000);
}

ipcMain.handle('cancel', (_, cancelId) => {
    try {
        cancelFunctions[cancelId].abort("Canceled by User");
        delete cancelFunctions[cancelId];
    } catch (e) { }
});

ipcMain.handle('retry', (_, retryId) => {
    retryFunctions[retryId]();
    delete retryFunctions[retryId];
    delete cancelFunctions[retryId];
});

ipcMain.handle('delete-instance-files', async (_, instance_id) => {
    return await deleteInstanceFiles(instance_id);
});

async function deleteInstanceFiles(instance_id) {
    let processId = generateNewProcessId();
    let cancelId = generateNewCancelId();
    let abortController = new AbortController();
    cancelFunctions[cancelId] = abortController;
    retryFunctions[cancelId] = () => { }
    let signal = abortController.signal;
    const instancePath = path.resolve(user_path, `minecraft/instances/${instance_id}`);
    if (!fs.existsSync(instancePath)) {
        return false;
    }
    // Recursively collect all files and folders for progress calculation
    async function getAllFiles(dir) {
        let files = [];
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                files = files.concat(await getAllFiles(fullPath));
            } else {
                files.push(fullPath);
            }
        }
        return files;
    }
    signal.throwIfAborted();

    try {
        const allFiles = await getAllFiles(instancePath);
        let deleted = 0;
        for (const file of allFiles) {
            await fs.promises.unlink(file);
            deleted++;
            const percent = Math.round((deleted / allFiles.length) * 100);
            signal.throwIfAborted();
            win.webContents.send('progress-update', 'Deleting Instance', percent, `Deleting ${path.basename(file)} (${deleted} of ${allFiles.length})`, processId, "good", cancelId);
        }
        // Remove directories (bottom-up)
        async function removeDirs(dir) {
            const entries = await fs.promises.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    await removeDirs(fullPath);
                }
            }
            await fs.promises.rmdir(dir);
        }
        signal.throwIfAborted();
        await removeDirs(instancePath);
        signal.throwIfAborted();
        win.webContents.send('progress-update', 'Deleting Instance', 100, 'Instance deleted', processId, "done", cancelId);
        return true;
    } catch (err) {
        win.webContents.send('progress-update', 'Deleting Instance', 100, err, processId, "error", cancelId);
        throw err;
    }
}

ipcMain.handle('duplicate-instance-files', async (_, old_instance_id, new_instance_id) => {
    return await duplicateInstanceFiles(old_instance_id, new_instance_id);
});

async function duplicateInstanceFiles(old_instance_id, new_instance_id) {
    let processId = generateNewProcessId();
    let cancelId = generateNewCancelId();
    let abortController = new AbortController();
    cancelFunctions[cancelId] = abortController;
    retryFunctions[cancelId] = () => { }
    let signal = abortController.signal;
    try {
        win.webContents.send('progress-update', `Duplicating Instance`, 0, `Beginning Duplication...`, processId, "good", cancelId);
        const src = path.resolve(user_path, `minecraft/instances/${old_instance_id}`);
        const dest = path.resolve(user_path, `minecraft/instances/${new_instance_id}`);
        if (!fs.existsSync(src)) return false;
        await fs.promises.mkdir(dest, { recursive: true });
        // Get all files and folders in the source directory
        const entries = await fs.promises.readdir(src, { withFileTypes: true });
        const total = entries.length;
        let completed = 0;

        for (const entry of entries) {
            if (entry.name == "logs") continue;
            signal.throwIfAborted();
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);

            if (entry.isDirectory()) {
                await fs.promises.mkdir(destPath, { recursive: true });
                // Recursively copy subdirectory
                const subEntries = await fs.promises.readdir(srcPath, { withFileTypes: true });
                for (const subEntry of subEntries) {
                    const subSrcPath = path.join(srcPath, subEntry.name);
                    const subDestPath = path.join(destPath, subEntry.name);
                    if (subEntry.isDirectory()) {
                        await fs.promises.cp(subSrcPath, subDestPath, { recursive: true, errorOnExist: false, force: true });
                    } else {
                        await fs.promises.copyFile(subSrcPath, subDestPath);
                    }
                }
            } else {
                await fs.promises.copyFile(srcPath, destPath);
            }

            completed++;
            const percent = Math.round((completed / total) * 100);
            signal.throwIfAborted();
            win.webContents.send('progress-update', `Duplicating Instance`, percent, `Copying ${entry.name} (${completed} of ${total})`, processId, "good", cancelId);
        }
        win.webContents.send('progress-update', `Duplicating Instance`, 100, `Done`, processId, "done", cancelId);
        return true;
    } catch (err) {
        win.webContents.send('progress-update', `Duplicating Instance`, 100, err, processId, "error", cancelId);
        throw err;
    }
}

ipcMain.handle('change-folder', async (_, old_path, new_path) => {
    let processId = generateNewProcessId();
    let cancelId = generateNewCancelId();
    let abortController = new AbortController();
    cancelFunctions[cancelId] = abortController;
    retryFunctions[cancelId] = () => { }
    let signal = abortController.signal;
    try {
        let src = path.resolve(old_path);
        let dest = path.resolve(new_path);

        if (src === dest) return false;

        if (!fs.existsSync(src)) return false;
        await fs.promises.mkdir(dest, { recursive: true });
        const entries = await fs.promises.readdir(src, { withFileTypes: true });
        const total = entries.length;
        let completed = 0;

        for (const entry of entries) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);

            const percent = Math.round((completed / total) * 100);
            signal.throwIfAborted();
            win.webContents.send('progress-update', `Moving User Path`, percent, `Copying ${entry.name} (${completed + 1} of ${total})`, processId, "good", cancelId);

            if (entry.isDirectory()) {
                await fs.promises.mkdir(destPath, { recursive: true });
                const subEntries = await fs.promises.readdir(srcPath, { withFileTypes: true });
                for (const subEntry of subEntries) {
                    const subSrcPath = path.join(srcPath, subEntry.name);
                    const subDestPath = path.join(destPath, subEntry.name);
                    if (subEntry.isDirectory()) {
                        await fs.promises.cp(subSrcPath, subDestPath, { recursive: true, errorOnExist: false, force: true });
                    } else {
                        await fs.promises.copyFile(subSrcPath, subDestPath);
                    }
                }
            } else {
                await fs.promises.copyFile(srcPath, destPath);
            }

            completed++;
        }
        signal.throwIfAborted();
        win.webContents.send('progress-update', `Moving User Path`, 100, `Done`, processId, "done", cancelId);

        setUserPathMain(dest, src);
        return true;
    } catch (err) {
        win.webContents.send('progress-update', `Moving User Path`, 100, err, processId, "error", cancelId);
        throw err;
    }
});

ipcMain.handle('import-world', async (_, file_path, instance_id, worldName) => {
    return await importWorld(file_path, instance_id, worldName);
});

async function importWorld(file_path, instance_id, worldName) {
    let processId = generateNewProcessId();
    let cancelId = generateNewCancelId();
    let abortController = new AbortController();
    cancelFunctions[cancelId] = abortController;
    retryFunctions[cancelId] = () => { }
    let signal = abortController.signal;
    try {
        win.webContents.send('progress-update', `Importing ${worldName}`, 0, "Beginning...", processId, "good", cancelId);
        const savesPath = path.resolve(user_path, `minecraft/instances/${instance_id}/saves`);
        fs.mkdirSync(savesPath, { recursive: true });
        signal.throwIfAborted();

        if (fs.existsSync(file_path) && fs.statSync(file_path).isDirectory()) {
            const baseName = path.basename(file_path);
            let targetName = baseName;
            let counter = 1;
            while (fs.existsSync(path.join(savesPath, targetName))) {
                targetName = `${baseName} (${counter})`;
                counter++;
            }
            const destPath = path.join(savesPath, targetName);
            async function collectFiles(dir, base) {
                const entries = await fs.promises.readdir(dir, { withFileTypes: true });
                let files = [];
                for (const entry of entries) {
                    const full = path.join(dir, entry.name);
                    const rel = path.relative(base, full).replace(/\\/g, '/');
                    if (entry.isDirectory()) {
                        files.push({ full, rel, isDirectory: true });
                        const sub = await collectFiles(full, base);
                        files = files.concat(sub);
                    } else if (entry.isFile()) {
                        files.push({ full, rel, isDirectory: false });
                    }
                }
                return files;
            }

            signal.throwIfAborted();
            await fs.promises.mkdir(destPath, { recursive: true });
            const allEntries = await collectFiles(file_path, file_path);

            const dirs = allEntries.filter(e => e.isDirectory);
            for (const d of dirs) {
                const targetDir = path.join(destPath, d.rel);
                await fs.promises.mkdir(targetDir, { recursive: true });
            }

            const files = allEntries.filter(e => !e.isDirectory);
            const total = files.length || 1;
            let done = 0;

            for (const fileEntry of files) {
                const srcFile = fileEntry.full;
                const destFile = path.join(destPath, fileEntry.rel);
                await fs.promises.mkdir(path.dirname(destFile), { recursive: true });

                await fs.promises.copyFile(srcFile, destFile);

                done++;
                const percent = Math.round((done / total) * 95);
                signal.throwIfAborted();
                win.webContents.send('progress-update', `Importing ${worldName}`, percent, `Copying ${done} of ${total}...`, processId, "good", cancelId);
            }

            signal.throwIfAborted();
            win.webContents.send('progress-update', `Importing ${worldName}`, 100, "Done", processId, "done", cancelId);
            return { new_world_path: destPath };
        }

        const ext = path.extname(file_path).toLowerCase();
        if (ext === ".zip" && fs.existsSync(file_path)) {
            const zip = new AdmZip(file_path);
            const entries = zip.getEntries().map(e => ({
                entry: e,
                name: e.entryName.replace(/^\/+/, '')
            }));

            const rootLevel = entries.find(e => e.name === "level.dat");
            if (rootLevel) {
                let baseName = path.basename(file_path, ext);
                let targetName = baseName;
                let counter = 1;
                while (fs.existsSync(path.join(savesPath, targetName))) {
                    targetName = `${baseName} (${counter})`;
                    counter++;
                }
                const destPath = path.join(savesPath, targetName);
                fs.mkdirSync(destPath, { recursive: true });

                let count = 0;
                for (const { entry, name } of entries) {
                    count++;
                    const dest = path.join(destPath, name);
                    if (entry.isDirectory) {
                        fs.mkdirSync(dest, { recursive: true });
                    } else {
                        signal.throwIfAborted();
                        win.webContents.send('progress-update', `Importing ${worldName}`, count / entries.length * 95, `Moving file ${count} of ${entries.length}...`, processId, "good", cancelId);
                        fs.mkdirSync(path.dirname(dest), { recursive: true });
                        await new Promise((resolve) => {
                            fs.writeFile(dest, entry.getData(), () => resolve());
                        });
                    }
                }
                signal.throwIfAborted();
                win.webContents.send('progress-update', `Importing ${worldName}`, 100, "Done", processId, "done", cancelId);
                return { new_world_path: destPath };
            }

            const candidateTopFolders = new Set();
            for (const { name } of entries) {
                if (name.endsWith("/level.dat")) {
                    const parts = name.split("/");
                    if (parts[0]) candidateTopFolders.add(parts[0]);
                }
            }

            if (candidateTopFolders.size > 0) {
                const imported = [];
                let outerCount = 0;
                for (const top of candidateTopFolders) {
                    outerCount++;
                    let targetName = top;
                    let counter = 1;
                    while (fs.existsSync(path.join(savesPath, targetName))) {
                        targetName = `${top} (${counter})`;
                        counter++;
                    }
                    const destPath = path.join(savesPath, targetName);
                    fs.mkdirSync(destPath, { recursive: true });
                    let count = 0;
                    for (const { entry, name } of entries) {
                        count++;
                        if (name === top || name.startsWith(top + "/")) {
                            const rel = name === top ? "" : name.slice(top.length + 1);
                            const dest = rel ? path.join(destPath, rel) : destPath;
                            if (entry.isDirectory) {
                                fs.mkdirSync(dest, { recursive: true });
                            } else {
                                signal.throwIfAborted();
                                win.webContents.send('progress-update', `Importing ${worldName}`, outerCount / candidateTopFolders.size * 95 * count / entries.length, `Moving file ${count} of ${entries.length} (${outerCount} of ${candidateTopFolders.size})...`, processId, "good", cancelId);
                                fs.mkdirSync(path.dirname(dest), { recursive: true });
                                await new Promise((resolve) => {
                                    fs.writeFile(dest, entry.getData(), () => resolve());
                                });
                            }
                        }
                    }
                    signal.throwIfAborted();
                    imported.push(destPath);
                }
                signal.throwIfAborted();
                win.webContents.send('progress-update', `Importing ${worldName}`, 100, "Done", processId, "done", cancelId);
                return { imported };
            }
            signal.throwIfAborted();
            win.webContents.send('progress-update', `Importing ${worldName}`, 100, "Error", processId, "error", cancelId);
            return null;
        }
        signal.throwIfAborted();
        win.webContents.send('progress-update', `Importing ${worldName}`, 100, "Error", processId, "error", cancelId);
        return null;
    } catch (e) {
        win.webContents.send('progress-update', `Importing ${worldName}`, 100, e, processId, "error", cancelId);
        return null;
    }
}

ipcMain.handle('download-update', async (_, download_url, new_version, checksum) => {
    return await downloadUpdate(download_url, new_version, checksum);
});

async function downloadUpdate(download_url, new_version, checksum) {
    let processId = generateNewProcessId();
    let cancelId = generateNewCancelId();
    let abortController = new AbortController();
    cancelFunctions[cancelId] = abortController;
    retryFunctions[cancelId] = () => { }
    let signal = abortController.signal;
    try {
        win.webContents.send('progress-update', `Downloading Update`, 0, "Beginning download...", processId, "good", cancelId);
        let tempDir = path.resolve(user_path, "temp", new_version);
        fs.mkdirSync(tempDir, { recursive: true });

        const zipPath = path.join(tempDir, "update.zip");
        signal.throwIfAborted();

        const response = await axios.get(download_url, {
            responseType: "arraybuffer",
            onDownloadProgress: (progressEvent) => {
                const percentCompleted = progressEvent.loaded * 80 / progressEvent.total;
                signal.throwIfAborted();
                win.webContents.send('progress-update', `Downloading Update`, percentCompleted, "Downloading .zip file...", processId, "good", cancelId);
            }
        });
        let data = Buffer.from(response.data);
        fs.writeFileSync(zipPath, data);
        signal.throwIfAborted();

        try {
            let hash = crypto.createHash('sha256')
                .update(data)
                .digest('hex');
            if ("sha256:" + hash != checksum) throw new Error();
        } catch (e) {
            fs.unlinkSync(zipPath);
            win.webContents.send('progress-update', `Downloading Update`, 100, "Failed to verify download.", processId, "error", cancelId);
            throw new Error("Failed to verify download. Stopping update.");
        }

        const zip = new AdmZip(zipPath);
        signal.throwIfAborted();

        const prev = process.noAsar;
        process.noAsar = true;

        win.webContents.send('progress-update', `Downloading Update`, 80, "Extracting .zip file...", processId, "good", cancelId);

        await new Promise((resolve, reject) => {
            zip.extractAllToAsync(tempDir, true, false, (v) => {
                if (v) reject(v);
                else resolve("");
            })
        });
        signal.throwIfAborted();

        process.noAsar = prev;

        fs.unlinkSync(zipPath);
        signal.throwIfAborted();

        win.webContents.send('progress-update', `Downloading Update`, 100, "Done!", processId, "done", cancelId);

        let updaterPath = path.join(user_path, "updater", "updater.exe");
        if (os.platform() != 'win32') updaterPath = path.join(user_path, "updater", "updater");
        let sourceDir = path.resolve(tempDir);
        if (os.platform() != 'win32' && os.platform() != 'darwin') {
            sourceDir = path.join(sourceDir, fs.readdirSync(sourceDir)[0]);
        }
        const targetDir = path.dirname(process.execPath);
        const exeToLaunch = process.execPath;
        const oldPid = process.pid.toString();

        spawn(updaterPath, [sourceDir, targetDir, exeToLaunch, oldPid], {
            detached: true,
            stdio: "ignore"
        }).unref();
    } catch (err) {
        win.webContents.send('progress-update', `Downloading Update`, 100, err, processId, "error", cancelId);
        throw err;
    }
}

ipcMain.handle('trigger-microsoft-login', async () => {
    let iconExt = "png";
    if (os.platform() == 'win32') iconExt = "ico";
    if (os.platform() == 'darwin') iconExt = "icns";
    let date = new Date();
    date.setHours(date.getHours() + 1);
    const authManager = new Auth("select_account");
    const xboxManager = await authManager.launch("electron", {
        width: 500,
        height: 600,
        resizable: true,
        icon: path.join(__dirname, 'resources/icons/icon.' + iconExt),
        parent: win,
        modal: true,
        alwaysOnTop: true,
        backgroundColor: "#0a0a0a",
        center: true,
        suppress: true
    });
    const token = await xboxManager.getMinecraft();
    return {
        "access_token": token.mcToken,
        "uuid": token.profile.id,
        "refresh_token": token.parent.msToken.refresh_token,
        "capes": token.profile.capes,
        "skins": token.profile.skins,
        "name": token.profile.name,
        "is_demo": token.profile.demo ?? false,
        "xuid": token.xuid,
        "client_id": getUUID(),
        "expires": date
    }
});

ipcMain.handle('get-new-access-token', async (refresh_token) => {
    return await getNewAccessToken(refresh_token);
});