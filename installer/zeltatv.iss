; ZeltaTV Windows installer (Inno Setup 6)
; Build: ISCC.exe installer\zeltatv.iss
; Requires release\win-unpacked produced by electron-builder.

#define MyAppName "ZeltaTV"
#ifndef MyAppVersion
#define MyAppVersion "1.0.0"
#endif
#define MyAppPublisher "ZeltaTV"
#define MyAppExeName "ZeltaTV.exe"

[Setup]
AppId={{8C3D7B5A-5F6E-4B3A-9F1C-2A7E6D4B9C10}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} {#MyAppVersion}
; Without this the Explorer "File version" field of the setup executable is empty
; (Inno Setup only fills ProductVersion from AppVersion).
VersionInfoVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL=https://github.com/zeltatv/zeltatv
AppSupportURL=https://github.com/zeltatv/zeltatv/issues
AppUpdatesURL=https://github.com/zeltatv/zeltatv/releases
DefaultDirName={localappdata}\Programs\ZeltaTV
DefaultGroupName=ZeltaTV
DisableProgramGroupPage=yes
DisableWelcomePage=no
LicenseFile=..\LICENSE
OutputDir=..\release
OutputBaseFilename=ZeltaTV-{#MyAppVersion}-Setup
SetupIconFile=..\static\assets\windows\icon-256x256px.ico
WizardImageFile=wizard.bmp
WizardSmallImageFile=wizard-small.bmp
WizardStyle=modern
Compression=lzma2
SolidCompression=yes
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
UninstallDisplayIcon={app}\{#MyAppExeName}
; The installer is English-only. The application asks for the interface language
; on first launch (setup wizard, step 1), so the installer must not ask for it.
ShowLanguageDialog=no
CloseApplications=yes
RestartApplications=no
AllowNoIcons=yes
SetupLogging=yes

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[InstallDelete]
; Only the Chromium locale packs for the UI languages are shipped now, so an in-place
; upgrade has to drop the packs of earlier builds; Inno Setup overwrites files but never
; removes ones that are no longer in the file list.
Type: filesandordirs; Name: "{app}\locales"

[Files]
Source: "..\release\win-unpacked\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\ZeltaTV"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\ZeltaTV"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
; The post-install launch box is unchecked on purpose: the first start of a freshly
; installed Electron app is slow (Windows Defender scans the ~370 MB of new files),
; so an automatic launch makes the installer look frozen. The user can tick it.
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,ZeltaTV}"; Flags: nowait postinstall skipifsilent unchecked

[UninstallDelete]
Type: filesandordirs; Name: "{app}"
Type: filesandordirs; Name: "{userappdata}\ZeltaTV"
Type: filesandordirs; Name: "{localappdata}\ZeltaTV"
Type: filesandordirs; Name: "{localappdata}\zeltatv-updater"
