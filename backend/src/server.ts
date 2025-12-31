import dotenv from "dotenv";
dotenv.config();

import express, { Request, Response } from "express";
import { pool } from "./db";
import { withRetry } from "./utils/retry";

const app = express();
app.use(express.json());
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;
type CreateWalletRequest = {
    user_id: number;
};

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
        client = await withRetry(()=>pool.connect());

        const result = await client.query(
            "INSERT INTO wallet (user_id) VALUES ($1) RETURNING id",
            [user_id]
        );

        return res.status(201).json({
            wallet_id: result.rows[0].id,
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

    if (!Number.isInteger(walletId) || walletId <= 0) {
        return res.status(400).json({ error: "Invalid wallet id" });
    }


    if (typeof amount !== "number" || amount <= 0) {
        return res.status(400).json({ error: "amount must be a positive number" });
    }

    let client;

    try {
        client = await withRetry(()=>pool.connect());
        await client.query("BEGIN");

        const walletResult = await client.query(
            "SELECT balance, version FROM wallet WHERE id = $1",
            [walletId]
        );

        if (walletResult.rows.length === 0) {
            await client.query("ROLLBACK");
            return res.status(404).json({ error: "Wallet not found" });
        }

        const currentBalance = walletResult.rows[0].balance;
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
            "INSERT INTO transactions (wallet_id, amount, type, status) VALUES ($1, $2, $3, $4)",
            [walletId, amount, "CREDIT", "SUCCESS"]
        );

        await client.query("COMMIT");

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
    if (!Number.isInteger(walletId) || walletId <= 0) {
        return res.status(400).json({ error: "Invalid wallet id" });
    }

    if (typeof amount !== "number" || amount <= 0) {
        return res.status(400).json({ error: "amount must be a positive number" });
    }

    let client;
    try {
        client = await withRetry(()=>pool.connect());
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

        const currentBalance = walletResult.rows[0].balance;
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
            "INSERT INTO transactions (wallet_id, amount, type, status) VALUES ($1, $2, $3, $4)",
            [walletId, amount, "DEBIT", "SUCCESS"]
        );

        await client.query("COMMIT");

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
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

startServer();
