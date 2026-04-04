import { pool } from "../utils/db";
import { redisClient } from "../utils/redis";
import { WalletRepository } from "../repositories/wallet.repo";
import { withRetry } from "../utils/retry";
import { TxType } from "../domain/types/TxTypes";
import { ConflictError } from "../domain/errors/ConflictError";
import { ErrorCode } from "../domain/errors/ErrorCode";
import { validateBalance, validateCurrency, validateDebitLimits, validateWalletExists, validateWalletStatus } from "../domain/rules/walletRules";
import { logger } from "../utils/logger";
import { PoolClient } from "pg";

type RedisClient = typeof redisClient;

export class WalletService {

    constructor(private walletRepo: WalletRepository,
        private redisClient: RedisClient) { }

    async createWallet(user_id: number) {
        let client;
        try {
            client = await withRetry(() => pool.connect());

            const response = await this.walletRepo.create(client, user_id);
            return response;
        } finally {
            if (client) client.release();
        }
    }

    async executeTx(
        walletId: number,
        amount: number,
        idempotencyKey: string,
        type: TxType,
        currency: string,
        providedClient?: PoolClient 
    ) {

        const cached = await this.getCachedResponse(idempotencyKey);
        if (cached) return cached;

        const client = providedClient || await withRetry(() => pool.connect());
        const isShared = Boolean(providedClient);
        try {
            if(!isShared) await client.query("BEGIN");

            logger.info({
                requestId: idempotencyKey,
                walletId,
                amount,
                type
            }, "Transaction started");

            const wallet = await this.walletRepo.findById(client, walletId);

            validateWalletExists(wallet);

            validateWalletStatus(wallet.status, type);

            validateCurrency(wallet.currency, currency);

            const currentBalance = BigInt(wallet.balance);
            const txAmount = BigInt(amount);
            let currentTotal = txAmount;

            if (type === TxType.DEBIT) {
                const currentDebitTotal = BigInt(await this.walletRepo.getDailyTransactionTotal(client, walletId, type));
                currentTotal += currentDebitTotal;
            }

            if (type === TxType.CREDIT) {
                const currentCreditTotal = BigInt(await this.walletRepo.getDailyTransactionTotal(client, walletId, type));
                currentTotal += currentCreditTotal;
            }


            validateDebitLimits(type, txAmount, currentTotal);

            validateBalance(type, txAmount, currentBalance);

            const newBalance =
                type === TxType.CREDIT
                    ? currentBalance + txAmount
                    : currentBalance - txAmount;

            const updated = await this.walletRepo.updateWallet(
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

            await this.walletRepo.updateTransaction(client, {
                walletId,
                amount: txAmount,
                type,
                idempotencyKey,
                balanceBefore: currentBalance,
                balanceAfter: newBalance
            });

            if(!isShared) await client.query("COMMIT");

            logger.info({
                event: "TRANSACTION_SUCCESS",
                walletId,
                amount,
                type,
                balanceAfter: newBalance.toString()
            });

            const response = { balance: newBalance.toString() };

            await this.cacheResponse(idempotencyKey, response);

            return response;

        } catch (err) {
            if(!isShared) await client.query("ROLLBACK");
            throw err;
        } finally {
            if(!isShared) client.release();
        }
    }
    private async getCachedResponse(key: string) {
        try {
            const cached = await this.redisClient.get(key);
            return cached ? JSON.parse(cached) : null;
        } catch (err) {
           logger.warn({ key }, "Redis unavailable, proceeding without cache");
            return null;
        }
    }
    private async cacheResponse(key: string, response: any) {
        try {
            await this.redisClient.set(key, JSON.stringify(response), { EX: 600 });
        } catch (err) {
              logger.warn({ key }, "Redis unavailable, proceeding without cache");
        }
    }
}


