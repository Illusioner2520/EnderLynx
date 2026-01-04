const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');
const path = require('path');
const fs = require('fs');

const isLinux = process.platform === 'linux';
const isWindows = process.platform === 'win32';
const isMac = process.platform === 'darwin';

module.exports = {
  packagerConfig: {
    asar: {
      unpack: [
        '**/node_modules/@img/**',
        '**/node_modules/create-desktop-shortcuts/src/*.vbs'
      ]
    },
    icon: path.resolve(__dirname, 'icon'),
    ignore: [
      /^\/java($|\/)/,
      /^\/minecraft($|\/)/,
      /^\/temp_icons($|\/)/,
      /^\/\.github($|\/)/,
      /^\/installer($|\/)/,
      /^\/updater($|\/)/,
      /\.gitignore$/,
      /\.devdbrc$/,
      /app\.db$/,
      /app\.db-shm$/,
      /app\.db-wal$/,
      /credits\.txt$/,
      /forge\.config\.js$/,
      /package-lock\.json$/,
      /updater\.js$/,
      /README\.md$/,
      /LICENSE$/
    ]
  },
  hooks: {
    postPackage: async () => {
      // Delete non-English locale files
      const localesDir = path.join(__dirname, 'out', '*', 'locales');

      try {
        require('glob').sync(localesDir).forEach(dir => {
          if (fs.existsSync(dir)) {
            fs.readdirSync(dir).forEach(file => {
              if (file != "en-US.pak") {
                fs.unlinkSync(path.join(dir, file));
              }
            });
          }
        });
      } catch (error) {
        console.warn('Could not delete locales:', error.message);
      }
    }
  },
  rebuildConfig: {},
  makers: [
    // Windows
    ...(isWindows ? [{
      name: '@electron-forge/maker-zip',
      platforms: ['win32'],
    }] : []),

    // Linux
    ...(isLinux ? [{
      name: '@electron-forge/maker-deb',
      config: {
        options: {
          name: 'enderlynx',
          productName: "EnderLynx",
          genericName: "Minecraft Launcher",
          maintainer: 'Illusioner',
          section: 'games',
          icon: 'icon.png',
          categories: ['Game'],
          mimeType: ['application/zip']
        }
      },
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {
        options: {
          name: 'EnderLynx',
          productName: "EnderLynx",
          genericName: "Minecraft Launcher",
          license: "MIT",
          icon: "icon.png",
          categories: ['Game'],
          mimeType: ['application/zip']
        }
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['linux'],
    }] : []),

    // macOS
    ...(isMac ? [{
      name: '@electron-forge/maker-dmg',
      config: {
        name: 'EnderLynx'
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    }] : [])
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};