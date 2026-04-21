const { exchanges } = require("../constants/exchanges");
const {
  getSupportedExchanges,
  getDelistedTokensByExchange,
} = require("../services/delisted.service");

async function listExchanges(req, res) {
  const data = getSupportedExchanges();
  res.json({ success: true, data });
}

async function fetchDelistedTokens(req, res) {
  const { exchangeId } = req.params;

  const matched = exchanges.some((item) => item.id === exchangeId);
  if (!matched) {
    return res.status(400).json({
      success: false,
      message: "Unsupported exchangeId",
      supportedExchanges: exchanges.map((item) => item.id),
    });
  }

  try {
    const data = await getDelistedTokensByExchange(exchangeId);
    return res.json({ success: true, data });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error instanceof Error ? error.message : "Internal server error",
    });
  }
}

module.exports = {
  listExchanges,
  fetchDelistedTokens,
};
