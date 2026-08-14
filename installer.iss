; =====================================================================
; Inno Setup Compiler Script
; Application: DeepSeek Desktop
; Developer: Senior A. (https://senior-flax.vercel.app/)
; =====================================================================

#define MyAppName "DeepSeek Desktop"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "Senior A."
#define MyAppURL "https://senior-flax.vercel.app/"
#define MyAppExeName "DeepSeek.exe"

[Setup]
; Unique AppId generated for DeepSeek Desktop
AppId={{B0B6C338-E2F6-4C12-8015-5017CFEE269D}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppVerName={#MyAppName} v{#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\DeepSeek Desktop
DefaultGroupName={#MyAppName}
AllowNoIcons=yes
LicenseFile=LICENSE
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
OutputBaseFilename=DeepSeek-Desktop-Setup-v1.0.0
OutputDir=dist\installer
Compression=lzma2/ultra64
SolidCompression=yes
WizardStyle=modern
WizardResizable=yes
SetupIconFile=deepseek-logo.ico
UninstallDisplayIcon={app}\{#MyAppExeName}

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"

[Files]
Source: "dist\DeepSeek-win32-x64\{#MyAppExeName}"; DestDir: "{app}"; Flags: ignoreversion
Source: "dist\DeepSeek-win32-x64\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{autoprograms}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent
