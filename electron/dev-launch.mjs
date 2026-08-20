import { spawn } from 'node:child_process';
import {
	copyFileSync,
	existsSync,
	readFileSync,
	writeFileSync,
	unlinkSync,
	renameSync
} from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '..');

if (process.platform !== 'darwin') {
	const child = spawn('electron', ['electron/main.mjs'], {
		stdio: 'inherit',
		cwd: projectRoot,
		env: { ...process.env, ZELTATV_DEV: '1' }
	});
	child.on('exit', (code) => process.exit(code ?? 0));
} else {
	const distDir = join(projectRoot, 'node_modules/electron/dist');
	const electronApp = join(distDir, 'Electron.app');
	const zeltaApp = join(distDir, 'ZeltaTV.app');
	const contentsDir = join(zeltaApp, 'Contents');
	const resourcesDir = join(contentsDir, 'Resources');
	const plistPath = join(contentsDir, 'Info.plist');
	const executablePath = join(contentsDir, 'MacOS/ZeltaTV');
	const electronExecutablePath = join(contentsDir, 'MacOS/Electron');
	const iconPath = join(resourcesDir, 'icon.icns');
	const backupPath = join(resourcesDir, '.zeltatv-info-plist-backup');

	// recover bundle state if a previous launch was interrupted
	if (existsSync(backupPath)) {
		copyFileSync(backupPath, plistPath);
		unlinkSync(backupPath);
	}
	if (existsSync(zeltaApp) && !existsSync(electronApp)) renameSync(zeltaApp, electronApp);
	renameSync(electronApp, zeltaApp);
	let executableRenamed = false;

	copyFileSync(plistPath, backupPath);
	copyFileSync(join(projectRoot, 'static/assets/macos/icon-1024x1024px.icns'), iconPath);

	let plist = readFileSync(plistPath, 'utf8');
	plist = plist.replace(
		/<key>CFBundleName<\/key>\s*<string>[^<]*<\/string>/,
		'<key>CFBundleName</key>\n\t<string>ZeltaTV</string>'
	);
	plist = plist.replace(
		/<key>CFBundleDisplayName<\/key>\s*<string>[^<]*<\/string>/,
		'<key>CFBundleDisplayName</key>\n\t<string>ZeltaTV</string>'
	);
	plist = plist.replace(
		/<key>CFBundleExecutable<\/key>\s*<string>[^<]*<\/string>/,
		'<key>CFBundleExecutable</key>\n\t<string>ZeltaTV</string>'
	);
	plist = plist.replace(
		/<key>CFBundleIconFile<\/key>\s*<string>[^<]*<\/string>/,
		'<key>CFBundleIconFile</key>\n\t<string>icon</string>'
	);
	writeFileSync(plistPath, plist);

	if (existsSync(electronExecutablePath)) {
		renameSync(electronExecutablePath, executablePath);
		executableRenamed = true;
	}
	const child = spawn(executablePath, ['electron/main.mjs'], {
		stdio: 'inherit',
		cwd: projectRoot,
		env: { ...process.env, ZELTATV_DEV: '1' }
	});

	function cleanup() {
		try {
			copyFileSync(backupPath, plistPath);
			unlinkSync(backupPath);
			unlinkSync(iconPath);
			if (executableRenamed && existsSync(executablePath)) {
				renameSync(executablePath, electronExecutablePath);
			}
			renameSync(zeltaApp, electronApp);
		} catch {
			// ignore cleanup errors
		}
	}

	child.on('exit', (code) => {
		cleanup();
		process.exit(code ?? 0);
	});
	process.on('SIGINT', () => {
		cleanup();
		process.exit(130);
	});
	process.on('SIGTERM', () => {
		cleanup();
		process.exit(143);
	});
}
