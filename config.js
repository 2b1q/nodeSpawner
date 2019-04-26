module.exports = {
  reloadApp: true, // false => reload container only, otherwise recompile and restart
  platform: process.platform,
  git: {
    remote: "https://github.com/2b1q/nodeSpawner.git",
    user: "",
    repoPath: ".repo/",
    CHECK_INTERVAL: 10000
  },
  version: {
    container: "0.0.3", // gw.exe
    containerExe: "gw.exe",
    app: "0.0.2" // gw_service.exe (main proc)
  },
  // colorize console
  colors: {
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    cyan: "\x1b[36m",
    green: "\x1b[32m",
    black: "\x1b[30m",
    red: "\x1b[31m",
    magenta: "\x1b[35m",
    white: "\x1b[37m"
  }
};
