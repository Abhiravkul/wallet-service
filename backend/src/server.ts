import dotenv from "dotenv";
dotenv.config();

import express, { Request, Response } from "express";
import { pool } from "./db";
import { withRetry } from "./utils/retry";
import { connectRedis, redisClient } from "./redis";
import cors from "cors";

const app = express();
app.use(express.json());
app.use( cors({ origin: "http://localhost:5173", }) );
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
const REQUEST_TIMEOUT_MS = 5000;

type CreateWalletRequest = {
    user_id: number;
};

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

app.post("/wallets", async (req: Request, res: Response) => {
    const body = req.body as CreateWalletRequest;
    const { user_id } = body;
    if (typeof user_id !== "number") {
        return res.status(400).json({ error: "user_id must be a number" });
    }
    let client;

    try {
        client = await withRetry(() => pool.connect());

        const result = await client.query(
            "INSERT INTO wallet (user_id) VALUES ($1) RETURNING id, balance",
            [user_id]
        );
        
        return res.status(201).json({
            wallet_id: result.rows[0].id,
            balance: result.rows[0].balance,
        });
    } catch (err) {
        console.error("Error creating wallet", err);
        return res.status(500).json({ error: "Failed to create wallet" });
    } finally {
        if (client) client.release();
    }
});
type AmountRequest = {
    amount: number;
};

app.post("/wallets/:id/credit", async (req: Request, res: Response) => {
    const walletId = Number(req.params.id);
    const body = req.body as AmountRequest;
    const { amount } = body;
    const idempotencyKey = req.header("idempotency-key");

    if (!Number.isInteger(walletId) || walletId <= 0) {
        return res.status(400).json({ error: "Invalid wallet id" });
    }


    if (typeof amount !== "number" || amount <= 0) {
        return res.status(400).json({ error: "amount must be a positive number" });
    }

    if (!idempotencyKey) {
        return res.status(400).json({ error: "Missing Idempotency-Key header" });
    }

    let cachedResponse: string | null = null;

    try {
        cachedResponse = await redisClient.get(idempotencyKey);
    } catch (err) {
        console.warn("Redis unavailable, proceeding without cache");
    }

    if (cachedResponse) {
        return res.status(200).json(JSON.parse(cachedResponse));
    }

    let client;

    try {
        client = await withRetry(() => pool.connect());
        await client.query("BEGIN");

        const walletResult = await client.query(
            "SELECT balance, version FROM wallet WHERE id = $1",
            [walletId]
        );

        if (walletResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Wallet not found" });
        }

        const currentBalance = Number(walletResult.rows[0].balance);
        const newBalance = currentBalance + amount;
        const currentVersion = walletResult.rows[0].version;

        const updatedResult = await client.query(
            "UPDATE wallet SET balance = $1, version = version + 1 WHERE id = $2 AND version = $3",
            [newBalance, walletId, currentVersion]
        );

        if (updatedResult.rowCount === 0) {
            await client.query("ROLLBACK");
            return res.status(409).json({ error: "Wallet update conflict" });
        }

        await client.query(
            "INSERT INTO transactions (wallet_id, amount, type, status, idempotency_key) VALUES ($1, $2, $3, $4, $5)",
            [walletId, amount, "CREDIT", "SUCCESS", idempotencyKey]
        );
        await client.query("COMMIT");
        try {
            await redisClient.set(
                idempotencyKey,
                JSON.stringify({ balance: newBalance }),
                { EX: 600 }
            );
        } catch (err) {
            console.warn("Failed to cache idempotency response");
        }

        return res.status(200).json({ balance: newBalance });
    } catch (err) {
        if (client) await client.query("ROLLBACK");
        console.error("Error updating balance", err);
        return res.status(500).json({ error: "Failed to update wallet" });
    } finally {
        if (client) client.release();
    }
});

app.post("/wallets/:id/debit", async (req: Request, res: Response) => {
    const walletId = Number(req.params.id);
    const body = req.body as AmountRequest;
    const { amount } = body;
    const idempotencyKey = req.header("idempotency-key");


    if (!Number.isInteger(walletId) || walletId <= 0) {
        return res.status(400).json({ error: "Invalid wallet id" });
    }

    if (typeof amount !== "number" || amount <= 0) {
        return res.status(400).json({ error: "amount must be a positive number" });
    }
    if (!idempotencyKey) {
        return res.status(400).json({ error: "Missing Idempotency-Key header" });
    }
    let cachedResponse: string | null = null;

    try {
        cachedResponse = await redisClient.get(idempotencyKey);
    } catch (error) {
        console.warn("Redis unavailable, proceeding without cache");
    }

    if (cachedResponse) {
        return res.status(200).json(JSON.parse(cachedResponse));
    }
    let client;
    try {
        client = await withRetry(() => pool.connect());
        await client.query("BEGIN");

        const walletResult = await client.query(
            "SELECT balance, version FROM wallet WHERE id = $1",
            [walletId]
        );

        if (walletResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Wallet not found" });
        }

        if (walletResult.rows[0].balance < amount) {
            return res.status(400).json({ error: "Insufficient balance" });
        }

        const currentBalance = Number(walletResult.rows[0].balance);
        const newBalance = currentBalance - amount;
        const currentVersion = walletResult.rows[0].version;

        const updatedResult = await client.query(
            "UPDATE wallet SET balance = $1, version = version + 1 WHERE id = $2 AND version = $3",
            [newBalance, walletId, currentVersion]
        );

        if (updatedResult.rowCount === 0) {
            await client.query("ROLLBACK");
            return res.status(409).json({ error: "Wallet update conflict" });
        }

        await client.query(
            "INSERT INTO transactions (wallet_id, amount, type, status, idempotency_key) VALUES ($1, $2, $3, $4, $5)",
            [walletId, amount, "DEBIT", "SUCCESS", idempotencyKey]
        );

        await client.query("COMMIT");
        try {
            await redisClient.set(idempotencyKey, JSON.stringify({ balance: newBalance }), { EX: 600 });
        } catch (error) {
            console.warn("Failed to cache idempotency response");
        }
        return res.status(200).json({ balance: newBalance });

    } catch (error) {
        if (client) await client.query("ROLLBACK");
        console.error("Error updating balance", error);
        return res.status(500).json({ error: "Failed to update wallet" });
    } finally {
        if (client) client.release();
    }
});
async function startServer() {
    await connectRedis();
    app.listen(PORT, () => {


        console.log(`Server running on port ${PORT}`);
    });
}

startServer();
