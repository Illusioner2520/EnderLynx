const { contextBridge, ipcRenderer, clipboard, nativeImage, dialog } = require('electron');
const fs = require('fs');
const path = require('path');
const { Minecraft, Java, Fabric, urlToFile, Forge, NeoForge, Quilt } = require('./launch.js');
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

const db = new Database('app.db');

db.prepare('CREATE TABLE IF NOT EXISTS instances (id INTEGER PRIMARY KEY, name TEXT, date_created TEXT, date_modified TEXT, last_played TEXT, loader TEXT, vanilla_version TEXT, loader_version TEXT, playtime INTEGER, locked INTEGER, downloaded INTEGER, group_id TEXT, image TEXT, instance_id TEXT, java_version INTEGER, java_path TEXT, current_log_file TEXT, pid INTEGER, install_source TEXT, install_id TEXT, installing INTEGER, mc_installed INTEGER, window_width INTEGER, window_height INTEGER, allocated_ram INTEGER)').run();
db.prepare('CREATE TABLE IF NOT EXISTS profiles (id INTEGER PRIMARY KEY, access_token TEXT, client_id TEXT, expires TEXT, name TEXT, refresh_token TEXT, uuid TEXT, xuid TEXT, is_demo INTEGER, is_default INTEGER)').run();
db.prepare('CREATE TABLE IF NOT EXISTS defaults (id INTEGER PRIMARY KEY, default_type TEXT, value TEXT)').run();
db.prepare('CREATE TABLE IF NOT EXISTS content (id INTEGER PRIMARY KEY, name TEXT, author TEXT, disabled INTEGER, image TEXT, file_name TEXT, source TEXT, type TEXT, version TEXT, instance TEXT, source_info TEXT)').run();
db.prepare('CREATE TABLE IF NOT EXISTS skins (id INTEGER PRIMARY KEY, file_name TEXT, last_used TEXT, name TEXT, model TEXT, active_uuid TEXT, skin_id TEXT)').run();
db.prepare('CREATE TABLE IF NOT EXISTS capes (id INTEGER PRIMARY KEY, uuid TEXT, cape_name TEXT, last_used TEXT, cape_id TEXT, cape_url TEXT, active INTEGER)').run();

db.pragma('journal_mode = WAL');

let vt_rp = {}, vt_dp = {}, vt_ct = {};

let processWatches = {};

class LoginError extends Error {
    constructor(message) {
        super(message);
    }
}

contextBridge.exposeInMainWorld('electronAPI', {
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
    playMinecraft: async (loader, version, loaderVersion, instance_id, player_info, quickPlay, customResolution, allocatedRam, javaPath) => {
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
                }, customResolution, quickPlay, false, allocatedRam, javaPath), "player_info": player_info
            };
        } catch (err) {
            throw new Error("Unable to launch Minecraft");
        }
    },
    getJavaInstallation: async (v) => {
        let java = new Java();
        return java.getJavaInstallation(v);
    },
    getFabricVanillaVersions: async () => {
        let fabric = new Fabric();
        return await fabric.getSupportedVanillaVersions();
    },
    getFabricLoaderVersions: async (v) => {
        let fabric = new Fabric();
        return await fabric.getVersions(v);
    },
    checkForProcess: (pid) => {
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
    },
    killProcess: async (pid) => {
        if (!pid) return;
        process.kill(pid);
    },
    getSinglePlayerWorlds: (instance_id) => {
        let patha = `./minecraft/instances/${instance_id}/saves`;
        fs.mkdirSync(patha, { recursive: true });
        let worldDirs = fs.opendirSync(patha);
        let worlds = [];

        let dir;
        while ((dir = worldDirs.readSync()) !== null) {
            if (!dir.isDirectory()) continue;
            const levelDatPath = path.resolve(patha, dir.name, 'level.dat');

            try {
                const buffer = fs.readFileSync(levelDatPath);
                const decompressed = zlib.gunzipSync(buffer); // Decompress the GZip data

                const data = nbt.parseUncompressed(decompressed); // Synchronous parsing
                const levelData = data.value.Data.value;

                worlds.push({
                    name: levelData.LevelName.value,
                    id: dir.name,
                    last_played: Number(levelData.LastPlayed.value),
                    icon: fs.existsSync(path.resolve(patha, dir.name, "icon.png"))
                        ? `minecraft/instances/${instance_id}/saves/${dir.name}/icon.png`
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
                });
            } catch (e) {
                console.error(`Failed to parse level.dat for world ${dir.name}:`, e);
            }
        }
        worldDirs.closeSync();
        return worlds;
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
            const servers = data.parsed?.value?.servers?.value?.value || [];

            for (const server of servers) {
                worlds.push({
                    name: server.name?.value || "Unknown",
                    ip: server.ip?.value || "",
                    icon: server.icon?.value ? "data:image/png;base64," + server.icon?.value : "",
                    acceptTextures: server.acceptTextures?.value ?? false,
                    hideAddress: server.hideAddress?.value ?? false,
                    last_played: server.lastOnline?.value ? Number(server.lastOnline.value) : null
                });
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
            if (error) {
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
            let modJson = null;
            try {
                const zip = fs.readFileSync(filePath);

                const admZip = new AdmZip(zip);
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
                    let forgeModJson = null;
                    try {
                        forgeModJson = toml.parse(modsTomlData);
                        if (Array.isArray(forgeModJson.mods) && forgeModJson.mods.length > 0) {
                            const mod = forgeModJson.mods[0];
                            if (mod.logoFile) {
                                let iconPath = Array.isArray(mod.logoFile) ? mod.logoFile[0] : mod.logoFile;
                                const iconEntry = admZip.getEntry(iconPath);
                                if (iconEntry) {
                                    const iconBuffer = iconEntry.getData();
                                    let mime = 'image/png';
                                    if (iconPath.endsWith('.jpg') || iconPath.endsWith('.jpeg')) mime = 'image/jpeg';
                                    else if (iconPath.endsWith('.gif')) mime = 'image/gif';
                                    modJson.icon = `data:${mime};base64,${iconBuffer.toString('base64')}`;
                                }
                            }
                            modJson = {
                                ...modJson,
                                name: mod.displayName || mod.modId || file.replace(".jar.disabled", ".jar"),
                                version: (!mod.version?.includes("$") && mod.version) ? mod.version : "",
                                authors: mod.authors ? [mod.authors] : [],
                                description: mod.description || "",
                            };
                        }
                    } catch (e) { }
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
        console.log(data_vt);
        data_vt = JSON.parse(data_vt);
        if (data_vt.link) {
            await urlToFile("https://vanillatweaks.net" + data_vt.link, `./minecraft/instances/${instance_id}/resourcepacks/vanilla_tweaks.zip`);
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
        let baseInstanceId = instance_id;
        let counter = 1;
        while (folderExists(`./minecraft/instances/${instance_id}`)) {
            instance_id = `${baseInstanceId}_${counter}`;
            counter++;
        }
        fs.mkdirSync(`./minecraft/instances/${instance_id}`, { recursive: true });
        return instance_id;
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
        if (loader) gf = "&gameFlavors[0]=" + ["", "forge", "", "", "fabric", "quilt", "neoforge"].indexOf(loader);
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
    addContent: async (instance_id, project_type, project_url, filename) => {
        let install_path = "";
        if (project_type == "mod") {
            install_path = path.resolve(__dirname, `minecraft/instances/${instance_id}/mods`, filename);
        } else if (project_type == "resourcepack") {
            install_path = path.resolve(__dirname, `minecraft/instances/${instance_id}/resourcepacks`, filename);
        } else if (project_type == "shader") {
            install_path = path.resolve(__dirname, `minecraft/instances/${instance_id}/shaderpacks`, filename);
        }

        console.log("Installing", project_url, "to", install_path);

        await urlToFile(project_url, install_path);

        let type_convert = {
            "mod": "mod",
            "resourcepack": "resource_pack",
            "shader": "shader"
        }

        return {
            type: type_convert[project_type],
            file_name: filename
        };
    },
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
    processCfZip: async (instance_id, zip_path, cf_id, title = ".zip file") => {
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

        let dependency_res = await fetch(`https://www.curseforge.com/api/v1/mods/${cf_id}/dependencies?index=0&pageSize=1000`);
        let dependency_json = await dependency_res.json();

        let content = [];

        for (let i = 0; i < manifest_json.files.length; i++) {
            ipcRenderer.send('progress-update', `Installing ${title}`, ((i + 1) / manifest_json.files.length) * 89 + 10, `Downloading file ${i + 1} of ${manifest_json.files.length}`);
            let file_name = manifest_json.files[i].projectID + "-" + manifest_json.files[i].fileID + ".jar";

            let dependency_item = dependency_json.data.find(dep => dep.id === manifest_json.files[i].projectID);

            let folder = "mods";
            if (dependency_item?.categoryClass?.slug == "texture-packs") folder = "resourcepacks";
            else if (dependency_item?.categoryClass?.slug == "shaders") folder = "shaderpacks";
            let type = "mod";
            if (dependency_item?.categoryClass?.slug == "texture-packs") type = "resource_pack";
            else if (dependency_item?.categoryClass?.slug == "shaders") folder = "shader";

            await urlToFile(`https://www.curseforge.com/api/v1/mods/${manifest_json.files[i].projectID}/files/${manifest_json.files[i].fileID}/download`, path.resolve(extractToPath, folder, file_name));


            content.push({
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
    },
    processMrPack: async (instance_id, mrpack_path, loader = "minecraft", title = ".mrpack file") => {
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
        if (loader == "fabric") loader = "fabric-loader";
        if (loader == "quilt") loader = "quilt-loader";
        ipcRenderer.send('progress-update', `Installing ${title}`, 100, "Done!");
        return ({
            "loader_version": modrinth_index_json.dependencies[loader],
            "content": content
        })
    },
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
    copyImageToClipboard: (file_path) => {
        try {
            const image = nativeImage.createFromPath(file_path);
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
    downloadSkin: async (url) => {
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

        return hash;
    },
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
                        reject(new Error("Unable to set skin"));
                    } else {
                        resolve({ "status": res.statusCode, "player_info": player_info, "skin_info": JSON.parse(data) });
                    }
                });
            });

            req.on('error', (e) => {
                console.error('Native HTTP Request Error:', e);
                reject(new Error("Unable to set skin"));
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
    triggerFileBrowse: async (file_path) => {
        let startDir = file_path;
        if (fs.existsSync(file_path)) {
            const stat = fs.statSync(file_path);
            if (stat.isFile()) {
                startDir = path.dirname(file_path);
            }
        }
        console.log(startDir);
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
    }
});

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