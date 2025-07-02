let lang = null;
document.getElementsByTagName("title")[0].innerHTML = sanitize(translate("app.name"));
let minecraftVersions = []
let getMCVersions = async () => {
    try {
        minecraftVersions = (await window.electronAPI.getVanillaVersions()).reverse();
    } catch (e) { }
}
getMCVersions();

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
            console.log("Using option version " + version_to_use);
            v = db.prepare("SELECT * FROM options_defaults WHERE key = ? AND version = ?").get("version", version_to_use);
        }
        let r = db.prepare("SELECT * FROM options_defaults WHERE NOT key = ?").all("version");
        let content = "";
        content = "version:" + (dataVersion ? dataVersion : (v?.value ? v?.value : "100")) + "\n";
        r.forEach(e => {
            content += e.key + ":" + e.value + "\n"
        });
        return { "content": content, "version": Number((dataVersion ? dataVersion : (v?.value ? v?.value : "100"))) };
    }
}

class Skin {
    constructor(id) {
        let skin = db.prepare("SELECT * FROM skins WHERE id = ? LIMIT 1").get(id);
        if (!skin) throw new Error("Skin not found");
        this.id = skin.id;
        this.file_name = skin.file_name;
        this.name = skin.name;
        this.model = skin.model;
        this.last_used = new Date(skin.last_used);
        this.skin_id = skin.skin_id;
        this.active_uuid = skin.active_uuid;
    }

    setModel(model) {
        db.prepare("UPDATE skins SET model = ? WHERE id = ?").run(model, this.id);
        this.model = model;
    }
    setLastUsed(last_used) {
        db.prepare("UPDATE skins SET last_used = ? WHERE id = ?").run(last_used.toISOString(), this.id);
        this.last_used = last_used;
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
        this.last_used = new Date(cape.last_used);
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
        if (!instance_watches[this.instance_id]) instance_watches[this.instance_id] = {};
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
    setVanillaVersion(vanilla_version) {
        db.prepare("UPDATE instances SET vanilla_version = ? WHERE id = ?").run(vanilla_version, this.id);
        this.vanilla_version = vanilla_version;
        if (instance_watches[this.instance_id].onchangevanilla_version) instance_watches[this.instance_id].onchangevanilla_version(vanilla_version);
        let default_options = new DefaultOptions(vanilla_version);
        let v = window.electronAPI.setOptionsTXT(this.instance_id, default_options.getOptionsTXT());
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

    addContent(name, author, image, file_name, source, type, version, source_info, disabled) {
        db.prepare('INSERT into content (name,author,image,file_name,source,type,version,instance,source_info,disabled) VALUES (?,?,?,?,?,?,?,?,?,?)').run(name, author, image, file_name, source, type, version, this.instance_id, source_info, Number(disabled));
        return new Content(this.instance_id, file_name);
    }

    getContent() {
        let content = db.prepare("SELECT * FROM content WHERE instance = ?").all(this.instance_id);
        return content.map(e => new Content(e.id));
    }

    delete() {
        db.prepare("DELETE FROM instances WHERE id = ?").run(this.id);
        db.prepare("DELETE FROM content WHERE instance = ?").run(this.instance_id);
    }

    refresh() {
        return new Instance(this.instance_id);
    }
}

class Data {
    getInstances() {
        let instances = db.prepare("SELECT * FROM instances").all();
        return instances.map(e => new Instance(e.instance_id));
    }

    addInstance(name, date_created, date_modified, last_played, loader, vanilla_version, loader_version, locked, downloaded, group, image, instance_id, playtime, install_source, install_id, installing, mc_installed) {
        db.prepare(`INSERT INTO instances (name, date_created, date_modified, last_played, loader, vanilla_version, loader_version, locked, downloaded, group_id, image, instance_id, playtime, install_source, install_id, installing, mc_installed, window_width, window_height, allocated_ram) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(name, date_created.toISOString(), date_modified.toISOString(), last_played ? last_played.toISOString() : null, loader, vanilla_version, loader_version, Number(locked), Number(downloaded), group, image, instance_id, playtime, install_source, install_id, Number(installing), Number(mc_installed), Number(data.getDefault("default_width")), Number(data.getDefault("default_height")), Number(data.getDefault("default_ram")));
        let default_options = new DefaultOptions(vanilla_version);
        let v = window.electronAPI.setOptionsTXT(instance_id, default_options.getOptionsTXT());
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
            let defaults = { "default_sort": "name", "default_group": "none", "default_page": "home", "default_width": 854, "default_height": 480, "default_ram": 4096, "default_mode": "dark" };
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

    addSkin(file_name, name, model, active_uuid, skin_id) {
        let skins = this.getSkins();
        let previousSkinIds = skins.map(e => e.skin_id);
        if (previousSkinIds.includes(skin_id)) {
            return new Skin(skins[previousSkinIds.indexOf(skin_id)].id);
        }
        let result = db.prepare("INSERT INTO skins (file_name, name, model, active_uuid, skin_id) VALUES (?,?,?,?,?)").run(file_name, name, model, `;${active_uuid};`, skin_id);
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
        if (currentTab == "my_account") {
            myAccountContent.displayContent();
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
        if (currentTab == "my_account") {
            myAccountContent.displayContent();
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
    skinToHead(`./minecraft/skins/${skin.skin_id}.png`, callback);
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

class PageContent {
    constructor(func, title) {
        this.func = func;
        this.title = title;
    }
    displayContent() {
        if (this.title == "discover") {
            showAddContent();
            return;
        }
        content.innerHTML = "";
        content.appendChild(this.func());
        if (this.title == "instances") {
            groupInstances(data.getDefault("default_group"));
        }
        currentTab = this.title;
    }
}

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
        stopButton.innerHTML = '<i class="fa-regular fa-circle-stop"></i>';
        let logButton = document.createElement("div");
        logButton.className = "live-log";
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
                "title": "View Instance",
                "icon": '<i class="fa-solid fa-eye"></i>',
                "func": () => {
                    showSpecificInstanceContent(instanceInfo.refresh());
                }
            },
            {
                "title": "View Logs",
                "icon": '<i class="fa-solid fa-terminal"></i>',
                "func": () => {
                    showSpecificInstanceContent(instanceInfo.refresh(), 'logs');
                }
            },
            {
                "title": "Stop Instance",
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
    }
    removeLive() {
        this.nameElement.innerHTML = sanitize(translate("app.instances.no_running"));
        this.element.classList.remove("minecraft-live");
        this.element.oncontextmenu = () => { };
        this.stopButton.onclick = () => { };
        this.logButton.onclick = () => { };
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
            buttonElement.innerHTML = buttons.buttons[i].icon + sanitize(buttons.buttons[i].title);
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
        if (window.innerWidth - x < 200) {
            xTranslate = "-100%";
        }
        if (window.innerHeight - y < 300) {
            yTranslate = "-100%";
        }
        this.element.style.translate = xTranslate + " " + yTranslate;
        this.element.style.top = y + "px";
        this.element.innerHTML = "";
        this.element.hidePopover();
        for (let i = 0; i < buttons.buttons.length; i++) {
            let buttonElement = document.createElement("button");
            buttonElement.classList.add("context-menu-button");
            buttonElement.innerHTML = buttons.buttons[i].icon + sanitize(buttons.buttons[i].title);
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
        let searchIcon = document.createElement("div");
        searchIcon.classList.add("search-icon");
        searchIcon.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i>';
        let searchInput = document.createElement("input");
        searchInput.classList.add("search-input");
        searchInput.setAttribute("placeholder", translate("app.hint.search"));
        let searchClear = document.createElement("button");
        searchClear.classList.add("search-clear");
        searchClear.innerHTML = '<i class="fa-solid fa-xmark"></i>';
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
            if (this.optEles[i].innerHTML == sanitize(name)) {
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
    constructor(title, options, element, initial,) {
        this.title = title;
        this.element = element;
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
        dropdownList.classList.add("dropdown-list-dialog");
        dropdownList.setAttribute("popover", "");
        dropdownList.style.positionAnchor = "--" + this.id;
        this.popover = dropdownList;
        this.setOptions(options, initial);
        element.appendChild(dropdownList);
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
            if (this.optEles[i].innerHTML == sanitize(name)) {
                this.optEles[i].classList.add("selected");
            } else {
                this.optEles[i].classList.remove("selected");
            }
        }
        this.selected = option;
        this.value = option;
        this.popover.hidePopover();
        if (this.onchange) this.onchange();
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
    constructor(element, content, searchBar, features, filter) {
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
            updateAllButton.onclick = features.update_all.func;
            contentListTop.appendChild(updateAllButton);
        }

        let applyFilters = (search, dropdown) => {
            for (let i = 0; i < this.items.length; i++) {
                if (this.items[i].name.toLowerCase().includes(search.toLowerCase().trim()) && (this.items[i].type == dropdown || dropdown == "all")) {
                    this.items[i].element.style.display = "flex";
                    this.items[i].element.classList.remove("hidden");
                } else {
                    this.items[i].element.style.display = "none";
                    this.items[i].element.classList.add("hidden");
                }
            }
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

        this.items = [];
        for (let i = 0; i < content.length; i++) {
            let contentEle = document.createElement("div");
            contentEle.classList.add("content-list-item");
            if (content[i].class) contentEle.classList.add(content[i].class);
            if (content[i].type) contentEle.setAttribute("data-type", content[i].type);
            this.items.push({ "name": [content[i].primary_column.title, content[i].primary_column.desc, content[i].secondary_column.title, content[i].secondary_column.desc].join("!!!!!!!!!!"), "element": contentEle, "type": content[i].type });
            if (features?.checkbox?.enabled) {
                let checkboxElement = document.createElement("input");
                checkboxElement.type = "checkbox";
                checkboxElement.className = "content-list-checkbox";
                checkboxElement.onchange = (e) => {
                    this.figureOutMainCheckedState();
                }
                this.checkBoxes.push(checkboxElement);
                contentEle.appendChild(checkboxElement);
            }
            let imageElement = document.createElement("img");
            imageElement.className = "content-list-image";
            imageElement.src = content[i].image ? content[i].image : "default.png";
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
            infoElement2Title.innerHTML = sanitize(content[i].secondary_column.title);
            infoElement2.appendChild(infoElement2Title);
            let infoElement2Desc = document.createElement("div");
            infoElement2Desc.className = "content-list-info-desc-2";
            infoElement2Desc.innerHTML = (content[i].secondary_column.desc);
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

function toggleDisabledContent(contentInfo, theActionList, toggle, moreDropdown) {
    let content = contentInfo.instance_info.getContent();
    for (let i = 0; i < content.length; i++) {
        let e = content[i];
        if (e.file_name == contentInfo.secondary_column.desc) {
            let file_path = `./minecraft/instances/${contentInfo.instance_info.instance_id}/${e.type == "mod" ? "mods" : e.type == "resource_pack" ? "resourcepacks" : "shaderpacks"}/` + e.file_name;
            if (e.disabled) {
                let new_file_name = window.electronAPI.enableFile(file_path);
                if (!new_file_name) {
                    displayError(translate("app.error.failure_to_enable"));
                    return;
                }
                e.setDisabled(false);
                e.setFileName(new_file_name);
                contentInfo.secondary_column.desc = new_file_name;
                displaySuccess(translate("app.content.success_enable").replace("%s", e.name));
            } else {
                let new_file_name = window.electronAPI.disableFile(file_path);
                if (!new_file_name) {
                    displayError(translate("app.error.failure_to_disable"));
                    return;
                }
                e.setDisabled(true);
                e.setFileName(new_file_name);
                contentInfo.secondary_column.desc = new_file_name;
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

let homeContent = new PageContent(showHomeContent, "home");
let instanceContent = new PageContent(showInstanceContent, "instances");
let worldContent = new PageContent(null, "discover");
let myAccountContent = new PageContent(showMyAccountContent, "my_account");
let contextmenu = new ContextMenu();
let homeButton = new NavigationButton(homeButtonEle, translate("app.page.home"), '<i class="fa-solid fa-house"></i>', homeContent);
let instanceButton = new NavigationButton(instanceButtonEle, translate("app.page.instances"), '<i class="fa-solid fa-book"></i>', instanceContent);
let worldButton = new NavigationButton(worldButtonEle, translate("app.page.discover"), '<i class="fa-solid fa-compass"></i>', worldContent);
let settingsButton = new NavigationButton(settingsButtonEle, "Settings", '<i class="fa-solid fa-gear"></i>');
let myAccountButton = new NavigationButton(myAccountButtonEle, translate("app.page.my_account"), '<i class="fa-solid fa-user"></i>', myAccountContent);

settingsButtonEle.onclick = () => {
    let dialog = new Dialog();
    let java_installations = [{
        "type": "notice",
        "tab": "java",
        "content": "These are the default java installations for each of the following versions. It is not recommended to change these unless you know what you are doing. Please make sure that the path is pointing to javaw.exe and not java.exe, in addition to ensuring that the installation is at least the version number. Please note that when you run the test, it will execute the .exe file you selected to make sure it is a java executable."
    }];
    let java_stuff = window.electronAPI.getJavaInstallations();
    java_stuff.sort((a, b) => b.version - a.version);
    java_stuff.forEach(e => {
        java_installations.push({
            "type": "text",
            "name": `Java ${e.version} Location`,
            "id": "java_" + e.version,
            "default": e.path,
            "tab": "java",
            "buttons": [
                {
                    "name": "Detect",
                    "icon": '<i class="fa-solid fa-magnifying-glass"></i>',
                    "func": async (v, b, i) => {
                        b.innerHTML = '<i class="spinner"></i>Searching...';
                        let dialog = new Dialog();
                        let results = await window.electronAPI.detectJavaInstallations(e.version);
                        dialog.showDialog("Select Java Installation", "form", [
                            {
                                "type": "dropdown",
                                "id": "java_path",
                                "name": "Java Path",
                                "options": results.map(e => ({ "name": e.path, "value": e.path }))
                            }
                        ], [
                            { "type": "cancel", "content": "Cancel" },
                            { "type": "confirm", "content": "Select" }
                        ], [], (e) => {
                            let info = {};
                            e.forEach(e => { info[e.id] = e.value });
                            i.value = info.java_path;
                        });
                        b.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i>Detect';
                    }
                },
                {
                    "name": "Browse",
                    "icon": '<i class="fa-solid fa-folder"></i>',
                    "func": async (v, b, i) => {
                        let newValue = await window.electronAPI.triggerFileBrowse(v);
                        if (newValue) i.value = newValue;
                    }
                },
                {
                    "name": "Test",
                    "icon": '<i class="fa-solid fa-play"></i>',
                    "func": async (v, b) => {
                        let num = Math.floor(Math.random() * 10000);
                        b.setAttribute("data-num", num);
                        b.classList.remove("failed");
                        b.innerHTML = '<i class="spinner"></i>Testing...';
                        let success = await window.electronAPI.testJavaInstallation(v);
                        if (success) {
                            b.innerHTML = '<i class="fa-solid fa-check"></i>Test Successful';
                        } else {
                            b.innerHTML = '<i class="fa-solid fa-xmark"></i>Test Failed';
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
    dialog.showDialog("Settings", "form", [
        {
            "type": "dropdown",
            "name": "Color Theme",
            "tab": "appearance",
            "id": "default_mode",
            "options": [
                { "name": "Dark Mode", "value": "dark" },
                { "name": "Light Mode", "value": "light" }
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
            "name": "Default Page",
            "desc": "The page that the launcher opens on",
            "tab": "appearance",
            "id": "default_page",
            "options": [
                { "name": "Home", "value": "home" },
                { "name": "Instances", "value": "instances" },
                { "name": "Discover", "value": "discover" },
                { "name": "My Account", "value": "my_account" }
            ],
            "default": data.getDefault("default_page")
        },
        {
            "type": "number",
            "name": "Default Width",
            "desc": "The width of the game when launched",
            "tab": "defaults",
            "id": "default_width",
            "default": Number(data.getDefault("default_width"))
        },
        {
            "type": "number",
            "name": "Default Height",
            "desc": "The height of the game when launched",
            "tab": "defaults",
            "id": "default_height",
            "default": Number(data.getDefault("default_height"))
        },
        {
            "type": "slider",
            "name": "Default Allocated RAM",
            "desc": "How much RAM your game can use. (in MB)",
            "tab": "defaults",
            "id": "default_ram",
            "default": Number(data.getDefault("default_ram")),
            "min": 512,
            "max": window.electronAPI.getTotalRAM(),
            "increment": 64,
            "unit": "MB"
        }
    ].concat(java_installations), [
        {
            "type": "cancel",
            "content": "Cancel"
        },
        {
            "type": "confirm",
            "content": "Submit"
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
            "name": "Default Options",
            "value": "options"
        },
        {
            "name": translate("app.settings.tab.java"),
            "value": "java"
        },
        {
            "name": translate("app.settings.tab.app_info"),
            "value": "app_info"
        }
    ], (v) => {
        let info = {};
        v.forEach(e => info[e.id] = e.value);
        data.setDefault("default_width", info.default_width);
        data.setDefault("default_height", info.default_height);
        data.setDefault("default_ram", info.default_ram);
        data.setDefault("default_page", info.default_page);
        v.forEach(e => {
            if (e.id.includes("java_")) {
                let version = e.id.replace("java_", "");
                window.electronAPI.setJavaInstallation(version, e.value);
            }
        })
    });
}

let navButtons = [homeButton, instanceButton, worldButton, myAccountButton];

async function toggleMicrosoftSignIn() {
    let newData = await window.electronAPI.triggerMicrosoftLogin();
    let players = data.getProfiles().map(e => e.uuid);
    if (players.includes(newData.uuid)) {
        let player = data.getProfileFromUUID(newData.uuid);
        player.setDefault();
        accountSwitcher.selectPlayer(player);
        await updateSkinsAndCapes(newData);
    } else {
        let newPlayer = data.addProfile(newData.access_token, newData.client_id, newData.expires, newData.name, newData.refresh_token, newData.uuid, newData.xuid, newData.is_demo, false);
        newPlayer.setDefault();
        accountSwitcher.addPlayer(newPlayer);
        await updateSkinsAndCapes(newData);
    }
}

function showHomeContent(e) {
    let ele = document.createElement("div");
    ele.innerHTML = translate("app.page.home");
    return ele;
}

if (data.getDefault("default_mode") == "light") {
    document.body.classList.add("light");
}

let skinViewer;

function showMyAccountContent(e) {
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
    let viewerInfo = document.createElement("div");
    viewerInfo.innerHTML = 'Current Skin';
    viewerInfo.className = 'skin-render-info';
    skinRenderContainer.appendChild(pauseButton);
    skinRenderContainer.appendChild(viewerInfo);
    let optionsContainer = document.createElement("div");
    optionsContainer.className = "my-account-options";
    ele.appendChild(optionsContainer);
    let skinOptions = document.createElement("div");
    skinOptions.className = "my-account-option-box";
    let capeOptions = document.createElement("div");
    capeOptions.className = "my-account-option-box";
    let skinTitle = document.createElement("h1");
    skinTitle.innerHTML = "Skins";
    let capeTitle = document.createElement("h1");
    capeTitle.innerHTML = "Capes";
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
        skinViewer.loadSkin(activeSkin ? `minecraft/skins/${activeSkin.skin_id}.png` : null, {
            model: default_profile.getActiveSkin()?.model == "slim" ? "slim" : "default",
        });
        let activeCape = default_profile.getActiveCape();
        skinViewer.loadCape(activeCape ? `minecraft/capes/${activeCape.cape_id}.png` : null);
        skinList.innerHTML = '';
        capeList.innerHTML = '';
        let skins = data.getSkins();
        skins.forEach((e) => {
            let skinEle = document.createElement("div");
            let equipSkin = async () => {
                loader.style.display = "block";
                skinImg.style.display = "none";
                let currentEle = skinEle;
                let success = await applySkin(default_profile, e);
                if (success) {
                    let oldEle = document.querySelector(".my-account-option.skin.selected");
                    oldEle.classList.remove("selected");
                    currentEle.classList.add("selected");
                    e.setActive(default_profile.uuid);
                    skinViewer.loadSkin(`minecraft/skins/${e.skin_id}.png`, {
                        model: e.model == "wide" ? "default" : "slim"
                    });
                    viewerInfo.innerHTML = 'Current Skin';
                    activeSkin = e;
                }
                loader.style.display = "none";
                skinImg.style.display = "block";
            }
            let buttons = new ContextMenuButtons([
                {
                    "title": "Equip Skin",
                    "icon": '<i class="fa-solid fa-user"></i>',
                    "func": equipSkin
                },
                {
                    "title": "Edit Skin",
                    "icon": '<i class="fa-solid fa-pencil"></i>',
                    "func": () => {
                        let dialog = new Dialog();
                        dialog.showDialog("Edit Skin", "form", [
                            {
                                "type": "text",
                                "id": "name",
                                "name": "Name",
                                "default": e.name
                            },
                            {
                                "type": "dropdown",
                                "id": "model",
                                "name": "Model",
                                "options": [
                                    { "name": "Classic Arms (4px)", "value": "wide" },
                                    { "name": "Slim Arms (3px)", "value": "slim" }
                                ],
                                "default": e.model
                            }
                        ], [
                            { "type": "cancel", "content": "Cancel" },
                            { "type": "confirm", "content": "Submit" }
                        ], [], async (v) => {
                            let info = {};
                            v.forEach(e => { info[e.id] = e.value });
                            e.setName(info.name);
                            e.setModel(info.model);
                            showContent();
                        });
                    }
                },
                {
                    "title": "Delete Skin",
                    "icon": '<i class="fa-solid fa-trash-can"></i>',
                    "danger": true,
                    "func": () => {
                        e.delete();
                        showContent();
                    }
                }
            ]);
            skinEle.oncontextmenu = (e) => {
                contextmenu.showContextMenu(buttons, e.clientX, e.clientY);
            }
            skinEle.className = "my-account-option";
            skinEle.classList.add("skin");
            skinEle.setAttribute("role", "button");
            skinEle.setAttribute("tabindex", 0);
            let skinMore = document.createElement("button");
            skinMore.className = "skin-more";
            skinMore.innerHTML = '<i class="fa-solid fa-ellipsis-vertical"></i>';
            let moreMenu = new MoreMenu(skinMore, buttons, true, 2);
            skinEle.appendChild(skinMore);
            let skinImg = document.createElement("img");
            renderSkinToDataUrl(`minecraft/skins/${e.skin_id}.png`, (v) => {
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
            skinList.appendChild(skinEle);
            skinEle.onmouseenter = () => {
                skinViewer.loadSkin(`minecraft/skins/${e.skin_id}.png`, {
                    model: e.model == "wide" ? "default" : "slim",
                });
                viewerInfo.innerHTML = 'Skin Preview';
            }
            skinEle.onfocus = () => {
                skinViewer.loadSkin(`minecraft/skins/${e.skin_id}.png`, {
                    model: e.model == "wide" ? "default" : "slim",
                });
                viewerInfo.innerHTML = 'Skin Preview';
            }
            skinEle.onmouseleave = () => {
                skinViewer.loadSkin(activeSkin ? `minecraft/skins/${activeSkin.skin_id}.png` : null, {
                    model: default_profile.getActiveSkin()?.model == "slim" ? "slim" : "default",
                });
                viewerInfo.innerHTML = 'Current Skin';
            }
            skinEle.onblur = (e) => {
                if (e.relatedTarget?.matches(".my-account-option.skin")) return;
                skinViewer.loadSkin(activeSkin ? `minecraft/skins/${activeSkin.skin_id}.png` : null, {
                    model: default_profile.getActiveSkin()?.model == "slim" ? "slim" : "default",
                });
                viewerInfo.innerHTML = 'Current Skin';
            }
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
                    skinViewer.loadCape(`minecraft/capes/${e.cape_id}.png`);
                    viewerInfo.innerHTML = 'Current Skin';
                    activeCape = e;
                }
                loader.style.display = "none";
                capeImg.style.display = "block";
            }
            capeEle.className = "my-account-option";
            capeEle.classList.add("cape");
            let capeImg = document.createElement("img");
            extractImageRegionToDataURL(`minecraft/capes/${e.cape_id}.png`, 1, 1, 10, 16, (e) => {
                if (e) capeImg.src = e;
            });
            capeImg.classList.add("option-image");
            let loader = document.createElement("div");
            loader.className = "loading-container-spinner";
            loader.style.display = "none";
            let capeName = document.createElement("div");
            capeEle.appendChild(capeImg);
            capeEle.appendChild(loader);
            capeEle.appendChild(capeName);
            capeName.innerHTML = sanitize(e.cape_name);
            capeList.appendChild(capeEle);
            capeEle.onmouseenter = () => {
                skinViewer.loadCape(`minecraft/capes/${e.cape_id}.png`);
                viewerInfo.innerHTML = 'Cape Preview';
            }
            capeEle.onfocus = () => {
                skinViewer.loadCape(`minecraft/capes/${e.cape_id}.png`);
                viewerInfo.innerHTML = 'Cape Preview';
            }
            capeEle.onmouseleave = () => {
                skinViewer.loadCape(activeCape ? `minecraft/capes/${activeCape.cape_id}.png` : null);
                viewerInfo.innerHTML = 'Current Skin';
            }
            capeEle.onblur = (e) => {
                if (e.relatedTarget?.matches(".my-account-option.cape")) return;
                skinViewer.loadCape(activeCape ? `minecraft/capes/${activeCape.cape_id}.png` : null);
                viewerInfo.innerHTML = 'Current Skin';
            }
            if (e.active) {
                capeEle.classList.add("selected");
            }
            capeEle.onclick = equipCape;
        });
        let capeEle = document.createElement("button");
        capeEle.className = "my-account-option";
        capeEle.classList.add("cape");
        let capeImg = document.createElement("div");
        capeImg.classList.add("option-image");
        capeImg.innerHTML = '<i class="fa-regular fa-circle-xmark"></i>';
        let loader = document.createElement("div");
        loader.className = "loading-container-spinner";
        loader.style.display = "none";
        let capeName = document.createElement("div");
        capeEle.appendChild(capeImg);
        capeEle.appendChild(loader);
        capeEle.appendChild(capeName);
        capeName.innerHTML = "No Cape";
        capeList.appendChild(capeEle);
        capeEle.onmouseenter = () => {
            skinViewer.loadCape(null);
            viewerInfo.innerHTML = 'Cape Preview';
        }
        capeEle.onfocus = () => {
            skinViewer.loadCape(null);
            viewerInfo.innerHTML = 'Cape Preview';
        }
        capeEle.onmouseleave = () => {
            skinViewer.loadCape(activeCape ? `minecraft/capes/${activeCape.cape_id}.png` : null);
            viewerInfo.innerHTML = 'Current Skin';
        }
        capeEle.onblur = (e) => {
            if (e.relatedTarget?.matches(".my-account-option.cape")) return;
            skinViewer.loadCape(activeCape ? `minecraft/capes/${activeCape.cape_id}.png` : null);
            viewerInfo.innerHTML = 'Current Skin';
        }
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
                viewerInfo.innerHTML = 'Current Skin';
                activeCape = null;
            }
            loader.style.display = "none";
            capeImg.style.display = "block";
        }
    }
    showContent();
    let info = document.createElement("div");
    info.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>To reload your skin in a multiplayer world, simply leave and rejoin and your new skin should apply. As for singleplayer worlds, you might need to restart the entire instance for your new skin to apply.';
    info.className = "info";
    optionsContainer.appendChild(info);
    let skinButtonContainer = document.createElement("div");
    skinButtonContainer.className = "skin-button-container";
    let refreshButton = document.createElement("button");
    refreshButton.className = "skin-button";
    let refreshButtonIcon = document.createElement("i");
    refreshButtonIcon.className = "fa-solid fa-arrows-rotate";
    let refreshButtonText = document.createElement("span");
    refreshButtonText.innerHTML = "Refresh";
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
            displayError("Unable to refresh skins");
            refreshButtonIcon.classList.remove("spinning");
            return;
        }
    }
    skinButtonContainer.appendChild(refreshButton);
    let importButton = document.createElement("button");
    importButton.innerHTML = '<i class="fa-solid fa-file-import"></i>Import Skin';
    importButton.className = "skin-button";
    importButton.onclick = () => {
        let dialog = new Dialog();
        dialog.showDialog("Import Skin", "form", [
            {
                "type": "image-upload",
                "id": "skin",
                "name": "Skin"
            },
            {
                "type": "text",
                "id": "name",
                "name": "Name"
            },
            {
                "type": "dropdown",
                "id": "model",
                "name": "Model",
                "options": [
                    { "name": "Classic Arms (4px)", "value": "wide" },
                    { "name": "Slim Arms (3px)", "value": "slim" }
                ]
            }
        ], [
            { "type": "cancel", "content": "Cancel" },
            { "type": "confirm", "content": "Submit" }
        ], [], async (e) => {
            let info = {};
            e.forEach(e => { info[e.id] = e.value });
            if (!info.skin) {
                displayError("Please provide a skin file.");
                return;
            }
            let dims = await getImageDimensionsFromDataURL(info.skin);
            console.log(dims);
            if (dims.width != 64) {
                displayError("Invalid skin. Make sure the width is exactly 64 pixels.");
                return;
            }
            if (dims.height != 64 && dims.height != 32) {
                displayError("Invalid skin. Make sure the height is exactly 64 pixels (or 32)");
                return;
            }
            data.addSkin("", info.name ? info.name : "<unnamed>", info.model, "", await window.electronAPI.importSkin(info.skin));
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
        console.error("Failed to load image:", err);
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
        console.error("Failed to load image:", err);
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

        function drawPart(sx, sy, sw, sh, dx, dy, dw = sw, dh = sh) {
            ctx.drawImage(skin, sx, sy, sw, sh, dx, dy, dw, dh);
        }

        // first layer
        drawPart(8, 8, 8, 8, 4, 0); // head
        drawPart(20, 20, 8, 12, 4, 8); // torso
        drawPart(4, 20, 4, 12, 4, 20); // right leg
        drawPart(20, 52, 4, 12, 8, 20); // left leg
        drawPart(44, 20, model == "wide" ? 4 : 3, 12, model == "wide" ? 0 : 1, 8); // right arm
        drawPart(36, 52, model == "wide" ? 4 : 3, 12, 12, 8); // left arm

        // second layer
        drawPart(40, 8, 8, 8, 4, 0); // head
        drawPart(20, 36, 8, 12, 4, 8); // torso
        drawPart(4, 36, 4, 12, 4, 20); // right leg
        drawPart(4, 52, 4, 12, 8, 20); // left leg
        drawPart(44, 36, model == "wide" ? 4 : 3, 12, model == "wide" ? 0 : 1, 8, 8); // right arm
        drawPart(52, 52, model == "wide" ? 4 : 3, 12, 12, 8); // left arm

        callback(canvas.toDataURL())
    }

    skin.onerror = (err) => {
        console.error("Failed to load image:", err);
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
        // Use Array.from for better performance and avoid live HTMLCollection
        let children = Array.from(groups[i].children);
        // Only sort if more than 1 child
        if (children.length > 1) {
            children.sort((a, b) => {
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
    groups.sort((a, b) => {
        if (a === "" && b !== "") return -1;
        if (a !== "" && b === "") return 1;
        return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
    });
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
    "": "Unknown"
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
                "tab": "custom"
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
                "source": (new VersionList).getVersions,
                "tab": "custom"
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
                "name": "Name"
            },
            {
                "type": "text",
                "id": "file",
                "tab": "file",
                "name": "File",
                "desc": "Select a Modrinth .mrpack file or a CurseForge .zip file",
                "default": "",
                "buttons": [
                    {
                        "name": "Browse Files",
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
            },
            {
                "type": "dropdown",
                "id": "launcher",
                "tab": "launcher",
                "name": "Launcher",
                "options": [
                    {
                        "name": "Modrinth App",
                        "value": "modrinth"
                    },
                    {
                        "name": "CurseForge App",
                        "value": "curseforge"
                    },
                    {
                        "name": "MultiMC",
                        "value": "multimc"
                    },
                    {
                        "name": "PrismLauncher",
                        "value": "prism"
                    },
                    {
                        "name": "ATLauncher",
                        "value": "atlauncher"
                    },
                    {
                        "name": "GDLauncher",
                        "value": "gdlauncher"
                    },
                    {
                        "name": "Minecraft Launcher",
                        "value": "vanilla"
                    }
                ]
            }
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
                "name": translate("app.instances.tab.launcher"),
                "value": "launcher"
            }
        ], async (e) => {
            let info = {};
            e.forEach(e => { info[e.id] = e.value });
            if (info.selected_tab == "custom") {
                let instance_id = window.electronAPI.getInstanceFolderName(info.name.replace(/[#<>:"/\\|?*\x00-\x1F]/g, "_").toLowerCase());
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
                let instance_id = window.electronAPI.getInstanceFolderName(info.name_f.toLowerCase());
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
                packInfo.content.forEach(e => {
                    instance.addContent(e.name, e.author, e.image, e.file_name, e.source, e.type, e.version, e.source_id, e.disabled);
                });
                instance.setInstalling(false);
                let r = await window.electronAPI.downloadMinecraft(instance_id, packInfo.loader, packInfo.vanilla_version, packInfo.loader_version);
                instance.setJavaPath(r.java_installation);
                instance.setJavaVersion(r.java_version);
                instance.setMcInstalled(true);
            } else if (info.selected_tab == "launcher") {

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
                "func": (e) => { }
            },
            {
                "icon": '<i class="fa-solid fa-folder"></i>',
                "title": translate("app.button.instances.open_folder"),
                "func": (e) => {
                    window.electronAPI.openFolder(`./minecraft/instances/${instances[i].instance_id}`);
                }
            },
            {
                "icon": '<i class="fa-solid fa-share"></i>',
                "title": translate("app.button.instances.share"),
                "func": (e) => { }
            },
            {
                "icon": '<i class="fa-solid fa-gear"></i>',
                "title": translate("app.button.instances.open_settings"),
                "func": (e) => {
                    showInstanceSettings(new Instance(instances[i].instance_id));
                }
            },
            {
                "icon": '<i class="fa-solid fa-trash-can"></i>',
                "title": translate("app.button.instances.delete"),
                "func": (e) => {
                    let dialog = new Dialog();
                    dialog.showDialog("Are you sure?", "notice", "Are you sure that you want to delete the instance '" + instances[i].name + "'?", [ // TODO
                        {
                            "type": "cancel",
                            "content": "Cancel"
                        },
                        {
                            "type": "confirm",
                            "content": "Confirm Deletion"
                        }
                    ], [], () => {
                        instances[i].delete();
                        instanceContent.displayContent();
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
    instTopPlaytime.innerHTML = `<i class="fa-solid fa-clock"></i>${sanitize(formatTime(instanceInfo.playtime))}`;
    let instTopLastPlayed = document.createElement("div");
    instTopLastPlayed.classList.add("instance-top-sub-info-specific");
    instTopLastPlayed.innerHTML = `<i class="fa-solid fa-clock-rotate-left"></i>${sanitize(formatDate(instanceInfo.last_played))}`;
    instanceInfo.watchForChange("last_played", (v) => {
        instTopLastPlayed.innerHTML = `<i class="fa-solid fa-clock-rotate-left"></i>${sanitize(formatDate(v))}`;
    });
    instTopSubInfo.appendChild(instTopVersions);
    instTopSubInfo.appendChild(instTopPlaytime);
    instTopSubInfo.appendChild(instTopLastPlayed);
    instTopInfo.appendChild(instTopSubInfo);
    topBar.appendChild(instTopInfo);
    let playButton = document.createElement("button");
    let playButtonClick = async () => {
        playButton.innerHTML = '<i class="spinner"></i>' + "Loading"; //TODO
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
        console.log("pid is " + (new Instance(instanceInfo.instance_id)).pid);
        window.electronAPI.watchProcessForExit((new Instance(instanceInfo.instance_id)).pid, () => {
            console.log("detected instance closed");
            playButton.innerHTML = '<i class="fa-solid fa-play"></i>' + translate("app.button.instances.play_short");
            playButton.classList.remove("instance-top-stop-button");
            playButton.classList.add("instance-top-play-button");
            playButton.onclick = playButtonClick;
            live.findLive();
        });
    }
    let stopButtonClick = () => {
        stopInstance(instanceInfo);
        playButton.innerHTML = '<i class="fa-solid fa-play"></i>' + translate("app.button.instances.play_short");
        playButton.classList.remove("instance-top-stop-button");
        playButton.classList.add("instance-top-play-button");
        playButton.onclick = playButtonClick;
    }
    if (!instanceInfo.mc_installed) {
        playButton.innerHTML = '<i class="spinner"></i>' + "Installing"; //TODO
        playButton.classList.remove("instance-top-play-button");
        playButton.classList.add("instance-top-loading-button");
        playButton.onclick = () => { };
        instanceInfo.watchForChange("mc_installed", (v) => {
            if (v) {
                playButton.innerHTML = '<i class="fa-solid fa-play"></i>' + translate("app.button.instances.play_short");
                playButton.classList.remove("instance-top-loading-button");
                playButton.classList.add("instance-top-play-button");
                playButton.onclick = playButtonClick;
            }
        });
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
        });
    }
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
            "func": (e) => { }
        },
        {
            "icon": '<i class="fa-solid fa-folder"></i>',
            "title": translate("app.button.instances.open_folder"),
            "func": (e) => {
                window.electronAPI.openFolder(`./minecraft/instances/${instanceInfo.instance_id}`);
            }
        },
        {
            "icon": '<i class="fa-solid fa-share"></i>',
            "title": translate("app.button.instances.share"),
            "func": (e) => { }
        },
        {
            "icon": '<i class="fa-solid fa-gear"></i>',
            "title": translate("app.button.instances.open_settings"),
            "func": (e) => {
                showInstanceSettings(new Instance(instanceInfo.instance_id));
            }
        },
        {
            "icon": '<i class="fa-solid fa-trash-can"></i>',
            "title": translate("app.button.instances.delete"),
            "func": (e) => {
                let dialog = new Dialog();
                dialog.showDialog("Are you sure?", "notice", "Are you sure that you want to delete the instance '" + instanceInfo.name + "'?", [ // TODO
                    {
                        "type": "cancel",
                        "content": "Cancel"
                    },
                    {
                        "type": "confirm",
                        "content": "Confirm Deletion"
                    }
                ], [], () => {
                    instanceInfo.delete();
                    instanceContent.displayContent();
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
            "name": "Screenshots", "value": "screenshots", "func": () => {
                setInstanceTabContentScreenshots(instanceInfo, tabsInfo);
            }
        }
    ]);
    tabs.selectOptionAdvanced(default_tab ?? "content");
}

function showInstanceSettings(instanceInfo) {
    let dialog = new Dialog();
    dialog.showDialog("Instance Settings", "form", [
        {
            "type": "image-upload",
            "name": "Icon",
            "id": "icon",
            "default": instanceInfo.image,
            "tab": "general"
        },
        {
            "type": "text",
            "name": "Name",
            "id": "name",
            "default": instanceInfo.name,
            "tab": "general"
        },
        {
            "type": "text",
            "name": "Library Group",
            "id": "group",
            "default": instanceInfo.group,
            "tab": "general",
            "desc": "Library Groups help to organize your instance list. Any instances in the same group will be displayed together when they are grouped by custom groups."
        },
        {
            "type": "multi-select",
            "name": "Loader",
            "options": [
                { "name": "Vanilla", "value": "vanilla" },
                { "name": "Fabric", "value": "fabric" },
                { "name": "Forge", "value": "forge" },
                { "name": "NeoForge", "value": "neoforge" },
                { "name": "Quilt", "value": "quilt" }
            ],
            "id": "loader",
            "default": instanceInfo.loader,
            "tab": "installation"
        },
        {
            "type": "dropdown",
            "name": "Game Version",
            "options": [],
            "id": "game_version",
            "default": instanceInfo.vanilla_version,
            "tab": "installation",
            "input_source": "loader",
            "source": (new VersionList).getVersions
        },
        {
            "type": "loader-version-dropdown",
            "name": "",
            "options": [],
            "id": "loader_version",
            "default": instanceInfo.loader_version,
            "tab": "installation",
            "loader_source": "loader",
            "game_version_source": "game_version"
        },
        {
            "type": "number",
            "name": "Width",
            "id": "width",
            "default": instanceInfo.window_width ?? 854,
            "tab": "window",
            "desc": "The width of the game when launched. (Default is 854)"
        },
        {
            "type": "number",
            "name": "Height",
            "id": "height",
            "default": instanceInfo.window_height ?? 480,
            "tab": "window",
            "desc": "The height of the game when launched. (Default is 480)"
        },
        {
            "type": "slider",
            "name": "Allocated RAM",
            "id": "allocated_ram",
            "default": instanceInfo.allocated_ram ?? 4096,
            "tab": "java",
            "min": 512,
            "max": window.electronAPI.getTotalRAM(),
            "increment": 64,
            "unit": "MB",
            "desc": "How much RAM your game can use. (in MB)"
        },
        {
            "type": "text",
            "name": "Java Installation",
            "id": "java_path",
            "default": instanceInfo.java_path,
            "tab": "java",
            "desc": "Use this to change the java installation that launches the game. It is not recommended to change this unless you know what you are doing. If you do change this, please make sure that it is at least version " + instanceInfo.java_version + " and is javaw.exe instead of java.exe. Please note that when you run the test, it will execute the .exe file you selected to make sure it is a java executable.",
            "buttons": [
                {
                    "name": "Detect",
                    "icon": '<i class="fa-solid fa-magnifying-glass"></i>',
                    "func": async (v, b, i) => {
                        b.innerHTML = '<i class="spinner"></i>Searching...';
                        let dialog = new Dialog();
                        let results = await window.electronAPI.detectJavaInstallations(instanceInfo.java_version);
                        dialog.showDialog("Select Java Installation", "form", [
                            {
                                "type": "dropdown",
                                "id": "java_path",
                                "name": "Java Path",
                                "options": results.map(e => ({ "name": e.path, "value": e.path }))
                            }
                        ], [
                            { "type": "cancel", "content": "Cancel" },
                            { "type": "confirm", "content": "Select" }
                        ], [], (e) => {
                            let info = {};
                            e.forEach(e => { info[e.id] = e.value });
                            i.value = info.java_path;
                        });
                        b.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i>Detect';
                    }
                },
                {
                    "name": "Browse",
                    "icon": '<i class="fa-solid fa-folder"></i>',
                    "func": async (v, b, i) => {
                        let newValue = await window.electronAPI.triggerFileBrowse(v);
                        if (newValue) i.value = newValue;
                    }
                },
                {
                    "name": "Test",
                    "icon": '<i class="fa-solid fa-play"></i>',
                    "func": async (v, b) => {
                        let num = Math.floor(Math.random() * 10000);
                        b.setAttribute("data-num", num);
                        b.classList.remove("failed");
                        b.innerHTML = '<i class="spinner"></i>Testing...';
                        let success = await window.electronAPI.testJavaInstallation(v);
                        if (success) {
                            b.innerHTML = '<i class="fa-solid fa-check"></i>Test Successful';
                        } else {
                            b.innerHTML = '<i class="fa-solid fa-xmark"></i>Test Failed';
                            b.classList.add("failed");
                        }
                        setTimeout(() => {
                            if (b.getAttribute("data-num") == num) {
                                b.innerHTML = '<i class="fa-solid fa-play"></i>Test';
                                b.classList.remove("failed");
                            }
                        }, 3000);
                    }
                },
                {
                    "name": "Reset",
                    "icon": '<i class="fa-solid fa-rotate-left"></i>',
                    "func": async (v, b, i) => {
                        b.innerHTML = '<i class="spinner"></i>Resetting...';
                        let java_path = await window.electronAPI.getJavaInstallation(instanceInfo.java_version);
                        i.value = java_path;
                        b.innerHTML = '<i class="fa-solid fa-rotate-left"></i>Reset'
                    }
                }
            ]
        }
    ], [
        { "type": "cancel", "content": "Cancel" },
        { "type": "confirm", "content": "Save" }
    ], [
        { "name": "General", "value": "general" },
        { "name": "Installation", "value": "installation" },
        { "name": "Window", "value": "window" },
        { "name": "Java", "value": "java" },
        { "name": "Launch Hooks", "value": "launch_hooks" }
    ], (e) => {
        let info = {};
        e.forEach(e => { info[e.id] = e.value });
        instanceInfo.setName(info.name);
        instanceInfo.setImage(info.icon);
        instanceInfo.setGroup(info.group);
        instanceInfo.setWindowWidth(info.width);
        instanceInfo.setWindowHeight(info.height);
        instanceInfo.setAllocatedRam(info.allocated_ram);
        instanceInfo.setJavaPath(info.java_path);
    });
}

function setInstanceTabContentContent(instanceInfo, element) {
    let searchAndFilter = document.createElement("div");
    searchAndFilter.classList.add("search-and-filter-v2");
    let addContent = document.createElement("button");
    addContent.classList.add("add-content-button");
    addContent.innerHTML = '<i class="fa-solid fa-plus"></i>' + translate("app.button.content.add")
    addContent.onclick = () => {
        showAddContent(instanceInfo.instance_id, instanceInfo.vanilla_version, instanceInfo.loader);
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
    searchAndFilter.appendChild(addContent);
    element.innerHTML = "";
    element.appendChild(searchAndFilter);
    let contentListWrap = document.createElement("div");
    let showContent = () => {
        contentListWrap.innerHTML = '';
        let old_file_names = instanceInfo.getContent().map((e) => e.file_name);
        let newContent = getInstanceContent(instanceInfo);
        let newContentAdd = newContent.newContent.filter((e) => !old_file_names.includes(e.file_name));
        newContentAdd.forEach(e => {
            instanceInfo.addContent(e.name, e.author, e.image, e.file_name, e.source, e.type, e.version, "", e.disabled);
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
                    "title": e.version,
                    "desc": e.file_name
                },
                "type": e.type,
                "class": e.source,
                "image": e.image,
                "onremove": (ele) => {
                    let dialog = new Dialog();
                    dialog.showDialog("Are you sure?", "notice", "Are you sure that you want to delete the content '" + e.name + "'?", [
                        {
                            "type": "cancel",
                            "content": "Cancel"
                        },
                        {
                            "type": "confirm",
                            "content": "Confirm Deletion"
                        }
                    ], [], async () => {
                        let success = await window.electronAPI.deleteContent(instanceInfo.instance_id, e.type, e.file_name);
                        if (success) {
                            ele.remove();
                            displaySuccess("Deleted " + e.name);
                        } else {
                            displayError("Unable to delete " + e.name);
                        }
                    });
                },
                "more": {
                    "actionsList": [
                        {
                            "title": translate("app.content.open"),
                            "icon": '<i class="fa-solid fa-up-right-from-square"></i>',
                            "func": () => {
                                window.electronAPI.openFolder(`./minecraft/instances/${instanceInfo.instance_id}/${e.type == "mod" ? "mods" : e.type == "resource_pack" ? "resourcepacks" : "shaderpacks"}`)
                            }
                        },
                        {
                            "title": translate("app.content.update"),
                            "icon": '<i class="fa-solid fa-download"></i>',
                            "func_id": "update"
                        },
                        {
                            "title": e.disabled ? translate("app.content.enable") : translate("app.content.disable"),
                            "icon": e.disabled ? '<i class="fa-solid fa-eye"></i>' : '<i class="fa-solid fa-eye-slash"></i>',
                            "func_id": "toggle"
                        },
                        {
                            "title": translate("app.content.delete"),
                            "icon": '<i class="fa-solid fa-trash-can"></i>',
                            "danger": true,
                            "func_id": "delete",
                            "func": (ele) => {
                                let dialog = new Dialog();
                                dialog.showDialog("Are you sure?", "notice", "Are you sure that you want to delete the content '" + e.name + "'?", [
                                    {
                                        "type": "cancel",
                                        "content": "Cancel"
                                    },
                                    {
                                        "type": "confirm",
                                        "content": "Confirm Deletion"
                                    }
                                ], [], async () => {
                                    let success = await window.electronAPI.deleteContent(instanceInfo.instance_id, e.type, e.file_name);
                                    if (success) {
                                        ele.remove();
                                        displaySuccess("Deleted " + e.name);
                                    } else {
                                        displayError("Unable to delete " + e.name);
                                    }
                                });
                            }
                        }
                    ].filter(e => e)
                },
                "disabled": e.disabled,
                "instance_info": instanceInfo
            })
        }
        let contentList = new ContentList(contentListWrap, content, searchBar, {
            "checkbox": {
                "enabled": true,
                "actionsList": null
            },
            "disable": {
                "enabled": true
            },
            "remove": {
                "enabled": true
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
                "enabled": true,
                "func": () => { }
            }
        }, dropdownInfo);
    }
    if (!instanceInfo.installing) {
        showContent();
    } else {
        let currently_installing = new CurrentlyInstalling();
        contentListWrap.appendChild(currently_installing.element);
        instanceInfo.watchForChange("installing", (v) => {
            if (!v) {
                showContent();
            }
        })
    }
    element.appendChild(contentListWrap);
}
function isNotDisplayNone(element) {
    return element.checkVisibility({ checkDisplayNone: true });
}
async function setInstanceTabContentWorlds(instanceInfo, element) {
    let searchAndFilter = document.createElement("div");
    searchAndFilter.classList.add("search-and-filter-v2");
    let importWorlds = document.createElement("button");
    importWorlds.classList.add("add-content-button");
    importWorlds.innerHTML = '<i class="fa-solid fa-plus"></i>Import Worlds'
    importWorlds.onclick = () => {
        let getInstances = () => {
            return data.getInstances().map(e => ({ "name": e.name, "value": e.instance_id }));
        }
        let dialog = new Dialog();
        dialog.showDialog("Select Worlds to Import", "form", [
            {
                "type": "dropdown",
                "id": "launcher",
                "name": "Launcher",
                "options": [
                    {
                        "name": "EnderGate",
                        "value": "current"
                    },
                    {
                        "name": "Minecraft Launcher",
                        "value": "vanilla"
                    },
                    {
                        "name": "Modrinth App",
                        "value": "modrinth"
                    },
                    {
                        "name": "CurseForge App",
                        "value": "curseforge"
                    },
                    {
                        "name": "MultiMC",
                        "value": "multimc"
                    },
                    {
                        "name": "PrismLauncher",
                        "value": "prism"
                    },
                    {
                        "name": "ATLauncher",
                        "value": "atlauncher"
                    },
                    {
                        "name": "GDLauncher",
                        "value": "gdlauncher"
                    }
                ]
            },
            {
                "type": "text",
                "id": "folder_path",
                "name": "Instance Folder Path",
                "default": window.electronAPI.getInstanceFolderPath(),
                "input_source": "launcher",
                "source": window.electronAPI.getLauncherInstancePath,
                "buttons": [
                    {
                        "name": "Browse Folders",
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
                "name": "Instance",
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
                "name": "Worlds",
                "options": getInstanceWorlds(instanceInfo).map(e => ({ "name": e.name, "value": e.id })),
                "id": "world"
            },
            {
                "type": "toggle",
                "name": "Remove Previous World Files",
                "id": "remove",
                "default": false
            }
        ], [
            {
                "type": "cancel",
                "content": "Cancel"
            },
            {
                "type": "confirm",
                "content": "Import"
            }
        ], [], (v) => {
            let info = {};
            v.forEach(e => info[e.id] = e.value);
            console.log(info);
            for (let i = 0; i < info.world.length; i++) {
                let world = info.world[i];
                try {
                    window.electronAPI.transferWorld(world,instanceInfo.instance_id,info.remove);
                } catch (e) {
                    displayError("Error occured while transferring world: " + e.message);
                }
            }
            displaySuccess("World transfers completed!");
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
        },
        {
            "name": translate("app.worlds.realms"),
            "value": "realms"
        }
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
                    "title": translate("app.worlds.description.singleplayer"),
                    "desc": translate("app.worlds.description." + worlds[i].mode) + (worlds[i].hardcore ? " - <span style='color:#ff1313'>" + translate("app.worlds.description.hardcore") + "</span>" : "") + (worlds[i].commands ? " - " + translate("app.worlds.description.commands") : "") + (worlds[i].flat ? " - " + translate("app.worlds.description.flat") : "")
                },
                "type": "singleplayer",
                "image": worlds[i].icon ?? "default.png",
                "onremove": (ele) => {
                    let dialog = new Dialog();
                    dialog.showDialog("Are you sure?", "notice", "Are you sure that you want to delete the world '" + parseMinecraftFormatting(worlds[i].name) + "'?", [ // TODO
                        {
                            "type": "cancel",
                            "content": "Cancel"
                        },
                        {
                            "type": "confirm",
                            "content": "Confirm Deletion"
                        }
                    ], [], async () => {
                        let success = await window.electronAPI.deleteWorld(instanceInfo.instance_id, worlds[i].id);
                        if (success) {
                            ele.remove();
                            displaySuccess("Deleted " + parseMinecraftFormatting(worlds[i].name));
                        } else {
                            displayError("Unable to delete " + parseMinecraftFormatting(worlds[i].name));
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
                                window.electronAPI.openFolder(`./minecraft/instances/${instanceInfo.instance_id}/saves/${worlds[i].id}`)
                            }
                        },
                        {
                            "title": translate("app.worlds.share"),
                            "icon": '<i class="fa-solid fa-share"></i>',
                            "func": () => { }
                        },
                        {
                            "title": translate("app.worlds.delete"),
                            "icon": '<i class="fa-solid fa-trash-can"></i>',
                            "danger": true,
                            "func_id": "delete",
                            "func": (ele) => {
                                let dialog = new Dialog();
                                dialog.showDialog("Are you sure?", "notice", "Are you sure that you want to delete the world '" + parseMinecraftFormatting(worlds[i].name) + "'?", [ // TODO
                                    {
                                        "type": "cancel",
                                        "content": "Cancel"
                                    },
                                    {
                                        "type": "confirm",
                                        "content": "Confirm Deletion"
                                    }
                                ], [], async () => {
                                    let success = await window.electronAPI.deleteWorld(instanceInfo.instance_id, worlds[i].id);
                                    if (success) {
                                        ele.remove();
                                        displaySuccess("Deleted " + parseMinecraftFormatting(worlds[i].name));
                                    } else {
                                        displayError("Unable to delete " + parseMinecraftFormatting(worlds[i].name));
                                    }
                                });
                            }
                        }
                    ].filter(e => e)
                }
            });
    }
    for (let i = 0; i < worldsMultiplayer.length; i++) {
        worldList.push(
            {
                "primary_column": {
                    "title": worldsMultiplayer[i].name,
                    "desc": (new Date(worldsMultiplayer[i].last_played)).getFullYear() < 2000 ? translate("app.worlds.description.never_played") : translate("app.worlds.last_played").replace("%s", formatDate(worldsMultiplayer[i].last_played))
                },
                "secondary_column": {
                    "title": translate("app.worlds.description.multiplayer"),
                    "desc": worldsMultiplayer[i].ip
                },
                "type": "multiplayer",
                "image": worldsMultiplayer[i].icon ?? "default.png",
                "onremove": () => {
                    let dialog = new Dialog();
                    dialog.showDialog("Are you sure?", "notice", "Are you sure that you want to delete the world '" + worldsMultiplayer[i].name + "'?", [ // TODO
                        {
                            "type": "cancel",
                            "content": "Cancel"
                        },
                        {
                            "type": "confirm",
                            "content": "Confirm Deletion"
                        }
                    ], [], () => {
                        // DELETE WORLD HERE
                    });
                },
                "more": {
                    "actionsList": [
                        minecraftVersions.indexOf(instanceInfo.vanilla_version) >= minecraftVersions.indexOf("1.3") || !minecraftVersions ? {
                            "title": translate("app.worlds.play"),
                            "icon": '<i class="fa-solid fa-play"></i>',
                            "func": async () => {
                                await playMultiplayerWorld(instanceInfo, worldsMultiplayer[i].ip);
                                showSpecificInstanceContent(instanceInfo, 'worlds');
                            }
                        } : null,
                        {
                            "title": translate("app.worlds.share"),
                            "icon": '<i class="fa-solid fa-share"></i>',
                            "func": () => { }
                        },
                        {
                            "title": translate("app.worlds.delete"),
                            "icon": '<i class="fa-solid fa-trash-can"></i>',
                            "danger": true,
                            "func": () => {
                                let dialog = new Dialog();
                                dialog.showDialog("Are you sure?", "notice", "Are you sure that you want to delete the world '" + worldsMultiplayer[i].name + "'?", [ // TODO
                                    {
                                        "type": "cancel",
                                        "content": "Cancel"
                                    },
                                    {
                                        "type": "confirm",
                                        "content": "Confirm Deletion"
                                    }
                                ], [], () => {
                                    // DELETE WORLD HERE
                                });
                            }
                        }
                    ].filter(e => e)
                }
            });
    }

    let contentListWrap = document.createElement("div");
    let contentList = new ContentList(contentListWrap, worldList, searchBar, {
        "checkbox": {
            "enabled": true,
            "actionsList": null
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
    }, dropdownInfo);
    element.appendChild(contentListWrap);
}
function setInstanceTabContentLogs(instanceInfo, element) {
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
            lineElement.innerHTML = "No live game detected for this instance."; //TODO
            lineElement.classList.add("log-entry");
            logs.push({ "element": lineElement, "content": "No live game detected for this instance." });
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
                } else if (e.includes("ERROR") || e.includes("at ") || e.includes("Error:") || e.includes("Caused by:") || e.includes("Exception")) {
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
                    } else if (e.includes("ERROR") || e.includes("at ") || e.includes("Error:") || e.includes("Caused by:") || e.includes("Exception")) {
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
    logDisplay.onscroll = render;
    let dropdownInfo = new SearchDropdown(translate("app.logs.session"), [{ "name": "Live Log", "value": "live_log" }].concat(log_info.map((e) => ({ "name": formatDateAndTime(e.date), "value": e.file_path }))), typeDropdown, "live_log", (e) => {
        try {
            window.electronAPI.stopWatching(instanceInfo.current_log_file);
        } catch (e) { }

        if (e == "live_log") {
            setUpLiveLog();
        } else {
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
                } else if (e.includes("ERROR") || e.includes("at ") || e.includes("Error:") || e.includes("Caused by:") || e.includes("Exception")) {
                    lineElement.classList.add("log-error");
                }
                logs.push({ "element": lineElement, "content": e });
            });
        }
        render();
    });
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
    setUpLiveLog();
    render();
    // let wordWrapToggle = document.createElement("button");
    // let actualToggle = new Toggle(wordWrapToggle, (e) => {
    //     if (e) {
    //         logDisplay.classList.add("word-wrap");
    //     } else {
    //         logDisplay.classList.remove("word-wrap");
    //     }
    // }, true);
    // let wordWrapLabel = document.createElement("div");
    // wordWrapLabel.innerHTML = "Word Wrap";
    let copyButton = document.createElement("button");
    let shareButton = document.createElement("button");
    let deleteButton = document.createElement("button");
    copyButton.className = "logs-copy";
    shareButton.className = "logs-share";
    deleteButton.className = "logs-delete";
    copyButton.innerHTML = '<i class="fa-solid fa-copy"></i>Copy';
    shareButton.innerHTML = '<i class="fa-solid fa-share"></i>Share';
    deleteButton.innerHTML = '<i class="fa-solid fa-trash-can"></i>Delete';
    copyButton.onclick = () => {
        let showLogs = logs.filter(e => e.content.toLowerCase().includes(searchBarFilter));
        let copyLogs = showLogs.map(e => e.content).join("\n");
        navigator.clipboard.writeText(copyLogs).then(() => {
            displaySuccess(searchBarFilter ? "Logs copied to clipbard! (Only those that match the current search)" : "Logs copied to clipboard!");
        }).catch(() => {
            displayError("Failed to copy logs to clipboard.");
        });
    }
    // logTop.appendChild(wordWrapToggle);
    // logTop.appendChild(wordWrapLabel);
    logTop.appendChild(copyButton);
    logTop.appendChild(shareButton);
    logTop.appendChild(deleteButton);
    logDisplay.className = "logs-display";
    // logDisplay.classList.add("word-wrap");
}
function setInstanceTabContentOptions(instanceInfo, element) {
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
    let dropdownInfo = new SearchDropdown("Option Type", [
        {
            "name": "All",
            "value": "all"
        },
        {
            "name": "Number",
            "value": "number"
        },
        {
            "name": "Text",
            "value": "text"
        },
        {
            "name": "Boolean",
            "value": "boolean"
        },
        {
            "name": "Key",
            "value": "key"
        },
        {
            "name": "Other",
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
    info.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>Changing these settings while the game is open may not function correctly.';
    info.className = "info";
    info.style.marginTop = "10px";
    element.appendChild(info);
    let info2 = document.createElement("div");
    info2.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>The launcher will attempt to apply any default settings to any new instance you create, regardless of version. It is then up to Minecraft to correctly parse and use those settings.';
    info2.className = "info";
    info2.style.marginTop = "10px";
    element.appendChild(info2);
    let optionList = document.createElement("div");
    optionList.className = "option-list";
    element.appendChild(optionList);
    let selectedKeySelect;
    let selectedKeySelectFunction;
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
                displaySuccess("Updated options.txt!");
                if (selectedKeySelectFunction) selectedKeySelectFunction(keyCode ? keyCode : "key.keyboard.unknown");
            } catch (e) {
                displayError("Unable to update options.txt");
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
                displaySuccess("Updated options.txt!");
                if (selectedKeySelectFunction) selectedKeySelectFunction(mouseKey);
            } catch (e) {
                displayError("Unable to update options.txt");
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
                setDefaultButton.innerHTML = '<i class="fa-solid fa-minus"></i>Remove Default';
                setDefaultButton.onclick = onRemove;
            } else {
                setDefaultButton.innerHTML = '<i class="fa-solid fa-plus"></i>Set Default';
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
                    displaySuccess("Updated options.txt!");
                    values[i].value = '"' + inputElement.value + '"';
                    oldvalue = inputElement.value;
                    onChange(inputElement.value);
                } catch (e) {
                    displayError("Unable to update options.txt");
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
                    displaySuccess("Updated options.txt!");
                    values[i].value = inputElement.value;
                    oldvalue = inputElement.value;
                    onChange(inputElement.value);
                } catch (e) {
                    displayError("Unable to update options.txt");
                    inputElement.value = oldvalue;
                    values[i].value = oldvalue;
                }
            }
            item.appendChild(inputElement);
        } else if (type == "boolean") {
            let inputElement1 = document.createElement("div");
            inputElement1.className = "option-input";
            inputElement = new SearchDropdown("", [{ "name": "True", "value": "true" }, { "name": "False", "value": "false" }], inputElement1, e.value, (v) => {
                try {
                    window.electronAPI.updateOptionsTXT(instanceInfo.instance_id, e.key, v);
                    displaySuccess("Updated options.txt!");
                    values[i].value = v;
                    oldvalue = v;
                    onChange(v);
                } catch (e) {
                    displayError("Unable to update options.txt");
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
                    displaySuccess("Updated options.txt!");
                    values[i].value = inputElement.value;
                    oldvalue = inputElement.value;
                    onChange(inputElement.value);
                } catch (e) {
                    displayError("Unable to update options.txt");
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
        setDefaultButton.innerHTML = '<i class="fa-solid fa-plus"></i>Set Default';

        let onSet = () => {
            defaultOptions.setDefault(e.key, type == "text" ? '"' + inputElement.value + '"' : inputElement.value);
            setDefaultButton.innerHTML = '<i class="fa-solid fa-minus"></i>Remove Default';
            setDefaultButton.onclick = onRemove;
            displaySuccess("Default value of " + e.key + " set to " + inputElement.value);
        }

        setDefaultButton.onclick = onSet;

        let onRemove = () => {
            defaultOptions.deleteDefault(e.key);
            setDefaultButton.innerHTML = '<i class="fa-solid fa-plus"></i>Set Default';
            setDefaultButton.onclick = onSet;
            displaySuccess("Default value of " + e.key + " removed");
        }

        if (defaultOptions.getDefault(e.key) == e.value) {
            setDefaultButton.innerHTML = '<i class="fa-solid fa-minus"></i>Remove Default';
            setDefaultButton.onclick = onRemove;
        }

        item.appendChild(setDefaultButton);

        if (e.key == "version" && Number(e.value) != instanceInfo.attempted_options_txt_version) {
            defaultOptions.setDefault(e.key, e.value);
            setDefaultButton.remove();
            inputElement.style.gridColumn = "span 2";
            inputElement.style.opacity = ".5";
            inputElement.style.cursor = "not-allowed";
            inputElement.disabled = true;
        }

        optionList.appendChild(item);
    };
}
function setInstanceTabContentScreenshots(instanceInfo, element) {
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
            displayScreenshot(formatDateAndTime(e.file_name), e.file_path, instanceInfo, element, screenshotInformation, screenshotInformation.map(e => e.file).indexOf(e.file_path));
        }
        let buttons = new ContextMenuButtons([
            {
                "icon": '<i class="fa-solid fa-folder"></i>',
                "title": "Open in Folder",
                "func": (e) => {
                    window.electronAPI.openFolder(`./minecraft/instances/${instanceInfo.instance_id}/screenshots`);
                }
            },
            {
                "icon": '<i class="fa-solid fa-image"></i>',
                "title": "Open Photo",
                "func": () => {
                    window.electronAPI.openFolder(e.file_path);
                }
            },
            {
                "icon": '<i class="fa-solid fa-copy"></i>',
                "title": "Copy Screenshot",
                "func": () => {
                    let success = window.electronAPI.copyImageToClipboard(e.file_path);
                    if (success) {
                        displaySuccess("Screenshot copied to clipboard!");
                    } else {
                        displayError("Failed to copy to clipboard");
                    }
                }
            },
            {
                "icon": '<i class="fa-solid fa-share"></i>',
                "title": "Share Screenshot",
                "func": (e) => { }
            },
            {
                "icon": '<i class="fa-solid fa-trash-can"></i>',
                "title": "Delete Screenshot",
                "func": () => {
                    let success = window.electronAPI.deleteScreenshot(e.file_path);
                    if (success) {
                        displaySuccess("Screenshot deleted!");
                    } else {
                        displayError("Failed to delete screenshot");
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
}

function displayScreenshot(name, file, instanceInfo, element, list, currentIndex) {
    let index = currentIndex;
    let buttonLeft = document.createElement("button");
    buttonLeft.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
    buttonLeft.className = "screenshot-arrow";
    let changeDisplay = (name, file) => {
        screenshotAction2.onclick = () => {
            window.electronAPI.openFolder(file);
        };
        screenshotAction3.onclick = () => {
            let success = window.electronAPI.copyImageToClipboard(file);
            if (success) {
                displaySuccess("Screenshot copied to clipboard!");
            } else {
                displayError("Failed to copy to clipboard");
            }
        };
        screenshotAction5.onclick = () => {
            let success = window.electronAPI.deleteScreenshot(file);
            if (success) {
                screenshotPreview.close();
                displaySuccess("Screenshot deleted!");
            } else {
                displayError("Failed to delete screenshot");
            }
            setInstanceTabContentScreenshots(instanceInfo, element);
        };
        screenshotTitle.innerHTML = sanitize(name);
        screenshotDisplay.src = file;
        screenshotDisplay.alt = sanitize(name);
    }
    let shiftLeft = () => {
        index--;
        if (index < 0) index = list.length - 1;
        changeDisplay(list[index].name, list[index].file);
    }
    let shiftRight = () => {
        index++;
        if (index > list.length - 1) index = 0;
        changeDisplay(list[index].name, list[index].file);
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
    let screenshotDisplay = document.createElement("img");
    screenshotDisplay.className = "screenshot-display";
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
    let screenshotActions = document.createElement("div");
    screenshotActions.className = "screenshot-actions";
    screenshotInfo.appendChild(screenshotActions);
    let screenshotWrapper = document.createElement("div");
    screenshotWrapper.className = "screenshot-wrapper";
    screenshotPreview.innerHTML = '';
    let screenshotAction1 = document.createElement("button");
    screenshotAction1.className = "screenshot-action";
    screenshotAction1.innerHTML = '<i class="fa-solid fa-folder"></i>Open in Folder';
    screenshotAction1.onclick = () => {
        window.electronAPI.openFolder(`./minecraft/instances/${instanceInfo.instance_id}/screenshots`);
    };
    screenshotActions.appendChild(screenshotAction1);
    let screenshotAction2 = document.createElement("button");
    screenshotAction2.className = "screenshot-action";
    screenshotAction2.innerHTML = '<i class="fa-solid fa-image"></i>Open Photo';
    screenshotActions.appendChild(screenshotAction2);
    let screenshotAction3 = document.createElement("button");
    screenshotAction3.className = "screenshot-action";
    screenshotAction3.innerHTML = '<i class="fa-solid fa-copy"></i>Copy Screenshot';
    screenshotActions.appendChild(screenshotAction3);
    let screenshotAction4 = document.createElement("button");
    screenshotAction4.className = "screenshot-action";
    screenshotAction4.innerHTML = '<i class="fa-solid fa-share"></i>Share Screenshot';
    screenshotAction4.onclick = () => {

    };
    screenshotActions.appendChild(screenshotAction4);
    let screenshotAction5 = document.createElement("button");
    screenshotAction5.className = "screenshot-action";
    screenshotAction5.innerHTML = '<i class="fa-solid fa-trash-can"></i>Delete Screenshot';
    screenshotActions.appendChild(screenshotAction5);
    screenshotWrapper.appendChild(buttonLeft);
    screenshotWrapper.appendChild(screenshotDisplay);
    screenshotWrapper.appendChild(buttonRight);
    screenshotWrapper.appendChild(screenshotInfo);
    screenshotPreview.appendChild(screenshotWrapper);
    changeDisplay(name, file);
    screenshotPreview.showModal();
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
        pid = await window.electronAPI.playMinecraft(instInfo.loader, instInfo.vanilla_version, instInfo.loader_version, instInfo.instance_id, data.getDefaultProfile(), quickPlay, { "width": instInfo.window_width ? instInfo.window_width : 854, "height": instInfo.window_height ? instInfo.window_height : 480 }, instInfo.allocated_ram ? instInfo.allocated_ram : 4096, instInfo.java_path);
        if (!pid) return;
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
    return await window.electronAPI.killProcess(instInfo.pid);
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

function formatDate(dateString) {
    let months = [translate("app.date.jan"), translate("app.date.feb"), translate("app.date.mar"), translate("app.date.apr"), translate("app.date.may"), translate("app.date.jun"), translate("app.date.jul"), translate("app.date.aug"), translate("app.date.sep"), translate("app.date.oct"), translate("app.date.nov"), translate("app.date.dec")];
    let date = new Date(dateString);
    if (isNaN(date.getTime()) || date.getFullYear() < 2000) {
        return "Never Played";
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
    return JSON.parse(window.electronAPI.readFile(`./lang/${locale}.json`));
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

function translate(key) {
    if (!lang) {
        lang = getLangFile("en-us");
    }
    return sanitize(lang[key]);
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

    while (i < text.length) {
        if (text[i] === '§' && i + 1 < text.length) {
            const code = text[i + 1].toLowerCase();
            i += 2;

            if (colorCodes[code]) {
                currentClasses = [colorCodes[code]];
            } else if (formatCodes[code]) {
                currentClasses.push(formatCodes[code]);
            } else if (code === 'r') {
                currentClasses = [];
            }
            continue;
        }

        const span = `<span class="${currentClasses.join(' ')}">${text[i]}</span>`;
        result += span;
        i++;
    }

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
        this.element = element;
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
        throw new Error("Unknown Loader");
    }
}

class VersionList {
    constructor() { }
    async getVersions(loader) {
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
        uploadButton.innerHTML = '<i class="fa-solid fa-arrow-up-from-bracket"></i>Upload Image';
        removeButton.innerHTML = '<i class="fa-solid fa-trash-can"></i>Remove Image'
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
            if (e.checkbox.checked && isNotDisplayNone(e.checkbox)) {
                vals.push(e.val);
            }
        });
        return vals;
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
    showDialog(title, type, info, buttons, tabs, onsubmit) {
        let element = document.createElement("dialog");
        element.className = "dialog";
        element.oncancel = (e) => {
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
            realDialogContent.innerHTML = "<span>" + (info) + "</span>";
        } else if (type == "form") {
            for (let i = 0; i < info.length; i++) {
                let tab = info[i].tab ?? "default";
                if (info[i].type == "notice") {
                    let textElement = document.createElement("div");
                    textElement.innerHTML = (info[i].content);
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
                            console.log(textInput.value, "CHANGED!!!!!");
                            onchange(textInput.value);
                        }
                    }
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
                                    displayError("Failed to load info: " + (err && err.message ? err.message : err));
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
                    let label = document.createElement("label");
                    label.innerHTML = sanitize(info[i].name);
                    label.className = "dialog-label";
                    let toggleEle = document.createElement("button");
                    let toggle = new Toggle(toggleEle, () => { }, info[i].default ?? false);
                    let wrapper = document.createElement("div");
                    wrapper.className = "dialog-text-label-wrapper-horizontal";
                    contents[tab].appendChild(wrapper);
                    wrapper.appendChild(toggleEle);
                    wrapper.appendChild(label);
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
                        for (let j = 0; j < this.values.length; j++) {
                            if (this.values[j].id != info[i].input_source) continue;
                            // Use a token to ensure only the latest async result is displayed
                            let updateToken = 0;
                            this.values[j].element.addOnChange(async () => {
                                const currentToken = ++updateToken;
                                let oldValue = multiSelect.value;
                                let value = this.values[j].element.value;
                                label.innerHTML = "Loading...";
                                multiSelect.setOptions([{ "name": "Loading...", "value": "loading" }], "loading");
                                try {
                                    let list = await info[i].source(value);
                                    // Only update if this is the latest request
                                    if (currentToken !== updateToken) return;
                                    if (label.innerHTML != "Loading...") return;
                                    if (list.length && typeof list[0] === "object" && list[0] !== null && "name" in list[0] && "value" in list[0]) {
                                        multiSelect.setOptions(list, list.map(e => e.value).includes(oldValue) ? oldValue : list.map(e => e.value).includes(info[i].default) ? info[i].default : list[0]?.value);
                                    } else {
                                        multiSelect.setOptions(list.map(e => ({ "name": e, "value": e })), list.includes(oldValue) ? oldValue : list.includes(info[i].default) ? info[i].default : list[0]);
                                    }
                                    if (multiSelect.onchange) multiSelect.onchange();
                                    label.innerHTML = sanitize(info[i].name);
                                } catch (err) {
                                    if (currentToken !== updateToken) return;
                                    displayError("Failed to load list: " + (err && err.message ? err.message : err));
                                    if (multiSelect.onchange) multiSelect.onchange();
                                    label.innerHTML = sanitize("Unable to Load " + info[i].name);
                                    multiSelect.setOptions([{ "name": "Unable to Load", "value": "loading" }], "loading");
                                }
                            });
                            let setInitialValues = async () => {
                                const currentToken = ++updateToken;
                                let oldValue = multiSelect.value;
                                let value = this.values[j].element.value;
                                label.innerHTML = "Loading...";
                                multiSelect.setOptions([{ "name": "Loading...", "value": "loading" }], "loading");
                                try {
                                    let list = await info[i].source(value);
                                    if (currentToken !== updateToken) return;
                                    if (label.innerHTML != "Loading...") return;
                                    if (list.length && typeof list[0] === "object" && list[0] !== null && "name" in list[0] && "value" in list[0]) {
                                        multiSelect.setOptions(list, list.map(e => e.value).includes(oldValue) ? oldValue : list.map(e => e.value).includes(info[i].default) ? info[i].default : list[0]?.value);
                                    } else {
                                        multiSelect.setOptions(list.map(e => ({ "name": e, "value": e })), list.includes(oldValue) ? oldValue : list.includes(info[i].default) ? info[i].default : list[0]);
                                    }
                                    if (multiSelect.onchange) multiSelect.onchange();
                                    label.innerHTML = sanitize(info[i].name);
                                } catch (err) {
                                    if (currentToken !== updateToken) return;
                                    displayError("Failed to load list: " + (err && err.message ? err.message : err));
                                    if (multiSelect.onchange) multiSelect.onchange();
                                    label.innerHTML = sanitize("Unable to Load " + info[i].name);
                                    multiSelect.setOptions([{ "name": "Unable to Load", "value": "loading" }], "loading");
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
                                label.innerHTML = "Loading...";
                                multiSelect.setOptions([{ "name": "Loading...", "value": "loading" }], "loading");
                                try {
                                    let list = await getVersions(loaderElement.value, value);
                                    // Only update if this is the latest request
                                    if (currentToken !== updateToken) return;
                                    if (label.innerHTML != "Loading...") return;
                                    multiSelect.setOptions(list.map(e => ({ "name": e, "value": e })), list.includes(oldValue) ? oldValue : list.includes(info[i].default) ? info[i].default : list[0]);
                                    label.innerHTML = loaders[loaderElement.value] + " Version";
                                } catch (err) {
                                    if (currentToken !== updateToken) return;
                                    displayError("Failed to load list: " + (err && err.message ? err.message : err));
                                    label.innerHTML = sanitize("Unable to Load " + info[i].name);
                                    multiSelect.setOptions([{ "name": "Unable to Load", "value": "loading" }], "loading");
                                }
                            });
                            let setInitialValues = async () => {
                                const currentToken = ++updateToken;
                                wrapper.style.display = loaderElement.value == "vanilla" ? "none" : "";
                                if (loaderElement.value == "vanilla") return;
                                let oldValue = multiSelect.value;
                                let value = this.values[j].element.value;
                                if (value == "loading") return;
                                label.innerHTML = "Loading...";
                                multiSelect.setOptions([{ "name": "Loading...", "value": "loading" }], "loading");
                                try {
                                    let list = await getVersions(loaderElement.value, value);
                                    if (currentToken !== updateToken) return;
                                    if (label.innerHTML != "Loading...") return;
                                    multiSelect.setOptions(list.map(e => ({ "name": e, "value": e })), list.includes(oldValue) ? oldValue : list.includes(info[i].default) ? info[i].default : list[0]);
                                    label.innerHTML = loaders[loaderElement.value] + " Version";
                                } catch (err) {
                                    if (currentToken !== updateToken) return;
                                    displayError("Failed to load list: " + (err && err.message ? err.message : err));
                                    label.innerHTML = sanitize("Unable to Load " + info[i].name);
                                    multiSelect.setOptions([{ "name": "Unable to Load", "value": "loading" }], "loading");
                                }
                            }
                            setInitialValues();
                        }
                    }
                    this.values.push({ "id": info[i].id, "element": multiSelect });
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
                    setTimeout(() => {
                        this.element.remove();
                    }, 1000);
                }
            } else if (buttons[i].type == "confirm") {
                buttonElement.classList.add("confirm");
                buttonElement.onclick = () => {
                    let info = this.values.map(e => ({ "id": e.id, "value": e.element.value }));
                    info.push({ "id": "selected_tab", "value": selectedTab });
                    onsubmit(info);
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
    added_vt_dp_packs = [];
    added_vt_rp_packs = [];
    content.innerHTML = "";
    let titleTop = document.createElement("div");
    titleTop.className = "title-top";
    let backButton = document.createElement("button");
    backButton.innerHTML = '<i class="fa-solid fa-arrow-left"></i>Back to Instance';
    backButton.className = "back-button";
    backButton.onclick = () => {
        showSpecificInstanceContent(new Instance(instance_id), default_tab == "world" ? "worlds" : "content");
    }
    let title = document.createElement("h1");
    title.innerHTML = "Add Content";
    titleTop.appendChild(title);
    if (instance_id) titleTop.appendChild(backButton);
    if (!instance_id) title.innerHTML = "Discover";
    let ele = document.createElement("div");
    ele.classList.add("instance-content");
    ele.appendChild(titleTop);
    content.appendChild(ele);
    let tabsElement = document.createElement("div");
    ele.appendChild(tabsElement);
    let tabs = new TabContent(tabsElement, [
        !instance_id ? {
            "name": "Modpacks",
            "value": "modpack",
            "func": () => {
                contentTabSelect("modpack", tabInfo, loader, vanilla_version, instance_id);
            }
        } : null,
        !loader || loader != "vanilla" ? {
            "name": "Mods",
            "value": "mod",
            "func": () => {
                contentTabSelect("mod", tabInfo, loader, vanilla_version, instance_id);
            }
        } : null,
        {
            "name": "Resource Packs",
            "value": "resourcepack",
            "func": () => {
                contentTabSelect("resourcepack", tabInfo, loader, vanilla_version, instance_id);
            }
        },
        !loader || loader != "vanilla" ? {
            "name": "Shaders",
            "value": "shader",
            "func": () => {
                contentTabSelect("shader", tabInfo, loader, vanilla_version, instance_id);
            }
        } : null,
        {
            "name": "Worlds",
            "value": "world",
            "func": () => {
                contentTabSelect("world", tabInfo, loader, vanilla_version, instance_id);
            }
        },
        // {
        //     "name": "Servers",
        //     "value": "servers",
        //     "func": () => {
        //         contentTabSelect("server", tabInfo, loader, vanilla_version, instance_id);
        //     }
        // },
        {
            "name": "Data Packs",
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
}

class ContentSearchEntry {
    constructor(title, author, description, downloadCount, imageURL, installContent, installFunction, tags, infoData, id) {
        let element = document.createElement("div");
        element.className = "discover-item";
        this.element = element;
        if (id) element.id = id;
        let image = document.createElement("img");
        image.src = imageURL ? imageURL : "default.png";
        image.className = "discover-item-image";
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
        let authorElement = document.createElement("div");
        authorElement.className = "discover-item-author";
        authorElement.innerHTML = `<div>by ${sanitize(author)}</div>`;
        top.appendChild(authorElement);
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
        if (downloadCount) {
            let downloadCountElement = document.createElement("div");
            downloadCountElement.innerHTML = /*'<i class="fa-solid fa-download"></i> ' + */sanitize(formatNumber(downloadCount)) + " downloads";
            downloadCountElement.className = "discover-item-downloads";
            actions.appendChild(downloadCountElement);
        }
        let installButton = document.createElement("button");
        installButton.className = "discover-item-install";
        installButton.innerHTML = installContent;
        installButton.onclick = () => {
            installFunction(infoData, installButton);
        }
        actions.appendChild(installButton);
    }
}

function formatNumber(num) {
    num = num.toString();
    let output = "";
    let counter = 0;
    for (let i = num.length - 1; i >= 0; i--) {
        if (counter % 3 == 0 && counter != 0) {
            output = "," + output;
        }
        output = num[i] + output;
        counter++;
    }
    return output;
}

function contentTabSelect(tab, ele, loader, version, instance_id) {
    let tabsElement = document.createElement("div");
    ele.innerHTML = '';
    let sources = [];
    ele.appendChild(tabsElement);
    if (tab == "modpack" || tab == "mod" || tab == "resourcepack" || tab == "shader" || tab == "datapack") {
        sources.push({
            "name": "Modrinth",
            "value": "modrinth",
            "func": () => { }
        });
    }
    if (tab == "modpack" || tab == "mod" || tab == "resourcepack" || tab == "shader" || tab == "world" || tab == "datapack" || tab == "server") {
        sources.push({
            "name": "CurseForge",
            "value": "curseforge",
            "func": () => { }
        });
    }
    if (tab == "resourcepack" || tab == "datapack") {
        sources.push({
            "name": "Vanilla Tweaks",
            "value": "vanilla_tweaks",
            "func": () => { }
        });
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
    let dropdownElement = document.createElement("div");
    dropdownElement.style.minWidth = "200px";
    let d = new SearchDropdown("Content Source", sources, dropdownElement, sources[0].value, () => {
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
    constructor(currentPage, totalPages, change_page_function, d1opt, d1def, d1func, d2opt, d2def, d2func) {
        let element = document.createElement("div");
        element.className = "page-container";
        this.element = element;
        let leftArrow = document.createElement("button");
        leftArrow.className = "page";
        leftArrow.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
        if (currentPage <= 1) {
            leftArrow.classList.add("disabled");
        } else {
            leftArrow.onclick = () => {
                change_page_function(currentPage - 1);
            }
        }
        let rightArrow = document.createElement("button");
        rightArrow.className = "page";
        rightArrow.innerHTML = '<i class="fa-solid fa-chevron-right"></i>';
        if (currentPage >= totalPages) {
            rightArrow.classList.add("disabled");
        } else {
            rightArrow.onclick = () => {
                change_page_function(currentPage + 1);
            }
        }
        let currentPageEle = document.createElement("button");
        currentPageEle.innerHTML = currentPage;
        currentPageEle.className = "page";
        currentPageEle.classList.add("selected");
        let gap = 0;
        if (d1opt) {
            let dropdownEle = document.createElement("div");
            dropdownEle.style.width = "150px";
            let dropdown = new SearchDropdown("Sort by", d1opt, dropdownEle, d1def, d1func);
            element.appendChild(dropdownEle);
        }
        if (d2opt) {
            let dropdownEle = document.createElement("div");
            dropdownEle.style.marginRight = "auto";
            dropdownEle.style.width = "75px";
            let dropdown = new SearchDropdown("View", d2opt, dropdownEle, d2def, d2func);
            element.appendChild(dropdownEle);
        }
        element.appendChild(leftArrow);
        for (let i = 1; i <= totalPages; i++) {
            if (i == currentPage) {
                element.appendChild(currentPageEle);
            } else if (i == 1 || i == totalPages || i == currentPage + 1 || i == currentPage - 1 || totalPages <= 6) {
                let pageElement = document.createElement("button");
                pageElement.innerHTML = i;
                pageElement.className = "page";
                pageElement.onclick = () => {
                    change_page_function(i);
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
    element.innerHTML = "";
    let loading = new LoadingContainer();
    element.appendChild(loading.element);
    console.log("getting content for source", source);
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
        }, [
            {
                "name": "Relevance",
                "value": "relevance"
            },
            {
                "name": "Downloads",
                "value": "downloads"
            },
            {
                "name": "Created",
                "value": "newest"
            },
            {
                "name": "Last Updated",
                "value": "updated"
            }
        ], sortBy, (v) => {
            getContent(element, instance_id, source, query, loader, version, project_type, vt_version, 1, pageSize, v);
        }, [
            {
                "name": "5",
                "value": "5"
            },
            {
                "name": "10",
                "value": "10"
            },
            {
                "name": "15",
                "value": "15"
            },
            {
                "name": "20",
                "value": "20"
            },
            {
                "name": "50",
                "value": "50"
            },
            {
                "name": "100",
                "value": "100"
            }
        ], pageSize.toString(), (v) => {
            getContent(element, instance_id, source, query, loader, version, project_type, vt_version, 1, Number(v), sortBy);
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
            let entry = new ContentSearchEntry(e.title, e.author, e.description, e.downloads, e.icon_url, '<i class="fa-solid fa-download"></i>Install', project_type == "modpack" ? (i) => {
                let options = [];
                i.categories.forEach((e) => {
                    if (loaders[e]) {
                        options.push({ "name": loaders[e], "value": e })
                    }
                })
                let dialog = new Dialog();
                dialog.showDialog(translate("app.button.instances.create"), "form", [
                    {
                        "type": "image-upload",
                        "id": "icon",
                        "name": "Icon", //TODO: replace with translate
                        "default": i.icon_url
                    },
                    {
                        "type": "text",
                        "name": "Name", //TODO
                        "id": "name",
                        "default": i.title
                    },
                    {
                        "type": "dropdown",
                        "name": "Game Version", //TODO
                        "id": "game_version",
                        "options": i.versions.map(e => ({ "name": e, "value": e })).reverse()
                    },
                    {
                        "type": "dropdown",
                        "name": "Mod Loader", //TODO
                        "id": "loader",
                        "options": options
                    }
                ], [
                    { "content": "Cancel", "type": "cancel" },
                    { "content": "Submit", "type": "confirm" }
                ], [], async (e) => {
                    let info = {};
                    e.forEach(e => { info[e.id] = e.value });
                    let instance_id = window.electronAPI.getInstanceFolderName(info.name.replace(/[#<>:"/\\|?*\x00-\x1F]/g, "_").toLowerCase());
                    let res = await fetch(`https://api.modrinth.com/v2/project/${i.project_id}/version`);
                    let version_json = await res.json();
                    let version = {};
                    for (let j = 0; j < version_json.length; j++) {
                        if (version_json[j].game_versions.includes(info.game_version) && version_json[j].loaders.includes(info.loader)) {
                            version = version_json[j];
                            break;
                        }
                    }
                    if (!version.files) {
                        displayError(`Error: Could not find version of '${i.title}' that is version ${info.game_version} and uses loader ${loaders[info.loader]}`);
                        return;
                    }
                    let instance = data.addInstance(info.name, new Date(), new Date(), "", info.loader, info.game_version, "", false, true, "", info.icon, instance_id, 0, "modrinth", i.project_id, true, false);
                    showSpecificInstanceContent(instance);
                    await window.electronAPI.downloadModrinthPack(instance_id, version.files[0].url, i.title);
                    let mr_pack_info = await window.electronAPI.processMrPack(instance_id, `./minecraft/instances/${instance_id}/pack.mrpack`, info.loader, i.title);
                    if (!mr_pack_info.loader_version) {
                        displayError(mr_pack_info);
                        return;
                    }
                    instance.setLoaderVersion(mr_pack_info.loader_version);
                    mr_pack_info.content.forEach(e => {
                        instance.addContent(e.name, e.author, e.image, e.file_name, e.source, e.type, e.version, e.source_id, e.disabled);
                    });
                    instance.setInstalling(false);
                    let r = await window.electronAPI.downloadMinecraft(instance_id, info.loader, info.game_version, mr_pack_info.loader_version);
                    instance.setJavaPath(r.java_installation);
                    instance.setJavaVersion(r.java_version);
                    instance.setMcInstalled(true);
                })
            } : instance_id ? async (i, button) => {
                button.innerHTML = '<i class="spinner"></i>Installing...';
                button.classList.add("disabled");
                button.onclick = () => { };
                await installContent("modrinth", i.project_id, instance_id, project_type, i.title, i.author, i.icon_url);
                button.innerHTML = '<i class="fa-solid fa-check"></i>Installed';
            } : (i) => {
                let dialog = new Dialog();
                let instances = data.getInstances();
                dialog.showDialog(`Select Instance to install ${i.title}`, "form", [
                    {
                        "type": "dropdown",
                        "name": "Instance",
                        "id": "instance",
                        "options": project_type == "mod" ? instances.filter(e => i.categories.includes(e.loader)).map(e => ({ "name": i.versions.includes(e.vanilla_version) ? e.name : `${e.name} (Incompatible)`, "value": e.instance_id })) : project_type == "resourcepack" || project_type == "datapack" ? instances.map(e => ({ "name": i.versions.includes(e.vanilla_version) ? e.name : `${e.name} (Incompatible)`, "value": e.instance_id })) : project_type == "shader" ? instances.filter(e => e.loader != "vanilla").map(e => ({ "name": i.versions.includes(e.vanilla_version) ? e.name : `${e.name} (Incompatible)`, "value": e.instance_id })) : instances.map(e => ({ "name": i.versions.includes(e.vanilla_version) ? e.name : `${e.name} (Incompatible)`, "value": e.instance_id }))
                    }
                ], [
                    { "content": "Cancel", "type": "cancel" },
                    { "content": "Submit", "type": "confirm" }
                ], null, async (e) => {
                    let info = {};
                    e.forEach(e => { info[e.id] = e.value });
                    await installContent("modrinth", i.project_id, info.instance, project_type, i.title, i.author, i.icon_url);
                    displaySuccess(`${i.title} installed to instance ${(new Instance(info.instance)).name}`);
                });
            }, e.categories.map(e => formatCategory(e)), e);
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
        pages = Math.ceil(apiresult.pagination.totalCount / pageSize);
        let paginationTop = new Pagination(page, pages, (new_page) => {
            getContent(element, instance_id, source, query, loader, version, project_type, vt_version, new_page, pageSize, sortBy)
        }, [
            {
                "name": "Relevance",
                "value": "relevance"
            },
            {
                "name": "Downloads",
                "value": "downloads"
            },
            {
                "name": "Created",
                "value": "newest"
            },
            {
                "name": "Last Updated",
                "value": "updated"
            }
        ], sortBy, (v) => {
            getContent(element, instance_id, source, query, loader, version, project_type, vt_version, 1, pageSize, v);
        }, [
            {
                "name": "5",
                "value": "5"
            },
            {
                "name": "10",
                "value": "10"
            },
            {
                "name": "15",
                "value": "15"
            },
            {
                "name": "20",
                "value": "20"
            },
            {
                "name": "50",
                "value": "50"
            },
            {
                "name": "100",
                "value": "100"
            }
        ], pageSize.toString(), (v) => {
            getContent(element, instance_id, source, query, loader, version, project_type, vt_version, 1, Number(v), sortBy);
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
            let entry = new ContentSearchEntry(e.name, e.author.username, e.summary, e.downloads, e.thumbnailUrl, '<i class="fa-solid fa-download"></i>Install', project_type == "modpack" ? (i) => {
                let options = [];
                let dialog = new Dialog();
                dialog.showDialog(translate("app.button.instances.create"), "form", [
                    {
                        "type": "image-upload",
                        "id": "icon",
                        "name": "Icon", //TODO: replace with translate
                        "default": e.thumbnailUrl
                    },
                    {
                        "type": "text",
                        "name": "Name", //TODO
                        "id": "name",
                        "default": e.name
                    }
                ], [
                    { "content": "Cancel", "type": "cancel" },
                    { "content": "Submit", "type": "confirm" }
                ], [], async (ed) => {
                    let info = {};
                    ed.forEach(ed => { info[ed.id] = ed.value });
                    let instance_id = window.electronAPI.getInstanceFolderName(info.name.replace(/[#<>:"/\\|?*\x00-\x1F]/g, "_").toLowerCase());
                    let game_flavor = ["", "forge", "", "", "fabric", "quilt", "neoforge"].indexOf(loader);
                    let res = await fetch(`https://www.curseforge.com/api/v1/mods/${e.id}/files?pageIndex=0&pageSize=20&sort=dateCreated&sortDescending=true&removeAlphas=true${project_type == "mod" ? "&gameFlavorId=" + game_flavor : ""}`);
                    let version_json = await res.json();
                    let version = version_json.data[0];
                    let instance = data.addInstance(info.name, new Date(), new Date(), "", "", "", "", false, true, "", info.icon, instance_id, 0, "curseforge", e.id, true, false);
                    showSpecificInstanceContent(instance);
                    await window.electronAPI.downloadCurseforgePack(instance_id, (`https://mediafilez.forgecdn.net/files/${Number(version.id.toString().substring(0, 4))}/${Number(version.id.toString().substring(4, 7))}/${encodeURIComponent(version.fileName)}`), e.name);
                    let mr_pack_info = await window.electronAPI.processCfZip(instance_id, `./minecraft/instances/${instance_id}/pack.zip`, e.id, e.name);
                    if (!mr_pack_info.loader_version) {
                        displayError(mr_pack_info);
                        return;
                    }
                    instance.setLoader(mr_pack_info.loader);
                    instance.setVanillaVersion(mr_pack_info.vanilla_version);
                    instance.setLoaderVersion(mr_pack_info.loader_version);
                    mr_pack_info.content.forEach(e => {
                        instance.addContent(e.name, e.author, e.image, e.file_name, e.source, e.type, e.version, e.source_id, e.disabled);
                    });
                    instance.setInstalling(false);
                    let r = await window.electronAPI.downloadMinecraft(instance_id, mr_pack_info.loader, mr_pack_info.vanilla_version, mr_pack_info.loader_version);
                    instance.setJavaPath(r.java_installation);
                    instance.setJavaVersion(r.java_version);
                    instance.setMcInstalled(true);
                })
            } : instance_id ? async (i, button) => {
                button.innerHTML = '<i class="spinner"></i>Installing...';
                button.classList.add("disabled");
                button.onclick = () => { };
                await installContent("curseforge", i.id, instance_id, project_type, i.name, i.author.username, i.thumbnailUrl);
                button.innerHTML = '<i class="fa-solid fa-check"></i>Installed';
            } : (i) => {
                let dialog = new Dialog();
                let instances = data.getInstances();
                dialog.showDialog(`Select Instance to install ${i.name}`, "form", [
                    {
                        "type": "dropdown",
                        "name": "Instance",
                        "id": "instance",
                        "options": instances.map(e => ({ "name": e.name, "value": e.instance_id }))
                    }
                ], [
                    { "content": "Cancel", "type": "cancel" },
                    { "content": "Submit", "type": "confirm" }
                ], null, async (e) => {
                    let info = {};
                    e.forEach(e => { info[e.id] = e.value });
                    await installContent("curseforge", i.id, info.instance, project_type, i.name, i.author.username, i.thumbnailUrl);
                    displaySuccess(`${i.name} installed to instance ${(new Instance(info.instance)).name}`);
                });
            }, e.categories.map(e => e.name), e);
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
        submitButton.innerHTML = '<i class="fa-solid fa-download"></i>Install Selected Packs';
        submitButton.onclick = instance_id ? async () => {
            submitButton.innerHTML = '<i class="spinner"></i>Installing';
            submitButton.onclick = () => { };
            await window.electronAPI.downloadVanillaTweaksResourcePacks(added_vt_rp_packs, version ? version : vt_version, instance_id);
            // let initialContent = {
            //     "name": "Vanilla Tweaks Resource Pack",
            //     "file_name": "vanilla_tweaks.zip",
            //     "source": "vanilla_tweaks",
            //     "source_id": added_vt_rp_packs,
            //     "disabled": false,
            //     "type": "resource_pack",
            //     "image": "https://vanillatweaks.net/assets/images/logo.png",
            //     "version": "",
            //     "author": "Vanilla Tweaks"
            // }
            let instance = new Instance(instance_id);
            instance.addContent("Vanilla Tweaks Resource Pack", "Vanilla Tweaks", "https://vanillatweaks.net/assets/images/logo.png", "vanilla_tweaks.zip", "vanilla_tweaks", "resource_pack", "", JSON.stringify(added_vt_rp_packs), false);
            submitButton.innerHTML = '<i class="fa-solid fa-check"></i>Installed';
        } : () => {
            let instances = data.getInstances();
            let dialog = new Dialog();
            dialog.showDialog(`Select Instance to install the selected packs`, "form", [
                {
                    "type": "notice",
                    "content": "Selected Packs: " + (project_type == "resourcepack" ? added_vt_rp_packs : added_vt_dp_packs).map(e => e.name).join(", ") + "<br>"
                },
                {
                    "type": "dropdown",
                    "name": "Instance",
                    "id": "instance",
                    "options": instances.map(e => ({ "name": e.name, "value": e.instance_id }))
                }
            ], [
                { "content": "Cancel", "type": "cancel" },
                { "content": "Submit", "type": "confirm" }
            ], null, async (e) => {
                let info = {};
                e.forEach(e => { info[e.id] = e.value });
                await window.electronAPI.downloadVanillaTweaksResourcePacks(added_vt_rp_packs, version ? version : vt_version, info.instance);
                // let initialContent = {
                //     "name": "Vanilla Tweaks Resource Pack",
                //     "file_name": "vanilla_tweaks.zip",
                //     "source": "vanilla_tweaks",
                //     "source_id": added_vt_rp_packs,
                //     "disabled": false,
                //     "type": "resource_pack",
                //     "image": "https://vanillatweaks.net/assets/images/logo.png",
                //     "version": "",
                //     "author": "Vanilla Tweaks"
                // }
                let instance = new Instance(instance_id);
                instance.addContent("Vanilla Tweaks Resource Pack", "Vanilla Tweaks", "https://vanillatweaks.net/assets/images/logo.png", "vanilla_tweaks.zip", "vanilla_tweaks", "resource_pack", "", JSON.stringify(added_vt_rp_packs), false);
            });
        }
        buttonWrapper.append(submitButton);
        element.appendChild(buttonWrapper);
        if (!result.hits || !result.hits.length) {
            let noresults = new NoResultsFound();
            element.appendChild(noresults.element);
            return;
        }
        for (let i = 0; i < result.hits.length; i++) {
            let e = result.hits[i];
            let onAddPack = (info, button) => {
                button.innerHTML = '<i class="fa-solid fa-minus"></i>Remove Pack';
                button.onclick = () => {
                    onRemovePack(info, button);
                }
                displaySuccess(`${e.title} added.<br>Click the button at the top of the page to add the selected packs to an instance.`);
                if (project_type == "resourcepack") {
                    added_vt_rp_packs.push({ "id": info.vt_id, "name": e.title });
                    console.log(added_vt_rp_packs);
                } else if (project_type == "datapack") {
                    added_vt_dp_packs.push({ "id": info.vt_id, "name": e.title });
                    console.log(added_vt_dp_packs);
                }
            }
            let onRemovePack = (info, button) => {
                button.innerHTML = '<i class="fa-solid fa-plus"></i>Add Pack';
                button.onclick = () => {
                    onAddPack(info, button);
                }
                displaySuccess(`${e.title} removed.<br>Click the button at the top of the page to add the selected packs to an instance.`);
                console.log("VT ID: ", info.vt_id)
                if (project_type == "resourcepack") {
                    added_vt_rp_packs = added_vt_rp_packs.filter(e => e.id != info.vt_id);
                    console.log(added_vt_rp_packs);
                } else if (project_type == "datapack") {
                    added_vt_dp_packs = added_vt_dp_packs.filter(e => e.id != info.vt_id);
                    console.log(added_vt_dp_packs);
                }
            }
            let entry = new ContentSearchEntry(e.title, e.author, e.description, e.downloads, e.icon_url, (project_type == "resourcepack" ? added_vt_rp_packs.map(e => e.id).includes(e.vt_id) : added_vt_dp_packs.map(e => e.id).includes(e.vt_id)) ? '<i class="fa-solid fa-minus"></i>Remove Pack' : '<i class="fa-solid fa-plus"></i>Add Pack', (project_type == "resourcepack" ? added_vt_rp_packs.map(e => e.id).includes(e.vt_id) : added_vt_dp_packs.map(e => e.id).includes(e.vt_id)) ? onRemovePack : onAddPack, e.categories, e, "vt-" + e.vt_id);
            element.appendChild(entry.element);
        }
    }
}

async function installContent(source, project_id, instance_id, project_type, title, author, icon_url) {
    let instance = new Instance(instance_id);
    let version_json;
    if (source == "modrinth") {
        let res = await fetch(`https://api.modrinth.com/v2/project/${project_id}/version`);
        version_json = await res.json();
    } else if (source == "curseforge") {
        let game_flavor = ["", "forge", "", "", "fabric", "quilt", "neoforge"].indexOf(instance.loader);
        let res = await fetch(`https://www.curseforge.com/api/v1/mods/${project_id}/files?pageIndex=0&pageSize=100&sort=dateCreated&sortDescending=true&removeAlphas=true${project_type == "mod" ? "&gameFlavorId=" + game_flavor : ""}`);
        version_json = await res.json();
        let dependencies = await fetch(`https://www.curseforge.com/api/v1/mods/${project_id}/dependencies?index=0&pageSize=100`);
        let dependencies_json = await dependencies.json();
        let dependency_list = dependencies_json.data;
        console.log(dependency_list);
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
            "version_number": e.id,
            "dependencies": dependency_list
        }));
    }
    let initialContent = {};
    let version;
    if (instance.getContent().map(e => e.source_id).includes(project_id)) {
        // update content instead
        return;
    }
    let dependencies;
    for (let j = 0; j < version_json.length; j++) {
        if (version_json[j].game_versions.includes(instance.vanilla_version) && (project_type != "mod" || version_json[j].loaders.includes(instance.loader))) {
            initialContent = await addContent(instance_id, project_type, version_json[j].files[0].url, version_json[j].files[0].filename);
            version = version_json[j].version_number;
            dependencies = version_json[j].dependencies;
            break;
        }
    }
    if (!initialContent.type && project_type != "mod" && project_type != "world") {
        for (let j = 0; j < version_json.length; j++) {
            if (project_type != "mod" || version_json[j].loaders.includes(instance.loader)) {
                initialContent = await addContent(instance_id, project_type, version_json[j].files[0].url, version_json[j].files[0].filename);
                version = version_json[j].version_number;
                dependencies = version_json[j].dependencies;
                break;
            }
        }
    }
    if (!initialContent.type) {
        displayError("Error: Unable to install " + title);
        return;
    }
    if (dependencies && source == "modrinth") {
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
            } else {
                let dialog = new Dialog();
                dialog.showDialog("Would you like to install this optional dependency?", "notice", `The content '${title}' that you just installed has an optional dependency. The name of this dependency is '${res_json.title}'. Would you like to install this extra content to the same instance?`, [
                    {
                        "type": "cancel",
                        "content": "No"
                    },
                    {
                        "type": "confirm",
                        "content": "Yes"
                    }
                ], [], () => {
                    installContent(source, dependency.project_id, instance_id, res_json.project_type, res_json.title, author, res_json.icon_url);
                });
            }
        }
    } else if (dependencies && source == "curseforge") {
        console.log("Checking cf dependencies");
        for (let j = 0; j < dependencies.length; j++) {
            let dependency = dependencies[j];
            console.log(dependency.name);
            let project_type = "mod";
            if (dependency.categoryClass.slug == "texture-packs") project_type = "resourcepack";
            if (dependency.categoryClass.slug == "shaders") project_type = "shader";
            if (dependency.type == "RequiredDependency") {
                await installContent(source, dependency.id, instance_id, project_type, dependency.name, dependency.authorName, dependency.logoUrl);
            } else if (dependency.type == "OptionalDependency") {
                let dialog = new Dialog();
                dialog.showDialog("Would you like to install this optional dependency?", "notice", `The content '${title}' that you just installed has an optional dependency. The name of this dependency is '${dependency.name}'. Would you like to install this extra content to the same instance?`, [
                    {
                        "type": "cancel",
                        "content": "No"
                    },
                    {
                        "type": "confirm",
                        "content": "Yes"
                    }
                ], [], () => {
                    installContent(source, dependency.id, instance_id, project_type, dependency.name, dependency.authorName, dependency.logoUrl);
                });
            }
        }
    }
    if (project_type != "world") instance.addContent(title, author, icon_url, initialContent.file_name, source, initialContent.type, version, project_id, false);
}

function formatCategory(e) {
    return toTitleCase(e.replaceAll("-", " "));
}

function toTitleCase(str) {
    return str.replace(/\w\S*/g, function (txt) {
        return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();
    });
}

async function addContent(instance_id, project_type, project_url, filename) {
    return await window.electronAPI.addContent(instance_id, project_type, project_url, filename);
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
        text.innerHTML = "Loading"; //TODO
        this.element = element;
        let index = 1;
        let interval = setInterval(() => {
            text.innerHTML = "Loading" + ".".repeat(index);
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
    constructor() {
        let element = document.createElement("div");
        element.className = "loading-container";
        let question = document.createElement("div");
        question.className = "loading-container-question";
        question.innerHTML = '<i class="fa-solid fa-question"></i>';
        let text = document.createElement("div");
        text.className = "loading-container-text";
        element.appendChild(question);
        element.appendChild(text);
        text.innerHTML = "No Results Found"; //TODO
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
        text.innerHTML = "Installation in Progress"; //TODO
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
if (defaultpage == "home") {
    homeButton.setSelected();
    homeContent.displayContent();
} else if (defaultpage == "instances") {
    instanceButton.setSelected();
    instanceContent.displayContent();
} else if (defaultpage == "discover") {
    worldButton.setSelected();
    worldContent.displayContent();
} else if (defaultpage == "my_account") {
    myAccountButton.setSelected();
    myAccountContent.displayContent();
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
        displaySuccess("Successfully changed cape.");
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
        displaySuccess("Successfully changed skin.");
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
        displayError("Unable to update cape cache");
    }
    try {
        for (const e of skin_and_cape_data.skins) {
            let hash = await window.electronAPI.downloadSkin(e.url);
            let skin = data.addSkin("./minecraft/skins/" + hash + ".png", "<unnamed>", e.variant == "CLASSIC" ? "wide" : "slim", "", hash);
            if (e.state == "ACTIVE") skin.setActive(skin_and_cape_data.uuid);
            else skin.removeActive(skin_and_cape_data.uuid);
        }
    } catch (e) {
        displayError("Unable to update skin cache");
    }
    if (skin_and_cape_data.name) {
        profile.setName(skin_and_cape_data.name);
    }
}

document.getElementsByClassName("toasts")[0].showPopover();