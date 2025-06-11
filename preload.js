const { contextBridge, ipcRenderer } = require('electron');
const fs = require('fs');
const path = require('path');
const { Minecraft, Java, Fabric } = require('./launch.js');

contextBridge.exposeInMainWorld('electronAPI', {
    readFile: (filePath) => {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            return content;
        } catch (err) {
            return `Error reading file: ${err.message}`;
        }
    },
    saveData: (data) => {
        try {
            fs.writeFileSync("data.json",data,'utf-8');
            return true;
        } catch (err) {
            return false;
        }
    },
    playMinecraft: async (loader,version,loaderVersion,instance_id,player_info) => {
        let mc = new Minecraft(instance_id);
        try {
            await mc.launchGame(loader,version,loaderVersion,player_info.name,player_info.uuid,{
                "accessToken": "eyJraWQiOiIwNDkxODEiLCJhbGciOiJSUzI1NiJ9.eyJ4dWlkIjoiMjUzNTQzMTQxMjU4Mzg5NSIsImFnZyI6IlRlZW4iLCJzdWIiOiIzZGMzMGNmNy04M2YzLTRhMjgtOTE4ZS03NTI5YWYzMjgxNjkiLCJhdXRoIjoiWEJPWCIsIm5zIjoiZGVmYXVsdCIsInJvbGVzIjpbXSwiaXNzIjoiYXV0aGVudGljYXRpb24iLCJmbGFncyI6WyJtc2FtaWdyYXRpb25fc3RhZ2U0Iiwib3JkZXJzXzIwMjIiLCJtdWx0aXBsYXllciIsInR3b2ZhY3RvcmF1dGgiXSwicHJvZmlsZXMiOnsibWMiOiI4NGQ3NDkwNS0wZGQyLTRiNzUtYjIxNi00NDZjYjU5NjU4ZDkifSwicGxhdGZvcm0iOiJPTkVTVE9SRSIsInl1aWQiOiJmY2ZhMjkzYTY4NDRhYWFjNzkyMDNmOWFlZjZmNWIwMCIsInBmZCI6W3sidHlwZSI6Im1jIiwiaWQiOiI4NGQ3NDkwNS0wZGQyLTRiNzUtYjIxNi00NDZjYjU5NjU4ZDkiLCJuYW1lIjoiSWxsdXNpb25lcjI1MjAifV0sIm5iZiI6MTc0OTUwNTg2NCwiZXhwIjoxNzQ5NTkyMjY0LCJpYXQiOjE3NDk1MDU4NjR9.UmzVb2VCUsn2MBeCVFjQ8ltKfv46KIL2kzuIXYIHml1fz3d5D4YIu9uV06ul_lmUi7lj3X6j2pNfLSZntm6wvaC_heXkbwtfj4g3Nzy6LJQpnqAQWzoP5SCWQFU77-aj67CCKYpG5nyeeWuGWK_mn8Q6z3RS_1ssL7-6pEi82pa4_F4dUxjRSqLEgA9NtbDaWjORML5YdiXC-MvTwTqRyLAxdtJQRx8qRGzV9BznH3HIobIYbeJ05c7A5kVQ4FdZnY7uwCwglBL19kx00qQz2WKDfdNHgYLYyzC2CG0IHA5X6c4I-ma4OhXw1Jf-GSg9y99cHUuPpyB8VKDukiqqGA",
                "xuid": "2535431412583895",
                "clientId": "MzkyYWY5ODItMzI0OS00YzY3LWE1NTQtYmQ2YzExZTdhNjVj"
            },null,null,false);
            console.log("Done");
            return true;
        } catch (err) {
            console.error(err);
            return false;
        }
    },
    getJavaInstallation: async (v) => {
        let java = new Java();
        java.getJavaInstallation(v);
    },
    getFabricVanillaVersions: async () => {
        let fabric = new Fabric();
        return await fabric.getSupportedVanillaVersions();
    },
    getFabricLoaderVersions: async (v) => {
        let fabric = new Fabric();
        return await fabric.getVersions(v);
    }
});