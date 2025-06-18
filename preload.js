const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');
const { Minecraft, Java, Fabric, urlToFile, Forge, NeoForge, Quilt } = require('./launch.js');
const { spawn, exec } = require('child_process');
const nbt = require('prismarine-nbt');
const zlib = require('zlib');
const { Auth } = require('msmc');
const AdmZip = require('adm-zip');
const https = require('https');
const querystring = require('querystring');

let default_data = { "instances": [], "profile_info": {}, "default_sort": "name", "default_group": "none" }

if (!fs.existsSync("./data.json")) {
    fs.writeFileSync("./data.json", JSON.stringify(default_data));
}

contextBridge.exposeInMainWorld('electronAPI', {
    readFile: (filePath) => {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            return content;
        } catch (err) {
            return `Error reading file: ${err.message}`;
        }
    },
    saveData: (data) => {
        try {
            fs.writeFileSync("data.json", data, 'utf-8');
            return true;
        } catch (err) {
            return false;
        }
    },
    playMinecraft: async (loader, version, loaderVersion, instance_id, player_info, quickPlay) => {
        let date = new Date();
        date.setHours(date.getHours() - 1);
        if (new Date(player_info.expires) < date) {
            player_info = await getNewAccessToken(player_info.refresh_token);
        }
        let mc = new Minecraft(instance_id);
        try {
            return {
                "minecraft": await mc.launchGame(loader, version, loaderVersion, player_info.name, player_info.uuid, {
                    "accessToken": player_info.access_token,
                    "xuid": player_info.xuid,
                    "clientId": player_info.client_id
                }, null, quickPlay, false), "player_info": player_info
            };
        } catch (err) {
            console.error(err);
            return false;
        }
    },
    getJavaInstallation: async (v) => {
        let java = new Java();
        java.getJavaInstallation(v);
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
            console.log(data);
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
            "is_demo": token.profile.demo,
            "xuid": token.xuid,
            "client_id": getUUID(),
            "expires": date.toString()
        }
    },
    getInstanceLogs: (instance_id) => {
        let patha = `./minecraft/instances/${instance_id}/logs`;
        fs.mkdirSync(patha, { recursive: true });
        return fs.readdirSync(patha).filter(e => e.includes(".log") && !e.includes("latest") && !e.includes(".gz")).map(e => {
            let date = e.replace(".log", "").split("_");
            if (date[1]) date[1] = date[1].replaceAll("-", ":");
            return ({ "date": (new Date(date.join(" "))).toString(), "file_path": path.resolve(patha, e) });
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
            let fabricModJson = null;
            try {
                const zip = fs.readFileSync(filePath);

                const admZip = new AdmZip(zip);
                const entry = admZip.getEntry('fabric.mod.json');
                if (entry) {
                    fabricModJson = JSON.parse(entry.getData().toString('utf-8'));
                    if (fabricModJson.icon) {
                        let iconPath = Array.isArray(fabricModJson.icon) ? fabricModJson.icon[0] : fabricModJson.icon;
                        const iconEntry = admZip.getEntry(iconPath);
                        if (iconEntry) {
                            const iconBuffer = iconEntry.getData();
                            let mime = 'image/png';
                            if (iconPath.endsWith('.jpg') || iconPath.endsWith('.jpeg')) mime = 'image/jpeg';
                            else if (iconPath.endsWith('.gif')) mime = 'image/gif';
                            fabricModJson.icon = `data:${mime};base64,${iconBuffer.toString('base64')}`;
                        }
                    }
                }
            } catch (e) { }
            return {
                type: 'mod',
                name: fabricModJson?.name ?? file.replace(".jar.disabled", ".jar"),
                source: "player_install",
                file_name: file,
                version: fabricModJson?.version ?? "",
                disabled: file.includes(".jar.disabled"),
                author: fabricModJson?.authors && fabricModJson?.authors[0] ? (fabricModJson?.authors[0]?.name ? fabricModJson.authors[0].name : fabricModJson.authors[0]) : "",
                image: fabricModJson?.icon ?? ""
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
            return {
                type: 'resource_pack',
                name: packMcMeta?.pack?.description ?? file.replace(".zip.disabled", ".zip"),
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
    downloadVanillaTweaks: async (packs, version) => {
        let h = querystring.stringify({
            "packs": '{"aesthetic":["AnimatedCampfireItem","HDShieldBanners"],"terrain":["ShorterTallGrass","ShorterGrass","BetterBedrock"],"variation":["VariatedBookshelves","VariatedUnpolishedStones","VariatedTerracotta","VariatedStone","VariatedPlanks","VariatedLogs","VariatedMushroomBlocks","VariatedNylium","VariatedEndStone","VariatedGravel","VariatedMycelium","RandomMossRotation","VariatedCobblestone","VariatedGrass","RandomCoarseDirtRotation"],"utility":["NoteblockBanners","VisualComposterStages","VisualCauldronStages","VisualHoney","BrewingGuide","CompassLodestone","GroovyLevers","RedstonePowerLevels","BetterObservers","DirectionalDispensersDroppers","DirectionalHoppers","StickyPistonSides","MusicDiscRedstonePreview","HungerPreview","Age25Kelp","DifferentStems","FullAgeAmethystMarker","FullAgeCropMarker","VisualWaxedCopperItems","VisualInfestedStoneItems","BuddingAmethystBorders","SuspiciousSandGravelBorders","OreBorders","UniqueAxolotlBuckets","UniquePaintingItems"],"unobtrusive":["NoPumpkinOverlay","LowerFire","LowerShield","CleanTintedGlass","CleanStainedGlass","CleanGlass"],"gui":["RainbowExperience","NumberedHotbar","DarkUI"],"gui.hearts":["ColoredHeartsOrange"],"gui.hotbar-selector":["ColoredHotbarSelOrange"],"gui.widgets":["ColoredWidgetsGray"],"fun":["WhatSpyglassMeme","GreenAxolotl","SmileyAxolotls"],"world-of-color":["UniqueDyes"],"fixes-and-consistency":["HoeFix","IronBarsFix","ProperBreakParticles","SlimeParticleFix","DripleafFixBig","CactusBottomFix","ConsistentDecorPot"]}',
            "version": "1.21"
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
        let data = await new Promise((resolve, reject) => {
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
        data = JSON.parse(data);
        if (data.link) {
            urlToFile("https://vanillatweaks.net" + data.link, "test.zip");
        }
    },
    onProgressUpdate: (callback) => {
        ipcRenderer.on('progress-update', (_event, title, progress, desc) => {
            callback(title, progress, desc);
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
    downloadMinecraft: (instance_id, loader, vanilla_version, loader_version) => {
        let mc = new Minecraft(instance_id);
        mc.downloadGame(loader, vanilla_version);
        if (loader == "fabric") {
            mc.installFabric(vanilla_version, loader_version);
        }
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
    }
});

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
        "expires": date.toString()
    }
}