import { MAX_DAILY_LIMIT, MAX_DEBIT_LIMIT, TxType, WalletStatus } from "../types/TxTypes";
import { ErrorCode } from "../errors/ErrorCode";
import { ValidationError } from "../errors/ValidationError";
import { Wallet } from "../types/wallet";

export function validateWalletStatus(status: string, type: TxType) {
    if (status === WalletStatus.SUSPENDED && type === TxType.DEBIT) {
        throw new ValidationError(ErrorCode.WALLET_LOCKED, "Account is suspended")
    }

    if (status === WalletStatus.CLOSED) {
        throw new ValidationError(ErrorCode.WALLET_CLOSED, "Account is closed"
        )
    }
}

export function validateCurrency(walletCurrency: string, currency: string) {

    if (walletCurrency !== currency) {
        throw new ValidationError(ErrorCode.INVALID_CURRENCY, "Invalid currency transfer")
    }
}

export function validateDebitLimits(type: TxType, txAmount: bigint, currentTotal: bigint) {
    if (type == TxType.DEBIT && txAmount > MAX_DEBIT_LIMIT) {
        throw new ValidationError(ErrorCode.MAX_LIMIT_EXCEEDED, "Maximum Debit limit exceeded");
    }

    if (currentTotal > MAX_DAILY_LIMIT) {
        throw new ValidationError(ErrorCode.DAILY_LIMIT_EXCEEDED, "Daily transaction limit exceeded"
        );
    }
}

export function validateBalance(type: TxType, txAmount: bigint, currentBalance: bigint) {
    if (type === TxType.DEBIT && currentBalance < txAmount) {
        throw new ValidationError(ErrorCode.INSUFFICIENT_FUNDS, "Balance too low");
    }
}

export function validateWalletExists(wallet: Wallet) {
    if (!wallet) {
        throw new ValidationError(ErrorCode.INVALID_WALLET_ID, "Wallet not found");
    }
}

