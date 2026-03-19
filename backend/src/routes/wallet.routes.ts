import { Router } from "express";
import { TxType } from "../domain/types/TxTypes";
import { asyncHandler } from "../utils/asyncHandler";
import { createWalletModule } from "../modules/wallet/wallet.module";
const router = Router();
const {controller} = createWalletModule();
// Create Wallet
router.post("/wallets", asyncHandler(controller.create));

// Transactions
router.post("/wallets/:id/credit", asyncHandler(controller.handleTransaction(TxType.CREDIT)));
router.post("/wallets/:id/debit", asyncHandler(controller.handleTransaction(TxType.DEBIT)));

export default router;