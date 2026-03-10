const http = require("http");
const https = require("https");

const PORT = process.env.PORT || 3131;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Accept",
};

http.createServer((req, res) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, CORS);
    return res.end();
  }

  // Health check
  if (req.method === "GET" && req.url === "/health") {
    res.writeHead(200, { ...CORS, "Content-Type": "application/json" });
    return res.end(JSON.stringify({ ok: true }));
  }

  // Proxy POST /api/v2 → Printavo
  if (req.method === "POST" && req.url === "/api/v2") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      const options = {
        hostname: "www.printavo.com",
        path: "/api/v2",
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          "email": req.headers["x-printavo-email"] || "",
          "token": req.headers["x-printavo-token"] || "",
        },
      };

      const proxy = https.request(options, (pres) => {
        let data = "";
        pres.on("data", chunk => data += chunk);
        pres.on("end", () => {
          res.writeHead(pres.statusCode, { ...CORS, "Content-Type": "application/json" });
          res.end(data);
        });
      });

      proxy.on("error", err => {
        res.writeHead(502, CORS);
        res.end(JSON.stringify({ error: err.message }));
      });

      proxy.write(body);
      proxy.end();
    });
    return;
  }

  res.writeHead(404, CORS);
  res.end(JSON.stringify({ error: "Not found" }));

}).listen(PORT, () => {
  console.log(`Proxy running on port ${PORT}`);
});
