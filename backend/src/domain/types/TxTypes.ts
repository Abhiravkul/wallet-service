export enum TxType { CREDIT = "CREDIT", DEBIT = "DEBIT" }
export enum WalletStatus {
    ACTIVE = "ACTIVE",
    SUSPENDED = "SUSPENDED",
    CLOSED = "CLOSED"
}

export const MAX_DEBIT_LIMIT:number = 100000
export const MAX_DAILY_LIMIT: number = 500000