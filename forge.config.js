const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');
const path = require('path');

module.exports = {
  packagerConfig: {
    asar: {
      unpack: '**/node_modules/@img/**'
    },
    icon: path.resolve(__dirname, 'icon'),
    ignore: [
      /^\/java($|\/)/,
      /^\/minecraft($|\/)/,
      /^\/temp_icons($|\/)/,
      /^\/\.github($|\/)/,
      /^\/installer($|\/)/,
      /\.gitignore$/,
      /\.devdbrc$/,
      /app\.db$/,
      /app\.db-shm$/,
      /app\.db-wal$/,
      /credits\.txt$/,
      /forge\.config\.js$/,
      /package-lock\.json$/,
      /updater\.js$/
    ],
    extraResource: ['./resources/lang']
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {},
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
    {
      name: '@electron-forge/maker-deb',
      config: {},
    },
    {
      name: '@electron-forge/maker-rpm',
      config: {},
    },
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