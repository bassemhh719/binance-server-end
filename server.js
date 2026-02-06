const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");
const crypto = require("crypto");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// مفاتيح باينانس من Railway
const API_KEY = process.env.BINANCE_API_KEY;
const API_SECRET = process.env.BINANCE_API_SECRET;

const BINANCE_BASE = "https://api.binance.com";

// ========================
// أدوات
// ========================

function createSignature(queryString, secret) {
  return crypto
    .createHmac("sha256", secret)
    .update(queryString)
    .digest("hex");
}

function buildQuery(params) {
  return Object.keys(params)
    .map(k => `${k}=${encodeURIComponent(params[k])}`)
    .join("&");
}

// ========================
// الصفحة الرئيسية
// ========================

app.get("/", (req, res) => {
  res.json({
    status: "Running",
    proxy: "/binance/*",
    apiKeyLoaded: !!API_KEY
  });
});

// ========================
// بروكسي عام + موقّع ذكي
// ========================

app.all("/binance/*", async (req, res) => {
  try {

    const path = req.params[0]; 
    const isSigned = req.headers["x-binance-signed"] === "true";

    let params = { ...req.query };

    let headers = {
      "Content-Type": "application/json"
    };

    // تمرير أي headers إضافية
    Object.keys(req.headers).forEach(h => {
      if (!["host", "content-length"].includes(h)) {
        headers[h] = req.headers[h];
      }
    });

    // لو الطلب محتاج توقيع
    if (isSigned) {

      if (!API_KEY || !API_SECRET) {
        return res.status(400).json({ error: "API keys not configured" });
      }

      params.timestamp = Date.now();

      const queryString = buildQuery(params);
      const signature = createSignature(queryString, API_SECRET);

      params.signature = signature;

      headers["X-MBX-APIKEY"] = API_KEY;
    }

    const finalQuery = buildQuery(params);
    const url = `${BINANCE_BASE}/${path}${finalQuery ? "?" + finalQuery : ""}`;

    console.log("➡️ Binance request:", url);

    const response = await fetch(url, {
      method: req.method,
      headers,
      body: ["GET", "HEAD"].includes(req.method)
        ? undefined
        : JSON.stringify(req.body)
    });

    const text = await response.text();

    res.status(response.status).send(text);

  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ========================

app.listen(PORT, "0.0.0.0", () => {
  console.log("Proxy running on", PORT);
  console.log("API loaded:", !!API_KEY);
});
