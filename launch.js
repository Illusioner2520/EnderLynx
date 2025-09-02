const fs = require('fs');
const https = require('https');
const http = require('http');
const urlModule = require('url');
const path = require('path');
const AdmZip = require('adm-zip');
const os = require('os');
const { spawn, exec, execFile, execSync } = require('child_process');
const fsPromises = require('fs').promises;
const { ipcRenderer } = require('electron');

let launchername = "EnderLynx";
let launcherversion = "0.0.1";

class Minecraft {
    constructor(instance_id) {
        this.instance_id = instance_id;
    }
    async installFabric(mcversion, fabricversion, isRepair) {
        ipcRenderer.send('progress-update', "Downloading Fabric", 0, "Download fabric info...");
        const fabric_json = await fetch(`https://meta.fabricmc.net/v2/versions/loader/${mcversion}/${fabricversion}/profile/json`);
        const data = await fabric_json.json();
        fs.mkdirSync(`./minecraft/meta/fabric/${mcversion}/${fabricversion}`, { recursive: true });
        fs.writeFileSync(`./minecraft/meta/fabric/${mcversion}/${fabricversion}/fabric-${mcversion}-${fabricversion}.json`, JSON.stringify(data));
        ipcRenderer.send('progress-update', "Downloading Fabric", 20, "Downloading fabric libraries...");
        for (let i = 0; i < data.libraries.length; i++) {
            ipcRenderer.send('progress-update', "Downloading Fabric", ((i + 1) / data.libraries.length) * 80 + 20, `Downloading library ${i + 1} of ${data.libraries.length}...`);
            let fileName = data.libraries[i].name.split(":");
            fileName.splice(0, 1);
            fileName = fileName.join("-") + ".jar";
            let patha = data.libraries[i].name.split(":");
            patha[0] = patha[0].replaceAll(".", "/");
            patha = patha.join("/") + "/" + fileName;
            if (!fs.existsSync(`./minecraft/meta/libraries/${patha}`) || isRepair) {
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
    async installQuilt(mcversion, quiltversion, isRepair) {
        ipcRenderer.send('progress-update', "Downloading Quilt", 0, "Download quilt info...");
        const quilt_json = await fetch(`https://meta.quiltmc.org/v3/versions/loader/${mcversion}/${quiltversion}/profile/json`);
        const data = await quilt_json.json();
        fs.mkdirSync(`./minecraft/meta/quilt/${mcversion}/${quiltversion}`, { recursive: true });
        fs.writeFileSync(`./minecraft/meta/quilt/${mcversion}/${quiltversion}/quilt-${mcversion}-${quiltversion}.json`, JSON.stringify(data));
        ipcRenderer.send('progress-update', "Downloading Quilt", 20, "Downloading quilt libraries...");
        for (let i = 0; i < data.libraries.length; i++) {
            ipcRenderer.send('progress-update', "Downloading Quilt", ((i + 1) / data.libraries.length) * 80 + 20, `Downloading library ${i + 1} of ${data.libraries.length}...`);
            let fileName = data.libraries[i].name.split(":");
            fileName.splice(0, 1);
            fileName = fileName.join("-") + ".jar";
            let patha = data.libraries[i].name.split(":");
            patha[0] = patha[0].replaceAll(".", "/");
            patha = patha.join("/") + "/" + fileName;
            if (!fs.existsSync(`./minecraft/meta/libraries/${patha}`) || isRepair) {
                await urlToFile(data.libraries[i].url + `${patha}`, `./minecraft/meta/libraries/${patha}`);
            }
            this.libs += path.resolve(__dirname, `minecraft/meta/libraries/${patha}`) + ";";
            let libName = data.libraries[i].name.split(":");
            libName.splice(libName.length - 1, 1);
            this.libNames.push(libName.join(":"));
        }
        this.main_class = data.mainClass;
        if (data?.arguments?.jvm) this.modded_args_game = data.arguments.game;
        if (data?.arguments?.jvm) this.modded_args_jvm = data.arguments.jvm;
    }
    async installForge(mcversion, forgeversion, isRepair) {
        ipcRenderer.send('progress-update', "Downloading Forge", 0, "Downloading Forge installer...");
        const forgeInstallerUrl = `https://maven.minecraftforge.net/net/minecraftforge/forge/${mcversion}-${forgeversion}/forge-${mcversion}-${forgeversion}-installer.jar`;
        const forgeMetaDir = path.resolve(__dirname, `minecraft/meta/forge/${mcversion}/${forgeversion}`);
        const forgeLibDir = `./minecraft/meta/libraries`;
        fs.mkdirSync(forgeMetaDir, { recursive: true });
        fs.mkdirSync(forgeLibDir, { recursive: true });

        const installerPath = `${forgeMetaDir}/forge-installer.jar`;
        await urlToFile(forgeInstallerUrl, installerPath);

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

        fs.writeFileSync(`./minecraft/meta/forge/${mcversion}/${forgeversion}/forge-${mcversion}-${forgeversion}.json`, JSON.stringify(version_json));
        fs.writeFileSync(`./minecraft/meta/forge/${mcversion}/${forgeversion}/forge-${mcversion}-${forgeversion}-install-profile.json`, JSON.stringify(install_profile_json));

        this.modded_args_game = version_json?.arguments?.game ? version_json.arguments.game : [];
        this.modded_args_jvm = version_json?.arguments?.jvm ? version_json.arguments.jvm.map(e => {
            e = e.replaceAll("${library_directory}", path.resolve(__dirname, `minecraft/instances/${this.instance_id}/libraries`));
            e = e.replaceAll("${classpath_separator}", ";");
            e = e.replaceAll("${version_name}", `${mcversion}-forge-${forgeversion}`);
            return e;
        }) : [];

        let java = new Java();
        let installation = await java.getJavaInstallation(21);

        fs.mkdirSync(`./minecraft/instances/${this.instance_id}`, { recursive: true });

        fs.writeFileSync(path.resolve(__dirname, `minecraft/instances/${this.instance_id}/launcher_profiles.json`), "{}");
        fs.writeFileSync(path.resolve(__dirname, `minecraft/instances/${this.instance_id}/launcher_profiles_microsoft_store.json`), "{}");

        ipcRenderer.send('progress-update', "Downloading Forge", 20, "Running Forge Installer");

        let args = ["-jar", installerPath];

        let compareVersions = (v1, v2) => {
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
        const lowerBound = "7.8.0.684";
        const upperBound = "14.23.5.2851";

        if (compareVersions(forgeversion, lowerBound) >= 0 && compareVersions(forgeversion, upperBound) <= 0) {
            let forge_library_path = install_profile_json.install.filePath;
            let name_items = install_profile_json.install.path.split(":");
            let package_ = name_items[0];
            let name = name_items[1];
            let version = name_items[2].split("@")[0];
            let installation_path = `${package_.replace(".", "/")}/${name}/${version}`;
            installation_path = path.resolve(__dirname, "minecraft/meta/libraries", installation_path);
            let installation_path_w_file = path.resolve(installation_path, forge_library_path);
            if (!fs.existsSync(installation_path_w_file) || isRepair) {
                zip.extractEntryTo(forge_library_path, installation_path);
            }

            this.libs += installation_path_w_file + ";";

            for (let i = 0; i < install_profile_json.versionInfo.libraries.length; i++) {
                let entry = install_profile_json.versionInfo.libraries[i];
                if (entry.name == install_profile_json.install.path) {
                    // hi
                } else if (entry.url && !entry.url.includes("https://libraries.minecraft.net/")) {
                    let fileName = entry.name.split(":");
                    fileName.splice(0, 1);
                    fileName = fileName.join("-") + ".jar";
                    let patha = entry.name.split(":");
                    patha[0] = patha[0].replaceAll(".", "/");
                    patha = patha.join("/") + "/" + fileName;
                    if (!fs.existsSync(`./minecraft/meta/libraries/${patha}`) || isRepair) {
                        await urlToFile(`${entry.url}${patha}`, `./minecraft/meta/libraries/${patha}`);
                    }
                    this.libs += path.resolve(__dirname, `minecraft/meta/libraries/${patha}`) + ";";
                    let libName = entry.name.split(":");
                    libName.splice(libName.length - 1, 1);
                    this.libNames.push(libName.join(":"));
                } else if (!entry.url) {
                    let fileName = entry.name.split(":");
                    fileName.splice(0, 1);
                    fileName = fileName.join("-") + ".jar";
                    let patha = entry.name.split(":");
                    patha[0] = patha[0].replaceAll(".", "/");
                    patha = patha.join("/") + "/" + fileName;
                    if (!fs.existsSync(`./minecraft/meta/libraries/${patha}`) || isRepair) {
                        await urlToFile(`https://maven.creeperhost.net/${patha}`, `./minecraft/meta/libraries/${patha}`);
                    }
                    this.libs += path.resolve(__dirname, `minecraft/meta/libraries/${patha}`) + ";";
                    let libName = entry.name.split(":");
                    libName.splice(libName.length - 1, 1);
                    this.libNames.push(libName.join(":"));
                }
            }
            this.main_class = install_profile_json.versionInfo.mainClass;
            this.legacy_modded_arguments = install_profile_json.versionInfo.minecraftArguments;
            this.modded_jarfile = path.resolve(__dirname, `minecraft/instances/${this.instance_id}/versions/${mcversion}/${mcversion}.jar`);
        } else if (compareVersions(forgeversion, upperBound) > 0) {
            args = args.concat("--installClient", path.resolve(__dirname, `minecraft/instances/${this.instance_id}`));
            await new Promise((resolve, reject) => {
                const installer = spawn(installation, args, {
                    "cwd": `./minecraft/instances/${this.instance_id}`
                });

                installer.stdout.on('data', data => {
                    console.log(`${data}`);
                });
                installer.stderr.on('data', data => console.error(`Installer Error: ${data}`));

                installer.on('close', code => {
                    if (code === 0) resolve();
                    else reject(new Error(`Forge installer exited with code ${code}`));
                });
            });
            let forge_version_info = fs.readFileSync(`./minecraft/instances/${this.instance_id}/versions/${mcversion}-forge-${forgeversion}/${mcversion}-forge-${forgeversion}.json`)
            forge_version_info = JSON.parse(forge_version_info);
            let libraries = forge_version_info.libraries;
            let lib_paths = libraries.map(e => path.resolve(__dirname, `minecraft/instances/${this.instance_id}/libraries`, e.downloads.artifact.path));
            this.libs = [...(new Set(this.libs))];
            this.libs = lib_paths.join(";") + ";";
            this.libNames = libraries.map(e => {
                let libName = e.name.split(":");
                libName.splice(libName.length - 1, 1);
                return libName.join(":");
            });
            this.main_class = version_json.mainClass;
            this.modded_jarfile = path.resolve(__dirname, `minecraft/instances/${this.instance_id}/versions/${mcversion}-forge-${forgeversion}/${mcversion}-forge-${forgeversion}.jar`);
            if (forge_version_info.minecraftArguments) {
                this.modded_jarfile = path.resolve(__dirname, `minecraft/instances/${this.instance_id}/versions/${mcversion}/${mcversion}.jar`);
                this.legacy_modded_arguments = forge_version_info.minecraftArguments;
            }
        }

        ipcRenderer.send('progress-update', "Downloading Forge", 100, "Forge install complete.");
    }
    async installNeoForge(mcversion, neoforgeversion, isRepair) {
        ipcRenderer.send('progress-update', "Downloading NeoForge", 0, "Downloading NeoForge installer...");
        const neoForgeInstallerUrl = `https://maven.neoforged.net/releases/net/neoforged/neoforge/${neoforgeversion}/neoforge-${neoforgeversion}-installer.jar`;
        const neoForgeMetaDir = path.resolve(__dirname, `minecraft/meta/neoforge/${mcversion}/${neoforgeversion}`);
        const neoForgeLibDir = `./minecraft/meta/libraries`;
        fs.mkdirSync(neoForgeMetaDir, { recursive: true });
        fs.mkdirSync(neoForgeLibDir, { recursive: true });

        const installerPath = `${neoForgeMetaDir}/neoforge-installer.jar`;
        await urlToFile(neoForgeInstallerUrl, installerPath);

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

        fs.writeFileSync(`./minecraft/meta/neoforge/${mcversion}/${neoforgeversion}/neoforge-${mcversion}-${neoforgeversion}.json`, JSON.stringify(version_json));
        fs.writeFileSync(`./minecraft/meta/neoforge/${mcversion}/${neoforgeversion}/neoforge-${mcversion}-${neoforgeversion}-install-profile.json`, JSON.stringify(install_profile_json));

        this.modded_args_game = version_json?.arguments?.game ? version_json.arguments.game : [];
        this.modded_args_jvm = version_json?.arguments?.jvm ? version_json.arguments.jvm.map(e => {
            e = e.replaceAll("${library_directory}", path.resolve(__dirname, `minecraft/instances/${this.instance_id}/libraries`));
            e = e.replaceAll("${classpath_separator}", ";");
            e = e.replaceAll("${version_name}", `${mcversion}-neoforge-${neoforgeversion}`);
            return e;
        }) : [];

        let java = new Java();
        let installation = await java.getJavaInstallation(21);

        fs.mkdirSync(`./minecraft/instances/${this.instance_id}`, { recursive: true });

        fs.writeFileSync(path.resolve(__dirname, `minecraft/instances/${this.instance_id}/launcher_profiles.json`), "{}");
        fs.writeFileSync(path.resolve(__dirname, `minecraft/instances/${this.instance_id}/launcher_profiles_microsoft_store.json`), "{}");

        ipcRenderer.send('progress-update', "Downloading NeoForge", 20, "Running NeoForge Installer");

        let args = ["-jar", installerPath];

        args = args.concat("--installClient", path.resolve(__dirname, `minecraft/instances/${this.instance_id}`));
        await new Promise((resolve, reject) => {
            const installer = spawn(installation, args, {
                "cwd": `./minecraft/instances/${this.instance_id}`
            });

            installer.stdout.on('data', data => {
                console.log(`${data}`);
            });
            installer.stderr.on('data', data => console.error(`Installer Error: ${data}`));

            installer.on('close', code => {
                if (code === 0) resolve();
                else reject(new Error(`NeoForge installer exited with code ${code}`));
            });
        });
        let forge_version_info = fs.readFileSync(`./minecraft/instances/${this.instance_id}/versions/neoforge-${neoforgeversion}/neoforge-${neoforgeversion}.json`)
        forge_version_info = JSON.parse(forge_version_info);
        let libraries = forge_version_info.libraries;
        let lib_paths = libraries.map(e => path.resolve(__dirname, `minecraft/instances/${this.instance_id}/libraries`, e.downloads.artifact.path));
        this.libs = [...(new Set(this.libs))];
        this.libs = lib_paths.join(";") + ";";
        this.libNames = libraries.map(e => {
            let libName = e.name.split(":");
            libName.splice(libName.length - 1, 1);
            return libName.join(":");
        });
        this.main_class = version_json.mainClass;
        this.modded_jarfile = path.resolve(__dirname, `minecraft/instances/${this.instance_id}/versions/neoforge-${neoforgeversion}/neoforge-${neoforgeversion}.jar`)

        ipcRenderer.send('progress-update', "Downloading NeoForge", 100, "NeoForge install complete.");
    }
    async launchGame(loader, version, loaderVersion, username, uuid, auth, customResolution, quickPlay, isDemo, allocatedRam, javaPath, javaArgs, envVars, preLaunch, wrapper, postExit) {
        if (!javaArgs || !javaArgs.length) javaArgs = ["-Xms" + allocatedRam + "M", "-Xmx" + allocatedRam + "M", "-XX:+UnlockExperimentalVMOptions", "-XX:+UseG1GC", "-XX:G1NewSizePercent=20", "-XX:G1ReservePercent=20", "-XX:MaxGCPauseMillis=50", "-XX:G1HeapRegionSize=32M", "-Dlog4j.configurationFile=" + path.resolve(__dirname, "log_config.xml")];
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
        } else if (loader == "quilt") {
            if (!fs.existsSync(`./minecraft/meta/quilt/${version}/${loaderVersion}/quilt-${version}-${loaderVersion}.json`)) {
                await this.installQuilt(version, loaderVersion);
            } else {
                let quilt_json = fs.readFileSync(`./minecraft/meta/quilt/${version}/${loaderVersion}/quilt-${version}-${loaderVersion}.json`);
                quilt_json = JSON.parse(quilt_json);
                this.main_class = quilt_json.mainClass;
                if (quilt_json.arguments?.game) this.modded_args_game = quilt_json.arguments.game;
                if (quilt_json.arguments?.jvm) this.modded_args_jvm = quilt_json.arguments.jvm;
                for (let i = 0; i < quilt_json.libraries.length; i++) {
                    let fileName = quilt_json.libraries[i].name.split(":");
                    fileName.splice(0, 1);
                    fileName = fileName.join("-") + ".jar";
                    let patha = quilt_json.libraries[i].name.split(":");
                    patha[0] = patha[0].replaceAll(".", "/");
                    patha = patha.join("/") + "/" + fileName;
                    this.libs += path.resolve(__dirname, `minecraft/meta/libraries/${patha}`) + ";";
                    let libName = quilt_json.libraries[i].name.split(":");
                    libName.splice(libName.length - 1, 1);
                    this.libNames.push(libName.join(":"));
                }
            }
        } else if (loader == "forge") {
            if (!fs.existsSync(`./minecraft/meta/forge/${version}/${loaderVersion}/forge-${version}-${loaderVersion}.json`)) {
                await this.installForge(version, loaderVersion);
            } else {
                let compareVersions = (v1, v2) => {
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
                const lowerBound = "7.8.0.684";
                const upperBound = "14.23.5.2851";

                if (compareVersions(loaderVersion, lowerBound) >= 0 && compareVersions(loaderVersion, upperBound) <= 0) {
                    let install_profile_json = JSON.parse(fs.readFileSync(`./minecraft/meta/forge/${version}/${loaderVersion}/forge-${version}-${loaderVersion}-install-profile.json`));
                    let forge_library_path = install_profile_json.install.filePath;
                    let name_items = install_profile_json.install.path.split(":");
                    let package_ = name_items[0];
                    let name = name_items[1];
                    let version_ = name_items[2].split("@")[0];
                    let installation_path = `${package_.replace(".", "/")}/${name}/${version_}`;
                    installation_path = path.resolve(__dirname, "minecraft/meta/libraries", installation_path);
                    let installation_path_w_file = path.resolve(installation_path, forge_library_path);

                    this.libs += installation_path_w_file + ";";

                    for (let i = 0; i < install_profile_json.versionInfo.libraries.length; i++) {
                        let entry = install_profile_json.versionInfo.libraries[i];
                        if (entry.name == install_profile_json.install.path) {
                            // hi
                        } else if (entry.url && !entry.url.includes("https://libraries.minecraft.net/")) {
                            let fileName = entry.name.split(":");
                            fileName.splice(0, 1);
                            fileName = fileName.join("-") + ".jar";
                            let patha = entry.name.split(":");
                            patha[0] = patha[0].replaceAll(".", "/");
                            patha = patha.join("/") + "/" + fileName;
                            this.libs += path.resolve(__dirname, `minecraft/meta/libraries/${patha}`) + ";";
                            let libName = entry.name.split(":");
                            libName.splice(libName.length - 1, 1);
                            this.libNames.push(libName.join(":"));
                        } else if (!entry.url) {
                            let fileName = entry.name.split(":");
                            fileName.splice(0, 1);
                            fileName = fileName.join("-") + ".jar";
                            let patha = entry.name.split(":");
                            patha[0] = patha[0].replaceAll(".", "/");
                            patha = patha.join("/") + "/" + fileName;
                            this.libs += path.resolve(__dirname, `minecraft/meta/libraries/${patha}`) + ";";
                            let libName = entry.name.split(":");
                            libName.splice(libName.length - 1, 1);
                            this.libNames.push(libName.join(":"));
                        }
                    }
                    this.main_class = install_profile_json.versionInfo.mainClass;
                    this.legacy_modded_arguments = install_profile_json.versionInfo.minecraftArguments;
                    this.modded_jarfile = path.resolve(__dirname, `minecraft/instances/${this.instance_id}/versions/${version}/${version}.jar`);
                    this.modded_args_game = [];
                    this.modded_args_jvm = [];
                } else if (compareVersions(loaderVersion, upperBound) > 0) {
                    let forge_version_info = fs.readFileSync(`./minecraft/instances/${this.instance_id}/versions/${version}-forge-${loaderVersion}/${version}-forge-${loaderVersion}.json`)
                    forge_version_info = JSON.parse(forge_version_info);
                    let libraries = forge_version_info.libraries;
                    let lib_paths = libraries.map(e => path.resolve(__dirname, `minecraft/instances/${this.instance_id}/libraries`, e.downloads.artifact.path));
                    this.libs = [...(new Set(this.libs))];
                    this.libs = lib_paths.join(";") + ";";
                    this.libNames = libraries.map(e => {
                        let libName = e.name.split(":");
                        libName.splice(libName.length - 1, 1);
                        return libName.join(":");
                    });
                    this.main_class = forge_version_info.mainClass;
                    this.modded_jarfile = path.resolve(__dirname, `minecraft/instances/${this.instance_id}/versions/${version}-forge-${loaderVersion}/${version}-forge-${loaderVersion}.jar`);
                    this.modded_args_game = forge_version_info?.arguments?.game ? forge_version_info.arguments.game : [];
                    this.modded_args_jvm = forge_version_info?.arguments?.jvm ? forge_version_info.arguments.jvm.map(e => {
                        e = e.replaceAll("${library_directory}", path.resolve(__dirname, `minecraft/instances/${this.instance_id}/libraries`));
                        e = e.replaceAll("${classpath_separator}", ";");
                        e = e.replaceAll("${version_name}", `${version}-forge-${loaderVersion}`);
                        return e;
                    }) : [];
                    if (forge_version_info.minecraftArguments) {
                        this.modded_jarfile = path.resolve(__dirname, `minecraft/instances/${this.instance_id}/versions/${version}/${version}.jar`);
                        this.legacy_modded_arguments = forge_version_info.minecraftArguments;
                    }
                }
            }
        } else if (loader == "neoforge") {
            if (!fs.existsSync(`./minecraft/meta/neoforge/${version}/${loaderVersion}/neoforge-${version}-${loaderVersion}.json`)) {
                await this.installNeoForge(version, loaderVersion);
            } else {
                let neo_forge_version_info = fs.readFileSync(`./minecraft/instances/${this.instance_id}/versions/neoforge-${loaderVersion}/neoforge-${loaderVersion}.json`)
                neo_forge_version_info = JSON.parse(neo_forge_version_info);
                let libraries = neo_forge_version_info.libraries;
                let lib_paths = libraries.map(e => path.resolve(__dirname, `minecraft/instances/${this.instance_id}/libraries`, e.downloads.artifact.path));
                this.libs = [...(new Set(this.libs))];
                this.libs = lib_paths.join(";") + ";";
                this.libNames = libraries.map(e => {
                    let libName = e.name.split(":");
                    libName.splice(libName.length - 1, 1);
                    return libName.join(":");
                });
                this.main_class = neo_forge_version_info.mainClass;
                this.modded_jarfile = path.resolve(__dirname, `minecraft/instances/${this.instance_id}/versions/neoforge-${loaderVersion}/neoforge-${loaderVersion}.jar`);
                this.modded_args_game = neo_forge_version_info?.arguments?.game ? neo_forge_version_info.arguments.game : [];
                this.modded_args_jvm = neo_forge_version_info?.arguments?.jvm ? neo_forge_version_info.arguments.jvm.map(e => {
                    e = e.replaceAll("${library_directory}", path.resolve(__dirname, `minecraft/instances/${this.instance_id}/libraries`));
                    e = e.replaceAll("${classpath_separator}", ";");
                    e = e.replaceAll("${version_name}", `${version}-neoforge-${loaderVersion}`);
                    return e;
                }) : [];
            }
        }
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
        this.java_installation = javaPath ? javaPath : await java.getJavaInstallation(version_json.javaVersion.majorVersion);
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
            if (this.modded_args_jvm_top) args = args.concat(this.modded_args_jvm_top);
            args.push("-Dlog4j2.formatMsgNoLookups=true");
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
                this.args = this.legacy_modded_arguments.split(" ");
            }
            if (platformString == "windows") {
                args.push("-XX:HeapDumpPath=MojangTricksIntelDriversForPerformance_javaw.exe_minecraft.exe.heapdump");
            } else if (platformString == "osx") {
                args.push("-XstartOnFirstThread");
            }
            if (arch == "x86") {
                args.push("-Xss1M");
            }
            args.push("-Dlog4j2.formatMsgNoLookups=true");
            args.push("-Djava.library.path=" + path.resolve(__dirname, `minecraft/meta/natives/${this.instance_id}-${version}`));
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
        let LOG_PATH = path.resolve(__dirname, `minecraft/instances/${this.instance_id}/logs/${fileFormatDate(new Date())}.log`);
        fs.mkdirSync(path.dirname(LOG_PATH), { recursive: true });
        let fd = fs.openSync(LOG_PATH, 'w');
        fs.closeSync(fd);
        let child;
        if (preLaunch) {
            execSync(preLaunch, { stdio: "inherit" });
        }
        if (wrapper && wrapper.length) {
            let fullCommand = wrapper.concat([this.java_installation]).concat(args);
            child = spawn(fullCommand[0], fullCommand.slice(1), {
                env: {
                    ...process.env,
                    ...envVars
                },
                cwd: `./minecraft/instances/${this.instance_id}`,
                detached: true,
                stdio: ['ignore', fs.openSync(LOG_PATH, 'a'), fs.openSync(LOG_PATH, 'a')],
                shell: true
            });
        } else {
            child = spawn(this.java_installation, args, {
                env: {
                    ...process.env,
                    ...envVars
                },
                cwd: `./minecraft/instances/${this.instance_id}`,
                detached: true,
                stdio: ['ignore', fs.openSync(LOG_PATH, 'a'), fs.openSync(LOG_PATH, 'a')]
            });
        }

        child.once('error', (err) => {
            if (err.code === 'ENOENT') {
                ipcRenderer.send('display-error', "Unable to launch Minecraft");
            } else {
                ipcRenderer.send('display-error', "Unable to launch Minecraft (" + err + ")");
            }
        });

        child.on("exit", (code) => {
            if (postExit) {
                execSync(postExit, { stdio: "inherit" });
            }
        });

        child.unref();
        return { "pid": child.pid, "log": LOG_PATH, "java_path": this.java_installation, "java_version": this.java_version };
    }
    async downloadGame(loader, version, isRepair) {
        if (!this.libNames) this.libNames = [];
        try {
            ipcRenderer.send('progress-update', "Downloading Minecraft", 0, "Creating directories...");
            fs.mkdirSync(`./minecraft/instances/${this.instance_id}/versions/${version}`, { recursive: true });
            fs.mkdirSync(`./minecraft/meta/natives/${this.instance_id}-${version}`, { recursive: true });
            fs.mkdirSync(`./minecraft/instances/${this.instance_id}/logs`, { recursive: true });
            let files = [`./minecraft/instances/${this.instance_id}/versions/${version}/${version}.jar`]
            files.forEach((e) => {
                if (isRepair && fs.existsSync(e)) fs.unlinkSync(e);
                const fd = fs.openSync(e, 'w');
                fs.closeSync(fd);
            });
            this.version = version;
            ipcRenderer.send('progress-update', "Downloading Minecraft", 2, "Downloading version list...");
            const obtainVersionManifest = await fetch("https://launchermeta.mojang.com/mc/game/version_manifest.json");
            const version_manifest = await obtainVersionManifest.json();
            let version_json = {};
            for (let i = 0; i < version_manifest.versions.length; i++) {
                if (version_manifest.versions[i].id == version) {
                    ipcRenderer.send('progress-update', "Downloading Minecraft", 3, "Downloading version info...");
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
            ipcRenderer.send('progress-update', "Downloading Minecraft", 5, "Downloading asset info...");
            const assetJSON = await fetch(version_json.assetIndex.url);
            let asset_json = await assetJSON.json();
            fs.mkdirSync(`./minecraft/meta/assets/indexes`, { recursive: true });
            fs.mkdirSync(`./minecraft/meta/assets/objects`, { recursive: true });
            fs.writeFileSync(`./minecraft/meta/assets/indexes/${version_json.assets}.json`, JSON.stringify(asset_json));
            let assetKeys = Object.keys(asset_json.objects);
            for (let i = 0; i < assetKeys.length; i++) {
                ipcRenderer.send('progress-update', "Downloading Minecraft", ((i + 1) / assetKeys.length) * 30 + 5, `Downloading asset ${i + 1} of ${assetKeys.length}...`);
                let asset_data = asset_json.objects[assetKeys[i]];
                if (version_json.assets == "legacy") {
                    if (!fs.existsSync(`./minecraft/meta/assets/legacy/${assetKeys[i]}`) || isRepair) {
                        await urlToFile(`https://resources.download.minecraft.net/${asset_data.hash.substring(0, 2)}/${asset_data.hash}`, `./minecraft/meta/assets/legacy/${assetKeys[i]}`);
                    }
                } else if (version_json.assets == "pre-1.6") {
                    if (!fs.existsSync(`./minecraft/instances/${this.instance_id}/resources/${assetKeys[i]}`) || isRepair) {
                        await urlToFile(`https://resources.download.minecraft.net/${asset_data.hash.substring(0, 2)}/${asset_data.hash}`, `./minecraft/instances/${this.instance_id}/resources/${assetKeys[i]}`);
                    }
                } else {
                    if (!fs.existsSync(`./minecraft/meta/assets/objects/${asset_data.hash.substring(0, 2)}/${asset_data.hash}`) || isRepair) {
                        await urlToFile(`https://resources.download.minecraft.net/${asset_data.hash.substring(0, 2)}/${asset_data.hash}`, `./minecraft/meta/assets/objects/${asset_data.hash.substring(0, 2)}/${asset_data.hash}`);
                    }
                }
            }
            this.asset_dir = version_json.assets == "legacy" ? path.resolve(__dirname, "minecraft/meta/assets/legacy") : version_json.assets == "pre-1.6" ? path.resolve(__dirname, `minecraft/instances/${this.instance_id}/resources`) : path.resolve(__dirname, "minecraft/meta/assets");
            ipcRenderer.send('progress-update', "Downloading Minecraft", 40, "Downloading version jar...");
            await urlToFile(version_json.downloads.client.url, `./minecraft/instances/${this.instance_id}/versions/${version}/${version}.jar`);
            this.jarfile = path.resolve(__dirname, `minecraft/instances/${this.instance_id}/versions/${version}/${version}.jar`);
            let java = new Java();
            let paths = "";
            ipcRenderer.send('progress-update', "Downloading Minecraft", 45, "Checking for java...");
            this.java_installation = await java.getJavaInstallation(version_json.javaVersion.majorVersion, isRepair);
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
            ipcRenderer.send('progress-update', "Downloading Minecraft", 60, "Starting library download...");
            libs: for (let i = 0; i < version_json.libraries.length; i++) {
                ipcRenderer.send('progress-update', "Downloading Minecraft", ((i + 1) / version_json.libraries.length) * 40 + 60, `Downloading library ${i + 1} of ${version_json.libraries.length}`);
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
                    if (!fs.existsSync(`./minecraft/meta/libraries/${version_json.libraries[i].downloads.artifact.path}`) || isRepair) {
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
                    if (!fs.existsSync(`./minecraft/meta/libraries/${version_json.libraries[i].downloads.classifiers[version_json.libraries[i].natives[platformString].replace("${arch}", simpleArch)].path}`) || isRepair) {
                        await urlToFile(version_json.libraries[i].downloads.classifiers[version_json.libraries[i].natives[platformString].replace("${arch}", simpleArch)].url, `./minecraft/meta/libraries/${version_json.libraries[i].downloads.classifiers[version_json.libraries[i].natives[platformString].replace("${arch}", simpleArch)].path}`);
                    }
                    let libName = version_json.libraries[i].name.split(":");
                    libName.splice(libName.length - 1, 1);
                    libName = libName.join(":");
                    if (!this.libNames?.includes(libName)) {
                        paths += path.resolve(__dirname, `minecraft/meta/libraries/${version_json.libraries[i].downloads.classifiers[version_json.libraries[i].natives[platformString].replace("${arch}", simpleArch)].path}`) + ";";
                    }
                    this.libNames.push(libName);
                    await extractJar(`./minecraft/meta/libraries/${version_json.libraries[i].downloads.classifiers[version_json.libraries[i].natives[platformString].replace("${arch}", simpleArch)].path}`, `./minecraft/meta/natives/${this.instance_id}-${version}`);
                }
            }
            this.libs += paths;
            return { "java_installation": this.java_installation, "java_version": this.java_version };
        } catch (err) {
            console.error('Error in download chain:', err);
        }
        ipcRenderer.send('progress-update', "Downloading Minecraft", 100, "Done");
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
    async downloadJava(version, isRepair) {
        ipcRenderer.send('progress-update', "Downloading Java", 0, "Starting java download...");
        const installDir = `./java/java-${version}`;
        const platform = os.platform(); // 'win32', 'linux', 'darwin'
        const arch = os.arch(); // 'x64', 'arm64', etc.
        const getPlatformString = () => {
            if (platform === 'win32') return 'windows';
            if (platform === 'darwin') return 'macos';
            return 'linux';
        };
        const versionApi = `https://api.azul.com/metadata/v1/zulu/packages/?java_version=${version}&os=${getPlatformString()}&arch=${arch}&archive_type=zip&java_package_type=jre&javafx_bundled=false&latest=true`;

        ipcRenderer.send('progress-update', "Downloading Java", 5, "Fetching java version info...");
        const res = await fetch(versionApi);
        const data = await res.json();

        if (!data.length) {
            throw new Error('No JRE binaries found.');
        }

        const binary = data[0];
        const downloadUrl = binary.download_url;
        const fileName = path.basename(downloadUrl);
        const downloadPath = "./java/" + fileName;

        ipcRenderer.send('progress-update', "Downloading Java", 10, "Fetching java zip...");
        await urlToFile(downloadUrl, downloadPath);
        ipcRenderer.send('progress-update', "Downloading Java", 60, "Extracting java zip...");
        let name = "";
        if (fileName.endsWith('.zip')) {
            const zip = new AdmZip(downloadPath);
            zip.extractAllTo(installDir, true);
            const items = fs.readdirSync(installDir, { withFileTypes: true });
            const dirs = items.filter(item => item.isDirectory());

            name = dirs[dirs.length - 1].name;
        } else {
            throw new Error("Isn't a .zip file?");
        }
        ipcRenderer.send('progress-update', "Downloading Java", 95, "Deleting old zip...");

        fs.unlinkSync(downloadPath);
        ipcRenderer.send('progress-update', "Downloading Java", 98, "Remembering version...");
        this.versions["java-" + version] = path.resolve(__dirname, `java/java-${version}/${name}/bin/javaw.exe`);
        fs.writeFileSync("./java/versions.json", JSON.stringify(this.versions), 'utf-8');
        ipcRenderer.send('progress-update', "Downloading Java", 100, "Done");
    }
    async getJavaInstallation(version, isRepair) {
        if (!this.versions["java-" + version] || isRepair) {
            await this.downloadJava(version, isRepair);
        }
        return this.versions["java-" + version];
    }
    async setJavaInstallation(version, file_path) {
        if (this.versions["java-" + version] == file_path) return;
        this.versions["java-" + version] = file_path;
        fs.writeFileSync("./java/versions.json", JSON.stringify(this.versions), 'utf-8');
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

// New function: downloads a file from a URL to a folder, using the filename from the URL
function urlToFolder(url, folder, redirectCount = 0) {
    return new Promise((resolve, reject) => {
        if (redirectCount > 5) {
            return reject(new Error('Too many redirects'));
        }

        const parsedUrl = urlModule.parse(url);
        const protocol = parsedUrl.protocol === 'https:' ? https : http;
        const fileName = path.basename(parsedUrl.pathname);
        const filepath = path.join(folder, fileName);

        fs.mkdirSync(folder, { recursive: true });

        const file = fs.createWriteStream(filepath);

        const request = protocol.get(url, (response) => {
            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                // Handle redirect
                const redirectUrl = new URL(response.headers.location, url).href;
                file.close();
                fs.unlink(filepath, () => {
                    urlToFolder(redirectUrl, folder, redirectCount + 1)
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
                file.close(() => resolve(fileName));
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
    let hms = ["00", "01", "02", "03", "04", "05", "06", "07", "08", "09", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "30", "31", "32", "33", "34", "35", "36", "37", "38", "39", "40", "41", "42", "43", "44", "45", "46", "47", "48", "49", "50", "51", "52", "53", "54", "55", "56", "57", "58", "59"];
    return date.getFullYear() + "-" + m[date.getMonth()] + "-" + d[date.getDate()] + "_" + hms[date.getHours()] + "-" + hms[date.getMinutes()] + "-" + hms[date.getSeconds()];
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

    // Returns a list of supported vanilla Minecraft versions for Forge
    async getSupportedVanillaVersions() {
        // Use the Forge version manifest
        const res = await fetch('https://files.minecraftforge.net/net/minecraftforge/forge/maven-metadata.json');
        const data = await res.json();

        // The manifest contains an array of versions, filter out non-standard ones
        // Only include versions that look like vanilla Minecraft versions (e.g., "1.20.1")
        let versions = Object.keys(data)
            .filter(v => /^\d+\.\d+(\.\d+)?$/.test(v));
        versions = versions.filter(e => !["1.5.1", "1.5", "1.4.7", "1.4.6", "1.4.5", "1.4.4", "1.4.3", "1.4.2", "1.4.1", "1.4.0", "1.3.2", "1.2.5", "1.2.4", "1.2.3", "1.1"].includes(e));
        return versions.reverse();
    }

    // Returns a list of Forge loader versions for a given vanilla version
    async getVersions(mcVersion) {

        const url = `https://files.minecraftforge.net/net/minecraftforge/forge/maven-metadata.json`;
        const res = await fetch(url);
        const data = await res.json();

        const forgeVersions = data[mcVersion].map(e => {
            let split = e.split("-");
            split.splice(0, 1);
            return split.join("-");
        });

        return forgeVersions;
    }
}
class Quilt {
    constructor() { }
    async getSupportedVanillaVersions() {
        const res = await fetch('https://meta.quiltmc.org/v3/versions/game');
        const data = await res.json();
        let versions = data.map(e => e.version);
        versions = versions.filter(e => !e.includes("combat") && !e.includes(" ") && !e.includes("experiment") && !e.includes("original"));
        return versions;
    }
    async getVersions(mcVersion) {
        const res = await fetch(`https://meta.quiltmc.org/v3/versions/loader/${mcVersion}`);
        const data = await res.json();
        return data.map(e => e.loader.version);
    }
}

class NeoForge {
    constructor() { }
    async getSupportedVanillaVersions() {

        const res = await fetch('https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge');
        const data = (await res.json()).versions;

        let versions = [];

        for (let i = 0; i < data.length; i++) {
            let versionNumber = "";
            let split = data[i].split(".");
            if (split[0] == "0") {
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

    async getVersions(mcVersion) {
        let start0 = "0";
        let start1 = mcVersion;
        let split = mcVersion.split(".");
        if (split.length >= 2) {
            start0 = split[1];
            start1 = split[2] ?? "0";
        }
        const res = await fetch('https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge');
        const data = (await res.json()).versions;
        let versions = [];
        for (let i = 0; i < data.length; i++) {
            let split = data[i].split(".");
            if (split[0] == start0 && split[1] == start1) {
                versions.push(data[i]);
            }
        }
        return versions.reverse();
    }
}

module.exports = {
    Minecraft,
    Java,
    Fabric,
    Forge,
    Quilt,
    NeoForge,
    urlToFile,
    urlToFolder
}