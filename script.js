let lang = null;
document.getElementsByTagName("title")[0].innerHTML = sanitize(translate("app.name"));

class SQL {
    constructor(sql) {
        this.sql = sql;
    }
    get(...params) {
        return window.electronAPI.databaseGet(this.sql, ...params);
    }
    run(...params) {
        return window.electronAPI.databaseRun(this.sql, ...params);
    }
    all(...params) {
        return window.electronAPI.databaseAll(this.sql, ...params);
    }
}

class DB {
    prepare(sql) {
        return new SQL(sql);
    }
}

const db = new DB();

let minecraftVersions = [];
let getMCVersions = () => {
    let mc_versions = db.prepare("SELECT * FROM mc_versions_cache").all();
    mc_versions.sort((a, b) => {
        return (new Date(a.date_published)).getTime() - (new Date(b.date_published)).getTime();
    });
    return mc_versions.map(e => e.name);
}
minecraftVersions = getMCVersions();

let fetchUpdatedMCVersions = async () => {
    let result_pre_json = await fetch(`https://launchermeta.mojang.com/mc/game/version_manifest.json`);
    let result = await result_pre_json.json();
    console.log("Setting default to " + result.latest.release);
    data.setDefault("latest_release", result.latest.release);
    let mc_versions = db.prepare('SELECT * FROM mc_versions_cache').all();
    let mc_version_names = mc_versions.map(e => e.name);
    for (let i = 0; i < result.versions.length; i++) {
        let e = result.versions[i];
        if (!mc_version_names.includes(e.id)) {
            db.prepare("INSERT INTO mc_versions_cache (name, date_published) VALUES (?, ?)").run(e.id, e.releaseTime);
        } else {
            mc_version_names.splice(mc_version_names.indexOf(e.id), 1);
        }
    }
    for (let i = 0; i < mc_version_names.length; i++) {
        let id = mc_version_names[i];
        db.prepare("DELETE FROM mc_versions_cache WHERE name = ?").run(id);
    }
    minecraftVersions = getMCVersions();
}

fetchUpdatedMCVersions();

let accent_colors = ["red", "orange", "yellow", "lime", "green", "light_blue", "cyan", "blue", "purple", "magenta", "pink", "brown", "light_gray", "gray"];

class DefaultOptions {
    constructor(v) {
        this.version = v;
    }

    getVersions() {
        let v = db.prepare("SELECT * FROM options_defaults WHERE key = ?").all("version");
        return v.map(e => e.version).filter(e => e);
    }

    checkDefault(key) {
        if (key == "version") {
            let default_ = db.prepare("SELECT * FROM options_defaults WHERE key = ? AND version = ?").get(key, this.version);
            if (!default_) {
                db.prepare("INSERT INTO options_defaults (key, value, version) VALUES (?, ?, ?)").run(key, "", this.version);
                return true;
            }
            return true;
        }
        let default_ = db.prepare("SELECT * FROM options_defaults WHERE key = ?").get(key);
        if (!default_) {
            db.prepare("INSERT INTO options_defaults (key, value) VALUES (?, ?)").run(key, "");
            return true;
        }
        return true;
    }

    getDefault(key) {
        let default_ = db.prepare("SELECT * FROM options_defaults WHERE key = ?").get(key);
        if (!default_) {
            return null;
        }
        return default_.value;
    }

    setDefault(key, value) {
        if (!this.checkDefault(key)) {
            return null;
        }
        if (key == "version") {
            db.prepare("UPDATE options_defaults SET value = ? WHERE key = ? AND version = ?").run(value, key, this.version);
            return;
        }
        db.prepare("UPDATE options_defaults SET value = ? WHERE key = ?").run(value, key);
    }

    deleteDefault(key) {
        db.prepare("DELETE FROM options_defaults WHERE key = ?").run(key);
    }

    getOptionsTXT(dataVersion) {
        let v;
        if (!dataVersion) {
            let thisIndex = minecraftVersions.indexOf(this.version);
            let versions = this.getVersions();
            let min_distance = 10000;
            let version_to_use = "something_not_null";
            if (versions.includes(this.version)) {
                version_to_use = this.version;
            } else {
                versions.forEach(e => {
                    let vIndex = minecraftVersions.indexOf(e);
                    if (vIndex > thisIndex) return;
                    if (thisIndex - vIndex < min_distance) {
                        min_distance = thisIndex - vIndex;
                        version_to_use = e;
                    }
                });
            }
            v = db.prepare("SELECT * FROM options_defaults WHERE key = ? AND version = ?").get("version", version_to_use);
        }
        let r = db.prepare("SELECT * FROM options_defaults WHERE NOT key = ?").all("version");
        let content = "";
        content = "version:" + (dataVersion ? dataVersion : (v?.value ? v?.value : "100")) + "\n";
        r.forEach(e => {
            content += e.key + ":" + e.value + "\n"
        });
        return { "content": content, "version": Number((dataVersion ? dataVersion : (v?.value ? v?.value : "100"))), "keys": r.map(e => e.key), "values": r.map(e => e.value) };
    }
}

class Skin {
    constructor(id) {
        let skin = db.prepare("SELECT * FROM skins WHERE id = ? LIMIT 1").get(id);
        if (!skin) throw new Error("Skin not found");
        this.id = skin.id;
        this.name = skin.name;
        this.model = skin.model;
        this.skin_id = skin.skin_id;
        this.active_uuid = skin.active_uuid;
        this.skin_url = skin.skin_url;
        this.default_skin = Boolean(skin.default_skin);
        this.texture_key = skin.texture_key;
    }

    setModel(model) {
        db.prepare("UPDATE skins SET model = ? WHERE id = ?").run(model, this.id);
        this.model = model;
    }

    setName(name) {
        db.prepare("UPDATE skins SET name = ? WHERE id = ?").run(name, this.id);
        this.name = name;
    }

    delete() {
        db.prepare("DELETE FROM skins WHERE id = ?").run(this.id);
    }

    setActive(uuid) {
        let old = db.prepare("SELECT * FROM skins WHERE active_uuid LIKE ?").all(`%;${uuid};%`);
        old.forEach((e) => {
            if (e.active_uuid.split(";").indexOf(uuid) == -1) return;
            db.prepare("UPDATE skins SET active_uuid = ? WHERE id = ?").run(e.active_uuid.split(";").toSpliced(e.active_uuid.split(";").indexOf(uuid), 1).join(";"), e.id);
        });
        let current = new Skin(this.id);
        let list = current.active_uuid.split(";");
        if (list.length == 1) {
            list = ["", ""];
        }
        list.splice(1, 0, uuid);
        db.prepare("UPDATE skins SET active_uuid = ? WHERE id = ?").run(list.join(";"), this.id);
    }
    removeActive(uuid) {
        let current = new Skin(this.id);
        let list = current.active_uuid.split(";");
        if (!list.includes(uuid)) return;
        list.splice(list.indexOf(uuid), 1)
        db.prepare("UPDATE skins SET active_uuid = ? WHERE id = ?").run(list.join(";"), this.id);
    }
}

class Cape {
    constructor(id) {
        let cape = db.prepare("SELECT * FROM capes WHERE id = ? LIMIT 1").get(id);
        if (!cape) throw new Error("Cape not found");
        this.id = cape.id;
        this.cape_name = cape.cape_name;
        this.uuid = cape.uuid;
        this.cape_id = cape.cape_id;
        this.cape_url = cape.cape_url;
        this.active = Boolean(cape.active);
    }

    delete() {
        db.prepare("DELETE FROM capes WHERE id = ?").run(this.id);
    }

    setActive() {
        let old = db.prepare("SELECT * FROM capes WHERE uuid = ? AND active = ?").all(this.uuid, Number(true));
        old.forEach((e) => {
            db.prepare("UPDATE capes SET active = ? WHERE id = ?").run(Number(false), e.id);
        });
        db.prepare("UPDATE capes SET active = ? WHERE id = ?").run(Number(true), this.id);
    }

    removeActive() {
        db.prepare("UPDATE capes SET active = ? WHERE id = ?").run(Number(false), this.id);
    }
}

class Content {
    constructor(id_or_instanceId, fileName) {
        let content;

        if (!fileName) {
            content = db.prepare("SELECT * FROM content WHERE id = ? LIMIT 1").get(id_or_instanceId);
        } else {
            content = db.prepare("SELECT * FROM content WHERE instance = ? AND file_name = ? LIMIT 1").get(id_or_instanceId, fileName);
        }

        if (!content) throw new Error("Content not found");

        this.id = content.id;
        this.name = content.name;
        this.author = content.author;
        this.disabled = Boolean(content.disabled);
        this.image = content.image;
        this.file_name = content.file_name;
        this.source = content.source;
        this.type = content.type;
        this.version = content.version;
        this.instance = content.instance;
        this.source_info = content.source_info;
        this.version_id = content.version_id;

        this.id_or_instanceId = id_or_instanceId;
        this.fileName = fileName;
    }

    refresh() {
        return new Content(this.id_or_instanceId, this.fileName);
    }

    setName(name) {
        db.prepare("UPDATE content SET name = ? WHERE id = ?").run(name, this.id);
        this.name = name;
    }
    setAuthor(author) {
        db.prepare("UPDATE content SET author = ? WHERE id = ?").run(author, this.id);
        this.author = author;
    }
    setDisabled(disabled) {
        db.prepare("UPDATE content SET disabled = ? WHERE id = ?").run(Number(disabled), this.id);
        this.disabled = disabled;
    }
    setImage(image) {
        db.prepare("UPDATE content SET image = ? WHERE id = ?").run(image, this.id);
        this.image = image;
    }
    setFileName(file_name) {
        db.prepare("UPDATE content SET file_name = ? WHERE id = ?").run(file_name, this.id);
        this.file_name = file_name;
    }
    setSource(source) {
        db.prepare("UPDATE content SET source = ? WHERE id = ?").run(source, this.id);
        this.source = source;
    }
    setType(type) {
        db.prepare("UPDATE content SET type = ? WHERE id = ?").run(type, this.id);
        this.type = type;
    }
    setVersion(version) {
        db.prepare("UPDATE content SET version = ? WHERE id = ?").run(version, this.id);
        this.version = version;
    }
    setVersionId(version_id) {
        db.prepare("UPDATE content SET version_id = ? WHERE id = ?").run(version_id, this.id);
        this.version_id = version_id;
    }
    setInstance(instance) {
        db.prepare("UPDATE content SET instance = ? WHERE id = ?").run(instance, this.id);
        this.instance = instance;
    }
    setSourceInfo(source_info) {
        db.prepare("UPDATE content SET source_info = ? WHERE id = ?").run(source_info, this.id);
        this.source_info = source_info;
    }

    delete() {
        db.prepare("DELETE FROM content WHERE id = ?").run(this.id);
    }
}

let instance_watches = {};

class Instance {
    constructor(instance_id) {
        let content = db.prepare("SELECT * FROM instances WHERE instance_id = ? LIMIT 1").get(instance_id);
        if (!content) throw new Error(translate("app.error.instance_not_found"));
        this.name = content.name;
        this.date_created = new Date(content.date_created);
        this.date_modified = new Date(content.date_modified);
        this.last_played = new Date(content.last_played);
        this.loader = content.loader;
        this.vanilla_version = content.vanilla_version;
        this.loader_version = content.loader_version;
        this.playtime = content.playtime;
        this.locked = Boolean(content.locked);
        this.downloaded = Boolean(content.downloaded);
        this.group = content.group_id;
        this.image = content.image;
        this.instance_id = content.instance_id;
        this.pid = content.pid;
        this.current_log_file = content.current_log_file;
        this.id = content.id;
        this.install_source = content.install_source;
        this.install_id = content.install_id;
        this.installing = Boolean(content.installing);
        this.mc_installed = Boolean(content.mc_installed);
        this.window_width = content.window_width;
        this.window_height = content.window_height;
        this.allocated_ram = content.allocated_ram;
        this.java_version = content.java_version;
        this.java_path = content.java_path;
        this.attempted_options_txt_version = content.attempted_options_txt_version;
        this.java_args = content.java_args;
        this.env_vars = content.env_vars;
        this.pre_launch_hook = content.pre_launch_hook;
        this.wrapper = content.wrapper;
        this.post_exit_hook = content.post_exit_hook;
        this.installed_version = content.installed_version;
        this.last_analyzed_log = content.last_analyzed_log;
        if (!instance_watches[this.instance_id]) instance_watches[this.instance_id] = {};
    }
    get pinned() {
        let inst = db.prepare("SELECT * FROM pins WHERE instance_id = ? AND type = ?").get(this.instance_id, "instance");
        return Boolean(inst);
    }
    setLastAnalyzedLog(last_analyzed_log) {
        db.prepare("UPDATE instances SET last_analyzed_log = ? WHERE id = ?").run(last_analyzed_log, this.id);
        this.last_analyzed_log = last_analyzed_log;
        if (instance_watches[this.instance_id].onchangelast_analyzed_log) {
            instance_watches[this.instance_id].onchangelast_analyzed_log(last_analyzed_log);
        }
    }
    setInstalledVersion(installed_version) {
        db.prepare("UPDATE instances SET installed_version = ? WHERE id = ?").run(installed_version, this.id);
        this.installed_version = installed_version;
        if (instance_watches[this.instance_id].onchangeinstalled_version) {
            instance_watches[this.instance_id].onchangeinstalled_version(installed_version);
        }
    }
    setJavaArgs(java_args) {
        db.prepare("UPDATE instances SET java_args = ? WHERE id = ?").run(java_args, this.id);
        this.java_args = java_args;
        if (instance_watches[this.instance_id].onchangejava_args) {
            instance_watches[this.instance_id].onchangejava_args(java_args);
        }
    }
    setEnvVars(env_vars) {
        db.prepare("UPDATE instances SET env_vars = ? WHERE id = ?").run(env_vars, this.id);
        this.env_vars = env_vars;
        if (instance_watches[this.instance_id].onchangeenv_vars) {
            instance_watches[this.instance_id].onchangeenv_vars(env_vars);
        }
    }
    setPreLaunchHook(pre_launch_hook) {
        db.prepare("UPDATE instances SET pre_launch_hook = ? WHERE id = ?").run(pre_launch_hook, this.id);
        this.pre_launch_hook = pre_launch_hook;
        if (instance_watches[this.instance_id].onchangepre_launch_hook) {
            instance_watches[this.instance_id].onchangepre_launch_hook(pre_launch_hook);
        }
    }
    setWrapper(wrapper) {
        db.prepare("UPDATE instances SET wrapper = ? WHERE id = ?").run(wrapper, this.id);
        this.wrapper = wrapper;
        if (instance_watches[this.instance_id].onchangewrapper) {
            instance_watches[this.instance_id].onchangewrapper(wrapper);
        }
    }
    setPostExitHook(post_exit_hook) {
        db.prepare("UPDATE instances SET post_exit_hook = ? WHERE id = ?").run(post_exit_hook, this.id);
        this.post_exit_hook = post_exit_hook;
        if (instance_watches[this.instance_id].onchangepost_exit_hook) {
            instance_watches[this.instance_id].onchangepost_exit_hook(post_exit_hook);
        }
    }
    setJavaVersion(java_version) {
        db.prepare("UPDATE instances SET java_version = ? WHERE id = ?").run(java_version, this.id);
        this.java_version = java_version;
        if (instance_watches[this.instance_id].onchangejava_version) instance_watches[this.instance_id].onchangejava_version(java_version);
    }
    setJavaPath(java_path) {
        db.prepare("UPDATE instances SET java_path = ? WHERE id = ?").run(java_path, this.id);
        this.java_path = java_path;
        if (instance_watches[this.instance_id].onchangejava_path) instance_watches[this.instance_id].onchangejava_path(java_path);
    }
    setWindowWidth(window_width) {
        db.prepare("UPDATE instances SET window_width = ? WHERE id = ?").run(window_width, this.id);
        this.window_width = window_width;
        if (instance_watches[this.instance_id].onchangewindow_width) instance_watches[this.instance_id].onchangewindow_width(window_width);
    }
    setWindowHeight(window_height) {
        db.prepare("UPDATE instances SET window_height = ? WHERE id = ?").run(window_height, this.id);
        this.window_height = window_height;
        if (instance_watches[this.instance_id].onchangewindow_height) instance_watches[this.instance_id].onchangewindow_height(window_height);
    }
    setAllocatedRam(allocated_ram) {
        db.prepare("UPDATE instances SET allocated_ram = ? WHERE id = ?").run(allocated_ram, this.id);
        this.allocated_ram = allocated_ram;
        if (instance_watches[this.instance_id].onchangeallocated_ram) instance_watches[this.instance_id].onchangeallocated_ram(allocated_ram);
    }
    setName(name) {
        db.prepare("UPDATE instances SET name = ? WHERE id = ?").run(name, this.id);
        this.name = name;
        if (instance_watches[this.instance_id].onchangename) instance_watches[this.instance_id].onchangename(name);
    }
    setLastPlayed(last_played) {
        db.prepare("UPDATE instances SET last_played = ? WHERE id = ?").run(last_played ? last_played.toISOString() : null, this.id);
        this.last_played = last_played;
        if (instance_watches[this.instance_id].onchangelast_played) instance_watches[this.instance_id].onchangelast_played(last_played);
    }
    setDateCreated(date_created) {
        db.prepare("UPDATE instances SET date_created = ? WHERE id = ?").run(date_created.toISOString(), this.id);
        this.date_created = date_created;
        if (instance_watches[this.instance_id].onchangedate_created) instance_watches[this.instance_id].onchangedate_created(date_created);
    }
    setDateModified(date_modified) {
        db.prepare("UPDATE instances SET date_modified = ? WHERE id = ?").run(date_modified.toISOString(), this.id);
        this.date_modified = date_modified;
        if (instance_watches[this.instance_id].onchangedate_modified) instance_watches[this.instance_id].onchangedate_modified(date_modified);
    }
    setLoader(loader) {
        db.prepare("UPDATE instances SET loader = ? WHERE id = ?").run(loader, this.id);
        this.loader = loader;
        if (instance_watches[this.instance_id].onchangeloader) instance_watches[this.instance_id].onchangeloader(loader);
    }
    setVanillaVersion(vanilla_version, do_not_set_options_txt) {
        db.prepare("UPDATE instances SET vanilla_version = ? WHERE id = ?").run(vanilla_version, this.id);
        this.vanilla_version = vanilla_version;
        if (instance_watches[this.instance_id].onchangevanilla_version) instance_watches[this.instance_id].onchangevanilla_version(vanilla_version);
        if (do_not_set_options_txt) return;
        let default_options = new DefaultOptions(vanilla_version);
        let v = window.electronAPI.setOptionsTXT(this.instance_id, default_options.getOptionsTXT(), false);
        this.setAttemptedOptionsTxtVersion(v);
    }
    setAttemptedOptionsTxtVersion(attempted_options_txt_version) {
        db.prepare("UPDATE instances SET attempted_options_txt_version = ? WHERE id = ?").run(attempted_options_txt_version, this.id);
        this.attempted_options_txt_version = attempted_options_txt_version;
    }
    setLoaderVersion(loader_version) {
        db.prepare("UPDATE instances SET loader_version = ? WHERE id = ?").run(loader_version, this.id);
        this.loader_version = loader_version;
        if (instance_watches[this.instance_id].onchangeloader_version) instance_watches[this.instance_id].onchangeloader_version(loader_version);
    }
    setPlaytime(playtime) {
        db.prepare("UPDATE instances SET playtime = ? WHERE id = ?").run(playtime, this.id);
        this.playtime = playtime;
        if (instance_watches[this.instance_id].onchangeplaytime) instance_watches[this.instance_id].onchangeplaytime(playtime);
    }
    setLocked(locked) {
        db.prepare("UPDATE instances SET locked = ? WHERE id = ?").run(Number(locked), this.id);
        this.locked = locked;
        if (instance_watches[this.instance_id].onchangelocked) instance_watches[this.instance_id].onchangelocked(locked);
    }
    setDownloaded(downloaded) {
        db.prepare("UPDATE instances SET downloaded = ? WHERE id = ?").run(Number(downloaded), this.id);
        this.downloaded = downloaded;
        if (instance_watches[this.instance_id].onchangedownloaded) instance_watches[this.instance_id].onchangedownloaded(downloaded);
    }
    setGroup(group) {
        db.prepare("UPDATE instances SET group_id = ? WHERE id = ?").run(group, this.id);
        this.group = group;
        if (instance_watches[this.instance_id].onchangegroup) instance_watches[this.instance_id].onchangegroup(group);
    }
    setImage(image) {
        db.prepare("UPDATE instances SET image = ? WHERE id = ?").run(image, this.id);
        this.image = image;
        if (instance_watches[this.instance_id].onchangeimage) instance_watches[this.instance_id].onchangeimage(image);
    }
    setPid(pid) {
        db.prepare("UPDATE instances SET pid = ? WHERE id = ?").run(pid, this.id);
        this.pid = pid;
        if (instance_watches[this.instance_id].onchangepid) instance_watches[this.instance_id].onchangepid(pid);
    }
    setCurrentLogFile(current_log_file) {
        db.prepare("UPDATE instances SET current_log_file = ? WHERE id = ?").run(current_log_file, this.id);
        this.current_log_file = current_log_file;
        if (instance_watches[this.instance_id].onchangecurrent_log_file) instance_watches[this.instance_id].onchangecurrent_log_file(current_log_file);
    }
    setInstallSource(install_source) {
        db.prepare("UPDATE instances SET install_source = ? WHERE id = ?").run(install_source, this.id);
        this.install_source = install_source;
        if (instance_watches[this.instance_id].onchangeinstall_source) instance_watches[this.instance_id].onchangeinstall_source(install_source);
    }
    setInstallId(install_id) {
        db.prepare("UPDATE instances SET install_id = ? WHERE id = ?").run(install_id, this.id);
        this.install_id = install_id;
        if (instance_watches[this.instance_id].onchangeinstall_id) instance_watches[this.instance_id].onchangeinstall_id(install_id);
    }
    setInstalling(installing) {
        db.prepare("UPDATE instances SET installing = ? WHERE id = ?").run(Number(installing), this.id);
        this.installing = installing;
        if (instance_watches[this.instance_id].onchangeinstalling) instance_watches[this.instance_id].onchangeinstalling(installing);
    }
    setMcInstalled(mc_installed) {
        db.prepare("UPDATE instances SET mc_installed = ? WHERE id = ?").run(Number(mc_installed), this.id);
        this.mc_installed = mc_installed;
        if (instance_watches[this.instance_id].onchangemc_installed) instance_watches[this.instance_id].onchangemc_installed(mc_installed);
    }

    watchForChange(name, func) {
        if (!instance_watches[this.instance_id]) instance_watches[this.instance_id] = {};
        instance_watches[this.instance_id]["onchange" + name] = func;
    }

    addContent(name, author, image, file_name, source, type, version, source_info, disabled, version_id) {
        if (!file_name) throw new Error("File Name not set");
        db.prepare('INSERT into content (name,author,image,file_name,source,type,version,instance,source_info,disabled,version_id) VALUES (?,?,?,?,?,?,?,?,?,?,?)').run(name, author, image, file_name, source, type, version, this.instance_id, source_info, Number(disabled), version_id);
        return new Content(this.instance_id, file_name);
    }

    getContent() {
        let content = db.prepare("SELECT * FROM content WHERE instance = ?").all(this.instance_id);
        return content.map(e => new Content(e.id));
    }

    clearContent() {
        let content = this.getContent();
        content.forEach(e => {
            e.delete();
        });
    }

    delete() {
        db.prepare("DELETE FROM instances WHERE id = ?").run(this.id);
        db.prepare("DELETE FROM content WHERE instance = ?").run(this.instance_id);
        db.prepare("DELETE FROM last_played_servers WHERE instance_id = ?").run(this.instance_id);
    }

    refresh() {
        return new Instance(this.instance_id);
    }
}

let defaultSkins = [{
    "name": translate("app.skins.steve"),
    "model": "wide",
    "texture_key": "31f477eb1a7beee631c2ca64d06f8f68fa93a3386d04452ab27f43acdf1b60cb"
}, {
    "name": translate("app.skins.alex"),
    "model": "slim",
    "texture_key": "46acd06e8483b176e8ea39fc12fe105eb3a2a4970f5100057e9d84d4b60bdfa7"
}, {
    "name": translate("app.skins.ari"),
    "model": "wide",
    "texture_key": "4c05ab9e07b3505dc3ec11370c3bdce5570ad2fb2b562e9b9dd9cf271f81aa44"
}, {
    "name": translate("app.skins.efe"),
    "model": "slim",
    "texture_key": "fece7017b1bb13926d1158864b283b8b930271f80a90482f174cca6a17e88236"
}, {
    "name": translate("app.skins.kai"),
    "model": "wide",
    "texture_key": "e5cdc3243b2153ab28a159861be643a4fc1e3c17d291cdd3e57a7f370ad676f3"
}, {
    "name": translate("app.skins.makena"),
    "model": "slim",
    "texture_key": "7cb3ba52ddd5cc82c0b050c3f920f87da36add80165846f479079663805433db"
}, {
    "name": translate("app.skins.noor"),
    "model": "slim",
    "texture_key": "6c160fbd16adbc4bff2409e70180d911002aebcfa811eb6ec3d1040761aea6dd"
}, {
    "name": translate("app.skins.sunny"),
    "model": "wide",
    "texture_key": "a3bd16079f764cd541e072e888fe43885e711f98658323db0f9a6045da91ee7a"
}, {
    "name": translate("app.skins.zuri"),
    "model": "wide",
    "texture_key": "f5dddb41dcafef616e959c2817808e0be741c89ffbfed39134a13e75b811863d"
},
{
    "name": translate("app.skins.steve_cake"),
    "model": "wide",
    "texture_key": "b182ad5783a343be3e202ac35902270a8d31042fdfd48b849fc99a55a1b60a91"
},
{
    "name": translate("app.skins.alex_globe"),
    "model": "wide",
    "texture_key": "6c25523e7dabfcaf0dbe32d90fd0c001d5d57ac66206a0595defe9be5947ff08"
},
{
    "name": translate("app.skins.sheep_cosplayer"),
    "model": "wide",
    "texture_key": "7cbe449d9d37c111a07a902e322d3869d98790c48f1fa16a24bcbe2d8d73808b"
},
{
    "name": translate("app.skins.cardboard_cosplayer"),
    "model": "wide",
    "texture_key": "6acf91326bd116ce889e461ddb57e92ace07a8367dbd2d191075078fccc3c727"
},
{
    "name": translate("app.skins.alex_party"),
    "model": "slim",
    "texture_key": "66206c8f51d13d2d31c54696a58a3e8bcd1e5e7db9888d331d0753129324e4f1"
},
{
    "name": translate("app.skins.steve_party"),
    "model": "wide",
    "texture_key": "c05e396bbf744082122f77b7277af390d11d2d4e93dd2f8c67942ca9626db24d"
},
{
    "name": translate("app.skins.creeper_pinata_cosplay"),
    "model": "wide",
    "texture_key": "b7393199a84eb9e932efa8dda6829423875eb65af76cb82912ade62f93996b9c"
},
{
    "name": translate("app.skins.creeper_cosplay"),
    "model": "wide",
    "texture_key": "b9f7facdca2bf4772fa168e1c3cf7b020124eb1fc82118307d426da1b88c32c5"
},
{
    "name": translate("app.skins.buff_butcher"),
    "model": "wide",
    "texture_key": "5e4e09eccbce11e701c51bb64b102d688a6ac4018c725dd2b780210aee101b31"
},
{
    "name": translate("app.skins.buff_butcher_alternate"),
    "model": "wide",
    "texture_key": "d66ed86ce96a1b63c30f1baac762f638717930866474ac4fce697cdbd0bd6fbb"
},
{
    "name": translate("app.skins.barn_builder"),
    "model": "wide",
    "texture_key": "2007b66a99ae905c81f339e2a0a4bf4b99e9454a485d5164e3e1051c3036ad70"
},
{
    "name": translate("app.skins.homestead_healer"),
    "model": "wide",
    "texture_key": "b9e9d1b51b4be289b9525d4decd798cb7912e920bac8846a2df70e9ff4f0b1d8"
},
{
    "name": translate("app.skins.beefriender"),
    "model": "wide",
    "texture_key": "59f2872323bf515aa8d84c00931fbf8170b2cec5138961527c09ffcd06ca4ab2"
},
{
    "name": translate("app.skins.beefriender_alternate"),
    "model": "wide",
    "texture_key": "7cd85127cbc710a1c9a53c6bb3474f59995c222b9d8c57b293993cc2d8a225aa"
},
{
    "name": translate("app.skins.ranch_ranger"),
    "model": "wide",
    "texture_key": "25dc6421d47cad8e2bdf93f56fae9ab06fcfe218c8645c1775ae2e4563c065ad"
},
{
    "name": translate("app.skins.pig_whisperer"),
    "model": "wide",
    "texture_key": "83e283ab33558baa2cd0184d2e85f090c795a797bdbcb2cc47230c27f23fe9b1"
},
{
    "name": translate("app.skins.pig_whisperer_alternate"),
    "model": "wide",
    "texture_key": "e1fc44f1d69fd2864df7b80618a38af4170d4800f2df4fbde81c17b74b2a818b"
},
{
    "name": translate("app.skins.snowfeather"),
    "model": "wide",
    "texture_key": "721c05483a435d4362047ccb62e075ef5f001aa63a7e0e2afe03e60759bab91d"
},
{
    "name": translate("app.skins.stray"),
    "model": "wide",
    "texture_key": "b914cf5106aaa82409fdd9213fbdb1479b4d65aecc5d5e22b1f25e5744c4c4f7"
},
{
    "name": translate("app.skins.strider"),
    "model": "wide",
    "texture_key": "5eb077c54ecfc7e760c36add887b68859d7a3160d331580ff859f7353d959151"
},
{
    "name": translate("app.skins.villager_1"),
    "model": "wide",
    "texture_key": "b271a744ef479018927575952621b110b9c11f62730a95729af7e8591cf8dbf6"
},
{
    "name": translate("app.skins.villager_2"),
    "model": "wide",
    "texture_key": "748923629fed7c6ec9462016b4480fa3cff8c16e82ee6fe26d4b707f4de10060"
},
{
    "name": translate("app.skins.wither_skeleton"),
    "model": "wide",
    "texture_key": "3d996abc69ea70a20442855e429bf44b45111f9818d0f8c46272e12d12bec218"
},
{
    "name": translate("app.skins.pale_lumberjack"),
    "model": "wide",
    "texture_key": "6f8fc677cdcd4c6eed67d90c08d23162abc3a3a85357c7636fdf80d874aa857f"
},
{
    "name": translate("app.skins.creaking"),
    "model": "wide",
    "texture_key": "9a0af2b1fd9659480d43132db95cd7d459d1a66480fe42150e132d03b9731573"
},
{
    "name": translate("app.skins.ghast_riding_swimmer"),
    "model": "wide",
    "texture_key": "e12d98dab548e92cad7ac80f92d8fefbb9ca7a1af94aa4f428daf6ef723aa8e0"
},
{
    "name": translate("app.skins.happy_ghast_pilot"),
    "model": "wide",
    "texture_key": "8409954698b6c7741460fdd85d6ec6a5e0a9ad04ade7e2c72c913f02936a607d"
},
{
    "name": translate("app.skins.copper_chemist"),
    "model": "wide",
    "texture_key": "33aef79a4ca986a2971057d35046e71dce326b645353e6f92d56e1c4bb3b0073"
},
{
    "name": translate("app.skins.copper_welder"),
    "model": "wide",
    "texture_key": "514b10ff7bc50dd01b5438632815b9e27cfe54064d1a28ef6014f3309d278b38"
}]

class Data {
    getInstances() {
        let instances = db.prepare("SELECT * FROM instances").all();
        return instances.map(e => new Instance(e.instance_id));
    }

    addInstance(name, date_created, date_modified, last_played, loader, vanilla_version, loader_version, locked, downloaded, group, image, instance_id, playtime, install_source, install_id, installing, mc_installed) {
        db.prepare(`INSERT INTO instances (name, date_created, date_modified, last_played, loader, vanilla_version, loader_version, locked, downloaded, group_id, image, instance_id, playtime, install_source, install_id, installing, mc_installed, window_width, window_height, allocated_ram) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(name, date_created.toISOString(), date_modified.toISOString(), last_played ? last_played.toISOString() : null, loader, vanilla_version, loader_version, Number(locked), Number(downloaded), group, image, instance_id, playtime, install_source, install_id, Number(installing), Number(mc_installed), Number(data.getDefault("default_width")), Number(data.getDefault("default_height")), Number(data.getDefault("default_ram")));
        let default_options = new DefaultOptions(vanilla_version);
        let v = window.electronAPI.setOptionsTXT(instance_id, default_options.getOptionsTXT(), true);
        let instance = new Instance(instance_id);
        instance.setAttemptedOptionsTxtVersion(v);
        instance.setJavaArgs(data.getDefault("default_java_args"));
        instance.setEnvVars(data.getDefault("default_env_vars"));
        instance.setPreLaunchHook(data.getDefault("default_pre_launch_hook"));
        instance.setWrapper(data.getDefault("default_wrapper"));
        instance.setPostExitHook(data.getDefault("default_post_exit_hook"));
        return instance;
    }

    deleteInstance(instance_id) {
        db.prepare("DELETE FROM instances WHERE instance_id = ?").run(instance_id);
    }

    getProfiles() {
        let profiles = db.prepare("SELECT * FROM profiles").all();
        return profiles.map(e => new Profile(e.id));
    }

    getDefaultProfile() {
        let profile = db.prepare("SELECT * FROM profiles WHERE is_default = ?").get(1);
        if (!profile) return null;
        return new Profile(profile.id);
    }

    deleteProfile(uuid) {
        db.prepare("DELETE FROM profiles WHERE uuid = ?").get(uuid);
    }

    addProfile(access_token, client_id, expires, name, refresh_token, uuid, xuid, is_demo, is_default) {
        let result = db.prepare("INSERT INTO profiles (access_token,client_id,expires,name,refresh_token,uuid,xuid,is_demo,is_default) VALUES (?,?,?,?,?,?,?,?,?)").run(access_token, client_id, expires.toISOString(), name, refresh_token, uuid, xuid, Number(is_demo), Number(is_default));
        return new Profile(result.lastInsertRowid);
    }

    getProfileFromUUID(uuid) {
        let result = db.prepare("SELECT * FROM profiles WHERE uuid = ?").get(uuid);
        return new Profile(result.id);
    }

    getDefault(type) {
        let default_ = db.prepare("SELECT * FROM defaults WHERE default_type = ?").get(type);
        if (!default_) {
            let defaults = { "default_accent_color": "light_blue", "default_sort": "name", "default_group": "none", "default_page": "home", "default_width": 854, "default_height": 480, "default_ram": 4096, "default_mode": "dark", "default_sidebar": "spacious", "default_sidebar_side": "left", "discord_rpc": "true", "default_java_args": "-XX:+UnlockExperimentalVMOptions -XX:+UseG1GC -XX:G1NewSizePercent=20 -XX:G1ReservePercent=20 -XX:MaxGCPauseMillis=50 -XX:G1HeapRegionSize=32M", "default_env_vars": "", "default_pre_launch_hook": "", "default_wrapper": "", "default_post_exit_hook": "", "potato_mode": "false", "hide_ip": "false", "saved_version": window.electronAPI.version.replace("-dev", ""), "latest_release": "hello there", "max_concurrent_downloads": 10 };
            let value = defaults[type];
            db.prepare("INSERT INTO defaults (default_type, value) VALUES (?, ?)").run(type, value);
            return value;
        }
        return default_.value;
    }

    setDefault(type, value) {
        if (!this.getDefault(type)) {
            return null;
        }
        db.prepare("UPDATE defaults SET value = ? WHERE default_type = ?").run(value, type);
    }

    getSkins() {
        let skins = db.prepare("SELECT * FROM skins").all();
        return skins.map(e => new Skin(e.id));
    }

    getSkinsNoDefaults() {
        let skins = db.prepare("SELECT * FROM skins WHERE NOT default_skin = ?").all(Number(true));
        return skins.map(e => new Skin(e.id));
    }

    async getDefaultSkins() {
        let skins = db.prepare("SELECT * FROM skins WHERE default_skin = ?").all(Number(true));
        if (skins.length != defaultSkins.length) {
            let texture_keys = skins.map(e => e.texture_key);
            for (let i = 0; i < defaultSkins.length; i++) {
                let e = defaultSkins[i];
                if (!texture_keys.includes(e.texture_key)) {
                    let info = await window.electronAPI.downloadSkin("https://textures.minecraft.net/texture/" + e.texture_key);
                    db.prepare("INSERT INTO skins (name, model, skin_id, skin_url, default_skin, active_uuid, texture_key) VALUES (?,?,?,?,?,?,?)").run(e.name, e.model, info.hash, info.dataUrl, Number(true), "", e.texture_key);
                }
            }
            let skins2 = db.prepare("SELECT * FROM skins WHERE default_skin = ?").all(Number(true));
            return skins2.map(e => new Skin(e.id));
        }
        return skins.map(e => new Skin(e.id));
    }

    addSkin(name, model, active_uuid, skin_id, skin_url, overrideCheck) {
        let skins = this.getSkins();
        let previousSkinIds = skins.map(e => e.skin_id);
        if (previousSkinIds.includes(skin_id) && !overrideCheck) {
            return new Skin(skins[previousSkinIds.indexOf(skin_id)].id);
        }
        let result = db.prepare("INSERT INTO skins (name, model, active_uuid, skin_id, skin_url, default_skin) VALUES (?,?,?,?,?,?)").run(name, model, `;${active_uuid};`, skin_id, skin_url, Number(false));
        return new Skin(result.lastInsertRowid);
    }
}

class Profile {
    constructor(id) {
        let profile = db.prepare("SELECT * FROM profiles WHERE id = ? LIMIT 1").get(id);
        if (!profile) throw new Error(translate("app.error.profile_not_found"));
        this.id = profile.id;
        this.access_token = profile.access_token;
        this.client_id = profile.client_id;
        this.expires = new Date(profile.expires);
        this.name = profile.name;
        this.refresh_token = profile.refresh_token;
        this.uuid = profile.uuid;
        this.xuid = profile.xuid;
        this.is_demo = Boolean(profile.is_demo);
        this.is_default = Boolean(profile.is_default);
    }
    setDefault() {
        let data = new Data();
        let old_default_profile = data.getDefaultProfile();
        if (old_default_profile) db.prepare("UPDATE profiles SET is_default = ? WHERE id = ?").run(Number(false), old_default_profile.id);
        db.prepare("UPDATE profiles SET is_default = ? WHERE id = ?").run(Number(true), this.id);
    }

    setAccessToken(access_token) {
        db.prepare("UPDATE profiles SET access_token = ? WHERE id = ?").run(access_token, this.id);
        this.access_token = access_token;
    }

    setClientId(client_id) {
        db.prepare("UPDATE profiles SET client_id = ? WHERE id = ?").run(client_id, this.id);
        this.client_id = client_id;
    }

    setExpires(expires) {
        db.prepare("UPDATE profiles SET expires = ? WHERE id = ?").run(expires.toISOString(), this.id);
        this.expires = expires;
    }

    setName(name) {
        db.prepare("UPDATE profiles SET name = ? WHERE id = ?").run(name, this.id);
        this.name = name;
    }

    setRefreshToken(refresh_token) {
        db.prepare("UPDATE profiles SET refresh_token = ? WHERE id = ?").run(refresh_token, this.id);
        this.refresh_token = refresh_token;
    }

    setUuid(uuid) {
        db.prepare("UPDATE profiles SET uuid = ? WHERE id = ?").run(uuid, this.id);
        this.uuid = uuid;
    }

    setXuid(xuid) {
        db.prepare("UPDATE profiles SET xuid = ? WHERE id = ?").run(xuid, this.id);
        this.xuid = xuid;
    }

    setIsDemo(is_demo) {
        db.prepare("UPDATE profiles SET is_demo = ? WHERE id = ?").run(Number(is_demo), this.id);
        this.is_demo = Boolean(is_demo);
    }

    delete() {
        db.prepare("DELETE FROM profiles WHERE id = ?").run(this.id);
    }

    getCapes() {
        let capes = db.prepare("SELECT * FROM capes WHERE uuid = ?").all(this.uuid);
        return capes.map(e => new Cape(e.id));
    }

    addCape(cape_name, cape_id, cape_url) {
        let capes = this.getCapes();
        let previousCapeIds = capes.map(e => e.cape_id);
        if (previousCapeIds.includes(cape_id)) {
            return new Cape(capes[previousCapeIds.indexOf(cape_id)].id);
        }
        let result = db.prepare("INSERT INTO capes (uuid, cape_name, cape_id, cape_url) VALUES (?,?,?,?)").run(this.uuid, cape_name, cape_id, cape_url);
        return new Cape(result.lastInsertRowid);
    }

    getActiveSkin() {
        let result = db.prepare("SELECT * FROM skins WHERE active_uuid LIKE ? LIMIT 1").get(`%;${this.uuid};%`);
        if (!result) return null;
        return new Skin(result.id);
    }

    getActiveCape() {
        let result = db.prepare("SELECT * FROM capes WHERE uuid = ? AND active = ? LIMIT 1").get(this.uuid, Number(true));
        if (!result) return null;
        return new Cape(result.id);
    }

    removeActiveCape() {
        let old = db.prepare("SELECT * FROM capes WHERE uuid = ? AND active = ?").all(this.uuid, Number(true));
        old.forEach((e) => {
            db.prepare("UPDATE capes SET active = ? WHERE id = ?").run(Number(false), e.id);
        });
    }
}

let data = new Data();

class MinecraftAccountSwitcher {
    constructor(element, players) {
        element.classList.add("player-switch");
        this.element = element;
        this.players = players;
        this.setPlayerInfo();
    }
    reloadHeads() {
        if (!this.players) return;
        this.playerElements = this.playerElements || [];
        for (let i = 0; i < this.players.length; i++) {
            if (this.playerElements[i]) {
                getPlayerHead(this.players[i], (e) => {
                    this.playerElements[i].querySelector('.player-head').src = e;
                });
            }
        }
        getPlayerHead(this.default_player, (e) => {
            this.element.querySelector('.player-head').src = e;
        });
    }
    setPlayerInfo() {
        let default_player = this.default_player ?? data.getDefaultProfile();
        this.default_player = default_player;
        if (default_player) {
            this.element.setAttribute("popovertarget", "player-dropdown");
            this.element.innerHTML = ``;
            let img = document.createElement("img");
            img.className = "player-head";
            getPlayerHead(default_player, (e) => img.src = e);
            this.element.appendChild(img);
            let pInfo = document.createElement("div");
            pInfo.className = "player-info";
            this.element.appendChild(pInfo);
            let pName = document.createElement("div");
            pName.className = "player-name";
            pName.innerHTML = sanitize(default_player.name);
            pInfo.appendChild(pName);
            let pDesc = document.createElement("div");
            pDesc.className = "player-desc";
            pDesc.innerHTML = translate("app.players.minecraft_account");
            pInfo.appendChild(pDesc);
            let pChevron = document.createElement("div");
            pChevron.className = "player-chevron";
            pChevron.innerHTML = '<i class="fa-solid fa-chevron-down"></i>';
            this.element.appendChild(pChevron);
            this.element.onclick = () => { };
            let dropdownElement;
            let alreadyThere = false;
            if (this.dropdownElement) {
                dropdownElement = this.dropdownElement;
                dropdownElement.innerHTML = "";
                alreadyThere = true;
            } else {
                dropdownElement = document.createElement("div");
                dropdownElement.id = "player-dropdown";
                dropdownElement.setAttribute("popover", "");
                this.dropdownElement = dropdownElement;
            }
            this.playerElements = [];
            if (!this.players) this.players = [];
            for (let i = 0; i < this.players.length; i++) {
                let playerElement = document.createElement("button");
                let selected = default_player.uuid == this.players[i].uuid;
                playerElement.classList.add("player-switch");
                if (!selected) playerElement.classList.add("not-selected");
                let playerImg = document.createElement("img");
                playerImg.classList.add("player-head");
                getPlayerHead(this.players[i], (e) => playerImg.src = e);
                playerElement.appendChild(playerImg);
                let playerInfoEle = document.createElement("div");
                playerInfoEle.classList.add("player-info");
                let playerName = document.createElement("div");
                playerName.classList.add("player-name");
                playerName.innerHTML = sanitize(this.players[i].name);
                playerInfoEle.appendChild(playerName);
                let playerDesc = document.createElement("div");
                playerDesc.classList.add("player-desc");
                playerDesc.innerHTML = sanitize(translate("app.players.selected"));
                playerInfoEle.appendChild(playerDesc);
                playerElement.appendChild(playerInfoEle);
                let playerDelete = document.createElement("div");
                playerDelete.classList.add("player-delete");
                playerDelete.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
                playerDelete.setAttribute("tabindex", "0");
                playerDelete.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.onPlayerClickDelete(this.players[i]);
                });
                playerDelete.addEventListener('keydown', (e) => {
                    e.stopPropagation();
                    if (e.key == "Enter" || e.key == " ") {
                        this.onPlayerClickDelete(this.players[i]);
                    }
                });
                playerDelete.setAttribute("data-uuid", this.players[i].uuid);
                playerElement.appendChild(playerDelete);
                playerElement.addEventListener('click', (e) => this.onPlayerClick(this.players[i]));
                playerElement.setAttribute("data-uuid", this.players[i].uuid);
                dropdownElement.appendChild(playerElement);
                this.playerElements.push(playerElement);
            }
            let addPlayerButton = document.createElement("button");
            addPlayerButton.classList.add("add-player");
            addPlayerButton.innerHTML = '<i class="fa-solid fa-plus"></i>' + sanitize(translate("app.button.players.add"));
            addPlayerButton.onclick = toggleMicrosoftSignIn;
            dropdownElement.appendChild(addPlayerButton);
            if (!alreadyThere) document.body.appendChild(dropdownElement);
        } else {
            this.element.removeAttribute("popovertarget");
            if (this.dropdownElement) this.dropdownElement.hidePopover();
            this.element.innerHTML = ``;
            let img = document.createElement("img");
            img.className = "player-head";
            getPlayerHead(null, (e) => img.src = e);
            this.element.appendChild(img);
            let pInfo = document.createElement("div");
            pInfo.className = "player-info";
            this.element.appendChild(pInfo);
            let pName = document.createElement("div");
            pName.className = "player-name";
            pName.innerHTML = translate("app.button.players.sign_in");
            pInfo.appendChild(pName);
            let pChevron = document.createElement("div");
            pChevron.className = "player-chevron";
            pChevron.innerHTML = '<i class="fa-solid fa-arrow-right-to-bracket"></i>';
            this.element.appendChild(pChevron);
            this.element.onclick = toggleMicrosoftSignIn;
        }
    }
    addPlayer(newPlayerInfo) {
        if (!this.players) this.players = [];
        this.default_player = newPlayerInfo;
        this.players.push(newPlayerInfo);
        newPlayerInfo.setDefault();
        this.setPlayerInfo();
        if (currentTab == "wardrobe") {
            wardrobeContent.displayContent();
        }
    }
    selectPlayer(newPlayerInfo) {
        this.default_player = newPlayerInfo;
        newPlayerInfo.setDefault();
        this.element.innerHTML = ``;
        let img = document.createElement("img");
        img.className = "player-head";
        getPlayerHead(newPlayerInfo, (e) => img.src = e);
        this.element.appendChild(img);
        let pInfo = document.createElement("div");
        pInfo.className = "player-info";
        this.element.appendChild(pInfo);
        let pName = document.createElement("div");
        pName.className = "player-name";
        pName.innerHTML = sanitize(newPlayerInfo.name);
        pInfo.appendChild(pName);
        let pDesc = document.createElement("div");
        pDesc.className = "player-desc";
        pDesc.innerHTML = translate("app.players.minecraft_account");
        pInfo.appendChild(pDesc);
        let pChevron = document.createElement("div");
        pChevron.className = "player-chevron";
        pChevron.innerHTML = '<i class="fa-solid fa-chevron-down"></i>';
        this.element.appendChild(pChevron);
        for (let i = 0; i < this.playerElements.length; i++) {
            if (this.playerElements[i].getAttribute("data-uuid") != newPlayerInfo.uuid) {
                this.playerElements[i].classList.add("not-selected");
            } else {
                this.playerElements[i].classList.remove("not-selected");
            }
        }
        if (currentTab == "wardrobe") {
            wardrobeContent.displayContent();
        }
    }
    onPlayerClick(e) {
        this.selectPlayer(e);
        if (this.dropdownElement) this.dropdownElement.hidePopover();
    }
    onPlayerClickDelete(e) {
        for (let i = 0; i < this.players.length; i++) {
            if (this.players[i].uuid == e.uuid) {
                this.players[i].delete();
                this.players.splice(i, 1);
                break;
            }
        }
        if (this.default_player.uuid == e.uuid) {
            if (this.players.length >= 1) {
                this.default_player = this.players[0];
                this.players[0].setDefault();
            } else {
                this.players = [];
                this.default_player = null;
            }
        }
        this.setPlayerInfo();
        if (currentTab == "wardrobe") {
            wardrobeContent.displayContent();
        }
    }
}

function getPlayerHead(profile, callback) {
    if (!profile) {
        callback("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAAXNSR0IArs4c6QAAANNJREFUKFNjNFYR/M/AwMDAw8YCouDgy68/DD9+/WFgVJHg+M/PwwmWgCkCSYLYIJpRW473f4GrDYOEmCgDCxcvw59vnxm+//zN8PHjB4aZh04yMM5O9vzPzy/AwMnOCjYFJAkDIEWMq4oi/4f2LmMItutiiDC9ANa5/ZYDw9pDZQyri6MQJoB0HTh3HazZwUgTTINNmBBp//8/63+GXccvMejJqoIlTt++yuDraMLw6etvBsYpCXb/337+zXDw1EUGdg42hp8/foFpCz1NBj5uVgYAzxRTZRWSVwUAAAAASUVORK5CYII=");
        return;
    }
    let skin = profile.getActiveSkin();
    // if no skin is set, just display steve for now
    if (!skin) {
        callback("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAAXNSR0IArs4c6QAAANNJREFUKFNjNFYR/M/AwMDAw8YCouDgy68/DD9+/WFgVJHg+M/PwwmWgCkCSYLYIJpRW473f4GrDYOEmCgDCxcvw59vnxm+//zN8PHjB4aZh04yMM5O9vzPzy/AwMnOCjYFJAkDIEWMq4oi/4f2LmMItutiiDC9ANa5/ZYDw9pDZQyri6MQJoB0HTh3HazZwUgTTINNmBBp//8/63+GXccvMejJqoIlTt++yuDraMLw6etvBsYpCXb/337+zXDw1EUGdg42hp8/foFpCz1NBj5uVgYAzxRTZRWSVwUAAAAASUVORK5CYII=");
        return;
    }
    skinToHead(skin.skin_url, callback);
}

class NavigationButton {
    constructor(element, title, icon, content) {
        this.element = element;
        this.title = title;
        if (content) {
            element.onclick = (e) => {
                for (let i = 0; i < navButtons.length; i++) {
                    navButtons[i].removeSelected();
                }
                this.setSelected();
                content.displayContent();
            }
        }
        element.classList.add("menu-button");
        let navIcon = document.createElement("div");
        navIcon.classList.add("menu-icon");
        navIcon.innerHTML = icon;
        let navTitle = document.createElement("div");
        navTitle.classList.add("menu-title");
        navTitle.innerHTML = sanitize(title);
        element.appendChild(navIcon);
        element.appendChild(navTitle);
    }
    setSelected() {
        this.element.classList.add("selected");
    }
    removeSelected() {
        this.element.classList.remove("selected");
    }
}

let currentTab = "";
let currentSubTab = "";
let currentInstanceId = "";

function resetDiscordStatus(bypassLock) {
    console.log("current tab", currentTab);
    if (!rpcLocked || bypassLock) {
        window.electronAPI.setActivity({
            "details": currentTab == "home" ? translate("app.discord_rpc.home") : currentTab == "instances" || currentTab == "instance" ? translate("app.discord_rpc.instances") : currentTab == "discover" ? translate("app.discord_rpc.discover") : currentTab == "wardrobe" ? translate("app.discord_rpc.wardrobe") : translate("app.discord_rpc.unknown"),
            "state": translate("app.discord_rpc.not_playing"),
            startTimestamp: new Date(),
            largeImageKey: 'icon',
            largeImageText: translate("app.discord_rpc.logo"),
            instance: false
        });
    }
}

class PageContent {
    constructor(func, title) {
        this.func = func;
        this.title = title;
    }
    displayContent() {
        if (this.title == "discover") {
            showAddContent();
            currentTab = "discover";
            return;
        }
        content.innerHTML = "";
        content.appendChild(this.func());
        if (this.title == "instances") {
            groupInstances(data.getDefault("default_group"));
        }
        currentTab = this.title;
        resetDiscordStatus();
        clearMoreMenus();
    }
}

let rpcLocked = false;

class LiveMinecraft {
    constructor(element) {
        this.element = element;
        element.className = "live";
        let indicator = document.createElement("div");
        indicator.className = "live-indicator";
        let name = document.createElement("div");
        name.className = "live-name";
        let innerName = document.createElement("div");
        innerName.innerHTML = sanitize(translate("app.instances.no_running"));
        name.appendChild(innerName);
        this.nameElement = innerName;
        let stopButton = document.createElement("div");
        stopButton.className = "live-stop";
        stopButton.setAttribute("title", translate("app.live.stop"));
        stopButton.innerHTML = '<i class="fa-regular fa-circle-stop"></i>';
        let logButton = document.createElement("div");
        logButton.className = "live-log";
        logButton.setAttribute("title", translate("app.live.logs"));
        logButton.innerHTML = '<i class="fa-solid fa-terminal"></i>';
        this.stopButton = stopButton;
        this.logButton = logButton;
        element.appendChild(indicator);
        element.appendChild(name);
        element.appendChild(stopButton);
        element.appendChild(logButton);
    }
    setLive(instanceInfo) {
        this.nameElement.innerHTML = sanitize(instanceInfo.name);
        this.element.classList.add("minecraft-live");
        this.stopButton.onclick = () => {
            stopInstance(instanceInfo.refresh());
            this.findLive();
        }
        this.logButton.onclick = () => {
            showSpecificInstanceContent(instanceInfo.refresh(), 'logs');
        }
        let buttons = new ContextMenuButtons([
            {
                "title": translate("app.live.context.view"),
                "icon": '<i class="fa-solid fa-eye"></i>',
                "func": () => {
                    showSpecificInstanceContent(instanceInfo.refresh());
                }
            },
            {
                "title": translate("app.live.context.logs"),
                "icon": '<i class="fa-solid fa-terminal"></i>',
                "func": () => {
                    showSpecificInstanceContent(instanceInfo.refresh(), 'logs');
                }
            },
            {
                "title": translate("app.live.context.stop"),
                "icon": '<i class="fa-regular fa-circle-stop"></i>',
                "func": () => {
                    stopInstance(instanceInfo.refresh());
                    this.findLive();
                }
            }
        ])
        this.element.oncontextmenu = (e) => {
            contextmenu.showContextMenu(buttons, e.clientX, e.clientY);
        }
        window.electronAPI.setActivity({
            "details": translate("app.discord_rpc.playing").replace("%i", instanceInfo.name),
            "state": translate("app.discord_rpc.description").replace("%l", loaders[instanceInfo.loader]).replace("%v", instanceInfo.vanilla_version),
            startTimestamp: new Date(),
            largeImageKey: 'icon',
            largeImageText: translate("app.discord_rpc.logo"),
            instance: false
        });
        rpcLocked = true;
    }
    removeLive() {
        this.nameElement.innerHTML = sanitize(translate("app.instances.no_running"));
        this.element.classList.remove("minecraft-live");
        this.element.oncontextmenu = () => { };
        this.stopButton.onclick = () => { };
        this.logButton.onclick = () => { };
        resetDiscordStatus(true);
        rpcLocked = false;
    }
    async findLive() {
        for (const instances of data.getInstances()) {
            if (window.electronAPI.checkForProcess(instances.pid)) {
                this.setLive(instances)
                return;
            }
        }
        this.removeLive();
    }
}

class TabContent {
    constructor(element, options) {
        this.element = element;
        element.classList.add("tab-list");
        for (let i = 0; i < options.length; i++) {
            let buttonElement = document.createElement("button");
            buttonElement.classList.add("tab-button");
            buttonElement.innerHTML = sanitize(options[i].name);
            buttonElement.setAttribute("data-color", options[i].color);
            buttonElement.onclick = (e) => {
                this.selectOption(options[i].value);
                let oldLeft = this.offset_left;
                this.offset_left = buttonElement.offsetLeft;
                this.offset_right = element.offsetWidth - buttonElement.offsetLeft - buttonElement.offsetWidth;
                element.style.setProperty("--left", this.offset_left + "px");
                element.style.setProperty("--right", this.offset_right + "px");
                element.style.setProperty("--transition", oldLeft < this.offset_left ? "right .125s, left .125s .125s, background-color .25s" : "right .125s .125s, left .125s, background-color .25s");
                if (options[i].color) element.style.setProperty("--color", options[i].color);
                else element.style.removeProperty("--color");
            }
            element.appendChild(buttonElement);
            options[i].element = buttonElement;
        }
        this.options = options;
        options[0].element.classList.add("selected");
        this.offset_left = 4;
        this.offset_right = element.offsetWidth - options[0].element.offsetLeft - options[0].element.offsetWidth;
        let oldLeft = 0;
        element.style.setProperty("--left", "4px");
        element.style.setProperty("--right", element.offsetWidth - options[0].element.offsetLeft - options[0].element.offsetWidth + "px");
        element.style.setProperty("--transition", oldLeft < this.offset_left ? "right .125s, left .125s .125s, background-color .25s" : "right .125s .125s, left .125s, background-color .25s");
        if (options[0].color) element.style.setProperty("--color", options[0].color);
        else element.style.removeProperty("--color");
        this.selected = options[0].value;
    }
    get getSelected() {
        return this.selected;
    }
    selectOption(val) {
        let opt;
        for (let i = 0; i < this.options.length; i++) {
            if (this.options[i].value == val) {
                opt = this.options[i];
                this.options[i].element.classList.add("selected");
            } else {
                this.options[i].element.classList.remove("selected");
            }
        }
        opt.func(val);
        this.selected = val;
    }
    selectOptionAdvanced(val) {
        for (let i = 0; i < this.options.length; i++) {
            if (this.options[i].value == val) {
                this.element.style.setProperty("--left", this.options[i].element.offset_left + "px");
                this.element.style.setProperty("--right", this.options[i].element.offset_right + "px");
                this.element.style.setProperty("--transition", "");
                if (this.options[i].color) this.element.style.setProperty("--color", this.options[i].color);
                else this.element.style.removeProperty("--color");
                this.options[i].element.click();
            }
        }
        this.selected = val;
    }
}

class MenuOption {
    constructor(element, title, icon) {
        this.element = element;
        this.title = title;
        this.icon = icon;
    }
    setTitle(title) {
        this.title = title;
        this.element.innerHTML = this.icon + sanitize(this.title);
    }
    setIcon(icon) {
        this.icon = icon;
        this.element.innerHTML = this.icon + sanitize(this.title);
    }
}

class MoreMenu {
    constructor(ele, buttons, switchSides = false, menuPadding = 5) {
        let id = createId();
        this.id = id;
        let element = document.createElement("div");
        element.classList.add("more-menu");
        if (switchSides) {
            element.style.right = "";
            element.style.left = "anchor(left)";
        }
        element.style.setProperty("--menu-padding", menuPadding + "px")
        element.setAttribute("popover", "");
        document.body.appendChild(element);
        ele.style.anchorName = "--" + id;
        element.style.positionAnchor = "--" + id;
        element.style.setProperty("--position-anchor", "--" + id);
        this.element = element;
        this.triggerElement = ele;
        ele.setAttribute("popovertarget", id);
        element.id = id;
        for (let i = 0; i < buttons.buttons.length; i++) {
            let buttonElement = document.createElement("button");
            buttonElement.classList.add("context-menu-button");
            let icon = typeof buttons.buttons[i].icon === "function" ? buttons.buttons[i].icon() : buttons.buttons[i].icon;
            let title = typeof buttons.buttons[i].title === "function" ? buttons.buttons[i].title() : buttons.buttons[i].title;
            buttonElement.innerHTML = icon + sanitize(title);
            if (buttons.buttons[i].danger) {
                buttonElement.classList.add("danger");
            }
            buttonElement.onclick = (e) => {
                this.element.hidePopover();
                buttons.buttons[i].func(new MenuOption(buttonElement, buttons.buttons[i].title, buttons.buttons[i].icon));
            }
            this.element.appendChild(buttonElement);
        }
    }
}

function clearMoreMenus() {
    [...document.getElementsByClassName("more-menu")].forEach(e => {
        let id = e.id;
        if (!document.querySelector(`[popovertarget="${id}"]`)) {
            e.remove();
        }
    });
}

class ContextMenu {
    constructor() {
        let element = document.createElement("div");
        element.classList.add("context-menu");
        element.setAttribute("popover", "");
        document.body.appendChild(element);
        this.element = element;
    }
    showContextMenu(buttons, x, y) {
        this.element.style.left = x + "px";
        this.element.style.right = "";
        let xTranslate = "0px";
        let yTranslate = "0px";
        if (window.innerWidth - x < 250) {
            xTranslate = "-100%";
        }
        if (window.innerHeight - y < 350) {
            yTranslate = "-100%";
        }
        this.element.style.translate = xTranslate + " " + yTranslate;
        this.element.style.top = y + "px";
        this.element.innerHTML = "";
        this.element.hidePopover();
        for (let i = 0; i < buttons.buttons.length; i++) {
            let buttonElement = document.createElement("button");
            buttonElement.classList.add("context-menu-button");
            let icon = typeof buttons.buttons[i].icon === "function" ? buttons.buttons[i].icon() : buttons.buttons[i].icon;
            let title = typeof buttons.buttons[i].title === "function" ? buttons.buttons[i].title() : buttons.buttons[i].title;
            buttonElement.innerHTML = icon + sanitize(title);
            if (buttons.buttons[i].danger) {
                buttonElement.classList.add("danger");
            }
            buttonElement.onclick = (e) => {
                this.element.hidePopover();
                buttons.buttons[i].func(new MenuOption(buttonElement, buttons.buttons[i].title, buttons.buttons[i].icon));
            }
            this.element.appendChild(buttonElement);
        }
        this.element.showPopover();
    }
    hideContextMenu() {
        this.element.hidePopover();
    }
}

class ContextMenuButtons {
    constructor(buttons) {
        this.buttons = buttons;
    }
}

class SearchBar {
    constructor(element, oninput, onenter) {
        this.oninput = oninput;
        this.onenter = onenter;
        element.classList.add("search-bar");
        this.element = element;
        let searchIcon = document.createElement("div");
        searchIcon.classList.add("search-icon");
        searchIcon.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i>';
        let searchInput = document.createElement("input");
        searchInput.classList.add("search-input");
        searchInput.setAttribute("placeholder", translate("app.hint.search"));
        this.input = searchInput;
        let searchClear = document.createElement("button");
        searchClear.classList.add("search-clear");
        searchClear.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        this.clear = searchClear;
        element.appendChild(searchIcon);
        element.appendChild(searchInput);
        element.appendChild(searchClear);
        searchIcon.onclick = (e) => {
            searchInput.focus();
        }
        this.value = "";
        searchInput.oninput = (e) => {
            if (this.oninput) this.oninput(searchInput.value);
            this.value = searchInput.value;
        };
        searchInput.onkeydown = (e) => {
            if (e.key == "Enter") {
                if (this.onenter) this.onenter(searchInput.value);
            }
            this.value = searchInput.value;
        }
        searchClear.onclick = (e) => {
            searchInput.value = "";
            if (this.oninput) this.oninput("");
            if (this.onenter) this.onenter("");
        }
    }
    setOnInput(oninput) {
        this.oninput = oninput;
    }
    setOnEnter(onenter) {
        this.onenter = onenter;
    }
    disable(m) {
        this.element.style.cursor = "not-allowed";
        this.element.style.opacity = ".5";
        this.input.disabled = true;
        this.clear.disabled = true;
        this.input.style.cursor = "not-allowed";
        this.clear.style.cursor = "not-allowed";
        this.element.title = m;
    }
}

function createId() {
    let string = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ_";
    let id = "";
    for (let i = 0; i < 30; i++) {
        id += string[Math.floor(Math.random() * string.length)];
    }
    return id;
}

class SearchDropdown {
    constructor(title, options, element, initial, onchange) {
        this.title = title;
        this.element = element;
        this.onchange = onchange;
        this.id = createId();
        let dropdownButton = document.createElement('button');
        dropdownButton.setAttribute("popovertarget", this.id);
        element.style.anchorName = "--" + this.id;
        dropdownButton.classList.add('dropdown-button');
        element.appendChild(dropdownButton);
        element.classList.add('search-dropdown');
        let dropdownInfo = document.createElement("div");
        dropdownInfo.classList.add("dropdown-info");
        let dropdownTitle = document.createElement("div");
        dropdownTitle.classList.add("dropdown-title");
        dropdownTitle.innerHTML = sanitize(title);
        let dropdownSelected = document.createElement("div");
        dropdownSelected.classList.add("dropdown-selected");
        dropdownInfo.appendChild(dropdownTitle);
        dropdownInfo.appendChild(dropdownSelected);
        dropdownButton.appendChild(dropdownInfo);
        this.selectedElement = dropdownSelected;
        let dropdownChevron = document.createElement("div");
        dropdownChevron.classList.add("dropdown-chevron");
        dropdownChevron.innerHTML = '<i class="fa-solid fa-chevron-down"></i>';
        dropdownButton.appendChild(dropdownChevron);
        let dropdownList = document.createElement("div");
        dropdownList.id = this.id;
        dropdownList.classList.add("dropdown-list");
        dropdownList.setAttribute("popover", "");
        dropdownList.style.positionAnchor = "--" + this.id;
        this.popover = dropdownList;
        this.setOptions(options, initial);
        element.appendChild(dropdownList);
    }
    getPass() {
        return this.options.filter(e => e.value == this.selected)[0].pass;
    }
    setOptions(options, initial) {
        this.options = options;
        this.selected = initial;
        this.value = initial;
        this.optEles = [];
        let name = "";
        for (let i = 0; i < this.options.length; i++) {
            if (this.options[i].value == initial) {
                name = this.options[i].name;
                break;
            }
        }
        this.selectedElement.innerHTML = sanitize(name);
        this.popover.innerHTML = "";
        for (let i = 0; i < options.length; i++) {
            let optEle = document.createElement("button");
            optEle.classList.add("dropdown-item");
            optEle.innerHTML = sanitize(options[i].name);
            optEle.onclick = (e) => {
                this.selectOption(options[i].value);
                this.onchange(options[i].value);
            }
            optEle.dataset.value = options[i].value;
            if (options[i].value == initial) {
                optEle.classList.add("selected");
            }
            this.popover.appendChild(optEle);
            this.optEles.push(optEle);
        }
    }
    selectOption(option) {
        let name = "";
        for (let i = 0; i < this.options.length; i++) {
            if (this.options[i].value == option) {
                name = this.options[i].name;
                break;
            }
        }
        this.selectedElement.innerHTML = sanitize(name);
        for (let i = 0; i < this.optEles.length; i++) {
            if (this.optEles[i].dataset.value == option) {
                this.optEles[i].classList.add("selected");
            } else {
                this.optEles[i].classList.remove("selected");
            }
        }
        this.selected = option;
        this.value = option;
        this.popover.hidePopover();
    }
    get getSelected() {
        return this.selected;
    }
    setOnChange(onchange) {
        this.onchange = onchange;
    }
    addOnChange(onchange) {
        this.onchange = onchange;
    }
}

class DialogDropdown {
    constructor(title, options, element, initial, onchange) {
        if (onchange) this.onchange = onchange;
        this.title = title;
        this.element = element;
        this.id = createId();
        let dropdownButton = document.createElement('button');
        dropdownButton.onclick = () => {
            dropdownList.showPopover();
        }
        element.style.anchorName = "--" + this.id;
        dropdownButton.classList.add('dropdown-button');
        element.appendChild(dropdownButton);
        element.classList.add('search-dropdown');
        let dropdownSearchInput = document.createElement("input");
        dropdownSearchInput.className = "dropdown-search-input";
        dropdownSearchInput.placeholder = "Search...";
        dropdownSearchInput.oninput = () => {
            this.filter();
        }
        element.appendChild(dropdownSearchInput);
        this.dropdownSearchInput = dropdownSearchInput;
        let dropdownInfo = document.createElement("div");
        dropdownInfo.classList.add("dropdown-info");
        let dropdownTitle = document.createElement("div");
        dropdownTitle.classList.add("dropdown-title");
        dropdownTitle.innerHTML = sanitize(title);
        let dropdownSelected = document.createElement("div");
        dropdownSelected.classList.add("dropdown-selected");
        dropdownInfo.appendChild(dropdownTitle);
        dropdownInfo.appendChild(dropdownSelected);
        dropdownButton.appendChild(dropdownInfo);
        this.selectedElement = dropdownSelected;
        let dropdownChevron = document.createElement("div");
        dropdownChevron.classList.add("dropdown-chevron");
        dropdownChevron.innerHTML = '<i class="fa-solid fa-chevron-down"></i>';
        dropdownButton.appendChild(dropdownChevron);
        let dropdownList = document.createElement("div");
        dropdownList.id = this.id;
        dropdownList.classList.add("dropdown-list-dialog");
        dropdownList.setAttribute("popover", "");
        dropdownList.style.positionAnchor = "--" + this.id;
        dropdownList.ontoggle = () => {
            this.dropdownSearchInput.value = "";
            this.filter();
            this.dropdownSearchInput.focus();
        }
        dropdownList.popover = "manual";
        document.addEventListener('pointerdown', (e) => {
            if (!dropdownList.matches(':popover-open')) return;
            const t = e.target;
            if (dropdownList.contains(t)) return;
            if (t === dropdownSearchInput || dropdownSearchInput.contains(t)) return;
            dropdownList.hidePopover();
        }, true);
        document.addEventListener('keydown', (e) => {
            if (e.key == "Escape") {
                dropdownList.hidePopover();
            }
        }, true);
        this.popover = dropdownList;
        this.setOptions(options, initial);
        element.appendChild(dropdownList);
    }
    getPass() {
        return this.options.filter(e => e.value == this.selected)[0] ? this.options.filter(e => e.value == this.selected)[0].pass : null;
    }
    filter() {
        let value = this.dropdownSearchInput.value.toLowerCase().trim();
        this.optEles.forEach(e => {
            if (!e.innerHTML.toLowerCase().includes(value)) {
                e.style.display = "none";
            } else {
                e.style.display = "";
            }
        });
    }
    setOptions(options, initial) {
        this.options = options;
        this.selected = initial;
        this.value = initial;
        this.optEles = [];
        let name = "";
        for (let i = 0; i < this.options.length; i++) {
            if (this.options[i].value == initial) {
                name = this.options[i].name;
                break;
            }
        }
        this.selectedElement.innerHTML = sanitize(name);
        this.popover.innerHTML = "";
        for (let i = 0; i < options.length; i++) {
            let optEle = document.createElement("button");
            optEle.classList.add("dropdown-item");
            optEle.innerHTML = sanitize(options[i].name);
            optEle.onclick = (e) => {
                this.selectOption(options[i].value);
            }
            optEle.dataset.value = options[i].value;
            if (options[i].value == initial) {
                optEle.classList.add("selected");
            }
            this.popover.appendChild(optEle);
            this.optEles.push(optEle);
        }
    }
    selectOption(option) {
        let name = "";
        for (let i = 0; i < this.options.length; i++) {
            if (this.options[i].value == option) {
                name = this.options[i].name;
                break;
            }
        }
        this.selectedElement.innerHTML = sanitize(name);
        for (let i = 0; i < this.optEles.length; i++) {
            if (this.optEles[i].dataset.value == option) {
                this.optEles[i].classList.add("selected");
            } else {
                this.optEles[i].classList.remove("selected");
            }
        }
        this.selected = option;
        this.value = option;
        this.popover.hidePopover();
        if (this.onchange) this.onchange(option);
    }
    get getSelected() {
        return this.selected;
    }
    addOnChange(onchange) {
        this.onchange = onchange;
    }
}

class Slider {
    constructor(element, min, max, initial, increment, unit) {
        element.classList.add("slider-wrapper");
        let slider = document.createElement("div");
        slider.className = "slider";
        let sliderInput = document.createElement("input");
        sliderInput.className = "slider-text-box";
        sliderInput.type = "number";
        element.appendChild(slider);
        element.appendChild(sliderInput);
        let initialPercentage = (initial - min) / (max - min) * 100;
        slider.style.setProperty('--slider-percentage', initialPercentage + "%");
        this.value = initial;

        let lowerBound = document.createElement("div");
        lowerBound.className = "slider-label-left";
        lowerBound.innerHTML = sanitize(min + " " + unit);

        let upperBound = document.createElement("div");
        upperBound.className = "slider-label-right";
        upperBound.innerHTML = sanitize(max + " " + unit);

        slider.appendChild(lowerBound);
        slider.appendChild(upperBound);

        sliderInput.value = initial;
        sliderInput.step = increment;
        slider.style.setProperty("--slider-transition", "width .1s, left .1s, scale .2s");
        sliderInput.oninput = () => {
            let rawValue = Number(sliderInput.value);
            if (rawValue < min) rawValue = min;
            if (rawValue > max) rawValue = max;
            let percentage = (rawValue - min) / (max - min) * 100;
            slider.style.setProperty('--slider-percentage', percentage + "%");
            this.value = rawValue;
            if (this.onchange) this.onchange(this.value);
        }
        sliderInput.onchange = () => {
            let rawValue = Number(sliderInput.value);
            if (rawValue < min) rawValue = min;
            if (rawValue > max) rawValue = max;
            sliderInput.value = rawValue;
            let percentage = (rawValue - min) / (max - min) * 100;
            slider.style.setProperty('--slider-percentage', percentage + "%");
            this.value = rawValue;
            if (this.onchange) this.onchange(this.value);
        }
        slider.onclick = (event) => {
            slider.style.setProperty("--slider-transition", "width .1s, left .1s, scale .2s");
            const rect = slider.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const percentage = Math.max(0, Math.min(1, x / rect.width));
            let value = min + percentage * (max - min);
            let snappedValue = Math.round(value / increment) * increment;
            snappedValue = Math.max(min, Math.min(max, snappedValue));
            sliderInput.value = snappedValue;
            slider.style.setProperty('--slider-percentage', ((snappedValue - min) / (max - min) * 100) + "%");
            this.value = snappedValue;
            sliderInput.dispatchEvent(new Event('input'));
            if (this.onchange) this.onchange(this.value);
        };
        let isDragging = false;

        slider.onmousedown = (event) => {
            isDragging = true;
            document.body.style.userSelect = "none";
            slider.style.setProperty("--slider-transition", "scale .2s");
        };

        document.addEventListener("mousemove", (event) => {
            if (!isDragging) return;
            const rect = slider.getBoundingClientRect();
            let x = event.clientX - rect.left;
            x = Math.max(0, Math.min(rect.width, x));
            const percentage = x / rect.width;
            let value = min + percentage * (max - min);
            let snappedValue = Math.round(value / increment) * increment;
            snappedValue = Math.max(min, Math.min(max, snappedValue));
            sliderInput.value = snappedValue;
            slider.style.setProperty('--slider-percentage', ((snappedValue - min) / (max - min) * 100) + "%");
            this.value = snappedValue;
            sliderInput.dispatchEvent(new Event('input'));
            if (this.onchange) this.onchange(this.value);
        });

        document.addEventListener("mouseup", () => {
            if (isDragging) {
                isDragging = false;
                document.body.style.userSelect = "";
            }
        });
    }

    addOnChange(onchange) {
        this.onchange = onchange;
    }
}

class Toggle {
    constructor(element, onchange, startToggled) {
        element.classList.add("toggle");
        this.element = element;
        this.onchange = onchange;
        let insideToggle = document.createElement("div");
        insideToggle.classList.add("toggle-inside");
        element.appendChild(insideToggle);
        element.onclick = (e) => {
            this.processToggle();
        }
        if (startToggled) {
            this.toggled = true;
            this.value = true;
            element.classList.add("toggled");
        } else {
            this.toggled = false;
            this.value = false;
        }
    }
    processToggle() {
        if (this.toggled) {
            this.element.classList.remove("toggled");
        } else {
            this.element.classList.add("toggled");
        }
        this.toggled = !this.toggled;
        this.value = this.toggled;
        this.onchange(this.toggled);
    }
    setValueWithoutTrigger(v) {
        this.toggled = v;
        this.value = v;
        if (!this.toggled) {
            this.element.classList.remove("toggled");
        } else {
            this.element.classList.add("toggled");
        }
    }
    toggle() {
        this.processToggle();
    }
}

class ContentList {
    /* features: {
        "checkbox": {
            "enabled": true,
            "actionsList": ContextMenuButtons
        },
        "disable": {
            "enabled": true
        },
        "remove": {
            "enabled": true
        },
        "more": {
            "enabled": true,
            "actionsList": ContextMenuButtons
        },
        "second_column_centered": false,
        "primary_column_name": "Name",
        "secondary_column_name": "File Info",
        "refresh": {
            "enabled": true,
            "func": () => {}
        },
        "update_all": {
            "enabled": true,
            "func": () => {}
        }
    } */
    constructor(element, content, searchBar, features, filter, notFoundMessage = translate("app.list.no_results_found")) {
        let notFoundElement = new NoResultsFound(notFoundMessage).element;
        notFoundElement.style.background = "transparent";
        this.checkBoxes = [];
        element.classList.add("content-list-wrapper");
        let contentListTop = document.createElement("div");
        contentListTop.className = "content-list-top";
        element.appendChild(contentListTop);
        if (features?.checkbox?.enabled) {
            let checkboxElement = document.createElement("input");
            checkboxElement.type = "checkbox";
            checkboxElement.className = "content-list-checkbox content-list-checkbox-top";
            checkboxElement.onchange = (e) => {
                if (checkboxElement.checked) {
                    this.checkCheckboxes();
                } else {
                    this.uncheckCheckboxes();
                }
            }
            this.checkBox = checkboxElement;
            contentListTop.appendChild(checkboxElement);

            this.checkBoxActions = [];

            if (features.checkbox.actionsList) features.checkbox.actionsList.forEach(e => {
                let actionElement = document.createElement("button");
                actionElement.className = "selected-button";
                actionElement.innerHTML = e.icon + e.title;
                actionElement.style.display = "none";
                if (e.danger) {
                    actionElement.classList.add("danger");
                }
                actionElement.onclick = async () => {
                    if (e.func_id) {
                        if (e.func_id == "disable") {
                            this.checkBoxes.forEach(c => {
                                if (c.element.checked && isNotDisplayNone(c.element) && c.toggle.toggled) {
                                    c.toggle.toggle();
                                }
                            });
                            this.uncheckCheckboxes();
                            this.figureOutMainCheckedState();
                        } else if (e.func_id == "enable") {
                            this.checkBoxes.forEach(c => {
                                if (c.element.checked && isNotDisplayNone(c.element) && !c.toggle.toggled) {
                                    c.toggle.toggle();
                                }
                            });
                            this.uncheckCheckboxes();
                            this.figureOutMainCheckedState();
                        }
                        return;
                    }
                    if (e.show_confirmation_dialog) {
                        let dialog = new Dialog();
                        dialog.showDialog(e.dialog_title, "notice", e.dialog_content.replace("%s", this.checkBoxes.filter(c => c.element.checked && isNotDisplayNone(c.element)).length), [
                            {
                                "type": "cancel",
                                "content": "Cancel"
                            },
                            {
                                "type": "confirm",
                                "content": e.dialog_button
                            }
                        ], [], async () => {
                            if (e.dont_loop) {
                                let eles = [];
                                let infos = [];
                                for (let i = 0; i < this.checkBoxes.length; i++) {
                                    let c = this.checkBoxes[i];
                                    if (c.element.checked && isNotDisplayNone(c.element)) {
                                        eles.push(c.element.parentElement);
                                        infos.push(c.content_info);
                                    }
                                }
                                e.func(eles, infos);
                                this.uncheckCheckboxes();
                                this.figureOutMainCheckedState();
                                return;
                            }
                            for (let i = 0; i < this.checkBoxes.length; i++) {
                                let c = this.checkBoxes[i];
                                if (c.element.checked && isNotDisplayNone(c.element)) {
                                    e.func(c.element.parentElement, c.content_info);
                                }
                            }
                            this.uncheckCheckboxes();
                            this.figureOutMainCheckedState();
                        });
                        return;
                    }
                    if (e.dont_loop) {
                        let eles = [];
                        let infos = [];
                        for (let i = 0; i < this.checkBoxes.length; i++) {
                            let c = this.checkBoxes[i];
                            if (c.element.checked && isNotDisplayNone(c.element)) {
                                eles.push(c.element.parentElement);
                                infos.push(c.content_info);
                            }
                        }
                        e.func(eles, infos);
                        this.uncheckCheckboxes();
                        this.figureOutMainCheckedState();
                        return;
                    }
                    for (let i = 0; i < this.checkBoxes.length; i++) {
                        let c = this.checkBoxes[i];
                        if (c.element.checked && isNotDisplayNone(c.element)) {
                            e.func(c.element.parentElement, c.content_info);
                        }
                    }
                    this.uncheckCheckboxes();
                    this.figureOutMainCheckedState();
                }
                this.checkBoxActions.push(actionElement);
                contentListTop.appendChild(actionElement);
            });
        }
        let primaryColumnTitle = document.createElement("div");
        primaryColumnTitle.className = "content-list-title";
        primaryColumnTitle.innerHTML = sanitize(features?.primary_column_name);
        contentListTop.appendChild(primaryColumnTitle);
        let secondaryColumnTitle = document.createElement("div");
        secondaryColumnTitle.className = "content-list-title";
        secondaryColumnTitle.innerHTML = sanitize(features?.secondary_column_name);
        contentListTop.appendChild(secondaryColumnTitle);
        if (features?.refresh?.enabled) {
            let refreshButton = document.createElement("button");
            refreshButton.className = "content-list-refresh";
            refreshButton.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i>' + sanitize(translate("app.button.content.refresh"));
            refreshButton.onclick = features.refresh.func;
            contentListTop.appendChild(refreshButton);
        }
        if (features?.update_all?.enabled) {
            let updateAllButton = document.createElement("button");
            updateAllButton.className = "content-list-update-all";
            updateAllButton.innerHTML = '<i class="fa-solid fa-download"></i>' + translate("app.button.content.update_all");
            updateAllButton.onclick = () => {
                features.update_all.func(updateAllButton);
            }
            updateAllButton.title = translate("app.content.update_all.context");
            contentListTop.appendChild(updateAllButton);
        }

        let applyFilters = (search, dropdown) => {
            let numShown = 0;
            for (let i = 0; i < this.items.length; i++) {
                if (this.items[i].name.toLowerCase().includes(search.toLowerCase().trim()) && (this.items[i].type == dropdown || dropdown == "all")) {
                    this.items[i].element.style.display = "flex";
                    this.items[i].element.classList.remove("hidden");
                    numShown++;
                } else {
                    this.items[i].element.style.display = "none";
                    this.items[i].element.classList.add("hidden");
                }
            }
            notFoundElement.style.display = numShown ? "none" : "";
            this.figureOutMainCheckedState();
        }

        searchBar.setOnInput((v) => {
            applyFilters(v, filter.value);
        });

        filter.setOnChange((v) => {
            applyFilters(searchBar.value, v);
        });

        let contentMainElement = document.createElement("div");
        contentMainElement.className = "content-list";

        contentMainElement.appendChild(notFoundElement);
        notFoundElement.style.display = "none";
        if (!content.length) {
            notFoundElement.style.display = "";
        }

        this.items = [];
        this.second_column_elements = [];
        for (let i = 0; i < content.length; i++) {
            let contentEle = document.createElement("div");
            contentEle.classList.add("content-list-item");
            if (content[i].class) contentEle.classList.add(content[i].class);
            if (content[i].type) contentEle.setAttribute("data-type", content[i].type);
            this.items.push({ "name": [content[i].primary_column.title, content[i].primary_column.desc, content[i].secondary_column.title(), content[i].secondary_column.desc()].join("!!!!!!!!!!"), "element": contentEle, "type": content[i].type });
            let checkboxElement;
            if (features?.checkbox?.enabled) {
                checkboxElement = document.createElement("input");
                checkboxElement.type = "checkbox";
                checkboxElement.className = "content-list-checkbox";
                checkboxElement.onchange = (e) => {
                    this.figureOutMainCheckedState();
                }
                contentEle.appendChild(checkboxElement);
            }
            let imageElement = document.createElement("img");
            imageElement.className = "content-list-image";
            imageElement.src = fixPathForImage(content[i].image ? content[i].image : "default.png");
            imageElement.loading = "lazy";
            contentEle.appendChild(imageElement);
            let infoElement1 = document.createElement("div");
            infoElement1.className = "content-list-info";
            contentEle.appendChild(infoElement1);
            let infoElement1Title = document.createElement("div");
            infoElement1Title.className = "content-list-info-title-1";
            infoElement1Title.innerHTML = parseMinecraftFormatting(content[i].primary_column.title);
            infoElement1.appendChild(infoElement1Title);
            let infoElement1Desc = document.createElement("div");
            infoElement1Desc.className = "content-list-info-desc-1";
            infoElement1Desc.innerHTML = sanitize(content[i].primary_column.desc);
            infoElement1.appendChild(infoElement1Desc);
            let infoElement2 = document.createElement("div");
            infoElement2.className = "content-list-info";
            contentEle.appendChild(infoElement2);
            let infoElement2Title = document.createElement("div");
            infoElement2Title.className = "content-list-info-title-2";
            infoElement2Title.innerHTML = sanitize(content[i].secondary_column.title());
            infoElement2.appendChild(infoElement2Title);
            let infoElement2Desc = document.createElement("div");
            infoElement2Desc.className = "content-list-info-desc-2";
            infoElement2Desc.innerHTML = (content[i].secondary_column.desc());
            this.second_column_elements.push({
                infoElement2Title,
                infoElement2Desc,
                "title_func": content[i].secondary_column.title,
                "desc_func": content[i].secondary_column.desc
            })
            if (content[i]?.secondary_column?.desc_hidden) {
                infoElement2Desc.style.width = "fit-content";
                infoElement2Desc.classList.add("hidden-text");
                infoElement2Desc.onclick = () => {
                    infoElement2Desc.classList.add("shown");
                }
            }
            infoElement2.appendChild(infoElement2Desc);
            let toggle;
            if (features?.disable?.enabled) {
                let toggleElement = document.createElement("button");
                toggleElement.className = 'content-list-toggle';
                toggle = new Toggle(toggleElement, (v) => {
                    let result = toggleDisabledContent(content[i], theActionList, toggle, moreDropdown);
                    if (!result) {
                        toggle.setValueWithoutTrigger(!v);
                        return;
                    }
                    if (infoElement2Desc.innerHTML.endsWith(".disabled")) {
                        infoElement2Desc.innerHTML = sanitize(infoElement2Desc.innerHTML.slice(0, -9));
                    } else {
                        infoElement2Desc.innerHTML = sanitize(infoElement2Desc.innerHTML + ".disabled");
                    }
                }, !content[i].disabled);
                contentEle.appendChild(toggleElement);
            }
            if (checkboxElement) {
                this.checkBoxes.push({ "element": checkboxElement, "content_info": content[i].pass_to_checkbox, "toggle": toggle });
            }
            if (features?.remove?.enabled) {
                let removeElement = document.createElement("button");
                removeElement.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
                removeElement.className = 'content-list-remove';
                removeElement.onclick = () => {
                    content[i].onremove(contentEle);
                }
                contentEle.appendChild(removeElement);
            }
            let theActionList;
            let moreDropdown;
            if (features?.more?.enabled) {
                let actionList = content[i].more.actionsList;
                actionList = actionList.map(e => {
                    let func = () => { };
                    if (e.func) func = e.func;
                    if (e.func_id == "toggle") {
                        func = () => {
                            if (toggle) toggle.toggle();
                        }
                    }
                    if (e.func_id == "delete") {
                        func = () => {
                            e.func(contentEle);
                        }
                    }
                    return {
                        "title": e.title,
                        "icon": e.icon,
                        "func": func,
                        "func_id": e.func_id,
                        "danger": e.danger ?? false
                    }
                })
                theActionList = new ContextMenuButtons(actionList);
                contentEle.oncontextmenu = (e) => {
                    contextmenu.showContextMenu(theActionList, e.clientX, e.clientY);
                }
                let moreElement = document.createElement("button");
                moreElement.innerHTML = '<i class="fa-solid fa-ellipsis-vertical"></i>';
                moreElement.className = 'content-list-more';
                moreDropdown = new MoreMenu(moreElement, theActionList);
                contentEle.appendChild(moreElement);
            }
            contentMainElement.appendChild(contentEle);
        }
        element.appendChild(contentMainElement);
    }

    updateSecondaryColumn() {
        let list = this.second_column_elements;
        list.forEach(e => {
            e.infoElement2Title.innerHTML = sanitize(e.title_func());
            e.infoElement2Desc.innerHTML = sanitize(e.desc_func());
        });
    }

    figureOutMainCheckedState() {
        if (!this.checkBox) return;
        let total = 0;
        let checked = 0;
        let checkboxes = this.checkBoxes.map(e => e.element);
        for (let i = 0; i < checkboxes.length; i++) {
            if (checkboxes[i].checked && isNotDisplayNone(checkboxes[i])) {
                checked++;
            }
            if (isNotDisplayNone(checkboxes[i])) {
                total++;
            }
        }
        if (total == checked && total != 0) {
            this.checkBox.checked = true;
            this.checkBox.indeterminate = false;
        } else if (checked > 0) {
            this.checkBox.checked = false;
            this.checkBox.indeterminate = true;
        } else {
            this.checkBox.checked = false;
            this.checkBox.indeterminate = false;
        }
        if (checked == 0) {
            this.checkBoxActions.forEach(e => e.style.display = "none");
        } else {
            this.checkBoxActions.forEach(e => e.style.display = "");
        }
    }
    checkCheckboxes() {
        this.checkBoxes.map(e => e.element).forEach((e) => {
            if (isNotDisplayNone(e)) e.checked = true;
        });
        this.checkBoxActions.forEach(e => e.style.display = "");
    }
    uncheckCheckboxes() {
        this.checkBoxes.map(e => e.element).forEach((e) => {
            if (isNotDisplayNone(e)) e.checked = false;
        });
        this.checkBoxActions.forEach(e => e.style.display = "none");
    }
}

function toggleDisabledContent(contentInfo, theActionList, toggle, moreDropdown) {
    let content = contentInfo.instance_info.getContent();
    for (let i = 0; i < content.length; i++) {
        let e = content[i];
        if (e.file_name == contentInfo.secondary_column.desc()) {
            let file_path = processRelativePath(`./minecraft/instances/${contentInfo.instance_info.instance_id}/${e.type == "mod" ? "mods" : e.type == "resource_pack" ? "resourcepacks" : "shaderpacks"}/` + e.file_name);
            if (e.disabled) {
                let new_file_name = window.electronAPI.enableFile(file_path);
                if (!new_file_name) {
                    displayError(translate("app.error.failure_to_enable"));
                    return;
                }
                e.setDisabled(false);
                e.setFileName(new_file_name);
                contentInfo.secondary_column.desc = () => new_file_name;
                displaySuccess(translate("app.content.success_enable").replace("%s", e.name));
            } else {
                console.log("disabling file: " + file_path);
                let new_file_name = window.electronAPI.disableFile(file_path);
                if (!new_file_name) {
                    displayError(translate("app.error.failure_to_disable"));
                    return;
                }
                e.setDisabled(true);
                e.setFileName(new_file_name);
                contentInfo.secondary_column.desc = () => new_file_name;
                displaySuccess(translate("app.content.success_disable").replace("%s", e.name));
            }
            break;
        }
    }
    if (!theActionList) return;
    const toggleIndex = theActionList.buttons.findIndex(
        btn => btn.func_id === "toggle"
    );
    if (toggleIndex !== -1) {
        const isDisabled = !toggle.value;
        theActionList.buttons[toggleIndex].title = isDisabled
            ? translate("app.content.enable")
            : translate("app.content.disable");
        theActionList.buttons[toggleIndex].icon = isDisabled
            ? '<i class="fa-solid fa-eye"></i>'
            : '<i class="fa-solid fa-eye-slash"></i>';
    }
    moreDropdown.element.innerHTML = "";
    for (let i = 0; i < theActionList.buttons.length; i++) {
        let buttonElement = document.createElement("button");
        buttonElement.classList.add("context-menu-button");
        buttonElement.innerHTML = theActionList.buttons[i].icon + sanitize(theActionList.buttons[i].title);
        if (theActionList.buttons[i].danger) {
            buttonElement.classList.add("danger");
        }
        buttonElement.onclick = (e) => {
            moreDropdown.element.hidePopover();
            theActionList.buttons[i].func(new MenuOption(buttonElement, theActionList.buttons[i].title, theActionList.buttons[i].icon));
        }
        moreDropdown.element.appendChild(buttonElement);
    }
    return true;
}

let keys = {
    "key.keyboard.apostrophe": "'",
    "key.keyboard.backslash": "\\",
    "key.keyboard.backspace": "Backspace",
    "key.keyboard.caps.lock": "Caps Lock",
    "key.keyboard.comma": ",",
    "key.keyboard.delete": "Delete",
    "key.keyboard.down": "Down Arrow",
    "key.keyboard.end": "End",
    "key.keyboard.enter": "Enter",
    "key.keyboard.equal": "=",
    "key.keyboard.f1": "F1",
    "key.keyboard.f2": "F2",
    "key.keyboard.f3": "F3",
    "key.keyboard.f4": "F4",
    "key.keyboard.f5": "F5",
    "key.keyboard.f6": "F6",
    "key.keyboard.f7": "F7",
    "key.keyboard.f8": "F8",
    "key.keyboard.f9": "F9",
    "key.keyboard.f10": "F10",
    "key.keyboard.f11": "F11",
    "key.keyboard.f12": "F12",
    "key.keyboard.f13": "F13",
    "key.keyboard.f14": "F14",
    "key.keyboard.f15": "F15",
    "key.keyboard.f16": "F16",
    "key.keyboard.f17": "F17",
    "key.keyboard.f18": "F18",
    "key.keyboard.f19": "F19",
    "key.keyboard.f20": "F20",
    "key.keyboard.f21": "F21",
    "key.keyboard.f22": "F22",
    "key.keyboard.f23": "F23",
    "key.keyboard.f24": "F24",
    "key.keyboard.f25": "F25",
    "key.keyboard.grave.accent": "`",
    "key.keyboard.home": "Home",
    "key.keyboard.insert": "Insert",
    "key.keyboard.keypad.0": "Keypad 0",
    "key.keyboard.keypad.1": "Keypad 1",
    "key.keyboard.keypad.2": "Keypad 2",
    "key.keyboard.keypad.3": "Keypad 3",
    "key.keyboard.keypad.4": "Keypad 4",
    "key.keyboard.keypad.5": "Keypad 5",
    "key.keyboard.keypad.6": "Keypad 6",
    "key.keyboard.keypad.7": "Keypad 7",
    "key.keyboard.keypad.8": "Keypad 8",
    "key.keyboard.keypad.9": "Keypad 9",
    "key.keyboard.keypad.add": "Keypad +",
    "key.keyboard.keypad.decimal": "Keypad Decimal",
    "key.keyboard.keypad.divide": "Keypad /",
    "key.keyboard.keypad.enter": "Keypad Enter",
    "key.keyboard.keypad.equal": "Keypad =",
    "key.keyboard.keypad.multiply": "Keypad *",
    "key.keyboard.keypad.subtract": "Keypad -",
    "key.keyboard.left": "Left Arrow",
    "key.keyboard.left.alt": "Left Alt",
    "key.keyboard.left.bracket": "[",
    "key.keyboard.left.control": "Left Control",
    "key.keyboard.left.shift": "Left Shift",
    "key.keyboard.left.win": "Left Win",
    "key.keyboard.menu": "Menu",
    "key.keyboard.minus": "-",
    "key.keyboard.num.lock": "Num Lock",
    "key.keyboard.page.down": "Page Down",
    "key.keyboard.page.up": "Page Up",
    "key.keyboard.pause": "Pause",
    "key.keyboard.period": ".",
    "key.keyboard.print.screen": "Print Screen",
    "key.keyboard.right": "Right Arrow",
    "key.keyboard.right.alt": "Right Alt",
    "key.keyboard.right.bracket": "]",
    "key.keyboard.right.control": "Right Control",
    "key.keyboard.right.shift": "Right Shift",
    "key.keyboard.right.win": "Right Win",
    "key.keyboard.scroll.lock": "Scroll Lock",
    "key.keyboard.semicolon": ";",
    "key.keyboard.slash": "/",
    "key.keyboard.space": "Space",
    "key.keyboard.tab": "Tab",
    "key.keyboard.unknown": "Not Bound",
    "key.keyboard.up": "Up Arrow",
    "key.keyboard.a": "A",
    "key.keyboard.b": "B",
    "key.keyboard.c": "C",
    "key.keyboard.d": "D",
    "key.keyboard.e": "E",
    "key.keyboard.f": "F",
    "key.keyboard.g": "G",
    "key.keyboard.h": "H",
    "key.keyboard.i": "I",
    "key.keyboard.j": "J",
    "key.keyboard.k": "K",
    "key.keyboard.l": "L",
    "key.keyboard.m": "M",
    "key.keyboard.n": "N",
    "key.keyboard.o": "O",
    "key.keyboard.p": "P",
    "key.keyboard.q": "Q",
    "key.keyboard.r": "R",
    "key.keyboard.s": "S",
    "key.keyboard.t": "T",
    "key.keyboard.u": "U",
    "key.keyboard.v": "V",
    "key.keyboard.w": "W",
    "key.keyboard.x": "X",
    "key.keyboard.y": "Y",
    "key.keyboard.z": "Z",
    "key.keyboard.0": "0",
    "key.keyboard.1": "1",
    "key.keyboard.2": "2",
    "key.keyboard.3": "3",
    "key.keyboard.4": "4",
    "key.keyboard.5": "5",
    "key.keyboard.6": "6",
    "key.keyboard.7": "7",
    "key.keyboard.8": "8",
    "key.keyboard.9": "9",
    "key.mouse.left": "Left Button",
    "key.mouse.middle": "Middle Button",
    "key.mouse.right": "Right Button",
    "key.mouse.1": "Button 1",
    "key.mouse.2": "Button 2",
    "key.mouse.3": "Button 3",
    "key.mouse.4": "Button 4",
    "key.mouse.5": "Button 5",
    "key.mouse.6": "Button 6",
    "key.mouse.7": "Button 7",
    "key.mouse.8": "Button 8",
    "key.mouse.9": "Button 9",
    "key.mouse.10": "Button 10",
    "key.mouse.11": "Button 11",
    "key.mouse.12": "Button 12",
    "key.mouse.13": "Button 13",
    "key.mouse.14": "Button 14",
    "key.mouse.15": "Button 15",
    "key.mouse.16": "Button 16",
    "key.mouse.17": "Button 17",
    "key.mouse.18": "Button 18",
    "key.mouse.19": "Button 19",
    "key.mouse.20": "Button 20"
}
let codeToKey = {
    "Backquote": "key.keyboard.grave.accent",
    "Backslash": "key.keyboard.backslash",
    "Backspace": "key.keyboard.backspace",
    "BracketLeft": "key.keyboard.left.bracket",
    "BracketRight": "key.keyboard.right.bracket",
    "Comma": "key.keyboard.comma",
    "Delete": "key.keyboard.delete",
    "Digit0": "key.keyboard.0",
    "Digit1": "key.keyboard.1",
    "Digit2": "key.keyboard.2",
    "Digit3": "key.keyboard.3",
    "Digit4": "key.keyboard.4",
    "Digit5": "key.keyboard.5",
    "Digit6": "key.keyboard.6",
    "Digit7": "key.keyboard.7",
    "Digit8": "key.keyboard.8",
    "Digit9": "key.keyboard.9",
    "End": "key.keyboard.end",
    "Enter": "key.keyboard.enter",
    "Equal": "key.keyboard.equal",
    "Escape": "key.keyboard.unknown",
    "F1": "key.keyboard.f1",
    "F2": "key.keyboard.f2",
    "F3": "key.keyboard.f3",
    "F4": "key.keyboard.f4",
    "F5": "key.keyboard.f5",
    "F6": "key.keyboard.f6",
    "F7": "key.keyboard.f7",
    "F8": "key.keyboard.f8",
    "F9": "key.keyboard.f9",
    "F10": "key.keyboard.f10",
    "F11": "key.keyboard.f11",
    "F12": "key.keyboard.f12",
    "F13": "key.keyboard.f13",
    "F14": "key.keyboard.f14",
    "F15": "key.keyboard.f15",
    "F16": "key.keyboard.f16",
    "F17": "key.keyboard.f17",
    "F18": "key.keyboard.f18",
    "F19": "key.keyboard.f19",
    "F20": "key.keyboard.f20",
    "F21": "key.keyboard.f21",
    "F22": "key.keyboard.f22",
    "F23": "key.keyboard.f23",
    "F24": "key.keyboard.f24",
    "Home": "key.keyboard.home",
    "Insert": "key.keyboard.insert",
    "KeyA": "key.keyboard.a",
    "KeyB": "key.keyboard.b",
    "KeyC": "key.keyboard.c",
    "KeyD": "key.keyboard.d",
    "KeyE": "key.keyboard.e",
    "KeyF": "key.keyboard.f",
    "KeyG": "key.keyboard.g",
    "KeyH": "key.keyboard.h",
    "KeyI": "key.keyboard.i",
    "KeyJ": "key.keyboard.j",
    "KeyK": "key.keyboard.k",
    "KeyL": "key.keyboard.l",
    "KeyM": "key.keyboard.m",
    "KeyN": "key.keyboard.n",
    "KeyO": "key.keyboard.o",
    "KeyP": "key.keyboard.p",
    "KeyQ": "key.keyboard.q",
    "KeyR": "key.keyboard.r",
    "KeyS": "key.keyboard.s",
    "KeyT": "key.keyboard.t",
    "KeyU": "key.keyboard.u",
    "KeyV": "key.keyboard.v",
    "KeyW": "key.keyboard.w",
    "KeyX": "key.keyboard.x",
    "KeyY": "key.keyboard.y",
    "KeyZ": "key.keyboard.z",
    "Minus": "key.keyboard.minus",
    "PageDown": "key.keyboard.page.down",
    "PageUp": "key.keyboard.page.up",
    "Pause": "key.keyboard.pause",
    "Period": "key.keyboard.period",
    "Quote": "key.keyboard.apostrophe",
    "ScrollLock": "key.keyboard.scroll.lock",
    "Semicolon": "key.keyboard.semicolon",
    "ShiftLeft": "key.keyboard.left.shift",
    "ShiftRight": "key.keyboard.right.shift",
    "Slash": "key.keyboard.slash",
    "Space": "key.keyboard.space",
    "Tab": "key.keyboard.tab",
    "ArrowDown": "key.keyboard.down",
    "ArrowLeft": "key.keyboard.left",
    "ArrowRight": "key.keyboard.right",
    "ArrowUp": "key.keyboard.up",
    "AltLeft": "key.keyboard.left.alt",
    "AltRight": "key.keyboard.right.alt",
    "ControlLeft": "key.keyboard.left.control",
    "ControlRight": "key.keyboard.right.control",
    "MetaLeft": "key.keyboard.left.win",
    "MetaRight": "key.keyboard.right.win",
    "ContextMenu": "key.keyboard.menu",
    "NumLock": "key.keyboard.num.lock",
    "Numpad0": "key.keyboard.keypad.0",
    "Numpad1": "key.keyboard.keypad.1",
    "Numpad2": "key.keyboard.keypad.2",
    "Numpad3": "key.keyboard.keypad.3",
    "Numpad4": "key.keyboard.keypad.4",
    "Numpad5": "key.keyboard.keypad.5",
    "Numpad6": "key.keyboard.keypad.6",
    "Numpad7": "key.keyboard.keypad.7",
    "Numpad8": "key.keyboard.keypad.8",
    "Numpad9": "key.keyboard.keypad.9",
    "NumpadAdd": "key.keyboard.keypad.add",
    "NumpadDecimal": "key.keyboard.keypad.decimal",
    "NumpadDivide": "key.keyboard.keypad.divide",
    "NumpadEnter": "key.keyboard.keypad.enter",
    "NumpadEqual": "key.keyboard.keypad.equal",
    "NumpadMultiply": "key.keyboard.keypad.multiply",
    "NumpadSubtract": "key.keyboard.keypad.subtract",
    "CapsLock": "key.keyboard.caps.lock",
    "PrintScreen": "key.keyboard.print.screen"
}

let homeContent = new PageContent(showHome, "home");
let instanceContent = new PageContent(showInstanceContent, "instances");
let discoverContent = new PageContent(null, "discover");
let wardrobeContent = new PageContent(showWardrobeContent, "wardrobe");
let contextmenu = new ContextMenu();
let homeButton = new NavigationButton(homeButtonEle, translate("app.page.home"), '<i class="fa-solid fa-house"></i>', homeContent);
let instanceButton = new NavigationButton(instanceButtonEle, translate("app.page.instances"), '<i class="fa-solid fa-book"></i>', instanceContent);
let discoverButton = new NavigationButton(discoverButtonEle, translate("app.page.discover"), '<i class="fa-solid fa-compass"></i>', discoverContent);
let settingsButton = new NavigationButton(settingsButtonEle, translate("app.settings"), '<i class="fa-solid fa-gear"></i>');
let wardrobeButton = new NavigationButton(wardrobeButtonEle, translate("app.page.wardrobe"), '<i class="fa-solid fa-user"></i>', wardrobeContent);

settingsButtonEle.onclick = () => {
    let selectedKeySelect;
    let selectedKeySelectFunction;
    document.body.addEventListener("keydown", (e) => {
        if (selectedKeySelect) {
            e.preventDefault();
            e.stopPropagation();
            let keyCode = codeToKey[e.code];
            if (e.key == "NumLock") {
                keyCode = codeToKey["NumLock"];
            }
            if (keyCode) {
                selectedKeySelect.innerHTML = keys[keyCode] || keyCode;
                selectedKeySelect.value = keyCode;
            } else {
                selectedKeySelect.innerHTML = keys["key.keyboard.unknown"];
                selectedKeySelect.value = "key.keyboard.unknown";
            }
            selectedKeySelect.classList.remove("selected");
            let key = selectedKeySelect.getAttribute("data-key")
            selectedKeySelect = null;
            defaultOptions.setDefault(key, keyCode ? keyCode : "key.keyboard.unknown");
            displaySuccess(translate("app.options.updated_default"));
            if (selectedKeySelectFunction) selectedKeySelectFunction(keyCode ? keyCode : "key.keyboard.unknown");
        }
    });

    document.body.addEventListener("mousedown", (e) => {
        if (selectedKeySelect) {
            e.preventDefault();
            e.stopPropagation();
            let mouseKey;
            if (e.button === 0) mouseKey = "key.mouse.left";
            else if (e.button === 1) mouseKey = "key.mouse.middle";
            else if (e.button === 2) mouseKey = "key.mouse.right";
            else if (e.button >= 3 && e.button <= 20) mouseKey = `key.mouse.${e.button + 1}`;
            else mouseKey = "key.keyboard.unknown";
            selectedKeySelect.innerHTML = keys[mouseKey] || mouseKey;
            selectedKeySelect.classList.remove("selected");
            selectedKeySelect.value = mouseKey;
            let key = selectedKeySelect.getAttribute("data-key")
            selectedKeySelect = null;
            defaultOptions.setDefault(key, mouseKey ? mouseKey : "key.keyboard.unknown");
            displaySuccess(translate("app.options.updated_default"));
            if (selectedKeySelectFunction) selectedKeySelectFunction(mouseKey);
        }
    });
    let defaultOptions = new DefaultOptions();
    let values = db.prepare("SELECT * FROM options_defaults WHERE key != ?").all("version");
    let def_opts = document.createElement("div");
    def_opts.className = "option-list";
    let generateUIForOptions = (values) => {
        def_opts.innerHTML = "";
        for (let i = 0; i < values.length; i++) {
            let e = values[i];
            let item = document.createElement("div");
            item.className = "option-item";
            values[i].element = item;

            let titleElement = document.createElement("div");
            titleElement.className = "option-title";
            titleElement.innerHTML = e.key;
            item.appendChild(titleElement);

            let onChange = (v) => {
                values[i].value = (type == "text" ? '"' + v + '"' : v);
                if (defaultOptions.getDefault(e.key) == (type == "text" ? '"' + v + '"' : v)) {
                    setDefaultButton.innerHTML = '<i class="fa-solid fa-minus"></i>' + translate("app.options.default.remove");
                    setDefaultButton.onclick = onRemove;
                } else {
                    setDefaultButton.innerHTML = '<i class="fa-solid fa-plus"></i>' + translate("app.options.default.set");
                    setDefaultButton.onclick = onSet;
                }
            }

            let type = "unknown";
            if (!isNaN(e.value) && e.value !== "" && typeof e.value === "string" && e.value.trim() !== "") {
                type = "number";
            }
            if (e.value == "false" || e.value == "true") {
                type = "boolean";
            }
            if (e.value.startsWith('"') && e.value.endsWith('"')) {
                type = "text";
            }
            if (e.value.startsWith("key.")) {
                type = "key";
            }
            let inputElement;
            item.setAttribute("data-type", type);
            if (type == "text") {
                inputElement = document.createElement("input");
                inputElement.className = "option-input";
                inputElement.value = e.value.slice(1, -1);
                inputElement.onchange = () => {
                    defaultOptions.setDefault(e.key, '"' + inputElement.value + '"');
                    displaySuccess(translate("app.options.updated_default"));
                    values[i].value = '"' + inputElement.value + '"';
                    oldvalue = inputElement.value;
                    onChange(inputElement.value);
                }
                item.appendChild(inputElement);
            } else if (type == "number") {
                inputElement = document.createElement("input");
                inputElement.className = "option-input";
                inputElement.value = e.value;
                inputElement.type = "number";
                inputElement.onchange = () => {
                    defaultOptions.setDefault(e.key, inputElement.value);
                    displaySuccess(translate("app.options.updated_default"));
                    values[i].value = inputElement.value;
                    oldvalue = inputElement.value;
                    onChange(inputElement.value);
                }
                item.appendChild(inputElement);
            } else if (type == "boolean") {
                let inputElement1 = document.createElement("div");
                inputElement1.className = "option-input";
                inputElement = new SearchDropdown("", [{ "name": translate("app.options.true"), "value": "true" }, { "name": translate("app.options.false"), "value": "false" }], inputElement1, e.value, (v) => {
                    defaultOptions.setDefault(e.key, v);
                    displaySuccess(translate("app.options.updated_default"));
                    values[i].value = v;
                    oldvalue = v;
                    onChange(v);
                });
                item.appendChild(inputElement1);
            } else if (type == "unknown") {
                inputElement = document.createElement("input");
                inputElement.className = "option-input";
                inputElement.value = e.value;
                inputElement.onchange = () => {
                    defaultOptions.setDefault(e.key, inputElement.value);
                    displaySuccess(translate("app.options.updated_default"));
                    values[i].value = inputElement.value;
                    oldvalue = inputElement.value;
                    onChange(inputElement.value);
                }
                item.appendChild(inputElement);
            } else if (type == "key") {
                inputElement = document.createElement("button");
                inputElement.className = "option-key-input";
                inputElement.value = e.value;
                inputElement.setAttribute("data-key", e.key);
                inputElement.innerHTML = keys[e.value] ? keys[e.value] : e.value;
                inputElement.onclick = () => {
                    [...document.querySelectorAll(".option-key-input.selected")].forEach(e => {
                        e.classList.remove("selected");
                    });
                    inputElement.classList.add("selected");
                    selectedKeySelect = inputElement;
                    selectedKeySelectFunction = (v) => {
                        onChange(v);
                    }
                }
                item.appendChild(inputElement);
            }

            let setDefaultButton = document.createElement("button");
            setDefaultButton.className = "option-button";
            setDefaultButton.innerHTML = '<i class="fa-solid fa-plus"></i>' + translate("app.options.default.set");

            let onSet = () => {
                defaultOptions.setDefault(e.key, type == "text" ? '"' + inputElement.value + '"' : inputElement.value);
                setDefaultButton.innerHTML = '<i class="fa-solid fa-minus"></i>' + translate("app.options.default.remove");
                setDefaultButton.onclick = onRemove;
                displaySuccess(translate("app.options.default.set.success", "%k", e.key, "%v", inputElement.value));
            }

            setDefaultButton.onclick = onSet;

            let onRemove = () => {
                defaultOptions.deleteDefault(e.key);
                setDefaultButton.innerHTML = '<i class="fa-solid fa-plus"></i>' + translate("app.options.default.set");
                setDefaultButton.onclick = onSet;
                displaySuccess(translate("app.options.default.remove.success", "%k", e.key));
            }

            if (defaultOptions.getDefault(e.key) == e.value) {
                setDefaultButton.innerHTML = '<i class="fa-solid fa-minus"></i>' + translate("app.options.default.remove");
                setDefaultButton.onclick = onRemove;
            }

            item.appendChild(setDefaultButton);

            def_opts.appendChild(item);
        };
    }
    generateUIForOptions(values);

    let def_opts_buttons = document.createElement("div");
    def_opts_buttons.className = "def_opts_actions";

    let importButton = document.createElement("button");
    importButton.innerHTML = '<i class="fa-solid fa-file-import"></i> ' + translate("app.settings.def_opts.import");
    importButton.onclick = () => {
        let importDialog = new Dialog();
        importDialog.showDialog(translate("app.settings.def_opts.import.title"), "form", [
            {
                "type": "notice",
                "content": translate("app.settings.def_opts.import.description")
            },
            {
                "type": "text",
                "name": translate("app.settings.def_opts.import.location"),
                "id": "options_txt_location",
                "buttons": [
                    {
                        "name": translate("app.settings.def_opts.import.browse"),
                        "icon": '<i class="fa-solid fa-folder"></i>',
                        "func": async (v, b, i) => {
                            let newValue = await window.electronAPI.triggerFileImportBrowseWithOptions(v, 0, ["txt"], "options.txt");
                            if (newValue) i.value = newValue;
                        }
                    }
                ]
            }
        ], [
            {
                "type": "confirm",
                "content": translate("app.settings.def_opts.import.confirm")
            },
            {
                "type": "cancel",
                "content": translate("app.settings.def_opts.import.cancel")
            }
        ], [], (v) => {
            let info = {};
            v.forEach(e => info[e.id] = e.value);
            let options = window.electronAPI.getOptions(info.options_txt_location);
            db.prepare("DELETE FROM options_defaults WHERE key != ?").run("version");
            let defaultOptions = new DefaultOptions();
            console.log(options);
            options.forEach(e => {
                if (e.key == "version") return;
                defaultOptions.setDefault(e.key, e.value);
            });
            generateUIForOptions(options);
        })
    }
    importButton.className = "bug-button";
    def_opts_buttons.appendChild(importButton);

    let exportButton = document.createElement("button");
    exportButton.innerHTML = '<i class="fa-solid fa-file-export"></i> ' + translate("app.settings.def_opts.export");
    exportButton.onclick = () => {
        let file_location = window.electronAPI.generateOptionsTXT(values);
        openShareDialogForFile(file_location);
    }
    exportButton.className = "bug-button";
    def_opts_buttons.appendChild(exportButton);

    let dialog = new Dialog();
    let java_installations = [{
        "type": "notice",
        "tab": "java",
        "content": translate("app.settings.java.description")
    }];
    let java_stuff = window.electronAPI.getJavaInstallations();
    java_stuff.sort((a, b) => b.version - a.version);
    java_stuff.forEach(e => {
        java_installations.push({
            "type": "text",
            "name": translate("app.settings.java.location").replace("%v", e.version),
            "id": "java_" + e.version,
            "default": e.path,
            "tab": "java",
            "buttons": [
                {
                    "name": translate("app.settings.java.detect"),
                    "icon": '<i class="fa-solid fa-magnifying-glass"></i>',
                    "func": async (v, b, i) => {
                        b.innerHTML = '<i class="spinner"></i>' + translate("app.settings.java.detect.searching");
                        let dialog = new Dialog();
                        let results = await window.electronAPI.detectJavaInstallations(e.version);
                        dialog.showDialog(translate("app.settings.java.select"), "form", [
                            {
                                "type": "dropdown",
                                "id": "java_path",
                                "name": translate("app.settings.java.path"),
                                "options": results.map(e => ({ "name": e.path, "value": e.path }))
                            }
                        ], [
                            { "type": "cancel", "content": translate("app.settings.java.cancel") },
                            { "type": "confirm", "content": translate("app.settings.java.confirm") }
                        ], [], (e) => {
                            let info = {};
                            e.forEach(e => { info[e.id] = e.value });
                            i.value = info.java_path;
                        });
                        b.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i>Detect';
                    }
                },
                {
                    "name": translate("app.settings.java.browse"),
                    "icon": '<i class="fa-solid fa-folder"></i>',
                    "func": async (v, b, i) => {
                        let newValue = await window.electronAPI.triggerFileBrowse(v);
                        if (newValue) i.value = newValue;
                    }
                },
                {
                    "name": translate("app.settings.java.test"),
                    "icon": '<i class="fa-solid fa-play"></i>',
                    "func": async (v, b) => {
                        let num = Math.floor(Math.random() * 10000);
                        b.setAttribute("data-num", num);
                        b.classList.remove("failed");
                        b.innerHTML = '<i class="spinner"></i>' + translate("app.settings.java.test.testing");
                        let success = await window.electronAPI.testJavaInstallation(v);
                        if (success) {
                            b.innerHTML = '<i class="fa-solid fa-check"></i>' + translate("app.settings.java.test.success");
                        } else {
                            b.innerHTML = '<i class="fa-solid fa-xmark"></i>' + translate("app.settings.java.test.fail");
                            b.classList.add("failed");
                        }
                        setTimeout(() => {
                            if (b.getAttribute("data-num") == num) {
                                b.innerHTML = '<i class="fa-solid fa-play"></i>Test';
                                b.classList.remove("failed");
                            }
                        }, 3000);
                    }
                }
            ]
        });
    });
    let app_info = document.createElement("div");
    app_info.style.display = "flex";
    app_info.style.flexDirection = "column";
    app_info.style.gap = "4px";
    let info_to_show = [{
        "name": translate("app.settings.info.enderlynx"),
        "value": window.electronAPI.version
    }, {
        "name": translate("app.settings.info.electron"),
        "value": window.electronAPI.electronversion
    }, {
        "name": translate("app.settings.info.os.platform"),
        "value": window.electronAPI.osplatform()
    }, {
        "name": translate("app.settings.info.os.arch"),
        "value": window.electronAPI.osarch()
    }, {
        "name": translate("app.settings.info.os.release"),
        "value": window.electronAPI.osrelease()
    }, {
        "name": translate("app.settings.info.os.version"),
        "value": window.electronAPI.osversion()
    }, {
        "name": translate("app.settings.info.node"),
        "value": window.electronAPI.nodeversion
    }, {
        "name": translate("app.settings.info.chromium"),
        "value": window.electronAPI.chromeversion
    }, {
        "name": translate("app.settings.info.v8"),
        "value": window.electronAPI.v8version
    }, {
        "name": translate("app.settings.info.ram"),
        "value": async () => { return ((await window.electronAPI.memUsage()).private / 1024).toFixed(2) + " MB" },
        "update": 1000
    }]
    for (let i = 0; i < info_to_show.length; i++) {
        let e = info_to_show[i];
        let element = document.createElement("span");
        if (!e.update) {
            element.innerHTML = e.name + ": " + e.value;
        }
        element.style.color = "var(--subtle-text-color)";
        if (e.update) {
            setInterval(async () => {
                if (element) {
                    element.innerHTML = e.name + ": " + await e.value();
                }
            }, e.update);
        }
        app_info.appendChild(element);
    }
    let bugButton = document.createElement("button");
    bugButton.innerHTML = '<i class="fa-solid fa-bug"></i> ' + translate("app.settings.info.bug");
    bugButton.onclick = () => {
        window.electronAPI.openInBrowser("https://github.com/Illusioner2520/EnderLynx/issues/new?template=1-bug_report.yml&version=" + window.electronAPI.version);
    }
    bugButton.className = "bug-button";
    app_info.appendChild(bugButton);
    let featureButton = document.createElement("button");
    featureButton.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> ' + translate("app.settings.info.feature");
    featureButton.className = "bug-button";
    featureButton.onclick = () => {
        window.electronAPI.openInBrowser("https://github.com/Illusioner2520/EnderLynx/issues/new?template=2-feature_request.yml");
    }
    app_info.appendChild(featureButton);
    let updatesButton = document.createElement("button");
    updatesButton.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> ' + translate("app.settings.info.update");
    updatesButton.className = "bug-button";
    let updateButtonClick = async () => {
        updatesButton.onclick = () => { }
        updatesButton.children[0].classList.add("spinning");
        await checkForUpdates(true);
        updatesButton.children[0].classList.remove("spinning");
        updatesButton.onclick = updateButtonClick;
    }
    updatesButton.onclick = updateButtonClick;
    app_info.appendChild(updatesButton);
    dialog.showDialog("Settings", "form", [
        {
            "type": "dropdown",
            "name": translate("app.settings.theme"),
            "tab": "appearance",
            "id": "default_mode",
            "options": [
                { "name": translate("app.settings.theme.dark"), "value": "dark" },
                { "name": translate("app.settings.theme.light"), "value": "light" }
            ],
            "default": data.getDefault("default_mode"),
            "onchange": (v) => {
                data.setDefault("default_mode", v);
                if (v == "light") {
                    document.body.classList.add("light");
                } else {
                    document.body.classList.remove("light");
                }
            }
        },
        {
            "type": "dropdown",
            "name": translate("app.settings.color"),
            "tab": "appearance",
            "id": "default_accent_color",
            "options": [
                { "name": translate("app.settings.color.red"), "value": "red" },
                { "name": translate("app.settings.color.orange"), "value": "orange" },
                { "name": translate("app.settings.color.yellow"), "value": "yellow" },
                { "name": translate("app.settings.color.lime"), "value": "lime" },
                { "name": translate("app.settings.color.green"), "value": "green" },
                { "name": translate("app.settings.color.cyan"), "value": "cyan" },
                { "name": translate("app.settings.color.light_blue"), "value": "light_blue" },
                { "name": translate("app.settings.color.blue"), "value": "blue" },
                { "name": translate("app.settings.color.purple"), "value": "purple" },
                { "name": translate("app.settings.color.magenta"), "value": "magenta" },
                { "name": translate("app.settings.color.pink"), "value": "pink" },
                { "name": translate("app.settings.color.brown"), "value": "brown" },
                { "name": translate("app.settings.color.gray"), "value": "gray" },
                { "name": translate("app.settings.color.light_gray"), "value": "light_gray" }
            ],
            "default": data.getDefault("default_accent_color"),
            "onchange": (v) => {
                data.setDefault("default_accent_color", v);
                accent_colors.forEach(e => {
                    document.body.classList.remove(e);
                });
                document.body.classList.add(v);
            }
        },
        {
            "type": "dropdown",
            "name": translate("app.settings.sidebar"),
            "tab": "appearance",
            "id": "default_sidebar",
            "options": [
                { "name": translate("app.settings.sidebar.spacious"), "value": "spacious" },
                { "name": translate("app.settings.sidebar.compact"), "value": "compact" }
            ],
            "default": data.getDefault("default_sidebar"),
            "onchange": (v) => {
                data.setDefault("default_sidebar", v);
                if (v == "compact") {
                    document.body.classList.add("compact");
                } else {
                    document.body.classList.remove("compact");
                }
            }
        },
        {
            "type": "dropdown",
            "name": translate("app.settings.sidebar.side"),
            "tab": "appearance",
            "id": "default_sidebar_side",
            "options": [
                { "name": translate("app.settings.sidebar.left"), "value": "left" },
                { "name": translate("app.settings.sidebar.right"), "value": "right" }
            ],
            "default": data.getDefault("default_sidebar_side"),
            "onchange": (v) => {
                data.setDefault("default_sidebar_side", v);
                if (v == "right") {
                    document.body.classList.add("sidebar-right");
                } else {
                    document.body.classList.remove("sidebar-right");
                }
            }
        },
        {
            "type": "dropdown",
            "name": translate("app.settings.page"),
            "desc": translate("app.settings.page.description"),
            "tab": "appearance",
            "id": "default_page",
            "options": [
                { "name": translate("app.settings.page.home"), "value": "home" },
                { "name": translate("app.settings.page.instances"), "value": "instances" },
                { "name": translate("app.settings.page.discover"), "value": "discover" },
                { "name": translate("app.settings.page.wardrobe"), "value": "wardrobe" }
            ],
            "default": data.getDefault("default_page")
        },
        {
            "type": "toggle",
            "name": translate("app.settings.discord_rpc"),
            "tab": "appearance",
            "id": "discord_rpc",
            "desc": translate("app.settings.discord_rpc.description"),
            "default": data.getDefault("discord_rpc") == "true"
        },
        {
            "type": "toggle",
            "name": translate("app.settings.potato_pc"),
            "tab": "appearance",
            "id": "potato_mode",
            "desc": translate("app.settings.potato_pc.description"),
            "default": data.getDefault("potato_mode") == "true"
        },
        {
            "type": "toggle",
            "name": translate("app.settings.hide_ips"),
            "tab": "appearance",
            "id": "hide_ip",
            "desc": translate("app.settings.hide_ips.description"),
            "default": data.getDefault("hide_ip") == "true"
        },
        {
            "type": "slider",
            "name": translate("app.settings.resources.downloads"),
            "desc": translate("app.settings.resources.downloads.description"),
            "tab": "resources",
            "id": "max_concurrent_downloads",
            "default": Number(data.getDefault("max_concurrent_downloads")),
            "min": 1,
            "max": 20,
            "increment": 1,
            "unit": ""
        },
        {
            "type": "text",
            "name": translate("app.settings.folder_location"),
            "tab": "resources",
            "id": "folder_location",
            "desc": translate("app.settings.folder_location.description"),
            "default": window.electronAPI.userPath,
            "buttons": [
                {
                    "name": translate("app.settings.folder_location.browse"),
                    "icon": '<i class="fa-solid fa-folder"></i>',
                    "func": async (v, b, i) => {
                        let newValue = await window.electronAPI.triggerFolderBrowse(v);
                        if (newValue) i.value = newValue;
                    }
                }
            ]
        },
        {
            "type": "notice",
            "content": translate("app.settings.defaults.notice"),
            "tab": "defaults"
        },
        {
            "type": "number",
            "name": translate("app.settings.defaults.width"),
            "desc": translate("app.settings.defaults.width.description"),
            "tab": "defaults",
            "id": "default_width",
            "default": Number(data.getDefault("default_width"))
        },
        {
            "type": "number",
            "name": translate("app.settings.defaults.height"),
            "desc": translate("app.settings.defaults.height.description"),
            "tab": "defaults",
            "id": "default_height",
            "default": Number(data.getDefault("default_height"))
        },
        {
            "type": "slider",
            "name": translate("app.settings.defaults.ram"),
            "desc": translate("app.settings.defaults.ram.description"),
            "tab": "defaults",
            "id": "default_ram",
            "default": Number(data.getDefault("default_ram")),
            "min": 512,
            "max": window.electronAPI.getTotalRAM(),
            "increment": 64,
            "unit": translate("app.settings.defaults.ram.unit")
        },
        {
            "type": "text",
            "name": translate("app.settings.defaults.custom_args"),
            "tab": "defaults",
            "id": "default_java_args",
            "default": data.getDefault("default_java_args")
        },
        {
            "type": "text",
            "name": translate("app.settings.defaults.custom_env_vars"),
            "tab": "defaults",
            "id": "default_env_vars",
            "default": data.getDefault("default_env_vars")
        },
        {
            "type": "text",
            "name": translate("app.settings.defaults.pre_launch_hook"),
            "tab": "defaults",
            "id": "default_pre_launch_hook",
            "default": data.getDefault("default_pre_launch_hook")
        },
        {
            "type": "text",
            "name": translate("app.settings.defaults.wrapper"),
            "tab": "defaults",
            "id": "default_wrapper",
            "default": data.getDefault("default_wrapper")
        },
        {
            "type": "text",
            "name": translate("app.settings.defaults.post_exit_hook"),
            "tab": "defaults",
            "id": "default_post_exit_hook",
            "default": data.getDefault("default_post_exit_hook")
        },
        {
            "type": "notice",
            "content": app_info,
            "tab": "app_info"
        },
        {
            "type": "notice",
            "content": translate("app.settings.def_opts.notice"),
            "tab": "options"
        },
        {
            "type": "notice",
            "content": def_opts_buttons,
            "tab": "options"
        },
        {
            "type": "notice",
            "content": def_opts,
            "tab": "options"
        }
    ].concat(java_installations), [
        {
            "type": "cancel",
            "content": translate("app.settings.cancel")
        },
        {
            "type": "confirm",
            "content": translate("app.settings.confirm")
        }
    ], [
        {
            "name": translate("app.settings.tab.appearance"),
            "value": "appearance"
        },
        {
            "name": translate("app.settings.tab.defaults"),
            "value": "defaults"
        },
        {
            "name": translate("app.settings.tab.options"),
            "value": "options"
        },
        {
            "name": translate("app.settings.tab.java"),
            "value": "java"
        },
        {
            "name": translate("app.settings.tab.resources"),
            "value": "resources"
        },
        {
            "name": translate("app.settings.tab.app_info"),
            "value": "app_info"
        }
    ], async (v) => {
        let info = {};
        v.forEach(e => info[e.id] = e.value);
        data.setDefault("default_width", info.default_width);
        data.setDefault("default_height", info.default_height);
        data.setDefault("default_ram", info.default_ram);
        data.setDefault("max_concurrent_downloads", info.max_concurrent_downloads);
        data.setDefault("default_page", info.default_page);
        data.setDefault("discord_rpc", (info.discord_rpc).toString());
        data.setDefault("potato_mode", (info.potato_mode).toString());
        data.setDefault("hide_ip", (info.hide_ip).toString());
        if (info.potato_mode) {
            document.body.classList.add("potato");
        } else {
            document.body.classList.remove("potato");
        }
        if (info.hide_ip) {
            document.body.classList.add("hide_ip");
        } else {
            document.body.classList.remove("hide_ip");
        }
        if (info.discord_rpc) {
            live.findLive();
            resetDiscordStatus();
        } else {
            window.electronAPI.clearActivity();
        }
        v.forEach(e => {
            if (e.id.startsWith("java_")) {
                let version = e.id.replace("java_", "");
                window.electronAPI.setJavaInstallation(version, e.value);
            }
        });
        window.electronAPI.changeFolder(window.electronAPI.userPath, info.folder_location);
    });
}

let navButtons = [homeButton, instanceButton, discoverButton, wardrobeButton];

async function toggleMicrosoftSignIn() {
    try {
        let newData = await window.electronAPI.triggerMicrosoftLogin();
        let players = data.getProfiles().map(e => e.uuid);
        if (!newData.access_token) throw new Error();
        if (!newData.refresh_token) throw new Error();
        if (!newData.client_id) throw new Error();
        if (players.includes(newData.uuid)) {
            let player = data.getProfileFromUUID(newData.uuid);
            player.setDefault();
            accountSwitcher.selectPlayer(player);
            await updateSkinsAndCapes(newData);
            accountSwitcher.selectPlayer(player);
            accountSwitcher.reloadHeads();
        } else {
            if (!newData.name) {
                displayError(translate("app.login_error.no_username"));
                return;
            }
            let newPlayer = data.addProfile(newData.access_token, newData.client_id, newData.expires, newData.name, newData.refresh_token, newData.uuid, newData.xuid, newData.is_demo, false);
            newPlayer.setDefault();
            accountSwitcher.addPlayer(newPlayer);
            await updateSkinsAndCapes(newData);
            accountSwitcher.selectPlayer(newPlayer);
            accountSwitcher.reloadHeads();
        }
    } catch (e) {
        if (e == "error.gui.closed") return;
        displayError(translate("app.login_error"));
    }
}

function showHome() {
    let ele = document.createElement("div");
    ele.className = "home-element";
    let loading = new LoadingContainer();
    loading.element.style.gridColumn = "span 2";
    ele.appendChild(loading.element);
    setTimeout(() => {
        showHomeContent(ele);
    }, 0);
    return ele;
}

async function showHomeContent(oldEle) {
    let ele = document.createElement("div");
    ele.className = "home-element";
    let column1 = document.createElement("div");
    column1.className = "home-column";
    let column2 = document.createElement("div");
    column2.className = "home-column";
    ele.appendChild(column1);
    ele.appendChild(column2);
    let pinnedWorlds = await getPinnedWorlds();
    let pinnedInstances = getPinnedInstances();
    pinnedInstances.forEach(e => e.actuallyPinned = true);
    let lastPlayedWorlds = await getRecentlyPlayedWorlds();
    let lastPlayedInstances = getRecentlyPlayedInstances();
    pinnedWorlds.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    pinnedInstances.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    let pinnedWorldTitle = document.createElement("h2");
    pinnedWorldTitle.innerHTML = '<i class="fa-solid fa-thumbtack" style="color: var(--subtle-text-color)"></i> ' + translate("app.home.pinned_worlds");
    let pinnedInstanceTitle = document.createElement("h2");
    pinnedInstanceTitle.innerHTML = '<i class="fa-solid fa-thumbtack" style="color: var(--subtle-text-color)"></i> ' + translate("app.home.pinned_instances");
    let lastPlayedWorldTitle = document.createElement("h2");
    lastPlayedWorldTitle.innerHTML = '<i class="fa-solid fa-clock-rotate-left" style="color: var(--subtle-text-color)"></i> ' + translate("app.home.last_played_worlds");
    let lastPlayedInstanceTitle = document.createElement("h2");
    lastPlayedInstanceTitle.innerHTML = '<i class="fa-solid fa-clock-rotate-left" style="color: var(--subtle-text-color)"></i> ' + translate("app.home.last_played_instances");
    let pinnedWorldGrid = document.createElement("div");
    pinnedWorldGrid.className = "home-list-section";
    let lastPlayedWorldGrid = document.createElement("div");
    lastPlayedWorldGrid.className = "home-list-section";
    let pinnedInstanceGrid = document.createElement("div");
    pinnedInstanceGrid.className = "home-list-section";
    let lastPlayedInstanceGrid = document.createElement("div");
    lastPlayedInstanceGrid.className = "home-list-section";
    pinnedWorlds.concat(lastPlayedWorlds).forEach(e => {
        if (!e.ip) e.type = "singleplayer";
        else e.type = "multiplayer";

        let item = document.createElement("div");
        item.className = "home-entry";
        item.style.cursor = "auto";
        let icon = document.createElement("img");
        icon.className = "instance-image";
        icon.src = fixPathForImage(e.icon ? e.icon : "default.png");
        item.appendChild(icon);
        let itemInfo = document.createElement("div");
        itemInfo.className = "instance-info";
        let itemTitle = document.createElement("div");
        itemTitle.className = "instance-name";
        itemTitle.innerHTML = parseMinecraftFormatting(e.name);
        let itemDesc = document.createElement("div");
        itemDesc.className = "instance-desc";
        itemDesc.innerHTML = e.type == "singleplayer" ? (translate("app.worlds.description." + e.mode) + (e.hardcore ? " - <span style='color:#ff1313'>" + translate("app.worlds.description.hardcore") + "</span>" : "") + (e.commands ? " - " + translate("app.worlds.description.commands") : "") + (e.flat ? " - " + translate("app.worlds.description.flat") : "")) : e.ip;
        if (e.type == "multiplayer") {
            itemDesc.style.width = "fit-content";
            itemDesc.classList.add("hidden-text");
            itemDesc.onclick = () => {
                itemDesc.classList.add("shown");
            }
        }
        itemInfo.appendChild(itemTitle);
        itemInfo.appendChild(itemDesc);
        item.appendChild(itemInfo);
        let instanceInfo = new Instance(e.instance_id);
        let playButton = document.createElement("button");
        playButton.setAttribute("title", ((minecraftVersions.indexOf(instanceInfo.vanilla_version) >= minecraftVersions.indexOf("23w14a") && e.type == "singleplayer") || (minecraftVersions.indexOf(instanceInfo.vanilla_version) >= minecraftVersions.indexOf("1.3") && e.type == "multiplayer") || !minecraftVersions) ? translate("app.home.tooltip.world") : translate("app.home.tooltip.instance"));
        playButton.className = "home-play-button";
        playButton.innerHTML = '<i class="fa-solid fa-play"></i>Play';
        playButton.onclick = async () => {
            playButton.className = "home-loading-button";
            playButton.innerHTML = '<i class="spinner"></i>' + translate("app.home.loading")
            e.type == "singleplayer" ? await playSingleplayerWorld(instanceInfo, e.id) : await playMultiplayerWorld(instanceInfo, e.ip);
            showSpecificInstanceContent(instanceInfo.refresh());
        }
        let morebutton = document.createElement("button");
        morebutton.className = "home-list-more";
        morebutton.innerHTML = '<i class="fa-solid fa-ellipsis-vertical"></i>';
        let buttons = new ContextMenuButtons([
            ((minecraftVersions.indexOf(instanceInfo.vanilla_version) >= minecraftVersions.indexOf("23w14a") && e.type == "singleplayer") || (minecraftVersions.indexOf(instanceInfo.vanilla_version) >= minecraftVersions.indexOf("1.3") && e.type == "multiplayer") || !minecraftVersions) ? {
                "title": translate("app.worlds.play"),
                "icon": '<i class="fa-solid fa-play"></i>',
                "func": async () => {
                    playButton.className = "home-loading-button";
                    playButton.innerHTML = '<i class="spinner"></i>Loading'
                    e.type == "singleplayer" ? await playSingleplayerWorld(instanceInfo, e.id) : await playMultiplayerWorld(instanceInfo, e.ip);
                    showSpecificInstanceContent(instanceInfo.refresh());
                }
            } : null,
            {
                "title": translate("app.instance.view"),
                "icon": '<i class="fa-solid fa-eye"></i>',
                "func": () => {
                    showSpecificInstanceContent(instanceInfo.refresh());
                }
            },
            e.type == "singleplayer" ? {
                "title": translate("app.worlds.open"),
                "icon": '<i class="fa-solid fa-folder"></i>',
                "func": () => {
                    window.electronAPI.openFolder(processRelativePath(`./minecraft/instances/${instanceInfo.instance_id}/saves/${e.id}`))
                }
            } : null,
            {
                "title": () => isWorldPinned(e.type == "singleplayer" ? e.id : e.ip, instanceInfo.instance_id, e.type) ? translate("app.worlds.unpin") : translate("app.worlds.pin"),
                "icon": () => isWorldPinned(e.type == "singleplayer" ? e.id : e.ip, instanceInfo.instance_id, e.type) ? '<i class="fa-solid fa-thumbtack-slash"></i>' : '<i class="fa-solid fa-thumbtack"></i>',
                "func": (i) => {
                    let world_pinned = isWorldPinned(e.type == "singleplayer" ? e.id : e.ip, instanceInfo.instance_id, e.type);
                    world_pinned ? (e.type == "singleplayer" ? unpinSingleplayerWorld(e.id, instanceInfo.instance_id) : unpinMultiplayerWorld(e.ip, instanceInfo.instance_id)) : (e.type == "singleplayer" ? pinSingleplayerWorld(e.id, instanceInfo.instance_id) : pinMultiplayerWorld(e.ip, instanceInfo.instance_id))
                    i.setTitle(!world_pinned ? translate("app.worlds.unpin") : translate("app.worlds.pin"));
                    i.setIcon(!world_pinned ? '<i class="fa-solid fa-thumbtack-slash"></i>' : '<i class="fa-solid fa-thumbtack"></i>');
                    homeContent.displayContent();
                }
            },
            // {
            //     "title": translate("app.worlds.share"),
            //     "icon": '<i class="fa-solid fa-share"></i>',
            //     "func": () => { }
            // },
            (minecraftVersions.indexOf(instanceInfo.vanilla_version) >= minecraftVersions.indexOf("23w14a") && e.type == "singleplayer") || (minecraftVersions.indexOf(instanceInfo.vanilla_version) >= minecraftVersions.indexOf("1.3") && e.type == "multiplayer") || !minecraftVersions ? {
                "icon": '<i class="fa-solid fa-desktop"></i>',
                "title": translate("app.worlds.desktop_shortcut"),
                "func": () => {
                    if (e.type == "singleplayer") {
                        addDesktopShortcutWorld(instanceInfo, e.name, "singleplayer", e.id, e.icon ?? "default.png");
                    } else {
                        addDesktopShortcutWorld(instanceInfo, e.name, "multiplayer", e.ip, e.icon ?? "default.png");
                    }
                }
            } : null,
            {
                "title": translate("app.worlds.delete"),
                "icon": '<i class="fa-solid fa-trash-can"></i>',
                "danger": true,
                "func_id": "delete",
                "func": () => {
                    let dialog = new Dialog();
                    dialog.showDialog(translate("app.worlds.delete.confirm.title"), "notice", translate("app.worlds.delete.confirm.description").replace("%w", parseMinecraftFormatting(e.name)), [
                        {
                            "type": "cancel",
                            "content": translate("app.worlds.delete.cancel")
                        },
                        {
                            "type": "confirm",
                            "content": translate("app.worlds.delete.confirm")
                        }
                    ], [], async () => {
                        if (e.type == "singleplayer") {
                            let success = await window.electronAPI.deleteWorld(instanceInfo.instance_id, e.id);
                            if (success) {
                                ele.remove();
                                displaySuccess(translate("app.worlds.delete.success", "%w", parseMinecraftFormatting(e.name)));
                            } else {
                                displayError(translate("app.worlds.delete.fail", "%w", parseMinecraftFormatting(e.name)));
                            }
                        } else if (e.type == "multiplayer") {
                            let success = await window.electronAPI.deleteServer(instanceInfo.instance_id, [e.ip], [e.index]);
                            if (success) {
                                ele.remove();
                                displaySuccess(translate("app.worlds.delete.success", "%w", parseMinecraftFormatting(e.name)));
                            } else {
                                displayError(translate("app.worlds.delete.fail", "%w", parseMinecraftFormatting(e.name)));
                            }
                        }
                        homeContent.displayContent();
                    });
                }
            }
        ].filter(e => e))
        new MoreMenu(morebutton, buttons);
        item.oncontextmenu = (e) => {
            contextmenu.showContextMenu(buttons, e.clientX, e.clientY);
        }
        item.appendChild(playButton);
        item.appendChild(morebutton);
        e.pinned ? pinnedWorldGrid.appendChild(item) : lastPlayedWorldGrid.appendChild(item);
    });
    pinnedInstances.concat(lastPlayedInstances).forEach(e => {
        let item = document.createElement("div");
        item.className = "home-entry";
        item.onclick = (event) => {
            if (event.target.matches("button")) return;
            if (event.target.matches("i")) return;
            showSpecificInstanceContent(e.refresh());
        }
        item.setAttribute("tabindex", "0");
        item.onkeydown = (event) => {
            if (event.target.matches("button")) return;
            if (event.target.matches("i")) return;
            if (event.key == "Enter" || event.key == " ") {
                showSpecificInstanceContent(e.refresh());
            }
        }
        let icon = document.createElement("img");
        icon.className = "instance-image";
        icon.src = e.image ? e.image : "default.png";
        item.appendChild(icon);
        let itemInfo = document.createElement("div");
        itemInfo.className = "instance-info";
        let itemTitle = document.createElement("div");
        itemTitle.className = "instance-name";
        itemTitle.innerHTML = e.name;
        let itemDesc = document.createElement("div");
        itemDesc.className = "instance-desc";
        itemDesc.innerHTML = loaders[e.loader] + " " + e.vanilla_version;
        itemInfo.appendChild(itemTitle);
        itemInfo.appendChild(itemDesc);
        item.appendChild(itemInfo);
        let instanceInfo = new Instance(e.instance_id);
        let running = checkForProcess(instanceInfo.pid);
        if (!running) instanceInfo.setPid(null);
        if (running) {
            window.electronAPI.watchProcessForExit(instanceInfo.pid, () => {
                if (currentTab != "home") return;
                homeContent.displayContent();
                live.findLive();
            });
        }
        let playButton = document.createElement("button");
        playButton.setAttribute("title", running ? translate("app.button.instances.stop") : translate("app.button.instances.play"));
        playButton.className = running ? "home-stop-button" : "home-play-button";
        playButton.innerHTML = running ? '<i class="fa-solid fa-circle-stop"></i>' + translate("app.button.instances.stop_short") : '<i class="fa-solid fa-play"></i>' + translate("app.button.instances.play_short");
        playButton.onclick = running ? () => {
            stopInstance(instanceInfo);
            homeContent.displayContent();
        } : async () => {
            playButton.className = "home-loading-button";
            playButton.innerHTML = '<i class="spinner"></i>' + translate("app.home.loading")
            await playInstance(instanceInfo);
            showSpecificInstanceContent(instanceInfo.refresh());
        }
        let morebutton = document.createElement("button");
        morebutton.className = "home-list-more";
        morebutton.innerHTML = '<i class="fa-solid fa-ellipsis-vertical"></i>';
        let buttons = new ContextMenuButtons([
            {
                "icon": running ? '<i class="fa-solid fa-circle-stop"></i>' : '<i class="fa-solid fa-play"></i>',
                "title": running ? translate("app.button.instances.stop") : translate("app.button.instances.play"),
                "func": running ? async (e) => {
                    await stopInstance(instanceInfo);
                    homeContent.displayContent();
                } : async (e) => {
                    playButton.className = "home-loading-button";
                    playButton.innerHTML = '<i class="spinner"></i>' + translate("app.home.loading")
                    await playInstance(instanceInfo);
                    showSpecificInstanceContent(instanceInfo.refresh());
                }
            },
            {
                "icon": '<i class="fa-solid fa-plus"></i>',
                "title": translate("app.button.content.add"),
                "func": (e) => {
                    instanceInfo = instanceInfo.refresh();
                    showAddContent(instanceInfo.instance_id, instanceInfo.vanilla_version, instanceInfo.loader);
                }
            },
            {
                "icon": '<i class="fa-solid fa-eye"></i>',
                "title": translate("app.button.instances.view"),
                "func": (e) => {
                    showSpecificInstanceContent(instanceInfo.refresh());
                }
            },
            {
                "icon": '<i class="fa-solid fa-copy"></i>',
                "title": translate("app.button.instances.duplicate"),
                "func": (e) => {
                    duplicateInstance(instanceInfo);
                }
            },
            {
                "icon": '<i class="fa-solid fa-folder"></i>',
                "title": translate("app.button.instances.open_folder"),
                "func": (e) => {
                    window.electronAPI.openFolder(processRelativePath(`./minecraft/instances/${instanceInfo.instance_id}`));
                }
            },
            {
                "icon": '<i class="fa-solid fa-share"></i>',
                "title": translate("app.button.instances.share"),
                "func": (e) => {
                    openInstanceShareDialog(instanceInfo);
                }
            },
            {
                "icon": '<i class="fa-solid fa-gear"></i>',
                "title": translate("app.button.instances.open_settings"),
                "func": (e) => {
                    showInstanceSettings(new Instance(instanceInfo.instance_id));
                }
            },
            {
                "icon": () => instanceInfo.pinned ? '<i class="fa-solid fa-thumbtack-slash"></i>' : '<i class="fa-solid fa-thumbtack"></i>',
                "title": () => instanceInfo.pinned ? translate("app.instances.unpin") : translate("app.instances.pin"),
                "func": (e) => {
                    instanceInfo.pinned ? unpinInstance(instanceInfo) : pinInstance(instanceInfo);
                    e.setTitle(instanceInfo.pinned ? translate("app.instances.unpin") : translate("app.instances.pin"));
                    e.setIcon(instanceInfo.pinned ? '<i class="fa-solid fa-thumbtack-slash"></i>' : '<i class="fa-solid fa-thumbtack"></i>');
                    homeContent.displayContent();
                }
            },
            {
                "icon": '<i class="fa-solid fa-desktop"></i>',
                "title": translate("app.instances.desktop_shortcut"),
                "func": (e) => {
                    addDesktopShortcut(instanceInfo);
                }
            },
            {
                "icon": '<i class="fa-solid fa-trash-can"></i>',
                "title": translate("app.button.instances.delete"),
                "func": (e) => {
                    let dialog = new Dialog();
                    dialog.showDialog(translate("app.instances.delete.confirm.title"), "form", [{
                        "content": translate("app.instances.delete.confirm.description").replace("%i", instanceInfo.name),
                        "type": "notice"
                    }, {
                        "type": "toggle",
                        "name": translate("app.instances.delete.files"),
                        "default": false,
                        "id": "delete"
                    }], [
                        {
                            "type": "cancel",
                            "content": translate("app.instances.delete.cancel")
                        },
                        {
                            "type": "confirm",
                            "content": translate("app.instances.delete.confirm")
                        }
                    ], [], async (v) => {
                        instanceInfo.delete();
                        homeContent.displayContent();
                        if (v[0].value) {
                            try {
                                await window.electronAPI.deleteInstanceFiles(instanceInfo.instance_id);
                            } catch (e) {
                                displayError(translate("app.instances.delete.files.fail"));
                            }
                        }
                    });
                },
                "danger": true
            }
        ].filter(e => e))
        new MoreMenu(morebutton, buttons);
        item.oncontextmenu = (e) => {
            contextmenu.showContextMenu(buttons, e.clientX, e.clientY);
        }
        item.appendChild(playButton);
        item.appendChild(morebutton);
        e.actuallyPinned ? pinnedInstanceGrid.appendChild(item) : lastPlayedInstanceGrid.appendChild(item);
    });
    let noPinnedWorlds = document.createElement("div");
    noPinnedWorlds.className = "home-entry-empty";
    noPinnedWorlds.innerHTML = translate("app.worlds.no_pinned");
    let noPinnedInstances = document.createElement("div");
    noPinnedInstances.className = "home-entry-empty";
    noPinnedInstances.innerHTML = translate("app.instances.no_pinned");
    let noPlayedWorlds = document.createElement("div");
    noPlayedWorlds.className = "home-entry-empty";
    noPlayedWorlds.innerHTML = translate("app.worlds.no_played");
    let noPlayedInstances = document.createElement("div");
    noPlayedInstances.className = "home-entry-empty";
    noPlayedInstances.innerHTML = translate("app.instances.no_played");
    if (pinnedWorlds.length || pinnedInstances.length) {
        column1.appendChild(pinnedWorldTitle);
        column1.appendChild(pinnedWorlds.length ? pinnedWorldGrid : noPinnedWorlds);
        column2.appendChild(pinnedInstanceTitle);
        column2.appendChild(pinnedInstances.length ? pinnedInstanceGrid : noPinnedInstances);
    } else {
        column1.style.gridRow = "span 2";
        column2.style.gridRow = "span 2";
    }
    column1.appendChild(lastPlayedWorldTitle);
    column1.appendChild(lastPlayedWorlds.length ? lastPlayedWorldGrid : noPlayedWorlds);
    column2.appendChild(lastPlayedInstanceTitle);
    column2.appendChild(lastPlayedInstances.length ? lastPlayedInstanceGrid : noPlayedInstances);

    let discoverModsWrapper = document.createElement("div");
    discoverModsWrapper.className = "home-discover-wrapper";
    discoverModsWrapper.style.display = "none";
    let discoverModsTitle = document.createElement("button");
    discoverModsTitle.innerHTML = translate("app.home.discover_modpacks") + ' <i class="fa-solid fa-angles-right"></i>'
    discoverModsTitle.className = "home-discover-title";
    discoverModsTitle.onclick = () => {
        showAddContent();
    }
    discoverModsWrapper.appendChild(discoverModsTitle);
    let discoverModsContainer = document.createElement("div");
    discoverModsContainer.className = "home-discover-container";
    discoverModsWrapper.appendChild(discoverModsContainer);

    let updateHomeModpacksList = (e) => {
        discoverModsWrapper.style.display = "grid";
        e.hits.forEach(e => {
            let item = document.createElement("button");
            item.className = "home-discover";
            item.onclick = () => {
                displayContentInfo("modrinth", e.project_id);
            }
            let img = document.createElement("img");
            img.className = "home-discover-image";
            img.src = e.icon_url ? e.icon_url : "default.png";
            item.appendChild(img);
            let itemInfo = document.createElement("div");
            itemInfo.className = "home-discover-info";
            let itemTitle = document.createElement("div");
            itemTitle.innerHTML = e.title;
            itemTitle.className = "home-discover-item-title";
            let itemAuthor = document.createElement("div");
            itemAuthor.innerHTML = translate("app.home.modpack.author").replace("%a", e.author);
            itemAuthor.className = "home-discover-author";
            itemInfo.appendChild(itemTitle);
            itemInfo.appendChild(itemAuthor);
            item.appendChild(itemInfo);
            let itemDownloadCount = document.createElement("div");
            itemDownloadCount.className = "home-discover-downloads";
            itemDownloadCount.innerHTML = translate("app.home.modpack.downloads").replace("%d", formatNumber(e.downloads));
            item.appendChild(itemDownloadCount);
            discoverModsContainer.appendChild(item);
        })
    }
    let getRandomModpacks = async () => {
        home_modpacks = await window.electronAPI.getRandomModpacks();
        updateHomeModpacksList(home_modpacks);
    }
    if (!home_modpacks.hits) {
        getRandomModpacks();
    } else {
        updateHomeModpacksList(home_modpacks);
    }
    ele.appendChild(discoverModsWrapper);

    let mcNewsWrapper = document.createElement("div");
    mcNewsWrapper.className = "home-discover-wrapper";
    mcNewsWrapper.style.display = "none";
    let mcNewsTitle = document.createElement("div");
    mcNewsTitle.innerHTML = translate("app.home.mc_news");
    mcNewsTitle.className = "home-news-title";
    mcNewsWrapper.appendChild(mcNewsTitle);
    let mcNewsContainer = document.createElement("div");
    mcNewsContainer.className = "home-discover-container";
    mcNewsWrapper.appendChild(mcNewsContainer);

    let updateMCNews = (e) => {
        mcNewsWrapper.style.display = "";
        e.article_grid.forEach(e => {
            let article = document.createElement("button");
            article.className = "mc-news";
            article.style.backgroundImage = `url("https://minecraft.net${e.default_tile.image.imageURL}")`;
            article.onclick = () => {
                window.electronAPI.openInBrowser("https://minecraft.net" + e.article_url);
            }
            article.title = e.default_tile.sub_header;
            let article_title = document.createElement("div");
            article_title.innerHTML = e.default_tile.title;
            article_title.className = "mc-news-title";
            article_title.dataset.type = e.primary_category;
            article.appendChild(article_title);
            mcNewsContainer.appendChild(article);
        });
    }

    let getMCNews = async () => {
        mc_news = await (await fetch("https://www.minecraft.net/content/minecraftnet/language-masters/en-us/_jcr_content.articles.page-1.json")).json();
        updateMCNews(mc_news);
    }

    if (!mc_news.article_grid) {
        getMCNews();
    } else {
        updateMCNews(mc_news);
    }

    ele.appendChild(mcNewsWrapper);

    content.appendChild(ele);
    oldEle.remove();
    return ele;
}

let home_modpacks = {};
let mc_news = {};

if (data.getDefault("default_mode") == "light") {
    document.body.classList.add("light");
}

document.body.classList.add(data.getDefault("default_accent_color"));

if (data.getDefault("default_sidebar") == "compact") {
    document.body.classList.add("compact");
}

if (data.getDefault("default_sidebar_side") == "right") {
    document.body.classList.add("sidebar-right");
}

if (data.getDefault("potato_mode") == "true") {
    document.body.classList.add("potato");
}

if (data.getDefault("hide_ip") == "true") {
    document.body.classList.add("hide_ip");
}

let skinViewer;

function showWardrobeContent(e) {
    if (!data.getDefaultProfile()) {
        let ele = document.createElement("div");
        ele.style.padding = "8px";
        let signInWarning = new NoResultsFound(translate("app.wardrobe.sign_in"));
        ele.appendChild(signInWarning.element);
        return ele;
    }
    if (skinViewer) skinViewer.dispose();
    let ele = document.createElement("div");
    ele.className = "my-account-grid";
    let skinRenderContainer = document.createElement("div");
    skinRenderContainer.className = "skin-render-container";
    let skinRenderCanvas = document.createElement("canvas");
    skinRenderCanvas.className = "skin-render-canvas";
    skinRenderContainer.appendChild(skinRenderCanvas);
    ele.appendChild(skinRenderContainer);
    const dpr = window.devicePixelRatio || 1;
    skinViewer = new skinview3d.SkinViewer({
        canvas: skinRenderCanvas,
        width: 298 * dpr,
        height: 498 * dpr
    });
    skinRenderCanvas.style.width = "300px";
    skinRenderCanvas.style.height = "500px";
    skinViewer.pixelRatio = 2
    skinViewer.zoom = 0.7;
    let walkingAnimation = new skinview3d.WalkingAnimation();
    walkingAnimation.headBobbing = false;
    skinViewer.animation = walkingAnimation;
    skinViewer.animation.speed = 0.5;
    let pauseButton = document.createElement("button");
    pauseButton.className = 'skin-render-pause';
    pauseButton.innerHTML = '<i class="fa-solid fa-pause"></i>';
    let onPause = () => {
        skinViewer.animation.paused = true;
        pauseButton.innerHTML = '<i class="fa-solid fa-play"></i>'
        pauseButton.onclick = onResume;
    }
    let onResume = () => {
        skinViewer.animation.paused = false;
        pauseButton.innerHTML = '<i class="fa-solid fa-pause"></i>';
        pauseButton.onclick = onPause;
    }
    pauseButton.onclick = onPause;
    skinRenderContainer.appendChild(pauseButton);
    let optionsContainer = document.createElement("div");
    optionsContainer.className = "my-account-options";
    ele.appendChild(optionsContainer);
    let skinOptions = document.createElement("div");
    skinOptions.className = "my-account-option-box";
    let capeOptions = document.createElement("div");
    capeOptions.className = "my-account-option-box";
    let skinTitle = document.createElement("h1");
    skinTitle.innerHTML = translate("app.wardrobe.skins");
    let capeTitle = document.createElement("h1");
    capeTitle.innerHTML = translate("app.wardrobe.capes");
    let skinList = document.createElement("div");
    let capeList = document.createElement("div");
    skinList.className = 'my-account-option-list';
    capeList.className = 'my-account-option-list';
    skinOptions.appendChild(skinTitle);
    capeOptions.appendChild(capeTitle);
    skinOptions.appendChild(skinList);
    capeOptions.appendChild(capeList);
    let showContent = () => {
        let default_profile = data.getDefaultProfile();
        let activeSkin = default_profile.getActiveSkin();
        skinViewer.loadSkin(activeSkin ? activeSkin.skin_url : null, {
            model: activeSkin?.model == "slim" ? "slim" : "default",
        });
        let activeCape = default_profile.getActiveCape();
        skinViewer.loadCape(activeCape ? processRelativePath(`./minecraft/capes/${activeCape.cape_id}.png`) : null);
        skinList.innerHTML = '';
        capeList.innerHTML = '';
        if (document.getElementsByClassName("details")[0]) document.getElementsByClassName("details")[0].remove();
        let skins = data.getSkinsNoDefaults();
        skins.forEach((e) => {
            let skinEle = document.createElement("div");
            let equipSkin = async () => {
                loader.style.display = "block";
                skinImg.style.display = "none";
                let currentEle = skinEle;
                let success = await applySkin(default_profile, e);
                if (success) {
                    let oldEle = document.querySelector(".my-account-option.skin.selected");
                    if (oldEle) oldEle.classList.remove("selected");
                    currentEle.classList.add("selected");
                    e.setActive(default_profile.uuid);
                    skinViewer.loadSkin(e.skin_url, {
                        model: e.model == "wide" ? "default" : "slim"
                    });
                    activeSkin = e;
                }
                loader.style.display = "none";
                skinImg.style.display = "block";
            }
            let buttons = new ContextMenuButtons([
                {
                    "title": translate("app.wardrobe.skin.equip"),
                    "icon": '<i class="fa-solid fa-user"></i>',
                    "func": equipSkin
                },
                {
                    "title": translate("app.wardrobe.skin.edit"),
                    "icon": '<i class="fa-solid fa-pencil"></i>',
                    "func": () => {
                        let dialog = new Dialog();
                        dialog.showDialog(translate("app.wardrobe.skin.edit.title"), "form", [
                            {
                                "type": "text",
                                "id": "name",
                                "name": translate("app.wardrobe.skin.edit.name"),
                                "default": e.name,
                                "maxlength": 50
                            },
                            {
                                "type": "dropdown",
                                "id": "model",
                                "name": translate("app.wardrobe.skin.edit.model"),
                                "options": [
                                    { "name": translate("app.wardrobe.skin.model.classic"), "value": "wide" },
                                    { "name": translate("app.wardrobe.skin.model.slim"), "value": "slim" }
                                ],
                                "default": e.model
                            }
                        ], [
                            { "type": "cancel", "content": translate("app.wardrobe.skin.edit.cancel") },
                            { "type": "confirm", "content": translate("app.wardrobe.skin.edit.confirm") }
                        ], [], async (v) => {
                            let info = {};
                            v.forEach(e => { info[e.id] = e.value });
                            e.setName(info.name);
                            if (!info.name) e.setName(translate("app.wardrobe.unnamed"));
                            e.setModel(info.model);
                            showContent();
                        });
                    }
                },
                {
                    "title": translate("app.wardrobe.skin.preview"),
                    "icon": '<i class="fa-solid fa-eye"></i>',
                    "func": () => {
                        let skinRenderContainer = document.createElement("div");
                        skinRenderContainer.className = "skin-render-container";
                        skinRenderContainer.style.gridColumn = "1";
                        let skinRenderCanvas = document.createElement("canvas");
                        skinRenderCanvas.className = "skin-render-canvas";
                        skinRenderContainer.appendChild(skinRenderCanvas);
                        ele.appendChild(skinRenderContainer);
                        const dpr = window.devicePixelRatio || 1;
                        let skinViewer = new skinview3d.SkinViewer({
                            canvas: skinRenderCanvas,
                            width: 398 * dpr,
                            height: 498 * dpr
                        });
                        skinRenderCanvas.style.width = "400px";
                        skinRenderCanvas.style.height = "500px";
                        skinViewer.pixelRatio = 2
                        skinViewer.zoom = 0.8;
                        skinViewer.controls.enablePan = true;
                        let walkingAnimation = new skinview3d.WalkingAnimation();
                        walkingAnimation.headBobbing = false;
                        skinViewer.animation = walkingAnimation;
                        skinViewer.animation.speed = 0.5;
                        let pauseButton = document.createElement("button");
                        pauseButton.className = 'skin-render-pause';
                        pauseButton.innerHTML = '<i class="fa-solid fa-pause"></i>';
                        let onPause = () => {
                            skinViewer.animation.paused = true;
                            pauseButton.innerHTML = '<i class="fa-solid fa-play"></i>'
                            pauseButton.onclick = onResume;
                        }
                        let onResume = () => {
                            skinViewer.animation.paused = false;
                            pauseButton.innerHTML = '<i class="fa-solid fa-pause"></i>';
                            pauseButton.onclick = onPause;
                        }
                        let onClose = () => {
                            if (skinViewer.animation) skinViewer.animation.paused = true;
                            if (skinViewer.controls) skinViewer.controls.enabled = false;
                            if (skinViewer.renderLoopId) {
                                cancelAnimationFrame(skinViewer.renderLoopId);
                                skinViewer.renderLoopId = null;
                            }
                            skinViewer.draw = () => { };
                            skinViewer.render = () => { };
                            if (skinViewer.playerObject?.skin?.texture) skinViewer.playerObject.skin.texture.dispose();
                            if (skinViewer.playerObject?.cape?.texture) skinViewer.playerObject.cape.texture.dispose();
                            skinViewer.renderer?.dispose();
                            const gl = skinViewer.renderer?.getContext();
                            gl?.getExtension?.('WEBGL_lose_context')?.loseContext();
                            skinViewer.canvas?.remove();
                            skinViewer.playerObject = null;
                            skinViewer.renderer = null;
                            skinViewer.canvas = null;
                            skinViewer.controls = null;
                        }
                        pauseButton.onclick = onPause;
                        skinRenderContainer.appendChild(pauseButton);
                        skinViewer.loadSkin(e.skin_url, {
                            model: e.model == "wide" ? "default" : "slim"
                        });
                        let dialog = new Dialog();
                        dialog.showDialog(translate("app.wardrobe.skin.preview.title"), "notice", skinRenderContainer, [
                            {
                                "type": "confirm",
                                "content": translate("app.wardrobe.skin.preview.confirm")
                            }
                        ], [], () => {
                            setTimeout(() => {
                                onClose();
                            }, 1000);
                        }, () => {
                            setTimeout(() => {
                                onClose();
                            }, 1000);
                        })
                    }
                },
                {
                    "title": translate("app.wardrobe.skin.delete"),
                    "icon": '<i class="fa-solid fa-trash-can"></i>',
                    "danger": true,
                    "func": () => {
                        if (e.active_uuid.replaceAll(";", "")) {
                            displayError(translate("app.wardrobe.skin.delete.in_use"));
                            return;
                        }
                        e.delete();
                        skinEle.remove();
                    }
                }
            ]);
            skinEle.oncontextmenu = (e) => {
                contextmenu.showContextMenu(buttons, e.clientX, e.clientY);
            }
            skinEle.className = "my-account-option";
            skinEle.classList.add("skin");
            skinEle.title = e.name;
            skinEle.setAttribute("role", "button");
            skinEle.setAttribute("tabindex", 0);
            let skinMore = document.createElement("button");
            skinMore.className = "skin-more";
            skinMore.innerHTML = '<i class="fa-solid fa-ellipsis-vertical"></i>';
            let moreMenu = new MoreMenu(skinMore, buttons, true, 2);
            skinEle.appendChild(skinMore);
            let skinImg = document.createElement("img");
            renderSkinToDataUrl(e.skin_url, (v) => {
                skinImg.src = v;
            }, e.model);
            skinImg.classList.add("option-image");
            let loader = document.createElement("div");
            loader.className = "loading-container-spinner";
            loader.style.display = "none";
            let skinName = document.createElement("div");
            skinEle.appendChild(skinImg);
            skinEle.appendChild(loader);
            skinEle.appendChild(skinName);
            skinName.innerHTML = sanitize(e.name);
            skinName.className = "skin-name";
            skinList.appendChild(skinEle);
            if (e.active_uuid.includes(";" + default_profile.uuid + ";")) {
                skinEle.classList.add("selected");
            }
            skinEle.onclick = (e) => {
                if (e.target.matches(".skin-more")) return;
                if (e.target.matches("i")) return;
                equipSkin();
            }
            skinEle.onkeydown = (e) => {
                if (e.key == "Enter" || e.key == " ") {
                    if (e.target.matches(".skin-more")) return;
                    if (e.target.matches("i")) return;
                    equipSkin();
                }
            }
        });
        let defaultSkinList = document.createElement("div");
        defaultSkinList.className = "my-account-option-list";
        let detailsWrapper = document.createElement("div");
        detailsWrapper.className = "details";
        skinOptions.appendChild(detailsWrapper);
        let detailstop = document.createElement("button");
        detailstop.className = "details-top";
        let detailTitle = document.createElement("span");
        detailTitle.className = "details-top-text";
        detailTitle.innerHTML = translate("app.wardrobe.defaults");
        let detailChevron = document.createElement("span");
        detailChevron.className = "details-top-chevron";
        detailChevron.innerHTML = '<i class="fa-solid fa-chevron-down"></i>';
        detailstop.appendChild(detailTitle);
        detailstop.appendChild(detailChevron);
        let detailContent = document.createElement("div");
        detailContent.className = "details-content";
        detailsWrapper.appendChild(detailstop);
        detailsWrapper.appendChild(detailContent);
        detailContent.appendChild(defaultSkinList);

        let showDefSkins = async () => {
            detailChevron.innerHTML = '<i class="spinner"></i>';
            let eles = document.querySelectorAll(".my-account-option.default-skin");
            if (eles.length == 0) {
                let defaultSkins = await data.getDefaultSkins();
                defaultSkins.forEach(e => {
                    let skinEle = document.createElement("button");
                    skinEle.className = "my-account-option";
                    skinEle.classList.add("default-skin");
                    skinEle.title = e.name;
                    let equipSkin = async () => {
                        loader.style.display = "block";
                        skinImg.style.display = "none";
                        let currentEle = skinEle;
                        let success = await applySkinFromURL(default_profile, e);
                        if (success) {
                            let oldEle = document.querySelector(".my-account-option.skin.selected");
                            if (oldEle) oldEle.classList.remove("selected");
                            currentEle.classList.add("selected");
                            e.setActive(default_profile.uuid);
                            skinViewer.loadSkin(e.skin_url, {
                                model: e.model == "wide" ? "default" : "slim"
                            });
                            activeSkin = e;
                        }
                        loader.style.display = "none";
                        skinImg.style.display = "block";
                    }
                    skinEle.classList.add("skin");
                    let skinImg = document.createElement("img");
                    renderSkinToDataUrl(e.skin_url, (v) => {
                        skinImg.src = v;
                    }, e.model);
                    skinImg.classList.add("option-image");
                    let loader = document.createElement("div");
                    loader.className = "loading-container-spinner";
                    loader.style.display = "none";
                    let skinName = document.createElement("div");
                    skinEle.appendChild(skinImg);
                    skinEle.appendChild(loader);
                    skinEle.appendChild(skinName);
                    skinName.innerHTML = sanitize(e.name);
                    skinName.className = "skin-name";
                    defaultSkinList.appendChild(skinEle);
                    if (e.active_uuid.includes(";" + default_profile.uuid + ";")) {
                        skinEle.classList.add("selected");
                    }
                    skinEle.onclick = (e) => {
                        if (e.target.matches(".skin-more")) return;
                        if (e.target.matches("i")) return;
                        equipSkin();
                    }
                });
            }
            detailsWrapper.classList.add("open");
            detailChevron.innerHTML = '<i class="fa-solid fa-chevron-down"></i>';
        }
        let hideDefSkins = () => {
            detailsWrapper.classList.remove("open");
        }
        let isShow = true;
        detailstop.onclick = async () => {
            if (isShow) {
                await showDefSkins();
            } else {
                hideDefSkins();
            }
            isShow = !isShow;
        }
        let capes = default_profile.getCapes();
        capes.forEach((e) => {
            let capeEle = document.createElement("button");
            let equipCape = async () => {
                loader.style.display = "block";
                capeImg.style.display = "none";
                let currentEle = capeEle;
                let success = await applyCape(default_profile, e);
                if (success) {
                    let oldEle = document.querySelector(".my-account-option.cape.selected");
                    oldEle.classList.remove("selected");
                    currentEle.classList.add("selected");
                    e.setActive();
                    skinViewer.loadCape(processRelativePath(`./minecraft/capes/${e.cape_id}.png`));
                    activeCape = e;
                }
                loader.style.display = "none";
                capeImg.style.display = "block";
            }
            capeEle.className = "my-account-option";
            capeEle.title = e.cape_name;
            capeEle.classList.add("cape");
            let capeImg = document.createElement("img");
            extractImageRegionToDataURL(processRelativePath(`./minecraft/capes/${e.cape_id}.png`), 1, 1, 10, 16, (e) => {
                if (e) capeImg.src = e;
            });
            capeImg.classList.add("option-image");
            let loader = document.createElement("div");
            loader.className = "loading-container-spinner";
            loader.style.display = "none";
            let capeName = document.createElement("div");
            capeName.className = "cape-name";
            capeEle.appendChild(capeImg);
            capeEle.appendChild(loader);
            capeEle.appendChild(capeName);
            capeName.innerHTML = sanitize(e.cape_name);
            capeList.appendChild(capeEle);
            if (e.active) {
                capeEle.classList.add("selected");
            }
            capeEle.onclick = equipCape;
        });
        let capeEle = document.createElement("button");
        capeEle.className = "my-account-option";
        capeEle.classList.add("cape");
        capeEle.title = translate("app.wardrobe.no_cape");
        let capeImg = document.createElement("div");
        capeImg.classList.add("option-image");
        capeImg.innerHTML = '<i class="fa-regular fa-circle-xmark"></i>';
        let loader = document.createElement("div");
        loader.className = "loading-container-spinner";
        loader.style.display = "none";
        let capeName = document.createElement("div");
        capeName.className = "cape-name";
        capeEle.appendChild(capeImg);
        capeEle.appendChild(loader);
        capeEle.appendChild(capeName);
        capeName.innerHTML = translate("app.wardrobe.no_cape");
        capeList.appendChild(capeEle);
        if (!activeCape) {
            capeEle.classList.add("selected");
        }
        capeEle.onclick = async (event) => {
            loader.style.display = "block";
            capeImg.style.display = "none";
            let currentEle = event.currentTarget;
            let success = await applyCape(default_profile, null);
            if (success) {
                let oldEle = document.querySelector(".my-account-option.cape.selected");
                oldEle.classList.remove("selected");
                currentEle.classList.add("selected");
                default_profile.removeActiveCape();
                skinViewer.loadCape(null);
                activeCape = null;
            }
            loader.style.display = "none";
            capeImg.style.display = "block";
        }
    }
    showContent();
    let info = document.createElement("div");
    info.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>' + translate("app.wardrobe.notice");
    info.className = "info";
    optionsContainer.appendChild(info);
    let skinButtonContainer = document.createElement("div");
    skinButtonContainer.className = "skin-button-container";
    let refreshButton = document.createElement("button");
    refreshButton.className = "skin-button";
    let refreshButtonIcon = document.createElement("i");
    refreshButtonIcon.className = "fa-solid fa-arrows-rotate";
    let refreshButtonText = document.createElement("span");
    refreshButtonText.innerHTML = translate("app.wardrobe.refresh");
    refreshButton.appendChild(refreshButtonIcon);
    refreshButton.appendChild(refreshButtonText);
    refreshButton.onclick = async () => {
        refreshButtonIcon.classList.add("spinning");
        let profile = data.getDefaultProfile();
        try {
            let res = await window.electronAPI.getProfile(profile);
            profile.setAccessToken(res.player_info.access_token);
            profile.setClientId(res.player_info.client_id);
            profile.setExpires(res.player_info.expires);
            profile.setName(res.player_info.name);
            profile.setRefreshToken(res.player_info.refresh_token);
            profile.setUuid(res.player_info.uuid);
            profile.setXuid(res.player_info.xuid);
            profile.setIsDemo(res.player_info.is_demo);
            await updateSkinsAndCapes(res.skin_info);
            refreshButtonIcon.classList.remove("spinning");
            showContent();
        } catch (e) {
            displayError(translate("app.wardrobe.refresh.fail"));
            refreshButtonIcon.classList.remove("spinning");
            return;
        }
    }
    skinButtonContainer.appendChild(refreshButton);
    let importButton = document.createElement("button");
    importButton.innerHTML = '<i class="fa-solid fa-file-import"></i>' + translate("app.wardrobe.import");
    importButton.className = "skin-button";
    importButton.onclick = () => {
        let dialog = new Dialog();
        dialog.showDialog(translate("app.wardrobe.import.title"), "form", [
            {
                "type": "image-upload",
                "id": "skin",
                "name": translate("app.wardrobe.import.skin"),
                "tab": "file"
            },
            {
                "type": "text",
                "id": "name",
                "name": translate("app.wardrobe.import.name"),
                "tab": "file"
            },
            {
                "type": "dropdown",
                "id": "model",
                "name": translate("app.wardrobe.import.model"),
                "options": [
                    { "name": translate("app.wardrobe.import.auto"), "value": "auto" },
                    { "name": translate("app.wardrobe.skin.model.classic"), "value": "wide" },
                    { "name": translate("app.wardrobe.skin.model.slim"), "value": "slim" }
                ],
                "tab": "file"
            },
            {
                "type": "text",
                "id": "username",
                "name": translate("app.wardrobe.username_import.username"),
                "tab": "username"
            },
            {
                "type": "text",
                "id": "name_u",
                "name": translate("app.wardrobe.import.name"),
                "tab": "username"
            },
            {
                "type": "dropdown",
                "id": "model_u",
                "name": translate("app.wardrobe.import.model"),
                "options": [
                    { "name": translate("app.wardrobe.import.auto"), "value": "auto" },
                    { "name": translate("app.wardrobe.skin.model.classic"), "value": "wide" },
                    { "name": translate("app.wardrobe.skin.model.slim"), "value": "slim" }
                ],
                "tab": "username"
            },
            {
                "type": "text",
                "id": "url",
                "name": translate("app.wardrobe.import.url"),
                "tab": "url"
            },
            {
                "type": "text",
                "id": "name_l",
                "name": translate("app.wardrobe.import.name"),
                "tab": "url"
            },
            {
                "type": "dropdown",
                "id": "model_l",
                "name": translate("app.wardrobe.import.model"),
                "options": [
                    { "name": translate("app.wardrobe.import.auto"), "value": "auto" },
                    { "name": translate("app.wardrobe.skin.model.classic"), "value": "wide" },
                    { "name": translate("app.wardrobe.skin.model.slim"), "value": "slim" }
                ],
                "tab": "url"
            }
        ], [
            { "type": "cancel", "content": translate("app.wardrobe.import.cancel") },
            { "type": "confirm", "content": translate("app.wardrobe.import.confirm") }
        ], [
            {
                "name": translate("app.wardrobe.import.tab.file"),
                "value": "file"
            },
            {
                "name": translate("app.wardrobe.import.tab.username"),
                "value": "username"
            },
            {
                "name": translate("app.wardrobe.import.tab.url"),
                "value": "url"
            }
        ], async (e) => {
            let info = {};
            e.forEach(e => { info[e.id] = e.value });
            if (info.selected_tab == "username") {
                try {
                    info.skin = (await window.electronAPI.getSkinFromUsername(info.username)).url;
                } catch (e) {
                    displayError(translate("app.wardrobe.import.username.fail"));
                    return;
                }
                info.name = info.name_u;
                info.model = info.model_u;
            } else if (info.selected_tab == "url") {
                try {
                    info.skin = (await window.electronAPI.getSkinFromURL(info.url)).url;
                } catch (e) {
                    displayError(translate("app.wardrobe.import.url.fail"));
                    return;
                }
                info.name = info.name_l;
                info.model = info.model_l;
            }
            if (!info.skin) {
                displayError(translate("app.wardrobe.import.no_file"));
                return;
            }
            let dims = await getImageDimensionsFromDataURL(info.skin);
            console.log(dims);
            if (dims.width != 64) {
                displayError(translate("app.wardrobe.import.wrong_width"));
                return;
            }
            if (dims.height != 64 && dims.height != 32) {
                displayError(translate("app.wardrobe.import.wrong_height"));
                return;
            }
            let model = info.model;
            if (info.model == "auto") {
                const tempImg = new Image();
                tempImg.onload = async () => {
                    const tempCanvas = document.createElement("canvas");
                    tempCanvas.width = dims.width;
                    tempCanvas.height = dims.height;
                    const ctx = tempCanvas.getContext("2d");
                    ctx.drawImage(tempImg, 0, 0);
                    const pixel = ctx.getImageData(54, 24, 1, 1).data;
                    // pixel is [r, g, b, a]
                    if (pixel[3] === 0) {
                        model = "slim";
                    } else {
                        model = "wide";
                    }
                    data.addSkin(info.name ? info.name : info.selected_tab == "username" ? translate("app.wardrobe.username_import.default_name", "%u", info.username) : translate("app.wardrobe.unnamed"), model, "", await window.electronAPI.importSkin(info.skin), info.skin, true);
                    showContent();
                };
                tempImg.src = info.skin;
                return;
            }
            data.addSkin(info.name ? info.name : info.selected_tab == "username" ? translate("app.wardrobe.username_import.default_name", "%u", info.username) : translate("app.wardrobe.unnamed"), model, "", await window.electronAPI.importSkin(info.skin), info.skin, true);
            showContent();
        });
    }
    skinButtonContainer.appendChild(importButton);
    optionsContainer.appendChild(skinButtonContainer);
    optionsContainer.appendChild(skinOptions);
    optionsContainer.appendChild(capeOptions);
    return ele;
}

async function getImageDimensionsFromDataURL(dataURL) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
            resolve({ width: img.width, height: img.height });
        };
        img.onerror = (error) => {
            reject(error);
        };
        img.src = dataURL;
    });
}

function extractImageRegionToDataURL(imageSrc, x, y, width, height, callback) {
    const img = new Image();
    img.crossOrigin = 'Anonymous';

    img.onload = () => {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;

        const ctx = tempCanvas.getContext('2d');
        ctx.drawImage(img, x, y, width, height, 0, 0, width, height);

        const dataURL = tempCanvas.toDataURL();
        callback(dataURL);
    };

    img.onerror = (err) => {
        callback(null);
    };

    img.src = imageSrc;
}

function skinToHead(skinPath, callback) {
    const skin = new Image();
    skin.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 8;
        canvas.height = 8;
        const ctx = canvas.getContext('2d');

        function drawPart(sx, sy, sw, sh, dx, dy, dw = sw, dh = sh) {
            ctx.drawImage(skin, sx, sy, sw, sh, dx, dy, dw, dh);
        }

        drawPart(8, 8, 8, 8, 0, 0);
        drawPart(40, 8, 8, 8, 0, 0);

        callback(canvas.toDataURL())
    }

    skin.onerror = (err) => {
        callback(null);
    };

    skin.src = skinPath;
}

function renderSkinToDataUrl(skinPath, callback, model) {
    const skin = new Image();
    skin.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = 16;
        canvas.height = 32;
        const ctx = canvas.getContext('2d');

        function drawPart(sx, sy, sw, sh, dx, dy, dw = sw, dh = sh, mirror = false) {
            ctx.save();
            if (mirror) {
                ctx.translate(dx + dw, dy);
                ctx.scale(-1, 1);
                ctx.drawImage(skin, sx, sy, sw, sh, 0, 0, dw, dh);
            } else {
                ctx.drawImage(skin, sx, sy, sw, sh, dx, dy, dw, dh);
            }
            ctx.restore();
        }

        // first layer
        drawPart(8, 8, 8, 8, 4, 0); // head
        drawPart(20, 20, 8, 12, 4, 8); // torso
        drawPart(4, 20, 4, 12, 4, 20); // right leg
        if (skin.height == 64) {
            drawPart(20, 52, 4, 12, 8, 20); // left leg
        } else {
            drawPart(4, 20, 4, 12, 8, 20, 4, 12, true);
        }
        drawPart(44, 20, model == "wide" ? 4 : 3, 12, model == "wide" ? 0 : 1, 8); // right arm
        if (skin.height == 64) {
            drawPart(36, 52, model == "wide" ? 4 : 3, 12, 12, 8); // left arm
        } else {
            drawPart(44, 20, model == "wide" ? 4 : 3, 12, 12, 8, model == "wide" ? 4 : 3, 12, true); // left arm
        }

        // second layer
        if (skin.height == 64) {
            drawPart(40, 8, 8, 8, 4, 0); // head
            drawPart(20, 36, 8, 12, 4, 8); // torso
            drawPart(4, 36, 4, 12, 4, 20); // right leg
            drawPart(4, 52, 4, 12, 8, 20); // left leg
            drawPart(44, 36, model == "wide" ? 4 : 3, 12, model == "wide" ? 0 : 1, 8); // right arm
            drawPart(52, 52, model == "wide" ? 4 : 3, 12, 12, 8); // left arm
        }

        callback(canvas.toDataURL())
    }

    skin.onerror = (err) => {
        callback(null);
    };

    skin.src = skinPath;
}

function sortInstances(how) {
    if (!document.getElementsByClassName("group-list")[0]) return;
    data.setDefault("default_sort", how);
    let attrhow = how.toLowerCase().replaceAll("_", "-");
    attrhow = "data-" + attrhow;
    let groups = document.getElementsByClassName("group");
    let usedates = (how == "last_played" || how == "date_created" || how == "date_modified");
    let usenumbers = (how == "play_time");
    let reverseOrder = ["last_played", "date_created", "date_modified", "play_time", "game_version"].includes(how);
    let multiply = reverseOrder ? -1 : 1;
    for (let i = 0; i < groups.length; i++) {
        let children = Array.from(groups[i].children);
        if (children.length > 1) {
            children.sort((a, b) => {
                if (how == "game_version") {
                    const aIndex = minecraftVersions.indexOf(a.getAttribute(attrhow));
                    const bIndex = minecraftVersions.indexOf(b.getAttribute(attrhow));
                    if (aIndex === -1 && bIndex === -1) {
                        return a.getAttribute(attrhow).localeCompare(b.getAttribute(attrhow), undefined, { numeric: true, sensitivity: "base" });
                    }
                    if (aIndex === -1) return -1;
                    if (bIndex === -1) return 1;
                    return bIndex - aIndex;
                }
                if (usedates) {
                    let c = new Date(a.getAttribute(attrhow));
                    let d = new Date(b.getAttribute(attrhow));
                    c = c.getTime();
                    d = d.getTime();
                    if (isNaN(c)) c = 0;
                    if (isNaN(d)) d = 0;
                    return multiply * (c - d);
                }
                if (usenumbers) {
                    return multiply * (a.getAttribute(attrhow) - b.getAttribute(attrhow));
                }
                let av = a.getAttribute(attrhow)?.toLowerCase() ?? "";
                let bv = b.getAttribute(attrhow)?.toLowerCase() ?? "";
                if (av > bv) return 1 * multiply;
                if (av < bv) return -1 * multiply;
                return 0;
            });
            // Use DocumentFragment to minimize reflows
            let frag = document.createDocumentFragment();
            children.forEach(e => frag.appendChild(e));
            groups[i].appendChild(frag);
        }
    }
}

function groupInstances(how) {
    if (!document.getElementsByClassName("group-list")[0]) return;
    data.setDefault("default_group", how);
    let attrhow = how.toLowerCase().replaceAll("_", "-");
    attrhow = "data-" + attrhow;
    let instances = Array.from(document.querySelectorAll(".group-list .instance-item"));
    let groupMap = {};
    instances.forEach(inst => {
        let key = inst.getAttribute(attrhow) || "";
        if (!groupMap[key]) groupMap[key] = [];
        groupMap[key].push(inst);
    });
    let groupList = document.getElementsByClassName("group-list")[0];
    while (groupList.firstChild) groupList.removeChild(groupList.firstChild);
    let groups = Object.keys(groupMap);
    if (how == "game_version") {
        groups.sort((a, b) => {
            const aIndex = minecraftVersions.indexOf(a);
            const bIndex = minecraftVersions.indexOf(b);
            if (aIndex === -1 && bIndex === -1) {
                return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
            }
            if (aIndex === -1) return -1;
            if (bIndex === -1) return 1;
            return bIndex - aIndex;
        });
    } else {
        groups.sort((a, b) => {
            if (a === "" && b !== "") return -1;
            if (a !== "" && b === "") return 1;
            return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
        });
    }
    groups.forEach(groupKey => {
        let newElement = document.createElement("div");
        newElement.classList.add("group");
        newElement.setAttribute("data-group-title", how == "loader" ? loaders[groupKey] : groupKey);
        let frag = document.createDocumentFragment();
        groupMap[groupKey].forEach(inst => frag.appendChild(inst));
        newElement.appendChild(frag);
        groupList.appendChild(newElement);
    });
    sortInstances(sortBy.getSelected);
}
function searchInstances(query) {
    query = query.toLowerCase().trim();
    let instances = document.querySelectorAll(".group-list .instance-item");
    for (let i = 0; i < instances.length; i++) {
        if (!instances[i].getAttribute("data-name").toLowerCase().includes(query)) {
            instances[i].style.display = "none";
            instances[i].classList.add("hidden");
        } else {
            instances[i].style.display = "flex";
            instances[i].classList.remove("hidden");
        }
    }
}
let sortBy;
let loaders = {
    "vanilla": translate("app.loader.vanilla"),
    "fabric": translate("app.loader.fabric"),
    "forge": translate("app.loader.forge"),
    "neoforge": translate("app.loader.neoforge"),
    "quilt": translate("app.loader.quilt"),
    "": translate("app.loader.unknown")
}
function showInstanceContent(e) {
    let ele = document.createElement("div");
    ele.classList.add("instance-content");
    let title = document.createElement("div");
    title.classList.add("title-top");
    let h1 = document.createElement("h1");
    h1.innerHTML = translate("app.page.instances");
    title.appendChild(h1);
    let createButton = document.createElement("button");
    createButton.classList.add("create-button");
    createButton.innerHTML = '<i class="fa-solid fa-plus"></i>' + translate("app.button.instances.create");
    createButton.onclick = (e) => {
        let dialog = new Dialog();
        dialog.showDialog(translate("app.button.instances.create"), "form", [
            {
                "type": "image-upload",
                "id": "icon",
                "tab": "custom",
                "name": translate("app.instances.icon")
            },
            {
                "type": "text",
                "name": translate("app.instances.name"),
                "id": "name",
                "tab": "custom",
                "maxlength": 50
            },
            {
                "type": "multi-select",
                "name": translate("app.instances.loader"),
                "options": [
                    { "name": loaders["vanilla"], "value": "vanilla" },
                    { "name": loaders["fabric"], "value": "fabric" },
                    { "name": loaders["forge"], "value": "forge" },
                    { "name": loaders["neoforge"], "value": "neoforge" },
                    { "name": loaders["quilt"], "value": "quilt" }
                ],
                "id": "loader",
                "tab": "custom"
            },
            {
                "type": "dropdown",
                "name": translate("app.instances.game_version"),
                "options": [],
                "id": "game_version",
                "input_source": "loader",
                "source": VersionList.getVersions,
                "tab": "custom",
                "default": VersionList.getLatestRelease()
            },
            {
                "type": "image-upload",
                "id": "icon_c",
                "tab": "code",
                "name": translate("app.instances.icon")
            },
            {
                "type": "text",
                "id": "name_c",
                "tab": "code",
                "name": translate("app.instances.name"),
                "maxlength": 50
            },
            {
                "type": "text",
                "id": "profile_code",
                "tab": "code",
                "name": translate("app.instances.cf_code")
            },
            {
                "type": "image-upload",
                "id": "icon_f",
                "tab": "file",
                "name": translate("app.instances.icon")
            },
            {
                "type": "text",
                "id": "name_f",
                "tab": "file",
                "name": translate("app.instances.name"),
                "maxlength": 50
            },
            {
                "type": "text",
                "id": "file",
                "tab": "file",
                "name": translate("app.instances.file"),
                "desc": translate("app.instances.file.description"),
                "default": "",
                "buttons": [
                    {
                        "name": translate("app.instances.file.browse"),
                        "icon": '<i class="fa-solid fa-file"></i>',
                        "func": async (v, b, i) => {
                            let newValue = await window.electronAPI.triggerFileImportBrowse(v, 0);
                            if (newValue) i.value = newValue;
                        }
                    }/*,
                    {
                        "name": "Browse Folders",
                        "icon": '<i class="fa-solid fa-folder"></i>',
                        "func": async (v, b, i) => {
                            let newValue = await window.electronAPI.triggerFileImportBrowse(v, 1);
                            if (newValue) i.value = newValue;
                        }
                    }*/
                ]
            }//,
            // {
            //     "type": "dropdown",
            //     "id": "launcher",
            //     "tab": "launcher",
            //     "name": translate("app.instances.launcher"),
            //     "options": [
            //         {
            //             "name": translate("app.launcher.modrinth"),
            //             "value": "modrinth"
            //         },
            //         {
            //             "name": translate("app.launcher.curseforge"),
            //             "value": "curseforge"
            //         },
            //         {
            //             "name": translate("app.launcher.multimc"),
            //             "value": "multimc"
            //         },
            //         {
            //             "name": translate("app.launcher.prism"),
            //             "value": "prism"
            //         },
            //         {
            //             "name": translate("app.launcher.atlauncher"),
            //             "value": "atlauncher"
            //         },
            //         {
            //             "name": translate("app.launcher.gdlauncher"),
            //             "value": "gdlauncher"
            //         },
            //         {
            //             "name": translate("app.launcher.vanilla"),
            //             "value": "vanilla"
            //         }
            //     ]
            // }
        ], [
            { "content": translate("app.instances.cancel"), "type": "cancel" },
            { "content": translate("app.instances.submit"), "type": "confirm" }
        ], [
            {
                "name": translate("app.instances.tab.custom"),
                "value": "custom"
            },
            {
                "name": translate("app.instances.tab.file"),
                "value": "file"
            },
            {
                "name": translate("app.instances.tab.code"),
                "value": "code"
            }//,
            // {
            //     "name": translate("app.instances.tab.launcher"),
            //     "value": "launcher"
            // }
        ], async (e) => {
            let info = {};
            e.forEach(e => { info[e.id] = e.value });
            if (info.selected_tab == "custom") {
                if (info.game_version == "loading") {
                    displayError(translate("app.instances.no_game_version"));
                    return;
                }
                if (!info.name) {
                    displayError(translate("app.instances.no_name"));
                    return;
                }
                let instance_id = window.electronAPI.getInstanceFolderName(info.name);
                let loader_version = "";
                if (info.loader == "fabric") {
                    loader_version = (await window.electronAPI.getFabricVersion(info.game_version))
                } else if (info.loader == "forge") {
                    loader_version = (await window.electronAPI.getForgeVersion(info.game_version))
                } else if (info.loader == "neoforge") {
                    loader_version = (await window.electronAPI.getNeoForgeVersion(info.game_version))
                } else if (info.loader == "quilt") {
                    loader_version = (await window.electronAPI.getQuiltVersion(info.game_version))
                }
                let instance = data.addInstance(info.name, new Date(), new Date(), "", info.loader, info.game_version, loader_version, false, false, "", info.icon, instance_id, 0, "custom", "", false, false);
                showSpecificInstanceContent(instance);
                let r = await window.electronAPI.downloadMinecraft(instance_id, info.loader, info.game_version, loader_version);
                instance.setJavaPath(r.java_installation);
                instance.setJavaVersion(r.java_version);
                instance.setMcInstalled(true);
            } else if (info.selected_tab == "file") {
                if (!info.name_if) info.name_if = "";
                let instance_id = window.electronAPI.getInstanceFolderName(info.name_f);
                let instance = data.addInstance(info.name_f, new Date(), new Date(), "", "", "", "", false, true, "", info.icon_f, instance_id, 0, "", "", true, false);
                showSpecificInstanceContent(instance);
                let packInfo = await window.electronAPI.processPackFile(info.file, instance_id, info.name_f);
                console.log(packInfo);
                if (!packInfo.loader_version) {
                    displayError(packInfo);
                    return;
                }
                instance.setLoader(packInfo.loader);
                instance.setVanillaVersion(packInfo.vanilla_version);
                instance.setLoaderVersion(packInfo.loader_version);
                if (!instance.image && packInfo.image) instance.setImage(packInfo.image);
                if (!instance.name && packInfo.name) instance.setName(packInfo.name);
                if (packInfo.allocated_ram) instance.setAllocatedRam(packInfo.allocated_ram);
                packInfo.content.forEach(e => {
                    instance.addContent(e.name, e.author, e.image, e.file_name, e.source, e.type, e.version, e.source_id, e.disabled, e.version_id);
                });
                instance.setInstalling(false);
                let r = await window.electronAPI.downloadMinecraft(instance_id, packInfo.loader, packInfo.vanilla_version, packInfo.loader_version);
                instance.setJavaPath(r.java_installation);
                instance.setJavaVersion(r.java_version);
                instance.setMcInstalled(true);
            } else if (info.selected_tab == "launcher") {
                // Import from launcher here
            } else if (info.selected_tab == "code") {
                if (!info.name_c) {
                    displayError(translate("app.instances.no_name"));
                    return;
                }
                let instance_id = window.electronAPI.getInstanceFolderName(info.name_c);
                let instance = data.addInstance(info.name_c, new Date(), new Date(), "", "", "", "", false, true, "", info.icon_c, instance_id, 0, "", "", true, false);
                showSpecificInstanceContent(instance);
                let packInfo = await window.electronAPI.processPackFile(`https://api.curseforge.com/v1/shared-profile/${info.profile_code}`, instance_id, info.name_c);
                console.log(packInfo);
                if (!packInfo) {
                    displayError(translate("app.cf.code.error"));
                    instance.delete();
                    instanceContent.displayContent();
                    return;
                }
                if (!packInfo.loader_version) {
                    displayError(packInfo);
                    return;
                }
                instance.setLoader(packInfo.loader);
                instance.setVanillaVersion(packInfo.vanilla_version);
                instance.setLoaderVersion(packInfo.loader_version);
                if (packInfo.allocated_ram) instance.setAllocatedRam(packInfo.allocated_ram);
                packInfo.content.forEach(e => {
                    instance.addContent(e.name, e.author, e.image, e.file_name, e.source, e.type, e.version, e.source_id, e.disabled, e.version_id);
                });
                instance.setInstalling(false);
                let r = await window.electronAPI.downloadMinecraft(instance_id, packInfo.loader, packInfo.vanilla_version, packInfo.loader_version);
                instance.setJavaPath(r.java_installation);
                instance.setJavaVersion(r.java_version);
                instance.setMcInstalled(true);
            }
        })
    }
    title.appendChild(createButton);
    ele.appendChild(title);
    let searchAndFilter = document.createElement("div");
    searchAndFilter.classList.add("search-and-filter");
    ele.appendChild(searchAndFilter);
    let search = document.createElement("div");
    let searchbar = new SearchBar(search, searchInstances, null);
    let sort = document.createElement('div');
    sortBy = new SearchDropdown(translate("app.instances.sort.by"), [{ "name": translate("app.instances.sort.name"), "value": "name" },
    { "name": translate("app.instances.sort.last_played"), "value": "last_played" },
    { "name": translate("app.instances.sort.date_created"), "value": "date_created" },
    { "name": translate("app.instances.sort.date_modified"), "value": "date_modified" },
    { "name": translate("app.instances.sort.play_time"), "value": "play_time" },
    { "name": translate("app.instances.sort.game_version"), "value": "game_version" }], sort, data.getDefault("default_sort"), sortInstances);
    let group = document.createElement('div');
    let groupBy = new SearchDropdown(translate("app.instances.group.by"), [{ "name": translate("app.instances.group.none"), "value": "none" }, { "name": translate("app.instances.group.custom_groups"), "value": "custom_groups" }, { "name": translate("app.instances.group.loader"), "value": "loader" }, { "name": translate("app.instances.group.game_version"), "value": "game_version" }], group, data.getDefault("default_group"), groupInstances);
    searchAndFilter.appendChild(search);
    searchAndFilter.appendChild(sort);
    searchAndFilter.appendChild(group);
    let instanceGrid = document.createElement("div");
    instanceGrid.classList.add("group-list");
    let groupOne = document.createElement("div");
    groupOne.setAttribute("data-group-title", "");
    groupOne.classList.add("group");
    instanceGrid.appendChild(groupOne);
    ele.appendChild(instanceGrid);
    let instances = data.getInstances();
    for (let i = 0; i < instances.length; i++) {
        let running = checkForProcess(instances[i].pid);
        if (!running) instances[i].setPid(null);
        if (running) {
            window.electronAPI.watchProcessForExit(instances[i].pid, () => {
                if (currentTab != "instances") return;
                instanceContent.displayContent();
                live.findLive();
            });
        }
        let instanceElement = document.createElement("button");
        instanceElement.setAttribute("data-name", instances[i].name);
        instanceElement.setAttribute("data-last-played", instances[i].last_played);
        instanceElement.setAttribute("data-date-created", instances[i].date_created);
        instanceElement.setAttribute("data-date-modified", instances[i].date_modified);
        instanceElement.setAttribute("data-play-time", instances[i].playtime);
        instanceElement.setAttribute("data-game-version", instances[i].vanilla_version);
        instanceElement.setAttribute("data-custom-groups", instances[i].group);
        instanceElement.setAttribute("data-loader", instances[i].loader);
        instanceElement.setAttribute("data-none", "");
        instanceElement.onclick = (e) => {
            showSpecificInstanceContent(new Instance(instances[i].instance_id));
        }
        instanceElement.classList.add("instance-item");
        if (running) instanceElement.classList.add("running");
        let instanceImage = document.createElement("img");
        instanceImage.classList.add("instance-image");
        if (instances[i].image) {
            instanceImage.src = instances[i].image;
        } else {
            instanceImage.src = "default.png";
        }
        instances[i].watchForChange("image", (i) => {
            instanceImage.src = i ? i : "default.png";
        });
        instanceElement.appendChild(instanceImage);
        let instanceInfoEle = document.createElement("div");
        instanceInfoEle.classList.add("instance-info");
        let instanceName = document.createElement("div");
        instances[i].watchForChange("name", (t) => {
            instanceName.innerHTML = sanitize(t);
            instanceElement.setAttribute("data-name", t);
            sortInstances(data.getDefault("default_sort"));
        });
        instanceName.classList.add("instance-name");
        instanceName.innerHTML = sanitize(instances[i].name);
        instanceInfoEle.appendChild(instanceName);
        let instanceDesc = document.createElement("div");
        instanceDesc.classList.add("instance-desc");
        instanceDesc.innerHTML = sanitize(loaders[instances[i].loader] + " " + instances[i].vanilla_version);
        let loader_text = loaders[instances[i].loader];
        let version_text = instances[i].vanilla_version;
        instances[i].watchForChange("loader", (l) => {
            loader_text = loaders[l];
            instanceDesc.innerHTML = sanitize(loader_text + " " + version_text);
            instanceElement.setAttribute("data-loader", l);
            groupInstances(data.getDefault("default_group"));
        });
        instances[i].watchForChange("vanilla_version", (v) => {
            version_text = v;
            instanceDesc.innerHTML = sanitize(loader_text + " " + version_text);
            instanceElement.setAttribute("data-game-version", v);
            groupInstances(data.getDefault("default_group"));
        });
        instances[i].watchForChange("group", (g) => {
            instanceElement.setAttribute("data-custom-groups", g);
            groupInstances(data.getDefault("default_group"));
        });
        instanceInfoEle.appendChild(instanceDesc);
        instanceElement.appendChild(instanceInfoEle);
        let buttons = new ContextMenuButtons([
            {
                "icon": running ? '<i class="fa-solid fa-circle-stop"></i>' : '<i class="fa-solid fa-play"></i>',
                "title": running ? translate("app.button.instances.stop") : translate("app.button.instances.play"),
                "func": running ? async (e) => {
                    await stopInstance(instances[i]);
                    instanceContent.displayContent();
                } : async (e) => {
                    await playInstance(instances[i]);
                    instanceContent.displayContent();
                }
            },
            {
                "icon": '<i class="fa-solid fa-plus"></i>',
                "title": translate("app.button.content.add"),
                "func": (e) => {
                    showAddContent(instances[i].instance_id, instances[i].vanilla_version, instances[i].loader);
                }
            },
            {
                "icon": '<i class="fa-solid fa-eye"></i>',
                "title": translate("app.button.instances.view"),
                "func": (e) => {
                    showSpecificInstanceContent(new Instance(instances[i].instance_id));
                }
            },
            {
                "icon": '<i class="fa-solid fa-copy"></i>',
                "title": translate("app.button.instances.duplicate"),
                "func": (e) => {
                    duplicateInstance(instances[i]);
                }
            },
            {
                "icon": '<i class="fa-solid fa-folder"></i>',
                "title": translate("app.button.instances.open_folder"),
                "func": (e) => {
                    window.electronAPI.openFolder(processRelativePath(`./minecraft/instances/${instances[i].instance_id}`));
                }
            },
            {
                "icon": '<i class="fa-solid fa-share"></i>',
                "title": translate("app.button.instances.share"),
                "func": (e) => {
                    openInstanceShareDialog(instances[i]);
                }
            },
            {
                "icon": '<i class="fa-solid fa-gear"></i>',
                "title": translate("app.button.instances.open_settings"),
                "func": (e) => {
                    showInstanceSettings(new Instance(instances[i].instance_id));
                }
            },
            {
                "icon": () => instances[i].pinned ? '<i class="fa-solid fa-thumbtack-slash"></i>' : '<i class="fa-solid fa-thumbtack"></i>',
                "title": () => instances[i].pinned ? translate("app.instances.unpin") : translate("app.instances.pin"),
                "func": (e) => {
                    instances[i].pinned ? unpinInstance(instances[i]) : pinInstance(instances[i]);
                    e.setTitle(instances[i].pinned ? translate("app.instances.unpin") : translate("app.instances.pin"));
                    e.setIcon(instances[i].pinned ? '<i class="fa-solid fa-thumbtack-slash"></i>' : '<i class="fa-solid fa-thumbtack"></i>');
                }
            },
            {
                "icon": '<i class="fa-solid fa-desktop"></i>',
                "title": translate("app.instances.desktop_shortcut"),
                "func": (e) => {
                    addDesktopShortcut(instances[i]);
                }
            },
            {
                "icon": '<i class="fa-solid fa-trash-can"></i>',
                "title": translate("app.button.instances.delete"),
                "func": (e) => {
                    let dialog = new Dialog();
                    dialog.showDialog(translate("app.instances.delete.confirm.title"), "form", [{
                        "content": translate("app.instances.delete.confirm.description").replace("%i", instances[i].name),
                        "type": "notice"
                    }, {
                        "type": "toggle",
                        "name": translate("app.instances.delete.files"),
                        "default": false,
                        "id": "delete"
                    }], [
                        {
                            "type": "cancel",
                            "content": translate("app.instances.delete.cancel")
                        },
                        {
                            "type": "confirm",
                            "content": translate("app.instances.delete.confirm")
                        }
                    ], [], async (v) => {
                        instances[i].delete();
                        instanceContent.displayContent();
                        if (v[0].value) {
                            try {
                                await window.electronAPI.deleteInstanceFiles(instances[i].instance_id);
                            } catch (e) {
                                displayError(translate("app.instances.delete.files.fail"));
                            }
                        }
                    });
                },
                "danger": true
            }
        ]);
        instanceElement.oncontextmenu = (e) => {
            contextmenu.showContextMenu(buttons, e.clientX, e.clientY);
        }
        groupOne.appendChild(instanceElement);
    }
    return ele;
}
function showSpecificInstanceContent(instanceInfo, default_tab) {
    currentTab = "instance";
    currentInstanceId = instanceInfo.instance_id;
    instanceInfo = instanceInfo.refresh();
    for (let i = 0; i < navButtons.length; i++) {
        navButtons[i].removeSelected();
    }
    instanceButton.setSelected();
    let running = checkForProcess(instanceInfo.pid);
    if (!running) instanceInfo.setPid(null);
    content.innerHTML = "";
    let ele = document.createElement("div");
    content.appendChild(ele);
    ele.classList.add("instance-content");
    let topBar = document.createElement("div");
    topBar.classList.add("instance-top");
    let instImg = document.createElement("img");
    instImg.classList.add("instance-top-image");
    if (instanceInfo.image) {
        instImg.src = instanceInfo.image;
    } else {
        instImg.src = "default.png";
    }
    instanceInfo.watchForChange("image", (i) => {
        instImg.src = i ? i : "default.png";
    })
    topBar.appendChild(instImg);
    let instTopInfo = document.createElement("div");
    instTopInfo.classList.add("instance-top-info");
    let instTopTitle = document.createElement("h1");
    instTopTitle.innerHTML = sanitize(instanceInfo.name);
    instanceInfo.watchForChange("name", (t) => {
        instTopTitle.innerHTML = sanitize(t);
    })
    instTopTitle.classList.add("instance-top-title");
    instTopInfo.appendChild(instTopTitle);
    let instTopSubInfo = document.createElement("div");
    instTopSubInfo.classList.add("instance-top-sub-info");
    let instTopVersions = document.createElement("div");
    instTopVersions.classList.add("instance-top-sub-info-specific");
    instTopVersions.innerHTML = `<i class="fa-solid fa-gamepad"></i>${sanitize(loaders[instanceInfo.loader] + " " + instanceInfo.vanilla_version)}`;
    let loader_text = loaders[instanceInfo.loader];
    let version_text = instanceInfo.vanilla_version;
    instanceInfo.watchForChange("loader", (l) => {
        loader_text = loaders[l];
        instTopVersions.innerHTML = `<i class="fa-solid fa-gamepad"></i>${sanitize(loader_text + " " + version_text)}`;
    })
    instanceInfo.watchForChange("vanilla_version", (v) => {
        version_text = v;
        instTopVersions.innerHTML = `<i class="fa-solid fa-gamepad"></i>${sanitize(loader_text + " " + version_text)}`;
    })
    let instTopPlaytime = document.createElement("div");
    instTopPlaytime.classList.add("instance-top-sub-info-specific");
    instTopPlaytime.setAttribute("title", translate("app.instances.play_time"));
    let playtime = instanceInfo.playtime;
    let last_played = instanceInfo.last_played;
    instTopPlaytime.innerHTML = `<i class="fa-solid fa-clock"></i>${sanitize(formatTime(instanceInfo.playtime))}`;
    instanceInfo.watchForChange("playtime", (v) => {
        if (!running) instTopPlaytime.innerHTML = `<i class="fa-solid fa-clock"></i>${sanitize(formatTime(v))}`
        playtime = v;
    });
    let playtimeInterval = setInterval(() => {
        if (!document.body.contains(instTopPlaytime)) clearInterval(playtimeInterval);
        if (!running) return;
        instTopPlaytime.innerHTML = `<i class="fa-solid fa-clock"></i>${sanitize(formatTime(playtime + Math.floor((new Date().getTime() - new Date(last_played).getTime()) / 1000)))}`
    }, 1000);
    let instTopLastPlayed = document.createElement("div");
    instTopLastPlayed.classList.add("instance-top-sub-info-specific");
    instTopLastPlayed.setAttribute("title", translate("app.instances.last_played"));
    instTopLastPlayed.innerHTML = `<i class="fa-solid fa-clock-rotate-left"></i>${sanitize(formatDate(instanceInfo.last_played, 2000))}`;
    instanceInfo.watchForChange("last_played", (v) => {
        instTopLastPlayed.innerHTML = `<i class="fa-solid fa-clock-rotate-left"></i>${sanitize(formatDate(v, 2000))}`;
        last_played = v;
    });
    instTopSubInfo.appendChild(instTopVersions);
    instTopSubInfo.appendChild(instTopPlaytime);
    instTopSubInfo.appendChild(instTopLastPlayed);
    instTopInfo.appendChild(instTopSubInfo);
    topBar.appendChild(instTopInfo);
    let playButton = document.createElement("button");
    let playButtonClick = async () => {
        playButton.innerHTML = '<i class="spinner"></i>' + translate("app.instances.loading");
        playButton.classList.remove("instance-top-play-button");
        playButton.classList.add("instance-top-loading-button");
        playButton.onclick = () => { };
        await playInstance(instanceInfo);
        playButton.innerHTML = '<i class="fa-solid fa-circle-stop"></i>' + translate("app.button.instances.stop_short");
        playButton.classList.remove("instance-top-loading-button");
        playButton.classList.add("instance-top-stop-button");
        playButton.onclick = stopButtonClick;
        if (tabs.selected == 'logs') {
            setInstanceTabContentLogs(new Instance(instanceInfo.instance_id), tabsInfo);
        }
        window.electronAPI.clearProcessWatches();
        window.electronAPI.watchProcessForExit((new Instance(instanceInfo.instance_id)).pid, () => {
            playButton.innerHTML = '<i class="fa-solid fa-play"></i>' + translate("app.button.instances.play_short");
            playButton.classList.remove("instance-top-stop-button");
            playButton.classList.remove("instance-top-loading-button");
            playButton.classList.add("instance-top-play-button");
            playButton.onclick = playButtonClick;
            live.findLive();
            running = false;
            analyzeLogs();
        });
        running = true;
    }
    let stopButtonClick = async () => {
        playButton.innerHTML = '<i class="spinner"></i>' + translate("app.instances.stopping");
        playButton.classList.add("instance-top-loading-button");
        playButton.onclick = () => { };
        let success = await stopInstance(instanceInfo);
        if (success) {
            playButton.innerHTML = '<i class="fa-solid fa-play"></i>' + translate("app.button.instances.play_short");
            playButton.classList.remove("instance-top-loading-button");
            playButton.classList.remove("instance-top-stop-button");
            playButton.classList.add("instance-top-play-button");
            playButton.onclick = playButtonClick;
            running = false;
            analyzeLogs();
        } else {
            playButton.classList.remove("instance-top-loading-button");
            playButton.classList.add("instance-top-stop-button");
            playButton.innerHTML = '<i class="fa-solid fa-circle-stop"></i>' + translate("app.button.instances.stop_short");
            playButton.onclick = stopButtonClick
            window.electronAPI.watchProcessForExit(instanceInfo.pid, () => {
                playButton.innerHTML = '<i class="fa-solid fa-play"></i>' + translate("app.button.instances.play_short");
                playButton.classList.remove("instance-top-stop-button");
                playButton.classList.remove("instance-top-loading-button");
                playButton.classList.add("instance-top-play-button");
                playButton.onclick = playButtonClick;
                live.findLive();
                running = false;
                analyzeLogs();
            });
        }
    }
    if (!instanceInfo.mc_installed) {
        playButton.innerHTML = '<i class="spinner"></i>' + translate("app.instances.installing");
        playButton.classList.remove("instance-top-play-button");
        playButton.classList.add("instance-top-loading-button");
        playButton.onclick = () => { };
    } else if (!running) {
        playButton.classList.add("instance-top-play-button");
        playButton.innerHTML = '<i class="fa-solid fa-play"></i>' + translate("app.button.instances.play_short");
        playButton.onclick = playButtonClick
    } else {
        playButton.classList.add("instance-top-stop-button");
        playButton.innerHTML = '<i class="fa-solid fa-circle-stop"></i>' + translate("app.button.instances.stop_short");
        playButton.onclick = stopButtonClick
        window.electronAPI.watchProcessForExit(instanceInfo.pid, () => {
            playButton.innerHTML = '<i class="fa-solid fa-play"></i>' + translate("app.button.instances.play_short");
            playButton.classList.remove("instance-top-stop-button");
            playButton.classList.add("instance-top-play-button");
            playButton.onclick = playButtonClick;
            live.findLive();
            running = false;
            analyzeLogs();
        });
    }
    instanceInfo.watchForChange("mc_installed", (v) => {
        if (v) {
            playButton.innerHTML = '<i class="fa-solid fa-play"></i>' + translate("app.button.instances.play_short");
            playButton.classList.remove("instance-top-loading-button");
            playButton.classList.add("instance-top-play-button");
            playButton.onclick = playButtonClick;
        } else {
            playButton.innerHTML = '<i class="spinner"></i>' + translate("app.instances.installing");
            playButton.classList.remove("instance-top-play-button");
            playButton.classList.remove("instance-top-stop-button");
            playButton.classList.add("instance-top-loading-button");
            playButton.onclick = () => { };
        }
    });
    let threeDots = document.createElement("button");
    threeDots.classList.add("instance-top-more");
    threeDots.innerHTML = '<i class="fa-solid fa-ellipsis-vertical"></i>';
    let buttons = new ContextMenuButtons([
        {
            "icon": '<i class="fa-solid fa-plus"></i>',
            "title": translate("app.button.content.add"),
            "func": (e) => {
                showAddContent(instanceInfo.instance_id, instanceInfo.vanilla_version, instanceInfo.loader);
            }
        },
        {
            "icon": '<i class="fa-solid fa-copy"></i>',
            "title": translate("app.button.instances.duplicate"),
            "func": (e) => {
                duplicateInstance(instanceInfo);
            }
        },
        {
            "icon": '<i class="fa-solid fa-folder"></i>',
            "title": translate("app.button.instances.open_folder"),
            "func": (e) => {
                window.electronAPI.openFolder(processRelativePath(`./minecraft/instances/${instanceInfo.instance_id}`));
            }
        },
        {
            "icon": '<i class="fa-solid fa-share"></i>',
            "title": translate("app.button.instances.share"),
            "func": (e) => {
                openInstanceShareDialog(instanceInfo);
            }
        },
        {
            "icon": '<i class="fa-solid fa-gear"></i>',
            "title": translate("app.button.instances.open_settings"),
            "func": (e) => {
                showInstanceSettings(new Instance(instanceInfo.instance_id), tabsInfo);
            }
        },
        {
            "icon": () => instanceInfo.pinned ? '<i class="fa-solid fa-thumbtack-slash"></i>' : '<i class="fa-solid fa-thumbtack"></i>',
            "title": () => instanceInfo.pinned ? translate("app.instances.unpin") : translate("app.instances.pin"),
            "func": (e) => {
                instanceInfo.pinned ? unpinInstance(instanceInfo) : pinInstance(instanceInfo);
                e.setTitle(instanceInfo.pinned ? translate("app.instances.unpin") : translate("app.instances.pin"));
                e.setIcon(instanceInfo.pinned ? '<i class="fa-solid fa-thumbtack-slash"></i>' : '<i class="fa-solid fa-thumbtack"></i>');
            }
        },
        {
            "icon": '<i class="fa-solid fa-desktop"></i>',
            "title": translate("app.instances.desktop_shortcut"),
            "func": () => {
                addDesktopShortcut(instanceInfo);
            }
        },
        {
            "icon": '<i class="fa-solid fa-trash-can"></i>',
            "title": translate("app.button.instances.delete"),
            "func": (e) => {
                let dialog = new Dialog();
                dialog.showDialog(translate("app.instances.delete.confirm.title"), "form", [{
                    "content": translate("app.instances.delete.confirm.description").replace("%i", instanceInfo.name),
                    "type": "notice"
                }, {
                    "type": "toggle",
                    "name": translate("app.instances.delete.files"),
                    "default": false,
                    "id": "delete"
                }], [
                    {
                        "type": "cancel",
                        "content": translate("app.instances.delete.cancel")
                    },
                    {
                        "type": "confirm",
                        "content": translate("app.instances.delete.confirm")
                    }
                ], [], async (v) => {
                    instanceInfo.delete();
                    instanceContent.displayContent();
                    if (v[0].value) {
                        try {
                            await window.electronAPI.deleteInstanceFiles(instanceInfo.instance_id);
                        } catch (e) {
                            displayError(translate("app.instances.delete.files.fail"));
                        }
                    }
                });
            },
            "danger": true
        }
    ]);
    let moreMenu = new MoreMenu(threeDots, buttons);
    topBar.appendChild(playButton);
    topBar.appendChild(threeDots);
    topBar.appendChild(moreMenu.element);
    ele.appendChild(topBar);
    let tabContent = document.createElement("div");
    ele.appendChild(tabContent);
    let tabsInfo = document.createElement("div");
    tabsInfo.classList.add("tab-info");
    ele.appendChild(tabsInfo);
    let tabs = new TabContent(tabContent, [
        {
            "name": translate("app.instances.tabs.content"), "value": "content", "func": () => {
                setInstanceTabContentContent(instanceInfo, tabsInfo);
            }
        },
        {
            "name": translate("app.instances.tabs.worlds"), "value": "worlds", "func": () => {
                setInstanceTabContentWorlds(instanceInfo, tabsInfo);
            }
        },
        {
            "name": translate("app.instances.tabs.logs"), "value": "logs", "func": () => {
                setInstanceTabContentLogs(instanceInfo.refresh(), tabsInfo);
            }
        },
        {
            "name": translate("app.instances.tabs.options"), "value": "options", "func": () => {
                setInstanceTabContentOptions(instanceInfo, tabsInfo);
            }
        },
        {
            "name": translate("app.instances.tabs.screenshots"), "value": "screenshots", "func": () => {
                setInstanceTabContentScreenshots(instanceInfo, tabsInfo);
            }
        }
    ]);
    tabs.selectOptionAdvanced(default_tab ?? "content");
    let analyzeLogs = async () => {
        instanceInfo = instanceInfo.refresh();
        let info = await window.electronAPI.analyzeLogs(instanceInfo.instance_id, instanceInfo.last_analyzed_log, running ? instanceInfo.current_log_file : "");
        instanceInfo.setPlaytime(info.total_playtime + instanceInfo.playtime);
        if (info.most_recent_log) instanceInfo.setLastAnalyzedLog(info.most_recent_log);
        for (let i = 0; i < info.last_played_servers.length; i++) {
            let entry = info.last_played_servers[i];
            console.log(entry);
            let existing = db.prepare("SELECT * FROM last_played_servers WHERE instance_id = ? AND ip = ?").get(instanceInfo.instance_id, entry[1] + ":" + entry[2]);
            if (!existing) {
                db.prepare("INSERT INTO last_played_servers (ip, instance_id, date) VALUES (?, ?, ?)").run(entry[1] + ":" + entry[2], instanceInfo.instance_id, entry[0]);
            } else {
                db.prepare("UPDATE last_played_servers SET date = ? WHERE instance_id = ? AND ip = ?").run(entry[0], instanceInfo.instance_id, entry[1] + ":" + entry[2]);
            }
        }
    }
    analyzeLogs();
}

function getServerLastPlayed(instance_id, ip) {
    if (!ip.includes(":")) ip += ":25565";
    let result = db.prepare("SELECT * FROM last_played_servers WHERE instance_id = ? AND ip = ?").get(instance_id, ip);
    return result ? new Date(result.date) : new Date(null);
}

function showInstanceSettings(instanceInfo, tabsInfo) {
    let dialog = new Dialog();
    dialog.showDialog(translate("app.instances.settings.title"), "form", [
        {
            "type": "image-upload",
            "name": translate("app.instances.settings.icon"),
            "id": "icon",
            "default": instanceInfo.image,
            "tab": "general"
        },
        {
            "type": "text",
            "name": translate("app.instances.settings.name"),
            "id": "name",
            "default": instanceInfo.name,
            "tab": "general",
            "maxlength": 50
        },
        {
            "type": "text",
            "name": translate("app.instances.settings.group"),
            "id": "group",
            "default": instanceInfo.group,
            "tab": "general",
            "desc": translate("app.instances.settings.group.description")
        },
        instanceInfo.locked ? null : {
            "type": "multi-select",
            "name": translate("app.instances.settings.loader"),
            "options": [
                { "name": translate("app.loader.vanilla"), "value": "vanilla" },
                { "name": translate("app.loader.fabric"), "value": "fabric" },
                { "name": translate("app.loader.forge"), "value": "forge" },
                { "name": translate("app.loader.neoforge"), "value": "neoforge" },
                { "name": translate("app.loader.quilt"), "value": "quilt" }
            ],
            "id": "loader",
            "default": instanceInfo.loader,
            "tab": "installation"
        },
        instanceInfo.locked ? null : {
            "type": "dropdown",
            "name": translate("app.instances.settings.game_version"),
            "options": [],
            "id": "game_version",
            "default": instanceInfo.vanilla_version,
            "tab": "installation",
            "input_source": "loader",
            "source": VersionList.getVersions
        },
        instanceInfo.locked ? null : {
            "type": "loader-version-dropdown",
            "name": "",
            "options": [],
            "id": "loader_version",
            "default": instanceInfo.loader_version,
            "tab": "installation",
            "loader_source": "loader",
            "game_version_source": "game_version"
        },
        instanceInfo.locked ? null : {
            "type": "toggle",
            "name": translate("app.instances.settings.update_content"),
            "default": true,
            "tab": "installation",
            "desc": translate("app.instances.settings.update_content.description"),
            "id": "update_content"
        },
        instanceInfo.installed_version ? {
            "type": "notice",
            "content": translate("app.instances.settings.modpack.installed_via", "%c", translate("app.discover." + instanceInfo.install_source)),
            "tab": "modpack"
        } : null,
        instanceInfo.installed_version ? {
            "type": "button",
            "name": translate("app.instances.settings.modpack.view"),
            "tab": "modpack",
            "icon": '<i class="fa-solid fa-eye"></i>',
            "func": () => {
                displayContentInfo(instanceInfo.install_source, instanceInfo.install_source == "curseforge" ? parseInt(instanceInfo.install_id) : instanceInfo.install_id, instanceInfo.instance_id);
            }
        } : null,
        instanceInfo.installed_version ? {
            "type": "dropdown",
            "name": translate("app.instances.settings.modpack.version.title"),
            "desc": translate("app.instances.settings.modpack.version.description"),
            "tab": "modpack",
            "id": "modpack_version",
            "options": [],
            "input_source": "",
            "source": async () => {
                return await getModpackVersions(instanceInfo.install_source, instanceInfo.install_id);
            },
            "default": instanceInfo.installed_version
        } : null,
        {
            "type": "button",
            "name": translate("app.instances.repair"),
            "icon": '<i class="fa-solid fa-wrench"></i>',
            "tab": instanceInfo.locked ? "general" : "installation",
            "func": () => {
                let dialog = new Dialog();
                dialog.showDialog(translate("app.instances.repair.title"), "form", [
                    {
                        "type": "notice",
                        "content": instanceInfo.install_source == "custom" ? translate("app.instances.repair.notice") : translate("app.instances.repair.notice_modpack")
                    },
                    {
                        "type": "toggle",
                        "name": translate("app.instances.repair.minecraft"),
                        "desc": translate("app.instances.repair.minecraft.description"),
                        "id": "minecraft",
                        "default": false
                    },
                    {
                        "type": "toggle",
                        "name": translate("app.instances.repair.java"),
                        "desc": translate("app.instances.repair.java.description"),
                        "id": "java",
                        "default": false
                    },
                    {
                        "type": "toggle",
                        "name": translate("app.instances.repair.assets"),
                        "desc": translate("app.instances.repair.assets.description"),
                        "id": "assets",
                        "default": false
                    },
                    instanceInfo.loader != "vanilla" ? {
                        "type": "toggle",
                        "name": translate("app.instances.repair.mod_loader", "%l", loaders[instanceInfo.loader]),
                        "desc": translate("app.instances.repair.mod_loader.description", "%l", loaders[instanceInfo.loader]),
                        "id": "mod_loader",
                        "default": false
                    } : null
                ].filter(e => e), [
                    {
                        "type": "cancel",
                        "content": translate("app.instances.repair.cancel")
                    },
                    {
                        "type": "confirm",
                        "content": translate("app.instances.repair.confirm")
                    }
                ], [], (v) => {
                    repairInstance(instanceInfo.refresh(), v.filter(e => e.value).map(e => e.id).filter(e => e != "selected_tab"));
                });
            },
            "close_dialog": true
        },
        {
            "type": "number",
            "name": translate("app.instances.settings.width"),
            "id": "width",
            "default": instanceInfo.window_width ?? 854,
            "tab": "window",
            "desc": translate("app.instances.settings.width.description")
        },
        {
            "type": "number",
            "name": translate("app.instances.settings.height"),
            "id": "height",
            "default": instanceInfo.window_height ?? 480,
            "tab": "window",
            "desc": translate("app.instances.settings.height.description")
        },
        {
            "type": "slider",
            "name": translate("app.instances.settings.ram"),
            "id": "allocated_ram",
            "default": instanceInfo.allocated_ram ?? 4096,
            "tab": "java",
            "min": 512,
            "max": window.electronAPI.getTotalRAM(),
            "increment": 64,
            "unit": translate("app.instances.settings.ram.unit"),
            "desc": translate("app.instances.settings.ram.description")
        },
        {
            "type": "text",
            "name": translate("app.instances.settings.java_installation"),
            "id": "java_path",
            "default": instanceInfo.java_path,
            "tab": "java",
            "desc": translate("app.instances.settings.java_installation.description").replace("%v", instanceInfo.java_version),
            "buttons": [
                {
                    "name": translate("app.instances.settings.java_installation.detect"),
                    "icon": '<i class="fa-solid fa-magnifying-glass"></i>',
                    "func": async (v, b, i) => {
                        b.innerHTML = '<i class="spinner"></i>' + translate("app.instances.settings.java_installation.detect.searching");
                        let dialog = new Dialog();
                        let results = await window.electronAPI.detectJavaInstallations(instanceInfo.java_version);
                        dialog.showDialog(translate("app.instances.settings.java_installation.detect.title"), "form", [
                            {
                                "type": "dropdown",
                                "id": "java_path",
                                "name": translate("app.instances.settings.java_installation.detect.java_path"),
                                "options": results.map(e => ({ "name": e.path, "value": e.path }))
                            }
                        ], [
                            { "type": "cancel", "content": translate("app.instances.settings.java_installation.detect.cancel") },
                            { "type": "confirm", "content": translate("app.instances.settings.java_installation.detect.confirm") }
                        ], [], (e) => {
                            let info = {};
                            e.forEach(e => { info[e.id] = e.value });
                            i.value = info.java_path;
                        });
                        b.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i>' + translate("app.instances.settings.java_installation.detect");
                    }
                },
                {
                    "name": translate("app.instances.settings.java_installation.browse"),
                    "icon": '<i class="fa-solid fa-folder"></i>',
                    "func": async (v, b, i) => {
                        let newValue = await window.electronAPI.triggerFileBrowse(v);
                        if (newValue) i.value = newValue;
                    }
                },
                {
                    "name": translate("app.instances.settings.java_installation.test"),
                    "icon": '<i class="fa-solid fa-play"></i>',
                    "func": async (v, b) => {
                        let num = Math.floor(Math.random() * 10000);
                        b.setAttribute("data-num", num);
                        b.classList.remove("failed");
                        b.innerHTML = '<i class="spinner"></i>' + translate("app.instances.settings.java_installation.test.testing");
                        let success = await window.electronAPI.testJavaInstallation(v);
                        if (success) {
                            b.innerHTML = '<i class="fa-solid fa-check"></i>' + translate("app.instances.settings.java_installation.test.success");
                        } else {
                            b.innerHTML = '<i class="fa-solid fa-xmark"></i>' + translate("app.instances.settings.java_installation.test.fail");
                            b.classList.add("failed");
                        }
                        setTimeout(() => {
                            if (b.getAttribute("data-num") == num) {
                                b.innerHTML = '<i class="fa-solid fa-play"></i>' + translate("app.instances.settings.java_installation.test");
                                b.classList.remove("failed");
                            }
                        }, 3000);
                    }
                },
                {
                    "name": translate("app.instances.settings.java_installation.test.reset"),
                    "icon": '<i class="fa-solid fa-rotate-left"></i>',
                    "func": async (v, b, i) => {
                        b.innerHTML = '<i class="spinner"></i>' + translate("app.instances.settings.java_installation.test.reset.resetting");
                        let java_path = await window.electronAPI.getJavaInstallation(instanceInfo.java_version);
                        i.value = java_path;
                        b.innerHTML = '<i class="fa-solid fa-rotate-left"></i>' + translate("app.instances.settings.java_installation.test.reset")
                    }
                }
            ]
        },
        {
            "type": "text",
            "id": "java_args",
            "name": translate("app.instances.settings.custom_args"),
            "default": instanceInfo.java_args,
            "tab": "java"
        },
        {
            "type": "text",
            "id": "env_vars",
            "name": translate("app.instances.settings.custom_env_vars"),
            "default": instanceInfo.env_vars,
            "tab": "java"
        },
        {
            "type": "text",
            "id": "pre_launch_hook",
            "name": translate("app.instances.settings.pre_launch_hook"),
            "default": instanceInfo.pre_launch_hook,
            "tab": "launch_hooks"
        },
        {
            "type": "text",
            "id": "wrapper",
            "name": translate("app.instances.settings.wrapper"),
            "default": instanceInfo.wrapper,
            "tab": "launch_hooks"
        },
        {
            "type": "text",
            "id": "post_exit_hook",
            "name": translate("app.instances.settings.post_exit_hook"),
            "default": instanceInfo.post_exit_hook,
            "tab": "launch_hooks",
            "desc": translate("app.post_exit.notice")
        }
    ].filter(e => e), [
        { "type": "cancel", "content": translate("app.instances.settings.cancel") },
        { "type": "confirm", "content": translate("app.instances.settings.confirm") }
    ], [
        { "name": translate("app.instances.settings.tab.general"), "value": "general" },
        instanceInfo.locked ? null : { "name": translate("app.instances.settings.tab.installation"), "value": "installation" },
        instanceInfo.installed_version ? { "name": translate("app.instances.settings.tab.modpack"), "value": "modpack" } : null,
        { "name": translate("app.instances.settings.tab.window"), "value": "window" },
        { "name": translate("app.instances.settings.tab.java"), "value": "java" },
        { "name": translate("app.instances.settings.tab.launch_hooks"), "value": "launch_hooks" }
    ].filter(e => e), async (e) => {
        let info = {};
        e.forEach(e => { info[e.id] = e.value });
        instanceInfo.setName(info.name);
        instanceInfo.setImage(info.icon);
        instanceInfo.setGroup(info.group);
        instanceInfo.setWindowWidth(info.width);
        instanceInfo.setWindowHeight(info.height);
        instanceInfo.setAllocatedRam(info.allocated_ram);
        instanceInfo.setJavaPath(info.java_path);
        instanceInfo.setJavaArgs(info.java_args);
        instanceInfo.setEnvVars(info.env_vars);
        instanceInfo.setPreLaunchHook(info.pre_launch_hook);
        instanceInfo.setWrapper(info.wrapper);
        instanceInfo.setPostExitHook(info.post_exit_hook);
        if (info.modpack_version && info.modpack_version != instanceInfo.installed_version && info.modpack_version != "loading") {
            if (instanceInfo.installing || !instanceInfo.mc_installed) {
                displayError(translate("app.modpack.update.progress_already"));
            }
            let source = instanceInfo.install_source;
            let modpack_info = e.filter(e => e.id == "modpack_version")[0].pass;
            runModpackUpdate(instanceInfo, source, modpack_info);
        }
        if (instanceInfo.loader == info.loader && instanceInfo.vanilla_version == info.game_version && instanceInfo.loader_version == info.loader_version) {
            return;
        }
        if ([info.game_version, info.loader_version].includes("loading")) {
            return;
        }
        if (!info.loader || !info.game_version) return;
        instanceInfo.setLoader(info.loader);
        instanceInfo.setVanillaVersion(info.game_version, true);
        instanceInfo.setLoaderVersion(info.loader_version);
        instanceInfo.setMcInstalled(false);
        await window.electronAPI.downloadMinecraft(instanceInfo.instance_id, info.loader, info.game_version, info.loader_version);
        if (info.update_content) {
            let content = instanceInfo.getContent();
            for (let i = 0; i < content.length; i++) {
                let c = content[i];
                try {
                    await updateContent(instanceInfo, c);
                } catch (e) {
                    displayError(translate("app.content.update_failed").replace("%c", c.name));
                }
            }
            displaySuccess(translate("app.instances.updated_all").replace("%i", instanceInfo.name));
            if (currentSubTab == "content" && currentTab == "instance" && currentInstanceId == instanceInfo.instance_id) {
                setInstanceTabContentContent(instanceInfo, tabsInfo);
            }
        }
        instanceInfo.setMcInstalled(true);
    });
}

function setInstanceTabContentContent(instanceInfo, element) {
    currentSubTab = "content";
    element.innerHTML = "";
    instanceInfo = instanceInfo.refresh();
    let instanceLockedBanner = document.createElement("div");
    instanceLockedBanner.className = "instance-locked-banner";
    let instanceLockedText = document.createElement("span");
    instanceLockedText.innerHTML = translate("app.instance.locked");
    let instanceLockedButton = document.createElement("button");
    instanceLockedButton.className = "instance-locked-button";
    instanceLockedButton.innerHTML = '<i class="fa-solid fa-unlock"></i>' + translate("app.instance.unlock");
    instanceLockedButton.onclick = () => {
        instanceInfo.setLocked(false);
        instanceInfo.setInstallSource("custom");
        instanceInfo.setInstallId("");
        instanceInfo.setInstalledVersion("");
        showSpecificInstanceContent(instanceInfo);
    }
    instanceLockedBanner.appendChild(instanceLockedText);
    instanceLockedBanner.appendChild(instanceLockedButton);
    if (instanceInfo.locked) {
        element.appendChild(instanceLockedBanner);
    }
    let searchAndFilter = document.createElement("div");
    searchAndFilter.classList.add("search-and-filter-v2");
    let importContent = document.createElement("button");
    importContent.classList.add("add-content-button");
    importContent.innerHTML = '<i class="fa-solid fa-plus"></i>' + translate("app.content.import");
    importContent.onclick = () => {
        let dialog = new Dialog();
        dialog.showDialog(translate("app.content.import.title"), "form", [
            {
                "type": "text",
                "id": "file_path",
                "name": translate("app.content.import.file_path"),
                "buttons": [
                    {
                        "name": translate("app.content.import.file_path.browse"),
                        "icon": '<i class="fa-solid fa-folder"></i>',
                        "func": async (v, b, i) => {
                            let newValue = await window.electronAPI.triggerFileImportBrowseWithOptions(v, 0, ["zip", "jar", "disabled"], translate("app.content.import.file_path.browse.types"));
                            if (newValue) i.value = newValue;
                            if (i.onchange) i.onchange();
                        }
                    }
                ]
            },
            {
                "type": "dropdown",
                "name": translate("app.content.import.type"),
                "options": [
                    {
                        "name": translate("app.content.auto"),
                        "value": "auto"
                    },
                    {
                        "name": translate("app.content.mod"),
                        "value": "mod"
                    },
                    {
                        "name": translate("app.content.resource_pack"),
                        "value": "resource_pack"
                    },
                    {
                        "name": translate("app.content.shader"),
                        "value": "shader"
                    }
                ],
                "id": "content_type",
                "default": "auto"
            }
        ], [
            {
                "type": "cancel",
                "content": translate("app.content.import.cancel")
            },
            {
                "type": "confirm",
                "content": translate("app.content.import.confirm")
            }
        ], [], async (v) => {
            let info = {};
            v.forEach(e => info[e.id] = e.value);
            await window.electronAPI.importContent(info.file_path, info.content_type, instanceInfo.instance_id);
            displaySuccess(translate("app.content.import.complete"));
            setInstanceTabContentContent(instanceInfo, element);
        })
    }
    if (instanceInfo.locked) {
        importContent.onclick = () => { };
        importContent.style.opacity = ".5";
        importContent.style.cursor = "not-allowed";
        importContent.setAttribute("title", translate("app.instances.locked.tooltip"))
    }
    let addContent = document.createElement("button");
    addContent.classList.add("add-content-button");
    addContent.innerHTML = '<i class="fa-solid fa-plus"></i>' + translate("app.button.content.add")
    addContent.onclick = () => {
        showAddContent(instanceInfo.instance_id, instanceInfo.vanilla_version, instanceInfo.loader);
    }
    if (instanceInfo.locked) {
        addContent.onclick = () => { };
        addContent.style.opacity = ".5";
        addContent.style.cursor = "not-allowed";
        addContent.setAttribute("title", translate("app.instances.locked.tooltip"))
    }
    let contentSearch = document.createElement("div");
    contentSearch.style.flexGrow = 2;
    let searchBar = new SearchBar(contentSearch, () => { }, null);
    let typeDropdown = document.createElement("div");
    let dropdownInfo = new SearchDropdown(translate("app.button.content.type"), [
        {
            "name": translate("app.content.all"),
            "value": "all"
        },
        {
            "name": translate("app.content.mods"),
            "value": "mod"
        },
        {
            "name": translate("app.content.resource_packs"),
            "value": "resource_pack"
        },
        {
            "name": translate("app.content.shaders"),
            "value": "shader"
        }
    ], typeDropdown, "all", () => { });
    typeDropdown.style.minWidth = "200px";
    searchAndFilter.appendChild(contentSearch);
    searchAndFilter.appendChild(typeDropdown);
    searchAndFilter.appendChild(importContent);
    searchAndFilter.appendChild(addContent);
    element.appendChild(searchAndFilter);
    let contentListWrap = document.createElement("div");
    let showContent = () => {
        contentListWrap.innerHTML = '';
        let old_file_names = instanceInfo.getContent().map((e) => e.file_name);
        let newContent = getInstanceContent(instanceInfo);
        let newContentAdd = newContent.newContent.filter((e) => !old_file_names.includes(e.file_name));
        newContentAdd.forEach(e => {
            instanceInfo.addContent(e.name, e.author, e.image, e.file_name, e.source, e.type, e.version, "", e.disabled, e.version_id);
        });
        let deleteContent = newContent.deleteContent;
        deleteContent.forEach(e => {
            let content = new Content(instanceInfo.instance_id, e);
            content.delete();
        });
        let content = [];
        let instance_content = instanceInfo.getContent();
        instance_content.sort((a, b) => {
            if (a.name.toLowerCase() > b.name.toLowerCase()) {
                return 1;
            }
            if (a.name.toLowerCase() < b.name.toLowerCase()) {
                return -1;
            }
            return 0;
        });
        for (let i = 0; i < instance_content.length; i++) {
            let e = instance_content[i];
            content.push({
                "primary_column": {
                    "title": e.name,
                    "desc": e.author ? "by " + e.author : ""
                },
                "secondary_column": {
                    "title": () => e.refresh().version,
                    "desc": () => e.refresh().file_name
                },
                "type": e.type,
                "class": e.source,
                "image": e.image,
                "onremove": (ele) => {
                    let dialog = new Dialog();
                    dialog.showDialog(translate("app.content.delete.title"), "notice", translate("app.content.delete.notice").replace("%c", e.name), [
                        {
                            "type": "cancel",
                            "content": translate("app.content.delete.cancel")
                        },
                        {
                            "type": "confirm",
                            "content": translate("app.content.delete.confirm")
                        }
                    ], [], async () => {
                        let success = await window.electronAPI.deleteContent(instanceInfo.instance_id, e.type, e.refresh().file_name);
                        if (success) {
                            ele.remove();
                            displaySuccess(translate("app.content.delete.success").replace("%c", e.name));
                            e.delete();
                        } else {
                            displayError(translate("app.content.delete.fail").replace("%c", e.name));
                        }
                    });
                },
                "more": {
                    "actionsList": [
                        {
                            "title": translate("app.content.open"),
                            "icon": '<i class="fa-solid fa-up-right-from-square"></i>',
                            "func": () => {
                                window.electronAPI.openFolder(processRelativePath(`./minecraft/instances/${instanceInfo.instance_id}/${e.type == "mod" ? "mods" : e.type == "resource_pack" ? "resourcepacks" : "shaderpacks"}`))
                            }
                        },
                        e.source == "modrinth" ? {
                            "title": translate("app.content.view"),
                            "icon": '<i class="fa-solid fa-circle-info"></i>',
                            "func": () => {
                                instanceInfo = instanceInfo.refresh();
                                displayContentInfo(e.source, e.source_info, instanceInfo.instance_id, instanceInfo.vanilla_version, instanceInfo.loader, instanceInfo.locked, false, contentList);
                            }
                        } : e.source == "curseforge" ? {
                            "title": translate("app.content.view"),
                            "icon": '<i class="fa-solid fa-circle-info"></i>',
                            "func": () => {
                                instanceInfo = instanceInfo.refresh();
                                displayContentInfo(e.source, parseInt(e.source_info), instanceInfo.instance_id, instanceInfo.vanilla_version, instanceInfo.loader, instanceInfo.locked, false, contentList);
                            }
                        } : null,
                        instanceInfo.locked ? null : e.source == "player_install" ? null : {
                            "title": translate("app.content.update"),
                            "icon": '<i class="fa-solid fa-download"></i>',
                            "func_id": "update",
                            "func": async () => {
                                try {
                                    let s = await updateContent(instanceInfo, e.refresh());
                                    if (s !== false) displaySuccess(translate("app.content.updated", "%c", e.name));
                                    contentList.updateSecondaryColumn();
                                } catch (f) {
                                    displayError(translate("app.content.update_failed", "%c", e.name));
                                    throw f;
                                }
                            }
                        },
                        instanceInfo.locked ? null : {
                            "title": e.disabled ? translate("app.content.enable") : translate("app.content.disable"),
                            "icon": e.disabled ? '<i class="fa-solid fa-eye"></i>' : '<i class="fa-solid fa-eye-slash"></i>',
                            "func_id": "toggle"
                        },
                        instanceInfo.locked ? null : {
                            "title": translate("app.content.delete"),
                            "icon": '<i class="fa-solid fa-trash-can"></i>',
                            "danger": true,
                            "func_id": "delete",
                            "func": (ele) => {
                                let dialog = new Dialog();
                                dialog.showDialog(translate("app.content.delete.title"), "notice", translate("app.content.delete.notice", "%c", e.name), [
                                    {
                                        "type": "cancel",
                                        "content": translate("app.content.delete.cancel")
                                    },
                                    {
                                        "type": "confirm",
                                        "content": translate("app.content.delete.confirm")
                                    }
                                ], [], async () => {
                                    let success = await window.electronAPI.deleteContent(instanceInfo.instance_id, e.type, e.file_name);
                                    if (success) {
                                        ele.remove();
                                        displaySuccess(translate("app.content.delete.success", "%c", e.name));
                                        e.delete();
                                    } else {
                                        displayError(translate("app.content.delete.fail", "%c", e.name));
                                    }
                                });
                            }
                        }
                    ].filter(e => e)
                },
                "disabled": e.disabled,
                "instance_info": instanceInfo,
                "pass_to_checkbox": e
            })
        }
        let contentList = new ContentList(contentListWrap, content, searchBar, {
            "checkbox": {
                "enabled": instanceInfo.locked ? false : true,
                "actionsList": [
                    instanceInfo.locked ? null : {
                        "title": translate("app.content.selection.update"),
                        "icon": '<i class="fa-solid fa-download"></i>',
                        "func": async (ele, e) => {
                            try {
                                let s = await updateContent(instanceInfo, e);
                                if (s !== false) displaySuccess(translate("app.content.updated", "%c", e.name));
                                contentList.updateSecondaryColumn();
                            } catch (f) {
                                displayError(translate("app.content.update_failed", "%c", e.name));
                                throw f;
                            }
                        }
                    },
                    instanceInfo.locked ? null : {
                        "title": translate("app.content.selection.enable"),
                        "icon": '<i class="fa-solid fa-eye"></i>',
                        "func_id": "enable",
                        "func": () => { }
                    },
                    instanceInfo.locked ? null : {
                        "title": translate("app.content.selection.disable"),
                        "icon": '<i class="fa-solid fa-eye-slash"></i>',
                        "func_id": "disable",
                        "func": () => { }
                    },
                    instanceInfo.locked ? null : {
                        "title": translate("app.content.selection.delete"),
                        "icon": '<i class="fa-solid fa-trash-can"></i>',
                        "danger": true,
                        "func": async (ele, e) => {
                            let success = await window.electronAPI.deleteContent(instanceInfo.instance_id, e.type, e.refresh().file_name);
                            if (success) {
                                ele.remove();
                                displaySuccess(translate("app.content.delete.success", "%c", e.name));
                                e.delete();
                            } else {
                                displayError(translate("app.content.delete.fail", "%c", e.name));
                            }
                        },
                        "show_confirmation_dialog": true,
                        "dialog_title": translate("app.content.delete.title"),
                        "dialog_content": translate("app.content.delete.selection_notice"),
                        "dialog_button": translate("app.content.delete.confirm")
                    }
                ].filter(e => e)
            },
            "disable": {
                "enabled": instanceInfo.locked ? false : true
            },
            "remove": {
                "enabled": instanceInfo.locked ? false : true
            },
            "more": {
                "enabled": true
            },
            "second_column_centered": false,
            "primary_column_name": translate("app.content.name"),
            "secondary_column_name": translate("app.content.file_info"),
            "refresh": {
                "enabled": true,
                "func": () => {
                    setInstanceTabContentContent(instanceInfo, element)
                }
            },
            "update_all": {
                "enabled": instanceInfo.locked ? false : true,
                "func": async (b) => {
                    b.innerHTML = "<i class='spinner'></i>" + translate("app.content.updating")
                    let content = instanceInfo.getContent();
                    for (let i = 0; i < content.length; i++) {
                        let c = content[i];
                        try {
                            await updateContent(instanceInfo, c);
                        } catch (e) {
                            displayError(translate("app.content.update_failed", "%c", c.name));
                        }
                    }
                    displaySuccess(translate("app.instances.updated_all", "%i", instanceInfo.name));
                    if (document.body.contains(b)) {
                        setInstanceTabContentContent(instanceInfo, element);
                    }
                }
            }
        }, dropdownInfo, translate("app.content.not_found"));
    }
    let currently_installing = new CurrentlyInstalling();
    contentListWrap.appendChild(currently_installing.element);
    instanceInfo.watchForChange("installing", (v) => {
        if (!v) {
            showContent();
        } else {
            contentListWrap.innerHTML = "";
            contentListWrap.appendChild(currently_installing.element);
        }
    });
    if (!instanceInfo.refresh().installing) {
        showContent();
    } else {
        contentListWrap.innerHTML = "";
        contentListWrap.appendChild(currently_installing.element);
    }
    element.appendChild(contentListWrap);
    clearMoreMenus();
}
function isNotDisplayNone(element) {
    return element.checkVisibility({ checkDisplayNone: true });
}
async function setInstanceTabContentWorlds(instanceInfo, element) {
    currentSubTab = "worlds";
    let searchAndFilter = document.createElement("div");
    searchAndFilter.classList.add("search-and-filter-v2");
    let importWorlds = document.createElement("button");
    importWorlds.classList.add("add-content-button");
    importWorlds.innerHTML = '<i class="fa-solid fa-plus"></i>' + translate("app.worlds.import")
    importWorlds.onclick = () => {
        let dialog = new Dialog();
        dialog.showDialog(translate("app.worlds.import.title"), "form", [
            {
                "type": "dropdown",
                "id": "launcher",
                "name": translate("app.worlds.import.launcher"),
                "options": [
                    {
                        "name": translate("app.name"),
                        "value": "current"
                    },
                    {
                        "name": translate("app.launcher.vanilla"),
                        "value": "vanilla"
                    },
                    {
                        "name": translate("app.launcher.modrinth"),
                        "value": "modrinth"
                    },
                    {
                        "name": translate("app.launcher.curseforge"),
                        "value": "curseforge"
                    },
                    {
                        "name": translate("app.launcher.multimc"),
                        "value": "multimc"
                    },
                    {
                        "name": translate("app.launcher.prism"),
                        "value": "prism"
                    },
                    {
                        "name": translate("app.launcher.atlauncher"),
                        "value": "atlauncher"
                    },
                    {
                        "name": translate("app.launcher.gdlauncher"),
                        "value": "gdlauncher"
                    }
                ]
            },
            {
                "type": "text",
                "id": "folder_path",
                "name": translate("app.worlds.import.folder_path"),
                "default": window.electronAPI.getInstanceFolderPath(),
                "input_source": "launcher",
                "source": window.electronAPI.getLauncherInstancePath,
                "buttons": [
                    {
                        "name": translate("app.worlds.import.folder_path.browse"),
                        "icon": '<i class="fa-solid fa-folder"></i>',
                        "func": async (v, b, i) => {
                            let newValue = await window.electronAPI.triggerFileImportBrowse(v, 1);
                            if (newValue) i.value = newValue;
                            if (i.onchange) i.onchange();
                        }
                    }
                ]
            },
            {
                "type": "dropdown",
                "name": translate("app.worlds.import.instance"),
                "input_source": "folder_path",
                "id": "instance",
                "source": window.electronAPI.getLauncherInstances,
                "options": [],
                "onchange": (a, b, c) => {
                    let launcher = "";
                    let filePath = "";
                    for (let i = 0; i < b.length; i++) {
                        if (b[i].id == "launcher") {
                            launcher = b[i].element.value;
                            if (launcher == "vanilla") {
                                c.style.display = "none";
                            } else {
                                c.style.display = "grid";
                            }
                        }
                        if (b[i].id == "folder_path") {
                            filePath = b[i].element.value;
                        }
                        if (b[i].id == "world") {
                            if (launcher == "vanilla") {
                                b[i].element.setOptions(window.electronAPI.getWorldsFromOtherLauncher(filePath).map(e => ({ "name": parseMinecraftFormatting(e.name), "value": e.value })));
                            } else {
                                b[i].element.setOptions(window.electronAPI.getWorldsFromOtherLauncher(a).map(e => ({ "name": parseMinecraftFormatting(e.name), "value": e.value })));
                            }
                        }
                    }
                }
            },
            {
                "type": "checkboxes",
                "name": translate("app.worlds.import.worlds"),
                "options": getInstanceWorlds(instanceInfo).map(e => ({ "name": e.name, "value": e.id })),
                "id": "world"
            },
            {
                "type": "toggle",
                "name": translate("app.worlds.import.remove"),
                "id": "remove",
                "default": false
            }
        ], [
            {
                "type": "cancel",
                "content": translate("app.worlds.import.cancel")
            },
            {
                "type": "confirm",
                "content": translate("app.worlds.import.confirm")
            }
        ], [], (v) => {
            let info = {};
            v.forEach(e => info[e.id] = e.value);
            console.log(info);
            for (let i = 0; i < info.world.length; i++) {
                let world = info.world[i];
                try {
                    window.electronAPI.transferWorld(world, instanceInfo.instance_id, info.remove);
                } catch (e) {
                    displayError(translate("app.worlds.import.error", "%m", e.message));
                }
            }
            displaySuccess(translate("app.worlds.import.complete"));
            setInstanceTabContentWorlds(instanceInfo, element);
        })
    }
    let addContent = document.createElement("button");
    addContent.classList.add("add-content-button");
    addContent.innerHTML = '<i class="fa-solid fa-plus"></i>' + translate("app.worlds.add")
    addContent.onclick = () => {
        showAddContent(instanceInfo.instance_id, instanceInfo.vanilla_version, instanceInfo.loader, "world");
    }
    let contentSearch = document.createElement("div");
    contentSearch.style.flexGrow = 2;
    let searchBar = new SearchBar(contentSearch, () => { }, null);
    let typeDropdown = document.createElement("div");
    let dropdownInfo = new SearchDropdown(translate("app.worlds.type"), [
        {
            "name": translate("app.worlds.all"),
            "value": "all"
        },
        {
            "name": translate("app.worlds.singleplayer"),
            "value": "singleplayer"
        },
        {
            "name": translate("app.worlds.multiplayer"),
            "value": "multiplayer"
        }//,
        // {
        //     "name": translate("app.worlds.realms"),
        //     "value": "realms"
        // }
    ], typeDropdown, "all", () => { });
    typeDropdown.style.minWidth = "200px";
    searchAndFilter.appendChild(contentSearch);
    searchAndFilter.appendChild(typeDropdown);
    searchAndFilter.appendChild(importWorlds);
    searchAndFilter.appendChild(addContent);
    element.innerHTML = "";
    element.appendChild(searchAndFilter);
    let worldList = [];

    let worlds = getInstanceWorlds(instanceInfo);
    let worldsMultiplayer = await getInstanceWorldsMulti(instanceInfo);
    for (let i = 0; i < worlds.length; i++) {
        worldList.push(
            {
                "primary_column": {
                    "title": worlds[i].name,
                    "desc": translate("app.worlds.last_played").replace("%s", formatDate(worlds[i].last_played))
                },
                "secondary_column": {
                    "title": () => translate("app.worlds.description.singleplayer"),
                    "desc": () => translate("app.worlds.description." + worlds[i].mode) + (worlds[i].hardcore ? " - <span style='color:#ff1313'>" + translate("app.worlds.description.hardcore") + "</span>" : "") + (worlds[i].commands ? " - " + translate("app.worlds.description.commands") : "") + (worlds[i].flat ? " - " + translate("app.worlds.description.flat") : "")
                },
                "type": "singleplayer",
                "image": worlds[i].icon ?? "default.png",
                "onremove": (ele) => {
                    let dialog = new Dialog();
                    dialog.showDialog(translate("app.worlds.delete.confirm.title"), "notice", translate("app.worlds.delete.confirm.description", "%w", parseMinecraftFormatting(worlds[i].name)), [
                        {
                            "type": "cancel",
                            "content": translate("app.worlds.delete.cancel")
                        },
                        {
                            "type": "confirm",
                            "content": translate("app.worlds.delete.confirm")
                        }
                    ], [], async () => {
                        let success = await window.electronAPI.deleteWorld(instanceInfo.instance_id, worlds[i].id);
                        if (success) {
                            ele.remove();
                            displaySuccess(translate("app.worlds.delete.success", "%w", parseMinecraftFormatting(worlds[i].name)));
                        } else {
                            displayError(translate("app.worlds.delete.fail", "%w", parseMinecraftFormatting(worlds[i].name)));
                        }
                    });
                },
                "more": {
                    "actionsList": [
                        minecraftVersions.indexOf(instanceInfo.vanilla_version) >= minecraftVersions.indexOf("23w14a") || !minecraftVersions ? {
                            "title": translate("app.worlds.play"),
                            "icon": '<i class="fa-solid fa-play"></i>',
                            "func": async () => {
                                await playSingleplayerWorld(instanceInfo, worlds[i].id);
                                showSpecificInstanceContent(instanceInfo.refresh(), 'worlds');
                            }
                        } : null,
                        {
                            "title": translate("app.worlds.open"),
                            "icon": '<i class="fa-solid fa-folder"></i>',
                            "func": () => {
                                window.electronAPI.openFolder(processRelativePath(`./minecraft/instances/${instanceInfo.instance_id}/saves/${worlds[i].id}`))
                            }
                        },
                        {
                            "title": () => isWorldPinned(worlds[i].id, instanceInfo.instance_id, "singleplayer") ? translate("app.worlds.unpin") : translate("app.worlds.pin"),
                            "icon": () => isWorldPinned(worlds[i].id, instanceInfo.instance_id, "singleplayer") ? '<i class="fa-solid fa-thumbtack-slash"></i>' : '<i class="fa-solid fa-thumbtack"></i>',
                            "func": (e) => {
                                let world_pinned = isWorldPinned(worlds[i].id, instanceInfo.instance_id, "singleplayer");
                                world_pinned ? unpinSingleplayerWorld(worlds[i].id, instanceInfo.instance_id) : pinSingleplayerWorld(worlds[i].id, instanceInfo.instance_id)
                                e.setTitle(!world_pinned ? translate("app.worlds.unpin") : translate("app.worlds.pin"));
                                e.setIcon(!world_pinned ? '<i class="fa-solid fa-thumbtack-slash"></i>' : '<i class="fa-solid fa-thumbtack"></i>');
                            }
                        },
                        // {
                        //     "title": translate("app.worlds.share"),
                        //     "icon": '<i class="fa-solid fa-share"></i>',
                        //     "func": () => { }
                        // },
                        minecraftVersions.indexOf(instanceInfo.vanilla_version) >= minecraftVersions.indexOf("23w14a") || !minecraftVersions ? {
                            "icon": '<i class="fa-solid fa-desktop"></i>',
                            "title": translate("app.worlds.desktop_shortcut"),
                            "func": (e) => {
                                addDesktopShortcutWorld(instanceInfo, worlds[i].name, "singleplayer", worlds[i].id, worlds[i].icon ?? "default.png");
                            }
                        } : null,
                        {
                            "title": translate("app.worlds.delete"),
                            "icon": '<i class="fa-solid fa-trash-can"></i>',
                            "danger": true,
                            "func_id": "delete",
                            "func": (ele) => {
                                let dialog = new Dialog();
                                dialog.showDialog(translate("app.worlds.delete.confirm.title"), "notice", translate("app.worlds.delete.confirm.description", "%w", parseMinecraftFormatting(worlds[i].name)), [
                                    {
                                        "type": "cancel",
                                        "content": translate("app.worlds.delete.cancel")
                                    },
                                    {
                                        "type": "confirm",
                                        "content": translate("app.worlds.delete.confirm")
                                    }
                                ], [], async () => {
                                    let success = await window.electronAPI.deleteWorld(instanceInfo.instance_id, worlds[i].id);
                                    if (success) {
                                        ele.remove();
                                        displaySuccess(translate("app.worlds.delete.success", "%w", parseMinecraftFormatting(worlds[i].name)));
                                    } else {
                                        displayError(translate("app.worlds.delete.fail", "%w", parseMinecraftFormatting(worlds[i].name)));
                                    }
                                });
                            }
                        }
                    ].filter(e => e)
                },
                "pass_to_checkbox": { "type": "singleplayer", "id": worlds[i].id, "name": worlds[i].name }
            });
    }
    for (let i = 0; i < worldsMultiplayer.length; i++) {
        let last_played = getServerLastPlayed(instanceInfo.instance_id, worldsMultiplayer[i].ip);
        worldList.push(
            {
                "primary_column": {
                    "title": worldsMultiplayer[i].name,
                    "desc": last_played.getFullYear() < 2000 ? translate("app.worlds.description.never_played") : translate("app.worlds.last_played").replace("%s", formatDate(last_played.toString()))
                },
                "secondary_column": {
                    "title": () => translate("app.worlds.description.multiplayer"),
                    "desc": () => worldsMultiplayer[i].ip,
                    "desc_hidden": true
                },
                "type": "multiplayer",
                "image": worldsMultiplayer[i].icon ?? "default.png",
                "onremove": (ele) => {
                    let dialog = new Dialog();
                    dialog.showDialog(translate("app.worlds.delete.confirm.title"), "notice", translate("app.worlds.delete.confirm.description", "%w", worldsMultiplayer[i].name), [
                        {
                            "type": "cancel",
                            "content": translate("app.worlds.delete.cancel")
                        },
                        {
                            "type": "confirm",
                            "content": translate("app.worlds.delete.confirm")
                        }
                    ], [], async () => {
                        let success = await window.electronAPI.deleteServer(instanceInfo.instance_id, [worldsMultiplayer[i].ip], [worldsMultiplayer[i].index]);
                        if (success) {
                            ele.remove();
                            displaySuccess(translate("app.worlds.delete.success", "%w", parseMinecraftFormatting(worldsMultiplayer[i].name)));
                        } else {
                            displayError(translate("app.worlds.delete.fail", "%w", parseMinecraftFormatting(worldsMultiplayer[i].name)));
                        }
                    });
                },
                "more": {
                    "actionsList": [
                        minecraftVersions.indexOf(instanceInfo.vanilla_version) >= minecraftVersions.indexOf("1.3") || !minecraftVersions ? {
                            "title": translate("app.worlds.play"),
                            "icon": '<i class="fa-solid fa-play"></i>',
                            "func": async () => {
                                await playMultiplayerWorld(instanceInfo, worldsMultiplayer[i].ip);
                                showSpecificInstanceContent(instanceInfo.refresh(), 'worlds');
                            }
                        } : null,
                        {
                            "title": () => isWorldPinned(worldsMultiplayer[i].ip, instanceInfo.instance_id, "multiplayer") ? translate("app.worlds.unpin") : translate("app.worlds.pin"),
                            "icon": () => isWorldPinned(worldsMultiplayer[i].ip, instanceInfo.instance_id, "multiplayer") ? '<i class="fa-solid fa-thumbtack-slash"></i>' : '<i class="fa-solid fa-thumbtack"></i>',
                            "func": (e) => {
                                let world_pinned = isWorldPinned(worldsMultiplayer[i].ip, instanceInfo.instance_id, "multiplayer");
                                world_pinned ? unpinMultiplayerWorld(worldsMultiplayer[i].ip, instanceInfo.instance_id) : pinMultiplayerWorld(worldsMultiplayer[i].ip, instanceInfo.instance_id)
                                e.setTitle(!world_pinned ? translate("app.worlds.unpin") : translate("app.worlds.pin"));
                                e.setIcon(!world_pinned ? '<i class="fa-solid fa-thumbtack-slash"></i>' : '<i class="fa-solid fa-thumbtack"></i>');
                            }
                        },
                        // {
                        //     "title": translate("app.worlds.share"),
                        //     "icon": '<i class="fa-solid fa-share"></i>',
                        //     "func": () => { }
                        // },
                        minecraftVersions.indexOf(instanceInfo.vanilla_version) >= minecraftVersions.indexOf("1.3") || !minecraftVersions ? {
                            "icon": '<i class="fa-solid fa-desktop"></i>',
                            "title": translate("app.worlds.desktop_shortcut"),
                            "func": (e) => {
                                addDesktopShortcutWorld(instanceInfo, worldsMultiplayer[i].name, "multiplayer", worldsMultiplayer[i].ip, worldsMultiplayer[i].icon ?? "default.png");
                            }
                        } : null,
                        {
                            "title": translate("app.worlds.delete"),
                            "icon": '<i class="fa-solid fa-trash-can"></i>',
                            "danger": true,
                            "func": (ele) => {
                                let dialog = new Dialog();
                                dialog.showDialog(translate("app.worlds.delete.confirm.title"), "notice", translate("app.worlds.delete.confirm.description", "%w", worldsMultiplayer[i].name), [
                                    {
                                        "type": "cancel",
                                        "content": translate("app.worlds.delete.cancel")
                                    },
                                    {
                                        "type": "confirm",
                                        "content": translate("app.worlds.delete.confirm")
                                    }
                                ], [], async () => {
                                    let success = await window.electronAPI.deleteServer(instanceInfo.instance_id, [worldsMultiplayer[i].ip], [worldsMultiplayer[i].index]);
                                    if (success) {
                                        ele.remove();
                                        displaySuccess(translate("app.worlds.delete.success", "%w", parseMinecraftFormatting(worldsMultiplayer[i].name)));
                                    } else {
                                        displayError(translate("app.worlds.delete.fail", "%w", parseMinecraftFormatting(worldsMultiplayer[i].name)));
                                    }
                                });
                            }
                        }
                    ].filter(e => e)
                },
                "pass_to_checkbox": { "type": "multiplayer", "ip": worldsMultiplayer[i].ip, "name": worldsMultiplayer[i].name, "index": worldsMultiplayer[i].index }
            });
    }

    let contentListWrap = document.createElement("div");
    let contentList = new ContentList(contentListWrap, worldList, searchBar, {
        "checkbox": {
            "enabled": true,
            "actionsList": [
                {
                    "title": translate("app.worlds.selection.delete"),
                    "icon": '<i class="fa-solid fa-trash-can"></i>',
                    "danger": true,
                    "dont_loop": true,
                    "func": async (eles, es) => {
                        let ips = [];
                        let indexes = [];
                        let elesm = [];
                        let names = [];
                        for (let i = 0; i < es.length; i++) {
                            let e = es[i];
                            if (e.type == "singleplayer") {
                                let success = await window.electronAPI.deleteWorld(instanceInfo.instance_id, e.id);
                                if (success) {
                                    eles[i].remove();
                                    displaySuccess(translate("app.worlds.delete.success", "%w", parseMinecraftFormatting(e.name)));
                                } else {
                                    displayError(translate("app.worlds.delete.fail", "%w", parseMinecraftFormatting(e.name)));
                                }
                            } else if (e.type == "multiplayer") {
                                ips.push(e.ip);
                                indexes.push(e.index);
                                elesm.push(eles[i]);
                                names.push(e.name);
                            }
                        }
                        if (!ips.length) return;
                        let success = await window.electronAPI.deleteServer(instanceInfo.instance_id, ips, indexes);
                        if (success) {
                            elesm.forEach(e => e.remove());
                            displaySuccess(translate("app.worlds.delete.success", "%w", parseMinecraftFormatting(names.join(", "))));
                        } else {
                            displayError(translate("app.worlds.delete.fail", "%w", parseMinecraftFormatting(names.join(", "))));
                        }
                    },
                    "show_confirmation_dialog": true,
                    "dialog_title": translate("app.worlds.delete.confirm.title"),
                    "dialog_content": translate("app.worlds.delete.selection_notice"),
                    "dialog_button": translate("app.worlds.delete.confirm")
                }
            ]
        },
        "disable": {
            "enabled": false
        },
        "remove": {
            "enabled": true
        },
        "more": {
            "enabled": true
        },
        "second_column_centered": true,
        "primary_column_name": translate("app.worlds.name"),
        "secondary_column_name": "",
        "refresh": {
            "enabled": true,
            "func": () => {
                setInstanceTabContentWorlds(instanceInfo, element);
            }
        },
        "update_all": {
            "enabled": false
        }
    }, dropdownInfo, translate("app.worlds.not_found"));
    element.appendChild(contentListWrap);
    clearMoreMenus();
}
function setInstanceTabContentLogs(instanceInfo, element) {
    currentSubTab = "logs";
    let deleteButton = document.createElement("button");
    let searchAndFilter = document.createElement("div");
    searchAndFilter.classList.add("search-and-filter-v2");
    let contentSearch = document.createElement("div");
    contentSearch.style.flexGrow = 2;
    let searchBarFilter = "";
    let searchBar = new SearchBar(contentSearch, (v) => {
        searchBarFilter = v.toLowerCase().trim();
        render();
    }, null);
    let typeDropdown = document.createElement("div");
    let log_info = window.electronAPI.getInstanceLogs(instanceInfo.instance_id);
    let logDisplay = document.createElement("div");
    let visible = document.createElement("div");
    visible.className = "logs-visible";
    let spacer = document.createElement("div");
    logDisplay.appendChild(visible);
    logDisplay.appendChild(spacer);
    let logs = [];
    let render = () => {
        let showLogs = logs.filter(e => e.content.toLowerCase().includes(searchBarFilter));
        const totalItems = showLogs.length;
        const itemHeight = 15;
        const containerHeight = 600;
        const buffer = 5;
        spacer.style.height = totalItems * itemHeight + "px";

        const scrollTop = logDisplay.scrollTop;
        const startIdx = Math.max(Math.floor(scrollTop / itemHeight) - buffer, 0);
        const visibleCount = Math.ceil(containerHeight / itemHeight) + buffer * 2;
        const endIdx = Math.min(startIdx + visibleCount, totalItems);

        visible.style.transform = `translateY(${startIdx * itemHeight}px)`;
        visible.innerHTML = '';
        for (let i = startIdx; i < endIdx; i++) {
            visible.appendChild(showLogs[i].element);
        }
    }
    let setUpLiveLog = () => {
        let log_path = instanceInfo.current_log_file;
        let running = checkForProcess(instanceInfo.pid);
        if (!running) {
            instanceInfo.setPid(null);
            logs = [];
            let lineElement = document.createElement("span");
            lineElement.innerHTML = translate("app.logs.no_live");
            lineElement.classList.add("log-entry");
            logs.push({ "element": lineElement, "content": translate("app.logs.no_live") });
        } else {
            let logInfo = window.electronAPI.getLog(log_path);
            logInfo = logInfo.split("\n");
            logs = [];
            logInfo.forEach((e) => {
                if (e == "") return;
                let lineElement = document.createElement("span");
                lineElement.innerHTML = sanitize(e);
                lineElement.classList.add("log-entry");
                if (e.includes("INFO")) {
                    lineElement.classList.add("log-info");
                } else if (e.includes("WARN")) {
                    lineElement.classList.add("log-warn");
                } else if (e.includes("ERROR") || e.includes("FATAL") || e.includes("at ") || e.includes("Error:") || e.includes("Caused by:") || e.includes("Exception")) {
                    lineElement.classList.add("log-error");
                }
                logs.push({ "element": lineElement, "content": e });
            });
            spacer.style.height = logs.length * 15 + "px";
            console.log("scrolling to bottom");
            console.log(logDisplay.scrollHeight);
            setTimeout(() => {
                logDisplay.scrollTo(0, logDisplay.scrollHeight);
            }, 0);
            window.electronAPI.watchFile(log_path, (log) => {
                let logInfo = log.split("\n");
                let scroll = logDisplay.scrollHeight - logDisplay.scrollTop - 50 <= logDisplay.clientHeight + 1;
                logInfo.forEach((e) => {
                    if (e == "") return;
                    if (e.length == 1) return;
                    let lineElement = document.createElement("span");
                    lineElement.innerHTML = sanitize(e);
                    lineElement.classList.add("log-entry");
                    if (e.includes("INFO")) {
                        lineElement.classList.add("log-info");
                    } else if (e.includes("WARN")) {
                        lineElement.classList.add("log-warn");
                    } else if (e.includes("ERROR") || e.includes("FATAL") || e.includes("at ") || e.includes("Error:") || e.includes("Caused by:") || e.includes("Exception")) {
                        lineElement.classList.add("log-error");
                    }
                    logs.push({ "element": lineElement, "content": e });
                });
                spacer.style.height = logs.length * 15 + "px";
                if (scroll) logDisplay.scrollTo(0, logDisplay.scrollHeight);
                render();
            });
        }
    }
    let currentLog = "";
    logDisplay.onscroll = render;
    let onChangeLogDropdown = (e) => {
        try {
            window.electronAPI.stopWatching(instanceInfo.current_log_file);
        } catch (e) { }

        if (e == "live_log") {
            deleteButton.style.display = "none";
            setUpLiveLog();
        } else {
            deleteButton.style.display = "flex";
            currentLog = e;
            let logInfo = window.electronAPI.getLog(e);
            logInfo = logInfo.split("\n");
            logs = [];
            logInfo.forEach((e) => {
                if (e == "") return;
                let lineElement = document.createElement("span");
                lineElement.innerHTML = sanitize(e);
                lineElement.classList.add("log-entry");
                if (e.includes("INFO")) {
                    lineElement.classList.add("log-info");
                } else if (e.includes("WARN")) {
                    lineElement.classList.add("log-warn");
                } else if (e.includes("ERROR") || e.includes("FATAL") || e.includes("at ") || e.includes("Error:") || e.includes("Caused by:") || e.includes("Exception")) {
                    lineElement.classList.add("log-error");
                }
                logs.push({ "element": lineElement, "content": e });
            });
        }
        render();
    }
    if (log_info.length > 9) {
        let dropdownInfo = new DialogDropdown(translate("app.logs.session"), [{ "name": translate("app.logs.live"), "value": "live_log" }].concat(log_info.map((e) => ({ "name": formatDateAndTime(e.date), "value": e.file_path }))), typeDropdown, "live_log", onChangeLogDropdown);
    } else {
        let dropdownInfo = new SearchDropdown(translate("app.logs.session"), [{ "name": translate("app.logs.live"), "value": "live_log" }].concat(log_info.map((e) => ({ "name": formatDateAndTime(e.date), "value": e.file_path }))), typeDropdown, "live_log", onChangeLogDropdown);
    }
    typeDropdown.style.minWidth = "300px";
    searchAndFilter.appendChild(contentSearch);
    searchAndFilter.appendChild(typeDropdown);
    element.innerHTML = "";
    element.appendChild(searchAndFilter);
    let logWrapper = document.createElement("div");
    logWrapper.className = "logs";
    element.appendChild(logWrapper);
    let logTop = document.createElement("div");
    logTop.className = "logs-top";
    logWrapper.appendChild(logTop);
    logWrapper.appendChild(logDisplay);
    deleteButton.style.display = "none";
    setUpLiveLog();
    render();
    let copyButton = document.createElement("button");
    let shareButton = document.createElement("button");
    let deleteAllButton = document.createElement("button");
    copyButton.className = "logs-copy";
    shareButton.className = "logs-share";
    deleteButton.className = "logs-delete";
    deleteAllButton.className = "logs-delete";
    copyButton.innerHTML = '<i class="fa-solid fa-copy"></i>' + translate("app.logs.copy");
    shareButton.innerHTML = '<i class="fa-solid fa-share"></i>' + translate("app.logs.share");
    deleteButton.innerHTML = '<i class="fa-solid fa-trash-can"></i>' + translate("app.logs.delete");
    deleteAllButton.innerHTML = '<i class="fa-solid fa-trash-can"></i>' + translate("app.logs.delete_all");
    copyButton.onclick = () => {
        let showLogs = logs.filter(e => e.content.toLowerCase().includes(searchBarFilter));
        let copyLogs = showLogs.map(e => e.content).join("\n");
        navigator.clipboard.writeText(copyLogs).then(() => {
            displaySuccess(searchBarFilter ? translate("app.logs.clipboard.search") : translate("app.logs.clipboard"));
        }).catch(() => {
            displayError(translate("app.logs.clipboard.fail"));
        });
    }
    shareButton.onclick = async () => {
        let showLogs = logs.filter(e => e.content.toLowerCase().includes(searchBarFilter));
        let copyLogs = showLogs.map(e => e.content).join("\n");
        let url = "";
        try {
            url = await window.electronAPI.shareLogs(copyLogs);
        } catch (e) {
            displayError(translate("app.logs.share.fail"));
            return;
        }
        await openShareDialog(translate("app.logs.share.title"), url, translate("app.logs.share.text"));
    }
    deleteButton.onclick = () => {
        let dialog = new Dialog();
        dialog.showDialog(translate("app.logs.delete.title"), "notice", translate("app.logs.delete.notice"), [
            {
                "type": "cancel",
                "content": translate("app.logs.delete.cancel")
            },
            {
                "type": "confirm",
                "content": translate("app.logs.delete.confirm")
            }
        ], [], async () => {
            let success = await window.electronAPI.deleteLogs(currentLog);
            if (success) {
                displaySuccess(translate("app.logs.delete.success"));
                setInstanceTabContentLogs(instanceInfo, element);
            } else {
                displayError(translate("app.logs.delete.fail"));
            }
        });
    }
    deleteAllButton.onclick = () => {
        let dialog = new Dialog();
        dialog.showDialog(translate("app.logs.delete_all.title"), "notice", translate("app.logs.delete_all.notice"), [
            {
                "type": "cancel",
                "content": translate("app.logs.delete_all.cancel")
            },
            {
                "type": "confirm",
                "content": translate("app.logs.delete_all.confirm")
            }
        ], [], async () => {
            let success = await window.electronAPI.deleteAllLogs(instanceInfo.instance_id, instanceInfo.refresh().current_log_file);
            if (success) {
                displaySuccess(translate("app.logs.delete_all.success"));
                setInstanceTabContentLogs(instanceInfo, element);
            } else {
                displayError(translate("app.logs.delete_all.fail"));
            }
        });
    }
    logTop.appendChild(copyButton);
    logTop.appendChild(shareButton);
    logTop.appendChild(deleteButton);
    logTop.appendChild(deleteAllButton);
    logDisplay.className = "logs-display";
}
function setInstanceTabContentOptions(instanceInfo, element) {
    currentSubTab = "options";
    let values = window.electronAPI.getInstanceOptions(instanceInfo.instance_id);
    let searchAndFilter = document.createElement("div");
    searchAndFilter.classList.add("search-and-filter-v2");
    let contentSearch = document.createElement("div");
    contentSearch.style.flexGrow = 2;
    let searchBar = new SearchBar(contentSearch, (v) => {
        for (let i = 0; i < values.length; i++) {
            if (values[i].key.toLowerCase().includes(v.toLowerCase().trim()) && (values[i].element.getAttribute("data-type") == dropdownInfo.value || dropdownInfo.value == "all")) {
                values[i].element.style.display = "grid";
            } else {
                values[i].element.style.display = "none";
            }
        }
    }, null);
    let typeDropdown = document.createElement("div");
    let dropdownInfo = new SearchDropdown(translate("app.options.type"), [
        {
            "name": translate("app.options.all"),
            "value": "all"
        },
        {
            "name": translate("app.options.number"),
            "value": "number"
        },
        {
            "name": translate("app.options.text"),
            "value": "text"
        },
        {
            "name": translate("app.options.boolean"),
            "value": "boolean"
        },
        {
            "name": translate("app.options.key"),
            "value": "key"
        },
        {
            "name": translate("app.options.unknown"),
            "value": "unknown"
        }
    ], typeDropdown, "all", (v) => {
        for (let i = 0; i < values.length; i++) {
            if (values[i].key.toLowerCase().includes(searchBar.value.toLowerCase().trim()) && (values[i].element.getAttribute("data-type") == v || v == "all")) {
                values[i].element.style.display = "grid";
            } else {
                values[i].element.style.display = "none";
            }
        }
    });
    typeDropdown.style.minWidth = "200px";
    searchAndFilter.appendChild(contentSearch);
    searchAndFilter.appendChild(typeDropdown);
    element.innerHTML = "";
    element.appendChild(searchAndFilter);
    let info = document.createElement("div");
    info.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>' + translate("app.options.notice_1");
    info.className = "info";
    info.style.marginTop = "10px";
    element.appendChild(info);
    let info2 = document.createElement("div");
    info2.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>' + translate("app.options.notice_2");
    info2.className = "info";
    info2.style.marginTop = "10px";
    element.appendChild(info2);
    let optionList = document.createElement("div");
    optionList.className = "option-list";
    element.appendChild(optionList);
    let selectedKeySelect;
    let selectedKeySelectFunction;

    document.body.addEventListener("keydown", (e) => {
        if (selectedKeySelect) {
            e.preventDefault();
            e.stopPropagation();
            let keyCode = codeToKey[e.code];
            if (e.key == "NumLock") {
                keyCode = codeToKey["NumLock"];
            }
            let oldInnerHtml = selectedKeySelect.innerHTML;
            let oldValue = selectedKeySelect.value;
            let tempSelected = selectedKeySelect;
            if (keyCode) {
                selectedKeySelect.innerHTML = keys[keyCode] || keyCode;
                selectedKeySelect.value = keyCode;
            } else {
                selectedKeySelect.innerHTML = keys["key.keyboard.unknown"];
                selectedKeySelect.value = "key.keyboard.unknown";
            }
            selectedKeySelect.classList.remove("selected");
            let key = selectedKeySelect.getAttribute("data-key")
            selectedKeySelect = null;
            try {
                console.log(key, keyCode ? keyCode : "key.keyboard.unknown");
                window.electronAPI.updateOptionsTXT(instanceInfo.instance_id, key, keyCode ? keyCode : "key.keyboard.unknown");
                displaySuccess(translate("app.options.updated"));
                if (selectedKeySelectFunction) selectedKeySelectFunction(keyCode ? keyCode : "key.keyboard.unknown");
            } catch (e) {
                displayError(translate("app.options.failed"));
                tempSelected.innerHTML = oldInnerHtml;
                tempSelected.value = oldValue;
            }
        }
    });

    document.body.addEventListener("mousedown", (e) => {
        if (selectedKeySelect) {
            e.preventDefault();
            e.stopPropagation();
            let mouseKey;
            if (e.button === 0) mouseKey = "key.mouse.left";
            else if (e.button === 1) mouseKey = "key.mouse.middle";
            else if (e.button === 2) mouseKey = "key.mouse.right";
            else if (e.button >= 3 && e.button <= 20) mouseKey = `key.mouse.${e.button + 1}`;
            else mouseKey = "key.keyboard.unknown";
            let oldInnerHtml = selectedKeySelect.innerHTML;
            let oldValue = selectedKeySelect.value;
            let tempSelected = selectedKeySelect;
            selectedKeySelect.innerHTML = keys[mouseKey] || mouseKey;
            selectedKeySelect.classList.remove("selected");
            selectedKeySelect.value = mouseKey;
            let key = selectedKeySelect.getAttribute("data-key")
            selectedKeySelect = null;
            try {
                window.electronAPI.updateOptionsTXT(instanceInfo.instance_id, key, mouseKey);
                displaySuccess(translate("app.options.updated"));
                if (selectedKeySelectFunction) selectedKeySelectFunction(mouseKey);
            } catch (e) {
                displayError(translate("app.options.failed"));
                tempSelected.innerHTML = oldInnerHtml;
                tempSelected.value = oldValue;
            }
        }
    });
    let defaultOptions = new DefaultOptions(instanceInfo.vanilla_version);
    for (let i = 0; i < values.length; i++) {
        let e = values[i];
        let item = document.createElement("div");
        item.className = "option-item";
        values[i].element = item;

        let titleElement = document.createElement("div");
        titleElement.className = "option-title";
        titleElement.innerHTML = e.key;
        item.appendChild(titleElement);

        let onChange = (v) => {
            values[i].value = (type == "text" ? '"' + v + '"' : v);
            if (defaultOptions.getDefault(e.key) == (type == "text" ? '"' + v + '"' : v)) {
                setDefaultButton.innerHTML = '<i class="fa-solid fa-minus"></i>' + translate("app.options.default.remove");
                setDefaultButton.onclick = onRemove;
            } else {
                setDefaultButton.innerHTML = '<i class="fa-solid fa-plus"></i>' + translate("app.options.default.set");
                setDefaultButton.onclick = onSet;
            }
        }

        let oldvalue = e.value;

        let type = "unknown";
        if (!isNaN(e.value) && e.value !== "" && typeof e.value === "string" && e.value.trim() !== "") {
            type = "number";
        }
        if (e.value == "false" || e.value == "true") {
            type = "boolean";
        }
        if (e.value.startsWith('"') && e.value.endsWith('"')) {
            type = "text";
        }
        if (e.value.startsWith("key.")) {
            type = "key";
        }
        let inputElement;
        item.setAttribute("data-type", type);
        if (type == "text") {
            inputElement = document.createElement("input");
            inputElement.className = "option-input";
            inputElement.value = e.value.slice(1, -1);
            inputElement.onchange = () => {
                try {
                    window.electronAPI.updateOptionsTXT(instanceInfo.instance_id, e.key, '"' + inputElement.value + '"');
                    displaySuccess(translate("app.options.updated"));
                    values[i].value = '"' + inputElement.value + '"';
                    oldvalue = inputElement.value;
                    onChange(inputElement.value);
                } catch (e) {
                    displayError(translate("app.options.failed"));
                    values[i].value = oldvalue;
                    inputElement.value = '"' + oldvalue + '"';
                }
            }
            item.appendChild(inputElement);
        } else if (type == "number") {
            inputElement = document.createElement("input");
            inputElement.className = "option-input";
            inputElement.value = e.value;
            inputElement.type = "number";
            inputElement.onchange = () => {
                try {
                    window.electronAPI.updateOptionsTXT(instanceInfo.instance_id, e.key, inputElement.value);
                    displaySuccess(translate("app.options.updated"));
                    values[i].value = inputElement.value;
                    oldvalue = inputElement.value;
                    onChange(inputElement.value);
                } catch (e) {
                    displayError(translate("app.options.failed"));
                    inputElement.value = oldvalue;
                    values[i].value = oldvalue;
                }
            }
            item.appendChild(inputElement);
        } else if (type == "boolean") {
            let inputElement1 = document.createElement("div");
            inputElement1.className = "option-input";
            inputElement = new SearchDropdown("", [{ "name": translate("app.options.true"), "value": "true" }, { "name": translate("app.options.false"), "value": "false" }], inputElement1, e.value, (v) => {
                try {
                    window.electronAPI.updateOptionsTXT(instanceInfo.instance_id, e.key, v);
                    displaySuccess(translate("app.options.updated"));
                    values[i].value = v;
                    oldvalue = v;
                    onChange(v);
                } catch (e) {
                    displayError(translate("app.options.failed"));
                    inputElement.selectOption(oldvalue);
                    values[i].value = oldvalue;
                }
            });
            item.appendChild(inputElement1);
        } else if (type == "unknown") {
            inputElement = document.createElement("input");
            inputElement.className = "option-input";
            inputElement.value = e.value;
            inputElement.onchange = () => {
                try {
                    window.electronAPI.updateOptionsTXT(instanceInfo.instance_id, e.key, inputElement.value);
                    displaySuccess(translate("app.options.updated"));
                    values[i].value = inputElement.value;
                    oldvalue = inputElement.value;
                    onChange(inputElement.value);
                } catch (e) {
                    displayError(translate("app.options.failed"));
                    inputElement.value = oldvalue;
                    values[i].value = oldvalue;
                }
            }
            item.appendChild(inputElement);
        } else if (type == "key") {
            inputElement = document.createElement("button");
            inputElement.className = "option-key-input";
            inputElement.value = e.value;
            inputElement.setAttribute("data-key", e.key);
            inputElement.innerHTML = keys[e.value] ? keys[e.value] : e.value;
            inputElement.onclick = () => {
                [...document.querySelectorAll(".option-key-input.selected")].forEach(e => {
                    e.classList.remove("selected");
                });
                inputElement.classList.add("selected");
                selectedKeySelect = inputElement;
                selectedKeySelectFunction = (v) => {
                    onChange(v);
                }
            }
            item.appendChild(inputElement);
        }

        let setDefaultButton = document.createElement("button");
        setDefaultButton.className = "option-button";
        setDefaultButton.innerHTML = '<i class="fa-solid fa-plus"></i>' + translate("app.options.default.set");

        let onSet = () => {
            defaultOptions.setDefault(e.key, type == "text" ? '"' + inputElement.value + '"' : inputElement.value);
            setDefaultButton.innerHTML = '<i class="fa-solid fa-minus"></i>' + translate("app.options.default.remove");
            setDefaultButton.onclick = onRemove;
            displaySuccess(translate("app.options.default.set.success", "%k", e.key, "%v", inputElement.value));
        }

        setDefaultButton.onclick = onSet;

        let onRemove = () => {
            defaultOptions.deleteDefault(e.key);
            setDefaultButton.innerHTML = '<i class="fa-solid fa-plus"></i>' + translate("app.options.default.set");
            setDefaultButton.onclick = onSet;
            displaySuccess(translate("app.options.default.remove.success", "%k", e.key));
        }

        if (defaultOptions.getDefault(e.key) == e.value) {
            setDefaultButton.innerHTML = '<i class="fa-solid fa-minus"></i>' + translate("app.options.default.remove");
            setDefaultButton.onclick = onRemove;
        }

        item.appendChild(setDefaultButton);

        if (e.key == "version") {
            setDefaultButton.remove();
            inputElement.style.gridColumn = "span 2";
            inputElement.style.opacity = ".5";
            inputElement.style.cursor = "not-allowed";
            inputElement.disabled = true;
        }

        if (e.key == "version" && Number(e.value) != instanceInfo.attempted_options_txt_version) {
            defaultOptions.setDefault(e.key, e.value);
        }

        optionList.appendChild(item);
    };
    if (!values.length) {
        let nofound = new NoResultsFound(translate("app.options.not_found"));
        nofound.element.style.background = "transparent";
        nofound.element.style.gridColumn = "span 3";
        optionList.appendChild(nofound.element);
    }
}
function setInstanceTabContentScreenshots(instanceInfo, element) {
    currentSubTab = "screenshots";
    element.innerHTML = "";
    let galleryElement = document.createElement("div");
    galleryElement.className = "gallery";
    element.appendChild(galleryElement);
    let screenshots = window.electronAPI.getScreenshots(instanceInfo.instance_id).reverse();
    screenshots.forEach(e => {
        let screenshotElement = document.createElement("button");
        screenshotElement.className = "gallery-screenshot";
        screenshotElement.setAttribute("data-title", formatDateAndTime(e.file_name));
        screenshotElement.style.backgroundImage = `url("${e.file_path}")`;
        let screenshotInformation = screenshots.map(e => ({ "name": formatDateAndTime(e.file_name), "file": e.file_path }));
        screenshotElement.onclick = () => {
            displayScreenshot(formatDateAndTime(e.file_name), null, e.file_path, instanceInfo, element, screenshotInformation, screenshotInformation.map(e => e.file).indexOf(e.file_path));
        }
        let buttons = new ContextMenuButtons([
            {
                "icon": '<i class="fa-solid fa-folder"></i>',
                "title": translate("app.screenshots.open_in_folder"),
                "func": (e) => {
                    window.electronAPI.openFolder(processRelativePath(`./minecraft/instances/${instanceInfo.instance_id}/screenshots`));
                }
            },
            {
                "icon": '<i class="fa-solid fa-image"></i>',
                "title": translate("app.screenshots.open_photo"),
                "func": () => {
                    window.electronAPI.openFolder(e.file_path);
                }
            },
            {
                "icon": '<i class="fa-solid fa-copy"></i>',
                "title": translate("app.screenshots.copy"),
                "func": async () => {
                    let success = await window.electronAPI.copyImageToClipboard(e.file_path);
                    if (success) {
                        displaySuccess(translate("app.screenshots.copy.success"));
                    } else {
                        displayError(translate("app.screenshots.copy.fail"));
                    }
                }
            },
            {
                "icon": '<i class="fa-solid fa-share"></i>',
                "title": translate("app.screenshots.share"),
                "func": () => {
                    openShareDialogForFile(e.file_path);
                }
            },
            {
                "icon": '<i class="fa-solid fa-trash-can"></i>',
                "title": translate("app.screenshots.delete"),
                "func": () => {
                    let success = window.electronAPI.deleteScreenshot(e.file_path);
                    if (success) {
                        displaySuccess(translate("app.screenshots.delete.success"));
                    } else {
                        displayError(translate("app.screenshots.delete.fail"));
                    }
                    setInstanceTabContentScreenshots(instanceInfo, element);
                },
                "danger": true
            }
        ]);
        screenshotElement.oncontextmenu = (e) => {
            contextmenu.showContextMenu(buttons, e.clientX, e.clientY);
        }
        galleryElement.appendChild(screenshotElement);
    });
    if (!screenshots.length) {
        let nofound = new NoResultsFound(translate("app.screenshots.not_found"));
        nofound.element.style.gridColumn = "1 / -1";
        galleryElement.appendChild(nofound.element);
    }
}

function displayScreenshot(name, desc, file, instanceInfo, element, list, currentIndex, word = translate("app.screenshot")) {
    let index = currentIndex;
    let buttonLeft = document.createElement("button");
    buttonLeft.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
    buttonLeft.className = "screenshot-arrow";
    let changeDisplay = (name, file, desc) => {
        screenshotDisplayW.innerHTML = '';
        let spinner = document.createElement("div");
        spinner.className = "loading-container-spinner";
        let error = document.createElement("div");
        error.className = "loading-container-error";
        error.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        error.style.display = "none";
        screenshotDisplayW.appendChild(spinner);
        screenshotDisplayW.appendChild(error);
        screenshotAction2.onclick = () => {
            window.electronAPI.openFolder(file);
        };
        screenshotAction3.onclick = async () => {
            let success = await window.electronAPI.copyImageToClipboard(file);
            if (success) {
                displaySuccess(translate("app.screenshots.custom.copy.success", "%w", word));
            } else {
                displayError(translate("app.screenshots.copy.fail"));
            }
        };
        screenshotAction4.onclick = () => {
            if (file.includes("https://") || file.includes("http://")) {
                openShareDialog(word, file, translate("app.screenshots.share.text"))
            } else {
                openShareDialogForFile(file);
            }
        }
        if (instanceInfo) {
            screenshotAction5.onclick = () => {
                let success = window.electronAPI.deleteScreenshot(file);
                if (success) {
                    screenshotPreview.close();
                    displaySuccess(translate("app.screenshots.custom.delete.success", "%w", word));
                } else {
                    displayError(translate("app.screenshots.custom.delete.fail", "%w", word));
                }
                setInstanceTabContentScreenshots(instanceInfo, element);
            };
        }
        let screenshotDisplay = document.createElement("img");
        screenshotDisplay.className = "screenshot-display";
        screenshotDisplay.style.display = "none";
        screenshotDisplay.onload = () => {
            spinner.style.display = "none";
            screenshotDisplay.style.display = "";
        };
        screenshotDisplay.onerror = () => {
            spinner.style.display = "none";
            screenshotDisplay.style.display = "none";
            error.style.display = "";
            screenshotTitle.innerHTML = translate("app.screenshots.failed");
        };
        screenshotDisplayW.appendChild(screenshotDisplay);
        screenshotTitle.innerHTML = sanitize(name);
        screenshotDesc.innerHTML = sanitize(desc);
        screenshotDisplay.src = file;
        screenshotDisplay.alt = sanitize(name);
    }
    let shiftLeft = () => {
        index--;
        if (index < 0) index = list.length - 1;
        changeDisplay(list[index].name, list[index].file, list[index].desc);
    }
    let shiftRight = () => {
        index++;
        if (index > list.length - 1) index = 0;
        changeDisplay(list[index].name, list[index].file, list[index].desc);
    }
    buttonLeft.onclick = shiftLeft;
    let buttonRight = document.createElement("button");
    buttonRight.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
    buttonRight.className = "screenshot-arrow";
    buttonRight.onclick = shiftRight;
    screenshotPreview.onkeydown = (e) => {
        if (e.key == "ArrowRight") {
            shiftRight();
        } else if (e.key == "ArrowLeft") {
            shiftLeft();
        }
    }
    let screenshotDisplayW = document.createElement("div");
    screenshotDisplayW.className = "screenshot-display-wrapper";
    let screenshotInfo = document.createElement("div");
    screenshotInfo.className = "screenshot-info";
    let screenshotX = document.createElement("button");
    screenshotX.className = "dialog-x";
    screenshotX.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    screenshotX.onclick = () => {
        screenshotPreview.close();
    }
    screenshotInfo.appendChild(screenshotX);
    let screenshotTitle = document.createElement("div");
    screenshotTitle.className = "screenshot-title";
    screenshotInfo.appendChild(screenshotTitle);
    let screenshotDesc = document.createElement("div");
    screenshotDesc.className = "screenshot-desc";
    screenshotInfo.appendChild(screenshotDesc);
    let screenshotActions = document.createElement("div");
    screenshotActions.className = "screenshot-actions";
    screenshotInfo.appendChild(screenshotActions);
    let screenshotWrapper = document.createElement("div");
    screenshotWrapper.className = "screenshot-wrapper";
    screenshotPreview.innerHTML = '';
    let screenshotAction1 = document.createElement("button");
    screenshotAction1.className = "screenshot-action";
    screenshotAction1.innerHTML = '<i class="fa-solid fa-folder"></i>' + translate("app.screenshots.open_in_folder");
    screenshotAction1.onclick = () => {
        window.electronAPI.openFolder(processRelativePath(`./minecraft/instances/${instanceInfo.instance_id}/screenshots`));
    };
    if (instanceInfo) {
        screenshotActions.appendChild(screenshotAction1);
    }
    let screenshotAction2 = document.createElement("button");
    screenshotAction2.className = "screenshot-action";
    screenshotAction2.innerHTML = '<i class="fa-solid fa-image"></i>' + translate("app.screenshots.open_photo");
    if (instanceInfo) {
        screenshotActions.appendChild(screenshotAction2);
    }
    let screenshotAction3 = document.createElement("button");
    screenshotAction3.className = "screenshot-action";
    screenshotAction3.innerHTML = '<i class="fa-solid fa-copy"></i>' + translate("app.screenshots.custom.copy", "%w", word);
    screenshotActions.appendChild(screenshotAction3);
    let screenshotAction4 = document.createElement("button");
    screenshotAction4.className = "screenshot-action";
    screenshotAction4.innerHTML = '<i class="fa-solid fa-share"></i>' + translate("app.screenshots.custom.share", "%w", word);
    screenshotActions.appendChild(screenshotAction4);
    let screenshotAction5 = document.createElement("button");
    screenshotAction5.className = "screenshot-action";
    screenshotAction5.innerHTML = '<i class="fa-solid fa-trash-can"></i>' + translate("app.screenshots.custom.delete", "%w", word);
    if (instanceInfo) {
        screenshotActions.appendChild(screenshotAction5);
    }
    screenshotWrapper.appendChild(buttonLeft);
    screenshotWrapper.appendChild(screenshotDisplayW);
    screenshotWrapper.appendChild(buttonRight);
    screenshotWrapper.appendChild(screenshotInfo);
    screenshotPreview.appendChild(screenshotWrapper);
    changeDisplay(name, file, desc);
    screenshotPreview.showModal();
    document.getElementsByClassName("toasts")[0].hidePopover();
    document.getElementsByClassName("toasts")[0].showPopover();
}

let hideToast = (e) => {
    e.classList.remove("shown");
    setTimeout(() => {
        e.remove();
    }, 1000);
}

function displayError(error) {
    let element = document.createElement("div");
    element.classList.add("error");
    element.innerHTML = (error.toString());
    let toasts = document.getElementsByClassName("toasts")[0];
    toasts.appendChild(element);
    element.classList.add("shown");
    element.onclick = () => {
        hideToast(element);
    }
    setTimeout(() => { hideToast(element) }, 3000);
}

function displaySuccess(success) {
    let element = document.createElement("div");
    element.classList.add("success");
    element.innerHTML = success.toString();
    let toasts = document.getElementsByClassName("toasts")[0];
    toasts.appendChild(element);
    element.classList.add("shown");
    element.onclick = () => {
        hideToast(element);
    }
    setTimeout(() => { hideToast(element) }, 3000);
}

async function playInstance(instInfo, quickPlay = null) {
    instInfo = new Instance(instInfo.instance_id);
    instInfo.setLastPlayed(new Date());
    let pid;
    try {
        pid = await window.electronAPI.playMinecraft(instInfo.loader, instInfo.vanilla_version, instInfo.loader_version, instInfo.instance_id, data.getDefaultProfile(), quickPlay, { "width": instInfo.window_width ? instInfo.window_width : 854, "height": instInfo.window_height ? instInfo.window_height : 480 }, instInfo.allocated_ram ? instInfo.allocated_ram : 4096, instInfo.java_path, instInfo.java_args ? instInfo.java_args : null, instInfo.env_vars, instInfo.pre_launch_hook, instInfo.wrapper, instInfo.post_exit_hook);
        if (!pid) return;
        console.log(pid);
        console.log(pid.minecraft.pid);
        console.log(window.electronAPI.checkForProcess(pid.minecraft.pid));
        instInfo.setPid(pid.minecraft.pid);
        instInfo.setCurrentLogFile(pid.minecraft.log);
        let default_player = data.getDefaultProfile();
        default_player.setAccessToken(pid.player_info.access_token);
        default_player.setClientId(pid.player_info.client_id);
        default_player.setExpires(pid.player_info.expires);
        default_player.setName(pid.player_info.name);
        default_player.setRefreshToken(pid.player_info.refresh_token);
        default_player.setUuid(pid.player_info.uuid);
        default_player.setXuid(pid.player_info.xuid);
        default_player.setIsDemo(pid.player_info.is_demo);
        await updateSkinsAndCapes(pid.player_info);
        await live.findLive();
    } catch (e) {
        console.log(e);
        displayError(e);
    }
}

async function playSingleplayerWorld(instInfo, world_id) {
    await playInstance(instInfo, { "type": "singleplayer", "info": world_id });
}
async function playMultiplayerWorld(instInfo, world_id) {
    await playInstance(instInfo, { "type": "multiplayer", "info": world_id });
}

async function stopInstance(instInfo) {
    return await window.electronAPI.killProcess(instInfo.refresh().pid);
}

function formatTime(secs) {
    let hours = Math.floor(secs / 3600);
    secs = secs % 3600;
    let minutes = Math.floor(secs / 60);
    secs = secs % 60;
    let seconds = secs;
    let hoursString = translate("app.duration.hours").replace("%s", hours);
    let minutesString = translate("app.duration.minutes").replace("%s", minutes);
    let secondsString = translate("app.duration.seconds").replace("%s", seconds);
    return translate("app.duration").replace("%h", hoursString).replace("%m", minutesString).replace("%s", secondsString);
}

function formatDate(dateString, year_to_show_never_played_before) {
    let months = [translate("app.date.jan"), translate("app.date.feb"), translate("app.date.mar"), translate("app.date.apr"), translate("app.date.may"), translate("app.date.jun"), translate("app.date.jul"), translate("app.date.aug"), translate("app.date.sep"), translate("app.date.oct"), translate("app.date.nov"), translate("app.date.dec")];
    let date = new Date(dateString);
    if (isNaN(date.getTime()) || (year_to_show_never_played_before && date.getFullYear() < year_to_show_never_played_before)) {
        return translate("app.worlds.description.never_played");
    }
    return translate("app.date").replace("%m", months[date.getMonth()]).replace("%d", date.getDate()).replace("%y", date.getFullYear());
}

function formatDateAndTime(dateString) {
    let date = new Date(dateString);
    if (isNaN(date.getTime())) {
        return dateString;
    }
    let minutes = date.getMinutes().toString();
    if (minutes.length == 1) minutes = "0" + minutes;
    let seconds = date.getSeconds().toString();
    if (seconds.length == 1) seconds = "0" + seconds;
    let amorpm = "am";
    if (date.getHours() >= 12) {
        amorpm = "pm";
    }
    let hours = date.getHours();
    hours %= 12;
    if (hours == 0) hours = 12;

    return translate("app.date_time").replace("%date", formatDate(dateString)).replace("%h", hours).replace("%m", minutes).replace("%s", seconds).replace("%amorpm", amorpm);
}

function getLangFile(locale) {
    let isDev = window.electronAPI.isDev;
    if (!isDev) {
        return JSON.parse(window.electronAPI.readFile(window.electronAPI.resourcePath, 'app.asar', 'resources', 'lang', `${locale}.json`));
    } else {
        return JSON.parse(window.electronAPI.readFile(`./resources/lang/${locale}.json`));
    }
}

function checkForProcess(pid) {
    return window.electronAPI.checkForProcess(pid);
}

function getInstanceWorlds(instanceInfo) {
    return window.electronAPI.getSinglePlayerWorlds(instanceInfo.instance_id);
}

async function getInstanceWorldsMulti(instanceInfo) {
    return await window.electronAPI.getMultiplayerWorlds(instanceInfo.instance_id);
}

function getInstanceContent(instanceInfo) {
    return window.electronAPI.getInstanceContent(instanceInfo.loader, instanceInfo.instance_id, instanceInfo.getContent());
}

function translate(key, ...params) {
    if (!lang) {
        lang = getLangFile("en-us");
    }
    let value = lang[key];
    for (let i = 0; i < params.length; i += 2) {
        value = value.replace(params[i], params[i + 1]);
    }
    return value;
}

let accountSwitcher = new MinecraftAccountSwitcher(playerSwitch, data.getProfiles());

const colorCodes = {
    '0': 'mc-black',
    '1': 'mc-dark_blue',
    '2': 'mc-dark_green',
    '3': 'mc-dark_aqua',
    '4': 'mc-dark_red',
    '5': 'mc-dark_purple',
    '6': 'mc-gold',
    '7': 'mc-gray',
    '8': 'mc-dark_gray',
    '9': 'mc-blue',
    'a': 'mc-green',
    'b': 'mc-aqua',
    'c': 'mc-red',
    'd': 'mc-light_purple',
    'e': 'mc-yellow',
    'f': 'mc-white',
};

const formatCodes = {
    'l': 'mc-bold',
    'm': 'mc-strikethrough',
    'n': 'mc-underline',
    'o': 'mc-italic',
    'k': 'mc-obfuscated',
};

function parseMinecraftFormatting(text) {
    let result = '';
    let currentClasses = [];
    let i = 0;
    let buffer = '';
    let lastClasses = [];

    function flushBuffer() {
        if (buffer.length > 0) {
            if (lastClasses.length > 0) {
                result += `<span class="${lastClasses.join(' ')}">${buffer}</span>`;
            } else {
                result += buffer;
            }
            buffer = '';
        }
    }

    while (i < text.length) {
        if (text[i] === '§' && i + 1 < text.length) {
            flushBuffer();
            const code = text[i + 1].toLowerCase();
            i += 2;

            if (colorCodes[code]) {
                lastClasses = [colorCodes[code]];
            } else if (formatCodes[code]) {
                // Avoid duplicate format codes
                if (!lastClasses.includes(formatCodes[code])) {
                    lastClasses = lastClasses.concat(formatCodes[code]);
                }
            } else if (code === 'r') {
                lastClasses = [];
            }
            continue;
        }

        buffer += text[i];
        i++;
    }
    flushBuffer();

    return result;
}

let live = new LiveMinecraft(liveMinecraft);
live.findLive();

class DownloadLogEntry {
    constructor(startingTitle, startingDescription, startingProgress) {
        let element = document.createElement("div");
        element.className = "download-item";
        let title = document.createElement("div");
        let progress = document.createElement("div");
        let desc = document.createElement("div");
        title.className = "download-title";
        progress.className = "download-progress";
        desc.className = "download-desc";
        progress.style.setProperty("--percent", startingProgress + "%");
        title.innerHTML = sanitize(startingTitle);
        desc.innerHTML = sanitize(startingDescription);
        element.appendChild(title);
        element.appendChild(progress);
        element.appendChild(desc);
        this.titleEle = title;
        this.descEle = desc;
        this.progressEle = progress;
        this.ele = element;
        this.title = startingTitle;
        this.progress = startingProgress;
    }

    get getTitle() {
        return this.title;
    }

    get getProgress() {
        return this.progress;
    }

    setDesc(desc) {
        this.descEle.innerHTML = sanitize(desc);
    }

    setProgress(progress) {
        this.progressEle.style.setProperty("--percent", progress + "%");
        this.progress = progress;
    }

    remove() {
        this.ele.remove();
    }
}

class DownloadLog {
    constructor(element) {
        element.className = "download-log";
        this.logs = [];
        let downloadLogToggle = document.createElement("button");
        downloadLogToggle.className = "download-log-toggle";
        downloadLogToggle.innerHTML = '<i class="fa-solid fa-bars-progress"></i>';
        downloadLogToggle.setAttribute("popovertarget", "download-log-wrapper");
        // let close = () => {
        //     downloadLogToggle.classList.remove("open");
        //     downloadLogToggle.onclick = open;
        //     logsWrapper.hidePopover();
        //     downloadLogToggle.setAttribute("title", "Hide Downloads");
        // }
        // let open = () => {
        //     downloadLogToggle.classList.add("open");
        //     downloadLogToggle.onclick = close;
        //     logsWrapper.showPopover();
        //     downloadLogToggle.setAttribute("title", "Show Downloads");
        // }
        // downloadLogToggle.onclick = open;
        element.appendChild(downloadLogToggle);
        let logsWrapper = document.createElement("div");
        logsWrapper.className = "download-log-wrapper";
        logsWrapper.id = "download-log-wrapper";
        logsWrapper.setAttribute("popover", "");
        element.appendChild(logsWrapper);
        this.element = logsWrapper;
        this.toggle = downloadLogToggle;
    }

    setData(info) {
        info: for (let i = 0; i < info.length; i++) {
            logs: for (let j = 0; j < this.logs.length; j++) {
                if (this.logs[j].getTitle == info[i].title) {
                    this.logs[j].setDesc(info[i].desc);
                    this.logs[j].setProgress(info[i].progress);
                    continue info;
                }
            }
            let log = new DownloadLogEntry(info[i].title, info[i].desc, info[i].progress);
            this.logs.push(log);
            this.element.appendChild(log.ele);
        }

        this.logs.forEach((e) => {
            if (e.getProgress == 100) {
                e.remove();
            }
        })
        this.logs = this.logs.filter((e) => e.getProgress != 100);
        if (this.logs[0]) {
            this.toggle.style.setProperty("--percent-preview", this.logs[0].getProgress + "%");
        }
    }
}

let log = new DownloadLog(downloadLog);

window.electronAPI.onProgressUpdate((a, b, c) => {
    log.setData([
        {
            "title": a,
            "progress": b,
            "desc": c
        }
    ]);
});

window.electronAPI.onErrorMessage((message) => {
    displayError(message);
});

window.electronAPI.onLaunchInstance(async (launch_info) => {
    try {
        let instance = new Instance(launch_info.instance_id);
        showSpecificInstanceContent(instance, launch_info.world_type ? "worlds" : "content");
        if (launch_info.world_type == "singleplayer") {
            await playSingleplayerWorld(instance, launch_info.world_id);
        } else if (launch_info.world_type == "multiplayer") {
            await playMultiplayerWorld(instance, launch_info.world_id);
        } else {
            await playInstance(instance);
        }
        showSpecificInstanceContent(instance.refresh(), launch_info.world_type ? "worlds" : "content");
    } catch (e) {
        displayError(translate("app.launch_error"));
    }
});

class MultiSelect {
    constructor(element, list) {
        this.onchange = () => { };
        this.tabs = new TabContent(element, list.map(e => ({
            "name": e.name, "value": e.value, "func": () => {
                this.value = e.value;
                this.onchange();
            }
        })));
        this.value = list[0].value;
    }
    addOnChange(onchange) {
        this.onchange = onchange;
    }
    selectOption(opt) {
        this.tabs.selectOptionAdvanced(opt);
    }
}

let version_cache = {};

async function getVersions(loader, mcVersion) {
    if (loader == "fabric") {
        if (version_cache["fabric-" + mcVersion]) return version_cache["fabric-" + mcVersion];
        let v = await window.electronAPI.getFabricLoaderVersions(mcVersion);
        version_cache["fabric-" + mcVersion] = v;
        return v;
    } else if (loader == "forge") {
        if (version_cache["forge-" + mcVersion]) return version_cache["forge-" + mcVersion];
        let v = await window.electronAPI.getForgeLoaderVersions(mcVersion);
        version_cache["forge-" + mcVersion] = v;
        return v;
    } else if (loader == "neoforge") {
        if (version_cache["neoforge-" + mcVersion]) return version_cache["neoforge-" + mcVersion];
        let v = await window.electronAPI.getNeoForgeLoaderVersions(mcVersion);
        version_cache["neoforge-" + mcVersion] = v;
        return v;
    } else if (loader == "quilt") {
        if (version_cache["quilt-" + mcVersion]) return version_cache["quilt-" + mcVersion];
        let v = await window.electronAPI.getQuiltLoaderVersions(mcVersion);
        version_cache["quilt-" + mcVersion] = v;
        return v;
    } else {
        throw new Error(translate("app.unknown_loader"));
    }
}

class VersionList {
    constructor() { }
    static async getVersions(loader) {
        if (loader == "vanilla") {
            if (version_cache["vanilla"]) return version_cache["vanilla"];
            let v = await window.electronAPI.getVanillaVersions();
            version_cache["vanilla"] = v;
            return v;
        } else if (loader == "fabric") {
            if (version_cache["fabric"]) return version_cache["fabric"];
            let v = await window.electronAPI.getFabricVersions();
            version_cache["fabric"] = v;
            return v;
        } else if (loader == "forge") {
            if (version_cache["forge"]) return version_cache["forge"];
            let v = await window.electronAPI.getForgeVersions();
            version_cache["forge"] = v;
            return v;
        } else if (loader == "neoforge") {
            if (version_cache["neoforge"]) return version_cache["neoforge"];
            let v = await window.electronAPI.getNeoForgeVersions();
            version_cache["neoforge"] = v;
            return v;
        } else if (loader == "quilt") {
            if (version_cache["quilt"]) return version_cache["quilt"];
            let v = await window.electronAPI.getQuiltVersions();
            version_cache["quilt"] = v;
            return v;
        }
    }
    static getLatestRelease() {
        return data.getDefault("latest_release");
    }
}

class ImageUpload {
    constructor(element, defaultImage) {
        element.className = "image-upload-wrapper";
        let preview = document.createElement("img");
        preview.className = "image-preview";
        preview.src = defaultImage ? defaultImage : "default.png"
        this.previewElement = preview;
        element.appendChild(preview);
        let containButtons = document.createElement("div");
        containButtons.className = "image-upload-buttons";
        let uploadButton = document.createElement("button");
        let removeButton = document.createElement("button");
        uploadButton.className = "image-upload-button";
        removeButton.className = "image-upload-button";
        uploadButton.innerHTML = '<i class="fa-solid fa-arrow-up-from-bracket"></i>' + translate("app.dialog.upload_image");
        removeButton.innerHTML = '<i class="fa-solid fa-trash-can"></i>' + translate("app.dialog.remove_image")
        containButtons.appendChild(uploadButton);
        containButtons.appendChild(removeButton);
        element.appendChild(containButtons);
        this.value = defaultImage ? defaultImage : "";
        uploadButton.onclick = () => {
            let temp = document.createElement("input");
            temp.setAttribute("type", "file");
            temp.setAttribute("accept", "image/*");
            temp.click();
            temp.onchange = () => {
                if (temp.files.length <= 0) return;
                let selectedFile = temp.files[0];
                const reader = new FileReader();
                reader.readAsDataURL(selectedFile);
                reader.onload = (e) => {
                    const img = new Image();
                    img.onload = () => {
                        let maxWidth = 96;
                        let maxHeight = 96;
                        let width = img.width;
                        let height = img.height;
                        if (width > maxWidth || height > maxHeight) {
                            const widthRatio = maxWidth / width;
                            const heightRatio = maxHeight / height;
                            const ratio = Math.min(widthRatio, heightRatio);
                            width = Math.round(width * ratio);
                            height = Math.round(height * ratio);
                        }
                        const canvas = document.createElement('canvas');
                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(img, 0, 0, width, height);
                        const dataUrl = canvas.toDataURL('image/png');
                        this.value = dataUrl;
                        this.previewElement.src = dataUrl;
                    };
                    img.src = e.target.result;
                };
            }
        }
        removeButton.onclick = () => {
            this.value = "";
            this.previewElement.src = "default.png";
        }
    }
}

class MultipleFileSelect {
    constructor(element, options) {
        element.className = "multiple-file-select-wrapper";
        this.selected = new Set();
        this.expanded = new Set();
        this.value = [];

        const itemList = document.createElement("div");
        itemList.className = "multiple-file-select";
        this.itemList = itemList;
        element.appendChild(itemList);

        this.tree = this.buildTree(options);
        this.renderTree(this.tree, this.itemList);
    }

    getValue() {
        return Array.from(this.selected);
    }

    setSelected(selected) {
        this.selected = new Set();
        selected.forEach(e => {
            let node = this.getNode(e);
            if (!node) return;
            this.selectAll(e, node);
        });
        this.updateCheckboxStates();
    }

    /** Build a hierarchical tree object */
    buildTree(paths) {
        const root = {};
        for (const path of paths) {
            const parts = path.split("//");
            let node = root;
            for (let i = 0; i < parts.length; i++) {
                const part = parts[i];
                if (!node[part]) {
                    node[part] = { children: {}, isFile: i === parts.length - 1 };
                }
                node = node[part].children;
            }
        }
        return root;
    }

    /** Recursive render — only called once */
    renderTree(node, container, parentPath = "") {
        for (const key of Object.keys(node)) {
            const fullPath = parentPath ? parentPath + "//" + key : key;
            const isFile = node[key].isFile;
            const children = node[key].children;

            const item = document.createElement("div");
            item.className = "multiple-file-select-item";
            item.dataset.path = fullPath;

            // Chevron
            let chevron = null;
            if (Object.keys(children).length) {
                chevron = document.createElement("button");
                chevron.className = "multiple-file-select-chevron";
                chevron.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
                chevron.style.cursor = "pointer";
                chevron.onclick = (e) => {
                    e.stopPropagation();
                    this.toggleExpand(fullPath, childContainer, chevron);
                };
                chevron.onkeydown = (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        chevron.click();
                    }
                };
                item.appendChild(chevron);
            } else {
                const spacer = document.createElement("span");
                spacer.style.display = "inline-block";
                spacer.style.width = "20px";
                item.appendChild(spacer);
            }

            // Checkbox
            const checkbox = document.createElement("input");
            checkbox.type = "checkbox";
            checkbox.className = "multiple-file-select-checkbox";
            checkbox.dataset.path = fullPath;
            checkbox.onchange = (e) => {
                e.stopPropagation();
                if (checkbox.checked) this.selectAll(fullPath, node[key]);
                else this.deselectAll(fullPath, node[key]);
                this.updateCheckboxStates();
            };
            checkbox.onkeydown = (e) => {
                if (e.key === " " || e.key === "Enter") {
                    e.preventDefault();
                    checkbox.checked = !checkbox.checked;
                    checkbox.dispatchEvent(new Event("change"));
                }
            };
            item.appendChild(checkbox);

            // Label
            const label = document.createElement("span");
            label.className = isFile
                ? "multiple-file-select-title file"
                : "multiple-file-select-title folder";
            label.innerHTML = key;
            item.appendChild(label);

            container.appendChild(item);

            // Child container
            const childContainer = document.createElement("div");
            if (this.expanded.has(fullPath)) {
                childContainer.classList.add("shown");
            } else {
                childContainer.classList.remove("shown");
            }
            childContainer.style.paddingLeft = "20px";
            childContainer.className = "multiple-file-select-child-container";
            container.appendChild(childContainer);

            if (Object.keys(children).length) {
                this.renderTree(children, childContainer, fullPath);
            }
        }
    }

    toggleExpand(path, childContainer, chevron) {
        if (this.expanded.has(path)) {
            this.expanded.delete(path);
            childContainer.classList.remove("shown");
            chevron.style.rotate = "0deg";
        } else {
            this.expanded.add(path);
            childContainer.classList.add("shown");
            chevron.style.rotate = "90deg";
        }
    }

    selectAll(path, node) {
        this.selected.add(path);
        for (const key of Object.keys(node.children)) {
            this.selectAll(path + "//" + key, node.children[key]);
        }
    }

    deselectAll(path, node) {
        this.selected.delete(path);
        for (const key of Object.keys(node.children)) {
            this.deselectAll(path + "//" + key, node.children[key]);
        }
    }

    /** Efficiently update checkboxes and indeterminate states */
    updateCheckboxStates() {
        const allCheckboxes = this.itemList.querySelectorAll(".multiple-file-select-checkbox");
        for (const checkbox of allCheckboxes) {
            const path = checkbox.dataset.path;
            const node = this.getNode(path);
            const { checked, indeterminate } = this.getNodeSelectionState(path, node);
            checkbox.checked = checked;
            checkbox.indeterminate = indeterminate;
        }
        // Only include files in this.value
        this.value = Array.from(this.selected).filter(path => {
            const node = this.getNode(path);
            return node && node.isFile;
        });
    }

    /** Find a node by path */
    getNode(path) {
        const parts = path.split("//");
        let node = { children: this.tree };
        for (const part of parts) {
            if (!node.children) return null;
            if (!node.children[part]) return null;
            node = node.children[part];
        }
        return node;
    }

    /** Compute selection state recursively */
    getNodeSelectionState(path, node) {
        if (!node || !Object.keys(node.children).length) {
            return {
                checked: this.selected.has(path),
                indeterminate: false
            };
        }

        let checkedCount = 0;
        let indeterminateCount = 0;
        let childCount = 0;
        for (const key of Object.keys(node.children)) {
            const childPath = path + "//" + key;
            const childNode = node.children[key];
            const { checked, indeterminate } = this.getNodeSelectionState(childPath, childNode);
            if (checked) checkedCount++;
            if (indeterminate) indeterminateCount++;
            childCount++;
        }

        const fullyChecked = checkedCount === childCount;
        const noneChecked = checkedCount === 0 && indeterminateCount === 0;
        const partiallyChecked = !fullyChecked && !noneChecked;

        return {
            checked: fullyChecked,
            indeterminate: partiallyChecked,
        };
    }
}


class MultipleSelect {
    constructor(element, options) {
        element.className = "multiple-select-wrapper";
        let topElement = document.createElement("div");
        topElement.className = "multiple-select-top";
        let topCheckbox = document.createElement("input");
        topCheckbox.className = "multiple-select-checkbox";
        topCheckbox.type = "checkbox";
        topCheckbox.onchange = (e) => {
            if (topCheckbox.checked) {
                this.checkCheckboxes();
            } else {
                this.uncheckCheckboxes();
            }
        }
        this.checkBox = topCheckbox;
        let topSearch = document.createElement("div");
        let searchBar = new SearchBar(topSearch, (v) => {
            this.items.forEach(e => {
                if (e.value.toLowerCase().includes(v.toLowerCase().trim())) {
                    e.element.style.display = "grid";
                } else {
                    e.element.style.display = "none";
                }
            });
            this.figureOutMainCheckedState();
        }, () => { });
        topElement.appendChild(topCheckbox);
        topElement.appendChild(topSearch);
        element.appendChild(topElement);

        let itemList = document.createElement("div");
        itemList.className = "multiple-select";
        element.appendChild(itemList);

        this.itemList = itemList;

        this.setOptions(options);
    }
    get value() {
        let vals = [];
        this.items.forEach(e => {
            if (e.checkbox.checked) {
                vals.push(e.val);
            }
        });
        return vals;
    }
    setSelected(selected) {
        this.items.forEach(e => {
            if (selected.includes(e.val)) {
                e.checkbox.checked = true;
            } else {
                e.checkbox.checked = false;
            }
            this.figureOutMainCheckedState();
        });
    }
    setOptions(options) {
        console.log(options);
        this.itemList.innerHTML = "";
        this.checkBoxes = [];
        this.items = [];

        options.forEach(e => {
            let itemElement = document.createElement("div");
            itemElement.className = "multiple-select-item";
            this.itemList.appendChild(itemElement);
            let itemCheckbox = document.createElement("input");
            itemCheckbox.className = "multiple-select-checkbox";
            itemCheckbox.type = "checkbox";
            itemCheckbox.onchange = () => {
                this.figureOutMainCheckedState();
            }
            this.items.push({ "element": itemElement, "value": e.name, "checkbox": itemCheckbox, "val": e.value });
            itemElement.appendChild(itemCheckbox);
            let itemTitle = document.createElement("div");
            itemTitle.innerHTML = e.name;
            itemTitle.className = "multiple-select-title";
            itemElement.appendChild(itemTitle);
            this.checkBoxes.push(itemCheckbox);
        });
    }
    figureOutMainCheckedState() {
        let total = 0;
        let checked = 0;
        for (let i = 0; i < this.checkBoxes.length; i++) {
            if (this.checkBoxes[i].checked && isNotDisplayNone(this.checkBoxes[i])) {
                checked++;
            }
            if (isNotDisplayNone(this.checkBoxes[i])) {
                total++;
            }
        }
        if (total == checked && total != 0) {
            this.checkBox.checked = true;
            this.checkBox.indeterminate = false;
        } else if (checked > 0) {
            this.checkBox.checked = false;
            this.checkBox.indeterminate = true;
        } else {
            this.checkBox.checked = false;
            this.checkBox.indeterminate = false;
        }
    }
    checkCheckboxes() {
        this.checkBoxes.forEach((e) => {
            if (isNotDisplayNone(e)) e.checked = true;
        });
    }
    uncheckCheckboxes() {
        this.checkBoxes.forEach((e) => {
            if (isNotDisplayNone(e)) e.checked = false;
        });
    }
}

class Dialog {
    constructor() { }
    closeDialog() {
        this.element.close();
    }
    showDialog(title, type, info, buttons, tabs, onsubmit, onclose) {
        let element = document.createElement("dialog");
        element.className = "dialog";
        element.oncancel = (e) => {
            if (onclose) onclose();
            setTimeout(() => {
                this.element.remove();
            }, 1000);
        }
        this.element = element;
        let dialogTop = document.createElement("div");
        dialogTop.className = "dialog-top";
        let dialogTitle = document.createElement("div");
        dialogTitle.className = "dialog-title";
        dialogTitle.innerHTML = (title);
        let dialogX = document.createElement("button");
        dialogX.className = "dialog-x";
        dialogX.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        dialogX.onclick = (e) => {
            this.element.close();
            if (onclose) onclose();
            setTimeout(() => {
                this.element.remove();
            }, 1000);
        }
        dialogTop.appendChild(dialogTitle);
        dialogTop.appendChild(dialogX);
        element.appendChild(dialogTop);
        let realDialogContent = document.createElement("div");
        realDialogContent.className = "dialog-content";
        let contents = {};
        element.appendChild(realDialogContent);
        document.body.appendChild(element);
        element.showModal();
        let tabElement = document.createElement("div");
        this.values = [];
        let selectedTab = tabs ? tabs[0]?.value ?? "" : "";
        if (tabs && tabs.length) {
            realDialogContent.appendChild(tabElement);
            new TabContent(tabElement, tabs.map(e => ({
                "name": e.name, "value": e.value, "func": (v) => {
                    let keys = Object.keys(contents);
                    keys.forEach(e => {
                        contents[e].style.display = "none";
                    });
                    contents[v].style.display = "grid";
                    selectedTab = v;
                }
            })))
        }
        if (tabs && tabs.length) {
            for (let i = 0; i < tabs.length; i++) {
                let dialogContent = document.createElement("div");
                dialogContent.className = "dialog-content-inner";
                contents[tabs[i].value] = dialogContent;
                realDialogContent.appendChild(dialogContent);
                // dialogContent.style.display = "none";
            }
        } else {
            let dialogContent = document.createElement("div");
            dialogContent.className = "dialog-content-inner";
            contents["default"] = dialogContent;
            realDialogContent.appendChild(dialogContent);
        }
        if (selectedTab) contents[selectedTab].style.display = "grid";
        if (type == "notice") {
            if (info instanceof Element) {
                realDialogContent.innerHTML = '';
                realDialogContent.appendChild(info);
            } else {
                realDialogContent.innerHTML = "<span>" + (info) + "</span>";
            }
        } else if (type == "form") {
            for (let i = 0; i < info.length; i++) {
                let tab = info[i].tab ?? "default";
                if (info[i].type == "notice") {
                    let textElement = document.createElement("div");
                    if (info[i].content instanceof Element) {
                        textElement.appendChild(info[i].content);
                    } else {
                        textElement.innerHTML = (info[i].content);
                    }
                    if (info[i].width) textElement.style.width = info[i].width + "px";
                    contents[tab].appendChild(textElement);
                } else if (info[i].type == "text") {
                    let id = createId();
                    let label = document.createElement("label");
                    label.innerHTML = sanitize(info[i].name);
                    label.className = "dialog-label";
                    label.setAttribute("for", id);
                    let labelDesc = document.createElement("label");
                    if (info[i].desc) {
                        labelDesc.innerHTML = info[i].desc;
                        labelDesc.className = "dialog-label-desc";
                        labelDesc.setAttribute("for", id);
                    }
                    let textInput = document.createElement("input");
                    textInput.type = "text";
                    textInput.className = "dialog-text-input";
                    textInput.setAttribute("placeholder", info[i].name);
                    textInput.id = id;
                    textInput.addOnChange = (onchange) => {
                        textInput.onchange = () => {
                            onchange(textInput.value);
                        }
                    }
                    if (info[i].onchange) textInput.onchange = () => {
                        info[i].onchange(textInput.value);
                    }
                    if (info[i].maxlength) textInput.maxLength = info[i].maxlength;
                    if (info[i].default) textInput.value = info[i].maxlength ? info[i].default.substring(0, info[i].maxlength) : info[i].default;
                    let wrapper = document.createElement("div");
                    wrapper.className = "dialog-text-label-wrapper";
                    contents[tab].appendChild(wrapper);
                    wrapper.appendChild(label);
                    if (info[i].desc) wrapper.appendChild(labelDesc);
                    wrapper.appendChild(textInput);
                    if (info[i].buttons) {
                        let buttonWrapper = document.createElement("div");
                        buttonWrapper.className = 'sub-button-container';
                        for (let j = 0; j < info[i].buttons.length; j++) {
                            let buttonEle = document.createElement("button");
                            buttonEle.innerHTML = info[i].buttons[j].icon + info[i].buttons[j].name
                            buttonEle.className = "sub-button";
                            let buttonClick = async () => {
                                buttonEle.onclick = () => { }
                                await info[i].buttons[j].func(textInput.value, buttonEle, textInput);
                                buttonEle.onclick = buttonClick;
                            }
                            buttonEle.onclick = buttonClick;
                            buttonWrapper.appendChild(buttonEle);
                        }
                        wrapper.appendChild(buttonWrapper);
                    }
                    if (info[i].source) {
                        for (let j = 0; j < this.values.length; j++) {
                            if (this.values[j].id != info[i].input_source) continue;
                            // Use a token to ensure only the latest async result is displayed
                            let updateToken = 0;
                            this.values[j].element.addOnChange(async () => {
                                const currentToken = ++updateToken;
                                let value = this.values[j].element.value;
                                if (info[i].hide?.includes(value)) {
                                    wrapper.style.display = "none";
                                } else {
                                    wrapper.style.display = "grid";
                                }
                                try {
                                    let list = await info[i].source(value);
                                    // Only update if this is the latest request
                                    if (currentToken !== updateToken) return;
                                    textInput.value = list;
                                    if (textInput.onchange) textInput.onchange();
                                } catch (err) {
                                    if (currentToken !== updateToken) return;
                                    displayError(translate("app.failed_to_load", "%m", (err && err.message ? err.message : err)));
                                    if (textInput.onchange) textInput.onchange();
                                    textInput.value = "";
                                }
                            });
                        }
                    }
                    this.values.push({ "id": info[i].id, "element": textInput });
                } else if (info[i].type == "number") {
                    let id = createId();
                    let label = document.createElement("label");
                    label.innerHTML = sanitize(info[i].name);
                    label.className = "dialog-label";
                    label.setAttribute("for", id);
                    let labelDesc = document.createElement("label");
                    if (info[i].desc) {
                        labelDesc.innerHTML = sanitize(info[i].desc);
                        labelDesc.className = "dialog-label-desc";
                        labelDesc.setAttribute("for", id);
                    }
                    let textInput = document.createElement("input");
                    textInput.type = "number";
                    textInput.className = "dialog-text-input";
                    textInput.setAttribute("placeholder", info[i].name);
                    textInput.id = id;
                    if (info[i].onchange) textInput.onchange = () => {
                        info[i].onchange(textInput.value);
                    }
                    if (info[i].default) textInput.value = info[i].default;
                    let wrapper = document.createElement("div");
                    wrapper.className = "dialog-text-label-wrapper";
                    contents[tab].appendChild(wrapper);
                    wrapper.appendChild(label);
                    if (info[i].desc) wrapper.appendChild(labelDesc);
                    wrapper.appendChild(textInput);
                    this.values.push({ "id": info[i].id, "element": textInput });
                } else if (info[i].type == "toggle") {
                    let labelWrapper = document.createElement("div");
                    labelWrapper.className = "label-wrapper";
                    let label = document.createElement("label");
                    label.innerHTML = sanitize(info[i].name);
                    label.className = "dialog-label";
                    let labelDesc = document.createElement("label");
                    labelDesc.innerHTML = sanitize(info[i].desc);
                    labelDesc.className = "dialog-label-desc";
                    let toggleEle = document.createElement("button");
                    let toggle = new Toggle(toggleEle, () => { }, info[i].default ?? false);
                    let wrapper = document.createElement("div");
                    wrapper.className = "dialog-text-label-wrapper-horizontal";
                    contents[tab].appendChild(wrapper);
                    wrapper.appendChild(toggleEle);
                    wrapper.appendChild(labelWrapper);
                    labelWrapper.appendChild(label);
                    if (info[i].desc) labelWrapper.appendChild(labelDesc);
                    this.values.push({ "id": info[i].id, "element": toggle });
                } else if (info[i].type == "slider") {
                    let id = createId();
                    let label = document.createElement("label");
                    label.innerHTML = sanitize(info[i].name);
                    label.className = "dialog-label";
                    label.setAttribute("for", id);
                    let labelDesc = document.createElement("label");
                    if (info[i].desc) {
                        labelDesc.innerHTML = sanitize(info[i].desc);
                        labelDesc.className = "dialog-label-desc";
                        labelDesc.setAttribute("for", id);
                    }
                    let sliderElement = document.createElement("div");
                    let slider = new Slider(sliderElement, info[i].min, info[i].max, info[i].default ?? info[i].min, info[i].increment, info[i].unit);
                    if (info[i].onchange) slider.addOnChange(() => {
                        info[i].onchange(slider.value);
                    });
                    let wrapper = document.createElement("div");
                    wrapper.className = "dialog-text-label-wrapper";
                    contents[tab].appendChild(wrapper);
                    wrapper.appendChild(label);
                    if (info[i].desc) wrapper.appendChild(labelDesc);
                    wrapper.appendChild(sliderElement);
                    this.values.push({ "id": info[i].id, "element": slider });
                } else if (info[i].type == "image-upload") {
                    let wrapper = document.createElement("div");
                    wrapper.className = "dialog-text-label-wrapper";
                    let label = document.createElement("div");
                    label.innerHTML = sanitize(info[i].name);
                    label.className = "dialog-label";
                    wrapper.appendChild(label);
                    let element = document.createElement("div");
                    let imageUpload = new ImageUpload(element, info[i].default);
                    wrapper.appendChild(element);
                    contents[tab].appendChild(wrapper);
                    this.values.push({ "id": info[i].id, "element": imageUpload });
                } else if (info[i].type == "multi-select") {
                    let wrapper = document.createElement("div");
                    wrapper.className = "dialog-text-label-wrapper";
                    let label = document.createElement("div");
                    label.innerHTML = sanitize(info[i].name);
                    label.className = "dialog-label";
                    wrapper.appendChild(label);
                    let element = document.createElement("div");
                    wrapper.appendChild(element);
                    contents[tab].appendChild(wrapper);
                    let multiSelect = new MultiSelect(element, info[i].options);
                    if (info[i].default) multiSelect.selectOption(info[i].default);
                    this.values.push({ "id": info[i].id, "element": multiSelect });
                } else if (info[i].type == "checkboxes") {
                    let wrapper = document.createElement("div");
                    wrapper.className = "dialog-text-label-wrapper";
                    let label = document.createElement("div");
                    label.innerHTML = sanitize(info[i].name);
                    label.className = "dialog-label";
                    wrapper.appendChild(label);
                    let element = document.createElement("div");
                    wrapper.appendChild(element);
                    contents[tab].appendChild(wrapper);
                    let multiSelect = new MultipleSelect(element, info[i].options);
                    if (info[i].default) multiSelect.setSelected(info[i].default);
                    this.values.push({ "id": info[i].id, "element": multiSelect });
                } else if (info[i].type == "files") {
                    let wrapper = document.createElement("div");
                    wrapper.className = "dialog-text-label-wrapper";
                    let label = document.createElement("div");
                    label.innerHTML = sanitize(info[i].name);
                    label.className = "dialog-label";
                    wrapper.appendChild(label);
                    let element = document.createElement("div");
                    wrapper.appendChild(element);
                    contents[tab].appendChild(wrapper);
                    let multiSelect = new MultipleFileSelect(element, info[i].options);
                    if (info[i].default) multiSelect.setSelected(info[i].default);
                    this.values.push({ "id": info[i].id, "element": multiSelect });
                } else if (info[i].type == "dropdown") {
                    let wrapper = document.createElement("div");
                    wrapper.className = "dialog-text-label-wrapper";
                    let label = document.createElement("div");
                    label.innerHTML = sanitize(info[i].name);
                    label.className = "dialog-label";
                    let labelDesc = document.createElement("label");
                    if (info[i].desc) {
                        labelDesc.innerHTML = info[i].desc;
                        labelDesc.className = "dialog-label-desc";
                    }
                    wrapper.appendChild(label);
                    if (info[i].desc) wrapper.appendChild(labelDesc);
                    let element = document.createElement("div");
                    wrapper.appendChild(element);
                    contents[tab].appendChild(wrapper);
                    let multiSelect;
                    if (info[i].options.length >= 10 || info[i].source) {
                        multiSelect = new DialogDropdown("", info[i].options, element, info[i].default ?? info[i].options[0]?.value);
                    } else {
                        multiSelect = new SearchDropdown("", info[i].options, element, info[i].default ?? info[i].options[0]?.value, () => { });
                    }
                    if (info[i].onchange) multiSelect.addOnChange(() => {
                        info[i].onchange(multiSelect.value, this.values, wrapper);
                    });
                    if (info[i].source) {
                        let found = false;
                        for (let j = 0; j < this.values.length; j++) {
                            if (this.values[j].id != info[i].input_source) continue;
                            found = true;
                            // Use a token to ensure only the latest async result is displayed
                            let updateToken = 0;
                            this.values[j].element.addOnChange(async () => {
                                const currentToken = ++updateToken;
                                let oldValue = multiSelect.value;
                                let value = this.values[j].element.value;
                                label.innerHTML = translate("app.dialog.loading");
                                multiSelect.setOptions([{ "name": translate("app.dialog.loading"), "value": "loading" }], "loading");
                                try {
                                    let list = await info[i].source(value);
                                    // Only update if this is the latest request
                                    if (currentToken !== updateToken) return;
                                    if (label.innerHTML != translate("app.dialog.loading")) return;
                                    if (list.length && typeof list[0] === "object" && list[0] !== null && "name" in list[0] && "value" in list[0]) {
                                        multiSelect.setOptions(list, list.map(e => e.value).includes(oldValue) ? oldValue : list.map(e => e.value).includes(info[i].default) ? info[i].default : list[0]?.value);
                                    } else {
                                        multiSelect.setOptions(list.map(e => ({ "name": e, "value": e })), list.includes(oldValue) ? oldValue : list.includes(info[i].default) ? info[i].default : list[0]);
                                    }
                                    if (multiSelect.onchange) multiSelect.onchange();
                                    label.innerHTML = sanitize(info[i].name);
                                } catch (err) {
                                    if (currentToken !== updateToken) return;
                                    displayError(translate("app.failed_to_load_list", "%m", (err && err.message ? err.message : err)));
                                    if (multiSelect.onchange) multiSelect.onchange();
                                    label.innerHTML = sanitize(translate("app.dialog.unable_to_load") + " " + info[i].name);
                                    multiSelect.setOptions([{ "name": translate("app.dialog.unable_to_load"), "value": "loading" }], "loading");
                                }
                            });
                            let setInitialValues = async () => {
                                const currentToken = ++updateToken;
                                let oldValue = multiSelect.value;
                                let value = this.values[j].element.value;
                                label.innerHTML = translate("app.dialog.loading");
                                multiSelect.setOptions([{ "name": translate("app.dialog.loading"), "value": "loading" }], "loading");
                                try {
                                    let list = await info[i].source(value);
                                    if (currentToken !== updateToken) return;
                                    if (label.innerHTML != translate("app.dialog.loading")) return;
                                    if (list.length && typeof list[0] === "object" && list[0] !== null && "name" in list[0] && "value" in list[0]) {
                                        multiSelect.setOptions(list, list.map(e => e.value).includes(oldValue) ? oldValue : list.map(e => e.value).includes(info[i].default) ? info[i].default : list[0]?.value);
                                    } else {
                                        multiSelect.setOptions(list.map(e => ({ "name": e, "value": e })), list.includes(oldValue) ? oldValue : list.includes(info[i].default) ? info[i].default : list[0]);
                                    }
                                    if (multiSelect.onchange) multiSelect.onchange();
                                    label.innerHTML = sanitize(info[i].name);
                                } catch (err) {
                                    if (currentToken !== updateToken) return;
                                    displayError(translate("app.failed_to_load_list", "%m", (err && err.message ? err.message : err)));
                                    if (multiSelect.onchange) multiSelect.onchange();
                                    label.innerHTML = sanitize(translate("app.dialog.unable_to_load") + " " + info[i].name);
                                    multiSelect.setOptions([{ "name": translate("app.dialog.unable_to_load"), "value": "loading" }], "loading");
                                }
                            }
                            setInitialValues();
                        }
                        if (!found) {
                            let setInitialValues = async () => {
                                label.innerHTML = translate("app.dialog.loading");
                                multiSelect.setOptions([{ "name": translate("app.dialog.loading"), "value": "loading" }], "loading");
                                try {
                                    let list = await info[i].source();
                                    console.log(list);
                                    if (label.innerHTML != translate("app.dialog.loading")) return;
                                    if (list.length && typeof list[0] === "object" && list[0] !== null && "name" in list[0] && "value" in list[0]) {
                                        multiSelect.setOptions(list, list.map(e => e.value).includes(info[i].default) ? info[i].default : list[0]?.value);
                                    } else {
                                        multiSelect.setOptions(list.map(e => ({ "name": e, "value": e })), list.includes(info[i].default) ? info[i].default : list[0]);
                                    }
                                    label.innerHTML = sanitize(info[i].name);
                                } catch (err) {
                                    if (currentToken !== updateToken) return;
                                    displayError(translate("app.failed_to_load_list", "%m", (err && err.message ? err.message : err)));
                                    if (multiSelect.onchange) multiSelect.onchange();
                                    label.innerHTML = sanitize(translate("app.dialog.unable_to_load") + " " + info[i].name);
                                    multiSelect.setOptions([{ "name": translate("app.dialog.unable_to_load"), "value": "loading" }], "loading");
                                }
                            }
                            setInitialValues();
                        }
                    }
                    this.values.push({ "id": info[i].id, "element": multiSelect });
                } else if (info[i].type == "loader-version-dropdown") {
                    let wrapper = document.createElement("div");
                    wrapper.className = "dialog-text-label-wrapper";
                    let label = document.createElement("div");
                    label.innerHTML = "Loading...";
                    label.className = "dialog-label";
                    wrapper.appendChild(label);
                    let element = document.createElement("div");
                    wrapper.appendChild(element);
                    contents[tab].appendChild(wrapper);
                    let loaderElement;
                    let multiSelect = new DialogDropdown("", info[i].options, element, info[i].default ?? info[i].options[0]?.value);
                    for (let j = 0; j < this.values.length; j++) {
                        if (this.values[j].id == info[i].loader_source) {
                            loaderElement = this.values[j].element;
                        }
                        if (this.values[j].id == info[i].game_version_source) {
                            // Use a token to ensure only the latest async result is displayed
                            let updateToken = 0;
                            this.values[j].element.addOnChange(async () => {
                                const currentToken = ++updateToken;
                                wrapper.style.display = loaderElement.value == "vanilla" ? "none" : "";
                                if (loaderElement.value == "vanilla") return;
                                let oldValue = multiSelect.value;
                                let value = this.values[j].element.value;
                                label.innerHTML = translate("app.dialog.loading");
                                multiSelect.setOptions([{ "name": translate("app.dialog.loading"), "value": "loading" }], "loading");
                                try {
                                    let list = await getVersions(loaderElement.value, value);
                                    // Only update if this is the latest request
                                    if (currentToken !== updateToken) return;
                                    if (label.innerHTML != translate("app.dialog.loading")) return;
                                    multiSelect.setOptions(list.map(e => ({ "name": e, "value": e })), list.includes(oldValue) ? oldValue : list.includes(info[i].default) ? info[i].default : list[0]);
                                    label.innerHTML = loaders[loaderElement.value] + " Version";
                                } catch (err) {
                                    if (currentToken !== updateToken) return;
                                    displayError(translate("app.failed_to_load_list", "%m", (err && err.message ? err.message : err)));
                                    label.innerHTML = sanitize(translate("app.dialog.unable_to_load") + " " + info[i].name);
                                    multiSelect.setOptions([{ "name": translate("app.dialog.unable_to_load"), "value": "loading" }], "loading");
                                }
                            });
                            let setInitialValues = async () => {
                                const currentToken = ++updateToken;
                                wrapper.style.display = loaderElement.value == "vanilla" ? "none" : "";
                                if (loaderElement.value == "vanilla") return;
                                let oldValue = multiSelect.value;
                                let value = this.values[j].element.value;
                                if (value == "loading") return;
                                label.innerHTML = translate("app.dialog.loading");
                                multiSelect.setOptions([{ "name": translate("app.dialog.loading"), "value": "loading" }], "loading");
                                try {
                                    let list = await getVersions(loaderElement.value, value);
                                    if (currentToken !== updateToken) return;
                                    if (label.innerHTML != translate("app.dialog.loading")) return;
                                    multiSelect.setOptions(list.map(e => ({ "name": e, "value": e })), list.includes(oldValue) ? oldValue : list.includes(info[i].default) ? info[i].default : list[0]);
                                    label.innerHTML = loaders[loaderElement.value] + " Version";
                                } catch (err) {
                                    if (currentToken !== updateToken) return;
                                    displayError(translate("app.failed_to_load_list", "%m", (err && err.message ? err.message : err)));
                                    label.innerHTML = sanitize(translate("app.dialog.unable_to_load") + " " + info[i].name);
                                    multiSelect.setOptions([{ "name": translate("app.dialog.unable_to_load"), "value": "loading" }], "loading");
                                }
                            }
                            setInitialValues();
                        }
                    }
                    this.values.push({ "id": info[i].id, "element": multiSelect });
                } else if (info[i].type == "button") {
                    let buttonElement = document.createElement("button");
                    buttonElement.innerHTML = info[i].icon + info[i].name;
                    buttonElement.className = "sub-button";
                    buttonElement.onclick = () => {
                        if (info[i].close_dialog) {
                            this.element.close();
                            if (onclose) onclose();
                            setTimeout(() => {
                                this.element.remove();
                            }, 1000);
                        }
                        info[i].func();
                    }
                    contents[tab].appendChild(buttonElement);
                }
            }
        }
        let keys = Object.keys(contents);
        keys.forEach(e => {
            contents[e].style.display = "none";
        });
        contents[keys[0]].style.display = "grid";
        let dialogButtons = document.createElement("div");
        dialogButtons.className = "dialog-buttons";
        for (let i = 0; i < buttons.length; i++) {
            let buttonElement = document.createElement("button");
            buttonElement.className = "dialog-button";
            buttonElement.innerHTML = sanitize(buttons[i].content);
            if (buttons[i].type == "cancel") {
                buttonElement.onclick = (e) => {
                    this.element.close();
                    if (onclose) onclose();
                    setTimeout(() => {
                        this.element.remove();
                    }, 1000);
                }
            } else if (buttons[i].type == "confirm") {
                buttonElement.classList.add("confirm");
                buttonElement.onclick = async () => {
                    let info = this.values.map(e => ({ "id": e.id, "value": e.element.value, "pass": e.element.getPass ? e.element.getPass() : null }));
                    info.push({ "id": "selected_tab", "value": selectedTab });
                    onsubmit(info, buttonElement);
                    this.element.close();
                    setTimeout(() => {
                        this.element.remove();
                    }, 1000);
                }
            }
            dialogButtons.appendChild(buttonElement);
        }
        element.appendChild(dialogButtons);
        // make the toasts show on top of the dialog
        document.getElementsByClassName("toasts")[0].hidePopover();
        document.getElementsByClassName("toasts")[0].showPopover();
    }
}

function showAddContent(instance_id, vanilla_version, loader, default_tab) {
    for (let i = 0; i < navButtons.length; i++) {
        navButtons[i].removeSelected();
    }
    discoverButton.setSelected();
    added_vt_dp_packs = [];
    added_vt_rp_packs = [];
    content.innerHTML = "";
    let titleTop = document.createElement("div");
    titleTop.className = "title-top";
    let backButton = document.createElement("button");
    backButton.innerHTML = '<i class="fa-solid fa-arrow-left"></i>' + translate("app.discover.back_to_instance");
    backButton.className = "back-button";
    backButton.onclick = () => {
        showSpecificInstanceContent(new Instance(instance_id), default_tab == "world" ? "worlds" : "content");
    }
    let title = document.createElement("h1");
    title.innerHTML = translate("app.discover.add_content");
    titleTop.appendChild(title);
    if (instance_id) titleTop.appendChild(backButton);
    if (!instance_id) title.innerHTML = translate("app.discover.title");
    let ele = document.createElement("div");
    ele.classList.add("instance-content");
    ele.appendChild(titleTop);
    content.appendChild(ele);
    let tabsElement = document.createElement("div");
    ele.appendChild(tabsElement);
    let tabs = new TabContent(tabsElement, [
        !instance_id ? {
            "name": translate("app.discover.modpacks"),
            "value": "modpack",
            "func": () => {
                contentTabSelect("modpack", tabInfo, loader, vanilla_version, instance_id);
            }
        } : null,
        !loader || loader != "vanilla" ? {
            "name": translate("app.discover.mods"),
            "value": "mod",
            "func": () => {
                contentTabSelect("mod", tabInfo, loader, vanilla_version, instance_id);
            }
        } : null,
        {
            "name": translate("app.discover.resource_packs"),
            "value": "resourcepack",
            "func": () => {
                contentTabSelect("resourcepack", tabInfo, loader, vanilla_version, instance_id);
            }
        },
        !loader || loader != "vanilla" ? {
            "name": translate("app.discover.shaders"),
            "value": "shader",
            "func": () => {
                contentTabSelect("shader", tabInfo, loader, vanilla_version, instance_id);
            }
        } : null,
        {
            "name": translate("app.discover.worlds"),
            "value": "world",
            "func": () => {
                contentTabSelect("world", tabInfo, loader, vanilla_version, instance_id);
            }
        },
        {
            "name": translate("app.discover.servers"),
            "value": "servers",
            "func": () => {
                contentTabSelect("server", tabInfo, loader, vanilla_version, instance_id);
            }
        },
        {
            "name": translate("app.discover.data_packs"),
            "value": "datapack",
            "func": () => {
                contentTabSelect("datapack", tabInfo, loader, vanilla_version, instance_id);
            }
        }
    ].filter(e => e));
    let tabInfo = document.createElement("div");
    tabInfo.className = "tab-info";
    ele.appendChild(tabInfo);
    if (default_tab) {
        tabs.selectOptionAdvanced(default_tab);
        contentTabSelect(default_tab, tabInfo, loader, vanilla_version, instance_id);
    } else if (!instance_id) {
        contentTabSelect("modpack", tabInfo, loader, vanilla_version, instance_id);
    } else if (!loader || loader != "vanilla") {
        contentTabSelect("mod", tabInfo, loader, vanilla_version, instance_id);
    } else {
        contentTabSelect("resourcepack", tabInfo, loader, vanilla_version, instance_id);
    }
    clearMoreMenus();
}

class ContentSearchEntry {
    constructor(title, author, description, downloadCount, imageURL, installContent, installFunction, tags, infoData, id, source, source_id, instance_id, vanilla_version, loader, alreadyInstalled, experimental, project_type, offline) {
        let element = document.createElement("div");
        element.className = "discover-item";
        if (experimental) {
            element.classList.add("experimental");
            element.title = translate("app.discover.experimental");
        }
        if (offline) {
            element.classList.add("incompatible");
            element.title = translate("app.discover.offline");
        }
        element.onclick = () => {
            displayContentInfo(source, source_id, instance_id, vanilla_version, project_type == "datapack" ? "datapack" : loader, false, false, null, infoData, project_type);
        }
        element.setAttribute("tabindex", "0");
        element.setAttribute("role", "button");
        element.onkeydown = (e) => {
            if (e.key == "Enter" || e.key == " ") {
                displayContentInfo(source, source_id, instance_id, vanilla_version, project_type == "datapack" ? "datapack" : loader, false, false, null, infoData, project_type);
            }
        }
        this.element = element;
        if (id) element.id = id;
        let image = document.createElement("img");
        image.src = imageURL ? imageURL : "default.png";
        image.className = "discover-item-image";
        image.loading = "lazy";
        element.appendChild(image);
        let info = document.createElement("div");
        info.className = "discover-item-info";
        element.appendChild(info);
        let actions = document.createElement("div");
        actions.className = "discover-item-actions";
        element.appendChild(actions);
        let top = document.createElement("div");
        top.className = "discover-item-top";
        info.appendChild(top);
        let titleElement = document.createElement("div");
        titleElement.className = "discover-item-title";
        titleElement.innerHTML = `<div>${sanitize(title)}</div>`;
        top.appendChild(titleElement);
        if (author) {
            let authorElement = document.createElement("div");
            authorElement.className = "discover-item-author";
            authorElement.innerHTML = `<div>${sanitize(translate("app.discover.author", "%a", author))}</div>`;
            top.appendChild(authorElement);
        }
        let descElement = document.createElement("div");
        descElement.className = "discover-item-desc";
        descElement.innerHTML = description;
        info.appendChild(descElement);
        let tagsElement = document.createElement("div");
        tagsElement.className = "discover-item-tags";
        info.appendChild(tagsElement);
        tags.forEach(e => {
            let tagElement = document.createElement("div");
            tagElement.innerHTML = sanitize(e);
            tagElement.className = "discover-item-tag";
            tagsElement.appendChild(tagElement);
        });
        if (downloadCount && downloadCount.toString().includes("/")) {
            let split = downloadCount.split("/");
            let downloadCountElement = document.createElement("div");
            downloadCountElement.innerHTML = translate("app.discover.online_count", "%o", (split[0]), "%t", (split[1]));
            downloadCountElement.className = "discover-item-downloads";
            actions.appendChild(downloadCountElement);
        } else if (downloadCount) {
            let downloadCountElement = document.createElement("div");
            downloadCountElement.innerHTML = translate("app.discover.download_count", "%d", sanitize(formatNumber(downloadCount)));
            downloadCountElement.className = "discover-item-downloads";
            actions.appendChild(downloadCountElement);
        }
        let installButton = document.createElement("button");
        installButton.className = "discover-item-install";
        installButton.innerHTML = installContent;
        installButton.onclick = (evnt) => {
            evnt.stopPropagation();
            installFunction(infoData, installButton);
        }
        if (alreadyInstalled) {
            installButton.onclick = () => { };
            installButton.classList.add("disabled");
            installButton.innerHTML = '<i class="fa-solid fa-check"></i>' + translate("app.discover.installed")
        }
        actions.appendChild(installButton);
    }
}

function formatNumber(num) {
    if (num < 1000) return num.toString();
    if (num < 100000) return Math.round(num / 100) / 10 + "k";
    if (num < 1000000) return Math.round(num / 1000) + "k";
    if (num < 100000000) return Math.round(num / 100000) / 10 + "M";
    if (num < 1000000000) return Math.round(num / 1000000) + "M";
    if (num < 100000000000) return Math.round(num / 100000000) / 10 + "B";
    if (num < 1000000000000) return Math.round(num / 1000000000) + "B";
    return "Some Number";
}

function contentTabSelect(tab, ele, loader, version, instance_id) {
    let tabsElement = document.createElement("div");
    ele.innerHTML = '';
    let sources = [];
    ele.appendChild(tabsElement);
    if (tab == "modpack" || tab == "mod" || tab == "resourcepack" || tab == "shader" || tab == "datapack") {
        sources.push({
            "name": translate("app.discover.modrinth"),
            "value": "modrinth",
            "func": () => { }
        });
    }
    if (tab == "modpack" || tab == "mod" || tab == "resourcepack" || tab == "shader" || tab == "world" || tab == "datapack" || tab == "server") {
        sources.push({
            "name": translate("app.discover.curseforge"),
            "value": "curseforge",
            "func": () => { }
        });
    }
    if (tab == "resourcepack" || tab == "datapack") {
        sources.push({
            "name": translate("app.discover.vanilla_tweaks"),
            "value": "vanilla_tweaks",
            "func": () => { }
        });
        added_vt_dp_packs = [];
        added_vt_rp_packs = [];
    }
    // if (tab == "world") {
    //     sources.push({
    //         "name": "Minecraft Maps",
    //         "value": "minecraft_maps",
    //         "func": () => { }
    //     });
    // }
    // let tabs = new TabContent(tabsElement,sources);

    let searchAndFilter = document.createElement("div");
    searchAndFilter.className = "search-and-filter-v2";
    let discoverList = document.createElement("div");
    discoverList.className = "discover-list";
    let searchElement = document.createElement("div");
    searchElement.style.flexGrow = 2;
    let searchContents = "";
    let s = new SearchBar(searchElement, () => { }, (v) => {
        searchContents = v;
        getContent(discoverList, instance_id, d.getSelected, v, loader, version, tab);
    });
    if (tab == "server") s.disable(translate("app.discover.server_search_not_available"));
    let dropdownElement = document.createElement("div");
    dropdownElement.style.minWidth = "200px";
    let d = new SearchDropdown(translate("app.discover.content_source"), sources, dropdownElement, sources[0].value, () => {
        getContent(discoverList, instance_id, d.getSelected, searchContents, loader, version, tab);
    });
    getContent(discoverList, instance_id, sources[0].value, "", loader, version, tab);
    searchAndFilter.appendChild(dropdownElement);
    searchAndFilter.appendChild(searchElement);
    ele.appendChild(searchAndFilter);
    ele.appendChild(discoverList);
}

let added_vt_rp_packs = [];
let added_vt_dp_packs = [];
let selected_vt_version = "1.21";
let pages = 0;

class Pagination {
    constructor(currentPage, totalPages, change_page_function, d1opt, d1def, d1func, d2opt, d2def, d2func, d3opt, d3def, d3func, d4opt, d4def, d4func) {
        let element = document.createElement("div");
        element.className = "page-container";
        this.element = element;
        this.totalPages = totalPages;
        this.change_page_function = change_page_function;
        this.d1opt = d1opt;
        this.d1def = d1def;
        this.d1func = d1func;
        this.d2opt = d2opt;
        this.d2def = d2def;
        this.d2func = d2func;
        this.d3opt = d3opt;
        this.d3def = d3def;
        this.d3func = d3func;
        this.d4opt = d4opt;
        this.d4def = d4def;
        this.d4func = d4func;
        this.setPage(currentPage);
    }
    setTotalPages(totalPages) {
        this.totalPages = totalPages;
        this.setPage(this.currentPage);
    }
    setPage(page) {
        this.currentPage = page;
        let element = this.element;
        this.element.innerHTML = "";
        let leftArrow = document.createElement("button");
        leftArrow.className = "page";
        leftArrow.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
        if (this.currentPage <= 1) {
            leftArrow.classList.add("disabled");
        } else {
            leftArrow.onclick = () => {
                this.change_page_function(this.currentPage - 1);
            }
        }
        let rightArrow = document.createElement("button");
        rightArrow.className = "page";
        rightArrow.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
        if (this.currentPage >= this.totalPages) {
            rightArrow.classList.add("disabled");
        } else {
            rightArrow.onclick = () => {
                this.change_page_function(this.currentPage + 1);
            }
        }
        let currentPageEle = document.createElement("button");
        currentPageEle.innerHTML = this.currentPage;
        currentPageEle.className = "page";
        currentPageEle.classList.add("selected");
        let gap = 0;
        if (this.d1opt) {
            let dropdownEle = document.createElement("div");
            dropdownEle.style.width = "150px";
            new SearchDropdown(translate("app.discover.sort_by"), this.d1opt, dropdownEle, this.d1def, this.d1func);
            element.appendChild(dropdownEle);
            if (!this.d2opt && !this.d3opt && !this.d4opt) dropdownEle.style.marginRight = "auto";
        }
        if (this.d2opt) {
            let dropdownEle = document.createElement("div");
            dropdownEle.style.width = "75px";
            new SearchDropdown(translate("app.discover.view"), this.d2opt, dropdownEle, this.d2def, this.d2func);
            element.appendChild(dropdownEle);
            if (!this.d3opt && !this.d4opt) dropdownEle.style.marginRight = "auto";
        }
        if (this.d3opt) {
            let dropdownEle = document.createElement("div");
            dropdownEle.style.width = "180px";
            new DialogDropdown(translate("app.discover.game_version"), this.d3opt, dropdownEle, this.d3def, this.d3func);
            element.appendChild(dropdownEle);
            if (!this.d4opt) dropdownEle.style.marginRight = "auto";
        }
        if (this.d4opt) {
            let dropdownEle = document.createElement("div");
            dropdownEle.style.marginRight = "auto";
            dropdownEle.style.width = "150px";
            new SearchDropdown(translate("app.discover.loader"), this.d4opt, dropdownEle, this.d4def, this.d4func);
            element.appendChild(dropdownEle);
        }
        element.appendChild(leftArrow);
        for (let i = 1; i <= this.totalPages; i++) {
            if (i == this.currentPage) {
                element.appendChild(currentPageEle);
            } else if (i == 1 || i == this.totalPages || i == this.currentPage + 1 || i == this.currentPage - 1 || this.totalPages <= 5) {
                let pageElement = document.createElement("button");
                pageElement.innerHTML = i;
                pageElement.className = "page";
                pageElement.onclick = () => {
                    this.change_page_function(i);
                }
                element.appendChild(pageElement);
                gap = 0;
            } else {
                if (gap == 0) {
                    let pageCollapse = document.createElement("div");
                    pageCollapse.className = "page-collapse";
                    pageCollapse.innerHTML = '<i class="fa-solid fa-ellipsis"></i>';
                    element.appendChild(pageCollapse);
                }
                gap = 1;
            }
        }
        element.appendChild(rightArrow);
    }
}

async function getContent(element, instance_id, source, query, loader, version, project_type, vt_version = selected_vt_version, page = 1, pageSize = 20, sortBy = "relevance") {
    let instance_content = [];
    if (instance_id) instance_content = (new Instance(instance_id)).getContent();
    let content_ids = instance_content.map(e => e.source_info);
    element.innerHTML = "";
    let loading = new LoadingContainer();
    element.appendChild(loading.element);
    if (source == "modrinth") {
        let apiresult;
        try {
            apiresult = await window.electronAPI.modrinthSearch(query, loader, project_type, version, page, pageSize, sortBy);
            element.innerHTML = "";
        } catch (err) {
            loading.errorOut(err, () => { getContent(element, instance_id, source, query, loader, version, project_type, vt_version) });
            return;
        }
        pages = Math.ceil(apiresult.total_hits / pageSize);
        let paginationTop = new Pagination(page, pages, (new_page) => {
            getContent(element, instance_id, source, query, loader, version, project_type, vt_version, new_page, pageSize, sortBy)
        }, ["server"].includes(project_type) ? null : [
            {
                "name": translate("app.discover.sort.relevance"),
                "value": "relevance"
            },
            {
                "name": translate("app.discover.sort.downloads"),
                "value": "downloads"
            },
            {
                "name": translate("app.discover.sort.newest"),
                "value": "newest"
            },
            {
                "name": translate("app.discover.sort.updated"),
                "value": "updated"
            }
        ], sortBy, (v) => {
            getContent(element, instance_id, source, query, loader, version, project_type, vt_version, 1, pageSize, v);
        }, ["server"].includes(project_type) ? null : [
            {
                "name": translate("app.discover.view.5"),
                "value": "5"
            },
            {
                "name": translate("app.discover.view.10"),
                "value": "10"
            },
            {
                "name": translate("app.discover.view.15"),
                "value": "15"
            },
            {
                "name": translate("app.discover.view.20"),
                "value": "20"
            },
            {
                "name": translate("app.discover.view.50"),
                "value": "50"
            },
            {
                "name": translate("app.discover.view.100"),
                "value": "100"
            }
        ], pageSize.toString(), (v) => {
            getContent(element, instance_id, source, query, loader, version, project_type, vt_version, 1, Number(v), sortBy);
        }, ["server"].includes(project_type) ? null : [{ "name": translate("app.discover.game_version.all"), "value": "all" }].concat(minecraftVersions.toReversed().map(e => ({ "name": e, "value": e }))), version ? version : "all", (v) => {
            getContent(element, instance_id, source, query, loader, v == "all" ? null : v, project_type, vt_version, page, pageSize, sortBy);
        }, ["resourcepack", "shader", "world", "datapack", "server"].includes(project_type) ? null : [
            {
                "name": translate("app.discover.loader.all"),
                "value": "all"
            },
            {
                "name": translate("app.loader.fabric"),
                "value": "fabric"
            },
            {
                "name": translate("app.loader.forge"),
                "value": "forge"
            },
            {
                "name": translate("app.loader.neoforge"),
                "value": "neoforge"
            },
            {
                "name": translate("app.loader.quilt"),
                "value": "quilt"
            }
        ], loader ? loader : "all", (v) => {
            getContent(element, instance_id, source, query, v == "all" ? null : v, version, project_type, vt_version, page, pageSize, sortBy);
        });
        let paginationBottom = new Pagination(page, pages, (new_page) => {
            getContent(element, instance_id, source, query, loader, version, project_type, vt_version, new_page, pageSize, sortBy)
        });
        if (!apiresult.hits || !apiresult.hits.length) {
            let noresults = new NoResultsFound();
            element.appendChild(noresults.element);
            return;
        }
        element.appendChild(paginationTop.element);
        for (let i = 0; i < apiresult.hits.length; i++) {
            let e = apiresult.hits[i];
            let entry = new ContentSearchEntry(e.title, e.author, e.description, e.downloads, e.icon_url, '<i class="fa-solid fa-download"></i>' + translate("app.discover.install"), (i, button) => {
                installButtonClick(project_type, "modrinth", i.categories, i.icon_url, i.title, i.author, i.versions, i.project_id, instance_id, button, null)
            }, e.categories.map(e => formatCategory(e)), e, null, "modrinth", e.project_id, instance_id, version, loader, content_ids.includes(e.project_id), false, project_type);
            element.appendChild(entry.element);
        }
        element.appendChild(paginationBottom.element);
    } else if (source == "curseforge") {
        let apiresult;
        try {
            apiresult = await window.electronAPI.curseforgeSearch(query, loader, project_type, version, page, pageSize, sortBy);
            element.innerHTML = "";
        } catch (err) {
            loading.errorOut(err, () => { getContent(element, instance_id, source, query, loader, version, project_type, vt_version) });
            return;
        }
        pages = Math.ceil(project_type == "server" ? (apiresult.meta.total / 50) : (apiresult.pagination.totalCount / pageSize));
        let paginationTop = new Pagination(page, pages, (new_page) => {
            getContent(element, instance_id, source, query, loader, version, project_type, vt_version, new_page, pageSize, sortBy)
        }, ["server"].includes(project_type) ? null : [
            {
                "name": translate("app.discover.sort.relevance"),
                "value": "relevance"
            },
            {
                "name": translate("app.discover.sort.downloads"),
                "value": "downloads"
            },
            {
                "name": translate("app.discover.sort.newest"),
                "value": "newest"
            },
            {
                "name": translate("app.discover.sort.updated"),
                "value": "updated"
            }
        ], sortBy, (v) => {
            getContent(element, instance_id, source, query, loader, version, project_type, vt_version, 1, pageSize, v);
        }, ["server"].includes(project_type) ? null : [
            {
                "name": translate("app.discover.view.5"),
                "value": "5"
            },
            {
                "name": translate("app.discover.view.10"),
                "value": "10"
            },
            {
                "name": translate("app.discover.view.15"),
                "value": "15"
            },
            {
                "name": translate("app.discover.view.20"),
                "value": "20"
            },
            {
                "name": translate("app.discover.view.50"),
                "value": "50"
            },
            {
                "name": translate("app.discover.view.100"),
                "value": "100"
            }
        ], pageSize.toString(), (v) => {
            getContent(element, instance_id, source, query, loader, version, project_type, vt_version, 1, Number(v), sortBy);
        }, ["server"].includes(project_type) ? null : [{ "name": translate("app.discover.game_version.all"), "value": "all" }].concat(minecraftVersions.toReversed().map(e => ({ "name": e, "value": e }))), version ? version : "all", (v) => {
            getContent(element, instance_id, source, query, loader, v == "all" ? null : v, project_type, vt_version, page, pageSize, sortBy);
        }, ["resourcepack", "shader", "world", "datapack", "server"].includes(project_type) ? null : [
            {
                "name": translate("app.discover.loader.all"),
                "value": "all"
            },
            {
                "name": translate("app.loader.fabric"),
                "value": "fabric"
            },
            {
                "name": translate("app.loader.forge"),
                "value": "forge"
            },
            {
                "name": translate("app.loader.neoforge"),
                "value": "neoforge"
            },
            {
                "name": translate("app.loader.quilt"),
                "value": "quilt"
            }
        ], loader ? loader : "all", (v) => {
            getContent(element, instance_id, source, query, v == "all" ? null : v, version, project_type, vt_version, page, pageSize, sortBy);
        });
        let paginationBottom = new Pagination(page, pages, (new_page) => {
            getContent(element, instance_id, source, query, loader, version, project_type, vt_version, new_page, pageSize, sortBy)
        });
        if (!apiresult.data || !apiresult.data.length) {
            let noresults = new NoResultsFound();
            element.appendChild(noresults.element);
            return;
        }
        element.appendChild(paginationTop.element);
        for (let i = 0; i < apiresult.data.length; i++) {
            let e = apiresult.data[i];
            let entry;
            if (project_type == "server") {
                entry = new ContentSearchEntry(e.name, "", e.serverConnection, e.latestPing.online + "/" + e.latestPing.total, e.favicon, '<i class="fa-solid fa-download"></i>' + translate("app.discover.install"), (i, button) => {
                    installButtonClick(project_type, "curseforge", [], e.favicon, e.name, "", [], e.serverConnection, instance_id, button, null);
                }, e.tags.map(e => e.name), e, null, "curseforge", e.serverConnection, instance_id, version, loader, false, false, project_type, !e.latestPing.successful);
            } else {
                entry = new ContentSearchEntry(e.name, e.author.username, e.summary, e.downloads, e.thumbnailUrl ? e.thumbnailUrl : e.avatarUrl, '<i class="fa-solid fa-download"></i>' + translate("app.discover.install"), (i, button) => {
                    installButtonClick(project_type, "curseforge", [], e.thumbnailUrl, e.name, i.author.username, [], e.id, instance_id, button, null);
                }, e.categories.map(e => e.name), e, null, "curseforge", e.id, instance_id, version, loader, content_ids.includes(e.id + ".0"), false, project_type);
            }
            element.appendChild(entry.element);
        }
        element.appendChild(paginationBottom.element);
    } else if (source == "vanilla_tweaks") {
        let result;
        if (project_type == "datapack" && (vt_version == "1.11" || vt_version == "1.12")) {
            vt_version = "1.13";
        }
        let incompatible_rp_versions = ["1.0", "1.1", "1.2.1", "1.2.2", "1.2.3", "1.2.4", "1.2.5", "1.3", "1.3.1", "1.3.2", "1.4", "1.4.1", "1.4.2", "1.4.3", "1.4.4", "1.4.5", "1.4.6", "1.4.7", "1.5", "1.5.1", "1.5.2", "1.6", "1.6.1", "1.6.2", "1.6.3", "1.6.4", "1.7", "1.7.1", "1.7.2", "1.7.3", "1.7.4", "1.7.5", "1.7.6", "1.7.7", "1.7.8", "1.7.9", "1.7.10", "1.8", "1.8.1", "1.8.2", "1.8.3", "1.8.4", "1.8.5", "1.8.6", "1.8.7", "1.8.8", "1.8.9", "1.9", "1.9.1", "1.9.2", "1.RV-Pre1", "1.9.3", "1.9.4", "1.10", "1.10.1", "1.10.2"];
        let incompatible_dp_versions = incompatible_rp_versions.concat(["1.11", "1.11.1", "1.11.2", "1.12", "1.12.1", "1.12.2"]);
        if (version && (version.includes("rd") || version.includes("rc") || version.includes("w") || version.includes("pre") || version.includes("c") || version.includes("inf") || version.includes("a") || version.includes("b"))) {
            element.innerHTML = "";
            let noresults = new NoResultsFound();
            element.appendChild(noresults.element);
            return;
        }
        if (version && ((project_type == "datapack" && incompatible_dp_versions.includes(version)) || (project_type == "resourcepack" && incompatible_rp_versions.includes(version)))) {
            element.innerHTML = "";
            let noresults = new NoResultsFound();
            element.appendChild(noresults.element);
            return;
        }
        try {
            if (project_type == "resourcepack") {
                result = await window.electronAPI.getVanillaTweaksResourcePacks(query, version ? version : vt_version);
            } else if (project_type == "datapack") {
                result = await window.electronAPI.getVanillaTweaksDataPacks(query, version ? version : vt_version);
            }
            element.innerHTML = "";
        } catch (err) {
            loading.errorOut(err, () => { getContent(element, instance_id, source, query, loader, version, project_type, vt_version, page, pageSize, sortBy) });
            return;
        }
        let buttonWrapper = document.createElement("div");
        buttonWrapper.className = "vt-button-wrapper";
        if (!version) {
            let dropdownElement = document.createElement("div");
            let drodpown = new SearchDropdown("Version", [
                {
                    "name": "1.21",
                    "value": "1.21"
                },
                {
                    "name": "1.20",
                    "value": "1.20"
                },
                {
                    "name": "1.19",
                    "value": "1.19"
                },
                {
                    "name": "1.18",
                    "value": "1.18"
                },
                {
                    "name": "1.17",
                    "value": "1.17"
                },
                {
                    "name": "1.16",
                    "value": "1.16"
                },
                {
                    "name": "1.15",
                    "value": "1.15"
                },
                {
                    "name": "1.14",
                    "value": "1.14"
                },
                {
                    "name": "1.13",
                    "value": "1.13"
                },
                project_type == "resourcepack" ? {
                    "name": "1.12",
                    "value": "1.12"
                } : null,
                project_type == "resourcepack" ? {
                    "name": "1.11",
                    "value": "1.11"
                } : null
            ].filter(e => e), dropdownElement, vt_version, (s) => {
                getContent(element, instance_id, source, query, loader, version, project_type, s, page, pageSize, sortBy);
                selected_vt_version = s;
                added_vt_rp_packs = [];
                added_vt_dp_packs = [];
            });
            buttonWrapper.appendChild(dropdownElement);
        }
        let submitButton = document.createElement("button");
        submitButton.className = "vt-submit-button";
        submitButton.innerHTML = '<i class="fa-solid fa-download"></i>' + translate("app.discover.vt.install");
        submitButton.onclick = async () => {
            if (project_type == "datapack") {
                let dialog = new Dialog();
                dialog.showDialog(translate("app.discover.datapacks.title"), "form", [
                    instance_id ? null : {
                        "type": "dropdown",
                        "id": "instance",
                        "name": translate("app.discover.datapacks.instance"),
                        "options": data.getInstances().map(e => ({ "name": e.name, "value": e.instance_id }))
                    },
                    {
                        "type": "dropdown",
                        "id": "world",
                        "name": translate("app.discover.datapacks.world"),
                        "options": instance_id ? getInstanceWorlds(new Instance(instance_id)).map(e => ({ "name": e.name, "value": e.id })) : [],
                        "input_source": instance_id ? null : "instance",
                        "source": instance_id ? null : (i) => {
                            return getInstanceWorlds(new Instance(i)).map(e => ({ "name": e.name, "value": e.id }));
                        }
                    }
                ].filter(e => e), [
                    { "content": translate("app.instances.cancel"), "type": "cancel" },
                    { "content": translate("app.instances.submit"), "type": "confirm" }
                ], [], async (e) => {
                    let info = {};
                    e.forEach(e => { info[e.id] = e.value });
                    let instance = instance_id ? instance_id : info.instance;
                    let world = info.world;
                    if (instance_id) {
                        submitButton.innerHTML = '<i class="spinner"></i>' + translate("app.discover.installing");
                        submitButton.classList.add("disabled");
                        submitButton.onclick = () => { };
                    }
                    let success = await window.electronAPI.downloadVanillaTweaksDataPacks(added_vt_dp_packs, version ? version : vt_version, instance, world);
                    if (instance_id) {
                        if (success) {
                            submitButton.innerHTML = '<i class="fa-solid fa-check"></i>' + translate("app.discover.installed");
                        } else {
                            submitButton.innerHTML = '<i class="fa-solid fa-xmark"></i>' + translate("app.discover.failed")
                        }
                    } else {
                        if (success) {
                            displaySuccess(translate("app.discover.vt.success", "%i", new Instance(instance).name));
                        } else {
                            displayError(translate("app.discover.vt.fail"));
                        }
                    }
                })
            } else if (instance_id) {
                submitButton.innerHTML = '<i class="spinner"></i>' + translate("app.discover.installing");
                submitButton.onclick = () => { };
                let file_name = await window.electronAPI.downloadVanillaTweaksResourcePacks(added_vt_rp_packs, version ? version : vt_version, instance_id);
                if (!file_name) {
                    displayError(translate("app.discover.vt.fail"));
                    return;
                }
                let instance = new Instance(instance_id);
                instance.addContent(translate("app.discover.vt.title"), translate("app.discover.vt.author"), "https://vanillatweaks.net/assets/images/logo.png", file_name, "vanilla_tweaks", "resource_pack", "", JSON.stringify(added_vt_rp_packs), false);
                submitButton.innerHTML = '<i class="fa-solid fa-check"></i>' + translate("app.discover.installed");
            } else {
                let instances = data.getInstances();
                let dialog = new Dialog();
                dialog.showDialog(translate("app.discover.select_instance.vt.title"), "form", [
                    {
                        "type": "dropdown",
                        "name": translate("app.discover.select_instance.instance"),
                        "id": "instance",
                        "options": instances.map(e => ({ "name": e.name, "value": e.instance_id }))
                    }
                ], [
                    { "content": translate("app.discover.select_instance.cancel"), "type": "cancel" },
                    { "content": translate("app.discover.select_instance.confirm"), "type": "confirm" }
                ], null, async (e) => {
                    let info = {};
                    e.forEach(e => { info[e.id] = e.value });
                    let file_name = await window.electronAPI.downloadVanillaTweaksResourcePacks(added_vt_rp_packs, version ? version : vt_version, info.instance);
                    if (!file_name) {
                        displayError(translate("app.discover.vt.fail"));
                        return;
                    }
                    let instance = new Instance(info.instance);
                    instance.addContent(translate("app.discover.vt.title"), translate("app.discover.vt.author"), "https://vanillatweaks.net/assets/images/logo.png", file_name, "vanilla_tweaks", "resource_pack", "", JSON.stringify(added_vt_rp_packs), false);
                    displaySuccess(translate("app.discover.vt.success", "%i", instance.name));
                });
            }
        }
        buttonWrapper.append(submitButton);
        element.appendChild(buttonWrapper);
        if (!result.hits || !result.hits.length) {
            let noresults = new NoResultsFound();
            element.appendChild(noresults.element);
            return;
        }
        let name_map = {};
        result.hits.map(e => {
            name_map[e.vt_id] = e.title;
        })
        let checkForIncompatibilities = () => {
            result.hits.map(e => e.entry.element).forEach(e => {
                e.classList.remove("incompatible");
                if (e.classList.contains("experimental")) {
                    e.title = translate("app.discover.experimental");
                } else {
                    e.removeAttribute("title");
                }
            });
            let added_packs_ids = project_type == "resourcepack" ? added_vt_rp_packs.map(e => e.id) : added_vt_dp_packs.map(e => e.id);
            result.hits.forEach(e => {
                if (added_packs_ids.includes(e.vt_id)) {
                    let incompatibleWith = [];
                    for (let i = 0; i < e.incompatible.length; i++) {
                        if (added_packs_ids.includes(e.incompatible[i])) {
                            incompatibleWith.push(name_map[e.incompatible[i]] ?? e.incompatible[i]);
                        }
                    }
                    if (incompatibleWith.length) {
                        e.entry.element.classList.add("incompatible");
                        e.entry.element.setAttribute("title", translate("app.discover.vt.incompatible", "%p", incompatibleWith.join(", ")));
                    }
                }
            });
        }
        for (let i = 0; i < result.hits.length; i++) {
            let e = result.hits[i];
            let onAddPack = (info, button) => {
                button.innerHTML = '<i class="fa-solid fa-minus"></i>' + translate("app.discover.vt.remove");
                button.onclick = () => {
                    onRemovePack(info, button);
                }
                displaySuccess(translate("app.discover.vt.add.message", "%t", e.title));
                if (project_type == "resourcepack") {
                    added_vt_rp_packs.push({ "id": info.vt_id, "name": e.title, "type": e.type });
                    checkForIncompatibilities();
                } else if (project_type == "datapack") {
                    added_vt_dp_packs.push({ "id": info.vt_id, "name": e.title, "type": e.type });
                    checkForIncompatibilities();
                }
            }
            let onRemovePack = (info, button) => {
                button.innerHTML = '<i class="fa-solid fa-plus"></i>' + translate("app.discover.vt.add");
                button.onclick = () => {
                    onAddPack(info, button);
                }
                displaySuccess(translate("app.discover.vt.remove.message", "%t", e.title));
                if (project_type == "resourcepack") {
                    added_vt_rp_packs = added_vt_rp_packs.filter(e => e.id != info.vt_id);
                    checkForIncompatibilities();
                } else if (project_type == "datapack") {
                    added_vt_dp_packs = added_vt_dp_packs.filter(e => e.id != info.vt_id);
                    checkForIncompatibilities();
                }
            }
            let entry = new ContentSearchEntry(e.title, e.author, e.description, e.downloads, e.icon_url, (project_type == "resourcepack" ? added_vt_rp_packs.map(e => e.id).includes(e.vt_id) : added_vt_dp_packs.map(e => e.id).includes(e.vt_id)) ? '<i class="fa-solid fa-minus"></i>' + translate("app.discover.vt.remove") : '<i class="fa-solid fa-plus"></i>' + translate("app.discover.vt.add"), (project_type == "resourcepack" ? added_vt_rp_packs.map(e => e.id).includes(e.vt_id) : added_vt_dp_packs.map(e => e.id).includes(e.vt_id)) ? onRemovePack : onAddPack, e.categories, e, "vt-" + e.vt_id, null, null, null, null, null, null, e.experiment, project_type);
            e.entry = entry;
            element.appendChild(entry.element);
        }
        checkForIncompatibilities();
    }
}

async function installContent(source, project_id, instance_id, project_type, title, author, icon_url, data_pack_world) {
    let instance = new Instance(instance_id);
    let version_json;
    let max_pages = 10;
    if (source == "modrinth") {
        let res = await fetch(`https://api.modrinth.com/v2/project/${project_id}/version`);
        version_json = await res.json();
    } else if (source == "curseforge") {
        let game_flavor = ["", "forge", "", "", "fabric", "quilt", "neoforge"].indexOf(instance.loader);
        version_json = await window.electronAPI.getCurseforgePage(project_id, 1, project_type == "mod" ? game_flavor : -1);
        let dependencies = await fetch(`https://www.curseforge.com/api/v1/mods/${project_id}/dependencies?index=0&pageSize=100`);
        let dependencies_json = await dependencies.json();
        let dependency_list = dependencies_json.data;
        max_pages = Math.ceil(version_json.pagination.totalCount / version_json.pagination.pageSize) + 1;
        version_json = version_json.data.map(e => ({
            "game_versions": e.gameVersions,
            "files": [
                {
                    "filename": e.fileName,
                    "url": (`https://mediafilez.forgecdn.net/files/${Number(e.id.toString().substring(0, 4))}/${Number(e.id.toString().substring(4, 7))}/${encodeURIComponent(e.fileName)}`)
                }
            ],
            "loaders": e.gameVersions.map(e => {
                return e.toLowerCase();
            }),
            "id": e.id,
            "dependencies": dependency_list
        }));
        console.log(version_json);
    }
    let initialContent = {};
    if (instance.getContent().map(e => e.source_id).includes(project_id)) {
        return false;
    }
    for (let j = 0; j < version_json.length; j++) {
        if (version_json[j].game_versions.includes(instance.vanilla_version) && (project_type != "mod" || version_json[j].loaders.includes(instance.loader)) && (source != "modrinth" || project_type != "datapack" || version_json[j].loaders.includes("datapack"))) {
            initialContent = await installSpecificVersion(version_json[j], source, instance, project_type, title, author, icon_url, project_id, false, data_pack_world);
            break;
        }
    }

    if (!initialContent?.type && source == "curseforge") {
        let not_found = true;
        let count = 1;
        while (not_found) {
            count++;
            if (count >= max_pages) {
                not_found = false;
                displayError(translate("app.discover.unable_to_install", "%t", title));
                return false;
            }
            let game_flavor = ["", "forge", "", "", "fabric", "quilt", "neoforge"].indexOf(instance.loader);
            version_json = await window.electronAPI.getCurseforgePage(project_id, count, game_flavor);
            let dependencies = await fetch(`https://www.curseforge.com/api/v1/mods/${project_id}/dependencies?index=0&pageSize=100`);
            let dependencies_json = await dependencies.json();
            let dependency_list = dependencies_json.data;
            version_json = version_json.data.map(e => ({
                "game_versions": e.gameVersions,
                "files": [
                    {
                        "filename": e.fileName,
                        "url": (`https://mediafilez.forgecdn.net/files/${Number(e.id.toString().substring(0, 4))}/${Number(e.id.toString().substring(4, 7))}/${encodeURIComponent(e.fileName)}`)
                    }
                ],
                "loaders": e.gameVersions.map(e => {
                    return e.toLowerCase();
                }),
                "id": e.id,
                "dependencies": dependency_list
            }));
            let initialContent = {};
            if (instance.getContent().map(e => e.source_id).includes(project_id)) {
                return;
            }
            for (let j = 0; j < version_json.length; j++) {
                if (version_json[j].game_versions.includes(instance.vanilla_version) && (project_type != "mod" || version_json[j].loaders.includes(instance.loader))) {
                    initialContent = await installSpecificVersion(version_json[j], source, instance, project_type, title, author, icon_url, project_id, false, data_pack_world);
                    break;
                }
            }
            if (initialContent?.type) {
                not_found = false;
            }
        }
    }

    if (!initialContent?.type && source == "modrinth") {
        displayError(translate("app.discover.unable_to_install", "%t", title));
        return false;
    }

    return true;
}

async function installSpecificVersion(version_info, source, instance, project_type, title, author, icon_url, project_id, isUpdate, data_pack_world) {
    if (project_type == "server") {
        let initialContent = await addContent(instance_id, project_type, project_id, title, icon_url);
        return initialContent;
    }
    let instance_id = instance.instance_id;
    let initialContent = await addContent(instance_id, project_type, version_info.files[0].url, version_info.files[0].filename, data_pack_world);
    if (isUpdate) return initialContent;
    let version = version_info.version_number ? version_info.version_number : "";
    let version_id = version_info.id;
    let dependencies = version_info.dependencies;
    if (instance.getContent().map(e => e.source_id).includes(project_id)) {
        return;
    }
    if (dependencies && source == "modrinth" && project_type != "world" && project_type != "datapack") {
        for (let j = 0; j < dependencies.length; j++) {
            let dependency = dependencies[j];
            let res = await fetch(`https://api.modrinth.com/v2/project/${dependency.project_id}`);
            let res_json = await res.json();
            let get_author_res = await fetch(`https://api.modrinth.com/v2/project/${dependency.project_id}/members`);
            let get_author_res_json = await get_author_res.json();
            let author = "";
            get_author_res_json.forEach(e => {
                if (e.role == "Owner" || e.role == "Lead developer" || e.role == "Project Lead") {
                    author = e.user.username;
                }
            })
            if (dependency.dependency_type == "required") {
                await installContent(source, dependency.project_id, instance_id, res_json.project_type, res_json.title, author, res_json.icon_url);
            }
        }
    } else if (dependencies && source == "curseforge" && project_type != "world" && project_type != "datapack") {
        for (let j = 0; j < dependencies.length; j++) {
            let dependency = dependencies[j];
            console.log(dependency.name);
            let project_type = "mod";
            if (dependency.categoryClass.slug == "texture-packs") project_type = "resourcepack";
            if (dependency.categoryClass.slug == "shaders") project_type = "shader";
            if (dependency.type == "RequiredDependency") {
                await installContent(source, dependency.id, instance_id, project_type, dependency.name, dependency.authorName, dependency.logoUrl);
            }
        }
    }
    if (project_type != "world" && project_type != "datapack") instance.addContent(title, author, icon_url, initialContent.file_name, source, initialContent.type, version, project_id, false, version_id);
    return initialContent;
}

function formatCategory(e) {
    return toTitleCase(e.replaceAll("-", " "));
}

function toTitleCase(str) {
    return str.replace(/\w\S*/g, function (txt) {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
}

async function addContent(instance_id, project_type, project_url, filename, data_pack_world) {
    return await window.electronAPI.addContent(instance_id, project_type, project_url, filename, data_pack_world);
}

class LoadingContainer {
    constructor() {
        let element = document.createElement("div");
        element.className = "loading-container";
        let spinner = document.createElement("div");
        spinner.className = "loading-container-spinner";
        let text = document.createElement("div");
        text.className = "loading-container-text";
        element.appendChild(spinner);
        element.appendChild(text);
        text.innerHTML = translate("app.loading");
        this.element = element;
        let index = 1;
        let interval = setInterval(() => {
            text.innerHTML = translate("app.loading") + ".".repeat(index);
            index++;
        }, 400)
        this.interval = interval;
    }
    errorOut(e, refresh_func) {
        let error = document.createElement("div");
        error.className = "loading-container-error";
        error.innerHTML = '<i class="fa-solid fa-xmark"></i>';
        let text = document.createElement("div");
        text.className = "loading-container-text";
        text.innerHTML = sanitize(e.message);
        this.element.innerHTML = '';
        this.element.appendChild(error);
        this.element.appendChild(text);
        let refresh = document.createElement("button");
        refresh.className = "loading-container-refresh";
        refresh.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i>Try Again';
        refresh.onclick = refresh_func;
        this.element.appendChild(refresh);
        clearInterval(this.interval);
    }
}

class NoResultsFound {
    constructor(message = translate("app.no_results_found")) {
        let element = document.createElement("div");
        element.className = "loading-container";
        let question = document.createElement("div");
        question.className = "loading-container-question";
        question.innerHTML = '<i class="fa-solid fa-question"></i>';
        let text = document.createElement("div");
        text.className = "loading-container-text";
        element.appendChild(question);
        element.appendChild(text);
        text.innerHTML = message;
        this.element = element;
    }
}

class CurrentlyInstalling {
    constructor() {
        let element = document.createElement("div");
        element.className = "loading-container";
        element.style.marginTop = "10px";
        let spinner = document.createElement("div");
        spinner.className = "loading-container-spinner";
        let text = document.createElement("div");
        text.className = "loading-container-text";
        element.appendChild(spinner);
        element.appendChild(text);
        text.innerHTML = translate("app.currently_installing");
        this.element = element;
    }
}

function sanitize(input) {
    if (typeof input !== "string") return "";
    return input
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

let defaultpage = data.getDefault("default_page");
let other_default_page = window.electronAPI.isOtherStartingPage();
if (other_default_page) defaultpage = other_default_page;
if (defaultpage == "home") {
    homeButton.setSelected();
    homeContent.displayContent();
} else if (defaultpage == "instances") {
    instanceButton.setSelected();
    instanceContent.displayContent();
} else if (defaultpage == "discover") {
    setTimeout(() => {
        discoverButton.setSelected();
        worldContent.displayContent();
    }, 0);
} else if (defaultpage == "wardrobe") {
    wardrobeButton.setSelected();
    wardrobeContent.displayContent();
}

async function applyCape(profile, cape) {
    try {
        let res = await window.electronAPI.setCape(profile, cape ? cape.cape_id : null);
        profile.setAccessToken(res.player_info.access_token);
        profile.setClientId(res.player_info.client_id);
        profile.setExpires(res.player_info.expires);
        profile.setName(res.player_info.name);
        profile.setRefreshToken(res.player_info.refresh_token);
        profile.setUuid(res.player_info.uuid);
        profile.setXuid(res.player_info.xuid);
        profile.setIsDemo(res.player_info.is_demo);
        await updateSkinsAndCapes(res.skin_info);
        displaySuccess(translate("app.wardrobe.cape.change"));
        return true;
    } catch (e) {
        displayError(e.message);
        return false;
    }
}

async function applySkin(profile, skin) {
    try {
        let res = await window.electronAPI.setSkin(profile, skin.skin_id, skin.model == "wide" ? "classic" : "slim");
        profile.setAccessToken(res.player_info.access_token);
        profile.setClientId(res.player_info.client_id);
        profile.setExpires(res.player_info.expires);
        profile.setName(res.player_info.name);
        profile.setRefreshToken(res.player_info.refresh_token);
        profile.setUuid(res.player_info.uuid);
        profile.setXuid(res.player_info.xuid);
        profile.setIsDemo(res.player_info.is_demo);
        await updateSkinsAndCapes(res.skin_info);
        console.log(res.skin_info.skins[0]);
        accountSwitcher.reloadHeads();
        displaySuccess(translate("app.wardrobe.skin.change"));
        return true;
    } catch (e) {
        displayError(e.message);
        return false;
    }
}

async function applySkinFromURL(profile, skin) {
    try {
        let res = await window.electronAPI.setSkinFromURL(profile, "https://textures.minecraft.net/texture/" + skin.texture_key, skin.model == "wide" ? "classic" : "slim");
        profile.setAccessToken(res.player_info.access_token);
        profile.setClientId(res.player_info.client_id);
        profile.setExpires(res.player_info.expires);
        profile.setName(res.player_info.name);
        profile.setRefreshToken(res.player_info.refresh_token);
        profile.setUuid(res.player_info.uuid);
        profile.setXuid(res.player_info.xuid);
        profile.setIsDemo(res.player_info.is_demo);
        await updateSkinsAndCapes(res.skin_info);
        console.log(res.skin_info.skins[0]);
        accountSwitcher.reloadHeads();
        displaySuccess(translate("app.wardrobe.skin.change"));
        return true;
    } catch (e) {
        displayError(e.message);
        return false;
    }
}

async function updateSkinsAndCapes(skin_and_cape_data) {
    if (!skin_and_cape_data.capes) return;
    if (!skin_and_cape_data.skins) return;
    if (!skin_and_cape_data.uuid && !skin_and_cape_data.id) return;
    if (!skin_and_cape_data.uuid) skin_and_cape_data.uuid = skin_and_cape_data.id;
    let profile = data.getProfileFromUUID(skin_and_cape_data.uuid);
    try {
        for (const e of skin_and_cape_data.capes) {
            await window.electronAPI.downloadCape(e.url, e.id);
            let cape = profile.addCape(e.alias, e.id, e.url);
            if (e.state == "ACTIVE") cape.setActive();
            else cape.removeActive();
        }
    } catch (e) {
        displayError(translate("app.wardrobe.cape.cache.fail"));
    }
    try {
        for (const e of skin_and_cape_data.skins) {
            let hash = await window.electronAPI.downloadSkin(e.url);
            let skin = data.addSkin(translate("app.wardrobe.unnamed"), e.variant == "CLASSIC" ? "wide" : "slim", "", hash.hash, hash.dataUrl, false);
            if (e.state == "ACTIVE") skin.setActive(skin_and_cape_data.uuid);
            else skin.removeActive(skin_and_cape_data.uuid);
        }
    } catch (e) {
        displayError(translate("app.wardrobe.skin.cache.fail"));
        console.error(e);
    }
    if (skin_and_cape_data.name) {
        profile.setName(skin_and_cape_data.name);
    }
}

document.getElementsByClassName("toasts")[0].showPopover();

function duplicateInstance(instanceInfo) {
    instanceInfo = instanceInfo.refresh();
    let dialog = new Dialog();
    if (!instanceInfo.mc_installed || instanceInfo.installing) {
        dialog.showDialog(translate("app.instances.duplicate.title", "%i", instanceInfo.name), "notice", translate("app.instances.duplicate.installing.notice"), [
            {
                "type": "cancel",
                "content": translate("app.instances.duplicate.close")
            }
        ], [], () => { });
        return;
    }
    dialog.showDialog(translate("app.instances.duplicate.title", "%i", instanceInfo.name), "form", [
        {
            "type": "image-upload",
            "default": instanceInfo.image,
            "id": "icon",
            "name": translate("app.instances.icon")
        },
        {
            "type": "text",
            "default": translate("app.instances.duplicate.new_name", "%i", instanceInfo.name),
            "id": "name",
            "name": translate("app.instances.name"),
            "maxlength": 50
        },
        {
            "type": "notice",
            "content": translate("app.instances.duplicate.notice")
        }
    ], [
        {
            "type": "cancel",
            "content": translate("app.instances.duplicate.cancel")
        },
        {
            "type": "confirm",
            "content": translate("app.instances.duplicate.confirm")
        }
    ], [], async (v) => {
        log.setData([
            {
                "title": translate("app.instances.duplicate.log.title"),
                "progress": 0,
                "desc": translate("app.instances.duplicate.log.start")
            }
        ]);
        let info = {};
        v.forEach(e => info[e.id] = e.value);
        let new_instance_id = window.electronAPI.getInstanceFolderName(info.name);
        try {
            let success = await window.electronAPI.duplicateInstanceFiles(instanceInfo.instance_id, new_instance_id);
            let oldContent = instanceInfo.getContent();
            if (!success) throw new Error();
            let newInstance = data.addInstance(
                info.name,
                new Date(),
                new Date(),
                "",
                instanceInfo.loader,
                instanceInfo.vanilla_version,
                instanceInfo.loader_version,
                instanceInfo.locked,
                instanceInfo.downloaded,
                instanceInfo.group,
                info.icon,
                new_instance_id,
                0,
                instanceInfo.install_source,
                instanceInfo.install_id,
                false,
                true
            );
            newInstance.setInstalledVersion(instanceInfo.installed_version);
            for (let c of oldContent) {
                newInstance.addContent(
                    c.name,
                    c.author,
                    c.image,
                    c.file_name,
                    c.source,
                    c.type,
                    c.version,
                    c.source_info,
                    c.disabled,
                    c.version_id
                );
            }
            showSpecificInstanceContent(newInstance);
        } catch (e) {
            displayError(translate("app.instances.duplicate.fail"));
            throw e;
        }
    })
}

async function getRecentlyPlayedWorlds() {
    let all_servers = await window.electronAPI.getAllServers(data.getInstances().map(e => e.instance_id));
    all_servers = all_servers.map(server => ({
        ...server,
        "last_played": getServerLastPlayed(server.instance_id, server.ip)
    }))
    let last_played_worlds = window.electronAPI.getRecentlyPlayedWorlds(data.getInstances().map(e => e.instance_id));
    let all = last_played_worlds.concat(all_servers);
    all.sort((a, b) => b.last_played - a.last_played);
    return all.slice(0, 5);
}

function getRecentlyPlayedInstances() {
    let instances = db.prepare("SELECT * FROM instances").all();
    instances.sort((a, b) => new Date(b.last_played) - new Date(a.last_played));
    return instances.slice(0, 5).map(e => new Instance(e.instance_id));
}

function getPinnedInstances() {
    let instances = db.prepare("SELECT * FROM pins WHERE type = ?").all("instance");
    return instances.map(e => {
        try {
            return new Instance(e.instance_id)
        } catch (f) {
            unpinInstance({ "instance_id": e.instance_id }, true);
            return null;
        }
    }).filter(e => e);
}
async function getPinnedWorlds() {
    return (await window.electronAPI.getPinnedWorlds());
}
function pinInstance(instanceInfo) {
    db.prepare("INSERT INTO pins (type, instance_id) VALUES (?, ?)").run("instance", instanceInfo.instance_id);
    displaySuccess(translate("app.instances.pin.success"));
}
function unpinInstance(instanceInfo, dontDisplay) {
    db.prepare("DELETE FROM pins WHERE type = ? AND instance_id = ?").run("instance", instanceInfo.instance_id);
    if (!dontDisplay) displaySuccess(translate("app.instances.unpin.success"));
}
function pinSingleplayerWorld(world_id, instance_id) {
    db.prepare("INSERT INTO pins (type, instance_id, world_id, world_type) VALUES (?, ?, ?, ?)").run("world", instance_id, world_id, "singleplayer");
    displaySuccess(translate("app.worlds.pin.success"));
}
function unpinSingleplayerWorld(world_id, instance_id) {
    db.prepare("DELETE FROM pins WHERE type = ? AND instance_id = ? AND world_id = ? AND world_type = ?").run("world", instance_id, world_id, "singleplayer");
    displaySuccess(translate("app.worlds.unpin.success"));
}
function pinMultiplayerWorld(ip, instance_id) {
    db.prepare("INSERT INTO pins (type, instance_id, world_id, world_type) VALUES (?, ?, ?, ?)").run("world", instance_id, ip, "multiplayer");
    displaySuccess(translate("app.worlds.pin.success"));
}
function unpinMultiplayerWorld(ip, instance_id) {
    db.prepare("DELETE FROM pins WHERE type = ? AND instance_id = ? AND world_id = ? AND world_type = ?").run("world", instance_id, ip, "multiplayer");
    displaySuccess(translate("app.worlds.unpin.success"));
}
function isWorldPinned(world_id, instance_id, world_type) {
    let world = db.prepare("SELECT * FROM pins WHERE world_id = ? AND instance_id = ? AND world_type = ?").get(world_id, instance_id, world_type);
    return Boolean(world);
}

async function getModpackVersions(source, content_id) {
    if (source == "modrinth") {
        let versions_pre_json = await fetch(`https://api.modrinth.com/v2/project/${content_id}/version`);
        let versions = await versions_pre_json.json();
        return versions.map(e => ({ "name": e.name, "value": e.id, "pass": e }));
    } else if (source == "curseforge") {
        let versions = await window.electronAPI.getAllCurseforgeFiles(content_id);
        return versions.map(e => ({ "name": e.displayName, "value": e.id.toString() + ".0", "pass": e }));
    }
}

let contentInfoHistory = [];
let contentInfoIndex = 0;

async function displayContentInfo(content_source, content_id, instance_id, vanilla_version, loader, locked, disableAddToHistory = false, content_list_to_update, infoData, pt) {
    if (!content_source) return;
    if (!disableAddToHistory) {
        if (contentInfo.open) {
            contentInfoHistory = contentInfoHistory.slice(0, contentInfoIndex + 1);
            contentInfoHistory.push({ "content_source": content_source, "content_id": content_id, "info_data": infoData, "project_type": pt });
            contentInfoIndex++;
        } else {
            contentInfoHistory = [{ "content_source": content_source, "content_id": content_id, "info_data": infoData, "project_type": pt }];
            contentInfoIndex = 0;
        }
    }
    let instance_content = [];
    if (instance_id) instance_content = (new Instance(instance_id)).getContent();

    contentInfo.innerHTML = "";
    contentInfo.showModal();
    let dialogContextMenu = new ContextMenu();
    contentInfo.onscroll = () => {
        dialogContextMenu.hideContextMenu();
    }
    contentInfo.appendChild(dialogContextMenu.element);
    let contentWrapper = document.createElement("div");
    contentWrapper.className = "content-wrapper";
    let contentNav = document.createElement("div");
    contentNav.className = "content-nav";
    contentWrapper.appendChild(contentNav);
    let buttonBack = document.createElement("button");
    buttonBack.innerHTML = '<i class="fa-solid fa-arrow-left"></i>';
    buttonBack.className = "content-nav-button";
    if (contentInfoIndex <= 0) {
        buttonBack.classList.add("disabled");
    } else {
        buttonBack.onclick = () => {
            contentInfoIndex--;
            displayContentInfo(contentInfoHistory[contentInfoIndex].content_source, contentInfoHistory[contentInfoIndex].content_id, instance_id, vanilla_version, loader, locked, true, null, contentInfoHistory[contentInfoIndex].info_data, contentInfoHistory[contentInfoIndex].project_type);
        }
    }
    contentNav.appendChild(buttonBack);
    let buttonForward = document.createElement("button");
    buttonForward.innerHTML = '<i class="fa-solid fa-arrow-right"></i>';
    buttonForward.className = "content-nav-button";
    if (contentInfoIndex >= contentInfoHistory.length - 1) {
        buttonForward.classList.add("disabled");
    } else {
        buttonForward.onclick = () => {
            contentInfoIndex++;
            displayContentInfo(contentInfoHistory[contentInfoIndex].content_source, contentInfoHistory[contentInfoIndex].content_id, instance_id, vanilla_version, loader, locked, true, contentInfoHistory[contentInfoIndex].info_data, contentInfoHistory[contentInfoIndex].project_type);
        }
    }
    contentNav.appendChild(buttonForward);
    let contentX = document.createElement("button");
    contentX.innerHTML = '<i class="fa-solid fa-xmark"></i>';
    contentX.className = "content-x";
    contentX.onclick = () => {
        contentInfo.close();
    }
    contentNav.appendChild(contentX);
    contentInfo.appendChild(contentWrapper);
    let loading = new LoadingContainer();
    loading.className = "loading-container";
    loading.element.style.height = "100%";
    contentWrapper.appendChild(loading.element);

    let content = {};
    if (content_source == "modrinth") {
        let mr_content, team_members, versions;
        try {
            let content_pre_json = await fetch(`https://api.modrinth.com/v2/project/${content_id}`);
            mr_content = await content_pre_json.json();
            let team_members_pre_json = await fetch(`https://api.modrinth.com/v2/project/${content_id}/members`);
            team_members = await team_members_pre_json.json();
            let versions_pre_json = await fetch(`https://api.modrinth.com/v2/project/${content_id}/version`);
            versions = await versions_pre_json.json();
        } catch (e) {
            loading.errorOut(e, () => {
                displayContentInfo(content_source, content_id, instance_id, vanilla_version, loader, locked, true);
            });
            return;
        }
        content = mr_content;
        content.author = "";
        team_members.forEach(e => {
            if (e.role == "Owner" || e.role == "Lead developer" || e.role == "Project Lead") {
                content.author = e.user.username;
            }
        });
        content.urls = {};
        content.urls.source = mr_content.source_url;
        content.urls.issues = mr_content.issues_url;
        content.urls.wiki = mr_content.wiki_url;
        content.urls.discord = mr_content.discord_url;
        content.urls.donations = mr_content.donation_urls;
        content.urls.browser = `https://modrinth.com/project/${content.id}`
        content.description = mr_content.body;
        content.versions = versions.map(e => ({ ...e, "original_version_info": e }));
        content.combine_versions_and_loaders = false;
        content.authors = team_members.map(e => ({ ...e, "browser_url": `https://modrinth.com/user/${e.user.id}` }));
        content.source = "modrinth";
        content.display_source = "Modrinth";
    } else if (content_source == "curseforge" && pt == "server") {
        content = {
            "icon_url": infoData.favicon,
            "title": infoData.name,
            "project_type": "server",
            "downloads": 0,
            "online_players": infoData.latestPing.online,
            "total_players": infoData.latestPing.total,
            "source": "curseforge",
            "updated": infoData.latestPing.pingedAt,
            "author": "",
            "loaders": [],
            "game_versions": [],
            "id": infoData.serverConnection,
            "urls": {
                "browser": `https://www.curseforge.com/servers/minecraft/game/${infoData.slug}`,
                "discord": `https://discord.gg/${infoData.discord}`,
                "twitter": infoData.twitter ? `https://twitter.com/${infoData.twitter}` : null
            },
            "description": infoData.description,
            "authors": [],
            "gallery": [],
            "convert_version_ids_to_numbers": true,
            "display_source": "CurseForge"
        }
    } else if (content_source == "curseforge") {
        let cf_content, description, versions;
        try {
            if (content_id.toString().includes(":")) {
                let id_split = content_id.split(":")
                let content_pre_json = await fetch(`https://api.curse.tools/v1/cf/mods/search?gameId=432&slug=${id_split[0]}&classId=${id_split[1]}`);
                cf_content = await content_pre_json.json();
                content_id = cf_content.data[0].id;
                cf_content = {
                    "data": cf_content.data[0]
                }
            } else {
                let content_pre_json = await fetch(`https://api.curse.tools/v1/cf/mods/${content_id}`);
                cf_content = await content_pre_json.json();
            }
            let description_pre_json = await fetch(`https://api.curse.tools/v1/cf/mods/${content_id}/description`);
            description = await description_pre_json.json();
            versions = await window.electronAPI.getAllCurseforgeFiles(content_id);
            if (versions.data) versions = versions.data;
        } catch (e) {
            loading.errorOut(e, () => {
                displayContentInfo(content_source, content_id, instance_id, vanilla_version, loader, locked, true);
            });
            return;
        }
        let project_type = "mod";
        if (cf_content.data.classId == 6) {
            project_type = "mod";
        } else if (cf_content.data.classId == 4471) {
            project_type = "modpack"
        } else if (cf_content.data.classId == 12) {
            project_type = "resourcepack";
        } else if (cf_content.data.classId == 6552) {
            project_type = "shader"
        } else if (cf_content.data.classId == 17) {
            project_type = "world";
        } else if (cf_content.data.classId == 6945) {
            project_type = "datapack"
        }
        content = {
            "icon_url": cf_content.data.logo.thumbnailUrl,
            "title": cf_content.data.name,
            "project_type": project_type,
            "downloads": cf_content.data.downloadCount,
            "source": "curseforge",
            "updated": cf_content.data.dateModified,
            "author": cf_content.data.authors[0].name,
            "loaders": [],
            "game_versions": [],
            "id": cf_content.data.id,
            "urls": {
                "source": cf_content.data.links.sourceUrl,
                "wiki": cf_content.data.links.wikiUrl,
                "issues": cf_content.data.links.issuesUrl,
                "browser": cf_content.data.links.websiteUrl
            },
            "description": description.data,
            "versions": versions.map(e => ({
                "game_versions": e.gameVersions,
                "version_number": e.id,
                "name": e.displayName,
                "loaders": [],
                "date_published": e.dateCreated,
                "downloads": e.totalDownloads,
                "original_version_info": e,
                "changelog": "",
                "version_type": ["", "release", "beta", "alpha"][e.releaseType],
                "id": e.id,
                "is_curseforge_changelog": true
            })),
            "combine_versions_and_loaders": true,
            "authors": cf_content.data.authors.map(e => ({
                "user": {
                    "bio": "",
                    "avatar_url": e.avatarUrl,
                    "username": e.name,
                    "id": e.id
                },
                "role": "",
                "browser_url": e.url
            })),
            "gallery": cf_content.data.screenshots.map(e => ({
                "url": e.thumbnailUrl,
                "raw_url": e.url,
                "title": e.title,
                "description": e.description
            })),
            "convert_version_ids_to_numbers": true,
            "display_source": "CurseForge"
        }
    }
    loading.element.remove();

    let topBar = document.createElement("div");
    topBar.classList.add("content-top");
    let contentImage = document.createElement("img");
    contentImage.classList.add("content-top-image");
    contentImage.src = content.icon_url ? content.icon_url : "default.png";
    topBar.appendChild(contentImage);
    let contentTopInfo = document.createElement("div");
    contentTopInfo.classList.add("content-top-info");
    let contentTopTitle = document.createElement("h1");
    contentTopTitle.innerHTML = sanitize(content.title);
    contentTopTitle.classList.add("content-top-title");
    contentTopInfo.appendChild(contentTopTitle);
    let contentTopSubInfo = document.createElement("div");
    contentTopSubInfo.classList.add("content-top-sub-info");
    let contentTopType = document.createElement("div");
    contentTopType.classList.add("content-top-sub-info-specific");
    let type = translate("app.content.mod");
    if (content.project_type == "modpack") type = translate("app.content.modpack");
    if (content.project_type == "resourcepack") type = translate("app.content.resource_pack");
    if (content.project_type == "shader") type = translate("app.content.shader");
    if (content.project_type == "datapack") type = translate("app.content.data_pack");
    if (content.project_type == "world") type = translate("app.content.world");
    if (content.project_type == "server") type = translate("app.content.server");
    contentTopType.innerHTML = `<i class="fa-solid fa-gamepad"></i>${type}`;
    let contentTopDownloads = document.createElement("div");
    contentTopDownloads.classList.add("content-top-sub-info-specific");
    if (content.online_players) {
        contentTopDownloads.innerHTML = `<i class="fa-solid fa-signal"></i>${translate("app.discover.online_count", "%o", content.online_players, "%t", content.total_players)}`;
    } else if (content.total_players == 0) {
        contentTopDownloads.innerHTML = `<i class="fa-solid fa-signal"></i>${translate("app.discover.server.offline")}`;
    } else {
        contentTopDownloads.innerHTML = `<i class="fa-solid fa-download"></i>${translate("app.discover.download_count", "%d", formatNumber(content.downloads))}`;
    }
    let contentTopLastUpdated = document.createElement("div");
    contentTopLastUpdated.classList.add("content-top-sub-info-specific");
    contentTopLastUpdated.innerHTML = `<i class="fa-solid fa-calendar-days"></i>${sanitize(formatDate(content.updated))}`;
    contentTopLastUpdated.setAttribute("title", translate("app.discover.last_updated"));
    let contentTopSource = document.createElement("div");
    contentTopSource.classList.add("content-top-sub-info-specific");
    contentTopSource.innerHTML = `${sanitize(content.display_source)}`;
    contentTopSource.classList.add(content.source);
    contentTopSubInfo.appendChild(contentTopType);
    contentTopSubInfo.appendChild(contentTopDownloads);
    contentTopSubInfo.appendChild(contentTopLastUpdated);
    contentTopSubInfo.appendChild(contentTopSource);
    contentTopInfo.appendChild(contentTopSubInfo);
    topBar.appendChild(contentTopInfo);
    let installButton = document.createElement("button");
    installButton.className = "content-top-install-button";
    installButton.innerHTML = '<i class="fa-solid fa-download"></i>' + translate("app.discover.install");
    installButton.onclick = () => {
        installButtonClick(content.project_type, content.source, content.loaders, content.icon_url, content.title, content.author, content.game_versions, content.id, instance_id, installButton, contentInfo, null);
    }
    let threeDots = document.createElement("button");
    threeDots.classList.add("content-top-more");
    threeDots.innerHTML = '<i class="fa-solid fa-ellipsis-vertical"></i>';
    let links = [];
    if (content.urls.source) {
        links.push({
            "icon": '<i class="fa-solid fa-code"></i>',
            "title": translate("app.discover.view.source"),
            "func": (e) => {
                window.electronAPI.openInBrowser(content.urls.source);
            }
        })
    }
    if (content.urls.wiki) {
        links.push({
            "icon": '<i class="fa-solid fa-book-atlas"></i>',
            "title": translate("app.discover.view.wiki"),
            "func": (e) => {
                window.electronAPI.openInBrowser(content.urls.wiki);
            }
        })
    }
    if (content.urls.issues) {
        links.push({
            "icon": '<i class="fa-solid fa-bug"></i>',
            "title": translate("app.discover.view.issues"),
            "func": (e) => {
                window.electronAPI.openInBrowser(content.urls.issues);
            }
        })
    }
    if (content.urls.discord) {
        links.push({
            "icon": '<i class="fa-brands fa-discord"></i>',
            "title": translate("app.discover.view.discord"),
            "func": (e) => {
                window.electronAPI.openInBrowser(content.urls.discord);
            }
        })
    }
    if (content.urls.twitter) {
        links.push({
            "icon": '<i class="fa-brands fa-twitter"></i>',
            "title": translate("app.discover.view.twitter"),
            "func": (e) => {
                window.electronAPI.openInBrowser(content.urls.twitter);
            }
        })
    }
    if (content.urls.donations) {
        content.urls.donations.forEach(e => {
            links.push({
                "icon": '<i class="fa-solid fa-hand-holding-dollar"></i>',
                "title": e.platform == "Other" ? translate("app.discover.donate") : translate("app.discover.donate.platform", "%p", e.platform),
                "func": () => {
                    window.electronAPI.openInBrowser(e.url);
                }
            })
        });
    }
    let buttons = new ContextMenuButtons([
        {
            "icon": '<i class="fa-solid fa-arrow-up-right-from-square"></i>',
            "title": translate("app.discover.open_in_browser"),
            "func": (e) => {
                window.electronAPI.openInBrowser(content.urls.browser);
            }
        }
    ].concat(links));
    let moreMenu = new MoreMenu(threeDots, buttons);
    if (content.project_type != "modpack" || !instance_id) topBar.appendChild(installButton);
    else threeDots.style.marginLeft = "auto";
    topBar.appendChild(threeDots);
    topBar.appendChild(moreMenu.element);
    contentWrapper.appendChild(topBar);
    let content_ids = instance_content.map(e => e.source_info);
    if (content.convert_version_ids_to_numbers) content_ids = content_ids.map(Number);
    if (content_ids.includes(content.id)) {
        installButton.innerHTML = '<i class="fa-solid fa-check"></i>Installed';
        installButton.classList.add("disabled");
        installButton.onclick = () => { };
        installedVersion = instance_content[content_ids.indexOf(content.id)].version_id;
    }

    let tabsElement = document.createElement("div");
    contentWrapper.appendChild(tabsElement);
    let tabContent = document.createElement("div");
    tabContent.className = "tab-info";
    tabContent.style.padding = "10px";
    contentWrapper.appendChild(tabContent);
    contentInfo.showModal();
    tabsElement.style.marginInline = "auto";
    let tabs = new TabContent(tabsElement, [
        {
            "name": translate("app.discover.tabs.description"),
            "value": "description",
            "func": () => {
                tabContent.style.paddingTop = "10px";
                tabContent.innerHTML = "";
                let element = document.createElement("div");
                element.className = "markdown-body";
                element.style.maxWidth = "700px";
                element.style.marginInline = "auto";
                tabContent.appendChild(element);
                element.innerHTML = parseModrinthMarkdown(content.description);
                afterMarkdownParse(instance_id, vanilla_version, loader, dialogContextMenu, locked);
            }
        },
        content.versions?.length ? {
            "name": translate("app.discover.tabs.files"),
            "value": "files",
            "func": () => {
                let installedVersion = "";
                if (instance_id) instance_content = (new Instance(instance_id)).getContent();
                content_ids = instance_content.map(e => e.source_info);
                if (content.convert_version_ids_to_numbers) content_ids = content_ids.map(Number);
                if (content_ids.includes(content.id)) {
                    installButton.innerHTML = '<i class="fa-solid fa-check"></i>Installed';
                    installButton.classList.add("disabled");
                    installButton.onclick = () => { };
                    installedVersion = instance_content[content_ids.indexOf(content.id)].version_id;
                }
                if (content.project_type == "modpack" && instance_id) {
                    installedVersion = new Instance(instance_id).installed_version;
                }
                if (content.convert_version_ids_to_numbers) installedVersion = Number(installedVersion);

                tabContent.innerHTML = "";
                let topFilters = document.createElement("div");
                topFilters.className = "version-file-filters";
                let mcVersionFilter = document.createElement("div");
                let allGameVersions = Array.from(
                    new Set(
                        content.versions.flatMap(v => v.game_versions)
                    )
                );
                if (Array.isArray(minecraftVersions) && minecraftVersions.length > 0) {
                    allGameVersions.sort((a, b) => {
                        const ia = minecraftVersions.indexOf(a);
                        const ib = minecraftVersions.indexOf(b);
                        if (ia === -1 && ib === -1) return 0;
                        if (ia === -1) return -1;
                        if (ib === -1) return 1;
                        return ia - ib;
                    });
                    allGameVersions.reverse();
                }

                if (content.combine_versions_and_loaders) {
                    allGameVersions = allGameVersions.filter(e => minecraftVersions.includes(e));
                }

                let versionDropdown = new DialogDropdown(
                    translate("app.discover.game_version"),
                    [{ "name": translate("app.discover.game_version.all"), "value": "all" }].concat(
                        allGameVersions.map(e => ({ "name": e, "value": e }))
                    ),
                    mcVersionFilter,
                    vanilla_version ? vanilla_version : "all",
                    (v) => {
                        filterVersions(v, loaderDropdown.value, channelDropdown.value, 1);
                    }
                );
                let mcLoaderFilter = document.createElement("div");
                let allLoaders = Array.from(
                    new Set(
                        content.versions.flatMap(v => v.loaders)
                    )
                );
                if (content.combine_versions_and_loaders) {
                    allLoaders = Array.from(
                        new Set(
                            content.versions.flatMap(v => v.game_versions)
                        )
                    );
                    allLoaders = allLoaders.filter(e => loaders[e.toLowerCase()]);
                    allLoaders = allLoaders.map(e => e.toLowerCase());
                }
                let loaderDropdown = new SearchDropdown(translate("app.discover.loader"),
                    [{
                        "name": translate("app.discover.loader.all"),
                        "value": "all"
                    }].concat(allLoaders.map(e => ({ "name": loaders[e] ? loaders[e] : e, "value": e }))),
                    mcLoaderFilter, loader ? loader : "all", (v) => {
                        filterVersions(versionDropdown.value, v, channelDropdown.value, 1);
                    })
                let channelFilter = document.createElement("div");
                let channelDropdown = new SearchDropdown(translate("app.discover.channel"), [
                    {
                        "name": translate("app.discover.channel.all"),
                        "value": "all"
                    },
                    {
                        "name": translate("app.discover.channel.release"),
                        "value": "release"
                    },
                    {
                        "name": translate("app.discover.channel.beta"),
                        "value": "beta"
                    },
                    {
                        "name": translate("app.discover.channel.alpha"),
                        "value": "alpha"
                    }
                ], channelFilter, "all", (v) => {
                    filterVersions(versionDropdown.value, loaderDropdown.value, v, 1);
                });

                let pages = Math.ceil(content.versions.length / 25);

                let pagination = new Pagination(1, pages, (new_page) => {
                    filterVersions(versionDropdown.value, loaderDropdown.value, channelDropdown.value, new_page);
                });

                topFilters.appendChild(mcVersionFilter);
                if (["modpack", "mod"].includes(content.project_type)) topFilters.appendChild(mcLoaderFilter);
                topFilters.appendChild(channelFilter);

                pagination.element.style.gridColumn = "-1";

                topFilters.appendChild(pagination.element);
                tabContent.appendChild(topFilters);
                let wrapper = document.createElement("div");
                wrapper.className = "version-files-wrapper";
                let topBar = document.createElement("div");
                topBar.className = "version-file-top";
                let names = content.combine_versions_and_loaders ? ["", translate("app.discover.files.name"), translate("app.discover.files.version_loaders"), translate("app.discover.files.date_published"), translate("app.discover.files.download_count"), "", ""] : ["", translate("app.discover.files.name"), translate("app.discover.files.versions"), translate("app.discover.files.loaders"), translate("app.discover.files.date_published"), translate("app.discover.files.download_count"), "", ""];
                names.forEach((e, i) => {
                    let element = document.createElement("div");
                    element.className = "version-file-column-name";
                    element.innerHTML = e;
                    if (content.combine_versions_and_loaders && i == 2) {
                        element.style.gridColumn = "span 2";
                    }
                    topBar.appendChild(element);
                });

                let notfound = new NoResultsFound();
                notfound.element.style.gridColumn = "span 8";
                notfound.element.style.display = "none";
                notfound.element.style.backgroundColor = "var(--color-1)"

                let versionInfo = [];

                let filterVersions = (version, loader_, channel, new_page) => {
                    pagination.setPage(new_page);
                    let count = 0;
                    versionInfo.forEach(e => {
                        if (!e.game_versions.includes(version) && version && version != "all") {
                            e.element.remove();
                            return;
                        }
                        if (loader_ && ((!content.combine_versions_and_loaders && !e.loaders.includes(loader_)) || (content.combine_versions_and_loaders && !e.game_versions.includes(loader_))) && (content.project_type == "mod" || content.project_type == "modpack") && loader_ != "all") {
                            e.element.remove();
                            return;
                        }
                        if (channel && e.channel != channel && channel != "all") {
                            e.element.remove();
                            return;
                        }
                        count++;
                        if (count <= (new_page * 25 - 25) || count > new_page * 25) {
                            e.element.remove();
                            return;
                        }
                        wrapper.appendChild(e.element);
                    });
                    pagination.setTotalPages(Math.ceil(count / 25));
                    if (count == 0) {
                        notfound.element.style.display = "";
                        topBar.style.display = "none";
                    } else {
                        notfound.element.style.display = "none";
                        topBar.style.display = "grid";
                    }
                }

                let installedVersionIndex = content.versions.findIndex(v => v.id === installedVersion);

                let showVersions = () => {
                    versionInfo = [];
                    wrapper.innerHTML = "";
                    wrapper.appendChild(topBar);
                    wrapper.appendChild(notfound.element);
                    content.versions.forEach((e, i) => {
                        let versionEle = document.createElement("div");
                        versionEle.className = "version-file";

                        // Channel
                        let channelEle = document.createElement("div");
                        channelEle.className = "version-file-channel";
                        channelEle.innerHTML = e.version_type.toUpperCase()[0];
                        if (e.version_type.toUpperCase()[0] == "R") {
                            channelEle.style.setProperty("--channel-color", "var(--go-color)");
                        } else if (e.version_type.toUpperCase()[0] == "B") {
                            channelEle.style.setProperty("--channel-color", "yellow");
                        } else if (e.version_type.toUpperCase()[0] == "A") {
                            channelEle.style.setProperty("--channel-color", "var(--danger-color)");
                        }
                        versionEle.appendChild(channelEle);

                        // Name
                        let nameInfo = document.createElement("div");
                        nameInfo.className = "version-file-info";
                        let nameName = document.createElement("div");
                        nameName.className = "version-file-title";
                        let nameDesc = document.createElement("div");
                        nameDesc.className = "version-file-desc";
                        nameName.innerHTML = e.version_number;
                        nameDesc.innerHTML = e.name;
                        nameInfo.appendChild(nameName);
                        nameInfo.appendChild(nameDesc);
                        versionEle.appendChild(nameInfo);

                        //Game Version
                        let tagWrapper = document.createElement("div");
                        tagWrapper.className = "version-file-chip-wrapper";
                        e.game_versions.forEach(i => {
                            let tag = document.createElement("div");
                            tag.className = "version-file-chip";
                            tag.innerHTML = i;
                            tagWrapper.appendChild(tag);
                        });
                        versionEle.appendChild(tagWrapper);
                        if (content.combine_versions_and_loaders) {
                            tagWrapper.style.gridColumn = "span 2";
                        }

                        if (!content.combine_versions_and_loaders) {
                            //Loaders
                            let tagWrapper2 = document.createElement("div");
                            tagWrapper2.className = "version-file-chip-wrapper";
                            e.loaders.forEach(i => {
                                let tag = document.createElement("div");
                                tag.className = "version-file-chip";
                                tag.innerHTML = loaders[i] ? loaders[i] : i;
                                tagWrapper2.appendChild(tag);
                            });
                            versionEle.appendChild(tagWrapper2);
                        }

                        //Published
                        let published = document.createElement("div");
                        published.className = "version-file-text";
                        published.innerHTML = formatDate(e.date_published);
                        versionEle.appendChild(published);

                        //Downloads
                        let downloads = document.createElement("div");
                        downloads.className = "version-file-text";
                        downloads.innerHTML = formatNumber(e.downloads);
                        versionEle.appendChild(downloads);

                        // Install Button
                        let installButton = document.createElement("button");
                        installButton.innerHTML = '<i class="fa-solid fa-download"></i>' + translate("app.discover.install");
                        installButton.setAttribute("title", translate("app.discover.install_specific_version"));
                        installButton.className = "version-file-install"
                        let updateToSpecificVersion = async () => {
                            if (content.project_type == "modpack") {
                                contentInfo.close();
                                runModpackUpdate(new Instance(instance_id), content.source, e.original_version_info);
                                return;
                            }
                            let instanceInfo = new Instance(instance_id);
                            let contentList = instanceInfo.getContent();
                            installButton.innerHTML = '<i class="spinner"></i>' + translate("app.instances.installing");
                            installButton.classList.add("disabled");
                            installButton.onclick = () => { };
                            let theContent = null;
                            for (let i = 0; i < contentList.length; i++) {
                                if (contentList[i].source_info == content.id || (content.convert_version_ids_to_numbers && Number(contentList[i].source_info) == Number(content.id))) {
                                    theContent = contentList[i];
                                }
                            }
                            if (!theContent) return;
                            await updateContent(instanceInfo, theContent, e.id);
                            installButton.innerHTML = '<i class="fa-solid fa-check"></i>' + translate("app.discover.installed");
                            if (content_list_to_update) content_list_to_update.updateSecondaryColumn();
                            if (instance_id) {
                                installedVersion = e.id;
                                if (content.convert_version_ids_to_numbers) installedVersion = Number(installedVersion);
                                installedVersionIndex = i;
                                showVersions();
                            }
                        }
                        if (installedVersion && installedVersionIndex > i) {
                            installButton.innerHTML = '<i class="fa-solid fa-download"></i>' + translate("app.discover.update");
                            installButton.setAttribute("title", translate("app.discover.update.tooltip"));
                            installButton.onclick = updateToSpecificVersion;
                        } else if (installedVersion && installedVersionIndex < i) {
                            installButton.innerHTML = '<i class="fa-solid fa-download"></i>' + translate("app.discover.downgrade");
                            installButton.setAttribute("title", translate("app.discover.downgrade.tooltip"));
                            installButton.onclick = updateToSpecificVersion;
                        } else {
                            installButton.onclick = () => {
                                installButtonClick(content.project_type, content.source, e.loaders, content.icon_url, content.title, content.author, e.game_versions, content_id, instance_id, installButton, contentInfo, e.original_version_info, () => {
                                    if (instance_id) {
                                        installedVersion = e.id;
                                        installedVersionIndex = i;
                                        showVersions();
                                    }
                                });
                            }
                        }

                        if (installedVersion == e.id) {
                            installButton.classList.add("disabled");
                            installButton.innerHTML = '<i class="fa-solid fa-check"></i>' + translate("app.discover.installed");
                            installButton.onclick = () => { };
                            installButton.setAttribute("title", translate("app.discover.installed.tooltip"));
                        } else if (locked) {
                            installButton.classList.add("disabled");
                            installButton.onclick = () => { };
                            installButton.setAttribute("title", translate("app.discover.locked.tooltip"));
                        }

                        versionEle.appendChild(installButton);

                        // Changelog Button
                        let changeLogButton = document.createElement("button");
                        changeLogButton.className = "version-file-changelog";
                        changeLogButton.innerHTML = '<i class="fa-solid fa-book"></i>' + translate("app.discover.changelog");
                        changeLogButton.setAttribute("title", translate("app.discover.changelog.tooltip"));
                        changeLogButton.onclick = () => {
                            let dialog = new Dialog();
                            if (e.is_curseforge_changelog) {
                                let element = document.createElement('div');
                                element.className = "markdown-body";
                                let loader = new LoadingContainer();
                                element.appendChild(loader.element);
                                dialog.showDialog(translate("app.discover.changelog.title", "%v", e.name), "notice", element, [
                                    {
                                        "type": "confirm",
                                        "content": translate("app.discover.changelog.done")
                                    }
                                ], [], () => { });
                                window.electronAPI.getCurseforgeChangelog(content_id, e.id, (v) => {
                                    element.innerHTML = v;
                                    afterMarkdownParse();
                                }, (err) => {
                                    loader.errorOut(err, () => {
                                        dialog.closeDialog();
                                        changeLogButton.click();
                                    });
                                });
                            } else {
                                dialog.showDialog(translate("app.discover.changelog.title", "%v", e.version_number), "notice", `<div class='markdown-body'>${parseModrinthMarkdown(e.changelog)}</div>`, [
                                    {
                                        "type": "confirm",
                                        "content": translate("app.discover.changelog.done")
                                    }
                                ], [], () => { });
                                afterMarkdownParse();
                            }
                        }
                        if (e.changelog || e.is_curseforge_changelog) versionEle.appendChild(changeLogButton);

                        wrapper.appendChild(versionEle);

                        versionInfo.push({ "element": versionEle, "loaders": e.loaders, "game_versions": e.game_versions.map(e => e.toLowerCase()), "channel": e.version_type })
                    });
                    filterVersions(versionDropdown.value, loaderDropdown.value, channelDropdown.value, 1);
                }

                showVersions();

                tabContent.appendChild(wrapper);
            }
        } : null,
        content.authors.length ? {
            "name": content.authors.length == 1 ? translate("app.discover.tabs.author") : translate("app.discover.tabs.authors"),
            "value": "authors",
            "func": () => {
                tabContent.style.paddingTop = "0";
                tabContent.innerHTML = "";
                let wrapper = document.createElement("div");
                wrapper.className = "authors-wrapper";
                let authors = document.createElement("div");
                authors.className = "authors";
                content.authors.forEach(e => {
                    let author = document.createElement("div");
                    author.className = "author";
                    if (e.user.bio) author.setAttribute("title", e.user.bio);
                    let authorImg = document.createElement("img");
                    authorImg.className = "author-image";
                    authorImg.src = e.user.avatar_url ? e.user.avatar_url : "default.png";
                    let authorInfo = document.createElement("div");
                    authorInfo.className = "author-info";
                    let authorTitle = document.createElement("div");
                    authorTitle.className = "author-title";
                    authorTitle.innerHTML = e.user.username;
                    let authorRole = document.createElement("div");
                    authorRole.className = "author-role";
                    authorRole.innerHTML = e.role;
                    authorInfo.appendChild(authorTitle);
                    authorInfo.appendChild(authorRole);
                    author.appendChild(authorImg);
                    author.appendChild(authorInfo);
                    let buttons = new ContextMenuButtons([
                        {
                            "icon": '<i class="fa-solid fa-arrow-up-right-from-square"></i>',
                            "title": translate("app.discover.author.open_in_browser"),
                            "func": () => {
                                window.electronAPI.openInBrowser(e.browser_url);
                            }
                        },
                        {
                            "icon": '<i class="fa-solid fa-copy"></i>',
                            "title": translate("app.discover.author.copy_user_id"),
                            "func": async () => {
                                let success = await window.electronAPI.copyToClipboard(e.user.id);
                                if (success) {
                                    displaySuccess(translate("app.discover.author.copy_user_id.success"));
                                } else {
                                    displayError(translate("app.discover.author.copy_user_id.fail"));
                                }
                            }
                        }
                    ]);
                    author.oncontextmenu = (e) => {
                        dialogContextMenu.showContextMenu(buttons, e.clientX, e.clientY);
                    }
                    authors.appendChild(author);
                });
                wrapper.appendChild(authors);
                tabContent.appendChild(wrapper);
            }
        } : null,
        content.gallery.length ? {
            "name": translate("app.discover.tabs.gallery"),
            "value": "gallery",
            "func": () => {
                tabContent.style.paddingTop = "0";
                tabContent.innerHTML = "";
                let gallery = document.createElement("div");
                gallery.className = "gallery";
                content.gallery.forEach(e => {
                    let screenshotElement = document.createElement("button");
                    screenshotElement.className = "gallery-screenshot";
                    screenshotElement.setAttribute("data-title", e.title ?? translate("app.discover.gallery.untitled"));
                    screenshotElement.style.backgroundImage = `url("${e.url}")`;
                    let screenshotInformation = content.gallery.map(e => ({ "name": e.title ?? translate("app.discover.gallery.untitled"), "file": e.raw_url, "desc": e.description }));
                    screenshotElement.onclick = () => {
                        displayScreenshot(e.title ?? translate("app.discover.gallery.untitled"), e.description, e.raw_url, null, null, screenshotInformation, screenshotInformation.map(e => e.file).indexOf(e.raw_url), translate("app.discover.gallery.image"));
                    }
                    let buttons = new ContextMenuButtons([
                        {
                            "icon": '<i class="fa-solid fa-copy"></i>',
                            "title": translate("app.discover.gallery.image.copy"),
                            "func": async () => {
                                let success = await window.electronAPI.copyImageToClipboard(e.raw_url);
                                if (success) {
                                    displaySuccess(translate("app.discover.gallery.image.copy.success"));
                                } else {
                                    displayError(translate("app.discover.gallery.image.copy.fail"));
                                }
                            }
                        },
                        {
                            "icon": '<i class="fa-solid fa-share"></i>',
                            "title": translate("app.discover.gallery.image.share"),
                            "func": () => {
                                openShareDialog(translate("app.discover.gallery.image.share.title"), e.raw_url, translate("app.discover.gallery.image.share.text"))
                            }
                        }
                    ]);
                    screenshotElement.oncontextmenu = (e) => {
                        dialogContextMenu.showContextMenu(buttons, e.clientX, e.clientY);
                    }
                    gallery.appendChild(screenshotElement);
                });
                tabContent.appendChild(gallery);
            }
        } : null
    ].filter(e => e))
    tabs.selectOption("description");

    document.getElementsByClassName("toasts")[0].hidePopover();
    document.getElementsByClassName("toasts")[0].showPopover();
}

function parseModrinthMarkdown(md) {
    return window.electronAPI.parseModrinthMarkdown(md);
}

function afterMarkdownParse(instance_id, vanilla_version, loader, dialogContextMenu, locked) {
    document.querySelectorAll('.markdown-body img').forEach((el) => {
        let src = el.getAttribute('src');
        if (!src) return;
        let buttons = new ContextMenuButtons([
            {
                "title": translate("app.discover.open_in_browser"),
                "icon": '<i class="fa-solid fa-arrow-up-right-from-square"></i>',
                "func": () => {
                    window.electronAPI.openInBrowser(src);
                }
            },
            {
                "title": translate("app.discover.copy_image"),
                "icon": '<i class="fa-solid fa-copy"></i>',
                "func": async () => {
                    let success = await window.electronAPI.copyImageToClipboard(src);
                    if (success) {
                        displaySuccess(translate("app.discover.copy_image.success"));
                    } else {
                        displayError(translate("app.discover.copy_image.fail"));
                    }
                }
            },
            {
                "title": translate("app.discover.copy_image_link"),
                "icon": '<i class="fa-solid fa-copy"></i>',
                "func": async () => {
                    let success = await window.electronAPI.copyToClipboard(src);
                    if (success) {
                        displaySuccess(translate("app.discover.copy_image_link.success"));
                    } else {
                        displayError(translate("app.discover.copy_image_link.fail"));
                    }
                }
            }
        ]);
        el.oncontextmenu = (e) => {
            dialogContextMenu.showContextMenu(buttons, e.clientX, e.clientY);
        }
    });
    document.querySelectorAll('.markdown-body a').forEach((el) => {
        let url = el.getAttribute('data-href');
        if (!url) {
            url = el.getAttribute('href');
            el.removeAttribute('href');
            el.setAttribute("tabindex", "0");
        }
        let buttons = new ContextMenuButtons([
            {
                "title": translate("app.discover.open_in_browser"),
                "icon": '<i class="fa-solid fa-arrow-up-right-from-square"></i>',
                "func": () => {
                    window.electronAPI.openInBrowser(url);
                }
            },
            {
                "title": translate("app.discover.copy"),
                "icon": '<i class="fa-solid fa-copy"></i>',
                "func": async () => {
                    let success = await window.electronAPI.copyToClipboard(url);
                    if (success) {
                        displaySuccess(translate("app.discover.copy.success"));
                    } else {
                        displayError(translate("app.discover.copy.fail"));
                    }
                }
            }
        ])
        if (url) {
            if (url[0] == "/") {
                url = "https://www.curseforge.com" + url;
            }
            try {
                let url_obj = new URL(url);
                if (url_obj.searchParams.get("remoteUrl")) {
                    url = decodeURIComponent(url_obj.searchParams.get("remoteUrl"));
                    url_obj = new URL(url);
                }

                if (dialogContextMenu && (url_obj.hostname == "modrinth.com" || url_obj.hostname == "www.modrinth.com")) {
                    let pathParts = url_obj.pathname.split('/').filter(Boolean);
                    if (pathParts.length >= 2) {
                        let pageType = pathParts[0];
                        let pageId = pathParts[1];
                        if (["mod", "datapack", "resourcepack", "shader", "modpack", "project"].includes(pageType)) {
                            el.setAttribute('title', url);
                            el.addEventListener('click', (e) => {
                                e.preventDefault();
                                displayContentInfo("modrinth", pageId, instance_id, vanilla_version, loader, locked);
                            });
                            el.addEventListener('keydown', (e) => {
                                if (e.key == "Enter" || e.key == " ") {
                                    e.preventDefault();
                                    displayContentInfo("modrinth", pageId, instance_id, vanilla_version, loader, locked);
                                }
                            });
                            el.oncontextmenu = (e) => {
                                dialogContextMenu.showContextMenu(buttons, e.clientX, e.clientY);
                            }
                            return;
                        }
                    }
                } else if (dialogContextMenu && (url_obj.hostname == "curseforge.com" || url_obj.hostname == "www.curseforge.com" || url_obj.hostname == "legacy.curseforge.com")) {
                    let pathParts = url_obj.pathname.split('/').filter(Boolean);
                    if (pathParts.length >= 2 && pathParts[0] == "minecraft") {
                        let pageType = pathParts[1];
                        let pageId = pathParts[2];
                        let map = {
                            "mc-mods": 6,
                            "data-packs": 6945,
                            "texture-packs": 12,
                            "shaders": 6552,
                            "modpacks": 4471,
                            "worlds": 17
                        }
                        if (["mc-mods", "data-packs", "texture-packs", "shaders", "modpacks", "worlds"].includes(pageType)) {
                            el.setAttribute('title', url);
                            el.addEventListener('click', (e) => {
                                e.preventDefault();
                                displayContentInfo("curseforge", pageId + ":" + map[pageType], instance_id, vanilla_version, loader, locked);
                            });
                            el.addEventListener('keydown', (e) => {
                                if (e.key == "Enter" || e.key == " ") {
                                    e.preventDefault();
                                    displayContentInfo("curseforge", pageId + ":" + map[pageType], instance_id, vanilla_version, loader, locked);
                                }
                            });
                            el.oncontextmenu = (e) => {
                                dialogContextMenu.showContextMenu(buttons, e.clientX, e.clientY);
                            }
                            return;
                        }
                    }
                }
                el.setAttribute('title', url);
            } catch (e) {
                el.setAttribute("tabindex", "-1");
            }
            el.addEventListener('click', (e) => {
                e.preventDefault();
                window.electronAPI.openInBrowser(url);
            });
            el.addEventListener('keydown', (e) => {
                if (e.key == "Enter" || e.key == " ") {
                    e.preventDefault();
                    window.electronAPI.openInBrowser(url);
                }
            });
            if (!dialogContextMenu) return;
            el.oncontextmenu = (e) => {
                dialogContextMenu.showContextMenu(buttons, e.clientX, e.clientY);
            }
        }
    });
}

document.addEventListener("mouseover", function (e) {
    let tooltip = document.getElementById("tooltip");
    if (!tooltip) return;
    let target = e.target;
    while (target && target !== document.body) {
        if (target.hasAttribute && target.hasAttribute("title")) {
            let title = target.getAttribute("title");
            if (title) {
                tooltip.textContent = title;
                tooltip.showPopover();
                const rect = target.getBoundingClientRect();
                let x = rect.left + (rect.width / 2);
                let y = rect.top - 7;
                tooltip.style.setProperty("--left", x + "px");
                tooltip.style.setProperty("--top", y + "px");
            }
            return;
        }
        target = target.parentElement;
    }
    tooltip.hidePopover();
});

document.addEventListener("mouseout", function (e) {
    let tooltip = document.getElementById("tooltip");
    if (!tooltip) return;
    tooltip.hidePopover();
});

document.addEventListener("focusin", function (e) {
    let tooltip = document.getElementById("tooltip");
    if (!tooltip) return;
    let target = e.target;
    while (target && target !== document.body) {
        if (target.hasAttribute && target.hasAttribute("title")) {
            let title = target.getAttribute("title");
            if (title) {
                tooltip.textContent = title;
                tooltip.showPopover();
                const rect = target.getBoundingClientRect();
                let x = rect.left + (rect.width / 2);
                let y = rect.top - 7;
                tooltip.style.setProperty("--left", x + "px");
                tooltip.style.setProperty("--top", y + "px");
            }
            return;
        }
        target = target.parentElement;
    }
    tooltip.hidePopover();
});

document.addEventListener("focusout", function (e) {
    let tooltip = document.getElementById("tooltip");
    if (!tooltip) return;
    tooltip.hidePopover();
});

document.addEventListener("mouseover", function (e) {
    let target = e.target;
    while (target && target !== document.body) {
        if (target.hasAttribute && target.hasAttribute("title")) {
            target.setAttribute("data-tooltip-title", target.getAttribute("title"));
            target.removeAttribute("title");
        }
        target = target.parentElement;
    }
});

document.addEventListener("mouseout", function (e) {
    let target = e.target;
    while (target && target !== document.body) {
        if (target.hasAttribute && target.hasAttribute("data-tooltip-title")) {
            target.setAttribute("title", target.getAttribute("data-tooltip-title"));
            target.removeAttribute("data-tooltip-title");
        }
        target = target.parentElement;
    }
});

document.addEventListener("scroll", function (e) {
    let tooltip = document.getElementById("tooltip");
    if (!tooltip) return;
    tooltip.hidePopover();
    contextmenu.hideContextMenu();
}, true);

async function addDesktopShortcut(instanceInfo) {
    let success = await window.electronAPI.createDesktopShortcut(instanceInfo.instance_id, instanceInfo.refresh().name, instanceInfo.refresh().image);
    if (success) {
        displaySuccess(translate("app.instances.shortcut.created"));
    } else {
        displayError(translate("app.instances.shortcut.failed"));
    }
}

async function addDesktopShortcutWorld(instanceInfo, worldName, worldType, worldId, worldImage) {
    let success = await window.electronAPI.createDesktopShortcut(instanceInfo.instance_id, worldName, worldImage, worldType, worldId);
    if (success) {
        displaySuccess(translate("app.worlds.shortcut.created"));
    } else {
        displayError(translate("app.worlds.shortcut.failed"));
    }
}

function openShareDialogForFile(file_path) {
    let shareWrapper = document.createElement("div");
    shareWrapper.className = "share-file-wrapper";
    let linkWrapper = document.createElement("div");
    linkWrapper.className = "share-link";
    let linkText = document.createElement("span");
    linkText.innerHTML = file_path;
    linkText.className = "share-link-text";
    linkWrapper.appendChild(linkText);
    let copyButton = document.createElement("button");
    copyButton.setAttribute("title", translate("app.share.copy_path"));
    copyButton.className = "share-link-copy";
    copyButton.innerHTML = '<i class="fa-solid fa-copy"></i>';
    copyButton.onclick = async () => {
        let success = await window.electronAPI.copyToClipboard(file_path);
        if (success) {
            displaySuccess(translate("app.share.copy_path.success"));
        } else {
            displayError(translate("app.share.copy_path.fail"));
        }
        copyButton.innerHTML = '<i class="fa-solid fa-check"></i>';
        setTimeout(() => {
            copyButton.innerHTML = '<i class="fa-solid fa-copy"></i>';
        }, 2000);
    }
    linkWrapper.appendChild(copyButton);
    shareWrapper.appendChild(linkWrapper);
    let links = document.createElement("div");
    links.className = "share-links";
    shareWrapper.appendChild(links);
    let linkList = [
        {
            "icon": '<i class="fa-solid fa-floppy-disk"></i>',
            "func": () => {
                window.electronAPI.saveToDisk(file_path);
            },
            "tooltip": translate("app.share.save")
        },
        {
            "icon": '<i class="fa-solid fa-folder"></i>',
            "func": () => {
                window.electronAPI.openFolderFromFile(file_path);
            },
            "tooltip": translate("app.share.folder")
        }
    ]
    linkList.forEach(e => {
        let linkElement = document.createElement("button");
        linkElement.className = "share-special-link";
        linkElement.innerHTML = e.icon;
        linkElement.setAttribute("title", e.tooltip);
        linkElement.onclick = e.func;
        links.appendChild(linkElement);
    });
    let dialog = new Dialog();
    dialog.showDialog(translate("app.share.title.file"), "notice", shareWrapper, [
        {
            "type": "confirm",
            "content": translate("app.share.close")
        }
    ], [], () => { });
}

async function openShareDialog(title, url, text) {
    let shareWrapper = document.createElement("div");
    shareWrapper.className = "share-wrapper";
    let qrCodeUrl = await window.electronAPI.generateQRCode(url);
    let qrCodeWrapper = document.createElement("button");
    qrCodeWrapper.className = "share-qrcode-wrapper";
    let qrCode = document.createElement("img");
    qrCode.className = "share-qrcode";
    qrCode.src = qrCodeUrl;
    qrCodeWrapper.appendChild(qrCode);
    let largeQrCode = document.createElement("img");
    largeQrCode.className = "large-qrcode";
    largeQrCode.src = qrCodeUrl;
    qrCodeWrapper.onclick = () => {
        let dialog = new Dialog();
        dialog.showDialog(translate("app.share.qr_code"), "notice", largeQrCode, [
            {
                "type": "confirm",
                "content": translate("app.share.qr_code.done")
            }
        ], [], () => { })
    }
    shareWrapper.appendChild(qrCodeWrapper);
    let linkWrapper = document.createElement("div");
    linkWrapper.className = "share-link";
    let linkText = document.createElement("span");
    linkText.innerHTML = url;
    linkText.className = "share-link-text";
    linkWrapper.appendChild(linkText);
    let copyButton = document.createElement("button");
    copyButton.setAttribute("title", translate("app.share.copy_link"));
    copyButton.className = "share-link-copy";
    copyButton.innerHTML = '<i class="fa-solid fa-copy"></i>';
    copyButton.onclick = async () => {
        let success = await window.electronAPI.copyToClipboard(url);
        if (success) {
            displaySuccess(translate("app.share.copy_link.success"));
        } else {
            displayError(translate("app.share.copy_link.fail"));
        }
        copyButton.innerHTML = '<i class="fa-solid fa-check"></i>';
        setTimeout(() => {
            copyButton.innerHTML = '<i class="fa-solid fa-copy"></i>';
        }, 2000);
    }
    linkWrapper.appendChild(copyButton);
    shareWrapper.appendChild(linkWrapper);
    let links = document.createElement("div");
    links.className = "share-links";
    shareWrapper.appendChild(links);
    let linkList = [
        {
            "icon": '<i class="fa-solid fa-envelope"></i>',
            "func": () => {
                window.electronAPI.openInBrowser(`mailto:example@example.com?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text + " " + url)}`)
            },
            "tooltip": translate("app.share.email")
        },
        {
            "icon": '<i class="fa-solid fa-globe"></i>',
            "func": () => {
                window.electronAPI.openInBrowser(url);
            },
            "tooltip": translate("app.share.browser")
        },
        {
            "icon": '<i class="fa-brands fa-x-twitter"></i>',
            "func": () => {
                window.electronAPI.openInBrowser(`https://twitter.com/intent/tweet?text=${encodeURIComponent(title + "\n\n" + text + " " + url)}`)
            },
            "tooltip": translate("app.share.x")
        },
        {
            "icon": '<i class="fa-brands fa-bluesky"></i>',
            "func": () => {
                window.electronAPI.openInBrowser(`https://bsky.app/intent/compose?text=${encodeURIComponent(text + " " + url)}`)
            },
            "tooltip": translate("app.share.bluesky")
        },
        {
            "icon": '<i class="fa-brands fa-mastodon"></i>',
            "func": () => {
                window.electronAPI.openInBrowser(`https://tootpick.org/#text=${encodeURIComponent(title + "\n\n" + text + " " + url)}`)
            },
            "tooltip": translate("app.share.mastodon")
        },
        {
            "icon": '<i class="fa-brands fa-reddit"></i>',
            "func": () => {
                window.electronAPI.openInBrowser(`https://www.reddit.com/submit?title=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`)
            },
            "tooltip": translate("app.share.reddit")
        }
    ]
    linkList.forEach(e => {
        let linkElement = document.createElement("button");
        linkElement.className = "share-special-link";
        linkElement.innerHTML = e.icon;
        linkElement.setAttribute("title", e.tooltip);
        linkElement.onclick = e.func;
        links.appendChild(linkElement);
    });
    let dialog = new Dialog();
    dialog.showDialog(translate("app.share.title"), "notice", shareWrapper, [
        {
            "type": "confirm",
            "content": translate("app.share.close")
        }
    ], [], () => { });
}

async function updateContent(instanceInfo, content, contentversion, forced) {
    instanceInfo = instanceInfo.refresh();
    if (content.source == "modrinth") {
        let res = await fetch(`https://api.modrinth.com/v2/project/${content.source_info}/version`);
        let version_json = await res.json();

        let foundVersion = false;
        let initialContent = {};
        let newVersion = "";
        let newVersionId = "";

        for (let j = 0; j < version_json.length; j++) {
            if ((version_json[j].game_versions.includes(instanceInfo.vanilla_version) && (content.type != "mod" || version_json[j].loaders.includes(instanceInfo.loader)) && !contentversion) || (version_json[j].id == contentversion)) {
                if (version_json[j].id == content.version_id && !forced) {
                    return;
                }
                initialContent = await installSpecificVersion(version_json[j], "modrinth", instanceInfo, content.type, content.name, content.author, content.image, content.source_info, true);
                newVersion = version_json[j].version_number;
                newVersionId = version_json[j].id;
                foundVersion = true;
                break;
            }
        }

        if (!foundVersion) {
            content = content.refresh();
            let alreadyDisabled = content.disabled;
            let new_file_name = window.electronAPI.disableFile(processRelativePath(`./minecraft/instances/${instanceInfo.instance_id}/${content.type == "mod" ? "mods" : content.type == "resource_pack" ? "resourcepacks" : "shaderpacks"}/` + content.file_name));
            if (!new_file_name) {
                displayError(translate("app.error.failure_to_disable"));
                return false;
            }
            content.setDisabled(true);
            content.setFileName(new_file_name);
            if (!alreadyDisabled) displayError(translate("app.content.update.failed", "%c", content.name));
            return false;
        }

        content = content.refresh();

        let oldFileName = content.file_name;
        let oldVersion = content.version;
        let oldVersionId = content.version_id;

        content.setFileName(initialContent.file_name);
        content.setVersion(newVersion);
        content.setVersionId(newVersionId);

        if (content.disabled) {
            let new_file_name = window.electronAPI.disableFile(processRelativePath(`./minecraft/instances/${instanceInfo.instance_id}/${content.type == "mod" ? "mods" : content.type == "resource_pack" ? "resourcepacks" : "shaderpacks"}/` + initialContent.file_name));
            if (!new_file_name) {
                displayError(translate("app.error.failure_to_disable"));
                content.setDisabled(false);
                return false;
            }
            content.setFileName(new_file_name);
        }

        if (oldFileName != content.file_name) {
            let success = await window.electronAPI.deleteContent(instanceInfo.instance_id, content.type, oldFileName);
            if (!success) {
                displayError(translate("app.content.update.old_file_fail", "%f", oldFileName));
                content.setVersion(oldVersion);
                content.setVersionId(oldVersionId);
                content.setFileName(oldFileName);
                let success2 = await window.electronAPI.deleteContent(instanceInfo.instance_id, content.type, initialContent.file_name);
                if (!success2) {
                    displayError(translate("app.content.update.new_file_fail", "%f", initialContent.file_name));
                }
            }
        }
    } else if (content.source == "curseforge") {
        let game_flavor = ["", "forge", "", "", "fabric", "quilt", "neoforge"].indexOf(instanceInfo.loader);
        let version_json = await window.electronAPI.getCurseforgePage(content.source_info, 1, content.type == "mod" ? game_flavor : -1);
        max_pages = Math.ceil(version_json.pagination.totalCount / version_json.pagination.pageSize) + 1;
        version_json = version_json.data.map(e => ({
            "game_versions": e.gameVersions,
            "files": [
                {
                    "filename": e.fileName,
                    "url": (`https://mediafilez.forgecdn.net/files/${Number(e.id.toString().substring(0, 4))}/${Number(e.id.toString().substring(4, 7))}/${encodeURIComponent(e.fileName)}`)
                }
            ],
            "loaders": e.gameVersions.map(e => {
                return e.toLowerCase();
            }),
            "id": e.id
        }));

        let foundVersion = false;
        let initialContent = {};
        let newVersionId = "";

        for (let j = 0; j < version_json.length; j++) {
            if ((version_json[j].game_versions.includes(instanceInfo.vanilla_version) && (content.type != "mod" || version_json[j].loaders.includes(instanceInfo.loader)) && !contentversion) || (Number(version_json[j].id) == Number(contentversion))) {
                if (Number(version_json[j].id) == Number(content.version_id) && !forced) {
                    return;
                }
                initialContent = await installSpecificVersion(version_json[j], "curseforge", instanceInfo, content.type, content.name, content.author, content.image, content.source_info, true);
                newVersionId = version_json[j].id;
                foundVersion = true;
                break;
            }
        }

        if (!initialContent?.type) {
            let not_found = true;
            let count = 1;
            while (not_found) {
                count++;
                if (count >= max_pages) {
                    not_found = false;
                    continue;
                }
                let game_flavor = ["", "forge", "", "", "fabric", "quilt", "neoforge"].indexOf(instanceInfo.loader);
                version_json = await window.electronAPI.getCurseforgePage(content.source_info, count, game_flavor);
                version_json = version_json.data.map(e => ({
                    "game_versions": e.gameVersions,
                    "files": [
                        {
                            "filename": e.fileName,
                            "url": (`https://mediafilez.forgecdn.net/files/${Number(e.id.toString().substring(0, 4))}/${Number(e.id.toString().substring(4, 7))}/${encodeURIComponent(e.fileName)}`)
                        }
                    ],
                    "loaders": e.gameVersions.map(e => {
                        return e.toLowerCase();
                    }),
                    "id": e.id
                }));
                let initialContent = {};
                for (let j = 0; j < version_json.length; j++) {
                    if ((version_json[j].game_versions.includes(instanceInfo.vanilla_version) && (content.type != "mod" || version_json[j].loaders.includes(instanceInfo.loader)) && !contentversion) || (Number(version_json[j].id) == Number(contentversion))) {
                        if (Number(version_json[j].id) == Number(content.version_id) && !forced) {
                            return;
                        }
                        initialContent = await installSpecificVersion(version_json[j], "curseforge", instanceInfo, content.type, content.name, content.author, content.image, content.source_info, true);
                        newVersionId = version_json[j].id;
                        foundVersion = true;
                        break;
                    }
                }
                if (initialContent?.type) {
                    not_found = false;
                }
            }
        }

        if (!foundVersion) {
            content = content.refresh();
            let alreadyDisabled = content.disabled;
            let new_file_name = window.electronAPI.disableFile(processRelativePath(`./minecraft/instances/${instanceInfo.instance_id}/${content.type == "mod" ? "mods" : content.type == "resource_pack" ? "resourcepacks" : "shaderpacks"}/` + content.file_name));
            if (!new_file_name) {
                displayError(translate("app.error.failure_to_disable"));
                return false;
            }
            content.setDisabled(true);
            content.setFileName(new_file_name);
            if (!alreadyDisabled) displayError(translate("app.content.update.failed", "%c", content.name));
            return false;
        }

        content = content.refresh();

        let oldFileName = content.file_name;
        let oldVersionId = content.version_id;

        content.setFileName(initialContent.file_name);
        content.setVersionId(newVersionId);

        if (content.disabled) {
            let new_file_name = window.electronAPI.disableFile(processRelativePath(`./minecraft/instances/${instanceInfo.instance_id}/${content.type == "mod" ? "mods" : content.type == "resource_pack" ? "resourcepacks" : "shaderpacks"}/` + initialContent.file_name));
            if (!new_file_name) {
                displayError(translate("app.error.failure_to_disable"));
                content.setDisabled(false);
                return false;
            }
            content.setFileName(new_file_name);
        }

        if (oldFileName != content.file_name) {
            let success = await window.electronAPI.deleteContent(instanceInfo.instance_id, content.type, oldFileName);
            if (!success) {
                displayError(translate("app.content.update.old_file_fail", "%f", oldFileName));
                content.setVersionId(oldVersionId);
                content.setFileName(oldFileName);
                let success2 = await window.electronAPI.deleteContent(instanceInfo.instance_id, content.type, initialContent.file_name);
                if (!success2) {
                    displayError(translate("app.content.update.new_file_fail", "%f", initialContent.file_name));
                }
            }
        }
    } else if (content.source == "vanilla_tweaks") {
        let file_name = await window.electronAPI.downloadVanillaTweaksResourcePacks(JSON.parse(content.source_info), instanceInfo.vanilla_version, instanceInfo.instance_id);

        let oldFileName = content.file_name;

        content.setFileName(file_name);

        if (content.disabled) {
            let new_file_name = window.electronAPI.disableFile(processRelativePath(`./minecraft/instances/${instanceInfo.instance_id}/${content.type == "mod" ? "mods" : content.type == "resource_pack" ? "resourcepacks" : "shaderpacks"}/` + file_name));
            if (!new_file_name) {
                displayError(translate("app.error.failure_to_disable"));
                content.setDisabled(false);
                return false;
            }
            content.setFileName(new_file_name);
        }

        if (oldFileName != content.file_name) {
            let success = await window.electronAPI.deleteContent(instanceInfo.instance_id, content.type, oldFileName);
            if (!success) {
                displayError(translate("app.content.update.old_file_fail", "%f", oldFileName));
                content.setFileName(oldFileName);
                let success2 = await window.electronAPI.deleteContent(instanceInfo.instance_id, content.type, file_name);
                if (!success2) {
                    displayError(translate("app.content.update.new_file_fail", "%f", initialContent.file_name));
                }
            }
        }
    }
}

function fixPathForImage(path) {
    return path.replaceAll(" ", "%20").replaceAll("#", "%23");
}

async function repairInstance(instance, whatToRepair) {
    instance.setMcInstalled(false);
    let r = await window.electronAPI.repairMinecraft(instance.instance_id, instance.loader, instance.vanilla_version, instance.loader_version, whatToRepair);
    if (whatToRepair.includes("java")) {
        instance.setJavaPath(r.java_installation);
        instance.setJavaVersion(r.java_version);
    }
    instance.setMcInstalled(true);
}

async function installButtonClick(project_type, source, content_loaders, icon, title, author, game_versions, project_id, instance_id, button, dialog_to_close, override_version, oncomplete) {
    let plugin_loaders = ["folia", "spigot", "paper", "bungeecord", "purpur", "waterfall", "velocity", "bukkit", "sponge"];
    let count = 0;
    content_loaders.forEach(e => {
        if (plugin_loaders.includes(e)) count++;
    });
    if (count == content_loaders.length && content_loaders.length) {
        let dialog = new Dialog();
        dialog.showDialog(translate("app.discover.plugin.title"), "notice", translate("app.discover.plugin.description"), [
            {
                "type": "confirm",
                "content": translate("app.discover.plugin.confirm")
            }
        ], [], () => { });
        return;
    }
    if (project_type == "datapack" || content_loaders.includes("datapack")) {
        let dialog = new Dialog();
        dialog.showDialog(translate("app.discover.datapacks.title"), "form", [
            instance_id ? null : {
                "type": "dropdown",
                "id": "instance",
                "name": translate("app.discover.datapacks.instance"),
                "options": data.getInstances().map(e => ({ "name": e.name, "value": e.instance_id }))
            },
            {
                "type": "dropdown",
                "id": "world",
                "name": translate("app.discover.datapacks.world"),
                "options": instance_id ? getInstanceWorlds(new Instance(instance_id)).map(e => ({ "name": e.name, "value": e.id })) : [],
                "input_source": instance_id ? null : "instance",
                "source": instance_id ? null : (i) => {
                    return getInstanceWorlds(new Instance(i)).map(e => ({ "name": e.name, "value": e.id }));
                }
            }
        ].filter(e => e), [
            { "content": translate("app.instances.cancel"), "type": "cancel" },
            { "content": translate("app.instances.submit"), "type": "confirm" }
        ], [], async (e) => {
            let info = {};
            e.forEach(e => { info[e.id] = e.value });
            let instance = instance_id ? instance_id : info.instance;
            let world = info.world;
            let success;
            button.innerHTML = '<i class="spinner"></i>' + translate("app.discover.installing");
            button.classList.add("disabled");
            button.onclick = () => { };
            if (override_version) {
                if (source == "modrinth") {
                    success = await installSpecificVersion(override_version, source, new Instance(instance), "datapack", title, author, icon, project_id, false, world);
                } else if (source == "curseforge") {
                    success = await installSpecificVersion({
                        "game_versions": game_versions,
                        "files": [
                            {
                                "filename": override_version.fileName,
                                "url": (`https://mediafilez.forgecdn.net/files/${Number(override_version.id.toString().substring(0, 4))}/${Number(override_version.id.toString().substring(4, 7))}/${encodeURIComponent(override_version.fileName)}`)
                            }
                        ],
                        "loaders": game_versions.map(e => {
                            return e.toLowerCase();
                        }),
                        "id": override_version.id,
                        "dependencies": []
                    }, "curseforge", new Instance(instance), "datapack", title, author, icon, project_id, false, world)
                }
            } else {
                success = await installContent(source, project_id, instance, "datapack", title, author, icon, world);
            }
            if (success) {
                button.innerHTML = '<i class="fa-solid fa-check"></i>' + translate("app.discover.installed");
                oncomplete();
            } else {
                button.innerHTML = '<i class="fa-solid fa-xmark"></i>' + translate("app.discover.failed")
            }
        })
    } else if (project_type == "modpack") {
        let options = [];
        if (source == "modrinth") content_loaders.forEach((e) => {
            if (loaders[e]) {
                options.push({ "name": loaders[e], "value": e })
            }
        })
        let dialog = new Dialog();
        dialog.showDialog(translate("app.button.instances.create"), "form", [
            {
                "type": "image-upload",
                "id": "icon",
                "name": translate("app.instances.icon"),
                "default": icon
            },
            {
                "type": "text",
                "name": translate("app.instances.name"),
                "id": "name",
                "default": title,
                "maxlength": 50
            },
            source == "modrinth" ? {
                "type": "dropdown",
                "name": translate("app.instances.game_version"),
                "id": "game_version",
                "options": game_versions.map(e => ({ "name": e, "value": e })).reverse()
            } : null,
            source == "modrinth" ? {
                "type": "dropdown",
                "name": translate("app.instances.loader"),
                "id": "loader",
                "options": options
            } : null
        ].filter(e => e), [
            { "content": translate("app.instances.cancel"), "type": "cancel" },
            { "content": translate("app.instances.submit"), "type": "confirm" }
        ], [], async (e) => {
            if (dialog_to_close) dialog_to_close.close();
            let info = {};
            e.forEach(e => { info[e.id] = e.value });
            let instance_id = window.electronAPI.getInstanceFolderName(info.name);
            let files_url = `https://api.modrinth.com/v2/project/${project_id}/version`;
            if (source == "curseforge") {
                files_url = `https://www.curseforge.com/api/v1/mods/${project_id}/files?pageIndex=0&pageSize=20&sort=dateCreated&sortDescending=true&removeAlphas=true`
            }
            let version_json = {};
            if (!override_version) {
                let res = await fetch(files_url);
                version_json = await res.json();
            }
            let version = override_version ? override_version : {};
            if (source == "modrinth" && !override_version) {
                for (let j = 0; j < version_json.length; j++) {
                    if (version_json[j].game_versions.includes(info.game_version) && version_json[j].loaders.includes(info.loader)) {
                        version = version_json[j];
                        break;
                    }
                }
            } else if (source == "curseforge" && !override_version) {
                version = version_json.data[0];
            }
            if (!version.files && source == "modrinth" && !override_version) {
                displayError(translate("app.discover.error_creating_modpack", "%t", title, "%v", info.game_version, "%l", loaders[info.loader]));
                return;
            }
            let instance = data.addInstance(info.name, new Date(), new Date(), "", info.loader, info.game_version, "", true, true, "", info.icon, instance_id, 0, source, project_id, true, false);
            instance.setInstalledVersion(version.id);
            showSpecificInstanceContent(instance);
            if (source == "modrinth") {
                await window.electronAPI.downloadModrinthPack(instance_id, version.files[0].url, title);
            } else if (source == "curseforge") {
                instance.setLoader("");
                instance.setVanillaVersion("");
                await window.electronAPI.downloadCurseforgePack(instance_id, (`https://mediafilez.forgecdn.net/files/${Number(version.id.toString().substring(0, 4))}/${Number(version.id.toString().substring(4, 7))}/${encodeURIComponent(version.fileName)}`), title);
            }
            let mr_pack_info = {};
            if (source == "modrinth") {
                mr_pack_info = await window.electronAPI.processMrPack(instance_id, processRelativePath(`./minecraft/instances/${instance_id}/pack.mrpack`), info.loader, title);
            } else if (source == "curseforge") {
                mr_pack_info = await window.electronAPI.processCfZip(instance_id, processRelativePath(`./minecraft/instances/${instance_id}/pack.zip`), project_id, title);

                instance.setLoader(mr_pack_info.loader);
                instance.setVanillaVersion(mr_pack_info.vanilla_version);
                if (mr_pack_info.allocated_ram) instance.setAllocatedRam(mr_pack_info.allocated_ram);
                info.loader = mr_pack_info.loader;
                info.game_version = mr_pack_info.vanilla_version;
            }
            if (!mr_pack_info.loader_version) {
                displayError(mr_pack_info);
                return;
            }
            instance.setLoaderVersion(mr_pack_info.loader_version);
            mr_pack_info.content.forEach(e => {
                instance.addContent(e.name, e.author, e.image, e.file_name, e.source, e.type, e.version, e.source_id, e.disabled, e.version_id);
            });
            instance.setInstalling(false);
            let r = await window.electronAPI.downloadMinecraft(instance_id, info.loader, info.game_version, mr_pack_info.loader_version);
            instance.setJavaPath(r.java_installation);
            instance.setJavaVersion(r.java_version);
            instance.setMcInstalled(true);
        })
    } else if (instance_id) {
        button.innerHTML = '<i class="spinner"></i>' + translate("app.discover.installing");
        button.classList.add("disabled");
        button.onclick = () => { };
        let success;
        if (override_version) {
            if (source == "modrinth") {
                success = await installSpecificVersion(override_version, source, new Instance(instance_id), project_type, title, author, icon, project_id);
            } else if (source == "curseforge") {
                let dependencies = await fetch(`https://www.curseforge.com/api/v1/mods/${project_id}/dependencies?index=0&pageSize=100`);
                let dependencies_json = await dependencies.json();
                let dependency_list = dependencies_json.data;
                success = await installSpecificVersion({
                    "game_versions": game_versions,
                    "files": [
                        {
                            "filename": override_version.fileName,
                            "url": (`https://mediafilez.forgecdn.net/files/${Number(override_version.id.toString().substring(0, 4))}/${Number(override_version.id.toString().substring(4, 7))}/${encodeURIComponent(override_version.fileName)}`)
                        }
                    ],
                    "loaders": game_versions.map(e => {
                        return e.toLowerCase();
                    }),
                    "id": override_version.id,
                    "dependencies": dependency_list
                }, "curseforge", new Instance(instance_id), project_type, title, author, icon, project_id)
            }
        } else if (project_type == "server") {
            success = await addContent(instance_id, project_type, project_id, title, icon);
        } else {
            success = await installContent(source, project_id, instance_id, project_type, title, author, icon);
        }
        if (success) {
            button.innerHTML = '<i class="fa-solid fa-check"></i>' + translate("app.discover.installed");
            if (oncomplete) oncomplete();
        } else {
            button.innerHTML = '<i class="fa-solid fa-xmark"></i>' + translate("app.discover.failed")
        }
    } else {
        let dialog = new Dialog();
        let instances = data.getInstances();
        dialog.showDialog(translate("app.discover.select_instance.title", "%t", title), "form", [
            {
                "type": "dropdown",
                "name": translate("app.discover.select_instance.instance"),
                "id": "instance",
                "options": source == "curseforge" ? instances.map(e => ({ "name": e.name, "value": e.instance_id })) : (project_type == "mod" ? instances.filter(e => content_loaders.includes(e.loader)).filter(e => game_versions.includes(e.vanilla_version)).map(e => ({ "name": e.name, "value": e.instance_id })) : project_type == "resourcepack" || project_type == "datapack" ? instances.filter(e => game_versions.includes(e.vanilla_version)).map(e => ({ "name": e.name, "value": e.instance_id })) : project_type == "shader" ? instances.filter(e => e.loader != "vanilla").filter(e => game_versions.includes(e.vanilla_version)).map(e => ({ "name": e.name, "value": e.instance_id })) : instances.filter(game_versions.includes(e.vanilla_version)).map(e => ({ "name": e.name, "value": e.instance_id })))
            }
        ], [
            { "content": translate("app.discover.select_instance.cancel"), "type": "cancel" },
            { "content": translate("app.discover.select_instance.confirm"), "type": "confirm" }
        ], null, async (e) => {
            if (dialog_to_close) dialog_to_close.close();
            let info = {};
            e.forEach(e => { info[e.id] = e.value });
            let success;
            if (override_version) {
                if (source == "modrinth") {
                    success = await installSpecificVersion(override_version, source, new Instance(info.instance), project_type, title, author, icon, project_id);
                } else if (source == "curseforge") {
                    let dependencies = await fetch(`https://www.curseforge.com/api/v1/mods/${project_id}/dependencies?index=0&pageSize=100`);
                    let dependencies_json = await dependencies.json();
                    let dependency_list = dependencies_json.data;
                    success = await installSpecificVersion({
                        "game_versions": game_versions,
                        "files": [
                            {
                                "filename": override_version.fileName,
                                "url": (`https://mediafilez.forgecdn.net/files/${Number(override_version.id.toString().substring(0, 4))}/${Number(override_version.id.toString().substring(4, 7))}/${encodeURIComponent(override_version.fileName)}`)
                            }
                        ],
                        "loaders": game_versions.map(e => {
                            return e.toLowerCase();
                        }),
                        "id": override_version.id,
                        "dependencies": dependency_list
                    }, "curseforge", new Instance(info.instance), project_type, title, author, icon, project_id)
                }
            } else if (project_type == "server") {
                success = await addContent(info.instance, project_type, project_id, title, icon);
            } else {
                success = await installContent(source, project_id, info.instance, project_type, title, author, icon);
            }
            if (success) {
                displaySuccess(translate("app.discover.select_instance.success", "%t", title, "%i", (new Instance(info.instance)).name));
            } else {
                displayError(translate("app.discover.select_instance.fail", "%t", title, "%i", (new Instance(info.instance)).name));
            }
        });
    }
}

async function runModpackUpdate(instanceInfo, source, modpack_info) {
    closeAllDialogs();
    instanceInfo.setInstalling(true);
    instanceInfo.setMcInstalled(false);
    await window.electronAPI.deleteFoldersForModpackUpdate(instanceInfo.instance_id);
    instanceInfo.clearContent();
    if (source == "modrinth") {
        await window.electronAPI.downloadModrinthPack(instanceInfo.instance_id, modpack_info.files[0].url, instanceInfo.name);
        instanceInfo.setVanillaVersion(modpack_info.game_versions[0], true);
        instanceInfo.setLoader(modpack_info.loaders[0]);
    } else if (source == "curseforge") {
        await window.electronAPI.downloadCurseforgePack(instanceInfo.instance_id, (`https://mediafilez.forgecdn.net/files/${Number(modpack_info.id.toString().substring(0, 4))}/${Number(modpack_info.id.toString().substring(4, 7))}/${encodeURIComponent(modpack_info.fileName)}`), instanceInfo.name);
    }
    let mr_pack_info = {};
    if (source == "modrinth") {
        mr_pack_info = await window.electronAPI.processMrPack(instanceInfo.instance_id, processRelativePath(`./minecraft/instances/${instanceInfo.instance_id}/pack.mrpack`), instanceInfo.loader, instanceInfo.name);
    } else if (source == "curseforge") {
        mr_pack_info = await window.electronAPI.processCfZip(instanceInfo.instance_id, processRelativePath(`./minecraft/instances/${instanceInfo.instance_id}/pack.zip`), instanceInfo.install_id, instanceInfo.name);

        instanceInfo.setLoader(mr_pack_info.loader);
        instanceInfo.setVanillaVersion(mr_pack_info.vanilla_version, true);
        if (mr_pack_info.allocated_ram) instance.setAllocatedRam(mr_pack_info.allocated_ram);
    }
    if (!mr_pack_info.loader_version) {
        displayError(mr_pack_info);
        return;
    }
    instanceInfo.setInstalledVersion(modpack_info.id);
    instanceInfo.setLoaderVersion(mr_pack_info.loader_version);
    mr_pack_info.content.forEach(e => {
        instanceInfo.addContent(e.name, e.author, e.image, e.file_name, e.source, e.type, e.version, e.source_id, e.disabled, e.version_id);
    });
    instanceInfo.setInstalling(false);
    let r = await window.electronAPI.downloadMinecraft(instanceInfo.instance_id, instanceInfo.loader, instanceInfo.vanilla_version, mr_pack_info.loader_version);
    instanceInfo.setJavaPath(r.java_installation);
    instanceInfo.setJavaVersion(r.java_version);
    instanceInfo.setMcInstalled(true);
}

function closeAllDialogs() {
    let dialogs = [...document.getElementsByTagName("dialog")];
    dialogs.forEach(e => {
        e.close();
    });
    setTimeout(() => {
        dialogs.forEach(e => {
            if (e.id == "screenshotPreview" || e.id == "contentInfo") {
                return;
            }
            e.remove();
        });
    }, 500);
}

document.getElementById("spinner-wrapper").remove();

document.getElementById("offline-notice").innerHTML = translate("app.offline");

window.ononline = () => {
    document.body.classList.remove("offline");
}

if (!navigator.onLine) {
    document.body.classList.add("offline");
}

window.onoffline = () => {
    document.body.classList.add("offline");
}

[...document.body.children].forEach(e => {
    e.style.display = "";
});

function processRelativePath(path) {
    return path.replace("./", window.electronAPI.getDirName() + "/").replaceAll("\\", "/");
}

async function checkForUpdates(isManual) {
    try {
        let result = await window.electronAPI.checkForUpdates();
        if (!result.update) {
            if (isManual) displaySuccess(translate("app.settings.updates.none_found"));
        } else {
            let dialog = new Dialog;
            dialog.showDialog(translate("app.settings.updates.found.title"), "notice", translate("app.settings.updates.found.description", "%v", result.new_version, "%s", result.file_size), [
                {
                    "type": "cancel",
                    "content": translate("app.settings.updates.found.cancel")
                },
                {
                    "type": "confirm",
                    "content": translate("app.settings.updates.found.confirm")
                }
            ], [], async () => {
                try {
                    await window.electronAPI.downloadUpdate(result.download_url, result.new_version, result.checksum);
                } catch (e) {
                    displayError(translate("app.settings.updates.download_failed"));
                    return;
                }
                let dialog = new Dialog;
                dialog.showDialog(translate("app.settings.updates.complete.title"), "notice", translate("app.settings.updates.complete.description"), [
                    {
                        "type": "cancel",
                        "content": translate("app.settings.updates.complete.cancel")
                    },
                    {
                        "type": "confirm",
                        "content": translate("app.settings.updates.complete.confirm")
                    }
                ], [], () => {
                    window.electronAPI.updateEnderLynx();
                });
            });
        }
    } catch (e) {
        if (isManual) displayError(translate("app.settings.updates.error"));
    }
}

checkForUpdates();

async function createElPack(instance, content_list, overrides) {
    instance = instance.refresh();
    let manifest = {
        "name": instance.name,
        "icon": instance.image,
        "loader": instance.loader,
        "loader_version": instance.loader_version,
        "game_version": instance.vanilla_version,
        "allocated_ram": instance.allocated_ram,
        "files": content_list.map(e => ({
            "type": e.type,
            "source": e.source,
            "version_id": e.version_id,
            "source_info": e.source_info,
            "file_name": e.file_name,
            "disabled": e.disabled
        }))
    }
    let file_path = await window.electronAPI.createElPack(instance.instance_id, instance.name, manifest, overrides);
    openShareDialogForFile(file_path);
}

window.electronAPI.onOpenFile((info, file_path) => {
    let dialog = new Dialog();
    dialog.showDialog(translate("app.import.elpack.title"), "notice", translate("app.import.elpack.description", "%t", info.name), [
        {
            "type": "cancel",
            "content": translate("app.import.elpack.cancel")
        },
        {
            "type": "confirm",
            "content": translate("app.import.elpack.confirm")
        }
    ], [], async () => {
        let instance_id = window.electronAPI.getInstanceFolderName(info.name);
        let instance = data.addInstance(info.name, new Date(), new Date(), "", info.loader, info.game_version, info.loader_version, false, true, "", info.image, instance_id, 0, "", "", true, false);
        showSpecificInstanceContent(instance);
        let packInfo = await window.electronAPI.processPackFile(file_path, instance_id, info.name);
        console.log(packInfo);
        if (!packInfo.loader_version) {
            displayError(packInfo);
            return;
        }
        instance.setLoader(packInfo.loader);
        instance.setVanillaVersion(packInfo.vanilla_version);
        instance.setLoaderVersion(packInfo.loader_version);
        if (!instance.image && packInfo.image) instance.setImage(packInfo.image);
        if (packInfo.allocated_ram) instance.setAllocatedRam(packInfo.allocated_ram);
        packInfo.content.forEach(e => {
            instance.addContent(e.name, e.author, e.image, e.file_name, e.source, e.type, e.version, e.source_id, e.disabled, e.version_id);
        });
        instance.setInstalling(false);
        let r = await window.electronAPI.downloadMinecraft(instance_id, packInfo.loader, packInfo.vanilla_version, packInfo.loader_version);
        instance.setJavaPath(r.java_installation);
        instance.setJavaVersion(r.java_version);
        instance.setMcInstalled(true);
    });
});

function openInstanceShareDialog(instanceInfo) {
    let options = window.electronAPI.getInstanceFiles(instanceInfo.instance_id);
    let content = instanceInfo.getContent();
    let contentSpecific = [];
    let contentMap = {};
    content.forEach(e => {
        let content_folder = e.type == "mod" ? "mods" : e.type == "resource_pack" ? "resourcepacks" : "shaderpacks";
        let content_file = content_folder + "//" + e.file_name;
        let replace = content_folder + "//" + parseMinecraftFormatting(e.name);
        contentSpecific.push(replace);
        contentMap[replace] = e;
        let index = options.indexOf(content_file);
        if (index < 0) return;
        options[index] = replace;
    });

    let dialog = new Dialog();
    dialog.showDialog(translate("app.instances.share.title"), "form", [
        {
            "type": "text",
            "name": translate("app.instances.share.name"),
            "id": "name",
            "default": instanceInfo.name
        },
        {
            "type": "files",
            "name": translate("app.instances.share.files"),
            "id": "files",
            "options": options,
            "default": ["mods", "resourcepacks", "shaderpacks", "config", "defaultconfig", "defaultconfigs", "kubejs", "scripts", "shader"]
        }
    ], [
        {
            "type": "cancel",
            "content": translate("app.instances.share.cancel")
        },
        {
            "type": "confirm",
            "content": translate("app.instances.share.confirm")
        }
    ], [], (v) => {
        let info = {};
        v.forEach(e => info[e.id] = e.value);
        let nonContentSpecific = info.files.filter(e => !contentSpecific.includes(e));
        let yesContentSpecific = info.files.filter(e => contentSpecific.includes(e)).map(e => contentMap[e]);
        yesContentSpecific = yesContentSpecific.filter(e => {
            if (e.source != "player_install") return true;
            let content_folder = e.type == "mod" ? "mods" : e.type == "resource_pack" ? "resourcepacks" : "shaderpacks";
            let content_file = content_folder + "//" + e.file_name;
            nonContentSpecific.push(content_file);
            return false;
        });
        createElPack(instanceInfo, yesContentSpecific, nonContentSpecific.map(e => e.replaceAll("//", "/")));
    });
}

switch (data.getDefault("saved_version")) {
    case "0.0.1":
    case "0.0.2":
    case "0.0.3":
    case "0.0.4":
    case "0.0.5":
    case "0.0.6":
    case "0.0.7":
        if (data.getDefault("default_page") == "my_account") data.setDefault("default_page", "discover");
        db.prepare("ALTER TABLE skins DROP COLUMN file_name;").run();
        db.prepare("ALTER TABLE skins DROP COLUMN last_used;").run();
        db.prepare("ALTER TABLE capes DROP COLUMN last_used;").run();
}

data.setDefault("saved_version", window.electronAPI.version.replace("-dev", ""));