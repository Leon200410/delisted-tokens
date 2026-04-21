const app = require("./app");
const { DEFAULT_PORT } = require("./config/env");

const port = process.env.PORT || DEFAULT_PORT;

app.listen(port, () => {
  console.log(`API server listening on http://localhost:${port}`);
});
