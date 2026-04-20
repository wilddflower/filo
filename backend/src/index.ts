import express from "express";
import cors from "cors";
import leadsRouter from "./routes/leads";
import scoringRouter from "./routes/scoring";

const app = express();
const PORT = process.env.PORT ?? 3001;

app.use(cors({ origin: "http://localhost:3000" }));
app.use(express.json());

app.use("/api/leads", leadsRouter);
app.use("/api/scoring", scoringRouter);

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`RedRover API running on http://localhost:${PORT}`);
});
