import dotenv from "dotenv";
dotenv.config();

import express, { Request, Response } from "express";
import { pool } from "./utils/db";
import { withRetry } from "./utils/retry";
import { connectRedis, redisClient } from "./utils/redis";
import router from './routes/wallet.routes';
import cors from "cors";
import { errorHandler } from "./middleware/errorHandler";
import { requestIdMiddleware } from "./middleware/requestId";
import { logger } from "./utils/logger";

const app = express();
app.use(express.json());
app.use( cors({ origin: "http://localhost:5173", }) );
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const REQUEST_TIMEOUT_MS = 5000;

app.use(requestIdMiddleware);

app.use((req, res, next) => {
    res.setTimeout(REQUEST_TIMEOUT_MS, () => {
        if (!res.headersSent) {
            res.status(503).json({ error: "Request timed out" });
        }
    });
    next();
});

app.get("/health", (req: Request, res: Response) => {
    res.status(200).send("OK");
});


app.use("/", router);

async function startServer() {
    try {
        logger.info("Connecting to Redis...");
        await connectRedis();
        logger.info("Redis connected. Starting Express...");
        app.listen(PORT, "0.0.0.0", () => {
            logger.info(`Server running on port ${PORT}`);
        });
    } catch (err:any) {
        logger.error("Failed to start server:", err);
    }
}
startServer();
app.use(errorHandler);
