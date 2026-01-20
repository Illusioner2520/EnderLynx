let lang = null;
document.getElementsByTagName("title")[0].innerHTML = sanitize(translate("app.name"));

history.scrollRestoration = "manual"

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

let page_log = [];
let page_index = -1;

function pageForward() {
    if (!page_log[page_index + 1]) return;
    page_index++;
    page_log[page_index]();
}

function pageBackward() {
    if (!page_log[page_index - 1]) return;
    page_index--;
    page_log[page_index]();
}

document.body.onmousedown = (e) => {
    if (document.querySelector("dialog[open]")) return;
    if (e.button == 3) pageBackward();
    else if (e.button == 4) pageForward();
}

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
        if (!dataVersion) dataVersion = v?.value;
        if (!dataVersion) dataVersion = 100;
        content = "version:" + (dataVersion ? dataVersion : (v?.value ? v?.value : "100")) + "\n";
        dataVersion = Number(dataVersion);
        r.forEach(e => {
            if (minecraftVersions.indexOf(this.version) <= minecraftVersions.indexOf("1.12.2") && keyToNum[e.value]) {
                content += e.key + ":" + keyToNum[e.value] + "\n"
            } else {
                content += e.key + ":" + e.value + "\n"
            }
        });
        return { "content": content, "version": Number((dataVersion ? dataVersion : (v?.value ? v?.value : "100"))), "keys": r.map(e => e.key), "values": r.map(e => e.value).map(e => (minecraftVersions.indexOf(this.version) <= minecraftVersions.indexOf("1.12.2") && keyToNum[e]) ? keyToNum[e] : e) };
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
        this.favorited = Boolean(skin.favorited);
        this.texture_key = skin.texture_key;
        this.last_used = new Date(skin.last_used);
        this.preview = skin.preview;
        this.preview_model = skin.preview_model;
        this.head = skin.head;
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

    setLastUsed(last_used) {
        db.prepare("UPDATE skins SET last_used = ? WHERE id = ?").run(last_used ? last_used.toISOString() : null, this.id);
        this.last_used = last_used;
    }

    setFavorited(favorited) {
        db.prepare("UPDATE skins SET favorited = ? WHERE id = ?").run(Number(favorited), this.id);
        this.favorited = favorited;
    }

    getPreview(callback) {
        if (this.preview && this.model == this.preview_model) {
            callback(this.preview);
            return;
        }
        renderSkinToDataUrl(this.skin_url, (v) => {
            db.prepare("UPDATE skins SET preview = ? WHERE id = ?").run(v, this.id);
            db.prepare("UPDATE skins SET preview_model = ? WHERE id = ?").run(this.model, this.id);
            this.preview = v;
            this.preview_model = this.model;
            callback(v);
        }, this.model);
    }

    getHead(callback) {
        if (this.head) {
            callback(this.head);
            return;
        }
        skinToHead(this.skin_url, (v) => {
            db.prepare("UPDATE skins SET head = ? WHERE id = ?").run(v, this.id);
            this.head = v;
            callback(v);
        });
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
        this.setLastUsed(new Date());
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
        if (!content_watches[this.id]) content_watches[this.id] = {};
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
        if (content_watches[this.id].onchangedisabled) {
            content_watches[this.id].onchangedisabled(disabled);
        }
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

    watchForChange(name, func) {
        if (!content_watches[this.id]) content_watches[this.id] = {};
        content_watches[this.id]["onchange" + name] = func;
    }
}

let instance_watches = {};
let content_watches = {}

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
        this.post_launch_hook = content.post_launch_hook;
        this.wrapper = content.wrapper;
        this.post_exit_hook = content.post_exit_hook;
        this.installed_version = content.installed_version;
        this.last_analyzed_log = content.last_analyzed_log;
        this.failed = Boolean(content.failed);
        this.uses_custom_java_args = content.uses_custom_java_args;
        this.provided_java_args = content.provided_java_args;
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
    setPostLaunchHook(post_launch_hook) {
        db.prepare("UPDATE instances SET post_launch_hook = ? WHERE id = ?").run(post_launch_hook, this.id);
        this.post_launch_hook = post_launch_hook;
        if (instance_watches[this.instance_id].onchangepost_launch_hook) {
            instance_watches[this.instance_id].onchangepost_launch_hook(post_launch_hook);
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
    setFailed(failed) {
        db.prepare("UPDATE instances SET failed = ? WHERE id = ?").run(Number(failed), this.id);
        this.failed = failed;
        if (instance_watches[this.instance_id].onchangefailed) instance_watches[this.instance_id].onchangefailed(failed);
    }
    setUsesCustomJavaArgs(uses_custom_java_args) {
        db.prepare("UPDATE instances SET uses_custom_java_args = ? WHERE id = ?").run(Number(uses_custom_java_args), this.id);
        this.uses_custom_java_args = uses_custom_java_args;
        if (instance_watches[this.instance_id].onchangeuses_custom_java_args) instance_watches[this.instance_id].onchangeuses_custom_java_args(uses_custom_java_args);
    }
    setProvidedJavaArgs(provided_java_args) {
        db.prepare("UPDATE instances SET provided_java_args = ? WHERE id = ?").run(provided_java_args, this.id);
        this.provided_java_args = provided_java_args;
        if (instance_watches[this.instance_id].onchangeprovided_java_args) instance_watches[this.instance_id].onchangeprovided_java_args(provided_java_args);
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
    "texture_key": "31f477eb1a7beee631c2ca64d06f8f68fa93a3386d04452ab27f43acdf1b60cb",
    "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAE5klEQVR4Xu1aMWsUQRgVVJCAoIIgglaJBG2UGIKCOU0hJHZKijRBsAnaWSjaiNjESgtTpT0bmxQWNvkJ+U9n3ube8ubNt7e5xOzdxX3wmNmZb/fmvflmdtm9M2dqcOfmxR44N325KFnn8ecXDwbSrzdxoODO7auleNTdgHfP5hKeKgNUsJff1zqZeBJ9fr2Jg4vW9Ef5Xxiga9+XAkRWLYFTYYDOuGYDxIMU6psf2r6tL54OA3wPUEIkBFeVfr2Jg4r2DRGk2OWZSwnZ7tcbO2hqU9j0tQtJyjMLlGqCnqPX0WtEcSh9PI0jGiBIIVpX8V7yvEg04/z6aPPxNA4V4QNm2/ar5d7vD+u9P1/eFOWvt2tF2/2ZK1ksyGO2aZ0msM3H0zg4IB2oziSEQjCEUzyJvkhUdE3WGc9jH0/j0IGxxC0M4iACQoHnj76WolEHcIwYtOGc6Fo0NDJoLAzwGaIgJWf89eO7BTUDlBTlM6/7gxqCYx9P4+BAUHLmeQ//8XKxfKDBre390nzBpRtTSQxvecwEvaYb4Mc+nsbBpzYV7yaghGiYwJKiaZCey+vpk+Gt61MJ2e7jGTke3vvaUy4sLBScnZ0t6PEZ9vbK5aHGog19fn2nXy7Dzk6vZLebLNHiN44LHxCF0wiPz7AvUsWrCSdhgO5H+B0PHxo+oKNkwEkbMLW7mxkwVhlwoktgX3S0BI6cAU/mt3sgfhzl04c/S7KNJan957a2EurMYFCl+P7Aq+LBpF2FiuCSbPv0KaWfUwcKPKwB2g9isOc3NwuWgvpCmZbeHsUnIr2N7S4ehOiNjQPSAI2rwyCBnh3eD0LI2Y8fC6Je/nC/9DaPdxPcrEwQ2T3ImNAAPacOgwRWGaB1iiHrBHl8IoyiVISnuJPi1QRlHVwgj6M27SNdUDLjZoDOfmRAtva7B5scyQ1Vy4h6juvN4Ab4DEeG6LGndGlAX4gb4PGeIaX4/rHe4nTH1zYVrfHF5luHyABfBoP6KYr0FNZZ9dgo3s+NRKkRkQFad70ZKKxKYJ0BGKSKKTJAZ5TZ0Bfk8aEBEh8ZoEaoASg9xvVm8PRW4UqPIylIxVG4i2OMxyUGiHjE6Ky6OBqgRniM682wsrLSA31zczLOqaIiM1Sgx5YGiGgVD6pYFxeZ4P2uNwMebzudTiJqdXU1E4oYj0Vdl4gapplDIyjMY3T5aAwyscoAzQw3QGNdbwY+41OcC6TwKA51NYDUZcSSM+rxvtcwhu0qxkWCfmv0GNfbokWLFi1atJgc4AVoFf3xmU+dSUyLFi1atGjRokVT8FdpQ39c1XeE+/S3QB4+dnADhv68bgbwTc+hX3GNGm7AUTOAj7qaARNpwLEyYL+uGTCWS0Df/vpLTu/TfsZkHzODbwS6JDKOGocRyWzwPjD5wqsGDDJB20YNNwClG6D9dQaUH0uqBLsho4YLdJHer22FAXXf9+uoWdI3xt8bVPGfGOjieRy1aR/p3/b9Q4d/8FCiz8fTOKoE+2xrv8arGL3f687vt8Kxui1GAuuWgNINGCRc+1j38TQOF4gyMiAyB4xS3YW7AUofT+Pw9PeZ1vZomURr3EUOygofT+Pgl2QKrKJ/bifrxFcJHxsD+LlcRQ3z/4LIABfsx9rm42kc0f8GVCCFR3GoQ0jVPuBZEfX5eIbFX3srPNN8aUvJAAAAAElFTkSuQmCC"
}, {
    "name": translate("app.skins.alex"),
    "model": "slim",
    "texture_key": "46acd06e8483b176e8ea39fc12fe105eb3a2a4970f5100057e9d84d4b60bdfa7",
    "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAFJklEQVR4Xu2aP2sUURTF/RRir2BAsQyC4GJjaSwEg1iJqRSDgiBooSIWoggiYm0l2KiNiKCNhaWFlYVWVhYWfoAxZ8xZfnvyJtmdkN2dMBcO7++8fefc+2Zn3ps9e7awX48G1e/ng0rpjztHRlJD7a5zXqmQ43XOTMQQOSPrd7UAf18u10jCTRHiuhyvc2ZCTR5mPUVwW47XOaP3GQXON4ljMXK8zll61eRc/vn5RfXt3eOhEFwau0IAk7bXGe6CBDAkhGExcrzOmUgy7Bn+jgDh99fXI3B9jjd3lqFd8jKJu815Lgf3Yx3Hz7LyOZ+pmwmWSCbZJMd6lykCyymAr835TN048SSek1bq0E7i7M/ooLAeg7+X85m6pdecFkVYW9t/vn8arvOSCKxznoQpylzcJD0pkh/x8hpR2f4LB2rygvIyi1DyMoUkYfdT/VwIkF7mHd2EN4OFoggUIAlTpLkQwJMcPuxsRv7Dm/9YL/MvzySV2tMkTO/z93I+Uzd6ww8x+b++QYh18nlDJHGP6ehi3m1zIUDa1VdXKmJxcbHGwsJCjeyf9vDjg+r++3s1OYPEc/xEjpem8Q06I/u1tpyQiVuI7J9mAQR5ebi01kXwuOePHRxBWwFEXlGb/VpbTrBtBNy+e27kncAilMhThBwvLQXYkQjgpNpEgMjz5YjLIcffrgDbjgB5ywPefHujunjicHXt1GJ16+zxOm84MhzeBidE7/MmqQmqjktrK2gupfETTX2SZ6OJnH7M5C+fPFKTF5SnCIK95bJ+zNd7Qk+fXRr5m1S+JICuKdWRVArtPOvTIUqTZ6PJ2yIq2PMmr1R1FCD7UQBPXqlFSPIkndeZ5NMvT4ap8yyX6vLa5NloJkKiJG8xSiJZAJKxByxCkncbyyScqa5vg+TZaAxzhr8FYIQICn+WSSYnrzTJUoCSF+llgQ9khO8vCbcnz0ZbXl6uDIa4iauOfYSVlZUayjOMk0AdBWsp12aKUurPcfIJlH99FIL3GyF5NprJmJAJlgiXQELpzSREAQy2u8z6JJ4ilMhPJECJ4Orq6oY6izIYDKqlpaUaypMQiSgvUZKQ692HQrluqgIkoQzxbFfqyFB+39G9Qxw6s7Dhbm/CJqY+vIZiZKq2JJ0CcCm0EoChTpIlwu7DsgmYsAgmSYtjgdg/2wnVJ+kSeUbCxAKYLEl5CSTxFEiQp3xnF/KBJFP3cfgT9jzbk7jJ580vRUiejabne5EysVzzJi34fYBlT5Tk9M9x/fTREaiO4vCaFIJI8ikC01YR0FtvvfW20+bdIG6Jc5uMcFuO0XnL8wLXc7doVxKX2fu7luBW5tDP+nFMewqJfPdPqE+OM1NrS7633nrrrbfeeuuWeU9QaHO4qmcGb4Z0coODAgiTHq/7XUEC6FB14i2uWVseeU8aAX5n6GwEpACTRoAE8BLoRATw5NjwuSLPHQ2JUtoI1QapX5ezLTFXb5VJ0ALwcDUPWRkh3CmmALl7zH5Kcx4zMxL3wWqeMpfg43gR4nkiy1nHNOcxM+NROb8dYPjnNwXsk+/y48K/n/VG7iHkXgI5bMtSgCRrTztCEnm+n6c9JahPzmNmxuMzLoNxvi/QqZMJlU53mqA+OY+ZWekoLc8V85id/enVccgbOY+ZWRJUeZLvCzovQBLiAWuJsFJHhvK55pNoE3IeMzOGOkmWCJeQAowjwlzdA0yWpDb7viBB4rwZJmmSn6t/gc2+LxAcCULp+wKu/63I70QE/AMDdqWZ7rX6YgAAAABJRU5ErkJggg=="
}, {
    "name": translate("app.skins.ari"),
    "model": "wide",
    "texture_key": "4c05ab9e07b3505dc3ec11370c3bdce5570ad2fb2b562e9b9dd9cf271f81aa44",
    "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAEyElEQVR4Xu2aP4sUQRTEhYsMTARBRBRURDNB1NDEQwMRMdHgAk3ESA1FDtREM5OLDIwM9Cv4WYz9AJqIKKzUYB21v+mZ3bnb65u724Kip7vfzr6qefNnp/fQoRl4d+34ZOP6qcnH1TNNq762RW2X+O353U1yf3sOFp4G2BQKp/h9YYDF+4hnP02g8H1jAI/4EPH7woBZFUDBJPe355Ciswq8TcEk97fnYANsQp4OWQHfXz2a4r4yIO8EPA1K4tME7m908IXMwl5fOjp1lNW3AaKE5TxjszpyTK3pcbXMpzoy2WxphoT/2HjaUNucd5/7yrFRGuAE8yj5iHtOon9/fjtFjWWMPmNRNiANYjU4jvlUh5ORAIvzue6EKd5MMfn5ktCsjDSE+VSHE7EAl7dLXvPCuZWVTYHaFjSXp4RaG1A68mmG+8ynOjIZl3pu/3jztCGPfo7bKG9LcJrgakgT3Gc+1ZGl6cR8seO579vblBER62rQPvJ2SNE2ZBQVkOKdmOj7O02geN/v56GNSEOYz67j8Oq9SfLylasNz1+42JDxhIWp/fl+teGfL/c3eeTOWi+5P+LXh9ub+/r28mKrEhk/GDTAwm0E44k8ldyqSmyGRPI7zHkMSDNtgIQv7NGbSQ2tAF7ofCot0oC/Xx+NuwKUnK8Pvo7s5CmwrQpgAiQNyTFtK4kSaYCOmsg4CZEo0VWibc97LkvfY5r3Z0zv03HU28KxB48nfaRg9p1MJiVKrMvS4p1UCqWwvGjaAMZ4zPP+ztI+qbcFCj7x8NkUNWbBNiRJQWlAkiIdz4SzX5rjmI96GpAx1NtCyYDTT15MGWCxWRXuU1CWdomMpyAawHnGlgzIeeptgQZkFZQEkxTUZUDGkU46BffFk2kASb0tUFCJWzHAYiiEfc6R3t9WSb0tUFCJfQZQhKgv7hLEWI2VqsWxvpD2Me82JPW2YGFsOdbFdLskmsJskONpQpqkGIko/QbhAxB/t3ibelvIezvFmbz/J/XE9+nm2VYrrq+vN3Q/Y0rxpOZKBtCM5GAD/IRnrt68NVlbW2takfNkHtE8qqJN4nlZiiU9T0F94mnCXAbkY26aMI94fZYGOPE8fWQC4yi4i10GqJ/nPttBBmyHFC9afF4/+iqhjzzqJROypVHUu+PQecuxnULN75obNZOq+V1zo2ZSo3ipShw4A3xPTy4isXneGvN7xV1/0epXYhzfCmaJmTW/KxjNgsduwWsLHD8wuHHyyETk+IHBoiuAP5XzVyN/PeaY47i/KlikAUssscQSS+wl8J2hX5z4LRLjCb4g5UsOxo8ONCBfn4mMJ3i/96qvTWD86EADhlaAROda4oGrAJ4Co68ACuaaQokZy7fAfYsqpXHmUx0UxKUzkvHNUf7/BlgGUDBNYJ/5VIdEWZC2S/8voAFJiS4Z0GUC55hPdaQoG8D/F5AZTwO6BJcMGaUBWQUUXiINGErmUx0lA4aQK0FDqSqwGa6OvirK6lFLPYOxXQO4xjeUzKc60gAa4e1sSRtgQbnux3XA7I/mwUgifEvreg7IeZJHdJZgjjOf6uCS+dD/F9AACuzra5v5VAcF2YSSeP4usAG5xM31fRqQ44plPtXB/wsMJQ3oElziIirgH4/zgLkTkjiIAAAAAElFTkSuQmCC"
}, {
    "name": translate("app.skins.efe"),
    "model": "slim",
    "texture_key": "fece7017b1bb13926d1158864b283b8b930271f80a90482f174cca6a17e88236",
    "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAFK0lEQVR4Xu2awYscRRjFcw9JhLiHoMIGzCVLIIRlEQJGDDkIghA9RBBBBdkl4EEFPYm5CCrkorlo9CBBCJGQu168GTx49OYf4D+QY8tr+A1vXqom3e3uzHTSDx71dVV1zfe++qpmumsOHXoErl35svnq3W9bfvHW9Zmtel1/9875hczxRgcX7UGgROgHl87M8bEJgIv3bIAl8R6EHG90SMEeBNmPfQBy3WN/+tpnT0YAEC3BiGYDVL3KFA7VluONDoi+cfXH2exLGPUqS1mgOrXleKMDYnMvoG7RV+EoMsBFlda713kWeFBK91EPsx47/Vk6So5LnK9xtX2zd3Ouz/sX9mZ2isrgsFRK/dOfpUNO5Gy7GNpv7b7U3Pnw1ZlAXXufFOdLhHtKmZL+LB04p/L3z99o6Y7KRnwSEZTc73WeNbIZGzv9WTp8diRKO3g6Luxtbc+EyxZo1/3aH3Sv2kl7SgJJHVyLbwkcUamdWwIkRs6qFHPmIe26/+ZHt9s6dn/VaZ9gbPYBD8RaBMCdUfnT7sutGJaFBP68+0or7pOLmy1lq079yACV//7z+kygxGvpqFSdbPUjELSnP0sHsylnRM2gxOC47Jx5yBJwkTD7+md4n/Rn5Xjh5LkGvnhqp3n7xLnm8sZWS9nZP3Hvrz8b8fb9P5rvf/u1pWzqNe7557dn44tel+MlfGwCu6/PHC5elPD3nttpKTv7J3BQG+KbO5stZRMExpdgJ/U5XkJjEFTE6zOy32C4+KEZ8PXduw8FQHX7kQHMvsY6kAxw8SKzD7N/Qg5KLEFAvKi2HD+Z4yV8Se1LBijqZ585/ZAji0i6iqztXPuHjx1vnnr6REvZuRfkPQTI7ezDGJB6+pAZKlNnFRK0tXFqTlgKLvFRAdCYzgxACsB5t70tA+D9s5+YOqvIGVU29AlEBgBHyAJmPx3OAGSdszTzGYy8J3VWIaGaIQQTBAKRgkVvT/H6cKWwnGIJyGYTrIktiXAuEsw14+k6dVZRm+1SnYuHpQC4Y7X1nP1LAr1vtpcCOTgAtT2gFITskwFwJ3zWkxmEvJdrvkH6MnVW4Wsekrq1AHg2yNkkM0MAfBYR56UHANHefwhTZxUuFvvvH7abBw/uzQUCuyuPHNtoH440juxs934EgaARELXle8auTJ1VpEOiHM+6Gj07fOP03xbYpYzyDdipOrWlsK5MnVWkoL7M3/SiBMt5Nkrs7Kf6zaPPzoLAbwZsteUTpf/8TXp76qwiBfUls6fSvx6pW9Qu5nOBZ4DaUjji/fyB0oOQOqtQumvNp7Ck+qgv61qU7c674C7XIpmR/cikFJ9BKAWg1xKYMGHChAkTJkyYsKbg+Z7H3Np1MscZLfw9QR/mOBPGinz4cpsHOfGXj8/OPbDlOBMmTFgO/MWHOOR0mZekg97wrBr59mfI/wsIgE59taGN6g2Pv+4amgG8Ih91BsC+/y8gACqVAbzry35rA1/vKd5ZOoFSvQt2Upellsda/dJbJNyF1s4fPeVLglM4+0P6sTKkaBeZs579agEQEUydH5n1Ovs7aKQghOcBCSc+3l4KADOcJU+A1KUfK0MGAMGlOhcPfZY91WszT7DSj5UhhZZEy85DUNryOb4r+Xyu/f0ApdPbS+MMhq9x6OeGTk99goBjfcnnky1D6VoGAbES5ueIXf9fwPd8X6YfK0MKgl3/Y+Ci8gB0EdOPlSEF9WUGoEsgRpEBXSkxfsyNnaJdvPqkHyvD//1/QQZgkfiDyID/AMdpmCl88QvjAAAAAElFTkSuQmCC"
}, {
    "name": translate("app.skins.kai"),
    "model": "wide",
    "texture_key": "e5cdc3243b2153ab28a159861be643a4fc1e3c17d291cdd3e57a7f370ad676f3",
    "url": "data:image/png;base64,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"
}, {
    "name": translate("app.skins.makena"),
    "model": "slim",
    "texture_key": "7cb3ba52ddd5cc82c0b050c3f920f87da36add80165846f479079663805433db",
    "url": "data:image/png;base64,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"
}, {
    "name": translate("app.skins.noor"),
    "model": "slim",
    "texture_key": "6c160fbd16adbc4bff2409e70180d911002aebcfa811eb6ec3d1040761aea6dd",
    "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAEsklEQVR4Xu2aTWoUQRzFszGEgJqETFDUEDWJCiIGVCQuXCgo2bkRv3YKHkAXuvUGbrxC8Ag5hGcaeQNv+Oc3Vd1d7aR7xuTBo6qrqmvqvfro6q5ZWKjBvUsXho83V4cKn+8MRnGFTndeLmR9c4eUqBim0v5bA2LPx1D8sb99jE5nfXOHlAE04r83IAqXaBpxKgyQ8LcPto6FNuDni70JA5R2Kgw4/PBsJDaa4Gvlsb65Aw3glJDIKrK+mYOEpFb1VNwGsHyqLMO4fsTpw/Z0DjYyXt9cWx7F1ZNHnw8mQuWpTFUdDJnP9nQO9lCMex5L7J/v70dhpOd/7FHGaQBDtqdzRMESKepawiz09+v9EXPXKqt7fD9NcOgRNZMGuKctxtcSKry5e20sWHHBJqhsNM3XFM5wZgxQY+Jw13Uc6nXUfb4nTgsKToVsT+dwY+Kzm7TQL09ujRiFk67HAmVwDJnO9nQON4o7OW5oUr3ufN4nUmguZHt6x+Dl3nDz3dMRFb8/WBreXl0chyxPcN7HuPJU787XV0kqj/URv26sDM3YGSzXGhIdGcUrZHkiGqB4HPo2IGWC01kfQQMkXiOO5VqDBrQZAaanQ0yz0BxZH0EDZnIEcEH09TQMOLwzmO4IYAOaMA7bT2vnJph6miiN5ZpQgslvG4uVVBnqzILiKLCO8YfdaMUXl5bHI2Bl/fJEPu/JkeJP3IDc4hTp6VFlgESLgyvX58cAik+ZwDUiLkputOJRvEYD880qEywm0vfkqPwiAy4+3J4QlROrsqQFRCHRAJEGpO6hEb6OZtG4FJ1PnVlQUCljo6IBEu1pIDI/xZRoCmxK6syCgkpJA9wLNsDTICfQPNq7Oi7j+NwZEBlHgKdAjhIsquHxuhMD+LwuJcW40XFR9dOC5ZoYwN9rSurMIt7EN76q116Tzosa5h4hEq/Q0yPFaByv2Za6NjmfOrM42F0fkh8fbY3I9BS5R2DP5x6nTUnhFh+32QyLDND+nrQ4pqfIBosUzGuS+45YnuJpQgxbjYB5g1+3FTLvVEDCZ+ZQpQ/YAI0C5p0aSLxMYHoviF973DssY3joRtZ9PGUdgn9nd+P8Mbo+lu8MTQ2IaV7QnMcTpVjWcL5EO03xqns6QRsDKNrDO1XWyBmQK98Z2hggKC1FlovodajnUNfwuvwSTKueBe6+ShnrqhNYl98LKKiUsa4m4pqUifCboanPXQ5TdDnWkwX35aVkfdMGX52bkvWc4QxnOEMn4LlC6eFqXMjafODQU6bXLTEPU6L4Jsfr0QCd+pZ+4pLw3I6zE9CArkeA3yVmxoC2I0CbmjYjQOI7fU/gxqgJvYtUnJ/ITe7wTOf79/lNoK73p74+UBwF1pHC2xgQ43UCvUgyvTUoiO8KzBc9PfowQKjLL0KV+JQJXCMovM4ArQ/RAGKqvdsEOvaiqJxYHqyKFC7yxYasMqC4d9lbpaSgUlJ8U1JHa1BQKSmolBTWlG4/p4jIbwikyowN4AJVSgoqJYU1pdvPdE6XHMcG/Ct4PN0V2Y7eEBvFE9x4kltC3k/OlAH8v0Dp/wskJh5zxzP+FF2O7egN/L+AWPL/AhpQJf4kRsBfkTxADPB27yIAAAAASUVORK5CYII="
}, {
    "name": translate("app.skins.sunny"),
    "model": "wide",
    "texture_key": "a3bd16079f764cd541e072e888fe43885e711f98658323db0f9a6045da91ee7a",
    "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAFJElEQVR4Xu2awYscRRjF8x+I4MmD6Ap6EFmIyC4RERVhl0g0p01YYQ9qhEWR7MFADAYky16CCOYWJMJeIjkk59VLPPoX7N/hP9D6Gt7w9jfV09O7Y+9Mth88qrq+6m/qffVV90zVnDvXgqWlpWp5eblaXV2tub6+Xpdqk+3JlysTSX8LB4tO4XlNwST9LRwk2BngWXddpGCS/hYOQwZMkQFPd94bE+42+ls4TJMBEptByGv6WziU3gCmM+DwzsWRaFNtz0QA8jWoAHA5WGyJstHf3CHF5cyqTPGTgpD29OXnhOulezme3uFBcnAeYApvCkBJaFMAeB/H0ztKs5yizBSe4kxmgtvsi58zNwHY+OB8ZV75aGXE0sAZmOyT96ZP8dN33ixSNo6nd/xw9d3K/OfBVk09wHQtYaoL/3UdPdxUF1RXH/VV3fenzzZyPL3j7uaFyszXl65VWlQT1Wfn0ttHXofp07x9+a0jdDvH0ztKX2D4OrPYGx++XDMzha+9kr8H18qci9ekB0vySw1nPgWn6K7keE4d7+/8UV269bSm6ltbW9Xa2lpN1dmfuHn/fLX8+eOx7Nj8/oVKttev/DaR9Ed8/dOrtS+XzEb27wwGwOJN9ic0KAWAS8EDlsgXL94rcpoAKIjy5dLiZ5ZRDEDXDNCgSgHwrJ00AL1ngEQn2Z/IJZDPEM8aU56kP2LmGaDB6oNVTqL7MECahU++eW5UOgM0QM+K6jlr2T/bs5QP1T+7+VL18VfPj0r2pZ1+qHcMFnfh+l8jsRIm+lq2DFLaOSDRgfEscVAsOavOItW3996oxblkX9rph3rHwABwhm3LDLi693fNpgxQuwVywOzPYLg8lQxQ2RYAMe0SQR4cHIzqGggHlSWD4fvsW6JOQuodQykAnuG2JeAAkdkvAyHRDBaZvuWDgrqSesfgAHjQKTDbcglkv6b7c5moLbOCwbqx9+voM51dzrB8wvPLlTnJTr1j4Ox1pQOQzxAJpxD3y3vcXwFQvXRPvuP5dZyvwFIf6h0DBXVlKQASkBlgUc4QPlRdt3Dfo5KCyMyCYwWAKZNO2G5b1ksBKKWyyQD4/rwn+1MQWRrfsQPAm5s+JMkAZCo7CzKlJwWAwZONY5lmXJ0CwB87/s6fvwHItHMpZGpz5kt9Ofu5dGSj6BSfa5/l1AHQ05k8PDysyfaSnRlA0aU2PgNSNK8pvBSELDtnwIABAwYMGDBgbnFt75Uqufv7yhG22elv4aCdnqT2FL67/1pN1dvs9DeA+OLOk4q8/vOfNdlestPfcaD9ALb1hs1bDyvSQtlestPfcfDjL49m4mdhceYD8O3te2c7AAOeJeTujuq5szTN4SoPTnZ3d6vt7e26FNl/7sAAcDuN/QkepW1sbNRUEPb391vvP3UwAGc+A7yBarI/sXAZ4E1Rb4A2MTdBM0A83WUG0M4DVo6nd3BXOHeBfc1zgLTzfJ8ZQHvapjr//7/BAHCGbWvaBucML3QG8JCjKQC265rH2V3Zth/QZqeezmAAdM2jcQYglwAFdWXbfkCbnXo6wwHw+uYaNzMA2c/HW0k/+fMNILJdfTmezuBvff7eLzHtEnYSSpiPtCwy3/tNdF/q6Qz+1ufv/RLTTkFdyRm2eL3zKdq0TX2pp3fwaDoPJ9luW9aZ1pn2TUsg6xxP76C4EhmEpIVkanPGmzgXGcAfO/z/QIlpz9TPGaZYcmbPgJOC/x3g/wdKTLvEOAMoXmvd6730TJhFBvwLF5puRHnAy2sAAAAASUVORK5CYII="
}, {
    "name": translate("app.skins.zuri"),
    "model": "wide",
    "texture_key": "f5dddb41dcafef616e959c2817808e0be741c89ffbfed39134a13e75b811863d",
    "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAE10lEQVR4Xu2asYsUSRjFvePSEzY5DkTB5TwVAxUWTMYVjeQwGcwuMdzkNtxMPC5YQwMVQTDRwEhDweP+ATExFe5v8fp4DW95++vqmS12bae1Hzyquvqb2nqvvurpqdpjx5bg+A/fNes/rTUn1n5sVHfp+m+XT7e8s3l+H93O/kaHFF4ywkLThGxjf6MDxavMrEixJbK/0SFFc/aZASWyv9Eh17uM4DKgYJL9jQ4UTxMomGR/o0Ou/Qsnf+48Cyz0q/4W8KzbAGYAxacJ7G/lYCFc2/mg4zLgvYzJstTGz3I8gyPFse5Ss7l981Jz7/aVlqqrjcJK5mRfabY/w/EMjhxs0qJTOOn7NiONoNAsM47jGRw50Idbt1phBxFfMkHX6iOFUzxN4XgGhwepB1afeOH6qe/3rlUXHEcT1FdpKXC5rIQBOXiLTgOcFSXqXhrgz6aJNCNNWIlvCX9d+auLgpI7s3MtfZ2xZn4FlvpkLMczOPjmRmZmJCl2GR3Lz3A8Xxxvn+40yfX19X1kPPHnmY3m7wdPOoLVpnvu9/6dm/vodvZHvP/1RvPvxVstVddk7P5+reWj7fnSzy8FDdjY2NgTrzrjiTQgZ58G9JH9ESn+xbnZXjYeWUY9v7vVJI/agI9vH+/RorON/RE24LNlQMmAJOMJG5DPCNWPyoDSEjhUBmgAEqryw+vdlh6Mr0sxptJQwkQP7N3LV50nvgzwfcfrs6Lulah7//xytWUKt3gvg+zPsSb1dpDrj+LSgL4Y/ZEcgAcqE0SL8aA1QBqQwtxm4RbkuvtxnPviGPw56u2gJIwZkCawrj+Ug2aK5uBNx5dik2qnEck+A/w3VFJvB33iF5mQpAE5myksM2DRDFMoBdaSejtIAyhe9/gsyHjVPRMpgEJoiE0oCc8Ykc+SJN818qFrUm8HFEXBfeJNi0kTSsIzG3IJMDbFq07RfBtNIzLGJfV20CdM1JN/mQEWQzIbeL/EUnwKTeGlV3K2H8gAfu/X0sYkuZRySdWSgnmdWcC4QQz4Y/NsL/969qYl22tIwUm9/dkAU22DGkByBknGLyNFW3hJfJpgI6i3g3zPF2ezWTOfz9tSdDt/FZopSnU+I5I0wde8n9cWnVmgd36nvVOfpWIOZICFpti+6xJLgnLNqz3fKRhPk8iSAf7hY8Fqc2nxB86ACRMmTJgwYcLKQrtK/3361Etuo3knSvdUsr8JEybsB3+z15L9jQ75y6vvF1neYxv7Gx04o7VkfxMmfOPw88HkDhLjCW6Re3NjNBscNKD2eF1b4WmCT329I8T4lQM3NWsN4IHK6DKgZEDN/xdwCax8BijNc4OTm6B+b+jbBFXK+yDT6c8s4HGZqWuOZ3DkercBFMmYJE9zfSRmE1I4S8VxPIODwlRnBqQJrJcMyFnO2c9zQ5ccz+DgrKYBfSYkaUAtuR/A/YIk9wqOZL8gDeBrMk0oZQvP9nm+v4iK5XgGB0Wl4EXiTQuh8DwRYnuWHM/g6BNG9sXRAB6DUTzvczzVYLrWkt/7tbS4NCBZaktSTzVyhkozljOXpesUVMucYZHn+4sMUCz1VIMzWksKqiUNsAmLjMj/D6CewXHY/y/I9M9ngc/3Swbk0TjHMzgO+/8FEuSz/RTPDEjm/wdwPLX4H8bzDGXhwa6jAAAAAElFTkSuQmCC"
},
{
    "name": translate("app.skins.steve_cake"),
    "model": "wide",
    "texture_key": "b182ad5783a343be3e202ac35902270a8d31042fdfd48b849fc99a55a1b60a91",
    "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAADOElEQVR4Xu2ZsWsUQRSHj4QUaWy1sImdIAoiAYUgSSGaylRpBQsRLM46zRERrfwnQgQbsbOLIKidhZ2dpY2IjRxcMd7c3Syz35ubvXezuew5u/Bxm9+8fffeb+d2wk6n1+t1Yjy5ddmkwHxajOmb6Uc/Ob8QCBvSwnxaRn3+/jPu1346JgfjtQiBsCEtzKfFNTr4/sOYjQ3zcb0zPp+YwHgtQiBsSAvzaSlu9dZWgTUhTwP298efw5mQnwHOBK95ezBeixAIG9LCfFpGXXoN82C8FiEQNqSF+bREl8GhMYzXktxgKuMG+5O7PDkPUTUeI3JtcwwgpWkfGCeRJmNxZ26AXdOLdb34J8cV6A6v+CE2/ufb91FKOWnCJJeN6Rzu3jBnCX+TpeJRrB1j/CzQYPu3G+scPbprPhw+KGG1EIyrgteHYLF+0T4cr4uxO5weQzilOD4LbCIEC1o0wRlQF7zbIVjQoikegvxtpsKH3TRY0KIRwrm9F8bn1cHTEowndy6smBjMT5iP/DruGse3gz319UQITFi3AdtfPkVhPuI3fyoGsKCmGnBqM4AFNdWA2maAvWi9966ABVmNX+LDBh9eWo3C+Cpsk/5d5ww4ebwtcOZY2DBJNoANvry2FoXxVSylASzU0UgDrl55Zm5uHo1wBuzcPhlhNTsegwWzSML4KhZqgMU1n2LAYDAwx/c+F4Xac6v91wZ87e4UBjj+Pt8d4Wt+7CwslQEWV5z/LPDPXRwbnUbjDXANhQzwoQE+bNo3tfEGcFW4/uZ1FMZXEVqZqlYof1Vjw6QWA2LLKPFjWXiIWM5pOVQG7JxfMfcvrhZ0N9dK2PEY/EIWSVoD5jAgBuMJGyZCyA0h5IYQckMIuSGE3BBCbgghN4SQG0LIDSHkhhByQwi5IYTcEEJuCCE3hJAbQkiFLyS0m6t8Ccp8jE9FCKmw4HkM8E1gPsanIoRU+ApsHgOWegbUYcBSzQC/uNBL0aoXmKFNDW6A+BshPjae9WgRgpbWgNwN4E5RaHfJwVhLa0BrQGtAa0DWBnBVCK0koRXFrSqsR4sQtLCh7Azgdjm31/2td8a67fXWABgQg/GsR8s/quvoLEoGqMUAAAAASUVORK5CYII="
},
{
    "name": translate("app.skins.alex_globe"),
    "model": "wide",
    "texture_key": "6c25523e7dabfcaf0dbe32d90fd0c001d5d57ac66206a0595defe9be5947ff08",
    "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAEYElEQVR4Xu2ZO2gVURCGE1CsxEIEESQKQcFCRQXBSkihpSBiIQgBUQvBB4hCjKQQtFFQBC0UH4WNhVaSwlIFS220sAhiZ2t8EGFlFuYy95uzZ+/Z3evNzab4SO7MnLPz/3vO7rI7MjMzMxJj0/6L2eqzB3Lkf0VjG3Yfj8L5qvDj169MYU558/5jZmG+CBcgmydnM2Hd7b35X2HttV35b4GCCedLpUg446nCFRcgKnps+ktHtIWCCedLJSRe45qrcuYVFyAifP29rzmHn13pIOIlt/XQHSdakRznaxIawHwvuABR8cLr2Rc5aoLEBmlAE7gACRmg/A8DYluAsSq4AJEzTeEqXg0ImaBxzpdKSGhTF0DBBYgu95B4QS+SRXC+VCiW1BEvjMhZslf6rdfm3JXeXvyseCJj7d1CnhPWHD3W9fwgSEzj0kRIpMYIBRSNYa4IZ0DR7U6haJuzY+VZQQ0oQg0QUhu30CSBD0ZFK6XLgC0XPnVMEAGE4mkAxccM0NXAhupCwTHxQm5AkQmCChFkiVtolq2NibcGhJqruhrKxIZq82d9NUCaDpkgXL9xsANzgoxR4TIHBVM4DagiusoYxRlgV4FdDdaM6asTHVQ0hQs6X+iiR7QZ7mE2XJWyVZEbEDOBqAE21rVNIJ5wNdhmqhpAkfZ3SLyNdQywJvRiBFFRMfE0gQaQUPPMhWqK4qFcV1IYP70is9yaOt8F68mH42NZDM5POB/5+/llpszP3kweT1yAEzZtwNTbySicj1jxfTGADS1WA/q2AtjQYjWgsRUgg4483d2BDfEAhAK/XdoWhfVliEh71rkCvj+87FBzBAomI6N7RjMLBTJP2DAFE9aX0XcD+r0CtJFWGmCbVxNYX8bQGSAHXVhYyE492N5pVP6XmORYX8bQGKDi2CRJNaHvBpwcX5FZbuxY2QXzxDbKZv88uZvDpikyBufkXBSfbAAFPz68qgsKpkkxA0JoHYUWEZtzURjALWG3kzYh/6fcBextNrQtFcnx+OyBgkltA+zBYs3+fLQvh7dJwueR2JyNGMBH3XevnncxfeaEw9b3asDvFxPBhvlgZcUvKQM0x3o2T1hPWE8omLhAXbifCesHjQvUhYIJ6weNC9SFggnrB40L1IWCCesHjQukQoG8rRHWl8HjNY0LpDJ3bmNmmb+/Mwrry+DxmsYFUuEZlvu9Rev0N+vL4PGaxgVSYcMh8UorDGCesL4Mjm8aF0jFNtprwxQZg2ObxgVSqdIoRcbg2KZxgVSqNkqhRXBc07hA23CBtuECbcMF2oYL1IUvJPjChfWEL0E5H+vr4gJ1YcNVDLAmcD7W18UF6sJXYVUMGOoV0IQBQ7UC2CANKHuBGfqowQ8g9kOIRerZTyoukErslbbAPBl6Ayi4dSuAgpYNWDagZQbEPpwKzJMlZwC/LtMQmtN6A7glZKtwG4W2k24p9pOKC6TSegP46Zyf1/kobJH6ZQMCBsRgPftJ5R/ol9XBDMVMugAAAABJRU5ErkJggg=="
},
{
    "name": translate("app.skins.sheep_cosplayer"),
    "model": "wide",
    "texture_key": "7cbe449d9d37c111a07a902e322d3869d98790c48f1fa16a24bcbe2d8d73808b",
    "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAADsklEQVR4Xu2aPYvUUBSG8xOEBREXCzsLbdfa0srCztbOf7AgOLbij7C1cm1dC21EsLB2C0UF2cZawSJyAmc589zPM5PMZDIJPGTm3K/zvvcmk49pFotFk+P669M2x+Xjp1nYn5drH3+2OTgeYX8kCBAKJjJI0zRRahIoISJvfv7dcf/sz8VnQQ1gGyVXpgQBQsFkkwaQvTGAM6+rYW8MoPi9WwE645bZgDEZkIP9eakxIAf7I0WBm0CEXHl/FiDx0jkg1VbgODFGYQATpwGpzRoQM8L2zzGVURpgRQn/XjyKssoKYHyUBlgjBDmhyqbCZZPYKgaQnTCAM19aARrjOBxT9qMzwApSgTr77Zu3HboKUgYoHCfG6AygGUsGPH7SsYoB/K6MwoAUFJSC7TwEFwZfHt5pc7A+4QBe2B+heG9+JAiwQ8L6RETcu3UjCsXGYH+EBvx99qCjNj8SBCiYsD6ZDdiiAbJn/RKBYO2QzqagAOHr928d2od+Z70aKNgLBZNBDJDt+NLtiwsW+Swb69VAQV4omAxigLRrPzxfQmKsVwMFeaFgMqgBr+4edeydAX1CQV4omDQikjcZKWjOqrPqgYK8UDCJGqDHLeMUPxswGzAbECTcNzzpcvwSFEx2wgAdy+am+dEgQsFkZw2QeC8GMMAEXl49WoL1CdsT1veiT4EUlnsJAkx4bAbYt0SzAftqgH01xnIvQcL8HWV5DRxEYb0aJAcRyveC9t0gcV0H6CBKrjObVM4cDqKwXg0xA+zbYS1L5cwcSNQA63CNAbZOblDWS7W35bKnATUrQMpzuSg7Y4DOeq0BpVyU3gxgEiXYPsY6K0ChYDKYAaVk2T7GqgZImfZBwSQIeMkZwL+z9GGAPRTYp+17UgbE+qfQFMyXNO9OT9rz8x9L6Ma41CU5A3LLVQWWDGDCfTOYASVGZYDl08FB++vwsEM+s5yURKTQdiWYcN80cn0vQmvgfUHNvcHYCQKcAa9gPpAgrE94qKzbnuUkCEzBAPvrw3ISBGYDJmCA/fllOQkEe8/WTJAPTVlOKNiLvc6QfG1MsFrYVojeC1hiZtjvFDQWA/QQSGnTNlED2OkuGmBXgO7ZVpiEAfqAlPnnVoAyCQNKK2BQA0Qk3yCloDkCE/LCXG3MGqB1SPCz4CVmgOfVGhPykjNADg1OLgkEedm2AUpKqI3HWPt2eNsGcEK8bN2AEjxpspyCvKz9PECSoFCPARRo22sfqboCBXlZ+3nAEAbIflMG/AdGckNyTM+wKQAAAABJRU5ErkJggg=="
},
{
    "name": translate("app.skins.cardboard_cosplayer"),
    "model": "wide",
    "texture_key": "6acf91326bd116ce889e461ddb57e92ace07a8367dbd2d191075078fccc3c727",
    "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAERElEQVR4Xu2ZPYvVUBCGbyNY7C74gRY2y4Jg40fnIihb2qhYWcrCgpXNFoKFKNj4D6xlCztbGzsRwfUXWO0fsPEPRCYw18kzJyeZPbm5WfcWDzeZmZx73jcnJ8nJrKqqWY61i5tVjoNH21nYXpRv7/crRfZ/HLysLKyP4gKEggkFE7YXJWXA57e7NRorwQUIBRMKJmwvSpsBNlaCCxAKJhRM2F6UlAGMleAChIIJBRO2F+Xo6FclrAxYlgEXNm860YrkKJiwvSg04GDvXvXpxeNxDVATUtsUTNheFBEpogXmUrEo8zOcEtdn25Kq4aghektTvh4ezmFuEdTX+Jmza/MOjb0tw9liDdCYnq22/eOgx0/OgBQUzP3jIJeW/M6kE8uEHcsxhHDSMODLs50adlJm4adXz8/zsi0xmeT6HJ/D3tKIXKNts32qJkUuX88BFEBRsi/x768eNNBaW6+1FJmDnWIHdXthBvC2lUINqKrfNTSgBHaKHdTtSRjQNgJK4OstX3XbXntTNSnkOmfM5hqNCutXtirLk8u3GrCebDzcqUpge4T1Ou+ooazvwgVE9KUb23OOYwDPssLOp2B7hPUrA1YG/DNAflnfRX0b5HVvDeBti7XskEDhEQOGhoJJ2ADW8w8VPTMK831Z37vbYGN/q0lHPQWTrAGyTfGuHn8YhQKIqz9tBvAy4shinlAwmbwBFByFgsnKACdoYgZwSFMgYT0Fk6QBFop39QlRESiYUJC+h7TBegomM1l60pVXRd/6GLfLVQoFRaFgQkELMcBCA5gnThBvU4D1XVBg6q00BwWT4hFAgefeXcvCegomFDS4AXzWf3P7evXx/p0a2WaeUBAFE9ZTMKEgK3wQAxggFMz82MhChq7mCMxHcQEyZQNkRYf5KC5ApmzAqR0BFuaj1B8YBV09ZQHR+twHS9tmLt8Hu4qrou2qLtvXkdF3hMy/skhxH0elU/bLCvM2lzKUAqWObebaH5qGY0MYYNvjOrwV3SW8rf2hqT8wRK4p6ZQVxbwIF2Ecim1DkoIJ64fGBUpRE3n22wxj3o4WxoSuSbDLcOICpdhJKgXrmbd18ktBbJ/tsZ554gKlcJamMA5t5pWfH17P27DieQz/fxIGpJAhLb80gHVk4QaUvg2yQd7mGKMBuePGwAVKsSL0DNihL6TOzNizv+ICpfBaZqzv0BwL96wfXQ9ggykDpowLkC7BhIuqu8//NGA9aVsT7LvAoSNMzNdJM4cLkKgB9rviMgzQOabv6HMBctIM+O9GgIiOGMDnCOaJC0ThRxMawI8sjFFwFPZHz76OAMHejfig5ARFKTFA9ikoumrM/kRxgSg0QIStDAgYwE9ZXNdnnrA/UVwgSqkBFDz0l58uXCDKyoCVAd6ANpifhAGl6wGlx1PQ6AYwEIWCaADzhIJOpAE80ydqBPBZP7oeQKLHU5CKHsuAvw+1fL9JgifbAAAAAElFTkSuQmCC"
},
{
    "name": translate("app.skins.alex_party"),
    "model": "slim",
    "texture_key": "66206c8f51d13d2d31c54696a58a3e8bcd1e5e7db9888d331d0753129324e4f1",
    "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAD6ElEQVR4Xu2aMYvUQBzF90scWLgIorCKCF5xHIJioYWtIFjZWpyVje0WNhYWgliJYGNjY+kHsLEUEfwAgoWFICciHqz3Am99+2ayu7MJk2yS4kdm/5n537w3k0kyudF0Oh0t4/vj/Znz9eH5efnj3VMFGkMZIO752kYQcCDox8sbC2is8wa4+GUGOL0w4Ofr+0vxfG0jCDgufjBgMGAwoFsG8NaVgt7yquIdyk2yARD/692T2kzwDuVm5PfuVUA8DagD71Bu1jJg5/SlgqMvbwv42+ttgncoN1EDKBRlCD08/D279+LiPI4yYjiHpz2tn4p3KDeFAXycJRDDqX706fNcYMDxuXm949+ex8XG4t6h3Iy80wCCMMIUBv68elbEAMqMs67ncLEoc+FrtQEcUR1ZNUHF0wDP4Qbw6AYg7h3KTRA493x3pozH4wW8vnP2wbUZcCPImUcXluL5HB0cPGjx6PXWJQjUYYA/DRIY4Pkdz+dw5v398HQwQGeB11uXIOAd6rwBuO7wh3kNHnw7Me/M1fcni9jO7ctzWI9teM0rLpziy+CiqIskc/lC7JeAouuDCy2jMEDxESkzgLh47ThxwTH01ggx2Q2gWI78pgagDcvsrIsF2oa5VAxzZzNAjUidAWrE3pv/lxAvpzLRWkY7zYvfWQyIJeEfQdnPOyoKuIE0gOe8Pg2IkcWAyWQyI56EBmgdR4XzqAupljmqagTKPvJazmoA2N27soCfd/TyAGWzgKK9/ipab4BP57ppxID967cK1jVAFzS9g/gzBWeB1tdLwKf/1hig+LR3vD4NidGYATfvHBSkGEBxOOqtUGcER5WiWfaRZxltshjA53yK4gzgbz+v+Kj5iDtefxUQA7EKYzEDeHShZQQBJ/VlaNsIAn0jCDi9nwGdN4ALFxcdv3cjpk9mrMc2nnDbqPw26AnLaMu3QKfyfoAnRBuPQTg/q/u5pql9BsT2AyCe21xev2mCQFUoHkYQio/NjqYJAlXhyFM8yzTF6zdNEKgDv4yI12sDQaBvBIG+EQT6RuX9AE+4bRQGoKCifD8gVqczBnjASX0Z8pU/tT2/EWLXRzc5vF5dBIGqdM6AVAF1GrDJFlcqQcBJFbB1BviLDjqtb4PAX5b0Rcjb68uQ7/DGyrqpSfE4+i6w7vjWaUggwEdQxTtIUKU9cANi4hsxgCPJjsbKSFDWfhMDALa7XXwjBqwjAAlcADqnnfbzq8hugAdScQG9M0CfCmmAgpg/PXqbzhgAUj+vDwZ00YCUz+uDAU0b4B1K3Q9wUtu3wgAUtFMp+wGAz/ll7f28EjMAAmP/EwBQp04D/gEkM/45yXRakwAAAABJRU5ErkJggg=="
},
{
    "name": translate("app.skins.steve_party"),
    "model": "wide",
    "texture_key": "c05e396bbf744082122f77b7277af390d11d2d4e93dd2f8c67942ca9626db24d",
    "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAADXUlEQVR4Xu2av4vUQBTH1x9XaKOl9bGFoOBeowg2ZyXXWfkH2KjVNVYibKFgIXa2Z2WvhWCjxYKIIIKWFnJWNoqFIGITeYEX3n5mMrnZ5GJyM8UHMm9fJu/7TSY/ZnYyn88nIa6vHylCvL65GYT9DQ0nQETkg3NrtVAwYX9DwwmQbECNAXkIpH4FJG9AHgLmCuCj0ZrD/oZG43NeoXBeDXXbTbCgvtmTAT+ebjuxrmBBfTO5cupwEeL7zq1iOp2WiBGCtkUA82NhQX0TNEDGsAje3f1cogbYtuRwvxhYUN8sGfB38bBE25/uXK0EX7p4rzJAttUAyanbfy+woL5xDLCC1ADl9/2tEhtj/qgNEAFERMpY18tekZgaQCgyBAvqm4mMYQrwGeCjzgCFL0U+WFDfOIHzGzcKy+zkoSWYT14uXhUhZrNZEPZHvnz9VljUaDWd+U04gS4MYJFKFwb8/PWnUPbFALnDK20M4HDwGaDvE9mA/2kAL3kacGZ9a4mN09eW4BgXpDgaIDHmCU9ePA+yeP+xEkzUVCL7KBRMog2gCfZgihZY17aweDJKAxS9+TFuYfFEcih80Ab4irRt5rN44uszG3AQDeDNLzkDmuJ6PyE0zponUDCZnLj9qDg2f1Zx/PG7JexvkktY+H4YwD5t3zz77IuCyYSiN9++qQiZofDgtjhBirBnjPlNDN4A+2krB5ei+NWo8FNY4Jsm4QuVD35hxnxtVkNAC5JCdy6sldii7RDQ4mQ7dA/xwXx7P/FBsXYyRj/HrWDmUzBx5gRF9N2zR0t8Z41niILqhNbFKZhQkBVeZ8CH7ct7N4ABQsH8few4AZINyAYkbsAq6GO0rj0knEAXiFh5bKpw3WbeEHACXcAzzvaQcAKp4QRSwwmkhhNIDSeQGk4gNZxAalQbTfMBdqeD9Frcej6AHY4NJ0BiBXPCI3Z/zvrqxIZOdjC/LU6AxArowgA78TlKA+wcYOz+2YChGdAEV41oAIcEJz05p08DLL7FE9YTixOIpY0Bkp8NyAZkA7IBSRvAtX2+CSpWtCL5rCcWJxBL2/8XjP4K8ImuW2Ln0rqQvAFc2W3C5gusJ5ZqY9X5gLb/L6ABvvX/ELauVWg9H8DfY/f3GWCNoGBF/wNAQbH8AzbvMlGP5kSQAAAAAElFTkSuQmCC"
},
{
    "name": translate("app.skins.creeper_pinata_cosplay"),
    "model": "wide",
    "texture_key": "b7393199a84eb9e932efa8dda6829423875eb65af76cb82912ade62f93996b9c",
    "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAADuElEQVR4Xu2asYoUQRRFNxZBFg0MBUNBMBD9Cr/ATBCMRROTAUNNV3/AxG8wMvQPBFMDERYDA0105Ba8oeZ0bXW/qurqXmeDs7e3uubVu69rZqqr52iz2RzluHb95rYGxvPya/NyK769u7OnxpVbz7IwHhk0EBrywnheZPLnh/vBOFXQMGE8MmggNOSF8byYUZkmBzUDyMUMuJgBBzgDqAczA3JfhTRMGI9UG6xFJk4fPd4Z6n28eAGUhCWVOo6vlrXHbanXeI5XUYBLJ5/O1NistafaSnXxAiiRHDR7Vlspqy9ATCvTMasowPGTj6MaX3WR6lOiixdAiUwhVYAWrKIAV++dZFXEpuNj9vXqXlXF1xcPtjnYn3AhQr48PM7CeIT5fH/7NDA1PzJo4ACE/QkNExomjEeYT2x+Sn5k0MABCPsTGiY0TBiPMJ+LGRCZ1zH7jzEI6MU+jOIPpRzsPwbH80LDpEkBPr+5vFOZlOpqpzTuO0U5nhcaJtUFMFOGblX//vkdsD72v86x/xgczwsNk9kKoO/40/evAvb/f1sAM2a7N2rnh5PUzvM1OeV4XmiYVBfATMWoXaZttccCeOB4XmiYNCkAr5ydk/nXN+5m+44px/NCw6S6AEqU8Coa7DcFjueFhkmTAvx4fnuyptpyyvG80DCpLoCZmguO54WGSZMCaAlrCaeOU21TjzWGrfeFfbUK5pKChsmuAPZJTR3D1vCWeOtjyyUugClzSUHDZNBglTd4fml4r8DzXgYN56EAtqE5WwHiqcjzSzN7Aez9Z/D80jR/C8ikApUqA7aGhr0wHpl9gFo0hhZEpcp4pPoBAwO2RiZqYDxS/ZiJAVtDQ14Yj4QC6FFxqTJga2QidZc4VRmP7P0CowQGbA3vKL0wHtn96KBUGbA1MsGr6lHGI7tfWJTCgK2RiRoYj4QCqFqlyoCtkQmtSkuV8cjs77FazESpjjH7e2zthCmmg1I97wwaNHVieH4MbkgQ9ifsb9iGCPsTrVBjeJ4MGtZaACsC+xNboouiAsR7AWsqgGcGVBegZj+AiRP2J+wf701OLYDrLaBOvMf3KBPuDQ17GVTMCxPqjb6NlEephrtBHZQqE+qNjNRQvR/AhHpDQ17C3aCMlCoT6g1Xpl6t3g9gQr2RkRrC3aCMlCoT6k3qqnq0ej+ACfVGRmoId4MyUqpMqDdarcpIqVbvBzCh3mg1Z0v2Eq3edWVCtcTP/+PH4uxncGnrJfyRmVJlQoK/McgZIPHz/x4F+AfuuU5a4+l80wAAAABJRU5ErkJggg=="
},
{
    "name": translate("app.skins.creeper_cosplay"),
    "model": "wide",
    "texture_key": "b9f7facdca2bf4772fa168e1c3cf7b020124eb1fc82118307d426da1b88c32c5",
    "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAEVUlEQVR4Xt2ZsYoUQRRF9xNMDDTTRDCWXRATwUTYUAxMzfYPzCYWv8DI0Ez8AdFE8A8U88VPEAxG37J3uHO6qrp7uqa67QuX7qp6U/Xufa97d2dPTnrw88ntbYkfb94rkvtNxdnp8+p7FhEi4tDStUTuNwVxXnMDoso6OOjjlh3gwj0fjzkKQoRXnKRgkvsdAgltKlzw553iW3SAC57FgBBB4U4KJrnfoZjNBK8+u6BFBwhugF+PjhChSueuJXK/KTiKaFVxrivzKYksrTlKcZ01JtT6upfMHIgk5uSvy8tZObsB/lKNhFqPZzdASakinijnjrE+uwHfPn+ZlbMbwHdSc/Ct3PrKfJpjs9ns8fzTo63z4fv7e2PGk28f3NlOYV9+269vtuKfdxcdMr4X/ECIvPj+bCc87v3KeJKCxrIvv5L4KgZ4xSXazWA8SUFj2Zdfkw6QYDdD94wnKWgs+/IriT/IgBAmsvU553EaU0BthiivOjvgx8vHHboh1NsBBanipIygGUy4NpsY4FVnxd0cj11VB7DaOdKsnAG/X79IknFD2MwAVVpCOXYDfMyEg69unF39nq0k4j7mGDeEzQxICeccxecM0B8eufEYNjGAJuieXeCxQx6BuP/w9HTyI1AixR9kAMVSuAumWUw4GKJTZNwQUtwQHmQAmZqXAS1/D6C4IRxtQOoZF9kNHtPCALY8SfEHGcBK516ENGg1BjhdqN/nyIRrk4JJih9tQG2og7xT1C3sML54I4b79YGPKNebIyXc3zE0w9eD3K8P3IPrzeEVdSM4x3WJ4H59WFwHsNocl6of5H590B7al+tHR6rF757fuiLHKWP8nnOLqGgfvHpKPMT+W9qN4z7mWO0hXcHzFgdW36nKe4UpUOSc4nje4kABpaRpkgyhaI/hHosDBZSSdqP8cxTt5nCPxYECSklTKN8BKXO4x+KQEsAYgcLdkJT40uO0GDBxjfWTIFj6EZh6L/i8vxe4lpr3z5W6sRpSiV9Xbo+aZ/L8vNMFacxYiqcJ+9keARLmCcZVVY+10u8AbopfaShj+Fk3wdeYbxHaQO2rMeMcFMMxE88ZkVrLraeEa073mme+HehDosTThP+V1Fsd/GekVysS8MrFmPFkfInBr76djO8DHyWuTwYT0kFsW5nBeFJCaxmgTlA+XJ8MJpR6Lt0IxpO1O4AdyfXJYEKlF1msMZ6s3QEsAtcnw1ss1fqsgGJ1n/pCk/8Cy5kR8cynOfz5cuF6BLwCEu0xqzDARZXosavtAHaBxhIsrqoDXLAbwq7wdZmyCgPYAV59CqZhqzEgZQTX2CE5A4ZyUQbw7e9G8BEpdcBYssP8vNTZXoS4Us9o+IY54UzAxxQ0lm6on+VX5ZI6n3pGww/xZFKmeAIaUxDbvEQZ4KJy1c+d3xFzPbn7z04nCOChTj+QFdC4hgEu1gU7/Xw3pvN9wIl9F+AmDKU2zj17ZA0DpvAvhasBunPe5YkAAAAASUVORK5CYII="
},
{
    "name": translate("app.skins.buff_butcher"),
    "model": "wide",
    "texture_key": "5e4e09eccbce11e701c51bb64b102d688a6ac4018c725dd2b780210aee101b31",
    "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAADPElEQVR4Xu2asWoVQRSG8wbaaKGCaLQQCwuTIJJCEIKiXAyoYLDQNIJCwCKPIFhY+gCCqexuE32DW9rY2PkcNhvOhXM5fnt2Zid3M+7o/PBxNzNzh/P/d3az7OzKSkSPb11qQhzu/QrC+YoTDRMaJpyvONEw2Xu0EYTzFScaJjRMOF9xomFCw4TzFScaJjRMOF9xomFCw4TzFScaJjRMON/oREO5YT3ZxYJOkrfb63NsG+vJrq2bq00Odu9eWwQgx9rOerLr56ffTR++vFlrtaUgpr1j1pNdLFSgWdHm6qlWe+g7pJgAxIjitbGP/ZwvBuvJri4jHrtnzs1Ro+w/TgisJ7v6mk+FRrtgPX9d919/bixy7ls4ntp49rF5eONsI58WbXv17msQzkdx/HQ6be6tXVnA8ckaKgDeEZ5UALPZrHl6+/ICjk/WiztXG8vQAexvXQzC+SgGMPgKKC2ApVfA+pMPjcBCiI4TJpPJ4pinjBQlZnlRlDbp88YLvDjSaBe2LoH99NuSFkLDxJp/ufN8jhx7hsTsweGPhXk5/mcCkLEaAM3YAORTjAu2zRuv6Glm23SOLmiY/fTbEgsiTFjavF/eGlKzlj4BeL8+TyXCaw376bclFkS8ADy4YmLUAJwAPGiIjDIA+dekyN8HO+fHGwCf2hA+2GC/FwAN8+/RB6C/Xp8Avu1vLs339w/+wPbZu7zjQL8t0aAgt5cC2z34y3q/uM7HcYoY1dDl2PbZuzwPGhaS7gxpKJU+p4CY1+uBYq8fXBG2j4Zj5pMDkGV8/cLp1tJW1KiM8cZ5AZBYACH0u/rJe/+QefkO/VZVVVVVVVVVVVVVVVVVVVUNLj7QSN1c5UNR+7BDHoZw/Og0dADFPeFZdnudARS3AoYOYPQrQHeM+CCUcIepCwYQg/VkV98AeG1Q/vsAaIj7+zFYT3bxFxRTNB8KILa3F4P1ZJcXgBB6icKiV/hYAPZiaGE92cUAYu8QkdDOThe61zjKAMRU6B0iUvwK4GYp9w5jFH8N8AKw7xfE4CmQCuvJLgYgpLxfQENc4iFGG0AKDCAlhFEEoO8NqCEuccV7t8A7BaxBXUmh9wNYT6qOAFYKzXkiwrtJAAAAAElFTkSuQmCC"
},
{
    "name": translate("app.skins.buff_butcher_alternate"),
    "model": "wide",
    "texture_key": "d66ed86ce96a1b63c30f1baac762f638717930866474ac4fce697cdbd0bd6fbb",
    "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAADLUlEQVR4Xu2aP2sUQRjG8w3S2VikECFWVkaEFKkE0VIPPCxUECFpbNIktZDCQkhIZ+WR1Neo3+A601j6GazsV56D95j77ezMbm5v3NF54MftzczOvc+zf27Z3Y2NiA4fblUhrkajIJwvO9EwoWHC+bITDZOf5+MgnC870TChYcL5shMNExomnC870TChYcL5shMNExomnC870TChYcL5BicaSg3rSS4WtE4+vdmZ47axnuR6uXe7SsHJ0+1FAFq2dtaTXL+Ojqo2VN8ntbYuyLRvmfUkFwsVNCs9GF3U2kPrkGwCkBHD18Y+9nO+GKwnuZqM+Ph9+XGOGWX/dUJgPcnV1nxXaLQJ1vPX9Wj/c+Wye2tzCY6ndp6fVU/u3qj06ePt+69BOB/F8dPpdOnfhuM7q68ATsd3llhXALPZrN/rCv5/9x0AL44I56MYQO97QG4BrLwH3Hv2oRIshNg48Wr8YrHMQ0ZFKQCeFNWmPt94wZMjjTbh1iXYT781WSE0TFzzxwfv5mjZZ0hmJ19+LMxr+Z8JQGMtAJphAC6xAIQdZm4b5yE0zH76rYkFESasNt+WNxgc4Xi3eN/W56FEeP+B/fRbEwsivgBC0DDh+BIAdmFCQ2SQAeivydD3yfjmcAPgFiK8LmA/DdEwv3M8DRMaImsJ4Pz1/TltAvh2uLsyVyePl3D7+Ptdod+auIIwc2z3wUAE9wBdrgqOc0O0Q0bL7A/BelgT/dbElbvi7vqGLwBesrqHAfcIHlJNsBbDHUO/NWmQLj44OX/ELlLY36bQWAAhbF375Dwh81qHfouKioqKioqKioqKioqKiop6F29odH24ypui7s0O3Qzh+MGp7wCyu8PDW1SrBpDdHtB3AIPfA+yJkVuoDz5haoIBxGA9ydU2AJ4bjP8+ABri8/0YrCe5uAVliuZDAcSe7cVgPcnlC0CEXqJwsZNlLAAGarCe5GIAsXeICP81aNCH+6yR9SQXA5Cp0DtEJPs94Dpb0CX7c4AvAPf9ghhcvyusJ7lYkFjFHAMKofGsJ7looA9otAmNZT3JZdf4seI1hm1mosm8ne1D7wewnq76AxzZzWJWGY1cAAAAAElFTkSuQmCC"
},
{
    "name": translate("app.skins.barn_builder"),
    "model": "wide",
    "texture_key": "2007b66a99ae905c81f339e2a0a4bf4b99e9454a485d5164e3e1051c3036ad70",
    "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAETUlEQVR4Xu2asWoUURSGJyHYR7Cx2BAhIooYAgYtBKvYpBAsrNRU2lhsI3aWvoAgPoON2PsA9nkAO8EilYUgyrhn2LOe+c69O3tmNzOr2YWPnXvm3jv//+/N7OxMiu8fbpc3i3elvAaDQZFA6vPA+WqMDtsrxfHb6+WltSfl8/fTAyiKokLbATjfcgXw8eX5cmPjSrm+/rT8dVIZpMhJAMaUQ+axmH2cb7kC+PzoViVybe1e+fX4DAZAQQkmAUwL4V8PoNzf38+JbQyA5hEC51u+AMbGnLgxkwB020LTJDHf8gXQwH8fgDOVIhfAvFBQ18wcwGlBQV0zcwBywcTaIqCgrllYAPItcvLtU3UtIZSvfrg+KSioa7IBiGFBTmTyknOA1mRbXrJPaxzH+XJQUNc0BiBXioK2c3WO43w5KKhrGgOwyG8GgfWoaQsFdU0ogCY4xyxQUNcUD69erLF99KW0UPDm5mat/8Bf3NT66wXR3ovf1fvOzk4Txf3d3SyXH9woBZ2f48XU8HDLGc1xagHwinAVwCqAJQ1AhCli2LZTNdtOBSTIPp4gpabiiezjHAr7MoAc2o+GySQAGs2Z1rbWUge2feUKUbdpwgaQM1ftf3anIteH2H40TGoroA08uNbVuLwPh8O/Y8ZmaiTqk/nY1wTBY2v/SbCjbRomyQDsJ9wIBZrxJNl/PGamWgtomCQDmJdUeKnatH1aG53QKmhsGjpGoGFSHL35Wc4DhTcZivL68bWaoVmRcQINk0K/PuRvVTk4OKiwNX7dKBSsJJd/C9SQPbE1YYOgYTIJoC0UbJH7AvKwhfUI9oQ2KzYMGiZzrwBJWT5hm7ptSwisNbXttt6ObwsNk7lXAJe6Re8OsR6Bx4tCw8QFkFoB7GPhkl00qsm+R6BhIq/aALvsGQCXl0DBUfiJE9Vk31ULzaagYeJ+bFhGB6xgXZEfQyMTczEy2YjqUOS4+uKPOULDxJlaBRCAB+sDGoriTEWgmD6goSjOVASK6QMaiuJMRaCYPqChKM5UBIrpAxqK4kxFoJg+oKEozlQEiukDGoriTEWgmD6goSjOVASK6QMaiuJMRaCYPqChKM5UBIrpAxqK4kxFoJg+oKEozlQEiukDGoriTEWgmD6goSjOFDuQ4eHW1AC2cUODT274cJXwDi9vcIxYBbAK4CwHcPfCucUGwEITEoBt7+EGp22narYt2zTcAqcxgis0kQuARnOmta01MZF6omNp2O80RnCFKDQbZsqjLdZT+5cyAPsJN5IwGKHzAHJ/Aq1JmEphnyMq431OYwRXUMQo0brtx/8XiEJT09Bn/vifAac9gisoMnEO20+/nvQxmsBniwK/zpTESS0JwxDGdac9gitEoaEoXOo5GIgw/tNwmiK4QhQ10nYFyEPOOXGaIrhCFBrqmqUMgCuA+yPo+Nw8vQcgx6cou/St8MTydWO1n53LvidwmiL8AQtFWPMRH+/YAAAAAElFTkSuQmCC"
},
{
    "name": translate("app.skins.homestead_healer"),
    "model": "wide",
    "texture_key": "b9e9d1b51b4be289b9525d4decd798cb7912e920bac8846a2df70e9ff4f0b1d8",
    "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAADZklEQVR4Xu2asW7UQBRFt6KAAgmJOqSCghYKpEh8AA1SylBSg6BYUZMf4A8QUr6BipqeAomGmjYFteEtutHzmTe2x9lMds1c6Wh3Z8az794ZW443q9WIul/fOs/vH1/Dz+dfPvbaBefbO9HQUABkEQGYwTksJoApO+Dl0WHCfxMAjS8uAG5tQuOLC2DuDtA4zrd34ooTGiecb+cUrazee6Pvjx/18H2540nUznqqKyqOAZhhrqwPIXe8/2zYdcEfsxcBcOXJ1AByn1lPdUVFaZUYgF/93KnAucY+s57qioqy9/5KLmSaZmys397+ffR5ZwPwaKXt1XR3/fQiAHtv8mN4PGFoOxNAZDrHyYPVBrZ7QzQbtekmydpZT3VFV/dS5gSg0FnPtev8883O8+zkTQ+Opx4//9T9PL29QXPos+/Lwfkom8PDxeD4YkUBqK8kAO6sFsDfNtv6NEw4H3UtAcw5BRiAznsaJpyP2noANBxhhb29d2Pzyr77T14nWGE07y+IHht75/A4hGYjou/20G8iGopQAAb7WICK0IpEAdCkHUPzkZmI6Lu3FoDfmgqAu4AFqAg/B+8EOXaKkRxjx9FvIppmADJ+mQB4n+DHDm119dkcudfou30//SaiaQbw4eGtHlcRgLZ81M5QCI9jP/0m0hbPEQXgYQEqwo/hH0ocz/Pfh8LvEzI41k6/ibjqWjVteQbAU+HsaJVl3b3oDr7/e68dwDFjsDbV5xlqp99EnFwT0TiZEoCZv4oASqDfRExN0DDROG5nbWnOZ1vfiM73IXhDVQr9JuJVvhRedARXwpvi2CF4p1cK/SZiYoYd+G79avPKPsKCBQNg/1RoqBT6TWRGLwO3+sWWRwDsnwoNlUK/TU1NTU1NTU1NTU1NTU1NTVsXH4TM+XF16IkQx++cogDU1wKYEIA9OV5cACWnwN4FQMOGf6jJx+i+z8b6x+X67YCnwRCsp7poXgHQOMkFoH+amArrqS4+xs6tPNG4vQ+AxkrJBWDhTHllPdXF3wzNFNtyDAUwFdZTXZEptuWwsf608RdBnlJkMQHw4tkLJLjAchzrqa7IFNtyMIA5sJ7qikyxLYeN5a/NpbCe6uJVvRTe6ZXCeqqLK2JYYfbTub2yj9BQKaynuvj/AqXQUCmsp1R/AB9XSbTAQuguAAAAAElFTkSuQmCC"
},
{
    "name": translate("app.skins.beefriender"),
    "model": "wide",
    "texture_key": "59f2872323bf515aa8d84c00931fbf8170b2cec5138961527c09ffcd06ca4ab2",
    "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAADV0lEQVR4Xu2aMWsUQRiGU1wRCJIEiZxBCUl+gYUQbCxsBK20srbwByjpbG3s7K3zHwz2/gFFSCNaib2kEFa+he/47plvZ3fuNns7uXnhYfdmZufmfXd2b7OTjY0WPT++U8W4t7MVhf1lJxomNEzYX3a6/HxcxXi0tx2F/WUnnnFCw4T9Zafq+/0qxu/3+1HYX3aaTCaBaUXqaJiwv+y09gHQNKFhwv5GJ72ZyWBla+/wcoaFk0+/AuNSpvX2GNtXFjfJLgF4l4GtawuAzwbKWgXAM59FAOTt0V4Ny7sGYM98NgFIuUi2lxdnNXNlaxHAl68z84qUpQaQ5SVgz/yP169q7Exg+6YAPLILgHQNIAbHs3LpwBWeNban9EbZhIQTg/1RT27vVhY5ESnjaxUDeHDzxhxsT9EwoeFvp9OaRQNIPUGtYgCpX0DDhAEQ9kcxgCufAWMPIHV8gTgAmY7nL7dn8HKw01VgYMLTg6kL2y3aPgX6DeQF4O03lfELBRrpaqhruxToN9CL/d1K8Azafd4MFX6hxTN0sLXpwmObytvgMfQb6M3RrTqAJqxZuYafTXfm6mmkaeC2js8OPNa2Y1kq9BtIArCIyQ8PD2t4A/MC4CUSGzSNWz4+3qxh+bLQbyAvADVH810DUFJMVX//zNrLPusXhX4DeQEsOwOEVPO6Pf/5r9cQ6DdQ3wEINK9m2E6wRm0AGsK7k7sBNNmEtKXfQF4Ay1wCOngalC3bar3WaQC2nOYHCSBlBlizNG9N6j4HaetsAPqZ5ruGoO3oN5D+xHUJgM8AgprmtE9Bz7b3mcZTod9ANJQKz7w+QtOkfbxOQf7YkecI3eo+jSp8/qDfoqKioqKioqKioqKioqKiot6ly91K6uKlrB/Yxc+5dYWLs9bjVy4GwDdIbE/FAui00rNq8ZXU2s2AqwxglDOAr8DtC00upROp52t5MWkvGf5DhK0bRSCeKW/f41oEoAP3TNt9XUjhTfHaBKDYVSPCelll4vHZB8CVJda3BSD/fc4bXwyOZ3DRgJhWg4sE4M2aWD3HM7g4wGVnAA221XM8g4sD7DMAvc4tUjb6AHRwfQTgMfoA+pgBNE1GE4AOqC0AGugLjmdwcUB9IH/02OteP7O8j5/B/9mMb01DvTTrAAAAAElFTkSuQmCC"
},
{
    "name": translate("app.skins.beefriender_alternate"),
    "model": "wide",
    "texture_key": "7cd85127cbc710a1c9a53c6bb3474f59995c222b9d8c57b293993cc2d8a225aa",
    "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAADS0lEQVR4Xu2aT2vUQBjGe9hDsWgbZKWWQnF79CQiihcLBRF6qyfP/QriTfDuzbMe/BoWv4Z41pN4Fw/C6Jvyhre/TCaZTRozu/PAj6Qzk+k8TyZ/yOzGRoueH+67EPd2toKwv+REw4SGCftLTr8/H7oQx/PtIOwvOfGMExom7C85ua8PXIgfb/eCsL/kNJvNaqYVqaNhwv6S09oHQNOEhgn7m5z0ZiaDla29w8sZFh59+l4zLmVab4+xfSVxk+wSgO8ysHVtAfDdQFmrAHjmkwiAfHx6UMLyrgHYM59MAFIuku2bh/sltoztVzIANU5iA0jyErABnBVFyTIB+EguANI1gBAcz3+XDlzhWWN76vVi7kJIOCHYH3V/XjjL++OFu3vjWgXbR4sBPL55/RJsT9EwoeEvr3ZLlg3Amr+SANZ+Bkw9gN4zgAOQ6Xh+tl3By8FOV4GBcYAktn0bbf3Rb02+AHz7TWVtAyCx7dto649+a3qxVzjBZ9Du82aotA2AHGxtemlqx3LC/89j6Leml4tbZQBNWLNyDZ/u7lyqp5Gmgds6vjvwWNuOZbHQb00SgEVMvntyp4Q3MF8AvERCg6Zxy4dnmyUs7wv91uQLQM3RfNcAlBhT7tfPqr3ss35Z6LcmXwB9Z4AQa16359/+DBoC/dY0dAACzasZthOsURuAhsDnvECTTXR6L/AF0OcS0MHToGzZVuu1TgOw5TQ/SgAxM8CapXlrUvc5SFtnA9C/ab5rCNqOfmvSR1yXAPgOIKhpTvsY9Gz7/qbxWOhX5Zw7+ld5VAWwLDzz+gpNk/b1Ogb57iCPUN3qPo02QeOq0vwFWVlZWVlZWVlZWVlZWVlZWf2ky91K7OKqfPA4uV1U2HUFWQlm+8mJAfALEttToQAEtp+cuFa3djPgKgOY5AzgJ3D7QZNL6UTq+VleTNpLxoYh2LpJBOIz5dv3sRIB6MB9pu2+LqTwprgyASh21YiwXlaZeHzyAXBlifVtAcivz3njC8HxjC4aENNqcJkAfLMmVM/xjC4OsO8MoMG2eo5ndHGAQwYga3uc8lI2+QB0cEME4GPyAQwxA2iaTCYAPs+bArCPLwuNxcLxjC4aioWGFP4ewG6HfAz+BfXfE7V8VnsdAAAAAElFTkSuQmCC"
},
{
    "name": translate("app.skins.ranch_ranger"),
    "model": "wide",
    "texture_key": "25dc6421d47cad8e2bdf93f56fae9ab06fcfe218c8645c1775ae2e4563c065ad",
    "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAD8klEQVR4Xu2az27TQBCHfeoREFIpICgSoVSCHioBQnCASCjiwB8hQPTEqXfUx+DGlQM3BLwJD9FngFfAZKxMNflm7XjiKOsmrfQp8XrtzPfz2k68LcqyLJrY394pm3i3tzcLt88+Ubx9Mij/Hb8Q3ErByt6+fL1ipQK4Nzhf/vj+RXArBR7xVQygEPmzAFoEsJKnABvIWQBGVkNYuwBGdx9UrGQAOqwtPOpNAWhbB1xRy6Q4/josyd9foyk0ALYT7qclrqhlkgxgybiilknyFFBeDQbVecz2RSIBvNnfnxsKRXEBiLS+CrfObZXyV4yvl9om7+VP1mmb3TaIk4pAoSiNAcjR/7QzquDV3bavTAB6NBVKyxEX2M7tEpJNOKkIFIpSsPimAOrgdhGyB3Bw5+oUP4/2SsvzGxfIVP9xABXvd3cr5Mout0SGJG2/Pz927YSChHeRcQ0pnGgdKxPAs0sbeQJIFbh2AXx4dKUUTmUAFBakULv87XD7BPZlQbMCsPvq+BW6FRQmxf3Xm6Uw/HitfDlGXm0Asqx9UvADBZHSfSoqawPQELj9IqEwmQpAWVQAltQIWMYooDCpDUCZNwC7D6EuAAm5dwEo2k7ppgD0iOq1xAbA64kNQENY9CuFycIDsBdRlVfJugBsCIuGwqQYbm6Uit5Gjh7erDC3lZM+RAUs9hpiBZsCqENub12gMJkKgMgO2Eaebl2c+kCZZdIAyz+HU8vyngXakC3sNy8UJp1HAANQVFgD4Pq2yJcvrcG+bwuFSeMIaAOHrJA6BbRtnlPAfh4DmgWFiQtAUtMRoMvss8wAlj4C7MZ9DkCOLmVTUJi4HxsRDvBDqg1jaQf7WPjji8uzoDBxUhH4YW2g/NoFsGgoFMVJRWAxOaBQFCcVgcXkgEJRnFQEFpMDCkVxUhFYTA4oFMVJRWAxOaBQFCcVgcXkgEJRnFQEFpMDCkVxUhFYTA4oFMVJRWAxOaBQFCcVgcXkgEJRnFQEFpMDCkVxUhFYTA4oFMVJRWAxOaBQFCcVgcUIqQcaTZOrRJ4e28fuB/6BzHoGIK+T96sfgJ2cmUifBdDbU4DCin0w2vQQlNNxDMBO05HJ9JeTiuCkIkgAWowUKf9fYANoKt5uN28AE5xUBCcVQXZAkS4BpNq4LoGTiuCkIqQCsFPiLYpPSupy4vyv2noTAE8BlQgcPSdIWXnVqXfbppz+ABL9dJmyvRwBLE6IzC43odvZfST25aQiOKkIDEDgbG4XErKpNicVwUlFYADzjADbJ4Xtk+rfqwAy4aQiOKkIdQFwBHC9hUeU2D41/Z1UBCcVQT6cQqkiub6pr2Dn/mcFMOw4Av4D/tigEeZ/LxYAAAAASUVORK5CYII="
},
{
    "name": translate("app.skins.pig_whisperer"),
    "model": "wide",
    "texture_key": "83e283ab33558baa2cd0184d2e85f090c795a797bdbcb2cc47230c27f23fe9b1",
    "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAC6UlEQVR4Xu2Zv2oUURTG8wKpBWsVLGwSEDut7NIF0glp7ER8gwULiQ+gjSCkswp5gVSB4AOkyCOksRYER0/CgbO/+/fgct3Jng9+ZObeO3fP9+XO7OzM1lZDB893pho/Tl9X4XyzEw0TGiacb3ai4Ze7jzczADUeAWxaAGJYYQCyTcOE881OV2/eTYqY1r+63YLzzU405IXzrZ3s+WyXthq4PvpQRcfx2tAL6xkuFiRsdAA0R8OEYzhfC9YzXF8fPJ2E68uL278w93fIJKJxkfQxADuXcPZotwrrGS77NScwAN3++e14idwYgfO1YD3DpUvx1/nihlIA3/dfZbcZgM7DpV6C9QxXbwC9K2B2AWjBit7Beb8F9DjO14L1/HfpxUs5eHJvCY6nPu49nGpwfsL5KF5EJfTfi+0bVnLrzYIigAjgjgfAArwwoLfP7lfxjqdhL/Sb6PPicPoXvIa842nIC/0mOvnyfiohBltt1ozcAgs0zP0cnrH8PLZb6DcRDdbM5tq8Ba2Sns+j30Rc0l54TVg36DcRE/PCc84iBej2i0/bSX8Oe0xPewv6TURDPedgz0VKl6cg+xKAwrGWktFSewv6TURT9jubxjk2F5LtE/SiKMZ7xpM7E0DveP21qfs8p73Qb6JaQezLjeEHKvYUkH29W+O4pWOObp8oSQDaxvcMPchq0236TURT3hXAJWcRA7qtAXCMRX9eSwDaxp/Pgs7FdsVeb+g3Uc0c+3LQhMUG0AuPoTlPALJNv6FQKBQKhUKhUCgUCoVCKxcfc/EBCsdT9oGMwMddHL92igAigA0LgIa9MCAG0IL1DBdflnopBVALw/axnuFqvT6vkQtAzbUC0H7WM1w5U2wrUQrAA+sZLi5pL7wmeGE9w8X/iBe+GcohRtmmsJ7hoiEhd76W+mgox+wCsC9YGUQEgAB4TnthPcNF8zmTtT7e6XlhPcNFg4JnBfDVthfWM1w0nzNZg4a8sB6v/gCGgsd9V9IDLAAAAABJRU5ErkJggg=="
},
{
    "name": translate("app.skins.pig_whisperer_alternate"),
    "model": "wide",
    "texture_key": "e1fc44f1d69fd2864df7b80618a38af4170d4800f2df4fbde81c17b74b2a818b",
    "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAADDElEQVR4Xu2aPYoUURDH9wIbC2aCigYmriwbDghmmy2ICoIHEPEAwoKB6AE0EQQzIwNzU/EABnuEvYEY2HYNlNT8ut4Xuz7naf3hz3R31byuX+3rnv7YnZ2C7q32ppx/fHqQNccbTgSmCUxzvOFEYJrANMcbTgSmCUxzvOFEYJrANMcbTnduXpvUAqyfukxgmuMNp+8f3k9qgdZPXT55/DRrjjecbAM8E5jmeFung+uXJs8KcPryRdaax++r7SHkmfV0FwuOBsy2cASmbQ7HGaIB7y7vT9an375swM0pk4jgIoltNGn+Lsf7fHUva9bTXfyLpWYAT35eDscZYgZooc+O9tdONeDr0UN3mQ2w4wzZADVPgrkZIOb3h2kAC081IOVUA2rNev66eBK7e+PChplPvTq8MuXM8WmOR53cPpys5XL75/Hu2udy6c2CogHRgH+8ASyg1WzQk4OLWbfmc3+8kCrFybvQm+NH01ncCtSaXwIsxcm7EIE+vn3+24x5ORZmfRk9m8Bc99ySy/1xuzV5F8rBMebltBZ0nq7ZH3kXIpyF5DavAZyC22byLsSOtZo75PGpy6vXu1XHLF3KL8XJuxCBao7BmpOUTk+xrEsD1F5+yqnxa+PkXYhQ9jeb4Mz1mmRjYj0pCnhNPl0CLMXJuxAL+VMNqM3Xu01dJ2CrybtQriDGvBzuUDvPQ0Cv1lL56+/Md5fyKQ3QbfdXtzbMu0kvLrOt+m6TUK0zIAdk12sbILfWpQboWLkGqMm7UA6OMc85IK7rtlS+Zw+wtgFVMyAUCoVCoVAoFAqFQqFQ6KziAw8+QGE+xZepw/3rbTQgGvCfNYDArWaD7ENZaQDjss3msJ7u4ovTVhPQPpH2nkzb2NY2IPeKnTECEjIV02XW010E9CBzMQK2mvV0FwEVkttSDeA5odWsp7v4F2k1gfhmqBRnPd1FILE9S5diJcBSnPV0FwHF9necjYgGFBrQatbTXYT3IHMx7+1u6f2/NevpLgKKW2ZACbAUZz3dRXgPMucSYCnOelr1C0ujGNVjQEcGAAAAAElFTkSuQmCC"
},
{
    "name": translate("app.skins.snowfeather"),
    "model": "wide",
    "texture_key": "721c05483a435d4362047ccb62e075ef5f001aa63a7e0e2afe03e60759bab91d",
    "url": "data:image/png;base64,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"
},
{
    "name": translate("app.skins.stray"),
    "model": "wide",
    "texture_key": "b914cf5106aaa82409fdd9213fbdb1479b4d65aecc5d5e22b1f25e5744c4c4f7",
    "url": "data:image/png;base64,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"
},
{
    "name": translate("app.skins.strider"),
    "model": "wide",
    "texture_key": "5eb077c54ecfc7e760c36add887b68859d7a3160d331580ff859f7353d959151",
    "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAALFklEQVR4Xu2a2ZNXxRXHZwbwnbVQQfZFYRY22SFJySoKzAAzCCLIMINL1IjKYjTP4hKNUUxSlahJ3lJ5yKIP2Z5Sif9B8mDUp+SN8AekOnzO+Lnp6QHm9/M3DkTmVJ3qvr3d8/326b5977lNTcPIvv7vp84T30uHnv5Z6up7M3Rv7xuRUr7860fTsq89lNo3PZg2rtuRNqzdHtcdm4+kBR3bUjlevbJ6/m3ps66W9JeNTemzP72auL573q2Vlu1HXAD5wLd+mg4+9X6SjP0n36ryEDC/fWvovLYtFXiuIaUcr175ZG9T+mhzS/rkDy+ntQtnNDxe3QJ4lBkX9M7jb4ZS1rbxcMw04CUBXbhswBPK8eoVCFg1d3poWTcqAmjBHz718/CE7cfeCC9gKaxfsy1ImNt6TygkmOIJ5Xj1yqi4+bUEkIB3GQCea72BNQ9gZl1PADjK8ijHq1eui9vn4nrXC7g2z8boZodChOlIecAHh/7W8BgNCbOMOuOAP/DI2xUBbHSAZb2jEOA13lGO938nAnUJ+DiEBD0AEnT71g2HImVvQMvxbjhZv/u5tHHvmbRhz+m09r5nIl13/7OJclLAsu53PDww+92PXqjOAJTbVqW/fctrxzblvmxy/9jTlD794yvpz+ubIr9mwe2x6/PMZw8gTzvLr/ZEKM8IjMXj89PO5mp8xhh0hli9/dHKePJeS8q2o69X4PEG8gBnc2Q/oA1697ZHQgUNwJVb+qtxckK4B3XksQGjUB55HHbiub93gJQg5zIAygPM5bKPf/dStAdwDprDkn2r/r8/X7VDBzGGCBhjYkYKIG587gMCJw8Rgs+JzMnc1Hk2rmkDCaieRjk2uNE5y+j06QMekAO0jjJI+Hh3U/rrpuYACTlck9dTnO3BiAvREFIMy90fdcYvXrxYEWAeta3AGWPV1pOhgiWFjBX39AXJ1K3Z8VhFwL/euRSpx16MfuEX/7mm4bQR5Hd+mSrSSPEC0pqeIBgkAXqBpDBruP6lS2FgeAHa3NwcZdQJXDcHMGAFruolLgvrBb9u0cyYRQznesaRj4Y3/nOxLYDp7z5CmeNfVXRXicAowTBTzD5Atz703XRv78AewLVl9GM2dWvHyVUPYTlwL5cY5dqBwZDw4eG/X9vga8g/L/y7Wko5mdeU3H0F7XolD2Bc3ZOez3nPBAB3dvUix6Lca8ayje1Jc1uGna0aJF9OZd0VZd3qrWl3z6HK5XFRXZqUNQ/gfONas+tUlEFAOeN5fzdGN1a9KyeqtOe6izPsuX7ixIlpypQpadq0aZGW7Uthyegdnh98lPIGySHJ7wYcoDxB+k2hHK+UvrPvpv5z78WhDNW2yZMnh5bt6xYNUadOnZpaWlrSuHHjarqB7w0A5vQoeFKIYXxelX1fgGTznCLL8UrhjZRxTz7/fqj2obXYN6xg4IpvHIuZ4jUXhgGPcrOyfSkAxUCOycyQj1HzzD4ECD5Pa3l56nnyvdR7+seh3U+8G/bxVBoxAjzTq4BmYNysFgJw8y1HXqu8gCeFH1V8d0AhGjIgG0/jvaEWAgB+4sxPBi0BbfxCBPioY8NikwIA1/mp0M0rNsDLjzxAoT4u3fVJ6cuLkvuASwLPoI42Hoa4p+38wML1nuOvh9Iee+iLHnz8QpDIPoBS/+BTPwrlEX3oiR9EO2yjfteJt4YnZO3Ox2OHF0T+uFqx+Ldp+aLfBAmc4vLdnnaSInlce0bw6CwJ7gEehiSPMgHa1ncNgEAAwObPeD5SvIo8ymY47/ZzFVEQQRvAU07bEu8QwZDFs1+pAC2a9XJaeMf51N/fn+6a+1qQwBqVEG8OcNpS7tGXmfUt0RlH83cIyfNRKWD60QajPXtQ3vPY22nlnR+kAwcOxH0hBXBMDEBJAU2ZJC1b+OtQNskS7xAZAPxCGAQRDMJgfX19QQRltGGTIr9g5ksxc7Qzr1cAyJOij0CPz5TFN8TMi/AGvYM6lg55ZtNP7wDcv39/2LRg5rdj1ilDuaZ8zq1nIu3u7g67Fs16MQigvMQ7RATuoPv27QvAKmWwzyxAiOXenP4ccQGPa7MWMRwQfj5zjQOW5YSnbO46Vx21dXnbMMvVt8hvvhP3wvtIBe79c7sBTTkEQATXJd4hAngGZwCAqoIHODPAYHoEM+8NPNK6sQnWfYCUmdUzOEW6B7D3SJCbnf31CME6CdyTe2NTx4JfhY1e5wRxPfe2s8MTQGfdbMmSJQGwra0ttba2Rr6rqyt1dHRUe4NLRAJ8rXVD1NV9/ruzuxx0fTdegQJa1/cxStmquz4MW7gfJAjOZaHrYzNltO/s7KyuS7xDRDDcpL29PVIPFngGZUuXLo0BJYC1xb6BJ/B08AlA6ncCiSDPI811nm+CEEG7sg9LAMLIOxmk2trSgn3NFQlMEG2wUyy0x6tLvENk/HhOeRwlmxP5CRPGh5L3Rnm9bZqbmyIFtG9+zKqbmOtZr8Ab/IRGWb5krAe4hEiY90a9r3ZQV2puM1riHSKnjh1I9y6bk7a33ZGeebibDnG9rXVmeMKzx3vietfyuenpo/sT7Xd2zE472mdFewD5KCQFPBshID0skaecJaC3+BaJd0gAs06ZZwMI4B73rZgX98QWQGELCgmUUWc9aj35Eu8QoSGgAEdeYHS+f+X8AE89ZeS50XO9B0PJA4Z9AAIAByBSSKAOID4lAImneG7Qe2hDe/IQQ0pb+nBP7YEIgQkUe72mLW3y+hLvEIFR3EoX04Usu+WWCZU7uTRyl8NYT475ZigI83l9/p2A2Qc0JOH6+bkCD3JJ5ssytwc1Xy4P0hLvV078FkCKlvVfeQG03wPGCLgZCeBbgO5/UxIwJmMyJmMyJmMywuL3gLL8RhHfV8ryLySNfg8oxxtpye270gtPqXV/D7iCVJ3whLziRpAc1E3xtnfTS74sy28Cw30LuC4e4n8FRnyN30+aNKmm4CXRHCI+xADRRt/3G+1ft/jXqKnh9VpfVwFNCJwIMNro626j/euWMryeG1CLB/ADRB4CbxRAo/3rFoHrAbh+PfF73B/w/lPQ6Pt+o/2HFX+sIi0/iua/xFFO3IAvyH4Z9kuxkWTigIAmAIpSThl1hL6NHLNPGDov7Rl18fO23/ohw8gPoTP/L0BtQ0obCAHE4Sd/GBEdfoAArCEvvIF6FCKM/ROVoqym4OeXLYAnZOZMG0Ps7e1Nd855NQKY/l8AGQQsie/ZFtC0IYwFCcw6KYFQ9gJAAxhCIIExAA4RNwQB8e/AZYMBCHAB8n9BHmaHBPO0BRDBV39+oA99AUYZyriUEe4mAEobg7mkEFPaM+qCSwOKWcRoDM3/IzDyTApg6gyyorq/oBjDkPjs6QNeYyicekkYCNffAAREhHjx4P8LBmL1A+X+vCABLAtSZtZfboz/0yZfDtYzniTZVhJKe0ZdNBQjCU8z64SmCasz0xjLtbPvDDJ7AKKvoe+Bv1NejBSFJFLG8g8QPIzwN+N+aQTU8z3AdQoIY/mXi6M/ALkmfg85uv7/SDg/6L8ESEF9pe3p6Ym+KGPTx/YQAQmlPUhd3wsa/R6Q15Vj5H1teyWlD+OhTUHe4Hd6673+HNygsU3Ll6JSy7FLPpCqsJbvAYSuCVEbpqYPYXVC0+QJrZM3fm97Qtn5/waG4QFgfB8DT594oLomn1/TvrQnBzUqb4PG71GM8keL/McK8oD1/wLy+Y8MAOGaOq8l7mrArS/tGXXRpfiPQNezLHc1tHTj3FVdOpblLmw+X1L5UsvV+9POZXelpWH+v1cspYYiP3qLAAAAAElFTkSuQmCC"
},
{
    "name": translate("app.skins.villager_1"),
    "model": "wide",
    "texture_key": "b271a744ef479018927575952621b110b9c11f62730a95729af7e8591cf8dbf6",
    "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAF9klEQVR4Xu1a34tVVRid/yAMgsDHMQmEgQi0xkAswwFHUBroB6IDTsNEmik9aZmCUFOIhQ9RlAwIGYEMFD0ZjL5ZTE8+KPQW1INPIYhPsXMdWNd11/nOvefcuXMabX+w2Ht/+9e31tl7n3vvviMjfez5if1p2565Au9/vVwAefiBc0emK/HxzKvJx3vojMRPX7zREYBl1IHood1bQzxSAjh5F2B0dLQLwxJgcvbtBLz0xv4CWkbq7YduJP3e+aWSEMBqC/DuFxcS8NbZ8wU87+2HbroCKALTNlbAf24UwFfAofkf/h8C4KSnABQB5AG+Bfzwa/MQ/OvvO5Vz9Kqrbfoa1KVPv77yIvh4wzaQ/GphoTQPfLUEICEubeaZYpBLi4vpzj+pIwTy8KEu6lOVZ3/1MQ6c6MM41DBGo7cDXmdYzny1ISg+6d9u3ipIgjBJQ1mWKQ6Jsr+OxTK3ELcP6xgHXms42TU2GubhXHyymN/bwTAGxnJ/pSEIBqWBKXlM7EtbhaAIKqSORVF9jn4C6Pzqh+n86h9IAAavgakAz25YF8IFACLyDn2jMI49r0yl58bHO2Wdnz43nZ8+H6eveXAEAuAEsJEbTzw42O7nYdE2UPL+6lQ/2yEGBM2xGLzO3x3xA9P5UY7G6WseXCTARzNT6ZO5A+mzd/Z1AF8kgMKXvG4DFQDB8mlveGrjwAJE4/Q1D5aB+Rnw2paxLvAtwPponDpgHAheg/b56af5/PT7OH2Nr6aDJy8W0Hc8g8CBo08f4GmMybUPheC4/Nqsc3AewONR0/m9Tuf3uhXZgQ/PJMXenS93wdu7zX36efr+0mKamZ7tAnyoO/blQk/4eG4n7o+j8LeTt29skQA7XhgvUEcAkvfAKAJIQogIdQWgWBRgqD/AZAECAQbdAk5+TW4BDEKyHPTClT/S9JuzxSGDgwhA2ScHTl3+qavM1xfa88DkWDiw2J5P0AXw8XoBbb29+pA635Kxo4qgAlz7dbkAyvAzcIUTQFuKALA/g/K+TDfvezxtmnysVEdSHJ9z6XjuY1vnWzLvTBF0BSgB3a/alz4GqwJWrR4lCuIHvxstQBGcEMeP6pwHU+dbMjQEaXYA+q0AF0BFISIBNEAtk/zp38cKTHzwZNdK0CeqfVUYjWcgAbSTC6BnANq4ABoAV8Dho8c6K0hXD9spESx9CnD06tOFAPBpGxL2ORUuEOB8S+bBMB8JAGG8XdQXgAA4B1y8qB8FAHlg7/z60llAYVmmj2NG5OFzviVjh+gQBIEqAdgnIoSU/V2ASASQxVOnANwCbOsCACy7AEq+lgAgxb0N6PKnAABPdQbAfjqpEtQVgHwvASgCnrwufyeniMRguZEAP175OS1d/yUhZZ7kQZhPEj5tx7aYzN8M/KLz4tThAiwrqQgQQfe+QsXTvK4ErWfqfEvmn/SagiSV6PZvLqfNO15Py0vH058354s8fBQlEigaB/nbd+91gAcBaLmqnqnzLZkTAvSzfwStBzHgzLe3Oim+Do9tnSzIQwTk4Wcb1LOf9o8wsWuyAFZilI98zCN1viUjmUGx8ZltnSeHvIL+TVt2dpXZtlcflvXOQb/0eFpV73yzZcuWLVu2bNmyZcuWLdvDYNF3/uj7f9QGqY+XLdsq20ovV/23wBVffrZtkQD89aiuAPoDp//S4+3XnGUBAgEe6S2AIPHrK/9HgPsDvUUCKIaTc/gFRwTW1774WG3jTRJvkFyAXuS51PWSQ/288FBh1Ieyx9O6IQgKoCuA5JWQEvfbJCWlgqgY2p+px9O66Qqo2gIIFGJo4E5eiapY/sTXnAAIpNcWYLBVAuhTdqgA2pd5wONp3bgC+Fca3QIqgEP9uvSdMPd/lSAeT+vmAvBW2Q9BBsx8LwF0uUcCqAgeT+sGsiCtAug2YKD8P4H+r8BJuiDexgVA2eNp3er+n4B5/48BBVIRdIX4alH/mhDAP+k1hX+fb/p93+ub9nc+jc0JAfrZP4LW+92+3/FX5Zl6PK2b/1+gKfx+39N+9R5PU/sXd+BLBGdgxtEAAAAASUVORK5CYII="
},
{
    "name": translate("app.skins.villager_2"),
    "model": "wide",
    "texture_key": "748923629fed7c6ec9462016b4480fa3cff8c16e82ee6fe26d4b707f4de10060",
    "url": "data:image/png;base64,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"
},
{
    "name": translate("app.skins.wither_skeleton"),
    "model": "wide",
    "texture_key": "3d996abc69ea70a20442855e429bf44b45111f9818d0f8c46272e12d12bec218",
    "url": "data:image/png;base64,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"
},
{
    "name": translate("app.skins.pale_lumberjack"),
    "model": "wide",
    "texture_key": "6f8fc677cdcd4c6eed67d90c08d23162abc3a3a85357c7636fdf80d874aa857f",
    "url": "data:image/png;base64,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"
},
{
    "name": translate("app.skins.creaking"),
    "model": "wide",
    "texture_key": "9a0af2b1fd9659480d43132db95cd7d459d1a66480fe42150e132d03b9731573",
    "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAFkElEQVR4Xu2azYodVRSFM3bgSJwJJjjIIKA48IdkEBIRBBFDyMBJBDU6CFFpBEEiOJOQmeATNPgMjiQPFPARStaFdVn91amffftW9b0xGxbnb9fps9be51Tdqr50acL+evq4+/v0dIM/f7rXqa1SbdU/vfbqKDjf0ZnJm7BFsDAkTHC+o7Mkn9E3SJjgfEdnJJ9b4qIF+OW3nxedf2OHugWe/PH7YnOfsUPNgFUFyOgzI0iY4HxVS6JM+VVEyIi3soCECc5Xtc9u39zM4XKob2djRLMt5J5X/Yv3Xu89D0zNMQauR5aRvX39w+7+3c+777/5alOKtOrub11TMkbYbZUia8Im/+DmG2faQl7D+bJs9XM9JCKiz09e6/49fX9TirxEUP+vJz+ef0twwY6qyQommnWO6xpuDwrQKrke7nMRFlEhs0Cl+h6dPDxfFpiwSu1ZEXL0SbgF++ga1TVHzpmitgRQJHW9SkGERMRtEc0twGxoXVPBRgAv0gIwumNIvxTAcxpqm3iOKwg8LJUFd+7d6VRmxFvZkNftZF6gT20TqgpgeJ4kb8K5zVKAlnkrMBMyG1Qq+tw2JfOCTSiFINkhJHHOk2I4C1J0rkdkcl/7wMvUz6yw3077X0YyS4BCpFhcj4wRHUr9vQhA+/Lr+13iyuU3z4D+tEcfXO2Mpx+/tUH2TYHz0ehPselftn0JYPJVETgfjf651VpbqmzHJsDiGfDuO29vyatOf1ourkpe4Hw0+p87A3Ti+p7rW4ohATSWoEBc0KGBfHu2iwDy2wJ/sBrxqn8V5NszkRCplgAWpyKAUCU15c/xbLs+5EO+PbMAuo9agCQ4R4DqXqf/1LXpP3Rtq18g3555L1uAzIKqAENEcnzKd8x/6LqhMbXJt2dVAVIIobU49o1hyp9kqyDfnokkBTC5OYegF/rPd1d6hJ49ubHtd8n6lD9vc8b1y6+MYvZt0VFOAVKIKQG8aJWuu81+17M95e8HHP7qzN8YhvtKD0Ym6dteEhwSIH1aRMYIsj3lv6sA9iHfnpFgFVqkU5gp3hob82v5ZzSHyGfau5ydAfmcr0fdfF3E3wGGxvyInHt4rO52lvRp+acAiYy0SLfGZgkgIi2QNIUy8sRdAo742Asa7vsE+R69SfRPPrrV/fDtg1k/zl44E/kEx194U9Qd/f+lACIv4j6DOL668fD04rxPnar0I+yXBFmyb2jeVTPEC8mFqZ+LdV8u3uOeJ6/JuSlktl3PPrc9z6LW+uPqpwCsM9JZTwHkp7pKw2Pplz7ZVrmo5YK8AEY6o8YFuo/+viZJZJ3iuL/VXsVyMSlKLrQVGYrBaNqPNjZ24VaJDPt4bf6AIvI3A2GfnPulvbSFjGlMa42zj+3VLF+D661QIseGoDlaB1eWrXEeiK1T/cJEqZgJusy6xn17U1/Ws89t3v89x0Gb79kJk3Hdfi3/HON17j8qyzfKAl+m0J/GFyLVFxwSjRm1qu1bAL74pD/N29Dg+OK2bwGqGeDI+3zh+OJGAbSIfJdIfxoFqGZAniGr3EX4mlyk8zapbwcqPUaQcBU8VPMAbR2qmSF72SIVAVpfnkioitZt2G0TznaSn5ORk0YBTJgCbMgOCDD0vSCJDo1pDY6kiGVk3fZWyPretkhLAMMC6Klym/IQID+GkGT2t+oWIIkwtTnWqp/LWgJk9CmAsfWPKBMmy2xIcD2yvZGbYxUBMvrOABKqIkVK8N0BYT/yKRsFOHPCzxCA3/X5fX8I9uN6VreWACQqAZwdFIDEBD3wtD6HE3OeCxa3MQGcCfkcwDETqQiQn8i5nrLlLcuovBegAFVkOg+JwMib/EFsAT7rC/k/BnrY4Fj2mZDIZGRJmLAP17O6kXw+908hBRgjPfY/AlxP1f4DHdYiztEAqp4AAAAASUVORK5CYII="
},
{
    "name": translate("app.skins.ghast_riding_swimmer"),
    "model": "wide",
    "texture_key": "e12d98dab548e92cad7ac80f92d8fefbb9ca7a1af94aa4f428daf6ef723aa8e0",
    "url": "data:image/png;base64,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"
},
{
    "name": translate("app.skins.happy_ghast_pilot"),
    "model": "wide",
    "texture_key": "8409954698b6c7741460fdd85d6ec6a5e0a9ad04ade7e2c72c913f02936a607d",
    "url": "data:image/png;base64,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"
},
{
    "name": translate("app.skins.copper_chemist"),
    "model": "wide",
    "texture_key": "33aef79a4ca986a2971057d35046e71dce326b645353e6f92d56e1c4bb3b0073",
    "url": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAYAAACqaXHeAAAFj0lEQVR4Xu2av4skRRzFLxMRvEBFueCE40ROWdTzF3LCHuKJigp6F53BsigoKIgYnQriYiSLroKJwRlcIAZqaCCCgZHsP2CigX+BYD7yCt7w7tM13V3jOLsz64NHVX3r2zX1vl1dU1Xdx44N4M+dNyd9/PW7a4U/fbk7ZZbZ3spBIr/dulC49+wDhVsP3lKoulnCXWZ7KwcHgHe+FoAa2d7KQSJ115X+/NalaTCcUjDJ9lYOKdaPQQaFgkm2t3LI4Z48UiPAk54nQU+KDgZFa/K7/MMX6xOAPlKw8mlne4cOFLRssj9Lhzqh2V10Pic755XaL23yyfpae7OuV579WTr8XB8U2Z+lQ8/uxa8+LM9w8qlP3yk8+dqLhcrbl3bXJd2m63///JHJ33+8Uqi87exPQu3fcOKOwuP33D31TZt88ppmbG9vT8TNzc1pKnpGT6G2ZQBs83Vuh+3WysqzPwn9jsWKtqdtKIiDYKd++/H7UlYqZgA0q8uWAbCfr5kllHmn7E9Cv6O7zACkbSEBSGrYWtQv31wtqSYz20wHo1ZPsX1kf5YOi6Egi8+ASJBoG4VnG7RnXebZnwPHxsbGJHnTqTsLOQxnwavGGjXrs32S7RFsU49Dkv7NYIccAJP+hDvGUbCyAdBdn2cErE0A1n4EeEHy/pWXp+m1qx8U7n78RqeDmgBdL1+u7Nyxz959+zo6ADXuPHHvdaIWSertQKJz1abUQVCa4vUPIF/XKU8xDsLXn3xUOCYAGQjR+UzJ9CVdJ1JvBxJhOgAOihY6Fp4BSPLHzQxCn3hvjIaYolymD/2VUm8HFs7Uqz0LNy3c630fjiTdCQ9Dl+lXY4pQmc94K6m3A4slvdRN8aJsOQK4v88tNMXQj9eQsue6fx5SbwcpNsVTuOi5IINAISmItrHMaymoldTbQT7jnPBSeKbpz87PEjKGeexuckjfeva+jo1MH+rt4OztN0/+DSmC1P6fooaofxnn+8SNIfV2wP9N8b1nThfSXmN2ltQdlU8tALXr5O81RmsAZK/VUW8Hl87c1RG1c/H+QtpF+Zsq94mqCa8xr2OeK9FWUm8HtQC0jIDsNNNZAUg/XpM+Iu+o77InOdbTTr0dUFBrANTJXD5TnOYA16ed17icS20HwMOb4saQepsxb4PNf0eHFX6WWgOwNkjxRzIAFj56Vv0f82Ft5ox5sb+/PzGUZ/3aY29vb3r3lWf92kOiT/21VXgkA6Bhf3z3ocJ8BG577OGJeeLC+cK0DTF/41BDQ1/CxSM5CR4YuL8X/Q6f9hrZ3spBG5rnzwwLefzkjdMtcG6H6bdykAiJo51QkLgTXIsA6E62BiBHAv1WDq9uPz0RtR83c49u2o9ke2uH1iMmni77Ov21jbme7xO8NjDp3wdN5C9cfmny6JPnCpWnzyBaD0QYgNZNzqICIPFKJfz8688VKk+/QeSByJg7yAC0jqBFBEB/487rrjsABzoClhWAFC9IdD4GWbcQULDW37MOPE0ffPa9XR7L7Is/xExbwo+F04XAwv26LMWJFux8vlleZABSlM4UnDcomuW5wXeGKW4MKaiVXra7P84rCPlpbtYZfaNlNBgAC/O3Bg6IP75I8XrLzH+JVuabqnlIPc2w8AyAvzKRQOeTFi9/ifAEm3mXWc+yt9DzknqaYeEeBfmdAb83qH2DQEF9AaCP8tkXCspy7dNc+s+FnAAzGGT6pK1PHMWTDAAnP5YpuNRzfy/6237a/wtapAWn8DFpR9CMcm0ElPqx5wGztsM15stVTTSsT1JQXzBq5exj9Q4HqvXqxJgAaMvsTg+J6vu+IKl2fBI8L7OPfYJrI6DUqyNjzgN8IjQkXmx5vc6lbiuzj7zDo8q555/nPICClh0A/q3NYiLt/wB5ecIRSUHk5AAAAABJRU5ErkJggg=="
},
{
    "name": translate("app.skins.copper_welder"),
    "model": "wide",
    "texture_key": "514b10ff7bc50dd01b5438632815b9e27cfe54064d1a28ef6014f3309d278b38",
    "url": "data:image/png;base64,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"
},
{
    "name": translate("app.skins.zombie_horse_onesie"),
    "model": "wide",
    "texture_key": "f0feb1b31b6c8fd9f2d405de335c760a6c41aebb22c39ad059beb8b20c6fbe62",
    "url": "data:image/png;base64,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"
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
            let defaults = { "default_accent_color": "light_blue", "default_sort": "name", "default_group": "none", "default_page": "home", "default_width": 854, "default_height": 480, "default_ram": 4096, "default_mode": "dark", "default_sidebar": "spacious", "default_sidebar_side": "left", "discord_rpc": "true", "global_env_vars": "", "global_pre_launch_hook": "", "global_post_launch_hook": "", "global_wrapper": "", "global_post_exit_hook": "", "potato_mode": "false", "hide_ip": "false", "saved_version": window.electronAPI.version.replace("-dev", ""), "latest_release": "hello there", "max_concurrent_downloads": 10, "link_with_modrinth": "true", "thin_scrollbars": "false" };
            let value = defaults[type];
            db.prepare("INSERT INTO defaults (default_type, value) VALUES (?, ?)").run(type, value);
            return value;
        }
        return default_.value;
    }

    setDefault(type, value) {
        this.getDefault(type);
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
                    let info = await window.electronAPI.downloadSkin(e.url);
                    db.prepare("INSERT INTO skins (name, model, skin_id, skin_url, default_skin, active_uuid, texture_key) VALUES (?,?,?,?,?,?,?)").run(e.name, e.model, info.hash, info.dataUrl, Number(true), "", e.texture_key);
                }
            }
            let skins2 = db.prepare("SELECT * FROM skins WHERE default_skin = ?").all(Number(true));
            return skins2.map(e => new Skin(e.id));
        }
        return skins.map(e => new Skin(e.id));
    }

    addSkin(name, model, active_uuid, skin_id, skin_url, overrideCheck, last_used) {
        let skins = this.getSkins();
        let previousSkinIds = skins.map(e => e.skin_id);
        if (previousSkinIds.includes(skin_id) && !overrideCheck) {
            return new Skin(skins[previousSkinIds.indexOf(skin_id)].id);
        }
        let result = db.prepare("INSERT INTO skins (name, model, active_uuid, skin_id, skin_url, default_skin, last_used) VALUES (?,?,?,?,?,?,?)").run(name, model, `;${active_uuid};`, skin_id, skin_url, Number(false), last_used ? last_used.toISOString() : null);
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
    skin.getHead(callback);
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
    displayContent(dont_add_to_log) {
        if (!dont_add_to_log) {
            page_log = page_log.slice(0, page_index + 1).concat([() => {
                for (let i = 0; i < navButtons.length; i++) {
                    navButtons[i].removeSelected();
                }
                if (this.title == "home") {
                    homeButton.setSelected();
                } else if (this.title == "instances") {
                    instanceButton.setSelected();
                } else if (this.title == "discover") {
                    discoverButton.setSelected();
                } else if (this.title == "wardrobe") {
                    wardrobeButton.setSelected();
                }
                this.displayContent(true);
            }]);
            page_index++;
        }
        if (this.title == "discover") {
            showAddContent();
            currentTab = "discover";
            return;
        }
        if (this.title == "wardrobe") {
            showWardrobeContent();
            currentTab = "wardrobe";
            return;
        }
        content.innerHTML = "";
        content.appendChild(this.func());
        if (this.title == "instances") {
            groupInstances(data.getDefault("default_group"), true);
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
                let oldLeft = this.offset_left;
                this.offset_left = buttonElement.offsetLeft;
                this.offset_right = element.offsetWidth - buttonElement.offsetLeft - buttonElement.offsetWidth;
                element.style.setProperty("--left", this.offset_left + "px");
                element.style.setProperty("--right", this.offset_right + "px");
                element.style.setProperty("--transition", oldLeft < this.offset_left ? "right .125s, left .125s .125s, background-color .25s" : "right .125s .125s, left .125s, background-color .25s");
                if (options[i].color) element.style.setProperty("--color", options[i].color);
                else element.style.removeProperty("--color");
                this.selectOption(options[i].value);
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
        this.buttons = buttons;
        this.refreshButtons();
    }
    refreshButtons() {
        this.element.innerHTML = "";
        for (let i = 0; i < this.buttons.buttons.length; i++) {
            let buttonElement = document.createElement("button");
            buttonElement.classList.add("context-menu-button");
            let icon = typeof this.buttons.buttons[i].icon === "function" ? this.buttons.buttons[i].icon() : this.buttons.buttons[i].icon;
            let title = typeof this.buttons.buttons[i].title === "function" ? this.buttons.buttons[i].title() : this.buttons.buttons[i].title;
            buttonElement.innerHTML = icon + sanitize(title);
            if (this.buttons.buttons[i].danger) {
                buttonElement.classList.add("danger");
            }
            buttonElement.onclick = (e) => {
                this.element.hidePopover();
                this.buttons.buttons[i].func(new MenuOption(buttonElement, this.buttons.buttons[i].title, this.buttons.buttons[i].icon));
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

let ignoreNextPointerUp = false;

class ContextMenu {
    constructor() {
        let element = document.createElement("div");
        element.classList.add("context-menu");
        element.setAttribute("popover", "manual");
        document.body.appendChild(element);
        this.element = element;

        document.body.addEventListener("pointerup", (e) => {
            if (!this.element.matches(':popover-open')) return;
            const t = e.target;
            if (this.element.contains(t)) return;
            if (ignoreNextPointerUp) {
                ignoreNextPointerUp = true;
                return;
            }
            this.element.hidePopover();
        });

        document.body.addEventListener("pointerdown", (e) => {
            ignoreNextPointerUp = false;
        });

        document.addEventListener('keydown', (e) => {
            if (e.key == "Escape") {
                this.element.hidePopover();
            }
        });
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
        ignoreNextPointerUp = true;
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
            this.value = searchInput.value;
            if (this.oninput) this.oninput(searchInput.value);
        };
        searchInput.onchange = (e) => {
            this.value = searchInput.value;
            if (this.onenter) this.onenter(searchInput.value);
        }
        searchClear.onclick = (e) => {
            searchInput.value = "";
            if (this.oninput) this.oninput("");
            if (this.onenter) this.onenter("");
            searchInput.focus();
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

class Dropdown {
    constructor(title, options, element, initial, onchange) {
        this.title = title;
        this.element = element;
        if (onchange) this.onchange = onchange;
        this.id = createId();
        let dropdownButton = document.createElement('button');
        dropdownButton.setAttribute("popovertarget", this.id);
        this.dropdownButton = dropdownButton;
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
        this.dropdownList = dropdownList;
        this.popover = dropdownList;
        this.setOptions(options, initial);
        element.appendChild(dropdownList);
    }
    getPass() {
        return this.options.filter(e => e.value == this.selected)[0] ? this.options.filter(e => e.value == this.selected)[0].pass : null;
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
        this.selectedElement.innerHTML = sanitize(name ? name : initial);
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
        this.selectedElement.innerHTML = sanitize(name ? name : initial);
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
    setOnChange(onchange) {
        this.onchange = onchange;
    }
    addOnChange(onchange) {
        this.onchange = onchange;
    }
}

class SearchDropdown extends Dropdown {
    constructor(title, options, element, initial, onchange) {
        super(title, options, element, initial, onchange);
        let dropdownSearchInput = document.createElement("input");
        dropdownSearchInput.className = "dropdown-search-input";
        dropdownSearchInput.placeholder = "Search...";
        dropdownSearchInput.oninput = () => {
            this.filter();
        }
        this.dropdownSearchInput = dropdownSearchInput;
        element.insertBefore(dropdownSearchInput, this.dropdownList);
        this.dropdownList.ontoggle = () => {
            this.dropdownSearchInput.value = "";
            this.filter();
            this.dropdownSearchInput.focus();
        }
        this.dropdownButton.onclick = () => {
            this.dropdownList.showPopover();
        }
        this.dropdownButton.removeAttribute("popovertarget");
        this.dropdownList.classList.remove("dropdown-list");
        this.dropdownList.classList.add('dropdown-list-dialog');
        this.dropdownList.popover = "manual";
        document.addEventListener('pointerup', (e) => {
            if (!this.dropdownList.matches(':popover-open')) return;
            const t = e.target;
            if (this.dropdownList.contains(t)) return;
            if (t === dropdownSearchInput || dropdownSearchInput.contains(t)) return;
            this.dropdownList.hidePopover();
        }, true);
        document.addEventListener('keydown', (e) => {
            if (e.key == "Escape") {
                this.dropdownList.hidePopover();
            }
        }, true);
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
    constructor(element, onchange, startToggled, disableDefaultClickListener = false) {
        element.classList.add("toggle");
        this.element = element;
        this.onchange = onchange;
        let insideToggle = document.createElement("div");
        insideToggle.classList.add("toggle-inside");
        element.appendChild(insideToggle);
        if (!disableDefaultClickListener) element.onclick = (e) => {
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
        const fragment = document.createDocumentFragment();
        let notFoundElement = new NoResultsFound(notFoundMessage).element;
        notFoundElement.style.background = "transparent";
        element.classList.add("content-list-wrapper");
        let contentListTop = document.createElement("div");
        contentListTop.className = "content-list-top";
        let contentListBottom = document.createElement("div");
        contentListBottom.className = "content-list-bottom";
        fragment.appendChild(contentListTop);
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
                            this.items.forEach(c => {
                                if (c.checkbox && c.checkbox.checked && this.isCheckboxVisible(c.checkbox) && c.toggle.toggled) {
                                    c.toggle.toggle();
                                }
                            });
                            this.uncheckCheckboxes();
                            this.figureOutMainCheckedState();
                        } else if (e.func_id == "enable") {
                            this.items.forEach(c => {
                                if (c.checkbox && c.checkbox.checked && this.isCheckboxVisible(c.checkbox) && !c.toggle.toggled) {
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
                        dialog.showDialog(e.dialog_title, "notice", e.dialog_content.replace("%s", this.items.filter(c => c.checkbox && c.checkbox.checked && this.isCheckboxVisible(c.checkbox)).length), [
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
                                for (let i = 0; i < this.items.length; i++) {
                                    let c = this.items[i];
                                    if (c.checkbox.checked && this.isCheckboxVisible(c.checkbox)) {
                                        eles.push(c.checkbox.parentElement);
                                        infos.push(c.content_info);
                                    }
                                }
                                e.func(eles, infos);
                                this.uncheckCheckboxes();
                                this.figureOutMainCheckedState();
                                return;
                            }
                            for (let i = 0; i < this.items.length; i++) {
                                let c = this.items[i];
                                if (c.checkbox.checked && this.isCheckboxVisible(c.checkbox)) {
                                    e.func(c.checkbox.parentElement, c.content_info);
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
                        for (let i = 0; i < this.items.length; i++) {
                            let c = this.items[i];
                            if (c.checkbox.checked && this.isCheckboxVisible(c.checkbox)) {
                                eles.push(c.checkbox.parentElement);
                                infos.push(c.content_info);
                            }
                        }
                        e.func(eles, infos);
                        this.uncheckCheckboxes();
                        this.figureOutMainCheckedState();
                        return;
                    }
                    for (let i = 0; i < this.items.length; i++) {
                        let c = this.items[i];
                        if (c.checkbox.checked && this.isCheckboxVisible(c.checkbox)) {
                            e.func(c.checkbox.parentElement, c.content_info);
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

        let totalText = document.createElement("div");
        totalText.className = "content-list-total";
        totalText.innerHTML = translate("app.list.total", "%c", content.length);
        this.totalText = totalText;
        this.notFoundElement = notFoundElement;
        contentListTop.appendChild(totalText);


        this.paginationTop = new Pagination(1, Math.ceil(content.length / 25), (new_page) => {
            this.applyFilters(searchBar.value, filter.value, new_page);
        });
        contentListTop.appendChild(this.paginationTop.element);

        this.paginationBottom = new Pagination(1, Math.ceil(content.length / 25), (new_page) => {
            this.applyFilters(searchBar.value, filter.value, new_page);
        });
        contentListBottom.appendChild(this.paginationBottom.element);

        searchBar.setOnInput((v) => {
            this.applyFilters(v, filter.value, 1);
        });
        this.searchBar = searchBar;
        this.filter = filter;

        filter.setOnChange((v) => {
            this.applyFilters(searchBar.value, v, 1);
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
        let renderEntry = (contentInfo) => {
            let contentEle = document.createElement("div");
            contentEle.classList.add("content-list-item");
            if (contentInfo.class) contentEle.classList.add(contentInfo.class);
            if (contentInfo.type) contentEle.setAttribute("data-type", contentInfo.type);
            let item = {
                "name": [contentInfo.primary_column.title, contentInfo.primary_column.desc, contentInfo.secondary_column.title(), contentInfo.secondary_column.desc()].join("!!!!!!!!!!"),
                "element": contentEle,
                "type": contentInfo.type
            }
            this.items.push(item);
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
            imageElement.src = fixPathForImage(contentInfo.image ? contentInfo.image : getDefaultImage(contentInfo.primary_column.title));
            imageElement.loading = "lazy";
            imageElement.onerror = () => {
                if (navigator.onLine && contentInfo.onimagefail) {
                    contentInfo.onimagefail(imageElement);
                }
            }
            contentEle.appendChild(imageElement);
            let infoElement1 = document.createElement("div");
            infoElement1.className = "content-list-info";
            contentEle.appendChild(infoElement1);
            let infoElement1Title = document.createElement("div");
            infoElement1Title.className = "content-list-info-title-1";
            infoElement1Title.innerHTML = parseMinecraftFormatting(contentInfo.primary_column.title);
            infoElement1.appendChild(infoElement1Title);
            let infoElement1Desc = document.createElement("div");
            infoElement1Desc.className = "content-list-info-desc-1";
            infoElement1Desc.innerHTML = sanitize(contentInfo.primary_column.desc);
            infoElement1.appendChild(infoElement1Desc);
            let infoElement2 = document.createElement("div");
            infoElement2.className = "content-list-info";
            contentEle.appendChild(infoElement2);
            let infoElement2Title = document.createElement("div");
            infoElement2Title.className = "content-list-info-title-2";
            infoElement2Title.innerHTML = sanitize(contentInfo.secondary_column.title());
            infoElement2.appendChild(infoElement2Title);
            let infoElement2Desc = document.createElement("div");
            infoElement2Desc.className = "content-list-info-desc-2";
            infoElement2Desc.innerHTML = (contentInfo.secondary_column.desc());
            this.second_column_elements.push({
                infoElement2Title,
                infoElement2Desc,
                "title_func": contentInfo.secondary_column.title,
                "desc_func": contentInfo.secondary_column.desc
            })
            if (contentInfo?.secondary_column?.desc_hidden) {
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
                    let result = toggleDisabledContent(contentInfo, theActionList, toggle, moreDropdown);
                    if (!result) {
                        toggle.setValueWithoutTrigger(!v);
                        return;
                    }
                    if (infoElement2Desc.innerHTML.endsWith(".disabled")) {
                        infoElement2Desc.innerHTML = sanitize(infoElement2Desc.innerHTML.slice(0, -9));
                    } else {
                        infoElement2Desc.innerHTML = sanitize(infoElement2Desc.innerHTML + ".disabled");
                    }
                }, !contentInfo.disabled);
                contentInfo.pass_to_checkbox.watchForChange("disabled", (v) => {
                    toggle.setValueWithoutTrigger(!v);
                });
                contentEle.appendChild(toggleElement);
            }
            if (checkboxElement) {
                item.checkbox = checkboxElement;
                item.content_info = contentInfo.pass_to_checkbox;
                item.toggle = toggle;
            }
            if (features?.remove?.enabled) {
                let removeElement = document.createElement("button");
                removeElement.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
                removeElement.className = 'content-list-remove';
                removeElement.onclick = () => {
                    contentInfo.onremove(contentEle);
                }
                contentEle.appendChild(removeElement);
            }
            let theActionList;
            let moreDropdown;
            if (features?.more?.enabled) {
                let actionList = contentInfo.more.actionsList;
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
            return contentEle;
        }
        for (let i = 0; i < content.length; i++) {
            renderEntry(content[i]);
        }
        this.contentElement = contentMainElement;
        fragment.appendChild(contentMainElement);
        fragment.appendChild(contentListBottom);
        element.appendChild(fragment);
        this.applyFilters("", "all", 1);
    }

    reApplyFilters() {
        this.applyFilters(this.searchBar.value, this.filter.value, this.paginationBottom.currentPage);
    }

    isCheckboxVisible(element) {
        let dropdown = this.filter.value;
        let search = this.searchBar.value;
        let validCheckBoxes = this.items.filter((e) => {
            if (!e.name.toLowerCase().includes(search.toLowerCase().trim())) {
                return false;
            }
            if (e.type != dropdown && dropdown != "all") {
                return false;
            }
            return true;
        }).map(e => e.checkbox);
        return validCheckBoxes.includes(element);
    }

    removeElement(ele) {
        ele.remove();
        this.items = this.items.filter(e => e.element != ele);
        this.reApplyFilters();
    }

    removeElements(eles) {
        eles.forEach(e => e.remove);
        this.items = this.items.filter(e => !eles.includes(e.element));
        this.reApplyFilters();
    }

    applyFilters(search, dropdown, page) {
        let count = 0;
        this.paginationBottom.setPage(page);
        this.paginationTop.setPage(page);
        const fragment = document.createDocumentFragment();
        for (let i = 0; i < this.items.length; i++) {
            let ele = this.items[i].element;
            if (!this.items[i].name.toLowerCase().includes(search.toLowerCase().trim())) {
                ele.remove();
                continue;
            }
            if (this.items[i].type != dropdown && dropdown != "all") {
                ele.remove();
                continue;
            }
            count++;
            if (count <= (page * 25 - 25) || count > page * 25) {
                ele.remove();
                continue;
            }
            fragment.appendChild(ele);
        }
        this.contentElement.appendChild(fragment);
        this.paginationBottom.setTotalPages(Math.ceil(count / 25));
        this.paginationTop.setTotalPages(Math.ceil(count / 25));
        this.totalText.innerHTML = translate("app.list.total", "%c", count);
        this.notFoundElement.style.display = count ? "none" : "";
        this.figureOutMainCheckedState();
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
        let checkboxes = this.items.map(e => e.checkbox);
        for (let i = 0; i < checkboxes.length; i++) {
            if (checkboxes[i].checked && this.isCheckboxVisible(checkboxes[i])) {
                checked++;
            }
            if (this.isCheckboxVisible(checkboxes[i])) {
                total++;
            }
        }
        console.log({ total, checked })
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
        this.items.map(e => e.checkbox).forEach((e) => {
            if (this.isCheckboxVisible(e)) e.checked = true;
        });
        this.checkBoxActions.forEach(e => e.style.display = "");
    }
    uncheckCheckboxes() {
        this.items.map(e => e.checkbox).forEach((e) => {
            if (this.isCheckboxVisible(e)) e.checked = false;
        });
        this.checkBoxActions.forEach(e => e.style.display = "none");
    }
}

function toggleDisabledContent(contentInfo, theActionList, toggle, moreDropdown) {
    let content = contentInfo.instance_info.getContent();
    for (let i = 0; i < content.length; i++) {
        let e = content[i];
        if (e.file_name == contentInfo.secondary_column.desc()) {
            if (e.disabled) {
                let new_file_name = window.electronAPI.enableFile(contentInfo.instance_info.instance_id, e.type == "mod" ? "mods" : e.type == "resource_pack" ? "resourcepacks" : "shaderpacks", e.file_name);
                if (!new_file_name) {
                    displayError(translate("app.error.failure_to_enable"));
                    return;
                }
                e.setDisabled(false);
                e.setFileName(new_file_name);
                contentInfo.secondary_column.desc = () => new_file_name;
                displaySuccess(translate("app.content.success_enable").replace("%s", e.name));
            } else {
                let new_file_name = window.electronAPI.disableFile(contentInfo.instance_info.instance_id, e.type == "mod" ? "mods" : e.type == "resource_pack" ? "resourcepacks" : "shaderpacks", e.file_name);
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
    moreDropdown.refreshButtons();
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
let keyToNum = {
    "key.keyboard.apostrophe": 40,
    "key.keyboard.backslash": 43,
    "key.keyboard.backspace": 14,
    "key.keyboard.caps.lock": 58,
    "key.keyboard.comma": 51,
    "key.keyboard.delete": 211,
    "key.keyboard.down": 208,
    "key.keyboard.end": 207,
    "key.keyboard.enter": 28,
    "key.keyboard.equal": 13,
    "key.keyboard.f1": 59,
    "key.keyboard.f2": 60,
    "key.keyboard.f3": 61,
    "key.keyboard.f4": 62,
    "key.keyboard.f5": 63,
    "key.keyboard.f6": 64,
    "key.keyboard.f7": 65,
    "key.keyboard.f8": 66,
    "key.keyboard.f9": 67,
    "key.keyboard.f10": 68,
    "key.keyboard.f11": 87,
    "key.keyboard.f12": 88,
    "key.keyboard.f13": 100,
    "key.keyboard.f14": 101,
    "key.keyboard.f15": 102,
    "key.keyboard.f16": 103,
    "key.keyboard.f17": 104,
    "key.keyboard.f18": 105,
    "key.keyboard.f19": 113,
    "key.keyboard.f20": 114,
    "key.keyboard.f21": 115,
    "key.keyboard.f22": 116,
    "key.keyboard.f23": 117,
    "key.keyboard.f24": 118,
    "key.keyboard.f25": 119,
    "key.keyboard.grave.accent": 41,
    "key.keyboard.home": 199,
    "key.keyboard.insert": 210,
    "key.keyboard.keypad.0": 82,
    "key.keyboard.keypad.1": 79,
    "key.keyboard.keypad.2": 80,
    "key.keyboard.keypad.3": 81,
    "key.keyboard.keypad.4": 75,
    "key.keyboard.keypad.5": 76,
    "key.keyboard.keypad.6": 77,
    "key.keyboard.keypad.7": 71,
    "key.keyboard.keypad.8": 72,
    "key.keyboard.keypad.9": 73,
    "key.keyboard.keypad.add": 78,
    "key.keyboard.keypad.decimal": 83,
    "key.keyboard.keypad.divide": 181,
    "key.keyboard.keypad.enter": 156,
    "key.keyboard.keypad.equal": 141,
    "key.keyboard.keypad.multiply": 55,
    "key.keyboard.keypad.subtract": 74,
    "key.keyboard.left": 203,
    "key.keyboard.left.alt": 56,
    "key.keyboard.left.bracket": 26,
    "key.keyboard.left.control": 29,
    "key.keyboard.left.shift": 42,
    "key.keyboard.left.win": 219,
    "key.keyboard.menu": 221,
    "key.keyboard.minus": 12,
    "key.keyboard.num.lock": 69,
    "key.keyboard.page.down": 209,
    "key.keyboard.page.up": 201,
    "key.keyboard.pause": 197,
    "key.keyboard.period": 52,
    "key.keyboard.print.screen": 183,
    "key.keyboard.right": 205,
    "key.keyboard.right.alt": 184,
    "key.keyboard.right.bracket": 27,
    "key.keyboard.right.control": 157,
    "key.keyboard.right.shift": 54,
    "key.keyboard.right.win": 220,
    "key.keyboard.scroll.lock": 70,
    "key.keyboard.semicolon": 39,
    "key.keyboard.slash": 53,
    "key.keyboard.space": 57,
    "key.keyboard.tab": 15,
    "key.keyboard.unknown": -1,
    "key.keyboard.up": 200,
    "key.keyboard.a": 30,
    "key.keyboard.b": 48,
    "key.keyboard.c": 46,
    "key.keyboard.d": 32,
    "key.keyboard.e": 18,
    "key.keyboard.f": 33,
    "key.keyboard.g": 34,
    "key.keyboard.h": 35,
    "key.keyboard.i": 23,
    "key.keyboard.j": 36,
    "key.keyboard.k": 37,
    "key.keyboard.l": 38,
    "key.keyboard.m": 50,
    "key.keyboard.n": 49,
    "key.keyboard.o": 24,
    "key.keyboard.p": 25,
    "key.keyboard.q": 16,
    "key.keyboard.r": 19,
    "key.keyboard.s": 31,
    "key.keyboard.t": 20,
    "key.keyboard.u": 22,
    "key.keyboard.v": 47,
    "key.keyboard.w": 17,
    "key.keyboard.x": 45,
    "key.keyboard.y": 21,
    "key.keyboard.z": 44,
    "key.keyboard.0": 11,
    "key.keyboard.1": 2,
    "key.keyboard.2": 3,
    "key.keyboard.3": 4,
    "key.keyboard.4": 5,
    "key.keyboard.5": 6,
    "key.keyboard.6": 7,
    "key.keyboard.7": 8,
    "key.keyboard.8": 9,
    "key.keyboard.9": 10,
    "key.mouse.left": -100,
    "key.mouse.right": -99,
    "key.mouse.middle": -98,
    "key.mouse.1": -97,
    "key.mouse.2": -96,
    "key.mouse.3": -95,
    "key.mouse.4": -94,
    "key.mouse.5": -93,
    "key.mouse.6": -92,
    "key.mouse.7": -91,
    "key.mouse.8": -90,
    "key.mouse.9": -89,
    "key.mouse.10": -88,
    "key.mouse.11": -87,
    "key.mouse.12": -86,
    "key.mouse.13": -85,
    "key.mouse.14": -84,
    "key.mouse.15": -83,
    "key.mouse.16": -82,
    "key.mouse.17": -81,
    "key.mouse.18": -80,
    "key.mouse.19": -79,
    "key.mouse.20": -78
};

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
                inputElement = new Dropdown("", [{ "name": translate("app.options.true"), "value": "true" }, { "name": translate("app.options.false"), "value": "false" }], inputElement1, e.value, (v) => {
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
                "type": "cancel",
                "content": translate("app.settings.def_opts.import.cancel")
            },
            {
                "type": "confirm",
                "content": translate("app.settings.def_opts.import.confirm")
            }
        ], [], (v) => {
            let info = {};
            v.forEach(e => info[e.id] = e.value);
            let options = window.electronAPI.getOptions(info.options_txt_location);
            db.prepare("DELETE FROM options_defaults WHERE key != ?").run("version");
            let defaultOptions = new DefaultOptions();
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

    let addButton = document.createElement("button");
    addButton.innerHTML = '<i class="fa-solid fa-plus"></i> ' + translate("app.settings.def_opts.add");
    addButton.onclick = () => {
        let addDialog = new Dialog();
        addDialog.showDialog(translate("app.settings.def_opts.add.title"), "form", [
            {
                "type": "text",
                "name": translate("app.settings.def_opts.add.key"),
                "id": "key"
            },
            {
                "type": "text",
                "name": translate("app.settings.def_opts.add.value"),
                "desc": translate("app.settings.def_opts.add.value.description"),
                "id": "value"
            }
        ], [
            {
                "type": "cancel",
                "content": translate("app.settings.def_opts.add.cancel")
            },
            {
                "type": "confirm",
                "content": translate("app.settings.def_opts.add.confirm")
            }
        ], [], (v) => {
            let info = {};
            v.forEach(e => info[e.id] = e.value);
            let defaultOptions = new DefaultOptions();
            if (info.key != "version") {
                defaultOptions.setDefault(info.key, info.value);
            }
            generateUIForOptions(db.prepare("SELECT * FROM options_defaults WHERE key != ?").all("version"));
        })
    }
    addButton.className = "bug-button";
    def_opts_buttons.appendChild(addButton);

    let dialog = new Dialog();
    let java_installations = [{
        "type": "notice",
        "tab": "java",
        "content": translate("app.settings.java.description." + window.electronAPI.ostype())
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
    let ips = window.electronAPI.localIPs();
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
        "name": translate("app.settings.info.local_ip_address.ipv4"),
        "value": ips.IPv4
    }, {
        "name": translate("app.settings.info.local_ip_address.ipv6"),
        "value": ips.IPv6
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
    dialog.showDialog(translate("app.settings"), "form", [
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
            "name": translate("app.settings.thin_scrollbars"),
            "tab": "appearance",
            "id": "thin_scrollbars",
            "default": data.getDefault("thin_scrollbars") == "true",
            "onchange": (v) => {
                if (v) {
                    document.body.classList.add("thin-scrollbars");
                } else {
                    document.body.classList.remove("thin-scrollbars");
                }
            }
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
            "type": "toggle",
            "name": translate("app.settings.modrinth_link"),
            "tab": "appearance",
            "id": "modrinth_link",
            "desc": translate("app.settings.modrinth_link.description"),
            "default": data.getDefault("link_with_modrinth") == "true"
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
            "type": "text",
            "name": translate("app.settings.globals.custom_env_vars"),
            "tab": "globals",
            "id": "global_env_vars",
            "default": data.getDefault("global_env_vars")
        },
        {
            "type": "text",
            "name": translate("app.settings.globals.pre_launch_hook"),
            "tab": "globals",
            "id": "global_pre_launch_hook",
            "default": data.getDefault("global_pre_launch_hook")
        },
        {
            "type": "text",
            "name": translate("app.settings.globals.post_launch_hook"),
            "tab": "globals",
            "id": "global_post_launch_hook",
            "default": data.getDefault("global_post_launch_hook")
        },
        {
            "type": "text",
            "name": translate("app.settings.globals.wrapper"),
            "tab": "globals",
            "id": "global_wrapper",
            "default": data.getDefault("global_wrapper")
        },
        {
            "type": "text",
            "name": translate("app.settings.globals.post_exit_hook"),
            "tab": "globals",
            "id": "global_post_exit_hook",
            "default": data.getDefault("global_post_exit_hook")
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
            "name": translate("app.settings.tab.globals"),
            "value": "globals"
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
        data.setDefault("link_with_modrinth", (info.modrinth_link).toString());
        data.setDefault("global_pre_launch_hook", info.global_pre_launch_hook);
        data.setDefault("global_post_launch_hook", info.global_post_launch_hook);
        data.setDefault("global_wrapper", info.global_wrapper);
        data.setDefault("global_post_exit_hook", info.global_post_exit_hook);
        data.setDefault("global_env_vars", info.global_env_vars);
        data.setDefault("default_mode", info.default_mode);
        data.setDefault("default_accent_color", info.default_accent_color);
        data.setDefault("default_sidebar", info.default_sidebar);
        data.setDefault("default_sidebar_side", info.default_sidebar_side);
        data.setDefault("thin_scrollbars", (info.thin_scrollbars).toString());
        if (info.potato_mode) {
            document.body.classList.add("potato");
        } else {
            document.body.classList.remove("potato");
        }
        if (info.thin_scrollbars) {
            document.body.classList.add("thin-scrollbars");
        } else {
            document.body.classList.remove("thin-scrollbars");
        }
        if (info.default_mode == "light") {
            document.body.classList.add("light");
        } else {
            document.body.classList.remove("light");
        }
        accent_colors.forEach(e => {
            document.body.classList.remove(e);
        });
        document.body.classList.add(info.default_accent_color);
        if (info.default_sidebar == "compact") {
            document.body.classList.add("compact");
        } else {
            document.body.classList.remove("compact");
        }
        if (info.default_sidebar_side == "right") {
            document.body.classList.add("sidebar-right");
        } else {
            document.body.classList.remove("sidebar-right");
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
    }, () => {
        let color_theme = data.getDefault("default_mode");
        let accent_color = data.getDefault("default_accent_color");
        let sidebar_mode = data.getDefault("default_sidebar");
        let sidebar_side = data.getDefault("default_sidebar_side");
        let thin_scrollbars = data.getDefault("thin_scrollbars");
        if (thin_scrollbars) {
            document.body.classList.add("thin-scrollbars");
        } else {
            document.body.classList.remove("thin-scrollbars");
        }
        if (color_theme == "light") {
            document.body.classList.add("light");
        } else {
            document.body.classList.remove("light");
        }
        accent_colors.forEach(e => {
            document.body.classList.remove(e);
        });
        document.body.classList.add(accent_color);
        if (sidebar_mode == "compact") {
            document.body.classList.add("compact");
        } else {
            document.body.classList.remove("compact");
        }
        if (sidebar_side == "right") {
            document.body.classList.add("sidebar-right");
        } else {
            document.body.classList.remove("sidebar-right");
        }
    }, undefined, 800);
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
        if (e.message.includes("error.gui.closed")) return;
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
    let lastPlayedWorlds = await getRecentlyPlayedWorlds(pinnedWorlds.map(e => (e.id ? e.id : e.ip) + ":" + e.instance_id));
    let lastPlayedInstances = getRecentlyPlayedInstances(pinnedInstances.map(e => e.instance_id));
    pinnedWorlds.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    pinnedInstances.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    let pinnedWorldTitle = document.createElement("h2");
    pinnedWorldTitle.innerHTML = '<i class="home-icon fa-solid fa-thumbtack"></i>' + translate("app.home.pinned_worlds");
    let pinnedInstanceTitle = document.createElement("h2");
    pinnedInstanceTitle.innerHTML = '<i class="home-icon fa-solid fa-thumbtack"></i>' + translate("app.home.pinned_instances");
    let lastPlayedWorldTitle = document.createElement("h2");
    lastPlayedWorldTitle.innerHTML = '<i class="home-icon fa-solid fa-clock-rotate-left"></i>' + translate("app.home.last_played_worlds");
    let lastPlayedInstanceTitle = document.createElement("h2");
    lastPlayedInstanceTitle.innerHTML = '<i class="home-icon fa-solid fa-clock-rotate-left"></i>' + translate("app.home.last_played_instances");
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
        item.className = "home-world-entry";
        item.style.cursor = "auto";
        let icon = document.createElement("img");
        icon.className = "instance-image";
        icon.src = fixPathForImage(e.icon ? e.icon : getDefaultImage(e.type == "singleplayer" ? e.id : e.ip));
        item.appendChild(icon);
        let itemInfo = document.createElement("div");
        itemInfo.className = "instance-info";
        let itemTitle = document.createElement("div");
        itemTitle.className = "instance-name";
        itemTitle.innerHTML = parseMinecraftFormatting(e.name);
        let itemDesc = document.createElement("div");
        itemDesc.className = "instance-desc";
        let itemDesc1 = document.createElement("span");
        itemDesc1.className = "instance-desc";
        itemDesc1.innerHTML = formatTimeRelatively(e.last_played) + " • ";
        console.log(howLongAgo(e.last_played));
        if (howLongAgo(e.last_played) < 3600000) {
            setInterval(() => {
                itemDesc1.innerHTML = formatTimeRelatively(e.last_played) + " • ";
            }, 60000);
        } else if (howLongAgo(e.last_played) < 86400000) {
            setInterval(() => {
                itemDesc1.innerHTML = formatTimeRelatively(e.last_played) + " • ";
            }, 3600000);
        }
        let itemDesc2 = document.createElement("span");
        itemDesc2.className = "instance-desc";
        itemDesc2.innerHTML = (e.type == "singleplayer" ? (translate("app.worlds.description." + e.mode) + (e.hardcore ? " - <span style='color:#ff1313'>" + translate("app.worlds.description.hardcore") + "</span>" : "")) : e.ip);
        if (e.type == "multiplayer") {
            itemDesc2.style.width = "fit-content";
            itemDesc2.classList.add("hidden-text");
            itemDesc2.onclick = () => {
                itemDesc2.classList.add("shown");
            }
        }
        itemDesc.appendChild(itemDesc1);
        itemDesc.appendChild(itemDesc2);
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
                    window.electronAPI.openWorldFolder(instanceInfo.instance_id, e.id);
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
                        addDesktopShortcutWorld(instanceInfo, e.name, "singleplayer", e.id, e.icon ?? getDefaultImage(e.id));
                    } else {
                        addDesktopShortcutWorld(instanceInfo, e.name, "multiplayer", e.ip, e.icon ?? getDefaultImage(e.ip));
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
        icon.src = e.image ? e.image : getDefaultImage(e.instance_id);
        item.appendChild(icon);
        let itemInfo = document.createElement("div");
        itemInfo.className = "instance-info";
        let itemTitle = document.createElement("div");
        itemTitle.className = "instance-name";
        itemTitle.innerHTML = e.name;
        let itemDesc = document.createElement("div");
        itemDesc.className = "instance-desc";
        itemDesc.innerHTML = formatTimeRelatively(e.last_played) + " • " + loaders[e.loader] + " " + e.vanilla_version;
        if (howLongAgo(e.last_played) < 3600000) {
            setInterval(() => {
                itemDesc.innerHTML = formatTimeRelatively(e.last_played) + " • " + loaders[e.loader] + " " + e.vanilla_version;
            }, 60000);
        } else if (howLongAgo(e.last_played) < 86400000) {
            setInterval(() => {
                itemDesc.innerHTML = formatTimeRelatively(e.last_played) + " • " + loaders[e.loader] + " " + e.vanilla_version;
            }, 3600000);
        }
        itemInfo.appendChild(itemTitle);
        itemInfo.appendChild(itemDesc);
        item.appendChild(itemInfo);
        let instanceInfo = new Instance(e.instance_id);
        let running = checkForProcess(instanceInfo.pid);
        if (!running) instanceInfo.setPid(null);
        if (running) {
            window.electronAPI.watchProcessForExit(instanceInfo.pid, () => {
                if (currentTab != "home") return;
                formatPlayButton(false);
                live.findLive();
            });
        }
        let more;
        let playButton = document.createElement("button");
        let formatPlayButton = (isRunning) => {
            running = isRunning;
            playButton.setAttribute("title", isRunning ? translate("app.button.instances.stop") : translate("app.button.instances.play"));
            playButton.className = isRunning ? "home-stop-button" : "home-play-button";
            playButton.innerHTML = isRunning ? '<i class="fa-solid fa-circle-stop"></i>' + translate("app.button.instances.stop_short") : '<i class="fa-solid fa-play"></i>' + translate("app.button.instances.play_short");
            playButton.onclick = isRunning ? async () => {
                playButton.classList.add("home-loading-button");
                playButton.innerHTML = '<i class="spinner"></i>' + translate("app.home.stopping")
                await stopInstance(instanceInfo);
                formatPlayButton(false);
            } : async () => {
                playButton.className = "home-loading-button";
                playButton.innerHTML = '<i class="spinner"></i>' + translate("app.home.loading")
                await playInstance(instanceInfo);
                showSpecificInstanceContent(instanceInfo.refresh());
            }
            if (more) more.refreshButtons();
        }
        formatPlayButton(running);
        let morebutton = document.createElement("button");
        morebutton.className = "home-list-more";
        morebutton.innerHTML = '<i class="fa-solid fa-ellipsis-vertical"></i>';
        let buttons = new ContextMenuButtons([
            {
                "icon": () => running ? '<i class="fa-solid fa-circle-stop"></i>' : '<i class="fa-solid fa-play"></i>',
                "title": () => running ? translate("app.button.instances.stop") : translate("app.button.instances.play"),
                "func": async (e) => {
                    if (running) {
                        await stopInstance(instanceInfo);
                        formatPlayButton(false);
                    } else {
                        playButton.className = "home-loading-button";
                        playButton.innerHTML = '<i class="spinner"></i>' + translate("app.home.loading")
                        await playInstance(instanceInfo);
                        showSpecificInstanceContent(instanceInfo.refresh());
                    }
                }
            },
            instanceInfo.locked ? null : {
                "icon": '<i class="fa-solid fa-plus"></i>',
                "title": translate("app.button.content.add"),
                "func": (e) => {
                    instanceInfo = instanceInfo.refresh();
                    showAddContent(instanceInfo.instance_id, instanceInfo.vanilla_version, instanceInfo.loader);
                }
            },
            {
                "icon": '<i class="fa-solid fa-folder"></i>',
                "title": translate("app.button.instances.open_folder"),
                "func": (e) => {
                    window.electronAPI.openInstanceFolder(instanceInfo.instance_id);
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
                "icon": '<i class="fa-solid fa-wrench"></i>',
                "title": translate("app.button.instances.repair"),
                "func": () => {
                    showRepairDialog(instanceInfo.refresh());
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
        more = new MoreMenu(morebutton, buttons);
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
    let createButton = document.createElement("button");
    createButton.innerHTML = '<i class="fa-solid fa-plus"></i>' + translate("app.button.instances.create");
    createButton.className = 'home-create-button';
    createButton.onclick = () => {
        showCreateInstanceDialog();
    }
    noPlayedInstances.appendChild(createButton);
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
    let discoverModsRefresh = document.createElement("button");
    discoverModsRefresh.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i>' + translate("app.home.discover.refresh");
    discoverModsRefresh.className = "home-discover-refresh";
    discoverModsRefresh.onclick = async () => {
        discoverModsRefresh.innerHTML = '<i class="fa-solid fa-arrows-rotate spinning"></i>' + translate("app.home.discover.refresh");
        try {
            home_modpacks = await window.electronAPI.getRandomModpacks();
            if (!home_modpacks) throw new Error();
            updateHomeModpacksList(home_modpacks);
        } catch (e) {
            displayError(translate("app.home.discover.refresh.failed"));
        }
        discoverModsRefresh.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i>' + translate("app.home.discover.refresh");
    }
    let discoverModsTop = document.createElement("div");
    discoverModsTop.className = "home-discover-top";
    discoverModsTop.appendChild(discoverModsTitle);
    discoverModsTop.appendChild(discoverModsRefresh);
    discoverModsWrapper.appendChild(discoverModsTop);
    let discoverModsContainer = document.createElement("div");
    discoverModsContainer.className = "home-discover-container";
    discoverModsWrapper.appendChild(discoverModsContainer);

    let updateHomeModpacksList = (e) => {
        if (!e || !e.hits || !e.hits.length) return;
        discoverModsContainer.innerHTML = '';
        discoverModsWrapper.style.display = "grid";
        e.hits.forEach(e => {
            let item = document.createElement("button");
            item.className = "home-discover";
            item.onclick = () => {
                displayContentInfo("modrinth", e.project_id);
            }
            let img = document.createElement("img");
            img.className = "home-discover-image";
            img.src = e.icon_url ? e.icon_url : getDefaultImage(e.title);
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
    if (!home_modpacks || !home_modpacks.hits) {
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

if (data.getDefault("thin_scrollbars") == "true") {
    document.body.classList.add("thin-scrollbars");
}

if (data.getDefault("hide_ip") == "true") {
    document.body.classList.add("hide_ip");
}

function animateGridReorder(querySelector) {
    const cards = [...document.querySelectorAll(querySelector)];

    const first = new Map();
    cards.forEach(card => {
        first.set(card.dataset.id, card.getBoundingClientRect());
    });

    requestAnimationFrame(() => {
        const cards = [...document.querySelectorAll(querySelector)];
        const last = new Map();
        cards.forEach(card => {
            last.set(card.dataset.id, card.getBoundingClientRect());
        });

        cards.forEach(card => {
            const f = first.get(card.dataset.id);
            const l = last.get(card.dataset.id);
            if (!f || !l) return;

            const dx = f.left - l.left;
            const dy = f.top - l.top;

            if (dx || dy) {
                card.style.transform = `translate(${dx}px, ${dy}px)`;
                card.style.transition = 'none';

                requestAnimationFrame(() => {
                    card.style.transform = '';
                    card.style.transition = '';
                });
            }
        });
    });
}

let skinViewer;
let refreshWardrobe;

function showWardrobeContent() {
    content.innerHTML = "";
    if (!data.getDefaultProfile()) {
        let ele = document.createElement("div");
        content.appendChild(ele);
        ele.style.padding = "8px";
        let signInWarning = new NoResultsFound(translate("app.wardrobe.sign_in"));
        ele.appendChild(signInWarning.element);
        return;
    }
    if (skinViewer) skinViewer.dispose();
    let ele = document.createElement("div");
    content.appendChild(ele);
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
    let title = document.createElement("div");
    title.classList.add("title-top");
    let h1 = document.createElement("h1");
    h1.innerHTML = translate("app.page.wardrobe");
    title.appendChild(h1);
    optionsContainer.appendChild(title);
    let activeScreen = document.createElement("div");
    ele.appendChild(optionsContainer);
    let skinOptions = document.createElement("div");
    skinOptions.className = "my-account-option-box";
    activeScreen.appendChild(skinOptions);
    let fileDrop = document.createElement("div");
    fileDrop.dataset.action = "skin-import";
    fileDrop.className = "small-drop-overlay drop-overlay";
    let fileDropInner = document.createElement("div");
    fileDropInner.className = "drop-overlay-inner";
    fileDropInner.innerHTML = translate("app.import.skin.drop");
    fileDrop.appendChild(fileDropInner);
    skinOptions.appendChild(fileDrop);
    let searchAndFilter = document.createElement("div");
    searchAndFilter.className = "search-and-filter-v2";
    let searchElement = document.createElement("div");
    searchElement.style.flexGrow = "2";
    let searchbar = new SearchBar(searchElement, () => {
        filterSkins(true);
    }, () => { })
    searchAndFilter.appendChild(searchElement);
    let dropdownElement = document.createElement("div");
    dropdownElement.style.minWidth = "200px";
    let sortdropdown = new Dropdown("Sort by", [
        {
            "name": "Favorites First",
            "value": "favorites_first"
        },
        {
            "name": "Name",
            "value": "name"
        },
        {
            "name": "Last Used",
            "value": "last_used"
        }
    ], dropdownElement, "favorites_first", () => {
        filterSkins();
    })
    searchAndFilter.appendChild(searchElement);
    searchAndFilter.appendChild(dropdownElement);
    skinOptions.appendChild(searchAndFilter);
    let capeOptions = document.createElement("div");
    capeOptions.className = "my-account-option-box";
    let skinList = document.createElement("div");
    let capeList = document.createElement("div");
    skinList.className = 'my-account-option-list-skin';
    capeList.className = 'my-account-option-list-cape';
    skinOptions.appendChild(skinList);
    capeOptions.appendChild(capeList);

    let default_profile = data.getDefaultProfile();
    let activeCape = default_profile.getActiveCape();

    let capes = default_profile.getCapes();
    capes.sort((a, b) => {
        if (a.cape_name > b.cape_name) return 1;
        if (a.cape_name < b.cape_name) return -1;
        return 0;
    });
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
                skinViewer.loadCape(window.electronAPI.getCapePath(e.cape_id));
                activeCape = e;
            }
            loader.style.display = "none";
            capeImg.style.display = "block";
        }
        capeEle.className = "my-account-option";
        capeEle.title = e.cape_name;
        capeEle.classList.add("cape");
        let capeImg = document.createElement("img");
        extractImageRegionToDataURL(window.electronAPI.getCapePath(e.cape_id), 1, 1, 10, 16, (e) => {
            if (e) capeImg.src = e;
        });
        capeImg.classList.add("option-image-cape");
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
    capeImg.classList.add("option-image-cape");
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

    let detailsWrapper = document.createElement("div");
    detailsWrapper.className = "details";
    skinOptions.appendChild(detailsWrapper);
    let defaultSkinList = document.createElement("div");
    defaultSkinList.className = "my-account-option-list-skin";
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
    let showDefSkins = () => { }
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
    let skinEntries = [];
    let filterSkins = (noAnimate) => {
        if (!noAnimate) animateGridReorder(".skin");
        let search = searchbar.value.toLowerCase().trim();
        let sort = sortdropdown.value;
        skinEntries.forEach(e => e.element.remove());
        let filteredEntries = skinEntries.filter(e => e.skin.name.toLowerCase().includes(search));
        filteredEntries.sort((a, b) => {
            if (sort == "last_used") {
                let c = a.skin.last_used;
                let d = b.skin.last_used;
                c = c.getTime();
                d = d.getTime();
                if (isNaN(c)) c = 0;
                if (isNaN(d)) d = 0;
                return d - c;
            }
            let av = a.skin.name.toLowerCase();
            let bv = b.skin.name.toLowerCase();
            if (av > bv) return 1;
            if (av < bv) return -1;
            return 0;
        });
        if (sort == "favorites_first") {
            filteredEntries.sort((a, b) => {
                if (a.skin.favorited && b.skin.favorited) return 0;
                if (a.skin.favorited) return -1;
                if (b.skin.favorited) return 1;
                return 0;
            });
        }
        filteredEntries.forEach(e => {
            skinList.appendChild(e.element);
        });
    }
    let showContent = (noAnimate) => {
        if (!noAnimate) animateGridReorder(".skin");
        skinEntries = [];
        let activeSkin = default_profile.getActiveSkin();
        skinViewer.loadSkin(activeSkin ? activeSkin.skin_url : null, {
            model: activeSkin?.model == "slim" ? "slim" : "default",
        });
        let activeCape = default_profile.getActiveCape();
        skinViewer.loadCape(activeCape ? window.electronAPI.getCapePath(activeCape.cape_id) : null);
        skinList.innerHTML = '';
        let skins = data.getSkinsNoDefaults();
        skins.forEach((e) => {
            let skinEntry = new SkinEntry(e, true, skinViewer, default_profile, showContent, filterSkins);
            skinEntries.push(skinEntry);
            skinList.appendChild(skinEntry.element);
        });

        showDefSkins = async () => {
            detailChevron.innerHTML = '<i class="spinner"></i>';
            let eles = document.querySelectorAll(".my-account-option.default-skin");
            if (eles.length == 0) {
                let defaultSkins = await data.getDefaultSkins();
                defaultSkins.forEach(e => {
                    let skinEntry = new SkinEntry(e, false, skinViewer, default_profile, showContent, filterSkins);
                    defaultSkinList.appendChild(skinEntry.element);
                });
            }
            detailsWrapper.classList.add("open");
            detailChevron.innerHTML = '<i class="fa-solid fa-chevron-down"></i>';
        }
        filterSkins(true);
    }
    showContent(true);
    refreshWardrobe = showContent;
    let info = document.createElement("div");
    info.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>' + translate("app.wardrobe.notice");
    info.className = "info";
    optionsContainer.appendChild(info);
    let skinButtonContainer = document.createElement("div");
    skinButtonContainer.className = "skin-button-container";
    optionsContainer.appendChild(skinButtonContainer);
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
            await importSkin(info, () => {
                showContent();
            });
        });
    }
    skinButtonContainer.appendChild(importButton);

    let tabElement = document.createElement("div");
    optionsContainer.appendChild(tabElement);
    let wardrobeTabs = new TabContent(tabElement, [
        {
            "name": translate("app.wardrobe.skins"),
            "value": "skins",
            "func": () => {
                capeOptions.remove();
                activeScreen.appendChild(skinOptions);
            }
        },
        {
            "name": translate("app.wardrobe.capes"),
            "value": "capes",
            "func": () => {
                skinOptions.remove();
                activeScreen.appendChild(capeOptions);
            }
        }
    ]);
    optionsContainer.appendChild(activeScreen);
    return ele;
}

class SkinEntry {
    constructor(e, allowEditing, skinViewer, default_profile, showContent, filterSkins) {
        this.skin = e;
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
            allowEditing ? {
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
                        showContent(true);
                    });
                }
            } : null,
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
            allowEditing ? {
                "title": translate("app.wardrobe.skin.delete"),
                "icon": '<i class="fa-solid fa-trash-can"></i>',
                "danger": true,
                "func": () => {
                    if (e.active_uuid.replaceAll(";", "")) {
                        displayError(translate("app.wardrobe.skin.delete.in_use"));
                        return;
                    }
                    e.delete();
                    showContent();
                }
            } : null
        ].filter(e => e));
        skinEle.oncontextmenu = (e) => {
            contextmenu.showContextMenu(buttons, e.clientX, e.clientY);
        }
        skinEle.className = "my-account-option";
        if (!allowEditing) skinEle.classList.add("default-skin");
        skinEle.classList.add("skin");
        skinEle.title = e.name;
        skinEle.setAttribute("role", "button");
        skinEle.setAttribute("tabindex", 0);
        let skinMore = document.createElement("button");
        skinMore.className = "skin-more";
        skinMore.innerHTML = '<i class="fa-solid fa-ellipsis-vertical"></i>';
        let skinFavorite = document.createElement("button");
        skinFavorite.className = "skin-favorite";
        let skinFavoriteIcon = document.createElement("i");
        skinFavoriteIcon.classList.add("fa-star");
        skinFavoriteIcon.classList.add(`fa-${e.favorited ? "solid" : "regular"}`);
        skinFavorite.appendChild(skinFavoriteIcon);
        if (e.favorited) skinFavorite.classList.add("starred");
        skinFavorite.onclick = (ev) => {
            ev.stopPropagation();
            e.setFavorited(!e.favorited);
            if (e.favorited) {
                skinFavorite.classList.add("starred");
                skinFavoriteIcon.classList.add("staranimation");
                skinFavoriteIcon.classList.remove("fa-regular");
                skinFavoriteIcon.classList.add("fa-solid");
            } else {
                skinFavorite.classList.remove("starred");
                skinFavoriteIcon.classList.remove("fa-solid");
                skinFavoriteIcon.classList.add("fa-regular");
            }
            skinFavoriteIcon.onanimationend = () => {
                skinFavoriteIcon.classList.remove("staranimation");
            }
            if (filterSkins) filterSkins();
        }
        let moreMenu = new MoreMenu(skinMore, buttons, true, 2);
        if (allowEditing) skinEle.appendChild(skinFavorite);
        skinEle.appendChild(skinMore);
        let skinImg = document.createElement("img");
        e.getPreview((v) => {
            skinImg.src = v;
        })
        skinImg.classList.add("option-image-skin");
        let loader = document.createElement("div");
        loader.className = "loading-container-spinner";
        loader.style.display = "none";
        let skinName = document.createElement("div");
        skinEle.appendChild(skinImg);
        skinEle.appendChild(loader);
        skinEle.appendChild(skinName);
        skinEle.dataset.id = e.id;
        skinName.innerHTML = sanitize(e.name);
        skinName.className = "skin-name";
        if (e.name.toLowerCase() == "dinnerbone" || e.name.toLowerCase() == "grumm" || e.name.toLowerCase() == "dinnerbone's skin" || e.name.toLowerCase() == "grumm's skin") {
            skinImg.classList.add("dinnerbone");
        }
        this.element = skinEle;
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
    }
}

async function importSkin(info, callback) {
    if (!info.skin) {
        displayError(translate("app.wardrobe.import.no_file"));
        return;
    }
    let dims = await getImageDimensionsFromDataURL(info.skin);
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
            data.addSkin(info.name ? info.name : info.selected_tab == "username" ? translate("app.wardrobe.username_import.default_name", "%u", info.username) : translate("app.wardrobe.unnamed"), model, "", await window.electronAPI.importSkin(info.skin), info.skin, true, null);
            callback();
        };
        tempImg.src = info.skin;
        return;
    }
    data.addSkin(info.name ? info.name : info.selected_tab == "username" ? translate("app.wardrobe.username_import.default_name", "%u", info.username) : translate("app.wardrobe.unnamed"), model, "", await window.electronAPI.importSkin(info.skin), info.skin, true, null);
    callback();
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
            children.forEach(e => groups[i].appendChild(e));
        }
    }
}

function groupInstances(how, noAnimate) {
    if (!noAnimate) animateGridReorder(".instance-item");
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
    } else if (how == "pinned") {
        groups.sort((a, b) => {
            if (a === "" && b !== "") return -1;
            if (a !== "" && b === "") return 1;
            return b.localeCompare(a, undefined, { numeric: true, sensitivity: "base" });
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
        showCreateInstanceDialog();
    }
    title.appendChild(createButton);
    ele.appendChild(title);
    let searchAndFilter = document.createElement("div");
    searchAndFilter.classList.add("search-and-filter");
    ele.appendChild(searchAndFilter);
    let search = document.createElement("div");
    let searchbar = new SearchBar(search, searchInstances, null);
    let sort = document.createElement('div');
    sortBy = new Dropdown(translate("app.instances.sort.by"), [{ "name": translate("app.instances.sort.name"), "value": "name" },
    { "name": translate("app.instances.sort.last_played"), "value": "last_played" },
    { "name": translate("app.instances.sort.date_created"), "value": "date_created" },
    { "name": translate("app.instances.sort.date_modified"), "value": "date_modified" },
    { "name": translate("app.instances.sort.play_time"), "value": "play_time" },
    { "name": translate("app.instances.sort.game_version"), "value": "game_version" }], sort, data.getDefault("default_sort"), () => {
        groupInstances(groupBy.getSelected);
    });
    let group = document.createElement('div');
    let groupBy = new Dropdown(translate("app.instances.group.by"), [
        { "name": translate("app.instances.group.none"), "value": "none" },
        { "name": translate("app.instances.group.custom_groups"), "value": "custom_groups" },
        { "name": translate("app.instances.group.pinned"), "value": "pinned" },
        { "name": translate("app.instances.group.loader"), "value": "loader" },
        { "name": translate("app.instances.group.game_version"), "value": "game_version" }
    ], group, data.getDefault("default_group"), groupInstances);
    searchAndFilter.appendChild(search);
    searchAndFilter.appendChild(sort);
    searchAndFilter.appendChild(group);
    let instanceGrid = document.createElement("div");
    instanceGrid.classList.add("group-list");
    let groupOne = document.createElement("div");
    groupOne.setAttribute("data-group-title", "");
    groupOne.classList.add("group");
    let noResultsEle = new NoResultsFound(translate("app.instances.none")).element;
    noResultsEle.style.gridColumn = "1 / -1";
    ele.appendChild(noResultsEle);
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
        instanceElement.setAttribute("data-pinned", instances[i].pinned ? translate("app.instances.group.pinned.title") : translate("app.instances.group.unpinned.title"));
        instanceElement.setAttribute("data-none", "");
        instanceElement.onclick = (e) => {
            showSpecificInstanceContent(new Instance(instances[i].instance_id));
        }
        instanceElement.classList.add("instance-item");
        instanceElement.dataset.id = instances[i].instance_id;
        if (running) instanceElement.classList.add("running");
        let instanceImage = document.createElement("img");
        instanceImage.classList.add("instance-image");
        if (instances[i].image) {
            instanceImage.src = instances[i].image;
        } else {
            instanceImage.src = getDefaultImage(instances[i].instance_id);
        }
        instances[i].watchForChange("image", (i) => {
            instanceImage.src = i ? i : getDefaultImage(instances[i].instance_id);
        });
        instanceElement.appendChild(instanceImage);
        let instanceInfoEle = document.createElement("div");
        instanceInfoEle.classList.add("instance-info");
        let instanceName = document.createElement("div");
        instances[i].watchForChange("name", (t) => {
            instanceName.innerHTML = sanitize(t);
            instanceElement.setAttribute("data-name", t);
            groupInstances(data.getDefault("default_group"));
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
            instances[i].locked ? null : {
                "icon": '<i class="fa-solid fa-plus"></i>',
                "title": translate("app.button.content.add"),
                "func": (e) => {
                    showAddContent(instances[i].instance_id, instances[i].vanilla_version, instances[i].loader);
                }
            },
            {
                "icon": '<i class="fa-solid fa-folder"></i>',
                "title": translate("app.button.instances.open_folder"),
                "func": (e) => {
                    window.electronAPI.openInstanceFolder(instances[i].instance_id);
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
                "icon": '<i class="fa-solid fa-wrench"></i>',
                "title": translate("app.button.instances.repair"),
                "func": () => {
                    showRepairDialog(instances[i].refresh());
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
                    instanceElement.setAttribute("data-pinned", instances[i].pinned ? translate("app.instances.group.pinned.title") : translate("app.instances.group.unpinned.title"));
                    groupInstances(groupBy.getSelected);
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
                        animateGridReorder(".instance-item");
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
        ].filter(e => e));
        instanceElement.oncontextmenu = (e) => {
            contextmenu.showContextMenu(buttons, e.clientX, e.clientY);
        }
        groupOne.appendChild(instanceElement);
    }
    return ele;
}

function showCreateInstanceDialog() {
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
            try {
                if (info.loader == "fabric") {
                    loader_version = (await window.electronAPI.getFabricVersion(info.game_version))
                } else if (info.loader == "forge") {
                    loader_version = (await window.electronAPI.getForgeVersion(info.game_version))
                } else if (info.loader == "neoforge") {
                    loader_version = (await window.electronAPI.getNeoForgeVersion(info.game_version))
                } else if (info.loader == "quilt") {
                    loader_version = (await window.electronAPI.getQuiltVersion(info.game_version))
                }
            } catch (e) {
                displayError(translate("app.instances.failed_to_create"));
                return;
            }
            let instance = data.addInstance(info.name, new Date(), new Date(), "", info.loader, info.game_version, loader_version, false, false, "", info.icon, instance_id, 0, "custom", "", false, false);
            showSpecificInstanceContent(instance);
            let r = await window.electronAPI.downloadMinecraft(instance_id, info.loader, info.game_version, loader_version);
            if (r.error) {
                instance.setFailed(true);
            } else {
                instance.setJavaPath(r.java_installation);
                instance.setJavaVersion(r.java_version);
                instance.setJavaArgs(r.java_args);
                instance.setProvidedJavaArgs(r.java_args);
                instance.setMcInstalled(true);
            }
        } else if (info.selected_tab == "file") {
            if (!info.name_if) info.name_if = "";
            let instance_id = window.electronAPI.getInstanceFolderName(info.name_f);
            let instance = data.addInstance(info.name_f, new Date(), new Date(), "", "", "", "", false, true, "", info.icon_f, instance_id, 0, "", "", true, false);
            showSpecificInstanceContent(instance);
            let packInfo = await window.electronAPI.processPackFile(info.file, instance_id, info.name_f);
            console.log(packInfo);
            if (packInfo.error) {
                instance.setFailed(true);
                instance.setInstalling(false);
                return;
            }
            if (!("loader_version" in packInfo)) {
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
            if (r.error) {
                instance.setFailed(true);
            } else {
                instance.setJavaPath(r.java_installation);
                instance.setJavaVersion(r.java_version);
                instance.setJavaArgs(r.java_args);
                instance.setProvidedJavaArgs(r.java_args);
                instance.setMcInstalled(true);
            }
        } else if (info.selected_tab == "launcher") {
            // Import from launcher here
        } else if (info.selected_tab == "code") {
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
            if (!("loader_version" in packInfo)) {
                displayError(packInfo);
                return;
            }
            instance.setLoader(packInfo.loader);
            instance.setVanillaVersion(packInfo.vanilla_version);
            instance.setLoaderVersion(packInfo.loader_version);
            if (!instance.name && packInfo.name) instance.setName(packInfo.name);
            if (packInfo.allocated_ram) instance.setAllocatedRam(packInfo.allocated_ram);
            packInfo.content.forEach(e => {
                instance.addContent(e.name, e.author, e.image, e.file_name, e.source, e.type, e.version, e.source_id, e.disabled, e.version_id);
            });
            instance.setInstalling(false);
            let r = await window.electronAPI.downloadMinecraft(instance_id, packInfo.loader, packInfo.vanilla_version, packInfo.loader_version);
            if (r.error) {
                instance.setFailed(true);
            } else {
                instance.setJavaPath(r.java_installation);
                instance.setJavaVersion(r.java_version);
                instance.setJavaArgs(r.java_args);
                instance.setProvidedJavaArgs(r.java_args);
                instance.setMcInstalled(true);
            }
        }
    });
}

function showSpecificInstanceContent(instanceInfo, default_tab, dont_add_to_log, make_button_loading) {
    if (!dont_add_to_log) {
        page_log = page_log.slice(0, page_index + 1).concat([() => {
            showSpecificInstanceContent(instanceInfo, default_tab, true);
        }]);
        page_index++;
    }
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
        instImg.src = getDefaultImage(instanceInfo.instance_id);
    }
    instanceInfo.watchForChange("image", (i) => {
        instImg.src = i ? i : getDefaultImage(instanceInfo.instance_id);
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
    let calculatePlayButtonState = (mc_installed, failed) => {
        if (failed) {
            playButton.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>' + translate("app.instances.failed");
            playButton.title = translate("app.instances.failed.tooltip");
            playButton.classList.remove("instance-top-play-button");
            playButton.classList.remove("instance-top-stop-button");
            playButton.classList.add("instance-top-loading-button");
            playButton.onclick = () => { };
        } else if (!mc_installed) {
            playButton.innerHTML = '<i class="spinner"></i>' + translate("app.instances.installing");
            playButton.classList.remove("instance-top-play-button");
            playButton.classList.remove("instance-top-stop-button");
            playButton.classList.add("instance-top-loading-button");
            playButton.title = "";
            playButton.onclick = () => { };
        } else if (!running) {
            playButton.classList.remove("instance-top-stop-button");
            playButton.classList.remove("instance-top-loading-button");
            playButton.classList.add("instance-top-play-button");
            playButton.title = "";
            playButton.innerHTML = '<i class="fa-solid fa-play"></i>' + translate("app.button.instances.play_short");
            playButton.onclick = playButtonClick
        } else {
            playButton.classList.remove("instance-top-play-button");
            playButton.classList.remove("instance-top-loading-button");
            playButton.classList.add("instance-top-stop-button");
            playButton.innerHTML = '<i class="fa-solid fa-circle-stop"></i>' + translate("app.button.instances.stop_short");
            playButton.onclick = stopButtonClick
            playButton.title = "";
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
    }
    calculatePlayButtonState(instanceInfo.mc_installed, instanceInfo.failed, running);
    if (make_button_loading) {
        playButton.innerHTML = '<i class="spinner"></i>' + translate("app.instances.loading");
        playButton.classList.remove("instance-top-play-button");
        playButton.classList.add("instance-top-loading-button");
        playButton.onclick = () => { };
    }
    instanceInfo.watchForChange("mc_installed", (v) => {
        calculatePlayButtonState(v, instanceInfo.refresh().failed);
    });
    instanceInfo.watchForChange("failed", (v) => {
        calculatePlayButtonState(instanceInfo.refresh().mc_installed, v);
    });
    let threeDots = document.createElement("button");
    threeDots.classList.add("instance-top-more");
    threeDots.innerHTML = '<i class="fa-solid fa-ellipsis-vertical"></i>';
    let buttons = new ContextMenuButtons([
        instanceInfo.locked ? null : {
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
                window.electronAPI.openInstanceFolder(instanceInfo.instance_id);
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
            "icon": '<i class="fa-solid fa-wrench"></i>',
            "title": translate("app.button.instances.repair"),
            "func": () => {
                showRepairDialog(instanceInfo.refresh());
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
    ].filter(e => e));
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
    let resettingJavaArgs = false;
    dialog.showDialog(translate("app.instances.settings.title"), "form", [
        {
            "type": "image-upload",
            "name": translate("app.instances.settings.icon"),
            "id": "icon",
            "default": instanceInfo.image,
            "tab": "general",
            "image_code": instanceInfo.instance_id
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
        instanceInfo.installed_version ? {
            "type": "toggle",
            "name": translate("app.modpack.repair"),
            "tab": "modpack",
            "id": "modpack_reinstall"
        } : null,
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
            "desc": translate("app.instances.settings.java_installation.description." + window.electronAPI.ostype()).replace("%v", instanceInfo.java_version),
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
            "tab": "java",
            "buttons": [
                {
                    "name": translate("app.instances.settings.java_args.reset"),
                    "icon": '<i class="fa-solid fa-rotate-left"></i>',
                    "func": (v, b, i) => {
                        i.value = instanceInfo.provided_java_args;
                        resettingJavaArgs = true;
                    }
                }
            ]
        },
        {
            "type": "text",
            "id": "env_vars",
            "name": translate("app.instances.settings.custom_env_vars"),
            "default": instanceInfo.env_vars,
            "tab": "launch_hooks"
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
            "id": "post_launch_hook",
            "name": translate("app.instances.settings.post_launch_hook"),
            "default": instanceInfo.post_launch_hook,
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
        if (resettingJavaArgs && info.java_args == instanceInfo.provided_java_args) {
            instanceInfo.setUsesCustomJavaArgs(false);
        } else if (info.java_args != instanceInfo.java_args) {
            instanceInfo.setUsesCustomJavaArgs(true);
            instanceInfo.setJavaArgs(info.java_args);
        }
        instanceInfo.setEnvVars(info.env_vars);
        instanceInfo.setPreLaunchHook(info.pre_launch_hook);
        instanceInfo.setPostLaunchHook(info.post_launch_hook);
        instanceInfo.setWrapper(info.wrapper);
        instanceInfo.setPostExitHook(info.post_exit_hook);
        if (info.modpack_version && (info.modpack_version != instanceInfo.installed_version || info.modpack_reinstall) && info.modpack_version != "loading") {
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
        let r = await window.electronAPI.downloadMinecraft(instanceInfo.instance_id, info.loader, info.game_version, info.loader_version);
        if (r.error) {
            instanceInfo.setFailed(true);
        } else {
            if (instanceInfo.java_version != r.java_version) {
                instanceInfo.setJavaPath(r.java_installation);
                instanceInfo.setJavaVersion(r.java_version);
            }
            instanceInfo.setProvidedJavaArgs(r.java_args);
            if (!instanceInfo.uses_custom_java_args) {
                instanceInfo.setJavaArgs(r.java_args);
            }
            if (info.update_content) {
                let content = instanceInfo.getContent();
                let processId = Math.random();
                let cancel = false;
                for (let i = 0; i < content.length; i++) {
                    log.sendData([{
                        "title": "Updating Content",
                        "progress": i / content.length * 100,
                        "desc": `Updating ${i + 1} of ${content.length}`,
                        "id": processId,
                        "status": "good",
                        "cancel": () => {
                            cancel = true;
                        },
                        "retry": () => { }
                    }]);
                    let c = content[i];
                    try {
                        await updateContent(instanceInfo, c);
                    } catch (e) {
                        displayError(translate("app.content.update_failed").replace("%c", c.name));
                    }
                    if (cancel) {
                        log.sendData([{
                            "title": "Updating Content",
                            "progress": 100,
                            "desc": "Canceled by User",
                            "id": processId,
                            "status": "error",
                            "cancel": () => { },
                            "retry": () => { }
                        }]);
                        if (currentSubTab == "content" && currentTab == "instance" && currentInstanceId == instanceInfo.instance_id) {
                            setInstanceTabContentContent(instanceInfo, tabsInfo);
                        }
                        return;
                    }
                }
                log.sendData([{
                    "title": "Updating Content",
                    "progress": 100,
                    "desc": "Done",
                    "id": processId,
                    "status": "done",
                    "cancel": () => { },
                    "retry": () => { }
                }]);
                displaySuccess(translate("app.instances.updated_all").replace("%i", instanceInfo.name));
                if (currentSubTab == "content" && currentTab == "instance" && currentInstanceId == instanceInfo.instance_id) {
                    setInstanceTabContentContent(instanceInfo, tabsInfo);
                }
            }
            instanceInfo.setMcInstalled(true);
        }
    });
}
function showRepairDialog(instanceInfo) {
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
}
function setInstanceTabContentContent(instanceInfo, element) {
    let loading = new LoadingContainer();
    element.innerHTML = "";
    element.appendChild(loading.element);
    setTimeout(() => {
        setInstanceTabContentContentReal(instanceInfo, element);
    }, 0);
}

async function setInstanceTabContentContentReal(instanceInfo, element) {
    clearMoreMenus();
    currentSubTab = "content";
    let fileDrop = document.createElement("div");
    fileDrop.dataset.action = "content-import";
    fileDrop.dataset.instanceId = instanceInfo.instance_id;
    fileDrop.className = "small-drop-overlay drop-overlay";
    let fileDropInner = document.createElement("div");
    fileDropInner.className = "drop-overlay-inner";
    fileDropInner.innerHTML = translate("app.import.content.drop");
    fileDrop.appendChild(fileDropInner);
    instanceInfo = instanceInfo.refresh();
    let instanceLockedBanner = document.createElement("div");
    instanceLockedBanner.className = "instance-locked-banner";
    let instanceLockedText = document.createElement("span");
    instanceLockedText.innerHTML = translate("app.instance.locked", "%c", translate("app.discover." + instanceInfo.install_source));
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
            document.body.style.cursor = "progress";
            let success = await window.electronAPI.importContent(info.file_path, info.content_type, instanceInfo.instance_id);
            document.body.style.cursor = "";
            if (success) {
                displaySuccess(translate("app.content.import.complete"));
            } else {
                displayError(translate("app.content.import.failed"));
            }
            if (document.body.contains(importContent)) setInstanceTabContentContent(instanceInfo, element);
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
        instanceInfo = instanceInfo.refresh();
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
    let dropdownInfo = new Dropdown(translate("app.button.content.type"), [
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
    let contentListWrap = document.createElement("div");
    let checkForPlayerContent = async () => {
        let old_file_names = instanceInfo.getContent().map((e) => e.file_name);
        let newContent = await getInstanceContent(instanceInfo);
        let newContentAdd = newContent.newContent.filter((e) => !old_file_names.includes(e.file_name));
        console.log(newContentAdd);
        newContentAdd.forEach(e => {
            instanceInfo.addContent(e.name, e.author, e.image, e.file_name, e.source, e.type, e.version, e.source_id, e.disabled, e.version_id);
        });
        let deleteContent = newContent.deleteContent;
        deleteContent.forEach(e => {
            let content = new Content(instanceInfo.instance_id, e);
            content.delete();
        });
    }
    let showContent = () => {
        contentListWrap.innerHTML = '';
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
        let firstTime = true;
        for (let i = 0; i < instance_content.length; i++) {
            let e = instance_content[i];
            content.push({
                "primary_column": {
                    "title": e.name,
                    "desc": e.author ? "by " + e.author : ""
                },
                "secondary_column": {
                    "title": () => firstTime ? e.version : e.refresh().version,
                    "desc": () => firstTime ? e.version : e.refresh().file_name
                },
                "type": e.type,
                "class": e.source,
                "image": e.image,
                "onimagefail": async (ele) => {
                    if (e.source == "modrinth") {
                        let newInfo = await fetch(`https://api.modrinth.com/v2/project/${e.source_info}`);
                        let newInfoJSON = await newInfo.json();
                        let newImage = newInfoJSON.icon_url;
                        e.setImage(newImage);
                        ele.src = fixPathForImage(newImage ? newImage : getDefaultImage(e.name));
                    } else if (e.source == "curseforge") {
                        let newInfo = await fetch(`https://api.curse.tools/v1/cf/mods/${e.source_info.replace(".0", "")}`);
                        let newInfoJSON = await newInfo.json();
                        let newImage = newInfoJSON.data?.logo?.thumbnailUrl;
                        if (!newImage) newImage = newInfoJSON.data?.logo?.url;
                        e.setImage(newImage);
                        ele.src = fixPathForImage(newImage ? newImage : getDefaultImage(e.name));
                    }
                },
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
                            displaySuccess(translate("app.content.delete.success").replace("%c", e.name));
                            e.delete();
                            contentList.removeElement(ele);
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
                                e = e.refresh();
                                window.electronAPI.showContentInFolder(instanceInfo.instance_id, e.type == "mod" ? "mods" : e.type == "resource_pack" ? "resourcepacks" : "shaderpacks", e.file_name);
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
                        e.source == "vanilla_tweaks" && !instanceInfo.locked ? {
                            "title": translate("app.content.edit_packs"),
                            "icon": '<i class="fa-solid fa-pencil"></i>',
                            "func": () => {
                                let refreshed = e.refresh();
                                displayVanillaTweaksEditor(instanceInfo.instance_id, instanceInfo.vanilla_version, JSON.parse(refreshed.source_info), refreshed.file_name, refreshed);
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
                                        displaySuccess(translate("app.content.delete.success", "%c", e.name));
                                        e.delete();
                                        contentList.removeElement(ele);
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
            });
        }
        firstTime = false;
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
                                displaySuccess(translate("app.content.delete.success", "%c", e.name));
                                e.delete();
                                contentList.removeElement(ele);
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
                    let processId = Math.random();
                    let cancel = false;
                    for (let i = 0; i < content.length; i++) {
                        log.sendData([{
                            "title": "Updating Content",
                            "progress": i / content.length * 100,
                            "desc": `Updating ${i + 1} of ${content.length}`,
                            "id": processId,
                            "status": "good",
                            "cancel": () => {
                                cancel = true;
                            },
                            "retry": () => { }
                        }]);
                        let c = content[i];
                        try {
                            await updateContent(instanceInfo, c);
                        } catch (e) {
                            displayError(translate("app.content.update_failed").replace("%c", c.name));
                        }
                        if (cancel) {
                            log.sendData([{
                                "title": "Updating Content",
                                "progress": 100,
                                "desc": "Canceled by User",
                                "id": processId,
                                "status": "error",
                                "cancel": () => { },
                                "retry": () => { }
                            }]);
                            if (currentSubTab == "content" && currentTab == "instance" && currentInstanceId == instanceInfo.instance_id) {
                                setInstanceTabContentContent(instanceInfo, element);
                            }
                            return;
                        }
                    }
                    log.sendData([{
                        "title": "Updating Content",
                        "progress": 100,
                        "desc": "Done",
                        "id": processId,
                        "status": "done",
                        "cancel": () => { },
                        "retry": () => { }
                    }]);
                    displaySuccess(translate("app.instances.updated_all", "%i", instanceInfo.name));
                    if (currentSubTab == "content" && currentTab == "instance" && currentInstanceId == instanceInfo.instance_id) {
                        setInstanceTabContentContent(instanceInfo, element);
                    }
                }
            }
        }, dropdownInfo, translate("app.content.not_found"));
    }
    let currently_installing = new CurrentlyInstalling();
    contentListWrap.appendChild(currently_installing.element);
    instanceInfo.watchForChange("installing", async (v) => {
        if (!v) {
            await checkForPlayerContent();
            showContent();
        } else {
            contentListWrap.innerHTML = "";
            contentListWrap.appendChild(currently_installing.element);
        }
    });
    if (!instanceInfo.refresh().installing) {
        await checkForPlayerContent();
        showContent();
    } else {
        contentListWrap.innerHTML = "";
        contentListWrap.appendChild(currently_installing.element);
    }
    const fragment = document.createDocumentFragment();
    element.innerHTML = "";
    fragment.appendChild(fileDrop);
    if (instanceInfo.locked) {
        fragment.appendChild(instanceLockedBanner);
    }
    fragment.appendChild(searchAndFilter);
    fragment.appendChild(contentListWrap);
    element.appendChild(fragment);
}
function isNotDisplayNone(element) {
    return element.checkVisibility({ checkDisplayNone: true });
}
function setInstanceTabContentWorlds(instanceInfo, element) {
    let loading = new LoadingContainer();
    element.innerHTML = "";
    element.appendChild(loading.element);
    setTimeout(() => {
        setInstanceTabContentWorldsReal(instanceInfo, element);
    }, 0);
}
async function setInstanceTabContentWorldsReal(instanceInfo, element) {
    currentSubTab = "worlds";
    let searchAndFilter = document.createElement("div");
    searchAndFilter.classList.add("search-and-filter-v2");
    let importWorlds = document.createElement("button");
    importWorlds.classList.add("add-content-button");
    importWorlds.innerHTML = '<i class="fa-solid fa-plus"></i>' + translate("app.worlds.import")
    importWorlds.onclick = async () => {
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
                "onchange": async (a, b, c) => {
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
                                b[i].element.setOptions((await window.electronAPI.getWorldsFromOtherLauncher(filePath)).map(e => ({ "name": parseMinecraftFormatting(e.name), "value": e.value })));
                            } else {
                                b[i].element.setOptions((await window.electronAPI.getWorldsFromOtherLauncher(a)).map(e => ({ "name": parseMinecraftFormatting(e.name), "value": e.value })));
                            }
                        }
                    }
                }
            },
            {
                "type": "checkboxes",
                "name": translate("app.worlds.import.worlds"),
                "options": (await getInstanceWorlds(instanceInfo)).map(e => ({ "name": e.name, "value": e.id })),
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
    let addServer = document.createElement("button");
    addServer.classList.add("add-content-button");
    addServer.innerHTML = '<i class="fa-solid fa-plus"></i>' + translate("app.worlds.server")
    addServer.onclick = () => {
        let dialog = new Dialog();
        dialog.showDialog(translate("app.worlds.server.title"), "form", [
            {
                "type": "text",
                "id": "name",
                "name": translate("app.worlds.server.name")
            },
            {
                "type": "text",
                "id": "ip",
                "name": translate("app.worlds.server.ip")
            }
        ], [
            {
                "type": "cancel",
                "content": translate("app.worlds.server.cancel")
            },
            {
                "type": "confirm",
                "content": translate("app.worlds.server.confirm")
            }
        ], [], async (v) => {
            let info = {};
            v.forEach(e => info[e.id] = e.value);
            await window.electronAPI.addServer(instanceInfo.instance_id, info.ip, info.name);
            setInstanceTabContentWorlds(instanceInfo, element);
        })
    }
    let contentSearch = document.createElement("div");
    contentSearch.style.flexGrow = 2;
    let searchBar = new SearchBar(contentSearch, () => { }, null);
    let typeDropdown = document.createElement("div");
    let dropdownInfo = new Dropdown(translate("app.worlds.type"), [
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
    searchAndFilter.appendChild(addServer);
    let fileDrop = document.createElement("div");
    fileDrop.dataset.action = "world-import";
    fileDrop.dataset.instanceId = instanceInfo.instance_id;
    fileDrop.className = "small-drop-overlay drop-overlay";
    let fileDropInner = document.createElement("div");
    fileDropInner.className = "drop-overlay-inner";
    fileDropInner.innerHTML = translate("app.import.worlds.drop");
    fileDrop.appendChild(fileDropInner);
    let worldList = [];

    let worlds = await getInstanceWorlds(instanceInfo);
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
                "image": worlds[i].icon ?? getDefaultImage(worlds[i].id),
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
                            contentList.removeElement(ele);
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
                                window.electronAPI.openWorldFolder(instanceInfo.instance_id, worlds[i].id);
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
                                addDesktopShortcutWorld(instanceInfo, worlds[i].name, "singleplayer", worlds[i].id, worlds[i].icon ?? getDefaultImage(worlds[i].id));
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
                                        contentList.removeElement(ele);
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
                "image": worldsMultiplayer[i].icon ?? getDefaultImage(worldsMultiplayer[i].ip),
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
                            contentList.removeElement(ele);
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
                                addDesktopShortcutWorld(instanceInfo, worldsMultiplayer[i].name, "multiplayer", worldsMultiplayer[i].ip, worldsMultiplayer[i].icon ?? getDefaultImage(worldsMultiplayer[i].ip));
                            }
                        } : null,
                        {
                            "title": translate("app.worlds.delete"),
                            "icon": '<i class="fa-solid fa-trash-can"></i>',
                            "danger": true,
                            "func_id": "delete",
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
                                        contentList.removeElement(ele);
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
                        contentList.removeElements(elesm);
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
    element.innerHTML = "";
    element.appendChild(fileDrop);
    element.appendChild(searchAndFilter);
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

        visible.style.translate = `0px ${startIdx * itemHeight}px`;
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
            let logInfo = window.electronAPI.getLog(instanceInfo.instance_id, e);
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
        let dropdownInfo = new SearchDropdown(translate("app.logs.session"), [{ "name": translate("app.logs.live"), "value": "live_log" }].concat(log_info.toReversed().map((e) => ({ "name": formatDateAndTime(e.date), "value": e.file_name }))), typeDropdown, "live_log", onChangeLogDropdown);
    } else {
        let dropdownInfo = new Dropdown(translate("app.logs.session"), [{ "name": translate("app.logs.live"), "value": "live_log" }].concat(log_info.toReversed().map((e) => ({ "name": formatDateAndTime(e.date), "value": e.file_name }))), typeDropdown, "live_log", onChangeLogDropdown);
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
            let success = await window.electronAPI.deleteLogs(instanceInfo.instance_id, currentLog);
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
    let dropdownInfo = new Dropdown(translate("app.options.type"), [
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
                values[i].element.classList.remove("hidden");
            } else {
                values[i].element.style.display = "none";
                values[i].element.classList.add("hidden");
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
            inputElement = new Dropdown("", [{ "name": translate("app.options.true"), "value": "true" }, { "name": translate("app.options.false"), "value": "false" }], inputElement1, e.value, (v) => {
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
            displayScreenshot(formatDateAndTime(e.file_name), null, e.file_path, e.file_name, instanceInfo, element, screenshotInformation, screenshotInformation.map(e => e.file).indexOf(e.file_path));
        }
        let buttons = new ContextMenuButtons([
            {
                "icon": '<i class="fa-solid fa-folder"></i>',
                "title": translate("app.screenshots.open_in_folder"),
                "func": () => {
                    window.electronAPI.showScreenshotInFolder(instanceInfo.instance_id, e.real_file_name);
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
                    let success = window.electronAPI.deleteScreenshot(instanceInfo.instance_id, e.file_name);
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

function displayScreenshot(name, desc, file, file_name, instanceInfo, element, list, currentIndex, word = translate("app.screenshot")) {
    let index = currentIndex;
    let buttonLeft = document.createElement("button");
    buttonLeft.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
    buttonLeft.className = "screenshot-arrow";
    let screenshotElement;
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
                let success = window.electronAPI.deleteScreenshot(instanceInfo.instance_id, file_name);
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
        if (pixelationToggle.toggled) screenshotDisplay.style.imageRendering = "pixelated";
        screenshotElement = screenshotDisplay;
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
        window.electronAPI.showFileInFolder(file);
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
    let screenshotAction6 = document.createElement("div");
    screenshotAction6.className = "dialog-text-label-wrapper-horizontal";
    let toggleElement = document.createElement("button");
    let pixelationToggle = new Toggle(toggleElement, (v) => {
        if (screenshotElement) screenshotElement.style.imageRendering = v ? "pixelated" : "";
    }, false);
    let label = document.createElement("label");
    label.className = "dialog-label";
    label.innerText = translate("app.gallery.pixelated");
    screenshotAction6.appendChild(toggleElement);
    screenshotAction6.appendChild(label);
    screenshotActions.appendChild(screenshotAction6);
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
        pid = await window.electronAPI.playMinecraft(instInfo.loader, instInfo.vanilla_version, instInfo.loader_version, instInfo.instance_id, data.getDefaultProfile(), quickPlay, { "width": instInfo.window_width ? instInfo.window_width : 854, "height": instInfo.window_height ? instInfo.window_height : 480 }, instInfo.allocated_ram ? instInfo.allocated_ram : 4096, instInfo.java_path, instInfo.java_args ? instInfo.java_args : null, instInfo.env_vars, instInfo.pre_launch_hook, instInfo.post_launch_hook, instInfo.wrapper, instInfo.post_exit_hook, data.getDefault("global_env_vars"), data.getDefault("global_pre_launch_hook"), data.getDefault("global_post_launch_hook"), data.getDefault("global_wrapper"), data.getDefault("global_post_exit_hook"), instInfo.name);
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

function howLongAgo(timeString) {
    let today = new Date();
    let date = new Date(timeString);
    return today.getTime() - date.getTime();
}

function formatTimeRelatively(timeString) {
    let today = new Date();
    let date = new Date(timeString);
    let diff = today.getTime() - date.getTime();
    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;
    const week = 7 * day;
    const month = 30 * day;
    const year = 365 * day;
    if (diff < 0) {
        return translate("app.date.future");
    }
    if (diff < minute) {
        return translate("app.date.just_now");
    }
    if (diff < hour) {
        let value = Math.floor(diff / minute);
        if (value == 1) return translate("app.date.minutes.singular", "%t", 1);
        return translate("app.date.minutes", "%t", value);
    }
    if (diff < day) {
        let value = Math.floor(diff / hour);
        if (value == 1) return translate("app.date.hours.singular", "%t", 1);
        return translate("app.date.hours", "%t", value);
    }
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    if (
        date.getFullYear() === yesterday.getFullYear() &&
        date.getMonth() === yesterday.getMonth() &&
        date.getDate() === yesterday.getDate()
    ) {
        return translate("app.date.yesterday");
    }
    if (diff < week) {
        let value = Math.floor(diff / day);
        if (value == 1) return translate("app.date.days.singular", "%t", 1);
        return translate("app.date.days", "%t", value);
    }
    if (diff < month) {
        let value = Math.round(diff / week);
        if (value == 1) return translate("app.date.weeks.singular", "%t", 1);
        return translate("app.date.weeks", "%t", value);
    }
    if (diff < year) {
        let value = Math.round(diff / month);
        if (value == 1) return translate("app.date.months.singular", "%t", 1);
        return translate("app.date.months", "%t", value);
    }
    let value = Math.round(diff / year);
    if (value == 1) return translate("app.date.years.singular", "%t", 1);
    return translate("app.date.years", "%t", value)
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

async function getInstanceWorlds(instanceInfo) {
    return await window.electronAPI.getSinglePlayerWorlds(instanceInfo.instance_id);
}

async function getInstanceWorldsMulti(instanceInfo) {
    return await window.electronAPI.getMultiplayerWorlds(instanceInfo.instance_id);
}

async function getInstanceContent(instanceInfo) {
    return await window.electronAPI.getInstanceContent(instanceInfo.loader, instanceInfo.instance_id, instanceInfo.getContent(), data.getDefault("link_with_modrinth") == "true");
}

function translate(key, ...params) {
    if (!lang) {
        lang = getLangFile("en-us");
    }
    let value = lang[key];
    for (let i = 0; i < params.length; i += 2) {
        value = value.replace(params[i], params[i + 1]);
    }
    if (!value) return key;
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

class DownloadLogEntry {
    constructor(startingTitle, startingDescription, startingProgress, id, status, startingCancelFunction, startingRetryFunction) {
        let element = document.createElement("div");
        element.className = "download-item";
        let title = document.createElement("div");
        let progress = document.createElement("div");
        let desc = document.createElement("div");
        title.className = "download-title";
        progress.className = "download-progress";
        desc.className = "download-desc";
        progress.style.setProperty("--percent", startingProgress + "%");
        title.innerText = startingTitle;
        desc.innerText = startingDescription;
        element.appendChild(title);
        element.appendChild(progress);
        element.appendChild(desc);
        this.titleEle = title;
        this.descEle = desc;
        this.progressEle = progress;
        this.ele = element;
        this.title = startingTitle;
        this.progress = startingProgress;
        this.id = id;
        this.status = status;
        this.cancelFunction = startingCancelFunction;
        this.retryFunction = startingRetryFunction;

        let listElement = document.createElement("div");
        listElement.className = "download-grid-entry";
        this.listEle = listElement;
        let itemElement = document.createElement("div");
        itemElement.className = "download-grid-item";
        let title2 = document.createElement("div");
        let progress2 = document.createElement("div");
        let desc2 = document.createElement("div");
        title2.className = "download-title";
        progress2.className = "download-progress";
        desc2.className = "download-desc";
        progress2.style.setProperty("--percent", startingProgress + "%");
        title2.innerText = startingTitle;
        desc2.innerText = startingDescription;
        itemElement.appendChild(title2);
        itemElement.appendChild(progress2);
        itemElement.appendChild(desc2);
        this.titleEle2 = title2;
        this.descEle2 = desc2;
        this.progressEle2 = progress2;
        let cancelButton = document.createElement("button");
        cancelButton.innerHTML = '<i class="fa-solid fa-ban"></i>' + translate("app.downloads.cancel");
        cancelButton.className = "download-cancel-button";
        cancelButton.onclick = () => {
            if (this.cancelFunction) this.cancelFunction();
            cancelButton.onclick = () => { };
            cancelButton.innerHTML = '<i class="spinner"></i>' + translate("app.downloads.canceling");
            cancelButton.classList.add("disabled");
        }
        let retryButton = document.createElement("button");
        retryButton.innerHTML = '<i class="fa-solid fa-arrow-rotate-left"></i>' + translate("app.downloads.retry");
        retryButton.className = "download-retry-button";
        retryButton.onclick = () => {
            if (this.retryFunction) this.retryFunction();
            this.remove();
        }
        let ignoreButton = document.createElement("button");
        ignoreButton.innerHTML = '<i class="fa-solid fa-file-circle-xmark"></i>' + translate("app.downloads.ignore");
        ignoreButton.className = "download-ignore-button";
        ignoreButton.onclick = () => {
            this.remove();
        }
        listElement.appendChild(itemElement);
        listElement.appendChild(cancelButton);
        listElement.appendChild(retryButton);
        listElement.appendChild(ignoreButton);

        if (status == "error") {
            listElement.classList.add("download-error");
            element.classList.add("download-error");
        }
    }

    setDesc(desc) {
        this.descEle.innerText = desc;
        this.descEle2.innerText = desc;
    }

    setProgress(progress) {
        this.progressEle.style.setProperty("--percent", progress + "%");
        this.progressEle2.style.setProperty("--percent", progress + "%");
        this.progress = progress;
    }

    setTitle(title) {
        this.title = title;
        this.titleEle.innerText = title;
        this.titleEle2.innerText = title;
    }

    setCancelFunction(cancelFunction) {
        this.cancelFunction = cancelFunction;
    }

    setRetryFunction(retryFunction) {
        this.retryFunction = retryFunction;
    }

    setStatus(status) {
        this.status = status;
        if (status == "error") {
            this.ele.classList.add("download-error");
            this.listEle.classList.add("download-error");
        } else {
            this.ele.classList.remove("download-error");
            this.listEle.classList.remove("download-error");
        }
    }

    remove() {
        this.markForRemoval = true;
        this.ele.remove();
        this.listEle.remove();
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
        element.appendChild(downloadLogToggle);
        let logsWrapper = document.createElement("div");
        logsWrapper.className = "download-log-wrapper";
        logsWrapper.id = "download-log-wrapper";
        logsWrapper.setAttribute("popover", "");
        element.appendChild(logsWrapper);
        let itemWrapper = document.createElement("div");
        itemWrapper.className = "download-item-wrapper";
        itemWrapper.id = "download-item-wrapper";
        logsWrapper.appendChild(itemWrapper);
        let downloadsButton = document.createElement("button");
        downloadsButton.className = "view-downloads-button";
        downloadsButton.innerText = translate("app.downloads.view");
        downloadsButton.onclick = () => {
            this.openAllProcesses();
        }
        logsWrapper.appendChild(downloadsButton);
        this.element = itemWrapper;
        this.toggle = downloadLogToggle;
        this.allProcessesElement = document.createElement("div");
        this.allProcessesElement.className = "download-grid";
        let noProcessesElement = new NoResultsFound(translate("app.downloads.none"));
        let noProcessesRunningElement = noProcessesElement.element;
        this.allProcessesElement.appendChild(noProcessesRunningElement);
        noProcessesRunningElement.style.padding = "20px";
        noProcessesRunningElement.style.borderRadius = "10px";
    }

    openAllProcesses() {
        let dialog = new Dialog();
        dialog.showDialog(translate("app.downloads.all_processes"), "notice", this.allProcessesElement, [
            {
                "content": translate("app.downloads.done"),
                "type": "confirm"
            }
        ], [], () => { });
    }

    sendData(info) {
        info: for (let i = 0; i < info.length; i++) {
            for (let j = 0; j < this.logs.length; j++) {
                if (this.logs[j].id == info[i].id) {
                    this.logs[j].setDesc(info[i].desc);
                    this.logs[j].setProgress(info[i].progress);
                    this.logs[j].setStatus(info[i].status);
                    this.logs[j].setTitle(info[i].title);
                    this.logs[j].setCancelFunction(info[i].cancel);
                    this.logs[j].setRetryFunction(info[i].retry);
                    continue info;
                }
            }
            let log = new DownloadLogEntry(info[i].title, info[i].desc, info[i].progress, info[i].id, info[i].status, info[i].cancel, info[i].retry);
            this.allProcessesElement.appendChild(log.listEle);
            this.logs.push(log);
            this.element.appendChild(log.ele);
        }

        this.logs = this.logs.filter((e) => {
            if (e.status == "done" || e.markForRemoval) {
                e.remove();
                return false;
            }
            return true;
        });
        if (this.logs[0]) {
            this.toggle.style.setProperty("--percent-preview", this.logs[0].progress + "%");
        } else {
            this.toggle.style.setProperty("--percent-preview", "0%");
        }
    }
}

let log = new DownloadLog(downloadLog);

window.electronAPI.onProgressUpdate((title, progress, task, id, status, cancelFunction, retryFunction) => {
    log.sendData([
        {
            "title": title,
            "progress": progress,
            "desc": task,
            "id": id,
            "status": status,
            "cancel": cancelFunction,
            "retry": retryFunction
        }
    ]);
});

window.electronAPI.onContentInstallUpdate((content_id, percent) => {
    if (percent >= 100) percent = 0;
    if (!global_discover_content_states[content_id]) {
        content_id = Number(content_id);
    }
    if (!global_discover_content_states[content_id]) {
        content_id = content_id.toString();
    }
    if (global_discover_content_states[content_id]) global_discover_content_states[content_id].forEach(e => {
        e.style.setProperty("--percent-preview", percent + "%");
    });
});

window.electronAPI.onOpenFileShare((p) => {
    openShareDialogForFile(p);
});

window.electronAPI.onErrorMessage((message) => {
    displayError(message);
});

window.electronAPI.onLaunchInstance(async (launch_info) => {
    if (!launch_info.instance_id) return;
    try {
        let instance = new Instance(launch_info.instance_id);
        showSpecificInstanceContent(instance, launch_info.world_type ? "worlds" : "content", undefined, true);
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

window.electronAPI.onInstallInstance(async (install_info) => {
    if (!install_info.id) return;
    if (!install_info.source) return;
    let info = {};
    if (install_info.source == "modrinth") {
        let temp = await (await fetch(`https://api.modrinth.com/v2/project/${install_info.id}`)).json();
        let members = await (await fetch(`https://api.modrinth.com/v2/project/${install_info.id}/members`)).json();
        info = {
            "project_type": temp.project_type,
            "source": "modrinth",
            "loaders": temp.loaders,
            "icon": temp.icon_url,
            "name": temp.title,
            "author": members.map(e => e.user.username).join(", "),
            "game_versions": temp.game_versions,
            "project_id": temp.id
        }
    } else if (install_info.source == "curseforge") {
        let temp = await (await fetch(`https://api.curse.tools/v1/cf/mods/${install_info.id}`)).json();
        let types = { 6: "mod", 4471: "modpack", 12: "resourcepack", 6552: "shader", 17: "world", 6945: "datapack" };
        info = {
            "project_type": types[temp.data.classId],
            "source": "curseforge",
            "loaders": [],
            "icon": temp.data?.logo?.thumbnailUrl ? temp.data.logo.thumbnailUrl : (temp.data?.logo?.url ? temp.data.logo.url : ""),
            "name": temp.data.name,
            "author": temp.data.authors.map(e => e.name).join(", "),
            "game_versions": [],
            "project_id": temp.data.id
        }
    }
    importInstanceFromContentProvider(info);
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
    constructor(element, defaultImage, defaultImageCode) {
        element.className = "image-upload-wrapper";
        let preview = document.createElement("img");
        preview.className = "image-preview";
        preview.src = defaultImage ? defaultImage : getDefaultImage(defaultImageCode);
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
            this.previewElement.src = getDefaultImage(defaultImageCode);
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

    addOnChange(onchange) {
        this.onchange = onchange;
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
        if (this.onchange) this.onchange(this.getValue());
    }

    /** Build a hierarchical tree object */
    buildTree(paths) {
        const root = {};
        for (const path of paths) {
            const parts = path.split(/\/\/|\/|\\/);
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
            const fullPath = parentPath ? parentPath + "/" + key : key;
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
                if (this.onchange) this.onchange(this.getValue());
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
            this.selectAll(path + "/" + key, node.children[key]);
        }
    }

    deselectAll(path, node) {
        this.selected.delete(path);
        for (const key of Object.keys(node.children)) {
            this.deselectAll(path + "/" + key, node.children[key]);
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
        const parts = path.split("/");
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
            const childPath = path + "/" + key;
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
    showDialog(title, type, info, buttons, tabs, onsubmit, onclose, full_screen, max_width) {
        let element = document.createElement("dialog");
        element.className = "dialog";
        element.oncancel = (e) => {
            if (onclose) onclose();
            setTimeout(() => {
                this.element.remove();
            }, 1000);
        }
        if (max_width) element.style.maxWidth = max_width + "px";
        this.element = element;
        if (full_screen) element.classList.add("dialog-full");
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
                    if (info[i].oninput) textInput.oninput = () => {
                        info[i].oninput(textInput.value);
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
                    if (info[i].onchange) toggle.onchange = () => {
                        info[i].onchange(toggle.toggled);
                    }
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
                    let imageUpload = new ImageUpload(element, info[i].default, info[i].image_code);
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
                    if (info[i].onchange) multiSelect.addOnChange(() => {
                        info[i].onchange(multiSelect.value);
                    });
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
                    if (info[i].onchange) multiSelect.addOnChange(info[i].onchange);
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
                        multiSelect = new SearchDropdown("", info[i].options, element, info[i].default ?? info[i].options[0]?.value);
                    } else {
                        multiSelect = new Dropdown("", info[i].options, element, info[i].default ?? info[i].options[0]?.value, () => { });
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
                                    if (label.innerHTML != translate("app.dialog.loading")) return;
                                    if (list.length && typeof list[0] === "object" && list[0] !== null && "name" in list[0] && "value" in list[0]) {
                                        multiSelect.setOptions(list, list.map(e => e.value).includes(info[i].default) ? info[i].default : list[0]?.value);
                                    } else {
                                        multiSelect.setOptions(list.map(e => ({ "name": e, "value": e })), list.includes(info[i].default) ? info[i].default : list[0]);
                                    }
                                    label.innerHTML = sanitize(info[i].name);
                                } catch (err) {
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
                    let multiSelect = new SearchDropdown("", info[i].options, element, info[i].default ?? info[i].options[0]?.value);
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
                                wrapper.style.display = loaderElement.value == "vanilla" ? "none" : "";
                                if (loaderElement.value == "vanilla") return;
                                let oldValue = multiSelect.value;
                                let value = this.values[j].element.value;
                                if (value == "loading") return;
                                label.innerHTML = translate("app.dialog.loading");
                                multiSelect.setOptions([{ "name": translate("app.dialog.loading"), "value": "loading" }], "loading");
                                try {
                                    let list = await getVersions(loaderElement.value, value);
                                    if (label.innerHTML != translate("app.dialog.loading")) return;
                                    multiSelect.setOptions(list.map(e => ({ "name": e, "value": e })), list.includes(oldValue) ? oldValue : list.includes(info[i].default) ? info[i].default : list[0]);
                                    label.innerHTML = loaders[loaderElement.value] + " Version";
                                } catch (err) {
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

let global_discover_content_states = {};

function showAddContent(instance_id, vanilla_version, loader, default_tab) {
    for (let i = 0; i < navButtons.length; i++) {
        navButtons[i].removeSelected();
    }
    discoverButton.setSelected();
    added_vt_packs = [];
    let discover_content_states = {};
    global_discover_content_states = {};
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
                contentTabSelect("modpack", tabInfo, loader, vanilla_version, instance_id, discover_content_states);
            }
        } : null,
        !loader || loader != "vanilla" ? {
            "name": translate("app.discover.mods"),
            "value": "mod",
            "func": () => {
                contentTabSelect("mod", tabInfo, loader, vanilla_version, instance_id, discover_content_states);
            }
        } : null,
        {
            "name": translate("app.discover.resource_packs"),
            "value": "resourcepack",
            "func": () => {
                contentTabSelect("resourcepack", tabInfo, loader, vanilla_version, instance_id, discover_content_states);
            }
        },
        !loader || loader != "vanilla" ? {
            "name": translate("app.discover.shaders"),
            "value": "shader",
            "func": () => {
                contentTabSelect("shader", tabInfo, loader, vanilla_version, instance_id, discover_content_states);
            }
        } : null,
        {
            "name": translate("app.discover.worlds"),
            "value": "world",
            "func": () => {
                contentTabSelect("world", tabInfo, loader, vanilla_version, instance_id, discover_content_states);
            }
        },
        {
            "name": translate("app.discover.servers"),
            "value": "servers",
            "func": () => {
                contentTabSelect("server", tabInfo, loader, vanilla_version, instance_id, discover_content_states);
            }
        },
        {
            "name": translate("app.discover.data_packs"),
            "value": "datapack",
            "func": () => {
                contentTabSelect("datapack", tabInfo, loader, vanilla_version, instance_id, discover_content_states);
            }
        }
    ].filter(e => e));
    let tabInfo = document.createElement("div");
    tabInfo.className = "tab-info";
    ele.appendChild(tabInfo);
    if (default_tab) {
        tabs.selectOptionAdvanced(default_tab);
        contentTabSelect(default_tab, tabInfo, loader, vanilla_version, instance_id, discover_content_states);
    } else if (!instance_id) {
        contentTabSelect("modpack", tabInfo, loader, vanilla_version, instance_id, discover_content_states);
    } else if (!loader || loader != "vanilla") {
        contentTabSelect("mod", tabInfo, loader, vanilla_version, instance_id, discover_content_states);
    } else {
        contentTabSelect("resourcepack", tabInfo, loader, vanilla_version, instance_id, discover_content_states);
    }
    clearMoreMenus();
}

class ContentSearchEntry {
    constructor(title, author, description, downloadCount, imageURL, installContent, installFunction, tags, infoData, id, source, source_id, instance_id, vanilla_version, loader, alreadyInstalled, experimental, project_type, offline, states) {
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
            displayContentInfo(source, source_id, instance_id, vanilla_version, project_type == "datapack" ? "datapack" : loader, false, false, null, infoData, project_type, states);
        }
        element.setAttribute("tabindex", "0");
        element.setAttribute("role", "button");
        element.onkeydown = (e) => {
            if (e.key == "Enter" || e.key == " ") {
                displayContentInfo(source, source_id, instance_id, vanilla_version, project_type == "datapack" ? "datapack" : loader, false, false, null, infoData, project_type, states);
            }
        }
        this.element = element;
        if (id) element.id = id;
        let image = document.createElement("img");
        image.src = imageURL ? imageURL : getDefaultImage(title);
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
        if (states && !states[source_id]) {
            states[source_id] = {
                "state": alreadyInstalled ? "installed" : "default",
                "buttons": [installButton]
            }
        } else if (states) {
            states[source_id].buttons.push(installButton);
        }
        if (global_discover_content_states[source_id]) global_discover_content_states[source_id].push(installButton);
        else global_discover_content_states[source_id] = [installButton];
        if (states && states[source_id].state == "installed") {
            installButton.onclick = () => { };
            installButton.classList.add("disabled");
            installButton.innerHTML = '<i class="fa-solid fa-check"></i>' + translate("app.discover.installed")
        }
        if (states && states[source_id].state == "installing") {
            installButton.onclick = () => { };
            installButton.classList.add("disabled");
            installButton.innerHTML = '<i class="spinner"></i>' + translate("app.discover.installing")
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

function contentTabSelect(tab, ele, loader, version, instance_id, states) {
    ele.innerHTML = '';
    let sources = [];
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
        added_vt_packs = [];
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
        getContent(discoverList, instance_id, d.getSelected, v, loader, version, tab, undefined, undefined, undefined, undefined, states);
    });
    if (tab == "server") s.disable(translate("app.discover.server_search_not_available"));
    let dropdownElement = document.createElement("div");
    dropdownElement.style.minWidth = "200px";
    let d = new Dropdown(translate("app.discover.content_source"), sources, dropdownElement, sources[0].value, () => {
        getContent(discoverList, instance_id, d.getSelected, searchContents, loader, version, tab, undefined, undefined, undefined, undefined, states);
    });
    getContent(discoverList, instance_id, sources[0].value, "", loader, version, tab, undefined, undefined, undefined, undefined, states);
    searchAndFilter.appendChild(dropdownElement);
    searchAndFilter.appendChild(searchElement);
    ele.appendChild(searchAndFilter);
    ele.appendChild(discoverList);
}

let pages = 0;

class Pagination {
    constructor(currentPage, totalPages, change_page_function, d1opt, d1def, d1func, d2opt, d2def, d2func, d3opt, d3def, d3func, d4opt, d4def, d4func) {
        let element = document.createElement("div");
        element.className = "page-container";
        this.element = element;
        let pagesElement = document.createElement("div");
        pagesElement.className = "pages";
        this.pagesElement = pagesElement;
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
        this.pagesElement.innerHTML = "";
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
            new Dropdown(translate("app.discover.sort_by"), this.d1opt, dropdownEle, this.d1def, this.d1func);
            element.appendChild(dropdownEle);
        }
        if (this.d2opt) {
            let dropdownEle = document.createElement("div");
            dropdownEle.style.width = "75px";
            new Dropdown(translate("app.discover.view"), this.d2opt, dropdownEle, this.d2def, this.d2func);
            element.appendChild(dropdownEle);
        }
        if (this.d3opt) {
            let dropdownEle = document.createElement("div");
            dropdownEle.style.width = "180px";
            new SearchDropdown(translate("app.discover.game_version"), this.d3opt, dropdownEle, this.d3def, this.d3func);
            element.appendChild(dropdownEle);
        }
        if (this.d4opt) {
            let dropdownEle = document.createElement("div");
            dropdownEle.style.marginRight = "auto";
            dropdownEle.style.width = "150px";
            new Dropdown(translate("app.discover.loader"), this.d4opt, dropdownEle, this.d4def, this.d4func);
            element.appendChild(dropdownEle);
        }
        this.pagesElement.appendChild(leftArrow);
        for (let i = 1; i <= this.totalPages; i++) {
            if (i == this.currentPage) {
                this.pagesElement.appendChild(currentPageEle);
            } else if (i == 1 || i == this.totalPages || i == this.currentPage + 1 || i == this.currentPage - 1 || this.totalPages <= 5) {
                let pageElement = document.createElement("button");
                pageElement.innerHTML = i;
                pageElement.className = "page";
                pageElement.onclick = () => {
                    this.change_page_function(i);
                }
                this.pagesElement.appendChild(pageElement);
                gap = 0;
            } else {
                if (gap == 0) {
                    let pageCollapseGroup = document.createElement("div");
                    pageCollapseGroup.className = "page-collapse-group";

                    let pageCollapse = document.createElement("div");
                    pageCollapse.className = "page-collapse";
                    pageCollapse.innerHTML = '<i class="fa-solid fa-ellipsis"></i>';
                    pageCollapseGroup.appendChild(pageCollapse);

                    let pageInput = document.createElement("input");
                    pageInput.className = "page-input";
                    pageInput.type = "number";
                    pageCollapseGroup.appendChild(pageInput);

                    pageInput.onchange = () => {
                        let value = Math.floor(pageInput.valueAsNumber);
                        if (value <= 0 || value > this.totalPages || !value) return;
                        this.change_page_function(value);
                    }

                    pageCollapse.onclick = () => {
                        pageInput.focus();
                    }

                    this.pagesElement.appendChild(pageCollapseGroup);
                }
                gap = 1;
            }
        }
        this.pagesElement.appendChild(rightArrow);
        element.appendChild(this.pagesElement);
    }
}

let added_vt_packs = [];

async function getContent(element, instance_id, source, query, loader, version, project_type, vt_version, page = 1, pageSize = 20, sortBy = "relevance", states) {
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
            getContent(element, instance_id, source, query, loader, version, project_type, vt_version, new_page, pageSize, sortBy, states)
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
            getContent(element, instance_id, source, query, loader, version, project_type, vt_version, 1, pageSize, v, states);
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
            getContent(element, instance_id, source, query, loader, version, project_type, vt_version, 1, Number(v), sortBy, states);
        }, ["server"].includes(project_type) ? null : [{ "name": translate("app.discover.game_version.all"), "value": "all" }].concat(minecraftVersions.toReversed().map(e => ({ "name": e, "value": e }))), version ? version : "all", (v) => {
            getContent(element, instance_id, source, query, loader, v == "all" ? null : v, project_type, vt_version, page, pageSize, sortBy, states);
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
            getContent(element, instance_id, source, query, v == "all" ? null : v, version, project_type, vt_version, page, pageSize, sortBy, states);
        });
        let paginationBottom = new Pagination(page, pages, (new_page) => {
            getContent(element, instance_id, source, query, loader, version, project_type, vt_version, new_page, pageSize, sortBy, states)
        });
        element.appendChild(paginationTop.element);
        if (!apiresult.hits || !apiresult.hits.length) {
            let noresults = new NoResultsFound();
            element.appendChild(noresults.element);
            return;
        }
        for (let i = 0; i < apiresult.hits.length; i++) {
            let e = apiresult.hits[i];
            let entry = new ContentSearchEntry(e.title, e.author, e.description, e.downloads, e.icon_url, '<i class="fa-solid fa-download"></i>' + translate("app.discover.install"), (i, button) => {
                installButtonClick(project_type, "modrinth", i.categories, i.icon_url, i.title, i.author, i.versions, i.project_id, instance_id, button, null, undefined, undefined, states)
            }, e.categories.map(e => formatCategory(e)), e, null, "modrinth", e.project_id, instance_id, version, loader, content_ids.includes(e.project_id), false, project_type, undefined, states);
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
            getContent(element, instance_id, source, query, loader, version, project_type, vt_version, new_page, pageSize, sortBy, states)
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
            getContent(element, instance_id, source, query, loader, version, project_type, vt_version, 1, pageSize, v, states);
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
            getContent(element, instance_id, source, query, loader, version, project_type, vt_version, 1, Number(v), sortBy, states);
        }, ["server"].includes(project_type) ? null : [{ "name": translate("app.discover.game_version.all"), "value": "all" }].concat(minecraftVersions.toReversed().map(e => ({ "name": e, "value": e }))), version ? version : "all", (v) => {
            getContent(element, instance_id, source, query, loader, v == "all" ? null : v, project_type, vt_version, page, pageSize, sortBy, states);
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
            getContent(element, instance_id, source, query, v == "all" ? null : v, version, project_type, vt_version, page, pageSize, sortBy, states);
        });
        let paginationBottom = new Pagination(page, pages, (new_page) => {
            getContent(element, instance_id, source, query, loader, version, project_type, vt_version, new_page, pageSize, sortBy, states)
        });
        element.appendChild(paginationTop.element);
        if (!apiresult.data || !apiresult.data.length) {
            let noresults = new NoResultsFound();
            element.appendChild(noresults.element);
            return;
        }
        for (let i = 0; i < apiresult.data.length; i++) {
            let e = apiresult.data[i];
            let entry;
            if (project_type == "server") {
                entry = new ContentSearchEntry(e.name, "", e.serverConnection, e.latestPing.online + "/" + e.latestPing.total, e.favicon, '<i class="fa-solid fa-download"></i>' + translate("app.discover.install"), (i, button) => {
                    installButtonClick(project_type, "curseforge", [], e.favicon, e.name, "", [], e.serverConnection, instance_id, button, null, undefined, undefined, states);
                }, e.tags.map(e => e.name), e, null, "curseforge", e.serverConnection, instance_id, version, loader, false, false, project_type, !e.latestPing.successful, states);
            } else {
                entry = new ContentSearchEntry(e.name, e.authors.map(e => e.name).join(", "), e.summary, e.downloadCount, e.logo?.thumbnailUrl ? e.logo.thumbnailUrl : e.logo.url, '<i class="fa-solid fa-download"></i>' + translate("app.discover.install"), (i, button) => {
                    installButtonClick(project_type, "curseforge", [], e.logo?.thumbnailUrl ? e.logo.thumbnailUrl : e.logo.url, e.name, e.authors.map(e => e.name).join(", "), [], e.id, instance_id, button, null, undefined, undefined, states);
                }, e.categories.map(e => e.name), e, null, "curseforge", e.id, instance_id, version, loader, content_ids.includes(e.id + ".0"), false, project_type, undefined, states);
            }
            element.appendChild(entry.element);
        }
        element.appendChild(paginationBottom.element);
    } else if (source == "vanilla_tweaks") {
        new VanillaTweaksSelector(project_type, version, instance_id, vt_version, element, query);
    }
}

function displayVanillaTweaksEditor(instance_id, version, packs, file_name, content) {
    let wrapper = document.createElement("div");
    wrapper.className = "vt-editor-wrapper";
    let dialog = new Dialog();
    let searchElement = document.createElement("div");
    searchElement.style.height = "48.8px";
    let element = document.createElement("div");
    new SearchBar(searchElement, () => { }, (q) => {
        element.innerHTML = "";
        vt = new VanillaTweaksSelector("resourcepack", version, instance_id, undefined, element, q, true);
    });
    added_vt_packs = packs;
    let vt = new VanillaTweaksSelector("resourcepack", version, instance_id, undefined, element, "", true);
    wrapper.appendChild(searchElement);
    wrapper.appendChild(element);
    dialog.showDialog(translate("app.content.edit_packs"), "notice", wrapper, [
        {
            "type": "cancel",
            "content": translate("app.content.edit_packs.cancel")
        },
        {
            "type": "confirm",
            "content": translate("app.content.edit_packs.confirm")
        }
    ], [], async () => {
        let instanceInfo = new Instance(instance_id);
        let file = await window.electronAPI.downloadVanillaTweaksResourcePacks(added_vt_packs, instanceInfo.vanilla_version, instanceInfo.instance_id, file_name);
        if (!file) {
            displayError(translate("app.discover.vt.fail"));
        } else {
            displaySuccess(translate("app.discover.vt.success_edit"));
            content.setSourceInfo(JSON.stringify(added_vt_packs));
        }
    }, () => { }, true);
}

class VanillaTweaksSelector {
    constructor(type, version, instance_id, vt_version, element, query, hide_install_button) {
        this.type = type;
        this.version = version;
        this.instance_id = instance_id
        this.vt_version = vt_version;
        this.element = element;
        this.query = query;
        this.hide_install_button = hide_install_button;
        this.initialize();
    }
    async initialize() {
        this.element.innerHTML = "";
        let loading = new LoadingContainer();
        this.element.appendChild(loading.element);
        let vanillaTweaksWrapper = document.createElement("div");
        vanillaTweaksWrapper.className = "vt-wrapper";
        let result;
        if (this.type == "datapack" && (this.vt_version == "1.11" || this.vt_version == "1.12")) {
            this.vt_version = "1.13";
        }
        let incompatible_rp_versions = ["1.0", "1.1", "1.2.1", "1.2.2", "1.2.3", "1.2.4", "1.2.5", "1.3", "1.3.1", "1.3.2", "1.4", "1.4.1", "1.4.2", "1.4.3", "1.4.4", "1.4.5", "1.4.6", "1.4.7", "1.5", "1.5.1", "1.5.2", "1.6", "1.6.1", "1.6.2", "1.6.3", "1.6.4", "1.7", "1.7.1", "1.7.2", "1.7.3", "1.7.4", "1.7.5", "1.7.6", "1.7.7", "1.7.8", "1.7.9", "1.7.10", "1.8", "1.8.1", "1.8.2", "1.8.3", "1.8.4", "1.8.5", "1.8.6", "1.8.7", "1.8.8", "1.8.9", "1.9", "1.9.1", "1.9.2", "1.RV-Pre1", "1.9.3", "1.9.4", "1.10", "1.10.1", "1.10.2"];
        let incompatible_dp_versions = incompatible_rp_versions.concat(["1.11", "1.11.1", "1.11.2", "1.12", "1.12.1", "1.12.2"]);
        if (this.version && (this.version.includes("rd") || this.version.includes("rc") || this.version.includes("w") || this.version.includes("pre") || this.version.includes("c") || this.version.includes("inf") || this.version.includes("a") || this.version.includes("b") || this.version.includes("snapshot"))) {
            this.element.innerHTML = "";
            let noresults = new NoResultsFound();
            this.element.appendChild(noresults.element);
            return;
        }
        if (this.version && ((this.type == "datapack" && incompatible_dp_versions.includes(this.version)) || (this.type == "resourcepack" && incompatible_rp_versions.includes(this.version)))) {
            this.element.innerHTML = "";
            let noresults = new NoResultsFound();
            this.element.appendChild(noresults.element);
            return;
        }
        if (this.version && !this.vt_version) {
            this.vt_version = this.version.split(".").splice(0, 2).join(".");
        }
        if (!this.vt_version) this.vt_version = "1.21";
        try {
            if (this.type == "resourcepack") {
                result = await window.electronAPI.getVanillaTweaksResourcePacks(this.query, this.vt_version);
            } else if (this.type == "datapack") {
                result = await window.electronAPI.getVanillaTweaksDataPacks(this.query, this.vt_version);
            }
            this.element.innerHTML = "";
        } catch (err) {
            loading.errorOut(err, () => { this.initialize() });
            return;
        }
        this.element.appendChild(vanillaTweaksWrapper);
        let buttonWrapper = document.createElement("div");
        buttonWrapper.className = "vt-button-wrapper";
        let previewImageWrapper = document.createElement("div");
        previewImageWrapper.className = "vt-preview-image-wrapper";
        let loadingSpinner = document.createElement("span");
        loadingSpinner.innerHTML = '<i class="fa-regular fa-image"></i>';
        loadingSpinner.className = "vt-preview-image-loading-spinner";
        previewImageWrapper.appendChild(loadingSpinner);
        let previewImage = document.createElement("img");
        previewImage.className = "vt-preview-image";
        previewImage.style.display = "none";
        previewImageWrapper.appendChild(previewImage);
        let setImage = (img) => {
            previewImage.style.display = "none";
            loadingSpinner.style.display = "block";
            if (!img) {
                loadingSpinner.innerHTML = '<i class="fa-regular fa-image"></i>'
                return;
            }
            loadingSpinner.innerHTML = '<i class="spinner"></i>';
            previewImage.src = img;
            previewImage.onload = () => {
                loadingSpinner.style.display = "none";
                previewImage.style.display = "block";
            }
            previewImage.onerror = () => {
                loadingSpinner.innerHTML = '<i class="fa-regular fa-image"></i>'
            }
        }
        let dropdownElement = document.createElement("div");
        new Dropdown(translate("app.discover.vt.version"), [
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
            this.type == "resourcepack" ? {
                "name": "1.12",
                "value": "1.12"
            } : null,
            this.type == "resourcepack" ? {
                "name": "1.11",
                "value": "1.11"
            } : null
        ].filter(e => e), dropdownElement, this.vt_version, (s) => {
            this.vt_version = s;
            added_vt_packs = [];
            this.initialize();
        });
        buttonWrapper.appendChild(dropdownElement);
        buttonWrapper.appendChild(previewImageWrapper);
        let selectedPackCount = document.createElement("div");
        selectedPackCount.className = "vt-selected-pack-count";
        let updatePackCount = () => {
            selectedPackCount.innerText = added_vt_packs.length == 1 ? translate("app.vt.selected_pack_count.singular", "%c", added_vt_packs.length) : translate("app.vt.selected_pack_count", "%c", added_vt_packs.length);
        }
        updatePackCount();
        buttonWrapper.appendChild(selectedPackCount);
        let incompatibleSelectedPackCount = document.createElement("div");
        incompatibleSelectedPackCount.className = "vt-selected-pack-count";
        buttonWrapper.appendChild(incompatibleSelectedPackCount);
        let submitButton = document.createElement("button");
        submitButton.className = "vt-submit-button";
        submitButton.innerHTML = '<i class="fa-solid fa-download"></i>' + translate("app.discover.vt.install");
        submitButton.onclick = async () => {
            if (this.type == "datapack") {
                let dialog = new Dialog();
                dialog.showDialog(translate("app.discover.datapacks.title"), "form", [
                    this.instance_id ? null : {
                        "type": "dropdown",
                        "id": "instance",
                        "name": translate("app.discover.datapacks.instance"),
                        "options": data.getInstances().map(e => ({ "name": e.name, "value": e.instance_id }))
                    },
                    {
                        "type": "dropdown",
                        "id": "world",
                        "name": translate("app.discover.datapacks.world"),
                        "options": this.instance_id ? (await getInstanceWorlds(new Instance(this.instance_id))).map(e => ({ "name": e.name, "value": e.id })) : [],
                        "input_source": this.instance_id ? null : "instance",
                        "source": this.instance_id ? null : async (i) => {
                            return (await getInstanceWorlds(new Instance(i))).map(e => ({ "name": e.name, "value": e.id }));
                        }
                    }
                ].filter(e => e), [
                    { "content": translate("app.instances.cancel"), "type": "cancel" },
                    { "content": translate("app.instances.submit"), "type": "confirm" }
                ], [], async (e) => {
                    let info = {};
                    e.forEach(e => { info[e.id] = e.value });
                    let instance = this.instance_id ? this.instance_id : info.instance;
                    let world = info.world;
                    if (world == "loading" || world == "" || !world) {
                        displayError(translate("app.discover.vt.datapack.world"));
                        return;
                    }
                    if (this.instance_id) {
                        submitButton.innerHTML = '<i class="spinner"></i>' + translate("app.discover.installing");
                        submitButton.classList.add("disabled");
                        submitButton.onclick = () => { };
                    }
                    let success = await window.electronAPI.downloadVanillaTweaksDataPacks(added_vt_packs, this.vt_version, instance, world);
                    if (this.instance_id) {
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
            } else if (this.instance_id) {
                submitButton.innerHTML = '<i class="spinner"></i>' + translate("app.discover.installing");
                submitButton.onclick = () => { };
                let file_name = await window.electronAPI.downloadVanillaTweaksResourcePacks(added_vt_packs, this.vt_version, this.instance_id);
                if (!file_name) {
                    displayError(translate("app.discover.vt.fail"));
                    return;
                }
                let instance = new Instance(this.instance_id);
                instance.addContent(translate("app.discover.vt.title"), translate("app.discover.vt.author"), "https://vanillatweaks.net/assets/images/logo.png", file_name, "vanilla_tweaks", "resource_pack", "", JSON.stringify(added_vt_packs), false);
                submitButton.innerHTML = '<i class="fa-solid fa-check"></i>' + translate("app.discover.installed");
            } else {
                let dialog = new Dialog();
                let instances = data.getInstances();

                let installGrid = document.createElement("div");
                installGrid.className = "install-grid";

                let installGridEntry = document.createElement("div");
                installGridEntry.className = "install-grid-entry";

                let createNewButton = document.createElement("button");
                createNewButton.className = "install-grid-create";
                createNewButton.innerHTML = '<i class="fa-solid fa-plus"></i>' + translate("app.discover.select_instance.create");
                createNewButton.onclick = () => {
                    let dialog2 = new Dialog();
                    dialog2.showDialog(translate("app.button.instances.create"), "form", [
                        {
                            "type": "image-upload",
                            "id": "icon",
                            "name": translate("app.instances.icon")
                        },
                        {
                            "type": "text",
                            "name": translate("app.instances.name"),
                            "id": "name",
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
                            "id": "loader"
                        },
                        {
                            "type": "dropdown",
                            "name": translate("app.instances.game_version"),
                            "options": [],
                            "id": "game_version",
                            "input_source": "loader",
                            "source": VersionList.getVersions,
                            "default": VersionList.getLatestRelease()
                        }
                    ], [
                        { "content": translate("app.instances.cancel"), "type": "cancel" },
                        { "content": translate("app.instances.submit"), "type": "confirm" }
                    ], [], async (e) => {
                        dialog.closeDialog();
                        contentInfo.close();
                        let info = {};
                        e.forEach(e => { info[e.id] = e.value });
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
                        try {
                            if (info.loader == "fabric") {
                                loader_version = (await window.electronAPI.getFabricVersion(info.game_version))
                            } else if (info.loader == "forge") {
                                loader_version = (await window.electronAPI.getForgeVersion(info.game_version))
                            } else if (info.loader == "neoforge") {
                                loader_version = (await window.electronAPI.getNeoForgeVersion(info.game_version))
                            } else if (info.loader == "quilt") {
                                loader_version = (await window.electronAPI.getQuiltVersion(info.game_version))
                            }
                        } catch (e) {
                            displayError(translate("app.instances.failed_to_create"));
                            return;
                        }
                        let instance = data.addInstance(info.name, new Date(), new Date(), "", info.loader, info.game_version, loader_version, false, false, "", info.icon, instance_id, 0, "custom", "", false, false);
                        instance.setInstalling(true);
                        showSpecificInstanceContent(instance);
                        let file_name = await window.electronAPI.downloadVanillaTweaksResourcePacks(added_vt_packs, this.vt_version, instance_id);
                        if (file_name) {
                            instance.addContent(translate("app.discover.vt.title"), translate("app.discover.vt.author"), "https://vanillatweaks.net/assets/images/logo.png", file_name, "vanilla_tweaks", "resource_pack", "", JSON.stringify(added_vt_packs), false);
                        }
                        instance.setInstalling(false);
                        let r = await window.electronAPI.downloadMinecraft(instance_id, info.loader, info.game_version, loader_version);
                        if (r.error) {
                            instance.setFailed(true);
                        } else {
                            instance.setJavaPath(r.java_installation);
                            instance.setJavaVersion(r.java_version);
                            instance.setJavaArgs(r.java_args);
                            instance.setProvidedJavaArgs(r.java_args);
                            instance.setMcInstalled(true);
                        }
                    });
                }

                installGridEntry.appendChild(createNewButton);
                installGrid.appendChild(installGridEntry);
                for (let i = 0; i < instances.length; i++) {
                    if (instances[i].locked) continue;
                    let installGridEntry = document.createElement("div");
                    installGridEntry.className = "install-grid-entry";

                    let installGridInstance = document.createElement("div");
                    installGridInstance.className = "install-grid-instance";

                    let image = document.createElement("img");
                    image.src = instances[i].image ? instances[i].image : getDefaultImage(instances[i].instance_id);
                    image.className = "instance-image";

                    let info = document.createElement("div");
                    info.className = "instance-info";

                    let name = document.createElement("div");
                    name.className = "instance-name";
                    name.innerText = instances[i].name;

                    let desc = document.createElement("div");
                    desc.className = "instance-desc";
                    desc.innerText = loaders[instances[i].loader] + " " + instances[i].vanilla_version;

                    info.appendChild(name);
                    info.appendChild(desc);

                    installGridInstance.appendChild(image);
                    installGridInstance.appendChild(info);

                    let installButton = document.createElement("button");
                    installButton.className = "install-grid-install";
                    installButton.innerHTML = '<i class="fa-solid fa-download"></i>' + translate("app.discover.install");
                    installButton.onclick = async () => {
                        let success;
                        installButton.innerHTML = '<i class="spinner"></i>' + translate("app.discover.installing");
                        installButton.classList.add("disabled");
                        installButton.onclick = () => { };
                        let file_name = await window.electronAPI.downloadVanillaTweaksResourcePacks(added_vt_packs, this.vt_version, instances[i].instance_id);
                        if (!file_name) {
                            success = false;
                        } else {
                            success = true;
                        }
                        if (success) {
                            let instance = instances[i];
                            instance.addContent(translate("app.discover.vt.title"), translate("app.discover.vt.author"), "https://vanillatweaks.net/assets/images/logo.png", file_name, "vanilla_tweaks", "resource_pack", "", JSON.stringify(added_vt_packs), false);
                            installButton.innerHTML = '<i class="fa-solid fa-check"></i>' + translate("app.discover.installed");
                        } else {
                            installButton.innerHTML = '<i class="fa-solid fa-xmark"></i>' + translate("app.discover.failed");
                        }
                    }

                    installGridEntry.appendChild(installGridInstance);
                    installGridEntry.appendChild(installButton);

                    installGrid.appendChild(installGridEntry);
                }
                dialog.showDialog(translate("app.discover.select_instance.vt.title"), "notice", installGrid, [
                    { "content": translate("app.discover.select_instance.confirm"), "type": "confirm" }
                ], null, () => { });
            }
        }
        if (!this.hide_install_button) buttonWrapper.append(submitButton);
        let vanillaTweaksEntries = document.createElement("div");
        vanillaTweaksEntries.className = "vt-entries";
        if (!result.hits || !result.hits.length) {
            let noresults = new NoResultsFound();
            vanillaTweaksEntries.appendChild(noresults.element);
        }
        let name_map = {};
        result.hits.map(e => {
            name_map[e.vt_id] = e.title;
        })
        let checkForIncompatibilities = () => {
            result.hits.map(e => e.entry).forEach(e => {
                e.classList.remove("incompatible");
                if (e.classList.contains("experimental")) {
                    e.title = translate("app.discover.experimental");
                } else {
                    e.removeAttribute("title");
                }
            });
            let added_packs_ids = added_vt_packs.map(e => e.id);
            let count = 0;
            result.hits.forEach(e => {
                if (added_packs_ids.includes(e.vt_id)) {
                    let incompatibleWith = [];
                    for (let i = 0; i < e.incompatible.length; i++) {
                        if (added_packs_ids.includes(e.incompatible[i])) {
                            incompatibleWith.push(name_map[e.incompatible[i]] ?? e.incompatible[i]);
                        }
                    }
                    if (incompatibleWith.length) {
                        e.entry.classList.add("incompatible");
                        e.entry.setAttribute("title", translate("app.discover.vt.incompatible", "%p", incompatibleWith.join(", ")));
                        count++;
                    }
                }
            });
            if (count > 0) {
                incompatibleSelectedPackCount.innerText = translate("app.vt.incompatible_selected_pack_count", "%c", count);
            } else {
                incompatibleSelectedPackCount.innerText = "";
            }
        }
        let categoryElements = {};
        let current_ids = added_vt_packs.map(e => e.id);
        for (let i = 0; i < result.hits.length; i++) {
            let e = result.hits[i];
            let entry = document.createElement("div");
            entry.className = "vt-entry";
            e.entry = entry;
            entry.onmouseenter = () => {
                if (!e.type || e.type == "ct") setImage(e.image);
                else setImage();
            }
            if (e.experiment) {
                entry.classList.add("experimental");
                entry.title = translate("app.discover.experimental");
            }
            let vtIcon = document.createElement("img");
            vtIcon.className = "vt-icon";
            vtIcon.src = e.icon_url ? e.icon_url : getDefaultImage(e.title);
            let vtInfo = document.createElement("div");
            vtInfo.className = "vt-info";
            let vtTitle = document.createElement("div");
            vtTitle.className = "vt-title";
            vtTitle.innerText = e.title;
            let vtDesc = document.createElement("div");
            vtDesc.className = "vt-desc";
            vtDesc.innerHTML = e.description;
            vtInfo.appendChild(vtTitle);
            vtInfo.appendChild(vtDesc);
            let vtToggle = document.createElement("button");
            vtToggle.className = "vt-toggle";
            let toggle = new Toggle(vtToggle, (v) => {
                if (v) {
                    added_vt_packs.push({ "id": e.vt_id, "type": e.type })
                } else {
                    added_vt_packs = added_vt_packs.filter(f => f.id != e.vt_id);
                }
                checkForIncompatibilities();
                updatePackCount();
            }, current_ids.includes(e.vt_id), true);
            entry.onclick = () => {
                toggle.toggle();
            }
            entry.appendChild(vtIcon);
            entry.appendChild(vtInfo);
            entry.appendChild(vtToggle);
            if (!categoryElements[e.breadcrumb]) {
                let temp = document.createElement("div");
                temp.className = "vt-entries";
                categoryElements[e.breadcrumb] = temp;
            }
            categoryElements[e.breadcrumb].appendChild(entry);
        }
        let keys = Object.keys(categoryElements);
        keys.forEach(key => {
            let categories = key.split(" > ");
            let details = new Details(categoryElements[key], categories.slice(0, -1).map(e => `<span class='breadcrumb-prefix'>${e}</span>`).join('<span class="breadcrumb-delimiter breadcrumb-prefix">-</span>') + (categories.length > 1 ? '<span class="breadcrumb-delimiter breadcrumb-prefix">-</span>' : "") + `<span>${categories[categories.length - 1]}</span>`);
            let foundplace = false;
            while (!foundplace) {
                categories.splice(categories.length - 1);
                let newKey = categories.join(" > ");
                if (categoryElements[newKey]) {
                    categoryElements[newKey].appendChild(details.element);
                    foundplace = true;
                }
                if (newKey == "") {
                    vanillaTweaksEntries.appendChild(details.element);
                    foundplace = true;
                }
            }
        });
        vanillaTweaksWrapper.appendChild(vanillaTweaksEntries);
        vanillaTweaksWrapper.appendChild(buttonWrapper);
        checkForIncompatibilities();
    }
}

class Details {
    constructor(element, title) {
        let detailsWrapper = document.createElement("div");
        detailsWrapper.className = "details";
        let detailstop = document.createElement("button");
        detailstop.className = "details-top";
        let detailTitle = document.createElement("span");
        detailTitle.className = "details-top-text";
        detailTitle.innerHTML = title;
        let detailChevron = document.createElement("span");
        detailChevron.className = "details-top-chevron";
        detailChevron.innerHTML = '<i class="fa-solid fa-chevron-down"></i>';
        detailstop.appendChild(detailTitle);
        detailstop.appendChild(detailChevron);
        let detailContent = document.createElement("div");
        detailContent.className = "details-content";
        detailsWrapper.appendChild(detailstop);
        detailsWrapper.appendChild(detailContent);
        detailContent.appendChild(element);
        this.element = detailsWrapper;
        this.isOpen = false;
        detailstop.onclick = async () => {
            this.toggle();
        }
    }
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }
    open() {
        this.element.classList.add("open");
        this.isOpen = true;
    }
    close() {
        this.element.classList.remove("open");
        this.isOpen = false;
    }
}

async function installContent(source, project_id, instance_id, project_type, title, author, icon_url, data_pack_world) {
    let instance = new Instance(instance_id);
    let version_json;
    let max_pages = 10;
    let id;
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
    }
    let initialContent = {};
    if (instance.getContent().map(e => e.source_id).includes(project_id)) {
        return false;
    }
    for (let j = 0; j < version_json.length; j++) {
        if (version_json[j].game_versions.includes(instance.vanilla_version) && (project_type != "mod" || version_json[j].loaders.includes(instance.loader)) && (source != "modrinth" || project_type != "datapack" || version_json[j].loaders.includes("datapack"))) {
            id = version_json[j].id;
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
                    id = version_json[j].id;
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

    return { id };
}

async function installSpecificVersion(version_info, source, instance, project_type, title, author, icon_url, project_id, isUpdate, data_pack_world) {
    if (project_type == "server") {
        let initialContent = await addContent(instance_id, project_type, project_id, title, icon_url, project_id);
        return initialContent;
    }
    let instance_id = instance.instance_id;
    let content = instance.getContent();
    let modrinth_ids = content.filter(e => e.source == "modrinth").map(e => e.source_info);
    let curseforge_ids = content.filter(e => e.source == "curseforge").map(e => Number(e.source_info));
    let initialContent = await addContent(instance_id, project_type, version_info.files[0].url, version_info.files[0].filename, data_pack_world, project_id);
    if (isUpdate) return initialContent;
    let version = version_info.version_number ? version_info.version_number : "";
    let version_id = version_info.id;
    let dependencies = version_info.dependencies;
    if (instance.getContent().map(e => e.source_id).includes(project_id)) {
        return;
    }
    if (project_type != "world" && project_type != "datapack") instance.addContent(title, author, icon_url, initialContent.file_name, source, initialContent.type, version, project_id, false, version_id);
    if (initialContent.stop_installing_dependencies) return initialContent;
    if (dependencies && source == "modrinth" && project_type != "world" && project_type != "datapack") {
        for (let j = 0; j < dependencies.length; j++) {
            let dependency = dependencies[j];
            if (modrinth_ids.includes(dependency.project_id)) continue;
            let res = await fetch(`https://api.modrinth.com/v2/project/${dependency.project_id}`);
            let res_json = await res.json();
            let get_author_res = await fetch(`https://api.modrinth.com/v2/project/${dependency.project_id}/members`);
            let get_author_res_json = await get_author_res.json();
            let author = "";
            author = get_author_res_json.map(e => e.user.username).join(", ");
            if (dependency.dependency_type == "required") {
                await installContent(source, dependency.project_id, instance_id, res_json.project_type, res_json.title, author, res_json.icon_url);
            }
        }
    } else if (dependencies && source == "curseforge" && project_type != "world" && project_type != "datapack") {
        for (let j = 0; j < dependencies.length; j++) {
            let dependency = dependencies[j];
            if (curseforge_ids.includes(Number(dependency.id))) continue;
            let project_type = "mod";
            if (dependency.categoryClass.slug == "texture-packs") project_type = "resourcepack";
            if (dependency.categoryClass.slug == "shaders") project_type = "shader";
            if (dependency.type == "RequiredDependency") {
                await installContent(source, dependency.id, instance_id, project_type, dependency.name, dependency.authorName, dependency.logoUrl);
            }
        }
    }
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

async function addContent(instance_id, project_type, project_url, filename, data_pack_world, content_id) {
    return await window.electronAPI.addContent(instance_id, project_type, project_url, filename, data_pack_world, content_id);
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
        discoverContent.displayContent();
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
            let skin = data.addSkin(translate("app.wardrobe.unnamed"), e.variant == "CLASSIC" ? "wide" : "slim", "", hash.hash, hash.dataUrl, false, new Date());
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
            newInstance.setJavaArgs(instanceInfo.java_args);
            newInstance.setProvidedJavaArgs(instanceInfo.provided_java_args);
            newInstance.setUsesCustomJavaArgs(instanceInfo.uses_custom_java_args);
            newInstance.setJavaPath(instanceInfo.java_path);
            newInstance.setJavaVersion(instanceInfo.java_version);
            newInstance.setAllocatedRam(instanceInfo.allocated_ram);
            newInstance.setEnvVars(instanceInfo.env_vars);
            newInstance.setPostExitHook(instanceInfo.post_exit_hook);
            newInstance.setPreLaunchHook(instanceInfo.pre_launch_hook);
            newInstance.setPostLaunchHook(instanceInfo.post_launch_hook);
            newInstance.setWrapper(instanceInfo.wrapper);
            newInstance.setWindowHeight(instanceInfo.window_height);
            newInstance.setWindowWidth(instanceInfo.window_width);
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

async function getRecentlyPlayedWorlds(ignore_world_ids) {
    let all_servers = await window.electronAPI.getAllServers(data.getInstances().map(e => e.instance_id));
    all_servers = all_servers.map(server => ({
        ...server,
        "last_played": getServerLastPlayed(server.instance_id, server.ip)
    }))
    let last_played_worlds = await window.electronAPI.getRecentlyPlayedWorlds(data.getInstances().map(e => e.instance_id));
    let all = last_played_worlds.concat(all_servers);
    all = all.filter(e => !ignore_world_ids.includes((e.id ? e.id : e.ip) + ":" + e.instance_id))
    all.sort((a, b) => b.last_played - a.last_played);
    return all.slice(0, 5);
}

function getRecentlyPlayedInstances(ignore_instance_ids = []) {
    let instances = db.prepare("SELECT * FROM instances").all();
    instances = instances.filter(e => !ignore_instance_ids.includes(e.instance_id));
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

async function displayContentInfo(content_source, content_id, instance_id, vanilla_version, loader, locked, disableAddToHistory = false, content_list_to_update, infoData, pt, states) {
    if (!content_source) return;
    if (!disableAddToHistory) {
        if (contentInfo.open) {
            contentInfoHistory = contentInfoHistory.slice(0, contentInfoIndex + 1);
            contentInfoHistory.push({ "content_source": content_source, "content_id": content_id, "info_data": infoData, "project_type": pt, "loader": loader });
            contentInfoIndex++;
        } else {
            contentInfoHistory = [{ "content_source": content_source, "content_id": content_id, "info_data": infoData, "project_type": pt, "loader": loader }];
            contentInfoIndex = 0;
        }
    }
    let instance_content = [];
    if (instance_id) instance_content = (new Instance(instance_id)).getContent();
    let currentlyInstalling = false;

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
            displayContentInfo(contentInfoHistory[contentInfoIndex].content_source, contentInfoHistory[contentInfoIndex].content_id, instance_id, vanilla_version, contentInfoHistory[contentInfoIndex].loader, locked, true, null, contentInfoHistory[contentInfoIndex].info_data, contentInfoHistory[contentInfoIndex].project_type, states);
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
            displayContentInfo(contentInfoHistory[contentInfoIndex].content_source, contentInfoHistory[contentInfoIndex].content_id, instance_id, vanilla_version, contentInfoHistory[contentInfoIndex].loader, locked, true, contentInfoHistory[contentInfoIndex].info_data, contentInfoHistory[contentInfoIndex].project_type, states);
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
            content_id = mr_content.id;
        } catch (e) {
            loading.errorOut(e, () => {
                displayContentInfo(content_source, content_id, instance_id, vanilla_version, loader, locked, true, content_list_to_update, infoData, pt, states);
            });
            return;
        }
        content = mr_content;
        content.author = team_members.map(e => e.user.username).join(", ");
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
                displayContentInfo(content_source, content_id, instance_id, vanilla_version, loader, locked, true, content_list_to_update, infoData, pt, states);
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
            "icon_url": cf_content.data?.logo?.thumbnailUrl ? cf_content.data.logo.thumbnailUrl : (cf_content.data?.logo?.url ? cf_content.data.logo.url : ""),
            "title": cf_content.data.name,
            "project_type": project_type,
            "downloads": cf_content.data.downloadCount,
            "source": "curseforge",
            "updated": cf_content.data.dateModified,
            "author": cf_content.data.authors.map(e => e.name).join(", "),
            "loaders": [],
            "game_versions": [],
            "id": cf_content.data.id,
            "urls": {
                "source": cf_content.data.links.sourceUrl,
                "wiki": cf_content.data.links.wikiUrl,
                "issues": cf_content.data.links.issuesUrl,
                "browser": cf_content.data.links.websiteUrl,
                "mastodon": cf_content.data.socialLinks?.filter(e => e.type == 1)[0]?.url,
                "discord": cf_content.data.socialLinks?.filter(e => e.type == 2)[0]?.url,
                "website": cf_content.data.socialLinks?.filter(e => e.type == 3)[0]?.url,
                "facebook": cf_content.data.socialLinks?.filter(e => e.type == 4)[0]?.url,
                "twitter": cf_content.data.socialLinks?.filter(e => e.type == 5)[0]?.url,
                "instagram": cf_content.data.socialLinks?.filter(e => e.type == 6)[0]?.url,
                "patreon": cf_content.data.socialLinks?.filter(e => e.type == 7)[0]?.url,
                "twitch": cf_content.data.socialLinks?.filter(e => e.type == 8)[0]?.url,
                "reddit": cf_content.data.socialLinks?.filter(e => e.type == 9)[0]?.url,
                "youtube": cf_content.data.socialLinks?.filter(e => e.type == 10)[0]?.url,
                "tiktok": cf_content.data.socialLinks?.filter(e => e.type == 11)[0]?.url,
                "pinterest": cf_content.data.socialLinks?.filter(e => e.type == 12)[0]?.url,
                "github": cf_content.data.socialLinks?.filter(e => e.type == 13)[0]?.url,
                "bluesky": cf_content.data.socialLinks?.filter(e => e.type == 14)[0]?.url
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
    contentImage.src = content.icon_url ? content.icon_url : getDefaultImage(content.title);
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
        currentlyInstalling = true;
        installButtonClick(content.project_type, content.source, content.loaders, content.icon_url, content.title, content.author, content.game_versions, content.id, instance_id, installButton, contentInfo, null, (id) => {
            if (tabs.selected == "files" && refreshVersionsList) {
                setVerionIdAndIndex(id);
                refreshVersionsList();
            }
        }, states);
    }
    if (states) {
        states[content_id].buttons.push(installButton);
    }
    if (global_discover_content_states[content_id]) global_discover_content_states[content_id].push(installButton);
    else global_discover_content_states[content_id] = [installButton];
    let threeDots = document.createElement("button");
    threeDots.classList.add("content-top-more");
    threeDots.innerHTML = '<i class="fa-solid fa-ellipsis-vertical"></i>';
    let links = [];
    if (content.urls.website) {
        links.push({
            "icon": '<i class="fa-solid fa-globe"></i>',
            "title": translate("app.discover.view.website"),
            "func": (e) => {
                window.electronAPI.openInBrowser(content.urls.website);
            }
        })
    }
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
            "icon": '<i class="fa-brands fa-x-twitter"></i>',
            "title": translate("app.discover.view.twitter"),
            "func": (e) => {
                window.electronAPI.openInBrowser(content.urls.twitter);
            }
        })
    }
    if (content.urls.bluesky) {
        links.push({
            "icon": '<i class="fa-brands fa-bluesky"></i>',
            "title": translate("app.discover.view.bluesky"),
            "func": (e) => {
                window.electronAPI.openInBrowser(content.urls.bluesky);
            }
        })
    }
    if (content.urls.mastodon) {
        links.push({
            "icon": '<i class="fa-brands fa-mastodon"></i>',
            "title": translate("app.discover.view.mastodon"),
            "func": (e) => {
                window.electronAPI.openInBrowser(content.urls.mastodon);
            }
        })
    }
    if (content.urls.instagram) {
        links.push({
            "icon": '<i class="fa-brands fa-instagram"></i>',
            "title": translate("app.discover.view.instagram"),
            "func": (e) => {
                window.electronAPI.openInBrowser(content.urls.instagram);
            }
        })
    }
    if (content.urls.youtube) {
        links.push({
            "icon": '<i class="fa-brands fa-youtube"></i>',
            "title": translate("app.discover.view.youtube"),
            "func": (e) => {
                window.electronAPI.openInBrowser(content.urls.youtube);
            }
        })
    }
    if (content.urls.reddit) {
        links.push({
            "icon": '<i class="fa-brands fa-reddit"></i>',
            "title": translate("app.discover.view.reddit"),
            "func": (e) => {
                window.electronAPI.openInBrowser(content.urls.reddit);
            }
        })
    }
    if (content.urls.facebook) {
        links.push({
            "icon": '<i class="fa-brands fa-facebook"></i>',
            "title": translate("app.discover.view.facebook"),
            "func": (e) => {
                window.electronAPI.openInBrowser(content.urls.facebook);
            }
        })
    }
    if (content.urls.twitch) {
        links.push({
            "icon": '<i class="fa-brands fa-twitch"></i>',
            "title": translate("app.discover.view.twitch"),
            "func": (e) => {
                window.electronAPI.openInBrowser(content.urls.twitch);
            }
        })
    }
    if (content.urls.tiktok) {
        links.push({
            "icon": '<i class="fa-brands fa-tiktok"></i>',
            "title": translate("app.discover.view.tiktok"),
            "func": (e) => {
                window.electronAPI.openInBrowser(content.urls.tiktok);
            }
        })
    }
    if (content.urls.pinterest) {
        links.push({
            "icon": '<i class="fa-brands fa-pinterest"></i>',
            "title": translate("app.discover.view.pinterest"),
            "func": (e) => {
                window.electronAPI.openInBrowser(content.urls.pinterest);
            }
        })
    }
    if (content.urls.github) {
        links.push({
            "icon": '<i class="fa-brands fa-github"></i>',
            "title": translate("app.discover.view.github"),
            "func": (e) => {
                window.electronAPI.openInBrowser(content.urls.github);
            }
        })
    }
    if (content.urls.patreon) {
        links.push({
            "icon": '<i class="fa-brands fa-patreon"></i>',
            "title": translate("app.discover.view.patreon"),
            "func": (e) => {
                window.electronAPI.openInBrowser(content.urls.patreon);
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
    if (states && states[content_id].state == "installed") {
        installButton.innerHTML = '<i class="fa-solid fa-check"></i>' + translate("app.discover.installed");
        installButton.classList.add("disabled");
        installButton.onclick = () => { };
    } else if (states && states[content_id].state == "installing") {
        installButton.innerHTML = '<i class="spinner"></i>' + translate("app.discover.installing");
        installButton.classList.add("disabled");
        installButton.onclick = () => { };
        currentlyInstalling = true;
    } else if (content_ids.includes(content.id)) {
        installButton.innerHTML = '<i class="fa-solid fa-check"></i>' + translate("app.discover.installed");
        installButton.classList.add("disabled");
        installButton.onclick = () => { };
    }
    if (locked) {
        installButton.classList.add("disabled");
        installButton.onclick = () => { };
        installButton.setAttribute("title", translate("app.discover.locked.tooltip"));
    }

    let tabsElement = document.createElement("div");
    contentWrapper.appendChild(tabsElement);
    let tabContent = document.createElement("div");
    tabContent.className = "tab-info";
    tabContent.style.padding = "10px";
    contentWrapper.appendChild(tabContent);
    contentInfo.showModal();
    tabsElement.style.marginInline = "auto";
    let refreshVersionsList;
    let setVerionIdAndIndex;
    let tabs = new TabContent(tabsElement, [
        {
            "name": translate("app.discover.tabs.description"),
            "value": "description",
            "func": () => {
                tabContent.style.paddingTop = "10px";
                tabContent.innerHTML = "";
                let element = document.createElement("div");
                element.className = "markdown-body";
                element.style.maxWidth = "800px";
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

                let versionDropdown = new SearchDropdown(
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
                let loaderDropdown = new Dropdown(translate("app.discover.loader"),
                    [{
                        "name": translate("app.discover.loader.all"),
                        "value": "all"
                    }].concat(allLoaders.map(e => ({ "name": translate("app.loader." + e), "value": e }))),
                    mcLoaderFilter, loader ? loader : "all", (v) => {
                        filterVersions(versionDropdown.value, v, channelDropdown.value, 1);
                    })
                let channelFilter = document.createElement("div");
                let channelDropdown = new Dropdown(translate("app.discover.channel"), [
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
                    currentlyInstalling = false;
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

                        if (!minecraftVersions || !minecraftVersions.length) {
                            e.game_versions.reverse();
                        } else {
                            const order = new Map(minecraftVersions.map((v, i) => [v, i]));
                            e.game_versions.sort((a, b) => {
                                const aIndex = order.has(a) ? order.get(a) : -1;
                                const bIndex = order.has(b) ? order.get(b) : -1;

                                return bIndex - aIndex;
                            });
                        }

                        //Game Version
                        let tagWrapper = document.createElement("div");
                        tagWrapper.className = "version-file-chip-wrapper";
                        let tagWrapperForDialog = document.createElement("div");
                        tagWrapperForDialog.className = "version-file-chip-wrapper";
                        e.game_versions.forEach((i, count) => {
                            let tag = document.createElement("div");
                            tag.className = "version-file-chip";
                            tag.textContent = i;
                            if (count < 10) tagWrapper.appendChild(tag);
                            let clone = tag.cloneNode();
                            clone.textContent = i;
                            tagWrapperForDialog.appendChild(clone);
                        });
                        if (e.game_versions.length > 10) {
                            let tag = document.createElement("button");
                            tag.className = "version-file-chip-more";
                            tag.textContent = translate("app.discover.files.versions.more");
                            tag.onclick = () => {
                                let dialog = new Dialog();
                                dialog.showDialog(translate(`app.discover.files.${content.combine_versions_and_loaders ? "versions_loaders" : "versions"}.title`, "%t", e.name), "notice", tagWrapperForDialog, [
                                    {
                                        "type": "cancel",
                                        "content": translate("app.discover.files.versions.done")
                                    }
                                ], [], () => { });
                            }
                            tagWrapper.appendChild(tag);
                        }
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
                                tag.textContent = translate("app.loader." + i);
                                tagWrapper2.appendChild(tag);
                            });
                            versionEle.appendChild(tagWrapper2);
                        }

                        //Published
                        let published = document.createElement("div");
                        published.className = "version-file-text";
                        published.textContent = formatDate(e.date_published);
                        versionEle.appendChild(published);

                        //Downloads
                        let downloads = document.createElement("div");
                        downloads.className = "version-file-text";
                        downloads.textContent = formatNumber(e.downloads);
                        versionEle.appendChild(downloads);

                        // Install Button
                        let installButton = document.createElement("button");
                        installButton.innerHTML = '<i class="fa-solid fa-download"></i>' + translate("app.discover.install");
                        installButton.setAttribute("title", translate("app.discover.install_specific_version"));
                        installButton.className = "version-file-install"
                        let updateToSpecificVersion = async () => {
                            if (currentlyInstalling) return;
                            if (instance_id & content.project_type != "world" && content.project_type != "datapack") currentlyInstalling = true;
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
                            if (states) {
                                states[content_id].state = "installing";
                                states[content_id].buttons.forEach(e => {
                                    e.innerHTML = '<i class="spinner"></i>' + translate("app.instances.installing");
                                    e.classList.add("disabled");
                                    e.onclick = () => { };
                                });
                            }
                            if (global_discover_content_states[content_id]) global_discover_content_states[content_id].push(installButton);
                            else global_discover_content_states[content_id] = [installButton];
                            let theContent = null;
                            for (let i = 0; i < contentList.length; i++) {
                                if (contentList[i].source_info == content.id || (content.convert_version_ids_to_numbers && Number(contentList[i].source_info) == Number(content.id))) {
                                    theContent = contentList[i];
                                }
                            }
                            if (!theContent) return;
                            await updateContent(instanceInfo, theContent, e.id);
                            installButton.innerHTML = '<i class="fa-solid fa-check"></i>' + translate("app.discover.installed");
                            if (states) {
                                states[content_id].state = "installed";
                                states[content_id].buttons.forEach(e => {
                                    e.innerHTML = '<i class="fa-solid fa-check"></i>' + translate("app.discover.installed");
                                });
                            }
                            if (content_list_to_update) content_list_to_update.updateSecondaryColumn();
                            if (instance_id) {
                                installedVersion = e.id;
                                if (content.convert_version_ids_to_numbers) installedVersion = Number(installedVersion);
                                installedVersionIndex = i;
                                showVersions();
                            }
                            global_discover_content_states[content_id] = global_discover_content_states[content_id].filter(e => e != installButton);
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
                                if (currentlyInstalling) return;
                                global_discover_content_states[content_id].push(installButton);
                                if (instance_id & content.project_type != "world" && content.project_type != "datapack") currentlyInstalling = true;
                                if (content.project_type != "modpack") installButton.innerHTML = '<i class="spinner"></i>' + translate("app.instances.installing");
                                if (content.project_type != "modpack") installButton.classList.add("disabled");
                                if (content.project_type != "modpack") installButton.onclick = () => { };
                                installButtonClick(content.project_type, content.source, e.loaders, content.icon_url, content.title, content.author, e.game_versions, content_id, instance_id, installButton, contentInfo, e.original_version_info, () => {
                                    if (content.project_type != "modpack") installButton.innerHTML = '<i class="fa-solid fa-check"></i>' + translate("app.discover.installed");
                                    if (instance_id) {
                                        installedVersion = e.id;
                                        installedVersionIndex = i;
                                        showVersions();
                                    }
                                    global_discover_content_states[content_id] = global_discover_content_states[content_id].filter(e => e != installButton);
                                }, states);
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

                setVerionIdAndIndex = (id) => {
                    installedVersion = id;
                    installedVersionIndex = content.versions.findIndex(v => v.id === installedVersion);
                }

                refreshVersionsList = showVersions;

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
                    authorImg.src = e.user.avatar_url ? e.user.avatar_url : getDefaultImage(e.user.username);
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
                        displayScreenshot(e.title ?? translate("app.discover.gallery.untitled"), e.description, e.raw_url, null, null, null, screenshotInformation, screenshotInformation.map(e => e.file).indexOf(e.raw_url), translate("app.discover.gallery.image"));
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
                                displayContentInfo("modrinth", pageId, instance_id, vanilla_version, pageType == "datapack" ? "datapack" : (loader == "datapack" ? "" : loader), locked);
                            });
                            el.addEventListener('keydown', (e) => {
                                if (e.key == "Enter" || e.key == " ") {
                                    e.preventDefault();
                                    displayContentInfo("modrinth", pageId, instance_id, vanilla_version, pageType == "datapack" ? "datapack" : (loader == "datapack" ? "" : loader), locked);
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
                                displayContentInfo("curseforge", pageId + ":" + map[pageType], instance_id, vanilla_version, loader == "datapack" ? "" : loader, locked);
                            });
                            el.addEventListener('keydown', (e) => {
                                if (e.key == "Enter" || e.key == " ") {
                                    e.preventDefault();
                                    displayContentInfo("curseforge", pageId + ":" + map[pageType], instance_id, vanilla_version, loader == "datapack" ? "" : loader, locked);
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
                window.electronAPI.showFileInFolder(file_path);
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

async function checkForContentUpdates(source, project_id, version_ids, loaders, game_versions, type) {
    console.log(type);
    console.log(version_ids);
    console.log(loaders);
    console.log(game_versions);
    let results = [];
    if (source == "modrinth") {
        let res = await fetch(`https://api.modrinth.com/v2/project/${project_id}/version`);
        let version_json = await res.json();
        for (let i = 0; i < version_ids.length; i++) {
            versions: for (let j = 0; j < version_json.length; j++) {
                if ((version_json[j].game_versions.includes(game_versions[i]) && (type != "mod" || version_json[j].loaders.includes(loaders[i])))) {
                    if (version_json[j].id == version_ids[i]) {
                        results[i] = false;
                        break versions;
                    }
                    results[i] = version_json[j].id;
                    break versions;
                }
            }
        }
    } else if (source == "curseforge") {
        let version_json = await window.electronAPI.getCurseforgePage(project_id, 1);
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

        ids: for (let i = 0; i < version_ids.length; i++) {
            for (let j = 0; j < version_json.length; j++) {
                if ((version_json[j].game_versions.includes(game_versions[i]) && (type != "mod" || version_json[j].loaders.includes(loaders[i])))) {
                    if (Number(version_json[j].id) == Number(version_ids[i])) {
                        results[i] = false;
                        continue ids;
                    }
                    results[i] = version_json[j].id;
                    continue ids;
                }
            }
        }

        if (results.length != version_ids.length || results.includes(undefined)) {
            let not_found = true;
            let count = 1;
            while (not_found) {
                count++;
                if (count >= max_pages) {
                    not_found = false;
                    continue;
                }
                version_json = await window.electronAPI.getCurseforgePage(project_id, count);
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
                ids: for (let i = 0; i < version_ids.length; i++) {
                    for (let j = 0; j < version_json.length; j++) {
                        if ((version_json[j].game_versions.includes(game_versions[i]) && (type != "mod" || version_json[j].loaders.includes(loaders[i])))) {
                            if (Number(version_json[j].id) == Number(version_ids[i])) {
                                if (results[i] == undefined) results[i] = false;
                                continue ids;
                            }
                            if (results[i] == undefined) results[i] = version_json[i].id;
                            continue ids;
                        }
                    }
                }
                not_found = results.length != version_ids.length || results.includes(undefined);
            }
        }
    }
    return results;
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
            let new_file_name = window.electronAPI.disableFile(instanceInfo.instance_id, content.type == "mod" ? "mods" : content.type == "resource_pack" ? "resourcepacks" : "shaderpacks", content.file_name);
            if (!new_file_name) {
                displayError(translate("app.error.failure_to_disable"));
                return false;
            }
            content.setDisabled(true);
            content.setFileName(new_file_name);
            displayError(translate("app.content.update.failed", "%c", content.name));
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
            let new_file_name = window.electronAPI.disableFile(instanceInfo.instance_id, content.type == "mod" ? "mods" : content.type == "resource_pack" ? "resourcepacks" : "shaderpacks", initialContent.file_name);
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
            let new_file_name = window.electronAPI.disableFile(instanceInfo.instance_id, content.type == "mod" ? "mods" : content.type == "resource_pack" ? "resourcepacks" : "shaderpacks", content.file_name);
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
            let new_file_name = window.electronAPI.disableFile(instanceInfo.instance_id, content.type == "mod" ? "mods" : content.type == "resource_pack" ? "resourcepacks" : "shaderpacks", initialContent.file_name);
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
        await window.electronAPI.downloadVanillaTweaksResourcePacks(JSON.parse(content.source_info), instanceInfo.vanilla_version, instanceInfo.instance_id, content.file_name);
    }
}

function fixPathForImage(path) {
    return path.replaceAll(" ", "%20").replaceAll("#", "%23");
}

async function repairInstance(instance, whatToRepair) {
    instance.setMcInstalled(false);
    instance.setFailed(false);
    let r = await window.electronAPI.repairMinecraft(instance.instance_id, instance.loader, instance.vanilla_version, instance.loader_version, whatToRepair);
    if (r.error) {
        instance.setFailed(true);
    } else {
        if (whatToRepair.includes("java")) {
            instance.setJavaPath(r.java_installation);
            instance.setJavaVersion(r.java_version);
        }
        instance.setMcInstalled(true);
    }
    instance.setProvidedJavaArgs(r.java_args);
    if (!instance.uses_custom_java_args) {
        instance.setJavaArgs(r.java_args);
    }
}

async function installButtonClick(project_type, source, content_loaders, icon, title, author, game_versions, project_id, instance_id, button, dialog_to_close, override_version, oncomplete = () => { }, states) {
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
        button.innerHTML = '<i class="fa-solid fa-xmark"></i>' + translate("app.discover.failed");
        return;
    }
    if (project_type == "datapack" || (content_loaders.length == 1 && content_loaders[0] == "datapack")) {
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
                "options": instance_id ? (await getInstanceWorlds(new Instance(instance_id))).map(e => ({ "name": e.name, "value": e.id })) : [],
                "input_source": instance_id ? null : "instance",
                "source": instance_id ? null : async (i) => {
                    return (await getInstanceWorlds(new Instance(i))).map(e => ({ "name": e.name, "value": e.id }));
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
            if (world == "loading" || world == "" || !world) {
                displayError(translate("app.discover.datapack.world", "%t", title));
                return;
            }
            let success;
            if (states) {
                states[project_id].state = "installing";
                states[project_id].buttons.forEach(e => {
                    e.innerHTML = '<i class="spinner"></i>' + translate("app.discover.installing");
                    e.classList.add("disabled");
                    e.onclick = () => { };
                });
            } else {
                button.innerHTML = '<i class="spinner"></i>' + translate("app.discover.installing");
                button.classList.add("disabled");
                button.onclick = () => { };
            }
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
                if (states) {
                    states[project_id].state = "installed";
                    states[project_id].buttons.forEach(e => {
                        e.innerHTML = '<i class="fa-solid fa-check"></i>' + translate("app.discover.installed");
                    });
                } else {
                    button.innerHTML = '<i class="fa-solid fa-check"></i>' + translate("app.discover.installed");
                }
                if (oncomplete) oncomplete();
            } else {
                if (states) {
                    states[project_id].state = "failed";
                    states[project_id].buttons.forEach(e => {
                        e.innerHTML = '<i class="fa-solid fa-xmark"></i>' + translate("app.discover.failed");
                    });
                } else {
                    button.innerHTML = '<i class="fa-solid fa-xmark"></i>' + translate("app.discover.failed");
                }
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
                mr_pack_info = await window.electronAPI.processMrPack(instance_id, "pack.mrpack", info.loader, title);
                let default_options = new DefaultOptions();
                let v = window.electronAPI.setOptionsTXT(instance.instance_id, default_options.getOptionsTXT(), false);
                instance.setAttemptedOptionsTxtVersion(v);
            } else if (source == "curseforge") {
                mr_pack_info = await window.electronAPI.processCfZip(instance_id, "pack.zip", project_id, title);
                if (mr_pack_info.error) {
                    instance.setFailed(true);
                    instance.setInstalling(false);
                    return;
                }
                instance.setLoader(mr_pack_info.loader);
                instance.setVanillaVersion(mr_pack_info.vanilla_version);
                if (mr_pack_info.allocated_ram) instance.setAllocatedRam(mr_pack_info.allocated_ram);
                info.loader = mr_pack_info.loader;
                info.game_version = mr_pack_info.vanilla_version;
            }
            if (mr_pack_info.error) {
                instance.setFailed(true);
                instance.setInstalling(false);
                return;
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
            if (r.error) {
                instance.setFailed(true);
            } else {
                instance.setJavaPath(r.java_installation);
                instance.setJavaVersion(r.java_version);
                instance.setJavaArgs(r.java_args);
                instance.setProvidedJavaArgs(r.java_args);
                instance.setMcInstalled(true);
            }
        })
    } else if (instance_id) {
        if (states) {
            states[project_id].state = "installing";
            states[project_id].buttons.forEach(e => {
                e.innerHTML = '<i class="spinner"></i>' + translate("app.discover.installing");
                e.classList.add("disabled");
                e.onclick = () => { };
            });
        } else {
            button.innerHTML = '<i class="spinner"></i>' + translate("app.discover.installing");
            button.classList.add("disabled");
            button.onclick = () => { };
        }
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
            success = await addContent(instance_id, project_type, project_id, title, icon, project_id);
        } else {
            success = await installContent(source, project_id, instance_id, project_type, title, author, icon);
        }
        if (success) {
            if (states) {
                states[project_id].state = "installed";
                states[project_id].buttons.forEach(e => {
                    e.innerHTML = '<i class="fa-solid fa-check"></i>' + translate("app.discover.installed");
                });
            } else {
                button.innerHTML = '<i class="fa-solid fa-check"></i>' + translate("app.discover.installed");
            }
            if (oncomplete) oncomplete(override_version ? override_version.id : (success.id ? success.id : ""));
        } else {
            if (states) {
                states[project_id].state = "failed";
                states[project_id].buttons.forEach(e => {
                    e.innerHTML = '<i class="fa-solid fa-xmark"></i>' + translate("app.discover.failed");
                });
            } else {
                button.innerHTML = '<i class="fa-solid fa-xmark"></i>' + translate("app.discover.failed");
            }
        }
    } else {
        button.innerHTML = '<i class="spinner"></i>' + translate("app.discover.loading");
        button.classList.add("disabled");
        let dialog = new Dialog();
        let instances = data.getInstances();
        if (source == "modrinth") {
            if (project_type == "mod") {
                instances = instances.filter(e => content_loaders.includes(e.loader)).filter(e => game_versions.includes(e.vanilla_version));
            } else if (project_type == "shader") {
                instances = instances.filter(e => e.loader != "vanilla").filter(e => game_versions.includes(e.vanilla_version));
            } else {
                instances = instances.filter(e => game_versions.includes(e.vanilla_version));
            }
        }
        let installGrid = document.createElement("div");
        installGrid.className = "install-grid";
        let content = db.prepare("SELECT * FROM content WHERE source_info = ?").all(source == "curseforge" ? project_id.toString() + ".0" : project_id);
        let instanceIdsWithContent = content.map(e => e.instance);
        let instancesWithContent = instanceIdsWithContent.map(e => new Instance(e));
        let updates = [];
        if (content.length > 0) {
            try {
                updates = await checkForContentUpdates(source, project_id, content.map(e => e.version_id), instancesWithContent.map(e => e.loader), instancesWithContent.map(e => e.vanilla_version), project_type);
            } catch (e) { }
        }

        let installGridEntry = document.createElement("div");
        installGridEntry.className = "install-grid-entry";

        let createNewButton = document.createElement("button");
        createNewButton.className = "install-grid-create";
        createNewButton.innerHTML = '<i class="fa-solid fa-plus"></i>' + translate("app.discover.select_instance.create");
        createNewButton.onclick = () => {
            let dialog2 = new Dialog();
            dialog2.showDialog(translate("app.button.instances.create"), "form", [
                {
                    "type": "image-upload",
                    "id": "icon",
                    "name": translate("app.instances.icon")
                },
                {
                    "type": "text",
                    "name": translate("app.instances.name"),
                    "id": "name",
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
                    "id": "loader"
                },
                {
                    "type": "dropdown",
                    "name": translate("app.instances.game_version"),
                    "options": [],
                    "id": "game_version",
                    "input_source": "loader",
                    "source": VersionList.getVersions,
                    "default": VersionList.getLatestRelease()
                }
            ], [
                { "content": translate("app.instances.cancel"), "type": "cancel" },
                { "content": translate("app.instances.submit"), "type": "confirm" }
            ], [], async (e) => {
                dialog.closeDialog();
                contentInfo.close();
                let info = {};
                e.forEach(e => { info[e.id] = e.value });
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
                try {
                    if (info.loader == "fabric") {
                        loader_version = (await window.electronAPI.getFabricVersion(info.game_version))
                    } else if (info.loader == "forge") {
                        loader_version = (await window.electronAPI.getForgeVersion(info.game_version))
                    } else if (info.loader == "neoforge") {
                        loader_version = (await window.electronAPI.getNeoForgeVersion(info.game_version))
                    } else if (info.loader == "quilt") {
                        loader_version = (await window.electronAPI.getQuiltVersion(info.game_version))
                    }
                } catch (e) {
                    displayError(translate("app.instances.failed_to_create"));
                    return;
                }
                let instance = data.addInstance(info.name, new Date(), new Date(), "", info.loader, info.game_version, loader_version, false, false, "", info.icon, instance_id, 0, "custom", "", false, false);
                instance.setInstalling(true);
                showSpecificInstanceContent(instance);
                if (override_version) {
                    if (source == "modrinth") {
                        success = await installSpecificVersion(override_version, source, instance, project_type, title, author, icon, project_id);
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
                        }, "curseforge", instance, project_type, title, author, icon, project_id)
                    }
                } else if (project_type == "server") {
                    success = await addContent(instance_id, project_type, project_id, title, icon, project_id);
                } else {
                    success = await installContent(source, project_id, instance_id, project_type, title, author, icon);
                }
                instance.setInstalling(false);
                let r = await window.electronAPI.downloadMinecraft(instance_id, info.loader, info.game_version, loader_version);
                if (r.error) {
                    instance.setFailed(true);
                } else {
                    instance.setJavaPath(r.java_installation);
                    instance.setJavaVersion(r.java_version);
                    instance.setJavaArgs(r.java_args);
                    instance.setProvidedJavaArgs(r.java_args);
                    instance.setMcInstalled(true);
                }
            });
        }

        installGridEntry.appendChild(createNewButton);
        installGrid.appendChild(installGridEntry);
        for (let i = 0; i < instances.length; i++) {
            if (instances[i].locked) continue;
            let contentForThisInstance = content.filter(e => e.instance == instances[i].instance_id);

            let updatesIndex = instanceIdsWithContent.indexOf(instances[i].instance_id);

            let installGridEntry = document.createElement("div");
            installGridEntry.className = "install-grid-entry";

            let installGridInstance = document.createElement("div");
            installGridInstance.className = "install-grid-instance";

            let image = document.createElement("img");
            image.src = instances[i].image ? instances[i].image : getDefaultImage(instances[i].instance_id);
            image.className = "instance-image";

            let info = document.createElement("div");
            info.className = "instance-info";

            let name = document.createElement("div");
            name.className = "instance-name";
            name.innerText = instances[i].name;

            let desc = document.createElement("div");
            desc.className = "instance-desc";
            desc.innerText = loaders[instances[i].loader] + " " + instances[i].vanilla_version;

            info.appendChild(name);
            info.appendChild(desc);

            installGridInstance.appendChild(image);
            installGridInstance.appendChild(info);

            let installButton = document.createElement("button");
            installButton.className = "install-grid-install";
            installButton.innerHTML = '<i class="fa-solid fa-download"></i>' + translate("app.discover.install");
            installButton.onclick = async () => {
                if (global_discover_content_states[project_id]) {
                    global_discover_content_states[project_id].push(installButton);
                } else {
                    global_discover_content_states[project_id] = [installButton];
                }
                let success;
                installButton.innerHTML = '<i class="spinner"></i>' + translate("app.discover.installing");
                installButton.classList.add("disabled");
                installButton.onclick = () => { };
                if (override_version) {
                    if (source == "modrinth") {
                        success = await installSpecificVersion(override_version, source, instances[i], project_type, title, author, icon, project_id);
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
                        }, "curseforge", instances[i], project_type, title, author, icon, project_id)
                    }
                } else if (project_type == "server") {
                    success = await addContent(instances[i].instance_id, project_type, project_id, title, icon, project_id);
                } else {
                    success = await installContent(source, project_id, instances[i].instance_id, project_type, title, author, icon);
                }
                if (success) {
                    installButton.innerHTML = '<i class="fa-solid fa-check"></i>' + translate("app.discover.installed");
                } else {
                    installButton.innerHTML = '<i class="fa-solid fa-xmark"></i>' + translate("app.discover.failed");
                }
                global_discover_content_states[project_id] = global_discover_content_states[project_id].filter(e => e != installButton);
            }

            let updateToSpecificVersion = async (version_id) => {
                if (global_discover_content_states[project_id]) {
                    global_discover_content_states[project_id].push(installButton);
                } else {
                    global_discover_content_states[project_id] = [installButton];
                }
                let instanceInfo = instances[i];
                let contentList = instanceInfo.getContent();
                installButton.innerHTML = '<i class="spinner"></i>' + translate("app.instances.installing");
                installButton.classList.add("disabled");
                installButton.onclick = () => { };
                let theContent = null;
                for (let i = 0; i < contentList.length; i++) {
                    if (contentList[i].source_info == project_id || (source == "curseforge" && Number(contentList[i].source_info) == Number(project_id))) {
                        theContent = contentList[i];
                    }
                }
                if (!theContent) return;
                await updateContent(instanceInfo, theContent, version_id);
                installButton.innerHTML = '<i class="fa-solid fa-check"></i>' + translate("app.discover.installed");
                global_discover_content_states[project_id] = global_discover_content_states[project_id].filter(e => e != installButton);
            }

            if (!override_version && updatesIndex != -1 && updates[updatesIndex]) {
                installButton.innerHTML = '<i class="fa-solid fa-download"></i>' + translate("app.discover.update");
                installButton.onclick = () => {
                    console.log(updates[updatesIndex]);
                    updateToSpecificVersion(updates[updatesIndex]);
                }
            } else if (override_version && contentForThisInstance[0] && (source == "curseforge" ? Number(contentForThisInstance[0].version_id) != Number(override_version.id) : contentForThisInstance[0].version_id != override_version.id)) {
                installButton.innerHTML = '<i class="fa-solid fa-download"></i>' + translate("app.discover.update");
                installButton.onclick = () => {
                    updateToSpecificVersion(override_version.id);
                }
            } else if (contentForThisInstance[0]) {
                installButton.innerHTML = '<i class="fa-solid fa-check"></i>' + translate("app.discover.installed");
                installButton.classList.add("disabled");
                installButton.onclick = () => { };
            }

            installGridEntry.appendChild(installGridInstance);
            installGridEntry.appendChild(installButton);

            installGrid.appendChild(installGridEntry);
        }
        dialog.showDialog(translate("app.discover.select_instance.title", "%t", title), "notice", installGrid, [
            { "content": translate("app.discover.select_instance.confirm"), "type": "confirm" }
        ], null, () => { });
        button.innerHTML = '<i class="fa-solid fa-download"></i>' + translate("app.discover.install");
        button.classList.remove("disabled");
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
        mr_pack_info = await window.electronAPI.processMrPack(instanceInfo.instance_id, "pack.mrpack", instanceInfo.loader, instanceInfo.name);
        if (mr_pack_info.error) {
            instanceInfo.setFailed(true);
            instanceInfo.setInstalling(false);
            return;
        }
    } else if (source == "curseforge") {
        mr_pack_info = await window.electronAPI.processCfZip(instanceInfo.instance_id, "pack.zip", instanceInfo.install_id, instanceInfo.name);
        if (mr_pack_info.error) {
            instanceInfo.setFailed(true);
            instanceInfo.setInstalling(false);
            return;
        }

        instanceInfo.setLoader(mr_pack_info.loader);
        instanceInfo.setVanillaVersion(mr_pack_info.vanilla_version, true);
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
    if (r.error) {
        instanceInfo.setFailed(true);
    } else {
        instanceInfo.setJavaPath(r.java_installation);
        instanceInfo.setJavaVersion(r.java_version);
        instanceInfo.setJavaArgs(r.java_args);
        instanceInfo.setProvidedJavaArgs(r.java_args);
        instanceInfo.setMcInstalled(true);
    }
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
    fetchUpdatedMCVersions();
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

async function checkForUpdates(isManual) {
    try {
        let result = await window.electronAPI.checkForUpdates();
        if (!result.update) {
            if (isManual) displaySuccess(translate("app.settings.updates.none_found"));
        } else {
            let dialog = new Dialog;
            dialog.showDialog(translate("app.settings.updates.found.title"), "notice", translate("app.settings.updates.found.description." + result.os, "%v", result.new_version, "%s", result.file_size), [
                {
                    "type": "cancel",
                    "content": translate("app.settings.updates.found.cancel")
                },
                {
                    "type": "confirm",
                    "content": translate("app.settings.updates.found.confirm")
                }
            ], [], async () => {
                if (result.os == "unix") {
                    window.electronAPI.openInBrowser(result.browser_url);
                    return;
                }
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

async function createElPack(instance, content_list, overrides, pack_version) {
    instance = instance.refresh();
    let manifest = {
        "name": instance.name,
        "icon": instance.image,
        "loader": instance.loader,
        "loader_version": instance.loader_version,
        "game_version": instance.vanilla_version,
        "pack_version": pack_version,
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
    window.electronAPI.createElPack(instance.instance_id, instance.name, manifest, overrides);
}
async function createMrPack(instance, content_list, overrides, pack_version) {
    instance = instance.refresh();
    let url = `https://api.modrinth.com/v2/versions?ids=["${content_list.map(e => e.version_id).join('","')}"]`;
    let info = [];
    try {
        const response = await fetch(url);
        info = await (response.json());
    } catch (e) {
        displayError(translate("app.mrpack.error"));
        return;
    }
    let files_list = content_list.map(e => {
        let content_folder = e.type == "mod" ? "mods" : e.type == "resource_pack" ? "resourcepacks" : "shaderpacks";
        let content_file = content_folder + "/" + e.file_name;
        return {
            "path": content_file,
            "hashes": {
                "sha1": "",
                "sha512": ""
            },
            "downloads": [],
            "fileSize": 0,
            "version_id": e.version_id
        }
    });
    info: for (let i = 0; i < info.length; i++) {
        for (let j = 0; j < files_list.length; j++) {
            if (files_list[j].version_id == info[i].id) {
                files_list[j].hashes.sha1 = info[i].files[0].hashes.sha1;
                files_list[j].hashes.sha512 = info[i].files[0].hashes.sha512;
                files_list[j].fileSize = info[i].files[0].size;
                files_list[j].downloads = [info[i].files[0].url];
                continue info;
            }
        }
    }
    files_list = files_list.map(({ version_id, ...rest }) => rest);
    let manifest = {
        "formatVersion": 1,
        "game": "minecraft",
        "versionId": pack_version,
        "name": instance.name,
        "files": files_list,
        "dependencies": {
            "minecraft": instance.vanilla_version
        }
    }
    let convert = {
        "forge": "forge",
        "neoforge": "neoforge",
        "fabric": "fabric-loader",
        "quilt": "quilt-loader"
    }
    if (convert[instance.loader]) manifest.dependencies[convert[instance.loader]] = instance.loader_version;
    window.electronAPI.createMrPack(instance.instance_id, instance.name, manifest, overrides);
}
async function createCfZip(instance, content_list, overrides, pack_version) {
    instance = instance.refresh();
    let manifest = {
        "minecraft": {
            "version": instance.vanilla_version,
            "modLoaders": [
                {
                    "id": instance.loader + "-" + instance.loader_version,
                    "primary": true
                }
            ],
            "recommendedRam": instance.allocated_ram
        },
        "manifestType": "minecraftModpack",
        "manifestVersion": 1,
        "name": instance.name,
        "version": pack_version,
        "author": "",
        "files": content_list.map(e => ({
            "projectID": Number(e.source_info),
            "fileID": Number(e.version_id),
            "required": true
        })),
        "overrides": "overrides"
    }
    window.electronAPI.createCfZip(instance.instance_id, instance.name, manifest, overrides);
}

let importInstance = (info, file_path) => {
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
        if (packInfo.error) {
            instance.setFailed(true);
            instance.setInstalling(false);
            return;
        }
        if (!("loader_version" in packInfo)) {
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
        if (r.error) {
            instance.setFailed(true);
        } else {
            instance.setJavaPath(r.java_installation);
            instance.setJavaVersion(r.java_version);
            instance.setJavaArgs(r.java_args);
            instance.setProvidedJavaArgs(r.java_args);
            instance.setMcInstalled(true);
        }
    });
}

let importInstanceFromContentProvider = (info) => {
    installButtonClick(info.project_type, info.source, info.loaders, info.icon, info.name, info.author, info.game_versions, info.project_id, undefined, document.createElement("button"), undefined, undefined, () => { }, undefined);
}

window.electronAPI.onOpenFile(importInstance);

function openInstanceShareDialog(instanceInfo) {
    let options = window.electronAPI.getInstanceFiles(instanceInfo.instance_id);
    let content = instanceInfo.getContent();
    let contentSpecific = [];
    let contentMap = {};
    content.forEach(e => {
        let content_folder = e.type == "mod" ? "mods" : e.type == "resource_pack" ? "resourcepacks" : "shaderpacks";
        let content_file = content_folder + "/" + e.file_name;
        let replace = content_folder + "/" + parseMinecraftFormatting(e.name);
        contentSpecific.push(replace);
        contentMap[replace] = e;
        let index = options.indexOf(content_file);
        if (index < 0) return;
        options[index] = replace;
    });

    let distributionToggleWrapper = document.createElement("div");
    let labelWrapper = document.createElement("div");
    labelWrapper.className = "label-wrapper";
    let label = document.createElement("label");
    label.className = "dialog-label";
    let labelDesc = document.createElement("label");
    labelDesc.className = "dialog-label-desc";
    let toggleEle = document.createElement("button");
    let distributionToggle = new Toggle(toggleEle, () => {
        updateDistributionInfo(out, overrides, packVersion, name);
    }, false);
    distributionToggleWrapper.className = "dialog-text-label-wrapper-horizontal";
    distributionToggleWrapper.classList.add("dialog-wrapper-hidden");
    distributionToggleWrapper.appendChild(toggleEle);
    distributionToggleWrapper.appendChild(labelWrapper);
    labelWrapper.appendChild(label);
    labelWrapper.appendChild(labelDesc);

    let distributionInfo = document.createElement("div");
    distributionInfo.className = "info";
    distributionInfo.classList.add("dialog-wrapper-hidden");

    let overrides = [];
    let out = "elpack";
    let packVersion = "";
    let name = instanceInfo.name;

    let updateDistributionInfo = (out, overrides, packVersion, name) => {
        let distributionWarnings = [];
        if (out == "mrpack") {
            let content_specific = overrides.filter(e => contentSpecific.includes(e)).map(e => contentMap[e]).filter(e => e.source != "modrinth");
            if (content_specific.length > 0) distributionWarnings.push(translate("app.distribution.modrinth.eco", "%l", content_specific.map(e => e.name).join(", ")));
            if (!packVersion) distributionWarnings.push(translate("app.distribution.modrinth.version"));
        } else if (out == "cf_zip") {
            let content_specific = overrides.filter(e => contentSpecific.includes(e)).map(e => contentMap[e]).filter(e => e.source != "curseforge");
            if (content_specific.length > 0) distributionWarnings.push(translate("app.distribution.curseforge.eco", "%l", content_specific.map(e => e.name).join(", ")));
        }
        if (out != "elpack") {
            if (!name) distributionWarnings.push(translate("app.distribution.name"));
        }
        if (!distributionToggle.toggled) distributionWarnings = [];
        if (distributionWarnings.length) {
            distributionInfo.classList.add("shown");
            distributionInfo.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i><span style="display: flex;flex-direction: column;gap: 4px;"><b>' + translate("app.distribution.warnings") + "</b>" + distributionWarnings.map(e => `<span>${e}</span>`).join("") + "</span>";
        } else {
            distributionInfo.classList.remove("shown");
        }
    }

    let updateToggle = (v) => {
        if (v == "elpack") distributionToggleWrapper.classList.remove("shown");
        if (v == "mrpack") {
            distributionToggleWrapper.classList.add("shown");
            label.innerHTML = translate("app.instances.share.distribution", "%p", "Modrinth");
            labelDesc.innerHTML = translate("app.instances.share.distribution.description", "%p", "Modrinth");
        }
        if (v == "cf_zip") {
            distributionToggleWrapper.classList.add("shown");
            label.innerHTML = translate("app.instances.share.distribution", "%p", "CurseForge");
            labelDesc.innerHTML = translate("app.instances.share.distribution.description", "%p", "CurseForge");
        }
        updateDistributionInfo(v, overrides, packVersion, name);
    }

    let dialog = new Dialog();
    dialog.showDialog(translate("app.instances.share.title"), "form", [
        {
            "type": "notice",
            "content": distributionInfo
        },
        {
            "type": "text",
            "name": translate("app.instances.share.name"),
            "id": "name",
            "default": instanceInfo.name,
            "oninput": (v) => {
                name = v;
                updateDistributionInfo(out, overrides, packVersion, v);
            }
        },
        {
            "type": "text",
            "name": translate("app.instances.share.version"),
            "id": "version",
            "default": "",
            "oninput": (v) => {
                packVersion = v;
                updateDistributionInfo(out, overrides, v, name);
            }
        },
        {
            "type": "multi-select",
            "name": translate("app.instances.share.out"),
            "id": "out",
            "default": "elpack",
            "options": [
                {
                    "name": translate("app.instances.share.elpack"),
                    "value": "elpack"
                },
                {
                    "name": translate("app.instances.share.mrpack"),
                    "value": "mrpack"
                },
                {
                    "name": translate("app.instances.share.cf_zip"),
                    "value": "cf_zip"
                }
            ],
            "onchange": (v) => {
                out = v;
                updateToggle(v);
            }
        },
        {
            "type": "notice",
            "content": distributionToggleWrapper
        },
        {
            "type": "files",
            "name": translate("app.instances.share.files"),
            "id": "files",
            "options": options,
            "default": ["mods", "resourcepacks", "shaderpacks", "config", "defaultconfig", "defaultconfigs", "kubejs", "scripts"],
            "onchange": (v) => {
                overrides = v;
                updateDistributionInfo(out, v, packVersion, name);
            }
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
            let content_file = content_folder + "/" + e.file_name;
            nonContentSpecific.push(content_file);
            return false;
        });
        if (info.out == "elpack") {
            createElPack(instanceInfo, yesContentSpecific, nonContentSpecific, info.version);
        } else if (info.out == "mrpack") {
            yesContentSpecific = yesContentSpecific.filter(e => {
                if (e.source == "modrinth") return true;
                let content_folder = e.type == "mod" ? "mods" : e.type == "resource_pack" ? "resourcepacks" : "shaderpacks";
                let content_file = content_folder + "/" + e.file_name;
                nonContentSpecific.push(content_file);
                return false;
            });
            createMrPack(instanceInfo, yesContentSpecific, nonContentSpecific, info.version);
        } else if (info.out == "cf_zip") {
            yesContentSpecific = yesContentSpecific.filter(e => {
                if (e.source == "curseforge") return true;
                let content_folder = e.type == "mod" ? "mods" : e.type == "resource_pack" ? "resourcepacks" : "shaderpacks";
                let content_file = content_folder + "/" + e.file_name;
                nonContentSpecific.push(content_file);
                return false;
            });
            createCfZip(instanceInfo, yesContentSpecific, nonContentSpecific, info.version);
        }
    });
}

const overlay = document.getElementById('drop-overlay');
document.getElementById('drop-overlay-inner').innerHTML = translate("app.import.drop");

function isFileDrag(event) {
    return Array.from(event.dataTransfer?.types || []).includes('Files');
}

let activeOverlay = null;

function findClosestDropOverlay(el) {
    let current = el;
    while (current && current !== document) {
        const overlay = current.querySelector(':scope > .drop-overlay');
        if (overlay) return overlay;
        current = current.parentElement;
    }
    return null;
}

function showOverlay(overlay) {
    if (activeOverlay === overlay) return;
    if (activeOverlay) activeOverlay.classList.remove('shown');
    activeOverlay = overlay;
    if (overlay) overlay.classList.add('shown');
}

document.body.ondragenter = (e) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    let overlay = findClosestDropOverlay(e.target);
    showOverlay(overlay);
};

document.body.ondragleave = (e) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    const under = document.elementFromPoint(e.clientX, e.clientY);
    if (!under || e.clientX == 0 || e.clientY == 0) {
        showOverlay(null);
        return;
    }
    const overlay = findClosestDropOverlay(under);
    showOverlay(overlay);
    if (!overlay && under === document.body) {
        showOverlay(null);
    }
};

document.body.ondragover = (e) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    const under = document.elementFromPoint(e.clientX, e.clientY);
    if (e.clientX == 0 || e.clientY == 0 || !under) {
        showOverlay(null);
        return;
    }
    const overlay = findClosestDropOverlay(under);
    showOverlay(overlay);
};

document.body.ondrop = (e) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    [...document.getElementsByClassName("drop-overlay")].forEach(e => e.classList.remove("shown"));
    let overlay = activeOverlay;
    const files = window.electronAPI.readPathsFromDrop(Object.entries(e.dataTransfer.files).map(e => e[1]));
    if (overlay.dataset.action == "instance-import") {
        files.forEach(file => {
            let info = window.electronAPI.readPackFile(file.path);
            if (!info) {
                displayError(translate("app.import.instance.fail", "%f", file.name));
                return;
            }
            importInstance(info, file.path);
        });
    } else if (overlay.dataset.action == "content-import") {
        new Promise(async (resolve) => {
            document.body.style.cursor = "progress";
            let instance = new Instance(overlay.dataset.instanceId);
            for (let i = 0; i < files.length; i++) {
                let file = files[i];
                if (window.electronAPI.isInstanceFile(file.path)) {
                    let info = window.electronAPI.readPackFile(file.path);
                    if (!info) {
                        displayError(translate("app.import.instance.fail", "%f", file.name));
                        return;
                    }
                    importInstance(info, file.path);
                }
                if (instance.locked) {
                    displayError(translate("app.import.content.locked"));
                    document.body.style.cursor = "";
                    return;
                }
                let success = await window.electronAPI.importContent(file.path, "auto", overlay.dataset.instanceId);
                if (!success) {
                    displayError(translate("app.import.content.fail", "%f", file.name));
                    document.body.style.cursor = "";
                    return;
                }
            }
            if (document.body.contains(overlay)) setInstanceTabContentContent(instance, overlay.parentElement);
            document.body.style.cursor = "";
        });
    } else if (overlay.dataset.action == "world-import") {
        new Promise(async (resolve) => {
            let instance = new Instance(overlay.dataset.instanceId);
            for (let i = 0; i < files.length; i++) {
                let file = files[i];
                if (window.electronAPI.isInstanceFile(file.path)) {
                    let info = window.electronAPI.readPackFile(file.path);
                    if (!info) return;
                    importInstance(info, file.path);
                }
                let success = await window.electronAPI.importWorld(file.path, overlay.dataset.instanceId, file.name);
                if (!success) {
                    displayError(translate("app.import.worlds.fail", "%f", file.name));
                    return;
                }
            }
            if (document.body.contains(overlay)) setInstanceTabContentWorlds(instance, overlay.parentElement);
        });
    } else if (overlay.dataset.action == "skin-import") {
        new Promise(async (resolve) => {
            for (let i = 0; i < files.length; i++) {
                let file = files[i];
                if (window.electronAPI.isInstanceFile(file.path)) {
                    let info = window.electronAPI.readPackFile(file.path);
                    if (!info) return;
                    importInstance(info, file.path);
                }
                console.log(file.path);
                let dataUrl = await window.electronAPI.pathToDataUrl(file.path);
                console.log(dataUrl);
                importSkin({
                    "skin": dataUrl,
                    "name": translate("app.wardrobe.unnamed"),
                    "model": "auto"
                }, () => {
                    if (document.body.contains(overlay) && refreshWardrobe) refreshWardrobe();
                })
            }
        });
    }
};

function getDefaultImage(code) {
    let data = window.electronAPI.getDefaultImage(code);
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(data)}`;
}

try {
    switch (data.getDefault("saved_version")) {
        case "0.0.1":
        case "0.0.2":
        case "0.0.3":
        case "0.0.4":
        case "0.0.5":
        case "0.0.6":
        case "0.0.7":
            if (data.getDefault("default_page") == "my_account") data.setDefault("default_page", "wardrobe");
            db.prepare("ALTER TABLE skins DROP COLUMN file_name;").run();
            db.prepare("ALTER TABLE skins DROP COLUMN last_used;").run();
            db.prepare("ALTER TABLE capes DROP COLUMN last_used;").run();
        case "0.0.8":
        case "0.0.9":
        case "0.1.0":
        case "0.1.1":
            db.prepare("ALTER TABLE instances ADD failed INTEGER").run();
        case "0.2.0":
        case "0.3.0":
        case "0.4.0":
        case "0.4.1":
        case "0.4.2":
        case "0.4.3":
        case "0.4.4":
        case "0.5.0":
            db.prepare("ALTER TABLE skins ADD favorited INTEGER").run();
            db.prepare("ALTER TABLE skins ADD last_used TEXT").run();
            db.prepare("ALTER TABLE skins ADD preview TEXT").run();
            db.prepare("ALTER TABLE skins ADD preview_model TEXT").run();
            db.prepare("ALTER TABLE skins ADD head TEXT").run();
        case "0.6.0":
        case "0.6.1":
        case "0.6.2":
        case "0.6.3":
        case "0.6.4":
        case "0.6.5":
            db.prepare("ALTER TABLE instances ADD post_launch_hook TEXT").run();
            db.prepare("ALTER TABLE instances ADD uses_custom_java_args INTEGER").run();
            db.prepare("ALTER TABLE instances ADD provided_java_args TEXT").run();
            let instances = data.getInstances();
            instances.forEach(e => e.setProvidedJavaArgs(e.java_args));
    }
} catch (e) { }

data.setDefault("saved_version", window.electronAPI.version.replace("-dev", ""));