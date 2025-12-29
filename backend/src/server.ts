import dotenv from "dotenv";
dotenv.config();

import express, { Request, Response } from "express";
import { pool } from "./db";

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
        client = await pool.connect();

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
async function startServer() {
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

startServer();
