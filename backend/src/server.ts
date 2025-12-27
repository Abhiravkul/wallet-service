import dotenv from "dotenv";
dotenv.config();

import express, { Request, Response } from "express";
import { connectToDatabase } from "./db";



const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 3000;

app.get("/health", (req: Request, res: Response) => {
    res.status(200).send("OK");
});

async function startServer() {
    await connectToDatabase();
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`);
    });
}

startServer();
