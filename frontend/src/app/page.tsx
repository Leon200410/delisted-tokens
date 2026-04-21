"use client";

import { useMemo, useState } from "react";

type Exchange = {
  id: string;
  name: string;
  icon: string;
};

type DelistedResponse = {
  exchangeId: string;
  updatedAt: string;
  tokens: string[];
};

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000/api";

const fallbackExchanges: Exchange[] = [
  { id: "gate", name: "Gate", icon: "🟢" },
  { id: "hyperliquid", name: "Hyperliquid", icon: "⚡" },
  { id: "kraken", name: "Kraken", icon: "🐙" },
  { id: "kucoin", name: "KuCoin", icon: "🟩" },
  { id: "lighter", name: "Lighter", icon: "🟡" },
  { id: "whitebit", name: "WhiteBIT", icon: "⚪" },
];

export default function Home() {
  const [exchanges] = useState<Exchange[]>(fallbackExchanges);
  const [selectedExchangeId, setSelectedExchangeId] = useState<string>(
    fallbackExchanges[0].id
  );
  const [tokens, setTokens] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("请选择交易所后点击按钮获取数据");
  const [updatedAt, setUpdatedAt] = useState("");

  const selectedExchange = useMemo(
    () => exchanges.find((item) => item.id === selectedExchangeId),
    [exchanges, selectedExchangeId]
  );

  const handleFetchTokens = async () => {
    setLoading(true);
    setMessage("正在获取下架币种...");

    try {
      const response = await fetch(
        `${API_BASE_URL}/delisted/${selectedExchangeId}`,
        {
          method: "GET",
        }
      );
      const json = await response.json();

      if (!response.ok || !json.success) {
        throw new Error(json.message || "获取失败");
      }

      const data = json.data as DelistedResponse;
      setTokens(Array.isArray(data.tokens) ? data.tokens : []);
      setUpdatedAt(data.updatedAt || "");
      setMessage("获取成功");
    } catch (error) {
      setTokens([]);
      setUpdatedAt("");
      setMessage(error instanceof Error ? error.message : "请求异常");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-full bg-slate-50 p-6 text-slate-900">
      <main className="mx-auto max-w-3xl rounded-xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold">交易所下架币种查询</h1>
        <p className="mt-2 text-sm text-slate-600">
          选择交易所后，点击按钮一键获取最新下架币种
        </p>

        <section className="mt-6">
          <h2 className="text-sm font-semibold text-slate-700">交易所</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {exchanges.map((exchange) => {
              const active = exchange.id === selectedExchangeId;
              return (
                <button
                  key={exchange.id}
                  type="button"
                  onClick={() => setSelectedExchangeId(exchange.id)}
                  className={`rounded-lg border p-3 text-left transition ${
                    active
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-200 bg-white hover:border-blue-300"
                  }`}
                >
                  <div className="text-2xl">{exchange.icon}</div>
                  <div className="mt-2 text-sm font-medium">{exchange.name}</div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-6">
          <button
            type="button"
            onClick={handleFetchTokens}
            disabled={loading}
            className="rounded-lg bg-blue-600 px-4 py-2 text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {loading ? "获取中..." : "一键获取下架币种"}
          </button>
          <p className="mt-2 text-sm text-slate-600">
            当前选择: {selectedExchange?.name || selectedExchangeId}
          </p>
          <p className="mt-1 text-sm text-slate-600">{message}</p>
          {updatedAt ? (
            <p className="mt-1 text-xs text-slate-500">更新时间: {updatedAt}</p>
          ) : null}
          {["gate", "kucoin"].includes(selectedExchangeId) ? (
            <p className="mt-1 text-xs text-amber-700">
              提示：当前获得的是官方公告第一页数据。
            </p>
          ) : null}
        </section>

        <section className="mt-6">
          <h2 className="text-sm font-semibold text-slate-700">下架币种列表</h2>
          {tokens.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">暂无数据</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {tokens.map((token) => (
                <li
                  key={token}
                  className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm"
                >
                  {token}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}
