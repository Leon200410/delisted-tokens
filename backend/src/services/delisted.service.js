const { exchanges } = require("../constants/exchanges");

function getSupportedExchanges() {
  return exchanges;
}

const GATE_LIST_URL =
  "https://www.gate.com/api/web/v1/portal/announcement/list_article?sub_website_id=0";
const GATE_ANNOUNCEMENTS_PAGE_URL = "https://www.gate.com/zh/announcements";
const GATE_LIST_DEFAULT_FORM = {
  page: "1",
  size: "15",
  tags: "",
  timer: "",
  cate_name: "delisted",
  cate_level: "1",
};
const GATE_NEXT_BUILD_ID_FALLBACK =
  process.env.GATE_NEXT_BUILD_ID || "8tJ5N7LULVJOzWkbUF2M5";
const HYPERLIQUID_ENTRIES_URL =
  "https://dzjnlsk4rxci0.cloudfront.net/mainnet/entries.json";
const HYPERLIQUID_ENTRY_DETAIL_URL_PREFIX =
  "https://dzjnlsk4rxci0.cloudfront.net/mainnet/entry-";
const KUCOIN_LIST_URL =
  "https://www.kucoin.com/_api/cms/articles?page=1&pageSize=10&category=delistings&c=&lang=zh_HK";
const KUCOIN_ARTICLE_DETAIL_PREFIX =
  "https://assets.staticimg.com/cms/articles/";
const LIGHTER_ANNOUNCEMENTS_API_URL =
  "https://mainnet.zklighter.elliot.ai/api/v1/announcement";

function extractSlugFromArticleUrl(articleUrl) {
  const match = String(articleUrl || "").match(/article\/(\d+)/);
  return match ? match[1] : null;
}

function isGateDelistedRelatedArticle(title) {
  const text = String(title || "");
  return /下架|已下架|下线|停止/.test(text);
}

function extractTradingPairsFromDesc(desc) {
  const text = String(desc || "")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ");

  const pairMatches = text.match(/\b[A-Z0-9]{2,20}_[A-Z0-9]{2,20}\b/g) || [];
  return [...new Set(pairMatches)];
}

function extractTokensFromTradingPairs(tradingPairs) {
  const tokenSet = new Set();

  for (const pair of tradingPairs) {
    const [baseToken] = String(pair).split("_");
    if (baseToken) {
      tokenSet.add(baseToken);
    }
  }

  return [...tokenSet];
}

function normalizeTokenFromPairLikeText(symbol) {
  const value = String(symbol || "").toUpperCase();
  const quoteSuffixes = ["USDT", "USDC", "USD", "BTC", "ETH"];
  for (const suffix of quoteSuffixes) {
    if (value.endsWith(suffix) && value.length > suffix.length) {
      return value.slice(0, -suffix.length);
    }
  }
  return value;
}

function extractUppercaseTokens(text) {
  const matches = String(text || "").match(/\b[A-Z][A-Z0-9]{1,15}\b/g) || [];
  const stopWords = new Set([
    "UTC",
    "USDC",
    "USDT",
    "USD",
    "PERPS",
    "API",
    "JSON",
  ]);
  return [...new Set(matches.filter((token) => !stopWords.has(token)))];
}

function tokenizeHyperliquidAssetChunk(chunk) {
  const cleaned = String(chunk || "")
    .replace(/\bperps?\b/gi, " ")
    .replace(/\bvalidator vote to\b/gi, " ")
    .replace(/\bdelist\b/gi, " ")
    .replace(/\band\b/gi, ",")
    .replace(/[()]/g, " ")
    .replace(/\s+/g, " ");

  const rawParts = cleaned.split(/[,\s/]+/).map((item) => item.trim());
  const stopWords = new Set(["", "and", "to", "vote", "validator"]);

  return rawParts.filter((item) => {
    if (stopWords.has(item.toLowerCase())) {
      return false;
    }
    return /^[A-Za-z][A-Za-z0-9]{1,15}$/.test(item);
  });
}

function extractTokensFromDelistTitle(title) {
  const text = String(title || "");
  const match = text.match(/delist\s+(.+)$/i);
  if (!match?.[1]) {
    return [];
  }
  return [...new Set(tokenizeHyperliquidAssetChunk(match[1]))];
}

function extractKucoinTokensFromText(text) {
  const rawText = String(text || "");
  const tokenSet = new Set();

  // 提取组合交易对：ABCUSDT、ABC/USDT、ABC_USDT
  const compactPairMatches =
    rawText.match(/\b[A-Z0-9]{2,20}(?:USDT|USDC|USD|BTC|ETH)\b/gi) || [];
  const separatedPairMatches =
    rawText.match(/\b[A-Z0-9]{2,20}\s*[_/]\s*(?:USDT|USDC|USD|BTC|ETH)\b/gi) ||
    [];
  const pairLikeMatches = [...compactPairMatches, ...separatedPairMatches];

  for (const pairLikeRaw of pairLikeMatches) {
    const pairLike = String(pairLikeRaw).replace(/[_/\s]+/g, "");
    const normalized = normalizeTokenFromPairLikeText(pairLike);
    if (normalized) {
      tokenSet.add(normalized);
    }
  }

  // 提取“代币列表”格式：CAI (CharacterX)、K (Sidekick)。
  const listTokenPattern = /(?:^|[\s>])([A-Z][A-Z0-9]{0,15})\s*\([^()]{1,120}\)/gm;
  for (const match of rawText.matchAll(listTokenPattern)) {
    const token = match?.[1];
    if (token) {
      tokenSet.add(token);
    }
  }

  return [...tokenSet];
}

async function getGateNextBuildId() {
  const response = await fetch(GATE_ANNOUNCEMENTS_PAGE_URL, {
    method: "GET",
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "User-Agent": "Mozilla/5.0",
      "Accept-Language": "zh-CN,zh;q=0.9",
    },
  });

  if (!response.ok) {
    return GATE_NEXT_BUILD_ID_FALLBACK;
  }

  const html = await response.text();
  const buildIdFromDataPath = html.match(/\/_next\/data\/([^/]+)\/zh\/announcements/);
  if (buildIdFromDataPath?.[1]) {
    return buildIdFromDataPath[1];
  }

  const buildIdFromJson = html.match(/"buildId":"([^"]+)"/);
  if (buildIdFromJson?.[1]) {
    return buildIdFromJson[1];
  }

  return GATE_NEXT_BUILD_ID_FALLBACK;
}

async function fetchGateFirstPageArticles() {
  const formBody = new URLSearchParams(GATE_LIST_DEFAULT_FORM);

  const response = await fetch(GATE_LIST_URL, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      "User-Agent": "Mozilla/5.0",
      "Accept-Language": "zh-CN,zh;q=0.9",
      Referer: GATE_ANNOUNCEMENTS_PAGE_URL,
    },
    body: formBody.toString(),
  });

  if (!response.ok) {
    throw new Error(`Gate list request failed: ${response.status}`);
  }

  const json = await response.json();
  const list = json?.data?.list;
  if (!Array.isArray(list)) {
    throw new Error("Gate list response format invalid");
  }

  return list;
}

async function fetchGateDetailDescBySlug(slug) {
  const buildId = await getGateNextBuildId();
  const detailUrl = `https://www.gate.com/announcements/_next/data/${buildId}/zh/announcements/article/${slug}.json?slug=${slug}`;

  const response = await fetch(detailUrl, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0",
      "Accept-Language": "zh-CN,zh;q=0.9",
    },
  });

  if (!response.ok) {
    throw new Error(`Gate detail request failed: ${response.status}, slug=${slug}`);
  }

  const json = await response.json();
  return json?.pageProps?.detail?.desc || "";
}

async function getGateDelistedTokens() {
  const articles = await fetchGateFirstPageArticles();
  const filteredArticles = articles.filter((item) =>
    isGateDelistedRelatedArticle(item?.title)
  );
  const targetArticles =
    filteredArticles.length > 0 ? filteredArticles : articles;

  const allPairs = [];

  for (const article of targetArticles) {
    const slug = extractSlugFromArticleUrl(article?.url);
    if (!slug) {
      continue;
    }

    try {
      const desc = await fetchGateDetailDescBySlug(slug);
      const pairs = extractTradingPairsFromDesc(desc);
      allPairs.push(...pairs);
    } catch (error) {
      // 保持主流程稳定，单篇文章失败时继续处理后续文章
      console.error(
        `Gate detail parse failed, slug=${slug}:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  return extractTokensFromTradingPairs(allPairs);
}

async function fetchHyperliquidEntries() {
  const response = await fetch(HYPERLIQUID_ENTRIES_URL, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Hyperliquid entries request failed: ${response.status}`);
  }

  const json = await response.json();
  const entries = json?.entries;
  if (!Array.isArray(entries)) {
    throw new Error("Hyperliquid entries response format invalid");
  }

  return entries;
}

async function fetchHyperliquidEntryDetail(uuid) {
  const response = await fetch(
    `${HYPERLIQUID_ENTRY_DETAIL_URL_PREFIX}${uuid}.json`,
    {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "Mozilla/5.0",
      },
    }
  );

  if (!response.ok) {
    throw new Error(
      `Hyperliquid entry detail request failed: ${response.status}, uuid=${uuid}`
    );
  }

  return response.json();
}

function parseHyperliquidContentText(content) {
  if (!content) {
    return "";
  }

  if (typeof content === "string") {
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed?.blocks)) {
        return parsed.blocks.map((item) => item?.text || "").join("\n");
      }
      return content;
    } catch {
      return content;
    }
  }

  if (Array.isArray(content?.blocks)) {
    return content.blocks.map((item) => item?.text || "").join("\n");
  }

  return String(content);
}

function extractHyperliquidTokensFromEntry(entry, detail) {
  const title = String(entry?.title || "");
  const tokensFromTitle = extractTokensFromDelistTitle(title);
  if (tokensFromTitle.length > 0) {
    return tokensFromTitle;
  }

  const contentText = parseHyperliquidContentText(detail?.content);
  const delistRelatedLines = contentText
    .split(/\n+/)
    .filter((line) => /delist/i.test(line));
  const fallbackTokens = delistRelatedLines.flatMap((line) => {
    const match = line.match(/delist\s+(.+)$/i);
    return tokenizeHyperliquidAssetChunk(match?.[1] || line);
  });

  return [...new Set(fallbackTokens)];
}

async function getHyperliquidDelistedTokens() {
  const entries = await fetchHyperliquidEntries();
  const delistingEntries = entries.filter(
    (entry) => String(entry?.category || "").toLowerCase() === "delistings"
  );

  const tokenSet = new Set();

  for (const entry of delistingEntries) {
    const uuid = entry?.uuid;
    if (!uuid) {
      continue;
    }

    try {
      const detail = await fetchHyperliquidEntryDetail(uuid);
      const tokens = extractHyperliquidTokensFromEntry(entry, detail);
      tokens.forEach((token) => tokenSet.add(token));
    } catch (error) {
      console.error(
        `Hyperliquid detail parse failed, uuid=${uuid}:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  return [...tokenSet];
}

async function fetchKucoinDelistingList() {
  const response = await fetch(KUCOIN_LIST_URL, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0",
      "Accept-Language": "zh-HK,zh;q=0.9",
      Referer: "https://www.kucoin.com/zh-hant/announcement/delistings",
    },
  });

  if (!response.ok) {
    throw new Error(`KuCoin list request failed: ${response.status}`);
  }

  const json = await response.json();
  const items = json?.items;
  if (!Array.isArray(items)) {
    throw new Error("KuCoin list response format invalid");
  }

  return items;
}

async function fetchKucoinArticleDetailByPath(path) {
  const slug = String(path || "").replace(/^\/+/, "");
  if (!slug) {
    return null;
  }

  const url = `${KUCOIN_ARTICLE_DETAIL_PREFIX}${slug}.json?t=${Date.now()}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0",
      "Accept-Language": "zh-HK,zh;q=0.9",
      Referer: "https://www.kucoin.com/zh-hant/announcement/delistings",
    },
  });

  if (!response.ok) {
    throw new Error(`KuCoin detail request failed: ${response.status}, path=${path}`);
  }

  return response.json();
}

async function getKucoinDelistedTokens() {
  const items = await fetchKucoinDelistingList();
  const tokenSet = new Set();

  for (const item of items) {
    const listText = `${item?.title || ""}\n${item?.summary || ""}`;
    extractKucoinTokensFromText(listText).forEach((token) => tokenSet.add(token));

    try {
      const detail = await fetchKucoinArticleDetailByPath(item?.path);
      if (!detail) {
        continue;
      }
      const detailText = `${detail?.title || ""}\n${detail?.summary || ""}\n${detail?.content || ""}`;
      extractKucoinTokensFromText(detailText).forEach((token) => tokenSet.add(token));
    } catch (error) {
      console.error(
        `KuCoin detail parse failed, path=${item?.path || ""}:`,
        error instanceof Error ? error.message : error
      );
    }
  }

  return [...tokenSet];
}

async function fetchLighterAnnouncements() {
  const response = await fetch(LIGHTER_ANNOUNCEMENTS_API_URL, {
    method: "GET",
    headers: {
      Accept: "application/json",
      "User-Agent": "Mozilla/5.0",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Lighter announcements API request failed: ${response.status}`
    );
  }

  const json = await response.json();
  const announcements = json?.announcements;
  if (!Array.isArray(announcements)) {
    throw new Error("Lighter announcements response format invalid");
  }
  return announcements;
}

function extractLighterDelistedTokensFromAnnouncements(announcements) {
  const tokenSet = new Set();
  const quoteTokens = new Set(["USDT", "USDC", "USD", "BTC", "ETH"]);
  const normalizeLighterToken = (token) => {
    const upper = String(token || "").toUpperCase();
    if (upper === "LAUCHCOIN") {
      return "LAUNCHCOIN";
    }
    return upper;
  };

  for (const item of announcements) {
    const title = String(item?.title || "");
    const content = String(item?.content || "");
    const text = `${title}\n${content}`;

    if (!/delist/i.test(text)) {
      continue;
    }

    const pairMatches =
      text.matchAll(/\$?([A-Z0-9]{2,20})\s*\/\s*(USDT|USDC|USD|BTC|ETH)\b/gi) ||
      [];
    for (const pair of pairMatches) {
      const base = normalizeLighterToken(pair?.[1]);
      if (base && !quoteTokens.has(base)) {
        tokenSet.add(base);
      }
    }

    const dollarTokenMatches = text.matchAll(/\$([A-Z][A-Z0-9]{1,19})\b/g) || [];
    for (const match of dollarTokenMatches) {
      const token = normalizeLighterToken(match?.[1]);
      if (token && !quoteTokens.has(token)) {
        tokenSet.add(token);
      }
    }

    const plainTokenMatches =
      text.matchAll(
        /([A-Z][A-Z0-9]{1,19})\s+(?:spot\s+market\s+)?will\s+be\s+delisted/gi
      ) || [];
    for (const match of plainTokenMatches) {
      const token = normalizeLighterToken(match?.[1]);
      if (token && !quoteTokens.has(token)) {
        tokenSet.add(token);
      }
    }
  }

  return [...tokenSet];
}

async function getLighterDelistedTokens() {
  const announcements = await fetchLighterAnnouncements();
  return extractLighterDelistedTokensFromAnnouncements(announcements);
}

async function getDelistedTokensByExchange(exchangeId) {
  if (exchangeId === "gate") {
    const tokens = await getGateDelistedTokens();
    return {
      exchangeId,
      updatedAt: new Date().toISOString(),
      tokens,
    };
  }

  if (exchangeId === "hyperliquid") {
    const tokens = await getHyperliquidDelistedTokens();
    return {
      exchangeId,
      updatedAt: new Date().toISOString(),
      tokens,
    };
  }

  if (exchangeId === "kucoin") {
    const tokens = await getKucoinDelistedTokens();
    return {
      exchangeId,
      updatedAt: new Date().toISOString(),
      tokens,
    };
  }

  if (exchangeId === "lighter") {
    const tokens = await getLighterDelistedTokens();
    return {
      exchangeId,
      updatedAt: new Date().toISOString(),
      tokens,
    };
  }

  return {
    exchangeId,
    updatedAt: new Date().toISOString(),
    tokens: ["DEMO", "TEST"],
  };
}

module.exports = {
  getSupportedExchanges,
  getDelistedTokensByExchange,
};
