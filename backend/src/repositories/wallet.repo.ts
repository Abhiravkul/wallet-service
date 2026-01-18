import { PoolClient } from "pg";

type TransactionData = {
    walletId: number,
    amount: bigint,
    type: 'CREDIT' | 'DEBIT',
    idempotencyKey: string
}

export class WalletRepository {
    async create(client: PoolClient, user_id: number) {
        const result = await client.query(
            "INSERT INTO wallet (user_id) VALUES ($1) RETURNING id, balance",
            [user_id]
        );
        return {
            wallet_id: result.rows[0].id,
            balance: result.rows[0].balance,
        }
    }
    async findById(client: PoolClient, walletId: number) {
        const result = await client.query(
            "SELECT balance, version FROM wallet WHERE id = $1",
            [walletId]
        );
        return result.rows[0];
    }

    async updateWallet(client: PoolClient, balance: bigint, walletId: number, currentVersion: number) {
        const result = await client.query(
            "UPDATE wallet SET balance = $1, version = version + 1 WHERE id = $2 AND version = $3",
            [balance, walletId, currentVersion]
        );
        return result;
    }

    async updateTransaction(client: PoolClient, data: TransactionData) {
        await client.query(
            "INSERT INTO transactions (wallet_id, amount, type, status, idempotency_key) VALUES ($1, $2, $3, $4, $5)",
            [data.walletId, data.amount, data.type, "SUCCESS", data.idempotencyKey]
        );
    }
}

