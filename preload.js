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
const { error } = require('console');
const stringArgv = require('string-argv').default;
const { Jimp, ResizeStrategy } = require('jimp');
const pngToIco = require('png-to-ico');
const QRCode = require('qrcode');

const db = new Database('app.db');

db.prepare('CREATE TABLE IF NOT EXISTS instances (id INTEGER PRIMARY KEY, name TEXT, date_created TEXT, date_modified TEXT, last_played TEXT, loader TEXT, vanilla_version TEXT, loader_version TEXT, playtime INTEGER, locked INTEGER, downloaded INTEGER, group_id TEXT, image TEXT, instance_id TEXT, java_version INTEGER, java_path TEXT, current_log_file TEXT, pid INTEGER, install_source TEXT, install_id TEXT, installing INTEGER, mc_installed INTEGER, window_width INTEGER, window_height INTEGER, allocated_ram INTEGER, attempted_options_txt_version INTEGER, java_args TEXT, env_vars TEXT, pre_launch_hook TEXT, wrapper TEXT, post_exit_hook TEXT, installed_version TEXT)').run();
db.prepare('CREATE TABLE IF NOT EXISTS profiles (id INTEGER PRIMARY KEY, access_token TEXT, client_id TEXT, expires TEXT, name TEXT, refresh_token TEXT, uuid TEXT, xuid TEXT, is_demo INTEGER, is_default INTEGER)').run();
db.prepare('CREATE TABLE IF NOT EXISTS defaults (id INTEGER PRIMARY KEY, default_type TEXT, value TEXT)').run();
db.prepare('CREATE TABLE IF NOT EXISTS content (id INTEGER PRIMARY KEY, name TEXT, author TEXT, disabled INTEGER, image TEXT, file_name TEXT, source TEXT, type TEXT, version TEXT, instance TEXT, source_info TEXT)').run();
db.prepare('CREATE TABLE IF NOT EXISTS skins (id INTEGER PRIMARY KEY, file_name TEXT, last_used TEXT, name TEXT, model TEXT, active_uuid TEXT, skin_id TEXT, skin_url TEXT, default_skin INTEGER, texture_key TEXT)').run();
db.prepare('CREATE TABLE IF NOT EXISTS capes (id INTEGER PRIMARY KEY, uuid TEXT, cape_name TEXT, last_used TEXT, cape_id TEXT, cape_url TEXT, active INTEGER)').run();
db.prepare('CREATE TABLE IF NOT EXISTS options_defaults (id INTEGER PRIMARY KEY, key TEXT, value TEXT, version TEXT)').run();
db.prepare('CREATE TABLE IF NOT EXISTS pins (id INTEGER PRIMARY KEY, type TEXT, instance_id TEXT, world_id TEXT, world_type TEXT)').run();
db.prepare('CREATE TABLE IF NOT EXISTS mc_versions_cache (id INTEGER PRIMARY KEY, name TEXT, date_published TEXT)').run();

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

console.log(process);

contextBridge.exposeInMainWorld('electronAPI', {
    version,
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
    getRandomModpacks: (callback, errcallback) => {
        let indexes = ["relevance", "downloads", "follows", "newest", "updated"];
        let index = indexes[Math.floor(Math.random() * indexes.length)];
        let offset = Math.floor(Math.random() * 10000);
        try {
            fetch(`https://api.modrinth.com/v2/search?facets=[["project_type:modpack"]]&index=${index}&offset=${offset}&limit=10`).then(response => {
                response.json().then(data => callback(data));
            });
        } catch (e) {
            errcallback(e);
        }
    },
    getPinnedWorlds: async () => {
        let worlds = db.prepare("SELECT * FROM pins WHERE type = ?").all("world");
        let allWorlds = [];
        for (const world of worlds) {
            if (!world.world_id) continue;
            if (world.world_type == "singleplayer") {
                const worldPath = path.resolve(__dirname, "minecraft/instances", world.instance_id || "", "saves", world.world_id, "level.dat");
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
                const serversDatPath = path.resolve(__dirname, "minecraft/instances", world.instance_id || "", "servers.dat");
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
    getRecentlyPlayedWorlds: (instance_ids) => {
        if (!Array.isArray(instance_ids) || instance_ids.length === 0) return [];
        const instancesPath = path.resolve(__dirname, "minecraft/instances");
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
        const optionsPath = path.resolve(`./minecraft/instances/${instance_id}/options.txt`);
        if (dont_complete_if_already_exists && fs.existsSync(optionsPath)) {
            return content.version;
        }
        fs.writeFileSync(optionsPath, content.content, "utf-8");
        return content.version;
    },
    deleteWorld: (instance_id, world_id) => {
        const savesPath = path.resolve(`./minecraft/instances/${instance_id}/saves`);
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
        const instancePath = path.resolve(__dirname, `minecraft/instances/${instance_id}`);
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
        const src = path.resolve(__dirname, `minecraft/instances/${old_instance_id}`);
        const dest = path.resolve(__dirname, `minecraft/instances/${new_instance_id}`);
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
    deleteContent: (instance_id, project_type, file_name) => {
        let folder;
        if (project_type === "mod") {
            folder = path.resolve(__dirname, `minecraft/instances/${instance_id}/mods`);
        } else if (project_type === "resource_pack") {
            folder = path.resolve(__dirname, `minecraft/instances/${instance_id}/resourcepacks`);
        } else if (project_type === "shader") {
            folder = path.resolve(__dirname, `minecraft/instances/${instance_id}/shaderpacks`);
        } else {
            return false;
        }

        const filePath = path.join(folder, file_name);
        try {
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
                return true;
            }
            // Try with .disabled extension if not found
            if (fs.existsSync(filePath + ".disabled")) {
                fs.unlinkSync(filePath + ".disabled");
                return true;
            }
            return false;
        } catch (err) {
            return false;
        }
    },
    updateOptionsTXT: (instance_id, key, value) => {
        console.log("Updating " + key + " to " + value);
        const optionsPath = path.resolve(`./minecraft/instances/${instance_id}/options.txt`);
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
            lines.push(`${key}: ${value}`);
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
    readFile: (filePath) => {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
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
                }, customResolution, quickPlay, false, allocatedRam, javaPath, parseJavaArgs(javaArgs), parseEnvString(envVars), preLaunch, wrapper, postExit), "player_info": player_info
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
    deleteServer: async (instance_id, ip, index) => {
        let patha = `./minecraft/instances/${instance_id}`;
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
    getMultiplayerWorlds: async (instance_id) => {
        let patha = `./minecraft/instances/${instance_id}`;
        fs.mkdirSync(patha, { recursive: true });
        let serversDatPath = path.resolve(patha, 'servers.dat');
        let worlds = [];

        if (!fs.existsSync(serversDatPath)) {
            return worlds;
        }

        try {
            const buffer = fs.readFileSync(serversDatPath);
            const data = await nbt.parse(buffer);
            console.log(data);
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
        }

        return worlds;
    },
    openFolder: (folderPath) => {
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
        let patha = `./minecraft/instances/${instance_id}/logs`;
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
        let folderPath = `./minecraft/instances/${instance_id}/logs`;
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
        let patha = `./minecraft/instances/${instance_id}/mods`;
        let pathb = `./minecraft/instances/${instance_id}/resourcepacks`;
        let pathc = `./minecraft/instances/${instance_id}/shaderpacks`;
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
    downloadVanillaTweaksResourcePacks: async (packs, version, instance_id) => {
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

        console.log(pack_info);

        let packs_send = {};
        for (let i = 0; i < packs.length; i++) {
            if (!packs_send[pack_info[packs[i].id]]) {
                packs_send[pack_info[packs[i].id]] = [packs[i].id]
            } else {
                packs_send[pack_info[packs[i].id]].push(packs[i].id);
            }
        }

        console.log(packs_send);

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
        if (data_vt.link) {
            const resourcepacksDir = `./minecraft/instances/${instance_id}/resourcepacks`;
            fs.mkdirSync(resourcepacksDir, { recursive: true });
            let baseName = "vanilla_tweaks.zip";
            let filePath = path.join(resourcepacksDir, baseName);
            let counter = 1;
            while (fs.existsSync(filePath)) {
                baseName = `vanilla_tweaks_${counter}.zip`;
                filePath = path.join(resourcepacksDir, baseName);
                counter++;
            }
            await urlToFile("https://vanillatweaks.net" + data_vt.link, filePath);

            return baseName;
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
                "vt_id": e.name
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
                "vt_id": e.name
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
    onLaunchInstance: async (callback) => {
        let v = await ipcRenderer.invoke('get-instance-to-launch');
        if (v?.instance_id) callback(v);
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
        let reserved_names = ["con", "prn", "aux", "nul", "com0", "com1", "com2", "com3", "com4", "com5", "com6", "com7", "com8", "com9", "lpt0", "lpt1", "lpt2", "lpt3", "lpt4", "lpt5", "lpt6", "lpt7", "lpt8", "lpt9", ""]
        for (let i = 0; i < instance_id.length; i++) {
            if (!/^[0-9a-zA-Z_\-\s]$/.test(instance_id[i])) {
                instance_id = instance_id.substring(0, i) + "_" + instance_id.substring(i + 1);
            }
        }
        if (reserved_names.includes(instance_id.toLowerCase())) {
            instance_id += "_";
        }
        let baseInstanceId = instance_id.trim();
        let counter = 1;
        while (folderExists(`./minecraft/instances/${instance_id}`)) {
            instance_id = `${baseInstanceId}_${counter}`;
            counter++;
        }
        fs.mkdirSync(`./minecraft/instances/${instance_id}`, { recursive: true });
        return instance_id;
    },
    getInstanceFolders: (instance_id) => {
        const instancePath = path.resolve(__dirname, `minecraft/instances/${instance_id}`);
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
    repairMinecraft: async (instance_id, loader, vanilla_version, loader_version) => {
        let mc = new Minecraft(instance_id);
        let r = await mc.downloadGame(loader, vanilla_version, true);
        if (loader == "fabric") {
            await mc.installFabric(vanilla_version, loader_version, true);
        } else if (loader == "forge") {
            await mc.installForge(vanilla_version, loader_version, true);
        } else if (loader == "neoforge") {
            await mc.installNeoForge(vanilla_version, loader_version, true);
        } else if (loader == "quilt") {
            await mc.installQuilt(vanilla_version, loader_version, true);
        }
        return { "java_installation": r.java_installation.replaceAll("\\", "/"), "java_version": r.java_version };
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
            install_path = path.resolve(__dirname, `minecraft/instances/${instance_id}/mods`, filename);
        } else if (project_type == "resource_pack") {
            install_path = path.resolve(__dirname, `minecraft/instances/${instance_id}/resourcepacks`, filename);
        } else if (project_type == "shader") {
            install_path = path.resolve(__dirname, `minecraft/instances/${instance_id}/shaderpacks`, filename);
        }
        if (fs.existsSync(install_path)) {
            fs.unlinkSync(install_path);
            return true;
        }
        return false;
    },
    addContent: async (instance_id, project_type, project_url, filename, data_pack_world) => {
        let install_path = "";
        if (project_type == "mod") {
            install_path = path.resolve(__dirname, `minecraft/instances/${instance_id}/mods`, filename);
        } else if (project_type == "resourcepack") {
            install_path = path.resolve(__dirname, `minecraft/instances/${instance_id}/resourcepacks`, filename);
        } else if (project_type == "shader") {
            install_path = path.resolve(__dirname, `minecraft/instances/${instance_id}/shaderpacks`, filename);
        } else if (project_type == "world") {
            install_path = path.resolve(__dirname, `minecraft/instances/${instance_id}/temp_worlds`, filename);
        } else if (project_type == "datapack") {
            install_path = path.resolve(__dirname, `minecraft/instances/${instance_id}/saves/${data_pack_world}/datapacks`, filename);
        }

        console.log("Installing", project_url, "to", install_path);

        await urlToFile(project_url, install_path);

        if (project_type === "world") {
            const savesPath = path.resolve(__dirname, `minecraft/instances/${instance_id}/saves`);
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
            const tempWorldPath = path.resolve(__dirname, `minecraft/instances/${instance_id}/temp_worlds`);
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
        await urlToFile(url, `./minecraft/instances/${instance_id}/pack.mrpack`);
        ipcRenderer.send('progress-update', `Downloading ${title}`, 100, "Done!");
    },
    downloadCurseforgePack: async (instance_id, url, title) => {
        ipcRenderer.send('progress-update', `Downloading ${title}`, 0, "Beginning download...");
        await urlToFile(url, `./minecraft/instances/${instance_id}/pack.zip`);
        ipcRenderer.send('progress-update', `Downloading ${title}`, 100, "Done!");
    },
    processPackFile: async (file_path, instance_id, title) => {
        let extension = path.extname(file_path);
        console.log(extension);
        if (extension == ".mrpack") {
            return await processMrPack(instance_id, file_path, null, title);
        } else if (extension == ".zip") {
            return await processCfZipWithoutID(instance_id, file_path, null, title);
        } else if (extension == "") {
            return;
            return await processFolder(instance_id, file_path, title);
        }
    },
    processMrPack,
    processCfZip,
    getScreenshots: (instance_id) => {
        let screenshotsPath = `./minecraft/instances/${instance_id}/screenshots`;
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
                    file_path: `minecraft/instances/${instance_id}/screenshots/` + file
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
                image = nativeImage.createFromBuffer(Buffer.from(response.data));
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
    downloadSkin,
    downloadCape: async (url, id) => {
        if (!url.includes("textures.minecraft.net")) throw new Error("Attempted XSS");
        await urlToFile(url, `./minecraft/capes/${id}.png`);
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
        let filePath = path.resolve(__dirname, `minecraft/skins/${skin_id}.png`);
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
        fs.writeFileSync(`./minecraft/skins/${hash.hash}.png`, buffer);
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
            filters: [{ name: 'Pack Files', extensions: ['mrpack', 'zip'] }]
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
        return path.resolve(__dirname, "minecraft/instances");
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
        const versionsJsonPath = path.join(__dirname, "java", "versions.json");
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
        const savesPath = path.resolve(__dirname, `minecraft/instances/${instance_id}/saves`);
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
                const p = path.join(os.homedir(), "AppData", "Roaming", "ModrinthApp", "profiles");
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
                const p = path.join(__dirname, "minecraft/instances");
                return fs.existsSync(p) ? p : "";
            }
            default:
                return "";
        }
    },
    getInstanceOptions: (instance_id) => {
        const optionsPath = path.resolve(`./minecraft/instances/${instance_id}/options.txt`);
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
    },
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
        let shortcutPath = path.join(desktopPath, `${safeName} - Minecraft.lnk`);

        let base_shortcut = safeName + " - Minecraft";
        let count_shortcut = 1;

        while (fs.existsSync(shortcutPath)) {
            shortcutPath = path.join(desktopPath, `${base_shortcut} (${count_shortcut}).lnk`);
            count_shortcut++;
        }

        let target, workingDir, args;

        let isDev = await ipcRenderer.invoke('is-dev');

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

        let iconPath = path.resolve(__dirname, "temp_icons", instance_id + '.ico');

        while (fs.existsSync(iconPath)) {
            iconPath = path.resolve(__dirname, "temp_icons", base_path_name + "_" + current_count + ".ico");
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

    const image = await Jimp.read(imageBuffer);
    const resized = await image.resize({ w: 256, h: 256, mode: "nearestNeighbor" }).getBuffer("image/png");

    const icoBuffer = await pngToIco(resized);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true })
    fs.writeFileSync(outputPath, icoBuffer);
}

function getWorld(levelDatPath) {
    const buffer = fs.readFileSync(levelDatPath);
    const decompressed = zlib.gunzipSync(buffer); // Decompress the GZip data

    const data = nbt.parseUncompressed(decompressed); // Synchronous parsing
    const levelData = data.value.Data.value;

    const parentFolder = path.basename(path.dirname(levelDatPath));
    const grandparentFolder = path.dirname(path.dirname(levelDatPath));

    console.log(levelData);

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
        } catch (e) {
            console.error(`Failed to parse level.dat for world ${dir.name}:`, e);
        }
    }
    worldDirs.closeSync();
    return worlds;
}

function getSinglePlayerWorlds(instance_id) {
    let patha = path.resolve(__dirname, `minecraft/instances/${instance_id}/saves`);
    return getWorlds(patha);
}

// async function processFolder(instance_id, folder_path, title) {
//     ipcRenderer.send('progress-update', `Installing ${title}`, 0, "Beginning install...");
//     const destPath = path.resolve(__dirname, `minecraft/instances/${instance_id}`);
//     fs.mkdirSync(destPath, { recursive: true });

//     const files = fs.readdirSync(folder_path);
//     for (let i = 0; i < files.length; i++) {
//         let file = files[i];
//         ipcRenderer.send('progress-update', `Installing ${title}`, (i+1)/files.length*100, `Moving ${file} (${i+1} of ${files.length})`);
//         const src = path.join(folder_path, file);
//         const dest = path.join(destPath, file);

//         const stat = fs.statSync(src);
//         if (stat.isDirectory()) {
//             fs.cpSync(src, dest, { recursive: true });
//         } else {
//             fs.copyFileSync(src, dest);
//         }
//     }
//     ipcRenderer.send('progress-update', `Installing ${title}`, 100, "Done!");
//     return true;
// }

async function hashImageFromDataUrl(dataUrl) {
    const base64Data = dataUrl.split(',')[1];
    if (!base64Data) throw new Error("Invalid data URL");

    const imageBuffer = Buffer.from(base64Data, 'base64');

    const { data, info } = await sharp(imageBuffer)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

    console.log(data);
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

    let extractToPath = `./minecraft/instances/${instance_id}`;

    if (!fs.existsSync(extractToPath)) {
        fs.mkdirSync(extractToPath, { recursive: true });
    }

    zip.extractAllTo(extractToPath, true);

    let srcDir = `./minecraft/instances/${instance_id}/overrides`;
    let destDir = `./minecraft/instances/${instance_id}`;

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

    for (let i = 0; i < manifest_json.files.length; i++) {
        ipcRenderer.send('progress-update', `Installing ${title}`, ((i + 1) / manifest_json.files.length) * 89 + 10, `Downloading file ${i + 1} of ${manifest_json.files.length}`);

        let dependency_item = cf_id ? dependency_json.data.find(dep => dep.id === manifest_json.files[i].projectID) : null;

        let folder = "mods";
        if (dependency_item?.categoryClass?.slug == "texture-packs") folder = "resourcepacks";
        else if (dependency_item?.categoryClass?.slug == "shaders") folder = "shaderpacks";
        let type = "mod";
        if (dependency_item?.categoryClass?.slug == "texture-packs") type = "resource_pack";
        else if (dependency_item?.categoryClass?.slug == "shaders") folder = "shader";

        let file_name = await urlToFolder(`https://www.curseforge.com/api/v1/mods/${manifest_json.files[i].projectID}/files/${manifest_json.files[i].fileID}/download`, path.resolve(extractToPath, folder));

        if (cf_id) content.push({
            "author": dependency_item?.authorName ?? "",
            "disabled": false,
            "file_name": file_name,
            "image": dependency_item?.logoUrl ?? "",
            "source": "curseforge",
            "source_id": manifest_json.files[i].projectID,
            "type": type,
            "version": manifest_json.files[i].fileID,
            "name": dependency_item?.name ?? file_name
        })
    }
    ipcRenderer.send('progress-update', `Installing ${title}`, 100, "Done!");
    return ({
        "loader_version": manifest_json.minecraft.modLoaders[0].id.split("-")[1],
        "content": content,
        "loader": manifest_json.minecraft.modLoaders[0].id.split("-")[0],
        "vanilla_version": manifest_json.minecraft.version
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
    const destPath = path.resolve(__dirname, `minecraft/instances/${instance_id}/${destFolder}`);
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

    let extractToPath = `./minecraft/instances/${instance_id}`;

    if (!fs.existsSync(extractToPath)) {
        fs.mkdirSync(extractToPath, { recursive: true });
    }

    zip.extractAllTo(extractToPath, true);

    let srcDir = `./minecraft/instances/${instance_id}/overrides`;
    let destDir = `./minecraft/instances/${instance_id}`;

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

    for (let i = 0; i < manifest_json.files.length; i++) {
        ipcRenderer.send('progress-update', `Installing ${title}`, ((i + 1) / manifest_json.files.length) * 89 + 10, `Downloading file ${i + 1} of ${manifest_json.files.length}`);

        let file_name = await urlToFolder(`https://www.curseforge.com/api/v1/mods/${manifest_json.files[i].projectID}/files/${manifest_json.files[i].fileID}/download`, path.resolve(extractToPath, "temp"));
        const tempFilePath = path.resolve(extractToPath, "temp", file_name);
        let fileType = "mod";
        let destFolder = "mods";

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
                    destFolder = "resourcepacks";
                } else if (tempZip.getEntry("shaders/")) {
                    fileType = "shader";
                    destFolder = "shaderpacks";
                } else {
                    destFolder = "resourcepacks";
                }
            }
        } catch (e) {
            destFolder = "mods";
        }

        const finalPath = path.resolve(extractToPath, destFolder, file_name);
        fs.mkdirSync(path.dirname(finalPath), { recursive: true });
        fs.renameSync(tempFilePath, finalPath);
    }
    ipcRenderer.send('progress-update', `Installing ${title}`, 100, "Done!");
    return ({
        "loader_version": manifest_json.minecraft.modLoaders[0].id.split("-")[1],
        "content": [],
        "loader": manifest_json.minecraft.modLoaders[0].id.split("-")[0],
        "vanilla_version": manifest_json.minecraft.version
    })
}
async function processMrPack(instance_id, mrpack_path, loader, title = ".mrpack file") {
    ipcRenderer.send('progress-update', `Installing ${title}`, 0, "Beginning install...");
    const zip = new AdmZip(mrpack_path);

    let extractToPath = `./minecraft/instances/${instance_id}`;

    if (!fs.existsSync(extractToPath)) {
        fs.mkdirSync(extractToPath, { recursive: true });
    }

    zip.extractAllTo(extractToPath, true);

    let srcDir = `./minecraft/instances/${instance_id}/overrides`;
    let destDir = `./minecraft/instances/${instance_id}`;

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

    for (let i = 0; i < modrinth_index_json.files.length; i++) {
        ipcRenderer.send('progress-update', `Installing ${title}`, ((i + 1) / modrinth_index_json.files.length) * 89 + 10, `Downloading file ${i + 1} of ${modrinth_index_json.files.length}`);
        await urlToFile(modrinth_index_json.files[i].downloads[0], path.resolve(extractToPath, modrinth_index_json.files[i].path));
        if (modrinth_index_json.files[i].downloads[0].includes("https://cdn.modrinth.com/data")) {
            let split = modrinth_index_json.files[i].downloads[0].split("/");
            let project_id = split[4];
            let file_id = split[6];
            if (project_id && file_id) {
                let res_1 = await fetch(`https://api.modrinth.com/v2/project/${project_id}`);
                let res_1_json = await res_1.json();
                let res = await fetch(`https://api.modrinth.com/v2/project/${project_id}/version/${file_id}`);
                let res_json = await res.json();
                let get_author_res = await fetch(`https://api.modrinth.com/v2/project/${project_id}/members`);
                let get_author_res_json = await get_author_res.json();
                let author = "";
                get_author_res_json.forEach(e => {
                    if (e.role == "Owner" || e.role == "Lead developer" || e.role == "Project Lead") {
                        author = e.user.username;
                    }
                });

                let file_name = res_json.files[0].filename;
                let version = res_json.version_number;

                let project_type = res_1_json.project_type;
                if (project_type == "resourcepack") project_type = "resource_pack";

                content.push({
                    "author": author,
                    "disabled": false,
                    "file_name": file_name,
                    "image": res_1_json.icon_url,
                    "source": "modrinth",
                    "source_id": project_id,
                    "type": project_type,
                    "version": version,
                    "name": res_1_json.title
                })
            }
        }
    }
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
        "vanilla_version": modrinth_index_json.dependencies["minecraft"]
    })
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
    if (!url.includes("textures.minecraft.net")) throw new Error("Attempted XSS");

    const response = await axios.get(url, { responseType: "arraybuffer" });
    const imageBuffer = Buffer.from(response.data);

    const { data, info } = await sharp(imageBuffer)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

    const hash = crypto.createHash('sha256')
        .update(data)
        .digest('hex');

    fs.writeFileSync(`./minecraft/skins/${hash}.png`, imageBuffer);

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