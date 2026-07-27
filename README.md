# EnderLynx

EnderLynx is a Minecraft launcher focused on providing features for you to have your best Minecraft experience.

We are currently in beta, therefore expect plenty of bugs. If you encounter a bug when using the app, please report it on the [issues tab](https://github.com/Illusioner2520/EnderLynx/issues). If you want something added to the app, please request it in the issues tab.

## Installation

Download the latest version from the [releases page](https://github.com/Illusioner2520/EnderLynx/releases). You can download an installer for your OS or the files in the form of a .zip file. If you are on Windows, you will be able to receive updates from within the app. Other operating systems will have to manually install each update.

## Requirements

Currently, EnderLynx supports Windows and Linux. We offer a macOS distribution, but it has not been tested at all. The app itself requires less than 512 MB of storage space, however any installed instances (especially large modpacks) can significantly increase the amount of space required.

## Features

### Supported Versions

EnderLynx supports all versions of Minecraft supported by the vanilla Minecraft launcher.

### Supported Loaders

EnderLynx supports Fabric, Forge, NeoForge, Quilt or no loader at all.

### Other Features

- Easily swap between Minecraft accounts
- Full integration with both [Modrinth](https://modrinth.com/) and [CurseForge](https://www.curseforge.com/)
- Change your skin and cape within the launcher with many default skins to choose from
- View and edit your Minecraft Java friends list
- Share instances through a new `.elpack` file format
- Import instances from a CurseForge `.zip`, Modrinth `.mrpack`, MultiMC/Prism `.zip` or a CurseForge profile code
- Easily manage your mods, resource packs and shaders
- Jump directly into a world or server
- Add a desktop shortcut for worlds or instances
- View the logs for an instance in real time
- View and edit files for an instance
- Set default options to apply to newly-created instances
- View screenshots for an instance easily
- Automatic Java downloads
- Manually-triggered updates from inside the app (Windows exclusive)

## Technologies

EnderLynx is built using [Electron](https://www.electronjs.org/) and packaged by [Electron Forge](https://www.electronforge.io/). It uses [NSIS](https://nsis.sourceforge.io/Main_Page) for its installer on Windows. The updater uses [Rust](https://rust-lang.org/) to achieve its small file size.

## License

Copyright (c) 2025-2026

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

### Linux

Make sure that you have Node and Rust installed such that it can run `npm` and `cargo`  
Run: `npm run build:linux`  
Note for Linux:
- `.deb` needs `fakeroot` and `dpkg` installed
- `.rpm` needs `rpm` installed

### MacOS

Make sure that you have Node and Rust installed such that it can run `npm` and `cargo`  
Run: `npm run build:macos`