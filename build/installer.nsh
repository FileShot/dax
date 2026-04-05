; ─────────────────────────────────────────────────────────────────────────────
; Dax Installer — Custom NSIS Script
; Included by electron-builder via nsis.include setting
; ─────────────────────────────────────────────────────────────────────────────

; === Header: define our branding constants ===
; Use !ifndef guards — electron-builder pre-defines some MUI constants
!macro customHeader
  !ifndef MUI_WELCOMEPAGE_TITLE
    !define MUI_WELCOMEPAGE_TITLE "Welcome to Dax"
  !endif
  !ifndef MUI_WELCOMEPAGE_TEXT
    !define MUI_WELCOMEPAGE_TEXT "Dax is a privacy-first AI agent platform. Build, deploy, and manage autonomous AI agents — entirely on your machine, with no data leaving your device.$\r$\n$\r$\nThis wizard will guide you through the installation. Click Next to continue."
  !endif
  !ifndef MUI_FINISHPAGE_TITLE
    !define MUI_FINISHPAGE_TITLE "Dax is Ready"
  !endif
  !ifndef MUI_FINISHPAGE_TEXT
    !define MUI_FINISHPAGE_TEXT "Dax has been successfully installed.$\r$\n$\r$\nYour agents run locally. Your data stays private. You're in control."
  !endif
  !ifndef MUI_FINISHPAGE_LINK
    !define MUI_FINISHPAGE_LINK "Visit graysoft.dev"
    !define MUI_FINISHPAGE_LINK_LOCATION "https://graysoft.dev"
  !endif
!macroend

; === Add the welcome page at the start of the installer ===
!macro customWelcomePage
  !insertMacro MUI_PAGE_WELCOME
!macroend

; === Post-install actions ===
!macro customInstall
  ; Register dax:// protocol handler so agents/integrations can use it
  WriteRegStr HKCU "Software\Classes\dax" "" "URL:Dax Protocol"
  WriteRegStr HKCU "Software\Classes\dax" "URL Protocol" ""
  WriteRegStr HKCU "Software\Classes\dax\DefaultIcon" "" "$INSTDIR\${APP_EXECUTABLE_FILENAME},0"
  WriteRegStr HKCU "Software\Classes\dax\shell\open\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'

  ; Add Dax to Windows Firewall exception (suppress prompt for local server)
  nsExec::ExecToLog 'netsh advfirewall firewall add rule name="Dax Agent Service" dir=in action=allow protocol=TCP localport=3700-3800 program="$INSTDIR\${APP_EXECUTABLE_FILENAME}" enable=yes'
!macroend

; === Pre-uninstall: optionally remove user data ===
!macro customUnInstall
  MessageBox MB_YESNO|MB_ICONQUESTION "Do you want to remove your Dax data (agents, settings, and run history)?$\r$\n$\r$\nClick Yes to remove all data, or No to keep it." IDNO skip_data_removal
    RMDir /r "$APPDATA\dax"
  skip_data_removal:

  ; Remove protocol handler registration
  DeleteRegKey HKCU "Software\Classes\dax"

  ; Remove firewall rule
  nsExec::ExecToLog 'netsh advfirewall firewall delete rule name="Dax Agent Service"'
!macroend

; === Custom uninstaller welcome page ===
!macro customUnWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Uninstall Dax"
  !define MUI_WELCOMEPAGE_TEXT "This wizard will remove Dax from your computer.$\r$\n$\r$\nYour agent data and settings are stored separately and you will be given the option to remove them."
  !insertmacro MUI_UNPAGE_WELCOME
!macroend
