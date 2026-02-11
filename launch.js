const fs = require('fs');
const https = require('https');
const http = require('http');
const urlModule = require('url');
const path = require('path');
const AdmZip = require('adm-zip');
const os = require('os');
const { spawn, exec } = require('child_process');
const { pathToFileURL } = require('url');
const { version } = require('./package.json');
const pLimit = require('p-limit').default;
const { ipcMain } = require('electron');
const stringArgv = require('string-argv').default;

let launchername = "EnderLynx";
let launcherversion = version;
let userPath;
let win;

function setUserPath(user_path) {
    userPath = user_path;
}
function setWindow(window) {
    win = window;
}

let cancelLaunchFunctions = {};
let retryLaunchFunctions = {};

function generateNewCancelId() {
    let id = 0;
    do {
        id = Math.floor(Math.random() * 1000000)
    } while (cancelLaunchFunctions[id]);
    return id;
}

function generateNewProcessId() {
    return Math.floor(Math.random() * 10000000000);
}

ipcMain.handle('launch-cancel', (_, cancelId) => {
    try {
        cancelLaunchFunctions[cancelId].abort("Canceled by User");
        delete cancelLaunchFunctions[cancelId];
    } catch (e) { }
});

ipcMain.handle('launch-retry', (_, retryId) => {
    retryLaunchFunctions[retryId]();
    delete retryLaunchFunctions[retryId];
    delete cancelLaunchFunctions[retryId];
});

class Minecraft {
    constructor(instance_id, instance_name, db) {
        this.instance_id = instance_id;
        this.instance_name = instance_name;
        const platform = os.platform();
        const getPlatformString = () => {
            if (platform === 'win32') return 'windows';
            if (platform === 'darwin') return 'osx';
            return 'linux';
        };
        const arch = os.arch();
        this.arch = arch;
        this.platform = platform;
        this.platformString = getPlatformString();
        this.classPathDelimiter = ";";
        if (this.platformString == "linux" || this.platformString == "osx") this.classPathDelimiter = ":";
        this.db = db;
    }
    async installFabric(mcversion, fabricversion, isRepair) {
        let processId = generateNewProcessId();
        let cancelId = generateNewCancelId();
        let abortController = new AbortController();
        cancelLaunchFunctions[cancelId] = abortController;
        retryLaunchFunctions[cancelId] = () => { }
        let signal = abortController.signal;
        try {
            win.webContents.send('progress-update', "Downloading Fabric", 0, "Download fabric info...", processId, "good", cancelId, true);
            const fabric_json = await fetch(`https://meta.fabricmc.net/v2/versions/loader/${mcversion}/${fabricversion}/profile/json`, { signal });
            const data = await fabric_json.json();
            fs.mkdirSync(path.resolve(userPath, `minecraft/meta/fabric/${mcversion}/${fabricversion}`), { recursive: true });
            fs.writeFileSync(path.resolve(userPath, `minecraft/meta/fabric/${mcversion}/${fabricversion}/fabric-${mcversion}-${fabricversion}.json`), JSON.stringify(data));
            signal.throwIfAborted();
            win.webContents.send('progress-update', "Downloading Fabric", 20, "Downloading fabric libraries...", processId, "good", cancelId, true);
            for (let i = 0; i < data.libraries.length; i++) {
                signal.throwIfAborted();
                win.webContents.send('progress-update', "Downloading Fabric", ((i + 1) / data.libraries.length) * 80 + 20, `Downloading library ${i + 1} of ${data.libraries.length}...`, processId, "good", cancelId, true);
                let lib_path = mavenPathToFilePath(data.libraries[i].name);
                let lib_path_rel = mavenPathToRelPath(data.libraries[i].name);
                if (!fs.existsSync(lib_path) || isRepair) {
                    await urlToFile(`https://maven.fabricmc.net/${lib_path_rel}`, lib_path, { signal });
                }
                this.libs += lib_path + this.classPathDelimiter;
                let libName = data.libraries[i].name.split(":");
                libName.splice(libName.length - 1, 1);
                this.libNames.push(libName.join(":"));
            }
            this.main_class = data.mainClass;
            this.modded_args_game = data.arguments.game;
            this.modded_args_jvm = data.arguments.jvm;
            signal.throwIfAborted();
            win.webContents.send('progress-update', "Downloading Fabric", 100, "Done", processId, "done", cancelId, true);
        } catch (err) {
            win.webContents.send('progress-update', "Downloading Fabric", 100, err, processId, "error", cancelId, true);
            throw err;
        }
    }
    async installQuilt(mcversion, quiltversion, isRepair) {
        let processId = generateNewProcessId();
        let cancelId = generateNewCancelId();
        let abortController = new AbortController();
        cancelLaunchFunctions[cancelId] = abortController;
        retryLaunchFunctions[cancelId] = () => { }
        let signal = abortController.signal;
        try {
            win.webContents.send('progress-update', "Downloading Quilt", 0, "Download quilt info...", processId, "good", cancelId, true);
            const quilt_json = await fetch(`https://meta.quiltmc.org/v3/versions/loader/${mcversion}/${quiltversion}/profile/json`, { signal });
            const data = await quilt_json.json();
            fs.mkdirSync(path.resolve(userPath, `minecraft/meta/quilt/${mcversion}/${quiltversion}`), { recursive: true });
            fs.writeFileSync(path.resolve(userPath, `minecraft/meta/quilt/${mcversion}/${quiltversion}/quilt-${mcversion}-${quiltversion}.json`), JSON.stringify(data));
            signal.throwIfAborted();
            win.webContents.send('progress-update', "Downloading Quilt", 20, "Downloading quilt libraries...", processId, "good", cancelId, true);
            for (let i = 0; i < data.libraries.length; i++) {
                signal.throwIfAborted();
                win.webContents.send('progress-update', "Downloading Quilt", ((i + 1) / data.libraries.length) * 80 + 20, `Downloading library ${i + 1} of ${data.libraries.length}...`, processId, "good", cancelId, true);
                let lib_path = mavenPathToFilePath(data.libraries[i].name);
                if (!fs.existsSync(lib_path) || isRepair) {
                    await urlToFile(data.libraries[i].url + mavenPathToRelPath(data.libraries[i].name), lib_path, { signal });
                }
                this.libs += lib_path + this.classPathDelimiter;
                let libName = data.libraries[i].name.split(":");
                libName.splice(libName.length - 1, 1);
                this.libNames.push(libName.join(":"));
            }
            this.main_class = data.mainClass;
            if (data?.arguments?.jvm) this.modded_args_game = data.arguments.game;
            if (data?.arguments?.jvm) this.modded_args_jvm = data.arguments.jvm;
            signal.throwIfAborted();
            win.webContents.send('progress-update', "Downloading Quilt", 100, "Done", processId, "done", cancelId, true);
        } catch (err) {
            win.webContents.send('progress-update', "Downloading Quilt", 100, err, processId, "error", cancelId, true);
            throw err;
        }
    }
    async installForge(mcversion, forgeversion, isRepair) {
        let processId = generateNewProcessId();
        let cancelId = generateNewCancelId();
        let abortController = new AbortController();
        cancelLaunchFunctions[cancelId] = abortController;
        retryLaunchFunctions[cancelId] = () => { }
        let signal = abortController.signal;
        try {
            win.webContents.send('progress-update', "Downloading Forge", 0, "Downloading Forge installer...", processId, "good", cancelId, true);
            const forgeInstallerUrl = `https://maven.minecraftforge.net/net/minecraftforge/forge/${mcversion}-${forgeversion}/forge-${mcversion}-${forgeversion}-installer.jar`;
            const forgeMetaDir = path.resolve(userPath, `minecraft/meta/forge/${mcversion}/${forgeversion}`);
            const forgeLibDir = path.resolve(userPath, `minecraft/meta/libraries`);
            fs.mkdirSync(forgeMetaDir, { recursive: true });
            fs.mkdirSync(forgeLibDir, { recursive: true });
            signal.throwIfAborted();

            const installerPath = `${forgeMetaDir}/forge-installer.jar`;
            await urlToFile(forgeInstallerUrl, installerPath, {
                signal, onProgress: (v) => {
                    win.webContents.send('progress-update', "Downloading Forge", v / 5, "Downloading Forge installer...", processId, "good", cancelId, true);
                }
            });
            signal.throwIfAborted();

            let zip = new AdmZip(installerPath);
            let version_json_entry = zip.getEntry("version.json");
            let install_profile_entry = zip.getEntry("install_profile.json");
            let version_json, install_profile_json;
            if (version_json_entry) {
                version_json = JSON.parse(version_json_entry.getData().toString('utf8'));
            } else {
                version_json = {};
            }
            if (install_profile_entry) {
                install_profile_json = JSON.parse(install_profile_entry.getData().toString('utf8'));
            } else {
                install_profile_json = {};
            }
            signal.throwIfAborted();
            fs.writeFileSync(path.resolve(userPath, `minecraft/meta/forge/${mcversion}/${forgeversion}/forge-${mcversion}-${forgeversion}.json`), JSON.stringify(version_json));
            fs.writeFileSync(path.resolve(userPath, `minecraft/meta/forge/${mcversion}/${forgeversion}/forge-${mcversion}-${forgeversion}-install-profile.json`), JSON.stringify(install_profile_json));

            this.modded_args_game = version_json?.arguments?.game ? version_json.arguments.game : [];
            this.modded_args_jvm = version_json?.arguments?.jvm ? version_json.arguments.jvm.map(e => {
                e = e.replaceAll("${library_directory}", path.resolve(userPath, `minecraft/meta/libraries`));
                e = e.replaceAll("${classpath_separator}", this.classPathDelimiter);
                e = e.replaceAll("${version_name}", `${mcversion}-forge-${forgeversion}`);
                return e;
            }) : [];

            signal.throwIfAborted();
            let java = new Java(this.db);
            let installation = await java.getJavaInstallation(21);

            fs.mkdirSync(path.resolve(userPath, `minecraft/instances/${this.instance_id}`), { recursive: true });

            const lowerBound = "7.8.0.684";
            const upperBound = "14.23.5.2851";

            if (compareVersions(forgeversion, lowerBound) >= 0 && compareVersions(forgeversion, upperBound) <= 0) {
                let forge_library_path = install_profile_json.install.filePath;
                let name_items = install_profile_json.install.path.split(":");
                let package_ = name_items[0];
                let name = name_items[1];
                let version = name_items[2].split("@")[0];
                let installation_path = `${package_.replace(".", "/")}/${name}/${version}`;
                installation_path = path.resolve(userPath, "minecraft/meta/libraries", installation_path);
                let installation_path_w_file = path.resolve(installation_path, forge_library_path);
                signal.throwIfAborted();
                if (!fs.existsSync(installation_path_w_file) || isRepair) {
                    zip.extractEntryTo(forge_library_path, installation_path, true, true);
                }

                this.libs += installation_path_w_file + this.classPathDelimiter;

                for (let i = 0; i < install_profile_json.versionInfo.libraries.length; i++) {
                    signal.throwIfAborted();
                    let entry = install_profile_json.versionInfo.libraries[i];
                    // handle natives and native extraction
                    try {
                        // skip based on rules similar to other checks
                        if (entry.natives) {
                            let skip = false;
                            if (entry.rules) {
                                for (let r = 0; r < entry.rules.length; r++) {
                                    let rule = entry.rules[r];
                                    if (rule.action === "allow" && rule?.os?.name && rule.os.name !== this.platformString) {
                                        skip = true;
                                        break;
                                    }
                                    if (rule.action === "disallow" && rule?.os?.name && rule.os.name === this.platformString) {
                                        skip = true;
                                        break;
                                    }
                                    if (rule.action === "allow" && rule?.os?.arch && rule.os.arch !== this.arch) {
                                        skip = true;
                                        break;
                                    }
                                    if (rule.action === "disallow" && rule?.os?.arch && rule.os.arch === this.arch) {
                                        skip = true;
                                        break;
                                    }
                                }
                            }
                            if (skip) {
                                continue;
                            }

                            // determine classifier for current platform and arch
                            let simpleArch = (this.arch === "arm" || this.arch === "ia32" || this.arch === "mips" || this.arch === "ppc") ? "32" : "64";
                            let nativeClassifier = entry.natives[this.platformString];
                            if (!nativeClassifier) {
                                continue;
                            }
                            nativeClassifier = nativeClassifier.replace("${arch}", simpleArch);

                            let mavenWithClassifier = entry.name + ":" + nativeClassifier;
                            let lib_rel = mavenPathToRelPath(mavenWithClassifier);
                            let lib_path = mavenPathToFilePath(mavenWithClassifier);
                            signal.throwIfAborted();

                            if (!fs.existsSync(lib_path) || isRepair) {
                                if (entry.url && !entry.url.includes("https://libraries.minecraft.net/")) {
                                    await urlToFile(entry.url + lib_rel, lib_path, { signal });
                                } else {
                                    await urlToFile(`https://maven.creeperhost.net/${lib_rel}`, lib_path, { signal });
                                }
                            }

                            this.libs += lib_path + this.classPathDelimiter;
                            let libName = entry.name.split(":");
                            libName.splice(libName.length - 1, 1);
                            this.libNames.push(libName.join(":"));

                            const excludes = (entry.extract && Array.isArray(entry.extract.exclude)) ? entry.extract.exclude : [];

                            try {
                                const zip = new AdmZip(lib_path);
                                const zipEntries = zip.getEntries();
                                const nativesOut = path.resolve(userPath, `minecraft/meta/natives/${this.instance_id}-${mcversion}`);
                                for (const ze of zipEntries) {
                                    const entryName = ze.entryName.replace(/\\/g, "/");
                                    if (ze.isDirectory) continue;
                                    let excluded = false;
                                    for (const pattern of excludes) {
                                        if (pattern.endsWith("/")) {
                                            if (entryName.startsWith(pattern)) { excluded = true; break; }
                                        } else {
                                            if (entryName === pattern) { excluded = true; break; }
                                        }
                                    }
                                    if (excluded) continue;
                                    signal.throwIfAborted();

                                    const outPath = path.resolve(nativesOut, entryName);
                                    if (!fs.existsSync(outPath) || isRepair) {
                                        fs.mkdirSync(path.dirname(outPath), { recursive: true });
                                        fs.writeFileSync(outPath, ze.getData());
                                    }
                                }
                            } catch (e) {
                                console.error("Failed extracting native:", e);
                                throw e;
                            }
                            continue;
                        }
                    } catch (e) {
                        console.error("Error processing library native:", e);
                        throw e;
                    }
                    if (entry.name == install_profile_json.install.path) {
                        // hi
                    } else if (entry.url && !entry.url.includes("https://libraries.minecraft.net/")) {
                        let lib_path_rel = mavenPathToRelPath(entry.name);
                        let lib_path = mavenPathToFilePath(entry.name);
                        if (!fs.existsSync(lib_path) || isRepair) {
                            await urlToFile(`${entry.url}${lib_path_rel}`, lib_path, { signal });
                        }
                        this.libs += lib_path + this.classPathDelimiter;
                        let libName = entry.name.split(":");
                        libName.splice(libName.length - 1, 1);
                        this.libNames.push(libName.join(":"));
                    } else if (!entry.url) {
                        let lib_path_rel = mavenPathToRelPath(entry.name);
                        let lib_path = mavenPathToFilePath(entry.name);
                        if (!fs.existsSync(lib_path) || isRepair) {
                            await urlToFile(`https://maven.creeperhost.net/${lib_path_rel}`, lib_path, { signal });
                        }
                        this.libs += lib_path + this.classPathDelimiter;
                        let libName = entry.name.split(":");
                        libName.splice(libName.length - 1, 1);
                        this.libNames.push(libName.join(":"));
                    }
                }
                this.main_class = install_profile_json.versionInfo.mainClass;
                this.legacy_modded_arguments = install_profile_json.versionInfo.minecraftArguments;
                this.modded_jarfile = path.resolve(userPath, `minecraft/meta/versions/${mcversion}/${mcversion}.jar`);
                signal.throwIfAborted();
            } else if (compareVersions(forgeversion, upperBound) > 0) {
                let no_need_to_process = false;
                if (!install_profile_json.libraries || !version_json.libraries) return;
                let processors = install_profile_json.processors;
                let libraries = version_json.libraries.map(e => ({ ...e, include_in_classpath: true })).concat(install_profile_json.libraries.map(e => ({ ...e, include_in_classpath: false })));
                let paths = [];
                for (let i = 0; i < libraries.length; i++) {
                    signal.throwIfAborted();
                    win.webContents.send('progress-update', "Downloading Forge", ((i + 1) / libraries.length) * 40 + 20, `Downloading library ${i + 1} of ${libraries.length}`, processId, "good", cancelId, true);
                    let e = libraries[i];
                    if (e.downloads.artifact) {
                        if (!e.downloads.artifact.url) {
                            if (fs.existsSync(path.resolve(userPath, `minecraft/meta/libraries/${e.downloads.artifact.path}`))) {
                                no_need_to_process = true;
                            }
                            continue;
                        }
                        signal.throwIfAborted();
                        if (!fs.existsSync(path.resolve(userPath, `minecraft/meta/libraries/${e.downloads.artifact.path}`)) || isRepair) {
                            await urlToFile(e.downloads.artifact.url, path.resolve(userPath, `minecraft/meta/libraries/${e.downloads.artifact.path}`), { signal });
                        }
                        let libName = e.name.split(":");
                        libName.splice(libName.length - 1, 1);
                        libName = libName.join(":");
                        if (!this.libNames?.includes(libName) && e.include_in_classpath) {
                            paths += path.resolve(userPath, `minecraft/meta/libraries/${e.downloads.artifact.path}`) + this.classPathDelimiter;
                        }
                        this.libNames.push(libName);
                    }
                }
                if (!no_need_to_process || isRepair) {
                    let new_data = {};
                    for (let i = 0; i < Object.keys(install_profile_json.data).length; i++) {
                        let key = Object.keys(install_profile_json.data)[i];
                        let entry = Object.entries(install_profile_json.data)[i][1];
                        signal.throwIfAborted();
                        async function extract_data(file_path) {
                            let extract_file = zip.getEntry(file_path.slice(1));
                            let parsed_path = path.parse(file_path);
                            let file_name = parsed_path.name;
                            let ext = parsed_path.ext;
                            let out_path = path.resolve(userPath, `minecraft/meta/libraries/me/illusioner/enderlynx/forge-installer-extracts/${mcversion}-${forgeversion}/forge-installer-extracts-${mcversion}-${forgeversion}-${file_name}.${ext}`);
                            if (!extract_file) {
                                throw new Error(`Missing entry in installer zip: ${file_path}`);
                            }
                            if (!fs.existsSync(out_path) || isRepair) {
                                fs.mkdirSync(path.dirname(out_path), { recursive: true });
                                const buf = extract_file.getData();
                                fs.writeFileSync(out_path, buf);
                            }
                            let maven_path = `me.illusioner.enderlynx:forge-installer-extracts:${mcversion}-${forgeversion}:${file_name}@${ext}`;
                            return `[${maven_path}]`;
                        }
                        signal.throwIfAborted();
                        let client = entry.client.startsWith("/") ? await extract_data(entry.client) : entry.client;
                        let server = entry.server.startsWith("/") ? await extract_data(entry.server) : entry.server;
                        new_data[key] = {
                            client,
                            server
                        }
                    }
                    new_data.SIDE = {
                        client: "client"
                    };
                    new_data.MINECRAFT_JAR = {
                        client: path.resolve(userPath, `minecraft/meta/versions/${mcversion}/${mcversion}.jar`)
                    }
                    new_data.ROOT = {
                        client: path.resolve(userPath, `minecraft/instances/${this.instance_id}`)
                    }
                    new_data.MINECRAFT_VERSION = {
                        client: mcversion
                    }
                    new_data.LIBRARY_DIR = {
                        client: forgeLibDir
                    }

                    for (let i = 0; i < processors.length; i++) {
                        signal.throwIfAborted();
                        win.webContents.send('progress-update', "Downloading Forge", ((i + 1) / processors.length) * 35 + 60, `Running processor ${i + 1} of ${processors.length}`, processId, "good", cancelId, true);
                        let processor = processors[i];
                        if (processor.sides && !processor.sides.includes("client")) continue;
                        let cp = [...processor.classpath, processor.jar];
                        let cp_w_libs = "";
                        cp.forEach(c => {
                            let lib_path = mavenPathToFilePath(c);
                            cp_w_libs += lib_path + this.classPathDelimiter;
                        });
                        let main_class = getMainClass(mavenPathToFilePath(processor.jar));
                        let args = ["-cp", cp_w_libs, main_class].concat(processor.args.map(e => {
                            while (e.includes("{")) {
                                let startIndex = e.indexOf("{");
                                let endIndex = e.indexOf("}");
                                let data = new_data[e.slice(startIndex + 1, endIndex)].client;
                                e = e.substring(0, startIndex) + data + e.substring(endIndex + 1);
                            }
                            return e;
                        }).map(e => {
                            if (e.startsWith("[")) {
                                return mavenPathToFilePath(e.slice(1, e.length - 1));
                            } else {
                                return e;
                            }
                        }));
                        signal.throwIfAborted();
                        await new Promise((resolve, reject) => {
                            const processor = spawn(installation, args, {
                                "cwd": path.resolve(userPath, `minecraft/instances/${this.instance_id}`)
                            });

                            processor.stdout.on('data', data => {
                                console.log(`${data}`);
                            });
                            processor.stderr.on('data', data => console.error(`Processor Error: ${data}`));

                            processor.on('close', code => {
                                if (code === 0) resolve();
                                else reject(new Error(`Processor exited with code ${code}`));
                            });
                        });
                    }
                }

                let libs = version_json.libraries;
                let lib_paths = libs.map(e => path.resolve(userPath, `minecraft/meta/libraries`, e.downloads.artifact.path));
                this.libs = [...(new Set(this.libs))];
                this.libs = lib_paths.join(this.classPathDelimiter) + this.classPathDelimiter;
                this.libNames = libs.map(e => {
                    let libName = e.name.split(":");
                    libName.splice(libName.length - 1, 1);
                    return libName.join(":");
                });
                this.main_class = version_json.mainClass;
                this.modded_jarfile = path.resolve(userPath, `minecraft/meta/versions/${mcversion}-forge-${forgeversion}/${mcversion}-forge-${forgeversion}.jar`);
                if (version_json.minecraftArguments) {
                    this.modded_jarfile = path.resolve(userPath, `minecraft/meta/versions/${mcversion}/${mcversion}.jar`);
                    this.legacy_modded_arguments = version_json.minecraftArguments;
                }
                signal.throwIfAborted();
            }
            signal.throwIfAborted();

            win.webContents.send('progress-update', "Downloading Forge", 100, "Forge install complete.", processId, "done", cancelId, true);
        } catch (err) {
            win.webContents.send('progress-update', "Downloading Forge", 100, err, processId, "error", cancelId, true);
            throw err;
        }
    }
    async installNeoForge(mcversion, neoforgeversion, isRepair) {
        let processId = generateNewProcessId();
        let cancelId = generateNewCancelId();
        let abortController = new AbortController();
        cancelLaunchFunctions[cancelId] = abortController;
        retryLaunchFunctions[cancelId] = () => { }
        let signal = abortController.signal;
        try {
            win.webContents.send('progress-update', "Downloading NeoForge", 0, "Downloading NeoForge installer...", processId, "good", cancelId, true);
            const neoForgeInstallerUrl = `https://maven.neoforged.net/releases/net/neoforged/neoforge/${neoforgeversion}/neoforge-${neoforgeversion}-installer.jar`;
            const neoForgeMetaDir = path.resolve(userPath, `minecraft/meta/neoforge/${mcversion}/${neoforgeversion}`);
            const neoForgeLibDir = path.resolve(userPath, `minecraft/meta/libraries`);
            fs.mkdirSync(neoForgeMetaDir, { recursive: true });
            fs.mkdirSync(neoForgeLibDir, { recursive: true });
            signal.throwIfAborted();

            const installerPath = `${neoForgeMetaDir}/neoforge-installer.jar`;
            await urlToFile(neoForgeInstallerUrl, installerPath, {
                signal, onProgress: (v) => {
                    win.webContents.send('progress-update', "Downloading NeoForge", v / 5, "Downloading NeoForge installer...", processId, "good", cancelId, true);
                }
            });
            signal.throwIfAborted();

            let zip = new AdmZip(installerPath);
            let version_json_entry = zip.getEntry("version.json");
            let install_profile_entry = zip.getEntry("install_profile.json");
            let version_json, install_profile_json;
            if (version_json_entry) {
                version_json = JSON.parse(version_json_entry.getData().toString('utf8'));
            } else {
                version_json = {};
            }
            if (install_profile_entry) {
                install_profile_json = JSON.parse(install_profile_entry.getData().toString('utf8'));
            } else {
                install_profile_json = {};
            }
            signal.throwIfAborted();

            fs.writeFileSync(path.resolve(userPath, `minecraft/meta/neoforge/${mcversion}/${neoforgeversion}/neoforge-${mcversion}-${neoforgeversion}.json`), JSON.stringify(version_json));
            fs.writeFileSync(path.resolve(userPath, `minecraft/meta/neoforge/${mcversion}/${neoforgeversion}/neoforge-${mcversion}-${neoforgeversion}-install-profile.json`), JSON.stringify(install_profile_json));

            signal.throwIfAborted();
            this.modded_args_game = version_json?.arguments?.game ? version_json.arguments.game : [];
            this.modded_args_jvm = version_json?.arguments?.jvm ? version_json.arguments.jvm.map(e => {
                e = e.replaceAll("${library_directory}", path.resolve(userPath, `minecraft/meta/libraries`));
                e = e.replaceAll("${classpath_separator}", this.classPathDelimiter);
                e = e.replaceAll("${version_name}", `${mcversion}-neoforge-${neoforgeversion}`);
                return e;
            }) : [];
            signal.throwIfAborted();

            let java = new Java(this.db);
            let installation = await java.getJavaInstallation(21);
            signal.throwIfAborted();

            fs.mkdirSync(path.resolve(userPath, `minecraft/instances/${this.instance_id}`), { recursive: true });

            let no_need_to_process = false;

            if (!install_profile_json.libraries || !version_json.libraries) return;
            let processors = install_profile_json.processors;
            let libraries = version_json.libraries.map(e => ({ ...e, include_in_classpath: true })).concat(install_profile_json.libraries.map(e => ({ ...e, include_in_classpath: false })));
            let paths = [];
            for (let i = 0; i < libraries.length; i++) {
                signal.throwIfAborted();
                win.webContents.send('progress-update', "Downloading NeoForge", ((i + 1) / libraries.length) * 40 + 20, `Downloading library ${i + 1} of ${libraries.length}`, processId, "good", cancelId, true);
                let e = libraries[i];
                if (e.downloads.artifact) {
                    if (!e.downloads.artifact.url) {
                        if (fs.existsSync(path.resolve(userPath, `minecraft/meta/libraries/${e.downloads.artifact.path}`))) {
                            no_need_to_process = true;
                        }
                        continue;
                    }
                    if (!fs.existsSync(path.resolve(userPath, `minecraft/meta/libraries/${e.downloads.artifact.path}`)) || isRepair) {
                        await urlToFile(e.downloads.artifact.url, path.resolve(userPath, `minecraft/meta/libraries/${e.downloads.artifact.path}`), { signal });
                    }
                    let libName = e.name.split(":");
                    libName.splice(libName.length - 1, 1);
                    libName = libName.join(":");
                    if (!this.libNames?.includes(libName) && e.include_in_classpath) {
                        paths += path.resolve(userPath, `minecraft/meta/libraries/${e.downloads.artifact.path}`) + this.classPathDelimiter;
                    }
                    this.libNames.push(libName);
                }
            }
            if (!no_need_to_process || isRepair) {
                signal.throwIfAborted();
                let new_data = {};
                for (let i = 0; i < Object.keys(install_profile_json.data).length; i++) {
                    let key = Object.keys(install_profile_json.data)[i];
                    let entry = Object.entries(install_profile_json.data)[i][1];
                    async function extract_data(file_path) {
                        let extract_file = zip.getEntry(file_path.slice(1));
                        let parsed_path = path.parse(file_path);
                        let file_name = parsed_path.name;
                        let ext = parsed_path.ext;
                        let out_path = path.resolve(userPath, `minecraft/meta/libraries/me/illusioner/enderlynx/neoforge-installer-extracts/${mcversion}-${neoforgeversion}/neoforge-installer-extracts-${mcversion}-${neoforgeversion}-${file_name}.${ext}`);
                        if (!extract_file) {
                            throw new Error(`Missing entry in installer zip: ${file_path}`);
                        }
                        if (!fs.existsSync(out_path) || isRepair) {
                            fs.mkdirSync(path.dirname(out_path), { recursive: true });
                            const buf = extract_file.getData();
                            fs.writeFileSync(out_path, buf);
                        }
                        let maven_path = `me.illusioner.enderlynx:neoforge-installer-extracts:${mcversion}-${neoforgeversion}:${file_name}@${ext}`;
                        return `[${maven_path}]`;
                    }
                    let client = entry.client.startsWith("/") ? await extract_data(entry.client) : entry.client;
                    let server = entry.server.startsWith("/") ? await extract_data(entry.server) : entry.server;
                    new_data[key] = {
                        client,
                        server
                    }
                }
                new_data.SIDE = {
                    client: "client"
                };
                new_data.MINECRAFT_JAR = {
                    client: path.resolve(userPath, `minecraft/meta/versions/${mcversion}/${mcversion}.jar`)
                }
                new_data.ROOT = {
                    client: path.resolve(userPath, `minecraft/instances/${this.instance_id}`)
                }
                new_data.MINECRAFT_VERSION = {
                    client: mcversion
                }
                new_data.LIBRARY_DIR = {
                    client: neoForgeLibDir
                }

                for (let i = 0; i < processors.length; i++) {
                    signal.throwIfAborted();
                    win.webContents.send('progress-update', "Downloading NeoForge", ((i + 1) / processors.length) * 35 + 60, `Running processor ${i + 1} of ${processors.length}`, processId, "good", cancelId, true);
                    let processor = processors[i];
                    if (processor.sides && !processor.sides.includes("client")) continue;
                    let cp = [...processor.classpath, processor.jar];
                    let cp_w_libs = "";
                    cp.forEach(c => {
                        let lib_path = mavenPathToFilePath(c);
                        cp_w_libs += lib_path + this.classPathDelimiter;
                    });
                    let main_class = getMainClass(mavenPathToFilePath(processor.jar));
                    let args = ["-cp", cp_w_libs, main_class].concat(processor.args.map(e => {
                        while (e.includes("{")) {
                            let startIndex = e.indexOf("{");
                            let endIndex = e.indexOf("}");
                            let data = new_data[e.slice(startIndex + 1, endIndex)].client;
                            e = e.substring(0, startIndex) + data + e.substring(endIndex + 1);
                        }
                        return e;
                    }).map(e => {
                        if (e.startsWith("[")) {
                            return mavenPathToFilePath(e.slice(1, e.length - 1));
                        } else {
                            return e;
                        }
                    }));
                    signal.throwIfAborted();
                    await new Promise((resolve, reject) => {
                        const processor = spawn(installation, args, {
                            "cwd": path.resolve(userPath, `minecraft/instances/${this.instance_id}`)
                        });

                        processor.stdout.on('data', data => {
                            console.log(`${data}`);
                        });
                        processor.stderr.on('data', data => console.error(`Processor Error: ${data}`));

                        processor.on('close', code => {
                            if (code === 0) resolve();
                            else reject(new Error(`Processor exited with code ${code}`));
                        });
                    });
                }
            }
            let libs = version_json.libraries;
            let lib_paths = libs.map(e => path.resolve(userPath, `minecraft/meta/libraries`, e.downloads.artifact.path));
            this.libs = [...(new Set(this.libs))];
            this.libs = lib_paths.join(this.classPathDelimiter) + this.classPathDelimiter;
            this.libNames = libs.map(e => {
                let libName = e.name.split(":");
                libName.splice(libName.length - 1, 1);
                return libName.join(":");
            });
            this.main_class = version_json.mainClass;
            this.modded_jarfile = path.resolve(userPath, `minecraft/meta/versions/${mcversion}-neoforge-${neoforgeversion}/${mcversion}-neoforge-${neoforgeversion}.jar`);
            signal.throwIfAborted();
            win.webContents.send('progress-update', "Downloading NeoForge", 100, "NeoForge install complete.", processId, "done", cancelId, true);
        } catch (err) {
            win.webContents.send('progress-update', "Downloading NeoForge", 100, err, processId, "error", cancelId, true);
            throw err;
        }
    }
    async launchGame(loader, version, loaderVersion, username, uuid, auth, customResolution, quickPlay, isDemo, allocatedRam, javaPath, javaArgs, envVars, preLaunch, postLaunch, wrapper, postExit, globalPreLaunch, globalPostLaunch, globalWrapper, globalPostExit) {
        if (!javaArgs || !javaArgs.length) javaArgs = ["-XX:+UnlockExperimentalVMOptions", "-XX:+UseG1GC", "-XX:G1NewSizePercent=20", "-XX:G1ReservePercent=20", "-XX:MaxGCPauseMillis=50", "-XX:G1HeapRegionSize=32M"];
        javaArgs = ["-Xms" + allocatedRam + "M", "-Xmx" + allocatedRam + "M", "-Dlog4j.configurationFile=" + pathToFileURL(path.resolve(userPath, "log_config.xml")).href].concat(javaArgs);
        this.libs = "";
        this.libNames = [];
        if (loader == "fabric") {
            if (!fs.existsSync(path.resolve(userPath, `minecraft/meta/fabric/${version}/${loaderVersion}/fabric-${version}-${loaderVersion}.json`))) {
                await this.installFabric(version, loaderVersion);
            } else {
                let fabric_json = fs.readFileSync(path.resolve(userPath, `minecraft/meta/fabric/${version}/${loaderVersion}/fabric-${version}-${loaderVersion}.json`));
                fabric_json = JSON.parse(fabric_json);
                this.main_class = fabric_json.mainClass;
                this.modded_args_game = fabric_json.arguments.game;
                this.modded_args_jvm = fabric_json.arguments.jvm;
                for (let i = 0; i < fabric_json.libraries.length; i++) {
                    this.libs += mavenPathToFilePath(fabric_json.libraries[i].name) + this.classPathDelimiter;
                    let libName = fabric_json.libraries[i].name.split(":");
                    libName.splice(libName.length - 1, 1);
                    this.libNames.push(libName.join(":"));
                }
            }
        } else if (loader == "quilt") {
            if (!fs.existsSync(path.resolve(userPath, `minecraft/meta/quilt/${version}/${loaderVersion}/quilt-${version}-${loaderVersion}.json`))) {
                await this.installQuilt(version, loaderVersion);
            } else {
                let quilt_json = fs.readFileSync(path.resolve(userPath, `minecraft/meta/quilt/${version}/${loaderVersion}/quilt-${version}-${loaderVersion}.json`));
                quilt_json = JSON.parse(quilt_json);
                this.main_class = quilt_json.mainClass;
                if (quilt_json.arguments?.game) this.modded_args_game = quilt_json.arguments.game;
                if (quilt_json.arguments?.jvm) this.modded_args_jvm = quilt_json.arguments.jvm;
                for (let i = 0; i < quilt_json.libraries.length; i++) {
                    this.libs += mavenPathToFilePath(quilt_json.libraries[i].name) + this.classPathDelimiter;
                    let libName = quilt_json.libraries[i].name.split(":");
                    libName.splice(libName.length - 1, 1);
                    this.libNames.push(libName.join(":"));
                }
            }
        } else if (loader == "forge") {
            if (!fs.existsSync(path.resolve(userPath, `minecraft/meta/forge/${version}/${loaderVersion}/forge-${version}-${loaderVersion}.json`))) {
                await this.installForge(version, loaderVersion);
            } else {
                const lowerBound = "7.8.0.684";
                const upperBound = "14.23.5.2851";

                if (compareVersions(loaderVersion, lowerBound) >= 0 && compareVersions(loaderVersion, upperBound) <= 0) {
                    let install_profile_json = JSON.parse(fs.readFileSync(path.resolve(userPath, `minecraft/meta/forge/${version}/${loaderVersion}/forge-${version}-${loaderVersion}-install-profile.json`)));
                    let forge_library_path = install_profile_json.install.filePath;
                    let name_items = install_profile_json.install.path.split(":");
                    let package_ = name_items[0];
                    let name = name_items[1];
                    let version_ = name_items[2].split("@")[0];
                    let installation_path = `${package_.replace(".", "/")}/${name}/${version_}`;
                    installation_path = path.resolve(userPath, "minecraft/meta/libraries", installation_path);
                    let installation_path_w_file = path.resolve(installation_path, forge_library_path);

                    this.libs += installation_path_w_file + this.classPathDelimiter;

                    for (let i = 0; i < install_profile_json.versionInfo.libraries.length; i++) {
                        let entry = install_profile_json.versionInfo.libraries[i];
                        if (entry.name == install_profile_json.install.path) {
                            // hi
                        } else if (entry.url && !entry.url.includes("https://libraries.minecraft.net/")) {
                            this.libs += mavenPathToFilePath(entry.name) + this.classPathDelimiter;
                            let libName = entry.name.split(":");
                            libName.splice(libName.length - 1, 1);
                            this.libNames.push(libName.join(":"));
                        } else if (!entry.url) {
                            this.libs += mavenPathToFilePath(entry.name) + this.classPathDelimiter;
                            let libName = entry.name.split(":");
                            libName.splice(libName.length - 1, 1);
                            this.libNames.push(libName.join(":"));
                        }
                    }
                    this.main_class = install_profile_json.versionInfo.mainClass;
                    this.legacy_modded_arguments = install_profile_json.versionInfo.minecraftArguments;
                    this.modded_jarfile = path.resolve(userPath, `minecraft/meta/versions/${version}/${version}.jar`);
                    this.modded_args_game = [];
                    this.modded_args_jvm = [];
                } else if (compareVersions(loaderVersion, upperBound) > 0) {
                    let forge_version_info = fs.readFileSync(path.resolve(userPath, `minecraft/meta/forge/${version}/${loaderVersion}/forge-${version}-${loaderVersion}.json`))
                    forge_version_info = JSON.parse(forge_version_info);
                    let libraries = forge_version_info.libraries;
                    let lib_paths = libraries.map(e => path.resolve(userPath, `minecraft/meta/libraries`, e.downloads.artifact.path));
                    this.libs = [...(new Set(this.libs))];
                    this.libs = lib_paths.join(this.classPathDelimiter) + this.classPathDelimiter;
                    this.libNames = libraries.map(e => {
                        let libName = e.name.split(":");
                        libName.splice(libName.length - 1, 1);
                        return libName.join(":");
                    });
                    this.main_class = forge_version_info.mainClass;
                    this.modded_jarfile = path.resolve(userPath, `minecraft/meta/versions/${version}-forge-${loaderVersion}/${version}-forge-${loaderVersion}.jar`);
                    this.modded_args_game = forge_version_info?.arguments?.game ? forge_version_info.arguments.game : [];
                    this.modded_args_jvm = forge_version_info?.arguments?.jvm ? forge_version_info.arguments.jvm.map(e => {
                        e = e.replaceAll("${library_directory}", path.resolve(userPath, `minecraft/meta/libraries`));
                        e = e.replaceAll("${classpath_separator}", this.classPathDelimiter);
                        e = e.replaceAll("${version_name}", `${version}-forge-${loaderVersion}`);
                        return e;
                    }) : [];
                    if (forge_version_info.minecraftArguments) {
                        this.modded_jarfile = path.resolve(userPath, `minecraft/meta/versions/${version}/${version}.jar`);
                        this.legacy_modded_arguments = forge_version_info.minecraftArguments;
                    }
                }
            }
        } else if (loader == "neoforge") {
            if (!fs.existsSync(path.resolve(userPath, `minecraft/meta/neoforge/${version}/${loaderVersion}/neoforge-${version}-${loaderVersion}.json`))) {
                await this.installNeoForge(version, loaderVersion);
            } else {
                let neo_forge_version_info = fs.readFileSync(path.resolve(userPath, `minecraft/meta/neoforge/${version}/${loaderVersion}/neoforge-${version}-${loaderVersion}.json`))
                neo_forge_version_info = JSON.parse(neo_forge_version_info);
                let libraries = neo_forge_version_info.libraries;
                let lib_paths = libraries.map(e => path.resolve(userPath, `minecraft/meta/libraries`, e.downloads.artifact.path));
                this.libs = [...(new Set(this.libs))];
                this.libs = lib_paths.join(this.classPathDelimiter) + this.classPathDelimiter;
                this.libNames = libraries.map(e => {
                    let libName = e.name.split(":");
                    libName.splice(libName.length - 1, 1);
                    return libName.join(":");
                });
                this.main_class = neo_forge_version_info.mainClass;
                this.modded_jarfile = path.resolve(userPath, `minecraft/meta/versions/neoforge-${loaderVersion}/neoforge-${loaderVersion}.jar`);
                this.modded_args_game = neo_forge_version_info?.arguments?.game ? neo_forge_version_info.arguments.game : [];
                this.modded_args_jvm = neo_forge_version_info?.arguments?.jvm ? neo_forge_version_info.arguments.jvm.map(e => {
                    e = e.replaceAll("${library_directory}", path.resolve(userPath, `minecraft/meta/libraries`));
                    e = e.replaceAll("${classpath_separator}", this.classPathDelimiter);
                    e = e.replaceAll("${version_name}", `${version}-neoforge-${loaderVersion}`);
                    return e;
                }) : [];
            }
        }
        let version_path = path.resolve(userPath, `minecraft/meta/versions/${version}/${version}.json`);
        if (!fs.existsSync(version_path)) {
            version_path = path.resolve(userPath, `minecraft/instances/${this.instance_id}/versions/${version}/${version}.json`)
        }
        let version_json = fs.readFileSync(version_path);
        version_json = JSON.parse(version_json);
        let paths = "";
        libs: for (let i = 0; i < version_json.libraries.length; i++) {
            if (version_json.libraries[i].rules) {
                rules: for (let j = 0; j < version_json.libraries[i].rules.length; j++) {
                    let rule = version_json.libraries[i].rules[j];
                    if (rule.action == "allow" && rule?.os?.name && rule?.os?.name != this.platformString) {
                        continue libs;
                    }
                    if (rule.action == "disallow" && rule?.os?.name == this.platformString) {
                        continue libs;
                    }
                }
            }
            let e = version_json.libraries[i];
            let libName = e.name.split(":");
            libName.splice(libName.length - 1, 1);
            libName = libName.join(":");
            if (!this.libNames?.includes(libName)) {
                if (e.downloads.artifact) {
                    paths += path.resolve(userPath, `minecraft/meta/libraries/${e.downloads.artifact.path}`) + this.classPathDelimiter;
                }
                if (e.downloads.natives && e.downloads.natives[this.platformString]) {
                    paths += path.resolve(userPath, `minecraft/meta/libraries/${e.downloads.classifiers[e.downloads.natives[this.platformString]].path}`) + this.classPathDelimiter;
                }
            }
        };
        this.libs += paths;
        this.jarfile = path.resolve(userPath, `minecraft/meta/versions/${version}/${version}.jar`);
        if (!fs.existsSync(this.jarfile)) {
            this.jarfile = path.resolve(userPath, `minecraft/instances/${this.instance_id}/versions/${version}/${version}.jar`);
        }
        let java = new Java(this.db);
        this.java_installation = javaPath ? javaPath : await java.getJavaInstallation(version_json?.javaVersion?.majorVersion ? version_json.javaVersion.majorVersion : 8);
        this.java_version = version_json?.javaVersion?.majorVersion ? version_json.javaVersion.majorVersion : 8;
        if (version_json?.arguments?.game) {
            this.args = version_json.arguments;
        } else if (version_json?.minecraftArguments) {
            this.args = stringArgv(version_json.minecraftArguments);
        }
        if (loader == "vanilla") this.main_class = version_json.mainClass;
        this.version_type = version_json.type;
        this.assets_index = version_json.assets;
        this.asset_dir = path.resolve(userPath, "minecraft/meta/assets");
        if (version_json.assets == "legacy") {
            this.asset_dir = path.resolve(userPath, "minecraft/meta/assets/legacy");
        } else if (version_json.assets == "pre-1.6") {
            this.asset_dir = path.resolve(userPath, `minecraft/instances/${this.instance_id}/resources`);
        }
        if (loader == "forge" || loader == "neoforge") {
            this.jarfile = this.modded_jarfile;
        }
        if (loader == "vanilla") {
            this.modded_args_game = [];
            this.modded_args_jvm = [];
        }
        let player_info;
        try {
            const obtainUsername = await fetch(`https://api.minecraftservices.com/minecraft/profile/lookup/${uuid}`);
            player_info = await obtainUsername.json();
        } catch (err) {
            player_info = { "name": username };
        }
        let args = [];
        if (this.args.game) {
            let extraArgs = [];
            let quickPlayHandled = false;
            // ~1.13+
            if (this.modded_args_game) this.args.game = this.args.game.concat(this.modded_args_game);
            this.args.game = this.args.game.map((e) => {
                if (e?.value) {
                    if (isDemo && e.rules[0].features.is_demo_user) {
                        extraArgs.push('--demo');
                        return "";
                    } else if (customResolution?.width && customResolution?.height && e.rules[0].features.has_custom_resolution) {
                        extraArgs = extraArgs.concat(["--width", customResolution.width, "--height", customResolution.height]);
                        return "";
                    } else if (quickPlay?.type == "singleplayer" && quickPlay?.info && e.rules[0].features.is_quick_play_singleplayer) {
                        extraArgs = extraArgs.concat(["--quickPlaySingleplayer", quickPlay.info]);
                        quickPlayHandled = true;
                        return "";
                    } else if (quickPlay?.type == "multiplayer" && quickPlay?.info && e.rules[0].features.is_quick_play_multiplayer) {
                        extraArgs = extraArgs.concat(["--quickPlayMultiplayer", quickPlay.info]);
                        quickPlayHandled = true;
                        return "";
                    } else if (quickPlay?.type == "realms" && quickPlay?.info && e.rules[0].features.is_quick_play_realms) {
                        extraArgs = extraArgs.concat(["--quickPlayRealms", quickPlay.info]);
                        quickPlayHandled = true;
                        return "";
                    }
                } else {
                    return e;
                }
            });
            if (!quickPlayHandled && quickPlay?.type == "multiplayer") {
                let split = quickPlay.info.split(":");
                let server = split[0];
                let port = split[1] ?? "25565";
                extraArgs = extraArgs.concat(["--server", server, "--port", port])
            }
            this.args.game = this.args.game.filter((e) => e);
            this.args.game = this.args.game.map((e) => {
                e = e.replace("${auth_player_name}", player_info.name);
                e = e.replace("${version_name}", version);
                e = e.replace("${game_directory}", path.resolve(userPath, `minecraft/instances/${this.instance_id}`));
                e = e.replace("${assets_root}", this.asset_dir);
                e = e.replace("${game_assets}", this.asset_dir);
                e = e.replace("${assets_index_name}", this.assets_index);
                e = e.replace("${auth_uuid}", uuid);
                e = e.replace("${auth_access_token}", auth.accessToken);
                e = e.replace("${user_type}", "msa");
                e = e.replace("${user_properties}", "{}");
                e = e.replace("${version_type}", this.version_type);
                e = e.replace("${clientid}", auth.clientId);
                e = e.replace("${auth_xuid}", auth.xuid);
                e = e.replace("${auth_session}", auth.accessToken);
                return e;
            });
            if (this.modded_args_jvm_top) args = args.concat(this.modded_args_jvm_top);
            args.push("-Dlog4j2.formatMsgNoLookups=true");
            args: for (let i = 0; i < this.args.jvm.length; i++) {
                let e = this.args.jvm[i];
                if (e.value && e.rules) {
                    rules: for (let j = 0; j < e.rules.length; j++) {
                        let rule = e.rules[j];
                        if (rule.action == "allow" && rule?.os?.name && rule?.os?.name != this.platformString) {
                            continue args;
                        }
                        if (rule.action == "allow" && rule?.os?.arch && rule?.os?.arch != this.arch) {
                            continue args;
                        }
                        if (rule.action == "disallow" && rule?.os?.name == this.platformString) {
                            continue args;
                        }
                        if (rule.action == "disallow" && rule?.os?.arch == this.arch) {
                            continue args;
                        }
                    }
                    let newVal = e.value;
                    if (Array.isArray(newVal)) {
                        newVal = newVal.map((e) => {
                            e = e.replace("${natives_directory}", path.resolve(userPath, `minecraft/meta/natives/${this.instance_id}-${version}`));
                            e = e.replace("${launcher_name}", launchername);
                            e = e.replace("${launcher_version}", launcherversion);
                            return e;
                        })
                        args = args.concat(newVal);
                    } else {
                        newVal = newVal.replace("${natives_directory}", path.resolve(userPath, `minecraft/meta/natives/${this.instance_id}-${version}`));
                        newVal = newVal.replace("${launcher_name}", launchername);
                        newVal = newVal.replace("${launcher_version}", launcherversion);
                        args.push(newVal);
                    }
                } else {
                    e = e.replace("${natives_directory}", path.resolve(userPath, `minecraft/meta/natives/${this.instance_id}-${version}`));
                    e = e.replace("${launcher_name}", launchername);
                    e = e.replace("${launcher_version}", launcherversion);
                    if (e.includes("${classpath}")) {
                        let theargs = [this.libs + this.jarfile];
                        if (this.modded_args_jvm) theargs = theargs.concat(this.modded_args_jvm);
                        theargs = theargs.concat(javaArgs).concat([this.main_class]);
                        args = args.concat(theargs);
                    } else {
                        args.push(e);
                    }
                }
            }
            args = args.concat(this.args.game);
            args = args.concat(extraArgs);
        } else {
            if (this.legacy_modded_arguments) {
                this.args = stringArgv(this.legacy_modded_arguments);
            }
            if (this.platformString == "windows") {
                args.push("-XX:HeapDumpPath=MojangTricksIntelDriversForPerformance_javaw.exe_minecraft.exe.heapdump");
            } else if (this.platformString == "osx") {
                args.push("-XstartOnFirstThread");
            }
            if (this.arch == "x86") {
                args.push("-Xss1M");
            }
            args.push("-Dlog4j2.formatMsgNoLookups=true");
            args.push("-Djava.library.path=" + path.resolve(userPath, `minecraft/meta/natives/${this.instance_id}-${version}`));
            args.push("-Dminecraft.launcher.brand=" + launchername);
            args.push("-Dminecraft.launcher.version=" + launcherversion);
            args.push("-Dminecraft.client.jar=" + this.jarfile);
            args.push("-cp");
            args.push(this.libs + this.jarfile);
            args = args.concat(javaArgs);
            args.push(this.main_class);
            this.args = this.args.map((e) => {
                e = e.replace("${auth_player_name}", player_info.name);
                e = e.replace("${version_name}", version);
                e = e.replace("${game_directory}", path.resolve(userPath, `minecraft/instances/${this.instance_id}`));
                e = e.replace("${assets_root}", this.asset_dir);
                e = e.replace("${game_assets}", this.asset_dir);
                e = e.replace("${assets_index_name}", this.assets_index);
                e = e.replace("${auth_uuid}", uuid);
                e = e.replace("${auth_access_token}", auth.accessToken);
                e = e.replace("${user_type}", "msa");
                e = e.replace("${user_properties}", "{}");
                e = e.replace("${version_type}", this.version_type);
                e = e.replace("${clientid}", auth.clientId);
                e = e.replace("${auth_xuid}", auth.xuid);
                e = e.replace("${auth_session}", auth.accessToken);
                return e;
            });
            args = args.concat(this.args);
            if (quickPlay?.type == "multiplayer") {
                let split = quickPlay.info.split(":");
                let server = split[0];
                let port = split[1] ?? "25565";
                args = args.concat(["--server", server, "--port", port])
            }
        }
        console.log("Launching game.");
        console.log(this.libNames);
        console.log("Executing: " + this.java_installation + " " + args.join(" "));
        console.log(args);
        let LOG_PATH = path.resolve(userPath, `minecraft/instances/${this.instance_id}/logs/${fileFormatDate(new Date())}.log`);
        fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
        let fd = fs.openSync(LOG_PATH, 'w');
        fs.closeSync(fd);
        let child;
        let launcherEnvVars = {
            MC_INSTANCE_ID: this.instance_id,
            MC_INSTANCE_NAME: this.instance_name,
            MC_LOADER: loader,
            MC_GAME_VERSION: version,
            MC_LOADER_VERSION: loaderVersion,
            MC_USERNAME: username,
            MC_UUID: uuid,
            MC_ALLOCATED_RAM_MB: allocatedRam.toString(),
            MC_ALLOCATED_RAM_GB: (allocatedRam / 1024).toString(),
            MC_LAUNCHER_NAME: launchername,
            MC_LAUNCHER_VERSION: launcherversion,
            MC_GAME_DIR: path.resolve(userPath, "minecraft", "instances", this.instance_id),
            MC_MODS_DIR: path.resolve(userPath, "minecraft", "instances", this.instance_id, "mods"),
            MC_RESOURCE_PACKS_DIR: path.resolve(userPath, "minecraft", "instances", this.instance_id, "resourcepacks"),
            MC_SHADERS_DIR: path.resolve(userPath, "minecraft", "instances", this.instance_id, "shaderpacks"),
            MC_LOGS_DIR: path.resolve(userPath, "minecraft", "instances", this.instance_id, "logs"),
            MC_WORLDS_DIR: path.resolve(userPath, "minecraft", "instances", this.instance_id, "saves"),
            MC_ASSETS_DIR: path.resolve(userPath, "minecraft", "meta", "assets"),
            MC_NATIVES_DIR: path.resolve(userPath, "minecraft", "meta", "natives", this.instance_id + "-" + version),
            MC_LIBRARIES_DIR: path.resolve(userPath, "minecraft", "meta", "libraries"),
            MC_JAVA_PATH: this.java_installation,
            MC_JAVA_VERSION: this.java_version,
            MC_OS: process.platform,
            MC_ARCH: process.arch
        }
        let executeLaunchHook = async (hook, phase, extraEnvVars) => {
            return new Promise((resolve, reject) => {
                const child = exec(hook, {
                    windowsHide: true,
                    env: {
                        ...process.env,
                        ...envVars,
                        ...launcherEnvVars,
                        ...extraEnvVars,
                        MC_HOOK_PHASE: phase
                    }
                });

                child.stdout?.on("data", (data) => {
                    console.log("[Launcher Hook] ", data.toString());
                });

                child.stderr?.on("data", (data) => {
                    console.error("[Launcher Hook] ", data.toString());
                });

                child.on("error", reject);

                child.on("close", (code) => {
                    if (code === 0) resolve();
                    else reject(new Error("Launcher Hook exited with code " + code));
                });
            });
        }
        if (globalPreLaunch) {
            await executeLaunchHook(globalPreLaunch, "prelaunch")
        }
        if (preLaunch) {
            await executeLaunchHook(preLaunch, "prelaunch");
        }
        if ((wrapper && wrapper.length) || (globalWrapper && globalWrapper.length)) {
            if (!wrapper) wrapper = [];
            if (!globalWrapper) globalWrapper = [];
            let fullCommand = globalWrapper.concat(wrapper).concat([this.java_installation]).concat(args);
            child = spawn(fullCommand[0], fullCommand.slice(1), {
                env: {
                    ...process.env,
                    ...envVars,
                    ...launcherEnvVars
                },
                cwd: path.resolve(userPath, `minecraft/instances/${this.instance_id}`),
                detached: true,
                stdio: ['ignore', fs.openSync(LOG_PATH, 'a'), fs.openSync(LOG_PATH, 'a')]
            });
        } else {
            child = spawn(this.java_installation, args, {
                env: {
                    ...process.env,
                    ...envVars,
                    ...launcherEnvVars
                },
                cwd: path.resolve(userPath, `minecraft/instances/${this.instance_id}`),
                detached: true,
                stdio: ['ignore', fs.openSync(LOG_PATH, 'a'), fs.openSync(LOG_PATH, 'a')]
            });
        }

        child.once('error', (err) => {
            if (err.code === 'ENOENT') {
                win.webContents.send('display-error', "Unable to launch Minecraft");
            } else {
                win.webContents.send('display-error', "Unable to launch Minecraft (" + err + ")");
            }
        });

        child.on("exit", (code) => {
            if (globalPostExit) {
                executeLaunchHook(globalPostExit, "postexit", { MC_EXIT_CODE: code });
            }
            if (postExit) {
                executeLaunchHook(postExit, "postexit", { MC_EXIT_CODE: code });
            }
        });

        child.unref();
        if (globalPostLaunch) {
            await executeLaunchHook(globalPostLaunch, "postlaunch", { MC_PID: child.pid, MC_LOG_FILE: LOG_PATH })
        }
        if (postLaunch) {
            await executeLaunchHook(postLaunch, "postlaunch", { MC_PID: child.pid, MC_LOG_FILE: LOG_PATH });
        }
        return { "pid": child.pid, "log": LOG_PATH, "java_path": this.java_installation, "java_version": this.java_version };
    }
    async downloadGame(loader, version, isRepair, whatToRepair) {
        let processId = generateNewProcessId();
        let cancelId = generateNewCancelId();
        let abortController = new AbortController();
        cancelLaunchFunctions[cancelId] = abortController;
        retryLaunchFunctions[cancelId] = () => { }
        let signal = abortController.signal;
        if (!this.libNames) this.libNames = [];
        try {
            win.webContents.send('progress-update', "Downloading Minecraft", 0, "Creating directories...", processId, "good", cancelId, true);
            fs.mkdirSync(path.resolve(userPath, `minecraft/meta/versions/${version}`), { recursive: true });
            fs.mkdirSync(path.resolve(userPath, `minecraft/meta/natives/${this.instance_id}-${version}`), { recursive: true });
            fs.mkdirSync(path.resolve(userPath, `minecraft/instances/${this.instance_id}/logs`), { recursive: true });
            this.version = version;
            signal.throwIfAborted();
            win.webContents.send('progress-update', "Downloading Minecraft", 2, "Downloading version list...", processId, "good", cancelId, true);
            const obtainVersionManifest = await fetch("https://launchermeta.mojang.com/mc/game/version_manifest.json");
            const version_manifest = await obtainVersionManifest.json();
            let version_json = {};
            for (let i = 0; i < version_manifest.versions.length; i++) {
                if (version_manifest.versions[i].id == version) {
                    signal.throwIfAborted();
                    win.webContents.send('progress-update', "Downloading Minecraft", 3, "Downloading version info...", processId, "good", cancelId, true);
                    const obtainVersionJSON = await fetch(version_manifest.versions[i].url);
                    version_json = await obtainVersionJSON.json();
                    break;
                }
            }
            if (!version_json.assets) {
                console.error("Invalid version");
                return;
            }
            let java_args = [];
            if (version_json.arguments && version_json.arguments['default-user-jvm']) {
                let args = version_json.arguments['default-user-jvm'];
                for (let i = 0; i < args.length; i++) {
                    let rules = args[i].rules ?? [];
                    let useTheseArgs = rules.length == 0;
                    r: for (let j = 0; j < rules.length; j++) {
                        if (rules[j].os) {
                            if (rules[j].os.name && rules[j].os.name != this.platformString) continue r;
                            if (rules[j].os.arch && rules[j].os.arch != this.arch) continue r;
                            if (rules[j].os.versionRange) {
                                let currentVersion = os.release();
                                if (rules[j].os.versionRange.max && compareVersions(currentVersion, rules[j].os.versionRange.max) > 0) continue r;
                                if (rules[j].os.versionRange.min && compareVersions(currentVersion, rules[j].os.versionRange.min) < 0) continue r;
                            }
                            useTheseArgs = rules[j].action == "allow";
                        } else {
                            useTheseArgs = true;
                        }
                    }
                    if (!useTheseArgs) continue;
                    java_args = java_args.concat(args[i].value);
                }
            }
            java_args = java_args.filter(e => !e.startsWith("-Xms") && !e.startsWith("-Xmx"));
            java_args = quoteArgs(java_args);
            if (!java_args) java_args = "-XX:+UnlockExperimentalVMOptions -XX:+UseG1GC -XX:G1NewSizePercent=20 -XX:G1ReservePercent=20 -XX:MaxGCPauseMillis=50 -XX:G1HeapRegionSize=32M";
            signal.throwIfAborted();
            if (!isRepair || whatToRepair.includes("minecraft")) {
                fs.writeFileSync(path.resolve(userPath, `minecraft/meta/versions/${version}/${version}.json`), JSON.stringify(version_json));
            }
            if (!isRepair || whatToRepair.includes("assets")) {
                signal.throwIfAborted();
                win.webContents.send('progress-update', "Downloading Minecraft", 5, "Downloading asset info...", processId, "good", cancelId, true);
                const assetJSON = await fetch(version_json.assetIndex.url);
                let asset_json = await assetJSON.json();
                fs.mkdirSync(path.resolve(userPath, `minecraft/meta/assets/indexes`), { recursive: true });
                fs.mkdirSync(path.resolve(userPath, `minecraft/meta/assets/objects`), { recursive: true });
                fs.writeFileSync(path.resolve(userPath, `minecraft/meta/assets/indexes/${version_json.assets}.json`), JSON.stringify(asset_json));
                let assetKeys = Object.keys(asset_json.objects);
                const limit = pLimit(10);
                const downloadPromises = assetKeys.map((asset, i) => limit(async () => {
                    signal.throwIfAborted();
                    win.webContents.send('progress-update', "Downloading Minecraft", ((i + 1) / assetKeys.length) * 30 + 5, `Downloading asset ${i + 1} of ${assetKeys.length}...`, processId, "good", cancelId, true);
                    let asset_data = asset_json.objects[asset];
                    if (version_json.assets == "legacy") {
                        if (!fs.existsSync(path.resolve(userPath, `minecraft/meta/assets/legacy/${asset}`)) || isRepair) {
                            await urlToFile(`https://resources.download.minecraft.net/${asset_data.hash.substring(0, 2)}/${asset_data.hash}`, path.resolve(userPath, `minecraft/meta/assets/legacy/${asset}`), { signal });
                        }
                    } else if (version_json.assets == "pre-1.6") {
                        if (!fs.existsSync(path.resolve(userPath, `minecraft/instances/${this.instance_id}/resources/${asset}`)) || isRepair) {
                            await urlToFile(`https://resources.download.minecraft.net/${asset_data.hash.substring(0, 2)}/${asset_data.hash}`, path.resolve(userPath, `minecraft/instances/${this.instance_id}/resources/${asset}`), { signal });
                        }
                    } else {
                        if (!fs.existsSync(path.resolve(userPath, `minecraft/meta/assets/objects/${asset_data.hash.substring(0, 2)}/${asset_data.hash}`)) || isRepair) {
                            await urlToFile(`https://resources.download.minecraft.net/${asset_data.hash.substring(0, 2)}/${asset_data.hash}`, path.resolve(userPath, `minecraft/meta/assets/objects/${asset_data.hash.substring(0, 2)}/${asset_data.hash}`), { signal });
                        }
                    }
                }));
                await Promise.all(downloadPromises);
                this.asset_dir = version_json.assets == "legacy" ? path.resolve(userPath, "minecraft/meta/assets/legacy") : version_json.assets == "pre-1.6" ? path.resolve(userPath, `minecraft/instances/${this.instance_id}/resources`) : path.resolve(userPath, "minecraft/meta/assets");
            }
            const jarFilePath = path.resolve(userPath, `minecraft/meta/versions/${version}/${version}.jar`);
            if ((!isRepair && !fs.existsSync(jarFilePath)) || whatToRepair?.includes("minecraft")) {
                signal.throwIfAborted();
                win.webContents.send('progress-update', "Downloading Minecraft", 40, "Downloading version jar...", processId, "good", cancelId, true);
                await urlToFile(version_json.downloads.client.url, jarFilePath, {
                    signal, onProgress: (v) => {
                        win.webContents.send('progress-update', "Downloading Minecraft", v * (3 / 20) + 40, "Downloading version jar...", processId, "good", cancelId, true);
                    }
                });
                this.jarfile = jarFilePath;
            }
            let java = new Java(this.db);
            let paths = "";
            if (!isRepair || whatToRepair?.includes("java")) {
                signal.throwIfAborted();
                win.webContents.send('progress-update', "Downloading Minecraft", 55, "Checking for java...", processId, "good", cancelId, true);
                this.java_installation = await java.getJavaInstallation(version_json?.javaVersion?.majorVersion ? version_json.javaVersion.majorVersion : 8, isRepair);
                this.java_version = version_json?.javaVersion?.majorVersion ? version_json.javaVersion.majorVersion : 8;
            }
            if (!isRepair || whatToRepair?.includes("minecraft")) {
                if (version_json?.arguments?.game) {
                    this.args = version_json.arguments;
                } else if (version_json?.minecraftArguments) {
                    this.args = stringArgv(version_json.minecraftArguments);
                }
                if (loader == "vanilla") this.main_class = version_json.mainClass;
                this.version_type = version_json.type;
                this.assets_index = version_json.assets;
                let simpleArch = (this.arch == "arm" || this.arch == "ia32" || this.arch == "mips" || this.arch == "ppc") ? "32" : "64";
                signal.throwIfAborted();
                win.webContents.send('progress-update', "Downloading Minecraft", 60, "Starting library download...", processId, "good", cancelId, true);
                libs: for (let i = 0; i < version_json.libraries.length; i++) {
                    signal.throwIfAborted();
                    win.webContents.send('progress-update', "Downloading Minecraft", ((i + 1) / version_json.libraries.length) * 40 + 60, `Downloading library ${i + 1} of ${version_json.libraries.length}`, processId, "good", cancelId, true);
                    if (version_json.libraries[i].rules) {
                        rules: for (let j = 0; j < version_json.libraries[i].rules.length; j++) {
                            let rule = version_json.libraries[i].rules[j];
                            if (rule.action == "allow" && rule?.os?.name && rule?.os?.name != this.platformString) {
                                continue libs;
                            }
                            if (rule.action == "disallow" && rule?.os?.name == this.platformString) {
                                continue libs;
                            }
                        }
                    }
                    signal.throwIfAborted();
                    if (version_json.libraries[i].downloads.artifact) {
                        if (!fs.existsSync(path.resolve(userPath, `minecraft/meta/libraries/${version_json.libraries[i].downloads.artifact.path}`)) || isRepair) {
                            await urlToFile(version_json.libraries[i].downloads.artifact.url, path.resolve(userPath, `minecraft/meta/libraries/${version_json.libraries[i].downloads.artifact.path}`), { signal });
                        }
                        let libName = version_json.libraries[i].name.split(":");
                        libName.splice(libName.length - 1, 1);
                        libName = libName.join(":");
                        if (!this.libNames?.includes(libName)) {
                            paths += path.resolve(userPath, `minecraft/meta/libraries/${version_json.libraries[i].downloads.artifact.path}`) + this.classPathDelimiter;
                        }
                        this.libNames.push(libName);
                    }
                    signal.throwIfAborted();
                    if (version_json.libraries[i].natives && version_json.libraries[i].natives[this.platformString]) {
                        if (!fs.existsSync(path.resolve(userPath, `minecraft/meta/libraries/${version_json.libraries[i].downloads.classifiers[version_json.libraries[i].natives[this.platformString].replace("${arch}", simpleArch)].path}`)) || isRepair) {
                            await urlToFile(version_json.libraries[i].downloads.classifiers[version_json.libraries[i].natives[this.platformString].replace("${arch}", simpleArch)].url, path.resolve(userPath, `minecraft/meta/libraries/${version_json.libraries[i].downloads.classifiers[version_json.libraries[i].natives[this.platformString].replace("${arch}", simpleArch)].path}`), { signal });
                        }
                        let libName = version_json.libraries[i].name.split(":");
                        libName.splice(libName.length - 1, 1);
                        libName = libName.join(":");
                        if (!this.libNames?.includes(libName)) {
                            paths += path.resolve(userPath, `minecraft/meta/libraries/${version_json.libraries[i].downloads.classifiers[version_json.libraries[i].natives[this.platformString].replace("${arch}", simpleArch)].path}`) + this.classPathDelimiter;
                        }
                        this.libNames.push(libName);
                        await extractJar(path.resolve(userPath, `minecraft/meta/libraries/${version_json.libraries[i].downloads.classifiers[version_json.libraries[i].natives[this.platformString].replace("${arch}", simpleArch)].path}`), path.resolve(userPath, `minecraft/meta/natives/${this.instance_id}-${version}`));
                    }
                }
                this.libs += paths;
            }
            signal.throwIfAborted();
            win.webContents.send('progress-update', "Downloading Minecraft", 100, "Done", processId, "done", cancelId, true);
            return { java_installation: this.java_installation, java_version: this.java_version, java_args };
        } catch (err) {
            win.webContents.send('progress-update', "Downloading Minecraft", 100, err, processId, "error", cancelId, true);
            throw err;
        }
    }
}

function extractJar(jarFilePath, extractToPath) {
    if (!fs.existsSync(jarFilePath)) {
        throw new Error(`JAR file does not exist at path: ${jarFilePath}`);
    }

    try {
        const zip = new AdmZip(jarFilePath);

        // Ensure the output directory exists
        if (!fs.existsSync(extractToPath)) {
            fs.mkdirSync(extractToPath, { recursive: true });
        }

        zip.extractAllTo(extractToPath, true);

        console.log(`Successfully extracted ${jarFilePath} to ${extractToPath}`);
    } catch (err) {
        console.error(`Failed to extract JAR: ${err.message}`);
        throw err;
    }
}

class Java {
    constructor(db) {
        this.db = db;
        fs.mkdirSync(path.resolve(userPath, `java`), { recursive: true });
        let versions = db.prepare("SELECT * FROM java_versions").all();
        this.versions_map = {};
        for (let i = 0; i < versions.length; i++) {
            this.versions_map[versions[i].version] = versions[i].file_path;
        }
    }
    async downloadJava(version) {
        let processId = generateNewProcessId();
        let cancelId = generateNewCancelId();
        let abortController = new AbortController();
        cancelLaunchFunctions[cancelId] = abortController;
        retryLaunchFunctions[cancelId] = () => { }
        let signal = abortController.signal;
        try {
            win.webContents.send('progress-update', "Downloading Java", 0, "Starting java download...", processId, "good", cancelId, true);
            const installDir = path.resolve(userPath, `java/java-${version}`);
            const platform = os.platform(); // 'win32', 'linux', 'darwin'
            const arch = os.arch(); // 'x64', 'arm64', etc.
            const getPlatformString = () => {
                if (platform === 'win32') return 'windows';
                if (platform === 'darwin') return 'macos';
                return 'linux';
            };
            let platformString = getPlatformString();
            const versionApi = `https://api.azul.com/metadata/v1/zulu/packages/?java_version=${version}&os=${platformString}&arch=${arch}&archive_type=zip&java_package_type=jre&javafx_bundled=false&latest=true`;
            signal.throwIfAborted();
            win.webContents.send('progress-update', "Downloading Java", 5, "Fetching java version info...", processId, "good", cancelId, true);
            const res = await fetch(versionApi);
            const data = await res.json();

            if (!data.length) {
                throw new Error('No JRE binaries found.');
            }

            const binary = data[0];
            const downloadUrl = binary.download_url;
            const fileName = path.basename(downloadUrl);
            const downloadPath = path.resolve(userPath, "java/" + fileName);
            signal.throwIfAborted();
            win.webContents.send('progress-update', "Downloading Java", 10, "Fetching java zip...", processId, "good", cancelId, true);
            await urlToFile(downloadUrl, downloadPath, {
                signal, onProgress: (v) => {
                    win.webContents.send('progress-update', "Downloading Java", v / 2 + 10, "Fetching java zip...", processId, "good", cancelId, true);
                }
            });
            signal.throwIfAborted();
            win.webContents.send('progress-update', "Downloading Java", 60, "Extracting java zip...", processId, "good", cancelId, true);
            let name = "";
            if (fileName.endsWith('.zip')) {
                const zip = new AdmZip(downloadPath);
                await new Promise((resolve, reject) => {
                    zip.extractAllToAsync(installDir, true, false, (v) => {
                        if (v) reject(v);
                        else resolve("");
                    });
                });
                const items = fs.readdirSync(installDir, { withFileTypes: true });
                const dirs = items.filter(item => item.isDirectory());

                name = dirs[dirs.length - 1].name;
            } else {
                throw new Error("Isn't a .zip file?");
            }
            signal.throwIfAborted();
            win.webContents.send('progress-update', "Downloading Java", 95, "Deleting old zip...", processId, "good", cancelId, true);

            fs.unlinkSync(downloadPath);
            signal.throwIfAborted();
            win.webContents.send('progress-update', "Downloading Java", 98, "Remembering version...", processId, "good", cancelId, true);
            this.versions_map[version] = path.resolve(userPath, `java/java-${version}/${name}/bin/javaw.exe`);
            if (platformString == "linux") {
                this.versions_map[version] = path.resolve(userPath, `java/java-${version}/${name}/bin/java`);
                fs.chmodSync(this.versions_map[version], 0o755);
            }
            if (platformString == "macos") {
                this.versions_map[version] = path.resolve(userPath, `java/java-${version}/${name}/zulu-${version}.jre/Contents/Home/bin/java`);
                fs.chmodSync(this.versions_map[version], 0o755);
            }
            this.db.prepare("INSERT INTO java_versions (version, file_path) VALUES (?, ?) ON CONFLICT(version) DO UPDATE SET file_path = excluded.file_path").run(version, this.versions_map[version]);
            signal.throwIfAborted();
            win.webContents.send('progress-update', "Downloading Java", 100, "Done", processId, "done", cancelId, true);
        } catch (err) {
            win.webContents.send('progress-update', "Downloading Java", 100, err, processId, "error", cancelId, true);
            throw err;
        }
    }
    async getJavaInstallation(version, isRepair) {
        if (!this.versions_map[version] || isRepair) {
            await this.downloadJava(version);
        }
        return this.versions_map[version];
    }
    async setJavaInstallation(version, file_path) {
        if (this.versions_map[version] == file_path) return;
        this.versions_map[version] = file_path;
        this.db.prepare("UPDATE java_versions SET file_path = ? WHERE version = ?").run(file_path, version);
    }
    async upgradeLegacy() {
        let versionPath = path.resolve(userPath, "java/versions.json");
        if (!fs.existsSync(versionPath)) return;
        let content = JSON.parse(await fs.promises.readFile(versionPath, 'utf-8'));
        let entries = Object.entries(content);
        for (let i = 0; i < entries.length; i++) {
            let version = Number(entries[i][0].replace("java-", ""));
            this.db.prepare("INSERT INTO java_versions (version, file_path) VALUES (?, ?) ON CONFLICT(version) DO UPDATE SET file_path = excluded.file_path").run(version, entries[i][1]);
        }
        await fs.promises.unlink(versionPath);
    }
}

function urlToFile(url, filepath, {
    signal = null,
    onProgress = null,
    redirectCount = 0
} = {}) {
    return new Promise((resolve, reject) => {
        try {
            if (signal) signal.throwIfAborted();
        } catch (err) {
            return reject(err);
        }

        if (redirectCount > 5) {
            return reject(new Error("Too many redirects"));
        }

        const parsedUrl = urlModule.parse(url);
        const protocol = parsedUrl.protocol === "https:" ? https : http;

        fs.mkdirSync(path.dirname(filepath), { recursive: true });
        const file = fs.createWriteStream(filepath);

        let request;

        const cleanup = (err) => {
            try { file.close(() => { }); } catch { }
            fs.unlink(filepath, () => { });
            reject(err);
        };

        const abortHandler = () => {
            cleanup(signal.reason);
        };
        if (signal) signal.addEventListener("abort", abortHandler);

        try {
            request = protocol.get(url, (response) => {
                try {
                    if (signal) signal.throwIfAborted();
                } catch (e) {
                    return cleanup(e);
                }

                // Handle redirect
                if (
                    response.statusCode >= 300 &&
                    response.statusCode < 400 &&
                    response.headers.location
                ) {
                    const redirectUrl = new URL(response.headers.location, url).href;
                    file.close();
                    fs.unlink(filepath, () => {
                        if (signal) signal.removeEventListener("abort", abortHandler);

                        urlToFile(redirectUrl, filepath, {
                            signal,
                            onProgress,
                            redirectCount: redirectCount + 1
                        }).then(resolve).catch(reject);
                    });
                    return;
                }

                if (response.statusCode !== 200) {
                    return cleanup(new Error(`Failed to get '${url}' (${response.statusCode})`));
                }

                const total = parseInt(response.headers["content-length"] || "0", 10);
                let downloaded = 0;

                response.on("data", (chunk) => {
                    downloaded += chunk.length;

                    if (signal?.aborted) {
                        return; // abortHandler will handle cleanup
                    }

                    if (total && onProgress) {
                        onProgress((downloaded / total) * 100);
                    }
                });

                response.pipe(file);

                file.on("finish", () => {
                    file.close(() => {
                        if (signal) signal.removeEventListener("abort", abortHandler);
                        resolve(filepath);
                    });
                });

                response.on("error", cleanup);
            });

            request.on("error", cleanup);

            // Abort request if needed
            if (signal) {
                signal.addEventListener("abort", () => {
                    try { request.destroy(); } catch { }
                });
            }

        } catch (err) {
            cleanup(err);
        }
    });
}

function urlToFolder(url, folder, redirectCount = 0) {
    return new Promise((resolve, reject) => {
        if (redirectCount > 5) {
            return reject(new Error('Too many redirects'));
        }

        const parsedUrl = urlModule.parse(url);
        const protocol = parsedUrl.protocol === 'https:' ? https : http;
        const fileName = path.basename(decodeURIComponent(parsedUrl.pathname));
        const filepath = path.join(folder, fileName);

        fs.mkdirSync(folder, { recursive: true });

        const request = protocol.get(url, (response) => {
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                // Handle redirect
                const redirectUrl = new URL(response.headers.location, url).href;
                urlToFolder(redirectUrl, folder, redirectCount + 1)
                    .then(resolve)
                    .catch(reject);
                return;
            }

            if (response.statusCode !== 200) {
                return reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
            }

            const file = fs.createWriteStream(filepath, { flags: 'w' });

            response.pipe(file);

            file.on('finish', () => {
                file.close(() => resolve(fileName));
            });

            file.on('error', (err) => {
                fs.unlink(filepath, () => { });
                reject(err);
            });
        });

        request.on('error', (err) => {
            fs.unlink(filepath, () => { });
            reject(err);
        });

    });
}

function fileFormatDate(date) {
    let m = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
    let d = ["", "01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "30", "31"];
    let hms = ["00", "01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "30", "31", "32", "33", "34", "35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46", "47", "48", "49", "50", "51", "52", "53", "54", "55", "56", "57", "58", "59"];
    return date.getFullYear() + "-" + m[date.getMonth()] + "-" + d[date.getDate()] + "_" + hms[date.getHours()] + "-" + hms[date.getMinutes()] + "-" + hms[date.getSeconds()];
}

class Fabric {
    constructor() { }
    static async getSupportedVanillaVersions() {
        const fabric_json = await fetch(`https://meta.fabricmc.net/v2/versions/game`);
        const data = await fabric_json.json();
        let versions = data.map((e) => e.version);
        versions = versions.filter((e) => !e.includes("combat") && !e.includes(" ") && !e.includes("experiment") && !e.includes("original"));
        return versions;
    }
    static async getVersions(v) {
        const fabric_json = await fetch(`https://meta.fabricmc.net/v2/versions/loader/${v}`);
        const data = await fabric_json.json();
        return data.map((e) => e.loader.version);
    }
}
class Forge {
    constructor() { }

    // Returns a list of supported vanilla Minecraft versions for Forge
    static async getSupportedVanillaVersions() {
        // Use the Forge version manifest
        const res = await fetch('https://files.minecraftforge.net/net/minecraftforge/forge/maven-metadata.json');
        const data = await res.json();

        // The manifest contains an array of versions, filter out non-standard ones
        // Only include versions that look like vanilla Minecraft versions (e.g., "1.20.1")
        let versions = Object.keys(data)
            .filter(v => /^\d+\.\d+(\.\d+)?$/.test(v));
        versions = versions.filter(e => !["1.5.2", "1.5.1", "1.5", "1.4.7", "1.4.6", "1.4.5", "1.4.4", "1.4.3", "1.4.2", "1.4.1", "1.4.0", "1.3.2", "1.2.5", "1.2.4", "1.2.3", "1.1"].includes(e));
        return versions.reverse();
    }

    // Returns a list of Forge loader versions for a given vanilla version
    static async getVersions(mcVersion) {

        const url = `https://files.minecraftforge.net/net/minecraftforge/forge/maven-metadata.json`;
        const res = await fetch(url);
        const data = await res.json();

        const forgeVersions = data[mcVersion].map(e => {
            let split = e.split("-");
            split.splice(0, 1);
            return split.join("-");
        });

        return forgeVersions.toReversed();
    }
}
class Quilt {
    constructor() { }
    static async getSupportedVanillaVersions() {
        const res = await fetch('https://meta.quiltmc.org/v3/versions/game');
        const data = await res.json();
        let versions = data.map(e => e.version);
        versions = versions.filter(e => !e.includes("combat") && !e.includes(" ") && !e.includes("experiment") && !e.includes("original"));
        return versions;
    }
    static async getVersions(mcVersion) {
        const res = await fetch(`https://meta.quiltmc.org/v3/versions/loader/${mcVersion}`);
        const data = await res.json();
        return data.map(e => e.loader.version);
    }
}

class NeoForge {
    constructor() { }
    static async getSupportedVanillaVersions() {

        const res = await fetch('https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge');
        const data = (await res.json()).versions;

        let versions = [];

        for (let i = 0; i < data.length; i++) {
            let versionNumber = "";
            let split = data[i].split(".");
            if (Number(split[0]) >= 26) {
                let mcVersion = split[0] + '.' + split[1];
                if (split[2] != "0") {
                    mcVersion += "." + split[2];
                }
                let splitAgain = data[i].split('+');
                if (splitAgain.length == 2) {
                    mcVersion += '-' + splitAgain[1];
                }
                if (!versions.includes(mcVersion)) versions.push(mcVersion);
            } else if (split[0] == "0") {
                if (!versions.includes(split[1])) versions.push(split[1]);
            } else {
                versionNumber += "1." + split[0];
                if (split[1] != "0") {
                    versionNumber += "." + split[1];
                }
                if (!versions.includes(versionNumber)) versions.push(versionNumber);
            }
        }

        return versions.reverse();
    }

    static async getVersions(mcVersion) {
        let start = "";
        let end = "";
        let split2 = mcVersion.split("-");
        let split = split2[0].split(".");
        if (split.length >= 2 && split2.length == 1) {
            if (Number(split[0]) >= 26) {
                start = split[0] + "." + split[1] + "." + (split[2] ?? "0");
            } else {
                start = split[1] + "." + (split[2] ?? "0");
            }
        } else if (split2.length >= 2) {
            start = split[0] + "." + split[1] + "." + (split[2] ?? "0");
            end = split2.slice(1).join("-");
        } else {
            start = "0." + mcVersion;
        }
        const res = await fetch('https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge');
        const data = (await res.json()).versions;
        let versions = [];
        for (let i = 0; i < data.length; i++) {
            if (data[i].startsWith(start) && data[i].endsWith(end)) {
                versions.push(data[i]);
            }
        }
        return versions.reverse();
    }
}

function mavenPathToFilePath(maven_path) {
    return path.resolve(userPath, "minecraft/meta/libraries/", mavenPathToRelPath(maven_path));
}
function mavenPathToRelPath(maven_path) {
    let extension;
    if (maven_path.includes('@')) {
        [maven_path, extension] = maven_path.split('@');
    }

    const parts = maven_path.split(':');
    if (parts.length < 3) {
        throw new Error('Invalid Maven artifact format');
    }

    const [groupId, artifactId, version, classifier] = parts;
    const groupPath = groupId.replace(/\./g, '/');
    const fileExtension = extension || 'jar';
    const classifierPart = classifier ? `-${classifier}` : '';

    const fileName = `${artifactId}-${version}${classifierPart}.${fileExtension}`;
    return `${groupPath}/${artifactId}/${version}/${fileName}`;
}
function getMainClass(jar_path) {
    if (!fs.existsSync(jar_path)) return null;
    try {
        const zip = new AdmZip(jar_path);
        const entries = zip.getEntries();
        const manifestEntry = entries.find(e => e.entryName && e.entryName.toUpperCase() === 'META-INF/MANIFEST.MF');
        if (!manifestEntry) return null;
        const content = manifestEntry.getData().toString('utf8');
        const lines = content.split(/\r?\n/);
        const headers = {};
        let currentKey = null;
        for (const line of lines) {
            if (line === '') {
                currentKey = null;
                continue;
            }
            if (/^\s/.test(line) && currentKey) {
                // Continuation line: append without the leading space
                headers[currentKey] += line.slice(1);
            } else {
                const idx = line.indexOf(':');
                if (idx === -1) {
                    currentKey = null;
                    continue;
                }
                currentKey = line.slice(0, idx).trim().toLowerCase();
                headers[currentKey] = (line.slice(idx + 1) || '').trim();
            }
        }
        return headers['main-class'] || null;
    } catch (err) {
        console.error('Failed to read manifest:', err);
        return null;
    }
}

function compareVersions(v1, v2) {
    const a = v1.split('-')[0].split('.').map(Number);
    const b = v2.split('-')[0].split('.').map(Number);
    const length = Math.max(a.length, b.length);

    for (let i = 0; i < length; i++) {
        const num1 = a[i] || 0;
        const num2 = b[i] || 0;
        if (num1 < num2) return -1;
        if (num1 > num2) return 1;
    }
    return 0;
}

function quoteArgs(args) {
    return args.map(arg => {
        if (/^[A-Za-z0-9_\/.:=+\-]+$/.test(arg)) {
            return arg;
        }
        return `"${arg.replace(/(["\\])/g, "\\$1")}"`;
    }).join(" ");
}

module.exports = {
    Minecraft,
    Java,
    Fabric,
    Forge,
    Quilt,
    NeoForge,
    urlToFile,
    urlToFolder,
    setUserPath,
    setWindow
}
