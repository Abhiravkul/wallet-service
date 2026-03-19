import { Request, Response } from 'express';
import { WalletService } from '../services/wallet.services';
import { ValidationError } from '../domain/errors/ValidationError';
import { TxType } from "../domain/types/TxTypes"
import { ErrorCode } from '../domain/errors/ErrorCode';
import { logger } from '../utils/logger';

export class WalletController {

   constructor(private service: WalletService){}

    create = async (req: Request, res: Response) => {
            const { user_id } = req.body;
            if (typeof user_id !== "number") {
                throw new ValidationError(
                    ErrorCode.INVALID_USERID,
                    "user_id must be a number"
                );
            }
                    
            logger.info({ requestId: req.requestId, userId: user_id }, "Create wallet request");

            const wallet = await this.service.createWallet(user_id);

            logger.info({ requestId: req.requestId, walletId: wallet.wallet_id }, "Wallet created");

            res.status(201).json(wallet);
            return;
    }

    handleTransaction = (type: TxType) => async (req: Request, res: Response) => {
            const walletId = Number(req.params.id);
            const { amount, currency } = req.body;
            const idempotencyKey = req.header("idempotency-key");

            if (!Number.isInteger(walletId) || walletId <= 0) {
                throw new ValidationError(
                     ErrorCode.INVALID_WALLET_ID,
                    "Invalid wallet id"
                );
            }

            if (typeof amount !== "number" || amount <= 0) {
                throw new ValidationError(
                    ErrorCode.INVALID_AMOUNT,
                    "Amount must be a positive number"
                );
            }

            if (!idempotencyKey) {
                throw new ValidationError(
                  ErrorCode.MISSING_IDEMPOTENCY_KEY,
                    "Missing Idempotency-Key header"
                );
            }
            const result = await this.service.executeTx(walletId, amount, idempotencyKey, type, currency);

             res.status(200).json(result);
             return;

    }
}