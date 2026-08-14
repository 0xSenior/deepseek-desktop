const { app, BrowserWindow, Menu, MenuItem, Tray, shell, ipcMain, clipboard, session } = require('electron');
const path = require('path');

let mainWindow;
let tray = null;
let authWindowInstance = null;

const CHROME_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36';

function isAuthUrl(url) {
    if (!url) return false;
    const lowerUrl = url.toLowerCase();
    return lowerUrl.includes('accounts.google.com') ||
           lowerUrl.includes('appleid.apple.com') ||
           lowerUrl.includes('google.com/o/oauth2') ||
           lowerUrl.includes('google.com/gsi/') ||
           lowerUrl.includes('login.live.com') ||
           lowerUrl.includes('login.microsoftonline.com') ||
           lowerUrl.includes('github.com/login') ||
           lowerUrl.includes('provider=google') ||
           lowerUrl.includes('provider=apple');
}

function openAuthPopupWindow(authUrl) {
    if (authWindowInstance && !authWindowInstance.isDestroyed()) {
        authWindowInstance.focus();
        return;
    }

    authWindowInstance = new BrowserWindow({
        width: 540,
        height: 720,
        center: true,
        parent: mainWindow,
        modal: false,
        icon: path.join(__dirname, 'deepseek-logo.png'),
        autoHideMenuBar: true,
        title: 'Sign in - DeepSeek Desktop',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            session: session.defaultSession,
            userAgent: CHROME_USER_AGENT,
        }
    });

    authWindowInstance.webContents.on('dom-ready', () => {
        authWindowInstance.webContents.executeJavaScript(`
            try {
                Object.defineProperty(navigator, 'userAgentData', {
                    get: () => ({
                        brands: [
                            { brand: 'Google Chrome', version: '132' },
                            { brand: 'Chromium', version: '132' },
                            { brand: 'Not_A Brand', version: '24' }
                        ],
                        mobile: false,
                        platform: 'Windows',
                        getHighEntropyValues: () => Promise.resolve({
                            architecture: 'x86',
                            bitness: '64',
                            brands: [
                                { brand: 'Google Chrome', version: '132' },
                                { brand: 'Chromium', version: '132' },
                                { brand: 'Not_A Brand', version: '24' }
                            ],
                            mobile: false,
                            model: '',
                            platform: 'Windows',
                            platformVersion: '15.0.0',
                            uaFullVersion: '132.0.0.0'
                        })
                    })
                });
            } catch (e) {}
        `).catch(() => {});
    });

    authWindowInstance.loadURL(authUrl);

    let isDone = false;
    const handleAuthRedirect = async (navUrl) => {
        if (isDone) return;

        const isDeepSeekMain = navUrl && navUrl.includes('deepseek.com') &&
                               !isAuthUrl(navUrl) &&
                               !navUrl.includes('sign_in') &&
                               !navUrl.includes('/auth/');

        if (isDeepSeekMain) {
            isDone = true;

            // Hide popup immediately so user never sees chat loading inside popup window
            if (authWindowInstance && !authWindowInstance.isDestroyed()) {
                try {
                    authWindowInstance.hide();
                } catch (e) {}
            }

            try {
                let localStorageData = {};
                if (authWindowInstance && !authWindowInstance.isDestroyed()) {
                    localStorageData = await authWindowInstance.webContents.executeJavaScript(`
                        (() => {
                            const data = {};
                            for (let i = 0; i < localStorage.length; i++) {
                                const key = localStorage.key(i);
                                data[key] = localStorage.getItem(key);
                            }
                            return data;
                        })()
                    `).catch(() => ({}));
                }

                await session.defaultSession.cookies.flushStore();

                if (authWindowInstance && !authWindowInstance.isDestroyed()) {
                    authWindowInstance.close();
                }

                if (mainWindow && !mainWindow.isDestroyed()) {
                    if (localStorageData && Object.keys(localStorageData).length > 0) {
                        await mainWindow.webContents.executeJavaScript(`
                            (() => {
                                const data = ${JSON.stringify(localStorageData)};
                                Object.keys(data).forEach(key => {
                                    if (data[key] !== null) {
                                        localStorage.setItem(key, data[key]);
                                    }
                                });
                            })()
                        `).catch(() => {});
                    }
                    mainWindow.show();
                    mainWindow.focus();
                    mainWindow.loadURL('https://chat.deepseek.com/');
                }
            } catch (e) {
                console.error('Failed to sync auth state:', e);
                if (mainWindow && !mainWindow.isDestroyed()) {
                    mainWindow.show();
                    mainWindow.focus();
                    mainWindow.loadURL('https://chat.deepseek.com/');
                }
            }
        }
    };

    let checkAuthInterval = setInterval(async () => {
        if (isDone || !authWindowInstance || authWindowInstance.isDestroyed()) {
            clearInterval(checkAuthInterval);
            return;
        }
        try {
            const checkResult = await authWindowInstance.webContents.executeJavaScript(`
                (() => {
                    const href = window.location.href;
                    let hasAuth = false;
                    for (let i = 0; i < localStorage.length; i++) {
                        const k = (localStorage.key(i) || '').toLowerCase();
                        if (k.includes('token') || k.includes('user') || k.includes('auth') || k.includes('hsso')) {
                            hasAuth = true;
                            break;
                        }
                    }
                    if (document.cookie.includes('HSSO_TOKEN') || document.cookie.includes('user_token')) {
                        hasAuth = true;
                    }
                    const isMainPage = href.includes('deepseek.com') && !href.includes('sign_in') && !href.includes('/auth') && !href.includes('google.com') && !href.includes('appleid');
                    return { hasAuth, isMainPage, href };
                })()
            `).catch(() => null);

            if (checkResult && (checkResult.hasAuth || checkResult.isMainPage)) {
                clearInterval(checkAuthInterval);
                handleAuthRedirect(checkResult.href);
            }
        } catch (e) {}
    }, 300);

    authWindowInstance.webContents.on('did-navigate-in-page', (event, navUrl) => {
        handleAuthRedirect(navUrl);
    });

    authWindowInstance.webContents.on('will-redirect', (event, navUrl) => {
        handleAuthRedirect(navUrl);
    });

    authWindowInstance.webContents.on('will-navigate', (event, navUrl) => {
        handleAuthRedirect(navUrl);
    });

    authWindowInstance.webContents.on('did-finish-load', () => {
        const currentUrl = authWindowInstance.webContents.getURL();
        handleAuthRedirect(currentUrl);
    });

    authWindowInstance.webContents.on('did-navigate', (event, navUrl) => {
        handleAuthRedirect(navUrl);
    });

    authWindowInstance.webContents.on('did-redirect-navigation', (event, navUrl) => {
        handleAuthRedirect(navUrl);
    });

    authWindowInstance.on('closed', async () => {
        if (checkAuthInterval) clearInterval(checkAuthInterval);
        authWindowInstance = null;
        if (mainWindow && !mainWindow.isDestroyed()) {
            try {
                await session.defaultSession.cookies.flushStore();
            } catch (e) {}
            const currentUrl = mainWindow.webContents.getURL();
            if (isAuthUrl(currentUrl) || currentUrl.includes('sign_in')) {
                mainWindow.show();
                mainWindow.focus();
                mainWindow.loadURL('https://chat.deepseek.com/');
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
            label: '⚡ Developed by Senior A.',
            click: () => {
                shell.openExternal('https://senior-flax.vercel.app/');
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

    // Handle OAuth popup windows (Google / Apple / Microsoft / GitHub) via managed auth popup
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        if (isAuthUrl(url)) {
            openAuthPopupWindow(url);
            return { action: 'deny' };
        }

        if (url && url.startsWith('http') && !url.includes('deepseek.com')) {
            shell.openExternal(url);
            return { action: 'deny' };
        }
        return { action: 'allow' };
    });

    mainWindow.webContents.on('will-navigate', (event, url) => {
        if (isAuthUrl(url)) {
            event.preventDefault();
            openAuthPopupWindow(url);
            return;
        }

        if (url && url.startsWith('http') && !url.includes('deepseek.com')) {
            event.preventDefault();
            shell.openExternal(url);
        }
    });

    mainWindow.webContents.on('will-redirect', (event, url) => {
        if (isAuthUrl(url)) {
            event.preventDefault();
            openAuthPopupWindow(url);
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
    app.userAgentFallback = CHROME_USER_AGENT;

    session.defaultSession.webRequest.onBeforeSendHeaders(
        { urls: ['https://accounts.google.com/*', 'https://*.google.com/*'] },
        (details, callback) => {
            details.requestHeaders['User-Agent'] = CHROME_USER_AGENT;
            details.requestHeaders['Sec-CH-UA'] = '"Google Chrome";v="132", "Chromium";v="132", "Not_A Brand";v="24"';
            details.requestHeaders['Sec-CH-UA-Mobile'] = '?0';
            details.requestHeaders['Sec-CH-UA-Platform'] = '"Windows"';
            callback({ cancel: false, requestHeaders: details.requestHeaders });
        }
    );

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



