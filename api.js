class Project {
    static modrinth_project_type_conversion = {
        "resourcepack": "resource_pack",
        "minecraft_java_server": "server"
    }
    static curseforge_project_type_conversion = {
        6: "mod",
        4471: "modpack",
        12: "resourcepack",
        6552: "shader",
        17: "world",
        6945: "datapack"
    }
    static curseforge_mod_loader_conversion = {
        1: "forge",
        4: "fabric",
        5: "quilt",
        6: "neoforge"
    }
    static curseforge_mod_loader_conversion_vice_versa = {
        "forge": 1,
        "fabric": 4,
        "quilt": 5,
        "neoforge": 6
    }
    static curseforge_release_type_conversion = {
        1: "release",
        2: "beta",
        3: "alpha"
    }
    constructor() { }
    applyInfoFromModrinth(urlInfo) {
        this.source = "modrinth";
        this.id = urlInfo.id || urlInfo.project_id;
        this.slug = urlInfo.slug;
        this.team = urlInfo.team_id;
        this.project_type = Project.modrinth_project_type_conversion[urlInfo.project_types[0]] || urlInfo.project_types[0];
        this.name = urlInfo.name;
        this.summary = urlInfo.summary;
        this.description = urlInfo.description;
        this.published = new Date(urlInfo.published);
        this.updated = new Date(urlInfo.updated);
        this.downloads = urlInfo.downloads;
        this.categories = [...new Set(urlInfo.categories.map(e => "app.category." + e))].filter(e => e != "app.loader.mrpack" && e != "app.category.minecraft" && e != "app.loader.datapack" && e != "app.category.iris" && e != "app.category.optifine");
        this.icon = urlInfo.icon_url;
        this.links = {};
        this.links.source = urlInfo.link_urls?.source?.url;
        this.links.issues = urlInfo.link_urls?.issues?.url;
        this.links.wiki = urlInfo.link_urls?.wiki?.url;
        this.links.discord = urlInfo.link_urls?.discord?.url;
        this.links.donations = urlInfo.link_urls ? Object.entries(urlInfo.link_urls).map(e => e[1]).filter(e => e.donation) : [];
        this.links.browser = `https://modrinth.com/project/${this.id}`;
        this.gallery = urlInfo.gallery.map(e => new GalleryImage(e, "modrinth"));
        this.loaders = [...new Set((urlInfo.mrpack_loaders || []).concat(urlInfo.loaders || []).concat(urlInfo.project_loader_files?.mrpack_loaders || []))];
        this.game_versions = urlInfo.minecraft_java_server?.content?.kind == "vanilla" ? urlInfo.minecraft_java_server.content.supported_game_versions : urlInfo.project_loader_fields ? urlInfo.project_loader_fields.game_versions : urlInfo.game_versions;
        this.online_players = urlInfo.minecraft_java_server?.ping?.data?.players_online ?? null;
        this.max_players = urlInfo.minecraft_java_server?.ping?.data?.players_max ?? null;
        this.ip_address = urlInfo.minecraft_java_server?.address || null;
        this.server_modpack = urlInfo.minecraft_java_server?.content;
        if (urlInfo.minecraft_java_server) {
            this.project_type = "server";
        }
        this.uses_markdown_description = true;
        if (urlInfo.author) {
            this.authors = [new Author(urlInfo.author)];
        }
    }
    applyInfoFromCurseForge(urlInfo) {
        this.source = "curseforge";
        this.id = urlInfo.id;
        this.gallery = urlInfo.screenshots.map(e => new GalleryImage(e, "curseforge"));
        this.name = urlInfo.name;
        this.slug = urlInfo.slug;
        this.links = {};
        this.links.browser = urlInfo.links?.websiteUrl;
        this.links.wiki = urlInfo.links?.wikiUrl;
        this.links.issues = urlInfo.links?.issuesUrl;
        this.links.source = urlInfo.links?.sourceUrl;
        this.links.mastodon = urlInfo.socialLinks?.filter(e => e.type == 1)[0]?.url,
            this.links.discord = urlInfo.socialLinks?.filter(e => e.type == 2)[0]?.url,
            this.links.website = urlInfo.socialLinks?.filter(e => e.type == 3)[0]?.url,
            this.links.facebook = urlInfo.socialLinks?.filter(e => e.type == 4)[0]?.url,
            this.links.twitter = urlInfo.socialLinks?.filter(e => e.type == 5)[0]?.url,
            this.links.instagram = urlInfo.socialLinks?.filter(e => e.type == 6)[0]?.url,
            this.links.patreon = urlInfo.socialLinks?.filter(e => e.type == 7)[0]?.url,
            this.links.twitch = urlInfo.socialLinks?.filter(e => e.type == 8)[0]?.url,
            this.links.reddit = urlInfo.socialLinks?.filter(e => e.type == 9)[0]?.url,
            this.links.youtube = urlInfo.socialLinks?.filter(e => e.type == 10)[0]?.url,
            this.links.tiktok = urlInfo.socialLinks?.filter(e => e.type == 11)[0]?.url,
            this.links.pinterest = urlInfo.socialLinks?.filter(e => e.type == 12)[0]?.url,
            this.links.github = urlInfo.socialLinks?.filter(e => e.type == 13)[0]?.url,
            this.links.bluesky = urlInfo.socialLinks?.filter(e => e.type == 14)[0]?.url
        this.summary = urlInfo.summary;
        this.downloads = urlInfo.downloadCount;
        this.project_type = Project.curseforge_project_type_conversion[urlInfo.classId];
        this.categories = urlInfo.categories.map(e => e.name);
        this.authors = urlInfo.authors.map(e => new Author(e, "curseforge"));
        this.icon = urlInfo.logo?.thumbnailUrl || urlInfo.logo?.url || "";
        this.published = new Date(urlInfo.dateCreated);
        this.updated = new Date(urlInfo.dateModified);
        this.loaders = [...new Set(urlInfo.latestFilesIndexes.map(e => Project.curseforge_mod_loader_conversion[e.modLoader]))];
        this.game_versions = [...new Set(urlInfo.latestFilesIndexes.map(e => e.gameVersion))];
    }
    setDescription(description) {
        this.description = description;
    }
    async getInfoFromId(id, source) {
        if (source == "modrinth") {
            let url = `https://api.modrinth.com/v3/project/${id}`;
            let urlInfo = await (await fetch(url)).json();
            this.applyInfoFromModrinth(urlInfo);
        } else if (source == "curseforge") {
            let url = `https://api.curse.tools/v1/mods/${id}`;
            let urlInfo = await (await fetch(url)).json();
            urlInfo = urlInfo.data;
            this.applyInfoFromCurseForge(urlInfo);
            this.setDescription((await (await fetch(url + "/description")).json()).data);
        }
    }
    async getInfoFromSlug(slug, source) {
        if (source == "modrinth") {
            let url = `https://api.modrinth.com/v3/project/${slug}`;
            let urlInfo = await (await fetch(url)).json();
            this.applyInfoFromModrinth(urlInfo);
        } else if (source == "curseforge") {
            let class_id = Number(slug.split(":")[1]);
            slug = slug.split(":")[0];
            let url = `https://api.curse.tools/v1/cf/mods/search?gameId=432&slug=${slug}&classId=${class_id}`;
            let urlInfo = await (await fetch(url)).json();
            this.applyInfoFromCurseForge(urlInfo.data[0]);
            this.setDescription((await (await fetch(`https://api.curse.tools/v1/mods/${urlInfo.data[0].id}/description`)).json()).data);
        }
    }
    applyInfoFromCurseForgeServers(urlInfo) {
        this.icon = urlInfo.favicon;
        this.name = urlInfo.name;
        this.project_type = "server";
        this.online_players = urlInfo.latestPing.online;
        this.max_players = urlInfo.latestPing.total;
        this.source = "curseforge";
        this.updated = new Date(urlInfo.latestPing.pingedAt);
        this.ip_address = urlInfo.serverConnection;
        this.id = urlInfo.serverConnection;
        this.links = {};
        this.links.browser = `https://www.curseforge.com/servers/minecraft/game/${urlInfo.slug}`;
        this.links.discord = (urlInfo.discord?.startsWith("https://") || urlInfo.discord?.startsWith("http://")) ? urlInfo.discord : (urlInfo.discord ? `https://discord.gg/${urlInfo.discord}` : null);
        this.links.discord = (urlInfo.twitter?.startsWith("https://") || urlInfo.twitter?.startsWith("http://")) ? urlInfo.twitter : (urlInfo.twitter ? `https://x.com/${urlInfo.twitter}` : null);
        this.description = urlInfo.description;
        this.summary = urlInfo.serverConnection;
    }
    async getAllVersions(id, source) {
        if ((this.versions?.length || 0) > 0) return;
        if (id) this.id = id;
        if (source) this.source = source;
        this.versions = [];
        if (this.source == "modrinth") {
            let url = `https://api.modrinth.com/v3/project/${this.id}/version?include_changelog=false`;
            let urlInfo = await (await fetch(url)).json();
            urlInfo = urlInfo.filter(e => e.name != "__synthetic");
            this.versions = urlInfo.map(e => new ProjectVersion(e, "modrinth"));
        } else if (this.source == "curseforge") {
            let url = `https://api.curse.tools/v1/mods/${this.id}/files?pageSize=50&index=0`;
            let urlInfo = await (await fetch(url)).json();
            this.versions = urlInfo.data.map(e => new ProjectVersion(e, "curseforge"));
            let pages = Math.ceil(urlInfo.pagination.totalCount / 50);
            for (let i = 1; i <= pages; i++) {
                let url = `https://api.curse.tools/v1/mods/${this.id}/files?pageSize=50&index=${50 * i}`;
                let urlInfo = await (await fetch(url)).json();
                this.versions = this.versions.concat(urlInfo.data.map(e => new ProjectVersion(e, "curseforge")));
            }
        }
    }
    static async getCurseForgeVersionPage(page, id) {
        let url = `https://api.curse.tools/v1/mods/${id}/files?pageSize=50&index=${page * 50 - 50}`;
        let urlInfo = await (await fetch(url)).json();
        return { versions: urlInfo.data.map(e => new ProjectVersion(e, "curseforge")), max_pages: Math.ceil(urlInfo.pagination.totalCount / 50)};
    }
    async getVersion(loader, game_version, project_type, id, source) {
        if (!project_type && this.project_type) project_type = this.project_type;
        let num = Number(id);
        if (!isNaN(num)) id = num;
        let loaderRequired = project_type == "mod" || project_type == "modpack";
        if (source == "modrinth" && !this.versions) {
            await this.getAllVersions(id, source);
        }
        if (this.versions) {
            for (let i = 0; i < this.versions.length; i++) {
                let version = this.versions[i];
                if (version.game_versions.includes(game_version) && (!loaderRequired || version.loaders.includes(loader))) {
                    return version;
                }
            }
            return false;
        }
        if (source == "curseforge") {
            let url = `https://api.curse.tools/v1/mods/${id}/files?pageSize=50&index=0&gameVersion=${game_version}${loaderRequired ? "&modLoaderType=" + Project.curseforge_mod_loader_conversion_vice_versa[loader] : ""}`;
            let urlInfo = await (await fetch(url)).json();
            return new ProjectVersion(urlInfo.data[0], "curseforge");
        }
    }
    async getAuthors() {
        if ((this.authors?.length || 0) > 0 && this.authors[0].id) return;
        if (this.source == "modrinth") {
            let url = `https://api.modrinth.com/v3/project/${this.id}/members`;
            let urlInfo = await (await fetch(url)).json();
            this.authors = urlInfo.map(e => new Author(e, "modrinth"));
        }
    }
    static async getFromId(id, source) {
        let project = new Project();
        await project.getInfoFromId(id, source);
        return project;
    }
    static async getFromSlug(slug, source, class_id) {
        let project = new Project();
        await project.getInfoFromSlug(slug, source, class_id);
        return project;
    }
}

class ProjectList {
    constructor(project_id_list, source) {
        this.project_id_list = project_id_list;
        this.source = source;
        if (this.source == "curseforge") {
            this.project_id_list = this.project_id_list.map(e => Number(e));
        }
    }

    async getProjects() {
        this.projects = [];
        if (this.source == "modrinth") {
            let url = `https://api.modrinth.com/v3/projects?ids=["${this.project_id_list.join('","')}"]`;
            let urlInfo = await (await fetch(url)).json();
            urlInfo.forEach(e => {
                let project = new Project();
                project.applyInfoFromModrinth(e);
                this.projects.push(project);
            });
            this.teams = [...new Set(urlInfo.map(e => e.team))];
        } else if (this.source == "curseforge") {
            let urlInfo;
            let response = await fetch("https://api.curse.tools/v1/mods", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ modIds: this.project_id_list, filterPcOnly: false })
            });
            if (response.ok) {
                const json = await response.json();
                urlInfo = json.data || [];
            }
            urlInfo.forEach(e => {
                let project = new Project();
                project.applyInfoFromCurseForge(e);
                this.projects.push(project);
            });
        }
    }

    async getAuthors() {
        if (this.source == "modrinth") {
            let url = `https://api.modrinth.com/v3/teams?ids=["${this.teams.join('","')}"]`;
            let urlInfo = await (await fetch(url)).json();
            for (let i = 0; i < urlInfo.length; i++) {
                let authors = [];
                for (let j = 0; j < urlInfo[i].length; j++) {
                    let author = new Author(urlInfo[i][j], "modrinth");
                    authors.push(author);
                }
                for (let j = 0; j < this.projects.length; i++) {
                    if (this.projects[j].team == urlInfo[i].id) {
                        this.projects[j].authors = authors;
                    }
                }
            }
        }
    }
}

class ProjectVersionList {
    constructor(version_id_list, source) {
        this.version_id_list = version_id_list;
        this.source = source;
        if (this.source == "curseforge") {
            this.version_id_list = this.version_id_list.map(e => Number(e));
        }
    }

    async getVersions() {
        this.versions = [];
        if (this.source == "modrinth") {
            let url = `https://api.modrinth.com/v3/versions?ids=["${this.version_id_list.join('","')}"]`;
            let urlInfo = await (await fetch(url)).json();
            urlInfo.forEach(e => {
                let version = new ProjectVersion(e, "modrinth");
                this.versions.push(version);
            });
            this.project_id_list = urlInfo.map(e => e.project_id);
        } else if (this.source == "curseforge") {

        }
    }

    async getProjectList() {
        let projectList = new ProjectList(this.project_id_list, this.source);
        this.projectList = projectList;
        return projectList;
    }
}

class ProjectVersion {
    constructor(info, source) {
        this.source = source;
        if (source == "modrinth") {
            this.version_id = info.id;
            this.project_id = info.project_id;
            this.name = info.name;
            this.version_number = info.version_number;
            this.published = new Date(info.date_published);
            this.downloads = info.downloads;
            this.channel = info.version_type;
            this.loaders = info.mrpack_loaders || info.loaders;
            this.game_versions = info.game_versions;
            this.required_dependencies = info.dependencies.filter(e => e.dependency_type == "required").map(e => ({ version_id: e.version_id, project_id: e.project_id }));
            this.download_url = info.files[0]?.url;
            this.filename = info.files[0]?.filename;
            this.uses_markdown_description = true;
        } else if (source == "curseforge") {
            this.version_id = info.id;
            this.project_id = info.modId;
            this.name = info.displayName || info.id;
            this.version_number = "";
            this.filename = info.fileName;
            this.channel = Project.curseforge_release_type_conversion[info.releaseType];
            this.published = new Date(info.fileDate);
            this.downloads = info.downloadCount;
            this.download_url = info.downloadUrl;
            this.game_versions = info.sortableGameVersions.map(e => e.gameVersion).filter(e => e);
            this.loaders = info.sortableGameVersions.filter(e => !e.gameVersion).map(e => e.gameVersionName.toLowerCase()).filter(e => e != "client" && e != "server");
            this.required_dependencies = info.dependencies.filter(e => e.relationType == 3).map(e => ({ project_id: e.modId }));
        }
    }
    async getChangelog(callback, errorCallback) {
        if (this.changelog) {
            callback(this.changelog);
            return this.changelog;
        }
        try {
            if (this.source == "modrinth") {
                let url = `https://api.modrinth.com/v3/project/${this.project_id}/version/${this.version_id}`;
                let urlInfo = await (await fetch(url)).json();
                this.changelog = urlInfo.changelog;
            } else if (this.source == "curseforge") {
                let url = `https://api.curse.tools/v1/cf/mods/${this.project_id}/files/${this.version_id}/changelog`;
                let urlInfo = await (await fetch(url)).json();
                this.changelog = urlInfo.data;
            }
            callback(this.changelog);
            return this.changelog;
        } catch (err) {
            errorCallback(err);
            return false;
        }
    }
    static async getFromId(version_id, project_id, source) {
        if (source == "modrinth") {
            let url = `https://api.modrinth.com/v3/project/${project_id}/version/${version_id}`;
            let urlInfo = await (await fetch(url)).json();
            return new ProjectVersion(urlInfo, "modrinth");
        } else if (source == "curseforge") {
            let url = `https://api.curse.tools/v1/mods/${project_id}/files/${version_id}`;
            let urlInfo = (await (await fetch(url)).json()).data;
            return new ProjectVersion(urlInfo, "curseforge");
        }
    }
}

class GalleryImage {
    constructor(info, source) {
        if (source == "modrinth") {
            this.thumbnail_url = info.url;
            this.url = info.raw_url;
            this.name = info.name;
            this.description = info.description;
        } else if (source == "curseforge") {
            this.thumbnail_url = info.thumbnailUrl;
            this.url = info.url;
            this.name = info.title;
            this.description = info.description;
        }
    }
}

class Author {
    constructor(info, source) {
        if (source == "modrinth") {
            this.name = info.user.username;
            this.url = `https://modrinth.com/user/${info.user.id}`;
            this.avatar = info.user.avatar_url;
            this.bio = info.user.bio || "";
            this.id = info.user.id;
            this.role = info.role;
        } else if (source == "curseforge") {
            this.name = info.name;
            this.url = info.url;
            this.avatar = info.avatarUrl;
            this.id = info.id;
            this.bio = "";
            this.role = "";
        } else {
            this.name = info;
        }
    }
}

class Modrinth {
    static async search(query, loader, project_type, version, page = 1, pageSize = 20, sortBy = "relevance") {
        if (project_type == "server") project_type = "minecraft_java_server";
        let sort = sortBy;
        let facets = [];
        if (loader && ["modpack", "mod"].includes(project_type)) facets.push("categories IN [\"" + loader + "\"]");
        if (loader && ["minecraft_java_server"].includes(project_type)) facets.push("minecraft_java_server.content.kind IN [\"" + loader + "\"]");
        if (version) facets.push("(game_versions IN [\"" + version + "\"] OR minecraft_java_server.content.supported_game_versions IN [\"" + version + "\"])");
        facets.push("project_types = " + project_type);
        let url = `https://api.modrinth.com/v3/search?query=${query}&limit=${pageSize}&index=${sort}&new_filters=${facets.join("%20AND%20")}&offset=${(page - 1) * pageSize}`;
        let urlInfo = await (await fetch(url)).json();
        let projects = [];
        for (let i = 0; i < urlInfo.hits.length; i++) {
            let project = new Project();
            project.applyInfoFromModrinth(urlInfo.hits[i]);
            projects.push(project);
        }
        return { projects, total_hits: urlInfo.total_hits };
    }
}

class CurseForge {
    static async search(query, loader, project_type, version, page = 1, pageSize = 20, sortBy = "relevance") {
        let sort = 1;
        if (sortBy == "downloads") sort = 6;
        if (sortBy == "newest") sort = 11;
        if (sortBy == "updated") sort = 3;
        let sortOrder = "desc";
        let gv = "";
        if (version) gv = "&gameVersion=" + version;
        let gf = "";
        if (loader && (project_type == "mod" || project_type == "modpack")) gf = "&modLoaderType=" + ["", "forge", "", "", "fabric", "quilt", "neoforge"].indexOf(loader);
        let ci = "";
        let id = 0;
        if (project_type == "mod") id = 6;
        if (project_type == "modpack") id = 4471;
        if (project_type == "resourcepack") id = 12;
        if (project_type == "shader") id = 6552;
        if (project_type == "world") id = 17;
        if (project_type == "datapack") id = 6945;
        if (project_type) ci = "&classId=" + id;
        let url = `https://api.curse.tools/v1/cf/mods/search?gameId=432&index=${(page - 1) * pageSize}&searchFilter=${query}${gv}&pageSize=${pageSize}&sortField=${sort}&sortOrder=${sortOrder}${gf}${ci}`;
        let res = await fetch(url);
        let urlInfo = await res.json();
        if (urlInfo.pagination.totalCount > 10000) urlInfo.pagination.totalCount = 10000;
        let projects = [];
        for (let i = 0; i < urlInfo.data.length; i++) {
            let project = new Project();
            project.applyInfoFromCurseForge(urlInfo.data[i]);
            projects.push(project);
        }
        return { projects, total_hits: urlInfo.pagination.totalCount };
    }
}

export { Project, ProjectVersion, ProjectList, ProjectVersionList, Author, GalleryImage, Modrinth, CurseForge };