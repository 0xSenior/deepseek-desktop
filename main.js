const { app, BrowserWindow, Menu, MenuItem, Tray, shell, ipcMain, clipboard, session } = require('electron');
const path = require('path');

let mainWindow;
let tray = null;
let authWindowInstance = null;

const CHROME_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36';

function isAuthUrl(url) {
    if (!url) return false;
    return url.includes('accounts.google.com') ||
           url.includes('appleid.apple.com') ||
           url.includes('google.com/o/oauth2');
}

function openAuthPopupWindow(authUrl) {
    if (authWindowInstance && !authWindowInstance.isDestroyed()) {
        authWindowInstance.focus();
        return;
    }

    authWindowInstance = new BrowserWindow({
        width: 520,
        height: 680,
        center: true,
        parent: mainWindow,
        modal: false,
        icon: path.join(__dirname, 'deepseek-logo.png'),
        autoHideMenuBar: true,
        title: 'Sign in with Google - DeepSeek',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            session: session.defaultSession,
            userAgent: CHROME_USER_AGENT,
        }
    });

    authWindowInstance.loadURL(authUrl);

    let isDone = false;
    const handleAuthRedirect = (navUrl) => {
        if (isDone) return;
        if (navUrl && navUrl.includes('deepseek.com') && !isAuthUrl(navUrl)) {
            isDone = true;

            setTimeout(async () => {
                try {
                    await session.defaultSession.cookies.flushStore();
                } catch (e) {}

                try {
                    if (authWindowInstance && !authWindowInstance.isDestroyed()) {
                        authWindowInstance.close();
                    }
                } catch (e) {}

                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.loadURL('https://chat.deepseek.com/');
                }
            }, 1200);
        }
    };

    authWindowInstance.webContents.on('did-finish-load', () => {
        const currentUrl = authWindowInstance.webContents.getURL();
        if (currentUrl.includes('deepseek.com') && !isAuthUrl(currentUrl)) {
            handleAuthRedirect(currentUrl);
        }
    });

    authWindowInstance.webContents.on('did-navigate', (event, navUrl) => {
        if (navUrl.includes('deepseek.com') && !isAuthUrl(navUrl)) {
            handleAuthRedirect(navUrl);
        }
    });

    authWindowInstance.on('closed', () => {
        authWindowInstance = null;
        if (mainWindow && !mainWindow.isDestroyed()) {
            const currentUrl = mainWindow.webContents.getURL();
            if (isAuthUrl(currentUrl)) {
                mainWindow.loadURL('https://chat.deepseek.com/');
            } else {
                mainWindow.reload();
            }
        }
    });
}




function createTray() {
    if (tray) return;

    const iconPath = path.join(__dirname, 'deepseek-logo.png');
    tray = new Tray(iconPath);
    tray.setToolTip('DeepSeek Desktop');

    const contextMenu = Menu.buildFromTemplate([
        {
            label: 'Show DeepSeek Desktop',
            click: () => {
                if (mainWindow) {
                    if (mainWindow.isMinimized()) mainWindow.restore();
                    mainWindow.show();
                    mainWindow.focus();
                }
            }
        },
        {
            label: 'Quick Chat',
            click: () => {
                if (mainWindow) {
                    if (mainWindow.isMinimized()) mainWindow.restore();
                    mainWindow.show();
                    mainWindow.focus();
                    mainWindow.loadURL('https://chat.deepseek.com/');
                }
            }
        },
        { type: 'separator' },
        {
            label: 'Quit DeepSeek',
            click: () => {
                app.isQuiting = true;
                app.quit();
            }
        }
    ]);

    tray.setContextMenu(contextMenu);

    tray.on('double-click', () => {
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.show();
            mainWindow.focus();
        }
    });

    tray.on('click', () => {
        if (mainWindow) {
            if (mainWindow.isVisible()) {
                if (mainWindow.isFocused()) {
                    mainWindow.hide();
                } else {
                    mainWindow.focus();
                }
            } else {
                mainWindow.show();
                mainWindow.focus();
            }
        }
    });
}

function createMainWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        minHeight: 600,
        minWidth: 800,
        icon: path.join(__dirname, 'deepseek-logo.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
            session: session.defaultSession,
            userAgent: CHROME_USER_AGENT,
        },
        autoHideMenuBar: true,
    });

    mainWindow.loadURL('https://chat.deepseek.com/');

    createTray();

    mainWindow.webContents.on('context-menu', (event, params) => {
        const menuTemplate = [];

        if (params.linkURL) {
            menuTemplate.push(
                {
                    label: 'Open Link in Default Browser',
                    click: () => {
                        shell.openExternal(params.linkURL);
                    }
                },
                {
                    label: 'Copy Link Address',
                    click: () => {
                        clipboard.writeText(params.linkURL);
                    }
                },
                { type: 'separator' }
            );
        }

        if (params.isEditable) {
            menuTemplate.push(
                { role: 'undo', enabled: params.editFlags.canUndo },
                { role: 'redo', enabled: params.editFlags.canRedo },
                { type: 'separator' },
                { role: 'cut', enabled: params.editFlags.canCut },
                { role: 'copy', enabled: params.editFlags.canCopy },
                { role: 'paste', enabled: params.editFlags.canPaste },
                { role: 'selectAll', enabled: params.editFlags.canSelectAll }
            );
        } else if (params.selectionText && params.selectionText.trim().length > 0) {
            menuTemplate.push(
                { role: 'copy', enabled: params.editFlags.canCopy },
                { role: 'selectAll', enabled: params.editFlags.canSelectAll }
            );
        } else if (!params.linkURL) {
            menuTemplate.push(
                { role: 'copy', enabled: params.editFlags.canCopy },
                { role: 'paste', enabled: params.editFlags.canPaste },
                { role: 'selectAll', enabled: params.editFlags.canSelectAll },
                { type: 'separator' },
                { role: 'reload' }
            );
        }

        if (menuTemplate.length > 0) {
            const menu = Menu.buildFromTemplate(menuTemplate);
            menu.popup({ window: mainWindow });
        }
    });

    // Handle OAuth popup windows (Google / Apple / DeepSeek Auth) via managed auth popup
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        const isAuthUrl = url.includes('accounts.google.com') ||
                          url.includes('appleid.apple.com') ||
                          url.includes('google.com/o/oauth2') ||
                          url.includes('auth');

        if (isAuthUrl) {
            openAuthPopupWindow(url);
            return { action: 'deny' };
        }

        if (url && url.startsWith('http')) {
            shell.openExternal(url);
        }
        return { action: 'deny' };
    });


    mainWindow.webContents.on('will-navigate', (event, url) => {
        if (isAuthUrl(url)) {
            event.preventDefault();
            openAuthPopupWindow(url);
            return;
        }

        if (url && !url.includes('deepseek.com')) {
            event.preventDefault();
            shell.openExternal(url);
        }
    });

    mainWindow.webContents.on('will-redirect', (event, url) => {
        if (isAuthUrl(url)) {
            event.preventDefault();
            openAuthPopupWindow(url);
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.loadURL('https://chat.deepseek.com/');
            }
        }
    });

    mainWindow.webContents.on('did-navigate', (event, url) => {
        if (isAuthUrl(url)) {
            openAuthPopupWindow(url);
            if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.loadURL('https://chat.deepseek.com/');
            }
        }
    });

    mainWindow.on('close', (event) => {
        if (!app.isQuiting) {
            event.preventDefault();
            mainWindow.hide();
        }
    });
}


ipcMain.on('open-external-url', (event, url) => {
    try {
        if (typeof url === 'string') {
            const parsed = new URL(url);
            if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
                shell.openExternal(url);
            }
        }
    } catch (e) {}
});


app.on('ready', () => {
    session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
        details.requestHeaders['User-Agent'] = CHROME_USER_AGENT;
        callback({ cancel: false, requestHeaders: details.requestHeaders });
    });

    createMainWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow) {
        mainWindow.show();
    } else {
        createMainWindow();
    }
});

app.on('before-quit', () => {
    app.isQuiting = true;
});



