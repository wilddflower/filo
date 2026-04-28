import "dotenv/config";
import express, { type Request, type Response, type NextFunction } from "express";
import cors from "cors";
import leadsRouter from "./routes/leads";
import scoringRouter from "./routes/scoring";
import replyRouter from "./routes/reply";
import keywordsRouter from "./routes/keywords";
import { startBackgroundScraper, hasAuth } from "./lib/xScraper";

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors({ origin: "http://localhost:3000" }));
app.use(express.json());

app.use("/api/leads", leadsRouter);
app.use("/api/scoring", scoringRouter);
app.use("/api/reply", replyRouter);
app.use("/api/keywords", keywordsRouter);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Global error handler — catches anything that slips past route try/catch
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error("[Express error]", err.message);
  if (!res.headersSent) {
    res.status(500).json({ error: "Internal server error" });
  }
});

const server = app.listen(PORT, () => {
  console.log(`Filo API running on http://localhost:${PORT}`);

  if (hasAuth()) {
    startBackgroundScraper();
  }
});

// Graceful shutdown so tsx watch can free the port before restarting
process.on("SIGTERM", () => server.close(() => process.exit(0)));
process.on("SIGINT",  () => server.close(() => process.exit(0)));
