let lang = null;
document.getElementsByTagName("title")[0].innerHTML = translate("app.name");
class MinecraftAccountSwitcher {
    constructor(element, playerInfo) {
        element.classList.add("player-switch");
        this.element = element;
        this.playerInfo = playerInfo;
        this.setPlayerInfo();
    }
    setPlayerInfo() {
        let playerInfo = this.playerInfo;
        if (playerInfo?.default_player) {
            this.element.setAttribute("popovertarget", "player-dropdown");
            this.element.innerHTML = `<img class="player-head" src="https://mc-heads.net/avatar/${playerInfo.default_player.uuid}/40"><div class="player-info"><div class="player-name">${playerInfo.default_player.name}</div><div class="player-desc">${translate("app.players.minecraft_account")}</div></div><div class="player-chevron"><i class="fa-solid fa-chevron-down"></i></div>`;
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
            if (!playerInfo.players) playerInfo.players = [];
            for (let i = 0; i < playerInfo.players.length; i++) {
                let playerElement = document.createElement("button");
                let selected = playerInfo.default_player.uuid == playerInfo.players[i].uuid;
                playerElement.classList.add("player-switch");
                if (!selected) playerElement.classList.add("not-selected");
                let playerImg = document.createElement("img");
                playerImg.classList.add("player-head");
                playerImg.src = `https://mc-heads.net/avatar/${playerInfo.players[i].uuid}/40`;
                playerElement.appendChild(playerImg);
                let playerInfoEle = document.createElement("div");
                playerInfoEle.classList.add("player-info");
                let playerName = document.createElement("div");
                playerName.classList.add("player-name");
                playerName.innerHTML = playerInfo.players[i].name;
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
                    this.onPlayerClickDelete(playerInfo.players[i]);
                });
                playerDelete.addEventListener('keydown', (e) => {
                    e.stopPropagation();
                    if (e.key == "Enter" || e.key == " ") {
                        this.onPlayerClickDelete(playerInfo.players[i]);
                    }
                });
                playerDelete.setAttribute("data-uuid", playerInfo.players[i].uuid);
                playerElement.appendChild(playerDelete);
                playerElement.addEventListener('click', (e) => this.onPlayerClick(playerInfo.players[i]));
                playerElement.setAttribute("data-uuid", playerInfo.players[i].uuid);
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
        if (!this.playerInfo.players) this.playerInfo.players = [];
        this.playerInfo.players.push(newPlayerInfo);
        this.playerInfo.default_player = newPlayerInfo;
        this.setPlayerInfo();
        data.profile_info = this.playerInfo;
        saveData();
    }
    selectPlayer(newPlayerInfo) {
        this.playerInfo.default_player = newPlayerInfo;
        this.element.innerHTML = `<img class="player-head" src="https://mc-heads.net/avatar/${newPlayerInfo.uuid}/40"><div class="player-info"><div class="player-name">${newPlayerInfo.name}</div><div class="player-desc">${translate("app.players.minecraft_account")}</div></div><div class="player-chevron"><i class="fa-solid fa-chevron-down"></i></div>`;
        for (let i = 0; i < this.playerElements.length; i++) {
            if (this.playerElements[i].getAttribute("data-uuid") != newPlayerInfo.uuid) {
                this.playerElements[i].classList.add("not-selected");
            } else {
                this.playerElements[i].classList.remove("not-selected");
            }
        }
        data.profile_info = this.playerInfo;
        saveData();
    }
    get getPlayerInfo() {
        return this.playerInfo;
    }
    onPlayerClick(e) {
        this.selectPlayer(e);
        if (this.dropdownElement) this.dropdownElement.hidePopover();
    }
    onPlayerClickDelete(e) {
        for (let i = 0; i < this.playerInfo.players.length; i++) {
            if (this.playerInfo.players[i].uuid == e.uuid) {
                this.playerInfo.players.splice(i, 1);
                break;
            }
        }
        if (this.playerInfo.default_player.uuid == e.uuid) {
            if (this.playerInfo.players.length >= 1) {
                this.playerInfo.default_player = this.playerInfo.players[0];
            } else {
                this.playerInfo = {};
            }
        }
        data.profile_info = this.playerInfo;
        this.setPlayerInfo();
        saveData();
    }
    get getCurrentPlayer() {
        return this.playerInfo.default_player;
    }
}

class NavigationButton {
    constructor(element, title, icon, content) {
        this.element = element;
        this.title = title;
        element.onclick = (e) => {
            for (let i = 0; i < navButtons.length; i++) {
                navButtons[i].removeSelected();
            }
            this.setSelected();
            content.displayContent();
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
        content.innerHTML = "";
        content.appendChild(this.func());
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
        name.innerHTML = translate("app.instances.no_running");
        this.nameElement = name;
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
            buttonElement.onclick = (e) => {
                this.selectOption(options[i].value);
                let oldLeft = this.offset_left;
                this.offset_left = buttonElement.offsetLeft;
                this.offset_right = element.offsetWidth - buttonElement.offsetLeft - buttonElement.offsetWidth;
                element.style.setProperty("--left", this.offset_left + "px");
                element.style.setProperty("--right", this.offset_right + "px");
                element.style.setProperty("--transition", oldLeft < this.offset_left ? "right .125s, left .125s .125s" : "right .125s .125s, left .125s");
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
        element.style.setProperty("--transition", oldLeft < this.offset_left ? "right .125s, left .125s .125s" : "right .125s .125s, left .125s");
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
        opt.func();
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
                buttons.buttons[i].func(e);
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
                buttons.buttons[i].func(e);
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
        this.options = options;
        this.element = element;
        this.selected = initial;
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
        let name = "";
        for (let i = 0; i < this.options.length; i++) {
            if (this.options[i].value == initial) {
                name = this.options[i].name;
                break;
            }
        }
        dropdownSelected.innerHTML = name;
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
        this.optEles = [];
        for (let i = 0; i < options.length; i++) {
            let optEle = document.createElement("button");
            optEle.classList.add("dropdown-item");
            optEle.innerHTML = options[i].name;
            optEle.onclick = (e) => {
                this.onchange(options[i].value);
                this.selectOption(options[i].value);
            }
            if (options[i].value == initial) {
                optEle.classList.add("selected");
            }
            dropdownList.appendChild(optEle);
            this.optEles.push(optEle);
        }
        element.appendChild(dropdownList);
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
        this.popover.hidePopover();
    }
    get getSelected() {
        return this.selected;
    }
    setOnChange(onchange) {
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
            element.classList.add("toggled");
        } else {
            this.toggled = false;
        }
    }
    processToggle() {
        if (this.toggled) {
            this.element.classList.remove("toggled");
        } else {
            this.element.classList.add("toggled");
        }
        this.toggled = !this.toggled;
        this.onchange();
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
            if (features?.more?.enabled) {
                contentEle.oncontextmenu = (e) => {
                    contextmenu.showContextMenu(content[i].more.actionsList, e.clientX, e.clientY);
                }
            }
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
            imageElement.src = content[i].image ? content[i].image : "https://picsum.photos/40";
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
            if (features?.disable?.enabled) {
                let toggleElement = document.createElement("button");
                toggleElement.className = 'content-list-toggle';
                let toggle = new Toggle(toggleElement, () => { }, !content[i].disabled);
                contentEle.appendChild(toggleElement);
            }
            if (features?.remove?.enabled) {
                let removeElement = document.createElement("button");
                removeElement.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
                removeElement.className = 'content-list-remove';
                contentEle.appendChild(removeElement);
            }
            if (features?.more?.enabled) {
                let moreElement = document.createElement("button");
                moreElement.innerHTML = '<i class="fa-solid fa-ellipsis-vertical"></i>';
                moreElement.className = 'content-list-more';
                let moreDropdown = new MoreMenu(moreElement, content[i].more.actionsList);
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

let homeContent = new PageContent(showHomeContent, translate("app.page.home"));
let instanceContent = new PageContent(showInstanceContent, translate("app.page.instances"));
let worldContent = new PageContent(showWorldContent, translate("app.page.discover"));
let myAccountContent = new PageContent(showMyAccountContent, translate("app.page.my_account"));
let contextmenu = new ContextMenu();
let homeButton = new NavigationButton(homeButtonEle, translate("app.page.home"), '<i class="fa-solid fa-house"></i>', homeContent);
let instanceButton = new NavigationButton(instanceButtonEle, translate("app.page.instances"), '<i class="fa-solid fa-book"></i>', instanceContent);
let worldButton = new NavigationButton(worldButtonEle, translate("app.page.discover"), '<i class="fa-solid fa-compass"></i>', worldContent);
let myAccountButton = new NavigationButton(myAccountButtonEle, translate("app.page.my_account"), '<i class="fa-solid fa-user"></i>', myAccountContent);

let navButtons = [homeButton, instanceButton, worldButton, myAccountButton];

async function toggleMicrosoftSignIn() {
    let newData = await window.electronAPI.triggerMicrosoftLogin();
    if (data.profile_info?.players) {
        for (let i = 0; i < data.profile_info.players.length; i++) {
            if (newData.uuid == data.profile_info.players[i].uuid) {
                // data.profile_info.players = newData;
                accountSwitcher.selectPlayer(newData);
                // saveData();
                return;
            }
        }
    }
    // data.profile_info.players.push(newData);
    accountSwitcher.addPlayer(newData);
    // saveData();
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
    data.default_sort = how;
    let attrhow = how.toLowerCase().replaceAll("_", "-");
    attrhow = "data-" + attrhow;
    let groups = document.getElementsByClassName("group");
    let usedates = (how == "last_played" || how == "date_created" || how == "date_modified")
    let usenumbers = (how == "play_time");
    let reverseOrder = ["last_played", "date_created", "date_modified", "play_time", "game_version"].includes(how);
    let multiply = reverseOrder ? -1 : 1;
    for (let i = 0; i < groups.length; i++) {
        [...groups[i].children].sort((a, b) => {
            if (usedates) {
                return multiply * (new Date(a.getAttribute(attrhow)) - new Date(b.getAttribute(attrhow)));
            }
            if (usenumbers) {
                return multiply * (a.getAttribute(attrhow) - b.getAttribute(attrhow));
            }
            if (a.getAttribute(attrhow).toLowerCase() > b.getAttribute(attrhow).toLowerCase()) {
                return 1 * multiply;
            }
            if (a.getAttribute(attrhow).toLowerCase() < b.getAttribute(attrhow).toLowerCase()) {
                return -1 * multiply;
            }
            return 0;
        }).forEach((e) => { groups[i].appendChild(e) });
    }
}
function groupInstances(how) {
    data.default_group = how;
    let attrhow = how.toLowerCase().replaceAll("_", "-");
    attrhow = "data-" + attrhow;
    let newGroups = [];
    let instances = document.querySelectorAll(".group-list .instance-item");
    for (let i = 0; i < instances.length; i++) {
        if (!newGroups.includes(instances[i].getAttribute(attrhow))) {
            newGroups.push(instances[i].getAttribute(attrhow));
        }
    }
    let groups = document.getElementsByClassName("group");
    [...groups].forEach((e) => { e.remove(); });
    let elementDictionary = {};
    for (let i = 0; i < newGroups.length; i++) {
        let newElement = document.createElement("div");
        newElement.classList.add("group");
        newElement.setAttribute("data-group-title", how == "loader" ? loaders[newGroups[i]] : newGroups[i]);
        document.getElementsByClassName("group-list")[0].appendChild(newElement);
        elementDictionary[newGroups[i]] = newElement;
    }
    for (let i = 0; i < instances.length; i++) {
        elementDictionary[instances[i].getAttribute(attrhow)].appendChild(instances[i]);
    }
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
    data.instances.sort((a, b) => {
        if (a.name.toLowerCase() > b.name.toLowerCase()) return 1;
        if (a.name.toLowerCase() < b.name.toLowerCase()) return -1;
        return 0;
    });
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
    { "name": translate("app.instances.sort.game_version"), "value": "game_version" }], sort, data.default_sort, sortInstances);
    let group = document.createElement('div');
    let groupBy = new SearchDropdown(translate("app.instances.group.by"), [{ "name": translate("app.instances.group.none"), "value": "none" }, { "name": translate("app.instances.group.custom_groups"), "value": "custom_groups" }, { "name": translate("app.instances.group.loader"), "value": "loader" }, { "name": translate("app.instances.group.game_version"), "value": "game_version" }], group, data.default_group, groupInstances);
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
    for (let i = 0; i < data.instances.length; i++) {
        let running = checkForProcess(data.instances[i].pid);
        let instanceElement = document.createElement("button");
        instanceElement.setAttribute("data-name", data.instances[i].name);
        instanceElement.setAttribute("data-last-played", data.instances[i].last_played);
        instanceElement.setAttribute("data-date-created", data.instances[i].date_created);
        instanceElement.setAttribute("data-date-modified", data.instances[i].date_modified);
        instanceElement.setAttribute("data-play-time", data.instances[i].playtime);
        instanceElement.setAttribute("data-game-version", data.instances[i].vanilla_version);
        instanceElement.setAttribute("data-custom-groups", data.instances[i].group);
        instanceElement.setAttribute("data-loader", data.instances[i].loader);
        instanceElement.setAttribute("data-none", "");
        instanceElement.onclick = (e) => {
            showSpecificInstanceContent(data.instances[i]);
        }
        instanceElement.classList.add("instance-item");
        if (running) instanceElement.classList.add("running");
        let instanceImage = document.createElement("img");
        instanceImage.classList.add("instance-image");
        if (data.instances[i].image) {
            instanceImage.src = data.instances[i].image;
        } else {
            instanceImage.src = "https://picsum.photos/40";
        }
        instanceElement.appendChild(instanceImage);
        let instanceInfoEle = document.createElement("div");
        instanceInfoEle.classList.add("instance-info");
        let instanceName = document.createElement("div");
        instanceName.classList.add("instance-name");
        instanceName.innerHTML = data.instances[i].name;
        instanceInfoEle.appendChild(instanceName);
        let instanceDesc = document.createElement("div");
        instanceDesc.classList.add("instance-desc");
        instanceDesc.innerHTML = loaders[data.instances[i].loader] + " " + data.instances[i].vanilla_version;
        instanceInfoEle.appendChild(instanceDesc);
        instanceElement.appendChild(instanceInfoEle);
        let buttons = new ContextMenuButtons([
            {
                "icon": running ? '<i class="fa-solid fa-circle-stop"></i>' : '<i class="fa-solid fa-play"></i>',
                "title": running ? translate("app.button.instances.stop") : translate("app.button.instances.play"),
                "func": running ? (e) => {
                    stopInstance(data.instances[i]);
                } : (e) => {
                    playInstance(data.instances[i]);
                }
            },
            {
                "icon": '<i class="fa-solid fa-plus"></i>',
                "title": translate("app.button.content.add"),
                "func": (e) => { }
            },
            {
                "icon": '<i class="fa-solid fa-eye"></i>',
                "title": translate("app.button.instances.view"),
                "func": (e) => {
                    showSpecificInstanceContent(data.instances[i]);
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
                    window.electronAPI.openFolder(`./minecraft/instances/${data.instances[i].instance_id}`);
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
        instanceElement.oncontextmenu = (e) => {
            contextmenu.showContextMenu(buttons, e.clientX, e.clientY);
        }
        groupOne.appendChild(instanceElement);
    }
    return ele;
}
function showSpecificInstanceContent(instanceInfo) {
    let running = checkForProcess(instanceInfo.pid);
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
        instImg.src = "https://picsum.photos/100";
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
    if (!running) {
        playButton.classList.add("instance-top-play-button");
        playButton.innerHTML = '<i class="fa-solid fa-play"></i>' + translate("app.button.instances.play_short");
        playButton.onclick = (e) => {
            playInstance(instanceInfo);
        }
    } else {
        playButton.classList.add("instance-top-stop-button");
        playButton.innerHTML = '<i class="fa-solid fa-circle-stop"></i>' + translate("app.button.instances.stop_short");
        playButton.onclick = (e) => {
            stopInstance(instanceInfo);
        }
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
            "func": (e) => { }
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
        }
    ]);
}

function setInstanceTabContentContent(instanceInfo, element) {
    let searchAndFilter = document.createElement("div");
    searchAndFilter.classList.add("search-and-filter-v2");
    let addContent = document.createElement("button");
    addContent.classList.add("add-content-button");
    addContent.innerHTML = '<i class="fa-solid fa-plus"></i>' + translate("app.button.content.add")
    let contentSearch = document.createElement("div");
    contentSearch.style.flexGrow = 2;
    let searchBar = new SearchBar(contentSearch, searchInstanceContent, null);
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
    ], typeDropdown, "all", filterContent);
    typeDropdown.style.minWidth = "200px";
    searchAndFilter.appendChild(contentSearch);
    searchAndFilter.appendChild(typeDropdown);
    searchAndFilter.appendChild(addContent);
    element.innerHTML = "";
    element.appendChild(searchAndFilter);
    let contentListWrap = document.createElement("div");
    let old_file_names = instanceInfo.content.map((e) => e.file_name);
    let newContent = getInstanceContent(instanceInfo);
    let newContentAdd = newContent.newContent.filter((e) => !old_file_names.includes(e.file_name));
    instanceInfo.content = instanceInfo.content.concat(newContentAdd);
    saveData();
    let deleteContent = newContent.deleteContent;
    instanceInfo.content = instanceInfo.content.filter(e => !deleteContent.includes(e.file_name));
    let content = [];
    for (let i = 0; i < instanceInfo.content.length; i++) {
        let e = instanceInfo.content[i];
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
                "actionsList": new ContextMenuButtons([
                    {
                        "title": translate("app.content.open"),
                        "icon": '<i class="fa-solid fa-up-right-from-square"></i>',
                        "func": () => { }
                    },
                    {
                        "title": translate("app.content.update"),
                        "icon": '<i class="fa-solid fa-download"></i>',
                        "func": () => { }
                    },
                    {
                        "title": e.disabled ? translate("app.content.enable") : translate("app.content.disable"),
                        "icon": e.disabled ? '<i class="fa-solid fa-eye"></i>' : '<i class="fa-solid fa-eye-slash"></i>',
                        "func": () => { }
                    },
                    {
                        "title": translate("app.content.delete"),
                        "icon": '<i class="fa-solid fa-trash-can"></i>',
                        "danger": true,
                        "func": () => { }
                    }
                ])
            },
            "disabled": e.disabled
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
    let searchBar = new SearchBar(contentSearch, searchInstanceContent, null);
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
    ], typeDropdown, "all", filterContent);
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
                "image": worlds[i].icon ?? "https://picsum.photos/40",
                "more": {
                    "actionsList": new ContextMenuButtons([
                        {
                            "title": translate("app.worlds.play"),
                            "icon": '<i class="fa-solid fa-play"></i>',
                            "func": () => {
                                playSingleplayerWorld(instanceInfo, worlds[i].id);
                            }
                        },
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
                            "func": () => { }
                        }
                    ])
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
                "image": worldsMultiplayer[i].icon ?? "https://picsum.photos/40",
                "more": {
                    "actionsList": new ContextMenuButtons([
                        {
                            "title": translate("app.worlds.play"),
                            "icon": '<i class="fa-solid fa-play"></i>',
                            "func": () => {
                                playMultiplayerWorld(instanceInfo, worldsMultiplayer[i].ip);
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
                            "func": () => { }
                        }
                    ])
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
    element.innerHTML = "";
}
function setInstanceTabContentOptions(instanceInfo, element) {
    element.innerHTML = "";
}

function searchInstanceContent(s) {

}

function filterContent() {

}

async function playInstance(instInfo, quickPlay = null) {
    // loader,version,loaderVersion,instance_id,player_info
    let pid = await window.electronAPI.playMinecraft(instInfo.loader, instInfo.vanilla_version, instInfo.loader_version, instInfo.instance_id, accountSwitcher.getPlayerInfo.default_player, quickPlay);
    if (!pid) return;
    for (let i = 0; i < data.instances.length; i++) {
        if (data.instances[i].instance_id == instInfo.instance_id) {
            data.instances[i].pid = pid.minecraft.pid;
            data.instances[i].current_log_file = pid.minecraft.log;
            data.instances[i].java_path = pid.minecraft.java_path;
            data.instances[i].java_version = pid.minecraft.java_version;
        }
    }
    data.profile_info.default_player = pid.player_info;
    if (data.profile_info.players) {
        for (let i = 0; i < data.profile_info.players.length; i++) {
            if (pid.player_info.uuid == data.profile_info.players[i].uuid) {
                data.profile_info.players[i] = pid.player_info;
            }
        }
    }
    saveData();
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
    return translate("app.date").replace("%m", months[date.getMonth()]).replace("%d", date.getDate()).replace("%y", date.getFullYear());
}

function showWorldContent(e) {
    let ele = document.createElement("div");
    ele.innerHTML = 'Worlds';
    return ele;
}

let data = null;

function loadFile() {
    data = JSON.parse(window.electronAPI.readFile("data.json"));
}

function getLangFile(locale) {
    return JSON.parse(window.electronAPI.readFile(`./lang/${locale}.json`));
}

function saveData() {
    let success = window.electronAPI.saveData(JSON.stringify(data));
    if (!success) {
        console.error("Error saving data");
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
    return window.electronAPI.getInstanceContent(instanceInfo.loader, instanceInfo.instance_id,instanceInfo.content);
}

function translate(key) {
    if (!lang) {
        lang = getLangFile("en-us");
    }
    return lang[key];
}

loadFile();

let accountSwitcher = new MinecraftAccountSwitcher(playerSwitch, data.profile_info);

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