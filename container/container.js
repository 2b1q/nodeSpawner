// any JS payload
const {
  version: { container: version }
} = require("../config");
setInterval(
  () => console.log(`container PID ${process.pid} version ${version}`),
  2000
);
