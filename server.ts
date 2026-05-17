import express from "express";
import { createServer as createViteServer } from "vite";
import cors from "cors";
import path from "path";
import apiRouter from "./server/routes";
import http from "http";
import { setupFeedSocketAndCron } from "./server/feed";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  const httpServer = http.createServer(app);
  
  // Setup Socket.IO and Cron
  const io = setupFeedSocketAndCron(httpServer);
  app.set("io", io);

  // API Routes
  app.use("/api", apiRouter);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production: serve static files. Assuming "type": "module" in project limits __dirname usage directly.
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
