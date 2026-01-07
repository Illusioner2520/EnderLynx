!include "MUI2.nsh"

Name "EnderLynx"
OutFile "EnderLynxInstaller.exe"
InstallDir "$LOCALAPPDATA\EnderLynx"
InstallDirRegKey HKCU "Software\EnderLynx" "InstallDir"
RequestExecutionLevel user

Icon "../resources/icons/icon.ico"
UninstallIcon "../resources/icons/icon.ico"

Var CheckboxDesktop
Var CheckboxStartMenu

Var DoDesktop
Var DoStartMenu

!define MUI_ABORTWARNING
!define MUI_ICON "../resources/icons/icon.ico"
!define MUI_UNICON "../resources/icons/icon.ico"

!insertmacro MUI_PAGE_DIRECTORY
Page Custom OptionsPage LeaveOptionsPage
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

Function OptionsPage
    nsDialogs::Create 1018
    Pop $0
    ${If} $0 == error
        Abort
    ${EndIf}

    ${NSD_CreateCheckbox} 0 0 100% 12u "Create Desktop Shortcut"
    Pop $CheckboxDesktop
    ${NSD_SetState} $CheckboxDesktop ${BST_CHECKED}

    ${NSD_CreateCheckbox} 0 14u 100% 12u "Create Start Menu Shortcut"
    Pop $CheckboxStartMenu
    ${NSD_SetState} $CheckboxStartMenu ${BST_CHECKED}

    nsDialogs::Show
FunctionEnd

Function LeaveOptionsPage
    ${NSD_GetState} $CheckboxDesktop $DoDesktop
    ${NSD_GetState} $CheckboxStartMenu $DoStartMenu
FunctionEnd

Section "MainSection" SecMain
    WriteRegStr HKCU "Software\EnderLynx" "InstallDir" "$INSTDIR"

    SetOutPath "$INSTDIR"
    File /r "..\out\EnderLynx-win32-x64\*.*"

    WriteUninstaller "$INSTDIR\Uninstall.exe"

    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\EnderLynx" "DisplayName" "EnderLynx"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\EnderLynx" "DisplayIcon" "$INSTDIR\EnderLynx.exe"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\EnderLynx" "UninstallString" "$\"$INSTDIR\Uninstall.exe$\""
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\EnderLynx" "InstallLocation" "$INSTDIR"
    WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\EnderLynx" "Publisher" "EnderLynx"
    WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\EnderLynx" "NoModify" 1
    WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\EnderLynx" "NoRepair" 1

    WriteRegStr HKCU "Software\Classes\.elpack" "" "EnderLynx.elpack"
    WriteRegStr HKCU "Software\Classes\EnderLynx.elpack" "" "EnderLynx Pack File"
    WriteRegStr HKCU "Software\Classes\EnderLynx.elpack\DefaultIcon" "" "$INSTDIR\EnderLynx.exe,0"
    WriteRegStr HKCU "Software\Classes\EnderLynx.elpack\shell" "" "open"
    WriteRegStr HKCU "Software\Classes\EnderLynx.elpack\shell\open\command" "" '"$INSTDIR\EnderLynx.exe" "%1"'

    WriteRegStr HKCU "Software\Classes\Applications\EnderLynx.exe\shell\open\command" "" '"$INSTDIR\EnderLynx.exe" "%1"'
    WriteRegStr HKCU "Software\Classes\Applications\EnderLynx.exe" "FriendlyAppName" "EnderLynx"
    WriteRegStr HKCU "Software\Classes\Applications\EnderLynx.exe\DefaultIcon" "" "$INSTDIR\EnderLynx.exe,0"

    WriteRegStr HKCU "Software\Classes\.mrpack\OpenWithProgids" "EnderLynx.mrpack" ""
    WriteRegStr HKCU "Software\Classes\.zip\OpenWithProgids" "EnderLynx.zip" ""

    System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'

    ${If} $DoDesktop == ${BST_CHECKED}
        CreateShortcut "$DESKTOP\EnderLynx.lnk" "$INSTDIR\EnderLynx.exe"
    ${EndIf}

    ${If} $DoStartMenu == ${BST_CHECKED}
        CreateShortcut "$SMPROGRAMS\EnderLynx.lnk" "$INSTDIR\EnderLynx.exe"
    ${EndIf}
SectionEnd

Section "Uninstall"
    RMDir /r "$INSTDIR"

    DeleteRegKey HKCU "Software\EnderLynx"
    DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\EnderLynx"

    DeleteRegKey HKCU "Software\Classes\EnderLynx.elpack"
    DeleteRegValue HKCU "Software\Classes\.elpack" ""

    DeleteRegValue HKCU "Software\Classes\.mrpack\OpenWithProgids" "EnderLynx.mrpack"
    DeleteRegValue HKCU "Software\Classes\.zip\OpenWithProgids" "EnderLynx.zip"
    DeleteRegKey HKCU "Software\Classes\EnderLynx.mrpack"
    DeleteRegKey HKCU "Software\Classes\EnderLynx.zip"

    DeleteRegKey HKCU "Software\Classes\Applications\EnderLynx.exe"

    System::Call 'shell32::SHChangeNotify(i 0x08000000, i 0, i 0, i 0)'

    Delete "$DESKTOP\EnderLynx.lnk"
    RMDir /r "$SMPROGRAMS\EnderLynx"
SectionEnd