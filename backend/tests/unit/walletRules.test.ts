import {
    validateBalance,
    validateCurrency,
    validateDebitLimits,
    validateWalletExists,
    validateWalletStatus
} from "../../src/domain/rules/walletRules";

import { TxType, WalletStatus } from "../../src/domain/types/TxTypes";
import { Wallet } from "../../src/domain/types/wallet";
import { ValidationError } from "../../src/domain/errors/ValidationError";

describe("Wallet Domain Rules", () => {
    
    const mockWallet: Wallet = {
        id: 1,
        user_id: 1,
        balance: BigInt(100),
        currency: "INR", 
        status: WalletStatus.ACTIVE,
        version: 1,
        created_at: new Date()
    };

    describe("validateWalletExists", () => {
        test("should throw specifically when wallet is null", () => {
            expect(() => validateWalletExists(null))
                .toThrow(ValidationError);
        });

        test("should pass for valid wallet object", () => {
            expect(() => validateWalletExists(mockWallet)).not.toThrow();
        });
    });

    describe("validateWalletStatus", () => {
        test("should block suspended wallets on debit", () => {
            expect(() => validateWalletStatus(WalletStatus.SUSPENDED, TxType.DEBIT))
                .toThrow(/suspended/i);
        });

        test("should block closed wallets entirely", () => {
            expect(() => validateWalletStatus(WalletStatus.CLOSED, TxType.DEBIT))
                .toThrow(/closed/i);
        });
    });

    describe("validateBalance", () => {
        test("should throw when debit amount exceeds balance", () => {
            expect(() => validateBalance(TxType.DEBIT, BigInt(101), BigInt(100)))
                .toThrow(/balance.*low/i);
        });

        test("should allow debit when balance is exactly equal to amount", () => {
            expect(() => validateBalance(TxType.DEBIT, BigInt(100), BigInt(100)))
                .not.toThrow();
        });
    });

    describe("validateCurrency", () => {
        test("should prevent cross-currency transactions", () => {
            expect(() => validateCurrency("INR", "USD"))
                .toThrow(/invalid currency/i);
        });
    });

    describe("validateDebitLimits", () => {
        test("should enforce daily ceiling", () => {
            const limit = BigInt(1000);
            const currentTotal = BigInt(950);
            const newDebit = BigInt(150000);

            expect(() => validateDebitLimits(TxType.DEBIT, newDebit, currentTotal + newDebit))
                .toThrow(/Debit limit exceeded/i); 
        });
    });
});