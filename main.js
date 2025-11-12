const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const RPC = require('discord-rpc');
const windowStateKeeper = require('electron-window-state');
const fs = require('fs');
const AdmZip = require('adm-zip');
const nbt = require('prismarine-nbt');
const zlib = require('zlib');

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
    return allWorlds.slice(0, 5);
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

ipcMain.handle('get-instance-content', (_, loader, instance_id, old_content) => {
    let old_files = old_content.map((e) => e.file_name);
    let patha = path.resolve(user_path, `minecraft/instances/${instance_id}/mods`);
    let pathb = path.resolve(user_path, `minecraft/instances/${instance_id}/resourcepacks`);
    let pathc = path.resolve(user_path, `minecraft/instances/${instance_id}/shaderpacks`);
    fs.mkdirSync(patha, { recursive: true });
    fs.mkdirSync(pathb, { recursive: true });
    fs.mkdirSync(pathc, { recursive: true });
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
        let modJson = {};
        try {
            const zip = fs.readFileSync(filePath);

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
            image: modJson?.icon ?? ""
        };
    }).filter(Boolean);
    const resourcepacks = fs.readdirSync(pathb).map(file => {
        if (old_files.includes(file)) {
            old_files[old_files.indexOf(file)] = null;
            return null;
        }
        const filePath = path.resolve(pathb, file);
        if (path.extname(file).toLowerCase() !== '.zip' && (path.extname(file).toLowerCase() !== '.disabled' || !file.includes(".zip.disabled"))) {
            return null;
        }
        let packMcMeta = null;
        try {
            const zip = fs.readFileSync(filePath);

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
            image: packMcMeta?.icon ?? ""
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
        return {
            type: 'shader',
            name: file.replace(".zip.disabled", ".zip"),
            source: "player_install",
            file_name: file,
            version: "",
            disabled: file.includes(".zip.disabled"),
            author: "",
            image: ""
        };
    });
    let deleteFromContent = old_files.filter(e => e);
    return {
        "newContent": [...mods, ...resourcepacks, ...shaderpacks].filter(e => e),
        "deleteContent": deleteFromContent
    }
});