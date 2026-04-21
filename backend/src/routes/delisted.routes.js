const express = require("express");
const {
  listExchanges,
  fetchDelistedTokens,
} = require("../controllers/delisted.controller");

const router = express.Router();

router.get("/exchanges", listExchanges);
router.get("/delisted/:exchangeId", fetchDelistedTokens);

module.exports = router;
