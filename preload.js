const { contextBridge, ipcRenderer, clipboard, shell, webUtils } = require('electron');
const path = require('path');
const os = require('os');
const MarkdownIt = require('markdown-it');
const { version } = require('./package.json');
const QRCode = require('qrcode');

let cfServerInfo = {};

let userPath = path.resolve(process.argv.find(arg => arg.startsWith('--userDataPath=')).split('=')[1]);

let enableDevMode = process.argv.includes("--dev");
let pageCallback = () => { };
let launchInstanceCallback = () => { };
let installInstanceCallback = () => { }
let startingPage = null;
let installInfo = {};
let launchInfo = {};

function processInfo(info) {
    launchInfo = {
        instance_id: info.instance_id,
        world: info.world
    }
    startingPage = info.page;
    installInfo = info.installInfo;

    if (installInstanceCallback) installInstanceCallback(installInfo);
    if (launchInstanceCallback) launchInstanceCallback(launchInfo);
    if (pageCallback) pageCallback(info.page);
}

let svgData = process.argv.find(arg => arg.startsWith('--svgData=')).split('=').slice(1).join('=');

let vt_rp = {}, vt_dp = {}, vt_ct = {};

let processWatches = {};

function openInBrowser(url) {
    if (!url) return;
    shell.openExternal(url);
}

async function readElPack(file_path) {
    return await ipcRenderer.invoke('read-elpack', file_path);
}

async function readMrPack(file_path) {
    return await ipcRenderer.invoke('read-mrpack', file_path);
}

async function readCfZip(file_path) {
    return await ipcRenderer.invoke('read-cfzip', file_path);
}

ipcRenderer.on('arg-info', (event, info) => {
    processInfo(info);
});

contextBridge.exposeInMainWorld('enderlynx', {
    onOpenFile: (callback) => {
        ipcRenderer.on('open-file', async (event, filePath) => {
            let ext = path.extname(filePath);
            let info = {};
            if (ext == ".elpack") {
                info = await readElPack(filePath);
            } else if (ext == ".mrpack") {
                info = await readMrPack(filePath);
            } else if (ext == ".zip") {
                info = await readCfZip(filePath);
            }
            if (info) callback(info, filePath);
        });
    },
    version: enableDevMode ? version + "-dev" : version,
    userPath,
    isDev: enableDevMode,
    resourcePath: process.resourcesPath,
    osplatform: () => os.platform(),
    osrelease: () => os.release(),
    osarch: () => os.arch(),
    osversion: () => os.version?.() || `${os.type()} ${os.release()}`,
    ostype: () => {
        let type = "unix";
        if (os.platform() == "win32") type = "windows";
        return type;
    },
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
    readPackFile: async (file_path) => {
        let ext = path.extname(file_path);
        if (ext == ".elpack") {
            return await readElPack(file_path);
        } else if (ext == ".mrpack") {
            return await readMrPack(file_path);
        } else if (ext == ".zip") {
            return await readCfZip(file_path);
        }
    },
    getInstanceFiles: async (instance_id) => {
        return await ipcRenderer.invoke('get-instance-files', instance_id);
    },
    getWorldFiles: async (instance_id, world_id) => {
        return await ipcRenderer.invoke('get-world-files', instance_id, world_id);
    },
    setWorldDat: async (instance_id, world_id, datInfo) => {
        return await ipcRenderer.invoke('set-world-dat', instance_id, world_id, datInfo);
    },
    parseMarkdown: (md) => {
        const mkd = new MarkdownIt('default', {
            html: true,
            linkify: true,
            breaks: false
        });

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
        return await ipcRenderer.invoke('get-pinned-worlds');
    },
    getAllServers: async (instance_ids) => {
        return await ipcRenderer.invoke("get-all-servers", instance_ids);
    },
    getRecentlyPlayedWorlds: async (instance_ids) => {
        return await ipcRenderer.invoke('get-recently-played-worlds', instance_ids);
    },
    setOptionsTXT: async (instance_id, content, dont_complete_if_already_exists, dont_add_to_end_if_already_exists, callback) => {
        let result = await ipcRenderer.invoke('set-options-txt', instance_id, content, dont_complete_if_already_exists, dont_add_to_end_if_already_exists);
        if (callback) callback(result);
        return result;
    },
    deleteWorld: async (instance_id, world_id, callback) => {
        let result = await ipcRenderer.invoke('delete-world', instance_id, world_id);
        if (callback) callback(result);
        return result;
    },
    deleteInstanceFiles: async (instance_id) => {
        return await ipcRenderer.invoke('delete-instance-files', instance_id);
    },
    duplicateInstanceFiles: async (old_instance_id, new_instance_id) => {
        return await ipcRenderer.invoke('duplicate-instance-files', old_instance_id, new_instance_id);
    },
    updateOptionsTXT: async (instance_id, key, value) => {
        return await ipcRenderer.invoke('update-options-txt', instance_id, key, value);
    },
    getLangFile: () => {
        return ipcRenderer.sendSync('get-lang');
    },
    playMinecraft: async (instance_id, player_id, quickPlay) => {
        return await ipcRenderer.invoke('play-minecraft', instance_id, player_id, quickPlay);
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
        ipcRenderer.send('set-discord-activity', activity)
    },
    stopInstance: async (instance_id) => {
        return await ipcRenderer.invoke('stop-instance', instance_id);
    },
    getWorld,
    getWorlds,
    getSinglePlayerWorlds,
    deleteServer: async (instance_id, ip, index) => {
        return await ipcRenderer.invoke('delete-server', instance_id, ip, index);
    },
    getMultiplayerWorlds,
    openFolder,
    showFileInFolder,
    triggerMicrosoftLogin: async () => {
        return await ipcRenderer.invoke('trigger-microsoft-login');
    },
    getInstanceLogs: async (instance_id) => {
        return await ipcRenderer.invoke('get-instance-logs', instance_id);
    },
    getLog: async (instance_id, file_name) => {
        return await ipcRenderer.invoke('get-log', instance_id, file_name);
    },
    deleteLogs: async (instance_id, file_name) => {
        return await ipcRenderer.invoke('delete-log', instance_id, file_name);
    },
    deleteAllLogs: async (instance_id) => {
        return await ipcRenderer.invoke('delete-all-logs', instance_id);
    },
    getInstanceContent: async (instance_id) => {
        return await ipcRenderer.invoke('get-instance-content', instance_id);
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
    onInstanceUpdated: (callback) => {
        ipcRenderer.on('instance-updated', (_event, key, value, instance_id) => {
            callback(key, value, instance_id);
        });
    },
    onPage: async (callback) => {
        pageCallback = callback;
        if (startingPage) callback (startingPage);
    },
    onLaunchInstance: async (callback) => {
        launchInstanceCallback = callback;
        if (launchInfo) callback(launchInfo);
    },
    onInstallInstance: async (callback) => {
        installInstanceCallback = callback;
        if (installInfo) callback(installInfo);
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
    getInstanceFolderName: async (instance_id) => {
        return await ipcRenderer.invoke('get-instance-folder-name', instance_id);
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
        ipcRenderer.invoke('watch-file', filepath);

        const handler = (_, path, chunk) => {
            console.log(chunk);
            if (path === filepath) callback(chunk);
        };

        ipcRenderer.on('file-data', handler);
    },
    stopWatching: (filepath) => {
        ipcRenderer.invoke('stop-watching-file', filepath)
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
        return await ipcRenderer.invoke('delete-content', instance_id, project_type, filename);
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
        return await ipcRenderer.invoke('process-pack-file', file_path, instance_id, title);
    },
    processMrPack,
    processCfZip,
    getScreenshots: async (instance_id) => {
        return await ipcRenderer.invoke('get-screenshots', instance_id);
    },
    copyToClipboard: async (text) => {
        clipboard.writeText(text);
        return true;
    },
    copyImageToClipboard: async (file_path) => {
        let image = await ipcRenderer.invoke('copy-image-to-clipboard', file_path);
        if (image) {
            try {
                clipboard.writeImage(image);
                return true;
            } catch (e) {
                return false;
            }
        }
        return false;
    },
    deleteScreenshot: async (instance_id, file_name) => {
        return await ipcRenderer.invoke('delete-screenshot', instance_id, file_name);
    },
    disableFile: async (instance_id, type, file_name) => {
        return await ipcRenderer.invoke('disable-file', instance_id, type, file_name);
    },
    enableFile: async (instance_id, type, file_name) => {
        return await ipcRenderer.invoke('enable-file', instance_id, type, file_name);
    },
    getSkinFromUsername,
    getSkinFromURL,
    pathToDataUrl,
    downloadSkin,
    downloadCape: async (url, id) => {
        return await ipcRenderer.invoke('download-cape', url, id);
    },
    setCape: async (player_info, cape_id) => {
        return await ipcRenderer.invoke('set-cape', player_info, cape_id);
    },
    setSkinFromURL: async (player_info, skin_url, variant) => {
        return await ipcRenderer.invoke('set-skin-from-url', player_info, skin_url, variant);
    },
    setSkin: async (player_info, skin_id, variant) => {
        return await ipcRenderer.invoke('set-skin', player_info, skin_id, variant);
    },
    getProfile: async (player_id) => {
        return await ipcRenderer.invoke('get-profile', player_id);
    },
    importSkin: async (dataurl) => {
        return await ipcRenderer.invoke('import-skin', dataurl);
    },
    getTotalRAM: () => {
        return Math.floor(os.totalmem() / (1024 * 1024));
    },
    testJavaInstallation: async (file_path) => {
        return await ipcRenderer.invoke('test-java-installation', file_path);
    },
    triggerFileImportBrowse: async (file_path, type) => {
        let startDir = file_path;
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
        const result = await ipcRenderer.invoke('show-open-dialog', {
            title: "Select Java Executable",
            defaultPath: startDir,
            properties: ['openFile'],
            filters: os.platform() == "win32" ? [{ name: 'Executables', extensions: ['exe'] }] : []
        });
        if (result.canceled || !result.filePaths || !result.filePaths[0]) {
            return null;
        }
        return result.filePaths[0];
    },
    detectJavaInstallations: async (v) => {
        return await ipcRenderer.invoke('detect-java-installations', v);
    },
    getJavaInstallations: async () => {
        return await ipcRenderer.invoke('get-java-installations');
    },
    getWorldsFromOtherLauncher: async (instance_path) => {
        let the_path = path.resolve(instance_path, "saves");
        return (await getWorlds(the_path)).map(e => ({ "name": e.name, "value": path.resolve(the_path, e.id) }));
    },
    transferWorld: async (old_world_path, instance_id, delete_previous_files) => {
        return await ipcRenderer.invoke('transfer-world', old_world_path, instance_id, delete_previous_files);
    },
    getLauncherInstances: async (instance_path) => {
        return await ipcRenderer.invoke('get-launcher-instances', instance_path);
    },
    getLauncherInstancePath: async (launcher) => {
        return await ipcRenderer.invoke('get-launcher-instance-path', launcher);
    },
    getInstanceOptions: async (instance_id) => {
        const optionsPath = path.resolve(userPath, `minecraft/instances/${instance_id}/options.txt`);
        return await getOptions(optionsPath);
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
        return await ipcRenderer.invoke('create-desktop-shortcut', instance_id, instance_name, iconSource, worldType, worldId);
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
                errorCorrectionLevel: 'L',
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
        return await ipcRenderer.invoke('delete-folders-for-modpack-update', instance_id);
    },
    analyzeLogs: async (instance_id, last_log_date, current_log_path) => {
        return await ipcRenderer.invoke('analyze-logs', instance_id, last_log_date, current_log_path);
    },
    saveToDisk: async (file_path) => {
        let result = await ipcRenderer.invoke('show-save-dialog', {
            title: 'Save file',
            defaultPath: file_path,
            buttonLabel: 'Save',
            filters: [
                { name: 'All Files', extensions: ['*'] }
            ]
        }, file_path);
    },
    checkForUpdates,
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
    generateOptionsTXT: async (values) => {
        return await ipcRenderer.invoke('generate-options-txt', values);
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
    isInstanceFile: async (file_path) => {
        return await ipcRenderer.invoke('is-instance-file', file_path);
    },
    queryServer: async (host, port) => {
        return await ipcRenderer.invoke('query-server', host, port);
    },
    addServer: async (instance_id, ip, name) => {
        return await ipcRenderer.invoke('add-server', instance_id, ip, name);
    },
    getDefaultImage: (code) => {
        let hash = code ? hashString(code) : 0;
        let hue = hash % 360;
        let saturation = 70;
        let lightness = 60;
        let strokeColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        if (code === undefined) {
            strokeColor = `#777`;
        }
        let data = svgData.replaceAll("__ACCENT__", strokeColor);
        return data;
    },
    openWorldFolder: (instance_id, world_id) => {
        openFolder(path.resolve(userPath, "minecraft", "instances", instance_id, "saves", world_id));
    },
    openInstanceFolder: (instance_id) => {
        openFolder(path.resolve(userPath, "minecraft", "instances", instance_id))
    },
    getCapePath: (cape_id) => {
        return path.resolve(userPath, "minecraft", "capes", `${cape_id}.png`);
    },
    showContentInFolder: (instance_id, type, file_name) => {
        let file_path = path.resolve(userPath, "minecraft", "instances", instance_id, type, file_name);
        showFileInFolder(file_path);
    },
    showScreenshotInFolder: (instance_id, file_name) => {
        let file_path = path.resolve(userPath, "minecraft", "instances", instance_id, "screenshots", file_name);
        showFileInFolder(file_path);
    },
    getInstance: async (...params) => ipcRenderer.invoke('get-instance', ...params),
    getInstances: async (...params) => ipcRenderer.invoke('get-instances', ...params),
    updateInstance: async (...params) => ipcRenderer.invoke('update-instance', ...params),
    deleteInstance: async (...params) => ipcRenderer.invoke('delete-instance', ...params),
    addInstance: async (...params) => ipcRenderer.invoke('add-instance', ...params),
    getContent: async (...params) => ipcRenderer.invoke('get-content', ...params),
    getInstanceContentDatabase: async (...params) => ipcRenderer.invoke('get-instance-content-database', ...params),
    updateContent: async (...params) => ipcRenderer.invoke('update-content', ...params),
    addContentDatabase: async (...params) => ipcRenderer.invoke('add-content-database', ...params),
    deleteContentDatabase: async (...params) => ipcRenderer.invoke('delete-content-database', ...params),
    getContentBySourceInfo: async (...params) => ipcRenderer.invoke('get-content-by-source-info', ...params),
    getDefaultProfile: async (...params) => ipcRenderer.invoke('get-default-profile', ...params),
    setDefaultProfile: async (...params) => ipcRenderer.invoke('set-default-profile', ...params),
    getProfiles: async (...params) => ipcRenderer.invoke('get-profiles', ...params),
    getProfileDatabase: async (...params) => ipcRenderer.invoke('get-profile-database', ...params),
    getProfileFromId: async (...params) => ipcRenderer.invoke('get-profile-from-id', ...params),
    addProfile: async (...params) => ipcRenderer.invoke('add-profile', ...params),
    deleteProfile: async (...params) => ipcRenderer.invoke('delete-profile', ...params),
    updateProfile: async (...params) => ipcRenderer.invoke('update-profile', ...params),
    getSkinsNoDefaults: async (...params) => ipcRenderer.invoke('get-skins-no-defaults', ...params),
    getDefaultSkins: async (...params) => ipcRenderer.invoke('get-default-skins', ...params),
    getSkin: async (...params) => ipcRenderer.invoke('get-skin', ...params),
    updateSkin: async (...params) => ipcRenderer.invoke('update-skin', ...params),
    addSkin: async (...params) => ipcRenderer.invoke('add-skin', ...params),
    deleteSkin: async (...params) => ipcRenderer.invoke('delete-skin', ...params),
    getActiveSkin: async (...params) => ipcRenderer.invoke('get-active-skin', ...params),
    setActiveSkin: async (...params) => ipcRenderer.invoke('set-active-skin', ...params),
    getDefault: async (...params) => ipcRenderer.invoke('get-default', ...params),
    setDefault: async (...params) => ipcRenderer.invoke('set-default', ...params),
    getCape: async (...params) => ipcRenderer.invoke('get-cape', ...params),
    getCapes: async (...params) => ipcRenderer.invoke('get-capes', ...params),
    getActiveCape: async (...params) => ipcRenderer.invoke('get-active-cape', ...params),
    addCape: async (...params) => ipcRenderer.invoke('add-cape', ...params),
    setCapeActive: async (...params) => ipcRenderer.invoke('set-cape-active', ...params),
    removeCapeActive: async (...params) => ipcRenderer.invoke('remove-cape-active', ...params),
    getDefaultOptionsVersions: async (...params) => ipcRenderer.invoke('get-default-options-versions', ...params),
    getDefaultOptionsTXT: async (...params) => ipcRenderer.invoke('get-default-options-txt', ...params),
    getDefaultOptions: async (...params) => ipcRenderer.invoke('get-default-options', ...params),
    deleteDefaultOptions: async (...params) => ipcRenderer.invoke('delete-default-options', ...params),
    getDefaultOption: async (...params) => ipcRenderer.invoke('get-default-option', ...params),
    setDefaultOption: async (...params) => ipcRenderer.invoke('set-default-option', ...params),
    deleteDefaultOption: async (...params) => ipcRenderer.invoke('delete-default-option', ...params),
    getMCVersions: async (...params) => ipcRenderer.invoke('get-mc-versions', ...params),
    fetchUpdatedMCVersions: async (...params) => ipcRenderer.invoke('fetch-updated-mc-versions', ...params),
    getServerLastPlayed,
    setServerLastPlayed: async (...params) => ipcRenderer.invoke('set-server-last-played', ...params),
    isWorldPinned: async (...params) => ipcRenderer.invoke('is-world-pinned', ...params),
    isInstancePinned: async (...params) => ipcRenderer.invoke('is-instance-pinned', ...params),
    pinInstance: async (...params) => ipcRenderer.invoke('pin-instance', ...params),
    unpinInstance: async (...params) => ipcRenderer.invoke('unpin-instance', ...params),
    pinWorld: async (...params) => ipcRenderer.invoke('pin-world', ...params),
    unpinWorld: async (...params) => ipcRenderer.invoke('unpin-world', ...params),
    getPinnedInstances: async (...params) => ipcRenderer.invoke('get-pinned-instances', ...params)
});

async function getServerLastPlayed(instance_id, ip) {
    return await ipcRenderer.invoke('get-server-last-played', instance_id, ip);
}

function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

async function getWorld(instance_id, world_id) {
    return await ipcRenderer.invoke('get-world', instance_id, world_id);
}

async function getWorlds(patha) {
    return await ipcRenderer.invoke('get-worlds', patha);
}

async function getSinglePlayerWorlds(instance_id) {
    let patha = path.resolve(userPath, `minecraft/instances/${instance_id}/saves`);
    return await getWorlds(patha);
}

async function importWorld(file_path, instance_id, worldName) {
    return await ipcRenderer.invoke('import-world', file_path, instance_id, worldName);
}
async function importContent(file_path, content_type, instance_id) {
    return await ipcRenderer.invoke('import-content', file_path, content_type, instance_id);
}

async function processCfZipWithoutID(instance_id, zip_path, cf_id, title = ".zip file") {
    zip_path = path.resolve(userPath, "minecraft", "instances", instance_id, zip_path);
    return await ipcRenderer.invoke('process-cf-zip-without-id', instance_id, zip_path, cf_id, title);
}
async function processMrPack(instance_id, mrpack_path, loader, title = ".mrpack file") {
    mrpack_path = path.resolve(userPath, "minecraft", "instances", instance_id, mrpack_path);
    return await ipcRenderer.invoke('process-mr-pack', instance_id, mrpack_path, loader, title);
}
async function processElPack(instance_id, elpack_path, loader, title = ".elpack file") {
    elpack_path = path.resolve(userPath, "minecraft", "instances", instance_id, elpack_path);
    return await ipcRenderer.invoke('process-el-pack', instance_id, elpack_path, loader, title);
}
async function processCfZip(instance_id, zip_path, cf_id, title = ".zip file") {
    zip_path = path.resolve(userPath, "minecraft", "instances", instance_id, zip_path);
    return await ipcRenderer.invoke('process-cf-zip', instance_id, zip_path, cf_id, title);
}

async function getSkinFromURL(url) {
    let hash = await downloadSkin(url);
    return { "hash": hash.hash, "url": hash.dataUrl };
}

async function getSkinFromUsername(username) {
    try {
        const profileRes = await fetch(`https://api.mojang.com/users/profiles/minecraft/${username}`);
        if (!profileRes.ok) throw new Error(`Username "${username}" not found`);
        const profile = await profileRes.json();
        const uuid = profile.id;

        const sessionRes = await fetch(`https://sessionserver.mojang.com/session/minecraft/profile/${uuid}`);
        if (!sessionRes.ok) throw new Error(`Failed to fetch profile for UUID ${uuid}`);
        const sessionData = await sessionRes.json();

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
    return await ipcRenderer.invoke('download-skin', url);
}

async function pathToDataUrl(file_path) {
    return await ipcRenderer.invoke('path-to-data-url', file_path);
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
    ipcRenderer.send('show-file-in-folder', filePath);
}

function openFolder(folderPath) {
    ipcRenderer.send('open-folder', folderPath);
}

async function checkForUpdates() {
    try {
        let platformString = "linux-x64";
        if (os.platform() == 'darwin') platformString = "macos-universal";
        if (os.platform() == 'win32') platformString = "windows-x64";
        let platform = "unix";
        if (os.platform() == 'win32') platform = "windows";
        let nameStart = `EnderLynx-${platformString}`
        let latest = await fetch("https://api.github.com/repos/Illusioner2520/EnderLynx/releases/latest");
        let latest_json = await latest.json();
        let recent_release_version = latest_json.tag_name.replace("v", "");
        if (compareVersions(recent_release_version, version) == 1) {
            let download_url = "";
            let file_size = 0;
            let checksum = "";
            for (let i = 0; i < latest_json.assets.length; i++) {
                let asset = latest_json.assets[i];
                if (asset.name.startsWith(nameStart) && (asset.content_type == "application/zip" || asset.content_type == "application/x-zip-compressed")) {
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
                "changelog": latest_json.body,
                "os": platform,
                "browser_url": latest_json.html_url
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

async function getOptions(optionsPath) {
    return ipcRenderer.invoke('get-options', optionsPath);
}