// any JS payload
const {
  version: { container: version }
} = require("../config");
setInterval(
  () =>
    console.log(
      `container PID ${process.pid}
      Hello from container version ${version}`
    ),
  1500
);
