import {
	app,
	BrowserWindow,
	Menu,
	protocol,
	net,
	session,
	nativeImage,
	shell,
	ipcMain
} from 'electron';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { existsSync, mkdirSync, writeFileSync, readdirSync, statSync, unlinkSync } from 'node:fs';
import { createHash } from 'node:crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// override process title early - affects macos dock tooltip in dev mode
process.title = 'ZeltaTV';

// dev mode: not packaged OR explicitly flagged via env (dev .app bundle sets this)
const isDev = !app.isPackaged || process.env.ZELTATV_DEV === '1';

// override app name - in dev mode electron binary defaults to "Electron"
app.setName('ZeltaTV');

// ignore ssl errors - many iptv streams use old tls or expired/self-signed certs
app.commandLine.appendSwitch('ignore-certificate-errors');
app.commandLine.appendSwitch('allow-running-insecure-content');
// suppress non-fatal chromium ssl log spam from broken iptv servers
app.commandLine.appendSwitch('log-level', '3');

// memory: cap renderer v8 heap to 128mb (default ~2gb)
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=128 --max-semi-space-size=4');
// memory: disable unused chrome features that spawn background services and processes
app.commandLine.appendSwitch(
	'disable-features',
	'Translate,MediaRouter,MediaSessionService,CastMediaRouteProvider,SiteIsolation,IsolateOrigins,NotificationTriggers,BackForwardCache,Prerender2'
);
// memory: stop chrome background networking (extension updates, safe browsing pings, etc)
app.commandLine.appendSwitch('disable-background-networking');
// memory: disable chrome component updates (not needed in packaged app)
app.commandLine.appendSwitch('disable-component-update');
// memory: disable disk cache entirely - saves ram and disk, logos cached via custom protocol
app.commandLine.appendSwitch('disable-http-cache');
app.commandLine.appendSwitch('disk-cache-size', '0');
// memory: disable unused subsystems
app.commandLine.appendSwitch('disable-extensions');
app.commandLine.appendSwitch('disable-notifications');
app.commandLine.appendSwitch('disable-permissions-api');
// memory: disable gpu sandbox (reduces gpu process overhead)
app.commandLine.appendSwitch('disable-gpu-sandbox');
// memory: reduce renderer process overhead
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');

// prevent multiple app instances - each instance is ~150mb+ of processes
if (!app.requestSingleInstanceLock()) {
	app.quit();
}
app.on('second-instance', () => {
	const win = BrowserWindow.getAllWindows()[0];
	if (win) {
		if (win.isMinimized()) win.restore();
		win.focus();
	}
});

// register custom protocol before app ready
// absolute paths like /_app/... resolve to app://localhost/_app/... correctly
// logocache protocol serves channel logos from disk cache to avoid repeated network fetches
protocol.registerSchemesAsPrivileged([
	{ scheme: 'app', privileges: { secure: true, standard: true, supportFetchAPI: true } },
	{
		scheme: 'logocache',
		privileges: { secure: true, standard: true, supportFetchAPI: true, corsEnabled: true }
	}
]);

// logo disk cache directory - lazy initialized after app ready
let logoCacheDir = '';

// application icon - static/ in dev, build/ in packaged (sveltekit copies static to build)
function getIconPath() {
	return isDev
		? join(__dirname, '..', 'static', 'assets', 'favicon.png')
		: join(__dirname, '..', 'build', 'assets', 'favicon.png');
}

function createWindow() {
	const iconPath = existsSync(getIconPath()) ? getIconPath() : undefined;
	const isMac = process.platform === 'darwin';
	const isWin = process.platform === 'win32';

	const win = new BrowserWindow({
		width: 1200,
		height: 800,
		minWidth: 800,
		minHeight: 600,
		// mac: hidden keeps traffic lights; win: hidden + overlay for native controls; linux: native title bar
		titleBarStyle: isMac || isWin ? 'hidden' : 'default',
		...(isWin
			? {
					titleBarOverlay: {
						color: '#141414',
						symbolColor: '#ffffff',
						height: 36
					}
				}
			: {}),
		...(iconPath ? { icon: iconPath } : {}),
		webPreferences: {
			preload: join(__dirname, 'preload.cjs'),
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: true,
			// throttle timer/cpu in background - saves ram when window minimized
			backgroundThrottling: true,
			// disable spellcheck - unnecessary for iptv player, saves memory
			spellcheck: false,
			// disable webview tag - not used, reduces attack surface
			webviewTag: false
		}
	});

	// deny all new windows - prevents window.open and target=_blank from
	// spawning renderer processes (each ~100-200mb ram). redirect external
	// urls to the system browser instead
	win.webContents.setWindowOpenHandler(({ url }) => {
		if (url.startsWith('http://') || url.startsWith('https://')) {
			setImmediate(() => shell.openExternal(url));
		}
		return { action: 'deny' };
	});

	// prevent main window from navigating to external urls
	win.webContents.on('will-navigate', (e, url) => {
		if (!url.startsWith('app://') && !url.startsWith('http://localhost:')) {
			e.preventDefault();
			shell.openExternal(url);
		}
	});

	win.webContents.on('context-menu', (e, params) => {
		e.preventDefault();
		const contextMenu = Menu.buildFromTemplate([
			{
				label: 'Reload',
				click: () => win.webContents.reload()
			},
			{
				label: 'Inspect',
				click: () => win.webContents.inspectElement(params.x, params.y)
			}
		]);
		contextMenu.popup({ window: win });
	});

	if (isDev) {
		win.loadURL('http://localhost:5173');
	} else {
		win.loadURL('app://localhost/');
	}
}

app.whenReady().then(() => {
	// set dock icon on macos - BrowserWindow icon only affects the window, not the dock
	if (process.platform === 'darwin') {
		const dockIconPath = getIconPath();
		if (existsSync(dockIconPath)) {
			app.dock.setIcon(nativeImage.createFromPath(dockIconPath));
		}
	}

	// custom application menu - replaces default Electron menu
	// first item becomes the app name menu on macOS
	const appMenu = {
		label: 'ZeltaTV',
		submenu: [
			{
				label: 'View on GitHub',
				click: () => shell.openExternal('https://github.com/zeltatv/zeltatv')
			},
			{ type: 'separator' },
			{ role: 'quit', label: 'Quit ZeltaTV' }
		]
	};

	// edit menu - needed for copy/paste shortcuts in inputs on macOS
	const editMenu = {
		label: 'Edit',
		submenu: [
			{ role: 'undo' },
			{ role: 'redo' },
			{ type: 'separator' },
			{ role: 'cut' },
			{ role: 'copy' },
			{ role: 'paste' },
			{ role: 'selectAll' }
		]
	};

	Menu.setApplicationMenu(Menu.buildFromTemplate([appMenu, editMenu]));

	// initialize logo cache directory
	logoCacheDir = join(app.getPath('userData'), 'logo-cache');
	mkdirSync(logoCacheDir, { recursive: true });

	// clean up logo cache if it exceeds 500 files (remove oldest by mtime)
	try {
		const files = readdirSync(logoCacheDir)
			.map((f) => ({
				name: f,
				mtime: statSync(join(logoCacheDir, f)).mtimeMs
			}))
			.sort((a, b) => a.mtime - b.mtime);
		if (files.length > 500) {
			for (const f of files.slice(0, files.length - 500)) {
				unlinkSync(join(logoCacheDir, f.name));
			}
		}
	} catch {
		// ignore cleanup errors
	}

	// logo cache protocol - fetches logo once, caches to disk, serves from cache on subsequent requests
	protocol.handle('logocache', async (request) => {
		const url = new URL(request.url);
		const originalUrl = decodeURIComponent(url.pathname.slice(1) + (url.search || ''));
		if (!originalUrl) return new Response('', { status: 400 });

		const hash = createHash('md5').update(originalUrl).digest('hex');
		const cachePath = join(logoCacheDir, hash);

		// serve from disk cache
		if (existsSync(cachePath)) {
			try {
				return net.fetch(pathToFileURL(cachePath).href);
			} catch {
				// fall through to re-fetch
			}
		}

		// fetch from network and cache
		try {
			const res = await net.fetch(originalUrl);
			if (!res.ok) return new Response('', { status: res.status });
			const buffer = Buffer.from(await res.arrayBuffer());
			writeFileSync(cachePath, buffer);
			return new Response(buffer, {
				headers: { 'content-type': res.headers.get('content-type') || 'image/*' }
			});
		} catch {
			return new Response('', { status: 502 });
		}
	});

	// accept all certificates - iptv streams often have invalid/expired certs
	app.on('certificate-error', (event, _url, _error, _certificate, callback) => {
		event.preventDefault();
		callback(true);
	});

	// bypass cors for iptv m3u fetch and hls streams
	// skip local protocols to avoid per-request overhead on app assets
	session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
		if (details.url.startsWith('app://') || details.url.startsWith('logocache://')) {
			callback({});
			return;
		}
		const headers = { ...details.responseHeaders };
		for (const key of Object.keys(headers)) {
			if (key.toLowerCase() === 'access-control-allow-origin') {
				delete headers[key];
			}
		}
		headers['Access-Control-Allow-Origin'] = ['*'];
		callback({ responseHeaders: headers });
	});

	// serve build files via custom protocol with spa fallback
	protocol.handle('app', (request) => {
		const url = new URL(request.url);
		let filePath = join(__dirname, '..', 'build', url.pathname);

		// spa fallback - serve index.html for routes without a file
		if (!existsSync(filePath) || url.pathname === '/') {
			filePath = join(__dirname, '..', 'build', 'index.html');
		}

		return net.fetch(pathToFileURL(filePath).href);
	});

	// update title bar overlay color when theme changes (windows only)
	ipcMain.on('title-bar-overlay', (e, opts) => {
		const win = BrowserWindow.fromWebContents(e.sender);
		if (process.platform !== 'win32' || typeof win?.setTitleBarOverlay !== 'function') return;
		win.setTitleBarOverlay(opts);
	});

	createWindow();

	// catch any webContents created later (e.g. via <webview>) and deny new windows
	app.on('web-contents-created', (_e, contents) => {
		contents.setWindowOpenHandler(({ url }) => {
			if (url.startsWith('http://') || url.startsWith('https://')) {
				setImmediate(() => shell.openExternal(url));
			}
			return { action: 'deny' };
		});
	});

	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow();
	});
});

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') app.quit();
});
