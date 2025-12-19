const { contextBridge, ipcRenderer, clipboard, nativeImage, shell, webUtils, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const { JavaSearch } = require('./java_scan.js');
const { spawn, exec } = require('child_process');
const nbt = require('prismarine-nbt');
const { Auth } = require('msmc');
const AdmZip = require('adm-zip');
const https = require('https');
const Database = require('better-sqlite3');
const axios = require('axios');
const FormData = require('form-data');
const sharp = require("sharp");
const crypto = require('crypto');
const os = require('os');
const ws = require("windows-shortcuts");
const MarkdownIt = require('markdown-it');
const { version } = require('./package.json');
const pngToIcoModule = require('png-to-ico');
const QRCode = require('qrcode');
const readline = require('readline');

const pngToIco = pngToIcoModule.default;

let cfServerInfo = {};

let userPath = path.resolve(process.argv.find(arg => arg.startsWith('--userDataPath='))
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

db.prepare('CREATE TABLE IF NOT EXISTS instances (id INTEGER PRIMARY KEY, name TEXT, date_created TEXT, date_modified TEXT, last_played TEXT, loader TEXT, vanilla_version TEXT, loader_version TEXT, playtime INTEGER, locked INTEGER, downloaded INTEGER, group_id TEXT, image TEXT, instance_id TEXT, java_version INTEGER, java_path TEXT, current_log_file TEXT, pid INTEGER, install_source TEXT, install_id TEXT, installing INTEGER, mc_installed INTEGER, window_width INTEGER, window_height INTEGER, allocated_ram INTEGER, attempted_options_txt_version INTEGER, java_args TEXT, env_vars TEXT, pre_launch_hook TEXT, wrapper TEXT, post_exit_hook TEXT, installed_version TEXT, last_analyzed_log TEXT, failed INTEGER)').run();
db.prepare('CREATE TABLE IF NOT EXISTS profiles (id INTEGER PRIMARY KEY, access_token TEXT, client_id TEXT, expires TEXT, name TEXT, refresh_token TEXT, uuid TEXT, xuid TEXT, is_demo INTEGER, is_default INTEGER)').run();
db.prepare('CREATE TABLE IF NOT EXISTS defaults (id INTEGER PRIMARY KEY, default_type TEXT, value TEXT)').run();
db.prepare('CREATE TABLE IF NOT EXISTS content (id INTEGER PRIMARY KEY, name TEXT, author TEXT, disabled INTEGER, image TEXT, file_name TEXT, source TEXT, type TEXT, version TEXT, version_id TEXT, instance TEXT, source_info TEXT)').run();
db.prepare('CREATE TABLE IF NOT EXISTS skins (id INTEGER PRIMARY KEY, name TEXT, model TEXT, active_uuid TEXT, skin_id TEXT, skin_url TEXT, default_skin INTEGER, texture_key TEXT, favorited INTEGER, last_used TEXT, preview TEXT, preview_model TEXT, head TEXT)').run();
db.prepare('CREATE TABLE IF NOT EXISTS capes (id INTEGER PRIMARY KEY, uuid TEXT, cape_name TEXT, cape_id TEXT, cape_url TEXT, active INTEGER)').run();
db.prepare('CREATE TABLE IF NOT EXISTS options_defaults (id INTEGER PRIMARY KEY, key TEXT, value TEXT, version TEXT)').run();
db.prepare('CREATE TABLE IF NOT EXISTS pins (id INTEGER PRIMARY KEY, type TEXT, instance_id TEXT, world_id TEXT, world_type TEXT)').run();
db.prepare('CREATE TABLE IF NOT EXISTS mc_versions_cache (id INTEGER PRIMARY KEY, name TEXT, date_published TEXT)').run();
db.prepare('CREATE TABLE IF NOT EXISTS last_played_servers (id INTEGER PRIMARY KEY, instance_id TEXT, ip TEXT, date TEXT)').run();

db.pragma('journal_mode = WAL');

let vt_rp = {}, vt_dp = {}, vt_ct = {};

let processWatches = {};

function openInBrowser(url) {
    if (!url) return;
    shell.openExternal(url);
}

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

ipcRenderer.on('new-args', (event, newargs) => {
    processArgs(newargs.slice(1));
});

contextBridge.exposeInMainWorld('electronAPI', {
    onOpenFile: (callback) => {
        ipcRenderer.on('open-file', (event, filePath) => {
            let ext = path.extname(filePath);
            let info = {};
            if (ext == ".elpack") {
                info = readElPack(filePath);
            } else if (ext == ".mrpack") {
                info = readMrPack(filePath);
            } else if (ext == ".zip") {
                info = readCfZip(filePath);
            }
            if (info) callback(info, filePath);
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
    localIPs: () => {
        const nets = os.networkInterfaces();
        let ipAddressv4 = 'N/A';
        let ipAddressv6 = 'N/A';
        for (const name of Object.keys(nets)) {
            for (const net of nets[name]) {
                if (net.family == 'IPv4' && !net.internal && ipAddressv4 == 'N/A') {
                    ipAddressv4 = net.address;
                } else if (net.family == 'IPv6' && !net.internal && ipAddressv6 == 'N/A') {
                    ipAddressv6 = net.address;
                }
            }
            if (ipAddressv4 !== 'N/A' && ipAddressv6 !== 'N/A') break;
        }
        return { IPv4: ipAddressv4, IPv6: ipAddressv6 }
    },
    cpuUsage: process.getCPUUsage,
    memUsage: process.getProcessMemoryInfo,
    getAppMetrics: async () => {
        let appMetrics = await ipcRenderer.invoke('get-app-metrics');
        return appMetrics;
    },
    readPackFile: (file_path) => {
        let ext = path.extname(file_path);
        if (ext == ".elpack") {
            return readElPack(file_path);
        } else if (ext == ".mrpack") {
            return readMrPack(file_path);
        } else if (ext == ".zip") {
            return readCfZip(file_path);
        }
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
    getRandomModpacks: async () => {
        let indexes = ["relevance", "downloads", "follows", "newest", "updated"];
        let index = indexes[Math.floor(Math.random() * indexes.length)];
        let offset = Math.floor(Math.random() * 10000);
        try {
            let res = await fetch(`https://api.modrinth.com/v2/search?facets=[["project_type:modpack"]]&index=${index}&offset=${offset}&limit=10`);
            let json = await res.json();
            return json;
        } catch (e) {
            return null;
        }
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
        return await ipcRenderer.invoke("get-all-servers", instance_ids);
    },
    getRecentlyPlayedWorlds: async (instance_ids) => {
        return await ipcRenderer.invoke('get-recently-played-worlds', instance_ids);
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
        return await ipcRenderer.invoke('delete-instance-files', instance_id);
    },
    duplicateInstanceFiles: async (old_instance_id, new_instance_id) => {
        return await ipcRenderer.invoke('duplicate-instance-files', old_instance_id, new_instance_id);
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
    playMinecraft: async (loader, version, loaderVersion, instance_id, player_info, quickPlay, customResolution, allocatedRam, javaPath, javaArgs, envVars, preLaunch, wrapper, postExit, offline) => {
        return await ipcRenderer.invoke('play-minecraft', loader, version, loaderVersion, instance_id, player_info, quickPlay, customResolution, allocatedRam, javaPath, javaArgs, envVars, preLaunch, wrapper, postExit, offline);
    },
    getJavaInstallation: async (v) => {
        return await ipcRenderer.invoke('get-java-installation', v);
    },
    setJavaInstallation: async (v, f) => {
        return await ipcRenderer.invoke('set-java-installation', v, f);
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
    deleteServer: async (instance_id, ip, index) => {
        return await ipcRenderer.invoke('delete-server', instance_id, ip, index);
    },
    getMultiplayerWorlds,
    openFolder,
    showFileInFolder,
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
    getInstanceContent: async (loader, instance_id, old_content, link_with_modrinth) => {
        return await ipcRenderer.invoke('get-instance-content', loader, instance_id, old_content, link_with_modrinth);
    },
    downloadVanillaTweaksDataPacks: async (packs, version, instance_id, world_id) => {
        return await ipcRenderer.invoke('download-vanilla-tweaks-data-packs', packs, version, instance_id, world_id)
    },
    downloadVanillaTweaksResourcePacks: async (packs, version, instance_id, file_path) => {
        return await ipcRenderer.invoke('download-vanilla-tweaks-resource-packs', packs, version, instance_id, file_path);
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
                "breadcrumb": previous_categories.join(" > "),
                "incompatible": e.incompatible,
                "vt_id": e.name,
                "experiment": e.experiment,
                "categories": previous_categories,
                "image": `https://vanillatweaks.net/assets/resources/previews/resourcepacks/${version}/${e.name}.${e.previewExtension ? e.previewExtension : "png"}?v2`
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

        let process_category = (category, type, previous_categories = []) => {
            previous_categories.push(category.category);
            let packs = category.packs;
            packs = packs.map(e => ({
                "title": e.display,
                "description": e.description,
                "icon_url": `https://vanillatweaks.net/assets/resources/icons/${type == "dp" ? "datapacks" : "craftingtweaks"}/${version}/${e.name}.png`,
                "breadcrumb": previous_categories.join(" > "),
                "incompatible": e.incompatible,
                "vt_id": e.name,
                "type": type,
                "experiment": e.experiment,
                "categories": previous_categories,
                "image": `https://vanillatweaks.net/assets/resources/previews/${type == "dp" ? "datapacks" : "craftingtweaks"}/${version}/${e.name}.${e.previewExtension ? e.previewExtension : "png"}?v2`
            }));
            packs = packs.filter(e => e.title.toLowerCase().includes(query) || e.description.toLowerCase().includes(query) || e.categories.join().toLowerCase().includes(query));
            return_data.hits = return_data.hits.concat(packs);
            if (category.categories) {
                category.categories.forEach(e => {
                    process_category(e, type, structuredClone(previous_categories));
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
        ipcRenderer.on('progress-update', (_event, title, progress, desc, id, status, cancel_id, from_launch) => {
            callback(title, progress, desc, id, status, from_launch ? () => {
                ipcRenderer.invoke('launch-cancel', cancel_id);
            } : () => {
                ipcRenderer.invoke('cancel', cancel_id);
            }, from_launch ? () => {
                ipcRenderer.invoke('launch-retry', cancel_id);
            } : () => {
                ipcRenderer.invoke('retry', cancel_id);
            });
        });
    },
    onContentInstallUpdate: (callback) => {
        ipcRenderer.on('content-install-update', (_, content_id, percent) => {
            callback(content_id, percent);
        });
    },
    onOpenFileShare: (callback) => {
        ipcRenderer.on('open-file-share', (_event, file_path) => {
            callback(file_path);
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
        return (await ipcRenderer.invoke('fabric-vanilla-versions'));
    },
    getForgeVersions: async () => {
        return (await ipcRenderer.invoke('forge-vanilla-versions'));
    },
    getNeoForgeVersions: async () => {
        return (await ipcRenderer.invoke('neoforge-vanilla-versions'));
    },
    getQuiltVersions: async () => {
        return (await ipcRenderer.invoke('quilt-vanilla-versions'));
    },
    getInstanceFolderName: (instance_id) => {
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
        return await ipcRenderer.invoke('download-minecraft', instance_id, loader, vanilla_version, loader_version);
    },
    repairMinecraft: async (instance_id, loader, vanilla_version, loader_version, whatToRepair) => {
        return await ipcRenderer.invoke('repair-minecraft', instance_id, loader, vanilla_version, loader_version, whatToRepair);
    },
    getForgeVersion: async (mcversion) => {
        return (await ipcRenderer.invoke('forge-loader-versions', mcversion))[0];
    },
    getFabricVersion: async (mcversion) => {
        return (await ipcRenderer.invoke('fabric-loader-versions', mcversion))[0];
    },
    getNeoForgeVersion: async (mcversion) => {
        return (await ipcRenderer.invoke('neoforge-loader-versions', mcversion))[0];
    },
    getQuiltVersion: async (mcversion) => {
        return (await ipcRenderer.invoke('fabric-loader-versions', mcversion))[0];
    },
    getForgeLoaderVersions: async (mcversion) => {
        return (await ipcRenderer.invoke('forge-loader-versions', mcversion));
    },
    getFabricLoaderVersions: async (mcversion) => {
        return (await ipcRenderer.invoke('fabric-loader-versions', mcversion));
    },
    getNeoForgeLoaderVersions: async (mcversion) => {
        return (await ipcRenderer.invoke('neoforge-loader-versions', mcversion));
    },
    getQuiltLoaderVersions: async (mcversion) => {
        return (await ipcRenderer.invoke('quilt-loader-versions', mcversion));
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
        let sort = 2;
        if (sortBy == "downloads") sort = 6;
        if (sortBy == "newest") sort = 11;
        if (sortBy == "updated") sort = 3;
        let sortOrder = "desc";
        let gv = "";
        if (version) gv = "&gameVersion=" + version;
        let gf = "";
        if (loader && (project_type == "mod" || project_type == "modpack")) gf = "&modLoaderType=" + ["", "forge", "", "", "fabric", "quilt", "neoforge"].indexOf(loader);
        let ci = "";
        let id = 0;
        if (project_type == "mod") id = 6;
        if (project_type == "modpack") id = 4471;
        if (project_type == "resourcepack") id = 12;
        if (project_type == "shader") id = 6552;
        if (project_type == "world") id = 17;
        if (project_type == "datapack") id = 6945;
        if (project_type) ci = "&classId=" + id;
        let url = `https://api.curse.tools/v1/cf/mods/search?gameId=432&index=${(page - 1) * pageSize}&searchFilter=${query}${gv}&pageSize=${pageSize}&sortField=${sort}&sortOrder=${sortOrder}${gf}${ci}`;
        let res = await fetch(url);
        let json = await res.json();
        if (json.pagination.totalCount > 10000) json.pagination.totalCount = 10000;
        return json;
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
    addContent: async (instance_id, project_type, project_url, filename, data_pack_world, content_id) => {
        return await ipcRenderer.invoke('add-content', instance_id, project_type, project_url, filename, data_pack_world, content_id);
    },
    downloadModrinthPack: async (instance_id, url, title) => {
        return await ipcRenderer.invoke('download-modrinth-pack', instance_id, url, title);
    },
    downloadCurseforgePack: async (instance_id, url, title) => {
        return await ipcRenderer.invoke('download-curseforge-pack', instance_id, url, title);
    },
    processPackFile: async (file_path, instance_id, title) => {
        return await ipcRenderer.invoke('process-pack-file', file_path, instance_id, title, getMaxConcurrentDownloads());
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
    pathToDataUrl,
    downloadSkin,
    downloadCape: async (url, id) => {
        return await ipcRenderer.invoke('download-cape', url, id);
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
                            if (errorJson && errorJson.errorMessage) {
                                errorMsg += `: ${errorJson.errorMessage}`;
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
    getWorldsFromOtherLauncher: async (instance_path) => {
        let the_path = path.resolve(instance_path, "saves");
        console.log(the_path)
        if (!fs.existsSync(the_path)) return [];
        return (await getWorlds(the_path)).map(e => ({ "name": e.name, "value": path.resolve(the_path, e.id) }));
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
    importWorld,
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

        try {
            await convertToIco(iconSource, iconPath);
        } catch (e) {
            console.error(e);
        }

        if (!fs.existsSync(iconPath)) {
            let enderlynxiconpath = path.resolve(userPath, "icons", "enderlynx.ico");
            if (!fs.existsSync(enderlynxiconpath)) {
                fs.copyFileSync(path.resolve(__dirname, "icon.ico"), enderlynxiconpath);
            }
            iconPath = enderlynxiconpath;
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
        try {
            await ipcRenderer.invoke('change-folder', old_path, new_path);
            userPath = new_path;
        } catch (err) {
            throw err;
        }
    },
    generateOptionsTXT: (values) => {
        const tempDir = path.resolve(userPath, "out");
        fs.mkdirSync(tempDir, { recursive: true });
        const filePath = path.join(tempDir, `options_${Date.now()}.txt`);
        const lines = [];
        for (const { key, value } of values) {
            lines.push(`${key}:${value}`);
        }
        fs.writeFileSync(filePath, lines.join("\n"), "utf-8");
        return filePath;
    },
    createElPack: (id, name, manifest, overrides) => ipcRenderer.invoke('create-elpack', id, name, manifest, overrides),
    createMrPack: (id, name, manifest, overrides) => ipcRenderer.invoke('create-mrpack', id, name, manifest, overrides),
    createCfZip: (id, name, manifest, overrides) => ipcRenderer.invoke('create-cfzip', id, name, manifest, overrides),
    readPathsFromDrop: (fileList) => {
        return Array.from(fileList).map(f => ({
            path: webUtils.getPathForFile(f),
            name: f.name
        }));
    },
    isInstanceFile: (file_path) => {
        let ext = path.extname(file_path);
        if (ext == ".mrpack" || ext == ".elpack") return true;
        if (ext == ".zip") {
            const zip = new AdmZip(file_path);
            if (zip.getEntry('pack.mcmeta')) return false;
            if (zip.getEntry('manifest.json')) return true;
        }
        return false;
    },
    queryServer: async (host, port) => {
        return await ipcRenderer.invoke('query-server', host, port);
    },
    addServer: async (instance_id, ip, name) => {
        return await ipcRenderer.invoke('add-server', instance_id, ip, name);
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

    const resized = await sharp(imageBuffer, { failOnError: false })
        .ensureAlpha()
        .resize(256, 256, {
            fit: 'contain',
            kernel: sharp.kernel.nearest
        })
        .png()
        .toBuffer();

    const icoBuffer = await pngToIco(resized);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true })
    fs.writeFileSync(outputPath, icoBuffer);
}

async function getWorld(levelDatPath) {
    return await ipcRenderer.invoke('get-world', levelDatPath);
}

async function getWorlds(patha) {
    return await ipcRenderer.invoke('get-worlds', patha);
}

async function getSinglePlayerWorlds(instance_id) {
    let patha = path.resolve(userPath, `minecraft/instances/${instance_id}/saves`);
    if (!fs.existsSync(patha)) {
        fs.mkdirSync(patha, { recursive: true });
    }
    return await getWorlds(patha);
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

async function importWorld(file_path, instance_id, worldName) {
    return await ipcRenderer.invoke('import-world', file_path, instance_id, worldName);
}
async function importContent(file_path, content_type, instance_id) {
    let destFolder = "";
    let fileType = content_type;

    if (content_type === "auto") {
        if (file_path.endsWith(".jar") || file_path.endsWith(".jar.disabled")) {
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

    const destPath = path.resolve(userPath, `minecraft/instances/${instance_id}/${destFolder}`);
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
    await new Promise((resolve) => {
        fs.copyFile(file_path, uniqueFinalPath, () => resolve());
    });
    fileName = uniqueFileName;
    finalPath = uniqueFinalPath;

    return {
        file_name: fileName,
        type: fileType,
        dest: finalPath
    };
}

async function processCfZipWithoutID(instance_id, zip_path, cf_id, title = ".zip file") {
    return await ipcRenderer.invoke('process-cf-zip-without-id', instance_id, zip_path, cf_id, title, getMaxConcurrentDownloads());
}
async function processMrPack(instance_id, mrpack_path, loader, title = ".mrpack file") {
    return await ipcRenderer.invoke('process-mr-pack', instance_id, mrpack_path, loader, title, getMaxConcurrentDownloads());
}
async function processElPack(instance_id, elpack_path, loader, title = ".elpack file") {
    return await ipcRenderer.invoke('process-el-pack', instance_id, elpack_path, loader, title, getMaxConcurrentDownloads());
}
async function processCfZip(instance_id, zip_path, cf_id, title = ".zip file") {
    return await ipcRenderer.invoke('process-cf-zip', instance_id, zip_path, cf_id, title, getMaxConcurrentDownloads());
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
    let imageBuffer;
    if (url.startsWith("data:")) {
        imageBuffer = Buffer.from(url.split(",")[1], "base64");
    } else {
        const response = await axios.get(url, { responseType: "arraybuffer" });
        imageBuffer = Buffer.from(response.data);
    }

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

async function pathToDataUrl(file_path) {
    if (!file_path) return null;

    try {
        if (fs.existsSync(file_path)) {
            const buffer = fs.readFileSync(file_path);
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
    return await ipcRenderer.invoke('get-multiplayer-worlds', instance_id);
}

function showFileInFolder(filePath) {
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
    return await ipcRenderer.invoke('download-update', download_url, new_version, checksum);
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

function getMaxConcurrentDownloads() {
    let r = db.prepare("SELECT * FROM defaults WHERE default_type = ?").get("max_concurrent_downloads");
    if (r?.value) return Number(r.value);
    return 10;
}