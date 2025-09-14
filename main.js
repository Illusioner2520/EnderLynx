const { app, BrowserWindow, ipcMain, dialog, Menu } = require('electron');
const path = require('path');
const RPC = require('discord-rpc');
const windowStateKeeper = require('electron-window-state');
const fs = require('fs');

let userDataPath = path.resolve(app.getPath('userData'), "EnderLynx");

let pathPath = path.resolve(app.getPath('userData'), "path.json");
let user_path;

if (!fs.existsSync(pathPath)) {
    user_path = userDataPath;
    fs.writeFileSync(pathPath, JSON.stringify({ user_path }), 'utf8');
} else {
    try {
        const data = fs.readFileSync(pathPath, 'utf8');
        const json = JSON.parse(data);
        user_path = json.user_path;
        if (json.old_path) {
            if (fs.existsSync(json.old_path)) {
                fs.rmSync(json.old_path, { recursive: true, force: true });
            }
            delete json.old_path;
            fs.writeFileSync(pathPath, JSON.stringify(json), 'utf8');
        }
    } catch (err) {
        user_path = userDataPath;
        fs.writeFileSync(pathPath, JSON.stringify({ user_path }), 'utf8');
    }
}

if (!fs.existsSync(user_path)) user_path = userDataPath;

let win;

const isDev = !app.isPackaged;

const createWindow = () => {
    let state = windowStateKeeper({
        defaultWidth: 1000,
        defaultHeight: 600,
    });
    win = new BrowserWindow({
        x: state.x,
        y: state.y,
        width: state.width,
        height: state.height,
        minWidth: 1000,
        minHeight: 600,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            sandbox: false,
            devTools: isDev,
            additionalArguments: [`--userDataPath=${user_path}`]
        },
        backgroundColor: "#0a0a0a",
        icon: path.join(__dirname, 'icon.ico')
    });
    win.loadFile('index.html');
    state.manage(win);
    if (!isDev) {
        Menu.setApplicationMenu(null);
    }
}

let instance_id_to_launch = "";
let world_type_to_launch = "";
let world_id_to_launch = "";

const args = process.argv.slice(1);
const instanceArg = args.find(arg => arg.startsWith('--instance='));
const worldTypeArg = args.find(arg => arg.startsWith('--worldType='));
const worldIdArg = args.find(arg => arg.startsWith('--worldId='));

if (instanceArg) {
    if (instanceArg) instance_id_to_launch = instanceArg.split('=').toSpliced(0, 1).join('=');
    if (worldTypeArg) world_type_to_launch = worldTypeArg.split('=').toSpliced(0, 1).join('=');
    if (worldIdArg) world_id_to_launch = worldIdArg.split('=').toSpliced(0, 1).join('=');
}

app.whenReady().then(() => {
    app.setAppUserModelId('me.illusioner.enderlynx');
    createWindow();
    rpc.login({ clientId }).catch(console.error);
});

ipcMain.handle('set-user-path', (event, new_path, old_path) => {
    user_path = new_path;
    fs.writeFileSync(pathPath, JSON.stringify({ user_path, old_path }), 'utf8');
    return true;
});

ipcMain.on('progress-update', (event, title, progress, desc) => {
    win.webContents.send('progress-update', title, progress, desc);
});

ipcMain.on('display-error', (event, message) => {
    win.webContents.send('display-error', message);
});

ipcMain.handle('get-instance-to-launch', (_) => {
    let temp_ii = instance_id_to_launch;
    let temp_wt = world_type_to_launch;
    let temp_wi = world_id_to_launch;
    instance_id_to_launch = "";
    world_type_to_launch = "";
    world_id_to_launch = "";
    return {
        instance_id: temp_ii.toString(),
        world_type: temp_wt.toString(),
        world_id: temp_wi.toString()
    };
});

ipcMain.handle('show-open-dialog', async (event, options) => {
    const result = await dialog.showOpenDialog(win, options);
    return result;
});

ipcMain.handle('show-save-dialog', async (event, options) => {
    const result = await dialog.showSaveDialog(win, options);
    return result;
});

ipcMain.handle('get-app-metrics', (event) => {
    return app.getAppMetrics();
});

ipcMain.handle('is-dev', (event) => {
    return isDev;
});

ipcMain.handle('get-desktop', (_) => {
    return app.getPath("desktop");
});

ipcMain.handle('quit', (_) => {
    return app.quit();
});

const clientId = '1392227892594999368';

RPC.register(clientId);
const rpc = new RPC.Client({ transport: 'ipc' });

rpc.on('ready', () => {
    ipcMain.on('set-discord-activity', (_, activity) => {
        rpc.setActivity(activity);
    });

    ipcMain.on('remove-discord-activity', (_) => {
        rpc.clearActivity().catch(console.error);
    })
});