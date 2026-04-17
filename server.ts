import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from 'url';
import axios from "axios";
import https from "https";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const app = express();
  const PORT = 3000;

  const httpsAgent = new https.Agent({ rejectUnauthorized: false });

  // Proxy for M3U and API
  app.get("/api/proxy-m3u", async (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl) return res.status(400).json({ error: "URL ausente" });

    // Set CORS headers for SS IPTV compatibility
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    try {
      const response = await axios.get(targetUrl, {
        timeout: 30000,
        responseType: 'text',
        headers: { 
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          'Accept': '*/*' 
        },
        httpsAgent
      });
      
      // If the content is M3U, we might want to ensure it's served as text/plain or application/mpegurl
      res.setHeader('Content-Type', 'text/plain; charset=utf-8');
      res.send(response.data);
    } catch (error: any) {
      console.error("Proxy error:", error.message);
      res.status(502).json({ error: "Erro no proxy", details: error.message });
    }
  });

  // Proxy for Streams (to bypass mixed content/CORS)
  app.get("/api/proxy-stream", (req, res) => {
    const targetUrl = req.query.url as string;
    if (!targetUrl) return res.status(400).send("URL ausente");

    // Set CORS for browsers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

    const protocol = targetUrl.startsWith("https") ? https : https;
    // For simplicity in dev, we can just redirect or pipe. 
    // But usually, a simple redirect works if the client can handle it, 
    // or we pipe the stream.
    
    axios({
      method: 'get',
      url: targetUrl,
      responseType: 'stream',
      httpsAgent
    }).then(response => {
      response.data.pipe(res);
    }).catch(err => {
      res.status(500).send(err.message);
    });
  });

  // Determine the correct static path (dist for production, public for dev)
  const isProd = process.env.NODE_ENV === "production";
  const staticPath = isProd 
    ? path.join(process.cwd(), "dist") 
    : path.join(process.cwd(), "public");

  console.log(`Serving static files from: ${staticPath}`);

  // Vite middleware for development
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    
    // Fallback for SPA in dev mode
    app.get('*', async (req, res, next) => {
      // If the request looks like an asset (has an extension), return 404 with plain text
      if (req.path.includes('.') && !req.path.endsWith('.html')) {
        return res.status(404).type('text/plain').send('Not found');
      }
      const url = req.originalUrl;
      try {
        let template = await (await import('fs')).readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    // In production, serve static files from dist
    app.use(express.static(staticPath, {
      maxAge: '1d',
      immutable: true,
      index: false // Don't serve index.html automatically here
    }));

  // Fallback for SPA: serve index.html only for non-asset requests
  app.get('*', (req, res) => {
    // If the request looks like an asset (has an extension), return 404 with plain text
    if (req.path.includes('.') && !req.path.endsWith('.html')) {
      return res.status(404).type('text/plain').send('Not found');
    }
    res.sendFile(path.join(staticPath, 'index.html'));
  });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
