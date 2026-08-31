import { Project, ProjectVersion, ProjectList, ProjectVersionList, Author, GalleryImage, Modrinth, CurseForge, VanillaTweaks } from './api.js';

let lang = null;
document.getElementsByTagName("title")[0].textContent = translate("app.name");

history.scrollRestoration = "manual"

let minecraftVersions = [];

let fetchUpdatedMCVersions = async () => {
    let mcVersions = await window.enderlynx.fetchUpdatedMCVersions();
    minecraftVersions = mcVersions;
}

fetchUpdatedMCVersions();

let accent_colors = ["red", "orange", "yellow", "lime", "green", "light_blue", "cyan", "blue", "purple", "magenta", "pink", "brown", "light_gray", "gray"];

document.body.onmousedown = (e) => {
    if (document.querySelector("dialog[open]")) return;
    if (e.button == 3) Display.pageBackward();
    else if (e.button == 4) Display.pageForward();
}

class DefaultOptions {
    static async getDefault(key) {
        return await window.enderlynx.getDefaultOption(key);
    }

    static async setDefault(key, value) {
        await window.enderlynx.setDefaultOption(key, value, this.version);
    }

    static async deleteDefault(key) {
        await window.enderlynx.deleteDefaultOption(key);
    }
}

class Skin {
    static skins = new Map();
    constructor(skin) {
        if (!skin) return;
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
        this.tag = skin.tag;
    }

    static getSkin(skin_id) {
        if (!this.skins.has(skin_id)) {
            return Skin.applySkin(skin_id, window.enderlynx.getSkin(skin_id));
        }
        return this.skins.get(skin_id);
    }

    static applySkin(skin_id, info) {
        if (!this.skins.has(skin_id)) {
            let newSkin = new Skin(info);
            this.skins.set(skin_id, newSkin);
        }
        return this.skins.get(skin_id);
    }

    async setModel(model) {
        await window.enderlynx.updateSkin("model", model, this.id);
    }

    async setName(name) {
        await window.enderlynx.updateSkin("name", name, this.id);
    }

    async delete() {
        Skin.skins.delete(this.id);
        await window.enderlynx.deleteSkin(this.id);
    }

    async setLastUsed(last_used) {
        await window.enderlynx.updateSkin("last_used", last_used, this.id);
    }

    async setFavorited(favorited) {
        await window.enderlynx.updateSkin("favorited", favorited, this.id);
    }

    async setTextureKey(texture_key) {
        await window.enderlynx.updateSkin("texture_key", texture_key, this.id);
    }

    getPreview(callback) {
        if (this.preview && this.model == this.preview_model) {
            callback(this.preview);
            return;
        }
        renderSkinToDataUrl(this.skin_url, async (v) => {
            await window.enderlynx.updateSkin("preview", v, this.id);
            await window.enderlynx.updateSkin("preview_model", this.model, this.id);
            callback(v);
        }, this.model);
    }

    getHead(callback) {
        if (this.head) {
            callback(this.head);
            return;
        }
        skinToHead(this.skin_url, async (v) => {
            await window.enderlynx.updateSkin("head", v, this.id);
            callback(v);
        });
    }

    async setActive(uuid) {
        await window.enderlynx.setActiveSkin(uuid, this.id);
        this.setLastUsed(new Date());
    }

    async isActive() {
        return await window.enderlynx.isActiveSkin(this.id);
    }
}

class Cape {
    static capes = new Map();
    constructor(cape) {
        if (!cape) return;
        this.id = cape.id;
        this.cape_name = cape.cape_name;
        this.uuid = cape.uuid;
        this.cape_id = cape.cape_id;
        this.cape_url = cape.cape_url;
        this.active = Boolean(cape.active);
    }

    static getCape(cape_id) {
        if (!this.capes.has(cape_id)) {
            return Cape.applyCape(cape_id, window.enderlynx.getCape(cape_id));
        }
        return this.capes.get(cape_id);
    }

    static applyCape(cape_id, info) {
        if (!this.capes.has(cape_id)) {
            let newCape = new Cape(info);
            this.capes.set(cape_id, newCape);
        }
        return this.capes.get(cape_id);
    }

    async setActive() {
        await window.enderlynx.setCapeActive(this.id);
    }

    async removeActive() {
        await window.enderlynx.removeCapeActive(this.id);
    }
}

class Content {
    static content = new Map();

    constructor(content) {
        if (!content) return;
        this.listeners = new Map();
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
    }

    static getContent(content_id) {
        if (!this.content.has(content_id)) {
            return Content.applyContent(content_id, window.enderlynx.getContent(content_id));
        }
        return this.content.get(content_id);
    }

    static applyContent(content_id, info) {
        if (!this.content.has(content_id)) {
            let newContent = new Content(info);
            this.content.set(content_id, newContent);
        }
        return this.content.get(content_id);
    }
    async setName(name) {
        await window.enderlynx.updateContent("name", name, this.id);
    }
    async setAuthor(author) {
        await window.enderlynx.updateContent("author", author, this.id);
    }
    async setDisabled(disabled) {
        await window.enderlynx.updateContent("disabled", disabled, this.id);
    }
    async setImage(image) {
        await window.enderlynx.updateContent("image", image, this.id);
    }
    async setFileName(file_name) {
        await window.enderlynx.updateContent("file_name", file_name, this.id);
    }
    async setSource(source) {
        await window.enderlynx.updateContent("source", source, this.id);
    }
    async setType(type) {
        await window.enderlynx.updateContent("type", type, this.id);
    }
    async setVersion(version) {
        await window.enderlynx.updateContent("version", version, this.id);
    }
    async setVersionId(version_id) {
        await window.enderlynx.updateContent("version_id", version_id, this.id);
    }
    async setInstance(instance) {
        await window.enderlynx.updateContent("instance", instance, this.id);
    }
    async setSourceInfo(source_info) {
        await window.enderlynx.updateContent("source_info", source_info, this.id);
    }

    async delete() {
        Content.content.delete(this.id);
        await window.enderlynx.deleteContentDatabase(this.id);
    }

    watchForChange(key, callback) {
        this.listeners.set(key, callback);
    }
}

window.enderlynx.onInstanceUpdated(async (key, value, instance_id) => {
    let instance = Instance.getInstance(instance_id);
    if (instance[key] instanceof Date) value = Date(value);
    if (typeof instance[key] == 'boolean') value = Boolean(value);
    if (instance?.listeners?.get(key)) {
        instance.listeners.get(key)(value, instance[key]);
    }
    instance[key] = value;
    if (key == "mc_installed" || key == "failed") {
        InstanceStateManagement.calculateInstanceStatus(instance);
    }
});

window.enderlynx.onContentUpdated(async (key, value, content_id) => {
    let content = Content.getContent(content_id);
    if (content[key] instanceof Date) value = Date(value);
    if (typeof content[key] == 'boolean') value = Boolean(value);
    content[key] = value;
    if (content?.listeners?.get(key)) {
        content.listeners.get(key)(value);
    }
});

window.enderlynx.onProfileUpdated(async (key, value, profile_id) => {
    let content = Profile.getProfile(profile_id);
    if (content[key] instanceof Date) value = Date(value);
    if (typeof content[key] == 'boolean') value = Boolean(value);
    content[key] = value;
    if (content?.listeners?.get(key)) {
        content.listeners.get(key)(value);
    }
});

window.enderlynx.onSkinUpdated(async (key, value, skin_id) => {
    let content = Skin.getSkin(skin_id);
    if (content[key] instanceof Date) value = Date(value);
    if (typeof content[key] == 'boolean') value = Boolean(value);
    content[key] = value;
    if (content?.listeners?.get(key)) {
        content.listeners.get(key)(value);
    }
});

window.enderlynx.onCapeUpdated(async (key, value, cape_id) => {
    let content = Cape.getCape(cape_id);
    if (content[key] instanceof Date) value = Date(value);
    if (typeof content[key] == 'boolean') value = Boolean(value);
    content[key] = value;
    if (content?.listeners?.get(key)) {
        content.listeners.get(key)(value);
    }
});

class Instance {
    static instances = new Map();
    static DEFAULT_FILE_EXCLUSIONS = ["exclude", "logs", "*.log", ".fabric", "crash-reports", "debug", "downloads", "*.json", "backups", "temp", "saves", "screenshots", "simplebackups", "*.zip", "*.html", "libraries", "versions", ".mixin.out", ".cache", "*.elpack", "*.mrpack"];

    constructor(content) {
        if (!content) throw new Error("Instance not found");
        this.listeners = new Map();
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
        this.group_id = content.group_id;
        this.image = content.image;
        this.instance_id = content.instance_id;
        this.pid = content.pid;
        this.current_log_file = content.current_log_file;
        this.install_source = content.install_source;
        this.install_id = content.install_id;
        this.installing = Boolean(content.installing);
        this.mc_installed = Boolean(content.mc_installed);
        this.window_width = content.window_width;
        this.window_height = content.window_height;
        this.fullscreen = Boolean(content.fullscreen);
        this.allocated_ram = content.allocated_ram;
        this.java_version = content.java_version;
        this.java_path = content.java_path;
        this.java_args = content.java_args;
        this.env_vars = content.env_vars;
        this.pre_launch_hook = content.pre_launch_hook;
        this.post_launch_hook = content.post_launch_hook;
        this.wrapper = content.wrapper;
        this.post_exit_hook = content.post_exit_hook;
        this.installed_version = content.installed_version;
        this.last_analyzed_log = content.last_analyzed_log;
        this.failed = Boolean(content.failed);
        this.uses_custom_java_args = Boolean(content.uses_custom_java_args);
        this.provided_java_args = content.provided_java_args;
        this.uses_custom_java_installation = Boolean(content.uses_custom_java_installation);
        this.source_server = content.source_server;
        this.uses_custom_window = Boolean(content.uses_custom_window);
        this.uses_custom_allocated_ram = Boolean(content.uses_custom_allocated_ram);
        this.instanceScreen = new InstanceScreen(this);
    }

    static getInstance(instance_id) {
        if (!this.instances.has(instance_id)) {
            return Instance.applyInstance(instance_id, window.enderlynx.getInstance(instance_id));
        }
        return this.instances.get(instance_id);
    }
    static applyInstance(instance_id, info) {
        if (!this.instances.has(instance_id)) {
            let newInstance = new Instance(info);
            this.instances.set(instance_id, newInstance);
        }
        return this.instances.get(instance_id);
    }
    isPinned() {
        return window.enderlynx.isInstancePinned(this.instance_id);
    }
    async setLastAnalyzedLog(last_analyzed_log) {
        await window.enderlynx.updateInstance("last_analyzed_log", last_analyzed_log, this.instance_id);
    }
    async setInstalledVersion(installed_version) {
        await window.enderlynx.updateInstance("installed_version", installed_version, this.instance_id);
    }
    async setJavaArgs(java_args) {
        await window.enderlynx.updateInstance("java_args", java_args, this.instance_id);
    }
    async setEnvVars(env_vars) {
        await window.enderlynx.updateInstance("env_vars", env_vars, this.instance_id);
    }
    async setPreLaunchHook(pre_launch_hook) {
        await window.enderlynx.updateInstance("pre_launch_hook", pre_launch_hook, this.instance_id);
    }
    async setPostLaunchHook(post_launch_hook) {
        await window.enderlynx.updateInstance("post_launch_hook", post_launch_hook, this.instance_id);
    }
    async setWrapper(wrapper) {
        await window.enderlynx.updateInstance("wrapper", wrapper, this.instance_id);
    }
    async setPostExitHook(post_exit_hook) {
        await window.enderlynx.updateInstance("post_exit_hook", post_exit_hook, this.instance_id);
    }
    async setJavaVersion(java_version) {
        await window.enderlynx.updateInstance("java_version", java_version, this.instance_id);
    }
    async setJavaPath(java_path) {
        await window.enderlynx.updateInstance("java_path", java_path, this.instance_id);
    }
    async setWindowWidth(window_width) {
        await window.enderlynx.updateInstance("window_width", window_width, this.instance_id);
    }
    async setWindowHeight(window_height) {
        await window.enderlynx.updateInstance("window_height", window_height, this.instance_id);
    }
    async setFullscreen(fullscreen) {
        await window.enderlynx.updateInstance("fullscreen", fullscreen, this.instance_id);
    }
    async setAllocatedRam(allocated_ram) {
        await window.enderlynx.updateInstance("allocated_ram", allocated_ram, this.instance_id);
    }
    async setName(name) {
        await window.enderlynx.updateInstance("name", name, this.instance_id);
    }
    async setLastPlayed(last_played) {
        await window.enderlynx.updateInstance("last_played", last_played, this.instance_id);
    }
    async setDateCreated(date_created) {
        await window.enderlynx.updateInstance("date_created", date_created, this.instance_id);
    }
    async setDateModified(date_modified) {
        await window.enderlynx.updateInstance("date_modified", date_modified, this.instance_id);
    }
    async setLoader(loader) {
        await window.enderlynx.updateInstance("loader", loader, this.instance_id);
    }
    async setVanillaVersion(vanilla_version) {
        await window.enderlynx.updateInstance("vanilla_version", vanilla_version, this.instance_id);
    }
    async setLoaderVersion(loader_version) {
        await window.enderlynx.updateInstance("loader_version", loader_version, this.instance_id);
    }
    async setPlaytime(playtime) {
        await window.enderlynx.updateInstance("playtime", playtime, this.instance_id);
    }
    async setLocked(locked) {
        await window.enderlynx.updateInstance("locked", locked, this.instance_id);
    }
    async setDownloaded(downloaded) {
        await window.enderlynx.updateInstance("downloaded", downloaded, this.instance_id);
    }
    async setGroup(group) {
        await window.enderlynx.updateInstance("group_id", group, this.instance_id);
    }
    async setImage(image) {
        await window.enderlynx.updateInstance("image", image, this.instance_id);
    }
    async setPid(pid) {
        await window.enderlynx.updateInstance("pid", pid, this.instance_id);
    }
    async setCurrentLogFile(current_log_file) {
        await window.enderlynx.updateInstance("current_log_file", current_log_file, this.instance_id);
    }
    async setInstallSource(install_source) {
        await window.enderlynx.updateInstance("install_source", install_source, this.instance_id);
    }
    async setInstallId(install_id) {
        await window.enderlynx.updateInstance("install_id", install_id, this.instance_id);
    }
    async setInstalling(installing) {
        await window.enderlynx.updateInstance("installing", installing, this.instance_id);
    }
    async setMcInstalled(mc_installed) {
        await window.enderlynx.updateInstance("mc_installed", mc_installed, this.instance_id);
    }
    async setFailed(failed) {
        await window.enderlynx.updateInstance("failed", failed, this.instance_id);
    }
    async setUsesCustomJavaArgs(uses_custom_java_args) {
        await window.enderlynx.updateInstance("uses_custom_java_args", uses_custom_java_args, this.instance_id);
    }
    async setProvidedJavaArgs(provided_java_args) {
        await window.enderlynx.updateInstance("provided_java_args", provided_java_args, this.instance_id);
    }
    async setUsesCustomJavaInstallation(uses_custom_java_installation) {
        await window.enderlynx.updateInstance("uses_custom_java_installation", uses_custom_java_installation, this.instance_id);
    }
    async setSourceServer(source_server) {
        await window.enderlynx.updateInstance("source_server", source_server, this.instance_id);
    }
    async setUsesCustomWindow(uses_custom_window) {
        await window.enderlynx.updateInstance("uses_custom_window", uses_custom_window, this.instance_id);
    }
    async setUsesCustomAllocatedRam(uses_custom_allocated_ram) {
        await window.enderlynx.updateInstance("uses_custom_allocated_ram", uses_custom_allocated_ram, this.instance_id);
    }

    async addContent(name, author, image, file_name, source, type, version, source_info, disabled, version_id) {
        return await window.enderlynx.addContent(name, author, image, file_name, source, type, version, this.instance_id, source_info, disabled, version_id);
    }

    supportsQuickPlaySingleplayer() {
        if (!minecraftVersions) return true;
        let instanceIndex = minecraftVersions.indexOf(this.vanilla_version);
        let firstSupportIndex = minecraftVersions.indexOf("23w14a");
        return instanceIndex >= firstSupportIndex;
    }

    supportsQuickPlayMultiplayer() {
        if (!minecraftVersions) return true;
        let instanceIndex = minecraftVersions.indexOf(this.vanilla_version);
        let firstSupportIndex = minecraftVersions.indexOf("13w16a");
        return instanceIndex >= firstSupportIndex && this.vanilla_version != "1.5.2";
    }

    supportsQuickPlayType(type) {
        if (type == "multiplayer") return this.supportsQuickPlayMultiplayer();
        return this.supportsQuickPlaySingleplayer();
    }

    async getContent() {
        let content = await window.enderlynx.getInstanceContentDatabase(this.instance_id);
        let contentList = [];
        for (let i = 0; i < content.length; i++) {
            contentList.push(Content.applyContent(content[i].id, content[i]));
        }
        return contentList;
    }

    async clearContent() {
        let content = await this.getContent();
        content.forEach(e => {
            e.delete();
        });
    }

    async delete() {
        Instance.instances.delete(this.instance_id);
        let content = await this.getContent();
        content.forEach((e) => {
            e.delete();
        });
        this.deleted = true;
        await window.enderlynx.deleteInstance(this.instance_id);
    }

    watchForChange(key, callback) {
        this.listeners.set(key, callback);
    }

    display(default_tab) {
        this.instanceScreen.display(false, default_tab);
    }

    async play(settings) {
        try {
            InstanceStateManagement.setInstanceStatus(this.instance_id, InstanceState.LOADING, settings?.quickPlay?.info);
            await window.enderlynx.playMinecraft(this.instance_id, settings);
            if (Display.currentScreen instanceof InstanceScreen && Display.currentScreen.currentTab == "logs") {
                Display.currentScreen.showLogs();
            }
        } catch (e) {
            displayError(e);
        }
    }

    async playSingleplayerWorld(world_id) {
        await this.play({ quickPlay: { "type": "singleplayer", "info": world_id } });
    }

    async playMultiplayerWorld(world_id) {
        await this.play({ quickPlay: { "type": "multiplayer", "info": world_id } });
    }

    async playDemo() {
        await this.play({ demo: true })
    }

    async stop() {
        InstanceStateManagement.setInstanceStatus(this.instance_id, InstanceState.STOPPING);
        let success = await window.enderlynx.stopInstance(this.instance_id);
        if (!success) displayError(translate("app.instance.stop.failed"));
        return success;
    }

    showRepairDialog() {
        let dialog = new Dialog();
        dialog.showDialog(translate("app.instances.repair.title"), "form", [
            {
                "type": "notice",
                "content": this.install_source == "custom" ? translate("app.instances.repair.notice") : translate("app.instances.repair.notice_modpack")
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
            this.loader != "vanilla" ? {
                "type": "toggle",
                "name": translate("app.instances.repair.mod_loader", "%l", loaders[this.loader]),
                "desc": translate("app.instances.repair.mod_loader.description", "%l", loaders[this.loader]),
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
        ], [], async (info) => {
            let whatToRepair = [];
            if (info.minecraft) whatToRepair.push("minecraft");
            if (info.java) whatToRepair.push("java");
            if (info.assets) whatToRepair.push("assets");
            if (info.mod_loader) whatToRepair.push("mod_loader");
            await window.enderlynx.repairMinecraft(this.instance_id, this.loader, this.vanilla_version, this.loader_version, whatToRepair);
        });
    }

    async showSettingsDialog() {
        let dialog = new Dialog();
        let default_java_installation = await window.enderlynx.getJavaInstallation(this.java_version);
        dialog.showDialog(translate("app.instances.settings.title"), "form", [
            {
                "type": "image-upload",
                "name": translate("app.instances.settings.icon"),
                "id": "icon",
                "default": this.image,
                "tab": "general",
                "image_code": this.instance_id
            },
            {
                "type": "text",
                "name": translate("app.instances.settings.name"),
                "id": "name",
                "default": this.name,
                "tab": "general",
                "maxlength": 50
            },
            {
                "type": "dropdown",
                "name": translate("app.instances.settings.group"),
                "desc": translate("app.instances.settings.group.description"),
                "id": "group",
                "default": this.group_id || -1,
                "tab": "general",
                "options": (await InstancesScreen.getCustomGroups()).map(e => ({
                    "name": e.id == -1 ? translate("app.instances.settings.group.none") : e.name,
                    "value": e.id
                }))
            },
            this.locked ? null : {
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
                "default": this.loader,
                "tab": "installation"
            },
            this.locked ? null : {
                "type": "dropdown",
                "name": translate("app.instances.settings.game_version"),
                "options": [],
                "id": "game_version",
                "default": this.vanilla_version,
                "tab": "installation",
                "input_source": "loader",
                "source": VersionList.getVersions
            },
            this.locked ? null : {
                "type": "loader-version-dropdown",
                "name": "",
                "options": [],
                "id": "loader_version",
                "default": this.loader_version,
                "tab": "installation",
                "loader_source": "loader",
                "game_version_source": "game_version"
            },
            this.locked ? null : {
                "type": "toggle",
                "name": translate("app.instances.settings.update_content"),
                "default": true,
                "tab": "installation",
                "desc": translate("app.instances.settings.update_content.description"),
                "id": "update_content"
            },
            this.installed_version ? {
                "type": "notice",
                "content": translate("app.instances.settings.modpack.installed_via", "%c", translate("app.discover." + this.install_source)),
                "tab": "modpack"
            } : null,
            this.installed_version ? {
                "type": "button",
                "name": translate("app.instances.settings.modpack.view"),
                "tab": "modpack",
                "icon": '<i class="fa-solid fa-eye"></i>',
                "func": () => {
                    displayContentInfo(this.install_source, undefined, this.install_id, this.instance_id);
                }
            } : null,
            this.installed_version ? {
                "type": "dropdown",
                "name": translate("app.instances.settings.modpack.version.title"),
                "desc": translate("app.instances.settings.modpack.version.description"),
                "tab": "modpack",
                "id": "modpack_version",
                "options": [],
                "input_source": "",
                "source": async () => {
                    return await getModpackVersions(this.install_source, this.install_id);
                },
                "default": this.installed_version
            } : null,
            this.installed_version ? {
                "type": "toggle",
                "name": translate("app.modpack.repair"),
                "tab": "modpack",
                "id": "modpack_reinstall"
            } : null,
            {
                "type": "text",
                "name": translate("app.instances.settings.linked_server"),
                "id": "source_server",
                "tab": this.installed_version ? "modpack" : "installation",
                "default": this.source_server,
                "desc": translate("app.instances.settings.linked_server.description")
            },
            {
                "type": "override-default",
                "id": "uses_custom_window",
                "name": translate("app.instances.settings.custom.window"),
                "tab": "window",
                "enabled": this.uses_custom_window,
                "children": [
                    {
                        "type": "number",
                        "name": translate("app.instances.settings.width"),
                        "id": "width",
                        "desc": translate("app.instances.settings.width.description"),
                        "default": this.window_width ?? 854,
                        "custom_value": this.window_width ?? 854,
                        "default_value": Number(await getDefault("default_width"))
                    },
                    {
                        "type": "number",
                        "name": translate("app.instances.settings.height"),
                        "id": "height",
                        "desc": translate("app.instances.settings.height.description"),
                        "default": this.window_height ?? 480,
                        "custom_value": this.window_height ?? 480,
                        "default_value": Number(await getDefault("default_height"))
                    },
                    {
                        "type": "toggle",
                        "name": translate("app.instances.settings.fullscreen"),
                        "id": "fullscreen",
                        "desc": translate("app.instances.settings.fullscreen.description"),
                        "default": this.fullscreen ?? false,
                        "custom_value": this.fullscreen ?? false,
                        "default_value": await getDefault("default_fullscreen") == "true"
                    }
                ]
            },
            {
                "type": "override-default",
                "id": "uses_custom_allocated_ram",
                "name": translate("app.instances.settings.custom.allocated_ram"),
                "tab": "java",
                "enabled": this.uses_custom_allocated_ram,
                "children": [
                    {
                        "type": "slider",
                        "name": translate("app.instances.settings.ram"),
                        "id": "allocated_ram",
                        "default": this.allocated_ram ?? 4096,
                        "min": 512,
                        "max": window.enderlynx.getTotalRAM(),
                        "increment": 64,
                        "unit": translate("app.instances.settings.ram.unit"),
                        "desc": translate("app.instances.settings.ram.description"),
                        "custom_value": this.allocated_ram ?? 4096,
                        "default_value": Number(await getDefault("default_ram"))
                    }
                ]
            },
            {
                "type": "override-default",
                "id": "uses_custom_java_installation",
                "name": translate("app.instances.settings.custom.java_installation"),
                "tab": "java",
                "enabled": this.uses_custom_java_installation,
                "children": [
                    {
                        "type": "text",
                        "name": translate("app.instances.settings.java_installation"),
                        "id": "java_path",
                        "default": this.java_path,
                        "custom_value": this.java_path || default_java_installation,
                        "default_value": default_java_installation,
                        "desc": translate("app.instances.settings.java_installation.description." + window.enderlynx.ostype()).replace("%v", this.java_version),
                        "buttons": [
                            {
                                "name": translate("app.instances.settings.java_installation.detect"),
                                "icon": '<i class="fa-solid fa-magnifying-glass"></i>',
                                "func": async (value, button, setter) => {
                                    button.innerHTML = '<i class="spinner"></i>' + translate("app.instances.settings.java_installation.detect.searching");
                                    let dialog = new Dialog();
                                    let results = await window.enderlynx.detectJavaInstallations(this.java_version);
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
                                    ], [], (info) => {
                                        setter(info.java_path);
                                    });
                                    button.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i>' + translate("app.instances.settings.java_installation.detect");
                                }
                            },
                            {
                                "name": translate("app.instances.settings.java_installation.browse"),
                                "icon": '<i class="fa-solid fa-folder"></i>',
                                "func": async (value, button, setter) => {
                                    let os = window.enderlynx.osplatform();
                                    let files = await window.enderlynx.triggerBrowse(value, "file", os == 'win32' ? ["exe"] : [], os == 'win32' ? translate("app.import.select.executables") : "", translate("app.import.select.java_executable"), false);
                                    if (files[0]?.path) setter(files[0].path);
                                }
                            },
                            {
                                "name": translate("app.instances.settings.java_installation.test"),
                                "icon": '<i class="fa-solid fa-play"></i>',
                                "func": async (value, button) => {
                                    let num = Math.floor(Math.random() * 10000);
                                    button.dataset.num = num;
                                    button.classList.remove("failed");
                                    button.innerHTML = '<i class="spinner"></i>' + translate("app.instances.settings.java_installation.test.testing");
                                    let success = await window.enderlynx.testJavaInstallation(value);
                                    if (success) {
                                        button.innerHTML = '<i class="fa-solid fa-check"></i>' + translate("app.instances.settings.java_installation.test.success");
                                    } else {
                                        button.innerHTML = '<i class="fa-solid fa-xmark"></i>' + translate("app.instances.settings.java_installation.test.fail");
                                        button.classList.add("failed");
                                    }
                                    setTimeout(() => {
                                        if (button.dataset.num == num) {
                                            button.innerHTML = '<i class="fa-solid fa-play"></i>' + translate("app.instances.settings.java_installation.test");
                                            button.classList.remove("failed");
                                        }
                                    }, 3000);
                                }
                            }
                        ]
                    }
                ]
            },
            {
                "type": "override-default",
                "id": "uses_custom_java_args",
                "name": translate("app.instances.settings.custom.java_args"),
                "tab": "java",
                "enabled": this.uses_custom_java_args,
                "children": [
                    {
                        "type": "text",
                        "multiline": true,
                        "id": "java_args",
                        "name": translate("app.instances.settings.custom_args"),
                        "default": this.java_args,
                        "custom_value": this.java_args || this.provided_java_args,
                        "default_value": this.provided_java_args
                    }
                ]
            },
            {
                "type": "text",
                "id": "env_vars",
                "name": translate("app.instances.settings.custom_env_vars"),
                "default": this.env_vars,
                "tab": "launch_hooks"
            },
            {
                "type": "text",
                "id": "pre_launch_hook",
                "name": translate("app.instances.settings.pre_launch_hook"),
                "default": this.pre_launch_hook,
                "tab": "launch_hooks"
            },
            {
                "type": "text",
                "id": "post_launch_hook",
                "name": translate("app.instances.settings.post_launch_hook"),
                "default": this.post_launch_hook,
                "tab": "launch_hooks"
            },
            {
                "type": "text",
                "id": "wrapper",
                "name": translate("app.instances.settings.wrapper"),
                "default": this.wrapper,
                "tab": "launch_hooks"
            },
            {
                "type": "text",
                "id": "post_exit_hook",
                "name": translate("app.instances.settings.post_exit_hook"),
                "default": this.post_exit_hook,
                "tab": "launch_hooks",
                "desc": translate("app.post_exit.notice")
            }
        ].filter(e => e), [
            { "type": "cancel", "content": translate("app.instances.settings.cancel") },
            { "type": "confirm", "content": translate("app.instances.settings.confirm") }
        ], [
            { "name": translate("app.instances.settings.tab.general"), "value": "general" },
            this.locked ? null : { "name": translate("app.instances.settings.tab.installation"), "value": "installation" },
            this.installed_version ? { "name": translate("app.instances.settings.tab.modpack"), "value": "modpack" } : null,
            { "name": translate("app.instances.settings.tab.window"), "value": "window" },
            { "name": translate("app.instances.settings.tab.java"), "value": "java" },
            { "name": translate("app.instances.settings.tab.launch_hooks"), "value": "launch_hooks" }
        ].filter(e => e), async (info) => {
            await this.setDateModified(new Date());
            await this.setName(info.name);
            await this.setImage(info.icon);
            await this.setGroup(info.group);
            await this.setWindowWidth(info.width);
            await this.setWindowHeight(info.height);
            await this.setFullscreen(info.fullscreen);
            await this.setAllocatedRam(info.allocated_ram);
            await this.setSourceServer(info.source_server);
            await this.setUsesCustomJavaInstallation(info.uses_custom_java_installation);
            await this.setJavaPath(info.java_path);
            await this.setUsesCustomJavaArgs(info.uses_custom_java_args);
            await this.setUsesCustomWindow(info.uses_custom_window);
            await this.setUsesCustomAllocatedRam(info.uses_custom_allocated_ram);
            await this.setJavaArgs(info.java_args);
            await this.setEnvVars(info.env_vars);
            await this.setPreLaunchHook(info.pre_launch_hook);
            await this.setPostLaunchHook(info.post_launch_hook);
            await this.setWrapper(info.wrapper);
            await this.setPostExitHook(info.post_exit_hook);
            if (info.modpack_version && (info.modpack_version != this.installed_version || info.modpack_reinstall) && info.modpack_version != "loading") {
                let source = this.install_source;
                let modpack_info = info.modpack_version_pass;
                runModpackUpdate(this, source, modpack_info);
                return;
            }
            if (this.loader == info.loader && this.vanilla_version == info.game_version && this.loader_version == info.loader_version) {
                return;
            }
            if ([info.game_version, info.loader_version].includes("loading")) {
                return;
            }
            if (!info.loader || !info.game_version) return;
            await this.setLoader(info.loader);
            await this.setVanillaVersion(info.game_version);
            await this.setLoaderVersion(info.loader_version);
            await this.setMcInstalled(false);
            await this.setFailed(false);
            let r = await window.enderlynx.downloadMinecraft(this.instance_id, info.loader, info.game_version, info.loader_version);
            if (r.error) {
                await this.setFailed(true);
            } else {
                await this.setJavaVersion(r.java_version);
                await this.setProvidedJavaArgs(r.java_args);
                if (!this.uses_custom_java_args) {
                    await this.setJavaArgs(r.java_args);
                }
                if (info.update_content) {
                    let content = await this.getContent();
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
                            }
                        }]);
                        let c = content[i];
                        try {
                            await updateContent(c.source, c, new Project(), undefined, this);
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
                                "cancel": () => { }
                            }]);
                            this.instanceScreen.tabs.selectOption("content");
                            return;
                        }
                    }
                    log.sendData([{
                        "title": "Updating Content",
                        "progress": 100,
                        "desc": "Done",
                        "id": processId,
                        "status": "done",
                        "cancel": () => { }
                    }]);
                    displaySuccess(translate("app.instances.updated_all").replace("%i", this.name));
                    this.instanceScreen.tabs.selectOption("content");
                }
                await this.setMcInstalled(true);
            }
        }, () => { }, undefined, false, true);
    }

    async showShareDialog() {
        document.body.classList.add("loading");
        let options = await window.enderlynx.getInstanceFiles(this.instance_id);
        document.body.classList.remove("loading");
        let content = await this.getContent();
        let contentSpecific = [];
        let contentMap = {};
        content.forEach(e => {
            let content_folder = e.type == "mod" ? "mods" : e.type == "resourcepack" ? "resourcepacks" : "shaderpacks";
            let content_file = content_folder + "/" + e.file_name;
            let replace = content_folder + "/" + parseMinecraftFormatting(e.name).replaceAll("\\", "\\\\").replaceAll("/", "\\/");
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
        let name = this.name;

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
                label.innerHTML = translate("app.instances.share.distribution", "%p", translate("app.discover.modrinth"));
                labelDesc.innerHTML = translate("app.instances.share.distribution.description", "%p", translate("app.discover.modrinth"));
            }
            if (v == "cf_zip") {
                distributionToggleWrapper.classList.add("shown");
                label.innerHTML = translate("app.instances.share.distribution", "%p", translate("app.discover.curseforge"));
                labelDesc.innerHTML = translate("app.instances.share.distribution.description", "%p", translate("app.discover.curseforge"));
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
                "default": this.name,
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
                "default": Instance.DEFAULT_FILE_EXCLUSIONS,
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
        ], [], (info) => {
            let nonContentSpecific = info.files.filter(e => !contentSpecific.includes(e));
            let yesContentSpecific = info.files.filter(e => contentSpecific.includes(e)).map(e => contentMap[e]);
            yesContentSpecific = yesContentSpecific.filter(e => {
                if (e.source != "player_install") return true;
                let content_folder = e.type == "mod" ? "mods" : e.type == "resourcepack" ? "resourcepacks" : "shaderpacks";
                let content_file = content_folder + "/" + e.file_name;
                nonContentSpecific.push(content_file);
                return false;
            });
            if (info.out == "elpack") {
                createElPack(this, yesContentSpecific, nonContentSpecific, info.version);
            } else if (info.out == "mrpack") {
                yesContentSpecific = yesContentSpecific.filter(e => {
                    if (e.source == "modrinth") return true;
                    let content_folder = e.type == "mod" ? "mods" : e.type == "resourcepack" ? "resourcepacks" : "shaderpacks";
                    let content_file = content_folder + "/" + e.file_name;
                    nonContentSpecific.push(content_file);
                    return false;
                });
                createMrPack(this, yesContentSpecific, nonContentSpecific, info.version);
            } else if (info.out == "cf_zip") {
                yesContentSpecific = yesContentSpecific.filter(e => {
                    if (e.source == "curseforge") return true;
                    let content_folder = e.type == "mod" ? "mods" : e.type == "resourcepack" ? "resourcepacks" : "shaderpacks";
                    let content_file = content_folder + "/" + e.file_name;
                    nonContentSpecific.push(content_file);
                    return false;
                });
                createCfZip(this, yesContentSpecific, nonContentSpecific, info.version);
            }
        });
    }

    async showDuplicateDialog() {
        document.body.classList.add("loading");
        let options = await window.enderlynx.getInstanceFiles(this.instance_id);
        document.body.classList.remove("loading");
        let content = await this.getContent();
        let contentSpecific = [];
        let contentMap = {};
        content.forEach(e => {
            let content_folder = e.type == "mod" ? "mods" : e.type == "resourcepack" ? "resourcepacks" : "shaderpacks";
            let content_file = content_folder + "/" + e.file_name;
            let replace = content_folder + "/" + parseMinecraftFormatting(e.name).replaceAll("\\", "\\\\").replaceAll("/", "\\/");
            contentSpecific.push(replace);
            contentMap[replace] = { content_id: e.id, path: content_file };
            let index = options.indexOf(content_file);
            if (index < 0) return;
            options[index] = replace;
        });
        let dialog = new Dialog();
        if (!this.mc_installed || this.installing) {
            dialog.showDialog(translate("app.instances.duplicate.title", "%i", this.name), "notice", translate("app.instances.duplicate.installing.notice"), [
                {
                    "type": "cancel",
                    "content": translate("app.instances.duplicate.close")
                }
            ], [], () => { });
            return;
        }
        dialog.showDialog(translate("app.instances.duplicate.title", "%i", this.name), "form", [
            {
                "type": "image-upload",
                "default": this.image,
                "id": "icon",
                "name": translate("app.instances.icon")
            },
            {
                "type": "text",
                "default": translate("app.instances.duplicate.new_name", "%i", this.name),
                "id": "name",
                "name": translate("app.instances.name"),
                "maxlength": 50
            },
            {
                "type": "files",
                "name": translate("app.instances.duplicate.files"),
                "id": "files",
                "options": options,
                "default": Instance.DEFAULT_FILE_EXCLUSIONS
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
        ], [], async (info) => {
            let nonContentSpecific = info.files.filter(e => !contentSpecific.includes(e));
            let yesContentSpecific = info.files.filter(e => contentSpecific.includes(e)).map(e => contentMap[e]);

            let new_instance_id = await window.enderlynx.getInstanceFolderName(info.name);
            let success = await window.enderlynx.duplicateInstance(this.instance_id, new_instance_id, info.name, info.icon, nonContentSpecific, yesContentSpecific);
            if (!success) {
                displayError(translate("app.instances.duplicate.fail"));
                return;
            }
            let newInstance = Instance.getInstance(new_instance_id);
            newInstance.display();
        })
    }

    showDeleteDialog(callback) {
        Instance.showDeleteDialogForMultiple([this], callback);
    }

    static showDeleteDialogForMultiple(instances, callback) {
        let dialog = new Dialog();
        dialog.showDialog(translate("app.instances.delete.confirm.title"), "form", [{
            "content": instances.length == 1 ? translate("app.instances.delete.confirm.description", "%i", instances[0].name) : translate("app.instances.delete.confirm.multiple.description", "%c", instances.length),
            "type": "notice"
        }, {
            "type": "toggle",
            "name": translate("app.instances.delete.files"),
            "default": true,
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
        ], [], async (info) => {
            for (let instance of instances) {
                instance.delete();
                callback();
                if (info.delete) {
                    try {
                        await window.enderlynx.deleteInstanceFiles(instance.instance_id);
                    } catch (e) {
                        displayError(translate("app.instances.delete.files.fail"));
                    }
                }
            }
        });
    }

    async pin() {
        await window.enderlynx.pinInstance(this.instance_id);
        displaySuccess(translate("app.instances.pin.success"));
    }
    async unpin(dontDisplay) {
        await window.enderlynx.unpinInstance(this.instance_id);
        if (!dontDisplay) displaySuccess(translate("app.instances.unpin.success"));
    }
    async pinWorld(world) {
        let world_id = world.id || world.ip;
        await window.enderlynx.pinWorld(world_id, this.instance_id, world.type);
        displaySuccess(translate("app.worlds.pin.success"));
    }
    async unpinWorld(world) {
        let world_id = world.id || world.ip;
        await window.enderlynx.unpinWorld(world_id, this.instance_id, world.type);
        displaySuccess(translate("app.worlds.unpin.success"));
    }
    async isWorldPinned(world) {
        return await window.enderlynx.isWorldPinned(world.id || world.ip, this.instance_id, world.type);
    }

    async getServerLastPlayed(ip) {
        let result = await window.enderlynx.getServerLastPlayed(this.instance_id, ip);
        return new Date(result ? result : null);
    }

    async getSingleplayerWorlds() {
        return await window.enderlynx.getSinglePlayerWorlds(this.instance_id);
    }

    async getMultiplayerWorlds() {
        return await window.enderlynx.getMultiplayerWorlds(this.instance_id);
    }

    async getContentFiles() {
        return await window.enderlynx.getInstanceContent(this.instance_id);
    }

    async addDesktopShortcut() {
        let success = await window.enderlynx.createDesktopShortcut(this.instance_id, this.name, this.image);
        if (success) {
            displaySuccess(translate("app.instances.shortcut.created"));
        } else {
            displayError(translate("app.instances.shortcut.failed"));
        }
    }

    async addDesktopShortcutWorld(worldName, worldType, worldId, worldImage) {
        let success = await window.enderlynx.createDesktopShortcut(this.instance_id, worldName, worldImage, worldType, worldId);
        if (success) {
            displaySuccess(translate("app.worlds.shortcut.created"));
        } else {
            displayError(translate("app.worlds.shortcut.failed"));
        }
    }

    async installContent(project_type, project_url, sha1, filename, data_pack_world, content_id) {
        return await window.enderlynx.installContent(this.instance_id, project_type, project_url, sha1, filename, data_pack_world, content_id);
    }

    applyImage(imgElement) {
        imgElement.src = this.getImage();
        imgElement.onerror = () => {
            imgElement.src = getDefaultImage(this.instance_id);
        }
        this.watchForChange("image", () => {
            imgElement.src = this.getImage();
        });
    }

    getImage() {
        return this.image || getDefaultImage(this.instance_id);
    }

    setSelected(selected) {
        if (selected) {
            this.checkbox.checked = true;
        } else {
            this.checkbox.checked = false;
        }
    }

    getInstanceButton() {
        let running = checkForProcess(this.pid);
        if (!running && this.pid != null) this.setPid(null);
        let element = createElement("div", "instance-item");
        makeArtificialButton(element, (event) => {
            if (this.suppressNextClick) {
                this.suppressNextClick = false;
                return;
            }
            if (instancesScreen.selectedInstances?.has(this)) {
                instancesScreen.deselectInstance(this);
                return;
            } else if (instancesScreen.selectedInstances.size > 0 || event.shiftKey || event.target.matches("input")) {
                if (event.shiftKey && instancesScreen.lastSelectedInstance) {
                    instancesScreen.selectRange(this);
                    return;
                }
                instancesScreen.selectInstance(this);
                return;
            }
            this.display();
        }, ["button", "i"]);
        element.onpointerdown = (event) => {
            if (event.button != 0) return;
            this.canDrag = true;
            let rect = this.instanceButton.getBoundingClientRect();
            this.dragOffsetX = event.clientX - rect.left;
            this.dragOffsetY = event.clientY - rect.top;
            this.dragStartX = event.clientX;
            this.dragStartY = event.clientY;
        }
        element.onpointerup = (event) => {
            if (event.button != 0) return;
            if (instancesScreen.dragging) this.suppressNextClick = true;
            this.canDrag = false;
        }
        element.onpointerleave = () => {
            this.canDrag = false;
        }
        element.onpointermove = (event) => {
            if (!this.canDrag) return;
            const dx = event.clientX - this.dragStartX;
            const dy = event.clientY - this.dragStartY;
            if (Math.hypot(dx, dy) < 8) return;
            instancesScreen.startInstanceDrag(this, event, this.dragOffsetX, this.dragOffsetY);
            this.canDrag = false;
        }
        element.dataset.id = this.instance_id;
        if (running) {
            element.classList.add("running");
        }
        this.watchForChange("pid", (pid) => {
            running = checkForProcess(pid);
            live.findLive();
            if (running) {
                element.classList.add("running");
            } else {
                element.classList.remove("running");
            }
        });
        let instancePlay = createElement("button", "instance-play-button");
        InstanceStateManagement.registerButton(instancePlay, this, null, true, false, undefined, false, true);
        element.appendChild(instancePlay);
        let instanceCheckbox = createElement("input", "instance-checkbox", { type: "checkbox" });
        element.appendChild(instanceCheckbox);
        instanceCheckbox.onchange = (event) => {
            if (instanceCheckbox.checked) {
                instancesScreen.selectInstance(this);
            } else {
                instancesScreen.deselectInstance(this);
            }
        }
        this.checkbox = instanceCheckbox;
        let instanceImage = createElement("img", "instance-image");
        instanceImage.draggable = false;
        this.applyImage(instanceImage);
        element.appendChild(instanceImage);
        let instanceInfoEle = createElement("div", "instance-info");
        let instanceName = createElement("div", "instance-name");
        this.watchForChange("name", async (title) => {
            instanceName.textContent = title;
        });
        instanceName.textContent = this.name;
        instanceInfoEle.appendChild(instanceName);
        let instanceDesc = createElement("div", "instance-desc");
        let updateLoaderAndGameVersion = () => {
            instanceDesc.textContent = loaders[this.loader] + " " + this.vanilla_version;
        }
        updateLoaderAndGameVersion();
        this.watchForChange("loader", async (l) => {
            updateLoaderAndGameVersion();
        });
        this.watchForChange("vanilla_version", async (v) => {
            updateLoaderAndGameVersion();
        });
        instanceInfoEle.appendChild(instanceDesc);
        element.appendChild(instanceInfoEle);
        let buttons = new ContextMenuButtons([
            {
                "type": "play-button",
                "instance": this,
                "goToInstancePageWhenClicked": true
            },
            this.locked ? null : {
                "icon": '<i class="fa-solid fa-plus"></i>',
                "title": translate("app.button.content.add"),
                "func": () => {
                    discoverScreen.display(false, this, this.vanilla_version, this.loader);
                }
            },
            {
                "icon": '<i class="fa-solid fa-folder"></i>',
                "title": translate("app.button.instances.open_folder"),
                "func": () => {
                    window.enderlynx.openInstanceFolder(this.instance_id);
                }
            },
            {
                "icon": '<i class="fa-solid fa-gear"></i>',
                "title": translate("app.button.instances.open_settings"),
                "func": () => {
                    this.showSettingsDialog();
                }
            },
            {
                "icon": this.isPinned() ? '<i class="fa-solid fa-thumbtack-slash"></i>' : '<i class="fa-solid fa-thumbtack"></i>',
                "title": this.isPinned() ? translate("app.instances.unpin") : translate("app.instances.pin"),
                "func": async (e) => {
                    this.isPinned() ? await this.unpin() : await this.pin();
                    e.setTitle(this.isPinned() ? translate("app.instances.unpin") : translate("app.instances.pin"));
                    e.setIcon(this.isPinned() ? '<i class="fa-solid fa-thumbtack-slash"></i>' : '<i class="fa-solid fa-thumbtack"></i>');
                    this.getInstanceButton();
                    instancesScreen.groupInstances();
                }
            },
            {
                "icon": '<i class="fa-solid fa-copy"></i>',
                "title": translate("app.button.instances.duplicate"),
                "func": () => {
                    this.showDuplicateDialog();
                }
            },
            {
                "icon": '<i class="fa-solid fa-trash-can"></i>',
                "title": translate("app.button.instances.delete"),
                "func": () => {
                    this.showDeleteDialog(() => {
                        animateGridReorderStart(".instance-item");
                        this.instanceButton.remove();
                        animateGridReorderEnd(".instance-item");
                    });
                },
                "danger": true
            }
        ].filter(e => e));
        element.oncontextmenu = (e) => {
            contextmenu.showContextMenu(buttons, e.clientX, e.clientY);
        }
        this.instanceButton = element;
        return element;
    }
}

const PlayButtonState = Object.freeze({
    PLAY: 'PLAY',
    PLAY_SPECIFIC_WORLD: 'PLAY_SPECIFIC_WORLD',
    STOP: 'STOP',
    INSTALLING: "INSTALLING",
    FAILED: "FAILED",
    LOADING: 'LOADING',
    STOPPING: 'STOPPING',
    SPECIFIC_WORLD_DISABLED: 'SPECIFIC_WORLD_DISABLED',
    SPECIFIC_WORLD_FAILED: 'SPECIFIC_WORLD_FAILED',
    SPECIFIC_WORLD_INSTALLING: 'SPECIFIC_WORLD_INSTALLING'
});

const InstanceState = Object.freeze({
    FAILED: 'FAILED',
    INSTALLING: 'INSTALLING',
    PLAYABLE: 'PLAYABLE',
    STOPPABLE: 'STOPPABLE',
    LOADING: 'LOADING',
    STOPPING: 'STOPPING'
});

class InstanceStateManagement {
    static states = {};
    static active_world = "";
    constructor() { }
    static calculateState(instance) {
        let running = checkForProcess(instance.pid);
        if (instance.failed) {
            return InstanceState.FAILED;
        } else if (!instance.mc_installed) {
            return InstanceState.INSTALLING;
        } else if (!running) {
            return InstanceState.PLAYABLE;
        } else {
            return InstanceState.STOPPABLE;
        }
    }
    static registerButton(button, instance, world, useTooltip = false, isInContextMenu = false, callWhenRun, goToInstancePageWhenClicked = false, iconOnly = false) {
        let info = {
            element: button,
            instance,
            world,
            useTooltip,
            isInContextMenu,
            callWhenRun,
            goToInstancePageWhenClicked,
            iconOnly
        }
        let instance_id = instance.instance_id;
        if (this.states[instance_id]?.buttons) {
            this.states[instance_id].buttons.push(info);
        } else {
            this.states[instance_id] = {
                state: this.calculateState(instance),
                buttons: [info]
            }
        }
        this.updateButton(info, this.states[instance_id]);
    }
    static applyPlayButtonState(state, buttonInfo) {
        let button = buttonInfo.element;
        button.classList.remove("disabled");
        button.classList.remove("stop");
        button.removeAttribute("title");
        button.style.display = "";
        if (state == PlayButtonState.PLAY) {
            button.innerHTML = '<i class="fa-solid fa-play"></i>' + (buttonInfo.iconOnly ? "" : translate("app.button.instances.play_short"));
            if (buttonInfo.isInContextMenu) {
                button.innerHTML = '<i class="fa-solid fa-play"></i>' + translate("app.button.instances.play");
            }
            button.onclick = () => {
                if (buttonInfo.callWhenRun) buttonInfo.callWhenRun();
                if (buttonInfo.goToInstancePageWhenClicked) buttonInfo.instance.display();
                buttonInfo.instance.play();
            }
            if (buttonInfo.useTooltip) {
                button.title = translate("app.home.tooltip.instance");
            }
        } else if (state == PlayButtonState.STOP) {
            button.classList.add("stop");
            button.innerHTML = '<i class="fa-solid fa-circle-stop"></i>' + (buttonInfo.iconOnly ? "" : translate("app.button.instances.stop_short"));
            if (buttonInfo.isInContextMenu) {
                button.innerHTML = '<i class="fa-solid fa-circle-stop"></i>' + translate("app.button.instances.stop");
            }
            button.onclick = () => {
                if (buttonInfo.callWhenRun) buttonInfo.callWhenRun();
                buttonInfo.instance.stop();
            }
            if (buttonInfo.useTooltip) {
                button.title = translate("app.button.instances.stop");
            }
        } else if (state == PlayButtonState.FAILED) {
            button.classList.add("disabled");
            button.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>' + (buttonInfo.iconOnly ? "" : translate("app.instances.failed"));
            button.onclick = () => { }
            button.title = translate("app.instances.failed.tooltip");
        } else if (state == PlayButtonState.INSTALLING) {
            button.classList.add("disabled");
            button.innerHTML = '<i class="spinner"></i>' + (buttonInfo.iconOnly ? "" : translate("app.instances.installing"));
            button.onclick = () => { }
        } else if (state == PlayButtonState.LOADING) {
            button.classList.add("disabled");
            button.innerHTML = '<i class="spinner"></i>' + (buttonInfo.iconOnly ? "" : translate("app.instances.loading"));
            button.onclick = () => { }
        } else if (state == PlayButtonState.PLAY_SPECIFIC_WORLD) {
            button.innerHTML = '<i class="fa-solid fa-play"></i>' + (buttonInfo.iconOnly ? "" : translate("app.button.instances.play_short"));
            if (buttonInfo.isInContextMenu) {
                button.innerHTML = '<i class="fa-solid fa-play"></i>' + translate("app.worlds.play");
            }
            button.onclick = () => {
                if (buttonInfo.callWhenRun) buttonInfo.callWhenRun();
                if (buttonInfo.goToInstancePageWhenClicked) buttonInfo.instance.display();
                if (buttonInfo.world.type == "singleplayer") {
                    buttonInfo.instance.playSingleplayerWorld(buttonInfo.world.id);
                } else {
                    buttonInfo.instance.playMultiplayerWorld(buttonInfo.world.ip);
                }
            }
            if (buttonInfo.useTooltip) {
                button.title = buttonInfo.instance.supportsQuickPlayType(buttonInfo.world.type) ? translate("app.home.tooltip.world") : translate("app.home.tooltip.instance");
            }
        } else if (state == PlayButtonState.STOPPING) {
            button.classList.add("stop");
            button.innerHTML = '<i class="spinner"></i>' + (buttonInfo.iconOnly ? "" : translate("app.instances.stopping"));
            button.onclick = () => { }
        } else if (state == PlayButtonState.SPECIFIC_WORLD_DISABLED || state == PlayButtonState.SPECIFIC_WORLD_FAILED || state == PlayButtonState.SPECIFIC_WORLD_INSTALLING) {
            if (buttonInfo.isInContextMenu) {
                button.style.display = "none";
            }
            button.classList.add("disabled");
            button.innerHTML = '<i class="fa-solid fa-play"></i>' + (buttonInfo.iconOnly ? "" : translate("app.button.instances.play_short"));
            button.onclick = () => { }
            let str = "app.instances.instance_in_use";
            if (state == PlayButtonState.SPECIFIC_WORLD_FAILED) str = "app.instances.instance_failed";
            if (state == PlayButtonState.SPECIFIC_WORLD_INSTALLING) str = "app.instances.instance_installing";
            button.title = translate(str);
        }
    }
    static updateAllButtons(instance_id) {
        if (!this.states[instance_id]) return;
        let info = this.states[instance_id];
        for (let buttonInfo of info.buttons) {
            this.updateButton(buttonInfo, info);
        }
    }
    static updateButton(buttonInfo, info) {
        if (buttonInfo.world == null) {
            if (info.state == InstanceState.FAILED) this.applyPlayButtonState(PlayButtonState.FAILED, buttonInfo);
            if (info.state == InstanceState.INSTALLING) this.applyPlayButtonState(PlayButtonState.INSTALLING, buttonInfo);
            if (info.state == InstanceState.PLAYABLE) this.applyPlayButtonState(PlayButtonState.PLAY, buttonInfo);
            if (info.state == InstanceState.STOPPABLE) this.applyPlayButtonState(PlayButtonState.STOP, buttonInfo);
            if (info.state == InstanceState.STOPPING) this.applyPlayButtonState(PlayButtonState.STOPPING, buttonInfo);
            if (info.state == InstanceState.LOADING) this.applyPlayButtonState(PlayButtonState.LOADING, buttonInfo);
        } else {
            if (info.state == InstanceState.LOADING && (buttonInfo.world.id == this.active_world || buttonInfo.world.ip == this.active_world)) {
                this.applyPlayButtonState(PlayButtonState.LOADING, buttonInfo);
            } else if (info.state == InstanceState.PLAYABLE) {
                this.applyPlayButtonState(PlayButtonState.PLAY_SPECIFIC_WORLD, buttonInfo);
            } else if (info.state == InstanceState.INSTALLING) {
                this.applyPlayButtonState(PlayButtonState.SPECIFIC_WORLD_INSTALLING, buttonInfo);
            } else if (info.state == InstanceState.FAILED) {
                this.applyPlayButtonState(PlayButtonState.SPECIFIC_WORLD_FAILED, buttonInfo);
            } else {
                this.applyPlayButtonState(PlayButtonState.SPECIFIC_WORLD_DISABLED, buttonInfo);
            }
        }
    }
    static setInstanceStatus(instance_id, state, world_id) {
        if (!this.states[instance_id]) {
            this.states[instance_id] = {
                state,
                buttons: []
            }
        } else {
            this.states[instance_id].state = state;
        }
        this.active_world = world_id;
        this.updateAllButtons(instance_id);
    }
    static calculateInstanceStatus(instance) {
        this.setInstanceStatus(instance.instance_id, this.calculateState(instance))
    }
    static removeButtons(buttons) {
        if (!buttons) return;
        let buttonArray = Array.isArray(buttons) ? buttons : Array.from(buttons || []);
        let buttonSet = new Set(buttonArray);
        for (let instance_id in this.states) {
            let stateInfo = this.states[instance_id];
            if (!stateInfo || !Array.isArray(stateInfo.buttons)) continue;
            stateInfo.buttons = stateInfo.buttons.filter(button => !buttonSet.has(button.element));
        }
    }
}

async function getInstances() {
    let instances = await window.enderlynx.getInstances();
    let instanceList = [];
    for (let instance of instances) {
        instanceList.push(Instance.applyInstance(instance.instance_id, instance));
    }
    return instanceList;
}
async function addInstance(name, date_created, date_modified, last_played, loader, vanilla_version, loader_version, locked, downloaded, group, image, instance_id, playtime, install_source, install_id, installing, mc_installed) {
    let info = await window.enderlynx.addInstance(name, date_created, date_modified, last_played, loader, vanilla_version, loader_version, locked, downloaded, group, image, instance_id, playtime, install_source, install_id, installing, mc_installed);
    return Instance.applyInstance(instance_id, info);
}
async function getProfiles() {
    let profiles = await window.enderlynx.getProfiles();
    let profileList = [];
    for (let profile of profiles) {
        profileList.push(Profile.applyProfile(profile.id, profile));
    }
    return profileList;
}
async function getDefaultProfile() {
    let profile = await window.enderlynx.getDefaultProfile();
    return profile ? Profile.applyProfile(profile.id, profile) : null;
}
async function getProfileFromUUID(uuid) {
    let profile = await window.enderlynx.getProfileDatabase(uuid);
    return Profile.applyProfile(profile.id, profile);
}
async function getDefault(type) {
    return await window.enderlynx.getDefault(type);
}
async function setDefault(type, value) {
    await window.enderlynx.setDefault(type, value);
}
async function getSkinsNoDefaults() {
    let skins = await window.enderlynx.getSkinsNoDefaults();
    return skins.map(e => Skin.applySkin(e.id, e));
}
async function getDefaultSkins(callback) {
    let info = await window.enderlynx.getDefaultSkins();
    info.skins = info.skins.map(e => Skin.applySkin(e.id, e));
    callback(info);
    return info;
}
async function addSkin(name, model, active_uuid, skin_id, skin_url, overrideCheck, last_used, texture_key) {
    let info = await window.enderlynx.addSkin(name, model, active_uuid, skin_id, skin_url, overrideCheck, last_used, texture_key);
    return Skin.applySkin(info.id, info);
}

class Profile {
    static profiles = new Map();
    constructor(profile) {
        if (!profile) return;
        this.id = profile.id;
        this.name = profile.name;
        this.uuid = profile.uuid;
        this.is_default = Boolean(profile.is_default);
    }

    static getProfile(profile_id) {
        if (!this.profiles.has(profile_id)) {
            return Profile.applyProfile(profile_id, window.enderlynx.getProfileFromId(profile_id));
        }
        return this.profiles.get(profile_id);
    }
    static applyProfile(profile_id, info) {
        if (!this.profiles.has(profile_id)) {
            let newProfile = new Profile(info);
            this.profiles.set(profile_id, newProfile);
        }
        return this.profiles.get(profile_id);
    }

    async setDefault() {
        await window.enderlynx.setDefaultProfile(this.id);
    }

    async delete() {
        Profile.profiles.delete(this.id);
        await window.enderlynx.deleteProfile(this.uuid);
    }

    async getCapes() {
        let capes = await window.enderlynx.getCapes(this.uuid);
        return capes.map(e => Cape.applyCape(e.id, e));
    }

    async addCape(cape_name, cape_id, cape_url) {
        let info = await window.enderlynx.addCape(cape_name, cape_id, cape_url, this.uuid);
        return Cape.applyCape(info.id, info);
    }

    async getActiveSkin() {
        let info = await window.enderlynx.getActiveSkin(this.uuid);
        return Skin.applySkin(info.id, info);
    }

    async getActiveCape() {
        let info = await window.enderlynx.getActiveCape(this.uuid);
        return info ? Cape.applyCape(info.id, info) : null;
    }

    async removeActiveCape() {
        let cape = await this.getActiveCape();
        if (cape) await cape.removeActive();
    }

    async getFriends() {
        return await window.enderlynx.getFriends(this.id);
    }

    async runFriendAction(action, friend) {
        return await window.enderlynx.friendAction(this.id, action, friend);
    }
}

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
            this.element.querySelector('.player-head-menu').src = e;
        });
    }
    async setPlayerInfo() {
        let default_player = this.default_player ?? await getDefaultProfile();
        this.default_player = default_player;
        if (default_player) {
            this.element.setAttribute("popovertarget", "player-dropdown");
            this.element.innerHTML = ``;
            let img = document.createElement("img");
            img.className = "player-head-menu";
            getPlayerHead(default_player, (e) => img.src = e);
            this.element.appendChild(img);
            let pInfo = document.createElement("div");
            pInfo.className = "player-info";
            this.element.appendChild(pInfo);
            let pName = document.createElement("div");
            pName.className = "player-name";
            pName.textContent = default_player.name;
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
                playerName.textContent = this.players[i].name;
                playerInfoEle.appendChild(playerName);
                let playerDesc = document.createElement("div");
                playerDesc.classList.add("player-desc");
                playerDesc.textContent = translate("app.players.selected");
                playerInfoEle.appendChild(playerDesc);
                playerElement.appendChild(playerInfoEle);
                let playerDelete = document.createElement("div");
                playerDelete.classList.add("player-delete");
                playerDelete.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
                makeArtificialButton(playerDelete, () => {
                    this.onPlayerClickDelete(this.players[i]);
                });
                playerDelete.dataset.uuid = this.players[i].uuid;
                playerElement.appendChild(playerDelete);
                playerElement.addEventListener('click', (e) => this.onPlayerClick(this.players[i]));
                playerElement.dataset.uuid = this.players[i].uuid;
                dropdownElement.appendChild(playerElement);
                this.playerElements.push(playerElement);
            }
            let addPlayerButton = document.createElement("button");
            addPlayerButton.classList.add("add-player");
            addPlayerButton.innerHTML = '<i class="fa-solid fa-plus"></i>' + translate("app.button.players.add");
            addPlayerButton.onclick = toggleMicrosoftSignIn;
            dropdownElement.appendChild(addPlayerButton);
            if (!alreadyThere) document.body.appendChild(dropdownElement);
        } else {
            this.element.removeAttribute("popovertarget");
            if (this.dropdownElement) this.dropdownElement.hidePopover();
            this.element.innerHTML = ``;
            let img = document.createElement("img");
            img.className = "player-head-menu";
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
    }
    selectPlayer(newPlayerInfo) {
        if (!this.players.map(e => e.uuid).includes(newPlayerInfo.uuid)) {
            this.addPlayer(newPlayerInfo);
        }
        this.default_player = newPlayerInfo;
        newPlayerInfo.setDefault();
        this.element.innerHTML = ``;
        let img = document.createElement("img");
        img.className = "player-head-menu";
        getPlayerHead(newPlayerInfo, (e) => img.src = e);
        this.element.appendChild(img);
        let pInfo = document.createElement("div");
        pInfo.className = "player-info";
        this.element.appendChild(pInfo);
        let pName = document.createElement("div");
        pName.className = "player-name";
        pName.textContent = newPlayerInfo.name;
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
            if (this.playerElements[i].dataset.uuid != newPlayerInfo.uuid) {
                this.playerElements[i].classList.add("not-selected");
            } else {
                this.playerElements[i].classList.remove("not-selected");
            }
        }
        if (Display.currentScreen.tabName == "wardrobe") {
            wardrobeScreen.display();
        }
        if (Display.currentScreen.tabName == "friends") {
            friendsScreen.display();
        }
        if (Display.currentScreen.tabName == "home") {
            homeScreen.changeHomeWelcome();
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
        if (Display.currentScreen.tabName == "wardrobe") {
            wardrobeScreen.display();
        }
        if (Display.currentScreen.tabName == "friends") {
            friendsScreen.display();
        }
        if (Display.currentScreen.tabName == "home") {
            homeScreen.changeHomeWelcome();
        }
    }
}

async function getPlayerHead(profile, callback) {
    if (!profile) {
        callback("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAAXNSR0IArs4c6QAAANNJREFUKFNjNFYR/M/AwMDAw8YCouDgy68/DD9+/WFgVJHg+M/PwwmWgCkCSYLYIJpRW473f4GrDYOEmCgDCxcvw59vnxm+//zN8PHjB4aZh04yMM5O9vzPzy/AwMnOCjYFJAkDIEWMq4oi/4f2LmMItutiiDC9ANa5/ZYDw9pDZQyri6MQJoB0HTh3HazZwUgTTINNmBBp//8/63+GXccvMejJqoIlTt++yuDraMLw6etvBsYpCXb/337+zXDw1EUGdg42hp8/foFpCz1NBj5uVgYAzxRTZRWSVwUAAAAASUVORK5CYII=");
        return;
    }
    let skin = await profile.getActiveSkin();
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
                content.display();
            }
        }
        element.classList.add("menu-button");
        let navIcon = document.createElement("div");
        navIcon.classList.add("menu-icon");
        navIcon.innerHTML = icon;
        let navTitle = document.createElement("div");
        navTitle.classList.add("menu-title");
        navTitle.textContent = title;
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

function resetDiscordStatus(bypassLock) {
    if (!rpcLocked || bypassLock) {
        window.enderlynx.setActivity({
            details: translate("app.discord_rpc.enderlynx"),
            state: translate("app.discord_rpc.not_playing"),
            largeImageKey: 'icon',
            largeImageText: translate("app.discord_rpc.logo"),
            instance: false
        });
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
        innerName.textContent = translate("app.instances.no_running");
        name.appendChild(innerName);
        this.nameElement = innerName;
        let buttons = createElement("div", "live-buttons");
        let viewButton = document.createElement("div");
        viewButton.className = "live-view";
        viewButton.innerHTML = '<i class="fa-regular fa-eye"></i>';
        let stopButton = document.createElement("div");
        stopButton.className = "live-stop";
        stopButton.innerHTML = '<i class="fa-regular fa-circle-stop"></i>';
        let logButton = document.createElement("div");
        logButton.className = "live-log";
        logButton.innerHTML = '<i class="fa-solid fa-terminal"></i>';
        this.stopButton = stopButton;
        this.logButton = logButton;
        this.viewButton = viewButton;
        buttons.appendChild(stopButton);
        buttons.appendChild(viewButton);
        buttons.appendChild(logButton);
        element.appendChild(indicator);
        element.appendChild(name);
        element.appendChild(buttons);
        this.live_instance_id = null;
    }
    setLive(instanceInfo) {
        this.nameElement.textContent = instanceInfo.name;
        this.element.classList.add("minecraft-live");
        this.stopButton.onclick = async () => {
            await instanceInfo.stop();
            this.findLive();
        }
        this.logButton.onclick = () => {
            instanceInfo.display("logs");
        }
        this.viewButton.onclick = () => {
            instanceInfo.display();
        }
        if (this.live_instance_id != instanceInfo.instance_id) window.enderlynx.setActivity({
            details: translate("app.discord_rpc.playing", "%i", instanceInfo.name),
            state: translate("app.discord_rpc.description", "%l", loaders[instanceInfo.loader], "%v", instanceInfo.vanilla_version),
            startTimestamp: new Date(),
            largeImageKey: 'icon',
            largeImageText: translate("app.discord_rpc.logo"),
            smallImageKey: 'minecraft',
            smallImageText: translate("app.discord_rpc.minecraft.logo"),
            instance: false
        });
        this.live_instance_id = instanceInfo.instance_id;
        rpcLocked = true;
    }
    removeLive() {
        this.nameElement.textContent = translate("app.instances.no_running");
        this.element.classList.remove("minecraft-live");
        this.element.oncontextmenu = () => { };
        this.stopButton.onclick = () => { };
        this.logButton.onclick = () => { };
        this.viewButton.onclick = () => { };
        this.live_instance_id = null;
        resetDiscordStatus(true);
        rpcLocked = false;
    }
    async findLive() {
        for (const instance of await getInstances()) {
            if (window.enderlynx.checkForProcess(instance.pid)) {
                this.setLive(instance);
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
            buttonElement.textContent = options[i].name;
            buttonElement.onclick = (e) => {
                this.selectOption(options[i].value);
            }
            element.appendChild(buttonElement);
            options[i].element = buttonElement;
        }
        this.element.appendChild(createElement("div", "tab-height-adjust", { textContent: "A" }))
        this.options = options;
        options[0].element.classList.add("selected");
        this.selected = options[0].value;
    }
    get getSelected() {
        return this.selected;
    }
    selectOption(val) {
        let opt;
        for (let i = 0; i < this.options.length; i++) {
            if (this.options[i].value == this.selected) {
                if (this.options[i].closeFunc) {
                    this.options[i].closeFunc();
                }
            }
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
    setNotifications(val, number) {
        for (let i = 0; i < this.options.length; i++) {
            if (this.options[i].value == val) {
                this.options[i].element.dataset.notifications = number;
            }
        }
    }
}

class TabContentVertical {
    constructor(element, options) {
        this.element = element;
        element.classList.add("tab-list-vertical");
        for (let i = 0; i < options.length; i++) {
            let buttonElement = document.createElement("button");
            buttonElement.classList.add("tab-button-vertical");
            buttonElement.textContent = options[i].name;
            buttonElement.onclick = (e) => {
                this.selectOption(options[i].value);
            }
            element.appendChild(buttonElement);
            options[i].element = buttonElement;
        }
        this.options = options;
        options[0].element.classList.add("selected");
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
        this.element = element;
        this.triggerElement = ele;
        ele.setAttribute("popovertarget", id);
        element.id = id;
        this.buttons = buttons;
        this.refreshButtons();
    }
    async refreshButtons() {
        this.element.innerHTML = "";
        for (let button of this.buttons.buttons) {
            let buttonElement = createElement("button", "context-menu-button");
            let icon = typeof button.icon === "function" ? await button.icon() : button.icon;
            let title = typeof button.title === "function" ? await button.title() : button.title;
            buttonElement.innerHTML = icon + sanitize(title);
            if (button.danger) {
                buttonElement.classList.add("danger");
            }
            buttonElement.onclick = (e) => {
                this.element.hidePopover();
                button.func(new MenuOption(buttonElement, button.title, button.icon), this.element);
            }
            if (button.type == "play-button") {
                InstanceStateManagement.registerButton(buttonElement, button.instance, button.world || null, false, true, () => {
                    this.element.hidePopover();
                }, button.goToInstancePageWhenClicked);
            }
            this.element.appendChild(buttonElement);
        }
    }

    static clearMenus() {
        [...document.getElementsByClassName("more-menu")].forEach(e => {
            let id = e.id;
            if (!document.querySelector(`[popovertarget="${id}"]`)) {
                InstanceStateManagement.removeButtons(e.children);
                e.remove();
            }
        });
    }
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
            this.hideContextMenu();
        });

        document.body.addEventListener("pointerdown", (e) => {
            ignoreNextPointerUp = false;
        });

        document.body.addEventListener('keydown', (e) => {
            if (e.key == "Escape") {
                this.hideContextMenu();
            }
        });
    }
    async showContextMenu(buttons, x, y) {
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
        for (let button of buttons.buttons) {
            let buttonElement = createElement("button", "context-menu-button");
            let icon = typeof button.icon === "function" ? await button.icon() : button.icon;
            let title = typeof button.title === "function" ? await button.title() : button.title;
            buttonElement.innerHTML = icon + sanitize(title);
            if (button.danger) {
                buttonElement.classList.add("danger");
            }
            buttonElement.onclick = (e) => {
                this.hideContextMenu();
                button.func(new MenuOption(buttonElement, button.title, button.icon));
            }
            if (button.type == "play-button") {
                InstanceStateManagement.registerButton(buttonElement, button.instance, button.world || null, false, true, () => {
                    this.hideContextMenu();
                }, button.goToInstancePageWhenClicked);
            }
            this.element.appendChild(buttonElement);
        }
        this.element.showPopover();
        ignoreNextPointerUp = true;
    }
    hideContextMenu() {
        InstanceStateManagement.removeButtons(this.element.children);
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
            this.value = "";
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
    setValue(value) {
        this.value = value;
        this.input.value = value;
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
        dropdownTitle.textContent = title;
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
        this.selectedElement.textContent = name || initial;
        this.popover.innerHTML = "";
        for (let i = 0; i < options.length; i++) {
            let optEle = document.createElement("button");
            optEle.classList.add("dropdown-item");
            optEle.textContent = options[i].name;
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
    selectOption(option, disableOnChange) {
        let name = "";
        for (let i = 0; i < this.options.length; i++) {
            if (this.options[i].value == option) {
                name = this.options[i].name;
                break;
            }
        }
        this.selectedElement.textContent = name;
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
        if (this.onchange && !disableOnChange) this.onchange(option);
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
        let close = () => {
            this.dropdownList.hidePopover();
            let values = this.options.filter(e => e.value.toLowerCase() == dropdownSearchInput.value.trim().toLowerCase());
            if (values.length > 0) {
                this.selectOption(values[0].value);
            }
        }
        let closePointer = (e) => {
            if (!this.dropdownList.matches(':popover-open')) return;
            const t = e.target;
            if (this.dropdownList.contains(t)) return;
            if (t === dropdownSearchInput || dropdownSearchInput.contains(t)) return;
            close();
            document.body.removeEventListener('pointerup', closePointer);
            document.body.removeEventListener('keydown', closeEscape);
        }
        let closeEscape = (e) => {
            if (e.key == "Escape") {
                if (this.dropdownList.matches(":popover-open")) e.preventDefault();
                close();
                document.body.removeEventListener('pointerup', closePointer);
                document.body.removeEventListener('keydown', closeEscape);
            }
        }
        document.body.addEventListener('pointerup', closePointer, true);
        document.body.addEventListener('keydown', closeEscape, true);
    }
    filter() {
        let value = this.dropdownSearchInput.value.toLowerCase().trim();
        if (!value) {
            this.optEles.forEach(e => {
                e.style.display = "";
                this.popover.appendChild(e);
            });
            return;
        }
        let exactMatches = [];
        let startMatches = [];
        let otherMatches = [];
        this.optEles.forEach(e => {
            let text = e.innerHTML.toLowerCase();
            if (!text.includes(value)) {
                e.style.display = "none";
                return;
            }
            e.style.display = "";
            if (text == value) {
                exactMatches.push(e);
            } else if (text.startsWith(value)) {
                startMatches.push(e);
            } else {
                otherMatches.push(e);
            }
        });
        exactMatches.concat(startMatches, otherMatches).forEach(e => this.popover.appendChild(e));
    }
}

class Slider {
    constructor(element, min, max, initial, increment, unit) {
        element.classList.add("slider-wrapper");
        let slider = createElement("div", "slider");
        this.slider = slider;
        let sliderInput = document.createElement("input");
        sliderInput.className = "slider-text-box";
        sliderInput.type = "number";
        this.sliderInput = sliderInput;
        element.appendChild(slider);
        element.appendChild(sliderInput);
        this.min = min;
        this.max = max;
        this.disabled = false;
        this.setValue(initial);

        let lowerBound = document.createElement("div");
        lowerBound.className = "slider-label-left";
        lowerBound.textContent = min + " " + unit;

        let upperBound = document.createElement("div");
        upperBound.className = "slider-label-right";
        upperBound.textContent = max + " " + unit;

        slider.appendChild(lowerBound);
        slider.appendChild(upperBound);

        sliderInput.value = initial;
        sliderInput.step = increment;
        slider.style.setProperty("--slider-transition", "width .1s, left .1s, scale .2s");
        sliderInput.oninput = () => {
            let rawValue = Number(sliderInput.value);
            this.setValue(rawValue, true);
            if (this.onchange) this.onchange(this.value);
        }
        sliderInput.onchange = () => {
            let rawValue = Number(sliderInput.value);
            this.setValue(rawValue);
            if (this.onchange) this.onchange(this.value);
        }
        slider.onclick = (event) => {
            if (this.disabled) return;
            slider.style.setProperty("--slider-transition", "width .1s, left .1s, scale .2s");
            const rect = slider.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const percentage = Math.max(0, Math.min(1, x / rect.width));
            let value = min + percentage * (max - min);
            let snappedValue = Math.round(value / increment) * increment;
            this.setValue(snappedValue);
            sliderInput.dispatchEvent(new Event('input'));
            if (this.onchange) this.onchange(this.value);
        };
        let isDragging = false;

        slider.onmousedown = (event) => {
            if (this.disabled) return;
            isDragging = true;
            document.body.style.userSelect = "none";
            slider.style.setProperty("--slider-transition", "scale .2s");
        };

        document.addEventListener("mousemove", (event) => {
            if (this.disabled) return;
            if (!isDragging) return;
            const rect = slider.getBoundingClientRect();
            let x = event.clientX - rect.left;
            x = Math.max(0, Math.min(rect.width, x));
            const percentage = x / rect.width;
            let value = min + percentage * (max - min);
            let snappedValue = Math.round(value / increment) * increment;
            this.setValue(snappedValue);
            sliderInput.dispatchEvent(new Event('input'));
            if (this.onchange) this.onchange(this.value);
        });

        document.addEventListener("mouseup", () => {
            if (this.disabled) return;
            if (isDragging) {
                isDragging = false;
                document.body.style.userSelect = "";
            }
        });
    }

    setValue(value, dont_update_input) {
        if (value < this.min) value = this.min;
        if (value > this.max) value = this.max;
        let percentage = (value - this.min) / (this.max - this.min) * 100;
        this.slider.style.setProperty('--slider-percentage', percentage + "%");
        if (!dont_update_input) this.sliderInput.value = value;
        this.value = value;
    }

    addOnChange(onchange) {
        this.onchange = onchange;
    }

    disable() {
        this.sliderInput.disabled = true;
        this.disabled = true;
    }

    enable() {
        this.sliderInput.disabled = false;
        this.disabled = false;
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
    disable() {
        this.element.disabled = true;
    }
    enable() {
        this.element.disabled = false;
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
    constructor(element, content, searchBar, features, filter, notFoundMessage = translate("app.list.no_results_found"), scrollElement) {
        this.scrollElement = scrollElement;
        scrollElement.onscroll = () => {
            this.render(this.filteredItems);
        }
        const fragment = document.createDocumentFragment();
        let notFoundElement = new NoResultsFound(notFoundMessage).element;
        notFoundElement.style.background = "transparent";
        element.classList.add("content-list-wrapper");
        let contentListTop = document.createElement("div");
        contentListTop.className = "content-list-top";
        fragment.appendChild(contentListTop);

        let contentMainElement = document.createElement("div");
        contentMainElement.className = "content-list";
        if (features?.checkbox?.enabled) {
            let floatingControls = createElement("div", "floating-controls");
            contentMainElement.appendChild(floatingControls);
            this.floatingControls = floatingControls;
            let clearButton = createElement("button", "selected-clear selected-button");
            clearButton.textContent = translate("app.list.clear");
            clearButton.onclick = () => {
                this.uncheckCheckboxes();
                this.figureOutMainCheckedState();
            }
            let countElement = createElement("div", "selected-count");
            countElement.textContent = translate("app.list.count", "%c", 0);
            this.countElement = countElement;
            this.floatingControls.appendChild(countElement);
            this.floatingControls.appendChild(clearButton);
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

            if (features.checkbox.actionsList) features.checkbox.actionsList.forEach(e => {
                let actionElement = document.createElement("button");
                actionElement.className = "selected-button";
                actionElement.innerHTML = e.icon + e.title;
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
                floatingControls.appendChild(actionElement);
            });
        }
        let primaryColumnTitle = document.createElement("div");
        primaryColumnTitle.className = "content-list-title";
        primaryColumnTitle.textContent = features?.primary_column_name;
        contentListTop.appendChild(primaryColumnTitle);
        let secondaryColumnTitle = document.createElement("div");
        secondaryColumnTitle.className = "content-list-title";
        secondaryColumnTitle.textContent = features?.secondary_column_name;
        contentListTop.appendChild(secondaryColumnTitle);
        if (features?.refresh?.enabled) {
            let refreshButton = document.createElement("button");
            refreshButton.className = "content-list-refresh";
            refreshButton.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i>' + translate("app.button.content.refresh");
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

        searchBar.setOnInput((v) => {
            this.applyFilters(v, filter.value);
        });
        this.searchBar = searchBar;
        this.filter = filter;

        filter.setOnChange((v) => {
            this.applyFilters(searchBar.value, v);
        });

        contentMainElement.appendChild(notFoundElement);
        notFoundElement.style.display = "none";
        if (!content.length) {
            notFoundElement.style.display = "";
        }

        this.items = [];
        this.second_column_elements = [];

        let spacer = document.createElement("div");
        contentMainElement.appendChild(spacer);
        this.spacer = spacer;

        this.renderEntries(features, content, contentMainElement, fragment, element);
    }

    async renderEntries(features, content, contentMainElement, fragment, element) {
        let renderEntry = async (contentInfo) => {
            let contentEle = document.createElement("div");
            contentEle.classList.add("content-list-item");
            if (contentInfo.onclick) {
                makeArtificialButton(contentEle, () => {
                    contentInfo.onclick();
                }, ["button", "i", "input"]);
                contentEle.classList.add("content-list-button");
            }
            if (contentInfo.class) contentEle.classList.add(contentInfo.class);
            if (contentInfo.type) contentEle.dataset.type = contentInfo.type;
            let item = {
                "name": [contentInfo.primary_column.title, contentInfo.primary_column.desc, contentInfo.secondary_column.title(), contentInfo.secondary_column.desc()].join("!!!!!!!!!!"),
                "element": contentEle,
                "type": contentInfo.type,
                "height": contentInfo.icon ? 53 : 61
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
            if (contentInfo.icon) {
                let iconElement = document.createElement("span");
                iconElement.className = "content-list-icon";
                iconElement.innerHTML = contentInfo.icon;
                contentEle.appendChild(iconElement);
            } else {
                let imageElement = document.createElement("img");
                imageElement.className = "content-list-image";
                imageElement.src = fixPathForImage(contentInfo.image ? contentInfo.image : getDefaultImage(contentInfo.primary_column.title));
                imageElement.loading = "lazy";
                imageElement.onerror = () => {
                    if (contentInfo.onimagefail) {
                        contentInfo.onimagefail(imageElement);
                    }
                }
                contentEle.appendChild(imageElement);
            }
            let infoElement1 = document.createElement("div");
            infoElement1.className = "content-list-info";
            contentEle.appendChild(infoElement1);
            let infoElement1Title = document.createElement("div");
            infoElement1Title.className = "content-list-info-title-1";
            infoElement1Title.innerHTML = parseMinecraftFormatting(contentInfo.primary_column.title);
            infoElement1.appendChild(infoElement1Title);
            let infoElement1Desc = document.createElement("div");
            infoElement1Desc.className = "content-list-info-desc-1";
            infoElement1Desc.textContent = contentInfo.primary_column.desc;
            infoElement1.appendChild(infoElement1Desc);
            let infoElement2 = document.createElement("div");
            infoElement2.className = "content-list-info";
            contentEle.appendChild(infoElement2);
            let infoElement2Title = document.createElement("div");
            infoElement2Title.className = "content-list-info-title-2";
            infoElement2Title.textContent = await contentInfo.secondary_column.title();
            infoElement2.appendChild(infoElement2Title);
            let infoElement2Desc = document.createElement("div");
            infoElement2Desc.className = "content-list-info-desc-2";
            infoElement2Desc.innerHTML = (await contentInfo.secondary_column.desc());
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
                toggle = new Toggle(toggleElement, async (v) => {
                    let result = await toggleDisabledContent(contentInfo, theActionList, toggle, moreDropdown);
                    if (!result) {
                        toggle.setValueWithoutTrigger(!v);
                        return;
                    }
                    if (infoElement2Desc.innerHTML.endsWith(".disabled")) {
                        infoElement2Desc.textContent = infoElement2Desc.innerHTML.slice(0, -9);
                    } else {
                        infoElement2Desc.textContent = infoElement2Desc.innerHTML + ".disabled";
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
            if (contentInfo?.play?.enabled) {
                let playButton = createElement("button", "world-play-button");
                contentInfo.play.register(playButton);
                contentEle.appendChild(playButton);
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
                        ...e,
                        "func": func
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
            await renderEntry(content[i]);
        }
        this.contentElement = contentMainElement;
        fragment.appendChild(contentMainElement);
        element.appendChild(fragment);
        this.offset = ContentList.getRelativeOffset(contentMainElement, this.scrollElement);
        this.applyFilters("", "all");
    }

    reApplyFilters() {
        this.applyFilters(this.searchBar.value, this.filter.value);
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
        this.figureOutMainCheckedState();
    }

    removeElements(eles) {
        eles.forEach(e => e.remove);
        this.items = this.items.filter(e => !eles.includes(e.element));
        this.reApplyFilters();
        this.figureOutMainCheckedState();
    }

    render(items) {
        let h = 0;
        for (let i = 0; i < items.length; i++) h += items[i].height;
        this.contentElement.style.height = h + "px";
        const scrollTop = this.scrollElement.scrollTop;
        const viewportHeight = this.scrollElement.clientHeight;
        let rangeBottom = scrollTop - this.offset;
        let rangeTop = scrollTop + viewportHeight;
        let itemsHeight = 0;
        let spacerSet = false;
        let count = 0;
        let currentNode = this.spacer.nextSibling;
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const ele = item.element;
            itemsHeight += item.height;
            count++;
            const inRange = itemsHeight > rangeBottom && itemsHeight < rangeTop + 300;

            if (inRange) {
                if (!spacerSet) {
                    this.spacer.style.height = itemsHeight - item.height + "px";
                    spacerSet = true;
                }

                if (ele !== currentNode) {
                    this.contentElement.insertBefore(ele, currentNode);
                } else {
                    currentNode = currentNode.nextSibling;
                }
            } else {
                if (ele.parentNode === this.contentElement) {
                    if (currentNode === ele) {
                        currentNode = currentNode.nextSibling;
                    }
                    ele.remove();
                }
            }
        }

        this.totalText.innerHTML = translate("app.list.total", "%c", count);
        this.notFoundElement.style.display = count ? "none" : "";

        if (count === 0) {
            this.contentElement.style.height = "auto";
        }
    }

    applyFilters(search, dropdown) {
        this.filteredItems = this.items.filter(e => {
            let w = e.name.toLowerCase().includes(search.toLowerCase().trim()) && (e.type == dropdown || dropdown == "all");
            if (w) e.element.classList.remove("hidden");
            else {
                e.element.classList.add("hidden");
                if (e.element.parentNode === this.contentElement) {
                    e.element.remove();
                }
            }
            return w;
        });
        this.render(this.filteredItems);
    }

    updateSecondaryColumn() {
        let list = this.second_column_elements;
        list.forEach(async (e) => {
            e.infoElement2Title.textContent = await e.title_func();
            e.infoElement2Desc.textContent = await e.desc_func();
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
        this.floatingControls.classList.toggle("shown", checked > 0);
        this.countElement.textContent = translate("app.list.count", "%c", checked);
    }
    checkCheckboxes() {
        let count = 0;
        this.items.map(e => e.checkbox).forEach((e) => {
            if (this.isCheckboxVisible(e)) {
                count++;
                e.checked = true;
            }
        });
        this.floatingControls.classList.toggle("shown", count > 0);
        this.countElement.textContent = translate("app.list.count", "%c", count);
    }
    uncheckCheckboxes() {
        this.items.map(e => e.checkbox).forEach((e) => {
            if (this.isCheckboxVisible(e)) e.checked = false;
        });
        this.floatingControls.classList.remove("shown");
        this.countElement.textContent = translate("app.list.count", "%c", 0);
    }

    static getRelativeOffset(child, ancestor) {
        let offset = 0;
        let el = child;

        while (el && el !== ancestor) {
            offset += el.offsetTop;
            el = el.offsetParent;
        }

        return offset;
    }
}


async function toggleDisabledContent(contentInfo, theActionList, toggle, moreDropdown) {
    let content = await contentInfo.instance_info.getContent();
    for (let i = 0; i < content.length; i++) {
        let e = content[i];
        if (e.file_name == await contentInfo.secondary_column.desc()) {
            if (e.disabled) {
                let new_file_name = await window.enderlynx.enableFile(contentInfo.instance_info.instance_id, e.type == "mod" ? "mods" : e.type == "resourcepack" ? "resourcepacks" : "shaderpacks", e.file_name);
                if (!new_file_name) {
                    displayError(translate("app.error.failure_to_enable"));
                    return;
                }
                await e.setDisabled(false);
                await e.setFileName(new_file_name);
                contentInfo.secondary_column.desc = () => new_file_name;
                displaySuccess(translate("app.content.success_enable").replace("%s", e.name));
            } else {
                let new_file_name = await window.enderlynx.disableFile(contentInfo.instance_info.instance_id, e.type == "mod" ? "mods" : e.type == "resourcepack" ? "resourcepacks" : "shaderpacks", e.file_name);
                if (!new_file_name) {
                    displayError(translate("app.error.failure_to_disable"));
                    return;
                }
                await e.setDisabled(true);
                await e.setFileName(new_file_name);
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
            if (!document.body.contains(this.element)) {
                clearInterval(this.interval);
                return;
            }
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
        text.textContent = typeof e == 'string' ? e : e.message;
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

class Screen {
    constructor(tabName, navButton) {
        this.tabName = tabName;
        this.navButton = navButton;
        this.content = document.getElementById("content");
        this.contentElement = document.createElement("div");
    }
    calculateContent() { }
    async display(dont_add_to_log, ...args) {
        if (Display.currentScreen) {
            Display.currentScreen.onClose();
        }
        await this.calculateContent(...args);
        if (!dont_add_to_log) {
            Display.pageLog = Display.pageLog.slice(0, Display.pageIndex + 1).concat([() => {
                this.display(true);
            }]);
            Display.pageIndex++;
        }
        titleBar.updateTitleBarButtons();
        for (let i = 0; i < navButtons.length; i++) {
            navButtons[i].removeSelected();
        }
        this.navButton.setSelected();
        Display.currentScreen = this;
        this.content.innerHTML = "";
        this.content.appendChild(this.contentElement);
    }

    async requestFrame() {
        return new Promise((resolve) => {
            requestAnimationFrame(() => {
                resolve();
            });
        });
    }

    setNavButton(button) {
        this.navButton = button;
    }

    onClose() { }
}

class InstanceScreen extends Screen {
    constructor(instance) {
        super("instance", instancesButton);
        this.instance = instance;
        this.world_play_buttons = [];
    }

    onClose() {
        InstanceStateManagement.removeButtons([this.playButton]);
        this.closeWorlds();
    }

    calculateContent(default_tab) {
        this.contentElement.innerHTML = "";
        this.contentElement.className = "instance-content";
        let topBar = createElement("div", "instance-top");
        let instanceImage = createElement("img", "instance-top-image", { src: this.instance.image || getDefaultImage(this.instance.instance_id) });
        instanceImage.onerror = () => {
            instanceImage.src = getDefaultImage(this.instance.instance_id)
        };
        this.instance.watchForChange("image", (image) => [
            instanceImage.src = image || getDefaultImage(this.instance.instance_id)
        ]);
        topBar.appendChild(instanceImage);
        let instanceInfo = createElement("div", "instance-top-info");
        let instanceTitle = createElement("h1", "instance-top-title", { textContent: this.instance.name });
        this.instance.watchForChange("name", (name) => {
            instanceTitle.textContent = name;
        });
        instanceInfo.appendChild(instanceTitle);
        let instanceSubInfo = createElement("div", "instance-top-sub-info");
        this.loader_text = loaders[this.instance.loader];
        this.version_text = this.instance.vanilla_version;
        let instanceTopVersions = createElement("div", "instance-top-sub-info-specific", { innerHTML: `<i class="fa-solid fa-gamepad"></i>${sanitize(this.loader_text + " " + this.version_text)}` });
        this.instance.watchForChange("loader", (loader) => {
            this.loader_text = loaders[loader];
            instanceTopVersions.innerHTML = `<i class="fa-solid fa-gamepad"></i>${sanitize(this.loader_text + " " + this.version_text)}`;
        });
        this.instance.watchForChange("vanilla_version", (version) => {
            this.version_text = version;
            instanceTopVersions.innerHTML = `<i class="fa-solid fa-gamepad"></i>${sanitize(this.loader_text + " " + this.version_text)}`;
        });
        this.last_played = new Date(this.instance.last_played);
        this.playtime = this.instance.playtime + (this.running ? Math.floor((new Date().getTime() - this.last_played.getTime()) / 1000) : 0);
        let instanceTopPlaytime = createElement("div", "instance-top-sub-info-specific", { title: translate("app.instances.play_time"), innerHTML: `<i class="fa-solid fa-clock"></i>${formatTime(this.playtime)}` });
        this.instance.watchForChange("playtime", (time) => {
            if (!this.running) instanceTopPlaytime.innerHTML = `<i class="fa-solid fa-clock"></i>${formatTime(time)}`
            this.playtime = time;
        });
        this.playtimeInterval = setInterval(() => {
            if (!document.body.contains(instanceTopPlaytime)) clearInterval(this.playtimeInterval);
            if (!this.running) return;
            instanceTopPlaytime.innerHTML = `<i class="fa-solid fa-clock"></i>${formatTime(this.playtime + Math.floor((new Date().getTime() - this.last_played.getTime()) / 1000))}`;
        }, 1000);
        let instanceTopLastPlayed = createElement("div", "instance-top-sub-info-specific", { title: translate("app.instances.last_played", "%t", formatDate(this.last_played, 2000)), innerHTML: `<i class="fa-solid fa-clock-rotate-left"></i>${formatTimeRelatively(this.last_played)}` });
        if (howLongAgo(this.last_played) < 3600000) {
            this.lastPlayedInterval = setInterval(() => {
                instanceTopLastPlayed.innerHTML = `<i class="fa-solid fa-clock-rotate-left"></i>${formatTimeRelatively(this.last_played)}`;
            }, 60000);
        } else if (howLongAgo(this.last_played) < 86400000) {
            this.lastPlayedInterval = setInterval(() => {
                instanceTopLastPlayed.innerHTML = `<i class="fa-solid fa-clock-rotate-left"></i>${formatTimeRelatively(this.last_played)}`;
            }, 3600000);
        }
        this.instance.watchForChange("last_played", (date) => {
            this.last_played = new Date(date);
            instanceTopLastPlayed.title = translate("app.instances.last_played", "%t", formatDate(this.last_played, 2000));
            instanceTopLastPlayed.innerHTML = `<i class="fa-solid fa-clock-rotate-left"></i>${formatTimeRelatively(this.last_played)}`;
            clearInterval(this.lastPlayedInterval);
            if (howLongAgo(date) < 3600000) {
                this.lastPlayedInterval = setInterval(() => {
                    instanceTopLastPlayed.innerHTML = `<i class="fa-solid fa-clock-rotate-left"></i>${formatTimeRelatively(this.last_played)}`;
                }, 60000);
            } else if (howLongAgo(date) < 86400000) {
                this.lastPlayedInterval = setInterval(() => {
                    instanceTopLastPlayed.innerHTML = `<i class="fa-solid fa-clock-rotate-left"></i>${formatTimeRelatively(this.last_played)}`;
                }, 3600000);
            }
        });
        instanceSubInfo.appendChild(instanceTopVersions);
        instanceSubInfo.appendChild(instanceTopPlaytime);
        instanceSubInfo.appendChild(instanceTopLastPlayed);
        instanceInfo.appendChild(instanceSubInfo);
        topBar.appendChild(instanceInfo);
        this.playButton = createElement("button", "instance-top-play-button");
        InstanceStateManagement.registerButton(this.playButton, this.instance, null);
        this.analyzeLogs();
        let threeDots = createElement("button", "instance-top-more", { innerHTML: '<i class="fa-solid fa-ellipsis-vertical"></i>' });
        let buttons = new ContextMenuButtons([
            {
                "icon": '<i class="fa-solid fa-gear"></i>',
                "title": translate("app.button.instances.open_settings"),
                "func": async (e) => {
                    this.instance.showSettingsDialog();
                }
            },
            {
                "icon": '<i class="fa-solid fa-folder"></i>',
                "title": translate("app.button.instances.open_folder"),
                "func": (e) => {
                    window.enderlynx.openInstanceFolder(this.instance.instance_id);
                }
            },
            {
                "icon": this.instance.isPinned() ? '<i class="fa-solid fa-thumbtack-slash"></i>' : '<i class="fa-solid fa-thumbtack"></i>',
                "title": this.instance.isPinned() ? translate("app.instances.unpin") : translate("app.instances.pin"),
                "func": async (e) => {
                    this.instance.isPinned() ? await this.instance.unpin() : await this.instance.pin();
                    e.setTitle(this.instance.isPinned() ? translate("app.instances.unpin") : translate("app.instances.pin"));
                    e.setIcon(this.instance.isPinned() ? '<i class="fa-solid fa-thumbtack-slash"></i>' : '<i class="fa-solid fa-thumbtack"></i>');
                }
            },
            {
                "icon": '<i class="fa-solid fa-desktop"></i>',
                "title": translate("app.instances.desktop_shortcut"),
                "func": () => {
                    this.instance.addDesktopShortcut();
                }
            },
            {
                "icon": '<i class="fa-solid fa-share"></i>',
                "title": translate("app.button.instances.share"),
                "func": (e) => {
                    this.instance.showShareDialog();
                }
            },
            {
                "icon": '<i class="fa-solid fa-copy"></i>',
                "title": translate("app.button.instances.duplicate"),
                "func": (e) => {
                    this.instance.showDuplicateDialog();
                }
            },
            {
                "icon": '<i class="fa-solid fa-wrench"></i>',
                "title": translate("app.button.instances.repair"),
                "func": () => {
                    this.instance.showRepairDialog();
                }
            },
            {
                "icon": '<i class="fa-solid fa-trash-can"></i>',
                "title": translate("app.button.instances.delete"),
                "func": (e) => {
                    this.instance.showDeleteDialog(() => {
                        instancesScreen.display();
                    });
                },
                "danger": true
            }
        ].filter(e => e));
        let moreMenu = new MoreMenu(threeDots, buttons);
        topBar.appendChild(this.playButton);
        topBar.appendChild(threeDots);
        topBar.appendChild(moreMenu.element);
        this.contentElement.appendChild(topBar);
        let tabContent = createElement("div");
        this.contentElement.appendChild(tabContent);
        let tabsInfo = createElement("div", "tab-info");
        this.contentElement.appendChild(tabsInfo);
        this.tabElement = tabsInfo;
        this.tabs = new TabContent(tabContent, [
            {
                "name": translate("app.instances.tabs.content"),
                "value": "content",
                "func": () => {
                    this.showContent();
                }
            },
            {
                "name": translate("app.instances.tabs.worlds"),
                "value": "worlds",
                "func": () => {
                    this.showWorlds();
                },
                "closeFunc": () => {
                    this.closeWorlds();
                }
            },
            {
                "name": translate("app.instances.tabs.logs"),
                "value": "logs",
                "func": async () => {
                    this.showLogs();
                }
            },
            {
                "name": translate("app.instances.tabs.options"),
                "value": "options",
                "func": () => {
                    this.showOptions();
                }
            },
            {
                "name": translate("app.instances.tabs.files"),
                "value": "files",
                "func": () => {
                    this.showFiles();
                }
            },
            {
                "name": translate("app.instances.tabs.screenshots"),
                "value": "screenshots",
                "func": () => {
                    this.showScreenshots();
                }
            }
        ]);
        this.tabs.selectOption(default_tab || "content");
    }

    async display(dont_add_to_log, ...args) {
        await super.display(dont_add_to_log, ...args);
    }

    async analyzeLogs() {
        let info = await window.enderlynx.analyzeLogs(this.instance.instance_id);
        await this.instance.setPlaytime(info.total_playtime + this.instance.playtime);
        if (info.most_recent_log) await this.instance.setLastAnalyzedLog(info.most_recent_log);
        for (let i = 0; i < info.last_played_servers.length; i++) {
            let entry = info.last_played_servers[i];
            await window.enderlynx.setServerLastPlayed(this.instance.instance_id, entry[1] + ":" + entry[2], entry[0]);
        }
    }

    async showContent() {
        this.currentTab = "content";
        let loading = new LoadingContainer();
        this.tabElement.innerHTML = "";
        this.tabElement.appendChild(loading.element);
        await this.requestFrame();
        MoreMenu.clearMenus();
        let fileDrop = createElement("div", "small-drop-overlay drop-overlay");
        fileDrop.dataset.action = "content-import";
        fileDrop.dataset.instanceId = this.instance.instance_id;
        let fileDropInner = createElement("div", "drop-overlay-inner", { innerHTML: translate("app.import.content.drop") });
        fileDrop.appendChild(fileDropInner);
        let instanceLockedBanner = createElement("div", "instance-locked-banner");
        let instanceLockedText = createElement("span", undefined, { innerHTML: translate("app.instance.locked", "%c", translate("app.discover." + this.instance.install_source)) });
        let instanceLockedButton = createElement("button", "instance-locked-button", { innerHTML: '<i class="fa-solid fa-unlock"></i>' + translate("app.instance.unlock") });
        instanceLockedButton.onclick = async () => {
            await this.instance.setLocked(false);
            await this.instance.setInstallSource("custom");
            await this.instance.setInstallId("");
            await this.instance.setInstalledVersion("");
            this.display();
        }
        instanceLockedBanner.appendChild(instanceLockedText);
        instanceLockedBanner.appendChild(instanceLockedButton);
        let searchAndFilter = createElement("div", "search-and-filter-v2");
        let importContent = createElement("button", "add-content-button", { innerHTML: '<i class="fa-solid fa-plus"></i>' + translate("app.content.import") });
        importContent.onclick = () => {
            let dialog = new Dialog();
            dialog.showDialog(translate("app.content.import.title"), "form", [
                {
                    "type": "file-upload",
                    "id": "files",
                    "name": translate("app.content.import.files"),
                    "files_allowed": true,
                    "folders_allowed": false,
                    "file_types_allowed": ["zip", "jar"],
                    "file_types_name": translate("app.content.import.files.types"),
                    "max_amount_allowed": -1
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
                            "value": "resourcepack"
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
            ], [], async (info) => {
                document.body.classList.add("loading");
                for (let file of info.files) {
                    let success = await window.enderlynx.importContent(file.path, info.content_type, this.instance.instance_id);
                    if (!success) {
                        displayError(translate("app.content.import.failed", "%f", file.basename));
                    }
                }
                document.body.classList.remove("loading");
                displaySuccess(translate("app.content.import.done"));
                if (this.currentTab == "content") this.showContent();
            })
        }
        let addContent = createElement("button", "add-content-button", { innerHTML: '<i class="fa-solid fa-plus"></i>' + translate("app.button.content.add") });
        addContent.onclick = async () => {
            discoverScreen.display(false, this.instance, this.instance.vanilla_version, this.instance.loader);
        }
        if (this.instance.locked) {
            importContent.onclick = () => { };
            importContent.style.opacity = ".5";
            importContent.style.cursor = "not-allowed";
            importContent.title = translate("app.instances.locked.tooltip");
            addContent.onclick = () => { };
            addContent.style.opacity = ".5";
            addContent.style.cursor = "not-allowed";
            addContent.title = translate("app.instances.locked.tooltip");
        }
        let contentSearch = createElement("div");
        contentSearch.style.flexGrow = 2;
        let searchBar = new SearchBar(contentSearch, () => { }, null);
        let typeDropdown = createElement("div");
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
                "value": "resourcepack"
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
        let contentListWrap = createElement("div");
        let checkForPlayerContent = async () => {
            let instanceContent = await this.instance.getContent();
            let old_file_names = instanceContent.map((e) => e.file_name);
            let newContent = await this.instance.getContentFiles();
            let newContentAdd = newContent.newContent.filter((e) => !old_file_names.includes(e.file_name));
            for (let i = 0; i < newContentAdd.length; i++) {
                let e = newContentAdd[i];
                await this.instance.addContent(e.name, e.author, e.image, e.file_name, e.source, e.type, e.version, e.source_id, e.disabled, e.version_id);
            }
            let deleteContent = newContent.deleteContent;
            for (let i = 0; i < deleteContent.length; i++) {
                let e = deleteContent[i];
                let index = old_file_names.indexOf(e);
                await instanceContent[index].delete();
            }
        }
        let showContent = async () => {
            contentListWrap.innerHTML = '';
            let content = [];
            let instance_content = await this.instance.getContent();
            instance_content.sort((a, b) => {
                let aName = a.name.replace(/§./g, '');
                let bName = b.name.replace(/§./g, '');
                return aName.localeCompare(bName, undefined, {
                    sensitivity: "base"
                });
            });
            for (let i = 0; i < instance_content.length; i++) {
                let e = instance_content[i];
                content.push({
                    "primary_column": {
                        "title": e.name,
                        "desc": e.author ? "by " + e.author : ""
                    },
                    "secondary_column": {
                        "title": () => e.version,
                        "desc": () => e.file_name
                    },
                    "type": e.type,
                    "class": e.source,
                    "image": e.image,
                    "onimagefail": async (ele) => {
                        if (e.source == "modrinth" || e.source == "curseforge") {
                            try {
                                let project = await Project.getFromId(e.source_info, e.source);
                                await e.setImage(project.icon);
                                ele.src = fixPathForImage(project.icon || getDefaultImage(e.name));
                            } catch (f) {
                                ele.src = fixPathForImage(getDefaultImage(e.name));
                            }
                        } else {
                            ele.src = fixPathForImage(getDefaultImage(e.name));
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
                            let success = await window.enderlynx.deleteContent(this.instance.instance_id, e.type, e.file_name);
                            if (success) {
                                displaySuccess(translate("app.content.delete.success").replace("%c", e.name));
                                await e.delete();
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
                                "func": async () => {
                                    window.enderlynx.showContentInFolder(this.instance.instance_id, e.type == "mod" ? "mods" : e.type == "resourcepack" ? "resourcepacks" : "shaderpacks", e.file_name);
                                }
                            },
                            e.source == "modrinth" || e.source == "curseforge" ? {
                                "title": translate("app.content.view"),
                                "icon": '<i class="fa-solid fa-circle-info"></i>',
                                "func": async () => {
                                    displayContentInfo(e.source, undefined, e.source_info, this.instance.instance_id, this.instance.vanilla_version, this.instance.loader, this.instance.locked, false, contentList);
                                }
                            } : null,
                            !this.instance.locked && (e.source == "modrinth" || e.source == "curseforge") ? {
                                "title": translate("app.content.change_version"),
                                "icon": '<i class="fa-solid fa-arrow-right-arrow-left"></i>',
                                "func": async () => {
                                    displayContentInfo(e.source, undefined, e.source_info, this.instance.instance_id, this.instance.vanilla_version, this.instance.loader, this.instance.locked, false, contentList, "files");
                                }
                            } : null,
                            e.source == "vanilla_tweaks" && !this.instance.locked ? {
                                "title": translate("app.content.edit_packs"),
                                "icon": '<i class="fa-solid fa-pencil"></i>',
                                "func": async () => {
                                    displayVanillaTweaksEditor(this.instance.instance_id, this.instance.vanilla_version, JSON.parse(e.version_id), e);
                                }
                            } : null,
                            this.instance.locked ? null : e.source == "player_install" ? null : {
                                "title": translate("app.content.update"),
                                "icon": '<i class="fa-solid fa-download"></i>',
                                "func_id": "update",
                                "func": async () => {
                                    try {
                                        let s = await updateContent(e.source, e, new Project(), undefined, this.instance);
                                        if (s !== false) displaySuccess(translate("app.content.updated", "%c", e.name));
                                        if (contentList?.updateSecondaryColumn) contentList.updateSecondaryColumn();
                                    } catch (f) {
                                        displayError(translate("app.content.update_failed", "%c", e.name));
                                        throw f;
                                    }
                                }
                            },
                            this.instance.locked ? null : {
                                "title": e.disabled ? translate("app.content.enable") : translate("app.content.disable"),
                                "icon": e.disabled ? '<i class="fa-solid fa-eye"></i>' : '<i class="fa-solid fa-eye-slash"></i>',
                                "func_id": "toggle"
                            },
                            this.instance.locked ? null : {
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
                                        let success = await window.enderlynx.deleteContent(this.instance.instance_id, e.type, e.file_name);
                                        if (success) {
                                            displaySuccess(translate("app.content.delete.success", "%c", e.name));
                                            await e.delete();
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
                    "instance_info": this.instance,
                    "pass_to_checkbox": e
                });
            }
            let contentList = new ContentList(contentListWrap, content, searchBar, {
                "checkbox": {
                    "enabled": this.instance.locked ? false : true,
                    "actionsList": [
                        this.instance.locked ? null : {
                            "title": translate("app.content.selection.update"),
                            "icon": '<i class="fa-solid fa-download"></i>',
                            "func": async (ele, e) => {
                                try {
                                    let s = await updateContent(e.source, e, new Project(), undefined, this.instance);
                                    if (s !== false) displaySuccess(translate("app.content.updated", "%c", e.name));
                                    if (contentList?.updateSecondaryColumn) contentList.updateSecondaryColumn();
                                } catch (f) {
                                    displayError(translate("app.content.update_failed", "%c", e.name));
                                    throw f;
                                }
                            }
                        },
                        this.instance.locked ? null : {
                            "title": translate("app.content.selection.enable"),
                            "icon": '<i class="fa-solid fa-eye"></i>',
                            "func_id": "enable",
                            "func": () => { }
                        },
                        this.instance.locked ? null : {
                            "title": translate("app.content.selection.disable"),
                            "icon": '<i class="fa-solid fa-eye-slash"></i>',
                            "func_id": "disable",
                            "func": () => { }
                        },
                        this.instance.locked ? null : {
                            "title": translate("app.content.selection.delete"),
                            "icon": '<i class="fa-solid fa-trash-can"></i>',
                            "danger": true,
                            "func": async (ele, e) => {
                                let success = await window.enderlynx.deleteContent(this.instance.instance_id, e.type, e.file_name);
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
                    "enabled": this.instance.locked ? false : true
                },
                "remove": {
                    "enabled": this.instance.locked ? false : true
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
                        this.showContent();
                    }
                },
                "update_all": {
                    "enabled": this.instance.locked ? false : true,
                    "func": async (b) => {
                        b.innerHTML = "<i class='spinner'></i>" + translate("app.content.updating")
                        let content = await this.instance.getContent();
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
                                }
                            }]);
                            let c = content[i];
                            try {
                                await updateContent(c.source, c, new Project(), undefined, this.instance);
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
                                    "cancel": () => { }
                                }]);
                                if (this.currentTab == "content") this.showContent();
                                return;
                            }
                        }
                        log.sendData([{
                            "title": "Updating Content",
                            "progress": 100,
                            "desc": "Done",
                            "id": processId,
                            "status": "done",
                            "cancel": () => { }
                        }]);
                        displaySuccess(translate("app.instances.updated_all", "%i", this.instance.name));
                        if (this.currentTab == "content") this.showContent();
                    }
                }
            }, dropdownInfo, translate("app.content.not_found"), this.contentElement);
        }
        let currently_installing = new CurrentlyInstalling();
        contentListWrap.appendChild(currently_installing.element);
        this.instance.watchForChange("installing", async (v) => {
            if (!v) {
                await checkForPlayerContent();
                await showContent();
            } else {
                contentListWrap.innerHTML = "";
                contentListWrap.appendChild(currently_installing.element);
            }
        });
        if (!this.instance.installing) {
            await checkForPlayerContent();
            await showContent();
        } else {
            contentListWrap.innerHTML = "";
            contentListWrap.appendChild(currently_installing.element);
        }
        const fragment = document.createDocumentFragment();
        this.tabElement.innerHTML = "";
        fragment.appendChild(fileDrop);
        if (this.instance.locked) {
            fragment.appendChild(instanceLockedBanner);
        }
        fragment.appendChild(searchAndFilter);
        fragment.appendChild(contentListWrap);
        this.tabElement.appendChild(fragment);
    }

    closeWorlds() {
        InstanceStateManagement.removeButtons(this.world_play_buttons);
    }

    async showWorlds() {
        this.currentTab = "worlds";
        let loading = new LoadingContainer();
        this.tabElement.innerHTML = "";
        this.tabElement.appendChild(loading.element);
        this.world_play_buttons = [];
        await this.requestFrame();
        MoreMenu.clearMenus();
        let searchAndFilter = document.createElement("div");
        searchAndFilter.classList.add("search-and-filter-v2");
        let importWorlds = document.createElement("button");
        importWorlds.classList.add("add-content-button");
        importWorlds.innerHTML = '<i class="fa-solid fa-plus"></i>' + translate("app.worlds.import")
        importWorlds.onclick = async () => {
            let dialog = new Dialog();
            dialog.showDialog(translate("app.worlds.import.title"), "form", [
                {
                    "type": "file-upload",
                    "id": "files",
                    "name": translate("app.worlds.import.files"),
                    "files_allowed": true,
                    "folders_allowed": true,
                    "file_types_allowed": ["zip"],
                    "file_types_name": translate("app.worlds.import.files.types"),
                    "max_amount_allowed": -1
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
            ], [], async (info) => {
                document.body.classList.add("loading");
                for (let file of info.files) {
                    let success = await window.enderlynx.importWorld(file.path, this.instance.instance_id);
                    if (!success) {
                        displayError(translate("app.worlds.import.failed", "%f", file.basename));
                    }
                }
                document.body.classList.remove("loading");
                displaySuccess(translate("app.worlds.import.done"));
                if (this.currentTab == "worlds") this.showWorlds();
            });
        }
        let addContent = document.createElement("button");
        addContent.classList.add("add-content-button");
        addContent.innerHTML = '<i class="fa-solid fa-plus"></i>' + translate("app.worlds.add")
        addContent.onclick = () => {
            discoverScreen.display(false, this.instance, this.instance.vanilla_version, this.instance.loader, "world");
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
            ], [], async (info) => {
                await window.enderlynx.addServer(this.instance.instance_id, info.ip, info.name);
                this.instance.instanceScreen.showWorlds();
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
        fileDrop.dataset.instanceId = this.instance.instance_id;
        fileDrop.className = "small-drop-overlay drop-overlay";
        let fileDropInner = document.createElement("div");
        fileDropInner.className = "drop-overlay-inner";
        fileDropInner.innerHTML = translate("app.import.worlds.drop");
        fileDrop.appendChild(fileDropInner);
        let worldList = [];

        let worlds = await this.instance.getSingleplayerWorlds();
        let worldsMultiplayer = await this.instance.getMultiplayerWorlds();
        worlds = worlds.concat(worldsMultiplayer);
        for (let world of worlds) {
            let world_description = "";
            if (world.type == "singleplayer") {
                world_description += translate("app.worlds.description." + world.mode);
            }
            if (world.mode == "survival" && !world.hardcore) {
                world_description += " - " + translate("app.worlds.description." + world.difficulty);
            }
            if (world.hardcore) {
                world_description += " - <span style='color:#ff1313'>" + translate("app.worlds.description.hardcore") + "</span>";
            }
            if (world.commands) {
                world_description += " - " + translate("app.worlds.description.commands");
            }
            if (world.type == "multiplayer") {
                world.last_played = await this.instance.getServerLastPlayed(world.ip);
            } else {
                world.last_played = new Date(world.last_played);
            }
            let info = {
                "primary_column": {
                    "title": world.name,
                    "desc": world.last_played.getFullYear() < 2000 || isNaN(world.last_played.getFullYear()) ? translate("app.never_played") : translate("app.worlds.last_played").replace("%s", formatTimeRelatively(world.last_played))
                },
                "secondary_column": {
                    "title": () => translate("app.worlds.description." + world.type),
                    "desc": () => world_description || world.ip,
                    "desc_hidden": world.type == "multiplayer"
                },
                "type": world.type,
                "image": world.icon ?? getDefaultImage(world.id),
                "onremove": (ele) => {
                    let dialog = new Dialog();
                    dialog.showDialog(translate("app.worlds.delete.confirm.title"), "notice", translate("app.worlds.delete.confirm.description", "%w", parseMinecraftFormatting(world.name)), [
                        {
                            "type": "cancel",
                            "content": translate("app.worlds.delete.cancel")
                        },
                        {
                            "type": "confirm",
                            "content": translate("app.worlds.delete.confirm")
                        }
                    ], [], async () => {
                        let success;
                        if (world.type == "singleplayer") {
                            success = await window.enderlynx.deleteWorld(this.instance.instance_id, world.id);
                        } else if (world.type == "multiplayer") {
                            success = await window.enderlynx.deleteServer(this.instance.instance_id, [world.ip], [world.index])
                        }
                        if (success) {
                            contentList.removeElement(ele);
                            displaySuccess(translate("app.worlds.delete.success", "%w", parseMinecraftFormatting(world.name)));
                        } else {
                            displayError(translate("app.worlds.delete.fail", "%w", parseMinecraftFormatting(world.name)));
                        }
                    });
                },
                "more": {
                    "actionsList": [
                        this.instance.supportsQuickPlayType(world.type) ? {
                            "type": "play-button",
                            "instance": this.instance,
                            "world": world
                        } : null,
                        world.type == "singleplayer" ? {
                            "title": translate("app.worlds.open"),
                            "icon": '<i class="fa-solid fa-folder"></i>',
                            "func": () => {
                                window.enderlynx.openWorldFolder(this.instance.instance_id, world.id);
                            }
                        } : null,
                        {
                            "title": async () => await this.instance.isWorldPinned(world) ? translate("app.worlds.unpin") : translate("app.worlds.pin"),
                            "icon": async () => await this.instance.isWorldPinned(world) ? '<i class="fa-solid fa-thumbtack-slash"></i>' : '<i class="fa-solid fa-thumbtack"></i>',
                            "func": async (e) => {
                                let world_pinned = await this.instance.isWorldPinned(world);
                                world_pinned ? await this.instance.unpinWorld(world) : await this.instance.pinWorld(world);
                                e.setTitle(!world_pinned ? translate("app.worlds.unpin") : translate("app.worlds.pin"));
                                e.setIcon(!world_pinned ? '<i class="fa-solid fa-thumbtack-slash"></i>' : '<i class="fa-solid fa-thumbtack"></i>');
                            }
                        },
                        // {
                        //     "title": translate("app.worlds.share"),
                        //     "icon": '<i class="fa-solid fa-share"></i>',
                        //     "func": () => { }
                        // },
                        this.instance.supportsQuickPlayType(world.type) ? {
                            "icon": '<i class="fa-solid fa-desktop"></i>',
                            "title": translate("app.worlds.desktop_shortcut"),
                            "func": (e) => {
                                this.instance.addDesktopShortcutWorld(world.name, world.type, world.id || world.ip, world.icon ?? getDefaultImage(world.id || world.ip));
                            }
                        } : null,
                        {
                            "title": translate("app.worlds.delete"),
                            "icon": '<i class="fa-solid fa-trash-can"></i>',
                            "danger": true,
                            "func_id": "delete",
                            "func": (ele) => {
                                let dialog = new Dialog();
                                dialog.showDialog(translate("app.worlds.delete.confirm.title"), "notice", translate("app.worlds.delete.confirm.description", "%w", parseMinecraftFormatting(world.name)), [
                                    {
                                        "type": "cancel",
                                        "content": translate("app.worlds.delete.cancel")
                                    },
                                    {
                                        "type": "confirm",
                                        "content": translate("app.worlds.delete.confirm")
                                    }
                                ], [], async () => {
                                    let success;
                                    if (world.type == "singleplayer") {
                                        success = await window.enderlynx.deleteWorld(this.instance.instance_id, world.id);
                                    } else if (world.type == "multiplayer") {
                                        success = await window.enderlynx.deleteServer(this.instance.instance_id, [world.ip], [world.index])
                                    }
                                    if (success) {
                                        contentList.removeElement(ele);
                                        displaySuccess(translate("app.worlds.delete.success", "%w", parseMinecraftFormatting(world.name)));
                                    } else {
                                        displayError(translate("app.worlds.delete.fail", "%w", parseMinecraftFormatting(world.name)));
                                    }
                                });
                            }
                        }
                    ].filter(e => e)
                },
                "pass_to_checkbox": world
            };
            if (this.instance.supportsQuickPlayType(world.type)) {
                info.play = {
                    "enabled": true,
                    "register": (button) => {
                        InstanceStateManagement.registerButton(button, this.instance, world);
                        this.world_play_buttons.push(button);
                    }
                }
            }
            worldList.push(info);
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
                                    window.enderlynx.deleteWorld(this.instance.instance_id, e.id, (success) => {
                                        if (success) {
                                            contentList.removeElement(eles[i]);
                                            displaySuccess(translate("app.worlds.delete.success", "%w", parseMinecraftFormatting(e.name)));
                                        } else {
                                            displayError(translate("app.worlds.delete.fail", "%w", parseMinecraftFormatting(e.name)));
                                        }
                                    });
                                } else if (e.type == "multiplayer") {
                                    ips.push(e.ip);
                                    indexes.push(e.index);
                                    elesm.push(eles[i]);
                                    names.push(e.name);
                                }
                            }
                            if (!ips.length) return;
                            let success = await window.enderlynx.deleteServer(this.instance.instance_id, ips, indexes);
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
                    this.showWorlds();
                }
            },
            "update_all": {
                "enabled": false
            }
        }, dropdownInfo, translate("app.worlds.not_found"), this.contentElement);
        this.tabElement.innerHTML = "";
        this.tabElement.appendChild(fileDrop);
        this.tabElement.appendChild(searchAndFilter);
        this.tabElement.appendChild(contentListWrap);
        MoreMenu.clearMenus();
    }

    setLogColor(lineElement, text) {
        if (text.includes("INFO")) {
            lineElement.classList.add("log-info");
        } else if (text.includes("WARN")) {
            lineElement.classList.add("log-warn");
        } else if (text.includes("ERROR") || text.includes("FATAL") || text.includes("\tat ") || text.includes("Error:") || text.includes("Caused by:") || text.includes("Exception")) {
            lineElement.classList.add("log-error");
        }
    }

    async showLogs() {
        this.currentTab = "logs";
        let loading = new LoadingContainer();
        this.tabElement.innerHTML = "";
        this.tabElement.appendChild(loading.element);
        await this.requestFrame();
        MoreMenu.clearMenus();
        let deleteButton = document.createElement("button");
        let searchAndFilter = document.createElement("div");
        searchAndFilter.classList.add("search-and-filter-v2");
        let contentSearch = document.createElement("div");
        contentSearch.style.flexGrow = 2;
        let searchBarFilter = "";
        new SearchBar(contentSearch, (v) => {
            searchBarFilter = v.toLowerCase().trim();
            render();
        }, null);
        let typeDropdown = document.createElement("div");
        let log_info = await window.enderlynx.getInstanceLogs(this.instance.instance_id);
        let logDisplay = document.createElement("div");
        let visible = createElement("div", "logs-visible");
        let spacer = document.createElement("div");
        logDisplay.appendChild(visible);
        logDisplay.appendChild(spacer);
        let logs = [];
        let logHeight = 600;
        logResizeFunction = () => {
            const viewHeight = window.innerHeight;
            const editorRect = logDisplay.getBoundingClientRect();
            const distanceFromTop = editorRect.top;
            const calculatedHeight = viewHeight - distanceFromTop - 10;
            logDisplay.style.maxHeight = calculatedHeight + "px";
            logHeight = calculatedHeight;
            render();
        }
        let render = () => {
            let showLogs = logs.filter(e => e.content.toLowerCase().includes(searchBarFilter));
            const totalItems = showLogs.length;
            const itemHeight = 15;
            const containerHeight = logHeight;
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
        let setUpLiveLog = async () => {
            let log_path = this.instance.current_log_file;
            let running = checkForProcess(this.instance.pid);
            if (!running) {
                await this.instance.setPid(null);
                logs = [];
                let lineElement = document.createElement("span");
                lineElement.innerHTML = translate("app.logs.no_live");
                lineElement.classList.add("log-entry");
                logs.push({ "element": lineElement, "content": translate("app.logs.no_live") });
            } else {
                let logInfo = await window.enderlynx.getLog(log_path);
                logInfo = logInfo.split("\n");
                logs = [];
                logInfo.forEach((e) => {
                    if (e == "") return;
                    let lineElement = createElement("span", "log-entry");
                    lineElement.textContent = e;
                    this.setLogColor(lineElement, e);
                    logs.push({ "element": lineElement, "content": e });
                });
                spacer.style.height = logs.length * 15 + "px";
                setTimeout(() => {
                    logDisplay.scrollTo(0, logDisplay.scrollHeight);
                }, 0);
                window.enderlynx.watchFile(log_path, (log) => {
                    let logInfo = log.split("\n");
                    let scroll = logDisplay.scrollHeight - logDisplay.scrollTop - 50 <= logDisplay.clientHeight + 1;
                    logInfo.forEach((e) => {
                        if (e == "") return;
                        if (e.length == 1) return;
                        let lineElement = createElement("span", "log-entry");
                        lineElement.textContent = e;
                        this.setLogColor(lineElement, e);
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
        let onChangeLogDropdown = async (e) => {
            try {
                window.enderlynx.stopWatching(this.instance.current_log_file);
            } catch (e) { }

            if (e == "live_log") {
                deleteButton.style.display = "none";
                await setUpLiveLog();
            } else {
                deleteButton.style.display = "flex";
                currentLog = e;
                let logInfo = await window.enderlynx.getLog(this.instance.instance_id, e);
                logInfo = logInfo.split("\n");
                logs = [];
                logInfo.forEach((e) => {
                    if (e == "") return;
                    let lineElement = createElement("span", "log-entry");
                    lineElement.textContent = e;
                    this.setLogColor(lineElement, e);
                    logs.push({ "element": lineElement, "content": e });
                });
            }
            render();
        }
        if (log_info.length > 9) {
            new SearchDropdown(translate("app.logs.session"), [{ "name": translate("app.logs.live"), "value": "live_log" }].concat(log_info.toReversed().map((e) => ({ "name": formatDateAndTime(e.date), "value": e.file_name }))), typeDropdown, "live_log", onChangeLogDropdown);
        } else {
            new Dropdown(translate("app.logs.session"), [{ "name": translate("app.logs.live"), "value": "live_log" }].concat(log_info.toReversed().map((e) => ({ "name": formatDateAndTime(e.date), "value": e.file_name }))), typeDropdown, "live_log", onChangeLogDropdown);
        }
        typeDropdown.style.minWidth = "300px";
        searchAndFilter.appendChild(contentSearch);
        searchAndFilter.appendChild(typeDropdown);
        let fragment = document.createDocumentFragment();
        fragment.appendChild(searchAndFilter);
        let logWrapper = createElement("div", "logs");
        fragment.appendChild(logWrapper);
        let logTop = createElement("div", "logs-top");
        logWrapper.appendChild(logTop);
        logWrapper.appendChild(logDisplay);
        deleteButton.style.display = "none";
        await setUpLiveLog();
        render();
        let copyButton = createElement("button", "logs-copy");
        let shareButton = createElement("button", "logs-share");
        let deleteAllButton = createElement("button", "logs-delete");
        deleteButton.className = "logs-delete";
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
                url = await window.enderlynx.shareLogs(copyLogs);
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
                let success = await window.enderlynx.deleteLogs(this.instance.instance_id, currentLog);
                if (success) {
                    displaySuccess(translate("app.logs.delete.success"));
                    this.showLogs();
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
                let success = await window.enderlynx.deleteAllLogs(this.instance.instance_id);
                if (success) {
                    displaySuccess(translate("app.logs.delete_all.success"));
                    this.showLogs();
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
        this.tabElement.innerHTML = "";
        this.tabElement.appendChild(fragment);
        logResizeFunction();
    }

    async showOptions() {
        this.currentTab = "options";
        let loading = new LoadingContainer();
        this.tabElement.innerHTML = "";
        this.tabElement.appendChild(loading.element);
        await this.requestFrame();
        MoreMenu.clearMenus();
        let values = await window.enderlynx.getInstanceOptions(this.instance.instance_id);
        let searchAndFilter = document.createElement("div");
        searchAndFilter.classList.add("search-and-filter-v2");
        let contentSearch = document.createElement("div");
        contentSearch.style.flexGrow = 2;
        let searchBar = new SearchBar(contentSearch, (v) => {
            for (let i = 0; i < values.length; i++) {
                if (values[i].key.toLowerCase().includes(v.toLowerCase().trim()) && (values[i].element.dataset.type == dropdownInfo.value || dropdownInfo.value == "all")) {
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
                if (values[i].key.toLowerCase().includes(searchBar.value.toLowerCase().trim()) && (values[i].element.dataset.type == v || v == "all")) {
                    values[i].element.style.display = "grid";
                    values[i].element.classList.remove("hidden");
                } else {
                    values[i].element.style.display = "none";
                    values[i].element.classList.add("hidden");
                }
            }
        });
        typeDropdown.style.minWidth = "200px";
        let applyDefaults = createElement("button", "add-content-button");
        applyDefaults.innerHTML = '<i class="fa-regular fa-file-lines"></i>' + translate("app.instances.options.apply")
        applyDefaults.onclick = async () => {
            let dialog = new Dialog();
            dialog.showDialog(translate("app.instances.options.apply.title"), "notice", translate("app.instances.options.apply.description"), [
                {
                    "type": "cancel",
                    "content": translate("app.instances.options.apply.cancel")
                },
                {
                    "type": "confirm",
                    "content": translate("app.instances.options.apply.confirm")
                }
            ], [], async () => {
                try {
                    await window.enderlynx.setOptionsTXT(this.instance.instance_id, false, true);
                    displaySuccess(translate("app.instances.options.apply.done"));
                } catch (e) {
                    console.error(e);
                    displayError(translate("app.instances.options.apply.fail"));
                }
                this.showOptions();
            });
        }
        searchAndFilter.appendChild(contentSearch);
        searchAndFilter.appendChild(typeDropdown);
        searchAndFilter.appendChild(applyDefaults);
        let fragment = document.createDocumentFragment();
        fragment.appendChild(searchAndFilter);
        let info = document.createElement("div");
        info.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>' + translate("app.options.notice_1");
        info.className = "info";
        info.style.marginTop = "10px";
        fragment.appendChild(info);
        let info2 = document.createElement("div");
        info2.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>' + translate("app.options.notice_2");
        info2.className = "info";
        info2.style.marginTop = "10px";
        fragment.appendChild(info2);
        let optionList = document.createElement("div");
        optionList.className = "option-list";
        fragment.appendChild(optionList);

        for (let i = 0; i < values.length; i++) {
            let e = values[i];
            let item = createElement("div", "option-item");
            values[i].element = item;

            let titleElement = createElement("div", "option-title");
            titleElement.innerHTML = e.key;
            item.appendChild(titleElement);

            let onChange = async (v) => {
                values[i].value = (type == "text" ? '"' + v + '"' : v);
                if (await DefaultOptions.getDefault(e.key) == (type == "text" ? '"' + v + '"' : v)) {
                    setDefaultButton.innerHTML = '<i class="fa-solid fa-minus"></i>' + translate("app.options.default.remove");
                    item.classList.add("default");
                    setDefaultButton.onclick = onRemove;
                } else {
                    setDefaultButton.innerHTML = '<i class="fa-solid fa-plus"></i>' + translate("app.options.default.set");
                    item.classList.remove("default");
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
            item.dataset.type = type;
            if (type == "text") {
                inputElement = document.createElement("input");
                inputElement.className = "option-input";
                inputElement.value = e.value.slice(1, -1);
                inputElement.onchange = async () => {
                    try {
                        await window.enderlynx.updateOptionsTXT(this.instance.instance_id, e.key, '"' + inputElement.value + '"');
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
                inputElement.onchange = async () => {
                    try {
                        await window.enderlynx.updateOptionsTXT(this.instance.instance_id, e.key, inputElement.value);
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
                inputElement = new Dropdown("", [{ "name": translate("app.options.true"), "value": "true" }, { "name": translate("app.options.false"), "value": "false" }], inputElement1, e.value, async (v) => {
                    try {
                        await window.enderlynx.updateOptionsTXT(this.instance.instance_id, e.key, v);
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
                inputElement.onchange = async () => {
                    try {
                        await window.enderlynx.updateOptionsTXT(this.instance.instance_id, e.key, inputElement.value);
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
                inputElement.dataset.key = e.key;
                inputElement.innerHTML = (await window.enderlynx.convertKeyInfo("key_code", "text", e.value)) || e.value;
                inputElement.onclick = () => {
                    OptionsKeyManagement.keyButtonClick(inputElement, async (keyCode, oldInnerHTML, oldValue, oldElement) => {
                        try {
                            await window.enderlynx.updateOptionsTXT(this.instance.instance_id, e.key, keyCode);
                            displaySuccess(translate("app.options.updated"));
                            onChange(keyCode);
                        } catch (e) {
                            displayError(translate("app.options.failed"));
                            oldElement.innerHTML = oldInnerHTML;
                            oldElement.value = oldValue;
                        }
                    });
                }
                item.appendChild(inputElement);
            }

            let setDefaultButton = document.createElement("button");
            setDefaultButton.className = "option-button";
            setDefaultButton.innerHTML = '<i class="fa-solid fa-plus"></i>' + translate("app.options.default.set");

            let onSet = async () => {
                let value = inputElement.value;
                if (type == "number" && e.key.startsWith("key_key")) {
                    value = await window.enderlynx.convertKeyInfo("old_lwjgl_code", "key_code", value);
                }
                await DefaultOptions.setDefault(e.key, type == "text" ? '"' + value + '"' : value);
                setDefaultButton.innerHTML = '<i class="fa-solid fa-minus"></i>' + translate("app.options.default.remove");
                item.classList.add("default");
                setDefaultButton.onclick = onRemove;
                displaySuccess(translate("app.options.default.set.success", "%k", e.key, "%v", value));
            }

            setDefaultButton.onclick = onSet;

            let onRemove = async () => {
                await DefaultOptions.deleteDefault(e.key);
                setDefaultButton.innerHTML = '<i class="fa-solid fa-plus"></i>' + translate("app.options.default.set");
                item.classList.remove("default");
                setDefaultButton.onclick = onSet;
                displaySuccess(translate("app.options.default.remove.success", "%k", e.key));
            }

            let value = e.value;
            if (type == "number" && e.key.startsWith("key_key")) {
                value = await window.enderlynx.convertKeyInfo("old_lwjgl_code", "key_code", e.value);
            }

            if (await DefaultOptions.getDefault(e.key) == value) {
                setDefaultButton.innerHTML = '<i class="fa-solid fa-minus"></i>' + translate("app.options.default.remove");
                item.classList.add("default");
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

            optionList.appendChild(item);
        }
        if (!values.length) {
            let nofound = new NoResultsFound(translate("app.options.not_found"));
            nofound.element.style.background = "transparent";
            nofound.element.style.gridColumn = "span 3";
            optionList.appendChild(nofound.element);
        }
        this.tabElement.innerHTML = "";
        this.tabElement.appendChild(fragment);
    }

    async showFiles() {
        let searchAndFilter = createElement("div", "search-and-filter-v3");
        let filesBreadcrumb = createElement("div", "files-breadcrumb");
        let homeButton = createElement("button", "home-button");
        homeButton.innerHTML = '<i class="fa-solid fa-house"></i>';
        homeButton.onclick = () => {
            this.setFilesPath("");
        }
        this.filesHomeButton = homeButton;
        filesBreadcrumb.appendChild(homeButton);
        searchAndFilter.appendChild(filesBreadcrumb);
        let contentSearch = document.createElement("div");
        contentSearch.style.flexGrow = 2;
        let searchBar = new SearchBar(contentSearch, () => { }, null);
        let typeDropdown = document.createElement("div");
        let dropdownInfo = new Dropdown(translate("app.files.type"), [
            {
                "name": translate("app.files.all"),
                "value": "all"
            },
            {
                "name": translate("app.files.folder"),
                "value": "folder"
            },
            {
                "name": translate("app.files.file"),
                "value": "file"
            }
        ], typeDropdown, "all", () => { });
        typeDropdown.style.minWidth = "200px";
        searchAndFilter.appendChild(contentSearch);
        searchAndFilter.appendChild(typeDropdown);
        this.filesSearchBar = searchBar;
        this.filesSearchBarElement = contentSearch;
        this.filesDropdown = dropdownInfo;
        this.filesDropdownElement = typeDropdown;
        this.filesSearch = searchAndFilter;
        this.filesBreadcrumb = filesBreadcrumb;
        MoreMenu.clearMenus();
        await this.setFilesPath("");
    }

    async setFilesPath(paths) {
        let pathSplit = paths.split("/");
        if (this.filesResetButton) this.filesResetButton.remove();
        if (this.filesSaveButton) this.filesSaveButton.remove();
        this.filesBreadcrumb.innerHTML = "";
        this.filesBreadcrumb.appendChild(this.filesHomeButton);
        for (let i = 1; i < pathSplit.length; i++) {
            let dir = pathSplit[i];
            let breadcrumbArrow = createElement("span", "breadcrumb-arrow");
            breadcrumbArrow.innerHTML = '<i class="fa-solid fa-angle-right"></i>';
            let breadcrumbEntry = createElement("button", "breadcrumb-entry");
            breadcrumbEntry.textContent = dir;
            breadcrumbEntry.onclick = () => {
                this.setFilesPath(pathSplit.slice(0, i + 1).join("/"));
            }
            this.filesBreadcrumb.appendChild(breadcrumbArrow);
            this.filesBreadcrumb.appendChild(breadcrumbEntry);
        }
        let fileDrop = document.createElement("div");
        fileDrop.dataset.action = "file-import";
        fileDrop.dataset.instanceId = this.instance.instance_id;
        fileDrop.dataset.paths = paths;
        fileDrop.className = "small-drop-overlay drop-overlay";
        let fileDropInner = document.createElement("div");
        fileDropInner.className = "drop-overlay-inner";
        fileDropInner.innerHTML = translate("app.import.files.drop");
        fileDrop.appendChild(fileDropInner);
        let fileList = [];

        let contentListWrap = document.createElement("div");

        let files = await window.enderlynx.getFiles(this.instance.instance_id, paths);

        if (typeof files == 'string') {
            let editor = document.createElement("div");
            editor.id = "ace_editor";
            editor.className = "ace-enderlynx"
            aceResizeFunction = () => {
                const viewHeight = window.innerHeight;
                const editorRect = editor.getBoundingClientRect();
                const distanceFromTop = editorRect.top;
                const calculatedHeight = viewHeight - distanceFromTop - 10;
                editor.style.height = calculatedHeight + "px";
                aceEditor.resize();
            }
            let aceEditor = ace.edit(editor);
            aceEditor.setShowPrintMargin(false);
            aceEditor.setValue(files, -1);
            aceEditor.session.setMode("ace/mode/enderlynx");
            aceEditor.setFontSize(".9rem");
            let saveFunction = async () => {
                saveButton.innerHTML = '<i class="spinner"></i>Saving';
                let success = await window.enderlynx.editFile(this.instance.instance_id, paths, aceEditor.getValue());
                if (success) {
                    displaySuccess(translate("app.files.edit.success"));
                } else {
                    displayError(translate("app.files.edit.fail"));
                }
                saveButton.innerHTML = '<i class="fa-solid fa-floppy-disk"></i>Save';
            }
            aceEditor.commands.addCommand({
                name: "save",
                bindKey: { win: "Ctrl-S", mac: "Cmd-S" },
                exec: saveFunction
            });
            contentListWrap.appendChild(editor);
            let resetButton = document.createElement("button");
            resetButton.innerHTML = '<i class="fa-solid fa-clock-rotate-left"></i>Reset';
            resetButton.className = "editor-button";
            resetButton.onclick = () => {
                aceEditor.setValue(files, -1);
            }
            this.filesSearch.appendChild(resetButton);
            this.filesResetButton = resetButton;
            let saveButton = document.createElement("button");
            saveButton.innerHTML = '<i class="fa-solid fa-floppy-disk"></i>Save';
            saveButton.className = "editor-button";
            saveButton.onclick = saveFunction;
            this.filesSaveButton = saveButton;
            this.filesSearch.appendChild(saveButton);
        } else {
            let extensionsToNotEdit = ["png", "jpg", "jpeg", "webp", "avif", "dat", "dat_old", "apng", "mca", "zip", "jar", "nbt"];
            for (let i = 0; i < files.length; i++) {
                let file = files[i];
                fileList.push(
                    {
                        "primary_column": {
                            "title": file.name,
                            "desc": ""
                        },
                        "secondary_column": {
                            "title": () => formatTimeRelatively(file.dateModified),
                            "desc": () => ""
                        },
                        "type": file.isDirectory ? "folder" : "file",
                        "icon": file.isDirectory ? '<i class="fa-regular fa-folder"></i>' : '<i class="fa-regular fa-file"></i>',
                        "onremove": (ele) => {
                            let dialog = new Dialog();
                            dialog.showDialog(translate("app.files.delete.confirm.title"), "notice", translate("app.files.delete.confirm.description", "%w", file.name), [
                                {
                                    "type": "cancel",
                                    "content": translate("app.files.delete.cancel")
                                },
                                {
                                    "type": "confirm",
                                    "content": translate("app.files.delete.confirm")
                                }
                            ], [], async () => {
                                let success = await window.enderlynx.deleteFiles(this.instance.instance_id, paths, [file.name]);
                                if (success) {
                                    contentList.removeElement(ele);
                                    displaySuccess(translate("app.files.delete.success", "%w", file.name));
                                } else {
                                    displayError(translate("app.files.delete.fail", "%w", file.name));
                                }
                            });
                        },
                        "onclick": extensionsToNotEdit.includes(file.ext) ? null : () => {
                            this.setFilesPath(paths + "/" + file.name);
                        },
                        "more": {
                            "actionsList": [
                                {
                                    "title": translate("app.files.show_in_folder"),
                                    "icon": '<i class="fa-solid fa-up-right-from-square"></i>',
                                    "func": () => {
                                        window.enderlynx.showInstanceFileInFolder(this.instance.instance_id, paths + "/" + file.name);
                                    }
                                },
                                {
                                    "title": translate("app.files.copy_file_name"),
                                    "icon": '<i class="fa-solid fa-copy"></i>',
                                    "func": () => {
                                        navigator.clipboard.writeText(file.name).then(() => {
                                            displaySuccess(translate("app.files.name.copy.success"));
                                        }).catch(() => {
                                            displayError(translate("app.files.name.copy.fail"));
                                        });
                                    }
                                },
                                {
                                    "title": translate("app.files.copy_relative_path"),
                                    "icon": '<i class="fa-solid fa-copy"></i>',
                                    "func": () => {
                                        navigator.clipboard.writeText(file.relativePath).then(() => {
                                            displaySuccess(translate("app.files.relative_path.copy.success"));
                                        }).catch(() => {
                                            displayError(translate("app.files.relative_path.copy.fail"));
                                        });
                                    }
                                },
                                {
                                    "title": translate("app.files.copy_full_path"),
                                    "icon": '<i class="fa-solid fa-copy"></i>',
                                    "func": () => {
                                        navigator.clipboard.writeText(file.fullPath).then(() => {
                                            displaySuccess(translate("app.files.full_path.copy.success"));
                                        }).catch(() => {
                                            displayError(translate("app.files.full_path.copy.fail"));
                                        });
                                    }
                                },
                                {
                                    "title": translate("app.files.rename"),
                                    "icon": '<i class="fa-solid fa-i-cursor"></i>',
                                    "func": () => {
                                        let dialog = new Dialog();
                                        dialog.showDialog(translate("app.files.rename.title"), "form", [
                                            {
                                                "type": "text",
                                                "id": "name",
                                                "default": file.name,
                                                "name": translate("app.files.rename.name"),
                                                "focus": true
                                            }
                                        ], [
                                            {
                                                "content": translate("app.files.rename.cancel"),
                                                "type": "cancel"
                                            },
                                            {
                                                "content": translate("app.files.rename.confirm"),
                                                "type": "confirm"
                                            }
                                        ], [], async (info) => {
                                            let success = await window.enderlynx.renameFile(this.instance.instance_id, paths + "/" + file.name, paths + "/" + info.name);
                                            if (success) {
                                                displaySuccess(translate("app.files.rename.success"));
                                            } else {
                                                displayError(translate("app.files.rename.fail"));
                                            }
                                            this.setFilesPath(paths);
                                        });
                                    }
                                },
                                {
                                    "title": translate("app.files.move"),
                                    "icon": '<i class="fa-solid fa-left-right"></i>',
                                    "func": () => {
                                        let dialog = new Dialog();
                                        dialog.showDialog(translate("app.files.move.title"), "form", [
                                            {
                                                "type": "text",
                                                "id": "location",
                                                "default": file.location,
                                                "name": translate("app.files.move.location"),
                                                "focus": true
                                            }
                                        ], [
                                            {
                                                "content": translate("app.files.move.cancel"),
                                                "type": "cancel"
                                            },
                                            {
                                                "content": translate("app.files.move.confirm"),
                                                "type": "confirm"
                                            }
                                        ], [], async (info) => {
                                            let success = await window.enderlynx.renameFile(this.instance.instance_id, paths + "/" + file.name, info.location + "/" + file.name);
                                            if (success) {
                                                displaySuccess(translate("app.files.move.success"));
                                            } else {
                                                displayError(translate("app.files.move.fail"));
                                            }
                                            this.setFilesPath(paths);
                                        });
                                    }
                                },
                                {
                                    "title": translate("app.files.delete"),
                                    "icon": '<i class="fa-solid fa-trash-can"></i>',
                                    "danger": true,
                                    "func_id": "delete",
                                    "func": (ele) => {
                                        let dialog = new Dialog();
                                        dialog.showDialog(translate("app.files.delete.confirm.title"), "notice", translate("app.files.delete.confirm.description", "%w", file.name), [
                                            {
                                                "type": "cancel",
                                                "content": translate("app.files.delete.cancel")
                                            },
                                            {
                                                "type": "confirm",
                                                "content": translate("app.files.delete.confirm")
                                            }
                                        ], [], async () => {
                                            let success = await window.enderlynx.deleteFiles(this.instance.instance_id, paths, [file.name]);
                                            if (success) {
                                                contentList.removeElement(ele);
                                                displaySuccess(translate("app.files.delete.success", "%w", file.name));
                                            } else {
                                                displayError(translate("app.files.delete.fail", "%w", file.name));
                                            }
                                        });
                                    }
                                }
                            ].filter(e => e)
                        },
                        "pass_to_checkbox": file
                    });
            }

            let contentList = new ContentList(contentListWrap, fileList, this.filesSearchBar, {
                "checkbox": {
                    "enabled": true,
                    "actionsList": [
                        {
                            "title": translate("app.files.selection.delete"),
                            "icon": '<i class="fa-solid fa-trash-can"></i>',
                            "danger": true,
                            "dont_loop": true,
                            "func": async (eles, es) => {
                                let success = await window.enderlynx.deleteFiles(this.instance.instance_id, paths, es.map(e => e.name));
                                if (success) {
                                    eles.forEach(e => e.remove());
                                    contentList.removeElements(eles);
                                    displaySuccess(translate("app.files.delete_multiple.success"));
                                } else {
                                    this.setFilesPath(paths);
                                    displayError(translate("app.files.delete_multiple.fail"));
                                }
                            },
                            "show_confirmation_dialog": true,
                            "dialog_title": translate("app.files.delete.confirm.title"),
                            "dialog_content": translate("app.files.delete.selection_notice"),
                            "dialog_button": translate("app.files.delete.confirm")
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
                        this.setFilesPath(paths);
                    }
                },
                "update_all": {
                    "enabled": false
                }
            }, this.filesDropdown, translate("app.files.not_found"), this.contentElement);
        }

        this.tabElement.innerHTML = "";
        this.tabElement.appendChild(fileDrop);
        if (typeof files != 'string') this.filesSearch.appendChild(this.filesSearchBarElement);
        else this.filesSearchBarElement.remove();
        if (typeof files != 'string') this.filesSearch.appendChild(this.filesDropdownElement);
        else this.filesDropdownElement.remove();
        this.tabElement.appendChild(this.filesSearch);
        this.tabElement.appendChild(contentListWrap);
        if (aceResizeFunction) aceResizeFunction();
    }

    async showScreenshots() {
        this.currentTab = "screenshots";
        let loading = new LoadingContainer();
        this.tabElement.innerHTML = "";
        this.tabElement.appendChild(loading.element);
        await this.requestFrame();
        MoreMenu.clearMenus();
        let fragment = document.createDocumentFragment();
        let galleryElement = document.createElement("div");
        galleryElement.className = "gallery";
        let screenshots = (await window.enderlynx.getScreenshots(this.instance.instance_id)).reverse();
        let screenshotElements = [];
        screenshots.forEach(e => {
            let screenshotElement = document.createElement("button");
            screenshotElement.className = "gallery-screenshot";
            screenshotElement.dataset.title = formatDateAndTime(e.file_name);
            screenshotElement.style.backgroundImage = `url("${e.file_path}")`;
            let screenshotInformation = screenshots.map(e => ({ "name": formatDateAndTime(e.file_name), "file": e.file_path }));
            screenshotElement.onclick = () => {
                displayScreenshot(formatDateAndTime(e.file_name), null, e.file_path, e.file_name, this.instance, screenshotInformation, screenshotInformation.map(e => e.file).indexOf(e.file_path));
            }
            let buttons = new ContextMenuButtons([
                {
                    "icon": '<i class="fa-solid fa-folder"></i>',
                    "title": translate("app.screenshots.open_in_folder"),
                    "func": () => {
                        window.enderlynx.showScreenshotInFolder(this.instance.instance_id, e.real_file_name);
                    }
                },
                {
                    "icon": '<i class="fa-solid fa-image"></i>',
                    "title": translate("app.screenshots.open_photo"),
                    "func": () => {
                        window.enderlynx.openFolder(e.file_path);
                    }
                },
                {
                    "icon": '<i class="fa-solid fa-copy"></i>',
                    "title": translate("app.screenshots.copy"),
                    "func": async () => {
                        let success = await window.enderlynx.copyImageToClipboard(e.file_path);
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
                    "func": async () => {
                        let success = await window.enderlynx.deleteScreenshot(this.instance.instance_id, e.file_name);
                        if (success) {
                            displaySuccess(translate("app.screenshots.delete.success"));
                        } else {
                            displayError(translate("app.screenshots.delete.fail"));
                        }
                        this.showScreenshots();
                    },
                    "danger": true
                }
            ]);
            screenshotElement.oncontextmenu = (e) => {
                contextmenu.showContextMenu(buttons, e.clientX, e.clientY);
            }
            screenshotElements.push(screenshotElement);
        });
        let setPage = (page) => {
            currentPage = page;
            paginationTop.setPage(page);
            paginationBottom.setPage(page);
            let fragment = document.createDocumentFragment();
            for (let i = 0; i < screenshotElements.length; i++) {
                screenshotElements[i].remove();
            }
            for (let i = pageSize * (page - 1); i < Math.min(screenshotElements.length, pageSize * page); i++) {
                fragment.appendChild(screenshotElements[i]);
            }
            galleryElement.appendChild(fragment);
        }
        let paginationTop = new Pagination(1, Math.ceil(screenshots.length / 25), setPage);
        let paginationBottom = new Pagination(1, Math.ceil(screenshots.length / 25), setPage);
        paginationTop.element.style.marginBottom = "10px";
        paginationBottom.element.style.marginTop = "10px";
        fragment.appendChild(paginationTop.element);
        fragment.appendChild(galleryElement);
        fragment.appendChild(paginationBottom.element);
        this.tabElement.innerHTML = "";
        this.tabElement.appendChild(fragment);
        let currentPage = 1;
        let computePageSize = () => {
            let styles = getComputedStyle(galleryElement);
            let columns = styles.gridTemplateColumns.split(" ").length;
            for (let i = 29; i >= 1; i--) {
                if (i % columns == 0) {
                    let totalPages = Math.ceil(screenshots.length / i);
                    paginationTop.setTotalPages(totalPages);
                    paginationBottom.setTotalPages(totalPages);
                    if (currentPage > totalPages && totalPages != 0) {
                        setPage(totalPages);
                    }
                    return i;
                }
            }
            return screenshotElements.length;
        }
        document.body.onresize = () => {
            pageSize = computePageSize();
            setPage(currentPage);
        }
        let pageSize = computePageSize();
        setPage(1);
        if (!screenshots.length) {
            let nofound = new NoResultsFound(translate("app.screenshots.not_found"));
            nofound.element.style.gridColumn = "1 / -1";
            galleryElement.appendChild(nofound.element);
        }
    }
}

class OptionsKeyManagement {
    static activeKeySelection;
    static activeKeySelectionFunction;
    static async processEvent(e) {
        if (!this.activeKeySelection) return;
        e.preventDefault();
        e.stopPropagation();
        let keyCode = "";
        if (e instanceof MouseEvent) {
            if (e.button == 0) keyCode = "key.mouse.left";
            else if (e.button == 1) keyCode = "key.mouse.middle";
            else if (e.button == 2) keyCode = "key.mouse.right";
            else keyCode = `key.mouse.${e.button + 1}`;
        } else if (e instanceof KeyboardEvent) {
            let code = e.code || e.key;
            keyCode = await window.enderlynx.convertKeyInfo("web_code", "key_code", code);
        }
        if (!keyCode) keyCode = "key.keyboard.unknown";
        let oldInnerHTML = this.activeKeySelection.innerHTML;
        let oldValue = this.activeKeySelection.value;
        let oldElement = this.activeKeySelection;
        this.activeKeySelection.innerHTML = (await window.enderlynx.convertKeyInfo("key_code", "text", keyCode)) || keyCode;
        this.activeKeySelection.value = keyCode;
        this.activeKeySelection.classList.remove("selected");
        let key = this.activeKeySelection.dataset.key;
        this.activeKeySelection = null;
        await this.activeKeySelectionFunction(keyCode, oldInnerHTML, oldValue, oldElement);
        this.activeKeySelectionFunction = null;
    }
    static async keyButtonClick(button, func) {
        if (this.activeKeySelection) this.activeKeySelection.classList.remove("selected");
        button.classList.add("selected");
        this.activeKeySelection = button;
        this.activeKeySelectionFunction = func;
    }
}
document.addEventListener("keydown", (e) => OptionsKeyManagement.processEvent(e));
document.addEventListener("mousedown", (e) => OptionsKeyManagement.processEvent(e));

class HomeScreen extends Screen {
    constructor() {
        super("home");
    }

    display(dont_add_to_log, ...args) {
        this.instance_buttons = [];
        super.display(dont_add_to_log, ...args);
    }
    calculateContent() {
        this.contentElement.innerHTML = "";
        this.contentElement.className = "home-element";
        let loading = new LoadingContainer();
        loading.element.style.gridColumn = "span 2";
        this.contentElement.appendChild(loading.element);
        if (!this.hasRequestGoing) this.showHomeContent();
    }
    async changeHomeWelcome() {
        let profile = await getDefaultProfile();
        if (profile) {
            this.innerWelcomeElement.textContent = translate("app.welcome", "%n", profile.name);
        } else {
            this.innerWelcomeElement.textContent = translate("app.welcome_no_user");
        }
    }

    onClose() {
        InstanceStateManagement.removeButtons(this.instance_buttons);
    }

    async updateHomeGrid() {
        InstanceStateManagement.removeButtons(this.instance_buttons);
        this.instance_buttons = [];

        let pinnedWorldsList = await getPinnedWorlds();
        let pinnedInstancesList = await getPinnedInstances();
        let lastPlayedWorldsList = await getRecentlyPlayedWorlds();
        let lastPlayedInstancesList = await getRecentlyPlayedInstances();

        animateGridReorderStart(".home-world-entry, .home-entry, .home-element h2", ".home-list-section");

        let pinnedWorlds = pinnedWorldsList;
        let pinnedInstances = pinnedInstancesList;
        pinnedWorlds.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
        pinnedInstances.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));

        let pinnedWorldIdentifiers = pinnedWorlds.map(e => (e.id ? e.id : e.ip) + ":" + e.instance_id);
        let lastPlayedWorlds = lastPlayedWorldsList.filter(e => !pinnedWorldIdentifiers.includes((e.id ? e.id : e.ip) + ":" + e.instance_id)).slice(0, 5);
        let pinnedInstanceIdentifiers = pinnedInstances.map(e => e.instance_id);
        let lastPlayedInstances = lastPlayedInstancesList.filter(e => !pinnedInstanceIdentifiers.includes(e.instance_id)).slice(0, 5);
        pinnedInstances.forEach(e => e.actuallyPinned = true);
        lastPlayedInstances.forEach(e => e.actuallyPinned = false);
        pinnedWorlds.forEach(e => e.pinned = true);
        lastPlayedWorlds.forEach(e => e.pinned = false);

        this.lastPlayedInstanceGrid.innerHTML = "";
        this.pinnedInstanceGrid.innerHTML = "";
        this.lastPlayedWorldGrid.innerHTML = "";
        this.pinnedWorldGrid.innerHTML = "";
        this.column1.innerHTML = "";
        this.column2.innerHTML = "";
        let worlds = pinnedWorlds.concat(lastPlayedWorlds);
        for (let i = 0; i < worlds.length; i++) {
            let e = worlds[i];
            if (!e.ip) e.type = "singleplayer";
            else e.type = "multiplayer";

            let item = document.createElement("div");
            item.className = "home-world-entry";
            item.style.cursor = "auto";
            item.dataset.id = "world:" + (e.type == "singleplayer" ? e.id : e.ip) + ":" + e.instance_id;
            let icon = document.createElement("img");
            icon.className = "instance-image";
            icon.src = fixPathForImage(e.icon ? e.icon : getDefaultImage(e.type == "singleplayer" ? e.id : e.ip));
            icon.onerror = () => {
                icon.src = getDefaultImage(e.type == "singleplayer" ? e.id : e.ip);
            }
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
            if (howLongAgo(e.last_played) < 3600000) {
                let interval = setInterval(() => {
                    if (!document.body.contains(itemDesc1)) {
                        clearInterval(interval);
                        return;
                    }
                    itemDesc1.innerHTML = formatTimeRelatively(e.last_played) + " • ";
                }, 60000);
            } else if (howLongAgo(e.last_played) < 86400000) {
                let interval = setInterval(() => {
                    if (!document.body.contains(itemDesc1)) {
                        clearInterval(interval);
                        return;
                    }
                    itemDesc1.innerHTML = formatTimeRelatively(e.last_played) + " • ";
                }, 3600000);
            }
            let itemDesc2 = document.createElement("span");
            itemDesc2.className = "instance-desc";
            itemDesc2.innerHTML = (e.type == "singleplayer" ? (e.hardcore ? "<span style='color:#ff1313'>" + translate("app.worlds.description.hardcore") + "</span>" : translate("app.worlds.description." + e.mode)) : e.ip);
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
            let instanceInfo = Instance.getInstance(e.instance_id);
            let playButton = createElement("button", "home-play-button");
            InstanceStateManagement.registerButton(playButton, instanceInfo, e, true, false, undefined, true);
            this.instance_buttons.push(playButton);
            let morebutton = document.createElement("button");
            morebutton.className = "home-list-more";
            morebutton.innerHTML = '<i class="fa-solid fa-ellipsis-vertical"></i>';
            let buttons = new ContextMenuButtons([
                instanceInfo.supportsQuickPlayType(e.type) ? {
                    "type": "play-button",
                    "instance": instanceInfo,
                    "world": e,
                    "goToInstancePageWhenClicked": true
                } : null,
                {
                    "title": translate("app.instance.view"),
                    "icon": '<i class="fa-solid fa-eye"></i>',
                    "func": () => {
                        instanceInfo.display();
                    }
                },
                e.type == "singleplayer" ? {
                    "title": translate("app.worlds.open"),
                    "icon": '<i class="fa-solid fa-folder"></i>',
                    "func": () => {
                        window.enderlynx.openWorldFolder(instanceInfo.instance_id, e.id);
                    }
                } : null,
                {
                    "title": async () => await instanceInfo.isWorldPinned(e) ? translate("app.worlds.unpin") : translate("app.worlds.pin"),
                    "icon": async () => await instanceInfo.isWorldPinned(e) ? '<i class="fa-solid fa-thumbtack-slash"></i>' : '<i class="fa-solid fa-thumbtack"></i>',
                    "func": async (i, c) => {
                        if (c) c.remove();
                        let world_pinned = await instanceInfo.isWorldPinned(e);
                        world_pinned ? await instanceInfo.unpinWorld(e) : await instanceInfo.pinWorld(e);
                        i.setTitle(!world_pinned ? translate("app.worlds.unpin") : translate("app.worlds.pin"));
                        i.setIcon(!world_pinned ? '<i class="fa-solid fa-thumbtack-slash"></i>' : '<i class="fa-solid fa-thumbtack"></i>');
                        if (!world_pinned) {
                            pinnedWorldsList.push(e);
                        } else {
                            pinnedWorldsList = pinnedWorldsList.filter(f => e.type == "singleplayer" ? f.id != e.id : f.ip != e.ip);
                        }
                        this.updateHomeGrid();
                    }
                },
                // {
                //     "title": translate("app.worlds.share"),
                //     "icon": '<i class="fa-solid fa-share"></i>',
                //     "func": () => { }
                // },
                instanceInfo.supportsQuickPlayType(e.type) ? {
                    "icon": '<i class="fa-solid fa-desktop"></i>',
                    "title": translate("app.worlds.desktop_shortcut"),
                    "func": () => {
                        if (e.type == "singleplayer") {
                            instanceInfo.addDesktopShortcutWorld(e.name, "singleplayer", e.id, e.icon ?? getDefaultImage(e.id));
                        } else {
                            instanceInfo.addDesktopShortcutWorld(e.name, "multiplayer", e.ip, e.icon ?? getDefaultImage(e.ip));
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
                                let success = await window.enderlynx.deleteWorld(instanceInfo.instance_id, e.id);
                                if (success) {
                                    displaySuccess(translate("app.worlds.delete.success", "%w", parseMinecraftFormatting(e.name)));
                                } else {
                                    displayError(translate("app.worlds.delete.fail", "%w", parseMinecraftFormatting(e.name)));
                                }
                            } else if (e.type == "multiplayer") {
                                let success = await window.enderlynx.deleteServer(instanceInfo.instance_id, [e.ip], [e.index]);
                                if (success) {
                                    displaySuccess(translate("app.worlds.delete.success", "%w", parseMinecraftFormatting(e.name)));
                                } else {
                                    displayError(translate("app.worlds.delete.fail", "%w", parseMinecraftFormatting(e.name)));
                                }
                            }
                            pinnedWorldsList = pinnedWorldsList.filter(f => e.type == "singleplayer" ? f.id != e.id : f.ip != e.ip);
                            lastPlayedWorldsList = lastPlayedWorldsList.filter(f => e.type == "singleplayer" ? f.id != e.id : f.ip != e.ip);
                            this.updateHomeGrid();
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
            e.pinned ? this.pinnedWorldGrid.appendChild(item) : this.lastPlayedWorldGrid.appendChild(item);
        }
        let instances = pinnedInstances.concat(lastPlayedInstances);
        for (let i = 0; i < instances.length; i++) {
            let e = instances[i];
            let item = document.createElement("div");
            item.className = "home-entry";
            makeArtificialButton(item, () => {
                e.display();
            }, ["button", "i"]);
            item.dataset.id = "instance:" + e.instance_id;
            let icon = document.createElement("img");
            icon.className = "instance-image";
            icon.src = e.image || getDefaultImage(e.instance_id);
            instances[i].watchForChange("image", (image) => {
                icon.src = image || getDefaultImage(e.instance_id);
            });
            icon.onerror = () => {
                icon.src = getDefaultImage(e.instance_id);
            }
            item.appendChild(icon);
            let itemInfo = document.createElement("div");
            itemInfo.className = "instance-info";
            let itemTitle = document.createElement("div");
            itemTitle.className = "instance-name";
            itemTitle.textContent = e.name;
            instances[i].watchForChange("name", (name) => {
                itemTitle.textContent = name;
            });
            let itemDesc = document.createElement("div");
            itemDesc.className = "instance-desc";
            itemDesc.innerHTML = formatTimeRelatively(e.last_played) + " • " + loaders[e.loader] + " " + e.vanilla_version;
            if (howLongAgo(e.last_played) < 3600000) {
                let interval = setInterval(() => {
                    if (!document.body.contains(itemDesc)) {
                        clearInterval(interval);
                        return;
                    }
                    itemDesc.innerHTML = formatTimeRelatively(e.last_played) + " • " + loaders[e.loader] + " " + e.vanilla_version;
                }, 60000);
            } else if (howLongAgo(e.last_played) < 86400000) {
                let interval = setInterval(() => {
                    if (!document.body.contains(itemDesc)) {
                        clearInterval(interval);
                        return;
                    }
                    itemDesc.innerHTML = formatTimeRelatively(e.last_played) + " • " + loaders[e.loader] + " " + e.vanilla_version;
                }, 3600000);
            }
            instances[i].watchForChange("loader", (loader) => {
                e.loader = loader;
                itemDesc.innerHTML = formatTimeRelatively(e.last_played) + " • " + loaders[e.loader] + " " + e.vanilla_version;
            });
            instances[i].watchForChange("vanilla_version", (vanilla_version) => {
                e.vanilla_version = vanilla_version;
                itemDesc.innerHTML = formatTimeRelatively(e.last_played) + " • " + loaders[e.loader] + " " + e.vanilla_version;
            });
            itemInfo.appendChild(itemTitle);
            itemInfo.appendChild(itemDesc);
            item.appendChild(itemInfo);
            let instanceInfo = e;
            let playButton = createElement("button", "home-play-button");
            InstanceStateManagement.registerButton(playButton, instanceInfo, null, true, false, undefined, true);
            let morebutton = document.createElement("button");
            morebutton.className = "home-list-more";
            morebutton.innerHTML = '<i class="fa-solid fa-ellipsis-vertical"></i>';
            let buttons = new ContextMenuButtons([
                {
                    "type": "play-button",
                    "instance": instanceInfo,
                    "goToInstancePageWhenClicked": true
                },
                instanceInfo.locked ? null : {
                    "icon": '<i class="fa-solid fa-plus"></i>',
                    "title": translate("app.button.content.add"),
                    "func": async (e) => {
                        discoverScreen.display(false, instanceInfo, instanceInfo.vanilla_version, instanceInfo.loader);
                    }
                },
                {
                    "icon": '<i class="fa-solid fa-gear"></i>',
                    "title": translate("app.button.instances.open_settings"),
                    "func": async (e) => {
                        instanceInfo.showSettingsDialog();
                    }
                },
                {
                    "icon": '<i class="fa-solid fa-folder"></i>',
                    "title": translate("app.button.instances.open_folder"),
                    "func": (e) => {
                        window.enderlynx.openInstanceFolder(instanceInfo.instance_id);
                    }
                },
                {
                    "icon": instanceInfo.isPinned() ? '<i class="fa-solid fa-thumbtack-slash"></i>' : '<i class="fa-solid fa-thumbtack"></i>',
                    "title": instanceInfo.isPinned() ? translate("app.instances.unpin") : translate("app.instances.pin"),
                    "func": async (e, c) => {
                        if (c) c.remove();
                        instanceInfo.isPinned() ? await instanceInfo.unpin() : await instanceInfo.pin();
                        e.setTitle(instanceInfo.isPinned() ? translate("app.instances.unpin") : translate("app.instances.pin"));
                        e.setIcon(instanceInfo.isPinned() ? '<i class="fa-solid fa-thumbtack-slash"></i>' : '<i class="fa-solid fa-thumbtack"></i>');
                        if (instanceInfo.isPinned()) {
                            pinnedInstancesList.push(instanceInfo);
                        } else {
                            pinnedInstancesList = pinnedInstancesList.filter(e => e.instance_id != instanceInfo.instance_id);
                        }
                        this.updateHomeGrid();
                    }
                },
                {
                    "icon": '<i class="fa-solid fa-copy"></i>',
                    "title": translate("app.button.instances.duplicate"),
                    "func": (e) => {
                        instanceInfo.showDuplicateDialog();
                    }
                },
                {
                    "icon": '<i class="fa-solid fa-trash-can"></i>',
                    "title": translate("app.button.instances.delete"),
                    "func": (e) => {
                        instanceInfo.showDeleteDialog(() => {
                            pinnedInstancesList = pinnedInstancesList.filter(e => e.instance_id != instanceInfo.instance_id);
                            lastPlayedInstancesList = lastPlayedInstancesList.filter(e => e.instance_id != instanceInfo.instance_id);
                            this.updateHomeGrid();
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
            e.actuallyPinned ? this.pinnedInstanceGrid.appendChild(item) : this.lastPlayedInstanceGrid.appendChild(item);
        };
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
            this.column1.appendChild(this.pinnedWorldTitle);
            this.column1.appendChild(pinnedWorlds.length ? this.pinnedWorldGrid : noPinnedWorlds);
            this.column2.appendChild(this.pinnedInstanceTitle);
            this.column2.appendChild(pinnedInstances.length ? this.pinnedInstanceGrid : noPinnedInstances);
            this.column1.style.gridRow = "";
            this.column2.style.gridRow = "";
        } else {
            this.column1.style.gridRow = "span 2";
            this.column2.style.gridRow = "span 2";
        }
        this.column1.appendChild(this.lastPlayedWorldTitle);
        this.column1.appendChild(lastPlayedWorlds.length ? this.lastPlayedWorldGrid : noPlayedWorlds);
        this.column2.appendChild(this.lastPlayedInstanceTitle);
        this.column2.appendChild(lastPlayedInstances.length ? this.lastPlayedInstanceGrid : noPlayedInstances);
        animateGridReorderEnd(".home-world-entry, .home-entry, .home-element h2", ".home-list-section");
    }

    async showHomeContent() {
        this.hasRequestGoing = true;
        let welcomeElement = createElement("div", "welcome-container");
        this.innerWelcomeElement = createElement("div", "welcome");
        this.changeHomeWelcome();
        welcomeElement.appendChild(this.innerWelcomeElement);
        for (let i = 0; i < 10; i++) {
            let blobElement = createElement("div", "welcome-blob");
            welcomeElement.appendChild(blobElement);
            let height = Math.random() * 100 + 20;
            let width = Math.random() * 200 + 20;
            let top = Math.random() * (200 + height) - height;
            let left = Math.random() * (window.innerWidth + width) - width;
            let rotate = Math.random() * 360;
            blobElement.style.setProperty("--blob-height", height + "px");
            blobElement.style.setProperty("--blob-width", width + "px");
            blobElement.style.setProperty("--blob-top", top + "px");
            blobElement.style.setProperty("--blob-left", left + "px");
            blobElement.style.setProperty("--blob-rotate", rotate + "deg");
        }
        this.column1 = createElement("div", "home-column");
        this.column2 = createElement("div", "home-column");
        this.pinnedWorldTitle = createElement("h2");
        this.pinnedWorldTitle.innerHTML = '<i class="home-icon fa-solid fa-thumbtack"></i>' + translate("app.home.pinned_worlds");
        this.pinnedWorldTitle.dataset.id = "ui:pinned_world_title";
        this.pinnedInstanceTitle = createElement("h2");
        this.pinnedInstanceTitle.innerHTML = '<i class="home-icon fa-solid fa-thumbtack"></i>' + translate("app.home.pinned_instances");
        this.pinnedInstanceTitle.dataset.id = "ui:pinned_instance_title";
        this.lastPlayedWorldTitle = createElement("h2");
        this.lastPlayedWorldTitle.innerHTML = '<i class="home-icon fa-solid fa-clock-rotate-left"></i>' + translate("app.home.last_played_worlds");
        this.lastPlayedWorldTitle.dataset.id = "ui:last_played_world_title";
        this.lastPlayedInstanceTitle = createElement("h2");
        this.lastPlayedInstanceTitle.innerHTML = '<i class="home-icon fa-solid fa-clock-rotate-left"></i>' + translate("app.home.last_played_instances");
        this.lastPlayedInstanceTitle.dataset.id = "ui:last_played_instance_title";
        this.pinnedWorldGrid = createElement("div", "home-list-section");
        this.pinnedWorldGrid.dataset.id = "ui:pinned_world_grid";
        this.lastPlayedWorldGrid = createElement("div", "home-list-section");
        this.lastPlayedWorldGrid.dataset.id = "ui:last_played_world_grid";
        this.pinnedInstanceGrid = createElement("div", "home-list-section");
        this.pinnedInstanceGrid.dataset.id = "ui:pinned_instance_grid";
        this.lastPlayedInstanceGrid = createElement("div", "home-list-section");
        this.lastPlayedInstanceGrid.dataset.id = "ui:last_played_instance_grid";

        await this.updateHomeGrid();

        let discoverModsWrapper = createElement("div", "home-discover-wrapper");
        discoverModsWrapper.style.display = "none";
        let discoverModsTitle = createElement("button", "home-discover-title");
        discoverModsTitle.innerHTML = translate("app.home.discover_modpacks") + ' <i class="fa-solid fa-angles-right"></i>'
        discoverModsTitle.onclick = () => {
            discoverScreen.display();
        }
        let discoverModsRefresh = createElement("button", "home-discover-refresh");
        discoverModsRefresh.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i>' + translate("app.home.discover.refresh");
        discoverModsRefresh.onclick = async () => {
            discoverModsRefresh.innerHTML = '<i class="fa-solid fa-arrows-rotate spinning"></i>' + translate("app.home.discover.refresh");
            try {
                this.home_modpacks = await window.enderlynx.getRandomModpacks();
                if (!this.home_modpacks) throw new Error();
                this.updateHomeModpacksList(this.home_modpacks);
            } catch (e) {
                displayError(translate("app.home.discover.refresh.failed"));
            }
            discoverModsRefresh.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i>' + translate("app.home.discover.refresh");
        }
        let discoverModsTop = createElement("div", "home-discover-top");
        discoverModsTop.appendChild(discoverModsTitle);
        discoverModsTop.appendChild(discoverModsRefresh);
        discoverModsWrapper.appendChild(discoverModsTop);
        this.discoverModsWrapper = discoverModsWrapper;
        let discoverModsContainer = createElement("div", "home-discover-container");
        this.discoverModsContainer = discoverModsContainer;
        discoverModsContainer.addEventListener("wheel", e => {
            if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                e.preventDefault();
                discoverModsContainer.scrollLeft += e.deltaY;
            }
        }, { passive: false });
        discoverModsWrapper.appendChild(discoverModsContainer);

        if (!this.home_modpacks || !this.home_modpacks.hits) {
            this.getRandomModpacks();
        } else {
            this.updateHomeModpacksList();
        }

        let mcNewsWrapper = createElement("div", "home-discover-wrapper");
        mcNewsWrapper.style.display = "none";
        let mcNewsTitle = createElement("div", "home-news-title");
        mcNewsTitle.innerHTML = translate("app.home.mc_news");
        mcNewsWrapper.appendChild(mcNewsTitle);
        let mcNewsContainer = createElement("div", "home-discover-container");
        this.mcNewsContainer = mcNewsContainer;
        mcNewsContainer.addEventListener("wheel", e => {
            if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
                e.preventDefault();
                mcNewsContainer.scrollLeft += e.deltaY;
            }
        }, { passive: false });
        mcNewsWrapper.appendChild(mcNewsContainer);
        this.mcNewsWrapper = mcNewsWrapper;

        if (!this.mc_news?.article_grid) {
            this.getMCNews();
        } else {
            this.updateMCNews();
        }

        this.contentElement.innerHTML = "";
        this.contentElement.appendChild(welcomeElement);
        this.contentElement.appendChild(this.column1);
        this.contentElement.appendChild(this.column2);
        this.contentElement.appendChild(discoverModsWrapper);
        this.contentElement.appendChild(mcNewsWrapper);
        this.hasRequestGoing = false;
    }

    updateHomeModpacksList() {
        if (!this.home_modpacks || !this.home_modpacks.hits || !this.home_modpacks.hits.length) return;
        this.discoverModsContainer.innerHTML = '';
        this.discoverModsWrapper.style.display = "grid";
        this.home_modpacks.hits.forEach(e => {
            let item = document.createElement("button");
            item.className = "home-discover";
            item.onclick = () => {
                displayContentInfo("modrinth", undefined, e.project_id);
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
            let itemDownloadCount = document.createElement("div");
            itemDownloadCount.className = "home-discover-downloads";
            itemDownloadCount.innerHTML = translate("app.home.modpack.downloads").replace("%d", formatNumber(e.downloads));
            itemInfo.appendChild(itemDownloadCount);
            item.appendChild(itemInfo);
            this.discoverModsContainer.appendChild(item);
        })
    }

    async getRandomModpacks() {
        this.home_modpacks = await window.enderlynx.getRandomModpacks();
        this.updateHomeModpacksList();
    }

    updateMCNews() {
        this.mcNewsWrapper.style.display = "";
        this.mc_news.article_grid.forEach(e => {
            let article = document.createElement("button");
            article.className = "mc-news";
            article.style.backgroundImage = `url("https://minecraft.net${e.default_tile.image.imageURL}")`;
            article.onclick = () => {
                window.enderlynx.openInBrowser("https://minecraft.net" + e.article_url);
            }
            if (e.default_tile.sub_header) article.title = e.default_tile.sub_header;
            let article_title = document.createElement("div");
            article_title.innerHTML = e.default_tile.title;
            article_title.className = "mc-news-title";
            article_title.dataset.type = e.primary_category;
            article.appendChild(article_title);
            this.mcNewsContainer.appendChild(article);
        });
    }

    async getMCNews() {
        this.mc_news = await (await fetch("https://www.minecraft.net/content/minecraftnet/language-masters/en-us/_jcr_content.articles.page-1.json")).json();
        this.updateMCNews();
    }
}

class Group {
    static groups = new Map();
    constructor(group) {
        if (!group) return;
        this.id = group.id;
        this.name = group.name;
        this.position = group.position;
        this.collapsed = Boolean(group.collapsed);
        this.type = group.type;
    }

    static getGroup(group_id) {
        if (!this.groups.has(group_id)) {
            return Group.applyGroup(group_id, window.enderlynx.getGroup(group_id));
        }
        return this.groups.get(group_id);
    }

    static applyGroup(group_id, info) {
        if (!this.groups.has(group_id)) {
            let newGroup = new Group(info);
            this.groups.set(group_id, newGroup);
        }
        return this.groups.get(group_id);
    }

    toggleCollapsed() {
        this.collapsed = !this.collapsed;
        this.element.classList.toggle("open", !this.collapsed);
        window.enderlynx.setGroupCollapsed(this.id, this.collapsed);
    }

    editName() {
        this.groupNameEditorElement.style.display = "";
        this.groupNameElement.style.display = "none";
        this.groupNameEditorElement.select();
    }

    changeName() {
        this.name = this.groupNameEditorElement.value;
        window.enderlynx.setGroupName(this.id, this.name);
        this.groupNameElement.textContent = this.name;
        this.groupNameElement.style.display = "";
        this.groupNameEditorElement.style.display = "none";
    }

    promptDeletion() {
        if (this.instances.length == 0) {
            this.delete();
            return;
        }
        let dialog = new Dialog();
        dialog.showDialog(translate("app.instances.group.delete.title"), "notice", translate("app.instances.group.delete.description", "%g", this.groupNameElement.textContent), [
            {
                "type": "cancel",
                "content": translate("app.instances.group.delete.cancel")
            },
            {
                "type": "confirm",
                "content": translate("app.instances.group.delete.confirm")
            }
        ], [], () => {
            this.delete();
        });
    }

    delete() {
        this.onDelete();
    }

    moveToGroup(instance) {
        this.insertInSortedOrder(instance);
        this.updateCount();
    }

    insertInSortedOrder(instance) {
        let how = this.sortHow;
        let low = 0;
        let high = this.instances.length - 1;
        while (low <= high) {
            let mid = Math.floor((low + high) / 2);
            let comparison = this.compareInstances(instance, this.instances[mid], how);
            if (comparison < 0) {
                high = mid - 1;
            } else {
                low = mid + 1;
            }
        }
        this.instances.splice(low, 0, instance);
        let nextInstance = this.instances[low + 1];
        if (nextInstance) {
            this.instancesElement.insertBefore(instance.instanceButton, nextInstance.instanceButton);
        } else {
            if (this.instances.length == 1) this.instancesElement.innerHTML = '';
            this.instancesElement.appendChild(instance.instanceButton);
        }
    }

    compareInstances(a, b, how) {
        let valueA = a[how];
        let valueB = b[how];
        if (valueA instanceof Date && valueB instanceof Date) {
            let aTime = valueA.getTime();
            let bTime = valueB.getTime();
            if (Number.isNaN(aTime)) aTime = 0;
            if (Number.isNaN(bTime)) bTime = 0;
            return bTime - aTime;
        }
        if (typeof valueA == 'number' && typeof valueB == 'number') {
            return valueB - valueA;
        }
        if (how == "vanilla_version") {
            let aIndex = minecraftVersions.indexOf(valueA);
            let bIndex = minecraftVersions.indexOf(valueB);
            if (aIndex == -1 && bIndex == -1) {
                return valueA.localeCompare(valueB);
            }
            if (aIndex == -1) return -1;
            if (bIndex == -1) return 1;
            return bIndex - aIndex;
        }
        return valueA.localeCompare(valueB);
    }

    removeFromGroup(instance) {
        this.instances = this.instances.filter(e => e.instance_id != instance.instance_id);
        this.updateCount();
    }

    hideOverlay() {
        this.overlay.classList.remove("shown");
    }

    showOverlay() {
        this.overlay.classList.add("shown");
    }

    formGroupElement(instances, sort, onDelete) {
        this.instances = instances;
        this.onDelete = onDelete;
        let groupElement = createElement("div", "group");
        groupElement.dataset.id = this.id;
        this.element = groupElement;
        let groupOverlay = createElement("div", "group-overlay");
        let groupOverlayInner = createElement("div", "group-overlay-inner");
        groupOverlay.appendChild(groupOverlayInner);
        groupElement.appendChild(groupOverlay);
        groupElement.onpointerenter = () => {
            groupOverlay.classList.toggle("shown", Boolean(instancesScreen.dragging));
        }
        groupElement.onpointerleave = () => {
            groupOverlay.classList.remove("shown");
        }
        this.overlay = groupOverlay;
        if (!this.collapsed) {
            groupElement.classList.add("open");
        }
        let groupHeader = createElement("div", "group-header");
        makeArtificialButton(groupHeader, () => {
            this.toggleCollapsed();
        }, ["button", "button > i", ".group-actions", "input"]);
        let groupChevron = createElement("i", "group-chevron fa-solid fa-chevron-down");
        let groupName = createElement("div", "group-name");
        this.groupNameElement = groupName;
        groupName.textContent = this.name;
        if (this.type == "custom") {
            groupName.textContent = this.id == -1 ? translate("app.instances.group.uncategorized") : this.name;
        }
        if (this.type == "pinned") {
            groupName.textContent = this.name == "true" ? translate("app.instances.group.pinned.title") : translate("app.instances.group.unpinned.title");
        }
        if (this.type == "loader") {
            groupName.textContent = loaders[this.name];
        }
        groupHeader.appendChild(groupChevron);
        groupHeader.appendChild(createElement("div", "group-spacer"));
        let groupNameEditor = createElement("input", "group-inline-editor inline-name-editor");
        groupNameEditor.value = groupName.textContent;
        groupNameEditor.style.display = "none";
        groupNameEditor.onkeydown = (e) => {
            if (e.key == "Enter" || e.key == "Escape") this.changeName();
        }
        groupNameEditor.maxLength = 50;
        groupNameEditor.onblur = () => this.changeName();
        this.groupNameEditorElement = groupNameEditor;
        groupHeader.appendChild(groupName);
        groupHeader.appendChild(groupNameEditor);
        groupHeader.appendChild(createElement("div", "group-spacer"));
        let groupCount = createElement("div", "group-count");
        groupCount.textContent = this.instances.length;
        this.countElement = groupCount;
        groupHeader.appendChild(groupCount);
        groupHeader.appendChild(createElement("div", "group-spacer"));
        let groupAction1;
        let groupAction2;
        if (this.type == "custom") {
            let groupActions = createElement("div", "group-actions");
            groupHeader.appendChild(groupActions);
            groupAction1 = createElement("button", "group-action", { innerHTML: '<i class="fa-solid fa-arrow-up"></i>', title: translate("app.instances.group.move.up") });
            groupAction2 = createElement("button", "group-action", { innerHTML: '<i class="fa-solid fa-arrow-down"></i>', title: translate("app.instances.group.move.down") });
            let groupAction3 = createElement("button", "group-action", { innerHTML: '<i class="fa-solid fa-pencil"></i>', title: translate("app.instances.group.edit_name") });
            let groupAction4 = createElement("button", "group-action danger", { innerHTML: '<i class="fa-solid fa-trash-can"></i>', title: translate("app.instances.group.delete") });
            groupAction3.onclick = () => this.editName();
            groupAction4.onclick = () => this.promptDeletion();
            groupActions.appendChild(groupAction1);
            groupActions.appendChild(groupAction2);
            if (this.id != -1) {
                groupActions.appendChild(groupAction3);
                groupActions.appendChild(groupAction4);
            }
        }
        let buttons = new ContextMenuButtons([
            {
                "title": translate("app.instances.group.move.up"),
                "icon": '<i class="fa-solid fa-arrow-up"></i>',
                "func": () => {
                    groupAction1.click();
                }
            },
            {
                "title": translate("app.instances.group.move.down"),
                "icon": '<i class="fa-solid fa-arrow-down"></i>',
                "func": () => {
                    groupAction2.click();
                }
            },
            this.id != -1 ? {
                "title": translate("app.instances.group.edit_name"),
                "icon": '<i class="fa-solid fa-pencil"></i>',
                "func": () => {
                    this.editName();
                }
            } : null,
            this.id != -1 ? {
                "title": translate("app.instances.group.delete"),
                "icon": '<i class="fa-solid fa-trash-can"></i>',
                "danger": true,
                "func": () => {
                    this.promptDeletion();
                }
            } : null
        ].filter(e => e));
        if (this.type == "custom") groupHeader.oncontextmenu = (e) => {
            contextmenu.showContextMenu(buttons, e.clientX, e.clientY);
        }
        groupElement.appendChild(groupHeader);
        let groupInstances = createElement("div", "group-instances");
        if (this.type == "none") groupInstances.classList.add("shown");
        groupElement.appendChild(groupInstances);
        this.instancesElement = groupInstances;
        this.actions = this.type == "custom" ? {
            up: groupAction1,
            down: groupAction2
        } : null;
        this.sort(sort);
    }

    updateCount() {
        this.instances = this.instances.filter(e => !e.deleted);
        this.countElement.textContent = this.instances.length;
        if (!this.instances || this.instances.length == 0) {
            this.instancesElement.textContent = translate("app.instances.group.none_added");
        }
    }

    sort(how) {
        this.sortHow = how;
        this.instances.sort((a, b) => {
            return this.compareInstances(a, b, how);
        });
        let fragment = document.createDocumentFragment();
        this.instances.forEach(instance => fragment.appendChild(instance.instanceButton));
        this.instancesElement.innerHTML = "";
        this.instancesElement.appendChild(fragment);
        if (!this.instances || this.instances.length == 0) {
            this.instancesElement.textContent = translate("app.instances.group.none_added");
        }
    }

    figureOutVisibility(query) {
        let hasVisibleInstances = this.instances.some(
            instance => !instance.instanceButton.classList.contains("hidden")
        );

        this.element.style.display = (hasVisibleInstances || !query) ? "" : "none";
    }
}

class InstancesScreen extends Screen {
    constructor() {
        super("home");
    }

    display(dont_add_to_log, ...args) {
        super.display(dont_add_to_log, ...args);
    }

    calculateContent() {
        this.contentElement.className = "instance-content";
        if (!this.hasRequestGoing) this.showInstances();
    }

    static async getCustomGroups() {
        let groups = await window.enderlynx.getGroups();
        let groupList = [];
        for (let group of groups) {
            groupList.push(Group.applyGroup(group.id, group));
        }
        return groupList;
    }

    static getGroupsByType(type, list) {
        let groups = window.enderlynx.getGroupsByType(type, list);
        let groupList = [];
        for (let group of groups) {
            groupList.push(Group.applyGroup(group.id, group));
        }
        return groupList;
    }

    selectInstance(instance) {
        this.selectedInstances.add(instance);
        instance.setSelected(true);
        this.countElement.textContent = translate("app.list.count", "%c", this.selectedInstances.size);
        this.floatingControls.classList.toggle("shown", this.selectedInstances.size > 0);
        this.lastSelectedInstance = instance;
    }

    deselectInstance(instance) {
        this.selectedInstances.delete(instance);
        instance.setSelected(false);
        this.countElement.textContent = translate("app.list.count", "%c", this.selectedInstances.size);
        this.floatingControls.classList.toggle("shown", this.selectedInstances.size > 0);
    }

    clearSelection() {
        this.selectedInstances.forEach((instance) => {
            instance.setSelected(false);
        });
        this.selectedInstances.clear();
        this.countElement.textContent = translate("app.list.count", "%c", this.selectedInstances.size);
        this.floatingControls.classList.toggle("shown", this.selectedInstances.size > 0);
        this.lastSelectedInstance = null;
    }

    getAllInstances() {
        return this.activeGroups.map(e => e.instances).flat();
    }

    selectRange(instance) {
        let sortedInstances = this.getAllInstances();

        let start = sortedInstances.indexOf(this.lastSelectedInstance);
        let end = sortedInstances.indexOf(instance);

        if (start == -1 || end == -1) return;

        let from = Math.min(start, end);
        let to = Math.max(start, end);

        for (let i = from; i <= to; i++) {
            this.selectInstance(sortedInstances[i]);
        }
    }

    startInstanceDrag(instance, event, dragOffsetX, dragOffsetY) {
        if (this.groupBy.value != "custom_groups") return;
        if (this.selectedInstances.has(instance)) {
            this.draggedInstances = [...this.selectedInstances];
        } else {
            this.draggedInstances = [instance];
        }

        this.dragOffsetX = dragOffsetX;
        this.dragOffsetY = dragOffsetY;
        this.dragCursor = { x: event.clientX, y: event.clientY };

        this.dragging = true;
        document.body.classList.add("dragging");

        this.createDragPreview(instance, event);

        this.customGroupsById[instance.group_id || -1].showOverlay();

        for (let instance of this.draggedInstances) {
            instance.instanceButton.classList.add("dragging");
        }

        this.instanceDrag = (event) => {
            this.dragCursor.x = event.clientX;
            this.dragCursor.y = event.clientY;
            this.dragPreview.style.left = (event.clientX - this.dragOffsetX) + "px";
            this.dragPreview.style.top = (event.clientY - this.dragOffsetY) + "px";
        }

        this.dragScroll = () => {
            if (!this.dragging || !this.dragCursor) return;

            let container = this.contentElement;
            let threshold = 80;
            if (!container) return;

            let rect = container.getBoundingClientRect();
            let distanceFromTop = this.dragCursor.y - rect.top;
            let distanceFromBottom = rect.bottom - this.dragCursor.y;
            let maxScrollTop = container.scrollHeight - container.clientHeight;

            if (distanceFromTop < threshold && container.scrollTop > 0) {
                container.scrollTop = Math.max(0, container.scrollTop - (threshold - distanceFromTop) * 0.8);
            } else if (distanceFromBottom < threshold && container.scrollTop < maxScrollTop) {
                container.scrollTop = Math.min(maxScrollTop, container.scrollTop + (threshold - distanceFromBottom) * 0.8);
            }

            this.dragScrollFrame = requestAnimationFrame(this.dragScroll);
        }
        this.dragScrollFrame = requestAnimationFrame(this.dragScroll);

        this.endDrag = (e) => {
            this.endInstanceDrag(e);
        }
        document.body.addEventListener("pointermove", this.instanceDrag);
        document.body.addEventListener("pointerup", this.endDrag);
    }

    endInstanceDrag(event) {
        for (let instance of this.draggedInstances) {
            instance.instanceButton.classList.remove("dragging");
        }

        this.dragging = false;
        document.body.classList.remove("dragging");

        if (this.dragScrollFrame) {
            cancelAnimationFrame(this.dragScrollFrame);
            this.dragScrollFrame = null;
        }

        for (let group of this.activeGroups) {
            group.hideOverlay();
        }

        this.dragPreview?.remove();

        this.dragPreview = null;
        document.body.removeEventListener("pointermove", this.instanceDrag);
        document.body.removeEventListener("pointerup", this.endDrag);

        if (!event) {
            this.draggedInstances = null;
            return;
        }

        let element = document.elementFromPoint(
            event.clientX,
            event.clientY
        );

        let groupElement = element?.closest(".group");
        let groupId = groupElement?.dataset?.id;
        if (!groupId) {
            this.draggedInstances = null;
            return;
        }
        let group = this.customGroupsById[groupId || -1];

        animateGridReorderStart(".instance-item");
        for (let instance of this.draggedInstances) {
            instance.setGroup(group.id);
        }
        animateGridReorderEnd(".instance-item");
        this.draggedInstances = null;
    }

    createDragPreview(instance, event) {
        if (this.dragPreview) this.dragPreview.remove();

        let preview = createElement("div", "instance-drag-preview");
        let previewLeft = event.clientX - this.dragOffsetX;
        let previewTop = event.clientY - this.dragOffsetY;
        preview.style.left = previewLeft + "px";
        preview.style.top = previewTop + "px";
        document.body.appendChild(preview);

        let targetIndex = instance ? this.draggedInstances.indexOf(instance) : this.draggedInstances.length - 1;
        let fragment = document.createDocumentFragment();

        let positions = this.draggedInstances.map(dragInstance => {
            let rect = dragInstance.instanceButton.getBoundingClientRect();

            return {
                instance: dragInstance,
                x: rect.left,
                y: rect.top,
                width: rect.width,
                height: rect.height
            }
        });

        positions.forEach((posInfo, index) => {
            let dragInstance = posInfo.instance;
            let item = dragInstance.instanceButton.cloneNode(true);
            item.classList.add("drag-preview-item");

            let depth = this.draggedInstances.length - 1 - index;
            let isTop = index == targetIndex;
            if (depth == 0 && !isTop) {
                depth = this.draggedInstances.length - 1 - targetIndex;
            }
            if (isTop) depth = 0;
            let travelY = -1 * Math.pow(0.5, depth - 4) + 16;
            let scale = Math.max(1 - (depth * 0.08), 0);
            let opacity = 1 - (depth * 0.25);
            let zIndex = -depth + 999999;

            const dx = posInfo.x - previewLeft;
            const dy = posInfo.y - previewTop;

            item.style.width = `${posInfo.width}px`;
            item.style.height = `${posInfo.height}px`;
            item.style.scale = 1;
            item.style.opacity = 1;
            item.style.zIndex = zIndex;
            item.style.transform = `translate(${dx}px, ${dy}px) scale(1)`;
            item.style.transition = 'none';
            if (posInfo.y < -100 || posInfo.y > window.innerHeight) {
                item.style.opacity = opacity;
                item.style.transform = `translate(0px, ${isTop ? 0 : travelY}px) scale(${scale})`;
            } else {
                requestAnimationFrame(() => {
                    item.style.opacity = opacity;
                    item.style.transform = `translate(0px, ${isTop ? 0 : travelY}px) scale(${scale})`;
                    item.style.transition = '';
                });
            }

            fragment.appendChild(item);

        });
        preview.appendChild(fragment);
        this.dragPreview = preview;
    }

    async showInstances() {
        this.hasRequestGoing = true;
        this.instances = [];
        this.selectedInstances = new Set();
        this.lastSelectedInstance = null;
        this.groupElements = [];
        this.customGroups = await InstancesScreen.getCustomGroups();
        this.customGroupsById = Object.fromEntries(this.customGroups.map(x => [x.id, x]));
        this.contentElement.innerHTML = "";
        let ele = document.createDocumentFragment();
        let title = createElement("div", "title-top");
        let h1 = createElement("h1");
        h1.innerHTML = translate("app.page.instances");
        title.appendChild(h1);
        let createButton = createElement("button", "create-button");
        createButton.innerHTML = '<i class="fa-solid fa-plus"></i>' + translate("app.button.instances.create");
        createButton.onclick = () => {
            showCreateInstanceDialog();
        }
        title.appendChild(createButton);
        let createGroupButton = createElement("button", "create-group-button");
        createGroupButton.innerHTML = '<i class="fa-solid fa-folder-open"></i>' + translate("app.instances.group.create");
        createGroupButton.onclick = async () => {
            let groupInfo = await window.enderlynx.addGroup(1);
            let group = Group.applyGroup(groupInfo.id, groupInfo);
            this.addGroup(group, 0, false);
        }
        title.appendChild(createGroupButton);
        ele.appendChild(title);
        let searchAndFilter = createElement("div", "search-and-filter");
        ele.appendChild(searchAndFilter);
        let search = createElement("div");
        this.searchBar = new SearchBar(search, (v) => this.searchInstances(v), null);
        let sort = createElement('div');
        this.sortBy = new Dropdown(translate("app.instances.sort.by"), [
            { "name": translate("app.instances.sort.name"), "value": "name" },
            { "name": translate("app.instances.sort.last_played"), "value": "last_played" },
            { "name": translate("app.instances.sort.date_created"), "value": "date_created" },
            { "name": translate("app.instances.sort.date_modified"), "value": "date_modified" },
            { "name": translate("app.instances.sort.play_time"), "value": "playtime" },
            { "name": translate("app.instances.sort.loader"), "value": "loader" },
            { "name": translate("app.instances.sort.game_version"), "value": "vanilla_version" }
        ], sort, await getDefault("default_sort"), () => {
            this.sortInstances();
        });
        let group = createElement('div');
        this.groupBy = new Dropdown(translate("app.instances.group.by"), [
            { "name": translate("app.instances.group.none"), "value": "none" },
            { "name": translate("app.instances.group.custom_groups"), "value": "custom_groups" },
            { "name": translate("app.instances.group.pinned"), "value": "pinned" },
            { "name": translate("app.instances.group.loader"), "value": "loader" },
            { "name": translate("app.instances.group.game_version"), "value": "game_version" }
        ], group, await getDefault("default_group"), () => {
            this.groupInstances()
        });
        searchAndFilter.appendChild(search);
        searchAndFilter.appendChild(sort);
        searchAndFilter.appendChild(group);
        this.groupList = createElement("div", "group-list");
        let noResultsEle = new NoResultsFound(translate("app.instances.none")).element;
        let loading = new LoadingContainer();
        ele.appendChild(loading.element);
        this.instances = await getInstances();
        for (let instance of this.instances) {
            instance.getInstanceButton();
            instance.watchForChange("group_id", async (id, old_id) => {
                animateGridReorderStart(".instance-item");
                if (!old_id) old_id = -1;
                if (this.groupBy.value != "custom_groups") return;
                this.customGroupsById[old_id || -1]?.removeFromGroup(instance);
                this.customGroupsById[id]?.moveToGroup(instance, this.sortBy.value);
                animateGridReorderEnd(".instance-item");
            });
        }
        this.contentElement.appendChild(ele);
        let floatingControls = createElement("div", "floating-controls");
        this.contentElement.appendChild(floatingControls);
        this.floatingControls = floatingControls;
        let clearButton = createElement("button", "selected-clear selected-button");
        clearButton.textContent = translate("app.list.clear");
        clearButton.onclick = () => {
            this.clearSelection();
        }
        this.keydownListener = (e) => {
            if (e.target.matches("dialog *")) return;
            if (e.key == "Escape") {
                if (this.dragging) {
                    this.endInstanceDrag();
                } else {
                    this.clearSelection();
                }
            }
        }
        document.body.addEventListener("keydown", this.keydownListener);
        let countElement = createElement("div", "selected-count");
        countElement.textContent = translate("app.list.count", "%c", 0);
        this.countElement = countElement;
        this.floatingControls.appendChild(countElement);
        this.floatingControls.appendChild(clearButton);

        let newGroupButton = createElement("button", "selected-button");
        newGroupButton.innerHTML = '<i class="fa-regular fa-square-plus"></i>' + translate("app.instances.new_group");
        newGroupButton.onclick = async () => {
            let oldGroupId = [...this.selectedInstances][0].group_id;
            let insertIndex = oldGroupId ? this.activeGroups.findIndex(group => group.id == oldGroupId) : this.activeGroups.length;
            let groupInfo = await window.enderlynx.addGroup(this.activeGroups[insertIndex].position);
            let group = Group.applyGroup(groupInfo.id, groupInfo);
            this.addGroup(group, insertIndex, true);
            this.selectedInstances.forEach((instance) => {
                instance.setGroup(group.id);
            });
            this.clearSelection();
        }
        floatingControls.appendChild(newGroupButton);

        let moveToGroupButton = createElement("button", "selected-button");
        moveToGroupButton.innerHTML = '<i class="fa-solid fa-arrows-up-down-left-right"></i>' + translate("app.instances.move_to_group");
        moveToGroupButton.onclick = () => {
            let dialog = new Dialog();
            dialog.showDialog(translate("app.instances.move_to_group.title"), "form", [
                {
                    "type": "dropdown",
                    "id": "group",
                    "name": translate("app.instances.move_to_group.group"),
                    "options": this.customGroups.map(e => ({ "name": e.name, "value": e.id })),
                    "default": -1
                }
            ], [
                {
                    "type": "cancel",
                    "content": translate("app.instances.move_to_group.cancel")
                },
                {
                    "type": "confirm",
                    "content": translate("app.instances.move_to_group.confirm")
                }
            ], [], (info) => {
                let group = this.customGroupsById[info.group];
                if (!group) return;
                this.selectedInstances.forEach((instance) => {
                    instance.setGroup(group.id);
                });
                this.clearSelection();
            });
        }
        floatingControls.appendChild(moveToGroupButton);

        let deleteButton = createElement("button", "selected-button danger");
        deleteButton.innerHTML = '<i class="fa-solid fa-trash-can"></i>' + translate("app.instances.delete");
        deleteButton.onclick = () => {
            Instance.showDeleteDialogForMultiple([...this.selectedInstances], () => {
                animateGridReorderStart(".instance-item");
                this.selectedInstances.forEach((instance) => {
                    instance.instanceButton.remove();
                });
                animateGridReorderEnd(".instance-item");
                this.activeGroups.forEach((group) => {
                    group.updateCount();
                });
                this.clearSelection();
            });
        }
        floatingControls.appendChild(deleteButton);

        this.groupInstances();
        loading.element.remove();
        this.groupList.classList.add("disable-instance-list-transitions");
        this.contentElement.appendChild(noResultsEle);
        this.contentElement.appendChild(this.groupList);
        this.groupList.offsetHeight; // force layout
        this.groupList.classList.remove("disable-instance-list-transitions");
        this.hasRequestGoing = false;
    }

    getCustomGroupNeighbor(group_id, direction) {
        let groupIndex = this.activeGroups.findIndex(group => group.id == group_id);
        return this.activeGroups[groupIndex + direction]?.id;
    }

    updateGroupActions() {
        for (let group of this.activeGroups) {
            if (!group.actions) continue;
            let hasPosition = Number.isFinite(group.position);
            group.actions.up.disabled = !hasPosition || !this.getCustomGroupNeighbor(group.id, -1);
            group.actions.down.disabled = !hasPosition || !this.getCustomGroupNeighbor(group.id, 1);
            group.actions.up.classList.toggle("disabled", group.actions.up.disabled);
            group.actions.down.classList.toggle("disabled", group.actions.down.disabled);
            group.actions.up.onclick = () => {
                this.swapGroupPositions(group.id, this.getCustomGroupNeighbor(group.id, -1));
            }
            group.actions.down.onclick = () => {
                this.swapGroupPositions(group.id, this.getCustomGroupNeighbor(group.id, 1));
            }
        }
    }

    swapGroupPositions(group_id1, group_id2) {
        this.groupList.classList.add("disable-instance-list-transitions");
        if (!group_id2) return;
        animateGridReorderStart(".group");
        window.enderlynx.swapGroupPositions(group_id1, group_id2);
        let group1 = this.activeGroups.find(e => e.id == group_id1);
        let group2 = this.activeGroups.find(e => e.id == group_id2);
        let index1 = this.activeGroups.indexOf(group1);
        let index2 = this.activeGroups.indexOf(group2);
        if (index1 !== -1 && index2 !== -1) {
            [this.activeGroups[index1], this.activeGroups[index2]] = [this.activeGroups[index2], this.activeGroups[index1]];
        }

        let pos1 = group1.position;
        let pos2 = group2.position;
        if (group1) group1.position = pos2;
        if (group2) group2.position = pos1;
        if (pos2 < pos1) {
            group1.element.parentNode.insertBefore(group1.element, group2.element);
        } else {
            group2.element.parentNode.insertBefore(group2.element, group1.element);
        }
        this.updateGroupActions();
        animateGridReorderEnd(".group");
        this.groupList.classList.remove("disable-instance-list-transitions");
    }

    async deleteGroup(group) {
        await window.enderlynx.deleteGroup(group.id);
        this.customGroups = this.customGroups.filter(e => e.id != group.id);
        this.activeGroups = this.activeGroups.filter(e => e.id != group.id);
        delete this.customGroupsById[group.id];
        animateGridReorderStart(".group");
        group.element.remove();
        this.updateGroupActions();
        animateGridReorderEnd(".group");
    }

    addGroup(group, insertIndex = this.activeGroups.length, scrollIntoView = false) {
        this.customGroupsById[group.id] = group;
        if (this.groupBy.value == "custom_groups") {
            group.formGroupElement([], this.sortBy.value, async () => {
                await this.deleteGroup(group);
            });
            this.activeGroups.splice(insertIndex, 0, group);
            if (insertIndex < this.groupList.children.length) {
                this.groupList.children[insertIndex].before(group.element);
            } else {
                this.groupList.appendChild(group.element);
            }
            group.editName();
        } else {
            this.customGroups.push(group);
        }
        if (scrollIntoView && group.element) {
            const rect = group.element.getBoundingClientRect();
            const isInView = rect.top < window.innerHeight && rect.bottom > 0;
            if (!isInView) {
                group.element.scrollIntoView({
                    behavior: 'smooth',
                    block: 'nearest'
                });
            }
        }
        this.updateGroupActions();
    }

    groupInstances() {
        let how = this.groupBy.getSelected;
        if (!this.groupList) return;
        this.activeGroups = [];
        this.activeGroupsByName = {};
        setDefault("default_group", how);
        let groupMap = {};
        for (let instance of this.instances) {
            let key = "";
            if (how == "custom_groups") key = instance?.group_id || -1;
            if (how == "pinned") key = instance.isPinned().toString();
            if (how == "loader") key = instance.loader;
            if (how == "game_version") key = instance.vanilla_version;
            if (!groupMap[key]) groupMap[key] = [];
            groupMap[key].push(instance);
        }
        this.groupList.innerHTML = "";
        let groups = Object.keys(groupMap);
        if (how == "custom_groups") {
            groups = this.customGroups.map(e => e.id);
        }
        if (how == "game_version") {
            sortByVersion(groups, true);
        } else if (how == "pinned") {
            groups.sort((a, b) => {
                if (a == "false") return 1;
                return -1;
            });
        } else if (how == "custom_groups") {
            groups.sort((a, b) => {
                let groupAPos = this.customGroupsById[a]?.position || 0;
                let groupBPos = this.customGroupsById[b]?.position || 0;
                return groupAPos - groupBPos;
            });
        } else {
            groups.sort((a, b) => {
                if (a === "" && b !== "") return -1;
                if (a !== "" && b === "") return 1;
                return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
            });
        }
        if (how != "custom_groups") {
            this.activeGroups = InstancesScreen.getGroupsByType(how, groups);
            this.activeGroupsByName = Object.fromEntries(this.activeGroups.map(x => [x.name, x]));
        } else {
            this.activeGroups = this.customGroups;
        }
        this.groupList.classList.add("disable-instance-list-transitions");
        for (let group of this.activeGroups) {
            group.formGroupElement(groupMap[how == "custom_groups" ? group.id : group.name] || [], this.sortBy.value, async () => {
                await this.deleteGroup(group);
            });
            group.figureOutVisibility(this.searchBar.value);
            this.groupList.appendChild(how == "none" ? group.instancesElement : group.element);
        }
        this.updateGroupActions();
        setTimeout(() => {
            this.groupList.classList.remove("disable-instance-list-transitions");
        }, 0);
    }

    searchInstances(query) {
        query = query.toLowerCase().trim();
        let instances = this.instances;
        for (let instance of instances) {
            let button = instance.instanceButton;
            let matches = instance.name.toLowerCase().includes(query);
            button.classList.toggle("hidden", !matches);
        }
        this.groupList.classList.add("disable-instance-list-transitions");
        for (let group of this.activeGroups) {
            group.figureOutVisibility(query);
        }
        requestAnimationFrame(() => {
            this.groupList.classList.remove("disable-instance-list-transitions");
        });
    }

    sortInstances(disableAnimation) {
        let how = this.sortBy.getSelected;
        if (!disableAnimation) animateGridReorderStart(".instance-item");
        if (!this.groupList) return;
        setDefault("default_sort", how);
        for (let group of this.activeGroups) {
            group.sort(how);
        }
        if (!disableAnimation) animateGridReorderEnd(".instance-item");
    }

    onClose() {
        if (!this.keydownListener) return;
        document.body.removeEventListener("keydown", this.keydownListener);
    }
}

class DiscoverScreen extends Screen {
    constructor() {
        super("discover");
    }

    display(dont_add_to_log, ...args) {
        super.display(dont_add_to_log, ...args);
    }

    calculateContent(instance, vanilla_version, loader, default_tab) {
        this.contentElement.innerHTML = "";
        this.content_source = "default";
        this.sort_by = "relevance";
        this.view = 20;
        this.game_version = vanilla_version || "all";
        this.loader_dropdown = loader || "all";
        this.query = "";
        this.instance = instance;
        this.vanilla_version = vanilla_version;
        this.loader = loader;
        this.default_tab = default_tab;
        this.active_categories = [];
        added_vt_packs = [];
        DiscoverStateManagement.setInstance(instance);
        let titleTop = createElement("div", "title-top");
        let backButton = createElement("button", "back-button");
        backButton.innerHTML = '<i class="fa-solid fa-arrow-left"></i>' + translate("app.discover.back_to_instance");
        backButton.onclick = () => {
            this.instance.display(default_tab == "world" ? "worlds" : "content");
        }
        let title = document.createElement("h1");
        title.innerHTML = translate("app.discover.add_content");
        titleTop.appendChild(title);
        if (this.instance) titleTop.appendChild(backButton);
        else title.innerHTML = translate("app.discover.title");
        let ele = this.contentElement;
        this.contentElement.className = "instance-content";
        ele.appendChild(titleTop);
        content.appendChild(ele);
        let tabsElement = document.createElement("div");
        ele.appendChild(tabsElement);
        this.tabs = new TabContent(tabsElement, [
            !this.instance ? {
                "name": translate("app.discover.modpacks"),
                "value": "modpack",
                "func": () => {
                    this.contentTabSelect("modpack");
                }
            } : null,
            !this.loader || this.loader != "vanilla" ? {
                "name": translate("app.discover.mods"),
                "value": "mod",
                "func": () => {
                    this.contentTabSelect("mod");
                }
            } : null,
            {
                "name": translate("app.discover.resource_packs"),
                "value": "resourcepack",
                "func": () => {
                    this.contentTabSelect("resourcepack");
                }
            },
            !this.loader || this.loader != "vanilla" ? {
                "name": translate("app.discover.shaders"),
                "value": "shader",
                "func": () => {
                    this.contentTabSelect("shader");
                }
            } : null,
            {
                "name": translate("app.discover.worlds"),
                "value": "world",
                "func": () => {
                    this.contentTabSelect("world");
                }
            },
            {
                "name": translate("app.discover.servers"),
                "value": "servers",
                "func": () => {
                    this.contentTabSelect("server");
                }
            },
            {
                "name": translate("app.discover.data_packs"),
                "value": "datapack",
                "func": () => {
                    this.contentTabSelect("datapack");
                }
            }
        ].filter(e => e));
        this.tabElement = createElement("div", "tab-info");
        ele.appendChild(this.tabElement);
        if (this.default_tab) {
            this.tabs.selectOption(default_tab);
            this.contentTabSelect(default_tab);
        } else if (!this.instance) {
            this.contentTabSelect("modpack");
        } else if (!loader || loader != "vanilla") {
            this.contentTabSelect("mod");
        } else {
            this.contentTabSelect("resourcepack");
        }
        MoreMenu.clearMenus();
    }

    contentTabSelect(tab) {
        this.currentTab = tab;
        this.tabElement.innerHTML = '';
        let sources = [];
        if (tab == "modpack" || tab == "mod" || tab == "resourcepack" || tab == "shader" || tab == "datapack" || tab == "server") {
            sources.push({
                "name": translate("app.discover.modrinth"),
                "value": "modrinth",
                "func": () => { }
            });
        }
        if (tab == "modpack" || tab == "mod" || tab == "resourcepack" || tab == "shader" || tab == "world" || tab == "datapack") {
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

        let searchAndFilter = createElement("div", "search-and-filter-v2");
        this.discoverList = createElement("div", "discover-list");
        let searchElement = createElement("div");
        searchElement.style.flexGrow = 2;
        this.searchBar = new SearchBar(searchElement, () => { }, (v) => {
            this.getContent();
            this.query = v;
        });
        this.searchBar.setValue(this.query);
        let dropdownElement = document.createElement("div");
        dropdownElement.style.minWidth = "200px";
        this.sourceDropdown = new Dropdown(translate("app.discover.content_source"), sources, dropdownElement, sources[0].value, (v) => {
            this.active_categories = [];
            this.categoryFilters.clear();
            this.getContent();
            this.content_source = v;
        });
        if (this.content_source != "default" && sources.map(e => e.value).includes(this.content_source)) {
            this.sourceDropdown.selectOption(this.content_source);
        }
        searchAndFilter.appendChild(dropdownElement);
        searchAndFilter.appendChild(searchElement);
        this.tabElement.appendChild(searchAndFilter);
        let paginationTop = new Pagination(1, this.totalPages, (new_page) => {
            this.getContent(new_page);
        });
        this.paginationTop = paginationTop;
        let sortByDropdownElement = createElement("div");
        sortByDropdownElement.style.width = "150px";
        let gameVersionDropdownElement = createElement("div");
        gameVersionDropdownElement.style.width = "180px";
        let loaderDropdownElement = createElement("div");
        loaderDropdownElement.style.width = "150px";
        let sortByDropdown = new Dropdown(translate("app.discover.sort_by"), [
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
        ], sortByDropdownElement, this.sort_by, (new_sort) => {
            this.sort_by = new_sort;
            this.getContent();
        });
        let gameVersionDropdown = new SearchDropdown(translate("app.discover.game_version"), [
            { "name": translate("app.discover.game_version.all"), "value": "all" }
        ].concat(minecraftVersions.toReversed().map(e => ({ "name": e, "value": e }))), gameVersionDropdownElement, this.game_version, (new_game_version) => {
            this.game_version = new_game_version;
            this.getContent();
        });
        let loaderDropdown = new Dropdown(translate("app.discover.loader"), this.currentTab == "server" ? [
            {
                "name": translate("app.discover.loader.all"),
                "value": "all"
            },
            {
                "name": translate("app.discover.type.vanilla"),
                "value": "vanilla"
            },
            {
                "name": translate("app.discover.type.modded"),
                "value": "modpack"
            }
        ] : [
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
        ], loaderDropdownElement, this.loader_dropdown, (new_loader) => {
            this.loader_dropdown = new_loader;
            this.getContent();
        });
        this.loaderDropdown = loaderDropdown;
        let categoryWrapperElement = createElement("div");
        let categoryFilters = new CategoryFilter(categoryWrapperElement, [], [], (active_categories) => {
            this.active_categories = active_categories;
            this.getContent();
        });
        this.active_categories = [];
        this.categoryFilters = categoryFilters;
        this.categoryFilters.clear();
        let paginationBottom = new Pagination(1, this.totalPages, (new_page) => {
            this.getContent(new_page);
        });
        this.paginationBottom = paginationBottom;
        let discoverListTop = createElement("div", "discover-list-top");
        discoverListTop.appendChild(sortByDropdownElement);
        discoverListTop.appendChild(gameVersionDropdownElement);
        if (!["resourcepack", "shader", "world", "datapack"].includes(this.currentTab)) discoverListTop.appendChild(loaderDropdownElement);
        discoverListTop.appendChild(categoryWrapperElement);
        discoverListTop.appendChild(paginationTop.element);
        this.discoverListTop = discoverListTop;
        this.tabElement.appendChild(discoverListTop);
        this.tabElement.appendChild(this.discoverList);
        this.getContent();
    }

    async getContent(page = 1) {
        let pageId = Math.random();
        this.pageId = pageId;
        let source = this.sourceDropdown.value;
        let query = this.searchBar.value;
        this.paginationBottom.setPage(page);
        this.paginationTop.setPage(page);
        if (["fabric", "forge", "neoforge", "quilt"].includes(this.loader_dropdown) && this.currentTab == "server") this.loader_dropdown = "all";
        if (this.currentTab != "server") {
            if (this.loader_dropdown == "vanilla" || this.loader_dropdown == "modpack") this.loader_dropdown = "all";
        }
        this.loaderDropdown.selectOption(this.loader_dropdown, true);
        this.discoverList.innerHTML = "";
        let loading = new LoadingContainer();
        this.discoverList.appendChild(loading.element);
        this.requestFrame();
        if (source == "vanilla_tweaks") {
            this.discoverListTop.style.display = "none";
            if (added_vt_packs.length == 0 && this.currentTab == "resourcepack") {
                added_vt_packs = JSON.parse(await window.enderlynx.getInstalledVanillaTweaksResourcePacks(this.instance?.instance_id));
            }
            new VanillaTweaksSelector(this.currentTab, this.game_version, this.instance?.instance_id, undefined, this.discoverList, query);
            return;
        }
        this.discoverListTop.style.display = "";
        let results = [];
        let categories = [];
        try {
            if (source == "modrinth") results = await Modrinth.search(query, this.loader_dropdown, this.currentTab, this.game_version, page, this.view, this.sort_by, this.active_categories);
            else if (source == "curseforge") results = await CurseForge.search(query, this.loader_dropdown, this.currentTab, this.game_version, page, this.view, this.sort_by, this.active_categories);
            if (this.pageId != pageId) return;
        } catch (err) {
            loading.errorOut(err, () => {
                this.getContent(page);
            });
            return;
        }
        try {
            if (source == "modrinth") categories = await Modrinth.getCategories(this.currentTab);
            else if (source == "curseforge") categories = await CurseForge.getCategories(this.currentTab);
        } catch (err) { }
        this.categoryFilters.setCategories(categories);
        this.totalPages = Math.ceil(results.total_hits / this.view);
        this.paginationBottom.setTotalPages(this.totalPages);
        this.paginationTop.setTotalPages(this.totalPages);
        this.discoverList.innerHTML = "";
        if (!results.projects || !results.projects.length) {
            let noresults = new NoResultsFound();
            this.discoverList.appendChild(noresults.element);
            return;
        }
        for (let content of results.projects) {
            let entry = new ContentSearchEntry(content, this.instance, this.game_version == "all" ? null : this.game_version, this.currentTab == "server" ? null : this.loader_dropdown == "all" ? null : this.loader_dropdown, false, this.currentTab, undefined);
            this.discoverList.appendChild(entry.element);
        }
        this.discoverList.appendChild(this.paginationBottom.element);
    }
}

class WardrobeScreen extends Screen {
    constructor() {
        super("wardrobe");
    }

    async display(dont_add_to_log, ...args) {
        await super.display(dont_add_to_log, ...args);
        if (this.tabs) this.tabs.selectOption("skins");
    }

    async calculateContent() {
        this.contentElement.innerHTML = "";
        this.profile = await getDefaultProfile();
        this.activeSkin = await this.profile.getActiveSkin();
        this.activeCape = await this.profile.getActiveCape();
        if (!this.profile) {
            this.contentElement.style.padding = "8px";
            let signInWarning = new NoResultsFound(translate("app.wardrobe.sign_in"));
            this.contentElement.appendChild(signInWarning.element);
            return;
        }
        if (this.skinViewer) this.skinViewer.dispose();
        this.contentElement.className = "my-account-grid";
        let ele = this.contentElement;
        let skinRenderContainer = createElement("div", "skin-render-container");
        let skinRenderCanvas = createElement("canvas", "skin-render-canvas");
        skinRenderContainer.appendChild(skinRenderCanvas);
        ele.appendChild(skinRenderContainer);
        const dpr = window.devicePixelRatio || 1;
        try {
            this.skinViewer = new skinview3d.SkinViewer({
                canvas: skinRenderCanvas,
                width: 298 * dpr,
                height: 498 * dpr
            });
        } catch (e) {
            this.contentElement.style.gridTemplateColumns = "1fr";
            skinRenderContainer.style.display = "none";
            console.error("Unable to create skin viewer");
        }
        if (this.skinViewer) {
            skinRenderCanvas.style.width = "300px";
            skinRenderCanvas.style.height = "500px";
            this.skinViewer.pixelRatio = 2
            this.skinViewer.zoom = 0.7;
            let walkingAnimation = new skinview3d.WalkingAnimation();
            walkingAnimation.headBobbing = false;
            this.skinViewer.animation = walkingAnimation;
            this.skinViewer.animation.speed = 0.5;
            let pauseButton = createElement("button", "skin-render-pause");
            pauseButton.innerHTML = '<i class="fa-solid fa-pause"></i>';
            let onPause = () => {
                this.skinViewer.animation.paused = true;
                pauseButton.innerHTML = '<i class="fa-solid fa-play"></i>'
                pauseButton.onclick = onResume;
            }
            let onResume = () => {
                this.skinViewer.animation.paused = false;
                pauseButton.innerHTML = '<i class="fa-solid fa-pause"></i>';
                pauseButton.onclick = onPause;
            }
            pauseButton.onclick = onPause;
            if (document.body.matches(".potato")) {
                this.skinViewer.animation.paused = true;
                pauseButton.innerHTML = '<i class="fa-solid fa-play"></i>'
                pauseButton.onclick = onResume;
            }
            skinRenderContainer.appendChild(pauseButton);
        }
        let optionsContainer = createElement("div", "my-account-options");
        let title = createElement("div", "title-top");
        let h1 = document.createElement("h1");
        h1.innerHTML = translate("app.page.wardrobe");
        title.appendChild(h1);
        optionsContainer.appendChild(title);
        let activeScreen = document.createElement("div");
        ele.appendChild(optionsContainer);
        let skinOptions = document.createElement("div");
        this.skinOptions = skinOptions;
        skinOptions.className = "my-account-option-box";
        activeScreen.appendChild(skinOptions);
        let fileDrop = createElement("div", "small-drop-overlay drop-overlay");
        fileDrop.dataset.action = "skin-import";
        let fileDropInner = createElement("div", "drop-overlay-inner");
        fileDropInner.innerHTML = translate("app.import.skin.drop");
        fileDrop.appendChild(fileDropInner);
        skinOptions.appendChild(fileDrop);
        let searchAndFilter = createElement("div", "search-and-filter-v2");
        let searchElement = document.createElement("div");
        searchElement.style.flexGrow = "2";
        this.searchbar = new SearchBar(searchElement, () => {
            this.filterSkins(true);
        }, () => { })
        searchAndFilter.appendChild(searchElement);
        let dropdownElement = document.createElement("div");
        dropdownElement.style.minWidth = "200px";
        this.sortdropdown = new Dropdown(translate("app.wardrobe.sort_by"), [
            {
                "name": translate("app.wardrobe.sort_by.favorites_first"),
                "value": "favorites_first"
            },
            {
                "name": translate("app.wardrobe.sort_by.name"),
                "value": "name"
            },
            {
                "name": translate("app.wardrobe.sort_by.last_used"),
                "value": "last_used"
            }
        ], dropdownElement, "favorites_first", () => {
            this.filterSkins();
        })
        searchAndFilter.appendChild(searchElement);
        searchAndFilter.appendChild(dropdownElement);
        skinOptions.appendChild(searchAndFilter);
        let capeOptions = document.createElement("div");
        capeOptions.className = "my-account-option-box";
        let skinList = document.createElement("div");
        let capeList = document.createElement("div");
        this.skinList = skinList;
        this.capeList = capeList;
        skinList.className = 'my-account-option-list-skin';
        capeList.className = 'my-account-option-list-cape';
        skinOptions.appendChild(skinList);
        capeOptions.appendChild(capeList);

        this.showCapes();

        this.defaultSkinEntryList = [];
        getDefaultSkins((info) => {
            this.defaultSkinInfo = info;
            this.showDefaultSkins();
        });

        this.skinEntries = [];
        this.showContent(true);
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
            try {
                this.profile = await getDefaultProfile();
                this.activeSkin = await this.profile.getActiveSkin();
                this.activeCape = await this.profile.getActiveCape();
                refreshButtonIcon.classList.remove("spinning");
                this.showContent();
                this.showDefaultSkins();
                this.showCapes();
                accountSwitcher.reloadHeads();
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
            ], async (info) => {
                if (info.selected_tab == "username") {
                    try {
                        info.skin = (await window.enderlynx.getSkinFromUsername(info.username)).url;
                    } catch (e) {
                        displayError(translate("app.wardrobe.import.username.fail"));
                        return;
                    }
                    info.name = info.name_u;
                    info.model = info.model_u;
                } else if (info.selected_tab == "url") {
                    try {
                        info.skin = (await window.enderlynx.getSkinFromURL(info.url)).url;
                    } catch (e) {
                        displayError(translate("app.wardrobe.import.url.fail"));
                        return;
                    }
                    info.name = info.name_l;
                    info.model = info.model_l;
                }
                await importSkin(info, () => {
                    this.showContent();
                });
            }, () => { }, undefined, true);
        }
        skinButtonContainer.appendChild(importButton);

        let tabElement = document.createElement("div");
        optionsContainer.appendChild(tabElement);
        this.tabs = new TabContent(tabElement, [
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

    filterSkins(noAnimate) {
        if (!noAnimate) animateGridReorderStart(".skin");
        let search = this.searchbar.value.toLowerCase().trim();
        let sort = this.sortdropdown.value;
        this.defaultSkinEntryList.forEach(e => e.skinEntry.element.remove());
        this.skinEntries.forEach(e => e.element.remove());
        let filteredEntries = this.skinEntries.filter(e => e.name.toLowerCase().includes(search));
        let filteredDefaultSkinEntries = this.defaultSkinEntryList.filter(e => e.skinEntry.name.toLowerCase().includes(search));
        filteredEntries.sort((a, b) => {
            if (sort == "name") {
                let av = a.name.toLowerCase();
                let bv = b.name.toLowerCase();
                if (av > bv) return 1;
                if (av < bv) return -1;
                return 0;
            }
            let c = a.skin.last_used;
            let d = b.skin.last_used;
            c = c.getTime();
            d = d.getTime();
            if (isNaN(c)) c = 0;
            if (isNaN(d)) d = 0;
            return d - c;
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
            this.skinList.appendChild(e.element);
        });
        filteredDefaultSkinEntries.forEach(e => {
            e.skinList.appendChild(e.skinEntry.element);
        });
        if (!noAnimate) animateGridReorderEnd(".skin");
    }
    async showContent(noAnimate) {
        if (!noAnimate) animateGridReorderStart(".skin");
        this.skinEntries = [];
        if (this.skinViewer) this.skinViewer.loadSkin(this.activeSkin?.skin_url || null, {
            model: this.activeSkin?.model == "slim" ? "slim" : "default",
        });
        if (this.skinViewer) this.skinViewer.loadCape(this.activeCape ? window.enderlynx.getCapePath(this.activeCape.cape_id) : null);
        this.skinList.innerHTML = '';
        let skins = await getSkinsNoDefaults();
        for (let skin of skins) {
            let skinEntry = new SkinEntry(skin, true, this.skinViewer, this.profile, () => {
                this.showContent()
            }, (noAnimate) => {
                this.filterSkins(noAnimate);
            });
            this.skinEntries.push(skinEntry);
            this.skinList.appendChild(skinEntry.element);
        }
        this.filterSkins(true);
        if (!noAnimate) animateGridReorderEnd(".skin");
    }

    async showDefaultSkins() {
        [...document.querySelectorAll(".wardrobe-default-skin-details")].forEach(e => e.remove());
        let tags = this.defaultSkinInfo.tags;
        let skins = this.defaultSkinInfo.skins;
        for (let i = 0; i < tags.length; i++) {
            let detailsWrapper = createElement("div", "details wardrobe-default-skin-details");
            this.skinOptions.appendChild(detailsWrapper);
            let defaultSkinList = createElement("div", "my-account-option-list-skin");
            let detailsTop = createElement("button", "details-top");
            let detailTitle = createElement("span", "details-top-text");
            detailTitle.textContent = translate(tags[i]);
            let detailChevron = createElement("span", "details-top-chevron");
            detailChevron.innerHTML = '<i class="fa-solid fa-chevron-down"></i>';
            detailsTop.appendChild(detailTitle);
            detailsTop.appendChild(detailChevron);
            let detailContent = createElement("div", "details-content");
            detailsWrapper.appendChild(detailsTop);
            detailsWrapper.appendChild(detailContent);
            detailContent.appendChild(defaultSkinList);
            let skinsWithTag = skins.filter(e => e.tag == tags[i]);
            skinsWithTag.forEach(e => {
                let skinEntry = new SkinEntry(e, false, this.skinViewer, this.profile, () => {
                    this.showContent()
                }, (noAnimate) => {
                    this.filterSkins(noAnimate);
                });
                this.defaultSkinEntryList.push({ skinList: defaultSkinList, skinEntry });
                defaultSkinList.appendChild(skinEntry.element);
            });
            detailsTop.onclick = () => {
                if (detailsWrapper.classList.contains("open")) {
                    detailsWrapper.classList.remove("open");
                } else {
                    detailsWrapper.classList.add("open");
                    detailsWrapper.classList.add("animate");
                    setTimeout(() => {
                        detailsWrapper.classList.remove("animate");
                    }, 250);
                }
            }
        }
    }

    async showCapes() {
        this.capeList.innerHTML = "";

        let capes = await this.profile.getCapes();
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
                let success = await applyCape(this.profile.id, e);
                if (success) {
                    let oldEle = document.querySelector(".my-account-option.cape.selected");
                    oldEle.classList.remove("selected");
                    currentEle.classList.add("selected");
                    e.setActive();
                    if (this.skinViewer) this.skinViewer.loadCape(window.enderlynx.getCapePath(e.cape_id));
                    this.activeCape = e;
                }
                loader.style.display = "none";
                capeImg.style.display = "block";
            }
            capeEle.className = "my-account-option";
            capeEle.title = e.cape_name;
            capeEle.classList.add("cape");
            let capeImg = document.createElement("img");
            extractImageRegionToDataURL(window.enderlynx.getCapePath(e.cape_id), 1, 1, 10, 16, (e) => {
                if (e) capeImg.src = e;
            });
            capeImg.classList.add("option-image-cape");
            let loader = createElement("div", "loading-container-spinner");
            loader.style.display = "none";
            let capeName = createElement("div", "cape-name");
            capeEle.appendChild(capeImg);
            capeEle.appendChild(loader);
            capeEle.appendChild(capeName);
            capeName.textContent = e.cape_name;
            this.capeList.appendChild(capeEle);
            if (e.active) {
                capeEle.classList.add("selected");
            }
            capeEle.onclick = equipCape;
        });
        let capeEle = createElement("button", "my-account-option");
        capeEle.classList.add("cape");
        capeEle.title = translate("app.wardrobe.no_cape");
        let capeImg = createElement("div", "option-image-cape");
        capeImg.innerHTML = '<i class="fa-regular fa-circle-xmark"></i>';
        let loader = createElement("div", "loading-container-spinner");
        loader.style.display = "none";
        let capeName = createElement("div", "cape-name");
        capeEle.appendChild(capeImg);
        capeEle.appendChild(loader);
        capeEle.appendChild(capeName);
        capeName.innerHTML = translate("app.wardrobe.no_cape");
        this.capeList.appendChild(capeEle);
        if (!this.activeCape) {
            capeEle.classList.add("selected");
        }
        capeEle.onclick = async (event) => {
            loader.style.display = "block";
            capeImg.style.display = "none";
            let currentEle = event.currentTarget;
            let success = await applyCape(this.profile.id, null);
            if (success) {
                let oldEle = document.querySelector(".my-account-option.cape.selected");
                oldEle.classList.remove("selected");
                currentEle.classList.add("selected");
                this.profile.removeActiveCape();
                if (this.skinViewer) this.skinViewer.loadCape(null);
                this.activeCape = null;
            }
            loader.style.display = "none";
            capeImg.style.display = "block";
        }
    }
}

class FriendsScreen extends Screen {
    friends = {};
    presences = {
        "ONLINE": {
            "text": translate("app.friends.status.online"),
            "green": true
        },
        "PLAYING_OFFLINE": {
            "text": translate("app.friends.status.in_a_world"),
            "green": true
        },
        "PLAYING_REALMS": {
            "text": translate("app.friends.status.in_a_realm"),
            "green": true
        },
        "PLAYING_SERVER": {
            "text": translate("app.friends.status.on_a_server"),
            "green": true
        },
        "PLAYING_HOSTED_SERVER": {
            "text": translate("app.friends.status.in_a_joinable_world"),
            "green": true
        },
        "OFFLINE": {
            "text": translate("app.friends.status.offline"),
            "green": false
        }
    }
    lastRefreshed = {};

    constructor() {
        super("friends");
    }

    async display(dont_add_to_log, ...args) {
        await super.display(dont_add_to_log, ...args);
    }

    async calculateContent() {
        this.loading = new LoadingContainer();
        this.contentElement.innerHTML = "";
        this.contentElement.className = "instance-content";
        let titleElement = createElement("div", "title-top");
        let titleh1 = createElement("h1", "", { textContent: translate("app.friends.title") });
        titleElement.appendChild(titleh1);
        this.contentElement.appendChild(titleElement);
        let infoElement = createElement("div", "info", { innerHTML: '<i class="fa-solid fa-triangle-exclamation"></i>' + translate("app.friends.info") });
        this.contentElement.appendChild(infoElement);
        this.subContentElement = createElement("div", "friends-content");
        this.contentElement.appendChild(this.subContentElement);
        this.profile = await getDefaultProfile();
        if (!this.profile) {
            this.contentElement.style.padding = "8px";
            let signInWarning = new NoResultsFound(translate("app.friends.sign_in"));
            this.contentElement.appendChild(signInWarning.element);
            return;
        }
        let skinButtonContainer = document.createElement("div");
        skinButtonContainer.className = "skin-button-container";
        this.subContentElement.appendChild(skinButtonContainer);
        let refreshButton = document.createElement("button");
        refreshButton.className = "skin-button";
        let refreshButtonIcon = document.createElement("i");
        refreshButtonIcon.className = "fa-solid fa-arrows-rotate";
        let refreshButtonText = document.createElement("span");
        refreshButtonText.innerHTML = translate("app.friends.refresh");
        refreshButton.appendChild(refreshButtonIcon);
        refreshButton.appendChild(refreshButtonText);
        refreshButton.onclick = async () => {
            await this.showFriendsList(true);
        }
        let addButton = createElement("button", "skin-button", { innerHTML: '<i class="fa-solid fa-user-plus"></i>' + translate("app.friends.add_friend") });
        addButton.onclick = () => {
            let dialog = new Dialog();
            dialog.showDialog(translate("app.friends.add_friend.title"), "form", [
                {
                    "type": "text",
                    "name": translate("app.friends.add_friend.username"),
                    "id": "username"
                }
            ], [
                {
                    "type": "cancel",
                    "content": translate("app.friends.add_friend.cancel")
                },
                {
                    "type": "confirm",
                    "content": translate("app.friends.add_friend.confirm")
                }
            ], [], async (info) => {
                let action = await this.profile.runFriendAction("add", { name: info.username });
                if (action.status >= 400) {
                    if (action.details.status == "INVITE_REJECTED") {
                        displayError(translate("app.friends.error.add.invite_rejected"));
                    } else if (action.details.status == "NOT_ALLOWED") {
                        displayError(translate("app.friends.error.add.not_allowed"));
                    } else if (action.details.status == "ALREADY_FRIENDS") {
                        displayError(translate("app.friends.error.add.already_friends"));
                    } else if (action.details.status == "CANNOT_ADD_SELF") {
                        displayError(translate("app.friends.error.add.cannot_add_self"));
                    } else if (action.details.status == "UNKNOWN_PROFILE") {
                        displayError(translate("app.friends.error.add.unknown_profile"));
                    } else {
                        displayError(translate("app.friends.error.add"));
                    }
                    return;
                }
                this.friends[this.profile.uuid] = action;
                this.showFriendsList();
            });
        }
        skinButtonContainer.appendChild(refreshButton);
        skinButtonContainer.appendChild(addButton);
        let tabElement = document.createElement("div");
        this.subContentElement.appendChild(tabElement);
        this.friendsList = createElement("div", "friends-list");
        this.friendsGroup = createElement("div", "friends-group");
        this.friendsGroup.dataset.groupTitle = "";
        this.subContentElement.appendChild(this.friendsList);
        this.requestList = createElement("div", "friends-list");
        this.incomingRequestGroup = createElement("div", "friends-group disappearable");
        this.outgoingRequestGroup = createElement("div", "friends-group disappearable");
        this.incomingRequestGroup.dataset.groupTitle = translate("app.friends.incoming_requests");
        this.outgoingRequestGroup.dataset.groupTitle = translate("app.friends.outgoing_requests");
        this.friendsList.appendChild(this.friendsGroup);
        this.requestList.appendChild(this.incomingRequestGroup);
        this.requestList.appendChild(this.outgoingRequestGroup);
        this.notFoundElement = new NoResultsFound(translate("app.friends.no_requests")).element;
        this.tabs = new TabContent(tabElement, [
            {
                "name": translate("app.friends.friends"),
                "value": "friends",
                "func": () => {
                    this.requestList.remove();
                    this.subContentElement.appendChild(this.friendsList);
                }
            },
            {
                "name": translate("app.friends.requests"),
                "value": "requests",
                "func": () => {
                    this.friendsList.remove();
                    this.subContentElement.appendChild(this.requestList);
                }
            }
        ]);
        this.showFriendsList();
    }

    constructFriendElement(friend, buttons, presence) {
        let friendElement = createElement("div", "friend");
        let friendHead = createElement("img", "friend-head", { src: `https://mc-heads.net/avatar/${friend.profileId}/40` });
        friendHead.onerror = () => {
            friendHead.src = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAAXNSR0IArs4c6QAAANNJREFUKFNjNFYR/M/AwMDAw8YCouDgy68/DD9+/WFgVJHg+M/PwwmWgCkCSYLYIJpRW473f4GrDYOEmCgDCxcvw59vnxm+//zN8PHjB4aZh04yMM5O9vzPzy/AwMnOCjYFJAkDIEWMq4oi/4f2LmMItutiiDC9ANa5/ZYDw9pDZQyri6MQJoB0HTh3HazZwUgTTINNmBBp//8/63+GXccvMejJqoIlTt++yuDraMLw6etvBsYpCXb/337+zXDw1EUGdg42hp8/foFpCz1NBj5uVgYAzxRTZRWSVwUAAAAASUVORK5CYII=";
        }
        let friendInfo = createElement("div", "friend-info");
        let friendName = createElement("div", "friend-name", { textContent: friend.name });
        let friendStatus = createElement("div", "friend-status", { textContent: ""/*presence ? this.presences[presence.status].text : translate("app.friends.status.offline")*/ });
        if (presence && this.presences[presence.status].green) {
            friendStatus.classList.add("green");
        }
        let friendActions = createElement("button", "friend-actions", { innerHTML: '<i class="fa-solid fa-ellipsis-vertical"></i>' });
        friendInfo.appendChild(friendName);
        friendInfo.appendChild(friendStatus);
        friendElement.appendChild(friendHead);
        friendElement.appendChild(friendInfo);
        friendElement.appendChild(friendActions);
        friendElement.oncontextmenu = (e) => {
            contextmenu.showContextMenu(buttons, e.clientX, e.clientY);
        }
        new MoreMenu(friendActions, buttons);
        return friendElement;
    }

    async showFriendsList(force) {
        this.loading.element.remove();
        this.loading = new LoadingContainer();
        this.subContentElement.remove();
        this.contentElement.appendChild(this.loading.element);
        this.friendsGroup.innerHTML = "";
        this.incomingRequestGroup.innerHTML = "";
        this.outgoingRequestGroup.innerHTML = "";
        let friends;
        try {
            let refreshByTime = this.lastRefreshed[this.profile.uuid] && new Date() - this.lastRefreshed[this.profile.uuid] > 300000;
            let refreshFriends = force || !this.friends[this.profile.uuid] || refreshByTime;
            friends = (!refreshFriends) ? this.friends[this.profile.uuid] : await this.profile.getFriends();
        } catch (e) {
            this.loading.errorOut(translate("app.friends.unable_to_load"), () => {
                this.showFriendsList(true);
            });
            return;
        }
        if (friends.status >= 400) {
            this.loading.errorOut(translate("app.friends.unable_to_load.code", "%c", friends.status), () => {
                this.showFriendsList(true);
            });
            return;
        }
        this.lastRefreshed[this.profile.uuid] = new Date();
        this.friends[this.profile.uuid] = friends;
        for (let presence of friends?.presence?.presence || []) {
            friends.presence[presence.profileId.replaceAll("-", "")] = presence;
        }
        for (let friend of friends?.friends || []) {
            let buttons = new ContextMenuButtons([
                {
                    "title": translate("app.friends.unfriend"),
                    "icon": '<i class="fa-solid fa-user-slash"></i>',
                    "func": () => {
                        let dialog = new Dialog();
                        dialog.showDialog(translate("app.friends.unfriend.title"), "notice", translate("app.friends.unfriend.desc", "%f", friend.name), [
                            {
                                "content": translate("app.friends.unfriend.cancel"),
                                "type": "cancel"
                            },
                            {
                                "content": translate("app.friends.unfriend.confirm"),
                                "type": "confirm"
                            }
                        ], [], async () => {
                            let action = await this.profile.runFriendAction("remove", friend);
                            if (action.status >= 400) {
                                displayError(translate("app.friends.error.unfriend"));
                                return;
                            }
                            this.friends[this.profile.uuid] = action;
                            this.showFriendsList();
                        });
                    }
                }
            ]);
            let friendElement = this.constructFriendElement(friend, buttons, friends.presence ? friends.presence[friend.profileId] : null);
            this.friendsGroup.appendChild(friendElement);
        }
        if (!friends?.friends || friends.friends.length == 0) {
            let notFoundElement = new NoResultsFound(translate("app.friends.no_friends")).element;
            this.friendsGroup.appendChild(notFoundElement);
        }
        for (let friend of friends.incomingRequests) {
            let buttons = new ContextMenuButtons([
                {
                    "title": translate("app.friends.accept_request"),
                    "icon": '<i class="fa-solid fa-user-check"></i>',
                    "func": async () => {
                        let action = await this.profile.runFriendAction("add", friend);
                        if (action.status >= 400) {
                            if (action.details.status == "NOT_ALLOWED") {
                                displayError(translate("app.friends.error.accept.not_allowed"));
                            } else {
                                displayError(translate("app.friends.error.accept"));
                            }
                            return;
                        }
                        this.friends[this.profile.uuid] = action;
                        this.showFriendsList();
                    }
                },
                {
                    "title": translate("app.friends.decline_request"),
                    "icon": '<i class="fa-solid fa-user-xmark"></i>',
                    "func": async () => {
                        let action = await this.profile.runFriendAction("remove", friend);
                        if (action.status >= 400) {
                            displayError(translate("app.friends.error.decline"));
                            return;
                        }
                        this.friends[this.profile.uuid] = action;
                        this.showFriendsList();
                    }
                }
            ]);
            let friendElement = this.constructFriendElement(friend, buttons, friends.presence ? friends.presence[friend.profileId] : null);
            this.incomingRequestGroup.appendChild(friendElement);
        }
        this.tabs.setNotifications("requests", friends?.incomingRequests?.length || 0);
        for (let friend of friends.outgoingRequests) {
            let buttons = new ContextMenuButtons([
                {
                    "title": translate("app.friends.cancel_request"),
                    "icon": '<i class="fa-solid fa-ban"></i>',
                    "func": async () => {
                        let action = await this.profile.runFriendAction("remove", friend);
                        if (action.status >= 400) {
                            displayError(translate("app.friends.error.cancel"));
                            return;
                        }
                        this.friends[this.profile.uuid] = action;
                        this.showFriendsList();
                    }
                }
            ]);
            let friendElement = this.constructFriendElement(friend, buttons, friends.presence ? friends.presence[friend.profileId] : null);
            this.outgoingRequestGroup.appendChild(friendElement);
        }
        this.notFoundElement.remove();
        if ((!friends?.incomingRequests || friends.incomingRequests.length == 0) && (!friends?.outgoingRequests || friends.outgoingRequests.length == 0)) {
            this.requestList.appendChild(this.notFoundElement);
        }
        this.loading.element.remove();
        this.contentElement.appendChild(this.subContentElement);
    }
}

let contextmenu = new ContextMenu();
let homeScreen = new HomeScreen();
let homeButton = new NavigationButton(document.getElementById("homeButtonEle"), translate("app.page.home"), '<i class="fa-solid fa-house"></i>', homeScreen);
homeScreen.setNavButton(homeButton);
let instancesScreen = new InstancesScreen();
let instancesButton = new NavigationButton(document.getElementById("instanceButtonEle"), translate("app.page.instances"), '<i class="fa-solid fa-book"></i>', instancesScreen);
instancesScreen.setNavButton(instancesButton);
let discoverScreen = new DiscoverScreen();
let discoverButton = new NavigationButton(document.getElementById("discoverButtonEle"), translate("app.page.discover"), '<i class="fa-solid fa-compass"></i>', discoverScreen);
discoverScreen.setNavButton(discoverButton);
let wardrobeScreen = new WardrobeScreen();
let wardrobeButton = new NavigationButton(document.getElementById("wardrobeButtonEle"), translate("app.page.wardrobe"), '<i class="fa-solid fa-shirt"></i>', wardrobeScreen);
wardrobeScreen.setNavButton(wardrobeButton);
let friendsScreen = new FriendsScreen();
let friendsButton = new NavigationButton(document.getElementById("friendsButtonEle"), translate("app.page.friends"), '<i class="fa-solid fa-user"></i>', friendsScreen);
friendsScreen.setNavButton(friendsButton);
new NavigationButton(settingsButtonEle, translate("app.settings"), '<i class="fa-solid fa-gear"></i>');

settingsButtonEle.onclick = async () => {
    let values = await window.enderlynx.getDefaultOptions();
    let def_opts = createElement("div", "option-list");
    let generateUIForOptions = async (values) => {
        def_opts.innerHTML = "";
        for (let i = 0; i < values.length; i++) {
            let e = values[i];
            let item = createElement("div", "option-item");
            values[i].element = item;

            let titleElement = createElement("div", "option-title");
            titleElement.innerHTML = e.key;
            item.appendChild(titleElement);

            let onChange = async (v) => {
                values[i].value = (type == "text" ? '"' + v + '"' : v);
                if (await DefaultOptions.getDefault(e.key) == (type == "text" ? '"' + v + '"' : v)) {
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
            item.dataset.type = type;
            if (type == "text") {
                inputElement = createElement("input", "option-input");
                inputElement.value = e.value.slice(1, -1);
                inputElement.onchange = () => {
                    DefaultOptions.setDefault(e.key, '"' + inputElement.value + '"');
                    displaySuccess(translate("app.options.updated_default"));
                    values[i].value = '"' + inputElement.value + '"';
                    onChange(inputElement.value);
                }
                item.appendChild(inputElement);
            } else if (type == "number") {
                inputElement = createElement("input", "option-input");
                inputElement.value = e.value;
                inputElement.type = "number";
                inputElement.onchange = () => {
                    DefaultOptions.setDefault(e.key, inputElement.value);
                    displaySuccess(translate("app.options.updated_default"));
                    values[i].value = inputElement.value;
                    onChange(inputElement.value);
                }
                item.appendChild(inputElement);
            } else if (type == "boolean") {
                let inputElement1 = createElement("div", "option-input");
                inputElement = new Dropdown("", [{ "name": translate("app.options.true"), "value": "true" }, { "name": translate("app.options.false"), "value": "false" }], inputElement1, e.value, (v) => {
                    DefaultOptions.setDefault(e.key, v);
                    displaySuccess(translate("app.options.updated_default"));
                    values[i].value = v;
                    onChange(v);
                });
                item.appendChild(inputElement1);
            } else if (type == "unknown") {
                inputElement = createElement("input", "option-input");
                inputElement.value = e.value;
                inputElement.onchange = () => {
                    DefaultOptions.setDefault(e.key, inputElement.value);
                    displaySuccess(translate("app.options.updated_default"));
                    values[i].value = inputElement.value;
                    onChange(inputElement.value);
                }
                item.appendChild(inputElement);
            } else if (type == "key") {
                inputElement = createElement("button", "option-key-input");
                inputElement.value = e.value;
                inputElement.dataset.key = e.key;
                inputElement.innerHTML = (await window.enderlynx.convertKeyInfo("key_code", "text", e.value)) || e.value;
                inputElement.onclick = () => {
                    OptionsKeyManagement.keyButtonClick(inputElement, (keyCode, oldInnerHTML, oldValue, oldElement) => {
                        DefaultOptions.setDefault(e.key, keyCode);
                        displaySuccess(translate("app.options.updated_default"));
                        onChange(keyCode);
                    });
                }
                item.appendChild(inputElement);
            }

            let setDefaultButton = createElement("button", "option-button");
            setDefaultButton.innerHTML = '<i class="fa-solid fa-plus"></i>' + translate("app.options.default.set");

            let onSet = () => {
                DefaultOptions.setDefault(e.key, type == "text" ? '"' + inputElement.value + '"' : inputElement.value);
                setDefaultButton.innerHTML = '<i class="fa-solid fa-minus"></i>' + translate("app.options.default.remove");
                setDefaultButton.onclick = onRemove;
                displaySuccess(translate("app.options.default.set.success", "%k", e.key, "%v", inputElement.value));
            }

            setDefaultButton.onclick = onSet;

            let onRemove = () => {
                DefaultOptions.deleteDefault(e.key);
                setDefaultButton.innerHTML = '<i class="fa-solid fa-plus"></i>' + translate("app.options.default.set");
                setDefaultButton.onclick = onSet;
                displaySuccess(translate("app.options.default.remove.success", "%k", e.key));
            }

            if (await DefaultOptions.getDefault(e.key) == e.value) {
                setDefaultButton.innerHTML = '<i class="fa-solid fa-minus"></i>' + translate("app.options.default.remove");
                setDefaultButton.onclick = onRemove;
            }

            item.appendChild(setDefaultButton);

            def_opts.appendChild(item);
        };
    }
    generateUIForOptions(values);

    let def_opts_buttons = createElement("div", "def_opts_actions");

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
                "type": "file-upload",
                "id": "files",
                "name": translate("app.settings.def_opts.import.location"),
                "files_allowed": true,
                "folders_allowed": false,
                "file_types_allowed": ["txt"],
                "file_types_name": translate("app.settings.def_opts.import.location.types"),
                "max_amount_allowed": 1
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
        ], [], async (info) => {
            let options = await window.enderlynx.getOptions(info.files[0].path);
            await window.enderlynx.deleteDefaultOptions();
            for (let i = 0; i < options.length; i++) {
                let e = options[i];
                if (e.key == "version") return;
                await DefaultOptions.setDefault(e.key, e.value);
            }
            generateUIForOptions(options);
        })
    }
    importButton.className = "bug-button";
    def_opts_buttons.appendChild(importButton);

    let exportButton = createElement("button", "bug-button");
    exportButton.innerHTML = '<i class="fa-solid fa-file-export"></i> ' + translate("app.settings.def_opts.export");
    exportButton.onclick = async () => {
        let file_location = await window.enderlynx.generateOptionsTXT(values);
        openShareDialogForFile(file_location);
    }
    def_opts_buttons.appendChild(exportButton);

    let addButton = createElement("button", "bug-button");
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
        ], [], async (info) => {
            if (info.key != "version") {
                await DefaultOptions.setDefault(info.key, info.value);
            }
            generateUIForOptions(await window.enderlynx.getDefaultOptions());
        })
    }
    def_opts_buttons.appendChild(addButton);

    let applyDefaults = createElement("button", "bug-button");
    applyDefaults.innerHTML = '<i class="fa-regular fa-file-lines"></i> ' + translate("app.settings.options.apply");
    applyDefaults.onclick = () => {
        let dialog = new Dialog();
        dialog.showDialog(translate("app.settings.options.apply.title"), "notice", translate("app.settings.options.apply.description"), [
            {
                "type": "cancel",
                "content": translate("app.settings.options.apply.cancel")
            },
            {
                "type": "confirm",
                "content": translate("app.settings.options.apply.confirm")
            }
        ], [], async () => {
            let instances = await getInstances();
            for (let i = 0; i < instances.length; i++) {
                let instanceInfo = instances[i];
                try {
                    await window.enderlynx.setOptionsTXT(instanceInfo.instance_id, false, true);
                } catch (e) {
                    displayError(translate("app.settings.options.apply.fail", "%i", instanceInfo.name));
                }
            }
            displaySuccess(translate("app.settings.options.apply.done"));
        })
    }
    def_opts_buttons.appendChild(applyDefaults);

    let dialog = new Dialog();
    let java_installations = [{
        "type": "notice",
        "tab": "java",
        "content": translate("app.settings.java.description." + window.enderlynx.ostype())
    }];
    let java_stuff = await window.enderlynx.getJavaInstallations();
    java_stuff.sort((a, b) => b.version - a.version);
    java_stuff.forEach(e => {
        java_installations.push({
            "type": "text",
            "name": translate("app.settings.java.location").replace("%v", e.version),
            "id": "java_" + e.version,
            "default": e.file_path,
            "tab": "java",
            "buttons": [
                {
                    "name": translate("app.settings.java.detect"),
                    "icon": '<i class="fa-solid fa-magnifying-glass"></i>',
                    "func": async (value, button, setter) => {
                        button.innerHTML = '<i class="spinner"></i>' + translate("app.settings.java.detect.searching");
                        let dialog = new Dialog();
                        let results = await window.enderlynx.detectJavaInstallations(e.version);
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
                        ], [], (info) => {
                            setter(info.java_path);
                        });
                        button.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i>' + translate("app.settings.java.detect");
                    }
                },
                {
                    "name": translate("app.settings.java.browse"),
                    "icon": '<i class="fa-solid fa-folder"></i>',
                    "func": async (value, button, setter) => {
                        let os = window.enderlynx.osplatform();
                        let files = await window.enderlynx.triggerBrowse(value, "file", os == 'win32' ? ["exe"] : [], os == 'win32' ? translate("app.import.select.executables") : "", translate("app.import.select.java_executable"), false);
                        if (files[0]?.path) setter(files[0].path);
                    }
                },
                {
                    "name": translate("app.settings.java.test"),
                    "icon": '<i class="fa-solid fa-play"></i>',
                    "func": async (value, button, setter) => {
                        let num = Math.floor(Math.random() * 10000);
                        button.dataset.num = num;
                        button.classList.remove("failed");
                        button.innerHTML = '<i class="spinner"></i>' + translate("app.settings.java.test.testing");
                        let success = await window.enderlynx.testJavaInstallation(value);
                        if (success) {
                            button.innerHTML = '<i class="fa-solid fa-check"></i>' + translate("app.settings.java.test.success");
                        } else {
                            button.innerHTML = '<i class="fa-solid fa-xmark"></i>' + translate("app.settings.java.test.fail");
                            button.classList.add("failed");
                        }
                        setTimeout(() => {
                            if (button.dataset.num == num) {
                                button.innerHTML = '<i class="fa-solid fa-play"></i>' + translate("app.settings.java.test");
                                button.classList.remove("failed");
                            }
                        }, 3000);
                    }
                },
                {
                    "name": translate("app.settings.java.update"),
                    "icon": '<i class="fa-solid fa-download"></i>',
                    "func": async (value, button, setter) => {
                        button.innerHTML = '<i class="spinner"></i>' + translate("app.settings.java.update.updating");
                        button.onclick = () => { }
                        let file_path = await window.enderlynx.downloadLatestJava(e.version);
                        if (file_path) {
                            button.innerHTML = '<i class="fa-solid fa-check"></i>' + translate("app.settings.java.update.success");
                            if (typeof file_path == 'boolean') {
                                displaySuccess(translate("app.settings.java.update.latest_installed"));
                                return;
                            }
                            setter(file_path);
                        } else {
                            button.innerHTML = '<i class="fa-solid fa-xmark"></i>' + translate("app.settings.java.update.fail");
                            button.classList.add("failed");
                        }
                    }
                }
            ]
        });
    });
    let app_info = createElement("div");
    app_info.style.display = "flex";
    app_info.style.flexDirection = "column";
    app_info.style.gap = "4px";
    let ips = window.enderlynx.localIPs();
    let info_to_show = [{
        "name": translate("app.settings.info.enderlynx"),
        "value": window.enderlynx.version,
        "chips": true
    }, {
        "name": translate("app.settings.info.electron"),
        "value": window.enderlynx.electronversion,
        "chips": true
    }, {
        "name": translate("app.settings.info.os.platform"),
        "value": window.enderlynx.osplatform(),
        "chips": true
    }, {
        "name": translate("app.settings.info.os.arch"),
        "value": window.enderlynx.osarch(),
        "chips": true
    }, {
        "name": translate("app.settings.info.os.release"),
        "value": window.enderlynx.osrelease(),
        "chips": true
    }, {
        "name": translate("app.settings.info.os.version"),
        "value": window.enderlynx.osversion(),
        "chips": true
    }, {
        "name": translate("app.settings.info.node"),
        "value": window.enderlynx.nodeversion,
        "chips": true
    }, {
        "name": translate("app.settings.info.chromium"),
        "value": window.enderlynx.chromeversion,
        "chips": true
    }, {
        "name": translate("app.settings.info.v8"),
        "value": window.enderlynx.v8version,
        "chips": true
    }, {
        "name": translate("app.settings.info.local_ip_address.ipv4"),
        "value": ips.IPv4,
        "chips": true
    }, {
        "name": translate("app.settings.info.local_ip_address.ipv6"),
        "value": ips.IPv6,
        "chips": true
    }]
    for (let i = 0; i < info_to_show.length; i++) {
        let e = info_to_show[i];
        let element = createElement("span");
        if (e.chips && !e.update) {
            let chipWrapper = createElement("div", "settings-chip-wrapper");
            let titleElement = createElement("span", "settings-chip-title");
            titleElement.innerHTML = e.name + ": ";
            chipWrapper.appendChild(titleElement);
            if (typeof e.value == 'string') e.value = [e.value];
            for (let j = 0; j < e.value.length; j++) {
                let chip = createElement("div", "settings-chip");
                let text = createElement("div", undefined, { innerHTML: e.value[j] });
                let copyButton = createElement("button", "settings-chip-copy", { innerHTML: '<i class="fa-solid fa-copy"></i>', title: translate("app.settings.info.copy_to_clipboard") });
                copyButton.onclick = async () => {
                    let success = await window.enderlynx.copyToClipboard(e.value[j]);
                    if (success) {
                        displaySuccess(translate("app.settings.info.copy.success"));
                    } else {
                        displayError(translate("app.settings.info.copy.fail"));
                    }
                    copyButton.innerHTML = '<i class="fa-solid fa-check"></i>';
                    setTimeout(() => {
                        copyButton.innerHTML = '<i class="fa-solid fa-copy"></i>';
                    }, 2000);
                }
                chip.appendChild(text);
                chip.appendChild(copyButton);
                chipWrapper.appendChild(chip);
            }
            element.appendChild(chipWrapper);
        } else if (!e.update) {
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
    let bugButton = createElement("button", "bug-button");
    bugButton.innerHTML = '<i class="fa-solid fa-bug"></i> ' + translate("app.settings.info.bug");
    bugButton.onclick = () => {
        window.enderlynx.openInBrowser("https://github.com/Illusioner2520/EnderLynx/issues/new?template=1-bug_report.yml&version=" + window.enderlynx.version);
    }
    app_info.appendChild(bugButton);
    let featureButton = createElement("button", "bug-button");
    featureButton.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> ' + translate("app.settings.info.feature");
    featureButton.onclick = () => {
        window.enderlynx.openInBrowser("https://github.com/Illusioner2520/EnderLynx/issues/new?template=2-feature_request.yml");
    }
    app_info.appendChild(featureButton);
    let updatesButton = createElement("button", "bug-button");
    updatesButton.innerHTML = '<i class="fa-solid fa-arrows-rotate"></i> ' + translate("app.settings.info.update");
    let updateButtonClick = async () => {
        updatesButton.onclick = () => { }
        updatesButton.children[0].classList.add("spinning");
        await checkForUpdates(true);
        updatesButton.children[0].classList.remove("spinning");
        updatesButton.onclick = updateButtonClick;
    }
    updatesButton.onclick = updateButtonClick;
    app_info.appendChild(updatesButton);
    let clearCacheButton = createElement("button", "bug-button");
    clearCacheButton.innerHTML = '<i class="fa-solid fa-trash-can"></i> ' + translate("app.settings.clear_cache");
    clearCacheButton.onclick = async () => {
        let success = await window.enderlynx.clearNetworkCache();
        if (success) {
            displaySuccess(translate("app.settings.clear_cache.success"))
        } else {
            displayError(translate("app.settings.clear_cache.fail"))
        }
    }
    app_info.appendChild(clearCacheButton);
    dialog.showDialog(translate("app.settings"), "form", [
        {
            "type": "multi-select",
            "name": translate("app.settings.theme"),
            "tab": "appearance",
            "id": "default_mode",
            "options": [
                { "name": translate("app.settings.theme.dark"), "value": "dark" },
                { "name": translate("app.settings.theme.light"), "value": "light" }
            ],
            "default": await getDefault("default_mode"),
            "onchange": (v) => {
                if (v == "light") {
                    document.body.classList.add("light");
                } else {
                    document.body.classList.remove("light");
                }
                updateWindowButtonColors();
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
            "default": await getDefault("default_accent_color"),
            "onchange": (v) => {
                accent_colors.forEach(e => {
                    document.body.classList.remove(e);
                });
                document.body.classList.add(v);
                updateWindowButtonColors();
            }
        },
        {
            "type": "multi-select",
            "name": translate("app.settings.sidebar"),
            "tab": "appearance",
            "id": "default_sidebar",
            "options": [
                { "name": translate("app.settings.sidebar.spacious"), "value": "spacious" },
                { "name": translate("app.settings.sidebar.compact"), "value": "compact" }
            ],
            "default": await getDefault("default_sidebar"),
            "onchange": (v) => {
                if (v == "compact") {
                    document.body.classList.add("compact");
                } else if (window.innerWidth >= 1000) {
                    document.body.classList.remove("compact");
                }
            }
        },
        {
            "type": "multi-select",
            "name": translate("app.settings.sidebar.side"),
            "tab": "appearance",
            "id": "default_sidebar_side",
            "options": [
                { "name": translate("app.settings.sidebar.left"), "value": "left" },
                { "name": translate("app.settings.sidebar.right"), "value": "right" }
            ],
            "default": await getDefault("default_sidebar_side"),
            "onchange": (v) => {
                if (v == "right") {
                    document.body.classList.add("sidebar-right");
                } else {
                    document.body.classList.remove("sidebar-right");
                }
            }
        },
        {
            "type": "multi-select",
            "name": translate("app.settings.page"),
            "desc": translate("app.settings.page.description"),
            "tab": "appearance",
            "id": "default_page",
            "options": [
                { "name": translate("app.settings.page.home"), "value": "home" },
                { "name": translate("app.settings.page.instances"), "value": "instances" },
                { "name": translate("app.settings.page.discover"), "value": "discover" },
                { "name": translate("app.settings.page.wardrobe"), "value": "wardrobe" },
                { "name": translate("app.settings.page.friends"), "value": "friends" }
            ],
            "default": await getDefault("default_page")
        },
        {
            "type": "toggle",
            "name": translate("app.settings.thin_scrollbars"),
            "tab": "appearance",
            "id": "thin_scrollbars",
            "default": await getDefault("thin_scrollbars") == "true",
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
            "default": await getDefault("discord_rpc") == "true"
        },
        {
            "type": "toggle",
            "name": translate("app.settings.potato_pc"),
            "tab": "appearance",
            "id": "potato_mode",
            "desc": translate("app.settings.potato_pc.description"),
            "default": await getDefault("potato_mode") == "true"
        },
        {
            "type": "toggle",
            "name": translate("app.settings.hide_ips"),
            "tab": "appearance",
            "id": "hide_ip",
            "desc": translate("app.settings.hide_ips.description"),
            "default": await getDefault("hide_ip") == "true"
        },
        {
            "type": "toggle",
            "name": translate("app.settings.modrinth_link"),
            "tab": "appearance",
            "id": "modrinth_link",
            "desc": translate("app.settings.modrinth_link.description"),
            "default": await getDefault("link_with_modrinth") == "true"
        },
        {
            "type": "toggle",
            "name": translate("app.settings.auto_apply_resource_packs"),
            "tab": "appearance",
            "id": "auto_apply_resource_packs",
            "desc": translate("app.settings.auto_apply_resource_packs.description"),
            "default": await getDefault("auto_apply_resource_packs") == "true"
        },
        {
            "type": "slider",
            "name": translate("app.settings.resources.downloads"),
            "desc": translate("app.settings.resources.downloads.description"),
            "tab": "resources",
            "id": "max_concurrent_downloads",
            "default": Number(await getDefault("max_concurrent_downloads")),
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
            "default": window.enderlynx.userPath,
            "buttons": [
                {
                    "name": translate("app.settings.folder_location.browse"),
                    "icon": '<i class="fa-solid fa-folder"></i>',
                    "func": async (value, button, setter) => {
                        let newValue = await window.enderlynx.triggerBrowse(value, "folder", [], "", translate("app.settings.folder_location.select"), false);
                        if (newValue[0]?.path) setter(newValue[0].path);
                    }
                }
            ]
        },
        {
            "type": "slider",
            "name": translate("app.settings.defaults.ram"),
            "desc": translate("app.settings.defaults.ram.description"),
            "tab": "defaults",
            "id": "default_ram",
            "default": Number(await getDefault("default_ram")),
            "min": 512,
            "max": window.enderlynx.getTotalRAM(),
            "increment": 64,
            "unit": translate("app.settings.defaults.ram.unit")
        },
        {
            "type": "number",
            "name": translate("app.settings.defaults.width"),
            "desc": translate("app.settings.defaults.width.description"),
            "tab": "defaults",
            "id": "default_width",
            "default": Number(await getDefault("default_width"))
        },
        {
            "type": "number",
            "name": translate("app.settings.defaults.height"),
            "desc": translate("app.settings.defaults.height.description"),
            "tab": "defaults",
            "id": "default_height",
            "default": Number(await getDefault("default_height"))
        },
        {
            "type": "toggle",
            "name": translate("app.settings.defaults.fullscreen"),
            "desc": translate("app.settings.defaults.fullscreen.description"),
            "tab": "defaults",
            "id": "default_fullscreen",
            "default": await getDefault("default_fullscreen") == "true"
        },
        {
            "type": "text",
            "name": translate("app.settings.globals.custom_env_vars"),
            "tab": "globals",
            "id": "global_env_vars",
            "default": await getDefault("global_env_vars")
        },
        {
            "type": "text",
            "name": translate("app.settings.globals.pre_launch_hook"),
            "tab": "globals",
            "id": "global_pre_launch_hook",
            "default": await getDefault("global_pre_launch_hook")
        },
        {
            "type": "text",
            "name": translate("app.settings.globals.post_launch_hook"),
            "tab": "globals",
            "id": "global_post_launch_hook",
            "default": await getDefault("global_post_launch_hook")
        },
        {
            "type": "text",
            "name": translate("app.settings.globals.wrapper"),
            "tab": "globals",
            "id": "global_wrapper",
            "default": await getDefault("global_wrapper")
        },
        {
            "type": "text",
            "name": translate("app.settings.globals.post_exit_hook"),
            "tab": "globals",
            "id": "global_post_exit_hook",
            "default": await getDefault("global_post_exit_hook")
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
    ], async (info) => {
        await setDefault("default_width", info.default_width);
        await setDefault("default_height", info.default_height);
        await setDefault("default_fullscreen", (info.default_fullscreen).toString());
        await setDefault("default_ram", info.default_ram);
        await setDefault("max_concurrent_downloads", info.max_concurrent_downloads);
        await setDefault("default_page", info.default_page);
        await setDefault("discord_rpc", (info.discord_rpc).toString());
        await setDefault("potato_mode", (info.potato_mode).toString());
        await setDefault("hide_ip", (info.hide_ip).toString());
        await setDefault("link_with_modrinth", (info.modrinth_link).toString());
        await setDefault("auto_apply_resource_packs", (info.auto_apply_resource_packs).toString());
        await setDefault("global_pre_launch_hook", info.global_pre_launch_hook);
        await setDefault("global_post_launch_hook", info.global_post_launch_hook);
        await setDefault("global_wrapper", info.global_wrapper);
        await setDefault("global_post_exit_hook", info.global_post_exit_hook);
        await setDefault("global_env_vars", info.global_env_vars);
        await setDefault("default_mode", info.default_mode);
        await setDefault("default_accent_color", info.default_accent_color);
        await setDefault("default_sidebar", info.default_sidebar);
        await setDefault("default_sidebar_side", info.default_sidebar_side);
        await setDefault("thin_scrollbars", (info.thin_scrollbars).toString());
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
        updateWindowButtonColors();
        updateSidebarSize();
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
            window.enderlynx.clearActivity();
        }
        Object.entries(info).forEach(e => {
            if (e[0].startsWith("java_")) {
                let version = e[0].replace("java_", "");
                window.enderlynx.setJavaInstallation(version, e[1]);
            }
        });
        window.enderlynx.changeFolder(window.enderlynx.userPath, info.folder_location);
    }, async () => {
        let color_theme = await getDefault("default_mode");
        let accent_color = await getDefault("default_accent_color");
        let sidebar_mode = await getDefault("default_sidebar");
        let sidebar_side = await getDefault("default_sidebar_side");
        let thin_scrollbars = await getDefault("thin_scrollbars");
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
        updateWindowButtonColors();
        updateSidebarSize();
        if (sidebar_side == "right") {
            document.body.classList.add("sidebar-right");
        } else {
            document.body.classList.remove("sidebar-right");
        }
    }, undefined, false, true);
}

let navButtons = [homeButton, instancesButton, discoverButton, wardrobeButton, friendsButton];

async function toggleMicrosoftSignIn() {
    try {
        let player = await window.enderlynx.triggerMicrosoftLogin();
        accountSwitcher.selectPlayer(await getProfileFromUUID(player.uuid));
        accountSwitcher.reloadHeads();
    } catch (e) {
        if (e.message.includes("error.gui.closed")) return;
        displayError(translate("app.login_error"));
    }
}

let dont_override_my_page = false;

async function applyDefaults() {
    if (await getDefault("default_mode") == "light") {
        document.body.classList.add("light");
    }
    document.body.classList.add(await getDefault("default_accent_color"));
    updateWindowButtonColors();
    updateSidebarSize();
    if (await getDefault("default_sidebar_side") == "right") {
        document.body.classList.add("sidebar-right");
    }
    if (await getDefault("potato_mode") == "true") {
        document.body.classList.add("potato");
    }
    if (await getDefault("thin_scrollbars") == "true") {
        document.body.classList.add("thin-scrollbars");
    }
    if (await getDefault("hide_ip") == "true") {
        document.body.classList.add("hide_ip");
    }
    if (new Date().getMonth() == 3 && new Date().getDate() == 1) {
        document.body.classList.add("april_fools");
    }
    let defaultpage = await getDefault("default_page");
    if (dont_override_my_page) return;
    setPage(defaultpage);
}

window.enderlynx.onPage((page) => setPage(page));

function setPage(page) {
    if (page == "home") {
        homeScreen.display();
    } else if (page == "instances") {
        instancesScreen.display();
    } else if (page == "discover") {
        discoverScreen.display();
    } else if (page == "wardrobe") {
        wardrobeScreen.display();
    } else if (page == "friends") {
        friendsScreen.display();
    }
    live.findLive();
}

applyDefaults();

let first = new Map();
let first2 = new Map();
let last = new Map();
let last2 = new Map();

function animateGridReorderStart(querySelector, pseudoElements) {
    const cards = [...document.querySelectorAll(querySelector)];
    const cards2 = [...document.querySelectorAll(pseudoElements)];

    first.clear();
    first2.clear();
    cards.forEach(card => {
        first.set(card.dataset.id, card.getBoundingClientRect());
    });
    cards2.forEach(card => {
        first2.set(card.dataset.id, card.getBoundingClientRect());
    });
}

function animateGridReorderEnd(querySelector, pseudoElements) {
    const cards = [...document.querySelectorAll(querySelector)];
    const cards2 = [...document.querySelectorAll(pseudoElements)];
    last.clear();
    last2.clear();
    cards.forEach(card => {
        last.set(card.dataset.id, card.getBoundingClientRect());
    });
    cards2.forEach(card => {
        last2.set(card.dataset.id, card.getBoundingClientRect());
    })

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

    cards2.forEach(card => {
        const f = first2.get(card.dataset.id);
        const l = last2.get(card.dataset.id);
        if (!f || !l) return;

        const dx = f.left - l.left;
        const dy = f.top - l.top;

        if (dx || dy) {
            card.style.setProperty("--pseudo-transform", `translate(${dx}px, ${dy}px)`);
            card.style.setProperty("--pseudo-transition", "none");

            requestAnimationFrame(() => {
                card.style.setProperty("--pseudo-transform", ``);
                card.style.setProperty("--pseudo-transition", "");
            });
        }
    });
    first.clear();
    first2.clear();
    last.clear();
    last2.clear();
}

class SkinEntry {
    constructor(e, allowEditing, skinViewer, default_profile, showContent, filterSkins) {
        this.skin = e;
        this.name = allowEditing ? e.name : translate(e.name);
        let skinEle = document.createElement("div");
        let equipSkin = async () => {
            loader.style.display = "block";
            skinImg.style.display = "none";
            let currentEle = skinEle;
            let success = e.texture_key ? (await applySkinFromURL(default_profile.id, e)) : (await applySkin(default_profile.id, e));
            if (success) {
                let oldEle = document.querySelector(".my-account-option.skin.selected");
                if (oldEle) oldEle.classList.remove("selected");
                currentEle.classList.add("selected");
                await e.setActive(default_profile.uuid);
                if (skinViewer) skinViewer.loadSkin(e.skin_url, {
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
                    ], [], async (info) => {
                        await e.setName(info.name);
                        if (!info.name) await e.setName(translate("app.wardrobe.unnamed"));
                        let needsToBeReequipped = false;
                        if (e.model != info.model) needsToBeReequipped = true;
                        await e.setModel(info.model);
                        if (needsToBeReequipped && e.active_uuid.includes(";" + default_profile.uuid + ";")) {
                            await equipSkin();
                        }
                        showContent(true);
                    });
                }
            } : null,
            skinViewer ? {
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
                    if (document.body.matches(".potato")) {
                        skinViewer.animation.paused = true;
                        pauseButton.innerHTML = '<i class="fa-solid fa-play"></i>'
                        pauseButton.onclick = onResume;
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
            } : null,
            allowEditing ? {
                "title": translate("app.wardrobe.skin.delete"),
                "icon": '<i class="fa-solid fa-trash-can"></i>',
                "danger": true,
                "func": async (a, b) => {
                    if (await e.isActive()) {
                        displayError(translate("app.wardrobe.skin.delete.in_use"));
                        return;
                    }
                    let dialog = new Dialog();
                    dialog.showDialog(translate("app.wardrobe.delete.confirm.title"), "notice", translate("app.wardrobe.delete.confirm.description", "%s", e.name), [
                        {
                            "type": "cancel",
                            "content": translate("app.wardrobe.delete.cancel")
                        },
                        {
                            "type": "confirm",
                            "content": translate("app.wardrobe.delete.confirm")
                        }
                    ], [], async () => {
                        if (b) b.remove();
                        await e.delete();
                        showContent();
                        displaySuccess(translate("app.wardrobe.delete.success", "%s", e.name));
                    });
                }
            } : null
        ].filter(e => e));
        skinEle.oncontextmenu = (e) => {
            contextmenu.showContextMenu(buttons, e.clientX, e.clientY);
        }
        skinEle.className = "my-account-option";
        if (!allowEditing) skinEle.classList.add("default-skin");
        skinEle.classList.add("skin");
        skinEle.title = allowEditing ? e.name : translate(e.name);
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
        skinFavorite.onclick = async (ev) => {
            ev.stopPropagation();
            await e.setFavorited(!e.favorited);
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
        skinName.textContent = this.name;
        skinName.className = "skin-name";
        if (e.name.toLowerCase() == "dinnerbone" || e.name.toLowerCase() == "grumm" || e.name.toLowerCase() == "dinnerbone's skin" || e.name.toLowerCase() == "grumm's skin") {
            skinImg.classList.add("dinnerbone");
        }
        this.element = skinEle;
        if (e.active_uuid.includes(";" + default_profile.uuid + ";")) {
            skinEle.classList.add("selected");
        }
        makeArtificialButton(skinEle, () => {
            equipSkin();
        }, [".skin-more", "i"]);
    }
}

async function importSkin(info) {
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
        return await new Promise((resolve) => {
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
                await addSkin(info.name ? info.name : info.selected_tab == "username" ? translate("app.wardrobe.username_import.default_name", "%u", info.username) : translate("app.wardrobe.unnamed"), model, "", await window.enderlynx.importSkin(info.skin), info.skin, true, null);
                resolve();
            };
            tempImg.src = info.skin;
        });
    }
    await addSkin(info.name ? info.name : info.selected_tab == "username" ? translate("app.wardrobe.username_import.default_name", "%u", info.username) : translate("app.wardrobe.unnamed"), model, "", await window.enderlynx.importSkin(info.skin), info.skin, true, null);
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

let loaders = {
    "vanilla": translate("app.loader.vanilla"),
    "fabric": translate("app.loader.fabric"),
    "forge": translate("app.loader.forge"),
    "neoforge": translate("app.loader.neoforge"),
    "quilt": translate("app.loader.quilt"),
    "": translate("app.loader.unknown")
}

async function showCreateInstanceDialog() {
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
            "default": await VersionList.getLatestRelease()
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
            "type": "file-upload",
            "id": "files",
            "name": translate("app.instances.file"),
            "desc": translate("app.instances.file.description"),
            "files_allowed": true,
            "folders_allowed": false,
            "file_types_allowed": ["elpack", "mrpack", "zip"],
            "file_types_name": translate("app.instances.file.types"),
            "max_amount_allowed": 1,
            "tab": "file"
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
            "name": translate("app.instances.tab.code"),
            "value": "code"
        }
    ], async (info) => {
        if (info.selected_tab == "custom") {
            if (info.game_version == "loading") {
                displayError(translate("app.instances.no_game_version"));
                return;
            }
            if (!info.name) {
                info.name = translate("app.instances.untitled");
            }
            let instance_id = await window.enderlynx.getInstanceFolderName(info.name);
            let instance = await addInstance(info.name, new Date(), new Date(), "", info.loader, info.game_version, "", false, false, 0, info.icon, instance_id, 0, "custom", "", false, false);
            instance.display();
            await window.enderlynx.installMinecraft(instance_id, info.loader, info.game_version);
        } else if (info.selected_tab == "file") {
            let pack_info = await window.enderlynx.readPackFile(info.files[0].path);
            let instance_id = await window.enderlynx.getInstanceFolderName(info.name_f || pack_info.name);
            let instance = await addInstance(info.name_f || pack_info.name, new Date(), new Date(), "", pack_info.loader, pack_info.game_version, pack_info.loader_version, false, true, "", info.icon_f || pack_info.image, instance_id, 0, "", "", true, false);
            instance.display();
            try {
                await window.enderlynx.installModpack(info.files[0].path, "file", instance_id, info.name_f || pack_info.name, null);
            } catch (e) {
                await instance.setFailed(true);
                await instance.setInstalling(false);
                return;
            }
        } else if (info.selected_tab == "code") {
            let instance_id = await window.enderlynx.getInstanceFolderName(info.profile_code);
            let instance = await addInstance(info.name_c, new Date(), new Date(), "", "", "", "", false, true, 0, info.icon_c, instance_id, 0, "", "", true, false);
            instance.display();
            try {
                await window.enderlynx.installModpack(`https://api.curseforge.com/v1/shared-profile/${info.profile_code}`, "cf_url", instance_id, info.name_c, null);
            } catch (e) {
                displayError(translate("app.cf.code.error"));
                await instance.delete();
                instancesScreen.display();
                return;
            }
        }
    }, () => { }, undefined, true);
}

class Display {
    static currentScreen;
    static pageLog = [];
    static pageIndex = -1;

    static pageForward() {
        if (!this.pageLog[this.pageIndex + 1]) return;
        this.pageIndex++;
        this.pageLog[this.pageIndex]();
    }

    static pageBackward() {
        if (!this.pageLog[this.pageIndex - 1]) return;
        this.pageIndex--;
        this.pageLog[this.pageIndex]();
    }
}

function displayScreenshot(name, desc, file, file_name, instanceInfo, list, currentIndex, word = translate("app.screenshot")) {
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
            window.enderlynx.openFolder(file);
        };
        screenshotAction3.onclick = async () => {
            let success = await window.enderlynx.copyImageToClipboard(file);
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
            screenshotAction5.onclick = async () => {
                let success = await window.enderlynx.deleteScreenshot(instanceInfo.instance_id, file_name);
                if (success) {
                    screenshotPreview.close();
                    displaySuccess(translate("app.screenshots.custom.delete.success", "%w", word));
                } else {
                    displayError(translate("app.screenshots.custom.delete.fail", "%w", word));
                }
                instanceInfo.instanceScreen.showScreenshots();
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
        screenshotTitle.textContent = name;
        screenshotDesc.textContent = desc;
        screenshotDisplay.src = file;
        screenshotDisplay.alt = name;
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
        window.enderlynx.showFileInFolder(file);
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

function hideToast(element) {
    element.classList.remove("shown");
    setTimeout(() => {
        element.remove();
    }, 1000);
}

function displayToast(type, message) {
    let element = createElement("div", type);
    element.innerHTML = message;
    let toasts = document.getElementsByClassName("toasts")[0];
    toasts.appendChild(element);
    element.classList.add("shown");
    setTimeout(() => {
        hideToast(element)
    }, 3000);
}

function displayError(error) {
    displayToast("error", error.toString());
}

function displaySuccess(success) {
    displayToast("success", success.toString());
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
        return translate("app.never_played");
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
    if (isNaN(date.getTime()) || (date.getFullYear() < 2000)) {
        return translate("app.never_played");
    }
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

function checkForProcess(pid) {
    return window.enderlynx.checkForProcess(pid);
}

function translate(key, ...params) {
    if (!lang) {
        lang = window.enderlynx.getLangFile();
    }
    let value = lang[key] ?? key;
    for (let i = 0; i < params.length; i += 2) {
        value = value.replace(params[i], params[i + 1]);
    }
    if (!value) return key;
    return value;
}

let accountSwitcher;

async function makeAccountSwitcher() {
    accountSwitcher = new MinecraftAccountSwitcher(playerSwitch, await getProfiles());
}
makeAccountSwitcher();

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
    constructor(startingTitle, startingDescription, startingProgress, id, status, startingCancelFunction) {
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
        let ignoreButton = document.createElement("button");
        ignoreButton.innerHTML = '<i class="fa-solid fa-file-circle-xmark"></i>' + translate("app.downloads.ignore");
        ignoreButton.className = "download-ignore-button";
        ignoreButton.onclick = () => {
            this.remove();
        }
        listElement.appendChild(itemElement);
        listElement.appendChild(cancelButton);
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
                    continue info;
                }
            }
            let log = new DownloadLogEntry(info[i].title, info[i].desc, info[i].progress, info[i].id, info[i].status, info[i].cancel);
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

window.enderlynx.onProgressUpdate((title, progress, task, id, status, cancelFunction) => {
    log.sendData([
        {
            "title": title,
            "progress": progress,
            "desc": task,
            "id": id,
            "status": status,
            "cancel": cancelFunction
        }
    ]);
});

window.enderlynx.onContentInstallUpdate((content_id, instance_id, percent) => {
    if (percent >= 100) percent = 0;
    DiscoverStateManagement.setInstallProgress(content_id, instance_id, percent);
});

window.enderlynx.onOpenFileShare((p) => {
    openShareDialogForFile(p);
});

window.enderlynx.onErrorMessage((message) => {
    displayError(message);
});

window.enderlynx.onLaunchInstance(async (launch_info) => {
    if (!launch_info.instance_id) return;
    try {
        let instance = Instance.getInstance(launch_info.instance_id);
        dont_override_my_page = true;
        let pid = instance.pid;
        if (checkForProcess(pid)) {
            instance.display(launch_info.world_id ? "worlds" : "content");
        } else {
            instance.display(launch_info.world_id ? "worlds" : "content", true);
        }
        InstanceStateManagement.setInstanceStatus(launch_info.instance_id, PlayButtonState.LOADING, launch_info.world_id);
    } catch (e) {
        displayError(translate("app.launch_error"));
    }
});

window.enderlynx.onInstallInstance(async (install_info) => {
    if (!install_info.id) return;
    if (!install_info.source) return;
    let project = await Project.getFromId(install_info.id, install_info.source);
    importInstanceFromContentProvider(project);
});

class MultiSelect {
    constructor(element, options) {
        this.onchange = () => { };
        this.element = element;
        element.classList.add("select-list");
        for (let i = 0; i < options.length; i++) {
            let buttonElement = document.createElement("button");
            buttonElement.classList.add("select-button");
            buttonElement.innerHTML = '<i class="fa-solid fa-check select-check"></i>' + options[i].name;
            buttonElement.onclick = (e) => {
                this.selectOption(options[i].value);
                this.onchange();
            }
            element.appendChild(buttonElement);
            options[i].element = buttonElement;
        }
        this.options = options;
        options[0]?.element?.classList.add("selected");
        this.selected = options[0]?.value;
    }
    get value() {
        return this.selected;
    }
    addOnChange(onchange) {
        this.onchange = onchange;
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
        this.selected = val;
    }
}

let version_cache = {};

async function getVersions(loader, mcVersion) {
    if (loader == "fabric") {
        if (version_cache["fabric-" + mcVersion]) return version_cache["fabric-" + mcVersion];
        let v = await window.enderlynx.getFabricLoaderVersions(mcVersion);
        version_cache["fabric-" + mcVersion] = v;
        return v;
    } else if (loader == "forge") {
        if (version_cache["forge-" + mcVersion]) return version_cache["forge-" + mcVersion];
        let v = await window.enderlynx.getForgeLoaderVersions(mcVersion);
        version_cache["forge-" + mcVersion] = v;
        return v;
    } else if (loader == "neoforge") {
        if (version_cache["neoforge-" + mcVersion]) return version_cache["neoforge-" + mcVersion];
        let v = await window.enderlynx.getNeoForgeLoaderVersions(mcVersion);
        version_cache["neoforge-" + mcVersion] = v;
        return v;
    } else if (loader == "quilt") {
        if (version_cache["quilt-" + mcVersion]) return version_cache["quilt-" + mcVersion];
        let v = await window.enderlynx.getQuiltLoaderVersions(mcVersion);
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
            let v = await window.enderlynx.getVanillaVersions();
            version_cache["vanilla"] = v;
            return v;
        } else if (loader == "fabric") {
            if (version_cache["fabric"]) return version_cache["fabric"];
            let v = await window.enderlynx.getFabricVersions();
            version_cache["fabric"] = v;
            return v;
        } else if (loader == "forge") {
            if (version_cache["forge"]) return version_cache["forge"];
            let v = await window.enderlynx.getForgeVersions();
            version_cache["forge"] = v;
            return v;
        } else if (loader == "neoforge") {
            if (version_cache["neoforge"]) return version_cache["neoforge"];
            let v = sortByVersion(await window.enderlynx.getNeoForgeVersions(), true);
            version_cache["neoforge"] = v;
            return v;
        } else if (loader == "quilt") {
            if (version_cache["quilt"]) return version_cache["quilt"];
            let v = await window.enderlynx.getQuiltVersions();
            version_cache["quilt"] = v;
            return v;
        }
    }
    static async getLatestRelease() {
        return await getDefault("latest_release");
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

class FileUpload {
    constructor(element, filesAllowed = true, foldersAllowed = false, fileTypesAllowed = ["*"], fileTypesName = "", maxAmountAllowed = -1, value = []) {
        element.className = "file-upload-wrapper";
        this.foldersAllowed = foldersAllowed;
        this.filesAllowed = filesAllowed;
        this.fileTypesAllowed = fileTypesAllowed;
        this.maxAmountAllowed = maxAmountAllowed;
        this.fileTypesName = fileTypesName;
        this.value = [];
        let uploadsElement = createElement("div", "file-uploads");
        this.uploadsElement = uploadsElement;
        let buttonsElement = createElement("div", "file-upload-buttons");
        this.buttonsElement = buttonsElement;
        element.appendChild(uploadsElement);
        element.appendChild(buttonsElement);
        if (filesAllowed) {
            let fileButton = createElement("button", "file-upload-button", {
                innerHTML: '<i class="fa-solid fa-file"></i>' + translate("app.import.browse.file")
            });
            fileButton.onclick = async () => {
                let value = await window.enderlynx.triggerBrowse("", "file", fileTypesAllowed, fileTypesName, translate("app.import.select.file"), this.maxAmountAllowed != 1);
                this.addValues(value);
            }
            buttonsElement.appendChild(fileButton);
        }
        if (foldersAllowed) {
            let folderButton = createElement("button", "file-upload-button", {
                innerHTML: '<i class="fa-solid fa-folder"></i>' + translate("app.import.browse.folder")
            });
            folderButton.onclick = async () => {
                let value = await window.enderlynx.triggerBrowse("", "folder", [], "", translate("app.import.select.folder"), this.maxAmountAllowed != 1);
                this.addValues(value);
            }
            buttonsElement.appendChild(folderButton);
        }
        let removeAllButton = createElement("button", "file-upload-button danger");
        this.removeAllButton = removeAllButton;
        removeAllButton.onclick = () => {
            this.value = [];
            this.uploadsElement.innerHTML = "";
            this.updateState();
        }
        let nothingElement = createElement("div", "file-no-selected", {
            textContent: translate("app.import.no_files_selected")
        });
        this.nothingElement = nothingElement;
        this.addValues(value);
    }
    addValues(values) {
        for (let v of values) {
            if (this.maxAmountAllowed == 1) {
                this.value = [];
                this.uploadsElement.innerHTML = "";
            } else if (this.maxAmountAllowed >= 0 && this.value.length >= this.maxAmountAllowed) {
                continue;
            }
            this.value.push(v);
            let element = createElement("div", "file-upload-chip");
            element.title = v.path;
            let text = createElement("span");
            text.textContent = v.basename;
            let removeButton = createElement("button", "file-upload-x", {
                innerHTML: '<i class="fa-solid fa-xmark"></i>'
            });
            removeButton.onclick = () => {
                element.remove();
                for (let i = this.value.length - 1; i >= 0; i--) {
                    if (this.value[i].path == v.path) {
                        this.value.splice(i, 1);
                    }
                }
                this.updateState();
            }
            element.appendChild(text);
            element.appendChild(removeButton);
            this.uploadsElement.appendChild(element);
        }
        this.updateState();
    }
    updateState() {
        if (this.value.length == 0) {
            this.removeAllButton.remove();
            this.uploadsElement.appendChild(this.nothingElement);
        } else {
            this.buttonsElement.appendChild(this.removeAllButton);
            this.nothingElement.remove();
        }
        this.removeAllButton.innerHTML = '<i class="fa-solid fa-trash-can"></i>' + (this.value.length == 1 ? translate("app.import.delete") : translate("app.import.delete.all"));
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
        if (selected[0] == "exclude") {
            let not_selected = selected.slice(1);
            this.selectAll("", this.getNode(""));
            not_selected.forEach(e => {
                if (e[0] == "*") {
                    this.deselectRootByExtension(e);
                    return;
                }
                let node = this.getNode(e);
                if (!node) return;
                this.deselectAll(e, node);
            });
            this.updateCheckboxStates();
            if (this.onchange) this.onchange(this.getValue());
            return;
        }
        selected.forEach(e => {
            let node = this.getNode(e);
            if (!node) return;
            this.selectAll(e, node);
        });
        this.updateCheckboxStates();
        if (this.onchange) this.onchange(this.getValue());
    }

    buildTree(paths) {
        const root = {};
        for (const path of paths) {
            const parts = path.split(/(?<!\\)(?:\/\/|\/)/);
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
                chevron.onclick = (e) => {
                    e.stopPropagation();
                    this.toggleExpand(fullPath, childContainer, chevron);
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
            label.innerHTML = key.replaceAll("\\/", "/").replaceAll("\\\\", "\\");
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
        if (path) this.selected.add(path);
        for (const key of Object.keys(node.children)) {
            this.selectAll(path == "" ? key : path + "/" + key, node.children[key]);
        }
    }

    deselectAll(path, node) {
        this.selected.delete(path);
        for (const key of Object.keys(node.children)) {
            this.deselectAll(path + "/" + key, node.children[key]);
        }
    }

    deselectRootByExtension(ext) {
        let extension = ext.substring(2);
        for (const key of Object.keys(this.tree)) {
            let split = key.split(".");
            if (split[split.length - 1] == extension) {
                let node = this.getNode(key);
                if (!node) continue;
                this.deselectAll(key, node);
            }
        }
    }

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

    getNode(path) {
        if (path == "") return { children: this.tree };
        const parts = path.split(/(?<!\\)(?:\/)/);
        let node = { children: this.tree };
        for (const part of parts) {
            if (!node.children) return null;
            if (!node.children[part]) return null;
            node = node.children[part];
        }
        return node;
    }

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

class Dialog {
    constructor() { }
    closeDialog() {
        this.element.close();
    }
    showDialog(title, type, info, buttons, tabs, onsubmit, onclose, full_screen, dont_maintain_height, wide) {
        this.onsubmit = onsubmit;
        this.useOnClose = true;
        let element = document.createElement("dialog");
        element.className = "dialog";
        element.onclose = (e) => {
            if (onclose && this.useOnClose) onclose();
            setTimeout(() => {
                this.element.remove();
            }, 1000);
        }
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
        }
        dialogTop.appendChild(dialogTitle);
        dialogTop.appendChild(dialogX);
        element.appendChild(dialogTop);
        let realDialogContent = document.createElement("div");
        realDialogContent.className = "dialog-content";
        if (dont_maintain_height) realDialogContent.classList.add("dont-maintain-height");
        if (wide) element.classList.add("wide");
        let contents = {};
        element.appendChild(realDialogContent);
        document.body.appendChild(element);
        element.showModal();
        let tabElement = document.createElement("div");
        this.values = [];
        this.selectedTab = tabs ? tabs[0]?.value ?? "" : "";
        if (tabs && tabs.length) {
            realDialogContent.appendChild(tabElement);
            new TabContentVertical(tabElement, tabs.map(e => ({
                "name": e.name, "value": e.value, "func": (v) => {
                    let keys = Object.keys(contents);
                    keys.forEach(e => {
                        contents[e].style.display = "none";
                    });
                    contents[v].style.display = "flex";
                    this.selectedTab = v;
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
        if (this.selectedTab) contents[this.selectedTab].style.display = "flex";
        if (type == "notice") {
            if (info instanceof Element) {
                realDialogContent.innerHTML = '';
                realDialogContent.appendChild(info);
            } else {
                realDialogContent.innerHTML = "<span>" + (info) + "</span>";
            }
        } else if (type == "form") {
            for (let i = 0; i < info.length; i++) {
                let elementInfo = this.getElement(info[i], i == info.length - 1);
                contents[elementInfo.tab].appendChild(elementInfo.element);
            }
        }
        let keys = Object.keys(contents);
        keys.forEach(e => {
            contents[e].style.display = "none";
        });
        contents[keys[0]].style.display = "flex";
        let dialogButtons = document.createElement("div");
        dialogButtons.className = "dialog-buttons";
        for (let button of buttons) {
            let buttonElement = createElement("button", "dialog-button", {
                textContent: button.content
            });
            if (button.type == "cancel") {
                buttonElement.onclick = (e) => {
                    this.closeDialog();
                }
            } else if (button.type == "confirm") {
                buttonElement.classList.add("confirm");
                buttonElement.onclick = () => {
                    this.submit();
                }
                this.buttonElement = buttonElement;
            }
            dialogButtons.appendChild(buttonElement);
        }
        element.appendChild(dialogButtons);
        // make the toasts show on top of the dialog
        document.getElementsByClassName("toasts")[0].hidePopover();
        document.getElementsByClassName("toasts")[0].showPopover();
    }

    getElement(info, isLast) {
        let tab = info.tab || "default";
        let wrapper = createElement("div", "dialog-text-label-wrapper");
        let label = createElement("label", "dialog-label", {
            textContent: info.name
        });
        let labelDesc = createElement("label", "dialog-label-desc", {
            textContent: info.desc
        });
        let value = {
            getter: () => { },
            setter: (value) => { },
            tab,
            runOnChange: () => { },
            setOnChange: (onchange) => { },
            id: info.id,
            element: wrapper,
            defaultValue: info.default_value,
            customValue: info.custom_value,
            disable: () => { },
            enable: () => { }
        };
        if (info.type == "notice") {
            let textElement = createElement("div");
            if (info.content instanceof Element) {
                textElement.appendChild(info.content);
            } else {
                textElement.innerHTML = info.content;
                textElement.className = "dialog-label-desc";
            }
            if (info.width) textElement.style.width = info.width + "px";
            value.element = textElement;
        } else if (info.type == "info") {
            let infoElement = createElement("div", "info", {
                innerHTML: '<i class="fa-solid fa-triangle-exclamation"></i>' + info.content
            });
            if (info.width) infoElement.style.width = info.width + "px";
            value.element = infoElement;
        } else if (info.type == "text" || info.type == "number") {
            label.htmlFor = info.id;
            labelDesc.htmlFor = info.id;
            let textInput = createElement(info.multiline ? "textarea" : "input", "dialog-text-input", {
                placeholder: info.name,
                id: info.id
            });
            if (!info.multiline) {
                textInput.type = info.type;
            }
            if (info.oninput) textInput.oninput = () => {
                info.oninput(textInput.value);
            }
            textInput.value = info.default || "";
            if (info.maxlength) textInput.maxLength = info.maxlength;
            wrapper.appendChild(label);
            if (info.desc) wrapper.appendChild(labelDesc);
            wrapper.appendChild(textInput);
            if (info.focus) {
                textInput.focus();
            }
            if (isLast) {
                textInput.onkeydown = (e) => {
                    if (e.key == "Enter") {
                        this.submit();
                        e.preventDefault();
                    }
                }
            }
            value.getter = () => textInput.value;
            value.runOnChange = () => {
                if (textInput.onchange) textInput.onchange();
            }
            value.setter = (val) => {
                textInput.value = val;
                value.runOnChange();
            }
            value.setOnChange = (onchange) => {
                textInput.onchange = () => {
                    onchange(value.getter());
                }
            }
            value.disable = () => textInput.disabled = true;
            value.enable = () => textInput.disabled = false;
        } else if (info.type == "toggle") {
            let labelWrapper = createElement("div", "label-wrapper");
            let toggleEle = createElement("button");
            let toggle = new Toggle(toggleEle, () => { }, info.default ?? false);
            let wrapper = createElement("div", "dialog-text-label-wrapper-horizontal");
            wrapper.appendChild(toggleEle);
            wrapper.appendChild(labelWrapper);
            labelWrapper.appendChild(label);
            if (info.desc) labelWrapper.appendChild(labelDesc);
            value.getter = () => toggle.value;
            value.runOnChange = () => {
                if (toggle.onchange) toggle.onchange();
            }
            value.setter = (val) => {
                toggle.setValueWithoutTrigger(val);
                value.runOnChange();
            }
            value.element = wrapper;
            value.setOnChange = (onchange) => {
                toggle.onchange = () => {
                    onchange(value.getter());
                }
            }
            value.disable = () => toggle.disable();
            value.enable = () => toggle.enable();
        } else if (info.type == "slider") {
            label.htmlFor = info.id;
            labelDesc.htmlFor = info.id;
            let sliderElement = createElement("div");
            let slider = new Slider(sliderElement, info.min, info.max, info.default ?? info.min, info.increment, info.unit);
            let wrapper = createElement("div", "dialog-text-label-wrapper");
            wrapper.appendChild(label);
            if (info.desc) wrapper.appendChild(labelDesc);
            wrapper.appendChild(sliderElement);
            value.getter = () => slider.value
            value.setter = (value) => slider.setValue(value);
            value.setOnChange = (onchange) => {
                slider.addOnChange(() => {
                    onchange(value.getter());
                });
            }
            value.element = wrapper;
            value.disable = () => slider.disable();
            value.enable = () => slider.enable();
        } else if (info.type == "image-upload") {
            wrapper.appendChild(label);
            let element = createElement("div");
            let imageUpload = new ImageUpload(element, info.default, info.image_code);
            wrapper.appendChild(element);
            value.getter = () => imageUpload.value;
        } else if (info.type == "multi-select") {
            wrapper.appendChild(label);
            let element = createElement("div");
            wrapper.appendChild(element);
            let multiSelect = new MultiSelect(element, info.options);
            if (info.default) multiSelect.selectOption(info.default);
            value.getter = () => multiSelect.value;
            value.setter = (val) => multiSelect.selectOption(val);
            value.setOnChange = (onchange) => {
                multiSelect.addOnChange(() => {
                    onchange(value.getter());
                });
            }
        } else if (info.type == "files") {
            wrapper.appendChild(label);
            let element = createElement("div");
            wrapper.appendChild(element);
            let multiSelect = new MultipleFileSelect(element, info.options);
            if (info.default) multiSelect.setSelected(info.default);
            value.getter = () => multiSelect.value;
            value.setter = (val) => multiSelect.setSelected(val);
            value.setOnChange = (onchange) => multiSelect.addOnChange(onchange);
        } else if (info.type == "file-upload") {
            wrapper.appendChild(label);
            if (info.desc) wrapper.appendChild(labelDesc);
            let element = createElement("div");
            wrapper.appendChild(element);
            let fileUpload = new FileUpload(element, info.files_allowed, info.folders_allowed, info.file_types_allowed, info.file_types_name, info.max_amount_allowed, info.default);
            value.getter = () => fileUpload.value;
        } else if (info.type == "dropdown") {
            wrapper.appendChild(label);
            if (info.desc) wrapper.appendChild(labelDesc);
            let element = createElement("div");
            wrapper.appendChild(element);
            let dropdown;
            if (info.options.length >= 10 || info.source) {
                dropdown = new SearchDropdown("", info.options, element, info.default ?? info.options[0]?.value);
            } else {
                dropdown = new Dropdown("", info.options, element, info.default ?? info.options[0]?.value);
            }
            value.getter = () => dropdown.value;
            value.runOnChange = () => {
                if (dropdown.onchange) dropdown.onchange();
            }
            value.setter = (val) => dropdown.selectOption(val);
            value.setOptions = (options, initial) => dropdown.setOptions(options, initial);
            value.setOnChange = (onchange) => {
                dropdown.addOnChange(() => {
                    onchange(value.getter(), this.values, wrapper);
                });
            }
            value.getPass = () => dropdown.getPass();
        } else if (info.type == "loader-version-dropdown") {
            wrapper.appendChild(label);
            let element = createElement("div");
            wrapper.appendChild(element);
            let loaderElement;
            let multiSelect = new SearchDropdown("", info.options, element, info.default ?? info.options[0]?.value);
            for (let otherElement of this.values) {
                if (otherElement.id == info.loader_source) {
                    loaderElement = otherElement;
                }
                if (otherElement.id == info.game_version_source) {
                    let updateToken = 0;
                    let setValue = async () => {
                        const currentToken = ++updateToken;
                        let loader = loaderElement.getter();
                        wrapper.style.display = loader == "vanilla" ? "none" : "";
                        if (loader == "vanilla") return;
                        let oldValue = multiSelect.value;
                        let value = otherElement.getter();
                        label.innerHTML = translate("app.dialog.loading");
                        multiSelect.setOptions([{ "name": translate("app.dialog.loading"), "value": "loading" }], "loading");
                        try {
                            let list = await getVersions(loader, value);
                            if (currentToken !== updateToken) return;
                            if (label.innerHTML != translate("app.dialog.loading")) return;
                            multiSelect.setOptions(list.map(e => ({ "name": e, "value": e })), list.includes(oldValue) ? oldValue : list.includes(info.default) ? info.default : list[0]);
                            label.innerHTML = translate("app.instances.settings.loader_version", "%l", loaders[loader]);
                        } catch (err) {
                            if (currentToken !== updateToken) return;
                            displayError(translate("app.failed_to_load", "%m", (err && err.message ? err.message : err)));
                            label.textContent = translate("app.dialog.unable_to_load", "%n", info.name);
                            multiSelect.setOptions([{ "name": translate("app.dialog.unable_to_load.no_name"), "value": "loading" }], "loading");
                        }
                    }
                    otherElement.setOnChange(setValue);
                    setValue();
                }
            }
            value.getter = () => multiSelect.value;
            value.runOnChange = () => {
                if (multiSelect.onchange) multiSelect.onchange();
            }
            value.setter = (val) => multiSelect.selectOption(val);
            value.setOptions = (options, initial) => multiSelect.setOptions(options, initial);
            value.setOnChange = (onchange) => {
                multiSelect.addOnChange(() => {
                    onchange(value.getter(), this.values, wrapper);
                });
            }
            value.getPass = () => multiSelect.getPass();
        } else if (info.type == "button") {
            let buttonElement = createElement("button", "sub-button", {
                innerHTML: info.icon + info.name
            });
            buttonElement.onclick = () => {
                if (info.close_dialog) {
                    this.closeDialog();
                }
                info.func();
            }
            value.element = buttonElement;
        } else if (info.type == "override-default") {
            let overrideWrapper = createElement("div", "override-default-box");
            let innerList = createElement("div", "override-default-inner-box");
            if (!info.enabled) innerList.classList.add("disabled");
            let checkboxWrapper = createElement("div", "override-checkbox-wrapper");
            let checkbox = createElement("input", "override-checkbox", {
                type: "checkbox",
                id: info.id
            });
            if (info.enabled) {
                checkbox.checked = true;
            }
            checkbox.onchange = () => {
                if (!checkbox.checked) {
                    innerList.classList.add("disabled");
                    infoList.forEach(e => {
                        e.setter(e.defaultValue);
                        e.disable();
                    });
                } else {
                    innerList.classList.remove("disabled");
                    infoList.forEach(e => {
                        e.setter(e.customValue);
                        e.enable();
                    });
                }
            }
            let checkboxText = createElement("label", "override-checkbox-name", {
                htmlFor: info.id,
                textContent: info.name
            });
            checkboxWrapper.appendChild(checkbox);
            checkboxWrapper.appendChild(checkboxText);
            overrideWrapper.appendChild(checkboxWrapper);
            overrideWrapper.appendChild(innerList);
            let infoList = [];
            for (let child of info.children) {
                let elementInfo = this.getElement(child, false);
                innerList.appendChild(elementInfo.element);
                elementInfo.setOnChange((val) => {
                    if (!checkbox.checked) return;
                    elementInfo.customValue = val;
                });
                if (!info.enabled) {
                    elementInfo.disable();
                    elementInfo.setter(elementInfo.defaultValue);
                } else {
                    elementInfo.setter(elementInfo.customValue);
                }
                infoList.push(elementInfo);
            }
            value.getter = () => checkbox.checked;
            value.element = overrideWrapper;
        }
        if (info.buttons) {
            let buttonWrapper = createElement("div", "sub-button-container");
            let buttonElements = [];
            for (let button of info.buttons) {
                let buttonEle = createElement("button", "sub-button", {
                    innerHTML: button.icon + button.name
                });
                let buttonClick = async () => {
                    buttonEle.onclick = () => { }
                    await button.func(value.getter(), buttonEle, value.setter);
                    buttonEle.onclick = buttonClick;
                }
                buttonEle.onclick = buttonClick;
                buttonElements.push(buttonEle);
                buttonWrapper.appendChild(buttonEle);
            }
            let oldDisable = value.disable;
            value.disable = () => {
                oldDisable();
                for (let buttonElement of buttonElements) {
                    buttonElement.disabled = true;
                }
            }
            let oldEnable = value.enable;
            value.enable = () => {
                oldEnable();
                for (let buttonElement of buttonElements) {
                    buttonElement.disabled = false;
                }
            }
            wrapper.appendChild(buttonWrapper);
        }
        if (info.source) {
            let updateToken = 0;
            let getValueFromSource = async (val) => {
                const currentToken = ++updateToken;
                let oldValue = value.getter();
                label.innerHTML = translate("app.dialog.loading");
                if (value.setOptions) value.setOptions([{ "name": translate("app.dialog.loading"), "value": "loading" }], "loading");
                try {
                    let list = await info.source(val);
                    if (currentToken !== updateToken) return;
                    if (label.innerHTML != translate("app.dialog.loading")) return;
                    if (Array.isArray(list) && value.setOptions) {
                        if (list[0] != null && typeof list[0] == 'object' && "name" in list[0] && "value" in list[0]) {
                            value.setOptions(list, list.map(e => e.value).includes(oldValue) ? oldValue : list.map(e => e.value).includes(info.default) ? info.default : list[0]?.value);
                        } else {
                            value.setOptions(list.map(e => ({ "name": e, "value": e })), list.includes(oldValue) ? oldValue : list.includes(info.default) ? info.default : list[0]);
                        }
                        value.runOnChange();
                    } else {
                        value.setter(list);
                    }
                    label.textContent = info.name;
                } catch (err) {
                    if (currentToken !== updateToken) return;
                    displayError(translate("app.failed_to_load", "%m", (err && err.message ? err.message : err)));
                    label.textContent = translate("app.dialog.unable_to_load", "%n", info.name);
                    if (value.setOptions) {
                        value.setOptions([{ "name": translate("app.dialog.unable_to_load.no_name"), "value": "loading" }], "loading");
                    } else {
                        value.setter("");
                    }
                }
            }
            let found = false;
            for (let otherElement of this.values) {
                if (otherElement.id != info.input_source) continue;
                found = true;
                otherElement.setOnChange(getValueFromSource);
                getValueFromSource(otherElement.getter());
            }
            if (!found) {
                getValueFromSource("");
            }
        }
        if (info.onchange) {
            value.setOnChange(info.onchange);
        }
        this.values.push(value);
        return value;
    }

    async submit() {
        let info = this.values.map(e => ({ "id": e.id, "value": e.customValue || e.getter(), "pass": e.getPass ? e.getPass() : null }));
        info.push({ "id": "selected_tab", "value": this.selectedTab });
        let info2 = {};
        info.forEach(e => {
            if (e.pass) info2[e.id + "_pass"] = e.pass;
            info2[e.id] = e.value;
        });
        this.onsubmit(info2, this.buttonElement);
        this.useOnClose = false;
        this.element.close();
    }
}

class ContentSearchEntry {
    constructor(content, instance, vanilla_version, loader, experimental, project_type, offline) {
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
        makeArtificialButton(element, () => {
            displayContentInfo(content.source, undefined, content.id, instance?.instance_id, vanilla_version, project_type == "datapack" ? "datapack" : loader, false, false, undefined);
        }, ["button"]);
        this.element = element;
        if (content.id) element.id = content.id;
        let image = document.createElement("img");
        image.src = content.icon || getDefaultImage(content.name);
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
        titleElement.innerHTML = `<div>${sanitize(content.name)}</div>`;
        top.appendChild(titleElement);
        if (content.author) {
            let authorElement = document.createElement("div");
            authorElement.className = "discover-item-author";
            authorElement.innerHTML = `<div>${sanitize(translate("app.discover.author", "%a", content.author))}</div>`;
            top.appendChild(authorElement);
        }
        let descElement = document.createElement("div");
        descElement.className = "discover-item-desc";
        descElement.innerHTML = content.summary;
        info.appendChild(descElement);
        let tagsElement = document.createElement("div");
        tagsElement.className = "discover-item-tags";
        info.appendChild(tagsElement);
        content.categories.forEach(e => {
            let tagElement = document.createElement("div");
            tagElement.innerHTML = translate(e);
            tagElement.className = "discover-item-tag";
            tagsElement.appendChild(tagElement);
        });
        if (content.online_players && content.max_players) {
            let downloadCountElement = document.createElement("div");
            downloadCountElement.innerHTML = translate("app.discover.online_count", "%o", formatNumber(content.online_players), "%t", formatNumber(content.max_players));
            downloadCountElement.className = "discover-item-downloads";
            actions.appendChild(downloadCountElement);
        } else if (content.server_modpack) {
            let downloadCountElement = document.createElement("div");
            downloadCountElement.innerHTML = translate("app.discover.server.offline");
            downloadCountElement.className = "discover-item-downloads";
            actions.appendChild(downloadCountElement);
        } else if (content.downloads) {
            let downloadCountElement = document.createElement("div");
            downloadCountElement.innerHTML = translate("app.discover.download_count", "%d", formatNumber(content.downloads));
            downloadCountElement.className = "discover-item-downloads";
            actions.appendChild(downloadCountElement);
        }
        let installButton = document.createElement("button");
        installButton.className = "discover-item-install";
        DiscoverStateManagement.registerButton(content.id, null, installButton, content, null, instance);
        if (project_type) actions.appendChild(installButton);
    }
}

function formatNumber(num) {
    if (typeof num != 'number') {
        return "";
    }
    if (num < 1000) return num.toString();
    if (num < 100000) return Math.round(num / 100) / 10 + "k";
    if (num < 1000000) return Math.round(num / 1000) + "k";
    if (num < 100000000) return Math.round(num / 100000) / 10 + "M";
    if (num < 1000000000) return Math.round(num / 1000000) + "M";
    if (num < 100000000000) return Math.round(num / 100000000) / 10 + "B";
    if (num < 1000000000000) return Math.round(num / 1000000000) + "B";
    return "Some Number";
}

let pages = 0;

class Pagination {
    constructor(currentPage, totalPages, change_page_function) {
        let element = document.createElement("div");
        element.className = "page-container";
        this.element = element;
        let pagesElement = document.createElement("div");
        pagesElement.className = "pages";
        this.pagesElement = pagesElement;
        this.totalPages = totalPages;
        this.change_page_function = change_page_function;
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

function displayVanillaTweaksEditor(instance_id, version, packs, content) {
    let wrapper = document.createElement("div");
    wrapper.className = "vt-editor-wrapper";
    let instance = Instance.getInstance(instance_id);
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
        try {
            await updateContent(
                "vanilla_tweaks",
                content,
                Project.getVanillaTweaks(instance.vanilla_version, "resourcepack"),
                await VanillaTweaks.getResourcePacksVersion(added_vt_packs, instance.vanilla_version),
                instance
            );
            displaySuccess(translate("app.discover.vt.success_edit"));
        } catch (e) {
            displayError(translate("app.discover.vt.fail"));
        }
    }, () => { }, true);
}

class VanillaTweaksSelector {
    constructor(type, version, instance_id, vt_version, element, query, hide_install_button) {
        if (version == "all") version = null;
        this.type = type;
        this.version = version;
        this.instance_id = instance_id
        this.vt_version = vt_version;
        this.element = element;
        this.query = query;
        this.hide_install_button = hide_install_button;
        this.initialize();
    }
    sortPacks() {
        added_vt_packs.sort((a, b) => (a?.id || "").localeCompare(b?.id || ""));
    }
    addSelected(item) {
        let low = 0;
        let high = added_vt_packs.length;

        while (low < high) {
            const mid = (low + high) >> 1;
            if ((added_vt_packs[mid]?.id || "").localeCompare(item?.id || "") < 0) {
                low = mid + 1;
            } else {
                high = mid;
            }
        }

        added_vt_packs.splice(low, 0, item);
    }
    removeSelected(id) {
        added_vt_packs = added_vt_packs.filter(e => e.id != id);
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
        this.sortPacks();
        if (!this.vt_version) this.vt_version = VanillaTweaks.default_vanilla_tweaks_version;
        try {
            if (this.type == "resourcepack") {
                result = await VanillaTweaks.getResourcePacks(this.query, this.vt_version);
            } else if (this.type == "datapack") {
                result = await VanillaTweaks.getDataPacks(this.query, this.vt_version);
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
                "name": "26.2",
                "value": "26.2"
            },
            {
                "name": "26.1",
                "value": "26.1"
            },
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
        submitButton.className = "vt-submit-button version-file-install";
        DiscoverStateManagement.registerButton("vt-" + this.type, () => JSON.stringify(added_vt_packs), submitButton, () => {
            return Project.getVanillaTweaks(this.vt_version, this.type)
        }, async () => {
            if (this.type == "resourcepack") {
                return await VanillaTweaks.getResourcePacksVersion(added_vt_packs, this.vt_version);
            } else if (this.type == "datapack") {
                return await VanillaTweaks.getDataPacksVersion(added_vt_packs, this.vt_version);
            }
        }, this.instance_id ? Instance.getInstance(this.instance_id) : null, undefined, undefined, undefined, true);
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
            vtIcon.loading = "lazy";
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
                    this.addSelected({ "id": e.vt_id, "type": e.type })
                } else {
                    this.removeSelected(e.vt_id);
                }
                checkForIncompatibilities();
                updatePackCount();
                DiscoverStateManagement.updateAllButtons("vt-" + this.type, this.instance_id);
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

async function installContent(source, project, version, instance, data_pack_world) {
    DiscoverStateManagement.setContentStatus(project.id, instance.instance_id, DiscoverState.INSTALLING);
    if (project.server_modpack?.kind == "vanilla") {
        await instance.installContent(instance, "server", project.ip_address, null, project.name, project.icon);
        DiscoverStateManagement.setContentStatus(project.id, instance.instance_id, DiscoverState.INSTALLED);
        return { id: true };
    }
    if (!version) version = await project.getVersion(instance.loader, instance.vanilla_version, project.project_type, project.id, source);
    if (!version) {
        displayError(translate("app.discover.error"));
        DiscoverStateManagement.setContentStatus(project.id, instance.instance_id, DiscoverState.NOT_INSTALLED);
        return;
    }
    try {
        await installSpecificVersion(version, source, instance, version.project_type || project.project_type, project.name, project.author, project.icon, project.id, false, data_pack_world);
    } catch (e) {
        displayError(e.message);
        return;
    }
    return { id: version.version_id };
}

async function installSpecificVersion(version, source, instance, project_type, title, author, icon_url, project_id, isUpdate, data_pack_world) {
    let instance_id = instance.instance_id;
    DiscoverStateManagement.setContentStatus(version.project_id, instance_id, DiscoverState.INSTALLING);
    DiscoverStateManagement.setVersionInstalled(version.project_id, instance_id, version.version_id);
    let content = await instance.getContent();
    let modrinth_ids = content.filter(e => e.source == "modrinth").map(e => e.source_info);
    let curseforge_ids = content.filter(e => e.source == "curseforge").map(e => e.source_info);
    let initialContent = {};
    try {
        if (Array.isArray(version.download_url)) {
            for (let url of version.download_url) {
                initialContent = await instance.installContent(project_type, url, version.sha1_hash, version.filename, data_pack_world, project_id);
            }
        } else {
            initialContent = await instance.installContent(project_type, version.download_url, version.sha1_hash, version.filename, data_pack_world, project_id);
        }
    } catch (e) {
        DiscoverStateManagement.setContentStatus(version.project_id, instance_id, DiscoverState.NOT_INSTALLED);
        throw e;
    }
    DiscoverStateManagement.setContentStatus(version.project_id, instance_id, DiscoverState.INSTALLED);
    if (isUpdate) return initialContent;
    let version_number = version.version_number || "";
    let version_id = version.version_id;
    let dependencies = version.required_dependencies;
    if ((await instance.getContent()).map(e => e.source_id).includes(project_id)) {
        return;
    }
    if (project_type != "world" && project_type != "datapack") await instance.addContent(title, author, icon_url, initialContent.file_name, source, initialContent.type, version_number, project_id, false, version_id);
    if (initialContent.stop_installing_dependencies) return initialContent;
    if (dependencies && project_type != "world" && project_type != "datapack") {
        for (let j = 0; j < dependencies.length; j++) {
            let dependency = dependencies[j];
            if (modrinth_ids.includes(dependency.project_id) || curseforge_ids.includes(dependency.project_id)) continue;
            let project = await Project.getFromId(dependency.project_id, source);
            await project.getAuthors();
            if (dependency.version_id) {
                let version = await ProjectVersion.getFromId(dependency.version_id, dependency.project_id, source);
                await installSpecificVersion(version, source, instance, project.project_type, project.name, project.author, project.icon, project.id, false, undefined);
            } else {
                await installContent(source, project, undefined, instance);
            }
        }
    }
    return initialContent;
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

const superSanitizer = new Sanitizer({ elements: ["p", "div", "span", { name: "img", attributes: ["src", "width", "height", "alt"] }, { name: "iframe", attributes: ["src", "width", "height", "alt"] }, "b", "center", "strong", { name: "details", attributes: ["open"] }, "summary", { name: "font", attributes: ["size"] }, "a", "h1", "h2", "h3", "h4", "h5", "h6", "i", "u", "br", "hr", "code", "dl", "dt", "em", "kbd", "li", "ol", "ul", "pre", "table", "tbody", "td", "th", "tfoot", "tr", "tt", "wbr", "blockquote", "section", "s", "thead", "sup", "abbr", "sub", "del", "strike", "ins"], "attributes": ["style", "title", "href", "align", "class"], "comments": false });

async function applyCape(profile_id, cape) {
    try {
        await window.enderlynx.setCape(profile_id, cape ? cape.cape_id : null);
        displaySuccess(translate("app.wardrobe.cape.change"));
        return true;
    } catch (e) {
        displayError(e.message);
        return false;
    }
}

async function applySkin(profile_id, skin) {
    try {
        await window.enderlynx.setSkin(profile_id, skin.skin_id, skin.model == "wide" ? "classic" : "slim");
        accountSwitcher.reloadHeads();
        displaySuccess(translate("app.wardrobe.skin.change"));
        return true;
    } catch (e) {
        displayError(e.message);
        return false;
    }
}

async function applySkinFromURL(profile_id, skin) {
    try {
        await window.enderlynx.setSkinFromURL(profile_id, "https://textures.minecraft.net/texture/" + skin.texture_key, skin.model == "wide" ? "classic" : "slim");
        accountSwitcher.reloadHeads();
        displaySuccess(translate("app.wardrobe.skin.change"));
        return true;
    } catch (e) {
        displayError(e.message);
        return false;
    }
}

document.getElementsByClassName("toasts")[0].showPopover();

async function getRecentlyPlayedWorlds(ignore_world_ids = []) {
    let all_servers = await window.enderlynx.getAllServers((await getInstances()).map(e => e.instance_id));
    let allServersMapped = [];
    for (let i = 0; i < all_servers.length; i++) {
        allServersMapped.push({
            ...all_servers[i],
            "last_played": await Instance.getInstance(all_servers[i].instance_id).getServerLastPlayed(all_servers[i].ip)
        });
    }
    let last_played_worlds = await window.enderlynx.getRecentlyPlayedWorlds((await getInstances()).map(e => e.instance_id));
    let all = last_played_worlds.concat(allServersMapped);
    all = all.filter(e => !ignore_world_ids.includes((e.id ? e.id : e.ip) + ":" + e.instance_id))
    all.sort((a, b) => b.last_played - a.last_played);
    return all;
}

async function getRecentlyPlayedInstances(ignore_instance_ids = []) {
    let instances = await window.enderlynx.getInstances();
    instances = instances.filter(e => !ignore_instance_ids.includes(e.instance_id));
    instances.sort((a, b) => new Date(b.last_played) - new Date(a.last_played));
    let instanceList = [];
    for (let instance of instances) {
        instanceList.push(Instance.applyInstance(instance.instance_id, instance));
    }
    return instanceList;
}

async function getPinnedInstances() {
    let instances = await window.enderlynx.getPinnedInstances();
    let instanceList = [];
    for (let i = 0; i < instances.length; i++) {
        let instance = Instance.getInstance(instances[i].instance_id);
        if (!instance) {
            await instance.unpin(true);
            continue;
        }
        instanceList.push(instance);
    }
    return instanceList;
}
async function getPinnedWorlds() {
    return (await window.enderlynx.getPinnedWorlds());
}

async function getModpackVersions(source, content_id) {
    let project = new Project();
    await project.getAllVersions(content_id, source);
    return project.versions.map(e => ({ "name": e.name, "value": e.version_id, "pass": e }));
}

let contentInfoHistory = [];
let contentInfoIndex = 0;
let dialogContextMenu = new ContextMenu();

async function displayContentInfo(content_source, content, content_id, instance_id, vanilla_version, loader, locked, disableAddToHistory = false, content_list_to_update, tab = "description") {
    if (!content_source) return;
    if (!content) content = new Project();
    let contentInfo = document.getElementById("contentInfo");
    if (!disableAddToHistory) {
        let displayFunction = () => {
            displayContentInfo(content_source, content, content_id, instance_id, vanilla_version, loader, locked, true, content_list_to_update, tab);
        };
        if (contentInfo.open) {
            contentInfoHistory = contentInfoHistory.slice(0, contentInfoIndex + 1);
            contentInfoHistory.push(displayFunction);
            contentInfoIndex++;
        } else {
            contentInfoHistory = [displayFunction];
            contentInfoIndex = 0;
        }
    }
    let instance = instance_id ? Instance.getInstance(instance_id) : null;
    let instance_content = [];
    if (instance_id) instance_content = await instance.getContent();
    let currentlyInstalling = false;

    if (Display.currentScreen.tabName != "discover") {
        DiscoverStateManagement.setInstance(instance);
    }

    contentInfo.innerHTML = "";
    contentInfo.showModal();
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
            contentInfoHistory[contentInfoIndex]();
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
            contentInfoHistory[contentInfoIndex]();
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

    let display_source = translate("app.discover.modrinth");
    if (content_source == "curseforge") display_source = translate("app.discover.curseforge");

    try {
        if (content_id.toString().includes(":")) {
            await content.getInfoFromSlug(content_id, content_source);
        } else {
            await content.getInfoFromId(content_id, content_source);
        }
        await content.getAuthors();
    } catch (e) {
        loading.errorOut(e, () => {
            displayContentInfo(content_source, content, content_id, instance_id, vanilla_version, loader, locked, true, content_list_to_update, tab);
        });
        return;
    }

    loading.element.remove();

    let topBar = document.createElement("div");
    topBar.classList.add("content-top");
    let contentImage = document.createElement("img");
    contentImage.classList.add("content-top-image");
    contentImage.src = content.icon || getDefaultImage(content.name);
    topBar.appendChild(contentImage);
    let contentTopInfo = document.createElement("div");
    contentTopInfo.classList.add("content-top-info");
    let contentTopTitle = document.createElement("h1");
    contentTopTitle.textContent = content.name;
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
    if (!content.project_type) type = translate("app.content.unknown");
    let allow_downloads = Boolean(content.project_type);
    contentTopType.innerHTML = `<i class="fa-solid fa-gamepad"></i>${type}`;
    let contentTopDownloads = document.createElement("div");
    contentTopDownloads.classList.add("content-top-sub-info-specific");
    if (content.online_players || content.online_players == 0) {
        contentTopDownloads.innerHTML = `<i class="fa-solid fa-signal"></i>${translate("app.discover.online_count", "%o", formatNumber(content.online_players), "%t", formatNumber(content.max_players))}`;
    } else if (content.max_players == 0 || content.server_modpack) {
        contentTopDownloads.innerHTML = `<i class="fa-solid fa-signal"></i>${translate("app.discover.server.offline")}`;
    } else {
        contentTopDownloads.innerHTML = `<i class="fa-solid fa-download"></i>${translate("app.discover.download_count", "%d", formatNumber(content.downloads))}`;
    }
    let contentTopLastUpdated = document.createElement("div");
    contentTopLastUpdated.classList.add("content-top-sub-info-specific");
    contentTopLastUpdated.innerHTML = `<i class="fa-solid fa-calendar-days"></i>${formatTimeRelatively(content.updated)}`;
    contentTopLastUpdated.setAttribute("title", translate("app.discover.last_updated") + ": " + formatDate(content.updated));
    let contentTopSource = document.createElement("div");
    contentTopSource.classList.add("content-top-sub-info-specific");
    contentTopSource.textContent = display_source;
    contentTopSource.classList.add(content.source);
    contentTopSubInfo.appendChild(contentTopType);
    contentTopSubInfo.appendChild(contentTopDownloads);
    contentTopSubInfo.appendChild(contentTopLastUpdated);
    contentTopSubInfo.appendChild(contentTopSource);
    contentTopInfo.appendChild(contentTopSubInfo);
    topBar.appendChild(contentTopInfo);
    let installButton = document.createElement("button");
    installButton.className = "content-top-install-button";
    DiscoverStateManagement.registerButton(content.id, null, installButton, content, null, instance, content_list_to_update, locked);
    let content_ids = instance_content.map(e => e.source_info);
    if (typeof content.id == 'number') content_ids = content_ids.map(Number);
    let threeDots = document.createElement("button");
    threeDots.classList.add("content-top-more");
    threeDots.innerHTML = '<i class="fa-solid fa-ellipsis-vertical"></i>';
    let links = [];
    if (content.links.website) {
        links.push({
            "icon": '<i class="fa-solid fa-globe"></i>',
            "title": translate("app.discover.view.website"),
            "func": (e) => {
                window.enderlynx.openInBrowser(content.links.website);
            }
        })
    }
    if (content.links.source) {
        links.push({
            "icon": '<i class="fa-solid fa-code"></i>',
            "title": translate("app.discover.view.source"),
            "func": (e) => {
                window.enderlynx.openInBrowser(content.links.source);
            }
        })
    }
    if (content.links.wiki) {
        links.push({
            "icon": '<i class="fa-solid fa-book-atlas"></i>',
            "title": translate("app.discover.view.wiki"),
            "func": (e) => {
                window.enderlynx.openInBrowser(content.links.wiki);
            }
        })
    }
    if (content.links.issues) {
        links.push({
            "icon": '<i class="fa-solid fa-bug"></i>',
            "title": translate("app.discover.view.issues"),
            "func": (e) => {
                window.enderlynx.openInBrowser(content.links.issues);
            }
        })
    }
    if (content.links.discord) {
        links.push({
            "icon": '<i class="fa-brands fa-discord"></i>',
            "title": translate("app.discover.view.discord"),
            "func": (e) => {
                window.enderlynx.openInBrowser(content.links.discord);
            }
        })
    }
    if (content.links.twitter) {
        links.push({
            "icon": '<i class="fa-brands fa-x-twitter"></i>',
            "title": translate("app.discover.view.twitter"),
            "func": (e) => {
                window.enderlynx.openInBrowser(content.links.twitter);
            }
        })
    }
    if (content.links.bluesky) {
        links.push({
            "icon": '<i class="fa-brands fa-bluesky"></i>',
            "title": translate("app.discover.view.bluesky"),
            "func": (e) => {
                window.enderlynx.openInBrowser(content.links.bluesky);
            }
        })
    }
    if (content.links.mastodon) {
        links.push({
            "icon": '<i class="fa-brands fa-mastodon"></i>',
            "title": translate("app.discover.view.mastodon"),
            "func": (e) => {
                window.enderlynx.openInBrowser(content.links.mastodon);
            }
        })
    }
    if (content.links.instagram) {
        links.push({
            "icon": '<i class="fa-brands fa-instagram"></i>',
            "title": translate("app.discover.view.instagram"),
            "func": (e) => {
                window.enderlynx.openInBrowser(content.links.instagram);
            }
        })
    }
    if (content.links.youtube) {
        links.push({
            "icon": '<i class="fa-brands fa-youtube"></i>',
            "title": translate("app.discover.view.youtube"),
            "func": (e) => {
                window.enderlynx.openInBrowser(content.links.youtube);
            }
        })
    }
    if (content.links.reddit) {
        links.push({
            "icon": '<i class="fa-brands fa-reddit"></i>',
            "title": translate("app.discover.view.reddit"),
            "func": (e) => {
                window.enderlynx.openInBrowser(content.links.reddit);
            }
        })
    }
    if (content.links.facebook) {
        links.push({
            "icon": '<i class="fa-brands fa-facebook"></i>',
            "title": translate("app.discover.view.facebook"),
            "func": (e) => {
                window.enderlynx.openInBrowser(content.links.facebook);
            }
        })
    }
    if (content.links.twitch) {
        links.push({
            "icon": '<i class="fa-brands fa-twitch"></i>',
            "title": translate("app.discover.view.twitch"),
            "func": (e) => {
                window.enderlynx.openInBrowser(content.links.twitch);
            }
        })
    }
    if (content.links.tiktok) {
        links.push({
            "icon": '<i class="fa-brands fa-tiktok"></i>',
            "title": translate("app.discover.view.tiktok"),
            "func": (e) => {
                window.enderlynx.openInBrowser(content.links.tiktok);
            }
        })
    }
    if (content.links.pinterest) {
        links.push({
            "icon": '<i class="fa-brands fa-pinterest"></i>',
            "title": translate("app.discover.view.pinterest"),
            "func": (e) => {
                window.enderlynx.openInBrowser(content.links.pinterest);
            }
        })
    }
    if (content.links.github) {
        links.push({
            "icon": '<i class="fa-brands fa-github"></i>',
            "title": translate("app.discover.view.github"),
            "func": (e) => {
                window.enderlynx.openInBrowser(content.links.github);
            }
        })
    }
    if (content.links.patreon) {
        links.push({
            "icon": '<i class="fa-brands fa-patreon"></i>',
            "title": translate("app.discover.view.patreon"),
            "func": (e) => {
                window.enderlynx.openInBrowser(content.links.patreon);
            }
        })
    }
    if (content.links.donations) {
        content.links.donations.forEach(e => {
            links.push({
                "icon": '<i class="fa-solid fa-hand-holding-dollar"></i>',
                "title": e.platform == "other" ? translate("app.discover.donate") : translate("app.discover.donate.platform", "%p", translate("app.discover.donate." + e.platform)),
                "func": () => {
                    window.enderlynx.openInBrowser(e.url);
                }
            })
        });
    }
    let buttons = new ContextMenuButtons([
        {
            "icon": '<i class="fa-solid fa-arrow-up-right-from-square"></i>',
            "title": translate("app.discover.open_in_browser"),
            "func": (e) => {
                window.enderlynx.openInBrowser(content.links.browser);
            }
        }
    ].concat(links));
    let moreMenu = new MoreMenu(threeDots, buttons);
    if (allow_downloads && ((content.project_type != "modpack" && content.project_type != "server") || !instance_id)) topBar.appendChild(installButton);
    else threeDots.style.marginLeft = "auto";
    topBar.appendChild(threeDots);
    topBar.appendChild(moreMenu.element);
    contentWrapper.appendChild(topBar);

    if (content.project_type == "server") {
        let addressWrapper = document.createElement("div");
        addressWrapper.className = "server-address";
        let address = document.createElement("span");
        address.innerHTML = content.ip_address;
        address.className = "server-address-text";
        addressWrapper.appendChild(address);
        let serverCopy = document.createElement("div");
        serverCopy.className = "server-address-copy";
        serverCopy.innerHTML = '<i class="fa-solid fa-copy"></i>';
        addressWrapper.appendChild(serverCopy);
        addressWrapper.title = translate("app.discover.server.copy");
        addressWrapper.onclick = async () => {
            let success = await window.enderlynx.copyToClipboard(content.ip_address);
            if (success) {
                displaySuccess(translate("app.discover.server.copy.success"));
            } else {
                displayError(translate("app.discover.server.copy.fail"));
            }
            serverCopy.innerHTML = '<i class="fa-solid fa-check"></i>';
            setTimeout(() => {
                serverCopy.innerHTML = '<i class="fa-solid fa-copy"></i>';
            }, 2000);
        }
        contentWrapper.appendChild(addressWrapper);
    }

    let tabsElement = document.createElement("div");
    contentWrapper.appendChild(tabsElement);
    let tabContent = document.createElement("div");
    tabContent.className = "tab-info";
    tabContent.style.padding = "10px";
    tabContent.style.paddingTop = "0px";
    contentWrapper.appendChild(tabContent);
    contentInfo.showModal();
    tabsElement.style.marginInline = "auto";
    let descriptionElement = document.createElement("div");
    descriptionElement.className = "markdown-body";
    descriptionElement.style.maxWidth = "800px";
    descriptionElement.style.marginInline = "auto";
    let descriptionElementFilled = false;
    let tabs = new TabContent(tabsElement, [
        {
            "name": translate("app.discover.tabs.description"),
            "value": "description",
            "func": () => {
                tabContent.innerHTML = "";
                tabContent.appendChild(descriptionElement);
                if (!descriptionElementFilled) {
                    descriptionElement.setHTMLUnsafe(content.uses_markdown_description ? parseModrinthMarkdown(content.description) : content.description, { sanitizer: superSanitizer });
                    descriptionElement.innerHTML = descriptionElement.innerHTML; // TODO: Remove when Chromium fixes Sanitizer bug with <details>
                    afterMarkdownParse(instance_id, vanilla_version, loader, dialogContextMenu, locked, content_list_to_update);
                    descriptionElementFilled = true;
                }
            }
        },
        {
            "name": translate("app.discover.tabs.files"),
            "value": "files",
            "func": async () => {
                tabContent.innerHTML = "";
                let topFilters = createElement("div", "version-file-filters");
                let mcVersionFilter = createElement("div");
                let allGameVersions = Array.from(new Set(content.game_versions));
                if (Array.isArray(minecraftVersions) && minecraftVersions.length > 0) {
                    sortByVersion(allGameVersions, true);
                }
                let versionDropdown = new SearchDropdown(
                    translate("app.discover.game_version"),
                    [{ "name": translate("app.discover.game_version.all"), "value": "all" }].concat(
                        allGameVersions.map(e => ({ "name": e, "value": e }))
                    ),
                    mcVersionFilter,
                    vanilla_version ? vanilla_version : "all",
                    (v) => {
                        filterVersions(v, loaderDropdown.value, 1);
                    }
                );
                let mcLoaderFilter = createElement("div");
                let allLoaders = Array.from(new Set(content.loaders));
                let loaderDropdown = new Dropdown(
                    translate("app.discover.loader"),
                    [{
                        "name": translate("app.discover.loader.all"),
                        "value": "all"
                    }].concat(allLoaders.map(e => ({ "name": translate("app.loader." + e), "value": e }))),
                    mcLoaderFilter, loader ? loader : "all", (v) => {
                        filterVersions(versionDropdown.value, v, 1);
                    });

                let pagination = new Pagination(1, 0, (new_page) => {
                    filterVersions(versionDropdown.value, loaderDropdown.value, new_page);
                });
                topFilters.appendChild(mcVersionFilter);
                if (["modpack", "mod", "server"].includes(content.project_type)) topFilters.appendChild(mcLoaderFilter);
                pagination.element.style.gridColumn = "-1";
                topFilters.appendChild(pagination.element);
                tabContent.appendChild(topFilters);
                let wrapper = createElement("div", "version-files-wrapper");
                let topBar = createElement("div", "version-file-top");
                let noLoaderProjectTypes = ["resourcepack", "world", "resourcepack"];
                let removeLoaders = noLoaderProjectTypes.includes(content.project_type);
                let names = ["", translate("app.discover.files.name"), translate("app.discover.files.versions"), translate("app.discover.files.loaders"), translate("app.discover.files.date_published"), translate("app.discover.files.download_count"), "", ""];
                if (removeLoaders) {
                    names[3] = "";
                }
                names.forEach((e, i) => {
                    let element = document.createElement("div");
                    element.className = "version-file-column-name";
                    element.innerHTML = e;
                    topBar.appendChild(element);
                });

                let notfound = new NoResultsFound();
                notfound.element.style.gridColumn = "span 8";
                notfound.element.style.display = "none";
                notfound.element.style.backgroundColor = "var(--color-1)";

                let versions = [];

                let filterVersions = async (version, loader_, new_page) => {
                    let loading = new LoadingContainer();
                    loading.element.style.gridColumn = "span 8";
                    loading.element.style.backgroundColor = "var(--color-1)";
                    wrapper.innerHTML = "";
                    wrapper.appendChild(loading.element);
                    pagination.setPage(new_page);
                    try {
                        let info = await content.getVersions(loader_, version, content.project_type, new_page, content.id, content.source);
                        versions = info.versions;
                        showVersions();
                        pagination.setTotalPages(Math.ceil(info.total / 25));
                        if (info.total == 0) {
                            notfound.element.style.display = "";
                            topBar.style.display = "none";
                        } else {
                            notfound.element.style.display = "none";
                            topBar.style.display = "grid";
                        }
                    } catch (err) {
                        loading.errorOut(err, () => {
                            filterVersions(version, loader_, new_page);
                        });
                    }
                }

                let showVersions = () => {
                    currentlyInstalling = false;
                    wrapper.innerHTML = "";
                    wrapper.appendChild(topBar);
                    wrapper.appendChild(notfound.element);
                    versions.forEach((e, i) => {
                        let versionEle = document.createElement("div");
                        versionEle.className = "version-file";

                        // Channel
                        let channelEle = document.createElement("div");
                        channelEle.className = "version-file-channel";
                        channelEle.innerHTML = e.channel.toUpperCase()[0];
                        if (e.channel.toUpperCase()[0] == "R") {
                            channelEle.style.setProperty("--channel-color", "var(--go-color)");
                        } else if (e.channel.toUpperCase()[0] == "B") {
                            channelEle.style.setProperty("--channel-color", "yellow");
                        } else if (e.channel.toUpperCase()[0] == "A") {
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
                        nameName.innerHTML = e.display_name;
                        nameDesc.innerHTML = e.sub_name;
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
                                dialog.showDialog(translate(`app.discover.files.versions.title`, "%t", e.name), "notice", tagWrapperForDialog, [
                                    {
                                        "type": "cancel",
                                        "content": translate("app.discover.files.versions.done")
                                    }
                                ], [], () => { });
                            }
                            tagWrapper.appendChild(tag);
                        }
                        if (removeLoaders) {
                            tagWrapper.style.gridColumn = "span 2";
                        }
                        versionEle.appendChild(tagWrapper);

                        //Loaders
                        let tagWrapper2 = document.createElement("div");
                        tagWrapper2.className = "version-file-chip-wrapper";
                        e.loaders.forEach(i => {
                            let tag = document.createElement("div");
                            tag.className = "version-file-chip";
                            tag.textContent = translate("app.loader." + i);
                            tagWrapper2.appendChild(tag);
                        });
                        if (!removeLoaders) versionEle.appendChild(tagWrapper2);

                        //Published
                        let published = document.createElement("div");
                        published.className = "version-file-text";
                        published.textContent = formatDate(e.published);
                        versionEle.appendChild(published);

                        //Downloads
                        let downloads = document.createElement("div");
                        downloads.className = "version-file-text";
                        downloads.textContent = formatNumber(e.downloads);
                        versionEle.appendChild(downloads);

                        // Install Button
                        let installButton = document.createElement("button");
                        installButton.className = "version-file-install"
                        DiscoverStateManagement.registerButton(content.id, e.version_id, installButton, content, e, instance, content_list_to_update, locked);
                        if (allow_downloads) versionEle.appendChild(installButton);
                        else versionEle.appendChild(createElement("div"));

                        // Changelog Button
                        let changeLogButton = document.createElement("button");
                        changeLogButton.className = "version-file-changelog";
                        changeLogButton.innerHTML = '<i class="fa-solid fa-book"></i>';
                        changeLogButton.setAttribute("title", translate("app.discover.changelog.tooltip"));
                        changeLogButton.onclick = () => {
                            let dialog = new Dialog();
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
                            e.getChangelog((v) => {
                                if (e.uses_markdown_description) {
                                    element.innerHTML = parseModrinthMarkdown(v) || translate("app.discover.no_changelog");
                                } else {
                                    element.innerHTML = v || translate("app.discover.no_changelog");
                                }
                                afterMarkdownParse();
                            }, (err) => {
                                loader.errorOut(err, () => {
                                    dialog.closeDialog();
                                    changeLogButton.click();
                                });
                            });
                        }
                        versionEle.appendChild(changeLogButton);

                        // Dependency Button
                        let dependencyButton = document.createElement("button");
                        dependencyButton.className = "version-file-dependency";
                        dependencyButton.innerHTML = '<i class="fa-solid fa-list-ul"></i>';
                        dependencyButton.setAttribute("title", translate("app.discover.dependency.tooltip"));
                        dependencyButton.onclick = () => {
                            let dialog = new Dialog();
                            let element = document.createElement('div');
                            element.className = "dependency-list";
                            let loader = new LoadingContainer();
                            element.appendChild(loader.element);
                            dialog.showDialog(translate("app.discover.dependency.title", "%v", e.name), "notice", element, [
                                {
                                    "type": "confirm",
                                    "content": translate("app.discover.dependency.done")
                                }
                            ], [], () => { }, () => { });
                            e.getDependencies((v) => {
                                element.innerHTML = "";
                                v.sort((a, b) => {
                                    return (a?.project?.name || a.file_name).localeCompare(b?.project?.name || b.file_name);
                                });
                                for (let i = 0; i < v.length; i++) {
                                    let info = v[i];
                                    let dependencyElement = createElement(info.project ? "button" : "div", "dependency");
                                    let imageElement = createElement("img", "dependency-image");
                                    imageElement.src = info?.project?.icon || getDefaultImage(info?.project?.name || info.file_name);
                                    let infoElement = createElement("div", "dependency-info");
                                    let titleElement = createElement("div", "dependency-title");
                                    titleElement.textContent = info?.project?.name || info.file_name;
                                    let subElement = createElement("div", "dependency-sub");
                                    subElement.textContent = info.version ? translate(`app.discover.dependency.${info.type}.version`, "%v", info.file_name || info.version.version_number || info.version.name || info.version.version_id) : translate(`app.discover.dependency.${info.type}`);
                                    infoElement.appendChild(titleElement);
                                    infoElement.appendChild(subElement);
                                    dependencyElement.appendChild(imageElement);
                                    dependencyElement.appendChild(infoElement);
                                    element.appendChild(dependencyElement);
                                    if (info.project) {
                                        dependencyElement.onclick = () => {
                                            dialog.closeDialog();
                                            displayContentInfo(info.project.source, info.project, info.project.id);
                                        }
                                    }
                                }
                                if (v.length == 0) {
                                    element.textContent = translate("app.discover.dependency.no_dependencies");
                                }
                            }, (err) => {
                                loader.errorOut(err, () => {
                                    dialog.closeDialog();
                                    dependencyButton.click();
                                });
                            });
                        }
                        versionEle.appendChild(dependencyButton);

                        wrapper.appendChild(versionEle);
                    });
                }

                filterVersions(versionDropdown.value, loaderDropdown.value, 1);

                tabContent.appendChild(wrapper);
            }
        },
        content.authors.length ? {
            "name": content.authors.length == 1 ? translate("app.discover.tabs.author") : translate("app.discover.tabs.authors"),
            "value": "authors",
            "func": () => {
                tabContent.style.paddingTop = "0";
                tabContent.innerHTML = "";
                let wrapper = createElement("div", "authors-wrapper");
                let authors = createElement("div", "authors");
                let authorFullInfo = createElement("div", "author-full-info");
                let currentlySelectedAuthor = null;
                for (let e of content.authors) {
                    if (e.organization) e.role = translate("app.discover.authors.organization");
                    let author = createElement("button", "author");
                    let authorImg = createElement("img", "author-image");
                    authorImg.src = e.avatar || getDefaultImage(e.name);
                    let authorInfo = createElement("div", "author-info");
                    let authorTitle = createElement("div", "author-name");
                    authorTitle.textContent = e.name;
                    let authorRole = createElement("div", "author-role");
                    authorRole.textContent = e.role;
                    authorInfo.appendChild(authorTitle);
                    authorInfo.appendChild(authorRole);
                    author.appendChild(authorImg);
                    author.appendChild(authorInfo);
                    let buttons = new ContextMenuButtons([
                        {
                            "icon": '<i class="fa-solid fa-arrow-up-right-from-square"></i>',
                            "title": translate("app.discover.author.open_in_browser"),
                            "func": () => {
                                window.enderlynx.openInBrowser(e.url);
                            }
                        },
                        {
                            "icon": '<i class="fa-solid fa-copy"></i>',
                            "title": translate("app.discover.author.copy_user_id"),
                            "func": async () => {
                                let success = await window.enderlynx.copyToClipboard(e.id);
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
                    let requestFrame = () => {
                        return new Promise((resolve) => {
                            requestAnimationFrame(() => {
                                resolve();
                            });
                        });
                    }
                    author.onclick = async () => {
                        if (currentlySelectedAuthor == e.id) {
                            authorFullInfo.remove();
                            currentlySelectedAuthor = null;
                            return;
                        }
                        currentlySelectedAuthor = e.id;
                        let loaderContainer = new LoadingContainer();
                        wrapper.appendChild(authorFullInfo);
                        loaderContainer.element.style.flexGrow = "0";
                        authorFullInfo.innerHTML = '';
                        authorFullInfo.appendChild(loaderContainer.element);
                        requestFrame();
                        try {
                            await e.getAuthorInformation();
                        } catch (e) {
                            loaderContainer.errorOut(e);
                            return;
                        }
                        let authorTop = createElement("div", "author-top");
                        let authorImg = createElement("img", "author-top-image", { src: e.avatar || getDefaultImage(e.name) });
                        let authorInfo = createElement("div", "author-top-info");
                        let authorName = createElement("span", "author-top-name", { textContent: e.name });
                        let authorBio = createElement("span", "author-top-bio", { textContent: e.bio });
                        let authorSubInfo = createElement("div", "author-top-sub-info");
                        let authorSubInfoProjects = createElement("div", "author-top-sub-info-specific");
                        authorSubInfoProjects.innerHTML = `<i class="fa-solid fa-boxes-stacked"></i>${e.total_projects == 1 ? translate("app.discover.projects.singular") : translate("app.discover.projects", "%n", formatNumber(e.total_projects))}`;
                        let authorSubInfoDownloads = createElement("div", "author-top-sub-info-specific");
                        authorSubInfoDownloads.innerHTML = `<i class="fa-solid fa-download"></i>${translate("app.discover.download_count", "%d", formatNumber(e.downloads))}`;
                        let authorSubInfoCreated = createElement("div", "author-top-sub-info-specific");
                        authorSubInfoCreated.innerHTML = `<i class="fa-solid fa-calendar-days"></i>${formatTimeRelatively(e.created)}`;
                        authorSubInfoCreated.setAttribute("title", translate("app.discover.created", "%d", formatDate(e.created)));
                        if (e.total_projects) authorSubInfo.appendChild(authorSubInfoProjects);
                        authorSubInfo.appendChild(authorSubInfoDownloads);
                        if (e.created) authorSubInfo.appendChild(authorSubInfoCreated);
                        authorInfo.appendChild(authorName);
                        authorInfo.appendChild(authorBio);
                        authorInfo.appendChild(authorSubInfo);
                        authorTop.appendChild(authorImg);
                        authorTop.appendChild(authorInfo);
                        let more = createElement("button", "author-top-more");
                        more.innerHTML = '<i class="fa-solid fa-ellipsis-vertical"></i>';
                        let moreMenu = new MoreMenu(more, buttons);
                        authorTop.appendChild(more);
                        authorTop.appendChild(moreMenu.element);
                        authorFullInfo.innerHTML = '';
                        authorFullInfo.appendChild(authorTop);
                        let authorContentList = createElement("div", "author-content-list");
                        authorFullInfo.appendChild(authorContentList);
                        let setPage = async (page) => {
                            let loaderContainer = new LoadingContainer();
                            authorContentList.innerHTML = '';
                            authorContentList.appendChild(loaderContainer.element);
                            requestFrame();
                            let projects = [];
                            try {
                                projects = await e.getProjects(page);
                            } catch (e) {
                                loaderContainer.errorOut(e);
                                return;
                            }
                            paginationTop.setPage(page);
                            paginationBottom.setPage(page);
                            paginationTop.setTotalPages(Math.ceil(e.total_projects / 20));
                            paginationBottom.setTotalPages(Math.ceil(e.total_projects / 20));
                            authorSubInfoProjects.innerHTML = `<i class="fa-solid fa-boxes-stacked"></i>${e.total_projects == 1 ? translate("app.discover.projects.singular") : translate("app.discover.projects", "%n", formatNumber(e.total_projects))}`;
                            authorSubInfo.prepend(authorSubInfoProjects);
                            authorContentList.innerHTML = '';
                            authorContentList.appendChild(paginationTop.element);
                            for (let project of projects) {
                                let entry = new ContentSearchEntry(project, instance, vanilla_version, loader, false, project.project_type, false);
                                authorContentList.appendChild(entry.element);
                            }
                            authorContentList.appendChild(paginationBottom.element);
                        }
                        let paginationTop = new Pagination(1, 0, setPage);
                        let paginationBottom = new Pagination(1, 0, setPage);
                        setPage(1);
                    }
                    authors.appendChild(author);
                }
                wrapper.appendChild(authors);
                if (content.authors.length == 1) {
                    authors.children[0].click();
                }
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
                    screenshotElement.setAttribute("data-title", e.name || translate("app.discover.gallery.untitled"));
                    screenshotElement.style.backgroundImage = `url("${e.thumbnail_url}")`;
                    let screenshotInformation = content.gallery.map(e => ({ "name": e.name || translate("app.discover.gallery.untitled"), "file": e.url, "desc": e.description }));
                    screenshotElement.onclick = () => {
                        displayScreenshot(e.name || translate("app.discover.gallery.untitled"), e.description, e.url, null, null, screenshotInformation, screenshotInformation.map(e => e.file).indexOf(e.url), translate("app.discover.gallery.image"));
                    }
                    let buttons = new ContextMenuButtons([
                        {
                            "icon": '<i class="fa-solid fa-copy"></i>',
                            "title": translate("app.discover.gallery.image.copy"),
                            "func": async () => {
                                let success = await window.enderlynx.copyImageToClipboard(e.url);
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
                                openShareDialog(translate("app.discover.gallery.image.share.title"), e.url, translate("app.discover.gallery.image.share.text"))
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
    tabs.selectOption(tab);

    document.getElementsByClassName("toasts")[0].hidePopover();
    document.getElementsByClassName("toasts")[0].showPopover();
}

function parseModrinthMarkdown(md) {
    return window.enderlynx.parseMarkdown(md);
}

function afterMarkdownParse(instance_id, vanilla_version, loader, dialogContextMenu, locked, content_list_to_update) {
    document.querySelectorAll('.markdown-body *[class]').forEach((el) => {
        if (el.classList.contains("spoiler")) {
            let newElement = createElement("details");
            let summaryElement = createElement("summary");
            summaryElement.textContent = translate("app.discover.show_spoiler");
            newElement.appendChild(summaryElement);
            newElement.innerHTML += el.innerHTML;
            el.replaceWith(newElement);
            return;
        }
        el.className = "";
    });
    document.querySelectorAll('.markdown-body img').forEach((el) => {
        let src = el.getAttribute('src');
        if (!src) return;
        let buttons = new ContextMenuButtons([
            {
                "title": translate("app.discover.open_in_browser"),
                "icon": '<i class="fa-solid fa-arrow-up-right-from-square"></i>',
                "func": () => {
                    window.enderlynx.openInBrowser(src);
                }
            },
            {
                "title": translate("app.discover.copy_image"),
                "icon": '<i class="fa-solid fa-copy"></i>',
                "func": async () => {
                    let success = await window.enderlynx.copyImageToClipboard(src);
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
                    let success = await window.enderlynx.copyToClipboard(src);
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
        let url = el.getAttribute('href');
        el.removeAttribute('href');
        el.setAttribute("tabindex", "0");
        let buttons = new ContextMenuButtons([
            {
                "title": translate("app.discover.open_in_browser"),
                "icon": '<i class="fa-solid fa-arrow-up-right-from-square"></i>',
                "func": () => {
                    window.enderlynx.openInBrowser(url);
                }
            },
            {
                "title": translate("app.discover.copy"),
                "icon": '<i class="fa-solid fa-copy"></i>',
                "func": async () => {
                    let success = await window.enderlynx.copyToClipboard(url);
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
            if (url[0] == "#") return;
            try {
                let url_obj = new URL(url);
                if (url_obj.searchParams.get("remoteUrl")) {
                    url = decodeURIComponent(url_obj.searchParams.get("remoteUrl"));
                    url_obj = new URL(url);
                }

                if (dialogContextMenu && (url_obj.hostname == "modrinth.com" || url_obj.hostname == "www.modrinth.com")) {
                    let pathParts = url_obj.pathname.split('/').filter(Boolean);
                    let customVersion = url_obj.searchParams.getAll("g").length > 1 ? "all" : url_obj.searchParams.get("g");
                    let customLoader = url_obj.searchParams.getAll("l").length > 1 ? "all" : url_obj.searchParams.get("l");
                    if (pathParts.length >= 2) {
                        let pageType = pathParts[0];
                        let pageId = pathParts[1];
                        if (["mod", "datapack", "resourcepack", "shader", "modpack", "project", "server"].includes(pageType)) {
                            el.setAttribute('title', url);
                            el.addEventListener('click', (e) => {
                                e.preventDefault();
                                displayContentInfo("modrinth", undefined, pageId, instance_id, customVersion ?? vanilla_version, pageType == "datapack" ? "datapack" : customLoader ?? (loader == "datapack" ? "" : loader), locked, false, content_list_to_update, pathParts[2] == "versions" ? "files" : undefined);
                            });
                            el.addEventListener('keydown', (e) => {
                                if (e.key == "Enter" || e.key == " ") {
                                    e.preventDefault();
                                    displayContentInfo("modrinth", undefined, pageId, instance_id, customVersion ?? vanilla_version, pageType == "datapack" ? "datapack" : customLoader ?? (loader == "datapack" ? "" : loader), locked, false, content_list_to_update, pathParts[2] == "versions" ? "files" : undefined);
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
                    let customVersion = url_obj.searchParams.get("version");
                    let customLoaderId = url_obj.searchParams.get("gameVersionTypeId");
                    let customLoader = Project.curseforge_mod_loader_conversion[customLoaderId] || null;
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
                                displayContentInfo("curseforge", undefined, pageId + ":" + map[pageType], instance_id, customVersion ?? vanilla_version, customLoader ?? (loader == "datapack" ? "" : loader), locked, false, content_list_to_update, pathParts[3] == "files" ? "files" : undefined);
                            });
                            el.addEventListener('keydown', (e) => {
                                if (e.key == "Enter" || e.key == " ") {
                                    e.preventDefault();
                                    displayContentInfo("curseforge", undefined, pageId + ":" + map[pageType], instance_id, customVersion ?? vanilla_version, customLoader ?? (loader == "datapack" ? "" : loader), locked, false, content_list_to_update, pathParts[3] == "files" ? "files" : undefined);
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
                window.enderlynx.openInBrowser(url);
            });
            el.addEventListener('keydown', (e) => {
                if (e.key == "Enter" || e.key == " ") {
                    e.preventDefault();
                    window.enderlynx.openInBrowser(url);
                }
            });
            if (!dialogContextMenu) return;
            el.oncontextmenu = (e) => {
                dialogContextMenu.showContextMenu(buttons, e.clientX, e.clientY);
            }
        }
    });
}

function showTooltip(target) {
    let tooltip = document.getElementById("tooltip");
    if (!tooltip) return;
    while (target && target !== document.body) {
        if (target.hasAttribute && (target.hasAttribute("title") || target.hasAttribute("data-tooltip-title"))) {
            let title = target.getAttribute("title") || target.getAttribute("data-tooltip-title");
            if (target.hasAttribute("title")) {
                target.setAttribute("data-tooltip-title", title);
                target.removeAttribute("title");
            }
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
}

function hideTooltip(target) {
    let tooltip = document.getElementById("tooltip");
    if (!tooltip) return;
    tooltip.hidePopover();
    while (target && target !== document.body) {
        if (target.hasAttribute && target.hasAttribute("data-tooltip-title") && !target.hasAttribute("title")) {
            target.setAttribute("title", target.getAttribute("data-tooltip-title"));
            target.removeAttribute("data-tooltip-title");
        }
        target = target.parentElement;
    }
}

document.addEventListener("mouseover", function (e) {
    showTooltip(e.target);
});

document.addEventListener("mouseout", function (e) {
    hideTooltip(e.target);
});

document.addEventListener("focusin", function (e) {
    showTooltip(e.target);
});

document.addEventListener("focusout", function (e) {
    hideTooltip(e.target);
});

document.addEventListener("scroll", function (e) {
    hideTooltip();
    contextmenu.hideContextMenu();
}, true);

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
        let success = await window.enderlynx.copyToClipboard(file_path);
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
                window.enderlynx.saveToDisk(file_path);
            },
            "tooltip": translate("app.share.save")
        },
        {
            "icon": '<i class="fa-solid fa-folder"></i>',
            "func": () => {
                window.enderlynx.showFileInFolder(file_path);
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
    let qrCodeUrl = await window.enderlynx.generateQRCode(url);
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
        let success = await window.enderlynx.copyToClipboard(url);
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
                window.enderlynx.openInBrowser(`mailto:example@example.com?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text + " " + url)}`)
            },
            "tooltip": translate("app.share.email")
        },
        {
            "icon": '<i class="fa-solid fa-globe"></i>',
            "func": () => {
                window.enderlynx.openInBrowser(url);
            },
            "tooltip": translate("app.share.browser")
        },
        {
            "icon": '<i class="fa-brands fa-x-twitter"></i>',
            "func": () => {
                window.enderlynx.openInBrowser(`https://twitter.com/intent/tweet?text=${encodeURIComponent(title + "\n\n" + text + " " + url)}`)
            },
            "tooltip": translate("app.share.x")
        },
        {
            "icon": '<i class="fa-brands fa-bluesky"></i>',
            "func": () => {
                window.enderlynx.openInBrowser(`https://bsky.app/intent/compose?text=${encodeURIComponent(text + " " + url)}`)
            },
            "tooltip": translate("app.share.bluesky")
        },
        {
            "icon": '<i class="fa-brands fa-mastodon"></i>',
            "func": () => {
                window.enderlynx.openInBrowser(`https://tootpick.org/#text=${encodeURIComponent(title + "\n\n" + text + " " + url)}`)
            },
            "tooltip": translate("app.share.mastodon")
        },
        {
            "icon": '<i class="fa-brands fa-reddit"></i>',
            "func": () => {
                window.enderlynx.openInBrowser(`https://www.reddit.com/submit?title=${encodeURIComponent(title)}&url=${encodeURIComponent(url)}`)
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
    let results = [];
    if (type == "server") {
        for (let i = 0; i < version_ids.length; i++) {
            results.push(false);
        }
        return results;
    }
    if (source == "modrinth") {
        let project = new Project();
        await project.getAllVersions(project_id, source);
        for (let i = 0; i < version_ids.length; i++) {
            let version_id = version_ids[i];
            for (let j = 0; j < project.versions.length; j++) {
                let version = project.versions[j];
                if (version.game_versions.includes(game_versions[i]) && (type != "mod" || version.loaders.includes(loaders[i]))) {
                    if (version.version_id == version_id) {
                        results[i] = false;
                        break;
                    }
                    results[i] = version;
                    break;
                }
            }
        }
    } else if (source == "curseforge") {
        let page = 1;
        while (results.length != version_ids.length || results.includes(undefined)) {
            let info = await Project.getCurseForgeVersionPage(page, project_id);
            let versions = info.versions;
            for (let i = 0; i < version_ids.length; i++) {
                let version_id = version_ids[i];
                if (results[i]) continue;
                for (let j = 0; j < versions.length; j++) {
                    let version = versions[j];
                    if (version.game_versions.includes(game_versions[i]) && (type != "mod" || version.loaders.includes(loaders[i]))) {
                        if (version.version_id == version_id) {
                            results[i] = false;
                            break;
                        }
                        results[i] = version;
                        break;
                    }
                }
            }
            if (page >= info.max_pages) break;
            page++;
        }
    }
    return results;
}

async function updateContent(source, content, project, version, instance) {
    if (source == "player_install") return;
    if (!version) version = await project.getVersion(instance.loader, instance.vanilla_version, content.type, content.source_info, content.source);
    if (!version) {
        let new_file_name = await window.enderlynx.disableFile(instance.instance_id, content.type == "mod" ? "mods" : content.type == "resourcepack" ? "resourcepacks" : "shaderpacks", content.file_name);
        if (!new_file_name) {
            displayError(translate("app.error.failure_to_disable"));
            return false;
        }
        await content.setDisabled(true);
        await content.setFileName(new_file_name);
        displayError(translate("app.content.update.failed", "%c", content.name));
        return false;
    }
    let initialContent = await installSpecificVersion(version, content.source, instance, content.type, content.name, content.author, content.image, content.source_info, true);
    let oldFileName = content.file_name;
    let oldVersion = content.version;
    let oldVersionId = content.version_id;

    await content.setFileName(initialContent.file_name);
    if (version.version_number) await content.setVersion(version.version_number);
    await content.setVersionId(version.version_id);

    if (content.disabled) {
        let new_file_name = await window.enderlynx.disableFile(instance.instance_id, content.type == "mod" ? "mods" : content.type == "resourcepack" ? "resourcepacks" : "shaderpacks", initialContent.file_name);
        if (!new_file_name) {
            displayError(translate("app.error.failure_to_disable"));
            await content.setDisabled(false);
            return false;
        }
        await content.setFileName(new_file_name);
    }

    if (oldFileName != content.file_name) {
        let success = await window.enderlynx.deleteContent(instance.instance_id, content.type, oldFileName);
        if (!success) {
            displayError(translate("app.content.update.old_file_fail", "%f", oldFileName));
            await content.setVersion(oldVersion);
            await content.setVersionId(oldVersionId);
            await content.setFileName(oldFileName);
            let success2 = await window.enderlynx.deleteContent(instance.instance_id, content.type, initialContent.file_name);
            if (!success2) {
                displayError(translate("app.content.update.new_file_fail", "%f", initialContent.file_name));
            }
        }
    }
}

function fixPathForImage(path) {
    return path.replaceAll(" ", "%20").replaceAll("#", "%23");
}

let plugin_loaders = ["folia", "spigot", "paper", "bungeecord", "purpur", "waterfall", "velocity", "bukkit", "sponge"];
async function installButtonClick(content, version, instance_id) {
    let count = 0;
    let project_type = version?.project_type || content.project_type;
    let source = content.source;
    let content_loaders = version?.loaders || content?.loaders || [];
    let icon = content.icon;
    let title = content.name;
    let game_versions = version?.game_versions || content?.game_versions || [];
    let project_id = content.id;
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
    if ((project_type == "datapack" && (content.source != "modrinth" || (content.source == "modrinth" && content_loaders.includes("datapack")))) || (content_loaders.length == 1 && content_loaders[0] == "datapack")) {
        let dialog = new Dialog();
        dialog.showDialog(translate("app.discover.datapacks.title"), "form", [
            instance_id ? null : {
                "type": "dropdown",
                "id": "instance",
                "name": translate("app.discover.datapacks.instance"),
                "options": (await getInstances()).map(e => ({ "name": e.name, "value": e.instance_id }))
            },
            {
                "type": "dropdown",
                "id": "world",
                "name": translate("app.discover.datapacks.world"),
                "options": instance_id ? (await Instance.getInstance(instance_id).getSingleplayerWorlds()).map(e => ({ "name": e.name, "value": e.id })) : [],
                "input_source": instance_id ? null : "instance",
                "source": instance_id ? null : async (i) => {
                    return (await Instance.getInstance(i).getSingleplayerWorlds()).map(e => ({ "name": e.name, "value": e.id }));
                }
            }
        ].filter(e => e), [
            { "content": translate("app.discover.datapacks.cancel"), "type": "cancel" },
            { "content": translate("app.discover.datapacks.confirm"), "type": "confirm" }
        ], [], async (info) => {
            let instance = instance_id ? instance_id : info.instance;
            let world = info.world;
            if (world == "loading" || world == "" || !world) {
                displayError(translate("app.discover.datapack.world", "%t", title));
                return;
            }
            await installContent(source, content, version, Instance.getInstance(instance), world);
        })
    } else if (project_type == "modpack" || (project_type == "server" && content.server_modpack?.kind == "modpack")) {
        let ip_address = content.ip_address;
        let server_name = content.name;
        let server_icon = content.icon;
        if (project_type == "server" && content.server_modpack?.project_id != content.id) {
            version = await ProjectVersion.getFromId(content.server_modpack.version_id, content.server_modpack.project_id, content.source);
            let project = new Project();
            await project.getInfoFromId(content.server_modpack.project_id, content.source);
            content = project;
            game_versions = version.game_versions;
            content_loaders = version.loaders;
            project_id = project.id;
        }
        let options = [];
        content_loaders.forEach((e) => {
            if (loaders[e]) {
                options.push({ "name": loaders[e], "value": e })
            }
        });
        let dialog = new Dialog();
        dialog.showDialog(translate("app.button.instances.create"), "form", [
            project_type == "server" ? {
                "type": "info",
                "content": translate("app.discover.server.modded.notice")
            } : null,
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
            {
                "type": "multi-select",
                "name": translate("app.instances.loader"),
                "id": "loader",
                "options": options
            },
            {
                "type": "dropdown",
                "name": translate("app.instances.game_version"),
                "id": "game_version",
                "options": sortByVersion(game_versions, true).map(e => ({ "name": e, "value": e }))
            },
            project_type == "server" ? {
                "type": "toggle",
                "name": translate("app.discover.server.modded.link"),
                "desc": translate("app.discover.server.modded.link.description"),
                "id": "link_to_server",
                "default": true
            } : null
        ].filter(e => e), [
            { "content": translate("app.instances.cancel"), "type": "cancel" },
            { "content": translate("app.instances.submit"), "type": "confirm" }
        ], [], async (info) => {
            contentInfo.close();
            let instance_id = await window.enderlynx.getInstanceFolderName(info.name);
            if (!version) version = await content.getVersion(info.loader, info.game_version, project_type, content.id, content.source);
            if (!version) {
                displayError(translate("app.discover.error_creating_modpack", "%t", title, "%v", info.game_version, "%l", loaders[info.loader]));
                return;
            }
            let instance = await addInstance(info.name, new Date(), new Date(), "", info.loader, info.game_version, "", true, true, 0, info.icon, instance_id, 0, source, project_id, true, false);
            await instance.setInstalledVersion(version.version_id);
            instance.display();
            try {
                await window.enderlynx.installModpack(version.download_url, source == "modrinth" ? "mr_url" : "cf_url", instance_id, title, version.sha1_hash);
            } catch (e) {
                displayError(translate("app.discover.error_downloading_modpack"));
                await instance.setFailed(true);
                await instance.setMcInstalled(true);
                return;
            }
            if (project_type == "server") {
                if (info.link_to_server) await instance.setSourceServer(ip_address);
                await instance.installContent("server", ip_address, null, server_name, server_icon);
            }
        })
    } else if (instance_id) {
        await installContent(source, content, version, Instance.getInstance(instance_id));
    } else {
        DiscoverStateManagement.setContentStatus(content.id, null, DiscoverState.LOADING);
        let dialog = new Dialog();
        let instances = await getInstances();
        if (project_type == "mod") {
            instances = instances.filter(e => content_loaders.includes(e.loader)).filter(e => game_versions.includes(e.vanilla_version));
        } else if (project_type == "shader") {
            instances = instances.filter(e => e.loader != "vanilla").filter(e => game_versions.includes(e.vanilla_version));
        } else {
            instances = instances.filter(e => game_versions.includes(e.vanilla_version));
        }
        let installGrid = document.createElement("div");
        installGrid.className = "install-grid";
        let contentOther = await window.enderlynx.getContentBySourceInfo(project_id);
        let instanceIdsWithContent = contentOther.map(e => e.instance);
        let instancesWithContent = [];
        for (let i = 0; i < instanceIdsWithContent.length; i++) {
            instancesWithContent.push(Instance.getInstance(instanceIdsWithContent[i]));
        }
        let updates = [];
        if (contentOther.length > 0 && !version) {
            try {
                updates = await checkForContentUpdates(source, project_id, contentOther.map(e => e.version_id), instancesWithContent.map(e => e.loader), instancesWithContent.map(e => e.vanilla_version), project_type);
            } catch (e) { }
        }

        let installGridEntry = document.createElement("div");
        installGridEntry.className = "install-grid-entry";

        let createNewButton = document.createElement("button");
        createNewButton.className = "install-grid-create";
        createNewButton.innerHTML = '<i class="fa-solid fa-plus"></i>' + translate("app.discover.select_instance.create");
        createNewButton.onclick = async () => {
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
                    "options": content_loaders?.length && project_type == "mod" ? (content_loaders?.filter(e => loaders[e]).map(e => ({ name: loaders[e], value: e })) || "vanilla") : [
                        project_type != "shader" ? { "name": loaders["vanilla"], "value": "vanilla" } : null,
                        { "name": loaders["fabric"], "value": "fabric" },
                        { "name": loaders["forge"], "value": "forge" },
                        { "name": loaders["neoforge"], "value": "neoforge" },
                        { "name": loaders["quilt"], "value": "quilt" }
                    ].filter(e => e),
                    "id": "loader"
                },
                {
                    "type": "dropdown",
                    "name": translate("app.instances.game_version"),
                    "id": "game_version",
                    "options": sortByVersion(game_versions, true).map(e => ({ name: e, value: e }))
                }
            ], [
                { "content": translate("app.instances.cancel"), "type": "cancel" },
                { "content": translate("app.instances.submit"), "type": "confirm" }
            ], [], async (info) => {
                dialog.closeDialog();
                contentInfo.close();
                if (info.game_version == "loading") {
                    displayError(translate("app.instances.no_game_version"));
                    return;
                }
                if (!info.name) {
                    info.name = translate("app.instances.untitled");
                }
                let instance_id = await window.enderlynx.getInstanceFolderName(info.name);
                let instance = await addInstance(info.name, new Date(), new Date(), "", info.loader, info.game_version, "", false, false, 0, info.icon, instance_id, 0, "custom", "", false, false);
                await instance.setInstalling(true);
                instance.display();
                await installContent(source, content, version, instance);
                await instance.setInstalling(false);
                await window.enderlynx.installMinecraft(instance_id, info.loader, info.game_version);
            });
        }

        installGridEntry.appendChild(createNewButton);
        installGrid.appendChild(installGridEntry);
        for (let i = 0; i < instances.length; i++) {
            if (instances[i].locked) continue;
            let contentForThisInstance = contentOther.filter(e => e.instance == instances[i].instance_id);

            let updatesIndex = instanceIdsWithContent.indexOf(instances[i].instance_id);

            let installGridEntry = document.createElement("div");
            installGridEntry.className = "install-grid-entry";

            let installGridInstance = document.createElement("div");
            installGridInstance.className = "install-grid-instance";

            let image = document.createElement("img");
            image.src = instances[i].image ? instances[i].image : getDefaultImage(instances[i].instance_id);
            image.className = "instance-image";
            image.onerror = () => {
                image.src = getDefaultImage(instances[i].instance_id);
            }

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
            if (!version && updatesIndex != -1 && updates[updatesIndex]) {
                DiscoverStateManagement.registerButton(content.id, updates[updatesIndex]?.version_id, installButton, content, updates[updatesIndex], instances[i], undefined, false, true);
            } else {
                DiscoverStateManagement.registerButton(content.id, version?.version_id, installButton, content, version, instances[i], undefined, false, false);
            }

            installGridEntry.appendChild(installGridInstance);
            installGridEntry.appendChild(installButton);

            installGrid.appendChild(installGridEntry);
        }
        dialog.showDialog(translate("app.discover.select_instance.title", "%t", title), "notice", installGrid, [
            { "content": translate("app.discover.select_instance.confirm"), "type": "confirm" }
        ], null, () => { });
        DiscoverStateManagement.setContentStatus(content.id, null, DiscoverState.NOT_INSTALLED);
    }
}

async function runModpackUpdate(instanceInfo, source, version) {
    closeAllDialogs();
    await instanceInfo.setInstalling(true);
    await instanceInfo.setMcInstalled(false);
    await instanceInfo.setFailed(false);
    await window.enderlynx.deleteFoldersForModpackUpdate(instanceInfo.instance_id);
    await instanceInfo.clearContent();
    await instanceInfo.setInstalledVersion(version.version_id);
    try {
        await window.enderlynx.installModpack(version.download_url, source == "modrinth" ? "mr_url" : "cf_url", instanceInfo.instance_id, instanceInfo.name, version.sha1_hash);
    } catch (e) {
        displayError(translate("app.discover.error_downloading_modpack"));
        await instanceInfo.setFailed(true);
        await instanceInfo.setMcInstalled(true);
        return;
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
        let result = await window.enderlynx.checkForUpdates();
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
                    window.enderlynx.openInBrowser(result.browser_url);
                    return;
                }
                try {
                    await window.enderlynx.downloadUpdate(result.download_url, result.new_version, result.checksum);
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
                    window.enderlynx.updateEnderLynx();
                });
            });
        }
    } catch (e) {
        if (isManual) displayError(translate("app.settings.updates.error"));
    }
}

checkForUpdates();

async function createElPack(instance, content_list, overrides, pack_version) {
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
    window.enderlynx.createElPack(instance.instance_id, instance.name, manifest, overrides);
}
async function createMrPack(instance, content_list, overrides, pack_version) {
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
        let content_folder = e.type == "mod" ? "mods" : e.type == "resourcepack" ? "resourcepacks" : "shaderpacks";
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
    window.enderlynx.createMrPack(instance.instance_id, instance.name, manifest, overrides);
}
async function createCfZip(instance, content_list, overrides, pack_version) {
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
    window.enderlynx.createCfZip(instance.instance_id, instance.name, manifest, overrides);
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
        let instance_id = await window.enderlynx.getInstanceFolderName(info.name);
        let instance = await addInstance(info.name, new Date(), new Date(), "", info.loader, info.game_version, info.loader_version, false, true, 0, info.image, instance_id, 0, "", "", true, false);
        instance.display();
        await window.enderlynx.installModpack(file_path, "file", instance_id, info.name, null);
    });
}

let importInstanceFromContentProvider = (info) => {
    installButtonClick(info);
}

window.enderlynx.onOpenFile(importInstance);

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

document.body.ondrop = async (e) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    [...document.getElementsByClassName("drop-overlay")].forEach(e => e.classList.remove("shown"));
    let overlay = activeOverlay;
    const files = e.dataTransfer.files;
    await processFileDrop(overlay, files);
}

async function processFileDrop(overlay, files) {
    let fileInfo = [];
    for (let file of files) {
        try {
            let buffer = await file.arrayBuffer();
            let info = {
                has_buffer: true,
                name: file.name,
                buffer
            }
            fileInfo.push({
                info: info,
                name: file.name
            });
        } catch (e) {
            if (overlay.dataset.action != "world-import" && overlay.dataset.action != "file-import") {
                continue;
            }
            fileInfo.push({
                info: window.enderlynx.readPathFromDrop(file),
                name: file.name
            });
        }
    }
    for (let i = fileInfo.length - 1; i >= 0; i--) {
        let info = fileInfo[i].info;
        if (overlay.dataset.action == "instance-import" || await window.enderlynx.isInstanceFile(info)) {
            let instanceInfo = await window.enderlynx.readPackFile(info);
            if (!info || !(await window.enderlynx.isInstanceFile(info))) {
                displayError(translate("app.import.instance.fail", "%f", info.name));
                continue;
            }
            importInstance(instanceInfo, info);
            fileInfo.splice(i, 1);
        }
    }
    if (overlay.dataset.action == "content-import") {
        document.body.classList.add("loading")
        let instance = Instance.getInstance(overlay.dataset.instanceId);
        if (instance.locked) {
            displayError(translate("app.import.content.locked"));
            document.body.classList.remove("loading");
            return;
        }
        for (let info of fileInfo) {
            let success = await window.enderlynx.importContent(info.info, "auto", overlay.dataset.instanceId);
            if (!success) {
                displayError(translate("app.import.content.fail", "%f", info.name));
            }
        }
        if (document.body.contains(overlay)) instance.instanceScreen.showContent();
        document.body.classList.remove("loading");
    } else if (overlay.dataset.action == "world-import") {
        document.body.classList.add("loading")
        let instance = Instance.getInstance(overlay.dataset.instanceId);
        for (let info of fileInfo) {
            let success = await window.enderlynx.importWorld(info.info, overlay.dataset.instanceId, info.name);
            if (!success) {
                displayError(translate("app.import.worlds.fail", "%f", info.name));
            }
        }
        if (document.body.contains(overlay)) instance.instanceScreen.showWorlds();
        document.body.classList.remove("loading");
    } else if (overlay.dataset.action == "file-import") {
        let instance = Instance.getInstance(overlay.dataset.instanceId);
        let paths = overlay.dataset.paths;
        for (let info of fileInfo) {
            let success = await window.enderlynx.importFile(info.info, overlay.dataset.instanceId, info.name, overlay.dataset.paths);
            if (!success) {
                displayError(translate("app.import.files.fail", "%f", info.name));
            }
        }
        if (document.body.contains(overlay)) instance.instanceScreen.setFilesPath(paths);
    } else if (overlay.dataset.action == "skin-import") {
        for (let info of fileInfo) {
            let dataUrl = await window.enderlynx.pathToDataUrl(info.info);
            await importSkin({
                "skin": dataUrl,
                "name": translate("app.wardrobe.unnamed"),
                "model": "auto"
            });
        }
        if (document.body.contains(overlay)) wardrobeScreen.display();
    }
}

function getDefaultImage(code) {
    let data = window.enderlynx.getDefaultImage(code);
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(data)}`;
}

function sortByVersion(list, reverse) {
    list.sort((a, b) => {
        const aIndex = minecraftVersions.indexOf(a);
        const bIndex = minecraftVersions.indexOf(b);
        if (aIndex === -1 && bIndex === -1) {
            return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
        }
        if (aIndex === -1) return 1;
        if (bIndex === -1) return -1;
        return reverse ? bIndex - aIndex : aIndex - bIndex;
    });
    return list;
}

let logResizeFunction;
let aceResizeFunction;

window.addEventListener('resize', async () => {
    if (logResizeFunction) logResizeFunction();
    if (aceResizeFunction) aceResizeFunction();
    updateSidebarSize();
});

async function updateSidebarSize() {
    let preference = await getDefault("default_sidebar");
    if (window.innerWidth < 1000 || preference == "compact") {
        document.body.classList.add("compact");
        return;
    }
    document.body.classList.remove("compact");
}

function createElement(tag, className, props = {}) {
    let ele = document.createElement(tag);
    if (className) ele.className = className;
    return Object.assign(ele, props);
}

function colorToHex(color) {
    const match1 = color.match(/color\(srgb\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/);
    const match2 = color.match(/rgb\(([\d.]+),\s+([\d.]+),\s+([\d.]+)\)/);

    if (match1) {
        const [r, g, b] = match1.slice(1).map(v => Math.round(parseFloat(v) * 255));
        return "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("");
    }
    if (match2) {
        const [r, g, b] = match2.slice(1).map(v => Number(v));
        return "#" + [r, g, b].map(v => v.toString(16).padStart(2, "0")).join("");
    }
    return null;
}

async function updateWindowButtonColors() {
    let computedStyle = getComputedStyle(document.getElementsByClassName("sidebar")[0]);
    let hexCode = colorToHex(computedStyle.backgroundColor);
    let textColorHexCode = colorToHex(computedStyle.color);
    return await window.enderlynx.updateWindowButtonColors(hexCode, textColorHexCode);
}

class TitleBar {
    constructor() {
        let titleBar = document.getElementsByClassName("title-bar")[0];
        let logo = createElement("img", "enderlynx-logo", {
            alt: translate("app.logo"),
            src: "resources/icons/icon.png"
        });
        let title = createElement("div", "enderlynx-title", {
            textContent: translate("app.name")
        });
        titleBar.appendChild(logo);
        titleBar.appendChild(title);
        let backButton = createElement("button", "title-bar-button", {
            onclick: () => {
                Display.pageBackward()
            },
            innerHTML: '<i class="fa-solid fa-arrow-left"></i>'
        });
        let forwardButton = createElement("button", "title-bar-button", {
            onclick: () => {
                Display.pageForward()
            },
            innerHTML: '<i class="fa-solid fa-arrow-right"></i>'
        });
        titleBar.appendChild(backButton);
        titleBar.appendChild(forwardButton);
        let liveMinecraft = createElement("div", "live");
        live = new LiveMinecraft(liveMinecraft);
        titleBar.appendChild(liveMinecraft);
        this.backButton = backButton;
        this.forwardButton = forwardButton;
        this.titleBar = titleBar;
        this.updateTitleBarButtons();
    }
    updateTitleBarButtons() {
        if (Display.pageIndex <= 0) {
            this.backButton.classList.add("disabled");
        } else {
            this.backButton.classList.remove("disabled");
        }
        if (Display.pageIndex >= Display.pageLog.length - 1) {
            this.forwardButton.classList.add("disabled");
        } else {
            this.forwardButton.classList.remove("disabled");
        }
    }
    hoist() {
        this.titleBar.popover = "manual";
        this.titleBar.showPopover();
    }
    unhoist() {
        this.titleBar.hidePopover();
        this.titleBar.popover = null;
    }
}

let live;
let titleBar = new TitleBar();

const observer = new MutationObserver(() => {
    const openDialogs = document.querySelectorAll("dialog[open]");

    if (openDialogs.length > previousCount) {
        titleBar.hoist();
    }
    if (previousCount > 0 && openDialogs.length === 0) {
        titleBar.unhoist();
    }

    previousCount = openDialogs.length;
});

let previousCount = document.querySelectorAll("dialog[open]").length;

observer.observe(document.body, {
    subtree: true,
    attributes: true,
    attributeFilter: ["open"]
});

const DiscoverState = Object.freeze({
    NOT_INSTALLED: "NOT_INSTALLED",
    INSTALLING: "INSTALLING",
    INSTALLED: "INSTALLED",
    LOADING: "LOADING"
});

const InstallButtonState = Object.freeze({
    INSTALL_ANY_VERSION: 'INSTALL_ANY_VERSION',
    INSTALL_SPECIFIC_VERSION: 'INSTALL_SPECIFIC_VERSION',
    SWITCH_VERSION: 'SWITCH_VERSION',
    SWITCH_VERSION_DISABLED: "SWITCH_VERSION_DISABLED",
    INSTALLING: "INSTALLING",
    INSTALLED_ANY_VERSION: "INSTALLED_ANY_VERSION",
    INSTALLED_SPECIFIC_VERSION: "INSTALLED_SPECIFIC_VERSION",
    LOADING: "LOADING"
});

class DiscoverStateManagement {
    static instance;
    static states = {};
    constructor() { }
    static async setInstance(instance) {
        this.instance = instance;
        this.states = {};
        this.loadStartingStates(this.instance);
    }
    static async loadStartingStates(instance) {
        if (!instance) return;
        let content = await instance.getContent();
        for (let c of content) {
            this.states[c.source_info + "-" + instance.instance_id] = {
                state: DiscoverState.INSTALLED,
                buttons: [],
                version_installed: c.version_id,
                install_progress: 0
            }
        }
        if (instance.install_id) {
            this.states[instance.install_id + "-" + instance.instance_id] = {
                state: DiscoverState.INSTALLED,
                buttons: [],
                version_installed: instance.installed_version,
                install_progress: 0
            }
        }
    }
    static async registerButton(content_id, version_id, button, content, version, instance, content_list_to_update, locked, showUpdateInsteadOfChangeVersion, usesDynamicContentAndVersion) {
        let instance_id = instance?.instance_id || "null";
        if ((!this.instance || this.instance.instance_id != instance_id) && instance) {
            await this.loadStartingStates(instance);
        }
        let info = {
            element: button,
            version_id,
            content_id,
            content,
            version,
            instance,
            content_list_to_update,
            locked,
            showUpdateInsteadOfChangeVersion,
            usesDynamicContentAndVersion
        }
        if (this.states[content_id + "-" + instance_id]?.buttons) {
            this.states[content_id + "-" + instance_id].buttons.push(info);
        } else {
            this.states[content_id + "-" + instance_id] = {
                state: DiscoverState.NOT_INSTALLED,
                buttons: [info],
                version_installed: null,
                install_progress: 0
            }
        }
        this.updateButton(info, this.states[content_id + "-" + instance_id]);
    }
    static applyInstallButtonState(state, buttonInfo) {
        let button = buttonInfo.element;
        if (state != InstallButtonState.INSTALLING) {
            button.style.removeProperty("--percent-preview");
        }
        if (state == InstallButtonState.INSTALLED_ANY_VERSION) {
            button.innerHTML = '<i class="fa-solid fa-check"></i>' + translate("app.discover.installed");
            button.removeAttribute("title");
            button.onclick = () => { };
            button.classList.add("disabled");
        } else if (state == InstallButtonState.INSTALLED_SPECIFIC_VERSION) {
            button.innerHTML = '<i class="fa-solid fa-check"></i>' + translate("app.discover.installed");
            button.title = translate("app.discover.installed.tooltip");
            button.onclick = () => { };
            button.classList.add("disabled");
        } else if (state == InstallButtonState.INSTALLING) {
            button.innerHTML = '<i class="spinner"></i>' + translate("app.discover.installing");
            button.removeAttribute("title");
            button.onclick = () => { };
            button.classList.add("disabled");
        } else if (state == InstallButtonState.LOADING) {
            button.innerHTML = '<i class="spinner"></i>' + translate("app.discover.loading");
            button.removeAttribute("title");
            button.onclick = () => { };
            button.classList.add("disabled");
        } else if (state == InstallButtonState.INSTALL_ANY_VERSION) {
            button.innerHTML = '<i class="fa-solid fa-download"></i>' + translate("app.discover.install");
            button.removeAttribute("title");
            button.onclick = async (event) => {
                event.stopPropagation();
                let content = buttonInfo.content;
                if (buttonInfo.usesDynamicContentAndVersion) {
                    this.setContentStatus(buttonInfo.content_id, buttonInfo.instance?.instance_id, DiscoverState.INSTALLING);
                    content = await content();
                }
                installButtonClick(content, null, buttonInfo.instance?.instance_id);
            };
            button.classList.remove("disabled");
        } else if (state == InstallButtonState.INSTALL_SPECIFIC_VERSION) {
            button.innerHTML = '<i class="fa-solid fa-download"></i>' + translate("app.discover.install");
            button.title = translate("app.discover.install_specific_version");
            button.onclick = async () => {
                let content = buttonInfo.content;
                let version = buttonInfo.version;
                if (buttonInfo.usesDynamicContentAndVersion) {
                    this.setContentStatus(buttonInfo.content_id, buttonInfo.instance?.instance_id, DiscoverState.INSTALLING);
                    content = await content();
                    version = await version();
                }
                installButtonClick(content, version, buttonInfo.instance?.instance_id);
            };
            button.classList.remove("disabled");
        } else if (state == InstallButtonState.SWITCH_VERSION) {
            button.innerHTML = '<i class="fa-solid fa-arrow-right-arrow-left"></i>' + translate("app.discover.change_version");
            button.title = translate("app.discover.change_version.tooltip");
            if (buttonInfo.showUpdateInsteadOfChangeVersion) {
                button.innerHTML = '<i class="fa-solid fa-download"></i>' + translate("app.discover.update");
                button.removeAttribute("title");
            }
            button.onclick = async () => {
                let content = buttonInfo.content;
                let version = buttonInfo.version;
                if (buttonInfo.usesDynamicContentAndVersion) {
                    this.setContentStatus(buttonInfo.content_id, buttonInfo.instance?.instance_id, DiscoverState.INSTALLING);
                    content = await content();
                    version = await version();
                }
                let count = 0;
                version?.loaders?.forEach(e => {
                    if (plugin_loaders.includes(e)) count++;
                });
                if (version?.loaders && count == version?.loaders?.length) {
                    let dialog = new Dialog();
                    dialog.showDialog(translate("app.discover.plugin.title"), "notice", translate("app.discover.plugin.description"), [
                        {
                            "type": "confirm",
                            "content": translate("app.discover.plugin.confirm")
                        }
                    ], [], () => { });
                    return;
                }
                if (version?.loaders?.includes("datapack")) {
                    let dialog = new Dialog();
                    dialog.showDialog(translate("app.discover.datapack.title"), "notice", translate("app.discover.datapack.description"), [
                        {
                            "type": "confirm",
                            "content": translate("app.discover.datapack.confirm")
                        }
                    ], [], () => { });
                    return;
                }
                if (content.project_type == "modpack" || content.project_type == "server") {
                    contentInfo.close();
                    runModpackUpdate(buttonInfo.instance, content.source, version);
                    return;
                }
                let contentList = await buttonInfo.instance.getContent();
                let theContent = null;
                for (let content of contentList) {
                    if (content.source_info == buttonInfo.content_id) {
                        theContent = content;
                    }
                }
                if (!theContent) return;
                await updateContent(content.source, theContent, buttonInfo.content, version, buttonInfo.instance);
                if (buttonInfo.content_list_to_update?.updateSecondaryColumn) buttonInfo.content_list_to_update.updateSecondaryColumn();
            }
            button.classList.remove("disabled");
        } else if (state == InstallButtonState.SWITCH_VERSION_DISABLED) {
            button.innerHTML = '<i class="fa-solid fa-arrow-right-arrow-left"></i>' + translate("app.discover.change_version");
            button.title = translate("app.discover.change_version.tooltip");
            button.onclick = () => { };
            button.classList.add("disabled");
        }
        if (buttonInfo.locked) {
            button.onclick = () => { };
            button.classList.add("disabled");
            button.title = translate("app.discover.locked.tooltip");
        }
    }
    static updateAllButtons(content_id, instance_id) {
        if (!this.states[content_id + "-" + instance_id]) return;
        let info = this.states[content_id + "-" + instance_id];
        for (let buttonInfo of info.buttons) {
            this.updateButton(buttonInfo, info);
        }
    }
    static updateButton(buttonInfo, info) {
        let version_id = buttonInfo.version_id;
        if (buttonInfo.usesDynamicContentAndVersion) {
            version_id = version_id();
        }
        if (info.state == DiscoverState.LOADING && version_id == null) {
            this.applyInstallButtonState(InstallButtonState.LOADING, buttonInfo);
            return;
        }
        if (version_id == null) {
            if (info.state == DiscoverState.INSTALLED) {
                this.applyInstallButtonState(InstallButtonState.INSTALLED_ANY_VERSION, buttonInfo);
            } else if (info.state == DiscoverState.INSTALLING) {
                this.applyInstallButtonState(InstallButtonState.INSTALLING, buttonInfo);
            } else if (info.state == DiscoverState.NOT_INSTALLED) {
                this.applyInstallButtonState(InstallButtonState.INSTALL_ANY_VERSION, buttonInfo);
            }
        } else if (version_id == info.version_installed) {
            if (info.state == DiscoverState.INSTALLED) {
                this.applyInstallButtonState(InstallButtonState.INSTALLED_SPECIFIC_VERSION, buttonInfo);
            } else if (info.state == DiscoverState.INSTALLING) {
                this.applyInstallButtonState(InstallButtonState.INSTALLING, buttonInfo);
            } else if (info.state == DiscoverState.NOT_INSTALLED) {
                // not happening
                this.applyInstallButtonState(InstallButtonState.INSTALL_SPECIFIC_VERSION, buttonInfo);
            }
        } else {
            if (info.state == DiscoverState.INSTALLED) {
                this.applyInstallButtonState(InstallButtonState.SWITCH_VERSION, buttonInfo);
            } else if (info.state == DiscoverState.INSTALLING) {
                this.applyInstallButtonState(InstallButtonState.SWITCH_VERSION_DISABLED, buttonInfo);
            } else if (info.state == DiscoverState.NOT_INSTALLED) {
                this.applyInstallButtonState(InstallButtonState.INSTALL_SPECIFIC_VERSION, buttonInfo);
            }
        }
    }
    static setInstallProgress(content_id, instance_id, install_progress) {
        if (!this.states[content_id + "-" + instance_id]) return;
        if (this.states[content_id + "-" + instance_id].state != DiscoverState.INSTALLING) return;
        this.states[content_id + "-" + instance_id].install_progress = install_progress;
        for (let buttonInfo of this.states[content_id + "-" + instance_id].buttons) {
            let version_id = buttonInfo.version_id;
            if (buttonInfo.usesDynamicContentAndVersion) {
                version_id = version_id();
            }
            if (version_id == null || version_id == this.states[content_id + "-" + instance_id].version_installed) {
                buttonInfo.element.style.setProperty("--percent-preview", install_progress + "%");
            }
        }
    }
    static setContentStatus(content_id, instance_id, state) {
        if (!this.states[content_id + "-" + instance_id]) {
            this.states[content_id + "-" + instance_id] = {
                state,
                buttons: [],
                version_installed: null,
                install_progress: 0
            }
        } else {
            this.states[content_id + "-" + instance_id].state = state;
        }
        this.updateAllButtons(content_id, instance_id);
    }
    static setVersionInstalled(content_id, instance_id, version_id) {
        if (!this.states[content_id + "-" + instance_id]) return;
        this.states[content_id + "-" + instance_id].version_installed = version_id;
        this.updateAllButtons(content_id, instance_id);
    }
    static removeButtons(buttons) {
        if (!buttons) return;
        let buttonArray = Array.isArray(buttons) ? buttons : Array.from(buttons || []);
        let buttonSet = new Set(buttonArray);
        for (let instance_id in this.states) {
            let stateInfo = this.states[instance_id];
            if (!stateInfo || !Array.isArray(stateInfo.buttons)) continue;
            stateInfo.buttons = stateInfo.buttons.filter(button => !buttonSet.has(button.element));
        }
    }
}

window.enderlynx.onInstanceStopped((instance_id) => {
    let instance = Instance.getInstance(instance_id);
    InstanceStateManagement.calculateInstanceStatus(instance);
    live.findLive();
});

window.enderlynx.onInstanceStarted((instance_id) => {
    let instance = Instance.getInstance(instance_id);
    InstanceStateManagement.calculateInstanceStatus(instance);
    live.findLive();
});

class CategoryFilter {
    constructor(element, categories, defaultActiveCategories = [], onchange) {
        this.onchange = onchange;
        this.id = createId();
        this.activeCategories = defaultActiveCategories;
        element.className = "category-filter-wrapper";
        let categoryListButton = createElement("button", "category-filter-button");
        categoryListButton.setAttribute("popovertarget", this.id);
        let categoryInfo = createElement("div", "category-info");
        let categoryName = createElement("div", "category-name", {
            textContent: translate("app.discover.filters")
        });
        let categoryActive = createElement("div", "category-active", {
            textContent: translate("app.categories.active", "%n", this.activeCategories.length)
        });
        this.categoryActive = categoryActive;
        categoryInfo.appendChild(categoryName);
        categoryInfo.appendChild(categoryActive);
        categoryListButton.appendChild(categoryInfo);
        let slidersIcon = createElement("i", "fa-solid fa-sliders");
        categoryListButton.appendChild(slidersIcon);
        element.style.anchorName = "--" + this.id;
        element.appendChild(categoryListButton);
        let categoryListElement = createElement("div", "category-list");
        categoryListElement.setAttribute("popover", "");
        categoryListElement.style.positionAnchor = "--" + this.id;
        categoryListElement.id = this.id;
        element.appendChild(categoryListElement);
        this.categoryListElement = categoryListElement;
        this.setCategories(categories);
    }
    setCategories(categories) {
        this.categoryListElement.innerHTML = "";
        this.categories = categories;
        if (categories.length == 0) {
            let element = createElement("div", "category-wrapper", {
                textContent: translate("app.categories.unable_to_load")
            });
            this.categoryListElement.appendChild(element);
        }
        let groupedCategories = new Map();
        for (let category of categories) {
            let header = category.header == null ? "" : category.header;
            if (!groupedCategories.has(header)) {
                groupedCategories.set(header, []);
            }
            groupedCategories.get(header).push(category);
        }
        let headers = Array.from(groupedCategories.keys());
        headers.sort((a, b) => {
            if (a === "" && b !== "") return -1;
            if (b === "" && a !== "") return 1;
            return a.localeCompare(b);
        });
        for (let header of headers) {
            let categoriesForHeader = groupedCategories.get(header);
            categoriesForHeader.sort((a, b) => {
                let nameA = translate(a.name);
                let nameB = translate(b.name);
                let matchA = nameA.match(/^(\d+(?:\.\d+)?)/);
                let matchB = nameB.match(/^(\d+(?:\.\d+)?)/);
                let numA = matchA ? Number(matchA[1]) : null;
                let numB = matchB ? Number(matchB[1]) : null;
                if (numA !== null && numB !== null) {
                    if (numA !== numB) return numA - numB;
                    return nameA.localeCompare(nameB);
                }
                if (numA !== null) return -1;
                if (numB !== null) return 1;
                return nameA.localeCompare(nameB);
            });
            let headerElement = createElement("div", "category-header", {
                textContent: header ? translate(header) : translate("app.category.header.categories")
            });
            this.categoryListElement.appendChild(headerElement);
            for (let category of categoriesForHeader) {
                let categoryWrapper = createElement("div", "category-wrapper");
                let categoryCheckbox = createElement("input", "category-checkbox", {
                    id: category.id,
                    type: "checkbox"
                });
                let categoryAddButton = createElement("label", "category-button", {
                    htmlFor: category.id
                });
                categoryAddButton.textContent = translate(category.name);
                categoryCheckbox.onchange = () => {
                    if (this.activeCategories.includes(category.id)) {
                        if (categoryCheckbox.checked) return;
                        this.activeCategories = this.activeCategories.filter(e => e != category.id);
                    } else {
                        if (!categoryCheckbox.checked) return;
                        this.activeCategories.push(category.id);
                    }
                    this.categoryActive.textContent = translate("app.categories.active", "%n", this.activeCategories.length);
                    if (this.onchange) this.onchange(this.activeCategories);
                }
                categoryCheckbox.checked = this.activeCategories.includes(category.id);
                categoryWrapper.appendChild(categoryCheckbox);
                categoryWrapper.appendChild(categoryAddButton);
                this.categoryListElement.appendChild(categoryWrapper);
            }
        }
    }
    clear() {
        this.activeCategories = [];
        this.setCategories(this.categories);
        this.categoryActive.textContent = translate("app.categories.active", "%n", this.activeCategories.length);
    }
}

function makeArtificialButton(element, func, notAllowedTargets = ["button"]) {
    element.tabIndex = 0;
    element.setAttribute("role", "button");
    element.onkeydown = (event) => {
        if (notAllowedTargets.some(e => event.target.matches(e))) return;
        if (event.key == "Enter") {
            event.stopPropagation();
            func(event);
        }
        if (event.key == " ") {
            event.preventDefault();
        }
    }
    element.onkeyup = (event) => {
        if (notAllowedTargets.some(e => event.target.matches(e))) return;
        if (event.key == " ") {
            event.stopPropagation();
            func(event);
        }
    }
    element.onclick = (event) => {
        if (notAllowedTargets.some(e => event.target.matches(e))) return;
        event.stopPropagation();
        func(event);
    }
}

window.debug = {
    DiscoverStateManagement,
    InstanceStateManagement,
    Modrinth,
    CurseForge,
    Instance
}