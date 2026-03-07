import { pool } from "../utils/db";
import { redisClient } from "../utils/redis";
import { WalletRepository } from "../repositories/wallet.repo";
import { withRetry } from "../utils/retry";
import { TxType } from "../domain/types/TxTypes";
import { ConflictError } from "../domain/errors/ConflictError";
import { ErrorCode } from "../domain/errors/ErrorCode";
import { ValidationError } from "../domain/errors/ValidationError";
const walletRepo = new WalletRepository();


export class WalletService {
    async createWallet(user_id: number) {
        let client;
        try {
            client = await withRetry(() => pool.connect());
            const response = await walletRepo.create(client, user_id);
            return response;
        } finally {
            if (client) client.release();
        }
    }

    async executeTx(
        walletId: number,
        amount: number,
        idempotencyKey: string,
        type: TxType
    ) {
        
        const cached = await this.getCachedResponse(idempotencyKey);
        if (cached) return cached;

        const client = await withRetry(() => pool.connect());

        try {
            await client.query("BEGIN");
            const wallet = await walletRepo.findById(client, walletId);

            if (!wallet) {
                throw new ValidationError(
                    ErrorCode.INVALID_WALLET_ID,
                    "Wallet not found"
                );
            }

            const currentBalance = BigInt(wallet.balance);
            const txAmount = BigInt(amount);

            if (type === TxType.DEBIT && currentBalance < txAmount) {
                throw new ValidationError(
                    ErrorCode.INSUFFICIENT_FUNDS,
                    "Balance too low"
                );
            }

            const newBalance =
                type === TxType.CREDIT
                    ? currentBalance + txAmount
                    : currentBalance - txAmount;

            const updated = await walletRepo.updateWallet(
                client,
                newBalance,
                walletId,
                wallet.version
            );

            if (updated.rowCount === 0) {
                throw new ConflictError(
                    ErrorCode.VERSION_CONFLICT,
                    "Wallet update conflict"
                );
            }

            await walletRepo.updateTransaction(client, {
                walletId,
                amount: txAmount,
                type,
                idempotencyKey,
                balanceBefore: currentBalance,
                balanceAfter: newBalance
            });

            await client.query("COMMIT");

            const response = { balance: newBalance.toString() };

            await this.cacheResponse(idempotencyKey, response);

            return response;

        } catch (err) {
            await client.query("ROLLBACK");
            throw err;
        } finally {
            client.release();
        }
    }
    private async getCachedResponse(key: string) {
        try {
            const cached = await redisClient.get(key);
            return cached ? JSON.parse(cached) : null;
        } catch (err) {
            console.warn("Redis unavailable, proceeding without cache");
            return null;
        }
    }
    private async cacheResponse(key: string, response: any) {
        try {
            await redisClient.set(key, JSON.stringify(response), { EX: 600 });
        } catch (err) {
            console.warn("Redis unavailable, skipping cache");
        }
    }
}


