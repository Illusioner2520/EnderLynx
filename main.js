const { app, BrowserWindow, ipcMain, dialog, Menu, shell, nativeImage } = require('electron');
const path = require('path');
const RPC = require('discord-rpc');
const windowStateKeeper = require('electron-window-state');
const fs = require('fs');
const fsPromises = require('fs/promises');
const AdmZip = require('adm-zip');
const nbt = require('prismarine-nbt');
const zlib = require('zlib');
const toml = require('toml');
const pLimit = require('p-limit').default;
const { Minecraft, Java, Fabric, urlToFile, urlToFolder, Forge, NeoForge, Quilt } = require('./launch.js');
const { queryServer } = require('./servers.js');
const { Auth } = require('msmc');
const querystring = require('querystring');
const https = require('https');
const stringArgv = require('string-argv').default;
const crypto = require('crypto');
const { spawn, exec } = require('child_process');
const { version } = require('./package.json');
const os = require('os');
const sharp = require("sharp");
const FormData = require('form-data');
const createDesktopShortcut = require("create-desktop-shortcuts");
const pngToIco = require('png-to-ico').default;
const readline = require('readline');
const { JavaSearch } = require('./java_scan.js');
const Database = require('better-sqlite3');

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

const db = new Database(path.resolve(user_path, "app.db"));

db.prepare('CREATE TABLE IF NOT EXISTS instances (id INTEGER PRIMARY KEY, name TEXT, date_created TEXT, date_modified TEXT, last_played TEXT, loader TEXT, vanilla_version TEXT, loader_version TEXT, playtime INTEGER, locked INTEGER, downloaded INTEGER, group_id TEXT, image TEXT, instance_id TEXT UNIQUE, java_version INTEGER, java_path TEXT, current_log_file TEXT, pid INTEGER, install_source TEXT, install_id TEXT, installing INTEGER, mc_installed INTEGER, window_width INTEGER, window_height INTEGER, allocated_ram INTEGER, attempted_options_txt_version INTEGER, java_args TEXT, env_vars TEXT, pre_launch_hook TEXT, post_launch_hook TEXT, wrapper TEXT, post_exit_hook TEXT, installed_version TEXT, last_analyzed_log TEXT, failed INTEGER, uses_custom_java_args INTEGER, provided_java_args TEXT)').run();
db.prepare('CREATE TABLE IF NOT EXISTS profiles (id INTEGER PRIMARY KEY, access_token TEXT, client_id TEXT, expires TEXT, name TEXT, refresh_token TEXT, uuid TEXT, xuid TEXT, is_demo INTEGER, is_default INTEGER)').run();
db.prepare('CREATE TABLE IF NOT EXISTS defaults (id INTEGER PRIMARY KEY, default_type TEXT, value TEXT)').run();
db.prepare('CREATE TABLE IF NOT EXISTS content (id INTEGER PRIMARY KEY, name TEXT, author TEXT, disabled INTEGER, image TEXT, file_name TEXT, source TEXT, type TEXT, version TEXT, version_id TEXT, instance TEXT, source_info TEXT)').run();
db.prepare('CREATE TABLE IF NOT EXISTS skins (id INTEGER PRIMARY KEY, name TEXT, model TEXT, active_uuid TEXT, skin_id TEXT, skin_url TEXT, default_skin INTEGER, texture_key TEXT, favorited INTEGER, last_used TEXT, preview TEXT, preview_model TEXT, head TEXT)').run();
db.prepare('CREATE TABLE IF NOT EXISTS capes (id INTEGER PRIMARY KEY, uuid TEXT, cape_name TEXT, cape_id TEXT, cape_url TEXT, active INTEGER)').run();
db.prepare('CREATE TABLE IF NOT EXISTS options_defaults (id INTEGER PRIMARY KEY, key TEXT, value TEXT, version TEXT)').run();
db.prepare('CREATE TABLE IF NOT EXISTS pins (id INTEGER PRIMARY KEY, type TEXT, instance_id TEXT, world_id TEXT, world_type TEXT)').run();
db.prepare('CREATE TABLE IF NOT EXISTS mc_versions_cache (id INTEGER PRIMARY KEY, name TEXT, date_published TEXT)').run();
db.prepare('CREATE TABLE IF NOT EXISTS last_played_servers (id INTEGER PRIMARY KEY, instance_id TEXT, ip TEXT, date TEXT)').run();
db.prepare('CREATE TABLE IF NOT EXISTS java_versions (id INTEGER PRIMARY KEY, version INTEGER UNIQUE, file_path TEXT)').run();

db.pragma('journal_mode = WAL');

let defaults = { "default_accent_color": "light_blue", "default_sort": "name", "default_group": "none", "default_page": "home", "default_width": 854, "default_height": 480, "default_ram": 4096, "default_mode": "dark", "default_sidebar": "spacious", "default_sidebar_side": "left", "discord_rpc": "true", "global_env_vars": "", "global_pre_launch_hook": "", "global_post_launch_hook": "", "global_wrapper": "", "global_post_exit_hook": "", "potato_mode": "false", "hide_ip": "false", "saved_version": version, "latest_release": "hello there", "max_concurrent_downloads": 10, "link_with_modrinth": "true", "thin_scrollbars": "false" };

let minecraftVersions = [];

async function moveFiles() {
    if (!fs.existsSync(path.resolve(user_path, "log_config.xml"))) {
        const srcConfigPath = path.resolve(__dirname, "log_config.xml");
        let configData;
        try {
            configData = await fsPromises.readFile(srcConfigPath);
            await fsPromises.writeFile(path.resolve(user_path, "log_config.xml"), configData);
        } catch (e) {
            await fsPromises.writeFileSync(path.resolve(user_path, "log_config.xml"), "");
        }
    }
    let srcConfigPath = path.resolve(__dirname, "updater.exe");
    if (os.platform() != 'win32') srcConfigPath = path.resolve(__dirname, "updater");
    await fsPromises.mkdir(path.resolve(user_path, "updater"), { recursive: true })
    let updaterData;
    try {
        updaterData = await fsPromises.readFile(srcConfigPath);
        let updaterName = "updater.exe";
        if (os.platform() != 'win32') updaterName = "updater";
        await fsPromises.writeFile(path.resolve(user_path, "updater", updaterName), updaterData);
        if (os.platform() != 'win32') {
            await fsPromises.chmod(path.resolve(user_path, "updater", updaterName), 0o755);
        }
    } catch (e) {

    }
}

moveFiles();

let win;

const isDev = !app.isPackaged;

let args = process.argv.slice(1);
let enableDev = args.includes("--debug") || args.find(arg => arg.startsWith('enderlynx://'))?.split("/")?.includes("debug") || isDev;

let dont_launch = false;

function processArgs(args) {
    let instance_id_to_launch = "";
    let world_type_to_launch = "";
    let world_id_to_launch = "";
    let uuid_to_launch = "";

    const instanceArg = args.find(arg => arg.startsWith('--instance='));
    const worldTypeArg = args.find(arg => arg.startsWith('--worldType='));
    const worldIdArg = args.find(arg => arg.startsWith('--worldId='));
    const uuidArg = args.find(arg => arg.startsWith("--profile="));

    if (instanceArg) {
        if (instanceArg) instance_id_to_launch = instanceArg.split('=').slice(1).join('=');
        if (worldTypeArg) world_type_to_launch = worldTypeArg.split('=').slice(1).join('=');
        if (worldIdArg) world_id_to_launch = worldIdArg.split('=').slice(1).join('=');
        if (uuidArg) uuid_to_launch = uuidArg.split('=').slice(1).join('=');
    }

    let argsFromUrl = args.find(arg => arg.startsWith('enderlynx://'));
    if (argsFromUrl) argsFromUrl = argsFromUrl.split("/").slice(2);
    else argsFromUrl = [];
    argsFromUrl = argsFromUrl.map(decodeURIComponent);
    if (argsFromUrl.includes("debug")) {
        argsFromUrl.splice(argsFromUrl.indexOf("debug"), 1);
    }

    dont_launch = args.includes("--noLaunch");
    if (argsFromUrl.includes("noLaunch")) {
        dont_launch = true;
        argsFromUrl.splice(argsFromUrl.indexOf("noLaunch"), 1);
    }

    if (argsFromUrl[0] == "launch") {
        if (argsFromUrl[1]) instance_id_to_launch = argsFromUrl[1];
        if (argsFromUrl[2]) world_type_to_launch = argsFromUrl[2];
        if (argsFromUrl[3]) world_id_to_launch = argsFromUrl[3];
        if (argsFromUrl[4]) uuid_to_launch = argsFromUrl[4];
    }

    launchGameFromArgs(instance_id_to_launch, world_type_to_launch, world_id_to_launch, uuid_to_launch);

    const installArg = args.find(arg => arg.startsWith("--install="));
    const installSourceArg = args.find(arg => arg.startsWith("--source="));

    let installInfo = {};

    if (installArg) {
        let id = installArg.split("=").slice(1).join('=');
        installInfo = {
            id,
            source: installSourceArg ? installSourceArg.split("=").slice(1).join("=") : (isNaN(Number(id)) ? "modrinth" : "curseforge")
        }
    }

    if (argsFromUrl[0] == "install") {
        let id = argsFromUrl[1];
        installInfo = {
            id,
            source: argsFromUrl[2] ? argsFromUrl[2] : (isNaN(Number(id)) ? "modrinth" : "curseforge")
        }
    }

    let startingPage = args.find(arg => arg.startsWith('--page='));
    if (startingPage) startingPage = startingPage.split("=")[1];

    if (argsFromUrl[0] == "page") {
        if (argsFromUrl[1]) startingPage = argsFromUrl[1];
    }

    let sendToWindow = {
        instance_id: instance_id_to_launch,
        world: Boolean(world_type_to_launch),
        installInfo,
        page: startingPage
    }
    return sendToWindow;
}

async function launchGameFromArgs(instance_id_to_launch, world_type_to_launch, world_id_to_launch, uuid_to_launch) {
    if (!instance_id_to_launch) return;
    try {
        let profile;
        if (uuid_to_launch) {
            profile = getProfileDatabase(uuid_to_launch);
        } else {
            profile = getDefaultProfile();
        }
        if (!profile) {
            throw new Error(uuid_to_launch ? translate("app.launch.profile.invalid.uuid", "%u", uuid_to_launch) : translate("app.launch.profile.no.default"));
        }
        let profile_id = profile.id;
        if (world_type_to_launch) {
            await playMinecraft(instance_id_to_launch, profile_id, { "type": world_type_to_launch, "info": world_id_to_launch });
        } else {
            await playMinecraft(instance_id_to_launch, profile_id, {});
        }
        if (dont_launch) app.quit();
    } catch (e) {
        dialog.showErrorBox(translate("app.launch.error"), translate("app.launch.error.description", "%e", e.message));
        if (dont_launch) app.quit();
    }
}

let svgData = fs.readFileSync(path.resolve(__dirname, "resources/default.svg"), 'utf8');
let lang = JSON.parse(fs.readFileSync(path.resolve(__dirname, "resources", "lang", `en-us.json`), 'utf-8'));

ipcMain.on('get-lang', (event) => {
    event.returnValue = lang;
});

function translate(key, ...params) {
    let value = lang[key] ?? key;
    for (let i = 0; i < params.length; i += 2) {
        value = value.replace(params[i], params[i + 1]);
    }
    if (!value) return key;
    return value;
}

ipcMain.handle('translate', (_, key, ...params) => {
    return translate(key, ...params);
});

const createWindow = (sendToWindow = {}) => {
    let additionalArguments = [`--userDataPath=${user_path}`, `--svgData=${svgData}`];
    if (isDev) additionalArguments.push('--dev');
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
        title: translate("app.name"),
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
            spellcheck: false,
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
    if (!enableDev) {
        Menu.setApplicationMenu(null);
    }
    win.webContents.send('arg-info', sendToWindow);
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
        let sendToWindow = processArgs(commandLine);
        if (win && win.webContents) win.webContents.send('arg-info', sendToWindow);
    });

    app.whenReady().then(() => {
        let sendToWindow = processArgs(process.argv);
        if (dont_launch) {
            return;
        }
        app.setAppUserModelId('me.illusioner.enderlynx');
        createWindow(sendToWindow);
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
    return true;
}

ipcMain.on('progress-update', (event, title, progress, desc) => {
    win.webContents.send('progress-update', title, progress, desc);
});

ipcMain.on('display-error', (event, message) => {
    win.webContents.send('display-error', message);
});

ipcMain.handle('show-open-dialog', async (event, options) => {
    if (options?.defaultPath) {
        if (fs.existsSync(options.defaultPath)) {
            const stat = await fsPromises.stat(options.defaultPath);
            if (stat.isFile()) {
                startDir = path.dirname(options.defaultPath);
            }
        }
    }
    const result = await dialog.showOpenDialog(win, options);
    return result;
});

ipcMain.handle('show-save-dialog', async (event, options, file_path) => {
    const result = await dialog.showSaveDialog(win, options);
    if (result.canceled || !result.filePath) return;
    await fsPromises.copyFile(file_path, result.filePath);
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
        let rpc_enabled = getDefault("discord_rpc");
        let enabled = rpc_enabled?.value ? rpc_enabled.value == "true" : true;
        if (!enabled) return;
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
        win.webContents.send('progress-update', translate("app.export.create.elpack"), 0, translate("app.export.manifest"), processId, "good", cancelId);
        const tempDir = path.resolve(user_path, "out");
        fs.mkdirSync(tempDir, { recursive: true });
        const zipPath = path.join(tempDir, `${name.replace(/[<>:"/\\|?*]/g, '_')}_${Date.now()}.elpack`);

        const zip = new AdmZip();

        zip.addFile("manifest.json", Buffer.from(JSON.stringify(manifest, null, 2), "utf-8"));

        for (let i = 0; i < overrides.length; i++) {
            signal.throwIfAborted();
            win.webContents.send('progress-update', translate("app.export.create.elpack"), (i + 1) / overrides.length * 100, translate("app.export.override", "%a", i + 1, "%b", overrides.length), processId, "good", cancelId);
            let override = overrides[i];
            const srcPath = path.resolve(user_path, "minecraft", "instances", instance_id, override);
            const destPath = "overrides/" + override;
            if (fs.existsSync(srcPath)) {
                const stat = fs.statSync(srcPath);
                if (stat.isDirectory()) {
                    async function addDirToZip(dir, zipPath) {
                        const entries = await fsPromises.readdir(dir, { withFileTypes: true });
                        for (const entry of entries) {
                            const entrySrc = path.join(dir, entry.name);
                            const entryDest = path.join(zipPath, entry.name);
                            if (entry.isDirectory()) {
                                await addDirToZip(entrySrc, entryDest);
                            } else {
                                zip.addFile(entryDest.replace(/\\/g, "/"), await fsPromises.readFile(entrySrc));
                            }
                        }
                    }
                    addDirToZip(srcPath, destPath);
                } else {
                    zip.addFile(destPath.replace(/\\/g, "/"), await fsPromises.readFile(srcPath));
                }
            }
        }
        signal.throwIfAborted();

        zip.writeZip(zipPath);
        signal.throwIfAborted();

        win.webContents.send('progress-update', translate("app.export.create.elpack"), 100, translate("app.done"), processId, "done", cancelId);
        win.webContents.send('open-file-share', zipPath);
    } catch (err) {
        win.webContents.send('progress-update', translate("app.export.create.elpack"), 100, err, processId, "error", cancelId);
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
        win.webContents.send('progress-update', translate("app.export.create.mrpack"), 0, translate("app.export.manifest"), processId, "good", cancelId);
        const tempDir = path.resolve(user_path, "out");
        fs.mkdirSync(tempDir, { recursive: true });
        const zipPath = path.join(tempDir, `${name.replace(/[<>:"/\\|?*]/g, '_')}_${Date.now()}.mrpack`);

        const zip = new AdmZip();

        zip.addFile("modrinth.index.json", Buffer.from(JSON.stringify(manifest, null, 2), "utf-8"));
        signal.throwIfAborted();

        for (let i = 0; i < overrides.length; i++) {
            signal.throwIfAborted();
            win.webContents.send('progress-update', translate("app.export.create.mrpack"), (i + 1) / overrides.length * 100, translate("app.export.override", "%a", i + 1, "%b", overrides.length), processId, "good", cancelId);
            let override = overrides[i];
            const srcPath = path.resolve(user_path, "minecraft", "instances", instance_id, override);
            const destPath = "overrides/" + override;
            if (fs.existsSync(srcPath)) {
                const stat = fs.statSync(srcPath);
                if (stat.isDirectory()) {
                    async function addDirToZip(dir, zipPath) {
                        const entries = await fsPromises.readdir(dir, { withFileTypes: true });
                        for (const entry of entries) {
                            const entrySrc = path.join(dir, entry.name);
                            const entryDest = path.join(zipPath, entry.name);
                            if (entry.isDirectory()) {
                                await addDirToZip(entrySrc, entryDest);
                            } else {
                                zip.addFile(entryDest.replace(/\\/g, "/"), await fsPromises.readFile(entrySrc));
                            }
                        }
                    }
                    addDirToZip(srcPath, destPath);
                } else {
                    zip.addFile(destPath.replace(/\\/g, "/"), await fsPromises.readFile(srcPath));
                }
            }
        }
        signal.throwIfAborted();

        zip.writeZip(zipPath);
        signal.throwIfAborted();

        win.webContents.send('progress-update', translate("app.export.create.mrpack"), 100, translate("app.done"), processId, "done", cancelId);
        win.webContents.send('open-file-share', zipPath);
    } catch (err) {
        win.webContents.send('progress-update', translate("app.export.create.mrpack"), 100, err, processId, "error", cancelId);
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
        win.webContents.send('progress-update', translate("app.export.create.zip"), 0, translate("app.export.manifest"), processId, "good", cancelId);
        const tempDir = path.resolve(user_path, "out");
        fs.mkdirSync(tempDir, { recursive: true });
        const zipPath = path.join(tempDir, `${name.replace(/[<>:"/\\|?*]/g, '_')}_${Date.now()}.zip`);

        const zip = new AdmZip();

        zip.addFile("manifest.json", Buffer.from(JSON.stringify(manifest, null, 2), "utf-8"));
        signal.throwIfAborted();

        for (let i = 0; i < overrides.length; i++) {
            signal.throwIfAborted();
            win.webContents.send('progress-update', translate("app.export.create.zip"), (i + 1) / overrides.length * 100, translate("app.export.override", "%a", i + 1, "%b", overrides.length), processId, "good", cancelId);
            let override = overrides[i];
            const srcPath = path.resolve(user_path, "minecraft", "instances", instance_id, override);
            const destPath = "overrides/" + override;
            if (fs.existsSync(srcPath)) {
                const stat = fs.statSync(srcPath);
                if (stat.isDirectory()) {
                    async function addDirToZip(dir, zipPath) {
                        const entries = await fsPromises.readdir(dir, { withFileTypes: true });
                        for (const entry of entries) {
                            const entrySrc = path.join(dir, entry.name);
                            const entryDest = path.join(zipPath, entry.name);
                            if (entry.isDirectory()) {
                                await addDirToZip(entrySrc, entryDest);
                            } else {
                                zip.addFile(entryDest.replace(/\\/g, "/"), await fsPromises.readFile(entrySrc));
                            }
                        }
                    }
                    addDirToZip(srcPath, destPath);
                } else {
                    zip.addFile(destPath.replace(/\\/g, "/"), await fsPromises.readFile(srcPath));
                }
            }
        }
        signal.throwIfAborted();

        zip.writeZip(zipPath);
        signal.throwIfAborted();

        win.webContents.send('progress-update', translate("app.export.create.zip"), 100, translate("app.done"), processId, "done", cancelId);
        win.webContents.send('open-file-share', zipPath);
    } catch (err) {
        win.webContents.send('progress-update', translate("app.export.create.zip"), 100, err, processId, "error", cancelId)
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
        const buffer = await fsPromises.readFile(serversDatPath);
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
        await fsPromises.writeFile(serversDatPath, newBuffer);
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
        const buffer = await fsPromises.readFile(serversDatPath);
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

ipcMain.handle('get-world', async (_, instance_id, world_id) => {
    return await getWorld(path.resolve(user_path, "minecraft", "instances", instance_id, "saves", world_id, "level.dat"));
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
    const buffer = await fsPromises.readFile(levelDatPath);
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
        hardcore: !!levelData.hardcore?.value || !!levelData.difficulty_settings?.value?.hardcore?.value,
        commands: !!levelData.allowCommands?.value,
        difficulty: levelData.difficulty_settings?.value?.difficulty?.value || (() => {
            const diffId = levelData.Difficulty?.value || 2;
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

ipcMain.handle('get-instance-content', async (_, instance_id) => {
    let instance = getInstance(instance_id);
    let loader = instance.loader;
    let old_content = getInstanceContentDatabase(instance_id);
    let link_with_modrinth = getDefault("link_with_modrinth") == "true";
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
                                let resizedBuffer = iconBuffer;
                                try {
                                    resizedBuffer = sharp(iconBuffer).resize({ width: 40, height: 40, fit: "inside" }).toBufferSync();
                                } catch (e) {
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
            const entry_neoforge = admZip.getEntry("META-INF/neoforge.mods.toml");
            if (entry_neoforge) {
                const modsTomlData = entry_neoforge.getData().toString('utf-8');
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
                                let resizedBuffer = iconBuffer;
                                try {
                                    resizedBuffer = sharp(iconBuffer).resize({ width: 40, height: 40, fit: "inside" }).toBufferSync();
                                } catch (e) {
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

ipcMain.handle('process-cf-zip-without-id', async (_, instance_id, zip_path, cf_id, title) => {
    return await processCfZipWithoutID(instance_id, zip_path, title);
});
ipcMain.handle('process-mr-pack', async (_, instance_id, mrpack_path, loader, title) => {
    return await processMrPack(instance_id, mrpack_path, loader, title);
});
ipcMain.handle('process-el-pack', async (_, instance_id, elpack_path, loader, title) => {
    return await processElPack(instance_id, elpack_path, title);
});
ipcMain.handle('process-cf-zip', async (_, instance_id, zip_path, cf_id, title) => {
    return await processCfZip(instance_id, zip_path, cf_id, title);
});

async function processCfZipWithoutID(instance_id, zip_path, title = ".zip file") {
    let max_downloads = getMaxConcurrentDownloads();
    let processId = generateNewProcessId();
    let cancelId = generateNewCancelId();
    let abortController = new AbortController();
    cancelFunctions[cancelId] = abortController;
    retryFunctions[cancelId] = () => {
        processCfZipWithoutID(instance_id, zip_path, title);
    }
    let signal = abortController.signal;
    try {
        win.webContents.send('progress-update', translate("app.installing", "%t", title), 0, translate("app.installing.beginning"), processId, "good", cancelId);
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

        const files = await fsPromises.readdir(srcDir);

        for (const file of files) {
            signal.throwIfAborted();
            win.webContents.send('progress-update', translate("app.installing", "%t", title), 5, translate("app.installing.override", "%o", file), processId, "good", cancelId);
            const srcPath = path.join(srcDir, file);
            const destPath = path.join(destDir, file);

            if (fs.existsSync(destPath)) {
                await fsPromises.rm(srcPath, { recursive: true, force: true });
                continue;
            }
            try {
                await fsPromises.cp(srcPath, destPath, { recursive: true });
                await fsPromises.rm(srcPath, { recursive: true, force: true });
            } catch (err) {
                throw new(translate("app.installing.override.fail", "%o", file));
            }
        }

        let manifest_json = await fsPromises.readFile(path.resolve(extractToPath, "manifest.json"));
        manifest_json = JSON.parse(manifest_json);

        let content = [];
        let project_ids = [];

        const limit = pLimit(max_downloads);

        let allocated_ram = manifest_json.minecraft?.recommendedRam;

        signal.throwIfAborted();
        win.webContents.send('progress-update', translate("app.installing", "%t", title), 10, translate("app.installing.downloading", "%a", 1, "%b", manifest_json.files.length), processId, "good", cancelId);

        let count = 0;

        const downloadPromises = manifest_json.files.map((file, i) => limit(async () => {
            signal.throwIfAborted();
            win.webContents.send('progress-update', translate("app.installing", "%t", title), ((i + 1) / manifest_json.files.length) * 84 + 10, translate("app.installing.downloading", "%a", i+1, "%b", manifest_json.files.length), processId, "good", cancelId);

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
                win.webContents.send('progress-update', translate("app.installing", "%t", title), 95, translate("app.installing.metadata"), processId, "good", cancelId);
            } else {
                win.webContents.send('progress-update', translate("app.installing", "%t", title), ((count + 2) / manifest_json.files.length) * 84 + 10, translate("app.installing.downloading", "%a", count + 1, "%b", manifest_json.files.length), processId, "good", cancelId);
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
        win.webContents.send('progress-update', translate("app.installing", "%t", title), 100, translate("app.done"), processId, "done", cancelId);
        return ({
            "loader_version": manifest_json.minecraft.modLoaders[0].id.split("-")[1],
            "content": cfData.length ? content : [],
            "loader": manifest_json.minecraft.modLoaders[0].id.split("-")[0],
            "vanilla_version": manifest_json.minecraft.version,
            "allocated_ram": allocated_ram,
            "name": manifest_json.name
        });
    } catch (err) {
        win.webContents.send('progress-update', translate("app.installing", "%t", title), 100, err, processId, "error", cancelId);
        return { "error": true };
    }
}
async function processMrPack(instance_id, mrpack_path, loader, title = ".mrpack file") {
    let max_downloads = getMaxConcurrentDownloads();
    let processId = generateNewProcessId();
    let cancelId = generateNewCancelId();
    let abortController = new AbortController();
    cancelFunctions[cancelId] = abortController;
    retryFunctions[cancelId] = () => {
        processMrPack(instance_id, mrpack_path, loader, title);
    }
    let signal = abortController.signal;
    try {
        win.webContents.send('progress-update', translate("app.installing", "%t", title), 0, translate("app.installing.beginning"), processId, "good", cancelId);
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
        let srcDir2 = path.resolve(user_path, `minecraft/instances/${instance_id}/client-overrides`);
        let destDir = path.resolve(user_path, `minecraft/instances/${instance_id}`);

        fs.mkdirSync(srcDir, { recursive: true });
        fs.mkdirSync(srcDir2, { recursive: true });
        signal.throwIfAborted();

        let files = (await fsPromises.readdir(srcDir)).map(e => ({ dir: srcDir, name: e }));
        files = files.concat((await fsPromises.readdir(srcDir2)).map(e => ({ dir: srcDir2, name: e })));

        for (const file of files) {
            win.webContents.send('progress-update', translate("app.installing", "%t", title), 5, translate("app.installing.override", "%o", file.name), processId, "good", cancelId);
            const srcPath = path.join(file.dir, file.name);
            const destPath = path.join(destDir, file.name);

            if (fs.existsSync(destPath)) {
                await fsPromises.rm(srcPath, { recursive: true, force: true });
                continue;
            }

            try {
                await fsPromises.cp(srcPath, destPath, { recursive: true });
                await fsPromises.rm(srcPath, { recursive: true, force: true });
            } catch (err) {
                throw new(translate("app.installing.override.fail", "%o", file.name));
            }
            signal.throwIfAborted();
        }

        let modrinth_index_json = await fsPromises.readFile(path.resolve(extractToPath, "modrinth.index.json"));
        modrinth_index_json = JSON.parse(modrinth_index_json);

        let content = [];

        let project_ids = [];
        let version_hashes = [];
        let team_ids = [];
        let team_to_project_ids = {};

        const limit = pLimit(max_downloads);
        signal.throwIfAborted();

        win.webContents.send('progress-update', translate("app.installing", "%t", title), 10, translate("app.installing.downloading", "%a", 1, "%b", modrinth_index_json.files.length), processId, "good", cancelId);

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
                    win.webContents.send('progress-update', translate("app.installing", "%t", title), 95, translate("app.installing.metadata"), processId, "good", cancelId);
                } else {
                    win.webContents.send('progress-update', translate("app.installing", "%t", title), ((count + 2) / modrinth_index_json.files.length) * 84 + 10, translate("app.installing.downloading", "%a", count + 1, "%b", modrinth_index_json.files.length), processId, "good", cancelId);
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
        win.webContents.send('progress-update', translate("app.installing", "%t", title), 100, translate("app.done"), processId, "done", cancelId);
        return ({
            "loader_version": modrinth_index_json.dependencies[loader],
            "content": content,
            "loader": loader.replace("-loader", ""),
            "vanilla_version": modrinth_index_json.dependencies["minecraft"],
            "name": modrinth_index_json.name
        })
    } catch (err) {
        console.log(err);
        win.webContents.send('progress-update', translate("app.installing", "%t", title), 100, err, processId, "error", cancelId);
        return { "error": true };
    }
}
async function processElPack(instance_id, elpack_path, title = ".elpack file") {
    let max_downloads = getMaxConcurrentDownloads();
    let processId = generateNewProcessId();
    let cancelId = generateNewCancelId();
    let abortController = new AbortController();
    cancelFunctions[cancelId] = abortController;
    retryFunctions[cancelId] = () => {
        processElPack(instance_id, elpack_path, title);
    }
    let signal = abortController.signal;
    try {
        win.webContents.send('progress-update', translate("app.installing", "%t", title), 0, translate("app.installing.beginning"), processId, "good", cancelId);
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

        const files = await fsPromises.readdir(srcDir);

        for (const file of files) {
            signal.throwIfAborted();
            win.webContents.send('progress-update', translate("app.installing", "%t", title), 5, translate("app.installing.override", "%o", file), processId, "good", cancelId);
            const srcPath = path.join(srcDir, file);
            const destPath = path.join(destDir, file);

            if (fs.existsSync(destPath)) {
                await fsPromises.rm(srcPath, { recursive: true, force: true });
                continue;
            }

            try {
                await fsPromises.cp(srcPath, destPath, { recursive: true });
                await fsPromises.rm(srcPath, { recursive: true, force: true });
            } catch (err) {
                throw new(translate("app.installing.override.fail", "%o", file));
            }
        }

        let manifest_json = await fsPromises.readFile(path.resolve(extractToPath, "manifest.json"));
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
        win.webContents.send('progress-update', translate("app.installing", "%t", title), 10, translate("app.installing.downloading", "%a", 1, "%b", manifest_json.files.length), processId, "good", cancelId);

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
                    win.webContents.send('progress-update', translate("app.installing", "%t", title), 95, translate("app.installing.metadata"), processId, "good", cancelId);
                } else {
                    win.webContents.send('progress-update', translate("app.installing", "%t", title), ((count + 2) / manifest_json.files.length) * 84 + 10, translate("app.installing.downloading", "%a", count + 1, "%b", manifest_json.files.length), processId, "good", cancelId);
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
                    content.forEach((item) => {
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
        win.webContents.send('progress-update', translate("app.installing", "%t", title), 100, translate("app.done"), processId, "done", cancelId);
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
        win.webContents.send('progress-update', translate("app.installing", "%t", title), 100, err, processId, "error", cancelId);
        return { "error": true };
    }
}
async function processCfZip(instance_id, zip_path, cf_id, title = ".zip file") {
    let max_downloads = getMaxConcurrentDownloads();
    let processId = generateNewProcessId();
    let cancelId = generateNewCancelId();
    let abortController = new AbortController();
    cancelFunctions[cancelId] = abortController;
    retryFunctions[cancelId] = () => {
        processCfZip(instance_id, zip_path, cf_id, title);
    }
    let signal = abortController.signal;
    try {
        win.webContents.send('progress-update', translate("app.installing", "%t", title), 0, translate("app.installing.beginning"), processId, "good", cancelId);
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

        const files = await fsPromises.readdir(srcDir);

        for (const file of files) {
            signal.throwIfAborted();
            win.webContents.send('progress-update', translate("app.installing", "%t", title), 5, translate("app.installing.override", "%o", file), processId, "good", cancelId);
            const srcPath = path.join(srcDir, file);
            const destPath = path.join(destDir, file);

            if (fs.existsSync(destPath)) {
                await fsPromises.rm(srcPath, { recursive: true, force: true });
                continue;
            }
            try {
                await fsPromises.cp(srcPath, destPath, { recursive: true });
                await fsPromises.rm(srcPath, { recursive: true, force: true });
            } catch (err) {
                throw new(translate("app.installing.override.fail", "%o", file));
            }
        }

        let manifest_json = await fsPromises.readFile(path.resolve(extractToPath, "manifest.json"));
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
        win.webContents.send('progress-update', translate("app.installing", "%t", title), 10, translate("app.installing.downloading", "%a", 1, "%b", manifest_json.files.length), processId, "good", cancelId);

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
                win.webContents.send('progress-update', translate("app.installing", "%t", title), 95, translate("app.installing.metadata"), processId, "good", cancelId);
            } else {
                win.webContents.send('progress-update', translate("app.installing", "%t", title), ((count + 2) / manifest_json.files.length) * 84 + 10, `Downloading file ${count + 2} of ${manifest_json.files.length}`, processId, "good", cancelId);
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
        win.webContents.send('progress-update', translate("app.installing", "%t", title), 100, translate("app.done"), processId, "done", cancelId);
        return ({
            "loader_version": manifest_json.minecraft.modLoaders[0].id.split("-")[1],
            "content": content,
            "loader": manifest_json.minecraft.modLoaders[0].id.split("-")[0],
            "vanilla_version": manifest_json.minecraft.version,
            "allocated_ram": allocated_ram,
            "name": manifest_json.name
        })
    } catch (err) {
        win.webContents.send('progress-update', translate("app.installing", "%t", title), 100, err, processId, "error", cancelId);
        return { "error": true };
    }
}

ipcMain.handle('play-minecraft', async (_, instance_id, player_id, quickPlay) => {
    return await playMinecraft(instance_id, player_id, quickPlay);
});

async function playMinecraft(instance_id, player_id, quickPlay) {
    let player_info = getProfileFromId(player_id);
    let instance_info = getInstance(instance_id);
    if (!instance_info) {
        throw new Error(translate("app.launch.unable_to_find_instance"));
    }
    updateInstance("last_played", new Date(), instance_id);
    if (!player_id) throw new Error(translate("app.launch.sign_in"));

    if (new Date(player_info.expires) < new Date()) {
        try {
            player_info = await getNewAccessToken(player_info.refresh_token);
        } catch (err) {
            if (win) win.webContents.send('display-error', translate("app.launch.access_token.offline"));
        }
    }
    let mc = new Minecraft(instance_id, instance_info.name, db, user_path, win, translate);
    let globalEnvVars = getDefault("global_env_vars");
    let globalPreLaunch = getDefault("global_pre_launch_hook");
    let globalPostLaunch = getDefault("global_post_launch_hook");
    let globalWrapper = getDefault("global_wrapper");
    let globalPostExit = getDefault("global_post_exit_hook");
    try {
        await fixProfile(player_info);
        let minecraft = await mc.launchGame(instance_info.loader, instance_info.vanilla_version, instance_info.loader_version, player_info.name, player_info.uuid, {
            "accessToken": player_info.access_token,
            "xuid": player_info.xuid,
            "clientId": player_info.client_id
        }, { "width": instance_info.window_width || 854, "height": instance_info.window_height || 480 }, quickPlay, false, instance_info.allocated_ram || 4096, instance_info.java_installation, parseJavaArgs(instance_info.java_args), { ...parseEnvString(globalEnvVars), ...parseEnvString(instance_info.env_vars) }, instance_info.pre_launch_hook, instance_info.post_launch_hook, parseJavaArgs(instance_info.wrapper), instance_info.post_exit_hook, globalPreLaunch, globalPostLaunch, parseJavaArgs(globalWrapper), globalPostExit);
        updateInstance("pid", minecraft.pid, instance_id);
        updateInstance("current_log_file", minecraft.log, instance_id);
        return { minecraft, player_info }
    } catch (err) {
        console.error(err);
        throw new Error(translate("app.launch.unable", err.message));
    }
}

async function fixProfile(player_info) {
    if (player_info.expires instanceof Date) {
        player_info.expires = player_info.expires.toISOString();
    }
    db.prepare("UPDATE profiles SET access_token = ?, client_id = ?, expires = ?, name = ?, refresh_token = ?, xuid = ?, is_demo = ? WHERE uuid = ?").run(player_info.access_token, player_info.client_id, player_info.expires, player_info.name, player_info.refresh_token, player_info.xuid, Number(player_info.is_demo), player_info.uuid);
    if (!player_info.capes || !player_info.skins) return;
    try {
        for (const e of player_info.capes) {
            await downloadCape(e.url, e.id);
            let cape = addCape(e.alias, e.id, e.url, player_info.uuid);
            if (e.state == "ACTIVE") setCapeActive(cape.id);
        }
    } catch (e) {
        win.webContents.send('display-error', translate("app.wardrobe.cape.cache.fail"));
    }
    try {
        for (const e of player_info.skins) {
            let hash = await downloadSkin(e.url);
            let skin = addSkin(translate("app.wardrobe.unnamed"), e.variant == "CLASSIC" ? "wide" : "slim", "", hash.hash, hash.dataUrl, false, new Date(), e.textureKey);
            if (e.state == "ACTIVE") setActiveSkin(player_info.uuid, skin.id);
        }
    } catch (e) {
        win.webContents.send('display-error', translate("app.wardrobe.skin.cache.fail"));
        console.error(e);
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
        let mc = new Minecraft(instance_id, undefined, db, user_path, win, translate);
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
        let mc = new Minecraft(instance_id, undefined, db, user_path, win, translate);
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
        "expires": date.toISOString()
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

    const lines = input.split(/\s+|\n/);

    for (const line of lines) {
        if (!line || !line.includes('=')) continue;
        const [key, ...rest] = line.split('=');
        const value = rest.join('=');
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
    win.webContents.send('progress-update', translate("app.downloading", "%t", title), 0, translate("app.downloading.beginning"), processId, "good", cancelId);
    try {
        await urlToFile(url, path.resolve(user_path, `minecraft/instances/${instance_id}/pack.mrpack`), {
            signal, onProgress: (v) => {
                win.webContents.send('progress-update', translate("app.downloading", "%t", title), v, translate("app.downloading.downloading"), processId, "good", cancelId);
            }
        });
        win.webContents.send('progress-update', translate("app.downloading", "%t", title), 100, translate("app.done"), processId, "done", cancelId);
    } catch (err) {
        win.webContents.send('progress-update', translate("app.downloading", "%t", title), 100, err, processId, "error", cancelId);
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
    win.webContents.send('progress-update', translate("app.downloading", "%t", title), 0, translate("app.downloading.beginning"), processId, "good", cancelId);
    try {
        await urlToFile(url, path.resolve(user_path, `minecraft/instances/${instance_id}/pack.zip`), {
            signal, onProgress: (v) => {
                win.webContents.send('progress-update', translate("app.downloading", "%t", title), v, translate("app.downloading.downloading"), processId, "good", cancelId);
            }
        });
        win.webContents.send('progress-update', translate("app.downloading", "%t", title), 100, translate("app.done"), processId, "done", cancelId);
    } catch (err) {
        win.webContents.send('progress-update', translate("app.downloading", "%t", title), 100, err, processId, "error", cancelId);
        throw err;
    }
}

ipcMain.handle('process-pack-file', async (_, file_path, instance_id, title) => {
    return await processPackFile(file_path, instance_id, title);
});

async function processPackFile(file_path, instance_id, title) {
    if (/^https?:\/\//.test(file_path)) {
        await downloadCurseforgePack(instance_id, file_path, title);
    }
    let extension = path.extname(file_path);
    if (extension == ".mrpack") {
        return await processMrPack(instance_id, file_path, null, title);
    } else if (extension == ".zip") {
        return await processCfZipWithoutID(instance_id, file_path, title);
    } else if (extension == ".elpack") {
        return await processElPack(instance_id, file_path, title);
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
                await fsPromises.writeFile(destPath, entry.getData());
            }
        }

        await fsPromises.unlink(filePath);
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

        const entries = zip.getEntries();
        const topLevelFolders = new Set();
        entries.forEach(entry => {
            const parts = entry.entryName.split('/');
            if (parts.length > 1) {
                topLevelFolders.add(parts[0]);
            }
        });

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
                await fsPromises.writeFile(destPath, entry.getData());
            }
        }

        await fsPromises.unlink(install_path);
        const tempWorldPath = path.resolve(user_path, `minecraft/instances/${instance_id}/temp_worlds`);
        if (fs.existsSync(tempWorldPath)) {
            await fsPromises.rm(tempWorldPath, { recursive: true, force: true });
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
    return await downloadCape(url, id);
});
async function downloadCape(url, id) {
    let capePath = path.resolve(user_path, `minecraft/capes/${id}.png`);
    if (!url.includes("textures.minecraft.net")) throw new Error("Attempted XSS");
    if (fs.existsSync(capePath)) return;
    await urlToFile(url, capePath);
}

ipcMain.handle('query-server', async (_, host, port) => {
    return await queryServer(host, port);
});

async function addServer(instance_id, ip, title, image) {
    if (!title) title = translate("app.server.name.default");
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
            const buffer = await fsPromises.readFile(serversDatPath);
            data = await nbt.parse(buffer);
        }
        let servers = data.parsed?.value?.servers?.value?.value || [];

        let iconBase64 = "";
        if (image) {
            let imageBuffer;
            if (image.startsWith('data:image/')) {
                iconBase64 = image.replace(/^data:image\/png;base64,/, '').replace(/^data:image\/[a-zA-Z]+;base64,/, '');
            } else if (image.startsWith('http://') || image.startsWith('https://')) {
                const response = await fetch(image);
                if (response.ok) {
                    const arrayBuffer = await response.arrayBuffer();
                    const imageBuffer = Buffer.from(arrayBuffer);
                    iconBase64 = imageBuffer.toString('base64');
                }
            } else if (fs.existsSync(image)) {
                imageBuffer = await fsPromises.readFile(image);
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
        await fsPromises.writeFile(serversDatPath, newBuffer);
        return true;
    } catch (e) {
        console.error("Failed to add server to servers.dat:", e);
        return false;
    }
}

ipcMain.handle('get-java-installation', async (_, v) => {
    return (await getJavaInstallation(v)).replaceAll("\\", "/");
})

async function getJavaInstallation(v) {
    let java = new Java(db, user_path, win, translate);
    return await java.getJavaInstallation(v);
}

ipcMain.handle('set-java-installation', async (_, v, f) => {
    return await setJavaInstallation(v, f);
})

async function setJavaInstallation(v, f) {
    let java = new Java(db, user_path, win, translate);
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
        cancelFunctions[cancelId].abort(translate("app.user.canceled"));
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
    async function getAllFiles(dir) {
        let files = [];
        const entries = await fsPromises.readdir(dir, { withFileTypes: true });
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
            await fsPromises.unlink(file);
            deleted++;
            const percent = Math.round((deleted / allFiles.length) * 100);
            signal.throwIfAborted();
            win.webContents.send('progress-update', translate("app.instance.deleting"), percent, translate("app.instances.deleting.progress", "%f", path.basename(file), "%a", deleted, "%b", allFiles.length), processId, "good", cancelId);
        }
        async function removeDirs(dir) {
            const entries = await fsPromises.readdir(dir, { withFileTypes: true });
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    await removeDirs(fullPath);
                }
            }
            await fsPromises.rmdir(dir);
        }
        signal.throwIfAborted();
        await removeDirs(instancePath);
        signal.throwIfAborted();
        win.webContents.send('progress-update', translate("app.instance.deleting"), 100, translate("app.instance.deleting.done"), processId, "done", cancelId);
        return true;
    } catch (err) {
        win.webContents.send('progress-update', translate("app.instance.deleting"), 100, err, processId, "error", cancelId);
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
        win.webContents.send('progress-update', translate("app.instance.duplicating"), 0, translate("app.instance.duplicating.beginning"), processId, "good", cancelId);
        const src = path.resolve(user_path, `minecraft/instances/${old_instance_id}`);
        const dest = path.resolve(user_path, `minecraft/instances/${new_instance_id}`);
        if (!fs.existsSync(src)) return false;
        await fsPromises.mkdir(dest, { recursive: true });
        const entries = await fsPromises.readdir(src, { withFileTypes: true });
        const total = entries.length;
        let completed = 0;

        for (const entry of entries) {
            const percent = Math.round(((completed + 1) / total) * 100);
            win.webContents.send('progress-update', translate("app.instance.duplicating"), percent, translate("app.instance.duplicating.progress", "%f", entry.name, "%a", completed, "%b", total), processId, "good", cancelId);
            if (entry.name == "logs") continue;
            signal.throwIfAborted();
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);

            if (entry.isDirectory()) {
                await fsPromises.cp(srcPath, destPath, { recursive: true, errorOnExist: false, force: true });
            } else {
                await fsPromises.copyFile(srcPath, destPath);
            }

            completed++;
            signal.throwIfAborted();
        }
        win.webContents.send('progress-update', translate("app.instance.duplicating"), 100, translate("app.done"), processId, "done", cancelId);
        return true;
    } catch (err) {
        win.webContents.send('progress-update', translate("app.instance.duplicating"), 100, err, processId, "error", cancelId);
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
        await fsPromises.mkdir(dest, { recursive: true });
        const entries = await fsPromises.readdir(src, { withFileTypes: true });
        const total = entries.length;
        let completed = 0;

        for (const entry of entries) {
            const srcPath = path.join(src, entry.name);
            const destPath = path.join(dest, entry.name);

            const percent = Math.round((completed / total) * 100);
            signal.throwIfAborted();
            win.webContents.send('progress-update', translate("app.user_path.moving"), percent, translate("app.user_path.moving.progress", "%f", entry.name, "%a", completed + 1, "%b", total), processId, "good", cancelId);

            if (entry.isDirectory()) {
                await fsPromises.mkdir(destPath, { recursive: true });
                const subEntries = await fsPromises.readdir(srcPath, { withFileTypes: true });
                for (const subEntry of subEntries) {
                    const subSrcPath = path.join(srcPath, subEntry.name);
                    const subDestPath = path.join(destPath, subEntry.name);
                    if (subEntry.isDirectory()) {
                        await fsPromises.cp(subSrcPath, subDestPath, { recursive: true, errorOnExist: false, force: true });
                    } else {
                        await fsPromises.copyFile(subSrcPath, subDestPath);
                    }
                }
            } else {
                await fsPromises.copyFile(srcPath, destPath);
            }

            completed++;
        }
        signal.throwIfAborted();
        win.webContents.send('progress-update', translate("app.user_path.moving"), 100, translate("app.done"), processId, "done", cancelId);

        setUserPathMain(dest, src);
        return true;
    } catch (err) {
        win.webContents.send('progress-update', translate("app.user_path.moving"), 100, err, processId, "error", cancelId);
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
        win.webContents.send('progress-update', translate("app.world.importing", "%w", worldName), 0, translate("app.world.importing.beginning"), processId, "good", cancelId);
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
                const entries = await fsPromises.readdir(dir, { withFileTypes: true });
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
            await fsPromises.mkdir(destPath, { recursive: true });
            const allEntries = await collectFiles(file_path, file_path);

            const dirs = allEntries.filter(e => e.isDirectory);
            for (const d of dirs) {
                const targetDir = path.join(destPath, d.rel);
                await fsPromises.mkdir(targetDir, { recursive: true });
            }

            const files = allEntries.filter(e => !e.isDirectory);
            const total = files.length || 1;
            let done = 0;

            for (const fileEntry of files) {
                const srcFile = fileEntry.full;
                const destFile = path.join(destPath, fileEntry.rel);
                await fsPromises.mkdir(path.dirname(destFile), { recursive: true });

                await fsPromises.copyFile(srcFile, destFile);

                done++;
                const percent = Math.round((done / total) * 95);
                signal.throwIfAborted();
                win.webContents.send('progress-update', translate("app.world.importing", "%w", worldName), percent, translate("app.world.importing.progress", "%a", done, "%b", total), processId, "good", cancelId);
            }

            signal.throwIfAborted();
            win.webContents.send('progress-update', translate("app.world.importing", "%w", worldName), 100, translate("app.done"), processId, "done", cancelId);
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
                        win.webContents.send('progress-update', translate("app.world.importing", "%w", worldName), count / entries.length * 95, translate("app.world.importing.progress", "%a", count, "%b", entries.length), processId, "good", cancelId);
                        fs.mkdirSync(path.dirname(dest), { recursive: true });
                        await fsPromises.writeFile(dest, entry.getData());
                    }
                }
                signal.throwIfAborted();
                win.webContents.send('progress-update', translate("app.world.importing", "%w", worldName), 100, translate("app.done"), processId, "done", cancelId);
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
                                win.webContents.send('progress-update', translate("app.world.importing", "%w", worldName), outerCount / candidateTopFolders.size * 95 * count / entries.length, translate("app.world.importing.multiple.progress", "%a", count, "%b", entries.length, "%c", outerCount, "%d", candidateTopFolders.size), processId, "good", cancelId);
                                fs.mkdirSync(path.dirname(dest), { recursive: true });
                                await fsPromises.writeFile(dest, entry.getData());
                            }
                        }
                    }
                    signal.throwIfAborted();
                    imported.push(destPath);
                }
                signal.throwIfAborted();
                win.webContents.send('progress-update', translate("app.world.importing", "%w", worldName), 100, translate("app.done"), processId, "done", cancelId);
                return { imported };
            }
            signal.throwIfAborted();
            win.webContents.send('progress-update', translate("app.world.importing", "%w", worldName), 100, "Error", processId, "error", cancelId);
            return null;
        }
        signal.throwIfAborted();
        win.webContents.send('progress-update', translate("app.world.importing", "%w", worldName), 100, "Error", processId, "error", cancelId);
        return null;
    } catch (e) {
        win.webContents.send('progress-update', translate("app.world.importing", "%w", worldName), 100, e, processId, "error", cancelId);
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
        win.webContents.send('progress-update', translate("app.downloading.update"), 0, translate("app.downloading.beginning"), processId, "good", cancelId);
        let tempDir = path.resolve(user_path, "temp", new_version);
        fs.mkdirSync(tempDir, { recursive: true });

        const zipPath = path.join(tempDir, "update.zip");
        signal.throwIfAborted();

        await urlToFile(download_url, zipPath, {
            signal, onProgress: (percentCompleted) => {
                win.webContents.send('progress-update', translate("app.downloading.update"), percentCompleted, translate("app.downloading.update.zip"), processId, "good", cancelId);
            }
        });

        signal.throwIfAborted();

        try {
            let hash = crypto.createHash('sha256')
                .update(data)
                .digest('hex');
            if ("sha256:" + hash != checksum) throw new Error();
        } catch (e) {
            await fsPromises.unlink(zipPath);
            win.webContents.send('progress-update', translate("app.downloading.update"), 100, translate("app.downloading.update.verify.fail"), processId, "error", cancelId);
            throw new Error("Failed to verify download. Stopping update.");
        }

        const zip = new AdmZip(zipPath);
        signal.throwIfAborted();

        const prev = process.noAsar;
        process.noAsar = true;

        win.webContents.send('progress-update', translate("app.downloading.update"), 80, translate("app.downloading.update.extracting"), processId, "good", cancelId);

        await new Promise((resolve, reject) => {
            zip.extractAllToAsync(tempDir, true, false, (v) => {
                if (v) reject(v);
                else resolve("");
            })
        });
        signal.throwIfAborted();

        process.noAsar = prev;

        await fsPromises.unlink(zipPath);
        signal.throwIfAborted();

        win.webContents.send('progress-update', translate("app.downloading.update"), 100, translate("app.done"), processId, "done", cancelId);

        let updaterPath = path.join(user_path, "updater", "updater.exe");
        if (os.platform() != 'win32') updaterPath = path.join(user_path, "updater", "updater");
        let sourceDir = path.resolve(tempDir);
        if (os.platform() != 'win32' && os.platform() != 'darwin') {
            sourceDir = path.join(sourceDir, (await fsPromises.readdir(sourceDir))[0]);
        }
        const targetDir = path.dirname(process.execPath);
        const exeToLaunch = process.execPath;
        const oldPid = process.pid.toString();

        spawn(updaterPath, [sourceDir, targetDir, exeToLaunch, oldPid], {
            detached: true,
            stdio: "ignore"
        }).unref();
    } catch (err) {
        win.webContents.send('progress-update', translate("app.downloading.update"), 100, err, processId, "error", cancelId);
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
    let info = {
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
    let players = getProfiles().map(e => e.uuid);
    if (!info.access_token) throw new Error();
    if (!info.refresh_token) throw new Error();
    if (!info.client_id) throw new Error();
    if (players.includes(info.uuid)) {
        let player = getProfileDatabase(info.uuid);
        setDefaultProfile(player.id);
        await fixProfile(info);
    } else {
        if (!info.name) {
            win.webContents.send('display-error', translate("app.login_error.no_username"));
            return;
        }
        let newPlayer = addProfile(info.access_token, info.client_id, info.expires, info.name, info.refresh_token, info.uuid, info.xuid, info.is_demo, false);
        setDefaultProfile(newPlayer.id);
        await fixProfile(info);
    }
    return info;
});

ipcMain.handle('get-instance-files', async (_, instance_id) => {
    const dirPath = path.resolve(user_path, "minecraft", "instances", instance_id);
    if (!fs.existsSync(dirPath)) return [];
    return (await getAllFilesRecursive(dirPath)).results;
});

async function getAllFilesRecursive(baseDir, relDir = "", processDatFiles) {
    const absDir = path.join(baseDir, relDir);
    let results = [];
    const entries = await fsPromises.readdir(absDir, { withFileTypes: true });
    if (entries.length == 0) {
        results.push(relDir.replace(/\\/g, "/"));
    }
    let datFileData = {};
    for (const entry of entries) {
        const relPath = path.join(relDir, entry.name);
        if (entry.isDirectory()) {
            let newResults = await getAllFilesRecursive(baseDir, relPath, processDatFiles);
            datFileData = {
                ...datFileData,
                ...newResults.datFileData
            }
            results = results.concat(newResults.results);
        } else {
            try {
                if (processDatFiles && (path.extname(relPath) == ".dat" || path.extname(relPath) == ".dat_old")) {
                    let buffer = await fsPromises.readFile(path.resolve(absDir, entry.name));
                    let data = await nbt.parse(buffer);
                    datFileData[relPath.replace(/\\/g, "/")] = data.parsed;
                }
            } catch (e) { }
            results.push(relPath.replace(/\\/g, "/"));
        }
    }
    console.log(relDir);
    console.log(Object.keys(datFileData));
    return { results, datFileData };
}

ipcMain.handle('get-world-files', async (_, instance_id, world_id) => {
    const dirPath = path.resolve(user_path, "minecraft", "instances", instance_id, "saves", world_id);
    if (!fs.existsSync(dirPath)) return [];
    return await getAllFilesRecursive(dirPath, undefined, true);
});

ipcMain.handle('set-world-dat', async (_, instance_id, world_id, datInfo) => {
    let files = Object.keys(datInfo);
    const worldPath = path.resolve(user_path, "minecraft", "instances", instance_id, "saves", world_id);
    try {
        for (let i = 0; i < files.length; i++) {
            let filePath = path.resolve(worldPath, files[i]);
            const newBuffer = nbt.writeUncompressed(datInfo[files[i]]);
            const newerBuffer = zlib.gzipSync(newBuffer);
            await fsPromises.writeFile(filePath, newerBuffer);
        }
        return true;
    } catch (e) {
        return false;
    }
})

function readElPack(file_path) {
    try {
        const zip = new AdmZip(file_path);
        const manifestEntry = zip.getEntry('manifest.json');
        if (!manifestEntry) return null;
        const manifestData = manifestEntry.getData().toString('utf-8');
        return JSON.parse(manifestData);
    } catch (e) {
        return null;
    }
}
function readMrPack(file_path) {
    try {
        const zip = new AdmZip(file_path);
        const manifestEntry = zip.getEntry('modrinth.index.json');
        if (!manifestEntry) return null;
        const manifestData = manifestEntry.getData().toString('utf-8');
        let jsonData = JSON.parse(manifestData);
        console.log(jsonData);
        let loader = "vanilla";
        let loaders = ["forge", "fabric-loader", "neoforge", "quilt-loader"];
        let keys = Object.keys(jsonData.dependencies)
        for (const key of keys) {
            if (loaders.includes(key)) {
                loader = key;
                break;
            }
        }
        return {
            name: jsonData.name,
            game_version: jsonData.dependencies.minecraft,
            loader: loader.replace("-loader", ""),
            loader_version: jsonData.dependencies[loader],
            image: ""
        };
    } catch (e) {
        return null;
    }
}

function readCfZip(file_path) {
    try {
        const zip = new AdmZip(file_path);
        const manifestEntry = zip.getEntry('manifest.json');
        if (!manifestEntry) return null;
        const manifestData = manifestEntry.getData().toString('utf-8');
        let jsonData = JSON.parse(manifestData);
        let loaderSplit = jsonData.minecraft.modLoaders[0].id.split("-");
        return {
            name: jsonData.name,
            game_version: jsonData.minecraft.version,
            loader: loaderSplit[0],
            loader_version: loaderSplit[1],
            image: ""
        };
    } catch (e) {
        return null;
    }
}

ipcMain.handle('read-elpack', async (_, file_path) => {
    return await readElPack(file_path);
});

ipcMain.handle('read-mrpack', async (_, file_path) => {
    return await readMrPack(file_path);
});

ipcMain.handle('read-cfzip', async (_, file_path) => {
    return await readCfZip(file_path);
});

ipcMain.handle('set-options-txt', async (_, instance_id, content, dont_complete_if_already_exists, dont_add_to_end_if_already_exists) => {
    return await setOptionsTXT(instance_id, content, dont_complete_if_already_exists, dont_add_to_end_if_already_exists);
});

async function setOptionsTXT(instance_id, content, dont_complete_if_already_exists, dont_add_to_end_if_already_exists, callback) {
    const optionsPath = path.resolve(user_path, `minecraft/instances/${instance_id}/options.txt`);
    let alreadyExists = fs.existsSync(optionsPath);
    if (dont_complete_if_already_exists && alreadyExists) {
        if (callback) callback(content.version);
        return content.version;
    }
    if (!alreadyExists) {
        await fsPromises.writeFile(optionsPath, content.content, "utf-8");
        if (callback) callback(content.version);
        return content.version;
    } else {
        let lines = (await fsPromises.readFile(optionsPath, "utf-8")).split(/\r?\n/);
        let version = content.version;
        for (let j = 0; j < content.keys.length; j++) {
            let key = content.keys[j];
            let value = content.values[j];
            let found = false;
            inner: for (let i = 0; i < lines.length; i++) {
                if (lines[i].trim().startsWith(key + ":")) {
                    if (key == "version") {
                        version = Number(lines[i].trim().split(":").slice(1).join(":").trim());
                    }
                    lines[i] = `${key}:${value}`;
                    found = true;
                    break inner;
                }
            }
            if (!found && !dont_add_to_end_if_already_exists) {
                lines.push(`${key}:${value}`);
            }
        }
        await fsPromises.writeFile(optionsPath, lines.filter(Boolean).join("\n"), "utf-8");
        if (callback) callback(version);
        return version;
    }
}

ipcMain.handle('update-options-txt', async (_, instance_id, key, value) => {
    const optionsPath = path.resolve(user_path, `minecraft/instances/${instance_id}/options.txt`);
    let lines = [];
    if (fs.existsSync(optionsPath)) {
        lines = (await fsPromises.readFile(optionsPath, "utf-8")).split(/\r?\n/);
    }
    let found = false;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim().startsWith(key + ":")) {
            lines[i] = `${key}:${value}`;
            found = true;
            break;
        }
    }
    if (!found) {
        lines.push(`${key}:${value}`);
    }
    await fsPromises.writeFile(optionsPath, lines.filter(Boolean).join("\n"), "utf-8");
});

ipcMain.handle('stop-instance', async (_, instance_id) => {
    let instance = getInstance(instance_id);
    let pid = instance.pid;
    if (!pid) return false;
    pid = Number(pid);

    let done = await new Promise((resolve, reject) => {
        exec(os.platform() == 'win32' ? `taskkill /PID ${pid} /T` : `kill -TERM -${pid}`, (error) => {
            let elapsed = 0;
            const interval = setInterval(() => {
                if (!checkForProcess(pid)) {
                    clearInterval(interval);
                    return resolve(true);
                }

                elapsed += 500;
                if (elapsed >= 5000) {
                    clearInterval(interval);
                    exec(os.platform() == 'win32' ? `taskkill /PID ${pid} /T /F` : `kill -KILL -${pid}`, (forceError) => {
                        if (forceError) {
                            reject("failed to kill process");
                            return;
                        }
                        const stillAlive = checkForProcess(pid);
                        resolve(!stillAlive);
                    });
                }
            }, 500);
        });
    });

    if (done) updateInstance("pid", null, instance_id);
    return done;
});

function checkForProcess(pid) {
    if (!pid) return false;
    try {
        process.kill(pid, 0);
        return true;
    } catch (err) {
        if (err.code === 'ESRCH') {
            return false;
        } else if (err.code === 'EPERM') {
            return true;
        }
        throw err;
    }
}

ipcMain.handle('get-instance-logs', async (_, instance_id) => {
    let patha = path.resolve(user_path, `minecraft/instances/${instance_id}/logs`);
    fs.mkdirSync(patha, { recursive: true });
    let dirInfo = await fsPromises.readdir(patha);
    return dirInfo.filter(e => e.includes(".log") && !e.includes("latest") && !e.includes(".gz")).map(e => {
        let date = e.replace(".log", "").split("_");
        if (date[1]) date[1] = date[1].replaceAll("-", ":");
        let dateStr = date.join(" ");
        let parsedDate = new Date(dateStr);
        return ({
            "date": isNaN(parsedDate.getTime()) ? e : parsedDate.toString(),
            "file_name": e
        });
    });
});

ipcMain.handle('get-screenshots', async (_, instance_id) => {
    let screenshotsPath = path.resolve(user_path, `minecraft/instances/${instance_id}/screenshots`);
    fs.mkdirSync(screenshotsPath, { recursive: true });
    let screenshots = await fsPromises.readdir(screenshotsPath);
    let files = screenshots.filter(file => /\.(png|jpg|jpeg|bmp|gif)$/i.test(file))
        .map(file => {
            let date = file.split(".").slice(0, -1).join(".").split("_");
            if (date[1]) date[1] = date[1].replaceAll(".", ":");
            if (date[2]) date = [date[0], date[1]]
            let dateStr = date.join(" ");
            let parsedDate = new Date(dateStr);

            return {
                file_name: isNaN(parsedDate.getTime()) ? file : parsedDate.toString(),
                real_file_name: file,
                file_path: path.resolve(screenshotsPath, file).replace(/\\/g, '/')
            }
        });
    return files;
});

ipcMain.handle('get-options', async (_, optionsPath) => {
    if (!fs.existsSync(optionsPath)) return [];
    const info = await fsPromises.readFile(optionsPath, "utf-8");
    const lines = info.split(/\r?\n/);
    const options = [];
    for (const line of lines) {
        if (!line.trim() || line.trim().startsWith("#")) continue;
        const idx = line.indexOf(":");
        if (idx === -1) continue;
        const key = line.slice(0, idx).trim();
        const value = line.slice(idx + 1).trim();
        options.push({ key, value });
    }
    return options;
});

ipcMain.handle('copy-image-to-clipboard', async (_, file_path) => {
    try {
        let image;
        if (/^https?:\/\//.test(file_path)) {
            const response = await fetch(file_path);
            if (!response.ok) return false;
            const arrayBuffer = await response.arrayBuffer();
            let buffer = await sharp(arrayBuffer).png().toBuffer();
            image = nativeImage.createFromBuffer(buffer);
        } else {
            file_path = path.resolve(file_path);
            image = nativeImage.createFromPath(file_path);
        }
        return image;
    } catch (err) {
        return false;
    }
});

ipcMain.handle('set-cape', async (_, player_info, cape_id) => {
    let date = new Date();
    date.setHours(date.getHours() - 1);
    if (new Date(player_info.expires) < date) {
        try {
            player_info = await getNewAccessToken(player_info.refresh_token);
        } catch (err) {
            throw new Error(translate("app.access_token.unable"));
        }
    }
    if (cape_id) {
        const res = await fetch(
            'https://api.minecraftservices.com/minecraft/profile/capes/active',
            {
                method: 'PUT',
                headers: {
                    Authorization: `Bearer ${player_info.access_token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ capeId: cape_id })
            }
        );

        let skin_info = await res.json();
        await fixProfile({ ...player_info, ...skin_info })

        if (!res.ok) {
            throw new Error(translate("app.cape.unable"));
        }
        return { "status": res.status, "player_info": player_info, "skin_info": skin_info };
    } else {
        const res = await fetch(
            'https://api.minecraftservices.com/minecraft/profile/capes/active',
            {
                method: 'DELETE',
                headers: {
                    Authorization: `Bearer ${player_info.access_token}`
                }
            }
        );

        let skin_info = await res.json();
        await fixProfile({ ...player_info, ...skin_info })

        if (!res.ok) {
            throw new Error(translate("app.cape.unable"));
        }
        return { "status": res.status, "player_info": player_info, "skin_info": skin_info };
    }
});

ipcMain.handle('set-skin-from-url', async (_, player_info, skin_url, variant) => {
    let date = new Date();
    if (new Date(player_info.expires) < date) {
        try {
            player_info = await getNewAccessToken(player_info.refresh_token);
        } catch (err) {
            throw new Error(translate("app.access_token.unable"));
        }
    }

    const res = await fetch(
        'https://api.minecraftservices.com/minecraft/profile/skins',
        {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${player_info.access_token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ variant, url: skin_url })
        }
    );

    let skin_info = await res.json();
    await fixProfile({ ...player_info, ...skin_info })

    if (!res.ok) {
        throw new Error(translate("app.skin.unable"));
    }
    return { "status": res.status, "player_info": player_info, "skin_info": skin_info };
});

ipcMain.handle('set-skin', async (_, player_info, skin_id, variant) => {
    let date = new Date();
    if (new Date(player_info.expires) < date) {
        try {
            player_info = await getNewAccessToken(player_info.refresh_token);
        } catch (err) {
            throw new Error(translate("app.access_token.unable"));
        }
    }
    let filePath = path.resolve(user_path, `minecraft/skins/${skin_id}.png`);
    if (!fs.existsSync(filePath)) {
        throw new Error(translate("app.skin.file_not_found"));
    }
    const form = new FormData();
    form.append('variant', variant);
    form.append('file', fs.createReadStream(filePath), {
        filename: `${skin_id}.png`,
        contentType: 'image/png',
    });

    const formHeaders = form.getHeaders();

    const targetUrl = new URL('https://api.minecraftservices.com/minecraft/profile/skins');

    return await new Promise((resolve, reject) => {
        const req = https.request({
            hostname: targetUrl.hostname,
            port: targetUrl.port,
            path: targetUrl.pathname,
            method: 'POST',
            headers: {
                ...formHeaders,
                'Authorization': `Bearer ${player_info.access_token}`
            }
        }, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', async () => {
                if (res.statusCode < 200 || res.statusCode >= 300) {
                    let errorMsg = `Unable to set skin (status ${res.statusCode})`;
                    try {
                        const errorJson = JSON.parse(data);
                        if (errorJson && errorJson.errorMessage) {
                            errorMsg += `: ${errorJson.errorMessage}`;
                        }
                    } catch (e) { }
                    reject(new Error(errorMsg));
                } else {
                    let skin_info = JSON.parse(data);
                    await fixProfile({ ...player_info, ...skin_info })
                    try {
                        resolve({ "status": res.statusCode, "player_info": player_info, "skin_info": skin_info });
                    } catch (e) {
                        reject(new Error("Unable to parse skin info response"));
                    }
                }
            });
        });

        req.on('error', (e) => {
            console.error('Native HTTP Request Error:', e);
            reject(new Error("Unable to set skin: " + e.message));
        });

        form.pipe(req);
    });
});

ipcMain.handle('get-profile', async (_, player_id) => {
    let player_info = getProfileFromId(player_id);
    if (new Date(player_info.expires) < new Date()) {
        try {
            player_info = await getNewAccessToken(player_info.refresh_token);
        } catch (err) {
            throw new Error(translate("app.access_token.unable"));
        }
    }

    const res = await fetch('https://api.minecraftservices.com/minecraft/profile', {
        headers: {
            Authorization: `Bearer ${player_info.access_token}`,
        }
    });

    let skin_and_capes = await res.json();

    await fixProfile({ ...player_info, ...skin_and_capes });

    if (!res.ok) throw new Error(translate("app.profile.unable"));

    return { "status": res.status, "player_info": player_info, "skin_info": skin_and_capes };
});

ipcMain.handle('import-skin', async (_, dataurl) => {
    const hash = await hashImageFromDataUrl(dataurl);
    const base64Data = dataurl.split(',')[1];
    if (!base64Data) throw new Error("Invalid data URL");
    const buffer = Buffer.from(base64Data, "base64");
    await fsPromises.writeFile(path.resolve(user_path, `minecraft/skins/${hash.hash}.png`), buffer);
    return hash.hash;
});

async function hashImageFromDataUrl(dataUrl) {
    const base64Data = dataUrl.split(',')[1];
    if (!base64Data) throw new Error("Invalid data URL");

    const imageBuffer = Buffer.from(base64Data, 'base64');

    const { data, info } = await sharp(imageBuffer)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

    const hash = crypto.createHash('sha256').update(data).digest('hex');
    return { "hash": hash, "buffer": data };
}

ipcMain.handle('test-java-installation', async (_, file_path) => {
    try {
        if (!fs.existsSync(file_path)) return false;
        const stat = await fsPromises.stat(file_path);
        if (!stat.isFile()) return false;

        const ext = path.extname(file_path).toLowerCase();
        if (process.platform === "win32" && ext !== ".exe") return false;

        return await new Promise((resolve) => {
            const result = spawn(file_path, ["-version"]);
            let output = "";
            let error = "";

            result.stdout?.on("data", (data) => { output += data.toString(); });
            result.stderr?.on("data", (data) => { error += data.toString(); });

            result.on("close", (code) => {
                const combined = (output + error).toLowerCase();
                if (
                    code === 0 &&
                    (combined.includes("java version") || combined.includes("openjdk version"))
                ) {
                    resolve(true);
                } else {
                    resolve(false);
                }
            });

            result.on("error", () => resolve(false));
        });
    } catch {
        return false;
    }
});

ipcMain.handle('transfer-world', async (_, old_world_path, instance_id, delete_previous_files) => {
    const savesPath = path.resolve(user_path, `minecraft/instances/${instance_id}/saves`);
    fs.mkdirSync(savesPath, { recursive: true });

    const worldName = path.basename(old_world_path);
    let targetName = worldName;
    let counter = 1;
    while (fs.existsSync(path.join(savesPath, targetName))) {
        targetName = `${worldName}_${counter}`;
        counter++;
    }
    const destPath = path.join(savesPath, targetName);

    await fsPromises.cp(old_world_path, destPath, { recursive: true });

    if (delete_previous_files) {
        await fsPromises.rm(old_world_path, { recursive: true, force: true });
    }

    return { new_world_path: destPath };
});

ipcMain.handle('create-desktop-shortcut', async (_, instance_id, instance_name, iconSource, worldType, worldId) => {
    const desktopPath = app.getPath("desktop");
    let safeName = instance_name.replace(/[<>:"/\\|?*]/g, '_');
    let shortcutExt = "desktop";
    if (os.platform() == 'win32') shortcutExt = "lnk";
    let iconExt = "png";
    if (os.platform() == 'win32') iconExt = "ico";
    let shortcutPath = path.join(desktopPath, `${safeName} - ${translate("app.name")}.${shortcutExt}`);

    let base_shortcut = safeName + " - " + translate("app.name");
    let count_shortcut = 1;

    let name = `${safeName} - ${translate("app.name")}`;

    while (fs.existsSync(shortcutPath)) {
        shortcutPath = path.join(desktopPath, `${base_shortcut} (${count_shortcut}).${shortcutExt}`);
        name = `${base_shortcut} (${count_shortcut})`;
        count_shortcut++;
    }

    let target, workingDir, args;

    if (isDev) {
        target = path.join(__dirname, 'node_modules', 'electron', 'dist', 'electron.exe');
        workingDir = path.resolve(__dirname);
        args = `"${workingDir}" "--instance=${instance_id}"`;
        if (worldType) args += ` --worldType=${worldType} "--worldId=${worldId}"`
    } else {
        target = process.execPath;
        workingDir = path.dirname(process.execPath);
        args = `"--instance=${instance_id}"`;
        if (worldType) args += ` --worldType=${worldType} "--worldId=${worldId}"`
    }

    if (!iconSource) {
        iconSource = "resources/icons/icon." + iconExt;
    }

    let base_path_name = instance_id;
    let current_count = 1;

    let iconPath = path.resolve(user_path, "icons", instance_id + '.' + iconExt);

    while (fs.existsSync(iconPath)) {
        iconPath = path.resolve(user_path, "icons", base_path_name + "_" + current_count + "." + iconExt);
        current_count++;
    }

    try {
        if (os.platform() == 'win32') {
            await convertToType(iconSource, iconPath, "ico");
        } else {
            await convertToType(iconSource, iconPath, "png");
        }
    } catch (e) {
        console.error(e);
    }

    if (!fs.existsSync(iconPath)) {
        let enderlynxiconpath = path.resolve(user_path, "icons", "enderlynx." + iconExt);
        if (!fs.existsSync(enderlynxiconpath)) {
            await fsPromises.copyFile(path.resolve(__dirname, "icon." + iconExt), enderlynxiconpath);
        }
        iconPath = enderlynxiconpath;
    }

    return new Promise((resolve) => {
        createDesktopShortcut({
            windows: {
                filePath: target,
                outputPath: desktopPath,
                name,
                comment: translate("app.desktop_shortcut.description", "%n", instance_name),
                icon: iconPath,
                arguments: args,
                VBScriptPath: path.join(process.resourcesPath, "app.asar.unpacked", "node_modules", "create-desktop-shortcuts", "src", "windows.vbs")
            },
            linux: {
                filePath: target,
                outputPath: desktopPath,
                name,
                description: translate("app.desktop_shortcut.description", "%n", instance_name),
                icon: iconPath,
                arguments: args,
                type: 'Application'
            },
            osx: {
                filePath: target,
                outputPath: desktopPath,
                name
            }
        });
        resolve(true);
    });
});

async function convertToType(input, outputPath, type = "ico") {
    let imageBuffer;

    if (input.startsWith('data:image/')) {
        const base64Data = input.replace(/^data:image\/\w+;base64,/, '');
        imageBuffer = Buffer.from(base64Data, 'base64');
    } else if (input.startsWith('http://') || input.startsWith('https://')) {
        const response = await fetch(input);
        if (!response.ok) throw new Error("Unable to fetch from internet");
        const arrayBuffer = await response.arrayBuffer();
        imageBuffer = Buffer.from(arrayBuffer);
    } else if (fs.existsSync(input)) {
        imageBuffer = await fsPromises.readFile(input);
    } else {
        throw new Error('Invalid input: must be a data URL, image URL, or file path');
    }

    const resized = await sharp(imageBuffer, { failOnError: false })
        .ensureAlpha()
        .resize(256, 256, {
            fit: 'contain',
            kernel: sharp.kernel.nearest,
            background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toBuffer();

    let icoBuffer;
    if (type == "ico") icoBuffer = await pngToIco(resized);
    else icoBuffer = resized;
    fs.mkdirSync(path.dirname(outputPath), { recursive: true })
    await fsPromises.writeFile(outputPath, icoBuffer);
}

ipcMain.handle('analyze-logs', async (_, instance_id, last_log_date, current_log_path) => {
    let lastDate = null;
    if (last_log_date) {
        let date = last_log_date.replace(".log", "").split("_");
        if (date[1]) date[1] = date[1].replaceAll("-", ":");
        let dateStr = date.join(" ");
        lastDate = new Date(dateStr);
        if (isNaN(lastDate.getTime())) lastDate = null;
    }

    const logs_path = path.resolve(user_path, `minecraft/instances/${instance_id}/logs`);
    fs.mkdirSync(logs_path, { recursive: true });
    let allMatches = [];
    let totalPlaytime = 0;

    const logs = (await fsPromises.readdir(logs_path))
        .filter(e => e.includes(".log") && !e.includes("latest") && !e.includes(".gz"));

    let most_recent_log = "";

    for (let i = 0; i < logs.length; i++) {
        const log = logs[i];
        let date = log.replace(".log", "").split("_");
        if (date[1]) date[1] = date[1].replaceAll("-", ":");
        let dateStr = date.join(" ");
        let parsedDate = new Date(dateStr);
        if (isNaN(parsedDate.getTime())) continue;
        if (lastDate && parsedDate <= lastDate) continue;

        const logPath = path.join(logs_path, log);

        let startTimestamp = "";
        let endTimestamp = "";

        try {
            const fileStream = fs.createReadStream(logPath, "utf8");
            const rl = readline.createInterface({
                input: fileStream,
                crlfDelay: Infinity
            });
            let startFound = false;
            let previousHour = 0;
            for await (const line of rl) {
                let searchForStart = () => {
                    const tsEnd = line.indexOf("]");
                    if (tsEnd === -1) return;
                    const timestamp = line.slice(1, tsEnd);
                    if (isNaN(new Date(timestamp).getTime())) {
                        const [hh, mm, ss] = timestamp?.split(':')?.map(Number);
                        if (hh && mm && ss) {
                            const combined = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate(), hh, mm, ss);
                            startTimestamp = combined.toISOString();
                            startFound = true;
                        } else {
                            return;
                        }
                        return;
                    }
                    startTimestamp = timestamp;
                    startFound = true;
                }
                let searchForEnd = () => {
                    const tsEnd = line.indexOf("]");
                    if (tsEnd === -1) return;
                    const timestamp = line.slice(1, tsEnd);
                    if (isNaN(new Date(timestamp).getTime())) {
                        const [hh, mm, ss] = timestamp?.split(':')?.map(Number);
                        if (hh && mm && ss) {
                            if (hh < previousHour) {
                                parsedDate.setDate(parsedDate.getDate() + 1);
                            }
                            previousHour = hh;
                            const combined = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate(), hh, mm, ss);
                            endTimestamp = combined.toISOString();
                        } else {
                            return;
                        }
                        return;
                    }
                    endTimestamp = timestamp;
                }
                if (!startFound) searchForStart();
                else searchForEnd();

                let searchForConnectingTo = () => {
                    if (line.includes("[CHAT]")) return;
                    const tsEnd = line.indexOf("]");
                    if (tsEnd === -1) return;
                    let timestamp = line.slice(1, tsEnd);
                    if (isNaN(new Date(timestamp).getTime())) {
                        const [hh, mm, ss] = timestamp?.split(':')?.map(Number);
                        if (hh && mm && ss) {
                            const combined = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate(), hh, mm, ss);
                            timestamp = combined.toISOString();
                        } else {
                            return;
                        }
                    }

                    const marker = "Connecting to ";
                    const start = line.indexOf(marker) + marker.length;
                    const after = line.slice(start);

                    const [host, port] = after.split(",").map(s => s.trim());

                    if (host && port) {
                        allMatches.push([timestamp, host, port]);
                    }
                }
                if (line.includes("Connecting to ")) searchForConnectingTo();
            }
        } catch (e) {
            console.error("Error reading log:", logPath, e);
            continue;
        }

        if (current_log_path && path.resolve(logPath) === path.resolve(current_log_path)) {
            break;
        }

        let playtime = new Date(endTimestamp).getTime() - new Date(startTimestamp).getTime();
        if (!isNaN(playtime)) totalPlaytime += playtime;

        most_recent_log = log;
    }

    return ({
        "last_played_servers": allMatches,
        "total_playtime": (totalPlaytime / 1000),
        "most_recent_log": most_recent_log
    });
})

ipcMain.handle('import-content', async (_, file_path, content_type, instance_id) => {
    let destFolder = "";
    let fileType = content_type;

    if (content_type === "auto") {
        if (file_path.endsWith(".jar") || file_path.endsWith(".jar.disabled")) {
            destFolder = "mods";
            fileType = "mod";
            // try {
            //     const tempZip = new AdmZip(file_path);
            //     if (tempZip.getEntry("fabric.mod.json")) {
            //         destFolder = "mods";
            //         fileType = "mod";
            //     } else if (tempZip.getEntry("META-INF/mods.toml")) {
            //         destFolder = "mods";
            //         fileType = "mod";
            //     } else if (tempZip.getEntry("quilt.mod.json")) {
            //         destFolder = "mods";
            //         fileType = "mod";
            //     } else {
            //         destFolder = "mods";
            //         fileType = "mod";
            //     }
            // } catch (e) {
            //     destFolder = "mods";
            //     fileType = "mod";
            // }
        } else if (file_path.endsWith(".zip") || file_path.endsWith(".zip.disabled")) {
            try {
                const tempZip = new AdmZip(file_path);
                if (tempZip.getEntry("pack.mcmeta")) {
                    destFolder = "resourcepacks";
                    fileType = "resource_pack";
                } else if (tempZip.getEntry("shaders/")) {
                    destFolder = "shaderpacks";
                    fileType = "shader";
                } else {
                    destFolder = "resourcepacks";
                    fileType = "resource_pack";
                }
            } catch (e) {
                destFolder = "resourcepacks";
                fileType = "resource_pack";
            }
        } else {
            return null;
        }
    } else {
        if (content_type === "mod") destFolder = "mods";
        else if (content_type === "resource_pack") destFolder = "resourcepacks";
        else if (content_type === "shader") destFolder = "shaderpacks";
        else destFolder = "mods";
    }

    const destPath = path.resolve(user_path, `minecraft/instances/${instance_id}/${destFolder}`);
    fs.mkdirSync(destPath, { recursive: true });

    let fileName = path.basename(file_path);
    let finalPath = path.join(destPath, fileName);

    let uniqueFinalPath = finalPath;
    let uniqueFileName = fileName;
    let count = 1;
    while (fs.existsSync(uniqueFinalPath)) {
        const ext = path.extname(fileName);
        const base = path.basename(fileName, ext);
        uniqueFileName = `${base} (${count})${ext}`;
        uniqueFinalPath = path.join(destPath, uniqueFileName);
        count++;
    }
    await fsPromises.copyFile(file_path, uniqueFinalPath);
    fileName = uniqueFileName;
    finalPath = uniqueFinalPath;

    return {
        file_name: fileName,
        type: fileType,
        dest: finalPath
    }
});

ipcMain.handle('download-skin', async (_, url) => {
    return await downloadSkin(url);
});

async function downloadSkin(url) {
    let imageBuffer;
    if (url.startsWith("data:")) {
        imageBuffer = Buffer.from(url.split(",")[1], "base64");
    } else {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Unable to download skin");
        const arrayBuffer = await response.arrayBuffer();
        imageBuffer = Buffer.from(arrayBuffer);
    }

    const { data, info } = await sharp(imageBuffer)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

    const hash = crypto.createHash('sha256')
        .update(data)
        .digest('hex');

    fs.mkdirSync(path.resolve(user_path, "minecraft/skins"), { recursive: true });

    await fsPromises.writeFile(path.resolve(user_path, `minecraft/skins/${hash}.png`), imageBuffer);

    const base64 = imageBuffer.toString('base64');
    const dataUrl = `data:image/png;base64,${base64}`;

    return { hash, dataUrl };
}

ipcMain.handle('path-to-data-url', async (_, file_path) => {
    if (!file_path) return null;
    try {
        if (fs.existsSync(file_path)) {
            const buffer = await fsPromises.readFile(file_path);
            try {
                const pngBuf = await sharp(buffer).png().toBuffer();
                return `data:image/png;base64,${pngBuf.toString('base64')}`;
            } catch (err) {
                return null;
            }
        }
        return null;
    } catch (err) {
        return null;
    }
});

ipcMain.handle('detect-java-installations', async (_, v) => {
    let javaSearch = new JavaSearch(user_path);
    return javaSearch.findJavaInstallations(v);
});

ipcMain.on('show-file-in-folder', (_, filePath) => {
    let command;
    switch (process.platform) {
        case 'win32':
            command = `explorer /select, "${path.resolve(filePath)}"`;
            break;
        case 'darwin':
            command = `open -R "${path.resolve(filePath)}"`;
            break;
        case 'linux':
            command = `xdg-open "${path.resolve(filePath)}"`;
            break;
        default:
            console.error('Unsupported operating system.');
            return;
    }

    exec(command, (error) => {
        if (error && error.code !== 1) {
            console.error(`Error showing file: ${error}`);
        }
    });
});

ipcMain.on('open-folder', (_, folderPath) => {
    let command;
    switch (process.platform) {
        case 'win32':
            command = `explorer "${path.resolve(folderPath)}"`;
            break;
        case 'darwin':
            command = `open "${path.resolve(folderPath)}"`;
            break;
        case 'linux':
            command = `xdg-open "${path.resolve(folderPath)}"`;
            break;
        default:
            console.error('Unsupported operating system.');
            return;
    }

    exec(command, (error) => {
        if (error && error.code !== 1) {
            console.error(`Error opening folder: ${error}`);
        }
    });
});

ipcMain.handle('is-instance-file', (_, file_path) => {
    let ext = path.extname(file_path);
    if (ext == ".mrpack" || ext == ".elpack") return true;
    if (ext == ".zip") {
        const zip = new AdmZip(file_path);
        if (zip.getEntry('pack.mcmeta')) return false;
        if (zip.getEntry('manifest.json')) return true;
    }
    return false;
});

ipcMain.handle('delete-world', async (_, instance_id, world_id) => {
    const savesPath = path.resolve(user_path, `minecraft/instances/${instance_id}/saves`);
    const worldPath = path.join(savesPath, world_id);

    try {
        if (fs.existsSync(worldPath)) {
            await fsPromises.rm(worldPath, { recursive: true, force: true });
            return true;
        }
        return false;
    } catch (err) {
        return false;
    }
});

ipcMain.handle('get-log', async (_, instance_id, file_name) => {
    let log_path = file_name ? path.resolve(user_path, "minecraft/instances", instance_id, "logs", file_name) : instance_id;
    return await fsPromises.readFile(log_path, { encoding: 'utf8', flag: 'r' });
});

ipcMain.handle('delete-log', async (_, instance_id, file_name) => {
    let log_path = path.resolve(user_path, "minecraft/instances", instance_id, "logs", file_name);
    try {
        await fsPromises.unlink(log_path);
        return true;
    } catch (e) {
        return false;
    }
});

ipcMain.handle('delete-all-logs', async (_, instance_id) => {
    let current_log_file = db.prepare("SELECT * FROM instances WHERE instance_id = ?").get(instance_id).current_log_file;
    let folderPath = path.resolve(user_path, `minecraft/instances/${instance_id}/logs`);
    if (!fs.existsSync(folderPath)) {
        console.error('Folder does not exist:', folderPath);
        return false;
    }

    const files = await fsPromises.readdir(folderPath);

    for (const file of files) {
        const filePath = path.join(folderPath, file);
        if (fs.lstatSync(filePath).isFile() && path.resolve(filePath) !== path.resolve(current_log_file)) {
            await fsPromises.unlink(filePath);
        }
    }

    return true;
});

ipcMain.handle('delete-content', async (_, instance_id, project_type, filename) => {
    let install_path = "";
    if (project_type == "mod") {
        install_path = path.resolve(user_path, `minecraft/instances/${instance_id}/mods`, filename);
    } else if (project_type == "resource_pack") {
        install_path = path.resolve(user_path, `minecraft/instances/${instance_id}/resourcepacks`, filename);
    } else if (project_type == "shader") {
        install_path = path.resolve(user_path, `minecraft/instances/${instance_id}/shaderpacks`, filename);
    }
    if (fs.existsSync(install_path)) {
        await fsPromises.unlink(install_path);
        return true;
    }
    return false;
});

ipcMain.handle('delete-screenshot', async (_, instance_id, file_name) => {
    let file_path = path.resolve(user_path, "minecraft/instances", instance_id, "screenshots", file_name);
    try {
        await fsPromises.unlink(file_path);
        return true;
    } catch (err) {
        return false;
    }
});

ipcMain.handle('disable-file', async (_, instance_id, type, file_name) => {
    let file_path = path.resolve(user_path, "minecraft", "instances", instance_id, type, file_name);
    try {
        const disabledPath = file_path.endsWith('.disabled') ? file_path : file_path + '.disabled';
        await fsPromises.rename(file_path, disabledPath);
        return path.basename(disabledPath);
    } catch (err) {
        return false;
    }
});

ipcMain.handle('enable-file', async (_, instance_id, type, file_name) => {
    let file_path = path.resolve(user_path, "minecraft", "instances", instance_id, type, file_name);
    try {
        if (file_path.endsWith('.disabled')) {
            const enabledPath = file_path.slice(0, -9);
            await fsPromises.rename(file_path, enabledPath);
            return path.basename(enabledPath);
        }
        return false;
    } catch (err) {
        return false;
    }
});

ipcMain.handle('get-java-installations', async (_) => {
    return db.prepare("SELECT * FROM java_versions").all();
});

ipcMain.handle('delete-folders-for-modpack-update', async (_, instance_id) => {
    let instancePath = path.resolve(user_path, `minecraft/instances/${instance_id}`)
    let folders = ["mods", "resourcepacks", "shaderpacks", "config", "defaultconfig", "scripts", "kubejs", "overrides", "libraries"];
    try {
        for (let i = 0; i < folders.length; i++) {
            let pathToDelete = path.resolve(instancePath, folders[i]);
            if (fs.existsSync(pathToDelete)) {
                await fsPromises.rm(pathToDelete, { recursive: true, force: true });
            }
        }
        return true;
    } catch (e) {
        return false;
    }
});

ipcMain.handle('generate-options-txt', async (_, values) => {
    const tempDir = path.resolve(user_path, "out");
    fs.mkdirSync(tempDir, { recursive: true });
    const filePath = path.join(tempDir, `options_${Date.now()}.txt`);
    const lines = [];
    for (const { key, value } of values) {
        lines.push(`${key}:${value}`);
    }
    await fsPromises.writeFile(filePath, lines.join("\n"), "utf-8");
    return filePath;
});

ipcMain.handle('get-instance-folder-name', async (_, instance_id) => {
    instance_id = instance_id.trim();
    instance_id = instance_id.replace(/[^0-9a-zA-Z\-._ \(\)]/g, "_");
    instance_id = instance_id.replace(/[. ]+$/, "_");
    const reserved_names = new Set([
        "con", "prn", "aux", "nul",
        "com0", "com1", "com2", "com3", "com4", "com5", "com6", "com7", "com8", "com9",
        "lpt0", "lpt1", "lpt2", "lpt3", "lpt4", "lpt5", "lpt6", "lpt7", "lpt8", "lpt9"
    ]);
    if (reserved_names.has(instance_id.toLowerCase())) {
        instance_id += "_";
    }
    if (!instance_id) {
        instance_id = "unnamed";
    }
    if (instance_id.length > 100) {
        instance_id = instance_id.substring(0, 100);
    }
    const baseInstanceId = instance_id;
    let counter = 1;
    while (folderExists(path.resolve(user_path, `minecraft/instances/${instance_id}`))) {
        instance_id = `${baseInstanceId}_${counter}`;
        counter++;
    }
    fs.mkdirSync(path.resolve(user_path, `minecraft/instances/${instance_id}`), { recursive: true });
    return instance_id;
});

function folderExists(folderPath) {
    try {
        return fs.statSync(folderPath).isDirectory();
    } catch (err) {
        return false;
    }
}

ipcMain.handle('get-launcher-instances', async (_, instance_path) => {
    if (!fs.existsSync(instance_path)) return [{ "name": translate("app.launchers.instance.unable_to_locate"), "value": "error" }];
    return fs.readdirSync(instance_path)
        .filter(f => {
            const fullPath = path.join(instance_path, f);
            return fs.statSync(fullPath).isDirectory();
        })
        .map(f => ({
            name: f,
            value: path.resolve(instance_path, f)
        }));
});

ipcMain.handle('get-launcher-instance-path', async (_, launcher) => {
    switch (launcher.toLowerCase()) {
        case "modrinth": {
            const p = path.join(os.homedir(), "AppData", "Roaming", "com.modrinth.theseus", "profiles");
            return fs.existsSync(p) ? p : "";
        }
        case "curseforge": {
            const p = path.join(os.homedir(), "curseforge", "minecraft", "Instances");
            return fs.existsSync(p) ? p : "";
        }
        case "vanilla": {
            const p = path.join(os.homedir(), "AppData", "Roaming", ".minecraft");
            return fs.existsSync(p) ? p : "";
        }
        case "multimc": {
            const p = path.join(os.homedir(), "AppData", "Roaming", ".minecraft", "instances");
            return fs.existsSync(p) ? p : "";
        }
        case "prism": {
            const p = path.join(os.homedir(), "AppData", "Roaming", "PrismLauncher", "instances");
            return fs.existsSync(p) ? p : "";
        }
        case "atlauncher": {
            const p = path.join(os.homedir(), "AppData", "Roaming", "ATLauncher", "instances");
            return fs.existsSync(p) ? p : "";
        }
        case "gdlauncher": {
            const p = path.join(os.homedir(), "AppData", "Roaming", "GDLauncher", "instances");
            return fs.existsSync(p) ? p : "";
        }
        case "current": {
            const p = path.join(user_path, "minecraft/instances");
            return fs.existsSync(p) ? p : "";
        }
        default:
            return "";
    }
});


const watchers = new Map();

ipcMain.handle('watch-file', (event, filepath) => {
    if (watchers.has(filepath)) return;

    let lastSize = 0;

    try {
        lastSize = fs.statSync(filepath).size;
    } catch (err) {
        console.error('Stat failed:', err);
        return;
    }

    const watcher = fs.watchFile(filepath, { interval: 500 }, async () => {
        try {
            const { size } = fs.statSync(filepath);

            if (size > lastSize) {
                const stream = fs.createReadStream(filepath, {
                    start: lastSize,
                    end: size,
                    encoding: 'utf8'
                });

                stream.on('data', chunk => {
                    event.sender.send('file-data', filepath, chunk);
                });

                lastSize = size;
            }
        } catch (err) {
            console.error('Watch error:', err);
        }
    });

    watchers.set(filepath, watcher);
});

ipcMain.handle('stop-watching-file', (_, filepath) => {
    const watcher = watchers.get(filepath);
    if (watcher) {
        fs.unwatchFile(filepath);
        watchers.delete(filepath);
    }
});

// Instance management
function getInstance(instance_id) {
    return db.prepare("SELECT * FROM instances WHERE instance_id = ? LIMIT 1").get(instance_id);
}
function getInstances() {
    return db.prepare("SELECT * FROM instances").all();
}
function updateInstance(key, value, instance_id) {
    if (value instanceof Date) value = value.toISOString();
    if (typeof value === "boolean") value = Number(value);
    let allowedKeys = ["name", "date_modified", "last_played", "loader", "vanilla_version", "loader_version", "playtime", "locked", "group_id", "image", "java_version", "java_path", "current_log_file", "pid", "install_source", "install_id", "installing", "mc_installed", "window_width", "window_height", "allocated_ram", "attempted_options_txt_version", "java_args", "env_vars", "pre_launch_hook", "post_launch_hook", "wrapper", "post_exit_hook", "installed_version", "last_analyzed_log", "failed", "uses_custom_java_args", "provided_java_args"];
    if (!allowedKeys.includes(key)) throw new Error("Unable to edit value " + key);
    if (win && win.webContents) win.webContents.send('instance-updated', key, value, instance_id);
    return db.prepare(`UPDATE instances SET ${key} = ? WHERE instance_id = ?`).run(value, instance_id);
}
function deleteInstance(instance_id) {
    db.prepare("DELETE FROM content WHERE instance = ?").run(instance_id);
    db.prepare("DELETE FROM last_played_servers WHERE instance_id = ?").run(instance_id);
    db.prepare("DELETE FROM pins WHERE instance_id = ?").run(instance_id);
    return db.prepare("DELETE FROM instances WHERE instance_id = ?").run(instance_id);
}
function addInstance(name, date_created, date_modified, last_played, loader, vanilla_version, loader_version, locked, downloaded, group, image, instance_id, playtime, install_source, install_id, installing, mc_installed) {
    db.prepare(`INSERT INTO instances (name, date_created, date_modified, last_played, loader, vanilla_version, loader_version, locked, downloaded, group_id, image, instance_id, playtime, install_source, install_id, installing, mc_installed, window_width, window_height, allocated_ram) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(name, date_created.toISOString(), date_modified.toISOString(), last_played ? last_played.toISOString() : null, loader, vanilla_version, loader_version, Number(locked), Number(downloaded), group, image, instance_id, playtime, install_source, install_id, Number(installing), Number(mc_installed), Number(getDefault("default_width")), Number(getDefault("default_height")), Number(getDefault("default_ram")));
    setOptionsTXT(instance_id, getDefaultOptionsTXT(vanilla_version), true, false, (v) => {
        updateInstance("attempted_options_txt_version", v, instance_id);
    });
    return getInstance(instance_id);
}

// Content management
function getContent(content_id) {
    return db.prepare("SELECT * FROM content WHERE id = ? LIMIT 1").get(content_id);
}
function getInstanceContentDatabase(instance_id) {
    return db.prepare("SELECT * FROM content WHERE instance = ?").all(instance_id);
}
function updateContent(key, value, content_id) {
    if (value instanceof Date) value = value.toISOString();
    if (typeof value === "boolean") value = Number(value);
    let allowedKeys = ["name", "author", "disabled", "image", "file_name", "source", "type", "version", "version_id", "instance", "source_info TEXT"];
    if (!allowedKeys.includes(key)) throw new Error("Unable to edit that value");
    return db.prepare(`UPDATE content SET ${key} = ? WHERE id = ?`).run(value, content_id);
}
function addContentDatabase(name, author, image, file_name, source, type, version, instance_id, source_info, disabled, version_id) {
    let result = db.prepare('INSERT into content (name, author, image, file_name, source, type, version, instance, source_info, disabled, version_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(name, author, image, file_name, source, type, version, instance_id, source_info, Number(disabled), version_id);
    return getContent(result.lastInsertRowid);
}
function deleteContentDatabase(content_id) {
    return db.prepare("DELETE FROM content WHERE id = ?").run(content_id);
}
function getContentBySourceInfo(source_info) {
    return db.prepare("SELECT * FROM content WHERE source_info = ?").all(source_info);
}

// Profile management
function getDefaultProfile() {
    return db.prepare("SELECT * FROM profiles WHERE is_default = ?").get(1);
}
function setDefaultProfile(profile_id) {
    db.prepare("UPDATE profiles SET is_default = ?").run(0);
    return db.prepare("UPDATE profiles SET is_default = ? WHERE id = ?").run(1, profile_id);
}
function getProfiles() {
    return db.prepare("SELECT * FROM profiles").all();
}
function getProfileDatabase(uuid) {
    return db.prepare("SELECT * FROM profiles WHERE uuid = ?").get(uuid);
}
function getProfileFromId(profile_id) {
    return db.prepare("SELECT * FROM profiles WHERE id = ?").get(profile_id);
}
function addProfile(access_token, client_id, expires, name, refresh_token, uuid, xuid, is_demo, is_default) {
    let result = db.prepare("INSERT INTO profiles (access_token,client_id,expires,name,refresh_token,uuid,xuid,is_demo,is_default) VALUES (?,?,?,?,?,?,?,?,?)").run(access_token, client_id, expires.toISOString(), name, refresh_token, uuid, xuid, Number(is_demo), Number(is_default));
    return getProfileFromId(result.lastInsertRowid);
}
function deleteProfile(uuid) {
    return db.prepare("DELETE FROM profiles WHERE uuid = ?").run(uuid);
}
function updateProfile(key, value, profile_id) {
    if (value instanceof Date) value = value.toISOString();
    if (typeof value === "boolean") value = Number(value);
    let allowedKeys = ["access_token", "client_id", "expires", "name", "refresh_token", "uuid", "xuid", "is_demo"];
    if (!allowedKeys.includes(key)) throw new Error("Unable to edit that value");
    return db.prepare(`UPDATE profiles SET ${key} = ? WHERE id = ?`).run(value, profile_id);
}

// Skin management
function getSkins() {
    return db.prepare("SELECT * FROM skins").all();
}
function getSkinsNoDefaults() {
    return db.prepare("SELECT * FROM skins WHERE NOT default_skin = ?").all(1);
}
async function getDefaultSkins() {
    let skins = db.prepare("SELECT * FROM skins WHERE default_skin = ?").all(1);
    let defaultSkins = JSON.parse(await fsPromises.readFile(path.resolve(__dirname, "resources/default_skins.json"), 'utf-8'));
    if (skins.length != defaultSkins.length) {
        let texture_keys = skins.map(e => e.texture_key);
        for (let i = 0; i < defaultSkins.length; i++) {
            let e = defaultSkins[i];
            if (!texture_keys.includes(e.texture_key)) {
                let info = await downloadSkin(e.url);
                db.prepare("INSERT INTO skins (name, model, skin_id, skin_url, default_skin, active_uuid, texture_key) VALUES (?,?,?,?,?,?,?)").run(e.name, e.model, info.hash, info.dataUrl, 1, "", e.texture_key);
            }
        }
        let skinsAgain = db.prepare("SELECT * FROM skins WHERE default_skin = ?").all(1);
        return skinsAgain;
    }
    return skins;
}
function getSkin(skin_id) {
    return db.prepare("SELECT * FROM skins WHERE id = ? LIMIT 1").get(skin_id);
}
function updateSkin(key, value, skin_id) {
    if (value instanceof Date) value = value.toISOString();
    if (typeof value === "boolean") value = Number(value);
    let allowedKeys = ["model", "name", "last_used", "favorited", "texture_key", "head", "active_uuid", "preview", "preview_model"];
    if (!allowedKeys.includes(key)) throw new Error("Unable to edit that value");
    return db.prepare(`UPDATE skins SET ${key} = ? WHERE id = ?`).run(value, skin_id);
}
function addSkin(name, model, active_uuid, skin_id, skin_url, overrideCheck, last_used, texture_key) {
    let skins = getSkins();
    let previousSkinIds = skins.map(e => e.skin_id);
    if (previousSkinIds.includes(skin_id) && !overrideCheck) {
        let id = skins[previousSkinIds.indexOf(skin_id)].id;
        if (texture_key) updateSkin("texture_key", texture_key, id);
        if (model) updateSkin("model", model, id);
        return getSkin(id);
    }
    let result = db.prepare("INSERT INTO skins (name, model, active_uuid, skin_id, skin_url, default_skin, last_used, texture_key) VALUES (?,?,?,?,?,?,?,?)").run(name, model, `;${active_uuid};`, skin_id, skin_url, Number(false), last_used ? last_used.toISOString() : null, texture_key ? texture_key : null);
    return getSkin(result.lastInsertRowid);
}
function deleteSkin(skin_id) {
    return db.prepare("DELETE FROM skins WHERE id = ?").run(skin_id);
}
function getActiveSkin(uuid) {
    return db.prepare("SELECT * FROM skins WHERE active_uuid LIKE ? LIMIT 1").get(`%;${uuid};%`);
}
function setActiveSkin(uuid, skin_id) {
    let old = db.prepare("SELECT * FROM skins WHERE active_uuid LIKE ?").all(`%;${uuid};%`);
    for (let i = 0; i < old.length; i++) {
        let active = old[i].active_uuid.split(";");
        updateSkin("active_uuid", active.toSpliced(active.indexOf(uuid), 1).join(";"), old[i].id);
    }
    let current = db.prepare("SELECT * FROM skins WHERE id = ? LIMIT 1").get(skin_id);
    let active = current.active_uuid.split(";");
    if (active.length <= 1) active = ["", ""];
    active.splice(1, 0, uuid);
    return updateSkin("active_uuid", active.join(";"), current.id);
}

// default management
function getDefault(type) {
    let default_ = db.prepare("SELECT * FROM defaults WHERE default_type = ?").get(type);
    if (!default_) {
        let value = defaults[type];
        db.prepare("INSERT INTO defaults (default_type, value) VALUES (?, ?)").run(type, value);
        return value;
    }
    return default_.value;
}
function setDefault(type, value) {
    getDefault(type);
    return db.prepare("UPDATE defaults SET value = ? WHERE default_type = ?").run(value, type);
}

// cape management
function getCape(cape_id) {
    return db.prepare("SELECT * FROM capes WHERE id = ? LIMIT 1").get(cape_id);
}
function getCapes(uuid) {
    return db.prepare("SELECT * FROM capes WHERE uuid = ?").all(uuid);
}
function getActiveCape(uuid) {
    return db.prepare("SELECT * FROM capes WHERE uuid = ? AND active = ?").get(uuid, 1);
}
function addCape(cape_name, cape_id, cape_url, uuid) {
    let capes = getCapes(uuid);
    let previousCapeIds = capes.map(e => e.cape_id);
    if (previousCapeIds.includes(cape_id)) {
        return capes[previousCapeIds.indexOf(cape_id)];
    }
    let result = db.prepare("INSERT INTO capes (uuid, cape_name, cape_id, cape_url) VALUES (?,?,?,?)").run(uuid, cape_name, cape_id, cape_url);
    return getCape(result.lastInsertRowid);
}
function setCapeActive(cape_id) {
    let cape = getCape(cape_id);
    db.prepare("UPDATE capes SET active = ? WHERE uuid = ?").run(0, cape.uuid);
    return db.prepare("UPDATE capes SET active = ? WHERE id = ?").run(1, cape_id);
}
function removeCapeActive(cape_id) {
    return db.prepare("UPDATE capes SET active = ? WHERE id = ?").run(0, cape_id);
}

// default options management
function getDefaultOptionsVersions() {
    return db.prepare("SELECT * FROM options_defaults WHERE key = ?").all("version").map(e => e.version).filter(e => e);
}
function getDefaultOption(key) {
    return db.prepare("SELECT * FROM options_defaults WHERE key = ?").get(key)?.value;
}
function setDefaultOption(key, value) {
    if (!getDefaultOption(key)) {
        return db.prepare("INSERT INTO options_defaults (key, value) VALUES (?, ?)").run(key, value);
    }
    return db.prepare("UPDATE options_defaults SET value = ? WHERE key = ?").run(value, key);
}
function deleteDefaultOption(key) {
    return db.prepare("DELETE FROM options_defaults WHERE key = ?").run(key);
}
let keyToNum = {
    "key.keyboard.apostrophe": 40,
    "key.keyboard.backslash": 43,
    "key.keyboard.backspace": 14,
    "key.keyboard.caps.lock": 58,
    "key.keyboard.comma": 51,
    "key.keyboard.delete": 211,
    "key.keyboard.down": 208,
    "key.keyboard.end": 207,
    "key.keyboard.enter": 28,
    "key.keyboard.equal": 13,
    "key.keyboard.f1": 59,
    "key.keyboard.f2": 60,
    "key.keyboard.f3": 61,
    "key.keyboard.f4": 62,
    "key.keyboard.f5": 63,
    "key.keyboard.f6": 64,
    "key.keyboard.f7": 65,
    "key.keyboard.f8": 66,
    "key.keyboard.f9": 67,
    "key.keyboard.f10": 68,
    "key.keyboard.f11": 87,
    "key.keyboard.f12": 88,
    "key.keyboard.f13": 100,
    "key.keyboard.f14": 101,
    "key.keyboard.f15": 102,
    "key.keyboard.f16": 103,
    "key.keyboard.f17": 104,
    "key.keyboard.f18": 105,
    "key.keyboard.f19": 113,
    "key.keyboard.f20": 114,
    "key.keyboard.f21": 115,
    "key.keyboard.f22": 116,
    "key.keyboard.f23": 117,
    "key.keyboard.f24": 118,
    "key.keyboard.f25": 119,
    "key.keyboard.grave.accent": 41,
    "key.keyboard.home": 199,
    "key.keyboard.insert": 210,
    "key.keyboard.keypad.0": 82,
    "key.keyboard.keypad.1": 79,
    "key.keyboard.keypad.2": 80,
    "key.keyboard.keypad.3": 81,
    "key.keyboard.keypad.4": 75,
    "key.keyboard.keypad.5": 76,
    "key.keyboard.keypad.6": 77,
    "key.keyboard.keypad.7": 71,
    "key.keyboard.keypad.8": 72,
    "key.keyboard.keypad.9": 73,
    "key.keyboard.keypad.add": 78,
    "key.keyboard.keypad.decimal": 83,
    "key.keyboard.keypad.divide": 181,
    "key.keyboard.keypad.enter": 156,
    "key.keyboard.keypad.equal": 141,
    "key.keyboard.keypad.multiply": 55,
    "key.keyboard.keypad.subtract": 74,
    "key.keyboard.left": 203,
    "key.keyboard.left.alt": 56,
    "key.keyboard.left.bracket": 26,
    "key.keyboard.left.control": 29,
    "key.keyboard.left.shift": 42,
    "key.keyboard.left.win": 219,
    "key.keyboard.menu": 221,
    "key.keyboard.minus": 12,
    "key.keyboard.num.lock": 69,
    "key.keyboard.page.down": 209,
    "key.keyboard.page.up": 201,
    "key.keyboard.pause": 197,
    "key.keyboard.period": 52,
    "key.keyboard.print.screen": 183,
    "key.keyboard.right": 205,
    "key.keyboard.right.alt": 184,
    "key.keyboard.right.bracket": 27,
    "key.keyboard.right.control": 157,
    "key.keyboard.right.shift": 54,
    "key.keyboard.right.win": 220,
    "key.keyboard.scroll.lock": 70,
    "key.keyboard.semicolon": 39,
    "key.keyboard.slash": 53,
    "key.keyboard.space": 57,
    "key.keyboard.tab": 15,
    "key.keyboard.unknown": -1,
    "key.keyboard.up": 200,
    "key.keyboard.a": 30,
    "key.keyboard.b": 48,
    "key.keyboard.c": 46,
    "key.keyboard.d": 32,
    "key.keyboard.e": 18,
    "key.keyboard.f": 33,
    "key.keyboard.g": 34,
    "key.keyboard.h": 35,
    "key.keyboard.i": 23,
    "key.keyboard.j": 36,
    "key.keyboard.k": 37,
    "key.keyboard.l": 38,
    "key.keyboard.m": 50,
    "key.keyboard.n": 49,
    "key.keyboard.o": 24,
    "key.keyboard.p": 25,
    "key.keyboard.q": 16,
    "key.keyboard.r": 19,
    "key.keyboard.s": 31,
    "key.keyboard.t": 20,
    "key.keyboard.u": 22,
    "key.keyboard.v": 47,
    "key.keyboard.w": 17,
    "key.keyboard.x": 45,
    "key.keyboard.y": 21,
    "key.keyboard.z": 44,
    "key.keyboard.0": 11,
    "key.keyboard.1": 2,
    "key.keyboard.2": 3,
    "key.keyboard.3": 4,
    "key.keyboard.4": 5,
    "key.keyboard.5": 6,
    "key.keyboard.6": 7,
    "key.keyboard.7": 8,
    "key.keyboard.8": 9,
    "key.keyboard.9": 10,
    "key.mouse.left": -100,
    "key.mouse.right": -99,
    "key.mouse.middle": -98,
    "key.mouse.1": -97,
    "key.mouse.2": -96,
    "key.mouse.3": -95,
    "key.mouse.4": -94,
    "key.mouse.5": -93,
    "key.mouse.6": -92,
    "key.mouse.7": -91,
    "key.mouse.8": -90,
    "key.mouse.9": -89,
    "key.mouse.10": -88,
    "key.mouse.11": -87,
    "key.mouse.12": -86,
    "key.mouse.13": -85,
    "key.mouse.14": -84,
    "key.mouse.15": -83,
    "key.mouse.16": -82,
    "key.mouse.17": -81,
    "key.mouse.18": -80,
    "key.mouse.19": -79,
    "key.mouse.20": -78
};
function getDefaultOptionsTXT(version, data_version) {
    let v;
    if (!data_version) {
        let thisIndex = minecraftVersions.indexOf(version);
        let versions = getDefaultOptionsVersions();
        let min_distance = 10000;
        let version_to_use = "something_not_null";
        if (versions.includes(this.version)) {
            version_to_use = this.version;
        } else {
            versions.forEach(e => {
                let vIndex = minecraftVersions.indexOf(e);
                if (vIndex > thisIndex) return;
                if (thisIndex - vIndex < min_distance) {
                    min_distance = thisIndex - vIndex;
                    version_to_use = e;
                }
            });
        }
        v = db.prepare("SELECT * FROM options_defaults WHERE key = ? AND version = ?").get("version", version_to_use);
    }
    let r = db.prepare("SELECT * FROM options_defaults WHERE NOT key = ?").all("version");
    let content = "";
    if (!data_version) data_version = v?.value;
    if (!data_version) data_version = 100;
    content = "version:" + data_version + "\n";
    data_version = Number(data_version);
    r.forEach(e => {
        if (minecraftVersions.indexOf(this.version) <= minecraftVersions.indexOf("1.12.2") && minecraftVersions.indexOf(this.version) != -1 && keyToNum[e.value]) {
            content += e.key + ":" + keyToNum[e.value] + "\n"
        } else {
            content += e.key + ":" + e.value + "\n"
        }
    });
    return { "content": content, "version": data_version, "keys": r.map(e => e.key), "values": r.map(e => e.value).map(e => (minecraftVersions.indexOf(this.version) <= minecraftVersions.indexOf("1.12.2") && minecraftVersions.indexOf(this.version) != -1 && keyToNum[e]) ? keyToNum[e] : e) };
}
function getDefaultOptions() {
    return db.prepare("SELECT * FROM options_defaults WHERE key != ?").all("version");
}
function deleteDefaultOptions() {
    return db.prepare("DELETE FROM options_defaults WHERE key != ?").all("version");
}

// mc versions management
function getMCVersions() {
    let mcVersions = db.prepare("SELECT * FROM mc_versions_cache").all();
    mcVersions.sort((a, b) => {
        return (new Date(a.date_published)).getTime() - (new Date(b.date_published)).getTime();
    });
    versionNames = mcVersions.map(e => e.name);
    minecraftVersions = versionNames;
    return versionNames;
}
async function fetchUpdatedMCVersions() {
    let result_pre_json = await fetch(`https://launchermeta.mojang.com/mc/game/version_manifest.json`);
    let result = await result_pre_json.json();
    setDefault("latest_release", result.latest.release);
    let mc_versions = db.prepare('SELECT * FROM mc_versions_cache').all();
    let mc_version_names = mc_versions.map(e => e.name);
    for (let i = 0; i < result.versions.length; i++) {
        let e = result.versions[i];
        if (!mc_version_names.includes(e.id)) {
            db.prepare("INSERT INTO mc_versions_cache (name, date_published) VALUES (?, ?)").run(e.id, e.releaseTime);
        } else {
            mc_version_names.splice(mc_version_names.indexOf(e.id), 1);
        }
    }
    for (let i = 0; i < mc_version_names.length; i++) {
        let id = mc_version_names[i];
        db.prepare("DELETE FROM mc_versions_cache WHERE name = ?").run(id);
    }
    return getMCVersions();
}

function getServerLastPlayed(instance_id, ip) {
    if (!ip.includes(":")) ip += ":25565";
    let result = db.prepare("SELECT * FROM last_played_servers WHERE instance_id = ? AND ip = ?").get(instance_id, ip);
    return result?.date;
}
function setServerLastPlayed(instance_id, ip, date) {
    if (!ip.includes(":")) ip += ":25565";
    let existing = db.prepare("SELECT * FROM last_played_servers WHERE instance_id = ? AND ip = ?").get(instance_id, ip);
    if (existing) {
        return db.prepare("UPDATE last_played_servers SET date = ? WHERE instance_id = ? AND ip = ?").run(date, instance_id, ip);
    }
    return db.prepare("INSERT INTO last_played_servers (ip, instance_id, date) VALUES (?, ?, ?)").run(ip, instance_id, date);
}

function isWorldPinned(world_id, instance_id, world_type) {
    return Boolean(db.prepare("SELECT * FROM pins WHERE world_id = ? AND instance_id = ? AND world_type = ?").get(world_id, instance_id, world_type));
}
function isInstancePinned(instance_id) {
    return Boolean(db.prepare("SELECT * FROM pins WHERE instance_id = ?").get(instance_id));
}
function pinInstance(instance_id) {
    return db.prepare("INSERT INTO pins (type, instance_id) VALUES (?, ?)").run("instance", instance_id);
}
function unpinInstance(instance_id) {
    return db.prepare("DELETE FROM pins WHERE type = ? AND instance_id = ?").run("instance", instance_id);
}
function pinWorld(world_id, instance_id, world_type) {
    return db.prepare("INSERT INTO pins (type, instance_id, world_id, world_type) VALUES (?, ?, ?, ?)").run("world", instance_id, world_id, world_type);
}
function unpinWorld(world_id, instance_id, world_type) {
    return db.prepare("DELETE FROM pins WHERE type = ? AND instance_id = ? AND world_id = ? AND world_type = ?").run("world", instance_id, world_id, world_type);
}
function getPinnedInstances() {
    return db.prepare("SELECT * FROM pins WHERE type = ?").all("instance");
}
async function getPinnedWorlds() {
    let worlds = db.prepare("SELECT * FROM pins WHERE type = ?").all("world");
    let allWorlds = [];
    for (const world of worlds) {
        if (!world.world_id) continue;
        if (world.world_type == "singleplayer") {
            const worldPath = path.resolve(user_path, "minecraft/instances", world.instance_id || "", "saves", world.world_id, "level.dat");
            if (fs.existsSync(worldPath)) {
                try {
                    const worldInfo = await getWorld(worldPath);
                    allWorlds.push({
                        ...worldInfo,
                        pinned: true,
                        type: "singleplayer",
                        instance_id: world.instance_id
                    });
                } catch (e) { }
            } else { }
        } else {
            const servers = await getMultiplayerWorlds(world.instance_id);
            const server = servers.find(s => (s.ip) == world.world_id);
            if (server) {
                allWorlds.push({
                    ...server,
                    pinned: true,
                    instance_id: world.instance_id,
                    last_played: await getServerLastPlayed(world.instance_id, server.ip)
                });
            }
        }
    }
    return allWorlds;
}


ipcMain.handle('get-instance', (_, ...params) => getInstance(...params));
ipcMain.handle('get-instances', (_, ...params) => getInstances(...params));
ipcMain.handle('update-instance', (_, ...params) => updateInstance(...params));
ipcMain.handle('delete-instance', (_, ...params) => deleteInstance(...params));
ipcMain.handle('add-instance', (_, ...params) => addInstance(...params));
ipcMain.handle('get-content', (_, ...params) => getContent(...params));
ipcMain.handle('get-instance-content-database', (_, ...params) => getInstanceContentDatabase(...params));
ipcMain.handle('update-content', (_, ...params) => updateContent(...params));
ipcMain.handle('add-content-database', (_, ...params) => addContentDatabase(...params));
ipcMain.handle('delete-content-database', (_, ...params) => deleteContentDatabase(...params));
ipcMain.handle('get-content-by-source-info', (_, ...params) => getContentBySourceInfo(...params));
ipcMain.handle('get-default-profile', (_, ...params) => getDefaultProfile(...params));
ipcMain.handle('set-default-profile', (_, ...params) => setDefaultProfile(...params));
ipcMain.handle('get-profiles', (_, ...params) => getProfiles(...params));
ipcMain.handle('get-profile-database', (_, ...params) => getProfileDatabase(...params));
ipcMain.handle('get-profile-from-id', (_, ...params) => getProfileFromId(...params));
ipcMain.handle('add-profile', (_, ...params) => addProfile(...params));
ipcMain.handle('delete-profile', (_, ...params) => deleteProfile(...params));
ipcMain.handle('update-profile', (_, ...params) => updateProfile(...params));
ipcMain.handle('get-skins', (_, ...params) => getSkins(...params));
ipcMain.handle('get-skins-no-defaults', (_, ...params) => getSkinsNoDefaults(...params));
ipcMain.handle('get-default-skins', (_, ...params) => getDefaultSkins(...params));
ipcMain.handle('get-skin', (_, ...params) => getSkin(...params));
ipcMain.handle('update-skin', (_, ...params) => updateSkin(...params));
ipcMain.handle('add-skin', (_, ...params) => addSkin(...params));
ipcMain.handle('delete-skin', (_, ...params) => deleteSkin(...params));
ipcMain.handle('get-active-skin', (_, ...params) => getActiveSkin(...params));
ipcMain.handle('set-active-skin', (_, ...params) => setActiveSkin(...params));
ipcMain.handle('get-default', (_, ...params) => getDefault(...params));
ipcMain.handle('set-default', (_, ...params) => setDefault(...params));
ipcMain.handle('get-cape', (_, ...params) => getCape(...params));
ipcMain.handle('get-capes', (_, ...params) => getCapes(...params));
ipcMain.handle('get-active-cape', (_, ...params) => getActiveCape(...params));
ipcMain.handle('add-cape', (_, ...params) => addCape(...params));
ipcMain.handle('set-cape-active', (_, ...params) => setCapeActive(...params));
ipcMain.handle('remove-cape-active', (_, ...params) => removeCapeActive(...params));
ipcMain.handle('get-default-options-versions', (_, ...params) => getDefaultOptionsVersions(...params));
ipcMain.handle('get-default-options-txt', (_, ...params) => getDefaultOptionsTXT(...params));
ipcMain.handle('get-default-options', (_, ...params) => getDefaultOptions(...params));
ipcMain.handle('delete-default-options', (_, ...params) => deleteDefaultOptions(...params));
ipcMain.handle('get-default-option', (_, ...params) => getDefaultOption(...params));
ipcMain.handle('set-default-option', (_, ...params) => setDefaultOption(...params));
ipcMain.handle('delete-default-option', (_, ...params) => deleteDefaultOption(...params));
ipcMain.handle('get-mc-versions', (_, ...params) => getMCVersions(...params));
ipcMain.handle('fetch-updated-mc-versions', async (_, ...params) => await fetchUpdatedMCVersions(...params));
ipcMain.handle('get-server-last-played', (_, ...params) => getServerLastPlayed(...params));
ipcMain.handle('set-server-last-played', (_, ...params) => setServerLastPlayed(...params));
ipcMain.handle('is-world-pinned', (_, ...params) => isWorldPinned(...params));
ipcMain.handle('is-instance-pinned', (_, ...params) => isInstancePinned(...params));
ipcMain.handle('pin-instance', (_, ...params) => pinInstance(...params));
ipcMain.handle('unpin-instance', (_, ...params) => unpinInstance(...params));
ipcMain.handle('pin-world', (_, ...params) => pinWorld(...params));
ipcMain.handle('unpin-world', (_, ...params) => unpinWorld(...params));
ipcMain.handle('get-pinned-instances', (_, ...params) => getPinnedInstances(...params));
ipcMain.handle('get-pinned-worlds', (_, ...params) => getPinnedWorlds(...params));

function getMaxConcurrentDownloads() {
    let r = db.prepare("SELECT * FROM defaults WHERE default_type = ?").get("max_concurrent_downloads");
    if (r?.value) return Number(r.value);
    return 10;
}

// update
try {
    switch (getDefault("saved_version")) {
        case "0.0.1":
        case "0.0.2":
        case "0.0.3":
        case "0.0.4":
        case "0.0.5":
        case "0.0.6":
        case "0.0.7":
            if (getDefault("default_page") == "my_account") setDefault("default_page", "wardrobe");
            db.prepare("ALTER TABLE skins DROP COLUMN file_name;").run();
            db.prepare("ALTER TABLE skins DROP COLUMN last_used;").run();
            db.prepare("ALTER TABLE capes DROP COLUMN last_used;").run();
        case "0.0.8":
        case "0.0.9":
        case "0.1.0":
        case "0.1.1":
            db.prepare("ALTER TABLE instances ADD failed INTEGER").run();
        case "0.2.0":
        case "0.3.0":
        case "0.4.0":
        case "0.4.1":
        case "0.4.2":
        case "0.4.3":
        case "0.4.4":
        case "0.5.0":
            db.prepare("ALTER TABLE skins ADD favorited INTEGER").run();
            db.prepare("ALTER TABLE skins ADD last_used TEXT").run();
            db.prepare("ALTER TABLE skins ADD preview TEXT").run();
            db.prepare("ALTER TABLE skins ADD preview_model TEXT").run();
            db.prepare("ALTER TABLE skins ADD head TEXT").run();
        case "0.6.0":
        case "0.6.1":
        case "0.6.2":
        case "0.6.3":
        case "0.6.4":
        case "0.6.5":
            db.prepare("ALTER TABLE instances ADD post_launch_hook TEXT").run();
            db.prepare("ALTER TABLE instances ADD uses_custom_java_args INTEGER").run();
            db.prepare("ALTER TABLE instances ADD provided_java_args TEXT").run();
        case "0.6.6":
        case "0.6.7":
            let java = new Java(db, user_path, win, translate);
            java.upgradeLegacy();
    }
} catch (e) { }

setDefault("saved_version", version);