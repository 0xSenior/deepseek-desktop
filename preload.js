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

// Clean state handling without forcing window.location redirects
window.addEventListener('beforeunload', () => {
    localStorage.removeItem('appState');
});

function injectDeveloperBadge() {
    if (document.getElementById('senior-dev-badge')) return;

    const style = document.createElement('style');
    style.id = 'senior-dev-badge-styles';
    style.textContent = `
        #senior-dev-badge {
            position: fixed;
            top: 12px;
            right: 80px;
            z-index: 99990;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: rgba(13, 17, 28, 0.82);
            backdrop-filter: blur(14px);
            -webkit-backdrop-filter: blur(14px);
            border: 1px solid rgba(79, 110, 247, 0.35);
            border-radius: 20px;
            padding: 5px 12px 5px 8px;
            box-shadow: 0 4px 18px rgba(0, 0, 0, 0.3), 0 0 12px rgba(79, 110, 247, 0.2);
            transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
            user-select: none;
            cursor: pointer;
            color: #ffffff;
            opacity: 0.88;
        }

        #senior-dev-badge:hover {
            opacity: 1;
            transform: translateY(-1px);
            border-color: rgba(79, 110, 247, 0.75);
            box-shadow: 0 8px 25px rgba(0, 0, 0, 0.4), 0 0 20px rgba(79, 110, 247, 0.4);
            background: rgba(17, 22, 38, 0.95);
        }

        .senior-badge-avatar {
            width: 22px;
            height: 22px;
            background: linear-gradient(135deg, #4f6ef7 0%, #38bdf8 100%);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #ffffff;
            box-shadow: 0 2px 6px rgba(79, 110, 247, 0.4);
            flex-shrink: 0;
        }

        .senior-badge-text {
            display: flex;
            align-items: center;
            gap: 4px;
            white-space: nowrap;
        }

        .senior-badge-title {
            font-weight: 600;
            color: #f1f5f9;
            font-size: 11px;
            letter-spacing: 0.2px;
        }

        .senior-badge-external-icon {
            margin-left: 1px;
            opacity: 0.85;
            transition: transform 0.2s ease, opacity 0.2s ease;
        }

        #senior-dev-badge:hover .senior-badge-external-icon {
            opacity: 1;
            transform: translate(1px, -1px);
        }

        .senior-badge-close {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 16px;
            height: 16px;
            border-radius: 50%;
            margin-left: 2px;
            color: #94a3b8;
            transition: all 0.2s ease;
        }

        .senior-badge-close:hover {
            background: rgba(255, 255, 255, 0.15);
            color: #ffffff;
        }
    `;

    if (document.head) {
        document.head.appendChild(style);
    }

    const badge = document.createElement('div');
    badge.id = 'senior-dev-badge';
    badge.title = 'Developed by Senior A. - Click to visit website';
    badge.innerHTML = `
        <div class="senior-badge-avatar">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
            </svg>
        </div>
        <div class="senior-badge-text">
            <span class="senior-badge-title">Senior A.</span>
            <svg class="senior-badge-external-icon" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="7" y1="17" x2="17" y2="7"></line>
                <polyline points="7 7 17 7 17 17"></polyline>
            </svg>
        </div>
        <div class="senior-badge-close" id="senior-badge-close-btn" title="Dismiss">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"></line>
                <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
        </div>
    `;

    badge.addEventListener('click', (e) => {
        if (e.target.closest('#senior-badge-close-btn')) {
            e.preventDefault();
            e.stopPropagation();
            badge.style.display = 'none';
            return;
        }
        e.preventDefault();
        e.stopPropagation();
        ipcRenderer.send('open-external-url', 'https://senior-flax.vercel.app/');
    });

    if (document.body) {
        document.body.appendChild(badge);
    }
}

if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', injectDeveloperBadge);
} else {
    injectDeveloperBadge();
}

window.addEventListener('load', injectDeveloperBadge);



