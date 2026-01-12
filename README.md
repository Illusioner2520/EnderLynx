# EnderLynx

EnderLynx is a Minecraft launcher that is currently a work in progress. We are currently in beta, therefore expect plenty of bugs. If you encounter a bug when using the app, please report it in the issues tab. If you want something added to the app, please request it in the issues tab.

## Requirements

Currently, EnderLynx only supports Windows 64-bit. We are currently in the process of expanding to Linux and MacOS. As for space required on the disk, the app itself requires less than 512 MB, however any installed instances (especially large modpacks) can significantly increase the amount of space required.

## Features

 - 🖥️ Launch any version of Minecraft from rd-132211 to present day
 - 🔃 Launch Vanilla, Fabric, Forge, NeoForge or Quilt
 - 👤 Easily switch between Minecraft accounts
   - 🟥 Supports Microsoft sign-in
 - ℹ️ Create separate instances of Minecraft independent from each other
 - 🛜 Full integration with Modrinth and CurseForge
   - 📃 Select any version or download the most recent one
   - 📷 View the gallery for any project
   - 📄 View the description for any project
 - 🧑 Change your skin and cape in the launcher
   - 🧑‍🦰 Includes all default skins and skins from official skin packs
   - ↩️ Import skins from a file, username or URL
   - ⭐ Favorite skins to come back to them later
 - 🔗 Share instances through a new .elpack file format
 - 📁 Add instances from a CurseForge .zip, Modrinth .mrpack or a CurseForge profile code
 - 🔔 Includes the most recent Minecraft news on the home page
 - ❓ Includes a random assortment of modpacks to discover on the home page
 - 🎁 Manage mods, resource packs and shaders, including the ability to disable.
   - 📈 Update content, including when an instance's game version is edited
 - 🍫 Jump directly into a world if the version supports it
 - ⌚ View your most recently played worlds and instances to jump back in
 - 📌 Pin your instances or worlds to the home screen
 - ✂️ Add a desktop shortcut for instances or worlds to jump back in without opening the launcher
 - 🌍 View an instance's singleplayer and multiplayer worlds
   - 🌏 Add worlds and servers from CurseForge
   - 🗺️ Import worlds from other launchers
   - 📦 Add data packs from Modrinth and CurseForge to any singleplayer world
 - 🪵 View the logs for an instance in real time (and past logs)
 - 🤔 Set default options that are applied to any newly created instance
 - 🖼️ View the screenshots for any instance
 - 🔧 Easily Repair instances (and select which parts to repair)
 - 📚 Organize your instance list with custom groups
 - ⏲️ Keeps track of your play time per instance
 - 🔵 Multiple accent colors to choose from
 - 🍵 Automatic downloads of Java
   - ☕ Change the Java Installation the launcher uses
   - 🐏 Change the amount of RAM each instance can use
 - ⬆️ Update from inside of the App (Only on Windows) (We use manual updates to give you more control)
 - ✅ Many other helpful features and more to come!

## Technologies

EnderLynx is built using [Electron](https://www.electronjs.org/) and packaged by [Electron Forge](https://www.electronforge.io/). It uses [NSIS](https://nsis.sourceforge.io/Main_Page) for its installer on Windows. The updater uses [Rust](https://rust-lang.org/) to achieve its small file size.

## License

Copyright (c) 2025-2026 EnderLynx

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## Contributions

If you would like, you can create a pull request and submit code to be contributed. I apologize for my unorganized code.
Running the developer version without building can be done by running `npm run start`

## Building

Output files will be in the `out/make` folder.
The Windows installer will be at `installer/EnderLynxInstaller.exe`

### Windows

Make sure that you have Node, Rust and NSIS installed such that it can run `npm`, `cargo` and `makensis`
Run: `npm run build:windows`

### Unix

Make sure that you have Node and Rust installed such that it can run `npm` and `cargo`
Note for Linux: make sure you have `fakeroot` and `dpkg` installed to make the `.deb` and `rpm` installed to make the `.rpm`
Run: `npm run build:unix`