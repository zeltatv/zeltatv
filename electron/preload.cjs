const { contextBridge, ipcRenderer } = require('electron');

// expose safe api for renderer to update windows title bar overlay color
contextBridge.exposeInMainWorld('electronAPI', {
	setTitleBarOverlay: (opts) => ipcRenderer.send('title-bar-overlay', opts),
	clearLogoCache: () => ipcRenderer.invoke('clear-logo-cache'),
	quit: () => ipcRenderer.send('app-quit'),
	setSetupState: (complete) => ipcRenderer.send('setup-state', complete === true),
	// persisted setup flag, read synchronously so the renderer knows it on first paint
	getSetupStatus: () => ipcRenderer.sendSync('setup:status') === true,
	markSetupComplete: () => ipcRenderer.send('setup:complete'),
	setWindowed: () => ipcRenderer.send('window:set-windowed'),
	setFullScreen: () => ipcRenderer.send('window:set-fullscreen'),
	isFullScreen: () => ipcRenderer.invoke('window:is-fullscreen'),
	onFullscreenChange: (callback) => {
		const listener = (_event, value) => callback(value);
		ipcRenderer.on('fullscreen-changed', listener);
		return () => ipcRenderer.removeListener('fullscreen-changed', listener);
	}
});
