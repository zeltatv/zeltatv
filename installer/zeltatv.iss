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

[Code]
// Two Windows behaviours are handled here.
//
// 1. Setup.exe is unpacked by SetupLdr into a second process, and that process does
//    not always inherit the foreground right the loader had. When the wizard opens
//    without activation, Windows spends the user's first click on activating the
//    window instead of pressing the focused button, so the wizard looks like it
//    ignores the first click. BringWizardToForeground raises and activates the
//    window as soon as a page is shown (and again on Next/Install), so the first
//    click reaches the wizard. There is no timer in the script engine, so the
//    retries are hooked to the wizard events instead.
//
// 2. Inno Setup's own "already installed" prompt is not raised for a per-user
//    AppId, so the uninstall key is read directly and the user can back out before
//    anything is written. /SILENT and /VERYSILENT keep the default answer (update).
//
// Only APIs that Inno Setup 6 Pascal Script actually exports are used:
// WizardForm.Handle / BringToFront / ActiveControl (WizardForm.SetFocus and
// WizardForm.FinishButton do not exist; the wizard reuses NextButton as
// Install/Finish), plus the user32 imports below.
//
// Verified on Windows 11 with Inno Setup 6.7.3: at wpWelcome the wizard window is
// already visible, and SetForegroundWindow returns 0 while AttachThreadInput on the
// window that holds the foreground fails (that window belongs to another process).
// A synthetic Alt tap clears the foreground lock and the next SetForegroundWindow
// returns 1, so the Alt tap is used as the retry. Windows still refuses the switch
// when the foreground window belongs to a process of a higher integrity level
// (for example an elevated console); the flash is the fallback in that case.

const
  ExistingInstallKey =
    'Software\Microsoft\Windows\CurrentVersion\Uninstall\{8C3D7B5A-5F6E-4B3A-9F1C-2A7E6D4B9C10}_is1';
  SW_RESTORE = 9;
  HWND_TOPMOST = -1;
  HWND_NOTOPMOST = -2;
  SWP_NOSIZE = $0001;
  SWP_NOMOVE = $0002;
  VK_MENU = 18;
  KEYEVENTF_KEYUP = $0002;

function SetForegroundWindow(Wnd: HWND): Boolean;
  external 'SetForegroundWindow@user32.dll stdcall';
function BringWindowToTop(Wnd: HWND): Boolean;
  external 'BringWindowToTop@user32.dll stdcall';
function GetForegroundWindow: HWND;
  external 'GetForegroundWindow@user32.dll stdcall';
function IsIconic(Wnd: HWND): Boolean;
  external 'IsIconic@user32.dll stdcall';
function ShowWindow(Wnd: HWND; CmdShow: Integer): Boolean;
  external 'ShowWindow@user32.dll stdcall';
function SetWindowPos(Wnd, InsertAfter: HWND; X, Y, CX, CY: Integer;
  Flags: Cardinal): Boolean;
  external 'SetWindowPos@user32.dll stdcall';
function AttachThreadInput(IdAttach, IdAttachTo: Cardinal;
  Attach: Integer): Integer;
  external 'AttachThreadInput@user32.dll stdcall';
function GetWindowThreadProcessId(Wnd: HWND; var ProcId: Cardinal): Cardinal;
  external 'GetWindowThreadProcessId@user32.dll stdcall';
function GetCurrentThreadId: Cardinal;
  external 'GetCurrentThreadId@kernel32.dll stdcall';
function FlashWindow(Wnd: HWND; Invert: Integer): Integer;
  external 'FlashWindow@user32.dll stdcall';
procedure KeybdEvent(Vk, Scan: Byte; Flags, Extra: Cardinal);
  external 'keybd_event@user32.dll stdcall';

var
  QueriedVersion: String;

function FindInstalledVersion: String;
begin
  // PrivilegesRequired=lowest means the per-user key, but an older per-machine
  // build (or the other registry view) must be recognised as well.
  Result := '';
  if RegQueryStringValue(HKCU, ExistingInstallKey, 'DisplayVersion',
    QueriedVersion) then
    Result := QueriedVersion
  else if RegQueryStringValue(HKCU64, ExistingInstallKey, 'DisplayVersion',
    QueriedVersion) then
    Result := QueriedVersion
  else if RegQueryStringValue(HKLM, ExistingInstallKey, 'DisplayVersion',
    QueriedVersion) then
    Result := QueriedVersion
  else if RegQueryStringValue(HKLM64, ExistingInstallKey, 'DisplayVersion',
    QueriedVersion) then
    Result := QueriedVersion;
  if Result = '' then
  begin
    // A key without DisplayVersion still means the app is installed.
    if RegValueExists(HKCU, ExistingInstallKey, 'UninstallString') or
       RegValueExists(HKCU64, ExistingInstallKey, 'UninstallString') or
       RegValueExists(HKLM, ExistingInstallKey, 'UninstallString') or
       RegValueExists(HKLM64, ExistingInstallKey, 'UninstallString') then
      Result := 'unknown version';
  end;
end;

procedure ActivateWizardWindow(Wnd: HWND);
var
  Fg: HWND;
  MyThread, FgThread, FgPid: Cardinal;
  Attached: Boolean;
begin
  Fg := GetForegroundWindow;
  FgThread := 0;
  Attached := False;
  MyThread := GetCurrentThreadId;
  // Windows only lets the foreground thread hand over activation, so attach to the
  // input queue of whatever holds it for the duration of the call. This fails when
  // the holder belongs to another process, which is why the caller also taps Alt.
  if Fg <> 0 then
  begin
    FgThread := GetWindowThreadProcessId(Fg, FgPid);
    if (FgThread <> 0) and (FgThread <> MyThread) then
      Attached := AttachThreadInput(MyThread, FgThread, 1) <> 0;
  end;
  // The topmost toggle is the usual way to raise a window without leaving it
  // always-on-top; BringToFront keeps it above the other windows of the setup.
  SetWindowPos(Wnd, HWND_TOPMOST, 0, 0, 0, 0, SWP_NOMOVE or SWP_NOSIZE);
  SetWindowPos(Wnd, HWND_NOTOPMOST, 0, 0, 0, 0, SWP_NOMOVE or SWP_NOSIZE);
  WizardForm.BringToFront;
  BringWindowToTop(Wnd);
  SetForegroundWindow(Wnd);
  if Attached then
    AttachThreadInput(MyThread, FgThread, 0);
end;

procedure BringWizardToForeground;
var
  Wnd: HWND;
  Attempt: Integer;
begin
  Wnd := WizardForm.Handle;
  if Wnd = 0 then
    Exit; // silent mode: there is no wizard window
  // /SILENT and /VERYSILENT create the form without showing it; never raise that.
  if WizardSilent then
    Exit;
  if IsIconic(Wnd) then
    ShowWindow(Wnd, SW_RESTORE);
  if GetForegroundWindow = Wnd then
    Exit;
  ActivateWizardWindow(Wnd);
  if GetForegroundWindow = Wnd then
  begin
    Log('ZeltaTV: wizard is in the foreground');
    Exit;
  end;
  // Windows refused the request because the setup process did not receive the last
  // input event. A synthetic Alt tap counts as input and clears the foreground
  // lock; two more attempts cover focus changes racing with the activation.
  for Attempt := 1 to 2 do
  begin
    KeybdEvent(VK_MENU, 0, 0, 0);
    KeybdEvent(VK_MENU, 0, KEYEVENTF_KEYUP, 0);
    ActivateWizardWindow(Wnd);
    if GetForegroundWindow = Wnd then
    begin
      Log('ZeltaTV: wizard is in the foreground (attempt ' + IntToStr(Attempt + 1) + ')');
      Exit;
    end;
    Sleep(100);
  end;
  // Still refused (another process keeps stealing focus): flash the taskbar button
  // so the window is at least noticed, and log it for support.
  Log('ZeltaTV: Windows refused the foreground request, flashing the wizard');
  FlashWindow(Wnd, 1);
end;

function InitializeSetup: Boolean;
var
  InstalledVersion: String;
begin
  Result := True;
  InstalledVersion := FindInstalledVersion;
  if InstalledVersion <> '' then
  begin
    Log('ZeltaTV: existing installation found, version ' + InstalledVersion);
    // Default IDYES so /VERYSILENT updates keep working unattended.
    if SuppressibleMsgBox('ZeltaTV ' + InstalledVersion +
      ' is already installed on this PC. Continue to update it?',
      mbConfirmation, MB_YESNO, IDYES) <> IDYES then
    begin
      Log('ZeltaTV: setup cancelled because of the existing installation');
      Result := False;
    end;
  end;
end;

procedure InitializeWizard;
begin
  // Keyboard focus on Next before the first page is painted: Enter confirms the
  // welcome page even if the click only managed to activate the window.
  WizardForm.ActiveControl := WizardForm.NextButton;
  Log('ZeltaTV: wizard created, Next is the active control');
end;

procedure CurPageChanged(CurPageID: Integer);
begin
  BringWizardToForeground;
  // wpWelcome = first page, wpReady = "Install", wpFinished = "Finish".
  if (CurPageID = wpWelcome) or (CurPageID = wpReady) or
     (CurPageID = wpFinished) then
    WizardForm.ActiveControl := WizardForm.NextButton;
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  // Runs on every Next/Install click: if the wizard lost the foreground again, the
  // following page is raised before the user sees it.
  Result := True;
  BringWizardToForeground;
end;
