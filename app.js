const { spawn, execFile } = require("child_process");
const fs = require("fs");

// require configs
const {
  reloadApp, // false => reload container only
  platform,
  colors: c,
  version: { container: CONTAINER_VERSION, containerExe },
  git: { repoPath, CHECK_INTERVAL, remote }
} = require("./config");

// current process ID
const PID = process.pid;
const currentExec = process.execPath.split("\\").pop();

// init logger
const {
  createLogger,
  format: { label, combine, timestamp, simple, printf },
  transports
} = require("winston");
const loggerFormat = printf(
  ({ message, label, timestamp }) =>
    `${c.cyan}[${label} ${c.yellow}${PID} ${c.green}${currentExec}${c.cyan}]${
      c.white
    }[${timestamp}] ${message}`
);
const appLogger = createLogger({
  format: combine(
    label({ label: "core APP" }),
    timestamp(),
    simple(),
    loggerFormat
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: "app.log" })
  ]
});
const containerLogger = createLogger({
  format: simple(),
  transports: [new transports.File({ filename: "./container/gw.log" })]
});

// initialise .git repository
const git = require("simple-git/promise");

// build gw.exe Promise
const buildP = () =>
  new Promise((resolve, reject) => {
    // check OS type
    if (platform !== "win32") return reject("not win32 platform");
    if (rebuild) {
      appLogger.info(`${c.magenta}[nexe]${c.white} rebuilding ${containerExe}`);
      const { compile } = require("nexe"); // load nexe compile API
      compile({
        input: "./container/container.js",
        output: "./container/" + containerExe
      })
        .then(() => {
          appLogger.info(`${c.magenta}[nexe]${c.white} Build success`);
          rebuild = false;
          return resolve();
        })
        .catch(e => reject(`nexe compilation ${containerExe} error\n`, e));
    } else resolve();
  });

// spawn new container Promise
const spawnContainerP = () =>
  new Promise((resolve, reject) => {
    const exe = "./container/" + containerExe;
    appLogger.info(`${c.magenta}[spawn]${c.white} spawn new proc ${exe}`);
    try {
      if (fs.existsSync(exe)) {
        let cpid = spawnContainer(exe);
        appLogger.info(`${c.magenta}[spawn]${c.white} container PID ${cpid}`);
        return resolve();
      } else reject(exe + " not exists");
    } catch (e) {
      reject(e);
    }
  });

// update scheduller
var container = null; // container reference
var rebuild = false; // flag to recompile EXE
var updInterval = null;

const runUpdater = () => {
  appLogger.info(
    `${c.magenta}[runUpdater]${
      c.white
    } check updates from repo with ${CHECK_INTERVAL / 1000} sec CHECK_INTERVAL`
  );
  updInterval = setInterval(checkUpdates, CHECK_INTERVAL);
};
// bootstrap
// check repo
// fetch repo
// build gw.exe
// spawn gw.exe
// run check updates scheduller
git
  .checkIsRepo() // check repo
  .then(
    isRepo =>
      !isRepo &&
      git.clone(remote).then(() => {
        appLogger.info(`${c.cyan}[git]${c.white} clone done`);
        rebuild = true; // set flag to rebuild exe after clone repo
      })
  )
  .then(buildP) // build gw.exe
  .then(spawnContainerP)
  .then(() => runUpdater()) // run check updates scheduller
  .catch(e => appLogger.error(e));

// if (platform === "win32") {
//   const { compile } = require("nexe"); // load nexe compile API
//   reload = () => {
//     container.kill(); // kill child proc with SIGTERM signal
//     delete container; // delete current container
//     building = true; // set building
//     let output =
//       currentExec === "nodeSpawner.exe" ? "tmp.exe" : "nodeSpawner.exe";
//     compile({
//       input: "./app.js",
//       mangle: false,
//       // build: true,
//       output: output
//       // clean: true
//     }).then(() => {
//       appLogger.info(`${c.magenta}[nexe]${c.white} Build success`);
//       building = false;
//       // restart application

//       // reload using NPM or EXEC
//       if (currentExec === "node.exe") {
//         require("child_process").exec("npm restart");
//       } else {
//         appLogger.info(`spawn detached proc ${output}`);
//         const subprocess = spawn(__dirname + "\\" + output, {
//           detached: true, // detach process
//           stdio: "ignore" // piping all stdio to /dev/null
//         });
//         subprocess.unref();
//         // require("child_process").exec(`START ${output}`);
//         // setTimeout(process.exit(0), 10000);
//         process.exit(0);
//       }
//     });
//   };
// }

// /**
//  * > GIT check each CHECK_INTERVAL
//  * > GIT PULL if updates exists > respawn
//  * > respawn proc
//  *
//  */

function checkUpdates() {
  appLogger.info(`${c.magenta}[runUpdater]${c.white} check updates`);
  // stop interval
  clearInterval(updInterval);
  // check updates
  require("simple-git")()
    .exec(() =>
      appLogger.info(
        `${c.cyan}[git] ${c.white}Starting pull from origin master`
      )
    )
    .pull("origin", "master", (err, update) => {
      if (err) return appLogger.error(err);
      if (update && update.summary.changes) {
        appLogger.info(
          `${c.yellow} <<<< Got new updates from origin master >>>> ${c.white}`
        );
        // rebuild container
        rebuild = true;
        buildP()
          .then(() => respawnContainer()) // respawn new container
          .catch(e => {
            appLogger.error("rebuild on update failed: ", e);
            rebuild = false;
          });
      } else appLogger.info(`${c.cyan}[git]${c.white}`, update);
    })
    .exec(() => {
      appLogger.info(`${c.magenta}[runUpdater]${c.white} check updates done`);
      // restore interval
      updInterval = setInterval(checkUpdates, CHECK_INTERVAL);
    });
}

// proc respawner
function respawnContainer() {
  if (container) {
    appLogger.info(`${c.cyan}[respawner] ${c.white}RESPAWN container`);
    container.kill(); // kill child proc with SIGTERM signal
    delete container; // delete current container
    spawnContainerP()
      .then(() =>
        appLogger.info(`${c.cyan}[respawner] ${c.white}respawn complete`)
      )
      .catch(e =>
        appLogger.error(`${c.cyan}[respawner] ${c.white}respawn error:\n`, e)
      );
  }
}

// spawn proc wrapper
function spawnContainer(exe) {
  container = spawn(exe, {
    detached: true
  });
  container.stdout.on("data", data =>
    containerLogger.info(`container stdout: ${data}`)
  );
  container.stderr.on("data", data => containerLogger.info(`stderr: ${data}`));
  container.on("close", code =>
    appLogger.info(`child process exited with code ${code}`)
  );
  container.on("error", err => containerLogger.error(err));
  return container.pid;
}
