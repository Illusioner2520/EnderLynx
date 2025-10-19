const { contextBridge, ipcRenderer, clipboard, nativeImage, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const { Minecraft, Java, Fabric, urlToFile, urlToFolder, Forge, NeoForge, Quilt } = require('./launch.js');
const { JavaSearch } = require('./java_scan.js');
const { spawn, exec } = require('child_process');
const nbt = require('prismarine-nbt');
const zlib = require('zlib');
const { Auth } = require('msmc');
const AdmZip = require('adm-zip');
const https = require('https');
const querystring = require('querystring');
const toml = require('toml');
const Database = require('better-sqlite3');
const axios = require('axios');
const FormData = require('form-data');
const sharp = require("sharp");
const crypto = require('crypto');
const os = require('os');
const ws = require("windows-shortcuts");
const MarkdownIt = require('markdown-it');
const { version } = require('./package.json');
const stringArgv = require('string-argv').default;
const pngToIco = require('png-to-ico');
const QRCode = require('qrcode');
const readline = require('readline');
const pLimit = require('p-limit').default;

let cfServerInfo = {};

const userPath = path.resolve(process.argv.find(arg => arg.startsWith('--userDataPath='))
    .split('=')[1]);

let enableDevMode = false;
let launchInstanceCallback = () => { };
let instance_id_to_launch = "";
let world_type_to_launch = "";
let world_id_to_launch = "";
let startingPage = null;

function processArgs(args) {

    const instanceArg = args.find(arg => arg.startsWith('--instance='));
    const worldTypeArg = args.find(arg => arg.startsWith('--worldType='));
    const worldIdArg = args.find(arg => arg.startsWith('--worldId='));

    enableDevMode = args.includes("--dev");

    let argsFromUrl = args.find(arg => arg.startsWith('enderlynx://'));
    if (argsFromUrl) argsFromUrl = argsFromUrl.split("/").slice(2);
    else argsFromUrl = [];
    if (argsFromUrl.includes("debug")) argsFromUrl.splice(argsFromUrl.indexOf("debug"), 1);
    argsFromUrl = argsFromUrl.map(decodeURIComponent);

    if (instanceArg) {
        if (instanceArg) instance_id_to_launch = instanceArg.split('=').toSpliced(0, 1).join('=');
        if (worldTypeArg) world_type_to_launch = worldTypeArg.split('=').toSpliced(0, 1).join('=');
        if (worldIdArg) world_id_to_launch = worldIdArg.split('=').toSpliced(0, 1).join('=');
    }

    if (argsFromUrl[0] == "launch") {
        if (argsFromUrl[1]) instance_id_to_launch = argsFromUrl[1];
        if (argsFromUrl[2]) world_type_to_launch = argsFromUrl[2];
        if (argsFromUrl[3]) world_id_to_launch = argsFromUrl[3];
    }

    startingPage = args.find(arg => arg.startsWith('--page='));
    if (startingPage) startingPage = startingPage.split("=")[1];

    if (argsFromUrl[0] == "page") {
        if (argsFromUrl[1]) startingPage = argsFromUrl[1];
    }

    if (launchInstanceCallback) {
        launchInstanceCallback({
            instance_id: instance_id_to_launch,
            world_type: world_type_to_launch,
            world_id: world_id_to_launch
        });
    }
}

processArgs(process.argv.slice(1));

if (!fs.existsSync(userPath)) {
    fs.mkdirSync(userPath, { recursive: true });
}
if (!fs.existsSync(path.resolve(userPath, "log_config.xml"))) {
    const srcConfigPath = path.resolve(__dirname, "log_config.xml");
    let configData;
    try {
        configData = fs.readFileSync(srcConfigPath);
        fs.writeFileSync(path.resolve(userPath, "log_config.xml"), configData);
    } catch (e) {
        fs.writeFileSync(path.resolve(userPath, "log_config.xml"), "");
    }
}
const srcConfigPath = path.resolve(__dirname, "updater.exe");
fs.mkdirSync(path.resolve(userPath, "updater"), { recursive: true })
let updaterData;
try {
    updaterData = fs.readFileSync(srcConfigPath);
    fs.writeFileSync(path.resolve(userPath, "updater", "updater.exe"), updaterData);
} catch (e) {

}

const db = new Database(path.resolve(userPath, "app.db"));

db.prepare('CREATE TABLE IF NOT EXISTS instances (id INTEGER PRIMARY KEY, name TEXT, date_created TEXT, date_modified TEXT, last_played TEXT, loader TEXT, vanilla_version TEXT, loader_version TEXT, playtime INTEGER, locked INTEGER, downloaded INTEGER, group_id TEXT, image TEXT, instance_id TEXT, java_version INTEGER, java_path TEXT, current_log_file TEXT, pid INTEGER, install_source TEXT, install_id TEXT, installing INTEGER, mc_installed INTEGER, window_width INTEGER, window_height INTEGER, allocated_ram INTEGER, attempted_options_txt_version INTEGER, java_args TEXT, env_vars TEXT, pre_launch_hook TEXT, wrapper TEXT, post_exit_hook TEXT, installed_version TEXT, last_analyzed_log TEXT)').run();
db.prepare('CREATE TABLE IF NOT EXISTS profiles (id INTEGER PRIMARY KEY, access_token TEXT, client_id TEXT, expires TEXT, name TEXT, refresh_token TEXT, uuid TEXT, xuid TEXT, is_demo INTEGER, is_default INTEGER)').run();
db.prepare('CREATE TABLE IF NOT EXISTS defaults (id INTEGER PRIMARY KEY, default_type TEXT, value TEXT)').run();
db.prepare('CREATE TABLE IF NOT EXISTS content (id INTEGER PRIMARY KEY, name TEXT, author TEXT, disabled INTEGER, image TEXT, file_name TEXT, source TEXT, type TEXT, version TEXT, version_id TEXT, instance TEXT, source_info TEXT)').run();
db.prepare('CREATE TABLE IF NOT EXISTS skins (id INTEGER PRIMARY KEY, name TEXT, model TEXT, active_uuid TEXT, skin_id TEXT, skin_url TEXT, default_skin INTEGER, texture_key TEXT)').run();
db.prepare('CREATE TABLE IF NOT EXISTS capes (id INTEGER PRIMARY KEY, uuid TEXT, cape_name TEXT, cape_id TEXT, cape_url TEXT, active INTEGER)').run();
db.prepare('CREATE TABLE IF NOT EXISTS options_defaults (id INTEGER PRIMARY KEY, key TEXT, value TEXT, version TEXT)').run();
db.prepare('CREATE TABLE IF NOT EXISTS pins (id INTEGER PRIMARY KEY, type TEXT, instance_id TEXT, world_id TEXT, world_type TEXT)').run();
db.prepare('CREATE TABLE IF NOT EXISTS mc_versions_cache (id INTEGER PRIMARY KEY, name TEXT, date_published TEXT)').run();
db.prepare('CREATE TABLE IF NOT EXISTS last_played_servers (id INTEGER PRIMARY KEY, instance_id TEXT, ip TEXT, date TEXT)').run();

db.pragma('journal_mode = WAL');

let vt_rp = {}, vt_dp = {}, vt_ct = {};

let processWatches = {};

class LoginError extends Error {
    constructor(message) {
        super(message);
    }
}

function openInBrowser(url) {
    shell.openExternal(url);
}

function readELPack(file_path) {
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

ipcRenderer.on('new-args', (event, newargs) => {
    processArgs(newargs.slice(1));
});

contextBridge.exposeInMainWorld('electronAPI', {
    onOpenFile: (callback) => {
        ipcRenderer.on('open-file', (event, filePath) => {
            callback(readELPack(filePath), filePath);
        });
    },
    getMaxConcurrentDownloads,
    version: enableDevMode ? version + "-dev" : version,
    userPath,
    isDev: enableDevMode,
    resourcePath: process.resourcesPath,
    osplatform: () => os.platform(),
    osrelease: () => os.release(),
    osarch: () => os.arch(),
    osversion: () => os.version?.() || `${os.type()} ${os.release()}`,
    electronversion: process.versions.electron,
    nodeversion: process.versions.node,
    chromeversion: process.versions.chrome,
    v8version: process.versions.v8,
    cpuUsage: process.getCPUUsage,
    memUsage: process.getProcessMemoryInfo,
    getAppMetrics: async () => {
        let appMetrics = await ipcRenderer.invoke('get-app-metrics');
        return appMetrics;
    },
    getInstanceFiles: (instance_id) => {
        const dirPath = path.resolve(userPath, "minecraft", "instances", instance_id);
        if (!fs.existsSync(dirPath)) return [];
        function getAllFilesRecursive(baseDir, relDir = "") {
            const absDir = path.join(baseDir, relDir);
            let results = [];
            const entries = fs.readdirSync(absDir, { withFileTypes: true });
            if (entries.length == 0) {
                results.push(relDir.replace(/\\/g, "//"));
            }
            for (const entry of entries) {
                const relPath = path.join(relDir, entry.name);
                if (entry.isDirectory()) {
                    results = results.concat(getAllFilesRecursive(baseDir, relPath));
                } else {
                    results.push(relPath.replace(/\\/g, "//"));
                }
            }
            return results;
        }
        return getAllFilesRecursive(dirPath);
    },
    parseModrinthMarkdown: (md) => {
        const mkd = new MarkdownIt('default', {
            html: true,
            linkify: true,
            breaks: false
        });

        const defaultRender = mkd.renderer.rules.link_open || function (tokens, idx, options, env, self) {
            return self.renderToken(tokens, idx, options);
        };

        mkd.renderer.rules.link_open = function (tokens, idx, options, env, self) {
            const token = tokens[idx];

            const hrefIndex = token.attrIndex('href');
            if (hrefIndex !== -1) {
                const href = token.attrs[hrefIndex][1];

                token.attrs.splice(hrefIndex, 1);

                token.attrPush(['data-href', href]);
                token.attrPush(['class', 'external-link']);
                token.attrPush([
                    'tabindex',
                    "0"
                ])
            }

            return defaultRender(tokens, idx, options, env, self);
        };

        return mkd.render(md);
    },
    openInBrowser,
    getRandomModpacks: () => {
        return new Promise((resolve) => {
            let indexes = ["relevance", "downloads", "follows", "newest", "updated"];
            let index = indexes[Math.floor(Math.random() * indexes.length)];
            let offset = Math.floor(Math.random() * 10000);
            try {
                fetch(`https://api.modrinth.com/v2/search?facets=[["project_type:modpack"]]&index=${index}&offset=${offset}&limit=10`).then(response => {
                    response.json().then(data => resolve(data));
                });
            } catch (e) {
                resolve([]);
            }
        });
    },
    getPinnedWorlds: async () => {
        let worlds = db.prepare("SELECT * FROM pins WHERE type = ?").all("world");
        let allWorlds = [];
        for (const world of worlds) {
            if (!world.world_id) continue;
            if (world.world_type == "singleplayer") {
                const worldPath = path.resolve(userPath, "minecraft/instances", world.instance_id || "", "saves", world.world_id, "level.dat");
                if (fs.existsSync(worldPath)) {
                    try {
                        const worldInfo = getWorld(worldPath);
                        allWorlds.push({
                            ...worldInfo,
                            pinned: true,
                            type: "singleplayer",
                            instance_id: world.instance_id
                        });
                    } catch (e) { }
                } else { }
            } else {
                // Multiplayer: find the server info from servers.dat in the instance
                const serversDatPath = path.resolve(userPath, "minecraft/instances", world.instance_id || "", "servers.dat");
                if (fs.existsSync(serversDatPath)) {
                    console.log("FOUND servers.dat");
                    try {
                        const buffer = fs.readFileSync(serversDatPath);
                        const data = await nbt.parse(buffer);
                        const servers = data.parsed?.value?.servers?.value?.value || [];
                        const server = servers.find(s => (s.ip?.value || "") === world.world_id);
                        if (server) {
                            console.log("Found server");
                            allWorlds.push({
                                type: "multiplayer",
                                name: server.name?.value || "Unknown",
                                ip: server.ip?.value || "",
                                icon: server.icon?.value ? "data:image/png;base64," + server.icon?.value : "",
                                pinned: true,
                                instance_id: world.instance_id
                            });
                        }
                    } catch (e) {
                        console.error(e);
                    }
                }
            }
        }
        return allWorlds;
    },
    getAllServers: async (instance_ids) => {
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
    },
    getRecentlyPlayedWorlds: (instance_ids) => {
        if (!Array.isArray(instance_ids) || instance_ids.length === 0) return [];
        const instancesPath = path.resolve(userPath, "minecraft/instances");
        let allWorlds = [];
        for (const instanceId of instance_ids) {
            const savesPath = path.join(instancesPath, instanceId, "saves");
            if (!fs.existsSync(savesPath)) continue;
            const worlds = getWorlds(savesPath).map(world => ({
                ...world,
                instance_id: instanceId
            }));
            allWorlds = allWorlds.concat(worlds);
        }
        allWorlds.sort((a, b) => (b.last_played || 0) - (a.last_played || 0));
        return allWorlds.slice(0, 5);
    },
    setOptionsTXT: (instance_id, content, dont_complete_if_already_exists) => {
        const optionsPath = path.resolve(userPath, `minecraft/instances/${instance_id}/options.txt`);
        let alreadyExists = fs.existsSync(optionsPath);
        if (dont_complete_if_already_exists && alreadyExists) {
            return content.version;
        }
        if (!alreadyExists) {
            fs.writeFileSync(optionsPath, content.content, "utf-8");
            return content.version;
        } else {
            let lines = fs.readFileSync(optionsPath, "utf-8").split(/\r?\n/);
            for (let j = 0; j < content.keys.length; j++) {
                let key = content.keys[j];
                let value = content.values[j];
                let found = false;
                inner: for (let i = 0; i < lines.length; i++) {
                    if (lines[i].trim().startsWith(key + ":")) {
                        lines[i] = `${key}:${value}`;
                        found = true;
                        break inner;
                    }
                }
                if (!found) {
                    lines.push(`${key}:${value}`);
                }
            }
            fs.writeFileSync(optionsPath, lines.filter(Boolean).join("\n"), "utf-8");
        }
    },
    deleteWorld: (instance_id, world_id) => {
        const savesPath = path.resolve(userPath, `minecraft/instances/${instance_id}/saves`);
        const worldPath = path.join(savesPath, world_id);

        try {
            if (fs.existsSync(worldPath)) {
                fs.rmSync(worldPath, { recursive: true, force: true });
                return true;
            }
            return false;
        } catch (err) {
            return false;
        }
    },
    deleteInstanceFiles: async (instance_id) => {
        const instancePath = path.resolve(userPath, `minecraft/instances/${instance_id}`);
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

        try {
            const allFiles = await getAllFiles(instancePath);
            let deleted = 0;
            for (const file of allFiles) {
                await fs.promises.unlink(file);
                deleted++;
                const percent = Math.round((deleted / allFiles.length) * 100);
                ipcRenderer.send('progress-update', 'Deleting Instance', percent, `Deleting ${path.basename(file)} (${deleted} of ${allFiles.length})`);
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
            await removeDirs(instancePath);
            ipcRenderer.send('progress-update', 'Deleting Instance', 100, 'Instance deleted');
            return true;
        } catch (err) {
            ipcRenderer.send('progress-update', 'Deleting Instance', 100, 'Error deleting instance');
            throw err;
        }
    },
    duplicateInstanceFiles: async (old_instance_id, new_instance_id) => {
        const src = path.resolve(userPath, `minecraft/instances/${old_instance_id}`);
        const dest = path.resolve(userPath, `minecraft/instances/${new_instance_id}`);
        if (!fs.existsSync(src)) return false;
        await fs.promises.mkdir(dest, { recursive: true });
        // Get all files and folders in the source directory
        const entries = await fs.promises.readdir(src, { withFileTypes: true });
        const total = entries.length;
        let completed = 0;

        for (const entry of entries) {
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
            ipcRenderer.send('progress-update', `Duplicating Instance`, percent, `Copying ${entry.name} (${completed} of ${total})`);
        }
        return true;
    },
    updateOptionsTXT: (instance_id, key, value) => {
        const optionsPath = path.resolve(userPath, `minecraft/instances/${instance_id}/options.txt`);
        let lines = [];
        if (fs.existsSync(optionsPath)) {
            lines = fs.readFileSync(optionsPath, "utf-8").split(/\r?\n/);
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
        fs.writeFileSync(optionsPath, lines.filter(Boolean).join("\n"), "utf-8");
    },
    urlToFolder,
    databaseGet: (sql, ...params) => {
        return db.prepare(sql).get(...params);
    },
    databaseAll: (sql, ...params) => {
        return db.prepare(sql).all(...params);
    },
    databaseRun: (sql, ...params) => {
        return db.prepare(sql).run(...params);
    },
    readFile: (...filePath) => {
        try {
            const content = fs.readFileSync(path.resolve(...filePath), 'utf-8');
            return content;
        } catch (err) {
            return `Error reading file: ${err.message}`;
        }
    },
    playMinecraft: async (loader, version, loaderVersion, instance_id, player_info, quickPlay, customResolution, allocatedRam, javaPath, javaArgs, envVars, preLaunch, wrapper, postExit) => {
        if (!player_info) throw new LoginError("Please sign in to your Microsoft account to play Minecraft.");

        let date = new Date();
        date.setHours(date.getHours() - 1);
        if (new Date(player_info.expires) < date) {
            try {
                player_info = await getNewAccessToken(player_info.refresh_token);
            } catch (err) {
                throw new Error("Unable to update access token.");
            }
        }
        let mc = new Minecraft(instance_id);
        try {
            return {
                "minecraft": await mc.launchGame(loader, version, loaderVersion, player_info.name, player_info.uuid, {
                    "accessToken": player_info.access_token,
                    "xuid": player_info.xuid,
                    "clientId": player_info.client_id
                }, customResolution, quickPlay, false, allocatedRam, javaPath, parseJavaArgs(javaArgs), parseEnvString(envVars), preLaunch, parseJavaArgs(wrapper), postExit), "player_info": player_info
            };
        } catch (err) {
            throw new Error("Unable to launch Minecraft");
        }
    },
    getJavaInstallation: async (v) => {
        let java = new Java();
        return java.getJavaInstallation(v);
    },
    setJavaInstallation: async (v, f) => {
        let java = new Java();
        java.setJavaInstallation(v, f);
    },
    getFabricVanillaVersions: async () => {
        let fabric = new Fabric();
        return await fabric.getSupportedVanillaVersions();
    },
    getFabricLoaderVersions: async (v) => {
        let fabric = new Fabric();
        return await fabric.getVersions(v);
    },
    checkForProcess,
    clearActivity: () => ipcRenderer.send('remove-discord-activity'),
    setActivity: (activity) => {
        let rpc_enabled = db.prepare("SELECT * FROM defaults WHERE default_type = ?").get("discord_rpc");
        let enabled = rpc_enabled?.value ? rpc_enabled.value == "true" : true;
        if (!enabled) return;
        ipcRenderer.send('set-discord-activity', activity)
    },
    killProcess: async (pid) => {
        if (!pid) return false;
        pid = Number(pid);

        return new Promise((resolve) => {
            exec(`taskkill /PID ${pid} /T`, (error) => {
                if (error) {
                    console.log(`Graceful taskkill failed: ${error.message}`);
                }

                let elapsed = 0;
                const interval = setInterval(() => {
                    if (!checkForProcess(pid)) {
                        clearInterval(interval);
                        return resolve(true);
                    }

                    elapsed += 500;
                    if (elapsed >= 5000) {
                        clearInterval(interval);
                        exec(`taskkill /PID ${pid} /T /F`, (forceError) => {
                            if (forceError) {
                                console.log(`Force kill failed: ${forceError.message}`);
                            }
                            const stillAlive = checkForProcess(pid);
                            resolve(!stillAlive);
                        });
                    }
                }, 500);
            });
        });
    },
    getWorlds,
    getSinglePlayerWorlds,
    addServer,
    deleteServer: async (instance_id, ip, index) => {
        let patha = path.resolve(userPath, `minecraft/instances/${instance_id}`);
        let serversDatPath = path.resolve(patha, 'servers.dat');

        if (!fs.existsSync(serversDatPath)) return false;
        try {
            const buffer = fs.readFileSync(serversDatPath);
            const data = await nbt.parse(buffer);
            let servers = data.parsed.value.servers.value.value || [];
            const originalLength = servers.length;
            for (let i = 0; i < ip.length; i++) {
                if (servers[index[i]].ip?.value == ip[i]) {
                    servers[index[i]] = null;
                }
            }
            servers = servers.filter(e => e);
            if (servers.length === originalLength) return false;

            data.parsed.value.servers.value.value = servers;

            const newBuffer = nbt.writeUncompressed(data.parsed);
            fs.writeFileSync(serversDatPath, newBuffer);
            return true;
        } catch (e) {
            console.error("Failed to delete server from servers.dat:", e);
            return false;
        }
    },
    getMultiplayerWorlds,
    openFolder,
    openFolderFromFile: (file_path) => {
        const folder = path.dirname(file_path);
        openFolder(folder);
    },
    triggerMicrosoftLogin: async () => {
        let date = new Date();
        date.setHours(date.getHours() + 1);
        const authManager = new Auth("select_account");
        const xboxManager = await authManager.launch("raw");
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
    },
    getInstanceLogs: (instance_id) => {
        let patha = path.resolve(userPath, `minecraft/instances/${instance_id}/logs`);
        fs.mkdirSync(patha, { recursive: true });
        return fs.readdirSync(patha).filter(e => e.includes(".log") && !e.includes("latest") && !e.includes(".gz")).map(e => {
            let date = e.replace(".log", "").split("_");
            if (date[1]) date[1] = date[1].replaceAll("-", ":");
            let dateStr = date.join(" ");
            let parsedDate = new Date(dateStr);
            return ({
                "date": isNaN(parsedDate.getTime()) ? e : parsedDate.toString(),
                "file_path": path.resolve(patha, e)
            });
        });
    },
    getLog: (log_path) => {
        return fs.readFileSync(log_path, { encoding: 'utf8', flag: 'r' });
    },
    deleteLogs: (log_path) => {
        try {
            fs.unlinkSync(log_path);
            return true;
        } catch (e) {
            return false;
        }
    },
    deleteAllLogs: (instance_id, current_log_file) => {
        let folderPath = path.resolve(userPath, `minecraft/instances/${instance_id}/logs`);
        if (!fs.existsSync(folderPath)) {
            console.error('Folder does not exist:', folderPath);
            return;
        }

        const files = fs.readdirSync(folderPath);

        for (const file of files) {
            const filePath = path.join(folderPath, file);
            if (fs.lstatSync(filePath).isFile() && path.resolve(filePath) !== path.resolve(current_log_file)) {
                fs.unlinkSync(filePath);
            }
        }

        return true;
    },
    getInstanceContent: (loader, instance_id, old_content) => {
        let old_files = old_content.map((e) => e.file_name);
        let patha = path.resolve(userPath, `minecraft/instances/${instance_id}/mods`);
        let pathb = path.resolve(userPath, `minecraft/instances/${instance_id}/resourcepacks`);
        let pathc = path.resolve(userPath, `minecraft/instances/${instance_id}/shaderpacks`);
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
            const filePath = path.resolve(pathc, file);
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
    },
    downloadVanillaTweaksDataPacks: async (packs, version, instance_id, world_id) => {
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

        console.log(data_json);
        console.log(data_ct_json);

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

        const datapacksDir = path.resolve(userPath, `minecraft/instances/${instance_id}/saves/${world_id}/datapacks`);
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

            // return baseName;
        }
        if (data_vt.link) {
            const tempDir = path.resolve(userPath, `minecraft/instances/${instance_id}/temp_datapacks`);
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
    },
    downloadVanillaTweaksResourcePacks: async (packs, version, instance_id) => {
        let link = await getVanillaTweaksResourcePackLink(packs, version);
        if (link) {
            const resourcepacksDir = path.resolve(userPath, `minecraft/instances/${instance_id}/resourcepacks`);
            fs.mkdirSync(resourcepacksDir, { recursive: true });
            let baseName = "vanilla_tweaks.zip";
            let filePath = path.join(resourcepacksDir, baseName);
            let counter = 1;
            while (fs.existsSync(filePath)) {
                baseName = `vanilla_tweaks_${counter}.zip`;
                filePath = path.join(resourcepacksDir, baseName);
                counter++;
            }
            await urlToFile(link, filePath);

            return baseName;
        } else {
            return false;
        }
    },
    getVanillaTweaksResourcePacks: async (query = "", version = "1.21") => {
        query = query.toLowerCase().trim();
        if (version.split(".").length > 2) {
            version = version.split(".").splice(0, 2).join(".");
        }
        let data_json = vt_rp[version];
        if (!vt_rp[version]) {
            let data = await fetch(`https://vanillatweaks.net/assets/resources/json/${version}/rpcategories.json?${(new Date()).getTime()}`);
            data_json = await data.json();
            vt_rp[version] = data_json;
        }

        let return_data = {};
        return_data.hits = [];

        let process_category = (category, previous_categories = []) => {
            previous_categories.push(category.category);
            let packs = category.packs;
            packs = packs.map(e => ({
                "title": e.display,
                "description": e.description,
                "icon_url": `https://vanillatweaks.net/assets/resources/icons/resourcepacks/${version}/${e.name}.png`,
                "categories": [
                    previous_categories.join(" > ")
                ],
                "author": "Vanilla Tweaks",
                "incompatible": e.incompatible,
                "vt_id": e.name,
                "experiment": e.experiment
            }));
            packs = packs.filter(e => e.title.toLowerCase().includes(query) || e.description.toLowerCase().includes(query) || e.categories.join().toLowerCase().includes(query));
            return_data.hits = return_data.hits.concat(packs);
            if (category.categories) {
                category.categories.forEach(e => {
                    process_category(e, structuredClone(previous_categories));
                })
            }
        }
        for (let i = 0; i < data_json.categories.length; i++) {
            process_category(data_json.categories[i]);
        }
        return return_data;
    },
    getVanillaTweaksDataPacks: async (query = "", version = "1.21") => {
        query = query.toLowerCase().trim();
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


        let return_data = {};
        return_data.hits = [];

        let process_category = (category, type) => {
            let packs = category.packs;
            packs = packs.map(e => ({
                "title": e.display,
                "description": e.description,
                "icon_url": `https://vanillatweaks.net/assets/resources/icons/${type == "dp" ? "datapacks" : "craftingtweaks"}/${version}/${e.name}.png`,
                "categories": [
                    category.category
                ],
                "author": "Vanilla Tweaks",
                "incompatible": e.incompatible,
                "vt_id": e.name,
                "type": type,
                "experiment": e.experiment
            }));
            packs = packs.filter(e => e.title.toLowerCase().includes(query) || e.description.toLowerCase().includes(query) || e.categories.join().toLowerCase().includes(query));
            return_data.hits = return_data.hits.concat(packs);
            if (category.categories) {
                category.categories.forEach(e => {
                    process_category(e);
                })
            }
        }
        for (let i = 0; i < data_json.categories.length; i++) {
            process_category(data_json.categories[i], "dp");
        }
        for (let i = 0; i < data_ct_json.categories.length; i++) {
            process_category(data_ct_json.categories[i], "ct");
        }
        return return_data;
    },
    onProgressUpdate: (callback) => {
        ipcRenderer.on('progress-update', (_event, title, progress, desc) => {
            callback(title, progress, desc);
        });
    },
    onErrorMessage: (callback) => {
        ipcRenderer.on('display-error', (_event, message) => {
            callback(message);
        });
    },
    isOtherStartingPage: () => {
        if (startingPage) return startingPage;
        return false;
    },
    onLaunchInstance: async (callback) => {
        launchInstanceCallback = callback;
        if (instance_id_to_launch) callback({
            instance_id: instance_id_to_launch,
            world_type: world_type_to_launch,
            world_id: world_id_to_launch
        });
    },
    getVanillaVersions: async () => {
        let res = await fetch("https://launchermeta.mojang.com/mc/game/version_manifest.json");
        let json = await res.json();
        return json.versions.map(e => e.id);
    },
    getFabricVersions: async () => {
        let fabric = new Fabric();
        return await fabric.getSupportedVanillaVersions();
    },
    getForgeVersions: async () => {
        let forge = new Forge();
        return await forge.getSupportedVanillaVersions();
    },
    getNeoForgeVersions: async () => {
        let neoforge = new NeoForge();
        return await neoforge.getSupportedVanillaVersions();
    },
    getQuiltVersions: async () => {
        let quilt = new Quilt();
        return await quilt.getSupportedVanillaVersions();
    },
    getInstanceFolderName: (instance_id) => {
        instance_id = instance_id.trim();
        instance_id = instance_id.replace(/[^0-9a-zA-Z\-._]/g, "_");
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
        while (folderExists(path.resolve(userPath, `minecraft/instances/${instance_id}`))) {
            instance_id = `${baseInstanceId}_${counter}`;
            counter++;
        }
        fs.mkdirSync(path.resolve(userPath, `minecraft/instances/${instance_id}`), { recursive: true });
        return instance_id;
    },
    getInstanceFolders: (instance_id) => {
        const instancePath = path.resolve(userPath, `minecraft/instances/${instance_id}`);
        if (!fs.existsSync(instancePath)) return [];
        const entries = fs.readdirSync(instancePath).map(name => {
            const fullPath = path.join(instancePath, name);
            const stat = fs.statSync(fullPath);
            return {
                name: stat.isDirectory() ? '<i class="fa-solid fa-folder"></i> ' + name : '<i class="fa-solid fa-file"></i> ' + name,
                isDirectory: stat.isDirectory(),
                isFile: stat.isFile(),
                path: fullPath,
                value: fullPath
            };
        });
        // Folders first, then files
        return [
            ...entries.filter(e => e.isDirectory),
            ...entries.filter(e => e.isFile)
        ];
    },
    downloadMinecraft: async (instance_id, loader, vanilla_version, loader_version) => {
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
        return { "java_installation": r.java_installation.replaceAll("\\", "/"), "java_version": r.java_version };
    },
    repairMinecraft: async (instance_id, loader, vanilla_version, loader_version, whatToRepair) => {
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
        return { "java_installation": r.java_installation ? r.java_installation.replaceAll("\\", "/") : r.java_installation, "java_version": r.java_version };
    },
    getForgeVersion: async (mcversion) => {
        let forge = new Forge();
        return (await forge.getVersions(mcversion)).reverse()[0];
    },
    getFabricVersion: async (mcversion) => {
        let fabric = new Fabric();
        return (await fabric.getVersions(mcversion))[0];
    },
    getNeoForgeVersion: async (mcversion) => {
        let neoforge = new NeoForge();
        return (await neoforge.getVersions(mcversion))[0];
    },
    getQuiltVersion: async (mcversion) => {
        let quilt = new Quilt();
        return (await quilt.getVersions(mcversion))[0];
    },
    getForgeLoaderVersions: async (mcversion) => {
        let forge = new Forge();
        return (await forge.getVersions(mcversion)).reverse();
    },
    getFabricLoaderVersions: async (mcversion) => {
        let fabric = new Fabric();
        return (await fabric.getVersions(mcversion));
    },
    getNeoForgeLoaderVersions: async (mcversion) => {
        let neoforge = new NeoForge();
        return (await neoforge.getVersions(mcversion));
    },
    getQuiltLoaderVersions: async (mcversion) => {
        let quilt = new Quilt();
        return (await quilt.getVersions(mcversion));
    },
    watchFile: (filepath, callback) => {
        let lastSize = 0;

        fs.stat(filepath, (err, stats) => {

            if (err) {
                return console.error('Failed to stat file:', err);
            }

            lastSize = stats.size;

            fs.watchFile(filepath, { interval: 1000 }, (curr, prev) => {
                const newSize = curr.size;

                if (newSize > lastSize) {
                    const stream = fs.createReadStream(filepath, {
                        start: lastSize,
                        end: newSize,
                        encoding: 'utf8'
                    });

                    stream.on('data', (chunk) => {
                        callback(chunk);
                    });

                    stream.on('error', (err) => {
                        console.error('Error reading file:', err);
                    });

                    lastSize = newSize;
                }
            });
        });
    },
    stopWatching: (filepath) => {
        fs.unwatchFile(filepath);
    },
    clearProcessWatches: () => {
        let keys = Object.keys(processWatches);
        for (let i = 0; i < keys.length; i++) {
            clearInterval(processWatches[keys[i]]['interval']);
            delete processWatches[keys[i]];
        }
    },
    watchProcessForExit: (pid, callback) => {
        if (processWatches[pid]) {
            processWatches[pid]['callback'] = callback;
        } else {
            processWatches[pid] = {};
            processWatches[pid]['callback'] = callback;
            const timer = setInterval(() => {
                try {
                    process.kill(pid, 0);
                } catch (err) {
                    if (err.code === 'ESRCH') {
                        clearInterval(timer);
                        processWatches[pid]['callback']();
                        delete processWatches[pid];
                    } else {
                        processWatches[pid]['callback']();
                    }
                }
            }, 1000);
            processWatches[pid]['interval'] = timer;
        }
    },
    // mod, modpack, resourcepack, shader, datapack
    modrinthSearch: async (query, loader, project_type, version, page = 1, pageSize = 20, sortBy = "relevance") => {
        let sort = sortBy;
        let facets = [];
        if (loader && ["modpack", "mod"].includes(project_type)) facets.push([`categories:${loader}`]);
        if (version) facets.push([`versions:${version}`]);
        facets.push([`project_type:${project_type}`]);
        let url = `https://api.modrinth.com/v2/search?query=${query}&facets=${JSON.stringify(facets)}&limit=${pageSize}&offset=${(page - 1) * pageSize}&index=${sort}`;
        let res = await fetch(url);
        return await res.json();
    },
    curseforgeSearch: async (query, loader, project_type, version, page = 1, pageSize = 20, sortBy = "relevance") => {
        if (project_type == "server") {
            if (cfServerInfo[page] && Date.now() - cfServerInfo[page].time < 3600000) {
                return cfServerInfo[page].info;
            }
            let url = `https://mcservers.forgecdn.net/servers/api/servers?page=${page}`;
            let res = await fetch(url);
            let json = await res.json();
            cfServerInfo[page] = {};
            cfServerInfo[page].time = Date.now();
            cfServerInfo[page].info = json;
            return json;
        }
        let sort = 1;
        if (sortBy == "downloads") sort = 6;
        if (sortBy == "newest") sort = 5;
        if (sortBy == "updated") sort = 3;
        let gv = "";
        if (version) gv = "&gameVersion=" + version;
        let gf = "";
        if (loader && project_type == "mod") gf = "&gameFlavors[0]=" + ["", "forge", "", "", "fabric", "quilt", "neoforge"].indexOf(loader);
        let ci = "";
        let id = 0;
        if (project_type == "mod") id = 6;
        if (project_type == "modpack") id = 4471;
        if (project_type == "resourcepack") id = 12;
        if (project_type == "shader") id = 6552;
        if (project_type == "world") id = 17;
        if (project_type == "datapack") id = 6945;
        if (project_type) ci = "&classId=" + id;
        let url = `https://www.curseforge.com/api/v1/mods/search?gameId=432&index=${page - 1}&filterText=${query}${gv}&pageSize=${pageSize}&sortField=${sort}${gf}${ci}`;
        let res = await fetch(url);
        return await res.json();
    },
    deleteContent: async (instance_id, project_type, filename) => {
        let install_path = "";
        if (project_type == "mod") {
            install_path = path.resolve(userPath, `minecraft/instances/${instance_id}/mods`, filename);
        } else if (project_type == "resource_pack") {
            install_path = path.resolve(userPath, `minecraft/instances/${instance_id}/resourcepacks`, filename);
        } else if (project_type == "shader") {
            install_path = path.resolve(userPath, `minecraft/instances/${instance_id}/shaderpacks`, filename);
        }
        if (fs.existsSync(install_path)) {
            fs.unlinkSync(install_path);
            return true;
        }
        return false;
    },
    addContent: async (instance_id, project_type, project_url, filename, data_pack_world) => {
        if (project_type == "server") {
            let v = await addServer(instance_id, project_url, filename, data_pack_world);
            return v;
        }

        let install_path = "";
        if (project_type == "mod") {
            install_path = path.resolve(userPath, `minecraft/instances/${instance_id}/mods`, filename);
        } else if (project_type == "resourcepack" || project_type == "resource_pack") {
            install_path = path.resolve(userPath, `minecraft/instances/${instance_id}/resourcepacks`, filename);
        } else if (project_type == "shader") {
            install_path = path.resolve(userPath, `minecraft/instances/${instance_id}/shaderpacks`, filename);
        } else if (project_type == "world") {
            install_path = path.resolve(userPath, `minecraft/instances/${instance_id}/temp_worlds`, filename);
        } else if (project_type == "datapack" || project_type == "data_pack") {
            install_path = path.resolve(userPath, `minecraft/instances/${instance_id}/saves/${data_pack_world}/datapacks`, filename);
        }

        console.log("Installing", project_url, "to", install_path);

        await urlToFile(project_url, install_path);

        if (project_type === "world") {
            const savesPath = path.resolve(userPath, `minecraft/instances/${instance_id}/saves`);
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
            entries.forEach(entry => {
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
                    fs.writeFileSync(destPath, entry.getData());
                }
            });

            // Optionally delete the temp world zip after extraction
            fs.unlinkSync(install_path);
            const tempWorldPath = path.resolve(userPath, `minecraft/instances/${instance_id}/temp_worlds`);
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
            file_name: filename
        };
    },
    parseJavaArgs,
    downloadModrinthPack: async (instance_id, url, title) => {
        ipcRenderer.send('progress-update', `Downloading ${title}`, 0, "Beginning download...");
        await urlToFile(url, path.resolve(userPath, `minecraft/instances/${instance_id}/pack.mrpack`));
        ipcRenderer.send('progress-update', `Downloading ${title}`, 100, "Done!");
    },
    downloadCurseforgePack: async (instance_id, url, title) => {
        ipcRenderer.send('progress-update', `Downloading ${title}`, 0, "Beginning download...");
        await urlToFile(url, path.resolve(userPath, `minecraft/instances/${instance_id}/pack.zip`));
        ipcRenderer.send('progress-update', `Downloading ${title}`, 100, "Done!");
    },
    processPackFile: async (file_path, instance_id, title) => {
        if (/^https?:\/\//.test(file_path)) {
            const destPath = path.resolve(userPath, `minecraft/instances/${instance_id}/pack.zip`);
            try {
                await urlToFile(file_path, destPath);
            } catch (e) {
                return false;
            }
            file_path = destPath;
        }
        let extension = path.extname(file_path);
        console.log(extension);
        if (extension == ".mrpack") {
            return await processMrPack(instance_id, file_path, null, title);
        } else if (extension == ".zip") {
            return await processCfZipWithoutID(instance_id, file_path, null, title);
        } else if (extension == ".elpack") {
            return await processElPack(instance_id, file_path, null, title);
        } else if (extension == "") {
            return;
            return await processFolder(instance_id, file_path, title);
        }
    },
    processMrPack,
    processCfZip,
    getScreenshots: (instance_id) => {
        let screenshotsPath = path.resolve(userPath, `minecraft/instances/${instance_id}/screenshots`);
        fs.mkdirSync(screenshotsPath, { recursive: true });
        let files = fs.readdirSync(screenshotsPath)
            .filter(file => /\.(png|jpg|jpeg|bmp|gif)$/i.test(file))
            .map(file => {
                let date = file.replace(".png", "").split("_");
                if (date[1]) date[1] = date[1].replaceAll(".", ":");
                if (date[2]) date = [date[0], date[1]]
                let dateStr = date.join(" ");
                let parsedDate = new Date(dateStr);

                return {
                    file_name: isNaN(parsedDate.getTime()) ? file : parsedDate.toString(),
                    file_path: path.resolve(userPath, `minecraft/instances/${instance_id}/screenshots/` + file).replace(/\\/g, '/')
                }
            });
        return files;
    },
    copyToClipboard: async (text) => {
        clipboard.writeText(text);
        return true;
    },
    copyImageToClipboard: async (file_path) => {
        try {
            let image;
            if (/^https?:\/\//.test(file_path)) {
                // file_path is a URL, download it first
                const response = await axios.get(file_path, { responseType: "arraybuffer" });
                let buffer = await sharp(response.data).png().toBuffer();
                image = nativeImage.createFromBuffer(buffer);
            } else {
                image = nativeImage.createFromPath(file_path);
            }
            clipboard.writeImage(image);
            return true;
        } catch (err) {
            return false;
        }
    },
    deleteScreenshot: (file_path) => {
        try {
            fs.unlinkSync(file_path);
            return true;
        } catch (err) {
            return false;
        }
    },
    disableFile: (file_path) => {
        try {
            const disabledPath = file_path.endsWith('.disabled') ? file_path : file_path + '.disabled';
            fs.renameSync(file_path, disabledPath);
            return path.basename(disabledPath);
        } catch (err) {
            return false;
        }
    },
    enableFile: (file_path) => {
        try {
            if (file_path.endsWith('.disabled')) {
                const enabledPath = file_path.slice(0, -9);
                fs.renameSync(file_path, enabledPath);
                return path.basename(enabledPath);
            }
            return false;
        } catch (err) {
            return false;
        }
    },
    getSkinFromUsername,
    getSkinFromURL,
    downloadSkin,
    downloadCape: async (url, id) => {
        if (!url.includes("textures.minecraft.net")) throw new Error("Attempted XSS");
        await urlToFile(url, path.resolve(userPath, `minecraft/capes/${id}.png`));
    },
    setCape: async (player_info, cape_id) => {
        let date = new Date();
        date.setHours(date.getHours() - 1);
        if (new Date(player_info.expires) < date) {
            try {
                player_info = await getNewAccessToken(player_info.refresh_token);
            } catch (err) {
                throw new Error("Unable to update access token.");
            }
        }
        if (cape_id) {
            const res = await axios.put(
                'https://api.minecraftservices.com/minecraft/profile/capes/active',
                { capeId: cape_id },
                {
                    headers: {
                        Authorization: `Bearer ${player_info.access_token}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            if (res.status < 200 || res.status >= 300) {
                throw new Error("Unable to set cape");
            }
            return { "status": res.status, "player_info": player_info, "skin_info": res.data };
        } else {
            const res = await axios.delete(
                'https://api.minecraftservices.com/minecraft/profile/capes/active',
                {
                    headers: {
                        Authorization: `Bearer ${player_info.access_token}`
                    }
                }
            );

            if (res.status < 200 || res.status >= 300) {
                throw new Error("Unable to set cape");
            }
            return { "status": res.status, "player_info": player_info, "skin_info": res.data };
        }
    },
    setSkinFromURL: async (player_info, skin_url, variant) => {
        let date = new Date();
        date.setHours(date.getHours() - 1);
        if (new Date(player_info.expires) < date) {
            try {
                player_info = await getNewAccessToken(player_info.refresh_token);
            } catch (err) {
                throw new Error("Unable to update access token.");
            }
        }

        console.log(skin_url);
        console.log(variant);

        const res = await axios.post(
            'https://api.minecraftservices.com/minecraft/profile/skins',
            { variant: variant, url: skin_url },
            {
                headers: {
                    Authorization: `Bearer ${player_info.access_token}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (res.status < 200 || res.status >= 300) {
            throw new Error("Unable to set cape");
        }
        return { "status": res.status, "player_info": player_info, "skin_info": res.data };
    },
    setSkin: async (player_info, skin_id, variant) => {
        let date = new Date();
        date.setHours(date.getHours() - 1);
        if (new Date(player_info.expires) < date) {
            try {
                player_info = await getNewAccessToken(player_info.refresh_token);
            } catch (err) {
                throw new Error("Unable to update access token.");
            }
        }
        let filePath = path.resolve(userPath, `minecraft/skins/${skin_id}.png`);
        if (!fs.existsSync(filePath)) {
            throw new Error(`Skin file not found at ${filePath}`);
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
                res.on('end', () => {
                    if (res.statusCode < 200 || res.statusCode >= 300) {
                        let errorMsg = `Unable to set skin (status ${res.statusCode})`;
                        try {
                            const errorJson = JSON.parse(data);
                            if (errorJson && errorJson.error) {
                                errorMsg += `: ${errorJson.error}`;
                            }
                        } catch (e) {
                            // ignore JSON parse error, just use default message
                        }
                        reject(new Error(errorMsg));
                    } else {
                        try {
                            resolve({ "status": res.statusCode, "player_info": player_info, "skin_info": JSON.parse(data) });
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
    },
    getProfile: async (player_info) => {
        let date = new Date();
        date.setHours(date.getHours() - 1);
        if (new Date(player_info.expires) < date) {
            try {
                player_info = await getNewAccessToken(player_info.refresh_token);
            } catch (err) {
                throw new Error("Unable to update access token.");
            }
        }
        const res = await axios.get('https://api.minecraftservices.com/minecraft/profile', {
            headers: {
                Authorization: `Bearer ${player_info.access_token}`
            }
        });
        return { "status": res.status, "player_info": player_info, "skin_info": res.data };
    },
    importSkin: async (dataurl) => {
        const hash = await hashImageFromDataUrl(dataurl);
        const base64Data = dataurl.split(',')[1];
        if (!base64Data) throw new Error("Invalid data URL");
        const buffer = Buffer.from(base64Data, "base64");
        fs.writeFileSync(path.resolve(userPath, `minecraft/skins/${hash.hash}.png`), buffer);
        return hash.hash;
    },
    getTotalRAM: () => {
        return Math.floor(os.totalmem() / (1024 * 1024));
    },
    testJavaInstallation: async (file_path) => {
        try {
            if (!fs.existsSync(file_path)) return false;
            const stat = fs.statSync(file_path);
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
    },
    triggerFileImportBrowse: async (file_path, type) => {
        let startDir = file_path;
        if (fs.existsSync(file_path)) {
            const stat = fs.statSync(file_path);
            if (stat.isFile()) {
                startDir = path.dirname(file_path);
            }
        }
        const result = await ipcRenderer.invoke('show-open-dialog', {
            title: type ? "Select Folder to import" : "Select File to import",
            defaultPath: startDir,
            properties: [type ? 'openDirectory' : 'openFile'],
            filters: [{ name: 'Pack Files', extensions: ['mrpack', 'elpack', 'zip'] }]
        });
        if (result.canceled || !result.filePaths || !result.filePaths[0]) {
            return null;
        }
        return result.filePaths[0];
    },
    triggerFolderBrowse: async (file_path) => {
        let startDir = file_path;
        if (fs.existsSync(file_path)) {
            const stat = fs.statSync(file_path);
            if (stat.isFile()) {
                startDir = path.dirname(file_path);
            }
        }
        const result = await ipcRenderer.invoke('show-open-dialog', {
            title: "Select Folder",
            defaultPath: startDir,
            properties: ['openDirectory']
        });
        if (result.canceled || !result.filePaths || !result.filePaths[0]) {
            return null;
        }
        return result.filePaths[0];
    },
    triggerFileImportBrowseWithOptions: async (file_path, type, extensions, extName) => {
        let startDir = file_path;
        if (fs.existsSync(file_path)) {
            const stat = fs.statSync(file_path);
            if (stat.isFile()) {
                startDir = path.dirname(file_path);
            }
        }
        const result = await ipcRenderer.invoke('show-open-dialog', {
            title: type ? "Select Folder to import" : "Select File to import",
            defaultPath: startDir,
            properties: [type ? 'openDirectory' : 'openFile'],
            filters: [{ name: extName, extensions: extensions }]
        });
        if (result.canceled || !result.filePaths || !result.filePaths[0]) {
            return null;
        }
        return result.filePaths[0];
    },
    getInstanceFolderPath: () => {
        return path.resolve(userPath, "minecraft/instances");
    },
    triggerFileBrowse: async (file_path) => {
        let startDir = file_path;
        if (fs.existsSync(file_path)) {
            const stat = fs.statSync(file_path);
            if (stat.isFile()) {
                startDir = path.dirname(file_path);
            }
        }
        const result = await ipcRenderer.invoke('show-open-dialog', {
            title: "Select Java Executable",
            defaultPath: startDir,
            properties: ['openFile'],
            filters: [{ name: 'Executables', extensions: ['exe'] }]
        });
        if (result.canceled || !result.filePaths || !result.filePaths[0]) {
            return null;
        }
        return result.filePaths[0];
    },
    detectJavaInstallations: async (v) => {
        let javaSearch = new JavaSearch();
        return javaSearch.findJavaInstallations(v);
    },
    getJavaInstallations: () => {
        let javaPaths = [];
        const versionsJsonPath = path.resolve(userPath, "java", "versions.json");
        if (fs.existsSync(versionsJsonPath)) {
            try {
                const versionsData = fs.readFileSync(versionsJsonPath, "utf-8");
                const paths = JSON.parse(versionsData);
                if (paths && typeof paths === "object") {
                    for (const key of Object.keys(paths)) {
                        const p = paths[key];
                        if (typeof p === "string") {
                            javaPaths.push({ "version": key.replace("java-", ""), "path": p });
                        }
                    }
                }
            } catch (e) { }
        }
        return javaPaths;
    },
    getWorldsFromOtherLauncher: (instance_path) => {
        let the_path = path.resolve(instance_path, "saves");
        console.log(the_path)
        if (!fs.existsSync(the_path)) return [];
        return getWorlds(the_path).map(e => ({ "name": e.name, "value": path.resolve(the_path, e.id) }));
    },
    transferWorld: (old_world_path, instance_id, delete_previous_files) => {
        const savesPath = path.resolve(userPath, `minecraft/instances/${instance_id}/saves`);
        fs.mkdirSync(savesPath, { recursive: true });

        const worldName = path.basename(old_world_path);
        let targetName = worldName;
        let counter = 1;
        while (fs.existsSync(path.join(savesPath, targetName))) {
            targetName = `${worldName}_${counter}`;
            counter++;
        }
        const destPath = path.join(savesPath, targetName);

        fs.cpSync(old_world_path, destPath, { recursive: true });

        console.log(delete_previous_files);

        if (delete_previous_files) {
            console.log("Deleting " + old_world_path);
            fs.rmSync(old_world_path, { recursive: true, force: true });
        }

        return { new_world_path: destPath };
    },
    getLauncherInstances: async (instance_path) => {
        console.log(instance_path);
        if (!fs.existsSync(instance_path)) return [{ "name": "Unable to locate Instances", "value": "error" }];
        return fs.readdirSync(instance_path)
            .filter(f => {
                const fullPath = path.join(instance_path, f);
                return fs.statSync(fullPath).isDirectory();
            })
            .map(f => ({
                name: f,
                value: path.resolve(instance_path, f)
            }));
    },
    getLauncherInstancePath: (launcher) => {
        switch (launcher.toLowerCase()) {
            case "modrinth": {
                // Default Modrinth AppData path
                const p = path.join(os.homedir(), "AppData", "Roaming", "com.modrinth.theseus", "profiles");
                return fs.existsSync(p) ? p : "";
            }
            case "curseforge": {
                // Default CurseForge Minecraft instance path
                const p = path.join(os.homedir(), "curseforge", "minecraft", "Instances");
                return fs.existsSync(p) ? p : "";
            }
            case "vanilla": {
                // return "";
                // Default vanilla Minecraft saves path
                const p = path.join(os.homedir(), "AppData", "Roaming", ".minecraft");
                return fs.existsSync(p) ? p : "";
            }
            case "multimc": {
                // MultiMC instances folder
                const p = path.join(os.homedir(), "AppData", "Roaming", ".minecraft", "instances");
                return fs.existsSync(p) ? p : "";
            }
            case "prism": {
                // Prism Launcher instances folder
                const p = path.join(os.homedir(), "AppData", "Roaming", "PrismLauncher", "instances");
                return fs.existsSync(p) ? p : "";
            }
            case "atlauncher": {
                // ATLauncher instances folder
                const p = path.join(os.homedir(), "AppData", "Roaming", "ATLauncher", "instances");
                return fs.existsSync(p) ? p : "";
            }
            case "gdlauncher": {
                // GDLauncher instances folder
                const p = path.join(os.homedir(), "AppData", "Roaming", "GDLauncher", "instances");
                return fs.existsSync(p) ? p : "";
            }
            case "current": {
                const p = path.join(userPath, "minecraft/instances");
                return fs.existsSync(p) ? p : "";
            }
            default:
                return "";
        }
    },
    getInstanceOptions: (instance_id) => {
        const optionsPath = path.resolve(userPath, `minecraft/instances/${instance_id}/options.txt`);
        return getOptions(optionsPath);
    },
    getOptions,
    importContent,
    getAllCurseforgeFiles: async (project_id) => {
        let first_pre_json = await fetch(`https://www.curseforge.com/api/v1/mods/${project_id}/files?pageIndex=0&pageSize=50&sort=dateCreated&sortDescending=true&removeAlphas=false`);
        let first = await first_pre_json.json();
        let data = first.data;
        for (let i = 0; i < Math.ceil(first.pagination.totalCount / first.pagination.pageSize) - 1; i++) {
            let new_data = await fetch(`https://www.curseforge.com/api/v1/mods/${project_id}/files?pageIndex=${i + 1}&pageSize=50&sort=dateCreated&sortDescending=true&removeAlphas=false`);
            let new_data_json = await new_data.json();
            data = data.concat(new_data_json.data);
        }
        return data;
    },
    getCurseforgePage: async (project_id, page, game_flavor) => {
        let new_data = await fetch(`https://www.curseforge.com/api/v1/mods/${project_id}/files?pageIndex=${page - 1}&pageSize=50&sort=dateCreated&sortDescending=true&removeAlphas=false${game_flavor >= 1 ? "&gameFlavorId=" + game_flavor : ""}`);
        let new_data_json = await new_data.json();
        return new_data_json;
    },
    getCurseforgeChangelog: async (project_id, file_id, callback, errorCallback) => {
        try {
            let data = await fetch(`https://api.curse.tools/v1/cf/mods/${project_id}/files/${file_id}/changelog`);
            let data_json = await data.json();
            callback(data_json.data ? data_json.data : "No Changelog Specified");
        } catch (e) {
            errorCallback(e);
        }
    },
    createDesktopShortcut: async (instance_id, instance_name, iconSource, worldType, worldId) => {
        const desktopPath = await ipcRenderer.invoke('get-desktop');
        let safeName = instance_name.replace(/[<>:"/\\|?*]/g, '_');
        let shortcutPath = path.join(desktopPath, `${safeName} - EnderLynx.lnk`);

        let base_shortcut = safeName + " - EnderLynx";
        let count_shortcut = 1;

        while (fs.existsSync(shortcutPath)) {
            shortcutPath = path.join(desktopPath, `${base_shortcut} (${count_shortcut}).lnk`);
            count_shortcut++;
        }

        let target, workingDir, args;

        let isDev = enableDevMode;

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

        if (!iconSource) iconSource = "icon.ico";

        let base_path_name = instance_id;
        let current_count = 1;

        let iconPath = path.resolve(userPath, "icons", instance_id + '.ico');

        while (fs.existsSync(iconPath)) {
            iconPath = path.resolve(userPath, "icons", base_path_name + "_" + current_count + ".ico");
            current_count++;
        }

        console.log(iconPath);

        try {
            await convertToIco(iconSource, iconPath);
        } catch (e) { }

        if (!fs.existsSync(iconPath)) {
            iconPath = path.resolve(__dirname, "icon.ico");
        }

        return new Promise((resolve) => {
            ws.create(shortcutPath, {
                target,
                args,
                workingDir,
                runStyle: 1,
                desc: `Launch Minecraft instance "${instance_name}"`,
                icon: iconPath
            }, (err) => {
                console.log(err);
                if (err) {
                    resolve(false);
                    return false;
                } else {
                    resolve(true);
                    return true;
                }
            });
        });
    },
    shareLogs: async (logs) => {
        const params = new URLSearchParams();
        params.append("content", logs);

        const response = await fetch("https://api.mclo.gs/1/log", {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded"
            },
            body: params.toString()
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();

        if (!data.success) {
            throw new Error(`Upload failed: ${data.error || 'Unknown error'}`);
        }

        return data.url;
    },
    generateQRCode: async (url) => {
        return new Promise((resolve) => {
            QRCode.toDataURL(url, {
                errorCorrectionLevel: 'H',
                width: 96,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#FFFFFF'
                }
            }, (err, dataUrl) => {
                if (err) {
                    resolve(false);
                    return;
                }

                resolve(dataUrl);
            });
        })
    },
    deleteFoldersForModpackUpdate: async (instance_id) => {
        let instancePath = path.resolve(userPath, `minecraft/instances/${instance_id}`)
        let folders = ["mods", "resourcepacks", "shaderpacks", "config", "defaultconfig", "scripts", "kubejs", "overrides", "libraries"];
        try {
            for (let i = 0; i < folders.length; i++) {
                let pathToDelete = path.resolve(instancePath, folders[i]);
                if (fs.existsSync(pathToDelete)) {
                    fs.rmSync(pathToDelete, { recursive: true, force: true });
                }
            }
            return true;
        } catch (e) {
            return false;
        }
    },
    analyzeLogs: async (instance_id, last_log_date, current_log_path) => {
        let lastDate = null;
        if (last_log_date) {
            let date = last_log_date.replace(".log", "").split("_");
            if (date[1]) date[1] = date[1].replaceAll("-", ":");
            let dateStr = date.join(" ");
            lastDate = new Date(dateStr);
            if (isNaN(lastDate.getTime())) lastDate = null;
        }

        const logs_path = path.resolve(userPath, `minecraft/instances/${instance_id}/logs`);
        fs.mkdirSync(logs_path, { recursive: true });
        let allMatches = [];
        let totalPlaytime = 0;

        const logs = fs.readdirSync(logs_path)
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

                        // Timestamp
                        const tsEnd = line.indexOf("]");
                        if (tsEnd === -1) return;
                        let timestamp = line.slice(1, tsEnd); // remove leading "["
                        if (isNaN(new Date(timestamp).getTime())) {
                            const [hh, mm, ss] = timestamp?.split(':')?.map(Number);
                            if (hh && mm && ss) {
                                const combined = new Date(parsedDate.getFullYear(), parsedDate.getMonth(), parsedDate.getDate(), hh, mm, ss);
                                timestamp = combined.toISOString();
                            } else {
                                return;
                            }
                        }

                        // Extract host/port part
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
    },
    getDirName: () => {
        return path.resolve(userPath);
    },
    saveToDisk: async (file_path) => {
        let result = await ipcRenderer.invoke('show-save-dialog', {
            title: 'Save file',
            defaultPath: file_path,
            buttonLabel: 'Save',
            filters: [
                { name: 'All Files', extensions: ['*'] }
            ]
        });
        if (result.canceled || !result.filePath) return;
        fs.copyFileSync(file_path, result.filePath);
    },
    checkForUpdates,
    compareVersions,
    updateEnderLynx,
    downloadUpdate,
    changeFolder: async (old_path, new_path) => {
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
            ipcRenderer.send('progress-update', `Moving User Path`, percent, `Copying ${entry.name} (${completed + 1} of ${total})`);

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
        ipcRenderer.send('progress-update', `Moving User Path`, 100, `Done`);

        await ipcRenderer.invoke("set-user-path", dest, src);
        return true;
    },
    generateOptionsTXT: (values) => {
        const tempDir = path.resolve(userPath, "temp");
        fs.mkdirSync(tempDir, { recursive: true });
        const filePath = path.join(tempDir, `options_${Date.now()}.txt`);
        const lines = [];
        for (const { key, value } of values) {
            lines.push(`${key}:${value}`);
        }
        fs.writeFileSync(filePath, lines.join("\n"), "utf-8");
        return filePath;
    },
    createElPack: async (instance_id, name, manifest, overrides) => {
        const tempDir = path.resolve(userPath, "temp");
        fs.mkdirSync(tempDir, { recursive: true });
        const zipPath = path.join(tempDir, `${name.replace(/[<>:"/\\|?*]/g, '_')}_${Date.now()}.elpack`);

        const zip = new AdmZip();

        zip.addFile("manifest.json", Buffer.from(JSON.stringify(manifest, null, 2), "utf-8"));

        for (let override of overrides) {
            const srcPath = path.resolve(userPath, "minecraft", "instances", instance_id, override);
            const destPath = "overrides/" + override;
            if (fs.existsSync(srcPath)) {
                const stat = fs.statSync(srcPath);
                if (stat.isDirectory()) {
                    // Recursively add directory
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

        return zipPath;
    }
});

async function convertToIco(input, outputPath) {
    let imageBuffer;

    if (input.startsWith('data:image/')) {
        const base64Data = input.replace(/^data:image\/\w+;base64,/, '');
        imageBuffer = Buffer.from(base64Data, 'base64');
    } else if (input.startsWith('http://') || input.startsWith('https://')) {
        const response = await axios.get(input, { responseType: 'arraybuffer' });
        imageBuffer = Buffer.from(response.data);
    } else if (fs.existsSync(input)) {
        imageBuffer = fs.readFileSync(input);
    } else {
        throw new Error('Invalid input: must be a data URL, image URL, or file path');
    }

    const isWebP = imageBuffer.toString('ascii', 0, 4) === 'RIFF' &&
        imageBuffer.toString('ascii', 8, 12) === 'WEBP';

    if (isWebP) {
        const { data, info } = await sharp(imageBuffer)
            .ensureAlpha()
            .png()
            .toBuffer({ resolveWithObject: true });

        console.log(info);

        console.log(`Sharp decoded WebP details: Width=${info.width}, Height=${info.height}, Channels=${info.channels}, Format=${info.format}`);

        if (info.channels !== 4) {
            console.warn(`Sharp did not output 4 channels (RGBA), but ${info.channels}. This might be an issue.`);
        }

        imageBuffer = data;
    }
    const resized = await sharp(imageBuffer).resize(256, 256, {
        kernel: sharp.kernel.nearest
    }).png().toBuffer();

    const icoBuffer = await pngToIco(resized);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true })
    fs.writeFileSync(outputPath, icoBuffer);
}

function getWorld(levelDatPath) {
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

function getWorlds(patha) {
    fs.mkdirSync(patha, { recursive: true });
    let worldDirs = fs.opendirSync(patha);
    let worlds = [];

    let dir;
    while ((dir = worldDirs.readSync()) !== null) {
        if (!dir.isDirectory()) continue;
        const levelDatPath = path.resolve(patha, dir.name, 'level.dat');

        try {

            worlds.push(getWorld(levelDatPath));
        } catch (e) { }
    }
    worldDirs.closeSync();
    return worlds;
}

function getSinglePlayerWorlds(instance_id) {
    let patha = path.resolve(userPath, `minecraft/instances/${instance_id}/saves`);
    if (!fs.existsSync(patha)) {
        fs.mkdirSync(patha, { recursive: true });
    }
    return getWorlds(patha);
}

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

function folderExists(folderPath) {
    try {
        return fs.statSync(folderPath).isDirectory();
    } catch (err) {
        return false;
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


async function processCfZip(instance_id, zip_path, cf_id, title = ".zip file") {
    ipcRenderer.send('progress-update', `Installing ${title}`, 0, "Beginning install...");
    const zip = new AdmZip(zip_path);

    let extractToPath = path.resolve(userPath, `minecraft/instances/${instance_id}`);

    if (!fs.existsSync(extractToPath)) {
        fs.mkdirSync(extractToPath, { recursive: true });
    }

    zip.extractAllTo(extractToPath, true);

    let srcDir = path.resolve(userPath, `minecraft/instances/${instance_id}/overrides`);
    let destDir = path.resolve(userPath, `minecraft/instances/${instance_id}`);

    fs.mkdirSync(srcDir, { recursive: true });
    fs.mkdirSync(destDir, { recursive: true });

    const files = fs.readdirSync(srcDir);

    for (const file of files) {
        ipcRenderer.send('progress-update', `Installing ${title}`, 5, `Moving override ${file}`);
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
            fs.cpSync(srcPath, destPath, { recursive: true });
            fs.rmSync(srcPath, { recursive: true, force: true });
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

    const limit = pLimit(getMaxConcurrentDownloads());

    let allocated_ram = manifest_json.minecraft?.recommendedRam;

    ipcRenderer.send('progress-update', `Installing ${title}`, 10, `Downloading file 1 of ${manifest_json.files.length}`);

    let count = 0;

    const downloadPromises = manifest_json.files.map((file, i) => limit(async () => {
        let dependency_item = cf_id ? dependency_json.data.find(dep => dep.id === file.projectID) : null;

        let folder = "mods";
        if (dependency_item?.categoryClass?.slug == "texture-packs") folder = "resourcepacks";
        else if (dependency_item?.categoryClass?.slug == "shaders") folder = "shaderpacks";
        let type = "mod";
        if (dependency_item?.categoryClass?.slug == "texture-packs") type = "resource_pack";
        else if (dependency_item?.categoryClass?.slug == "shaders") folder = "shader";
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
        if (count == manifest_json.files.length - 1) {
            ipcRenderer.send('progress-update', `Installing ${title}`, 95, "Finishing metadata...");
        } else {
            ipcRenderer.send('progress-update', `Installing ${title}`, ((count + 2) / manifest_json.files.length) * 84 + 10, `Downloading file ${count + 2} of ${manifest_json.files.length}`);
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
                body: JSON.stringify({ modIds: project_ids.filter(e => e), filterPcOnly: false })
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
                    item.author = e.authors[0].name;
                }
            });
        });
    }


    ipcRenderer.send('progress-update', `Installing ${title}`, 100, "Done!");
    return ({
        "loader_version": manifest_json.minecraft.modLoaders[0].id.split("-")[1],
        "content": content,
        "loader": manifest_json.minecraft.modLoaders[0].id.split("-")[0],
        "vanilla_version": manifest_json.minecraft.version,
        "allocated_ram": allocated_ram,
        "name": manifest_json.name
    })
}
async function importContent(file_path, content_type, instance_id) {
    // Determine destination folder and file type
    let destFolder = "";
    let fileType = content_type;

    // If content_type is "auto", try to detect type by inspecting the file
    if (content_type === "auto") {
        if (file_path.endsWith(".jar")) {
            try {
                const tempZip = new AdmZip(file_path);
                if (tempZip.getEntry("fabric.mod.json")) {
                    destFolder = "mods";
                    fileType = "mod";
                } else if (tempZip.getEntry("META-INF/mods.toml")) {
                    destFolder = "mods";
                    fileType = "mod";
                } else if (tempZip.getEntry("quilt.mod.json")) {
                    destFolder = "mods";
                    fileType = "mod";
                } else {
                    destFolder = "mods";
                    fileType = "mod";
                }
            } catch (e) {
                destFolder = "mods";
                fileType = "mod";
            }
        } else if (file_path.endsWith(".zip")) {
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
            // fallback
            destFolder = "mods";
            fileType = "mod";
        }
    } else {
        // Map content_type to folder
        if (content_type === "mod") destFolder = "mods";
        else if (content_type === "resource_pack") destFolder = "resourcepacks";
        else if (content_type === "shader") destFolder = "shaderpacks";
        else destFolder = "mods";
    }

    // Ensure destination folder exists
    const destPath = path.resolve(userPath, `minecraft/instances/${instance_id}/${destFolder}`);
    fs.mkdirSync(destPath, { recursive: true });

    // Copy file
    let fileName = path.basename(file_path);
    let finalPath = path.join(destPath, fileName);
    // If the file already exists, change the name to something unique
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
    fs.copyFileSync(file_path, uniqueFinalPath);
    // Update fileName and finalPath to the unique ones for return value
    fileName = uniqueFileName;
    finalPath = uniqueFinalPath;

    return {
        file_name: fileName,
        type: fileType,
        dest: finalPath
    };
}
async function processCfZipWithoutID(instance_id, zip_path, cf_id, title = ".zip file") {
    ipcRenderer.send('progress-update', `Installing ${title}`, 0, "Beginning install...");
    const zip = new AdmZip(zip_path);

    let extractToPath = path.resolve(userPath, `minecraft/instances/${instance_id}`);

    if (!fs.existsSync(extractToPath)) {
        fs.mkdirSync(extractToPath, { recursive: true });
    }

    zip.extractAllTo(extractToPath, true);

    let srcDir = path.resolve(userPath, `minecraft/instances/${instance_id}/overrides`);
    let destDir = path.resolve(userPath, `minecraft/instances/${instance_id}`);

    fs.mkdirSync(srcDir, { recursive: true });
    fs.mkdirSync(destDir, { recursive: true });

    const files = fs.readdirSync(srcDir);

    for (const file of files) {
        ipcRenderer.send('progress-update', `Installing ${title}`, 5, `Moving override ${file}`);
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
            fs.cpSync(srcPath, destPath, { recursive: true });
            fs.rmSync(srcPath, { recursive: true, force: true });
        } catch (err) {
            return "Unable to enable overrides for folder " + file;
        }
    }

    let manifest_json = fs.readFileSync(path.resolve(extractToPath, "manifest.json"));
    manifest_json = JSON.parse(manifest_json);

    let content = [];
    let project_ids = [];

    const limit = pLimit(getMaxConcurrentDownloads());

    let allocated_ram = manifest_json.minecraft?.recommendedRam;

    ipcRenderer.send('progress-update', `Installing ${title}`, 10, `Downloading file 1 of ${manifest_json.files.length}`);

    let count = 0;

    const downloadPromises = manifest_json.files.map((file, i) => limit(async () => {
        ipcRenderer.send('progress-update', `Installing ${title}`, ((i + 1) / manifest_json.files.length) * 84 + 10, `Downloading file ${i + 1} of ${manifest_json.files.length}`);

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
                const tempZip = new AdmZip(tempFilePath);
                if (tempZip.getEntry("fabric.mod.json")) {
                    destFolder = "mods";
                } else if (tempZip.getEntry("META-INF/mods.toml")) {
                    destFolder = "mods";
                } else if (tempZip.getEntry("quilt.mod.json")) {
                    destFolder = "mods";
                } else {
                    destFolder = "mods";
                }
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

        if (count == manifest_json.files.length - 1) {
            ipcRenderer.send('progress-update', `Installing ${title}`, 95, "Finishing metadata...");
        } else {
            ipcRenderer.send('progress-update', `Installing ${title}`, ((count + 2) / manifest_json.files.length) * 84 + 10, `Downloading file ${count + 1} of ${manifest_json.files.length}`);
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
        });
        if (response.ok) {
            const json = await response.json();
            cfData = json.data || [];
        }
    } catch (e) {
        cfData = [];
    }

    console.log(cfData);

    cfData.forEach(e => {
        content.forEach(item => {
            if (item.source === "curseforge" && Number(item.source_id) == Number(e.id)) {
                item.name = e.name;
                item.image = e.logo.thumbnailUrl;
                item.author = e.authors[0].name;
            }
        });
    });

    ipcRenderer.send('progress-update', `Installing ${title}`, 100, "Done!");
    return ({
        "loader_version": manifest_json.minecraft.modLoaders[0].id.split("-")[1],
        "content": cfData.length ? content : [],
        "loader": manifest_json.minecraft.modLoaders[0].id.split("-")[0],
        "vanilla_version": manifest_json.minecraft.version,
        "allocated_ram": allocated_ram,
        "name": manifest_json.name
    });
}
async function processMrPack(instance_id, mrpack_path, loader, title = ".mrpack file") {
    ipcRenderer.send('progress-update', `Installing ${title}`, 0, "Beginning install...");
    const zip = new AdmZip(mrpack_path);

    let extractToPath = path.resolve(userPath, `minecraft/instances/${instance_id}`);

    if (!fs.existsSync(extractToPath)) {
        fs.mkdirSync(extractToPath, { recursive: true });
    }

    zip.extractAllTo(extractToPath, true);

    let srcDir = path.resolve(userPath, `minecraft/instances/${instance_id}/overrides`);
    let destDir = path.resolve(userPath, `minecraft/instances/${instance_id}`);

    fs.mkdirSync(srcDir, { recursive: true });
    fs.mkdirSync(destDir, { recursive: true });

    const files = fs.readdirSync(srcDir);

    for (const file of files) {
        ipcRenderer.send('progress-update', `Installing ${title}`, 5, `Moving override ${file}`);
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
            fs.cpSync(srcPath, destPath, { recursive: true });
            fs.rmSync(srcPath, { recursive: true, force: true });
        } catch (err) {
            return "Unable to enable overrides for folder " + file;
        }
    }

    let modrinth_index_json = fs.readFileSync(path.resolve(extractToPath, "modrinth.index.json"));
    modrinth_index_json = JSON.parse(modrinth_index_json);

    let content = [];

    let project_ids = [];
    let version_ids = [];
    let team_ids = [];
    let team_to_project_ids = {};

    const limit = pLimit(getMaxConcurrentDownloads());

    ipcRenderer.send('progress-update', `Installing ${title}`, 10, `Downloading file 1 of ${modrinth_index_json.files.length}`);

    let count = 0;

    const downloadPromises = modrinth_index_json.files.map((file, i) =>
        limit(async () => {
            await urlToFile(file.downloads[0], path.resolve(extractToPath, file.path));
            if (file.downloads[0].includes("https://cdn.modrinth.com/data")) {
                let split = file.downloads[0].split("/");
                let project_id = split[4];
                let file_id = split[6];
                if (project_id && file_id) {
                    if (!/^[a-zA-Z0-9]{8,}$/.test(file_id.replace(/%2B/gi, ""))) {
                        let res = await fetch(`https://api.modrinth.com/v2/project/${project_id}/version/${file_id}`);
                        let res_json = await res.json();
                        file_id = res_json.id;
                    }
                    project_ids.push(project_id);
                    version_ids.push(file_id);
                    content.push({
                        "source": "modrinth",
                        "source_id": project_id,
                        "version_id": file_id,
                        "disabled": false,
                        "file_name": path.basename(file.path),
                        "version": "",
                        "name": path.basename(file.path),
                        "image": "",
                        "type": path.dirname(file.path) == "mods" ? "mod" : path.dirname(file.path) == "resourcepacks" ? "resource_pack" : "shader"
                    });
                }
            }
            if (count == modrinth_index_json.files.length - 1) {
                ipcRenderer.send('progress-update', `Installing ${title}`, 95, "Finishing metadata...");
            } else {
                ipcRenderer.send('progress-update', `Installing ${title}`, ((count + 2) / modrinth_index_json.files.length) * 84 + 10, `Downloading file ${count + 1} of ${modrinth_index_json.files.length}`);
            }
            count++;
        })
    );

    await Promise.all(downloadPromises);

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
    let res_1 = await fetch(`https://api.modrinth.com/v2/versions?ids=["${version_ids.join('","')}"]`);
    let res_json_1 = await res_1.json();
    res_json_1.forEach(e => {
        content.forEach(item => {
            if (item.source_id == e.id) {
                item.version = e.version_number;
            }
        });
    });
    let res_2 = await fetch(`https://api.modrinth.com/v2/teams?ids=["${team_ids.join('","')}"]`);
    let res_json_2 = await res_2.json();
    res_json_2.forEach(e => {
        if (Array.isArray(e)) {
            let authors = e.filter(m => ["Owner", "Lead developer", "Project Lead"].includes(m.role)).map(m => m.user?.username || m.user?.name || "");
            let author = authors.length ? authors[0] : "";
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
    ipcRenderer.send('progress-update', `Installing ${title}`, 100, "Done!");
    return ({
        "loader_version": modrinth_index_json.dependencies[loader],
        "content": content,
        "loader": loader.replace("-loader", ""),
        "vanilla_version": modrinth_index_json.dependencies["minecraft"],
        "name": modrinth_index_json.name
    })
}
async function processElPack(instance_id, elpack_path, loader, title = ".elpack file") {
    ipcRenderer.send('progress-update', `Installing ${title}`, 0, "Beginning install...");
    const zip = new AdmZip(elpack_path);

    let extractToPath = path.resolve(userPath, `minecraft/instances/${instance_id}`);

    if (!fs.existsSync(extractToPath)) {
        fs.mkdirSync(extractToPath, { recursive: true });
    }

    zip.extractAllTo(extractToPath, true);

    let srcDir = path.resolve(userPath, `minecraft/instances/${instance_id}/overrides`);
    let destDir = path.resolve(userPath, `minecraft/instances/${instance_id}`);

    fs.mkdirSync(srcDir, { recursive: true });
    fs.mkdirSync(destDir, { recursive: true });

    const files = fs.readdirSync(srcDir);

    for (const file of files) {
        ipcRenderer.send('progress-update', `Installing ${title}`, 5, `Moving override ${file}`);
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
            fs.cpSync(srcPath, destPath, { recursive: true });
            fs.rmSync(srcPath, { recursive: true, force: true });
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

    const limit = pLimit(getMaxConcurrentDownloads());

    ipcRenderer.send('progress-update', `Installing ${title}`, 10, `Downloading file 1 of ${manifest_json.files.length}`);

    let count = 0;

    const downloadPromises = manifest_json.files.map((file, i) =>
        limit(async () => {
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
                await urlToFile(url, path.resolve(extractToPath, install_path));
            } catch (e) {
                if (file.source === "modrinth") {
                    let url = `https://api.modrinth.com/v2/project/${file.source_info}/version/${file.version_id}`;
                    let res_pre_json = await fetch(url);
                    let res = await res_pre_json.json();
                    await urlToFile(res.files[0].url, path.resolve(extractToPath, install_path));
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
            if (count == manifest_json.files.length - 1) {
                ipcRenderer.send('progress-update', `Installing ${title}`, 95, "Finishing metadata...");
            } else {
                ipcRenderer.send('progress-update', `Installing ${title}`, ((count + 2) / manifest_json.files.length) * 84 + 10, `Downloading file ${count + 1} of ${manifest_json.files.length}`);
            }
            count++;
        })
    );

    await Promise.all(downloadPromises);

    if (mr_project_ids.length) {
        try {
            const res = await fetch(`https://api.modrinth.com/v2/projects?ids=["${mr_project_ids.join('","')}"]`);
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

    if (mr_version_ids.length) {
        try {
            const res = await fetch(`https://api.modrinth.com/v2/versions?ids=["${mr_version_ids.join('","')}"]`);
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

    if (mr_team_ids.length) {
        try {
            const res = await fetch(`https://api.modrinth.com/v2/teams?ids=["${mr_team_ids.join('","')}"]`);
            const res_json = await res.json();
            res_json.forEach(e => {
                if (Array.isArray(e)) {
                    let authors = e.filter(m => ["Owner", "Lead developer", "Project Lead"].includes(m.role)).map(m => m.user?.username || m.user?.name || "");
                    let author = authors.length ? authors[0] : "";
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

    if (cf_project_ids.length) {
        try {
            const response = await fetch("https://api.curse.tools/v1/cf/mods", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ modIds: cf_project_ids, filterPcOnly: false })
            });
            if (response.ok) {
                const json = await response.json();
                const cfData = json.data || [];
                cfData.forEach(e => {
                    content.forEach(item => {
                        if (item.source === "curseforge" && item.source_id == e.id + ".0") {
                            item.name = e.name;
                            item.image = e.logo.thumbnailUrl;
                            item.author = e.authors[0].name;
                        }
                    });
                });
            }
        } catch (e) { }
    }

    ipcRenderer.send('progress-update', `Installing ${title}`, 100, "Done!");
    return ({
        "loader_version": manifest_json.loader_version,
        "content": content,
        "loader": manifest_json.loader,
        "vanilla_version": manifest_json.game_version,
        "allocated_ram": manifest_json.allocated_ram,
        "image": manifest_json.icon,
        "name": manifest_json.name
    })
}

async function getSkinFromURL(url) {
    let hash = await downloadSkin(url);
    return { "hash": hash.hash, "url": hash.dataUrl };
}

async function getSkinFromUsername(username) {
    try {
        // Step 1: Get UUID from username
        const profileRes = await fetch(`https://api.mojang.com/users/profiles/minecraft/${username}`);
        if (!profileRes.ok) throw new Error(`Username "${username}" not found`);
        const profile = await profileRes.json();
        const uuid = profile.id;

        // Step 2: Get skin data from session server
        const sessionRes = await fetch(`https://sessionserver.mojang.com/session/minecraft/profile/${uuid}`);
        if (!sessionRes.ok) throw new Error(`Failed to fetch profile for UUID ${uuid}`);
        const sessionData = await sessionRes.json();

        // Step 3: Decode base64 texture data
        const textureProp = sessionData.properties.find(p => p.name === 'textures');
        const textureJson = JSON.parse(Buffer.from(textureProp.value, 'base64').toString('utf8'));

        const skinUrl = textureJson.textures?.SKIN?.url;
        if (!skinUrl) throw new Error("No skin URL found");

        let hash = await downloadSkin(skinUrl);

        return { "hash": hash.hash, "url": hash.dataUrl };
    } catch (err) {
        console.error("Error:", err.message);
        return null;
    }
}

async function downloadSkin(url) {
    const response = await axios.get(url, { responseType: "arraybuffer" });
    const imageBuffer = Buffer.from(response.data);

    const { data, info } = await sharp(imageBuffer)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

    const hash = crypto.createHash('sha256')
        .update(data)
        .digest('hex');

    fs.mkdirSync(path.resolve(userPath, "minecraft/skins"), { recursive: true });

    fs.writeFileSync(path.resolve(userPath, `minecraft/skins/${hash}.png`), imageBuffer);

    const base64 = imageBuffer.toString('base64');
    const dataUrl = `data:image/png;base64,${base64}`;

    return { hash, dataUrl };
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

function parseJavaArgs(input) {
    if (!input) return [];
    return stringArgv(input);
}

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

async function getMultiplayerWorlds(instance_id) {
    let patha = path.resolve(userPath, `minecraft/instances/${instance_id}`);
    fs.mkdirSync(patha, { recursive: true });
    let serversDatPath = path.resolve(patha, 'servers.dat');
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

    console.log(worlds);

    return worlds;
}

function openFolder(folderPath) {
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
}

async function checkForUpdates() {
    try {
        let latest = await fetch("https://api.github.com/repos/Illusioner2520/EnderLynx/releases/latest");
        let latest_json = await latest.json();
        let recent_release_version = latest_json.tag_name.replace("v", "");
        if (compareVersions(recent_release_version, version) == 1) {
            let download_url = "";
            let file_size = 0;
            let checksum = "";
            for (let i = 0; i < latest_json.assets.length; i++) {
                let asset = latest_json.assets[i];
                if (asset.content_type == "application/x-zip-compressed") {
                    download_url = asset.browser_download_url;
                    file_size = asset.size;
                    checksum = asset.digest;
                    break;
                }
            }
            if (!download_url) {
                return ({
                    "update": false
                });
            }
            return ({
                "update": true,
                "new_version": recent_release_version,
                "current_version": version,
                "download_url": download_url,
                "checksum": checksum,
                "file_size": Math.round(file_size / 1048576) + "MB",
                "changelog": latest_json.body
            });
        } else {
            return ({
                "update": false
            });
        }
    } catch (e) {
        return ({
            "update": false
        });
    }
}

async function downloadUpdate(download_url, new_version, checksum) {
    ipcRenderer.send('progress-update', `Downloading Update`, 0, "Beginning download...");
    const tempDir = path.resolve(userPath, "temp", new_version);
    fs.mkdirSync(tempDir, { recursive: true });

    const zipPath = path.join(tempDir, "update.zip");

    const response = await axios.get(download_url, {
        responseType: "arraybuffer",
        onDownloadProgress: (progressEvent) => {
            const percentCompleted = progressEvent.loaded * 80 / progressEvent.total;
            ipcRenderer.send('progress-update', `Downloading Update`, percentCompleted, "Downloading .zip file...");
        }
    });
    let data = Buffer.from(response.data);
    fs.writeFileSync(zipPath, data);

    try {
        let hash = crypto.createHash('sha256')
            .update(data)
            .digest('hex');
        if ("sha256:" + hash != checksum) throw new Error();
    } catch (e) {
        fs.unlinkSync(zipPath);
        ipcRenderer.send('progress-update', `Downloading Update`, 100, "err");
        throw new Error("Failed to verify download. Stopping update.");
    }

    const zip = new AdmZip(zipPath);

    const prev = process.noAsar;
    process.noAsar = true;

    ipcRenderer.send('progress-update', `Downloading Update`, 80, "Extracting .zip file...");

    zip.extractAllTo(tempDir);

    process.noAsar = prev;

    fs.unlinkSync(zipPath);

    ipcRenderer.send('progress-update', `Downloading Update`, 100, "Done!");

    const updaterPath = path.join(userPath, "updater", "updater.exe");
    const sourceDir = path.resolve(tempDir);
    const targetDir = process.execPath.replace(/\\[^\\]+$/, "");
    const exeToLaunch = process.execPath;
    const oldPid = process.pid.toString();

    spawn(updaterPath, [sourceDir, targetDir, exeToLaunch, oldPid], {
        detached: true,
        stdio: "ignore"
    }).unref();
}

function updateEnderLynx() {
    ipcRenderer.invoke('quit');
}

function compareVersions(v1, v2) {
    const a = v1.split('.').map(Number);
    const b = v2.split('.').map(Number);
    const length = Math.max(a.length, b.length);

    for (let i = 0; i < length; i++) {
        const num1 = a[i] || 0;
        const num2 = b[i] || 0;
        if (num1 < num2) return -1;
        if (num1 > num2) return 1;
    }
    return 0;
}

function getOptions(optionsPath) {
    if (!fs.existsSync(optionsPath)) return [];
    const lines = fs.readFileSync(optionsPath, "utf-8").split(/\r?\n/);
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
}

async function addServer(instance_id, ip, title, image) {
    let patha = path.resolve(userPath, `minecraft/instances/${instance_id}`);
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
                console.log(image);
                const response = await axios.get(image, { responseType: "arraybuffer" });
                console.log(response.data);
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
            "acceptTextures": {
                "type": "byte",
                "value": 1
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

function getMaxConcurrentDownloads() {
    let r = db.prepare("SELECT * FROM defaults WHERE default_type = ?").get("max_concurrent_downloads");
    if (r?.value) return Number(r.value);
    return 10;
}

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