import { pool } from "../utils/db";
import { redisClient } from "../utils/redis";
import { WalletRepository } from "../repositories/wallet.repo";
import { withRetry } from "../utils/retry";
const walletRepo = new WalletRepository();

export enum TxType { CREDIT = "CREDIT", DEBIT = "DEBIT" }

export class WalletService {
    async createWallet(user_id: number){
        let client;
        try{
            client = await withRetry(()=> pool.connect());
            const response = await walletRepo.create(client, user_id);
            return response;
        }finally{
            if(client) client.release();
        }
    }
    async executeTx(walletId: number, amount: number, idempotencyKey: string, type: TxType) {

        let cachedResponse: string | null = null;
        try {
            cachedResponse = await redisClient.get(idempotencyKey);
        } catch (err) {
            console.warn("Redis unavailable, proceeding without cache");
        }
        if (cachedResponse) {
            return JSON.parse(cachedResponse);
        }

        let client;
        try {
            client = await withRetry(() => pool.connect());
            await client.query("BEGIN");

            const walletResult = await walletRepo.findById(client, walletId);

            if (!walletResult) throw new Error("WALLET_NOT_FOUND");

            const currentBalance = BigInt(walletResult.balance);
            const bigAmount = BigInt(amount)
            const currentVersion = walletResult.version;

            if (type === TxType.DEBIT && currentBalance < bigAmount) {
                throw new Error("INSUFFICIENT_FUNDS");
            }

            const newBalance = type === TxType.CREDIT
                ? currentBalance + bigAmount
                : currentBalance - bigAmount;

            const updateWallet = await walletRepo.updateWallet(client, newBalance, walletId, currentVersion);
            if (updateWallet.rowCount === 0){
                await client.query("ROLLBACK");
                throw new Error('CONCURRENCY_CONFLICT');
            } 

            await walletRepo.updateTransaction(client, { walletId, amount: bigAmount, type, idempotencyKey });

            await client.query("COMMIT");

            const response = { balance: newBalance.toString() };
            await redisClient.set(idempotencyKey, JSON.stringify(response), { EX: 600 });

            return response;
        } catch (error) {
            if (client) await client.query("ROLLBACK");
            throw error;
        } finally {
            if (client) client.release();
        }
    }
}
