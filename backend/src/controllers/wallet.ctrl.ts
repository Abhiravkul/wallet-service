import { Request, Response } from 'express';
import { WalletService, TxType } from '../services/wallet.services';


type CreateWalletRequest = {
    user_id: number,
}

type AmountRequest = {
    amount: bigint;
};


export class WalletController {
    private service = new WalletService();
    create = async (req: Request, res: Response) => {
        try {
            const body = req.body as CreateWalletRequest;
            const { user_id } = body;
            if (typeof user_id !== "number") {
                return res.status(400).json({ error: "user_id must be a number" });
            }
            const wallet = await this.service.createWallet(user_id);

            return res.status(201).json( wallet );
        } catch (err) {
            console.error("Error creating wallet", err);
            return res.status(500).json({ error: "Failed to create wallet" });
        }
    }

    handleTransaction = (type: TxType) => async (req: Request, res: Response) => {
        try {
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
            const result = await this.service.executeTx(walletId, amount, idempotencyKey, type);

            return res.status(200).json(result);
        } catch (err: unknown) {
            if (err instanceof Error) {
                const statusMap: any = {
                    "WALLET_NOT_FOUND": {"statusCode": 404, "message": "Wallet not found"},
                    "INSUFFICIENT_FUNDS": {"statusCode": 404, "message": "Insufficient balance"},
                    "CONCURRENCY_CONFLICT": {"statusCode": 409, "message": "Wallet update conflict"}
                };
                res.status(statusMap[err.message].statusCode || 500).json({ error: statusMap[err.message].message });
            }

        }

    }
}