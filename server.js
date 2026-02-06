const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");
const crypto = require("crypto");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// متغيرات البيئة من Railway
const API_KEY = process.env.BINANCE_API_KEY;
const API_SECRET = process.env.BINANCE_API_SECRET;

// الصفحة الرئيسية
app.get("/", (req, res) => {
  res.json({ 
    status: "Server is running", 
    message: "Use /proxy?url=YOUR_URL for public APIs or /account for signed requests",
    port: PORT,
    hasApiKey: !!API_KEY
  });
});

// بروكسي عادي (بدون توقيع)
app.get("/proxy", async (req, res) => {
  try {
    const url = req.query.url;

    if (!url) {
      return res.status(400).json({ error: "Missing url parameter" });
    }

    console.log("Fetching URL:", url);
    const response = await fetch(url);
    const data = await response.text();

    res.send(data);

  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).json({ error: err.message });
  }
});

// دالة لإنشاء التوقيع
function createSignature(queryString, secret) {
  return crypto
    .createHmac("sha256", secret)
    .update(queryString)
    .digest("hex");
}

// نقطة نهاية للحصول على معلومات الحساب
app.get("/account", async (req, res) => {
  try {
    if (!API_KEY || !API_SECRET) {
      return res.status(400).json({ 
        error: "API Key or Secret not configured",
        message: "Please set BINANCE_API_KEY and BINANCE_API_SECRET in Railway Variables"
      });
    }

    const timestamp = Date.now();
    const queryString = `timestamp=${timestamp}`;
    const signature = createSignature(queryString, API_SECRET);

    const url = `https://api.binance.com/api/v3/account?${queryString}&signature=${signature}`;

    console.log("Fetching account info...");
    
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-MBX-APIKEY": API_KEY
      }
    });

    const data = await response.json();

    if (data.code) {
      return res.status(400).json(data);
    }

    res.json(data);

  } catch (err) {
    console.error("Account error:", err);
    res.status(500).json({ error: err.message });
  }
});

// نقطة نهاية للحصول على الرصيد
app.get("/balance", async (req, res) => {
  try {
    if (!API_KEY || !API_SECRET) {
      return res.status(400).json({ 
        error: "API Key or Secret not configured"
      });
    }

    const timestamp = Date.now();
    const queryString = `timestamp=${timestamp}`;
    const signature = createSignature(queryString, API_SECRET);

    const url = `https://api.binance.com/api/v3/account?${queryString}&signature=${signature}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-MBX-APIKEY": API_KEY
      }
    });

    const data = await response.json();

    if (data.code) {
      return res.status(400).json(data);
    }

    // فلترة الأرصدة التي أكبر من 0
    const balances = data.balances
      .filter(b => parseFloat(b.free) > 0 || parseFloat(b.locked) > 0)
      .map(b => ({
        asset: b.asset,
        free: b.free,
        locked: b.locked,
        total: (parseFloat(b.free) + parseFloat(b.locked)).toString()
      }));

    res.json({ balances });

  } catch (err) {
    console.error("Balance error:", err);
    res.status(500).json({ error: err.message });
  }
});

// نقطة نهاية مخصصة موقعة
app.post("/signed", async (req, res) => {
  try {
    if (!API_KEY || !API_SECRET) {
      return res.status(400).json({ error: "API Key or Secret not configured" });
    }

    const { endpoint, params = {} } = req.body;

    if (!endpoint) {
      return res.status(400).json({ error: "Missing endpoint parameter" });
    }

    const timestamp = Date.now();
    const allParams = { ...params, timestamp };
    
    const queryString = Object.keys(allParams)
      .map(key => `${key}=${allParams[key]}`)
      .join("&");
    
    const signature = createSignature(queryString, API_SECRET);
    const url = `https://api.binance.com${endpoint}?${queryString}&signature=${signature}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "X-MBX-APIKEY": API_KEY
      }
    });

    const data = await response.json();
    res.json(data);

  } catch (err) {
    console.error("Signed request error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Proxy server running on port ${PORT}`);
  console.log(`API Key configured: ${!!API_KEY}`);
});
