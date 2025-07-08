const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');

let win;

const createWindow = () => {
    win = new BrowserWindow({
        width: 1250,
        height: 600,
        minWidth: 1250,
        minHeight: 600,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            sandbox: false,
        },
        icon: path.join(__dirname,'icon.png')
    });
    win.loadFile('index.html');
}

app.whenReady().then(() => {
    createWindow();
});

ipcMain.on('progress-update', (event, title, progress, desc) => {
    win.webContents.send('progress-update', title, progress, desc);
});

ipcMain.on('display-error', (event, message) => {
    win.webContents.send('display-error', message);
});

ipcMain.handle('show-open-dialog', async (event, options) => {
    const result = await dialog.showOpenDialog(win, options);
    return result;
});