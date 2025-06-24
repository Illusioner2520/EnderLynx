let lang = null;
document.getElementsByTagName("title")[0].innerHTML = translate("app.name");
let minecraftVersions = []
let getVersions = async () => {
    minecraftVersions = (await window.electronAPI.getVanillaVersions()).reverse();
}
getVersions();

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

class Instance {
    constructor(instance_id) {
        let content = db.prepare("SELECT * FROM instances WHERE instance_id = ? LIMIT 1").get(instance_id);
        if (!content) throw new Error("Instance not found");
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
    }

    setName(name) {
        db.prepare("UPDATE instances SET name = ? WHERE id = ?").run(name, this.id);
        this.name = name;
    }
    setLastPlayed(last_played) {
        db.prepare("UPDATE instances SET last_played = ? WHERE id = ?").run(last_played ? last_played.toISOString() : null, this.id);
        this.last_played = last_played;
    }
    setDateCreated(date_created) {
        db.prepare("UPDATE instances SET date_created = ? WHERE id = ?").run(date_created.toISOString(), this.id);
        this.date_created = date_created;
    }
    setDateModified(date_modified) {
        db.prepare("UPDATE instances SET date_modified = ? WHERE id = ?").run(date_modified.toISOString(), this.id);
        this.date_modified = date_modified;
    }
    setLoader(loader) {
        db.prepare("UPDATE instances SET loader = ? WHERE id = ?").run(loader, this.id);
        this.loader = loader;
    }
    setVanillaVersion(vanilla_version) {
        db.prepare("UPDATE instances SET vanilla_version = ? WHERE id = ?").run(vanilla_version, this.id);
        this.vanilla_version = vanilla_version;
    }
    setLoaderVersion(loader_version) {
        db.prepare("UPDATE instances SET loader_version = ? WHERE id = ?").run(loader_version, this.id);
        this.loader_version = loader_version;
    }
    setPlaytime(playtime) {
        db.prepare("UPDATE instances SET playtime = ? WHERE id = ?").run(playtime, this.id);
        this.playtime = playtime;
    }
    setLocked(locked) {
        db.prepare("UPDATE instances SET locked = ? WHERE id = ?").run(Number(locked), this.id);
        this.locked = locked;
    }
    setDownloaded(downloaded) {
        db.prepare("UPDATE instances SET downloaded = ? WHERE id = ?").run(Number(downloaded), this.id);
        this.downloaded = downloaded;
    }
    setGroup(group) {
        db.prepare("UPDATE instances SET group_id = ? WHERE id = ?").run(group, this.id);
        this.group = group;
    }
    setImage(image) {
        db.prepare("UPDATE instances SET image = ? WHERE id = ?").run(image, this.id);
        this.image = image;
    }
    setPid(pid) {
        db.prepare("UPDATE instances SET pid = ? WHERE id = ?").run(pid, this.id);
        this.pid = pid;
    }
    setCurrentLogFile(current_log_file) {
        db.prepare("UPDATE instances SET current_log_file = ? WHERE id = ?").run(current_log_file, this.id);
        this.current_log_file = current_log_file;
    }
    setInstallSource(install_source) {
        db.prepare("UPDATE instances SET install_source = ? WHERE id = ?").run(install_source, this.id);
        this.install_source = install_source;
    }
    setInstallId(install_id) {
        db.prepare("UPDATE instances SET install_id = ? WHERE id = ?").run(install_id, this.id);
        this.install_id = install_id;
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
}

class Data {
    getInstances() {
        let instances = db.prepare("SELECT * FROM instances").all();
        return instances.map(e => new Instance(e.instance_id));
    }

    addInstance(name, date_created, date_modified, last_played, loader, vanilla_version, loader_version, locked, downloaded, group, image, instance_id, playtime, install_source, install_id) {
        db.prepare(`INSERT INTO instances (name, date_created, date_modified, last_played, loader, vanilla_version, loader_version, locked, downloaded, group_id, image, instance_id, playtime, install_source, install_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(name, date_created.toISOString(), date_modified.toISOString(), last_played ? last_played.toISOString() : null, loader, vanilla_version, loader_version, Number(locked), Number(downloaded), group, image, instance_id, playtime, install_source, install_id);
        return new Instance(instance_id);
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
            let defaults = { "default_sort": "name", "default_group": "none" };
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
}

class Profile {
    constructor(id) {
        let profile = db.prepare("SELECT * FROM profiles WHERE id = ? LIMIT 1").get(id);
        if (!profile) throw new Error("Profile not found");
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
}

let data = new Data();

class MinecraftAccountSwitcher {
    constructor(element, players) {
        element.classList.add("player-switch");
        this.element = element;
        this.players = players;
        this.setPlayerInfo();
    }
    setPlayerInfo() {
        let default_player = this.default_player ?? data.getDefaultProfile();
        this.default_player = default_player;
        if (default_player) {
            this.element.setAttribute("popovertarget", "player-dropdown");
            this.element.innerHTML = `<img class="player-head" src="https://mc-heads.net/avatar/${default_player.uuid}/40"><div class="player-info"><div class="player-name">${default_player.name}</div><div class="player-desc">${translate("app.players.minecraft_account")}</div></div><div class="player-chevron"><i class="fa-solid fa-chevron-down"></i></div>`;
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
                playerImg.src = `https://mc-heads.net/avatar/${this.players[i].uuid}/40`;
                playerElement.appendChild(playerImg);
                let playerInfoEle = document.createElement("div");
                playerInfoEle.classList.add("player-info");
                let playerName = document.createElement("div");
                playerName.classList.add("player-name");
                playerName.innerHTML = this.players[i].name;
                playerInfoEle.appendChild(playerName);
                let playerDesc = document.createElement("div");
                playerDesc.classList.add("player-desc");
                playerDesc.innerHTML = translate("app.players.selected");
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
            addPlayerButton.innerHTML = '<i class="fa-solid fa-plus"></i>' + translate("app.button.players.add");
            addPlayerButton.onclick = toggleMicrosoftSignIn;
            dropdownElement.appendChild(addPlayerButton);
            if (!alreadyThere) document.body.appendChild(dropdownElement);
        } else {
            this.element.removeAttribute("popovertarget");
            if (this.dropdownElement) this.dropdownElement.hidePopover();
            this.element.innerHTML = `<img class="player-head" src="https://mc-heads.net/avatar/Steve/40"><div class="player-info"><div class="player-name">${translate("app.button.players.sign_in")}</div></div><div class="player-chevron"><i class="fa-solid fa-arrow-right-to-bracket"></i></div>`;
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
        this.default_player = newPlayerInfo;
        newPlayerInfo.setDefault();
        this.element.innerHTML = `<img class="player-head" src="https://mc-heads.net/avatar/${newPlayerInfo.uuid}/40"><div class="player-info"><div class="player-name">${newPlayerInfo.name}</div><div class="player-desc">${translate("app.players.minecraft_account")}</div></div><div class="player-chevron"><i class="fa-solid fa-chevron-down"></i></div>`;
        for (let i = 0; i < this.playerElements.length; i++) {
            if (this.playerElements[i].getAttribute("data-uuid") != newPlayerInfo.uuid) {
                this.playerElements[i].classList.add("not-selected");
            } else {
                this.playerElements[i].classList.remove("not-selected");
            }
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
        navTitle.innerHTML = title;
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
        innerName.innerHTML = translate("app.instances.no_running");
        name.appendChild(innerName);
        this.nameElement = innerName;
        let stopButton = document.createElement("div");
        stopButton.className = "live-stop";
        stopButton.innerHTML = '<i class="fa-regular fa-circle-stop"></i>';
        let logButton = document.createElement("div");
        logButton.className = "live-log";
        logButton.innerHTML = '<i class="fa-solid fa-terminal"></i>';
        element.appendChild(indicator);
        element.appendChild(name);
        element.appendChild(stopButton);
        element.appendChild(logButton);
    }
    setLive(instanceInfo) {
        this.nameElement.innerHTML = instanceInfo.name;
        this.element.classList.add("minecraft-live");
    }
    removeLive() {
        this.nameElement.innerHTML = translate("app.instances.no_running");
        this.element.classList.remove("minecraft-live");
    }
}

class TabContent {
    constructor(element, options) {
        this.element = element;
        element.classList.add("tab-list");
        for (let i = 0; i < options.length; i++) {
            let buttonElement = document.createElement("button");
            buttonElement.classList.add("tab-button");
            buttonElement.innerHTML = options[i].name;
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
        this.element.innerHTML = this.icon + this.title;
    }
    setIcon(icon) {
        this.icon = icon;
        this.element.innerHTML = this.icon + this.title;
    }
}

class MoreMenu {
    constructor(ele, buttons) {
        let id = createId();
        this.id = id;
        let element = document.createElement("div");
        element.classList.add("more-menu");
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
            buttonElement.innerHTML = buttons.buttons[i].icon + buttons.buttons[i].title;
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
        if (window.innerWidth - x < 200) {
            this.element.style.left = "";
            this.element.style.right = window.innerWidth - x + "px";
        }
        this.element.style.top = y + "px";
        this.element.innerHTML = "";
        for (let i = 0; i < buttons.buttons.length; i++) {
            let buttonElement = document.createElement("button");
            buttonElement.classList.add("context-menu-button");
            buttonElement.innerHTML = buttons.buttons[i].icon + buttons.buttons[i].title;
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
        searchInput.oninput = (e) => {
            this.oninput(searchInput.value)
        };
        searchInput.onkeydown = (e) => {
            if (e.key == "Enter") {
                this.onenter(searchInput.value);
            }
        }
        searchClear.onclick = (e) => {
            searchInput.value = "";
            this.oninput("");
            this.onenter("");
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
        dropdownTitle.innerHTML = title;
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
        this.selectedElement.innerHTML = name;
        this.popover.innerHTML = "";
        for (let i = 0; i < options.length; i++) {
            let optEle = document.createElement("button");
            optEle.classList.add("dropdown-item");
            optEle.innerHTML = options[i].name;
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
        this.selectedElement.innerHTML = name;
        for (let i = 0; i < this.optEles.length; i++) {
            if (this.optEles[i].innerHTML == name) {
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
        dropdownTitle.innerHTML = title;
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
        this.selectedElement.innerHTML = name;
        this.popover.innerHTML = "";
        for (let i = 0; i < options.length; i++) {
            let optEle = document.createElement("button");
            optEle.classList.add("dropdown-item");
            optEle.innerHTML = options[i].name;
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
        this.selectedElement.innerHTML = name;
        for (let i = 0; i < this.optEles.length; i++) {
            if (this.optEles[i].innerHTML == name) {
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
        primaryColumnTitle.innerHTML = features?.primary_column_name;
        contentListTop.appendChild(primaryColumnTitle);
        let secondaryColumnTitle = document.createElement("div");
        secondaryColumnTitle.className = "content-list-title";
        secondaryColumnTitle.innerHTML = features?.secondary_column_name;
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
            updateAllButton.onclick = features.update_all.func;
            contentListTop.appendChild(updateAllButton);
        }

        searchBar.setOnInput((val) => {
            for (let i = 0; i < this.items.length; i++) {
                if (this.items[i].name.toLowerCase().includes(val.toLowerCase().trim())) {
                    this.items[i].element.style.display = "flex";
                    this.items[i].element.classList.remove("hidden");
                } else {
                    this.items[i].element.style.display = "none";
                    this.items[i].element.classList.add("hidden");
                }
            }
            this.figureOutMainCheckedState();
        });

        filter.setOnChange((val) => {
            for (let i = 0; i < this.items.length; i++) {
                if (this.items[i].type == val || val == "all") {
                    this.items[i].element.style.display = "flex";
                    this.items[i].element.classList.remove("hidden");
                } else {
                    this.items[i].element.style.display = "none";
                    this.items[i].element.classList.add("hidden");
                }
            }
            this.figureOutMainCheckedState();
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
            infoElement1Desc.innerHTML = content[i].primary_column.desc;
            infoElement1.appendChild(infoElement1Desc);
            let infoElement2 = document.createElement("div");
            infoElement2.className = "content-list-info";
            contentEle.appendChild(infoElement2);
            let infoElement2Title = document.createElement("div");
            infoElement2Title.className = "content-list-info-title-2";
            infoElement2Title.innerHTML = content[i].secondary_column.title;
            infoElement2.appendChild(infoElement2Title);
            let infoElement2Desc = document.createElement("div");
            infoElement2Desc.className = "content-list-info-desc-2";
            infoElement2Desc.innerHTML = content[i].secondary_column.desc;
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
                        infoElement2Desc.innerHTML = infoElement2Desc.innerHTML.slice(0, -9);
                    } else {
                        infoElement2Desc.innerHTML = infoElement2Desc.innerHTML + ".disabled";
                    }
                }, !content[i].disabled);
                contentEle.appendChild(toggleElement);
            }
            if (features?.remove?.enabled) {
                let removeElement = document.createElement("button");
                removeElement.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
                removeElement.className = 'content-list-remove';
                removeElement.onclick = () => {
                    content[i].onremove();
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
                    displayError("Failed to enable content.");
                    return;
                }
                e.setDisabled(false);
                e.setFileName(new_file_name);
                contentInfo.secondary_column.desc = new_file_name;
                displaySuccess("Successfully enabled '" + e.name + "'");
            } else {
                let new_file_name = window.electronAPI.disableFile(file_path);
                if (!new_file_name) {
                    displayError("Failed to disable content.");
                    return;
                }
                e.setDisabled(true);
                e.setFileName(new_file_name);
                contentInfo.secondary_column.desc = new_file_name;
                displaySuccess("Successfully disabled '" + e.name + "'");
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
        buttonElement.innerHTML = theActionList.buttons[i].icon + theActionList.buttons[i].title;
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
let worldContent = new PageContent(showWorldContent, "discover");
let myAccountContent = new PageContent(showMyAccountContent, "my_account");
let contextmenu = new ContextMenu();
let homeButton = new NavigationButton(homeButtonEle, translate("app.page.home"), '<i class="fa-solid fa-house"></i>', homeContent);
let instanceButton = new NavigationButton(instanceButtonEle, translate("app.page.instances"), '<i class="fa-solid fa-book"></i>', instanceContent);
let worldButton = new NavigationButton(worldButtonEle, translate("app.page.discover"), '<i class="fa-solid fa-compass"></i>', worldContent);
let settingsButton = new NavigationButton(settingsButtonEle, "Settings", '<i class="fa-solid fa-gear"></i>');
let myAccountButton = new NavigationButton(myAccountButtonEle, translate("app.page.my_account"), '<i class="fa-solid fa-user"></i>', myAccountContent);

settingsButtonEle.onclick = () => {
    let dialog = new Dialog();
    dialog.showDialog("Settings", "form", [
        {
            "type": "toggle",
            "name": "Testing Stuff",
            "tab": "appearance",
            "default": true,
            "id": "testing"
        }
    ], [
        {
            "type": "confirm",
            "content": "Done"
        }
    ], [
        {
            "name": "Appearance",
            "value": "appearance"
        },
        {
            "name": "Defaults",
            "value": "defaults"
        },
        {
            "name": "Java",
            "value": "java"
        },
        {
            "name": "App Info",
            "value": "app_info"
        }
    ], () => { });
}

let navButtons = [homeButton, instanceButton, worldButton, myAccountButton];

async function toggleMicrosoftSignIn() {
    let newData = await window.electronAPI.triggerMicrosoftLogin();
    let players = data.getProfiles().map(e => e.uuid);
    if (players.includes(newData.uuid)) {
        let player = data.getProfileFromUUID(newData.uuid);
        player.setDefault();
        accountSwitcher.selectPlayer(player);
    } else {
        let newPlayer = data.addProfile(newData.access_token, newData.client_id, newData.expires, newData.name, newData.refresh_token, newData.uuid, newData.xuid, newData.is_demo, false);
        newPlayer.setDefault();
        accountSwitcher.addPlayer(newPlayer);
    }
}

function showHomeContent(e) {
    let ele = document.createElement("div");
    ele.innerHTML = translate("app.page.home");
    return ele;
}

function showMyAccountContent(e) {
    let ele = document.createElement("div");
    ele.innerHTML = translate("app.page.my_account");
    return ele;
}

function sortInstances(how) {
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
    Object.keys(groupMap).forEach(groupKey => {
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
    "quilt": translate("app.loader.quilt")
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
                "name": "Icon" //TODO: replace with translate
            },
            {
                "type": "text",
                "name": "Name", //TODO
                "id": "name",
                "tab": "custom"
            },
            {
                "type": "multi-select",
                "name": "Loader", // TODO
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
                "name": "Game Version", // TODO
                "options": [],
                "id": "game_version",
                "input_source": "loader",
                "source": (new VersionList).getVersions,
                "tab": "custom"
            }
        ], [
            { "content": "Cancel", "type": "cancel" },
            { "content": "Submit", "type": "confirm" }
        ], [
            {
                "name": "Custom", //TODO
                "value": "custom"
            },
            {
                "name": "File Import", //TODO
                "value": "file"
            },
            {
                "name": "Import from Launcher", //TODO
                "value": "launcher"
            }
        ], async (e) => {
            let info = {};
            e.forEach(e => { info[e.id] = e.value });
            let instance_id = window.electronAPI.getInstanceFolderName(info.name.replace(/[#<>:"/\\|?*\x00-\x1F]/g, "_").toLowerCase());
            let loader_version = "";
            if (info.loader == "fabric") {
                loader_version = (await window.electronAPI.getFabricVersion(info.game_version))
            } else if (info.loader == "forge") {
                loader_version = (await window.electronAPI.getForgeVersion(info.game_version))
            }
            // let newInstanceInfo = {
            //     "name": info.name,
            //     "last_played": "",
            //     "date_created": (new Date()).toString(),
            //     "date_modified": (new Date()).toString(),
            //     "playtime": 0,
            //     "loader": info.loader,
            //     "vanilla_version": info.game_version,
            //     "loader_version": loader_version,
            //     "instance_id": instance_id,
            //     "image": info.icon,
            //     "downloaded": false,
            //     "locked": false,
            //     "content": [],
            //     "group": ""
            // }
            let instance = data.addInstance(info.name, new Date(), new Date(), "", info.loader, info.game_version, loader_version, false, false, "", info.icon, instance_id, 0, "custom", "");
            showSpecificInstanceContent(instance);
            window.electronAPI.downloadMinecraft(instance_id, info.loader, info.game_version, loader_version);
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
            showSpecificInstanceContent(instances[i]);
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
        instanceElement.appendChild(instanceImage);
        let instanceInfoEle = document.createElement("div");
        instanceInfoEle.classList.add("instance-info");
        let instanceName = document.createElement("div");
        instanceName.classList.add("instance-name");
        instanceName.innerHTML = instances[i].name;
        instanceInfoEle.appendChild(instanceName);
        let instanceDesc = document.createElement("div");
        instanceDesc.classList.add("instance-desc");
        instanceDesc.innerHTML = loaders[instances[i].loader] + " " + instances[i].vanilla_version;
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
                    showSpecificInstanceContent(instances[i]);
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
                "func": (e) => { }
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
    topBar.appendChild(instImg);
    let instTopInfo = document.createElement("div");
    instTopInfo.classList.add("instance-top-info");
    let instTopTitle = document.createElement("h1");
    instTopTitle.innerHTML = instanceInfo.name;
    instTopTitle.classList.add("instance-top-title");
    instTopInfo.appendChild(instTopTitle);
    let instTopSubInfo = document.createElement("div");
    instTopSubInfo.classList.add("instance-top-sub-info");
    let instTopVersions = document.createElement("div");
    instTopVersions.classList.add("instance-top-sub-info-specific");
    instTopVersions.innerHTML = `<i class="fa-solid fa-gamepad"></i>${loaders[instanceInfo.loader] + " " + instanceInfo.vanilla_version}`;
    let instTopPlaytime = document.createElement("div");
    instTopPlaytime.classList.add("instance-top-sub-info-specific");
    instTopPlaytime.innerHTML = `<i class="fa-solid fa-clock"></i>${formatTime(instanceInfo.playtime)}`;
    let instTopLastPlayed = document.createElement("div");
    instTopLastPlayed.classList.add("instance-top-sub-info-specific");
    instTopLastPlayed.innerHTML = `<i class="fa-solid fa-clock-rotate-left"></i>${formatDate(instanceInfo.last_played)}`;
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
            setInstanceTabContentLogs(instanceInfo, tabsInfo);
        }
        window.electronAPI.clearProcessWatches();
        window.electronAPI.watchProcessForExit(instanceInfo.pid, () => {
            playButton.innerHTML = '<i class="fa-solid fa-play"></i>' + translate("app.button.instances.play_short");
            playButton.classList.remove("instance-top-stop-button");
            playButton.classList.add("instance-top-play-button");
            playButton.onclick = playButtonClick;
        });
    }
    let stopButtonClick = () => {
        stopInstance(instanceInfo);
        playButton.innerHTML = '<i class="fa-solid fa-play"></i>' + translate("app.button.instances.play_short");
        playButton.classList.remove("instance-top-stop-button");
        playButton.classList.add("instance-top-play-button");
        playButton.onclick = playButtonClick;
    }
    if (!running) {
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
        });
    }
    let threeDots = document.createElement("button");
    threeDots.classList.add("instance-top-more");
    threeDots.innerHTML = '<i class="fa-solid fa-ellipsis-vertical"></i>';
    let buttons = new ContextMenuButtons([
        {
            "icon": running ? '<i class="fa-solid fa-circle-stop"></i>' : '<i class="fa-solid fa-play"></i>',
            "title": running ? translate("app.button.instances.stop") : translate("app.button.instances.play"),
            "func": running ? (e) => {
                stopInstance(instanceInfo);
            } : (e) => {
                playInstance(instanceInfo);
            }
        },
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
            "func": (e) => { }
        },
        {
            "icon": '<i class="fa-solid fa-trash-can"></i>',
            "title": translate("app.button.instances.delete"),
            "func": (e) => { },
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
                setInstanceTabContentLogs(instanceInfo, tabsInfo);
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
                        "func_id": "delete"
                    }
                ]
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
    element.appendChild(contentListWrap);
}
function isNotDisplayNone(element) {
    return element.checkVisibility({ checkDisplayNone: true });
}
async function setInstanceTabContentWorlds(instanceInfo, element) {
    let searchAndFilter = document.createElement("div");
    searchAndFilter.classList.add("search-and-filter-v2");
    let addContent = document.createElement("button");
    addContent.classList.add("add-content-button");
    addContent.innerHTML = '<i class="fa-solid fa-plus"></i>' + translate("app.worlds.add")
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
                    "desc": translate("app.worlds.description." + worlds[i].mode) + (worlds[i].hardcore ? " - " + translate("app.worlds.description.hardcore") : "") + (worlds[i].commands ? " - " + translate("app.worlds.description.commands") : "")
                },
                "type": "singleplayer",
                "image": worlds[i].icon ?? "default.png",
                "onremove": () => {
                    let dialog = new Dialog();
                    dialog.showDialog("Are you sure?", "notice", "Are you sure that you want to delete the world '" + worlds[i].name + "'?", [ // TODO
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
                        minecraftVersions.indexOf(instanceInfo.vanilla_version) >= minecraftVersions.indexOf("23w14a") ? {
                            "title": translate("app.worlds.play"),
                            "icon": '<i class="fa-solid fa-play"></i>',
                            "func": async () => {
                                await playSingleplayerWorld(instanceInfo, worlds[i].id);
                                showSpecificInstanceContent(instanceInfo, 'worlds');
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
                            "func": () => {
                                let dialog = new Dialog();
                                dialog.showDialog("Are you sure?", "notice", "Are you sure that you want to delete the world '" + worlds[i].name + "'?", [ // TODO
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
                    "actionsList": new ContextMenuButtons([
                        minecraftVersions.indexOf(instanceInfo.vanilla_version) >= minecraftVersions.indexOf("1.3") ? {
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
                    ].filter(e => e))
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
                lineElement.innerHTML = e;
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
            logDisplay.scrollTo(0, logDisplay.scrollHeight);
            window.electronAPI.watchFile(log_path, (log) => {
                let logInfo = log.split("\n");
                let scroll = logDisplay.scrollHeight - logDisplay.scrollTop - 50 <= logDisplay.clientHeight + 1;
                logInfo.forEach((e) => {
                    if (e == "") return;
                    if (e.length == 1) return;
                    let lineElement = document.createElement("span");
                    lineElement.innerHTML = e;
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
                lineElement.innerHTML = e;
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
    setUpLiveLog();
    render();
    typeDropdown.style.minWidth = "300px";
    searchAndFilter.appendChild(contentSearch);
    searchAndFilter.appendChild(typeDropdown);
    element.innerHTML = "";
    element.appendChild(searchAndFilter);
    let logWrapper = document.createElement("div");
    logWrapper.className = "logs";
    let logTop = document.createElement("div");
    logTop.className = "logs-top";
    logWrapper.appendChild(logTop);
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
    // logTop.appendChild(wordWrapToggle);
    // logTop.appendChild(wordWrapLabel);
    logTop.appendChild(copyButton);
    logTop.appendChild(shareButton);
    logTop.appendChild(deleteButton);
    logDisplay.className = "logs-display";
    // logDisplay.classList.add("word-wrap");
    logWrapper.appendChild(logDisplay);
    element.appendChild(logWrapper);
}
function setInstanceTabContentOptions(instanceInfo, element) {
    element.innerHTML = "";
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
        screenshotTitle.innerHTML = name;
        screenshotDisplay.src = file;
        screenshotDisplay.alt = name;
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
    element.innerHTML = error.toString();
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
    instInfo.setLastPlayed(new Date());
    // loader,version,loaderVersion,instance_id,player_info
    let pid;
    try {
        pid = await window.electronAPI.playMinecraft(instInfo.loader, instInfo.vanilla_version, instInfo.loader_version, instInfo.instance_id, data.getDefaultProfile(), quickPlay);
        if (!pid) return;
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
    } catch (e) {
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
    if (isNaN(date.getTime())) {
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

function showWorldContent(e) {
    let ele = document.createElement("div");
    ele.innerHTML = 'Discover';
    return ele;
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
    return lang[key];
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
        title.innerHTML = startingTitle;
        desc.innerHTML = startingDescription;
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
        this.descEle.innerHTML = desc;
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
}

class VersionList {
    constructor() { }
    async getVersions(loader) {
        if (loader == "vanilla") {
            return await window.electronAPI.getVanillaVersions();
        } else if (loader == "fabric") {
            return await window.electronAPI.getFabricVersions();
        } else if (loader == "forge") {
            return await window.electronAPI.getForgeVersions();
        } else if (loader == "neoforge") {
            return await window.electronAPI.getNeoForgeVersions();
        } else if (loader == "quilt") {
            return await window.electronAPI.getQuiltVersions();
        }
    }
}

class ImageUpload {
    constructor(element, defaultImage) {
        element.className = "image-upload-wrapper";
        let preview = document.createElement("img");
        preview.className = "image-preview";
        preview.src = defaultImage ?? "default.png"
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
        this.value = defaultImage ?? "";
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
        dialogTitle.innerHTML = title;
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
                dialogContent.style.display = "none";
            }
        } else {
            let dialogContent = document.createElement("div");
            dialogContent.className = "dialog-content-inner";
            contents["default"] = dialogContent;
            realDialogContent.appendChild(dialogContent);
        }
        if (selectedTab) contents[selectedTab].style.display = "grid";
        if (type == "notice") {
            realDialogContent.innerHTML = info;
        } else if (type == "form") {
            for (let i = 0; i < info.length; i++) {
                let tab = info[i].tab ?? "default";
                if (info[i].type == "notice") {
                    let textElement = document.createElement("div");
                    textElement.innerHTML = info[i].content;
                    contents[tab].appendChild(textElement);
                } else if (info[i].type == "text") {
                    let id = createId();
                    let label = document.createElement("label");
                    label.innerHTML = info[i].name;
                    label.className = "dialog-label";
                    label.setAttribute("for", id);
                    let textInput = document.createElement("input");
                    textInput.type = "text";
                    textInput.className = "dialog-text-input";
                    textInput.setAttribute("placeholder", info[i].name);
                    textInput.id = id;
                    if (info[i].default) textInput.value = info[i].default;
                    let wrapper = document.createElement("div");
                    wrapper.className = "dialog-text-label-wrapper";
                    contents[tab].appendChild(wrapper);
                    wrapper.appendChild(label);
                    wrapper.appendChild(textInput);
                    this.values.push({ "id": info[i].id, "element": textInput });
                } else if (info[i].type == "toggle") {
                    let label = document.createElement("label");
                    label.innerHTML = info[i].name;
                    label.className = "dialog-label";
                    let toggleEle = document.createElement("bottom");
                    let toggle = new Toggle(toggleEle, () => { }, info[i].default ?? false);
                    let wrapper = document.createElement("div");
                    wrapper.className = "dialog-text-label-wrapper-horizontal";
                    contents[tab].appendChild(wrapper);
                    wrapper.appendChild(toggleEle);
                    wrapper.appendChild(label);
                    this.values.push({ "id": info[i].id, "element": toggleEle });
                } else if (info[i].type == "image-upload") {
                    let wrapper = document.createElement("div");
                    wrapper.className = "dialog-text-label-wrapper";
                    let label = document.createElement("div");
                    label.innerHTML = info[i].name;
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
                    label.innerHTML = info[i].name;
                    label.className = "dialog-label";
                    wrapper.appendChild(label);
                    let element = document.createElement("div");
                    wrapper.appendChild(element);
                    contents[tab].appendChild(wrapper);
                    let multiSelect = new MultiSelect(element, info[i].options);
                    this.values.push({ "id": info[i].id, "element": multiSelect });
                } else if (info[i].type == "dropdown") {
                    let wrapper = document.createElement("div");
                    wrapper.className = "dialog-text-label-wrapper";
                    let label = document.createElement("div");
                    label.innerHTML = info[i].name;
                    label.className = "dialog-label";
                    wrapper.appendChild(label);
                    let element = document.createElement("div");
                    wrapper.appendChild(element);
                    contents[tab].appendChild(wrapper);
                    let multiSelect;
                    if (info[i].options.length >= 10 || info[i].source) {
                        multiSelect = new DialogDropdown("", info[i].options, element, info[i].options[0]?.value);
                    } else {
                        multiSelect = new SearchDropdown("", info[i].options, element, info[i].options[0]?.value, () => { });
                    }
                    if (info[i].source) {
                        for (let j = 0; j < this.values.length; j++) {
                            if (this.values[j].id != info[i].input_source) continue;
                            this.values[j].element.addOnChange(async (e) => {
                                let value = this.values[j].element.value;
                                let list = await info[i].source(value);
                                multiSelect.setOptions(list.map(e => ({ "name": e, "value": e })), list[0]);
                            });
                            let setInitialValues = async () => {
                                let value = this.values[j].element.value;
                                let list = await info[i].source(value);
                                multiSelect.setOptions(list.map(e => ({ "name": e, "value": e })), list[0]);
                            }
                            setInitialValues();
                        }
                    }
                    this.values.push({ "id": info[i].id, "element": multiSelect });
                }
            }
        }
        let dialogButtons = document.createElement("div");
        dialogButtons.className = "dialog-buttons";
        for (let i = 0; i < buttons.length; i++) {
            let buttonElement = document.createElement("button");
            buttonElement.className = "dialog-button";
            buttonElement.innerHTML = buttons[i].content;
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
    }
}

function showAddContent(instance_id, vanilla_version, loader) {
    added_vt_dp_packs = [];
    added_vt_rp_packs = [];
    content.innerHTML = "";
    let title = document.createElement("h1");
    title.innerHTML = "Add Content";
    if (!instance_id) title.innerHTML = "Discover";
    let ele = document.createElement("div");
    ele.classList.add("instance-content");
    ele.appendChild(title);
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
    if (!instance_id) {
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
        titleElement.innerHTML = `<div>${title}</div>`;
        top.appendChild(titleElement);
        let authorElement = document.createElement("div");
        authorElement.className = "discover-item-author";
        authorElement.innerHTML = `<div>by ${author}</div>`;
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
            tagElement.innerHTML = e;
            tagElement.className = "discover-item-tag";
            tagsElement.appendChild(tagElement);
        });
        if (downloadCount) {
            let downloadCountElement = document.createElement("div");
            downloadCountElement.innerHTML = /*'<i class="fa-solid fa-download"></i> ' + */formatNumber(downloadCount) + " downloads";
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
    if (tab == "modpack" || tab == "mod" || tab == "resourcepack" || tab == "shader" || tab == "world" || tab == "datapack") {
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
    if (tab == "world") {
        sources.push({
            "name": "Minecraft Maps",
            "value": "minecraft_maps",
            "func": () => { }
        });
    }
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

async function getContent(element, instance_id, source, query, loader, version, project_type, vt_version = selected_vt_version) {
    console.log("getting content for source", source);
    if (source == "modrinth") {
        //query, loader, project_type, version
        let apiresult = await window.electronAPI.modrinthSearch(query, loader, project_type, version);
        element.innerHTML = "";
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
                    await window.electronAPI.downloadModrinthPack(instance_id, version.files[0].url, i.title);
                    let mr_pack_info = await window.electronAPI.processMrPack(instance_id, `./minecraft/instances/${instance_id}/pack.mrpack`, info.loader, i.title);
                    // let newInstanceInfo = {
                    //     "name": info.name,
                    //     "last_played": "",
                    //     "date_created": (new Date()).toString(),
                    //     "date_modified": (new Date()).toString(),
                    //     "playtime": 0,
                    //     "loader": info.loader,
                    //     "vanilla_version": info.game_version,
                    //     "loader_version": mr_pack_info.loader_version,
                    //     "instance_id": instance_id,
                    //     "image": info.icon,
                    //     "downloaded": false,
                    //     "locked": false,
                    //     "content": mr_pack_info.content,
                    //     "group": "",
                    //     "install_source": "modrinth",
                    //     "install_project_id": i.project_id
                    // }
                    let instance = data.addInstance(info.name, new Date(), new Date(), "", info.loader, info.game_version, mr_pack_info.loader_version, false, true, "", info.icon, instance_id, 0, "modrinth", i.project_id);
                    mr_pack_info.content.forEach(e => {
                        instance.addContent(e.name, e.author, e.image, e.file_name, e.source, e.type, e.version, e.source_id, e.disabled);
                    });
                    showSpecificInstanceContent(instance);
                    window.electronAPI.downloadMinecraft(instance_id, info.loader, info.game_version, mr_pack_info.loader_version);
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
    } else if (source == "curseforge") {
        //query, loader, project_type, version
        let apiresult = await window.electronAPI.curseforgeSearch(query, loader, project_type, version);
        element.innerHTML = "";
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
                    let res = await fetch(`https://www.curseforge.com/api/v1/mods/${e.id}/files?pageIndex=0&pageSize=20&sort=dateCreated&sortDescending=true&removeAlphas=true`);
                    let version_json = await res.json();
                    let version = version_json.data[0];
                    await window.electronAPI.downloadCurseforgePack(instance_id, `https://mediafilez.forgecdn.net/files/${version.id.toString().substring(0,4)}/${version.id.toString().substring(4,7)}/${version.fileName}`, e.name);
                    let mr_pack_info = await window.electronAPI.processCfZip(instance_id, `./minecraft/instances/${instance_id}/pack.zip`, e.id, e.name);
                    // let newInstanceInfo = {
                    //     "name": info.name,
                    //     "last_played": "",
                    //     "date_created": (new Date()).toString(),
                    //     "date_modified": (new Date()).toString(),
                    //     "playtime": 0,
                    //     "loader": info.loader,
                    //     "vanilla_version": info.game_version,
                    //     "loader_version": mr_pack_info.loader_version,
                    //     "instance_id": instance_id,
                    //     "image": info.icon,
                    //     "downloaded": false,
                    //     "locked": false,
                    //     "content": mr_pack_info.content,
                    //     "group": "",
                    //     "install_source": "modrinth",
                    //     "install_project_id": i.project_id
                    // }
                    let instance = data.addInstance(info.name, new Date(), new Date(), "", mr_pack_info.loader, mr_pack_info.vanilla_version, mr_pack_info.loader_version, false, true, "", info.icon, instance_id, 0, "curseforge", e.id);
                    mr_pack_info.content.forEach(e => {
                        instance.addContent(e.name, e.author, e.image, e.file_name, e.source, e.type, e.version, e.source_id, e.disabled);
                    });
                    showSpecificInstanceContent(instance);
                    window.electronAPI.downloadMinecraft(instance_id, mr_pack_info.loader, mr_pack_info.vanilla_version, mr_pack_info.loader_version);
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
    } else if (source == "vanilla_tweaks") {
        let result;
        if (project_type == "resourcepack") {
            result = await window.electronAPI.getVanillaTweaksResourcePacks(query, version ? version : vt_version);
        } else if (project_type == "datapack") {
            result = await window.electronAPI.getVanillaTweaksDataPacks(query, version ? version : vt_version);
        }
        element.innerHTML = "";
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
                getContent(element, instance_id, source, query, loader, version, project_type, s);
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
        let res = await fetch(`https://www.curseforge.com/api/v1/mods/${project_id}/files?pageIndex=0&pageSize=100&sort=dateCreated&sortDescending=true&removeAlphas=true`);
        version_json = await res.json();
        version_json = version_json.data.map(e => ({
            "game_versions": e.gameVersions,
            "files": [
                {
                    "filename": e.fileName,
                    "url": `https://mediafilez.forgecdn.net/files/${e.id.toString().substring(0,4)}/${e.id.toString().substring(4,7)}/${e.fileName}`
                }
            ],
            "loaders": e.gameVersions.map(e => {
                return e.toLowerCase();
            }),
            "version_number": e.id,
            "dependencies": null // we dont support dependencies using cf
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
    if (!initialContent.type && project_type != "mod") {
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
    if (dependencies) {
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
    }
    // initialContent.name = title;
    // initialContent.source = source;
    // initialContent.version = version;
    // initialContent.disabled = false;
    // initialContent.author = author;
    // initialContent.image = icon_url;
    // initialContent.source_id = project_id;
    instance.addContent(title, author, icon_url, initialContent.file_name, source, initialContent.type, version, project_id, false);
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