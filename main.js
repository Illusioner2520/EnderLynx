const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const RPC = require('discord-rpc');

let win;

const isDev = !app.isPackaged;

const createWindow = () => {
    win = new BrowserWindow({
        width: 1000,
        height: 600,
        minWidth: 1000,
        minHeight: 600,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            sandbox: false,
            devTools: isDev
        },
        icon: path.join(__dirname, 'icon.png')
    });
    win.loadFile('index.html');
}

let instance_id_to_launch = "";

const args = process.argv.slice(1);
const instanceArg = args.find(arg => arg.startsWith('--instance='));

if (instanceArg) {
    const instanceId = instanceArg.split('=')[1];
    instance_id_to_launch = instanceId;
}

app.whenReady().then(() => {
    createWindow();
    rpc.login({ clientId }).catch(console.error);
});

ipcMain.on('progress-update', (event, title, progress, desc) => {
    win.webContents.send('progress-update', title, progress, desc);
});

ipcMain.on('display-error', (event, message) => {
    win.webContents.send('display-error', message);
});

ipcMain.handle('get-instance-to-launch', (_) => {
    return instance_id_to_launch.toString();
});

ipcMain.handle('show-open-dialog', async (event, options) => {
    const result = await dialog.showOpenDialog(win, options);
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
})

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

// setInterval(() => {
//     console.log(app.getAppMetrics());
// }, 5000);