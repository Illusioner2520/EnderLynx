const fs = require('fs');
const https = require('https');
const http = require('http');
const urlModule = require('url');
const path = require('path');
const AdmZip = require('adm-zip');
const os = require('os');
const { spawn, exec, execFile } = require('child_process');
const fsPromises = require('fs').promises;
const { ipcRenderer } = require('electron');

let launchername = "EnderGate";
let launcherversion = "0.0.1";

class Minecraft {
    constructor(instance_id) {
        this.instance_id = instance_id;
    }
    async installFabric(mcversion, fabricversion) {
        ipcRenderer.send('progress-update',"Downloading Fabric",0,"Download fabric info...");
        const fabric_json = await fetch(`https://meta.fabricmc.net/v2/versions/loader/${mcversion}/${fabricversion}/profile/json`);
        const data = await fabric_json.json();
        fs.mkdirSync(`./minecraft/meta/fabric/${mcversion}/${fabricversion}`, { recursive: true });
        fs.writeFileSync(`./minecraft/meta/fabric/${mcversion}/${fabricversion}/fabric-${mcversion}-${fabricversion}.json`, JSON.stringify(data));
        ipcRenderer.send('progress-update',"Downloading Fabric",20,"Downloading fabric libraries...");
        for (let i = 0; i < data.libraries.length; i++) {
            ipcRenderer.send('progress-update',"Downloading Fabric",((i+1)/data.libraries.length)*80+20,`Downloading library ${i+1} of ${data.libraries.length}...`);
            let fileName = data.libraries[i].name.split(":");
            fileName.splice(0, 1);
            fileName = fileName.join("-") + ".jar";
            let patha = data.libraries[i].name.split(":");
            patha[0] = patha[0].replaceAll(".", "/");
            patha = patha.join("/") + "/" + fileName;
            if (!fs.existsSync(`./minecraft/meta/libraries/${patha}`)) {
                await urlToFile(`https://maven.fabricmc.net/${patha}`, `./minecraft/meta/libraries/${patha}`);
            }
            this.libs += path.resolve(__dirname, `minecraft/meta/libraries/${patha}`) + ";";
            let libName = data.libraries[i].name.split(":");
            libName.splice(libName.length - 1, 1);
            this.libNames.push(libName.join(":"));
        }
        this.main_class = data.mainClass;
        this.modded_args_game = data.arguments.game;
        this.modded_args_jvm = data.arguments.jvm;
    }
    async launchGame(loader, version, loaderVersion, username, uuid, auth, customResolution, quickPlay, isDemo) {
        let newJava = new Java();
        this.libs = "";
        this.libNames = [];
        const platform = os.platform();
        const getPlatformString = () => {
            if (platform === 'win32') return 'windows';
            if (platform === 'darwin') return 'osx';
            return 'linux';
        };
        const arch = os.arch();
        let platformString = getPlatformString();
        if (loader == "fabric") {
            if (!fs.existsSync(`./minecraft/meta/fabric/${version}/${loaderVersion}/fabric-${version}-${loaderVersion}.json`)) {
                await this.installFabric(version, loaderVersion);
            } else {
                let fabric_json = fs.readFileSync(`./minecraft/meta/fabric/${version}/${loaderVersion}/fabric-${version}-${loaderVersion}.json`);
                fabric_json = JSON.parse(fabric_json);
                this.main_class = fabric_json.mainClass;
                this.modded_args_game = fabric_json.arguments.game;
                this.modded_args_jvm = fabric_json.arguments.jvm;
                for (let i = 0; i < fabric_json.libraries.length; i++) {
                    let fileName = fabric_json.libraries[i].name.split(":");
                    fileName.splice(0, 1);
                    fileName = fileName.join("-") + ".jar";
                    let patha = fabric_json.libraries[i].name.split(":");
                    patha[0] = patha[0].replaceAll(".", "/");
                    patha = patha.join("/") + "/" + fileName;
                    this.libs += path.resolve(__dirname, `minecraft/meta/libraries/${patha}`) + ";";
                    let libName = fabric_json.libraries[i].name.split(":");
                    libName.splice(libName.length - 1, 1);
                    this.libNames.push(libName.join(":"));
                }
            }
        }
        if (!fs.existsSync(`./minecraft/instances/${this.instance_id}/versions/${version}/${version}.json`)) {
            console.log("Needing to download game.");
            console.log(`Initializing downloading version ${version}`)
            await this.downloadGame(loader, version);
        } else {
            console.log("Version already installed, collecting info.")
            let version_json = fs.readFileSync(`./minecraft/instances/${this.instance_id}/versions/${version}/${version}.json`);
            version_json = JSON.parse(version_json);
            let paths = "";
            libs: for (let i = 0; i < version_json.libraries.length; i++) {
                if (version_json.libraries[i].rules) {
                    rules: for (let j = 0; j < version_json.libraries[i].rules.length; j++) {
                        let rule = version_json.libraries[i].rules[j];
                        if (rule.action == "allow" && rule?.os?.name && rule?.os?.name != platformString) {
                            continue libs;
                        }
                        if (rule.action == "disallow" && rule?.os?.name == platformString) {
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
                        paths += path.resolve(__dirname, `minecraft/meta/libraries/${e.downloads.artifact.path}`) + ";";
                    }
                    if (e.downloads.natives && e.downloads.natives[platformString]) {
                        paths += path.resolve(__dirname, `minecraft/meta/libraries/${e.downloads.classifiers[e.downloads.natives[platformString]].path}`) + ";";
                    }
                }
            };
            this.libs += paths;
            this.jarfile = path.resolve(__dirname, `minecraft/instances/${this.instance_id}/versions/${version}/${version}.jar`);
            let java = new Java();
            this.java_installation = await java.getJavaInstallation(version_json.javaVersion.majorVersion);
            this.java_version = version_json.javaVersion.majorVersion;
            if (version_json?.arguments?.game) {
                this.args = version_json.arguments;
            } else if (version_json?.minecraftArguments) {
                this.args = version_json.minecraftArguments.split(" ");
            }
            if (loader == "vanilla") this.main_class = version_json.mainClass;
            this.version_type = version_json.type;
            this.assets_index = version_json.assets;
            this.asset_dir = path.resolve(__dirname, "minecraft/meta/assets");
            if (version_json.assets == "legacy") {
                this.asset_dir = path.resolve(__dirname, "minecraft/meta/assets/legacy");
            } else if (version_json.assets == "pre-1.6") {
                this.asset_dir = path.resolve(__dirname, `minecraft/instances/${this.instance_id}/resources`);
            }
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
            // ~1.13+
            this.args.game = this.args.game.concat(this.modded_args_game);
            this.args.game = this.args.game.map((e) => {
                if (e?.value) {
                    if (isDemo && e.rules[0].features.is_demo_user) {
                        extraArgs.push('--demo');
                        return "";
                    } else if (customResolution?.width && customResolution?.height && e.rules[0].features.has_custom_resolution) {
                        extraArgs = extraArgs.concat(["--width", customResolution.width, "--height", customResolution.height]);
                        return "";
                    } else if (quickPlay?.type == "singleplayer" && quickPlay?.info && e.rules[0].features.is_quick_play_singleplayer) {
                        extraArgs = extraArgs.concat(["--quickPlaySingleplayer",quickPlay.info]);
                        return "";
                    } else if (quickPlay?.type == "multiplayer" && quickPlay?.info && e.rules[0].features.is_quick_play_multiplayer) {
                        extraArgs = extraArgs.concat(["--quickPlayMultiplayer",quickPlay.info]);
                        return "";
                    } else if (quickPlay?.type == "realms" && quickPlay?.info && e.rules[0].features.is_quick_play_realms) {
                        extraArgs = extraArgs.concat(["--quickPlayRealms",quickPlay.info]);
                        return "";
                    }
                } else {
                    return e;
                }
            });
            this.args.game = this.args.game.filter((e) => e);
            this.args.game = this.args.game.map((e) => {
                e = e.replace("${auth_player_name}", player_info.name);
                e = e.replace("${version_name}", version);
                e = e.replace("${game_directory}", path.resolve(__dirname, `minecraft/instances/${this.instance_id}`));
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
            args: for (let i = 0; i < this.args.jvm.length; i++) {
                let e = this.args.jvm[i];
                if (e.value && e.rules) {
                    rules: for (let j = 0; j < e.rules.length; j++) {
                        let rule = e.rules[j];
                        if (rule.action == "allow" && rule?.os?.name && rule?.os?.name != platformString) {
                            continue args;
                        }
                        if (rule.action == "allow" && rule?.os?.arch && rule?.os?.arch != arch) {
                            continue args;
                        }
                        if (rule.action == "disallow" && rule?.os?.name == platformString) {
                            continue args;
                        }
                        if (rule.action == "disallow" && rule?.os?.arch == arch) {
                            continue args;
                        }
                    }
                    let newVal = e.value;
                    if (Array.isArray(newVal)) {
                        newVal = newVal.map((e) => {
                            e = e.replace("${natives_directory}", path.resolve(__dirname, `minecraft/meta/natives/${this.instance_id}-${version}`));
                            e = e.replace("${launcher_name}", launchername);
                            e = e.replace("${launcher_version}", launcherversion);
                            return e;
                        })
                        args = args.concat(newVal);
                    } else {
                        newVal = newVal.replace("${natives_directory}", path.resolve(__dirname, `minecraft/meta/natives/${this.instance_id}-${version}`));
                        newVal = newVal.replace("${launcher_name}", launchername);
                        newVal = newVal.replace("${launcher_version}", launcherversion);
                        args.push(newVal);
                    }
                } else {
                    e = e.replace("${natives_directory}", path.resolve(__dirname, `minecraft/meta/natives/${this.instance_id}-${version}`));
                    e = e.replace("${launcher_name}", launchername);
                    e = e.replace("${launcher_version}", launcherversion);
                    if (e.includes("${classpath}")) {
                        let theargs = [this.libs + this.jarfile];
                        theargs = theargs.concat(this.modded_args_jvm);
                        theargs = theargs.concat(["-Xmx2G", "-XX:+UnlockExperimentalVMOptions", "-XX:+UseG1GC", "-XX:G1NewSizePercent=20", "-XX:G1ReservePercent=20", "-XX:MaxGCPauseMillis=50", "-XX:G1HeapRegionSize=32M", this.main_class]);
                        args = args.concat(theargs);
                    } else {
                        args.push(e);
                    }
                }
            }
            args = args.concat(this.args.game);
            args = args.concat(extraArgs);
        } else {
            if (platformString == "windows") {
                args.push("-XX:HeapDumpPath=MojangTricksIntelDriversForPerformance_javaw.exe_minecraft.exe.heapdump");
            } else if (platformString == "osx") {
                args.push("-XstartOnFirstThread");
            }
            if (arch == "x86") {
                args.push("-Xss1M");
            }
            args.push("-Djava.library.path=" + path.resolve(__dirname,`minecraft/meta/natives/${this.instance_id}-${version}`));
            args.push("-Dminecraft.launcher.brand=" + launchername);
            args.push("-Dminecraft.launcher.version=" + launcherversion);
            args.push("-Dminecraft.client.jar=" + this.jarfile);
            args.push("-cp");
            args.push(this.libs + this.jarfile);
            args = args.concat("-Xmx2G -XX:+UnlockExperimentalVMOptions -XX:+UseG1GC -XX:G1NewSizePercent=20 -XX:G1ReservePercent=20 -XX:MaxGCPauseMillis=50 -XX:G1HeapRegionSize=32M".split(" "));
            args.push(this.main_class);
            this.args = this.args.map((e) => {
                e = e.replace("${auth_player_name}", player_info.name);
                e = e.replace("${version_name}", version);
                e = e.replace("${game_directory}", path.resolve(__dirname, `minecraft/instances/${this.instance_id}`));
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
        }
        console.log("Launching game.");
        console.log(this.libNames);
        console.log("Executing: " + this.java_installation + " " + args.join(" "));
        let LOG_PATH = path.resolve(__dirname, `minecraft/instances/${this.instance_id}/logs/${fileFormatDate(new Date())}.log`);
        let fd = fs.openSync(LOG_PATH, 'w');
        fs.closeSync(fd);
        const child = spawn(this.java_installation, args, {
            cwd: `./minecraft/instances/${this.instance_id}`,
            detached: true,
            stdio: ['ignore', fs.openSync(LOG_PATH, 'a'), fs.openSync(LOG_PATH, 'a')]
        });
        child.unref();
        return { "pid": child.pid, "log": LOG_PATH, "java_path": this.java_installation, "java_version": this.java_version };
    }
    async downloadGame(loader, version) {
        if (!this.libNames) this.libNames = [];
        try {
            ipcRenderer.send('progress-update',"Downloading Minecraft",0,"Creating directories...");
            console.log("Creating directories");
            fs.mkdirSync(`./minecraft/instances/${this.instance_id}/versions/${version}`, { recursive: true });
            fs.mkdirSync(`./minecraft/meta/natives/${this.instance_id}-${version}`, { recursive: true });
            fs.mkdirSync(`./minecraft/instances/${this.instance_id}/logs`, { recursive: true });
            console.log("Creating empty jar file");
            let files = [`./minecraft/instances/${this.instance_id}/versions/${version}/${version}.jar`]
            files.forEach((e) => {
                const fd = fs.openSync(e, 'w');
                fs.closeSync(fd);
            });
            this.version = version;
            ipcRenderer.send('progress-update',"Downloading Minecraft",2,"Downloading version list...");
            console.log("Downloading version manifest");
            const obtainVersionManifest = await fetch("https://launchermeta.mojang.com/mc/game/version_manifest.json");
            const version_manifest = await obtainVersionManifest.json();
            let version_json = {};
            for (let i = 0; i < version_manifest.versions.length; i++) {
                if (version_manifest.versions[i].id == version) {
                    console.log("Downloading version json");
                    ipcRenderer.send('progress-update',"Downloading Minecraft",3,"Downloading version info...");
                    const obtainVersionJSON = await fetch(version_manifest.versions[i].url);
                    version_json = await obtainVersionJSON.json();
                    break;
                }
            }
            if (!version_json.assets) {
                console.error("Invalid version");
                return;
            }
            fs.writeFileSync(`./minecraft/instances/${this.instance_id}/versions/${version}/${version}.json`, JSON.stringify(version_json));
            console.log("Downloading asset json");
            ipcRenderer.send('progress-update',"Downloading Minecraft",5,"Downloading asset info...");
            const assetJSON = await fetch(version_json.assetIndex.url);
            let asset_json = await assetJSON.json();
            fs.mkdirSync(`./minecraft/meta/assets/indexes`, { recursive: true });
            fs.mkdirSync(`./minecraft/meta/assets/objects`, { recursive: true });
            fs.writeFileSync(`./minecraft/meta/assets/indexes/${version_json.assets}.json`, JSON.stringify(asset_json));
            let assetKeys = Object.keys(asset_json.objects);
            console.log("Downloading Assets");
            for (let i = 0; i < assetKeys.length; i++) {
                ipcRenderer.send('progress-update',"Downloading Minecraft",((i+1)/assetKeys.length)*30+5,`Downloading asset ${i+1} of ${assetKeys.length}...`);
                console.log(`Downloading asset ${i + 1} of ${assetKeys.length}`);
                let asset_data = asset_json.objects[assetKeys[i]];
                if (version_json.assets == "legacy") {
                    if (!fs.existsSync(`./minecraft/meta/assets/legacy/${assetKeys[i]}`)) {
                        await urlToFile(`https://resources.download.minecraft.net/${asset_data.hash.substring(0, 2)}/${asset_data.hash}`, `./minecraft/meta/assets/legacy/${assetKeys[i]}`);
                    }
                } else if (version_json.assets == "pre-1.6") {
                    if (!fs.existsSync(`./minecraft/instances/${this.instance_id}/resources/${assetKeys[i]}`)) {
                        await urlToFile(`https://resources.download.minecraft.net/${asset_data.hash.substring(0, 2)}/${asset_data.hash}`, `./minecraft/instances/${this.instance_id}/resources/${assetKeys[i]}`);
                    }
                } else {
                    if (!fs.existsSync(`./minecraft/meta/assets/objects/${asset_data.hash.substring(0, 2)}/${asset_data.hash}`)) {
                        await urlToFile(`https://resources.download.minecraft.net/${asset_data.hash.substring(0, 2)}/${asset_data.hash}`, `./minecraft/meta/assets/objects/${asset_data.hash.substring(0, 2)}/${asset_data.hash}`);
                    }
                }
            }
            this.asset_dir = version_json.assets == "legacy" ? path.resolve(__dirname, "minecraft/meta/assets/legacy") : version_json.assets == "pre-1.6" ? path.resolve(__dirname, `minecraft/instances/${this.instance_id}/resources`) : path.resolve(__dirname, "minecraft/meta/assets");
            console.log("asset directory set to " + this.asset_dir);
            console.log("Downloading jar file");
            ipcRenderer.send('progress-update',"Downloading Minecraft",40,"Downloading version jar...");
            await urlToFile(version_json.downloads.client.url, `./minecraft/instances/${this.instance_id}/versions/${version}/${version}.jar`);
            this.jarfile = path.resolve(__dirname, `minecraft/instances/${this.instance_id}/versions/${version}/${version}.jar`);
            let java = new Java();
            let paths = "";
            console.log("Checking java installation");
            ipcRenderer.send('progress-update',"Downloading Minecraft",45,"Checking for java...");
            this.java_installation = await java.getJavaInstallation(version_json.javaVersion.majorVersion);
            this.java_version = version_json.javaVersion.majorVersion;
            const platform = os.platform();
            const getPlatformString = () => {
                if (platform === 'win32') return 'windows';
                if (platform === 'darwin') return 'osx';
                return 'linux';
            };
            const arch = os.arch();
            if (version_json?.arguments?.game) {
                this.args = version_json.arguments;
            } else if (version_json?.minecraftArguments) {
                this.args = version_json.minecraftArguments.split(" ");
            }
            if (loader == "vanilla") this.main_class = version_json.mainClass;
            this.version_type = version_json.type;
            this.assets_index = version_json.assets;
            let platformString = getPlatformString();
            let simpleArch = (arch == "arm" || arch == "ia32" || arch == "mips" || arch == "ppc") ? "32" : "64";
            ipcRenderer.send('progress-update',"Downloading Minecraft",60,"Starting library download...");
            libs: for (let i = 0; i < version_json.libraries.length; i++) {
                ipcRenderer.send('progress-update',"Downloading Minecraft",((i+1)/version_json.libraries.length)*40+60,`Downloading library ${i+1} of ${version_json.libraries.length}`);
                if (version_json.libraries[i].rules) {
                    rules: for (let j = 0; j < version_json.libraries[i].rules.length; j++) {
                        let rule = version_json.libraries[i].rules[j];
                        if (rule.action == "allow" && rule?.os?.name && rule?.os?.name != platformString) {
                            continue libs;
                        }
                        if (rule.action == "disallow" && rule?.os?.name == platformString) {
                            continue libs;
                        }
                    }
                }
                if (version_json.libraries[i].downloads.artifact) {
                    console.log("Downloading library " + version_json.libraries[i].downloads.artifact.path);
                    if (!fs.existsSync(`./minecraft/meta/libraries/${version_json.libraries[i].downloads.artifact.path}`)) {
                        await urlToFile(version_json.libraries[i].downloads.artifact.url, `./minecraft/meta/libraries/${version_json.libraries[i].downloads.artifact.path}`);
                    }
                    let libName = version_json.libraries[i].name.split(":");
                    libName.splice(libName.length - 1, 1);
                    libName = libName.join(":");
                    if (!this.libNames?.includes(libName)) {
                        paths += path.resolve(__dirname, `minecraft/meta/libraries/${version_json.libraries[i].downloads.artifact.path}`) + ";";
                    }
                    this.libNames.push(libName);
                }
                if (version_json.libraries[i].natives && version_json.libraries[i].natives[platformString]) {
                    console.log("Downloading library (with natives) " + version_json.libraries[i].downloads.classifiers[version_json.libraries[i].natives[platformString].replace("${arch}", simpleArch)].path);
                    if (!fs.existsSync(`./minecraft/meta/libraries/${version_json.libraries[i].downloads.classifiers[version_json.libraries[i].natives[platformString].replace("${arch}", simpleArch)].path}`)) {
                        await urlToFile(version_json.libraries[i].downloads.classifiers[version_json.libraries[i].natives[platformString].replace("${arch}", simpleArch)].url, `./minecraft/meta/libraries/${version_json.libraries[i].downloads.classifiers[version_json.libraries[i].natives[platformString].replace("${arch}", simpleArch)].path}`);
                    }
                    let libName = version_json.libraries[i].name.split(":");
                    libName.splice(libName.length - 1, 1);
                    libName = libName.join(":");
                    if (!this.libNames?.includes(libName)) {
                        paths += path.resolve(__dirname, `minecraft/meta/libraries/${version_json.libraries[i].downloads.classifiers[version_json.libraries[i].natives[platformString].replace("${arch}", simpleArch)].path}`) + ";";
                    }
                    this.libNames.push(libName);
                    console.log("Native found, extracting jar file.");
                    await extractJar(`./minecraft/meta/libraries/${version_json.libraries[i].downloads.classifiers[version_json.libraries[i].natives[platformString].replace("${arch}", simpleArch)].path}`, `./minecraft/meta/natives/${this.instance_id}-${version}`);
                }
            }
            this.libs += paths;
        } catch (err) {
            console.error('Error in download chain:', err);
        }
        ipcRenderer.send('progress-update',"Downloading Minecraft",100,"Done");
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
    }
}

class Java {
    constructor() {
        fs.mkdirSync(`./java`, { recursive: true });
        try {
            this.versions = JSON.parse(fs.readFileSync(`./java/versions.json`, 'utf-8'));
        } catch (e) {
            if (e.code == "ENOENT") {
                this.versions = {};
                fs.writeFileSync(`./java/versions.json`, "{}", 'utf-8');
            }
        }
    }
    async downloadJava(version) {
        ipcRenderer.send('progress-update',"Downloading Java",0,"Starting java download...");
        console.log("Initializing downloading java " + version);
        const installDir = `./java/java-${version}`;
        const platform = os.platform(); // 'win32', 'linux', 'darwin'
        const arch = os.arch(); // 'x64', 'arm64', etc.
        const getPlatformString = () => {
            if (platform === 'win32') return 'windows';
            if (platform === 'darwin') return 'macos';
            return 'linux';
        };
        const getArchiveExtension = () => {
            return platform === 'win32' ? 'zip' : 'tar.gz';
        };
        const versionApi = `https://api.azul.com/metadata/v1/zulu/packages/?java_version=${version}&os=${getPlatformString()}&arch=${arch}&archive_type=zip&java_package_type=jre&javafx_bundled=false&latest=true`;

        ipcRenderer.send('progress-update',"Downloading Java",5,"Fetching java version info...");
        const res = await fetch(versionApi);
        const data = await res.json();

        if (!data.length) {
            throw new Error('No JRE binaries found.');
        }

        console.log(data);

        const binary = data[0];
        const downloadUrl = binary.download_url;
        const fileName = path.basename(downloadUrl);
        const downloadPath = "./java/" + fileName;

        console.log(`Downloading java...`);
        ipcRenderer.send('progress-update',"Downloading Java",10,"Fetching java zip...");
        await urlToFile(downloadUrl, downloadPath);
        ipcRenderer.send('progress-update',"Downloading Java",60,"Extracting java zip...");
        console.log(`Extracting java...`);
        let name = "";
        if (fileName.endsWith('.zip')) {
            const zip = new AdmZip(downloadPath);
            zip.extractAllTo(installDir, true);
            const items = fs.readdirSync(installDir, { withFileTypes: true });
            const dirs = items.filter(item => item.isDirectory());

            if (dirs.length === 1) {
                name = dirs[0].name;
            }
        } else {
            console.error("AHHHHHHHHHH");
        }
        ipcRenderer.send('progress-update',"Downloading Java",95,"Deleting old zip...");

        fs.unlinkSync(downloadPath);
        ipcRenderer.send('progress-update',"Downloading Java",98,"Remembering version...");
        this.versions["java-" + version] = path.resolve(__dirname, `java/java-${version}/${name}/bin/javaw.exe`);
        console.log(this.versions);
        fs.writeFileSync("./java/versions.json", JSON.stringify(this.versions), 'utf-8');
        console.log("Java installation complete");
        ipcRenderer.send('progress-update',"Downloading Java",100,"Done");

        // const JAVAC = path.resolve(__dirname, `java/java-${version}/${name}/bin/javac.exe`);
        // const JAR = path.resolve(__dirname, `java/java-${version}/${name}/bin/jar.exe`);

        // execFile(JAVAC, [
        //     '--release', version,
        //     '-d',`./java/java-${version}`,
        //     './quit_agent/QuitAgentImpl.java',
        //     './quit_agent/QuitAgent.java'
        // ], (err, stdout, stderr) => {
        //     if (err) {
        //         console.error('Compile error:', stderr);
        //         return;
        //     }
        //     console.log('✔ Java files compiled');

        //     execFile(JAR, [
        //         'cmf',
        //         './quit_agent/MANIFEST.MF',
        //         `./java/java-${version}/QuitAgentImpl.jar`,
        //         `./java/java-${version}/QuitAgentImpl.class`,
        //     ], (err2, stdout2, stderr2) => {
        //         if (err2) {
        //             console.error('JAR error:', stderr2);
        //             return;
        //         }
        //         console.log('✔ QuitAgentImpl.jar created');
        //     });
        // });
    }
    async getJavaInstallation(version) {
        if (!this.versions["java-" + version]) {
            await this.downloadJava(version);
        }
        return this.versions["java-" + version];
    }
}

function urlToFile(url, filepath, redirectCount = 0) {
    return new Promise((resolve, reject) => {
        if (redirectCount > 5) {
            return reject(new Error('Too many redirects'));
        }

        const parsedUrl = urlModule.parse(url);
        const protocol = parsedUrl.protocol === 'https:' ? https : http;

        fs.mkdirSync(path.dirname(filepath), { recursive: true });

        const file = fs.createWriteStream(filepath);

        const request = protocol.get(url, (response) => {
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                // Handle redirect
                const redirectUrl = new URL(response.headers.location, url).href;
                file.close();
                fs.unlink(filepath, () => {
                    urlToFile(redirectUrl, filepath, redirectCount + 1)
                        .then(resolve)
                        .catch(reject);
                });
                return;
            }

            if (response.statusCode !== 200) {
                file.close();
                fs.unlink(filepath, () => { });
                return reject(new Error(`Failed to get '${url}' (${response.statusCode})`));
            }

            response.pipe(file);

            file.on('finish', () => {
                file.close(() => resolve(filepath));
            });
        });

        request.on('error', (err) => {
            fs.unlink(filepath, () => { });
            reject(err);
        });

        file.on('error', (err) => {
            fs.unlink(filepath, () => { });
            reject(err);
        });
    });
}

function fileFormatDate(date) {
    let m = ["01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12"];
    let d = ["", "01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "30", "31"];
    return date.getFullYear() + "-" + m[date.getMonth()] + "-" + d[date.getDate()] + "_" + date.getHours() + "-" + date.getMinutes() + "-" + date.getSeconds();
}

class Fabric {
    constructor() { }
    async getSupportedVanillaVersions() {
        const fabric_json = await fetch(`https://meta.fabricmc.net/v2/versions/game`);
        const data = await fabric_json.json();
        let versions = data.map((e) => e.version);
        versions = versions.filter((e) => !e.includes("combat") && !e.includes(" ") && !e.includes("experiment") && !e.includes("original"));
        return versions;
    }
    async getVersions(v) {
        const fabric_json = await fetch(`https://meta.fabricmc.net/v2/versions/loader/${v}`);
        const data = await fabric_json.json();
        return data.map((e) => e.loader.version);
    }
}
class Forge {
    constructor() { }
    async getSupportedVanillaVersions() {
        return [];
    }
}
class Quilt {
    constructor() { }
    async getSupportedVanillaVersions() {
        return [];
    }
}
class NeoForge {
    constructor() { }
    async getSupportedVanillaVersions() {
        return [];
    }
}

module.exports = {
    Minecraft,
    Java,
    Fabric,
    Forge,
    Quilt,
    NeoForge,
    urlToFile
}