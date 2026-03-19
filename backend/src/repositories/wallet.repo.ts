import { PoolClient } from "pg";
import { TxType } from "../domain/types/TxTypes";
import { logger } from "../utils/logger";
type TransactionData = {
    walletId: number,
    amount: bigint,
    type: 'CREDIT' | 'DEBIT',
    idempotencyKey: string,
    balanceBefore: BigInt,
    balanceAfter: BigInt
}

export class WalletRepository {
    async create(client: PoolClient, user_id: number) {
        const currency = "Rupee";

        logger.debug({
            operation: "INSERT_WALLET",
            user_id: user_id
        }, "Creating wallet");

        const result = await client.query(
            "INSERT INTO wallet (user_id, currency) VALUES ($1, $2) RETURNING id, balance",
            [user_id, currency]
        );

        logger.debug({
            operation: "INSERT_WALLET",
            walletId: result.rows[0].id,
            balance: result.rows[0].balance?.toString()
        }, "Wallet created in DB");

        return {
            wallet_id: result.rows[0].id,
            balance: result.rows[0].balance.toString()
        }
    }
    async findById(client: PoolClient, walletId: number) {
        logger.debug({
            operation: "SELECT_WALLET",
            walletId
        }, "Fetching wallet");

        const result = await client.query(
            "SELECT balance, version, status, currency FROM wallet WHERE id = $1",
            [walletId]
        );

        logger.debug({
            operation: "SELECT_WALLET",
            walletId,
            found: Boolean(result.rows[0]),
        }, "Wallet fetch result");
        return result.rows[0];
    }

    async updateWallet(client: PoolClient, balance: bigint, walletId: number, currentVersion: number) {
        logger.debug({
            operation: "UPDATE_WALLET",
            walletId,
            balance: balance.toString(),
            currentVersion
        }, "Updating wallet");

        const result = await client.query(
            "UPDATE wallet SET balance = $1, version = version + 1 WHERE id = $2 AND version = $3",
            [balance, walletId, currentVersion]
        );

        logger.debug({
            operation: "UPDATE_WALLET",
            walletId,
            rowsAffected: result.rowCount
        }, "Wallet update result");
        return result;
    }

    async updateTransaction(client: PoolClient, data: TransactionData) {
        logger.debug({
            operation: "INSERT_TRANSACTION",
            walletId: data.walletId,
            amount: data.amount.toString(),
            type: data.type
        }, "Inserting transaction");

        await client.query(
            "INSERT INTO transactions (wallet_id, amount, type, status, idempotency_key, balance_before, balance_after) VALUES ($1, $2, $3, $4, $5, $6, $7)",
            [data.walletId, data.amount, data.type, "SUCCESS", data.idempotencyKey, data.balanceBefore, data.balanceAfter]
        );

        logger.debug({
            operation: "INSERT_TRANSACTION",
            walletId: data.walletId,
            idempotencyKey: data.idempotencyKey
        }, "Transaction inserted");
    }

    async getDailyTransactionTotal(client: PoolClient, walletID: number, type: TxType) {

        logger.debug({
            operataion: "SELECT_DAILY_TOTAL",
            walletID,
            type
        }, "Fetching daily transaction total");

        const result = await client.query(
            "SELECT COALESCE(SUM(amount),0) FROM TRANSACTIONS WHERE wallet_id = $1 AND type = $2 AND created_at >= CURRENT_DATE",
            [walletID, type]
        );
        logger.debug({
            operataion: "SELECT_DAILY_TOTAL",
            walletID,
            type,
            total: result.rows[0].coalesce
        }, "Daily transaction total fetched");

        return result.rows[0].coalesce;
    }
}

