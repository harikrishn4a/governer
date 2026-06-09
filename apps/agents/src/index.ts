import * as dotenv from "dotenv";
dotenv.config({ path: `${__dirname}/../.env` });

import express from "express";
import { runProcurement } from "./agents/procurement";
import { logger } from "./lib/logger";

const app = express();
app.use(express.json());

const PORT = parseInt(process.env.PORT ?? "4000", 10);

app.post("/run", async (req, res) => {
  const { intent } = req.body as { intent?: string };

  if (!intent || typeof intent !== "string" || intent.trim() === "") {
    return res.status(400).json({ error: "intent is required" });
  }

  try {
    logger.info("POST /run", { intent });
    const options = await runProcurement(intent.trim());
    return res.json({ options });
  } catch (err) {
    logger.error("POST /run failed", { error: String(err) });
    return res.status(500).json({ error: "Agent pipeline failed", detail: String(err) });
  }
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  logger.info(`agents worker listening on port ${PORT}`);
});
