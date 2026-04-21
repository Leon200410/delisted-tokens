const express = require("express");
const cors = require("cors");
const delistedRoutes = require("./routes/delisted.routes");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ success: true, message: "backend is running" });
});

app.use("/api", delistedRoutes);

module.exports = app;
