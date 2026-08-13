const { ipcRenderer, contextBridge } = require('electron');

contextBridge.exposeInMainWorld('electron', {
  setLocalStorage: (key, value) => {
    localStorage.setItem(key, value);
  },
  getLocalStorage: (key) => {
    return localStorage.getItem(key);
  },
  setCookie: (name, value, days) => {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    const expires = "expires=" + date.toUTCString();
    document.cookie = name + "=" + value + ";" + expires + ";path=/";
  },
  getCookie: (name) => {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
    }
    return null;
  },
  openExternal: (url) => {
    ipcRenderer.send('open-external-url', url);
  }
});

// Intercept Ctrl + Right Click or Ctrl + Left Click on links to open in system default browser
window.addEventListener('contextmenu', (event) => {
  if (event.ctrlKey || event.metaKey) {
    const targetLink = event.target.closest('a');
    if (targetLink && targetLink.href && targetLink.href.startsWith('http')) {
      event.preventDefault();
      event.stopPropagation();
      ipcRenderer.send('open-external-url', targetLink.href);
    }
  }
}, true);

window.addEventListener('click', (event) => {
  if (event.ctrlKey || event.metaKey) {
    const targetLink = event.target.closest('a');
    if (targetLink && targetLink.href && targetLink.href.startsWith('http')) {
      event.preventDefault();
      event.stopPropagation();
      ipcRenderer.send('open-external-url', targetLink.href);
    }
  }
}, true);

window.addEventListener('beforeunload', () => {
    if (window.location.href && window.location.href.includes('deepseek.com')) {
        const state = {
            url: window.location.href,
            scrollPosition: window.scrollY,
        };
        localStorage.setItem('appState', JSON.stringify(state));
    }
});

window.addEventListener('load', () => {
    try {
        const savedStateStr = localStorage.getItem('appState');
        if (savedStateStr) {
            const savedState = JSON.parse(savedStateStr);
            if (savedState && savedState.url && savedState.url.includes('deepseek.com')) {
                if (savedState.url !== window.location.href) {
                    window.location.href = savedState.url;
                }
                if (savedState.scrollPosition) {
                    window.scrollTo(0, savedState.scrollPosition);
                }
            } else {
                localStorage.removeItem('appState');
            }
        }
    } catch (e) {
        console.error('Failed to restore app state:', e);
    }
});


