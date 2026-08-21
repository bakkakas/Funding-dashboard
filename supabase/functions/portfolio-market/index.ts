const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
});

function numberFrom(value: unknown) {
  const parsed = Number(String(value ?? "").replace(/,/g, "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

async function naver(path: string) {
  const response = await fetch(path, {
    headers: {
      "Accept": "application/json",
      "User-Agent": "Mozilla/5.0 (compatible; FundingDashboard/1.0)",
    },
  });
  if (!response.ok) throw new Error(`market provider returned ${response.status}`);
  return response.json();
}

async function searchStocks(query: string) {
  const data = await naver(`https://ac.stock.naver.com/ac?q=${encodeURIComponent(query)}&target=stock`);
  return (Array.isArray(data?.items) ? data.items : [])
    .filter((item: Record<string, unknown>) => item.category === "stock")
    .slice(0, 10)
    .map((item: Record<string, unknown>) => ({
      symbol: String(item.code || ""),
      name: String(item.name || item.code || ""),
      asset_class: "stock",
      quote_symbol: `NAVER:${String(item.reutersCode || item.code || "")}`,
      currency: item.nationCode === "KOR" ? "KRW" : "USD",
      market: String(item.typeName || item.typeCode || ""),
    }));
}

async function quoteStock(quoteSymbol: string, currency: string) {
  const code = quoteSymbol.replace(/^NAVER:/, "");
  if (!code) throw new Error("missing quote symbol");

  if (currency === "KRW") {
    const data = await naver(`https://polling.finance.naver.com/api/realtime/domestic/stock/${encodeURIComponent(code)}`);
    const row = data?.datas?.[0];
    const price = numberFrom(row?.closePrice);
    if (!price) throw new Error("price unavailable");
    return { price, currency: "KRW", as_of: row?.localTradedAt || new Date().toISOString() };
  }

  const data = await naver(`https://api.stock.naver.com/stock/${encodeURIComponent(code)}/basic`);
  const price = numberFrom(data?.closePrice);
  if (!price) throw new Error("price unavailable");
  return { price, currency: "USD", as_of: data?.localTradedAt || new Date().toISOString() };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => ({}));
    if (body.action === "search") {
      const query = String(body.query || "").trim().slice(0, 80);
      if (query.length < 1) return json({ results: [] });
      return json({ results: await searchStocks(query) });
    }

    if (body.action === "quote") {
      return json(await quoteStock(String(body.quote_symbol || ""), String(body.currency || "USD")));
    }

    return json({ error: "unsupported action" }, 400);
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "market data failed" }, 502);
  }
});
