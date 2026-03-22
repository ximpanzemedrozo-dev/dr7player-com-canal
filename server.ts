import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from 'url';
import app from "./src/api";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  const PORT = 3000;

  // Determine the correct static path (dist for production, public for dev)
  const isProd = process.env.NODE_ENV === "production";
  const staticPath = isProd 
    ? path.join(process.cwd(), "dist") 
    : path.join(process.cwd(), "public");

  console.log(`Serving static files from: ${staticPath}`);

  // PWA ROUTES - Serve from the determined static path
  app.get("/manifest.json", (req, res) => {
    res.setHeader('Content-Type', 'application/manifest+json');
    res.sendFile(path.join(staticPath, "manifest.json"));
  });

  app.get("/sw.js", (req, res) => {
    res.setHeader('Content-Type', 'application/javascript');
    res.sendFile(path.join(staticPath, "sw.js"));
  });

  app.get("/pwa-test", (req, res) => {
    res.send(`SERVER IS ALIVE! Mode: ${process.env.NODE_ENV}. Path: ${staticPath}`);
  });

  app.use(express.static(staticPath));

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
