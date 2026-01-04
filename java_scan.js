const fs = require("fs");
const path = require("path");
const { promisify } = require("util");
const { execFile } = require("child_process");
const WinReg = require("winreg");
const os = require('os');

const execFileAsync = promisify(execFile);

const userPath = path.resolve(process.argv.find(arg => arg.startsWith('--userDataPath='))
    .split('=')[1]);

const JAVA_REGISTRY_PATHS = [
    "SOFTWARE\\JavaSoft\\Java Runtime Environment",
    "SOFTWARE\\JavaSoft\\Java Development Kit",
    "SOFTWARE\\JavaSoft\\JRE",
    "SOFTWARE\\JavaSoft\\JDK",
    "SOFTWARE\\Eclipse Foundation\\JDK",
    "SOFTWARE\\Eclipse Adoptium\\JRE",
    "SOFTWARE\\Eclipse Foundation\\JDK",
    "SOFTWARE\\Microsoft\\JDK",
];

const COMMON_JAVA_DIRS_WINDOWS = [
    "C:\\Program Files\\Java",
    "C:\\Program Files (x86)\\Java",
    "C:\\Program Files\\Eclipse Adoptium",
    "C:\\Program Files (x86)\\Eclipse Adoptium",
    path.resolve(userPath,"java")
];

const COMMON_JAVA_DIRS_UNIX = [
    "/usr/local/java",
    "/usr/lib/jvm",
    path.resolve(userPath,"java")
]

async function getJavaVersion(javawPath) {
    try {
        const { stderr } = await execFileAsync(javawPath, ["-version"]);
        const match = stderr.match(/version "(.+?)"/);
        return match ? match[1] : null;
    } catch {
        return null;
    }
}

function getJavaFromRegistry(root, arch) {
    return new Promise((resolve) => {
        const foundPaths = new Set();
        let pending = JAVA_REGISTRY_PATHS.length;
        if (pending === 0) return resolve(foundPaths);

        JAVA_REGISTRY_PATHS.forEach((keyPath) => {
            const regKey = new WinReg({
                hive: WinReg.HKLM,
                key: `\\${keyPath}`,
                arch,
            });

            regKey.keys((err, subkeys) => {
                if (!err && subkeys) {
                    subkeys.forEach((subkey) => {
                        subkey.get("JavaHome", (err, item) => {
                            if (!err && item?.value) {
                                foundPaths.add(path.join(item.value, "bin"));
                            }
                        });
                    });
                }
                if (--pending === 0) {
                    resolve(foundPaths);
                }
            });
        });
    });
}

async function findJavaInstallations(v) {
    const jrePaths = new Set();

    let platform = os.platform();
    let platformString = platform == "win32" ? "windows" : (platform == "darwin" ? "macos" : "linux");

    // From PATH
    const pathDirs = (process.env.PATH || "").split(platformString == "windows" ? ";" : ":");
    for (const dir of pathDirs) {
        if (dir.toLowerCase().includes("java")) {
            jrePaths.add(dir);
        }
    }

    // JAVA_HOME
    if (process.env.JAVA_HOME) {
        jrePaths.add(path.join(process.env.JAVA_HOME, "bin"));
    }

    // From known install locations
    for (const javaDir of platformString == "windows" ? COMMON_JAVA_DIRS_WINDOWS : COMMON_JAVA_DIRS_UNIX) {
        if (fs.existsSync(javaDir)) {
            const subdirs = fs.readdirSync(javaDir, { withFileTypes: true });
            for (const dirent of subdirs) {
                if (dirent.isDirectory()) {
                    const fullPath = path.join(javaDir, dirent.name, "bin");
                    if (fs.existsSync(path.join(fullPath, platformString == "windows" ? "javaw.exe" : "java"))) {
                        jrePaths.add(fullPath);
                    }
                    const subdirs2 = fs.readdirSync(path.join(javaDir, dirent.name), { withFileTypes: true });
                    for (const dirent2 of subdirs2) {
                        if (dirent2.isDirectory()) {
                            const fullPath = path.join(javaDir, dirent.name, dirent2.name, "bin");
                            if (fs.existsSync(path.join(fullPath, platformString == "windows" ? "javaw.exe" : "java"))) {
                                jrePaths.add(fullPath);
                            }
                        }
                    }
                }
            }
        }
    }

    if (platformString == "windows") {
        // From registry (both 32-bit and 64-bit views)
        const [reg32, reg64] = await Promise.all([
            getJavaFromRegistry(WinReg.HKLM, "x86"),
            getJavaFromRegistry(WinReg.HKLM, "x64"),
        ]);
        for (const p of [...reg32, ...reg64]) jrePaths.add(p);
    }

    // Validate all collected paths
    const javaResults = [];
    for (const binPath of jrePaths) {
        const javaw = path.join(binPath, platformString == "windows" ? "javaw.exe" : "java");
        if (fs.existsSync(javaw)) {
            const version = await getJavaVersion(javaw);
            if (version) {
                let split = version.split(".");
                let cleanVersion = split[0];
                if (cleanVersion == "1") cleanVersion = split[1];
                if (!v || Number(cleanVersion) >= v) {
                    javaResults.push({ path: javaw, version, major_version: Number(cleanVersion) });
                }
            }
        }
    }

    return javaResults;
}

class JavaSearch {
    async findJavaInstallations(v) {
        return await new Promise((resolve, reject) => {
            findJavaInstallations(v).then((e) => {
                resolve(e);
            }).catch((e) => {
                reject(e);
            })
        });
    }
}

module.exports = {
    JavaSearch
}