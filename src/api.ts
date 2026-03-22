import express from "express";
import path from "path";
import http from "http";
import https from "https";

const app = express();
app.use(express.json());

// API Routes
app.get("/api/health", (req, res) => res.json({ status: "ok" }));

// Proxy to fetch M3U to avoid CORS and Mixed Content issues
app.get("/api/proxy-m3u", async (req, res) => {
  const { url } = req.query;
  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: "URL is required" });
  }

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return res.status(response.status).json({ error: `Server returned ${response.status}` });
    }
    const data = await response.text();
    res.send(data);
  } catch (error) {
    console.error("Proxy error:", error);
    res.status(500).json({ error: "Failed to fetch M3U from server" });
  }
});

// Stream Proxy with Redirect Handling
app.get("/api/proxy-stream", async (req, res) => {
  const { url } = req.query;
  if (!url || typeof url !== 'string') return res.status(400).send("URL required");

  const followRedirect = (targetUrl: string, depth = 0) => {
    if (depth > 5) return res.status(500).send("Too many redirects");

    const protocol = targetUrl.startsWith("https") ? https : http;
    
    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': '*/*',
        'Connection': 'keep-alive'
      }
    };

    protocol.get(targetUrl, options, (streamResponse) => {
      if (streamResponse.statusCode && [301, 302, 307, 308].includes(streamResponse.statusCode)) {
        const location = streamResponse.headers.location;
        if (location) {
          const nextUrl = location.startsWith('http') ? location : new URL(location, targetUrl).toString();
          return followRedirect(nextUrl, depth + 1);
        }
      }

      // Forward headers
      res.setHeader('Content-Type', streamResponse.headers['content-type'] || 'video/mp2t');
      if (streamResponse.headers['content-length']) {
        res.setHeader('Content-Length', streamResponse.headers['content-length']);
      }
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', '*');
      
      streamResponse.pipe(res);
    }).on('error', (err) => {
      console.error("Stream proxy error:", err);
      if (!res.headersSent) res.status(500).send("Stream error");
    });
  };

  followRedirect(url);
});

// Device Activation Mock
app.get("/api/device-info", (req, res) => {
  res.json({ 
    mac: "00:1A:2B:3C:4D:5E", 
    status: "Ativo",
    expiry: "2027-01-01"
  });
});

export default app;
