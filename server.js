const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");
const crypto = require("crypto");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// مفاتيح API من متغيرات البيئة في Railway
const API_KEY = process.env.BINANCE_API_KEY;
const API_SECRET = process.env.BINANCE_API_SECRET;

// دالة لإنشاء التوقيع
function createSignature(queryString, secret) {
  return crypto.createHmac("sha256", secret).update(queryString).digest("hex");
}

// الصفحة الرئيسية
app.get("/", (req, res) => {
  res.json({
    status: "Running",
    message: "Use /binance/* as a general proxy for Binance Futures API",
    apiKeyLoaded: !!API_KEY,
  });
});

// بروكسي عام لأي طلب Binance Futures
app.all("/binance/*", async (req, res) => {
  try {
    if (!API_KEY || !API_SECRET) {
      return res.status(400).json({ error: "API Key or Secret not configured" });
    }

    // نأخذ endpoint من الرابط
    const endpoint = req.path.replace("/binance", "");

    // أي params جايه من العميل (GET query أو POST body)
    const params = req.method === "GET" ? req.query : req.body.params || {};

    // نضيف timestamp لكل طلب موقّع
    const timestamp = Date.now();
    const allParams = { ...params, timestamp };

    // نحول الـ params لسلسلة query
    const queryString = Object.keys(allParams)
      .map((key) => `${key}=${encodeURIComponent(allParams[key])}`)
      .join("&");

    // نعمل التوقيع
    const signature = createSignature(queryString, API_SECRET);

    // رابط API الكامل
    const url = `https://fapi.binance.com${endpoint}?${queryString}&signature=${signature}`;

    // أي headers إضافية
    const headers = {
      "X-MBX-APIKEY": API_KEY,
      "Content-Type": "application/json",
      ...req.headers, // يسمح بتمرير أي headers إضافية من العميل
    };

    // نحدد طريقة الطلب GET أو POST
    const options = {
      method: req.method,
      headers,
    };

    // لو POST مع body
    if (req.method === "POST") {
      options.body = JSON.stringify(req.body.data || {});
    }

    const response = await fetch(url, options);
    const data = await response.json();

    res.json(data);
  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Binance Futures Proxy running on port ${PORT}`);
  console.log(`API Key loaded: ${!!API_KEY}`);
});
