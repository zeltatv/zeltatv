import { contextBridge, ipcRenderer } from 'electron';

// expose safe api for renderer to update windows title bar overlay color
contextBridge.exposeInMainWorld('electronAPI', {
	setTitleBarOverlay: (opts) => ipcRenderer.send('title-bar-overlay', opts)
});
