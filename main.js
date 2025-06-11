const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');

const createWindow = () => {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: false, // Recommended for security
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            sandbox: false
        }
    });
    win.loadFile('index.html');
}

app.whenReady().then(() => {
    createWindow();
});

// const { Client, Authenticator } = require('minecraft-launcher-core');
// const launcher = new Client();
// const { Auth } = require("msmc");
// const authManager = new Auth("select_account");
// authManager.launch("raw").then(async (xboxManager) => {
//     const token = await xboxManager.getMinecraft();
//     const opts = {
//         clientPackage: null,
//         authorization: token.mclc(),
//         root: "./minecraft",
//         version: {
//             number: '1.21.5',
//             type: 'release'
//         },
//         memory: {
//             max: '4G',
//             min: '2G'
//         }
//     };

//     launcher.launch(opts);

//     launcher.on('debug', (e) => console.log('[DEBUG]', e));
//     launcher.on('data', (e) => console.log('[DATA]', e.toString()));
// });

// ipcMain.handle('read-file', async (event) => {
    //     const { filePaths } = await dialog.showOpenDialog({ properties: ['openFile'] });
    //     if (!filePaths || filePaths.length === 0) {
        //         return { success: false, error: 'No file selected' };
        //     }
        //     try {
            //         const filePath = filePaths[0];
//         const fileContent = fs.readFileSync(filePath, 'utf-8');
//         return { success: true, content: fileContent };
//     } catch (error) {
//         return { success: false, error: error.message };
//     }
// });