// any JS payload
const {
  version: { container: version }
} = require("../config");
setInterval(
  () =>
    console.log(
      `Hello World from container PID ${process.pid} version ${version}`
    ),
  2000
);
