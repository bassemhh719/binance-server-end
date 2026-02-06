const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();
app.use(cors());

const PORT = process.env.PORT || 3000;

// نقطة نهاية للتحقق من أن السيرفر يعمل
app.get("/", (req, res) => {
  res.json({ status: "Server is running", message: "Use /proxy?url=YOUR_URL" });
});

// بروكسي لباينانس أو أي API آخر
app.get("/proxy", async (req, res) => {
  try {
    const url = req.query.url;

    if (!url) {
      return res.status(400).json({ error: "Missing url parameter" });
    }

    const response = await fetch(url);
    const data = await response.text();

    res.send(data);

  } catch (err) {
    console.error("Proxy error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Proxy server running on port ${PORT}`);
});
